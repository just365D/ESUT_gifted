// 本機檔案儲存：條件設定 + 互動紀錄快取（給研究者即時儀表板用，資料庫真正的長期保存是 Google 試算表）
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const LOG_FILE = path.join(DATA_DIR, "interactions.json");
const MAX_CACHED = 2000;

function ensureDataDir(){
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getConfig(){
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) return { condition: "full" };
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return { condition: "full" };
  }
}

export function setConfig(partial){
  ensureDataDir();
  const next = { ...getConfig(), ...partial, updatedAt: Date.now() };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
  return next;
}

export function loadInteractions(){
  ensureDataDir();
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  } catch {
    return [];
  }
}

export function appendInteractionCache(entry){
  ensureDataDir();
  const rows = loadInteractions();
  rows.push(entry);
  const trimmed = rows.length > MAX_CACHED ? rows.slice(rows.length - MAX_CACHED) : rows;
  fs.writeFileSync(LOG_FILE, JSON.stringify(trimmed, null, 2));
  return trimmed;
}
