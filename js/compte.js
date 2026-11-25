// Compte Mi Español : Face ID (passkeys), progression synchronisée, duo.
// L'appli reste « hors ligne d'abord » : tout est enregistré sur le téléphone, puis envoyé au serveur.
import * as S from "./store.js";
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from "./vendor/webauthn/index.js";

const ENVOI_DIFFERE_MS = 4000;
// Ce qui reste propre à l'appareil et ne part jamais sur le serveur.
const LOCAL_SEULEMENT = ["codeIA", "compte", "charla"];

export const faceIdDisponible = () => {
  try { return browserSupportsWebAuthn(); } catch { return false; }
};
export const connecte = () => !!S.get().compte;
export const compte = () => S.get().compte;

async function api(chemin, { methode = "GET", corps, keepalive = false } = {}) {
  const rep = await fetch(chemin, {
    method: methode,
    headers: corps ? { "Content-Type": "application/json" } : {},
    body: corps ? JSON.stringify(corps) : undefined,
    credentials: "same-origin",
    keepalive,
  });
  const d = await rep.json().catch(() => ({}));
  return { statut: rep.status, ...d };
}

const appareil = () => {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "PC Windows";
  return "Appareil";
};

const pourServeur = (etat) => {
  const copie = { ...etat };
  for (const k of LOCAL_SEULEMENT) delete copie[k];
  // Le rappel dépend de l'appareil (abonnement aux notifications) : il ne voyage pas.
  if (copie.reglages) { copie.reglages = { ...copie.reglages }; delete copie.reglages.rappel; }
  return copie;
};

// Version du serveur lue en dernier (contrôle de version à l'envoi).
let base = null;

// ---------------------------------------------------------------------------
// Fusion de deux progressions (téléphone + serveur) sans rien perdre.
function poidsCarte(c) { return (c?.ok || 0) + (c?.ko || 0); }

export function fusionner(local, serveur) {
  if (!serveur) return local;
  if (!local) return serveur;
  const r = { ...serveur, ...local };

  r.cartes = { ...(serveur.cartes || {}) };
  for (const [id, c] of Object.entries(local.cartes || {})) {
    const s = r.cartes[id];
    if (!s || poidsCarte(c) > poidsCarte(s) || (poidsCarte(c) === poidsCarte(s) && (c.due || "") > (s.due || ""))) r.cartes[id] = c;
  }

  // Suppressions : union des deux côtés, puis on retire ces phrases partout.
  r.supprimes = { ...(serveur.supprimes || {}), ...(local.supprimes || {}) };
  const parId = new Map();
  for (const p of [...(serveur.carnet || []), ...(local.carnet || [])]) if (!r.supprimes[p.id]) parId.set(p.id, p);
  r.carnet = [...parId.values()].sort((a, b) => (b.creeLe || "").localeCompare(a.creeLe || ""));
  for (const id of Object.keys(r.supprimes)) delete r.cartes[id];

  // Série : la plus récente, mais sans perdre les jours que l'autre appareil a déjà comptés.
  const sl = local.serie || {}, ss = serveur.serie || {};
  const [a, b] = (sl.dernier || "") >= (ss.dernier || "") ? [sl, ss] : [ss, sl];
  let jours = a.jours || 0;
  if (a.dernier && b.dernier) {
    if (a.dernier === b.dernier) jours = Math.max(a.jours || 0, b.jours || 0);
    else if (b.dernier === S.plusJours(a.dernier, -1)) jours = Math.max(jours, (b.jours || 0) + 1);
  }
  r.serie = { jours, dernier: a.dernier || null, record: Math.max(sl.record || 0, ss.record || 0, jours) };

  r.defisFaits = Math.max(local.defisFaits || 0, serveur.defisFaits || 0);
  r.motsVus = [...new Set([...(serveur.motsVus || []), ...(local.motsVus || [])])];
  r.sellos = [...new Set([...(serveur.sellos || []), ...(local.sellos || [])])];

  const dl = local.defi, ds = serveur.defi;
  const finis = (d) => (d?.morceaux || []).filter((m) => m.fini).length;
  if (dl && ds) r.defi = dl.date !== ds.date ? (dl.date > ds.date ? dl : ds) : (finis(dl) >= finis(ds) ? dl : ds);
  else r.defi = dl || ds || null;

  r.creeLe = [local.creeLe, serveur.creeLe].filter(Boolean).sort()[0] || local.creeLe;
  r.reglages = { ...(serveur.reglages || {}), ...(local.reglages || {}) };
  if (local.reglages?.rappel) r.reglages.rappel = local.reglages.rappel; else delete r.reglages.rappel;
  r.bienvenueVue = true;
  return r;
}

