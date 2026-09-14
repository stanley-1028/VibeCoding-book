---
title: "中階實戰：一個全端小工具"
slug: mid-project
level: intermediate
tags: [實作專案, 架構, 測試]
prerequisites: ["context-engineering"]
estimated_minutes: 75
path: intermediate
updated: 2026-09-14
maintainers: []
status: active
---

# 中階實戰：一個全端小工具

> 把前五個單元串成一條線：用結構、測試、API、上下文工程，做出一個有前後端的待辦工具。

## 學習目標

完成本單元後，你能夠：

1. 用標準函式庫 `http.server` 實作一個提供 JSON API 的後端。
2. 讓後端呼叫已測試過的 `core` 純函式，維持邏輯與 I/O 分離。
3. 用原生 `fetch` 寫出可讀取與新增任務的前端頁面。
4. 用 `unittest` 對 HTTP 端點做整合測試，並在測試後清理檔案。
5. 以分支、小提交與測試全綠的流程，完成一個可交付的迭代。

## 前置知識

- [上下文工程：讓 AI 記得對的事](./context-engineering.md)
- 你已完成 `tasklite` 的三層結構、`core` 的 `unittest`，以及 API 錯誤處理與驗證。

## 為什麼重要

單元二到五各自練了一項能力，但真實開發是把它們同時用上：一個需求會同時牽動後端端點、前端互動、測試與版控。這個專案刻意保持小，卻具備全端專案的骨架——HTTP 邊界、資料持久化、前端呼叫、整合測試。完成它之後，你在面對任何「做一個小工具」的需求時，都有一份可複用的起點，也知道 AI 的產出該放到哪一層。

## 核心內容

### 小節一：系統全貌

```text
瀏覽器 (static/index.html)
   │  fetch /api/tasks
   ▼
api.py（HTTP 邊界：解析請求、回傳 JSON）
   │  呼叫
   ▼
core.py（純函式：add_task…）── storage.py（讀寫 tasks.json）
```

**原則**：`api.py` 不寫商業邏輯，只做「解析 → 呼叫 core → 序列化」。`core.py` 不碰網路與檔案，因此單元三的測試完全可重用。

### 小節二：後端 API

```python
# src/tasklite/api.py
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from tasklite import core, storage

FILE = "tasks.json"
INDEX = Path("static/index.html")


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/tasks":
            self._send_json(200, storage.load(FILE))
        elif path in ("/", "/index.html"):
            html = INDEX.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)
        else:
            self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if urlparse(self.path).path != "/api/tasks":
            self._send_json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            title = payload["title"]
        except (json.JSONDecodeError, KeyError, AttributeError, UnicodeDecodeError) as e:
            self._send_json(400, {"error": f"請求格式錯誤：{e}"})
            return
        try:
            tasks = core.add_task(storage.load(FILE), title)
        except ValueError as e:
            self._send_json(400, {"error": str(e)})
            return
        storage.save(FILE, tasks)
        self._send_json(201, tasks[-1])

    def log_message(self, fmt, *args):
        pass


def run(port=8000):
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"TaskLite 啟動：http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
```

`ThreadingHTTPServer` 讓多個請求能並行；`log_message` 覆寫成不做事，避免測試輸出被洗版。

### 小節三：前端頁面

```html
<!-- static/index.html -->
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>TaskLite</title>
</head>
<body>
  <h1>TaskLite</h1>
  <form id="add-form">
    <input id="title" placeholder="新的任務" required>
    <button type="submit">新增</button>
  </form>
  <ul id="list"></ul>
  <script>
    async function refresh() {
      const tasks = await (await fetch("/api/tasks")).json();
      const list = document.getElementById("list");
      list.innerHTML = "";
      for (const t of tasks) {
        const li = document.createElement("li");
        li.textContent = `${t.id}. ${t.title}`;
        list.appendChild(li);
      }
    }
    document.getElementById("add-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("title");
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: input.value }),
      });
      if (!res.ok) {
        alert((await res.json()).error);
        return;
      }
      input.value = "";
      refresh();
    });
    refresh();
  </script>
</body>
</html>
```

前端只負責「送出」與「重繪」，所有驗證仍以後端與 `core` 為準——不要只靠瀏覽器端驗證。

### 小節四：整合測試

整合測試啟動真正的伺服器，用 `urllib` 打端點，測完清理檔案：

```python
# tests/test_api.py
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

from tasklite import api


class TestApi(unittest.TestCase):
    def setUp(self):
        api.FILE = "test_tasks.json"
        Path(api.FILE).unlink(missing_ok=True)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), api.Handler)
        self.port = self.server.server_address[1]
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        Path(api.FILE).unlink(missing_ok=True)

    def _post(self, body):
        req = Request(
            f"{self.base}/api/tasks",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        return urlopen(req)

    def test_add_then_list(self):
        with self._post({"title": "寫整合測試"}) as resp:
            self.assertEqual(resp.status, 201)
        with urlopen(f"{self.base}/api/tasks") as resp:
            tasks = json.loads(resp.read().decode("utf-8"))
        self.assertEqual(tasks[0]["title"], "寫整合測試")

    def test_empty_title_returns_400(self):
        with self.assertRaises(Exception) as ctx:
            self._post({"title": "   "})
        self.assertEqual(ctx.exception.code, 400)
```

