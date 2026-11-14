// Browse screens: decoder, all questions (by family), last-night sheet, plan, stories, listen mode.
import { h, hu, clear, stars, accentWord, mixed, toast } from '../ui.js';
import { MAX_NEW, lessonDone } from '../lib/plan.js';
import { lessonStatus, lessonPath, planSummary } from './home.js';
import { hookBox, keysTable, questionList, hookMethod, spotKeywords, questionExplainList, questionItem } from './card.js';
import { createPad } from '../lib/pad.js';

function page(title, ...content) {
  return h('div', { class: 'screen page' },
    h('header', { class: 'page-top' }, h('a', { class: 'icon-btn', href: '#/home', 'aria-label': 'رجوع' }, '→'), h('h1', {}, title)),
    ...content);
}
const dateAr = (day) => new Date(day * 864e5).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const families = (app) => app.DATA.cards.filter((c) => c.kind === 'family');
const TOPIC_ORDER = [0, 1, 2, 3, 4, 5, 6];

// ---------------- decoder ----------------
export function decoder(app) {
  const types = app.DATA.cards.filter((c) => c.kind === 'decoder').sort((a, b) => b.value - a.value);
  return page('🔑 كلمات الأسئلة',
    h('p', { class: 'lead' }, 'كلمة السؤال بتقولك ', h('b', {}, 'نوع الإجابة'), ' اللي تكتبها (اسم؟ رقم؟ تاريخ؟ آه ولا لأ؟). دول 9 أنواع بس — وأي كلمة زرقا في سؤال تقدر تدوس عليها تشوف معناها.'),
    ...types.map((card) => h('div', { class: 'card dec' },
      h('div', { class: 'dec-head' }, hu(card.hu, { cls: 'dec-hu' }), h('span', { class: 'pron' }, card.pron_ar)),
      h('div', { class: 'meaning' }, card.ar),
      h('div', { class: 'tip' }, mixed(card.tip_ar)),
      hookBox(app, card),
      h('div', { class: 'example small' }, hu(card.example, { highlight: true })))),
    h('details', { class: 'card' }, h('summary', {}, `كل كلمات الأسئلة (${app.DATA.words.length}) مترتبة بعدد مرات ظهورها`),
      h('div', { class: 'kw-grid' }, app.DATA.words.map((w) => h('div', { class: 'kw-item' },
        hu(w.hu, { cls: 'kw-hu' }), h('span', {}, `${w.ar} · ${w.pron_ar}`),
        w.hooks?.[0] ? h('div', { class: 'muted small' }, '💡 ', mixed(w.hooks[0])) : null)))),
    h('h2', {}, 'كلمات الموضوع (البرتقالي في الأسئلة)'),
    ...[1, 2, 3, 4, 5, 6].map((t) => h('details', { class: 'card' }, h('summary', {}, `${t} · ${app.topicName(t)}`),
      h('div', { class: 'kw-grid' }, app.DATA.keywords.filter((k) => k.t === t).map((k) =>
        h('div', { class: 'kw-item' }, hu(k.hu, { cls: 'kw-hu' }), h('span', {}, k.ar), k.hook ? h('div', { class: 'muted small' }, '💡 ', mixed(k.hook)) : null))))));
}

