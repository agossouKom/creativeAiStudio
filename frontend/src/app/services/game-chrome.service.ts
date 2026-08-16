import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Permet à une page de jeu plein écran (ex: le foot) de demander au layout
 * global (AppComponent) de masquer l'en-tête du site pour gagner en espace,
 * sans que ces deux composants n'aient de dépendance directe entre eux.
 */
@Injectable({ providedIn: 'root' })
export class GameChromeService {
  private readonly hidden$ = new BehaviorSubject<boolean>(false);
  readonly headerHidden$ = this.hidden$.asObservable();

  hideHeader(): void {
    this.hidden$.next(true);
  }

  showHeader(): void {
    this.hidden$.next(false);
  }
}
