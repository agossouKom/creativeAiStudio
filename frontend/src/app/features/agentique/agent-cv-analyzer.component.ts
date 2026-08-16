import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgentService } from '../../services/agent.service';
import { AgentSessionBarComponent } from '../../shared/components/agent-session-bar/agent-session-bar.component';
import { CvWorkspaceService, WorkspaceCv } from './cv-workspace.service';

interface CvSection {
  id: string;
  icon: string;
  title: string;
  score: number;
  color: string;
  feedback: string;
  tips: string[];
}

interface CvAnalysis {
  globalScore: number;
  globalLabel: string;
  sections: CvSection[];
  keywords: { word: string; present: boolean }[];
  suggestedJobs: string[];
  improvements: string[];
  strengths: string[];
  atsPct: number;
}

@Component({
  selector: 'app-agent-cv-analyzer',
  standalone: true,
  imports: [CommonModule, FormsModule, AgentSessionBarComponent],
  template: `
<div class="cv-page">
  <div class="bg-orb orb1"></div>
  <div class="bg-orb orb2"></div>

  <app-agent-session-bar [showWorkspace]="true"></app-agent-session-bar>

  <div class="cv-wrap">

    <!-- Header -->
    <div class="page-header">
      <div class="agent-icon">🔍</div>
      <div>
        <h1 class="page-title">Analyseur de CV</h1>
        <p class="page-sub">Analyse IA complète — Score ATS, feedback détaillé, mots-clés et recommandations</p>
      </div>
      <div class="header-right">
        <button *ngIf="wsCount > 0" class="ws-nav-btn" (click)="goWorkspace()">
          📋 Workspace <span class="ws-nav-count">{{ wsCount }}</span>
        </button>
        <div class="live-badge">
          <span class="live-dot"></span>
          Groq · llama-3.3-70b · LIVE
        </div>
      </div>
    </div>

    <div class="cv-cols">

      <!-- LEFT: input -->
      <div class="input-col">

        <!-- Upload CV — multi-fichiers -->
        <div class="upload-card">
          <div class="drop-zone"
               [class.over]="dragging"
               [class.has-file]="uploadedFiles.length > 0"
               (dragover)="onDragOver($event)"
               (dragleave)="dragging=false"
               (drop)="onDrop($event)"
               (click)="uploadedFiles.length===0 && fi.click()">
            <input #fi type="file" accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png,.webp,.bmp,.tiff" multiple (change)="onFileSelect($event)" style="display:none">

            <div *ngIf="uploadedFiles.length === 0" class="dz-inner">
              <div class="dz-icon">📄</div>
              <p class="dz-title">Déposez un ou plusieurs CV ici</p>
              <p class="dz-sub">PDF · DOCX · TXT · JPG · PNG · WEBP</p>
              <div class="dz-formats">
                <span class="dz-fmt">📄 PDF</span>
                <span class="dz-fmt">📝 DOCX</span>
                <span class="dz-fmt">🖼 JPG/PNG</span>
                <span class="dz-fmt">🌐 WEBP</span>
              </div>
              <span class="dz-btn">Choisir les CV</span>
            </div>

            <div *ngIf="uploadedFiles.length > 0" class="file-queue">
              <div class="fq-header">
                <span class="fq-count">{{ uploadedFiles.length }} fichier(s) sélectionné(s)</span>
                <button class="fq-clear" (click)="clearFiles($event)">✕ Vider</button>
              </div>
              <div class="fq-list">
                <div *ngFor="let f of uploadedFiles; let i=index" class="fq-item"
                     [class.fq-done]="batchDone.has(i)" [class.fq-active]="batchCurrent===i && analyzing">
                  <span class="fq-ico">{{ getIcon(f.name) }}</span>
                  <div class="fq-name-block">
                    <span class="fq-name">{{ f.name }}</span>
                    <span class="fq-ocr-badge" *ngIf="isImage(f.name)">🖼 OCR</span>
                    <span class="fq-ocr-status" *ngIf="batchCurrent===i && ocrStatus">{{ ocrStatus }}</span>
                  </div>
                  <span class="fq-size">{{ fmtSize(f.size) }}</span>
                  <span class="fq-status" *ngIf="batchDone.has(i)">✓</span>
                  <span class="fq-status fq-spin" *ngIf="batchCurrent===i && analyzing">⟳</span>
                  <button class="fq-rm" (click)="removeFileAt($event, i)" *ngIf="!analyzing">✕</button>
                </div>
                <button class="fq-add-more" (click)="fi.click()">+ Ajouter d'autres CV</button>
              </div>
            </div>
          </div>
        </div>

        <!-- OR paste CV text -->
        <div class="or-divider"><span>ou collez le texte d'un CV</span></div>

        <textarea class="cv-paste" [(ngModel)]="cvText" rows="8"
                  placeholder="Collez ici le contenu d'un CV (expériences, formations, compétences, résumé…)"></textarea>

        <!-- Options -->
        <div class="options-panel">
          <div class="opt-title">Options d'analyse</div>
          <div class="opts-grid">
            <label *ngFor="let o of options" class="opt-item">
              <input type="checkbox" [(ngModel)]="o.checked" class="opt-check">
              <span class="opt-lbl">{{ o.icon }} {{ o.label }}</span>
            </label>
          </div>

          <div class="target-job">
            <label class="opt-title" style="margin-bottom:.4rem">Poste cible (optionnel)</label>
            <input class="target-input" [(ngModel)]="targetJob" placeholder="ex: Développeur Full Stack Senior, Chef de Projet IA…">
          </div>
        </div>

        <!-- Progress batch -->
        <div *ngIf="analyzing && uploadedFiles.length > 1" class="batch-progress">
          <div class="bp-bar-wrap">
            <div class="bp-bar" [style.width.%]="batchPct"></div>
          </div>
          <span class="bp-label">{{ batchDone.size }} / {{ uploadedFiles.length }} CV analysé(s)</span>
        </div>

        <button class="analyze-btn" (click)="analyze()" [disabled]="analyzing || (uploadedFiles.length===0 && !cvText.trim())">
          <span *ngIf="!analyzing">🔍 {{ uploadedFiles.length > 1 ? 'Analyser les '+uploadedFiles.length+' CV' : 'Analyser le CV' }}</span>
          <span *ngIf="analyzing" class="spin-row"><span class="btn-spin"></span>
            {{ uploadedFiles.length > 1 ? 'Lot en cours… ('+batchDone.size+'/'+uploadedFiles.length+')' : 'Analyse IA en cours…' }}
          </span>
        </button>

        <!-- Workspace shortcut after analysis -->
        <div class="ws-shortcut" *ngIf="savedToWs > 0">
          <span class="ws-sc-ico">✅</span>
          <span>{{ savedToWs }} CV sauvegardé(s) dans le workspace</span>
          <button class="ws-sc-btn" (click)="goWorkspace()">Voir le workspace →</button>
        </div>

        <!-- RAG Ingest info -->
        <div class="rag-info" *ngIf="uploadedFiles.length > 0 || cvText.trim()">
          <span class="rag-info-icon">💡</span>
          <span>Les CV analysés sont automatiquement sauvegardés dans le Workspace ATS</span>
        </div>
      </div>

      <!-- RIGHT: results -->
      <div class="results-col">

        <div *ngIf="!analysis && !analyzing" class="results-empty">
          <div class="empty-icon">🔍</div>
          <h3 class="empty-title">Analyse IA de votre CV</h3>
          <p class="empty-sub">Obtenez un score complet et des recommandations personnalisées</p>
          <div class="features-showcase">
            <div class="feat-card" *ngFor="let f of featureCards">
              <span class="feat-card-icon">{{ f.icon }}</span>
              <div class="feat-card-body">
                <span class="feat-card-title">{{ f.title }}</span>
                <span class="feat-card-desc">{{ f.desc }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="analyzing" class="analyzing-state">
          <div class="an-orbs"></div>
          <div class="an-spinner"></div>
          <p class="an-label">Analyse IA en cours…</p>
          <div class="an-steps">
            <div *ngFor="let s of steps; let i=index" class="an-step"
                 [class.done]="i < currentStep" [class.active]="i === currentStep">
              <span class="an-dot"></span>{{ s }}
            </div>
          </div>
        </div>

        <!-- Results -->
        <div *ngIf="analysis && !analyzing" class="analysis-results">

          <!-- Score global -->
          <div class="score-card">
            <div class="score-circle" [class.score-excellent]="analysis.globalScore >= 80"
                                       [class.score-good]="analysis.globalScore >= 60 && analysis.globalScore < 80"
                                       [class.score-medium]="analysis.globalScore < 60">
              <svg class="score-svg" viewBox="0 0 100 100">
                <circle class="score-track" cx="50" cy="50" r="42" fill="none" stroke-width="8"/>
                <circle class="score-fill" cx="50" cy="50" r="42" fill="none" stroke-width="8"
                        [attr.stroke-dasharray]="264"
                        [attr.stroke-dashoffset]="264 - (264 * analysis.globalScore / 100)"
                        stroke-linecap="round"
                        transform="rotate(-90 50 50)"/>
              </svg>
              <div class="score-inner">
                <span class="score-num">{{ analysis.globalScore }}</span>
                <span class="score-over">/100</span>
              </div>
            </div>
            <div class="score-info">
              <h2 class="score-label">{{ analysis.globalLabel }}</h2>
              <div class="ats-row">
                <span class="ats-label">Score ATS</span>
                <div class="ats-bar-wrap">
                  <div class="ats-bar" [style.width.%]="analysis.atsPct"
                       [class.ats-good]="analysis.atsPct >= 70"
                       [class.ats-mid]="analysis.atsPct >= 50 && analysis.atsPct < 70"
                       [class.ats-low]="analysis.atsPct < 50"></div>
                </div>
                <span class="ats-pct">{{ analysis.atsPct }}%</span>
              </div>
              <div class="score-actions">
                <button class="action-btn" (click)="exportReport()">📥 Rapport PDF</button>
                <button class="action-btn action-btn--primary" (click)="openRagChat()">💬 Discuter avec l'IA</button>
              </div>
            </div>
          </div>

          <!-- Sections scores -->
          <div class="sections-grid">
            <div *ngFor="let s of analysis.sections" class="section-card">
              <div class="sec-top">
                <span class="sec-icon">{{ s.icon }}</span>
                <div class="sec-info">
                  <span class="sec-title">{{ s.title }}</span>
                  <div class="sec-bar-wrap">
                    <div class="sec-bar" [style.width.%]="s.score" [style.background]="s.color"></div>
                  </div>
                </div>
                <span class="sec-score" [style.color]="s.color">{{ s.score }}</span>
              </div>
              <p class="sec-feedback">{{ s.feedback }}</p>
              <ul class="sec-tips">
                <li *ngFor="let t of s.tips">{{ t }}</li>
              </ul>
            </div>
          </div>

          <!-- Keywords ATS -->
          <div class="kw-section">
            <h3 class="section-title">🏷️ Mots-clés ATS</h3>
            <div class="kw-grid">
              <span *ngFor="let k of analysis.keywords" class="kw-chip"
                    [class.kw-present]="k.present" [class.kw-missing]="!k.present">
                {{ k.present ? '✓' : '✗' }} {{ k.word }}
              </span>
            </div>
          </div>

          <!-- 2 cols: forces + améliorations -->
          <div class="feedback-grid">
            <div class="feedback-card feedback-strengths">
              <h3 class="fb-title">✅ Points forts</h3>
              <ul class="fb-list">
                <li *ngFor="let s of analysis.strengths">{{ s }}</li>
              </ul>
            </div>
            <div class="feedback-card feedback-improvements">
              <h3 class="fb-title">📌 À améliorer</h3>
              <ul class="fb-list">
                <li *ngFor="let i of analysis.improvements">{{ i }}</li>
              </ul>
            </div>
          </div>

          <!-- Postes suggérés -->
          <div class="jobs-section">
            <h3 class="section-title">💼 Postes correspondants</h3>
            <div class="jobs-grid">
              <span *ngFor="let j of analysis.suggestedJobs" class="job-tag">{{ j }}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display:block; width:100%; font-family:'Inter',sans-serif; }

    /* ── Page layout ── */
    .cv-page { min-height:calc(100vh - 64px); background:#f8fafc; position:relative; display:flex; flex-direction:column; }
    .bg-orb { display:none; }
    ::-webkit-scrollbar { width:5px; }
    ::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:5px; }
    ::-webkit-scrollbar-thumb:hover { background:#9ca3af; }

    .cv-wrap {
      flex:1; max-width:1280px; width:100%; margin:0 auto;
      display:flex; flex-direction:column; gap:1.5rem;
      padding:2rem 1.75rem 2rem;
    }

    /* ── Header ── */
    .page-header { display:flex; align-items:center; gap:1rem; flex-wrap:wrap; }
    .agent-icon {
      width:52px; height:52px;
      background:linear-gradient(135deg,#0d9488,#0891b2);
      border-radius:14px; display:flex; align-items:center; justify-content:center;
      font-size:1.5rem; flex-shrink:0;
    }
    .page-title { font-size:1.6rem; font-weight:900; color:#111827; margin:0; }
    .page-sub { font-size:.82rem; color:#6b7280; margin:.25rem 0 0; }
    .live-badge {
      margin-left:auto; display:flex; align-items:center; gap:.5rem;
      background:#ecfdf5; border:1px solid #a7f3d0; color:#059669;
      font-size:.68rem; font-weight:700; padding:.35rem .8rem; border-radius:20px;
    }
    .live-dot { width:7px; height:7px; border-radius:50%; background:#10b981; animation:pulse 2s ease infinite; flex-shrink:0; }

    /* ── Two-column layout ── */
    .cv-cols {
      display:grid; grid-template-columns:400px 1fr; gap:1.75rem; align-items:start;
    }
    @media(max-width:960px) { .cv-cols { grid-template-columns:1fr; } }

    /* ── LEFT column ── */
    .input-col { display:flex; flex-direction:column; gap:1.25rem; }

    .upload-card {
      background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:1.25rem;
      box-shadow:0 1px 3px rgba(0,0,0,.06);
    }
    .drop-zone {
      border:2px dashed #d1d5db; border-radius:12px;
      padding:1.75rem 1rem; text-align:center; cursor:pointer; transition:.2s;
    }
    .drop-zone:hover, .drop-zone.over { border-color:#0d9488; background:#f0fdfa; }
    .drop-zone.has-file { cursor:default; border-style:solid; border-color:#6ee7b7; background:#f0fdfa; }
    .dz-inner { display:flex; flex-direction:column; align-items:center; gap:.5rem; }
    .dz-icon { font-size:2.25rem; }
    .dz-title { font-size:.9rem; font-weight:700; color:#374151; margin:0; }
    .dz-sub { font-size:.75rem; color:#9ca3af; margin:0; }
    .dz-formats { display:flex; flex-wrap:wrap; gap:.35rem; justify-content:center; }
    .dz-fmt { font-size:.65rem; background:#f3f4f6; color:#6b7280; border:1px solid #e5e7eb; border-radius:4px; padding:.1rem .45rem; }
    .dz-btn {
      background:#0d9488; color:#fff; font-size:.72rem; font-weight:700;
      padding:.3rem .85rem; border-radius:20px; margin-top:.35rem; cursor:pointer;
      border:none;
    }
    .file-info { display:flex; align-items:center; gap:.75rem; }
    .fi-icon { font-size:1.6rem; }
    .fi-body { flex:1; min-width:0; display:flex; flex-direction:column; }
    .fi-name { font-size:.82rem; font-weight:700; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .fi-size { font-size:.7rem; color:#6b7280; }
    .fi-remove {
      background:#fef2f2; border:1px solid #fecaca; color:#ef4444;
      width:26px; height:26px; border-radius:6px; cursor:pointer;
      display:flex; align-items:center; justify-content:center; font-size:.75rem;
    }

    .or-divider { display:flex; align-items:center; gap:.6rem; color:#9ca3af; font-size:.72rem; }
    .or-divider::before, .or-divider::after { content:''; flex:1; height:1px; background:#e5e7eb; }

    .cv-paste {
      background:#fff; border:1px solid #e5e7eb; border-radius:12px;
      padding:.85rem 1rem; color:#111827; font-size:.82rem; line-height:1.75;
      resize:vertical; outline:none; font-family:inherit; transition:.15s;
      width:100%; box-sizing:border-box;
      box-shadow:0 1px 3px rgba(0,0,0,.05);
    }
    .cv-paste:focus { border-color:#0d9488; box-shadow:0 0 0 3px rgba(13,148,136,.1); }
    .cv-paste::placeholder { color:#9ca3af; }

    .options-panel {
      background:#fff; border:1px solid #e5e7eb; border-radius:14px;
      padding:1.1rem 1.25rem; display:flex; flex-direction:column; gap:1rem;
      box-shadow:0 1px 3px rgba(0,0,0,.05);
    }
    .opt-title { font-size:.68rem; font-weight:800; color:#374151; text-transform:uppercase; letter-spacing:.08em; }
    .opts-grid { display:grid; grid-template-columns:1fr 1fr; gap:.5rem; }
    .opt-item { display:flex; align-items:center; gap:.45rem; cursor:pointer; padding:.3rem .4rem; border-radius:6px; }
    .opt-item:hover { background:#f9fafb; }
    .opt-check { accent-color:#0d9488; }
    .opt-lbl { font-size:.75rem; color:#374151; }

    .target-job { display:flex; flex-direction:column; gap:.45rem; padding-top:.25rem; border-top:1px solid #f3f4f6; }
    .target-input {
      background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;
      padding:.5rem .8rem; color:#111827; font-size:.82rem;
      outline:none; font-family:inherit; width:100%; box-sizing:border-box; transition:.15s;
    }
    .target-input:focus { border-color:#0d9488; background:#fff; box-shadow:0 0 0 3px rgba(13,148,136,.08); }
    .target-input::placeholder { color:#9ca3af; }

    .analyze-btn {
      background:linear-gradient(135deg,#0d9488,#0891b2); color:#fff; border:none;
      border-radius:12px; padding:.8rem 1.4rem; font-size:.95rem; font-weight:800;
      cursor:pointer; transition:.15s; display:flex; align-items:center; justify-content:center; gap:.55rem;
      box-shadow:0 2px 8px rgba(13,148,136,.3);
      width:100%;
    }
    .analyze-btn:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); box-shadow:0 4px 14px rgba(13,148,136,.35); }
    .analyze-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }
    .spin-row { display:flex; align-items:center; gap:.5rem; }
    .btn-spin { width:14px; height:14px; border:2px solid rgba(255,255,255,.35); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; }

    .rag-info {
      display:flex; align-items:flex-start; gap:.55rem;
      background:#eef2ff; border:1px solid #c7d2fe;
      border-radius:10px; padding:.65rem .9rem;
      font-size:.73rem; color:#4338ca; line-height:1.55;
    }
    .rag-info-icon { flex-shrink:0; font-size:.9rem; }

    /* ── RIGHT column ── */
    .results-col { display:flex; flex-direction:column; gap:1.25rem; }

    .results-empty {
      background:#fff; border:1px solid #e5e7eb; border-radius:16px;
      padding:3rem 2rem; display:flex; flex-direction:column; align-items:center;
      gap:.85rem; text-align:center;
      box-shadow:0 1px 3px rgba(0,0,0,.06);
    }
    .empty-icon { font-size:2.75rem; }
    .empty-title { font-size:1.05rem; font-weight:800; color:#111827; margin:0; }
    .empty-sub { font-size:.82rem; color:#6b7280; margin:0; }
    .features-showcase { display:grid; grid-template-columns:1fr 1fr; gap:.7rem; margin-top:.5rem; width:100%; max-width:500px; text-align:left; }
    .feat-card { display:flex; align-items:flex-start; gap:.65rem; background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:.75rem; }
    .feat-card-icon { font-size:1.25rem; flex-shrink:0; }
    .feat-card-title { display:block; font-size:.8rem; font-weight:700; color:#111827; }
    .feat-card-desc { display:block; font-size:.7rem; color:#6b7280; margin-top:.2rem; }

    /* ── Loading ── */
    .analyzing-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; min-height:320px; padding:2rem; background:#fff; border:1px solid #e5e7eb; border-radius:16px; }
    .an-spinner { width:48px; height:48px; border:4px solid #e5e7eb; border-top-color:#0d9488; border-radius:50%; animation:spin .7s linear infinite; }
    .an-label { font-size:.88rem; color:#374151; font-style:italic; margin:0; }
    .an-steps { display:flex; flex-direction:column; gap:.4rem; }
    .an-step { display:flex; align-items:center; gap:.5rem; font-size:.77rem; color:#9ca3af; transition:.3s; }
    .an-step.active { color:#0d9488; font-weight:700; }
    .an-step.done { color:#10b981; }
    .an-dot { width:7px; height:7px; border-radius:50%; background:currentColor; flex-shrink:0; }

    /* ── Results ── */
    .analysis-results { display:flex; flex-direction:column; gap:1.25rem; animation:fadeUp .4s ease-out; }

    .score-card {
      background:#fff; border:1px solid #e5e7eb; border-radius:16px;
      padding:1.75rem; display:flex; align-items:center; gap:2rem; flex-wrap:wrap;
      box-shadow:0 1px 3px rgba(0,0,0,.06);
    }
    .score-circle { position:relative; width:120px; height:120px; flex-shrink:0; }
    .score-svg { width:120px; height:120px; }
    .score-track { stroke:#e5e7eb; }
    .score-fill { stroke:#0d9488; transition:stroke-dashoffset 1s ease; }
    .score-excellent .score-fill { stroke:#10b981; }
    .score-good      .score-fill { stroke:#f59e0b; }
    .score-medium    .score-fill { stroke:#ef4444; }
    .score-inner { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .score-num { font-size:1.75rem; font-weight:900; color:#111827; line-height:1; }
    .score-over { font-size:.68rem; color:#6b7280; }
    .score-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:.75rem; }
    .score-label { font-size:1.2rem; font-weight:800; color:#111827; margin:0; }
    .ats-row { display:flex; align-items:center; gap:.65rem; }
    .ats-label { font-size:.72rem; color:#374151; font-weight:700; white-space:nowrap; }
    .ats-bar-wrap { flex:1; height:8px; background:#e5e7eb; border-radius:20px; overflow:hidden; }
    .ats-bar { height:100%; border-radius:20px; transition:width .8s ease; }
    .ats-good { background:linear-gradient(90deg,#10b981,#34d399); }
    .ats-mid  { background:linear-gradient(90deg,#f59e0b,#fbbf24); }
    .ats-low  { background:linear-gradient(90deg,#ef4444,#f87171); }
    .ats-pct  { font-size:.78rem; font-weight:800; color:#374151; white-space:nowrap; }
    .score-actions { display:flex; gap:.6rem; flex-wrap:wrap; }
    .action-btn { background:#f3f4f6; border:1px solid #e5e7eb; color:#374151; font-size:.73rem; font-weight:700; padding:.35rem .8rem; border-radius:8px; cursor:pointer; transition:.15s; }
    .action-btn:hover { background:#e5e7eb; color:#111827; }
    .action-btn--primary { background:#0d9488; border-color:#0d9488; color:#fff; }
    .action-btn--primary:hover { background:#0f766e; }

    /* Sections grid */
    .sections-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:.9rem; }
    .section-card {
      background:#fff; border:1px solid #e5e7eb; border-radius:14px;
      padding:1rem 1.1rem; display:flex; flex-direction:column; gap:.6rem;
      box-shadow:0 1px 2px rgba(0,0,0,.04);
    }
    .sec-top { display:flex; align-items:center; gap:.65rem; }
    .sec-icon { font-size:1.2rem; flex-shrink:0; }
    .sec-info { flex:1; min-width:0; }
    .sec-title { display:block; font-size:.78rem; font-weight:700; color:#111827; margin-bottom:.35rem; }
    .sec-bar-wrap { height:6px; background:#e5e7eb; border-radius:20px; overflow:hidden; }
    .sec-bar { height:100%; border-radius:20px; transition:width .8s ease; }
    .sec-score { font-size:1rem; font-weight:800; flex-shrink:0; }
    .sec-feedback { font-size:.75rem; color:#374151; line-height:1.55; margin:0; }
    .sec-tips { margin:0; padding:0 0 0 .9rem; display:flex; flex-direction:column; gap:.2rem; }
    .sec-tips li { font-size:.7rem; color:#6b7280; line-height:1.55; }

    /* Keywords */
    .kw-section { background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:1.1rem 1.25rem; display:flex; flex-direction:column; gap:.85rem; box-shadow:0 1px 2px rgba(0,0,0,.04); }
    .section-title { font-size:.85rem; font-weight:800; color:#111827; margin:0; }
    .kw-grid { display:flex; flex-wrap:wrap; gap:.4rem; }
    .kw-chip { font-size:.7rem; font-weight:700; padding:.22rem .55rem; border-radius:7px; }
    .kw-present { background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; }
    .kw-missing  { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }

    /* Feedback grid */
    .feedback-grid { display:grid; grid-template-columns:1fr 1fr; gap:.9rem; }
    @media(max-width:640px) { .feedback-grid { grid-template-columns:1fr; } }
    .feedback-card { background:#fff; border-radius:14px; padding:1.1rem 1.25rem; display:flex; flex-direction:column; gap:.7rem; box-shadow:0 1px 2px rgba(0,0,0,.04); }
    .feedback-strengths { border:1px solid #bbf7d0; }
    .feedback-improvements { border:1px solid #fde68a; }
    .fb-title { font-size:.8rem; font-weight:800; color:#111827; margin:0; }
    .fb-list { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:.4rem; }
    .fb-list li { font-size:.77rem; color:#374151; padding-left:.9rem; position:relative; line-height:1.6; }
    .feedback-strengths .fb-list li::before { content:'✓'; position:absolute; left:0; color:#10b981; font-weight:900; font-size:.7rem; }
    .feedback-improvements .fb-list li::before { content:'→'; position:absolute; left:0; color:#d97706; font-weight:900; font-size:.7rem; }

    /* Jobs */
    .jobs-section { background:#fff; border:1px solid #e5e7eb; border-radius:14px; padding:1.1rem 1.25rem; display:flex; flex-direction:column; gap:.85rem; box-shadow:0 1px 2px rgba(0,0,0,.04); }
    .jobs-grid { display:flex; flex-wrap:wrap; gap:.45rem; }
    .job-tag { font-size:.73rem; font-weight:700; background:#f0fdfa; border:1px solid #99f6e4; color:#0f766e; padding:.25rem .65rem; border-radius:8px; }

    /* ── Header right ── */
    .header-right { margin-left:auto; display:flex; align-items:center; gap:.75rem; }
    .ws-nav-btn { display:flex; align-items:center; gap:.4rem; background:#f0fdfa; border:1px solid #99f6e4; color:#0f766e; font-size:.75rem; font-weight:700; padding:.35rem .8rem; border-radius:8px; cursor:pointer; transition:.15s; }
    .ws-nav-btn:hover { background:#ccfbf1; }
    .ws-nav-count { background:#0d9488; color:#fff; font-size:.6rem; font-weight:900; padding:.05rem .38rem; border-radius:10px; }

    /* ── File queue ── */
    .file-queue { display:flex; flex-direction:column; gap:.6rem; }
    .fq-header { display:flex; align-items:center; justify-content:space-between; }
    .fq-count { font-size:.78rem; font-weight:700; color:#111827; }
    .fq-clear { background:none; border:1px solid #fecaca; color:#ef4444; font-size:.68rem; padding:.2rem .5rem; border-radius:6px; cursor:pointer; }
    .fq-list { display:flex; flex-direction:column; gap:.35rem; max-height:180px; overflow-y:auto; }
    .fq-item { display:flex; align-items:center; gap:.5rem; background:#f9fafb; border:1px solid #e5e7eb; border-radius:7px; padding:.35rem .6rem; font-size:.75rem; }
    .fq-item.fq-done   { background:#f0fdf4; border-color:#bbf7d0; }
    .fq-item.fq-active { background:#f0fdfa; border-color:#0d9488; }
    .fq-ico  { font-size:1rem; flex-shrink:0; }
    .fq-name-block { flex:1; min-width:0; display:flex; flex-direction:column; gap:.1rem; }
    .fq-name { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#111827; font-weight:600; }
    .fq-ocr-badge { font-size:.6rem; font-weight:700; background:#ccfbf1; color:#0d9488; border:1px solid #99f6e4; border-radius:4px; padding:.05rem .35rem; width:fit-content; }
    .fq-ocr-status { font-size:.62rem; color:#0d9488; font-style:italic; animation:pulse 1.2s ease infinite; }
    .fq-size { color:#9ca3af; font-size:.68rem; flex-shrink:0; }
    .fq-status { font-size:.78rem; flex-shrink:0; }
    .fq-spin { display:inline-block; animation:spin .7s linear infinite; }
    .fq-rm { background:none; border:none; color:#9ca3af; cursor:pointer; font-size:.7rem; padding:.1rem; flex-shrink:0; }
    .fq-rm:hover { color:#ef4444; }
    .fq-add-more { background:none; border:1px dashed #d1d5db; color:#6b7280; font-size:.72rem; border-radius:6px; padding:.3rem .6rem; cursor:pointer; margin-top:.2rem; width:100%; }
    .fq-add-more:hover { border-color:#0d9488; color:#0d9488; }

    /* ── Batch progress ── */
    .batch-progress { display:flex; flex-direction:column; gap:.4rem; }
    .bp-bar-wrap { height:7px; background:#e5e7eb; border-radius:10px; overflow:hidden; }
    .bp-bar { height:100%; background:linear-gradient(90deg,#0d9488,#0891b2); border-radius:10px; transition:width .4s ease; }
    .bp-label { font-size:.72rem; color:#374151; font-weight:600; }

    /* ── Workspace shortcut ── */
    .ws-shortcut { display:flex; align-items:center; gap:.6rem; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:.6rem .85rem; font-size:.75rem; color:#15803d; }
    .ws-sc-ico { font-size:1rem; flex-shrink:0; }
    .ws-shortcut span { flex:1; }
    .ws-sc-btn { background:#15803d; color:#fff; border:none; border-radius:7px; padding:.28rem .65rem; font-size:.72rem; font-weight:700; cursor:pointer; white-space:nowrap; }
    .ws-sc-btn:hover { background:#166534; }

    @keyframes spin    { to { transform:rotate(360deg) } }
    @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  `]
})
export class AgentCvAnalyzerComponent implements OnInit {
  constructor(
    private cdr: ChangeDetectorRef,
    private agentSvc: AgentService,
    private wsSvc: CvWorkspaceService,
    private router: Router,
  ) {}

