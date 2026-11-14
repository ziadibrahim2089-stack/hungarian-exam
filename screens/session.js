// A lesson = its real exam questions, ONE AT A TIME, each in 4 small steps:
//   1 understand the question → 2 the 🔴 red word to look for in the exam → 3 the 🟢 answer and
//   how to remember it → 4 recall it from memory (checked; a miss comes back at the end).
// Before the lesson: a quick review of questions learned before (recall → show → grade).
// Scheduling stays per answer group: reviews rotate through the group's real questions.
// Leaving in the middle is fine: the session resumes the same day where you stopped.
import { h, hu, clear, toast, answerArea, verdictBadge, mixed, speakBtn, redHu } from '../ui.js';
import { buildSession, pickQuiz, streak, nextQuestion, currentLesson, lessonDone, papersPassed } from '../lib/plan.js';
import { introduce, grade } from '../lib/srs.js';
import { checkAnswer } from '../lib/match.js';
import { timesAr, qWordLine, redWords, answerBig, recallLine, questionHook } from './card.js';
import { todayPlan, knownCount } from './home.js';

const V = 5;   // session format (older saved sessions are dropped)

function dayRec(app, today) {
  return app.state.days[today] || (app.state.days[today] = { rev: 0, fresh: [], quiz: [], write: [], done: false });
}

// limit = how many new questions today (the exam-date plan); null = the whole lesson
function startSession(app, mode, pick, limit = null) {
  const st = app.state;
  const today = app.today();
  const day = dayRec(app, today);
  const groups = app.DATA.cards.filter((c) => c.kind === 'family');
  if (mode === 'extra') {
    const quiz = pickQuiz({ cards: groups, states: st.cards, n: 5 });
    return { day: today, mode, stage: quiz.length ? 'quiz' : 'done', learn: [], li: 0, rep: {}, quiz, qi: 0, stats: { quizRight: 0 } };
  }
  const plan = buildSession({ cards: groups, states: st.cards, today, minutes: st.settings.minutes, freshToday: day.fresh, lessons: app.DATA.lessons, pick });
  // practice = a lesson already learned, studied again: all its questions once more
  const lessonCards = (plan.practice ? app.DATA.lessons[plan.lesson - 1].cards : plan.fresh).map((id) => app.byId[id]).filter((c) => c?.kind === 'family');
  // a lesson can be split over days: questions taught on an earlier day are skipped, and a group
  // joins the reviews (famdone) only once all its questions are taught
  const taught = st.taught || {};
  const order = lessonCards.map((c) => ({ c, qids: [...c.q].sort((a, b) => (app.qById[b]?.freq || 0) - (app.qById[a]?.freq || 0))   // most asked first
    .filter((qid) => plan.practice || taught[qid] == null) }));
  let room = limit == null || plan.practice ? Infinity : Math.max(1, limit);
  const total = Math.min(room, order.reduce((n, o) => n + o.qids.length, 0));
  const teach = [];
  let n = 0;
  for (const { c, qids } of order) {
    if (room <= 0) break;
    const take = qids.slice(0, room);
    room -= take.length;
    for (const qid of take) teach.push({ id: c.id, t: 'teach', qid, n: ++n, of: total });
    if (take.length === qids.length) teach.push({ id: c.id, t: 'famdone' });   // no screen: the group joins the reviews
  }
  const learn = [
    ...plan.review.map((id) => ({ id, t: 'rev', qid: nextQuestion(app.byId[id], st.cards[id]) })),
    ...teach,
  ];
  return { day: today, mode: 'daily', stage: 'intro', pick: pick || null, limit: plan.practice ? null : limit, practice: !!plan.practice, lesson: lessonCards.length ? plan.lesson : null, learn, li: 0, rep: {}, tp: null, quiz: null, qi: 0, started: Date.now(), stats: { again: 0, good: 0, hard: 0, quizRight: 0, fresh: 0, rev: 0, taught: 0, triedRight: 0 } };
}

