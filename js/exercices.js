// Les exercices et le « déroulé » d'une séance (une suite d'exercices l'un après l'autre).
import * as S from "./store.js";
import * as C from "./contenu.js";
import { e, ico, melanger, auHasard, normaliser, distance, vibrer } from "./ui.js";

const BRAVO = ["¡Muy bien!", "¡Eso es!", "¡Perfecto!", "¡Olé!", "¡Genial!", "¡Qué crack!"];
const OUPS = [
  "Casi… Ça viendra.",
  "Pas grave, elle reviendra bientôt.",
  "Même les Espagnols hésitent parfois.",
  "On respire, on continue.",
  "Celle-là, on la garde à l'œil.",
];

const ph = (id) => C.phrase(id, S.get().carnet);
const pron = (p) => (S.get().reglages.pron && p.pron ? `<p class="pron">${e(p.pron)}</p>` : "");

// Mauvaises réponses plausibles : de préférence dans la même situation.
function leurres(id, champ, n = 3) {
  const p = ph(id);
  const sit = C.situationDe(id);
  const proches = (sit ? sit.phrases : []).filter((x) => x.id !== id);
  const autres = C.toutes().flatMap((s) => s.phrases).filter((x) => x.id !== id && (!sit || x.id.split("-")[0] !== sit.id));
  const vus = new Set([normaliser(p[champ])]);
  const res = [];
  for (const x of [...melanger(proches), ...melanger(autres)]) {
    const k = normaliser(x[champ]);
    if (!x[champ] || vus.has(k)) continue;
    vus.add(k);
    res.push(x[champ]);
    if (res.length === n) break;
  }
  return res;
}

// ---------------------------------------------------------------------------
// Une séance : liste d'items, progression, retour à la fin.
// items : { type: "carte" | "qcm" | "relier" | "ecrire" | "rapide", id | ids, ... }
export function seance(racine, items, { titre = "", depart = 0, onAvance, onFin, onQuitter } = {}) {
  let i = depart;
  const file = [...items];
  const repris = new Set(); // cartes ratées déjà remises en fin de file
  const stats = { ok: 0, ko: 0 };

  racine.innerHTML = `
    <div class="seance">
      <header class="seance-haut">
        <button class="btn-ico" data-quitter aria-label="Quitter">${ico("croix")}</button>
        <div class="barre"><div class="barre-plein"></div></div>
        <span class="seance-titre">${e(titre)}</span>
      </header>
      <section class="seance-corps"></section>
    </div>`;
  const corps = racine.querySelector(".seance-corps");
  racine.querySelector("[data-quitter]").onclick = () => onQuitter?.(i);

  const majBarre = () => {
    racine.querySelector(".barre-plein").style.width = `${Math.round((i / Math.max(file.length, 1)) * 100)}%`;
  };

  const suivant = () => {
    i++;
    onAvance?.(i, file.length);
    afficher();
  };

  const resultat = (ok, id) => {
    if (ok) stats.ok++;
    else {
      stats.ko++;
      if (id) S.erreurExercice(id);
    }
  };

  function afficher() {
    majBarre();
    if (i >= file.length) return onFin?.(stats);
    const it = file[i];
    corps.innerHTML = "";
    corps.scrollTop = 0;
    window.scrollTo(0, 0);
    const vue = { carte, qcm, relier, ecrire, rapide }[it.type];
    if (!vue || (it.id && !ph(it.id))) return suivant();
    vue(corps, it, {
      resultat,
      suivant,
      remettre: (item) => {
        if (repris.has(item.id)) return;
        repris.add(item.id);
        file.push({ ...item, nouveau: false });
      },
    });
  }
  afficher();
}

// Bouton « Continuer » sous une correction
function piedContinuer(corps, ok, suivant, extra = "") {
  const pied = document.createElement("div");
  pied.className = `retour ${ok ? "retour-ok" : "retour-ko"}`;
  pied.innerHTML = `<p class="retour-titre">${ok ? e(auHasard(BRAVO)) : e(auHasard(OUPS))}</p>${extra}
    <button class="btn btn-large" data-suivant>Continuer</button>`;
  corps.appendChild(pied);
  vibrer(ok ? 12 : 40);
  const b = pied.querySelector("[data-suivant]");
  b.focus({ preventScroll: true });
  b.onclick = suivant;
  pied.scrollIntoView({ behavior: "smooth", block: "end" });
}

