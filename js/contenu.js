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
  situations = res.map((r) => r.value).sort((a, b) => a.ordre - b.ordre);
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
