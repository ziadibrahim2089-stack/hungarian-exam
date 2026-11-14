// Study plan + today's session. Cards = answer FAMILIES (one fact → all its real
// questions) + 9 decoder "answer type" cards. Order: most useful first, across topics.
import { isDue } from './srs.js';

export const MAX_NEW = 5;                     // hard cap, never more
export const RULES_ID = 'fam-igen-nem';       // "free points" card: always first
export const PHASE_NAMES = {
  1: 'بنتعلّم: الدروس بالترتيب، كل درس جروب أسئلة عن موضوع واحد',
  2: 'تمرين بالورق الحقيقي: امتحان كل يومين + مراجعة',
  3: 'الأسبوع الأخير: امتحانات + نقط الضعف + ورقة الليلة الأخيرة',
};

// Phase 1 = the days needed to meet every card (5 a day, on your study days);
// phase 3 = the last 7 days (less if the exam is close); phase 2 = in between.
export function phases(startDay, examDay, { cardsTotal = 43, daysPerWeek = 6 } = {}) {
  const total = Math.max(1, examDay - startDay);
  const p3 = total >= 14 ? 7 : Math.max(1, Math.round(total * 0.3));
  const learnStudyDays = Math.ceil(cardsTotal / MAX_NEW);
  let learn = Math.ceil((learnStudyDays * 7) / Math.max(1, Math.min(7, daysPerWeek)));
  learn = Math.max(1, Math.min(learn, total - p3 - 1));
  const e1 = startDay + learn;
  const e3 = examDay - p3;
  return [
    { n: 1, from: startDay, to: e1 - 1 },
    { n: 2, from: e1, to: e3 - 1 },
    { n: 3, from: e3, to: examDay },
  ].filter((p) => p.to >= p.from);
}

export function phaseOn(day, list) {
  for (const p of list) if (day <= p.to) return p.n;
  return 3;
}

// Fewer new cards when reviews pile up (missed days) — no guilt, just catching up.
export function newAllowance(dueCount, minutes = 15) {
  const room = Math.round(minutes * 1.2);
  if (dueCount > room * 1.6) return 0;
  if (dueCount > room) return 2;
  if (dueCount > room * 0.7) return 3;
  return MAX_NEW;
}

// ---------- lessons (data/lessons.json): ONE lesson a day, in order, ≤ 5 new cards each ----------
export const lessonDone = (lesson, states) => lesson.cards.every((id) => states[id]);
export const currentLesson = (lessons, states) => lessons.find((l) => !lessonDone(l, states)) || null;

// "If one of the 16 real papers came and you remembered every family you know":
// a paper is a pass when its known points, scaled to 30, reach 16.
export function papersPassed(papers, qById, knownFams) {
  let pass = 0;
  for (const p of papers) {
    let tot = 0, got = 0;
    for (const id of p.q) {
      const q = qById[id];
      const pts = q?.points || 2;
      tot += pts;
      if (q && knownFams.has(q.family)) got += pts;
    }
    if (tot && Math.round((30 * got) / tot) >= 16) pass++;
  }
  return pass;
}

// Unseen cards in the order they are introduced. With lessons: lesson order.
// Without: the free-points card first, then 2 answer families (best value first) for every 1 decoder card.
export function newQueue(cards, states, lessons) {
  if (lessons?.length) {
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
    return lessons.flatMap((l) => l.cards).filter((id) => !states[id] && byId[id]).map((id) => byId[id]);
  }
  const unseen = cards.filter((c) => !states[c.id]);
  const fams = unseen.filter((c) => c.kind === 'family' && c.id !== RULES_ID).sort((a, b) => b.value - a.value);
  const decs = unseen.filter((c) => c.kind === 'decoder').sort((a, b) => b.value - a.value);
  const out = unseen.filter((c) => c.id === RULES_ID);
  while (fams.length || decs.length) {
    if (fams.length) out.push(fams.shift());
    if (decs.length && (out.length % 3 === 2 || !fams.length)) out.push(decs.shift());
    if (fams.length) out.push(fams.shift());
  }
  return out;
}

