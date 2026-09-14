---
title: 準備你的 AI 開發環境
slug: setup-ai-environment
level: beginner
tags: [入門, 工具鏈, 工作流]
prerequisites: [what-is-vibe-coding]
estimated_minutes: 45
path: beginner
updated: 2026-09-14
maintainers: []
status: active
---

# 準備你的 AI 開發環境

> 安裝 Python、編輯器與終端機，並確認你有一個能隨時啟動的 AI 對話工具，讓「描述 → 執行」的循環順暢運作。

## 學習目標

完成本單元後，你能夠：

1. 在自己的作業系統上安裝 Python 3，並用指令確認版本。
2. 建立一個專案資料夾，並在編輯器中開啟、儲存、執行 `.py` 檔。
3. 說明終端機、編輯器、AI 工具三者各自的角色，並完成一次端到端測試。

## 前置知識

- 先完成 [什麼是 Vibe Coding](./what-is-vibe-coding.md)。
- 你已經知道 Vibe Coding 是一個「描述、執行、觀察、修正」的循環。
- 你不需要先會寫程式。

## 為什麼重要

環境沒裝好，之後每個單元都會卡在同一件事：程式跑不起來。把安裝一次性做完，你才能把注意力放在「需求」與「結果」上。一個乾淨的環境也讓你敢於嘗試，因為你知道最壞的情況只是刪掉資料夾重來。

## 核心內容

### 三個角色

| 工具 | 角色 | 你在哪裡看到它 |
|---|---|---|
| 終端機（terminal） | 執行程式、安裝套件、看輸出與錯誤 | Windows 的 PowerShell、macOS 的 Terminal |
| 編輯器（editor） | 編輯與儲存程式檔 | VS Code、Cursor、Sublime Text 等 |
| AI 工具 | 依描述產生與修改程式碼 | 網頁聊天介面、編輯器內建 AI、終端機 AI |

入門階段，最省事的組合是：**VS Code 或 Cursor + 內建的整合終端機 + 該編輯器的 AI 助理**。這樣你不用在視窗之間切換。

### 安裝 Python 3

**Windows**

1. 到官方網站下載安裝檔：<https://www.python.org/downloads/>。
2. 執行安裝檔時，務必勾選 **Add python.exe to PATH**。
3. 安裝完成後，開啟 PowerShell，輸入：

```text
python --version
```

預期輸出（版本號可能不同，只要是 3.x 即可）：

```text
Python 3.12.4
```

若顯示 `python` 不是內部或外部命令，關掉終端機重開一次；仍失敗代表安裝時沒勾 PATH，請重新安裝。

**macOS**

macOS 內建的是 Python 2 或沒有 `python` 指令。建議用 Homebrew：

```text
brew install python
python3 --version
```

macOS 上請用 `python3` 這個指令名稱。

### 確認 pip 可用

`pip` 是 Python 的套件安裝工具，之後若要安裝第三方套件會用到：

```text
python -m pip --version
```

預期輸出類似 `pip 24.x from ... (python 3.12)`。用 `python -m pip` 而不是直接打 `pip`，可以確保你裝到的是對應那個 Python 的套件，避免多版本衝突。

### 建立專案資料夾

在終端機依序執行（Windows PowerShell 與 macOS 語法相同）：

```text
mkdir vibe-practice
cd vibe-practice
```

在編輯器中選「開啟資料夾」，指向 `vibe-practice`。建立新檔 `hello.py`，內容：

```python
# hello.py
name = input("你的名字：")
print(f"你好，{name}！環境設定完成。")
```

在編輯器的整合終端機執行：

```text
python hello.py
```

預期輸出：

```text
你的名字：小明
你好，小明！環境設定完成。
```

### 挑選 AI 工具

你需要一個能貼上錯誤訊息、讀取程式碼、並給出修改建議的工具。常見選項：

- **網頁版聊天介面**：完全不用安裝，適合入門。缺點是要手動複製貼上。
- **編輯器內建 AI**：能直接讀寫你打開的檔案，迭代最快。
- **終端機 AI**：在命令列直接問，適合小幅修改與指令查詢。

選擇原則：**先用你已經有的那個**。工具是手段，不是目的；等你感覺到明顯卡點，再換工具。

### 環境檢查腳本

把以下內容存成 `check_env.py`，一次確認你的環境基本功能：

```python
# check_env.py
import sys
import platform

print("Python 版本：", sys.version.split()[0])
print("作業系統：", platform.system(), platform.release())
print("可執行檔路徑：", sys.executable)
assert sys.version_info >= (3, 8), "需要 Python 3.8 以上"
print("環境檢查通過。")
```

執行：

```text
python check_env.py
```

預期輸出（路徑與版本依你的電腦而異）：

```text
Python 版本： 3.12.4
作業系統： Windows 11
可執行檔路徑： C:\Users\user\AppData\Local\Programs\Python\Python312\python.exe
環境檢查通過。
```

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| `python` 找不到 | Windows 安裝時沒勾 PATH | 重新安裝並勾選 Add to PATH，或重開終端機 |
| 裝了套件卻 `import` 失敗 | 用了不同版本的 Python | 用 `python -m pip install` 安裝，再 `python -c "import 套件名"` 驗證 |
| macOS 打了 `python` 沒反應 | 系統沒有該指令 | 改用 `python3` |
| 檔案存成 `hello.py.txt` | 編輯器自動加副檔名 | 存檔時選「所有檔案」或在設定關閉自動副檔名 |
| 在錯的資料夾執行 | 終端機路徑不是專案位置 | 先 `cd` 到專案資料夾，再用 `dir`（Windows）或 `ls` 確認檔案在 |

## 動手練

**練習**：建立一個名為 `vibe-practice` 的專案資料夾，放入 `check_env.py` 並執行成功。接著請 AI 幫你產生一個 `greet.py`，讀取使用者輸入的城市名稱，輸出「我正在〈城市〉學 Vibe Coding」。實際執行它，並把任何錯誤訊息貼回 AI 修正，直到輸出正確。

**提示**：如果 AI 給的程式用到 `sys`、`platform` 以外的套件，先問它「有沒有只用標準函式庫的寫法」。安裝類問題先確認你打的是 `python` 還是 `python3`。

## 完成檢核標準

- [ ] 我能在終端機用一句指令印出 Python 版本，且是 3.x。
- [ ] `python -m pip --version` 能正常輸出。
- [ ] 我的 `check_env.py` 執行後顯示「環境檢查通過。」。
- [ ] 我的 `greet.py` 能正確讀取輸入並輸出指定句子。
- [ ] 我知道自己的終端機、編輯器、AI 工具分別是哪一個。

## 延伸閱讀

- [Python 官方下載頁](https://www.python.org/downloads/)
- [pip 官方文件](https://pip.pypa.io/en/stable/)
- [Visual Studio Code 官方網站](https://code.visualstudio.com/)

## 下一單元

[提示詞入門：把話說清楚](./prompt-basics.md)
