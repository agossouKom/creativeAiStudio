import {
  Directive, ElementRef, HostListener, Input, OnDestroy, inject
} from '@angular/core';
import { TooltipService, TipSide } from './tooltip.service';

/**
 * Tooltip global — affiche une description de la fonctionnalité d'un élément.
 *
 *   <button [tip]="op.name + '\n' + op.desc" tipSide="right">…</button>
 *
 * Pourquoi une directive et pas un `::after` en CSS global : les sidebars
 * vivent dans des conteneurs `overflow-y: auto` (ex. `.ops-sidebar` de
 * DocFusion). Un pseudo-élément positionné en absolu y serait ROGNÉ par le
 * conteneur — le tooltip serait à moitié coupé. En passant par un nœud unique
 * monté dans un overlay `position: fixed`, rien ne peut le tronquer, quel que
 * soit le `overflow` de l'ancêtre.
 *
 * `tipSide` : right (défaut, barres de gauche) | left (barres de droite)
 *             | bottom (barres d'onglets, en-tête) | top.
 */
@Directive({
  selector: '[tip]',
  standalone: true
})
export class TipDirective implements OnDestroy {
  /** Texte affiché. Un `\n` sépare la 1re ligne (titre) des suivantes. */
  @Input() tip = '';

  @Input() tipSide: TipSide = 'right';

  /** Délai avant apparition : évite les tooltips qui clignotent en survol rapide. */
  @Input() tipDelay = 260;

  /** Écart entre l'élément et la bulle, en px. */
  @Input() tipGap = 10;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly svc = inject(TooltipService);
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    this.cancel();
  }

  @HostListener('mouseenter')
  onEnter(): void {
    if (!this.tip) return;
    this.cancel();
    this.timer = setTimeout(() => this.paint(), this.tipDelay);
  }

  @HostListener('mouseleave')
  onLeave(): void {
    this.cancel();
  }

  /** Navigation clavier : un élément focusable doit aussi être explicable. */
  @HostListener('focus')
  onFocus(): void {
    if (!this.tip) return;
    this.cancel();
    this.timer = setTimeout(() => this.paint(), 0);
  }

  @HostListener('blur')
  onBlur(): void {
    this.cancel();
  }

  /** Un clic valide l'action : on ne laisse pas la bulle sous le curseur. */
  @HostListener('click')
  onClick(): void {
    this.cancel();
  }

  @HostListener('keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  private cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.svc.hide();
  }

  private paint(): void {
    const host: HTMLElement = this.el.nativeElement;
    // L'élément a pu être détaché (ngIf, onglet changé) entre le survol et le timer.
    if (!host.isConnected) return;

    const r = host.getBoundingClientRect();
    const gap = this.tipGap;
    let x: number;
    let y: number;

    switch (this.tipSide) {
      case 'left':   x = r.left - gap;  y = r.top + r.height / 2; break;
      case 'bottom': x = r.left + r.width / 2; y = r.bottom + gap; break;
      case 'top':    x = r.left + r.width / 2; y = r.top - gap;  break;
      default:       x = r.right + gap; y = r.top + r.height / 2;
    }

    this.svc.show(this.tip, x, y, this.tipSide);
  }
}
