// Answer checker. ONE entry point: checkAnswer(question, input).
// Pure functions, no DOM — unit-tested in tests/match.test.mjs.
//
// Rules (from the spec):
//  - capitals, extra spaces, dots and ACCENTS never decide right/wrong (ő = ö = o …)
//  - numbers and years must be exact (1848 ≠ 1849)
//  - names: family name alone is enough (Petőfi = Petőfi Sándor) unless q.full
//  - dates: március 15 · márc. 15 · 03.15 · 15 március · 1848. március 15.
//  - lists: any order (unless q.ordered), partial credit per item
//  - answers_ok = other accepted forms
//  - one wrong letter in a word of 5+ letters = "almost" (yellow)
//  - a missing accent is only a warning (notes), never a fail
import { stripAccents, norm, canon } from './text.js';

export function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// ---------- numbers ----------
const UNITS = { egy: 1, ket: 2, ketto: 2, harom: 3, negy: 4, ot: 5, hat: 6, het: 7, nyolc: 8, kilenc: 9 };
const TENS = Object.entries({ kilencven: 90, nyolcvan: 80, harminc: 30, negyven: 40, huszon: 20, hetven: 70,
  hatvan: 60, otven: 50, tizen: 10, husz: 20, tiz: 10 });

export function huNumber(word) {
  let w = stripAccents(word).toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return null;
  let total = 0;
  const si = w.indexOf('szaz');
  if (si >= 0) {
    const pre = w.slice(0, si);
    if (pre && !UNITS[pre]) return null;
    total += (pre ? UNITS[pre] : 1) * 100;
    w = w.slice(si + 4);
  }
  for (const [k, v] of TENS) if (w.startsWith(k)) { total += v; w = w.slice(k.length); break; }
  if (w) {
    if (UNITS[w] == null) return null;
    total += UNITS[w];
  }
  return total || null;
}

export function numbersIn(raw) {
  const s = String(raw ?? '');
  const nums = [...s.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => parseFloat(m[0].replace(',', '.')));
  if (nums.length) return nums;
  return s.split(/\s+/).map(huNumber).filter((n) => n != null);
}

// ---------- dates ----------
const MONTHS = [['januar', 'jan'], ['februar', 'febr', 'feb'], ['marcius', 'marc', 'mar'], ['aprilis', 'apr'],
  ['majus', 'maj'], ['junius', 'jun'], ['julius', 'jul'], ['augusztus', 'aug'],
  ['szeptember', 'szept', 'szep'], ['oktober', 'okt'], ['november', 'nov'], ['december', 'dec']];

export function parseDate(raw) {
  const t = stripAccents(raw).toLowerCase();
  let y = null, m = null, d = null;
  const ym = t.match(/(?:^|\D)(1\d{3}|20\d{2})(?!\d)/);
  if (ym) y = +ym[1];
  outer: for (let i = 0; i < 12; i++) {
    for (const name of MONTHS[i]) if (new RegExp(`(?:^|[^a-z])${name}`).test(t)) { m = i + 1; break outer; }
  }
  if (m) {
    const names = MONTHS[m - 1].join('|');
    const after = t.match(new RegExp(`(?:${names})[a-z]*\\.?\\s*(\\d{1,2})(?!\\d)`));
    const before = t.match(new RegExp(`(?:^|\\D)(\\d{1,2})\\.?\\s*(?:${names})`));
    const hit = after || before;
    if (hit) d = +hit[1];
  } else {
    const rest = t.replace(/(1\d{3}|20\d{2})\s*[.\-/]?/, ' ');
    const n = rest.match(/(\d{1,2})\s*[.\-/]\s*(\d{1,2})/);
    if (n) { m = +n[1]; d = +n[2]; }
  }
  return { y, m, d };
}

// ---------- centuries ----------
const ROMAN = { i: 1, v: 5, x: 10, l: 50 };
function roman(tok) {
  if (!/^[ivxl]+$/.test(tok)) return null;
  let total = 0;
  for (let i = 0; i < tok.length; i++) {
    const v = ROMAN[tok[i]], nx = ROMAN[tok[i + 1]] || 0;
    total += v < nx ? -v : v;
  }
  return total > 0 && total <= 21 ? total : null;
}
export function centuriesIn(raw) {
  const out = [];
  for (const tok of norm(raw).split(' ')) {
    if (/^\d{1,2}$/.test(tok) && +tok >= 1 && +tok <= 21) out.push(+tok);
    else if (/^\d{4}$/.test(tok)) out.push({ year: +tok });
    else { const r = roman(tok); if (r) out.push(r); }
  }
  return out;
}

