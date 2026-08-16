# Plan de développement - Jeu de Football 3D

## ⚠️ Bug critique corrigé (le plus important trouvé à ce jour)
Le monde physique Rapier (`this.world`) n'était **jamais avancé** : `world.step()` n'était appelé nulle part
dans tout le module. Les vitesses/impulsions (déplacement joueur, tirs, passes, tacles, gravité) étaient bien
réglées mais jamais intégrées en position — seuls les repositionnements directs (`setTranslation`, coup d'envoi,
remise en jeu) fonctionnaient. Concrètement : **rien ne bougeait jamais par la physique**, malgré tout le travail
de cette session sur l'IA/l'arbitre/les tacles. Corrigé (`football.component.ts`, boucle de jeu) en ajoutant
`this.world.step()` chaque frame. Découverte du même coup d'un second bug latent : la pelouse (mesh visuel de
`stadium.service.ts`) n'avait **aucun collider physique** — une fois la gravité effectivement appliquée, joueurs
et ballon tombaient à l'infini à travers le sol. Un sol physique statique (corps fixe + collider cuboid) a été
ajouté dans `initScene()`. Les deux bugs corrigés ensemble et vérifiés (joueurs qui se répartissent tactiquement
au lieu de rester figés au coup d'envoi, via capture d'écran après simulation prolongée).

- [x] **Bug corrigé** : un but marqué était retraité une seconde fois par `checkOutOfBounds()` juste après
  `checkGoals()` (même frame) — double notification "But!" et reset immédiat du ballon qui court-circuitait
  la célébration de 3s. Corrigé par un garde `if (this.gameState.match.isGoalScored) return;`.
- [x] **Changement de camp réel à la mi-temps** (et entre les deux prolongations) : les deux équipes inversent
  désormais le but qu'elles défendent — repositionnement physique des joueurs (`swapSides()`) + un flag
  `sideSwapped` propagé à `AIService`/`BallService`/`RefereeService` pour que direction d'attaque, détection de
  but, corners/six-mètres et penalty restent cohérents des deux côtés. Avant ça, une équipe défendait le même
  but pendant tout le match, ce qui n'est pas conforme aux règles et ajoutait de la confusion visuelle.
