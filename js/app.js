// Mi Español : écrans et navigation.
import * as S from "./store.js";
import * as C from "./contenu.js";
import * as X from "./exercices.js";
import { $, $$, e, ico, remplirIcones, toast, modale, confirmer, melanger, auHasard } from "./ui.js";

const app = $("#app");
const nav = $("#nav");

const PETITES_PHRASES = [
  "Un petit peu chaque jour, et Logroño n'aura plus de secrets pour toi.",
  "Aujourd'hui, on parle comme une vraie riojana.",
  "Pas besoin d'être parfaite, juste d'être là.",
  "Vale, vale… on s'y met ?",
  "Chaque phrase apprise, c'est une conversation de plus.",
  "Les tapas de la calle Laurel n'attendent que toi.",
  "Doucement mais sûrement. Poco a poco.",
];

// ---------------------------------------------------------------------------
// Démarrage
async function demarrer() {
  try {
    await C.charger();
  } catch (err) {
    app.innerHTML = `<div class="vide"><h1>Oups</h1><p>Je n'arrive pas à charger les leçons. Vérifie ta connexion et rouvre l'appli.</p></div>`;
    return;
  }
  if (!S.get().prenom) S.maj((s) => (s.prenom = C.prenomParDefaut() || "toi"));
  remplirIcones(nav);
  window.addEventListener("hashchange", router);
  router();
  if ("serviceWorker" in navigator) {
    // Quand une nouvelle version est mise en ligne, on recharge une fois pour l'afficher tout de suite.
    const avaitUneVersion = !!navigator.serviceWorker.controller;
    let recharge = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!avaitUneVersion || recharge || location.hash.startsWith("#/defi")) return;
      recharge = true;
      location.reload();
    });
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  navigator.storage?.persist?.().catch(() => {});
}

