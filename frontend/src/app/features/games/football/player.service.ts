import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF'; // enregistre le loader .gltf/.glb auprès de SceneLoader
import * as RAPIER from '@dimforge/rapier3d-compat';
import { FOOTBALL_CONFIG, PlayerRole } from './football.config';
import { PlayerInstance, PlayerConfig, TeamConfig } from './football.types';
import { PlayerData } from './teams.data';

/** Texture de tissu réelle (CC0, Poly Haven — voir src/assets/football/CREDITS.md) */
const JERSEY_TEXTURE_PATH = 'assets/football/jersey/';

/**
 * Modèle de joueur réel (Mixamo, personnage "Ch38" + squelette + ~20 animations
 * fusionnées dans un seul .glb — voir PLAN.md pour le détail du pipeline de
 * conversion FBX→glTF/fusion des clips). Remplace les meshes procéduraux (boîtes)
 * utilisés jusqu'ici.
 */
const PLAYER_MODEL_PATH = 'assets/football/players/';
const PLAYER_MODEL_FILE = 'player.glb';

/** Préfixe des os du squelette Mixamo dans le fichier fusionné (cf. merge.js) */
const BONE_PREFIX = 'mixamorig5:';

/**
 * Hauteur locale (pieds → sommet du crâne, AVANT application de `playerScale`) de
 * l'ancien personnage procédural (tête sphérique centrée à y=1.5, rayon 0.11).
 * Le nouveau modèle Mixamo est en unités réalistes (~1,785 m pieds-tête, mesuré sur
 * le .glb fusionné). Pour ne pas soudain "rapetisser" les joueurs à une taille
 * réaliste — tout le jeu (distance de caméra, ballon grossi x2.2, portée de tacle...)
 * est calibré autour de cette exagération volontaire — on calcule un ratio qui fait
 * correspondre exactement la taille apparente du nouveau modèle à l'ancienne, pour
 * les mêmes réglages `playerScale` (1.8/2.2/2.6, cf. PLAYER_SIZE_OPTIONS).
 */
const LEGACY_LOCAL_HEIGHT = 1.61;
const NATIVE_MODEL_HEIGHT = 1.7847;
const MODEL_SCALE_RATIO = LEGACY_LOCAL_HEIGHT / NATIVE_MODEL_HEIGHT;

/** Noms des clips fusionnés dans player.glb (cf. footBall/mixamo/, merge.js) */
export type PlayerAnimName =
  | 'Idle' | 'IdleOffensive' | 'IdleHappy' | 'Run' | 'Sprint' | 'FastRun' | 'JogBackward' | 'WalkingTurn'
  | 'Dribble' | 'Tackle' | 'Trip' | 'Pass' | 'Shoot' | 'Chip' | 'Header'
  | 'StrikeForwardJog' | 'ThrowIn' | 'CelebrationFlip'
  | 'GK_Idle' | 'GK_Catch' | 'GK_CatchAlt' | 'GK_PlaceBall';

/**
 * Service de création et gestion des joueurs
 * Crée des joueurs humanoïdes avec corps, jambes, bras, tête
 */
export class PlayerService {
  /**
   * Grossit le modèle du joueur (mesh + collider) pour un rendu plus lisible/réaliste
   * vu de la caméra aérienne. `playerScale` est la taille de base (choisie avant le
   * coup d'envoi, affecte aussi le collider physique) ; `liveScaleMultiplier` est un
   * ajustement purement visuel appliqué par-dessus, modifiable en cours de match
   * (menu contextuel) sans toucher aux colliders déjà créés.
   */
  private playerScale = 2.0; // ≈1,75m de hauteur simulée au minimum (physique + visuel, cf. createPlayer)
  private liveScaleMultiplier = 1;

  private scene: BABYLON.Scene;
  private world: RAPIER.World;
  private players: PlayerInstance[] = [];
  /** Facteurs météo (glisse sous la pluie/neige) appliqués aux déplacements du joueur humain */
  private weatherSpeedFactor = 1;
  private weatherAccelFactor = 1;

  // Textures de maillot partagées (chargées une seule fois, réutilisées pour tous les joueurs)
  private jerseyDiffuseTexture: BABYLON.Texture | null = null;
  private jerseyBumpTexture: BABYLON.Texture | null = null;

  /** Modèle 3D (mesh+squelette+animations) chargé une seule fois par match, cloné pour
   * chaque joueur via `instantiateModelsToScene`. */
  private playerContainer: BABYLON.AssetContainer | null = null;

  constructor(scene: BABYLON.Scene, world: RAPIER.World) {
    this.scene = scene;
    this.world = world;
  }

  /**
   * Charge le modèle 3D des joueurs (une seule fois). À appeler et attendre avant
   * `createTeam`/`createGoalkeeperOnly` — ces méthodes restent synchrones et supposent
   * le modèle déjà prêt (cf. football.component.ts `startMatch()`).
   */
  async preload(): Promise<void> {
    if (this.playerContainer) return;
    this.playerContainer = await BABYLON.SceneLoader.LoadAssetContainerAsync(PLAYER_MODEL_PATH, PLAYER_MODEL_FILE, this.scene);
  }

  setWeatherFactors(speedFactor: number, accelFactor: number): void {
    this.weatherSpeedFactor = speedFactor;
    this.weatherAccelFactor = accelFactor;
  }

  /** Taille de base à appliquer aux prochains joueurs créés (réglage pré-match) */
  setBaseScale(scale: number): void {
    this.playerScale = scale;
  }

  /** Ajustement visuel en direct (menu contextuel), sans toucher aux colliders physiques */
  setLiveScaleMultiplier(multiplier: number): void {
    this.liveScaleMultiplier = multiplier;
    const effective = this.playerScale * multiplier;
    this.players.forEach(p => {
      p.mesh.scaling.set(effective, effective, effective);
    });
  }

