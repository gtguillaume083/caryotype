# Caryotype

Application web libre pour apprendre à **réaliser et analyser un caryotype humain** en SVT au collège (cycle 4).

L'élève fait glisser les chromosomes d'une « lame de microscope » vers le caryogramme, puis répond aux questions de la mission :

| Mission | Ce que fait l'élève |
|---|---|
| Reconstituer un caryotype | Classer les chromosomes par paires (1 à 22, X, Y) |
| Fille ou garçon ? | Classer, puis déterminer le sexe |
| Rechercher une anomalie | Compter les chromosomes, repérer un chromosome en trop ou en moins |
| Analyse complète | Sexe, anomalie et formule chromosomique (ex. `47,XY,+21`) |

## Deux sortes de chromosomes

- **Chromosomes dessinés** : générés en SVG à partir des vraies bandes G humaines (UCSC, GRCh38). Chaque caryotype est différent (longueur, courbure, contraste), ce qui donne un nombre illimité d'exercices : 46,XX ; 46,XY ; trisomies 21, 18, 13 ; Turner (45,X) ; Klinefelter (47,XXY) ; 47,XYY ; 47,XXX.
- **Photos réelles** : chromosomes découpés dans de vrais caryogrammes sous licence libre (Wikimedia Commons).

## Pour l'enseignant

Le bouton **Espace enseignant**, sur la page d'accueil, permet de :

- choisir la mission, les caryotypes possibles (un est tiré au hasard pour chaque élève) et les aides ;
- copier un **lien** à donner aux élèves (ENT, Pronote, QR code) ;
- **corriger** : chaque élève a un code de caryotype (en haut de l'écran et sur la feuille imprimée) qui rouvre exactement son caryotype avec la solution.

Rien n'est envoyé sur Internet : pas de compte, pas de collecte de données. Le travail en cours est seulement gardé dans le navigateur de l'élève. Le bouton **Imprimer** produit une feuille (ou un PDF) avec le nom de l'élève, son caryogramme et ses réponses.

## Utilisation

- En ligne : la page publiée par GitLab Pages (voir `.gitlab-ci.yml`).
- Hors ligne : ouvrir `app/index.html` dans un navigateur (aucune installation, aucun serveur nécessaire).

## Structure

```
app/                  l'application (fichiers statiques)
  index.html
  css/style.css
  js/bandes.js        bandes G des 24 chromosomes (généré)
  js/chromosome.js    dessin vectoriel d'un chromosome
  js/cas.js           caryotypes proposés, analyse des formules
  js/app.js           interface
  donnees/            chromosomes découpés dans les photos (générés)
outils/               scripts Python de préparation des données
  bandes.py           cytoBand UCSC -> app/js/bandes.js
  analyser.py         repère les objets d'un caryogramme (image annotée)
  decouper.py         découpe et classe les chromosomes des photos
  sources/            fichiers d'origine
```

Pour ajouter une photo de caryogramme : la placer dans `outils/sources/karyogrammes/`, ajouter une entrée dans `CAS` de `outils/decouper.py` (seuil, rangées attendues), lancer `python outils/decouper.py <nom>`, contrôler l'image produite dans `outils/controle/`, puis déclarer le cas dans `app/js/cas.js` avec ses crédits. Les scripts demandent `numpy`, `scipy` et `Pillow`.

## Licences

- Code : [GNU GPL v3](LICENSE).
- Bandes chromosomiques : UCSC Genome Browser, GRCh38/hg38 `cytoBand`, domaine public.
- Photos de caryotypes et chromosomes découpés qui en sont tirés : licence de chaque image d'origine.
  - 46,XY : National Human Genome Research Institute (NHGRI), domaine public.
  - 48,XXXX (et le montage 46,XX qui en est tiré) : A. Hineno, T. Kosho, H. Kato, Y. Sekijima, CC BY 4.0.
  - 47,XX,+21 : Laura21.de, CC BY-SA 1.0.
  - 47,XY,+18 : Serra Amoros, CC BY-SA 4.0.
  - 45,X : Wikimedia Commons « 45,X.jpg », CC BY-SA 3.0.
  - 47,XXY : Wikimedia Commons « 47,XXY.jpg », CC BY-SA 3.0.
