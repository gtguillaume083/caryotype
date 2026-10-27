"""Étape 1 : repère les objets sombres d'un caryogramme et produit une image annotée.

Usage : python analyser.py <image> <sortie.png> [seuil] [dilatation]
Chaque objet reçoit un numéro ; on s'en sert ensuite dans decouper.py
pour dire quel chromosome correspond à quel objet.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi


def objets(chemin, seuil=200, dilatation=3, aire_min=40):
    img = Image.open(chemin).convert("RGB")
    rgb = np.asarray(img).astype(int)
    gris = rgb.mean(axis=2)
    # pixels colorés (annotations, filigranes) : on les ignore
    satur = rgb.max(axis=2) - rgb.min(axis=2)
    masque = (gris < seuil) & (satur < 60)
    masque = ndi.binary_opening(masque, iterations=1)
    lie = ndi.binary_dilation(masque, iterations=dilatation) if dilatation else masque
    lab, n = ndi.label(lie)
    lab = lab * masque
    res = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if sl is None:
            continue
        aire = int((lab[sl] == i).sum())
        if aire < aire_min:
            continue
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        res.append(dict(id=i, x0=x0, y0=y0, x1=x1, y1=y1, aire=aire,
                        cx=(x0 + x1) / 2, cy=(y0 + y1) / 2))
    return img, lab, res


def main():
    chemin, sortie = sys.argv[1], sys.argv[2]
    seuil = int(sys.argv[3]) if len(sys.argv) > 3 else 200
    dil = int(sys.argv[4]) if len(sys.argv) > 4 else 3
    img, lab, res = objets(chemin, seuil, dil)
    d = ImageDraw.Draw(img)
    for k, o in enumerate(sorted(res, key=lambda o: (o["cy"], o["cx"]))):
        d.rectangle([o["x0"], o["y0"], o["x1"], o["y1"]], outline="red")
        d.text((o["x0"], o["y0"] - 10), str(o["id"]), fill="blue")
        print(o["id"], o["x0"], o["y0"], o["x1"] - o["x0"], o["y1"] - o["y0"], o["aire"])
    img.save(sortie)
    print(len(res), "objets")


if __name__ == "__main__":
    main()
