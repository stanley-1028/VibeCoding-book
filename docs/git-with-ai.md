---
title: 用 Git 與 AI 安全地協作
slug: git-with-ai
level: intermediate
tags: [工作流, 安全, 最佳實踐]
prerequisites: ["first-project"]
estimated_minutes: 60
path: intermediate
updated: 2026-09-14
maintainers: []
status: active
---

# 用 Git 與 AI 安全地協作

> 把 Git 當成 AI 改動的檢查點與undo鍵，讓每一次 AI 產出的程式碼都經過你確認才進版控。

## 學習目標

完成本單元後，你能夠：

1. 在讓 AI 修改程式碼前後，使用 `git status` 與 `git diff` 檢視實際變更。
2. 把 AI 的一次大型改動拆成數個語意清楚的小提交（commit）。
3. 用分支（branch）隔離實驗性改動，並在失敗時安全地丟棄或還原。
4. 建立 `.gitignore` 與提交前檢查，避免把金鑰、快取或大型檔案送進版本庫。
5. 判斷哪些 Git 指令可以交給 AI 執行，哪些必須由你親自確認。

## 前置知識

- [完成你的第一個作品](./first-project.md)
- 你已經會建立檔案、執行 `python` 或 `node`，並看過 AI 產出的完整程式碼。

## 為什麼重要

AI 產生程式碼的速度遠快於你手動打字，這讓「改壞了怎麼辦」從偶發事件變成每天的日常。Git 提供三個關鍵能力：隨時可還原的檢查點、逐步檢視的差異、彼此隔離的實驗空間。沒有版控，AI 的一次錯誤重構就可能讓你花半小時手動復原；有了版控，你只需要一行 `git restore`。更重要的是，`git diff` 是你審查 AI 的介面——不看差異就提交，等於放棄最後一道品質防線。

## 核心內容

### 小節一：AI 協作的黃金迴圈

把與 AI 的互動固定成四步迴圈，每次改動都跑一遍：

```text
1. 確認乾淨狀態  git status
2. 請 AI 修改     （在對話中描述需求）
3. 檢視差異       git diff
4. 通過才提交     git add -p && git commit
```

第一步是關鍵：開始前工作區必須是乾淨的（`nothing to commit, working tree clean`）。否則 AI 的改動會和你尚未提交的變更混在一起，`git diff` 就分不清哪些是 AI 改的。

```console
$ git status
On branch main
nothing to commit, working tree clean
```

### 小節二：看懂 diff，才決定要不要 commit

`git diff` 會用 `+`／`-` 標出新增與刪除的行。審查時依序問三個問題：**這段改變符合我要求的功能嗎？有沒有動到不該動的檔案？有沒有刪掉我原本的邏輯？**

```diff
--- a/calc.py
+++ b/calc.py
@@ -1,4 +1,7 @@
 def average(nums):
-    return sum(nums) / len(nums)
+    if not nums:
+        raise ValueError("nums 不可為空")
+    return sum(nums) / len(nums)
```

上例是 AI 替 `average` 補上邊界檢查，屬於合理改動。若 diff 中出現你沒要求的檔案（例如 AI 順手「整理」了其他模組），就是警訊，應要求它縮小範圍。

`git add -p`（patch 模式）讓你逐塊決定要不要納入這次提交，是拆分 AI 大型改動最實用的指令。

### 小節三：分支是免費的實驗室

不要直接在 `main` 上接受 AI 的大改動。開一個分支，改壞了直接刪掉：

```console
$ git switch -c try-ai-refactor
Switched to a new branch 'try-ai-refactor'
# ...請 AI 重構，測試後決定...
$ git switch main          # 實驗失敗，回到乾淨的 main
$ git branch -D try-ai-refactor
```

若只是臨時想擱置改動又不想提交，用 `git stash`：

```console
$ git stash push -m "ai-experiment"
Saved working directory and index state On main: ai-experiment
$ git stash pop
```

### 小節四：還原單一檔案或整段改動

- 丟棄某檔案尚未提交的改動：`git restore calc.py`
- 從暫存區移出（保留檔案內容）：`git restore --staged calc.py`
- 反轉某個「已經提交」的 commit（產生新的反向 commit，不改歷史）：`git revert <commit-hash>`