  getLiveScaleMultiplier(): number {
    return this.liveScaleMultiplier;
  }

  /** Charge (une seule fois) les textures de tissu réelles pour le maillot des joueurs */
  private getJerseyTextures(): { diffuse: BABYLON.Texture; bump: BABYLON.Texture } {
    if (!this.jerseyDiffuseTexture) {
      this.jerseyDiffuseTexture = new BABYLON.Texture(JERSEY_TEXTURE_PATH + 'cotton_jersey_diff_1k.jpg', this.scene);
      this.jerseyDiffuseTexture.uScale = 3;
      this.jerseyDiffuseTexture.vScale = 3;
    }
    if (!this.jerseyBumpTexture) {
      this.jerseyBumpTexture = new BABYLON.Texture(JERSEY_TEXTURE_PATH + 'cotton_jersey_nor_gl_1k.jpg', this.scene);
      this.jerseyBumpTexture.uScale = 3;
      this.jerseyBumpTexture.vScale = 3;
    }
    return { diffuse: this.jerseyDiffuseTexture, bump: this.jerseyBumpTexture };
  }

  /**
   * Crée tous les joueurs d'une équipe.
   * Si `starters` est fourni (les 11 premiers de la feuille de match composée
   * par le joueur), le nom/numéro/stats réels sont utilisés ; sinon des
   * joueurs génériques sont générés (secours si aucune feuille n'a été faite).
   */
  createTeam(teamConfig: TeamConfig, isHome: boolean, starters?: PlayerData[], captainNumber?: number): PlayerInstance[] {
    const formation = FOOTBALL_CONFIG.FORMATIONS[teamConfig.formation];
    const teamPlayers: PlayerInstance[] = [];
    // Bug corrigé (root cause de "le gardien sort et ignore le ballon"/l'IA "ne joue pas
    // son rôle") : ce signe était inversé par rapport à TOUT le reste du code (AIService
    // .ownGoalSign(), BallService.checkGoal(), RefereeService.teamDefending{Positive,Negative}Z()
    // s'accordent tous sur domicile = Z négatif, extérieur = Z positif). Domicile se
    // retrouvait donc à engendrer ses joueurs du côté Z POSITIF alors que toute la logique
    // de jeu (où défendre, où attaquer, où se replier) le croyait côté négatif — chaque
    // joueur passait donc son temps à courir vers le mauvais bout du terrain, le gardien
    // y compris (raison pour laquelle il semblait "sortir et ignorer le ballon" : il fonçait
    // en réalité vers l'autre cage, à l'autre bout du terrain).
    const side = isHome ? 1 : -1;

    formation.positions.forEach((pos, index) => {
      const starter = starters?.[index];

      const player = this.createPlayer({
        id: index,
        teamId: teamConfig.id,
        name: starter?.name ?? this.generatePlayerName(index, teamConfig.id),
        number: starter?.number ?? index + 1,
        role: pos.role,
        speed: starter
          ? FOOTBALL_CONFIG.PLAYER.SPEED * (0.7 + (starter.stats.speed / 10) * 0.6)
          : FOOTBALL_CONFIG.PLAYER.SPEED * (0.8 + Math.random() * 0.4),
        acceleration: starter
          ? FOOTBALL_CONFIG.PLAYER.ACCELERATION * (0.7 + (starter.stats.acceleration / 10) * 0.6)
          : FOOTBALL_CONFIG.PLAYER.ACCELERATION * (0.8 + Math.random() * 0.4),
        shotPower: starter
          ? FOOTBALL_CONFIG.PLAYER.KICK_POWER_MIN + (starter.stats.shotPower / 10) * (FOOTBALL_CONFIG.PLAYER.KICK_POWER_MAX - FOOTBALL_CONFIG.PLAYER.KICK_POWER_MIN)
          : 10 + Math.random() * 15,
        passAccuracy: starter ? Math.min(0.95, Math.max(0.4, starter.stats.passAccuracy / 10)) : 0.5 + Math.random() * 0.5,
        defense: starter ? Math.min(0.95, Math.max(0.3, starter.stats.defense / 10)) : 0.3 + Math.random() * 0.7,
        stamina: FOOTBALL_CONFIG.PLAYER.STAMINA_MAX,
        maxStamina: FOOTBALL_CONFIG.PLAYER.STAMINA_MAX,
        initialX: pos.x * side,
        initialZ: pos.z * side,
        isCaptain: (starter?.number ?? index + 1) === captainNumber,
      }, teamConfig, index);

      teamPlayers.push(player);
    });

    this.players.push(...teamPlayers);
    return teamPlayers;
  }

  /**
   * Mode Entraînement : pas de véritable équipe adverse (onze complet + IA), seulement
   * son gardien, pour pouvoir s'entraîner à marquer face à un vrai gardien guidé par
   * l'IA — les autres "adversaires" à dribbler sont des mannequins statiques
   * (cf. createTrainingDummies), pas de joueurs IA.
   */
  createGoalkeeperOnly(teamConfig: TeamConfig, isHome: boolean): PlayerInstance[] {
    const formation = FOOTBALL_CONFIG.FORMATIONS[teamConfig.formation];
    const gkPos = formation.positions.find(p => p.role === 'gk') ?? formation.positions[0];
    const side = isHome ? 1 : -1;

    const player = this.createPlayer({
      id: 0,
      teamId: teamConfig.id,
      name: 'Gardien',
      number: 1,
      role: 'gk',
      speed: FOOTBALL_CONFIG.PLAYER.SPEED,
      acceleration: FOOTBALL_CONFIG.PLAYER.ACCELERATION,
      shotPower: 15,
      passAccuracy: 0.6,
      defense: 0.7,
      stamina: FOOTBALL_CONFIG.PLAYER.STAMINA_MAX,
      maxStamina: FOOTBALL_CONFIG.PLAYER.STAMINA_MAX,
      initialX: gkPos.x * side,
      initialZ: gkPos.z * side,
    }, teamConfig, 0);

    this.players.push(player);
    return [player];
  }

