---
title: 串接 API 與處理資料
slug: api-and-data
level: intermediate
tags: [資料, 除錯, 實作專案]
prerequisites: ["test-with-ai"]
estimated_minutes: 70
path: intermediate
updated: 2026-09-14
maintainers: []
status: active
---

# 串接 API 與處理資料

> 用標準函式庫抓取 JSON、驗證格式、處理錯誤，把外部資料安全地變成程式可用的形狀。

## 學習目標

完成本單元後，你能夠：

1. 用 `urllib.request` 發送 HTTP GET 並解析 JSON 回應。
2. 為網路請求加上逾時（timeout）與錯誤處理，區分 HTTP 錯誤與連線失敗。
3. 驗證外部資料的欄位與型別，並在資料不合預期時給出可讀的錯誤。
4. 用標準函式庫對資料做過濾、排序與彙總等處理。
5. 使用環境變數保存 API 金鑰，不在程式碼中硬編碼秘密。

## 前置知識

- [讓 AI 幫你寫測試](./test-with-ai.md)
- 你會執行 Python、操作 JSON，並用 `unittest` 驗證純函式。

## 為什麼重要

真實程式的資料幾乎都來自外部：第三方 API、資料庫匯出、使用者上傳。外部資料有兩個特性：**會失敗**（斷線、逾時、500）與**會變形**（少欄位、型別不對、多了你沒預期的值）。若沒有逾時與驗證，AI 產生的程式碼常在資料異常時安靜地回傳 `None` 或整支崩潰。把「抓取」「驗證」「處理」拆成三層後，每一層都能單獨測試，錯誤也有明確歸屬。

## 核心內容

### 小節一：用標準函式庫抓 JSON

先在本機起一個靜態伺服器，整段流程可離線重現。

建立 `data/tasks.json`：

```json
[
  {"id": 1, "title": "寫測試", "done": true, "minutes": 30},
  {"id": 2, "title": "串接 API", "done": false, "minutes": 45},
  {"id": 3, "title": "整理資料", "done": false, "minutes": 15}
]
```

啟動伺服器（另一個終端）：

```console
$ python -m http.server 8000 --directory data
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

抓取與解析：

```python
# fetch.py
import json
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

BASE = "http://127.0.0.1:8000"


def fetch_json(path, timeout=5):
    url = f"{BASE}{path}"
    try:
        with urlopen(url, timeout=timeout) as resp:
            charset = resp.headers.get_content_charset() or "utf-8"
            return json.loads(resp.read().decode(charset))
    except HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}：{url}") from e
    except URLError as e:
        raise RuntimeError(f"連線失敗：{e.reason}") from e
    except json.JSONDecodeError as e:
        raise RuntimeError(f"回應不是合法 JSON：{e}") from e


if __name__ == "__main__":
    print(fetch_json("/tasks.json"))
```

執行與預期輸出：

```console
$ python fetch.py
[{'id': 1, 'title': '寫測試', 'done': True, 'minutes': 30}, ...]
```

`timeout=5` 是必要的：沒有逾時的請求可能永遠卡住。把 `URLError` 與 `HTTPError` 分開處理，能讓你分辨「伺服器掛了」與「這個路徑不存在」。

### 小節二：先驗證，再使用

不要假設回應的形狀。寫一個驗證函式，明確拒絕壞資料：

```python
# validate.py
def parse_tasks(raw):
    if not isinstance(raw, list):
        raise ValueError("預期最外層是陣列")
    tasks = []
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ValueError(f"第 {i} 項不是物件")
        for key, typ in (("id", int), ("title", str), ("done", bool)):
            if key not in item:
                raise ValueError(f"第 {i} 項缺少欄位 {key}")
            if not isinstance(item[key], typ):
                raise ValueError(f"第 {i} 項的 {key} 型別應為 {typ.__name__}")
        tasks.append({
            "id": item["id"],
            "title": item["title"],
            "done": item["done"],
            "minutes": int(item.get("minutes", 0)),
        })
    return tasks
```

**白名單輸出**：只挑出你需要的欄位，外部多餘的資料不會滲進程式內部。

### 小節三：用標準函式庫處理資料

```python
# process.py
def pending_minutes(tasks):
    return sum(t["minutes"] for t in tasks if not t["done"])


def by_title(tasks):
    return sorted(tasks, key=lambda t: t["title"])


def group_by_status(tasks):
    grouped = {"done": [], "pending": []}
    for t in tasks:
        grouped["done" if t["done"] else "pending"].append(t["title"])
    return grouped
```

組合起來：

```python
if __name__ == "__main__":
    raw = fetch_json("/tasks.json")
    tasks = parse_tasks(raw)
    print("待辦總時數：", pending_minutes(tasks))
    print("已完成：", group_by_status(tasks)["done"])
```

預期輸出：

```text
待辦總時數： 60
已完成： ['寫測試']
```

### 小節四：驗證函式用測試保護

純函式最好測，因為不需要真的連網：

```python
# tests/test_data.py
import unittest

from validate import parse_tasks


