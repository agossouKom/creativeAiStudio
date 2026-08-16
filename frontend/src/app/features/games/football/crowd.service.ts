import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF'; // enregistre le loader .gltf/.glb auprès de SceneLoader
import { FOOTBALL_CONFIG } from './football.config';
import { TeamConfig } from './football.types';
import { CrowdMood } from './audio.service';

/** Modèles Mixamo réels (fusion FBX→glTF de plusieurs clips, cf. PLAN.md) — voir
 * src/assets/football/CREDITS.md pour la provenance. */
const SUPPORTER_MODEL_PATH = 'assets/football/supporters/';

/**
 * Un peu moins exagérés que les joueurs (playerScale~2 × MODEL_SCALE_RATIO, cf.
 * player.service.ts) mais toujours au-dessus de l'échelle réaliste : les supporters
 * sont statiques et vus de loin depuis la caméra de match, une taille réaliste (~1,75m)
 * les rendrait quasi invisibles/plats à cette distance.
 */
const SUPPORTER_SCALE = 1.6;

/** Juste derrière les panneaux publicitaires (posés à halfL/halfW + 2, cf.
 * createAdBoardRing() dans stadium.service.ts) pour ne jamais les traverser. */
const FRONT_ROW_OFFSET = 3.5;

interface SupporterCharacterDef {
  file: string;
  /** Nom du mesh maillot/haut à recolorer aux couleurs de l'équipe supportée */
  shirtMeshName: string;
  baseAnim: string;
  /** Clips utilisés en ambiance normale (assis/applaudissements ponctuels) */
  calmAnims: string[];
  /** Clips utilisés en ambiance intense (célébration d'un but, foule hostile/festive) */
  hypeAnims: string[];
}

/** Cf. footBall/supporters/ + PLAN.md pour le détail du pipeline (2 personnages Mixamo,
 * squelettes "mixamorig6:"/"mixamorig:", clips fusionnés dans 2 .glb distincts). */
const CHARACTERS: SupporterCharacterDef[] = [
  {
    file: 'supporter_a.glb',
    shirtMeshName: 'Ch37_Shirt',
    baseAnim: 'Idle',
    calmAnims: ['Idle', 'Clapping'],
    hypeAnims: ['Cheering', 'Clapping'],
  },
  {
    file: 'supporter_b.glb',
    shirtMeshName: 'Tops',
    baseAnim: 'StandingClap',
    calmAnims: ['StandingClap', 'Clapping'],
    hypeAnims: ['ClappingAlt', 'DismissingGesture', 'Clapping'],
  },
];

interface SupporterInstance {
  root: BABYLON.TransformNode;
  animationGroups: Record<string, BABYLON.AnimationGroup>;
  currentAnim: string;
  charIndex: number;
  side: 'home' | 'away';
  switchTimer: number;
  /** Probabilité (0..1) de tirer un clip "hype" plutôt que "calme" au prochain changement */
  energy: number;
}

/**
 * Supporters 3D animés au premier rang des tribunes. Le reste de la foule reste la
 * texture 2D existante (StadiumService.createCrowdTexture) — periomètre limité à ~40-80
 * personnages (choix validé avec l'utilisateur) pour rester dans un budget de
 * performance raisonnable à côté des 22 joueurs déjà animés individuellement.
 *
 * Placement volontairement indépendant de la forme exacte du stade (rect/oval/round/
 * hex/...) : toutes les formes dégagent au moins jusqu'à halfL/halfW + 2 (c'est
 * exactement la position des panneaux publicitaires, cf. createAdBoardRing), donc un
 * anneau fixe à halfL/halfW + FRONT_ROW_OFFSET reste toujours hors pelouse quelle que
 * soit la forme choisie.
 */
