import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Pawn { color: 'red'|'blue'; id: number; pos: number; home: boolean; finished: boolean; }

const TRACK_LENGTH = 52;
const HOME_STRETCH = 6;

@Component({
  selector: 'app-game-ludo',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🎲 Ludo</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Tour</span><span class="gp-score-value" [style.color]="turn==='red'?'#dc2626':'#1e40af'">{{turn==='red'?'Vous':'IA'}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Dé</span><span class="gp-score-value">{{diceVal > 0 ? diceVal : '-'}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="ld-main">
          <div class="ld-board">
            <!-- Home zones -->
            <div class="ld-home ld-home-red">
              <div class="ld-pawn-slot" *ngFor="let p of redPawns">
                <div class="ld-pawn ld-pawn-red" *ngIf="p.home" (click)="selectPawn(p)">{{p.id+1}}</div>
              </div>
            </div>
            <div class="ld-home ld-home-blue">
              <div class="ld-pawn-slot" *ngFor="let p of bluePawns">
                <div class="ld-pawn ld-pawn-blue" *ngIf="p.home">{{p.id+1}}</div>
              </div>
            </div>
            <!-- Track display -->
            <div class="ld-center">
              <div class="ld-track-info">
                <div class="ld-track-row" *ngFor="let p of allPawns">
                  <div class="ld-pawn-mini" [class.ld-red]="p.color==='red'" [class.ld-blue]="p.color==='blue'"
                    [class.ld-selectable]="canSelectPawn(p)" (click)="selectPawn(p)">
                    {{p.color==='red'?'R':'B'}}{{p.id+1}}
                    <span class="ld-pos">{{p.home?'Maison':p.finished?'Arrivée':p.pos}}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="ld-controls">
            <button class="gp-btn" (click)="rollDice()" [disabled]="!canRoll">🎲 Lancer le dé</button>
            <div class="ld-dice" *ngIf="diceVal > 0">{{diceEmoji()}}</div>
          </div>
          <div class="ld-status">{{status}}</div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Règles</div>
            <p style="font-size:12px;color:#64748b;line-height:1.5">
              Lancez le dé. Un 6 pour sortir un pion. Faites le tour du plateau. Le premier à rentrer tous ses pions gagne !
            </p>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Pions Rouges (Vous)</div>
            <div *ngFor="let p of redPawns" style="font-size:12px;color:#94a3b8;padding:2px 0">
              R{{p.id+1}}: {{p.home?'Maison':p.finished?'Arrivée':'Case '+p.pos}}
            </div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Pions Bleus (IA)</div>
            <div *ngFor="let p of bluePawns" style="font-size:12px;color:#94a3b8;padding:2px 0">
              B{{p.id+1}}: {{p.home?'Maison':p.finished?'Arrivée':'Case '+p.pos}}
            </div>
          </div>
          <button class="gp-btn-outline" (click)="restart()">🔄 Nouvelle partie</button>
        </div>
      </div>
      <div class="ld-win-overlay" *ngIf="winner">
        <div class="gp-overlay-icon">{{winner==='red'?'🏆':'🤖'}}</div>
        <div class="gp-overlay-title">{{winner==='red'?'Vous gagnez !':'IA gagne !'}}</div>
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
    .ld-main{display:flex;flex-direction:column;align-items:center;gap:16px}
    .ld-board{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr auto;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:16px;width:380px}
    .ld-home{display:grid;grid-template-columns:1fr 1fr;gap:8px;border-radius:12px;padding:12px;min-height:120px}
    .ld-home-red{background:rgba(220,38,38,.15);border:1px solid rgba(220,38,38,.3);grid-column:1}
    .ld-home-blue{background:rgba(30,64,175,.15);border:1px solid rgba(30,64,175,.3);grid-column:2}
    .ld-pawn-slot{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.1)}
    .ld-center{grid-column:1/-1;background:rgba(255,255,255,.03);border-radius:10px;padding:12px}
    .ld-track-info{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
    .ld-pawn-mini{padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);transition:all .15s}
    .ld-red{color:#dc2626;border-color:rgba(220,38,38,.3)}
    .ld-blue{color:#1e40af;border-color:rgba(30,64,175,.3)}
    .ld-selectable{background:rgba(13,148,136,.2)!important;border-color:#0d9488!important;box-shadow:0 0 8px rgba(13,148,136,.4)}
    .ld-selectable:hover{transform:scale(1.05)}
    .ld-pos{font-weight:400;color:#64748b;font-size:11px}
    .ld-pawn{width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;cursor:pointer;transition:all .15s}
    .ld-pawn-red{background:radial-gradient(circle at 35% 35%,#f87171,#dc2626);color:#fff;border:2px solid #ef4444}
    .ld-pawn-blue{background:radial-gradient(circle at 35% 35%,#60a5fa,#1e40af);color:#fff;border:2px solid #3b82f6}
    .ld-controls{display:flex;align-items:center;gap:16px}
    .ld-dice{font-size:36px}
    .ld-status{font-size:14px;color:#94a3b8;min-height:20px;text-align:center}
    .gp-btn{padding:12px 28px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer}
    .gp-btn:disabled{opacity:.5;cursor:default}
    .gp-btn-outline{padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#94a3b8;font-size:12px;cursor:pointer;width:100%}
    .gp-btn-outline:hover{border-color:#0d9488;color:#0d9488}
    .gp-sidebar{width:200px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
    .gp-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
    .gp-panel-title{font-size:9px;text-transform:uppercase;color:#64748b;margin-bottom:8px;font-weight:600}
    .ld-win-overlay{position:fixed;inset:0;background:rgba(10,14,26,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:100}
    .gp-overlay-icon{font-size:40px}
    .gp-overlay-title{font-size:28px;font-weight:900;color:#f1f5f9}
  `]
})
export class GameLudoComponent implements OnInit {
  redPawns: Pawn[] = [];
  bluePawns: Pawn[] = [];
  allPawns: Pawn[] = [];
  turn: 'red'|'blue' = 'red';
  diceVal = 0;
  canRoll = true;
  status = 'Lancez le dé pour commencer !';
  winner: 'red'|'blue'|null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.restart(); }

  restart() {
    this.redPawns = Array.from({length: 4}, (_, i) => ({ color: 'red' as const, id: i, pos: 0, home: true, finished: false }));
    this.bluePawns = Array.from({length: 4}, (_, i) => ({ color: 'blue' as const, id: i, pos: 0, home: true, finished: false }));
    this.allPawns = [...this.redPawns, ...this.bluePawns];
    this.turn = 'red'; this.diceVal = 0; this.canRoll = true;
    this.status = 'Lancez le dé !'; this.winner = null;
  }

  diceEmoji() {
    return ['','⚀','⚁','⚂','⚃','⚄','⚅'][this.diceVal] ?? this.diceVal;
  }

  rollDice() {
    if (!this.canRoll) return;
    this.diceVal = Math.floor(Math.random() * 6) + 1;
    this.canRoll = false;
    const pawns = this.turn === 'red' ? this.redPawns : this.bluePawns;
    const moveable = this.getMoveable(pawns);
    if (moveable.length === 0) {
      this.status = `${this.diceVal} — Aucun mouvement possible. Tour suivant.`;
      this.cdr.detectChanges();
      setTimeout(() => this.endTurn(), 1000);
    } else if (this.turn === 'red') {
      this.status = `Dé : ${this.diceVal} — Cliquez sur un pion pour jouer.`;
      this.cdr.detectChanges();
    } else {
      this.status = `IA lance : ${this.diceVal}...`;
      this.cdr.detectChanges();
      setTimeout(() => {
        const p = moveable[Math.floor(Math.random() * moveable.length)];
        this.movePawn(p);
      }, 1000);
    }
  }

  canSelectPawn(p: Pawn): boolean {
    if (this.turn !== 'red' || this.canRoll) return false;
    return this.isPawnMoveable(p);
  }

  selectPawn(p: Pawn) {
    if (!this.canSelectPawn(p)) return;
    this.movePawn(p);
  }

  private isPawnMoveable(p: Pawn): boolean {
    if (p.color !== this.turn) return false;
    if (p.finished) return false;
    if (p.home && this.diceVal !== 6) return false;
    if (!p.home && !p.finished) return true;
    if (p.home && this.diceVal === 6) return true;
    return false;
  }

  private getMoveable(pawns: Pawn[]): Pawn[] {
    return pawns.filter(p => this.isPawnMoveable(p));
  }

  private movePawn(p: Pawn) {
    const offset = p.color === 'red' ? 0 : 26;
    if (p.home) {
      p.home = false;
      p.pos = 1 + offset;
    } else {
      const relPos = ((p.pos - offset - 1 + TRACK_LENGTH) % TRACK_LENGTH) + 1;
      const newRel = relPos + this.diceVal;
      if (newRel > TRACK_LENGTH) {
        // Home stretch
        const hsPos = newRel - TRACK_LENGTH;
        if (hsPos <= HOME_STRETCH) {
          p.pos = TRACK_LENGTH + offset + hsPos;
          if (hsPos === HOME_STRETCH) { p.finished = true; p.pos = 999; }
        }
      } else {
        p.pos = ((newRel - 1 + offset) % TRACK_LENGTH) + offset + 1;
      }
    }

    this.checkCaptures(p);
    this.checkWinner();
    this.cdr.detectChanges();

    if (!this.winner) {
      if (this.diceVal === 6) {
        this.canRoll = true;
        this.status = `${p.color === 'red' ? 'Vous avez' : 'IA a'} fait 6 — relancez !`;
      } else {
        this.endTurn();
      }
    }
  }

  private checkCaptures(movedPawn: Pawn) {
    const enemies = movedPawn.color === 'red' ? this.bluePawns : this.redPawns;
    if (movedPawn.pos >= 900) return;
    for (const e of enemies) {
      if (!e.home && !e.finished && e.pos === movedPawn.pos) {
        e.home = true; e.pos = 0;
        this.status = `Capture ! Pion ${e.color === 'red' ? 'rouge' : 'bleu'} renvoyé à la maison.`;
      }
    }
  }

  private checkWinner() {
    if (this.redPawns.every(p => p.finished)) { this.winner = 'red'; return; }
    if (this.bluePawns.every(p => p.finished)) { this.winner = 'blue'; }
  }

  private endTurn() {
    this.turn = this.turn === 'red' ? 'blue' : 'red';
    this.diceVal = 0; this.canRoll = true;
    this.status = this.turn === 'red' ? 'Votre tour — Lancez le dé !' : 'Tour de l\'IA...';
    this.cdr.detectChanges();
    if (this.turn === 'blue') {
      setTimeout(() => { if (!this.winner) this.rollDice(); }, 1000);
    }
  }
}
