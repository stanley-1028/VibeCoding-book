---
title: 評測與可觀測性
slug: evaluation-and-observability
level: advanced
tags: [測試, 資料, 工具鏈, 最佳實踐]
prerequisites: [code-quality-security]
estimated_minutes: 105
path: advanced
updated: 2026-09-14
maintainers: []
status: active
---

# 評測與可觀測性

> 用黃金資料集量出系統好壞，用結構化日誌、指標與追蹤回答「線上是哪裡、為什麼慢／錯」。

## 學習目標

完成本單元後，你能夠：

1. 建立黃金資料集（golden set），並用 Python 標準函式庫計算精確率、召回率、F1 與混淆矩陣。
2. 設定基準（baseline）與回歸門檻，讓品質退步在 CI 被擋下。
3. 產生帶關聯 ID 的結構化 JSON 日誌，並量測單一操作耗時（span）。
4. 說明 LLM-as-a-judge 的偏誤，並知道何時該採用。

## 前置知識

- [品質、安全與效能](./code-quality-security.md)：測試是評測的基礎；本單元把「單一正確」擴展為「統計品質」。
- Python 基礎：`json`、`logging`、`contextvars`。
- 基本機率概念：真陽性、偽陽性、偽陰性、真陰性。

## 為什麼重要

在 Vibe Coding 中，你很快就能改一個提示、換一個模型，卻說不出「這次改動讓系統變好還是變差」。沒有評測，優化只能靠感覺；沒有可觀測性，線上出錯只能猜。**評測**回答「離線時系統表現如何」，**可觀測性**回答「線上運行時發生了什麼」。AI 系統多了機率性與非決定性，這兩件事比傳統軟體更重要。

## 核心內容

### 建立黃金資料集

黃金資料集是一組有正確答案的輸入輸出配對。四個要求：

- **代表性**：涵蓋真實輸入分布，含常見案例與邊界案例。
- **標註可信**：答案由人確認，不是模型自己生的。
- **可成長**：線上發現新錯例就補進資料集，防止同一個錯再犯。
- **版本控制**：與程式碼一起版控，題目變更留下紀錄。

最簡單的格式是 JSON Lines（JSONL），每行一個 JSON 物件，逐行可讀、易於 diff、可串流處理，例如 `{"input": "lunch tomorrow?", "expected": "ham"}`。

### 指標：精確率、召回率、F1

以垃圾訊息分類為例，把「spam」定為正類：

| | 預測 spam | 預測 ham |
|---|---|---|
| 實際 spam | 真陽性 TP | 偽陰性 FN |
| 實際 ham | 偽陽性 FP | 真陰性 TN |

- **精確率（precision）** = TP / (TP + FP)：說它是 spam 的，有多少真的是。
- **召回率（recall）** = TP / (TP + FN)：真正的 spam，抓到了多少。
- **F1** = 2PR / (P + R)：兩者的調和平均。
- **準確率（accuracy）** = (TP + TN) / 全部，類別不平衡時會誤導。

選哪個指標取決於代價。漏掉一封垃圾信（FN）通常比誤擋一封正常信（FP）輕，所以垃圾郵件過濾偏好高召回率。

### 範例：可執行的評測腳本

以下只使用標準函式庫。`classifier.py`（被評測的系統）：

```python
"""規則式垃圾訊息分類器。"""
KEYWORDS = ("free", "winner", "click", "prize")


def predict(text: str) -> str:
    return "spam" if any(k in text.lower() for k in KEYWORDS) else "ham"
```

`golden.jsonl`（八筆黃金資料）：

```text
{"input": "win a free prize now", "expected": "spam"}
{"input": "click here to claim", "expected": "spam"}
{"input": "lunch tomorrow?", "expected": "ham"}
{"input": "team meeting at 3", "expected": "ham"}
{"input": "you are a winner", "expected": "spam"}
{"input": "free coffee in kitchen", "expected": "ham"}
{"input": "project update attached", "expected": "ham"}
{"input": "claim your prize", "expected": "spam"}
```

`eval_harness.py`：

