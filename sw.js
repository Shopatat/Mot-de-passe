const CACHE_NAME = 'mot-de-passe-v3';
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
// vider un cache manuellement. La requête passe en "no-cache" : sans ça, le
// cache HTTP du navigateur pouvait resservir l'ancienne page jusqu'à 10 min
// après un déploiement (GitHub Pages autorise max-age=600) ; là, il redemande
// toujours au serveur (réponse 304 légère si rien n'a changé).
const NETWORK_FIRST = ['/index.html', '/manifest.json', '/sw.js'];

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isNetworkFirst = event.request.mode === 'navigate' ||
    NETWORK_FIRST.some((p) => url.pathname.endsWith(p)) ||
    url.pathname === new URL('./', self.registration.scope).pathname;

  if (isNetworkFirst) {
    event.respondWith(
      fetch(event.request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Les sons : servis depuis le cache tout de suite si présents (rapide, marche
  // hors-ligne), MAIS une requête réseau part quand même en parallèle pour
  // rafraîchir le cache en vue de la prochaine ouverture ("stale-while-
  // revalidate"). Un simple cache-first ne se met jamais à jour tout seul : un
  // fichier son modifié ne serait jamais revu par un joueur qui l'a déjà en
  // cache, sans bump manuel de CACHE_NAME à chaque changement.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
