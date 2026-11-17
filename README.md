# 整流觀察室

半波整流、中心抽頭式全波整流與橋式整流的互動學習網頁。電路圖、麵包板、LED 與波形共用時間游標。

## 離線使用

解壓縮後，用瀏覽器開啟 `index.html`。請把 `style.css` 與 `lab.js` 留在同一資料夾。網頁可離線執行，無需安裝套件或啟動伺服器。

## 發佈到 GitHub Pages

1. 在 GitHub 建立儲存庫，例如 `rectifier-lab`。使用 GitHub Free 時，請選 **Public**。
2. 在儲存庫選 **Add file → Upload files**，上傳解壓後的檔案，讓 `index.html`、`style.css`、`lab.js`、`.nojekyll` 和本說明都位於儲存庫根目錄。選 **Commit changes**。
3. 進入 **Settings → Pages**。在 **Build and deployment** 的 **Source** 選 **Deploy from a branch**，接著選 `main`（或實際上傳的分支）和 `/(root)`，按 **Save**。
4. GitHub 完成部署後，回到 **Settings → Pages**，點 **Visit site**。之後更新同一個分支的網頁檔案，GitHub Pages 就會重新部署。

[GitHub Pages 官方設定說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
