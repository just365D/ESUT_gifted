# 鑰匙線索站 — 後端版（Gemini API + Google 試算表）

這是「鑰匙線索站」原型的正式後端版本：學生點選三層級協助方式後，由**你自己的 Google Gemini API 金鑰**產生 AI 回覆，每一筆互動同步寫入**你指定的 Google 試算表**，不再依賴瀏覽器端的個人 Claude 帳號額度，適合正式在班級電腦上跑。

---

## 你需要準備的東西

1. 電腦已安裝 **Node.js 18 以上**（終端機打 `node -v` 檢查；沒有就到 https://nodejs.org 下載 LTS 版安裝）。
2. 一個 **Google 帳號**，用來申請 Gemini API 金鑰、建立 Google 試算表。
3. 十分鐘左右的設定時間（第一次而已，之後開機只要一個指令）。

---

## 第一步：安裝套件

打開終端機（Mac 是「終端機」、Windows 是 PowerShell），切換到這個資料夾，執行：

```bash
npm install
```

## 第二步：申請 Gemini API 金鑰

1. 開啟 https://aistudio.google.com/apikey
2. 登入 Google 帳號 → 點「Create API key」→ 複製產生的金鑰。
3. 把專案裡的 `.env.example` 複製一份，改名為 `.env`。
4. 打開 `.env`，把金鑰貼到 `GEMINI_API_KEY=` 後面，例如：
   ```
   GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   `GEMINI_MODEL` 保持預設的 `gemini-3.5-flash-lite` 就好（便宜、速度快，很適合這種短文字回覆）。Gemini API 有免費額度，一個班級 30 人、每人問 5～10 次的量通常在免費額度內就夠用；如果全班同一分鐘一起送出可能會撞到免費額度的流量限制，屆時可以到 https://aistudio.google.com/rate-limit 查看，或考慮開啟計費（flash-lite 非常便宜）。

## 第三步：設定 Google 試算表（研究資料存放處）

1. 到 Google 試算表 https://sheets.new 建立一個新的試算表，隨意命名（例如「鑰匙線索站_互動紀錄」）。
2. 網址列會長得像：
   `https://docs.google.com/spreadsheets/d/【這一長串就是 SHEET_ID】/edit`
   把這串 ID 複製下來，貼到 `.env` 的 `GOOGLE_SHEET_ID=` 後面。
3. 建立「服務帳戶」（Service Account）給程式用來寫入試算表：
   1. 到 https://console.cloud.google.com/ 建立一個新專案（或用現有的）。
   2. 左上角搜尋列輸入「Google Sheets API」→ 進去按「啟用」。
   3. 左側選單「API 和服務」→「憑證」→「建立憑證」→「服務帳戶」，名稱隨意，一路下一步完成建立。
   4. 進入剛建立的服務帳戶 →「金鑰」分頁 →「新增金鑰」→「JSON」→ 會下載一個 `.json` 檔案。
   5. 把這個檔案改名為 `service-account.json`，放到這個專案的資料夾（跟 `server.js` 同一層）。
   6. **重要**：打開下載的 JSON 檔，找到 `"client_email"` 那一串像 `xxx@xxx.iam.gserviceaccount.com` 的信箱，回到第 1 步建立的 Google 試算表，按右上角「共用」，把這個信箱加進去，權限選「編輯者」。（沒有做這一步，程式會沒有權限寫入。）
4. 確認 `.env` 裡 `GOOGLE_SERVICE_ACCOUNT_JSON=./service-account.json` 這行路徑跟你放的檔名一致。

> 這兩項（金鑰檔、.env）都含有機密資訊，**不要**上傳到公開的 GitHub、不要傳給不相關的人。`.gitignore` 已經幫你排除這兩個檔案。

如果你現在還不想弄 Google 試算表，把 `.env` 裡 `GOOGLE_SHEET_ID` 留空即可——資料仍會存在專案資料夾裡的 `data/interactions.json`，之後想接再回來設定。

## 第四步：設定研究者密碼（可選，建議設定）

`.env` 裡的 `TEACHER_TOKEN` 是研究者頁面（切換條件、看即時紀錄、匯出CSV）要輸入的密碼，避免學生也能改到實驗條件。自己設一個簡單密碼即可，例如：

```
TEACHER_TOKEN=fengchiayen2026
```

如果留空，任何人打開「研究者/教師」分頁都不用密碼就能操作——只建議自己一個人在本機測試時這樣做。

