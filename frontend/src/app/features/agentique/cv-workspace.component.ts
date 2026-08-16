import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgentSessionBarComponent } from '../../shared/components/agent-session-bar/agent-session-bar.component';
import { CvWorkspaceService, WorkspaceCv, WorkspaceMode } from './cv-workspace.service';

@Component({
  selector: 'app-cv-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, AgentSessionBarComponent],
  template: `
<div class="ws-page">
  <app-agent-session-bar [showWorkspace]="true"></app-agent-session-bar>

  <!-- Mode selector overlay -->
  <div *ngIf="showModeSelector" class="mode-overlay" (click).self="$event.stopPropagation()">
    <div class="mode-dialog">
      <div class="mode-icon">🎯</div>
      <h2 class="mode-title">Quel est votre contexte d'utilisation ?</h2>
      <p class="mode-sub">Le workspace s'adapte à votre besoin. Vous pourrez changer de mode à tout moment.</p>
      <div class="mode-cards">
        <button class="mode-card" (click)="pickMode('recruiter')">
          <span class="mc-icon">🏢</span>
          <span class="mc-label">Recruteur</span>
          <span class="mc-desc">Trier et présélectionner des candidats pour un poste</span>
        </button>
        <button class="mode-card" (click)="pickMode('candidate')">
          <span class="mc-icon">👤</span>
          <span class="mc-label">Candidat</span>
          <span class="mc-desc">Optimiser et comparer des versions de mon CV</span>
        </button>
        <button class="mode-card" (click)="pickMode('hr')">
          <span class="mc-icon">🏛️</span>
          <span class="mc-label">RH Interne</span>
          <span class="mc-desc">Gérer les profils de l'équipe et identifier les lacunes</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Workspace header -->
  <div class="ws-topbar">
    <div class="ws-topbar-left">
      <button class="back-btn" (click)="goBack()">← Retour</button>
      <div>
        <h1 class="ws-heading">Workspace ATS</h1>
        <div class="ws-stats-row" *ngIf="cvs.length">
          <span class="stat-chip stat-total">{{ cvs.length }} CV</span>
          <span class="stat-chip stat-avg">Score moy. {{ avgScore }}</span>
          <span class="stat-chip stat-sel">{{ countByStatus('selected') }} présélectionné(s)</span>
          <span class="stat-chip stat-fav">{{ countByStatus('favorite') }} favori(s)</span>
        </div>
      </div>
    </div>
    <div class="ws-topbar-right">
      <button class="mode-toggle" (click)="showModeSelector=true">
        {{ modeIcon }} {{ modeLabel }}
      </button>
      <button *ngIf="compareList.length >= 2" class="ws-btn ws-btn-compare" (click)="startCompare()">
        🔍 Comparer ({{ compareList.length }})
      </button>
      <button class="ws-btn" (click)="exportCsv()" [disabled]="!cvs.length">📊 Export Excel</button>
      <button class="ws-btn" (click)="exportPdf()" [disabled]="!detailCv">📄 Export PDF</button>
      <button class="ws-btn ws-btn-primary" (click)="goAnalyze()">+ Analyser des CV</button>
    </div>
  </div>

  <!-- Comparison view -->
  <div *ngIf="comparing" class="compare-view">
    <div class="compare-header">
      <h2 class="compare-title">Comparaison de {{ compareList.length }} CV</h2>
      <button class="close-compare" (click)="comparing=false">✕ Fermer la comparaison</button>
    </div>
    <div class="compare-grid" [style.grid-template-columns]="'repeat('+compareList.length+',1fr)'">
      <div *ngFor="let cv of compareList" class="compare-card"
           [class.compare-best]="cv.globalScore === bestScore">
        <div class="cc-name">{{ shortName(cv.fileName) }}</div>
        <div class="cc-score" [class.cc-excellent]="cv.globalScore>=80" [class.cc-good]="cv.globalScore>=60" [class.cc-low]="cv.globalScore<60">
          {{ cv.globalScore }}<span class="cc-over">/100</span>
        </div>
        <div class="cc-ats">ATS : {{ cv.atsPct }}%
          <div class="cc-ats-bar"><div [style.width.%]="cv.atsPct" [class.ats-g]="cv.atsPct>=70" [class.ats-m]="cv.atsPct>=50&&cv.atsPct<70" [class.ats-l]="cv.atsPct<50"></div></div>
        </div>
        <div *ngIf="cv.globalScore===bestScore" class="cc-best-badge">🏆 Meilleur</div>
        <div class="cc-sections">
          <div *ngFor="let s of cv.sections" class="cc-sec">
            <span class="cc-sec-name">{{ s.icon }} {{ s.title }}</span>
            <div class="cc-sec-bar"><div [style.width.%]="s.score" [style.background]="s.color"></div></div>
            <span class="cc-sec-score" [style.color]="s.color">{{ s.score }}</span>
          </div>
        </div>
        <div class="cc-kw">
          <span class="cc-kw-label">Mots-clés présents :</span>
          <span class="cc-kw-count">{{ kwPresent(cv) }}/{{ cv.keywords.length }}</span>
        </div>
        <div class="cc-status">
          <span class="status-badge" [class]="'sb-'+cv.status">{{ statusLabel(cv.status) }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Main content -->
  <div *ngIf="!comparing" class="ws-body">

    <!-- Empty state -->
    <div *ngIf="!cvs.length" class="ws-empty">
      <div class="we-icon">📋</div>
      <h2 class="we-title">Aucun CV analysé</h2>
      <p class="we-sub">Analysez des CV depuis l'outil d'analyse pour les retrouver ici.</p>
      <button class="ws-btn ws-btn-primary" (click)="goAnalyze()">→ Aller analyser des CV</button>
    </div>

    <!-- Table + Detail panel -->
    <div *ngIf="cvs.length" class="ws-split">

      <!-- LEFT: table panel -->
      <div class="ws-list-panel">
        <!-- Filter bar -->
        <div class="filter-bar">
          <input class="filter-input" [(ngModel)]="filterText" placeholder="Rechercher un CV…">
          <select class="filter-sel" [(ngModel)]="filterStatus">
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="selected">Présélectionné</option>
            <option value="waiting">À revoir</option>
            <option value="favorite">Favori</option>
            <option value="rejected">Refusé</option>
          </select>
          <button *ngIf="compareList.length" class="clear-compare-btn" (click)="compareList=[]">✕ Sélection</button>
        </div>

        <!-- Table -->
        <div class="cv-table-wrap">
          <table class="cv-table">
            <thead>
              <tr>
                <th class="th-chk"></th>
                <th class="th-name" (click)="sort('name')">CV <span class="sort-ico">{{ sortIcon('name') }}</span></th>
                <th class="th-score" (click)="sort('score')">Score <span class="sort-ico">{{ sortIcon('score') }}</span></th>
                <th class="th-ats" (click)="sort('ats')">ATS <span class="sort-ico">{{ sortIcon('ats') }}</span></th>
                <th class="th-status">Statut</th>
                <th class="th-date" (click)="sort('date')">Date <span class="sort-ico">{{ sortIcon('date') }}</span></th>
                <th class="th-del"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let cv of filteredCvs"
                  [class.row-active]="detailCv?.id === cv.id"
                  (click)="selectDetail(cv)">
                <td class="td-chk" (click)="$event.stopPropagation(); toggleCompare(cv)">
                  <div class="chk-box" [class.chk-checked]="isInCompare(cv)">{{ isInCompare(cv) ? '✓' : '' }}</div>
                </td>
                <td class="td-name">
                  <span class="cv-file-icon">📄</span>
                  <div class="cv-name-block">
                    <span class="cv-filename">{{ shortName(cv.fileName) }}</span>
                    <span class="cv-job" *ngIf="cv.targetJob">{{ cv.targetJob }}</span>
                  </div>
                </td>
                <td class="td-score">
                  <span class="score-pill"
                        [class.score-ex]="cv.globalScore>=80"
                        [class.score-ok]="cv.globalScore>=60&&cv.globalScore<80"
                        [class.score-lo]="cv.globalScore<60">
                    {{ cv.globalScore }}
                  </span>
                </td>
                <td class="td-ats">
                  <div class="ats-mini">
                    <div class="ats-mini-bar">
                      <div [style.width.%]="cv.atsPct"
                           [class.ats-g]="cv.atsPct>=70"
                           [class.ats-m]="cv.atsPct>=50&&cv.atsPct<70"
                           [class.ats-l]="cv.atsPct<50"></div>
                    </div>
                    <span>{{ cv.atsPct }}%</span>
                  </div>
                </td>
                <td class="td-status" (click)="$event.stopPropagation()">
                  <select class="status-sel" [(ngModel)]="cv.status" (ngModelChange)="onStatusChange(cv)">
                    <option value="pending">⏳ En attente</option>
                    <option value="selected">✅ Présélectionné</option>
                    <option value="waiting">🔄 À revoir</option>
                    <option value="favorite">⭐ Favori</option>
                    <option value="rejected">❌ Refusé</option>
                  </select>
                </td>
                <td class="td-date">{{ fmtDate(cv.analyzedAt) }}</td>
                <td class="td-del" (click)="$event.stopPropagation(); deleteCv(cv.id)">
                  <button class="del-btn" title="Supprimer">🗑</button>
                </td>
              </tr>
            </tbody>
          </table>
          <div *ngIf="filteredCvs.length === 0 && cvs.length > 0" class="no-results">Aucun CV ne correspond aux filtres.</div>
        </div>
        <div class="list-footer">
          {{ filteredCvs.length }} / {{ cvs.length }} CV affiché(s)
          <button class="clear-all-btn" *ngIf="cvs.length" (click)="clearAll()">🗑 Tout supprimer</button>
        </div>
      </div>

      <!-- RIGHT: detail panel -->
      <div class="ws-detail" *ngIf="detailCv">
        <div class="detail-header">
          <div class="dh-file">
            <span class="dh-icon">📄</span>
            <div>
              <span class="dh-name">{{ shortName(detailCv.fileName) }}</span>
              <span class="dh-meta" *ngIf="detailCv.targetJob">Poste ciblé : {{ detailCv.targetJob }}</span>
              <span class="dh-meta">{{ fmtDate(detailCv.analyzedAt) }} · {{ fmtSize(detailCv.fileSize) }}</span>
            </div>
          </div>
          <button class="close-detail" (click)="detailCv=null">✕</button>
        </div>

        <!-- Score card -->
        <div class="detail-score-card" id="pdf-content">
          <div class="dsc-circle" [class.dsc-ex]="detailCv.globalScore>=80" [class.dsc-ok]="detailCv.globalScore>=60" [class.dsc-lo]="detailCv.globalScore<60">
            <svg viewBox="0 0 100 100" width="100" height="100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" stroke-width="8"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke-width="8"
                      [attr.stroke]="detailCv.globalScore>=80?'#10b981':detailCv.globalScore>=60?'#f59e0b':'#ef4444'"
                      stroke-linecap="round"
                      [attr.stroke-dasharray]="264"
                      [attr.stroke-dashoffset]="264-(264*detailCv.globalScore/100)"
                      transform="rotate(-90 50 50)"/>
            </svg>
            <div class="dsc-inner">
              <span class="dsc-num">{{ detailCv.globalScore }}</span>
              <span class="dsc-over">/100</span>
            </div>
          </div>
          <div class="dsc-info">
            <div class="dsc-label">{{ detailCv.globalLabel }}</div>
            <div class="dsc-ats-row">
              <span class="dsc-ats-lbl">Score ATS</span>
              <div class="dsc-ats-wrap">
                <div [style.width.%]="detailCv.atsPct"
                     [class.ats-g]="detailCv.atsPct>=70"
                     [class.ats-m]="detailCv.atsPct>=50&&detailCv.atsPct<70"
                     [class.ats-l]="detailCv.atsPct<50"
                     class="dsc-ats-bar"></div>
              </div>
              <span class="dsc-ats-pct">{{ detailCv.atsPct }}%</span>
            </div>
          </div>
        </div>

        <!-- Sections -->
        <div class="detail-sections">
          <div *ngFor="let s of detailCv.sections" class="ds-card">
            <div class="ds-top">
              <span class="ds-icon">{{ s.icon }}</span>
              <div class="ds-info">
                <span class="ds-title">{{ s.title }}</span>
                <div class="ds-bar-wrap"><div class="ds-bar" [style.width.%]="s.score" [style.background]="s.color"></div></div>
              </div>
              <span class="ds-score" [style.color]="s.color">{{ s.score }}</span>
            </div>
            <p class="ds-fb">{{ s.feedback }}</p>
          </div>
        </div>

        <!-- Keywords -->
        <div class="detail-kw">
          <div class="detail-block-title">🏷️ Mots-clés ATS</div>
          <div class="kw-grid">
            <span *ngFor="let k of detailCv.keywords" class="kw-chip" [class.kw-present]="k.present" [class.kw-missing]="!k.present">
              {{ k.present ? '✓' : '✗' }} {{ k.word }}
            </span>
          </div>
        </div>

        <!-- Strengths / Improvements -->
        <div class="detail-fb-grid">
          <div class="dfb-card dfb-strengths">
            <div class="detail-block-title">✅ Points forts</div>
            <ul class="dfb-list">
              <li *ngFor="let s of detailCv.strengths">{{ s }}</li>
            </ul>
          </div>
          <div class="dfb-card dfb-improvements">
            <div class="detail-block-title">📌 À améliorer</div>
            <ul class="dfb-list">
              <li *ngFor="let i of detailCv.improvements">{{ i }}</li>
            </ul>
          </div>
        </div>

        <!-- Jobs -->
        <div class="detail-jobs">
          <div class="detail-block-title">💼 Postes correspondants</div>
          <div class="jobs-wrap">
            <span *ngFor="let j of detailCv.suggestedJobs" class="job-tag">{{ j }}</span>
          </div>
        </div>

        <!-- Notes -->
        <div class="detail-notes">
          <div class="detail-block-title">📝 Notes recruteur</div>
          <textarea class="notes-ta" [(ngModel)]="detailCv.notes" (blur)="saveNotes()" rows="3" placeholder="Vos observations sur ce candidat…"></textarea>
        </div>
      </div>

      <!-- No detail selected -->
      <div *ngIf="!detailCv" class="ws-detail-empty">
        <div class="de-icon">👆</div>
        <p class="de-text">Cliquez sur un CV pour voir son rapport complet</p>
        <p class="de-hint" *ngIf="cvs.length >= 2">Cochez plusieurs CV pour les comparer</p>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display:block; font-family:'Inter',sans-serif; }

    /* ── Page ── */
    .ws-page { min-height:100vh; background:#f8fafc; display:flex; flex-direction:column; }

    /* ── Mode overlay ── */
    .mode-overlay {
      position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000;
      display:flex; align-items:center; justify-content:center; padding:1rem;
    }
    .mode-dialog {
      background:#fff; border-radius:20px; padding:2.5rem; max-width:560px; width:100%;
      box-shadow:0 20px 60px rgba(0,0,0,.2); text-align:center;
    }
    .mode-icon { font-size:2.5rem; margin-bottom:.75rem; }
    .mode-title { font-size:1.3rem; font-weight:900; color:#111827; margin:0 0 .5rem; }
    .mode-sub { font-size:.82rem; color:#6b7280; margin:0 0 1.75rem; }
    .mode-cards { display:grid; grid-template-columns:1fr 1fr 1fr; gap:.85rem; }
    .mode-card {
      display:flex; flex-direction:column; align-items:center; gap:.4rem;
      background:#f9fafb; border:2px solid #e5e7eb; border-radius:14px;
      padding:1.1rem .75rem; cursor:pointer; transition:.15s; text-align:center;
    }
    .mode-card:hover { border-color:#0d9488; background:#f0fdfa; }
    .mc-icon { font-size:1.6rem; }
    .mc-label { font-size:.82rem; font-weight:800; color:#111827; }
    .mc-desc { font-size:.7rem; color:#6b7280; line-height:1.45; }

    /* ── Top bar ── */
    .ws-topbar {
      display:flex; align-items:center; justify-content:space-between; gap:1rem;
      background:#fff; border-bottom:1px solid #e5e7eb;
      padding:.85rem 1.75rem; flex-wrap:wrap;
    }
    .ws-topbar-left { display:flex; align-items:center; gap:1rem; }
    .ws-topbar-right { display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
    .back-btn { background:none; border:1px solid #e5e7eb; color:#6b7280; font-size:.78rem; padding:.3rem .65rem; border-radius:8px; cursor:pointer; }
    .back-btn:hover { background:#f3f4f6; }
    .ws-heading { font-size:1.25rem; font-weight:900; color:#111827; margin:0 0 .3rem; }
    .ws-stats-row { display:flex; gap:.5rem; flex-wrap:wrap; }
    .stat-chip { font-size:.68rem; font-weight:700; padding:.15rem .55rem; border-radius:20px; }
    .stat-total { background:#f3f4f6; color:#374151; }
    .stat-avg   { background:#dbeafe; color:#1d4ed8; }
    .stat-sel   { background:#dcfce7; color:#15803d; }
    .stat-fav   { background:#fef9c3; color:#854d0e; }

    .mode-toggle {
      font-size:.73rem; font-weight:700; background:#f3f4f6; border:1px solid #e5e7eb;
      color:#374151; padding:.3rem .75rem; border-radius:8px; cursor:pointer;
    }
    .mode-toggle:hover { background:#e5e7eb; }
    .ws-btn {
      font-size:.75rem; font-weight:700; padding:.35rem .8rem; border-radius:8px;
      border:1px solid #e5e7eb; background:#fff; color:#374151; cursor:pointer; transition:.15s;
    }
    .ws-btn:hover:not(:disabled) { background:#f3f4f6; }
    .ws-btn:disabled { opacity:.4; cursor:not-allowed; }
    .ws-btn-primary { background:#0d9488; border-color:#0d9488; color:#fff; }
    .ws-btn-primary:hover:not(:disabled) { background:#0f766e; }
    .ws-btn-compare { background:#6366f1; border-color:#6366f1; color:#fff; }
    .ws-btn-compare:hover { background:#4f46e5; }

    /* ── Compare view ── */
    .compare-view { padding:1.5rem 1.75rem; overflow-x:auto; }
    .compare-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem; }
    .compare-title { font-size:1rem; font-weight:800; color:#111827; margin:0; }
    .close-compare { background:#f3f4f6; border:1px solid #e5e7eb; color:#374151; font-size:.75rem; font-weight:700; padding:.3rem .75rem; border-radius:8px; cursor:pointer; }
    .compare-grid { display:grid; gap:1rem; min-width:600px; }
    .compare-card { background:#fff; border:2px solid #e5e7eb; border-radius:14px; padding:1.25rem; display:flex; flex-direction:column; gap:.75rem; }
    .compare-best { border-color:#10b981; }
    .cc-name { font-size:.82rem; font-weight:700; color:#111827; word-break:break-all; }
    .cc-score { font-size:2rem; font-weight:900; text-align:center; line-height:1; }
    .cc-over { font-size:.8rem; color:#6b7280; }
    .cc-excellent { color:#10b981; } .cc-good { color:#f59e0b; } .cc-low { color:#ef4444; }
    .cc-ats { font-size:.72rem; color:#374151; display:flex; flex-direction:column; gap:.3rem; }
    .cc-ats-bar { height:6px; background:#e5e7eb; border-radius:10px; overflow:hidden; }
    .cc-ats-bar > div { height:100%; border-radius:10px; }
    .cc-best-badge { background:#dcfce7; color:#15803d; font-size:.68rem; font-weight:800; padding:.2rem .5rem; border-radius:10px; text-align:center; }
    .cc-sections { display:flex; flex-direction:column; gap:.4rem; }
    .cc-sec { display:flex; align-items:center; gap:.4rem; }
    .cc-sec-name { font-size:.65rem; color:#374151; width:120px; flex-shrink:0; }
    .cc-sec-bar { flex:1; height:5px; background:#e5e7eb; border-radius:10px; overflow:hidden; }
    .cc-sec-bar > div { height:100%; border-radius:10px; }
    .cc-sec-score { font-size:.7rem; font-weight:700; width:24px; text-align:right; flex-shrink:0; }
    .cc-kw { font-size:.72rem; color:#374151; display:flex; justify-content:space-between; }
    .cc-kw-count { font-weight:800; color:#0d9488; }
    .cc-status { text-align:center; }

    /* ── Main body ── */
    .ws-body { flex:1; display:flex; flex-direction:column; padding:1.25rem 1.75rem; gap:1rem; }
    .ws-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.85rem; padding:4rem 2rem; text-align:center; flex:1; }
    .we-icon { font-size:3rem; }
    .we-title { font-size:1.1rem; font-weight:800; color:#111827; margin:0; }
    .we-sub { font-size:.82rem; color:#6b7280; margin:0; }

    /* ── Split layout ── */
    .ws-split { display:grid; grid-template-columns:1fr 420px; gap:1.25rem; flex:1; min-height:0; }
    @media(max-width:1100px) { .ws-split { grid-template-columns:1fr; } }

    /* ── List panel ── */
    .ws-list-panel { display:flex; flex-direction:column; gap:.75rem; }
    .filter-bar { display:flex; gap:.6rem; flex-wrap:wrap; }
    .filter-input { flex:1; min-width:160px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:.45rem .8rem; font-size:.8rem; color:#111827; outline:none; }
    .filter-input:focus { border-color:#0d9488; }
    .filter-sel { background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:.45rem .6rem; font-size:.78rem; color:#374151; outline:none; cursor:pointer; }
    .clear-compare-btn { background:#eef2ff; border:1px solid #c7d2fe; color:#4338ca; font-size:.72rem; font-weight:700; padding:.3rem .65rem; border-radius:8px; cursor:pointer; }

    .cv-table-wrap { background:#fff; border:1px solid #e5e7eb; border-radius:14px; overflow:hidden; overflow-x:auto; }
    .cv-table { width:100%; border-collapse:collapse; font-size:.78rem; }
    .cv-table thead tr { background:#f9fafb; border-bottom:2px solid #e5e7eb; }
    .cv-table th { padding:.65rem .85rem; text-align:left; font-size:.68rem; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; cursor:pointer; user-select:none; }
    .cv-table th:hover { color:#111827; }
    .sort-ico { font-size:.6rem; color:#9ca3af; }
    .cv-table tbody tr { border-bottom:1px solid #f3f4f6; cursor:pointer; transition:.1s; }
    .cv-table tbody tr:hover { background:#f9fafb; }
    .cv-table tbody tr:last-child { border-bottom:none; }
    .row-active { background:#f0fdfa !important; }
    .cv-table td { padding:.6rem .85rem; vertical-align:middle; }
    .th-chk,.td-chk { width:36px; padding-left:.5rem !important; }
    .chk-box { width:18px; height:18px; border:2px solid #d1d5db; border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:.6rem; font-weight:900; cursor:pointer; transition:.1s; }
    .chk-checked { background:#0d9488; border-color:#0d9488; color:#fff; }
    .td-name { display:flex; align-items:center; gap:.5rem; }
    .cv-file-icon { font-size:1.1rem; flex-shrink:0; }
    .cv-name-block { display:flex; flex-direction:column; min-width:0; }
    .cv-filename { font-weight:700; color:#111827; font-size:.78rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; }
    .cv-job { font-size:.65rem; color:#6b7280; }
    .score-pill { display:inline-block; width:36px; text-align:center; font-size:.82rem; font-weight:900; padding:.2rem .3rem; border-radius:7px; }
    .score-ex { background:#dcfce7; color:#15803d; }
    .score-ok { background:#fef9c3; color:#854d0e; }
    .score-lo { background:#fef2f2; color:#dc2626; }
    .ats-mini { display:flex; align-items:center; gap:.4rem; }
    .ats-mini-bar { width:50px; height:5px; background:#e5e7eb; border-radius:10px; overflow:hidden; flex-shrink:0; }
    .ats-mini-bar > div { height:100%; border-radius:10px; }
    .ats-g { background:#10b981; } .ats-m { background:#f59e0b; } .ats-l { background:#ef4444; }
    .status-sel { font-size:.72rem; border:1px solid #e5e7eb; border-radius:7px; padding:.2rem .35rem; background:#fff; color:#374151; cursor:pointer; outline:none; }
    .td-date { color:#6b7280; font-size:.72rem; white-space:nowrap; }
    .del-btn { background:none; border:none; cursor:pointer; font-size:.9rem; opacity:.4; transition:.1s; padding:.1rem; }
    .del-btn:hover { opacity:1; }
    .no-results { padding:1.5rem; text-align:center; color:#9ca3af; font-size:.82rem; }
    .list-footer { display:flex; align-items:center; justify-content:space-between; font-size:.72rem; color:#9ca3af; padding:.1rem .25rem; }
    .clear-all-btn { background:none; border:none; color:#ef4444; font-size:.72rem; cursor:pointer; opacity:.7; }
    .clear-all-btn:hover { opacity:1; }

    /* ── Detail panel ── */
    .ws-detail {
      background:#fff; border:1px solid #e5e7eb; border-radius:16px;
      display:flex; flex-direction:column; gap:1rem; padding:1.25rem;
      overflow-y:auto; max-height:calc(100vh - 200px);
    }
    .detail-header { display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem; }
    .dh-file { display:flex; align-items:flex-start; gap:.65rem; }
    .dh-icon { font-size:1.5rem; flex-shrink:0; }
    .dh-name { display:block; font-size:.9rem; font-weight:800; color:#111827; }
    .dh-meta { display:block; font-size:.68rem; color:#6b7280; margin-top:.15rem; }
    .close-detail { background:none; border:1px solid #e5e7eb; color:#9ca3af; width:26px; height:26px; border-radius:6px; cursor:pointer; font-size:.75rem; flex-shrink:0; }
    .close-detail:hover { background:#f3f4f6; color:#374151; }

    .detail-score-card { display:flex; align-items:center; gap:1.25rem; background:#f9fafb; border-radius:12px; padding:1rem 1.25rem; }
    .dsc-circle { position:relative; flex-shrink:0; }
    .dsc-inner { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .dsc-num { font-size:1.5rem; font-weight:900; color:#111827; line-height:1; }
    .dsc-over { font-size:.6rem; color:#6b7280; }
    .dsc-info { flex:1; display:flex; flex-direction:column; gap:.6rem; }
    .dsc-label { font-size:1rem; font-weight:800; color:#111827; }
    .dsc-ats-row { display:flex; align-items:center; gap:.5rem; }
    .dsc-ats-lbl { font-size:.68rem; font-weight:700; color:#374151; white-space:nowrap; }
    .dsc-ats-wrap { flex:1; height:7px; background:#e5e7eb; border-radius:10px; overflow:hidden; }
    .dsc-ats-bar { height:100%; border-radius:10px; transition:width .8s ease; }
    .dsc-ats-pct { font-size:.75rem; font-weight:800; color:#374151; }

    .detail-sections { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; }
    .ds-card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:.75rem; display:flex; flex-direction:column; gap:.35rem; }
    .ds-top { display:flex; align-items:center; gap:.5rem; }
    .ds-icon { font-size:1rem; flex-shrink:0; }
    .ds-info { flex:1; min-width:0; }
    .ds-title { display:block; font-size:.7rem; font-weight:700; color:#111827; margin-bottom:.25rem; }
    .ds-bar-wrap { height:5px; background:#e5e7eb; border-radius:10px; overflow:hidden; }
    .ds-bar { height:100%; border-radius:10px; }
    .ds-score { font-size:.9rem; font-weight:800; flex-shrink:0; }
    .ds-fb { font-size:.67rem; color:#6b7280; line-height:1.5; margin:0; }

    .detail-block-title { font-size:.72rem; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:.06em; margin-bottom:.5rem; }
    .detail-kw { }
    .kw-grid { display:flex; flex-wrap:wrap; gap:.35rem; }
    .kw-chip { font-size:.68rem; font-weight:700; padding:.18rem .5rem; border-radius:6px; }
    .kw-present { background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; }
    .kw-missing  { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }

    .detail-fb-grid { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
    .dfb-card { background:#f9fafb; border-radius:10px; padding:.8rem; }
    .dfb-strengths { border:1px solid #bbf7d0; }
    .dfb-improvements { border:1px solid #fde68a; }
    .dfb-list { margin:.35rem 0 0; padding:0 0 0 .8rem; list-style:none; display:flex; flex-direction:column; gap:.3rem; }
    .dfb-list li { font-size:.72rem; color:#374151; position:relative; line-height:1.5; }
    .dfb-strengths .dfb-list li::before { content:'✓'; position:absolute; left:-.8rem; color:#10b981; font-weight:900; }
    .dfb-improvements .dfb-list li::before { content:'→'; position:absolute; left:-.8rem; color:#d97706; font-weight:900; }

    .detail-jobs { }
    .jobs-wrap { display:flex; flex-wrap:wrap; gap:.35rem; }
    .job-tag { font-size:.7rem; font-weight:700; background:#f0fdfa; border:1px solid #99f6e4; color:#0f766e; padding:.2rem .55rem; border-radius:7px; }

    .detail-notes { }
    .notes-ta { width:100%; box-sizing:border-box; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:.6rem .8rem; font-size:.78rem; color:#111827; font-family:inherit; resize:vertical; outline:none; transition:.15s; }
    .notes-ta:focus { border-color:#0d9488; background:#fff; }
    .notes-ta::placeholder { color:#9ca3af; }

    .ws-detail-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.6rem; background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:2.5rem; text-align:center; }
    .de-icon { font-size:2rem; color:#d1d5db; }
    .de-text { font-size:.85rem; color:#374151; font-weight:600; margin:0; }
    .de-hint { font-size:.75rem; color:#9ca3af; margin:0; }

    .status-badge { font-size:.68rem; font-weight:700; padding:.18rem .5rem; border-radius:8px; }
    .sb-selected { background:#dcfce7; color:#15803d; }
    .sb-waiting  { background:#fef9c3; color:#854d0e; }
    .sb-rejected { background:#fef2f2; color:#dc2626; }
    .sb-favorite { background:#fef9c3; color:#b45309; }
    .sb-pending  { background:#f3f4f6; color:#6b7280; }
  `]
})
export class CvWorkspaceComponent implements OnInit {
  cvs: WorkspaceCv[] = [];
  detailCv: WorkspaceCv | null = null;
  filterText = '';
  filterStatus = '';
  compareList: WorkspaceCv[] = [];
  comparing = false;
  showModeSelector = false;

