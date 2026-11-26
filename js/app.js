// Mi Español : écrans et navigation.
import * as S from "./store.js";
import * as C from "./contenu.js";
import * as X from "./exercices.js";
import { ecranCharla } from "./charla.js";
import { ecranLegal } from "./legal.js";
import * as V from "./voix.js";
import * as K from "./compte.js";
import * as N from "./notifs.js";
import * as Son from "./son.js";
import * as P from "./profil.js";
import { $, $$, e, ico, remplirIcones, toast, modale, confirmer, melanger, auHasard } from "./ui.js";

const app = $("#app");
const nav = $("#nav");

// Qui utilise l'appli ?
// - Elisabeth et Khalil (propriétaires) : tout est ouvert, contenu d'origine (Logroño, duo, petits mots).
// - Les autres (inscrits du public, ou personne pas encore inscrite) : version publique, essai gratuit.
const estProprio = () => { const c = K.compte(); return !!c && (c.role === "eli" || c.role === "duo" || c.statut === "proprietaire"); };
const estPublic = () => !estProprio();
const accesComplet = () => estProprio() || K.compte()?.statut === "abonne";
// Les situations ouvertes pendant l'essai : se présenter, le médecin, l'administration.
const SITUATIONS_ESSAI = ["amis", "medecin", "administration"];
const genre = () => {
  const c = K.compte();
  if (c?.genre === "m" || c?.role === "duo") return "m";
  if (c?.genre === "f" || c?.role === "eli") return "f";
  return S.get().genre === "m" ? "m" : "f";
};
const villeEspagne = () => (estPublic() ? (K.compte()?.ville || S.get().villeEs || "") : "Logroño");
// Accord au masculin (Khalil, ou un inscrit qui l'a choisi), au féminin sinon.
const masc = () => genre() === "m";
const g = (fem, mas) => (masc() ? mas : fem);

// Le contenu s'accorde à la personne : d'origine pour les propriétaires, version publique pour les autres.
function appliquerProfil() {
  const c = K.compte();
  if (estPublic()) C.profil("membre", S.get().prenom || c?.prenom || "", S.get().profil, { genre: genre(), ville: villeEspagne() });
  else C.profil(c?.role, c?.prenom, S.get().profil, null);
}

const PETITES_PHRASES = () => [
  `Un petit peu chaque jour, et ${villeEspagne() || "l'Espagne"} n'aura plus de secrets pour toi.`,
  ...(estPublic() ? [] : [g("Aujourd'hui, on parle comme une vraie riojana.", "Aujourd'hui, on parle comme un vrai riojano."),
    "Les tapas de la calle Laurel n'attendent que toi."]),
  g("Pas besoin d'être parfaite, juste d'être là.", "Pas besoin d'être parfait, juste d'être là."),
  "Vale, vale… on s'y met ?",
  "Chaque phrase apprise, c'est une conversation de plus.",
  "Doucement mais sûrement. Poco a poco.",
];

