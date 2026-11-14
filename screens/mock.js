// Mock exam: looks like the real paper. 12 REAL questions (a reconstructed FB paper, or
// 2 random real questions per topic), 60-minute timer, auto-check, change any mark,
// score out of 30 (pass = 16). Points per question are an estimate (BFKH does not publish them).
import { h, hu, clear, toast, answerArea, accentWord } from '../ui.js';
import { checkAnswer } from '../lib/match.js';
import { grade } from '../lib/srs.js';

const LIMIT = 60 * 60 * 1000;

function weightedPick(list, n) {
  const pool = [...list];
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, q) => s + q.freq, 0);
    let r = Math.random() * total;
    const i = pool.findIndex((q) => (r -= q.freq) <= 0);
    out.push(pool.splice(i < 0 ? 0 : i, 1)[0]);
  }
  return out;
}

function buildPaper(app, which) {
  const Q = app.DATA.questions;
  let ids;
  let filled = [];
  if (which === 'random') {
    ids = [1, 2, 3, 4, 5, 6].flatMap((t) => weightedPick(Q.filter((q) => q.topic === t), 2).map((q) => q.id));
  } else {
    const p = app.DATA.papers.find((x) => x.id === which) || app.DATA.papers[0];
    ids = [...p.q];
    for (const t of [1, 2, 3, 4, 5, 6]) {
      while (ids.filter((id) => app.qById[id].topic === t).length < 1 || (ids.length < 12 && ids.filter((id) => app.qById[id].topic === t).length < 2)) {
        const add = Q.filter((q) => q.topic === t && !ids.includes(q.id)).sort((a, b) => b.freq - a.freq)[0];
        if (!add) break;
        ids.push(add.id); filled.push(add.id);
      }
    }
    ids.sort((a, b) => app.qById[a].topic - app.qById[b].topic);
  }
  const sets = ids.map((id) => {
    const q = app.qById[id];
    return q.type === 'mc' ? Math.floor(Math.random() * q.option_sets.length) : null;
  });
  return { paper: which, ids, sets, filled, started: Date.now(), answers: {} };
}

