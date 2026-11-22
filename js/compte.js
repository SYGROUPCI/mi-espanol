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
  return copie;
};

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

  const parId = new Map();
  for (const p of [...(serveur.carnet || []), ...(local.carnet || [])]) parId.set(p.id, p);
  r.carnet = [...parId.values()].sort((a, b) => (b.creeLe || "").localeCompare(a.creeLe || ""));

  const sl = local.serie || {}, ss = serveur.serie || {};
  const recente = (sl.dernier || "") >= (ss.dernier || "") ? sl : ss;
  r.serie = { jours: recente.jours || 0, dernier: recente.dernier || null, record: Math.max(sl.record || 0, ss.record || 0) };

  r.defisFaits = Math.max(local.defisFaits || 0, serveur.defisFaits || 0);
  r.motsVus = [...new Set([...(serveur.motsVus || []), ...(local.motsVus || [])])];
  r.sellos = [...new Set([...(serveur.sellos || []), ...(local.sellos || [])])];

  const dl = local.defi, ds = serveur.defi;
  const finis = (d) => (d?.morceaux || []).filter((m) => m.fini).length;
  if (dl && ds) r.defi = dl.date !== ds.date ? (dl.date > ds.date ? dl : ds) : (finis(dl) >= finis(ds) ? dl : ds);
  else r.defi = dl || ds || null;

  r.creeLe = [local.creeLe, serveur.creeLe].filter(Boolean).sort()[0] || local.creeLe;
  r.reglages = { ...(serveur.reglages || {}), ...(local.reglages || {}) };
  r.bienvenueVue = true;
  return r;
}

// ---------------------------------------------------------------------------
// Envoi de la progression (différé, regroupé), et récupération.
let minuteur = null;
let envoiEnCours = false;

async function envoyer({ keepalive = false } = {}) {
  if (!connecte() || envoiEnCours) return;
  envoiEnCours = true;
  try {
    const r = await api("/api/progression", { methode: "PUT", corps: { progression: pourServeur(S.get()) }, keepalive });
    if (r.statut === 401) S.remplacer({ ...S.get(), compte: null });
  } catch { /* hors ligne : on réessaiera au prochain changement ou au retour */ }
  finally { envoiEnCours = false; }
}

function programmerEnvoi() {
  if (!connecte()) return;
  clearTimeout(minuteur);
  minuteur = setTimeout(envoyer, ENVOI_DIFFERE_MS);
}

export async function synchroniser() {
  if (!connecte()) return false;
  try {
    const r = await api("/api/progression");
    if (r.statut === 401) { S.remplacer({ ...S.get(), compte: null }); return false; }
    if (r.progression) {
      const garde = { codeIA: S.get().codeIA, charla: S.get().charla, compte: S.get().compte };
      S.remplacer({ ...fusionner(S.get(), r.progression), ...garde });
    }
    await envoyer();
    return true;
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
// Créer son compte (code d'invitation + Face ID)
export async function creerCompte(code) {
  const opt = await api("/api/compte/inscription/options", { methode: "POST", corps: { code } });
  if (opt.erreur) return { ok: false, erreur: opt.erreur };
  let reponse;
  try {
    reponse = await startRegistration({ optionsJSON: opt.options });
  } catch (err) {
    return { ok: false, erreur: err?.name === "NotAllowedError" ? "annule" : "faceid" };
  }
  const local = S.get();
  // La progression déjà faite sur ce téléphone rejoint le compte, sauf si elle appartenait à quelqu'un d'autre.
  const progression = local.compte ? null : pourServeur(local);
  const v = await api("/api/compte/inscription/verification", {
    methode: "POST",
    corps: { defi: opt.options.challenge, reponse, progression, appareil: appareil() },
  });
  if (!v.ok) return { ok: false, erreur: v.erreur || "verification" };
  S.remplacer({ ...S.get(), compte: v.utilisateur, prenom: v.utilisateur.prenom });
  await synchroniser();
  return { ok: true, utilisateur: v.utilisateur };
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
  const avant = S.get();
  // Si ce téléphone contenait la progression de quelqu'un d'autre, on ne la mélange pas.
  const autrePersonne = avant.compte && (avant.compte.prenom !== v.utilisateur.prenom || avant.compte.role !== v.utilisateur.role);
  const base = autrePersonne ? { bienvenueVue: true, reglages: avant.reglages } : avant;
  S.remplacer({ ...base, compte: v.utilisateur, prenom: v.utilisateur.prenom, codeIA: avant.codeIA });
  await synchroniser();
  return { ok: true, utilisateur: v.utilisateur };
}

// Se déconnecter : la progression reste sur le serveur ; le téléphone repart à zéro.
export async function seDeconnecter() {
  clearTimeout(minuteur);
  await envoyer();
  try { await api("/api/compte/deconnexion", { methode: "POST" }); } catch { /* hors ligne */ }
  const reglages = S.get().reglages;
  S.toutEffacer();
  S.remplacer({ ...S.get(), reglages, bienvenueVue: false });
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
  trop_essais: "Trop d'essais aujourd'hui. Réessaie demain.",
  annule: "Face ID a été annulé. Tu peux réessayer quand tu veux.",
  faceid: "Face ID n'a pas pu se lancer sur cet appareil.",
  defi_expire: "Ça a pris un peu trop de temps. Réessaie.",
  cle_inconnue: "Ce Face ID n'est relié à aucun compte Mi Español.",
  verification: "La vérification a échoué. Réessaie.",
};
