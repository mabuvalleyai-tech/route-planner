# 版本紀錄

格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號採 [語意化版本](https://semver.org/lang/zh-TW/)。

## [0.4.0] - 2026-10-03
### 新增
- `api/plan.js`（Vercel Function）：`POST /api/plan {text, comp?}`，BM25 檢索 → Claude 結構化輸出（JSON schema）→ 伺服器端驗證。
  - 預設模型 `claude-opus-5-5`，可用環境變數 `CLAUDE_MODEL` 切換；`effort: low` 降低延遲。
  - 啟用 `fallbacks: "default"`：模型因安全分類拒答時自動改由備援模型處理。
  - 每 IP 每分鐘 10 次的簡易速率限制、輸入上限 500 字。
- `lib/plan.js`：只接受本次檢索出的節點 ID、去除重複、擋下跨區域路線並改為請使用者釐清。
- `lib/prompt.js`：系統提示（固定、可快取）與輸出 schema。
- `vercel.json`、`.gitignore`；`npm test`（node:test，12 個測試，以假 Claude client 測端到端）。

## [0.3.0] - 2026-10-03
### 新增
- RAG 知識庫：
  - `knowledge/aliases.json`：常用地名別名（排雲、369、塔塔加、北大武…）。
  - `knowledge/itineraries/`：11 篇行程範本（玉山、雪山、奇萊、合歡、南湖、北大武、嘉明湖、天池山莊），時間依路網實算，建置時會檢查節點名稱存在且同一區域。
  - 登山知識文章直接從 `posts/*.html` 擷取。
- `scripts/build-rag-index.mjs`（`npm run build`）產生 `data/rag/index.json`：717 個 chunk（節點 667、區域 19、文章段落 20、行程 11）。
- `lib/retrieve.js`：中文字元 bigram + BM25 檢索。

## [0.2.0] - 2026-10-03
### 變更
- 路網資料（667 節點、783 路段、19 區塊）從 `index.html` 拆出為 `data/trail-network.json`，頁面由 4 MB 降至約 260 KB；前後端共用同一份資料。
- 主程式由 IIFE 改為 `startPlanner(DATA)`，載入資料後才啟動，載入失敗時顯示錯誤。
### 新增
- `scripts/extract-trail-data.mjs`：同步原站新版時重跑即可。

## [0.1.0] - 2026-10-03
### 新增
- 匯入原站 [kuang-yi-1123/route-planner](https://github.com/kuang-yi-1123/route-planner)（commit `8e9df69`，經原作者授權）：路線規劃頁、步道路網、高程剖面、國家公園／保護區範圍、登山知識文章。
### 移除
- 原站部署在 Netlify 時自動注入的 `/.netlify/scripts/*` 兩行 script。
- `tools/` 與 `shengleng-route-planner.html` 等重複副本。
