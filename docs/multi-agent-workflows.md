---
title: 多代理與自動化工作流
slug: multi-agent-workflows
level: advanced
tags: [工作流, 架構, 工具鏈, 提示詞]
prerequisites: [spec-driven-development]
estimated_minutes: 100
path: advanced
updated: 2026-09-14
maintainers: []
status: active
---

# 多代理與自動化工作流

> 把一件大工作拆成多個各司其職的 AI 代理，用明確的交接與護欄讓它們協作，而不是把全部塞進同一個對話。

## 學習目標

完成本單元後，你能夠：

1. 分辨序列、扇出／扇入、審查迴圈、人類介入四種多代理協作模式，並為任務選對模式。
2. 用 Python 標準函式庫實作一個可執行的編排器（orchestrator），讓階段之間透過檔案與狀態交接。
3. 為代理工作流加上回合上限、逾時與預算護欄，避免無限迴圈與成本失控。

## 前置知識

- [規格驅動開發](./spec-driven-development.md)：多代理的每個階段都需要明確的輸入與驗收標準。
- 基本 Python：`dataclasses`、`json`、`pathlib`、`concurrent.futures`。
- 知道什麼是「上下文視窗」（context window）與 token 成本。

## 為什麼重要

單一對話做複雜任務時會遇到三個天花板：**上下文膨脹**（越聊越長、重點被稀釋）、**角色混淆**（同一個模型既要當產品經理又要當測試者）、**無法平行**（只能一步一步來）。多代理工作流把「一個全能助手」換成「一條有明確分工的生產線」，每個代理只拿到它需要的上下文，輸出是可檢查的檔案而不是聊天訊息。

好處是可重現、可局部重跑、可平行、可審計。代價是複雜度：你需要定義交接格式、處理失敗重試、控制成本。本單元的重點不是「越多代理越好」，而是**在對的地方加對的代理**。

## 核心內容

### 什麼是「代理」與多代理

在本教材的定義中，**代理（agent）**是一個「接收輸入狀態、執行一件事、回傳新狀態」的單元。它可以是呼叫大型語言模型（LLM）的程式，也可以是一段確定性的規則程式。關鍵在於**邊界**：每個代理有單一職責、明確的輸入輸出，以及失敗時的處理方式。

**多代理工作流**就是把多個代理用控制流程串起來。控制流程可以是程式碼寫死的（deterministic orchestration），也可以是讓 LLM 自己決定下一步（LLM-driven orchestration）。實務上建議：**先寫死，等到流程穩定再局部交給 LLM 決策**。寫死的流程好除錯、成本可預測。

### 四種常見協作模式

| 模式 | 結構 | 適用情境 | 風險 |
|---|---|---|---|
| 序列（Sequential） | A → B → C | 步驟有嚴格先後，如 規格→實作→測試 | 單點失敗會中斷整條線 |
| 扇出／扇入（Fan-out/Fan-in） | 一個輸入 → 多個代理並行 → 彙整 | 多角度審查、多候選方案 | 合併衝突、結果不一致 |
| 審查迴圈（Critic loop） | 產生 → 審查 → 不合格則重做 | 需要品質門檻的產出 | 無限迴圈、成本上升 |
| 人類介入（Human-in-the-loop） | 代理暫停 → 人決策 → 續行 | 高風險決策、部署 | 流程被卡住，需逾時機制 |

先問「這個任務需要哪一種」，再動手。多數功能開發用「序列＋一個審查迴圈」就夠。

### 讓交接可重現：產物（artifacts）與狀態

代理之間不要靠「對話記憶」交接，要靠**產物**：規格檔、計畫檔、程式碼檔、審查報告。每個階段的輸出寫進磁碟，下一階段從磁碟讀。這樣你才能重跑單一階段、比對不同版本、在事後追查哪一步出錯。

狀態則用一個結構化物件表示，能序列化成 JSON。下面是一個最小狀態的欄位：

