---
title: 專案結構與模組化
slug: project-structure
level: intermediate
tags: [架構, 最佳實踐, 工作流]
prerequisites: ["git-with-ai"]
estimated_minutes: 55
path: intermediate
updated: 2026-09-14
maintainers: []
status: active
---

# 專案結構與模組化

> 用清楚的目錄與模組邊界，讓 AI 每次只改一小塊，你也能一眼看出程式碼該放哪裡。

## 學習目標

完成本單元後，你能夠：

1. 為中小型專案規劃可預期的目錄結構（進入點、核心邏輯、資料存取分離）。
2. 依「單一職責」把一個大檔案拆成數個模組，並消除循環匯入。
3. 用 `if __name__ == "__main__"` 讓模組既能被匯入也能被執行。
4. 在提示中明確指定「把程式碼加到哪個檔案」，降低 AI 亂塞檔案的情況。
5. 用一個自動化檢查（匯入測試）確認模組邊界沒有被破壞。

## 前置知識

- [用 Git 與 AI 安全地協作](./git-with-ai.md)
- 你會用 `python` 執行單一 `.py` 檔，並知道 `import` 的基本用法。

## 為什麼重要

當專案只有一個檔案時，AI 很容易掌握全貌；檔案一多，它就會把新函式塞進「看起來相關」的地方，於是一個 800 行的 `utils.py` 逐漸出現，任何改動都可能牽動無關功能。清楚的結構是給 AI 的地圖：它知道邏輯住哪裡、資料存取住哪裡、進入點在哪裡。對你而言，結構讓 code review 有明確期待——改動「應該」只影響一個模組；若 diff 跨越三個模組，就是需要追問的訊號。

## 核心內容

### 小節一：一個夠用的目錄結構

以下是本單元與後續單元共用的結構，重點是**分層**而非照抄名稱：

```text
tasklite/
├── src/
│   └── tasklite/
│       ├── __init__.py
│       ├── cli.py         # 進入點：解析參數、呼叫 core
│       ├── core.py        # 核心邏輯：不碰檔案、不碰網路
│       └── storage.py     # 資料存取：讀寫 JSON 檔
├── tests/
│   └── test_core.py
└── README.md
```

三條規則：

1. **進入點薄**：`cli.py` 只負責解析輸入與輸出，不放商業邏輯。
2. **核心純粹**：`core.py` 的函式只吃參數、回傳結果，方便測試。
3. **I/O 靠邊**：檔案、網路、時間這類副作用集中到 `storage.py` 等模組。

### 小節二：單一職責與純函式

純函式（相同輸入必得相同輸出、無副作用）是最好測試、也最容易讓 AI 改對的單位。把計算與 I/O 分開：

```python
# src/tasklite/core.py
def add_task(tasks, title):
    title = title.strip()
    if not title:
        raise ValueError("標題不可為空")
    next_id = max((t["id"] for t in tasks), default=0) + 1
    return tasks + [{"id": next_id, "title": title, "done": False}]


def complete_task(tasks, task_id):
    found = False
    result = []
    for t in tasks:
        if t["id"] == task_id:
            found = True
            result.append({**t, "done": True})
        else:
            result.append(t)
    if not found:
        raise KeyError(f"找不到任務 {task_id}")
    return result
```

`core.py` 不知道資料存在哪裡，因此測試時只要傳入串列即可，不需要真的開檔案。

### 小節三：把 I/O 關進 storage 模組

```python
# src/tasklite/storage.py
import json
from pathlib import Path


def load(path):
    p = Path(path)
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding="utf-8"))


def save(path, tasks):
    Path(path).write_text(
        json.dumps(tasks, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
```

`storage.py` 只做資料進出，不含任何判斷「任務該不該完成」的邏輯。

### 小節四：讓模組可匯入也可執行

`cli.py` 是薄薄一層。`if __name__ == "__main__"` 確保只有直接執行時才跑 CLI，被 `import` 時不會觸發副作用：