  sortKey: 'name' | 'score' | 'ats' | 'date' = 'date';
  sortDir: 1 | -1 = -1;

  constructor(
    private ws: CvWorkspaceService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.ws.loadFromApi();
    this.cvs = this.ws.cvs;
    if (!this.ws.mode) this.showModeSelector = true;
    this.cdr.detectChanges();
  }

  get filteredCvs(): WorkspaceCv[] {
    let list = [...this.cvs];
    if (this.filterText.trim()) {
      const q = this.filterText.toLowerCase();
      list = list.filter(c => c.fileName.toLowerCase().includes(q) || c.targetJob.toLowerCase().includes(q));
    }
    if (this.filterStatus) list = list.filter(c => c.status === this.filterStatus);
    list.sort((a, b) => {
      let va: any, vb: any;
      if (this.sortKey === 'name')  { va = a.fileName; vb = b.fileName; }
      if (this.sortKey === 'score') { va = a.globalScore; vb = b.globalScore; }
      if (this.sortKey === 'ats')   { va = a.atsPct; vb = b.atsPct; }
      if (this.sortKey === 'date')  { va = a.analyzedAt; vb = b.analyzedAt; }
      if (va < vb) return -1 * this.sortDir;
      if (va > vb) return  1 * this.sortDir;
      return 0;
    });
    return list;
  }

