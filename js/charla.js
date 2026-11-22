// Charla : le partenaire de conversation IA (V2).
// L'appli n'a jamais la clé de l'IA : elle parle à notre serveur (/api/conversacion),
// qui vérifie un code d'accès et un plafond quotidien avant d'appeler Claude.
import * as S from "./store.js";
import { $, $$, e, ico, modale, toast } from "./ui.js";
import * as V from "./voix.js";

export const SCENES = [
  { id: "amiga", nom: "Lucía", lieu: "Una amiga", texte: "Une amie espagnole de ton âge. On papote : le week-end, les sorties, San Mateo." },
  { id: "bar", nom: "Javi", lieu: "El bar", texte: "Le serveur d'un bar de la calle Laurel. Commande, demande des conseils, paie." },
  { id: "vecina", nom: "Carmen", lieu: "La vecina", texte: "Ta voisine du troisième, retraitée et bavarde. Petite conversation dans l'ascenseur." },
  { id: "peluqueria", nom: "Sonia", lieu: "La peluquería", texte: "Tu appelles le salon pour prendre rendez-vous et expliquer ce que tu veux." },
  { id: "entrevista", nom: "Marta", lieu: "Entrevista", texte: "Un entretien d'embauche gentil dans une boutique de vêtements." },
  { id: "medico", nom: "Dr. Ruiz", lieu: "El médico", texte: "Ton médecin de famille. Explique ce qui ne va pas, il t'écoute." },
];
const ouvrir = "(Empieza tú la conversación, de forma natural y breve.)";

const ERREURS = {
  pas_configure: "La conversation arrive très bientôt. Encore un peu de patience.",
  limite: "Tu as beaucoup parlé aujourd'hui, bravo. On reprend demain.",
  occupe: "Le serveur est un peu débordé. Réessaie dans une minute.",
  refus: "Cette phrase n'a pas pu être traitée. Essaie de la dire autrement.",
  cle: "La conversation est en maintenance. Réessaie plus tard.",
};

const etat = () => S.get();

export function ecranCharla(app, { montrerNav, aller }) {
  const c = etat().charla;
  if (c && c.scene && SCENES.some((s) => s.id === c.scene)) return conversation(app, { montrerNav, aller });
  choix(app, { montrerNav, aller });
}

function choix(app, { montrerNav, aller }) {
  montrerNav("charla");
  app.innerHTML = `
    <header class="page-haut"><div><h1>Charla</h1><p class="page-sous">Parler avec quelqu'un</p></div></header>
    <p class="intro">Choisis une scène. La personne te répond en espagnol simple, tu réponds comme tu peux, et si tu te trompes, un petit post-it te montre la bonne tournure.</p>
    <div class="scenes">
      ${SCENES.map((s) => `
        <button class="scene" data-scene="${s.id}">
          <span class="scene-lieu">${e(s.lieu)}</span>
          <strong>${e(s.nom)}</strong>
          <span class="scene-texte">${e(s.texte)}</span>
        </button>`).join("")}
    </div>`;
  $$("[data-scene]", app).forEach((b) => (b.onclick = () => {
    S.maj((s) => (s.charla = { scene: b.dataset.scene, messages: [] }));
    conversation(app, { montrerNav, aller }, true);
  }));
}