```python
# src/tasklite/cli.py
import argparse
import sys

from tasklite import core, storage


def main(argv=None):
    parser = argparse.ArgumentParser(prog="tasklite")
    parser.add_argument("--file", default="tasks.json")
    sub = parser.add_subparsers(dest="command", required=True)
    p_add = sub.add_parser("add")
    p_add.add_argument("title")
    sub.add_parser("list")
    args = parser.parse_args(argv)

    tasks = storage.load(args.file)
    if args.command == "add":
        tasks = core.add_task(tasks, args.title)
        storage.save(args.file, tasks)
    elif args.command == "list":
        for t in tasks:
            mark = "x" if t["done"] else " "
            print(f"[{mark}] {t['id']}. {t['title']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

以 `python -m tasklite.cli add "寫單元二"` 執行（需先 `pip install -e .`，或在 `src` 目錄下設定 `PYTHONPATH`，見下方練習）。

### 小節五：用提示指定落點

不指定落點，AI 會自己猜。把位置寫進提示：

```text
需求：新增「刪除任務」功能。
限制：
- 邏輯加在 src/tasklite/core.py 的 delete_task(tasks, task_id)，維持純函式。
- CLI 只加一個 delete 子命令，呼叫 delete_task，不要在此寫邏輯。
- 不要新增檔案。改完列出你動過的檔案與原因。
```

最後一句「列出你動過的檔案」讓你一眼比對 `git status`，這是結構能發揮守門作用的地方。

### 小節六：用匯入測試守住邊界

結構一旦定了，用一個小測試確認它沒被破壞。純用標準函式庫即可：

```python
# tests/test_structure.py
import importlib
import unittest


class TestModulesImport(unittest.TestCase):
    def test_core_imports_without_side_effects(self):
        # core 不應在匯入時就讀寫檔案或網路
        mod = importlib.import_module("tasklite.core")
        self.assertTrue(hasattr(mod, "add_task"))

    def test_storage_and_core_are_separate(self):
        core = importlib.import_module("tasklite.core")
        self.assertFalse(
            any(name in dir(core) for name in ("open", "json")),
            "core 不應依賴檔案或 json 模組",
        )
```

執行方式與預期輸出：

```console
$ python -m unittest discover -s tests -v
test_core_imports_without_side_effects (test_structure.TestModulesImport) ... ok
test_storage_and_core_are_separate (test_structure.TestModulesImport) ... ok
----------------------------------------------------------------------
Ran 2 tests in 0.00s

OK
```

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 所有東西塞進 `utils.py` | 沒有職責分類 | 依「核心／I/O／進入點」拆成不同模組 |
| `core.py` 直接 `open()` 檔案 | 邏輯與 I/O 混在一起 | 把檔案存取移到 `storage.py` |
| 循環匯入（A import B，B import A） | 邊界不清、互相依賴 | 抽出共用型別或底層模組，改為單向依賴 |
| 匯入模組就執行主程式 | 缺 `if __name__ == "__main__"` | 把主流程包進 `main()` 並用 guard 呼叫 |
| 提示沒指定檔案，AI 到處建新檔 | 缺少落點資訊 | 明確說「加在哪個檔案的哪個函式、不要新增檔案」 |
| 測試直接讀真實檔案 | 測試與 I/O 糾纏 | 測 `core` 時只傳記憶體資料，I/O 另測 |

## 動手練

**練習**：把一個「全部寫在同一檔」的腳本重構成三層結構，並讓測試通過。

1. 建立 `tasklite/`，依「小節一」建立 `src/tasklite/`、`tests/`。
2. 把「小節二、三、四」的程式碼放進對應檔案。
3. 在 `src` 目錄下設定匯入路徑並實際執行（PowerShell）：

```console
$ $env:PYTHONPATH = "src"
$ python -m tasklite.cli add "第一件事"
$ python -m tasklite.cli list
[ ] 1. 第一件事
```

4. 撰寫 `tests/test_core.py`，測試 `add_task` 與 `complete_task`（含「標題為空」與「找不到 id」兩個錯誤情境）。
5. 執行 `python -m unittest discover -s tests -v`，全部通過。
6. 請 AI 新增 `delete_task`，並依「小節五」的提示限制落點；用 `git diff` 確認只動了預期檔案。

**提示**：若 `python -m tasklite.cli` 出現 `ModuleNotFoundError`，代表 `PYTHONPATH` 沒設好；在 `src` 的上一層執行、或把 `PYTHONPATH` 指向 `src` 的絕對路徑。重構時一次只搬一個函式，每搬完就跑一次測試。

## 完成檢核標準

- [ ] 我的專案有清楚分離的進入點、核心邏輯與 I/O 模組。
- [ ] `core.py` 的函式是純函式，測試時不需要真實檔案。
- [ ] 每個模組都能單獨 `import`，且匯入時不會執行主流程。
- [ ] 我能在提示中指定程式碼落點，並要求 AI 回報動過的檔案。
- [ ] `python -m unittest discover -s tests -v` 全部通過。
- [ ] `git status` 顯示 AI 的改動只落在預期檔案。

## 延伸閱讀

- [Python 官方教學：Modules](https://docs.python.org/3/tutorial/modules.html)
- [Python 官方教學：Packages](https://docs.python.org/3/tutorial/modules.html#packages)
- [Real Python：Python Application Layouts](https://realpython.com/python-application-layouts/)

## 下一單元

[讓 AI 幫你寫測試](./test-with-ai.md)
