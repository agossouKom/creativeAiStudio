import { Injectable } from '@angular/core';

/**
 * Traduit les entrées d'une manette USB standard (Gamepad API) en évènements
 * clavier synthétiques (keydown/keyup sur `window`), pour que les mini-jeux de
 * la galerie — tous pilotés au clavier via @HostListener('window:keydown'...)
 * — répondent à la manette sans modification individuelle de chaque jeu.
 *
 * Actif uniquement sur les routes /games/* (hors le vrai module foot
 * `/games/football`, qui a déjà son propre support manette analogique natif
 * via `pollGamepad()` dans football.component.ts — un pont ici ferait double
 * emploi et risquerait de désynchroniser les deux mécanismes d'entrée).
 *
 * Un bouton peut être traduit vers plusieurs touches (ex: bouton A -> Espace
 * pour la plupart des jeux ET 'z' pour le jeu de combat, qui utilise des
 * touches dédiées par action) : chaque jeu ignore simplement celles qu'il ne
 * lit pas, donc aucun risque de conflit à couvrir large.
 */
@Injectable({ providedIn: 'root' })
export class GamepadKeyboardBridgeService {
  private rafId = 0;
  private readonly heldKeys = new Set<string>();
  private readonly deadzone = 0.35;

  private readonly buttonKeys: Record<number, string[]> = {
    0: [' ', 'z'],       // A / Croix : action principale (saut, tir, hard-drop, confirmer...) + coup de poing (combat)
    1: ['Enter', 'x'],   // B / Rond : confirmer/rejouer + coup de pied (combat)
    2: ['c'],            // X / Carré : boule de feu (combat)
    3: ['a'],            // Y / Triangle : garde (combat)
    9: ['Enter'],        // Start : confirmer/rejouer
    12: ['ArrowUp'],
    13: ['ArrowDown'],
    14: ['ArrowLeft'],
    15: ['ArrowRight'],
  };

  constructor() {
    this.loop();
  }

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);

    if (!this.isBridgeRoute()) {
      this.releaseAll();
      return;
    }

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    // Bug corrigé : ne lire QUE l'emplacement [0] échouait silencieusement sur les
    // adaptateurs "Dual/Twin" (2 manettes en un seul périphérique USB, ex: le
    // "Twin USB Gamepad" 0810:0001 identifié en diagnostic) — ce type de matériel
    // enregistre DEUX emplacements manette (un par port physique), et selon l'ordre
    // d'énumération, la manette réellement branchée peut se retrouver en [1] plutôt
    // qu'en [0] (le [0] restant un port fantôme avec des valeurs bruitées figées).
    // On parcourt donc TOUS les emplacements et on fusionne leurs entrées voulues —
    // sans effet pour une manette simple (un seul emplacement rempli, le reste null).
    const connectedPads = Array.from(pads).filter((p): p is Gamepad => !!p && p.connected);
    if (connectedPads.length === 0) {
      this.releaseAll();
      return;
    }

    const wanted = new Set<string>();

    connectedPads.forEach((pad) => {
      // Stick gauche (axes 0/1, mapping "standard") ET croix directionnelle. Sur
      // les manettes à mapping "n/a" (ex: vieux adaptateurs PSX->USB génériques,
      // relevé empiriquement sur un modèle "Twin USB Gamepad" 0810:0001), la croix
      // n'est PAS exposée comme des boutons 12-15 mais comme deux axes SUPPLÉMENTAIRES
      // (axes 4/5) — on lit donc les deux paires d'axes en plus des boutons 12-15,
      // ça ne coûte rien pour les manettes qui n'ont pas d'axes 4/5 (undefined -> 0).
      const dirAxisPairs: Array<[number, number]> = [[0, 1], [4, 5]];
      dirAxisPairs.forEach(([xIdx, yIdx]) => {
        const ax = pad.axes[xIdx] ?? 0;
        const ay = pad.axes[yIdx] ?? 0;
        if (ax < -this.deadzone) wanted.add('ArrowLeft');
        if (ax > this.deadzone) wanted.add('ArrowRight');
        if (ay < -this.deadzone) wanted.add('ArrowUp');
        if (ay > this.deadzone) wanted.add('ArrowDown');
      });

      pad.buttons.forEach((btn, i) => {
        if (btn.pressed && this.buttonKeys[i]) {
          this.buttonKeys[i].forEach((key) => wanted.add(key));
        }
      });
    });

    // Appuis : touches désormais voulues mais pas encore tenues
    wanted.forEach((key) => {
      if (!this.heldKeys.has(key)) {
        this.dispatch('keydown', key);
        this.heldKeys.add(key);
        // Bouton "confirmer" (B/Start -> Enter) : clique directement le bouton
        // d'action principal de l'écran (Rejouer/Démarrer/Continuer...) si un
        // seul est visible. Presque tous les mini-jeux de la galerie partagent
        // la classe `.gp-btn` pour ce bouton unique — aucun n'a de vraie
        // navigation au clavier entre plusieurs boutons, donc cibler celui-ci
        // directement couvre le cas d'usage réel ("le bouton Rejouer ne
        // répond pas à la manette") sans navigation par focus à construire.
        if (key === 'Enter') this.tryClickPrimaryButton();
      }
    });
    // Relâchements : touches tenues mais plus voulues
    Array.from(this.heldKeys).forEach((key) => {
      if (!wanted.has(key)) {
        this.dispatch('keyup', key);
        this.heldKeys.delete(key);
      }
    });
  };

  private isBridgeRoute(): boolean {
    const path = window.location.pathname;
    // "/games" (la galerie elle-même, sans sous-segment) était exclue par erreur : seul
    // `startsWith('/games/')` était vérifié, qui ne matche jamais le chemin exact
    // "/games" — la galerie ne recevait donc jamais les flèches/Entrée synthétiques.
    return (path === '/games' || path.startsWith('/games/')) && path !== '/games/football';
  }

  private releaseAll(): void {
    this.heldKeys.forEach((key) => this.dispatch('keyup', key));
    this.heldKeys.clear();
  }

  private dispatch(type: 'keydown' | 'keyup', key: string): void {
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
  }

  private tryClickPrimaryButton(): void {
    const btn = document.querySelector<HTMLElement>('.gp-btn');
    if (btn && (btn.offsetWidth || btn.offsetHeight || btn.getClientRects().length)) {
      btn.click();
    }
  }
}