// ---------------------------------------------------------------------------
// Envoi de la progression (différé, regroupé), et récupération.
let minuteur = null;
let envoiEnCours = null;
let aRenvoyer = false;

// Renvoie true si le serveur a bien reçu la progression.
async function envoyer({ keepalive = false, essai = 0 } = {}) {
  if (!connecte()) return false;
  if (envoiEnCours) { aRenvoyer = true; return envoiEnCours; }
  let conflit = false;
  envoiEnCours = (async () => {
    try {
      const corps = { progression: pourServeur(S.get()), base };
      // keepalive est limité à 64 Ko par le navigateur : au-delà, envoi normal.
      const gros = JSON.stringify(corps).length > 60_000;
      const r = await api("/api/progression", { methode: "PUT", corps, keepalive: keepalive && !gros });
      if (r.statut === 401) { S.remplacer({ ...S.get(), compte: null }); return false; }
      if (r.statut === 409) { conflit = true; return false; }
      if (r.ok) { base = r.maj_le; return true; }
      return false;
    } catch { return false; /* hors ligne : on réessaiera au prochain changement ou au retour */ }
  })();
  let ok;
  try { ok = await envoiEnCours; }
  finally { envoiEnCours = null; }
  // Un autre appareil a écrit entre-temps : on récupère, on fusionne, puis on renvoie.
  if (conflit && essai < 2) return synchroniser(essai + 1);
  if (aRenvoyer) { aRenvoyer = false; programmerEnvoi(); }
  return ok;
}

function programmerEnvoi() {
  if (!connecte()) return;
  clearTimeout(minuteur);
  minuteur = setTimeout(envoyer, ENVOI_DIFFERE_MS);
}

export async function synchroniser(essai = 0) {
  if (!connecte()) return false;
  try {
    const r = await api("/api/progression");
    if (r.statut === 401) { S.remplacer({ ...S.get(), compte: null }); return false; }
    if (r.statut !== 200) return false;
    base = r.maj_le || null;
    if (r.progression) {
      const garde = { codeIA: S.get().codeIA, charla: S.get().charla, compte: S.get().compte };
      S.remplacer({ ...fusionner(S.get(), r.progression), ...garde });
    }
    return await envoyer({ essai });
  } catch { return false; }
}

// À appeler une fois au démarrage.
export function demarrer() {
  S.surChangement(programmerEnvoi);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { clearTimeout(minuteur); envoyer({ keepalive: true }); }
    else synchroniser();
  });
  window.addEventListener("online", () => synchroniser());
  return synchroniser();
}

// ---------------------------------------------------------------------------
// Créer son compte : inscription ouverte (prénom, ville, genre) ou code d'invitation, puis Face ID.
export async function creerCompte(code, infos = null) {
  const opt = await api("/api/compte/inscription/options", { methode: "POST", corps: code ? { code } : infos });
  if (opt.erreur) return { ok: false, erreur: opt.erreur };
  let reponse;
  try {
    reponse = await startRegistration({ optionsJSON: opt.options });
  } catch (err) {
    return { ok: false, erreur: err?.name === "NotAllowedError" ? "annule" : "faceid" };
  }
  base = null;
  const local = S.get();
  // La progression déjà faite sur ce téléphone rejoint le compte, sauf si elle appartenait à quelqu'un d'autre.
  const progression = local.compte ? null : pourServeur(local);
  const v = await api("/api/compte/inscription/verification", {
    methode: "POST",
    corps: { defi: opt.options.challenge, reponse, progression, appareil: appareil() },
  });
  if (!v.ok) return { ok: false, erreur: v.erreur || "verification" };
  S.remplacer({ ...S.get(), ...infosLocales(v.utilisateur), compte: v.utilisateur, prenom: v.utilisateur.prenom });
  await synchroniser();
  return { ok: true, utilisateur: v.utilisateur };
}

