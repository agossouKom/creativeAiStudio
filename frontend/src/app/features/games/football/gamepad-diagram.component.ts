import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Schéma visuel d'une manette générique (croix directionnelle, stick gauche/droit,
 * boutons "1/2/3/4" en losange, L1/R1) avec le bouton concerné mis en surbrillance —
 * demandé explicitement par l'utilisateur ("je ne vois pas la manette à l'écran") après
 * le remappage manette (cf. PLAN.md Phase 10) : le texte seul ("Bouton 2") ne suffisait
 * pas, il fallait un dessin de la manette avec les boutons étiquetés selon leur action.
 */
@Component({
  selector: 'app-gamepad-diagram',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg viewBox="0 0 280 200" class="gamepad-svg" [attr.aria-label]="'Schéma manette'">
      <rect x="20" y="55" width="240" height="115" rx="45" class="pad-body" />

      <rect x="28" y="18" width="60" height="24" rx="6" class="pad-shoulder" [class.pad-active]="highlight === 'l1'" />
      <text x="58" y="34" class="pad-label">L1</text>

      <rect x="192" y="18" width="60" height="24" rx="6" class="pad-shoulder" [class.pad-active]="highlight === 'r1'" />
      <text x="222" y="34" class="pad-label">R1</text>

      <g [class.pad-active]="highlight === 'dpad'">
        <rect x="60" y="80" width="16" height="42" rx="3" class="pad-dpad" />
        <rect x="41" y="99" width="42" height="16" rx="3" class="pad-dpad" />
      </g>

      <circle cx="68" cy="148" r="17" class="pad-stick" [class.pad-active]="highlight === 'dpad'" />
      <circle cx="196" cy="148" r="17" class="pad-stick" />

      <rect x="118" y="88" width="18" height="10" rx="3" class="pad-mini" />
      <text x="127" y="96" class="pad-mini-label">SEL</text>
      <rect x="142" y="88" width="20" height="10" rx="3" class="pad-mini" />
      <text x="152" y="96" class="pad-mini-label">STA</text>

      <circle cx="196" cy="76" r="13" class="pad-btn" [class.pad-active]="highlight === 'btn1'" />
      <text x="196" y="80" class="pad-btn-label">1</text>

      <circle cx="219" cy="99" r="13" class="pad-btn" [class.pad-active]="highlight === 'btn2'" />
      <text x="219" y="103" class="pad-btn-label">2</text>

      <circle cx="196" cy="122" r="13" class="pad-btn" [class.pad-active]="highlight === 'btn3'" />
      <text x="196" y="126" class="pad-btn-label">3</text>

      <circle cx="173" cy="99" r="13" class="pad-btn" [class.pad-active]="highlight === 'btn4'" />
      <text x="173" y="103" class="pad-btn-label">4</text>
    </svg>
  `,
  styles: [`
    :host { display: block; }
    .gamepad-svg { width: 100%; max-width: 220px; height: auto; display: block; margin: 0 auto; }
    .pad-body { fill: #1a1f2e; stroke: rgba(255,255,255,0.15); stroke-width: 2; }
    .pad-shoulder { fill: #2a3050; stroke: rgba(255,255,255,0.15); stroke-width: 1.5; transition: fill 0.2s, stroke 0.2s; }
    .pad-dpad { fill: #2a3050; }
    .pad-stick { fill: #2a3050; stroke: rgba(255,255,255,0.15); stroke-width: 1.5; transition: fill 0.2s, stroke 0.2s; }
    .pad-mini { fill: #232840; }
    .pad-mini-label { font-size: 6px; fill: #5a6280; text-anchor: middle; }
    .pad-btn { fill: #2a3050; stroke: rgba(255,255,255,0.2); stroke-width: 1.5; transition: fill 0.2s, stroke 0.2s; }
    .pad-btn-label { font-size: 11px; font-weight: 700; fill: #ccd6f6; text-anchor: middle; pointer-events: none; }
    .pad-label { font-size: 9px; font-weight: 700; fill: #8892b0; text-anchor: middle; pointer-events: none; }
    .pad-active.pad-btn, .pad-active.pad-shoulder, .pad-active.pad-stick { fill: #4CAF50; stroke: #81C784; }
    .pad-active .pad-dpad { fill: #4CAF50; }
    g.pad-active .pad-dpad { fill: #4CAF50; }
  `],
})
export class GamepadDiagramComponent {
  /** 'dpad' | 'l1' | 'r1' | 'btn1' | 'btn2' | 'btn3' | 'btn4' | null (rien en surbrillance) */
  @Input() highlight: string | null = null;
}