export function dueCards(cards, states, today) {
  return cards
    .filter((c) => isDue(states[c.id], today))
    .sort((a, b) => {
      const sa = states[a.id], sb = states[b.id];
      return (sa.box - sb.box) || (sa.due - sb.due) || (b.value - a.value);
    });
}

// Today's session. With lessons, the new cards come ONLY from the current lesson, and once
// today's lesson is finished the next one waits until tomorrow (one lesson a day).
// pick = a lesson the learner chose (all lessons are open): its new cards come in full, whatever
// was done today; a lesson already learned is studied again (practice: its questions once more).
export function buildSession({ cards, states, today, minutes = 15, freshToday = [], newDoneToday = freshToday.length, lessons, pick }) {
  const due = dueCards(cards, states, today);
  const reviewCap = Math.round(minutes * 1.2);
  const review = due.slice(0, reviewCap).map((c) => c.id);
  const backlog = Math.max(0, due.length - review.length);
  const allowance = Math.max(0, newAllowance(due.length, minutes) - newDoneToday);
  if (lessons?.length && pick && lessons[pick - 1]) {
    const L = lessons[pick - 1];
    const fresh = L.cards.filter((id) => !states[id]);
    return { review, fresh, backlog, lesson: L.n, practice: !fresh.length, lessonWaits: false };
  }
  if (lessons?.length) {
    const L = currentLesson(lessons, states);
    const startedOther = freshToday.length > 0 && L && !L.cards.some((id) => freshToday.includes(id));
    const fresh = !L || startedOther ? [] : L.cards.filter((id) => !states[id]).slice(0, allowance);
    return { review, fresh, backlog, lesson: L ? L.n : null, lessonWaits: !!startedOther };
  }
  const fresh = newQueue(cards, states).slice(0, allowance);
  return { review, fresh: fresh.map((c) => c.id), backlog };
}

// Which real question of a family to show next (rotates through all phrasings).
export const nextQuestion = (fam, state, key = 'qi', skip = 0) => fam.q[((state?.[key] || 0) + skip) % fam.q.length];

// 3 exam questions from 3 different learned families: weakest families first,
// plus one of today's new families. Returns [{fam, qid}].
export function pickQuiz({ cards, states, todayNew = [], n = 3 }) {
  const fams = cards.filter((c) => c.kind === 'family' && states[c.id]);
  const weak = (a, b) => {
    const sa = states[a.id], sb = states[b.id];
    return ((sb.lapses || 0) - (sa.lapses || 0)) || (sa.box - sb.box) || (sa.due - sb.due);
  };
  const old = fams.filter((f) => !todayNew.includes(f.id)).sort(weak);
  const fresh = fams.filter((f) => todayNew.includes(f.id));
  const pick = [...old.slice(0, n - Math.min(1, fresh.length)), ...fresh.slice(0, 1)];
  for (const f of [...old, ...fresh]) if (pick.length < n && !pick.includes(f)) pick.push(f);
  return pick.slice(0, n).map((f) => ({ fam: f.id, qid: nextQuestion(f, states[f.id], 'qz') }));
}

// Up to 3 hard words to write by hand today: from today's families first,
// accents and long names first, never the same word twice within 3 days.
export function pickWriting({ cards, states, todayIds = [], writeLog = {}, today, n = 3 }) {
  const accent = /[áéíóöőúüű]/i;
  const pool = [];
  for (const f of cards) {
    if (f.kind !== 'family' || !states[f.id]) continue;
    for (const w of f.write || []) {
      if (today - (writeLog[w] ?? -999) < 3) continue;
      pool.push({ w, fam: f.id, score: (todayIds.includes(f.id) ? 100 : 0) + (accent.test(w) ? 10 : 0) + Math.min(9, w.length / 3) - (writeLog[w] != null ? 5 : 0) });
    }
  }
  pool.sort((a, b) => b.score - a.score);
  const out = [];
  for (const p of pool) if (out.length < n && !out.some((o) => o.w === p.w)) out.push({ w: p.w, fam: p.fam });
  return out;
}

