// 呼叫 Google AI Studio 的 Gemini API（@google/genai 官方 SDK）
import { GoogleGenAI } from "@google/genai";

let client = null;
function getClient(){
  if (!client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("尚未設定 GEMINI_API_KEY，請先在 .env 填入從 Google AI Studio 取得的 API 金鑰。");
    }
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

/**
 * 呼叫 Gemini 產生回覆。
 * @param {string} systemInstruction 系統規則（13條AI生成規定＋任務情境）
 * @param {string} userMessage 學生送出的訊息（Prompt 原文）
 * @returns {Promise<{text:string, model:string}>}
 */
export async function askGemini(systemInstruction, userMessage){
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userMessage,
    config: {
      systemInstruction
    }
  });
  const text = (response && response.text) ? response.text.trim() : "";
  if (!text) {
    throw new Error("Gemini 沒有回傳任何文字內容。");
  }
  return { text, model: MODEL };
}
