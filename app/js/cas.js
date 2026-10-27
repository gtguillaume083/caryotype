/* Les caryotypes proposés et l'analyse d'une formule chromosomique. */
(function () {
  "use strict";

  const AUTOSOMES = Array.from({ length: 22 }, (_, i) => String(i + 1));
  const CLASSES = AUTOSOMES.concat(["X", "Y"]);

  /* « 47,XY,+21 » → liste des chromosomes présents */
  function classesDepuisFormule(formule) {
    const morceaux = formule.replace(/\s/g, "").toUpperCase().split(",");
    const liste = [];
    for (const a of AUTOSOMES) liste.push(a, a);
    for (const m of morceaux.slice(2)) {
      const c = m.slice(1);
      if (!AUTOSOMES.includes(c)) continue;
      if (m[0] === "+") liste.push(c);
      if (m[0] === "-") liste.splice(liste.indexOf(c), 1);
    }
    for (const s of morceaux[1] || "") if (s === "X" || s === "Y") liste.push(s);
    return liste;
  }

  /* Écarts par rapport à un caryotype normal du même sexe :
   * [{ c: "21", delta: +1 }, ...] */
  function anomalies(liste) {
    const n = {};
    for (const c of liste) n[c] = (n[c] || 0) + 1;
    const res = [];
    for (const a of AUTOSOMES) if ((n[a] || 0) !== 2) res.push({ c: a, delta: (n[a] || 0) - 2 });
    const y = n.Y || 0;
    const x = n.X || 0;
    if (y > 0) {
      if (x !== 1) res.push({ c: "X", delta: x - 1 });
      if (y !== 1) res.push({ c: "Y", delta: y - 1 });
    } else if (x !== 2) {
      res.push({ c: "X", delta: x - 2 });
    }
    return res;
  }

  function sexe(liste) {
    return liste.includes("Y") ? "garcon" : "fille";
  }

  /* Nom de l'anomalie, pour la correction */
  function nomAnomalie(liste) {
    const an = anomalies(liste);
    if (!an.length) return "Caryotype normal";
    if (an.length > 1) return "Plusieurs anomalies du nombre de chromosomes";
    const { c, delta } = an[0];
    const garcon = liste.includes("Y");
    const noms = {
      "21+1": "Trisomie 21 (syndrome de Down)",
      "18+1": "Trisomie 18 (syndrome d'Edwards)",
      "13+1": "Trisomie 13 (syndrome de Patau)",
      "X-1": "Monosomie X (syndrome de Turner)",
      "Y+1": "Garçon XYY (syndrome de Jacobs)",
    };
    const cle = c + (delta > 0 ? "+" : "") + delta;
    if (noms[cle]) return noms[cle];
    if (c === "X" && delta === 1) return garcon ? "Syndrome de Klinefelter (XXY)" : "Trisomie X (triple X)";
    if (c === "X" && delta === 2 && !garcon) return "Tétrasomie X (48,XXXX)";
    if (delta === 1) return `Trisomie ${c}`;
    if (delta === -1) return `Monosomie ${c}`;
    return `Chromosome ${c} présent en ${2 + delta} exemplaires`;
  }

  function normaliserFormule(f) {
    return f.replace(/\s/g, "").toUpperCase().replace(/^(\d+),X[0O]$/, "$1,X");
  }

  /* Les cas. type « dessin » : chromosomes vectoriels générés.
   * type « photo » : chromosomes découpés dans un vrai caryogramme
   * (source = dossier dans donnees/, retirer = chromosomes à enlever). */
  const LISTE = [
    { id: "xx", type: "dessin", formule: "46,XX" },
    { id: "xy", type: "dessin", formule: "46,XY" },
    { id: "t21f", type: "dessin", formule: "47,XX,+21" },
    { id: "t21m", type: "dessin", formule: "47,XY,+21" },
    { id: "t18", type: "dessin", formule: "47,XY,+18" },
    { id: "t13", type: "dessin", formule: "47,XX,+13" },
    { id: "turner", type: "dessin", formule: "45,X" },
    { id: "klinefelter", type: "dessin", formule: "47,XXY" },
    { id: "xyy", type: "dessin", formule: "47,XYY" },
    { id: "xxx", type: "dessin", formule: "47,XXX" },
    { id: "p-xy", type: "photo", formule: "46,XY", source: "nhgri_xy" },
    { id: "p-xx", type: "photo", formule: "46,XX", source: "xxxx", retirer: ["X", "X"], montage: true },
    { id: "p-t21", type: "photo", formule: "47,XX,+21", source: "t21" },
    { id: "p-t18", type: "photo", formule: "47,XY,+18", source: "t18" },
    { id: "p-turner", type: "photo", formule: "45,X", source: "turner" },
    { id: "p-klinefelter", type: "photo", formule: "47,XXY", source: "xxy_a" },
    { id: "p-xxxx", type: "photo", formule: "48,XXXX", source: "xxxx" },
  ];

  /* Crédits des photos (licences libres, Wikimedia Commons) */
  const CREDITS = {
    nhgri_xy: "National Human Genome Research Institute (NHGRI) – domaine public",
    xxxx: "A. Hineno, T. Kosho, H. Kato, Y. Sekijima – CC BY 4.0",
    t21: "Laura21.de – CC BY-SA 1.0",
    t18: "Serra Amoros – CC BY-SA 4.0",
    turner: "Auteur inconnu (Wikimedia Commons « 45,X.jpg ») – CC BY-SA 3.0",
    xxy_a: "Auteur inconnu (Wikimedia Commons « 47,XXY.jpg ») – CC BY-SA 3.0",
  };

  window.Cas = {
    LISTE, CLASSES, CREDITS,
    classesDepuisFormule, anomalies, sexe, nomAnomalie, normaliserFormule,
    parId: (id) => LISTE.find((c) => c.id === id),
  };
})();