| 欄位 | 說明 |
|---|---|
| `spec` | 輸入規格（唯讀） |
| `plan` | 計畫階段的輸出 |
| `code` | 實作階段的輸出 |
| `review` | 審查意見 |
| `approved` | 審查是否通過 |
| `rounds` | 已審查回合數（護欄用） |

### 範例：可執行的迷你編排器

以下程式只使用標準函式庫。它實作「計畫 → 實作 → 審查，不合格就退回重做」的審查迴圈，並把最終產物寫到 `runs/`。

`orchestrator.py`：

```python
"""迷你多代理編排器：規格 -> 計畫 -> 實作 -> 審查（必要時修訂）。"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

MAX_REVIEW_ROUNDS = 3  # 護欄：最多重做 3 次


@dataclass
class Task:
    spec: str
    plan: str = ""
    code: str = ""
    review: str = ""
    approved: bool = False
    rounds: int = 0


def planner(task: Task) -> Task:
    words = [w for w in task.spec.split() if w]
    task.plan = f"計畫：實作 sum()，需處理 {len(words)} 個規格詞所述的邊界"
    return task


def implementer(task: Task) -> Task:
    if task.review:  # 有審查意見 => 這是修訂回合
        task.code = (
            "def solve(values):\n"
            "    if not values:\n"
            "        raise ValueError('values must not be empty')\n"
            "    return sum(values)"
        )
    else:  # 第一版：刻意缺少邊界防護
        task.code = "def solve(values):\n    return sum(values)"
    return task


def reviewer(task: Task) -> Task:
    task.rounds += 1
    has_guard = "raise" in task.code
    task.approved = has_guard
    task.review = "通過：已處理空輸入" if has_guard else "退回：未處理空輸入"
    return task


def run_pipeline(spec: str, out_dir: str = "runs") -> Task:
    task = Task(spec=spec)
    task = planner(task)
    task = implementer(task)
    task = reviewer(task)

    while not task.approved and task.rounds < MAX_REVIEW_ROUNDS:
        task = implementer(task)
        task = reviewer(task)

    if not task.approved:
        raise RuntimeError(f"審查未通過，已達上限 {MAX_REVIEW_ROUNDS} 回合")

    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "code.py").write_text(task.code + "\n", encoding="utf-8")
    (out / "task.json").write_text(
        json.dumps(asdict(task), ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return task


if __name__ == "__main__":
    result = run_pipeline("實作 sum 函式 空輸入 要 拋出 ValueError 例外")
    print("plan   :", result.plan)
    print("code   :")
    print(result.code)
    print("review :", result.review)
    print("rounds :", result.rounds)
    print("approved:", result.approved)
```

執行方式與預期輸出：

```text
$ python orchestrator.py
plan   : 計畫：實作 sum()，需處理 8 個規格詞所述的邊界
code   :
def solve(values):
    if not values:
        raise ValueError('values must not be empty')
    return sum(values)
review : 通過：已處理空輸入
rounds : 2
approved: True
```

重點觀察：第一版實作沒有防護，審查不通過；`while` 迴圈把任務退回，第二版補上 `raise` 後通過。`runs/code.py` 與 `runs/task.json` 是可重跑的產物。

### 扇出／扇入：平行審查

當你想同時跑多個審查角度（安全、效能、可讀性）時，用扇出。注意每個代理要拿到**自己的狀態副本**，否則會互相覆蓋：

```python
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace


def review_security(task: Task) -> Task:
    task.review = "安全：無 eval/exec，通過"
    return task


def review_readability(task: Task) -> Task:
    task.review = "可讀性：命名清楚，通過"
    return task


def fan_out(reviewers, task: Task) -> list[Task]:
    # 每個審查者拿到的必須是獨立副本（replace 產生新物件）
    with ThreadPoolExecutor(max_workers=len(reviewers)) as pool:
        return list(pool.map(lambda r: r(replace(task)), reviewers))


results = fan_out([review_security, review_readability], Task(spec="demo"))
for r in results:
    print(r.review)
```

預期輸出：

```text
安全：無 eval/exec，通過
可讀性：命名清楚，通過
```

