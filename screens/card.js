// Study cards: answer FAMILY (one fact → its real questions) and decoder (answer type).
// Shared by the session, the question bank and the decoder screen.
import { h, hu, clear, toast, stars, accentWord, mixed, keywordsIn, speakBtn, questionWords, redHu } from '../ui.js';
import { translit } from '../lib/text.js';

export function chips(app, card, label) {
  const topic = card.kind === 'decoder' ? h('span', { class: 'chip' }, '🔑 نوع الإجابة')
    : card.topic === 0 ? h('span', { class: 'chip t0' }, '🆓 قواعد')
      : h('span', { class: `chip t${card.topic}` }, `${card.topic} · ${app.topicName(card.topic)}`);
  return h('div', { class: 'chips' },
    label ? h('span', { class: 'chip strong' }, label) : null,
    topic,
    card.kind === 'family' ? h('span', { class: 'chip soft' }, `${card.q.length} ${card.q.length === 1 ? 'سؤال حقيقي' : 'أسئلة حقيقية'}`) : null,
    card.kind === 'family' && card.papers ? h('span', { class: 'chip soft' }, `في ${card.papers} من 16 ورقة`) : null);
}

// FRONT. New family: its title + the first real question. Review: one real question (rotating).
export function front(app, card, { label, qid, isNew } = {}) {
  if (card.kind === 'decoder') {
    return h('div', { class: 'face front' }, chips(app, card, label),
      h('div', { class: 'decoder-word' }, hu(card.hu)),
      h('div', { class: 'example' }, h('span', { class: 'muted' }, 'في سؤال حقيقي: '), hu(card.example, { highlight: true })),
      h('div', { class: 'muted small' }, 'الكلمة دي بتقولك نوع الإجابة اللي تكتبها. فاكر؟'));
  }
  const q = app.qById[qid || card.q[0]];
  if (isNew) {
    return h('div', { class: 'face front' }, chips(app, card, label),
      h('h2', { class: 'fam-title' }, card.title_ar), h('div', { class: 'fam-hu' }, hu(card.title_hu)),
      h('div', { class: 'muted' }, 'معلومة واحدة بتجاوب على كل الأسئلة دي من الامتحانات الحقيقية. أول سؤال:'),
      h('div', { class: 'question' }, hu(q.hu, { highlight: true })), timesLine(q));
  }
  return h('div', { class: 'face front' }, chips(app, card, label),
    h('div', { class: 'question' }, hu(q.hu, { highlight: true })), timesLine(q),
    h('div', { class: 'muted small' }, `من جروب: ${card.title_ar} · الأزرق = كلمة السؤال، البرتقالي = الموضوع · دوس على أي كلمة ملوّنة تشوف معناها والـ hook`));
}

// BACK. New family: the fact + ALL its real questions with answers. Review: this question's answer + the fact.
export function back(app, card, { qid, isNew, compact = false } = {}) {
  const el = h('div', { class: 'face back' });
  if (card.kind === 'decoder') {
    el.append(h('div', { class: 'meaning' }, card.ar),
      h('div', { class: 'pron' }, 'بتتنطق: ', h('b', {}, card.pron_ar)),
      h('div', { class: 'tip' }, mixed(card.tip_ar)),
      hookBox(app, card));
    return el;
  }
  if (!isNew) {   // review: the same step-by-step explanation as in the lesson, the whole fact folded away
    const q = app.qById[qid || card.q[0]];
    el.append(explainQuestion(app, q),
      h('details', { class: 'more' }, h('summary', {}, '📌 المعلومة كاملة وباقي أسئلتها'),
        h('div', { class: 'fam-sum' }, mixed(card.sum_ar)), keysTable(card), spotKeywords(app, card), hookBox(app, card),
        compact ? null : questionList(app, card), sourceLine(app, card)));
    return el;
  }
  el.append(h('div', { class: 'fam-sum' }, mixed(card.sum_ar)), keysTable(card));
  const spot = isNew || !compact ? spotKeywords(app, card) : null;
  if (spot) el.append(spot);
  el.append(hookBox(app, card));
  if (isNew || !compact) el.append(questionList(app, card, { open: isNew }));
  el.append(sourceLine(app, card));
  return el;
}

