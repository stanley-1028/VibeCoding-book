---
title: 入門實戰：做出一個可用的文字工具
slug: first-project
level: beginner
tags: [實作專案, 工具鏈, 測試]
prerequisites: [iterate-and-refine]
estimated_minutes: 60
path: beginner
updated: 2026-09-14
maintainers: []
status: active
---

# 入門實戰：做出一個可用的文字工具

> 從規格到成品，親手完成一支命令列文字統計工具 `textstats`：能讀檔或讀標準輸入、輸出人可讀或 JSON 結果，並附上一組可重跑的測試。

## 學習目標

完成本單元後，你能夠：

1. 依規格實作一支含命令列參數的 Python 工具，並正確處理錯誤輸入。
2. 為自己的工具撰寫不依賴第三方套件的測試並執行通過。
3. 從終端機與標準輸入兩種方式使用該工具，並解讀 JSON 輸出。

## 前置知識

- 先完成 [迭代與修改：讓雛形變好用](./iterate-and-refine.md)。
- 你會用 `argparse` 接收命令列參數，並用 `assert` 寫測試。
- 你能讀懂 traceback 並自行除錯。

## 為什麼重要

前面七個單元學到的每一項，會在一個完整成品裡同時用上：寫規格、下提示詞、讀程式、除錯、迭代、驗證。做完這支工具，你就擁有一個真正裝在自己電腦上、隨時能用的作品，而不只是課堂練習。這也是之後所有進階專案的最小模板：讀輸入、處理、輸出、測試。

## 核心內容

### 規格

沿用上一課的一頁式規格，先寫清楚再動手：

```text
# 專案：textstats
功能：讀 UTF-8 檔或標準輸入（路徑 -），輸出 行數/單字數/字元數/平均每行字元，
      以及最常見前 N 個單字（預設 5）；--json 改以 JSON 輸出。
邊界：檔案不存在→錯誤訊息到 stderr、離開碼 1；空檔→計數為 0、不印排名。
驗收：讀檔與管線結果相同；不存在檔離開碼 1；--json 為合法 JSON。
不做：詞形還原、中文斷詞（連續中文視為一個詞）、一次處理多檔。
```

### 完整程式

```python
#!/usr/bin/env python3
"""textstats：文字檔統計工具。"""
import argparse
import json
import re
import sys
from collections import Counter

def read_text(path):
    if path == "-":
        return sys.stdin.read()
    with open(path, encoding="utf-8") as f:
        return f.read()

def word_tokens(text):
    return re.findall(r"\w+", text.lower())

def analyze(text, top_n=5):
    lines = text.splitlines()
    chars = len(text)
    words = word_tokens(text)
    counter = Counter(words)
    avg = chars / len(lines) if lines else 0.0
    return {
        "lines": len(lines),
        "words": len(words),
        "characters": chars,
        "avg_chars_per_line": round(avg, 1),
        "top": counter.most_common(top_n),
    }

def format_report(stats):
    out = [
        f"行數：{stats['lines']}",
        f"單字數：{stats['words']}",
        f"字元數：{stats['characters']}",
        f"平均每行字元：{stats['avg_chars_per_line']}",
    ]
    if stats["top"]:
        out.append("最常見單字：")
        for i, (word, count) in enumerate(stats["top"], start=1):
            out.append(f"{i}. {word} ({count})")
    return "\n".join(out)

def build_parser():
    parser = argparse.ArgumentParser(description="統計文字檔的行數、單字數與常用字")
    parser.add_argument("path", help="檔案路徑，使用 - 代表從標準輸入讀取")
    parser.add_argument("--top", type=int, default=5, help="顯示前 N 名單字（預設 5）")
    parser.add_argument("--json", action="store_true", help="以 JSON 格式輸出")
    return parser

def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        text = read_text(args.path)
    except FileNotFoundError:
        print(f"找不到檔案：{args.path}", file=sys.stderr)
        return 1
    stats = analyze(text, top_n=args.top)
    if args.json:
        print(json.dumps(stats, ensure_ascii=False, indent=2))
    else:
        print(format_report(stats))
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

`analyze` 把統計結果整理成字典，`format_report` 只負責排版，`main` 只負責參數與流程。這種「計算與呈現分離」的結構，讓測試可以直接呼叫 `analyze`，不必透過終端機。

### 準備測試資料

建立 `sample.txt`：

```text
the quick brown fox
jumps over the lazy dog
the end
```

在終端機執行：

```text
python textstats.py sample.txt
```

預期輸出：

```text
行數：3
單字數：11
字元數：51
平均每行字元：17.0
最常見單字：
1. the (3)
2. quick (1)
3. brown (1)
4. fox (1)
5. jumps (1)
```

### 從標準輸入與 JSON 輸出

`--json` 會改印 JSON；把檔案用管線餵進標準輸入（路徑用 `-`），兩者結果必須一致：

```text
python textstats.py sample.txt --json
Get-Content sample.txt | python textstats.py -     # Windows PowerShell
cat sample.txt | python textstats.py -             # macOS / Linux
```

JSON 預期輸出（節錄）：

```text
{"lines": 3, "words": 11, "characters": 51,
 "avg_chars_per_line": 17.0,
 "top": [["the", 3], ["quick", 1], ["brown", 1], ["fox", 1], ["jumps", 1]]}