  /**
   * Un seul attaquant IA (pas un onze complet) — utilisé par l'exercice d'entraînement
   * "Tacle" : un mannequin statique (createTrainingDummies) est un simple obstacle
   * physique, impossible à tacler puisque le tacle cible un `PlayerInstance` porteur du
   * ballon. Cet attaquant est un vrai joueur, piloté par le même AIService que n'importe
   * quel adversaire en match — la seule façon d'obtenir une cible mobile réellement
   * tacklable sans dupliquer la logique d'IA.
   */
  createSingleAttacker(teamConfig: TeamConfig, isHome: boolean, x: number, z: number): PlayerInstance {
    const player = this.createPlayer({
      id: 1,
      teamId: teamConfig.id,
      name: 'Attaquant',
      number: 55, // évite un doublon visuel avec le #9 habituel du onze domicile
      role: 'fwd',
      speed: FOOTBALL_CONFIG.PLAYER.SPEED,
      acceleration: FOOTBALL_CONFIG.PLAYER.ACCELERATION,
      shotPower: 15,
      passAccuracy: 0.6,
      defense: 0.3,
      stamina: FOOTBALL_CONFIG.PLAYER.STAMINA_MAX,
      maxStamina: FOOTBALL_CONFIG.PLAYER.STAMINA_MAX,
      initialX: x,
      initialZ: z,
    }, teamConfig, 1);

    this.players.push(player);
    return player;
  }

  /** Corps physiques des mannequins (mesh -> rigid body), pour pouvoir les libérer
   * proprement quand on change d'exercice — `dummy.dispose()` seul ne retire QUE le
   * mesh visuel, pas le collider Rapier, qui resterait sinon un obstacle invisible. */
  private dummyBodies = new Map<BABYLON.Mesh, RAPIER.RigidBody>();

  private createDummyAt(x: number, z: number, index: number): BABYLON.Mesh {
    const mat = new BABYLON.StandardMaterial('dummyMat_' + index, this.scene);
    mat.diffuseColor = new BABYLON.Color3(1, 0.45, 0.1);
    mat.emissiveColor = new BABYLON.Color3(0.4, 0.15, 0);
    mat.specularColor = new BABYLON.Color3(0, 0, 0);

    const dummy = BABYLON.MeshBuilder.CreateCylinder('dummy_' + index, {
      height: 1.1,
      diameterTop: 0.25,
      diameterBottom: 0.4,
      tessellation: 12,
    }, this.scene);
    dummy.position = new BABYLON.Vector3(x, 0.55, z);
    dummy.material = mat;
    dummy.isPickable = false;

    // Corps physique statique : le ballon (et les joueurs) rebondissent dessus au
    // lieu de le traverser, pour un vrai obstacle de dribble
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0.55, z);
    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cylinder(0.55, 0.3).setFriction(0.3).setRestitution(0.3);
    this.world.createCollider(colliderDesc, body);
    this.dummyBodies.set(dummy, body);

