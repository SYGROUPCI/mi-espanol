// Chargement des leçons (fichiers JSON dans data/).

let index = null;
let situations = [];
let mots = [];
let parId = new Map();   // id de phrase -> { phrase, situation }

export async function charger() {
  const lire = (url) => fetch(url).then((r) => {
    if (!r.ok) throw new Error(url);
    return r.json();
  });
  index = await lire("data/index.json");
  const res = await Promise.allSettled(index.situations.map((f) => lire("data/" + f)));
  // Un chargement partiel fausserait tout (défi du jour vide, A2 reverrouillé) : on préfère l'écran « Réessayer ».
  if (res.some((r) => r.status === "rejected")) throw new Error("contenu incomplet");
  bruts = res.map((r) => r.value).sort((a, b) => a.ordre - b.ordre);
  profilActuel = undefined;
  profil(roleCourant, prenomCourant);
}

// ---------------------------------------------------------------------------
// Profil : le contenu est écrit pour Elisabeth ; sur le compte de Khalil (rôle « duo »),
// chaque clé « duo » remplace les champs concernés (accords, prénom, origine…).
let bruts = [];
let profilActuel;
let roleCourant = null, prenomCourant = "";

function personnaliser(x, duo, prenom) {
  if (Array.isArray(x)) return x.map((v) => personnaliser(v, duo, prenom));
  if (!x || typeof x !== "object") return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) if (k !== "duo") o[k] = personnaliser(v, duo, prenom);
  if (duo) {
    // D'abord le nom de la personne qui apprend, puis les variantes (qui peuvent faire parler Elisabeth).
    if (o.qui === index?.prenom && prenom) o.qui = prenom;
    if (x.duo && typeof x.duo === "object") Object.assign(o, personnaliser(x.duo, false, prenom));
  }
  return o;
}

export function profil(role, prenom) {
  roleCourant = role || null;
  prenomCourant = prenom || "";
  const cle = `${roleCourant}|${prenomCourant}`;
  if (cle === profilActuel || !bruts.length) return;
  profilActuel = cle;
  const duo = roleCourant === "duo";
  situations = bruts.map((s) => personnaliser(s, duo, prenomCourant));
  parId = new Map();
  for (const s of situations) for (const p of s.phrases) parId.set(p.id, { phrase: p, situation: s });
}

export const prenomParDefaut = () => index?.prenom || "";
export const toutes = () => situations;
export const bientot = () => index?.bientot || [];
export const situation = (id) => situations.find((s) => s.id === id);
export const petitsMots = () => mots;
// Les petits mots viennent du compte (serveur), pas des fichiers publics.
export const definirMots = (liste) => { mots = Array.isArray(liste) ? liste : []; };

// Phrase par id : leçons + carnet perso.
export function phrase(id, carnet = []) {
  if (parId.has(id)) return parId.get(id).phrase;
  return carnet.find((p) => p.id === id) || null;
}
export const situationDe = (id) => parId.get(id)?.situation || null;
