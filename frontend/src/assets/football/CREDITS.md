# Crédits des assets 3D/textures

Tous les fichiers de ce dossier proviennent de [Poly Haven](https://polyhaven.com), sous licence **CC0**
(domaine public — aucune attribution requise, usage commercial libre). Aucune modification du contenu,
seulement reformatage/renommage des chemins pour l'intégration.

- `ball/` — [Football](https://polyhaven.com/a/football), modèle glTF 1K + textures (diffuse/normal/ARM)
- `jersey/` — [Cotton Jersey](https://polyhaven.com/a/cotton_jersey), texture PBR 1K (diffuse/normal/roughness)

Téléchargé via l'API publique de Poly Haven (`api.polyhaven.com`), intégrité vérifiée par somme MD5
contre les valeurs renvoyées par l'API.

## Audio (`audio/`)

Fichiers fournis par l'utilisateur (`footBall/utilityMatch/`), noms de fichiers d'origine cohérents avec
des téléchargements Freesound.org (préfixe pseudo du contributeur). Renommés pour l'intégration, licences
non revérifiées ici — à confirmer avant toute publication/usage commercial si ce n'est pas déjà fait.

- `whistle.mp3` — sifflet arbitre (`freesound_community-metal-whistle-6121`)
- `kick.mp3` — frappe de balle (`freesound_community-soccer-ball-kick-37625`, 4 copies identiques fournies, une seule conservée)
- `crowd-ambiance-1.mp3` / `crowd-ambiance-2.mp3` — ambiance de fond en boucle (`freesound_community-football-crowd-3-69245`, `smncola-stadio-343738`)
- `crowd-chant.mp3` — chant de tribune (`pwlpl-stadium-chant-377306`, 3 copies identiques fournies, une seule conservée)
- `crowd-cheer.mp3` / `crowd-cheer-strong.mp3` — acclamations (occasion manquée / but) (`vishiv-crowd-cheering-in-stadium-435357`, `gregorquendel-...-strong-cheering-rhythmic-cheering-116190`)
- `anthem-hype.mp3` / `anthem-latin.mp3` — musique d'avant-match (`openmindaudio-stadium-rock-hype-anthem...`, `substancial-latin-loop-brazil-154637`)

## Supporters 3D (`supporters/`)

Modèles FBX fournis par l'utilisateur (`footBall/supporters/`), animations Mixamo (personnages + clips
d'animation générés par Adobe Mixamo). Convertis en glTF binaire via FBX2glTF, fusionnés (un seul mesh/
squelette portant plusieurs clips d'animation) et optimisés (textures redimensionnées/compressées) via
gltf-transform. Licences Mixamo (usage libre y compris commercial pour les assets générés par leur
service) non revérifiées ici — à confirmer avant toute publication si ce n'est pas déjà fait.

- `supporter_a.glb` — personnage Mixamo (squelette `mixamorig6:`), animations `Idle` (pose de base),
  `Cheering`, `Clapping` — fusion de `Idle.fbx` + `Cheering.fbx` + `Clapping.fbx`
- `supporter_b.glb` — personnage Mixamo (squelette `mixamorig:`), animations `StandingClap` (pose de
  base), `Clapping`, `ClappingAlt`, `DismissingGesture` — fusion de `Standing Clap.fbx` +
  `Clapping(1).fbx` + `Clapping(2).fbx` + `Dismissing Gesture.fbx` (les deux fichiers `Clapping(1)`/
  `Clapping(2)` ne sont PAS des doublons malgré le nom identique — vérifié par somme MD5 — donc conservés
  comme deux animations distinctes)
