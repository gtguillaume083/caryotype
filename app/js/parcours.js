/* Parcours guidé « Comprendre la génétique » (SVT, cycle 4).
 *
 * Chaque chapitre suit le même plan, toujours dans le même ordre :
 *   Je découvre → J'expérimente → Je vérifie → Je retiens.
 * Les expériences réutilisent le dessin des chromosomes (chromosome.js).
 * La progression est gardée dans le navigateur de l'élève (rien en ligne).
 */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // couleurs d'origine des chromosomes dans les schémas (lisibles par les daltoniens)
  const MERE = [255, 190, 120];
  const PERE = [140, 195, 255];
  const COULEUR_MERE = "#d9822b";
  const COULEUR_PERE = "#2f7fd1";

  /* ---------- mémoire (facultative) ---------- */
  const memoire = {
    lire() {
      try { return JSON.parse(localStorage.getItem("caryotype.parcours")) || {}; } catch (e) { return {}; }
    },
    ecrire(v) {
      try { localStorage.setItem("caryotype.parcours", JSON.stringify(v)); } catch (e) { /* navigation privée */ }
    },
  };
  let progres = memoire.lire(); // { ch1: true, ... } : chapitres réussis

  /* ---------- chromosomes dessinés (avec cache) ---------- */
  const cache = new Map();
  function chromo(classe, o = {}) {
    const cle = JSON.stringify([classe, o]);
    if (!cache.has(cle)) {
      const d = Chromosome.dessiner(classe, o.graine || 7, {
        modele: o.realiste ? false : true, une: !!o.une, ecart: o.ecart,
        teinte: o.teinte, echelle: o.echelle || 1,
      });
      cache.set(cle, { url: Chromosome.versURL(d.svg), w: d.w, h: d.h, pad: d.pad, L: d.L, centro: d.centro });
    }
    return cache.get(cle);
  }
  function imgChromo(classe, o = {}) {
    const c = chromo(classe, o);
    return `<img class="ch-img" src="${c.url}" width="${c.w}" height="${c.h}" alt="${o.alt || "Chromosome " + classe}">`;
  }

  /* ---------- groupes sanguins (gène ABO, chromosome 9) ---------- */
  function groupe(a1, a2) {
    const s = [a1, a2].sort().join("");
    return { AA: "A", AO: "A", BB: "B", BO: "B", AB: "AB", OO: "O" }[s];
  }
  // gène ABO : chr9 vers 133,26 Mb sur 138,4 Mb (GRCh38), bande q34.2
  const LOCUS_ABO = 133.26 / 138.4;

  /* ======================================================================
   * EXPÉRIENCES
   * ==================================================================== */

  /* 1. De l'organisme à l'ADN : un zoom en 7 niveaux.
   * Schémas : légendes hors de la figure, alignées en colonne à droite,
   * traits de rappel horizontaux sans flèche. */
  const NIVEAUX = [
    { nom: "L'organisme", texte: "Un <b>organisme</b> (ici, un être humain) est formé de milliards de <b>cellules</b>. On zoome sur un petit morceau de peau." },
    { nom: "Un tissu", texte: "Au microscope, la peau est formée de <b>cellules</b> collées les unes aux autres : elles forment un <b>tissu</b>. Presque chaque cellule possède un <b>noyau</b>." },
    { nom: "Une cellule", texte: "Une cellule est limitée par une <b>membrane</b>. Elle contient du <b>cytoplasme</b> et un <b>noyau</b>." },
    { nom: "Le noyau", texte: "Le noyau contient les <b>chromosomes</b> : 46 chez l'être humain. On les voit bien quand la cellule se divise : ils sont alors courts et épais." },
    { nom: "Un chromosome", texte: "Un chromosome contient une très longue molécule d'<b>ADN</b>, très enroulée. Sur le chromosome 9, près de l'extrémité du bras long, se trouve le <b>gène</b> qui détermine le groupe sanguin. <small>(Ce chromosome a été copié avant une division : on voit deux chromatides, voir chapitre 5.)</small>" },
    { nom: "L'ADN et un gène", texte: "Déroulé, l'ADN ressemble à une échelle tordue : une <b>double hélice</b>. Une portion d'ADN qui porte une information précise est un <b>gène</b> (en jaune)." },
    { nom: "Les nucléotides", texte: "L'ADN est une chaîne de petites molécules, les <b>nucléotides</b>, de 4 sortes : A, T, C et G. Chaque barreau de l'échelle est formé de deux nucléotides face à face : A avec T, C avec G. L'ordre des nucléotides forme l'<b>information génétique</b>." },
  ];
  const VB = "0 0 360 240";
  const COL_LEGENDES = 250; // x de la colonne des légendes

  // légendes : [{ texte, x, y }] (x, y : point visé) → traits horizontaux + textes alignés
  function legendes(liste) {
    return liste.map((l) => {
      const lignes = l.texte.split("\n");
      return `<line x1="${l.x.toFixed(1)}" y1="${l.y.toFixed(1)}" x2="${COL_LEGENDES - 6}" y2="${l.y.toFixed(1)}" class="trait"/>`
        + lignes.map((t, i) => `<text x="${COL_LEGENDES}" y="${(l.y + 4.5 + (i - (lignes.length - 1) / 2) * 15).toFixed(1)}" class="leg">${t}</text>`).join("");
    }).join("");
  }

  // bord droit d'un polygone à la hauteur y
  function bordDroit(poly, y) {
    let x = -Infinity;
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) x = Math.max(x, a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    });
    return x;
  }

  /* Tissu : cellules jointives (diagramme de Voronoï d'une grille déformée). */
  const TISSU = (function () {
    const r = Chromosome.aleatoire(11);
    const germes = [];
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
      germes.push([-12 + i * 54 + (j % 2) * 27 + (r() - 0.5) * 20, -12 + j * 52 + (r() - 0.5) * 18]);
    }
    const cellules = germes.map((s, k) => {
      let poly = [[-40, -40], [400, -40], [400, 280], [-40, 280]];
      germes.forEach((t, m) => {
        if (m === k) return;
        const mx = (s[0] + t[0]) / 2, my = (s[1] + t[1]) / 2, dx = t[0] - s[0], dy = t[1] - s[1];
        const f = (p) => (p[0] - mx) * dx + (p[1] - my) * dy;
        const res = [];
        poly.forEach((a, i) => {
          const b = poly[(i + 1) % poly.length];
          const fa = f(a), fb = f(b);
          if (fa <= 0) res.push(a);
          if (fa * fb < 0) { const u = fa / (fa - fb); res.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]); }
        });
        poly = res;
      });
      const c = poly.reduce((acc, p) => [acc[0] + p[0] / poly.length, acc[1] + p[1] / poly.length], [0, 0]);
      return { poly, c, rx: 10 + r() * 2, ry: 7.5 + r() * 1.5, a: Math.round(r() * 180) };
    });
    let choisie = 0;
    cellules.forEach((c, k) => { if (Math.hypot(c.c[0] - 125, c.c[1] - 120) < Math.hypot(cellules[choisie].c[0] - 125, cellules[choisie].c[1] - 120)) choisie = k; });
    return { cellules, choisie };
  })();
  const pts = (poly) => poly.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");

  /* Noyau : chromosomes placés au hasard (graine fixe), entièrement dans le noyau et sans se chevaucher. */
  const NOYAU = { cx: 128, cy: 120, r: 104 };
  const DANS_NOYAU = (function () {
    const r = Chromosome.aleatoire(5);
    const classes = ["1", "2", "3", "5", "7", "9", "11", "12", "16", "18", "20", "21", "X"];
    const poses = [];
    const distSeg = (a, b) => {
      const d = (p, s) => {
        const vx = s[2] - s[0], vy = s[3] - s[1];
        const t = Math.max(0, Math.min(1, ((p[0] - s[0]) * vx + (p[1] - s[1]) * vy) / (vx * vx + vy * vy || 1)));
        return Math.hypot(p[0] - s[0] - t * vx, p[1] - s[1] - t * vy);
      };
      return Math.min(d([a[0], a[1]], b), d([a[2], a[3]], b), d([b[0], b[1]], a), d([b[2], b[3]], a));
    };
    for (const c of classes) {
      const k = chromo(c, { echelle: 0.48 });
      const demi = k.L / 2;
      for (let essai = 0; essai < 400; essai++) {
        const ang = r() * Math.PI;
        const x = NOYAU.cx + (r() - 0.5) * 2 * NOYAU.r, y = NOYAU.cy + (r() - 0.5) * 2 * NOYAU.r;
        const s = [x - Math.sin(ang) * demi, y - Math.cos(ang) * demi, x + Math.sin(ang) * demi, y + Math.cos(ang) * demi];
        const marge = NOYAU.r - 10;
        if (Math.hypot(s[0] - NOYAU.cx, s[1] - NOYAU.cy) > marge || Math.hypot(s[2] - NOYAU.cx, s[3] - NOYAU.cy) > marge) continue;
        if (poses.some((p) => distSeg(p.s, s) < 22)) continue;
        poses.push({ c, k, x, y, deg: (-ang * 180) / Math.PI, s });
        break;
      }
    }
    return poses;
  })();

  function dessinNiveau(n) {
    const svg = (label, contenu) => `<svg viewBox="${VB}" class="zoom-svg" role="img" aria-label="${label}">${contenu}</svg>`;
    if (n === 0) {
      return svg("Silhouette d'un être humain", `
        <g fill="#c9d6e2" stroke="#7d93a8" stroke-width="2">
          <circle cx="150" cy="40" r="22"/>
          <rect x="122" y="66" width="56" height="80" rx="18"/>
          <rect x="96" y="70" width="20" height="72" rx="10"/><rect x="184" y="70" width="20" height="72" rx="10"/>
          <rect x="126" y="140" width="20" height="80" rx="10"/><rect x="154" y="140" width="20" height="80" rx="10"/>
        </g>
        <rect x="183" y="102" width="22" height="22" fill="none" stroke="#e0a020" stroke-width="3" rx="3"/>
        ${legendes([{ texte: "un morceau\nde peau", x: 205, y: 113 }])}`);
    }
    if (n === 1) {
      const t = TISSU;
      let c = "";
      t.cellules.forEach((k, i) => {
        if (i === t.choisie) return;
        c += `<polygon points="${pts(k.poly)}" fill="#f6e6ec" stroke="#b07a92" stroke-width="1.6" stroke-linejoin="round"/>
          <ellipse cx="${k.c[0].toFixed(1)}" cy="${k.c[1].toFixed(1)}" rx="${k.rx.toFixed(1)}" ry="${k.ry.toFixed(1)}" transform="rotate(${k.a} ${k.c[0].toFixed(1)} ${k.c[1].toFixed(1)})" fill="#8e6bb8"/>`;
      });
      const ch = t.cellules[t.choisie];
      c += `<polygon points="${pts(ch.poly)}" fill="#f6e6ec" stroke="#e0a020" stroke-width="3" stroke-linejoin="round"/>
        <ellipse cx="${ch.c[0].toFixed(1)}" cy="${ch.c[1].toFixed(1)}" rx="${ch.rx.toFixed(1)}" ry="${ch.ry.toFixed(1)}" transform="rotate(${ch.a} ${ch.c[0].toFixed(1)} ${ch.c[1].toFixed(1)})" fill="#8e6bb8"/>`;
      const yCell = ch.c[1] - 19;
      const leg = legendes([
        { texte: "une cellule", x: bordDroit(ch.poly, yCell) - 1, y: yCell },
        { texte: "son noyau", x: ch.c[0] + ch.rx * 0.4, y: ch.c[1] },
      ]);
      return `<div class="zoom-duo">${svg("Un tissu : des cellules jointives avec leur noyau", `<svg x="0" y="0" width="244" height="240" viewBox="0 0 244 240">${c}</svg><line x1="244" y1="0" x2="244" y2="240" stroke="#e6def3"/>${leg}`)}
        <figure class="zoom-photo"><img src="img/epiderme-grenouille.jpg" alt="Photographie au microscope : cellules de la peau d'une grenouille, collées les unes aux autres, chacune avec un noyau violet" width="960" height="541">
        <figcaption>Photographie au microscope : cellules de la peau d'une grenouille (colorées). Notre peau est organisée de la même façon. <small>Berkshire Community College, CC0, via Wikimedia Commons.</small></figcaption></figure></div>`;
    }
    if (n === 2) {
      // la cellule choisie dans le tissu, agrandie
      const ch = TISSU.cellules[TISSU.choisie];
      const xs = ch.poly.map((p) => p[0]), ys = ch.poly.map((p) => p[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      const e = Math.min(210 / (Math.max(...xs) - x0), 210 / (Math.max(...ys) - y0));
      const ox = 20 + (210 - (Math.max(...xs) - x0) * e) / 2, oy = 15 + (210 - (Math.max(...ys) - y0) * e) / 2;
      const poly = ch.poly.map((p) => [ox + (p[0] - x0) * e, oy + (p[1] - y0) * e]);
      const nx = ox + (ch.c[0] - x0) * e, ny = oy + (ch.c[1] - y0) * e;
      const nrx = ch.rx * e * 0.9, nry = ch.ry * e * 0.9;
      const haut = Math.min(...poly.map((p) => p[1])), bas = Math.max(...poly.map((p) => p[1]));
      const yMemb = haut + (ny - nry - haut) * 0.45;
      const yCyto = ny + nry + (bas - ny - nry) * 0.45;
      return svg("Une cellule : membrane, cytoplasme, noyau", `
        <polygon points="${pts(poly)}" fill="#f6e6ec" stroke="#b07a92" stroke-width="4" stroke-linejoin="round"/>
        <ellipse cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" rx="${nrx.toFixed(1)}" ry="${nry.toFixed(1)}" transform="rotate(${ch.a} ${nx.toFixed(1)} ${ny.toFixed(1)})" fill="#d9c8ec" stroke="#8e6bb8" stroke-width="3"/>
        ${legendes([
          { texte: "membrane", x: bordDroit(poly, yMemb) - 1, y: yMemb },
          { texte: "noyau", x: nx + nry * 0.3, y: ny },
          { texte: "cytoplasme", x: bordDroit(poly, yCyto) - 30, y: yCyto },
        ])}`);
    }
    if (n === 3) {
      let im = "";
      for (const p of DANS_NOYAU) {
        im += `<image href="${p.k.url}" x="${(p.x - p.k.w / 2).toFixed(1)}" y="${(p.y - p.k.h / 2).toFixed(1)}" width="${p.k.w}" height="${p.k.h}" transform="rotate(${p.deg.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)})"/>`;
      }
      // trait de rappel vers le chromosome le plus à droite
      const cible = DANS_NOYAU.reduce((a, b) => (b.x > a.x ? b : a));
      const yNoyau = NOYAU.cy + NOYAU.r * 0.72;
      return svg("Le noyau et ses chromosomes", `
        <circle cx="${NOYAU.cx}" cy="${NOYAU.cy}" r="${NOYAU.r}" fill="#e9dff5" stroke="#8e6bb8" stroke-width="3"/>${im}
        ${legendes([
          { texte: "chromosome", x: cible.x, y: cible.y },
          { texte: "noyau", x: NOYAU.cx + Math.sqrt(NOYAU.r ** 2 - (yNoyau - NOYAU.cy) ** 2) - 6, y: yNoyau },
        ])}
        <text x="${COL_LEGENDES}" y="30" class="leg-note">(${DANS_NOYAU.length} des</text><text x="${COL_LEGENDES}" y="45" class="leg-note">46 chromosomes)</text>`);
    }
    if (n === 4) {
      const k = chromo("9", { echelle: 1 });
      const e = 216 / k.h;
      const w = k.w * e, h = k.h * e;
      const x = 110 - w / 2, y = 12;
      const yG = y + (k.pad + LOCUS_ABO * k.L) * e;
      const yC = y + (k.pad + window.BANDES["9"].centro * k.L) * e;
      const bord = 110 + w * 0.32;
      return svg("Le chromosome 9 et le gène du groupe sanguin", `
        <image href="${k.url}" x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>
        <rect x="${(110 - w * 0.36).toFixed(1)}" y="${(yG - 1.5).toFixed(1)}" width="${(w * 0.72).toFixed(1)}" height="3" fill="#f4c430" stroke="#8a6500" stroke-width=".7"/>
        ${legendes([
          { texte: "bras court", x: bord, y: y + (k.pad + window.BANDES["9"].centro * k.L * 0.5) * e },
          { texte: "centromère", x: 110 + w * 0.12, y: yC },
          { texte: "bras long", x: bord, y: y + (k.pad + (0.5 + window.BANDES["9"].centro / 2) * k.L) * e },
          { texte: "gène du groupe\nsanguin (ABO)", x: 110 + w * 0.36, y: yG },
        ])}`);
    }
    if (n === 5) {
      // double hélice, gène surligné
      const X0 = 12, X1 = 236, YM = 120, A = 46;
      let b1 = "", b2 = "", barreaux = "";
      for (let x = X0; x <= X1; x += 2) {
        const s = Math.sin((x - X0) / 20);
        b1 += `${x === X0 ? "M" : "L"}${x},${(YM + A * s).toFixed(1)} `;
        b2 += `${x === X0 ? "M" : "L"}${x},${(YM - A * s).toFixed(1)} `;
        if (x % 10 === 0) barreaux += `<line x1="${x}" y1="${(YM + A * s).toFixed(1)}" x2="${x}" y2="${(YM - A * s).toFixed(1)}" stroke="#9bb0c4" stroke-width="3"/>`;
      }
      return svg("La double hélice d'ADN et un gène", `
        <rect x="100" y="${YM - A - 10}" width="86" height="${2 * A + 20}" rx="8" fill="#fff1b8" stroke="#e0a020" stroke-width="2"/>
        ${barreaux}<path d="${b1}" fill="none" stroke="#1d5f8a" stroke-width="4"/><path d="${b2}" fill="none" stroke="#1d5f8a" stroke-width="4"/>
        ${legendes([
          { texte: "ADN (double\nhélice)", x: X1 + 2, y: YM + A * Math.sin((X1 - X0) / 20) },
          { texte: "un gène", x: 186, y: YM + A + 4 },
        ])}`);
    }
    // n === 6 : nucléotides (échelle redressée)
    const COUL = { A: "#2a9d8f", T: "#e76f51", C: "#457b9d", G: "#d4a017" };
    const PAIRE = { A: "T", T: "A", C: "G", G: "C" };
    const haut = "ATGCCG".split("");
    const Y1 = 46, Y2 = 194, YM = (Y1 + Y2) / 2;
    let c = `<line x1="14" y1="${Y1}" x2="238" y2="${Y1}" stroke="#1d5f8a" stroke-width="6" stroke-linecap="round"/>
      <line x1="14" y1="${Y2}" x2="238" y2="${Y2}" stroke="#1d5f8a" stroke-width="6" stroke-linecap="round"/>`;
    haut.forEach((b, i) => {
      const x = 32 + i * 38, bas = PAIRE[b];
      c += `<rect x="${x - 11}" y="${Y1}" width="22" height="${YM - Y1 - 2}" rx="4" fill="${COUL[b]}"/>
        <rect x="${x - 11}" y="${YM + 2}" width="22" height="${Y2 - YM - 2}" rx="4" fill="${COUL[bas]}"/>
        <text x="${x}" y="${(Y1 + YM) / 2 + 6}" class="base">${b}</text><text x="${x}" y="${(YM + Y2) / 2 + 6}" class="base">${bas}</text>`;
    });
    // un nucléotide entouré : un morceau de montant + un demi-barreau
    const xn = 32 + 5 * 38;
    c += `<rect x="${xn - 18}" y="${Y1 - 9}" width="36" height="${YM - Y1 + 8}" rx="6" fill="none" stroke="#222" stroke-width="1.8" stroke-dasharray="5 4"/>`;
    return svg("Les nucléotides de l'ADN : A face à T, C face à G", c + legendes([
      { texte: "un brin d'ADN", x: 238, y: Y2 },
      { texte: "un nucléotide", x: xn + 18, y: Y1 + 16 },
      { texte: "un barreau :\n2 nucléotides\nface à face", x: xn + 11, y: YM + 30 },
    ]));
  }

  function expZoom(el) {
    let n = 0;
    el.innerHTML = `<div class="zoom">
      <div class="zoom-image" aria-live="polite" title="Clique pour zoomer"></div>
      <p class="zoom-texte"></p>
      <div class="zoom-commandes">
        <button class="btn" data-z="-1">− Dézoomer</button>
        <div class="zoom-points"></div>
        <button class="btn btn-principal" data-z="1">Zoomer +</button>
      </div>
      <p class="zoom-astuce">Astuce : clique sur l'image pour zoomer.</p></div>`;
    const points = $(".zoom-points", el);
    points.innerHTML = NIVEAUX.map((v, i) => `<button class="point" data-n="${i}" title="${v.nom}" aria-label="${v.nom}"></button>`).join("");
    function maj() {
      $(".zoom-image", el).innerHTML = `<div class="zoom-niveau">${n + 1} / ${NIVEAUX.length} · ${NIVEAUX[n].nom}</div>` + dessinNiveau(n);
      $(".zoom-image", el).classList.toggle("dernier", n === NIVEAUX.length - 1);
      $(".zoom-texte", el).innerHTML = NIVEAUX[n].texte;
      $$(".point", el).forEach((p, i) => p.classList.toggle("actif", i === n));
      $('[data-z="-1"]', el).disabled = n === 0;
      $('[data-z="1"]', el).disabled = n === NIVEAUX.length - 1;
    }
    el.addEventListener("click", (e) => {
      const z = e.target.closest("[data-z]");
      const p = e.target.closest("[data-n]");
      if (z) n = Math.max(0, Math.min(NIVEAUX.length - 1, n + +z.dataset.z));
      else if (p) n = +p.dataset.n;
      else if (e.target.closest(".zoom-svg, .zoom-photo") && n < NIVEAUX.length - 1) n++;
      else return;
      maj();
    });
    maj();
  }

  /* 2. Un caryotype complet, avec l'origine de chaque chromosome */
  function expCaryotype(el) {
    const rangees = [["1", "2", "3", "4", "5"], ["6", "7", "8", "9", "10", "11", "12"],
      ["13", "14", "15", "16", "17", "18"], ["19", "20", "21", "22", "XY"]];
    let sexuels = "XY";
    let origine = false;
    el.innerHTML = `<div class="commandes">
        <div class="bascule-mini" role="group" aria-label="Chromosomes sexuels">
          <button class="btn" data-s="XX">Caryotype XX</button><button class="btn" data-s="XY">Caryotype XY</button>
        </div>
        <label class="interrupteur"><input type="checkbox" id="k-origine"> Colorer selon l'origine (mère / père)</label>
      </div>
      <div class="k-mini"></div>
      <p class="k-info" aria-live="polite">Touche une paire pour en savoir plus.</p>`;
    function paire(c) {
      const t1 = origine ? MERE : null;
      const t2 = origine ? PERE : null;
      if (c === "XY") {
        const a = imgChromo("X", { echelle: 0.5, teinte: t1, realiste: true, graine: 3 });
        const b = imgChromo(sexuels === "XY" ? "Y" : "X", { echelle: 0.5, teinte: t2, realiste: true, graine: 4 });
        return `<button class="k-paire" data-c="${sexuels}">${a}${b}<span>${sexuels === "XY" ? "X Y" : "X X"}</span></button>`;
      }
      return `<button class="k-paire" data-c="${c}">${imgChromo(c, { echelle: 0.5, teinte: t1, realiste: true, graine: 3 })}${imgChromo(c, { echelle: 0.5, teinte: t2, realiste: true, graine: 4 })}<span>${c}</span></button>`;
    }
    function maj() {
      $(".k-mini", el).innerHTML = rangees.map((r) => `<div class="k-rangee">${r.map(paire).join("")}</div>`).join("")
        + (origine ? `<p class="legende"><i style="background:${COULEUR_MERE}"></i> venu de la mère (par l'ovule) <i style="background:${COULEUR_PERE}"></i> venu du père (par le spermatozoïde)</p>` : "");
      $$("[data-s]", el).forEach((b) => b.classList.toggle("btn-principal", b.dataset.s === sexuels));
    }
    el.addEventListener("click", (e) => {
      const s = e.target.closest("[data-s]");
      const p = e.target.closest(".k-paire");
      if (s) { sexuels = s.dataset.s; maj(); return; }
      if (!p) return;
      const c = p.dataset.c;
      $(".k-info", el).innerHTML = c === "XX" || c === "XY"
        ? `<b>Chromosomes sexuels (${c === "XX" ? "X et X" : "X et Y"}).</b> C'est la seule paire qui peut être formée de deux chromosomes différents : X est moyen, Y est petit. Un X vient de la mère ; l'autre chromosome (X ou Y) vient du père.`
        : `<b>Paire n° ${c}.</b> Les deux chromosomes ont la même taille, le même centromère et les mêmes bandes : ils portent les mêmes gènes, aux mêmes endroits. L'un vient de la mère, l'autre du père.`;
    });
    $("#k-origine", el).addEventListener("change", (e) => { origine = e.target.checked; maj(); });
    maj();
  }

  /* 3a. Gène ABO : choisir les allèles de chaque chromosome 9 */
  function expAlleles(el) {
    const al = ["A", "O"];
    let reponse = null; // groupe proposé par l'élève pour l'hématie affichée
    el.innerHTML = `<div class="allele-scene">
        <figure class="allele-cellule">
          <div class="noyau-allele">
            <div class="allele-col" data-i="0"></div>
            <div class="allele-col" data-i="1"></div>
          </div>
          <figcaption>Noyau d'une cellule : la paire de chromosomes 9.<br><small>(Les 44 autres chromosomes ne sont pas représentés.)</small></figcaption>
          <div class="allele-commandes">
            ${[0, 1].map((i) => `<div class="allele-choix" role="group" aria-label="Allèle sur le chromosome 9 venu ${i === 0 ? "de la mère" : "du père"}" data-i="${i}">
              <span style="color:${i === 0 ? COULEUR_MERE : COULEUR_PERE}">Allèle venu ${i === 0 ? "de la mère" : "du père"} :</span>
              ${["A", "B", "O"].map((a) => `<button class="btn" data-a="${a}">${a}</button>`).join("")}</div>`).join("")}
          </div>
        </figure>
        <div class="allele-fleche" aria-hidden="true">→</div>
        <div class="allele-resultat" aria-live="polite"></div>
      </div>`;

    function colonne(i) {
      const k = chromo("9", { echelle: 1.5, une: true, teinte: i === 0 ? MERE : PERE });
      const y = k.pad + LOCUS_ABO * k.L;
      return `<div class="allele-titre" style="color:${i === 0 ? COULEUR_MERE : COULEUR_PERE}">Chromosome 9<br><small>venu ${i === 0 ? "de la mère" : "du père"}</small></div>
        <div class="allele-chromo" style="height:${k.h}px">
          <img src="${k.url}" width="${k.w}" height="${k.h}" alt="Chromosome 9">
          <span class="locus" style="top:${y}px"></span>
          <span class="locus-etiquette" style="top:${y}px">allèle <b>${al[i]}</b></span>
        </div>`;
    }

    // hématie vue de face, avec ses marqueurs de surface (A : triangle, B : rond)
    function hematie(g) {
      const marqueurs = g === "AB" ? ["A", "B"] : g === "O" ? [] : [g];
      let m = "";
      const N = 14;
      for (let i = 0; i < N && marqueurs.length; i++) {
        const t = marqueurs[i % marqueurs.length];
        const a = (i / N) * Math.PI * 2;
        const deg = (a * 180) / Math.PI + 90;
        m += `<g transform="translate(${(110 + Math.cos(a) * 82).toFixed(1)},${(110 + Math.sin(a) * 82).toFixed(1)}) rotate(${deg.toFixed(1)})">
          <line x1="0" y1="0" x2="0" y2="-9" stroke="#333" stroke-width="2"/>
          ${t === "A" ? `<polygon points="0,-8 -7,-21 7,-21" fill="#f4c430" stroke="#6b5200" stroke-width="1.2"/>`
            : `<circle cx="0" cy="-15" r="6" fill="#3b8fd9" stroke="#123f6b" stroke-width="1.2"/>`}</g>`;
      }
      return `<svg viewBox="0 0 220 220" class="hematie" role="img" aria-label="Hématie ${marqueurs.length ? "portant les marqueurs " + marqueurs.join(" et ") : "sans marqueur A ni B"}">
        <defs><radialGradient id="hem-creux"><stop offset="0" stop-color="#e88a8a"/><stop offset=".45" stop-color="#d44c4c"/><stop offset="1" stop-color="#b52a2a"/></radialGradient></defs>
        <circle cx="110" cy="110" r="80" fill="url(#hem-creux)" stroke="#8f1f1f" stroke-width="2"/>${m}</svg>`;
    }

    function maj() {
      $$(".allele-col", el).forEach((c, i) => { c.innerHTML = colonne(i); });
      $$(".allele-choix", el).forEach((d, i) => $$("[data-a]", d).forEach((b) => b.classList.toggle("btn-principal", b.dataset.a === al[i])));
      const g = groupe(al[0], al[1]);
      let retour = "";
      if (reponse) {
        let pourquoi;
        if (g === "O") pourquoi = "Aucun des deux allèles O ne permet de fabriquer un marqueur A ou B.";
        else if (g === "AB") pourquoi = "Les allèles A et B s'expriment tous les deux : on voit les deux marqueurs.";
        else if (al[0] === al[1]) pourquoi = `Les deux allèles ${g} permettent de fabriquer le marqueur ${g}.`;
        else pourquoi = `L'allèle ${g} s'exprime, l'allèle O ne s'exprime pas : on dit que l'allèle O est <b>récessif</b>.`;
        retour = reponse === g
          ? `<p class="ok"><b>Oui !</b> Groupe <b>${g}</b>. ${pourquoi}</p>`
          : `<p class="ko">Pas tout à fait. Regarde bien les marqueurs à la surface : triangle = marqueur A, rond = marqueur B, aucun = groupe O.</p>`;
      }
      $(".allele-resultat", el).innerHTML = `<p class="petit">Les allèles déterminent les <b>marqueurs</b> à la surface des hématies (globules rouges).</p>
        ${hematie(g)}
        <p class="hem-legende"><span class="m-a"></span> marqueur A <span class="m-b"></span> marqueur B</p>
        <p><b>Quel est le groupe sanguin de cette personne ?</b></p>
        <div class="hem-choix">${["A", "B", "AB", "O"].map((x) => `<button class="btn ${reponse === x ? (x === g ? "juste" : "faux") : ""}" data-g="${x}">${x}</button>`).join("")}</div>
        <div class="hem-retour">${retour}</div>`;
    }
    el.addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]");
      const g = e.target.closest("[data-g]");
      if (a) { al[+a.closest(".allele-choix").dataset.i] = a.dataset.a; reponse = null; }
      else if (g) reponse = g.dataset.g;
      else return;
      maj();
    });
    maj();
  }

  /* 3b. L'environnement agit aussi : deux hortensias issus de boutures de la
   * même plante (mêmes gènes), chacun dans un sol différent. */
  function feuille(x, y, ang, L, W) {
    // feuille ovale dentelée, de la base (x, y) vers la pointe
    const g = [], d = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const larg = Math.sin(Math.PI * Math.pow(t, 0.8)) * W / 2 * (i % 2 && i > 1 && i < 15 ? 1.12 : 1);
      g.push([t * L, -larg]);
      d.push([t * L, larg]);
    }
    const pts = g.concat(d.reverse()).map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    return `<g transform="translate(${x},${y}) rotate(${ang})"><polygon points="${pts}" fill="#4f8f3a" stroke="#2f5e22" stroke-width="1.2" stroke-linejoin="round"/>
      <line x1="2" y1="0" x2="${L - 4}" y2="0" stroke="#2f5e22" stroke-width="1.2"/></g>`;
  }
  function dessinHortensia(graine) {
    const r = Chromosome.aleatoire(graine);
    const fleurs = [];
    for (let i = 0; i < 46; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 52;
      fleurs.push({ x: 100 + Math.cos(a) * d, y: 76 + Math.sin(a) * d * 0.82, rot: r() * 90, s: 0.85 + r() * 0.3, nuance: 0.82 + r() * 0.3 });
    }
    fleurs.sort((p, q) => p.y - q.y);
    const petales = fleurs.map((f) => `<g transform="translate(${f.x.toFixed(1)},${f.y.toFixed(1)}) rotate(${f.rot.toFixed(0)}) scale(${f.s.toFixed(2)})" data-nuance="${f.nuance.toFixed(2)}" class="fleuron">
        ${[0, 90, 180, 270].map((a) => `<ellipse cx="0" cy="-5.5" rx="4.6" ry="6" transform="rotate(${a})" class="petale" stroke="#0002" stroke-width=".6"/>`).join("")}
        <circle r="1.6" fill="#fffbe6"/></g>`).join("");
    return `<path d="M100 196 C100 170 98 150 100 120" stroke="#3f7a2e" stroke-width="6" fill="none"/>
      ${feuille(100, 172, 200, 58, 26)}${feuille(100, 164, -20, 60, 27)}${feuille(100, 148, 215, 46, 21)}${feuille(100, 142, -35, 48, 22)}
      ${petales}
      <path d="M58 196 L142 196 L134 246 L66 246 Z" fill="#b5653d" stroke="#7d3f22" stroke-width="2"/>
      <rect x="54" y="190" width="92" height="10" rx="3" fill="#c97448" stroke="#7d3f22" stroke-width="2"/>
      <ellipse cx="100" cy="191" rx="42" ry="4" class="terre"/>`;
  }
  function expHortensia(el) {
    const plantes = [{ v: 15 }, { v: 85 }];
    el.innerHTML = `<div class="hortensias">${plantes.map((p, i) => `<figure class="hortensia" data-i="${i}">
        <svg viewBox="0 0 200 250" class="hortensia-svg" role="img" aria-label="Hortensia en pot ${i + 1}">${dessinHortensia(5)}</svg>
        <figcaption><b>Hortensia ${i + 1}</b></figcaption>
        <label for="h-sol-${i}">Sol du pot ${i + 1}</label>
        <input id="h-sol-${i}" type="range" min="0" max="100" value="${p.v}">
        <div class="h-echelle"><span>très acide</span><span>calcaire</span></div>
        <p class="h-texte" aria-live="polite"></p></figure>`).join("")}</div>
      <p class="h-bilan" aria-live="polite"></p>`;
    const categorie = (v) => (v < 0.35 ? 0 : v > 0.65 ? 2 : 1);
    function maj() {
      const cats = $$(".hortensia", el).map((fig, i) => {
        const v = +$(`#h-sol-${i}`, el).value / 100;
        const c1 = [70, 110, 230], c2 = [236, 120, 170];
        const c = c1.map((x, k) => x + (c2[k] - x) * v);
        $$(".fleuron", fig).forEach((f) => {
          const n = +f.dataset.nuance;
          const col = `rgb(${c.map((x) => Math.min(255, Math.round(x * n))).join(",")})`;
          $$(".petale", f).forEach((p) => p.setAttribute("fill", col));
        });
        const terre = [[58, 42, 32], [176, 160, 132]].reduce((a, b) => a.map((x, k) => Math.round(x + (b[k] - x) * v)));
        $(".terre", fig).setAttribute("fill", `rgb(${terre.join(",")})`);
        const cat = categorie(v);
        $(".h-texte", fig).innerHTML = ["Sol acide : fleurs <b>bleues</b>.", "Sol intermédiaire : fleurs <b>violettes</b>.", "Sol calcaire : fleurs <b>roses</b>."][cat];
        return cat;
      });
      $(".h-bilan", el).innerHTML = cats[0] !== cats[1]
        ? "<b>Mêmes gènes, sols différents → couleurs différentes.</b> L'environnement agit sur le phénotype."
        : "Les deux sols se ressemblent : les fleurs ont la même couleur. Change le sol d'un des pots.";
    }
    el.addEventListener("input", maj);
    maj();
  }

  /* 4. Mutation : modifier une lettre de l'ADN */
  function expMutation(el) {
    const ORIGINE = "ATGGCCGTCACTGGAACGTTCAGG".split("");
    let seq = ORIGINE.slice();
    const suivante = { A: "T", T: "C", C: "G", G: "A" };
    el.innerHTML = `<p class="petit">Extrait simplifié d'un gène (séquence inventée pour l'exemple). <b>Touche une lettre</b> pour la changer, ou lance une mutation au hasard.</p>
      <div class="adn-ligne"><span class="adn-etiquette">Allèle de départ</span><div class="adn adn-origine"></div></div>
      <div class="adn-ligne"><span class="adn-etiquette">Ton ADN</span><div class="adn adn-modifie"></div></div>
      <div class="commandes"><button class="btn" id="m-hasard">Mutation au hasard</button><button class="btn" id="m-reset">Revenir au départ</button></div>
      <p class="m-bilan" aria-live="polite"></p>`;
    const lettre = (b, i, diff, cliquable) => cliquable
      ? `<button class="base base-${b}${diff ? " diff" : ""}" data-i="${i}" aria-label="Lettre ${i + 1} : ${b}">${b}</button>`
      : `<span class="base base-${b}">${b}</span>`;
    function maj() {
      $(".adn-origine", el).innerHTML = ORIGINE.map((b, i) => lettre(b, i, false, false)).join("");
      $(".adn-modifie", el).innerHTML = seq.map((b, i) => lettre(b, i, b !== ORIGINE[i], true)).join("");
      const n = seq.filter((b, i) => b !== ORIGINE[i]).length;
      $(".m-bilan", el).innerHTML = n === 0
        ? "Les deux séquences sont identiques : c'est le même allèle."
        : `<b>${n} mutation${n > 1 ? "s" : ""}</b> : la séquence du gène a changé. C'est un <b>nouvel allèle</b> de ce gène. Il pourra être transmis aux descendants s'il est présent dans les cellules qui forment les gamètes.`;
    }
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".base[data-i]");
      if (b) { const i = +b.dataset.i; seq[i] = suivante[seq[i]]; maj(); return; }
      if (e.target.id === "m-hasard") {
        const i = Math.floor(Math.random() * seq.length);
        const autres = ["A", "T", "C", "G"].filter((x) => x !== seq[i]);
        seq[i] = autres[Math.floor(Math.random() * 3)];
        maj();
        $(`.adn-modifie [data-i="${i}"]`, el).classList.add("flash");
      }
      if (e.target.id === "m-reset") { seq = ORIGINE.slice(); maj(); }
    });
    maj();
  }

  /* 5 et 6. Scène animée de division cellulaire (mitose ou méiose).
   * Dessin en SVG (viewBox 640 × 360) : la scène s'adapte à l'écran. */
  const PAIRES = ["1", "9", "21"]; // cellule simplifiée : 3 paires au lieu de 23
  const ECHELLE_SCENE = 0.55;

  function scene(el, type) {
    const W = 640;
    const H = 440;
    const etapes = type === "mitose" ? ETAPES_MITOSE : ETAPES_MEIOSE;
    let n = 0;
    let orientation = [0, 1, 0]; // méiose : côté où part le chromosome venu de la mère, pour chaque paire

    // éléments : pour chaque paire, chromosome de la mère (m) et du père (p), chacun en 2 chromatides
    const items = [];
    PAIRES.forEach((c, ip) => {
      ["m", "p"].forEach((o) => {
        const k = chromo(c, { une: true, echelle: ECHELLE_SCENE, teinte: o === "m" ? MERE : PERE });
        [0, 1].forEach((ct) => items.push({ c, ip, o, ct, k }));
      });
    });

    el.innerHTML = `<div class="scene">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${type === "mitose" ? "Mitose" : "Méiose"}">
        <g class="cellules">${[0, 1, 2, 3].map((i) => `<ellipse class="cel" data-c="${i}" cx="0" cy="0" rx="150" ry="140"/>`).join("")}</g>
        <g class="chromos">${items.map((it, i) => `<g class="chr" data-i="${i}"><image href="${it.k.url}" x="${-it.k.w / 2}" y="${-it.k.h / 2}" width="${it.k.w}" height="${it.k.h}"/></g>`).join("")}</g>
        <g class="comptes"></g>
      </svg>
      <div class="scene-texte" aria-live="polite"></div>
      <div class="scene-commandes">
        <button class="btn" data-e="-1">◀ Étape précédente</button>
        <span class="scene-num"></span>
        <button class="btn btn-principal" data-e="1">Étape suivante ▶</button>
        ${type === "meiose" ? '<button class="btn" data-rejouer>Rejouer (autre répartition)</button>' : ""}
      </div>
      <p class="legende"><i style="background:${COULEUR_MERE}"></i> chromosome venu de la mère <i style="background:${COULEUR_PERE}"></i> chromosome venu du père <small>· cellule simplifiée : 3 paires au lieu de 23</small></p>
    </div>`;

    const ecart = (it) => (it.k.w - 8) / 2 + 0.4; // décalage d'une chromatide pour former un chromosome dupliqué

    function poser(it, x, y, a, visible) {
      const g = $(`.chr[data-i="${items.indexOf(it)}"]`, el);
      g.style.transform = `translate(${x}px, ${y}px) rotate(${a}deg)`;
      g.style.opacity = visible ? 1 : 0;
    }
    function cellule(i, x, y, rx, ry, visible) {
      const e = $(`.cel[data-c="${i}"]`, el);
      e.style.transform = `translate(${x}px, ${y}px) scale(${rx / 150}, ${ry / 140})`;
      e.style.opacity = visible ? 1 : 0;
    }
    function comptes(liste) {
      $(".comptes", el).innerHTML = liste.map(([x, y, t]) => `<text x="${x}" y="${y}" class="compte">${t}</text>`).join("");
    }

    function maj() {
      const ctx = { W, H, items, poser, cellule, comptes, ecart, orientation };
      etapes[n].faire(ctx);
      $(".scene-texte", el).innerHTML = etapes[n].texte;
      $(".scene-num", el).textContent = `Étape ${n + 1} / ${etapes.length}`;
      $('[data-e="-1"]', el).disabled = n === 0;
      $('[data-e="1"]', el).disabled = n === etapes.length - 1;
    }
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-e]");
      if (b) { n = Math.max(0, Math.min(etapes.length - 1, n + +b.dataset.e)); maj(); }
      if (e.target.closest("[data-rejouer]")) {
        orientation = PAIRES.map(() => (Math.random() < 0.5 ? 0 : 1));
        n = Math.min(n, 1);
        maj();
      }
    });
    maj();
  }

  // positions de départ, éparpillées dans le noyau
  const EPARS = [[-70, -40, 20], [40, -55, -35], [-20, 45, 70], [75, 30, 10], [-80, 50, -15], [25, -5, 50]];
  function epars(ctx, cx, cy, dupliques, sauf) {
    ctx.items.forEach((it) => {
      if (sauf && sauf(it)) return;
      const k = it.ip * 2 + (it.o === "m" ? 0 : 1);
      const [dx, dy, a] = EPARS[k];
      const d = dupliques ? (it.ct ? 1 : -1) * ctx.ecart(it) : 0;
      const ar = (a * Math.PI) / 180;
      ctx.poser(it, cx + dx + d * Math.cos(ar), cy + dy + d * Math.sin(ar), a, dupliques || it.ct === 0);
    });
  }
  function rangee(ctx, liste, cx, cy, dupliques) {
    // liste de chromosomes posés côte à côte, centrés sur (cx, cy)
    const larg = liste.reduce((s, it) => s + it.k.w * (dupliques ? 2 : 1) + 10, -10);
    let x = cx - larg / 2;
    for (const it of liste) {
      const w = it.k.w * (dupliques ? 2 : 1);
      ctx.items.filter((j) => j.c === it.c && j.o === it.o).forEach((j) => {
        if (dupliques) ctx.poser(j, x + w / 2 + (j.ct ? 1 : -1) * ctx.ecart(j), cy, 0, true);
        else if (j.ct === it.ct) ctx.poser(j, x + w / 2, cy, 0, true);
      });
      x += w + 10;
    }
  }

  /* mitose : les 6 chromosomes couchés sur la ligne du milieu (horizontale),
   * leurs deux chromatides tournées l'une vers le haut, l'autre vers le bas.
   * y(it) donne la hauteur de chaque chromatide. */
  function plaque(ctx, y) {
    const liste = [];
    PAIRES.forEach((c) => ["m", "p"].forEach((o) => liste.push(ctx.items.filter((it) => it.c === c && it.o === o))));
    const total = liste.reduce((s, its) => s + its[0].k.h, 0) + 8 * (liste.length - 1);
    let x = 320 - total / 2;
    for (const its of liste) {
      const h = its[0].k.h;
      its.forEach((it) => ctx.poser(it, x + h / 2, y(it), 90, true));
      x += h + 8;
    }
  }

  /* anaphase : les chromatides, redressées, partent vers les pôles,
   * centromère en avant (celles du bas sont retournées). */
  function poles(ctx, yHaut, yBas) {
    const liste = [];
    PAIRES.forEach((c) => ["m", "p"].forEach((o) => liste.push(ctx.items.filter((it) => it.c === c && it.o === o))));
    const total = liste.reduce((s, its) => s + its[0].k.w, 0) + 10 * (liste.length - 1);
    let x = 320 - total / 2;
    for (const its of liste) {
      const w = its[0].k.w;
      its.forEach((it) => ctx.poser(it, x + w / 2, it.ct ? yBas : yHaut, it.ct ? 180 : 0, true));
      x += w + 10;
    }
  }

  const ETAPES_MITOSE = [
    {
      texte: "<b>1. Une cellule du corps.</b> Son noyau contient des paires de chromosomes : chaque chromosome est formé d'<b>une seule chromatide</b>. Ici : 6 chromosomes (en réalité 46).",
      faire(ctx) {
        ctx.cellule(0, 320, 210, 185, 190, true); [1, 2, 3].forEach((i) => ctx.cellule(i, 320, 210, 185, 190, false));
        epars(ctx, 320, 210, false);
        ctx.comptes([[320, 428, "6 chromosomes"]]);
      },
    },
    {
      texte: "<b>2. La copie de l'ADN.</b> Avant de se diviser, la cellule copie son ADN : chaque chromosome est maintenant formé de <b>deux chromatides identiques</b>, attachées au centromère.",
      faire(ctx) {
        ctx.cellule(0, 320, 210, 185, 190, true);
        epars(ctx, 320, 210, true);
        ctx.comptes([[320, 428, "6 chromosomes à 2 chromatides"]]);
      },
    },
    {
      texte: "<b>3. Les chromosomes s'alignent</b> au milieu de la cellule.",
      faire(ctx) {
        ctx.cellule(0, 320, 210, 250, 190, true);
        plaque(ctx, (it) => 210 + (it.ct ? 1 : -1) * ctx.ecart(it));
        ctx.comptes([]);
      },
    },
    {
      texte: "<b>4. Les chromatides se séparent.</b> Les deux chromatides de chaque chromosome partent chacune vers un pôle de la cellule (en haut et en bas).",
      faire(ctx) {
        ctx.cellule(0, 320, 210, 250, 205, true);
        poles(ctx, 112, 308);
        ctx.comptes([]);
      },
    },
    {
      texte: "<b>5. Deux cellules filles.</b> La cellule se coupe en deux. Chaque cellule fille reçoit <b>le même nombre de chromosomes</b> (6 ici, 46 en réalité) et <b>les mêmes informations génétiques</b> que la cellule de départ.",
      faire(ctx) {
        ctx.cellule(0, 320, 108, 190, 98, true); ctx.cellule(1, 320, 322, 190, 98, true);
        [2, 3].forEach((i) => ctx.cellule(i, 320, 210, 140, 135, false));
        poles(ctx, 108, 322);
        ctx.comptes([[580, 112, "6 chrom."], [580, 326, "6 chrom."]]);
      },
    },
  ];

  const ETAPES_MEIOSE = [
    {
      texte: "<b>1. Une cellule qui va former des gamètes</b> (dans un ovaire ou un testicule). Son ADN a déjà été copié : chaque chromosome a deux chromatides. Ici : 3 paires (en réalité 23 paires).",
      faire(ctx) {
        ctx.cellule(0, 320, 210, 185, 190, true); [1, 2, 3].forEach((i) => ctx.cellule(i, 320, 210, 185, 190, false));
        epars(ctx, 320, 210, true);
        ctx.comptes([[320, 428, "6 chromosomes (3 paires)"]]);
      },
    },
    {
      texte: "<b>2. Les chromosomes se rangent par paires</b> au milieu de la cellule : chaque chromosome est face à l'autre chromosome de sa paire.",
      faire(ctx) {
        ctx.cellule(0, 320, 210, 185, 190, true); [1, 2, 3].forEach((i) => ctx.cellule(i, 320, 210, 185, 190, false));
        PAIRES.forEach((c, ip) => {
          const y = [85, 220, 325][ip];
          ["m", "p"].forEach((o) => {
            const cote = (o === "m" ? 0 : 1) === ctx.orientation[ip] ? -1 : 1;
            ctx.items.filter((it) => it.c === c && it.o === o)
              .forEach((it) => ctx.poser(it, 320 + cote * 26 + (it.ct ? 1 : -1) * ctx.ecart(it), y, 0, true));
          });
        });
        ctx.comptes([]);
      },
    },
    {
      texte: "<b>3. Les chromosomes de chaque paire se séparent</b> : un part d'un côté, l'autre de l'autre côté. <b>Pour chaque paire, le côté est dû au hasard</b> (touche « Rejouer » pour voir une autre répartition).",
      faire(ctx) {
        ctx.cellule(0, 320, 210, 240, 195, true);
        PAIRES.forEach((c, ip) => {
          const y = [100, 220, 320][ip];
          ["m", "p"].forEach((o) => {
            const cote = (o === "m" ? 0 : 1) === ctx.orientation[ip] ? -1 : 1;
            ctx.items.filter((it) => it.c === c && it.o === o)
              .forEach((it) => ctx.poser(it, 320 + cote * 105 + (it.ct ? 1 : -1) * ctx.ecart(it), y, 0, true));
          });
        });
        ctx.comptes([]);
      },
    },
    {
      texte: "<b>4. Première division :</b> deux cellules, chacune avec <b>un seul chromosome de chaque paire</b> (3 ici, 23 en réalité).",
      faire(ctx) {
        ctx.cellule(0, 165, 210, 130, 180, true); ctx.cellule(1, 475, 210, 130, 180, true);
        ctx.cellule(2, 165, 210, 130, 140, false); ctx.cellule(3, 475, 210, 130, 140, false);
        PAIRES.forEach((c, ip) => {
          const y = [95, 220, 320][ip];
          ["m", "p"].forEach((o) => {
            const gauche = (o === "m" ? 0 : 1) === ctx.orientation[ip];
            ctx.items.filter((it) => it.c === c && it.o === o)
              .forEach((it) => ctx.poser(it, (gauche ? 165 : 475) + (it.ct ? 1 : -1) * ctx.ecart(it), y, 0, true));
          });
        });
        ctx.comptes([[165, 428, "3 chromosomes"], [475, 428, "3 chromosomes"]]);
      },
    },
    {
      texte: "<b>5. Deuxième division :</b> les deux chromatides de chaque chromosome se séparent. On obtient <b>4 gamètes</b>, chacun avec <b>un chromosome de chaque paire</b> : 3 ici, <b>23 chez l'être humain</b>.",
      faire(ctx) {
        const centres = [[90, 210], [245, 210], [395, 210], [550, 210]];
        centres.forEach(([x, y], i) => ctx.cellule(i, x, y, 72, 175, true));
        PAIRES.forEach((c, ip) => {
          const y = [100, 220, 318][ip];
          ["m", "p"].forEach((o) => {
            const gauche = (o === "m" ? 0 : 1) === ctx.orientation[ip];
            ctx.items.filter((it) => it.c === c && it.o === o)
              .forEach((it) => ctx.poser(it, centres[(gauche ? 0 : 2) + it.ct][0], y, 0, true));
          });
        });
        ctx.comptes(centres.map(([x]) => [x, 428, "3 chrom."]));
      },
    },
  ];

  /* 6b. Fabrique tes gamètes : un chromosome de chaque paire */
  function expGametes(el) {
    let choix = [null, null, null];
    const trouves = new Set();
    el.innerHTML = `<p class="consigne-exp">Pour <b>chaque paire</b>, touche le chromosome qui ira dans le gamète, puis fabrique le gamète. Combien de gamètes différents peux-tu obtenir ?</p>
      <div class="g-cellule"></div>
      <div class="commandes">
        <button class="btn btn-principal" id="g-fabriquer" disabled>Fabriquer le gamète</button>
        <button class="btn" id="g-hasard">Au hasard</button>
        <button class="btn" id="g-vider">Tout effacer</button>
      </div>
      <p class="g-compte" aria-live="polite"></p>
      <div class="g-collection"></div>`;
    function img(c, o) { return imgChromo(c, { echelle: 0.8, teinte: o === "m" ? MERE : PERE }); }
    function majCellule() {
      $(".g-cellule", el).innerHTML = PAIRES.map((c, ip) => `<div class="g-paire"><span class="g-num">Paire ${c}</span>
        ${["m", "p"].map((o) => `<button class="g-chromo${choix[ip] === o ? " choisi" : ""}" data-ip="${ip}" data-o="${o}" aria-pressed="${choix[ip] === o}" aria-label="Chromosome ${c} venu ${o === "m" ? "de la mère" : "du père"}">${img(c, o)}</button>`).join("")}
        </div>`).join("");
      $("#g-fabriquer", el).disabled = choix.includes(null);
    }
    function majCollection() {
      const n = trouves.size;
      $(".g-compte", el).innerHTML = n === 0 ? "" : n < 8
        ? `Gamètes différents trouvés : <b>${n} sur 8</b> possibles avec 3 paires.`
        : `<b>Bravo, tu as trouvé les 8 gamètes possibles !</b> Avec 3 paires : 2 × 2 × 2 = 8. Chez l'être humain, avec 23 paires : 2 × 2 × … × 2 (23 fois) = <b>8 388 608</b> gamètes différents possibles !`;
      $(".g-collection", el).innerHTML = [...trouves].map((s) => `<div class="g-gamete" title="Gamète">${s.split("").map((o, ip) => img(PAIRES[ip], o)).join("")}</div>`).join("");
    }
    function fabriquer() {
      trouves.add(choix.join(""));
      choix = [null, null, null];
      majCellule();
      majCollection();
    }
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".g-chromo");
      if (b) { choix[+b.dataset.ip] = b.dataset.o; majCellule(); return; }
      if (e.target.id === "g-fabriquer") fabriquer();
      if (e.target.id === "g-hasard") { choix = PAIRES.map(() => (Math.random() < 0.5 ? "m" : "p")); fabriquer(); }
      if (e.target.id === "g-vider") { trouves.clear(); choix = [null, null, null]; majCellule(); majCollection(); }
    });
    majCellule();
    majCollection();
  }

  /* 7. Fécondation : ovule + spermatozoïde → cellule-œuf */
  function expFecondation(el) {
    // chaque parent : chromosome 9 (allèles du gène ABO), chromosome 21, chromosomes sexuels
    const MERE_P = { abo: ["A", "O"], sexuels: ["X", "X"] };
    const PERE_P = { abo: ["B", "O"], sexuels: ["X", "Y"] };
    let ovule = null;
    let sperma = null;
    const bilan = { A: 0, B: 0, AB: 0, O: 0, XX: 0, XY: 0 };
    el.innerHTML = `<div class="f-parents">
        <div class="f-parent" data-p="m">
          <h4 style="color:${COULEUR_MERE}">La mère</h4>
          <p class="petit">Gène ABO : allèles <b>A</b> et <b>O</b> (groupe A) · chromosomes sexuels X et X</p>
          <div class="f-cellule f-mere"></div>
          <button class="btn" data-tirer="m">Former un ovule au hasard</button>
          <div class="f-gamete" id="f-ovule"></div>
        </div>
        <div class="f-signe" aria-hidden="true">+</div>
        <div class="f-parent" data-p="p">
          <h4 style="color:${COULEUR_PERE}">Le père</h4>
          <p class="petit">Gène ABO : allèles <b>B</b> et <b>O</b> (groupe B) · chromosomes sexuels X et Y</p>
          <div class="f-cellule f-pere"></div>
          <button class="btn" data-tirer="p">Former un spermatozoïde au hasard</button>
          <div class="f-gamete" id="f-sperma"></div>
        </div>
      </div>
      <div class="commandes centre"><button class="btn btn-principal" id="f-feconder" disabled>Fécondation !</button></div>
      <div class="f-oeuf" aria-live="polite"></div>
      <div class="f-bilan"></div>`;

    function petit(c, t, allele) {
      const k = chromo(c, { echelle: c === "21" || c === "Y" ? 1.1 : 0.8, teinte: t });
      const y = c === "9" ? k.pad + LOCUS_ABO * k.L : 0;
      return `<span class="f-ch" style="height:${k.h}px"><img src="${k.url}" width="${k.w}" height="${k.h}" alt="Chromosome ${c}">${allele ? `<span class="locus" style="top:${y}px"></span><span class="f-allele" style="top:${y}px">${allele}</span>` : ""}</span>`;
    }
    function cellParent(p, t) {
      return `<div class="f-ligne">${petit("9", t, p.abo[0])}${petit("9", t, p.abo[1])}</div>
        <div class="f-ligne">${petit("21", t)}${petit("21", t)}</div>
        <div class="f-ligne">${petit(p.sexuels[0], t)}${petit(p.sexuels[1], t)}</div>`;
    }
    $(".f-mere", el).innerHTML = cellParent(MERE_P, MERE);
    $(".f-pere", el).innerHTML = cellParent(PERE_P, PERE);

    function tirer(p) {
      return { abo: p.abo[Math.random() < 0.5 ? 0 : 1], sexuel: p.sexuels[Math.random() < 0.5 ? 0 : 1] };
    }
    function gamete(g, t) {
      return `<div class="f-g-cellule">${petit("9", t, g.abo)}${petit("21", t)}${petit(g.sexuel, t)}</div>
        <p class="petit">23 chromosomes (en réalité) · allèle <b>${g.abo}</b> · chromosome <b>${g.sexuel}</b></p>`;
    }
    function maj() {
      $("#f-ovule", el).innerHTML = ovule ? `<p class="f-g-titre">Ovule</p>` + gamete(ovule, MERE) : "";
      $("#f-sperma", el).innerHTML = sperma ? `<p class="f-g-titre">Spermatozoïde</p>` + gamete(sperma, PERE) : "";
      $("#f-feconder", el).disabled = !(ovule && sperma);
    }
    el.addEventListener("click", (e) => {
      const t = e.target.closest("[data-tirer]");
      if (t) {
        if (t.dataset.tirer === "m") ovule = tirer(MERE_P); else sperma = tirer(PERE_P);
        $(".f-oeuf", el).innerHTML = "";
        maj();
        return;
      }
      if (e.target.id === "f-feconder") {
        const g = groupe(ovule.abo, sperma.abo);
        const s = ovule.sexuel + sperma.sexuel;
        bilan[g]++;
        bilan[s]++;
        $(".f-oeuf", el).innerHTML = `<h4>La cellule-œuf</h4>
          <div class="f-cellule f-oeuf-cellule">
            <div class="f-ligne">${petit("9", MERE, ovule.abo)}${petit("9", PERE, sperma.abo)}</div>
            <div class="f-ligne">${petit("21", MERE)}${petit("21", PERE)}</div>
            <div class="f-ligne">${petit(ovule.sexuel, MERE)}${petit(sperma.sexuel, PERE)}</div>
          </div>
          <p>Les paires sont reformées : <b>23 + 23 = 46 chromosomes</b>. Allèles <b>${ovule.abo}</b> et <b>${sperma.abo}</b> → groupe sanguin <b>${g}</b> · chromosomes sexuels <b>${s}</b>.</p>
          <div class="commandes centre"><button class="btn btn-principal" id="f-encore">Une autre fécondation</button></div>`;
        const tot = bilan.A + bilan.B + bilan.AB + bilan.O;
        $(".f-bilan", el).innerHTML = `<p><b>${tot > 1 ? `Tes ${tot} fécondations` : "Ta première fécondation"}</b> avec les mêmes parents :</p>
          <div class="f-compteurs">${["A", "B", "AB", "O"].map((x) => `<span class="f-cpt"><b>${bilan[x]}</b> groupe ${x}</span>`).join("")}
          <span class="f-cpt"><b>${bilan.XX}</b> XX</span><span class="f-cpt"><b>${bilan.XY}</b> XY</span></div>
          ${tot >= 4 ? "<p class=\"petit\">Les mêmes parents peuvent avoir des enfants très différents : chaque fécondation réunit un ovule et un spermatozoïde pris au hasard.</p>" : ""}`;
      }
      if (e.target.id === "f-encore") {
        ovule = null; sperma = null;
        $(".f-oeuf", el).innerHTML = "";
        maj();
        el.querySelector('[data-tirer="m"]').focus();
      }
    });
    maj();
  }

  /* 8. Trisomie 21 : une erreur de répartition */
  function expTrisomie(el) {
    let erreur = false;
    let choisi = null;
    el.innerHTML = `<p class="consigne-exp">La paire de chromosomes 21 d'une cellule de la mère, au moment de la formation des ovules.</p>
      <div class="commandes"><div class="bascule-mini" role="group" aria-label="Répartition">
        <button class="btn" data-err="0">Répartition normale</button><button class="btn" data-err="1">Erreur de répartition</button>
      </div></div>
      <div class="t-meiose"></div>
      <p class="consigne-exp t-consigne">Touche un ovule pour le féconder par un spermatozoïde normal (un chromosome 21).</p>
      <div class="t-resultat" aria-live="polite"></div>`;
    const c21 = (t) => imgChromo("21", { echelle: 1, teinte: t });
    function maj() {
      $$("[data-err]", el).forEach((b) => b.classList.toggle("btn-principal", +b.dataset.err === +erreur));
      const ovules = erreur ? [2, 0] : [1, 1];
      $(".t-meiose", el).innerHTML = `<div class="t-cellule"><span class="t-titre">Cellule de départ</span><div>${c21(MERE)}${c21(MERE)}</div></div>
        <div class="t-fleche" aria-hidden="true">→</div>
        ${ovules.map((n, i) => `<button class="t-cellule t-ovule${choisi === i ? " choisi" : ""}" data-o="${i}"><span class="t-titre">Ovule ${i + 1}</span><div>${n ? Array(n).fill(c21(MERE)).join("") : '<em class="vide">aucun 21</em>'}</div><span class="petit">${22 + n} chromosomes</span></button>`).join("")}`;
      if (choisi === null) { $(".t-resultat", el).innerHTML = ""; return; }
      const n21 = ovules[choisi] + 1;
      const total = 44 + n21; // 22 paires d'autosomes hors 21 + chromosomes sexuels = 44
      let texte;
      if (n21 === 2) texte = "Cellule-œuf normale : <b>46 chromosomes</b>, deux chromosomes 21.";
      else if (n21 === 3) texte = "La cellule-œuf a <b>trois chromosomes 21</b> : <b>47 chromosomes</b>. C'est une <b>trisomie 21</b>. Comme toutes les cellules du corps viennent de la cellule-œuf par mitoses, toutes auront 47 chromosomes.";
      else texte = "La cellule-œuf n'a qu'<b>un seul chromosome 21</b> (45 chromosomes) : elle ne peut pas se développer.";
      $(".t-resultat", el).innerHTML = `<div class="t-oeuf"><span class="t-titre">Cellule-œuf : paire 21</span><div>${Array(ovules[choisi]).fill(c21(MERE)).join("")}${c21(PERE)}</div><span class="petit">${total} chromosomes</span></div><p>${texte}</p>`;
    }
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-err]");
      const o = e.target.closest("[data-o]");
      if (b) { erreur = b.dataset.err === "1"; choisi = null; maj(); }
      if (o) { choisi = +o.dataset.o; maj(); }
    });
    maj();
  }

  /* lien vers l'atelier caryotype, avec retour au parcours */
  function lienAtelier(activite, cas, retour) {
    const conf = { activite, cas, modeles: true, rotation: true, solution: true };
    const p = btoa(unescape(encodeURIComponent(JSON.stringify(conf)))).replace(/=+$/, "");
    return `index.html?p=${p}&retour=${encodeURIComponent("parcours.html#" + retour)}`;
  }

  /* ======================================================================
   * CONTENU DES CHAPITRES
   * ==================================================================== */
  const CHAPITRES = [
    {
      id: "ch1", titre: "Où se trouve l'information génétique ?",
      decouvre: `<p>Tu ressembles à tes parents, mais tu es unique. Les caractères qui se transmettent des parents aux enfants (groupe sanguin, forme du lobe de l'oreille…) sont des <b>caractères héréditaires</b>.</p>
        <p>L'information qui détermine ces caractères est l'<b>information génétique</b>. Mais où se trouve-t-elle dans notre corps ?</p>`,
      experiences: [{ titre: "Zoome de l'organisme jusqu'à l'ADN", faire: expZoom }],
      questions: [
        { q: "Où se trouvent les chromosomes ?", options: ["Dans le sang seulement", "Dans le noyau des cellules", "Dans le cerveau seulement"], bonne: 1,
          expl: "Les chromosomes sont dans le noyau de presque toutes les cellules du corps." },
        { q: "Un chromosome est formé…", options: ["d'une longue molécule d'ADN", "de plusieurs cellules", "de sang"], bonne: 0,
          expl: "Un chromosome est une très longue molécule d'ADN, plus ou moins enroulée." },
        { q: "Un gène, c'est…", options: ["une cellule", "une portion d'ADN qui porte une information", "un chromosome entier"], bonne: 1,
          expl: "Un gène est une portion d'un chromosome (donc d'ADN). Chaque chromosome porte de nombreux gènes." },
      ],
      retiens: `<p>Un organisme est formé de <b>cellules</b>. Le <b>noyau</b> de chaque cellule contient des <b>chromosomes</b>.</p>
        <p>Un chromosome est formé d'une longue molécule d'<b>ADN</b>. Une portion d'ADN qui détermine un caractère héréditaire est un <b>gène</b>.</p>
        <p>L'ADN est le support de l'<b>information génétique</b>.</p>`,
    },
    {
      id: "ch2", titre: "Les chromosomes et le caryotype",
      decouvre: `<p>Quand une cellule se divise, ses chromosomes deviennent courts et épais : on peut les voir au microscope et les photographier.</p>
        <p>On découpe alors chaque chromosome et on les range <b>par paires</b>, du plus grand au plus petit. Ce classement s'appelle un <b>caryotype</b>.</p>`,
      experiences: [{ titre: "Observe un caryotype humain", faire: expCaryotype,
        apres: `<a class="btn btn-principal" href="${lienAtelier("classer", ["xx", "xy"], "ch2")}">Je m'entraîne : je reconstitue un caryotype →</a>` }],
      questions: [
        { q: "Combien de chromosomes y a-t-il dans une cellule humaine ?", options: ["23", "46", "92"], bonne: 1,
          expl: "46 chromosomes, rangés en 23 paires." },
        { q: "Les deux chromosomes d'une même paire…", options: ["viennent tous les deux de la mère", "viennent l'un de la mère, l'autre du père", "viennent tous les deux du père"], bonne: 1,
          expl: "Pour chaque paire, un chromosome vient de l'ovule de la mère et l'autre du spermatozoïde du père." },
        { q: "Quelle paire peut être formée de deux chromosomes différents ?", options: ["La paire 1", "La paire 21", "La paire des chromosomes sexuels"], bonne: 2,
          expl: "Les chromosomes sexuels peuvent être X et X, ou X et Y." },
      ],
      retiens: `<p>Les cellules humaines contiennent <b>46 chromosomes</b>, groupés en <b>23 paires</b>. Le classement des chromosomes par paires est le <b>caryotype</b>.</p>
        <p>Les paires 1 à 22 sont les <b>autosomes</b>. La 23<sup>e</sup> paire est celle des <b>chromosomes sexuels</b> : <b>XX</b> ou <b>XY</b>.</p>
        <p>Dans chaque paire, un chromosome vient de la <b>mère</b> et l'autre du <b>père</b>. Les deux chromosomes d'une paire portent les <b>mêmes gènes</b>, aux mêmes endroits.</p>`,
    },
    {
      id: "ch3", titre: "Gènes et allèles",
      decouvre: `<p>Un gène occupe toujours <b>la même place</b> sur un chromosome donné. Par exemple, le gène qui détermine le <b>groupe sanguin</b> (A, B, AB ou O) se trouve sur le <b>chromosome 9</b>.</p>
        <p>Ce gène existe en plusieurs versions, qu'on appelle des <b>allèles</b> : l'allèle A, l'allèle B et l'allèle O. Comme nous avons <b>deux chromosomes 9</b>, nous avons <b>deux allèles</b> de ce gène : ils peuvent être identiques ou différents.</p>`,
      experiences: [
        { titre: "Choisis les allèles, observe l'hématie et déduis le groupe sanguin", faire: expAlleles },
        { titre: "Les gènes ne font pas tout : l'environnement compte aussi", faire: expHortensia,
          avant: "<p class=\"petit\">Ces deux hortensias sont des boutures de la même plante : ils ont <b>exactement les mêmes gènes</b>. Change le sol de chaque pot et compare la couleur des fleurs.</p>" },
      ],
      questions: [
        { q: "Combien d'allèles du gène du groupe sanguin possède chaque personne ?", options: ["Un seul", "Deux (un sur chaque chromosome 9)", "Trois : A, B et O"], bonne: 1,
          expl: "Deux allèles, un sur chacun des deux chromosomes 9." },
        { q: "Une personne a les allèles B et O. Quel est son groupe sanguin ?", options: ["B", "O", "BO"], bonne: 0,
          expl: "L'allèle O ne s'exprime pas en présence de B : le groupe est B." },
        { q: "Les caractères d'une personne (son phénotype) dépendent…", options: ["seulement de ses gènes", "seulement de son environnement", "de ses gènes et de son environnement"], bonne: 2,
          expl: "Les gènes jouent un rôle important, mais l'environnement (alimentation, soleil, sol pour une plante…) peut aussi modifier les caractères." },
      ],
      retiens: `<p>Un <b>gène</b> est une portion d'ADN située à un endroit précis d'un chromosome. Il existe souvent en plusieurs versions : les <b>allèles</b>.</p>
        <p>Chaque cellule possède <b>deux allèles</b> de chaque gène (un sur chaque chromosome de la paire), identiques ou différents. Si les deux allèles sont différents, il arrive qu'un seul s'exprime : l'autre est dit <b>récessif</b>.</p>
        <p>L'ensemble des caractères d'une personne est son <b>phénotype</b>. Il dépend de ses allèles et aussi de l'<b>environnement</b>.</p>`,
    },
    {
      id: "ch4", titre: "D'où viennent les allèles ? Les mutations",
      decouvre: `<p>L'information génétique est écrite dans l'ADN comme un texte, avec seulement 4 « lettres » : <b>A, T, C et G</b>. La suite des lettres d'un gène s'appelle sa <b>séquence</b>.</p>
        <p>Parfois, une lettre est changée, ajoutée ou perdue, le plus souvent lors de la copie de l'ADN : c'est une <b>mutation</b>. Elle se produit <b>au hasard</b> et rarement.</p>`,
      experiences: [{ titre: "Provoque une mutation", faire: expMutation,
        apres: "<p class=\"petit\">Exemple réel : l'allèle O du groupe sanguin diffère de l'allèle A par la perte d'une seule lettre.</p>" }],
      questions: [
        { q: "Une mutation, c'est…", options: ["une modification de la séquence de l'ADN", "un changement de groupe sanguin au cours de la vie", "une cellule qui se divise"], bonne: 0,
          expl: "Une mutation est une modification de la séquence de l'ADN." },
        { q: "Les mutations se produisent…", options: ["souvent et volontairement", "rarement et au hasard", "seulement chez les animaux"], bonne: 1,
          expl: "Les mutations sont rares et aléatoires ; elles touchent tous les êtres vivants." },
        { q: "Une mutation dans un gène peut produire…", options: ["un nouveau chromosome", "un nouvel allèle", "une nouvelle cellule-œuf"], bonne: 1,
          expl: "La séquence du gène change : c'est un nouvel allèle." },
      ],
      retiens: `<p>Une <b>mutation</b> est une modification de la séquence de l'ADN. Elle est <b>rare</b> et se produit <b>au hasard</b>, souvent lors de la copie de l'ADN.</p>
        <p>Une mutation dans un gène crée un <b>nouvel allèle</b>. Les mutations sont donc à l'origine de la <b>diversité des allèles</b>. Une mutation présente dans les cellules qui forment les gamètes peut être transmise aux enfants.</p>`,
    },
    {
      id: "ch5", titre: "La mitose : des cellules identiques",
      decouvre: `<p>Tu as commencé ta vie avec une seule cellule : la <b>cellule-œuf</b>. Aujourd'hui, ton corps en compte des milliards. Elles viennent toutes de la cellule-œuf, par des divisions successives.</p>
        <p>Comment chaque cellule garde-t-elle les mêmes 46 chromosomes ? Grâce à une division particulière : la <b>mitose</b>.</p>`,
      experiences: [{ titre: "Suis la mitose, étape par étape", faire: (el) => scene(el, "mitose") }],
      questions: [
        { q: "Avant la mitose, chaque chromosome…", options: ["disparaît", "est copié : il a alors deux chromatides identiques", "se coupe en deux morceaux différents"], bonne: 1,
          expl: "L'ADN est copié : chaque chromosome est formé de deux chromatides identiques." },
        { q: "Après une mitose, une cellule humaine donne…", options: ["2 cellules à 46 chromosomes", "2 cellules à 23 chromosomes", "4 cellules à 23 chromosomes"], bonne: 0,
          expl: "La mitose donne deux cellules filles identiques à la cellule de départ, avec 46 chromosomes." },
        { q: "Les deux cellules filles d'une mitose ont…", options: ["des informations génétiques différentes", "les mêmes informations génétiques"], bonne: 1,
          expl: "Elles reçoivent chacune une copie de chaque chromosome : leur information génétique est identique." },
      ],
      retiens: `<p>Avant de se diviser, une cellule <b>copie son ADN</b> : chaque chromosome est alors formé de <b>deux chromatides identiques</b>.</p>
        <p>Pendant la <b>mitose</b>, les chromatides se séparent : chaque cellule fille reçoit <b>une copie de chaque chromosome</b>. Les deux cellules filles ont <b>46 chromosomes</b> et la <b>même information génétique</b> que la cellule de départ.</p>
        <p>Toutes les cellules du corps ont donc la même information génétique que la cellule-œuf : c'est la <b>stabilité</b> de l'information génétique.</p>`,
    },
    {
      id: "ch6", titre: "La méiose : la formation des gamètes",
      decouvre: `<p>Les cellules reproductrices, ou <b>gamètes</b>, sont les <b>ovules</b> (fabriqués dans les ovaires) et les <b>spermatozoïdes</b> (fabriqués dans les testicules), à partir de la puberté.</p>
        <p>Ils sont formés par une division particulière : la <b>méiose</b>. Un gamète ne contient que <b>23 chromosomes</b> : <b>un seul chromosome de chaque paire</b>.</p>`,
      experiences: [
        { titre: "Suis la méiose, étape par étape", faire: (el) => scene(el, "meiose") },
        { titre: "Fabrique tes gamètes", faire: expGametes },
      ],
      questions: [
        { q: "Combien de chromosomes contient un gamète humain ?", options: ["46", "23", "22"], bonne: 1,
          expl: "23 chromosomes : un seul de chaque paire." },
        { q: "Dans un gamète, on trouve…", options: ["les deux chromosomes de chaque paire", "un seul chromosome de chaque paire", "seulement les chromosomes sexuels"], bonne: 1,
          expl: "La méiose sépare les chromosomes de chaque paire." },
        { q: "Pourquoi les gamètes d'une même personne sont-ils différents les uns des autres ?", options: ["Parce que, pour chaque paire, le chromosome qui va dans le gamète est dû au hasard", "Parce qu'ils sont fabriqués par mitose", "Parce que chaque gamète a 46 chromosomes"], bonne: 0,
          expl: "Pour chaque paire, le hasard décide quel chromosome part dans le gamète : avec 23 paires, plus de 8 millions de combinaisons." },
      ],
      retiens: `<p>Les gamètes sont formés par <b>méiose</b>, dans les ovaires et les testicules.</p>
        <p>Pendant la méiose, <b>les chromosomes de chaque paire se séparent</b> : chaque gamète reçoit <b>un seul chromosome de chaque paire</b>, soit <b>23 chromosomes</b>.</p>
        <p>Pour chaque paire, le chromosome qui part dans le gamète est dû au <b>hasard</b>. Une même personne peut donc fabriquer plus de <b>8 millions</b> de gamètes différents : c'est le <b>brassage</b> des chromosomes.</p>`,
    },
    {
      id: "ch7", titre: "La fécondation : un individu unique",
      decouvre: `<p>La <b>fécondation</b> est la rencontre d'un ovule et d'un spermatozoïde. Leurs noyaux s'unissent : on obtient une <b>cellule-œuf</b>.</p>
        <p>L'ovule apporte 23 chromosomes, le spermatozoïde aussi : la cellule-œuf a <b>46 chromosomes</b>, et les paires sont reformées.</p>`,
      experiences: [{ titre: "Réalise des fécondations", faire: expFecondation,
        avant: "<p class=\"petit\">On suit 3 paires : la paire 9 (gène du groupe sanguin), la paire 21 et les chromosomes sexuels.</p>" }],
      questions: [
        { q: "Combien de chromosomes a la cellule-œuf humaine ?", options: ["23", "46", "92"], bonne: 1,
          expl: "23 (ovule) + 23 (spermatozoïde) = 46." },
        { q: "Une mère de groupe A (allèles A et O) et un père de groupe B (allèles B et O) peuvent-ils avoir un enfant de groupe O ?", options: ["Non, c'est impossible", "Oui, si l'ovule et le spermatozoïde portent tous les deux l'allèle O"], bonne: 1,
          expl: "Si chacun transmet son allèle O, l'enfant a les allèles O et O : groupe O." },
        { q: "Pourquoi deux enfants des mêmes parents sont-ils différents (sauf les vrais jumeaux) ?", options: ["Parce que chaque enfant vient d'un ovule et d'un spermatozoïde différents, réunis au hasard", "Parce qu'ils n'ont pas le même nombre de chromosomes"], bonne: 0,
          expl: "Le brassage de la méiose et le hasard de la fécondation rendent chaque individu unique." },
      ],
      retiens: `<p>Lors de la <b>fécondation</b>, un ovule (23 chromosomes) et un spermatozoïde (23 chromosomes) s'unissent : la <b>cellule-œuf</b> a <b>46 chromosomes</b>. Les paires sont reformées : un chromosome de chaque paire vient de la mère, l'autre du père.</p>
        <p>Le gamète qui participe à la fécondation est dû au <b>hasard</b>. Avec le brassage de la méiose, cela donne une nouvelle combinaison d'allèles : chaque individu est <b>génétiquement unique</b> (sauf les vrais jumeaux, issus de la même cellule-œuf).</p>
        <p>Méiose et fécondation <b>maintiennent le nombre de chromosomes</b> (46) d'une génération à l'autre, tout en assurant la <b>diversité génétique</b>.</p>`,
    },
    {
      id: "ch8", titre: "Une anomalie : la trisomie 21",
      decouvre: `<p>Parfois, pendant la méiose, <b>les deux chromosomes d'une paire ne se séparent pas</b>. Un gamète reçoit alors un chromosome en trop (24 chromosomes) et un autre un chromosome en moins (22).</p>
        <p>Si un gamète à 24 chromosomes participe à la fécondation, la cellule-œuf a <b>47 chromosomes</b>.</p>`,
      experiences: [{ titre: "Provoque une erreur de répartition", faire: expTrisomie,
        apres: `<a class="btn btn-principal" href="${lienAtelier("anomalie", ["xx", "xy", "t21f", "t21m"], "ch8")}">Je m'entraîne : je recherche une anomalie dans un caryotype →</a>` }],
      questions: [
        { q: "Combien de chromosomes 21 possède une personne porteuse de trisomie 21 ?", options: ["1", "2", "3"], bonne: 2,
          expl: "Trois chromosomes 21 au lieu de deux : 47 chromosomes en tout." },
        { q: "La trisomie 21 vient le plus souvent…", options: ["d'une erreur de répartition des chromosomes pendant la formation des gamètes", "d'une maladie attrapée pendant l'enfance", "d'une mutation dans le groupe sanguin"], bonne: 0,
          expl: "C'est une erreur de répartition des chromosomes lors de la méiose, le plus souvent dans l'ovule." },
        { q: "Dans le corps d'une personne porteuse de trisomie 21, combien de cellules ont 47 chromosomes ?", options: ["Seulement les cellules du cerveau", "Toutes les cellules, car elles viennent de la cellule-œuf par mitoses"], bonne: 1,
          expl: "La cellule-œuf avait 47 chromosomes : les mitoses copient fidèlement ces 47 chromosomes dans toutes les cellules." },
      ],
      retiens: `<p>Une erreur dans la répartition des chromosomes pendant la méiose peut produire un gamète avec un chromosome en trop. Après la fécondation, la cellule-œuf, puis toutes les cellules du corps, ont <b>47 chromosomes</b>.</p>
        <p>Avec trois chromosomes 21, c'est la <b>trisomie 21</b>. Elle se repère sur le <b>caryotype</b>. Elle se produit par hasard ; son risque augmente avec l'âge de la mère. Elle entraîne notamment des particularités physiques et une déficience intellectuelle d'importance variable.</p>`,
    },
  ];

  /* ======================================================================
   * TRACE ÉCRITE
   * ==================================================================== */
  const LEXIQUE = [
    ["ADN", "Molécule qui forme les chromosomes et qui porte l'information génétique."],
    ["Allèle", "Version d'un gène. Exemple : les allèles A, B et O du gène du groupe sanguin."],
    ["Autosomes", "Les 22 paires de chromosomes numérotées de 1 à 22 : tous les chromosomes sauf les chromosomes sexuels."],
    ["Brassage", "Mélange des chromosomes, dû au hasard, lors de la méiose et de la fécondation."],
    ["Caryotype", "Photographie des chromosomes d'une cellule, classés par paires, du plus grand au plus petit."],
    ["Cellule-œuf", "Première cellule d'un individu, formée par la fécondation."],
    ["Chromatide", "Chacune des deux copies identiques d'un chromosome après la copie de l'ADN."],
    ["Chromosome", "Élément du noyau formé d'une longue molécule d'ADN ; il porte de nombreux gènes."],
    ["Chromosomes sexuels", "La 23e paire : XX ou XY."],
    ["Fécondation", "Union d'un ovule et d'un spermatozoïde qui donne une cellule-œuf."],
    ["Gamète", "Cellule reproductrice (ovule ou spermatozoïde) ; elle contient 23 chromosomes."],
    ["Gène", "Portion d'ADN, à un endroit précis d'un chromosome, qui détermine un caractère héréditaire."],
    ["Méiose", "Division qui forme les gamètes : chaque gamète reçoit un seul chromosome de chaque paire."],
    ["Mitose", "Division qui donne deux cellules filles identiques à la cellule de départ."],
    ["Mutation", "Modification rare et aléatoire de la séquence de l'ADN ; elle peut créer un nouvel allèle."],
    ["Phénotype", "Ensemble des caractères observables d'un individu."],
    ["Trisomie", "Présence de trois chromosomes au lieu de deux pour une paire."],
  ];

  function schemaCycle() {
    return `<svg viewBox="0 0 640 300" class="cycle" role="img" aria-label="Schéma bilan : de la cellule-œuf aux gamètes et à la fécondation">
      <defs><marker id="fl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#1d5f8a"/></marker></defs>
      <g class="cy-boite"><rect x="250" y="10" width="140" height="56" rx="12"/><text x="320" y="34">Cellule-œuf</text><text x="320" y="54" class="cy-n">46 chromosomes</text></g>
      <g class="cy-boite"><rect x="470" y="122" width="160" height="56" rx="12"/><text x="550" y="146">Individu</text><text x="550" y="166" class="cy-n">cellules à 46 chromosomes</text></g>
      <g class="cy-boite"><rect x="250" y="234" width="140" height="56" rx="12"/><text x="320" y="258">Gamètes</text><text x="320" y="278" class="cy-n">23 chromosomes</text></g>
      <g class="cy-boite"><rect x="4" y="122" width="176" height="56" rx="12"/><text x="92" y="146">Ovule + spermatozoïde</text><text x="92" y="166" class="cy-n">23 + 23</text></g>
      <path d="M390,40 Q520,50 545,118" class="cy-fl" marker-end="url(#fl)"/><text x="520" y="30" class="cy-et">mitoses</text>
      <path d="M545,182 Q520,250 394,262" class="cy-fl" marker-end="url(#fl)"/><text x="520" y="292" class="cy-et">méiose</text>
      <path d="M250,262 Q120,250 95,184" class="cy-fl" marker-end="url(#fl)"/><text x="120" y="292" class="cy-et">rencontre</text>
      <path d="M95,118 Q120,50 246,40" class="cy-fl" marker-end="url(#fl)"/><text x="120" y="30" class="cy-et">fécondation</text>
      <text x="320" y="150" class="cy-centre">Stabilité : 46 chromosomes</text><text x="320" y="172" class="cy-centre">Diversité : brassage et hasard</text>
    </svg>`;
  }

  function rendreTrace(main) {
    main.innerHTML = `<article class="trace">
      <div class="trace-entete">
        <p class="chap-num">Trace écrite</p>
        <h1>La génétique : stabilité et diversité des êtres humains</h1>
        <p class="petit">À lire, à recopier ou à imprimer. Elle reprend tout le parcours.</p>
        <div class="commandes"><button class="btn btn-principal" id="t-imprimer">Imprimer / PDF</button></div>
      </div>

      <h2>1. Où se trouve l'information génétique ?</h2>
      <p>Notre organisme est formé de milliards de <b>cellules</b>. Le <b>noyau</b> de chaque cellule contient des <b>chromosomes</b>. Chaque chromosome est formé d'une très longue molécule d'<b>ADN</b>. L'ADN est le support de l'<b>information génétique</b> : il détermine nos <b>caractères héréditaires</b>, ceux qui se transmettent des parents aux enfants.</p>

      <h2>2. Le caryotype : 46 chromosomes, 23 paires</h2>
      <p>Pour étudier les chromosomes, on les photographie dans une cellule en division, puis on les classe par paires, du plus grand au plus petit : c'est le <b>caryotype</b>.</p>
      <p>Une cellule humaine contient <b>46 chromosomes</b>, groupés en <b>23 paires</b> : 22 paires d'<b>autosomes</b> (numérotées de 1 à 22) et une paire de <b>chromosomes sexuels</b>, <b>XX</b> ou <b>XY</b>. Dans chaque paire, un chromosome vient de la <b>mère</b> et l'autre du <b>père</b>.</p>

      <h2>3. Gènes, allèles et phénotype</h2>
      <p>Un <b>gène</b> est une portion d'ADN située à un endroit précis d'un chromosome ; il détermine un caractère. Par exemple, le gène du groupe sanguin est sur le chromosome 9.</p>
      <p>Un gène existe souvent en plusieurs versions : les <b>allèles</b> (A, B et O pour le groupe sanguin). Chacun de nous possède <b>deux allèles</b> de chaque gène, un sur chaque chromosome de la paire. Ils peuvent être identiques ou différents ; parfois un seul s'exprime (l'autre est <b>récessif</b>). Ainsi, une personne qui a les allèles A et O est de groupe A.</p>
      <p>L'ensemble des caractères d'un individu est son <b>phénotype</b>. Il dépend de ses allèles, mais aussi de son <b>environnement</b>.</p>

      <h2>4. Les mutations, origine des allèles</h2>
      <p>L'information génétique est écrite dans l'ADN avec quatre « lettres » : A, T, C et G. Une <b>mutation</b> est une modification de cette séquence. Elle est <b>rare</b> et se produit <b>au hasard</b>, souvent lors de la copie de l'ADN. Une mutation dans un gène crée un <b>nouvel allèle</b> : les mutations sont à l'origine de la diversité des allèles.</p>

      <h2>5. La mitose : la stabilité de l'information génétique</h2>
      <p>Toutes nos cellules viennent de la <b>cellule-œuf</b> par des divisions successives : les <b>mitoses</b>. Avant chaque mitose, l'ADN est copié : chaque chromosome est alors formé de <b>deux chromatides identiques</b>. Pendant la mitose, les chromatides se séparent : chacune des deux cellules filles reçoit <b>46 chromosomes</b> et la <b>même information génétique</b> que la cellule de départ.</p>

      <h2>6. La méiose : la formation des gamètes</h2>
      <p>Les <b>gamètes</b> (ovules et spermatozoïdes) sont formés dans les ovaires et les testicules par la <b>méiose</b>. Pendant la méiose, <b>les chromosomes de chaque paire se séparent</b> : chaque gamète reçoit <b>un seul chromosome de chaque paire</b>, soit <b>23 chromosomes</b>. Pour chaque paire, le chromosome qui part dans le gamète est dû au <b>hasard</b> : une même personne peut produire plus de <b>8 millions</b> de gamètes différents. C'est le <b>brassage</b> des chromosomes.</p>

      <h2>7. La fécondation : un individu unique</h2>
      <p>Lors de la <b>fécondation</b>, un ovule et un spermatozoïde s'unissent : la <b>cellule-œuf</b> obtenue a <b>23 + 23 = 46 chromosomes</b>, et les paires sont reformées. Les gamètes qui se rencontrent sont dus au hasard. Grâce au brassage de la méiose et au hasard de la fécondation, chaque individu possède une combinaison d'allèles nouvelle : il est <b>génétiquement unique</b> (sauf les vrais jumeaux).</p>
      <p><b>Bilan :</b> la méiose et la fécondation <b>maintiennent le nombre de chromosomes</b> d'une génération à l'autre (stabilité) tout en créant de la <b>diversité génétique</b>.</p>
      <figure>${schemaCycle()}<figcaption>Schéma bilan : la transmission des chromosomes d'une génération à l'autre.</figcaption></figure>

      <h2>8. Une anomalie du nombre de chromosomes : la trisomie 21</h2>
      <p>Si, pendant la méiose, les deux chromosomes d'une paire ne se séparent pas, un gamète peut recevoir un chromosome en trop. Après la fécondation, la cellule-œuf, puis toutes les cellules du corps, ont <b>47 chromosomes</b>. Avec trois chromosomes 21, c'est la <b>trisomie 21</b>, que l'on repère sur le caryotype.</p>

      <h2>Lexique</h2>
      <dl class="lexique">${LEXIQUE.map(([m, d]) => `<dt>${m}</dt><dd>${d}</dd>`).join("")}</dl>
    </article>`;
    $("#t-imprimer", main).addEventListener("click", () => window.print());
  }

  /* ======================================================================
   * AFFICHAGE D'UN CHAPITRE
   * ==================================================================== */
  function rendreQuestions(zone, ch) {
    const reussies = new Set();
    zone.innerHTML = ch.questions.map((q, i) => `<div class="qcm" data-q="${i}">
      <p class="qcm-q"><span class="qcm-num">${i + 1}</span>${q.q}</p>
      <div class="qcm-options">${q.options.map((o, j) => `<button class="qcm-opt" data-j="${j}">${o}</button>`).join("")}</div>
      <p class="qcm-retour" aria-live="polite"></p></div>`).join("");
    zone.addEventListener("click", (e) => {
      const b = e.target.closest(".qcm-opt");
      if (!b) return;
      const bloc = b.closest(".qcm");
      const i = +bloc.dataset.q;
      const q = ch.questions[i];
      const ok = +b.dataset.j === q.bonne;
      $$(".qcm-opt", bloc).forEach((x) => x.classList.remove("juste", "faux"));
      b.classList.add(ok ? "juste" : "faux");
      const retour = $(".qcm-retour", bloc);
      retour.className = "qcm-retour " + (ok ? "ok" : "ko");
      retour.innerHTML = ok ? `<b>Oui !</b> ${q.expl}` : "Pas tout à fait. Relis « Je découvre » ou refais l'expérience, puis essaie une autre réponse.";
      if (ok) reussies.add(i);
      if (reussies.size === ch.questions.length && !progres[ch.id]) {
        progres[ch.id] = true;
        memoire.ecrire(progres);
        majSommaire();
        $(".fin-chapitre").classList.add("visible");
      }
    });
  }

  function rendreChapitre(main, idx) {
    const ch = CHAPITRES[idx];
    const suivant = CHAPITRES[idx + 1];
    main.innerHTML = `<article class="chap">
      <p class="chap-num">Chapitre ${idx + 1} sur ${CHAPITRES.length}</p>
      <h1>${ch.titre}</h1>

      <section class="bloc bloc-decouvre"><h2><span class="pastille">1</span>Je découvre</h2>${ch.decouvre}</section>

      <section class="bloc bloc-experimente"><h2><span class="pastille">2</span>J'expérimente</h2>
        ${ch.experiences.map((x, i) => `<div class="experience"><h3>${x.titre}</h3>${x.avant || ""}<div class="exp" data-x="${i}"></div>${x.apres ? `<div class="exp-apres">${x.apres}</div>` : ""}</div>`).join("")}
      </section>

      <section class="bloc bloc-verifie"><h2><span class="pastille">3</span>Je vérifie</h2><div class="questions"></div></section>

      <section class="bloc bloc-retiens"><h2><span class="pastille">4</span>Je retiens</h2><div class="retiens"></div></section>

      <div class="fin-chapitre${progres[ch.id] ? " visible" : ""}"><p>Chapitre réussi ✓</p></div>
      <nav class="chap-nav">
        ${idx > 0 ? `<a class="btn" href="#${CHAPITRES[idx - 1].id}">← Chapitre précédent</a>` : "<span></span>"}
        <a class="btn btn-principal" href="#${suivant ? suivant.id : "trace"}">${suivant ? "Chapitre suivant →" : "La trace écrite →"}</a>
      </nav>
    </article>`;
    ch.experiences.forEach((x, i) => x.faire($(`.exp[data-x="${i}"]`, main)));
    rendreQuestions($(".questions", main), ch);
    rendreRetiens($(".retiens", main), ch);
  }

  /* « Je retiens » : le bilan est à compléter en glissant les mots en gras
   * (ou en touchant un mot puis un trou). Un mot faux revient à sa place. */
  function rendreRetiens(zone, ch) {
    const modele = document.createElement("div");
    modele.innerHTML = ch.retiens;
    const mots = [];
    $$("b", modele).forEach((b) => {
      const trou = document.createElement("span");
      trou.className = "trou";
      trou.dataset.mot = b.textContent;
      trou.setAttribute("role", "button");
      trou.setAttribute("aria-label", "Trou à compléter");
      trou.tabIndex = 0;
      b.replaceWith(trou);
      mots.push(b.textContent);
    });
    // banque de mots mélangée (graine fixe : même ordre à chaque visite)
    const r = Chromosome.aleatoire(mots.length * 31 + ch.id.length);
    const banque = mots.slice();
    for (let i = banque.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [banque[i], banque[j]] = [banque[j], banque[i]]; }
    zone.innerHTML = `<p class="retiens-consigne">Complète le bilan : glisse chaque mot dans le bon trou (ou touche un mot, puis un trou).</p>
      <div class="banque">${banque.map((m) => `<button class="mot" type="button">${m}</button>`).join("")}</div>
      <div class="retiens-texte"></div>
      <p class="retiens-fin" aria-live="polite"></p>
      <button class="lien retiens-solution" type="button">Afficher le bilan complet</button>`;
    $(".retiens-texte", zone).append(...modele.childNodes);
    let choisi = null;

    function choisir(m) {
      $$(".mot.choisi", zone).forEach((x) => x.classList.remove("choisi"));
      choisi = m;
      if (m) m.classList.add("choisi");
    }
    function remplir(trou, mot) {
      trou.textContent = trou.dataset.mot;
      trou.classList.add("rempli");
      trou.removeAttribute("tabindex");
      trou.removeAttribute("role");
      if (mot) mot.remove();
    }
    function terminer() {
      if ($$(".trou:not(.rempli)", zone).length) return;
      $(".banque", zone).remove();
      $(".retiens-consigne", zone).remove();
      $(".retiens-solution", zone).remove();
      $(".retiens-fin", zone).textContent = "Bilan complet ✓ Tu peux le recopier dans ton cahier.";
    }
    function essayer(trou, mot) {
      if (!trou || !mot || trou.classList.contains("rempli")) return;
      if (mot.textContent === trou.dataset.mot) {
        remplir(trou, mot);
        choisir(null);
        terminer();
      } else {
        trou.classList.add("erreur");
        mot.classList.add("erreur");
        setTimeout(() => { trou.classList.remove("erreur"); mot.classList.remove("erreur"); }, 500);
      }
    }

    // glisser-déposer (souris et doigt)
    let glisse = null;
    zone.addEventListener("pointerdown", (e) => {
      const m = e.target.closest(".mot");
      if (!m) return;
      e.preventDefault();
      glisse = { m, x0: e.clientX, y0: e.clientY, fantome: null };
      try { m.setPointerCapture(e.pointerId); } catch (err) { /* pointeur déjà relâché */ }
    });
    zone.addEventListener("pointermove", (e) => {
      if (!glisse) return;
      if (!glisse.fantome && Math.hypot(e.clientX - glisse.x0, e.clientY - glisse.y0) > 6) {
        glisse.fantome = glisse.m.cloneNode(true);
        glisse.fantome.classList.add("fantome");
        document.body.append(glisse.fantome);
        glisse.m.classList.add("en-cours");
      }
      if (glisse.fantome) {
        glisse.fantome.style.left = e.clientX + "px";
        glisse.fantome.style.top = e.clientY + "px";
        $$(".trou.survol", zone).forEach((t) => t.classList.remove("survol"));
        const sous = document.elementFromPoint(e.clientX, e.clientY);
        const t = sous && sous.closest(".trou:not(.rempli)");
        if (t) t.classList.add("survol");
      }
    });
    const lacher = (e) => {
      if (!glisse) return;
      const { m, fantome } = glisse;
      glisse = null;
      if (fantome) {
        fantome.remove();
        m.classList.remove("en-cours");
        $$(".trou.survol", zone).forEach((t) => t.classList.remove("survol"));
        const sous = document.elementFromPoint(e.clientX, e.clientY);
        essayer(sous && sous.closest(".trou"), m);
      } else {
        choisir(choisi === m ? null : m); // simple toucher : on choisit le mot
      }
    };
    zone.addEventListener("pointerup", lacher);
    zone.addEventListener("pointercancel", () => {
      if (glisse && glisse.fantome) { glisse.fantome.remove(); glisse.m.classList.remove("en-cours"); }
      glisse = null;
    });
    zone.addEventListener("click", (e) => {
      const t = e.target.closest(".trou");
      if (t && choisi) essayer(t, choisi);
      if (e.target.closest(".retiens-solution")) {
        $$(".trou:not(.rempli)", zone).forEach((t) => remplir(t, null));
        terminer();
      }
    });
    zone.addEventListener("keydown", (e) => {
      const t = e.target.closest(".trou");
      if (t && choisi && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); essayer(t, choisi); }
    });
  }

  function rendreAccueil(main) {
    const premier = CHAPITRES.find((c) => !progres[c.id]) || CHAPITRES[0];
    main.innerHTML = `<article class="chap accueil-parcours">
      <h1>Comprendre la génétique</h1>
      <p class="intro">Pourquoi ressemble-t-on à ses parents tout en étant unique ? Ce parcours t'emmène de l'organisme jusqu'à l'ADN, puis de la formation des gamètes jusqu'à la naissance d'un nouvel individu.</p>
      <div class="mode-emploi">
        <div><span class="pastille">1</span><b>Je découvre</b><br>Un texte court pour comprendre.</div>
        <div><span class="pastille">2</span><b>J'expérimente</b><br>Je manipule et j'observe.</div>
        <div><span class="pastille">3</span><b>Je vérifie</b><br>Je réponds à quelques questions.</div>
        <div><span class="pastille">4</span><b>Je retiens</b><br>L'essentiel à savoir.</div>
      </div>
      <p>À la fin, la <b>trace écrite</b> reprend tout le parcours. Tu peux avancer à ton rythme : ta progression est gardée sur cet appareil.</p>
      <div class="commandes"><a class="btn btn-principal btn-grand" href="#${premier.id}">${progres[CHAPITRES[0].id] ? "Continuer" : "Commencer"} →</a></div>
      <ol class="liste-chapitres">${CHAPITRES.map((c, i) => `<li><a href="#${c.id}">${i + 1}. ${c.titre}</a>${progres[c.id] ? " ✓" : ""}</li>`).join("")}
        <li><a href="#trace">La trace écrite</a></li></ol>
    </article>`;
  }

  function majSommaire() {
    const actif = location.hash.slice(1) || "accueil";
    $("#sommaire").innerHTML = `<ol>
      <li><a href="#accueil" class="${actif === "accueil" ? "actif" : ""}">Accueil du parcours</a></li>
      ${CHAPITRES.map((c, i) => `<li><a href="#${c.id}" class="${actif === c.id ? "actif" : ""}${progres[c.id] ? " fait" : ""}"><span class="s-num">${progres[c.id] ? "✓" : i + 1}</span>${c.titre}</a></li>`).join("")}
      <li><a href="#trace" class="${actif === "trace" ? "actif" : ""}"><span class="s-num">★</span>La trace écrite</a></li>
      <li class="s-atelier"><a href="index.html"><span class="s-num">⌗</span>Atelier caryotype</a></li></ol>`;
    const n = CHAPITRES.filter((c) => progres[c.id]).length;
    $("#p-barre-remplie").style.width = (100 * n) / CHAPITRES.length + "%";
    $("#p-progression-texte").textContent = `${n} / ${CHAPITRES.length} chapitres réussis`;
  }

  function router() {
    const id = location.hash.slice(1) || "accueil";
    const main = $("#chapitre");
    const idx = CHAPITRES.findIndex((c) => c.id === id);
    if (idx >= 0) rendreChapitre(main, idx);
    else if (id === "trace") rendreTrace(main);
    else rendreAccueil(main);
    majSommaire();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }

  // écran étroit : le sommaire devient un menu qui s'ouvre par le bouton « Chapitres »
  function menu(ouvert) {
    document.body.classList.toggle("menu-ouvert", ouvert);
    $("#p-menu").setAttribute("aria-expanded", ouvert);
  }
  $("#p-menu").addEventListener("click", () => menu(!document.body.classList.contains("menu-ouvert")));
  $("#p-voile").addEventListener("click", () => menu(false));
  $("#sommaire").addEventListener("click", (e) => { if (e.target.closest("a")) menu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") menu(false); });

  window.addEventListener("hashchange", router);
  router();
})();
