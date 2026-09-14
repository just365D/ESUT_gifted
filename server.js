import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { STEPS, LEVELS, GROUPS, CLASSES, findStep, findLevel, findGroup, conditionForClass, supportForClass, buildPromptText, buildSystemInstruction } from "./lib/steps.js";
import { askGemini } from "./lib/gemini.js";
import { appendInteractionRow, isSheetsConfigured } from "./lib/sheets.js";
import { loadInteractions, appendInteractionCache } from "./lib/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const TEACHER_TOKEN = process.env.TEACHER_TOKEN || "";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function requireTeacher(req, res, next){
  if (!TEACHER_TOKEN) return next(); // 未設定密碼 = 本機測試模式，直接放行（見 README 提醒）
  const token = req.headers["x-teacher-token"] || req.query.token;
  if (token === TEACHER_TOKEN) return next();
  return res.status(401).json({ error: "teacher_token_invalid", message: "教師密碼錯誤或未提供。" });
}

// ---------- 公用資料 ----------
app.get("/api/groups", (req, res) => {
  res.json(GROUPS);
});

app.get("/api/steps", (req, res) => {
  res.json(STEPS.map(s => ({ id: s.id, groupKey: s.groupKey, title: s.title, scenario: s.scenario })));
});

app.get("/api/levels", (req, res) => {
  res.json(LEVELS.map(l => ({ key: l.key, studentLabel: l.studentLabel, formalName: l.formalName, def: l.def, hint: l.hint })));
});

// ---------- 班級 → 兩個自變項條件 對照（研究者指派，以班級為分派單位；固定值見 lib/steps.js） ----------
app.get("/api/classes", (req, res) => {
  res.json(CLASSES.map(c => ({
    code: c.code,
    condition: c.condition,
    conditionLabel: c.condition === "clue" ? "線索任務型" : "完整任務型",
    support: c.support,
    supportLabel: c.support === "autonomous" ? "自主式" : "引導式"
  })));
});

// 學生端在送出前，先看到「即將送給 AI 的完整提示文字」（依學生選的班級自動決定條件，
// 條件本身不會顯示給學生，只顯示最終文字）。
app.get("/api/preview", (req, res) => {
  const step = findStep(req.query.stepId);
  const level = findLevel(req.query.levelKey);
  if (!step || !level) {
    return res.status(400).json({ error: "invalid_request", message: "步驟或協助方式不正確。" });
  }
  const condition = conditionForClass(req.query.className);
  res.json({ promptText: buildPromptText(step, level.key, condition) });
});

// ---------- 學生：送出 Prompt ----------
app.post("/api/ask", async (req, res) => {
  const { className, seatNumber, studentName, stepId, levelKey } = req.body || {};
  const step = findStep(stepId);
  const level = findLevel(levelKey);
  if (!step || !level) {
    return res.status(400).json({ error: "invalid_request", message: "步驟或協助方式不正確。" });
  }
  if (!className) return res.status(400).json({ error: "invalid_request", message: "請先選擇班級。" });
  if (!seatNumber) return res.status(400).json({ error: "invalid_request", message: "請先選擇座號。" });
  if (!studentName || !String(studentName).trim()) {
    return res.status(400).json({ error: "invalid_request", message: "請輸入完整姓名。" });
  }

  const group = findGroup(step.groupKey);
  const condition = conditionForClass(className);
  const support = supportForClass(className);
  const promptSent = buildPromptText(step, level.key, condition);
  const systemInstruction = buildSystemInstruction(step, level.key, condition);
  const tsCreated = Date.now();
  const tsISO = new Date(tsCreated).toISOString();

  let aiResponse = "";
  let model = "";
  let isError = false;

  try {
    const result = await askGemini(systemInstruction, promptSent);
    aiResponse = result.text;
    model = result.model;
  } catch (err) {
    isError = true;
    aiResponse = "(AI 回覆失敗：" + (err && err.message ? err.message : "未知錯誤") + ")";
    console.error("[askGemini]", err);
  }

  const entry = {
    className: String(className),
    seatNumber: String(seatNumber),
    studentName: String(studentName).trim(),
    condition,
    conditionLabel: condition === "clue" ? "線索任務型" : "完整任務型",
    support,
    supportLabel: support === "autonomous" ? "自主式" : "引導式",
    groupTitle: group ? group.title : "",
    stepId: step.id,
    stepTitle: step.title,
    scenario: step.title,
    levelKey: level.key,
    levelStudentLabel: level.studentLabel,
    levelFormalName: level.formalName,
    promptSent,
    aiResponse,
    model,
    isError,
    tsCreated,
    tsISO
  };

  appendInteractionCache(entry);

  if (isSheetsConfigured()) {
    appendInteractionRow(entry).catch(err => {
      console.error("[Google Sheets] 寫入失敗（不影響學生端回覆）：", err.message);
    });
  }

  res.json({
    promptSent,
    aiResponse,
    isError,
    model,
    tsISO,
    sheetsConfigured: isSheetsConfigured()
  });
});

// ---------- 研究者：紀錄與匯出 ----------
app.get("/api/interactions", requireTeacher, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
  const rows = loadInteractions();
  res.json(rows.slice(-limit).reverse());
});

function csvEscape(v){
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

app.get("/api/export.csv", requireTeacher, (req, res) => {
  const rows = loadInteractions();
  const header = ["時間","班級","座號","姓名","任務目標類型條件","Prompt選擇支援","關卡","步驟","關卡目標","認知層次(學生按鈕)","認知層次(正式名稱)","送出的訊息","AI回覆","使用模型","是否錯誤"];
  const lines = [header.map(csvEscape).join(",")];
  rows.forEach(r => {
    lines.push([
      r.tsISO, r.className, r.seatNumber, r.studentName, r.conditionLabel, r.supportLabel, r.groupTitle, r.stepId, r.scenario,
      r.levelStudentLabel, r.levelFormalName, r.promptSent, r.aiResponse, r.model, r.isError ? "是" : "否"
    ].map(csvEscape).join(","));
  });
  const csv = "﻿" + lines.join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"keyclue_interactions.csv\"");
  res.send(csv);
});

app.get("/api/status", (req, res) => {
  res.json({
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    sheetsConfigured: isSheetsConfigured(),
    teacherAuthEnabled: !!TEACHER_TOKEN
  });
});

app.listen(PORT, () => {
  console.log(`鑰匙線索站後端已啟動：http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) console.warn("⚠️  尚未設定 GEMINI_API_KEY，AI 回覆功能無法使用。");
  if (!isSheetsConfigured()) console.warn("⚠️  尚未設定 Google 試算表，互動紀錄只會存在本機 data/interactions.json。");
  if (!TEACHER_TOKEN) console.warn("⚠️  尚未設定 TEACHER_TOKEN，研究者頁面目前不需密碼即可存取（僅建議本機測試時使用）。");
});
