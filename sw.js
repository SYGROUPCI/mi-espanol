// Service worker : l'appli marche hors ligne (métro, avion, pas de réseau).
// Stratégie « stale-while-revalidate » : on sert tout de suite la version en cache,
// et on met le cache à jour en arrière-plan. Les nouveautés apparaissent au lancement suivant.
// Changer VERSION à chaque mise en ligne force le renouvellement complet du cache.
const VERSION = "mi-espanol-20261122-2049";

const FICHIERS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/app.js",
  "js/theme.js",
  "js/store.js",
  "js/contenu.js",
  "js/ui.js",
  "js/exercices.js",
  "data/index.json",
  "data/mots.json",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(FICHIERS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const enCache = await cache.match(req, { ignoreSearch: true });
      const reseau = fetch(req)
        .then((rep) => {
          if (rep.ok) cache.put(req, rep.clone());
          return rep;
        })
        .catch(() => enCache);
      return enCache || reseau;
    })
  );
});
