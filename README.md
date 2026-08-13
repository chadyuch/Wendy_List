# Wendy's list

純靜態單頁，無框架、無建置、無依賴。

## 線上版

https://chadyuch.github.io/Wendy_List/

## 資料怎麼流動

```
List.xlsx  ──(node tools/import-xlsx.mjs)──▶  stores.json ＋ images/  ──▶  網頁
（Google Drive，你維護）                        （repo，程式產生）
```

`List.xlsx` 是你唯一要編輯的檔案。`stores.json` 由匯入腳本產生，**不要手動改**，下次匯入會被覆蓋。

瀏覽器不能直接讀 xlsx（那是壓縮檔加 XML，要載入約 400KB 的第三方函式庫），所以在編輯階段轉一次，網頁只讀輕量 JSON。

## 更新流程

1. 在 `List.xlsx` 新增或修改資料
2. 執行匯入：

```bash
node tools/import-xlsx.mjs
```

3. 檢查結果：

```bash
node tools/validate-stores.mjs
```

4. commit 並 push，GitHub Pages 會自動更新

匯入腳本會自動處理圖片：本機路徑會複製進 `images/`，外站網址會下載進 `images/`，已經在 repo 裡的則沿用。這樣對方刪檔或擋 referrer 都不會讓網頁開天窗。

## xlsx 欄位

| 欄位 | 必填 | 說明 |
|---|---|---|
| 店名 | ✅ | 顯示在票根上 |
| 連結 | | 是 Instagram 就顯示「Instagram」按鈕，其他網站顯示「查看」 |
| 圖片網址 | | 網址或本機路徑皆可，匯入時會收進 `images/` |
| 預約 | | 訂位連結，有值才顯示「預約」按鈕 |
| Tel | | 電話，有值才顯示「撥打電話」按鈕，手機點了直接撥號 |
| 地址 | | 有值才顯示「導航前往」按鈕 |

**欄位留空就不會出現對應的按鈕。**

## id 的穩定性

`id` 是 `localStorage` 的鍵，決定「去過了」的紀錄能不能對上。id 由 `tools/import-xlsx.mjs` 裡的 `ID_BY_NAME` 決定。

**改店名時請一併更新該表**，否則會產生新 id，該店的造訪紀錄就對不上了。表裡沒有的店名會自動以英數轉為 kebab-case；中文店名無法自動轉，必須在表中補上對應。

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

## 驗證清單

改動後請走一遍：

- [ ] 所有店家資料完整渲染，欄位缺漏時該行與該按鈕都不顯示
- [ ] 導航按鈕在手機上正確喚起 Google Maps App
- [ ] 撥打電話按鈕在手機上跳出撥號畫面
- [ ] 預約按鈕開啟正確的訂位頁
- [ ] 非 Instagram 的連結顯示為「查看」
- [ ] 撕票根可標記，再點「還沒去過捏」可復原
- [ ] 撕開後導航與其他按鈕仍存在且可用
- [ ] 重新整理後「已去過」狀態保留
- [ ] 進度數字與進度條與實際狀態一致
- [ ] 照片路徑故意填錯，確認退回色塊而非破圖
- [ ] 開啟系統「減少動態效果」後版面仍正常
- [ ] 手機實機開啟，無橫向捲動
- [ ] GitHub Pages 上線後相對路徑正確

## 照片來源

照片一律取自店家官方帳號、原作者公開貼文或使用者自行拍攝，並在票根右下角標註來源。