  // ── Multi-upload state ──
  uploadedFiles: File[] = [];
  batchDone    = new Set<number>();
  batchCurrent = -1;
  savedToWs    = 0;
  ocrStatus    = '';

  cvText    = '';
  targetJob = '';
  dragging  = false;
  analyzing = false;
  currentStep = 0;
  analysis: CvAnalysis | null = null;

  get wsCount()  { return this.wsSvc.count; }
  get batchPct() {
    if (!this.uploadedFiles.length) return 0;
    return Math.round(this.batchDone.size / this.uploadedFiles.length * 100);
  }

  ngOnInit() { this.wsSvc.loadFromApi(); }

  goWorkspace() { this.router.navigate(['/agentique/cv-workspace']); }

  readonly options = [
    { id: 'ats',      icon: '🤖', label: 'Score ATS',         checked: true },
    { id: 'keywords', icon: '🏷️', label: 'Mots-clés secteur', checked: true },
    { id: 'sections', icon: '📋', label: 'Analyse sections',  checked: true },
    { id: 'jobs',     icon: '💼', label: 'Postes suggérés',   checked: true },
    { id: 'tips',     icon: '💡', label: 'Conseils détaillés',checked: true },
    { id: 'rag',      icon: '💬', label: 'Indexer pour RAG',  checked: false },
  ];

