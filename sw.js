const CACHE_NAME = 'mot-de-passe-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sounds/music-finale-ambient.mp3',
  './sounds/music-finale-early.mp3',
  './sounds/music-finale-late.mp3',
  './sounds/music-menu.mp3',
  './sounds/music-qualif-alt.mp3',
  './sounds/music-qualif-wait.wav',
  './sounds/music-qualif.mp3',
  './sounds/sfx-correct.wav',
  './sounds/sfx-finale-timeout.wav',
  './sounds/sfx-forbidden.wav',
  './sounds/sfx-jackpot.mp3',
  './sounds/sfx-pass.wav',
  './sounds/sfx-qualifs-end.wav',
  './sounds/sfx-reserve-br3.wav',
  './sounds/sfx-round-start.wav',
  './sounds/sfx-round-win.wav',
  './sounds/sfx-word-reveal.wav'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Le code du jeu (page + manifest) est vérifié en ligne à chaque ouverture avec
// internet, pour que les mises à jour du jeu apparaissent sans jamais avoir à
// vider un cache manuellement. Les sons, eux, changent rarement : on les sert
// depuis le cache en priorité pour économiser de la bande passante, avec repli
// sur le réseau seulement si absents.
const NETWORK_FIRST = ['/index.html', '/manifest.json', '/sw.js'];

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isNetworkFirst = event.request.mode === 'navigate' ||
    NETWORK_FIRST.some((p) => url.pathname.endsWith(p)) ||
    url.pathname === new URL('./', self.registration.scope).pathname;

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