// ---------------- all questions, grouped by answer family ----------------
export function bank(app, params) {
  const st = app.state;
  const filter = params[0] || 'all';
  const tab = (key, label) => h('a', { class: `tab ${filter === key ? 'on' : ''}`, href: `#/bank/${key}` }, label);
  const changed = app.DATA.questions.filter((q) => q.changed);
  let n = 0;
  return page('📚 كل الأسئلة الحقيقية',
    h('p', { class: 'lead' }, `${app.DATA.questions.length} سؤال من امتحانات الناس (ولا سؤال متألف)، بالترتيب بتاع الدروس. دوس على أي سؤال تشوف الكلمة الحمرا 🔴 والإجابة 🟢.`),
    h('nav', { class: 'tabs' }, tab('all', 'الكل'), tab('learned', 'اللي اتعلمته'), tab('new', 'لسه')),
    changed.length ? h('div', { class: 'card changed-box' }, h('b', {}, '🔄 اتغير في المنهج الجديد (2026):'),
      ...app.DATA.changes.map((c) => h('div', { class: 'small' }, hu(c.old, { cls: 'old' }), ' ← ', hu(c.new, { cls: 'new' })))) : null,
    ...app.DATA.lessons.map((L) => {
      const groups = L.cards.map((id) => app.byId[id]).filter((c) => c?.kind === 'family')
        .filter((f) => (filter === 'learned' ? !!st.cards[f.id] : filter === 'new' ? !st.cards[f.id] : true));
      const qs = groups.flatMap((f) => [...f.q].sort((a, b) => (app.qById[b]?.freq || 0) - (app.qById[a]?.freq || 0)).map((id) => app.qById[id]));
      if (!qs.length) return null;
      return h('section', { class: 'card' },
        h('div', { class: 'lessons-head' }, h('h3', {}, `${L.emoji} الدرس ${L.n}: ${L.title_ar}`), h('a', { class: 'small', href: `#/lesson/${L.n}` }, 'افتح الدرس ←')),
        ...qs.map((q) => questionItem(app, q, ++n)));
    }));
}

// What people who sat the exam in 2026 said again and again (FB group, read 2026-11-14).
function examTips() {
  return h('div', { class: 'card tips-box' },
    h('h3', {}, '📋 نصايح من اللي امتحنوا في 2026'),
    h('ul', { class: 'tips-list' },
      h('li', {}, mixed('اقرا السؤال لآخر كلمة: واحد كتب رموز التتويج والسؤال كان عن «várost» (مدن).')),
      h('li', {}, mixed('جاوب على قد السؤال بجملة قصيرة: لو سألوا «Mit testesít meg» اكتب «a nemzet egységét» بس. اللي كتب كل مهام الرئيس خد صفر.')),
      h('li', {}, 'مش فاهم كلمة؟ اسأل المراقب يترجمهالك، ده مسموح.'),
      h('li', {}, 'اكتب بالقلم الجاف. في الاختيارات متغيّرش بعد ما تعلّم (ممكن يخصموا نص درجة): فكّر الأول، أو علّم بالرصاص الأول.'),
      h('li', {}, mixed('أبيات Himnusz و Szózat مبقتش بتتسأل في 2026: كفاية مين كتب ومين لحّن وسنة كام.')),
      h('li', {}, 'النتيجة بتطلع نفس اليوم بعد ساعة ونص لـ 3 ساعات. راجع اسمك وبياناتك في الورقة، ولو ناقصك نقط اطلب تشوف ورقتك: ساعات إجابة صح بتتحسب غلط.')));
}

