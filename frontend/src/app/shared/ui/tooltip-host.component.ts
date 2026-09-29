import {
  AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipService } from './tooltip.service';

/**
 * Bulle unique, montée hors du flux des pages (`position: fixed`) pour échapper
 * aux `overflow: auto` des sidebars. Le style vit dans styles.css (bloc
 * « TOOLTIP GLOBAL ») — ici on ne fait que la position et le recalcul quand la
 * bulle déborde de la fenêtre.
 */
@Component({
  selector: 'app-tooltip-host',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (svc.tip(); as t) {
      <div #bubble class="tip-bubble tip-bubble--{{ t.side }}"
           [style.left.px]="t.x" [style.top.px]="t.y" role="tooltip">{{ t.text }}</div>
    }
  `
})
export class TooltipHostComponent implements AfterViewChecked {
  readonly svc = inject(TooltipService);

  @ViewChild('bubble') bubble?: ElementRef<HTMLElement>;

  /** Séquence déjà recalée : évite de re-mesurer à chaque change detection. */
  private lastSeq = 0;

  ngAfterViewChecked(): void {
    const t = this.svc.tip();
    if (!t || !this.bubble || t.seq === this.lastSeq) return;
    this.lastSeq = t.seq;
    this.keepOnScreen();
  }

  /**
   * Repositionne si la bulle dépasse la fenêtre. Le décalage se fait en
   * modifiant l'ancre, pas via un transform concurrent, pour ne pas fighting
   * avec le translate d'alignement du CSS.
   */
  private keepOnScreen(): void {
    const el = this.bubble!.nativeElement;
    const t = this.svc.tip()!;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const box = el.getBoundingClientRect();
    let { x, y } = t;

    if (t.side === 'right' && x + box.width > vw - pad) x = Math.max(pad, t.x - box.width - 20);
    if (t.side === 'left'  && x - box.width < pad)     x = Math.min(vw - pad, t.x + box.width + 20);
    if (t.side === 'bottom' && y + box.height > vh - pad) y = Math.max(pad, t.y - box.height - 20);
    if (t.side === 'top'   && y - box.height < pad)      y = Math.min(vh - pad, t.y + box.height + 20);

    // Un écran plus étroit que la bulle : on la colle au bord plutôt que de
    // la laisser sortir.
    if (box.width + pad * 2 > vw) x = vw / 2;
    if (box.height + pad * 2 > vh) y = vh / 2;

    if (x !== t.x || y !== t.y) this.svc.show(t.text, x, y, t.side);
  }
}
