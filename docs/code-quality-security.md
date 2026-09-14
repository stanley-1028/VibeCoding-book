---
title: 品質、安全與效能
slug: code-quality-security
level: advanced
tags: [安全, 測試, 最佳實踐, 除錯]
prerequisites: [multi-agent-workflows]
estimated_minutes: 110
path: advanced
updated: 2026-09-14
maintainers: []
status: active
---

# 品質、安全與效能

> 讓 AI 產出的程式碼不只好看，而是可維護、不被利用、跑得夠快——而且每一步都能用標準函式庫驗證。

## 學習目標

完成本單元後，你能夠：

1. 建立格式化、靜態檢查、測試三層品質防線，並說明每層攔截什麼問題。
2. 用 Python 標準函式庫 `ast` 寫出一個掃描高風險樣式（`eval`、`shell=True`、硬編碼機密）的檢查工具。
3. 用參數化查詢與路徑正規化示範兩個常見弱點的修正方式。
4. 用 `timeit` 量測效能，並用資料結構或演算法把 O(n²) 換成 O(n)。

## 前置知識

- [多代理與自動化工作流](./multi-agent-workflows.md)：品質檢查通常是工作流中的一道關卡。
- Python 基礎：函式、例外、`str`／`list`／`set`／`dict`。
- 知道什麼是 SQL 資料庫與 HTTP 請求。

## 為什麼重要

AI 很擅長產生「在正常輸入下會動」的程式碼，但正常輸入不是全部。真實世界的失敗來自三處：**邊界輸入**（空值、超長字串、惡意字串）、**安全假設**（拼接 SQL、`eval` 使用者輸入、`shell=True`）、**規模成長**（十筆資料沒問題，十萬筆就卡死）。

品質工程的目的不是追求完美，而是**用自動化在早期攔截**。越早攔截越便宜：格式化在存檔時、靜態檢查在提交前、測試在合併前、效能與安全審查在部署前。本單元教你用不加外部依賴的方式建立這條防線。

## 核心內容

### 品質的三層防線

| 層級 | 工具類別 | 攔截什麼 | 本單元示範 |
|---|---|---|---|
| 第一層 | 格式化（formatter） | 排版爭議、無意義 diff | 統一縮排與引號 |
| 第二層 | 靜態檢查（linter） | 高風險 API、未用變數、可疑模式 | `ast` 自製掃描器 |
| 第三層 | 測試（tests） | 行為錯誤、回歸 | `unittest` |

這三層各自獨立：格式化不抓邏輯錯誤，linter 不保證行為正確，測試不抓風格。三者都要有，但不必一次到位，先建立最痛的一層。

Python 內建的 `compileall` 可以做最基本的語法檢查：

```text
$ python -m compileall -q .
```

沒有輸出代表所有檔案語法正確；有語法錯誤會列出檔名與行號。這是 CI 最便宜的第一步。

### 用 `ast` 做靜態檢查

`eval` 與 `exec` 會執行任意程式碼；`subprocess` 搭配 `shell=True` 會把輸入交給 shell，容易造成指令注入。與其靠人眼巡，不如寫一個小掃描器。以下只使用標準函式庫。

`risk_lint.py`：

```python
"""用 AST 掃描 Python 檔案中的高風險樣式。"""
import ast
import sys
from pathlib import Path

RISKY_NAMES = {"eval", "exec"}
RISKY_SUBPROCESS = {"run", "call", "check_call", "check_output", "Popen"}
SECRET_HINTS = ("password", "secret", "token", "api_key")


class RiskVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.findings: list[tuple[int, str]] = []

    def visit_Call(self, node: ast.Call) -> None:
        func = node.func
        if isinstance(func, ast.Name) and func.id in RISKY_NAMES:
            self.findings.append((node.lineno, f"呼叫高風險函式 {func.id}()"))
        if isinstance(func, ast.Attribute):
            base = func.value
            is_subproc = isinstance(base, ast.Name) and base.id == "subprocess" and func.attr in RISKY_SUBPROCESS
            uses_shell = any(
                kw.arg == "shell" and getattr(kw.value, "value", False) is True
                for kw in node.keywords
            )
            if is_subproc and uses_shell:
                self.findings.append((node.lineno, "subprocess 使用 shell=True"))
        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign) -> None:
        if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str) and node.value.value:
            for target in node.targets:
                if isinstance(target, ast.Name) and any(h in target.id.lower() for h in SECRET_HINTS):
                    self.findings.append((node.lineno, f"疑似硬編碼機密：{target.id}"))
        self.generic_visit(node)


def scan(path: Path) -> list[tuple[int, str]]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    visitor = RiskVisitor()
    visitor.visit(tree)
    return sorted(visitor.findings)


def main(argv: list[str]) -> int:
    total = 0
    for name in argv:
        for lineno, message in scan(Path(name)):
            print(f"{name}:{lineno}: {message}")
            total += 1
    return 1 if total else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
```