// ---------- accents ----------
const ACUTE = 'áéíóú', UML = 'öü', DBL = 'őű';
function accentMsg(want, got) {
  const base = stripAccents(want);
  if (stripAccents(got) !== base) return null;
  if (DBL.includes(want) && UML.includes(got)) return `الـ ${got} لازم تبقى ${want} (شَرطتين مش نقطتين)`;
  if (UML.includes(want) && DBL.includes(got)) return `الـ ${got} لازم تبقى ${want} (نقطتين مش شَرطتين)`;
  if (want === base) return `الـ ${got} مش محتاجة علامة: ${want}`;
  if (ACUTE.includes(want)) return `الـ ${base} محتاجة شَرطة: ${want}`;
  if (UML.includes(want)) return `الـ ${base} محتاجة نقطتين: ${want}`;
  if (DBL.includes(want)) return `الـ ${base} محتاجة شَرطتين: ${want}`;
  return null;
}

// Compares the user's raw text with the accepted form, word by word.
export function accentNotes(userRaw, formRaw) {
  const words = (s) => String(s ?? '').normalize('NFC').split(/[^A-Za-zÀ-ž]+/).filter(Boolean);
  const uw = words(userRaw);
  const notes = [];
  for (const fw of words(formRaw)) {
    const key = stripAccents(fw).toLowerCase();
    const u = uw.find((w) => stripAccents(w).toLowerCase() === key);
    if (!u) continue;
    const a = [...fw.toLowerCase()], b = [...u.toLowerCase()];
    if (a.length !== b.length) continue;
    a.forEach((want, i) => {
      if (want !== b[i]) {
        const msg = accentMsg(want, b[i]);
        if (msg) notes.push({ word: fw, pos: i, want, got: b[i], msg: `${msg} في ${fw}` });
      }
    });
  }
  return notes;
}

// ---------- single answer ----------
const TITLES = new Set(['szent', 'dr', 'grof', 'i', 'ii', 'iii', 'iv', 'kiraly']);
const tokens = (s) => canon(s).split(' ').filter(Boolean);

// Hungarian case endings (accent-free): Országház = Országházban, nemesek = nemeseket.
const SUFFIX = /^(t|ot|et|at|n|on|en|ban|ben|ba|be|nak|nek|ra|re|rol|bol|tol|hoz|hez|val|vel|ig|ert|kent|ja|je|jat|jet|ai|ei|i|k|ok|ek|ak|nal|nel|ul|jan|jen|it|ait|eit)$/;
export function tokEq(a, b) {
  if (a === b) return true;
  if (b.length >= 4 && a.startsWith(b) && SUFFIX.test(a.slice(b.length))) return true;
  if (a.length >= 4 && b.startsWith(a) && SUFFIX.test(b.slice(a.length))) return true;
  return false;
}

function containsTokens(hay, needle) {
  const h = hay.split(' '), n = needle.split(' ');
  if (!n.length || !n[0]) return false;
  for (let i = 0; i + n.length <= h.length; i++) {
    if (n.every((t, j) => tokEq(h[i + j], t))) return true;
  }
  return false;
}

function fuzzyTokens(u, f) {
  const a = u.split(' '), b = f.split(' ');
  if (a.length !== b.length) return false;
  let fuzzy = 0;
  for (let i = 0; i < a.length; i++) {
    if (tokEq(a[i], b[i])) continue;
    if (b[i].length >= 5 && lev(a[i], b[i]) <= 1) fuzzy++;
    else return false;
  }
  return fuzzy > 0;
}

function familyName(form) {
  const t = tokens(form).filter((x) => !TITLES.has(x));
  if (t.length < 2 || /\b(van|von)\b/.test(canon(form))) return null;
  return t[0];
}