// La ville et le genre du compte, recopiés sur l'appareil (pour l'accueil et les accords).
const infosLocales = (u) => (u && u.role === "membre" ? { villeEs: u.ville || null, genre: u.genre || null } : {});

// Met à jour ce que l'appareil sait du compte (statut d'essai ou d'abonné, ville, genre).
export async function rafraichirCompte() {
  if (!connecte()) return false;
  try {
    const r = await api("/api/compte/moi");
    if (r.statut === 401) { S.remplacer({ ...S.get(), compte: null }); return true; }
    if (r.statut !== 200 || !r.utilisateur) return false;
    const avant = JSON.stringify(S.get().compte);
    if (avant === JSON.stringify(r.utilisateur)) return false;
    S.remplacer({ ...S.get(), ...infosLocales(r.utilisateur), compte: r.utilisateur });
    return true;
  } catch { return false; }
}

// Se connecter avec Face ID (aucun nom à taper : l'iPhone propose le bon compte).
export async function seConnecter() {
  const opt = await api("/api/compte/connexion/options", { methode: "POST" });
  if (opt.erreur) return { ok: false, erreur: opt.erreur };
  let reponse;
  try {
    reponse = await startAuthentication({ optionsJSON: opt.options });
  } catch (err) {
    return { ok: false, erreur: err?.name === "NotAllowedError" ? "annule" : "faceid" };
  }
  const v = await api("/api/compte/connexion/verification", {
    methode: "POST",
    corps: { defi: opt.options.challenge, reponse },
  });
  if (!v.ok) return { ok: false, erreur: v.erreur || "verification" };
  base = null;
  const avant = S.get();
  // Si ce téléphone contenait la progression de quelqu'un d'autre, on ne la mélange pas.
  const autrePersonne = avant.compte && (avant.compte.prenom !== v.utilisateur.prenom || avant.compte.role !== v.utilisateur.role);
  const base = autrePersonne ? { bienvenueVue: true, reglages: avant.reglages } : avant;
  S.remplacer({ ...base, ...infosLocales(v.utilisateur), compte: v.utilisateur, prenom: v.utilisateur.prenom, codeIA: avant.codeIA });
  await synchroniser();
  return { ok: true, utilisateur: v.utilisateur };
}

// Se déconnecter : la progression reste sur le serveur ; le téléphone repart à zéro.
// Hors ligne, on refuse : sinon le travail pas encore envoyé serait perdu.
// avantDeSortir : ce qu'il faut faire tant que la session existe encore (désabonner les rappels).
export async function seDeconnecter({ avantDeSortir, prenomParDefaut = "" } = {}) {
  clearTimeout(minuteur);
  if (!(await synchroniser())) return { ok: false, erreur: "hors_ligne" };
  try { await avantDeSortir?.(); } catch { /* le rappel sera nettoyé au prochain envoi */ }
  try {
    const r = await api("/api/compte/deconnexion", { methode: "POST" });
    if (!r.ok) return { ok: false, erreur: "hors_ligne" };
  } catch { return { ok: false, erreur: "hors_ligne" }; }
  base = null;
  const reglages = { ...S.get().reglages };
  delete reglages.rappel;
  S.toutEffacer();
  S.remplacer({ ...S.get(), reglages, prenom: prenomParDefaut || null, bienvenueVue: false });
  oublierMots();
  return { ok: true };
}

