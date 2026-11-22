// Mi Español : écrans et navigation.
import * as S from "./store.js";
import * as C from "./contenu.js";
import * as X from "./exercices.js";
import { ecranCharla } from "./charla.js";
import * as V from "./voix.js";
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
  V.brancher();
  // La barre du bas s'efface quand elle lit en descendant, et revient dès qu'elle remonte.
  // Au doigt, l'iPhone envoie beaucoup de tout petits défilements : on cumule la distance
  // parcourue dans un même sens au lieu de regarder chaque petit pas.
  let dernierY = window.scrollY, ancre = dernierY, sens = 0;
  window.addEventListener("scroll", () => {
    const y = Math.max(0, window.scrollY);
    const enBas = window.innerHeight + y >= document.documentElement.scrollHeight - 40;
    const nouveauSens = y > dernierY ? 1 : y < dernierY ? -1 : sens;
    if (nouveauSens !== sens) { sens = nouveauSens; ancre = dernierY; }
    if (y <= 80 || enBas) nav.classList.remove("nav-cachee");
    else if (sens === 1 && y - ancre > 36) nav.classList.add("nav-cachee");
    else if (sens === -1 && ancre - y > 24) nav.classList.remove("nav-cachee");
    dernierY = y;
  }, { passive: true });
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
    charla: () => ecranCharla(app, { montrerNav, aller }),
    carnet: carnet,
    surprises: surprises,
    reglages: reglages,
    prononciation: guidePrononciation,
  };
  const rendre = () => {
    nav.classList.remove("nav-cachee");
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
      <p class="lettre-sur">Para ti</p>
      <p class="lettre-texte">${e(m.texte).replace(/\n/g, "<br>")}</p>
      <button class="btn" data-fermer>Cerrar</button>
    </div>`, { classe: "modale-lettre" });
}

async function verifierSurprises() {
  const nouveaux = C.petitsMots().filter((m) => motDebloque(m) && !S.get().motsVus.includes(m.id));
  for (const m of nouveaux) await ouvrirMot(m);
}

// ---------------------------------------------------------------------------
// Accueil
const COURT = {
  amis: "Amigos", telephone: "Teléfono", beaute: "Peluquería", culture: "Fiestas",
  bar: "El bar", medecin: "Médico", voisins: "Vecinos", logement: "Mi piso",
  administration: "Trámites", travail: "Trabajo", urgences: "Urgencias", ecole: "El cole",
};
const nomCourt = (s) => COURT[s.id] || s.titre_es;
const ROTATIONS = [-8, 5, -3, 7, -6, 4, -2, 6, -7, 3, -4, 8];

// Un tampon de la credencial : pointillé tant que la situation est en cours, encré quand elle est finie.
function sello(s, k) {
  const v = vues(s).length, n = s.phrases.length;
  const fini = v === n;
  const etat = fini ? "sellado" : v ? "en-curso" : "nuevo";
  return `
    <a class="sello sello-${etat}" href="#/situation/${e(s.id)}" data-rot="${fini ? ROTATIONS[k % ROTATIONS.length] : 0}"
       aria-label="${e(s.titre)} : ${fini ? "terminée" : `${v} phrases vues sur ${n}`}">
      <svg class="sello-svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="sello-piste" cx="50" cy="50" r="46" />
        ${fini
          ? `<circle class="sello-encre" cx="50" cy="50" r="46" /><circle class="sello-encre fin" cx="50" cy="50" r="39" />`
          : `<circle class="sello-progres" cx="50" cy="50" r="46" pathLength="100" stroke-dasharray="${Math.round((v / n) * 100)} 100" transform="rotate(-90 50 50)" />`}
      </svg>
      <span class="sello-txt">
        <strong>${e(nomCourt(s))}</strong>
        <span>${fini ? "Sellado" : v ? `${v} / ${n}` : "Nuevo"}</span>
      </span>
    </a>`;
}

function accueil() {
  const etat = S.get();
  if (!etat.bienvenueVue) return bienvenue();
  montrerNav("accueil");
  const serie = S.serieActuelle();
  const d = defiDuJour();
  const enCours = d.morceaux.findIndex((m) => !m.fini);
  const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installee = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  const minutes = d.morceaux.reduce((t, m, k) => t + (m.fini ? 0 : [4, 5, 8][k]), 0);
  const prochaine = prochainesNouvelles(1)[0];
  const sitDuJour = prochaine ? C.situationDe(prochaine) : null;
  const scelles = C.toutes().filter((s) => vues(s).length === s.phrases.length).length;
  const TRAMOS = ["Repaso", "Novedades", "Práctica"];

  app.innerHTML = `
    <div class="accueil">
      <header class="credencial-haut">
        <div>
          <p class="credencial-sur">Credencial de</p>
          <h1 class="credencial-nom">${e(etat.prenom)}</h1>
          <p class="manuscrit">${e(auHasard(PETITES_PHRASES))}</p>
        </div>
        <div class="camino ${S.serieFaiteAujourdhui() ? "camino-hoy" : ""}">
          <strong>${serie}</strong>
          <span>${serie > 1 ? "días" : "día"} de camino</span>
        </div>
      </header>

      ${estIOS && !installee ? `
      <div class="encart">
        <p>Installe-moi sur ton écran d'accueil : dans Safari, touche ${ico("partager", "ico-inline")} Partager, puis « Sur l'écran d'accueil ». Je marcherai même sans réseau.</p>
      </div>` : ""}

      <div class="accueil-grille">
        <section class="etapa">
          <svg class="etapa-fleche" viewBox="0 0 120 60" aria-hidden="true"><path d="M8 30h78M64 10l24 20-24 20" /></svg>
          <p class="etapa-sur">${enCours === -1 ? "Etapa de hoy, cumplida" : `Etapa de hoy, unos ${minutes} min`}</p>
          <h2 class="etapa-titre">${enCours === -1 ? "¡Hasta mañana!" : e(sitDuJour ? sitDuJour.titre_es : "Repaso general")}</h2>
          <ol class="tramos">
            ${d.morceaux.map((m, k) => `
              <li class="${m.fini ? "fini" : k === enCours ? "actuel" : ""}">
                <span class="tramo-marque">${m.fini ? ico("coche") : ""}</span>
                <span>${TRAMOS[k]}</span>
              </li>`).join("")}
          </ol>
          ${enCours === -1
            ? `<p class="etapa-note">Les trois tramos sont faits. Ta série est sauve.</p>`
            : `<button class="btn btn-etapa" data-defi>${d.morceaux.some((m) => m.fini) ? "Seguir" : "Empezar"}</button>
               <p class="etapa-note">Un seul tramo suffit pour garder ta série.</p>`}
        </section>

        <dl class="chiffres">
          <div><dt>Frases dominadas</dt><dd>${S.nbAcquises()}</dd></div>
          <div><dt>Mejor racha</dt><dd>${etat.serie.record} <small>${etat.serie.record > 1 ? "días" : "día"}</small></dd></div>
          <div><dt>Etapas completas</dt><dd>${etat.defisFaits}</dd></div>
        </dl>
      </div>

      <section>
        <div class="titre-section">
          <h2>Tus sellos</h2>
          <span class="petit">${scelles} sur ${C.toutes().length} tamponnés</span>
        </div>
        <div class="sellos">
          ${C.toutes().map((s, k) => sello(s, k)).join("")}
        </div>
      </section>
    </div>`;

  $$("[data-rot]", app).forEach((el) => el.style.setProperty("--rot", el.dataset.rot + "deg"));
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
      <div class="couverture">
        <svg class="couverture-fleche" viewBox="0 0 120 60" aria-hidden="true"><path d="M8 30h78M64 10l24 20-24 20" /></svg>
        <p class="credencial-sur">Credencial de</p>
        <h1 class="credencial-nom">${e(etat.prenom)}</h1>
        <p class="couverture-lieu">Logroño, La Rioja</p>
      </div>
      <p>Cette appli a été faite pour toi, et pour personne d'autre.</p>
      <p>Chaque jour, une étape : des phrases qu'on entend vraiment à Logroño, des petits jeux, et un tampon à gagner pour chaque situation de ta vie ici.</p>
      <p class="manuscrit">Pas besoin d'être parfaite. Il suffit d'être là, un peu chaque jour.</p>
      <button class="btn btn-large" data-go>Abrir mi credencial</button>
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
    ? { titre: "Repaso", sousTitre: `${aReviser.length} phrases à réviser`, items: aReviser.map((id) => ({ type: "carte", id })) }
    : { titre: "Repaso", sousTitre: "Tes premières phrases du jour", items: nouvelles1.map((id) => ({ type: "carte", id, nouveau: true })) };

  const m2items = nouvelles2.map((id) => ({ type: "carte", id, nouveau: true }));
  if (nouvelles2.length >= 4) m2items.push({ type: "relier", ids: nouvelles2 });
  nouvelles2.slice(0, 3).forEach((id) => m2items.push({ type: "qcm", id, sens: "es-fr" }));
  const m2 = nouvelles2.length
    ? { titre: "Novedades", sousTitre: `${nouvelles2.length} nouvelles phrases`, items: m2items }
    : { titre: "Novedades", sousTitre: "Tu as tout vu, on consolide", items: X.exercicesSur(melanger(connus).slice(0, 12), 8) };

  // Le 3e morceau se construit au moment où on l'ouvre, avec tout ce qui a été vu.
  const m3 = { titre: "Práctica", sousTitre: "Quiz, écrire, oreille rapide", items: null };

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

// Nouveaux tampons gagnés depuis la dernière fois : on les célèbre une seule fois.
async function celebrerSellos() {
  const etat = S.get();
  const deja = new Set(etat.sellos || []);
  const nouveaux = C.toutes().filter((s) => vues(s).length === s.phrases.length && !deja.has(s.id));
  for (const s of nouveaux) {
    S.maj((x) => { x.sellos = [...(x.sellos || []), s.id]; });
    await modale(`
      <div class="nuevo-sello">
        <p class="cartel-sur">Nuevo sello</p>
        <div class="sello sello-sellado sello-geant" aria-hidden="true">
          <svg class="sello-svg" viewBox="0 0 100 100"><circle class="sello-encre" cx="50" cy="50" r="46" /><circle class="sello-encre fin" cx="50" cy="50" r="39" /></svg>
          <span class="sello-txt"><strong>${e(nomCourt(s))}</strong><span>Sellado</span></span>
        </div>
        <p>Tu as découvert toutes les phrases de « ${e(s.titre)} ». Ce tampon est à toi.</p>
        <button class="btn btn-large" data-fermer>¡Olé!</button>
      </div>`, { classe: "modale-sello" });
  }
}

async function finMorceau(d, k, stats) {
  S.maj(() => (d.morceaux[k].fini = true));
  const serieMontee = S.compterJour();
  const tousFinis = d.morceaux.every((m) => m.fini);
  if (tousFinis && !d.complet) S.maj((s) => { d.complet = true; s.defisFaits++; });
  const restant = d.morceaux.filter((m) => !m.fini).length;
  const serie = S.serieActuelle();
  const total = stats.ok + stats.ko;

  app.innerHTML = `
    <div class="cartel ${tousFinis ? "cartel-fete" : ""}">
      <p class="cartel-sur">${tousFinis ? "Etapa de hoy" : `Tramo ${k + 1} de 3`}</p>
      <h1 class="cartel-titre">${tousFinis ? "¡Etapa<br>cumplida!" : "¡Bien<br>hecho!"}</h1>
      <p class="cartel-texte">${tousFinis
        ? "Les trois tramos du jour sont faits. Tu peux être fière de toi."
        : `Il en reste ${restant}, quand tu veux : dans le bus, à la pause ou ce soir.`}</p>
      <div class="cartel-chiffres">
        ${total ? `<div><strong>${stats.ok}/${total}</strong><span>bonnes réponses</span></div>` : ""}
        <div><strong>${serie}</strong><span>${serie > 1 ? "días" : "día"} de camino${serieMontee ? ", un de plus" : ""}</span></div>
      </div>
      <div class="pile">
        ${restant ? `<button class="btn btn-cartel btn-large" data-suite>Tramo siguiente</button>` : ""}
        <button class="btn ${restant ? "btn-cartel-doux" : "btn-cartel btn-large"}" data-accueil>Volver a la credencial</button>
      </div>
    </div>`;
  $("[data-suite]", app)?.addEventListener("click", defi);
  $("[data-accueil]", app).onclick = () => aller("#/");
  await celebrerSellos();
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
        <h1>${e(s.titre_es)}</h1>
        <p class="page-sous">${e(s.titre)}</p>
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
        return `<li class="ligne-voix"><button class="phrase ${rev}" data-reveler>
          <span class="point point-${etat}" title="${etat === "acquise" ? "Maîtrisée" : etat === "vue" ? "Déjà vue" : "Nouvelle"}"></span>
          <span class="phrase-txt">
            <span class="es">${e(p.es)}</span>
            ${pron && p.pron ? `<span class="pron">${e(p.pron)}</span>` : ""}
            <span class="fr">${e(p.fr)}</span>
            ${p.note ? `<span class="note">${e(p.note)}</span>` : ""}
          </span></button>${V.bouton(p.es)}</li>`;
      }).join("")}</ul>`;
  }
  if (onglet === "dialogues") {
    return (s.dialogues || []).map((d) => `
      <article class="dialogue">
        <div class="dialogue-tete"><h3>${e(d.titre)}</h3>${V.bouton(d.lignes.map((l) => l.es).join(" … "), { classe: "btn-voix-large" })}</div>
        <p class="petit">${e(d.contexte)}</p>
        ${d.lignes.map((l, k) => `
          <div class="bulle-ligne ${k % 2 ? "bulle-ligne-droite" : ""}">
            <button class="bulle ${k % 2 ? "bulle-droite" : ""} ${rev}" data-reveler>
              <span class="qui">${e(l.qui)}</span>
              <span class="es">${e(l.es)}</span>
              <span class="fr">${e(l.fr)}</span>
            </button>${V.bouton(l.es)}
          </div>`).join("")}
      </article>`).join("") || `<p class="petit">Pas de dialogue ici.</p>`;
  }
  if (onglet === "grammaire") {
    const g = s.grammaire || {};
    return `<article class="fiche">
      <h3>${e(g.titre)}</h3>
      <p>${e(g.explication)}</p>
      ${g.tableau?.length ? `<table class="tableau">${g.tableau.map((r) => `<tr>${r.map((c) => `<td>${e(c)}</td>`).join("")}</tr>`).join("")}</table>` : ""}
      ${(g.exemples || []).map((x) => `<div class="exemple ligne-voix"><p><span class="es">${e(x.es)}</span><br><span class="fr">${e(x.fr)}</span></p>${V.bouton(x.es)}</div>`).join("")}
    </article>`;
  }
  return `<ul class="liste-expressions">${(s.expressions || []).map((x) => `
    <li class="ligne-voix"><span class="phrase-txt"><span class="es">${e(x.es)}</span><span class="fr">${e(x.fr)}</span>${x.note ? `<span class="note">${e(x.note)}</span>` : ""}</span>${V.bouton(x.es)}</li>`).join("")}</ul>`;
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
        <div class="cartel">
          <p class="cartel-sur">${e(titre)}</p>
          <h1 class="cartel-titre">¡Hecho!</h1>
          <p class="cartel-texte">Tout est enregistré. Les phrases ratées reviendront bientôt.</p>
          ${total ? `<div class="cartel-chiffres"><div><strong>${stats.ok}/${total}</strong><span>bonnes réponses</span></div></div>` : ""}
          <button class="btn btn-cartel btn-large" data-retour>Seguir</button>
        </div>`;
      $("[data-retour]", app).onclick = retour;
      await celebrerSellos();
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
    <header class="page-haut"><div><h1>Mi libreta</h1><p class="page-sous">Mon carnet</p></div></header>
    <p class="intro">Une phrase entendue dans la rue, au travail, à la télé ? Note-la ici : elle rejoindra tes révisions.</p>
    <form class="postit" data-ajout autocomplete="off">
      <label>En espagnol<input name="es" required autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="¿Me pones un cortado?"></label>
      <label>En français<input name="fr" required placeholder="Tu me sers un cortado ?"></label>
      <label>Une note, si tu veux<input name="note" placeholder="Entendu au bar en bas de chez moi"></label>
      <button class="btn">${ico("plus")} Apuntar</button>
    </form>
    ${etat.carnet.length ? `
      <div class="rangee"><button class="btn btn-doux" data-reviser>Repasar mi libreta (${etat.carnet.length})</button></div>
      <ul class="libreta">
        ${etat.carnet.map((p) => `
          <li>
            ${V.bouton(p.es)}<span class="phrase-txt"><span class="manuscrit-es">${e(p.es)}</span><span class="fr">${e(p.fr)}</span>${p.note ? `<span class="note">${e(p.note)}</span>` : ""}</span>
            <button class="btn-ico" data-suppr="${e(p.id)}" aria-label="Supprimer">${ico("poubelle")}</button>
          </li>`).join("")}
      </ul>` : `<div class="libreta libreta-vide"><p class="manuscrit">Ta libreta attend sa première phrase.</p></div>`}`;

  $("[data-ajout]", app).onsubmit = (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const es = f.get("es").trim(), fr = f.get("fr").trim();
    if (!es || !fr) return;
    S.ajouterAuCarnet({ es, fr, note: f.get("note").trim() });
    toast("Apuntada en ta libreta");
    carnet();
  };
  $("[data-reviser]", app)?.addEventListener("click", () => {
    const items = melanger(S.get().carnet).slice(0, 20).map((p) => ({ type: "carte", id: p.id }));
    lancer(items, "Mi libreta", () => aller("#/carnet"));
  });
  $$("[data-suppr]", app).forEach((b) => (b.onclick = async () => {
    if (await confirmer("Supprimer cette phrase ?", "Elle sera retirée de ta libreta et de tes révisions.", "Supprimer")) {
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
    <header class="page-haut"><div><h1>Sorpresas</h1><p class="page-sous">Tes surprises</p></div></header>
    <p class="intro">Des petits mots se cachent dans ta credencial. Ils s'ouvrent au fil de ton camino.</p>
    ${mots.length ? `<div class="enveloppes">
      ${mots.map((m) => {
        const ouvert = motDebloque(m);
        const lu = etat.motsVus.includes(m.id);
        return `<button class="enveloppe ${ouvert ? "ouverte" : ""}" data-mot="${e(m.id)}" ${ouvert ? "" : "disabled"}>
          <span class="cachet" aria-hidden="true">${ouvert ? ico("coeur") : ""}</span>
          <span class="enveloppe-txt">${ouvert ? (lu ? "Relire" : "Ouvre-moi") : e(m.indice)}</span>
        </button>`;
      }).join("")}</div>`
      : `<div class="libreta libreta-vide"><p class="manuscrit">Rien pour l'instant… ou peut-être que si, bientôt.</p></div>`}`;
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
    <header class="page-haut"><div><h1>Ajustes</h1><p class="page-sous">Réglages</p></div></header>
    <section class="bloc">
      <h2>Affichage</h2>
      <div class="segment" role="radiogroup" aria-label="Thème">
        ${[["auto", "auto", "Auto"], ["clair", "soleil", "Clair"], ["sombre", "lune", "Sombre"]].map(([v, i, l]) =>
          `<button role="radio" aria-checked="${(etat.reglages.theme || "auto") === v}" class="${(etat.reglages.theme || "auto") === v ? "actif" : ""}" data-theme-choix="${v}">${ico(i)}${l}</button>`).join("")}
      </div>
      <p class="petit">Auto suit le réglage de ton téléphone : clair le jour, sombre le soir si tu l'as activé.</p>
    </section>
    <section class="bloc">
      <h2>La voix</h2>
      ${V.disponible() ? `
      <div class="segment segment-2" role="radiogroup" aria-label="Vitesse de la voix">
        ${[["lente", "Lente"], ["normale", "Normale"]].map(([v, l]) =>
          `<button role="radio" aria-checked="${(etat.reglages.vitesseVoix || "normale") === v}" class="${(etat.reglages.vitesseVoix || "normale") === v ? "actif" : ""}" data-vitesse-choix="${v}">${l}</button>`).join("")}
      </div>
      <label class="bascule"><input type="checkbox" data-r="lectureAuto" ${etat.reglages.lectureAuto !== false ? "checked" : ""}><span>Lire les phrases automatiquement pendant les exercices</span></label>
      <button class="btn btn-doux" data-voix="¡Hola, ${e(etat.prenom)}! ¿Qué tal? Vamos a aprender español juntas.">${ico("son")} Essayer la voix</button>
      <p class="petit">${V.aUneVoixEspagnole()
        ? `Voix utilisée : ${e(V.nomVoix() || "espagnole")}. `
        : "Aucune voix espagnole n'est installée sur cet appareil. "}Pour une voix plus naturelle sur iPhone : Réglages, Accessibilité, Contenu énoncé, Voix, Espagnol (Espagne), puis télécharge « Mónica (améliorée) ».</p>`
        : `<p class="petit">Ce navigateur ne sait pas lire à voix haute.</p>`}
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
  $$("[data-vitesse-choix]", app).forEach((b) => (b.onclick = () => {
    S.maj((s) => (s.reglages.vitesseVoix = b.dataset.vitesseChoix));
    $$("[data-vitesse-choix]", app).forEach((x) => {
      x.classList.toggle("actif", x === b);
      x.setAttribute("aria-checked", x === b);
    });
    V.parler("Así suena esta velocidad.");
  }));
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
      <div><h1>Pronunciación</h1><p class="page-sous">Lire la prononciation</p></div>
    </header>
    <p class="intro">Sous chaque phrase, la prononciation est écrite « à la française ». Les tirets séparent les syllabes.</p>
    <table class="tableau tableau-pron">
      ${regles.map(([a, b, c]) => `<tr><td><strong>${e(a)}</strong></td><td>${e(b)}<br><span class="pron">${e(c)}</span></td></tr>`).join("")}
    </table>
    <p class="petit">Le h ne se prononce jamais, et le v se dit comme un b.</p>`;
}

demarrer();