  get avgScore(): number {
    if (!this.cvs.length) return 0;
    return Math.round(this.cvs.reduce((s, c) => s + c.globalScore, 0) / this.cvs.length);
  }

  get bestScore(): number {
    return Math.max(...this.compareList.map(c => c.globalScore));
  }

  get modeLabel(): string {
    const m = this.ws.mode;
    if (m === 'recruiter') return '🏢 Recruteur';
    if (m === 'candidate') return '👤 Candidat';
    if (m === 'hr')        return '🏛️ RH Interne';
    return '🎯 Mode';
  }

  get modeIcon(): string { return ''; }

  countByStatus(s: string): number { return this.cvs.filter(c => c.status === s).length; }

  sort(key: 'name' | 'score' | 'ats' | 'date') {
    if (this.sortKey === key) this.sortDir = this.sortDir === 1 ? -1 : 1;
    else { this.sortKey = key; this.sortDir = key === 'date' ? -1 : 1; }
  }

  sortIcon(key: string): string {
    if (this.sortKey !== key) return '↕';
    return this.sortDir === 1 ? '↑' : '↓';
  }

  selectDetail(cv: WorkspaceCv) { this.detailCv = cv; }

  toggleCompare(cv: WorkspaceCv) {
    if (this.isInCompare(cv)) {
      this.compareList = this.compareList.filter(c => c.id !== cv.id);
    } else if (this.compareList.length < 4) {
      this.compareList = [...this.compareList, cv];
    }
  }

