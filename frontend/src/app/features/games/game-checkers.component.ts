import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

type Piece = { color: 'white'|'black'; king: boolean } | null;

@Component({
  selector: 'app-game-checkers',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">♟️ Jeux de Dames</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Blancs</span><span class="gp-score-value">{{whiteCount}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Noirs</span><span class="gp-score-value">{{blackCount}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Tour</span><span class="gp-score-value" [style.color]="turn==='white'?'#e2e8f0':'#64748b'">{{turn==='white'?'Vous':'IA'}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="ck-board-wrap">
          <div class="ck-board">
            <div class="ck-row" *ngFor="let row of board; let ri = index">
              <div class="ck-cell"
                *ngFor="let cell of row; let ci = index"
                [class.ck-dark]="(ri+ci)%2===1"
                [class.ck-selected]="selectedR===ri && selectedC===ci"
                [class.ck-valid-move]="isValidTarget(ri,ci)"
                (click)="clickCell(ri,ci)">
                <div class="ck-piece ck-white" *ngIf="cell && cell.color==='white'">
                  <span class="ck-crown" *ngIf="cell.king">♛</span>
                </div>
                <div class="ck-piece ck-black" *ngIf="cell && cell.color==='black'">
                  <span class="ck-crown" *ngIf="cell.king">♛</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row">Clic = sélectionner</div>
            <div class="gp-ctrl-row">Clic = déplacer</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Règles</div>
            <p style="font-size:12px;color:#64748b;line-height:1.5">
              Pions blancs vs IA noire. Capture obligatoire. Atteignez le bord opposé pour devenir Dame.
            </p>
          </div>
          <div class="gp-panel" *ngIf="status">
            <div class="gp-panel-title">Statut</div>
            <div style="font-size:14px;color:#0d9488;font-weight:700">{{status}}</div>
          </div>
          <button class="gp-btn-outline" (click)="restart()">🔄 Nouvelle partie</button>
        </div>
      </div>
      <div class="ck-win-overlay" *ngIf="winner">
        <div class="gp-overlay-icon">{{winner==='white'?'🏆':'🤖'}}</div>
        <div class="gp-overlay-title">{{winner==='white'?'Vous gagnez !':'IA gagne !'}}</div>
        <button class="gp-btn" (click)="restart()">Rejouer</button>
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
    .ck-board-wrap{flex-shrink:0}
    .ck-board{display:grid;grid-template-rows:repeat(8,1fr);gap:2px;background:#0a0e1a;border-radius:12px;padding:8px;border:2px solid rgba(13,148,136,.4);box-shadow:0 0 40px rgba(13,148,136,.2)}
    .ck-row{display:flex;gap:2px}
    .ck-cell{width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;background:rgba(255,255,255,.04);transition:all .15s}
    .ck-dark{background:#1e293b}
    .ck-dark:hover{background:#1e3a5f}
    .ck-selected{background:rgba(13,148,136,.5)!important;box-shadow:0 0 12px rgba(13,148,136,.6)}
    .ck-valid-move .ck-dark,.ck-valid-move{background:rgba(5,150,105,.3)!important}
    .ck-valid-move::after{content:'';width:16px;height:16px;border-radius:50%;background:rgba(5,150,105,.5);display:block}
    .ck-piece{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.4);font-size:18px;transition:transform .15s;cursor:pointer}
    .ck-piece:hover{transform:scale(1.1)}
    .ck-white{background:radial-gradient(circle at 35% 35%,#f1f5f9,#94a3b8);border:2px solid #e2e8f0}
    .ck-black{background:radial-gradient(circle at 35% 35%,#475569,#0f172a);border:2px solid #334155}
    .ck-crown{font-size:14px}
    .gp-sidebar{width:180px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
    .gp-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
    .gp-panel-title{font-size:9px;text-transform:uppercase;color:#64748b;margin-bottom:8px;font-weight:600}
    .gp-ctrl-row{font-size:12px;color:#94a3b8;margin-bottom:4px}
    .gp-btn{padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}
    .gp-btn-outline{padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#94a3b8;font-size:12px;cursor:pointer;width:100%}
    .gp-btn-outline:hover{border-color:#0d9488;color:#0d9488}
    .ck-win-overlay{position:fixed;inset:0;background:rgba(10,14,26,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:100}
    .gp-overlay-icon{font-size:40px}
    .gp-overlay-title{font-size:28px;font-weight:900;color:#f1f5f9}
  `]
})
export class GameCheckersComponent implements OnInit {
  board: Piece[][] = [];
  turn: 'white'|'black' = 'white';
  selectedR = -1; selectedC = -1;
  validMoves: {r:number;c:number;captureR?:number;captureC?:number}[] = [];
  status = '';
  winner: 'white'|'black'|null = null;
  whiteCount = 12; blackCount = 12;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.restart(); }

  restart() {
    this.board = Array.from({length: 8}, () => Array(8).fill(null));
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 1) this.board[r][c] = { color: 'black', king: false };
    for (let r = 5; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if ((r + c) % 2 === 1) this.board[r][c] = { color: 'white', king: false };
    this.turn = 'white';
    this.selectedR = -1; this.selectedC = -1;
    this.validMoves = []; this.status = ''; this.winner = null;
    this.updateCounts();
  }

  updateCounts() {
    this.whiteCount = this.board.flat().filter(p => p?.color === 'white').length;
    this.blackCount = this.board.flat().filter(p => p?.color === 'black').length;
  }

  clickCell(r: number, c: number) {
    if (this.turn !== 'white' || this.winner) return;
    const cell = this.board[r][c];
    if (cell?.color === 'white') {
      this.selectedR = r; this.selectedC = c;
      this.validMoves = this.getMovesFor(r, c, 'white');
      return;
    }
    if (this.selectedR >= 0) {
      const move = this.validMoves.find(m => m.r === r && m.c === c);
      if (move) {
        this.executeMove(this.selectedR, this.selectedC, move.r, move.c, move.captureR, move.captureC);
        this.selectedR = -1; this.selectedC = -1; this.validMoves = [];
        this.updateCounts();
        if (this.blackCount === 0) { this.winner = 'white'; this.cdr.detectChanges(); return; }
        this.checkWinner();
        if (!this.winner) {
          this.turn = 'black';
          this.status = 'IA réfléchit...';
          this.cdr.detectChanges();
          setTimeout(() => { this.aiMove(); }, 800);
        }
      }
    }
  }

  isValidTarget(r: number, c: number): boolean {
    return this.validMoves.some(m => m.r === r && m.c === c);
  }

  private executeMove(fr: number, fc: number, tr: number, tc: number, capR?: number, capC?: number) {
    const p = this.board[fr][fc];
    if (!p) return;
    this.board[tr][tc] = p;
    this.board[fr][fc] = null;
    if (capR !== undefined && capC !== undefined) this.board[capR][capC] = null;
    if (p.color === 'white' && tr === 0) p.king = true;
    if (p.color === 'black' && tr === 7) p.king = true;
    this.board = this.board.map(row => [...row]);
  }

  private getMovesFor(r: number, c: number, color: 'white'|'black') {
    const piece = this.board[r][c];
    if (!piece) return [];
    const dirs = color === 'white' ? [-1] : [1];
    if (piece.king) dirs.push(color === 'white' ? 1 : -1);
    const moves: {r:number;c:number;captureR?:number;captureC?:number}[] = [];
    const captures: {r:number;c:number;captureR?:number;captureC?:number}[] = [];

    for (const dr of dirs) {
      for (const dc of [-1, 1]) {
        const nr = r + dr; const nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          if (!this.board[nr][nc]) {
            moves.push({ r: nr, c: nc });
          } else if (this.board[nr][nc]?.color !== color) {
            const jr = nr + dr; const jc = nc + dc;
            if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !this.board[jr][jc]) {
              captures.push({ r: jr, c: jc, captureR: nr, captureC: nc });
            }
          }
        }
      }
    }
    return captures.length > 0 ? captures : moves;
  }

  private aiMove() {
    const blackPieces: {r:number;c:number}[] = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]?.color === 'black') blackPieces.push({r, c});

    let allMoves: {fr:number;fc:number;tr:number;tc:number;capR?:number;capC?:number}[] = [];
    let allCaptures: {fr:number;fc:number;tr:number;tc:number;capR?:number;capC?:number}[] = [];

    for (const {r, c} of blackPieces) {
      const moves = this.getMovesFor(r, c, 'black');
      for (const m of moves) {
        const entry = {fr:r, fc:c, tr:m.r, tc:m.c, capR:m.captureR, capC:m.captureC};
        if (m.captureR !== undefined) allCaptures.push(entry);
        else allMoves.push(entry);
      }
    }

    const pool = allCaptures.length > 0 ? allCaptures : allMoves;
    if (pool.length === 0) { this.winner = 'white'; this.cdr.detectChanges(); return; }

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    this.executeMove(chosen.fr, chosen.fc, chosen.tr, chosen.tc, chosen.capR, chosen.capC);
    this.updateCounts();
    this.turn = 'white';
    this.status = '';
    this.checkWinner();
    this.cdr.detectChanges();
  }

  private checkWinner() {
    if (this.whiteCount === 0) this.winner = 'black';
    if (this.blackCount === 0) this.winner = 'white';
  }
}
