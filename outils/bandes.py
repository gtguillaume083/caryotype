"""Convertit les bandes cytogénétiques de l'UCSC (hg38, cytoBand.txt.gz)
en un fichier JavaScript léger utilisé pour dessiner les chromosomes.

Les sous-bandes (ex. q22.11, q22.12, q22.13) sont regroupées au niveau
« q22.1 » : on obtient une résolution d'environ 400 bandes, lisible à l'écran.

Usage : python bandes.py
"""
import gzip
import json
import os
import re

ICI = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.join(ICI, "sources", "ucsc", "cytoBand.txt.gz")
SORTIE = os.path.join(ICI, "..", "app", "js", "bandes.js")

INTENSITE = {"gneg": 0, "gpos25": 0.25, "gpos50": 0.5, "gpos75": 0.75,
             "gpos100": 1, "gvar": 0.65}


def niveau_400(nom):
    m = re.match(r"([pq]\d+)(?:\.(\d))?", nom)
    return m.group(1) + ("." + m.group(2) if m.group(2) else "")


def main():
    chromos = {}
    with gzip.open(SOURCE, "rt") as f:
        for ligne in f:
            champs = ligne.rstrip("\n").split("\t")
            if len(champs) != 5 or not champs[3]:
                continue
            chrom, debut, fin, nom, coloration = champs
            c = chrom[3:]
            if not re.fullmatch(r"\d+|X|Y", c):
                continue
            chromos.setdefault(c, []).append((int(debut), int(fin), nom, coloration))

    donnees = {}
    for c, bandes in chromos.items():
        longueur = bandes[-1][1]
        centro = [b for b in bandes if b[3] == "acen"]
        pos_centro = centro[0][1] / longueur  # fin de p11.1
        liste = []
        for debut, fin, nom, col in bandes:
            if col == "acen":
                continue  # le centromère est dessiné comme une constriction
            nature = "tige" if col == "stalk" else "bande"
            groupe = niveau_400(nom)
            i = INTENSITE.get(col, 0)
            prec = liste[-1] if liste else None
            if prec and prec["n"] == groupe and prec["t"] == nature:
                tot = (prec["f"] - prec["d"]) + (fin - debut)
                prec["i"] = (prec["i"] * (prec["f"] - prec["d"]) + i * (fin - debut)) / tot
                prec["f"] = fin
            else:
                liste.append(dict(n=groupe, t=nature, d=debut, f=fin, i=i))
        donnees[c] = dict(
            mb=round(longueur / 1e6, 1),
            centro=round(pos_centro, 4),
            # [début, fin] en fraction de la longueur, intensité 0 (clair) à 1 (sombre)
            bandes=[[round(b["d"] / longueur, 4), round(b["f"] / longueur, 4),
                     round(b["i"], 2), b["n"]] + (["tige"] if b["t"] == "tige" else [])
                    for b in liste],
        )
    ordre = [str(i) for i in range(1, 23)] + ["X", "Y"]
    donnees = {c: donnees[c] for c in ordre}
    with open(SORTIE, "w", encoding="utf-8") as f:
        f.write("// Généré par outils/bandes.py à partir de UCSC hg38 cytoBand (domaine public).\n")
        f.write("window.BANDES = " + json.dumps(donnees, separators=(",", ":")) + ";\n")
    print({c: len(d["bandes"]) for c, d in donnees.items()})


if __name__ == "__main__":
    main()
