import { Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface GameCard {
  id: string; name: string; icon: string; desc: string;
  diff: string; route: string; color: string;
}

@Component({
  selector: 'app-games-hub',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="hub">
      <div class="hub-gamepad-status">
        <span class="hub-gp-dot" [class.hub-gp-dot-on]="gamepadConnected"></span>
        {{ gamepadConnected ? ('🎮 ' + gamepadName) : '🎮 Manette non détectée (appuie sur un bouton pour l\\'activer)' }}
        <span *ngIf="gamepadConnected" class="hub-gp-raw">axes: [{{ gamepadAxesDebug }}] · boutons pressés: [{{ gamepadButtonsDebug }}]</span>
      </div>
      <div class="hub-grid">
        <a class="hub-card" #hubCard *ngFor="let g of games" [routerLink]="g.route" [style.--c]="g.color">
          <div class="hub-icon">{{g.icon}}</div>
          <div class="hub-name">{{g.name}}</div>
          <div class="hub-desc">{{g.desc}}</div>
          <div class="hub-footer">
            <span class="hub-diff">{{g.diff}}</span>
            <span class="hub-play">Jouer →</span>
          </div>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .hub{min-height:100vh;background:linear-gradient(135deg,#0a0e1a,#0f172a);padding:0;overflow-y:auto;font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0}
    .hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;padding:16px 32px 40px;max-width:1200px;margin:0 auto}
    .hub-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px;cursor:pointer;transition:all .25s;text-decoration:none;display:block;color:inherit}
    .hub-card:hover,.hub-card:focus-visible{transform:translateY(-4px);border-color:var(--c);box-shadow:0 8px 30px rgba(0,0,0,.3),0 0 20px var(--c,rgba(13,148,136,.3));background:rgba(255,255,255,.07)}
    .hub-card:focus-visible{outline:2px solid var(--c,#0d9488);outline-offset:2px}
    .hub-icon{font-size:36px;margin-bottom:12px}
    .hub-name{font-size:15px;font-weight:700;color:#f1f5f9;margin-bottom:4px}
    .hub-desc{font-size:12px;color:#64748b;margin-bottom:12px;line-height:1.4}
    .hub-footer{display:flex;justify-content:space-between;align-items:center}
    .hub-diff{font-size:13px;color:#f59e0b}
    .hub-play{font-size:11px;padding:4px 12px;border-radius:6px;background:rgba(13,148,136,.2);color:#0d9488;border:1px solid rgba(13,148,136,.3);font-weight:600}
    .hub-gamepad-status{display:flex;align-items:center;gap:8px;max-width:1200px;margin:0 auto;padding:16px 32px 0;font-size:12px;color:#8892b0}
    .hub-gp-dot{width:8px;height:8px;border-radius:50%;background:#dc2626;flex-shrink:0}
    .hub-gp-dot-on{background:#4CAF50}
    .hub-gp-raw{margin-left:8px;color:#4a5578;font-family:monospace;font-size:11px}
  `]
})
export class GamesHubComponent implements OnInit, OnDestroy {
  games: GameCard[] = [
    { id:'2048',      name:'2048 Cartes',       icon:'🃏', desc:'Fusionne les tuiles',       diff:'★★☆', route:'/games/2048',      color:'#f59e0b' },
    { id:'tetris',    name:'Tetris Designs',     icon:'🟦', desc:'Empile les blocs',          diff:'★★☆', route:'/games/tetris',    color:'#7c3aed' },
    { id:'asteroid',  name:'Asteroid Blaster',   icon:'🚀', desc:'Détruire les roches',       diff:'★★★', route:'/games/asteroid',  color:'#1e40af' },
    { id:'platformer',name:'Platformer Hero',    icon:'🤖', desc:'Saute et collecte',         diff:'★★☆', route:'/games/platformer',color:'#059669' },
    { id:'whack',     name:'Whack-a-Bug',        icon:'🐛', desc:'Élimine les bugs',          diff:'★☆☆', route:'/games/whack',    color:'#dc2626' },
    { id:'dino',      name:'Dino Run',           icon:'🦕', desc:'Runner infini',              diff:'★★☆', route:'/games/dino',     color:'#16a34a' },
    { id:'breakout',  name:'Casse Briques',      icon:'🧱', desc:'Brise toutes les briques',  diff:'★★☆', route:'/games/breakout', color:'#ea580c' },
    { id:'crossword', name:'Mots Croisés',       icon:'📝', desc:'Trouve les mots IA',        diff:'★★★', route:'/games/crossword', color:'#0891b2' },
    { id:'racing',    name:'Course Voiture',     icon:'🏎️', desc:'Dépasse les rivaux',        diff:'★★☆', route:'/games/racing',   color:'#e11d48' },
    { id:'checkers',  name:'Jeux de Dames',      icon:'♟️', desc:"Bats l'IA aux dames",       diff:'★★☆', route:'/games/checkers', color:'#7c3aed' },
    { id:'puzzle',    name:'Puzzle Coulissant',  icon:'🧩', desc:'Réassemble les tuiles',     diff:'★★☆', route:'/games/puzzle',   color:'#0d9488' },
    { id:'ludo',      name:'Ludo',               icon:'🎲', desc:'Course de pions',            diff:'★☆☆', route:'/games/ludo',    color:'#d97706' },
    { id:'adventure', name:'Mission Sauvetage',  icon:'🗺️', desc:'Aventure isométrique',      diff:'★★★', route:'/games/adventure',color:'#6d28d9' },
    { id:'war',       name:'Tour de Défense',    icon:'⚔️', desc:'Tower defense',              diff:'★★★', route:'/games/war',      color:'#991b1b' },
    { id:'combat',    name:'Combat',             icon:'🥊', desc:'Bats le boss',               diff:'★★★', route:'/games/combat',   color:'#be123c' },
    { id:'wordsearch',name:'Mots Mêlés',         icon:'🔍', desc:'Trouve les mots cachés',     diff:'★★☆', route:'/games/wordsearch',color:'#16a34a' },
    { id:'wordsearch-themed',name:'Mots Mêlés (Thèmes)', icon:'🌍', desc:'Thèmes, niveaux & combos', diff:'★★★', route:'/games/wordsearch-themed',color:'#8b5cf6' },
    { id:'marble',    name:'Marble Crush',       icon:'🎱', desc:'Détruisez les billes !',     diff:'★★★', route:'/games/marble',color:'#ea580c' },
    { id:'penalty', name:'Tirs au but', icon:'🥅', desc:'Séance de penalties 3D contre l\'IA', diff:'★★☆', route:'/games/penalty-shootout', color:'#22c55e' },
    { id:'football', name:'Football Prototype', icon:'⚽', desc:'Terrain 3D + balle + physique', diff:'★★★', route:'/games/football-prototype', color:'#0ea5e9' },
    { id:'football3d', name:'Football 3D', icon:'🏟️', desc:'Match complet 3D avec IA et physique', diff:'★★★', route:'/games/football', color:'#3b82f6' },
  ];

  @ViewChildren('hubCard') private cardRefs!: QueryList<ElementRef<HTMLAnchorElement>>;

  /** Dernière carte connue avec le focus (repli quand rien n'a le focus, ex. souris
   * jamais utilisée) : la première pression flèche focus juste ce point de départ, les
   * suivantes naviguent normalement — pas de vol de focus intrusif au chargement. */
  private lastFocusIndex = 0;

  /** Indicateur visuel de détection manette (même finalité que sur l'écran menu du
   * module football) : un navigateur ne révèle une manette physique via getGamepads()
   * qu'APRÈS un premier appui bouton dessus depuis le chargement de la page — sans
   * repère visuel, "la navigation ne marche pas" est indiscernable d'un vrai bug de
   * navigation. Sondage dédié et minimal, indépendant de GamepadKeyboardBridgeService
   * (qui n'expose aucun état public), juste pour cet affichage. */
  gamepadConnected = false;
  gamepadName = '';
  gamepadAxesDebug = '';
  gamepadButtonsDebug = '';
  private statusFrameId: number | null = null;

  ngOnInit(): void {
    this.pollGamepadStatus();
  }

  ngOnDestroy(): void {
    if (this.statusFrameId !== null) cancelAnimationFrame(this.statusFrameId);
  }

  private pollGamepadStatus(): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const connected = Array.from(pads).filter((p): p is Gamepad => !!p && p.connected);
    this.gamepadConnected = connected.length > 0;
    this.gamepadName = connected[0]?.id ?? '';
    if (connected[0]) {
      this.gamepadAxesDebug = connected[0].axes.map(a => a.toFixed(2)).join(', ');
      this.gamepadButtonsDebug = connected[0].buttons
        .map((b, i) => (b.pressed ? i : null))
        .filter((i): i is number => i !== null)
        .join(', ');
    }
    this.statusFrameId = requestAnimationFrame(() => this.pollGamepadStatus());
  }

  /** Navigation manette/clavier dans la grille de jeux (demande : "parcourir les
   * différents jeux jusqu'à atteindre le jeu de football"). Les flèches synthétiques
   * envoyées par GamepadKeyboardBridgeService (manette -> clavier, désormais actif sur
   * /games lui-même) arrivent ici comme de vrais évènements keydown, indiscernables du
   * clavier physique — aucun code manette dédié nécessaire sur cette page. */
  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const cards = this.cardRefs?.toArray().map(r => r.nativeElement) ?? [];
    if (cards.length === 0) return;

    if (event.key === 'Enter' || event.key === ' ') {
      // Évènement synthétique (bridge manette) : un clic programmatique n'active PAS un
      // <a> nativement comme le ferait une vraie touche Entrée du clavier (les
      // évènements non "trusted" ne déclenchent pas l'action par défaut du navigateur).
      // On simule donc le clic nous-mêmes dans tous les cas (avec preventDefault sur
      // l'évènement réel pour éviter un double déclenchement quand il l'est).
      const active = document.activeElement;
      if (active instanceof HTMLElement && cards.includes(active as HTMLAnchorElement)) {
        event.preventDefault();
        active.click();
      }
      return;
    }

    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();

    const active = document.activeElement as HTMLAnchorElement;
    const fromIndex = cards.indexOf(active);
    if (fromIndex === -1) {
      // Rien n'a le focus (première pression, ou focus sorti de la grille) : on
      // (re)focus juste le point de départ, sans encore se déplacer.
      this.focusCard(cards, this.lastFocusIndex);
      return;
    }

    const nextIndex = this.findNearestInDirection(cards, fromIndex, event.key);
    if (nextIndex !== -1) this.focusCard(cards, nextIndex);
  }

  private focusCard(cards: HTMLAnchorElement[], index: number): void {
    const el = cards[index];
    if (!el) return;
    this.lastFocusIndex = index;
    el.focus();
  }

  /** Plus proche voisin dans la direction pressée, par géométrie réelle (getBoundingClientRect)
   * plutôt qu'un calcul de colonnes fixe — la grille est en `auto-fill`, son nombre de
   * colonnes varie avec la largeur d'écran, donc un calcul "index ± N colonnes" serait faux
   * dès que le nombre de colonnes change. Priorise l'alignement (petit décalage
   * perpendiculaire) tout en avançant dans la bonne direction. */
  private findNearestInDirection(cards: HTMLAnchorElement[], fromIndex: number, key: string): number {
    const fromRect = cards[fromIndex].getBoundingClientRect();
    const fromCenter = { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 };

    let best = -1;
    let bestScore = Infinity;

    cards.forEach((el, i) => {
      if (i === fromIndex) return;
      const r = el.getBoundingClientRect();
      const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const dx = center.x - fromCenter.x;
      const dy = center.y - fromCenter.y;

      let primary: number;
      let secondary: number;
      switch (key) {
        case 'ArrowRight': if (dx <= 1) return; primary = dx; secondary = Math.abs(dy); break;
        case 'ArrowLeft': if (dx >= -1) return; primary = -dx; secondary = Math.abs(dy); break;
        case 'ArrowDown': if (dy <= 1) return; primary = dy; secondary = Math.abs(dx); break;
        case 'ArrowUp': if (dy >= -1) return; primary = -dy; secondary = Math.abs(dx); break;
        default: return;
      }

      const score = primary + secondary * 3;
      if (score < bestScore) { bestScore = score; best = i; }
    });

    return best;
  }
}
