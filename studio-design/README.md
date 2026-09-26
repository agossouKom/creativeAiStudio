# Studio de création multimedia — conception

Conception de l'interface et de la configuration de l'agent IA pour la création, le montage, la gestion et la publication de médias.

## Livrables

| Fichier | Contenu |
| --- | --- |
| `agent-studio-media.yaml` | **Config de l'agent par défaut.** Source de vérité, consommée par le seeder. |
| `seed-studio-agent.py` | Rend la config exécutable : provisionne l'agent via l'API réelle. Idempotent. |
| `data-model.json` | Structures de données, avec pour chaque objet l'état actuel réel et ce qui manque. |
| `frontend-architecture.md` | Arborescence des composants, routes, états, persistance. |

## 1. Principes retenus

**Vocabulaire.** Le code des composants Studio n'emploie jamais « provider », « LLM », « worker », « edge-tts », « seed », « topic Kafka ». Le seul endroit où ces mots apparaissent est `admin/`, hors périmètre. Le mapping vers le vocabulaire utilisateur est centralisé dans `core/studio-copy.ts` : un seul fichier à traduire.

**Tooltips partout.** Exigence tenue via une directive `studioTip`, pas via des attributs `title=`. Raison : le dépôt n'a aujourd'hui aucune directive de tooltip (43 `title=` statiques dans le workspace, une CSS `.mic-tooltip` locale à la recherche vocale). Poser 300 `title=`serait non traduisable et non testable. Le texte des tooltips vit dans les templates, donc dans les fichiers de traduction.

**Agent par défaut.** Résolu par `slug`, pas par « le premier agent de la liste ». Créé au premier lancement s'il n'existe pas, et toujours sélectionné. L'utilisateur n'a jamais à choisir un agent pour créer un média.

**Aucun jargon côté configuration média.** Le choix du modèle d'image passe d'un champ texte libre de 64 caractères à un menu alimenté par `GET /api/generation/image-models`, lui-même alimenté par `mediaPolicy.allowedImageModels` du YAML.

## 2. Les cinq onglets

| Onglet | Route | Contenu | État |
| --- | --- | --- | --- |
| A. Studio | `/studio` | Brief, avatar, sources, modèle, validation | Partiel — le squelette existe |
| B. Montage | `/studio/montage/:jobId?` | Timeline multi-pistes, aperçu temps réel | **Inexistant** |
| C. Galerie | `/studio/galerie` | Vidéos / Images, tri chronologique, actions | Partiel — historique de jobs |
| D. Réseaux | `/studio/reseaux` | Connexion guidée des comptes | Existe, dispersé, sans OAuth |
| E. Planning | `/studio/planning` | Calendrier, programmation, historique | **Inexistant** |

### A. Studio — le flux proposé

1. **Brief** — une zone de texte « Description de votre contenu », plus trois menus déroulants (Objectif, Ton, Public cible). Le tout est persisté et réutilisable d'un média à l'autre. L'agent propose aussi des amorces de description.
2. **Avatar** — upload d'une photo, l'agent génère trois variations de style, l'utilisateur en retient une. L'avatar est rattaché à l'agent donc réutilisable d'un brief à l'autre.
3. **Séquences** — upload personnel (format et résolution normalisés) ou bibliothèque. Choix des clips, musique, durée totale.
4. **Modèle d'image** — menu de trois entrées nommées « Standard », « Haute définition », « Esquisse », chacune avec son explication. Aucun nom de fournisseur.
5. **Validation** — récapitulatif complet avant lancement : description, objectif, ton, public, durée, format, nombre de rendus. Rien n'est lancé sans confirmation.

### C. Galerie

Deux sections, plus récent en premier. Chaque média : prévisualiser, télécharger, republier, supprimer. La suppression est logique (`deleted` + `deletedAt`) comme le reste du schéma, donc restaurable.

### D. Réseaux

Reprend le parcours de l'onglet « Canaux » du workspace, qui fonctionne déjà : sélecteur d'agent, type, plateforme, puis les champs propres à la plateforme, avec aide contextuelle par champ. Deux améliorations : le bandeau d'expiration déjà présent, et un bandeau honnête sur les plateformes non supportées.

### E. Planning

Quatre étapes : choisir un média dans la galerie, choisir la date et l'heure, choisir les réseaux, valider. Statut par ligne, suppression et restauration. Une ligne par couple média × plateforme × date, sinon on perd l'état par réseau.

## 3. Ce qui existe déjà (à ne pas reconstruire)

- `generation-service` : cycle de vie complet des jobs, MinIO, presigned URL, publication sociale idempotente.
- Les workers image et vidéo, avec Kafka et DLQ.
- La table `channels` et tout le parcours de connexion côté workspace.
- Le pipeline vidéo : storyboard → visuels → voix off → sous-titres → musique → rendu.
- Les presets d'images déjà exposés en base (`size`, `style`, `quality`, `seed`) mais jamais affichés.

## 4. Ordre de réalisation proposé

1. **G1, G2, G3** (bloquants, petits) — sans eux, l'exigence « agent par défaut préconfiguré » et « PNG uniquement » est fausse.
2. **Onglet A** — le plus de valeur, et l'existant couvre l'essentiel.
3. **Onglet C** — une vue SQL plus deux endpoints.
4. **Onglet D** — OAuth est le vrai chantier, le reste est du rechargement.
5. **Onglet E** — table + scheduler, indépendant du reste.
6. **Onglet B** — le plus lourd, à traiter seul.

