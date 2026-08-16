import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchService } from '../../services/search.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host { display: block; }

    .hist-page { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }

    /* Header */
    .hist-header { margin-bottom: 2rem; }
    .hist-title  { font-family: 'Outfit', sans-serif; font-size: 1.75rem; font-weight: 800;
                   color: var(--text); margin-bottom: .35rem; letter-spacing: -.5px; }
    .hist-sub    { color: var(--text-2); font-size: .875rem; }

    /* Filter Bar */
    .filter-section { background: var(--card-bg); border: 1.5px solid var(--border); border-radius: 16px;
                      padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
                      box-shadow: 0 1px 4px rgba(0,0,0,.04); }
    .filter-row  { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
    .filter-row + .filter-row { margin-top: .875rem; padding-top: .875rem; border-top: 1px solid var(--border); }
    .filter-label { font-size: .72rem; font-weight: 800; color: #94a3b8;
                    text-transform: uppercase; letter-spacing: .06em; min-width: 60px; flex-shrink: 0; }
    .filter-sep  { width: 1px; height: 24px; background: var(--border); margin: 0 .25rem; }
    .chip { border: 1.5px solid var(--border); background: var(--card-bg); color: var(--text-2);
            font-size: .75rem; font-weight: 600; padding: .3rem .75rem;
            border-radius: 999px; cursor: pointer; transition: all .2s; white-space: nowrap; }
    .chip:hover { border-color: #6366f1; color: #6366f1; }
    .chip.active { background: #6366f1; border-color: #6366f1; color: white;
                   box-shadow: 0 2px 8px rgba(99,102,241,.3); }

    /* Date inputs */
    .date-wrap { display: flex; align-items: center; gap: .625rem; flex-wrap: wrap; }
    .date-input { border: 1.5px solid var(--border); border-radius: 9px; padding: .375rem .75rem;
                  font-size: .8rem; color: var(--text-2); outline: none;
                  transition: border-color .2s; background: var(--card-bg); font-family: 'Inter', sans-serif; }
    .date-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.08); }
    .date-sep { font-size: .75rem; color: #94a3b8; font-weight: 600; }
    .btn-clear-date { border: 1.5px solid var(--border); background: var(--card-bg); color: #94a3b8;
                      font-size: .72rem; font-weight: 700; padding: .3rem .75rem;
                      border-radius: 8px; cursor: pointer; transition: all .2s; }
    .btn-clear-date:hover { border-color: #ef4444; color: #ef4444; }
    .btn-clear-all  { border: 1.5px solid #fca5a5; background: #fef2f2; color: #ef4444;
                      font-size: .72rem; font-weight: 700; padding: .3rem .875rem;
                      border-radius: 8px; cursor: pointer; transition: all .2s; }
    .btn-clear-all:hover { background: #fee2e2; }
    .card-op-tag { display: inline-block; font-size: .6rem; font-weight: 700; text-transform: uppercase;
                   letter-spacing: .05em; padding: .15rem .45rem; border-radius: 6px;
                   background: var(--surface); color: var(--text-2); margin-top: .2rem; }

    /* Stats bar */
    .stats-row { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .stat-card { background: var(--card-bg); border: 1.5px solid var(--border); border-radius: 12px;
                 padding: .625rem 1rem; display: flex; align-items: center; gap: .625rem; }
    .stat-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .stat-dot.green  { background: #22c55e; }
    .stat-dot.red    { background: #ef4444; }
    .stat-dot.amber  { background: #f59e0b; }
    .stat-dot.slate  { background: #94a3b8; }
    .stat-val  { font-size: .9rem; font-weight: 800; color: var(--text); }
    .stat-lbl  { font-size: .72rem; color: #94a3b8; font-weight: 500; }

    /* Grid */
    .hist-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }

    /* Card */
    .hist-card { background: var(--card-bg); border: 1.5px solid var(--border); border-radius: 14px;
                 overflow: hidden; transition: all .22s cubic-bezier(.4,0,.2,1);
                 box-shadow: 0 1px 3px rgba(0,0,0,.05); }
    .hist-card:hover { border-color: #e2e8f0; box-shadow: 0 4px 16px rgba(0,0,0,.08); transform: translateY(-1px); }

    .card-thumb { height: 52px; display: flex; align-items: center; justify-content: space-between;
                  padding: .5rem 1rem; }
    .card-thumb.audio  { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); }
    .card-thumb.video  { background: linear-gradient(135deg, #1e3a1e 0%, #14532d 100%); }
    .card-thumb.image  { background: linear-gradient(135deg, #1e1b4b 0%, #4c1d95 100%); }
    .card-thumb.doc    { background: linear-gradient(135deg, #172554 0%, #1e3a8a 100%); }
    .card-thumb.default{ background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); }

    .card-icon { font-size: 1.5rem; }
    .card-badge { font-size: .65rem; font-weight: 800; text-transform: uppercase;
                  padding: .2rem .55rem; border-radius: 999px; letter-spacing: .04em; }
    .card-badge.done    { background: rgba(34,197,94,.2);  color: #86efac; }
    .card-badge.failed  { background: rgba(239,68,68,.2);  color: #fca5a5; }
    .card-badge.proc    { background: rgba(245,158,11,.2); color: #fde68a; }

    .card-body  { padding: .75rem 1rem; }
    .card-name  { font-weight: 700; font-size: .82rem; color: var(--text);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-meta  { display: flex; justify-content: space-between; align-items: center;
                  margin: .3rem 0 .625rem; }
    .card-query { font-size: .72rem; color: var(--text-2);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
    .card-date  { font-size: .65rem; color: #94a3b8; font-weight: 600; flex-shrink: 0; }
    .card-btn   { width: 100%; padding: .45rem; border-radius: 8px; border: none; cursor: pointer;
                  font-size: .75rem; font-weight: 700; transition: all .18s; }
    .card-btn.view { background: var(--surface); color: #3b82f6; }
    .card-btn.view:hover { background: #dbeafe; }
    .card-btn.disabled { background: var(--bg-2); color: #cbd5e1; cursor: not-allowed; }

    /* ── Modal ── */
    .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.7);
                     backdrop-filter: blur(6px); display: flex; align-items: center;
                     justify-content: center; padding: 1rem; z-index: 1000; }
    .modal { background: var(--card-bg); border-radius: 20px; width: 100%; max-width: 580px;
             max-height: 90vh; overflow-y: auto; padding: 1.75rem;
             box-shadow: 0 24px 64px rgba(0,0,0,.3); position: relative; }
    .modal-close { position: absolute; top: 1rem; right: 1rem; border: none; background: var(--surface);
                   width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
                   display: flex; align-items: center; justify-content: center;
                   font-size: 1rem; color: var(--text-2); transition: all .2s; }
    .modal-close:hover { background: #e2e8f0; color: var(--text); }

    /* Modal header */
    .modal-header { display: flex; align-items: flex-start; gap: .875rem; margin-bottom: 1.25rem;
                    padding-bottom: 1.25rem; border-bottom: 1.5px solid var(--border); }
    .modal-icon-wrap { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
                       display: flex; align-items: center; justify-content: center; font-size: 1.4rem; }
    .modal-icon-wrap.audio  { background: linear-gradient(135deg, #312e81, #4f46e5); }
    .modal-icon-wrap.video  { background: linear-gradient(135deg, #14532d, #16a34a); }
    .modal-icon-wrap.image  { background: linear-gradient(135deg, #4c1d95, #7c3aed); }
    .modal-icon-wrap.doc    { background: linear-gradient(135deg, #1e3a8a, #2563eb); }
    .modal-icon-wrap.default{ background: #1e293b; }
    .modal-title { font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 800;
                   color: var(--text); margin-bottom: .2rem; padding-right: 2rem; }
    .modal-id    { font-size: .68rem; color: #94a3b8; font-family: monospace; }

    /* Modal sections */
    .modal-section { margin-bottom: 1rem; }
    .modal-section-title { font-size: .72rem; font-weight: 800; text-transform: uppercase;
                           letter-spacing: .06em; color: #94a3b8; margin-bottom: .625rem; }
    .modal-kv { display: flex; flex-direction: column; gap: .4rem; }
    .kv-row { display: flex; align-items: flex-start; gap: .625rem;
              padding: .5rem .75rem; background: var(--bg-2); border-radius: 8px; border: 1px solid var(--border); }
    .kv-key { font-size: .72rem; font-weight: 700; color: var(--text-2); min-width: 120px; flex-shrink: 0; }
    .kv-val { font-size: .78rem; color: var(--text); font-weight: 500; word-break: break-word; }
    .kv-val.mono { font-family: monospace; font-size: .68rem; color: var(--text-2); }
    .kv-val.green { color: #16a34a; font-weight: 700; }
    .kv-val.red   { color: #dc2626; font-weight: 700; }
    .kv-val.amber { color: #d97706; font-weight: 700; }

    /* Match card (audio/video) */
    .match-card { background: var(--bg-2); border: 1.5px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: .5rem; }
    .match-cover { width: 100%; height: 80px; object-fit: cover; display: block; }
    .match-cover-placeholder { width: 100%; height: 60px; background: linear-gradient(135deg, #1e293b, #334155);
                               display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
    .match-info { padding: .625rem .875rem; }
    .match-title { font-size: .82rem; font-weight: 700; color: var(--text); margin-bottom: .2rem; }
    .match-meta  { display: flex; gap: .75rem; flex-wrap: wrap; }
    .match-tag   { font-size: .68rem; color: var(--text-2); background: var(--surface); padding: .15rem .45rem; border-radius: 5px; font-weight: 600; }
    .match-score { font-size: .68rem; font-weight: 800; color: #6366f1; background: #f5f3ff; padding: .15rem .5rem; border-radius: 5px; }

    /* OCR text block */
    .ocr-block { background: var(--bg-2); border: 1.5px solid var(--border); border-radius: 12px; padding: 1rem;
                 font-family: monospace; font-size: .75rem; color: var(--text-2); line-height: 1.7;
                 max-height: 240px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; }

    /* Raw JSON fallback */
    .json-block { background: var(--bg-2); border: 1.5px solid var(--border); border-radius: 12px; padding: 1rem;
                  max-height: 240px; overflow-y: auto; }
    .json-block pre { font-size: .68rem; color: var(--text-2); font-family: monospace;
                      white-space: pre-wrap; word-break: break-all; }

    .modal-footer { display: flex; justify-content: flex-end; gap: .5rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border); }
    .btn-close-modal { padding: .5rem 1.25rem; background: #0f172a; color: white;
                       border: none; border-radius: 10px; font-size: .8rem;
                       font-weight: 700; cursor: pointer; transition: background .2s; }
    .btn-close-modal:hover { background: #1e293b; }

    /* Empty state */
    .empty { text-align: center; padding: 4rem 2rem; background: var(--bg-2);
             border: 2px dashed var(--border); border-radius: 20px; }
    .empty-icon  { font-size: 3rem; margin-bottom: 1rem; }
    .empty-title { font-family: 'Outfit', sans-serif; font-size: 1.1rem; font-weight: 800;
                   color: var(--text-2); margin-bottom: .5rem; }
    .empty-sub   { font-size: .85rem; color: #94a3b8; }

    /* Loader */
    .loader { text-align: center; padding: 5rem 0; }
    .spin { display: inline-block; width: 36px; height: 36px; border-radius: 50%;
            border: 3px solid var(--border); border-top-color: #6366f1; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loader-text { color: var(--text-2); font-size: .85rem; margin-top: .75rem; font-weight: 600; }

    .animate-fade { animation: fadeIn .35s ease-out; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }

    /* ════════════════════════════════════
       MODE SOMBRE
       ════════════════════════════════════ */
    :host-context(html[data-theme="dark"]) .hist-title { color: #f1f5f9; }
    :host-context(html[data-theme="dark"]) .hist-sub   { color: var(--text-2); }

    :host-context(html[data-theme="dark"]) .filter-section {
      background: #1e293b;
      border-color: rgba(255,255,255,.07);
      box-shadow: none;
    }
    :host-context(html[data-theme="dark"]) .filter-row + .filter-row { border-top-color: rgba(255,255,255,.05); }
    :host-context(html[data-theme="dark"]) .filter-sep  { background: rgba(255,255,255,.07); }
    :host-context(html[data-theme="dark"]) .chip {
      background: #0f172a;
      border-color: rgba(255,255,255,.08);
      color: var(--text-2);
    }
    :host-context(html[data-theme="dark"]) .chip:hover { border-color: #6366f1; color: #818cf8; }

    :host-context(html[data-theme="dark"]) .date-input {
      background: #0f172a;
      border-color: rgba(255,255,255,.08);
      color: #e2e8f0;
    }
    :host-context(html[data-theme="dark"]) .date-input:focus { border-color: #6366f1; }
    :host-context(html[data-theme="dark"]) .btn-clear-date {
      background: #0f172a;
      border-color: rgba(255,255,255,.08);
      color: var(--text-2);
    }
    :host-context(html[data-theme="dark"]) .btn-clear-date:hover { border-color: #ef4444; color: #f87171; }
    :host-context(html[data-theme="dark"]) .btn-clear-all  { background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.2); }
    :host-context(html[data-theme="dark"]) .card-op-tag { background: #1e293b; color: var(--text-2); }

    :host-context(html[data-theme="dark"]) .stat-card {
      background: #1e293b;
      border-color: rgba(255,255,255,.07);
    }
    :host-context(html[data-theme="dark"]) .stat-val { color: #e2e8f0; }

    :host-context(html[data-theme="dark"]) .hist-card {
      background: #1e293b;
      border-color: rgba(255,255,255,.06);
      box-shadow: none;
    }
    :host-context(html[data-theme="dark"]) .hist-card:hover {
      border-color: rgba(255,255,255,.12);
      box-shadow: 0 4px 20px rgba(0,0,0,.3);
    }
    :host-context(html[data-theme="dark"]) .card-name  { color: #e2e8f0; }
    :host-context(html[data-theme="dark"]) .card-query { color: var(--text-2); }
    :host-context(html[data-theme="dark"]) .card-btn.view    { background: #334155; color: #93c5fd; }
    :host-context(html[data-theme="dark"]) .card-btn.view:hover { background: #3b4f6b; }
    :host-context(html[data-theme="dark"]) .card-btn.disabled { background: #1e293b; color: #1e293b; }

    :host-context(html[data-theme="dark"]) .modal {
      background: #1e293b;
      box-shadow: 0 24px 64px rgba(0,0,0,.6);
    }
    :host-context(html[data-theme="dark"]) .modal-close  { background: #334155; color: var(--text-2); }
    :host-context(html[data-theme="dark"]) .modal-close:hover { background: #475569; color: #e2e8f0; }
    :host-context(html[data-theme="dark"]) .modal-header { border-bottom-color: rgba(255,255,255,.05); }
    :host-context(html[data-theme="dark"]) .modal-title  { color: #f1f5f9; }
    :host-context(html[data-theme="dark"]) .modal-footer { border-top-color: rgba(255,255,255,.05); }
    :host-context(html[data-theme="dark"]) .btn-close-modal { background: #334155; color: #e2e8f0; }
    :host-context(html[data-theme="dark"]) .btn-close-modal:hover { background: #475569; }

    :host-context(html[data-theme="dark"]) .kv-row {
      background: #0f172a;
      border-color: rgba(255,255,255,.05);
    }
    :host-context(html[data-theme="dark"]) .kv-key { color: var(--text-2); }
    :host-context(html[data-theme="dark"]) .kv-val { color: #e2e8f0; }
    :host-context(html[data-theme="dark"]) .kv-val.mono { color: #94a3b8; }

    :host-context(html[data-theme="dark"]) .match-card { background: #0f172a; border-color: rgba(255,255,255,.07); }
    :host-context(html[data-theme="dark"]) .match-title { color: #e2e8f0; }
    :host-context(html[data-theme="dark"]) .match-tag   { background: #1e293b; color: var(--text-2); }

    :host-context(html[data-theme="dark"]) .ocr-block {
      background: #0f172a;
      border-color: rgba(255,255,255,.07);
      color: #94a3b8;
    }
    :host-context(html[data-theme="dark"]) .json-block { background: #0f172a; border-color: rgba(255,255,255,.07); }
    :host-context(html[data-theme="dark"]) .json-block pre { color: var(--text-2); }

    :host-context(html[data-theme="dark"]) .empty {
      background: #1e293b;
      border-color: rgba(255,255,255,.06);
    }
    :host-context(html[data-theme="dark"]) .empty-title { color: var(--text-2); }
    :host-context(html[data-theme="dark"]) .loader-text { color: var(--text-2); }
    :host-context(html[data-theme="dark"]) .spin { border-color: #1e293b; border-top-color: #6366f1; }
  `],
  template: `
    <div class="hist-page animate-fade">

      <!-- Header -->
      <div class="hist-header">
        <h1 class="hist-title">Historique d'activite</h1>
        <p class="hist-sub">Retrouvez toutes vos analyses et traitements passes.</p>
      </div>

      <!-- Loader -->
      <div *ngIf="loading" class="loader">
        <div class="spin"></div>
        <p class="loader-text">Chargement de l'historique...</p>
      </div>

      <ng-container *ngIf="!loading">

        <!-- Stats bar -->
        <div class="stats-row">
          <div class="stat-card">
            <span class="stat-dot slate"></span>
            <span class="stat-val">{{ filtered.length }}</span>
            <span class="stat-lbl">{{ filtered.length === history.length ? 'Total' : 'Filtrés / ' + history.length }}</span>
          </div>
          <div class="stat-card">
            <span class="stat-dot green"></span>
            <span class="stat-val">{{ countByStatus('DONE') }}</span>
            <span class="stat-lbl">Terminés</span>
          </div>
          <div class="stat-card">
            <span class="stat-dot amber"></span>
            <span class="stat-val">{{ countByStatus('PROCESSING') + countByStatus('PENDING') }}</span>
            <span class="stat-lbl">En cours</span>
          </div>
          <div class="stat-card">
            <span class="stat-dot red"></span>
            <span class="stat-val">{{ countByStatus('FAILED') }}</span>
            <span class="stat-lbl">Échecs</span>
          </div>
        </div>

        <!-- Filtres -->
        <div class="filter-section">

          <!-- Ligne 1 : Statut -->
          <div class="filter-row">
            <span class="filter-label">Statut</span>
            <button class="chip" [class.active]="filterStatus==='all'"        (click)="filterStatus='all'">Tous</button>
            <button class="chip" [class.active]="filterStatus==='DONE'"       (click)="filterStatus='DONE'">✓ Succès</button>
            <button class="chip" [class.active]="filterStatus==='FAILED'"     (click)="filterStatus='FAILED'">✕ Échec</button>
            <button class="chip" [class.active]="filterStatus==='PROCESSING'" (click)="filterStatus='PROCESSING'">⧗ En cours</button>
          </div>

          <!-- Ligne 2 : Catégorie -->
          <div class="filter-row">
            <span class="filter-label">Catégorie</span>
            <button class="chip" [class.active]="filterCat==='all'"    (click)="setCat('all')">Tout</button>
            <button class="chip" [class.active]="filterCat==='AUDIO'"  (click)="setCat('AUDIO')">🎵 Audio</button>
            <button class="chip" [class.active]="filterCat==='VIDEO'"  (click)="setCat('VIDEO')">🎬 Vidéo</button>
            <button class="chip" [class.active]="filterCat==='IMAGE'"  (click)="setCat('IMAGE')">👤 Image</button>
            <button class="chip" [class.active]="filterCat==='DOC'"    (click)="setCat('DOC')">📄 DocFusion</button>
          </div>

          <!-- Ligne 3 : Sous-filtre DocFusion (visible si catégorie DOC) -->
          <div class="filter-row" *ngIf="filterCat==='DOC'">
            <span class="filter-label">Opération</span>
            <button class="chip" [class.active]="filterOp==='all'"           (click)="filterOp='all'">Toutes</button>
            <button class="chip" [class.active]="filterOp==='ocr'"           (click)="filterOp='ocr'">OCR</button>
            <button class="chip" [class.active]="filterOp==='convert-to-pdf'"(click)="filterOp='convert-to-pdf'">→ PDF</button>
            <button class="chip" [class.active]="filterOp==='convert-to-docx'"(click)="filterOp='convert-to-docx'">→ DOCX</button>
            <button class="chip" [class.active]="filterOp==='merge'"         (click)="filterOp='merge'">Fusion</button>
            <button class="chip" [class.active]="filterOp==='split'"         (click)="filterOp='split'">Découpage</button>
            <button class="chip" [class.active]="filterOp==='compress'"      (click)="filterOp='compress'">Compression</button>
            <button class="chip" [class.active]="filterOp==='watermark'"     (click)="filterOp='watermark'">Filigrane</button>
          </div>

          <!-- Plage de dates + effacer tout -->
          <div class="filter-row">
            <span class="filter-label">Période</span>
            <div class="date-wrap">
              <input type="date" class="date-input" [(ngModel)]="filterDateFrom" [max]="filterDateTo || ''">
              <span class="date-sep">au</span>
              <input type="date" class="date-input" [(ngModel)]="filterDateTo" [min]="filterDateFrom || ''">
              <button *ngIf="filterDateFrom || filterDateTo" class="btn-clear-date" (click)="clearDates()">
                Effacer dates
              </button>
            </div>
            <div style="margin-left:auto">
              <button *ngIf="hasActiveFilters" class="btn-clear-all" (click)="clearFilters()">
                ✕ Réinitialiser filtres
              </button>
            </div>
          </div>

        </div>

        <!-- Cards -->
        <div *ngIf="filtered.length > 0" class="hist-grid">
          <div *ngFor="let item of filtered" class="hist-card">
            <div class="card-thumb" [class]="thumbClass(item)">
              <span class="card-icon">{{ typeIcon(item) }}</span>
              <span class="card-badge"
                    [class.done]="item.status==='DONE'"
                    [class.failed]="item.status==='FAILED'"
                    [class.proc]="item.status==='PROCESSING'||item.status==='PENDING'">
                {{ statusLabel(item.status) }}
              </span>
            </div>
            <div class="card-body">
              <div class="card-name" [title]="item.fileName || 'Recherche'">
                {{ item.fileName || 'Recherche textuelle/visuelle' }}
              </div>
              <span *ngIf="item.type==='DOC' && item.operationType"
                    class="card-op-tag">{{ opLabel(item.operationType) }}</span>
              <div class="card-meta">
                <span class="card-query" [title]="getQueryLabel(item)">{{ getQueryLabel(item) }}</span>
                <span class="card-date">{{ item.createdAt | date:'dd/MM/yy HH:mm' }}</span>
              </div>
              <button *ngIf="item.resultJson" class="card-btn view" (click)="openModal(item)">
                Voir les résultats
              </button>
              <button *ngIf="!item.resultJson" class="card-btn disabled" disabled>
                Aucun résultat
              </button>
            </div>
          </div>
        </div>

        <!-- Empty -->
        <div *ngIf="filtered.length === 0" class="empty">
          <div class="empty-icon">{{ history.length === 0 ? '📭' : '🔍' }}</div>
          <p class="empty-title">{{ history.length === 0 ? 'Aucun historique' : 'Aucun resultat pour ces filtres' }}</p>
          <p class="empty-sub">{{ history.length === 0 ? 'Lancez une analyse pour voir votre historique ici.' : 'Modifiez les filtres pour afficher plus de resultats.' }}</p>
        </div>

      </ng-container>

      <!-- ── Modal résultats ── -->
      <div *ngIf="selectedItem" class="modal-overlay" (click)="closeModal($event)">
        <div class="modal" *ngIf="parsedResult">

          <button class="modal-close" (click)="selectedItem=null">&#x2715;</button>

          <!-- Header -->
          <div class="modal-header">
            <div class="modal-icon-wrap" [class]="thumbClass(selectedItem)">
              {{ typeIcon(selectedItem) }}
            </div>
            <div>
              <p class="modal-title">{{ selectedItem.fileName || 'Analyse' }}</p>
              <p class="modal-id">{{ selectedItem.jobId }}</p>
            </div>
          </div>

          <!-- Infos generales -->
          <div class="modal-section">
            <div class="modal-section-title">Informations</div>
            <div class="modal-kv">
              <div class="kv-row">
                <span class="kv-key">Statut</span>
                <span class="kv-val" [class.green]="selectedItem.status==='DONE'" [class.red]="selectedItem.status==='FAILED'" [class.amber]="selectedItem.status==='PROCESSING'">
                  {{ statusLabel(selectedItem.status) }}
                </span>
              </div>
              <div class="kv-row" *ngIf="selectedItem.createdAt">
                <span class="kv-key">Date</span>
                <span class="kv-val">{{ selectedItem.createdAt | date:'dd/MM/yyyy HH:mm:ss' }}</span>
              </div>
              <div class="kv-row" *ngIf="selectedItem.type">
                <span class="kv-key">Type</span>
                <span class="kv-val">{{ selectedItem.type }}</span>
              </div>
              <div class="kv-row" *ngIf="selectedItem.query">
                <span class="kv-key">Requete</span>
                <span class="kv-val">{{ selectedItem.query }}</span>
              </div>
            </div>
          </div>

          <!-- Contenu selon le type -->
          <ng-container [ngSwitch]="selectedItem.type">

            <!-- VIDEO -->
            <ng-container *ngSwitchCase="'VIDEO'">
              <ng-container *ngIf="parsedResult.audio_match">
                <div class="modal-section">
                  <div class="modal-section-title">Correspondance musicale</div>
                  <div class="match-card">
                    <img *ngIf="parsedResult.audio_match.coverArtUrl" [src]="parsedResult.audio_match.coverArtUrl"
                         class="match-cover" [alt]="parsedResult.audio_match.title" (error)="hideImg($event)">
                    <div *ngIf="!parsedResult.audio_match.coverArtUrl" class="match-cover-placeholder">🎵</div>
                    <div class="match-info">
                      <p class="match-title">{{ parsedResult.audio_match.title || 'Titre inconnu' }}</p>
                      <div class="match-meta">
                        <span *ngIf="parsedResult.audio_match.artist"   class="match-tag">{{ parsedResult.audio_match.artist }}</span>
                        <span *ngIf="parsedResult.audio_match.album"    class="match-tag">{{ parsedResult.audio_match.album }}</span>
                        <span *ngIf="parsedResult.audio_match.duration" class="match-tag">{{ parsedResult.audio_match.duration }}s</span>
                        <span *ngIf="parsedResult.audio_match.score"    class="match-score">{{ (parsedResult.audio_match.score * 100).toFixed(0) }}% match</span>
                        <span *ngIf="parsedResult.audio_match.confidence" class="match-score">{{ parsedResult.audio_match.confidence }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ng-container>
              <ng-container *ngIf="parsedResult.faces && parsedResult.faces.length > 0">
                <div class="modal-section">
                  <div class="modal-section-title">Visages detectes ({{ parsedResult.faces.length }})</div>
                  <div class="modal-kv">
                    <div *ngFor="let face of parsedResult.faces; let fi = index" class="kv-row">
                      <span class="kv-key">Visage {{ fi + 1 }}</span>
                      <span class="kv-val">{{ face.identity || face.name || 'Inconnu' }} {{ face.confidence ? '(' + (face.confidence * 100).toFixed(0) + '%)' : '' }}</span>
                    </div>
                  </div>
                </div>
              </ng-container>
              <ng-container *ngIf="parsedResult.objects && parsedResult.objects.length > 0">
                <div class="modal-section">
                  <div class="modal-section-title">Objets detectes</div>
                  <div class="kv-row">
                    <span class="kv-val">{{ parsedResult.objects.join(', ') }}</span>
                  </div>
                </div>
              </ng-container>
              <ng-container *ngIf="!parsedResult.audio_match && !parsedResult.faces">
                <div class="modal-section">
                  <div class="modal-section-title">Donnees brutes</div>
                  <div class="json-block"><pre>{{ parsedResult | json }}</pre></div>
                </div>
              </ng-container>
            </ng-container>

            <!-- AUDIO -->
            <ng-container *ngSwitchCase="'AUDIO'">
              <ng-container *ngIf="parsedResult.title || parsedResult.artist">
                <div class="modal-section">
                  <div class="modal-section-title">Correspondance</div>
                  <div class="match-card">
                    <img *ngIf="parsedResult.coverArtUrl" [src]="parsedResult.coverArtUrl"
                         class="match-cover" [alt]="parsedResult.title" (error)="hideImg($event)">
                    <div *ngIf="!parsedResult.coverArtUrl" class="match-cover-placeholder">🎵</div>
                    <div class="match-info">
                      <p class="match-title">{{ parsedResult.title || 'Titre inconnu' }}</p>
                      <div class="match-meta">
                        <span *ngIf="parsedResult.artist"     class="match-tag">{{ parsedResult.artist }}</span>
                        <span *ngIf="parsedResult.album"      class="match-tag">{{ parsedResult.album }}</span>
                        <span *ngIf="parsedResult.duration"   class="match-tag">{{ parsedResult.duration }}</span>
                        <span *ngIf="parsedResult.score"      class="match-score">{{ (parsedResult.score * 100).toFixed(0) }}% match</span>
                        <span *ngIf="parsedResult.confidence" class="match-score">{{ parsedResult.confidence }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ng-container>
              <ng-container *ngIf="!parsedResult.title">
                <div class="modal-section">
                  <div class="modal-section-title">Donnees</div>
                  <div class="json-block"><pre>{{ parsedResult | json }}</pre></div>
                </div>
              </ng-container>
            </ng-container>

            <!-- IMAGE (face) -->
            <ng-container *ngSwitchCase="'IMAGE'">
              <div class="modal-section">
                <div class="modal-section-title">Resultat reconnaissance</div>
                <div class="modal-kv">
                  <div class="kv-row" *ngIf="parsedResult.identity || parsedResult.name">
                    <span class="kv-key">Identite</span>
                    <span class="kv-val green">{{ parsedResult.identity || parsedResult.name }}</span>
                  </div>
                  <div class="kv-row" *ngIf="parsedResult.confidence">
                    <span class="kv-key">Confiance</span>
                    <span class="kv-val">{{ parsedResult.confidence }}</span>
                  </div>
                  <div class="kv-row" *ngIf="parsedResult.age">
                    <span class="kv-key">Age estime</span>
                    <span class="kv-val">{{ parsedResult.age }} ans</span>
                  </div>
                  <div class="kv-row" *ngIf="parsedResult.gender">
                    <span class="kv-key">Genre</span>
                    <span class="kv-val">{{ parsedResult.gender }}</span>
                  </div>
                  <ng-container *ngIf="parsedResult.faces && parsedResult.faces.length > 0">
                    <div *ngFor="let face of parsedResult.faces; let fi = index" class="kv-row">
                      <span class="kv-key">Visage {{ fi + 1 }}</span>
                      <span class="kv-val">{{ face.identity || face.name || 'Inconnu' }} {{ face.confidence ? '— ' + (face.confidence * 100).toFixed(0) + '%' : '' }}</span>
                    </div>
                  </ng-container>
                  <div class="kv-row" *ngIf="!parsedResult.identity && !parsedResult.name && !parsedResult.faces">
                    <span class="kv-key">Donnees</span>
                    <span class="kv-val mono">{{ parsedResult | json }}</span>
                  </div>
                </div>
              </div>
            </ng-container>

            <!-- OCR / DOC (texte) -->
            <ng-container *ngSwitchCase="'DOC'">
              <ng-container *ngIf="parsedResult.text">
                <div class="modal-section">
                  <div class="modal-section-title">Texte extrait ({{ (parsedResult.text || '').length }} caracteres)</div>
                  <div class="ocr-block">{{ parsedResult.text }}</div>
                </div>
              </ng-container>
              <div class="modal-section" *ngIf="parsedResult.operation">
                <div class="modal-section-title">Details operation</div>
                <div class="modal-kv">
                  <div class="kv-row" *ngIf="parsedResult.operation">
                    <span class="kv-key">Operation</span>
                    <span class="kv-val">{{ parsedResult.operation }}</span>
                  </div>
                  <div class="kv-row" *ngIf="parsedResult.fileName">
                    <span class="kv-key">Fichier</span>
                    <span class="kv-val">{{ parsedResult.fileName }}</span>
                  </div>
                </div>
              </div>
              <ng-container *ngIf="!parsedResult.text && !parsedResult.operation">
                <div class="modal-section">
                  <div class="modal-section-title">Donnees</div>
                  <div class="json-block"><pre>{{ parsedResult | json }}</pre></div>
                </div>
              </ng-container>
            </ng-container>

            <!-- Default -->
            <ng-container *ngSwitchDefault>
              <ng-container *ngIf="parsedResult.text">
                <div class="modal-section">
                  <div class="modal-section-title">Texte extrait</div>
                  <div class="ocr-block">{{ parsedResult.text }}</div>
                </div>
              </ng-container>
              <ng-container *ngIf="!parsedResult.text">
                <div class="modal-section">
                  <div class="modal-section-title">Donnees brutes</div>
                  <div class="json-block"><pre>{{ parsedResult | json }}</pre></div>
                </div>
              </ng-container>
            </ng-container>

          </ng-container>

          <div class="modal-footer">
            <button class="btn-close-modal" (click)="selectedItem=null">Fermer</button>
          </div>

        </div>
      </div>

    </div>
  `
})
export class HistoryComponent implements OnInit {
  history: any[]     = [];
  loading            = true;
  selectedItem: any  = null;
  parsedResult: any  = null;
  filterStatus       = 'all';
  filterCat          = 'all';
  filterOp           = 'all';
  filterDateFrom     = '';
  filterDateTo       = '';

  constructor(private searchService: SearchService) {}

  ngOnInit() { this.fetchHistory(); }

  fetchHistory() {
    this.loading = true;
    this.searchService.getSearchHistory().subscribe({
      next:  (res) => { this.history = res || []; this.loading = false; },
      error: ()    => { this.history = [];          this.loading = false; }
    });
  }

  /** Switch category and reset sub-filter */
  setCat(cat: string) {
    this.filterCat = cat;
    this.filterOp  = 'all';
  }

  get filtered(): any[] {
    return this.history.filter(item => {
      // Statut
      const okStatus = this.filterStatus === 'all'
        || item.status === this.filterStatus
        || (this.filterStatus === 'PROCESSING' && (item.status === 'PROCESSING' || item.status === 'PENDING'));

      // Categorie
      const okCat = this.filterCat === 'all' || item.type === this.filterCat;

      // Sous-filtre operation DocFusion
      const okOp = this.filterOp === 'all' || !item.operationType
        || (item.operationType || '').toLowerCase() === this.filterOp
        // opération parsée depuis resultJson
        || this._opFromResult(item) === this.filterOp;

      // Date de debut
      let okFrom = true;
      if (this.filterDateFrom && item.createdAt) {
        const itemDate = new Date(item.createdAt);
        const from     = new Date(this.filterDateFrom);
        from.setHours(0, 0, 0, 0);
        okFrom = itemDate >= from;
      }

      // Date de fin
      let okTo = true;
      if (this.filterDateTo && item.createdAt) {
        const itemDate = new Date(item.createdAt);
        const to       = new Date(this.filterDateTo);
        to.setHours(23, 59, 59, 999);
        okTo = itemDate <= to;
      }

      return okStatus && okCat && okOp && okFrom && okTo;
    });
  }

  /** Extract operation type from resultJson for DOC items */
  private _opFromResult(item: any): string {
    if (!item.resultJson) return '';
    try {
      const r = JSON.parse(item.resultJson);
      return (r.operation || r.operationType || '').toLowerCase();
    } catch { return ''; }
  }

  clearDates() {
    this.filterDateFrom = '';
    this.filterDateTo   = '';
  }

  clearFilters() {
    this.filterStatus   = 'all';
    this.filterCat      = 'all';
    this.filterOp       = 'all';
    this.filterDateFrom = '';
    this.filterDateTo   = '';
  }

  get hasActiveFilters(): boolean {
    return this.filterStatus !== 'all' || this.filterCat !== 'all'
      || this.filterOp !== 'all' || !!this.filterDateFrom || !!this.filterDateTo;
  }

  countByStatus(status: string): number {
    return this.history.filter(i => i.status === status).length;
  }

  getQueryLabel(item: any): string {
    if (item.query) return 'Requête: ' + item.query;
    if (item.type === 'DOC') return 'Traitement DocFusion';
    return 'Analyse de fichier';
  }

  opLabel(op: string): string {
    const map: Record<string, string> = {
      'ocr': 'OCR',
      'convert-to-pdf':  '→ PDF',
      'convert-to-docx': '→ DOCX',
      'merge':     'Fusion',
      'split':     'Découpage',
      'compress':  'Compression',
      'watermark': 'Filigrane',
    };
    return map[(op || '').toLowerCase()] || op;
  }

  thumbClass(item: any): string {
    const t = (item.type || '').toUpperCase();
    if (t === 'AUDIO') return 'audio';
    if (t === 'VIDEO') return 'video';
    if (t === 'IMAGE') return 'image';
    if (t === 'DOC')   return 'doc';
    return 'default';
  }

  typeIcon(item: any): string {
    const t = (item.type || '').toUpperCase();
    if (t === 'AUDIO') return '🎵';
    if (t === 'VIDEO') return '🎬';
    if (t === 'IMAGE') return '👤';
    if (t === 'DOC')   return '📄';
    return '🔍';
  }

  statusLabel(status: string): string {
    if (status === 'DONE')       return 'Termine';
    if (status === 'FAILED')     return 'Echec';
    if (status === 'PROCESSING') return 'En cours';
    if (status === 'PENDING')    return 'En attente';
    return status;
  }

  openModal(item: any) {
    this.selectedItem = item;
    try {
      this.parsedResult = item.resultJson ? JSON.parse(item.resultJson) : {};
    } catch {
      this.parsedResult = { text: item.resultJson };
    }
  }

  closeModal(e: MouseEvent) {
    if ((e.target as Element).classList.contains('modal-overlay')) {
      this.selectedItem = null;
      this.parsedResult = null;
    }
  }

  hideImg(e: Event) {
    (e.target as HTMLImageElement).style.display = 'none';
  }
}
