import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

const COLS = 10, ROWS = 20, CELL = 28;
const COLORS = ['#0d9488','#1e40af','#7c3aed','#dc2626','#d97706','#059669','#db2777'];
const PIECES = [
  [[1,1,1,1]],
  [[1,1],[1,1]],
  [[0,1,0],[1,1,1]],
  [[1,0,0],[1,1,1]],
  [[0,0,1],[1,1,1]],
  [[0,1,1],[1,1,0]],
  [[1,1,0],[0,1,1]]
];

@Component({
  selector: 'app-game-tetris',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🟦 Tetris Designs</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Score</span><span class="gp-score-value">{{score}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Lignes</span><span class="gp-score-value">{{lines}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Niv.</span><span class="gp-score-value">{{level}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="gp-canvas-wrap">
          <canvas #board [width]="COLS*CELL" [height]="ROWS*CELL"></canvas>
          <div class="gp-overlay" *ngIf="gameOver">
            <div class="gp-overlay-icon">🟦</div>
            <div class="gp-overlay-title">Game Over</div>
            <div class="gp-overlay-score">Score : {{score}}</div>
            <button class="gp-btn" (click)="startGame()">Rejouer</button>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Suivant</div>
            <canvas #next [width]="4*CELL" [height]="4*CELL" class="next-cv"></canvas>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row"><span class="gp-key">←→</span> Déplacer</div>
            <div class="gp-ctrl-row"><span class="gp-key">↑</span> Rotation</div>
            <div class="gp-ctrl-row"><span class="gp-key">↓</span> Descente</div>
            <div class="gp-ctrl-row"><span class="gp-key">Espace</span> Drop</div>
          </div>
          <div class="touch-btns">
            <button class="touch-btn" (click)="touchLeft()">◀</button>
            <div class="touch-col">
              <button class="touch-btn" (click)="touchRotate()">↻</button>
              <button class="touch-btn" (click)="touchDown()">▼</button>
            </div>
            <button class="touch-btn" (click)="touchRight()">▶</button>
          </div>
          <button class="gp-btn-outline" (click)="startGame()">🔄 Restart</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host{display:block;height:100vh;overflow:hidden;background:#0a0e1a}
    .gp{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:linear-gradient(135deg,#0a0e1a 0%,#0f172a 50%,#0a1628 100%);font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
    .gp-header{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08)}
    .gp-back{color:#64748b;text-decoration:none;font-size:13px;font-weight:500;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);transition:all .2s}
    .gp-back:hover{color:#0d9488;border-color:#0d9488;background:rgba(13,148,136,.1)}
    .gp-title{font-size:18px;font-weight:800;color:#f1f5f9;text-shadow:0 0 20px rgba(13,148,136,.5)}
    .gp-scores{display:flex;gap:16px}
    .gp-score-item{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.05);border-radius:10px;padding:6px 14px;border:1px solid rgba(255,255,255,.08);min-width:60px}
    .gp-score-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}
    .gp-score-value{font-size:18px;font-weight:800;color:#0d9488;line-height:1.2}
    .gp-body{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:20px;padding:12px 20px;overflow:hidden}
    .gp-canvas-wrap{position:relative;flex-shrink:0}
    canvas{display:block;border-radius:12px;box-shadow:0 0 60px rgba(13,148,136,.3),0 0 120px rgba(13,148,136,.1);border:1px solid rgba(13,148,136,.3)}
    .next-cv{border-radius:8px;border:1px solid rgba(255,255,255,.08)!important;box-shadow:none!important}
    .gp-sidebar{width:180px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
    .gp-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
    .gp-panel-title{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:8px;font-weight:600}
    .gp-ctrl-row{display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;margin-bottom:4px}
    .gp-key{background:rgba(255,255,255,.1);border-radius:4px;border:1px solid rgba(255,255,255,.2);padding:1px 6px;font-size:11px;font-weight:700;color:#e2e8f0;font-family:monospace;min-width:22px;text-align:center}
    .gp-overlay{position:absolute;inset:0;background:rgba(10,14,26,.85);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;gap:8px}
    .gp-overlay-icon{font-size:40px;margin-bottom:4px}
    .gp-overlay-title{font-size:28px;font-weight:900;color:#f1f5f9;letter-spacing:-.02em}
    .gp-overlay-score{font-size:20px;font-weight:700;color:#0d9488;margin:4px 0}
    .gp-btn{padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(13,148,136,.4);margin-top:8px;transition:transform .1s}
    .gp-btn:hover{transform:translateY(-2px)}
    .gp-btn-outline{padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#94a3b8;font-size:12px;cursor:pointer;transition:all .2s;width:100%}
    .gp-btn-outline:hover{border-color:#0d9488;color:#0d9488}
    .touch-btns{display:flex;align-items:center;justify-content:center;gap:8px}
    .touch-col{display:flex;flex-direction:column;gap:6px}
    .touch-btn{width:52px;height:52px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#e2e8f0;font-size:18px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center}
    .touch-btn:hover{background:rgba(13,148,136,.2);border-color:#0d9488}
  `]
})
export class GameTetrisComponent implements AfterViewInit, OnDestroy {
  @ViewChild('board') boardRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('next')  nextRef!: ElementRef<HTMLCanvasElement>;

  readonly COLS = COLS; readonly ROWS = ROWS; readonly CELL = CELL;
  score = 0; lines = 0; level = 1; gameOver = false;

  private ctx!: CanvasRenderingContext2D;
  private nextCtx!: CanvasRenderingContext2D;
  private grid: (string|null)[][] = [];
  private piece: {shape:number[][];color:string;x:number;y:number}|null = null;
  private nextPiece: {shape:number[][];color:string}|null = null;
  private raf = 0; private lastTime = 0; private dropCounter = 0;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.ctx = this.boardRef.nativeElement.getContext('2d')!;
    this.nextCtx = this.nextRef.nativeElement.getContext('2d')!;
    this.startGame();
  }
  ngOnDestroy() { cancelAnimationFrame(this.raf); }

  startGame() {
    this.grid = Array.from({length: ROWS}, () => Array(COLS).fill(null));
    this.score = 0; this.lines = 0; this.level = 1; this.gameOver = false;
    this.nextPiece = this.randomPiece();
    this.spawnPiece();
    this.lastTime = 0; cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(t => this.loop(t));
  }

  private loop(time: number) {
    const delta = time - this.lastTime; this.lastTime = time;
    this.dropCounter += delta;
    const dropInterval = Math.max(100, 800 - (this.level-1)*70);
    if (this.dropCounter > dropInterval) { this.dropPiece(); this.dropCounter = 0; }
    this.draw();
    if (!this.gameOver) this.raf = requestAnimationFrame(t => this.loop(t));
  }

  private randomPiece() {
    const i = Math.floor(Math.random() * PIECES.length);
    return { shape: PIECES[i].map(r => [...r]), color: COLORS[i] };
  }

  private spawnPiece() {
    const p = this.nextPiece!; this.nextPiece = this.randomPiece();
    this.piece = { shape: p.shape, color: p.color, x: Math.floor(COLS/2)-Math.floor(p.shape[0].length/2), y: 0 };
    if (this.collides(this.piece)) { this.gameOver = true; this.cdr.detectChanges(); }
    this.drawNext();
  }

  private collides(p: typeof this.piece): boolean {
    if (!p) return false;
    for (let r = 0; r < p.shape.length; r++)
      for (let c = 0; c < p.shape[r].length; c++)
        if (p.shape[r][c]) {
          const nx = p.x+c, ny = p.y+r;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && this.grid[ny][nx]) return true;
        }
    return false;
  }

  private dropPiece() {
    if (!this.piece) return;
    this.piece.y++;
    if (this.collides(this.piece)) { this.piece.y--; this.lockPiece(); }
  }

  private lockPiece() {
    if (!this.piece) return;
    for (let r = 0; r < this.piece.shape.length; r++)
      for (let c = 0; c < this.piece.shape[r].length; c++)
        if (this.piece.shape[r][c]) { const ny = this.piece.y+r; if (ny >= 0) this.grid[ny][this.piece.x+c] = this.piece.color; }
    this.clearLines(); this.spawnPiece();
  }

  private clearLines() {
    let cleared = 0;
    for (let r = ROWS-1; r >= 0; r--) {
      if (this.grid[r].every(c => c !== null)) { this.grid.splice(r,1); this.grid.unshift(Array(COLS).fill(null)); cleared++; r++; }
    }
    if (cleared) { this.lines += cleared; this.score += [0,100,300,500,800][cleared]*this.level; this.level = Math.floor(this.lines/10)+1; this.cdr.detectChanges(); }
  }

  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0,0,COLS*CELL,ROWS*CELL);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(0,r*CELL); ctx.lineTo(COLS*CELL,r*CELL); ctx.stroke(); }
    for (let c = 0; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(c*CELL,0); ctx.lineTo(c*CELL,ROWS*CELL); ctx.stroke(); }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c]) this.drawCell(ctx,c,r,this.grid[r][c]!);
    if (this.piece) {
      const ghost = {...this.piece, y: this.piece.y};
      while (!this.collides({...ghost, y: ghost.y+1})) ghost.y++;
      for (let r = 0; r < this.piece.shape.length; r++)
        for (let c = 0; c < this.piece.shape[r].length; c++)
          if (this.piece.shape[r][c]) {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect((this.piece.x+c)*CELL,(ghost.y+r)*CELL,CELL-1,CELL-1);
          }
      for (let r = 0; r < this.piece.shape.length; r++)
        for (let c = 0; c < this.piece.shape[r].length; c++)
          if (this.piece.shape[r][c]) this.drawCell(ctx,this.piece.x+c,this.piece.y+r,this.piece.color);
    }
  }

  private drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.fillStyle = color; ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,CELL-2);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x*CELL+1,y*CELL+1,CELL-2,4);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x*CELL+1,y*CELL+CELL-5,CELL-2,4);
  }

  private drawNext() {
    const ctx = this.nextCtx;
    ctx.fillStyle = 'rgba(10,14,26,0.6)'; ctx.fillRect(0,0,4*CELL,4*CELL);
    if (!this.nextPiece) return;
    const p = this.nextPiece;
    const ox = Math.floor((4-p.shape[0].length)/2);
    const oy = Math.floor((4-p.shape.length)/2);
    for (let r = 0; r < p.shape.length; r++)
      for (let c = 0; c < p.shape[r].length; c++)
        if (p.shape[r][c]) this.drawCell(ctx,ox+c,oy+r,p.color);
  }

  touchLeft()   { if (this.piece && !this.gameOver) { this.piece.x--; if (this.collides(this.piece)) this.piece.x++; } }
  touchRight()  { if (this.piece && !this.gameOver) { this.piece.x++; if (this.collides(this.piece)) this.piece.x--; } }
  touchRotate() { if (!this.gameOver) this.rotate(); }
  touchDown()   { if (!this.gameOver) { this.dropPiece(); this.dropCounter = 0; } }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (!this.piece || this.gameOver) return;
    if (e.key==='ArrowLeft')  { e.preventDefault(); this.piece.x--; if (this.collides(this.piece)) this.piece.x++; }
    if (e.key==='ArrowRight') { e.preventDefault(); this.piece.x++; if (this.collides(this.piece)) this.piece.x--; }
    if (e.key==='ArrowDown')  { e.preventDefault(); this.dropPiece(); this.dropCounter=0; }
    if (e.key==='ArrowUp')    { e.preventDefault(); this.rotate(); }
    if (e.key===' ')          { e.preventDefault(); this.hardDrop(); }
  }

  private rotate() {
    if (!this.piece) return;
    const old = this.piece.shape;
    const rotated = old[0].map((_,ci) => old.map(r => r[ci]).reverse());
    this.piece.shape = rotated;
    if (this.collides(this.piece)) this.piece.shape = old;
  }

  private hardDrop() {
    if (!this.piece) return;
    while (!this.collides({...this.piece, y: this.piece.y+1})) this.piece.y++;
    this.lockPiece(); this.dropCounter = 0;
  }
}
