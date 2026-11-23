// Chargement des leçons (fichiers JSON dans data/).
import { jetons } from "./profil.js";

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
let roleCourant = null, prenomCourant = "", donneesProfil = null;

// Remplit « {pais} », « {ciudad} »… ; renvoie null s'il manque une valeur (la phrase garde alors son texte écrit).
function remplir(modele, t) {
  let manque = false;
  const r = (v) => {
    if (typeof v === "string") return v.replace(/\{(\w+)\}/g, (_, k) => (k in t ? t[k] : ((manque = true), "")));
    if (Array.isArray(v)) return v.map(r);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, r(x)]));
    return v;
  };
  const res = r(modele);
  return manque ? null : res;
}

function personnaliser(x, duo, prenom, t) {
  if (Array.isArray(x)) return x.map((v) => personnaliser(v, duo, prenom, t));
  if (!x || typeof x !== "object") return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) if (k !== "duo" && k !== "perso") o[k] = personnaliser(v, duo, prenom, t);
  if (duo) {
    // D'abord le nom de la personne qui apprend, puis les variantes (qui peuvent faire parler Elisabeth).
    if (o.qui === index?.prenom && prenom) o.qui = prenom;
    if (x.duo && typeof x.duo === "object") Object.assign(o, personnaliser(x.duo, false, prenom, t));
  }
  // Enfin le profil de la personne (pays, ville, métier), s'il est rempli.
  if (x.perso && typeof x.perso === "object") {
    const rempli = remplir(x.perso, t);
    if (rempli) Object.assign(o, rempli);
  }
  return o;
}

export function profil(role, prenom, donnees) {
  roleCourant = role || null;
  prenomCourant = prenom || "";
  if (donnees !== undefined) donneesProfil = donnees || null;
  const cle = `${roleCourant}|${prenomCourant}|${JSON.stringify(donneesProfil || {})}`;
  if (cle === profilActuel || !bruts.length) return;
  profilActuel = cle;
  const duo = roleCourant === "duo";
  const t = jetons(donneesProfil, duo ? "m" : "f");
  situations = bruts.map((s) => personnaliser(s, duo, prenomCourant, t));
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
