# 戀習曲｜First Note of Love — 第二版

青春天空藍 × 音樂專輯主題。純 HTML/CSS/JS 靜態網站，可部署至 Cloudflare Pages。

## 檔案

- `index.html` — 首頁、曲目列表、閱讀視窗、官方音樂嵌入區
- `styles.css` — 響應式天空藍視覺
- `app.js` — 公開曲目篩選、18+ 提示、閱讀導覽、YouTube 嵌入
- `data/chapters.json` — 已核准公開的文章資料（初始為空）

## Cloudflare Pages

連接 GitHub repository `Eliasxin/first-note-of-love`。使用 **None / 無框架**，Build command 留空，Build output directory 設為 `/`（或 Cloudflare 控制台對應的根目錄設定）。靜態檔案位於 repository 根目錄。

## 資料格式（示例，請勿將草稿放入公開 Repository）

```json
[
  {
    "id": "chapter-01",
    "order": 1,
    "title": "已核准公開的真實篇名",
    "cp": ["Reese × Orca"],
    "rating": "一般",
    "status": "已發布",
    "published": true,
    "content": "已核准公開的正文。"
  }
]
```

僅當 `published === true`、`status === "已發布"`、標題與正文均非空時才顯示。**注意：前端過濾並非保密措施**：任何寫入公開 `chapters.json` 的內容都能被訪客直接讀取。未來 Notion 同步必須在 **GitHub Actions 伺服器端先過濾**，絕對不要將草稿或未公開文章寫入公開 JSON。Notion API Token 只能放 GitHub Actions Secrets，不能放網站程式或 JSON。

## 音樂

音樂視窗於使用者點擊時載入 YouTube privacy-enhanced iframe，不會自動播放；關閉視窗會移除 iframe 以停止播放。影片 ID 目前設為 `VdYIMjVJU90`（先前討論的〈我愛，我在〉連結），上線前請確認官方來源及允許嵌入。YouTube 若禁止嵌入，網站提供前往 YouTube 的連結。播放器實際播放按鈕、進度與音量由 YouTube 提供，網站不假裝控制外部播放。

## 上傳方式

解壓後，**上傳裡面的檔案與 data 資料夾**到 GitHub repository 根目錄，取代同名舊檔。不要將整個資料夾額外包成一層，也不要只上傳 ZIP。