function conversation(app, { montrerNav, aller }, demarrer = false) {
  montrerNav(null);
  const c = etat().charla;
  const scene = SCENES.find((s) => s.id === c.scene);
  const cachee = etat().reglages.traductionCachee;

  app.innerHTML = `
    <div class="charla">
      <header class="charla-haut">
        <button class="btn-ico" data-retour aria-label="Retour">${ico("retour")}</button>
        <div><strong>${e(scene.nom)}</strong><span class="petit">${e(scene.lieu)}</span></div>
        <button class="btn btn-doux btn-petit" data-nouvelle>Nueva</button>
      </header>
      <div class="fil" aria-live="polite"></div>
      <form class="saisie" data-saisie autocomplete="off">
        <div class="accents">${["á", "é", "í", "ó", "ú", "ñ", "¿", "¡"].map((a) => `<button type="button" data-a="${a}">${a}</button>`).join("")}</div>
        <div class="saisie-ligne">
          <textarea rows="1" maxlength="500" autocapitalize="sentences" spellcheck="false" placeholder="Escribe en español…" aria-label="Ton message"></textarea>
          <button class="btn btn-envoyer" aria-label="Envoyer">${ico("fleche")}</button>
        </div>
      </form>
    </div>`;

  const fil = $(".fil", app);
  const zone = $("textarea", app);

  const afficher = () => {
    const msgs = etat().charla.messages.filter((m) => m.content !== ouvrir);
    if (!msgs.length) {
      fil.innerHTML = `<p class="manuscrit fil-vide">Dis bonjour à ${e(scene.nom)}, ou touche « Nueva » pour qu'il commence.</p>`;
      return;
    }
    fil.innerHTML = msgs.map((m) => m.role === "assistant"
      ? `<div class="bulle-ligne"><button class="bulle-ia ${cachee ? "" : "revele"}" data-reveler>
           <span class="es">${e(m.content)}</span>
           ${m.traduccion ? `<span class="fr">${e(m.traduccion)}</span>` : ""}
         </button>${V.bouton(m.content)}</div>`
      : `<div class="bulle-moi"><span>${e(m.content)}</span>${m.correccion ? `<p class="correction">${e(m.correccion)}</p>` : ""}</div>`).join("");
    $$("[data-reveler]", fil).forEach((b) => (b.onclick = () => b.classList.toggle("revele")));
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const ecrit = (on) => {
    let t = $(".ecrit", fil);
    if (on && !t) { fil.insertAdjacentHTML("beforeend", `<p class="ecrit">${e(scene.nom)} écrit…</p>`); window.scrollTo({ top: document.body.scrollHeight }); }
    if (!on && t) t.remove();
  };

  async function envoyer(texte) {
    S.maj((s) => s.charla.messages.push({ role: "user", content: texte }));
    afficher();
    ecrit(true);
    const r = await appeler();
    ecrit(false);
    if (r.ok) {
      S.maj((s) => {
        const msgs = s.charla.messages;
        const dernier = msgs[msgs.length - 1];
        if (dernier && dernier.role === "user") dernier.correccion = r.correccion || "";
        msgs.push({ role: "assistant", content: r.respuesta, traduccion: r.traduccion });
      });
      if (S.get().reglages.lectureAuto !== false) V.parler(r.respuesta);
    } else {
      // On retire le message non traité pour qu'elle puisse le renvoyer.
      S.maj((s) => s.charla.messages.pop());
      if (texte !== ouvrir) zone.value = texte;
    }
    afficher();
  }

  async function appeler() {
    let code = etat().codeIA;
    if (!code) {
      code = await demanderCode();
      if (!code) return { ok: false };
    }
    try {
      const rep = await fetch("api/conversacion", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Code-Acces": code },
        body: JSON.stringify({
          scene: etat().charla.scene,
          messages: etat().charla.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const d = await rep.json().catch(() => ({}));
      if (rep.status === 404) { toast("La conversation marche sur espanol.elibangoura.com"); return { ok: false }; }
      if (d.erreur === "code") {
        S.maj((s) => (s.codeIA = null));
        toast("Ce code n'est pas le bon.");
        return { ok: false };
      }
      if (d.erreur) { toast(ERREURS[d.erreur] || "Petit souci. Réessaie dans un instant."); return { ok: false }; }
      return { ok: true, ...d };
    } catch {
      toast("Pas de réseau pour l'instant. La conversation a besoin d'internet.");
      return { ok: false };
    }
  }

  $("[data-retour]", app).onclick = () => { S.maj((s) => (s.charla = null)); aller("#/charla"); choix(app, { montrerNav, aller }); };
  $("[data-nouvelle]", app).onclick = () => {
    S.maj((s) => (s.charla = { scene: s.charla.scene, messages: [] }));
    afficher();
    envoyer(ouvrir);
  };
  $$("[data-a]", app).forEach((b) => (b.onclick = () => {
    const [d, f] = [zone.selectionStart, zone.selectionEnd];
    zone.value = zone.value.slice(0, d) + b.dataset.a + zone.value.slice(f);
    zone.focus();
    zone.setSelectionRange(d + 1, d + 1);
  }));
  zone.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); $("[data-saisie]", app).requestSubmit(); }
  });
  $("[data-saisie]", app).onsubmit = (ev) => {
    ev.preventDefault();
    const texte = zone.value.trim();
    if (!texte || $(".ecrit", fil)) return;
    zone.value = "";
    envoyer(texte);
  };

  afficher();
  if (demarrer || !etat().charla.messages.length) envoyer(ouvrir);
}

async function demanderCode() {
  let saisi = "";
  const promesse = modale(`
    <h2>Code d'accès</h2>
    <p>La conversation est réservée à toi. Entre le code que l'on t'a donné.</p>
    <input class="code-champ" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Code d'accès">
    <div class="rangee"><button class="btn btn-doux" data-valeur="non">Annuler</button><button class="btn" data-valeur="oui">Valider</button></div>`);
  const champ = $("#modale .code-champ");
  champ.addEventListener("input", () => (saisi = champ.value.trim()));
  champ.focus();
  const choix = await promesse;
  if (choix !== "oui" || !saisi) return null;
  S.maj((s) => (s.codeIA = saisi));
  return saisi;
}
