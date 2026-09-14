---
title: 規格驅動開發
slug: spec-driven-development
level: advanced
tags: [工作流, 最佳實踐, 測試, 提示詞]
prerequisites: [mid-project]
estimated_minutes: 90
path: advanced
updated: 2026-09-14
maintainers: []
status: active
---

# 規格驅動開發

> 在請 AI 寫程式之前，先把「要解決什麼問題、介面長怎樣、怎樣算完成」寫成一份可驗收的規格。

## 學習目標

完成本單元後，你能夠：

1. 為一個小功能撰寫包含功能需求、介面契約與驗收標準的規格文件。
2. 把規格改寫成 Given-When-Then 形式的可執行測試，並用 Python 標準函式庫執行。
3. 用規格檔案驅動 AI 提示，並在需求變更時只修改單一來源（規格）。

## 前置知識

- [中階路徑的期末專案](./mid-project.md)：你需要先體驗過「用 AI 從模糊需求做出一個小專案」，才知道沒寫規格會痛在哪裡。
- 基本 Python 測試經驗（`unittest` 或 `pytest` 其一）。
- 能讀懂 Markdown 與 YAML。

## 為什麼重要

Vibe Coding 的典型失敗模式是：你用一段模糊的提示請 AI 寫程式，拿到會跑的程式碼，卻說不出它是否正確。需求只存在你的腦中與對話紀錄裡，換一個對話、換一個模型，行為就變了。

規格驅動開發（Spec-Driven Development, SDD）把「意圖」變成版本控制中的檔案。規格是唯一的真相來源（single source of truth）：程式碼、測試、提示詞都從它推導。當需求改變，你改規格，再重新推導，而不是在對話裡東補一句西補一句。對 AI 協作而言，這同時解決了三個問題：**上下文穩定**（每次都給同一份規格）、**可驗收**（驗收標準直接變測試）、**可回溯**（為什麼寫這段程式，看規格就知道）。

## 核心內容

### 什麼是規格驅動開發

規格驅動開發的流程固定為四步：

1. **寫規格**：定義問題、範圍、介面、驗收標準。
2. **推導測試**：把每條驗收標準變成一條測試。
3. **推導實作**：用規格與測試當上下文，請 AI 或自己寫實作。
4. **驗證與迭代**：跑測試；紅燈修程式，需求變更先改規格。

規格不需要長。一份小功能的規格大約 30～80 行就夠。重點是「可被驗收」，不是「寫得漂亮」。

### 規格的骨架

一份最小可用的規格包含以下區塊：

| 區塊 | 回答的問題 | 範例 |
|---|---|---|
| 問題陳述 | 誰、在什麼情境、遇到什麼痛 | 使用者想快速知道一段文字最常出現的單字 |
| 範圍（In scope） | 這次要做什麼 | 英數字計數、忽略標點、不分大小寫 |
| 非目標（Non-goals） | 這次刻意不做什麼 | 不做中文斷詞、不處理詞形還原 |
| 介面契約 | 對外函式、輸入、輸出、錯誤 | `count_words(text: str) -> dict[str, int]` |
| 驗收標準 | 怎樣算完成（可觀察的行為） | 見下節的 Given-When-Then |
| 邊界情況 | 空輸入、超長輸入、非法輸入 | 空字串回傳空字典 |

「非目標」這一塊最常被忽略，卻最能防止範圍蔓延（scope creep）。把它寫下來，AI 才不會「順便」幫你加上你沒要的功能。

### 驗收標準：Given-When-Then

驗收標準用固定句式，能直接對應到測試：

```text
Given  <前置狀態>
When   <執行的動作>
Then   <可觀察的結果>
```

以單字計數器規格 `SPEC-001` 為例：

```text
AC-1 Given 一段空字串
     When  呼叫 count_words("")
     Then  回傳空的 Counter

AC-2 Given 文字 "Go go GO"
     When  呼叫 count_words 之後取 ["go"]
     Then  得到 3

AC-3 Given 文字 "hi, hi!"
     When  呼叫 count_words 之後取 ["hi"]
     Then  得到 2（標點被忽略）
```

每個 AC 都要有唯一編號。編號讓你能在程式碼註解、測試名稱與程式碼審查中互相引用。

### 範例：從規格到可執行測試

以下範例只使用 Python 標準函式庫。先建立三個檔案。

`SPEC-001.md`（規格，節錄）：

```markdown
# SPEC-001 單字計數

## 範圍
- 以英文字母、數字與單引號組成單字
- 不分大小寫
- 依出現次數降冪排序；次數相同時依字母升冪

## 非目標
- 不做中文斷詞
- 不做詞形還原（running 與 run 視為不同字）

## 介面
- `count_words(text: str) -> collections.Counter`
- `top_words(text: str, n: int = 3) -> list[tuple[str, int]]`
```

`wordcount.py`（實作）：

```python
"""依 SPEC-001 實作的單字計數器。"""
import re
from collections import Counter

WORD_RE = re.compile(r"[A-Za-z0-9']+")


def count_words(text: str) -> Counter:
    return Counter(w.lower() for w in WORD_RE.findall(text))


def top_words(text: str, n: int = 3) -> list[tuple[str, int]]:
    counts = count_words(text)
    # 次數降冪、單字升冪，確保輸出穩定且可測試
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:n]
```