// ---------- ONE question, explained step by step (lesson, review, lesson page) ----------
const cleanWord = (w) => String(w).replace(/[^A-Za-zÀ-ž0-9\- ]/g, '');

// The coloured words of one question, taught: blue = what kind of answer, orange = the topic.
export function keywordRows(q) {
  const words = questionWords(q.hu);
  const blue = words.filter((w) => w.cls === 'dw');
  const orange = words.filter((w) => w.cls === 'kw');
  const rows = h('div', { class: 'kw-rows' });
  const pron = (w) => (/اسم شخص/.test(w.ar) || /^\d/.test(w.word) ? null : h('span', { class: 'kw-pron' }, `(${translit(cleanWord(w.word))})`));
  for (const w of blue) {
    rows.append(h('div', { class: 'kw-row dw' }, h('span', { class: 'kw-dot' }, '🔵'),
      h('bdi', { class: 'hu kw-word' }, w.word), pron(w), h('span', { class: 'kw-ar' }, `= ${w.ar}`),
      w.tip ? h('div', { class: 'kw-tip' }, mixed(w.tip)) : null,
      w.hook ? h('div', { class: 'kw-hook' }, '💡 ', mixed(w.hook)) : null));
  }
  if (!blue.length && /…|\.\.\./.test(q.hu)) {
    rows.append(h('div', { class: 'kw-row dw' }, h('span', { class: 'kw-dot' }, '🔵'), h('bdi', { class: 'hu kw-word' }, '…'),
      h('span', { class: 'kw-ar' }, '= مكان فاضي'), h('div', { class: 'kw-tip' }, '← اكتب الكلمة الناقصة')));
  } else if (!blue.length && (q.type === 'yn' || q.type === 'tf')) {
    rows.append(h('div', { class: 'kw-row dw' }, h('span', { class: 'kw-dot' }, '🔵'), h('bdi', { class: 'hu kw-word' }, '?'),
      h('span', { class: 'kw-ar' }, '= سؤال آه ولا لأ'), h('div', { class: 'kw-tip' }, mixed('← جاوب Igen (آه) أو Nem (لأ)'))));
  }
  for (const w of orange) {
    rows.append(h('div', { class: 'kw-row kw' }, h('span', { class: 'kw-dot' }, '🟠'),
      h('bdi', { class: 'hu kw-word' }, w.word), pron(w), h('span', { class: 'kw-ar' }, `= ${w.ar}`),
      w.hook ? h('div', { class: 'kw-hook' }, '💡 ', mixed(w.hook)) : null));
  }
  return rows;
}

export function answerBox(app, q) {
  return h('div', { class: 'answer-box' },
    h('div', { class: 'answer-line' }, accentWord(q.answer_hu), speakBtn(q.answer_hu)),
    q.pron_ar ? h('div', { class: 'pron' }, 'بتتنطق: ', h('b', {}, q.pron_ar)) : null,
    q.answer_ar ? h('div', { class: 'answer-ar' }, 'يعني: ', mixed(q.answer_ar)) : null,
    q.note_ar ? h('div', { class: 'note' }, '⚠️ ', mixed(q.note_ar)) : null,
    q.changed ? changedLine(q.changed) : null);
}

export function questionHook(app, q) {
  const list = q.hooks?.length ? q.hooks : [app.currentHook(app.byId[q.family])?.text].filter(Boolean);
  if (!list.length) return null;
  let i = 0;
  const text = h('div', { class: 'hook-text' }, '💡 ', mixed(list[0]));
  const box = h('div', { class: 'hook' }, text);
  if (list.length > 1) {
    box.append(h('div', { class: 'hook-actions' }, h('button', { class: 'btn small ghost', type: 'button', onclick: () => {
      i = (i + 1) % list.length; clear(text); text.append('💡 ', mixed(list[i]));
    } }, `🔁 فكرة تانية (${list.length})`)));
  }
  return box;
}

