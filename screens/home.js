// Home = ONE clear next step: today's lesson. Lessons are studied in order, one a day
// (data/lessons.json). Everything else is under "حاجات تانية".
import { h } from '../ui.js';
import { buildSession, streak, currentLesson, lessonDone, papersPassed, examPlan, dueCards } from '../lib/plan.js';
import { dayFromISO } from '../lib/srs.js';

export const dateAr = (day) => new Date(day * 864e5).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', timeZone: 'UTC' });

// A question is known once its answer group is learned, or once it was taught (a lesson can be split).
export function knownCount(app) {
  const st = app.state;
  return app.DATA.questions.filter((q) => st.cards[q.family] || st.taught?.[q.id] != null).length;
}

// The exam-date plan for today (null when no exam date is set): how many questions / minutes today
// so that everything is learned before the last review days.
export function todayPlan(app) {
  const st = app.state;
  const s = st.settings;
  if (!s.examDate) return null;
  const today = app.today();
  const day = st.days[today] || {};
  const { questions, lessons, cards } = app.DATA;
  const qLeft = questions.length - knownCount(app);
  const taughtToday = (day.taught || []).length;
  if (!qLeft && !taughtToday && st.reviewStart == null) { st.reviewStart = today; app.save(); }
  const due = dueCards(cards.filter((c) => c.kind === 'family'), st.cards, today).length;
  return examPlan({ today, examDay: app.examDay(), startDay: dayFromISO(s.startDate), perWeek: s.daysPerWeek || 6,
    qLeft, taughtToday, due: Math.min(due, Math.round((s.minutes || 15) * 1.2)), lessons, reviewed: st.reviewed || {}, reviewStart: st.reviewStart });
}

function greeting() {
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 12) return 'صباح الفل ☀️';
  if (hr >= 12 && hr < 17) return 'أهلاً يا بطل 👋';
  return 'مساء الفل 🌙';
}

// Facts about where the learner is, shared by home, the plan page and the lesson page.
export function lessonStatus(app) {
  const st = app.state;
  const today = app.today();
  const day = st.days[today] || {};
  const { cards, lessons, papers, questions } = app.DATA;
  const freshToday = day.fresh || [];
  const cur = currentLesson(lessons, st.cards);   // the next lesson in the suggested order
  const plan = buildSession({ cards, states: st.cards, today, minutes: st.settings.minutes, freshToday, lessons, pick: cur?.n });
  const finishedToday = lessons.find((l) => lessonDone(l, st.cards) && l.cards.some((id) => freshToday.includes(id))) || null;
  const knownFams = new Set(cards.filter((c) => c.kind === 'family' && st.cards[c.id]).map((c) => c.id));
  return {
    today, day, plan, cur, finishedToday,
    done: lessons.filter((l) => lessonDone(l, st.cards)).length,
    waits: false,                                  // all lessons are open: nothing waits
    resumable: !!(st.session && st.session.day === today && st.session.mode === 'daily' && st.session.v === 5),
    sessionLesson: st.session && st.session.day === today && st.session.mode === 'daily' ? st.session.lesson || null : null,
    questionsKnown: knownCount(app),
    xp: todayPlan(app),
    pass: papersPassed(papers, app.qById, knownFams),
    goal: lessons.find((l) => l.pass === papers.length) || null,
  };
}

// The lesson path: done ✅ · next in the suggested order ▶️ · any other 📖 — every lesson is open
export function lessonPath(app, status = lessonStatus(app)) {
  const { lessons, papers } = app.DATA;
  const { cur, goal, sessionLesson } = status;
  const list = h('ol', { class: 'lesson-path' });
  for (const l of lessons) {
    const done = lessonDone(l, app.state.cards);
    const next = cur?.n === l.n;
    const started = !done && (l.cards.some((id) => app.state.cards[id]) || app.DATA.questions.some((q) => l.cards.includes(q.family) && app.state.taught?.[q.id] != null));
    const when = sessionLesson === l.n && !done ? 'كمّله' : next ? (started ? 'كمّله' : 'الجاي بالترتيب') : started ? 'بدأته' : '';
    list.append(h('li', {}, h('a', { class: `lesson-row ${done ? 'done' : next ? 'now' : ''}`, href: `#/lesson/${l.n}` },
      h('span', { class: 'lesson-num', 'aria-hidden': 'true' }, done ? '✓' : String(l.n)),
      h('span', { class: 'lesson-body' },
        h('span', { class: 'lesson-title' }, `${l.emoji} ${l.title_ar}`),
        h('span', { class: 'lesson-sub' }, `الدرس ${l.n} · ${l.q} سؤال حقيقي`, when ? h('b', {}, ` · ${when}`) : null)),
      h('span', { class: 'lesson-state', 'aria-label': done ? 'خلص' : next ? 'الدرس الجاي' : 'افتح الدرس' }, done ? '✅' : next ? '▶️' : '📖'))));
    if (goal && l.n === goal.n && goal.n < lessons.length) {
      list.append(h('li', { class: 'lesson-goal' }, `🎯 بعد الدرس ${goal.n}: لو فاكر اللي ذاكرته، بتنجح في الـ ${papers.length} ورقة امتحان الحقيقية كلهم. الدروس اللي بعده أمان زيادة.`));
    }
  }
  list.append(h('li', { class: 'lesson-goal soft' }, '📝 بعد الدروس: مراجعة كل يوم + امتحان بورقة حقيقية كل يومين لحد يوم الامتحان.'));
  return list;
}