`git revert` 適合已經推送出去、不能改歷史的情況；本機未推送的錯誤提交才考慮 `git reset`。

### 小節五：不要讓 AI 把秘密推上去

AI 常「順手」產生範例金鑰或讀取環境檔。建立 `.gitignore` 是標準函式庫等級的必備動作：

```gitignore
.env
*.pyc
__pycache__/
node_modules/
.DS_Store
```

若懷疑金鑰已進版控，正確處理順序是：**先到服務商撤銷（rotate）金鑰**，再從版控移除。只刪檔案而不撤銷，等於沒補救。

### 小節六：哪些 Git 指令交給 AI？

| 指令類型 | 範例 | 建議 |
|---|---|---|
| 唯讀查詢 | `git status`、`git diff`、`git log` | 可讓 AI 執行，幫你彙整狀態 |
| 建立分支／暫存 | `git switch -c`、`git stash` | 可讓 AI 執行，成本低且可逆 |
| 提交 | `git commit` | AI 可草擬訊息，但你必須先看過 `git diff` |
| 改寫歷史／強制推送 | `git reset --hard`、`git push --force` | 只由你手動執行，且推送前再次確認 |

原則：**不可逆或影響遠端的指令，一律自己按下去。**

## 常見坑

| 錯誤 | 原因 | 正確做法 |
|---|---|---|
| 把 AI 一次改 10 個檔案的結果一次提交 | 沒有拆分 | 用 `git add -p` 依功能拆成多個提交 |
| 直接接受沒看過的 diff | 過度信任 AI | 每次提交前先 `git diff` 逐行審查 |
| 在金鑰外洩後只執行 `git rm` | 以為刪檔就沒事 | 先撤銷金鑰，再從版控移除 |
| 在 `main` 上做大重構 | 沒有隔離 | 每個實驗性任務開一條分支 |
| 讓 AI 執行 `git reset --hard` | 不可逆、會蓋掉未提交內容 | 這類指令由自己手動執行 |
| 提交訊息只寫「update」 | 失去查找與回溯能力 | 用一句話說明「為什麼改」，例如 `fix: average 空陣列會除以零` |

## 動手練

**練習**：建立一個練習專案，完整走過一次「AI 改動 → 審查 → 分支 → 還原」流程。

步驟：

1. `git init ai-git-practice` 後進入該目錄，建立 `calc.py`，內含一個 `average(nums)` 函式，並提交。
2. 請 AI「幫 `average` 加上空陣列的處理」。執行 `git status`，確認只有 `calc.py` 被改。
3. 執行 `git diff`，確認 AI 沒有動到其他檔案。
4. 開分支 `try-ai-refactor`，請 AI 把 `average` 改成回傳 `(平均值, 樣本數)` 的 tuple。
5. 執行 `git diff` 後決定不接受，用 `git switch main` 與 `git branch -D` 丟棄。
6. 回到 `main`，把步驟 2 的改動用 `git add -p` 只納入 `average` 的空陣列檢查，提交。

**提示**：若 `git diff` 顯示的檔案數超過你預期，先問 AI「你改了哪些檔案？為什麼？」再決定是否 `git restore` 全部還原重來。提交訊息請描述「為什麼」，而非「做了什麼」。

## 完成檢核標準

- [ ] 我能在每次 AI 改動後執行 `git diff`，並說出每一段 `+`／`-` 的用途。
- [ ] 我能用 `git add -p` 把一次改動拆成至少兩個提交。
- [ ] 我能開分支、在失敗時安全刪除分支，且不影響 `main`。
- [ ] 我的專案有 `.gitignore`，且 `git status` 不會列出 `.env` 或快取檔。
- [ ] 我能分辨哪些 Git 指令可以交給 AI、哪些必須自己手動執行。
- [ ] 我的提交訊息能讓人在不看程式碼的情況下理解「為什麼改」。

## 延伸閱讀

- [Git 官方文件：Recording Changes to the Repository](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository)
- [Git 官方文件：Interactive Staging](https://git-scm.com/book/en/v2/Git-Tools-Interactive-Staging)
- [GitHub Docs：Ignoring files](https://docs.github.com/en/get-started/getting-started-with-git/ignoring-files)

## 下一單元

[專案結構與模組化](./project-structure.md)
