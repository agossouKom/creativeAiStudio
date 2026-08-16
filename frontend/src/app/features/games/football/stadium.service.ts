import * as BABYLON from '@babylonjs/core';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { FOOTBALL_CONFIG, StadiumShape } from './football.config';

/**
 * Service de construction du stade
 * Gère le terrain, les gradins, les lumières, les projecteurs
 */
export interface StadiumBuildOptions {
  standColorHex?: string;
  capacity?: number;
  fogColorHex?: string;
  nightMode?: boolean;
  /** Précipitation visible (particules) en plus de l'effet gameplay/brouillard déjà en place */
  precipitation?: 'pluie' | 'neige' | null;
  /** Forme réelle des tribunes (ovale, rectangulaire, ronde, hexagonale...) */
  shape?: StadiumShape;
  /** Stade phare (Olympia Arena) : écrans géants, toit complet */
  premium?: boolean;
  /** Nom affiché sur les écrans géants (stades premium uniquement) */
  stadiumName?: string;
}

interface RingTierConfig {
  innerX: number; innerZ: number;
  outerX: number; outerZ: number;
  height: number;
}

export class StadiumService {
  private scene: BABYLON.Scene;
  private world: RAPIER.World | null;
  private fieldMeshes: BABYLON.Mesh[] = [];
  private stadiumMeshes: BABYLON.Mesh[] = [];
  private lightMeshes: BABYLON.Mesh[] = [];
  private glowLayer: BABYLON.GlowLayer | null = null;
  private options: StadiumBuildOptions = {};
  /** Étendue extérieure réelle des tribunes construites (varie selon la forme du
   *  stade) — utilisée pour positionner les projecteurs juste à l'extérieur,
   *  quelle que soit la forme choisie. */
  private standsOuterX = 0;
  private standsOuterZ = 0;
  private weatherParticles: BABYLON.ParticleSystem | null = null;

  /**
   * `world` est optionnel : la scène de prévisualisation (avant-match) n'a pas de
   * monde physique et n'en a pas besoin (rien n'y bouge/collisionne). Seule la vraie
   * scène de match en passe un, pour que les joueurs ne traversent plus les panneaux
   * publicitaires (jusqu'ici purement visuels, cf. `createAdBoardRing()`).
   */
  constructor(scene: BABYLON.Scene, world?: RAPIER.World) {
    this.scene = scene;
    this.world = world ?? null;
  }

  private hexToColor3(hex: string): BABYLON.Color3 {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? new BABYLON.Color3(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
    ) : new BABYLON.Color3(0.15, 0.15, 0.18);
  }

  /**
   * Construit tout le stade. `options` permet de varier l'apparence selon le
   * stade/météo/moment de la journée choisis en configuration (pas d'assets
   * 3D dédiés par stade : variation par couleur, capacité et éclairage).
   */
  build(options?: StadiumBuildOptions): void {
    this.options = options ?? {};
    this.createField();
    this.createRunningTrack();
    this.createGoals();
    this.createStadium();
    this.createLights();
    this.createSkybox();
    this.createWeatherEffects();
  }

  /**
   * Nettoie tous les meshes du stade
   */
  dispose(): void {
    [...this.fieldMeshes, ...this.stadiumMeshes, ...this.lightMeshes].forEach(m => m.dispose());
    this.fieldMeshes = [];
    this.stadiumMeshes = [];
    this.lightMeshes = [];
    this.glowLayer?.dispose();
    this.glowLayer = null;
    this.weatherParticles?.dispose();
    this.weatherParticles = null;
  }

  // ─── Météo (particules de pluie/neige) ─────────────────────────────────

  /**
   * Pluie/neige visibles (particules tombant sur tout le stade) — jusqu'ici seul
   * l'impact gameplay (glisse) et la teinte du brouillard existaient, sans aucune
   * précipitation réellement visible à l'écran.
   */
  private createWeatherEffects(): void {
    const kind = this.options.precipitation;
    if (kind !== 'pluie' && kind !== 'neige') return;

    const isSnow = kind === 'neige';
    const spanX = this.standsOuterX + 20;
    const spanZ = this.standsOuterZ + 20;

    const ps = new BABYLON.ParticleSystem('weather', isSnow ? 2500 : 4000, this.scene);
    ps.particleTexture = this.weatherParticleTexture(isSnow);
    ps.emitter = BABYLON.Vector3.Zero();
    ps.createBoxEmitter(
      new BABYLON.Vector3(0, -1, 0), new BABYLON.Vector3(0, -1, 0),
      new BABYLON.Vector3(-spanX, 32, -spanZ), new BABYLON.Vector3(spanX, 46, spanZ)
    );
    ps.minLifeTime = isSnow ? 6 : 2.2;
    ps.maxLifeTime = isSnow ? 9 : 2.8;
    ps.minSize = isSnow ? 0.35 : 0.06;
    ps.maxSize = isSnow ? 0.7 : 0.12;
    ps.emitRate = isSnow ? 600 : 3200;
    ps.minEmitPower = isSnow ? 0.8 : 22;
    ps.maxEmitPower = isSnow ? 1.6 : 30;
    ps.updateSpeed = 0.016;
    ps.gravity = new BABYLON.Vector3(0, isSnow ? -1.2 : -18, 0);
    ps.direction1 = new BABYLON.Vector3(-1.2, -1, -1.2);
    ps.direction2 = new BABYLON.Vector3(1.2, -1, 1.2);
    const c = isSnow ? new BABYLON.Color4(1, 1, 1, 0.9) : new BABYLON.Color4(0.68, 0.76, 0.85, 0.6);
    ps.color1 = c;
    ps.color2 = c;
    ps.colorDead = new BABYLON.Color4(c.r, c.g, c.b, 0);
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    ps.start();

    this.weatherParticles = ps;
  }

