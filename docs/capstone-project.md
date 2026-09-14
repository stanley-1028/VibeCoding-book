---
title: 畢業專案：從需求到上線
slug: capstone-project
level: advanced
tags: [實作專案, 部署, 架構, 工作流]
prerequisites: [evaluation-and-observability]
estimated_minutes: 120
path: advanced
updated: 2026-09-14
maintainers: []
status: active
---

# 畢業專案：從需求到上線

> 把前四個單元串成一條線：寫規格、拆工作流、過品質關、設評測，最後把一個可觀測的服務部署上線。

## 學習目標

完成本單元後，你能夠：

1. 從一份規格出發，規劃可交付的里程碑，並界定專案的非目標。
2. 用 Python 標準函式庫實作具備 `/healthz`、`/metrics`、業務端點與結構化日誌的 JSON API。
3. 撰寫整合煙霧測試（smoke test），並用 CI 依序執行語法檢查、靜態掃描、測試、評測與煙霧測試。
4. 選擇部署方式（`venv` 直跑或容器），並說明上線前必須確認的檢核項目。

## 前置知識

- [規格驅動開發](./spec-driven-development.md)：專案從 `SPEC` 開始。
- [多代理與自動化工作流](./multi-agent-workflows.md)：把實作拆成有產物的階段。
- [品質、安全與效能](./code-quality-security.md)：品質關卡與靜態掃描。
- [評測與可觀測性](./evaluation-and-observability.md)：評測腳本與結構化日誌。

## 為什麼重要

前四個單元各自是一塊拼圖，真實工作是把他們拼起來：需求會變、程式要過關、上線要看得見。畢業專案選一個**小而完整**的題目——垃圾訊息分類 API——讓你在一次作業中走完「需求 → 設計 → 實作 → 測試 → 評測 → 部署 → 觀測」的完整迴圈。做完這一輪，你就能把同樣的流程套到任何規模的專案上。

## 核心內容

### 專案題目與範圍

做一個垃圾訊息分類 HTTP API，提供三個端點：

| 端點 | 方法 | 輸入 | 輸出 |
|---|---|---|---|
| `/healthz` | GET | 無 | `{"status": "ok"}`，存活探測 |
| `/metrics` | GET | 無 | `{"requests": N, "predictions": M}` |
| `/predict` | GET | 查詢參數 `text` | `{"text": ..., "label": "spam"｜"ham"}` |

**範圍**：規則式分類、輸入驗證、結構化日誌、煙霧測試、評測腳本、可部署。

**非目標**：不做使用者認證、不接資料庫、不做前端、不訓機器學習模型、不處理多程序部署。這些是刻意的取捨，寫下來才不會愈做愈大。

### 里程碑

| 里程碑 | 產出 | 完成定義 |
|---|---|---|
| M0 規格 | `SPEC.md`（含非目標與驗收標準） | 每條 AC 可觀察 |
| M1 骨架 | `app.py` 可啟動，`/healthz` 回 200 | `python app.py` 跑得起來 |
| M2 功能 | `/predict` 與 `/metrics` 正確 | 手動請求有正確 JSON |
| M3 品質 | 靜態掃描無發現、單元測試通過 | CI 綠燈 |
| M4 評測 | `golden.jsonl` 與 `eval_harness.py` 有指標 | 指標寫入 `baseline.json` |
| M5 上線 | 日誌、煙霧測試、部署設定 | 在目標環境可存取 |

先完成 M0 再寫程式。每個里程碑都要有可驗收的產物。

### 範例：可執行的 API 服務

以下只使用標準函式庫。`classifier.py`（沿用評測單元）：

```python
KEYWORDS = ("free", "winner", "click", "prize")


def predict(text: str) -> str:
    return "spam" if any(k in text.lower() for k in KEYWORDS) else "ham"
```

`app.py`：

```python
import json
import logging
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from classifier import predict

logging.basicConfig(level=logging.INFO, format='{"level": "%(levelname)s", "msg": "%(message)s"}')
logger = logging.getLogger("api")
METRICS = {"requests": 0, "predictions": 0}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        request_id, start = uuid.uuid4().hex[:8], time.perf_counter()
        METRICS["requests"] += 1
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/healthz":
                self._send(200, {"status": "ok"})
            elif parsed.path == "/metrics":
                self._send(200, dict(METRICS))
            elif parsed.path == "/predict":
                text = parse_qs(parsed.query).get("text", [""])[0]
                if not text:
                    self._send(400, {"error": "text is required"})
                else:
                    METRICS["predictions"] += 1
                    self._send(200, {"text": text, "label": predict(text)})
            else:
                self._send(404, {"error": "not found"})
        finally:
            ms = (time.perf_counter() - start) * 1000
            logger.info("request_id=%s path=%s duration_ms=%.3f", request_id, parsed.path, ms)


def main(port: int = 8000) -> None:
    logger.info("listening on http://127.0.0.1:%d", port)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
```

啟動 `python app.py` 後，可用 `python -c "import urllib.request as u; print(u.urlopen('http://127.0.0.1:8000/predict?text=win%20a%20free%20prize').read().decode())"` 手動驗證，預期得到 `{"text": "win a free prize", "label": "spam"}`。

### 整合煙霧測試

煙霧測試在行程內啟動真正的伺服器後打真實 HTTP，確認端點能串起來。

`smoke_test.py`：

