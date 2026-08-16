import {
  Component, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, HostListener, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ── Web Audio Synth Sound FX Generator ─────────────────────── */
class SoundFX {
  private static ctx: AudioContext | null = null;

  private static init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  static playHit() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(10, now + 0.1);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  static playSpecial() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.35);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  static playJump() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.2);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  static playBlock() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  static playWin() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.2, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.25);
    });
  }

  static playLose() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [392.00, 349.23, 311.13, 261.63];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.15, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.35);
    });
  }
}

/* ── Game state ──────────────────────────────────────────────── */
interface Fighter {
  x: number; y: number;
  hp: number; maxHp: number;
  vy: number; onGround: boolean;
  state: 'idle'|'walk'|'attack'|'kick'|'defend'|'jump'|'hurt';
  stateTimer: number; facing: 1|-1;
}

/* ── 3-D rig joints ──────────────────────────────────────────── */
interface Rig {
  root: THREE.Group;        // world-space position
  body: THREE.Group;        // body scale (facing flip)
  torso: THREE.Group;       // upper-body tilt
  head: THREE.Group;        // head pivot (at neck base)
  lShoulder: THREE.Group; lElbow: THREE.Group;
  rShoulder: THREE.Group; rElbow: THREE.Group;
  lHip: THREE.Group; lKnee: THREE.Group;
  rHip: THREE.Group; rKnee: THREE.Group;
  shadowPlane: THREE.Mesh;
}

interface Fireball {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  x: number;
  y: number;
  dir: 1 | -1;
  isPlayer: boolean;
}

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