function hero(app, S) {
  const { lessons, papers } = app.DATA;
  const { plan, cur, day, finishedToday, resumable } = S;
  const freshCards = plan.fresh.map((id) => app.byId[id]).filter(Boolean);
  const nQ = freshCards.filter((c) => c.kind === 'family').reduce((n, c) => n + c.q.length, 0);
  const nWords = freshCards.filter((c) => c.kind !== 'family').length;
  // a lesson = reviews (~25 s each) + every question in 4 small steps (~1 min each)
  const mins = Math.max(3, Math.round(plan.review.length * 0.4 + nQ * 1.1));
  const box = h('section', { class: 'hero card' });
  const steps = (fresh) => h('div', { class: 'hero-steps muted small' },
    `حوالي ${mins} دقيقة: `, plan.review.length ? `مراجعة ${plan.review.length} ← ` : '', fresh ? `${nQ} سؤال، كل سؤال في 4 خطوات` : 'مراجعة بس');

  if (S.xp?.phase === 'review' && !resumable) return reviewHero(app, S, box);
  if (!cur) {   // every lesson learned: daily review + a real paper every 2 days
    box.append(h('div', { class: 'hero-chip' }, `🎓 خلصت الـ ${lessons.length} درس!`),
      h('h2', { class: 'hero-title' }, 'دلوقتي: مراجعة كل يوم'),
      h('p', { class: 'muted' }, 'مراجعة + 3 أسئلة امتحان كل يوم، وامتحان بورقة حقيقية كل يومين.'));
    box.append(day.done
      ? h('a', { class: 'big-start soft-start', href: '#/session/extra' }, '✅ خلصت النهارده · 5 أسئلة زيادة؟')
      : h('a', { class: 'big-start', href: '#/session' }, resumable ? 'كمّل مراجعة النهارده ▶︎' : 'ابدأ مراجعة النهارده ▶︎'));
    if (!day.done) box.append(steps(0));
    return box;
  }
  if (resumable) {
    const L = (S.sessionLesson && lessons[S.sessionLesson - 1]) || cur;
    box.append(h('div', { class: 'hero-chip' }, `الدرس ${L.n} من ${lessons.length}`),
      h('h2', { class: 'hero-title' }, `${L.emoji} ${L.title_ar}`),
      h('a', { class: 'big-start', href: '#/session' }, `كمّل الدرس ${L.n} ▶︎`),
      h('div', { class: 'hero-steps muted small' }, 'هتكمّل من نفس المكان اللي وقفت فيه.'));
    return box;
  }
  const xp = S.xp;
  if (xp?.phase === 'eve') {
    box.append(h('div', { class: 'hero-chip ok' }, '🌙 بكره الامتحان'),
      h('h2', { class: 'hero-title' }, 'النهارده: ورقة الليلة الأخيرة بس'),
      h('p', { class: 'muted' }, 'اقراها مرتين بالراحة، ونام بدري. متذاكرش حاجة جديدة.'),
      h('a', { class: 'big-start', href: '#/sheet' }, '🌙 افتح ورقة الليلة الأخيرة ▶︎'));
    return box;
  }
  if (xp?.phase === 'learn') return learnHero(app, S, box);
  const startNext = `#/session/lesson/${cur.n}`;
  if (day.done) {   // already studied today: the next lesson is open too, as an option
    box.append(h('div', { class: 'hero-chip ok' }, finishedToday ? `✅ خلصت الدرس ${finishedToday.n} النهارده` : '✅ خلصت مذاكرة النهارده'),
      h('h2', { class: 'hero-title' }, 'برافو! 👏'),
      h('p', {}, h('b', {}, 'الدرس الجاي: '), `الدرس ${cur.n} · ${cur.emoji} ${cur.title_ar}`),
      h('a', { class: 'btn big wide', href: startNext }, `عايز تكمّل؟ ابدأ الدرس ${cur.n} دلوقتي ▶︎`),
      h('div', { class: 'muted small center' }, 'الأحسن درس واحد في اليوم عشان مخك يثبّت 🧠، بس براحتك. وكل الدروس مفتوحة تحت.'),
      h('a', { class: 'btn ghost wide', href: '#/session/extra' }, 'عايز تتمرن أكتر؟ 5 أسئلة امتحان (اختياري)'),
      h('a', { class: 'btn ghost wide', href: '#/plan/reminder' }, '⏰ ذكّرني كل يوم عشان منساش'));
    return box;
  }
  box.append(h('div', { class: 'hero-chip' }, `الدرس ${cur.n} من ${lessons.length}`),
    h('h2', { class: 'hero-title' }, `${cur.emoji} ${cur.title_ar}`),
    h('p', { class: 'muted' }, `${cur.q} سؤال حقيقي، هنمسكهم سؤال سؤال · بييجي منهم في ${cur.papers} من ${papers.length} ورقة امتحان`),
    h('a', { class: 'big-start', href: startNext }, `ابدأ الدرس ${cur.n} ▶︎`), steps(plan.fresh.length),
    h('div', { class: 'muted small center' }, 'ده الدرس الجاي بالترتيب المقترح. وكل الدروس مفتوحة تحت: دوس على أي درس.'));
  return box;
}

