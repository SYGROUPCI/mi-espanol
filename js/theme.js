// Chargé tout en haut de la page, avant l'affichage, pour éviter un flash de la mauvaise couleur.
(function () {
  var theme = "auto";
  try {
    var etat = JSON.parse(localStorage.getItem("miespanol.v1") || "{}");
    theme = (etat.reglages && etat.reglages.theme) || "auto";
  } catch (e) { /* stockage indisponible */ }
  window.appliquerTheme = function (t) {
    var racine = document.documentElement;
    if (t === "clair" || t === "sombre") racine.setAttribute("data-theme", t);
    else racine.removeAttribute("data-theme");
    var sombre = t === "sombre" || (t !== "clair" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", sombre ? "#0F0C15" : "#F6F4FA");
  };
  window.appliquerTheme(theme);

  // Filet de sécurité : si l'appli n'a pas démarré au bout de 8 s (réseau coupé, vieux cache,
  // navigateur trop ancien), on affiche un message clair au lieu d'une page vide.
  window.addEventListener("DOMContentLoaded", function () {
    setTimeout(function () {
      var app = document.getElementById("app");
      if (!app || !app.querySelector(".chargement")) return;
      app.innerHTML =
        '<div class="vide"><h1>Oups</h1><p>L’appli n’a pas réussi à démarrer.</p>' +
        '<p class="petit">Vérifie ta connexion (essaie en 4G ou en Wi-Fi), puis touche le bouton.</p>' +
        '<button class="btn btn-large" id="reessayer">Réessayer</button></div>';
      document.getElementById("reessayer").addEventListener("click", function () {
        var fin = function () { location.reload(); };
        if (!("serviceWorker" in navigator)) return fin();
        navigator.serviceWorker.getRegistrations()
          .then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); })
          .then(function () { return window.caches ? caches.keys() : []; })
          .then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); })
          .then(fin, fin);
      });
    }, 8000);
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    try {
      var e = JSON.parse(localStorage.getItem("miespanol.v1") || "{}");
      window.appliquerTheme((e.reglages && e.reglages.theme) || "auto");
    } catch (err) { window.appliquerTheme("auto"); }
  });
})();