// Supprimer son compte : tout est effacé sur le serveur, puis sur cet appareil.
// avantDeSortir : désabonner les rappels tant que la session existe encore.
export async function supprimerCompte({ avantDeSortir } = {}) {
  clearTimeout(minuteur);
  try { await avantDeSortir?.(); } catch { /* les abonnements sont aussi effacés côté serveur */ }
  let r;
  try { r = await api("/api/compte/suppression", { methode: "POST" }); } catch { return { ok: false, erreur: "hors_ligne" }; }
  if (!r.ok) return { ok: false, erreur: r.erreur || "hors_ligne" };
  base = null;
  const theme = S.get().reglages?.theme;
  S.toutEffacer();
  if (theme) S.maj((s) => (s.reglages.theme = theme));
  oublierMots();
  return { ok: true };
}

// « Tout recommencer » avec un compte : on efface ici, puis on remplace la copie en ligne (sans fusion,
// sinon l'ancienne progression reviendrait à la synchro suivante).
export async function remettreAZero(prenom) {
  clearTimeout(minuteur);
  try {
    const lu = await api("/api/progression");
    if (lu.statut !== 200) return { ok: false, erreur: "hors_ligne" };
    const { compte: c, codeIA, reglages } = S.get();
    S.toutEffacer();
    S.remplacer({ ...S.get(), compte: c, codeIA, prenom: prenom || c?.prenom || null, bienvenueVue: true,
      reglages: { ...reglages } });
    const r = await api("/api/progression", { methode: "PUT", corps: { progression: pourServeur(S.get()), base: lu.maj_le || null } });
    if (!r.ok) return { ok: false, erreur: "hors_ligne" };
    base = r.maj_le;
    return { ok: true };
  } catch { return { ok: false, erreur: "hors_ligne" }; }
}

// ---------------------------------------------------------------------------
// Petits mots (lettres surprises) : servis par le serveur, seulement à Elisabeth,
// gardés sur l'appareil pour le hors ligne.
const CLE_MOTS = "miespanol.mots";
export function motsEnCache() {
  try { return JSON.parse(localStorage.getItem(CLE_MOTS) || "[]"); } catch { return []; }
}
function oublierMots() { try { localStorage.removeItem(CLE_MOTS); } catch { /* rien */ } }
export async function chargerMots() {
  if (!connecte()) { oublierMots(); return []; }
  try {
    const r = await api("/api/mots");
    if (r.statut === 200 && Array.isArray(r.mots)) {
      const mots = r.mots.filter((m) => m && m.texte && String(m.texte).trim());
      try { localStorage.setItem(CLE_MOTS, JSON.stringify(mots)); } catch { /* stockage plein */ }
      return mots;
    }
    if (r.statut === 401) oublierMots();
  } catch { /* hors ligne : on garde ce qu'on a */ }
  return motsEnCache();
}

export async function duo() {
  if (!connecte()) return null;
  try {
    const r = await api("/api/duo");
    return r.duo || null;
  } catch { return null; }
}

export const MESSAGES = {
  code_invalide: "Ce code d'invitation n'est pas valable, ou il a déjà servi.",
  champs: "Il manque ton prénom, ta ville ou le féminin / masculin.",
  proprietaire: "Ce compte ne peut pas être supprimé depuis l'appli.",
  trop_comptes: "Plusieurs comptes ont déjà été créés aujourd'hui depuis cette connexion. Réessaie demain.",
  trop_essais: "Trop d'essais aujourd'hui. Réessaie demain.",
  annule: "Face ID a été annulé. Tu peux réessayer quand tu veux.",
  faceid: "Face ID n'a pas pu se lancer sur cet appareil.",
  defi_expire: "Ça a pris un peu trop de temps. Réessaie.",
  cle_inconnue: "Ce Face ID n'est relié à aucun compte Mi Español.",
  verification: "La vérification a échoué. Réessaie.",
  hors_ligne: "Pas de connexion : ta progression n'a pas encore pu être envoyée. Reconnecte-toi à internet, puis réessaie.",
};
