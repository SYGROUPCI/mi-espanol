// Mi Español : écrans et navigation.
import * as S from "./store.js";
import * as C from "./contenu.js";
import * as X from "./exercices.js";
import { ecranCharla } from "./charla.js";
import * as V from "./voix.js";
import * as K from "./compte.js";
import * as N from "./notifs.js";
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
  majNavCompte();
  K.demarrer().then((ok) => {
    majNavCompte();
    if (ok && ["", "#", "#/"].includes(location.hash)) accueil();
  });
  // Barre du bas (kaizen, 3e version) :
  // - elle s'efface dès qu'elle lit en descendant ;
  // - elle ne revient pas pour une petite remontée (relire une ligne), seulement pour une vraie
  //   remontée volontaire, en haut de page ou tout en bas ;
  // - au doigt, l'iPhone envoie beaucoup de petits défilements : on cumule la distance.
  let dernierY = window.scrollY, ancre = dernierY, sens = 0;
  window.addEventListener("scroll", () => {
    const y = Math.max(0, window.scrollY);
    const enBas = window.innerHeight + y >= document.documentElement.scrollHeight - 30;
    const nouveauSens = y > dernierY ? 1 : y < dernierY ? -1 : sens;
    if (nouveauSens !== sens) { sens = nouveauSens; ancre = dernierY; }
    if (y <= 60 || enBas) nav.classList.remove("nav-cachee");
    else if (sens === 1 && y - ancre > 30) nav.classList.add("nav-cachee");
    else if (sens === -1 && ancre - y > 160) nav.classList.remove("nav-cachee");
    dernierY = y;
  }, { passive: true });
  // Clavier ouvert (libreta, réglages, exercices écrits) : la barre se retire pour laisser la place.
  document.addEventListener("focusin", (ev) => {
    if (ev.target.matches("input:not([type=checkbox]):not([type=file]), textarea")) nav.classList.add("nav-clavier");
  });
  document.addEventListener("focusout", () => setTimeout(() => {
    if (!document.activeElement?.matches?.("input, textarea")) nav.classList.remove("nav-clavier");
  }, 50));
  window.addEventListener("hashchange", router);
  router();
  if ("serviceWorker" in navigator) {
    // Mises à jour sans fermer l'appli :
    // - on vérifie s'il y a une nouvelle version au retour dans l'appli et toutes les 5 minutes ;
    // - si oui, écran « Petite mise à jour » une seconde, puis l'appli se recharge au même endroit ;
    // - jamais au milieu d'un exercice, d'une conversation, d'une saisie ou d'une fenêtre ouverte :
    //   on attend qu'elle revienne à un écran calme.
    // Au tout premier lancement, le premier « changement de version » est juste l'installation :
    // on l'ignore. Toutes les mises à jour suivantes, elles, sont appliquées.
    let dejaInstallee = !!navigator.serviceWorker.controller;
    let enAttente = false;
    let enCours = false;
    const occupee = () =>
      /^#\/(defi|apprendre|pratiquer|charla)/.test(location.hash) ||
      !!document.activeElement?.matches?.("input, textarea") ||
      !$("#modale").hidden;
    const appliquer = () => {
      if (enCours) return;
      if (occupee()) { enAttente = true; return; }
      enCours = true;
      const ecran = document.createElement("div");
      ecran.className = "maintenance";
      ecran.setAttribute("role", "status");
      ecran.innerHTML = `<span class="logo">Ñ</span><p class="maintenance-titre">Petite mise à jour…</p><p class="petit">Ta progression est bien gardée.</p>`;
      document.body.appendChild(ecran);
      setTimeout(() => location.reload(), 1100);
    };
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!dejaInstallee) { dejaInstallee = true; return; }
      appliquer();
    });
    window.addEventListener("hashchange", () => {
      if (enAttente) setTimeout(() => { if (!occupee()) { enAttente = false; appliquer(); } }, 300);
    });
    navigator.serviceWorker.register("sw.js").then((reg) => {
      const verifier = () => reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") verifier();
      });
      setInterval(verifier, 5 * 60 * 1000);
    }).catch(() => {});
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
    compte: ecranCompte,
    carnet: carnet,
    surprises: surprises,
    reglages: reglages,
    prononciation: guidePrononciation,
  };
  const rendre = () => {
    nav.classList.remove("nav-cachee", "nav-clavier");
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
// Niveaux : l'A2 s'ouvre avec 6 tampons A1.
const SEUIL_A2 = 6;
const niveauDe = (s) => s.niveau || "A1";
const sellosA1 = () => C.toutes().filter((s) => niveauDe(s) === "A1" && vues(s).length === s.phrases.length).length;
const ouverte = (s) => niveauDe(s) === "A1" || sellosA1() >= SEUIL_A2;
const nbSituationsFaites = () => C.toutes().filter((s) => vues(s).length === s.phrases.length).length;
const idsConnus = () => {
  const etat = S.get();
  return Object.keys(etat.cartes).filter((id) => C.phrase(id, etat.carnet));
};
const dues = () => melanger(idsConnus().filter((id) => S.estDue(id)));

function prochainesNouvelles(n, sitId = null) {
  const sits = sitId ? [C.situation(sitId)] : C.toutes().filter(ouverte);
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
  finde: "Mi finde", planes: "Planes", opiniones: "Opiniones", quejas: "Quejas", viaje: "De viaje", cocina: "Cocina",
  mipais: "Mi país", emociones: "Emociones", bienestar: "Bienestar", paquetes: "Paquetes", reuniones: "Reuniones", fiesta: "Fiesta",
};
const nomCourt = (s) => COURT[s.id] || s.titre_es;
const ROTATIONS = [-8, 5, -3, 7, -6, 4, -2, 6, -7, 3, -4, 8];

// Un tampon de la credencial : pointillé tant que la situation est en cours, encré quand elle est finie.
function sello(s, k, ferme = false) {
  if (ferme) {
    return `
    <div class="sello sello-ferme" aria-label="${e(s.titre)} : niveau A2, pas encore ouvert">
      <svg class="sello-svg" viewBox="0 0 100 100" aria-hidden="true"><circle class="sello-piste" cx="50" cy="50" r="46" /></svg>
      <span class="sello-txt"><strong>${e(nomCourt(s))}</strong><span>${ico("cadenas", "ico-inline")}</span></span>
    </div>`;
  }
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

      ${!K.connecte() && K.faceIdDisponible() && !etat.compteReporte ? `
      <div class="encart encart-compte">
        <p>Mets ta credencial à l'abri : avec Face ID, ta progression est sauvegardée et tu la retrouves sur tous tes appareils.</p>
        <div class="rangee"><a class="btn btn-petit" href="#/compte">Activer Face ID</a><button class="btn btn-doux btn-petit" data-plus-tard>Plus tard</button></div>
      </div>` : ""}
      ${K.connecte() ? `<div class="duo-carte" data-duo hidden></div>` : ""}

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
        ${["A1", "A2"].map((niv) => {
          const liste = C.toutes().filter((x) => niveauDe(x) === niv);
          if (!liste.length) return "";
          const ferme = niv === "A2" && sellosA1() < SEUIL_A2;
          return `
          <div class="niveau-tete"><h3>Nivel ${niv}</h3>${ferme ? `<span class="petit">${ico("cadenas", "ico-inline")} S'ouvre avec ${SEUIL_A2} tampons A1 (${sellosA1()}/${SEUIL_A2})</span>` : ""}</div>
          <div class="sellos ${ferme ? "sellos-fermes" : ""}">
            ${liste.map((x) => sello(x, C.toutes().indexOf(x), ferme)).join("")}
          </div>`;
        }).join("")}
      </section>
    </div>`;

  $$("[data-rot]", app).forEach((el) => el.style.setProperty("--rot", el.dataset.rot + "deg"));
  $("[data-defi]", app)?.addEventListener("click", () => aller("#/defi"));
  $("[data-plus-tard]", app)?.addEventListener("click", () => {
    S.maj((s) => (s.compteReporte = true));
    accueil();
  });
  afficherDuo();
  if (!K.compte() || K.compte().role === "eli") verifierSurprises();
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
      ${K.faceIdDisponible() ? `<a class="btn btn-doux btn-large" href="#/compte">J'ai déjà un compte (Face ID)</a>` : ""}
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
  if (!ouverte(s)) {
    toast(`Le niveau A2 s'ouvre avec ${SEUIL_A2} tampons A1. Encore ${SEUIL_A2 - sellosA1()} à gagner.`);
    history.replaceState(null, "", "#/");
    return accueil();
  }
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
      <h2>Mon compte</h2>
      ${K.connecte()
        ? `<p>Connectée en tant que <strong>${e(K.compte().prenom)}</strong>, avec Face ID. Ta progression est sauvegardée en ligne.</p>
           <button class="btn btn-doux" data-deconnexion>Me déconnecter de cet appareil</button>`
        : `<p class="petit">Sans compte, ta progression reste seulement sur cet appareil.</p>
           <a class="btn" href="#/compte">Activer Face ID</a>`}
    </section>
    <section class="bloc">
      <h2>Rappel quotidien</h2>
      ${!K.connecte()
        ? `<p class="petit">${N.MESSAGES.non_connecte}</p>`
        : N.obstacle() && !etat.reglages.rappel?.actif
          ? `<p class="petit">${N.MESSAGES[N.obstacle()]}</p>`
          : `<label class="bascule"><input type="checkbox" data-rappel ${etat.reglages.rappel?.actif ? "checked" : ""}><span>Me rappeler mon étape chaque jour</span></label>
             <label class="champ">À quelle heure ?<input type="time" data-rappel-heure value="${e(etat.reglages.rappel?.heure || "19:00")}"></label>
             <button class="btn btn-doux" data-rappel-essai ${etat.reglages.rappel?.actif ? "" : "hidden"}>M'envoyer un essai</button>
             <p class="petit">Pas de rappel les jours où tu as déjà fait ton étape.</p>`}
      <p class="petit centre" data-rappel-message aria-live="polite"></p>
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
  const msgRappel = $("[data-rappel-message]", app);
  $("[data-rappel]", app)?.addEventListener("change", async (ev) => {
    const caseRappel = ev.currentTarget;
    msgRappel.textContent = "";
    if (caseRappel.checked) {
      const r = await N.activer($("[data-rappel-heure]", app).value || "19:00");
      if (!r.ok) { caseRappel.checked = false; msgRappel.textContent = N.MESSAGES[r.erreur] || N.MESSAGES.serveur; return; }
      toast("Rappel activé");
    } else {
      await N.desactiver();
      toast("Rappel désactivé");
    }
    $("[data-rappel-essai]", app).hidden = !caseRappel.checked;
  });
  $("[data-rappel-heure]", app)?.addEventListener("change", async (ev) => {
    const r = await N.changerHeure(ev.currentTarget.value || "19:00");
    msgRappel.textContent = r.ok ? "" : (N.MESSAGES[r.erreur] || N.MESSAGES.serveur);
    if (r.ok && S.get().reglages.rappel?.actif) toast(`Rappel à ${ev.currentTarget.value}`);
  });
  $("[data-rappel-essai]", app)?.addEventListener("click", async () => {
    const r = await N.essai();
    msgRappel.textContent = r.ok ? "Envoyé. Il arrive dans quelques secondes." : (N.MESSAGES[r.erreur] || N.MESSAGES.serveur);
  });
  $("[data-deconnexion]", app)?.addEventListener("click", async () => {
    if (await confirmer("Te déconnecter ?", "Ta progression reste sauvegardée en ligne. Cet appareil repartira de zéro jusqu'à ta prochaine connexion avec Face ID.", "Me déconnecter")) {
      await K.seDeconnecter();
      majNavCompte();
      aller("#/");
    }
  });
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

// ---------------------------------------------------------------------------
// Compte : Face ID
function majNavCompte() {
  const lien = $('a[data-onglet="surprises"]', nav);
  if (lien) lien.hidden = K.compte()?.role === "duo";
}

function ecranCompte() {
  montrerNav("reglages");
  if (K.connecte()) return aller("#/reglages");
  app.innerHTML = `
    <header class="page-haut">
      <a class="btn-ico" href="#/" aria-label="Retour">${ico("retour")}</a>
      <div><h1>Tu credencial</h1><p class="page-sous">Ton compte avec Face ID</p></div>
    </header>
    <p class="intro">Pas de mot de passe : c'est ton visage qui ouvre ta credencial. Ta progression est sauvegardée en ligne et tu la retrouves sur tous tes appareils.</p>
    ${K.faceIdDisponible() ? `
    <section class="bloc">
      <h2>J'ai déjà mon compte</h2>
      <button class="btn btn-large" data-connexion>${ico("visage")} Me connecter avec Face ID</button>
    </section>
    <section class="bloc">
      <h2>Je crée mon compte</h2>
      <p class="petit">Avec le code d'invitation qu'on t'a donné. Il ne sert qu'une seule fois.</p>
      <form class="pile" data-inscription autocomplete="off">
        <input name="code" required autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX" aria-label="Code d'invitation">
        <button class="btn btn-large">${ico("visage")} Créer avec Face ID</button>
      </form>
    </section>
    <p class="petit centre" data-message aria-live="polite"></p>`
    : `<p class="encart">Cet appareil ne permet pas Face ID. Ouvre l'appli sur ton iPhone, dans Safari ou depuis l'écran d'accueil.</p>`}`;

  const message = $("[data-message]", app);
  const occupe = (b, on) => { if (b) { b.disabled = on; b.classList.toggle("en-cours", on); } };
  const resultat = (r) => {
    if (r.ok) {
      toast(`Bienvenida, ${r.utilisateur.prenom}`);
      majNavCompte();
      return aller("#/");
    }
    message.textContent = K.MESSAGES[r.erreur] || "Ça n'a pas marché. Réessaie dans un instant.";
  };
  $("[data-connexion]", app)?.addEventListener("click", async (ev) => {
    occupe(ev.currentTarget, true);
    message.textContent = "";
    try { resultat(await K.seConnecter()); } finally { occupe(ev.currentTarget, false); }
  });
  $("[data-inscription]", app)?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const bouton = $("button", ev.currentTarget);
    const code = new FormData(ev.currentTarget).get("code");
    occupe(bouton, true);
    message.textContent = "";
    try { resultat(await K.creerCompte(code)); } finally { occupe(bouton, false); }
  });
}

// Carte duo : où en est l'autre.
async function afficherDuo() {
  const place = $("[data-duo]", app);
  if (!place) return;
  const d = await K.duo();
  if (!d || !document.body.contains(place)) return;
  const jours = S.serieActuelleDe ? S.serieActuelleDe(d.serie) : d.serie.jours;
  place.innerHTML = `
    <p class="duo-sur">Tu duo</p>
    <div class="duo-ligne">
      <strong>${e(d.prenom)}</strong>
      <span><b>${jours}</b> ${jours > 1 ? "días" : "día"} de camino</span>
      <span><b>${d.sellos}</b> ${d.sellos > 1 ? "sellos" : "sello"}</span>
      <span><b>${d.acquises}</b> frases</span>
    </div>`;
  place.hidden = false;
}

demarrer();
