# Cahier des charges — Jeu de Football Web Professionnel (Multijoueur Online/Offline)

## Prompt maître à donner à l'IA / équipe de développement

> "Développe un jeu de football web professionnel en Angular 20 + TypeScript + Babylon.js + Cannon-es, jouable en solo (contre l'IA), en local à deux joueurs, et en multijoueur en ligne (temps réel), fonctionnant sur PC, tablette et mobile à 60 FPS. Le jeu doit inclure 50 équipes (clubs et sélections nationales) avec 22 joueurs chacune (11 titulaires + 11 remplaçants), 10 stades sélectionnables avec vestiaires, un public animé, un arbitre avec assistants, un banc de touche fonctionnel, un flux de configuration de match en 5 étapes, un déroulement de match complet respectant les règles officielles du football (durée, hors-jeu, fautes, cartons, corners, touches, penalties, remplacements), et une interface de reprise/rejouabilité en fin de match."

---

## 1. Vision générale du produit

Le jeu doit reproduire l'expérience d'un titre de football arcade/simulation moderne (type mobile premium), avec une attention particulière portée à :
- L'**immersion** (vestiaires, tunnel, entrée sur pelouse, ambiance de stade, public réactif)
- La **personnalisation** (équipes, joueurs, maillots, tactiques)
- La **jouabilité multiplateforme** (clavier, manette, tactile)
- La **persistance** (sauvegarde de progression, statistiques, championnat)
- La **rejouabilité** (multijoueur en ligne/hors ligne, options de reprise)

---

## 2. Infrastructures

### 2.1 Stades (10 stades sélectionnables)

Chaque stade doit être un environnement 3D distinct, avec ses propres caractéristiques :

| Élément | Détail |
|---|---|
| Nom et identité visuelle | 10 stades uniques (architecture, couleurs, logo au sol) |
| Capacité | Variable (15 000 à 90 000 places) affichée à l'écran de sélection |
| Tribunes | Modèles 3D avec public animé (voir section 3) |
| Éclairage | Projecteurs configurables jour/nuit |
| Pelouse | Texture en bandes tondues, état modifiable (sec, mouillé, neigeux) selon météo |
| Panneaux publicitaires | Bord de terrain, animés ou statiques (fictifs, pas de marques réelles) |
| Vestiaires | Un vestiaire modélisé par équipe (local/visiteur), avec casiers, bancs, écusson |
| Tunnel des joueurs | Couloir reliant vestiaires → pelouse, utilisé pour la cinématique d'entrée |
| Zone technique | Bancs de touche des deux équipes en bordure de terrain |
| Ballon | Sélectionnable indépendamment du stade (voir Step 2) |

**Exigence technique** : chaque stade est chargé comme un module 3D indépendant (asset bundle) pour ne pas surcharger le temps de chargement initial — chargement à la demande (lazy loading) lors du Step 2 de configuration.

### 2.2 Vestiaires

- Modélisés pour les deux équipes (local et visiteur), visuellement différenciés par les couleurs du club/pays sélectionné
- Séquence d'avant-match : joueurs alignés, écran tactique affiché, sortie synchronisée des deux équipes
- Séquence de mi-temps : retour aux vestiaires à la 45e minute, ré-affichage du récapitulatif tactique, possibilité de changer la formation ou de faire des remplacements avant la reprise

---

## 3. Le public

