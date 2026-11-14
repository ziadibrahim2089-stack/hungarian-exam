import DATA from './data.js';
import { load, save } from './lib/store.js';
import { dayNum, dayFromISO } from './lib/srs.js';
import { phases, phaseOn } from './lib/plan.js';
import { h, clear, setGlossary, toast } from './ui.js';
import * as home from './screens/home.js';
import * as setup from './screens/setup.js';
import * as session from './screens/session.js';
import * as mock from './screens/mock.js';
import * as lists from './screens/lists.js';
import * as settings from './screens/settings.js';

setGlossary(DATA.keywords, DATA.words);

export const app = {
  DATA,
  state: load(),
  byId: Object.fromEntries(DATA.cards.map((c) => [c.id, c])),          // study cards: families + decoder
  qById: Object.fromEntries(DATA.questions.map((q) => [q.id, q])),     // the real questions
  famOf: Object.fromEntries(DATA.questions.map((q) => [q.id, q.family])),
  today: () => dayNum(),
  save() { save(app.state); },
  examDay() {
    const s = app.state.settings;
    return s.examDate ? dayFromISO(s.examDate) : dayFromISO(s.startDate) + 30;
  },
  daysLeft() { return app.examDay() - app.today(); },
  phases() {
    return phases(dayFromISO(app.state.settings.startDate), app.examDay(),
      { cardsTotal: DATA.cards.length, daysPerWeek: app.state.settings.daysPerWeek });
  },
  phaseNow() { return phaseOn(app.today(), app.phases()); },
  go(route) { if (location.hash !== '#/' + route) location.hash = '#/' + route; else render(); },
  topicName: (t) => DATA.topics[t]?.ar || '',

  // ----- hooks: default → your pick → 👎 next → ✏️ your own -----
  hookOptions(card) {
    const own = app.state.hookOwn[card.id];
    const down = new Set(app.state.hookDown[card.id] || []);
    const opts = (card.hooks || []).map((text, i) => ({ text, i })).filter((o) => !down.has(o.i));
    return { own, opts };
  },
  currentHook(card) {
    const { own, opts } = app.hookOptions(card);
    if (own) return { text: own, own: true, more: opts.length };
    if (!opts.length) return null;
    const pick = app.state.hookPick[card.id];
    const cur = opts.find((o) => o.i === pick) || opts[0];
    return { ...cur, more: opts.length - 1 };
  },
  nextHook(card) {
    const { opts } = app.hookOptions(card);
    if (opts.length < 2) return;
    const cur = app.currentHook(card);
    const k = opts.findIndex((o) => o.i === cur.i);
    app.state.hookPick[card.id] = opts[(k + 1) % opts.length].i;
    app.save();
  },
  dislikeHook(card) {
    const cur = app.currentHook(card);
    if (!cur) return;
    if (cur.own) { delete app.state.hookOwn[card.id]; app.save(); return; }
    app.state.hookDown[card.id] = [...new Set([...(app.state.hookDown[card.id] || []), cur.i])];
    delete app.state.hookPick[card.id];
    app.save();
  },
  setOwnHook(card, text) {
    if (text?.trim()) app.state.hookOwn[card.id] = text.trim(); else delete app.state.hookOwn[card.id];
    app.save();
  },
};

// Older test data used one card per question: keep only cards that still exist.
for (const id of Object.keys(app.state.cards)) if (!app.byId[id]) delete app.state.cards[id];
if (app.state.session && app.state.session.v !== 5) app.state.session = null;
// The lessons were rebuilt as subject groups (2026-11-13): drop a lesson started under the old
// order and let today's new lesson 1 open right away (cards already learned keep their reviews).
const STRUCTURE = 'subject-groups-1';
if (app.state.structure !== STRUCTURE) {
  if (Object.keys(app.state.days || {}).length || app.state.session) {
    app.state.session = null;
    const d = app.state.days?.[app.today()];
    if (d) { d.fresh = []; d.done = false; }
  }
  app.state.structure = STRUCTURE;
  app.save();
}

const ROUTES = {
  home: home.render,
  setup: setup.render,
  session: session.render,
  mock: mock.render,
  decoder: lists.decoder,
  bank: lists.bank,
  sheet: lists.sheet,
  plan: lists.plan,
  lesson: lists.lesson,
  pad: lists.padtest,
  story: lists.story,
  listen: lists.listen,
  settings: settings.render,
  scribble: setup.scribble,
};

let cleanup = null;
export function render() {
  const root = document.getElementById('app');
  const [name, ...params] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  let route = ROUTES[name] ? name : 'home';
  if (!app.state.settings.setupDone && !['setup', 'scribble', 'mock'].includes(route)) route = 'setup';
  if (cleanup) { try { cleanup(); } catch { /* ignore */ } cleanup = null; }
  clear(root);
  const out = ROUTES[route](app, params);
  const el = out?.el || out;
  cleanup = out?.cleanup || null;
  root.append(el);
  root.dataset.route = route;
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
render();

// ---------- offline (service worker) ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller; // first visit: no reload needed
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const ask = (worker) => {
      const bar = h('div', { class: 'update-bar' }, 'فيه نسخة جديدة من التطبيق ',
        h('button', { class: 'btn small', onclick: () => { worker.postMessage('skipWaiting'); } }, 'حدّث دلوقتي'));
      document.body.append(bar);
    };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w);
      });
    });
  }).catch(() => { /* offline mode not available — the app still works online */ });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    location.reload();
  });
}

window.addEventListener('error', (e) => { console.error(e.error || e.message); });
window.app = app; // handy for debugging in the browser console
export { toast };
