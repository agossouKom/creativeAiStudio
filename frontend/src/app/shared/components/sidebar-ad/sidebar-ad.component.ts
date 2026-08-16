import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService, Advertisement } from '../../../services/mock-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar-ad',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    :host { display: block; }

    .sidebar-ad-wrap { display: flex; flex-direction: column; gap: .875rem; padding: .5rem; }

    .ad-label { font-size: .65rem; font-weight: 800; text-transform: uppercase;
                letter-spacing: .06em; color: #cbd5e1; text-align: center;
                padding: .25rem 0; border-bottom: 1px solid #f1f5f9; margin-bottom: .25rem; }

    .ad-card { background: var(--card-bg); border-radius: 12px; overflow: hidden;
               border: 1.5px solid var(--border); box-shadow: 0 2px 8px var(--shadow);
               transition: all .2s; }
    .ad-card:hover { box-shadow: 0 4px 16px var(--shadow); border-color: var(--text-3); }

    .ad-img { width: 100%; height: 90px; object-fit: cover;
              background: linear-gradient(135deg, var(--surface), var(--border)); display: block; }

    .ad-body { padding: .625rem; }
    .ad-sponsor { font-size: .6rem; font-weight: 700; text-transform: uppercase;
                  letter-spacing: .05em; color: #94a3b8; }
    .ad-text { font-size: .72rem; font-weight: 600; color: var(--text-2); margin-top: .15rem;
               line-height: 1.35; }
    .ad-cta { display: inline-block; margin-top: .5rem; font-size: .68rem; font-weight: 800;
              color: #6366f1; text-decoration: none; }
    .ad-cta:hover { text-decoration: underline; }

    /* Placeholder quand pas de pub */
    .ad-placeholder { border: 2px dashed var(--border); border-radius: 12px; padding: 1.5rem .5rem;
                      text-align: center; }
    .ad-ph-label { font-size: .65rem; color: #cbd5e1; font-weight: 700;
                   text-transform: uppercase; letter-spacing: .05em; }
    .ad-ph-sub   { font-size: .68rem; color: #e2e8f0; margin-top: .25rem; }

    .ad-promo { background: linear-gradient(135deg, #f5f3ff, #ede9fe); border-radius: 12px;
                padding: 1rem .75rem; border: 1.5px solid #ddd6fe; text-align: center; }
    .ad-promo-icon { font-size: 1.5rem; margin-bottom: .375rem; }
    .ad-promo-title { font-size: .8rem; font-weight: 800; color: #5b21b6; margin-bottom: .25rem; }
    .ad-promo-sub   { font-size: .7rem; color: #7c3aed; line-height: 1.4; }
    .ad-promo-btn   { display: inline-block; margin-top: .625rem; padding: .35rem .875rem;
                      background: #6366f1; color: white; border-radius: 8px;
                      font-size: .72rem; font-weight: 800; text-decoration: none; transition: background .2s; }
    .ad-promo-btn:hover { background: #4f46e5; }

    /* ── Dark mode ── */
    :host-context(html[data-theme="dark"]) .ad-label { color: #334155; border-bottom-color: rgba(255,255,255,.04); }
    :host-context(html[data-theme="dark"]) .ad-card { background: #1e293b; border-color: rgba(255,255,255,.06); box-shadow: none; }
    :host-context(html[data-theme="dark"]) .ad-card:hover { border-color: rgba(255,255,255,.1); box-shadow: 0 4px 16px rgba(0,0,0,.25); }
    :host-context(html[data-theme="dark"]) .ad-img { background: linear-gradient(135deg, #1e293b, #334155); }
    :host-context(html[data-theme="dark"]) .ad-sponsor { color: #334155; }
    :host-context(html[data-theme="dark"]) .ad-text { color: #64748b; }
    :host-context(html[data-theme="dark"]) .ad-placeholder { border-color: rgba(255,255,255,.05); }
    :host-context(html[data-theme="dark"]) .ad-ph-label { color: #1e293b; }
    :host-context(html[data-theme="dark"]) .ad-ph-sub { color: #1e293b; }
    :host-context(html[data-theme="dark"]) .ad-promo { background: rgba(30,27,75,.45); border-color: rgba(109,40,217,.25); }
    :host-context(html[data-theme="dark"]) .ad-promo-title { color: #a78bfa; }
    :host-context(html[data-theme="dark"]) .ad-promo-sub   { color: #7c3aed; }
  `],
  template: `
    <div class="sidebar-ad-wrap">
      <div class="ad-label">Annonces</div>

      <!-- Pub Creative AI Studio Premium -->
      <div class="ad-promo">
        <div class="ad-promo-icon">⚡</div>
        <p class="ad-promo-title">Creative AI Studio Premium</p>
        <p class="ad-promo-sub">Traitement illimité, sans publicité, API incluse.</p>
        <a href="/pricing" class="ad-promo-btn">Voir les offres</a>
      </div>

      <!-- Pubs dynamiques -->
      <ng-container *ngFor="let ad of ads">
        <a [href]="ad.targetUrl" target="_blank" class="ad-card" style="text-decoration:none">
          <img [src]="ad.imageUrl" alt="Publicité partenaire" class="ad-img"
               onerror="this.style.display='none'">
          <div class="ad-body">
            <p class="ad-sponsor">Annonce partenaire</p>
            <p class="ad-text">Découvrez nos offres exclusives</p>
            <span class="ad-cta">En savoir plus →</span>
          </div>
        </a>
      </ng-container>

      <!-- Placeholder si pas de pubs -->
      <div *ngIf="ads.length === 0" class="ad-placeholder">
        <p class="ad-ph-label">Espace publicitaire</p>
        <p class="ad-ph-sub">160 × 240</p>
      </div>
    </div>
  `
})
export class SidebarAdComponent implements OnInit, OnDestroy {
  @Input() side: 'left' | 'right' = 'right';
  ads: Advertisement[] = [];
  private sub: Subscription | null = null;

  constructor(private mockData: MockDataService) {}

  ngOnInit() {
    this.sub = this.mockData.ads$.subscribe((all: Advertisement[]) => {
      const active = all.filter(a => a.active);
      // Afficher max 2 pubs par sidebar, décalé selon le côté
      this.ads = this.side === 'left' ? active.slice(0, 1) : active.slice(1, 3);
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }
}