- Foule 3D animée par sections de tribune (sprites animés ou instanciation low-poly pour la performance)
- Réactions synchronisées aux événements du match : but, carton, occasion manquée, mi-temps, fin de match
- Ambiance sonore dynamique (voir section 8) : chants, huées, exclamations, vague
- Niveau de remplissage du stade paramétrable (affecte l'ambiance sonore et visuelle) — peut varier selon l'importance du match (championnat vs amical)

---

## 4. Acteurs principaux

### 4.1 Joueurs

- **50 équipes** au total (mélange clubs et sélections nationales), chacune avec :
  - 22 joueurs : **Équipe A** = 11 titulaires, **Équipe B** = 11 remplaçants
  - Formation tactique pré-configurée par équipe (4-4-2, 4-3-3, 3-5-2, 5-3-2, etc. — déjà définies dans le fichier de données des équipes)
  - Attributs par joueur : vitesse, accélération, puissance de tir, précision de passe, dribble, tacle, endurance (stamina), placement défensif/offensif, réflexes (gardien)
  - Poste : GK, DEF (central/latéral), MID (défensif/relayeur/offensif), ATT (ailier/avant-centre)
  - Apparence personnalisable : maillot (domicile/extérieur), numéro, nom flocké, couleur des crampons (options cosmétiques)

### 4.2 Arbitres

- 1 arbitre central : gère les fautes, cartons, penalties, hors-jeu, coup d'envoi, coups de sifflet (début/fin de mi-temps, arrêt de jeu)
- 2 arbitres assistants (lignes de touche) : signalent hors-jeu et sorties de balle (peuvent être purement visuels ou influencer l'IA de décision)
- Moteur d'arbitrage (`RefereeEngine`) : logique centralisée de détection des infractions, indépendante du rendu

### 4.3 Remplaçants et banc de touche

- Les 11 joueurs de l'équipe B (remplaçants) sont visibles sur le banc de touche pendant le match
- Entraîneur/staff technique optionnel visible en zone technique (élément d'ambiance)
- Système de remplacement en cours de match (voir section 7.6) : jusqu'à 5 changements par équipe, interface dédiée pour sélectionner le joueur sortant/entrant sans interrompre l'expérience du joueur humain

---

## 5. Équipes, données et personnalisation

- Base de données de 50 équipes (fichier JSON/DB structuré : nom, pays/club, logo, couleurs maillot domicile/extérieur, liste des 22 joueurs avec attributs, formation par défaut)
- Deux catégories sélectionnables : **PAYS** (sélections nationales) et **CLUB**
- Personnalisation avant match : renommer un joueur, changer son numéro, ajuster la formation, choisir le capitaine
- Éditeur de tactique : positionnement sur le terrain (drag & drop des postes), agressivité du pressing, largeur du bloc défensif

---

## 6. Flux de configuration multi-étapes (avant-match)

### Step 1 — Équipes et joueurs
- Choix du type de rencontre (amical, championnat, coupe, tournoi)
- Choix de la catégorie : PAYS ou CLUB (pour chaque camp, joueur 1 et joueur 2 / IA)
- Sélection de l'équipe parmi les 50 disponibles
- Affichage des 22 joueurs (11 titulaires + 11 remplaçants), possibilité de personnaliser
- Choix des maillots (domicile/extérieur, gestion automatique du conflit de couleurs)
- Choix/ajustement de la formation tactique
- Réglage des paramètres tactiques (pressing, largeur, style de jeu)

### Step 2 — Environnement du match
- Choix du stade parmi les 10 disponibles
- Choix du ballon (modèle/skin)
- Choix des conditions climatiques : soleil, pluie, neige (impact gameplay : glissade, visibilité, rebond du ballon)
- Choix jour/nuit (affecte l'éclairage et l'ambiance)

### Step 3 — Mode de jeu et contrôles
- Choix du mode : Joueur vs IA / Joueur vs Joueur (local) / Multijoueur en ligne
- Configuration des contrôles : clavier (WASD + touches d'action) ou détection automatique de manette(s) connectée(s)
- Attribution manette/clavier par joueur en mode local à deux
- Réglage de la difficulté de l'IA (si applicable)
- Durée du match configurable (ex : 2x3, 2x5, ou 2x45 min réglementaires)

### Step 4 — Récapitulatif
- Écran de synthèse de tous les choix (équipes, joueurs, stade, météo, mode, contrôles)
- Possibilité de revenir modifier n'importe quelle étape précédente sans tout recommencer
- Bouton de validation finale

### Step 5 — Lancement
- Écran de chargement (chargement des assets du stade choisi)
- Lancement de la séquence d'entrée sur le terrain (voir section 6 bis)

---

## 6 bis. Séquence d'entrée des acteurs

1. Vue des vestiaires (équipe locale et visiteur), joueurs alignés
2. Sortie synchronisée par le tunnel vers la pelouse
3. Alignement protocolaire (hymnes optionnels, poignées de main arbitre/capitaines)
4. Positionnement initial selon la formation choisie
5. Coup d'envoi sifflé par l'arbitre → début du match

---

## 7. Déroulement du match

### 7.1 Durée et structure
- Match réglementaire : 2 x 45 minutes + temps additionnel calculé selon les arrêts de jeu
- Mi-temps : retour aux vestiaires, écran tactique, possibilité de changements
- Prolongations et tirs au but si égalité en phase à élimination directe (championnat/coupe)
- Durée réduite configurable pour les sessions rapides (Step 3)

### 7.2 Règles à implémenter (moteur `RefereeEngine`)
- But valide (ballon franchissant entièrement la ligne entre les poteaux)
- Hors-jeu (avec option de simplification/désactivation en mode casual)
- Fautes → coup franc, carton jaune/rouge selon la gravité
- Penalty en cas de faute dans la surface de réparation
- Touche, corner, six mètres selon la sortie du ballon
- Arrêts de jeu et reprises correspondantes

### 7.3 Contrôles en jeu
- Déplacement : WASD / flèches / stick manette
- Passe courte / passe longue / centre (touches dédiées)
- Tir avec jauge de puissance (maintien de touche)
- Tacle / pressing
- Changement de joueur contrôlé (le plus proche du ballon, automatique ou manuel)
- Sprint avec gestion de l'endurance (stamina)

### 7.4 IA des joueurs non contrôlés
- Coéquipiers : placement, appels de balle, soutien défensif
- Adversaires : pressing, marquage, anticipation, tirs au but
- Niveaux de difficulté ajustables

### 7.5 Score et statistiques
- Score affiché en temps réel + chronomètre
- Statistiques de fin de match : possession, tirs (cadrés/non cadrés), passes réussies, fautes, cartons, corners
- Score final affiché à la fin du match avec résumé complet

### 7.6 Remplacements en cours de match
- Interface dédiée accessible en pause ou à la mi-temps
- Sélection du joueur sortant (équipe A) et entrant (équipe B/remplaçants)
- Maximum 5 remplacements par équipe (règle officielle) — configurable en mode casual
- Mise à jour immédiate du joueur contrôlable si le joueur remplacé était contrôlé par l'utilisateur

---

## 8. Son et ambiance

- Bruit de foule dynamique et réactif aux événements
- Sifflet d'arbitre (coup d'envoi, faute, fin de mi-temps/match)
- Sons de frappe de balle, contacts, glissades (variables selon la météo)
- Commentaire simplifié (optionnel) sur les moments clés (but, carton, fin de match)
- WebAudio API pour la spatialisation du son selon la caméra

---

## 9. Multijoueur — en ligne et hors ligne

### 9.1 Hors ligne
- Joueur vs IA
- Deux joueurs en local sur le même écran (clavier + manette, ou deux manettes)

### 9.2 En ligne
- Matchmaking ou création de salon privé (code de session à partager)
- Synchronisation temps réel de la position des joueurs, du ballon et des événements (architecture client-serveur avec réconciliation d'état pour compenser la latence)
- Backend Spring Boot : gestion des sessions de match, comptes utilisateurs, classement, historique
- Reconnexion en cas de coupure réseau (tolérance de quelques secondes avant abandon du match)

### 9.3 Championnat et classement
- Mode championnat entre équipes sélectionnées, calendrier de matchs
- Classement (points, victoires/nuls/défaites, différence de buts)
- Sauvegarde de la progression (compte utilisateur via backend, ou localStorage en mode hors ligne)

---

## 10. Fin de match et options de reprise

- Écran de résultat : score final, meilleur joueur du match, statistiques complètes
- Options proposées :
  - **Rejouer** le même match (mêmes équipes/paramètres)
  - **Revenir au réglage** (Step 1) pour changer d'équipe, de stade ou de mode
  - **Quitter** vers le menu principal
  - (Si mode championnat) **Match suivant** du calendrier

---

## 11. Architecture technique recommandée

```
Frontend (Angular 20 + TypeScript)
│
├── Accueil
├── Sélection Step1→Step5 (configuration multi-étapes)
├── Boutique / Personnalisation
├── Carrière / Championnat
├── Paramètres
└── MatchComponent
        ├── RenderEngine (Babylon.js)
        ├── PhysicsEngine (Cannon-es)
        ├── BallSystem
        ├── PlayerAI
        ├── RefereeEngine
        ├── MatchEngine (temps, score, périodes)
        ├── SubstitutionEngine (remplacements, banc de touche)
        ├── CrowdEngine (public, ambiance)
        ├── AudioEngine (WebAudio API)
        └── NetworkEngine (multijoueur en ligne, sync temps réel)

Backend (Spring Boot)
├── Gestion des comptes et authentification
├── Gestion des équipes/joueurs (base de données des 50 équipes)
├── Matchmaking et sessions multijoueur
├── Championnats et classements
└── Sauvegarde de progression
```

---

## 12. Points complémentaires à considérer (non mentionnés initialement)

- **Accessibilité** : options de daltonisme, remapping des touches, taille des textes UI
- **Responsive design** : adaptation de l'interface et des contrôles tactiles pour tablette/mobile (boutons virtuels superposés au terrain)
- **Anti-triche basique** côté serveur pour le mode en ligne (validation des positions/actions côté backend)
- **Système de replay/ralenti** sur les buts et actions marquantes (mentionné en "niveau avancé" dans le document source — à prévoir dès le MVP pour l'immersion)
- **Tests de performance** : profilage pour garantir 60 FPS sur mobile bas de gamme, avec option de qualité graphique réglable (bas/moyen/élevé)
- **Gestion des blessures** (optionnel) : sortie forcée d'un joueur, remplacement obligatoire
- **Mode entraînement** : terrain vide pour s'exercer aux tirs/passes hors match
- **Internationalisation (i18n)** : prévoir le multilingue dès l'architecture (français/anglais minimum)
- **Écran de pause** : accessible en solo et en local, désactivé ou remplacé par un vote en ligne
- **Cinématique de célébration de but** : courte animation différenciée selon le joueur buteur

---

## 13. Feuille de route suggérée (par phases)

| Phase | Contenu | Objectif |
|---|---|---|
| MVP | 1 stade, 2 équipes, match rapide sans hors-jeu, contrôles de base | Valider le moteur physique et les contrôles |
| V1 | 10 stades, 50 équipes, règles complètes, remplacements, mi-temps | Expérience complète solo/local |
| V2 | Multijoueur en ligne, championnat, classement, sauvegarde backend | Rejouabilité et compétition |
| V3 | Replays, personnalisation avancée, carrière, statistiques poussées | Polish et rétention |

---

*Ce document sert de prompt/cahier des charges à fournir à une IA de développement ou à une équipe technique pour cadrer l'ensemble des fonctionnalités attendues du jeu.*
