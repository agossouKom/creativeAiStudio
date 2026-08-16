import { Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface CrosswordWord {
  word: string; row: number; col: number; dir: 'H'|'V'; clue: string; num: number;
}

interface CrosswordTheme {
  name: string; icon: string;
  gridRows: number; gridCols: number;
  words: CrosswordWord[];
}

const THEMES: { [key: string]: CrosswordTheme } = {
  ia: {
    name: 'Intelligence Artificielle', icon: '🤖',
    gridRows: 13, gridCols: 13,
    words: [
      { word: 'NEURAL',  row: 0, col: 0, dir: 'H', clue: 'Réseau de neurones artificiels', num: 1 },
      { word: 'AGENT',   row: 0, col: 7, dir: 'V', clue: 'IA autonome qui agit', num: 2 },
      { word: 'CANVAS',  row: 2, col: 0, dir: 'H', clue: 'Élément HTML pour dessiner', num: 3 },
      { word: 'DATA',    row: 4, col: 0, dir: 'H', clue: 'Données brutes de l\'IA', num: 4 },
      { word: 'ROBOT',   row: 6, col: 2, dir: 'H', clue: 'Machine autonome', num: 5 },
      { word: 'CLOUD',   row: 8, col: 1, dir: 'H', clue: 'Hébergement à distance', num: 6 },
      { word: 'STUDIO',  row: 4, col: 5, dir: 'V', clue: 'Espace créatif numérique', num: 7 },
      { word: 'CODE',    row: 2, col: 8, dir: 'V', clue: 'Instructions pour l\'ordinateur', num: 8 },
      { word: 'MODEL',   row: 10, col: 0, dir: 'H', clue: 'Représentation IA entraînée', num: 9 },
      { word: 'API',     row: 0, col: 4, dir: 'V', clue: 'Interface de programmation', num: 10 },
    ]
  },
  geo: {
    name: 'Géographie', icon: '🌍',
    gridRows: 13, gridCols: 13,
    words: [
      { word: 'FRANCE',  row: 0, col: 0, dir: 'H', clue: 'Pays de la Tour Eiffel', num: 1 },
      { word: 'FLEUVE',  row: 0, col: 3, dir: 'V', clue: 'Grand cours d\'eau', num: 2 },
      { word: 'PARIS',   row: 2, col: 0, dir: 'H', clue: 'Capitale de la France', num: 3 },
      { word: 'ALPES',   row: 4, col: 0, dir: 'H', clue: 'Chaîne montagneuse européenne', num: 4 },
      { word: 'OCEAN',   row: 6, col: 1, dir: 'H', clue: 'Grande étendue d\'eau salée', num: 5 },
      { word: 'LONE',    row: 0, col: 6, dir: 'V', clue: 'Fleuve du Rhône (abrégé)', num: 6 },
      { word: 'EUROPE',  row: 8, col: 0, dir: 'H', clue: 'Continent aux 27 pays de l\'UE', num: 7 },
      { word: 'EQUATEUR',row: 10, col: 0, dir: 'H', clue: 'Ligne qui partage le globe', num: 8 },
      { word: 'POLE',    row: 2, col: 8, dir: 'V', clue: 'Nord ou Sud', num: 9 },
      { word: 'ASIE',    row: 4, col: 7, dir: 'V', clue: 'Plus grand continent', num: 10 },
    ]
  },
  sport: {
    name: 'Sports', icon: '🏆',
    gridRows: 13, gridCols: 13,
    words: [
      { word: 'FOOTBALL', row: 0, col: 0, dir: 'H', clue: 'Sport roi mondial', num: 1 },
      { word: 'FILET',    row: 0, col: 4, dir: 'V', clue: 'Filet au tennis ou volley', num: 2 },
      { word: 'BOXE',     row: 2, col: 0, dir: 'H', clue: 'Combat avec des gants', num: 3 },
      { word: 'NATATION', row: 4, col: 0, dir: 'H', clue: 'Sport aquatique', num: 4 },
      { word: 'RUGBY',    row: 6, col: 1, dir: 'H', clue: 'Sport au ballon ovale', num: 5 },
      { word: 'ARBITRE',  row: 0, col: 7, dir: 'V', clue: 'Juge du match', num: 6 },
      { word: 'TENNIS',   row: 8, col: 0, dir: 'H', clue: 'Raquette et balle jaune', num: 7 },
      { word: 'JUDO',     row: 2, col: 8, dir: 'V', clue: 'Art martial japonais', num: 8 },
      { word: 'SPRINT',   row: 10, col: 0, dir: 'H', clue: 'Course de vitesse courte', num: 9 },
      { word: 'VELO',     row: 4, col: 9, dir: 'V', clue: 'Deux roues et pédales', num: 10 },
    ]
  },
  science: {
    name: 'Sciences', icon: '🔬',
    gridRows: 13, gridCols: 13,
    words: [
      { word: 'ATOME',    row: 0, col: 0, dir: 'H', clue: 'Plus petite unité de matière', num: 1 },
      { word: 'ACIDE',    row: 0, col: 4, dir: 'V', clue: 'pH inférieur à 7', num: 2 },
      { word: 'LASER',    row: 2, col: 0, dir: 'H', clue: 'Lumière amplifiée stimulée', num: 3 },
      { word: 'ENERGIE',  row: 4, col: 0, dir: 'H', clue: 'Capacité à effectuer un travail', num: 4 },
      { word: 'NOYAU',    row: 6, col: 1, dir: 'H', clue: 'Centre de l\'atome', num: 5 },
      { word: 'ONDE',     row: 0, col: 7, dir: 'V', clue: 'Propagation de vibration', num: 6 },
      { word: 'PLASMA',   row: 8, col: 0, dir: 'H', clue: '4e état de la matière', num: 7 },
      { word: 'ADN',      row: 2, col: 8, dir: 'V', clue: 'Support de l\'info génétique', num: 8 },
      { word: 'PROTON',   row: 10, col: 0, dir: 'H', clue: 'Particule chargée positive', num: 9 },
      { word: 'GENE',     row: 4, col: 9, dir: 'V', clue: 'Unité de l\'hérédité', num: 10 },
    ]
  },
  cuisine: {
    name: 'Cuisine', icon: '🍳',
    gridRows: 13, gridCols: 13,
    words: [
      { word: 'RECETTE',  row: 0, col: 0, dir: 'H', clue: 'Instructions pour cuisiner', num: 1 },
      { word: 'RAGOUT',   row: 0, col: 6, dir: 'V', clue: 'Plat mijoté en sauce', num: 2 },
      { word: 'SOUPE',    row: 2, col: 0, dir: 'H', clue: 'Plat liquide chaud', num: 3 },
      { word: 'PATE',     row: 4, col: 0, dir: 'H', clue: 'Farine + eau = ?', num: 4 },
      { word: 'RÔTI',     row: 6, col: 1, dir: 'H', clue: 'Viande cuite au four', num: 5 },
      { word: 'EPICE',    row: 0, col: 3, dir: 'V', clue: 'Poivre, cannelle, cumin...', num: 6 },
      { word: 'GATEAU',   row: 8, col: 0, dir: 'H', clue: 'Déssert célèbre', num: 7 },
      { word: 'FOIE',     row: 2, col: 8, dir: 'V', clue: 'Organe cuisiné gras', num: 8 },
      { word: 'RAGOUT',   row: 10, col: 0, dir: 'H', clue: 'Recette mijotée', num: 9 },
      { word: 'HUILE',    row: 4, col: 9, dir: 'V', clue: 'Liquide gras pour cuire', num: 10 },
    ]
  },
};

const THEME_KEYS = Object.keys(THEMES);

@Component({
  selector: 'app-game-crossword',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="ws-layout">
      <!-- SIDEBAR -->
      <aside class="ws-sidebar">
        <div class="stats-panel">
          <div class="stat-item level">{{currentTheme.icon}} {{currentTheme.name}}</div>
          <div class="stat-item score">Score : {{ score }}</div>
          
          <div class="stat-item progress">
            Trouvés : <span class="found-text">{{found}} / {{total}}</span>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="(found / total) * 100"></div>
            </div>
          </div>
          
          <div class="stat-item progress" style="margin-top: 10px;">
            Temps : <span class="found-text">{{timerDisplay}}</span>
          </div>
          <div class="stat-item progress">
            Indices : <span class="found-text">{{hintsUsed}}</span>
          </div>
        </div>

        <div class="actions-panel">
          <button class="action-btn primary" (click)="restart()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Rejouer
          </button>
          
          <button class="action-btn" (click)="hint()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Indice
          </button>
          
          <button class="action-btn" (click)="showHelp = true">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Aide
          </button>
          
          <button class="action-btn theme" (click)="showThemeSelector = true">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Changer de Thème
          </button>
          
          <a class="action-btn warning" routerLink="/games" style="text-decoration: none; margin-top: 10px;">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Quitter
          </a>
        </div>
      </aside>

      <!-- GAME AREA -->
      <main class="game-area">
        <div class="cw-content">
          <!-- GRID SECTION -->
          <div class="cw-main">
            <div class="cw-grid">
              <div class="cw-row" *ngFor="let row of displayGrid; let ri = index">
                <div class="cw-cell"
                  *ngFor="let cell of row; let ci = index"
                  [class.cw-black]="cell.black"
                  [class.cw-selected]="selectedR === ri && selectedC === ci"
                  [class.cw-correct]="cell.correct"
                  [class.cw-active-word]="isInActiveWord(ri, ci)"
                  (click)="selectCell(ri, ci)">
                  <span class="cw-num" *ngIf="cell.num">{{cell.num}}</span>
                  <span class="cw-letter" *ngIf="!cell.black">{{cell.input}}</span>
                </div>
              </div>
            </div>
            <div class="cw-clue-bar" *ngIf="activeClue">
              <span class="cw-clue-num">{{activeClueNum}}{{activeDir === 'H' ? 'H' : 'V'}} —</span>
              <span class="cw-clue-text">{{activeClue}}</span>
            </div>
          </div>
          
          <!-- CLUES SECTION -->
          <div class="cw-lists">
            <div class="gp-panel">
              <div class="gp-panel-title">Horizontaux</div>
              <div class="cw-clue-item" *ngFor="let w of hWords" (click)="selectWord(w)"
                [class.cw-clue-done]="isWordDone(w)" [class.cw-clue-active]="activeWord === w">
                <span class="cw-clue-n">{{w.num}}H</span> {{w.clue}}
              </div>
            </div>
            <div class="gp-panel">
              <div class="gp-panel-title">Verticaux</div>
              <div class="cw-clue-item" *ngFor="let w of vWords" (click)="selectWord(w)"
                [class.cw-clue-done]="isWordDone(w)" [class.cw-clue-active]="activeWord === w">
                <span class="cw-clue-n">{{w.num}}V</span> {{w.clue}}
              </div>
            </div>
          </div>
        </div>

        <!-- OVERLAYS & MODALS -->
        <div class="overlay" *ngIf="won">
          <div class="overlay-content victory">
            <h2>🎉 Félicitations !</h2>
            <p>Mots Croisés IA terminés !</p>
            <div class="final-stats">
              <p>Temps : <strong>{{timerDisplay}}</strong></p>
              <p>Indices utilisés : <strong>{{hintsUsed}}</strong></p>
              <p>Score Final : <strong>{{score}}</strong></p>
            </div>
            <button class="action-btn primary large" (click)="restart()">Rejouer</button>
          </div>
        </div>

        <!-- THEME SELECTOR MODAL -->
        <div class="modal-backdrop" *ngIf="showThemeSelector">
          <div class="modal">
            <h3>🎨 Choisir un Thème</h3>
            <div class="modal-body">
              <p>Sélectionnez un domaine — la grille se recharge automatiquement !</p>
              <div class="theme-grid">
                <button class="theme-card" 
                  *ngFor="let key of themeKeys"
                  [class.theme-active]="key === selectedThemeKey"
                  (click)="selectTheme(key)">
                  <span class="theme-icon">{{themes[key].icon}}</span>
                  <span class="theme-name">{{themes[key].name}}</span>
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button class="action-btn" (click)="showThemeSelector = false">Annuler</button>
            </div>
          </div>
        </div>

        <!-- HELP MODAL -->
        <div class="modal-backdrop" *ngIf="showHelp">
          <div class="modal">
            <h3>❓ Comment jouer aux Mots Croisés</h3>
            <div class="modal-body">
              <p>Remplissez la grille avec les bons mots !</p>
              <ul>
                <li><strong>Sélection :</strong> Cliquez sur une case ou sur une définition à droite pour sélectionner un mot.</li>
                <li><strong>Saisie :</strong> Tapez directement au clavier pour remplir les lettres.</li>
                <li><strong>Direction :</strong> Appuyez sur la touche <code>Tab</code> pour basculer entre la direction Horizontale et Verticale si une case croise deux mots.</li>
                <li><strong>Correction :</strong> Utilisez <code>Retour arrière</code> (Backspace) pour effacer.</li>
              </ul>
              <div style="background: var(--sidebar-bg); padding: 10px; border-radius: 8px; margin-top: 10px; border: 1px dashed var(--border);">
                <strong>Exemple :</strong> La définition <em>"Machine autonome"</em> (5H) correspond au mot <strong>ROBOT</strong>. Cliquez sur la case avec le chiffre 5 et tapez R-O-B-O-T au clavier.
              </div>
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
      --bg: #0f172a; --text: #f8fafc; --panel-bg: #1e293b; --border: #334155;
      --sidebar-bg: #0b1120; --btn-bg: #334155; --btn-border: #475569; --btn-hover: #475569;
      --primary: #0ea5e9; --primary-hover: #38bdf8; --primary-text: #fff;
      --text-muted: #cbd5e1;
      display:flex; height:100vh; overflow:hidden; background:var(--bg); color:var(--text);
    }

    .ws-sidebar { width:260px; flex-shrink:0; background:var(--sidebar-bg); border-right:1px solid var(--border); display:flex; flex-direction:column; padding:30px 20px; z-index:100; overflow-y:auto; }
    .stats-panel { background:var(--panel-bg); border-radius:12px; padding:16px; margin-bottom:20px; box-shadow:0 2px 4px rgba(0,0,0,0.05); border:1px solid var(--border); }
    .stat-item { margin-bottom:10px; font-weight:600; font-size:15px; color:var(--text); }
    .stat-item.level { font-size:20px; font-weight:900; color:var(--primary); text-transform:uppercase; margin-bottom:14px; text-shadow:0 0 10px rgba(14,165,233,.3); }
    .stat-item.score { color: #10b981; font-size:18px; margin-bottom:18px; }
    
    .progress { font-size:14px; color:var(--text); }
    .found-text { font-weight:800; color:var(--text); }
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

    .game-area { flex:1; position:relative; overflow-y:auto; padding: 20px; display:flex; justify-content:center; align-items:flex-start; background: linear-gradient(135deg, #0a0e1a 0%, #0f172a 50%, #0a1628 100%); }
    
    .cw-content { display:flex; gap: 30px; align-items:flex-start; max-width: 1100px; width: 100%; margin-top: 0; }
    
    .cw-main { display:flex; flex-direction:column; gap:16px; align-items:center; }
    .cw-grid { display:flex; flex-direction:column; gap:2px; background:rgba(255,255,255,.03); padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,.08); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .cw-row { display:flex; gap:2px; }
    
    /* 13x13 grid styling - responsive */
    .cw-cell { width:46px; height:46px; display:flex; align-items:center; justify-content:center; border-radius:6px; cursor:pointer; position:relative; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); transition:all .15s; }
    .cw-cell:hover:not(.cw-black) { background:rgba(14,165,233,.25); }
    .cw-black { background:#070a13!important; border-color:transparent!important; cursor:default; }
    .cw-selected { background:rgba(14,165,233,.6)!important; border-color:#0ea5e9!important; box-shadow: inset 0 0 8px rgba(14,165,233, 0.7); }
    .cw-active-word { background:rgba(14,165,233,.25)!important; border-color:rgba(14,165,233,.5)!important; }
    .cw-correct { background:rgba(16,185,129,.35)!important; border-color:#10b981!important; }
    .cw-num { position:absolute; top:3px; left:5px; font-size:12px; color:#94a3b8; font-weight:800; line-height:1; }
    .cw-letter { font-size:24px; font-weight:900; color:#ffffff; text-transform:uppercase; text-shadow: 0 2px 4px rgba(0,0,0,0.8); }
    
    .cw-clue-bar { width: 100%; padding:14px 18px; background:rgba(14,165,233,.15); border-radius:8px; font-size:18px; font-weight: 500; color:#ffffff; text-align:center; border: 1px solid rgba(14,165,233,.4); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    .cw-clue-num { color:#38bdf8; font-weight:900; margin-right: 8px; font-size: 19px; }

    .cw-lists { display: flex; flex-direction: column; gap: 16px; flex: 1; min-width: 320px; max-width: 400px; }
    .gp-panel { background:var(--panel-bg); border:1px solid var(--border); border-radius:12px; padding:16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .gp-panel-title { font-size:13px; text-transform:uppercase; letter-spacing:.1em; color:#94a3b8; margin-bottom:12px; font-weight:800; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
    
    .cw-clue-item { font-size:15px; font-weight: 500; color:#f8fafc; padding:10px 12px; border-radius:6px; cursor:pointer; margin-bottom:4px; line-height:1.5; transition: 0.2s; border: 1px solid transparent; }
    .cw-clue-item:hover { background:rgba(14,165,233,.15); color:#ffffff; }
    .cw-clue-active { background:rgba(14,165,233,.3); border-color: rgba(14,165,233,.5); color:#ffffff; font-weight: 700; }
    .cw-clue-n { color:#38bdf8; font-weight:900; margin-right:8px; }
    .cw-clue-done { color:#10b981!important; text-decoration:line-through; opacity:.85; }

    /* Modal / Overlay standard */
    .overlay { position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:10; }
    .overlay-content { background:var(--panel-bg); padding:40px; border-radius:24px; text-align:center; max-width:400px; width:90%; box-shadow:0 20px 40px rgba(0,0,0,0.4); border:1px solid var(--border); }
    .overlay-content h2 { margin:0 0 10px; font-size:28px; color:var(--text); }
    .overlay-content p { color:var(--text-muted); margin-bottom:20px; }
    .final-stats { font-size:16px; margin-bottom:24px; background:var(--sidebar-bg); padding:16px; border-radius:12px; border: 1px solid var(--border); }
    
    .modal-backdrop { position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; justify-content:center; align-items:center; z-index:50; backdrop-filter:blur(2px); }
    .modal { background:var(--panel-bg); width:90%; max-width:550px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.4); overflow:hidden; border:1px solid var(--border); animation:fadeUp 0.3s; }
    .modal h3 { margin:0; padding:20px; background:var(--sidebar-bg); border-bottom:1px solid var(--border); color:var(--text); font-size:18px; }
    .modal-body { padding:20px; color:var(--text); font-size:14px; line-height:1.6; }
    .modal-body ul { margin:15px 0; padding-left:20px; }
    .modal-body li { margin-bottom:10px; }
    .modal-body code { background: var(--sidebar-bg); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: var(--primary); }
    .modal-footer { padding:16px 20px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:10px; background:var(--sidebar-bg); }

    .action-btn.theme { color: #f59e0b; border-color: rgba(245,158,11,.3); }
    .action-btn.theme:hover { background: rgba(245,158,11,.1); }

    .theme-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
    .theme-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 12px; border-radius: 12px; border: 2px solid var(--border); background: var(--sidebar-bg); cursor: pointer; transition: 0.2s; color: var(--text); }
    .theme-card:hover { border-color: var(--primary); background: rgba(14,165,233,.1); transform: translateY(-2px); }
    .theme-active { border-color: var(--primary)!important; background: rgba(14,165,233,.2)!important; box-shadow: 0 0 12px rgba(14,165,233,.3); }
    .theme-icon { font-size: 32px; }
    .theme-name { font-size: 13px; font-weight: 700; text-align: center; color: var(--text); }

    @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

    @media (max-width: 950px) {
      .cw-content { flex-direction: column; align-items: center; }
      .cw-lists { width: 100%; max-width: 100%; }
      .cw-cell { width: 34px; height: 34px; }
    }
  `]
})
export class GameCrosswordComponent implements OnInit {
  displayGrid: { black: boolean; input: string; correct: boolean; num?: number }[][] = [];
  selectedR = -1; selectedC = -1;
  activeClue = ''; activeClueNum = 0; activeDir: 'H'|'V' = 'H';
  activeWord: CrosswordWord | null = null;
  found = 0; total = 0; hintsUsed = 0;
  won = false;
  showHelp = false;
  showThemeSelector = false;
  score = 0;
  
  // Theme management
  themeKeys = THEME_KEYS;
  themes = THEMES;
  selectedThemeKey = 'ia';
  get currentTheme() { return THEMES[this.selectedThemeKey]; }
  
  private activeWords: CrosswordWord[] = [];
  hWords: CrosswordWord[] = [];
  vWords: CrosswordWord[] = [];

  timerDisplay = '0:00';
  private seconds = 0;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private solution: string[][] = [];

  constructor(private cdr: ChangeDetectorRef) {}
  ngOnInit() { this.restart(); }

  selectTheme(key: string) {
    this.selectedThemeKey = key;
    this.showThemeSelector = false;
    this.restart();
  }

  restart() {
    const theme = this.currentTheme;
    const GRID_ROWS = theme.gridRows;
    const GRID_COLS = theme.gridCols;
    const WORDS = theme.words;
    
    this.activeWords = WORDS;
    this.hWords = WORDS.filter(w => w.dir === 'H');
    this.vWords = WORDS.filter(w => w.dir === 'V');
    this.total = WORDS.length;

    this.solution = Array.from({length: GRID_ROWS}, () => Array(GRID_COLS).fill(''));
    for (const w of WORDS) {
      for (let i = 0; i < w.word.length; i++) {
        const r = w.dir === 'H' ? w.row : w.row + i;
        const c = w.dir === 'H' ? w.col + i : w.col;
        this.solution[r][c] = w.word[i];
      }
    }
    this.displayGrid = Array.from({length: GRID_ROWS}, (_, ri) =>
      Array.from({length: GRID_COLS}, (_, ci) => {
        const isBlack = this.solution[ri][ci] === '';
        const wordAtCell = WORDS.find(w => w.row === ri && w.col === ci);
        return { black: isBlack, input: '', correct: false, num: wordAtCell?.num };
      })
    );
    this.found = 0; this.hintsUsed = 0; this.won = false; this.score = 0;
    this.selectedR = -1; this.selectedC = -1;
    this.activeClue = ''; this.activeWord = null;
    this.seconds = 0; this.timerDisplay = '0:00';
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      if (!this.won) {
        this.seconds++;
        const m = Math.floor(this.seconds / 60);
        const s = this.seconds % 60;
        this.timerDisplay = `${m}:${s.toString().padStart(2,'0')}`;
        this.cdr.detectChanges();
      }
    }, 1000);
  }

  selectCell(r: number, c: number) {
    if (this.displayGrid[r][c].black) return;
    this.selectedR = r; this.selectedC = c;
    const words = this.activeWords;
    const matchH = words.find(w => w.dir === 'H' && w.row === r && c >= w.col && c < w.col + w.word.length);
    const matchV = words.find(w => w.dir === 'V' && w.col === c && r >= w.row && r < w.row + w.word.length);
    if (matchH && this.activeWord === matchH && matchV) {
      this.activeWord = matchV;
    } else if (matchH) {
      this.activeWord = matchH;
    } else if (matchV) {
      this.activeWord = matchV;
    }
    if (this.activeWord) {
      this.activeClue = this.activeWord.clue;
      this.activeClueNum = this.activeWord.num;
      this.activeDir = this.activeWord.dir;
    }
  }

  selectWord(w: CrosswordWord) {
    this.activeWord = w;
    this.activeClue = w.clue;
    this.activeClueNum = w.num;
    this.activeDir = w.dir;
    this.selectedR = w.row;
    this.selectedC = w.col;
  }

  isInActiveWord(r: number, c: number): boolean {
    if (!this.activeWord) return false;
    const w = this.activeWord;
    if (w.dir === 'H') return r === w.row && c >= w.col && c < w.col + w.word.length;
    return c === w.col && r >= w.row && r < w.row + w.word.length;
  }

  isWordDone(w: CrosswordWord): boolean {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === 'H' ? w.row : w.row + i;
      const c = w.dir === 'H' ? w.col + i : w.col;
      if (this.displayGrid[r][c].input !== w.word[i]) return false;
    }
    return true;
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.selectedR < 0 || !this.activeWord) return;
    const key = e.key.toUpperCase();
    if (/^[A-Z]$/.test(key)) {
      this.displayGrid[this.selectedR][this.selectedC].input = key;
      this.checkCell(this.selectedR, this.selectedC);
      this.advanceCursor();
    } else if (e.key === 'Backspace') {
      if (this.displayGrid[this.selectedR][this.selectedC].input) {
        this.displayGrid[this.selectedR][this.selectedC].input = '';
        this.displayGrid[this.selectedR][this.selectedC].correct = false;
      } else {
        this.retreatCursor();
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.switchDirection();
    }
    this.cdr.detectChanges();
  }

  private checkCell(r: number, c: number) {
    const correct = this.displayGrid[r][c].input === this.solution[r][c];
    this.displayGrid[r][c].correct = correct;
    this.countFound();
  }

  private countFound() {
    const prev = this.found;
    this.found = this.activeWords.filter(w => this.isWordDone(w)).length;
    if (this.found > prev) { this.score += (this.found - prev) * 100; }
    if (this.found === this.total && this.found > 0) {
      this.won = true;
      if (this.timerId) clearInterval(this.timerId);
    }
    this.cdr.detectChanges();
  }

  private advanceCursor() {
    if (!this.activeWord) return;
    const w = this.activeWord;
    const dr = w.dir === 'V' ? 1 : 0;
    const dc = w.dir === 'H' ? 1 : 0;
    const nr = this.selectedR + dr; const nc = this.selectedC + dc;
    const rows = this.displayGrid.length;
    const cols = this.displayGrid[0]?.length || 0;
    if (nr < rows && nc < cols && !this.displayGrid[nr][nc].black) {
      this.selectedR = nr; this.selectedC = nc;
    }
  }

  private retreatCursor() {
    if (!this.activeWord) return;
    const w = this.activeWord;
    const dr = w.dir === 'V' ? -1 : 0;
    const dc = w.dir === 'H' ? -1 : 0;
    const nr = this.selectedR + dr; const nc = this.selectedC + dc;
    if (nr >= 0 && nc >= 0 && !this.displayGrid[nr][nc].black) {
      this.selectedR = nr; this.selectedC = nc;
    }
  }

  private switchDirection() {
    if (!this.activeWord) return;
    const r = this.selectedR; const c = this.selectedC;
    const other = this.activeWords.find(w => w !== this.activeWord &&
      ((w.dir === 'H' && w.row === r && c >= w.col && c < w.col + w.word.length) ||
       (w.dir === 'V' && w.col === c && r >= w.row && r < w.row + w.word.length)));
    if (other) { this.activeWord = other; this.activeClue = other.clue; this.activeClueNum = other.num; this.activeDir = other.dir; }
  }

  hint() {
    if (this.selectedR < 0 || this.selectedC < 0) return;
    const r = this.selectedR; const c = this.selectedC;
    if (this.displayGrid[r][c].black) return;
    this.displayGrid[r][c].input = this.solution[r][c];
    this.displayGrid[r][c].correct = true;
    this.hintsUsed++;
    this.score = Math.max(0, this.score - 10);
    this.countFound();
    this.advanceCursor();
    this.cdr.detectChanges();
  }
}