// 1 what it asks · 2 the key words · 3 the answer (+ how to say it) · 4 how to remember it
export function explainQuestion(app, q, { answer = true } = {}) {
  const step = (n, title, ...kids) => h('section', { class: 'ex-step' },
    h('div', { class: 'ex-head' }, h('span', { class: 'ex-num' }, n), h('b', {}, title)), ...kids);
  return h('div', { class: 'explain' },
    step('1', 'السؤال بيقول إيه؟', h('div', { class: 'meaning' }, mixed(q.ar))),
    step('2', 'الكلمات المفتاحية (دوّر عليها في الامتحان)', keywordRows(q)),
    answer ? step('3', 'الإجابة', answerBox(app, q)) : null,
    answer ? step('4', 'إزاي تفتكرها', questionHook(app, q)) : null);
}

// A family's real questions one by one, most asked first — tap one to see it explained.
export function questionExplainList(app, card) {
  const qs = [...card.q].map((id) => app.qById[id]).sort((a, b) => (b.freq || 0) - (a.freq || 0));
  return h('div', { class: 'q-explains' },
    h('div', { class: 'write-label' }, `الأسئلة سؤال سؤال (${qs.length}) · دوس على السؤال يتشرح`),
    ...qs.map((q, i) => h('details', { class: 'q-explain' },
      h('summary', {}, h('span', { class: 'q-num' }, String(i + 1)),
        h('span', { class: 'q-sum' }, hu(q.hu), h('span', { class: 'times-chip' }, `🔥 جه ${timesAr(q.freq || 1)}`))),
      explainQuestion(app, q))));
}

// "If you see these words in the exam, the question is from this family" — the orange
// keywords of all its real questions, as they are written there.
export function spotKeywords(app, card) {
  const seen = new Map();
  for (const id of card.q) for (const k of keywordsIn(app.qById[id].hu)) if (!seen.has(k.key)) seen.set(k.key, k);
  if (!seen.size) return null;
  return h('div', { class: 'spot' },
    h('div', { class: 'write-label' }, '🔎 لو شفت الكلمات دي في سؤال، يبقى بيسأل عن المعلومة دي:'),
    h('div', { class: 'spot-row' }, [...seen.values()].slice(0, 10).map((k) =>
      h('span', { class: 'spot-chip' }, h('bdi', { class: 'hu' }, k.word), h('span', { class: 'spot-ar' }, ` = ${k.ar}`)))));
}

export function keysTable(card) {
  return h('div', { class: 'keys' }, card.keys.map(([k, ar]) =>
    h('div', { class: 'key' }, h('div', { class: 'key-hu' }, hu(k)), h('div', { class: 'key-ar' }, mixed(ar)))));
}

// "came 4 times" in Egyptian Arabic
export const timesAr = (n) => (n === 1 ? 'مرة واحدة' : n === 2 ? 'مرتين' : n <= 10 ? `${n} مرات` : `${n} مرة`);
export const timesLine = (q) => h('div', { class: 'times' }, `🔥 السؤال ده جه ${timesAr(q.freq || 1)} في الامتحانات اللي الناس نزّلتها`);

