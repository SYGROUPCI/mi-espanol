// Charla : le partenaire de conversation IA (V2).
// L'appli n'a jamais la clé de l'IA : elle parle à notre serveur (/api/conversacion),
// qui vérifie un code d'accès et un plafond quotidien avant d'appeler Claude.
import * as S from "./store.js";
import { $, $$, e, ico, modale, toast, confirmer } from "./ui.js";
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

// Une seule réponse attendue à la fois, quelle que soit la conversation.
let enVol = false;
const aDejaParle = (c) => (c?.messages || []).some((m) => m.role === "user" && m.content !== ouvrir);

function choix(app, { montrerNav, aller }) {
  montrerNav("charla");
  const encours = etat().charla;
  const sceneEnCours = encours && SCENES.find((x) => x.id === encours.scene);
  app.innerHTML = `
    <header class="page-haut"><div><h1 tabindex="-1">Charla</h1><p class="page-sous">Parler avec quelqu'un</p></div></header>
    <p class="intro">Choisis une scène. La personne te répond en espagnol simple, tu réponds comme tu peux, et si tu te trompes, un petit post-it te montre la bonne tournure.</p>
    ${sceneEnCours && aDejaParle(encours) ? `<button class="btn btn-large btn-reprendre" data-reprendre>Reprendre avec ${e(sceneEnCours.nom)}</button>` : ""}
    <div class="scenes">
      ${SCENES.map((s) => `
        <button class="scene" data-scene="${s.id}">
          <span class="scene-lieu">${e(s.lieu)}</span>
          <strong>${e(s.nom)}</strong>
          <span class="scene-texte">${e(s.texte)}</span>
        </button>`).join("")}
    </div>`;
  $("[data-reprendre]", app)?.addEventListener("click", () => conversation(app, { montrerNav, aller }));
  $$("[data-scene]", app).forEach((b) => (b.onclick = async () => {
    const c = etat().charla;
    if (c?.scene === b.dataset.scene && aDejaParle(c)) return conversation(app, { montrerNav, aller });
    if (aDejaParle(c) && !(await confirmer("Nouvelle conversation ?", "La conversation en cours sera effacée.", "Commencer"))) return;
    if (enVol) return toast("Un instant, la réponse arrive…");
    S.maj((s) => (s.charla = { scene: b.dataset.scene, messages: [] }));
    conversation(app, { montrerNav, aller }, true);
  }));
}

