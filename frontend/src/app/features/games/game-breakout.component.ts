import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Brick { x: number; y: number; w: number; h: number; hp: number; color: string; visible: boolean; }
interface Ball { x: number; y: number; vx: number; vy: number; r: number; }
interface PowerUp { x: number; y: number; vy: number; type: 'wide'|'multi'|'life'; color: string; }

const BRICK_COLORS: Record<number, string> = { 1: '#0d9488', 2: '#d97706', 3: '#dc2626' };

@Component({
  selector: 'app-game-breakout',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🧱 Casse Briques</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Score</span><span class="gp-score-value">{{score}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Vies</span><span class="gp-score-value">{{lives}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Niveau</span><span class="gp-score-value">{{level}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="gp-canvas-wrap">
          <canvas #cv></canvas>
          <div class="gp-overlay" *ngIf="gameOver || !started">
            <div class="gp-overlay-icon">🧱</div>
            <div class="gp-overlay-title">{{gameOver ? 'Game Over' : 'Casse Briques'}}</div>
            <div class="gp-overlay-score" *ngIf="gameOver">Score : {{score}}</div>
            <div class="gp-overlay-sub" *ngIf="!gameOver">Déplace la raquette pour viser !</div>
            <button class="gp-btn" (click)="restart()">{{gameOver ? 'Rejouer' : 'Jouer'}}</button>
          </div>
          <div class="gp-overlay" *ngIf="levelWon">
            <div class="gp-overlay-icon">🎉</div>
            <div class="gp-overlay-title">Niveau {{level}} terminé !</div>
            <div class="gp-overlay-score">Score : {{score}}</div>
            <button class="gp-btn" (click)="nextLevel()">Niveau suivant</button>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row"><span class="gp-key">←→</span> Raquette</div>
            <div class="gp-ctrl-row"><span class="gp-key">Souris</span> Viser</div>
            <div class="gp-ctrl-row"><span class="gp-key">Touch</span> Glisser</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Power-ups</div>
            <div class="gp-ctrl-row" style="color:#0d9488">🟢 Large raquette</div>
            <div class="gp-ctrl-row" style="color:#d97706">🟡 Multi-balles</div>
            <div class="gp-ctrl-row" style="color:#dc2626">🔴 Vie extra</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Briques</div>
            <div class="gp-ctrl-row" style="color:#0d9488">■ 1 coup</div>
            <div class="gp-ctrl-row" style="color:#d97706">■ 2 coups</div>
            <div class="gp-ctrl-row" style="color:#dc2626">■ 3 coups</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host{display:block;height:100vh;overflow:hidden;background:#0a0e1a}
    .gp{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:linear-gradient(135deg,#0a0e1a 0%,#0f172a 50%,#0a1628 100%);font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
    .gp-header{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08);backdrop-filter:blur(10px)}
    .gp-back{display:flex;align-items:center;gap:6px;color:#64748b;text-decoration:none;font-size:13px;font-weight:500;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);transition:all .2s}
    .gp-back:hover{color:#0d9488;border-color:#0d9488;background:rgba(13,148,136,.1)}
    .gp-title{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;color:#f1f5f9;text-shadow:0 0 20px rgba(13,148,136,.5)}
    .gp-scores{display:flex;gap:16px}
    .gp-score-item{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.05);border-radius:10px;padding:6px 14px;border:1px solid rgba(255,255,255,.08);min-width:60px}
    .gp-score-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}
    .gp-score-value{font-size:18px;font-weight:800;color:#0d9488;line-height:1.2}
    .gp-body{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:20px;padding:12px 20px;overflow:hidden}
    .gp-canvas-wrap{position:relative;flex-shrink:0}
    canvas{display:block;border-radius:12px;box-shadow:0 0 60px rgba(13,148,136,.3),0 0 120px rgba(13,148,136,.1);border:1px solid rgba(13,148,136,.3)}
    .gp-sidebar{width:180px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
    .gp-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
    .gp-panel-title{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:8px;font-weight:600}
    .gp-ctrl-row{display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;margin-bottom:4px}
    .gp-key{background:rgba(255,255,255,.1);border-radius:4px;border:1px solid rgba(255,255,255,.2);padding:1px 6px;font-size:11px;font-weight:700;color:#e2e8f0;font-family:monospace;min-width:22px;text-align:center}
    .gp-overlay{position:absolute;inset:0;background:rgba(10,14,26,.85);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;gap:8px}
    .gp-overlay-icon{font-size:40px;margin-bottom:4px}
    .gp-overlay-title{font-size:28px;font-weight:900;color:#f1f5f9;letter-spacing:-.02em}
    .gp-overlay-sub{font-size:14px;color:#64748b}
    .gp-overlay-score{font-size:20px;font-weight:700;color:#0d9488;margin:4px 0}
    .gp-btn{padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(13,148,136,.4);margin-top:8px;transition:transform .1s}
    .gp-btn:hover{transform:translateY(-2px)}
    .gp-btn:active{transform:translateY(0)}
  `]
})
export class GameBreakoutComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cv') cvRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private raf = 0;

  score = 0; lives = 3; level = 1;
  gameOver = false; started = false; levelWon = false;

  private W = 600; private H = 480;
  private paddle = { x: 250, y: 440, w: 100, h: 12, speed: 8 };
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private powerUps: PowerUp[] = [];
  private keys: Record<string, boolean> = {};
  private wideTimer = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    const sz = this.calcSize();
    this.W = sz.w; this.H = sz.h;
    const cv = this.cvRef.nativeElement;
    cv.width = this.W; cv.height = this.H;
    this.ctx = cv.getContext('2d')!;
    this.setupEvents();
    this.drawIdle();
  }

  private calcSize() {
    const h = Math.min(window.innerHeight - 80, 520);
    const w = Math.min(window.innerWidth - 260, 640);
    return { w, h };
  }

  private setupEvents() {
    const cv = this.cvRef.nativeElement;
    cv.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = cv.getBoundingClientRect();
      this.paddle.x = e.clientX - rect.left - this.paddle.w / 2;
      this.clampPaddle();
    });
    cv.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      this.paddle.x = e.touches[0].clientX - rect.left - this.paddle.w / 2;
      this.clampPaddle();
    }, { passive: false });
  }

  private clampPaddle() {
    this.paddle.x = Math.max(0, Math.min(this.W - this.paddle.w, this.paddle.x));
  }

  private buildBricks() {
    this.bricks = [];
    const cols = 8; const rows = 6;
    const bw = (this.W - 40) / cols; const bh = 22;
    const maxHp = Math.min(this.level, 3);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hp = Math.max(1, maxHp - Math.floor(r / 2));
        const clampedHp = Math.min(hp, 3) as 1|2|3;
        this.bricks.push({
          x: 20 + c * bw, y: 50 + r * (bh + 4),
          w: bw - 4, h: bh, hp: clampedHp,
          color: BRICK_COLORS[clampedHp], visible: true
        });
      }
    }
  }

  private spawnBall() {
    const speed = 4 + this.level * 0.5;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 4;
    this.balls.push({
      x: this.paddle.x + this.paddle.w / 2,
      y: this.paddle.y - 8,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 7
    });
  }

  restart() {
    this.score = 0; this.lives = 3; this.level = 1;
    this.gameOver = false; this.started = true; this.levelWon = false;
    this.paddle.w = 100;
    this.paddle.x = this.W / 2 - 50;
    this.paddle.y = this.H - 40;
    this.powerUps = [];
    this.buildBricks();
    this.balls = [];
    this.spawnBall();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.loop());
  }

  nextLevel() {
    this.level++;
    this.levelWon = false;
    this.paddle.w = 100;
    this.paddle.x = this.W / 2 - 50;
    this.powerUps = [];
    this.buildBricks();
    this.balls = [];
    this.spawnBall();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.loop());
  }

  private loop() {
    if (this.gameOver || this.levelWon) return;
    this.update();
    this.draw();
    this.raf = requestAnimationFrame(() => this.loop());
  }

  private update() {
    if (this.keys['ArrowLeft']) { this.paddle.x -= this.paddle.speed; this.clampPaddle(); }
    if (this.keys['ArrowRight']) { this.paddle.x += this.paddle.speed; this.clampPaddle(); }
    if (this.wideTimer > 0) { this.wideTimer--; if (this.wideTimer === 0) this.paddle.w = 100; }

    this.balls = this.balls.filter(ball => {
      ball.x += ball.vx; ball.y += ball.vy;
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x + ball.r > this.W) { ball.x = this.W - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
      if (ball.y + ball.r > this.H + 20) return false;

      // Paddle collision
      if (ball.y + ball.r > this.paddle.y && ball.y - ball.r < this.paddle.y + this.paddle.h
          && ball.x > this.paddle.x && ball.x < this.paddle.x + this.paddle.w) {
        ball.vy = -Math.abs(ball.vy);
        const hit = (ball.x - (this.paddle.x + this.paddle.w / 2)) / (this.paddle.w / 2);
        ball.vx = hit * 6;
      }

      // Brick collisions
      for (const b of this.bricks) {
        if (!b.visible) continue;
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w
            && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
          b.hp--;
          if (b.hp <= 0) {
            b.visible = false;
            this.score += 10 * this.level;
            if (Math.random() < 0.15) {
              const types: ('wide'|'multi'|'life')[] = ['wide','multi','life'];
              const type = types[Math.floor(Math.random() * 3)];
              const colors: Record<string, string> = { wide: '#0d9488', multi: '#d97706', life: '#dc2626' };
              this.powerUps.push({ x: b.x + b.w/2, y: b.y + b.h/2, vy: 2, type, color: colors[type] });
            }
          } else {
            b.color = BRICK_COLORS[Math.min(b.hp, 3) as 1|2|3];
          }
          const dx = ball.x - Math.max(b.x, Math.min(ball.x, b.x + b.w));
          const dy = ball.y - Math.max(b.y, Math.min(ball.y, b.y + b.h));
          if (Math.abs(dx) > Math.abs(dy)) ball.vx *= -1; else ball.vy *= -1;
          break;
        }
      }
      return true;
    });

    // Power-ups
    this.powerUps = this.powerUps.filter(p => {
      p.y += p.vy;
      if (p.y > this.paddle.y && p.y < this.paddle.y + this.paddle.h
          && p.x > this.paddle.x && p.x < this.paddle.x + this.paddle.w) {
        if (p.type === 'wide') { this.paddle.w = Math.min(180, this.paddle.w + 40); this.wideTimer = 300; }
        else if (p.type === 'multi') { if (this.balls.length > 0) { const b = this.balls[0]; this.balls.push({...b, vx: -b.vx * 0.9}); } }
        else if (p.type === 'life') { this.lives++; }
        this.cdr.detectChanges();
        return false;
      }
      return p.y < this.H + 20;
    });

    // Ball lost
    if (this.balls.length === 0) {
      this.lives--;
      this.cdr.detectChanges();
      if (this.lives <= 0) { this.gameOver = true; cancelAnimationFrame(this.raf); return; }
      this.spawnBall();
    }

    // Level won
    if (this.bricks.every(b => !b.visible)) {
      this.levelWon = true;
      cancelAnimationFrame(this.raf);
      this.cdr.detectChanges();
    }
  }

  private drawIdle() {
    if (!this.ctx) return;
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#050d1a';
    ctx.fillRect(0, 0, this.W, this.H);

    // Bricks
    this.bricks.forEach(b => {
      if (!b.visible) return;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x + 1, b.y + b.h - 4, b.w - 2, 3);
    });

    // Power-ups
    this.powerUps.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(p.x - 2, p.y - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Paddle
    ctx.fillStyle = '#0d9488';
    ctx.beginPath();
    ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(this.paddle.x + 4, this.paddle.y + 2, this.paddle.w - 8, 3);

    // Balls
    this.balls.forEach(ball => {
      ctx.fillStyle = '#5eead4';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(ball.x - 2, ball.y - 2, ball.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });
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
