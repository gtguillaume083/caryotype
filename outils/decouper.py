"""Étape 2 : découpe chaque chromosome des caryogrammes sources.

Pour chaque caryogramme (voir CAS ci-dessous) :
  - on repère les objets sombres (chromosomes + numéros imprimés) ;
  - on enlève les numéros (objets trop petits) ;
  - on recolle les morceaux d'un même chromosome (centromère pâle) ;
  - on range les objets par rangée, puis de gauche à droite ;
  - on leur attribue la classe donnée dans RANGEES (ordre du caryogramme).

Résultat : app/donnees/<cas>/<k>.png (fond transparent) et app/donnees/cas.js.
Une image de contrôle par cas est écrite dans outils/controle/.

Usage : python decouper.py [nom_du_cas ...]
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ICI = os.path.dirname(os.path.abspath(__file__))
SOURCES = os.path.join(ICI, "sources", "karyogrammes")
CONTROLE = os.path.join(ICI, "controle")
SORTIE = os.path.join(ICI, "..", "app", "donnees")

# hauteur (px) donnée au plus grand chromosome de chaque cas dans l'application
HAUTEUR_REF = 170


def paires(*classes):
    return [c for c in classes for _ in (0, 1)]


NORMAL = [
    paires("1", "2", "3", "4", "5"),
    paires("6", "7", "8", "9", "10", "11", "12"),
    paires("13", "14", "15", "16", "17", "18"),
    paires("19", "20", "21", "22"),
]

CAS = {
    "turner": dict(
        fichier="turner.jpg", seuil=200, dil=2, h_min=16,
        rangees=NORMAL[:3] + [NORMAL[3] + ["X"]],
    ),
    "nhgri_xy": dict(
        fichier="nhgri_xy.png", seuil=200, dil=3, h_min=5, ecart=40,
        rangees=NORMAL[:3] + [NORMAL[3] + ["X", "Y"]],
    ),
    "xxy_a": dict(
        fichier="xxy_a.jpg", seuil=200, dil=2, h_min=16,
        rangees=NORMAL[:3] + [NORMAL[3] + ["X", "X", "Y"]],
    ),
    "xxxx": dict(
        fichier="xxxx.jpg", seuil=200, dil=2, h_min=8, noir_min=15,
        rangees=NORMAL[:3] + [NORMAL[3] + ["X", "X", "X", "X"]],
    ),
    "t21": dict(
        fichier="t21_de.jpg", seuil=200, dil=2, h_min=14, satur_max=40,
        effacer=[(600, 75, 605, 105)],  # sépare les deux chromosomes 4 qui se touchent
        rangees=NORMAL[:3] + [paires("19", "20") + ["21"] * 3 + paires("22", "X")],
    ),
    "t18": dict(
        fichier="t18.jpg", seuil=200, dil=2, h_min=14, satur_max=40,
        rangees=NORMAL[:2] + [paires("13", "14", "15", "16", "17") + ["18"] * 3,
                              paires("19", "20", "21", "22") + ["X", "Y"]],
    ),
}


def detecter(cfg):
    img = Image.open(os.path.join(SOURCES, cfg["fichier"])).convert("RGB")
    rgb = np.asarray(img).astype(int)
    gris = rgb.mean(axis=2)
    satur = rgb.max(axis=2) - rgb.min(axis=2)
    masque = (gris < cfg["seuil"]) & (satur < cfg.get("satur_max", 60))
    for (x0, y0, x1, y1) in cfg.get("effacer", []):
        masque[y0:y1, x0:x1] = False
    masque = ndi.binary_opening(masque, iterations=1)
    lab, _ = ndi.label(ndi.binary_dilation(masque, iterations=cfg["dil"]))
    lab = lab * masque
    objs = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        pix = gris[sl][lab[sl] == i]
        if y1 - y0 < cfg["h_min"] or pix.size < cfg.get("aire_min", 60):
            continue
        # numéros imprimés en noir pur (les chromosomes ne le sont jamais)
        if np.percentile(pix, 10) < cfg.get("noir_min", -1):
            continue
        objs.append(dict(ids={i}, x0=x0, y0=y0, x1=x1, y1=y1))
    return img, gris, lab, recoller(objs, cfg.get("ecart", 14))


def recoller(objs, ecart):
    """Fusionne les morceaux superposés verticalement (même chromosome coupé)."""
    change = True
    while change:
        change = False
        for a in objs:
            for b in objs:
                if a is b:
                    continue
                recouv = min(a["x1"], b["x1"]) - max(a["x0"], b["x0"])
                etroit = min(a["x1"] - a["x0"], b["x1"] - b["x0"])
                vide = max(a["y0"], b["y0"]) - min(a["y1"], b["y1"])
                if recouv > 0.6 * etroit and vide < ecart:
                    a["ids"] |= b["ids"]
                    for k, f in (("x0", min), ("y0", min), ("x1", max), ("y1", max)):
                        a[k] = f(a[k], b[k])
                    objs.remove(b)
                    change = True
                    break
            if change:
                break
    return objs


def ranger(objs):
    """Regroupe en rangées : un objet rejoint une rangée si au moins 40 % de sa
    hauteur (ou de celle de la rangée) chevauche l'étendue de la rangée."""
    objs = sorted(objs, key=lambda o: o["y0"])
    rangees = []
    for o in objs:
        for r in rangees:
            haut, bas = min(p["y0"] for p in r), max(p["y1"] for p in r)
            recouv = min(bas, o["y1"]) - max(haut, o["y0"])
            if recouv > 0.4 * min(bas - haut, o["y1"] - o["y0"]):
                r.append(o)
                break
        else:
            rangees.append([o])
    rangees.sort(key=lambda r: min(p["y0"] for p in r))
    return [sorted(r, key=lambda o: (o["x0"] + o["x1"]) / 2) for r in rangees]


