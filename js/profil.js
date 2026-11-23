// Profil de chaque compte (facultatif) : pays, ville, métier.
// Les phrases qui parlent de la personne s'en servent (clé « perso » dans les leçons).
// Les formes espagnoles et françaises sont écrites ici, accordées au masculin et au féminin.

// f : forme féminine, m : masculine. pron : prononciation « à la française ».
export const PAYS = {
  guinee:     { es: "Guinea", pron: "gui-NÉ-a", fr: "Guinée", gent: { f: ["guineana", "gui-né-A-na"], m: ["guineano", "gui-né-A-no"] }, natFr: { f: "guinéenne", m: "guinéen" } },
  cotedivoire:{ es: "Costa de Marfil", pron: "KOSS-ta dé mar-FIL", fr: "Côte d'Ivoire", gent: { f: ["marfileña", "mar-fi-LÉ-gna"], m: ["marfileño", "mar-fi-LÉ-gno"] }, natFr: { f: "ivoirienne", m: "ivoirien" } },
  senegal:    { es: "Senegal", pron: "sé-né-GAL", fr: "Sénégal", gent: { f: ["senegalesa", "sé-né-ga-LÉ-ssa"], m: ["senegalés", "sé-né-ga-LÉSS"] }, natFr: { f: "sénégalaise", m: "sénégalais" } },
  mali:       { es: "Malí", pron: "ma-LI", fr: "Mali", gent: { f: ["maliense", "ma-LYÉN-ssé"], m: ["maliense", "ma-LYÉN-ssé"] }, natFr: { f: "malienne", m: "malien" } },
  cameroun:   { es: "Camerún", pron: "ka-mé-ROUN", fr: "Cameroun", gent: { f: ["camerunesa", "ka-mé-rou-NÉ-ssa"], m: ["camerunés", "ka-mé-rou-NÉSS"] }, natFr: { f: "camerounaise", m: "camerounais" } },
  burkina:    { es: "Burkina Faso", pron: "bour-KI-na FA-sso", fr: "Burkina Faso", gent: { f: ["burkinesa", "bour-ki-NÉ-ssa"], m: ["burkinés", "bour-ki-NÉSS"] }, natFr: { f: "burkinabè", m: "burkinabè" } },
  benin:      { es: "Benín", pron: "bé-NIN", fr: "Bénin", gent: { f: ["beninesa", "bé-ni-NÉ-ssa"], m: ["beninés", "bé-ni-NÉSS"] }, natFr: { f: "béninoise", m: "béninois" } },
  togo:       { es: "Togo", pron: "TO-go", fr: "Togo", gent: { f: ["togolesa", "to-go-LÉ-ssa"], m: ["togolés", "to-go-LÉSS"] }, natFr: { f: "togolaise", m: "togolais" } },
  rdc:        { es: "el Congo", pron: "él KON-go", fr: "RD Congo", gent: { f: ["congoleña", "kon-go-LÉ-gna"], m: ["congoleño", "kon-go-LÉ-gno"] }, natFr: { f: "congolaise", m: "congolais" } },
  maroc:      { es: "Marruecos", pron: "ma-RROUÉ-koss", fr: "Maroc", gent: { f: ["marroquí", "ma-rro-KI"], m: ["marroquí", "ma-rro-KI"] }, natFr: { f: "marocaine", m: "marocain" } },
  france:     { es: "Francia", pron: "FRAN-thya", fr: "France", gent: { f: ["francesa", "fran-THÉ-ssa"], m: ["francés", "fran-THÉSS"] }, natFr: { f: "française", m: "français" } },
  belgique:   { es: "Bélgica", pron: "BÉL-khi-ka", fr: "Belgique", gent: { f: ["belga", "BÉL-ga"], m: ["belga", "BÉL-ga"] }, natFr: { f: "belge", m: "belge" } },
};

