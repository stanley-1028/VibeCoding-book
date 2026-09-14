# 《VibeCoding：從入門到精通》

> 用自然語言與 AI 協作，從零開始打造真正能用的軟體。

這是一份**策劃式（curated）自學教材**，把網路上零散的 Vibe Coding 教學整理成一條清楚的學習路徑。你不需要先成為程式高手，只要會用電腦、願意動手，就能循序漸進地學會「用 AI 把想法變成程式」。

## 這本書解決什麼問題

- 網路上的 Vibe Coding 教學**零散**，散落在部落格、YouTube、論壇，缺乏統一入口。
- 初學者**不知道學習順序**，容易在不相關或過時的內容間跳轉。
- 資源**品質參差**，缺乏難度、前置知識與時效標註。
- 缺少一致的**實作練習**與檢核方式，學了也難以確認是否真的會用。

本教材以「**每個單元都有一個可動手的實作與明確的完成檢核標準**」為核心原則，讓你學過就真的會用。

## 目標讀者

| 你是誰 | 建議起點 |
|---|---|
| 完全新手，沒有程式背景 | [入門路徑](./paths/beginner.yaml) |
| 有基礎、想系統化學習 AI 開發 | [中階路徑](./paths/intermediate.yaml) |
| 有經驗開發者，想把 Vibe Coding 導入真實專案 | [進階路徑](./paths/advanced.yaml) |
| 想貢獻教材的人 | [CONTRIBUTING.md](./CONTRIBUTING.md) |

## 三條學習路徑

本教材依難度分為三條路徑，**建議依序**完成。每條路徑的單元順序定義於 `paths/` 目錄，每完成一個單元再進入下一個。

### 入門路徑（8 單元）

從零開始，建立環境、學會與 AI 溝通，親手完成第一個可用作品。

1. [什麼是 Vibe Coding](./docs/what-is-vibe-coding.md)
2. [準備你的 AI 開發環境](./docs/setup-ai-environment.md)
3. [提示詞入門：把話說清楚](./docs/prompt-basics.md)
4. [從需求到專案：先規格後動手](./docs/spec-then-build.md)
5. [讀懂 AI 產生的程式碼](./docs/read-ai-code.md)
6. [與 AI 協作除錯](./docs/debug-with-ai.md)
7. [迭代與修改：讓雛形變好用](./docs/iterate-and-refine.md)
8. [入門實戰：做出一個可用的文字工具](./docs/first-project.md)

### 中階路徑（6 單元）

把 Vibe Coding 帶進真實專案：版本控制、專案結構、測試、資料與上下文管理。

1. [用 Git 與 AI 安全地協作](./docs/git-with-ai.md)
2. [專案結構與模組化](./docs/project-structure.md)
3. [讓 AI 幫你寫測試](./docs/test-with-ai.md)
4. [串接 API 與處理資料](./docs/api-and-data.md)
5. [上下文工程：讓 AI 記得對的事](./docs/context-engineering.md)
6. [中階實戰：一個全端小工具](./docs/mid-project.md)

### 進階路徑（5 單元）

以工程方法駕馭 AI：規格驅動開發、多代理工作流、品質安全、評測與上線。

1. [規格驅動開發](./docs/spec-driven-development.md)
2. [多代理與自動化工作流](./docs/multi-agent-workflows.md)
3. [品質、安全與效能](./docs/code-quality-security.md)
4. [評測與可觀測性](./docs/evaluation-and-observability.md)
5. [畢業專案：從需求到上線](./docs/capstone-project.md)

## 如何使用本教材

1. **從你的路徑的第一個單元開始**，不要跳著看。
2. 每個單元都有「**動手練**」與「**完成檢核標準**」。練習做完、檢核全部打勾，才進入下一單元。
3. 範例程式碼放在 [`examples/`](./examples/) 目錄，多數可獨立執行。
4. 卡住時，先看單元裡的「常見坑」與「提示」，再尋求協助。

## 單元格式

所有單元都遵循 [`templates/unit-template.md`](./templates/unit-template.md) 的結構，並帶有 YAML frontmatter（標題、難度、標籤、前置單元、預估時間、更新日期等）。這讓內容可被搜尋、分類，也讓貢獻者能快速產出格式一致的教材。

## 貢獻

歡迎新增、修訂教材。請先閱讀 [CONTRIBUTING.md](./CONTRIBUTING.md)，並使用單元模板。提交前請執行檢查腳本：

```bash
node scripts/check-units.mjs
```

## 目錄結構

```
.
├─ README.md               # 你在這裡
├─ CONTRIBUTING.md         # 貢獻指南
├─ LICENSE                 # MIT
├─ templates/
│  └─ unit-template.md     # 教材模板
├─ paths/                  # 三條學習路徑定義
├─ docs/                   # 所有教材單元
├─ examples/               # 可執行範例專案
└─ scripts/
   └─ check-units.mjs      # frontmatter 與連結檢查
```

## 授權

本教材採 [MIT 授權](./LICENSE)。
