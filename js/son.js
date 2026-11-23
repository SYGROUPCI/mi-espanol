// Le petit bruit du tampon quand une situation est « sellada ».
// Fabriqué à la volée (Web Audio) : pas de fichier à télécharger, marche hors ligne.
// Sur iPhone, le mode « ambiant » le rend muet quand le bouton silencieux est activé.
import * as S from "./store.js";

let ctx = null;

export function tampon() {
  if (S.get().reglages.sons === false) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    if (navigator.audioSession) navigator.audioSession.type = "ambient";
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime + 0.01;

    // Le choc sourd du tampon sur le papier.
    const choc = ctx.createOscillator();
    const gChoc = ctx.createGain();
    choc.type = "sine";
    choc.frequency.setValueAtTime(140, t);
    choc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    gChoc.gain.setValueAtTime(0.0001, t);
    gChoc.gain.exponentialRampToValueAtTime(0.5, t + 0.008);
    gChoc.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    choc.connect(gChoc).connect(ctx.destination);
    choc.start(t);
    choc.stop(t + 0.18);

    // Le froissement du papier : un souffle très court, filtré.
    const duree = 0.09;
    const tampon = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duree), ctx.sampleRate);
    const d = tampon.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const bruit = ctx.createBufferSource();
    bruit.buffer = tampon;
    const filtre = ctx.createBiquadFilter();
    filtre.type = "lowpass";
    filtre.frequency.value = 1800;
    const gBruit = ctx.createGain();
    gBruit.gain.value = 0.25;
    bruit.connect(filtre).connect(gBruit).connect(ctx.destination);
    bruit.start(t);
  } catch (_) { /* pas de son : ce n'est pas grave */ }
  // On rend la main à la voix espagnole (qui, elle, doit s'entendre).
  setTimeout(() => { try { if (navigator.audioSession) navigator.audioSession.type = "auto"; } catch (_) { /* rien */ } }, 400);
}