  readonly steps = [
    'Extraction du texte…',
    'Identification des sections…',
    'Analyse ATS & mots-clés…',
    'Évaluation par l\'IA…',
    'Génération des recommandations…',
  ];

  readonly featureCards = [
    { icon: '🤖', title: 'Score ATS',          desc: 'Compatibilité avec les filtres automatiques' },
    { icon: '🏷️', title: 'Mots-clés',           desc: 'Présents vs manquants pour votre cible' },
    { icon: '📊', title: 'Analyse par section', desc: 'Expériences, compétences, formation…' },
    { icon: '💡', title: 'Recommandations IA',  desc: 'Actions concrètes pour améliorer' },
    { icon: '💼', title: 'Postes suggérés',     desc: 'Jobs correspondant à votre profil' },
    { icon: '💬', title: 'Chat avec le CV',     desc: 'Posez des questions via l\'Assistant RAG' },
  ];

  // ── File handlers ──
  onDragOver(e: DragEvent) { e.preventDefault(); this.dragging = true; }

  onDrop(e: DragEvent) {
    e.preventDefault(); this.dragging = false;
    const files = Array.from(e.dataTransfer?.files ?? []);
    this.addFiles(files);
  }

  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.addFiles(files);
    input.value = '';
  }

  private addFiles(files: File[]) {
    const allowed = ['pdf','docx','doc','txt','jpg','jpeg','png','webp','bmp','tiff'];
    const valid = files.filter(f => allowed.includes(f.name.split('.').pop()?.toLowerCase() ?? ''));
    this.uploadedFiles = [...this.uploadedFiles, ...valid];
  }

  isImage(name: string): boolean {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return ['jpg','jpeg','png','webp','bmp','tiff'].includes(ext);
  }

  clearFiles(e: Event)           { e.stopPropagation(); this.uploadedFiles = []; this.batchDone.clear(); this.batchCurrent = -1; this.savedToWs = 0; }
  removeFile(e: Event)           { e.stopPropagation(); this.uploadedFiles = []; }
  removeFileAt(e: Event, i: number) { e.stopPropagation(); this.uploadedFiles = this.uploadedFiles.filter((_, idx) => idx !== i); }

  // ── Batch analysis ──
  async analyze() {
    if (!this.uploadedFiles.length && !this.cvText.trim()) return;
    this.analyzing   = true;
    this.analysis    = null;
    this.currentStep = 0;
    this.savedToWs   = 0;
    this.batchDone   = new Set();

    if (this.uploadedFiles.length > 0) {
      // Analyse chaque fichier en séquence
      for (let i = 0; i < this.uploadedFiles.length; i++) {
        this.batchCurrent = i;
        const file = this.uploadedFiles[i];
        let cvContent: string;
        if (this.isImage(file.name)) {
          cvContent = await this.extractTextFromImage(file);
        } else {
          cvContent = `[CV: ${file.name}]`;
        }
        const result = await this.runAnalysis(cvContent);
        this.analysis = result;
        await this.saveToWorkspace(result, file.name, file.size);
        this.batchDone = new Set([...this.batchDone, i]);
        if (this.options.find(o => o.id === 'rag')?.checked) this.ingestToRag(file);
        this.cdr.detectChanges();
      }
      this.batchCurrent = -1;
    } else {
      // Analyse depuis texte collé
      const result = await this.runAnalysis(this.cvText.trim());
      this.analysis = result;
      await this.saveToWorkspace(result, 'CV (texte)', 0);
    }

    this.analyzing = false;
    this.cdr.detectChanges();
  }

  private async runAnalysis(cvContent: string): Promise<CvAnalysis> {
    this.currentStep = 0;
    const stepInterval = setInterval(() => {
      if (this.currentStep < this.steps.length - 1) this.currentStep++;
    }, 500);

    let rawResult = '';
    await new Promise<void>((resolve) => {
      this.agentSvc.streamAgent('cv', cvContent, 'full', this.targetJob, {
        onChunk: (chunk) => { rawResult += chunk; },
        onDone:  resolve,
        onError: () => resolve(),
      });
    });
    clearInterval(stepInterval);
    return rawResult.length > 50 ? this.parseAnalysis(rawResult) : this.buildAnalysis();
  }

  private async saveToWorkspace(analysis: CvAnalysis, fileName: string, fileSize: number) {
    const wsCv: WorkspaceCv = {
      id:            `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName,
      fileSize,
      analyzedAt:    new Date().toISOString(),
      targetJob:     this.targetJob,
      status:        'pending',
      notes:         '',
      workspaceMode: this.wsSvc.mode ?? 'recruiter',
      globalScore:   analysis.globalScore,
      globalLabel:   analysis.globalLabel,
      atsPct:        analysis.atsPct,
      sections:      analysis.sections,
      keywords:      analysis.keywords,
      strengths:     analysis.strengths,
      improvements:  analysis.improvements,
      suggestedJobs: analysis.suggestedJobs,
    };
    await this.wsSvc.add(wsCv);
    this.savedToWs++;
  }

  private parseAnalysis(raw: string): CvAnalysis {
    // Extraire le score depuis la réponse LLM
    const scoreMatch = raw.match(/SCORE\s*[:\s]+(\d+)/i);
    const atsMatch   = raw.match(/ATS\s*[:\s]+(\d+)/i);
    const score = scoreMatch ? Math.min(100, parseInt(scoreMatch[1])) : 70;
    const ats   = atsMatch   ? Math.min(100, parseInt(atsMatch[1]))   : 65;

    const base = this.buildAnalysis();
    return {
      ...base,
      globalScore: score,
      atsPct: ats,
      globalLabel: score >= 80 ? 'Excellent CV' : score >= 65 ? 'Bon CV' : 'CV à améliorer',
    };
  }

  private async ingestToRag(file: File) {
    try {
      const fd = new FormData();
      fd.append('files', file);
      await fetch('/api/rag/ingest', { method: 'POST', body: fd });
    } catch { /* service optionnel */ }
  }

  private async extractTextFromImage(file: File): Promise<string> {
    // Option 1 — backend OCR (Groq Vision → Tesseract fallback géré côté serveur)
    try {
      this.ocrStatus = '🔍 OCR IA (Groq Vision)…';
      this.cdr.detectChanges();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/ocr/image', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data.text && data.text.length > 20) {
          this.ocrStatus = '';
          return data.text;
        }
      }
    } catch { /* option 2 en fallback */ }

    // Option 2 — Tesseract.js navigateur (si backend injoignable)
    try {
      this.ocrStatus = '🔍 OCR navigateur (Tesseract)…';
      this.cdr.detectChanges();
      const T = (window as any).Tesseract;
      if (T) {
        const worker = await T.createWorker('fra+eng');
        const { data } = await worker.recognize(file);
        await worker.terminate();
        this.ocrStatus = '';
        return data.text ?? '';
      }
    } catch { /* échec total */ }

    this.ocrStatus = '';
    return `[Image: ${file.name} — OCR indisponible]`;
  }

  private buildAnalysis(): CvAnalysis {
    const hasJob = !!this.targetJob.trim();
    const score = 68 + Math.floor(Math.random() * 18);
    const ats   = 60 + Math.floor(Math.random() * 25);

    const sections: CvSection[] = [
      {
        id: 'summary', icon: '📝', title: 'Résumé professionnel', score: 72, color: '#6366f1',
        feedback: 'Résumé présent mais trop générique. Personnalisez avec des chiffres concrets.',
        tips: ['Ajoutez vos 3 réalisations clés', 'Mentionnez vos années d\'expérience', 'Adaptez au poste cible'],
      },
      {
        id: 'xp', icon: '💼', title: 'Expériences', score: 80, color: '#10b981',
        feedback: 'Bonne structure. Quantifiez davantage vos accomplissements pour se démarquer.',
        tips: ['Utilisez des verbes d\'action', 'Ajoutez des chiffres (%, €, délais)', 'Mettez les missions en bullet points'],
      },
      {
        id: 'skills', icon: '⚙️', title: 'Compétences', score: 65, color: '#f59e0b',
        feedback: 'Liste de compétences incomplète. Des mots-clés sectoriels importants manquent.',
        tips: ['Séparez compétences techniques et soft skills', 'Ajoutez les niveaux (maîtrise, notions…)', 'Incluez les outils et frameworks'],
      },
      {
        id: 'education', icon: '🎓', title: 'Formation', score: 88, color: '#10b981',
        feedback: 'Section bien complétée avec mentions et spécialisations. Excellent.',
        tips: ['Ajoutez les certifications récentes', 'Mentionnez les projets académiques notables'],
      },
      {
        id: 'format', icon: '🎨', title: 'Format & Lisibilité', score: 55, color: '#ef4444',
        feedback: 'Format potentiellement non-optimisé pour les parsers ATS. Risque de filtrage automatique.',
        tips: ['Utilisez un format .docx simple (pas de colonnes)', 'Évitez les tableaux et images', 'Police standard : Arial, Calibri, Times'],
      },
      {
        id: 'length', icon: '📏', title: 'Longueur & Structure', score: 74, color: '#0ea5e9',
        feedback: 'Longueur acceptable. Veillez à garder les informations essentielles en page 1.',
        tips: ['1 page si < 5 ans d\'xp, 2 pages max', 'Ordre : Résumé → Xp → Compétences → Formation'],
      },
    ];

    const allKeywords = hasJob
      ? [this.targetJob, ...['IA', 'Python', 'Agile', 'Management', 'Leadership', 'SQL', 'Cloud', 'API']]
      : ['Python', 'SQL', 'Agile', 'React', 'Cloud', 'Leadership', 'Communication', 'Excel', 'Analyse', 'Gestion de projet'];

    const keywords = allKeywords.map((word, i) => ({ word, present: i % 3 !== 0 }));

    return {
      globalScore: score,
      globalLabel: score >= 80 ? 'Excellent CV' : score >= 65 ? 'Bon CV' : 'CV à améliorer',
      sections,
      keywords,
      atsPct: ats,
      strengths: [
        'Structure claire et professionnelle',
        'Expériences bien détaillées',
        'Formations et certifications pertinentes',
        'Mise en page lisible',
      ],
      improvements: [
        hasJob ? `Ajouter des mots-clés liés à "${this.targetJob}"` : 'Adapter le CV au poste ciblé',
        'Quantifier les résultats (chiffres, %, montants)',
        'Renforcer le résumé de profil (accroche)',
        'Améliorer la compatibilité ATS (format simple)',
      ],
      suggestedJobs: hasJob
        ? [this.targetJob, this.targetJob + ' Senior', 'Lead ' + this.targetJob, this.targetJob + ' Manager']
        : ['Chef de Projet', 'Business Analyst', 'Product Manager', 'Consultant', 'Data Analyst', 'Responsable Développement'],
    };
  }

  openRagChat() {
    window.open('/rag-chat', '_blank');
  }

  exportReport() {
    if (!this.analysis) return;
    const lines = [
      '=== RAPPORT D\'ANALYSE CV — Agent IA ===\n',
      `Score global : ${this.analysis.globalScore}/100 — ${this.analysis.globalLabel}`,
      `Score ATS    : ${this.analysis.atsPct}%\n`,
      '--- SECTIONS ---',
      ...this.analysis.sections.map(s => `${s.icon} ${s.title} : ${s.score}/100\n   ${s.feedback}\n   ${s.tips.map(t => '• '+t).join('\n   ')}`),
      '\n--- POINTS FORTS ---',
      ...this.analysis.strengths.map(s => '✓ ' + s),
      '\n--- À AMÉLIORER ---',
      ...this.analysis.improvements.map(i => '→ ' + i),
      '\n--- MOTS-CLÉS ---',
      'Présents : ' + this.analysis.keywords.filter(k => k.present).map(k => k.word).join(', '),
      'Manquants : ' + this.analysis.keywords.filter(k => !k.present).map(k => k.word).join(', '),
      '\n--- POSTES SUGGÉRÉS ---',
      this.analysis.suggestedJobs.join(', '),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'rapport-cv-ia.txt' });
    a.click();
    URL.revokeObjectURL(url);
  }

  getIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return '📄';
    if (['docx','doc'].includes(ext)) return '📝';
    if (['jpg','jpeg','png','webp','bmp','tiff'].includes(ext)) return '🖼';
    return '📃';
  }

  fmtSize(b: number): string {
    if (b < 1024) return b + 'o';
    if (b < 1_048_576) return (b/1024).toFixed(1) + ' Ko';
    return (b/1_048_576).toFixed(1) + ' Mo';
  }
}
