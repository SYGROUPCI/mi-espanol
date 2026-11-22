// Tout ce qu'Elisabeth fait est gardé sur son téléphone (localStorage).
// Rien ne part sur un serveur.

const CLE = "miespanol.v1";

// Intervalles de révision (en jours) selon la « boîte » de la carte.
// Une carte réussie monte d'une boîte et revient plus tard ; ratée, elle redescend.
const INTERVALLES = [0, 1, 3, 7, 14, 30, 60];
export const BOITE_ACQUISE = 4;

const DEFAUT = () => ({
  version: 1,
  creeLe: aujourdhui(),
  prenom: null,
  reglages: { pron: true, traductionCachee: true, theme: "auto" },
  cartes: {},        // id -> { boite, due, vu, ok, ko }
  carnet: [],        // { id, es, fr, note, creeLe }
  serie: { jours: 0, dernier: null, record: 0 },
  defisFaits: 0,     // nombre de jours où le défi a été terminé en entier
  defi: null,        // défi du jour en cours
  motsVus: [],       // petits mots déjà ouverts
  sellos: [],        // tampons déjà célébrés (situations terminées)
  bienvenueVue: false,
});

let etat = charger();

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return { ...DEFAUT(), ...JSON.parse(brut) };
  } catch (e) { /* stockage indisponible : on repart d'un état neuf */ }
  return DEFAUT();
}

export function sauver() {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) { /* plein ou bloqué */ }
}

export const get = () => etat;

export function maj(fn) {
  fn(etat);
  sauver();
}

// ---------- dates ----------
export function aujourdhui(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function plusJours(jour, n) {
  const [a, m, j] = jour.split("-").map(Number);
  return aujourdhui(new Date(a, m - 1, j + n));
}

// ---------- cartes ----------
export const carte = (id) => etat.cartes[id];

export function estDue(id, jour = aujourdhui()) {
  const c = etat.cartes[id];
  return !!c && c.due <= jour;
}

export function decouvrir(id) {
  if (!etat.cartes[id]) {
    etat.cartes[id] = { boite: 0, due: aujourdhui(), vu: aujourdhui(), ok: 0, ko: 0 };
  }
}

// reussi = true : « Je savais » ; false : « Pas encore »
export function noter(id, reussi) {
  maj(() => {
    decouvrir(id);
    const c = etat.cartes[id];
    if (reussi) {
      c.boite = Math.min(c.boite + 1, INTERVALLES.length - 1);
      c.ok++;
    } else {
      c.boite = Math.max(c.boite - 2, 0);
      c.ko++;
    }
    c.due = plusJours(aujourdhui(), reussi ? INTERVALLES[c.boite] : 0);
  });
}

// Une erreur en exercice : la carte revient vite en révision.
export function erreurExercice(id) {
  maj(() => {
    const c = etat.cartes[id];
    if (!c) return;
    c.boite = Math.max(c.boite - 1, 0);
    c.due = aujourdhui();
  });
}

export const estAcquise = (id) => (etat.cartes[id]?.boite ?? 0) >= BOITE_ACQUISE;
export const nbAcquises = () => Object.values(etat.cartes).filter((c) => c.boite >= BOITE_ACQUISE).length;

// ---------- série de jours ----------
export function serieActuelle() {
  const s = etat.serie;
  if (!s.dernier) return 0;
  const auj = aujourdhui();
  if (s.dernier === auj || s.dernier === plusJours(auj, -1)) return s.jours;
  return 0;
}
export const serieFaiteAujourdhui = () => etat.serie.dernier === aujourdhui();

// Appelé quand elle termine au moins un morceau du défi.
export function compterJour() {
  const auj = aujourdhui();
  const s = etat.serie;
  if (s.dernier === auj) return false;
  s.jours = s.dernier === plusJours(auj, -1) ? s.jours + 1 : 1;
  s.dernier = auj;
  s.record = Math.max(s.record, s.jours);
  sauver();
  return true;
}

// ---------- carnet ----------
export function ajouterAuCarnet({ es, fr, note }) {
  maj(() => {
    const id = "carnet-" + Date.now().toString(36);
    etat.carnet.unshift({ id, es, fr, note: note || "", creeLe: aujourdhui() });
    decouvrir(id);
  });
}
export function retirerDuCarnet(id) {
  maj(() => {
    etat.carnet = etat.carnet.filter((p) => p.id !== id);
    delete etat.cartes[id];
  });
}

// ---------- sauvegarde ----------
export function exporter() {
  return JSON.stringify({ app: "mi-espanol", exporteLe: new Date().toISOString(), etat }, null, 1);
}
export function importer(texte) {
  const data = JSON.parse(texte);
  if (data.app !== "mi-espanol" || !data.etat || typeof data.etat.cartes !== "object") {
    throw new Error("Ce fichier n'est pas une sauvegarde de Mi Español.");
  }
  etat = { ...DEFAUT(), ...data.etat };
  sauver();
}
export function toutEffacer() {
  etat = DEFAUT();
  sauver();
}