// The plan in a few lines (the plan page and the settings): learning days → review days → the exam eve.
export function planSummary(app, xp) {
  if (!xp || xp.phase === 'over' || xp.phase === 'exam') return h('p', { class: 'muted' }, 'الامتحان النهارده أو عدّى.');
  const ex = app.examDay();
  const rows = [];
  if (xp.phase === 'learn') {
    rows.push(h('li', {}, h('b', {}, `من النهارده لحد ${dateAr(xp.learnEnd)}: `), `أسئلة جديدة — حوالي ${xp.goal} سؤال في اليوم (${xp.minutesDay} دقيقة تقريباً). فاضل ${xp.qLeft} سؤال.`));
  }
  if (xp.reviewDays > 1 || xp.phase === 'review') {
    rows.push(h('li', {}, h('b', {}, `من ${dateAr(Math.max(xp.reviewFrom, xp.phase === 'review' ? app.today() : xp.reviewFrom))} لحد ${dateAr(ex - 2)}: `), 'مراجعة: كل الدروس تاني من الأول، كام درس كل يوم، + امتحان تجريبي كل يومين.'));
  }
  rows.push(h('li', {}, h('b', {}, `${dateAr(ex - 1)}: `), 'ورقة الليلة الأخيرة بس، ونوم بدري.'));
  rows.push(h('li', {}, h('b', {}, `${dateAr(ex)}: `), 'الامتحان 💪'));
  return h('div', {},
    xp.phase === 'learn' && xp.late ? h('p', { class: 'bad-text' }, `⏰ الوقت ضيق: مفيش وقت لأسبوعين مراجعة كاملين. خلّص الأسئلة الأول، وراجع في الأيام اللي فاضلة.`) : null,
    xp.phase === 'learn' && !xp.late && xp.reviewDays < 14 ? h('p', { class: 'muted small' }, `الوقت مش كفاية لأسبوعين مراجعة، فخليتهم ${xp.reviewDays} أيام.`) : null,
    h('ul', { class: 'plan-steps' }, rows),
    h('p', { class: 'muted small' }, 'الحسبة بتتعدّل لوحدها كل يوم: لو فوّت يوم، الأسئلة اللي فاضلة بتتقسم تاني على الأيام اللي فاضلة.'));
}

const qAr = (n) => (n === 1 ? 'سؤال واحد' : n === 2 ? 'سؤالين' : n <= 10 ? `${n} أسئلة` : `${n} سؤال`);