// ---------------- last-night sheet ----------------
export function sheet(app) {
  const fb = app.DATA.fallback;
  return page('🌙 ورقة الليلة الأخيرة',
    h('p', { class: 'lead' }, 'كل الإجابات في صفحتين: معلومة كل جروب + الـ hook بتاعه. اقراها مرتين بالليل ومرة الصبح. تقدر تطبعها أو تحفظها PDF.'),
    h('div', { class: 'actions no-print' }, h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, '🖨 اطبع / احفظ PDF'),
      app.DATA.meta.workbook ? h('a', { class: 'btn ghost', href: './workbook.pdf', target: '_blank', rel: 'noopener' }, '✍️ كراسة الكتابة (PDF)') : null),
    h('div', { class: 'card changed-box' }, h('b', {}, '⚠️ اتغير في 2026: '),
      'رئيس الوزراء ', hu('Magyar Péter'), ' · ', hu('16 minisztérium'), ' · رئيس الجمهورية ', hu('Baka András'),
      h('div', { class: 'small muted' }, 'ولو مش متأكد من اسم: اكتب المنصب (a miniszterelnök / a köztársasági elnök) — صح دايماً.')),
    h('div', { class: 'card nem-box' }, h('b', {}, '⚠️ '), mixed('لو في السؤال nem / NEM / helytelen ← اختار الحاجة الغلط.')),
    examTips(),
    h('div', { class: 'sheet-grid' }, TOPIC_ORDER.flatMap((t) => families(app).filter((f) => f.topic === t).map((f) =>
      h('div', { class: 'sheet-item' },
        h('div', { class: 'sheet-q' }, h('span', { class: `dot t${t}` }), h('b', {}, f.title_ar)),
        ...f.keys.map(([k]) => h('div', { class: 'sheet-a' }, accentWord(k))),
        app.currentHook(f) ? h('div', { class: 'sheet-h' }, '💡 ', mixed(app.currentHook(f).text)) : null)))),
    h('h2', {}, '🛟 مش فاهم السؤال؟ متسيبش فاضي'),
    h('p', { class: 'muted' }, 'دوّر على كلمة تعرفها من الموضوع، واكتب الإجابة اللي جنبها:'),
    ...[1, 2, 3, 4, 5, 6].map((t) => h('div', { class: 'card fallback' }, h('h3', {}, `${t} · ${app.topicName(t)}`),
      ...fb[t].map((f) => h('div', { class: 'fb-row' }, hu(f.kw, { cls: 'kw-hu' }), h('span', { class: 'arrow' }, '←'), hu(f.a, { cls: 'fb-a' }))))));
}

// ---------------- the plan: the lessons in order + dates ----------------
export function plan(app, params = []) {
  const s = app.state.settings;
  const S = lessonStatus(app);
  const { lessons } = app.DATA;
  const left = lessons.length - S.done;
  const perWeek = Math.max(1, Math.min(7, s.daysPerWeek || 6));
  const finishDay = app.today() + Math.ceil((left * 7) / perWeek) - 1;
  const examDay = app.examDay();
  const el = page('🗓 خطة المذاكرة',
    h('div', { class: 'card' },
      h('p', {}, s.examDate ? `الامتحان: ${dateAr(examDay)} · فاضل ${Math.max(0, app.daysLeft())} يوم.` : 'لسه محددتش ميعاد الامتحان. ',
        !s.examDate ? h('a', { href: '#/settings' }, 'حدّده من هنا') : null),
      h('p', {}, S.xp ? `كل الدروس مفتوحة: دوس على أي درس تشوفه أو تبدأه. خلصت ${S.done} من ${lessons.length} درس.` : `كل الدروس مفتوحة: دوس على أي درس تشوفه أو تبدأه. الأحسن درس واحد كل يوم (حوالي ${s.minutes} دقيقة). خلصت ${S.done} من ${lessons.length} درس.`),
      S.xp ? null : left ? h('p', {}, `لو ذاكرت ${perWeek === 7 ? 'كل يوم' : `${perWeek} أيام في الأسبوع`}، هتخلّص الدروس حوالي ${dateAr(finishDay)}.`) : h('p', {}, '🎓 خلصت كل الدروس!')),
    S.xp ? h('div', { class: 'card' }, h('h3', {}, '📅 المذاكرة متقسّمة على الأيام لحد الامتحان'), planSummary(app, S.xp)) : null,
    h('section', { class: 'card lessons-card' }, h('h3', {}, '📚 الدروس بالترتيب'), lessonPath(app, S)),
    h('div', { class: 'card', id: 'reminder' }, h('h3', {}, '⏰ تذكير كل يوم'),
      h('p', {}, 'اختار الساعة اللي هتذاكر فيها. هيظهرلك التذكير، دوس «Add To Calendar» (ضيفه للكالندر)، والموبايل هيفكّرك كل يوم في نفس الميعاد.'),
      h('div', { class: 'chip-row' }, [['0800', '8 الصبح'], ['1300', '1 الضهر'], ['1800', '6 المغرب'], ['2000', '8 بالليل'], ['2200', '10 بالليل']]
        .map(([t, label]) => h('a', { class: 'chip-btn', href: `reminders/${t}.ics` }, label))),
      h('p', { class: 'muted small' }, 'لو عايز تشيله بعدين: افتح التذكير في الكالندر ودوس Delete Event.')),
    h('div', { class: 'card' }, hookMethod({ open: true })),
    h('div', { class: 'card' }, h('h3', {}, 'بعد الدروس'),
      h('ul', {},
        h('li', {}, 'كل يوم: مراجعة الكروت اللي ميعادها جه + أسئلة امتحان (حوالي 10 دقايق).'),
        h('li', {}, 'كل يومين: امتحان تجريبي بورقة حقيقية (60 دقيقة، الدرجة من 30، والنجاح 16).'),
        h('li', {}, 'آخر ليلة: اقرا ورقة الليلة الأخيرة مرتين ونام بدري.'))),
    h('div', { class: 'card' }, h('h3', {}, 'إزاي بتشتغل؟'),
      h('ul', {},
        h('li', {}, `كل درس فيه من 3 لـ ${MAX_NEW} كروت. كل كارت = معلومة واحدة + كل الأسئلة الحقيقية اللي بتسأل عنها.`),
        h('li', {}, 'كل يوم: مراجعة اللي فات، وبعدين الدرس الجديد، وبعدين أسئلة امتحان وكتابة.'),
        h('li', {}, 'اللي بتنساه بيرجعلك تاني يوم. واللي فاكره بيبعد: 1 ← 3 ← 7 ← 14 ← 30 يوم.'),
        h('li', {}, 'لو فوّت أيام: عادي، كل درس بيبدأ بمراجعة اللي فات. وتقدر تذاكر أي درس وقت ما تحب، أو نفس الدرس تاني.'))));
  if (params[0] === 'reminder') setTimeout(() => el.querySelector('#reminder')?.scrollIntoView({ block: 'start' }), 60);
  return el;
}