// ---------------------------------------------------------------------------
// Navigation par l'adresse (#/...)
function router() {
  const [route, arg] = location.hash.replace(/^#\/?/, "").split("/");
  const ecrans = {
    "": accueil,
    situation: () => ecranSituation(arg),
    apprendre: () => apprendre(arg),
    pratiquer: () => pratiquer(arg),
    defi: defi,
    carnet: carnet,
    surprises: surprises,
    reglages: reglages,
    prononciation: guidePrononciation,
  };
  const rendre = () => {
    (ecrans[route] || accueil)();
    window.scrollTo(0, 0);
  };
  // Transition douce entre deux écrans quand le navigateur sait le faire (Safari 18+, Chrome).
  const doux = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (doux && document.startViewTransition && !app.querySelector(".chargement")) document.startViewTransition(rendre);
  else rendre();
}

function montrerNav(onglet) {
  nav.hidden = !onglet;
  $$("a", nav).forEach((a) => a.classList.toggle("actif", a.dataset.onglet === onglet));
}

const aller = (h) => { location.hash = h; };

// ---------------------------------------------------------------------------
// Petits calculs de progression
const idsSituation = (s) => s.phrases.map((p) => p.id);
const vues = (s) => idsSituation(s).filter((id) => S.carte(id));
const nbSituationsFaites = () => C.toutes().filter((s) => vues(s).length === s.phrases.length).length;
const idsConnus = () => {
  const etat = S.get();
  return Object.keys(etat.cartes).filter((id) => C.phrase(id, etat.carnet));
};
const dues = () => melanger(idsConnus().filter((id) => S.estDue(id)));

function prochainesNouvelles(n, sitId = null) {
  const sits = sitId ? [C.situation(sitId)] : C.toutes();
  const res = [];
  for (const s of sits) {
    for (const id of idsSituation(s)) {
      if (!S.carte(id)) res.push(id);
      if (res.length === n) return res;
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// Petits mots (surprises)
function motDebloque(m) {
  const etat = S.get();
  const q = m.quand || {};
  switch (q.type) {
    case "premier_lancement": return true;
    case "defis": return etat.defisFaits >= q.n;
    case "serie": return etat.serie.record >= q.jours;
    case "situations": return nbSituationsFaites() >= q.n;
    case "acquises": return S.nbAcquises() >= q.n;
    default: return false;
  }
}

async function ouvrirMot(m) {
  S.maj((s) => { if (!s.motsVus.includes(m.id)) s.motsVus.push(m.id); });
  await modale(`
    <div class="lettre">
      <span class="lettre-ico">${ico("coeur")}</span>
      <p class="lettre-sur">Un petit mot pour toi</p>
      <p class="lettre-texte">${e(m.texte).replace(/\n/g, "<br>")}</p>
      <button class="btn" data-fermer>Fermer</button>
    </div>`, { classe: "modale-lettre" });
}

async function verifierSurprises() {
  const nouveaux = C.petitsMots().filter((m) => motDebloque(m) && !S.get().motsVus.includes(m.id));
  for (const m of nouveaux) await ouvrirMot(m);
}

// ---------------------------------------------------------------------------
// Accueil
function accueil() {
  const etat = S.get();
  if (!etat.bienvenueVue) return bienvenue();
  montrerNav("accueil");
  const serie = S.serieActuelle();
  const d = defiDuJour();
  const faits = d.morceaux.filter((m) => m.fini).length;
  const enCours = d.morceaux.findIndex((m) => !m.fini);
  const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installee = navigator.standalone || matchMedia("(display-mode: standalone)").matches;

  const pct = Math.round((faits / 3) * 100);
  const minutesRestantes = d.morceaux.reduce((t, m, k) => t + (m.fini ? 0 : [4, 5, 8][k]), 0);

  app.innerHTML = `
    <div class="accueil">
      <header class="accueil-haut">
        <div>
          <p class="surtitre">${e(jourEnLettres())}</p>
          <h1>Hola,<br><span class="accent">${e(etat.prenom)}.</span></h1>
          <p class="sous-titre">${e(auHasard(PETITES_PHRASES))}</p>
        </div>
        <div class="serie ${S.serieFaiteAujourdhui() ? "serie-ok" : ""}" title="Jours d'affilée">
          ${ico("flamme")}<strong>${serie}</strong><span>jour${serie > 1 ? "s" : ""}</span>
        </div>
      </header>

      ${estIOS && !installee ? `
      <div class="encart">
        <p><strong>Installe-moi sur ton écran d'accueil.</strong> Dans Safari, touche ${ico("partager", "ico-inline")} Partager, puis « Sur l'écran d'accueil ». Je marcherai même sans réseau.</p>
      </div>` : ""}

      <div class="accueil-grille">
        <section class="defi-carte carte-surface">
          <div class="defi-tete">
            <div class="anneau" data-p="${pct}"><span>${faits}/3</span></div>
            <div>
              <h2>Défi du jour</h2>
              <p class="petit">${enCours === -1 ? "Terminé, bravo" : `Encore ${minutesRestantes} min environ`}</p>
            </div>
          </div>
          <ol class="morceaux">
            ${d.morceaux.map((m, k) => `
              <li class="${m.fini ? "fini" : k === enCours ? "actuel" : ""}">
                <span class="puce">${m.fini ? ico("coche") : k + 1}</span>
                <span><strong>${e(m.titre)}</strong><br><span class="petit">${e(m.sousTitre)}</span></span>
              </li>`).join("")}
          </ol>
          ${enCours === -1
            ? `<p class="defi-fini">${ico("etoile")} ¡Enhorabuena! Rendez-vous demain.</p>`
            : `<button class="btn btn-large" data-defi>${faits ? "Reprendre" : "Commencer"}</button>
               <p class="petit centre">Un seul morceau suffit pour garder ta série.</p>`}
        </section>

        <div class="chiffres">
          <div><span class="petit">Phrases maîtrisées</span><strong>${S.nbAcquises()}</strong></div>
          <div><span class="petit">Meilleure série</span><strong>${etat.serie.record}</strong></div>
          <div><span class="petit">Défis complets</span><strong>${etat.defisFaits}</strong></div>
        </div>
      </div>

      <h2 class="titre-section">Tes situations <span class="petit">${C.toutes().length} disponibles</span></h2>
      <div class="situations">
        ${C.toutes().map((s) => {
          const v = vues(s).length, n = s.phrases.length;
          const acq = idsSituation(s).filter(S.estAcquise).length;
          return `
          <a class="situation" href="#/situation/${e(s.id)}">
            <span class="situation-num">${String(s.ordre).padStart(2, "0")}</span>
            <span class="situation-txt">
              <strong>${e(s.titre)}</strong>
              <span class="es">${e(s.titre_es)}</span>
              <span class="jauge"><span data-largeur="${Math.round((v / n) * 100)}"></span></span>
              <span class="petit">${v === 0 ? "À découvrir" : `${v}/${n} vues · ${acq} maîtrisée${acq > 1 ? "s" : ""}`}</span>
            </span>
          </a>`;
        }).join("")}
        ${C.bientot().map((b) => `
          <div class="situation bientot" aria-disabled="true">
            <span class="situation-num">${ico("cadenas")}</span>
            <span class="situation-txt"><strong>${e(b.titre)}</strong><span class="es">${e(b.titre_es)}</span><span class="petit">Bientôt</span></span>
          </div>`).join("")}
      </div>
    </div>`;

  // Largeurs et anneaux appliqués en JS (pas de style en ligne : la politique de sécurité l'interdit)
  $$("[data-largeur]", app).forEach((el) => (el.style.width = el.dataset.largeur + "%"));
  $$("[data-p]", app).forEach((el) => el.style.setProperty("--p", el.dataset.p));
  $("[data-defi]", app)?.addEventListener("click", () => aller("#/defi"));
  verifierSurprises();
}

function jourEnLettres() {
  const s = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function bienvenue() {
  montrerNav(null);
  const etat = S.get();
  app.innerHTML = `
    <div class="bienvenue">
      <span class="logo">Ñ</span>
      <h1>¡Hola,<br><span class="accent">${e(etat.prenom)}!</span></h1>
      <p>Cette appli a été faite pour toi, et pour personne d'autre.</p>
      <p>Chaque jour, un petit défi : des phrases qu'on entend vraiment à Logroño, des petits jeux, et des surprises cachées en chemin.</p>
      <p>Pas besoin d'être parfaite. Il suffit d'être là, un peu chaque jour.</p>
      <button class="btn btn-large" data-go>Empezamos</button>
    </div>`;
  $("[data-go]", app).onclick = () => {
    S.maj((s) => (s.bienvenueVue = true));
    accueil();
  };
}

// ---------------------------------------------------------------------------
// Défi du jour : trois morceaux qu'on peut faire à différents moments.
function defiDuJour() {
  const etat = S.get();
  if (etat.defi && etat.defi.date === S.aujourdhui()) return etat.defi;

  const aReviser = dues().slice(0, 15);
  const nouvelles1 = aReviser.length >= 3 ? [] : prochainesNouvelles(5);
  const deja = new Set(nouvelles1);
  const nouvelles2 = prochainesNouvelles(10).filter((id) => !deja.has(id)).slice(0, 5);
  const connus = idsConnus();

  const m1 = aReviser.length >= 3
    ? { titre: "Réveil", sousTitre: `${aReviser.length} phrases à réviser · 4 min`, items: aReviser.map((id) => ({ type: "carte", id })) }
    : { titre: "Réveil", sousTitre: "Tes premières phrases du jour · 3 min", items: nouvelles1.map((id) => ({ type: "carte", id, nouveau: true })) };

  const m2items = nouvelles2.map((id) => ({ type: "carte", id, nouveau: true }));
  if (nouvelles2.length >= 4) m2items.push({ type: "relier", ids: nouvelles2 });
  nouvelles2.slice(0, 3).forEach((id) => m2items.push({ type: "qcm", id, sens: "es-fr" }));
  const m2 = nouvelles2.length
    ? { titre: "Nouveautés", sousTitre: `${nouvelles2.length} nouvelles phrases · 5 min`, items: m2items }
    : { titre: "Nouveautés", sousTitre: "Tu as tout vu ! On consolide · 5 min", items: X.exercicesSur(melanger(connus).slice(0, 12), 8) };

  // Le 3e morceau se construit au moment où on l'ouvre, avec tout ce qui a été vu.
  const m3 = { titre: "Entraînement", sousTitre: "Quiz, écrire, oreille rapide · 8 min", items: null };

  const morceaux = [m1, m2, m3].map((m) => ({ ...m, pos: 0, fini: false }));
  // Premier jour sans rien à réviser : si le 1er morceau est vide, on le passe.
  if (!morceaux[0].items.length) morceaux[0].fini = true;

  S.maj((s) => (s.defi = { date: S.aujourdhui(), morceaux, complet: false }));
  return S.get().defi;
}

function defi() {
  const d = defiDuJour();
  const k = d.morceaux.findIndex((m) => !m.fini);
  if (k === -1) return aller("#/");
  const m = d.morceaux[k];
  if (!m.items) {
    const pool = melanger(idsConnus());
    S.maj(() => (m.items = X.exercicesSur(pool.slice(0, 20), 10)));
  }
  if (!m.items.length) {
    S.maj(() => (m.fini = true));
    return defi();
  }
  montrerNav(null);
  X.seance(app, m.items, {
    titre: m.titre,
    depart: m.pos,
    onAvance: (i) => S.maj(() => (m.pos = i)),
    onQuitter: () => aller("#/"),
    onFin: (stats) => finMorceau(d, k, stats),
  });
}

async function finMorceau(d, k, stats) {
  let serieMontee = false;
  S.maj(() => (d.morceaux[k].fini = true));
  serieMontee = S.compterJour();
  const tousFinis = d.morceaux.every((m) => m.fini);
  if (tousFinis && !d.complet) S.maj((s) => { d.complet = true; s.defisFaits++; });
  const restant = d.morceaux.filter((m) => !m.fini).length;
  const serie = S.serieActuelle();
  const total = stats.ok + stats.ko;

  app.innerHTML = `
    <div class="fin">
      <span class="fin-ico">${ico(tousFinis ? "etoile" : "coche")}</span>
      <h1>${tousFinis ? "¡Lo has conseguido!" : "¡Bien hecho!"}</h1>
      <p>${tousFinis
        ? "Défi du jour terminé en entier. Tu peux être fière de toi."
        : `Morceau terminé. Il en reste ${restant}, quand tu veux : dans le bus, à la pause ou ce soir.`}</p>
      ${total ? `<p class="fin-score">${stats.ok} bonne${stats.ok > 1 ? "s" : ""} réponse${stats.ok > 1 ? "s" : ""} sur ${total}</p>` : ""}
      ${serieMontee ? `<p class="fin-serie">${ico("flamme")} Série : ${serie} jour${serie > 1 ? "s" : ""}</p>` : ""}
      <div class="pile">
        ${restant ? `<button class="btn btn-large" data-suite>Morceau suivant</button>` : ""}
        <button class="btn ${restant ? "btn-doux" : "btn-large"}" data-accueil>Retour à l'accueil</button>
      </div>
    </div>`;
  $("[data-suite]", app)?.addEventListener("click", defi);
  $("[data-accueil]", app).onclick = () => aller("#/");
  await verifierSurprises();
}

// ---------------------------------------------------------------------------
// Une situation
function ecranSituation(id, onglet = "phrases") {
  const s = C.situation(id);
  if (!s) return aller("#/");
  montrerNav("accueil");
  const v = vues(s).length;
  const cachee = S.get().reglages.traductionCachee;
  const onglets = [["phrases", "Phrases"], ["dialogues", "Dialogues"], ["grammaire", "Grammaire"], ["expressions", "Expressions"]];

  app.innerHTML = `
    <header class="page-haut">
      <a class="btn-ico" href="#/" aria-label="Retour">${ico("retour")}</a>
      <div>
        <p class="petit es">${e(s.titre_es)}</p>
        <h1>${e(s.titre)}</h1>
      </div>
    </header>
    <p class="intro">${e(s.intro)}</p>
    <div class="rangee actions">
      <button class="btn" data-apprendre>${v < s.phrases.length ? "Apprendre" : "Réviser"}</button>
      <button class="btn btn-doux" data-pratiquer ${v < 4 ? "disabled" : ""}>S'entraîner</button>
    </div>
    ${v < 4 ? `<p class="petit centre">L'entraînement s'ouvre après 4 phrases découvertes.</p>` : ""}
    <div class="onglets" role="tablist">
      ${onglets.map(([k, l]) => `<button role="tab" class="${k === onglet ? "actif" : ""}" data-onglet="${k}">${l}</button>`).join("")}
    </div>
    <section class="onglet-contenu">${contenuOnglet(s, onglet, cachee)}</section>`;

  $("[data-apprendre]", app).onclick = () => aller(`#/apprendre/${s.id}`);
  $("[data-pratiquer]", app).onclick = () => aller(`#/pratiquer/${s.id}`);
  $$("[data-onglet]", app).forEach((b) => (b.onclick = () => ecranSituation(id, b.dataset.onglet)));
  $$("[data-reveler]", app).forEach((b) => (b.onclick = () => b.classList.toggle("revele")));
}

function contenuOnglet(s, onglet, cachee) {
  const pron = S.get().reglages.pron;
  const rev = cachee ? "" : "revele";
  if (onglet === "phrases") {
    return `<p class="petit">Touche une phrase pour voir sa traduction.</p><ul class="liste-phrases">
      ${s.phrases.map((p) => {
        const etat = S.estAcquise(p.id) ? "acquise" : S.carte(p.id) ? "vue" : "neuve";
        return `<li><button class="phrase ${rev}" data-reveler>
          <span class="point point-${etat}" title="${etat === "acquise" ? "Maîtrisée" : etat === "vue" ? "Déjà vue" : "Nouvelle"}"></span>
          <span class="phrase-txt">
            <span class="es">${e(p.es)}</span>
            ${pron && p.pron ? `<span class="pron">${e(p.pron)}</span>` : ""}
            <span class="fr">${e(p.fr)}</span>
            ${p.note ? `<span class="note">${e(p.note)}</span>` : ""}
          </span></button></li>`;
      }).join("")}</ul>`;
  }
  if (onglet === "dialogues") {
    return (s.dialogues || []).map((d) => `
      <article class="dialogue">
        <h3>${e(d.titre)}</h3>
        <p class="petit">${e(d.contexte)}</p>
        ${d.lignes.map((l, k) => `
          <button class="bulle ${k % 2 ? "bulle-droite" : ""} ${rev}" data-reveler>
            <span class="qui">${e(l.qui)}</span>
            <span class="es">${e(l.es)}</span>
            <span class="fr">${e(l.fr)}</span>
          </button>`).join("")}
      </article>`).join("") || `<p class="petit">Pas de dialogue ici.</p>`;
  }
  if (onglet === "grammaire") {
    const g = s.grammaire || {};
    return `<article class="fiche">
      <h3>${e(g.titre)}</h3>
      <p>${e(g.explication)}</p>
      ${g.tableau?.length ? `<table class="tableau">${g.tableau.map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join("")}</tr>`).join("")}</table>` : ""}
      ${(g.exemples || []).map((x) => `<p class="exemple"><span class="es">${e(x.es)}</span><br><span class="fr">${e(x.fr)}</span></p>`).join("")}
    </article>`;
  }
  return `<ul class="liste-expressions">${(s.expressions || []).map((x) => `
    <li><span class="es">${e(x.es)}</span><span class="fr">${e(x.fr)}</span>${x.note ? `<span class="note">${e(x.note)}</span>` : ""}</li>`).join("")}</ul>`;
}

function apprendre(id) {
  const s = C.situation(id);
  if (!s) return aller("#/");
  const aRevoir = idsSituation(s).filter((x) => S.estDue(x));
  const nouvelles = prochainesNouvelles(6, id);
  let items = [
    ...melanger(aRevoir).slice(0, 12).map((x) => ({ type: "carte", id: x })),
    ...nouvelles.map((x) => ({ type: "carte", id: x, nouveau: true })),
  ];
  if (nouvelles.length >= 4) items.push({ type: "relier", ids: nouvelles.slice(0, 5) });
  if (!items.length) {
    // Tout est vu et rien n'est dû : on révise quand même quelques cartes.
    items = melanger(idsSituation(s)).slice(0, 10).map((x) => ({ type: "carte", id: x }));
  }
  lancer(items, s.titre, () => aller(`#/situation/${id}`));
}

function pratiquer(id) {
  const s = C.situation(id);
  if (!s) return aller("#/");
  const ids = vues(s);
  if (ids.length < 4) return aller(`#/situation/${id}`);
  lancer(X.exercicesSur(ids, 10), s.titre, () => aller(`#/situation/${id}`));
}

function lancer(items, titre, retour) {
  montrerNav(null);
  X.seance(app, items, {
    titre,
    onQuitter: retour,
    onFin: async (stats) => {
      const total = stats.ok + stats.ko;
      app.innerHTML = `
        <div class="fin">
          <span class="fin-ico">${ico("coche")}</span>
          <h1>¡Hecho!</h1>
          ${total ? `<p class="fin-score">${stats.ok} sur ${total}</p>` : ""}
          <p>Tout est enregistré. Les phrases ratées reviendront bientôt.</p>
          <button class="btn btn-large" data-retour>Continuer</button>
        </div>`;
      $("[data-retour]", app).onclick = retour;
      await verifierSurprises();
    },
  });
}

// ---------------------------------------------------------------------------
// Carnet perso
function carnet() {
  montrerNav("carnet");
  const etat = S.get();
  app.innerHTML = `
    <header class="page-haut"><div><p class="petit es">Mi cuaderno</p><h1>Mon carnet</h1></div></header>
    <p class="intro">Une phrase entendue dans la rue, au travail, à la télé ? Note-la ici : elle rejoindra tes révisions.</p>
    <form class="formulaire" data-ajout autocomplete="off">
      <label>En espagnol<input name="es" required autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="¿Me pones un cortado?"></label>
      <label>En français<input name="fr" required placeholder="Tu me sers un cortado ?"></label>
      <label>Note (facultatif)<input name="note" placeholder="Entendu au bar en bas de chez moi"></label>
      <button class="btn">${ico("plus")} Ajouter</button>
    </form>
    ${etat.carnet.length ? `
      <div class="rangee"><button class="btn btn-doux" data-reviser>Réviser mon carnet (${etat.carnet.length})</button></div>
      <ul class="liste-carnet">
        ${etat.carnet.map((p) => `
          <li>
            <span class="phrase-txt"><span class="es">${e(p.es)}</span><span class="fr">${e(p.fr)}</span>${p.note ? `<span class="note">${e(p.note)}</span>` : ""}</span>
            <button class="btn-ico" data-suppr="${e(p.id)}" aria-label="Supprimer">${ico("poubelle")}</button>
          </li>`).join("")}
      </ul>` : `<p class="petit centre">Ton carnet est encore vide.</p>`}`;

  $("[data-ajout]", app).onsubmit = (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const es = f.get("es").trim(), fr = f.get("fr").trim();
    if (!es || !fr) return;
    S.ajouterAuCarnet({ es, fr, note: f.get("note").trim() });
    toast("Ajoutée à ton carnet");
    carnet();
  };
  $("[data-reviser]", app)?.addEventListener("click", () => {
    const items = melanger(S.get().carnet).slice(0, 20).map((p) => ({ type: "carte", id: p.id }));
    lancer(items, "Mon carnet", () => aller("#/carnet"));
  });
  $$("[data-suppr]", app).forEach((b) => (b.onclick = async () => {
    if (await confirmer("Supprimer cette phrase ?", "Elle sera retirée de ton carnet et de tes révisions.", "Supprimer")) {
      S.retirerDuCarnet(b.dataset.suppr);
      carnet();
    }
  }));
}

// ---------------------------------------------------------------------------
// Surprises
function surprises() {
  montrerNav("surprises");
  const mots = C.petitsMots();
  const etat = S.get();
  app.innerHTML = `
    <header class="page-haut"><div><p class="petit es">Sorpresas</p><h1>Tes surprises</h1></div></header>
    <p class="intro">Des petits mots se cachent dans l'appli. Ils s'ouvrent au fil de tes progrès.</p>
    ${mots.length ? `<div class="enveloppes">
      ${mots.map((m) => {
        const ouvert = motDebloque(m);
        return `<button class="enveloppe ${ouvert ? "ouverte" : ""}" data-mot="${e(m.id)}" ${ouvert ? "" : "disabled"}>
          <span class="enveloppe-ico">${ico(ouvert ? "coeur" : "cadenas")}</span>
          <span>${ouvert ? (etat.motsVus.includes(m.id) ? "À relire" : "Nouveau !") : e(m.indice)}</span>
        </button>`;
      }).join("")}</div>`
      : `<p class="petit centre">Rien pour l'instant… ou peut-être que si, bientôt.</p>`}`;
  $$("[data-mot]", app).forEach((b) => (b.onclick = async () => {
    await ouvrirMot(mots.find((m) => m.id === b.dataset.mot));
    surprises();
  }));
}

// ---------------------------------------------------------------------------
// Réglages
function reglages() {
  montrerNav("reglages");
  const etat = S.get();
  app.innerHTML = `
    <header class="page-haut"><div><p class="petit es">Ajustes</p><h1>Réglages</h1></div></header>
    <section class="bloc">
      <h2>Affichage</h2>
      <div class="segment" role="radiogroup" aria-label="Thème">
        ${[["auto", "auto", "Auto"], ["clair", "soleil", "Clair"], ["sombre", "lune", "Sombre"]].map(([v, i, l]) =>
          `<button role="radio" aria-checked="${(etat.reglages.theme || "auto") === v}" class="${(etat.reglages.theme || "auto") === v ? "actif" : ""}" data-theme-choix="${v}">${ico(i)}${l}</button>`).join("")}
      </div>
      <p class="petit">Auto suit le réglage de ton téléphone : clair le jour, sombre le soir si tu l'as activé.</p>
    </section>
    <section class="bloc">
      <label class="champ">Ton prénom<input data-prenom value="${e(etat.prenom)}" maxlength="30"></label>
      <label class="bascule"><input type="checkbox" data-r="pron" ${etat.reglages.pron ? "checked" : ""}><span>Afficher la prononciation à la française</span></label>
      <label class="bascule"><input type="checkbox" data-r="traductionCachee" ${etat.reglages.traductionCachee ? "checked" : ""}><span>Cacher la traduction (je la découvre en touchant)</span></label>
      <a class="lien" href="#/prononciation">Comment lire la prononciation</a>
    </section>
    <section class="bloc">
      <h2>Sauvegarde</h2>
      <p class="petit">Ta progression est gardée sur ce téléphone. Fais une sauvegarde de temps en temps et garde le fichier dans Fichiers ou envoie-le-toi : tu pourras tout récupérer si besoin.</p>
      <div class="pile">
        <button class="btn" data-exporter>Sauvegarder ma progression</button>
        <label class="btn btn-doux">Restaurer une sauvegarde<input type="file" accept="application/json,.json" data-importer hidden></label>
      </div>
    </section>
    <section class="bloc">
      <button class="btn btn-danger" data-effacer>Tout recommencer à zéro</button>
    </section>
    <p class="petit centre">Mi Español · fait avec amour, phrase par phrase.</p>`;

  $("[data-prenom]", app).onchange = (ev) => {
    const v = ev.target.value.trim();
    if (v) { S.maj((s) => (s.prenom = v)); toast("C'est noté"); }
  };
  $$("[data-r]", app).forEach((c) => (c.onchange = () => S.maj((s) => (s.reglages[c.dataset.r] = c.checked))));
  $$("[data-theme-choix]", app).forEach((b) => (b.onclick = () => {
    const t = b.dataset.themeChoix;
    S.maj((s) => (s.reglages.theme = t));
    const changer = () => {
      window.appliquerTheme?.(t);
      $$("[data-theme-choix]", app).forEach((x) => {
        x.classList.toggle("actif", x === b);
        x.setAttribute("aria-checked", x === b);
      });
    };
    if (document.startViewTransition) document.startViewTransition(changer);
    else changer();
  }));
  $("[data-exporter]", app).onclick = exporter;
  $("[data-importer]", app).onchange = async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      if (f.size > 5_000_000) throw new Error("Ce fichier est trop gros pour être une sauvegarde.");
      S.importer(await f.text());
      window.appliquerTheme?.(S.get().reglages.theme || "auto");
      toast("Progression restaurée");
      aller("#/");
    } catch (err) {
      toast(err.message || "Ce fichier ne marche pas");
    }
  };
  $("[data-effacer]", app).onclick = async () => {
    if (await confirmer("Tout recommencer ?", "Toute ta progression, ta série et ton carnet seront effacés. Fais une sauvegarde avant si tu veux les garder.", "Tout effacer")) {
      S.toutEffacer();
      S.maj((s) => (s.prenom = C.prenomParDefaut()));
      window.appliquerTheme?.("auto");
      aller("#/");
    }
  };
}

async function exporter() {
  const nom = `mi-espanol-sauvegarde-${S.aujourdhui()}.json`;
  const fichier = new File([S.exporter()], nom, { type: "application/json" });
  try {
    if (navigator.canShare?.({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: "Sauvegarde Mi Español" });
      return;
    }
  } catch (err) {
    if (err.name === "AbortError") return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(fichier);
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function guidePrononciation() {
  montrerNav("reglages");
  const regles = [
    ["MAJUSCULES", "la syllabe qu'on appuie", "ké-DA-moss"],
    ["é", "le e espagnol, toujours fermé", "TAR-dé"],
    ["ou", "le u espagnol", "bou-é-noss"],
    ["kh", "le j espagnol, comme un r raclé au fond de la gorge", "mé-KHOR"],
    ["th", "le z et le c doux : la langue entre les dents", "GRA-thyass"],
    ["gn", "le ñ", "ma-GNA-na"],
    ["y", "le ll et le y", "YA-mo"],
    ["tch", "le ch", "MOU-tcho"],
    ["ss", "le s, jamais comme un z", "KÉ-sso"],
    ["r / rr", "r roulé une fois, rr roulé plusieurs fois", "PÉ-rro"],
  ];
  app.innerHTML = `
    <header class="page-haut">
      <a class="btn-ico" href="#/reglages" aria-label="Retour">${ico("retour")}</a>
      <div><p class="petit es">Pronunciación</p><h1>Lire la prononciation</h1></div>
    </header>
    <p class="intro">Sous chaque phrase, la prononciation est écrite « à la française ». Les tirets séparent les syllabes.</p>
    <table class="tableau tableau-pron">
      ${regles.map(([a, b, c]) => `<tr><td><strong>${e(a)}</strong></td><td>${e(b)}<br><span class="pron">${e(c)}</span></td></tr>`).join("")}
    </table>
    <p class="petit">Le h ne se prononce jamais, et le v se dit comme un b.</p>`;
}

demarrer();