// Learning days (exam date set): today's goal = the questions left ÷ the study days before the review days.
function learnHero(app, S, box) {
  const { lessons } = app.DATA;
  const { xp, cur } = S;
  const why = h('div', { class: 'muted small center' }, xp.late
    ? `⏰ الوقت ضيق: لازم تخلّص الأسئلة اللي فاضلة في ${xp.days} يوم، وبعدها مراجعة.`
    : `عشان تخلّص كل الأسئلة يوم ${dateAr(xp.learnEnd)}، وتراجع كل حاجة من الأول في آخر ${xp.reviewDays} يوم قبل الامتحان.`);
  if (!xp.rest) {   // today's goal is done
    box.append(h('div', { class: 'hero-chip ok' }, '✅ خلصت هدف النهارده'),
      h('h2', { class: 'hero-title' }, 'برافو! 👏 كده انت ماشي في الميعاد'),
      cur ? h('p', {}, h('b', {}, 'بكره: '), `الدرس ${cur.n} · ${cur.emoji} ${cur.title_ar}`) : null,
      cur ? h('a', { class: 'btn ghost wide', href: `#/session/lesson/${cur.n}` }, `عايز تكمّل؟ كمّل الدرس ${cur.n} دلوقتي (اختياري)`) : null,
      h('a', { class: 'btn ghost wide', href: '#/session/extra' }, 'عايز تتمرن أكتر؟ 5 أسئلة امتحان (اختياري)'),
      h('a', { class: 'btn ghost wide', href: '#/plan/reminder' }, '⏰ ذكّرني كل يوم عشان منساش'), why);
    return box;
  }
  const inLesson = app.DATA.questions.filter((q) => cur.cards.includes(q.family) && !app.state.cards[q.family] && app.state.taught?.[q.id] == null).length;
  const nextL = lessons[cur.n];
  box.append(h('div', { class: 'hero-chip' }, `الدرس ${cur.n} من ${lessons.length}`),
    h('h2', { class: 'hero-title' }, `${cur.emoji} ${cur.title_ar}`),
    h('div', { class: 'goal-box' },
      h('div', { class: 'goal-min' }, '⏱ النهارده ذاكر حوالي ', h('b', {}, `${xp.minutes} دقيقة`)),
      h('div', {}, `🎯 هدف النهارده: ${qAr(xp.rest)} ${xp.rest > 2 && xp.rest <= 10 ? 'جديدة' : 'جديد'}${xp.rest > inLesson && nextL ? ` (${qAr(inLesson)} من الدرس ${cur.n} وتكمّل في الدرس ${nextL.n})` : ''}`)),
    h('a', { class: 'big-start', href: '#/session/today' }, `ابدأ مذاكرة النهارده ▶︎`), why);
  return box;
}

// The last days before the exam: every lesson again from lesson 1, a few a day.
function reviewHero(app, S, box) {
  const { lessons } = app.DATA;
  const { xp } = S;
  const list = xp.todayLessons.map((t) => lessons[t.n - 1]);
  const next = xp.todayLessons.find((t) => !t.done);
  box.append(h('div', { class: 'hero-chip' }, `🔁 أيام المراجعة · فاضل ${xp.left} يوم على الامتحان`),
    h('h2', { class: 'hero-title' }, xp.round ? 'مراجعة تانية على كل حاجة' : 'راجع كل حاجة من الأول'),
    h('ul', { class: 'review-today' }, list.map((l, i) => h('li', { class: xp.todayLessons[i].done ? 'done' : '' },
      xp.todayLessons[i].done ? '✅ ' : '▫️ ', `الدرس ${l.n} · ${l.emoji} ${l.title_ar}`))));
  if (next) {
    box.append(h('div', { class: 'goal-box' }, h('div', { class: 'goal-min' }, '⏱ النهارده راجع حوالي ', h('b', {}, `${xp.minutes} دقيقة`))),
      h('a', { class: 'big-start', href: `#/session/lesson/${next.n}` }, `راجع الدرس ${next.n} ▶︎`),
      h('div', { class: 'muted small center' }, 'هتعدّي على كل سؤال تاني بالـ 4 خطوات. كده كل الدروس هتتراجع قبل الامتحان.'));
  } else {
    box.append(h('p', {}, '✅ خلصت مراجعة النهارده. برافو! 👏'),
      h('a', { class: 'btn ghost wide', href: '#/mock' }, '📝 امتحان تجريبي بورقة حقيقية (اختياري)'),
      h('a', { class: 'btn ghost wide', href: '#/session/extra' }, '5 أسئلة امتحان زيادة (اختياري)'));
  }
  return box;
}

