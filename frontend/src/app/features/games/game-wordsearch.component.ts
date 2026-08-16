import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface Cell {
  r: number;
  c: number;
  letter: string;
  colorClass: string;
  selected: boolean;
  found: boolean;
  isHint: boolean;
}

interface WordToFind {
  word: string;
  found: boolean;
  positions: {r: number, c: number}[];
}

interface LevelConfig {
  level: number;
  wordCount: number;
  timeLimit: number; // in seconds
  directions: number[][];
  gridSize: number;
}

const DIRS = {
  RIGHT: [0, 1],
  DOWN: [1, 0],
  LEFT: [0, -1],
  UP: [-1, 0],
  DRIGHT: [1, 1],
  DLEFT: [1, -1],
  URIGHT: [-1, 1],
  ULEFT: [-1, -1]
};

const LEVELS: LevelConfig[] = [
  { level: 1, wordCount: 10, timeLimit: 180, directions: [DIRS.RIGHT, DIRS.DOWN], gridSize: 10 },
  { level: 2, wordCount: 10, timeLimit: 150, directions: [DIRS.RIGHT, DIRS.DOWN, DIRS.LEFT], gridSize: 11 },
  { level: 3, wordCount: 12, timeLimit: 120, directions: [DIRS.RIGHT, DIRS.DOWN, DIRS.LEFT, DIRS.UP], gridSize: 12 },
  { level: 4, wordCount: 14, timeLimit: 90,  directions: Object.values(DIRS), gridSize: 13 },
  { level: 5, wordCount: 16, timeLimit: 60,  directions: Object.values(DIRS), gridSize: 14 }
];

