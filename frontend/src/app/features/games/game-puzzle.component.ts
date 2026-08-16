import { Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

const TILE_COLORS = [
  '#0d9488','#0891b2','#1e40af','#7c3aed',
  '#9333ea','#db2777','#dc2626','#d97706',
  '#059669','#0e7490','#1d4ed8','#6d28d9',
  '#a21caf','#be123c','#b45309'
];

@Component({
  selector: 'app-game-puzzle',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="gp">
      <div class="gp-header">
        <a class="gp-back" routerLink="/games">← Tous les jeux</a>
        <div class="gp-title">🧩 Puzzle Coulissant</div>
        <div class="gp-scores">
          <div class="gp-score-item"><span class="gp-score-label">Mouvements</span><span class="gp-score-value">{{moves}}</span></div>
          <div class="gp-score-item"><span class="gp-score-label">Temps</span><span class="gp-score-value">{{timerDisplay}}</span></div>
        </div>
      </div>
      <div class="gp-body">
        <div class="pz-main">
          <div class="pz-grid">
            <div class="pz-tile"
              *ngFor="let tile of tiles; let i = index"
              [class.pz-empty]="tile === 0"
              [class.pz-correct]="tile !== 0 && tile === i + 1"
              [style.background]="tile !== 0 ? tileColor(tile) : 'transparent'"
              (click)="clickTile(i)">
              <span *ngIf="tile !== 0">{{tile}}</span>
            </div>
          </div>
          <div class="pz-controls">
            <button class="gp-btn-outline" (click)="shuffle()">🔀 Mélanger</button>
            <button class="gp-btn-outline" (click)="solve()">💡 Solution</button>
          </div>
        </div>
        <div class="gp-sidebar">
          <div class="gp-panel">
            <div class="gp-panel-title">Contrôles</div>
            <div class="gp-ctrl-row">Clic sur une tuile adjacente au vide pour la déplacer</div>
            <div class="gp-ctrl-row"><span class="gp-key">↑↓←→</span> Déplacer</div>
          </div>
          <div class="gp-panel">
            <div class="gp-panel-title">Objectif</div>
            <p style="font-size:12px;color:#64748b;line-height:1.5">Réorganise les tuiles de 1 à 15 dans l'ordre avec un minimum de mouvements !</p>
          </div>
          <div class="gp-panel" *ngIf="solved">
            <div style="color:#0d9488;font-weight:700;font-size:14px;text-align:center">🎉 Résolu !<br>{{moves}} mouvements</div>
          </div>
        </div>
      </div>
      <div class="pz-win-overlay" *ngIf="solved">
        <div class="gp-overlay-icon">🎉</div>
        <div class="gp-overlay-title">Bravo !</div>
        <div class="gp-overlay-score">{{moves}} mouvements — {{timerDisplay}}</div>
        <button class="gp-btn" (click)="shuffle()">Rejouer</button>
      </div>
    </div>
  `,
  styles: [`
    :host{display:block;height:100vh;overflow:hidden;background:#0a0e1a}
    .gp{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:linear-gradient(135deg,#0a0e1a,#0f172a);font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
    .gp-header{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:rgba(255,255,255,.04);border-bottom:1px solid rgba(255,255,255,.08)}
    .gp-back{color:#64748b;text-decoration:none;font-size:13px;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1)}
    .gp-back:hover{color:#0d9488;border-color:#0d9488}
    .gp-title{font-size:18px;font-weight:800;color:#f1f5f9;text-shadow:0 0 20px rgba(13,148,136,.5)}
    .gp-scores{display:flex;gap:16px}
    .gp-score-item{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.05);border-radius:10px;padding:6px 14px;border:1px solid rgba(255,255,255,.08);min-width:60px}
    .gp-score-label{font-size:9px;text-transform:uppercase;color:#64748b}
    .gp-score-value{font-size:18px;font-weight:800;color:#0d9488;line-height:1.2}
    .gp-body{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:20px;padding:12px 20px;overflow:hidden}
    .pz-main{display:flex;flex-direction:column;align-items:center;gap:16px}
    .pz-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;background:rgba(255,255,255,.05);padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,.1)}
    .pz-tile{width:80px;height:80px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#fff;cursor:pointer;transition:all .15s;border:2px solid rgba(255,255,255,.15);box-shadow:0 4px 12px rgba(0,0,0,.3);user-select:none}
    .pz-tile:hover:not(.pz-empty){transform:scale(1.04);box-shadow:0 6px 20px rgba(0,0,0,.4)}
    .pz-empty{cursor:default;border:2px dashed rgba(255,255,255,.1)!important;box-shadow:none!important}
    .pz-correct{box-shadow:0 0 12px rgba(13,148,136,.5)!important;border-color:rgba(13,148,136,.5)!important}
    .pz-controls{display:flex;gap:12px}
    .gp-sidebar{width:180px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
    .gp-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
    .gp-panel-title{font-size:9px;text-transform:uppercase;color:#64748b;margin-bottom:8px;font-weight:600}
    .gp-ctrl-row{font-size:12px;color:#94a3b8;margin-bottom:4px;line-height:1.4}
    .gp-key{background:rgba(255,255,255,.1);border-radius:4px;border:1px solid rgba(255,255,255,.2);padding:1px 6px;font-size:11px;font-weight:700;color:#e2e8f0;font-family:monospace}
    .gp-btn{padding:12px 32px;border-radius:10px;border:none;background:linear-gradient(135deg,#0d9488,#059669);color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}
    .gp-btn-outline{padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#94a3b8;font-size:12px;cursor:pointer}
    .gp-btn-outline:hover{border-color:#0d9488;color:#0d9488}
    .pz-win-overlay{position:fixed;inset:0;background:rgba(10,14,26,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:100}
    .gp-overlay-icon{font-size:40px}
    .gp-overlay-title{font-size:28px;font-weight:900;color:#f1f5f9}
    .gp-overlay-score{font-size:16px;color:#0d9488;font-weight:700}
  `]
})
export class GamePuzzleComponent implements OnInit {
  tiles: number[] = [];
  moves = 0;
  solved = false;
  timerDisplay = '0:00';
  private seconds = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() { this.shuffle(); }

  tileColor(v: number): string { return TILE_COLORS[v - 1] ?? '#0d9488'; }

  shuffle() {
    this.tiles = [...Array(15).keys()].map(i => i + 1);
    this.tiles.push(0);
    // Do random valid moves to ensure solvability
    let blank = 15;
    for (let i = 0; i < 200; i++) {
      const neighbors = this.getNeighbors(blank);
      const n = neighbors[Math.floor(Math.random() * neighbors.length)];
      this.tiles[blank] = this.tiles[n];
      this.tiles[n] = 0;
      blank = n;
    }
    this.moves = 0; this.solved = false; this.started = false;
    this.seconds = 0; this.timerDisplay = '0:00';
    if (this.timerId) clearInterval(this.timerId);
  }

  private getNeighbors(idx: number): number[] {
    const r = Math.floor(idx / 4); const c = idx % 4;
    const ns: number[] = [];
    if (r > 0) ns.push(idx - 4);
    if (r < 3) ns.push(idx + 4);
    if (c > 0) ns.push(idx - 1);
    if (c < 3) ns.push(idx + 1);
    return ns;
  }

  clickTile(i: number) {
    if (this.solved) return;
    const blank = this.tiles.indexOf(0);
    if (!this.getNeighbors(blank).includes(i)) return;
    if (!this.started) {
      this.started = true;
      this.timerId = setInterval(() => {
        this.seconds++;
        const m = Math.floor(this.seconds / 60);
        const s = this.seconds % 60;
        this.timerDisplay = `${m}:${s.toString().padStart(2,'0')}`;
        this.cdr.detectChanges();
      }, 1000);
    }
    this.tiles[blank] = this.tiles[i];
    this.tiles[i] = 0;
    this.moves++;
    this.tiles = [...this.tiles];
    this.checkSolved();
    this.cdr.detectChanges();
  }

  private checkSolved() {
    for (let i = 0; i < 15; i++) if (this.tiles[i] !== i + 1) return;
    this.solved = true;
    if (this.timerId) clearInterval(this.timerId);
    this.cdr.detectChanges();
  }

  solve() {
    this.tiles = [...Array(15).keys()].map(i => i + 1);
    this.tiles.push(0);
    this.solved = true;
    if (this.timerId) clearInterval(this.timerId);
    this.cdr.detectChanges();
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    const blank = this.tiles.indexOf(0);
    const br = Math.floor(blank / 4); const bc = blank % 4;
    let target = -1;
    if (e.key === 'ArrowUp' && br < 3) target = blank + 4;
    if (e.key === 'ArrowDown' && br > 0) target = blank - 4;
    if (e.key === 'ArrowLeft' && bc < 3) target = blank + 1;
    if (e.key === 'ArrowRight' && bc > 0) target = blank - 1;
    if (target >= 0) { e.preventDefault(); this.clickTile(target); }
  }
}
