// Progress in localStorage (+ export/import as a JSON file for backup).
// Every access is wrapped: private mode or blocked storage must never break the app.
import { dayNum, isoFromDay } from './srs.js';

const KEY = 'hkv-progress-v1';

export function fresh() {
  return {
    v: 1,
    settings: { examDate: null, startDate: isoFromDay(dayNum()), minutes: 15, daysPerWeek: 6, setupDone: false },
    cards: {},          // id -> {box, due, seen, lapses, good, last, added}
    days: {},           // dayNum -> {rev, fresh:[ids], quiz:[{id,v}], write:[ids], done}
    hookPick: {}, hookOwn: {}, hookDown: {},
    mocks: [],          // {at, day, paper, total, pass, byTopic:{t:[got,max]}}
    writeLog: {},       // word -> last day it was drilled by hand
    session: null,      // unfinished session (resumes the same day)
    taught: {},         // question id -> day it was taught (a lesson can be split over days)
    reviewed: {},       // lesson n -> [days] it was studied again (the review days)
    reviewStart: null,  // first review day (set once every question is learned)
  };
}

function migrate(s) {
  const f = fresh();
  return { ...f, ...s, settings: { ...f.settings, ...(s.settings || {}) } };
}

let memory = null; // fallback when storage is unavailable

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch { /* storage blocked → memory only */ }
  return memory || (memory = fresh());
}

export function save(state) {
  memory = state;
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}

export function exportText(state) {
  return JSON.stringify({ app: 'hungarian-culture-exam', exported: new Date().toISOString(), state }, null, 1);
}

export function importText(text) {
  const obj = JSON.parse(text);
  const state = obj?.state ?? obj;
  if (!state || typeof state !== 'object' || !state.cards || !state.settings) throw new Error('bad file');
  return migrate(state);
}

export function resetAll() {
  memory = fresh();
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return memory;
}