// Every real question of a family, most asked first: how often it came, its answer, its own hook.
export function questionList(app, card, { open = false } = {}) {
  const items = [...card.q].map((id) => app.qById[id]).sort((a, b) => (b.freq || 0) - (a.freq || 0)).map((q) =>
    h('div', { class: 'fam-q' },
      h('div', { class: 'fam-q-meta' }, stars(q.priority), h('span', { class: 'times-chip' }, `🔥 جه ${timesAr(q.freq || 1)}`)),
      h('div', { class: 'fam-q-text' }, hu(q.hu, { highlight: true })),
      h('div', { class: 'fam-q-ans' }, '← ', hu(q.answer_hu, { cls: 'strong' }), speakBtn(q.answer_hu)),
      q.hooks?.[0] ? h('div', { class: 'fam-q-hook' }, '💡 ', mixed(q.hooks[0])) : null));
  return h('details', { class: 'fam-qs', open: open || null },
    h('summary', {}, `الأسئلة الحقيقية من الجروب ده (${card.q.length}) · كل سؤال جه كام مرة + الـ hook بتاعه`), ...items);
}

// How to study ONE question with a hook (shown in the lesson intro, the lesson page and the plan).
export function hookMethod({ open = false } = {}) {
  return h('details', { class: 'hook-method', open: open || null },
    h('summary', {}, '💡 إزاي تذاكر أي سؤال بالـ hook (دقيقة واحدة)'),
    h('ol', {},
      h('li', {}, 'اقرا السؤال، وبص على الكلمة الزرقا: بتقولك نوع الإجابة (مين؟ امتى؟ كام؟).'),
      h('li', {}, 'اقرا الإجابة بصوت عالي مرتين.'),
      h('li', {}, 'اقرا الـ hook 💡 واتخيّله صورة مضحكة في دماغك 5 ثواني. مش عاجبك؟ دوس 🔁 أو اكتب بتاعك ✏️ (اللي بتألفه بنفسك بيثبت أكتر).'),
      h('li', {}, 'غطّي الإجابة وقولها من دماغك وانت فاكر الصورة.'),
      h('li', {}, 'اكتبها مرة بإيدك بالعلامات.')),
    h('p', { class: 'muted small' }, 'والتطبيق بيرجّعلك نفس المعلومة بعد يوم، 3 أيام، أسبوع، أسبوعين، وشهر عشان متنساش.'));
}

const changedLine = (c) => h('div', { class: 'changed' }, '🔄 اتغير في المنهج الجديد: ',
  hu(c.old, { cls: 'old' }), ' ← ', hu(c.new, { cls: 'new' }));

export function sourceLine(app, card) {
  const pages = [...new Set(card.q.flatMap((id) => (app.qById[id].facts || []).map((f) => f.page)))].sort((a, b) => a - b).join('، ');
  return h('div', { class: 'source' }, pages ? `📄 كتيّب BFKH ص ${pages}` : '', card.freq ? ` · 📣 اتسألت ×${card.freq} في الفيسبوك` : '');
}

export function hookBox(app, card) {
  const box = h('div', { class: 'hook' });
  const draw = () => {
    clear(box);
    const cur = app.currentHook(card);
    box.append(h('div', { class: 'hook-text' }, '💡 ', cur ? mixed(cur.text) : 'لسه مفيش hook — اكتب واحد بنفسك ✍️ (اللي بتألفه بنفسك بيثبت أكتر)'));
    const row = h('div', { class: 'hook-actions' });
    if (cur && cur.more > 0) {
      row.append(h('button', { class: 'btn small ghost', type: 'button', onclick: () => { app.nextHook(card); draw(); } },
        `🔁 اختار اللي يضحكك (${cur.more + 1} اختيارات)`));
    }
    if (cur) row.append(h('button', { class: 'btn small ghost', type: 'button', title: 'مش عاجبني', onclick: () => { app.dislikeHook(card); draw(); toast('تمام، شيلناه 👌'); } }, '👎'));
    row.append(h('button', { class: 'btn small ghost', type: 'button', onclick: () => edit() }, '✏️ اكتب بتاعك'));
    box.append(row);
  };
  const edit = () => {
    clear(box);
    const ta = h('textarea', { class: 'own-hook', rows: 2, dir: 'rtl', placeholder: 'اكتب الـ hook بتاعك (جملة واحدة، كل ما تبقى أهبل أحسن 😄)' });
    ta.value = app.state.hookOwn[card.id] || '';
    box.append(ta, h('div', { class: 'hook-actions' },
      h('button', { class: 'btn small', type: 'button', onclick: () => { app.setOwnHook(card, ta.value); draw(); toast('اتحفظ ✅'); } }, 'احفظ'),
      h('button', { class: 'btn small ghost', type: 'button', onclick: draw }, 'إلغاء')));
    ta.focus();
  };
  draw();
  return box;
}