export function render(app, params) {
  const st = app.state;
  const today = app.today();
  const mode = params[0] === 'extra' ? 'extra' : 'daily';
  // #/session/lesson/N = start lesson N (any lesson, all are open); #/session = continue / the next lesson
  // #/session/today = today's goal from the exam-date plan (the next lesson, only today's questions)
  const xp = params[0] === 'today' ? todayPlan(app) : null;
  const curL = currentLesson(app.DATA.lessons, st.cards);
  const limit = xp?.phase === 'learn' && xp.rest > 0 ? xp.rest : null;
  const pick = params[0] === 'lesson' ? Math.max(1, Math.min(app.DATA.lessons.length, Math.round(+params[1]) || 1))
    : params[0] === 'today' && curL ? curL.n : null;
  let S = st.session && st.session.day === today && st.session.mode === mode && st.session.v === V ? st.session : null;
  if (S && pick && S.lesson !== pick) S = null;   // another lesson was chosen: start that one
  if (!S) { S = { ...startSession(app, mode, pick, limit), v: V }; st.session = S; app.save(); }
  const day = dayRec(app, today);
  const cleanups = [];

  const fill = h('span');
  const counter = h('div', { class: 'counter' });
  const top = h('div', { class: 'session-top' },
    h('a', { class: 'icon-btn', href: '#/home', 'aria-label': 'خروج — هتكمّل بعدين من نفس المكان' }, '✕'),
    h('div', { class: 'bar session-bar' }, fill), counter);
  const body = h('div', { class: 'stage' });
  const root = h('div', { class: 'screen session' }, top, body);
  const persist = () => { st.session = S; app.save(); };

  function progress() {
    const at = Math.max(S.li, S.far ?? 0);
    const done = S.stage === 'done' ? 1 : S.stage === 'intro' ? 0 : S.learn.length ? at / S.learn.length : 1;
    fill.style.width = `${Math.round(done * 100)}%`;
  }

  // S.far / S.farTp = the furthest place reached (item + step). Going back to look at an earlier
  // question is free: nothing is counted or graded twice, and one tap brings you back to S.far.
  const behind = () => S.stage === 'learn' && S.far != null && S.li < S.far;
  function advance() {
    S.li++;
    S.tp = S.li === S.far ? S.farTp : null;
    next();
  }

  function next() {
    cleanups.splice(0).forEach((f) => f());
    if (S.stage === 'learn' && (S.far == null || S.li >= S.far)) { S.far = S.li; S.farTp = S.tp || null; }
    persist();
    clear(body);
    progress();
    window.scrollTo(0, 0);
    if (S.stage === 'intro') return introStep();
    if (S.stage === 'learn') return learnStep();
    if (S.stage === 'quiz') return quizStep();
    return doneStep();
  }

  // ---------------- what this lesson is ----------------
  function introStep() {
    counter.textContent = '';
    const { lessons } = app.DATA;
    const L = S.lesson ? lessons[S.lesson - 1] : null;
    const nRev = S.learn.filter((x) => x.t === 'rev').length;
    const nTeach = S.learn.filter((x) => x.t === 'teach').length;
    const box = h('div', { class: 'card intro' });
    if (L) {
      box.append(h('div', { class: 'hero-chip' }, `الدرس ${L.n} من ${lessons.length}${S.practice ? ' · 🔁 بتذاكره تاني' : ''}`),
        h('h2', { class: 'hero-title' }, `${L.emoji} ${L.title_ar}`),
        h('p', {}, `هنذاكر ${nTeach} سؤال حقيقي من الامتحانات، سؤال سؤال. كل سؤال في 4 خطوات صغيرة:`),
        S.limit && !S.learn.some((x) => x.t === 'famdone' && x.id === L.cards[L.cards.length - 1])
          ? h('p', { class: 'muted small' }, `🎯 ده هدف النهارده بس. باقي الدرس ${L.n} هتكمّله بكره من نفس المكان.`) : null);
    } else {
      const cur = currentLesson(lessons, st.cards);
      box.append(h('h2', { class: 'hero-title' }, '🔁 مراجعة النهارده'),
        h('p', { class: 'muted' }, cur ? `بعد المراجعة تقدر تبدأ الدرس ${cur.n} (${cur.emoji} ${cur.title_ar}) من الرئيسية.` : 'خلصت كل الدروس. المراجعة بتثبّت اللي اتعلمته لحد يوم الامتحان.'));
    }
    if (nTeach) {
      box.append(h('ol', { class: 'four-steps' },
        h('li', {}, h('b', {}, 'افهم السؤال: '), 'هتشوف السؤال بالمجري ومعناه بالعربي.'),
        h('li', {}, h('b', {}, '🔴 الكلمة الحمرا: '), 'الكلمة اللي هتدوّر عليها في الامتحان، ومعناها، وإزاي تفتكرها.'),
        h('li', {}, h('b', {}, '🟢 الإجابة: '), 'هتكتب إيه، وإزاي تنطقها، وإزاي تفتكرها.'),
        h('li', {}, h('b', {}, '🧠 من دماغك: '), 'تجاوب لوحدك، والتطبيق يصحّح.')));
    }
    if (nRev) box.append(h('p', { class: 'muted' }, `الأول هتراجع ${nRev === 1 ? 'سؤال واحد' : nRev === 2 ? 'سؤالين' : `${nRev} أسئلة`} من اللي ذاكرته قبل كده.`));
    if (!nRev && !nTeach) box.append(h('p', {}, 'مفيش مراجعة النهارده 🎉 جرّب امتحان تجريبي لو حابب.'), h('a', { class: 'btn ghost wide', href: '#/mock' }, '📝 امتحان تجريبي'));
    box.append(h('p', { class: 'muted small' }, 'لو خرجت في النص، هتكمّل من نفس المكان.'));
    body.append(box, h('div', { class: 'actions' },
      h('button', { class: 'btn big', type: 'button', onclick: () => { S.stage = 'learn'; next(); } }, 'يلا نبدأ ▶︎')));
  }

  // ---------------- reviews, then the lesson's questions ----------------
  function learnStep() {
    if (S.li >= S.learn.length) { S.stage = 'done'; return next(); }
    const item = S.learn[S.li];
    const card = app.byId[item.id];
    if (!card || card.kind !== 'family') return advance();
    if (item.t === 'famdone') {
      if (!st.cards[card.id]) {
        st.cards[card.id] = introduce(today);
        S.stats.fresh++;
        if (!day.fresh.includes(card.id)) day.fresh.push(card.id);
        toast(`✅ خلصت أسئلة: ${card.title_ar}`);
      }
      return advance();
    }
    if (item.t === 'teach' || item.t === 'retry') return teachStep(item, card);
    if (behind()) return advance();   // a review already graded: never grade it twice
    return reviewStep(item, card);
  }

  // The question before this one (only lesson questions: reviews are not shown again).
  function prevQuestion() {
    for (let j = S.li - 1; j >= 0; j--) if (S.learn[j].t === 'teach' || S.learn[j].t === 'retry') return j;
    return -1;
  }

  // ---------------- one new question, in 4 steps ----------------
  function teachStep(item, card) {
    const q = app.qById[item.qid];
    if (!q) return advance();
    const PH = ['q', 'kw', 'ans', 'try'];
    const phase = S.tp || (item.t === 'retry' ? 'try' : 'q');
    const stepNo = PH.indexOf(phase) + 1;
    const revisit = behind();   // an earlier question, opened again to look at it
    counter.textContent = item.t === 'retry' ? 'تاني مرة' : `سؤال ${item.n} من ${item.of}`;
    const go = (p) => { S.tp = p; next(); };
    // the 4 steps are tabs: tap any of them to go back (or ahead) to it
    const steps = h('div', { class: 'steps4', role: 'navigation', 'aria-label': 'خطوات السؤال: دوس على أي خطوة تروحلها' },
      ['افهم السؤال', '🔴 الكلمة', '🟢 الإجابة', '🧠 من دماغك'].map((label, i) =>
        h('button', { type: 'button', class: `s4 ${i + 1 < stepNo ? 'done' : i + 1 === stepNo ? 'now' : ''}`,
          'aria-current': i + 1 === stepNo ? 'step' : null, onclick: () => { if (i + 1 !== stepNo) go(PH[i]); } }, `${i + 1}. ${label}`)));
    const head = h('div', { class: 'chips' },
      h('span', { class: 'chip strong' }, item.t === 'retry' ? 'تاني مرة 🔁' : `سؤال ${item.n} من ${item.of}`),
      h('span', { class: `chip t${card.topic}` }, card.title_ar),
      h('span', { class: 'chip soft' }, `🔥 جه ${timesAr(q.freq || 1)} في الامتحانات`));
    const question = (opts) => h('div', { class: 'question' }, redHu(q.hu, q.red, opts));
    // → back: the step before, or (on step 1) the question before
    const prev = stepNo === 1 ? prevQuestion() : -1;
    const backBtn = stepNo > 1 || prev >= 0
      ? h('button', { class: 'btn ghost back', type: 'button', onclick: () => {
        if (stepNo > 1) return go(PH[stepNo - 2]);
        S.li = prev; S.tp = 'ans'; next();
      } }, stepNo > 1 ? '→ رجوع' : '→ السؤال اللي فات')
      : null;
    const nextBtn = (label, p) => h('div', { class: 'actions' }, backBtn, h('button', { class: 'btn big', type: 'button', onclick: () => go(p) }, label));
    if (revisit) {
      const far = S.learn[S.far];
      body.append(h('div', { class: 'revisit' }, h('span', {}, '👀 بتبص على سؤال ذاكرته'),
        h('button', { class: 'btn small', type: 'button', onclick: () => { S.li = S.far; S.tp = S.farTp; next(); } },
          far?.t === 'teach' ? `↩︎ ارجع لسؤال ${far.n}` : '↩︎ ارجع لمكانك')));
    }

    if (phase === 'q') {        // 1 — understand the question
      body.append(h('div', { class: 'card teach' }, head, steps,
        h('h3', { class: 'step-title' }, 'خطوة 1: افهم السؤال'),
        question(), h('div', { class: 'listen-q' }, speakBtn(q.hu), h('span', { class: 'muted small' }, 'اسمع السؤال بالمجري')),
        h('div', { class: 'meaning big-meaning' }, h('span', { class: 'muted' }, 'يعني: '), mixed(q.ar)),
        qWordLine(q),
        h('p', { class: 'muted small' }, 'الكلمات الحمرا 🔴 هي اللي هتدوّر عليها في الامتحان. هنتعلمها في الخطوة الجاية.')),
        nextBtn('فهمت السؤال ← التالي', 'kw'));
      return;
    }
    if (phase === 'kw') {       // 2 — the red words: meaning + how to remember them
      body.append(h('div', { class: 'card teach' }, head, steps,
        h('h3', { class: 'step-title' }, 'خطوة 2: الكلمة الحمرا اللي هتدوّر عليها 🔴'),
        question({ tap: false }),
        h('p', {}, 'أول ما تشوف الكلمة دي في ورقة الامتحان، تعرف إنه السؤال ده:'),
        redWords(q),
        h('div', { class: 'tip small' }, '🗣️ دوس 🔊 وقول الكلمة بصوت عالي 3 مرات، واتخيّل الصورة اللي في 💡.')),
        nextBtn('حفظت الكلمة ← التالي', 'ans'));
      return;
    }
    if (phase === 'ans') {      // 3 — the answer + how to remember it
      body.append(h('div', { class: 'card teach' }, head, steps,
        h('h3', { class: 'step-title' }, 'خطوة 3: الإجابة 🟢'),
        h('p', {}, 'في الامتحان اكتب:'),
        answerBig(q),
        h('div', { class: 'step-mini' }, '💡 إزاي تفتكر الإجابة:'), questionHook(app, q),
        recallLine(q)),
        nextBtn('حفظت الإجابة ← جرّب من دماغك', 'try'));
      return;
    }
    // 4 — recall it from memory (the answer is hidden)
    const area = answerArea(q);
    const result = h('div', { class: 'result' });
    let r = null;
    const check = h('button', { class: 'btn big', type: 'button', onclick: () => {
      r = checkAnswer(q, area.input(), { optionSet: area.optionSet });
      if (r.verdict === 'empty') { toast('جاوب الأول ✍️ — ولو مش فاكر، اكتب أي حاجة جت في دماغك'); return; }
      showResult();
    } }, 'صحّح ✔︎');
    const tryActions = h('div', { class: 'actions' }, backBtn, check);
    body.append(h('div', { class: 'card teach' }, head, steps,
      h('h3', { class: 'step-title' }, 'خطوة 4: جاوب من دماغك 🧠'),
      h('p', { class: 'muted' }, area.kind === 'write' ? 'من غير ما تبص: دوّر على الكلمة الحمرا، واكتب الإجابة.' : 'من غير ما تبص: دوّر على الكلمة الحمرا، واختار الإجابة.'),
      question(), area.el),
      tryActions, result);
    if (area.kind === 'write') setTimeout(() => area.fields?.[0]?.field?.focus?.(), 50);

    function showResult() {
      tryActions.remove();
      clear(result);
      const box = h('div', { class: 'card' });
      box.append(verdictBadge(r));
      if (area.kind === 'write' && r.read) box.append(h('div', { class: 'read big' }, 'اتقرا: ', hu(`«${r.read}»`)));
      if (r.items) box.append(h('div', { class: 'items' }, r.items.map((it) => h('span', { class: `item ${it.ok ? 'ok' : 'bad'}` }, it.ok ? '✓ ' : '✗ ', hu(it.label)))));
      if (r.notes?.length) box.append(h('ul', { class: 'notes' }, r.notes.map((x) => h('li', {}, mixed(x.msg)))));
      box.append(h('div', { class: 'step-mini' }, 'الإجابة الصح:'), answerBig(q, { compact: true }), recallLine(q));
      if (r.verdict !== 'right') {
        box.append(h('div', { class: 'step-mini' }, '💡 افتكرها كده:'), questionHook(app, q));
        if (item.t === 'teach' && !revisit) box.append(h('div', { class: 'tip small' }, '🔁 ولا يهمك، السؤال ده هيرجعلك تاني في آخر الدرس.'));
      } else {
        box.append(h('div', { class: 'tip small' }, '👏 برافو! كده حفظت السؤال ده.'));
      }
      const nav = h('div', { class: 'actions' });
      if (area.kind === 'write' && r.verdict !== 'right') {
        nav.append(h('button', { class: 'btn ghost', type: 'button', onclick: () => {
          r = { ...r, verdict: 'right', score: 1, msg: '✅ صحّحتها بنفسك (الجهاز قرأ غلط)', overridden: true };
          showResult();
        } }, '✋ الجهاز قرأ غلط، أنا كاتب صح'));
      }
      nav.append(h('button', { class: 'btn big', type: 'button', onclick: () => {
        if (!revisit) {   // counted once: looking at it again later changes nothing
          if (r.verdict !== 'right' && item.t === 'teach' && !S.learn.some((x) => x.t === 'retry' && x.qid === q.id)) {
            const at = S.learn.findIndex((x, i) => i > S.li && x.t === 'famdone' && x.id === item.id);
            S.learn.splice(at >= 0 ? at : S.learn.length, 0, { id: item.id, t: 'retry', qid: q.id });
          }
          if (item.t === 'teach') S.stats.taught = (S.stats.taught || 0) + 1;
          if (item.t === 'teach' && !S.practice && (st.taught ||= {})[q.id] == null) {
            st.taught[q.id] = today;
            (day.taught ||= []).push(q.id);
          }
          if (r.verdict === 'right' && item.t === 'teach') S.stats.triedRight = (S.stats.triedRight || 0) + 1;
        }
        advance();
      } }, 'السؤال الجاي ←'));
      box.append(nav);
      result.append(box);
    }
  }

  // ---------------- a question learned before: recall → show → grade ----------------
  function reviewStep(item, card) {
    const q = app.qById[item.qid || card.q[0]];
    if (!q) return advance();
    counter.textContent = `مراجعة · فاضل ${S.learn.length - S.li}`;
    const faceWrap = h('div', { class: 'card teach' },
      h('div', { class: 'chips' },
        h('span', { class: 'chip strong' }, item.t === 'again' ? 'تاني مرة 🔁' : 'مراجعة 🔁'),
        h('span', { class: `chip t${card.topic}` }, card.title_ar),
        h('span', { class: 'chip soft' }, `🔥 جه ${timesAr(q.freq || 1)}`)),
      h('div', { class: 'question' }, redHu(q.hu, q.red)),
      h('p', { class: 'muted' }, '🧠 دوّر على الكلمة الحمرا، وقول الإجابة في دماغك. (دوس على الكلمة الحمرا لو نسيت معناها)'));
    const actions = h('div', { class: 'actions' },
      h('button', { class: 'btn big', type: 'button', onclick: show }, 'ورّيني الإجابة 👀'));
    body.append(faceWrap, actions);

    function show() {
      faceWrap.append(h('div', { class: 'meaning' }, h('span', { class: 'muted' }, 'يعني: '), mixed(q.ar)),
        answerBig(q), recallLine(q), questionHook(app, q));
      clear(actions);
      const btn = (cls, text, g) => h('button', { class: `btn big ${cls}`, type: 'button', onclick: () => rate(g) }, text);
      actions.append(h('div', { class: 'grade-row' },
        btn('bad', 'نسيت 😅', 'again'), btn('mid', 'فاكر بالعافية 🤔', 'hard'), btn('ok', 'فاكر 💪', 'good')));
    }

    function rate(g) {
      // Only the first look at a due question moves its group between boxes; repeats in the same
      // session are extra practice (a forgotten one already waits until tomorrow).
      if (item.t === 'rev') {
        if (st.cards[card.id]) {
          const qiBefore = st.cards[card.id].qi || 0;
          st.cards[card.id] = { ...grade(st.cards[card.id], g, today), qi: qiBefore + 1 };
        }
        day.rev = (day.rev || 0) + 1;
        S.stats.rev++;
      }
      S.stats[g] = (S.stats[g] || 0) + 1;
      if (g === 'again') {
        S.rep[card.id] = (S.rep[card.id] || 0) + 1;
        if (S.rep[card.id] <= 2) {
          const alt = nextQuestion(card, st.cards[card.id], 'qi', S.rep[card.id]);
          S.learn.splice(Math.min(S.learn.length, S.li + 4), 0, { id: card.id, t: 'again', qid: alt });
        }
      }
      advance();
    }
  }

  // ---------------- extra practice: 5 exam questions ----------------
  function quizStep() {
    if (!S.quiz) { S.quiz = []; persist(); }
    if (S.qi >= S.quiz.length) { S.stage = 'done'; return next(); }
    const { fam, qid } = S.quiz[S.qi];
    const q = app.qById[qid];
    const famCard = app.byId[fam];
    counter.textContent = `سؤال ${S.qi + 1} من ${S.quiz.length}`;
    fill.style.width = `${Math.round((S.qi / S.quiz.length) * 100)}%`;
    const area = answerArea(q);
    const result = h('div', { class: 'result' });
    let r = null;
    const check = h('button', { class: 'btn big', type: 'button', onclick: () => {
      r = checkAnswer(q, area.input(), { optionSet: area.optionSet });
      if (r.verdict === 'empty') { toast('اكتب أو اختار إجابة الأول ✍️ — ولو مش عارف اكتب أي حاجة، متسيبش فاضي'); return; }
      showResult();
    } }, 'صحّح ✔︎');
    body.append(
      h('div', { class: 'card teach' },
        h('div', { class: 'chips' }, h('span', { class: 'chip strong' }, `سؤال امتحان ${S.qi + 1}/${S.quiz.length}`), h('span', { class: `chip t${famCard.topic}` }, famCard.title_ar)),
        h('div', { class: 'question' }, redHu(q.hu, q.red)), area.el),
      h('div', { class: 'actions' }, check), result);
    if (area.kind === 'write') setTimeout(() => area.fields?.[0]?.field?.focus?.(), 50);

    function showResult() {
      check.remove();
      clear(result);
      const box = h('div', { class: 'card' });
      box.append(verdictBadge(r));
      if (area.kind === 'write' && r.read) box.append(h('div', { class: 'read big' }, 'اتقرا: ', hu(`«${r.read}»`)));
      if (r.items) box.append(h('div', { class: 'items' }, r.items.map((it) => h('span', { class: `item ${it.ok ? 'ok' : 'bad'}` }, it.ok ? '✓ ' : '✗ ', hu(it.label)))));
      if (r.notes?.length) box.append(h('ul', { class: 'notes' }, r.notes.map((x) => h('li', {}, mixed(x.msg)))));
      box.append(h('div', { class: 'step-mini' }, 'الإجابة الصح:'), answerBig(q, { compact: true }), recallLine(q), questionHook(app, q));
      const nav = h('div', { class: 'actions' });
      if (area.kind === 'write' && r.verdict !== 'right') {
        nav.append(h('button', { class: 'btn ghost', type: 'button', onclick: () => {
          r = { ...r, verdict: 'right', score: 1, msg: '✅ صحّحتها بنفسك (الجهاز قرأ غلط)', overridden: true };
          showResult();
        } }, '✋ الجهاز قرأ غلط، أنا كاتب صح'));
      }
      nav.append(h('button', { class: 'btn big', type: 'button', onclick: () => {
        day.quiz.push({ id: qid, fam, v: r.verdict });
        if (r.verdict === 'right') S.stats.quizRight++;
        const s = st.cards[fam];
        if (s) {
          const graded = r.verdict === 'right' ? s : grade(s, r.verdict === 'almost' ? 'hard' : 'again', today);
          st.cards[fam] = { ...graded, qz: (s.qz || 0) + 1 };
        }
        S.qi++;
        next();
      } }, 'التالي ←'));
      box.append(nav);
      result.append(box);
    }
  }

  // ---------------- done ----------------
  function doneStep() {
    counter.textContent = '';
    if (mode === 'daily') day.done = true;
    if (mode === 'daily' && S.practice && S.lesson) {   // a lesson studied again (the review days)
      const r = ((st.reviewed ||= {})[S.lesson] ||= []);
      if (!r.includes(today)) r.push(today);
    }
    st.session = null;
    app.save();
    const s = streak(st.days, today);
    const quizN = S.quiz?.length || 0;
    const { lessons, papers } = app.DATA;
    const knownFams = new Set(app.DATA.cards.filter((c) => c.kind === 'family' && st.cards[c.id]).map((c) => c.id));
    const learnedQ = knownCount(app);
    const pass = papersPassed(papers, app.qById, knownFams);
    const goal = lessons.find((l) => l.pass === papers.length);
    const L = S.lesson ? lessons[S.lesson - 1] : null;
    const finished = L && lessonDone(L, st.cards);
    const nextL = currentLesson(lessons, st.cards);
    const nTaught = S.stats.taught || 0;
    const xp = mode === 'daily' ? todayPlan(app) : null;
    const goalLeft = xp?.phase === 'learn' ? xp.rest : 0;
    const reviewNext = xp?.phase === 'review' ? xp.todayLessons.find((t) => !t.done) : null;
    const splitDone = !!S.limit && L && !finished && !S.practice;
    const nRev = S.stats.rev || 0;
    body.append(h('div', { class: 'card done' },
      h('div', { class: 'done-emoji' }, '🎉'),
      h('h2', {}, mode === 'extra' ? 'شاطر! خلصت الأسئلة الزيادة' : S.practice && L ? `برافو! راجعت الدرس ${L.n} كله` : splitDone ? 'برافو! خلصت هدف النهارده 🎯' : finished ? `برافو! خلصت الدرس ${L.n}` : 'برافو! خلصت مذاكرة النهارده'),
      mode === 'daily' ? h('div', { class: 'done-stats' },
        nTaught ? h('div', {}, `${S.practice ? 'ذاكرت' : 'اتعلمت'} ${nTaught} سؤال، وجاوبت صح من أول مرة في ${S.stats.triedRight || 0}`) : null,
        nRev ? h('div', {}, `راجعت ${nRev === 1 ? 'سؤال واحد' : nRev === 2 ? 'سؤالين' : `${nRev} أسئلة`}`) : null,
        h('div', { class: 'strong' }, `بقيت تعرف إجابات ${learnedQ} من ${app.DATA.questions.length} سؤال حقيقي`),
        pass ? h('div', { class: 'strong' }, `🎯 لو جالك امتحان من الـ ${papers.length} ورقة الحقيقية: هتنجح في ${pass} منهم`)
          : goal ? h('div', {}, `🎯 بعد الدرس ${goal.n} هتنجح في الـ ${papers.length} ورقة الحقيقية كلهم`) : null)
        : h('div', { class: 'done-stats' }, h('div', {}, `${S.stats.quizRight || 0} من ${quizN} صح`)),
      h('div', { class: 'streak big' }, `🔥 ${s} ${s === 1 ? 'يوم' : 'أيام'} ورا بعض`),
      ...(mode !== 'daily' ? [] : goalLeft > 0 && nextL ? [
        h('div', { class: 'next-lesson' }, h('b', {}, `🎯 فاضل من هدف النهارده ${goalLeft} سؤال `), `(الدرس ${nextL.n} · ${nextL.emoji} ${nextL.title_ar})`),
        h('a', { class: 'btn big wide', href: '#/session/today' }, 'كمّل هدف النهارده ▶︎'),
      ] : reviewNext ? [
        h('div', { class: 'next-lesson' }, h('b', {}, 'مراجعة النهارده لسه فيها: '), `الدرس ${reviewNext.n} · ${lessons[reviewNext.n - 1].emoji} ${lessons[reviewNext.n - 1].title_ar}`),
        h('a', { class: 'btn big wide', href: `#/session/lesson/${reviewNext.n}` }, `راجع الدرس ${reviewNext.n} ▶︎`),
      ] : xp && xp.phase !== 'learn' ? [] : [
        h('div', { class: 'next-lesson' }, nextL
          ? [h('b', {}, splitDone ? 'بكره: ' : 'الدرس الجاي: '), splitDone ? `تكمّل الدرس ${nextL.n} من نفس المكان` : `الدرس ${nextL.n} · ${nextL.emoji} ${nextL.title_ar}`]
          : xp ? '🎓 خلصت كل الأسئلة! من بكرة: مراجعة كل الدروس من الأول لحد الامتحان.' : '🎓 خلصت كل الدروس! من بكرة: مراجعة كل يوم + امتحان بورقة حقيقية كل يومين.'),
        nextL ? h('a', { class: 'btn ghost wide', href: `#/session/lesson/${nextL.n}` }, splitDone ? `عايز تكمّل الدرس ${nextL.n} دلوقتي؟ (اختياري)` : `عايز تكمّل؟ ابدأ الدرس ${nextL.n} دلوقتي ▶︎`) : null,
        nextL ? h('div', { class: 'muted small' }, xp ? 'هدف النهارده خلص، والزيادة اختيارية.' : 'الأحسن درس واحد في اليوم عشان مخك يثبّت 🧠، بس براحتك.') : null,
      ]),
      h('div', { class: 'muted' }, 'بكره هتراجع اللي اتعلمته (بأسئلة مختلفة). شوفك بكره 👋'),
      h('a', { class: 'btn big', href: '#/home' }, '🏠 الرئيسية')));
  }

  next();
  return { el: root, cleanup: () => cleanups.forEach((f) => f()) };
}
