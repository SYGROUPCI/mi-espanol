// Service worker : l'appli marche hors ligne (métro, avion, pas de réseau).
// Stratégie « stale-while-revalidate » : on sert tout de suite la version en cache,
// et on met le cache à jour en arrière-plan. Les nouveautés apparaissent au lancement suivant.
// Changer VERSION à chaque mise en ligne force le renouvellement complet du cache.
const VERSION = "mi-espanol-20261123-0246";

const FICHIERS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/fonts.css",
  "css/style.css",
  "js/app.js",
  "js/theme.js",
  "js/store.js",
  "js/contenu.js",
  "js/ui.js",
  "js/exercices.js",
  "js/charla.js",
  "js/voix.js",
  "js/compte.js",
  "js/notifs.js",
  "js/vapid.js",
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

// ---------------------------------------------------------------------------
// Notifications : le rappel quotidien arrive ici, même appli fermée.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(
    self.registration.showNotification(d.title || "Mi Español", {
      body: d.body || "Tu etapa de hoy te espera.",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: "rappel-quotidien",
      data: { url: d.url || "./" },
    })
  );
});

// Toucher la notification ouvre l'appli (ou la ramène au premier plan) au bon endroit.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const cible = new URL(e.notification.data?.url || "./", self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ("focus" in f) { f.navigate?.(cible); return f.focus(); }
      }
      return self.clients.openWindow(cible);
    })
  );
});