`test_wordcount.py`（測試，每條 AC 一條測試）：

```python
import unittest

from wordcount import count_words, top_words


class TestCountWords(unittest.TestCase):
    def test_ac1_empty_text_returns_empty_counter(self):
        self.assertEqual(count_words(""), {})

    def test_ac2_counting_is_case_insensitive(self):
        self.assertEqual(count_words("Go go GO")["go"], 3)

    def test_ac3_punctuation_is_ignored(self):
        self.assertEqual(count_words("hi, hi!")["hi"], 2)

    def test_tie_breaks_alphabetically(self):
        self.assertEqual(top_words("b a b a c", 2), [("a", 2), ("b", 2)])


if __name__ == "__main__":
    unittest.main()
```

執行方式與預期輸出：

```text
$ python -m unittest -v test_wordcount.py
test_ac1_empty_text_returns_empty_counter ... ok
test_ac2_counting_is_case_insensitive ... ok
test_ac3_punctuation_is_ignored ... ok
test_tie_breaks_alphabetically ... ok

Ran 4 tests in 0.00s

OK
```

`Counter()` 與空字典相等（`Counter() == {}` 為 `True`），所以 `AC-1` 可以直接斷言 `{}`。

### 用規格驅動 AI 提示

有了規格，提示詞不再是「幫我寫一個單字計數器」，而是：

```text
你是實作者。以下是規格 SPEC-001 與其驗收測試 test_wordcount.py。
只實作符合規格的 wordcount.py，不要修改測試或規格。
完成後回報：每個 AC 對應哪一段程式碼。
若規格有歧義，先提出問題，不要自行假設。
```

這段提示能運作，是因為它給了 AI 三件它最需要的東西：**固定輸入**（規格與測試）、**明確輸出**（只寫實作檔）、**邊界規則**（有歧義就問，不要猜）。把提示詞也放進版本控制（例如 `PROMPT.md`），你就能重現「這份程式碼是怎麼被產生的」。

### 規格變更的流程

當需求改變，順序必須是：**先改規格，再改測試，最後改實作**。

1. 修改 `SPEC-001.md`，新增或調整 AC。
2. 在 `test_wordcount.py` 加上對應測試，此時測試應該失敗（紅燈）。
3. 修改 `wordcount.py` 讓測試通過（綠燈）。
4. 重構，保持測試綠燈。

這個順序讓「規格」永遠領先程式碼，而不是事後補文件。如果先改程式碼，規格就會退化成過期的裝飾品。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 規格寫成實作細節 | 把「用 dict 存」寫進規格 | 規格只寫行為與介面，不寫內部資料結構 |
| 驗收標準無法觀察 | 寫「效能要好」這種主觀描述 | 改成可量測條件，例如「1 MB 文字 2 秒內完成」 |
| 沒有非目標 | 沒明講不做什麼 | 明列非目標，避免 AI 順便加功能 |
| 規格與測試不一致 | 只改其中一邊 | 讓每條 AC 有編號，測試名稱引用編號 |
| 一次寫太大份規格 | 想一次定案整個系統 | 切成小規格，每份對應一個可獨立驗收的功能 |
| 提示詞沒帶規格 | 靠對話記憶 | 每次提示都附完整規格檔案內容 |

## 動手練

**練習**：為一個新功能撰寫完整規格並實作。

功能需求：一個函式 `parse_duration(text: str) -> int`，把人類可讀的時間字串轉成秒數。規則如下：

- 支援 `h`、`m`、`s` 單位，例如 `1h30m`、`45s`、`2h5m10s`。
- 單位可省略，省略時視為秒，例如 `90` 代表 90 秒。
- 不接受負數、不支援小數、忽略前後空白。
- 非法輸入（例如 `1x`、空字串）拋出 `ValueError`。

請完成：

1. `SPEC-DURATION.md`：包含問題陳述、範圍、非目標、介面、至少 5 條編號 AC。
2. `duration.py`：實作。
3. `test_duration.py`：每條 AC 一條 `unittest` 測試。
4. 執行測試，貼出 `OK` 的輸出。

**提示**：可以用 `re.findall(r"(\d+)([hms]?)", text)` 抓出數字與單位配對，再檢查整串是否被完整消耗（例如用 `re.fullmatch` 驗證格式），就能自然處理非法輸入。別忘了測 `""` 與 `"1x"` 這兩個邊界。

## 完成檢核標準

- [ ] 我能寫出一份包含「非目標」區塊的規格，並說明它如何防止範圍蔓延。
- [ ] 我能把驗收標準寫成 Given-When-Then，且每條都有編號。
- [ ] 我能讓每條 AC 對應一條自動化測試，並成功執行。
- [ ] 我能在需求變更時，先改規格、再改測試、最後改實作。
- [ ] 我的動手練測試全部通過，且我貼出了 `OK` 的執行輸出。

## 延伸閱讀

- [Python 官方文件：`unittest`](https://docs.python.org/3/library/unittest.html)
- [Python 官方文件：`re` 正規表達式](https://docs.python.org/3/library/re.html)
- [Python 官方文件：`collections.Counter`](https://docs.python.org/3/library/collections.html#collections.Counter)
- [GitHub 官方文件：About READMEs（規格與文件版控的通用原則）](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)

## 下一單元

[多代理與自動化工作流](./multi-agent-workflows.md)