```python
"""對黃金資料集執行評測並輸出指標。"""
import json
from pathlib import Path

from classifier import predict


def confusion(rows: list[dict]) -> dict[str, int]:
    c = {"TP": 0, "FP": 0, "FN": 0, "TN": 0}
    for row in rows:
        pred = predict(row["input"])
        if pred == "spam":
            c["TP" if row["expected"] == "spam" else "FP"] += 1
        else:
            c["FN" if row["expected"] == "spam" else "TN"] += 1
    return c


def metrics(c: dict[str, int]) -> dict[str, float]:
    tp, fp, fn, tn = c["TP"], c["FP"], c["FN"], c["TN"]
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    accuracy = (tp + tn) / sum(c.values()) if sum(c.values()) else 0.0
    return {"accuracy": accuracy, "precision": precision, "recall": recall, "f1": f1}


if __name__ == "__main__":
    rows = [
        json.loads(line)
        for line in Path("golden.jsonl").read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    c = confusion(rows)
    m = metrics(c)
    print(f"accuracy : {m['accuracy']:.3f}")
    print(f"precision: {m['precision']:.3f}")
    print(f"recall   : {m['recall']:.3f}")
    print(f"f1       : {m['f1']:.3f}")
    print(f"TP={c['TP']} FP={c['FP']} FN={c['FN']} TN={c['TN']}")
```

執行方式與預期輸出：

```text
$ python eval_harness.py
accuracy : 0.875
precision: 0.800
recall   : 1.000
f1       : 0.889
TP=4 FP=1 FN=0 TN=3
```

可自行驗算：八筆中有一筆誤判（`free coffee in kitchen` 被當成 spam），所以 `FP=1`；沒有漏抓，`recall=1.0`。

### 基準與回歸門檻

把基準寫進檔案，CI 每次跑完比對；退步超過容忍值就失敗：

```python
import json
from pathlib import Path


def check_regression(current: dict, baseline_path: str, tolerance: float = 0.02) -> None:
    baseline = json.loads(Path(baseline_path).read_text(encoding="utf-8"))
    for key, value in baseline.items():
        if current.get(key, 0.0) < value - tolerance:
            raise SystemExit(f"回歸：{key} 從 {value:.3f} 降到 {current[key]:.3f}")
    print("通過：無明顯回歸")
```

容忍值要小，別用它掩蓋真退步；基準只在明確改善後才更新，並在提交訊息說明原因。

### LLM-as-a-judge 的注意事項

輸出是自由文字、沒有單一正確答案時（摘要、客服回覆），可請 LLM 當評審。它便宜、可擴充，但有已知偏誤：

- **非決定性**：同一輸入可能得到不同分數。降低 temperature、固定提示、多次取平均。
- **位置偏誤**：比較兩答案時偏好排在前面的。交換順序各評一次再平均。
- **長度偏誤**：傾向給長答案高分。在評分標準（rubric）中明確排除篇幅。
- **未校準**：與人類判斷未必一致。先用人工標註的資料算出一致率，不夠就別單獨採用。

評分標準要寫成可勾選的條目（例如「是否包含所有事實」），而不是「好不好」。能用人類或規則判斷的部分，就不要交給 LLM。

### 可觀測性三支柱

| 支柱 | 回答 | 形式 |
|---|---|---|
| 日誌（logs） | 發生了什麼事 | 事件流，最好是結構化 JSON |
| 指標（metrics） | 數量與趨勢如何 | 計數器、直方圖 |
| 追蹤（traces） | 請求經過哪些步驟、各花多久 | 帶關聯 ID 的 span 樹 |

三者用**關聯 ID（correlation ID）**串起來：同一個請求的日誌與 span 都帶同一個 ID。`contextvars` 讓 ID 跨函式取得，不必一路當參數傳。以下只使用標準函式庫。

`obs.py`：