function pickPaperId(app) {
  const done = new Set(app.state.mocks.map((m) => m.paper));
  const fresh = app.DATA.papers.filter((p) => !done.has(p.id));
  const pool = fresh.length ? fresh : app.DATA.papers;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export function render(app, params) {
  const st = app.state;
  if (params[0] === 'result' && st.mocks[+params[1]]) return resultView(app, +params[1]);
  if (st.mockDraft && params[0] !== 'new') return paperView(app);
  return startView(app);
}

function startView(app) {
  const st = app.state;
  const begin = (which) => { st.mockDraft = buildPaper(app, which); app.save(); app.go('mock/paper'); };
  return h('div', { class: 'screen mock-start' },
    h('header', { class: 'page-top' }, h('a', { class: 'icon-btn', href: '#/home', 'aria-label': 'رجوع' }, '→'), h('h1', {}, '📝 امتحان تجريبي')),
    h('div', { class: 'card' },
      h('p', {}, 'زي الامتحان الحقيقي بالظبط: ', h('b', {}, '12 سؤال'), ' (2 من كل موضوع)، ', h('b', {}, '60 دقيقة'), '، ', h('b', {}, '30 نقطة'), '. النجاح = ', h('b', {}, '16 نقطة'), '.'),
      h('p', {}, 'الأسئلة كلها ', h('b', {}, 'حقيقية'), ' من امتحانات الناس. الأسئلة بالمجري بس — زي الورقة الحقيقية.'),
      h('p', { class: 'muted small' }, 'اكتب بالقلم في المربعات (Scribble بيحوّلها لكلام)، والاختيارات اضغط عليها. لو مش فاهم السؤال: اكتب أكتر إجابة متوقعة — متسيبش فاضي أبداً.'),
      h('p', { class: 'muted small' }, 'الدرجة تقديرية: BFKH مش بتنشر نقط كل سؤال، فالأسئلة اللي فيها أكتر من جزء خدت نقط أكتر.')),
    h('button', { class: 'big-start', type: 'button', onclick: () => begin(pickPaperId(app)) }, '🎲 ورقة امتحان حقيقية'),
    h('button', { class: 'btn big ghost wide', type: 'button', onclick: () => begin('random') }, 'عشوائي: سؤالين حقيقيين من كل موضوع'),
    h('details', { class: 'card' }, h('summary', {}, `اختار ورقة بعينها (${app.DATA.papers.length} ورقة من الفيسبوك)`),
      h('div', { class: 'paper-grid' }, app.DATA.papers.map((p) => {
        const best = Math.max(-1, ...st.mocks.filter((m) => m.paper === p.id).map((m) => m.total));
        return h('button', { class: 'btn small ghost', type: 'button', onclick: () => begin(p.id) },
          'ورقة ', h('b', { class: 'hu' }, p.id), best >= 0 ? h('span', { class: 'muted' }, ` · ${best}/30`) : null);
      }))),
    st.mocks.length ? h('div', { class: 'card' }, h('h3', {}, 'امتحاناتك اللي فاتت'),
      ...st.mocks.slice().reverse().slice(0, 8).map((m) => {
        const i = st.mocks.indexOf(m);
        return h('a', { class: 'row-link', href: `#/mock/result/${i}` },
          `${m.at.slice(0, 10)} · `, m.paper === 'random' ? 'عشوائي' : h('span', {}, 'ورقة ', h('b', { class: 'hu' }, m.paper)), ' · ', h('b', {}, `${m.total}/30`), m.pass ? ' ✅' : '');
      })) : null,
  );
}

function paperView(app) {
  const st = app.state;
  const D = st.mockDraft;
  const areas = [];
  const timer = h('div', { class: 'timer', role: 'timer' });
  const submitBtn = h('button', { class: 'btn', type: 'button', onclick: () => confirmSubmit() }, 'سلّم الورقة');
  const paper = h('div', { class: 'paper' },
    h('div', { class: 'paper-head' },
      h('div', { class: 'paper-title', dir: 'ltr', lang: 'hu' }, 'MAGYAR KULTURÁLIS ISMERETI VIZSGA'),
      h('div', { class: 'paper-meta', dir: 'ltr', lang: 'hu' }, 'Budapest Főváros Kormányhivatala · 60 perc · 30 pont'),
      h('div', { class: 'paper-name', dir: 'ltr', lang: 'hu' }, 'Név: ', h('span', { class: 'line' }))));
  let saveTimer;
  const saveDraft = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      D.answers = Object.fromEntries(areas.map((a, i) => [i, a.raw()]));
      app.save();
    }, 250);
  };
  D.ids.forEach((id, i) => {
    const q = app.qById[id];
    const area = answerArea(q, { setIndex: D.sets[i] ?? undefined, initial: D.answers[i] });
    areas.push(area);
    const block = h('section', { class: 'paper-q' },
      h('div', { class: 'q-num', dir: 'ltr' }, `${i + 1}.`),
      h('div', { class: 'q-body' }, h('div', { class: 'q-text' }, hu(q.hu)), area.el));
    block.addEventListener('input', saveDraft);
    block.addEventListener('click', saveDraft);
    paper.append(block);
  });
  const confirmBox = h('div', { class: 'confirm', hidden: true });
  const root = h('div', { class: 'screen mock-paper' },
    h('div', { class: 'paper-bar' }, h('a', { class: 'icon-btn', href: '#/home', 'aria-label': 'خروج — إجاباتك محفوظة' }, '✕'), timer, submitBtn),
    paper, confirmBox,
    h('div', { class: 'actions' }, h('button', { class: 'btn big wide', type: 'button', onclick: () => confirmSubmit() }, 'سلّم الورقة ✔︎')));

  function tick() {
    const left = Math.max(0, LIMIT - (Date.now() - D.started));
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    timer.textContent = `⏱ ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    timer.classList.toggle('hot', left < 5 * 60000);
    if (left <= 0) { clearInterval(iv); toast('الوقت خلص ⏰ — بنصحح الورقة'); submit(); }
  }
  const iv = setInterval(tick, 1000);
  tick();

  function confirmSubmit() {
    const empty = areas.filter((a) => {
      const v = a.raw();
      return !v.length || v.every((x) => (typeof x === 'string' ? !x.trim() : false));
    }).length;
    if (!empty) return submit();
    clear(confirmBox);
    confirmBox.hidden = false;
    confirmBox.append(
      h('p', {}, `فيه ${empty} ${empty === 1 ? 'سؤال فاضي' : 'أسئلة فاضية'}. متسيبش فاضي أبداً — اكتب أقرب إجابة، يمكن تجيب نقطة.`),
      h('div', { class: 'grade-row' },
        h('button', { class: 'btn big ghost', type: 'button', onclick: () => { confirmBox.hidden = true; } }, 'ارجع أكمّل'),
        h('button', { class: 'btn big', type: 'button', onclick: submit }, 'سلّم برضه')));
    confirmBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function submit() {
    clearInterval(iv);
    D.answers = Object.fromEntries(areas.map((a, i) => [i, a.raw()]));
    const items = D.ids.map((id, i) => {
      const q = app.qById[id];
      const r = checkAnswer(q, areas[i].input(), { optionSet: areas[i].optionSet });
      return { id, setIndex: areas[i].setIndex ?? null, answer: D.answers[i], read: r.read, v: r.verdict === 'empty' ? 'wrong' : r.verdict, score: r.score, msg: r.msg, notes: (r.notes || []).map((n) => n.msg) };
    });
    const rec = { at: new Date().toISOString(), day: app.today(), paper: D.paper, ids: D.ids, items, minutes: Math.round((Date.now() - D.started) / 60000) };
    score(app, rec);
    for (const it of items) {          // a wrong answer brings its answer family back sooner
      const fam = app.famOf[it.id];
      if (app.state.cards[fam] && it.v !== 'right') app.state.cards[fam] = grade(app.state.cards[fam], it.v === 'almost' ? 'hard' : 'again', app.today());
    }
    st.mocks.push(rec);
    st.mockDraft = null;
    app.save();
    app.go(`mock/result/${st.mocks.length - 1}`);
  }

  return { el: root, cleanup: () => clearInterval(iv) };
}

export function points(app, ids) {
  const raw = ids.map((id) => app.qById[id].points || 2);
  const k = 30 / raw.reduce((a, b) => a + b, 0);
  return raw.map((p) => p * k);
}

function score(app, rec) {
  const pts = points(app, rec.ids);
  const byTopic = {};
  let total = 0;
  rec.items.forEach((it, i) => {
    const s = it.v === 'right' ? 1 : it.v === 'almost' ? Math.min(0.75, Math.max(0.5, it.score || 0.5)) : 0;
    const got = pts[i] * s;
    it.max = Math.round(pts[i] * 10) / 10;
    it.got = Math.round(got * 10) / 10;
    total += got;
    const t = app.qById[it.id].topic;
    byTopic[t] = byTopic[t] || [0, 0];
    byTopic[t][0] += got;
    byTopic[t][1] += pts[i];
  });
  rec.total = Math.round(total * 2) / 2;
  rec.pass = rec.total >= 16;
  rec.byTopic = Object.fromEntries(Object.entries(byTopic).map(([t, [g, m]]) => [t, [Math.round(g * 10) / 10, Math.round(m * 10) / 10]]));
}

function resultView(app, index) {
  const st = app.state;
  const rec = st.mocks[index];
  const root = h('div', { class: 'screen mock-result' });
  const draw = () => {
    clear(root);
    const lost = Object.entries(rec.byTopic).map(([t, [g, m]]) => ({ t: +t, lost: m - g, g, m })).sort((a, b) => b.lost - a.lost);
    const cheap = rec.items.filter((it) => it.v !== 'right' && app.qById[it.id].effort === 1);
    root.append(
      h('header', { class: 'page-top' }, h('a', { class: 'icon-btn', href: '#/home', 'aria-label': 'الرئيسية' }, '→'), h('h1', {}, 'نتيجة الامتحان التجريبي')),
      h('div', { class: `score-card ${rec.pass ? 'pass' : 'fail'}` },
        h('div', { class: 'score' }, h('b', {}, rec.total), ' / 30'),
        h('div', { class: 'score-line' }, h('span', { style: { width: `${(rec.total / 30) * 100}%` } }), h('i', { style: { insetInlineStart: `${(16 / 30) * 100}%` } })),
        h('div', {}, rec.pass ? '✅ ناجح! (النجاح 16)' : `محتاج ${16 - rec.total} نقطة كمان عشان توصل 16 — ولا يهمك، ده تمرين 💪`),
        h('div', { class: 'muted small' }, rec.paper === 'random' ? 'ورقة عشوائية' : h('span', {}, 'ورقة ', h('b', { class: 'hu' }, rec.paper), ' من الفيسبوك'), ` · ${rec.minutes} دقيقة · الدرجة تقديرية`)),
      h('div', { class: 'card' }, h('h3', {}, 'ضيّعت نقط فين؟'),
        ...lost.map((x) => h('div', { class: 'topic-row' },
          h('span', {}, `${x.t} · ${app.topicName(x.t)}`),
          h('span', { class: 'bar small' }, h('span', { style: { width: `${(x.g / x.m) * 100}%` } })),
          h('b', {}, `${x.g}/${x.m}`))),
        cheap.length ? h('p', { class: 'tip' }, '💡 أرخص نقط ضاعت (إجابتها كلمة أو رقم): ', cheap.map((it) => app.qById[it.id].answer_hu).join(' · ')) : null),
      h('p', { class: 'muted small' }, 'اضغط على علامة أي سؤال عشان تغيّرها لو الآيباد قرأ غلط (✅ ← 🟡 ← ❌).'),
      ...rec.items.map((it, i) => {
        const q = app.qById[it.id];
        const mark = { right: '✅', almost: '🟡', wrong: '❌' }[it.v];
        const ans = (() => {
          if (q.type === 'mc' && Array.isArray(it.answer)) return it.answer.map((k) => q.option_sets[it.setIndex]?.opts[k]).join(' · ');
          if ((q.type === 'tf' || q.type === 'yn') && Array.isArray(it.answer)) return it.answer.length ? (q.type === 'tf' ? ['Igaz', 'Hamis'] : ['Igen', 'Nem'])[it.answer[0]] : '';
          return Array.isArray(it.answer) ? it.answer.filter(Boolean).join(' · ') : it.read;
        })();
        return h('div', { class: `card res ${it.v}` },
          h('div', { class: 'res-head' },
            h('button', { class: 'mark', type: 'button', 'aria-label': 'غيّر العلامة', onclick: () => {
              it.v = it.v === 'right' ? 'almost' : it.v === 'almost' ? 'wrong' : 'right';
              it.score = it.v === 'right' ? 1 : it.v === 'almost' ? 0.5 : 0;
              it.overridden = true;
              score(app, rec); app.save(); draw();
            } }, mark),
            h('b', { dir: 'ltr' }, `${i + 1}.`), h('span', { class: 'muted small' }, ` ${it.got}/${it.max} نقطة · ${app.topicName(q.topic)}`)),
          h('div', { class: 'question small' }, hu(q.hu, { highlight: true })),
          h('div', { class: 'muted small' }, q.ar),
          h('div', { class: 'yours' }, 'كتبت: ', ans ? hu(ans) : h('i', {}, 'فاضي')),
          h('div', { class: 'model' }, 'الإجابة: ', accentWord(q.answer_hu)),
          it.notes?.length ? h('div', { class: 'note small' }, it.notes[0]) : null,
          q.answer_ar ? h('div', { class: 'answer-ar small' }, q.answer_ar) : null);
      }),
      h('div', { class: 'actions' },
        h('a', { class: 'btn big', href: '#/home' }, '🏠 الرئيسية'),
        h('a', { class: 'btn big ghost', href: '#/mock/new' }, '📝 امتحان تاني')));
  };
  draw();
  return root;
}
