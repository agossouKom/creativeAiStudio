import { Injectable, signal } from '@angular/core';

/** Côté où la bulle s'ouvre par rapport à l'élément survolé. */
export type TipSide = 'right' | 'left' | 'bottom' | 'top';

export interface TipState {
  /** Incrémenté à chaque affichage : force l'hôte à recalculer sa position. */
  seq: number;
  text: string;
  /** Point d'ancrage en coordonnées viewport (px), avant alignement. */
  x: number;
  y: number;
  side: TipSide;
}

/**
 * Un seul tooltip actif à la fois : les sidebars sont des listes denses, deux
 * bulles simultanées se recouvrent et become illisibles.
 */
@Injectable({ providedIn: 'root' })
export class TooltipService {
  readonly tip = signal<TipState | null>(null);

  private seq = 0;

  show(text: string, x: number, y: number, side: TipSide): void {
    this.tip.set({ seq: ++this.seq, text, x, y, side });
  }

  hide(): void {
    this.tip.set(null);
  }
}