// ---------------------------------------------------------------------------
// Démarrage
async function demarrer() {
  try {
    appliquerProfil();
    await C.charger();
    appliquerProfil();
  } catch (err) {
    app.innerHTML = `<div class="vide"><h1>Oups</h1><p>Je n'arrive pas à charger les leçons. Vérifie ta connexion, puis réessaie.</p>
      <button class="btn" data-reessayer>Réessayer</button></div>`;
    $("[data-reessayer]", app).addEventListener("click", () => location.reload());
    return;
  }
  C.definirMots(K.motsEnCache());
  // Le prénom par défaut (« Elisabeth ») n'est plus donné à une personne inconnue : l'accueil le demande.
  if (!S.get().prenom && estProprio()) S.maj((s) => (s.prenom = K.compte().prenom));
  remplirIcones(nav);
  V.brancher();
  majNavCompte();
  K.demarrer().then(async (ok) => {
    // Le statut du compte (essai, abonné) peut avoir changé depuis la dernière ouverture.
    if (await K.rafraichirCompte()) ok = true;
    majNavCompte();
    C.definirMots(await K.chargerMots());
    // On ne redessine l'accueil que s'il est calme (aucune lettre ou fenêtre ouverte).
    if (ok && ["", "#", "#/"].includes(location.hash) && $("#modale").hidden) accueil();
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
      /^#\/(defi|apprendre|pratiquer|charla|compte)/.test(location.hash) ||
      document.body.dataset.seance === "1" ||
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
  const doux = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  // L'écran se décide au moment où il est dessiné (et pas au moment du clic) : si deux changements
  // d'écran se suivent très vite, c'est toujours l'adresse actuelle qui gagne.
  const rendre = () => {
    nav.classList.remove("nav-cachee", "nav-clavier");
    ecranPour(location.hash)();
    window.scrollTo(0, 0);
    // Lecteur d'écran : on annonce le titre du nouvel écran (au lieu de relire toute la page).
    const h = app.querySelector("h1");
    if (h && $("#modale").hidden) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  };
  // Transition douce entre deux écrans quand le navigateur sait le faire (Safari 18+, Chrome).
  if (doux && document.startViewTransition && !app.querySelector(".chargement")) {
    const t = document.startViewTransition(rendre);
    for (const pr of [t.ready, t.finished, t.updateCallbackDone]) pr?.catch(() => {});   // transition sautée : rien de grave
  } else rendre();
}

function ecranPour(hash) {
  const [route, arg] = hash.replace(/^#\/?/, "").split("?")[0].split("/");
  const ecrans = {
    "": accueil,
    situation: () => ecranSituation(arg),
    apprendre: () => apprendre(arg),
    pratiquer: () => pratiquer(arg),
    defi: defi,
    charla: () => ecranCharla(app, { montrerNav, aller, publique: estPublic() }),
    compte: ecranCompte,
    acces: () => ecranAcces(arg),
    legal: () => ecranLegal(app, arg, { montrerNav }),
    retractation: ecranRetractation,
    carnet: carnet,
    surprises: surprises,
    reglages: reglages,
    prononciation: guidePrononciation,
  };
  return ecrans[route] || accueil;
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
// Niveaux : chaque niveau s'ouvre avec 6 tampons du niveau précédent (A1 → A2 → B1).
const SEUIL_A2 = 6;
const NIVEAUX = ["A1", "A2", "B1"];
const niveauDe = (s) => s.niveau || "A1";
const sellosDe = (niv) => C.toutes().filter((s) => niveauDe(s) === niv && vues(s).length === s.phrases.length).length;
const precedent = (niv) => NIVEAUX[NIVEAUX.indexOf(niv) - 1];
const niveauOuvert = (niv) => niv === "A1" || (niveauOuvert(precedent(niv)) && sellosDe(precedent(niv)) >= SEUIL_A2);
const fermeeEssai = (s) => !accesComplet() && !SITUATIONS_ESSAI.includes(s.id);
const ouverte = (s) => niveauOuvert(niveauDe(s)) && !fermeeEssai(s);
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

let surprisesEnCours = false;
async function verifierSurprises() {
  if (surprisesEnCours) return;          // déjà en train d'en montrer : pas deux fois la même lettre
  surprisesEnCours = true;
  try {
    const nouveaux = C.petitsMots().filter((m) => motDebloque(m) && !S.get().motsVus.includes(m.id));
    for (const m of nouveaux) await ouvrirMot(m);
  } finally { surprisesEnCours = false; }
}

// ---------------------------------------------------------------------------
// Accueil
const COURT = {
  amis: "Amigos", telephone: "Teléfono", beaute: "Peluquería", culture: "Fiestas",
  bar: "El bar", medecin: "Médico", voisins: "Vecinos", logement: "Mi piso",
  administration: "Trámites", travail: "Trabajo", urgences: "Urgencias", ecole: "El cole",
  finde: "Mi finde", planes: "Planes", opiniones: "Opiniones", quejas: "Quejas", viaje: "De viaje", cocina: "Cocina",
  mipais: "Mi país", emociones: "Emociones", bienestar: "Bienestar", paquetes: "Paquetes", reuniones: "Reuniones", fiesta: "Fiesta",
  residencia: "Residencia", banco: "El banco", empleo: "Empleo", especialista: "Especialista", recuerdos: "Recuerdos", actualidad: "Actualidad",
  consejos: "Consejos", familia: "Familia", reclamar: "Reclamar", formacion: "Formación", vendimia: "Vendimia", futuro: "Futuro",
};
const nomCourt = (s) => COURT[s.id] || s.titre_es;
const ROTATIONS = [-8, 5, -3, 7, -6, 4, -2, 6, -7, 3, -4, 8];

// Un tampon de la credencial : pointillé tant que la situation est en cours, encré quand elle est finie.
function sello(s, k, ferme = false) {
  if (fermeeEssai(s)) {
    // Essai gratuit : la situation se voit, mais s'ouvre avec l'accès complet.
    return `
    <a class="sello sello-ferme" href="#/acces/lecon" aria-label="${e(s.titre)} : dans l'accès complet">
      <svg class="sello-svg" viewBox="0 0 100 100" aria-hidden="true"><circle class="sello-piste" cx="50" cy="50" r="46" /></svg>
      <span class="sello-txt"><strong>${e(nomCourt(s))}</strong><span>${ico("cadenas", "ico-inline")}</span></span>
    </a>`;
  }
  if (ferme) {
    return `
    <div class="sello sello-ferme" aria-label="${e(s.titre)} : niveau ${niveauDe(s)}, pas encore ouvert">
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
          <p class="manuscrit">${e(auHasard(PETITES_PHRASES()))}</p>
        </div>
        <div class="camino ${S.serieFaiteAujourdhui() ? "camino-hoy" : ""}">
          <strong>${serie}</strong>
          <span>${serie === 1 ? "día" : "días"} de camino</span>
        </div>
      </header>

      ${!K.connecte() && K.faceIdDisponible() && !etat.compteReporte ? `
      <div class="encart encart-compte">
        <p>Crée ton compte gratuit avec Face ID : ta progression est sauvegardée, et tu peux t'entraîner à parler avec Charla.</p>
        <div class="rangee"><a class="btn btn-petit" href="#/compte">Créer mon compte</a><button class="btn btn-doux btn-petit" data-plus-tard>Plus tard</button></div>
      </div>` : ""}
      ${!accesComplet() ? `
      <div class="encart encart-essai">
        <p><strong>Essai gratuit.</strong> ${SITUATIONS_ESSAI.length} situations sont ouvertes : se présenter, le médecin, l'administration. Les ${C.toutes().length - SITUATIONS_ESSAI.length} autres arrivent avec l'accès complet.</p>
        <a class="btn btn-petit" href="#/acces/accueil">Je veux l'accès complet</a>
      </div>` : ""}
      ${K.connecte() && estProprio() ? `<div class="duo-carte" data-duo hidden></div>` : ""}

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
          <div><dt>Mejor racha</dt><dd>${etat.serie.record} <small>${etat.serie.record === 1 ? "día" : "días"}</small></dd></div>
          <div><dt>Etapas completas</dt><dd>${etat.defisFaits}</dd></div>
        </dl>
      </div>

      <section>
        <div class="titre-section">
          <h2>Tus sellos</h2>
          <span class="petit">${scelles} sur ${C.toutes().length} tamponnés</span>
        </div>
        ${NIVEAUX.map((niv) => {
          const liste = C.toutes().filter((x) => niveauDe(x) === niv);
          if (!liste.length) return "";
          // Pendant l'essai, le cadenas de niveau ne s'affiche pas : tout ce qui est fermé mène à l'accès complet.
          const ferme = !niveauOuvert(niv) && accesComplet();
          const prec = precedent(niv);
          const n = prec ? Math.min(sellosDe(prec), SEUIL_A2) : 0;
          return `
          <div class="niveau-tete"><h3>Nivel ${niv}</h3>${ferme ? `<span class="petit">${ico("cadenas", "ico-inline")} S'ouvre avec ${SEUIL_A2} tampons ${prec} (${n}/${SEUIL_A2})</span>` : ""}</div>
          <div class="sellos ${ferme ? "sellos-fermes" : ""}">
            ${liste.map((x) => sello(x, C.toutes().indexOf(x), ferme)).join("")}
          </div>`;
        }).join("")}
      </section>
      ${LIENS_LEGAUX}
    </div>`;

  $$("[data-rot]", app).forEach((el) => el.style.setProperty("--rot", el.dataset.rot + "deg"));
  $("[data-defi]", app)?.addEventListener("click", () => aller("#/defi"));
  $("[data-plus-tard]", app)?.addEventListener("click", () => {
    S.maj((s) => (s.compteReporte = true));
    accueil();
  });
  afficherDuo();
  if (K.compte()?.role === "eli") verifierSurprises();
}

function jourEnLettres() {
  const s = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function bienvenue() {
  montrerNav(null);
  const etat = S.get();
  if (estPublic()) return bienvenuePublique();
  app.innerHTML = `
    <div class="bienvenue">
      <div class="couverture">
        <svg class="couverture-fleche" viewBox="0 0 120 60" aria-hidden="true"><path d="M8 30h78M64 10l24 20-24 20" /></svg>
        <p class="credencial-sur">Credencial de</p>
        <h1 class="credencial-nom">${e(etat.prenom)}</h1>
        <p class="couverture-lieu">Logroño, La Rioja</p>
      </div>
      <p>Chaque jour, une petite étape de cinq minutes. Un tampon pour chaque situation de ta vie ici.</p>
      <button class="btn btn-large" data-go>Empezar mi primera etapa</button>
      ${K.faceIdDisponible() ? `<a class="btn btn-doux btn-large" href="#/compte">J'ai déjà un compte (Face ID)</a>` : ""}
    </div>`;
  // Premier lancement : on entre tout de suite dans la première étape.
  $("[data-go]", app).onclick = () => {
    S.maj((s) => (s.bienvenueVue = true));
    aller("#/defi");
  };
}

// Âge minimum (LOPDGDD art. 7) et acceptation des conditions, sous chaque bouton d'inscription.
const MENTION_ACCEPTATION = `En continuant, tu confirmes avoir 14 ans ou plus et tu acceptes les
  <a class="lien" href="#/legal/conditions">conditions</a> et la <a class="lien" href="#/legal/confidentialite">politique de confidentialité</a>.`;
// Liens légaux en bas de l'accueil et des réglages.
const LIENS_LEGAUX = `<nav class="liens-legaux petit" aria-label="Informations légales">
  <a href="#/legal/mentions">Mentions légales</a> · <a href="#/legal/confidentialite">Confidentialité</a> ·
  <a href="#/legal/conditions">Conditions</a> · <a href="#/legal/charla">Charla et l'IA</a> · <a href="#/legal/es">En español</a></nav>`;

// Premier lancement pour une personne du public : sa credencial à son nom, dans sa ville.
// Trois questions seulement, puis on entre dans la première étape. Le compte (Face ID) vient après.
function bienvenuePublique() {
  const etat = S.get();
  let genreChoisi = etat.genre === "m" ? "m" : etat.genre === "f" ? "f" : null;
  app.innerHTML = `
    <div class="bienvenue">
      <div class="couverture">
        <svg class="couverture-fleche" viewBox="0 0 120 60" aria-hidden="true"><path d="M8 30h78M64 10l24 20-24 20" /></svg>
        <p class="credencial-sur">Credencial de</p>
        <h1 class="credencial-nom" data-apercu-nom>${e(etat.prenom || "…")}</h1>
        <p class="couverture-lieu" data-apercu-ville>${e(etat.villeEs || "España")}</p>
      </div>
      <p>L'espagnol de la vraie vie en Espagne : la mairie, le médecin, le travail, les voisins. Chaque jour, une petite étape de cinq minutes, et un tampon pour chaque situation.</p>
      <form class="pile" data-bienvenue autocomplete="off">
        <label class="champ">Ton prénom<input name="prenom" required maxlength="30" value="${e(etat.prenom || "")}" autocomplete="given-name"></label>
        <label class="champ">Ta ville en Espagne<input name="ville" required maxlength="40" value="${e(etat.villeEs || "")}" placeholder="Ex. : Madrid, Bilbao, Zaragoza"></label>
        <div class="champ"><span id="lbl-genre">On te parle…</span>
          <div class="segment segment-2" role="radiogroup" aria-labelledby="lbl-genre">
            ${[["f", "au féminin"], ["m", "au masculin"]].map(([v, l]) =>
              `<button type="button" role="radio" aria-checked="${genreChoisi === v}" class="${genreChoisi === v ? "actif" : ""}" data-genre="${v}">${l}</button>`).join("")}
          </div>
        </div>
        <label class="champ">Ton pays d'origine (facultatif)
          <select name="pays"><option value="">Choisir…</option>
            ${Object.entries(P.PAYS).map(([k, v]) => `<option value="${k}" ${etat.profil?.pays === k ? "selected" : ""}>${e(v.fr)}</option>`).join("")}
          </select></label>
        <p class="petit centre" data-message aria-live="polite"></p>
        <button class="btn btn-large">Empezar mi primera etapa</button>
        <p class="petit centre">${MENTION_ACCEPTATION}</p>
      </form>
      ${K.faceIdDisponible() ? `<a class="btn btn-doux btn-large" href="#/compte">J'ai déjà un compte (Face ID)</a>` : ""}
      ${LIENS_LEGAUX}
    </div>`;
  const form = $("[data-bienvenue]", app);
  form.prenom.addEventListener("input", () => { $("[data-apercu-nom]", app).textContent = form.prenom.value.trim() || "…"; });
  form.ville.addEventListener("input", () => { $("[data-apercu-ville]", app).textContent = P.nettoyerVille(form.ville.value) || "España"; });
  $$("[data-genre]", app).forEach((b) => (b.onclick = () => {
    genreChoisi = b.dataset.genre;
    $$("[data-genre]", app).forEach((x) => { x.classList.toggle("actif", x === b); x.setAttribute("aria-checked", x === b); });
  }));
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const prenom = form.prenom.value.replace(/[^\p{L}\p{M} '’-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 30);
    const ville = P.nettoyerVille(form.ville.value);
    if (!prenom || !ville || !genreChoisi) {
      $("[data-message]", app).textContent = !genreChoisi ? "Dis-nous comment on te parle : au féminin ou au masculin." : "Il manque ton prénom ou ta ville.";
      return;
    }
    S.maj((s) => {
      s.prenom = prenom;
      s.villeEs = ville;
      s.genre = genreChoisi;
      if (form.pays.value) s.profil = { ...(s.profil || {}), pays: form.pays.value };
      s.bienvenueVue = true;
    });
    appliquerProfil();
    aller("#/defi");
  };
}

// ---------------------------------------------------------------------------
// Rétractation (directive 2023/2673) : une fonction toujours accessible dans Ajustes pendant le délai,
// une étape de confirmation, puis un accusé de réception avec la date et l'heure, à garder.
const dateHeure = (iso) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

function accuseTexte(r) {
  return `Mi Español (elibangoura.com) — Accusé de réception de rétractation\n\n` +
    `Référence : ${r.ref}\nNom : ${r.prenom}\nE-mail : ${r.email}\nDemande reçue le : ${dateHeure(r.recue_le)} (${r.recue_le} UTC)\n\n` +
    `Ta demande de rétractation du contrat d'abonnement à Mi Español a bien été reçue.\n` +
    `Le montant payé te sera remboursé en totalité, par le même moyen de paiement, dans les 14 jours.\n` +
    `Contact : contact@elibangoura.com\n`;
}

function ecranRetractation() {
  montrerNav("reglages");
  const etat = S.get();
  const deja = etat.retractation;
  if (!deja && K.compte()?.statut !== "abonne") return aller("#/reglages");
  const montrerAccuse = (r) => {
    app.innerHTML = `
      <header class="page-haut"><a class="btn-ico" href="#/reglages" aria-label="Retour">${ico("retour")}</a>
        <div><h1>Rétractation reçue</h1><p class="page-sous">Accusé de réception</p></div></header>
      <section class="bloc" role="status">
        <p>Ta demande de rétractation a bien été reçue le <strong>${e(dateHeure(r.recue_le))}</strong>.</p>
        <p>Référence : <strong>${e(r.ref)}</strong></p>
        <p>Le montant payé te sera <strong>remboursé en totalité</strong>, par le même moyen de paiement, dans les 14 jours. Elisabeth te confirmera le remboursement par e-mail, à l'adresse ${e(r.email)}.</p>
        <button class="btn" data-telecharger>Télécharger l'accusé de réception</button>
        <p class="petit">Garde ce fichier : il prouve la date et l'heure de ta demande. Une question ? contact@elibangoura.com</p>
      </section>`;
    $("[data-telecharger]", app).onclick = () => {
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(new Blob([accuseTexte(r)], { type: "text/plain;charset=utf-8" }));
      lien.download = `mi-espanol-retractation-${r.ref}.txt`;
      document.body.appendChild(lien); lien.click(); lien.remove();
      setTimeout(() => URL.revokeObjectURL(lien.href), 2000);
    };
  };
  if (deja) return montrerAccuse(deja);
  app.innerHTML = `
    <header class="page-haut"><a class="btn-ico" href="#/reglages" aria-label="Retour">${ico("retour")}</a>
      <div><h1>Me rétracter du contrat</h1><p class="page-sous">Délai de 14 jours</p></div></header>
    <section class="bloc">
      <p>Tu peux te rétracter de ton abonnement dans les <strong>14 jours</strong> qui suivent ta souscription, sans avoir à te justifier. Le montant payé te sera remboursé en totalité.</p>
      <form class="pile" data-retractation>
        <label class="champ">Ton nom<input name="prenom" required maxlength="30" value="${e(K.compte()?.prenom || etat.prenom || "")}" autocomplete="name"></label>
        <label class="champ">Ton e-mail (pour la confirmation et le remboursement)<input name="email" type="email" required maxlength="120" autocomplete="email" inputmode="email"></label>
        <p class="petit">Contrat concerné : abonnement à Mi Español de ce compte.</p>
        <button class="btn btn-large btn-danger">Confirmer ma rétractation</button>
      </form>
      <p class="petit centre" data-message aria-live="polite"></p>
    </section>`;
  $("[data-retractation]", app).onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const bouton = $("button", f);
    const message = $("[data-message]", app);
    bouton.disabled = true;
    message.textContent = "";
    try {
      const rep = await fetch("api/compte/retractation", { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prenom: f.prenom.value, email: f.email.value }) });
      const d = await rep.json().catch(() => ({}));
      if (!rep.ok || !d.ok) {
        message.textContent = { email: "Cette adresse e-mail ne semble pas valide.", trop_essais: "Trop d'essais aujourd'hui. Écris à contact@elibangoura.com.",
          pas_abonne: "Ce compte n'a pas d'abonnement en cours." }[d.erreur] || "La demande n'est pas passée. Réessaie, ou écris à contact@elibangoura.com.";
        return;
      }
      const r = { ref: d.ref, recue_le: d.recue_le, prenom: f.prenom.value.trim(), email: f.email.value.trim() };
      S.maj((s) => (s.retractation = r));
      montrerAccuse(r);
    } catch {
      message.textContent = "Pas de réseau pour l'instant. Réessaie, ou écris à contact@elibangoura.com.";
    } finally { bouton.disabled = false; }
  };
}

// ---------------------------------------------------------------------------
// Accès complet : on mesure l'intérêt avant d'ouvrir le paiement (e-mail seulement).
function ecranAcces(source = "") {
  montrerNav("accueil");
  if (accesComplet()) return aller("#/");
  app.innerHTML = `
    <header class="page-haut">
      <a class="btn-ico" href="#/" aria-label="Retour">${ico("retour")}</a>
      <div><h1>L'accès complet</h1><p class="page-sous">Bientôt ouvert</p></div>
    </header>
    <section class="bloc">
      <h2>Ce qu'il contient</h2>
      <ul class="liste-simple">
        <li>Les ${C.toutes().length} situations de la vie en Espagne, du niveau A1 au B1 : logement, travail, banque, titre de séjour, école, urgences…</li>
        <li>Charla tous les jours : tu parles avec un serveur, une voisine, un médecin, un recruteur, qui te corrigent avec douceur.</li>
        <li>Ta progression sauvegardée et ton rappel quotidien.</li>
      </ul>
    </section>
    <section class="bloc">
      <h2>Préviens-moi à l'ouverture</h2>
      <p class="petit">Le paiement n'est pas encore ouvert. Laisse ton e-mail : on t'écrit une seule fois, le jour où l'accès complet ouvre.</p>
      <form class="pile" data-interet>
        <label class="champ">Ton e-mail<input name="email" type="email" required maxlength="120" autocomplete="email" inputmode="email" placeholder="ton@email.com"></label>
        <button class="btn btn-large">Je veux l'accès complet</button>
      </form>
      <p class="petit centre" data-message aria-live="polite"></p>
      <p class="petit"><strong>Tes données.</strong> Responsable : Elisabeth Bangoura (elibangoura.com), Espagne.
        Finalité : t'écrire une seule fois, à l'ouverture de l'accès complet (base : ton consentement). Ton e-mail, et ton prénom et ta ville si tu as un compte, sont gardés jusqu'à cet envoi, et 12 mois au plus. Ni vendus ni partagés.
        Tu peux y accéder, le corriger ou le retirer à tout moment (<button class="lien" type="button" data-retrait>retirer mon e-mail</button>), et réclamer auprès de l'AEPD.
        <a class="lien" href="#/legal/confidentialite">Politique de confidentialité</a></p>
    </section>`;
  const message = $("[data-message]", app);
  const envoyer = async (chemin, email) => {
    try {
      const rep = await fetch(chemin, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ email, source }) });
      const d = await rep.json().catch(() => ({}));
      return rep.ok && d.ok ? null : (d.erreur || "serveur");
    } catch { return "reseau"; }
  };
  const ERR = { email: "Cette adresse e-mail ne semble pas valide.", trop_essais: "Trop d'essais aujourd'hui. Réessaie demain.",
    reseau: "Pas de réseau pour l'instant. Réessaie tout à l'heure.", serveur: "Petit souci. Réessaie dans un instant." };
  $("[data-interet]", app).onsubmit = async (ev) => {
    ev.preventDefault();
    const bouton = $("button", ev.currentTarget);
    bouton.disabled = true;
    const err = await envoyer("api/interet", ev.currentTarget.email.value);
    bouton.disabled = false;
    if (err) { message.textContent = ERR[err] || ERR.serveur; return; }
    S.maj((s) => (s.interetEnvoye = true));
    message.textContent = "C'est noté, merci ! On te prévient dès que l'accès complet ouvre.";
    ev.currentTarget.reset();
  };
  $("[data-retrait]", app).onclick = async () => {
    const email = $("[data-interet]", app).email.value;
    if (!email) { message.textContent = "Écris ton e-mail dans le champ, puis touche « retirer mon e-mail »."; return; }
    const err = await envoyer("api/interet/retrait", email);
    message.textContent = err ? (ERR[err] || ERR.serveur) : "C'est fait : ton e-mail est retiré.";
  };
}

// ---------------------------------------------------------------------------
// Défi du jour : trois morceaux qu'on peut faire à différents moments.
function defiDuJour() {
  const etat = S.get();
  if (etat.defi && etat.defi.date === S.aujourdhui()) return etat.defi;
  // Sans leçons chargées, on n'enregistre pas un défi vide pour toute la journée.
  if (!C.toutes().length) return { date: S.aujourdhui(), morceaux: [], complet: false, provisoire: true };

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
  if (d.provisoire) return aller("#/");
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
  // Toujours relire le défi actuel : une synchro peut avoir remplacé l'état pendant la séance.
  const morceauActuel = () => S.get().defi?.date === d.date ? S.get().defi.morceaux[k] : m;
  montrerNav(null);
  X.seance(app, m.items, {
    titre: m.titre,
    etape: `Tramo ${k + 1} de 3`,
    depart: m.pos,
    onAvance: (i) => S.maj(() => (morceauActuel().pos = i)),
    onQuitter: () => aller("#/"),
    onFin: (stats) => finMorceau(S.get().defi?.date === d.date ? S.get().defi : d, k, stats),
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
      </div>`, { classe: "modale-sello", apresOuverture: () => setTimeout(Son.tampon, 330) });
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
        ? `Les trois tramos du jour sont faits. Tu peux être ${g("fière", "fier")} de toi.`
        : `Il en reste ${restant}, quand tu veux : dans le bus, à la pause ou ce soir.`}</p>
      <div class="cartel-chiffres">
        ${total ? `<div><strong>${stats.ok}/${total}</strong><span>bonnes réponses</span></div>` : ""}
        <div><strong>${serie}</strong><span>${serie === 1 ? "día" : "días"} de camino${serieMontee ? ", un de plus" : ""}</span></div>
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
  if (fermeeEssai(s)) { history.replaceState(null, "", "#/acces/lecon"); return ecranAcces("lecon"); }
  if (!ouverte(s)) {
    const prec = precedent(niveauDe(s));
    toast(niveauOuvert(prec)
      ? `Le niveau ${niveauDe(s)} s'ouvre avec ${SEUIL_A2} tampons ${prec}. Encore ${SEUIL_A2 - sellosDe(prec)} à gagner.`
      : `Le niveau ${niveauDe(s)} s'ouvre après le niveau ${prec}.`);
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
      ${onglets.map(([k, l]) => `<button role="tab" aria-selected="${k === onglet}" class="${k === onglet ? "actif" : ""}" data-onglet="${k}">${l}</button>`).join("")}
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
  if (!s || !ouverte(s)) return aller("#/");
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
  if (!s || !ouverte(s)) return aller("#/");
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
        ? `<p>${g("Connectée", "Connecté")} en tant que <strong>${e(K.compte().prenom)}</strong>, avec Face ID. Ta progression est sauvegardée en ligne.</p>
           ${!accesComplet() ? `<p class="petit">Tu es en essai gratuit. <a class="lien" href="#/acces/reglages">Je veux l'accès complet</a></p>` : ""}
           ${K.compte()?.statut === "abonne" ? `<a class="btn btn-doux" href="#/retractation">Me rétracter du contrat</a>` : ""}
           ${etat.retractation ? `<p class="petit">Demande de rétractation reçue le ${e(dateHeure(etat.retractation.recue_le))}, référence ${e(etat.retractation.ref)}. <a class="lien" href="#/retractation">Revoir l'accusé</a></p>` : ""}
           <button class="btn btn-doux" data-deconnexion>Me déconnecter de cet appareil</button>
           ${!estProprio() ? `<button class="lien-texte" data-suppression>Supprimer mon compte</button>` : ""}`
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
      <label class="bascule"><input type="checkbox" data-r="sons" ${etat.reglages.sons !== false ? "checked" : ""}><span>Le bruit du tampon quand tu gagnes un sello</span></label>
      <button class="btn btn-doux" data-voix="¡Hola, ${e(etat.prenom)}! ¿Qué tal? Vamos a aprender español ${g("juntas", "juntos")}.">${ico("son")} Essayer la voix</button>
      <p class="petit">${V.aUneVoixEspagnole()
        ? `Voix utilisée : ${e(V.nomVoix() || "espagnole")}. `
        : "Aucune voix espagnole n'est installée sur cet appareil. "}Pour une voix plus naturelle sur iPhone : Réglages, Accessibilité, Contenu énoncé, Voix, Espagnol (Espagne), puis télécharge « Mónica (améliorée) ».</p>`
        : `<p class="petit">Ce navigateur ne sait pas lire à voix haute.</p>`}
    </section>
    <section class="bloc">
      <h2>Mon profil</h2>
      <p class="petit">Facultatif. Les phrases qui parlent de toi (d'où tu viens, ton métier) s'adaptent à tes réponses. Laisse vide si tu préfères les phrases d'origine.</p>
      <label class="champ">Mon pays d'origine
        <select data-profil="pays"><option value="">Choisir…</option>
          ${Object.entries(P.PAYS).map(([k, v]) => `<option value="${k}" ${etat.profil?.pays === k ? "selected" : ""}>${e(v.fr)}</option>`).join("")}
        </select></label>
      <label class="champ">Ma ville d'origine
        <input data-profil="ville" value="${e(P.nettoyerVille(etat.profil?.ville))}" maxlength="40" autocomplete="off" placeholder="Ex. : Conakry, Abidjan"></label>
      <label class="champ">Mon métier ou mes études
        <select data-profil="metier"><option value="">Choisir…</option>
          ${Object.entries(P.METIERS).map(([k, v]) => `<option value="${k}" ${etat.profil?.metier === k ? "selected" : ""}>${e(v[masc() ? "m" : "f"][2].replace(/^./, (c) => c.toUpperCase()))}</option>`).join("")}
        </select></label>
      <p class="petit" data-profil-apercu></p>
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
    <p class="petit centre">Mi Español · fait avec amour, phrase par phrase.</p>
    ${LIENS_LEGAUX}`;

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
      const r = await N.desactiver();
      if (!r.ok) { caseRappel.checked = true; msgRappel.textContent = N.MESSAGES.serveur; return; }
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
  $("[data-suppression]", app)?.addEventListener("click", async () => {
    const ok = await confirmer("Supprimer ton compte ?",
      "Ton compte, ta progression, ton carnet et tes rappels seront effacés définitivement, sur nos serveurs et sur ce téléphone. Ça ne peut pas être annulé. Si tu veux garder ta progression, fais d'abord une sauvegarde (plus bas dans Ajustes).",
      "Tout supprimer");
    if (!ok) return;
    const r = await K.supprimerCompte({ avantDeSortir: () => (S.get().reglages.rappel?.actif ? N.desactiver() : null) });
    if (!r.ok) { toast(K.MESSAGES[r.erreur] || K.MESSAGES.hors_ligne); return; }
    C.definirMots([]);
    majNavCompte();
    toast("Ton compte est supprimé. Merci d'avoir essayé Mi Español.");
    aller("#/");
  });
  $("[data-deconnexion]", app)?.addEventListener("click", async () => {
    if (await confirmer("Te déconnecter ?", "Ta progression reste sauvegardée en ligne. Cet appareil repartira de zéro jusqu'à ta prochaine connexion avec Face ID.", "Me déconnecter")) {
      const r = await K.seDeconnecter({
        avantDeSortir: () => (S.get().reglages.rappel?.actif ? N.desactiver() : null),
        prenomParDefaut: "",
      });
      if (!r.ok) { toast(K.MESSAGES[r.erreur] || K.MESSAGES.hors_ligne); return; }
      C.definirMots([]);
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
  // Mon profil : enregistré tout de suite, et les phrases se réaccordent.
  const apercu = () => {
    const t = P.jetons(S.get().profil, masc() ? "m" : "f");
    const bouts = [];
    if (t.pais) bouts.push(t.ciudad ? `Soy de ${t.ciudad}, en ${t.pais}.` : `Soy de ${t.pais}.`);
    else if (t.ciudad) bouts.push(`Soy de ${t.ciudad}.`);
    if (t.oficio) bouts.push(`Soy ${t.oficio}.`);
    const el = $("[data-profil-apercu]", app);
    if (el) el.innerHTML = bouts.length ? `Tu diras par exemple : <span class="es" lang="es">${e(bouts.join(" "))}</span>` : "";
  };
  $$("[data-profil]", app).forEach((champ) => {
    const enregistrer = () => {
      const k = champ.dataset.profil;
      const v = k === "ville" ? P.nettoyerVille(champ.value) : champ.value;
      if (k === "ville" && champ.value !== v) champ.value = v;
      S.maj((s) => { s.profil = { ...(s.profil || {}), [k]: v }; if (!v) delete s.profil[k]; });
      appliquerProfil();
      apercu();
    };
    champ.addEventListener("change", enregistrer);
    if (champ.tagName === "INPUT") champ.addEventListener("blur", enregistrer);
  });
  apercu();
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
    const enLigne = K.connecte();
    const texte = enLigne
      ? "Toute ta progression, ta série et ton carnet seront effacés, ici et sur ton compte. Fais une sauvegarde avant si tu veux les garder."
      : "Toute ta progression, ta série et ton carnet seront effacés. Fais une sauvegarde avant si tu veux les garder.";
    if (await confirmer("Tout recommencer ?", texte, "Tout effacer")) {
      if (enLigne) {
        // Le compte reste connecté : on repart de zéro ici, puis on remplace la copie en ligne.
        const r = await K.remettreAZero(K.compte()?.prenom || "");
        if (!r.ok) { toast(K.MESSAGES[r.erreur] || K.MESSAGES.hors_ligne); return; }
      } else {
        // Sans compte : on garde qui est la personne (prénom, ville, genre), on efface la progression.
        const { prenom, villeEs, genre: gen, profil } = S.get();
        S.toutEffacer();
        S.maj((s) => Object.assign(s, { prenom, villeEs, genre: gen, profil, bienvenueVue: !!prenom }));
      }
      appliquerProfil();
      window.appliquerTheme?.(S.get().reglages.theme || "auto");
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
  // Les Sorpresas (petits mots) sont pour Elisabeth seulement.
  if (lien) lien.hidden = K.compte()?.role !== "eli";
  // Les phrases s'accordent à la personne connectée.
  appliquerProfil();
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
      <h2>Je crée mon compte gratuit</h2>
      <p class="petit">L'essai est gratuit et sans engagement : aucun moyen de paiement n'est demandé.</p>
      <form class="pile" data-creation autocomplete="off">
        <label class="champ">Ton prénom<input name="prenom" required maxlength="30" value="${e(S.get().prenom || "")}" autocomplete="given-name"></label>
        <label class="champ">Ta ville en Espagne<input name="ville" required maxlength="40" value="${e(S.get().villeEs || "")}" placeholder="Ex. : Madrid, Bilbao, Zaragoza"></label>
        <label class="champ">On te parle…
          <select name="genre" required>
            <option value="" ${S.get().genre ? "" : "selected"}>Choisir…</option>
            <option value="f" ${S.get().genre === "f" ? "selected" : ""}>au féminin</option>
            <option value="m" ${S.get().genre === "m" ? "selected" : ""}>au masculin</option>
          </select></label>
        <button class="btn btn-large">${ico("visage")} Créer avec Face ID</button>
        <p class="petit centre">${MENTION_ACCEPTATION}</p>
      </form>
      <details class="petit">
        <summary>J'ai un code d'invitation</summary>
        <form class="pile" data-inscription autocomplete="off">
          <input name="code" required autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="XXXX-XXXX-XXXX" aria-label="Code d'invitation">
          <button class="btn">${ico("visage")} Créer avec Face ID</button>
        </form>
      </details>
    </section>
    <p class="petit centre" data-message aria-live="polite"></p>`
    : `<p class="encart">Cet appareil ne permet pas Face ID. Ouvre l'appli sur ton iPhone, dans Safari ou depuis l'écran d'accueil.</p>`}`;

  const message = $("[data-message]", app);
  const occupe = (b, on) => { if (b) { b.disabled = on; b.classList.toggle("en-cours", on); } };
  const resultat = (r) => {
    if (r.ok) {
      majNavCompte();
      toast(`${g("Bienvenida", "Bienvenido")}, ${r.utilisateur.prenom}`);
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
  $("[data-creation]", app)?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const bouton = $("button", f);
    const infos = { prenom: f.prenom.value.trim(), ville: P.nettoyerVille(f.ville.value), genre: f.genre.value };
    if (!infos.prenom || !infos.ville || !infos.genre) { message.textContent = "Il manque ton prénom, ta ville ou le féminin / masculin."; return; }
    occupe(bouton, true);
    message.textContent = "";
    try { resultat(await K.creerCompte(null, infos)); } finally { occupe(bouton, false); }
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
      <span><b>${jours}</b> ${jours === 1 ? "día" : "días"} de camino</span>
      <span><b>${d.sellos}</b> ${d.sellos === 1 ? "sello" : "sellos"}</span>
      <span><b>${d.acquises}</b> frases</span>
    </div>`;
  place.hidden = false;
}

demarrer();
