# 台灣山徑｜路線規劃（自然語言版）

以 [kuang-yi-1123/route-planner](https://github.com/kuang-yi-1123/route-planner) 為基礎（經原作者授權），
把「搜尋起點 → 勾選通過點 → 計算 → 分天」的表單操作，改成**一句中文就能完成**，並以 RAG 檢索路網與登山知識。

> 例：「從塔塔加上玉山主峰，住排雲山莊兩天一夜」→ 自動選起點、依序勾通過點、計算路線、在排雲山莊分天。

## 架構

```
瀏覽器（靜態頁 index.html + assets/nl.js）
  │ POST /api/plan { text, comp }
  ▼
Vercel Function  api/plan.js
  1. 檢索  lib/retrieve.js   中文字元 bigram + BM25，索引 data/rag/index.json
  2. 生成  Claude（結構化輸出 JSON schema）→ {intent, start, vias, mode, days, overnight, answer…}
  3. 驗證  lib/plan.js       只接受本次檢索出的節點、同一區域、去重
  ▼
RoutePlanner.applyPlan(plan) → 原站的找路、高程剖面、分天匯出
```

RAG 知識庫（`npm run build` 重建索引）：

| 來源 | 內容 |
|---|---|
| `data/trail-network.json` | 667 個節點、783 段路、19 個區域 |
| `knowledge/aliases.json` | 口語地名別名（排雲、369、塔塔加…） |
| `knowledge/itineraries/*.md` | 行程範本，時間依路網實算 |
| `posts/*.html` | 登山知識文章（高山症、裝備、冬季安全…） |

新增行程範本：在 `knowledge/itineraries/` 加一個 Markdown（front matter 寫 `stops`、`overnight` 節點名稱），跑 `npm run build`，建置時會檢查名稱存在且同一區域。

## 開發

```bash
npm install
npm run build     # 產生 data/rag/index.json
npm test          # 單元＋API 測試（假 Claude client，不需金鑰）
npx vercel dev    # 本機起前端＋/api/plan，需要 ANTHROPIC_API_KEY
```

## 部署（Vercel）

1. 在 Vercel 匯入這個 repo（Framework Preset 選 Other，`vercel.json` 已設定好）。
2. Settings → Environment Variables 加上 `ANTHROPIC_API_KEY`。
3. 選用：`CLAUDE_MODEL` 換模型（預設 `claude-sonnet-5-5`；要更強可設 `claude-opus-5-5`）。

只部署靜態檔（如 GitHub Pages）時，手動規劃照常可用，自然語言面板會提示需要後端。

## 版本

見 [CHANGELOG.md](CHANGELOG.md)。

## 授權與來源

- 路線規劃頁、路網、高程剖面與文章：原作者 kuang-yi-1123／國立臺北科技大學防災工程科技中心，經授權使用。
- 範圍圖資：林業及自然保育署、OpenStreetMap；底圖：內政部國土測繪中心、魯地圖。
