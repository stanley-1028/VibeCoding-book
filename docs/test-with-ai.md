---
title: 讓 AI 幫你寫測試
slug: test-with-ai
level: intermediate
tags: [測試, 除錯, 工作流]
prerequisites: ["project-structure"]
estimated_minutes: 60
path: intermediate
updated: 2026-09-14
maintainers: []
status: active
---

# 讓 AI 幫你寫測試

> 用測試把 AI 的產出變成可驗證的承諾：先寫出會失敗的測試，再讓 AI 修到全綠。

## 學習目標

完成本單元後，你能夠：

1. 使用 Python 標準函式庫 `unittest` 撰寫 Arrange–Act–Assert 結構的測試。
2. 針對邊界條件（空輸入、型別錯誤、找不到項目）設計測試案例。
3. 用「先紅後綠」流程，讓 AI 依失敗訊息修正程式碼，而非盲目重寫。
4. 判斷 AI 給的測試是否為「空測試」（assert 恆真、沒有真的驗證行為）。
5. 解讀測試輸出，把失敗訊息轉成給 AI 的精確提示。

## 前置知識

- [專案結構與模組化](./project-structure.md)
- 你會用 `python -m unittest` 執行測試，並知道純函式與 I/O 的分離。

## 為什麼重要

測試是唯一能自動回答「AI 這次改動有沒有弄壞別的功能」的機制。AI 能快速生成測試，但它也會生成看起來通過、實際上什麼都沒驗證的測試——例如 `assertTrue(True)` 或只測 `is not None`。因此你的角色從「寫測試的人」變成「審查測試的人」：確認每個測試真的會在程式碼錯誤時失敗。紅燈（失敗）先行的流程尤其關鍵，因為它證明測試確實在檢查行為，而不是永遠說 OK。

## 核心內容

### 小節一：Arrange–Act–Assert

一個好的測試由三段組成：**準備（Arrange）→ 執行（Act）→ 驗證（Assert）**。以下測試 `add_task`：

```python
# tests/test_core.py
import unittest

from tasklite.core import add_task, complete_task


class TestAddTask(unittest.TestCase):
    def test_adds_with_incrementing_id(self):
        # Arrange
        tasks = []
        # Act
        result = add_task(tasks, "寫測試")
        # Assert
        self.assertEqual(result[0]["id"], 1)
        self.assertEqual(result[0]["title"], "寫測試")
        self.assertFalse(result[0]["done"])

    def test_trims_whitespace(self):
        result = add_task([], "  買牛奶  ")
        self.assertEqual(result[0]["title"], "買牛奶")

    def test_rejects_empty_title(self):
        with self.assertRaises(ValueError):
            add_task([], "   ")
```

執行與預期輸出：

```console
$ python -m unittest tests.test_core -v
test_adds_with_incrementing_id ... ok
test_rejects_empty_title ... ok
test_trims_whitespace ... ok
----------------------------------------------------------------------
Ran 3 tests in 0.00s

OK
```

### 小節二：先紅後綠

「先紅後綠」（Red–Green）是與 AI 合作最有效的測試流程：

1. **Red**：先寫（或請 AI 寫）測試，執行它，確認它**失敗**。
2. **Green**：把失敗訊息貼給 AI，請它只改到測試通過。
3. **Refactor**：測試全綠後，再請 AI 整理程式碼，並確保測試仍通過。

先看到紅燈很重要。若測試一開始就綠，可能是測試根本沒觸發到目標程式碼，或是 assert 寫得太鬆。例如故意把 `complete_task` 的 `found` 判斷拿掉，這個測試就應該失敗：

```python
def test_complete_unknown_id_raises(self):
    with self.assertRaises(KeyError):
        complete_task([{"id": 1, "title": "a", "done": False}], 99)
```

### 小節三：邊界條件清單

請 AI 補測試時，直接給它這份清單，比「幫我寫測試」有效得多：

- 空集合 / 空字串 / `None`
- 邊界值：第一項、最後一項、只有一項
- 重複值：同一 id 出現兩次
- 錯誤輸入：型別錯誤、找不到的 id
- 不可變性：函式是否意外修改了傳入的資料

```python
def test_complete_does_not_mutate_input(self):
    original = [{"id": 1, "title": "a", "done": False}]
    complete_task(original, 1)
    self.assertFalse(original[0]["done"], "不應改到傳入的串列")
```