```

### 測試

```python
# test_textstats.py
from textstats import analyze, word_tokens

assert word_tokens("Hello, world! HELLO") == ["hello", "world", "hello"]

stats = analyze("hello world\nhello", top_n=2)
assert stats["lines"] == 2
assert stats["words"] == 3
assert stats["characters"] == len("hello world\nhello")
assert stats["top"][0] == ("hello", 2)

empty = analyze("")
assert empty["lines"] == 0
assert empty["words"] == 0
assert empty["avg_chars_per_line"] == 0.0

print("全部測試通過。")
```

執行：

```text
python test_textstats.py
```

預期輸出：

```text
全部測試通過。
```

若某行 `assert` 失敗，Python 會指出出錯的那一行；把該行與輸入資料貼回 AI，請它解釋落差。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 讀檔沒指定編碼 | 不同系統預設編碼不同 | 一律 `open(..., encoding="utf-8")` |
| 忘記 `sys.exit(main())` | 離開碼永遠是 0 | 用 `sys.exit(main())` 傳回結果 |
| 錯誤訊息印到標準輸出 | 污染管線輸出 | 錯誤用 `file=sys.stderr` |
| JSON 出現亂碼 | 預設轉義非 ASCII | 用 `ensure_ascii=False` |
| 空檔除以零 | 行數為 0 | 先檢查 `if lines else 0.0` |
| 測試依賴硬碟檔 | 測試不穩、需先建檔 | 測試直接傳字串給 `analyze` |

## 動手練

**練習**：在 `textstats` 上新增一項功能：`--longest`，印出檔案中最長的一個單字（長度相同時取字典序最小者）。流程必須完整走一遍：

1. 更新規格，寫下輸出格式與邊界條件（空檔時應印什麼？）。
2. 只實作這一項，不改動其他行為。
3. 為它新增至少兩個 `assert`（含空輸入）。
4. 重跑 `python test_textstats.py` 與 `python textstats.py sample.txt --longest` 驗證。
5. 在 `CHANGELOG.md` 記下這次變更。

**提示**：最長單字可挑戰你對排序的理解：先取最長，長度相同再比字典序。用 `max(words, key=lambda w: (len(w), ...))` 之前，先想清楚「字典序最小」是 `min` 還是 `max`，並用測試確認，不要憑感覺。

## 完成檢核標準

- [ ] 我的 `textstats.py` 能讀檔並輸出四項統計與前 N 名單字。
- [ ] 我驗證了讀檔與標準輸入得到相同結果。
- [ ] 對不存在的檔案，離開碼為 1，且錯誤印在標準錯誤。
- [ ] `python textstats.py sample.txt --json` 輸出為合法 JSON。
- [ ] `python test_textstats.py` 顯示「全部測試通過。」。
- [ ] 我完成 `--longest`，並為它補上測試與變更紀錄。

## 延伸閱讀

- [Python `argparse` 官方文件](https://docs.python.org/zh-tw/3/library/argparse.html)
- [Python `json` 官方文件](https://docs.python.org/zh-tw/3/library/json.html)
- [Python `re` 官方文件](https://docs.python.org/zh-tw/3/library/re.html)
- [Python `collections.Counter` 官方文件](https://docs.python.org/zh-tw/3/library/collections.html#collections.Counter)

## 下一單元

[中階路徑起點：用 Git 與 AI 安全地協作](./git-with-ai.md)
