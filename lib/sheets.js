// 把每一筆互動紀錄寫進 Google 試算表（使用服務帳戶 Service Account）
import { google } from "googleapis";
import fs from "fs";

const SHEET_NAME = process.env.GOOGLE_SHEET_TAB || "interactions";
const HEADER = ["時間", "班級", "座號", "姓名", "任務目標類型條件", "關卡", "步驟",
  "關卡目標", "認知層次(學生按鈕)", "認知層次(正式名稱)", "送出的訊息", "AI回覆", "使用模型", "是否錯誤"];

let sheetsClient = null;
let headerChecked = false;

function isConfigured(){
  return !!(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

async function getClient(){
  if (sheetsClient) return sheetsClient;
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!fs.existsSync(keyFile)) {
    throw new Error(`找不到服務帳戶金鑰檔案：${keyFile}`);
  }
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  const client = await auth.getClient();
  sheetsClient = google.sheets({ version: "v4", auth: client });
  return sheetsClient;
}

async function ensureHeader(){
  if (headerChecked) return;
  const sheets = await getClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:N1`
  }).catch(() => null);
  const hasHeader = res && res.data && res.data.values && res.data.values.length > 0;
  if (!hasHeader) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] }
    });
  }
  headerChecked = true;
}

/**
 * 附加一列互動紀錄到 Google 試算表。失敗時拋出錯誤，由呼叫端決定如何處理
 * （本專案採「best-effort」：寫入失敗不影響學生當下拿到 AI 回覆，只記錄警告）。
 */
export async function appendInteractionRow(row){
  if (!isConfigured()) {
    throw new Error("尚未設定 GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_JSON，略過寫入 Google 試算表。");
  }
  const sheets = await getClient();
  await ensureHeader();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:N`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        row.tsISO, row.className, row.seatNumber, row.studentName, row.conditionLabel,
        row.groupTitle, row.stepId, row.scenario,
        row.levelStudentLabel, row.levelFormalName, row.promptSent, row.aiResponse,
        row.model || "", row.isError ? "是" : "否"
      ]]
    }
  });
}

export { isConfigured as isSheetsConfigured };