- [x] Caméra par défaut passée en vue aérienne bien plus verticale (bird's eye) et **verrouillée par défaut**
  (l'utilisateur doit explicitement déverrouiller via le menu clic droit pour faire pivoter la vue) — évite la
  confusion "qui est à droite" signalée, la pelouse a aussi une allure de vrai rectangle vu du dessus au lieu
  d'être déformée par la perspective.
- [x] Rappel des contrôles clavier affiché en jeu (coin bas-gauche, fermable), en plus des boutons tactiles déjà
  affichés sur mobile.
- [x] **Bug corrigé (orientation du terrain)** : la caméra (`alpha = Math.PI / 2`) affichait la longueur du
  terrain (105m) à la verticale et la largeur (68m) à l'horizontale — terrain "en portrait", pas conforme à la
  référence `footBall/stade/pelouseTracee3.jpg` (buts à gauche/droite, ligne médiane verticale, terrain "en
  paysage"). Corrigé en passant `alpha` à `0` dans `initScene()` (football.component.ts). Vérifié par capture
  d'écran headless après coup d'envoi : buts bien à gauche et à droite, ligne médiane verticale, cercle central,
  arcs de penalty ("D") visibles de chaque côté, proportions ~1.53 (attendu 105/68 ≈ 1.54) — conforme à la
  référence.
- [x] **Bugs corrigés (marquage du terrain totalement absent/mal placé)** — découverts en comparant une capture
  d'écran à `pelouseTracee3.jpg` puis en dumpant les bounding boxes réelles des meshes dans un navigateur headless
  (aucune supposition, mesures directes) :
  - `createField()` (stadium.service.ts) créait la pelouse avec `CreateGround({width: LENGTH+marge, height:
    WIDTH+marge})` — or `CreateGround` mappe `width`→X et `height`→Z, et tout le reste du code (buts, piste)
    positionne la longueur sur Z et la largeur sur X. La pelouse était donc large de 125m en X et profonde de
    seulement 88m en Z, alors que les buts sont à z=±52,5m : **la pelouse n'atteignait même pas les lignes de
    but**, coupée net avant. Corrigé en inversant width/height (`width: WIDTH+marge`, `height: LENGTH+marge`).
  - `createFieldLines()` (ligne médiane, lignes de touche, lignes de but) utilisait des `CreatePlane` pivotés
    (`rotation.x = PI/2`, et `rotation.z = PI/2` en plus pour les lignes de touche) : la combinaison de rotations
    inversait quel axe local (largeur/hauteur du plane) correspondait à X ou Z selon le mesh, produisant des
    segments complètement hors-terrain ou superposés au mauvais endroit (vérifié par bounding box : lignes de
    touche quasi confondues sur un même point central au lieu de courir le long des deux côtés). Aucun contour
    fermé n'existait autour du terrain, exactement le symptôme signalé.
  - `createCenterCircle()` : le rond central (`CreateTorus`) est **déjà à plat** par défaut chez Babylon (plan
    XZ) — la rotation `PI/2` en X ajoutée dans le code le faisait au contraire basculer à la verticale (plan XY),
    invisible ou juste une tranche depuis une caméra quasi zénithale. Le point central (`CreateDisc`) avait le
    problème inverse : un disque est vertical par défaut, et il lui **manquait** cette même rotation pour être à
    plat.
  - Les points de penalty (`CreateDisc`) souffraient du même bug que le point central (rotation manquante).
  - **Solution retenue** : plutôt que corriger rotation par rotation (source d'erreurs à répétition), tout le
    marquage (contour, ligne médiane, rond central + point, surfaces de réparation et de but, points de penalty,
    arcs de penalty, arcs de corner) est désormais dessiné en une seule fois dans un canvas 2D (proportions et
    formules trigonométriques FIFA identiques à avant) appliqué comme texture sur un unique ground plat aux
    dimensions exactes du terrain (`createFieldMarkings()`/`createFieldMarkingsTexture()`) — élimine toute
    ambiguïté de rotation. Les anciens remplissages gris semi-transparents des surfaces (qui ne correspondaient
    pas à la référence, une pelouse propre avec uniquement des lignes blanches) ont été retirés au passage.
  - Vérifié par capture d'écran finale + zoom sur chaque zone (coin, but, centre) : contour fermé, ligne médiane,
    rond central, surfaces avec petit rectangle imbriqué, point de penalty, arc en "D", arcs de corner — tout est
    présent et correctement proportionné, conforme à `pelouseTracee3.jpg`.

## Phase 1 - Règles complètes (en cours)
- [x] Hors-jeu fonctionnel dans referee.service.ts (vérifié à chaque passe humaine, coup franc pour l'adversaire si signalé)
- [x] Fautes et cartons (jaune/rouge) branchés sur le tacle (touche F) — pas encore d'animation dédiée, juste une notification
- [x] Coups francs, penalties (déclenchés par checkFoul, positionnement du ballon via getFreeKickPosition/getPenaltyPosition)
- [x] Touches et six mètres (déjà branchés via checkOutOfBounds/determineRestart, sans animation)
- [x] Détection des fautes dans la surface → penalty (isInPenaltyArea appelé depuis le tacle)
- [x] **Distinction coup franc direct vs indirect** (`RefereeDecision.restartKind`) : les fautes de contact (tacle)
  et la main volontaire sont toujours DIRECTES (loi 12.1) ; la passe en retrait illégale au gardien (voir
  ci-dessous) est INDIRECTE (loi 12.2) — c'est la seule source d'indirect actuellement modélisée, les autres
  fautes indirectes réelles (jeu dangereux, obstruction) n'ont pas de détection dédiée.
- [x] **Mur défensif à 9,15m** (`RefereeService.getWallPositions()`) : pour tout coup franc (direct ou indirect) à
  moins de 40m du but défendu, les 2 à 4 défenseurs les plus proches du ballon (hors gardien) sont repositionnés
  sur la ligne ballon→but à 9,15m ; le jeu est brièvement gelé (`setPieceActive`, même mécanisme que la
  célébration de but) le temps que le mur se forme, sans quoi l'IA les aurait fait bouger instantanément.
- [x] **Règle de l'avantage** (`evaluateAdvantage()`) : une faute simple (sans carton, hors surface) n'est plus
  sifflée immédiatement — le jeu continue ~1,5s ; si l'équipe fautée garde le ballon pendant ce délai, la faute
  est oubliée ("👐 Avantage !"), sinon elle est sifflée rétroactivement à l'endroit exact du tacle. Cartons et
  penalties restent toujours sifflés immédiatement (l'avantage ne s'applique jamais aux sanctions, et un penalty
  ne doit pas laisser planer le doute).
- [x] **Passe en retrait illégale au gardien** (`awardBackPassOffense()`) : le ballon suit désormais un flag
  `viaKick` (posé uniquement sur une passe/tir délibérés — E/Espace humain ou décision IA shouldPass/shouldShoot,
  pas sur un simple rebond/contact passif) ; si le gardien touche un ballon marqué `viaKick` par un coéquipier de
  champ, coup franc indirect pour l'adversaire. Approximation : sans notion de "tête/poitrine" distincte du pied
  dans le modèle physique actuel, toute passe volontaire au sol ou aérienne compte, pas seulement au pied strict.
- [x] **Main volontaire vs position naturelle** (`checkHandball()`) : détecte un contact bras/ballon (distance au
  pivot de bras) et distingue la position naturelle (bras dans l'amplitude de balancement de course normale,
  ≤0,56 rad) d'une main volontaire (bras levé au-delà, >0,75 rad) — coup franc direct ou penalty si dans la
  surface. **Limite assumée** : le rig n'ayant aucune action de blocage volontaire par défaut (les bras ne font
  que se balancer en marche/course), un défenseur dans sa propre surface a une faible chance par frame (~0,6%) de
  lever instinctivement un bras près d'un ballon aérien proche — sans ce déclencheur ajouté, la main "volontaire"
  ne se produirait jamais en l'absence d'un vrai geste de blocage animé.

## Phase 2 - Match complet
- [x] Match.service.ts branché dans football.component.ts (remplace la mi-temps codée en dur)
- [x] Mi-temps (retour au centre) — pas de changement de côté visuel du terrain
- [x] Prolongations et **tirs au but jouables** : viser (flèches) + puissance (maintenir/relâcher Espace) pour le tireur humain, plongeon du gardien (flèches) quand l'IA tire ; gardien IA qui devine plus ou moins bien selon la difficulté
- [ ] Temps additionnel (arrêts de jeu calculés selon les interruptions)

## Phase 3 - Équipes et personnalisation
- [x] 50+ équipes (clubs + sélections nationales) — 54 dans teams.data.ts
- [x] 22 joueurs par équipe (11 titulaires + 11 remplaçants), et **désormais utilisés en match** (PlayerService.createTeam prenait des joueurs procéduraux aléatoires auparavant — corrigé pour utiliser les vrais noms/stats de la feuille de match composée par le joueur)
- [x] Attributs des joueurs : vitesse/tir/passe/défense/accélération réels (teams.data.ts) + dribble/agilité/pied fort/poids/âge/forme dérivés de façon déterministe (pas de scouting réel disponible, voir roster-meta.ts)
- [x] Écran "Configuration et classement" : formation (carrousel, 10 choix), composition libre des 22 joueurs par glisser haut/bas + validation en menu contextuel, drapeau, maillot par équipe
- [x] Changement de maillots (domicile/extérieur/third dérivés des couleurs d'équipe)
- [ ] Éditeur tactique avancé (pressing, largeur de bloc, positionnement libre sur le terrain — seul l'ordre de la feuille de match est éditable pour l'instant, pas les coordonnées x/z individuelles)

## Phase 4 - Stades et environnement
- [x] **8 formes de stade réellement distinctes** (portées depuis les maquettes Three.js de référence
  `footBall/gallerieStadeOK/stade-ovale-3d(2).html` et `stades-galerie-3d.html` vers Babylon.js) — remplace
  l'ancienne liste où seule la couleur variait. Chaque stade a une vraie silhouette : **Olympia Arena** (ovale,
  stade phare ⭐, 3 tribunes, toit complet, écrans géants, panneaux publicitaires), Riverside Park (rectangulaire),
  Coliseo Central (rond), Nord Arena (hexagonal), Le Petit Parc (ovale compact "boutique"), Stade Municipal
  (une seule tribune droite), Arena Modulaire (deux tribunes droites façon site temporaire, sans toit), Centre
  d'Entraînement (pas de tribunes, simple clôture). Réglage pré-match inchangé dans la forme (même liste de
  boutons), juste enrichi.
  - Les anneaux (ovale/rond/hexagonal/boutique) sont construits par segments droits jointifs suivant le contour
    de la forme (même technique que les gradins rectangulaires existants, généralisée à un contour non
    rectangulaire) plutôt que par triangulation de polygone (aurait nécessité une dépendance externe `earcut`).
  - Les projecteurs se repositionnent automatiquement juste à l'extérieur des tribunes réellement construites
    (variable selon la forme) au lieu d'une marge fixe, sans quoi ils se retrouvaient à l'intérieur des tribunes
    des stades ronds/hexagonaux (bien plus larges qu'un stade rectangulaire).
  - **Bug corrigé (récurrent)** : le toit et les liserés dorés en anneau (`CreateTorus`) étaient pivotés de 90°
    en supposant qu'un torus est vertical par défaut — or il est **déjà à plat** dans le plan XZ par défaut
    (même bug que celui déjà rencontré et corrigé sur le rond central du terrain plus tôt dans cette session) :
    la rotation le faisait basculer à la verticale, créant une immense structure incurvée bloquant toute la vue
    dès qu'elle entrait dans le champ de la caméra. Corrigé en retirant la rotation.
  - **Bug corrigé et important (écran noir en vue large)** : en vérifiant, tout angle de caméra reculé
    (rayon > ~100) affichait un écran quasiment noir, y compris avec le préréglage "Vue large" déjà existant et
    déjà utilisé avec succès plus tôt dans cette session. Diagnostiqué en sondant position/cible caméra et limites
    des meshes un par un (rien d'anormal trouvé) puis en reconsidérant la skybox : `size: 200` (demi-étendue 100)
    alors que `FOOTBALL_CONFIG.CAMERA.MAX_DISTANCE` autorise un zoom jusqu'à 130 (170 après l'ajout de la "vue
    d'ensemble du stade" premium, voir plus bas) — dès que la caméra sortait du volume de la boîte, sa face
    proche se retrouvait entre la caméra et toute la scène, bloquant la vue. Bug **préexistant à cette session**
    (jamais un angle de caméra aussi large n'avait été vérifié par capture d'écran auparavant), révélé seulement
    maintenant. Corrigé en agrandissant la skybox (200 → 2000).
  - Ajouté au menu contextuel : **"Terrain seul"** (masque tribunes/toit/projecteurs, quelle que soit la forme du
    stade) et, uniquement si le stade choisi est premium (Olympia Arena), un bouton **"Vue d'ensemble du stade"**
    (recul de caméra pour admirer l'anneau/toit/écrans).
- [ ] La "vue d'ensemble du stade" premium reste correcte géométriquement (position/cible caméra et meshes
  vérifiés) mais son rendu exact au-delà de la découverte du bug skybox n'a pas pu être reconfirmé par capture
  d'écran (instabilité du navigateur headless en bout de session) — à revérifier visuellement à l'occasion.
- [x] Conditions météo (soleil, pluie, neige) — **impact gameplay réel** : friction/rebond du ballon modifiés (`ball.service.ts`), vitesse/accélération des joueurs (humain + IA) réduites sous la pluie/neige (glisse), en plus du brouillard visuel
- [x] Cycle jour/nuit (éclairage/projecteurs) + halo lumineux sur les projecteurs (`GlowLayer`, plus marqué de nuit)
- [x] **Bug corrigé** : la pelouse apparaissait rouge/marron — le socle du stade (teinté selon le stade choisi) était positionné au-dessus du niveau de la pelouse et la recouvrait entièrement ; corrigé + pelouse élargie jusqu'aux tribunes + vert plus vif
- [x] **Bug corrigé** : palette de la texture de foule trop chaude (rouge/orange/jaune majoritaires) donnant un lavis rougeâtre aux tribunes — rééquilibrée vers un mélange blanc/bleu/sombre plus réaliste (cf. images de référence dans `footBall/stade/`)
- [x] **Bug racine corrigé** : la pelouse/foule/ballon s'affichaient en damier rouge et noir (texture d'erreur de Babylon) — `createStripeTexture()`, `createCrowdTexture()` (stadium.service.ts) et la texture du ballon (ball.service.ts) préfixaient `canvas.toDataURL()` avec `'data:image/png;base64,'` alors que cette méthode renvoie déjà une URI data: complète ; le préfixe dupliqué rendait l'URL invalide (`net::ERR_INVALID_URL`, confirmé via un navigateur headless). Corrigé aux 3 endroits + vérifié visuellement après correction.
- [x] Verrouillage de la caméra (bouton HUD) pour empêcher la rotation accidentelle du stade en cours de jeu
- [x] Piste d'athlétisme rouge autour du terrain (cadre rectangulaire texturé, façon tartan) inspirée de `footBall/stade/peouse1.jpg` — marge du stade élargie (5→10) pour lui faire de la place, projecteurs repositionnés en conséquence
- [x] **Bug corrigé** : l'arc de penalty ("D", règle FIFA — portion du cercle de rayon 9,15m centré sur le point de penalty qui dépasse de la surface) n'existait pas du tout, seul le point était dessiné. Ajouté avec la géométrie trigonométrique correcte (vérifiée à la main).
- [ ] Public animé visuellement (les tribunes existent mais ne bougent pas ; l'ambiance sonore de foule existe en revanche, voir Phase 5)
- [ ] Stades avec vraie identité 3D par lieu (vestiaires, tunnel, architecture propre — cf. `footBall/stade/1.jpeg`-`4.jpeg`) : chantier plus lourd, pas commencé

## Phase 5 - Audio
- [x] Sons de coup de pied, sifflet, cartons, but — **synthétisés en direct via Web Audio API** (pas de fichiers audio téléchargés/licenciés, voir `audio.service.ts`)
- [x] Ambiance de foule continue (bruit filtré en boucle, intensité selon le style choisi + capacité du stade)
- [x] Commentaire : synthèse vocale native du navigateur (`SpeechSynthesis`), phrases-modèles sur coup d'envoi/but/carton rouge/mi-temps/fin de match — **pas une vraie voix de commentateur enregistrée**, et la qualité/disponibilité dépend des voix installées sur l'appareil de l'utilisateur
- [ ] Musique de fond

## Phase 6 - Championnat
- [ ] Mode championnat
- [ ] Classement
- [ ] Sauvegarde localStorage

## Phase 7 - Contrôles
- [x] Support manette (Gamepad API standard : stick gauche + A/B/X/Y/Start, compatible Xbox/PlayStation/générique — voir `pollGamepad()`)
- [x] Contrôles tactiles pour mobile (joystick nipplejs + boutons d'action, affichés automatiquement sur appareil tactile)
- [x] Glisser-déposer (@angular/cdk) pour réorganiser la feuille de match, en plus des boutons Monter/Descendre (accessibilité clavier)
- [ ] Jauge de puissance pour le tir en jeu ouvert (existe déjà pour les tirs au but, pas encore pour un tir normal)
- [x] Tirs au but jouables (voir Phase 2)

## Phase 9 - IA et animation des joueurs (nouveau)
- [x] **Bug corrigé** : `shouldShoot`/`shouldPass`/`findBestPassTarget` (ai.service.ts) existaient mais n'étaient jamais appelés — l'IA ne faisait que courir autour du ballon sans jamais tirer ni passer. Branché dans `handleAIBallActions()` (football.component.ts), appelé chaque frame pour les deux équipes (sauf le joueur humain).
- [x] Animation procédurale de marche/course : balancement des jambes/bras selon la vitesse du joueur (pivots hanche/épaule, pas de rig importé) — remplace le glissement rigide des bonhommes en boîtes.
- [ ] Placement tactique plus fin (appels de balle, marquage zonal vs individuel, pressing coordonné) — l'IA actuelle est fonctionnelle mais reste simple (chase/support/mark basique par rôle).

## Phase 8 - Remplacements et pause (nouveau)
- [x] Modal pause en jeu (Continuer / Remplacement / Quitter)
- [x] Flux de remplacement : redirection vers Configuration et classement, application automatique au retour, limité par le nombre de remplacements configuré
- [x] Étiquette nom/numéro au-dessus du joueur sélectionné et du porteur du ballon (option activable/désactivable)
- [ ] Animation/cinématique du remplacement (sortie/entrée de terrain)

## Phase 10 - Menu contextuel enrichi, taille des joueurs, reset après but/période, ralenti (nouveau)
- [x] **Taille des joueurs** : réglage de base avant le coup d'envoi (Normale/Grande/Très grande, écran Réglages —
  affecte le mesh ET le collider physique) + ajustement visuel en direct pendant le match via le menu contextuel
  (`PlayerService.setLiveScaleMultiplier()`, un multiplicateur appliqué par-dessus la taille de base, sans toucher
  aux colliders déjà créés).
- [x] **Caméra** dans le menu contextuel : zoom avant/arrière, et 4 presets d'angle (Tactique/Large/Diffusion
  TV/Rapprochée, `CAMERA_PRESETS` dans football.config.ts) — fonctionnent même vue verrouillée puisqu'ils fixent
  directement alpha/beta/radius plutôt que de dépendre du contrôle souris.
- [x] **Stopper la célébration de but** (menu contextuel, visible uniquement pendant une célébration) : déclenche
  immédiatement ce qui se serait produit après les 3s (`endGoalCelebration()`), plutôt que d'attendre.
- [x] **Bug corrigé (reset incomplet après un but)** : seul le ballon était recentré après la célébration, les
  joueurs restaient figés où ils étaient au moment du but. `repositionPlayersToFormation()` (factorisée à partir
  de `swapSides()`) replace désormais aussi tous les joueurs à leur poste de formation, à la fois après un but et
  à chaque début de période (prolongations comprises — `prolongation-2` n'était même pas géré du tout auparavant,
  ajouté).
- [x] **Ralenti / revoir le but** (menu contextuel, visible si un but vient d'être marqué) : tampon glissant des
  positions ballon+joueurs (~4s à 60 fps) enregistré en continu pendant le jeu ; sur un but, les ~4 dernières
  secondes sont figées et rejouables 2x plus lentement en pilotant les meshes directement depuis le tampon (jeu
  mis en pause pendant la lecture, reprise automatique à la fin).
- [x] **Modale d'aide "Comment jouer"** (menu contextuel) : contrôles clavier en grille avec icônes `<kbd>`,
  section "comment marquer", section menu contextuel — design cohérent avec le reste du HUD (fond translucide
  sombre, coins arrondis, accents verts).
- [x] **Bug corrigé (ballon à peine visible)** : le modèle 3D réel du ballon (Poly Haven) contient DEUX variantes
  ("football_deflated" et "football_inflated", probablement prévues pour une animation de gonflage), toutes deux
  chargées et rendues **en même temps**. La boîte englobante combinée des deux (utilisée pour remettre le modèle
  à l'échelle du ballon configuré) était donc asymétrique — la variante dégonflée n'est pas une sphère centrée —
  ce qui faisait calculer une mise à l'échelle beaucoup trop petite pour la vraie sphère. Diagnostiqué en dumpant
  la géométrie réelle (nom, sommets, boîte englobante locale de chaque mesh du modèle importé) dans un navigateur
  headless plutôt qu'en devinant. Corrigé en ne gardant que "football_inflated" (la vraie sphère) et en jetant
  l'autre variante avant de calculer l'échelle. Le ballon est en plus grossi visuellement d'un facteur 2,2
  (`BALL_VISUAL_SCALE`, ball.service.ts) — comme les joueurs, sa taille réelle FIFA (0,45m) le rendait minuscule
  à l'écran vu la caméra tactique éloignée ; le collider physique garde lui la taille réelle, seul le rendu
  visuel est agrandi.
- [x] **Trajectoire du ballon** (traînée jaune vive émissive, togglable dans le menu contextuel) : le mécanisme de
  traînée existait déjà mais était quasi invisible (points blancs de 0,1m, alpha 0,3, seuil de vitesse à 10 m/s —
  ne se déclenchait que sur les tirs puissants). Points agrandis (0,22m), couleur jaune émissive contrastée,
  seuil abaissé à 5 m/s pour que les passes normales laissent aussi une trace visible du point A au point B.
- [x] **Auto-play** (menu contextuel) : l'IA prend aussi en charge le joueur normalement humain — les deux
  équipes s'affrontent seules, utile pour observer/apprendre le jeu. Implémenté en réutilisant tel quel le code
  IA existant (`AIService.update()` ignore déjà un `controlledPlayer` explicite ; lui passer `null` en auto-play
  fait qu'elle contrôle tout le monde, exactement comme elle le fait déjà pour l'équipe extérieure) — aucune
  nouvelle logique IA, juste la levée de l'exclusion du joueur humain le temps que le mode est actif.
- [x] **Noms/numéros de TOUS les joueurs** (pas seulement le sélectionné/porteur du ballon), togglable en jeu via
  le menu contextuel — étiquette avec petite flèche pointant vers le joueur, couleur selon l'équipe (bleu
  domicile/rouge extérieur), le joueur contrôlé et le porteur du ballon se distinguent par un nom complet en vert
  (les autres n'affichent que leur numéro, pour rester lisible à 22 joueurs affichés).
- [x] **Bugs corrigés (étiquettes dispersées/agglutinées, hors de la pelouse)** — deux causes distinctes, trouvées
  en dumpant les valeurs réelles (résolution du moteur, taille CSS du canvas, matrices caméra) dans un navigateur
  headless plutôt qu'en devinant :
  - Le moteur Babylon peut ne pas avoir sa taille de rendu à jour au moment où le canvas obtient sa taille CSS
    finale (masquage de l'en-tête, mise en page qui vient de basculer) — `window.resize` ne se déclenche jamais
    tout seul dans ce cas puisque la fenêtre elle-même ne change pas de taille. Le moteur restait bloqué sur une
    résolution de rendu obsolète, complètement désynchronisée de la taille réelle du canvas à l'écran. Corrigé en
    forçant `engine.resize()` une fois la scène initialisée (+ un appel différé au `requestAnimationFrame`
    suivant, pour rattraper toute mise en page qui se stabiliserait encore après coup).
  - Même une fois cette résolution à jour, `updatePlayerLabels()` utilisait `engine.getRenderWidth/Height()` pour
    la projection 3D→écran — or le moteur suréchantillonne volontairement le rendu à 2x pour la qualité
    (`setHardwareScalingLevel(0.5)`, dans `initEngine()`) : cette résolution interne ne correspond donc PAS à la
    taille CSS réelle du canvas, l'espace en pixels où les étiquettes (`[style.left.px]`/`[style.top.px]`) sont
    effectivement positionnées. Corrigé en utilisant `canvasRef.nativeElement.clientWidth/clientHeight` (la
    vraie taille CSS) pour construire le viewport de projection, au lieu de la résolution interne du moteur.
  - Séparément, le décalage vertical fixe (2,2m, en unités du monde 3D, ajouté avant projection pour placer
    l'étiquette "au-dessus de la tête") était lui aussi corrigé au passage : un tel décalage est exagéré par la
    perspective dès que la caméra n'est plus quasi zénithale (presets Diffusion TV/Rapprochée) — réduit à 0,3m,
    le report visuel "au-dessus de la tête" se faisant désormais entièrement en CSS (22px fixes, insensible à
    l'angle de caméra).
  - Vérifié par capture d'écran : chaque étiquette est maintenant exactement au-dessus du joueur correspondant,
    flèche pointée dessus, aussi bien en vue tactique par défaut qu'avec les nouveaux presets de caméra angulés.
- [x] **Temps additionnel** (Phase 2, était marqué manquant) : un but (+15s), une faute/coup franc/penalty (+6s)
  ou un carton (+12s) ajoutent du temps additionnel à la période en cours (`MatchState.stoppageSeconds`,
  `match.service.ts` prolonge la période de ce montant avant de la clore) ; l'horloge affiche "45+X" une fois le
  temps réglementaire dépassé plutôt que de continuer à égrener les minutes normalement.
- [x] **Modale d'aide en 3 onglets** (Clavier/souris, Manette, Tactile), chacun détaillé (déplacement, comment
  marquer, défendre, coups francs/penaltys/tirs au but, menu contextuel) — l'onglet manette assume honnêtement
  que les tirs au but et le menu contextuel n'ont pas encore de mapping manette dédié, plutôt que d'inventer un
  comportement qui n'existe pas.
- [x] **Bug corrigé (tirs au but injouables au tactile)** : en écrivant l'onglet Tactile de l'aide, découvert que
  les boutons tactiles (`touchKick`, joystick) n'avaient aucune branche pour la phase de visée/plongeon des tirs
  au but/penaltys — un joueur au tactile serait resté bloqué indéfiniment à son propre tir (`penaltyPhase:
  'aiming'` n'attendait que le relâchement de la touche Espace clavier). Corrigé en réutilisant le joystick pour
  la visée et `touchKick`/nouveau `touchKickRelease()` pour charger/tirer, symétrique à la logique clavier.
- [x] **Bug corrigé et important (plantage mémoire du navigateur)** : en vérifiant l'onglet d'aide par capture
  d'écran, le navigateur (rendu logiciel) plantait de façon reproductible quelques secondes après le coup d'envoi
  — même sans aucune interaction. Diagnostiqué en sondant `scene.meshes/materials.length` et
  `performance.memory.usedJSHeapSize` en direct : le nombre de meshes/matériaux restait stable, mais le tas JS
  grossissait de ~40 Mo/seconde. Cause racine : `engine.setHardwareScalingLevel(0.5)` (rendu suréchantillonné à
  2x pour la netteté, tampon ~2560×1872) était réglé depuis longtemps mais **restait sans effet réel** à cause
  du bug de résolution de rendu obsolète corrigé plus haut dans cette session (tant que `engine.resize()`
  n'était jamais rappelé, le moteur restait bloqué sur un petit tampon où ce réglage ne coûtait presque rien) —
  corriger CE bug a réactivé pour la première fois le suréchantillonnage, révélant qu'il n'est pas soutenable
  en rendu logiciel ici. Ramené à `1` (résolution native, pas de suréchantillonnage) : le tas JS se stabilise
  immédiatement au lieu d'exploser. Un vrai navigateur avec accélération GPU matérielle ne serait probablement
  pas affecté de la même façon, mais la version corrigée est strictement plus sûre dans tous les cas.
- [x] **Bug corrigé (fuite mémoire de la traînée du ballon)** : en creusant le plantage ci-dessus, repéré au
  passage que `updateTrail()` (ball.service.ts) créait un nouveau `StandardMaterial` à chaque point de traînée
  (déclenchée bien plus souvent depuis l'abaissement du seuil de vitesse à 5 m/s cette session) sans jamais le
  libérer — `mesh.dispose()` ne libère pas son matériau par défaut. Corrigé en réutilisant un seul matériau
  partagé (`getTrailMaterial()`) pour tous les points de traînée, libéré proprement dans `dispose()`. N'explique
  pas à lui seul le plantage ci-dessus (comptes de matériaux mesurés stables), mais fuite réelle qu'il fallait
  corriger de toute façon.
- [x] **Optimisation** : `backdrop-filter: blur()` retiré de la modale d'aide (plein écran, l'un des effets CSS
  les plus coûteux à calculer) au profit d'un fond simplement plus opaque — accélère l'ouverture de la modale
  sans changement visuel notable.

## Phase 3 - Stades réels (8 formes), tribunes, météo, révélation des compositions
- [x] **Intégration des 8 formes de stade des maquettes HTML** (`footBall/gallerieStadeOK/`) : les 10 anciens
  stades (variantes de couleur uniquement) remplacés par 8 stades aux formes réellement différentes
  (`StadiumShape`: oval/rect/round/hex/boutique/simple/modular/training), dont un stade premium ("Olympia
  Arena", forme ovale, écrans géants). Choix utilisateur explicites : visuel seulement (pas de tribunes
  visitables), remplacement (pas ajout) des 10 stades, sélection fixée avant-match (pas de changement de forme
  en direct). `stadium.service.ts` dispatché par forme (`createStadium()`), avec des méthodes dédiées par
  forme (`createPolygonRingStadium`, `createRectStadium`, `createStraightStadium`, `createTrainingGround`).
- [x] **Bug corrigé (tribunes qui chevauchent la pelouse aux coins)** : un anneau de tribunes (ellipse/cercle/
  hexagone) dimensionné pour juste effleurer les côtés du rectangle du terrain coupe nécessairement à
  l'intérieur de ses coins — fait géométrique incontournable (un coin de rectangle est toujours plus loin du
  centre que le point de l'anneau au même angle), pas une simple faute de calcul. Corrigé par
  `safeRingRadius()` qui dimensionne l'anneau sur la distance au COIN (diagonale) plutôt que sur la
  demi-largeur/demi-longueur : ellipse agrandie d'un facteur √2 (en conservant le ratio largeur/longueur),
  cercle sur le rayon exact du coin, hexagone divisé par cos(30°) pour compenser le fait que l'apothème
  (centre → milieu d'arête) est plus courte que le rayon (centre → sommet). Vérifié par capture d'écran :
  les quatre coins du terrain sont désormais dégagés de toute structure de tribune, sur les 4 formes concernées.
- [x] **Bug corrigé (récurrence) : anneaux de toit/liseré doré verticaux** : `CreateTorus` est déjà à plat par
  défaut (plan XZ) chez Babylon — lui appliquer `rotation.x = PI/2` le fait au contraire basculer à la
  verticale (déjà rencontré une première fois cette session sur le rond central de la pelouse). Reproduit
  cette fois sur l'anneau de toit et le liseré doré du stade (`createRingRoof`/`createPolygonRingStadium`),
  provoquant une immense structure verticale bloquant totalement la caméra. Corrigé en retirant la rotation
  et en corrigeant au passage l'ordre des axes du `scaling` (Y doit rester l'axe "fin" du tore, pas Z).
- [x] **Effets météo (pluie/neige)** : aucune particule n'existait avant (seulement une teinte de brouillard +
  facteurs de vitesse/frottement du jeu) — ajouté un vrai `BABYLON.ParticleSystem` (`createWeatherEffects()`,
  stadium.service.ts) avec émetteur en boîte au-dessus du stade, texture procédurale (dégradé radial pour la
  neige, traînée verticale pour la pluie), vitesse/gravité/durée de vie différenciées par type. Diagnostiqué
  comme fonctionnellement correct (système actif, particules en cours de création, vérifié via l'état interne
  du moteur) mais peu visible dans les captures d'écran de ce bac à sable en rendu logiciel très basse
  fréquence d'images — Babylon compense en interne le ratio d'animation selon le temps réel écoulé, ce qui
  atténue fortement l'émission perçue à très basse fréquence d'images ; comportement probablement différent
  sur un vrai navigateur accéléré matériellement.
- [x] **Projecteurs améliorés** : remplacé un éclairage omnidirectionnel plat (`PointLight`, portée 60) par de
  vrais projecteurs directionnels (`SpotLight` par mât, orienté vers le centre du terrain), intensité et
  portée recalculées selon la taille réelle du stade construit et le mode jour/nuit.
- [x] **Immeubles, voirie et éclairage urbain jour/nuit** (`createCityscape()`) : anneau de route procédurale
  (texture avec marquage en tirets) au-delà des tribunes, ~26 immeubles procéduraux (fenêtres allumées la
  nuit) avec 4 avenues dégagées aux angles cardinaux, lampadaires urbains (allumés uniquement de nuit).
- [x] **Stade sélectionné visible en arrière-plan pendant tout le pré-match** : ajout d'un second canvas/scène
  Babylon dédié à un aperçu 3D en rotation lente du stade choisi (`initPreviewScene()`/`rebuildPreviewStadium()`
  dans `football.component.ts`, moteur et scène entièrement séparés du moteur de match pour ne jamais se
  gêner), affiché derrière les écrans de sélection d'équipe, composition, réglages et récapitulatif — dont
  les fonds ont été rendus semi-transparents pour laisser transparaître l'aperçu. Se reconstruit à chaque
  changement de stade/jour-nuit dans les réglages, se dispose au coup d'envoi (`startMatch()`) et se
  recrée si l'utilisateur revient en arrière.
  - **Bug corrigé (repéré tardivement) :** l'écran de composition d'équipe (`.formation-screen.roster-bg`,
    "Configuration et classement") gardait un fond entièrement opaque malgré la transparence appliquée à
    `.formation-screen` — la classe `.roster-bg`, présente sur le même élément et définie plus bas dans la
    feuille de style, avait une priorité CSS égale et un `background` non transparent qui l'emportait
    silencieusement. Corrigé en rendant `.roster-bg` semi-transparent lui aussi, cohérent avec les autres écrans.
- [x] **Révélation des compositions avant le coup d'envoi** : le drapeau du pays (filigrane semi-transparent)
  et le nom de l'équipe sont projetés sur la pelouse — l'équipe à gauche d'abord, puis l'équipe à droite
  quelques secondes après — pendant que les 22 joueurs sont déjà en place à leur poste de coup d'envoi (jeu
  gelé, `isPaused`), avant le coup de sifflet et l'ambiance de foule.
  - **Bug corrigé (long, root-caused empiriquement) : le plan de révélation restait invisible malgré un état
    interne entièrement correct.** Diagnostic par élimination méthodique, chaque hypothèse vérifiée par mesure
    directe plutôt que supposée : mesh actif, dans le frustum, matériau/texture prêts, bounding box correcte,
    `showBoundingBox` (rendu de debug de Babylon indépendant du matériau) également invisible — écartant
    géométrie, matériau, alpha, z-fighting, culling. Un mesh équivalent créé à l'identique via une injection
    JS externe (`page.evaluate`) fonctionnait parfaitement à tout instant, y compris en appelant directement
    les mêmes méthodes compilées du composant — mais le même appel, déclenché depuis la propre chaîne
    d'exécution asynchrone (`setTimeout`) du composant Angular, restait invisible quel que soit le délai
    ajouté. Cause racine : le mesh était créé depuis l'intérieur de la zone Angular (Zone.js), qui patche les
    timers/évènements globaux d'une façon qui perturbe ce pipeline de rendu Babylon précis — le correctif
    standard pour ce genre d'intégration Babylon/Three.js + Angular consiste à sortir cette logique de la zone
    Angular. Corrigé en injectant `NgZone` et en exécutant toute la séquence de révélation (création du plan,
    changement de texture, temporisations, disposition finale) via `ngZone.runOutsideAngular()`, en ne
    rentrant dans la zone que pour la callback `onDone()` finale (mise à jour d'état déclenchant le rendu
    Angular). Au passage, le mesh du filigrane est désormais un clone du marquage du terrain déjà existant
    (`fieldMarkings`) plutôt qu'un `CreateGround` fraîchement construit, par prudence supplémentaire.
    Vérifié par capture d'écran : nom d'équipe et drapeau en filigrane bien visibles sur la pelouse.
- [x] **Cercle jaune sous le porteur du ballon**, togglable via le menu contextuel
  (`contextToggleBallCarrierRing()`) : chaque joueur (`player.service.ts`, `createPlayer()`) porte désormais un
  petit anneau (`CreateTorus`, déjà à plat par défaut — pas de rotation à appliquer) émissif jaune, enfant du
  pivot du joueur et masqué par défaut, dont la visibilité est mise à jour à chaque contact avec le ballon
  (`checkBallCollisions()`, football.component.ts) et immédiatement synchronisée si l'utilisateur bascule
  l'option en cours de partie (sans attendre le prochain contact). Vérifié par téléportation ciblée d'un
  joueur sur le ballon (jeu à peine jouable en temps réel dans ce bac à sable très lent) puis capture d'écran
  caméra rapprochée : l'anneau apparaît bien exactement sous les pieds du porteur.

## Phase 4 - Bug majeur du déroulement du jeu, formations à la révélation, mode entraînement
- [x] **Bug majeur corrigé (le ballon ne bouge jamais tout seul, l'auto-play ne "marche pas")** :
  root-cause trouvée par instrumentation directe (compteur d'appels IA, suivi de la position du ballon
  image par image) plutôt que supposée. Chaque rôle IA (`ai.service.ts` : `updateDefender/Midfielder/Forward`)
  n'agit que si le ballon est DÉJÀ à portée de sa propre logique réactive (presser/soutenir : seuils de 8 à
  12m) — mais rien ne fait jamais converger un joueur vers un ballon HORS de cette portée. Au coup d'envoi
  (ballon pile au centre, joueurs étalés en formation à 15-35m), c'est justement le cas pour TOUT le monde :
  vérifié par un test de 2,3 secondes de jeu simulé en auto-play pur (les deux équipes en IA), le ballon
  restait à l'exacte position (0,0) sans le moindre déplacement. Corrigé en ajoutant, dans `AIService.update()`,
  un comportement qui envoie TOUJOURS le joueur de champ (hors gardien) le plus proche du ballon le chercher
  directement, quel que soit son rôle, tant qu'il n'est pas à portée de contact réel — comportement standard
  de "ballon libre" dans tout jeu de foot, qui manquait entièrement. Seuil de handoff vers la logique de rôle
  calé à 1m (pas plus) : un seuil plus généreux (2m, premier essai) renvoyait la décision à la logique de rôle
  AVANT le contact réel (0,6m), qui elle-même exige souvent que le ballon ait déjà franchi le milieu de terrain
  (comparaison stricte z>0/z<0, toujours fausse tant que le ballon est pile à z=0) — le joueur rebroussait
  chemin juste avant de toucher le ballon, qui ne bougeait donc jamais. Vérifié après correctif : un joueur
  IA touche et tire le ballon en quelques secondes de jeu simulé, en auto-play comme en partie normale.
- [x] **Bug corrigé (remises en jeu systématiquement au centre du terrain)** : `checkOutOfBounds()`
  (football.component.ts) calculait bien la position de remise en jeu correcte via
  `refereeService.determineRestart()` (coin de corner, point à 5m pour les six mètres, point exact sur la
  ligne de touche) mais l'ignorait totalement — `ballService.reset()` était appelé sans argument, qui
  replace TOUJOURS le ballon au rond central par défaut. Résultat : chaque touche, corner ou six mètres
  ramenait en réalité le ballon au centre du terrain au lieu du bon endroit, ce qui n'a aucun sens et cassait
  la crédibilité de tout le déroulement du match. Corrigé en passant `decision.position` à `reset()`.
- [x] **Révélation des formations avant coup d'envoi** : en plus du drapeau/nom d'équipe déjà projeté en
  filigrane sur la pelouse, un encart HTML (même widget "4-3-3" + petits points verts que l'écran de
  composition) s'affiche maintenant en haut de l'écran pendant la révélation de chaque équipe
  (`revealingTeam`, synchronisé avec les mêmes minuteries que le filigrane). Comme pour le filigrane,
  `revealingTeam` doit être modifié DANS la zone Angular (`ngZone.run(...)`) même si le reste de la séquence
  tourne hors zone, sans quoi le template ne se met jamais à jour. Vérifié par inspection directe du DOM et
  des styles calculés (contenu, `display:flex`, `opacity:1`, position/taille correctes) : la capture d'écran
  plein-page ne l'attrapait pas car l'attente interne de Playwright ("waiting for fonts to load") consommait
  à elle seule toute la fenêtre réelle de 2,6s d'affichage — confirmé artefact d'outillage, pas un bug, en
  reproduisant l'échec même sur une capture d'élément ciblée ("Element is not attached to the DOM" une fois
  la fenêtre de révélation refermée entre-temps).
- [x] **Mode Entraînement** (case à cochée sur l'écran de sélection des équipes) : une seule équipe (domicile)
  à choisir pour apprendre à jouer/s'entraîner — la colonne "Extérieur" affiche un message dédié à la place
  de la grille d'équipes, et le bouton "Confirmer" ne réclame plus que l'équipe domicile. Un adversaire est
  auto-assigné silencieusement à la confirmation (`confirmTeams()`) uniquement pour continuer à réutiliser tel
  quel tout le flux de match existant (roster à 22, IA, arbitre...) sans dupliquer cette logique pour un mode
  "solo" séparé. Vérifié de bout en bout : sélection d'une seule équipe → adversaire auto-assigné visible sur
  l'écran de composition suivant, effectifs complets des deux côtés.

## Phase 5 - Drapeaux en double, schéma de formation fidèle, scroll du menu, anneau plus visible
- [x] **Drapeaux dupliqués retirés** (sélection d'équipe + récapitulatif) : pour les sélections nationales,
  `team.logo` est lui-même déjà un emoji drapeau (identique à `getCountryFlag(team.country)`) — les cartes de
  la grille (`ts-card-flag` en petit, coin haut-gauche), la bannière "équipe sélectionnée" (drapeau en ligne
  dans `ts-sel-name`) et l'écran récapitulatif (`recap-flag`, plus petit que `recap-logo`) affichaient donc
  chacun le même drapeau deux fois. Gardé la version la plus grande/prépondérante (`ts-card-logo`,
  `ts-sel-logo`, `recap-logo`) et retiré le doublon plus petit à chaque endroit — les clubs (dont `logo` est un
  emblème distinct, pas un drapeau) ne sont pas affectés différemment.
- [x] **Schéma de formation avant coup d'envoi refait pour ressembler à une vraie fiche tactique** (maillots
  numérotés positionnés sur un mini-terrain, plutôt que de simples points par ligne) : `getFormationLayout()`
  réutilise directement les vraies positions x/z de `FOOTBALL_CONFIG.FORMATIONS[...].positions` (les mêmes
  que celles utilisées par `PlayerService.createTeam()` pour le coup d'envoi réel) normalisées en pourcentage
  pour un positionnement CSS absolu, associées au numéro de maillot du titulaire correspondant (même ordre
  d'index que `createTeam()`). Chaque poste est un maillot en forme de "T" (CSS `clip-path`, sans image), coloré
  selon le maillot choisi (couleur gardien distincte via `team.colors[team].keeper`), sur un fond de pelouse
  avec rond central. **Bug corrigé au passage** : le numéro du gardien était illisible (texte sombre sur
  maillot souvent sombre/noir) — texte blanc à contour sombre appliqué uniformément (lisible sur maillot clair
  ou foncé) plutôt qu'une couleur de texte fixe supposant un fond clair.
- [x] **Barre de défilement ajoutée au menu contextuel** : `max-height: calc(100vh - 32px)` +
  `overflow-y: auto` (+ scrollbar stylée fine, discrète) — le nombre d'options accumulées au fil des sessions
  (auto-play, trajectoire, noms des joueurs, anneau du porteur, terrain seul, vue d'ensemble du stade, replay
  de but...) pouvait dépasser la hauteur de l'écran sans aucun moyen d'atteindre les dernières options.
  Vérifié : `scrollHeight > clientHeight` avec `overflow-y:auto` effectivement actif dès que le contenu dépasse.
- [x] **Cercle du porteur du ballon rendu bien plus visible** : dimensions doublées (diamètre 0,7→1,15,
  épaisseur 0,06→0,16) — beaucoup trop discret à la distance de caméra par défaut du jeu (bien plus élevée/
  éloignée que la caméra rapprochée utilisée pour la toute première vérification). **Cause probable du "ne
  s'affiche pas" signalé** : un simple contact (`hasBall`) peut ne durer qu'une fraction de seconde avant que
  le ballon soit repoussé/tiré, bien trop bref pour être perçu à l'œil nu même si l'anneau s'affiche
  correctement l'instant du contact. Ajouté `ringLingerTimer` (`PlayerInstance`) : l'anneau reste affiché
  0,4s après la perte du contact plutôt que de disparaître instantanément dès que `hasBall` redevient faux,
  décrémenté dans la même boucle que les cooldowns de tacle/décision IA (`updateGame()`). Vérifié : `hasBall`
  redevenu faux mais `ballCarrierRing.isVisible` toujours vrai 600ms plus tard (le temps du "maintien"),
  et capture d'écran caméra rapprochée confirmant un anneau désormais nettement visible et lumineux.

## Phase 6 - Bug majeur de sens de jeu, coup d'envoi réaliste, entraînement solo, finitions visuelles
- [x] **Bug majeur corrigé (root cause de "le gardien sort et ignore le ballon" et de l'IA qui "ne joue pas
  son rôle")** : `player.service.ts` (`createTeam()`) engendrait domicile côté Z **positif** (`side = isHome
  ? -1 : 1` appliqué à des positions de formation déjà négatives), alors que TROIS autres fichiers
  indépendants (`AIService.ownGoalSign()`, `BallService.checkGoal()`, `RefereeService.teamDefending
  {Positive,Negative}Z()`) s'accordaient tous sur domicile = Z négatif. Chaque joueur — gardien inclus —
  passait donc son temps à courir vers le mauvais bout du terrain pour "défendre" ou "attaquer", puisque son
  point de repère (son propre but) n'était pas là où il pensait. Trouvé par recoupement direct de 4 fichiers
  indépendants plutôt que supposé ; corrigé en un seul endroit (`side = isHome ? 1 : -1`). Vérifié après coup :
  gardien domicile engendré à z=-48 (au lieu de +48), reste bien près de sa ligne pendant le jeu (dérive de
  quelques centimètres seulement sur plusieurs secondes, au lieu de foncer vers l'autre bout).
- [x] **Bug corrigé (le joueur humain pouvait se retrouver à contrôler le gardien sans le savoir)** :
  `PlayerService.getClosestToBall()` (utilisée par le changement de joueur automatique/touche Q) ne
  distinguait pas le gardien des autres joueurs — dès que le ballon traînait près de sa propre surface, il
  pouvait devenir le joueur contrôlé, coupant du même coup son IA (`updateGoalkeeper`) puisqu'un joueur
  contrôlé n'est jamais piloté par l'IA. Résultat observable : le gardien reste immobile dans ses cages,
  ignorant le ballon. Corrigé en excluant le rôle 'gk' des candidats à ce changement de joueur.
- [x] **Vrai coup d'envoi** (`setupKickoffPair()`/`triggerKickoffPass()`, football.component.ts) : 2 joueurs
  de l'équipe qui engage (2 attaquants, ou 1 attaquant + 1 milieu selon la formation) se placent côte à côte
  au rond central, sur leur propre moitié — le reste de l'équipe garde sa formation normale — puis une petite
  passe d'ouverture entre les deux met réellement le ballon en jeu, au lieu de 22 joueurs figés en formation
  complète et un ballon immobile que personne ne venait jamais mettre en jeu. Câblé au coup d'envoi initial,
  après chaque but (l'équipe qui encaisse engage), à la mi-temps et aux prolongations (alternance réelle des
  règles du foot via `lastKickoffTeam`). Vérifié : 2 attaquants positionnés exactement à (±1,3 ; ±1,3) au
  centre au lieu de leur position de formation habituelle.
- [x] **Bug corrigé (le ballon finissait hors du filet après un but)** : le filet (`stadium.service.ts`) est un
  mesh purement visuel — comme tout le reste du stade, il n'a aucun collider physique. Sans rien pour
  l'arrêter, le ballon continuait sa trajectoire au moment du but et pouvait finir loin derrière la cage.
  Corrigé en recadrant sa position (X/Y dans les limites du but, Z au milieu de la profondeur du filet) dès
  la détection du but, plutôt que d'ajouter un collider physique (risque de gêner des tirs/rebonds normaux
  pour un gain purement cosmétique après-coup). Vérifié : ballon forcé loin derrière la cage (z=58) → recadré
  exactement à z=53,5 (le milieu du filet) après détection du but.
- [x] **Filet des cages en blanc** : `emissiveColor` ajouté (`netMat`) pour qu'il reste d'un blanc net quelle
  que soit l'intensité de l'éclairage ambiant — un matériau blanc mais purement diffus peut rendre assez
  sombre sous un éclairage faible, se confondant avec le ballon (noir sur les modèles utilisés ici).
- [x] **Joueurs agrandis (~1,75m simulés minimum) + crampons, chaussettes, brassard de capitaine** :
  `playerScale` remonté à 2.0 (physique ET visuel, cohérents puisque basés sur le même facteur). Chaussettes
  (couleur secondaire du maillot) et crampons (boîtes sombres, plus larges/plates que la jambe) ajoutés à
  chaque jambe. Le capitaine (nouveau champ `captainNumber` sur `TeamRosterState`, choisi via une nouvelle
  case ☆/© sur chaque ligne de l'écran de composition) porte un brassard doré au bras gauche. Vérifié par
  capture d'écran caméra rapprochée : brassard jaune vif et crampons bien visibles.
- [x] **Pelouse variée selon la forme du stade** (`createStripeTexture()`, stadium.service.ts) : un seul motif
  de tonte (bandes verticales) était auparavant appliqué à absolument tous les stades. Chaque forme a
  maintenant son propre motif — bandes horizontales (rond/modulaire), anneaux concentriques (hexagonal),
  bandes diagonales (boutique), damier (ovale, stade phare), pelouse unie sans motif (entraînement), bandes
  verticales classiques (rectangulaire/simple). Vérifié par capture d'écran : damier net et distinct des
  bandes verticales vues sur d'autres stades.
- [x] **Mode Entraînement refondu en séance d'exercice solo** (suite à question de clarification à
  l'utilisateur, qui a choisi : pas d'adversaire, juste des mannequins + un gardien IA) : au lieu d'auto-
  assigner un onze adverse complet, seul le gardien de l'équipe "adverse" est créé
  (`PlayerService.createGoalkeeperOnly()`, pour s'entraîner à marquer face à un vrai gardien guidé par l'IA),
  accompagné de 4 mannequins statiques disposés en slalom dans le dernier tiers
  (`PlayerService.createTrainingDummies()`, avec un vrai corps physique fixe pour un obstacle de dribble
  réaliste, mais aucune IA/comportement). La révélation des compositions (qui n'aurait aucun sens en
  entraînement) est sautée, la séance démarre directement. Vérifié : 11 joueurs domicile, 1 seul joueur
  "extérieur" (gardien), 4 mannequins créés, capture d'écran confirmant l'absence de tout onze adverse.

## Phase 7 - Bug de rotation à 90° des touches directionnelles
- [x] **Bug corrigé (flèche gauche → joueur vers le haut, flèche droite → vers le bas, flèche haut → vers la
  gauche, flèche bas → vers la droite)** : dans `football.component.ts`, `handlePlayerInput()` construit le
  vecteur de déplacement directement en espace monde via `new BABYLON.Vector3(this.input.moveX, 0,
  this.input.moveZ)` (aucune transformation relative à la caméra). Or la caméra (`ArcRotateCamera`, alpha=0
  fixe sur tous les préréglages de vue) est positionnée le long de l'axe X du monde et regarde vers l'origine
  : dans cette vue en plongée, s'éloigner de la caméra (X négatif) remonte à l'écran, tandis que l'axe Z est
  l'axe latéral gauche/droite à l'écran — l'inverse de l'association "naturelle" (Z=avant/arrière,
  X=latéral) qu'on suppose dans la plupart des jeux 3D. L'ancien code (`onKeyDown`/`onKeyUp`/`pollGamepad`/
  joystick tactile) assignait Haut/Bas à `moveZ` et Gauche/Droite à `moveX` — cohérent avec la convention
  "naturelle" mais pas avec la caméra réelle de ce jeu, d'où la rotation de 90° ressentie par le joueur.
  Corrigé en inversant les affectations (Haut/Bas → `moveX`, Gauche/Droite → `moveZ`) de façon identique et
  cohérente sur les 3 méthodes d'entrée (clavier, manette, joystick tactile). Vérifié de façon définitive par
  projection écran figée (caméra gelée, une seule matrice vue-projection réutilisée pour chaque mesure avant/
  après, afin d'éliminer toute contamination par le recentrage caméra qui suit en permanence le ballon) :
  flèche Haut → déplacement écran très majoritairement vertical vers le haut (ΔY écran ≈ -4,4, ΔX écran ≈ 0),
  Bas → vers le bas (ΔY ≈ +1,8), Gauche → vers la gauche (ΔX écran ≈ -4,5), Droite → vers la droite (ΔX écran
  ≈ +1,8-1,9) — les 4 flèches produisent maintenant un déplacement dans la direction visuelle attendue.

## Phase 8 - Vrais modèles 3D animés (Mixamo) pour tous les joueurs

- [x] **Remplacement des meshes procéduraux (boîtes) par un vrai personnage 3D animé.** L'utilisateur a
  téléchargé 23 animations Mixamo (personnage "Ch38" + squelette, ~52 Mo chacune en FBX "avec peau" — export
  Mixamo par défaut) dans `footBall/mixamo/`. Pipeline de conversion (aucun outil n'était installé au départ,
  tout téléchargé en portable, sans `sudo`) :
  1. **FBX → glTF/GLB** : binaire `FBX2glTF` (facebookincubator, v0.9.7, téléchargé depuis GitHub Releases —
     le repo n'a que des prereleases, `/releases/latest` renvoie 404, il faut lister `/releases` et prendre la
     plus récente). Conversion individuelle des 23 fichiers, chacun donnant un `.glb` d'environ 42 Mo (quasi
     entièrement les textures du personnage, dupliquées à l'identique dans chaque fichier).
  2. **Fusion des animations dans UN SEUL fichier** (éviter 23×42 Mo) : script Node (`@gltf-transform/core` +
     `@gltf-transform/functions`) qui charge un fichier de base (mesh+squelette+1 clip), puis pour chacun des
     20 autres fichiers, copie **uniquement** l'`Animation` (pas le mesh) vers le document de base via
     `copyToDocument(target, source, [anim], resolve)` avec un `resolve` personnalisé : quand la dépendance
     copiée est un `Node` (= un os), on retrouve l'os de MÊME NOM déjà présent dans le squelette de base (tous
     les fichiers partagent le même rig `mixamorig5:*`, préfixe confirmé par extraction directe du JSON glTF)
     au lieu d'en créer un doublon. Vérifié : le nombre de nœuds/meshes du document de base reste EXACTEMENT
     inchangé (73/7) après la fusion des 20 clips, et aucun avertissement "os introuvable" — preuve que chaque
     clip a été correctement retargeté sur le squelette existant sans dupliquer le rig. `unpartition()` fusionne
     ensuite les 21 buffers (un par clip copié) en un seul (glB n'autorise qu'un seul buffer).
  3. **Compression des textures** (`@gltf-transform/functions` `textureCompress` + `sharp`) : redimensionnement
     1024×1024 + conversion JPEG (sauf la texture des cheveux, qui a un canal alpha — gardée en PNG mais
     redimensionnée en 512×512 séparément). Résultat : 42 Mo → 3,9 Mo pour un seul fichier contenant le mesh
     ET les 21 clips nommés (Idle, Run, Sprint, FastRun, JogBackward, WalkingTurn, Dribble, Tackle, Trip, Pass,
     Shoot, Chip, Header, StrikeForwardJog, ThrowIn, CelebrationFlip, GK_Idle, GK_Catch, GK_CatchAlt,
     GK_PlaceBall), placé dans `frontend/src/assets/football/players/player.glb`.
  4. **Chargement** (`player.service.ts`, `preload()`) : `BABYLON.SceneLoader.LoadAssetContainerAsync(...)`,
     une seule fois par match (attendu dans `football.component.ts` `startMatch()`, juste après la création de
     `PlayerService`, avant tout `createTeam`/`createGoalkeeperOnly`). Chaque joueur clone ensuite le conteneur
     via `instantiateModelsToScene(n => n, false, { doNotInstantiate: true })` (clonage réel, pas de thin
     instances GPU, pour que chaque joueur ait son propre squelette animable indépendamment des autres) — d'où
     `createPlayer()` lève une erreur explicite si appelée avant que `preload()` soit résolu.
  5. **Couleurs d'équipe** : le modèle source partage un seul matériau texturé entre Corps/Chaussures/Maillot/
     Short/Chaussettes ; on remplace juste le matériau des sous-meshes `Ch38_Shirt`/`Ch38_Shorts`/`Ch38_Socks`
     de CHAQUE clone par un nouveau `StandardMaterial` propre à l'équipe (même tissu réel qu'avant, cf. Phase
     6), laissant peau/cheveux/chaussures du modèle intacts.
  6. **Taille apparente inchangée** : le modèle Mixamo est en unités réalistes (mesuré : 1,7847 m pieds-tête sur
     le fichier fusionné) alors que tout le jeu (distance de caméra, ballon grossi ×2,2, portée de tacle...) est
     calibré autour de l'ancienne exagération volontaire de taille (ancien personnage procédural : 1,61 m
     locaux avant `playerScale`, qui vaut 1,8 à 2,6 selon le réglage choisi → jusqu'à ~4,2 m apparents). Un
     ratio fixe `MODEL_SCALE_RATIO = 1.61 / 1.7847 ≈ 0,902` est appliqué en plus de `playerScale` pour que les
     3 réglages de taille (Normale/Grande/Très grande) donnent exactement la même taille apparente qu'avant —
     seul le modèle change, pas le gameplay/l'équilibre de la caméra. Le collider physique (capsule) reste
     inchangé (ne dépend pas de ce ratio), toujours calibré sur l'ancienne taille apparente.
  7. **Animations branchées sur le jeu** : `PlayerService.syncPositions()` choisit Idle/Run/Sprint (ou GK_Idle
     pour le gardien) selon la vitesse du corps physique, via `setBaseAnimation()`. `playOneShot()` (nouvelle
     méthode publique) joue un clip une fois (Tir/Passe/Tacle) à l'initiative de `football.component.ts`, câblé
     aux points de décision tir/passe (joueur humain ET IA) et tacle déjà existants ; le state-machine de base
     ne reprend la main qu'à la fin du clip (`onAnimationGroupEndObservable`), pas sur une durée estimée à
     l'avance (évite toute hypothèse sur le fps d'export Mixamo).
  8. **Brassard de capitaine → étoile dorée flottante** : l'ancien brassard était une simple boîte parentée au
     pivot du bras procédural ; avec de vrais os Mixamo, l'attacher précisément au bras demanderait un
     attachement os-par-os plus fragile pour un gain cosmétique mineur. Remplacé par un petit polyèdre doré
     flottant au-dessus de la tête (aussi lisible depuis la caméra tactique éloignée), plus simple et robuste.
  9. **Détection de main (`referee.service.ts checkHandball`) adaptée** : `legPivots`/`armPivots` sont
     maintenant de vrais `BABYLON.Bone` (cuisses/bras du squelette, `mixamorig5:*UpLeg`/`*Arm`) plutôt que des
     `TransformNode` procéduraux dédiés. `Bone.getAbsolutePosition()` sans le mesh lié ne compose PAS avec le
     pivot du joueur (position/échelle) et aurait donné une position hors-monde incorrecte : la détection de
     distance bras/ballon utilise donc maintenant le centre du joueur + une hauteur d'épaule approximative (mise
     à l'échelle courante), en ne gardant des os que la rotation locale (toujours valide) pour distinguer bras
     levé/naturel. Limite connue acceptée : l'incident aléatoire de main (`football.component.ts`, tirage à
     0,6%) force `armPivots[x].rotation.x = 1.0` directement sur l'os — un raccourci qui fonctionnait bien avec
     l'ancien système procédural (aucune animation ne rentrait en concurrence), mais qui est maintenant en
     compétition avec l'AnimationGroup en cours de lecture sur ce même os ; non retesté en profondeur, mécanique
     mineure/rare qui n'affecte pas le reste du jeu si elle devient moins fiable.
  10. **Limite connue** : le tir au but en séance de tirs au but (penalty shootout) ne joue aucune animation de
      tir/plongeon — cette séquence est entièrement abstraite (ballon/point de tir/probabilités), sans référence
      à un `PlayerInstance` tireur/gardien précis ; câbler des animations là nécessiterait de faire suivre cette
      référence à travers tout le flux de tirs au but, hors du périmètre de cette session.
  - Vérifié par Playwright (capture d'écran + inspection réseau) : `player.glb` répond 200, les joueurs
    affichent un vrai personnage posé/animé (silhouette humaine avec bras/jambes visibles) teinté aux couleurs
    de l'équipe (bleu marine confirmé sur deux joueurs de camps différents), aucune erreur JS pendant les
    actions de jeu (déplacement/tir/passe/tacle/sprint) — seuls deux avertissements Babylon bénins ("Skeleton
    node is not a common root", un artefact courant/inoffensif de conversion FBX2glTF).

## Phase 9 - Corrections post-passage au modèle 3D + refonte UI des écrans d'avant-match

- [x] **Bug majeur corrigé : squelette racine incorrect (Chaussures/Chaussettes)** — root cause du "pied
  amputé"/"objet façon gourde ou crampon dans la main" rapporté par l'utilisateur. Les skins `Ch38_Socks` et
  `Ch38_Shoes` du `.glb` fusionné déclaraient un `skeleton` (racine commune) qui N'ÉTAIT PAS un ancêtre de tous
  leurs joints (`mixamorig5:LeftUpLeg`/`LeftLeg` déclaré comme racine alors que le skin référence AUSSI les os
  du côté droit, qui ne sont pas des descendants du côté gauche) — exactement l'avertissement Babylon
  "Skeleton node is not a common root" repéré (mais initialement jugé bénin) en Phase 8. Confirmé bug réel (pas
  juste un avertissement cosmétique) par capture d'écran macro : un objet gris segmenté (le maillage du pied/
  chaussure mal transformé) apparaissait détaché près de la main. Root cause : un défaut de FBX2glTF (v0.9.7)
  lui-même, pas introduit par le pipeline de fusion (`merge.js` ne touche qu'aux `Animation`, jamais aux
  `Skin`). Corrigé avec un script `gltf-transform` ciblé qui recale `skeleton` sur `mixamorig5:Hips` (l'ancêtre
  commun réel, déjà utilisé correctement par les 4 autres skins) pour les skins fautifs. Vérifié par capture
  macro avant/après : pieds complets des deux côtés, plus aucun objet flottant, même en pleine course.
- [x] **Physique ajoutée aux panneaux publicitaires** (`stadium.service.ts`, `createAdBoardRing()`) : purement
  visuels jusqu'ici (tout le stade l'est, cf. Phase 6), les joueurs — devenus des personnages 3D bien visibles
  au lieu de petites boîtes — les traversaient de façon flagrante. `StadiumService` reçoit maintenant le
  monde Rapier (`world?: RAPIER.World`, optionnel — la scène de prévisualisation avant-match n'en a pas besoin)
  et crée un collider statique fin par panneau. Le panneau du côté z négatif (même côté que les bancs de
  touche, cf. `createBenches()`) est purement et simplement retiré (`skip: true`) plutôt que doté d'un
  collider, à la demande explicite de dégager la vue sur cette zone — **hypothèse à confirmer avec
  l'utilisateur** : c'est le panneau le plus proche géométriquement des bancs, mais le repérage exact
  ("le côté faisant face au tunnel") n'a pas pu être vérifié sur une capture zoomée de cette zone précise.
- [x] **Collider joueur élargi** (`player.service.ts`) : 0.2/0.15×playerScale → 0.3/0.24×playerScale. Le vrai
  modèle 3D est visuellement bien plus large qu'une fine boîte procédurale ; l'ancien collider laissait les
  silhouettes se chevaucher nettement avant que Rapier ne les sépare ("un joueur peut traverser l'autre sans
  heurt"). Les deux corps restent des `dynamic()` avec colliders solides classiques (pas de sensor, pas de
  groupes de collision personnalisés) : ils entraient déjà réellement en collision, seule la marge visuelle
  manquait.
- [x] **Marquage IA individuel + presseur unique** (`ai.service.ts`) — root cause de l'agglutinement rapporté :
  chaque défenseur appelait indépendamment `findNearestOpponent()` (le plus proche PAR DÉFENSEUR), si bien que
  plusieurs défenseurs pouvaient marquer LE MÊME attaquant pendant qu'un autre restait totalement démarqué ;
  de même, TOUS les défenseurs à moins de 8 m du ballon fonçaient dessus simultanément. Corrigé par
  `computeManMarking()` (appariement glouton défenseur↔attaquant, une fois par équipe/tick de 200 ms, sans
  doublon possible) et une exclusivité de pressing (seul le défenseur le plus proche du ballon presse
  réellement, cf. `isClosestPresser`) ; `findNearestOpponent()` (devenue inutile) supprimée.
- [x] **Taille du ballon réduite** (`ball.service.ts`) : `BALL_VISUAL_SCALE` 2.2 → 1.6. La valeur avait été
  calée sur l'ancien `playerScale` brut (1.8-2.6, propre au personnage procédural en boîtes) ; rapportée à
  l'exagération apparente réelle du nouveau modèle réaliste (`MODEL_SCALE_RATIO` ≈ 1,62, cf. Phase 8), 2.2
  faisait paraître le ballon nettement surdimensionné à côté d'un corps humain aux proportions désormais
  réalistes.
- [x] **Option de vitesse de jeu** (menu contextuel, `football.component.ts`) : un multiplicateur unique
  (`gameSpeedMultiplier`, 0,25×-2×, préréglages Très lent/Lent/Normal/Rapide/Très rapide + glissière) appliqué
  À `deltaTime` en un seul point (`startGameLoop()`, avant toute autre consommation) — affecte donc de façon
  parfaitement synchronisée le chronomètre, les déplacements ET le pas de simulation physique
  (`world.timestep = deltaTime`), sans jamais les désynchroniser entre eux. Choix délibéré de ne pas dupliquer
  ce réglage dans les Réglages avant-match (l'utilisateur proposait l'un OU l'autre) pour limiter le périmètre.
- [x] **Refonte UI — Sélection des équipes** : sélectionner une équipe déjà choisie côté opposé échange
  maintenant les deux colonnes (`selectHomeTeam`/`selectAwayTeam`) au lieu de dupliquer/vider silencieusement ;
  si le côté opposé n'a encore aucune équipe, le côté qu'on vient de re-choisir est simplement vidé (rien à y
  échanger). Sélecteur de maillot transformé en défilement horizontal à un seul maillot visible + flèches
  (`cycleJersey()`), déplacé en face du nom de l'équipe (dans `.ts-selected`) au lieu d'une liste empilée sous
  les attributs. Icône ⓘ ajoutée sur chaque carte équipe pour ouvrir la nouvelle modale détail (voir plus bas).
- [x] **Refonte UI — Configuration et classement** : avatar/photo au-dessus du carrousel de formation retiré
  (`.roster-photo`, jugé redondant avec le nouveau popup joueur, cf. ci-dessous) ; la poignée de
  glisser-déposer (`⠿`, ressemblant à un pavé de points, cf. demande "trois points verticaux" — **interprétée
  ainsi faute d'un élément correspondant plus littéral dans le code**) retirée avec le drag-and-drop associé
  (`cdkDrag`/`cdkDropList`), le réordonnancement restant possible via les boutons ▲ Monter/▼ Descendre déjà
  présents dans le popup joueur (aucune perte de fonctionnalité). Popup joueur (`.roster-context-menu`)
  restructuré en 3 colonnes (`.rcm-body` : avatar+numéro+nom+poste | attributs 1 | attributs 2) au lieu d'un
  bloc unique de 8 lignes.
- [x] **Refonte UI — Réglages du match** : nouveau système de fenêtre défilante générique
  (`settingsWindow()`/`scrollSettings()`/`canScrollSettings()`, un décalage par bloc identifié par un id
  string) affichant 2-3 éléments à la fois avec flèches gauche/droite, appliqué aux blocs à choix nombreux
  (Remplacements, Stade, Ballon, Commentateur, Durée) ; les blocs à 2-3 choix fixes (Difficulté, Météo,
  Moment, Ambiance, Taille des joueurs) restent en ligne simple sans flèches (déjà entièrement visibles).
  Remplace l'ancien `.settings-vlist.scrollable` (défilement vertical interne) par un gain d'espace horizontal
  réel — l'écran entier tient maintenant sans le moindre défilement vertical, vérifié par capture d'écran.
- [x] **Refonte UI — Récapitulatif & coup d'envoi** : logos/drapeaux légèrement remontés (`margin-top:-0.3rem`
  sur `.recap-logo`) ; espacements/paddings resserrés (`.recap-body`, `.recap-team`, `.recap-settings`,
  `.recap-footer`) pour un rendu plus compact. **Bug corrigé (cause racine du bouton "Coup d'envoi" hors
  champ)** : le bandeau de navigation de l'application (hors de ce composant, au-dessus) restait affiché
  pendant cet écran d'avant-match — seul le VRAI match masquait ce bandeau
  (`gameChrome.hideHeader()`/`startMatch()`) — réduisant d'autant la hauteur disponible et poussant le bouton,
  ancré en bas de l'écran récapitulatif, hors de la fenêtre sans un défilement de page entier (pas seulement
  interne au composant). Corrigé en masquant/restaurant ce bandeau spécifiquement à l'entrée/sortie de l'écran
  récapitulatif (`confirmSettings()`/`backToSettingsFromRecap()`), symétriquement à ce qui existait déjà pour
  le match. Vérifié par mesure Playwright du rectangle du bouton : entièrement dans la fenêtre après
  correction (bas à 921px pour une fenêtre de 1000px, contre 1035px — hors champ — avant correction).
- [x] **Nouvelle modale détail d'équipe** (icône ⓘ sur chaque carte, écran Sélection des équipes) : deux
  colonnes — liste des 22 joueurs à gauche (numéro/nom/poste, cliquable), "portrait" à droite (badge coloré
  aux couleurs du maillot avec numéro, nom, poste, 5 statistiques clés du joueur sélectionné). **Simplification
  délibérée par rapport à la demande ("photo complète 3D")** : plutôt qu'un second rendu Babylon.js live (un
  second moteur/scène/contexte WebGL séparé à charger le modèle `player.glb` et gérer proprement à l'ouverture/
  fermeture de la modale, en plus d'un éventuel match déjà en cours) — jugé disproportionné en risque/
  complexité pour une simple vignette de consultation — remplacé par un badge stylisé réutilisant le même
  langage visuel que le popup joueur de l'écran Configuration. Une vraie vignette 3D live reste possible en
  travaux futurs si souhaité.
- Vérifié dans l'ensemble par Playwright (clics réels, captures d'écran, lecture du DOM) sur les 4 écrans
  d'avant-match + la modale : aucune erreur JS, échange domicile/extérieur fonctionnel, popup joueur à 3
  colonnes avec avatar confirmé, 5 blocs de réglages avec défilement confirmés, bouton "Coup d'envoi"
  confirmé entièrement visible, modale détail (22 joueurs + portrait) confirmée fonctionnelle.

## Phase 10 - Réalisme du jeu, manette dédiée, tutoriel guidé

- [x] **Panneau publicitaire retiré du mauvais côté (Phase 9), enfin corrigé** : le panneau à
  retirer était sur le côté LONGUEUR (touche, pas ligne de but) — avec la convention caméra établie
  (axe X monde = vertical écran, X négatif = haut), c'est le panneau `x = +(halfW+2)` (bas d'écran),
  pas celui à z négatif retiré par erreur précédemment (remis en place).
- [x] **Indicateur "de quel côté suis-je"** (`humanAttackingSideLabel`, bandeau HUD) : le joueur humain
  contrôle toujours l'équipe domicile ; avec la convention caméra (axe Z = horizontal écran), le signe
  de `attackingDirection('home')` donne directement Gauche/Droite.
- [x] **Manette remappée selon le schéma demandé** (`pollGamepad()`) : gauche = stick/croix directionnelle
  + L1 (changer de joueur) ; droite = bouton "1" passe en profondeur, "4" tir, "2"/"3" contextuels
  (passe courte/centre si le joueur a le ballon, tacle sinon), R1 sprint. Croix directionnelle câblée en
  plus du stick. Deux nouvelles actions clavier ajoutées en parallèle (T = passe profondeur, C = centre).
- [x] **Bug majeur corrigé : mouvement saccadé/robotique** — root cause à deux niveaux :
  1. `PlayerService.movePlayer()` (joueur humain) blendait la vélocité avec un facteur FIXE par appel
     (`0.1 * accel`, jamais mis à l'échelle par `deltaTime`) — quasi-instantané (~80% de l'écart comblé
     en un seul appel à `accel=8`) et dont le ressenti variait avec le framerate. Remplacé par un lissage
     exponentiel indépendant du framerate (`1 - e^(-accel*dt)`).
  2. `AIService.moveTowards()` (joueurs IA) n'avait AUCUN lissage : la vélocité était fixée directement,
     et comme les décisions de rôle ne sont recalculées que toutes les 200 ms (`UPDATE_INTERVAL`), la
     vitesse restait figée puis SAUTAIT instantanément à chaque nouvelle décision. Corrigé en séparant la
     décision (`moveTowards`, throttlée, mémorise juste la cible) de son application
     (`applySmoothMovement()`, nouvelle méthode publique appelée à CHAQUE frame depuis
     `football.component.ts`, avec le même lissage que le joueur humain).
- [x] **Transitions d'animation Idle/Run/Sprint plus douces** : fondu enchaîné activé
  (`enableBlending`/`blendingSpeed` sur chaque animation ciblée) à la création de chaque joueur ; seuil de
  déclenchement de "Sprint" relevé (5.5 → 8.2 m/s, sur une échelle 0-10) — à 5.5, un simple jogging normal
  (7 m/s) déclenchait déjà la pose de sprint en permanence.
- [x] **Bug majeur corrigé : contrôle de balle peu fiable** ("le joueur est à côté du ballon mais ne le
  contrôle pas") — root cause : `checkBallCollisions()` appliquait une impulsion repoussant le ballon à
  CHAQUE frame tant qu'un joueur restait à moins de 0,6 m, donc en continu pendant tout le temps où un
  joueur essayait de le dribbler, le repoussant hors de portée en boucle. Corrigé en n'appliquant
  l'impulsion qu'au tout premier contact (front montant de `hasBall`), pas à chaque frame de proximité
  continue ; rayon de contrôle élargi (0,6 → 0,8 m) pour mieux correspondre au collider joueur élargi
  (Phase 9).
- [x] **Passe courte / passe en profondeur / centre distingués** : `findShortPassTarget` (nouveau,
  favorise nettement la proximité, 2-16 m) remplace l'ancien `findBestPassTarget` pour la passe standard
  (E / bouton "3") — construction du jeu de proche en proche plutôt que ballon systématiquement envoyé au
  plus avancé. `findDeepPassTarget` (through ball, 15-45 m, favorise la progression) et `findCrossTarget`
  (vise un équipier près de la surface adverse, indépendamment de la distance latérale) ajoutés pour les
  nouvelles actions T/bouton "1" et C/bouton "2".
- [x] **Bug majeur corrigé : "chaque tir est un but"** — root cause : `ballService.kick()` n'a aucune
  dispersion propre (direction suivie exactement, pleine puissance) ; le tir humain visait TOUJOURS le
  centre exact de la cage à puissance maximale. Ajouté `applyShotAccuracy()` : déviation latérale
  aléatoire croissante avec la distance et inversement proportionnelle à la stat `shotPower` (5-25) du
  tireur — un excellent finisseur proche du but reste précis, un tir lointain d'un joueur moyen peut
  nettement manquer le cadre. Bug additionnel corrigé au passage : le tir humain ET le tir IA visaient
  TOUJOURS le but à Z positif/selon `isHome`, sans tenir compte du changement de camp à la mi-temps
  (`attackingDirection()` utilisé maintenant à la place).
- [x] **Réflexes du gardien améliorés** : `updateGoalkeeper()` (throttlé à 200 ms comme le reste de l'IA)
  ne suffit pas face à un tir qui traverse la surface bien plus vite que ce cycle de décision. Nouvelle
  méthode `updateGoalkeeperReflexes()`, appelée à CHAQUE frame, qui extrapole la trajectoire du ballon
  (position + vitesse) pour anticiper son point d'arrivée sur la ligne de but plutôt que de suivre
  seulement sa position actuelle, et plonge 60% plus vite quand un tir rapide et cadré est détecté.
- [x] **`shouldShoot()` (IA) resserré** : ne considérait QUE la distance au but, pas l'angle — un tir à
  angle fermé depuis la ligne de touche à 19 m était traité comme une occasion aussi bonne qu'un tir axial
  en pleine surface. Exige maintenant une position raisonnablement centrale ; un joueur excentré dans le
  dernier tiers centre à la place (`findCrossTarget`) plutôt que de tenter ce tir ou une passe latérale
  sans intérêt — la vraie construction de jeu dans cette situation.
- [x] **Mode auto (IA vs IA) vérifié fonctionnel** : le mécanisme du bouton (`autoPlayEnabled`) fonctionne
  correctement (mouvement confirmé par mesure de position avant/après sur 8 s réelles) ; le ressenti
  "cassé" rapporté provient très probablement des mêmes bugs IA/ballon corrigés ci-dessus (course
  saccadée, agglutinement, contrôle de balle défaillant, tirs jamais réalistes), qui rendaient un match
  IA-IA visuellement peu concluant même si le mécanisme tournait.
- [x] **Nouveau mode "Tutoriel guidé"** (bouton dédié au menu principal) : réutilise le mode Entraînement
  (une seule équipe, mannequins + gardien IA) comme bac à sable. Pas-à-pas de 8 étapes (déplacement,
  sprint, changer de joueur, passe courte, passe en profondeur, centre, tir, tacle) affiché en overlay
  pendant le match, qui avance automatiquement dès que l'action attendue est détectée
  (`advanceTutorialIfNeeded()`, appelée juste avant que les indicateurs one-shot ne soient consommés) —
  bouton "Passer le tutoriel" toujours disponible. Vérifié par Playwright : overlay affiché "Étape 1/8"
  puis avancée automatique à "Étape 2/8" après une simple pression de touche de déplacement.
- Vérifié dans l'ensemble par Playwright : indicateur de côté et pas-à-pas du tutoriel affichés
  correctement ensemble en jeu, aucune erreur JS pendant tout le parcours (sélection tutoriel → mode
  entraînement → coup d'envoi → détection d'action), mode entraînement confirmé (mannequins visibles, pas
  d'onze adverse).

## Phase 11 - Sons mp3 réels, taille du ballon, supporters 3D dans les tribunes

- [x] **Sons mp3 réels intégrés** (`audio.service.ts` réécrit) : l'utilisateur a fourni des mp3
  (sifflet, frappe de balle, ambiances/chants/acclamations de tribune, hymnes d'avant-match) dans
  `footBall/utilityMatch/`, dédupliqués par `md5sum` (certains "(1)/(2)" étaient des doublons byte
  pour byte, conservés une seule fois) et copiés dans `assets/football/audio/`. Chargés une fois
  (`preloadAll()`, fetch + `decodeAudioData`, mis en cache dans une `Map<string, AudioBuffer>`) après
  le premier geste utilisateur (`unlock()`). Chaque usage (sifflet, frappe, ambiance de fond,
  acclamation de but, hymne d'avant-match) essaie d'abord le vrai buffer (`playBuffer()`) et retombe
  sur l'ancienne version synthétisée si le buffer n'est pas encore chargé — aucune régression possible
  si le fetch/decode n'est pas terminé. Nouveau : chant de tribune ponctuel joué à intervalle aléatoire
  (`chantTimer`, 45-75 s) pendant le jeu, hymne d'avant-match joué pendant l'écran de récap
  (`confirmSettings()`/`stopPreMatchAnthem()`).
- [x] **Bug corrigé : ballon encore trop gros après un premier ajustement (2.2→1.6)** — root cause
  enfin identifiée : `FOOTBALL_CONFIG.BALL.DIAMETER` (0,45 m) était LUI-MÊME déjà environ le double
  d'un vrai ballon taille 5 (≈0,22 m), un choix de gameplay/collision antérieur mal documenté par un
  commentaire prétendant que c'était "la vraie taille FIFA". Appliquer en plus un multiplicateur > 1
  empilait deux grossissements. `BALL_VISUAL_SCALE` ramené à 0.85 (< 1, donc rendu visuel légèrement
  plus petit que le collider physique 0,45 m invisible) — aucun impact gameplay, ballon enfin de taille
  normale à l'écran.
- [x] **Supporters 3D dans les tribunes** (`crowd.service.ts`, nouveau) : l'utilisateur a fourni des
  FBX de supporters (2 personnages Mixamo, hommes/femmes, 7 clips d'animation au total) dans
  `footBall/supporters/`. Convertis en glTF (FBX2glTF), fusionnés par personnage (clips regroupés sur
  un même squelette via `gltf-transform`, avec vérification d'ancêtre réelle `getParentNode()` pour
  corriger les racines de skin invalides — plus précis que l'heuristique "Left/Right" de la Phase 8
  qui avait sur-corrigé un skin déjà valide) et optimisés (textures compressées, alpha préservé pour
  les cheveux). Résultat : `assets/football/supporters/supporter_a.glb` (8,4 Mo) et `supporter_b.glb`
  (3,8 Mo), chargés une fois par match (`CrowdService.preload()`), clonés (`instantiateModelsToScene`,
  même technique que `PlayerService`) pour ~40-80 supporters (choix validé avec l'utilisateur : rangées
  avant en 3D seulement, le reste des tribunes garde la texture 2D existante — un nombre illimité de
  supporters animés individuellement aurait été bien trop coûteux à côté des 22 joueurs déjà animés).
  Placement volontairement indépendant de la forme du stade (rect/oval/round/hex/...) : un anneau fixe
  à `halfL`/`halfW` + 3,5 m (juste derrière les panneaux publicitaires, à la même position que
  `createAdBoardRing`) reste hors pelouse quelle que soit la forme choisie. Répartition réaliste :
  supporters domicile sur les deux lignes de touche (majorité, ~75%), supporters extérieur regroupés
  derrière un but fixe du stade (~25%) — couleurs de maillot tirées de `TeamConfig.colors.primary` de
  chaque équipe. "Intensité" (probabilité de jouer un clip énergique plutôt que calme) dépend de
  l'ambiance choisie (calme/énergique/festif/hostile) et du camp (domicile légèrement plus démonstratif
  qu'extérieur) ; célébration immédiate du camp qui marque (`celebrate()`, appelée dans `checkGoals()`)
  bascule ses supporters sur des clips "hype" pendant quelques secondes.
- Vérifié par Playwright (rendu logiciel headless, donc lent — plusieurs dizaines de secondes par
  frame) : match lancé (France-Angleterre), aucune erreur console sur tout le parcours. Vue "Vue
  d'ensemble du stade" confirme les supporters domicile (bleu marine, France) bien répartis sur les
  deux lignes de touche, et les supporters extérieur (blanc, Angleterre) regroupés derrière un but,
  correctement positionnés hors pelouse et hors de la piste d'athlétisme.

## Phase 12 - Célébration de but, radar, caméras façon FIFA et nouveau défaut plein terrain

- [x] **Célébration de but par les joueurs** (`celebratePlayersGoal()`, appelée dans
  `checkGoals()`) : le buteur (`ball.lastTouch.playerId`) joue enfin `CelebrationFlip`,
  un clip Mixamo importé dès la Phase 8 mais jusqu'ici jamais déclenché ; ses équipiers
  passent en boucle sur `IdleHappy`. Nouvelle méthode `PlayerService.playCelebrationLoop()`
  (contourne volontairement le garde-fou `oneShotTimer` de `setBaseAnimation`) car
  `syncPositions()` — qui piloterait normalement ce state-machine — est en pause pendant
  `isGoalScored` ; sans ce contournement direct sur les `animationGroups`, l'appel serait
  silencieusement ignoré. Le retour à Idle/Run normal se fait tout seul dès la reprise du
  jeu (prochain appel à `setBaseAnimation`, qui stoppe proprement le clip en cours).
- [x] **Radar (mini-carte) en bas de l'écran** (`updateRadar()`, nouveau) : projection
  orthographique top-down (indépendante de l'angle de caméra, contrairement aux
  étiquettes joueurs projetées en 3D) de tous les joueurs + le ballon, fond
  semi-transparent (`rgba(8,28,16,0.35)`) laissant deviner la pelouse en dessous. Même
  convention d'axes que le reste du module (Z monde → horizontal radar, X monde →
  vertical radar). Couleurs alignées sur celles déjà utilisées par les étiquettes
  joueurs (bleu domicile / rouge extérieur), joueur contrôlé mis en avant par un anneau
  vert. Togglable en jeu (`contextToggleRadar()`, menu contextuel), particulièrement
  utile avec les nouveaux presets de caméra bas/rapprochés où le champ de vision réduit
  rend le placement/les appels de passe plus difficiles à lire directement sur le terrain.
- [x] **Nouveau défaut caméra "End-to-End"** : l'ancien défaut au coup d'envoi
  (alpha=0, beta=0.22, radius=78 — quasi à l'aplomb, assez proche) ne laissait pas
  assez voir venir le jeu ("meilleure vision des joueurs" demandée). Remplacé par
  (0, 0.3, 105) : le rectangle vert tient désormais en entier à l'écran (les deux
  surfaces de réparation visibles simultanément), avec un peu plus de perspective
  qu'avant (pas un pur aplomb orthographique) — vérifié par Playwright, net gain de
  lisibilité par rapport à l'ancien cadrage.
- [x] **5 caméras façon FIFA ajoutées** (`CAMERA_PRESETS`, `football.config.ts`),
  en plus de `Tactique`/`Rapprochée` déjà existantes :
  - `Broadcast (TV)` (beta≈1.22, radius=135) : vue de retransmission, très
    convaincante en jeu (vérifiée par Playwright — cadrage stade+tribunes+3D
    supporters très proche d'une vraie diffusion télé).
  - `Dynamique (Télé)` (beta≈1.1, radius 55-95, `dynamicZoom`) : nouvelle logique
    `updateDynamicZoom()` — le radius s'interpole selon l'étalement réel des 22
    joueurs sur le terrain (bounding box, ~25 m en mêlée compacte à ~90 m en jeu
    très étiré), pour un effet zoom in/out cinématique automatique.
  - `Coop` (beta≈1.32, radius=34) : vue basse et rapprochée.
  - `End-to-End` : cf. ci-dessus (devenu le défaut).
  - `Vue joueur` (`mode:'player'`, nouvelle logique `updatePlayerCamera()`) :
    caméra à la troisième personne collée derrière le joueur contrôlé. `alpha`
    recalculé chaque frame à partir de `mesh.rotation.y` (même angle que
    `syncPositions()`), formule dérivée de la position sphérique de Babylon
    (`alpha = -(facing + PI/2)`) avec lissage circulaire correct (normalisation
    du delta d'angle dans [-π,π] pour éviter un tour complet parasite au passage
    ±π) ; contrôle souris détaché automatiquement (la caméra pilote alpha
    elle-même). Vérifié par Playwright en déplaçant le joueur contrôlé (touches
    D puis W) : suivi fluide, aucun décrochage ni saut d'angle.
  - Chip actif mis en surbrillance dans le menu contextuel (`activeCameraPresetId`).
- Vérifié par Playwright (match France-Angleterre) : vue par défaut, preset
  Broadcast et Vue joueur testés individuellement, aucune erreur console sur
  l'ensemble du parcours. Presets Dynamique/Coop non testés visuellement un par un
  (même mécanisme orbit que Broadcast, déjà confirmé fonctionnel) faute de temps de
  rendu (Chromium headless logiciel, très lent) ; célébration de but non déclenchée
  en conditions réelles lors de cette vérification (aucun but marqué pendant le test),
  câblage revu par relecture de code (mêmes patterns `playOneShot`/`animationGroups`
  déjà éprouvés ailleurs dans `player.service.ts`).

## Phase 13 - Bug majeur (défenseurs hors terrain), célébration cassée, filet et éclairage ternes

- [x] **Bug majeur corrigé : "les joueurs quittent presque tous la pelouse et ne font
  que courir"** — root cause dans `ai.service.ts` `updateDefender()` (branche de repli
  "revenir en position défensive", la plus empruntée en pratique) : `targetZ = goalZ +
  (isHome ? 15 : -15)` calait le décalage de 15 m sur le flag `isHome` BRUT au lieu de
  `ownGoalSign()`/`sideSwapped`. Avant le changement de camp à la mi-temps ça tombait
  juste par coïncidence ; après (quand `goalZ` s'inverse), le décalage restait câblé sur
  l'ancien camp et envoyait TOUTE la ligne défensive 15 m AU-DELÀ de sa propre ligne de
  but — donc hors du terrain, dans les tribunes — au lieu de 15 m devant. Corrigé avec
  `targetZ = goalZ - ownGoalSign() * 15` (va toujours vers le centre, quel que soit le
  camp). `updateForward`/`isBallInOurHalf`/`isBallInOpponentHalf` utilisaient déjà
  correctement `ownGoalSign()` — seule `updateDefender` avait cette régression.
- [x] **Bug corrigé (secondaire, même famille) : position des remplaçants** —
  `PlayerService.replacePlayer()` reprenait la position PHYSIQUE du sortant au moment
  du changement (`pos.x/z`, parfois en pleine course près d'une touche) comme "position
  de formation" permanente du remplaçant — utilisée ensuite à chaque coup d'envoi/remise
  à zéro après un but (`repositionPlayersToFormation()`) ET par l'IA
  (`updateMidfielder`/`updateDefender`, basées sur `config.initialX/Z`). Le remplaçant
  héritait donc d'un poste durablement décalé. Corrigé en reprenant
  `outgoing.config.initialX/Z` (la vraie position de formation) — sans risque visuel
  puisque les remplacements ne peuvent avoir lieu que match en pause (`isPaused=true`
  forcé avant `openSubstitutionFlow()`).
- [x] **Bug corrigé : célébration de but "cassée" par une transition d'animation** —
  `syncPositions()` (qui choisit aussi l'animation Idle/Run/Sprint selon la vélocité
  physique) tournait CHAQUE frame même pendant `isGoalScored`, malgré un commentaire
  prétendant le contraire. Comme `world.step()` n'est plus appelé pendant la
  célébration (`updateGame()` déjà coupé), la vélocité reste figée à sa dernière valeur
  d'AVANT le but (souvent &gt; 0) — `syncPositions()` réécrasait donc instantanément
  `CelebrationFlip`/`IdleHappy` (Phase 12) par Run/Sprint, alors que les joueurs ne
  bougent plus du tout à l'écran. Corrigé en n'appelant `playerService.syncPositions()`
  qu'en dehors de `isGoalScored` (les `AnimationGroup` Babylon continuent de tourner
  seules via `scene.render()`, sans avoir besoin de `syncPositions()`). Vérifié que
  `repositionPlayersToFormation()` (appelée à la fin de la célébration) remet bien la
  vélocité à zéro pour tous les joueurs — pas de flicker résiduel au coup d'envoi
  suivant.
- [x] **Filet de but terne corrigé** (`stadium.service.ts` `createGoals()`/`netMat`) :
  l'émissif (0.55 gris) était une couleur PLEINE posée sur tout le mesh, sans texture —
  au lieu de suivre le motif en losanges (alpha découpée), il donnait un voile gris
  uniforme y compris dans les zones normalement transparentes entre les mailles.
  Ajouté `emissiveTexture` (la même texture que le diffuse, donc le même motif) et
  éclairci l'émissif (0.55 → 0.85) : filet net et blanc, comme sur les captures de
  référence fournies par l'utilisateur (vrais filets FIFA/PES bien visibles).
- [x] **Éclairage terne corrigé** (comparé aux captures de référence à l'éclairage net/
  contrasté) : `AMBIENT_LIGHT_INTENSITY` (0.4→0.55) et `DIRECTIONAL_LIGHT_INTENSITY`
  (0.8→1.1) relevées ; composante spéculaire ajoutée à la lumière directionnelle
  (absente auparavant — sans elle, aucun reflet net possible quelle que soit
  l'intensité de la diffuse) ; brouillard par défaut (temps clair) éclairci (bleu
  marine sombre 0.09/0.16/0.28 → gris-bleu clair 0.35/0.42/0.55, presque du brouillard
  de nuit même en plein jour) et densité réduite (0.003→0.0018). Le brouillard
  spécifique pluie/neige (plus sombre/dense, piloté par la météo choisie) reste
  inchangé.
- Vérifié par Playwright (match France-Angleterre) : rendu par défaut nettement plus
  lumineux/moins voilé de bleu qu'avant (captures avant/après comparées), aucune
  erreur console sur tout le parcours (coup d'envoi, changements de caméra,
  auto-play). Course des 22 joueurs observée en jeu réel (auto-play activé, horloge
  passée à 00:01) : tous restent dans les limites du terrain, poses de course
  normales, aucun figement/T-pose visible. Le scénario précis du bug (mi-temps →
  changement de camp → ligne défensive) n'a PAS pu être rejoué jusqu'au bout par
  Playwright dans cette vérification : le rendu logiciel (Chromium headless,
  sans accélération GPU réelle, ~60 personnages animés dans les tribunes + 22 joueurs)
  tourne si lentement dans cet environnement qu'atteindre la mi-temps en conditions
  réelles aurait nécessité un temps d'exécution disproportionné. Le correctif a été
  vérifié par substitution algébrique directe de la formule (comportement avant
  changement de camp inchangé, comportement après changement de camp désormais en
  miroir correct) plutôt que par un match complet rejoué.
