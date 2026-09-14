---
title: 迭代與修改：讓雛形變好用
slug: iterate-and-refine
level: beginner
tags: [工作流, 實作專案, 最佳實踐]
prerequisites: [debug-with-ai]
estimated_minutes: 45
path: beginner
updated: 2026-09-14
maintainers: []
status: active
---

# 迭代與修改：讓雛形變好用

> 用「一次只改一件事、每次改完都能跑」的節奏，把能動的雛形逐步變成順手、可靠、看得懂的工具。

## 學習目標

完成本單元後，你能夠：

1. 把一個「能跑但不順」的程式，拆成有優先順序的改善清單。
2. 每次只做一項修改，並在修改後立刻重跑驗證。
3. 在不破壞既有行為的前提下，重構與補上使用者體驗細節。

## 前置知識

- 先完成 [與 AI 協作除錯](./debug-with-ai.md)。
- 你能重現、定位、修正錯誤並留下測試。
- 你已有一個能執行的小程式（任何主題皆可）。

## 為什麼重要

初版程式通常「能跑但難用」：訊息生硬、錯誤就崩潰、功能少。真正的價值在第二輪到第五輪之間。迭代不是一直加功能，而是有紀律地改善：先讓它穩定，再讓它好用，最後才讓它變強。守住「每次都能跑」的原則，你就不會改到一半卡死、失去一個原本可用的版本。

## 核心內容

### 迭代的三個階段

| 階段 | 目標 | 典型工作 |
|---|---|---|
| 穩定 | 不崩潰 | 處理錯誤輸入、邊界條件 |
| 好用 | 順手 | 訊息清楚、參數彈性、預設值合理 |
| 變強 | 功能多 | 新增選項、輸出檔案、更快 |

一次只推進一個階段。功能還沒穩定就先加新功能，錯誤會互相掩蓋。

### 建立改善清單

拿你的雛形跑三種情境，把觀察到的問題寫下來，並標上優先序（1 最高）：

```text
改善清單（依優先序）
1. [穩定] 輸入非數字時直接崩潰 → 應顯示友善訊息
2. [穩定] 檔案不存在時 traceback 很嚇人 → 應顯示簡短提示
3. [好用] 只能處理單一檔案 → 支援多個檔案參數
4. [好用] 輸出沒有排序 → 加上 -s 參數由大到小
5. [變強] 支援 CSV 輸出 → 之後再做
```

### 一次改一件事

以「輸入非數字時崩潰」為例，只做這一項：

**修改前**：

```python
# sum_tool.py（雛形）
import sys

nums = [float(x) for x in sys.argv[1:]]
print("總和：", sum(nums))
```

執行 `python sum_tool.py 1 2 x` 會中斷。

**修改後**（只加輸入驗證）：

```python
# sum_tool.py（穩定階段）
import sys

values = []
for token in sys.argv[1:]:
    try:
        values.append(float(token))
    except ValueError:
        print(f"忽略非數字：{token}")

print("總和：", sum(values))
```

執行與預期輸出：

```text
python sum_tool.py 1 2 x
忽略非數字：x
總和： 3.0
```

改完立刻重跑。不要同時又加排序、又加檔案讀取，否則出錯時你不知道是哪個改動造成。

### 重構：在不改行為下讓程式更好懂

「好用」不只看輸出，也看程式本身。常見重構：

- 把重複的程式段落收成一個函式。
- 用 `argparse` 取代手動解析 `sys.argv`。
- 為函式與變數取能讀出意圖的名稱。

```python
# sum_tool.py（好用階段，改用 argparse）
import argparse

def parse_numbers(tokens):
    values = []
    for token in tokens:
        try:
            values.append(float(token))
        except ValueError:
            print(f"忽略非數字：{token}")
    return values

def main():
    parser = argparse.ArgumentParser(description="計算數字的總和")
    parser.add_argument("numbers", nargs="*", help="要相加的數字")
    args = parser.parse_args()
    print("總和：", sum(parse_numbers(args.numbers)))

if __name__ == "__main__":
    main()
```

`argparse` 是標準函式庫，會自動產生 `-h` 說明：

```text
python sum_tool.py -h
usage: sum_tool.py [-h] [numbers ...]

計算數字的總和

positional arguments:
  numbers     要相加的數字

options:
  -h, --help  show this help message and exit
```

**重構的驗收方式**：重構前後對同一組輸入的輸出必須完全相同。先跑一次記下結果，重構後再跑一次比對。

### 用清單驅動 AI

每次請 AI 修改時，附上「只做清單第 N 項」與「不要改動其他行為」：

> 目前程式如下：<貼上全文>
> 請只完成改善清單第 4 項：加上 `-s` 參數，讓輸出依數字由大到小排序。
> 限制：不加其他參數，不動輸入解析邏輯，輸出格式維持「總和： X」。
> 完成後請列出你改了哪幾行以及為什麼。

這樣 AI 的修改範圍被框住，你也知道要驗證什麼。

### 留一份版本紀錄

最簡單的做法是在專案資料夾存一個 `CHANGELOG.md`：

```text
# 變更紀錄

## 2026-09-14
- 加上非數字輸入的友善提示
- 改用 argparse，支援 -h
- 新增 -s 由大到小排序
```

沒有版控工具時，這份檔案就是你的記憶：知道每個版本做了什麼、哪些還沒做。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 一次改五件事 | 出錯無法歸因 | 一次一項，改完立即驗證 |
| 重構同時改行為 | 分不清是重構還是功能變更 | 重構與功能變更分開兩次做 |
| 還沒穩定就加功能 | 錯誤互相掩蓋 | 先穩定、再好用、後變強 |
| 沒有比較重構前後輸出 | 可能偷偷改了行為 | 固定輸入，前後輸出要一致 |
| 改壞了沒有可退回的版本 | 沒有備份或紀錄 | 存檔備份或使用版本控制 |

## 動手練

**練習**：拿你在前面單元做過的任一支程式，實際跑三種情境（正常輸入、空輸入、錯誤輸入），寫出一份至少五項的改善清單並標上階段與優先序。依序完成前兩項，每完成一項就重跑驗證並更新 `CHANGELOG.md`。其中一項必須是重構（例如導入 `argparse` 或抽出函式），並證明重構前後對相同輸入的輸出完全一致。

**提示**：若不知道要改善什麼，就把程式拿給一位朋友用，觀察他哪裡卡住。錯誤訊息越白話越好；`argparse` 的 `help` 參數直接寫給人類看。

## 完成檢核標準

- [ ] 我寫出一份含階段與優先序的改善清單。
- [ ] 我依序完成至少兩項改善，且每次都重新執行驗證。
- [ ] 我完成至少一項重構，並證明行為未改變。
- [ ] 我的 `CHANGELOG.md` 記錄了每次改動。
- [ ] 我能說明為什麼先穩定、後好用、再變強。

## 延伸閱讀

- [Python `argparse` 官方文件](https://docs.python.org/zh-tw/3/library/argparse.html)
- [Martin Fowler：重構是什麼（英文）](https://martinfowler.com/bliki/DefinitionOfRefactoring.html)

## 下一單元

[入門實戰：做出一個可用的文字工具](./first-project.md)