// Returns {v:'right'|'almost'|'wrong'|'empty', form?, why?}
export function matchOpen(raw, forms, q = {}) {
  const u = canon(raw);
  if (!u) return { v: 'empty' };
  const kind = q.kind;

  if (kind === 'num') {
    const want = numbersIn(forms[0])[0];
    const got = numbersIn(raw);
    if (!got.length) return { v: 'wrong' };
    const millio = /milli/i.test(forms[0]);
    const ok = got.some((g) => Math.abs(g - want) < 1e-9 || (millio && Math.abs(g - want * 1e6) < 1));
    return ok ? { v: 'right', form: forms[0] } : { v: 'wrong', why: 'num' };
  }
  if (kind === 'year') {
    const want = numbersIn(forms[0])[0];
    return numbersIn(raw).some((g) => g === want) ? { v: 'right', form: forms[0] } : { v: 'wrong', why: 'num' };
  }
  if (kind === 'date') {
    const want = q.date || parseDate(forms[0]);
    const got = parseDate(raw);
    const md = got.m === want.m && got.d === want.d;
    const yOk = !want.y || got.y === want.y;
    if (md && yOk) return { v: 'right', form: forms[0] };
    if (want.y && got.y === want.y && got.m == null) return { v: 'almost', form: forms[0], why: 'year-only' };
    if (md && want.y && got.y == null) return { v: 'almost', form: forms[0], why: 'no-year' };
    return { v: 'wrong' };
  }
  if (kind === 'century') {
    const want = centuriesIn(forms[0]).filter((x) => typeof x === 'number');
    const got = centuriesIn(raw);
    const nums = got.filter((x) => typeof x === 'number');
    if (want.length && want.every((w) => nums.includes(w))) return { v: 'right', form: forms[0] };
    if (nums.length && want.some((w) => nums.includes(w))) return { v: 'almost', form: forms[0], why: 'half' };
    const years = got.filter((x) => typeof x === 'object');
    if (years.some((y) => want.includes(Math.floor((y.year - 1) / 100) + 1))) {
      return { v: 'almost', form: forms[0], why: 'year-not-century' };
    }
    return { v: 'wrong' };
  }

  for (const f of forms) if (u === canon(f)) return { v: 'right', form: f };
  for (const f of forms) if (containsTokens(u, canon(f))) return { v: 'right', form: f };
  if (q.match === 'contains') {
    for (const f of forms) if (canon(f).includes(u) && u.length >= 4) return { v: 'right', form: f };
  }
  if (kind === 'name' && !q.full) {
    for (const f of forms) {
      const fam = familyName(f);
      if (fam && (u === fam || u.split(' ')[0] === fam)) return { v: 'right', form: f };
      if (fam && fam.length >= 5 && lev(u, fam) <= 1) return { v: 'almost', form: f, why: 'typo' };
    }
  }
  for (const f of forms) if (fuzzyTokens(u, canon(f))) return { v: 'almost', form: f, why: 'typo' };
  return { v: 'wrong' };
}

// ---------- lists ----------
export function splitParts(raw) {
  return String(raw ?? '')
    .split(/\n|,|;|\/|\s+és\s+|\s+es\s+|\s+meg\s+|\s+[–-]\s+|\s+=\s+|\s+:\s*|\+/i)
    .map((s) => s.trim()).filter(Boolean);
}

function matchItems(raw, items, q, { containsOnly = false } = {}) {
  const textParts = Array.isArray(raw) ? raw.filter((s) => String(s).trim()) : splitParts(raw);
  const whole = canon(Array.isArray(raw) ? raw.join(' ') : raw);
  const used = new Set();
  return items.map((forms) => {
    if (!containsOnly) {
      for (let i = 0; i < textParts.length; i++) {
        if (used.has(i)) continue;
        const r = matchOpen(textParts[i], forms, { kind: q.kind === 'name' ? 'name' : undefined });
        if (r.v === 'right' || r.v === 'almost') { used.add(i); return { ...r, part: textParts[i], forms }; }
      }
    }
    for (const f of forms) {
      if (containsTokens(whole, canon(f))) return { v: 'right', form: f, part: f, forms, at: whole.indexOf(canon(f)) };
    }
    return { v: 'wrong', forms };
  });
}