    return dummy;
  }

  /**
   * Mannequins d'entraînement : cibles statiques (pas de joueurs IA, aucun
   * comportement) à dribbler/tacler, disposées en slalom dans le dernier tiers pour
   * pratiquer la conduite de balle avant de tirer au but.
   */
  createTrainingDummies(attackingSign: 1 | -1): BABYLON.Mesh[] {
    const { LENGTH } = FOOTBALL_CONFIG.FIELD;
    const positions = [
      { x: -6, zFromGoal: 30 },
      { x: 6, zFromGoal: 24 },
      { x: -5, zFromGoal: 18 },
      { x: 5, zFromGoal: 12 },
    ];
    return positions.map((p, i) => this.createDummyAt(p.x, attackingSign * (LENGTH / 2 - p.zFromGoal), i));
  }

  /** Mannequins à des positions précises (mur de coup franc, cibles de passe...) */
  createDummiesAtPositions(positions: BABYLON.Vector3[]): BABYLON.Mesh[] {
    return positions.map((p, i) => this.createDummyAt(p.x, p.z, 100 + i));
  }

  /** Retire proprement mesh ET collider physique — à utiliser à la place de `.dispose()`
   * seul pour ne pas laisser d'obstacle invisible en changeant d'exercice. */
  disposeDummies(dummies: BABYLON.Mesh[]): void {
    dummies.forEach((d) => {
      const body = this.dummyBodies.get(d);
      if (body) {
        this.world.removeRigidBody(body);
        this.dummyBodies.delete(d);
      }
      d.dispose();
    });
  }

  /**
   * Remplace un joueur sur le terrain par un autre (remplacement en cours de
   * match) : dispose l'ancien mesh/corps physique et recrée le remplaçant à
   * la même position/rôle.
   */
  replacePlayer(outgoing: PlayerInstance, incoming: PlayerData, teamConfig: TeamConfig): PlayerInstance {
    const pos = outgoing.body.translation();
    const role = outgoing.config.role;

    Object.values(outgoing.animationGroups).forEach(ag => ag.dispose());
    outgoing.mesh.dispose();
    this.world.removeRigidBody(outgoing.body);
    this.players = this.players.filter(p => p !== outgoing);

    const replacement = this.createPlayer({
      id: outgoing.config.id,
      teamId: teamConfig.id,
      name: incoming.name,
      number: incoming.number,
      role,
      speed: FOOTBALL_CONFIG.PLAYER.SPEED * (0.7 + (incoming.stats.speed / 10) * 0.6),
      acceleration: FOOTBALL_CONFIG.PLAYER.ACCELERATION * (0.7 + (incoming.stats.acceleration / 10) * 0.6),
      shotPower: FOOTBALL_CONFIG.PLAYER.KICK_POWER_MIN + (incoming.stats.shotPower / 10) * (FOOTBALL_CONFIG.PLAYER.KICK_POWER_MAX - FOOTBALL_CONFIG.PLAYER.KICK_POWER_MIN),
      passAccuracy: Math.min(0.95, Math.max(0.4, incoming.stats.passAccuracy / 10)),
      defense: Math.min(0.95, Math.max(0.3, incoming.stats.defense / 10)),
      stamina: FOOTBALL_CONFIG.PLAYER.STAMINA_MAX,
      maxStamina: FOOTBALL_CONFIG.PLAYER.STAMINA_MAX,
      // Bug corrigé : reprenait `pos` (position PHYSIQUE du sortant au moment du
      // changement — parfois en plein sprint près d'une touche/surface) comme "position
      // de formation" du remplaçant, utilisée ensuite en permanence (chaque coup d'envoi/
      // remise à zéro après un but, et par l'IA — cf. updateMidfielder/updateDefender qui
      // se basent sur `config.initialX/Z`) : le remplaçant héritait donc d'un poste
      // complètement décalé pour le reste du match. Reprend la vraie position de
      // formation du sortant à la place.
      initialX: outgoing.config.initialX,
      initialZ: outgoing.config.initialZ,
    }, teamConfig, outgoing.config.id);

    this.players.push(replacement);
    return replacement;
  }

  /**
   * Crée un joueur humanoïde
   */
  private createPlayer(config: PlayerConfig, teamConfig: TeamConfig, index: number): PlayerInstance {
    if (!this.playerContainer) {
      throw new Error('PlayerService.preload() doit être chargé (et attendu) avant createPlayer()');
    }
    const colors = teamConfig.colors;
    const isKeeper = config.role === 'gk';

    // Groupe parent pour tout le joueur
    const pivot = new BABYLON.TransformNode('player_' + config.teamId + '_' + index, this.scene);
    pivot.position = new BABYLON.Vector3(config.initialX, 0, config.initialZ);

    // ─── Modèle 3D (Mixamo) ─────────────────────────────────────────────
    // Clone indépendant (mesh + squelette + toutes les animations) à partir du
    // conteneur chargé une fois par preload() — doNotInstantiate:true force un
    // vrai clonage (pas des thin instances GPU) pour que chaque joueur ait son
    // propre squelette, animable indépendamment des autres.
    const entries = this.playerContainer.instantiateModelsToScene((n) => n, false, { doNotInstantiate: true });
    const modelRoot = entries.rootNodes[0];
    modelRoot.parent = pivot;
    modelRoot.position.set(0, 0, 0);

    const skeleton = entries.skeletons[0];
    const findBone = (name: string) => skeleton?.bones.find(b => b.name === BONE_PREFIX + name) ?? null;
    const legPivots = [findBone('LeftUpLeg'), findBone('RightUpLeg')].filter((b): b is BABYLON.Bone => !!b);
    const armPivots = [findBone('LeftArm'), findBone('RightArm')].filter((b): b is BABYLON.Bone => !!b);

    // ─── Couleurs d'équipe (maillot/short/chaussettes) ──────────────────
    // Le modèle source partage un seul matériau texturé entre Corps/Chaussures/
    // Maillot/Short/Chaussettes (cf. PLAN.md) : on remplace juste le matériau du
    // maillot/short/chaussettes de CE clone par un matériau propre à l'équipe
    // (même tissu réel que l'ancien système procédural), en laissant peau/
    // cheveux/chaussures du modèle intacts.
    const jerseyTex = this.getJerseyTextures();
    const meshes = modelRoot.getChildMeshes();

    const shirtMesh = meshes.find(m => m.name === 'Ch38_Shirt');
    if (shirtMesh) {
      const shirtMat = new BABYLON.StandardMaterial('shirtMat_' + index, this.scene);
      shirtMat.diffuseColor = isKeeper
        ? new BABYLON.Color3(colors.keeper.r, colors.keeper.g, colors.keeper.b)
        : new BABYLON.Color3(colors.primary.r, colors.primary.g, colors.primary.b);
      shirtMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
      shirtMat.diffuseTexture = jerseyTex.diffuse;
      shirtMat.bumpTexture = jerseyTex.bump;
      shirtMesh.material = shirtMat;
    }

    const shortsMesh = meshes.find(m => m.name === 'Ch38_Shorts');
    if (shortsMesh) {
      const shortsMat = new BABYLON.StandardMaterial('shortsMat_' + index, this.scene);
      shortsMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.15); // Short noir, comme l'ancien système
      shortsMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
      shortsMesh.material = shortsMat;
    }

    const socksMesh = meshes.find(m => m.name === 'Ch38_Socks');
    if (socksMesh) {
      const socksMat = new BABYLON.StandardMaterial('socksMat_' + index, this.scene);
      socksMat.diffuseColor = new BABYLON.Color3(colors.secondary.r, colors.secondary.g, colors.secondary.b);
      socksMat.specularColor = new BABYLON.Color3(0, 0, 0);
      socksMesh.material = socksMat;
    }

    // ─── Animations (clonées indépendamment par instantiateModelsToScene) ──
    const animationGroups: Record<string, BABYLON.AnimationGroup> = {};
    entries.animationGroups.forEach(ag => {
      ag.stop();
      // Fondu enchaîné entre clips (Idle<->Run<->Sprint, etc.) : sans ça, chaque
      // changement d'état (cf. setBaseAnimation) fait sauter la pose d'une frame à
      // l'autre de façon abrupte/saccadée plutôt que de transitionner en douceur.
      ag.targetedAnimations.forEach(ta => {
        ta.animation.enableBlending = true;
        ta.animation.blendingSpeed = 0.12;
      });
      animationGroups[ag.name] = ag;
    });
    // ─── Choix du clip de repos (Idle) ───────────────────────────────────
    // Bug/reproche corrigé : tous les joueurs (coéquipiers ET adversaires) sans ballon
    // jouaient EXACTEMENT le même clip 'Idle', démarré au même instant (frame 0) pour
    // tout le monde à la création de l'équipe — en boucle, ça les fait rester en phase
    // indéfiniment, un effet de "ballet"/chorégraphie synchronisée plutôt que 22
    // individus indépendants. Deux correctifs : (1) une variante 'IdleOffensive' (posture
    // plus avancée, cf. footBall/mixamo/Offensive Idle.fbx fusionnée dans player.glb) est
    // assignée aléatoirement, pondérée par rôle (plus fréquente en attaque/milieu qu'en
    // défense — un gardien reste toujours sur GK_Idle, jamais concerné) ; (2) la lecture de
    // CHAQUE clip de repos démarre sur une frame aléatoire de son cycle (`goToFrame`) pour
    // désynchroniser sa phase, même entre deux joueurs qui partagent la même variante.
    const offensiveIdleWeight = isKeeper ? 0 : config.role === 'fwd' ? 0.6 : config.role === 'mid' ? 0.35 : 0.15;
    const useOffensiveIdle = !isKeeper && !!animationGroups['IdleOffensive'] && Math.random() < offensiveIdleWeight;
    const initialAnim = isKeeper ? 'GK_Idle' : useOffensiveIdle ? 'IdleOffensive' : 'Idle';
    const initialGroup = animationGroups[initialAnim];
    if (initialGroup) {
      initialGroup.start(true, 1.0);
      const span = initialGroup.to - initialGroup.from;
      if (span > 0) {
        initialGroup.goToFrame(initialGroup.from + Math.random() * span);
      }
    }

    // ─── Marqueur de capitaine ──────────────────────────────────────────
    // Étoile dorée flottant au-dessus de la tête plutôt qu'un brassard (qui
    // demanderait un attachement précis à l'os du bras) — aussi lisible depuis
    // la caméra tactique éloignée.
    if (config.isCaptain) {
      const capMat = new BABYLON.StandardMaterial('captainMat_' + index, this.scene);
      capMat.diffuseColor = new BABYLON.Color3(1, 0.82, 0);
      capMat.emissiveColor = new BABYLON.Color3(0.7, 0.55, 0);
      capMat.specularColor = new BABYLON.Color3(0, 0, 0);
      const capMarker = BABYLON.MeshBuilder.CreatePolyhedron('captainMarker_' + index, { type: 1, size: 0.08 }, this.scene);
      capMarker.position = new BABYLON.Vector3(0, LEGACY_LOCAL_HEIGHT + 0.18, 0);
      capMarker.material = capMat;
      capMarker.parent = pivot;
      capMarker.isPickable = false;
    }

    // ─── Anneau du porteur du ballon (masqué par défaut) ────────────────
    // CreateTorus est déjà à plat par défaut (plan XZ) : aucune rotation à
    // appliquer pour qu'il repose bien à plat au sol (piège rencontré et corrigé
    // plusieurs fois ailleurs dans ce module sur d'autres tores).
    const ringMat = new BABYLON.StandardMaterial('ballCarrierRingMat_' + index, this.scene);
    ringMat.diffuseColor = new BABYLON.Color3(1, 0.85, 0);
    ringMat.emissiveColor = new BABYLON.Color3(1, 0.85, 0);
    ringMat.specularColor = new BABYLON.Color3(0, 0, 0);
    ringMat.disableLighting = true;
    ringMat.backFaceCulling = false;

    // Agrandi et épaissi par rapport au premier essai (0,7m/0,06m) : à peine
    // perceptible depuis la caméra de jeu par défaut (bien plus haute/éloignée
    // que la caméra rapprochée utilisée pour la première vérification), surtout
    // pour un contact qui ne dure parfois qu'une fraction de seconde.
    const ballCarrierRing = BABYLON.MeshBuilder.CreateTorus('ballCarrierRing_' + index, {
      diameter: 1.15,
      thickness: 0.16,
      tessellation: 28,
    }, this.scene);
    ballCarrierRing.position = new BABYLON.Vector3(0, 0.04, 0);
    ballCarrierRing.material = ringMat;
    ballCarrierRing.parent = pivot;
    ballCarrierRing.isPickable = false;
    ballCarrierRing.isVisible = false;

    // ─── Marqueur "cible de passe sélectionnée" (masqué par défaut) ─────
    // Cône bleu flottant au-dessus de la tête, distinct de l'anneau jaune du
    // porteur du ballon (aux pieds) — indique quel coéquipier est actuellement
    // choisi comme destinataire d'une passe manuelle : en possession du
    // ballon, L1 fait défiler les coéquipiers proches au lieu de changer de
    // joueur contrôlé (cf. football.component.ts, cyclePassTarget()), pour
    // permettre une vraie construction du jeu (choisir À QUI on passe, pas
    // juste une passe automatique vers la "meilleure" cible calculée).
    const targetMat = new BABYLON.StandardMaterial('passTargetMat_' + index, this.scene);
    targetMat.diffuseColor = new BABYLON.Color3(0.15, 0.65, 1);
    targetMat.emissiveColor = new BABYLON.Color3(0.15, 0.65, 1);
    targetMat.specularColor = new BABYLON.Color3(0, 0, 0);
    targetMat.disableLighting = true;
    const passTargetMarker = BABYLON.MeshBuilder.CreateCylinder('passTargetMarker_' + index, {
      height: 0.3,
      diameterTop: 0,
      diameterBottom: 0.35,
      tessellation: 4,
    }, this.scene);
    passTargetMarker.position = new BABYLON.Vector3(0, LEGACY_LOCAL_HEIGHT + 0.55, 0);
    passTargetMarker.rotation.x = Math.PI; // pointe vers le bas, vers la tête du joueur ciblé
    passTargetMarker.material = targetMat;
    passTargetMarker.parent = pivot;
    passTargetMarker.isPickable = false;
    passTargetMarker.isVisible = false;

    // Grossit tout l'assemblage visuel (modèle/anneau/marqueur) d'un coup, sans
    // recalculer chaque position relative à la main. MODEL_SCALE_RATIO fait
    // correspondre la taille apparente du modèle réaliste à celle de l'ancien
    // personnage procédural pour les mêmes réglages `playerScale` (cf. plus haut).
    const initialScale = this.playerScale * this.liveScaleMultiplier * MODEL_SCALE_RATIO;
    pivot.scaling = new BABYLON.Vector3(initialScale, initialScale, initialScale);

    // ─── Corps physique (capsule) — dimensionné pour suivre le mesh agrandi ──
    // Inchangé (ne dépend PAS de MODEL_SCALE_RATIO) : la physique était déjà
    // calibrée sur l'ancienne taille apparente, qu'on reproduit à l'identique.
    const halfHeight = 0.9 * this.playerScale;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(config.initialX, halfHeight, config.initialZ)
      .setLinearDamping(4.0)
      .setAngularDamping(6.0);
    // @ts-ignore - Rapier v0.19 compat
    bodyDesc.lockRotations(true, true, true);

    const bodyRb = this.world.createRigidBody(bodyDesc);
    // Élargi (0.2/0.15 -> 0.3/0.24) : avec le vrai modèle 3D (bien plus large visuellement
    // qu'une boîte fine), l'ancien collider laissait les silhouettes se chevaucher
    // visiblement avant que la physique ne les sépare ("un joueur peut traverser l'autre
    // sans heurt").
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.3 * this.playerScale, halfHeight, 0.24 * this.playerScale)
      .setFriction(0.5)
      .setRestitution(0.15);
    this.world.createCollider(colliderDesc, bodyRb);

    // ─── Instance du joueur ────────────────────────────────────────────
    const playerInstance: PlayerInstance = {
      config,
      mesh: pivot as unknown as BABYLON.Mesh,
      body: bodyRb,
      targetPosition: new BABYLON.Vector3(config.initialX, 0, config.initialZ),
      currentVelocity: BABYLON.Vector3.Zero(),
      isSprinting: false,
      isTackling: false,
      tackleCooldown: 0,
      hasBall: false,
      ballControlled: false,
      ballCarrierRing,
      passTargetMarker,
      ringLingerTimer: 0,
      ballActionCooldown: 0,
      legPivots,
      armPivots,
      animationGroups,
      currentAnimName: initialAnim,
      idleAnimName: initialAnim,
      oneShotTimer: 0,
      yellowCards: 0,
      isSentOff: false,
      isInjured: false,
    };

    return playerInstance;
  }

  /**
   * Joue un clip en boucle comme état de base (Idle/Run/Sprint/GK_Idle...). Ignoré tant
   * qu'un one-shot (tacle/passe/tir/...) est en cours (`oneShotTimer > 0`).
   */
  private setBaseAnimation(player: PlayerInstance, name: string): void {
    if (player.oneShotTimer > 0 || player.currentAnimName === name) return;
    const next = player.animationGroups[name];
    if (!next) return;
    player.animationGroups[player.currentAnimName]?.stop();
    next.start(true, 1.0);
    player.currentAnimName = name;
  }

  /**
   * Joue un clip une seule fois (tacle/passe/tir/chip/tête/plongeon gardien...), à
   * l'initiative de l'appelant (football.component.ts, aux points de décision
   * tir/passe/tacle déjà existants). Le state-machine de base (Idle/Run/Sprint) ne
   * reprend la main qu'à la fin du clip (`onAnimationGroupEndObservable`), pas sur une
   * durée estimée à l'avance (évite toute hypothèse sur le fps d'export du clip).
   */
  playOneShot(player: PlayerInstance, name: string): void {
    const clip = player.animationGroups[name];
    if (!clip) return;
    player.animationGroups[player.currentAnimName]?.stop();
    clip.stop();
    player.oneShotTimer = 1; // > 0 tant que le clip n'est pas terminé (remis à 0 par le callback)
    clip.start(false, 1.0);
    player.currentAnimName = name;
    clip.onAnimationGroupEndObservable.addOnce(() => {
      player.oneShotTimer = 0;
    });
  }

  /**
   * Force un clip en boucle immédiatement (contournement délibéré du garde-fou
   * `oneShotTimer`/`currentAnimName` de `setBaseAnimation`) : utilisé pour la
   * célébration de but des équipiers du buteur (`IdleHappy`), pendant que
   * `syncPositions()` est en pause (cf. `isGoalScored`, football.component.ts) — le
   * state-machine Idle/Run habituel ne tourne donc plus pour reprendre la main tout
   * seul, contrairement aux one-shots classiques (tacle/passe/tir) joués en cours de
   * jeu. `syncPositions()` reprendra normalement au coup d'envoi suivant et arrêtera
   * ce clip comme n'importe quel changement d'état de base.
   */
  playCelebrationLoop(player: PlayerInstance, name: string = 'IdleHappy'): void {
    const clip = player.animationGroups[name];
    if (!clip || player.currentAnimName === name) return;
    player.animationGroups[player.currentAnimName]?.stop();
    clip.start(true, 1.0);
    player.currentAnimName = name;
  }

  /**
   * Synchronise les positions physiques avec les meshes, et choisit le clip d'animation
   * de base (Idle/Run/Sprint/GK_Idle) selon la vitesse — remplace l'ancien balancement
   * procédural des jambes/bras par les vraies animations Mixamo importées.
   */
  syncPositions(deltaTime: number, ballPos?: BABYLON.Vector3): void {
    this.players.forEach(player => {
      if (player.isSentOff) return;

      const pos = player.body.translation();
      player.mesh.position.set(pos.x, pos.y - 0.9 * this.playerScale, pos.z);

      const vel = player.body.linvel();
      const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

      // Bug corrigé (gardien mal orienté / "tourne le dos au terrain") : un gardien ne
      // se déplace quasiment qu'EN LATÉRAL le long de sa ligne de but (cf.
      // AIService.updateGoalkeeper) — la rotation basée sur la vélocité (comme pour les
      // joueurs de champ, ci-dessous) le faisait donc regarder vers la ligne de touche,
      // pas vers le terrain. Pire : à l'arrêt (vitesse ~0, la majorité du temps), la
      // rotation reste figée à son DERNIER angle de déplacement, qui peut être
      // n'importe quoi. Un gardien doit toujours faire face au ballon (LookAt
      // dynamique), qu'il soit en mouvement ou immobile.
      if (player.config.role === 'gk' && ballPos) {
        const dx = ballPos.x - pos.x;
        const dz = ballPos.z - pos.z;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
          player.mesh.rotation = new BABYLON.Vector3(0, Math.atan2(dx, dz), 0);
        }
      } else if (speed > 0.1) {
        // Faire tourner le joueur vers sa direction de mouvement
        const angle = Math.atan2(vel.x, vel.z);
        player.mesh.rotation = new BABYLON.Vector3(0, angle, 0);
      }

      if (player.oneShotTimer > 0) return; // un tacle/passe/tir est en cours : ne pas interrompre

      // Seuil "Sprint" relevé (5.5 -> 8.2) : à 5.5 m/s, un simple jogging normal
      // (SPEED=7 m/s) déclenchait déjà la pose de sprint quasi tout le temps — réservée
      // maintenant aux vitesses proches du sprint réel (SPRINT_SPEED=10 m/s).
      //
      // Hystérésis (bug corrigé : mouvement "saccadé" signalé) : la vitesse physique
      // instantanée oscille facilement autour d'une frontière unique (freinage, léger
      // changement de direction, à-coup de collision) — sans marge, ça fait
      // rebasculer l'état plusieurs fois par seconde, et CHAQUE bascule relance le
      // fondu enchaîné (`blendingSpeed`) en cours de route, perçu comme un à-coup.
      // Le seuil de SORTIE d'un état est maintenant plus bas que son seuil d'ENTRÉE.
      let desired: string;
      if (player.currentAnimName === 'Sprint') {
        desired = speed > 7.0 ? 'Sprint' : speed > 0.3 ? 'Run' : player.idleAnimName;
      } else if (player.currentAnimName === 'Run') {
        desired = speed > 8.2 ? 'Sprint' : speed > 0.3 ? 'Run' : player.idleAnimName;
      } else {
        desired = speed > 8.2 ? 'Sprint' : speed > 0.5 ? 'Run' : player.idleAnimName;
      }
      this.setBaseAnimation(player, desired);

      // Calage du rythme d'animation sur la vitesse physique réelle (bug corrigé :
      // le clip jouait toujours à son rythme d'origine, speedRatio 1.0, même pendant
      // la rampe d'accélération/décélération de `movePlayer` — lissage exponentiel,
      // donc PAS instantané — ce qui faisait "glisser" les pieds par rapport au
      // déplacement réel du corps pendant ces transitions). Sans effet sur Idle/GK_Idle
      // (le joueur ne se déplace pas, rien à synchroniser).
      const activeClip = player.animationGroups[player.currentAnimName];
      if (activeClip && (player.currentAnimName === 'Run' || player.currentAnimName === 'Sprint')) {
        const refSpeed = player.currentAnimName === 'Sprint'
          ? FOOTBALL_CONFIG.PLAYER.SPRINT_SPEED
          : FOOTBALL_CONFIG.PLAYER.SPEED;
        activeClip.speedRatio = Math.min(1.4, Math.max(0.6, speed / refSpeed));
      }
    });
  }

  /**
   * Déplace un joueur vers une position cible
   */
  movePlayer(player: PlayerInstance, direction: BABYLON.Vector3, sprint: boolean, deltaTime: number): void {
    if (player.isSentOff || player.isInjured) return;

    const speed = (sprint ? FOOTBALL_CONFIG.PLAYER.SPRINT_SPEED : FOOTBALL_CONFIG.PLAYER.SPEED) * this.weatherSpeedFactor;
    const accel = FOOTBALL_CONFIG.PLAYER.ACCELERATION * this.weatherAccelFactor;

    // Normaliser la direction
    if (direction.length() > 0) {
      direction.normalize();
    }

    // Appliquer la vélocité
    const currentVel = player.body.linvel();
    const targetVel = new RAPIER.Vector3(
      direction.x * speed,
      currentVel.y,
      direction.z * speed
    );

    // Lissage indépendant du framerate (Bug corrigé : l'ancien facteur `0.1 * accel`
    // était fixe PAR APPEL, pas par seconde — à ~8 d'accélération ça blendait ~80% de
    // l'écart vers la cible en un seul appel, un quasi-instantané qui donnait un
    // mouvement saccadé/robotique et dont le "ressenti" variait avec le framerate (plus
    // d'appels/seconde à fps élevé = convergence réelle plus rapide en temps absolu).
    // `1 - e^(-accel*dt)` converge à la même vitesse RÉELLE quel que soit le framerate.
    const factor = 1 - Math.exp(-accel * deltaTime);
    player.body.setLinvel(
      new RAPIER.Vector3(
        currentVel.x + (targetVel.x - currentVel.x) * factor,
        currentVel.y,
        currentVel.z + (targetVel.z - currentVel.z) * factor
      ),
      true
    );

    player.isSprinting = sprint;

    // Gestion de l'endurance
    if (sprint) {
      player.config.stamina = Math.max(0, player.config.stamina - FOOTBALL_CONFIG.PLAYER.STAMINA_DRAIN_SPRINT * 0.016);
    } else {
      player.config.stamina = Math.min(
        player.config.maxStamina,
        player.config.stamina + FOOTBALL_CONFIG.PLAYER.STAMINA_RECOVER * 0.016
      );
    }
  }

  /**
   * Arrête un joueur
   */
  stopPlayer(player: PlayerInstance): void {
    const vel = player.body.linvel();
    player.body.setLinvel(new RAPIER.Vector3(vel.x * 0.85, vel.y, vel.z * 0.85), true);
    player.isSprinting = false;
  }

  /**
   * Récupère tous les joueurs
   */
  getAllPlayers(): PlayerInstance[] {
    return this.players;
  }

  /**
   * Récupère les joueurs d'une équipe
   */
  getTeamPlayers(teamId: 'home' | 'away'): PlayerInstance[] {
    return this.players.filter(p => p.config.teamId === teamId);
  }

  /**
   * Récupère le joueur le plus proche du ballon pour une équipe
   */
  getClosestToBall(teamId: 'home' | 'away', ballPos: BABYLON.Vector3): PlayerInstance | null {
    let closest: PlayerInstance | null = null;
    let minDist = Infinity;

    // Le gardien n'est jamais un candidat au changement de joueur contrôlé (touche Q /
    // reprise automatique) : sans cette exclusion, dès que le ballon traîne près de sa
    // propre surface, le joueur humain pouvait se retrouver à contrôler le gardien sans
    // le savoir — l'IA du gardien (updateGoalkeeper) est alors coupée pour ce joueur
    // (comme pour tout joueur contrôlé), qui reste immobile dans ses cages, ignorant le
    // ballon, jusqu'à ce qu'un tir arrive sans personne pour le garder.
    this.getTeamPlayers(teamId).forEach(player => {
      if (player.isSentOff || player.config.role === 'gk') return;
      const pos = player.body.translation();
      const dx = pos.x - ballPos.x;
      const dz = pos.z - ballPos.z;
      const dist = dx * dx + dz * dz;
      if (dist < minDist) {
        minDist = dist;
        closest = player;
      }
    });

    return closest;
  }

  /**
   * Retire UN joueur individuel (mesh + corps physique) — utilisé par les ateliers du
   * Tutoriel pour isoler l'acteur pertinent (ex: uniquement tireur+gardien pour un
   * penalty) sans passer par dispose() qui nettoie tout le monde.
   *
   * Bug corrigé : le retirer "à la main" depuis football.component.ts (mesh.dispose()
   * + world.removeRigidBody() en direct, en le laissant dans le tableau interne
   * `players`) faisait planter tout le moteur physique — syncPositions(), appelée
   * chaque frame, itère CE tableau interne (pas gameState.homePlayers) et appelait
   * `body.translation()` sur un corps déjà retiré du monde Rapier : le WASM lève un
   * trap "unreachable" (panic Rust côté binding), qui n'étant pas rattrapé arrête net
   * toute la boucle de rendu à la frame suivante — d'où des joueurs "encore visibles"
   * qui ne sont en réalité que la dernière frame rendue avant le crash silencieux.
   * Ce point d'entrée unique retire aussi le joueur de `players` pour empêcher ça.
   */
  disposePlayer(player: PlayerInstance): void {
    Object.values(player.animationGroups).forEach(ag => ag.dispose());
    player.mesh.dispose();
    this.world.removeRigidBody(player.body);
    this.players = this.players.filter(p => p !== player);
  }

  /**
   * Nettoie tous les joueurs
   */
  dispose(): void {
    this.players.forEach(player => {
      Object.values(player.animationGroups).forEach(ag => ag.dispose());
      player.mesh.dispose(); // dispose récursivement le modèle/anneau/marqueur cloné (enfants du pivot)
      this.world.removeRigidBody(player.body);
    });
    this.players = [];
    this.jerseyDiffuseTexture?.dispose();
    this.jerseyBumpTexture?.dispose();
    this.jerseyDiffuseTexture = null;
    this.jerseyBumpTexture = null;
    this.playerContainer?.dispose();
    this.playerContainer = null;
  }

  /**
   * Génère un nom de joueur aléatoire
   */
  private generatePlayerName(index: number, teamId: string): string {
    const firstNames = ['Lucas', 'Hugo', 'Léo', 'Raphaël', 'Jules', 'Adam', 'Louis', 'Gabriel', 'Arthur', 'Noah',
      'Ethan', 'Tom', 'Maxime', 'Mathis', 'Paul', 'Nathan', 'Enzo', 'Malo', 'Théo', 'Nino',
      'Sacha', 'Alex', 'Yanis', 'Bastien', 'Côme', 'Diego', 'Eliott', 'Félix', 'Gabin', 'Ilyan'];
    const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Ferreira',
      'Rodriguez', 'Martinez', 'Garcia', 'Lopez', 'Fernandez', 'Gonzalez', 'Sanchez',
      'Diallo', 'Traoré', 'Koné', 'Cissé', 'Ndiaye'];

    const fn = firstNames[(index * 7 + firstNames.length) % firstNames.length];
    const ln = lastNames[(index * 13 + lastNames.length) % lastNames.length];
    return fn + ' ' + ln;
  }
}
