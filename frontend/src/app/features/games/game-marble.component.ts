import { Component, ElementRef, ViewChild, OnInit, OnDestroy, HostListener, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface Point { x: number; y: number; }
interface PathNode { x: number; y: number; d: number; angle: number; }
interface Marble { id: number; color: string; d: number; pullBack: boolean; powerup?: string; }
interface Projectile { x: number; y: number; vx: number; vy: number; color: string; isPowerup?: string; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number; }
interface FloatingText { x: number; y: number; text: string; life: number; color: string; }

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];
const POWERUPS = ['BOMB', 'LIGHTNING', 'FROST', 'BACKWARD'];
const MARBLE_RADIUS = 16;
const MARBLE_DIAMETER = MARBLE_RADIUS * 2;

@Component({
  selector: 'app-game-marble',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="ws-layout" [class.dark-theme]="isDarkMode">
      
      <!-- HEADER MOBILE ONLY -->
      <div class="mobile-header">
        <div class="mobile-title">Marble Crush</div>
        <button class="menu-btn" (click)="mobileSidebarOpen = !mobileSidebarOpen">☰</button>
      </div>

      <!-- SIDEBAR -->
      <aside class="ws-sidebar" [class.mobile-open]="mobileSidebarOpen">
        
        <div class="stats-panel">
          <div class="stat-item level">Niveau {{ currentLevel }}</div>
          
          <div class="stat-item score">Score : {{ score }}</div>
          
          <div class="stat-item progress">
            Billes : <span class="found-text">{{ totalMarblesToSpawn - spawnedCount + marbles.length }}</span>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="(spawnedCount / totalMarblesToSpawn) * 100"></div>
            </div>
          </div>
          
          <div class="stat-item combo" *ngIf="combo > 1">🔥 Combo x{{ combo }} !</div>
        </div>

        <div class="actions-panel">
          <button class="action-btn primary" (click)="confirmReset()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Nouvelle partie
          </button>
          
          <button class="action-btn" (click)="togglePause()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect *ngIf="!isPaused" x="6" y="4" width="4" height="16"></rect>
              <rect *ngIf="!isPaused" x="14" y="4" width="4" height="16"></rect>
              <polygon *ngIf="isPaused" points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            {{ isPaused ? 'Reprendre' : 'Pause' }}
          </button>
          
          <button class="action-btn" (click)="showHelp = true">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Aide
          </button>

          <button class="action-btn" (click)="toggleSound()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
               <path *ngIf="soundEnabled" d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
               <line *ngIf="!soundEnabled" x1="23" y1="9" x2="17" y2="15"></line>
               <line *ngIf="!soundEnabled" x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
            {{ soundEnabled ? 'Son : Activé' : 'Son : Coupé' }}
          </button>

          <button class="action-btn" (click)="toggleTheme()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            {{ isDarkMode ? 'Mode Clair' : 'Mode Sombre' }}
          </button>
          
          <a class="action-btn warning" routerLink="/games" style="text-decoration: none; margin-top: 10px;">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Quitter
          </a>
        </div>
      </aside>

      <!-- GAME AREA -->
      <main class="game-area" #gameContainer>
        <canvas #gameCanvas 
                (mousemove)="onMouseMove($event)" 
                (mousedown)="onMouseDown($event)"
                (touchstart)="onTouchStart($event)"
                (touchmove)="onTouchMove($event)"
                (contextmenu)="onRightClick($event)">
        </canvas>
        
        <!-- OVERLAYS -->
        <div class="overlay" *ngIf="isGameOver">
          <div class="overlay-content defeat" *ngIf="!hasWon">
            <h2>💥 Game Over !</h2>
            <p>Les billes ont atteint le trou...</p>
            <div class="final-stats">
              <p>Score : <strong>{{ score }}</strong></p>
            </div>
            <button class="action-btn primary large" (click)="initGame(currentLevel)">Réessayer</button>
          </div>
          <div class="overlay-content victory" *ngIf="hasWon">
            <h2>🎉 Niveau {{ currentLevel }} Terminé !</h2>
            <div class="stars">
              <span *ngFor="let s of [1,2,3]" [class.active]="s <= starsEarned">⭐</span>
            </div>
            <div class="final-stats">
              <p>Score : <strong>{{ score }}</strong></p>
            </div>
            <button class="action-btn primary large" (click)="initGame(currentLevel + 1)">Niveau Suivant</button>
          </div>
        </div>

        <div class="overlay" *ngIf="isPaused && !isGameOver && !showHelp">
          <div class="overlay-content">
            <h2>⏸️ Jeu en pause</h2>
            <button class="action-btn primary large" (click)="togglePause()">Reprendre</button>
          </div>
        </div>

        <div class="modal-backdrop" *ngIf="showHelp">
          <div class="modal">
            <h3>❓ Comment jouer à Marble Crush ?</h3>
            <div class="modal-body">
              <p><strong>Objectif :</strong> Détruire toutes les billes avant qu'elles n'atteignent le trou final.</p>
              <ul>
                <li><strong>Viser :</strong> Déplacez la souris (ou touchez l'écran).</li>
                <li><strong>Tirer :</strong> Clic gauche (ou relâchez le doigt).</li>
                <li><strong>Changer de bille :</strong> Clic droit pour échanger la bille courante avec la suivante.</li>
                <li><strong>Combiner :</strong> Formez des groupes de 3 billes de même couleur pour les faire exploser.</li>
              </ul>
              <p>Réalisez des combos et utilisez les billes spéciales (Bombe, Gel, etc.) pour augmenter votre score !</p>
            </div>
            <div class="modal-footer">
              <button class="action-btn primary" (click)="showHelp = false">Compris !</button>
            </div>
          </div>
        </div>

      </main>
    </div>
  `,
  styles: [`
    :host { display:block; height:100vh; overflow:hidden; font-family:'Segoe UI',system-ui,sans-serif; }
    
    .ws-layout {
      --bg: #f1f5f9; --text: #0f172a; --panel-bg: #ffffff; --border: #cbd5e1;
      --sidebar-bg: #e2e8f0; --btn-bg: #f8fafc; --btn-border: #cbd5e1; --btn-hover: #e2e8f0;
      --primary: #0284c7; --primary-hover: #0369a1; --primary-text: #fff;
      --text-muted: #334155;
      display:flex; height:100vh; overflow:hidden; background:var(--bg); color:var(--text); transition: background 0.3s, color 0.3s;
    }

    .ws-layout.dark-theme {
      --bg: #0f172a; --text: #f8fafc; --panel-bg: #1e293b; --border: #334155;
      --sidebar-bg: #0f172a; --btn-bg: #334155; --btn-border: #475569; --btn-hover: #475569;
      --primary: #0ea5e9; --primary-hover: #38bdf8;
      --text-muted: #cbd5e1;
    }

    .mobile-header { display:none; align-items:center; justify-content:space-between; padding:12px 20px; background:var(--panel-bg); border-bottom:1px solid var(--border); }
    .mobile-title { font-weight:800; font-size:18px; }
    .menu-btn { background:transparent; border:none; color:var(--text); font-size:24px; cursor:pointer; }

    .ws-sidebar { width:260px; flex-shrink:0; background:var(--sidebar-bg); border-right:1px solid var(--border); display:flex; flex-direction:column; padding:30px 20px; z-index:100; transition:transform 0.3s; overflow-y:auto; }
    .stats-panel { background:var(--panel-bg); border-radius:12px; padding:16px; margin-bottom:20px; box-shadow:0 2px 4px rgba(0,0,0,0.05); border:1px solid var(--border); }
    .stat-item { margin-bottom:10px; font-weight:600; font-size:14px; color:var(--text-muted); }
    .stat-item.level { font-size:18px; font-weight:900; color:var(--primary); text-transform:uppercase; margin-bottom:12px;}
    .stat-item.combo { color: #f59e0b; animation: pop 0.3s ease-out; }
    
    .progress { font-size:13px; color:var(--text-muted); }
    .found-text { font-weight:700; color:var(--text); }
    .progress-bar { height:6px; background:var(--btn-bg); border-radius:3px; margin-top:6px; overflow:hidden; border:1px solid var(--border); }
    .progress-fill { height:100%; background:var(--primary); transition:width 0.3s; }

    .actions-panel { display:flex; flex-direction:column; gap:8px; }
    .action-btn { display:flex; align-items:center; gap:10px; width:100%; padding:10px 14px; border:1px solid var(--btn-border); border-radius:8px; background:var(--btn-bg); color:var(--text); font-weight:600; font-size:14px; cursor:pointer; transition:0.2s; text-align:left; }
    .action-btn:hover { background:var(--btn-hover); transform:translateY(-1px); }
    .action-btn.primary { background:var(--primary); color:var(--primary-text); border-color:var(--primary); }
    .action-btn.primary:hover { background:var(--primary-hover); }
    .action-btn.warning { color: #ef4444; }
    .action-btn.large { justify-content:center; padding:14px; font-size:16px; }
    .action-btn .icon { width:18px; height:18px; }

    .game-area { flex:1; position:relative; overflow:hidden; background:#000; }
    canvas { display:block; width:100%; height:100%; cursor:crosshair; }

    .overlay { position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:10; }
    .overlay-content { background:var(--panel-bg); padding:40px; border-radius:24px; text-align:center; max-width:400px; width:90%; box-shadow:0 20px 40px rgba(0,0,0,0.3); border:1px solid var(--border); }
    .overlay-content h2 { margin:0 0 10px; font-size:28px; color:var(--text); }
    .overlay-content p { color:var(--text-muted); margin-bottom:20px; }
    .final-stats { font-size:18px; margin-bottom:24px; background:var(--btn-bg); padding:16px; border-radius:12px; }
    
    .stars { font-size:40px; margin-bottom:20px; display:flex; justify-content:center; gap:10px; filter:grayscale(100%); opacity:0.3; }
    .stars .active { filter:none; opacity:1; animation:pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

    .modal-backdrop { position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:50; backdrop-filter:blur(2px); }
    .modal { background:var(--panel-bg); width:90%; max-width:500px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.2); overflow:hidden; border:1px solid var(--border); animation:fadeUp 0.3s; }
    .modal h3 { margin:0; padding:20px; background:var(--sidebar-bg); border-bottom:1px solid var(--border); color:var(--text); font-size:18px; }
    .modal-body { padding:20px; color:var(--text); font-size:14px; line-height:1.5; }
    .modal-body ul { margin:10px 0; padding-left:20px; }
    .modal-body li { margin-bottom:8px; }
    .modal-footer { padding:16px 20px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px; background:var(--sidebar-bg); }

    @keyframes pop { 0% { transform:scale(0.8); } 50% { transform:scale(1.1); } 100% { transform:scale(1); } }
    @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

    @media (max-width: 900px) {
      .ws-layout { flex-direction:column; }
      .mobile-header { display:flex; }
      .ws-sidebar { position:fixed; top:0; left:-280px; height:100vh; box-shadow:4px 0 16px rgba(0,0,0,0.1); width:280px; }
      .ws-sidebar.mobile-open { left:0; }
    }
  `]
})
export class GameMarbleComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('gameCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gameContainer', { static: true }) containerRef!: ElementRef<HTMLElement>;

  private ctx!: CanvasRenderingContext2D;
  private reqId: number = 0;
  private lastTime: number = 0;

  // UI State
  isDarkMode = true;
  mobileSidebarOpen = false;
  showHelp = false;
  isPaused = false;
  isGameOver = false;
  hasWon = false;
  soundEnabled = true;

  private audioCtx?: AudioContext;

  // Game Progress
  currentLevel = 1;
  score = 0;
  combo = 0;
  starsEarned = 0;

  // Game Engine State
  private pathNodes: PathNode[] = [];
  private pathLength = 0;
  
  marbles: Marble[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private floatTexts: FloatingText[] = [];

  private nextMarbleId = 1;
  private baseSpeed = 1.0;
  private frostTimer = 0;
  private backwardTimer = 0;
  
  // Spawner
  totalMarblesToSpawn = 30;
  spawnedCount = 0;
  private colorCount = 3;

  // Shooter
  private cx = 0;
  private cy = 0;
  private shooterAngle = 0;
  private currentColor = '';
  private nextColor = '';

  private pendingMatches: number[] = [];

  ngOnInit() {
    this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  ngAfterViewInit() {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', this.resizeCanvas);
    this.initGame(1);
    this.reqId = requestAnimationFrame(this.gameLoop);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.reqId);
    window.removeEventListener('resize', this.resizeCanvas);
  }

  resizeCanvas = () => {
    const rect = this.containerRef.nativeElement.getBoundingClientRect();
    this.canvasRef.nativeElement.width = rect.width;
    this.canvasRef.nativeElement.height = rect.height;
    this.generatePath();
  }

  toggleTheme() { this.isDarkMode = !this.isDarkMode; }
  
  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    if (this.soundEnabled && !this.audioCtx) {
       this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }
  
  private playSound(type: 'shoot' | 'pop' | 'powerup' | 'gameover' | 'win') {
    if (!this.soundEnabled) return;
    if (!this.audioCtx) {
       this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    const now = this.audioCtx.currentTime;
    
    if (type === 'shoot') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'powerup') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 1.0);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.0);
        osc.start(now);
        osc.stop(now + 1.0);
    } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        osc.frequency.setValueAtTime(800, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
  }

  togglePause() { 
    this.isPaused = !this.isPaused; 
    if (!this.isPaused) {
      this.lastTime = performance.now();
      this.reqId = requestAnimationFrame(this.gameLoop);
    }
  }

  confirmReset() {
    if (confirm("Voulez-vous recommencer à partir du niveau 1 ?")) {
      this.score = 0;
      this.initGame(1);
    }
  }

  initGame(level: number) {
    this.currentLevel = level;
    this.isGameOver = false;
    this.hasWon = false;
    this.isPaused = false;
    this.marbles = [];
    this.projectiles = [];
    this.particles = [];
    this.floatTexts = [];
    this.spawnedCount = 0;
    this.combo = 0;
    this.frostTimer = 0;
    this.backwardTimer = 0;
    
    // Level Config
    this.colorCount = Math.min(3 + Math.floor((level - 1) / 2), COLORS.length);
    this.totalMarblesToSpawn = 20 + level * 10;
    this.baseSpeed = 1.0 + level * 0.15;

    this.currentColor = this.getRandomColor();
    this.nextColor = this.getRandomColor();

    this.generatePath();
    this.lastTime = performance.now();
  }

  private getRandomColor(): string {
    return COLORS[Math.floor(Math.random() * this.colorCount)];
  }

  private generatePath() {
    this.pathNodes = [];
    let dist = 0;
    const padding = MARBLE_DIAMETER + 20;
    
    const width = this.canvasRef.nativeElement.width;
    const height = this.canvasRef.nativeElement.height;
    const maxRadius = Math.min(width, height) / 2 - padding;
    const minRadius = 50;
    const maxTheta = 7 * Math.PI; // 3.5 loops
    const radiusStep = (maxRadius - minRadius) / maxTheta;
    
    const tempNodes: PathNode[] = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // Generate spiral relative to 0,0
    for (let theta = maxTheta; theta >= 0; theta -= 0.05) {
      const r = minRadius + radiusStep * theta;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);
      
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      
      if (tempNodes.length === 0) {
        tempNodes.push({x, y, d: 0, angle: 0});
      } else {
        const prev = tempNodes[tempNodes.length - 1];
        const dx = x - prev.x;
        const dy = y - prev.y;
        const d = Math.hypot(dx, dy);
        dist += d;
        tempNodes.push({x, y, d: dist, angle: Math.atan2(dy, dx)});
      }
    }
    
    // Center bounding box on screen
    const bbCenterX = (minX + maxX) / 2;
    const bbCenterY = (minY + maxY) / 2;
    
    this.cx = width / 2 - bbCenterX;
    this.cy = height / 2 - bbCenterY;
    
    // Apply offset
    this.pathNodes = tempNodes.map(node => ({
        ...node,
        x: node.x + this.cx,
        y: node.y + this.cy
    }));
    
    this.pathLength = dist;
  }

  private getPathPos(d: number): {x: number, y: number, angle: number} {
    if (this.pathNodes.length === 0) return {x: this.cx, y: this.cy, angle: 0};
    if (d <= 0) return this.pathNodes[0];
    if (d >= this.pathLength) return this.pathNodes[this.pathNodes.length - 1];
    
    // Rough binary search or linear (linear is fine for ~500 nodes)
    for (let i = 0; i < this.pathNodes.length - 1; i++) {
      if (d >= this.pathNodes[i].d && d <= this.pathNodes[i+1].d) {
        const n1 = this.pathNodes[i];
        const n2 = this.pathNodes[i+1];
        const t = (d - n1.d) / (n2.d - n1.d);
        return {
          x: n1.x + (n2.x - n1.x) * t,
          y: n1.y + (n2.y - n1.y) * t,
          angle: n1.angle
        };
      }
    }
    return this.pathNodes[this.pathNodes.length - 1];
  }

  onMouseMove(e: MouseEvent) {
    if (this.isPaused || this.isGameOver) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    this.shooterAngle = Math.atan2(my - this.cy, mx - this.cx);
  }

  onMouseDown(e: MouseEvent) {
    if (e.button === 0) this.shoot();
    if (e.button === 2) this.swapColors();
  }

  onRightClick(e: MouseEvent) {
    e.preventDefault();
    this.swapColors();
  }

  onTouchStart(e: TouchEvent) {
    if (e.cancelable) e.preventDefault();
    this.updateTouchAngle(e);
  }

  onTouchMove(e: TouchEvent) {
    if (e.cancelable) e.preventDefault();
    this.updateTouchAngle(e);
  }

  private updateTouchAngle(e: TouchEvent) {
    if (this.isPaused || this.isGameOver) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const touch = e.touches[0];
    const mx = touch.clientX - rect.left;
    const my = touch.clientY - rect.top;
    this.shooterAngle = Math.atan2(my - this.cy, mx - this.cx);
    // On touch we shoot automatically after aiming? 
    // Actually, maybe let them drag to aim, and shoot on touchend?
    // Let's shoot immediately on touch start for simplicity, or debounce.
    // For a real game, touchstart aims, touchend shoots.
  }

  @HostListener('window:touchend', ['$event'])
  onTouchEnd(e: TouchEvent) {
    if (this.isPaused || this.isGameOver) return;
    // shoot on release
    this.shoot();
  }

  private swapColors() {
    const temp = this.currentColor;
    this.currentColor = this.nextColor;
    this.nextColor = temp;
  }

  private shoot() {
    if (this.isPaused || this.isGameOver) return;
    this.projectiles.push({
      x: this.cx + Math.cos(this.shooterAngle) * 30,
      y: this.cy + Math.sin(this.shooterAngle) * 30,
      vx: Math.cos(this.shooterAngle) * 15,
      vy: Math.sin(this.shooterAngle) * 15,
      color: this.currentColor
    });
    this.playSound('shoot');
    this.currentColor = this.nextColor;
    this.nextColor = this.getRandomColor();
  }

  private gameLoop = (time: number) => {
    if (!this.isPaused) {
      const dt = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;
      this.update(dt);
      this.draw();
    }
    this.reqId = requestAnimationFrame(this.gameLoop);
  }

  private update(dt: number) {
    if (this.isGameOver) return;

    // Powerups timers
    if (this.frostTimer > 0) this.frostTimer -= dt;
    if (this.backwardTimer > 0) this.backwardTimer -= dt;

    let currentSpeed = this.baseSpeed * (dt * 60);
    if (this.frostTimer > 0) currentSpeed *= 0.3;
    if (this.backwardTimer > 0) currentSpeed = -2.0 * (dt * 60);

    // 1. Spawner
    if (this.marbles.length === 0 || this.marbles[0].d > MARBLE_DIAMETER) {
      if (this.spawnedCount < this.totalMarblesToSpawn) {
        // Powerup chance
        let pwr = undefined;
        if (Math.random() < 0.05) {
          pwr = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
        }
        this.marbles.unshift({
          id: this.nextMarbleId++,
          color: this.getRandomColor(),
          d: 0,
          pullBack: false,
          powerup: pwr
        });
        this.spawnedCount++;
      }
    }

    // 2. Base Movement
    for (let i = 0; i < this.marbles.length; i++) {
      this.marbles[i].d += currentSpeed;
    }

    // 3. Attraction (Pull-back for gaps with same color)
    for (let i = 1; i < this.marbles.length; i++) {
      const gap = this.marbles[i].d - (this.marbles[i-1].d + MARBLE_DIAMETER);
      if (gap > 0 && gap < 800) {
        if (this.marbles[i].color === this.marbles[i-1].color || this.marbles[i].pullBack) {
          this.marbles[i].d -= 5.0 * (dt * 60);
          this.marbles[i].pullBack = true;
          // Pull the attached chain in front
          let j = i + 1;
          while (j < this.marbles.length && this.marbles[j].d <= this.marbles[j-1].d + MARBLE_DIAMETER + 1) {
            this.marbles[j].d -= 5.0 * (dt * 60);
            j++;
          }
          
          // Collision Check
          if (this.marbles[i].d <= this.marbles[i-1].d + MARBLE_DIAMETER) {
            this.marbles[i].d = this.marbles[i-1].d + MARBLE_DIAMETER;
            this.marbles[i].pullBack = false;
            // Snap the rest
            for(let k = i+1; k < j; k++) {
               this.marbles[k].d = this.marbles[k-1].d + MARBLE_DIAMETER;
               this.marbles[k].pullBack = false;
            }
            // Trigger combo match!
            this.pendingMatches.push(i);
            this.combo++; // increased combo for pull-back matches
          }
        }
      } else {
        this.marbles[i].pullBack = false;
      }
    }

    // 4. Resolve Overlaps (Push forward from tail to head)
    for (let i = 1; i < this.marbles.length; i++) {
      if (this.marbles[i].d < this.marbles[i-1].d + MARBLE_DIAMETER) {
        this.marbles[i].d = this.marbles[i-1].d + MARBLE_DIAMETER;
      }
    }

    // 5. Update Projectiles & Collisions
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * (dt * 60);
      p.y += p.vy * (dt * 60);
      
      // Screen bounds
      if (p.x < 0 || p.x > this.canvasRef.nativeElement.width || p.y < 0 || p.y > this.canvasRef.nativeElement.height) {
        this.projectiles.splice(i, 1);
        this.combo = 0; // miss resets combo
        continue;
      }

      // Collision with chain
      let hit = false;
      for (let j = 0; j < this.marbles.length; j++) {
        const m = this.marbles[j];
        const pos = this.getPathPos(m.d);
        const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (dist <= MARBLE_DIAMETER) {
          this.insertMarble(p, j);
          this.projectiles.splice(i, 1);
          hit = true;
          break;
        }
      }
    }

    // 6. Process Pending Matches
    if (this.pendingMatches.length > 0) {
      // Sort descending to not mess up indices when removing
      this.pendingMatches.sort((a,b) => b - a);
      for (const idx of this.pendingMatches) {
        if (idx < this.marbles.length) {
          this.checkMatchesAt(idx);
        }
      }
      this.pendingMatches = [];
    }

    // 7. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.y -= 30 * dt; ft.life -= dt;
      if (ft.life <= 0) this.floatTexts.splice(i, 1);
    }

    // 8. Win/Loss Conditions
    if (this.marbles.length > 0) {
      const head = this.marbles[this.marbles.length - 1];
      if (head.d >= this.pathLength) {
        this.gameOver(false);
      }
    } else if (this.spawnedCount >= this.totalMarblesToSpawn && this.marbles.length === 0) {
      this.gameOver(true);
    }
  }

  private insertMarble(p: Projectile, hitIndex: number) {
    const m = this.marbles[hitIndex];
    const posPlus = this.getPathPos(m.d + MARBLE_RADIUS);
    const posMinus = this.getPathPos(m.d - MARBLE_RADIUS);
    const dPlus = Math.hypot(p.x - posPlus.x, p.y - posPlus.y);
    const dMinus = Math.hypot(p.x - posMinus.x, p.y - posMinus.y);
    
    let insertIndex = hitIndex;
    let newD = m.d;
    
    if (dPlus < dMinus) {
      insertIndex = hitIndex + 1;
      newD = m.d + MARBLE_DIAMETER;
    } else {
      insertIndex = hitIndex;
      newD = m.d - MARBLE_DIAMETER;
    }
    
    this.marbles.splice(insertIndex, 0, { id: this.nextMarbleId++, color: p.color, d: newD, pullBack: false });
    
    // Push everything ahead to make room immediately
    for (let i = insertIndex + 1; i < this.marbles.length; i++) {
      if (this.marbles[i].d < this.marbles[i-1].d + MARBLE_DIAMETER) {
        this.marbles[i].d = this.marbles[i-1].d + MARBLE_DIAMETER;
      } else {
        break;
      }
    }
    
    this.checkMatchesAt(insertIndex);
  }

  private checkMatchesAt(index: number) {
    if (index < 0 || index >= this.marbles.length) return;
    const color = this.marbles[index].color;
    let start = index;
    let end = index;
    
    while (start > 0 && this.marbles[start - 1].color === color && (this.marbles[start].d - this.marbles[start-1].d <= MARBLE_DIAMETER + 2)) {
      start--;
    }
    while (end < this.marbles.length - 1 && this.marbles[end + 1].color === color && (this.marbles[end+1].d - this.marbles[end].d <= MARBLE_DIAMETER + 2)) {
      end++;
    }
    
    const count = end - start + 1;
    if (count >= 3) {
      this.explodeMarbles(start, count);
    } else {
      this.combo = 0; // reset combo if no match
    }
  }

  private explodeMarbles(start: number, count: number) {
    let pts = count * 10;
    if (this.combo > 1) pts *= this.combo;
    this.score += pts;
    this.playSound('pop');

    const removed = this.marbles.splice(start, count);
    
    // VFX & Powerups
    const centerPos = this.getPathPos(removed[Math.floor(removed.length/2)].d);
    this.floatTexts.push({ x: centerPos.x, y: centerPos.y, text: '+' + pts, life: 1.0, color: '#facc15' });

    for (const m of removed) {
      const pos = this.getPathPos(m.d);
      this.createExplosion(pos.x, pos.y, m.color);
      
      if (m.powerup) {
        this.activatePowerup(m.powerup, pos);
      }
    }
    
    if (count >= 5) {
      this.floatTexts.push({ x: centerPos.x, y: centerPos.y - 20, text: 'EXCELLENT!', life: 1.5, color: '#a855f7' });
      this.activatePowerup('BOMB', centerPos);
    }
  }

  private activatePowerup(type: string, pos: Point) {
    this.playSound('powerup');
    this.floatTexts.push({ x: pos.x, y: pos.y - 30, text: type, life: 1.5, color: '#fff' });
    if (type === 'BOMB') {
      // Destroy nearby
      for (let i = this.marbles.length - 1; i >= 0; i--) {
        const mPos = this.getPathPos(this.marbles[i].d);
        if (Math.hypot(mPos.x - pos.x, mPos.y - pos.y) < 100) {
           this.createExplosion(mPos.x, mPos.y, this.marbles[i].color);
           this.marbles.splice(i, 1);
           this.score += 5;
        }
      }
    } else if (type === 'FROST') {
      this.frostTimer = 5.0; // 5 seconds
    } else if (type === 'BACKWARD') {
      this.backwardTimer = 3.0; // 3 seconds backward
    } else if (type === 'LIGHTNING') {
      // Destroy random color
      const targetColor = COLORS[Math.floor(Math.random() * this.colorCount)];
      for (let i = this.marbles.length - 1; i >= 0; i--) {
        if (this.marbles[i].color === targetColor) {
           const mPos = this.getPathPos(this.marbles[i].d);
           this.createExplosion(mPos.x, mPos.y, targetColor);
           this.marbles.splice(i, 1);
           this.score += 5;
        }
      }
    }
  }

  private createExplosion(x: number, y: number, color: string) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 60 + 20;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.5,
        color: color,
        size: Math.random() * 4 + 2
      });
    }
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);

    // Draw Path Background
    this.ctx.beginPath();
    for (let i = 0; i < this.pathNodes.length; i++) {
      const p = this.pathNodes[i];
      if (i === 0) this.ctx.moveTo(p.x, p.y);
      else this.ctx.lineTo(p.x, p.y);
    }
    this.ctx.strokeStyle = this.isDarkMode ? '#334155' : '#cbd5e1';
    this.ctx.lineWidth = MARBLE_DIAMETER + 4;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();
    
    // Path center line
    this.ctx.strokeStyle = this.isDarkMode ? '#0f172a' : '#94a3b8';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw Hole
    const end = this.pathNodes[this.pathNodes.length - 1];
    if (end) {
      this.ctx.beginPath();
      this.ctx.arc(end.x, end.y, MARBLE_RADIUS + 5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#000';
      this.ctx.fill();
      this.ctx.strokeStyle = '#ef4444';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
    }

    // Draw Marbles
    for (const m of this.marbles) {
      const pos = this.getPathPos(m.d);
      this.drawMarble(pos.x, pos.y, m.color, m.powerup);
    }

    // Draw Projectiles
    for (const p of this.projectiles) {
      this.drawMarble(p.x, p.y, p.color);
    }

    // Draw Shooter
    this.ctx.save();
    this.ctx.translate(this.cx, this.cy);
    this.ctx.rotate(this.shooterAngle);
    // Base
    this.ctx.fillStyle = '#475569';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 25, 0, Math.PI * 2);
    this.ctx.fill();
    // Cannon
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillRect(0, -10, 40, 20);
    // Current marble
    this.drawMarble(0, 0, this.currentColor);
    // Next marble hint
    this.drawMarble(-20, 20, this.nextColor, undefined, 8);
    this.ctx.restore();

    // Draw Particles
    for (const p of this.particles) {
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;

    // Draw Floating Texts
    this.ctx.font = 'bold 20px system-ui';
    this.ctx.textAlign = 'center';
    for (const ft of this.floatTexts) {
      this.ctx.globalAlpha = Math.min(1, ft.life * 2);
      this.ctx.fillStyle = ft.color;
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 3;
      this.ctx.strokeText(ft.text, ft.x, ft.y);
      this.ctx.fillText(ft.text, ft.x, ft.y);
    }
    this.ctx.globalAlpha = 1.0;
  }

  private drawMarble(x: number, y: number, color: string, powerup?: string, radius: number = MARBLE_RADIUS) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    // Gradient for 3D sphere effect
    const grad = this.ctx.createRadialGradient(x - radius/3, y - radius/3, radius/10, x, y, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.2, color);
    grad.addColorStop(1, '#000000');
    
    this.ctx.fillStyle = grad;
    this.ctx.fill();
    
    // Highlight
    this.ctx.beginPath();
    this.ctx.arc(x - radius*0.3, y - radius*0.3, radius*0.3, 0, Math.PI*2);
    this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
    this.ctx.fill();

    if (powerup && radius === MARBLE_RADIUS) {
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      let icon = '⚡';
      if (powerup === 'BOMB') icon = '💣';
      else if (powerup === 'FROST') icon = '❄️';
      else if (powerup === 'BACKWARD') icon = '⏪';
      this.ctx.fillText(icon, x, y);
    }
  }

  private gameOver(win: boolean) {
    this.isGameOver = true;
    this.hasWon = win;
    this.playSound(win ? 'win' : 'gameover');
    if (win) {
      // Calculate stars based on speed/combo
      const scoreRatio = this.score / (this.totalMarblesToSpawn * 15);
      if (scoreRatio > 2.0) this.starsEarned = 3;
      else if (scoreRatio > 1.2) this.starsEarned = 2;
      else this.starsEarned = 1;
    }
  }
}
