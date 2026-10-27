/* Dessin vectoriel (SVG) d'un chromosome métaphasique en bandes G.
 *
 * Chaque chromosome est formé de deux chromatides sœurs réunies au centromère.
 * Les bandes viennent de window.BANDES (UCSC hg38). Un générateur aléatoire
 * (graine) fait varier légèrement la longueur, la largeur, le contraste et le
 * contour, pour que deux chromosomes homologues ne soient jamais identiques.
 */
(function () {
  "use strict";

  // pixels par mégabase (Mb) : le chromosome 1 (248 Mb) mesure ~185 px
  const PX_PAR_MB = 0.75;

  // générateur pseudo-aléatoire reproductible (mulberry32)
  function aleatoire(graine) {
    let a = graine >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gris(v) {
    const g = Math.max(0, Math.min(255, Math.round(v)));
    return `rgb(${g},${g},${g})`;
  }

  /* Renvoie { svg, w, h, centro } : le texte SVG, ses dimensions en px
   * et la hauteur du centromère (utile pour aligner un caryogramme). */
  function dessiner(classe, graine, options) {
    const opt = Object.assign({ modele: false }, options);
    const d = window.BANDES[classe];
    const r = aleatoire(graine);
    const varLong = opt.modele ? 1 : 0.94 + r() * 0.12;
    const L = d.mb * PX_PAR_MB * varLong;
    const cw = opt.modele ? 8.5 : 8.3 + r() * 1.2; // largeur d'une chromatide
    const ecart = opt.modele ? 0 : 0.9; // fente entre chromatides
    const pad = 3;
    // légère courbure (les chromosomes réels sont rarement tout droits)
    const courbe = opt.modele ? 0 : (r() - 0.5) * Math.min(10, L / 12);
    const courbe2 = opt.modele ? 0 : (r() - 0.5) * Math.min(4, L / 30);
    const marge = Math.ceil(Math.abs(courbe) + Math.abs(courbe2));
    const W = Math.ceil(2 * cw + ecart + 2 * pad + 2 + 2 * marge);
    const H = Math.ceil(L + 2 * pad);
    const cx = W / 2;
    const yc = pad + d.centro * L;

    // zones de « tige » (bras courts des acrocentriques 13, 14, 15, 21, 22)
    const tiges = d.bandes.filter((b) => b[4] === "tige")
      .map((b) => [pad + b[0] * L, pad + b[1] * L]);

    const phases = [r() * 6.3, r() * 6.3, r() * 6.3, r() * 6.3];
    const axe = (y) => {
      const t = (y - pad) / L;
      return courbe * Math.sin(Math.PI * t) + courbe2 * Math.sin(2 * Math.PI * t);
    };
    const bruit = (y, k) => opt.modele ? 0
      : 0.35 * Math.sin(y / 5 + phases[k]) + 0.25 * Math.sin(y / 2.3 + phases[k + 2]);

    function largeur(y) {
      const dist = Math.min(y - pad, pad + L - y);
      const rayon = cw * 0.6;
      let f = dist <= 0 ? 0 : dist >= rayon ? 1 : Math.sqrt(1 - Math.pow((rayon - dist) / rayon, 2));
      for (const [t0, t1] of tiges) {
        const dans = Math.max(0, Math.min(y - t0, t1 - y));
        if (dans > 0) f *= 1 - 0.55 * Math.min(1, dans / 2);
      }
      return cw * f;
    }

    // une chromatide = polygone (bord extérieur puis bord intérieur)
    function chromatide(cote, k) {
      const ext = [];
      const int = [];
      for (let y = pad; y <= pad + L + 0.01; y += 1) {
        const pince = 3.4 * Math.exp(-Math.pow((y - yc) / 3.5, 2));
        const fente = (ecart / 2) * (1 - Math.exp(-Math.pow((y - yc) / 3, 2)));
        const w = largeur(y);
        const xi = cx + axe(y) + cote * fente;
        const xe = cx + axe(y) + cote * (fente + Math.max(0, w - pince) + bruit(y, k));
        ext.push(`${xe.toFixed(1)},${y.toFixed(1)}`);
        int.push(`${xi.toFixed(1)},${y.toFixed(1)}`);
      }
      return "M" + ext.join("L") + "L" + int.reverse().join("L") + "Z";
    }

    const contraste = opt.modele ? 1 : 0.88 + r() * 0.2;
    const clair = opt.modele ? 232 : 222 + r() * 10;
    let bandes = `<rect x="0" y="0" width="${W}" height="${H}" fill="${gris(140)}"/>`;
    for (const b of d.bandes) {
      const y0 = pad + b[0] * L;
      const y1 = pad + b[1] * L;
      let v = clair - b[2] * 165 * contraste + (opt.modele ? 0 : (r() - 0.5) * 14);
      if (b[4] === "tige") v = clair + 6;
      // bande = quadrilatère qui suit la courbure de l'axe
      const a0 = cx + axe(y0);
      const a1 = cx + axe(y1);
      const m = W;
      bandes += `<path d="M${(a0 - m).toFixed(1)},${y0.toFixed(2)}H${(a0 + m).toFixed(1)}L${(a1 + m).toFixed(1)},${(y1 + 0.3).toFixed(2)}H${(a1 - m).toFixed(1)}Z" fill="${gris(v)}"/>`;
    }

    const id = "c" + (graine >>> 0).toString(36) + classe;
    const graineBruit = Math.floor(r() * 1000);
    const filtre = opt.modele ? "" : `
      <filter id="f${id}" x="-20%" y="-5%" width="140%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="${graineBruit}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.7 0 0 0 -0.28" result="na"/>
        <feComposite in="na" in2="SourceGraphic" operator="in" result="grain"/>
        <feMerge result="m"><feMergeNode in="SourceGraphic"/><feMergeNode in="grain"/></feMerge>
        <feGaussianBlur in="m" stdDeviation="0.85"/>
      </filter>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <clipPath id="k${id}"><path d="${chromatide(-1, 0)}"/><path d="${chromatide(1, 1)}"/></clipPath>${filtre}
      </defs>
      <g ${opt.modele ? "" : `filter="url(#f${id})"`}><g clip-path="url(#k${id})">${bandes}</g></g>
    </svg>`;
    return { svg, w: W, h: H, centro: yc };
  }

  // convertit le SVG en URL d'image : le navigateur le dessine une seule fois
  function versURL(svg) {
    return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  }

  window.Chromosome = { dessiner, versURL, aleatoire, PX_PAR_MB };
})();
