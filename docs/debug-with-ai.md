---
title: 與 AI 協作除錯
slug: debug-with-ai
level: beginner
tags: [除錯, 工作流, 測試]
prerequisites: [read-ai-code]
estimated_minutes: 45
path: beginner
updated: 2026-09-14
maintainers: []
status: active
---

# 與 AI 協作除錯

> 把「壞掉了」變成可重現的步驟、一行錯誤訊息、與最小範例，讓 AI 能精準指出原因並提出可驗證的修正。

## 學習目標

完成本單元後，你能夠：

1. 穩定重現一個錯誤，並取得完整的錯誤訊息（traceback）。
2. 從下往上讀 traceback，指出錯誤型別與發生行數。
3. 用「現象、重現步驟、完整錯誤、目前程式」四段式描述，讓 AI 提出最小修正並驗證。

## 前置知識

- 先完成 [讀懂 AI 產生的程式碼](./read-ai-code.md)。
- 你能閱讀函式、條件、迴圈與例外處理的基本語法。
- 你知道如何用 `print` 與 `assert` 觀察程式行為。

## 為什麼重要

除錯佔開發時間的一大半。真正拖慢你的不是錯誤本身，而是「說不清楚哪裡壞」。只要學會提供可重現的輸入與完整錯誤訊息，AI 往往一次就能定位問題。這個能力也讓你不再害怕紅字，因為你知道那只是線索，不是判決。

## 核心內容

### 四步驟除錯循環

```text
1. 重現：找到一組一定會出錯的輸入
2. 定位：讀 traceback，找出錯誤型別與行號
3. 修正：請 AI 提出最小修改，一次只改一處
4. 驗證：用同一組輸入重跑，確認修好且沒弄壞別的
```

沒有第一手的重現步驟，後面三步都只是猜。

### 讀 traceback：從下往上

假設執行時出現：

```text
Traceback (most recent call last):
  File "app.py", line 12, in <module>
    main()
  File "app.py", line 7, in main
    avg = total / count
ZeroDivisionError: division by zero
```

讀法：

1. **最底一行**是錯誤型別與訊息：`ZeroDivisionError: division by zero`（除以零）。
2. **往上找**最後一個在你的檔案裡的行：`app.py` 第 7 行 `avg = total / count`。
3. 那一行就是嫌疑犯；第 12 行只是呼叫它的地方。

最底一行給你「什麼錯」，最靠近你的那行給你「哪裡錯」。

### 四段式描述給 AI

把下列資訊一次給齊，AI 的命中率最高：

```text
現象：執行後直接中斷，沒有印出任何結果。
重現步驟：
  1. 執行 python app.py
  2. 直接按 Enter（不輸入任何數字）
完整錯誤：
  <貼上整段 traceback>
目前程式：
  <貼上 app.py 全文或相關函式>
```

**不要**只說「壞了」「跑不動」。AI 看不到你的螢幕，你提供的資訊就是它的眼睛。

### 實例：修一個真實的錯誤

有問題的程式：

```python
# app.py（有錯版本）
def average(numbers):
    total = sum(numbers)
    count = len(numbers)
    return total / count

def main():
    raw = input("輸入數字，以逗號分隔：")
    numbers = [float(x) for x in raw.split(",")]
    print("平均：", average(numbers))

if __name__ == "__main__":
    main()
```

輸入空字串（直接按 Enter）會得到 `ZeroDivisionError`，因為 `numbers` 是空清單。

對 AI 的請求可以這樣寫：

> 現象：直接按 Enter 後程式中斷。
> 重現：上面輸入的地方不輸入任何字元。
> 錯誤：`ZeroDivisionError: division by zero`，發生在 `average` 的 `return total / count`。
> 請提出最小修改，讓空輸入時印出「沒有數字」而不是崩潰，其餘行為不變。

修正後：

```python
# app.py（修正版本）
def average(numbers):
    if not numbers:
        return None
    total = sum(numbers)
    count = len(numbers)
    return total / count

def main():
    raw = input("輸入數字，以逗號分隔：")
    numbers = [float(x) for x in raw.split(",") if x.strip()]
    result = average(numbers)
    if result is None:
        print("沒有數字")
    else:
        print("平均：", result)

if __name__ == "__main__":
    main()
```

注意修正不只一處：`average` 擋掉空清單，`main` 也過濾空白輸入並處理 `None`。這正是要請 AI「說明改了哪些地方、為什麼」，而不是默默接受。

### 常見的 Python 錯誤

| 錯誤訊息 | 白話意思 | 常見原因 |
|---|---|---|
| `NameError: name 'x' is not defined` | 用了不存在的變數 | 拼錯名稱、忘了賦值 |
| `TypeError: can only concatenate str ...` | 型別不合 | 字串接數字沒轉型 |
| `IndexError: list index out of range` | 索引超出範圍 | 存取不存在的元素 |
| `KeyError: 'name'` | 字典沒有這個鍵 | 鍵名拼錯或資料缺欄 |
| `IndentationError` | 縮排錯誤 | 混用 Tab 與空白 |
| `ModuleNotFoundError` | 找不到模組 | 套件沒安裝或名稱錯 |
| `ZeroDivisionError` | 除以零 | 分母為 0 或空集合 |

### 驗證與防止復發

修好後，把出錯的輸入存成一個小測試，之後每次改動都重跑：

```python
# test_app.py
from app import average

assert average([]) is None
assert average([1, 2, 3]) == 2.0
print("測試通過。")
```

先修好，再留下一個能重跑的檢查，同一個錯就不會再犯。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 只貼「壞了」 | AI 無法取得線索 | 附現象、重現、完整錯誤、程式 |
| 只貼錯誤最後一行 | 少了發生位置 | 貼完整 traceback（含檔名行號） |
| 一次請 AI 全改 | 不知道哪個修正生效 | 一次只改一處，改完立刻驗證 |
| 修好卻沒重跑 | 可能改了別的 | 用同一組輸入重跑，再跑其他正常案例 |
| 刪掉錯誤訊息重試 | 失去線索 | 保留原文，複製貼上 |

## 動手練

**練習**：寫一支程式 `total.py`，讀取使用者以逗號分隔的數字並印出總和。先用錯誤的方式實作（例如把輸入直接當數字相加），執行到它出現 `TypeError`。記錄完整 traceback，依四段式描述寫成一段文字。接著請 AI 提出最小修正，套用後重跑確認，最後為空輸入與非數字輸入各寫一個 `assert` 測試。

**提示**：重現時把輸入固定下來（例如都用 `1,2,x`），排除隨機因素。若 AI 一次改了很多，請它「只保留必要修改，列出每一處的原因」。

## 完成檢核標準

- [ ] 我能提供一段包含現象、重現、錯誤、程式的描述。
- [ ] 我能從 traceback 說出錯誤型別與出錯行號。
- [ ] 我讓一個錯誤穩定重現，並在修正後用同一輸入驗證通過。
- [ ] 我為修正後的程式留下至少兩個 `assert` 測試。
- [ ] 我能解釋常見錯誤表中至少三種的成因。

## 延伸閱讀

- [Python 官方教學：錯誤與例外](https://docs.python.org/zh-tw/3/tutorial/errors.html)
- [Python 內建例外清單](https://docs.python.org/zh-tw/3/library/exceptions.html)

## 下一單元

[迭代與修改：讓雛形變好用](./iterate-and-refine.md)