@Component({
  selector: 'app-game-combat',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🥊 Combat 3D Cyber Arena</div>
        <div class="gp-scores">
          <div class="gp-score-item">
            <span class="gp-score-label">Round</span>
            <span class="gp-score-value">{{round}}/3</span>
          </div>
          <div class="gp-score-item">
            <span class="gp-score-label">Victoires</span>
            <span class="gp-score-value">{{playerWins}}</span>
          </div>
        </div>
      </div>

      <div class="gp-body">
        <!-- Three.js renderer mounts here -->
        <div class="gp-canvas-wrap">
          <div #container class="three-container"></div>

          <!-- HP bars overlaid on the 3D view -->
          <div class="hud">
            <div class="hud-side hud-left">
              <span class="hud-name">VOUS (PLAYER)</span>
              <div class="hud-hp-bg"><div class="hud-hp hud-hp--p" [style.width.%]="player.hp"></div></div>
            </div>
            <div class="hud-center">ROUND {{round}}</div>
            <div class="hud-side hud-right">
              <span class="hud-name">IA BOSS</span>
              <div class="hud-hp-bg"><div class="hud-hp hud-hp--a" [style.width.%]="ai.hp"></div></div>
            </div>
          </div>

          <!-- Virtual Gamepad for Mobile/Mouse play -->
          <div class="gp-virtual-pad" *ngIf="started && !roundOver && !gameOver">
            <div class="pad-left">
              <button class="pad-btn btn-dir" (mousedown)="simulateKey('ArrowLeft', true)" (mouseup)="simulateKey('ArrowLeft', false)" (mouseleave)="simulateKey('ArrowLeft', false)" (touchstart)="simulateKey('ArrowLeft', true); $event.preventDefault()" (touchend)="simulateKey('ArrowLeft', false)">←</button>
              <button class="pad-btn btn-dir" (mousedown)="simulateKey('ArrowUp', true)" (mouseup)="simulateKey('ArrowUp', false)" (mouseleave)="simulateKey('ArrowUp', false)" (touchstart)="simulateKey('ArrowUp', true); $event.preventDefault()" (touchend)="simulateKey('ArrowUp', false)">↑ Saut</button>
              <button class="pad-btn btn-dir" (mousedown)="simulateKey('ArrowRight', true)" (mouseup)="simulateKey('ArrowRight', false)" (mouseleave)="simulateKey('ArrowRight', false)" (touchstart)="simulateKey('ArrowRight', true); $event.preventDefault()" (touchend)="simulateKey('ArrowRight', false)">→</button>
            </div>
            <div class="pad-right">
              <button class="pad-btn btn-action btn-a" (mousedown)="simulateKey('a', true)" (mouseup)="simulateKey('a', false)" (mouseleave)="simulateKey('a', false)" (touchstart)="simulateKey('a', true); $event.preventDefault()" (touchend)="simulateKey('a', false)">Bloquer [A]</button>
              <button class="pad-btn btn-action btn-z" (click)="triggerActionKey('z')">Poing [Z]</button>
              <button class="pad-btn btn-action btn-x" (click)="triggerActionKey('x')">Pied [X]</button>
              <button class="pad-btn btn-action btn-c" (click)="triggerActionKey('c')">Fireball [C]</button>
            </div>
          </div>

          <!-- Overlay: start / round over / game over -->
          <div class="gp-overlay" *ngIf="!started || roundOver || gameOver">
            <div class="gp-overlay-icon">
              {{gameOver ? (playerWins > aiWins ? '🏆' : '💀') : '🥊'}}
            </div>
            <div class="gp-overlay-title">{{overlayTitle}}</div>
            <div class="gp-overlay-sub" *ngIf="roundOver && !gameOver">
              {{playerWins}} victoire(s) — {{aiWins}} pour l'IA
            </div>
            <button class="gp-btn" (click)="startRound()">
              {{gameOver ? 'Rejouer' : (round===1 && !roundOver ? 'Combattre !' : 'Round '+round)}}
            </button>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row"><span class="gp-key">←→</span>Déplacer</div>
            <div class="gp-ctrl-row"><span class="gp-key">↑</span>Saut</div>
            <div class="gp-ctrl-row"><span class="gp-key">Z</span>Poing (10 DMG)</div>
            <div class="gp-ctrl-row"><span class="gp-key">X</span>Pied (18 DMG)</div>
            <div class="gp-ctrl-row"><span class="gp-key">C</span>Hadouken (22 DMG)</div>
            <div class="gp-ctrl-row"><span class="gp-key">A</span>Défense</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Score</div>
            <div class="score-row">
              <div class="score-cell">
                <div class="score-num score-num--p">{{playerWins}}</div>
                <div class="score-lbl">Vous</div>
              </div>
              <div class="score-sep">—</div>
              <div class="score-cell">
                <div class="score-num score-num--a">{{aiWins}}</div>
                <div class="score-lbl">IA</div>
              </div>
            </div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Caméra 3D</div>
            <p class="help-text" style="color: #6366f1;">
              💡 <b>Glissez la souris</b> sur l'arène pour tourner la caméra à 360° !
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; height:100vh; overflow:hidden; background:#0a0e1a; }
    .gp { display:flex; flex-direction:column; height:100vh; overflow:hidden;
          background:linear-gradient(135deg,#0a0e1a,#0f172a);
          font-family:'Segoe UI',system-ui,sans-serif; color:#e2e8f0; }
    .gp-header { flex-shrink:0; display:flex; align-items:center; justify-content:space-between;
                 padding:10px 20px; background:rgba(255,255,255,.04);
                 border-bottom:1px solid rgba(255,255,255,.08); }
    .gp-back { color:#64748b; text-decoration:none; font-size:13px; padding:6px 12px;
               border-radius:8px; border:1px solid rgba(255,255,255,.1); transition:.2s; }
    .gp-back:hover { color:#0d9488; border-color:#0d9488; }
    .gp-title { font-size:18px; font-weight:800; color:#f1f5f9; }
    .gp-scores { display:flex; gap:16px; }
    .gp-score-item { display:flex; flex-direction:column; align-items:center;
                     background:rgba(255,255,255,.05); border-radius:10px; padding:6px 14px;
                     border:1px solid rgba(255,255,255,.08); min-width:60px; }
    .gp-score-label { font-size:9px; text-transform:uppercase; color:#64748b; letter-spacing:.08em; }
    .gp-score-value { font-size:18px; font-weight:800; color:#0d9488; line-height:1.2; }

    .gp-body { flex:1; min-height:0; display:flex; align-items:stretch; justify-content:center;
               gap:16px; padding:10px 16px; overflow:hidden; }
    .gp-canvas-wrap { position:relative; flex:1; min-width:0; min-height:300px;
                      border-radius:14px; overflow:hidden;
                      box-shadow:0 0 60px rgba(220,38,38,.25), 0 0 120px rgba(13,148,136,.15); }
    .three-container { width:100%; height:100%; display:block; }
    .three-container canvas { display:block; width:100% !important; height:100% !important; }

    /* HUD overlay */
    .hud { position:absolute; top:0; left:0; right:0; padding:10px 14px;
           display:flex; align-items:center; gap:12px; pointer-events:none;
           background:linear-gradient(to bottom, rgba(0,0,0,.6), transparent); }
    .hud-side { flex:1; display:flex; flex-direction:column; gap:4px; }
    .hud-right { align-items:flex-end; }
    .hud-name { font-size:10px; font-weight:700; letter-spacing:.1em; color:rgba(255,255,255,.7); }
    .hud-hp-bg { width:100%; height:10px; background:rgba(255,255,255,.15);
                 border-radius:5px; overflow:hidden; }
    .hud-hp { height:100%; border-radius:5px; transition:width .08s; }
    .hud-hp--p { background:linear-gradient(90deg,#0d9488,#10b981); }
    .hud-hp--a { background:linear-gradient(90deg,#f97316,#dc2626);
                 margin-left:auto; /* right-aligned fill */ }
    .hud-center { font-size:13px; font-weight:800; color:#f59e0b;
                  white-space:nowrap; text-shadow:0 0 10px rgba(245,158,11,.8); }

    /* Virtual Gamepad */
    .gp-virtual-pad { position:absolute; bottom:14px; left:14px; right:14px; display:flex; justify-content:space-between; pointer-events:none; }
    .pad-left, .pad-right { display:flex; gap:6px; pointer-events:auto; }
    .pad-btn { background:rgba(15,23,42,0.85); border:1px solid rgba(255,255,255,0.15); border-radius:10px; color:#f1f5f9; padding:8px 12px; font-weight:700; font-size:12px; cursor:pointer; user-select:none; backdrop-filter:blur(6px); transition:all 0.15s; }
    .pad-btn:hover { background:rgba(255,255,255,0.12); border-color:#0d9488; }
    .pad-btn:active { transform:scale(0.92); }
    .btn-dir { min-width:40px; height:40px; display:flex; align-items:center; justify-content:center; }
    .btn-a { border-color: rgba(245,158,11,0.4); color: #f59e0b; }
    .btn-z { border-color: rgba(13,148,136,0.4); color: #0d9488; }
    .btn-x { border-color: rgba(220,38,38,0.4); color: #dc2626; }
    .btn-c { border-color: rgba(6,182,212,0.5); color: #06b6d4; text-shadow:0 0 5px rgba(6,182,212,0.5); animation: pulse-glow 2s infinite alternate; }

    @keyframes pulse-glow {
      from { box-shadow: 0 0 5px rgba(6,182,212,0.2); }
      to { box-shadow: 0 0 15px rgba(6,182,212,0.6); }
    }

    /* Overlay */
    .gp-overlay { position:absolute; inset:0; background:rgba(10,14,26,.82);
                  backdrop-filter:blur(10px); display:flex; flex-direction:column;
                  align-items:center; justify-content:center; gap:10px; border-radius:14px; }
    .gp-overlay-icon { font-size:52px; }
    .gp-overlay-title { font-size:30px; font-weight:900; color:#f1f5f9; letter-spacing:-.02em; }
    .gp-overlay-sub { font-size:14px; color:#64748b; }
    .gp-btn { margin-top:10px; padding:13px 36px; border-radius:12px; border:none;
              background:linear-gradient(135deg,#dc2626,#b91c1c);
              color:#fff; font-size:16px; font-weight:700; cursor:pointer;
              box-shadow:0 4px 20px rgba(220,38,38,.4); transition:.15s; }
    .gp-btn:hover { transform:translateY(-2px); box-shadow:0 6px 28px rgba(220,38,38,.5); }

    /* Sidebar */
    .gp-sidebar { width:180px; flex-shrink:0; display:flex; flex-direction:column; gap:12px; }
    .gp-panel { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
                border-radius:12px; padding:12px; }
    .gp-panel-title { font-size:9px; text-transform:uppercase; letter-spacing:.1em;
                      color:#64748b; margin-bottom:8px; font-weight:600; }
    .gp-ctrl-row { display:flex; align-items:center; gap:7px; font-size:12px;
                   color:#94a3b8; margin-bottom:5px; }
    .gp-key { background:rgba(255,255,255,.1); border-radius:4px;
              border:1px solid rgba(255,255,255,.2); padding:1px 7px;
              font-size:11px; font-weight:700; color:#e2e8f0; font-family:monospace; }
    .score-row { display:flex; align-items:center; justify-content:space-around; }
    .score-cell { text-align:center; }
    .score-num { font-size:26px; font-weight:900; line-height:1; }
    .score-num--p { color:#0d9488; }
    .score-num--a { color:#dc2626; }
    .score-sep { color:#334155; font-size:16px; }
    .score-lbl { font-size:10px; color:#64748b; margin-top:2px; }
    .help-text { font-size:12px; color:#64748b; line-height:1.55; margin:0; }
    .help-text b { color:#94a3b8; }
  `]
})
export class GameCombatComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  /* ── Game state ─────────────────────────────────────────────── */
  started = false; roundOver = false; gameOver = false;
  round = 1; playerWins = 0; aiWins = 0;

  player: Fighter = { x: -1.8, y: 0, hp: 100, maxHp: 100, vy: 0, onGround: true, state: 'idle', stateTimer: 0, facing: 1 };
  ai: Fighter    = { x:  1.8, y: 0, hp: 100, maxHp: 100, vy: 0, onGround: true, state: 'idle', stateTimer: 0, facing: -1 };

  get overlayTitle(): string {
    if (this.gameOver) return this.playerWins > this.aiWins ? 'Vous êtes Champion !' : 'L\'IA a gagné !';
    if (this.roundOver) return `Round ${this.round - 1} terminé !`;
    return '🥊 Prêt au combat ?';
  }

  /* ── Three.js ────────────────────────────────────────────────── */
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private raf = 0;
  private frame = 0;
  private W = 0; private H = 0;

  private playerRig!: Rig;
  private aiRig!: Rig;

  private fireballs: Fireball[] = [];
  private particles: Particle[] = [];
  private fireballCooldownP = 0;
  private fireballCooldownA = 0;

  /* ── Input ───────────────────────────────────────────────────── */
  private keys: Record<string, boolean> = {};
  private aiCooldown = 60;

  /* ── Constants ───────────────────────────────────────────────── */
  private readonly GROUND = 0;
  private readonly STAGE_MIN = -3.5;
  private readonly STAGE_MAX = 3.5;
  private readonly MOVE_SPEED = 0.058;
  private readonly ATTACK_RANGE = 1.5;
  private readonly JUMP_VEL = 0.16;
  private readonly GRAVITY = 0.009;

  constructor(private cdr: ChangeDetectorRef) {}

  /* ════════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════════ */
  ngAfterViewInit() {
    // Defer init so flexbox layout is calculated before we read dimensions
    setTimeout(() => this.initThree(), 0);
  }

  private initThree() {
    const el = this.containerRef.nativeElement;
    this.resizeCanvas();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.W, this.H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    el.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e1a);
    this.scene.fog = new THREE.FogExp2(0x0a0e1a, 0.06);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, this.W / this.H, 0.1, 100);
    this.camera.position.set(0, 2.4, 7.5);
    this.camera.lookAt(0, 1.2, 0);

    // OrbitControls for 360° camera drag
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 12;
    this.controls.minPolarAngle = 0.3;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 1.2, 0);
    this.controls.update();

    this.buildScene();

    // Build fighters
    this.playerRig = this.buildFighter(true);
    this.aiRig = this.buildFighter(false);
    this.scene.add(this.playerRig.root);
    this.scene.add(this.aiRig.root);

    this.initFighters();
    this.renderOnce(); // Show static scene before game starts
  }

  /* ════════════════════════════════════════════════════════════════
     SCENE / ARENA
  ════════════════════════════════════════════════════════════════ */
  private buildScene() {
    /* ── Lights ── */
    const ambient = new THREE.AmbientLight(0x1a2040, 2.0);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(3, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -2;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x4040ff, 0.8);
    fillLight.position.set(-4, 4, 3);
    this.scene.add(fillLight);

    // Colored spotlights — player (teal) and AI (red)
    const pSpot = new THREE.PointLight(0x0d9488, 3, 6);
    pSpot.position.set(-2.5, 3, 1);
    this.scene.add(pSpot);

    const aSpot = new THREE.PointLight(0xdc2626, 3, 6);
    aSpot.position.set(2.5, 3, 1);
    this.scene.add(aSpot);

    /* ── Floor ── */
    const floorGeo = new THREE.PlaneGeometry(12, 8);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a0a0a,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Arena mat (central octagonal pad)
    const matGeo = new THREE.CircleGeometry(4, 8);
    const matMat = new THREE.MeshStandardMaterial({ color: 0x1e1008, roughness: 0.9 });
    const mat = new THREE.Mesh(matGeo, matMat);
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = 0;
    mat.receiveShadow = true;
    this.scene.add(mat);

    // Mat border ring
    const ringGeo = new THREE.RingGeometry(3.95, 4.2, 8);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    this.scene.add(ring);

    /* ── Back wall ── */
    const wallGeo = new THREE.PlaneGeometry(14, 6);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0d0d1a, roughness: 1 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(0, 3, -3);
    this.scene.add(wall);

    // Neon strip lights on wall
    const neonColors = [0x0d9488, 0x7c3aed, 0xdc2626];
    for (let i = 0; i < 3; i++) {
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 0.06),
        new THREE.MeshStandardMaterial({ color: neonColors[i], emissive: neonColors[i], emissiveIntensity: 2 })
      );
      strip.position.set(0, 0.8 + i * 1.2, -2.95);
      this.scene.add(strip);
    }

    /* ── Ring posts + ropes ── */
    const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8);
    const postPositions = [[-3.8, -2], [-3.8, 2], [3.8, -2], [3.8, 2]];
    postPositions.forEach(([px, pz]) => {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, 1.25, pz);
      post.castShadow = true;
      this.scene.add(post);
    });

    // Ropes
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.5 });
    const ropeMat2 = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 });
    [0.7, 1.2, 1.7].forEach((ry, i) => {
      const rm = i % 2 === 0 ? ropeMat : ropeMat2;
      // Front & back ropes
      [{ from: [-3.8, -2], to: [3.8, -2] }, { from: [-3.8, 2], to: [3.8, 2] }].forEach(seg => {
        const [x1, z1] = seg.from;
        const [x2, z2] = seg.to;
        const len = Math.sqrt((x2-x1)**2 + (z2-z1)**2);
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), rm);
        rope.rotation.z = Math.PI / 2;
        rope.position.set((x1+x2)/2, ry, (z1+z2)/2);
        this.scene.add(rope);
      });
      // Side ropes
      [{ from: [-3.8, -2], to: [-3.8, 2] }, { from: [3.8, -2], to: [3.8, 2] }].forEach(seg => {
        const [x1, z1] = seg.from;
        const [x2, z2] = seg.to;
        const len = Math.abs(z2 - z1);
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 6), rm);
        rope.rotation.x = Math.PI / 2;
        rope.position.set(x1, ry, (z1+z2)/2);
        this.scene.add(rope);
      });
    });

    /* ── Crowd silhouettes (background haze) ── */
    for (let i = -5; i <= 5; i++) {
      const sil = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.8 + Math.random() * 0.4, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 1 })
      );
      sil.position.set(i * 0.9, 1.2 + Math.random() * 0.2, -2.8);
      this.scene.add(sil);
    }
  }

  /* ════════════════════════════════════════════════════════════════
     BUILD FIGHTER RIG
  ════════════════════════════════════════════════════════════════ */
  private buildFighter(isPlayer: boolean): Rig {
    const skinC  = 0xf4c2a1;
    const hairC  = isPlayer ? 0x3d2b1f : 0x1a1a1a;
    const shirtC = isPlayer ? 0x1e3a8a : 0x7f1d1d;
    const pantsC = isPlayer ? 0x1e2a4a : 0x3f0f0f;
    const shoeC  = 0x1a1a1a;
    const accentC = isPlayer ? 0x0d9488 : 0xdc2626;

    const m = (c: number, rough = 0.75, metal = 0.05) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });

    const root = new THREE.Group();
    const body = new THREE.Group();   // child of root — used for facing flip
    root.add(body);

    /* ── TORSO ── */
    const torso = new THREE.Group();
    torso.position.set(0, 1.05, 0);
    body.add(torso);

    // Main torso box
    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.22), m(shirtC));
    torsoMesh.position.set(0, 0.29, 0);
    torsoMesh.castShadow = true;
    torso.add(torsoMesh);

    // Belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.24), m(accentC, 0.5, 0.3));
    belt.position.set(0, 0.04, 0);
    torso.add(belt);

    // Chest detail panel
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.23), m(accentC, 0.6, 0.1));
    chest.position.set(0, 0.4, 0);
    torso.add(chest);

    /* ── HEAD ── */
    const head = new THREE.Group();
    head.position.set(0, 0.69, 0);  // above torso group origin
    torso.add(head);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.13, 8), m(skinC));
    neck.position.y = 0.065;
    neck.castShadow = true;
    head.add(neck);

    // Head sphere
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), m(skinC));
    headMesh.position.y = 0.28;
    headMesh.castShadow = true;
    head.add(headMesh);

    // Hair cap (hemisphere)
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.226, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      m(hairC, 0.9)
    );
    hair.position.y = 0.28;
    head.add(hair);

    // Eyes
    const eyeWhiteMat = m(0xffffff, 0.1);
    const pupilMat = m(0x111111, 0.1);
    const irisColors = [isPlayer ? 0x0d9488 : 0xdc2626];
    const irisMat = new THREE.MeshStandardMaterial({ color: isPlayer ? 0x0d9488 : 0xdc2626, roughness: 0.1, metalness: 0.2 });

    for (const xOff of [-0.085, 0.085]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeWhiteMat);
      eyeWhite.position.set(xOff, 0.295, 0.188);
      head.add(eyeWhite);
      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.025, 8), irisMat);
      iris.position.set(xOff, 0.295, 0.232);
      head.add(iris);
      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.013, 8), pupilMat);
      pupil.position.set(xOff, 0.295, 0.234);
      head.add(pupil);
    }

    // Eyebrows
    const browMat = m(isPlayer ? 0x2d1a0f : 0x0a0a0a, 0.9);
    for (const xOff of [-0.085, 0.085]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.01), browMat);
      brow.position.set(xOff, 0.325, 0.2);
      brow.rotation.z = xOff < 0 ? 0.15 : -0.15;
      head.add(brow);
    }

    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.04, 6), m(skinC));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.267, 0.21);
    head.add(nose);

    // Mouth
    const mouthMat = new THREE.MeshStandardMaterial({ color: isPlayer ? 0x7b3434 : 0x4a1a1a, roughness: 0.9 });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.01), mouthMat);
    mouth.position.set(0, 0.242, 0.21);
    head.add(mouth);

    // Ear
    for (const xOff of [-0.22, 0.22]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), m(skinC));
      ear.position.set(xOff, 0.28, 0);
      head.add(ear);
    }

    /* ── LEFT ARM (fighter's left = viewer's right when facing cam) ── */
    const lShoulder = new THREE.Group();
    lShoulder.position.set(-0.27, 0.56, 0);
    torso.add(lShoulder);

    // Shoulder pad
    const lShoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), m(accentC, 0.6, 0.2));
    lShoulderPad.position.set(-0.04, 0, 0);
    lShoulder.add(lShoulderPad);

    const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.36, 8), m(shirtC));
    lUpperArm.position.set(0, -0.18, 0);
    lUpperArm.castShadow = true;
    lShoulder.add(lUpperArm);

    const lElbow = new THREE.Group();
    lElbow.position.set(0, -0.36, 0);
    lShoulder.add(lElbow);

    const lForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.31, 8), m(skinC));
    lForearm.position.set(0, -0.155, 0);
    lForearm.castShadow = true;
    lElbow.add(lForearm);

    // Glove / hand
    const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), m(accentC, 0.5, 0.1));
    lHand.position.set(0, -0.33, 0);
    lElbow.add(lHand);

    /* ── RIGHT ARM ── */
    const rShoulder = new THREE.Group();
    rShoulder.position.set(0.27, 0.56, 0);
    torso.add(rShoulder);

    const rShoulderPad = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), m(accentC, 0.6, 0.2));
    rShoulderPad.position.set(0.04, 0, 0);
    rShoulder.add(rShoulderPad);

    const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.36, 8), m(shirtC));
    rUpperArm.position.set(0, -0.18, 0);
    rUpperArm.castShadow = true;
    rShoulder.add(rUpperArm);

    const rElbow = new THREE.Group();
    rElbow.position.set(0, -0.36, 0);
    rShoulder.add(rElbow);

    const rForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.31, 8), m(skinC));
    rForearm.position.set(0, -0.155, 0);
    rForearm.castShadow = true;
    rElbow.add(rForearm);

    const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), m(accentC, 0.5, 0.1));
    rHand.position.set(0, -0.33, 0);
    rElbow.add(rHand);

    /* ── LEFT LEG ── */
    const lHip = new THREE.Group();
    lHip.position.set(-0.13, 0, 0);  // hips at body origin (1.05 world)
    body.add(lHip);
    lHip.position.y = 1.05;

    const lUpperLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.088, 0.46, 8), m(pantsC));
    lUpperLeg.position.y = -0.23;
    lUpperLeg.castShadow = true;
    lHip.add(lUpperLeg);

    const lKnee = new THREE.Group();
    lKnee.position.y = -0.46;
    lHip.add(lKnee);

    const lLowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.072, 0.43, 8), m(pantsC));
    lLowerLeg.position.y = -0.215;
    lLowerLeg.castShadow = true;
    lKnee.add(lLowerLeg);

    const lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.085, 0.3), m(shoeC, 0.8, 0.2));
    lFoot.position.set(0, -0.465, 0.06);
    lKnee.add(lFoot);

    /* ── RIGHT LEG ── */
    const rHip = new THREE.Group();
    rHip.position.set(0.13, 1.05, 0);
    body.add(rHip);

    const rUpperLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.088, 0.46, 8), m(pantsC));
    rUpperLeg.position.y = -0.23;
    rUpperLeg.castShadow = true;
    rHip.add(rUpperLeg);

    const rKnee = new THREE.Group();
    rKnee.position.y = -0.46;
    rHip.add(rKnee);

    const rLowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.072, 0.43, 8), m(pantsC));
    rLowerLeg.position.y = -0.215;
    rLowerLeg.castShadow = true;
    rKnee.add(rLowerLeg);

    const rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.085, 0.3), m(shoeC, 0.8, 0.2));
    rFoot.position.set(0, -0.465, 0.06);
    rKnee.add(rFoot);

    /* ── Drop shadow plane ── */
    const shadowPlane = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.005;
    root.add(shadowPlane);

    return { root, body, torso, head, lShoulder, lElbow, rShoulder, rElbow, lHip, lKnee, rHip, rKnee, shadowPlane };
  }

  /* ════════════════════════════════════════════════════════════════
     GAME LOGIC
  ════════════════════════════════════════════════════════════════ */
  private makeFighter(x: number, facing: 1 | -1): Fighter {
    return { x, y: this.GROUND, hp: 100, maxHp: 100, vy: 0, onGround: true,
             state: 'idle', stateTimer: 0, facing };
  }

  private initFighters() {
    this.player = this.makeFighter(-2.6, 1);
    this.ai     = this.makeFighter( 2.6, -1);
    this.aiCooldown = 60;
    this.fireballCooldownP = 0;
    this.fireballCooldownA = 0;
    // Clear existing fireballs/particles
    this.fireballs.forEach(fb => { this.scene.remove(fb.mesh); this.scene.remove(fb.light); });
    this.fireballs = [];
    this.particles.forEach(p => this.scene.remove(p.mesh));
    this.particles = [];
    this.syncRig(this.playerRig, this.player);
    this.syncRig(this.aiRig, this.ai);
  }

  startRound() {
    if (this.gameOver) {
      this.round = 1; this.playerWins = 0; this.aiWins = 0; this.gameOver = false;
    }
    this.initFighters();
    this.started = true; this.roundOver = false;
    this.frame = 0;
    cancelAnimationFrame(this.raf);
    this.loop();
    this.cdr.detectChanges();
  }

  private loop() {
    if (this.roundOver || !this.started) return;
    this.frame++;
    this.update();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(() => this.loop());
  }

  private renderOnce() {
    this.animateRig(this.playerRig, this.player);
    this.animateRig(this.aiRig, this.ai);
    this.renderer.render(this.scene, this.camera);
  }

  private update() {
    const p = this.player;
    const a = this.ai;

    if (this.fireballCooldownP > 0) this.fireballCooldownP--;
    if (this.fireballCooldownA > 0) this.fireballCooldownA--;

    /* ── Player input ── */
    if (p.state === 'idle' || p.stateTimer <= 0) {
      if (this.keys['ArrowLeft'])  { p.x -= this.MOVE_SPEED; p.facing = -1; p.state = 'walk'; }
      else if (this.keys['ArrowRight']) { p.x += this.MOVE_SPEED; p.facing = 1; p.state = 'walk'; }
      else if (p.state === 'walk') p.state = 'idle';

      if ((this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']) && p.onGround) {
        p.vy = this.JUMP_VEL; p.onGround = false; p.state = 'jump'; p.stateTimer = 25;
        SoundFX.playJump();
      }
      if ((this.keys['z'] || this.keys['Z']) && p.stateTimer <= 0) {
        p.state = 'attack'; p.stateTimer = 22; this.doAttack(p, a, 10);
      }
      if ((this.keys['x'] || this.keys['X']) && p.stateTimer <= 0) {
        p.state = 'kick'; p.stateTimer = 28; this.doAttack(p, a, 18);
      }
      if ((this.keys['c'] || this.keys['C']) && p.stateTimer <= 0 && this.fireballCooldownP <= 0) {
        this.spawnFireball(p, true);
        p.stateTimer = 18;
      }
      if (this.keys['a'] || this.keys['A']) p.state = 'defend';
    }

    /* ── AI behaviour ── */
    this.aiCooldown--;
    if (this.aiCooldown <= 0 && (a.state === 'idle' || a.state === 'walk')) {
      const dist = Math.abs(a.x - p.x);
      const r = Math.random();
      if (dist > this.ATTACK_RANGE * 0.9) {
        a.x += a.x > p.x ? -this.MOVE_SPEED : this.MOVE_SPEED;
        a.state = 'walk';
      } else if (r < 0.30) { a.state = 'attack'; a.stateTimer = 22; this.doAttack(a, p, 10); }
      else if (r < 0.50) { a.state = 'kick'; a.stateTimer = 28; this.doAttack(a, p, 18); }
      else if (r < 0.60) { a.state = 'defend'; a.stateTimer = 35; }
      else if (r < 0.75 && dist > 2.0 && this.fireballCooldownA <= 0) {
        this.spawnFireball(a, false);
        a.stateTimer = 18;
      }
      this.aiCooldown = 25 + Math.floor(Math.random() * 45);
    }

    /* ── Physics ── */
    for (const f of [p, a]) {
      if (!f.onGround) {
        f.vy -= this.GRAVITY;
        f.y += f.vy;
        if (f.y <= this.GROUND) { f.y = this.GROUND; f.vy = 0; f.onGround = true; if (f.state === 'jump') f.state = 'idle'; }
      }
      f.x = Math.max(this.STAGE_MIN, Math.min(this.STAGE_MAX, f.x));
      if (f.stateTimer > 0) { f.stateTimer--; if (f.stateTimer === 0 && f.state !== 'idle' && f.state !== 'walk') f.state = 'idle'; }
    }

    // Fighters face each other
    p.facing = p.x < a.x ? 1 : -1;
    a.facing = a.x > p.x ? -1 : 1;

    /* ── Update fireballs ── */
    this.updateFireballs();

    /* ── Update particles ── */
    this.updateParticles();

    /* ── Sync 3-D rigs ── */
    this.syncRig(this.playerRig, p);
    this.syncRig(this.aiRig, a);
    this.animateRig(this.playerRig, p);
    this.animateRig(this.aiRig, a);

    this.cdr.detectChanges();
    this.checkRoundEnd();
  }

  /* ── Fireball (Hadouken) ───────────────────────────────────── */
  private spawnFireball(owner: Fighter, isPlayer: boolean) {
    SoundFX.playSpecial();
    const geo = new THREE.SphereGeometry(0.18, 10, 10);
    const col = isPlayer ? 0x06b6d4 : 0xf97316;
    const mat = new THREE.MeshStandardMaterial({
      color: col, emissive: col, emissiveIntensity: 2,
      transparent: true, opacity: 0.9
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(owner.x + owner.facing * 0.5, owner.y + 1.1, 0);
    this.scene.add(mesh);

    const light = new THREE.PointLight(col, 4, 3);
    light.position.copy(mesh.position);
    this.scene.add(light);

    const fb: Fireball = { mesh, light, x: owner.x + owner.facing * 0.5, y: owner.y + 1.1, dir: owner.facing, isPlayer };
    this.fireballs.push(fb);
    if (isPlayer) this.fireballCooldownP = 60;
    else          this.fireballCooldownA = 70;
  }

  private updateFireballs() {
    const speed = 0.11;
    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.x += fb.dir * speed;
      fb.mesh.position.x = fb.x;
      fb.light.position.x = fb.x;
      // Spin the fireball
      fb.mesh.rotation.y += 0.15;
      fb.mesh.rotation.z += 0.1;

      // Out of bounds
      if (Math.abs(fb.x) > 5) {
        this.scene.remove(fb.mesh); this.scene.remove(fb.light);
        this.fireballs.splice(i, 1); continue;
      }

      // Hit detection
      const target = fb.isPlayer ? this.ai : this.player;
      const dist = Math.abs(fb.x - target.x);
      if (dist < 0.55 && Math.abs((fb.y) - (target.y + 1.1)) < 0.7) {
        if (target.state !== 'defend') {
          target.hp = Math.max(0, target.hp - 22);
          target.state = 'hurt'; target.stateTimer = 18;
          SoundFX.playHit();
          this.spawnHitParticles(fb.x, fb.y, fb.isPlayer ? 0x06b6d4 : 0xf97316);
        } else {
          SoundFX.playBlock();
          this.spawnHitParticles(fb.x, fb.y, 0xfbbf24);
        }
        this.scene.remove(fb.mesh); this.scene.remove(fb.light);
        this.fireballs.splice(i, 1);
      }
    }
  }

  /* ── Particle sparks ───────────────────────────────────────── */
  private spawnHitParticles(x: number, y: number, color: number) {
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 6, 6),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 3 })
      );
      mesh.position.set(x, y, 0);
      this.scene.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.04 + Math.random() * 0.08;
      this.particles.push({
        mesh, vx: Math.cos(angle) * spd, vy: 0.05 + Math.random() * 0.1,
        vz: Math.sin(angle) * spd * 0.5,
        life: 0, maxLife: 18 + Math.floor(Math.random() * 14)
      });
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;
      p.vy -= 0.006;
      p.mesh.position.x += p.vx;
      p.mesh.position.y += p.vy;
      p.mesh.position.z += p.vz;
      const alpha = 1 - p.life / p.maxLife;
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = alpha;
      (p.mesh.material as THREE.MeshStandardMaterial).transparent = true;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  private doAttack(attacker: Fighter, defender: Fighter, dmg: number) {
    const dist = Math.abs(attacker.x - defender.x);
    if (dist < this.ATTACK_RANGE) {
      if (defender.state === 'defend') {
        SoundFX.playBlock();
        return;
      }
      defender.hp = Math.max(0, defender.hp - dmg);
      defender.state = 'hurt'; defender.stateTimer = 14;
      SoundFX.playHit();
      this.spawnHitParticles(defender.x, defender.y + 1.2, attacker === this.player ? 0x0d9488 : 0xdc2626);
    }
  }

  private checkRoundEnd() {
    if (this.player.hp <= 0) { this.aiWins++; this.endRound(); }
    else if (this.ai.hp <= 0) { this.playerWins++; this.endRound(); }
  }

  private endRound() {
    this.roundOver = true;
    cancelAnimationFrame(this.raf);
    if (this.player.hp <= 0) SoundFX.playLose();
    else SoundFX.playWin();
    if (this.round >= 3 || this.playerWins >= 2 || this.aiWins >= 2) this.gameOver = true;
    else this.round++;
    this.cdr.detectChanges();
  }

  /* ════════════════════════════════════════════════════════════════
     SYNC & ANIMATE RIG
  ════════════════════════════════════════════════════════════════ */
  private syncRig(rig: Rig, f: Fighter) {
    rig.root.position.set(f.x, f.y, 0);
    // Fighters face each other along X axis (Math.PI / 2 = right, -Math.PI / 2 = left)
    rig.body.rotation.y = f.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    // Shadow opacity based on jump height
    const shadowScale = Math.max(0.3, 1 - f.y * 0.8);
    rig.shadowPlane.scale.setScalar(shadowScale);
    rig.shadowPlane.position.y = 0.005 - f.y;
    (rig.shadowPlane.material as THREE.MeshBasicMaterial).opacity = 0.3 * shadowScale;
  }

  private animateRig(rig: Rig, f: Fighter) {
    const t = this.frame * 0.04;
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
    const L = 0.18; // lerp speed

    // Helper: smoothly set rotation
    const lrx = (joint: THREE.Group, v: number) => joint.rotation.x = lerp(joint.rotation.x, v, L);
    const lry = (joint: THREE.Group, v: number) => joint.rotation.y = lerp(joint.rotation.y, v, L);
    const lrz = (joint: THREE.Group, v: number) => joint.rotation.z = lerp(joint.rotation.z, v, L);

    switch (f.state) {
      case 'idle': {
        const breathe = Math.sin(t * 1.8) * 0.025;
        lrx(rig.torso, breathe);
        lrz(rig.lShoulder, 0.18); lrx(rig.lShoulder, 0.12);
        lrz(rig.rShoulder, -0.18); lrx(rig.rShoulder, 0.12);
        lrx(rig.lElbow, 0.25); lrx(rig.rElbow, 0.25);
        lrx(rig.lHip, 0.06); lrx(rig.rHip, 0.06);
        lrx(rig.lKnee, 0.08); lrx(rig.rKnee, 0.08);
        lrx(rig.head, 0);
        break;
      }
      case 'walk': {
        const swing = Math.sin(t * 10) * 0.45;
        lrx(rig.lHip, swing); lrx(rig.rHip, -swing);
        lrx(rig.lKnee, Math.max(0, swing) * 0.5); lrx(rig.rKnee, Math.max(0, -swing) * 0.5);
        lrx(rig.lShoulder, -swing * 0.4 + 0.12); lrx(rig.rShoulder, swing * 0.4 + 0.12);
        lrz(rig.lShoulder, 0.18); lrz(rig.rShoulder, -0.18);
        lrx(rig.torso, 0);
        break;
      }
      case 'attack': {
        const prog = f.stateTimer > 11 ? (22 - f.stateTimer) / 11 : (f.stateTimer / 11);
        const punch = -Math.PI * 0.55 * prog;
        lrx(rig.rShoulder, punch); lrx(rig.rElbow, punch * 0.6);
        lrz(rig.rShoulder, -0.1);
        lrx(rig.lShoulder, 0.5); lrz(rig.lShoulder, 0.4); // guard arm
        lrx(rig.torso, -0.08 * prog);
        lrx(rig.lHip, 0.06); lrx(rig.rHip, 0.06);
        lrx(rig.lKnee, 0.12); lrx(rig.rKnee, 0.12);
        break;
      }
      case 'kick': {
        const prog = f.stateTimer > 14 ? (28 - f.stateTimer) / 14 : (f.stateTimer / 14);
        const kick = -Math.PI * 0.75 * prog;
        lrx(rig.rHip, kick); lrx(rig.rKnee, Math.abs(kick) * 0.5);
        lrx(rig.torso, 0.15 * prog);
        lrx(rig.lShoulder, -0.4); lrz(rig.lShoulder, 0.3);
        lrx(rig.rShoulder, -0.2); lrz(rig.rShoulder, -0.2);
        lrx(rig.lHip, 0.1);
        break;
      }
      case 'defend': {
        lrx(rig.lShoulder, -0.9); lrz(rig.lShoulder, 0.5);
        lrx(rig.rShoulder, -0.9); lrz(rig.rShoulder, -0.5);
        lrx(rig.lElbow, -0.7); lrx(rig.rElbow, -0.7);
        lrx(rig.torso, 0.12);
        lrx(rig.head, -0.1);
        lrx(rig.lHip, 0.12); lrx(rig.rHip, 0.12);
        lrx(rig.lKnee, 0.18); lrx(rig.rKnee, 0.18);
        break;
      }
      case 'hurt': {
        lrx(rig.torso, -0.35); lrx(rig.head, -0.25);
        lrx(rig.lShoulder, -0.3); lrz(rig.lShoulder, 0.5);
        lrx(rig.rShoulder, -0.3); lrz(rig.rShoulder, -0.5);
        lrx(rig.lElbow, -0.5); lrx(rig.rElbow, -0.5);
        break;
      }
      case 'jump': {
        lrx(rig.lHip, -0.45); lrx(rig.rHip, -0.45);
        lrx(rig.lKnee, 0.65); lrx(rig.rKnee, 0.65);
        lrx(rig.lShoulder, -0.6); lrz(rig.lShoulder, 0.3);
        lrx(rig.rShoulder, -0.6); lrz(rig.rShoulder, -0.3);
        lrx(rig.torso, -0.1);
        break;
      }
    }
  }

  private updateCamera() {
    // Camera auto-follows fighters only when OrbitControls is not being dragged
    if (!this.controls.enabled) return;
    const midX = (this.player.x + this.ai.x) / 2;
    this.controls.target.x += (midX * 0.3 - this.controls.target.x) * 0.03;
    this.controls.target.y = 1.3;
  }

  /* ── Resize ────────────────────────────────────────────────── */
  private resizeCanvas() {
    const wrap = this.containerRef?.nativeElement?.parentElement;
    if (wrap) {
      this.W = wrap.clientWidth  || Math.min(window.innerWidth  - 220, 840);
      this.H = wrap.clientHeight || Math.min(window.innerHeight - 120, 520);
    } else {
      this.W = Math.min(window.innerWidth  - 220, 840);
      this.H = Math.min(window.innerHeight - 120, 520);
    }
    if (this.W < 400) this.W = 400;
    if (this.H < 300) this.H = 300;
  }

  @HostListener('window:resize')
  onResize() {
    if (!this.renderer) return;
    this.resizeCanvas();
    this.renderer.setSize(this.W, this.H);
    this.camera.aspect = this.W / this.H;
    this.camera.updateProjectionMatrix();
    if (!this.started || this.roundOver) this.renderOnce();
  }

  /* ── Input ─────────────────────────────────────────────────── */
  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    this.keys[e.key] = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  }
  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent) { this.keys[e.key] = false; }

  /** Virtual gamepad: press/release a key programmatically */
  simulateKey(key: string, pressed: boolean) {
    this.keys[key] = pressed;
  }

  /** One-shot action (punch/kick/fireball) from virtual pad */
  triggerActionKey(key: string) {
    this.keys[key] = true;
    setTimeout(() => { this.keys[key] = false; }, 80);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    this.controls?.dispose();
    this.renderer?.dispose();
    this.scene?.clear();
  }
}
