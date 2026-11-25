// Service worker : l'appli marche hors ligne (métro, avion, pas de réseau).
// Stratégie « stale-while-revalidate » : on sert tout de suite la version en cache,
// et on met le cache à jour en arrière-plan. Les nouveautés apparaissent au lancement suivant.
// Changer VERSION à chaque mise en ligne force le renouvellement complet du cache.
const VERSION = "mi-espanol-20261125-2248";

const FICHIERS = [
  "./",
  "css/fonts.css",
  "css/style.css",
  "data/index.json",
  "data/situations/01-amis.json",
  "data/situations/02-telephone.json",
  "data/situations/03-beaute.json",
  "data/situations/04-culture.json",
  "data/situations/05-bar.json",
  "data/situations/06-medecin.json",
  "data/situations/07-voisins.json",
  "data/situations/08-logement.json",
  "data/situations/09-administration.json",
  "data/situations/10-travail.json",
  "data/situations/11-urgences.json",
  "data/situations/12-ecole.json",
  "data/situations/13-finde.json",
  "data/situations/14-planes.json",
  "data/situations/15-opiniones.json",
  "data/situations/16-quejas.json",
  "data/situations/17-viaje.json",
  "data/situations/18-cocina.json",
  "data/situations/19-mi-pais.json",
  "data/situations/20-emociones.json",
  "data/situations/21-bienestar.json",
  "data/situations/22-paquetes.json",
  "data/situations/23-reuniones.json",
  "data/situations/24-fiesta.json",
  "data/situations/25-residencia.json",
  "data/situations/26-banco.json",
  "data/situations/27-empleo.json",
  "data/situations/28-especialista.json",
  "data/situations/29-recuerdos.json",
  "data/situations/30-actualidad.json",
  "data/situations/31-consejos.json",
  "data/situations/32-familia.json",
  "data/situations/33-reclamar.json",
  "data/situations/34-formacion.json",
  "data/situations/35-vendimia.json",
  "data/situations/36-futuro.json",
  "fonts/atkinson-hyperlegible-400-latin-ext.woff2",
  "fonts/atkinson-hyperlegible-400-latin.woff2",
  "fonts/atkinson-hyperlegible-700-latin-ext.woff2",
  "fonts/atkinson-hyperlegible-700-latin.woff2",
  "fonts/caveat-500-latin-ext.woff2",
  "fonts/caveat-500-latin.woff2",
  "fonts/caveat-700-latin-ext.woff2",
  "fonts/caveat-700-latin.woff2",
  "fonts/young-serif-400-latin-ext.woff2",
  "fonts/young-serif-400-latin.woff2",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512-maskable.png",
  "icons/icon-512.png",
  "index.html",
  "js/app.js",
  "js/charla.js",
  "js/compte.js",
  "js/contenu.js",
  "js/exercices.js",
  "js/legal.js",
  "js/notifs.js",
  "js/profil.js",
  "js/son.js",
  "js/store.js",
  "js/theme.js",
  "js/ui.js",
  "js/vapid.js",
  "js/vendor/webauthn/helpers/base64URLStringToBuffer.js",
  "js/vendor/webauthn/helpers/browserSupportsWebAuthn.js",
  "js/vendor/webauthn/helpers/browserSupportsWebAuthnAutofill.js",
  "js/vendor/webauthn/helpers/bufferToBase64URLString.js",
  "js/vendor/webauthn/helpers/identifyAuthenticationError.js",
  "js/vendor/webauthn/helpers/identifyRegistrationError.js",
  "js/vendor/webauthn/helpers/isValidDomain.js",
  "js/vendor/webauthn/helpers/platformAuthenticatorIsAvailable.js",
  "js/vendor/webauthn/helpers/toAuthenticatorAttachment.js",
  "js/vendor/webauthn/helpers/toPublicKeyCredentialDescriptor.js",
  "js/vendor/webauthn/helpers/webAuthnAbortService.js",
  "js/vendor/webauthn/helpers/webAuthnError.js",
  "js/vendor/webauthn/index.js",
  "js/vendor/webauthn/methods/startAuthentication.js",
  "js/vendor/webauthn/methods/startRegistration.js",
  "js/vendor/webauthn/types/dom.js",
  "js/vendor/webauthn/types/index.js",
  "js/voix.js",
  "legal/es/aviso-legal.md",
  "legal/es/condiciones-charla.md",
  "legal/es/condiciones-de-venta.md",
  "legal/es/privacidad.md",
  "legal/fr/conditions-charla.md",
  "legal/fr/conditions-de-vente.md",
  "legal/fr/confidentialite.md",
  "legal/fr/mentions-legales.md",
  "manifest.webmanifest",
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
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  // L'API (progression, duo, compte) ne passe jamais par le cache : toujours la version du serveur,
  // et jamais les données d'une autre personne connectée avant sur ce téléphone.
  if (url.pathname.startsWith("/api/")) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const enCache = await cache.match(req, { ignoreSearch: true });
      const reseau = fetch(req)
        .then((rep) => {
          if (rep.ok) return cache.put(req, rep.clone()).then(() => rep, () => rep);
          return rep;
        })
        .catch(() => enCache || Response.error());
      if (enCache) {
        e.waitUntil(reseau.catch(() => {}));   // la mise à jour du cache va jusqu'au bout
        return enCache;
      }
      return reseau;
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
