// Rappel quotidien (notifications « push »).
// Sur iPhone : seulement si l'appli est installée sur l'écran d'accueil (règle d'Apple, iOS 16.4 et plus).
import * as S from "./store.js";
import { VAPID_PUBLIQUE } from "./vapid.js";

export const pris_en_charge = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const estIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const installee = () => navigator.standalone || matchMedia("(display-mode: standalone)").matches;

// Pourquoi on ne peut pas activer, ou null si c'est possible.
export function obstacle() {
  if (estIOS() && !installee()) return "installer";
  if (!pris_en_charge()) return "navigateur";
  if (Notification.permission === "denied") return "refuse";
  return null;
}

function cleEnOctets(base64url) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const brut = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

const fuseau = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid"; } catch { return "Europe/Madrid"; }
};

async function envoyer(chemin, corps) {
  const r = await fetch(chemin, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
    credentials: "same-origin",
  });
  return { statut: r.status, ...(await r.json().catch(() => ({}))) };
}

async function abonnementActuel() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// À appeler depuis un toucher (Apple exige un geste pour demander la permission).
export async function activer(heureTexte = "19:00") {
  const pb = obstacle();
  if (pb) return { ok: false, erreur: pb };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, erreur: "refuse" };
  const reg = await navigator.serviceWorker.ready;
  let abo = await reg.pushManager.getSubscription();
  if (!abo) {
    abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleEnOctets(VAPID_PUBLIQUE) });
  }
  const [h, m] = heureTexte.split(":").map((x) => parseInt(x, 10) || 0);
  let r;
  try { r = await envoyer("/api/notifs/abonner", { abonnement: abo.toJSON(), heure: h, minute: m, fuseau: fuseau() }); }
  catch { return { ok: false, erreur: "serveur" }; }
  if (!r.ok) return { ok: false, erreur: r.erreur || "serveur" };
  S.maj((s) => (s.reglages.rappel = { actif: true, heure: heureTexte }));
  return { ok: true };
}

export async function changerHeure(heureTexte) {
  S.maj((s) => (s.reglages.rappel = { ...(s.reglages.rappel || {}), heure: heureTexte }));
  if (!S.get().reglages.rappel?.actif) return { ok: true };
  const abo = await abonnementActuel();
  if (!abo) return activer(heureTexte);
  const [h, m] = heureTexte.split(":").map((x) => parseInt(x, 10) || 0);
  const r = await envoyer("/api/notifs/abonner", { abonnement: abo.toJSON(), heure: h, minute: m, fuseau: fuseau() });
  return { ok: !!r.ok, erreur: r.erreur };
}

// Renvoie { ok } : hors ligne, le rappel reste actif (sinon il continuerait d'arriver alors que la case est décochée).
export async function desactiver() {
  try {
    const abo = await abonnementActuel();
    if (abo) {
      const r = await envoyer("/api/notifs/desabonner", { endpoint: abo.endpoint });
      if (!r.ok && r.statut !== 401) return { ok: false, erreur: "serveur" };
      await abo.unsubscribe();
    }
  } catch { return { ok: false, erreur: "serveur" }; }
  S.maj((s) => (s.reglages.rappel = { ...(s.reglages.rappel || {}), actif: false }));
  return { ok: true };
}

export async function essai() {
  const abo = await abonnementActuel();
  if (!abo) return { ok: false, erreur: "pas_abonne" };
  return envoyer("/api/notifs/essai", { endpoint: abo.endpoint });
}

export const MESSAGES = {
  installer: "Sur iPhone, installe d'abord l'appli : dans Safari, touche Partager, puis « Sur l'écran d'accueil ». Ouvre-la depuis l'icône, puis reviens ici.",
  navigateur: "Ce navigateur ne permet pas les notifications.",
  refuse: "Les notifications sont bloquées pour Mi Español. Autorise-les dans les réglages de ton téléphone (sur iPhone : Réglages, Notifications, Mi Español).",
  non_connecte: "Connecte-toi d'abord avec Face ID.",
  pas_abonne: "Active d'abord le rappel.",
  serveur: "Le serveur n'a pas répondu. Réessaie dans un instant.",
};