## 5. Écarts bloquants et manques

Numérotation stable, réutilisée dans les autres fichiers.

### G1 — Aucun agent par défaut n'est créé

Aucun `data.sql`, aucun `CommandLineRunner`, aucun `ApplicationRunner` dans `agent-team-service`. Le seul `@PostConstruct` est celui de `ToolRegistry.init()`. Les agents naissent d'appels API. Sans seed, l'exigence « un agent créé et sélectionné dès l'ouverture » n'est pas satisfaite.

→ `seed-studio-agent.py` + résolution par `slug` au démarrage du Studio.

### G2 — Le prompt de l'agent est ignoré pour la génération

`AgentGenerationController.storyboards` (ligne 57) écrase le prompt de l'agent :

```java
String systemPrompt = "Return only a JSON object matching this schema: " + STORYBOARD_SCHEMA;
```

`STORYBOARD_SCHEMA` est une constante (lignes 29-40). Le prompt système, la persona et les restrictions de l'agent ne sont donc **pas** utilisés pour le storyboard. Le YAML de ce dossier décrit le prompt voulu ; il ne sera pris en compte qu'après correction.

C'est le manque le plus important : sans lui, « préconfiguré avec les prompts requis » est décoratif.

→ Empiler le prompt de l'agent **avant** le schéma, et ne conserver le schéma que comme garde-fou de sortie.

### G3 — Le format PNG n'est pas garanti

`image-generation-worker` ne gère aucun format de sortie. Il déduit l'extension par sniff des magic bytes (`storage.py:38-55`) et accepte PNG, JPEG, GIF, BMP, WebP. Aucun paramètre `output_format` n'est envoyé au provider. Un provider peut donc renvoyer du JPEG alors que l'agent est configuré pour du PNG.

→ Conversion Pillow avant upload, plus `output_format: png` quand le provider le supporte. C'est le seul moyen de tenir la contrainte quel que soit le provider.

### G4 — Le modèle d'image est un champ texte libre

`imageOptions.model` accepte 64 caractèresarbitraires. L'agent peut taper un nom de fournisseur ou une chaîne vide. Contredit directement l'exigence d'un menu déroulant sans détail technique.

→ `GET /api/generation/image-models`, alimenté par le YAML.

### G5 — Aucun upload de média utilisateur

`generation-service` n'a aucun endpoint d'upload. `POST /api/agents/upload-photo` existe dans `agent-team-service` mais c'est la photo de profil d'un agent, pas un média. Sans lui, ni avatar ni séquences personnelles.

### G6 — L'API ne permet pas de configurer tout ce que définit le YAML

Relevé fait sur les DTO réels :

- `AgentConfigRequest` n'expose ni `contextWindowSize`, ni `retryMax`, ni `retryDelaySeconds`. Le seeder les signale et les retire plutôt que de croire à un succès.
- `AgentProfileRequest` n'a pas `brandVoiceJson`. Les garde-fous de ton sont donc passés dans `restrictions`.
- `CreateAgentRequest` n'a pas `status` : le statut se règle via `PATCH /{agentId}/status`.

`customParams` existe bien et permet d'activer les outils — c'est la seule voie, et elle fonctionne.

### G7 — Aucune entité média

Il n'existe que `generation_jobs` et `generation_outputs`. Pas d'entité média, donc pas de suppression, pas de republication depuis la galerie, pas de tag, et le contexte du brief n'est pas conservé. Le récapitulatif de la galerie est donc impossible à afficher fidèlement.

→ Ajouter `brief_json` et `format` à `generation_jobs` ; une vue SQL suffit pour la v1.

### G8 — Aucune table de publication planifiée

Vérifié : `V1__init_generation_schema.sql` ne crée que trois tables, aucune colonne de date future. `social_publish_requests` n'a que `submitted_at` et `published_at`. Le seul scheduler du dépôt, `TaskSchedulerService`, porte sur les tâches d'agents, pas sur des posts. L'onglet Planning est entièrement à créer.

### G9 — Le worker ne sait pas monter une timeline

`local_pipeline.py` enchaîne des clips stock, pose une voix off, une bande-son et des sous-titres. Il n'a aucune notion d'ordre, de coupe, de transition ni de piste. L'onglet Montage n'est pas un réglage supplémentaire, c'est un nouveau mode de rendu.

### G10 — Les plateformes non supportées échouent en silence côté UI

`SocialPlatformRegistry` ne déclare que Facebook et Instagram en `LIVE` ; les huit autres sont `PLANNED` et l'API renvoie `409 PLATFORM_NOT_AVAILABLE`. L'onglet Réseaux doit l'afficher, sinon l'utilisateur découvre la limitation au moment de publier.

## 6. Limites assumées

- Le rendu vidéo reste du **stock-footage** : pas de génération vidéo native, ni voix clone, ni synchronisation labiale. Le pipeline actuel est un monteur de clips, pas un modèle de génération.
- Les variations d'avatar et le montage sont proposés en logique ; le worker image n'a pas d'appel de retouche, donc l'avatar part du même endpoint de génération que les images.
- Le plan ci-dessus n'inclut pas l'estimation de charge : le seul chiffre mesuré est la durée de rendu observée en production, très variable (15 s à 2 min 48 selon la taille des clips retenus).
