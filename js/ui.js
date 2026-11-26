// Petits outils d'interface partagés.

export const $ = (sel, racine = document) => racine.querySelector(sel);
export const $$ = (sel, racine = document) => [...racine.querySelectorAll(sel)];

const ECHAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ECHAP[c]);

export function melanger(liste) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const auHasard = (liste) => liste[Math.floor(Math.random() * liste.length)];

// Comparaison tolérante pour l'exercice « écrire » : sans accents, sans ponctuation, sans majuscules.
export function normaliser(s, garderAccents = false) {
  let t = String(s || "").toLowerCase().trim();
  if (!garderAccents) t = t.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return t.replace(/[¿?¡!.,;:«»"'()…-]/g, " ").replace(/\s+/g, " ").trim();
}
export function distance(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

// Icônes (traits fins, couleur du texte)
const P = {
  maison: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/>',
  carnet: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  lettre: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="m4 7 8 6 8-6"/>',
  reglages: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  flamme: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.6 1 2.6 2 3C11 8.5 11 6 12 3Z"/>',
  retour: '<path d="M15 5l-7 7 7 7"/>',
  coche: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  croix: '<path d="M6 6l12 12M18 6 6 18"/>',
  cadenas: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  coeur: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  etoile: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9Z"/>',
  partager: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M6 12v7h12v-7"/>',
  poubelle: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  visage: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 16a4 4 0 0 0 5 0"/>',
  micro: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
  son: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  fleche:'<path d="M5 12h13M13 6l6 6-6 6"/>',
  bulles: '<path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3-3"/>',
  soleil:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  lune: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5Z" fill="currentColor"/>',
};
export const ico = (nom, cls = "") =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nom] || ""}</svg>`;

export function remplirIcones(racine = document) {
  $$("[data-ico]", racine).forEach((el) => { el.innerHTML = ico(el.dataset.ico); });
}

let toastMinuteur;
// Le message reste le temps de le lire (environ 15 caractères par seconde, entre 2,6 et 7 secondes).
export function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastMinuteur);
  toastMinuteur = setTimeout(() => (t.hidden = true), Math.min(7000, Math.max(2600, String(msg).length * 65)));
}

// Fenêtre par-dessus l'écran. Renvoie une promesse résolue à la fermeture.
// Les fenêtres passent l'une après l'autre (une lettre surprise n'en écrase jamais une autre).
// apresOuverture(boite) : pour brancher un champ une fois la fenêtre affichée.
let file = Promise.resolve();
export function modale(html, options = {}) {
  const tour = file.then(() => ouvrirModale(html, options));
  file = tour.catch(() => {});
  return tour;
}

function ouvrirModale(html, { classe = "", apresOuverture } = {}) {
  const m = $("#modale");
  const avant = document.activeElement;
  m.innerHTML = `<div class="modale-fond" data-fermer></div><div class="modale-boite ${classe}" role="dialog" aria-modal="true" tabindex="-1">${html}</div>`;
  const boite = $(".modale-boite", m);
  const titre = $("h1, h2, h3, .lettre-sur, .cartel-sur", boite);
  if (titre) { titre.id = "modale-titre"; boite.setAttribute("aria-labelledby", "modale-titre"); }
  m.hidden = false;
  document.body.classList.add("bloque");
  return new Promise((ok) => {
    const fermer = (val) => {
      m.hidden = true;
      m.innerHTML = "";
      m.onclick = null;
      document.removeEventListener("keydown", clavier);
      document.body.classList.remove("bloque");
      try { avant?.focus?.({ preventScroll: true }); } catch (_) { /* élément disparu */ }
      ok(val);
    };
    // Échap ferme ; Tab reste dans la fenêtre.
    const clavier = (ev) => {
      if (ev.key === "Escape") { ev.preventDefault(); fermer(null); return; }
      if (ev.key !== "Tab") return;
      const focusables = $$("button, a[href], input, textarea, select", boite).filter((x) => !x.disabled);
      if (!focusables.length) return;
      const [premier, dernier] = [focusables[0], focusables[focusables.length - 1]];
      if (ev.shiftKey && document.activeElement === premier) { ev.preventDefault(); dernier.focus(); }
      else if (!ev.shiftKey && document.activeElement === dernier) { ev.preventDefault(); premier.focus(); }
    };
    document.addEventListener("keydown", clavier);
    m.onclick = (ev) => {
      const cible = ev.target.closest("[data-fermer],[data-valeur]");
      if (!cible) return;
      fermer(cible.dataset.valeur ?? null);
    };
    apresOuverture?.(boite);
    if (!boite.contains(document.activeElement)) boite.focus({ preventScroll: true });
  });
}

export const confirmer = (titre, texte, oui = "Oui", non = "Annuler") =>
  modale(`<h2>${e(titre)}</h2><p>${e(texte)}</p>
    <div class="rangee"><button class="btn btn-doux" data-valeur="non">${e(non)}</button>
    <button class="btn" data-valeur="oui">${e(oui)}</button></div>`).then((v) => v === "oui");

export function vibrer(ms = 15) {
  try { navigator.vibrate?.(ms); } catch (_) { /* iPhone : pas de vibration web */ }
}

// Transition d'écran en cours (View Transitions). WebKit peut planter si on modifie la page pendant
// la transition : tout contenu chargé après coup (réseau) attend d'abord sa fin.
let finTransition = Promise.resolve();
export const noterTransition = (promesse) => { finTransition = Promise.resolve(promesse).catch(() => {}); };
export const apresTransition = () => finTransition;
