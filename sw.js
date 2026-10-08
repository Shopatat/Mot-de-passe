const CACHE_NAME = 'mot-de-passe-v4'; // v4 : polices ajoutées, ancienne musique de qualif retirée du cache
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sounds/music-finale-ambient.mp3',
  './sounds/music-finale-early.mp3',
  './sounds/music-finale-late.mp3',
  './sounds/music-menu.mp3',
  './sounds/music-menu-alt.mp3',
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
  './sounds/sfx-word-reveal.wav',
  // Polices du jeu : gardées dès l'installation, pour jouer hors-ligne avec la
  // bonne écriture (sinon elles n'étaient en cache qu'à la 2e ouverture).
  './fonts/anton-latin.woff2',
  './fonts/anton-latin-ext.woff2',
  './fonts/archivo-800-125-latin.woff2',
  './fonts/archivo-800-125-latin-ext.woff2',
  './fonts/manrope-latin.woff2',
  './fonts/manrope-latin-ext.woff2'
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

// La PAGE du jeu part tout de suite de la copie gardée sur le téléphone : la
// faire attendre internet à chaque lancement (610 Ko, réseau à réveiller)
// laissait l'iPhone sur un écran blanc entre l'icône et le chargement (vu par
// Fabien le 2026-10-03). En même temps, on redemande la page au serveur
// ("no-cache" : sinon le cache HTTP pouvait resservir l'ancienne jusqu'à
// 10 min après un déploiement, GitHub Pages autorisant max-age=600). Si elle a
// changé, la nouvelle est gardée et sera là au prochain lancement (pas de
// rechargement immédiat : l'iPhone montrait un écran gris entre les deux pages).
// Manifest et sw.js restent vérifiés en ligne d'abord (ils ne retardent pas
// l'affichage). Premier lancement (rien en cache) : réseau, comme avant.
const NETWORK_FIRST = ['/manifest.json', '/sw.js'];

function isPage(request, url){
  return request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === new URL('./', self.registration.scope).pathname;
}

function freshPage(request, cached){
  return fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }).then(async (res) => {
    if(!res || !res.ok) return res;
    if(!cached){
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return res;
    }
    if(await differs(cached, res.clone())){
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, res.clone());
    }
    return res;
  });
}

// Même étiquette du serveur : rien n'a changé (cas courant, sans lire 610 Ko).
// Sinon on compare le texte, pour ne pas recharger pour rien.
async function differs(a, b){
  const tag = (r) => r.headers.get('etag') || r.headers.get('last-modified');
  if(tag(a) && tag(a) === tag(b)) return false;
  return (await a.text()) !== (await b.text());
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (isPage(event.request, url)) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cached) => {
        // Un double pour comparer : la réponse servie est lue par la page.
        const network = freshPage(event.request, cached && cached.clone());
        if (cached) {
          event.waitUntil(network.catch(() => {}));
          return cached;
        }
        return network.catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  if (NETWORK_FIRST.some((p) => url.pathname.endsWith(p))) {
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
