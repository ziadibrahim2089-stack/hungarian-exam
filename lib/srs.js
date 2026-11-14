// Leitner spaced repetition. Boxes 1..5 → come back after 1, 3, 7, 14, 30 days.
// "نسيت" → box 1 (tomorrow + again in this session) · "فاكر بالعافية" → same box, half the wait
// "فاكر" → next box. A card forgotten 3+ times ("leech") never waits more than 3 days
// until you get it right 3 times in a row.
export const INTERVALS = [0, 1, 3, 7, 14, 30];

export const dayNum = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
export const dayFromISO = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 864e5);
};
export const isoFromDay = (n) => new Date(n * 864e5).toISOString().slice(0, 10);

export function introduce(today) {
  return { box: 1, due: today + 1, seen: 1, lapses: 0, good: 0, last: today, added: today };
}

export function grade(state, g, today) {
  const s = { ...state, seen: (state.seen || 0) + 1, last: today };
  if (g === 'again') {
    s.box = 1; s.lapses = (s.lapses || 0) + 1; s.good = 0; s.due = today + 1;
  } else if (g === 'hard') {
    s.good = 0; s.due = today + Math.max(1, Math.ceil(INTERVALS[s.box] / 2));
  } else {
    s.box = Math.min(5, (s.box || 1) + 1); s.good = (s.good || 0) + 1; s.due = today + INTERVALS[s.box];
  }
  if ((s.lapses || 0) >= 3 && (s.good || 0) < 3) s.due = Math.min(s.due, today + 3);
  return s;
}

export const isDue = (s, today) => !!s && s.due <= today;
