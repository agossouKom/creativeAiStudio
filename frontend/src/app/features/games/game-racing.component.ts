import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Car { x: number; lane: number; color: string; w: number; h: number; }

@Component({
  selector: 'app-game-racing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🏎️ Course Voiture</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Score</span><span class="gp-score-value">{{score}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Vitesse</span><span class="gp-score-value">{{speedDisplay}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Best</span><span class="gp-score-value">{{best}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="gp-canvas-wrap">
          <canvas #cv></canvas>
          <div class="gp-overlay" *ngIf="gameOver || !started">
            <div class="gp-overlay-icon">🏎️</div>
            <div class="gp-overlay-title">{{gameOver ? 'Crash !' : 'Prêt ?'}}</div>
            <div class="gp-overlay-score" *ngIf="gameOver">Score : {{score}}</div>
            <div class="gp-overlay-sub" *ngIf="!gameOver">Évite les voitures adverses !</div>
            <button class="gp-btn" (click)="restart()">{{gameOver ? 'Rejouer' : 'Démarrer'}}</button>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row"><span class="gp-key">←</span> Voie gauche</div>
            <div class="gp-ctrl-row"><span class="gp-key">→</span> Voie droite</div>
            <div class="gp-ctrl-row"><span class="gp-key">Souris</span> Glisser</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">À propos</div>
            <p style="font-size:12px;color:#64748b;line-height:1.5">Déplace ta voiture pour éviter les adversaires. La vitesse augmente au fil du temps !</p>
          </div>
          <div class="touch-btns">
            <button class="touch-btn" (touchstart)="keys['ArrowLeft']=true" (touchend)="keys['ArrowLeft']=false">◀</button>
            <button class="touch-btn" (touchstart)="keys['ArrowRight']=true" (touchend)="keys['ArrowRight']=false">▶</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host{display:block;height:100vh;overflow:hidden;background:#0a0e1a}
    .gp{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:linear-gradient(135deg,#0a0e1a,#0f172a);font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
    .gp-header{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08)}
    .gp-back{color:#64748b;text-decoration:none;font-size:13px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);transition:all .2s}
    .gp-back:hover{color:#0d9488;border-color:#0d9488}
    .gp-title{font-size:18px;font-weight:800;color:#f1f5f9;text-shadow:0 0 20px rgba(13,148,136,.5)}
    .gp-scores{display:flex;gap:16px}
    .gp-score-item{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.05);border-radius:10px;padding:6px 14px;border:1px solid rgba(255,255,255,.08);min-width:60px}
    .gp-score-label{font-size:9px;text-transform:uppercase;color:#64748b}
    .gp-score-value{font-size:18px;font-weight:800;color:#0d9488;line-height:1.2}
    .gp-body{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:20px;padding:12px 20px;overflow:hidden}
    .gp-canvas-wrap{position:relative;flex-shrink:0}
    canvas{display:block;border-radius:12px;box-shadow:0 0 60px rgba(13,148,136,.3);border:1px solid rgba(13,148,136,.3)}
    .gp-sidebar{width:180px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
    .gp-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
    .gp-panel-title{font-size:9px;text-transform:uppercase;color:#64748b;margin-bottom:8px;font-weight:600}
    .gp-ctrl-row{display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;margin-bottom:4px}
    .gp-key{background:rgba(255,255,255,.1);border-radius:4px;border:1px solid rgba(255,255,255,.2);padding:1px 6px;font-size:11px;font-weight:700;color:#e2e8f0;font-family:monospace}
    .gp-overlay{position:absolute;inset:0;background:rgba(10,14,26,.85);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;gap:8px}
    .gp-overlay-icon{font-size:40px}
    .gp-overlay-title{font-size:28px;font-weight:900;color:#f1f5f9}
    .gp-overlay-sub{font-size:14px;color:#64748b}
    .gp-overlay-score{font-size:20px;font-weight:700;color:#0d9488}
    .gp-btn{padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}
    .gp-btn:hover{transform:translateY(-2px)}
    .touch-btns{display:flex;gap:12px;justify-content:center}
    .touch-btn{width:64px;height:64px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font-size:24px;cursor:pointer;touch-action:none}
  `]
})
export class GameRacingComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cv') cvRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private raf = 0;

  score = 0; best = 0; speedDisplay = '0 km/h';
  gameOver = false; started = false;

  private W = 320; private H = 520;
  private LANES = 3; private LANE_W = 90;
  private playerLane = 1;
  private playerX = 0;
  private roadOffset = 0;
  private enemies: Car[] = [];
  private frameCount = 0;
  private speed = 4;
  private spawnIn = 60;
  keys: Record<string, boolean> = {};
  private laneChangeCooldown = 0;
  private particles: {x:number;y:number;vx:number;vy:number;life:number}[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    const h = Math.min(window.innerHeight - 80, 540);
    this.H = h; this.W = Math.round(h * 320/520);
    this.LANE_W = Math.floor(this.W / 3);
    const cv = this.cvRef.nativeElement;
    cv.width = this.W; cv.height = this.H;
    this.ctx = cv.getContext('2d')!;
    this.playerX = this.W / 2;
    cv.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.started || this.gameOver) return;
      const rect = cv.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const lane = Math.floor(x / this.LANE_W);
      this.playerLane = Math.max(0, Math.min(2, lane));
    });
    this.drawIdle();
  }

  restart() {
    this.score = 0; this.frameCount = 0; this.speed = 4;
    this.gameOver = false; this.started = true;
    this.enemies = []; this.particles = [];
    this.playerLane = 1; this.spawnIn = 60;
    this.playerX = this.W / 2;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.loop());
  }

  private loop() {
    if (this.gameOver) return;
    this.update();
    this.draw();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  private update() {
    this.frameCount++;
    this.score = Math.floor(this.frameCount / 6);
    this.speed = 4 + this.frameCount / 300;
    this.speedDisplay = `${Math.round(this.speed * 30)} km/h`;

    if (this.laneChangeCooldown > 0) this.laneChangeCooldown--;
    if (this.laneChangeCooldown === 0) {
      if (this.keys['ArrowLeft'] && this.playerLane > 0) { this.playerLane--; this.laneChangeCooldown = 15; }
      if (this.keys['ArrowRight'] && this.playerLane < 2) { this.playerLane++; this.laneChangeCooldown = 15; }
    }

    const targetX = this.LANE_W * this.playerLane + this.LANE_W / 2;
    this.playerX += (targetX - this.playerX) * 0.2;

    this.roadOffset = (this.roadOffset + this.speed) % 80;

    this.spawnIn--;
    if (this.spawnIn <= 0) {
      const lane = Math.floor(Math.random() * 3);
      const colors = ['#dc2626','#d97706','#7c3aed','#1e40af'];
      this.enemies.push({ x: this.LANE_W * lane + this.LANE_W/2, lane, color: colors[Math.floor(Math.random()*colors.length)], w: 34, h: 56 });
      this.spawnIn = Math.max(25, 60 - this.frameCount / 100);
    }

    this.enemies.forEach(e => { e.x += (this.LANE_W * e.lane + this.LANE_W/2 - e.x) * 0.1; });
    this.enemies = this.enemies.filter(e => { return true; });
    this.enemies.forEach(car => {
      (car as any).y = ((car as any).y ?? -100) + this.speed;
    });
    this.enemies = this.enemies.filter(car => (car as any).y < this.H + 80);

    const playerY = this.H - 80;
    for (const e of this.enemies) {
      const ey = (e as any).y ?? 0;
      if (Math.abs(e.x - this.playerX) < 30 && Math.abs(ey - playerY) < 50) {
        this.gameOver = true;
        if (this.score > this.best) { this.best = this.score; localStorage.setItem('racing-best', String(this.best)); }
        this.cdr.detectChanges();
        return;
      }
    }
  }

  private drawIdle() {
    if (!this.ctx) return;
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  private draw() {
    const ctx = this.ctx;
    // Road
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, this.W, this.H);

    // Lane markings
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    for (let l = 1; l < this.LANES; l++) {
      ctx.setLineDash([40, 40]);
      ctx.beginPath();
      ctx.moveTo(l * this.LANE_W, 0);
      ctx.lineTo(l * this.LANE_W, this.H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Road edges
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 6, this.H);
    ctx.fillRect(this.W - 6, 0, 6, this.H);

    // Speed lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const y = ((i * 80 + this.roadOffset) % this.H);
      ctx.beginPath();
      ctx.moveTo(20, y);
      ctx.lineTo(20, y + 40);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.W - 20, y);
      ctx.lineTo(this.W - 20, y + 40);
      ctx.stroke();
    }

    // Enemy cars
    this.enemies.forEach(car => {
      const ey = (car as any).y ?? 0;
      this.drawCar(ctx, car.x, ey, car.color, false);
    });

    // Player car
    const playerY = this.H - 80;
    this.drawCar(ctx, this.playerX, playerY, '#0d9488', true);

    // Score on canvas
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.score}`, this.W - 10, 20);
    ctx.textAlign = 'left';
  }

  private drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, isPlayer: boolean) {
    const cw = 34; const ch = 56;
    ctx.fillStyle = color;
    ctx.fillRect(x - cw/2, y - ch/2, cw, ch);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x - cw/2 + 3, y - ch/2 + 5, cw - 6, 12);
    ctx.fillRect(x - cw/2 + 3, y - ch/2 + 30, cw - 6, 10);
    ctx.fillStyle = isPlayer ? '#fbbf24' : 'rgba(255,255,255,0.6)';
    if (!isPlayer) {
      ctx.fillRect(x - cw/2 + 3, y - ch/2, 10, 8);
      ctx.fillRect(x + cw/2 - 13, y - ch/2, 10, 8);
    } else {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(x - cw/2 + 3, y + ch/2 - 8, 10, 8);
      ctx.fillRect(x + cw/2 - 13, y + ch/2 - 8, 10, 8);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - cw/2, y - ch/2, cw, ch);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent) {
    this.keys[e.key] = true;
    if (['ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
  }
  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent) { this.keys[e.key] = false; }

  ngOnDestroy() { cancelAnimationFrame(this.raf); }
}