class TestParseTasks(unittest.TestCase):
    def test_rejects_non_list(self):
        with self.assertRaises(ValueError):
            parse_tasks({"id": 1})

    def test_rejects_missing_field(self):
        with self.assertRaises(ValueError):
            parse_tasks([{"id": 1, "done": False}])

    def test_normalizes_missing_minutes(self):
        result = parse_tasks([{"id": 1, "title": "a", "done": False}])
        self.assertEqual(result[0]["minutes"], 0)

    def test_drops_unknown_fields(self):
        result = parse_tasks(
            [{"id": 1, "title": "a", "done": False, "hack": "x"}]
        )
        self.assertNotIn("hack", result[0])
```

### 小節五：金鑰放在環境變數

需要 API 金鑰的服務，**絕對不要把金鑰寫進程式碼或提交進 Git**。從環境變數讀取：

```python
import os

API_KEY = os.environ.get("SERVICE_API_KEY")
if not API_KEY:
    raise SystemExit("缺少環境變數 SERVICE_API_KEY")
```

設定方式（PowerShell，僅作用於當前視窗）：

```console
$ $env:SERVICE_API_KEY = "你的金鑰"
```

需要帶入請求時，放在 header：

```python
from urllib.request import Request

req = Request(url, headers={"Authorization": f"Bearer {API_KEY}"})
with urlopen(req, timeout=10) as resp:
    data = json.loads(resp.read().decode("utf-8"))
```

`待確認`：各家 API 的驗證標頭格式不同（`Bearer`、`x-api-key`、`Basic` 等），請以該服務的官方文件為準，不要憑印象填入。

### 小節六：分頁與速率限制（觀念）

大型 API 常一次只回一部分資料。分頁常見兩種形式：`?page=2` 或回傳 `next_cursor`。抓到沒有下一頁為止：

```text
重複：
  抓取 page
  處理 items
  若回應沒有 next 欄位 → 停止
  否則 page = next
```

速率限制（rate limit）通常以 HTTP 429 表示。遇到 429 時應退避重試（exponential backoff）：等待時間逐次加倍，而非立刻重送。`待確認`：具體的重試次數與等待上限依服務條款而定。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 請求沒有 timeout | 連線卡住時程式永遠不回 | 所有網路呼叫都設 `timeout` |
| 直接信任 API 回傳的欄位 | 外部資料會變形 | 先用 `parse_tasks` 驗證與白名單輸出 |
| 金鑰寫在程式碼裡 | 提交後外洩 | 從環境變數讀取，並納入 `.gitignore` |
| 只處理成功回應 | 忽略 4xx/5xx 與連線失敗 | 分別捕捉 `HTTPError` 與 `URLError` |
| 遇到 429 立刻重送 | 觸發更嚴格限制 | 指數退避重試 |
| 把整包外部 dict 傳進核心邏輯 | 內部程式碼被外部格式綁死 | 在邊界轉成自己的乾淨結構 |
| 測試真實打 API | 慢、不穩、依賴網路 | 測純函式 `parse_tasks`，網路呼叫另以手動驗證 |

## 動手練

**練習**：完成一條「抓取 → 驗證 → 處理 → 測試」的離線管線。

1. 建立 `data/tasks.json`（用「小節一」的內容），以 `python -m http.server 8000 --directory data` 啟動。
2. 將 `fetch_json`、`parse_tasks`、三個處理函式分別放進 `fetch.py`、`validate.py`、`process.py`。
3. 執行 `python fetch.py`，確認印出任務陣列。把伺服器關掉再執行一次，確認得到「連線失敗」的可讀錯誤，而非 traceback。
4. 把 `data/tasks.json` 改成 `{"oops": true}`，重啟伺服器後執行，確認 `parse_tasks` 拋出「預期最外層是陣列」。
5. 撰寫 `tests/test_data.py`（參考小節四），並補一個測試：`minutes` 是字串 `"30"` 時應被拒絕。
6. 執行 `python -m unittest discover -s tests -v`，確認全部通過。

**提示**：`http.server` 的 `--directory` 需要 Python 3.7 以上。若 `parse_tasks` 對 `"30"` 的處理你選擇自動轉型而非拒絕，請在函式中明寫並補對應測試——重點是「行為明確且被測試」，不是採用哪一種策略。

## 完成檢核標準

- [ ] 我的網路請求都有 `timeout`，且分別處理 `HTTPError` 與 `URLError`。
- [ ] 我有一個只輸出白名單欄位的 `parse_tasks`，且對缺欄位、型別錯會拋錯。
- [ ] 處理函式（過濾／排序／彙總）是純函式，且有 `unittest` 覆蓋。
- [ ] 我能在關掉伺服器後得到可讀的錯誤訊息，而不是未處理的 traceback。
- [ ] 我的程式從環境變數讀取金鑰，程式碼中沒有任何硬編碼秘密。
- [ ] 我知道遇到 429 要退避重試，而不是立刻重送。

## 延伸閱讀

- [Python 官方文件：urllib.request](https://docs.python.org/3/library/urllib.request.html)
- [Python 官方文件：json](https://docs.python.org/3/library/json.html)
- [MDN：HTTP response status codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

## 下一單元

[上下文工程：讓 AI 記得對的事](./context-engineering.md)