// ---------------------------------------------------------------------------
// Flashcard : la phrase, on touche pour voir la traduction, puis « Pas encore » / « Je savais ».
function carte(corps, it, { resultat, suivant, remettre }) {
  const p = ph(it.id);
  const cachee = S.get().reglages.traductionCachee;
  corps.innerHTML = `
    <p class="consigne">${it.nouveau ? '<span class="pastille">Nouvelle phrase</span>' : "Tu te souviens ?"}</p>
    <button class="carte ${cachee ? "" : "retournee"}" data-carte>
      <span class="carte-es">${e(p.es)}</span>
      ${pron(p)}
      <span class="carte-verso">
        <span class="carte-fr">${e(p.fr)}</span>
        ${p.note ? `<span class="carte-note">${e(p.note)}</span>` : ""}
      </span>
      <span class="carte-indice">Touche pour voir la traduction</span>
    </button>
    <div class="rangee choix-carte" ${cachee ? "hidden" : ""}>
      <button class="btn btn-doux" data-non>${it.nouveau ? "À revoir" : "Pas encore"}</button>
      <button class="btn" data-oui>${it.nouveau ? "Je la connaissais" : "Je savais"}</button>
    </div>`;
  const c = corps.querySelector("[data-carte]");
  const choix = corps.querySelector(".choix-carte");
  c.onclick = () => {
    c.classList.add("retournee");
    choix.hidden = false;
  };
  corps.querySelector("[data-oui]").onclick = () => {
    S.noter(it.id, true);
    if (!it.nouveau) resultat(true);
    suivant();
  };
  corps.querySelector("[data-non]").onclick = () => {
    if (it.nouveau) S.maj(() => S.decouvrir(it.id));
    else {
      S.noter(it.id, false);
      resultat(false);
    }
    remettre(it);
    suivant();
  };
}

// ---------------------------------------------------------------------------
// QCM : dans un sens (espagnol -> français) ou dans l'autre (trouver ses mots).
function qcm(corps, it, { resultat, suivant }) {
  const p = ph(it.id);
  const versFr = it.sens !== "fr-es";
  const champ = versFr ? "fr" : "es";
  const options = melanger([p[champ], ...leurres(it.id, champ)]);
  corps.innerHTML = `
    <p class="consigne">${versFr ? "Ça veut dire…" : "Comment tu dis…"}</p>
    <div class="enonce">
      <p class="enonce-texte">${e(versFr ? p.es : p.fr)}</p>
      ${versFr ? pron(p) : ""}
    </div>
    <div class="options">${options.map((o, k) => `<button class="option" data-k="${k}">${e(o)}</button>`).join("")}</div>`;
  corps.querySelectorAll(".option").forEach((b) => {
    b.onclick = () => {
      const ok = options[+b.dataset.k] === p[champ];
      corps.querySelectorAll(".option").forEach((x) => {
        x.disabled = true;
        if (options[+x.dataset.k] === p[champ]) x.classList.add("juste");
      });
      if (!ok) b.classList.add("faux");
      resultat(ok, it.id);
      piedContinuer(corps, ok, suivant, versFr ? "" : pron(p));
    };
  });
}

// ---------------------------------------------------------------------------
// Relier : 4 ou 5 phrases espagnoles avec leur traduction.
function relier(corps, it, { resultat, suivant }) {
  const ps = it.ids.map(ph).filter(Boolean);
  const gauche = melanger(ps);
  const droite = melanger(ps);
  let choisi = null;
  let restants = ps.length;
  let erreurs = 0;
  corps.innerHTML = `
    <p class="consigne">Relie chaque phrase à sa traduction</p>
    <div class="relier">
      <div class="relier-col">${gauche.map((p) => `<button class="tuile" data-g="${e(p.id)}">${e(p.es)}</button>`).join("")}</div>
      <div class="relier-col">${droite.map((p) => `<button class="tuile tuile-fr" data-d="${e(p.id)}">${e(p.fr)}</button>`).join("")}</div>
    </div>`;
  corps.querySelectorAll("[data-g]").forEach((b) => {
    b.onclick = () => {
      corps.querySelectorAll("[data-g]").forEach((x) => x.classList.remove("choisie"));
      b.classList.add("choisie");
      choisi = b;
    };
  });
  corps.querySelectorAll("[data-d]").forEach((b) => {
    b.onclick = () => {
      if (!choisi) {
        b.classList.add("secoue");
        setTimeout(() => b.classList.remove("secoue"), 400);
        return;
      }
      if (choisi.dataset.g === b.dataset.d) {
        choisi.classList.remove("choisie");
        choisi.classList.add("faite");
        b.classList.add("faite");
        choisi.disabled = b.disabled = true;
        choisi = null;
        vibrer(10);
        if (--restants === 0) {
          resultat(erreurs === 0);
          piedContinuer(corps, erreurs === 0, suivant,
            erreurs ? `<p class="retour-texte">${erreurs} petite${erreurs > 1 ? "s" : ""} erreur${erreurs > 1 ? "s" : ""} en route, mais tout est relié.</p>` : "");
        }
      } else {
        erreurs++;
        S.erreurExercice(choisi.dataset.g);
        [choisi, b].forEach((x) => {
          x.classList.add("secoue");
          setTimeout(() => x.classList.remove("secoue"), 400);
        });
      }
    };
  });
}