## 第五步：啟動伺服器

```bash
npm start
```

看到 `鑰匙線索站後端已啟動：http://localhost:3000` 就代表成功了。用瀏覽器打開 http://localhost:3000 即可看到跟之前 Artifact 原型一樣的介面。

- 如果是全班在同一間電腦教室、老師的電腦當伺服器，其他學生電腦可以改用老師電腦的區網 IP 連線，例如 `http://192.168.1.23:3000`（在老師電腦的終端機打 `ipconfig`〔Windows〕或 `ifconfig`/`ipconfig getifaddr en0`〔Mac〕可以查到這個 IP，前提是大家在同一個 Wi-Fi/區網）。
- 要停止伺服器，在終端機按 `Ctrl + C`。

---

## 使用方式

- **學生**：選班級 → 選座號 → 輸入完整姓名 → 選關卡與關卡目標 → 選一種協助方式（找到程式重點／把重點用在任務中／檢查並想新方法）→ 幾秒後看到 AI 小幫手回覆。
- **任務目標類型條件（完整任務型／線索任務型）不再由老師手動切換**，而是依學生選的**班級**自動決定，對照表固定寫在 `lib/steps.js` 的 `CLASSES`（預設 601-604 班＝完整任務型、605-608 班＝線索任務型）。學生畫面完全不會顯示這個對照，只會看到最終產生的提示文字。
- **研究者/教師**：切到「研究者/教師」分頁 → 輸入 `TEACHER_TOKEN` 密碼登入 → 可看到目前的班級→條件對照表（唯讀）、即時互動紀錄，並可匯出 CSV。
- 每一筆互動也會**即時**（背景非同步）寫進你設定的 Google 試算表一列，欄位依序是：時間、班級、座號、姓名、任務目標類型條件、關卡、步驟、關卡目標、認知層次(學生按鈕)、認知層次(正式名稱)、送出的訊息、AI回覆、使用模型、是否錯誤。

---

## 檔案說明

```
server.js              後端主程式（Express）
lib/steps.js           12個任務步驟＋72則prompt原文＋13條AI生成規定＋CLASSES班級對照表（唯一資料來源）
lib/gemini.js          呼叫 Google Gemini API
lib/sheets.js          寫入 Google 試算表
lib/store.js           本機檔案儲存（data/interactions.json 互動紀錄備份）
public/index.html      前端頁面（學生／研究者兩個畫面）
.env.example           設定檔範本，複製成 .env 使用
```

---

## 常見問題

**Q: 學生按下協助方式後一直「思考中」不動？**
A: 開啟終端機看有沒有紅字錯誤訊息。最常見是 `.env` 裡 `GEMINI_API_KEY` 沒填或填錯，或是網路被學校防火牆擋住存取 Google API。

**Q: Google 試算表都沒有新的資料列？**
A: 檢查三件事：(1) `.env` 的 `GOOGLE_SHEET_ID` 是否正確、(2) `service-account.json` 是否放對位置、(3) 有沒有把服務帳戶的 email 加進試算表「共用」名單並給「編輯者」權限。這三項有誤時，終端機會印出 `[Google Sheets] 寫入失敗` 的警告，但**不會**影響學生當下拿到 AI 回覆（資料仍會存在本機 `data/interactions.json` 當備份）。

**Q: 之後想放到雲端讓學生不用連同一台電腦/同一個 Wi-Fi 也能用？**
A: 目前設計是先在本機/教室區網測試。之後如果要正式部署到雲端主機（例如 Render、Railway），我可以再幫你打包成雲端可跑的版本——屆時 `.env` 的內容會改成在雲端平台的後台設定，程式碼幾乎不用改。

**Q: 想換掉範例的「阿煌闖關」故事，換成你們自己班的另一個 Delightex 任務？**
A: 修改 `lib/steps.js` 裡的 `STEPS` 陣列，把每個步驟的 `title` 與三層級的 `full`/`clue` prompt 內容換成新任務的文字即可，前端和後端邏輯都不用動。

**Q: 換學期、換班級了，要怎麼調整班級和任務目標類型條件的對照？**
A: 只要改 `lib/steps.js` 最上方的 `CLASSES` 陣列，把班級代碼和對應的 `condition`（`"full"` 完整任務型／`"clue"` 線索任務型）改成新的班級即可，其他程式碼都不用動。學生端的班級下拉選單、教師頁面的對照表、AI 提示內容都會自動跟著更新。