def traiter(nom, cfg):
    img, gris, lab, objs = detecter(cfg)
    rangees = ranger(objs)
    attendu = cfg["rangees"]
    ctrl = img.copy()
    d = ImageDraw.Draw(ctrl)
    ok = len(rangees) == len(attendu) and all(
        len(r) == len(a) for r, a in zip(rangees, attendu))
    if not ok:
        print(f"[{nom}] ÉCHEC : trouvé", [len(r) for r in rangees],
              "attendu", [len(a) for a in attendu])
        for r in rangees:
            for o in r:
                d.rectangle([o["x0"], o["y0"], o["x1"], o["y1"]], outline="red")
        os.makedirs(CONTROLE, exist_ok=True)
        ctrl.save(os.path.join(CONTROLE, nom + ".png"))
        return None

    hmax = max(o["y1"] - o["y0"] for o in objs)
    echelle = HAUTEUR_REF / hmax
    dossier = os.path.join(SORTIE, nom)
    os.makedirs(dossier, exist_ok=True)
    for f in os.listdir(dossier):
        os.remove(os.path.join(dossier, f))
    chromos = []
    k = 0
    for r, classes in zip(rangees, attendu):
        for o, c in zip(r, classes):
            k += 1
            m = 6
            y0, y1 = max(o["y0"] - m, 0), min(o["y1"] + m, lab.shape[0])
            x0, x1 = max(o["x0"] - m, 0), min(o["x1"] + m, lab.shape[1])
            zone = np.isin(lab[y0:y1, x0:x1], list(o["ids"]))
            zone = ndi.binary_dilation(zone, iterations=4)
            g = gris[y0:y1, x0:x1]
            # transparence : le fond clair disparaît, le chromosome reste
            alpha = np.clip((cfg.get("fond", 235) - g) * 4, 0, 255) * zone
            gg = np.clip(g, 0, 255).astype(np.uint8)
            rgba = np.dstack([gg, gg, gg, alpha.astype(np.uint8)])
            piece = Image.fromarray(rgba, "RGBA")
            w = max(1, round(piece.width * echelle))
            h = max(1, round(piece.height * echelle))
            piece = piece.resize((w, h), Image.LANCZOS)
            piece.save(os.path.join(dossier, f"{k}.png"), optimize=True)
            chromos.append(dict(f=f"{k}.png", c=c, w=w, h=h))
            d.rectangle([o["x0"], o["y0"], o["x1"], o["y1"]], outline="green")
            d.text((o["x0"], o["y1"] + 1), c, fill="red")
    os.makedirs(CONTROLE, exist_ok=True)
    ctrl.save(os.path.join(CONTROLE, nom + ".png"))
    print(f"[{nom}] {k} chromosomes découpés")
    return chromos


def main():
    noms = sys.argv[1:] or list(CAS)
    index_path = os.path.join(SORTIE, "chromosomes.json")
    index = json.load(open(index_path, encoding="utf-8")) if os.path.exists(index_path) else {}
    for nom in noms:
        res = traiter(nom, CAS[nom])
        if res:
            index[nom] = res
    os.makedirs(SORTIE, exist_ok=True)
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    # copie en JS pour que l'application marche aussi en ouvrant index.html sans serveur
    with open(os.path.join(SORTIE, "chromosomes.js"), "w", encoding="utf-8") as f:
        f.write("window.CHROMOSOMES = " + json.dumps(index, ensure_ascii=False) + ";\n")


if __name__ == "__main__":
    main()