// ---------------------------------------------------------------------------
// Écrire : la phrase française, elle tape l'espagnol. Tolérant sur les accents et la ponctuation.
function ecrire(corps, it, { resultat, suivant }) {
  const p = ph(it.id);
  corps.innerHTML = `
    <p class="consigne">Écris-le en espagnol</p>
    <div class="enonce"><p class="enonce-texte">${e(p.fr)}</p></div>
    <form class="ecrire" autocomplete="off">
      <textarea rows="2" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="Ta réponse…" aria-label="Ta réponse en espagnol"></textarea>
      <div class="accents">${["á", "é", "í", "ó", "ú", "ñ", "¿", "¡"].map((a) => `<button type="button" data-a="${a}">${a}</button>`).join("")}</div>
      <div class="rangee">
        <button type="button" class="btn btn-doux" data-aide>Je ne sais pas</button>
        <button class="btn">Vérifier</button>
      </div>
    </form>`;
  const form = corps.querySelector("form");
  const zone = form.querySelector("textarea");
  form.querySelectorAll("[data-a]").forEach((b) => {
    b.onclick = () => {
      const [d, f] = [zone.selectionStart, zone.selectionEnd];
      zone.value = zone.value.slice(0, d) + b.dataset.a + zone.value.slice(f);
      zone.focus();
      zone.setSelectionRange(d + 1, d + 1);
    };
  });
  const corriger = (abandon) => {
    const rep = zone.value;
    const attendu = p.es;
    const a = normaliser(rep), b = normaliser(attendu);
    const exact = a === b;
    const accentsOk = normaliser(rep, true) === normaliser(attendu, true);
    const proche = !exact && b.length > 0 && distance(a, b) <= Math.max(1, Math.round(b.length * 0.12));
    const ok = !abandon && (exact || proche);
    form.querySelectorAll("button, textarea").forEach((x) => (x.disabled = true));
    let extra = `<p class="retour-solution">${e(attendu)}</p>${pron(p)}`;
    if (ok && exact && !accentsOk) extra = `<p class="retour-texte">Juste ! Attention juste aux accents :</p>` + extra;
    else if (ok && proche) extra = `<p class="retour-texte">Presque parfait, regarde la petite différence :</p>` + extra;
    resultat(ok, it.id);
    piedContinuer(corps, ok, suivant, extra);
  };
  form.onsubmit = (ev) => {
    ev.preventDefault();
    if (!zone.value.trim()) return zone.focus();
    corriger(false);
  };
  form.querySelector("[data-aide]").onclick = () => corriger(true);
}

// ---------------------------------------------------------------------------
// À l'oreille rapide : la phrase telle qu'on l'entend quand ça parle vite.
function rapide(corps, it, { resultat, suivant }) {
  const p = ph(it.id);
  const options = melanger([p.es, ...leurres(it.id, "es")]);
  corps.innerHTML = `
    <p class="consigne">À l'oreille rapide</p>
    <div class="enonce enonce-rapide">
      <p class="petit">Dans la rue, tu entends :</p>
      <p class="enonce-texte">« ${e(p.rapide)} »</p>
    </div>
    <p class="consigne-2">Quelle phrase on t'a dite ?</p>
    <div class="options">${options.map((o, k) => `<button class="option" data-k="${k}">${e(o)}</button>`).join("")}</div>`;
  corps.querySelectorAll(".option").forEach((b) => {
    b.onclick = () => {
      const ok = options[+b.dataset.k] === p.es;
      corps.querySelectorAll(".option").forEach((x) => {
        x.disabled = true;
        if (options[+x.dataset.k] === p.es) x.classList.add("juste");
      });
      if (!ok) b.classList.add("faux");
      resultat(ok, it.id);
      piedContinuer(corps, ok, suivant, `<p class="retour-texte">${e(p.fr)}</p>`);
    };
  });
}

// ---------------------------------------------------------------------------
// Fabrique d'exercices variés à partir d'une liste de phrases déjà vues.
export function exercicesSur(ids, n = 10) {
  const avecRapide = ids.filter((id) => ph(id)?.rapide);
  const items = [];
  const pool = melanger(ids);
  let k = 0;
  const prendre = () => pool[k++ % pool.length];
  if (ids.length >= 4) items.push({ type: "relier", ids: melanger(ids).slice(0, Math.min(5, ids.length)) });
  for (const id of melanger(avecRapide).slice(0, 2)) items.push({ type: "rapide", id });
  while (items.length < n && pool.length) {
    const r = Math.random();
    const id = prendre();
    // Écrire une phrase entière, oui, mais pas un roman : seulement les phrases courtes.
    const courte = (ph(id)?.es || "").length <= 38;
    if (r < 0.35) items.push({ type: "qcm", id, sens: "es-fr" });
    else if (r < 0.72 || !courte) items.push({ type: "qcm", id, sens: "fr-es" });
    else items.push({ type: "ecrire", id });
  }
  return melanger(items);
}