// ---------------- one lesson: what is in it (to read again) ----------------
export function lesson(app, params) {
  const { lessons, papers } = app.DATA;
  const n = Math.min(lessons.length, Math.max(1, Math.round(+params[0]) || 1));
  const L = lessons[n - 1];
  const S = lessonStatus(app);
  const done = lessonDone(L, app.state.cards);
  const isNext = S.cur?.n === n;
  const started = !done && L.cards.some((id) => app.state.cards[id]);
  const inProgress = S.resumable && S.sessionLesson === n;
  // every lesson is open: start it (a finished one can be studied again), or read its questions
  const startBtn = h('a', { class: 'big-start', href: inProgress ? '#/session' : `#/session/lesson/${n}` },
    inProgress ? `كمّل الدرس ${n} ▶︎` : done ? `🔁 ذاكر الدرس ${n} تاني` : started ? `كمّل الدرس ${n} ▶︎` : `ابدأ الدرس ${n} ▶︎`);
  const groups = L.cards.map((id) => app.byId[id]).filter((c) => c?.kind === 'family');
  const qs = groups.flatMap((f) => [...f.q].sort((a, b) => (app.qById[b]?.freq || 0) - (app.qById[a]?.freq || 0)).map((id) => app.qById[id]));
  const top = h('div', { class: 'card hero' },
    h('div', { class: `hero-chip ${done ? 'ok' : ''}` }, done ? `✅ الدرس ${n} خلص` : isNext ? `الدرس ${n} · الجاي بالترتيب` : `الدرس ${n} من ${lessons.length}`),
    h('p', {}, `${qs.length} سؤال حقيقي، هنذاكرهم سؤال سؤال: افهم السؤال ← 🔴 الكلمة اللي هتدوّر عليها ← 🟢 الإجابة ← 🧠 من دماغك.`),
    h('p', { class: 'muted small' }, `الأسئلة دي بتيجي في ${L.papers} من ${papers.length} ورقة امتحان.`),
    startBtn,
    !done && !isNext && S.cur ? h('div', { class: 'muted small' }, `💡 الترتيب المقترح بيبدأ بالدرس ${S.cur.n}، بس تقدر تذاكر الدرس ده دلوقتي عادي.`) : null,
    S.resumable && S.sessionLesson && S.sessionLesson !== n && !done ? h('div', { class: 'muted small' }, `لو بدأته، الدرس ${S.sessionLesson} اللي كنت فيه هيقف، واللي اتعلمته منه بيفضل محفوظ.`) : null);
  return page(`${L.emoji} ${L.title_ar}`, top,
    h('section', { class: 'card' }, h('h3', {}, `أسئلة الدرس (${qs.length})`),
      h('p', { class: 'muted small' }, 'دوس على أي سؤال تشوف الكلمة الحمرا 🔴 والإجابة 🟢. بس الأحسن تبدأ الدرس، وهو يمشي معاك خطوة خطوة.'),
      ...qs.map((q, i) => questionItem(app, q, i + 1))),
    h('nav', { class: 'lesson-nav' },
      n > 1 ? h('a', { class: 'btn ghost', href: `#/lesson/${n - 1}` }, `→ الدرس ${n - 1}`) : h('span'),
      n < lessons.length ? h('a', { class: 'btn ghost', href: `#/lesson/${n + 1}` }, `الدرس ${n + 1} ←`) : h('span')));
}