執行與預期輸出：

```console
$ $env:PYTHONPATH = "src"
$ python -m unittest discover -s tests -v
test_add_then_list (test_api.TestApi) ... ok
test_empty_title_returns_400 (test_api.TestApi) ... ok
...
OK
```

這兩個測試同時驗證了「成功路徑」與「錯誤路徑」，也確認了前五單元的 `core`、`storage` 與 API 正確接線。

### 小節五：開發節奏

用單元一的流程，把這個專案拆成小提交：

```console
$ git switch -c feat/tasklite-api
$ git add src/tasklite/api.py
$ git commit -m "feat: 新增 /api/tasks 提供列表與新增"
$ git add static/index.html
$ git commit -m "feat: 前端讀取與新增任務"
$ git add tests/test_api.py
$ git commit -m "test: 覆蓋 API 成功與錯誤路徑"
```

每次提交前 `git diff` 確認範圍，測試全綠才提交。開新對話時，把 `AGENTS.md` 與這三個檔案的依賴鏈當上下文，AI 就能在正確的層級改動。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| `api.py` 自己再實作一次驗證 | 邏輯重複、兩處會不同步 | 驗證留在 `core`，`api.py` 只接呼叫與轉譯錯誤 |
| 前端驗證當成唯一防線 | 攻擊者可直接打 API | 後端與 `core` 必須各自驗證 |
| 測試沒清理 `tasks.json` | 汙染開發資料、測試互相影響 | `setUp`/`tearDown` 用獨立檔名並刪除 |
| 伺服器無法關閉 | 測試用非背景執行緒或未 `shutdown()` | daemon 執行緒 + `server.shutdown()` |
| 把 HTML 直接字串內嵌進 Python | 難維護、跳脫易錯 | 前端放 `static/index.html`，由後端讀取 |
| 一次提交所有變更 | 無法回溯單一功能 | 依「後端／前端／測試」拆成多個提交 |
| 在 API 層直接讀寫檔案 | 邏輯與 I/O 再次糾纏 | 一律經過 `core` 與 `storage` |

## 動手練

**練習**：完成 TaskLite 全端版，並在分支上交付。

1. 建立分支 `feat/tasklite-api`。
2. 依「小節二」建立 `src/tasklite/api.py`，依「小節三」建立 `static/index.html`（若 `core` 尚無 `add_task`，先補上並通過單元三的測試）。
3. 執行 `python -m src.tasklite.api`（或設定 `PYTHONPATH=src` 後 `python -m tasklite.api`），開啟 `http://127.0.0.1:8000`，新增一筆任務並確認頁面顯示。
4. 依「小節四」建立 `tests/test_api.py`，執行 `python -m unittest discover -s tests -v`，確認成功與錯誤路徑皆綠。
5. 用 `curl` 或瀏覽器開發者工具，送出一筆 `{"title": "   "}`，確認回傳 400 與可讀錯誤訊息。
6. 依「小節五」拆成三個提交，最後把分支合併回 `main`。

**加碼（可選）**：新增 `POST /api/tasks/<id>/complete`，讓任務可標記完成。先寫整合測試（紅燈），再請 AI 依 `AGENTS.md` 的規則只改 `api.py` 與 `core.py`。

**提示**：若頁面空白，先開開發者工具的 Network 面板，確認 `/api/tasks` 回傳 200 且是合法 JSON。若 `python -m tasklite.api` 找不到模組，檢查 `PYTHONPATH` 是否指向 `src`。整合測試的埠號用 `0`（由系統分配）可避免與開發中的 8000 衝突。

## 完成檢核標準

- [ ] 我能用 `http://127.0.0.1:8000` 開啟頁面，並成功新增與列出任務。
- [ ] `api.py` 不含商業邏輯，所有任務規則都來自 `core`。
- [ ] `POST /api/tasks` 對空標題回傳 400 與可讀錯誤訊息。
- [ ] `python -m unittest discover -s tests -v` 全部通過，且測試不殘留 `test_tasks.json`。
- [ ] 我把後端、前端、測試拆成獨立的提交，且每次提交前看過 `git diff`。
- [ ] 我的新對話上下文包含 `AGENTS.md` 與相關檔案的依賴鏈。

## 延伸閱讀

- [Python 官方文件：http.server](https://docs.python.org/3/library/http.server.html)
- [MDN：Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN：HTTP request methods](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)

## 下一單元

[進階路徑起點：規格驅動開發](./spec-driven-development.md)
