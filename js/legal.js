// Pages légales : les textes sont des fichiers Markdown dans legal/fr et legal/es,
// affichés ici avec un petit lecteur (titres, paragraphes, listes, tableaux, gras, italique, liens).
import { $, e, ico } from "./ui.js";

export const PAGES = {
  mentions:        { fichier: "legal/fr/mentions-legales.md", titre: "Mentions légales" },
  confidentialite: { fichier: "legal/fr/confidentialite.md", titre: "Confidentialité" },
  conditions:      { fichier: "legal/fr/conditions-de-vente.md", titre: "Conditions" },
  charla:          { fichier: "legal/fr/conditions-charla.md", titre: "Charla et l'IA" },
  "es-aviso":      { fichier: "legal/es/aviso-legal.md", titre: "Aviso legal" },
  "es-privacidad": { fichier: "legal/es/privacidad.md", titre: "Privacidad" },
  "es-condiciones":{ fichier: "legal/es/condiciones-de-venta.md", titre: "Condiciones" },
  "es-charla":     { fichier: "legal/es/condiciones-charla.md", titre: "Charla y la IA" },
};

// Texte d'une ligne : on échappe d'abord, puis on rend **gras**, *italique*, `code` et les adresses web.
function enLigne(t) {
  return e(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\bhttps:\/\/[^\s<)]+/g, (m) => `<a class="lien" href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`);
}

export function rendre(md) {
  const lignes = md.replace(/\r/g, "").split("\n");
  const html = [];
  let i = 0;
  while (i < lignes.length) {
    const l = lignes[i];
    if (!l.trim()) { i++; continue; }
    const titre = l.match(/^(#{1,3})\s+(.*)$/);
    if (titre) { const n = Math.min(titre[1].length + 1, 3); html.push(`<h${n}>${enLigne(titre[2])}</h${n}>`); i++; continue; }
    if (l.startsWith("|")) {
      const rangs = [];
      while (i < lignes.length && lignes[i].startsWith("|")) { rangs.push(lignes[i]); i++; }
      const cellules = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const [tete, , ...corps] = rangs;
      html.push(`<div class="legal-tableau"><table><thead><tr>${cellules(tete).map((c) => `<th>${enLigne(c)}</th>`).join("")}</tr></thead>
        <tbody>${corps.map((r) => `<tr>${cellules(r).map((c) => `<td>${enLigne(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const puce = /^\s*(?:[-*]|\d+\.)\s+/;
    if (puce.test(l)) {
      const ordonnee = /^\s*\d+\./.test(l);
      const items = [];
      while (i < lignes.length && (puce.test(lignes[i]) || /^\s{2,}\S/.test(lignes[i]))) {
        if (puce.test(lignes[i])) items.push(lignes[i].replace(puce, ""));
        else items[items.length - 1] += " " + lignes[i].trim();
        i++;
      }
      html.push(`<${ordonnee ? "ol" : "ul"}>${items.map((x) => `<li>${enLigne(x)}</li>`).join("")}</${ordonnee ? "ol" : "ul"}>`);
      continue;
    }
    const para = [];
    while (i < lignes.length && lignes[i].trim() && !/^(#|\||\s*(?:[-*]|\d+\.)\s)/.test(lignes[i])) { para.push(lignes[i].trim()); i++; }
    html.push(`<p>${enLigne(para.join(" "))}</p>`);
  }
  return html.join("\n");
}

export async function ecranLegal(app, page, { montrerNav }) {
  montrerNav(null);
  if (page === "es") {
    app.innerHTML = `
      <header class="page-haut"><a class="btn-ico" href="#/" aria-label="Volver">${ico("retour")}</a>
        <div><h1>Información legal</h1><p class="page-sous">En español</p></div></header>
      <section class="bloc legal">
        ${Object.entries(PAGES).filter(([k]) => k.startsWith("es-")).map(([k, p]) => `<a class="lien" href="#/legal/${k}">${e(p.titre)}</a>`).join("")}
      </section>`;
    return;
  }
  const p = PAGES[page] || PAGES.mentions;
  app.innerHTML = `
    <header class="page-haut"><a class="btn-ico" href="#/" data-retour-legal aria-label="Retour">${ico("retour")}</a>
      <div><h1>${e(p.titre)}</h1><p class="page-sous">Mi Español · elibangoura.com</p></div></header>
    <article class="bloc legal" lang="${page.startsWith("es-") ? "es" : "fr"}"><p class="petit">Chargement…</p></article>`;
  // Retour à l'écran d'où l'on vient (inscription, Ajustes…), sinon à l'accueil.
  $("[data-retour-legal]", app).addEventListener("click", (ev) => {
    if (history.length > 1) { ev.preventDefault(); history.back(); }
  });
  try {
    const rep = await fetch(p.fichier);
    if (!rep.ok) throw new Error(String(rep.status));
    const md = await rep.text();
    const article = $(".legal", app);
    if (!article) return;
    // Le titre de la page est déjà en haut : on retire le premier titre du fichier.
    article.innerHTML = rendre(md.replace(/^#\s+.*\n/, ""));
  } catch {
    const article = $(".legal", app);
    if (article) article.innerHTML = `<p>Ce texte n'a pas pu être chargé. Vérifie ta connexion, puis réessaie.</p>`;
  }
}
