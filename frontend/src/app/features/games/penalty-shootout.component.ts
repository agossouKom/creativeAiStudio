import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as BABYLON from '@babylonjs/core';
import * as RAPIER from '@dimforge/rapier3d-compat';

interface PenaltyAttempt {
  id: number;
  scored: boolean;
  power: number;
  direction: number;
  height: number;
}

@Component({
  selector: 'app-penalty-shootout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './penalty-shootout.component.html',
  styleUrls: ['./penalty-shootout.component.css']
})
export class PenaltyShootoutComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererCanvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  // ─── État du jeu ──────────────────────────────────────────────────────────
  status = 'Préparez-vous à tirer…';
  playerScore = 0;
  aiScore = 0;
  currentRound = 1;
  maxRounds = 5;
  isPlayerTurn = true;
  isAiming = true;
  isFlying = false;
  showResult = false;
  lastResult: 'but' | 'raté' | 'gardien' | null = null;
  history: PenaltyAttempt[] = [];
  combo = 0;
  bestStreak = 0;
  matchOver = false;
  matchWinner: 'player' | 'ai' | null = null;

  // Paramètres de visée
  aimX = 0;    // -100 (gauche) à +100 (droite)
  aimY = 30;   // 0 (bas) à 100 (haut)
  power = 70;  // 0 à 100

  // ─── Babylon / Rapier ─────────────────────────────────────────────────────
  private engine?: BABYLON.Engine;
  private scene?: BABYLON.Scene;
  private camera?: BABYLON.ArcRotateCamera;
  private world?: RAPIER.World;
  private ballBody?: RAPIER.RigidBody;
  private ballMesh?: BABYLON.Mesh;
  private keeperBody?: RAPIER.RigidBody;
  private keeperMesh?: BABYLON.Mesh;
  private bodies: Array<{ mesh: BABYLON.Mesh; body: RAPIER.RigidBody }> = [];
  private keeperTimer = 0;
  private keeperDirection = 1;
  private readonly GOAL_WIDTH = 2.2;
  private readonly GOAL_HEIGHT = 1.8;
  private readonly GOAL_DEPTH = 7.8;
  private readonly PENALTY_SPOT = { x: 0, y: 0.5, z: 3.5 };
  private readonly KEEPER_START = { x: 0, y: 0.9, z: -this.GOAL_DEPTH + 0.8 };

  // ─── Cycle de vie ─────────────────────────────────────────────────────────

  async ngAfterViewInit(): Promise<void> {
    const canvas = this.canvasRef.nativeElement;

    this.engine = new BABYLON.Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.06, 0.12, 0.22, 1.0);

    // Caméra style penalty
    this.camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 3.2,
      12,
      new BABYLON.Vector3(0, 0.5, 0),
      this.scene
    );
    this.camera.attachControl(canvas, false);
    this.camera.lowerRadiusLimit = 6;
    this.camera.upperRadiusLimit = 18;
    this.camera.lowerBetaLimit = 0.3;
    this.camera.upperBetaLimit = Math.PI / 2.1;
    // Désactiver les contrôles clavier de Babylon pour éviter les conflits avec @HostListener
    this.camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');

    // Lumières
    const hemi = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.7;
    const dir = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(0.5, -1, -0.5), this.scene);
    dir.intensity = 0.5;

    await RAPIER.init();
    this.world = new RAPIER.World(new RAPIER.Vector3(0.0, -9.81, 0.0));

    this.buildArena();
    this.buildKeeper();
    this.resetBall();

    // Boucle de rendu
    this.engine.runRenderLoop(() => {
      if (!this.scene || !this.world) return;
      this.updateKeeper();
      this.world.step();
      this.syncPhysics();
      this.checkBallState();
      this.scene.render();
    });

    window.addEventListener('resize', this.handleResize);
    this.status = '🎯 Visez avec les flèches (← → ↑ ↓), puissance avec W/S. Espace pour tirer !';
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.handleResize);
    this.engine?.dispose();
    this.scene?.dispose();
  }

  // ─── Construction du terrain ──────────────────────────────────────────────

  private buildArena(): void {
    if (!this.scene || !this.world) return;

    // Sol
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 16, height: 14, subdivisions: 2 }, this.scene);
    const groundMat = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.13, 0.56, 0.24);
    ground.material = groundMat;
    ground.receiveShadows = true;

    const groundBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(8, 0.1, 7), groundBody);
    this.bodies.push({ mesh: ground, body: groundBody });

    // Surface de but
    const box = BABYLON.MeshBuilder.CreateGround('penaltyBox', { width: 8, height: 6, subdivisions: 1 }, this.scene);
    const boxMat = new BABYLON.StandardMaterial('boxMat', this.scene);
    boxMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    boxMat.alpha = 0.08;
    boxMat.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.15);
    box.material = boxMat;
    box.position = new BABYLON.Vector3(0, 0.01, -4);

    // But
    const goalMat = new BABYLON.StandardMaterial('goalMat', this.scene);
    goalMat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
    goalMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    // Poteaux
    const postPositions = [
      { x: -this.GOAL_WIDTH / 2, y: this.GOAL_HEIGHT / 2, z: -this.GOAL_DEPTH },
      { x: this.GOAL_WIDTH / 2, y: this.GOAL_HEIGHT / 2, z: -this.GOAL_DEPTH },
    ];
    postPositions.forEach((pos) => {
      const post = BABYLON.MeshBuilder.CreateCylinder('post', { height: this.GOAL_HEIGHT, diameter: 0.08 }, this.scene);
      post.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
      post.material = goalMat;
    });

    // Barre transversale
    const bar = BABYLON.MeshBuilder.CreateBox('crossbar', { width: this.GOAL_WIDTH, height: 0.08, depth: 0.08 }, this.scene);
    bar.position = new BABYLON.Vector3(0, this.GOAL_HEIGHT, -this.GOAL_DEPTH);
    bar.material = goalMat;

    // Filet
    const netMat = new BABYLON.StandardMaterial('netMat', this.scene);
    netMat.diffuseColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    netMat.alpha = 0.12;
    netMat.wireframe = true;

    const net = BABYLON.MeshBuilder.CreateBox('net', { width: this.GOAL_WIDTH, height: this.GOAL_HEIGHT, depth: 0.5 }, this.scene);
    net.position = new BABYLON.Vector3(0, this.GOAL_HEIGHT / 2, -this.GOAL_DEPTH - 0.25);
    net.material = netMat;
    net.scaling = new BABYLON.Vector3(1, 1, 0.3);

    // Point de penalty (cercle)
    const spotMat = new BABYLON.StandardMaterial('spotMat', this.scene);
    spotMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    spotMat.alpha = 0.3;
    const spot = BABYLON.MeshBuilder.CreateDisc('penaltySpot', { radius: 0.15 }, this.scene);
    spot.position = new BABYLON.Vector3(0, 0.02, this.PENALTY_SPOT.z);
    spot.material = spotMat;
  }

  private buildKeeper(): void {
    if (!this.scene || !this.world) return;

    const keeperMat = new BABYLON.StandardMaterial('keeperMat', this.scene);
    keeperMat.diffuseColor = new BABYLON.Color3(0.1, 0.7, 0.2);
    keeperMat.emissiveColor = new BABYLON.Color3(0.03, 0.1, 0.03);

    this.keeperMesh = BABYLON.MeshBuilder.CreateBox('keeper', { width: 0.8, height: 1.8, depth: 0.5 }, this.scene);
    this.keeperMesh.position = new BABYLON.Vector3(
      this.KEEPER_START.x, this.KEEPER_START.y, this.KEEPER_START.z
    );
    this.keeperMesh.material = keeperMat;

    // Bras
    const armMat = new BABYLON.StandardMaterial('armMat', this.scene);
    armMat.diffuseColor = new BABYLON.Color3(0.9, 0.7, 0.5);

    for (let side = -1; side <= 1; side += 2) {
      const arm = BABYLON.MeshBuilder.CreateBox(`arm_${side}`, { width: 0.12, height: 0.6, depth: 0.12 }, this.scene);
      arm.position = new BABYLON.Vector3(side * 0.5, 1.5, this.KEEPER_START.z);
      arm.material = armMat;
      this.bodies.push({ mesh: arm, body: this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed()) });
    }

    this.keeperBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(this.KEEPER_START.x, this.KEEPER_START.y, this.KEEPER_START.z)
        .setGravityScale(0.0)
    );
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.4, 0.9, 0.25), this.keeperBody);
    this.keeperBody.lockRotations(true, true);
    this.bodies.push({ mesh: this.keeperMesh, body: this.keeperBody });
  }

  private resetBall(): void {
    if (!this.scene || !this.world) return;

    if (this.ballMesh) {
      const idx = this.bodies.findIndex(b => b.mesh === this.ballMesh);
      if (idx >= 0) this.bodies.splice(idx, 1);
      this.ballMesh.dispose();
    }

    this.ballMesh = BABYLON.MeshBuilder.CreateSphere('ball', { diameter: 0.6, segments: 16 }, this.scene);
    this.ballMesh.position = new BABYLON.Vector3(this.PENALTY_SPOT.x, this.PENALTY_SPOT.y, this.PENALTY_SPOT.z);

    const ballMat = new BABYLON.StandardMaterial('ballMat', this.scene);
    ballMat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    ballMat.specularColor = new BABYLON.Color3(0.6, 0.6, 0.6);
    this.ballMesh.material = ballMat;

    this.ballBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(this.PENALTY_SPOT.x, this.PENALTY_SPOT.y, this.PENALTY_SPOT.z)
    );
    this.world.createCollider(RAPIER.ColliderDesc.ball(0.3), this.ballBody);
    this.bodies.push({ mesh: this.ballMesh, body: this.ballBody });
  }

  // ─── Logique du gardien ───────────────────────────────────────────────────

  private updateKeeper(): void {
    if (!this.keeperBody) return;

    if (this.isFlying) {
      // Pendant le tir, le gardien plonge aléatoirement
      return;
    }

    this.keeperTimer += 0.016;
    if (this.keeperTimer > 1.2) {
      this.keeperDirection *= -1;
      this.keeperTimer = 0;
    }

    const pos = this.keeperBody.translation();
    const targetX = Math.sin(this.keeperTimer * 2.5) * 1.2;
    this.keeperBody.setNextKinematicTranslation({
      x: targetX,
      y: pos.y,
      z: pos.z
    });
  }

  // ─── Tir du joueur ────────────────────────────────────────────────────────

  shoot(): void {
    if (!this.ballBody || this.isFlying || !this.isPlayerTurn || this.matchOver) return;

    this.isFlying = true;
    this.isAiming = false;

    // Calcul du tir basé sur la visée
    const powerFactor = 5 + (this.power / 100) * 10; // 5 à 15
    const angleRad = (this.aimX / 100) * Math.PI * 0.5; // -45° à +45°
    const heightFactor = 1.0 + (this.aimY / 100) * 3.0; // 1 à 4

    const dirX = Math.sin(angleRad) * powerFactor;
    const dirZ = -powerFactor * Math.cos(angleRad);
    const dirY = heightFactor;

    this.ballBody.applyImpulse({ x: dirX, y: dirY, z: dirZ }, true);

    this.status = `⚡ Tir ! ${this.power}% puissance, ${this.aimX > 0 ? 'droite' : this.aimX < 0 ? 'gauche' : 'centre'}`;
  }

  // ─── Tir de l'IA ──────────────────────────────────────────────────────────

  private aiShoot(): void {
    if (!this.ballBody || this.isFlying) return;

    this.isFlying = true;
    this.isAiming = false;

    // L'IA choisit aléatoirement sa direction
    const aiAimX = (Math.random() - 0.5) * 160; // -80 à +80
    const aiAimY = 20 + Math.random() * 60;      // 20 à 80
    const aiPower = 60 + Math.random() * 35;     // 60 à 95

    const powerFactor = 5 + (aiPower / 100) * 10;
    const angleRad = (aiAimX / 100) * Math.PI * 0.5;
    const heightFactor = 1.0 + (aiAimY / 100) * 3.0;

    const dirX = Math.sin(angleRad) * powerFactor;
    const dirZ = -powerFactor * Math.cos(angleRad);
    const dirY = heightFactor;

    this.ballBody.applyImpulse({ x: dirX, y: dirY, z: dirZ }, true);

    this.status = `🤖 L'IA tire…`;
  }

  // ─── Vérification du résultat ─────────────────────────────────────────────

  private checkBallState(): void {
    if (!this.ballBody || !this.keeperBody || !this.isFlying) return;

    const ballPos = this.ballBody.translation();
    const keeperPos = this.keeperBody.translation();
    const vel = this.ballBody.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    // But !
    if (ballPos.z < -this.GOAL_DEPTH - 0.5) {
      this.handleResult(true);
      return;
    }

    // Ballon arrêté ou lent dans la zone
    if (speed < 0.5 && ballPos.z < -2) {
      const inGoalX = Math.abs(ballPos.x) < this.GOAL_WIDTH / 2;
      const inGoalY = ballPos.y < this.GOAL_HEIGHT;

      if (ballPos.z < -this.GOAL_DEPTH + 0.5 && inGoalX && inGoalY) {
        this.handleResult(true);
      } else {
        this.handleResult(false);
      }
      return;
    }

    // Collision avec le gardien
    const dx = ballPos.x - keeperPos.x;
    const dz = ballPos.z - keeperPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 0.7 && ballPos.z < -this.GOAL_DEPTH + 1.5) {
      this.handleResult('gardien');
      return;
    }

    // Ballon sorti du cadre
    if (ballPos.z > 5 || Math.abs(ballPos.x) > 4 || ballPos.y > 5) {
      this.handleResult(false);
    }
  }

  private handleResult(result: boolean | 'gardien'): void {
    if (!this.isFlying) return;
    this.isFlying = false;

    const scored = result === true;
    const saved = result === 'gardien';

    if (this.isPlayerTurn) {
      if (scored) {
        this.playerScore++;
        this.combo++;
        if (this.combo > this.bestStreak) this.bestStreak = this.combo;
        this.lastResult = 'but';
        this.status = '⚽ BUT !!!';
      } else if (saved) {
        this.combo = 0;
        this.lastResult = 'gardien';
        this.status = '🧤 Arrêt du gardien !';
      } else {
        this.combo = 0;
        this.lastResult = 'raté';
        this.status = '❌ Raté !';
      }

      this.history.push({
        id: this.history.length + 1,
        scored,
        power: this.power,
        direction: this.aimX,
        height: this.aimY
      });
    } else {
      // Tour de l'IA
      if (scored) {
        this.aiScore++;
        this.status = '🤖 L\'IA marque !';
      } else if (saved) {
        this.status = '🧤 Vous arrêtez le tir !';
      } else {
        this.status = '❌ L\'IA rate !';
      }
    }

    this.showResult = true;

    setTimeout(() => {
      this.showResult = false;
      this.lastResult = null;
      this.isAiming = true;

      if (this.isPlayerTurn) {
        // Passer au tour de l'IA
        this.isPlayerTurn = false;
        this.status = '🤖 Au tour de l\'IA…';
        this.resetPositions();
        setTimeout(() => this.aiShoot(), 1500);
      } else {
        // Passer au round suivant
        this.isPlayerTurn = true;
        this.currentRound++;
        this.aimX = 0;
        this.aimY = 30;
        this.power = 70;

        if (this.currentRound > this.maxRounds) {
          this.endMatch();
        } else {
          this.status = `🎯 Manche ${this.currentRound}/${this.maxRounds} - À vous !`;
          this.resetPositions();
        }
      }
    }, 2000);
  }

  private resetPositions(): void {
    this.resetBall();
    if (this.keeperBody) {
      this.keeperBody.setTranslation(
        new RAPIER.Vector3(this.KEEPER_START.x, this.KEEPER_START.y, this.KEEPER_START.z),
        true
      );
      this.keeperBody.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
    }
    this.keeperTimer = 0;
    this.keeperDirection = 1;
  }

  private endMatch(): void {
    this.matchOver = true;
    if (this.playerScore > this.aiScore) {
      this.matchWinner = 'player';
      this.status = '🏆 Vous avez gagné la séance de tirs au but !';
    } else if (this.aiScore > this.playerScore) {
      this.matchWinner = 'ai';
      this.status = '😔 L\'IA remporte la séance…';
    } else {
      // Égalité → mort subite
      this.maxRounds++;
      this.status = `⚖️ Égalité ${this.playerScore}-${this.aiScore} ! Mort subite !`;
      this.isPlayerTurn = true;
      this.matchOver = false;
      this.resetPositions();
    }
  }

  restartMatch(): void {
    this.playerScore = 0;
    this.aiScore = 0;
    this.currentRound = 1;
    this.maxRounds = 5;
    this.isPlayerTurn = true;
    this.isAiming = true;
    this.isFlying = false;
    this.showResult = false;
    this.matchOver = false;
    this.matchWinner = null;
    this.lastResult = null;
    this.history = [];
    this.combo = 0;
    this.aimX = 0;
    this.aimY = 30;
    this.power = 70;
    this.status = '🔄 Nouvelle partie ! À vous de tirer !';
    this.resetPositions();
  }

  // ─── Synchronisation physique ─────────────────────────────────────────────

  private syncPhysics(): void {
    this.bodies.forEach((entry) => {
      const t = entry.body.translation();
      entry.mesh.position.set(t.x, t.y, t.z);
      const r = entry.body.rotation();
      entry.mesh.rotationQuaternion = new BABYLON.Quaternion(r.x, r.y, r.z, r.w);
    });
  }

  // ─── Contrôles clavier ────────────────────────────────────────────────────

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    // Empêcher la touche Espace de déclencher le scroll ou la sélection
    if (event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.isFlying || this.showResult || this.matchOver || !this.isPlayerTurn) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.aimX = Math.max(-100, this.aimX - 5);
        this.status = `🎯 Direction: ${this.aimX}%`;
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.aimX = Math.min(100, this.aimX + 5);
        this.status = `🎯 Direction: ${this.aimX}%`;
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.aimY = Math.min(100, this.aimY + 5);
        this.status = `🎯 Hauteur: ${this.aimY}%`;
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.aimY = Math.max(0, this.aimY - 5);
        this.status = `🎯 Hauteur: ${this.aimY}%`;
        break;
      case 'w':
      case 'W':
        event.preventDefault();
        this.power = Math.min(100, this.power + 5);
        this.status = `💪 Puissance: ${this.power}%`;
        break;
      case 's':
      case 'S':
        event.preventDefault();
        this.power = Math.max(0, this.power - 5);
        this.status = `💪 Puissance: ${this.power}%`;
        break;
      case ' ':
        if (this.isAiming) this.shoot();
        break;
    }
  }

  // ─── Gestionnaires ────────────────────────────────────────────────────────

  private handleResize = () => {
    this.engine?.resize();
  };

  // ─── Propriétés pour le template ──────────────────────────────────────────

  get accuracyPercent(): number {
    if (this.history.length === 0) return 0;
    return Math.round((this.history.filter(h => h.scored).length / this.history.length) * 100);
  }

  get currentStreak(): number {
    return this.combo;
  }
}