（兩行順序可能互換，因為是平行執行。）**扇入**的做法是把多份審查意見彙整成一個決策：全部通過才算通過，或依權重計分。彙整規則要寫死，不要讓 LLM「自己判斷」。

### 用 AI 實作各階段

編排器定好後，把每個函式換成呼叫 LLM 即可。以 `implementer` 為例，提示詞要包含：規格、計畫、上一輪的審查意見（若有），並要求只輸出程式碼。用規格驅動開發的提示原則：**固定輸入、明確輸出、有歧義就問**。

無論用哪個模型或 SDK，都遵守同一條紀律：**把每次呼叫的輸入與輸出寫進產物檔**（例如 `runs/round-1/request.json`、`response.txt`）。這樣出錯時你能重放，而不是在聊天紀錄裡撈。

### 護欄：回合、逾時、預算

多代理最容易出事的地方是失控。至少要設三種護欄：

1. **回合上限**：迴圈最多跑 N 次（本範例 `MAX_REVIEW_ROUNDS = 3`）。
2. **逾時**：單一代理執行超過 T 秒就中止。`concurrent.futures` 的 `future.result(timeout=T)` 可做到。
3. **預算**：累計 token 或金額超過上限就停止，並留下已完成的中間產物。

護欄觸發時要**明確失敗**（拋錯並保留狀態），不要默默回傳半成品。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 代理共享同一個可變狀態 | 平行時互相覆蓋 | 每個代理拿 `dataclasses.replace` 的副本 |
| 用對話歷史交接 | 上下文膨脹、不可重現 | 用檔案產物交接，狀態序列化成 JSON |
| 審查迴圈沒有上限 | 模型互不讓步 | 設 `MAX_REVIEW_ROUNDS`，超限就失敗 |
| 把所有事塞給一個代理 | 職責不清、難除錯 | 每個代理單一職責，輸入輸出明確 |
| 讓 LLM 決定控制流程 | 行為不穩定、成本不可控 | 控制流程先寫死，穩定後才局部交給 LLM |
| 失敗時默默回傳半成品 | 錯誤被掩蓋 | 護欄觸發就拋錯，保留中間產物 |

## 動手練

**練習**：擴充本單元的編排器，加入「測試者」代理與扇入決策。

1. 新增 `tester(task)`：檢查 `task.code` 是否包含 `return`；若沒有，把 `task.approved` 設為 `False` 並在 `review` 加上「測試：找不到回傳值」。
2. 新增 `merge_reviews(results: list[Task]) -> Task`：把所有審查意見串成一個字串，且**只有當所有審查者都通過時** `approved` 才為 `True`。
3. 把流程改成：計畫 → 實作 → `fan_out([reviewer, tester])` → `merge_reviews`；不通過就退回重做，最多 3 回合。
4. 執行後印出 `rounds` 與最終 `approved`，並確認 `runs/task.json` 內容正確。

**提示**：`merge_reviews` 可以用 `"\n".join(r.review for r in results)`。注意 `approved` 的計算是 `all(r.approved for r in results)`；你要決定 `tester` 是否要修改 `approved`，或只回傳意見、由合併階段統一判斷——後者職責更清楚。

## 完成檢核標準

- [ ] 我能說出四種協作模式，並為一個具體任務選出合適的一種。
- [ ] 我的編排器用檔案產物交接狀態，且狀態能序列化成 JSON。
- [ ] 我的審查迴圈有回合上限，超限時會明確失敗。
- [ ] 我的平行扇出有使用獨立的狀態副本，不會互相覆蓋。
- [ ] 動手練的編排器執行成功，且我能貼出 `runs/task.json` 的內容。

## 延伸閱讀

- [Python 官方文件：`concurrent.futures`](https://docs.python.org/3/library/concurrent.futures.html)
- [Python 官方文件：`dataclasses`](https://docs.python.org/3/library/dataclasses.html)
- [Python 官方文件：`pathlib`](https://docs.python.org/3/library/pathlib.html)
- [Anthropic：Building effective agents（代理設計模式）](https://www.anthropic.com/engineering/building-effective-agents)

## 下一單元

[品質、安全與效能](./code-quality-security.md)
