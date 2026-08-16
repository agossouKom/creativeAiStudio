import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders/glTF'; // enregistre le loader .gltf/.glb auprès de SceneLoader
import * as RAPIER from '@dimforge/rapier3d-compat';
import { FOOTBALL_CONFIG } from './football.config';
import { BallInstance } from './football.types';

/** Modèle 3D réel (CC0, Poly Haven — voir src/assets/football/CREDITS.md) */
const BALL_MODEL_PATH = 'assets/football/ball/';
const BALL_MODEL_FILE = 'football.gltf';

/**
 * Service de gestion du ballon
 * Physique, trajectoires, rebonds, effets
 */
export class BallService {
  /**
   * Bug corrigé (ballon encore signalé trop gros après un premier ajustement 2.2→1.6) :
   * `FOOTBALL_CONFIG.BALL.DIAMETER` (0,45 m) est LUI-MÊME déjà environ le double d'un
   * vrai ballon taille 5 (≈0,22 m) — un choix de gameplay/collision antérieur à ce
   * correctif, pas la vraie taille FIFA malgré le commentaire d'origine. Appliquer EN
   * PLUS un multiplicateur > 1 (1.6, ou 2.2 avant) empilait deux grossissements et
   * donnait un ballon nettement surdimensionné, surtout à côté du modèle de joueur
   * réaliste (Mixamo). Ramené à un facteur < 1 : le rendu visuel est donc un peu plus
   * PETIT que le diamètre de collision (0,45 m) — sans effet perceptible sur le
   * gameplay (le collider physique, invisible, reste inchangé), mais un ballon qui a
   * enfin l'air normal à l'écran.
   */
  private readonly BALL_VISUAL_SCALE = 0.85;

  private scene: BABYLON.Scene;
  private world: RAPIER.World;
  private ball: BallInstance | null = null;
  private trailMeshes: BABYLON.Mesh[] = [];
  private trailTimer = 0;
  private trailEnabled = true;
  private trailMaterial: BABYLON.StandardMaterial | null = null;
  /** Vrai après le changement de camp à la mi-temps : inverse quelle équipe défend quel côté */
  private sideSwapped = false;

  setSideSwapped(swapped: boolean): void {
    this.sideSwapped = swapped;
  }

  /** Active/désactive la traînée visuelle du ballon (trajectoire sur tir/passe), togglable en jeu */
  setTrailEnabled(enabled: boolean): void {
    this.trailEnabled = enabled;
    if (!enabled) {
      this.trailMeshes.forEach(m => m.dispose());
      this.trailMeshes = [];
    }
  }

  constructor(scene: BABYLON.Scene, world: RAPIER.World) {
    this.scene = scene;
    this.world = world;
  }

  /**
   * Crée le ballon au centre du terrain
   * @param accentColorHex couleur des pentagones, dépend du ballon choisi en configuration
   * @param weatherFactors friction/rebond modifiés par la météo choisie en configuration (pluie/neige)
   */
  create(accentColorHex: string = '#222222', weatherFactors: { frictionFactor: number; restitutionFactor: number } = { frictionFactor: 1, restitutionFactor: 1 }): BallInstance {
    if (this.ball) {
      this.dispose();
    }

    const mesh = BABYLON.MeshBuilder.CreateSphere('ball', {
      diameter: FOOTBALL_CONFIG.BALL.DIAMETER,
      segments: 16
    }, this.scene);

    // Matériau du ballon — blanc uni (demande explicite : "mets la couleur du ballon en
    // blanc"), plus de motif pentagones : accentColorHex n'est donc plus utilisé ici,
    // conservé en paramètre pour ne pas casser les appelants existants.
    const ballMat = new BABYLON.StandardMaterial('ballMat', this.scene);
    ballMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    ballMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    ballMat.specularPower = 20;

    mesh.material = ballMat;
    mesh.scaling.setAll(this.BALL_VISUAL_SCALE);

    // Corps physique
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, FOOTBALL_CONFIG.BALL.DIAMETER / 2, 0)
      .setLinearDamping(FOOTBALL_CONFIG.BALL.LINEAR_DAMPING)
      .setAngularDamping(FOOTBALL_CONFIG.BALL.ANGULAR_DAMPING);

    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.ball(FOOTBALL_CONFIG.BALL.DIAMETER / 2)
      .setFriction(FOOTBALL_CONFIG.BALL.FRICTION * weatherFactors.frictionFactor)
      .setRestitution(FOOTBALL_CONFIG.BALL.RESTITUTION * weatherFactors.restitutionFactor);
    this.world.createCollider(colliderDesc, body);

    this.ball = {
      mesh,
      body,
      lastTouch: null,
      isInPlay: true,
      spin: BABYLON.Vector3.Zero(),
    };

    // Charge le vrai modèle 3D en arrière-plan (asynchrone, sans bloquer le
    // coup d'envoi) puis remplace le mesh procédural par le modèle réel une
    // fois prêt. En cas d'échec (réseau, etc.), on garde le ballon procédural.
    this.loadRealBallModel();

