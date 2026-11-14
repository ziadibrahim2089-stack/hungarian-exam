// Small DOM helpers + shared widgets (Hungarian text, answer boxes, choices).
import { stripAccents, translit } from './lib/text.js';

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };

let toastTimer;
export function toast(text, ms = 2600) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------- highlighting inside Hungarian questions ----------
const DW = {
  melyik: 'd-melyik', mely: 'd-melyik', melyek: 'd-melyik', ki: 'd-ki', mi: 'd-mi', mit: 'd-mi', mik: 'd-mi', nem: 'd-nem', nincs: 'd-nem',
  alabbi: 'd-alabbi', alabbiak: 'd-alabbi', kozul: 'd-alabbi', irta: 'd-irta', szerezte: 'd-szerezte',
  zenesitette: 'd-szerezte', komponalta: 'd-szerezte', hany: 'd-hany', hanyszor: 'd-hany',
  nevezzen: 'd-nevezzen', nevezze: 'd-nevezzen', nevezz: 'd-nevezzen', sorolja: 'd-nevezzen', soroljon: 'd-nevezzen', irjon: 'd-nevezzen',
  igaz: 'd-igaz', hamis: 'd-igaz', mikor: 'd-mikor', evben: 'd-mikor', szazadban: 'd-szazad', evszazadban: 'd-szazad',
  milyen: 'd-milyen', egeszitse: 'd-egeszitse', toltse: 'd-egeszitse', kiegeszitendo: 'd-egeszitse',
  jelent: 'd-jelent', jelentenek: 'd-jelent', jelkepez: 'd-jelent', kik: 'd-kik', kinek: 'd-kik', kiknek: 'd-kik',
  kit: 'd-kit', hol: 'd-hol', hova: 'd-hova', varosban: 'd-hova', helyes: 'd-helyes', helytelen: 'd-helyes',
  mennyi: 'd-mennyi', miota: 'd-miota', valassza: 'd-valassza', miert: 'd-miert', jelenti: 'd-jelent',
};
let KW = [];
let DECODER = {};
export function setGlossary(keywords, decoder) {
  KW = keywords.map((k) => ({ ...k, stems: k.stem.map((s) => s.trim()) }));
  DECODER = Object.fromEntries(decoder.map((d) => [d.id, d]));
}
const bare = (w) => stripAccents(w).toLowerCase().replace(/[^a-z0-9-]/g, '');

function classify(word, next) {
  const w = bare(word);
  if (!w) return null;
  if (DW[w]) return { cls: 'dw', ar: DECODER[DW[w]]?.ar, hu: DECODER[DW[w]]?.hu, tip: DECODER[DW[w]]?.tip_ar, hook: DECODER[DW[w]]?.hooks?.[0], stem: DW[w] };
  if (/[a-z]-e$/.test(w)) return { cls: 'dw', ar: DECODER['d-e']?.ar, hu: '…-e?', tip: DECODER['d-e']?.tip_ar, hook: DECODER['d-e']?.hooks?.[0], stem: 'd-e' };
  const pair = next ? `${w} ${bare(next)}` : null;
  const base = w.split('-')[0];                 // Kárpát-medencét → karpat, 1848-as → 1848
  for (const k of KW) {
    for (const s of k.stems) {
      let hit;
      if (s.includes(' ')) hit = pair && pair.startsWith(s);
      else if (s.endsWith('$')) hit = w === s.slice(0, -1) || base === s.slice(0, -1); // only this exact word (tó ≠ törvény)
      else if (/^\d+$/.test(s)) hit = base === s; // years: exactly that number
      else {
        const room = s.length >= 6 ? 12 : 6;       // long stems: Hungarian compounds (vármegyerendszer, népzenekutatás)
        hit = (w.startsWith(s) && w.length - s.length <= room) || (base.startsWith(s) && base.length - s.length <= room);
      }
      if (hit) return { cls: 'kw', ar: k.ar, hu: k.hu, hook: k.hook, two: s.includes(' '), stem: s };
    }
  }
  return null;
}

