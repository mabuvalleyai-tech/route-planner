# 版本紀錄

格式依循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號採 [語意化版本](https://semver.org/lang/zh-TW/)。

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
