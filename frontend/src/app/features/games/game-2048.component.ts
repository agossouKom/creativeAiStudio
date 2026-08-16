import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

const CARD_NAMES: Record<number, string> = {
  2: 'Badge', 4: 'ID Card', 8: 'Scolaire', 16: 'Visite',
  32: 'Événement', 64: 'Premium', 128: 'Gold', 256: 'Platine',
  512: 'Diamant', 1024: 'Légendaire', 2048: '⭐ SUPRÊME'
};

const TILE_COLORS: Record<number, string> = {
  2: '#1e3a5f', 4: '#1e40af', 8: '#1d4ed8', 16: '#0d9488',
  32: '#0f766e', 64: '#059669', 128: '#d97706', 256: '#dc2626',
  512: '#7c3aed', 1024: '#9333ea', 2048: '#ec4899'
};

@Component({
  selector: 'app-game-2048',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🃏 2048 Cartes</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Score</span><span class="gp-score-value">{{score}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Best</span><span class="gp-score-value">{{best}}</span></div>
        </div>
      </div>

      <div class="gp-body">
        <div class="g2-center">
          <div class="board-wrap"
            (touchstart)="onTouchStart($event)" (touchend)="onTouchEnd($event)"
            (mousedown)="onMouseDown($event)" (mouseup)="onMouseUp($event)">
            <div class="board">
              <ng-container *ngFor="let row of board; let ri = index">
                <div class="tile"
                  *ngFor="let cell of row; let ci = index"
                  [class.tile--filled]="cell > 0"
                  [style.background]="cell > 0 ? tileColor(cell) : 'rgba(255,255,255,0.04)'"
                  [class.tile--big]="cell >= 1024">
                  <ng-container *ngIf="cell > 0">
                    <div class="tile-name">{{cardName(cell)}}</div>
                    <div class="tile-val">{{cell}}</div>
                  </ng-container>
                </div>
              </ng-container>
            </div>
            <div class="gp-overlay" *ngIf="gameOver">
              <div class="gp-overlay-icon">🃏</div>
              <div class="gp-overlay-title">Game Over</div>
              <div class="gp-overlay-score">Score : {{score}}</div>
              <button class="gp-btn" (click)="newGame()">Rejouer</button>
            </div>
            <div class="gp-overlay gp-overlay--win" *ngIf="won && !dismissed">
              <div class="gp-overlay-icon">⭐</div>
              <div class="gp-overlay-title">SUPRÊME !</div>
              <div class="gp-overlay-score">Tu as atteint 2048 !</div>
              <button class="gp-btn" (click)="dismissed = true">Continuer</button>
            </div>
          </div>

          <!-- Virtual D-pad for mobile -->
          <div class="dpad">
            <button class="dpad-btn" (click)="move('up')">▲</button>
            <div class="dpad-row">
              <button class="dpad-btn" (click)="move('left')">◀</button>
              <button class="dpad-btn dpad-center">✦</button>
              <button class="dpad-btn" (click)="move('right')">▶</button>
            </div>
            <button class="dpad-btn" (click)="move('down')">▼</button>
          </div>
        </div>

        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row"><span class="gp-key">↑↓←→</span> Glisser</div>
            <div class="gp-ctrl-row"><span class="gp-key">Swipe</span> Tactile</div>
            <div class="gp-ctrl-row"><span class="gp-key">Drag</span> Souris</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Comment jouer</div>
            <p style="font-size:12px;color:#64748b;line-height:1.5">Fusionne des cartes identiques en les glissant. Atteins la carte 2048 SUPRÊME !</p>
          </div>
          <button class="gp-btn-outline" (click)="newGame()">🔄 Nouvelle partie</button>
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
    .gp-title{font-size:18px;font-weight:800;color:#f1f5f9;text-shadow:0 0 20px rgba(13,148,136,.5)}
    .gp-scores{display:flex;gap:16px}
    .gp-score-item{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.05);border-radius:10px;padding:6px 14px;border:1px solid rgba(255,255,255,.08);min-width:60px}
    .gp-score-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}
    .gp-score-value{font-size:18px;font-weight:800;color:#0d9488;line-height:1.2}
    .gp-body{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:20px;padding:12px 20px;overflow:hidden}
    .g2-center{display:flex;flex-direction:column;align-items:center;gap:16px}
    .board-wrap{position:relative;flex-shrink:0}
    .board{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:rgba(255,255,255,.04);border-radius:16px;padding:8px;width:380px;border:1px solid rgba(255,255,255,.08);box-shadow:0 0 60px rgba(13,148,136,.2)}
    .tile{border-radius:10px;height:86px;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:background 0.15s;border:1px solid rgba(255,255,255,.06)}
    .tile--filled{animation:pop 0.15s ease;border-color:rgba(255,255,255,.12)}
    .tile-name{font-size:12px;font-weight:800;color:#fff;text-align:center;line-height:1.2;padding:0 4px}
    .tile--big .tile-name{font-size:10px}
    .tile-val{font-size:11px;color:rgba(255,255,255,.5);margin-top:4px}
    .dpad{display:flex;flex-direction:column;align-items:center;gap:4px}
    .dpad-row{display:flex;gap:4px}
    .dpad-btn{width:44px;height:44px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#e2e8f0;font-size:16px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center}
    .dpad-btn:hover{background:rgba(13,148,136,.2);border-color:#0d9488}
    .dpad-center{color:#64748b;font-size:12px}
    .gp-sidebar{width:180px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
    .gp-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
    .gp-panel-title{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:8px;font-weight:600}
    .gp-ctrl-row{display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;margin-bottom:4px}
    .gp-key{background:rgba(255,255,255,.1);border-radius:4px;border:1px solid rgba(255,255,255,.2);padding:1px 6px;font-size:11px;font-weight:700;color:#e2e8f0;font-family:monospace;min-width:22px;text-align:center}
    .gp-overlay{position:absolute;inset:0;background:rgba(10,14,26,.85);backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:16px;gap:8px;z-index:10}
    .gp-overlay--win{background:rgba(13,148,136,.15)!important}
    .gp-overlay-icon{font-size:40px;margin-bottom:4px}
    .gp-overlay-title{font-size:28px;font-weight:900;color:#f1f5f9;letter-spacing:-.02em}
    .gp-overlay-score{font-size:20px;font-weight:700;color:#0d9488;margin:4px 0}
    .gp-btn{padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(13,148,136,.4);margin-top:8px;transition:transform .1s}
    .gp-btn:hover{transform:translateY(-2px)}
    .gp-btn-outline{padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#94a3b8;font-size:12px;cursor:pointer;transition:all .2s;width:100%}
    .gp-btn-outline:hover{border-color:#0d9488;color:#0d9488}
    @keyframes pop{0%{transform:scale(.8)}100%{transform:scale(1)}}
  `]
})
export class Game2048Component implements OnInit {
  board: number[][] = [];
  score = 0; best = 0;
  gameOver = false; won = false; dismissed = false;
  private touchStartX = 0; private touchStartY = 0;
  private mouseStartX = 0; private mouseStartY = 0;

  ngOnInit() {
    this.best = parseInt(localStorage.getItem('2048-best') || '0', 10);
    this.newGame();
  }

  newGame() {
    this.board = Array.from({length: 4}, () => [0,0,0,0]);
    this.score = 0; this.gameOver = false; this.won = false; this.dismissed = false;
    this.addTile(); this.addTile();
  }

  cardName(v: number): string { return CARD_NAMES[v] ?? String(v); }
  tileColor(v: number): string { return TILE_COLORS[v] ?? '#4c1d95'; }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const dirs: Record<string, string> = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down'
    };
    if (dirs[e.key]) { e.preventDefault(); this.move(dirs[e.key]); }
  }

  onTouchStart(e: TouchEvent) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }
  onTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
    if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 'right' : 'left');
    else this.move(dy > 0 ? 'down' : 'up');
  }

  onMouseDown(e: MouseEvent) { this.mouseStartX = e.clientX; this.mouseStartY = e.clientY; }
  onMouseUp(e: MouseEvent) {
    const dx = e.clientX - this.mouseStartX;
    const dy = e.clientY - this.mouseStartY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 'right' : 'left');
    else this.move(dy > 0 ? 'down' : 'up');
  }

  move(dir: string) {
    if (this.gameOver) return;
    const before = this.board.map(r => [...r]);
    if (dir === 'left')  this.board = this.board.map(r => this.slideLeft(r));
    if (dir === 'right') this.board = this.board.map(r => this.slideLeft([...r].reverse()).reverse());
    if (dir === 'up')    this.moveVertical(false);
    if (dir === 'down')  this.moveVertical(true);
    const changed = this.board.some((r, ri) => r.some((c, ci) => c !== before[ri][ci]));
    if (changed) {
      this.addTile();
      if (this.score > this.best) { this.best = this.score; localStorage.setItem('2048-best', String(this.best)); }
      if (!this.won && this.board.some(r => r.includes(2048))) this.won = true;
      if (!this.canMove()) this.gameOver = true;
    }
  }

  slideLeft(row: number[]): number[] {
    const filtered = row.filter(x => x !== 0);
    for (let i = 0; i < filtered.length - 1; i++) {
      if (filtered[i] === filtered[i+1]) {
        filtered[i] *= 2; this.score += filtered[i]; filtered.splice(i+1, 1);
      }
    }
    while (filtered.length < 4) filtered.push(0);
    return filtered;
  }

  private moveVertical(reverse: boolean) {
    for (let c = 0; c < 4; c++) {
      let col = [this.board[0][c], this.board[1][c], this.board[2][c], this.board[3][c]];
      if (reverse) col = this.slideLeft(col.reverse()).reverse();
      else col = this.slideLeft(col);
      for (let r = 0; r < 4; r++) this.board[r][c] = col[r];
    }
  }

  private addTile() {
    const empty: [number,number][] = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (this.board[r][c] === 0) empty.push([r,c]);
    if (!empty.length) return;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    this.board[r][c] = Math.random() < 0.9 ? 2 : 4;
    this.board = this.board.map(row => [...row]);
  }

  private canMove(): boolean {
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        if (this.board[r][c] === 0) return true;
        if (c < 3 && this.board[r][c] === this.board[r][c+1]) return true;
        if (r < 3 && this.board[r][c] === this.board[r+1][c]) return true;
      }
    return false;
  }
}