// ---------------- stories ----------------
export function story(app, params) {
  const t = +(params[0] || 1);
  const s = app.DATA.stories.find((x) => x.topic === t) || app.DATA.stories[0];
  const tabs = h('nav', { class: 'tabs' }, app.DATA.stories.map((x) =>
    h('a', { class: `tab ${x.topic === s.topic ? 'on' : ''}`, href: `#/story/${x.topic}` }, `${x.topic} · ${app.topicName(x.topic)}`)));
  return page('📖 قصة كل موضوع',
    h('p', { class: 'lead' }, 'بدل 15 معلومة متفرقة: قصة واحدة مضحكة لكل موضوع. اقراها بصوت عالي مرة كل يومين.'),
    tabs,
    h('article', { class: 'card story' }, h('h2', {}, s.title_ar),
      h('ol', { class: 'story-lines' }, s.lines.map((l) => h('li', {}, mixed(l))))),
    h('div', { class: 'card' }, h('h3', {}, 'الجروبات اللي في القصة دي'),
      h('div', { class: 'chip-row' }, (s.families || []).map((id) => h('a', { class: 'tab', href: `#/bank/all` }, app.byId[id]?.title_ar || id)))));
}

// ---------------- listen mode (for walking) ----------------
// iPhone / iPad: Safari plays speech ONLY if the first speak() happens right inside the tap
// (an await before it — like the screen wake lock — silently blocks all sound). So start()
// speaks first and asks for the wake lock afterwards. If no sound starts, a help box shows.
export function listen(app) {
  const st = app.state;
  const synth = window.speechSynthesis;
  const learnedFams = families(app).filter((f) => st.cards[f.id]);
  const pool = (learnedFams.length ? learnedFams : families(app).sort((a, b) => b.value - a.value).slice(0, 8))
    .flatMap((f) => f.q.map((id) => ({ fam: f, q: app.qById[id] })));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  let idx = 0, playing = false, timer = null, guard = null, wake = null, current = null;
  const voiceFor = (lang) => synth?.getVoices().find((v) => v.lang?.toLowerCase().startsWith(lang));
  const stage = h('div', { class: 'card listen-card' });
  const status = h('div', { class: 'muted small' });
  const help = h('div', { class: 'tip-card hot', hidden: true },
    h('b', {}, '🔇 مفيش صوت؟'),
    h('ol', { class: 'help-steps' },
      h('li', {}, 'شيل الموبايل أو الآيباد من الصامت (زرار الجرس على الجنب أو من Control Center).'),
      h('li', {}, 'علّي الصوت بزرار الصوت.'),
      h('li', {}, 'اضغط ⏸ وقّف، وبعدين ▶︎ ابدأ تاني.')),
    h('div', { class: 'small' }, 'لو لسه مفيش صوت: الكلام هيظهر مكتوب ويتقلب لوحده.'));
  const playBtn = h('button', { class: 'btn big', type: 'button', onclick: () => (playing ? stop() : start()) }, '▶︎ ابدأ');
  const nextBtn = h('button', { class: 'btn big ghost', type: 'button', onclick: () => { cancel(); idx++; if (playing) run(); else draw(false); } }, '⏭ التالي');
  const testBtn = h('button', { class: 'btn small ghost', type: 'button', onclick: () => testSound() }, '🔊 جرّب الصوت');
  const arToggle = h('input', { type: 'checkbox', checked: true, id: 'ar-hook' });

  function draw(showAnswer) {
    clear(stage);
    const item = pool[idx % pool.length];
    stage.append(h('div', { class: 'muted small' }, `${(idx % pool.length) + 1} من ${pool.length} · ${item.fam.title_ar}`),
      h('div', { class: 'question' }, hu(item.q.hu, { highlight: true })));
    if (showAnswer) {
      stage.append(accentWord(item.q.answer_hu), h('div', { class: 'answer-ar' }, mixed(item.q.answer_ar || '')));
      const hk = item.q.hooks?.[0] || app.currentHook(item.fam)?.text;
      if (hk) stage.append(h('div', { class: 'hook small' }, '💡 ', mixed(hk)));
    }
    return item;
  }
  // Safari 17+: play even when the silent switch is on.
  function prepareAudio() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
    try { if (synth?.paused) synth.resume(); } catch { /* ignore */ }
  }
  function say(text, lang, cb) {
    if (!synth) { timer = setTimeout(cb, 2500); return; }
    const u = new SpeechSynthesisUtterance(text);
    current = u;                       // keep a reference: some browsers drop events of lost utterances
    const v = voiceFor(lang);
    if (v) u.voice = v;
    u.lang = lang === 'hu' ? 'hu-HU' : 'ar-EG';
    u.rate = lang === 'hu' ? 0.85 : 1;
    let started = false, finished = false;
    const finish = (delay) => {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      if (!playing || current !== u) return;
      if (delay) timer = setTimeout(cb, delay); else cb();
    };
    u.onstart = () => { started = true; help.hidden = true; };
    u.onend = () => finish(0);
    u.onerror = () => finish(1500);
    clearTimeout(guard);
    guard = setTimeout(() => {        // nothing started → show the help, keep going silently
      if (started || !playing || current !== u) return;
      help.hidden = false;
      finish(Math.min(6000, 1500 + text.length * 70));
      try { synth.cancel(); } catch { /* ignore */ }
    }, 3500);
    synth.speak(u);
  }
  function run() {
    const item = draw(false);
    say(item.q.hu, 'hu', () => {
      timer = setTimeout(() => {
        draw(true);
        say(item.q.answer_hu, 'hu', () => {
          const hk = item.q.hooks?.[0] || app.currentHook(item.fam)?.text;
          const after = () => { timer = setTimeout(() => { idx++; if (playing) run(); }, 2000); };
          if (hk && arToggle.checked && voiceFor('ar')) say(hk.replace(/[^؀-ۿ0-9\s،؟!.]/g, ' ').replace(/\s{2,}/g, ' '), 'ar', after); else after();
        });
      }, 3000);
    });
  }
  function cancel() { clearTimeout(timer); clearTimeout(guard); current = null; try { synth?.cancel(); } catch { /* ignore */ } }
  function start() {
    playing = true; playBtn.textContent = '⏸ وقّف';
    prepareAudio();
    if (synth && (synth.speaking || synth.pending)) synth.cancel();
    run();                             // speaks NOW, inside the tap
    try { navigator.wakeLock?.request('screen').then((w) => { wake = w; }).catch(() => {}); } catch { /* no wake lock */ }
  }
  function stop() { playing = false; playBtn.textContent = '▶︎ ابدأ'; cancel(); try { wake?.release(); } catch { /* ignore */ } wake = null; }
  function testSound() {
    if (!synth) { toast('الجهاز ده مش بيدعم القراءة بالصوت'); return; }
    stop();
    prepareAudio();
    const u = new SpeechSynthesisUtterance('Szia! Jó napot!');
    const v = voiceFor('hu');
    if (v) u.voice = v;
    u.lang = 'hu-HU';
    let ok = false;
    u.onstart = () => { ok = true; help.hidden = true; };
    current = u;
    synth.speak(u);
    setTimeout(() => { if (!ok) help.hidden = false; }, 3000);
  }

  const refreshStatus = () => {
    const huV = voiceFor('hu'), arV = voiceFor('ar');
    status.textContent = '';
    status.append(huV ? `🔊 صوت مجري: ${huV.name}` : '⚠️ مفيش صوت مجري على الجهاز: Settings ← Accessibility ← Spoken Content ← Voices ← Hungarian (نزّله مرة واحدة). من غيره هيتقرا بلكنة غلط.',
      h('br'), arV ? `🔊 صوت عربي: ${arV.name}` : 'مفيش صوت عربي، فالـ hook هيظهر مكتوب بس.');
  };
  synth?.addEventListener?.('voiceschanged', refreshStatus);
  refreshStatus();
  draw(false);
  const el = page('🎧 وضع الاستماع',
    h('p', { class: 'lead' }, 'وانت ماشي: بيقرا السؤال بالمجري، يستنى 3 ثواني (جاوب في دماغك)، وبعدين يقول الإجابة والـ hook.'),
    stage,
    h('div', { class: 'grade-row' }, playBtn, nextBtn),
    help,
    h('label', { class: 'check-row' }, arToggle, ' اقرا الـ hook بالعربي كمان'),
    h('div', { class: 'listen-tools' }, testBtn, h('span', { class: 'muted small' }, 'مفيش صوت؟ شيل الصامت وعلّي الصوت.')),
    status,
    h('p', { class: 'muted small' }, learnedFams.length ? `بيلف على ${pool.length} سؤال من الجروبات اللي اتعلمتها.` : 'لسه ما اتعلمتش جروبات، فبيلف على أهم 8 جروبات.'));
  if (!synth) toast('الجهاز ده مش بيدعم القراءة بالصوت، هتظهر مكتوبة بس');
  return { el, cleanup: () => { stop(); synth?.removeEventListener?.('voiceschanged', refreshStatus); } };
}