export function render(app) {
  const st = app.state;
  const S = lessonStatus(app);
  const { today } = S;
  const { lessons, questions, papers } = app.DATA;
  const left = app.daysLeft();
  const s = streak(st.days, today);
  const lastMock = st.mocks[st.mocks.length - 1];
  const mockDue = (!S.cur || app.phaseNow() === 3) && (!lastMock || today - lastMock.day >= 2);

  const countdown = !st.settings.examDate
    ? h('a', { class: 'count soft', href: '#/settings' }, '📅 حدّد ميعاد امتحانك')
    : left > 1 ? h('div', { class: 'count' }, h('b', {}, left), ' يوم على الامتحان')
      : left === 1 ? h('div', { class: 'count hot' }, 'الامتحان بكره! اقرا ورقة الليلة الأخيرة ونام بدري 😴')
        : left === 0 ? h('div', { class: 'count hot' }, 'النهارده الامتحان! بالتوفيق 💪')
          : h('a', { class: 'count soft', href: '#/settings' }, 'الامتحان عدّى؟ لو اتأجل غيّر الميعاد');

  const tips = [];
  const later = [];
  if (mockDue) tips.push(h('a', { class: 'tip-card hot', href: '#/mock' }, '📝 النهارده يوم امتحان تجريبي بورقة حقيقية ←'));
  if (left > 0 && left <= 2) tips.push(h('a', { class: 'tip-card', href: '#/sheet' }, '🌙 ورقة الليلة الأخيرة: كل الإجابات في صفحة واحدة ←'));
  if (!st.settings.examDate) tips.push(h('a', { class: 'tip-card soft', href: '#/settings' }, '📅 حدّد ميعاد امتحانك، وأنا أقسّملك المذاكرة على الأيام: أقولك تذاكر كام دقيقة كل يوم، وأسيبلك آخر أسبوعين مراجعة ←'));
  if (S.plan.backlog > 0) tips.push(h('div', { class: 'tip-card soft' }, 'رجعت؟ أهلاً بيك 👋 الدرس هيبدأ بمراجعة اللي فات. ولو الوقت ضيق، اعمل المراجعة النهارده والدرس بكرة.'));
  if (!st.mocks.length && !S.done && !S.resumable && !S.day.fresh?.length) {
    later.push(h('a', { class: 'tip-card soft', href: '#/mock' }, h('b', {}, 'اختياري: '), 'عايز تشوف شكل الامتحان قبل ما تبدأ؟ امتحان تجريبي ', h('span', { class: 'link' }, '←')));
  }

  return h('div', { class: 'screen home' },
    h('header', { class: 'home-top' },
      h('div', {}, h('div', { class: 'hello' }, greeting()), h('div', { class: 'muted small' }, 'امتحان الثقافة المجرية 🇭🇺')),
      h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'الإعدادات' }, '⚙️')),
    h('div', { class: 'status-row' }, countdown,
      h('div', { class: 'streak' }, s ? ['🔥 ', h('b', {}, s), s === 1 ? ' يوم' : ' أيام'] : '🔥 يلا نبدأ')),
    hero(app, S),
    ...tips,
    h('section', { class: 'card lessons-card' },
      h('div', { class: 'lessons-head' }, h('h3', {}, '📚 الدروس بالترتيب'), h('span', { class: 'muted small' }, `كل الدروس مفتوحة · خلصت ${S.done} من ${lessons.length}`)),
      lessonPath(app, S)),
    ...later,
    h('div', { class: 'progress-card' },
      h('div', {}, `بقيت تعرف إجابات ${S.questionsKnown} من ${questions.length} سؤال حقيقي`),
      h('div', { class: 'bar' }, h('span', { style: { width: `${Math.round((S.questionsKnown / questions.length) * 100)}%` } })),
      h('div', { class: 'muted small' }, S.pass
        ? `🎯 لو جالك امتحان من الـ ${papers.length} ورقة الحقيقية: هتنجح في ${S.pass} منهم (لو فاكر اللي ذاكرته)`
        : S.goal ? `🎯 بعد الدرس ${S.goal.n} هتنجح في الـ ${papers.length} ورقة الحقيقية كلهم (لو فاكر اللي ذاكرته)` : ''),
      lastMock ? h('div', { class: 'muted small' }, `آخر امتحان تجريبي: ${lastMock.total} من 30 ${lastMock.total >= 16 ? '✅ ناجح' : '(النجاح 16)'}`) : null),
    // the extras stay out of the way: the lessons are the main thing
    h('details', { class: 'more' },
      h('summary', {}, '➕ حاجات تانية (اختياري)'),
      h('nav', { class: 'links' },
        link('#/bank', '📚', 'كل الأسئلة'),
        link('#/mock', '📝', 'امتحان تجريبي'),
        link('#/sheet', '🌙', 'ورقة الليلة الأخيرة'),
        link('#/listen', '🎧', 'وضع الاستماع'),
        link('#/story', '📖', 'قصة كل موضوع'),
        link('#/decoder', '🔑', 'كلمات الأسئلة'),
        link('#/plan', '🗓', 'الخطة والتواريخ'),
        link('#/settings', '⚙️', 'الإعدادات'))),
  );
}

const link = (href, icon, text) => h('a', { class: 'link-btn', href }, h('span', { class: 'ico', 'aria-hidden': 'true' }, icon), text);