    return this.ball;
  }

  /**
   * Remplace le ballon procédural par le modèle 3D réel (CC0, Poly Haven) une
   * fois chargé. Le mesh procédural sert de repli tant que le modèle n'est
   * pas prêt (et en cas d'échec de chargement).
   *
   * Le fichier source contient DEUX variantes ("football_deflated" et
   * "football_inflated", vraisemblablement prévues pour une animation de
   * gonflage) toutes deux visibles par défaut. Les superposer et calculer la
   * boîte englobante sur les deux à la fois produisait un volume asymétrique
   * (la variante dégonflée n'est pas une sphère centrée) : la mise à l'échelle
   * uniforme qui en résultait rendait le ballon minuscule et à peine visible
   * — cause racine du bug "je ne vois pas le ballon". Corrigé en ne gardant
   * que "football_inflated" (la vraie sphère) et en jetant l'autre variante.
   */
  private async loadRealBallModel(): Promise<void> {
    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync('', BALL_MODEL_PATH, BALL_MODEL_FILE, this.scene);
      if (!this.ball || result.meshes.length === 0) {
        result.meshes.forEach(m => m.dispose());
        return;
      }

      const inflated = result.meshes.find(m => m.name.includes('inflated'));
      if (!inflated) {
        result.meshes.forEach(m => m.dispose());
        return;
      }

      const root = new BABYLON.TransformNode('ballModelRoot', this.scene);
      inflated.parent = root; // détache de la hiérarchie importée avant de jeter le reste
      inflated.position.set(0, 0, 0);
      result.meshes.forEach(m => { if (m !== inflated) m.dispose(); });

      // Ballon blanc uni (demande explicite) : le modèle importé (Poly Haven) a sa
      // propre texture PBR (panneaux classiques) — un simple filtrage de couleur sur ce
      // matériau la laisserait transparaître (zones sombres juste éclaircies, pas
      // vraiment blanches). Remplacé entièrement par un matériau blanc uni, sur ce mesh
      // ET ses éventuels enfants (modèles glTF multi-matériaux).
      const whiteMat = new BABYLON.StandardMaterial('ballMatReal', this.scene);
      whiteMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
      whiteMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
      whiteMat.specularPower = 20;
      [inflated, ...inflated.getChildMeshes()].forEach(m => { m.material = whiteMat; });

      // Remet le modèle à l'échelle du ballon configuré (le fichier source est en mètres réels)
      inflated.computeWorldMatrix(true);
      const bounds = inflated.getBoundingInfo().boundingBox;
      const currentDiameter = Math.max(
        bounds.maximum.x - bounds.minimum.x,
        bounds.maximum.y - bounds.minimum.y,
        bounds.maximum.z - bounds.minimum.z,
      );
      const scale = currentDiameter > 0 ? FOOTBALL_CONFIG.BALL.DIAMETER / currentDiameter : 1;
      root.scaling.setAll(scale * this.BALL_VISUAL_SCALE);

      const oldMesh = this.ball.mesh;
      this.ball.mesh = root as unknown as BABYLON.Mesh;
      oldMesh.dispose();
    } catch {
      // Le ballon procédural (déjà en place) reste affiché
    }
  }

  /**
   * Tire le ballon dans une direction
   */
  kick(ball: BallInstance, direction: BABYLON.Vector3, power: number, spin?: BABYLON.Vector3): void {
    const maxSpeed = FOOTBALL_CONFIG.BALL.MAX_SPEED;
    const force = direction.normalize().scale(Math.min(power, maxSpeed));

    ball.body.applyImpulse(
      new RAPIER.Vector3(force.x, force.y, force.z),
      true
    );

    if (spin) {
      ball.body.applyTorqueImpulse(
        new RAPIER.Vector3(spin.x, spin.y, spin.z),
        true
      );
      ball.spin = spin;
    }

    ball.isInPlay = true;
  }

  /**
   * Passe le ballon à un coéquipier
   */
  pass(ball: BallInstance, from: BABYLON.Vector3, to: BABYLON.Vector3, power: number = FOOTBALL_CONFIG.PLAYER.PASS_POWER): void {
    const direction = to.subtract(from);
    const distance = direction.length();
    direction.y = Math.min(distance * 0.02, 1.5); // Légère hauteur pour les passes longues
    direction.normalize();

    this.kick(ball, direction, power);
  }

  /**
   * Réinitialise le ballon à une position
   */
  reset(position?: BABYLON.Vector3): void {
    if (!this.ball) return;

    const pos = position || new BABYLON.Vector3(0, FOOTBALL_CONFIG.BALL.DIAMETER / 2, 0);

    this.ball.body.setTranslation(
      new RAPIER.Vector3(pos.x, pos.y, pos.z),
      true
    );
    this.ball.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
    this.ball.body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);
    this.ball.isInPlay = true;
    this.ball.spin = BABYLON.Vector3.Zero();
    this.ball.lastTouch = null;
  }

  /**
   * Vérifie si le ballon est dans le terrain
   */
  isInField(ball: BallInstance): boolean {
    const pos = ball.body.translation();
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const halfW = FOOTBALL_CONFIG.FIELD.WIDTH / 2;

    return Math.abs(pos.x) < halfW + 2 && Math.abs(pos.z) < halfL + 2;
  }

  /**
   * Vérifie si un but est marqué
   */
  checkGoal(ball: BallInstance): 'home' | 'away' | null {
    const pos = ball.body.translation();
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const goalHalf = FOOTBALL_CONFIG.FIELD.GOAL_WIDTH / 2;

    // Le ballon doit franchir la ligne de but
    if (Math.abs(pos.z) > halfL + 0.5) {
      // Vérifier qu'il est entre les poteaux
      if (Math.abs(pos.x) < goalHalf && pos.y < FOOTBALL_CONFIG.FIELD.GOAL_HEIGHT) {
        // Équipe qui concède : dépend du camp choisi (change à la mi-temps)
        const concedesOnPositiveZ = this.sideSwapped ? 'home' : 'away';
        const concedesOnNegativeZ = this.sideSwapped ? 'away' : 'home';
        return pos.z > 0 ? concedesOnPositiveZ : concedesOnNegativeZ;
      }
    }

    return null;
  }

  /**
   * Vérifie si le ballon est sorti en touche
   */
  checkOutOfBounds(ball: BallInstance): 'touch' | 'goalLine' | null {
    const pos = ball.body.translation();
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const halfW = FOOTBALL_CONFIG.FIELD.WIDTH / 2;

    if (Math.abs(pos.x) > halfW) {
      return 'touch';
    }
    if (Math.abs(pos.z) > halfL + 1) {
      return 'goalLine';
    }

    return null;
  }

  /**
   * Met à jour la position du mesh du ballon
   */
  syncPosition(): void {
    if (!this.ball) return;

    const pos = this.ball.body.translation();
    this.ball.mesh.position.set(pos.x, pos.y, pos.z);

    // Rotation du ballon basée sur la vélocité angulaire
    const angVel = this.ball.body.angvel();
    this.ball.mesh.rotation.x += angVel.x * 0.016;
    this.ball.mesh.rotation.y += angVel.y * 0.016;
    this.ball.mesh.rotation.z += angVel.z * 0.016;

    // Traînée (optionnelle)
    this.updateTrail();
  }

  /**
   * Trajectoire visuelle du ballon (point A → point B) sur tir/passe : une traînée de
   * points jaunes, visible dès qu'on dépasse une vitesse de passe normale (pas
   * seulement les tirs puissants), pour que l'utilisateur voie le ballon se déplacer.
   */
  private updateTrail(): void {
    if (!this.ball || !this.trailEnabled) return;

    this.trailTimer += 0.016;
    if (this.trailTimer < 0.04) return;
    this.trailTimer = 0;

    const vel = this.ball.body.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    // Traînée dès qu'il y a un vrai déplacement volontaire (tir ou passe), pas juste un roulis
    if (speed < 5) {
      // Nettoyer l'ancienne traînée
      this.trailMeshes.forEach(m => m.dispose());
      this.trailMeshes = [];
      return;
    }

    // Ajouter un point de traînée
    const pos = this.ball.body.translation();
    const trail = BABYLON.MeshBuilder.CreateSphere('trail', {
      diameter: 0.22,
      segments: 6
    }, this.scene);
    trail.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    // Un seul matériau partagé par tous les points de traînée : en créer un nouveau à
    // chaque point (la traînée se déclenche désormais très souvent, dès 5 m/s) fuyait
    // une texture/matériau à chaque fois, `mesh.dispose()` ne libérant pas son matériau
    // par défaut — accumulation qui finissait par ralentir puis planter la page.
    trail.material = this.getTrailMaterial();

    this.trailMeshes.push(trail);

    // Limiter le nombre de points de traînée
    if (this.trailMeshes.length > 16) {
      const old = this.trailMeshes.shift();
      old?.dispose();
    }
  }

  private getTrailMaterial(): BABYLON.StandardMaterial {
    if (!this.trailMaterial) {
      this.trailMaterial = new BABYLON.StandardMaterial('trailMat', this.scene);
      this.trailMaterial.diffuseColor = new BABYLON.Color3(1, 0.82, 0.15);
      this.trailMaterial.emissiveColor = new BABYLON.Color3(0.9, 0.7, 0.1);
      this.trailMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
      this.trailMaterial.alpha = 0.65;
    }
    return this.trailMaterial;
  }

  /**
   * Récupère l'instance du ballon
   */
  getBall(): BallInstance | null {
    return this.ball;
  }

  /**
   * Nettoie le ballon
   */
  dispose(): void {
    if (this.ball) {
      this.ball.mesh.dispose();
      this.world.removeRigidBody(this.ball.body);
      this.ball = null;
    }
    this.trailMeshes.forEach(m => m.dispose());
    this.trailMeshes = [];
    this.trailMaterial?.dispose();
    this.trailMaterial = null;
  }
}
