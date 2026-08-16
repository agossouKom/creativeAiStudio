import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MockDataService, Advertisement } from '../../../services/mock-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ads',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="currentAd && visible" class="ad-container animate-fade">
      <div class="ad-card">
        <div class="ad-header">
          <span class="ad-title">Annonce Partenaire</span>
          <button (click)="close()" class="ad-close">×</button>
        </div>
        <a [href]="currentAd.targetUrl" target="_blank" class="ad-link">
          <img [src]="currentAd.imageUrl" alt="Publicité" class="ad-img">
          <div class="ad-content">
            <p class="ad-text">Découvrez nos offres partenaires</p>
          </div>
        </a>
      </div>
    </div>
  `,
  styles: [`
    .ad-container {
      width: 100%;
      max-width: 320px;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 100;
    }
    .ad-card {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      border: 1px solid #e2e8f0;
    }
    .ad-header {
      padding: 6px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .ad-title {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .ad-close {
      border: none;
      background: none;
      color: #94a3b8;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
    }
    .ad-close:hover { color: #0f172a; }
    .ad-link { text-decoration: none; display: block; }
    .ad-img { width: 100%; height: 160px; object-fit: cover; }
    .ad-content { padding: 12px; background: white; }
    .ad-text { font-size: 12px; font-weight: 700; color: #1e3a8a; }
  `]
})
export class AdsComponent implements OnInit, OnDestroy {
  currentAd: Advertisement | null = null;
  visible = true;
  private sub: Subscription | null = null;

  constructor(private mockData: MockDataService) {}

  ngOnInit() {
    this.sub = this.mockData.ads$.subscribe((ads: Advertisement[]) => {
      const activeAds = ads.filter((a: Advertisement) => a.active);
      if (activeAds.length > 0) {
        this.currentAd = activeAds[Math.floor(Math.random() * activeAds.length)];
      } else {
        this.currentAd = null;
      }
    });
  }

  close() { this.visible = false; }

  ngOnDestroy() { if (this.sub) this.sub.unsubscribe(); }
}
