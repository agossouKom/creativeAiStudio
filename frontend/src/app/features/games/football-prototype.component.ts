import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as BABYLON from '@babylonjs/core';
import * as RAPIER from '@dimforge/rapier3d-compat';

interface TeamMate {
  meshes: BABYLON.Mesh[];
  body: RAPIER.RigidBody;
  role: 'defender' | 'midfielder' | 'forward';
  startPos: { x: number; z: number };
  animPhase: number;
  isMoving: boolean;
  leftLeg?: BABYLON.Mesh;
  rightLeg?: BABYLON.Mesh;
}

interface PlayerParts {
  meshes: BABYLON.Mesh[];
  body: RAPIER.RigidBody;
  leftLeg?: BABYLON.Mesh;
  rightLeg?: BABYLON.Mesh;
  animPhase: number;
  isMoving: boolean;
}

@Component({
  selector: 'app-football-prototype',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './football-prototype.component.html',
  styleUrls: ['./football-prototype.component.css']
})
export class FootballPrototypeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  status = 'Initialisation…';
  score = { home: 0, away: 0 };
  matchTime = 0;
  matchPeriod: '1ère' | 'mi-temps' | '2ème' | 'fini' = '1ère';
  matchLength = 180;

  private engine?: BABYLON.Engine;
  private scene?: BABYLON.Scene;
  private camera?: BABYLON.ArcRotateCamera;
  private world?: RAPIER.World;
  private player!: PlayerParts;
  private ballBody?: RAPIER.RigidBody;
  private ballMesh?: BABYLON.Mesh;
  private keeper!: PlayerParts;
  private opponent!: PlayerParts;
  private teamMates: TeamMate[] = [];
  private allPlayerParts: Array<{ meshes: BABYLON.Mesh[]; body: RAPIER.RigidBody }> = [];
  private inputState = {
    forward: false,
    backward: false,
    left: false,
    right: false
  };
  private goalCooldown = false;
  private lastTime = 0;
  private matchRunning = false;
  private activeMateIndex = 0;

  private readonly GOAL_WIDTH = 1.1;
  private readonly GOAL_DEPTH = 7.6;
  private readonly FIELD_LENGTH = 16;
  private readonly FIELD_WIDTH = 24;
  private readonly PLAYER_SPEED = 3.2;
  private readonly BALL_KICK_FORCE = 6.0;
  private readonly PASS_FORCE = 5.5;

  private readonly playerStart = { x: 0.0, y: 0.9, z: 2.5 };
  private readonly ballStart = { x: 0.0, y: 3.0, z: 0.0 };
  private readonly keeperStart = { x: 0.0, y: 0.9, z: -7.2 };
  private readonly opponentStart = { x: 0.0, y: 0.9, z: -2.0 };

  private readonly matePositions = [
    { x: -2.5, z: 1.0, role: 'defender' as const },
    { x: 2.5, z: 1.0, role: 'defender' as const },
    { x: -1.5, z: -0.5, role: 'midfielder' as const },
    { x: 1.5, z: -0.5, role: 'midfielder' as const },
    { x: 0.0, z: -1.5, role: 'forward' as const },
  ];

  async ngAfterViewInit(): Promise<void> {
    const canvas = this.canvasRef.nativeElement;

    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.09, 0.16, 0.28, 1.0);

    this.camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3.2,
      18,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    this.camera.attachControl(canvas, false);
    this.camera.lowerRadiusLimit = 8;
    this.camera.upperRadiusLimit = 35;
    this.camera.wheelPrecision = 40;
    this.camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');

    new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), this.scene);

    this.createArena();

    await RAPIER.init();
    this.world = new RAPIER.World(new RAPIER.Vector3(0.0, -9.81, 0.0));

    this.createPhysicsBodies();

    this.lastTime = performance.now();
    this.matchRunning = true;

    this.engine.runRenderLoop(() => {
      if (!this.scene || !this.world) return;

      const now = performance.now();
      const dt = (now - this.lastTime) / 1000;
      this.lastTime = now;

      this.updateMatchClock(dt);
      this.applyPlayerInput();
      this.updateOpponentAI(dt);
      this.updateKeeperAI(dt);
      this.updateTeamMates(dt);
      this.animatePlayers(dt);
      this.world.step();
      this.syncPhysics();
      this.updateCameraTarget();
      this.checkGoal();
      this.scene.render();
    });

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.status = '🔵 Vous (bleu) · WASD pour bouger · Espace tirer · X passer';
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.engine?.dispose();
    this.scene?.dispose();
  }

  // ─── Temps du match ─────────────────────────────────────────────────────

  private updateMatchClock(dt: number): void {
    if (!this.matchRunning) return;

    this.matchTime += dt;

    if (this.matchPeriod === '1ère' && this.matchTime >= this.matchLength) {
      this.matchPeriod = 'mi-temps';
      this.matchRunning = false;
      this.status = `⏸️ Mi-temps ! Score ${this.score.home} - ${this.score.away}. Reprise dans 3s…`;
      setTimeout(() => {
        this.matchTime = 0;
        this.matchPeriod = '2ème';
        this.matchRunning = true;
        this.resetPositions();
        this.status = '⏱️ 2ème mi-temps !';
      }, 3000);
    } else if (this.matchPeriod === '2ème' && this.matchTime >= this.matchLength) {
      this.matchPeriod = 'fini';
      this.matchRunning = false;
      const winner = this.score.home > this.score.away ? '🏆 Vous gagnez !' :
                     this.score.home < this.score.away ? '😔 Défaite…' : '🤝 Match nul !';
      this.status = `⏱️ Match terminé ! ${this.score.home} - ${this.score.away} ${winner}`;
    }
  }

  get formattedTime(): string {
    const total = Math.floor(this.matchTime);
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  // ─── Construction du terrain ────────────────────────────────────────────

  private createArena(): void {
    if (!this.scene) return;

    // Terrain avec bandes alternées
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: this.FIELD_WIDTH, height: this.FIELD_LENGTH, subdivisions: 8 }, this.scene);
    ground.receiveShadows = true;
    ground.position.y = 0;

    const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.13, 0.56, 0.24);
    groundMaterial.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    ground.material = groundMaterial;

    // Bandes de pelouse alternées
    for (let i = -7; i <= 7; i += 2) {
      const stripe = BABYLON.MeshBuilder.CreateGround(`stripe_${i}`, { width: 1.5, height: this.FIELD_LENGTH }, this.scene);
      stripe.position = new BABYLON.Vector3(i * 0.75, 0.005, 0);
      const stripeMat = new BABYLON.StandardMaterial(`stripeMat_${i}`, this.scene);
      stripeMat.diffuseColor = new BABYLON.Color3(0.11, 0.50, 0.21);
      stripeMat.alpha = 0.3;
      stripe.material = stripeMat;
      stripe.isPickable = false;
    }

    // Lignes du terrain
    this.createFieldLines();

    // But adverse (devant, z négatif)
    this.createGoal('goalA', 0, 0.9, -this.GOAL_DEPTH);
    // But du joueur (derrière, z positif)
    this.createGoal('goalB', 0, 0.9, this.GOAL_DEPTH);

    // Projecteurs
    this.createFloodlights();

    this.scene.onPointerDown = () => {
      this.kickBallTowardsGoal();
    };
  }

  private createFieldLines(): void {
    if (!this.scene) return;
    const hw = this.FIELD_WIDTH / 2;
    const hl = this.FIELD_LENGTH / 2;
    const lineMat = new BABYLON.StandardMaterial('fieldLineMat', this.scene);
    lineMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    lineMat.alpha = 0.6;

    // Ligne médiane
    const midLine = BABYLON.MeshBuilder.CreatePlane('midLine', { width: this.FIELD_WIDTH, height: 0.05 }, this.scene);
    midLine.position = new BABYLON.Vector3(0, 0.02, 0);
    midLine.rotation.x = Math.PI / 2;
    midLine.material = lineMat;

    // Cercle central
    const centerCircle = BABYLON.MeshBuilder.CreateDisc('centerCircle', { radius: 2.5, tessellation: 32 }, this.scene);
    centerCircle.position = new BABYLON.Vector3(0, 0.02, 0);
    centerCircle.rotation.x = Math.PI / 2;
    const circleMat = new BABYLON.StandardMaterial('circleMat', this.scene);
    circleMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    circleMat.alpha = 0.4;
    circleMat.wireframe = true;
    centerCircle.material = circleMat;

    // Surfaces de réparation (grandes surfaces)
    const penaltyW = 5.0;
    const penaltyD = 2.5;
    for (let side = -1; side <= 1; side += 2) {
      const box = BABYLON.MeshBuilder.CreatePlane(`penaltyBox_${side}`, { width: penaltyW, height: penaltyD }, this.scene);
      box.position = new BABYLON.Vector3(0, 0.02, side * (hl - penaltyD / 2));
      box.rotation.x = Math.PI / 2;
      const boxMat = new BABYLON.StandardMaterial(`penaltyBoxMat_${side}`, this.scene);
      boxMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
      boxMat.alpha = 0.3;
      boxMat.wireframe = true;
      box.material = boxMat;
    }

    // Surfaces de but (petites surfaces)
    const goalAreaW = 3.0;
    const goalAreaD = 1.2;
    for (let side = -1; side <= 1; side += 2) {
      const box = BABYLON.MeshBuilder.CreatePlane(`goalArea_${side}`, { width: goalAreaW, height: goalAreaD }, this.scene);
      box.position = new BABYLON.Vector3(0, 0.02, side * (hl - goalAreaD / 2));
      box.rotation.x = Math.PI / 2;
      const boxMat = new BABYLON.StandardMaterial(`goalAreaMat_${side}`, this.scene);
      boxMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
      boxMat.alpha = 0.25;
      boxMat.wireframe = true;
      box.material = boxMat;
    }

    // Corners
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        const corner = BABYLON.MeshBuilder.CreateDisc(`corner_${sx}_${sz}`, { radius: 0.6, tessellation: 16, arc: Math.PI / 2 }, this.scene);
        corner.position = new BABYLON.Vector3(sx * (hw - 0.1), 0.02, sz * (hl - 0.1));
        corner.rotation.x = Math.PI / 2;
        corner.rotation.z = sx * sz > 0 ? Math.PI / 2 : 0;
        const cornerMat = new BABYLON.StandardMaterial(`cornerMat_${sx}_${sz}`, this.scene);
        cornerMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
        cornerMat.alpha = 0.4;
        cornerMat.wireframe = true;
        corner.material = cornerMat;
      }
    }
  }

  private createGoal(name: string, x: number, y: number, z: number): void {
    if (!this.scene) return;

    const goalMat = new BABYLON.StandardMaterial(name + 'Mat', this.scene);
    goalMat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
    goalMat.emissiveColor = new BABYLON.Color3(0.14, 0.14, 0.14);

    // Poteaux
    for (let side = -1; side <= 1; side += 2) {
      const post = BABYLON.MeshBuilder.CreateCylinder(name + 'post' + side, { height: 1.8, diameter: 0.08 }, this.scene);
      post.position = new BABYLON.Vector3(x + side * 1.1, y, z);
      post.material = goalMat;
    }

    // Barre transversale
    const bar = BABYLON.MeshBuilder.CreateBox(name + 'bar', { width: 2.2, height: 0.08, depth: 0.08 }, this.scene);
    bar.position = new BABYLON.Vector3(x, y + 0.9, z);
    bar.material = goalMat;

    // Filet
    const netMat = new BABYLON.StandardMaterial(name + 'netMat', this.scene);
    netMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    netMat.alpha = 0.15;
    netMat.wireframe = true;

    const net = BABYLON.MeshBuilder.CreateBox(name + 'net', { width: 2.2, height: 1.8, depth: 0.6 }, this.scene);
    net.position = new BABYLON.Vector3(x, y, z - (z > 0 ? 0.4 : -0.4));
    net.material = netMat;
    net.scaling = new BABYLON.Vector3(1, 1, 0.3);
  }

  private createFloodlights(): void {
    const scene = this.scene;
    if (!scene) return;
    const hw = this.FIELD_WIDTH / 2 + 1;
    const hl = this.FIELD_LENGTH / 2 + 1;

    const positions = [
      { x: -hw, z: -hl }, { x: hw, z: -hl },
      { x: -hw, z: hl }, { x: hw, z: hl }
    ];

    positions.forEach((pos, i) => {
      const pole = BABYLON.MeshBuilder.CreateCylinder(`floodlight_pole_${i}`, { height: 4, diameter: 0.1 }, scene);
      pole.position = new BABYLON.Vector3(pos.x, 2, pos.z);
      const poleMat = new BABYLON.StandardMaterial(`poleMat_${i}`, scene);
      poleMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
      pole.material = poleMat;

      const light = new BABYLON.PointLight(`floodlight_${i}`, new BABYLON.Vector3(pos.x, 4, pos.z), scene);
      light.intensity = 0.3;
      light.diffuse = new BABYLON.Color3(1, 0.95, 0.8);
    });
  }

  // ─── Création d'un joueur humanoïde ─────────────────────────────────────

  private createHumanoidPlayer(
    name: string,
    bodyColor: BABYLON.Color3,
    skinColor: BABYLON.Color3,
    pos: { x: number; y: number; z: number },
    isKeeper: boolean = false
  ): PlayerParts {
    const scene = this.scene;
    if (!scene) throw new Error('Scene not initialized');
    const meshes: BABYLON.Mesh[] = [];
    const parent = new BABYLON.TransformNode(name + '_root', scene);

    // Corps (torso)
    const torso = BABYLON.MeshBuilder.CreateBox(name + '_torso', { width: 0.5, height: 0.6, depth: 0.3 }, scene);
    torso.position = new BABYLON.Vector3(0, 0.7, 0);
    torso.parent = parent;
    const torsoMat = new BABYLON.StandardMaterial(name + '_torsoMat', scene);
    torsoMat.diffuseColor = bodyColor;
    torsoMat.emissiveColor = new BABYLON.Color3(bodyColor.r * 0.2, bodyColor.g * 0.2, bodyColor.b * 0.2);
    torso.material = torsoMat;
    meshes.push(torso);

    // Tête
    const head = BABYLON.MeshBuilder.CreateSphere(name + '_head', { diameter: 0.3, segments: 8 }, scene);
    head.position = new BABYLON.Vector3(0, 1.1, 0);
    head.parent = parent;
    const headMat = new BABYLON.StandardMaterial(name + '_headMat', scene);
    headMat.diffuseColor = skinColor;
    head.material = headMat;
    meshes.push(head);

    // Bras gauche
    const leftArm = BABYLON.MeshBuilder.CreateBox(name + '_leftArm', { width: 0.1, height: 0.5, depth: 0.1 }, scene);
    leftArm.position = new BABYLON.Vector3(-0.3, 0.8, 0);
    leftArm.parent = parent;
    const armMat = new BABYLON.StandardMaterial(name + '_armMat', scene);
    armMat.diffuseColor = skinColor;
    leftArm.material = armMat;
    meshes.push(leftArm);

    // Bras droit
    const rightArm = BABYLON.MeshBuilder.CreateBox(name + '_rightArm', { width: 0.1, height: 0.5, depth: 0.1 }, scene);
    rightArm.position = new BABYLON.Vector3(0.3, 0.8, 0);
    rightArm.parent = parent;
    rightArm.material = armMat;
    meshes.push(rightArm);

    // Jambes
    const legMat = new BABYLON.StandardMaterial(name + '_legMat', scene);
    legMat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.2);

    const leftLeg = BABYLON.MeshBuilder.CreateBox(name + '_leftLeg', { width: 0.12, height: 0.5, depth: 0.12 }, scene);
    leftLeg.position = new BABYLON.Vector3(-0.12, 0.25, 0);
    leftLeg.parent = parent;
    leftLeg.material = legMat;
    meshes.push(leftLeg);

    const rightLeg = BABYLON.MeshBuilder.CreateBox(name + '_rightLeg', { width: 0.12, height: 0.5, depth: 0.12 }, scene);
    rightLeg.position = new BABYLON.Vector3(0.12, 0.25, 0);
    rightLeg.parent = parent;
    rightLeg.material = legMat;
    meshes.push(rightLeg);

    // Position initiale
    parent.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);

    // Corps physique
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setGravityScale(0.0);

    const body = this.world!.createRigidBody(bodyDesc);
    const colliderSize = isKeeper
      ? RAPIER.ColliderDesc.cuboid(0.4, 0.9, 0.25)
      : RAPIER.ColliderDesc.cuboid(0.3, 0.9, 0.3);
    this.world!.createCollider(colliderSize, body);
    body.lockRotations(true, true);

    this.allPlayerParts.push({ meshes, body });

    return {
      meshes,
      body,
      leftLeg,
      rightLeg,
      animPhase: 0,
      isMoving: false
    };
  }

  // ─── Corps physiques ────────────────────────────────────────────────────

  private createPhysicsBodies(): void {
    const scene = this.scene!;
    const world = this.world!;
    if (!scene || !world) return;

    // Sol
    const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    world.createCollider(RAPIER.ColliderDesc.cuboid(this.FIELD_WIDTH / 2, 0.1, this.FIELD_LENGTH / 2), groundBody);

    // Ballon
    this.ballMesh = BABYLON.MeshBuilder.CreateSphere('ball', { diameter: 0.6, segments: 16 }, scene);
    this.ballMesh.position = new BABYLON.Vector3(this.ballStart.x, this.ballStart.y, this.ballStart.z);
    const ballMat = new BABYLON.StandardMaterial('ballMat', scene);
    ballMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    ballMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
    this.ballMesh.material = ballMat;

    this.ballBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(this.ballStart.x, this.ballStart.y, this.ballStart.z)
    );
    world.createCollider(RAPIER.ColliderDesc.ball(0.3), this.ballBody);

    // Joueur principal
    this.player = this.createHumanoidPlayer(
      'player',
      new BABYLON.Color3(0.2, 0.35, 0.95),
      new BABYLON.Color3(0.9, 0.7, 0.5),
      this.playerStart
    );

    // Coéquipiers
    this.matePositions.forEach((pos, i) => {
      const mate = this.createHumanoidPlayer(
        `mate_${i}`,
        new BABYLON.Color3(0.3, 0.5, 1.0),
        new BABYLON.Color3(0.9, 0.7, 0.5),
        { x: pos.x, y: 0.85, z: pos.z }
      );

      this.teamMates.push({
        meshes: mate.meshes,
        body: mate.body,
        role: pos.role,
        startPos: { x: pos.x, z: pos.z },
        animPhase: 0,
        isMoving: false,
        leftLeg: mate.leftLeg,
        rightLeg: mate.rightLeg
      });
    });

    // Gardien adverse
    this.keeper = this.createHumanoidPlayer(
      'keeper',
      new BABYLON.Color3(1, 0.8, 0.1),
      new BABYLON.Color3(0.9, 0.7, 0.5),
      this.keeperStart,
      true
    );

    // Adversaire (défenseur)
    this.opponent = this.createHumanoidPlayer(
      'opponent',
      new BABYLON.Color3(0.95, 0.2, 0.2),
      new BABYLON.Color3(0.9, 0.7, 0.5),
      this.opponentStart
    );
  }

  // ─── Animation des jambes ──────────────────────────────────────────────

  private animatePlayers(dt: number): void {
    const animate = (parts: { leftLeg?: BABYLON.Mesh; rightLeg?: BABYLON.Mesh; isMoving: boolean; animPhase: number }) => {
      if (!parts.leftLeg || !parts.rightLeg) return;

      if (parts.isMoving) {
        parts.animPhase += dt * 8;
        const swing = Math.sin(parts.animPhase) * 0.3;
        parts.leftLeg.position.x = -0.12 + swing;
        parts.rightLeg.position.x = 0.12 - swing;
      } else {
        parts.leftLeg.position.x = -0.12;
        parts.rightLeg.position.x = 0.12;
        parts.animPhase = 0;
      }
    };

    animate(this.player);
    animate(this.keeper);
    animate(this.opponent);
    this.teamMates.forEach(mate => animate(mate));
  }

  // ─── IA du gardien ──────────────────────────────────────────────────────

  private keeperTimer = 0;

  private updateKeeperAI(dt: number): void {
    if (!this.keeper.body || !this.ballBody) return;

    const ballPos = this.ballBody.translation();
    const keeperPos = this.keeper.body.translation();

    this.keeper.isMoving = false;

    if (ballPos.z < -4) {
      const targetX = Math.max(-1.0, Math.min(1.0, ballPos.x * 0.8));
      const speed = 4.0;
      const dx = targetX - keeperPos.x;
      this.keeper.body.setLinvel({ x: dx * speed, y: 0, z: 0 }, true);
      this.keeper.isMoving = Math.abs(dx) > 0.1;
    } else {
      this.keeperTimer += dt;
      const sway = Math.sin(this.keeperTimer * 1.5) * 0.3;
      const targetX = sway;
      const dx = targetX - keeperPos.x;
      this.keeper.body.setLinvel({ x: dx * 2.0, y: 0, z: 0 }, true);
      this.keeper.isMoving = Math.abs(dx) > 0.05;
    }
  }

  // ─── IA de l'adversaire ─────────────────────────────────────────────────

  private updateOpponentAI(dt: number): void {
    if (!this.opponent.body || !this.ballBody || !this.player.body) return;

    const ballPos = this.ballBody.translation();
    const oppPos = this.opponent.body.translation();
    const playerPos = this.player.body.translation();

    this.opponent.isMoving = false;

    if (ballPos.z < 0) {
      const dx = ballPos.x - oppPos.x;
      const dz = ballPos.z - oppPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.5) {
        const speed = 2.8;
        this.opponent.body.setLinvel({
          x: (dx / dist) * speed,
          y: 0,
          z: (dz / dist) * speed
        }, true);
        this.opponent.isMoving = true;
      } else {
        this.opponent.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        if (dist < 1.0) {
          this.ballBody.applyImpulse({
            x: (ballPos.x - playerPos.x) * 0.5,
            y: 0.5,
            z: 3.0
          }, true);
        }
      }
    } else {
      const targetZ = -2.0;
      const dz = targetZ - oppPos.z;
      if (Math.abs(dz) > 0.3) {
        this.opponent.body.setLinvel({ x: 0, y: 0, z: dz * 2.0 }, true);
        this.opponent.isMoving = true;
      } else {
        this.opponent.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  }

  // ─── IA des coéquipiers ─────────────────────────────────────────────────

  private updateTeamMates(dt: number): void {
    if (!this.ballBody || !this.player.body) return;

    const ballPos = this.ballBody.translation();

    this.teamMates.forEach((mate) => {
      const matePos = mate.body.translation();
      let targetX = mate.startPos.x;
      let targetZ = mate.startPos.z;

      if (ballPos.z < 2) {
        if (mate.role === 'forward') {
          targetZ = ballPos.z - 1.0;
          targetX = ballPos.x + (mate.startPos.x * 0.3);
        } else if (mate.role === 'midfielder') {
          targetZ = ballPos.z * 0.5;
          targetX = mate.startPos.x + ballPos.x * 0.2;
        }
      }

      targetX = Math.max(-this.FIELD_WIDTH / 2 + 1, Math.min(this.FIELD_WIDTH / 2 - 1, targetX));
      targetZ = Math.max(-this.FIELD_LENGTH / 2 + 1, Math.min(this.FIELD_LENGTH / 2 - 1, targetZ));

      const dx = targetX - matePos.x;
      const dz = targetZ - matePos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.3) {
        const speed = 2.0;
        mate.body.setLinvel({
          x: (dx / dist) * speed,
          y: 0,
          z: (dz / dist) * speed
        }, true);
        mate.isMoving = true;
      } else {
        mate.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        mate.isMoving = false;
      }
    });
  }

  // ─── Tir ────────────────────────────────────────────────────────────────

  private kickBallTowardsGoal(): void {
    if (!this.ballBody) return;
    const vel = this.ballBody.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    if (speed > 1.0) return;

    this.ballBody.applyImpulse({ x: 0.0, y: 1.2, z: this.BALL_KICK_FORCE }, true);
    this.status = '⚡ Tir !';
  }

  // ─── Passe ──────────────────────────────────────────────────────────────

  private passBall(): void {
    if (!this.ballBody || this.teamMates.length === 0) return;

    const ballPos = this.ballBody.translation();

    this.activeMateIndex = (this.activeMateIndex + 1) % this.teamMates.length;
    const target = this.teamMates[this.activeMateIndex];
    const targetPos = target.body.translation();

    const dx = targetPos.x - ballPos.x;
    const dz = targetPos.z - ballPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.5) {
      const force = Math.min(this.PASS_FORCE, dist * 1.5);
      this.ballBody.applyImpulse({
        x: (dx / dist) * force,
        y: 0.5,
        z: (dz / dist) * force
      }, true);
      this.status = `🎯 Passe vers ${target.role} !`;
    }
  }

  // ─── Caméra ─────────────────────────────────────────────────────────────

  private updateCameraTarget(): void {
    const root = this.scene?.getTransformNodeByName('player_root');
    if (this.camera && root) {
      this.camera.setTarget(root.position);
    }
  }

  // ─── Détection de but ───────────────────────────────────────────────────

  private checkGoal(): void {
    if (!this.ballBody || this.goalCooldown) return;

    const ballPos = this.ballBody.translation();
    const x = ballPos.x;
    const z = ballPos.z;

    const inGoalA = z < -this.GOAL_DEPTH && Math.abs(x) < this.GOAL_WIDTH;
    const inGoalB = z > this.GOAL_DEPTH && Math.abs(x) < this.GOAL_WIDTH;

    if (inGoalA || inGoalB) {
      this.goalCooldown = true;
      const scorer = inGoalA ? 'home' : 'away';
      this.score[scorer] += 1;
      this.status = `⚽ BUT ! Score ${this.score.home} - ${this.score.away}`;
      this.resetPositions();
      setTimeout(() => {
        this.goalCooldown = false;
        this.status = '🔵 WASD bouger · Espace tirer · X passer';
      }, 1500);
    }

    if (Math.abs(x) > this.FIELD_WIDTH / 2 || Math.abs(z) > this.FIELD_LENGTH / 2) {
      if (!this.goalCooldown) {
        this.goalCooldown = true;
        this.status = '🔄 Remise en jeu…';
        this.resetPositions();
        setTimeout(() => {
          this.goalCooldown = false;
        }, 1000);
      }
    }
  }

  // ─── Réinitialisation ───────────────────────────────────────────────────

  private resetPositions(): void {
    if (!this.scene || !this.world) return;

    const resetBody = (body: RAPIER.RigidBody | undefined, pos: { x: number; y: number; z: number }) => {
      if (body) {
        body.setTranslation(new RAPIER.Vector3(pos.x, pos.y, pos.z), true);
        body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
        body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);
      }
    };

    const resetRoot = (name: string, pos: { x: number; y: number; z: number }) => {
      const root = this.scene?.getTransformNodeByName(name + '_root');
      if (root) root.position.set(pos.x, pos.y, pos.z);
    };

    resetBody(this.ballBody, this.ballStart);
    resetBody(this.player.body, this.playerStart);
    resetBody(this.keeper.body, this.keeperStart);
    resetBody(this.opponent.body, this.opponentStart);

    resetRoot('player', this.playerStart);
    resetRoot('keeper', this.keeperStart);
    resetRoot('opponent', this.opponentStart);

    this.teamMates.forEach((mate, i) => {
      const pos = this.matePositions[i];
      resetBody(mate.body, { x: pos.x, y: 0.85, z: pos.z });
      resetRoot(`mate_${i}`, { x: pos.x, y: 0.85, z: pos.z });
    });
  }

  // ─── Synchronisation physique ───────────────────────────────────────────

  private syncPhysics(): void {
    this.allPlayerParts.forEach((entry) => {
      const translation = entry.body.translation();
      // Le root TransformNode suit le body physique
      const rootName = entry.meshes[0]?.name.replace(/_(torso|head|leftArm|rightArm|leftLeg|rightLeg)$/, '_root');
      const root = this.scene?.getTransformNodeByName(rootName || '');
      if (root) {
        root.position.set(translation.x, translation.y, translation.z);
      }
    });

    // Ballon
    if (this.ballBody && this.ballMesh) {
      const t = this.ballBody.translation();
      this.ballMesh.position.set(t.x, t.y, t.z);
      const r = this.ballBody.rotation();
      this.ballMesh.rotationQuaternion = new BABYLON.Quaternion(r.x, r.y, r.z, r.w);
    }
  }

  // ─── Contrôles joueur ───────────────────────────────────────────────────

  private applyPlayerInput(): void {
    if (!this.player.body) return;

    const speed = this.PLAYER_SPEED;
    const direction = new RAPIER.Vector3(
      (this.inputState.right ? 1 : 0) + (this.inputState.left ? -1 : 0),
      0,
      (this.inputState.backward ? 1 : 0) + (this.inputState.forward ? -1 : 0)
    );

    const norm = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (norm > 0) {
      direction.x = (direction.x / norm) * speed;
      direction.z = (direction.z / norm) * speed;
    }

    this.player.body.setLinvel(direction, true);
    this.player.isMoving = norm > 0;
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (['w', 'W', 's', 'S', 'a', 'A', 'd', 'D', ' ', 'Tab', 'x', 'X'].includes(event.key)) {
      event.preventDefault();
    }

    switch (event.key.toLowerCase()) {
      case 'w': this.inputState.forward = true; break;
      case 's': this.inputState.backward = true; break;
      case 'a': this.inputState.left = true; break;
      case 'd': this.inputState.right = true; break;
      case ' ': this.kickBallTowardsGoal(); break;
      case 'x': this.passBall(); break;
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    switch (event.key.toLowerCase()) {
      case 'w': this.inputState.forward = false; break;
      case 's': this.inputState.backward = false; break;
      case 'a': this.inputState.left = false; break;
      case 'd': this.inputState.right = false; break;
    }
  };

  private handleResize = () => {
    this.engine?.resize();
  };
}