準備一個測試檔 `sample_risky.py`：

```python
password = "hunter2"
eval("2 + 2")
import subprocess
subprocess.run("ls -la", shell=True)
```

執行方式與預期輸出：

```text
$ python risk_lint.py sample_risky.py
sample_risky.py:1: 疑似硬編碼機密：password
sample_risky.py:2: 呼叫高風險函式 eval()
sample_risky.py:4: subprocess 使用 shell=True
```

退出碼為 `1`（有發現問題）。把這個工具放進 CI，就能在合併前擋下已知的高風險樣式。

> 若要更完整的規則，可安裝業界 linter，例如 `pip install ruff`（版本請以 PyPI 最新為準，本教材未鎖定版本）。用法：`ruff check .`。`ast` 版本仍是理解原理的最低成本起點。

### 安全：信任邊界與輸入驗證

安全的第一原則是認清**信任邊界（trust boundary）**：資料從哪裡進來？凡是從網路、使用者、檔案、環境變數進來的一律視為不可信。

**弱點一：SQL 注入。** 用字串拼接 SQL 會讓輸入改變查詢結構。正確做法是參數化查詢，讓驅動程式負責轉義。

```python
import sqlite3

con = sqlite3.connect(":memory:")
con.execute("CREATE TABLE users (name TEXT)")
con.execute("INSERT INTO users (name) VALUES (?)", ("alice",))

user_input = "' OR '1'='1"

# 錯誤示範（僅說明，勿使用）：
# con.execute(f"SELECT * FROM users WHERE name = '{user_input}'")

cur = con.execute("SELECT * FROM users WHERE name = ?", (user_input,))
print("rows:", cur.fetchall())  # 預期輸出：rows: []
```

拼接版本會回傳 `alice`（條件恆真），參數化版本回傳空清單，因為它把整串當成字面值比對。

**弱點二：路徑穿越（path traversal）。** 使用者提供檔名時，`../../etc/passwd` 可能跳出預期目錄。先正規化再檢查是否仍在基準目錄內：

```python
from pathlib import Path

BASE = Path("uploads").resolve()


def safe_path(name: str) -> Path:
    target = (BASE / name).resolve()
    if target != BASE and BASE not in target.parents:
        raise ValueError("path traversal blocked")
    return target


for candidate in ["report.txt", "../etc/passwd"]:
    try:
        print(candidate, "->", safe_path(candidate))
    except ValueError as exc:
        print(candidate, "->", exc)
```

預期輸出（`BASE` 的實際路徑依執行目錄而異）：

```text
report.txt -> C:\...\uploads\report.txt
../etc/passwd -> path traversal blocked
```

其他必守原則：機密只從環境變數或密鑰管理服務讀取，不寫進程式碼；錯誤訊息不要回傳內部路徑或堆疊給使用者；最小權限（資料庫帳號只給需要的權限）。

### 效能：先量測，再優化

不要憑感覺優化。用 `timeit` 量測，用資料結構改善演算法。以下範例比較「清單線性搜尋 O(n)」與「集合平均 O(1)」在同一批資料上的差距，只使用標準函式庫。

`bench.py`：