// Streak: consecutive study days; one rest day in between does not break it.
export function streak(days, today) {
  let count = 0;
  let gap = 0;
  for (let d = today; d > today - 400; d--) {
    if (days[d]?.done) { count++; gap = 0; } else if (d !== today) { gap++; if (gap > 1) break; }
  }
  return count;
}

// questions = new real questions taught one by one (about a minute each)
export function estimateMinutes({ review = 0, fresh = 0, questions = 0, quiz = 3, write = 3 }) {
  return Math.max(3, Math.round(review * 0.4 + fresh * 1.4 + questions * 0.8 + quiz * 1 + write * 1.2));
}

// ---------- the exam-date plan: learn every question, then the last 14 days = review ----------
// The learner sets the exam date. Every real question is taught before the review days start;
// those days (14, or 10 when time is short) go over every lesson again from lesson 1.
export function reviewDaysFor(totalDays) {
  if (totalDays >= 28) return 14;
  if (totalDays >= 20) return 10;
  return Math.max(0, Math.floor(totalDays * 0.35));
}
const studyDays = (n, perWeek) => (n <= 0 ? 0 : Math.max(1, Math.ceil((n * Math.min(7, Math.max(1, perWeek))) / 7)));
export const roundMinutes = (m) => Math.max(5, Math.ceil(m / 5) * 5);
export const MIN_PER_Q = 1.1;     // a new question in 4 steps
export const MIN_PER_REV = 0.4;   // a quick review
export const MIN_PER_PRACTICE = 0.9;

// today = day number; qLeft = real questions not taught yet; taughtToday = taught today already
// (so today's goal stays the same all day); due = reviews waiting; reviewed = {lessonN: [days]}
// lessons studied again; reviewStart = the first review day (fixed once learning is finished).
export function examPlan({ today, examDay, startDay = today, perWeek = 7, qLeft, taughtToday = 0, due = 0, lessons = [], reviewed = {}, reviewStart }) {
  const left = examDay - today;
  if (left < 0) return { phase: 'over', left };
  if (left === 0) return { phase: 'exam', left };
  const reviewDays = reviewDaysFor(examDay - Math.min(startDay, today));
  const reviewFrom = examDay - reviewDays;
  const base = { left, reviewDays, reviewFrom, learnEnd: reviewFrom - 1 };
  if (left === 1) return { ...base, phase: 'eve' };
  if (qLeft > 0 || taughtToday > 0) {
    const late = today >= reviewFrom;
    const days = late ? Math.max(1, left - 1) : studyDays(reviewFrom - today, perWeek);
    const goal = Math.ceil((qLeft + taughtToday) / days);
    const rest = Math.min(qLeft, Math.max(0, goal - taughtToday));
    return { ...base, phase: 'learn', late, days, goal, rest, qLeft,
      minutesDay: roundMinutes(goal * MIN_PER_Q + due * MIN_PER_REV),
      minutes: rest ? roundMinutes(rest * MIN_PER_Q + due * MIN_PER_REV) : 0 };
  }
  // review: every lesson again, in order, spread over the days left (the exam eve = the night sheet)
  const from = reviewStart ?? today;
  const daysLeft = Math.max(1, left - 1);
  const count = (n) => (reviewed[n] || []).filter((d) => d >= from && d < today).length;
  const round = Math.min(...lessons.map((l) => count(l.n)));
  const pending = lessons.filter((l) => count(l.n) === round);
  let k = Math.ceil(pending.length / daysLeft);
  if (round > 0) k = Math.min(k, 3);   // the second time round is extra: keep the days light
  const todayLessons = pending.slice(0, k).map((l) => ({ n: l.n, q: l.q, done: (reviewed[l.n] || []).includes(today) }));
  const restQ = todayLessons.filter((l) => !l.done).reduce((n, l) => n + (l.q || 0), 0);
  return { ...base, phase: 'review', round, daysLeft, todayLessons,
    minutes: restQ ? roundMinutes(restQ * MIN_PER_PRACTICE + due * MIN_PER_REV) : 0,
    minutesDay: roundMinutes(todayLessons.reduce((n, l) => n + (l.q || 0), 0) * MIN_PER_PRACTICE + due * MIN_PER_REV) };
}