### 小節四：辨識「空測試」

AI 有時會給出沒有價值的測試。逐項檢查：

| 可疑寫法 | 問題 | 修正 |
|---|---|---|
| `self.assertTrue(True)` | 恆真，永遠不會紅 | 改成比較具體回傳值 |
| `self.assertIsNotNone(result)` | 只證明有東西，不證明正確 | 斷言內容與欄位 |
| `self.assertEqual(result, result)` | 自我比較 | 與預期值比較 |
| 測試裡再呼叫一次被測函式當預期 | 同一個錯會一起錯 | 手寫固定預期值 |
| `try/except` 包住所有錯誤 | 把失敗吞掉 | 用 `assertRaises` 精準驗證 |

驗證方法：**刻意把被測函式改壞一次**，執行測試。如果測試仍然全綠，那個測試就是空的。

### 小節五：把失敗訊息變成提示

AI 需要的是失敗輸出，不是你的猜測。把完整 traceback 貼進去，並附上限制：

```text
執行 `python -m unittest tests.test_core -v` 得到以下失敗：

FAIL: test_complete_unknown_id_raises
KeyError: '找不到任務 99'

請修正 core.py 的 complete_task，讓找不到 id 時拋出 KeyError。
只改 complete_task，不要動測試，也不要放寬測試的預期。
```

「不要放寬測試的預期」這句能防止 AI 用「改測試」來假裝修好。修 bug 的正確方向永遠是改實作，不是改期望值。

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 測試永遠是綠的 | 沒看過紅燈，assert 太弱 | 先讓測試失敗一次，確認它有效 |
| AI 把失敗測試改成通過 | 修改了期望值 | 明確要求只改實作、不放寬測試 |
| 只測正常路徑 | 缺邊界案例 | 依「邊界條件清單」補測 |
| 測試相依於執行順序或真實檔案 | 有副作用、共用狀態 | 每個測試自己準備資料，測純函式 |
| 一個測試驗證十件事 | 失敗時不知哪裡壞 | 一個測試只驗一個行為 |
| 為了通過而 `skip` 測試 | 逃避問題 | 修好或標記原因與期限，不無聲跳過 |

## 動手練

**練習**：為 `tasklite.core` 補齊測試，並用紅燈證明測試有效。

1. 在 `tests/test_core.py` 撰寫 `delete_task` 的測試（若還沒有此函式，先請 AI 依單元二的結構加入）。至少涵蓋：
   - 刪除中間一項後，其餘順序不變且 id 不變。
   - 刪除不存在的 id 會拋出 `KeyError`。
   - 刪除時不修改傳入的原始串列。
2. 執行 `python -m unittest discover -s tests -v`，確認全綠。
3. **紅燈實驗**：把 `delete_task` 中「找不到就拋錯」的判斷暫時註解掉，重跑測試，確認至少一個測試變紅。
4. 把紅燈的 traceback 貼給 AI，請它只還原實作（不要改測試），再重跑一次確認全綠。
5. 審查 AI 產出的所有測試，用「小節四」的表找出任何可疑的弱斷言並修正。

**提示**：若 `delete_task` 回傳新串列，`assertFalse(original[0]["done"])` 這類「不可變性」測試才有意義；先問 AI「這個函式是回傳新串列還是就地修改？」再決定怎麼斷言。紅燈實驗後記得用 `git restore` 回到正確版本。

## 完成檢核標準

- [ ] 我的測試都符合 Arrange–Act–Assert 三段結構。
- [ ] 我至少有一個測試涵蓋「找不到項目會拋錯」的錯誤路徑。
- [ ] 我做過紅燈實驗：故意改壞實作時，對應測試確實失敗。
- [ ] 我能指出 AI 測試中的弱斷言，並改成具體比較。
- [ ] 我的提示包含完整失敗訊息，且要求 AI 只改實作。
- [ ] `python -m unittest discover -s tests -v` 全部通過，且沒有被跳過的測試。

## 延伸閱讀

- [Python 官方文件：unittest](https://docs.python.org/3/library/unittest.html)
- [Martin Fowler：Given-When-Then](https://martinfowler.com/bliki/GivenWhenThen.html)
- [Python Testing with unittest（官方 HOWTO）](https://docs.python.org/3/howto/testing.html)

## 下一單元

[串接 API 與處理資料](./api-and-data.md)
