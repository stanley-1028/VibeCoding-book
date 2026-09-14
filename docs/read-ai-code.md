---
title: 讀懂 AI 產生的程式碼
slug: read-ai-code
level: beginner
tags: [最佳實踐, 工作流]
prerequisites: [spec-then-build]
estimated_minutes: 45
path: beginner
updated: 2026-09-14
maintainers: []
status: active
---

# 讀懂 AI 產生的程式碼

> 學會由上而下拆解 AI 給的程式：找出進入點、追蹤資料流向、辨識常見結構，並用執行結果驗證你的理解。

## 學習目標

完成本單元後，你能夠：

1. 指出一支 Python 程式的進入點、主要函式與資料流向。
2. 逐行說明常見語法（條件、迴圈、函式、字典）在該程式中的用途。
3. 用插入 `print` 或 `assert` 的方式，驗證自己對程式行為的理解。

## 前置知識

- 先完成 [從需求到專案：先規格後動手](./spec-then-build.md)。
- 你能讀懂變數、`if`、`for`、函式的基本概念。
- 你能在終端機執行 `.py` 檔。

## 為什麼重要

Vibe Coding 最危險的失誤，是「能跑但我不懂」，於是不敢改、不敢用在重要場合。讀程式碼不是要你變成專家，而是建立最小信任：知道資料從哪進來、經過哪些步驟、到哪出去。一旦你能回答這三題，就能判斷 AI 的修改是否安全。

## 核心內容

### 讀程式碼的順序

不要從第一行開始逐字讀到最後。用這個順序：

1. **找進入點**：從哪裡開始執行？通常是檔案底部的 `if __name__ == "__main__":` 或直接被呼叫的函式。
2. **看資料流**：輸入是什麼？經過哪些函式？輸出在哪裡？
3. **抓主要結構**：有幾個函式？各自負責什麼？用一句話為每個函式命名。
4. **才讀細節**：逐行確認變數與條件。

### 實例：逐層拆解

以下是一支 AI 產生的程式，功能是從一段訂單資料算出總金額並套用折扣：

```python
# orders.py
def parse_order(line):
    parts = line.split(",")
    name = parts[0].strip()
    price = float(parts[1])
    qty = int(parts[2])
    return {"name": name, "price": price, "qty": qty}

def subtotal(order):
    return order["price"] * order["qty"]

def discount_rate(total):
    if total >= 1000:
        return 0.1
    if total >= 500:
        return 0.05
    return 0.0

def format_total(raw):
    return f"{raw:.2f}"

def main():
    lines = [
        "蘋果, 120, 3",
        "香蕉, 30, 10",
        "鉛筆, 15, 2",
    ]
    orders = [parse_order(line) for line in lines]
    total = sum(subtotal(o) for o in orders)
    rate = discount_rate(total)
    final = total * (1 - rate)
    print(f"小計：{format_total(total)}")
    print(f"折扣：{format_total(total * rate)}")
    print(f"應付：{format_total(final)}")

if __name__ == "__main__":
    main()
```

**第一層：進入點。** 底部 `if __name__ == "__main__":` 呼叫 `main()`。所以閱讀從 `main` 開始。

**第二層：資料流。**

```text
lines（字串清單）
  → parse_order（每行轉成字典）
  → subtotal（每筆算小計）
  → total（加總）
  → discount_rate（依總額決定折扣率）
  → final（總額 × (1 - 折扣率)）
  → print（三行輸出）
```

**第三層：函式職責。**

| 函式 | 一句話職責 |
|---|---|
| `parse_order` | 把一行 `名稱, 價格, 數量` 轉成字典 |
| `subtotal` | 單筆小計 = 價格 × 數量 |
| `discount_rate` | 依總額回傳 0 / 0.05 / 0.1 |
| `format_total` | 把數字格式化成兩位小數字串 |
| `main` | 串起流程並輸出 |

**第四層：細節。** 例如 `discount_rate` 用連續 `if` 而非 `elif`，因為每個分支都 `return`，效果相同。`f"{raw:.2f}"` 表示固定兩位小數。

執行與預期輸出：

```text
python orders.py
小計：690.00
折扣：34.50
應付：655.50
```

驗算：蘋果 360 + 香蕉 300 + 鉛筆 30 = 690；滿 500 折 5%，690 × 0.05 = 34.5，應付 655.5。**數字對得上，你才真的讀懂了。**

### 用 print 與 assert 驗證理解

讀不確定的地方，插入觀察點而不是用猜的：

```python
# inspect.py
from orders import parse_order, discount_rate

o = parse_order("蘋果, 120, 3")
print("parse 結果：", o)          # 預期 {'name': '蘋果', 'price': 120.0, 'qty': 3}

assert discount_rate(499) == 0.0
assert discount_rate(500) == 0.05
assert discount_rate(1000) == 0.1
print("折扣規則驗證通過。")
```

`assert` 在條件不成立時會直接拋出錯誤。用它把「我以為是這樣」變成「程式確認是這樣」。這是讀程式最快的方式：寫一小段檢查去應證你的假設。

### 遇到看不懂的語法

1. 先問 AI：「`line.split(",")` 這一行回傳什麼型別？用一個例子說明。」
2. 再看官方文件對應章節（見延伸閱讀）。
3. 最後用 `print(type(x), x)` 印出來親眼確認。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 從第一行硬讀到底 | 沒有主線，容易迷失 | 先找進入點與資料流，再讀細節 |
| 只看變數名稱猜行為 | 名稱可能誤導 | 用 `print` 或 `assert` 確認實際值 |
| 不懂就跳過 | 小誤解累積成大問題 | 針對該行問 AI，或用小範例實驗 |
| 假設輸出一定對 | 沒驗算 | 用具體數字手算一次比對 |
| 以為每個函式都必要 | 沒看整體 | 試著指出哪些是重複、可刪的 |

## 動手練

**練習**：請 AI 產生一支「讀取整數清單，回傳最大值、最小值與平均」的程式（只用標準函式庫）。拿到程式後，先不要執行，用本單元的四層順序寫下：進入點、資料流、每個函式的一句話職責。然後為每個函式各寫一個 `assert` 檢查，執行確認全部通過。最後，刻意修改一個 `assert` 讓它失敗，觀察錯誤訊息長什麼樣。

**提示**：平均若是小數，注意除法是否用了 `/`（浮點）或 `//`（整數）。若 AI 把邏輯全塞在 `main` 裡，可以請它「重構成三個小函式」再讀一遍，會更好懂。

## 完成檢核標準

- [ ] 我能對一支陌生程式說出它的進入點。
- [ ] 我能畫出（或用文字描述）它的資料流。
- [ ] 我能為每個函式寫一句話職責。
- [ ] 我為至少三個函式寫了通過的 `assert`。
- [ ] 我實際讓一個 `assert` 失敗，並讀懂錯誤訊息。

## 延伸閱讀

- [Python 官方教學：流程控制](https://docs.python.org/zh-tw/3/tutorial/controlflow.html)
- [Python 官方教學：資料結構](https://docs.python.org/zh-tw/3/tutorial/datastructures.html)
- [Python `assert` 語句說明](https://docs.python.org/zh-tw/3/reference/simple_stmts.html#the-assert-statement)

## 下一單元

[與 AI 協作除錯](./debug-with-ai.md)