export class CrowdService {
  private scene: BABYLON.Scene;
  private containers: (BABYLON.AssetContainer | null)[] = [null, null];
  private instances: SupporterInstance[] = [];
  private celebrateSide: 'home' | 'away' | null = null;
  private celebrateTimer = 0;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
  }

  /** Charge les 2 modèles (une seule fois par match) — à attendre avant `spawn()`. */
  async preload(): Promise<void> {
    if (this.containers[0] && this.containers[1]) return;
    this.containers = await Promise.all(
      CHARACTERS.map(c => BABYLON.SceneLoader.LoadAssetContainerAsync(SUPPORTER_MODEL_PATH, c.file, this.scene))
    );
  }

  /**
   * Peuple les rangées avant pour CE match : couleurs de maillot par équipe, et taille/
   * intensité de chaque section dépendant des deux équipes en présence, de l'ambiance
   * choisie et du taux de remplissage du stade (même `fillRatio` que
   * `AudioService.startCrowdAmbiance`, pour rester cohérent avec l'ambiance sonore).
   */
  spawn(homeTeam: TeamConfig, awayTeam: TeamConfig, mood: CrowdMood, fillRatio: number): void {
    this.clear();
    if (!this.containers[0] || !this.containers[1]) return;

    const ratio = Math.max(0.3, Math.min(1, fillRatio));
    const total = 40 + Math.round(40 * ratio); // 40..80, cf. choix validé avec l'utilisateur
    const homeCount = Math.round(total * 0.75); // la tribune domicile domine toujours en nombre
    const awayCount = total - homeCount;

    const moodEnergy = mood === 'calme' ? 0.15 : mood === 'festif' ? 0.55 : mood === 'hostile' ? 0.6 : 0.35;
    const homeEnergy = Math.min(0.9, moodEnergy + 0.25);
    const awayEnergy = Math.max(0.1, moodEnergy - 0.15);

    this.spawnSection('home', homeCount, homeTeam.colors.primary, homeEnergy);
    this.spawnSection('away', awayCount, awayTeam.colors.primary, awayEnergy);
  }

  /**
   * Appelée à chaque frame (cf. football.component.ts `updateGame()`) : fait varier les
   * clips joués par chaque supporter à intervalle aléatoire, pour une foule vivante
   * plutôt qu'un unique mouvement de groupe synchronisé.
   */
  update(deltaTime: number): void {
    if (this.celebrateTimer > 0) {
      this.celebrateTimer -= deltaTime;
      if (this.celebrateTimer <= 0) this.celebrateSide = null;
    }
    this.instances.forEach(inst => {
      inst.switchTimer -= deltaTime;
      if (inst.switchTimer > 0) return;
      inst.switchTimer = 2.5 + Math.random() * 4;

      const def = CHARACTERS[inst.charIndex];
      const energy = this.celebrateSide === inst.side ? 1 : inst.energy;
      const pool = Math.random() < energy ? def.hypeAnims : def.calmAnims;
      this.crossfade(inst, pool[Math.floor(Math.random() * pool.length)]);
    });
  }

  /**
   * Vague de célébration côté équipe qui vient de marquer : bascule aussitôt une partie
   * des clips sur les animations "hype" (au lieu d'attendre le tirage aléatoire normal
   * de chacun, sinon la réaction arriverait étalée sur plusieurs secondes après le but).
   */
  celebrate(side: 'home' | 'away', durationSec = 4): void {
    this.celebrateSide = side;
    this.celebrateTimer = durationSec;
    this.instances.filter(i => i.side === side).forEach(inst => {
      const def = CHARACTERS[inst.charIndex];
      const name = def.hypeAnims[Math.floor(Math.random() * def.hypeAnims.length)];
      this.crossfade(inst, name);
      inst.switchTimer = durationSec * 0.5 + Math.random() * durationSec * 0.5;
    });
  }

  private spawnSection(
    side: 'home' | 'away',
    count: number,
    color: { r: number; g: number; b: number },
    energy: number
  ): void {
    this.sectionPositions(side, count).forEach((pos, i) => {
      const charIndex = i % CHARACTERS.length;
      this.instances.push(this.spawnOne(side, charIndex, pos, color, energy));
    });
  }

  /**
   * Domicile : réparti sur les deux lignes de touche (tribunes principales, où se
   * concentre la majorité d'un vrai stade). Extérieur : une section unique derrière un
   * but fixe du stade (bout "visiteurs" classique), en nombre plus restreint.
   */
  private sectionPositions(side: 'home' | 'away', count: number): { x: number; z: number; rotY: number }[] {
    const { LENGTH, WIDTH, BORDER_MARGIN } = FOOTBALL_CONFIG.FIELD;
    const halfL = LENGTH / 2 + BORDER_MARGIN;
    const halfW = WIDTH / 2 + BORDER_MARGIN;
    const positions: { x: number; z: number; rotY: number }[] = [];

    if (side === 'home') {
      const perSide = Math.ceil(count / 2);
      const spanZ = LENGTH * 0.42; // marge près des corners/buts, pas de supporter juste dans l'axe des cages
      for (const xSign of [-1, 1] as const) {
        if (positions.length >= count) break;
        // rotY choisi selon la convention des joueurs (angle = atan2(vel.x, vel.z),
        // donc rotY=0 fait face à +Z, rotY=±90° fait face à ∓X) pour que chaque
        // supporter regarde vers le terrain plutôt que vers l'extérieur du stade.
        const rotY = xSign > 0 ? -Math.PI / 2 : Math.PI / 2;
        const n = Math.min(perSide, count - positions.length);
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          const z = -spanZ + t * spanZ * 2 + (Math.random() - 0.5) * 1.2;
          const x = xSign * (halfW + FRONT_ROW_OFFSET + Math.random() * 1.5);
          positions.push({ x, z, rotY });
        }
      }
    } else {
      const spanX = WIDTH * 0.32;
      const rotY = Math.PI; // face vers -Z (bout situé en Z positif)
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0.5 : i / (count - 1);
        const x = -spanX + t * spanX * 2 + (Math.random() - 0.5) * 1.2;
        const z = halfL + FRONT_ROW_OFFSET + Math.random() * 1.5;
        positions.push({ x, z, rotY });
      }
    }
    return positions;
  }

  private spawnOne(
    side: 'home' | 'away',
    charIndex: number,
    pos: { x: number; z: number; rotY: number },
    color: { r: number; g: number; b: number },
    energy: number
  ): SupporterInstance {
    const def = CHARACTERS[charIndex];
    const container = this.containers[charIndex]!;
    // doNotInstantiate:true force un vrai clonage (mesh+squelette+animations propres),
    // même technique que PlayerService.createPlayer.
    const entries = container.instantiateModelsToScene((n) => n, false, { doNotInstantiate: true });
    const modelRoot = entries.rootNodes[0];

    const root = new BABYLON.TransformNode('supporter_' + side + '_' + this.instances.length, this.scene);
    root.position = new BABYLON.Vector3(pos.x, 0, pos.z);
    root.rotation.y = pos.rotY;
    root.scaling = new BABYLON.Vector3(SUPPORTER_SCALE, SUPPORTER_SCALE, SUPPORTER_SCALE);
    modelRoot.parent = root;
    modelRoot.position.set(0, 0, 0);

    const shirtMesh = modelRoot.getChildMeshes().find(m => m.name === def.shirtMeshName);
    if (shirtMesh) {
      const mat = new BABYLON.StandardMaterial('supporterShirtMat_' + side + '_' + this.instances.length, this.scene);
      mat.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
      mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
      shirtMesh.material = mat;
    }

    const animationGroups: Record<string, BABYLON.AnimationGroup> = {};
    entries.animationGroups.forEach(ag => {
      ag.stop();
      ag.targetedAnimations.forEach(ta => {
        ta.animation.enableBlending = true;
        ta.animation.blendingSpeed = 0.1;
      });
      animationGroups[ag.name] = ag;
    });

    // Déphasage aléatoire du point de départ : sans ça, toutes les instances du même
    // personnage démarrent la boucle bras dessus bras dessous, "au garde-à-vous" à
    // l'unisson — peu crédible pour une foule.
    const base = animationGroups[def.baseAnim];
    if (base) {
      base.start(true, 1.0);
      base.goToFrame(Math.random() * base.to);
    }

    return {
      root,
      animationGroups,
      currentAnim: def.baseAnim,
      charIndex,
      side,
      switchTimer: 2 + Math.random() * 4,
      energy,
    };
  }

  private crossfade(inst: SupporterInstance, name: string): void {
    if (inst.currentAnim === name || !inst.animationGroups[name]) return;
    const next = inst.animationGroups[name];
    inst.animationGroups[inst.currentAnim]?.stop();
    next.start(true, 1.0);
    next.goToFrame(Math.random() * next.to);
    inst.currentAnim = name;
  }

  private clear(): void {
    this.instances.forEach(inst => {
      Object.values(inst.animationGroups).forEach(ag => ag.dispose());
      inst.root.dispose();
    });
    this.instances = [];
    this.celebrateSide = null;
    this.celebrateTimer = 0;
  }

  dispose(): void {
    this.clear();
    this.containers.forEach(c => c?.dispose());
    this.containers = [null, null];
  }
}
