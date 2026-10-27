/* Caryotype — interface de l'activité. */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const RANGEES = [
    ["1", "2", "3", "4", "5"],
    ["6", "7", "8", "9", "10", "11", "12"],
    ["13", "14", "15", "16", "17", "18"],
    ["19", "20", "21", "22", "X", "Y"],
  ];
  const ACTIVITES = {
    classer: {
      titre: "Reconstituer un caryotype",
      consigne: "Range chaque chromosome dans la bonne case : les deux chromosomes d'une paire ont la même taille, le même centromère et les mêmes bandes.",
    },
    sexe: {
      titre: "Fille ou garçon ?",
      consigne: "Classe les chromosomes, puis regarde la dernière paire pour dire si ce caryotype est celui d'une fille ou d'un garçon.",
    },
    anomalie: {
      titre: "Rechercher une anomalie",
      consigne: "Classe les chromosomes, compte-les, puis indique si ce caryotype présente une anomalie.",
    },
    complet: {
      titre: "Analyse complète",
      consigne: "Classe les chromosomes, puis analyse le caryotype et écris sa formule chromosomique (exemple : 46,XY).",
    },
  };
  // échelle des photos : leur plus grand chromosome mesure 170 px dans les fichiers
  const ECHELLE_PHOTO = 1.05;

  /* ---------- petite mémoire locale (facultative) ---------- */
  const memoire = {
    lire(cle, defaut) {
      try { const v = localStorage.getItem("caryotype." + cle); return v === null ? defaut : JSON.parse(v); }
      catch (e) { return defaut; }
    },
    ecrire(cle, v) {
      try { localStorage.setItem("caryotype." + cle, JSON.stringify(v)); } catch (e) { /* navigation privée */ }
    },
  };

  /* ---------- codes : configuration et caryotype ---------- */
  // code d'un caryotype = numéro du cas + graine, en base 36 (ex. « D7K2Q »)
  function codeCas(indexCas, graine) {
    return ((graine % 1679616) * 64 + indexCas).toString(36).toUpperCase();
  }
  function lireCode(code) {
    const n = parseInt(String(code).trim().toLowerCase(), 36);
    if (!Number.isFinite(n)) return null;
    const indexCas = n % 64;
    if (!Cas.LISTE[indexCas]) return null;
    return { cas: Cas.LISTE[indexCas], graine: Math.floor(n / 64) };
  }
  // configuration d'une activité, dans l'URL sous une forme peu lisible
  function encoder(config) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(config)))).replace(/=+$/, "");
  }
  function decoder(texte) {
    try { return JSON.parse(decodeURIComponent(escape(atob(texte)))); } catch (e) { return null; }
  }

  /* ---------- état ---------- */
  let config = null; // { activite, cas: [ids], modeles, rotation, solution }
  let etat = null; // { cas, graine, code, chromos: [...] }
  // taille par défaut adaptée à l'écran (tablette, vidéoprojecteur…)
  let zoom = memoire.lire("zoom", Math.max(0.55, Math.min(1, Math.round(window.innerWidth / 150) / 10)));
  let selection = null;
  let verifie = false;

  /* ---------- fabrication des chromosomes d'un cas ---------- */
  function fabriquer(cas, graine) {
    const r = Chromosome.aleatoire(graine);
    const chromos = [];
    if (cas.type === "dessin") {
      const classes = Cas.classesDepuisFormule(cas.formule);
      classes.forEach((c, i) => {
        const d = Chromosome.dessiner(c, graine * 97 + i * 7919 + 1);
        chromos.push({ classe: c, url: Chromosome.versURL(d.svg), w: d.w, h: d.h });
      });
    } else {
      const source = window.CHROMOSOMES[cas.source];
      const retirer = (cas.retirer || []).slice();
      for (const p of source) {
        const k = retirer.indexOf(p.c);
        if (k >= 0) { retirer.splice(k, 1); continue; }
        chromos.push({ classe: p.c, url: `donnees/${cas.source}/${p.f}`,
          w: p.w * ECHELLE_PHOTO, h: p.h * ECHELLE_PHOTO });
      }
    }
    // mélange
    for (let i = chromos.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [chromos[i], chromos[j]] = [chromos[j], chromos[i]];
    }
    chromos.forEach((c, i) => {
      c.id = i;
      c.lieu = "lame";
      c.inverse = r() < 0.5;
      c.angle = 0;
    });
    return chromos;
  }

  /* Disposition sur la lame : chaque chromosome est vu comme une « gélule »
   * (segment épaissi) ; on essaie des positions et des angles au hasard et
   * on garde celle qui chevauche le moins les chromosomes déjà posés. */
  function disposer(chromos, graine) {
    const r = Chromosome.aleatoire(graine + 17);
    const lame = $("#lame").getBoundingClientRect();
    const W = Math.max(lame.width, 300);
    const H = Math.max(lame.height, 300);
    const poses = [];
    const ordre = chromos.slice().sort((a, b) => b.h - a.h); // les grands d'abord
    for (const c of ordre) {
      const demi = Math.max(0, c.h / 2 - c.w / 2) * zoom;
      const rayon = (c.w / 2) * zoom;
      let meilleur = null;
      for (let essai = 0; essai < 150; essai++) {
        const angle = config.rotation ? r() * 360 : 0;
        const a = ((angle + 90) * Math.PI) / 180;
        const ux = Math.cos(a) * demi;
        const uy = Math.sin(a) * demi;
        const mx = Math.abs(ux) + rayon + 8;
        const my = Math.abs(uy) + rayon + 8;
        if (2 * mx >= W || 2 * my >= H) continue;
        const x = mx + r() * (W - 2 * mx);
        const y = my + r() * (H - 2 * my);
        // les coins de la lame sont arrondis : on évite les bords en diagonale
        const ex = (x - W / 2) / (W / 2);
        const ey = (y - H / 2) / (H / 2);
        let cout = Math.max(0, ex * ex + ey * ey - 1.15) * 400;
        const s = { x1: x - ux, y1: y - uy, x2: x + ux, y2: y + uy, rayon };
        for (const p of poses) {
          const d = distanceSegments(s, p);
          cout += Math.max(0, s.rayon + p.rayon + 6 - d);
        }
        if (!meilleur || cout < meilleur.cout) meilleur = { cout, x, y, angle, s };
        if (cout === 0) break;
      }
      if (!meilleur) meilleur = { x: W / 2, y: H / 2, angle: 90, s: { x1: W / 2, y1: H / 2, x2: W / 2, y2: H / 2, rayon } };
      poses.push(meilleur.s);
      c.x = meilleur.x / W;
      c.y = meilleur.y / H;
      c.angle = Math.round(meilleur.angle);
    }
  }

  function distanceSegments(a, b) {
    const pointSeg = (px, py, s) => {
      const dx = s.x2 - s.x1;
      const dy = s.y2 - s.y1;
      const l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / l2)) : 0;
      return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
    };
    // les segments se croisent ?
    const o = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
    if (o(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1) !== o(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2)
      && o(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1) !== o(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2)) return 0;
    return Math.min(pointSeg(a.x1, a.y1, b), pointSeg(a.x2, a.y2, b),
      pointSeg(b.x1, b.y1, a), pointSeg(b.x2, b.y2, a));
  }

  /* ---------- affichage ---------- */
  function construireCaryogramme() {
    const zone = $("#caryogramme");
    zone.innerHTML = "";
    for (const rangee of RANGEES) {
      const ligne = document.createElement("div");
      ligne.className = "rangee";
      for (const c of rangee) {
        const slot = document.createElement("div");
        slot.className = "case";
        slot.dataset.classe = c;
        const contenu = document.createElement("div");
        contenu.className = "contenu";
        if (config.modeles) {
          const d = Chromosome.dessiner(c, 1, { modele: true });
          const m = document.createElement("img");
          m.className = "modele";
          m.alt = "";
          m.src = Chromosome.versURL(d.svg);
          m.dataset.w = d.w;
          m.dataset.h = d.h;
          contenu.append(m);
        }
        const etiquette = document.createElement("div");
        etiquette.className = "etiquette";
        etiquette.textContent = c;
        slot.append(contenu, etiquette);
        ligne.append(slot);
      }
      zone.append(ligne);
    }
  }

  function elementDe(c) {
    let el = document.querySelector(`.chromo[data-id="${c.id}"]`);
    if (!el) {
      el = document.createElement("div");
      el.className = "chromo";
      el.dataset.id = c.id;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", "Chromosome");
      const img = document.createElement("img");
      img.src = c.url;
      img.alt = "";
      img.draggable = false;
      el.append(img);
    }
    return el;
  }

  function dimensionner(el, c) {
    const img = el.firstChild;
    img.style.width = c.w * zoom + "px";
    img.style.height = c.h * zoom + "px";
  }

  function placer(c) {
    const el = elementDe(c);
    dimensionner(el, c);
    el.classList.remove("juste", "faux");
    if (c.lieu === "lame") {
      $("#lame").append(el);
      el.style.left = c.x * 100 + "%";
      el.style.top = c.y * 100 + "%";
      el.style.transform = `translate(-50%, -50%) rotate(${c.angle + (c.inverse ? 180 : 0)}deg)`;
    } else {
      const contenu = document.querySelector(`.case[data-classe="${c.lieu}"] .contenu`);
      contenu.append(el);
      el.style.left = el.style.top = "";
      el.style.transform = c.inverse ? "rotate(180deg)" : "";
    }
  }

  function toutAfficher() {
    $("#lame").innerHTML = "";
    construireCaryogramme();
    for (const c of etat.chromos) placer(c);
    appliquerZoom();
    compter();
  }

  function appliquerZoom() {
    document.documentElement.style.setProperty("--zoom", zoom);
    for (const c of etat.chromos) dimensionner(elementDe(c), c);
    document.querySelectorAll(".modele").forEach((m) => {
      m.style.width = m.dataset.w * zoom + "px";
      m.style.height = m.dataset.h * zoom + "px";
    });
  }

  function compter() {
    const n = etat.chromos.filter((c) => c.lieu === "lame").length;
    $("#compteur-lame").textContent = n ? `${n} chromosome${n > 1 ? "s" : ""} à classer` : "tout est classé";
  }

  function sauver() {
    if (!etat || etat.solution) return;
    memoire.ecrire("travail." + etat.code, {
      chromos: etat.chromos.map((c) => [c.lieu, c.x, c.y, c.inverse ? 1 : 0, c.angle]),
      reponses: lireReponses(),
      nom: $("#nom-eleve").value,
    });
  }

  /* ---------- déplacements ---------- */
  function choisir(c) {
    document.querySelectorAll(".chromo.choisi").forEach((e) => e.classList.remove("choisi"));
    selection = c;
    if (c) elementDe(c).classList.add("choisi");
  }

  function deplacer(c, lieu, x, y) {
    c.lieu = lieu;
    if (lieu === "lame") {
      c.x = Math.min(0.97, Math.max(0.03, x));
      c.y = Math.min(0.97, Math.max(0.03, y));
    } else {
      c.angle = 0; // dans le caryogramme, le chromosome se redresse
    }
    placer(c);
    compter();
    marquerModifie();
    sauver();
  }

  function marquerModifie() {
    if (verifie) {
      document.querySelectorAll(".chromo.juste, .chromo.faux").forEach((e) => e.classList.remove("juste", "faux"));
    }
  }

  function retourner(c) {
    c.inverse = !c.inverse;
    placer(c);
    sauver();
  }

  function cibleSous(x, y, el) {
    el.style.visibility = "hidden";
    const sous = document.elementFromPoint(x, y);
    el.style.visibility = "";
    if (!sous) return null;
    const slot = sous.closest(".case");
    if (slot) return { lieu: slot.dataset.classe };
    const lame = sous.closest("#lame");
    if (lame) {
      const b = lame.getBoundingClientRect();
      return { lieu: "lame", x: (x - b.left) / b.width, y: (y - b.top) / b.height };
    }
    return null;
  }

  function activerGlisser() {
    let prise = null;
    let dernierToucher = { id: null, t: 0 };

    document.addEventListener("pointerdown", (e) => {
      const el = e.target.closest(".chromo");
      if (!el || e.button > 0) return;
      e.preventDefault();
      const c = etat.chromos[+el.dataset.id];
      const b = el.getBoundingClientRect();
      prise = { c, el, x0: e.clientX, y0: e.clientY, dx: e.clientX - (b.left + b.width / 2),
        dy: e.clientY - (b.top + b.height / 2), bouge: false, transform: el.style.transform };
      el.setPointerCapture(e.pointerId);
    });

    document.addEventListener("pointermove", (e) => {
      if (!prise) return;
      if (!prise.bouge && Math.hypot(e.clientX - prise.x0, e.clientY - prise.y0) < 5) return;
      if (!prise.bouge) {
        prise.bouge = true;
        prise.el.classList.add("glisse");
        const rot = prise.c.lieu === "lame" ? prise.c.angle + (prise.c.inverse ? 180 : 0) : (prise.c.inverse ? 180 : 0);
        prise.el.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(1.08)`;
        document.body.append(prise.el);
      }
      prise.el.style.left = e.clientX - prise.dx + "px";
      prise.el.style.top = e.clientY - prise.dy + "px";
      document.querySelectorAll(".case.survol").forEach((s) => s.classList.remove("survol"));
      const cible = cibleSous(e.clientX, e.clientY, prise.el);
      if (cible && cible.lieu !== "lame") {
        document.querySelector(`.case[data-classe="${cible.lieu}"]`).classList.add("survol");
      }
    });

    document.addEventListener("pointerup", (e) => {
      if (!prise) return;
      const { c, el, bouge } = prise;
      prise = null;
      document.querySelectorAll(".case.survol").forEach((s) => s.classList.remove("survol"));
      if (!bouge) {
        // toucher simple : sélection ; deux touchers rapprochés : retourner
        const t = Date.now();
        if (dernierToucher.id === c.id && t - dernierToucher.t < 350) {
          retourner(c);
          dernierToucher = { id: null, t: 0 };
        } else {
          dernierToucher = { id: c.id, t };
          choisir(selection === c ? null : c);
        }
        return;
      }
      el.classList.remove("glisse");
      const cible = cibleSous(e.clientX, e.clientY, el);
      if (cible) deplacer(c, cible.lieu, cible.x, cible.y);
      else placer(c); // lâché ailleurs : il revient à sa place
      choisir(null);
    });

    // avec un chromosome sélectionné, toucher une case ou la lame l'y dépose
    document.addEventListener("click", (e) => {
      if (!selection || e.target.closest(".chromo")) return;
      const slot = e.target.closest(".case");
      const lame = e.target.closest("#lame");
      if (slot) deplacer(selection, slot.dataset.classe);
      else if (lame) {
        const b = lame.getBoundingClientRect();
        deplacer(selection, "lame", (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
      } else return;
      choisir(null);
    });

    // clavier : Entrée sélectionne, R retourne, Échap désélectionne
    document.addEventListener("keydown", (e) => {
      const el = e.target.closest && e.target.closest(".chromo");
      if (e.key === "Escape") choisir(null);
      if (!el) return;
      const c = etat.chromos[+el.dataset.id];
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choisir(selection === c ? null : c); }
      if (e.key === "r" || e.key === "R") retourner(c);
    });
  }

  /* ---------- questions ---------- */
  function construireQuestions() {
    const zone = $("#questions");
    const a = config.activite;
    zone.hidden = a === "classer";
    if (a === "classer") { zone.innerHTML = ""; return; }
    const options = Cas.CLASSES.map((c) => `<option value="${c}">${c}</option>`).join("");
    let html = "<h2>Mes réponses</h2><div class=\"grille-questions\">";
    if (a !== "sexe") {
      html += `<label class="q" data-q="nombre">Nombre de chromosomes
        <input type="number" id="r-nombre" min="1" max="99" inputmode="numeric"></label>`;
    }
    html += `<fieldset class="q" data-q="sexe"><legend>Ce caryotype est celui</legend>
      <label><input type="radio" name="r-sexe" value="fille"> d'une fille</label>
      <label><input type="radio" name="r-sexe" value="garcon"> d'un garçon</label></fieldset>`;
    if (a !== "sexe") {
      html += `<fieldset class="q" data-q="anomalie"><legend>Anomalie</legend>
        <select id="r-anomalie">
          <option value="">— choisir —</option>
          <option value="aucune">Aucune anomalie</option>
          <option value="plus">Un chromosome en trop</option>
          <option value="moins">Un chromosome en moins</option>
        </select>
        <label class="quel" hidden>Lequel ? <select id="r-quel"><option value="">—</option>${options}</select></label>
      </fieldset>`;
    }
    if (a === "complet") {
      html += `<label class="q" data-q="formule">Formule chromosomique
        <input type="text" id="r-formule" placeholder="ex. 46,XX" autocomplete="off" spellcheck="false"></label>`;
    }
    html += `<label class="q q-large">Justification
      <textarea id="r-justif" rows="2" placeholder="J'observe… donc…"></textarea></label>`;
    html += "</div>";
    zone.innerHTML = html;
    const an = $("#r-anomalie");
    if (an) an.addEventListener("change", () => {
      zone.querySelector(".quel").hidden = !(an.value === "plus" || an.value === "moins");
    });
    zone.addEventListener("input", sauver);
    zone.addEventListener("change", sauver);
  }

  function lireReponses() {
    const v = (s) => { const e = $(s); return e ? e.value : ""; };
    const sexe = document.querySelector("input[name=r-sexe]:checked");
    return { nombre: v("#r-nombre"), sexe: sexe ? sexe.value : "", anomalie: v("#r-anomalie"),
      quel: v("#r-quel"), formule: v("#r-formule"), justif: v("#r-justif") };
  }

  function ecrireReponses(r) {
    if (!r) return;
    const m = (s, val) => { const e = $(s); if (e && val != null) e.value = val; };
    m("#r-nombre", r.nombre); m("#r-anomalie", r.anomalie); m("#r-quel", r.quel);
    m("#r-formule", r.formule); m("#r-justif", r.justif);
    const s = document.querySelector(`input[name=r-sexe][value="${r.sexe}"]`);
    if (s) s.checked = true;
    const an = $("#r-anomalie");
    if (an) an.dispatchEvent(new Event("change"));
  }

  /* ---------- vérification ---------- */
  function verifier() {
    verifie = true;
    const liste = etat.chromos.map((c) => c.classe);
    let justes = 0;
    for (const c of etat.chromos) {
      const el = elementDe(c);
      el.classList.remove("juste", "faux");
      if (c.lieu === "lame") continue;
      const ok = c.lieu === c.classe;
      if (ok) justes++;
      el.classList.add(ok ? "juste" : "faux");
    }
    const restants = etat.chromos.filter((c) => c.lieu === "lame").length;
    const total = etat.chromos.length;
    const lignes = [];
    const classeOk = justes === total;
    lignes.push(classeOk
      ? `<p class="ok">Classement parfait : les ${total} chromosomes sont à leur place.</p>`
      : `<p>${justes} chromosome${justes > 1 ? "s" : ""} bien placé${justes > 1 ? "s" : ""} sur ${total}`
        + (restants ? `, ${restants} encore sur la lame` : "") + ". Les chromosomes entourés de rouge sont mal placés.</p>");
    const malTournes = etat.chromos.filter((c) => c.lieu !== "lame" && c.inverse).length;
    if (malTournes) lignes.push(`<p class="conseil">${malTournes} chromosome${malTournes > 1 ? "s sont" : " est"} à l'envers : double-clic pour mettre le bras court en haut.</p>`);

    const a = config.activite;
    let reponsesOk = true;
    document.querySelectorAll(".q").forEach((q) => q.classList.remove("q-juste", "q-faux"));
    if (a !== "classer") {
      const r = lireReponses();
      const marque = (nom, ok) => {
        const q = document.querySelector(`.q[data-q="${nom}"]`);
        if (q) q.classList.add(ok ? "q-juste" : "q-faux");
        if (!ok) reponsesOk = false;
        return ok;
      };
      const sexeOk = marque("sexe", r.sexe === Cas.sexe(liste));
      const res = [];
      if (a !== "sexe") {
        res.push(marque("nombre", +r.nombre === total) ? "nombre juste" : "nombre faux");
        const an = Cas.anomalies(liste);
        let anOk;
        if (!an.length) anOk = r.anomalie === "aucune";
        else anOk = an.length === 1 && r.anomalie === (an[0].delta > 0 ? "plus" : "moins") && r.quel === an[0].c;
        res.push(marque("anomalie", anOk) ? "anomalie juste" : "anomalie fausse");
      }
      if (a === "complet") {
        const fOk = Cas.normaliserFormule(r.formule) === Cas.normaliserFormule(etat.cas.formule);
        res.push(marque("formule", fOk) ? "formule juste" : "formule fausse");
      }
      res.unshift(sexeOk ? "sexe juste" : "sexe faux");
      lignes.push(`<p>Réponses : ${res.join(", ")}.</p>`);
      if (reponsesOk) lignes.push(`<p class="ok">Bravo ! ${a === "sexe" ? "" : "Diagnostic : <b>" + Cas.nomAnomalie(liste) + "</b>."}</p>`);
    }
    const bilan = $("#bilan");
    bilan.innerHTML = lignes.join("");
    bilan.hidden = false;
    bilan.className = "bilan" + (classeOk && reponsesOk ? " bilan-ok" : "");
    if (config.solution) $("#btn-solution").hidden = false;
  }

  function montrerSolution() {
    for (const c of etat.chromos) {
      c.lieu = c.classe;
      c.inverse = false;
      c.angle = 0;
      placer(c);
    }
    compter();
    const liste = etat.chromos.map((c) => c.classe);
    const bilan = $("#bilan");
    bilan.hidden = false;
    bilan.className = "bilan bilan-solution";
    bilan.innerHTML = `<p><b>Solution</b> — formule : <b>${etat.cas.formule}</b> ; `
      + `${Cas.sexe(liste) === "fille" ? "fille" : "garçon"} ; ${Cas.nomAnomalie(liste)}.`
      + (etat.cas.type === "photo" ? ` <span class="source">Photo : ${Cas.CREDITS[etat.cas.source]}${etat.cas.montage ? " (montage pédagogique)" : ""}.</span>` : "")
      + "</p>";
  }

  /* ---------- démarrage d'une activité ---------- */
  function choisirCas(conf) {
    const possibles = conf.cas.map(Cas.parId).filter(Boolean);
    let liste = possibles;
    // pour la recherche d'anomalie, on tire plus souvent un caryotype anormal
    if ((conf.activite === "anomalie" || conf.activite === "complet") && Math.random() < 0.65) {
      const anormaux = possibles.filter((c) => Cas.anomalies(Cas.classesDepuisFormule(c.formule)).length);
      if (anormaux.length) liste = anormaux;
    }
    return liste[Math.floor(Math.random() * liste.length)];
  }

  function demarrer(conf, code, solution) {
    config = conf;
    let cas, graine;
    const lu = code && lireCode(code);
    if (lu) { cas = lu.cas; graine = lu.graine; }
    else { cas = choisirCas(conf); graine = Math.floor(Math.random() * 1679616); }
    const indexCas = Cas.LISTE.indexOf(cas);
    etat = { cas, graine, code: codeCas(indexCas, graine), solution: !!solution };
    etat.chromos = fabriquer(cas, graine);
    verifie = false;
    selection = null;

    $("#accueil").hidden = true;
    $("#activite").hidden = false;
    $("#titre-activite").textContent = ACTIVITES[conf.activite].titre;
    $("#consigne").textContent = ACTIVITES[conf.activite].consigne;
    $("#code-cas").textContent = "Caryotype n° " + etat.code;
    $("#bilan").hidden = true;
    $("#btn-solution").hidden = true;
    construireQuestions();
    appliquerZoom();
    disposer(etat.chromos, graine);
    toutAfficher();

    const travail = !solution && memoire.lire("travail." + etat.code, null);
    if (travail && travail.chromos.length === etat.chromos.length) {
      travail.chromos.forEach((t, i) => {
        const c = etat.chromos[i];
        [c.lieu, c.x, c.y] = t;
        c.inverse = !!t[3];
        c.angle = t[4] || 0;
        placer(c);
      });
      ecrireReponses(travail.reponses);
      $("#nom-eleve").value = travail.nom || "";
      compter();
    }
    if (solution) montrerSolution();
    const url = new URL(location.href);
    url.search = "";
    url.searchParams.set("p", encoder(conf));
    url.searchParams.set("code", etat.code);
    if (solution) url.searchParams.set("solution", "1");
    history.replaceState(null, "", url);
    window.scrollTo(0, 0);
  }

  function configLibre(activite) {
    const type = document.querySelector("input[name=type]:checked").value;
    return { activite, cas: Cas.LISTE.filter((c) => c.type === type).map((c) => c.id),
      modeles: true, rotation: true, solution: true };
  }

  /* ---------- aide : planche des modèles ---------- */
  function construirePlanche() {
    const planche = $("#planche");
    if (planche.childElementCount) return;
    for (const c of Cas.CLASSES) {
      const d = Chromosome.dessiner(c, 1, { modele: true });
      const fig = document.createElement("figure");
      fig.innerHTML = `<img alt="Chromosome ${c}" src="${Chromosome.versURL(d.svg)}" width="${d.w}" height="${d.h}"><figcaption>${c}</figcaption>`;
      planche.append(fig);
    }
  }

  /* ---------- espace enseignant ---------- */
  function construireProf() {
    const zone = $("#prof-cas");
    if (!zone.childElementCount) {
      for (const type of ["dessin", "photo"]) {
        const groupe = document.createElement("div");
        groupe.innerHTML = `<h4>${type === "dessin" ? "Chromosomes dessinés" : "Photos réelles"}</h4>`;
        for (const c of Cas.LISTE.filter((x) => x.type === type)) {
          const liste = Cas.classesDepuisFormule(c.formule);
          const lab = document.createElement("label");
          lab.innerHTML = `<input type="checkbox" value="${c.id}" ${type === "dessin" ? "checked" : ""}> ${c.formule} <small>${Cas.nomAnomalie(liste)}</small>`;
          groupe.append(lab);
        }
        zone.append(groupe);
      }
    }
    majLienProf();
  }

  function configProf() {
    return {
      activite: $("#prof-activite").value,
      cas: [...document.querySelectorAll("#prof-cas input:checked")].map((i) => i.value),
      modeles: $("#prof-modeles").checked,
      rotation: $("#prof-rotation").checked,
      solution: $("#prof-solution").checked,
    };
  }

  function majLienProf() {
    const conf = configProf();
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("p", encoder(conf));
    $("#prof-lien").value = conf.cas.length ? url.href : "Cochez au moins un caryotype.";
  }

  /* ---------- impression ---------- */
  function imprimer() {
    document.querySelector(".impression-entete")?.remove();
    const t = document.createElement("div");
    t.className = "impression-entete";
    t.textContent = `${$("#nom-eleve").value || "Nom : ……………………"} — ${ACTIVITES[config.activite].titre} — Caryotype n° ${etat.code}`;
    $("#activite").prepend(t);
    window.print();
  }

  /* ---------- branchements ---------- */
  function init() {
    activerGlisser();
    document.querySelectorAll("#choix-activite .carte").forEach((b) =>
      b.addEventListener("click", () => demarrer(configLibre(b.dataset.activite))));
    const typeMemo = memoire.lire("type", "dessin");
    const radio = document.querySelector(`input[name=type][value="${typeMemo}"]`);
    if (radio) radio.checked = true;
    document.querySelectorAll("input[name=type]").forEach((r) =>
      r.addEventListener("change", () => memoire.ecrire("type", r.value)));

    $("#retour").addEventListener("click", () => {
      $("#activite").hidden = true;
      $("#accueil").hidden = false;
      history.replaceState(null, "", location.pathname);
    });
    $("#btn-verifier").addEventListener("click", verifier);
    $("#btn-solution").addEventListener("click", montrerSolution);
    $("#btn-nouveau").addEventListener("click", () => {
      if (etat.chromos.some((c) => c.lieu !== "lame") && !etat.solution
        && !confirm("Commencer un nouveau caryotype ? Le travail en cours sera abandonné.")) return;
      demarrer(config);
    });
    $("#btn-imprimer").addEventListener("click", imprimer);
    $("#btn-aide").addEventListener("click", () => { construirePlanche(); $("#dlg-aide").showModal(); });
    $("#zoom-plus").addEventListener("click", () => { zoom = Math.min(2, +(zoom + 0.1).toFixed(2)); memoire.ecrire("zoom", zoom); appliquerZoom(); });
    $("#zoom-moins").addEventListener("click", () => { zoom = Math.max(0.5, +(zoom - 0.1).toFixed(2)); memoire.ecrire("zoom", zoom); appliquerZoom(); });
    $("#nom-eleve").addEventListener("input", sauver);

    $("#ouvrir-prof").addEventListener("click", () => { construireProf(); $("#dlg-prof").showModal(); });
    $("#form-prof").addEventListener("change", majLienProf);
    $("#prof-copier").addEventListener("click", async () => {
      majLienProf();
      try { await navigator.clipboard.writeText($("#prof-lien").value); $("#prof-copier").textContent = "Lien copié ✓"; }
      catch (e) { $("#prof-lien").select(); }
      setTimeout(() => { $("#prof-copier").textContent = "Copier le lien"; }, 2000);
    });
    $("#prof-tester").addEventListener("click", () => {
      const conf = configProf();
      if (!conf.cas.length) return;
      $("#dlg-prof").close();
      demarrer(conf);
    });
    $("#prof-corriger").addEventListener("click", () => {
      const code = $("#prof-code").value.trim();
      if (!lireCode(code)) { $("#prof-code").setCustomValidity("Code inconnu"); $("#prof-code").reportValidity(); return; }
      $("#dlg-prof").close();
      demarrer(Object.assign(configProf(), { solution: true }), code, true);
    });
    $("#prof-code").addEventListener("input", () => $("#prof-code").setCustomValidity(""));

    $("#ouvrir-credits").addEventListener("click", () => {
      const ul = $("#liste-credits");
      if (!ul.childElementCount) {
        for (const [k, v] of Object.entries(Cas.CREDITS)) {
          const cas = Cas.LISTE.filter((c) => c.source === k).map((c) => c.formule).join(", ");
          const li = document.createElement("li");
          li.textContent = `${cas} : ${v}`;
          ul.append(li);
        }
      }
      $("#dlg-credits").showModal();
    });

    // lien préparé par l'enseignant : ?p=…[&code=…][&solution=1]
    const params = new URLSearchParams(location.search);
    const conf = params.get("p") && decoder(params.get("p"));
    if (conf && Array.isArray(conf.cas) && ACTIVITES[conf.activite]) {
      demarrer(conf, params.get("code"), params.get("solution") === "1");
    }
  }

  init();
})();