  private weatherParticleTexture(isSnow: boolean): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    if (isSnow) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 14);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    } else {
      // Strie fine verticale (goutte de pluie qui file), pas un simple point
      const grad = ctx.createLinearGradient(0, 0, 0, 32);
      grad.addColorStop(0, 'rgba(200,220,255,0)');
      grad.addColorStop(0.5, 'rgba(200,220,255,0.9)');
      grad.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(13, 0, 6, 32);
    }
    return new BABYLON.Texture(canvas.toDataURL(), this.scene);
  }

  // ─── Terrain ──────────────────────────────────────────────────────────

  private createField(): void {
    const { LENGTH, WIDTH, BORDER_MARGIN } = FOOTBALL_CONFIG.FIELD;

    // Sol principal (pelouse) — couvre tout le pourtour du stade (jusqu'aux
    // gradins), pas seulement le rectangle de jeu, pour qu'aucune zone ne
    // laisse apparaître la couleur du stade (bug précédent : le sol du stade
    // recouvrait la pelouse partout car positionné au-dessus d'elle).
    // CreateGround mappe `width` sur l'axe X et `height` sur l'axe Z : ici X
    // porte la LARGEUR (68m, comme les buts positionnés en x=±GOAL_WIDTH/2 et
    // les lignes de touche en x=±halfW) et Z porte la LONGUEUR (105m, comme
    // les buts en z=±halfL) — un bug précédent inversait les deux, si bien que
    // la pelouse (trop courte en Z) n'atteignait même pas les lignes de but.
    const fieldWidthX = WIDTH + BORDER_MARGIN * 2;
    const fieldDepthZ = LENGTH + BORDER_MARGIN * 2;
    const ground = BABYLON.MeshBuilder.CreateGround('field', {
      width: fieldWidthX,
      height: fieldDepthZ,
      subdivisions: 20
    }, this.scene);

    // Texture de pelouse avec bandes alternées, vert vif façon pelouse pro
    const grassMat = new BABYLON.StandardMaterial('grassMat', this.scene);
    grassMat.diffuseColor = new BABYLON.Color3(0.18, 0.62, 0.27);
    grassMat.specularColor = new BABYLON.Color3(0.01, 0.01, 0.01);
    grassMat.specularPower = 5;

    // Bandes alternées (effet pelouse tondue)
    const stripeTexture = this.createStripeTexture();
    if (stripeTexture) {
      stripeTexture.uScale = 4 * (fieldWidthX / WIDTH);
      stripeTexture.vScale = 4 * (fieldDepthZ / LENGTH);
      grassMat.diffuseTexture = stripeTexture;
    }

    ground.material = grassMat;
    ground.receiveShadows = true;
    ground.position = new BABYLON.Vector3(0, -0.01, 0);
    this.fieldMeshes.push(ground);

    // Marquage du terrain (contour, ligne médiane, rond central, surfaces,
    // points, arcs) — une seule texture canvas appliquée à plat sur un ground
    // aux dimensions exactes du terrain, fidèle à footBall/stade/pelouseTracee3.jpg
    this.createFieldMarkings();
  }

  /**
   * Dessine tout le marquage blanc du terrain dans une texture canvas (une
   * seule passe, dimensions exactes du terrain) plutôt qu'avec des meshes de
   * lignes/cercles séparés : les tentatives précédentes (CreatePlane pivoté,
   * CreateTorus/CreateDisc) accumulaient des bugs de rotation (axes inversés,
   * anneaux rendus sur la tranche donc invisibles vus du dessus). Un ground
   * plat avec une texture 2D élimine tout risque de rotation incorrecte.
   */
  private createFieldMarkings(): void {
    const { WIDTH, LENGTH } = FOOTBALL_CONFIG.FIELD;

    const markingsMat = new BABYLON.StandardMaterial('markingsMat', this.scene);
    const texture = this.createFieldMarkingsTexture();
    texture.hasAlpha = true;
    markingsMat.diffuseTexture = texture;
    markingsMat.useAlphaFromDiffuseTexture = true;
    markingsMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    markingsMat.emissiveColor = new BABYLON.Color3(0.55, 0.55, 0.55);
    markingsMat.specularColor = new BABYLON.Color3(0, 0, 0);
    markingsMat.backFaceCulling = false;

    // Même convention que le ground de pelouse : width→X (largeur), height→Z (longueur)
    const markings = BABYLON.MeshBuilder.CreateGround('fieldMarkings', {
      width: WIDTH,
      height: LENGTH
    }, this.scene);
    markings.position = new BABYLON.Vector3(0, 0.005, 0);
    markings.material = markingsMat;
    this.fieldMeshes.push(markings);
  }

  private createFieldMarkingsTexture(): BABYLON.Texture {
    const {
      WIDTH, LENGTH, CENTER_CIRCLE_RADIUS, PENALTY_AREA_WIDTH, PENALTY_AREA_LENGTH,
      GOAL_AREA_WIDTH, GOAL_AREA_LENGTH, PENALTY_SPOT_DISTANCE, PENALTY_ARC_RADIUS, CORNER_ARC_RADIUS
    } = FOOTBALL_CONFIG.FIELD;

    const S = 16; // pixels par mètre
    // Le canvas suit exactement la même convention que le mesh (X→largeur
    // horizontale du canvas, Z→hauteur verticale du canvas) : pas de rotation
    // de texture nécessaire, le mapping UV par défaut du ground suffit.
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(WIDTH * S);
    canvas.height = Math.round(LENGTH * S);
    const ctx = canvas.getContext('2d')!;

    const lineWidth = Math.max(2, 0.12 * S);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = lineWidth;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Contour du terrain
    ctx.strokeRect(lineWidth / 2, lineWidth / 2, canvas.width - lineWidth, canvas.height - lineWidth);

    // Ligne médiane (perpendiculaire à la longueur, à mi-hauteur du canvas)
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(canvas.width, cy);
    ctx.stroke();

    // Rond central + point central
    ctx.beginPath();
    ctx.arc(cx, cy, CENTER_CIRCLE_RADIUS * S, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, lineWidth * 0.9, 0, Math.PI * 2);
    ctx.fill();

    const bigW = PENALTY_AREA_WIDTH * S;
    const bigL = PENALTY_AREA_LENGTH * S;
    const goalW = GOAL_AREA_WIDTH * S;
    const goalL = GOAL_AREA_LENGTH * S;
    const spotDist = PENALTY_SPOT_DISTANCE * S;
    const arcR = PENALTY_ARC_RADIUS * S;
    const boxEdgeOffset = PENALTY_AREA_LENGTH - PENALTY_SPOT_DISTANCE;
    const halfAngle = Math.acos(boxEdgeOffset / PENALTY_ARC_RADIUS);

    // Deux surfaces (une par but) : end=-1 côté z négatif (haut du canvas),
    // end=1 côté z positif (bas du canvas)
    for (const end of [-1, 1] as const) {
      const bigTop = end === -1 ? 0 : canvas.height - bigL;
      ctx.strokeRect(cx - bigW / 2, bigTop, bigW, bigL);

      const goalTop = end === -1 ? 0 : canvas.height - goalL;
      ctx.strokeRect(cx - goalW / 2, goalTop, goalW, goalL);

      const spotY = end === -1 ? spotDist : canvas.height - spotDist;
      ctx.beginPath();
      ctx.arc(cx, spotY, lineWidth * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Arc de penalty ("D") : portion du cercle centré sur le point de
      // penalty qui dépasse de la surface, bulbe orientée vers le centre
      const centerAngle = end === -1 ? Math.PI / 2 : -Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx, spotY, arcR, centerAngle - halfAngle, centerAngle + halfAngle);
      ctx.stroke();
    }

    // Arcs de corner (quart de cercle tourné vers l'intérieur du terrain)
    const cr = CORNER_ARC_RADIUS * S;
    const corners = [
      { x: 0, y: 0, a0: 0, a1: Math.PI / 2 },
      { x: canvas.width, y: 0, a0: Math.PI / 2, a1: Math.PI },
      { x: canvas.width, y: canvas.height, a0: Math.PI, a1: 3 * Math.PI / 2 },
      { x: 0, y: canvas.height, a0: 3 * Math.PI / 2, a1: 2 * Math.PI }
    ];
    for (const c of corners) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, cr, c.a0, c.a1);
      ctx.stroke();
    }

    // canvas.toDataURL() renvoie déjà une URI data: complète — ne pas la re-préfixer
    return new BABYLON.Texture(canvas.toDataURL(), this.scene);
  }

  /**
   * Motif de tonte de la pelouse — varié selon la forme du stade (une seule et même
   * texture était auparavant appliquée à tous les stades sans distinction). Chaque
   * forme de stade a son propre motif, pour que la pelouse ne soit plus identique
   * partout ; le stade phare (ovale) a le motif le plus élaboré (damier), les stades
   * modestes (entraînement) restent unis, sans motif.
   */
  private createStripeTexture(): BABYLON.Texture | null {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      const light = '#2aab46';
      const dark = '#1f8f38';

      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, 256, 256);

      const band = 32;
      switch (this.options.shape) {
        case 'round':
        case 'modular':
          // Bandes horizontales
          for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i % 2 === 0 ? light : dark;
            ctx.fillRect(0, i * band, 256, band);
          }
          break;
        case 'hex':
          // Anneaux concentriques (motif circulaire, tonte "en rond" autour du centre)
          for (let r = 8; r > 0; r--) {
            ctx.fillStyle = r % 2 === 0 ? light : dark;
            ctx.beginPath();
            ctx.arc(128, 128, r * 16, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'boutique':
          // Bandes diagonales
          ctx.save();
          ctx.translate(128, 128);
          ctx.rotate(Math.PI / 4);
          ctx.translate(-128, -128);
          for (let i = -4; i < 12; i++) {
            ctx.fillStyle = i % 2 === 0 ? light : dark;
            ctx.fillRect(i * band, -128, band, 512);
          }
          ctx.restore();
          break;
        case 'oval':
          // Damier (motif de tonte le plus élaboré, réservé au stade phare)
          for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
              ctx.fillStyle = (row + col) % 2 === 0 ? light : dark;
              ctx.fillRect(col * band, row * band, band, band);
            }
          }
          break;
        case 'training':
          // Pelouse unie, sans motif (terrain d'entraînement modeste)
          ctx.fillStyle = light;
          ctx.fillRect(0, 0, 256, 256);
          break;
        case 'rect':
        case 'simple':
        default:
          // Bandes verticales (motif classique)
          for (let i = 0; i < 8; i++) {
            ctx.fillStyle = i % 2 === 0 ? light : dark;
            ctx.fillRect(i * band, 0, band, 256);
          }
          break;
      }

      // canvas.toDataURL() renvoie déjà une URI data: complète — ne pas la re-préfixer
      // (sinon URL invalide → Babylon substitue sa texture d'erreur, un damier)
      const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene);
      texture.uScale = 4;
      texture.vScale = 4;
      return texture;
    } catch {
      return null;
    }
  }

  /**
   * Texture procédurale de filet (maillage en losanges, fond transparent).
   * Pas d'asset externe : plus fiable qu'une texture de filet sous licence
   * incertaine, et un filet est un motif simple à reproduire fidèlement.
   */
  private createNetTexture(): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.5;

    const step = 16;
    for (let i = -128; i <= 256; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, 128);
      ctx.lineTo(i + 128, 0);
      ctx.stroke();
    }

    const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene);
    texture.hasAlpha = true;
    texture.uScale = 12;
    texture.vScale = 6;
    return texture;
  }

  /**
   * Texture procédurale simulant une foule dense et colorée (petits carrés de
   * couleurs variées), vue de loin — pas de sprites de spectateurs individuels.
   */
  private createCrowdTexture(): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1a1d2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Palette dominée par le blanc/bleu/sombre (vêtements, sièges) avec quelques
    // touches de couleur vive en minorité — un ancien mélange trop chaud
    // (rouge/orange/jaune majoritaires) donnait un lavis rougeâtre à toute la tribune
    const palette = ['#f4f1de', '#e0e1dd', '#3d5a80', '#293241', '#0077b6', '#adb5bd', '#588157', '#e63946', '#ffb703', '#023047'];
    const cell = 4;
    for (let y = 0; y < canvas.height; y += cell) {
      for (let x = 0; x < canvas.width; x += cell) {
        if (Math.random() < 0.82) {
          ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
          const jitter = Math.random() * 0.5 + 0.5;
          ctx.globalAlpha = jitter;
          ctx.fillRect(x, y, cell - 1, cell - 1);
        }
      }
    }
    ctx.globalAlpha = 1;

    // canvas.toDataURL() renvoie déjà une URI data: complète — ne pas la re-préfixer
    // (sinon URL invalide → Babylon substitue sa texture d'erreur, un damier)
    const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene);
    texture.uScale = 16;
    texture.vScale = 2;
    return texture;
  }

  // ─── Piste d'athlétisme ─────────────────────────────────────────────────

  /**
   * Piste (façon vraie piste d'athlétisme rouge autour du terrain, cf. référence
   * photo) — un cadre rectangulaire simple (pas un véritable ovale à extrémités
   * arrondies : la géométrie resterait proportionnée à la stade tout en évitant
   * la complexité d'un anneau ovale à rayon variable).
   */
  private createRunningTrack(): void {
    const { LENGTH, WIDTH, TRACK_WIDTH, TRACK_GAP } = FOOTBALL_CONFIG.FIELD;
    const halfL = LENGTH / 2;
    const halfW = WIDTH / 2;
    const innerL = halfL + TRACK_GAP;
    const innerW = halfW + TRACK_GAP;
    const outerW = innerW + TRACK_WIDTH;

    const trackMat = new BABYLON.StandardMaterial('trackMat', this.scene);
    trackMat.diffuseTexture = this.createTrackTexture();
    trackMat.specularColor = new BABYLON.Color3(0, 0, 0);

    // Bandes de bout (derrière chaque but), couvrent toute la largeur y compris les coins
    for (const zSign of [-1, 1]) {
      const endBand = BABYLON.MeshBuilder.CreateGround('trackEnd_' + zSign, {
        width: outerW * 2,
        height: TRACK_WIDTH,
        subdivisions: 1,
      }, this.scene);
      endBand.position = new BABYLON.Vector3(0, -0.005, zSign * (innerL + TRACK_WIDTH / 2));
      endBand.material = trackMat;
      this.fieldMeshes.push(endBand);
    }

    // Bandes latérales (le long des lignes de touche), entre les deux bandes de bout
    for (const xSign of [-1, 1]) {
      const sideBand = BABYLON.MeshBuilder.CreateGround('trackSide_' + xSign, {
        width: TRACK_WIDTH,
        height: innerL * 2,
        subdivisions: 1,
      }, this.scene);
      sideBand.position = new BABYLON.Vector3(xSign * (innerW + TRACK_WIDTH / 2), -0.005, 0);
      sideBand.material = trackMat;
      this.fieldMeshes.push(sideBand);
    }
  }

  private createTrackTexture(): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#9c2b1f'; // rouge brique façon tartan
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    for (let i = 16; i < 128; i += 16) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }

    const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene);
    texture.uScale = 6;
    texture.vScale = 2;
    return texture;
  }

  // ─── Buts ─────────────────────────────────────────────────────────────

  private createGoals(): void {
    const { GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH, LENGTH } = FOOTBALL_CONFIG.FIELD;
    const halfL = LENGTH / 2;

    const goalMat = new BABYLON.StandardMaterial('goalMat', this.scene);
    goalMat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
    goalMat.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.15);

    // Filet : texture procédurale en losanges (alpha découpée), pas de wireframe.
    // Émissif ajouté pour rester d'un blanc net quelle que soit l'intensité de
    // l'éclairage ambiant/directionnel (sans lui, un matériau blanc mais purement
    // diffus peut rendre assez sombre sous un éclairage faible, se confondant avec
    // le ballon — noir sur les modèles utilisés dans ce jeu).
    // Bug corrigé (filet terne/gris signalé, à comparer aux vrais filets blancs bien
    // visibles des captures de référence) : l'émissif était une couleur PLEINE
    // (0.55 gris) posée sur tout le mesh, sans texture — au lieu de suivre le motif en
    // losanges (alpha), elle donnait un voile gris uniforme y compris dans les zones
    // normalement transparentes entre les mailles. `emissiveTexture` (la même texture
    // que le diffuse) fait suivre l'émissif au même motif, et une couleur plus
    // proche du blanc pur rend enfin le filet net et lumineux.
    const netTex = this.createNetTexture();
    const netMat = new BABYLON.StandardMaterial('netMat', this.scene);
    netMat.diffuseTexture = netTex;
    netMat.emissiveTexture = netTex;
    netMat.useAlphaFromDiffuseTexture = true;
    netMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    netMat.emissiveColor = new BABYLON.Color3(0.85, 0.85, 0.85);
    netMat.specularColor = new BABYLON.Color3(0, 0, 0);
    netMat.backFaceCulling = false;

    for (const zSign of [-1, 1]) {
      const z = zSign * (halfL + 0.1);

      // Poteaux
      for (const xSign of [-1, 1]) {
        const post = BABYLON.MeshBuilder.CreateCylinder('post_' + zSign + '_' + xSign, {
          height: GOAL_HEIGHT,
          diameter: 0.1
        }, this.scene);
        post.position = new BABYLON.Vector3(xSign * GOAL_WIDTH / 2, GOAL_HEIGHT / 2, z);
        post.material = goalMat;
        this.fieldMeshes.push(post);
      }

      // Barre transversale
      const bar = BABYLON.MeshBuilder.CreateBox('crossbar_' + zSign, {
        width: GOAL_WIDTH,
        height: 0.08,
        depth: 0.08
      }, this.scene);
      bar.position = new BABYLON.Vector3(0, GOAL_HEIGHT, z);
      bar.material = goalMat;
      this.fieldMeshes.push(bar);

      // Filet
      const net = BABYLON.MeshBuilder.CreateBox('net_' + zSign, {
        width: GOAL_WIDTH,
        height: GOAL_HEIGHT,
        depth: GOAL_DEPTH
      }, this.scene);
      net.position = new BABYLON.Vector3(0, GOAL_HEIGHT / 2, z - zSign * GOAL_DEPTH / 2);
      net.material = netMat;
      net.scaling = new BABYLON.Vector3(1, 1, 0.3);
      this.fieldMeshes.push(net);
    }
  }

  // ─── Stade (gradins) ──────────────────────────────────────────────────

  /**
   * Construit les tribunes selon la forme choisie en configuration (footBall/gallerieStadeOK/
   * stades-galerie-3d.html porté vers Babylon.js). Chaque forme a sa propre silhouette réelle
   * (pas juste une couleur) : anneau elliptique/rond/hexagonal pour les stades "modernes",
   * gradins droits pour les petits stades, simple clôture pour le centre d'entraînement.
   */
  private createStadium(): void {
    const shape = this.options.shape ?? 'rect';
    this.createStadiumBase();

    switch (shape) {
      case 'oval':
        this.createPolygonRingStadium('ellipse', this.ovalTiers(), true, true, !!this.options.premium);
        break;
      case 'boutique':
        this.createPolygonRingStadium('ellipse', this.boutiqueTiers(), true, true, false);
        break;
      case 'round':
        this.createPolygonRingStadium('circle', this.roundTiers(), true, true, false);
        break;
      case 'hex':
        this.createPolygonRingStadium('hex', this.hexTiers(), true, true, false);
        break;
      case 'simple':
        this.createStraightStadium([0], 2, false);
        break;
      case 'modular':
        this.createStraightStadium([0, 1], 2, false);
        break;
      case 'training':
        this.createTrainingGround();
        break;
      case 'rect':
      default:
        this.createRectStadium();
        break;
    }

    this.createCityscape();
  }

  /**
   * Voirie et immeubles au-delà des tribunes (visibles surtout en vue large/vue
   * d'ensemble) — porté depuis les maquettes de référence footBall/gallerieStadeOK/.
   * Toujours construits au-delà de `standsOuterX/Z` (quelle que soit la forme du
   * stade), donc jamais à l'intérieur des tribunes.
   */
  private createCityscape(): void {
    const roadInner = Math.max(this.standsOuterX, this.standsOuterZ) + 8;
    const roadWidth = 16;
    const roadOuter = roadInner + roadWidth;
    const nightMode = !!this.options.nightMode;

    // Sol urbain (au-delà de la route), plus sombre que la pelouse/piste
    const cityGroundMat = new BABYLON.StandardMaterial('cityGroundMat', this.scene);
    cityGroundMat.diffuseColor = new BABYLON.Color3(0.09, 0.1, 0.12);
    cityGroundMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const cityGround = BABYLON.MeshBuilder.CreateDisc('cityGround', { radius: roadOuter + 90, tessellation: 64 }, this.scene);
    cityGround.rotation.x = Math.PI / 2;
    cityGround.position.y = -0.07;
    cityGround.material = cityGroundMat;
    this.stadiumMeshes.push(cityGround);

    // Route circulaire (asphalt texturé) — un disque un peu plus grand posé par-dessus
    // le sol urbain donne l'anneau de route sans avoir besoin d'une vraie géométrie à trou
    const roadMat = new BABYLON.StandardMaterial('roadMat', this.scene);
    roadMat.diffuseTexture = this.roadTexture();
    roadMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const road = BABYLON.MeshBuilder.CreateDisc('road', { radius: roadOuter, tessellation: 64 }, this.scene);
    road.rotation.x = Math.PI / 2;
    road.position.y = -0.06;
    road.material = roadMat;
    this.stadiumMeshes.push(road);

    // Parvis (entre les tribunes et la route), couleur neutre
    const plazaMat = new BABYLON.StandardMaterial('plazaMat', this.scene);
    plazaMat.diffuseColor = new BABYLON.Color3(0.15, 0.16, 0.18);
    plazaMat.specularColor = new BABYLON.Color3(0, 0, 0);
    const plaza = BABYLON.MeshBuilder.CreateDisc('plaza', { radius: roadInner, tessellation: 64 }, this.scene);
    plaza.rotation.x = Math.PI / 2;
    plaza.position.y = -0.05;
    plaza.material = plazaMat;
    this.stadiumMeshes.push(plaza);

    // Immeubles (boîtes texturées "fenêtres") dispersés au-delà de la route, avec 4
    // couloirs dégagés (avenues d'accès) pour éviter un mur continu tout autour
    const buildingMats: BABYLON.StandardMaterial[] = [];
    const buildingCount = 26;
    for (let i = 0; i < buildingCount; i++) {
      const angle = (i / buildingCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const nearAvenue = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].some(a => {
        const d = Math.abs(((angle - a + Math.PI) % (Math.PI * 2)) - Math.PI);
        return d < 0.18;
      });
      if (nearAvenue) continue;

      const rad = roadOuter + 12 + Math.random() * 55;
      const x = rad * Math.cos(angle), z = rad * Math.sin(angle);
      const w = 7 + Math.random() * 9, d = 7 + Math.random() * 9, h = 10 + Math.random() * 26;

      const mat = new BABYLON.StandardMaterial('buildingMat_' + i, this.scene);
      const tex = this.buildingWindowTexture();
      mat.diffuseColor = new BABYLON.Color3(0.16, 0.17, 0.21);
      mat.diffuseTexture = tex;
      mat.emissiveTexture = tex;
      mat.emissiveColor = new BABYLON.Color3(nightMode ? 0.8 : 0.08, nightMode ? 0.75 : 0.08, nightMode ? 0.55 : 0.08);
      mat.specularColor = new BABYLON.Color3(0, 0, 0);
      buildingMats.push(mat);

      const building = BABYLON.MeshBuilder.CreateBox('building_' + i, { width: w, height: h, depth: d }, this.scene);
      building.position = new BABYLON.Vector3(x, h / 2, z);
      building.rotation.y = angle + Math.PI / 2;
      building.material = mat;
      this.stadiumMeshes.push(building);
    }

    // Lampadaires le long de la route (allumés la nuit seulement)
    const lampCount = 12;
    for (let i = 0; i < lampCount; i++) {
      const angle = (i / lampCount) * Math.PI * 2;
      const x = (roadInner + roadWidth / 2) * Math.cos(angle);
      const z = (roadInner + roadWidth / 2) * Math.sin(angle);

      const poleMat = new BABYLON.StandardMaterial('lampPoleMat_' + i, this.scene);
      poleMat.diffuseColor = new BABYLON.Color3(0.18, 0.19, 0.22);
      const pole = BABYLON.MeshBuilder.CreateCylinder('lampPole_' + i, { height: 5, diameter: 0.22 }, this.scene);
      pole.position = new BABYLON.Vector3(x, 2.5, z);
      pole.material = poleMat;
      this.stadiumMeshes.push(pole);

      const lampMat = new BABYLON.StandardMaterial('lampMat_' + i, this.scene);
      lampMat.diffuseColor = new BABYLON.Color3(1, 0.95, 0.8);
      lampMat.emissiveColor = nightMode ? new BABYLON.Color3(1, 0.9, 0.6) : new BABYLON.Color3(0.15, 0.13, 0.08);
      const lamp = BABYLON.MeshBuilder.CreateSphere('lamp_' + i, { diameter: 0.45 }, this.scene);
      lamp.position = new BABYLON.Vector3(x, 5, z);
      lamp.material = lampMat;
      this.stadiumMeshes.push(lamp);

      if (nightMode) {
        const light = new BABYLON.PointLight('streetLight_' + i, new BABYLON.Vector3(x, 5, z), this.scene);
        light.intensity = 0.35;
        light.diffuse = new BABYLON.Color3(1, 0.9, 0.65);
        light.range = 18;
      }
    }
  }

  private roadTexture(): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1c1f26';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(234, 217, 160, 0.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(128, 64);
    ctx.stroke();
    const tex = new BABYLON.Texture(canvas.toDataURL(), this.scene);
    tex.uScale = 24;
    tex.vScale = 24;
    return tex;
  }

  private buildingWindowTexture(): BABYLON.Texture {
    const cols = 6, rows = 10;
    const canvas = document.createElement('canvas');
    canvas.width = cols * 16; canvas.height = rows * 16;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#151822';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f4d488';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.5) ctx.fillRect(c * 16 + 3, r * 16 + 3, 10, 10);
      }
    }
    return new BABYLON.Texture(canvas.toDataURL(), this.scene);
  }

  /**
   * Base du stade (dalle sous le niveau de la pelouse, commune à toutes les formes) —
   * sous le niveau de la pelouse pour ne jamais la recouvrir (sinon toute la pelouse
   * prend la couleur du stade !).
   */
  private createStadiumBase(): void {
    const { LENGTH, WIDTH, BORDER_MARGIN } = FOOTBALL_CONFIG.FIELD;
    const stadiumMat = new BABYLON.StandardMaterial('stadiumMat', this.scene);
    stadiumMat.diffuseColor = this.options.standColorHex
      ? this.hexToColor3(this.options.standColorHex)
      : new BABYLON.Color3(0.15, 0.15, 0.18);
    stadiumMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    const stadiumBase = BABYLON.MeshBuilder.CreateBox('stadiumBase', {
      width: LENGTH + BORDER_MARGIN * 2,
      height: 1,
      depth: WIDTH + BORDER_MARGIN * 2
    }, this.scene);
    stadiumBase.position = new BABYLON.Vector3(0, -1, 0);
    stadiumBase.material = stadiumMat;
    this.stadiumMeshes.push(stadiumBase);
  }

  private standMaterial(): BABYLON.StandardMaterial {
    const mat = new BABYLON.StandardMaterial('stadiumMat2', this.scene);
    mat.diffuseColor = this.options.standColorHex
      ? this.hexToColor3(this.options.standColorHex)
      : new BABYLON.Color3(0.15, 0.15, 0.18);
    mat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    return mat;
  }

  private crowdMaterial(): BABYLON.StandardMaterial {
    const mat = new BABYLON.StandardMaterial('crowdMat', this.scene);
    mat.diffuseTexture = this.createCrowdTexture();
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    return mat;
  }

  // ─── Stade rectangulaire (Riverside Park et al.) ───────────────────────

  private createRectStadium(): void {
    const { LENGTH, WIDTH, BORDER_MARGIN } = FOOTBALL_CONFIG.FIELD;
    const STADIUM_SEATS = this.options.capacity
      ? Math.max(500, Math.round(this.options.capacity / 15))
      : FOOTBALL_CONFIG.GRAPHICS.STADIUM_SEATS;

    const crowdMat = this.crowdMaterial();
    const seatColors = [
      new BABYLON.Color3(0.2, 0.3, 0.6),  // Bleu
      new BABYLON.Color3(0.6, 0.2, 0.2),  // Rouge
      new BABYLON.Color3(0.2, 0.5, 0.2),  // Vert
      new BABYLON.Color3(0.6, 0.5, 0.1),  // Jaune
    ];

    const halfL = LENGTH / 2 + BORDER_MARGIN;
    const halfW = WIDTH / 2 + BORDER_MARGIN;

    // Gradins (4 côtés)
    const tiers = 4;
    const seatsPerSide = Math.floor(STADIUM_SEATS / 4);

    for (let side = 0; side < 4; side++) {
      const isLongSide = side < 2;
      const length = isLongSide ? LENGTH + BORDER_MARGIN * 2 : WIDTH + BORDER_MARGIN * 2;
      const depth = 4;

      for (let t = 0; t < tiers; t++) {
        const tierDepth = depth + t * 1.5;
        const yOffset = 1 + t * 1.2;

        const tier = BABYLON.MeshBuilder.CreateBox('tier_' + side + '_' + t, {
          width: isLongSide ? length : tierDepth,
          height: 0.3,
          depth: isLongSide ? tierDepth : length
        }, this.scene);

        let x = 0, z = 0;
        if (side === 0) { x = 0; z = -halfL - depth / 2 - t * 0.75; }
        else if (side === 1) { x = 0; z = halfL + depth / 2 + t * 0.75; }
        else if (side === 2) { x = -halfW - depth / 2 - t * 0.75; z = 0; }
        else { x = halfW + depth / 2 + t * 0.75; z = 0; }

        tier.position = new BABYLON.Vector3(x, yOffset, z);
        tier.material = crowdMat;
        this.stadiumMeshes.push(tier);

        // Sièges sur ce gradin
        const seatsPerTier = Math.floor(seatsPerSide / tiers);
        const seatSpacing = length / seatsPerTier;

        for (let s = 0; s < Math.min(seatsPerTier, 40); s++) {
          const seat = BABYLON.MeshBuilder.CreateBox('seat_' + side + '_' + t + '_' + s, {
            width: 0.3,
            height: 0.2,
            depth: 0.3
          }, this.scene);

          let sx = 0, sz = 0;
          const offset = (s - seatsPerTier / 2) * seatSpacing;

          if (side === 0) { sx = offset; sz = -halfL - depth / 2 - t * 0.75; }
          else if (side === 1) { sx = offset; sz = halfL + depth / 2 + t * 0.75; }
          else if (side === 2) { sx = -halfW - depth / 2 - t * 0.75; sz = offset; }
          else { sx = halfW + depth / 2 + t * 0.75; sz = offset; }

          seat.position = new BABYLON.Vector3(sx, yOffset + 0.2, sz);
          seat.material = new BABYLON.StandardMaterial('seatMat_' + side + '_' + t + '_' + s, this.scene);
          (seat.material as BABYLON.StandardMaterial).diffuseColor = seatColors[(side + t + s) % seatColors.length];
          this.stadiumMeshes.push(seat);
        }
      }
    }

    // Toit du stade (structure ouverte)
    const roofMat = new BABYLON.StandardMaterial('roofMat', this.scene);
    roofMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.12);
    roofMat.alpha = 0.3;

    for (let side = 0; side < 4; side++) {
      const isLongSide = side < 2;
      const length = isLongSide ? LENGTH + BORDER_MARGIN * 2 + 8 : WIDTH + BORDER_MARGIN * 2 + 8;
      const depth = 5;

      const roof = BABYLON.MeshBuilder.CreateBox('roof_' + side, {
        width: isLongSide ? length : depth,
        height: 0.1,
        depth: isLongSide ? depth : length
      }, this.scene);

      let x = 0, z = 0;
      const roofHeight = 1 + tiers * 1.2 + 1;
      if (side === 0) { x = 0; z = -halfL - 6; }
      else if (side === 1) { x = 0; z = halfL + 6; }
      else if (side === 2) { x = -halfW - 6; z = 0; }
      else { x = halfW + 6; z = 0; }

      roof.position = new BABYLON.Vector3(x, roofHeight, z);
      roof.material = roofMat;
      this.stadiumMeshes.push(roof);
    }

    this.standsOuterX = halfW + 8;
    this.standsOuterZ = halfL + 8;
  }

  // ─── Stades en anneau (ovale / rond / hexagonal / boutique) ────────────

  /**
   * Rayon (au sommet) nécessaire pour qu'une forme donnée dégage ENTIÈREMENT un
   * rectangle de demi-largeur/demi-longueur (reqX,reqZ) — y compris ses COINS, pas
   * seulement ses côtés. Un ovale/cercle/hexagone dimensionné pour juste toucher le
   * milieu des côtés du rectangle coupe toujours à l'intérieur de ses coins (le coin
   * d'un rectangle est plus loin du centre que n'importe quelle ellipse inscrite à ce
   * même endroit) — c'est la cause exacte du bug "les tribunes empiètent sur la pelouse".
   */
  private safeRingRadius(kind: 'ellipse' | 'circle' | 'hex', reqX: number, reqZ: number): { rx: number; rz: number } {
    const cornerDist = Math.hypot(reqX, reqZ);
    if (kind === 'circle') {
      return { rx: cornerDist, rz: cornerDist };
    }
    if (kind === 'hex') {
      // L'apothème (distance centre→milieu d'arête) d'un hexagone régulier vaut
      // R*cos(30°), PAS le rayon au sommet — c'est cette distance plus courte qui doit
      // dégager le coin, donc il faut un rayon au sommet plus grand en conséquence.
      const r = cornerDist / Math.cos(Math.PI / 6);
      return { rx: r, rz: r };
    }
    // Ellipse dimensionnée pour passer exactement par le coin (reqX,reqZ) tout en
    // gardant le même ratio largeur/longueur que le rectangle à dégager (garde une
    // silhouette ovale cohérente plutôt qu'un cercle) : rx=reqX·k, rz=reqZ·k avec
    // (reqX/rx)²+(reqZ/rz)²=1 → 2/k²=1 → k=√2.
    const k = Math.SQRT2;
    return { rx: reqX * k, rz: reqZ * k };
  }

  /** Empile `count` anneaux à partir du rayon de base, chacun `stepX`×`stepZ` plus large que le précédent */
  private stackTiers(baseX: number, baseZ: number, count: number, stepX: number, stepZ: number, height: number): RingTierConfig[] {
    const tiers: RingTierConfig[] = [];
    let ix = baseX, iz = baseZ;
    for (let i = 0; i < count; i++) {
      const ox = ix + stepX, oz = iz + stepZ;
      tiers.push({ innerX: ix, innerZ: iz, outerX: ox, outerZ: oz, height });
      ix = ox; iz = oz;
    }
    return tiers;
  }

  /** Demi-largeur/demi-longueur à dégager par toutes les tribunes en anneau (terrain + marge/piste) */
  private ringClearance(): { reqX: number; reqZ: number } {
    const { LENGTH, WIDTH, BORDER_MARGIN } = FOOTBALL_CONFIG.FIELD;
    return { reqX: WIDTH / 2 + BORDER_MARGIN, reqZ: LENGTH / 2 + BORDER_MARGIN };
  }

  private ovalTiers(): RingTierConfig[] {
    const { reqX, reqZ } = this.ringClearance();
    const { rx, rz } = this.safeRingRadius('ellipse', reqX, reqZ);
    return this.stackTiers(rx * 1.05, rz * 1.05, 3, 8, 11, 7);
  }

  private boutiqueTiers(): RingTierConfig[] {
    const { reqX, reqZ } = this.ringClearance();
    const { rx, rz } = this.safeRingRadius('ellipse', reqX, reqZ);
    return this.stackTiers(rx * 1.05, rz * 1.05, 2, 6, 8, 6);
  }

  private roundTiers(): RingTierConfig[] {
    const { reqX, reqZ } = this.ringClearance();
    const { rx, rz } = this.safeRingRadius('circle', reqX, reqZ);
    return this.stackTiers(rx * 1.05, rz * 1.05, 2, 9, 9, 7);
  }

  private hexTiers(): RingTierConfig[] {
    const { reqX, reqZ } = this.ringClearance();
    const { rx, rz } = this.safeRingRadius('hex', reqX, reqZ);
    return this.stackTiers(rx * 1.05, rz * 1.05, 2, 10, 10, 7);
  }

  /** Point sur le contour (ellipse/cercle/hexagone) à l'angle donné, dans le plan XZ */
  private ringOutlinePoint(kind: 'ellipse' | 'circle' | 'hex', rx: number, rz: number, angle: number): { x: number; z: number } {
    if (kind === 'hex') {
      const sides = 6;
      const sector = (Math.PI * 2) / sides;
      let a = angle % (Math.PI * 2);
      if (a < 0) a += Math.PI * 2;
      const i = Math.min(sides - 1, Math.floor(a / sector));
      const t = (a - i * sector) / sector;
      const a0 = i * sector, a1 = (i + 1) * sector;
      const p0 = { x: rx * Math.cos(a0), z: rz * Math.sin(a0) };
      const p1 = { x: rx * Math.cos(a1), z: rz * Math.sin(a1) };
      return { x: p0.x + (p1.x - p0.x) * t, z: p0.z + (p1.z - p0.z) * t };
    }
    // Cercle = ellipse avec rx === rz
    return { x: rx * Math.cos(angle), z: rz * Math.sin(angle) };
  }

  /**
   * Construit un anneau de tribunes (approximé par des segments droits jointifs suivant
   * le contour de la forme choisie — même technique que les gradins rectangulaires
   * existants, généralisée à un contour non rectangulaire) plus toit, écrans et
   * panneaux publicitaires optionnels.
   */
  private createPolygonRingStadium(
    kind: 'ellipse' | 'circle' | 'hex',
    tiers: RingTierConfig[],
    roof: boolean,
    ads: boolean,
    premiumScreens: boolean
  ): void {
    const crowdMat = this.crowdMaterial();
    // Plus de segments = contour plus lisse (moins "facetté") pour les formes courbes ;
    // le nombre exact de côtés reste correct pour l'hexagone (silhouette anguleuse voulue)
    const segments = kind === 'hex' ? 6 : 96;
    let baseY = 0;

    tiers.forEach((tier, tierIndex) => {
      const isAccent = tierIndex === Math.min(1, tiers.length - 1);
      const tierMat = isAccent
        ? this.chevronMaterial()
        : this.standMaterial();

      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        const aMid = (a0 + a1) / 2;

        const outer0 = this.ringOutlinePoint(kind, tier.outerX, tier.outerZ, a0);
        const outer1 = this.ringOutlinePoint(kind, tier.outerX, tier.outerZ, a1);
        const innerMid = this.ringOutlinePoint(kind, tier.innerX, tier.innerZ, aMid);
        const outerMid = this.ringOutlinePoint(kind, tier.outerX, tier.outerZ, aMid);

        const segWidth = Math.hypot(outer1.x - outer0.x, outer1.z - outer0.z) * 1.06;
        const segDepth = Math.hypot(outerMid.x - innerMid.x, outerMid.z - innerMid.z);
        const cx = (innerMid.x + outerMid.x) / 2;
        const cz = (innerMid.z + outerMid.z) / 2;
        const rotY = Math.atan2(outerMid.x - innerMid.x, outerMid.z - innerMid.z);

        const seg = BABYLON.MeshBuilder.CreateBox(`ringTier_${tierIndex}_${i}`, {
          width: segWidth,
          height: tier.height,
          depth: Math.max(0.5, segDepth)
        }, this.scene);
        seg.position = new BABYLON.Vector3(cx, baseY + tier.height / 2, cz);
        seg.rotation.y = rotY;
        seg.material = isAccent ? tierMat : crowdMat;
        this.stadiumMeshes.push(seg);
      }

      // Liseré doré entre les niveaux
      if (tierIndex > 0) {
        const ring = BABYLON.MeshBuilder.CreateTorus(`ringTrim_${tierIndex}`, {
          diameter: 2, thickness: 0.2, tessellation: segments
        }, this.scene);
        // CreateTorus est déjà à plat dans le plan XZ par défaut (X/Z = rayons,
        // Y = épaisseur) — PAS de rotation ici, sinon l'anneau se retrouve à la
        // verticale (bug déjà rencontré et corrigé sur le rond central du terrain)
        ring.scaling = new BABYLON.Vector3(tier.innerX, 1, tier.innerZ);
        ring.position.y = baseY + 0.05;
        const trimMat = new BABYLON.StandardMaterial(`trimMat_${tierIndex}`, this.scene);
        trimMat.diffuseColor = new BABYLON.Color3(0.85, 0.64, 0.25);
        trimMat.emissiveColor = new BABYLON.Color3(0.5, 0.38, 0.12);
        ring.material = trimMat;
        this.stadiumMeshes.push(ring);
      }

      baseY += tier.height;
    });

    const lastTier = tiers[tiers.length - 1];
    this.standsOuterX = lastTier.outerX + 16;
    this.standsOuterZ = lastTier.outerZ + 14;

    if (roof) {
      this.createRingRoof(lastTier.outerX, lastTier.outerZ, baseY);
    }
    if (ads) {
      this.createAdBoardRing();
    }
    if (premiumScreens) {
      this.createScoreboardScreens();
    }
  }

  private chevronMaterial(): BABYLON.StandardMaterial {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#171f2e'; ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#d9a441';
    for (let i = 0; i < 8; i++) {
      const x = i * 32;
      ctx.beginPath();
      ctx.moveTo(x, 64); ctx.lineTo(x + 16, 20); ctx.lineTo(x + 32, 64);
      ctx.closePath(); ctx.fill();
    }
    const tex = new BABYLON.Texture(canvas.toDataURL(), this.scene);
    tex.uScale = 24; tex.vScale = 1;
    const mat = new BABYLON.StandardMaterial('chevronMat', this.scene);
    mat.diffuseTexture = tex;
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    return mat;
  }

  private createRingRoof(outerX: number, outerZ: number, standHeight: number): void {
    const rBase = (outerX + outerZ) / 2;
    const roofMat = new BABYLON.StandardMaterial('ringRoofMat', this.scene);
    roofMat.diffuseColor = new BABYLON.Color3(0.87, 0.89, 0.92);
    roofMat.specularPower = 32;
    // CreateTorus est déjà à plat dans le plan XZ par défaut (X/Z = rayons, Y =
    // épaisseur) — PAS de rotation ici, sinon le toit se retrouve à la verticale
    // (bug déjà rencontré et corrigé sur le rond central du terrain)
    const roof = BABYLON.MeshBuilder.CreateTorus('ringRoof', { diameter: rBase * 2, thickness: 3, tessellation: 96 }, this.scene);
    roof.scaling = new BABYLON.Vector3(outerX / rBase, 1, outerZ / rBase);
    roof.position.y = standHeight + 2;
    roof.material = roofMat;
    this.stadiumMeshes.push(roof);

    const trimMat = new BABYLON.StandardMaterial('ringRoofTrimMat', this.scene);
    trimMat.diffuseColor = new BABYLON.Color3(0.24, 0.86, 0.71);
    trimMat.emissiveColor = new BABYLON.Color3(0.24, 0.86, 0.71);
    const trim = BABYLON.MeshBuilder.CreateTorus('ringRoofTrim', { diameter: rBase * 2, thickness: 0.35, tessellation: 96 }, this.scene);
    trim.scaling = roof.scaling.clone();
    trim.position.y = standHeight + 0.7;
    trim.material = trimMat;
    this.stadiumMeshes.push(trim);
  }

  private adBoardTexture(): BABYLON.Texture {
    const w = 1024, h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const labels = ['OLYMPIA BANK', 'ARENA TELECOM', 'STADE ENERGY', 'CITY MOTORS', 'NORD ASSURANCE', 'PIXEL SPORT'];
    const bg = ['#0d1420', '#1d2a52', '#0d1420', '#7a1f18', '#0d1420', '#1c5b3f'];
    const segW = w / labels.length;
    labels.forEach((label, i) => {
      ctx.fillStyle = bg[i % bg.length];
      ctx.fillRect(i * segW, 0, segW, h);
      ctx.fillStyle = '#f4d488';
      ctx.font = 'bold 42px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, i * segW + segW / 2, h / 2);
    });
    const tex = new BABYLON.Texture(canvas.toDataURL(), this.scene);
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    return tex;
  }

  /** Panneaux publicitaires tout autour du terrain (juste derrière les lignes de touche/but) */
  private createAdBoardRing(): void {
    const { LENGTH, WIDTH } = FOOTBALL_CONFIG.FIELD;
    const halfL = LENGTH / 2, halfW = WIDTH / 2;
    const mat = new BABYLON.StandardMaterial('adBoardMat', this.scene);
    const tex = this.adBoardTexture();
    tex.uScale = 4;
    mat.diffuseTexture = tex;
    mat.emissiveTexture = tex;
    mat.emissiveColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    mat.backFaceCulling = false;

    // Corrigé (retrait précédent sur le mauvais panneau) : le panneau à retirer est
    // celui du côté LONGUEUR (touche, pas ligne de but) et côté "bas" à l'écran — avec
    // la convention caméra établie (axe X monde = vertical écran, X négatif = haut,
    // X positif = bas, cf. correctif des flèches directionnelles), c'est le panneau
    // x = +(halfW + 2), pas celui à z négatif retiré par erreur auparavant.
    const boards: { w: number; h: number; x: number; z: number; rotY: number; skip?: boolean }[] = [
      { w: WIDTH + 2, h: 1.3, x: 0, z: -(halfL + 2), rotY: 0 },
      { w: WIDTH + 2, h: 1.3, x: 0, z: (halfL + 2), rotY: 0 },
      { w: LENGTH + 2, h: 1.3, x: -(halfW + 2), z: 0, rotY: Math.PI / 2 },
      { w: LENGTH + 2, h: 1.3, x: (halfW + 2), z: 0, rotY: Math.PI / 2, skip: true },
    ];
    boards.forEach((b, i) => {
      if (b.skip) return;
      const board = BABYLON.MeshBuilder.CreatePlane(`adBoard_${i}`, { width: b.w, height: b.h }, this.scene);
      board.position = new BABYLON.Vector3(b.x, 0.68, b.z);
      board.rotation.y = b.rotY;
      board.material = mat;
      this.stadiumMeshes.push(board);

      // Collider statique fin (les panneaux étaient purement visuels — les joueurs,
      // devenus des personnages 3D bien visibles, les traversaient sans réagir).
      if (this.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
          .setTranslation(b.x, 0.68, b.z)
          .setRotation({ x: 0, y: Math.sin(b.rotY / 2), z: 0, w: Math.cos(b.rotY / 2) });
        const body = this.world.createRigidBody(bodyDesc);
        // Demi-épaisseur arbitraire mais fine (0,1 m) : un panneau réel est mince,
        // seule sa largeur (b.w) et sa hauteur (b.h) comptent pour bloquer le passage.
        const colliderDesc = RAPIER.ColliderDesc.cuboid(b.w / 2, b.h / 2, 0.1)
          .setFriction(0.4)
          .setRestitution(0.1);
        this.world.createCollider(colliderDesc, body);
      }
    });
  }

  private scoreboardTexture(): BABYLON.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#05070c'; ctx.fillRect(0, 0, 640, 200);
    ctx.strokeStyle = '#3ddcb4'; ctx.lineWidth = 5; ctx.strokeRect(5, 5, 630, 190);
    ctx.fillStyle = '#3ddcb4'; ctx.font = 'bold 46px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((this.options.stadiumName ?? 'OLYMPIA ARENA').toUpperCase(), 320, 90);
    ctx.fillStyle = '#d9a441'; ctx.font = 'bold 28px Arial';
    ctx.fillText('BIENVENUE AU STADE', 320, 140);
    return new BABYLON.Texture(canvas.toDataURL(), this.scene);
  }

  /** Écrans géants aux deux extrémités (stade premium uniquement) */
  private createScoreboardScreens(): void {
    const { LENGTH } = FOOTBALL_CONFIG.FIELD;
    const halfL = LENGTH / 2;
    [-1, 1].forEach(zSign => {
      const bezelMat = new BABYLON.StandardMaterial('screenBezelMat_' + zSign, this.scene);
      bezelMat.diffuseColor = new BABYLON.Color3(0.04, 0.05, 0.07);
      const bezel = BABYLON.MeshBuilder.CreateBox('screenBezel_' + zSign, { width: 21, height: 6.6, depth: 0.6 }, this.scene);
      bezel.position = new BABYLON.Vector3(0, 24, zSign * (halfL + 20));
      bezel.rotation.x = -zSign * 0.15;
      bezel.material = bezelMat;
      this.stadiumMeshes.push(bezel);

      const screenMat = new BABYLON.StandardMaterial('screenMat_' + zSign, this.scene);
      const tex = this.scoreboardTexture();
      screenMat.diffuseTexture = tex;
      screenMat.emissiveTexture = tex;
      screenMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
      screenMat.specularColor = new BABYLON.Color3(0, 0, 0);
      const screen = BABYLON.MeshBuilder.CreatePlane('screen_' + zSign, { width: 19.5, height: 5.2 }, this.scene);
      screen.parent = bezel;
      screen.position = new BABYLON.Vector3(0, 0, zSign > 0 ? -0.32 : 0.32);
      screen.rotation.y = Math.PI;
      screen.material = screenMat;
      this.stadiumMeshes.push(screen);
    });
  }

  // ─── Stades à gradins droits (simple / modulaire) ──────────────────────

  /**
   * Petits stades sans anneau complet : une ou deux tribunes droites face à face
   * (le reste du pourtour reste dégagé), sans toit — façon stade municipal ou
   * arène temporaire montée pour l'occasion.
   */
  private createStraightStadium(sides: number[], tierCount: number, roof: boolean): void {
    const { LENGTH, WIDTH, BORDER_MARGIN } = FOOTBALL_CONFIG.FIELD;
    const halfL = LENGTH / 2 + BORDER_MARGIN;
    const halfW = WIDTH / 2 + BORDER_MARGIN;
    const crowdMat = this.crowdMaterial();
    const accentMat = this.chevronMaterial();

    const standLength = WIDTH + BORDER_MARGIN * 2;
    const depth = 4;

    sides.forEach(side => {
      for (let t = 0; t < tierCount; t++) {
        const tierHeight = 4;
        const tierDepth = depth + t * 2;
        const yOffset = t * tierHeight;

        const stand = BABYLON.MeshBuilder.CreateBox(`straightStand_${side}_${t}`, {
          width: standLength,
          height: tierHeight,
          depth: tierDepth
        }, this.scene);

        const z = side === 0 ? -halfL - tierDepth / 2 - t * 1.2 : halfL + tierDepth / 2 + t * 1.2;
        stand.position = new BABYLON.Vector3(0, yOffset + tierHeight / 2, z);
        stand.material = t === 0 ? accentMat : crowdMat;
        this.stadiumMeshes.push(stand);
      }
    });

    // Bancs de touche des deux côtés (toujours présents, même sans tribune complète)
    const benchMat = new BABYLON.StandardMaterial('benchMat', this.scene);
    benchMat.diffuseColor = new BABYLON.Color3(0.16, 0.19, 0.26);
    [-1, 1].forEach(xSign => {
      const bench = BABYLON.MeshBuilder.CreateBox('bench_' + xSign, { width: 6, height: 1, depth: 1.4 }, this.scene);
      bench.position = new BABYLON.Vector3(xSign * 10, 0.5, -(halfW + 2));
      bench.material = benchMat;
      this.stadiumMeshes.push(bench);
    });

    if (roof) {
      const roofMat = new BABYLON.StandardMaterial('straightRoofMat', this.scene);
      roofMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.12);
      roofMat.alpha = 0.3;
      sides.forEach(side => {
        const r = BABYLON.MeshBuilder.CreateBox(`straightRoof_${side}`, { width: standLength + 4, height: 0.1, depth: 5 }, this.scene);
        const z = side === 0 ? -halfL - 6 : halfL + 6;
        r.position = new BABYLON.Vector3(0, tierCount * 4 + 1, z);
        r.material = roofMat;
        this.stadiumMeshes.push(r);
      });
    }

    this.standsOuterX = halfW + 6;
    this.standsOuterZ = halfL + 6 + tierCount * 2;
  }

  // ─── Centre d'entraînement (pas de tribunes) ───────────────────────────

  /** Terrain nu entouré d'une simple clôture — pas de tribunes, pas de toit, pas de public */
  private createTrainingGround(): void {
    const { LENGTH, WIDTH } = FOOTBALL_CONFIG.FIELD;
    const halfL = LENGTH / 2 + 4, halfW = WIDTH / 2 + 4;
    const fenceMat = new BABYLON.StandardMaterial('fenceMat', this.scene);
    fenceMat.diffuseColor = new BABYLON.Color3(0.33, 0.36, 0.41);
    fenceMat.alpha = 0.5;
    fenceMat.backFaceCulling = false;

    const fh = 2.2;
    [[-halfL, WIDTH + 8], [halfL, WIDTH + 8]].forEach(([z, w]) => {
      const p = BABYLON.MeshBuilder.CreatePlane('fenceZ_' + z, { width: w, height: fh }, this.scene);
      p.position = new BABYLON.Vector3(0, fh / 2, z);
      p.material = fenceMat;
      this.stadiumMeshes.push(p);
    });
    [[-halfW, LENGTH + 8], [halfW, LENGTH + 8]].forEach(([x, d]) => {
      const p = BABYLON.MeshBuilder.CreatePlane('fenceX_' + x, { width: d, height: fh }, this.scene);
      p.position = new BABYLON.Vector3(x, fh / 2, 0);
      p.rotation.y = Math.PI / 2;
      p.material = fenceMat;
      this.stadiumMeshes.push(p);
    });

    const benchMat = new BABYLON.StandardMaterial('trainingBenchMat', this.scene);
    benchMat.diffuseColor = new BABYLON.Color3(0.16, 0.19, 0.26);
    [-1, 1].forEach(side => {
      const bench = BABYLON.MeshBuilder.CreateBox('trainingBench_' + side, { width: 6, height: 1, depth: 1.4 }, this.scene);
      bench.position = new BABYLON.Vector3(side * 10, 0.5, -(halfW + 1.5));
      bench.material = benchMat;
      this.stadiumMeshes.push(bench);
    });

    this.standsOuterX = halfW + 4;
    this.standsOuterZ = halfL + 4;
  }

  // ─── Lumières ─────────────────────────────────────────────────────────

  private createLights(): void {
    // Juste à l'extérieur des tribunes réellement construites (variable selon la forme
    // du stade — un stade rond ou ovale s'étend bien plus loin qu'un stade rectangulaire),
    // sans ça les projecteurs se retrouvent à l'intérieur des tribunes.
    const halfL = this.standsOuterZ;
    const halfW = this.standsOuterX;
    const poleHeight = Math.max(15, halfW * 0.35);

    const nightMode = !!this.options.nightMode;

    // Halo lumineux sur les projecteurs (ambiance stade réel, cf. références)
    this.glowLayer = new BABYLON.GlowLayer('stadiumGlow', this.scene);
    this.glowLayer.intensity = nightMode ? 0.9 : 0.4;

    // Lumière ambiante
    const hemi = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), this.scene);
    hemi.intensity = FOOTBALL_CONFIG.GRAPHICS.AMBIENT_LIGHT_INTENSITY * (nightMode ? 0.4 : 1);
    hemi.diffuse = nightMode ? new BABYLON.Color3(0.4, 0.45, 0.6) : new BABYLON.Color3(0.8, 0.8, 0.9);
    hemi.groundColor = new BABYLON.Color3(0.3, 0.3, 0.4);

    // Lumière directionnelle (soleil/lune)
    const dir = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(0.5, -1, -0.3), this.scene);
    dir.intensity = FOOTBALL_CONFIG.GRAPHICS.DIRECTIONAL_LIGHT_INTENSITY * (nightMode ? 0.3 : 1);
    dir.diffuse = nightMode ? new BABYLON.Color3(0.5, 0.55, 0.75) : new BABYLON.Color3(0.9, 0.9, 1.0);
    // Composante spéculaire ajoutée (absente auparavant) : sans elle, aucun reflet net
    // sur la pelouse/les maillots quelle que soit l'intensité de la diffuse — c'est en
    // bonne partie ce qui distingue un rendu "net" façon retransmission d'un rendu plat.
    dir.specular = nightMode ? new BABYLON.Color3(0.5, 0.5, 0.6) : new BABYLON.Color3(1, 1, 0.95);

    if (FOOTBALL_CONFIG.GRAPHICS.SHADOWS) {
      const shadowGen = new BABYLON.ShadowGenerator(FOOTBALL_CONFIG.GRAPHICS.SHADOW_MAP_SIZE, dir);
      shadowGen.useBlurExponentialShadowMap = true;
      shadowGen.blurKernel = 32;
      // Stocker pour référence
      (this.scene.metadata ||= {}).shadowGenerator = shadowGen;
    }

    // Projecteurs (floodlights) aux 4 coins
    const floodMat = new BABYLON.StandardMaterial('floodMat', this.scene);
    floodMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    floodMat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    const lightPositions = [
      { x: -halfW - 3, z: -halfL - 3 },
      { x: halfW + 3, z: -halfL - 3 },
      { x: -halfW - 3, z: halfL + 3 },
      { x: halfW + 3, z: halfL + 3 }
    ];

    lightPositions.forEach((pos, i) => {
      // Pylône
      const pole = BABYLON.MeshBuilder.CreateCylinder('floodPole_' + i, {
        height: poleHeight,
        diameter: 0.3
      }, this.scene);
      pole.position = new BABYLON.Vector3(pos.x, poleHeight / 2, pos.z);
      pole.material = floodMat;
      this.lightMeshes.push(pole);

      // Tête du projecteur
      const head = BABYLON.MeshBuilder.CreateBox('floodHead_' + i, {
        width: 1.5,
        height: 0.5,
        depth: 1
      }, this.scene);
      head.position = new BABYLON.Vector3(pos.x, poleHeight, pos.z);
      head.material = floodMat;
      this.lightMeshes.push(head);

      // Projecteur directionnel visant le centre du terrain (plus réaliste et plus
      // efficace qu'une lumière ponctuelle omnidirectionnelle : un vrai projecteur de
      // stade éclaire la pelouse en priorité, pas dans toutes les directions à la fois).
      // Portée proportionnelle à la taille du stade pour bien couvrir la pelouse quelle
      // que soit la forme choisie.
      const towerPos = new BABYLON.Vector3(pos.x, poleHeight - 1, pos.z);
      const toCenter = BABYLON.Vector3.Zero().subtract(towerPos);
      const spot = new BABYLON.SpotLight(
        'floodLight_' + i,
        towerPos,
        toCenter.normalize(),
        Math.PI / 2.6,
        1.4,
        this.scene
      );
      spot.intensity = FOOTBALL_CONFIG.GRAPHICS.FLOODLIGHT_INTENSITY * (nightMode ? 3.2 : 1.1);
      spot.diffuse = new BABYLON.Color3(1, 0.98, 0.92);
      spot.range = Math.max(120, (halfW + halfL));
    });
  }

  // ─── Skybox ───────────────────────────────────────────────────────────

  private createSkybox(): void {
    if (!FOOTBALL_CONFIG.GRAPHICS.FOG) return;

    // Brouillard : plus dense sous la pluie/neige (visibilité réduite), plus sombre de nuit.
    // Densité par défaut (temps clair) réduite (0.003 -> 0.0018) : rendait le fond/les
    // tribunes lointaines voilées même par beau temps, contribuant au rendu terne signalé.
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = this.options.fogColorHex ? 0.006 : 0.0018;
    this.scene.fogColor = this.options.fogColorHex
      ? this.hexToColor3(this.options.fogColorHex)
      : new BABYLON.Color3(
        FOOTBALL_CONFIG.GRAPHICS.FOG_COLOR.r,
        FOOTBALL_CONFIG.GRAPHICS.FOG_COLOR.g,
        FOOTBALL_CONFIG.GRAPHICS.FOG_COLOR.b
      );

    // Skybox simple (plus sombre de nuit)
    const skyMat = new BABYLON.StandardMaterial('skyMat', this.scene);
    skyMat.diffuseColor = this.options.nightMode
      ? new BABYLON.Color3(0.02, 0.03, 0.07)
      : new BABYLON.Color3(0.05, 0.08, 0.15);
    skyMat.backFaceCulling = false;

    // Taille très supérieure à la distance de caméra max (FOOTBALL_CONFIG.CAMERA.MAX_DISTANCE,
    // jusqu'à 170) malgré infiniteDistance=true : si la caméra sort du volume de la boîte,
    // sa face proche se retrouve entre la caméra et la scène et bloque toute la vue (écran
    // noir) — bug resté invisible tant qu'aucun angle de caméra n'était testé aussi large.
    const sky = BABYLON.MeshBuilder.CreateBox('skybox', { size: 2000 }, this.scene);
    sky.material = skyMat;
    sky.infiniteDistance = true;
    this.stadiumMeshes.push(sky);
  }

  /**
   * Ajoute un mesh à la liste des ombres portées
   */
  addShadowCaster(mesh: BABYLON.Mesh): void {
    const shadowGen = (this.scene.metadata as any)?.shadowGenerator;
    if (shadowGen) {
      shadowGen.addShadowCaster(mesh);
    }
  }

  /** "Terrain seul" (menu contextuel) : masque tribunes/toit/projecteurs, garde la pelouse et les buts */
  setStandsVisible(visible: boolean): void {
    [...this.stadiumMeshes, ...this.lightMeshes].forEach(m => { m.setEnabled(visible); });
  }
}