// ---------- main ----------
export function checkAnswer(q, input, opts = {}) {
  const type = q.type || 'open';
  const read = Array.isArray(input) ? input.join(' · ') : String(input ?? '');

  if (type === 'mc') {
    const set = opts.optionSet || q.option_sets?.[0];
    const sel = [...new Set(input || [])];
    const correct = set?.correct || [];
    if (!sel.length) return result('empty', 0, { read: '' });
    const hits = sel.filter((i) => correct.includes(i)).length;
    const wrong = sel.length - hits;
    const exact = hits === correct.length && !wrong;
    const score = exact ? 1 : Math.max(0, (hits - wrong) / correct.length);
    return result(exact ? 'right' : score > 0 ? 'almost' : 'wrong', score, {
      read: sel.map((i) => set.opts[i]).join(' · '),
    });
  }

  if (type === 'tf' || type === 'yn') {
    const want = canon(q.answer_hu);
    const got = canon(read);
    if (!got) return result('empty', 0, { read });
    // judge by the first word: "Nincs halálbüntetés" = Nem, "Igen, egyszer" = Igen
    const yesNo = { igen: 'igen', igaz: 'igen', van: 'igen', nem: 'nem', nincs: 'nem', hamis: 'nem' };
    const first = (s) => yesNo[s.split(' ')[0]] ?? s;
    const ok = first(got) === first(want);
    return result(ok ? 'right' : 'wrong', ok ? 1 : 0, { read });
  }

  if (type === 'list' || type === 'keywords') {
    if (!read.trim()) return result('empty', 0, { read });
    const items = matchItems(input, q.items, q, { containsOnly: type === 'keywords' });
    const found = items.filter((r) => r.v !== 'wrong');
    const need = q.need || q.items.length;
    let score = Math.min(found.length, need) / need;
    let verdict = found.length >= need ? (found.some((r) => r.v === 'almost') ? 'almost' : 'right')
      : found.length ? 'almost' : 'wrong';
    let why;
    if (q.ordered && found.length >= need) {
      const order = items.map((r) => (r.v === 'wrong' ? -1 : canon(read).indexOf(canon(r.part))));
      const sorted = order.every((p, i) => i === 0 || p > order[i - 1]);
      if (!sorted) { verdict = 'almost'; score = 0.5; why = 'order'; }
    }
    const notes = found.flatMap((r) => accentNotes(r.part, r.form));
    return result(verdict, score, { read, notes, items: items.map((r) => ({ label: r.forms[0], ok: r.v !== 'wrong', v: r.v })), found: found.length, need, why });
  }

  if (type === 'fill') {
    const parts = Array.isArray(input) ? input : splitParts(input);
    if (!parts.some((p) => String(p).trim())) return result('empty', 0, { read });
    const res = q.blanks.map((forms, i) => ({ ...matchOpen(parts[i] ?? '', forms, {}), part: parts[i] ?? '', forms }));
    const pts = res.reduce((s, r) => s + (r.v === 'right' ? 1 : r.v === 'almost' ? 0.75 : 0), 0);
    const score = pts / q.blanks.length;
    const verdict = res.every((r) => r.v === 'right') ? 'right' : pts > 0 ? 'almost' : 'wrong';
    const notes = res.filter((r) => r.form).flatMap((r) => accentNotes(r.part, r.form));
    return result(verdict, score, { read, notes, items: res.map((r) => ({ label: r.forms[0], ok: r.v !== 'wrong', v: r.v })), found: res.filter((r) => r.v !== 'wrong').length, need: q.blanks.length });
  }

  // open
  const forms = [q.answer_hu, ...(q.answers_ok || [])].filter(Boolean);
  const r = matchOpen(read, forms, q);
  if (r.v === 'empty') return result('empty', 0, { read });
  const notes = r.form ? accentNotes(read, r.form) : [];
  return result(r.v, r.v === 'right' ? 1 : r.v === 'almost' ? 0.75 : 0, { read, notes, why: r.why, form: r.form });
}

function result(verdict, score, extra) {
  const msg = {
    right: extra.notes?.length ? `✅ صح، بس ${extra.notes[0].msg}` : '✅ صح!',
    almost: extra.why === 'order' ? '🟡 الكلمات صح بس الترتيب غلط (من فوق لتحت)'
      : extra.why === 'year-only' ? '🟡 السنة صح — ناقص الشهر واليوم'
      : extra.why === 'no-year' ? '🟡 اليوم والشهر صح — ناقص السنة'
      : extra.why === 'year-not-century' ? '🟡 دي سنة — المطلوب القرن (század)'
      : extra.need && extra.found < extra.need ? `🟡 جبت ${extra.found} من ${extra.need}`
      : '🟡 تقريباً صح — حرف واحد غلط',
    wrong: '❌ لأ',
    empty: 'مكتبتش حاجة ✍️',
  }[verdict];
  return { verdict, score, msg, notes: [], ...extra };
}
