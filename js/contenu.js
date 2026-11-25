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

const CLES_SPECIALES = new Set(["duo", "perso", "pub"]);

function personnaliser(x, duo, prenom, t, pub = null) {
  if (Array.isArray(x)) {
    // En version publique, une phrase marquée « pub: false » (trop personnelle) disparaît.
    const liste = pub ? x.filter((v) => !(v && typeof v === "object" && v.pub === false)) : x;
    return liste.map((v) => personnaliser(v, duo, prenom, t, pub));
  }
  if (!x || typeof x !== "object") return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) if (!CLES_SPECIALES.has(k)) o[k] = personnaliser(v, duo, prenom, t, pub);
  if (duo) {
    // D'abord le nom de la personne qui apprend, puis les variantes (qui peuvent faire parler Elisabeth).
    if (o.qui === index?.prenom && prenom) o.qui = prenom;
    if (x.duo && typeof x.duo === "object") Object.assign(o, personnaliser(x.duo, false, prenom, t, pub));
  }
  // Version publique : les textes neutres écrits pour tout le monde (« pub », et « pub.m » au masculin).
  // « pub.perso » remplace la variante de profil d'origine (souvent écrite pour Logroño) ; « pub.perso: null » la retire.
  let perso = x.perso;
  if (pub && x.pub && typeof x.pub === "object") {
    const { m, perso: persoPub, ...commun } = x.pub;
    Object.assign(o, commun);
    if (pub.genre === "m" && m && typeof m === "object") {
      const { perso: persoM, ...communM } = m;
      Object.assign(o, communM);
      if (persoM !== undefined) perso = persoM;
      else if (persoPub !== undefined) perso = persoPub;
    } else if (persoPub !== undefined) perso = persoPub;
  }
  // Enfin le profil de la personne (pays, ville, métier), s'il est rempli.
  if (perso && typeof perso === "object") {
    const rempli = remplir(perso, t);
    if (rempli) Object.assign(o, rempli);
  }
  return o;
}

// Version publique : le prénom de la personne remplace celui d'Elisabeth (ou de Khalil au masculin),
// partout où il désigne la personne qui apprend. Sa prononciation devient le prénom tel qu'il s'écrit.
const PRONS_PRENOM = { f: /é-li-ssa-BÉT/g, m: /ka-LIL/g };
function remplacerPrenom(x, ancien, nouveau, genre) {
  if (typeof x === "string") return x.split(ancien).join(nouveau);
  if (Array.isArray(x)) return x.map((v) => remplacerPrenom(v, ancien, nouveau, genre));
  if (!x || typeof x !== "object") return x;
  const o = {};
  for (const [k, v] of Object.entries(x)) {
    o[k] = k === "pron" && typeof v === "string" && PRONS_PRENOM[genre]
      ? v.replace(PRONS_PRENOM[genre], nouveau.toUpperCase()).split(ancien).join(nouveau)
      : remplacerPrenom(v, ancien, nouveau, genre);
  }
  return o;
}

let optionsPubliques = null;   // { genre, ville } pour un inscrit du public ; null pour Elisabeth et Khalil

export function profil(role, prenom, donnees, publique) {
  roleCourant = role || null;
  prenomCourant = prenom || "";
  if (donnees !== undefined) donneesProfil = donnees || null;
  if (publique !== undefined) optionsPubliques = publique || null;
  const cle = `${roleCourant}|${prenomCourant}|${JSON.stringify(donneesProfil || {})}|${JSON.stringify(optionsPubliques)}`;
  if (cle === profilActuel || !bruts.length) return;
  profilActuel = cle;
  const pub = optionsPubliques;
  const duo = pub ? pub.genre === "m" : roleCourant === "duo";
  const t = jetons(donneesProfil, duo ? "m" : "f");
  const miCiudad = (pub && pub.ville) || "mi ciudad";
  if (pub) t.miciudad = miCiudad;
  situations = bruts.map((s) => {
    let r = personnaliser(s, duo, prenomCourant, t, pub);
    if (pub && prenomCourant) r = remplacerPrenom(r, duo ? "Khalil" : (index?.prenom || "Elisabeth"), prenomCourant, duo ? "m" : "f");
    // « {miciudad} » : la ville où la personne vit en Espagne (écrite dans les textes neutres).
    if (pub) r = remplacerPrenom(r, "{miciudad}", miCiudad, "aucun");
    return r;
  });
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