```python
"""結構化 JSON 日誌與計時 span。"""
import contextvars
import json
import logging
import time
import uuid

request_id = contextvars.ContextVar("request_id", default="-")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {"level": record.levelname, "msg": record.getMessage(), "request_id": request_id.get()}
        payload.update(getattr(record, "extra_fields", {}))
        return json.dumps(payload, ensure_ascii=False)


logger = logging.getLogger("app")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)


class span:
    def __init__(self, name: str) -> None:
        self.name = name

    def __enter__(self) -> "span":
        self.start = time.perf_counter()
        return self

    def __exit__(self, *exc) -> bool:
        ms = (time.perf_counter() - self.start) * 1000
        logger.info("span", extra={"extra_fields": {"span": self.name, "duration_ms": round(ms, 3)}})
        return False


if __name__ == "__main__":
    token = request_id.set(uuid.uuid4().hex[:8])
    logger.info("request start", extra={"extra_fields": {"path": "/predict"}})
    with span("predict"):
        time.sleep(0.01)
    request_id.reset(token)
```

執行方式與預期輸出（ID 與毫秒數每次不同）：

```text
$ python obs.py
{"level": "INFO", "msg": "request start", "request_id": "3f9a1c2d", "path": "/predict"}
{"level": "INFO", "msg": "span", "request_id": "3f9a1c2d", "span": "predict", "duration_ms": 10.12}
```

同一請求的兩行日誌共用 `request_id`。真實系統中，這個 ID 由入口（例如 HTTP 標頭）產生並向下傳遞。指標可從日誌聚合（例如統計 `duration_ms` 分布），或使用專門函式庫；`OpenTelemetry` 是常見選擇，安裝方式與版本**待確認**（請依官方文件選用相容版本）。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 黃金資料集太小或偏斜 | 只測少數好案例 | 涵蓋邊界與常見分布，出錯就補題 |
| 用準確率評估不平衡資料 | 多數類別拉高數字 | 看精確率、召回率、F1 與混淆矩陣 |
| 回歸門檻太寬 | 掩蓋真退步 | 容忍值設小，改善才更新基準 |
| 直接相信 LLM 評審 | 不知其偏誤與一致率 | 先用人工標註校正，確認一致率再採用 |
| 日誌寫入個資或機密 | 外洩、違反法規 | 遮蔽（mask）敏感欄位後才輸出 |
| 日誌沒有關聯 ID | 無法串起一個請求 | 用 `contextvars` 或標頭傳遞 correlation ID |

## 動手練

**練習**：擴充評測與可觀測性。

1. 修改 `classifier.py`，加入關鍵字 `"meeting"`。重新執行 `eval_harness.py`，記錄四個指標的變化，並解釋哪一個指標下降（提示：`team meeting at 3` 會變成偽陽性）。
2. 把原始（未加 `"meeting"`）的指標存成 `baseline.json`，用 `check_regression` 比較修改後的結果，確認它會擋下退步。
3. 在 `obs.py` 主程式加入第二個 span `"load_model"`，包住 `time.sleep(0.02)`，確認兩行 span 日誌共用同一個 `request_id`。
4. 替 `obs.py` 寫一條 `unittest`：用 `io.StringIO` 當串流收集日誌並套用 `JsonFormatter()`，斷言每一行都是合法 JSON 且含 `request_id` 欄位。

**提示**：第 4 題若拿不到 JSON，先確認測試 handler 有設 `JsonFormatter()`；也可先單獨測 `JsonFormatter().format(record)` 的行為再整合。

## 完成檢核標準

- [ ] 我能建立 JSONL 黃金資料集，並用程式算出 TP/FP/FN/TN 與四個指標。
- [ ] 我能說明為何在不平衡資料上 accuracy 會誤導，並改用 F1。
- [ ] 我能設定基準並用回歸門檻在 CI 擋下品質退步。
- [ ] 我能產生帶相同 `request_id` 的結構化日誌與 span。
- [ ] 我能列舉 LLM-as-a-judge 的三種偏誤與對應緩解方式。
- [ ] 動手練完成，且我能貼出修改前後的指標對比。

## 延伸閱讀

- [Python 官方文件：`logging`](https://docs.python.org/3/library/logging.html)
- [Python 官方文件：`contextvars`](https://docs.python.org/3/library/contextvars.html)
- [Python 官方文件：`json`](https://docs.python.org/3/library/json.html)
- [OpenTelemetry 官方文件](https://opentelemetry.io/docs/)

## 下一單元

[畢業專案：從需求到上線](./capstone-project.md)