function conversation(app, { montrerNav, aller }, demarrer = false) {
  montrerNav(null);
  const c = etat().charla;
  const scene = SCENES.find((s) => s.id === c.scene);
  const Reconnaissance = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micro = !!Reconnaissance;
  const cachee = etat().reglages.traductionCachee;

  app.innerHTML = `
    <div class="charla">
      <header class="charla-haut">
        <button class="btn-ico" data-retour aria-label="Retour">${ico("retour")}</button>
        <div><strong>${e(scene.nom)}</strong><span class="petit">${e(scene.lieu)}</span></div>
        <button class="btn btn-doux btn-petit" data-nouvelle>Nueva</button>
      </header>
      <div class="fil" role="log" aria-live="polite" aria-relevant="additions"></div>
      <form class="saisie" data-saisie autocomplete="off">
        <div class="accents">${["á", "é", "í", "ó", "ú", "ñ", "¿", "¡"].map((a) => `<button type="button" data-a="${a}">${a}</button>`).join("")}</div>
        <div class="saisie-ligne">
          ${micro ? `<button type="button" class="btn btn-micro" data-micro aria-label="Parler en espagnol">${ico("micro")}</button>` : ""}
          <textarea rows="1" maxlength="500" autocapitalize="sentences" spellcheck="false" placeholder="${micro ? "Parle ou écris en español…" : "Escribe en español…"}" aria-label="Ton message"></textarea>
          <button class="btn btn-envoyer" aria-label="Envoyer">${ico("fleche")}</button>
        </div>
      </form>
    </div>`;

  const fil = $(".fil", app);
  const zone = $("textarea", app);

  const bulle = (m) => m.role === "assistant"
    ? `<div class="bulle-ligne"><button class="bulle-ia ${cachee ? "" : "revele"}" data-reveler aria-expanded="${!cachee}">
         <span class="es" lang="es">${e(m.content)}</span>
         ${m.traduccion ? `<span class="fr">${e(m.traduccion)}</span>` : ""}
       </button>${V.bouton(m.content)}</div>`
    : `<div class="bulle-moi"><span lang="es">${e(m.content)}</span>${m.correccion ? `<div class="correction"><p>${e(m.correccion)}</p>${
        m.bonne ? (m.note
          ? `<p class="apunte-fait">${ico("carnet", "ico-inline")} Dans ta libreta</p>`
          : `<button type="button" class="btn-apuntar" data-apuntar="${e(m.id || "")}">${ico("carnet", "ico-inline")} Apuntar</button>`) : ""}</div>` : ""}</div>`;
  const brancher = (racine) => {
    $$("[data-reveler]", racine).forEach((b) => (b.onclick = () => {
      b.setAttribute("aria-expanded", b.classList.toggle("revele"));
    }));
    // Apuntar : la tournure corrigée part dans la libreta et rejoint les révisions.
    $$("[data-apuntar]", racine).forEach((b) => (b.onclick = () => {
      const m = etat().charla?.messages.find((x) => x.id === b.dataset.apuntar);
      if (!m?.bonne) return;
      S.ajouterAuCarnet({ es: m.bonne, fr: m.bonneFr || "", note: `Corrigé avec ${scene.nom} : ${m.correccion}`.slice(0, 280) });
      S.maj(() => (m.note = true));
      b.outerHTML = `<p class="apunte-fait">${ico("carnet", "ico-inline")} Dans ta libreta</p>`;
      toast("Ajoutée à ta libreta. Elle reviendra dans tes révisions.");
    }));
  };
  const visibles = () => etat().charla.messages.filter((m) => m.content !== ouvrir && String(m.content || "").trim());
  // Tout redessiner (ouverture, retrait d'un message) : sans relecture par VoiceOver.
  const afficher = () => {
    const msgs = visibles();
    fil.setAttribute("aria-live", "off");
    fil.innerHTML = msgs.length ? msgs.map(bulle).join("")
      : `<p class="manuscrit fil-vide">Dis bonjour à ${e(scene.nom)}, ou touche « Nueva » pour qu'il commence.</p>`;
    brancher(fil);
    requestAnimationFrame(() => fil.setAttribute("aria-live", "polite"));
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };
  // Ajouter seulement la nouvelle bulle : VoiceOver lit juste ce message.
  const ajouter = (m) => {
    $(".fil-vide", fil)?.remove();
    const tmp = document.createElement("div");
    tmp.innerHTML = bulle(m);
    const el = tmp.firstElementChild;
    fil.appendChild(el);
    brancher(el.parentNode === fil ? el : fil);
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const ecrit = (on) => {
    let t = $(".ecrit", fil);
    if (on && !t) { fil.insertAdjacentHTML("beforeend", `<p class="ecrit">${e(scene.nom)} écrit…</p>`); window.scrollTo({ top: document.body.scrollHeight }); }
    if (!on && t) t.remove();
  };

  async function envoyer(texte) {
    if (enVol) return;
    enVol = true;
    const conv = etat().charla;
    const moi = { role: "user", content: texte, id: Date.now().toString(36) };
    S.maj(() => conv.messages.push(moi));
    if (texte !== ouvrir) ajouter(moi);
    ecrit(true);
    let r;
    try { r = await appeler(conv); } finally { enVol = false; }
    // Elle a quitté ou changé de conversation pendant l'attente : la réponse ne va nulle part ailleurs.
    if (etat().charla !== conv || !document.body.contains(fil)) return;
    ecrit(false);
    if (r.ok) {
      const reponse = { role: "assistant", content: r.respuesta, traduccion: r.traduccion };
      S.maj(() => {
        moi.correccion = r.correccion || "";
        if (r.correccion && r.frase_correcta) { moi.bonne = r.frase_correcta; moi.bonneFr = r.frase_correcta_fr || ""; }
        conv.messages.push(reponse);
      });
      if (moi.correccion) afficher(); else ajouter(reponse);
      if (S.get().reglages.lectureAuto !== false) V.parler(r.respuesta);
    } else {
      // On retire le message non traité pour qu'elle puisse le renvoyer.
      S.maj(() => { const i = conv.messages.lastIndexOf(moi); if (i >= 0) conv.messages.splice(i, 1); });
      if (texte !== ouvrir) zone.value = texte;
      afficher();
    }
  }

  async function appeler(conv) {
    let code = etat().codeIA;
    if (!code && !etat().compte) {
      code = await demanderCode();
      if (!code) return { ok: false };
    }
    try {
      const rep = await fetch("api/conversacion", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(code ? { "X-Code-Acces": code } : {}) },
        body: JSON.stringify({
          scene: conv.scene,
          messages: conv.messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const d = await rep.json().catch(() => ({}));
      if (rep.status === 404) { toast("La conversation marche sur espanol.elibangoura.com"); return { ok: false }; }
      if (d.erreur === "trop_essais") { toast("Trop d'essais de code aujourd'hui. Réessaie demain."); return { ok: false }; }
      if (d.erreur === "code") {
        S.maj((s) => (s.codeIA = null));
        toast("Ce code n'est pas le bon.");
        return { ok: false };
      }
      if (d.erreur) { toast(ERREURS[d.erreur] || "Petit souci. Réessaie dans un instant."); return { ok: false }; }
      // Réponse inattendue (panne, page d'erreur, réseau coupé en route) : on ne l'affiche pas.
      if (!rep.ok || typeof d.respuesta !== "string" || !d.respuesta.trim()) {
        toast("Petit souci de connexion. Réessaie dans un instant.");
        return { ok: false };
      }
      return { ok: true, ...d };
    } catch {
      toast("Pas de réseau pour l'instant. La conversation a besoin d'internet.");
      return { ok: false };
    }
  }

  // Retour : la conversation est gardée, on la retrouve avec « Reprendre ».
  $("[data-retour]", app).onclick = () => { ecoute?.abort?.(); V.arreter(); choix(app, { montrerNav, aller }); };
  $("[data-nouvelle]", app).onclick = async () => {
    if (enVol) return toast("Un instant, la réponse arrive…");
    if (aDejaParle(etat().charla) && !(await confirmer("Nouvelle conversation ?", `La conversation avec ${scene.nom} sera effacée.`, "Recommencer"))) return;
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
  // Parler à voix haute : le téléphone écoute et écrit ce qu'elle dit dans le champ.
  // Elle relit (et corrige si le téléphone a mal compris), puis elle envoie elle-même.
  let ecoute = null;
  $("[data-micro]", app)?.addEventListener("click", () => {
    const bouton = $("[data-micro]", app);
    if (ecoute) { ecoute.stop(); return; }
    if (enVol) return;
    const initial = zone.value.trim();
    let echec = false;
    V.arreter();                         // on coupe la voix de Javi pour ne pas l'entendre en boucle
    ecoute = new Reconnaissance();
    ecoute.lang = "es-ES";
    ecoute.interimResults = true;
    ecoute.continuous = false;
    ecoute.maxAlternatives = 1;
    let final = "";
    bouton.classList.add("en-ecoute");
    zone.placeholder = "Je t'écoute… parle en espagnol";
    ecoute.onresult = (ev) => {
      let provisoire = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += t; else provisoire += t;
      }
      zone.value = [initial, (final + provisoire).trim()].filter(Boolean).join(" ");
    };
    ecoute.onerror = (ev) => {
      echec = true;
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") toast("Autorise le micro pour Mi Español dans les réglages de ton téléphone.");
      else if (ev.error === "no-speech") toast("Je n'ai rien entendu. Réessaie en parlant un peu plus fort.");
      else if (ev.error === "network") toast("La reconnaissance vocale a besoin d'internet.");
    };
    ecoute.onend = () => {
      bouton.classList.remove("en-ecoute");
      zone.placeholder = "Parle ou écris en español…";
      ecoute = null;
      if (echec || !final.trim()) { zone.value = initial; return; }
      zone.value = [initial, final.trim()].filter(Boolean).join(" ");
      $(".btn-envoyer", app).classList.add("a-envoyer");
      toast("Relis, puis touche la flèche pour envoyer.");
    };
    try { ecoute.start(); } catch { bouton.classList.remove("en-ecoute"); ecoute = null; }
  });
  zone.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); $("[data-saisie]", app).requestSubmit(); }
  });
  $("[data-saisie]", app).onsubmit = (ev) => {
    ev.preventDefault();
    const texte = zone.value.trim();
    if (!texte || enVol) return;
    zone.value = "";
    $(".btn-envoyer", app).classList.remove("a-envoyer");
    envoyer(texte);
  };

  afficher();
  if (!enVol && (demarrer || !etat().charla.messages.length)) envoyer(ouvrir);
}

async function demanderCode() {
  let saisi = "";
  const choix = await modale(`
    <h2>Code d'accès</h2>
    <p>La conversation est réservée à toi. Entre le code que l'on t'a donné.</p>
    <input class="code-champ" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Code d'accès">
    <div class="rangee"><button class="btn btn-doux" data-valeur="non">Annuler</button><button class="btn" data-valeur="oui">Valider</button></div>`, {
    apresOuverture: (boite) => {
      const champ = $(".code-champ", boite);
      champ.addEventListener("input", () => (saisi = champ.value.trim()));
      champ.focus();
    },
  });
  if (choix !== "oui" || !saisi) return null;
  S.maj((s) => (s.codeIA = saisi));
  return saisi;
}