// ================= the 4-step way to learn ONE question =================
// 🔴 red words = what to look for in the exam · 🟢 the answer to write · 💡 the hints to remember both.

// The blue question word of a question (Ki = مين، Mikor = امتى …), as a short line.
export function qWordLine(q) {
  const w = questionWords(q.hu).find((x) => x.cls === 'dw');
  if (!w) return null;
  return h('div', { class: 'qword' }, 'كلمة السؤال: ', h('bdi', { class: 'hu qword-hu' }, w.word),
    ` (${translit(cleanWord(w.word))}) = ${w.ar}`);
}

// Step 2: every red word, big — the word, how to say it, what it means, how to remember it.
export function redWords(q, { compact = false } = {}) {
  return h('div', { class: `red-list ${compact ? 'compact' : ''}` }, (q.red || []).map((r) => h('div', { class: 'red-item' },
    h('div', { class: 'red-head' }, h('bdi', { class: 'hu red-big' }, r.t), compact ? null : speakBtn(r.t)),
    compact ? null : h('div', { class: 'red-pron' }, 'بتتنطق: ', h('b', {}, r.pron)),
    h('div', { class: 'red-ar' }, mixed(`= ${r.ar}`)),
    h('div', { class: 'red-hint' }, '💡 ', mixed(r.hint)))));
}

// Step 3: the answer, big and green — how to say it and what it means.
export function answerBig(q, { compact = false } = {}) {
  return h('div', { class: `answer-green ${compact ? 'compact' : ''}` },
    h('div', { class: 'answer-line' }, h('bdi', { class: 'hu green-big' }, q.answer_hu), compact ? null : speakBtn(q.answer_hu)),
    q.pron_ar && !compact ? h('div', { class: 'pron' }, 'بتتنطق: ', h('b', {}, q.pron_ar)) : null,
    q.answer_ar ? h('div', { class: 'answer-ar' }, 'يعني: ', mixed(q.answer_ar)) : null,
    q.note_ar ? h('div', { class: 'note' }, '⚠️ ', mixed(q.note_ar)) : null,
    q.changed ? changedLine(q.changed) : null);
}

// The chain to remember in the exam: 🔴 red words → 🟢 answer.
export function recallLine(q) {
  return h('div', { class: 'recall' }, h('b', {}, '🔗 في الامتحان: '), 'أول ما تشوف ',
    (q.red || []).map((r, i) => [i ? ' + ' : '', h('bdi', { class: 'hu red-inline' }, r.t)]),
    ' ← اكتب ', h('bdi', { class: 'hu green-inline' }, q.answer_hu));
}

// One question in a list (lesson page, all questions): tap to see its red words and its answer.
export function questionItem(app, q, n) {
  return h('details', { class: 'q-item' },
    h('summary', {},
      h('span', { class: 'q-num' }, String(n)),
      h('span', { class: 'q-sum' },
        h('span', { class: 'q-hu' }, redHu(q.hu, q.red, { tap: false })),
        h('span', { class: 'q-ar' }, mixed(q.ar)),
        h('span', { class: 'times-chip' }, `🔥 جه ${timesAr(q.freq || 1)}`))),
    h('div', { class: 'q-body' },
      h('div', { class: 'step-mini' }, '🔴 دوّر على:'), redWords(q, { compact: true }),
      h('div', { class: 'step-mini' }, '🟢 الإجابة:'), answerBig(q, { compact: true }),
      questionHook(app, q), recallLine(q)));
}
