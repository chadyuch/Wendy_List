# 台中待訪

想去但還沒去過的台中店家清單。純靜態單頁，無框架、無建置、無依賴。

## 線上版

https://chadyuch.github.io/taichung-list/

## 本機預覽

`fetch` 無法在 `file://` 下運作，請用 HTTP 開啟：

```bash
node tools/serve.mjs
```

然後開 http://localhost:8080

手機實機測試（同一個 Wi-Fi）：

```bash
node tools/serve.mjs 8080 --lan
```

終端機會印出手機該用的網址。

## 新增一家店

1. 在 `stores.json` 追加一筆，`id` 用 kebab-case 且**不可與既有重複**
2. 執行 `node tools/validate-stores.mjs` 確認資料正確
3. 照片放進 `images/`，只用店家官方素材並填寫 `photoCredit`
4. commit 並 push，GitHub Pages 會自動更新

`id` 是 `localStorage` 的鍵，**一旦訂定就不要改**，否則造訪紀錄會遺失。

## 欄位說明

| 欄位 | 必填 | 說明 |
|---|---|---|
| `id` | ✅ | kebab-case 代號，localStorage 鍵值 |
| `name` | ✅ | 店名 |
| `navQuery` | ✅ | 導航查詢字串，通常是店名加地址 |
| `subtitle` | | 一句話定位 |
| `address` | | 地址 |
| `hours` | | 營業時間 |
| `mapUrl` | | 原始 Google Maps 分享連結（僅作紀錄） |
| `instagram` | | IG 連結。**單篇貼文**（`/p/`、`/reel/`、`/tv/`）會顯示「看實景」並就地嵌入；**帳號首頁**則顯示「Instagram ↗」直接開啟 |
| `photo` | | `images/` 下的相對路徑，留空則顯示溫暖色塊與大編號 |
| `photoCredit` | | 照片來源標註 |

## 驗證清單

改動後請走一遍：

- [ ] 所有店家資料完整渲染，欄位缺漏時該行不顯示
- [ ] 導航按鈕在手機上正確喚起 Google Maps App
- [ ] 撕票根可標記，再點可復原
- [ ] 撕開後導航按鈕仍存在且可用
- [ ] 重新整理後「已去過」狀態保留
- [ ] 進度數字與進度條與實際狀態一致
- [ ] 照片路徑故意填錯，確認退回色塊而非破圖
- [ ] IG「看實景」點擊後才載入，且只載入一次
- [ ] 開啟系統「減少動態效果」後版面仍正常
- [ ] 手機實機開啟，無橫向捲動
- [ ] GitHub Pages 上線後相對路徑正確

## 資料來源

店家連結收集於 Google Drive 的 `List.txt`。`stores.json` 是唯一真實來源。

照片與嵌入內容一律取自店家官方帳號或原作者的公開貼文，並標註來源；不下載轉存他人拍攝的照片。