export const METIERS = {
  vente:       { f: ["dependienta", "dé-pén-DYÉN-ta", "vendeuse"], m: ["dependiente", "dé-pén-DYÉN-té", "vendeur"] },
  commerce:    { f: ["comerciante", "ko-mér-THYAN-té", "commerçante"], m: ["comerciante", "ko-mér-THYAN-té", "commerçant"] },
  entreprise:  { f: ["empresaria", "ém-pré-SSA-rya", "cheffe d'entreprise"], m: ["empresario", "ém-pré-SSA-ryo", "chef d'entreprise"] },
  soins:       { f: ["enfermera", "én-fér-MÉ-ra", "infirmière"], m: ["enfermero", "én-fér-MÉ-ro", "infirmier"] },
  aide:        { f: ["cuidadora", "kouï-da-DO-ra", "aide à domicile"], m: ["cuidador", "kouï-da-DOR", "aide à domicile"] },
  cuisine:     { f: ["cocinera", "ko-thi-NÉ-ra", "cuisinière"], m: ["cocinero", "ko-thi-NÉ-ro", "cuisinier"] },
  service:     { f: ["camarera", "ka-ma-RÉ-ra", "serveuse"], m: ["camarero", "ka-ma-RÉ-ro", "serveur"] },
  coiffure:    { f: ["peluquera", "pé-lou-KÉ-ra", "coiffeuse"], m: ["peluquero", "pé-lou-KÉ-ro", "coiffeur"] },
  bureau:      { f: ["administrativa", "ad-mi-niss-tra-TI-ba", "employée de bureau"], m: ["administrativo", "ad-mi-niss-tra-TI-bo", "employé de bureau"] },
  compta:      { f: ["contable", "kon-TA-blé", "comptable"], m: ["contable", "kon-TA-blé", "comptable"] },
  informatique:{ f: ["informática", "in-for-MA-ti-ka", "informaticienne"], m: ["informático", "in-for-MA-ti-ko", "informaticien"] },
  enseignement:{ f: ["profesora", "pro-fé-SSO-ra", "professeure"], m: ["profesor", "pro-fé-SSOR", "professeur"] },
  conduite:    { f: ["conductora", "kon-douk-TO-ra", "chauffeuse"], m: ["conductor", "kon-douk-TOR", "chauffeur"] },
  etudes:      { f: ["estudiante", "éss-tou-DYAN-té", "étudiante"], m: ["estudiante", "éss-tou-DYAN-té", "étudiant"] },
};

// Ville : texte libre, court, sans caractères bizarres.
export const nettoyerVille = (v) => String(v || "").replace(/[^\p{L}\p{M} '’.-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);

// Les valeurs à glisser dans les phrases, ou null si le champ n'est pas rempli.
// genre : "f" (Elisabeth) ou "m" (Khalil).
export function jetons(profil, genre) {
  const p = profil || {};
  const g = genre === "m" ? "m" : "f";
  const t = {};
  const pays = PAYS[p.pays];
  if (pays) {
    Object.assign(t, {
      pais: pays.es, pais_pron: pays.pron, pays_fr: pays.fr,
      gentilicio: pays.gent[g][0], gentilicio_pron: pays.gent[g][1], nationalite_fr: pays.natFr[g],
    });
  }
  const ville = nettoyerVille(p.ville);
  if (ville) Object.assign(t, { ciudad: ville, ciudad_pron: ville, ville: ville });
  const metier = METIERS[p.metier];
  if (metier) Object.assign(t, { oficio: metier[g][0], oficio_pron: metier[g][1], metier_fr: metier[g][2] });
  return t;
}

// Correspondance jeton → champ du profil (pour savoir ce qu'une phrase demande).
export const CHAMP = {
  pais: "pays", pais_pron: "pays", pays_fr: "pays", gentilicio: "pays", gentilicio_pron: "pays", nationalite_fr: "pays",
  ciudad: "ville", ciudad_pron: "ville", ville: "ville",
  oficio: "metier", oficio_pron: "metier", metier_fr: "metier",
};