```python
import timeit

setup = """
data = list(range(10000))
target = 9999
lookup = set(data)
"""

list_time = timeit.timeit("target in data", setup=setup, number=1000)
set_time = timeit.timeit("target in lookup", setup=setup, number=1000)
print(f"list: {list_time:.4f}s")
print(f"set : {set_time:.4f}s")
print(f"ratio: {list_time / set_time:.1f}x")
```

執行方式與預期輸出（絕對秒數依機器而異，比例會差一到三個數量級）：

```text
$ python bench.py
list: 0.1234s
set : 0.0004s
ratio: 300.0x
```

結論：當「成員檢查」很頻繁時，把 `list` 換成 `set`。同理，字串反覆相加是 O(n²)，改用 `"".join(parts)` 是一次配置 O(n)。更慢的程式用 `cProfile` 找熱點：

```text
$ python -m cProfile -s cumulative your_script.py
```

依 `cumulative` 時間排序，前幾名就是你該動刀的地方。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 用 `eval` 解析使用者輸入 | 直接執行任意程式碼 | 用 `json.loads`、`ast.literal_eval` 或明確的解析器 |
| 拼接 SQL 字串 | 輸入改變查詢結構 | 參數化查詢（`?` 佔位符） |
| `subprocess` 使用 `shell=True` 加使用者輸入 | 指令注入 | 傳入參數清單，`shell=False`（預設） |
| 機密寫在程式碼或提交到 Git | 外洩且難輪替 | 從環境變數讀取，並輪替已外洩的密鑰 |
| 憑感覺優化 | 改錯地方、增加複雜度 | 先用 `timeit`／`cProfile` 量測 |
| 只在正常輸入測 | 邊界與惡意輸入沒被覆蓋 | 為空值、超長、惡意字串各寫測試 |
| 依賴不鎖版本 | 供應鏈風險、建置不可重現 | 鎖定版本並定期審計（`pip list --outdated`） |

## 動手練

**練習**：擴充 `risk_lint.py` 並用它掃描一段程式碼。

1. 新增規則：偵測 `os.system(...)`（`ast.Attribute` 且 `value` 是 `Name(id="os")`、`attr == "system"`）。
2. 新增規則：偵測 `pickle.loads(...)`，因為反序列化不可信資料可導致執行任意程式碼。
3. 寫一個 `sample.py`，內含至少 3 種被偵測到的樣式與 2 種**不該**被誤報的寫法（例如 `sum([1, 2])`、`json.loads(text)`）。
4. 執行 `python risk_lint.py sample.py`，確認只列出真正的高風險樣式。
5. 為規則寫 2 條 `unittest` 測試：一個輸入包含 `eval` 應有發現，一個乾淨輸入應為空清單。

**提示**：`pickle` 的偵測與 `subprocess` 同屬 `ast.Attribute` 分支，判斷 `base.id == "pickle" and func.attr == "loads"`。測試時用 `ast.parse` 解析字串，不必建立實體檔案，例如 `scan_source("eval('1')")`；你可以把 `scan` 拆出一個吃字串的版本，讓測試更好寫。

## 完成檢核標準

- [ ] 我能說出品質三層防線各自攔截什麼，並實際跑過 `python -m compileall -q .`。
- [ ] 我能執行 `risk_lint.py` 並正確解讀其輸出與退出碼。
- [ ] 我能用參數化查詢改寫一段有 SQL 注入風險的程式碼，並解釋為何有效。
- [ ] 我能用 `timeit` 量測兩段程式並用數據支持我的優化決定。
- [ ] 我的動手練增加了 `os.system` 與 `pickle.loads` 兩條規則，且有測試覆蓋。

## 延伸閱讀

- [Python 官方文件：`ast`](https://docs.python.org/3/library/ast.html)
- [Python 官方文件：`sqlite3` 與參數化查詢](https://docs.python.org/3/library/sqlite3.html)
- [Python 官方文件：`timeit`](https://docs.python.org/3/library/timeit.html)
- [OWASP Top 10（常見網路應用安全風險）](https://owasp.org/www-project-top-ten/)
- [Python 官方文件：`pickle` 的安全性警告](https://docs.python.org/3/library/pickle.html#warning)

## 下一單元

[評測與可觀測性](./evaluation-and-observability.md)