  isInCompare(cv: WorkspaceCv): boolean { return this.compareList.some(c => c.id === cv.id); }

  startCompare() { if (this.compareList.length >= 2) this.comparing = true; }

  onStatusChange(cv: WorkspaceCv) { this.ws.updateStatus(cv.id, cv.status); }

  saveNotes() {
    if (this.detailCv) this.ws.updateNotes(this.detailCv.id, this.detailCv.notes);
  }

  async deleteCv(id: string) {
    await this.ws.remove(id);
    this.cvs = this.ws.cvs;
    if (this.detailCv?.id === id) this.detailCv = null;
    this.compareList = this.compareList.filter(c => c.id !== id);
    this.cdr.detectChanges();
  }

  async clearAll() {
    if (!confirm('Supprimer tous les CV du workspace ?')) return;
    await this.ws.clear();
    this.cvs = [];
    this.detailCv = null;
    this.compareList = [];
    this.cdr.detectChanges();
  }

  async pickMode(m: WorkspaceMode) {
    await this.ws.setMode(m);
    this.showModeSelector = false;
    this.cdr.detectChanges();
  }

  goBack() { this.router.navigate(['/agentique/cv-analyzer']); }
  goAnalyze() { this.router.navigate(['/agentique/cv-analyzer']); }

  statusLabel(s: string): string {
    const map: Record<string,string> = { selected:'✅ Présélectionné', waiting:'🔄 À revoir', rejected:'❌ Refusé', favorite:'⭐ Favori', pending:'⏳ En attente' };
    return map[s] ?? s;
  }