@Component({
  selector: 'app-game-wordsearch',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="ws-layout" [class.dark-theme]="isDarkMode">
      
      <!-- HEADER MOBILE ONLY -->
      <div class="mobile-header">
        <div class="mobile-title">Mots Mêlés</div>
        <button class="menu-btn" (click)="toggleMobileSidebar()">☰</button>
      </div>


      <!-- SIDEBAR -->
      <aside class="ws-sidebar" [class.mobile-open]="mobileSidebarOpen">
        
        <div class="stats-panel">
          <div class="stat-item level">Niveau {{ currentLevelConfig.level }}</div>
          
          <div class="stat-item time" [class.time-low]="timeLeft < 30 && timerActive" *ngIf="timerActive">
            ⏳ {{ formatTime(timeLeft) }}
          </div>
          <div class="stat-item time" *ngIf="!timerActive">
            ⏳ Sans limite
          </div>

          <div class="stat-item score">Score : {{ score }}</div>
          <div class="stat-item progress">
            Trouvés : <span class="found-text">{{ wordsFoundCount }} / {{ currentLevelConfig.wordCount }}</span>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="(wordsFoundCount / currentLevelConfig.wordCount) * 100"></div>
            </div>
          </div>
          <div class="stat-item combo" *ngIf="combo > 1">🔥 Combo x{{ combo }} !</div>
        </div>

        <div class="actions-panel">
          <button class="action-btn primary" (click)="confirmReset(true)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Nouvelle partie
          </button>
          <button class="action-btn" (click)="confirmReset(false)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6M21.5 22v-6h-6M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/></svg>
            Réinitialiser
          </button>
          
          <button class="action-btn" (click)="togglePause()" *ngIf="timerActive">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect *ngIf="!isPaused" x="6" y="4" width="4" height="16"></rect>
              <rect *ngIf="!isPaused" x="14" y="4" width="4" height="16"></rect>
              <polygon *ngIf="isPaused" points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            {{ isPaused ? 'Reprendre' : 'Pause' }}
          </button>
          
          <button class="action-btn warning" (click)="disableTimer()" *ngIf="timerActive" title="Désactiver le chronomètre (score non enregistré)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
            Arrêter Timer
          </button>

          <button class="action-btn hint" (click)="useHint()" [disabled]="hintsRemaining <= 0 || isPaused || isGameOver">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2v1"/><path d="M12 6a6 6 0 0 1 6 6c0 1.66-.67 3.16-1.76 4.24-.31.32-.48.77-.48 1.22v.54h-7.52v-.54c0-.45-.17-.9-.48-1.22A5.96 5.96 0 0 1 6 12a6 6 0 0 1 6-6Z"/></svg>
            Indice ({{ hintsRemaining }})
          </button>
          
          <button class="action-btn" (click)="showHelp = true">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            Aide
          </button>
          <button class="action-btn" (click)="toggleTheme()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            {{ isDarkMode ? 'Mode Clair' : 'Mode Sombre' }}
          </button>
        </div>
      </aside>

      <!-- GAME AREA -->
      <main class="game-area">
        
        <div class="game-content-wrapper" [class.paused-blur]="isPaused && !isGameOver">
          <!-- GRID (Left) -->
          <div class="grid-container" (mouseleave)="endSelection()">
            <div class="grid-row" *ngFor="let row of grid; let r = index">
              <div class="grid-cell" 
                   *ngFor="let cell of row; let c = index"
                   [attr.data-r]="r" [attr.data-c]="c"
                   [ngClass]="[cell.colorClass, cell.selected ? 'selected' : '', cell.found ? 'found' : '', cell.isHint ? 'hint-pulse' : '']"
                   (mousedown)="startSelection(r, c)"
                   (mouseenter)="updateSelection(r, c)"
                   (mouseup)="endSelection()"
                   (touchstart)="startTouch($event, r, c)"
                   (touchmove)="moveTouch($event)"
                   (touchend)="endSelection()">
                {{ cell.letter }}
              </div>
            </div>
          </div>

          <!-- WORDS LIST (Right) -->
          <div class="words-container">
            <div class="words-header">
              <div class="words-title">MOTS À TROUVER</div>
              <a class="words-back-btn" routerLink="/games" title="Quitter le jeu">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
                Quitter
              </a>
            </div>
            <div class="words-grid">
              <div class="word-badge" *ngFor="let w of words" [class.found]="w.found">
                {{ w.word }}
              </div>
            </div>
            
            <div class="definition-panel" *ngIf="activeDefinition">
              <div class="def-title">Dictionnaire : {{ activeDefinition.word }}</div>
              <div class="def-text">{{ activeDefinition.text }}</div>
            </div>
          </div>
        </div>

        <!-- OVERLAYS -->
        <div class="overlay" *ngIf="isPaused && !showHelp && !showConfirm && !isGameOver">
          <div class="overlay-content">
            <h2>Jeu en pause</h2>
            <button class="action-btn primary large" (click)="togglePause()">Reprendre</button>
          </div>
        </div>

        <div class="overlay" *ngIf="isGameOver">
          <div class="overlay-content victory" *ngIf="hasWon">
            <h2>🎉 Niveau terminé !</h2>
            <div class="final-stats">
              <p>Score : <strong>{{ score }}</strong></p>
              <p *ngIf="timerActive">Temps restant : <strong>{{ formatTime(timeLeft) }}</strong></p>
            </div>
            <div class="victory-actions">
              <button class="action-btn primary large" *ngIf="currentLevel < 5" (click)="nextLevel()">Niveau Suivant</button>
              <button class="action-btn large" (click)="startLevel(currentLevel)">Rejouer</button>
            </div>
          </div>
          <div class="overlay-content defeat" *ngIf="!hasWon">
            <h2>⏱ Temps écoulé !</h2>
            <div class="final-stats">
              <p>Score : <strong>{{ score }}</strong></p>
            </div>
            <button class="action-btn primary large" (click)="startLevel(currentLevel)">Réessayer</button>
          </div>
        </div>

        <!-- MODALS -->
        <div class="modal-backdrop" *ngIf="showHelp">
          <div class="modal">
            <h3>❓ Comment jouer ?</h3>
            <div class="modal-body">
              <p>Choisis un mot dans la liste, par exemple <strong>BAGUETTE</strong>.</p>
              <p>Cherche la première lettre du mot dans la grille.</p>
              <p>Vérifie si les lettres suivantes sont alignées :</p>
              <ul>
                <li>gauche → droite / droite ← gauche</li>
                <li>haut ↓ bas / bas ↑ haut</li>
                <li>diagonales ↘ ↙ ↗ ↖</li>
              </ul>
              <p>Sélectionne le mot en glissant le doigt ou la souris de la première à la dernière lettre.</p>
              <p>Le mot trouvé devient barré ou change de couleur.</p>
              <p>Tu gagnes lorsque tous les mots ont été trouvés avant la fin du chrono !</p>
            </div>
            <div class="modal-footer">
              <label class="dont-show"><input type="checkbox" [(ngModel)]="dontShowHelp"> Ne plus afficher au démarrage</label>
              <button class="action-btn primary" (click)="closeHelp()">Fermer</button>
            </div>
          </div>
        </div>

        <div class="modal-backdrop" *ngIf="showConfirm">
          <div class="modal">
            <h3>⚠️ Confirmation</h3>
            <div class="modal-body">
              <p>{{ confirmMessage }}</p>
            </div>
            <div class="modal-footer">
              <button class="action-btn" (click)="cancelConfirm()">Annuler</button>
              <button class="action-btn primary" (click)="executeConfirm()">Confirmer</button>
            </div>
          </div>
        </div>

      </main>
    </div>
  `,
  styles: [`
    :host { display:block; height:100vh; overflow:hidden; font-family:'Segoe UI',system-ui,sans-serif; }
    
    /* THEMES (Higher contrast for light mode) */
    .ws-layout {
      --bg: #f1f5f9; --text: #0f172a; --panel-bg: #ffffff; --border: #cbd5e1;
      --sidebar-bg: #e2e8f0; --btn-bg: #f8fafc; --btn-border: #cbd5e1; --btn-hover: #e2e8f0;
      --primary: #0284c7; --primary-hover: #0369a1; --primary-text: #fff;
      --grid-bg: #ffffff; --word-bg: #e0f2fe; --word-text: #0369a1; --word-found: #64748b;
      --text-muted: #334155;
      
      display:flex; height:100vh; overflow:hidden; background:var(--bg); color:var(--text); transition: background 0.3s, color 0.3s; position:relative;
    }

    .ws-layout.dark-theme {
      --bg: #0f172a; --text: #f8fafc; --panel-bg: #1e293b; --border: #334155;
      --sidebar-bg: #0f172a; --btn-bg: #334155; --btn-border: #475569; --btn-hover: #475569;
      --primary: #0ea5e9; --primary-hover: #38bdf8;
      --grid-bg: #1e293b; --word-bg: #0c4a6e; --word-text: #e0f2fe; --word-found: #64748b;
      --text-muted: #cbd5e1;
    }


    /* MOBILE HEADER */
    .mobile-header { display:none; align-items:center; justify-content:space-between; padding:12px 20px; background:var(--panel-bg); border-bottom:1px solid var(--border); }
    .mobile-title { font-weight:800; font-size:18px; }
    .menu-btn, .back-btn-mobile { background:transparent; border:none; color:var(--text); font-size:24px; cursor:pointer; text-decoration:none; display:flex; align-items:center;}

    /* WS-SIDEBAR */
    .ws-sidebar { width:260px; flex-shrink:0; background:var(--sidebar-bg); border-right:1px solid var(--border); display:flex; flex-direction:column; padding:30px 20px; z-index:100; transition:transform 0.3s; position:static; top:auto; max-height:none; overflow-y:auto; }
    .stats-panel { background:var(--panel-bg); border-radius:12px; padding:16px; margin-bottom:20px; box-shadow:0 2px 4px rgba(0,0,0,0.05); border:1px solid var(--border); }
    .stat-item { margin-bottom:10px; font-weight:600; font-size:14px; color:var(--text-muted); }
    .stat-item.level { font-size:18px; font-weight:900; color:var(--primary); text-transform:uppercase; margin-bottom:12px;}
    .stat-item.time { font-size:22px; font-family:monospace; margin-bottom:12px; color:var(--text); }
    .stat-item.time-low { color: #ef4444; animation: pulse 1s infinite; }
    .stat-item.combo { color: #f59e0b; animation: pop 0.3s ease-out; }
    
    .progress { font-size:13px; color:var(--text-muted); }
    .found-text { font-weight:700; color:var(--text); }
    .progress-bar { height:6px; background:var(--btn-bg); border-radius:3px; margin-top:6px; overflow:hidden; border:1px solid var(--border); }
    .progress-fill { height:100%; background:var(--primary); transition:width 0.3s; }

    .actions-panel { display:flex; flex-direction:column; gap:8px; }
    .action-btn { display:flex; align-items:center; gap:10px; width:100%; padding:10px 14px; border:1px solid var(--btn-border); border-radius:8px; background:var(--btn-bg); color:var(--text); font-weight:600; font-size:14px; cursor:pointer; transition:0.2s; text-align:left; box-shadow:0 1px 2px rgba(0,0,0,0.05); }
    .action-btn:hover:not([disabled]) { background:var(--btn-hover); transform:translateY(-1px); }
    .action-btn[disabled] { opacity:0.5; cursor:not-allowed; }
    .action-btn.primary { background:var(--primary); color:var(--primary-text); border-color:var(--primary); }
    .action-btn.primary:hover { background:var(--primary-hover); }
    .action-btn.warning { color: #ef4444; }
    .action-btn.large { justify-content:center; padding:14px; font-size:16px; }
    .action-btn .icon { width:18px; height:18px; }

    /* GAME AREA */
    .game-area { flex:1; display:flex; flex-direction:column; align-items:flex-start; overflow-y:auto; padding:30px 40px; position:relative; }
    .game-content-wrapper { display:flex; flex-direction:row; align-items:flex-start; gap:40px; width:100%; transition:filter 0.3s; }
    .paused-blur { filter:blur(8px) grayscale(50%); pointer-events:none; }

    /* WORDS RIGHT PANEL */
    .words-container { flex:1; max-width:400px; background:var(--panel-bg); border-radius:16px; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.05); border:1px solid var(--border); }
    .words-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
    .words-title { font-size:13px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; }
    .words-back-btn { display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:700; color:var(--text-muted); text-decoration:none; padding:5px 10px; border-radius:8px; border:1px solid var(--btn-border); background:var(--btn-bg); transition:0.2s; }
    .words-back-btn svg { width:15px; height:15px; }
    .words-back-btn:hover { background:var(--btn-hover); color:var(--text); transform:translateX(-2px); }
    .words-grid { display:flex; flex-wrap:wrap; gap:8px; align-content:flex-start; }
    .word-badge { background:var(--word-bg); color:var(--word-text); padding:6px 12px; border-radius:16px; font-weight:700; font-size:13px; transition:0.3s; border:1px solid rgba(0,0,0,0.05); }
    .word-badge.found { background:var(--btn-bg); color:var(--word-found); text-decoration:line-through; opacity:0.6; transform:scale(0.95); border-color:var(--border); }
    
    .definition-panel { padding:14px; background:var(--btn-bg); border-left:4px solid var(--primary); border-radius:8px; animation: fadeUp 0.3s; margin-top: 16px; }
    .def-title { font-size:13px; font-weight:800; color:var(--primary); margin-bottom:6px; text-transform: uppercase; }
    .def-text { font-size:13.5px; color:var(--text-muted); line-height:1.4; }

    /* GRID */
    .grid-container { background:var(--grid-bg); padding:16px; border-radius:16px; box-shadow:0 8px 24px rgba(0,0,0,0.1); display:flex; flex-direction:column; gap:2px; user-select:none; touch-action:none; border:1px solid var(--border); }
    .grid-row { display:flex; gap:2px; }
    .grid-cell { width:36px; height:36px; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; color:#111; border-radius:6px; cursor:pointer; transition:transform 0.1s; }
    
    /* CELL COLORS (Bright and distinct) */
    .c-green { background-color: #4ade80; }
    .c-blue { background-color: #60a5fa; }
    .c-red { background-color: #f87171; }
    .c-yellow { background-color: #facc15; }
    
    .grid-cell.selected { transform:scale(0.85); box-shadow:inset 0 0 0 4px rgba(255,255,255,0.9); opacity:0.9; }
    .grid-cell.found { opacity:0.35; filter:grayscale(30%); box-shadow:inset 0 0 0 2px rgba(0,0,0,0.3); }
    .grid-cell.hint-pulse { animation: hintPulse 1.5s infinite; border: 3px solid #111; z-index:10; }

    /* OVERLAYS & MODALS */
    .overlay, .modal-backdrop { position:absolute; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:200; }
    .modal-backdrop { position:fixed; } /* Cover whole screen */
    
    .overlay-content, .modal { background:var(--panel-bg); color:var(--text); padding:32px; border-radius:24px; text-align:center; box-shadow:0 20px 40px rgba(0,0,0,0.2); max-width:500px; width:90%; border:1px solid var(--border); }
    .overlay-content h2 { font-size:28px; margin-top:0; margin-bottom:16px; font-weight:900;}
    .victory h2 { color: #f59e0b; }
    .defeat h2 { color: #ef4444; }
    
    .final-stats { font-size:16px; margin-bottom:24px; color:var(--text-muted); }
    .final-stats strong { color:var(--text); font-size:20px; }
    .victory-actions { display:flex; gap:12px; justify-content:center; }
    
    .modal { text-align:left; padding:24px; }
    .modal h3 { margin-top:0; font-size:20px; margin-bottom:16px; color:var(--primary); font-weight:800;}
    .modal-body { line-height:1.6; margin-bottom:24px; color:var(--text-muted); font-size:15px;}
    .modal-body strong { color:var(--text); }
    .modal-body ul { padding-left:20px; margin:8px 0; }
    .modal-body li { margin-bottom:4px; }
    .modal-footer { display:flex; justify-content:flex-end; gap:12px; align-items:center; }
    .dont-show { margin-right:auto; font-size:13px; color:var(--text-muted); cursor:pointer; }

    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    @keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
    @keyframes hintPulse { 0% { transform:scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); } 70% { transform:scale(1.1); box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); } 100% { transform:scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); } }

    /* RESPONSIVE */
    @media (max-width: 1024px) {
      .game-content-wrapper { flex-direction:column; align-items:center; }
      .words-container { max-width:100%; width:100%; order:-1; }
    }
    @media (max-width: 900px) {
      .ws-sidebar { position:fixed; top:0; left:-280px; height:100vh; box-shadow:4px 0 16px rgba(0,0,0,0.1); width:280px;}
      .ws-sidebar.mobile-open { left:0; }
      .mobile-header { display:flex; }
      .game-area { padding: 16px; }
      .grid-cell { width:30px; height:30px; font-size:14px; }
    }
    @media (max-width: 480px) {
      .grid-cell { width:24px; height:24px; font-size:12px; }
      .words-container { padding: 12px; }
      .word-badge { padding:6px 12px; font-size:12px; }
      .overlay-content, .modal { padding: 20px; }
      .victory-actions { flex-direction:column; }
    }
  `]
})
export class GameWordsearchComponent implements OnInit, OnDestroy {
  isDarkMode = true;
  showHelp = false;
  dontShowHelp = false;
  
  mobileSidebarOpen = false;
  
  // Level & Stats
  currentLevel = 1;
  currentLevelConfig!: LevelConfig;
  score = 0;
  combo = 0;
  comboTimeout: any;
  timeLeft = 0;
  timerInterval: any;
  isPaused = false;
  isGameOver = false;
  hasWon = false;
  wordsFoundCount = 0;
  hintsRemaining = 3;

  // Grid
  grid: Cell[][] = [];
  words: WordToFind[] = [];
  
  // Selection
  isSelecting = false;
  startR = -1;
  startC = -1;
  currentPath: {r: number, c: number}[] = [];

  // Modals
  showConfirm = false;
  confirmMessage = '';
  confirmAction: (() => void) | null = null;
  
  // Timer State
  timerActive = true;

  activeDefinition: { word: string, text: string } | null = null;

  private DICTIONARY: {[key: string]: string} = {
    'BAGUETTE': "Pain long et fin, emblème de la boulangerie française.",
    'ÉCLAIR': "Pâtisserie allongée en pâte à choux, fourrée de crème et glacée.",
    'BOUDIN': "Charcuterie à base de sang de porc (noir) ou de viande blanche (blanc).",
    'GOUGÈRES': "Petites chouquettes salées au fromage, typiques de la Bourgogne.",
    'BRIE': "Fromage à pâte molle et à croûte fleurie, originaire de la Brie.",
    'VIN': "Boisson alcoolisée obtenue par la fermentation du raisin.",
    'CRÊPE': "Fine couche de pâte cuite, souvent garnie de sucre ou confiture.",
    'PAIN': "Aliment de base fait de farine, d'eau et de sel.",
    'CROISSANT': "Viennoiserie en forme de demi-lune, à base de pâte feuilletée beurrée.",
    'COMTÉ': "Fromage français à pâte pressée cuite, produit en Franche-Comté.",
    'FROMAGE': "Aliment obtenu par coagulation du lait, suivi d'un égouttage.",
    'MACARON': "Petit gâteau à l'amande, croquant à l'extérieur et moelleux à l'intérieur.",
    'QUICHE': "Tarte salée à base de migaine (œufs et crème) et de divers ingrédients.",
    'MOULES': "Fruits de mer bivalves, souvent cuisinés à la marinière.",
    'TARTINE': "Tranche de pain recouverte de beurre, confiture, ou autres.",
    'CAMEMBERT': "Fromage normand à pâte molle, célèbre pour sa boîte en bois.",
    'ROQUEFORT': "Fromage persillé au lait de brebis, affiné dans les caves.",
    'RACLETTE': "Plat convivial à base de fromage fondu, charcuterie et pommes de terre.",
    'FONDUE': "Plat où l'on trempe des morceaux de pain dans du fromage fondu.",
    'MERINGUE': "Pâtisserie légère faite de blancs d'œufs battus en neige avec du sucre.",
    'CANELÉ': "Petit gâteau bordelais aromatisé au rhum et à la vanille.",
    'CHOCOLAT': "Aliment sucré produit à partir de fèves de cacao.",
    'VANILLE': "Épice issue de l'orchidée, très utilisée en pâtisserie.",
    'SAUCISSON': "Charcuterie sèche composée de viande hachée assaisonnée.",
    'MOUTARDE': "Condiment piquant préparé à partir de graines de moutarde.",
    'CONFITURE': "Mélange de fruits cuits avec du sucre, pour la conservation.",
    'BEURRE': "Matière grasse obtenue par barattage de la crème du lait."
  };

  private wordBank = [
    'BAGUETTE', 'ÉCLAIR', 'BOUDIN', 'GOUGÈRES', 'BRIE', 'VIN', 'CRÊPE', 'PAIN', 
    'CROISSANT', 'COMTÉ', 'FROMAGE', 'MACARON', 'QUICHE', 'MOULES', 'TARTINE',
    'CAMEMBERT', 'ROQUEFORT', 'RACLETTE', 'FONDUE', 'MERINGUE', 'CANELÉ', 
    'CHOCOLAT', 'VANILLE', 'SAUCISSON', 'MOUTARDE', 'CONFITURE', 'BEURRE'
  ];

  ngOnInit() {
    const savedHelp = localStorage.getItem('ws_dontShowHelp');
    if (savedHelp === 'true') {
      this.dontShowHelp = true;
    } else {
      this.showHelp = true;
    }
    this.startLevel(1);
    
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnDestroy() {
    this.stopTimer();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  onVisibilityChange = () => {
    if (document.hidden && !this.isPaused && !this.isGameOver && !this.showHelp) {
      this.isPaused = true;
      this.stopTimer();
    }
  }

  toggleMobileSidebar() {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
  }

  closeHelp() {
    this.showHelp = false;
    if (this.dontShowHelp) {
      localStorage.setItem('ws_dontShowHelp', 'true');
    }
    if (!this.isGameOver && !this.isPaused && this.timeLeft > 0) {
      this.startTimer();
    }
  }

  // --- GAME LOGIC ---

  startLevel(levelNumber: number, resetScore: boolean = false) {
    if (levelNumber > LEVELS.length) levelNumber = LEVELS.length;
    this.currentLevel = levelNumber;
    this.currentLevelConfig = LEVELS[levelNumber - 1];
    
    if (resetScore) {
      this.score = 0;
      this.hintsRemaining = 3;
    }
    
    this.wordsFoundCount = 0;
    this.combo = 0;
    this.activeDefinition = null;
    
    this.isGameOver = false;
    this.hasWon = false;
    this.isPaused = false;
    this.timeLeft = this.currentLevelConfig.timeLimit;
    
    this.generateGrid();
    
    if (!this.showHelp && this.timerActive) {
      this.startTimer();
    }
    this.mobileSidebarOpen = false;
  }

  nextLevel() {
    this.startLevel(this.currentLevel + 1);
  }

  disableTimer() {
    this.timerActive = false;
    this.stopTimer();
  }

  confirmReset(newGame: boolean) {
    this.isPaused = true;
    this.stopTimer();
    this.showConfirm = true;
    if (newGame) {
      this.confirmMessage = "Voulez-vous vraiment commencer une nouvelle partie ? Votre score et progression seront perdus.";
      this.confirmAction = () => { this.startLevel(1, true); };
    } else {
      this.confirmMessage = `Voulez-vous recommencer le niveau ${this.currentLevel} ? Le chronomètre sera réinitialisé.`;
      this.confirmAction = () => { this.startLevel(this.currentLevel); };
    }
    this.mobileSidebarOpen = false;
  }

  cancelConfirm() {
    this.showConfirm = false;
    this.confirmAction = null;
    this.togglePause(); // unpause
  }

  executeConfirm() {
    this.showConfirm = false;
    if (this.confirmAction) {
      this.confirmAction();
    }
  }

  togglePause() {
    if (this.isGameOver || this.showHelp || this.showConfirm || !this.timerActive) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.stopTimer();
    } else {
      this.startTimer();
    }
    this.mobileSidebarOpen = false;
  }

  private startTimer() {
    if (!this.timerActive) return;
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.endGame(false);
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private endGame(win: boolean) {
    this.stopTimer();
    this.isGameOver = true;
    this.hasWon = win;
    if (win) {
      // Bonus score based on time remaining
      this.score += this.timeLeft * 10;
    }
  }

  // --- GRID GENERATION ---

  generateGrid() {
    // Select random words
    const shuffledBank = [...this.wordBank].sort(() => Math.random() - 0.5);
    const selectedWords = shuffledBank.slice(0, this.currentLevelConfig.wordCount).map(w => w.toUpperCase());
    
    this.words = selectedWords.map(w => ({ word: w, found: false, positions: [] }));

    this.grid = [];
    const colorClasses = ['c-green', 'c-blue', 'c-red', 'c-yellow'];
    const size = this.currentLevelConfig.gridSize;

    for (let r = 0; r < size; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < size; c++) {
        row.push({
          r, c, letter: '', 
          colorClass: colorClasses[Math.floor(Math.random() * colorClasses.length)],
          selected: false, found: false, isHint: false
        });
      }
      this.grid.push(row);
    }

    // Place words
    for (const w of this.words) {
      this.placeWord(w);
    }

    // Fill blanks
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!this.grid[r][c].letter) {
          this.grid[r][c].letter = alphabet[Math.floor(Math.random() * alphabet.length)];
        }
      }
    }
  }

  private placeWord(w: WordToFind) {
    const cleanWord = w.word.replace(/ /g, '');
    const dirs = this.currentLevelConfig.directions;
    const size = this.currentLevelConfig.gridSize;
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 200) {
      attempts++;
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      const dir = dirs[Math.floor(Math.random() * dirs.length)];

      if (this.canPlace(cleanWord, r, c, dir[0], dir[1])) {
        for (let i = 0; i < cleanWord.length; i++) {
          const nr = r + i * dir[0];
          const nc = c + i * dir[1];
          this.grid[nr][nc].letter = cleanWord[i];
          w.positions.push({r: nr, c: nc});
        }
        placed = true;
      }
    }
  }

  private canPlace(word: string, r: number, c: number, dr: number, dc: number): boolean {
    const size = this.currentLevelConfig.gridSize;
    if (
      r + (word.length - 1) * dr < 0 || r + (word.length - 1) * dr >= size ||
      c + (word.length - 1) * dc < 0 || c + (word.length - 1) * dc >= size
    ) {
      return false; 
    }
    for (let i = 0; i < word.length; i++) {
      const nr = r + i * dr;
      const nc = c + i * dc;
      const currentLetter = this.grid[nr][nc].letter;
      if (currentLetter !== '' && currentLetter !== word[i]) return false; 
    }
    return true;
  }

  useHint() {
    if (this.hintsRemaining <= 0 || this.isPaused || this.isGameOver) return;
    
    // Find first not found word
    const target = this.words.find(w => !w.found);
    if (target && target.positions.length > 0) {
      this.hintsRemaining--;
      const firstPos = target.positions[0];
      this.grid[firstPos.r][firstPos.c].isHint = true;
      setTimeout(() => {
        this.grid[firstPos.r][firstPos.c].isHint = false;
      }, 3000);
    }
  }

  // --- SELECTION LOGIC ---

  startSelection(r: number, c: number) {
    if (this.isGameOver || this.isPaused) return;
    this.isSelecting = true;
    this.startR = r;
    this.startC = c;
    this.clearSelection();
    this.addToSelection(r, c);
  }

  updateSelection(r: number, c: number) {
    if (!this.isSelecting || this.isGameOver || this.isPaused) return;
    
    const dr = r - this.startR;
    const dc = c - this.startC;
    
    if (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) {
      this.clearSelection();
      const steps = Math.max(Math.abs(dr), Math.abs(dc));
      const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
      const stepC = dc === 0 ? 0 : dc / Math.abs(dc);
      
      for (let i = 0; i <= steps; i++) {
        this.addToSelection(this.startR + i * stepR, this.startC + i * stepC);
      }
    }
  }

  endSelection() {
    if (!this.isSelecting) return;
    this.isSelecting = false;
    
    const selectedWord = this.currentPath.map(pos => this.grid[pos.r][pos.c].letter).join('');
    const reversedWord = selectedWord.split('').reverse().join('');
    
    let foundMatch = false;
    for (const w of this.words) {
      const cleanTarget = w.word.replace(/ /g, '');
      if (!w.found && (selectedWord === cleanTarget || reversedWord === cleanTarget)) {
        w.found = true;
        foundMatch = true;
        this.wordsFoundCount++;
        
        const dictDef = this.DICTIONARY[w.word] || 'Mot trouvé !';
        this.activeDefinition = { word: w.word, text: dictDef };
        
        // Mark grid cells
        this.currentPath.forEach(pos => {
          this.grid[pos.r][pos.c].found = true;
          this.grid[pos.r][pos.c].isHint = false; // clear hint if any
        });
        
        // Score & Combo
        this.combo++;
        const points = (100 * this.currentLevel) + (this.combo > 1 ? 50 * this.combo : 0);
        this.score += points;
        
        if (this.comboTimeout) clearTimeout(this.comboTimeout);
        this.comboTimeout = setTimeout(() => { this.combo = 0; }, 5000); // 5s to keep combo
        
        break;
      }
    }
    
    if (!foundMatch) {
      this.combo = 0; // reset combo on wrong guess
    }
    
    this.clearSelection();
    
    if (this.wordsFoundCount === this.currentLevelConfig.wordCount) {
      this.endGame(true);
    }
  }

  private addToSelection(r: number, c: number) {
    this.grid[r][c].selected = true;
    this.currentPath.push({r, c});
  }

  private clearSelection() {
    this.currentPath.forEach(pos => this.grid[pos.r][pos.c].selected = false);
    this.currentPath = [];
  }

  startTouch(e: TouchEvent, r: number, c: number) {
    if (e.cancelable) e.preventDefault();
    this.startSelection(r, c);
  }

  moveTouch(e: TouchEvent) {
    if (e.cancelable) e.preventDefault();
    if (!this.isSelecting) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement;
    if (el && el.classList.contains('grid-cell')) {
      const r = parseInt(el.getAttribute('data-r') || '-1', 10);
      const c = parseInt(el.getAttribute('data-c') || '-1', 10);
      if (r >= 0 && c >= 0) {
        this.updateSelection(r, c);
      }
    }
  }

  @HostListener('window:mouseup')
  onGlobalMouseUp() {
    this.endSelection();
  }
}
