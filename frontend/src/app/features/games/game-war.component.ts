import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

type TowerType = 'gun'|'laser'|'rocket';

interface Tower { x: number; y: number; type: TowerType; cooldown: number; range: number; dmg: number; color: string; }
interface Enemy { x: number; y: number; hp: number; maxHp: number; speed: number; pathIdx: number; reward: number; }
interface Projectile { x: number; y: number; tx: number; ty: number; speed: number; dmg: number; color: string; t: number; }

const PATH: [number,number][] = [
  [0,200],[80,200],[80,100],[200,100],[200,300],[320,300],[320,150],[460,150],[460,350],[600,350],[600,200],[720,200]
];

const TOWER_DATA: Record<TowerType, {cost:number;range:number;dmg:number;cooldown:number;color:string;label:string}> = {
  gun:    { cost: 50,  range: 100, dmg: 10,  cooldown: 30,  color: '#0d9488', label: 'Pistolet 50¢' },
  laser:  { cost: 100, range: 140, dmg: 25,  cooldown: 20,  color: '#7c3aed', label: 'Laser 100¢' },
  rocket: { cost: 200, range: 180, dmg: 60,  cooldown: 60,  color: '#dc2626', label: 'Roquette 200¢' },
};

@Component({
  selector: 'app-game-war',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">⚔️ Tour de Défense</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Or</span><span class="gp-score-value">{{gold}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Vies</span><span class="gp-score-value">{{lives}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Vague</span><span class="gp-score-value">{{wave}}/10</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Score</span><span class="gp-score-value">{{score}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="gp-canvas-wrap">
          <canvas #cv (click)="canvasClick($event)"></canvas>
          <div class="gp-overlay" *ngIf="!started || gameOver || won">
            <div class="gp-overlay-icon">{{won?'🏆':(gameOver?'💀':'⚔️')}}</div>
            <div class="gp-overlay-title">{{won?'Victoire !': (gameOver?'Défaite !':'Tower Defense')}}</div>
            <div class="gp-overlay-score" *ngIf="gameOver||won">Score : {{score}}</div>
            <div class="gp-overlay-sub" *ngIf="!started">Cliquez sur le canvas pour poser des tourelles</div>
            <button class="gp-btn" (click)="restart()">{{gameOver||won?'Rejouer':'Commencer'}}</button>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Tourelles</div>
            <div class="wr-tower-btn" *ngFor="let t of towerTypes"
              [class.wr-selected]="selectedTower===t"
              [class.wr-disabled]="gold < TOWER_DATA[t].cost"
              (click)="selectTower(t)">
              <span class="wr-icon" [style.color]="TOWER_DATA[t].color">■</span>
              <span class="wr-label">{{TOWER_DATA[t].label}}</span>
            </div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row">Sélectionnez une tourelle puis cliquez sur le terrain pour la poser</div>
          </div>
          <div class="gp-panel" *ngIf="!waveActive">
            <button class="gp-btn" style="width:100%;padding:10px" (click)="startWave()" [disabled]="waveActive">
              Vague {{wave}} →
            </button>
          </div>
          <div class="gp-panel" *ngIf="waveActive">
            <div style="font-size:12px;color:#94a3b8;text-align:center">Ennemis restants : {{enemies.length}}</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host{display:block;height:100vh;overflow:hidden;background:#0a0e1a}
    .gp{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:linear-gradient(135deg,#0a0e1a,#0f172a);font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
    .gp-header{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08)}
    .gp-back{color:#64748b;text-decoration:none;font-size:13px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1)}
    .gp-back:hover{color:#0d9488;border-color:#0d9488}
    .gp-title{font-size:18px;font-weight:800;color:#f1f5f9}
    .gp-scores{display:flex;gap:12px}
    .gp-score-item{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.05);border-radius:10px;padding:4px 10px;border:1px solid rgba(255,255,255,.08);min-width:48px}
    .gp-score-label{font-size:9px;text-transform:uppercase;color:#64748b}
    .gp-score-value{font-size:16px;font-weight:800;color:#0d9488;line-height:1.2}
    .gp-body{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:20px;padding:12px 20px;overflow:hidden}
    .gp-canvas-wrap{position:relative;flex-shrink:0}
    canvas{display:block;border-radius:12px;box-shadow:0 0 60px rgba(13,148,136,.3);border:1px solid rgba(13,148,136,.3);cursor:crosshair}
    .gp-sidebar{width:180px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
    .gp-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
    .gp-panel-title{font-size:9px;text-transform:uppercase;color:#64748b;margin-bottom:8px;font-weight:600}
    .gp-ctrl-row{font-size:11px;color:#64748b;line-height:1.4}
    .wr-tower-btn{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:8px;cursor:pointer;margin-bottom:4px;border:1px solid rgba(255,255,255,.06);transition:all .15s}
    .wr-tower-btn:hover{background:rgba(255,255,255,.06)}
    .wr-selected{background:rgba(13,148,136,.2)!important;border-color:#0d9488!important}
    .wr-disabled{opacity:.4;cursor:not-allowed}
    .wr-icon{font-size:16px}
    .wr-label{font-size:11px;color:#94a3b8}
    .gp-btn{padding:12px 28px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:14px;font-weight:700;cursor:pointer;margin-top:4px}
    .gp-btn:disabled{opacity:.5;cursor:default}
    .gp-overlay{position:absolute;inset:0;background:rgba(10,14,26,.85);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;gap:8px}
    .gp-overlay-icon{font-size:40px}
    .gp-overlay-title{font-size:28px;font-weight:900;color:#f1f5f9}
    .gp-overlay-sub{font-size:13px;color:#64748b;text-align:center;max-width:240px}
    .gp-overlay-score{font-size:18px;font-weight:700;color:#0d9488}
  `]
})
export class GameWarComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cv') cvRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private raf = 0;

  gold = 150; lives = 20; wave = 1; score = 0;
  started = false; gameOver = false; won = false; waveActive = false;

  private W = 740; private H = 440;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private spawnQueue: number[] = [];
  private spawnTimer = 0;

  selectedTower: TowerType = 'gun';
  towerTypes: TowerType[] = ['gun','laser','rocket'];
  readonly TOWER_DATA = TOWER_DATA;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    const h = Math.min(window.innerHeight - 80, 460);
    const w = Math.min(window.innerWidth - 240, 760);
    this.W = w; this.H = h;
    const cv = this.cvRef.nativeElement;
    cv.width = this.W; cv.height = this.H;
    this.ctx = cv.getContext('2d')!;
    this.drawFrame();
  }

  restart() {
    this.gold = 150; this.lives = 20; this.wave = 1; this.score = 0;
    this.started = true; this.gameOver = false; this.won = false; this.waveActive = false;
    this.towers = []; this.enemies = []; this.projectiles = [];
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.loop());
    this.cdr.detectChanges();
  }

  selectTower(t: TowerType) {
    if (this.gold >= TOWER_DATA[t].cost) this.selectedTower = t;
  }

  canvasClick(e: MouseEvent) {
    if (!this.started || this.gameOver || this.won) return;
    const rect = this.cvRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (this.gold < TOWER_DATA[this.selectedTower].cost) return;
    if (this.isOnPath(x, y)) return;
    if (this.towers.some(t => Math.hypot(t.x - x, t.y - y) < 30)) return;
    const d = TOWER_DATA[this.selectedTower];
    this.towers.push({ x, y, type: this.selectedTower, cooldown: 0, range: d.range, dmg: d.dmg, color: d.color });
    this.gold -= d.cost;
    this.cdr.detectChanges();
  }

  private isOnPath(x: number, y: number): boolean {
    for (let i = 0; i < PATH.length - 1; i++) {
      const [ax, ay] = PATH[i]; const [bx, by] = PATH[i+1];
      const dx = bx - ax; const dy = by - ay; const len = Math.hypot(dx, dy);
      const t = Math.max(0, Math.min(1, ((x-ax)*dx + (y-ay)*dy) / (len*len)));
      const cx = ax + t*dx; const cy = ay + t*dy;
      if (Math.hypot(x - cx, y - cy) < 30) return true;
    }
    return false;
  }

  startWave() {
    if (this.waveActive) return;
    const count = 5 + this.wave * 2;
    const hp = 30 + this.wave * 15;
    const speed = 1 + this.wave * 0.1;
    this.spawnQueue = Array(count).fill(0).map((_, i) => i * 40);
    this.waveActive = true;
    this.cdr.detectChanges();
  }

  private loop() {
    if (this.gameOver || this.won) return;
    if (this.started) this.update();
    this.drawFrame();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  private update() {
    // Spawn enemies
    if (this.waveActive && this.spawnQueue.length > 0) {
      this.spawnTimer++;
      if (this.spawnTimer >= this.spawnQueue[0]) {
        this.spawnQueue.shift();
        const hp = 30 + this.wave * 15;
        const speed = 1 + this.wave * 0.1;
        this.enemies.push({ x: PATH[0][0], y: PATH[0][1], hp, maxHp: hp, speed, pathIdx: 0, reward: 10 + this.wave * 2 });
      }
    }

    // Move enemies
    this.enemies = this.enemies.filter(e => {
      const target = PATH[e.pathIdx + 1];
      if (!target) { this.lives--; this.cdr.detectChanges(); if (this.lives <= 0) { this.gameOver = true; cancelAnimationFrame(this.raf); } return false; }
      const dx = target[0] - e.x; const dy = target[1] - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist < e.speed) { e.x = target[0]; e.y = target[1]; e.pathIdx++; }
      else { e.x += dx/dist * e.speed; e.y += dy/dist * e.speed; }
      return true;
    });

    // Towers shoot
    for (const t of this.towers) {
      if (t.cooldown > 0) { t.cooldown--; continue; }
      const target = this.enemies.find(e => Math.hypot(e.x - t.x, e.y - t.y) < t.range);
      if (target) {
        this.projectiles.push({ x: t.x, y: t.y, tx: target.x, ty: target.y, speed: 6, dmg: t.dmg, color: t.color, t: 0 });
        t.cooldown = TOWER_DATA[t.type].cooldown;
      }
    }

    // Move projectiles
    this.projectiles = this.projectiles.filter(p => {
      p.t += p.speed / Math.hypot(p.tx - p.x, p.ty - p.y);
      if (p.t >= 1) {
        // Hit nearest enemy
        const hit = this.enemies.find(e => Math.hypot(e.x - p.tx, e.y - p.ty) < 20);
        if (hit) {
          hit.hp -= p.dmg;
          if (hit.hp <= 0) {
            this.gold += hit.reward; this.score += hit.reward * 2;
            this.enemies = this.enemies.filter(e => e !== hit);
            this.cdr.detectChanges();
          }
        }
        return false;
      }
      return true;
    });

    // Wave done
    if (this.waveActive && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      this.waveActive = false;
      if (this.wave >= 10) { this.won = true; cancelAnimationFrame(this.raf); }
      else this.wave++;
      this.cdr.detectChanges();
    }
  }

  private drawFrame() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0d1b2e';
    ctx.fillRect(0, 0, this.W, this.H);

    // Draw path
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 50;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(PATH[0][0], PATH[0][1]);
    for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i][0], PATH[i][1]);
    ctx.stroke();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 44;
    ctx.beginPath();
    ctx.moveTo(PATH[0][0], PATH[0][1]);
    for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i][0], PATH[i][1]);
    ctx.stroke();

    // Path arrows
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    for (let i = 0; i < PATH.length - 1; i++) {
      const [ax, ay] = PATH[i]; const [bx, by] = PATH[i+1];
      const mx = (ax+bx)/2; const my = (ay+by)/2;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }

    // Towers
    for (const t of this.towers) {
      ctx.fillStyle = 'rgba(30,41,59,0.8)';
      ctx.beginPath(); ctx.arc(t.x, t.y, 18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = t.color;
      ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(t.x - 2, t.y - 16, 4, 12);
      // Range circle on hover (always show faintly)
      ctx.strokeStyle = t.color + '22';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.range, 0, Math.PI*2); ctx.stroke();
    }

    // Projectiles
    for (const p of this.projectiles) {
      const cx = p.x + (p.tx - p.x) * p.t;
      const cy = p.y + (p.ty - p.y) * p.t;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.fill();
    }

    // Enemies
    for (const e of this.enemies) {
      // HP bar
      const bw = 30; const bh = 4;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(e.x - bw/2, e.y - 18, bw, bh);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(e.x - bw/2, e.y - 18, bw * (e.hp/e.maxHp), bh);
      ctx.fillStyle = '#f97316';
      const sz = 12;
      ctx.fillRect(e.x - sz/2, e.y - sz/2, sz, sz);
      ctx.fillStyle = 'rgba(249,115,22,0.4)';
      ctx.beginPath(); ctx.arc(e.x, e.y, 8, 0, Math.PI*2); ctx.fill();
    }

    // Start/End markers
    ctx.fillStyle = '#0d9488';
    ctx.beginPath(); ctx.arc(PATH[0][0], PATH[0][1], 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(PATH[PATH.length-1][0], PATH[PATH.length-1][1], 10, 0, Math.PI*2); ctx.fill();
  }

  ngOnDestroy() { cancelAnimationFrame(this.raf); }
}
