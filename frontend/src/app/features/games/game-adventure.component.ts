import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

// 0=empty, 1=wall, 2=start, 3=exit, 4=enemy_path_h, 5=enemy_path_v
const LEVELS = [
  [ [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,0,1,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,0,1,0,1],
    [1,0,1,0,0,0,0,1,0,0,0,1],
    [1,0,1,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,0,1,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1] ],
  [ [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,2,0,0,0,1,0,0,0,1,0,0,0,1],
    [1,0,1,1,0,1,0,1,0,1,0,1,0,1],
    [1,0,0,1,0,0,0,1,0,0,0,1,0,1],
    [1,1,0,1,1,1,0,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1] ],
];

interface Enemy { r: number; c: number; dir: number; axis: 'h'|'v'; range: number[]; }

@Component({
  selector: 'app-game-adventure',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🗺️ Mission Sauvetage</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Niveau</span><span class="gp-score-value">{{levelIdx+1}}/{{totalLevels}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Temps</span><span class="gp-score-value">{{timerDisplay}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="gp-canvas-wrap">
          <canvas #cv></canvas>
          <div class="gp-overlay" *ngIf="!started || caught || won">
            <div class="gp-overlay-icon">{{won?'🎉':(caught?'💀':'🗺️')}}</div>
            <div class="gp-overlay-title">{{won?'Mission accomplie !':(caught?'Attrapé !':'Mission Sauvetage')}}</div>
            <div class="gp-overlay-sub" *ngIf="!started && !won && !caught">Atteignez la porte de sortie !</div>
            <div class="gp-overlay-score" *ngIf="won">Tous les niveaux terminés !</div>
            <button class="gp-btn" (click)="restart()">{{won||caught?'Rejouer':'Lancer'}}</button>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row"><span class="gp-key">WASD</span> Déplacer</div>
            <div class="gp-ctrl-row"><span class="gp-key">↑↓←→</span> Déplacer</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Légende</div>
            <div class="gp-ctrl-row"><span style="color:#0d9488">■</span> Héros</div>
            <div class="gp-ctrl-row"><span style="color:#dc2626">■</span> Ennemi</div>
            <div class="gp-ctrl-row"><span style="color:#f59e0b">■</span> Sortie</div>
            <div class="gp-ctrl-row"><span style="color:#334155">■</span> Mur</div>
          </div>
          <div class="touch-grid">
            <button class="touch-dir" (touchstart)="move(0,-1)">◀</button>
            <button class="touch-dir" (touchstart)="move(-1,0)">▲</button>
            <button class="touch-dir" (touchstart)="move(1,0)">▼</button>
            <button class="touch-dir" (touchstart)="move(0,1)">▶</button>
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
    .gp-overlay-score{font-size:16px;color:#0d9488;font-weight:700}
    .gp-btn{padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}
    .touch-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;place-items:center}
    .touch-dir{width:48px;height:48px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font-size:18px;cursor:pointer}
    .touch-dir:nth-child(1){grid-column:1;grid-row:2}
    .touch-dir:nth-child(2){grid-column:2;grid-row:1}
    .touch-dir:nth-child(3){grid-column:2;grid-row:3}
    .touch-dir:nth-child(4){grid-column:3;grid-row:2}
  `]
})
export class GameAdventureComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cv') cvRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private raf = 0;

  started = false; caught = false; won = false;
  levelIdx = 0; totalLevels = LEVELS.length;
  timerDisplay = '0:00';
  private seconds = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;

  private CELL = 48;
  private grid: number[][] = [];
  private playerR = 1; private playerC = 1;
  private enemies: Enemy[] = [];
  private enemyFrame = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.ctx = this.cvRef.nativeElement.getContext('2d')!;
    this.setupLevel();
    this.drawFrame();
  }

  private setupLevel() {
    this.grid = LEVELS[this.levelIdx % LEVELS.length].map(r => [...r]);
    const rows = this.grid.length; const cols = this.grid[0].length;
    this.cvRef.nativeElement.width = cols * this.CELL;
    this.cvRef.nativeElement.height = rows * this.CELL;
    this.enemies = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (this.grid[r][c] === 2) { this.playerR = r; this.playerC = c; this.grid[r][c] = 0; }
      }
    // Add some patrol enemies
    if (this.levelIdx === 0) {
      this.enemies = [
        { r: 5, c: 2, dir: 1, axis: 'h', range: [1, 8] },
        { r: 3, c: 7, dir: 1, axis: 'v', range: [1, 7] },
      ];
    } else {
      this.enemies = [
        { r: 3, c: 2, dir: 1, axis: 'h', range: [1, 12] },
        { r: 5, c: 7, dir: 1, axis: 'v', range: [1, 7] },
        { r: 2, c: 10, dir: -1, axis: 'v', range: [1, 6] },
      ];
    }
  }

  restart() {
    this.levelIdx = 0;
    this.caught = false; this.won = false; this.started = true;
    this.seconds = 0; this.timerDisplay = '0:00';
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.seconds++;
      const m = Math.floor(this.seconds / 60);
      const s = this.seconds % 60;
      this.timerDisplay = `${m}:${s.toString().padStart(2,'0')}`;
      this.cdr.detectChanges();
    }, 1000);
    this.setupLevel();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.gameLoop());
  }

  private gameLoop() {
    this.enemyFrame++;
    if (this.enemyFrame % 20 === 0) this.moveEnemies();
    this.checkCatch();
    this.drawFrame();
    if (this.started && !this.caught && !this.won) {
      this.raf = requestAnimationFrame(() => this.gameLoop());
    }
  }

  private moveEnemies() {
    for (const e of this.enemies) {
      const nr = e.axis === 'v' ? e.r + e.dir : e.r;
      const nc = e.axis === 'h' ? e.c + e.dir : e.c;
      const check = e.axis === 'v' ? nr : nc;
      const rangeOk = check >= e.range[0] && check <= e.range[1];
      if (rangeOk && this.grid[nr] && this.grid[nr][nc] !== 1) {
        e.r = nr; e.c = nc;
      } else {
        e.dir *= -1;
      }
    }
  }

  private checkCatch() {
    for (const e of this.enemies) {
      if (Math.abs(e.r - this.playerR) + Math.abs(e.c - this.playerC) < 1.5) {
        this.caught = true;
        cancelAnimationFrame(this.raf);
        if (this.timerId) clearInterval(this.timerId);
        this.cdr.detectChanges();
        return;
      }
    }
  }

  move(dr: number, dc: number) {
    if (!this.started || this.caught || this.won) return;
    const nr = this.playerR + dr; const nc = this.playerC + dc;
    if (nr < 0 || nr >= this.grid.length || nc < 0 || nc >= this.grid[0].length) return;
    if (this.grid[nr][nc] === 1) return;
    this.playerR = nr; this.playerC = nc;
    if (this.grid[nr][nc] === 3) {
      if (this.levelIdx + 1 < this.totalLevels) {
        this.levelIdx++;
        this.setupLevel();
      } else {
        this.won = true;
        cancelAnimationFrame(this.raf);
        if (this.timerId) clearInterval(this.timerId);
        this.cdr.detectChanges();
      }
    }
    this.checkCatch();
  }

  private drawFrame() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const C = this.CELL;
    const rows = this.grid.length; const cols = this.grid[0].length;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, cols * C, rows * C);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = this.grid[r][c];
        if (v === 1) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(c*C, r*C, C, C);
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.fillRect(c*C+1, r*C+1, C-2, 4);
        } else if (v === 3) {
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(c*C+4, r*C+4, C-8, C-8);
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 20px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('🚪', c*C + C/2, r*C + C/2 + 8);
        } else {
          ctx.fillStyle = 'rgba(30,41,59,0.4)';
          ctx.fillRect(c*C, r*C, C, C);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r*C); ctx.lineTo(cols*C, r*C); ctx.stroke(); }
    for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c*C, 0); ctx.lineTo(c*C, rows*C); ctx.stroke(); }

    // Enemies
    for (const e of this.enemies) {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(e.c*C+6, e.r*C+6, C-12, C-12);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(e.c*C+10, e.r*C+10, 8, 8);
      ctx.fillRect(e.c*C+C-18, e.r*C+10, 8, 8);
      ctx.fillStyle = '#000';
      ctx.fillRect(e.c*C+12, e.r*C+12, 4, 4);
      ctx.fillRect(e.c*C+C-16, e.r*C+12, 4, 4);
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 8;
      ctx.shadowBlur = 0;
    }

    // Player
    const px = this.playerC*C; const py = this.playerR*C;
    ctx.fillStyle = '#0d9488';
    ctx.fillRect(px+6, py+6, C-12, C-12);
    ctx.fillStyle = '#5eead4';
    ctx.fillRect(px+10, py+10, 8, 8);
    ctx.fillRect(px+C-18, py+10, 8, 8);
    ctx.fillStyle = '#134e4a';
    ctx.fillRect(px+12, py+12, 4, 4);
    ctx.fillRect(px+C-16, py+12, 4, 4);
    ctx.shadowColor = '#0d9488';
    ctx.shadowBlur = 12;
    ctx.fillRect(px+6, py+6, C-12, C-12);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (!this.started) return;
    const map: Record<string, [number,number]> = {
      ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1],
      w: [-1,0], s: [1,0], a: [0,-1], d: [0,1],
      W: [-1,0], S: [1,0], A: [0,-1], D: [0,1],
    };
    if (map[e.key]) { e.preventDefault(); this.move(map[e.key][0], map[e.key][1]); }
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    if (this.timerId) clearInterval(this.timerId);
  }
}
