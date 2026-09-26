# Architecture front-end du Studio

## Principe directeur

Un seul écran, cinq onglets, **zéro jargon**. Le mot « provider », « LLM », « worker », « edge-tts », « seed » n'apparaît jamais dans le code des composants Studio. La seule exception est un module `admin/` explicitement réservé, qui n'est pas dans le périmètre de ce document.

## Situation de départ (état réel, mesuré)

`frontend/src/app/features/agentique/generation-studio.component.ts` fait **388 lignes** : un `switch` IMAGE/VIDEO, 10 champs de formulaire, et un historique de jobs. C'est **l'onglet A seul**, dans une version embryonnaire :

- **0 tooltip** (aucun `title=`, aucune directive) — l'exigence §1 du Cahier des charges n'est pas tenue du tout.
- Aucun onglet : ni Montage, ni Galerie, ni Réseaux, ni Planning.
- `model` (modèle d'image) est un **champ texte libre de 64 caractères** : l'utilisateur peut taper n'importe quoi, y compris un nom de fournisseur.
- Aucune persistance : `ngOnInit` repart de zéro à chaque rechargement.
- Pas d'upload, pas d'avatar, pas de récapitulatif avant envoi.
- `agents` et `platforms` sont typés `any[]`.
- Un seul message d'erreur global, jamais remis à zéro.
- Le composant est rangé sous `features/agentique/` alors qu'il n'a aucun rapport avec les agents.

## Arborescence proposée

Remplacement complet, pas un ajout dans `features/agentique/`.

```
app/
├── shared/
│   └── ui/
│       ├── tooltip.directive.ts          ← NOUVEAU, absent du dépôt
│       ├── confirm-dialog.component.ts   ← dialog.service existe déjà
│       └── empty-state.component.ts       ← NOUVEAU
│
└── features/
    └── studio/
        ├── studio.routes.ts
        ├── studio-shell.component.ts        ← orchestrateur des 5 onglets
        ├── core/
        │   ├── studio-api.service.ts       ← 1 seul point d'appel HTTP
        │   ├── studio-state.service.ts     ← brief + agent courant (Signals)
        │   ├── agent-default.service.ts    ← création/sélection de l'agent par défaut
        │   ├── brief-persistence.service.ts← localStorage + versionnage du schéma
        │   └── studio-copy.ts              ← vocabulaire utilisateur final (centralisé)
        │
        ├── brief/                          ── Onglet A.1
        │   ├── brief-form.component.ts
        │   ├── objective-select.component.ts
        │   ├── tone-select.component.ts
        │   ├── audience-select.component.ts
        │   └── brief-summary.component.ts   ← persiste, bouton "Réutiliser"
        │
        ├── avatar/                         ── Onglet A.2
        │   ├── avatar-panel.component.ts
        │   ├── avatar-upload.component.ts
        │   └── avatar-variations.component.ts
        │
        ├── media-sources/                  ── Onglet A.3
        │   ├── source-switch.component.ts
        │   ├── upload-sequences.component.ts
        │   ├── library-picker.component.ts
        │   ├── clip-reorder.component.ts
        │   └── music-picker.component.ts
        │
        ├── model-picker/                   ── Onglet A.4
        │   └── image-model-select.component.ts
        │
        ├── review/                         ── Onglet A.5 (Validation & Envoi)
        │   ├── review-recap.component.ts
        │   └── launch-dialog.component.ts
        │
        ├── montage/                        ── Onglet B
        │   ├── montage-editor.component.ts
        │   ├── timeline.component.ts
        │   ├── timeline-track.component.ts
        │   ├── inspector-panel.component.ts
        │   └── preview-player.component.ts
        │
        ├── gallery/                        ── Onglet C
        │   ├── gallery.component.ts
        │   ├── gallery-section.component.ts  ← vidéos / images
        │   ├── media-card.component.ts
        │   └── media-actions.component.ts   ← prévisualiser/télécharger/republier/supprimer
        │
        ├── social/                         ── Onglet D
        │   ├── social-accounts.component.ts
        │   ├── account-card.component.ts
        │   ├── connect-wizard.component.ts  ← calqué sur l'onglet Canaux du Workspace
        │   └── platform-support.component.ts← bandeau honnête sur PLANNED
        │
        └── planning/                       ── Onglet E
            ├── planning-calendar.component.ts
            ├── schedule-dialog.component.ts
            ├── scheduled-item.component.ts
            └── publish-history.component.ts
```

## Routes

| Route | Onglet | Garde |
| --- | --- | --- |
| `/studio` | Studio de création | `authGuard` |
| `/studio/montage/:jobId?` | Montage | `authGuard` |
| `/studio/galerie` | Galerie | `authGuard` |
| `/studio/reseaux` | Réseaux | `authGuard` |
| `/studio/planning` | Planning | `authGuard` |

L'agent par défaut est résolu dans `authGuard` ou dans le shell : jamais laissé vide, jamais demandé à l'utilisateur.

## États

`Signal` + `computed`, pas de RxJS `BehaviorSubject` par property. Un seul objet d'état pour le brief, ce qui rend la persistance et le récapitulatif triviaux.

```ts
// core/studio-state.service.ts
brief        = signal<StudioBrief>(loadBrief() ?? DEFAULT_BRIEF);
agent        = signal<AgentBrief | null>(null);   // résolu au démarrage
selection    = signal<Selection | null>(null);     // média choisi pour le montage/planning
dirty        = computed(() => brief() !== loadBrief());
```

## Persistance du brief

`localStorage` sous une clé versionnée : `studio.brief.v1`. Le versioning évite qu'un ancien format casse le parsing après un déploiement. `briefDefaults` du YAML de l'agent fournit les valeurs initiales, donc un utilisateur neuf n'a jamais un formulaire vide.

## Directive tooltip

Le dépôt n'a **aucune** directive de tooltip réutilisable (seulement des `title=` natifs et une CSS `.mic-tooltip` locale à la recherche vocale). Il faut la créer, sinon l'exigence « chaque champ a un survol » se translate par 300 attributs `title` — c'est-à-dire pas de traductions, pas de positionnement, pas de tests.

```ts
@Directive({ selector: '[studioTip]', standalone: true })
export class StudioTipDirective {
  // affiche studioTip, placement auto,_delay 200ms, accessible clavier (focus + aria-describedby)
}
```

Usage, avec le texte dans le template plutôt que dans le TS, donc traduisible :

```html
<studio-select formControlName="objectif" studioTip="Ce que vous voulez obtenir de la vidéo : faire connaître, éduquer, vendre…">
```

## Un seul service HTTP

`studio-api.service.ts` regroupe tout. Le composant actuel appelle `http` directement 8 fois avec des `any`. Centraliser permet d'une part de typer les réponses, d'autre part d'appliquer une seule politique d'erreur : chaque erreur métier devient un message du vocabulaire utilisateur, jamais un code HTTP.

## Ce qui dépend du backend

Trois onglets ne sont pas.mapping sur l'existant. Le détail des manques est dans `README.md` §5, mais en résumé :

- **Onglet A** : faisable côté API aujourd'hui, sauf l'upload, l'avatar, le menu des modèles d'images et la persistance de `briefJson`.
- **Onglet B Montage** : inexistant. Le worker ne connaît pas la timeline ; il ne fait qu'enchaîner des clips stock. C'est un nouveau mode de rendu, pas un réglage.
- **Onglet C Galerie** : constructible par vue SQL sur l'existant, mais il faut ajouter « supprimer » et « publier » depuis un média arbitraire.
- **Onglet D Réseaux** : la table `channels` existe et l'onglet Canaux du Workspace donne déjà le parcours de saisie. Il manque OAuth et une vérité sur les plateformes non supportées.
- **Onglet E Planning** : table et scheduler à créer entièrement.