```python
import json
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

from app import Handler

server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_address[1]}"


def get(path):
    with urllib.request.urlopen(base + path) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


assert get("/healthz") == (200, {"status": "ok"})
assert get("/predict?text=win%20a%20free%20prize")[1]["label"] == "spam"
assert get("/predict?text=lunch%20tomorrow")[1]["label"] == "ham"
try:
    get("/predict")
    raise AssertionError("空 text 應該回 400")
except urllib.error.HTTPError as exc:
    assert exc.code == 400

print("smoke tests passed")
server.shutdown()
```

執行方式與預期輸出：

```text
$ python smoke_test.py
smoke tests passed
```

（`port=0` 讓作業系統挑空閒埠，不與 8000 衝突。）

### 品質與評測關卡

把前面單元建立的檢查串成 CI。以下是 GitHub Actions 設定，`actions/checkout@v4` 與 `actions/setup-python@v5` 是官方 action 的主要版本標籤。

`.github/workflows/ci.yml`：

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: python -m compileall -q .
      - run: python risk_lint.py app.py classifier.py
      - run: python -m unittest discover -v
      - run: python eval_harness.py
      - run: python smoke_test.py
```

順序由便宜到昂貴；任何一步非零退出即整條失敗。

### 部署

**本機／單機（最快）**：用虛擬環境隔離依賴。

```text
$ python -m venv .venv
$ .venv\Scripts\activate        # Windows
$ source .venv/bin/activate     # Linux / macOS
$ python app.py
```

**容器（環境一致）**：以 `python:3.12-slim` 為基底。

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY app.py classifier.py ./
EXPOSE 8000
CMD ["python", "app.py"]
```

用 `docker build -t spam-api .` 建置、`docker run -p 8000:8000 spam-api` 執行。

> `app.py` 綁定 `127.0.0.1` 時容器外無法連線。容器或遠端部署需改綁 `0.0.0.0`，並在正式環境加上 TLS 與反向代理。綁本機是刻意的安全預設。Linux 上也可用 `systemd` 常駐行程；PaaS 平台設定各異，請依其文件操作。

### 上線前檢核

1. `/healthz` 回 200，且被平台的健康檢查指向。
2. 日誌可被收集，且不含個資或機密。
3. `/metrics` 的數字隨流量變動。
4. 評測基準已納入版控，回歸門檻生效。
5. 部署可重現：同一份程式碼與設定能還原出相同服務，已知限制寫在 `SPEC.md` 的非目標中。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 沒寫非目標就開工 | 範圍持續膨脹 | M0 先定非目標並凍結 |
| 直接綁 `0.0.0.0` 上公網 | 暴露風險、無 TLS | 用反向代理＋TLS，最小暴露 |
| 健康檢查指向業務端點 | 業務相依導致誤判 | 用獨立 `/healthz`，只回服務自身狀態 |
| 日誌沒有關聯 ID | 無法追蹤單一請求 | 每請求產生 ID 並寫入日誌 |
| 只做單元測試 | 端點接線錯誤沒被發現 | 加煙霧測試打真實 HTTP |
| 部署靠手動記憶 | 環境不可重現 | 用 `venv`＋腳本或容器定義環境 |

## 動手練

**練習**：完成畢業專案並通過 CI。

1. 撰寫 `SPEC.md`：包含三個端點、至少 6 條編號 AC、非目標清單。
2. 建立 `classifier.py`、`app.py`、`smoke_test.py`，讓 `python smoke_test.py` 輸出 `smoke tests passed`。
3. 新增 `test_classifier.py`：用 `unittest` 測 `predict`，至少涵蓋 spam、ham、空字串、大小寫混合。
4. 從評測單元帶入 `eval_harness.py` 與 `golden.jsonl`，執行後把指標存成 `baseline.json`。
5. 建立 `.github/workflows/ci.yml`，推上遠端並確認 CI 全綠。
6. 選一種部署方式實際跑起來，並貼出 `/healthz` 與 `/predict` 的真實回應。

**提示**：`smoke_test.py` 已在行程內啟動伺服器，不需先手動跑 `app.py`。若 CI 中 `risk_lint.py` 回報你的 `app.py` 有 `shell=True`，先檢查是否真的用了 shell；本範例沒有，若有發現請修正程式而非放寬規則。

## 完成檢核標準

- [ ] 我有一份包含非目標與編號驗收標準的 `SPEC.md`。
- [ ] `python smoke_test.py` 輸出 `smoke tests passed`。
- [ ] `python -m unittest discover -v` 全部通過。
- [ ] `python eval_harness.py` 能印出指標，且 `baseline.json` 已進版控。
- [ ] CI 依序執行語法檢查、靜態掃描、測試、評測與煙霧測試，且全綠。
- [ ] 我用至少一種方式把服務跑起來，並貼出 `/healthz` 與 `/predict` 的真實回應。
- [ ] 我能說明這個專案刻意的限制（非目標）與上線後的觀測方式。

## 延伸閱讀

- [Python 官方文件：`http.server`](https://docs.python.org/3/library/http.server.html)
- [Python 官方文件：`venv` — 建立虛擬環境](https://docs.python.org/3/library/venv.html)
- [Docker 官方文件：Python 映像檔](https://hub.docker.com/_/python)
- [GitHub Actions 官方文件](https://docs.github.com/en/actions)

## 下一單元

[回到書本首頁，挑一條新的學習路徑](../README.md)
