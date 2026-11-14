// First run: exam date + time → Scribble setup → day-1 mock exam.
import { h, clear, answerField, hu } from '../ui.js';
import { isoFromDay } from '../lib/srs.js';
import { todayPlan, planSummary } from './home.js';

export function planInputs(app, onChange) {
  const s = app.state.settings;
  const date = h('input', { type: 'date', class: 'date', value: s.examDate || '', min: isoFromDay(app.today()), 'aria-label': 'ميعاد الامتحان' });
  // what the date means: minutes a day + when the review days start
  const preview = h('div', { class: 'plan-preview' });
  const drawPreview = () => {
    clear(preview);
    const xp = todayPlan(app);
    if (!xp) return;
    if (xp.phase === 'learn') preview.append(h('div', { class: 'goal-min' }, `⏱ هتذاكر حوالي ${xp.minutesDay} دقيقة في اليوم (${xp.goal} سؤال)`));
    preview.append(planSummary(app, xp));
  };
  date.addEventListener('change', () => { s.examDate = date.value || null; app.save(); drawPreview(); onChange?.(); });
  const chipRow = (values, key, fmt) => {
    const row = h('div', { class: 'chip-row' });
    const draw = () => {
      clear(row);
      for (const v of values) {
        row.append(h('button', { type: 'button', class: `chip-btn ${s[key] === v ? 'on' : ''}`, 'aria-pressed': String(s[key] === v),
          onclick: () => { s[key] = v; app.save(); draw(); drawPreview(); onChange?.(); } }, fmt(v)));
      }
    };
    draw();
    return row;
  };
  const wrap = h('div', { class: 'plan-inputs' },
    h('label', { class: 'q-label' }, '📅 امتحانك امتى؟', date),
    h('div', { class: 'muted small' }, 'لما تحدّده، هقسّم الأسئلة على الأيام وأسيبلك آخر أسبوعين مراجعة. لو لسه مش عارف، سيبه فاضي وحدّده بعدين.'),
    preview,
    h('div', { class: 'q-label' }, '⏱ بتذاكر كام دقيقة في اليوم؟ (لو مفيش ميعاد امتحان)'),
    chipRow([10, 15, 20, 30], 'minutes', (v) => `${v} دقيقة`),
    h('div', { class: 'q-label' }, '📆 كام يوم في الأسبوع؟'),
    chipRow([3, 4, 5, 6, 7], 'daysPerWeek', (v) => `${v}`));
  drawPreview();
  return wrap;
}

// "A ← B ← C" with English menu names: each name isolated so the order stays right in Arabic.
const path = (...steps) => h('span', { class: 'path' },
  steps.map((s, i) => [i ? h('span', { class: 'arr', 'aria-hidden': 'true' }, '←') : null, h('bdi', { class: 'step' }, s)]));

