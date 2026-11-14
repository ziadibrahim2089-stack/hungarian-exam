// Offline support. build.mjs fills in VERSION and FILES.
const VERSION = 'c17728c208';
const FILES = ["./","./app.js","./data.js","./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png","./index.html","./lib/match.js","./lib/pad.js","./lib/plan.js","./lib/srs.js","./lib/store.js","./lib/text.js","./manifest.webmanifest","./reminders/0800.ics","./reminders/1300.ics","./reminders/1800.ics","./reminders/2000.ics","./reminders/2200.ics","./screens/card.js","./screens/home.js","./screens/lists.js","./screens/mock.js","./screens/session.js","./screens/settings.js","./screens/setup.js","./styles.css","./ui.js","./workbook.pdf"];
const CACHE = 'hkv-' + VERSION;

self.addEventListener('install', (e) => {
  // cache: 'reload' = straight from the server, never from the browser's own cache (GitHub Pages lets
  // browsers keep files 10 minutes, which could mix old screens into a new version)
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hkv-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