// Every coloured word of a question, in order: blue question words and orange topic words,
// as written there: [{word, cls: 'dw'|'kw', ar, tip, key}] (one entry per word kind).
export function questionWords(text) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < words.length; i++) {
    const c = classify(words[i], words[i + 1]);
    if (!c) continue;
    const word = (c.two ? `${words[i]} ${words[i + 1]}` : words[i]).replace(/^[„“"'(«]+|[”"'»),.;:!?…]+$/g, '');
    const key = `${c.cls}|${c.hu}|${c.stem || ''}`;
    if (c.two) i++;
    if (!word || seen.has(key)) continue;
    seen.add(key);
    out.push({ word, cls: c.cls, ar: c.ar || '', tip: c.tip || '', hook: c.hook || '', key });
  }
  return out;
}

// The topic keywords (orange) of a Hungarian text, as written there: [{word, ar, key}].
export function keywordsIn(text) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const c = classify(words[i], words[i + 1]);
    if (!c || c.cls !== 'kw') continue;
    const word = (c.two ? `${words[i]} ${words[i + 1]}` : words[i]).replace(/^[„“"'(«]+|[”"'»),.;:!?…]+$/g, '');
    out.push({ word, ar: c.ar, key: `${c.hu}|${c.stem}` });
    if (c.two) i++;
  }
  return out;
}

// Tap a coloured word → a card with the word, how to say it, its meaning, what it tells you
// and its memory hook (the question's own hook when the word has none, e.g. names and years).
let wordSheetEl = null;
export function showWord({ word, cls, ar, tip, hook, ctxHook }) {
  wordSheetEl?.remove();
  const close = () => { wordSheetEl?.remove(); wordSheetEl = null; };
  const clean = String(word).replace(/^[„“"'(«]+|[”"'»),.;:!?…]+$/g, '');
  const ownHook = hook || '';
  wordSheetEl = h('div', { class: 'word-sheet', role: 'dialog', 'aria-label': clean, onclick: (e) => { if (e.target === wordSheetEl) close(); } },
    h('div', { class: `word-card ${cls}` },
      h('button', { class: 'word-close', type: 'button', 'aria-label': 'اقفل', onclick: close }, '✕'),
      h('div', { class: 'word-kind' }, cls === 'red' ? '🔴 كلمة حمرا: دوّر عليها في الامتحان' : cls === 'dw' ? '🔵 كلمة سؤال: بتقولك نوع الإجابة' : '🟠 كلمة موضوع: بتقولك السؤال عن إيه'),
      h('div', { class: 'word-head' }, h('bdi', { class: 'hu word-hu' }, clean), speakBtn(clean)),
      /^\d/.test(clean) ? null : h('div', { class: 'word-pron' }, 'بتتنطق: ', h('b', {}, translit(clean.replace(/[^A-Za-zÀ-ž\- ]/g, '')))),
      h('div', { class: 'word-ar' }, mixed(`= ${ar || ''}`)),
      tip ? h('div', { class: 'word-tip' }, mixed(tip)) : null,
      ownHook ? h('div', { class: 'hook' }, '💡 ', mixed(ownHook))
        : ctxHook ? h('div', { class: 'hook' }, '💡 hook السؤال: ', mixed(ctxHook)) : null));
  document.body.append(wordSheetEl);
}

// A question with ONLY its red words marked: the words to look for in the exam (q.red, exactly as
// written in the question). Tap a red word → its meaning and the hint to remember it.
export function redHu(text, reds = [], { tap = true, cls = '' } = {}) {
  const span = h('span', { class: `hu ${cls}`, dir: 'ltr', lang: 'hu' });
  const s = String(text);
  const low = s.toLowerCase();
  const marks = [];
  for (const r of [...reds].sort((a, b) => b.t.length - a.t.length)) {
    const needle = r.t.toLowerCase();
    for (let i = low.indexOf(needle); i >= 0; i = low.indexOf(needle, i + needle.length)) {
      const end = i + needle.length;
      if (!marks.some((m) => i < m.end && end > m.start)) marks.push({ start: i, end, r });
    }
  }
  marks.sort((a, b) => a.start - b.start);
  let pos = 0;
  for (const m of marks) {
    if (m.start > pos) span.append(s.slice(pos, m.start));
    const piece = s.slice(m.start, m.end);
    span.append(tap
      ? h('button', { class: 'red-word', type: 'button', onclick: (e) => { e.stopPropagation(); showWord({ word: piece, cls: 'red', ar: m.r.ar, hook: m.r.hint }); } }, piece)
      : h('mark', { class: 'red-word' }, piece));
    pos = m.end;
  }
  if (pos < s.length) span.append(s.slice(pos));
  return span;
}

// Hungarian text (LTR inside the Arabic page). highlight=true colors decoder words (blue)
// and topic keywords (orange); tap one to see its meaning and hook (hook = the question's hook,
// used for words that have none of their own).
export function hu(text, { highlight = false, cls = '', hook = '' } = {}) {
  const span = h('span', { class: `hu ${cls}`, dir: 'ltr', lang: 'hu' });
  if (!highlight) { span.textContent = text; return span; }
  const parts = String(text).split(/(\s+)/);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (/^\s+$/.test(p) || !p) { span.append(p); continue; }
    const c = classify(p, parts[i + 2]);
    if (!c) { span.append(p); continue; }
    const label = c.two ? `${p} ${parts[i + 2]}` : p;
    if (c.two) i += 2;
    span.append(h('button', {
      class: `tag ${c.cls}`, type: 'button',
      onclick: (e) => { e.stopPropagation(); showWord({ word: label, cls: c.cls, ar: c.ar, tip: c.tip, hook: c.hook, ctxHook: hook }); },
    }, label));
  }
  return span;
}

export const stars = (n) => h('span', { class: 'stars', title: `${n} نجوم` }, '⭐'.repeat(n));

// Arabic text with Hungarian words inside: every Latin run is isolated (<bdi>) so the
// word order stays right in the right-to-left sentence.
const LATIN_RUN = /[A-Za-zÀ-ž0-9][A-Za-zÀ-ž0-9.,'’\-–/ &]*[A-Za-zÀ-ž0-9.]|[A-Za-zÀ-ž]/g;   // & keeps «Fair & Lovely» in one piece
export function mixed(text) {
  const s = String(text ?? '');
  const span = h('span', {});
  let last = 0;
  for (const m of s.matchAll(LATIN_RUN)) {
    if (!/[A-Za-zÀ-ž]/.test(m[0])) continue;   // plain numbers stay in the Arabic flow
    span.append(s.slice(last, m.index), h('bdi', { class: 'hu' }, m[0]));
    last = m.index + m[0].length;
  }
  span.append(s.slice(last));
  return span;
}

// ---------- answer widgets ----------
const FIELD_ATTRS = { autocorrect: 'off', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', dir: 'ltr', lang: 'hu' };

export function answerField({ placeholder = 'اكتب هنا بالقلم ✍️', multiline = false, label } = {}) {
  const field = h(multiline ? 'textarea' : 'input', {
    class: `answer ${multiline ? 'multi' : ''}`, placeholder, ...FIELD_ATTRS, rows: multiline ? 2 : null, type: multiline ? null : 'text',
    'aria-label': label || placeholder,
  });
  const read = h('div', { class: 'read' });
  const update = () => {
    const v = field.value.trim();
    read.textContent = v ? 'الآيباد قرأ: ' : '';
    if (v) read.append(h('b', { dir: 'ltr', lang: 'hu' }, `«${v}»`));
  };
  field.addEventListener('input', update);
  const numeric = /^\d+\.$/.test(label || '');
  const wrap = h('label', { class: 'field' }, label ? h('span', { class: `field-label ${numeric ? 'num' : ''}`, dir: numeric ? 'ltr' : null }, label) : null, field, read);
  return { el: wrap, field, value: () => field.value, set(v) { field.value = v; update(); }, focus: () => field.focus() };
}

export function choices(options, { multi = false, onChange, initial = [] } = {}) {
  const sel = new Set(initial);
  const list = h('div', { class: `choices ${multi ? 'multi' : ''}`, role: multi ? 'group' : 'radiogroup' });
  const btns = options.map((text, i) => {
    const b = h('button', {
      type: 'button', class: 'choice', role: multi ? 'checkbox' : 'radio', 'aria-checked': 'false',
      onclick: () => {
        if (multi) { sel.has(i) ? sel.delete(i) : sel.add(i); } else { sel.clear(); sel.add(i); }
        btns.forEach((x, j) => { x.classList.toggle('on', sel.has(j)); x.setAttribute('aria-checked', String(sel.has(j))); });
        onChange?.([...sel]);
      },
    }, h('span', { class: 'ring', 'aria-hidden': 'true' }), hu(text));
    return b;
  });
  list.append(...btns);
  btns.forEach((x, j) => { x.classList.toggle('on', sel.has(j)); x.setAttribute('aria-checked', String(sel.has(j))); });
  return { el: list, value: () => [...sel], buttons: btns };
}

// Builds the answer area for any real question.
// Returns {el, input(), raw(), optionSet, setIndex, kind}. `raw()` / `initial` = what to save & restore.
export function answerArea(q, { rng = Math.random, setIndex, initial } = {}) {
  if (q.type === 'mc') {
    const si = setIndex ?? Math.floor(rng() * q.option_sets.length);
    const set = q.option_sets[si];
    const c = choices(set.opts, { multi: !!q.multi, initial: Array.isArray(initial) ? initial : [] });
    return { el: h('div', {}, q.multi ? h('div', { class: 'hint' }, 'ممكن أكتر من اختيار') : null, c.el), input: c.value, raw: c.value, optionSet: set, setIndex: si, kind: 'mc' };
  }
  if (q.type === 'tf' || q.type === 'yn') {
    const opts = q.type === 'tf' ? ['Igaz', 'Hamis'] : ['Igen', 'Nem'];
    const c = choices(opts, { initial: Array.isArray(initial) ? initial : [] });
    return { el: c.el, input: () => (c.value().length ? opts[c.value()[0]] : ''), raw: c.value, kind: 'tap' };
  }
  const restore = (fields) => { if (Array.isArray(initial)) fields.forEach((f, i) => initial[i] && f.set(initial[i])); return fields; };
  if (q.type === 'fill') {
    const fields = restore(q.blanks.map((_, i) => answerField({ label: `فراغ ${i + 1}` })));
    return { el: h('div', { class: 'fields' }, fields.map((f) => f.el)), input: () => fields.map((f) => f.value()), raw: () => fields.map((f) => f.value()), fields, kind: 'write' };
  }
  if (q.type === 'list') {
    const n = q.need || q.items.length;
    const fields = restore(Array.from({ length: n }, (_, i) => answerField({ label: `${i + 1}.` })));
    return { el: h('div', { class: 'fields' }, fields.map((f) => f.el)), input: () => fields.map((f) => f.value()).filter((s) => s.trim()).join(', '), raw: () => fields.map((f) => f.value()), fields, kind: 'write' };
  }
  const f = restore([answerField({ multiline: q.type === 'keywords' || (q.answer_hu || '').length > 28 })])[0];
  return { el: f.el, input: f.value, raw: () => [f.value()], fields: [f], kind: 'write' };
}

export function verdictBadge(r) {
  const cls = { right: 'ok', almost: 'mid', wrong: 'bad', empty: 'bad' }[r.verdict];
  return h('div', { class: `verdict ${cls}` }, r.msg);
}

// Shows the correct answer with accented letters colored, so the hand learns them.
// 🔊 hear a Hungarian answer. speak() runs right inside the tap (iPhone/iPad allow sound only then).
export function speakBtn(text) {
  const synth = window.speechSynthesis;
  if (!synth || !text) return null;
  const say = String(text).replace(/\(.*?\)/g, ' ').replace(/[·;]/g, ',').replace(/\s+/g, ' ').trim();
  return h('button', { class: 'speak', type: 'button', 'aria-label': 'اسمع النطق', title: 'اسمع النطق', onclick: (e) => {
    e.stopPropagation();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
    const u = new SpeechSynthesisUtterance(say);
    const v = synth.getVoices().find((x) => x.lang?.toLowerCase().startsWith('hu'));
    if (v) u.voice = v;
    u.lang = 'hu-HU';
    u.rate = 0.8;
    speakBtn.last = u;                 // keep a reference until it is spoken
    if (synth.speaking || synth.pending) { synth.cancel(); setTimeout(() => synth.speak(u), 80); } else synth.speak(u);
  } }, '🔊');
}

export function accentWord(text) {
  const span = h('span', { class: 'hu big-answer', dir: 'ltr', lang: 'hu' });
  for (const ch of String(text)) {
    if (/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(ch)) span.append(h('span', { class: 'acc' }, ch));
    else span.append(ch);
  }
  return span;
}