export function scribbleGuide() {
  const test = answerField({ label: 'جرّب: اكتب الكلمة دي بالقلم ← zöld' });
  const verdict = h('div', { class: 'muted' });
  test.field.addEventListener('input', () => {
    const v = test.value().trim().toLowerCase();
    verdict.textContent = !v ? '' : v.includes('ö') ? '✅ تمام! الآيباد بيقرا ö — الإعدادات مظبوطة.'
      : v.replace(/[^a-z]/g, '').includes('zold') ? '🟡 قرا الكلمة بس من غير ö — غالباً Scribble لسه إنجليزي. ضيف كيبورد Deutsch (الخطوة 1).'
        : 'لو قرا غلط، اكتب بخط أكبر وأبطأ شوية، وجرّب تاني.';
  });
  return h('div', { class: 'scribble' },
    h('h2', {}, '✍️ خلّي الآيباد يقرا خطك (Scribble)'),
    h('p', {}, 'الامتحان الحقيقي بخط الإيد. في التطبيق هتكتب بالقلم جوه المربعات، والآيباد هيحوّل خطك لكلام ويصحّحلك.'),
    h('ol', { class: 'steps' },
      h('li', {}, 'افتح: ', path('Settings (الإعدادات)', 'General (عام)', 'Keyboard', 'Keyboards', 'Add New Keyboard', 'Deutsch (German)')),
      h('li', {}, 'ارجع للإعدادات: ', path('Apple Pencil', 'Scribble'), ' ← فعّله. هتلاقي ', h('bdi', {}, 'Deutsch'), ' ظهرت في لغات Scribble.'),
      h('li', {}, 'جرّب في المربع تحت: اكتب ', hu('zöld'), ' بالقلم.')),
    h('div', { class: 'card soft' },
      h('b', {}, 'ليه الألماني مش الإنجليزي؟ '),
      'المجري مش موجود في Scribble. الألماني بيقرا ', hu('ö'), ' و', hu('ü'), ' — وهما كتير في الإجابات (Kölcsey، Vörösmarty، zöld، Görgei). الإنجليزي هيشيلهم. ',
      'باقي العلامات (', hu('á é í ó ú ő ű'), ') ولا لغة هتقراها — ومش مشكلة: التطبيق مش بيحسب العلامات غلط، بيفكّرك بيها بس، وتدريب الكتابة بيعلّمها لإيدك.'),
    test.el, verdict,
    h('p', { class: 'muted small' }, 'لو الآيباد قرا غلط في أي سؤال، هتلاقي زرار «الآيباد قرأ غلط» تصحّح بيه بنفسك.'));
}

export function render(app, params) {
  const st = app.state;
  const step = +(params[0] || 1);
  const go = (n) => app.go(`setup/${n}`);
  const wrap = h('div', { class: 'screen setup' });
  const dots = h('div', { class: 'dots' }, [1, 2, 3].map((n) => h('span', { class: n === step ? 'on' : '' })));
  if (step === 1) {
    wrap.append(dots,
      h('h1', {}, 'أهلاً! 👋'),
      h('p', { class: 'lead' }, 'هنعدّي امتحان الثقافة المجرية بأقل مجهود: محتاج 16 من 30 بس. كل الأسئلة هنا حقيقية من امتحانات الناس، وكل يوم 15 دقيقة.'),
      planInputs(app),
      h('div', { class: 'actions' }, h('button', { class: 'btn big', type: 'button', onclick: () => go(2) }, 'التالي ←')));
  } else if (step === 2) {
    const phone = /iPhone|iPod|Android.+Mobile/.test(navigator.userAgent);
    wrap.append(dots,
      ...(phone ? [h('div', { class: 'tip-card soft' }, '📱 انت على الموبايل: الخطوة دي للآيباد والقلم بس. على الموبايل هتكتب بالكيبورد عادي، فدوس «التالي».')] : []),
      scribbleGuide(),
      h('div', { class: 'actions' },
        h('button', { class: 'btn big ghost', type: 'button', onclick: () => go(1) }, '→ رجوع'),
        h('button', { class: 'btn big', type: 'button', onclick: () => go(3) }, 'التالي ←')));
  } else {
    const finish = (where) => { st.settings.setupDone = true; app.save(); app.go(where); };
    const first = app.DATA.lessons[0];
    wrap.append(dots,
      h('h1', {}, 'جاهز! 🎉'),
      h('p', { class: 'lead' }, `كل يوم درس واحد بالترتيب، حوالي 15 دقيقة. هتبدأ بالدرس 1: ${first.emoji} ${first.title_ar}، سؤال سؤال في 4 خطوات.`),
      h('div', { class: 'actions column' },
        h('button', { class: 'big-start', type: 'button', onclick: () => finish('session') }, 'ابدأ الدرس 1 ▶︎'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => finish('mock') }, '📝 اختياري: امتحان تجريبي الأول عشان تشوف شكله (60 دقيقة)')));
  }
  return wrap;
}

export function scribble(app) {
  return h('div', { class: 'screen page' },
    h('header', { class: 'page-top' }, h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'رجوع' }, '→'), h('h1', {}, 'إعداد الكتابة بالقلم')),
    scribbleGuide());
}