  kwPresent(cv: WorkspaceCv): number { return cv.keywords.filter(k => k.present).length; }

  shortName(name: string): string {
    return name.length > 30 ? name.slice(0, 27) + '…' : name;
  }

  fmtDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }); }
    catch { return iso; }
  }

  fmtSize(b: number): string {
    if (b < 1024) return b + ' o';
    if (b < 1_048_576) return (b / 1024).toFixed(1) + ' Ko';
    return (b / 1_048_576).toFixed(1) + ' Mo';
  }

  exportCsv() {
    if (!this.cvs.length) return;
    const sep = ';';
    const headers = ['Fichier', 'Score', 'ATS%', 'Statut', 'Poste ciblé', 'Points forts', 'À améliorer', 'Mots-clés présents', 'Mots-clés manquants', 'Postes suggérés', 'Notes', 'Date'];
    const rows = this.cvs.map(cv => [
      cv.fileName,
      cv.globalScore,
      cv.atsPct,
      this.statusLabel(cv.status),
      cv.targetJob,
      '"' + cv.strengths.join(' | ') + '"',
      '"' + cv.improvements.join(' | ') + '"',
      '"' + cv.keywords.filter(k => k.present).map(k => k.word).join(', ') + '"',
      '"' + cv.keywords.filter(k => !k.present).map(k => k.word).join(', ') + '"',
      '"' + cv.suggestedJobs.join(', ') + '"',
      '"' + (cv.notes || '').replace(/"/g, '""') + '"',
      this.fmtDate(cv.analyzedAt),
    ].join(sep));
    const bom = '﻿';
    const blob = new Blob([bom + [headers.join(sep), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'workspace-ats.csv' }).click();
    URL.revokeObjectURL(url);
  }

  exportPdf() {
    if (!this.detailCv) return;
    const cv = this.detailCv;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,sans-serif;color:#111;margin:40px;font-size:12px}
      h1{font-size:18px;margin:0 0 4px}
      .sub{color:#666;font-size:11px;margin:0 0 20px}
      .score-row{display:flex;gap:30px;margin-bottom:20px}
      .score-box{background:#f5f5f5;border-radius:8px;padding:12px 20px;text-align:center}
      .score-big{font-size:28px;font-weight:900;color:#0d9488}
      .label{font-size:10px;color:#666;display:block}
      h2{font-size:13px;font-weight:700;color:#333;border-bottom:1px solid #eee;padding-bottom:4px;margin:16px 0 8px}
      .sec{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f5f5f5}
      .kw-row{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px}
      .kw{font-size:10px;padding:2px 6px;border-radius:4px}
      .kw-ok{background:#d1fae5;color:#065f46} .kw-no{background:#fee2e2;color:#991b1b}
      ul{margin:4px 0;padding-left:16px} li{margin-bottom:3px}
      .note{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px;font-style:italic}
    </style></head><body>
      <h1>Rapport d'analyse CV — ${cv.fileName}</h1>
      <p class="sub">Généré le ${this.fmtDate(new Date().toISOString())} · Poste ciblé : ${cv.targetJob || 'Non renseigné'}</p>
      <div class="score-row">
        <div class="score-box"><div class="score-big">${cv.globalScore}/100</div><span class="label">Score global</span></div>
        <div class="score-box"><div class="score-big">${cv.atsPct}%</div><span class="label">Compatibilité ATS</span></div>
        <div class="score-box"><div class="score-big">${this.statusLabel(cv.status)}</div><span class="label">Statut</span></div>
      </div>
      <h2>Analyse par section</h2>
      ${cv.sections.map(s => `<div class="sec"><span>${s.icon} ${s.title}</span><strong>${s.score}/100</strong></div>`).join('')}
      <h2>Mots-clés ATS</h2>
      <div class="kw-row">${cv.keywords.map(k => `<span class="kw ${k.present ? 'kw-ok' : 'kw-no'}">${k.present ? '✓' : '✗'} ${k.word}</span>`).join('')}</div>
      <h2>Points forts</h2><ul>${cv.strengths.map(s => `<li>${s}</li>`).join('')}</ul>
      <h2>Points à améliorer</h2><ul>${cv.improvements.map(i => `<li>${i}</li>`).join('')}</ul>
      <h2>Postes suggérés</h2><p>${cv.suggestedJobs.join(' · ')}</p>
      ${cv.notes ? `<h2>Notes</h2><div class="note">${cv.notes}</div>` : ''}
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    setTimeout(() => { win?.print(); URL.revokeObjectURL(url); }, 800);
  }
}
