// L'audio : la voix espagnole intégrée au téléphone (synthèse vocale du système).
// Gratuit, sans serveur, marche hors ligne. Sur iPhone : voix d'Apple, accent d'Espagne.
import * as S from "./store.js";
import { e, ico } from "./ui.js";

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
export const disponible = () => !!synth && typeof SpeechSynthesisUtterance !== "undefined";

// Les voix réputées les plus naturelles, par ordre de préférence.
const PREFEREES = ["Mónica", "Monica", "Marisol", "Jorge", "Google español", "Microsoft Elvira", "Microsoft Alvaro", "Paulina"];
let voixChoisie = null;

function choisirVoix() {
  if (!disponible()) return null;
  const toutes = synth.getVoices();
  const espagne = toutes.filter((v) => /^es[-_]ES/i.test(v.lang));
  const espagnol = espagne.length ? espagne : toutes.filter((v) => /^es/i.test(v.lang));
  if (!espagnol.length) return null;
  const meilleure = (liste) => {
    for (const nom of PREFEREES) {
      const v = liste.find((x) => x.name.includes(nom) && /(enhanced|premium|améliorée|mejorada)/i.test(x.name));
      if (v) return v;
    }
    for (const nom of PREFEREES) {
      const v = liste.find((x) => x.name.includes(nom));
      if (v) return v;
    }
    return liste.find((x) => x.localService) || liste[0];
  };
  return meilleure(espagnol);
}

if (disponible()) {
  voixChoisie = choisirVoix();
  synth.addEventListener?.("voiceschanged", () => { voixChoisie = choisirVoix(); });
}

export const nomVoix = () => voixChoisie?.name || null;
export const aUneVoixEspagnole = () => !!(voixChoisie || choisirVoix());

const VITESSES = { lente: 0.7, normale: 0.95, rapide: 1.2 };

// Lit un texte en espagnol. `vitesse` : "lente" | "normale" | "rapide" (sinon le réglage).
export function parler(texte, { vitesse, bouton } = {}) {
  if (!disponible() || !texte) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(String(texte).replace(/[«»"]/g, ""));
  u.lang = voixChoisie?.lang || "es-ES";
  if (voixChoisie) u.voice = voixChoisie;
  u.rate = VITESSES[vitesse || S.get().reglages.vitesseVoix || "normale"] || 0.95;
  if (bouton) {
    bouton.classList.add("en-cours");
    u.onend = u.onerror = () => bouton.classList.remove("en-cours");
  }
  synth.speak(u);
}

export const arreter = () => synth?.cancel();

// Bouton « écouter » à poser à côté d'une phrase (jamais à l'intérieur d'un autre bouton).
export const bouton = (texte, { vitesse = "", classe = "" } = {}) =>
  disponible()
    ? `<button type="button" class="btn-voix ${classe}" data-voix="${e(texte)}" ${vitesse ? `data-vitesse="${vitesse}"` : ""} aria-label="Écouter en espagnol">${ico("son")}</button>`
    : "";

// Un seul écouteur pour tous les boutons de l'appli.
export function brancher() {
  // Sur iPhone, la toute première lecture doit venir d'un geste : on « réveille » la voix
  // au premier toucher, en silence, pour que la lecture automatique marche ensuite.
  const reveiller = () => {
    if (!disponible()) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    synth.speak(u);
  };
  document.addEventListener("pointerdown", reveiller, { once: true, capture: true });
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-voix]");
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    parler(b.dataset.voix, { vitesse: b.dataset.vitesse || undefined, bouton: b });
  });
}