// ---------------- try the writing pad (Apple Pencil, or a finger without one) ----------------
export function padtest() {
  const pad = createPad({ height: 260, guide: 'Vörösmarty', guideMode: 'trace' });
  let warned = false;
  pad.el.addEventListener('pad:finger', () => {
    if (!warned) { warned = true; toast('الصباع مبقاش بيكتب هنا بعد ما استخدمت القلم، عشان الكف ميرسمش وانت بتكتب'); }
  });
  const el = page('✍️ جرّب الكتابة',
    h('p', { class: 'lead' }, 'اكتب فوق الكلمة الرمادي بالقلم (Apple Pencil). على الآيفون أو من غير قلم: اكتب بصباعك.'),
    h('div', { class: 'card write-card' }, pad.el,
      h('div', { class: 'pad-tools' },
        h('button', { class: 'btn small ghost', type: 'button', onclick: () => pad.undo() }, '↩︎ تراجع'),
        h('button', { class: 'btn small ghost', type: 'button', onclick: () => pad.clear() }, '🗑 امسح'))),
    h('p', { class: 'muted small' }, 'أول ما تكتب بالقلم مرة، الصباع والكف مش هيرسموا تاني (عشان إيدك وهي على الشاشة متكتبش). ده نفس المربع اللي في تدريب الكتابة في الدروس.'));
  return { el, cleanup: () => pad.destroy() };
}
