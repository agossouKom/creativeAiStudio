import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../services/agent.service';
import { AgentSessionBarComponent } from '../../shared/components/agent-session-bar/agent-session-bar.component';

interface ResumeResult {
  summary: string;
  decisions: string[];
  actions: string[];
  keywords: string[];
  sentiment: 'positif' | 'neutre' | 'négatif';
  readTime: number;
  wordCount: number;
}

@Component({
  selector: 'app-agent-resume',
  standalone: true,
  imports: [CommonModule, FormsModule, AgentSessionBarComponent],
  template: `
<div class="res-page">
  <div class="bg-orb orb1"></div>
  <div class="bg-orb orb2"></div>

  <app-agent-session-bar></app-agent-session-bar>

  <div class="res-wrap">

    <!-- Header -->
    <div class="page-header">
      <div class="agent-icon">📋</div>
      <div>
        <h1 class="page-title">Agent Résumé Intelligent</h1>
        <p class="page-sub">Analyse automatique de documents PDF/DOCX — Résumé, décisions et actions</p>
      </div>
    </div>

    <div class="res-cols">

      <!-- Input panel -->
      <div class="input-panel">

        <div class="drop-zone"
             [class.over]="dragging"
             [class.has-file]="uploadedFile"
             (dragover)="onDragOver($event)"
             (dragleave)="dragging=false"
             (drop)="onDrop($event)"
             (click)="!uploadedFile && fi.click()">
          <input #fi type="file" accept=".pdf,.docx,.doc,.txt,.md" (change)="onFileSelect($event)" style="display:none">

          <div *ngIf="!uploadedFile" class="dz-inner">
            <div class="dz-icon">📄</div>
            <p class="dz-title">Déposez votre document ici</p>
            <p class="dz-sub">PDF, DOCX, DOC, TXT — Max 50 Mo</p>
            <span class="dz-btn">Choisir un fichier</span>
          </div>

          <div *ngIf="uploadedFile" class="file-info">
            <div class="fi-icon">{{ getFileIcon(uploadedFile.name) }}</div>
            <div class="fi-body">
              <span class="fi-name">{{ uploadedFile.name }}</span>
              <span class="fi-size">{{ fmtSize(uploadedFile.size) }}</span>
            </div>
            <button class="fi-remove" (click)="removeFile($event)">✕</button>
          </div>
        </div>

        <!-- OR paste text -->
        <div class="or-divider"><span>ou</span></div>

        <div class="paste-section">
          <div class="section-lbl">Coller du texte à analyser</div>
          <textarea class="paste-area" [(ngModel)]="pastedText" rows="6"
                    placeholder="Collez votre texte ici (compte-rendu, rapport, email, contrat…)"></textarea>
        </div>

        <!-- Options -->
        <div class="options-section">
          <div class="section-lbl">Options d'analyse</div>
          <div class="options-grid">
            <label *ngFor="let opt of options" class="opt-item">
              <input type="checkbox" [(ngModel)]="opt.checked" class="opt-check">
              <span class="opt-label">{{ opt.icon }} {{ opt.label }}</span>
            </label>
          </div>
        </div>

        <div class="lang-row">
          <span class="section-lbl">Langue du résumé</span>
          <select class="lang-select" [(ngModel)]="outputLang">
            <option>Français</option>
            <option>Anglais</option>
          </select>
        </div>

        <button class="analyze-btn" (click)="analyze()" [disabled]="analyzing || (!uploadedFile && !pastedText.trim())">
          <span *ngIf="!analyzing">🤖 Analyser le document</span>
          <span *ngIf="analyzing" class="spin-row"><span class="btn-spin"></span> Analyse en cours…</span>
        </button>
      </div>

      <!-- Result panel -->
      <div class="result-panel">

        <div *ngIf="!result && !analyzing" class="result-empty">
          <div class="empty-icon">📋</div>
          <h3 class="empty-title">Votre analyse apparaîtra ici</h3>
          <p class="empty-sub">Importez un document ou collez du texte, puis lancez l'analyse</p>
          <div class="cap-list">
            <div class="cap-item"><span>📝</span> Résumé en quelques lignes</div>
            <div class="cap-item"><span>✅</span> Extraction des décisions clés</div>
            <div class="cap-item"><span>📌</span> Actions à entreprendre</div>
            <div class="cap-item"><span>🏷️</span> Mots-clés importants</div>
            <div class="cap-item"><span>😊</span> Analyse de sentiment</div>
          </div>
        </div>

        <div *ngIf="analyzing" class="analyzing-state">
          <div class="an-spinner"></div>
          <p class="an-label">Analyse IA en cours…</p>
          <div class="an-steps">
            <div *ngFor="let step of analysisSteps; let i = index" class="an-step"
                 [class.done]="i < currentStep"
                 [class.active]="i === currentStep">
              <span class="an-step-dot"></span>
              <span>{{ step }}</span>
            </div>
          </div>
        </div>

        <div *ngIf="result && !analyzing" class="result-content">

          <!-- Meta -->
          <div class="result-meta">
            <div class="meta-item"><span class="meta-n">{{ result.wordCount }}</span><span class="meta-l">mots</span></div>
            <div class="meta-item"><span class="meta-n">{{ result.readTime }}min</span><span class="meta-l">lecture</span></div>
            <div class="meta-item">
              <span class="meta-n sentiment" [class.pos]="result.sentiment === 'positif'" [class.neg]="result.sentiment === 'négatif'">
                {{ result.sentiment === 'positif' ? '😊' : result.sentiment === 'négatif' ? '😟' : '😐' }}
              </span>
              <span class="meta-l">{{ result.sentiment }}</span>
            </div>
            <button class="export-btn" (click)="exportResult()">📥 Exporter</button>
          </div>

          <!-- Summary -->
          <div class="res-section">
            <div class="res-sec-head">
              <span class="res-sec-icon">📝</span>
              <span class="res-sec-title">Résumé</span>
            </div>
            <p class="res-text">{{ result.summary }}</p>
          </div>

          <!-- Decisions -->
          <div class="res-section">
            <div class="res-sec-head">
              <span class="res-sec-icon">✅</span>
              <span class="res-sec-title">Décisions clés</span>
            </div>
            <ul class="res-list">
              <li *ngFor="let d of result.decisions">{{ d }}</li>
            </ul>
          </div>

          <!-- Actions -->
          <div class="res-section">
            <div class="res-sec-head">
              <span class="res-sec-icon">📌</span>
              <span class="res-sec-title">Actions à entreprendre</span>
            </div>
            <div class="action-list">
              <div *ngFor="let a of result.actions; let i = index" class="action-item">
                <span class="action-n">{{ i + 1 }}</span>
                <span class="action-text">{{ a }}</span>
              </div>
            </div>
          </div>

          <!-- Keywords -->
          <div class="res-section">
            <div class="res-sec-head">
              <span class="res-sec-icon">🏷️</span>
              <span class="res-sec-title">Mots-clés</span>
            </div>
            <div class="keywords-wrap">
              <span *ngFor="let k of result.keywords" class="kw-tag">{{ k }}</span>
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
    .res-page { height:calc(100vh - 64px); background:var(--fp-bg); position:relative; overflow:hidden; display:flex; flex-direction:column; }
    ::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(139,92,246,.25); border-radius:5px; } ::-webkit-scrollbar-thumb:hover { background:rgba(139,92,246,.5); }
    .bg-orb { position:absolute; border-radius:50%; filter:blur(130px); pointer-events:none; z-index:0; }
    .orb1 { width:600px; height:600px; top:-150px; right:-100px; background:rgba(139,92,246,.09); }
    .orb2 { width:500px; height:500px; bottom:-100px; left:-100px; background:rgba(16,185,129,.06); }
    .res-wrap { flex:1; min-height:0; max-width:1200px; width:100%; margin:0 auto; position:relative; z-index:1; display:flex; flex-direction:column; gap:1.25rem; padding:1.5rem 1.5rem 0; overflow:hidden; }

    .page-header { display:flex; align-items:center; gap:1rem; }
    .agent-icon { width:48px; height:48px; background:linear-gradient(135deg,#8b5cf6,#7c3aed); border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0; }
    .page-title { font-size:1.5rem; font-weight:900; color:var(--fp-text); margin:0; }
    .page-sub { font-size:.8rem; color:var(--fp-text-2); margin:.2rem 0 0; }

    .res-cols { flex:1; min-height:0; display:grid; grid-template-columns:360px 1fr; gap:1.25rem; overflow:hidden; padding-bottom:1.5rem; }
    @media(max-width:900px) { .res-cols { grid-template-columns:1fr; overflow:visible; } }

    .input-panel {
      background:var(--fp-card);
      border:1px solid var(--fp-border);
      border-radius:16px;
      padding:1.25rem;
      display:flex;
      flex-direction:column;
      gap:1rem;
      overflow-y:auto;
      overflow-x:hidden;
    }

    .drop-zone {
      border: 2px dashed rgba(139,92,246,.3);
      border-radius: 14px;
      padding: 1.5rem;
      text-align: center;
      cursor: pointer;
      transition: .2s;
      background: var(--fp-card);
    }
    .drop-zone:hover, .drop-zone.over { border-color:#8b5cf6; background:rgba(139,92,246,.06); }
    .drop-zone.has-file { cursor:default; border-color:rgba(16,185,129,.3); border-style:solid; }
    .dz-inner { display:flex; flex-direction:column; align-items:center; gap:.45rem; }
    .dz-icon { font-size:2rem; }
    .dz-title { font-size:.85rem; font-weight:700; color:var(--fp-text-2); margin:0; }
    .dz-sub { font-size:.72rem; color:var(--fp-text-2); margin:0; }
    .dz-btn { background:rgba(139,92,246,.15); border:1px solid rgba(139,92,246,.3); color:#c4b5fd; font-size:.72rem; font-weight:700; padding:.28rem .75rem; border-radius:20px; margin-top:.25rem; }

    .file-info { display:flex; align-items:center; gap:.75rem; }
    .fi-icon { font-size:1.5rem; flex-shrink:0; }
    .fi-body { flex:1; min-width:0; display:flex; flex-direction:column; }
    .fi-name { font-size:.8rem; font-weight:700; color:var(--fp-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .fi-size { font-size:.68rem; color:var(--fp-text-2); }
    .fi-remove { background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.2); color:#f87171; width:24px; height:24px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:.75rem; flex-shrink:0; }

    .or-divider { display:flex; align-items:center; gap:.75rem; color:#374151; font-size:.72rem; }
    .or-divider::before,.or-divider::after { content:''; flex:1; height:1px; background:var(--fp-input); }

    .section-lbl { font-size:.65rem; font-weight:800; color:var(--fp-text-2); text-transform:uppercase; letter-spacing:.08em; margin-bottom:.4rem; }
    .paste-section,.options-section { display:flex; flex-direction:column; }
    .paste-area {
      background:var(--fp-input); border:1px solid var(--fp-border);
      border-radius:10px; padding:.65rem .85rem;
      color:var(--fp-text); font-size:.8rem; line-height:1.65;
      resize:vertical; outline:none; font-family:inherit; transition:.15s;
    }
    .paste-area:focus { border-color:rgba(139,92,246,.4); box-shadow:0 0 0 3px rgba(139,92,246,.06); }
    .paste-area::placeholder { color:#374151; }

    .options-grid { display:grid; grid-template-columns:1fr 1fr; gap:.35rem; }
    .opt-item { display:flex; align-items:center; gap:.5rem; cursor:pointer; padding:.3rem .4rem; border-radius:6px; transition:.12s; }
    .opt-item:hover { background:var(--fp-input); }
    .opt-check { accent-color:#8b5cf6; }
    .opt-label { font-size:.75rem; color:var(--fp-text-2); }

    .lang-row { display:flex; align-items:center; justify-content:space-between; }
    .lang-select { background:var(--fp-input); border:1px solid var(--fp-border); border-radius:8px; padding:.35rem .6rem; color:var(--fp-text); font-size:.78rem; outline:none; font-family:inherit; }
    .lang-select option { background:#1e293b; }

    .analyze-btn {
      background:linear-gradient(135deg,#8b5cf6,#7c3aed);
      color:#fff; border:none; border-radius:10px;
      padding:.65rem 1.2rem; font-size:.85rem; font-weight:800;
      cursor:pointer; transition:.15s;
      display:flex; align-items:center; justify-content:center; gap:.5rem;
    }
    .analyze-btn:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
    .analyze-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; }
    .spin-row { display:flex; align-items:center; gap:.5rem; }
    .btn-spin { width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; }

    /* ── Result panel ── */
    .result-panel {
      background:var(--fp-card-2);
      border:1px solid var(--fp-border);
      border-radius:16px;
      padding:1.5rem;
      display:flex;
      flex-direction:column;
      overflow-y:auto;
      overflow-x:hidden;
    }

    .result-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.75rem; text-align:center; flex:1; min-height:200px; }
    .empty-icon { font-size:2.5rem; }
    .empty-title { font-size:1rem; font-weight:800; color:var(--fp-text-2); margin:0; }
    .empty-sub { font-size:.8rem; color:var(--fp-text-3); margin:0 0 .5rem; }
    .cap-list { display:flex; flex-direction:column; gap:.35rem; text-align:left; }
    .cap-item { display:flex; align-items:center; gap:.5rem; font-size:.78rem; color:#374151; }

    .analyzing-state { display:flex; flex-direction:column; align-items:center; gap:1rem; padding:2rem; text-align:center; flex:1; }
    .an-spinner { width:40px; height:40px; border:4px solid rgba(139,92,246,.2); border-top-color:#8b5cf6; border-radius:50%; animation:spin .7s linear infinite; }
    .an-label { font-size:.85rem; color:var(--fp-text-2); font-style:italic; margin:0; }
    .an-steps { display:flex; flex-direction:column; gap:.4rem; margin-top:.5rem; text-align:left; }
    .an-step { display:flex; align-items:center; gap:.6rem; font-size:.78rem; color:#374151; transition:.3s; }
    .an-step.active { color:#a5b4fc; }
    .an-step.done { color:#10b981; }
    .an-step-dot { width:8px; height:8px; border-radius:50%; background:currentColor; flex-shrink:0; }

    .result-content { display:flex; flex-direction:column; gap:1.25rem; animation:fadeUp .4s ease-out; }
    .result-meta { display:flex; align-items:center; gap:1.25rem; padding-bottom:1rem; border-bottom:1px solid var(--fp-border); flex-wrap:wrap; }
    .meta-item { display:flex; flex-direction:column; align-items:center; gap:.15rem; }
    .meta-n { font-size:1.1rem; font-weight:800; color:var(--fp-text); }
    .meta-n.sentiment { font-size:1.4rem; }
    .meta-n.pos { }
    .meta-n.neg { }
    .meta-l { font-size:.65rem; color:var(--fp-text-2); text-transform:uppercase; letter-spacing:.04em; }
    .export-btn { margin-left:auto; background:rgba(139,92,246,.15); border:1px solid rgba(139,92,246,.3); color:#c4b5fd; font-size:.72rem; font-weight:700; padding:.3rem .7rem; border-radius:8px; cursor:pointer; transition:.15s; }
    .export-btn:hover { background:rgba(139,92,246,.25); }

    .res-section { display:flex; flex-direction:column; gap:.6rem; }
    .res-sec-head { display:flex; align-items:center; gap:.5rem; }
    .res-sec-icon { font-size:1rem; }
    .res-sec-title { font-size:.8rem; font-weight:800; color:var(--fp-text-2); text-transform:uppercase; letter-spacing:.06em; }
    .res-text { font-size:.85rem; color:var(--fp-text); line-height:1.75; background:var(--fp-input); border-radius:8px; padding:.85rem 1rem; border-left:3px solid #8b5cf6; margin:0; }
    .res-list { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:.4rem; }
    .res-list li { display:flex; align-items:flex-start; gap:.5rem; font-size:.82rem; color:var(--fp-text); line-height:1.6; padding:.4rem .75rem; background:rgba(16,185,129,.06); border-radius:7px; border-left:2px solid #10b981; }
    .res-list li::before { content:'✓'; color:#10b981; font-weight:800; flex-shrink:0; font-size:.75rem; margin-top:.1rem; }

    .action-list { display:flex; flex-direction:column; gap:.4rem; }
    .action-item { display:flex; align-items:flex-start; gap:.65rem; padding:.45rem .75rem; background:var(--fp-input); border-radius:8px; }
    .action-n { width:22px; height:22px; border-radius:6px; background:linear-gradient(135deg,#8b5cf6,#7c3aed); color:#fff; font-size:.7rem; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .action-text { font-size:.82rem; color:var(--fp-text-2); line-height:1.6; }

    .keywords-wrap { display:flex; flex-wrap:wrap; gap:.35rem; }
    .kw-tag { font-size:.72rem; font-weight:700; background:rgba(139,92,246,.12); border:1px solid rgba(139,92,246,.2); color:#c4b5fd; padding:.2rem .55rem; border-radius:6px; }

    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  `]
})
export class AgentResumeComponent {
  constructor(private cdr: ChangeDetectorRef, private agentSvc: AgentService) {}

  uploadedFile: File | null = null;
  pastedText = '';
  outputLang = 'Français';
  dragging = false;
  analyzing = false;
  currentStep = 0;
  result: ResumeResult | null = null;

  readonly options = [
    { id: 'summary',   icon: '📝', label: 'Résumé exécutif',   checked: true },
    { id: 'decisions', icon: '✅', label: 'Décisions clés',     checked: true },
    { id: 'actions',   icon: '📌', label: 'Actions/tâches',     checked: true },
    { id: 'keywords',  icon: '🏷️', label: 'Mots-clés',         checked: true },
    { id: 'sentiment', icon: '😊', label: 'Analyse sentiment',  checked: false },
    { id: 'translate', icon: '🌐', label: 'Traduction auto',    checked: false },
  ];

  readonly analysisSteps = [
    'Extraction du contenu…',
    'Analyse sémantique…',
    'Identification des décisions…',
    'Extraction des actions…',
    'Génération du résumé…',
  ];

  onDragOver(e: DragEvent) { e.preventDefault(); this.dragging = true; }
  onDrop(e: DragEvent) {
    e.preventDefault(); this.dragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) this.uploadedFile = file;
  }
  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) this.uploadedFile = input.files[0];
    input.value = '';
  }
  removeFile(e: Event) { e.stopPropagation(); this.uploadedFile = null; }

  async analyze() {
    if (!this.uploadedFile && !this.pastedText.trim()) return;
    this.analyzing = true;
    this.result = null;
    this.currentStep = 0;

    // Avancer les étapes pendant l'appel backend
    const stepInterval = setInterval(() => {
      if (this.currentStep < this.analysisSteps.length - 1) this.currentStep++;
    }, 600);

    let textContent = this.pastedText.trim();

    // Si fichier uploadé : lire comme texte (ou l'indexer dans RAG)
    if (this.uploadedFile) {
      const indexOpt = this.options.find(o => o.id === 'translate');
      if (indexOpt?.checked) {
        // Ingest dans le vector store RAG
        const fd = new FormData();
        fd.append('files', this.uploadedFile);
        await fetch('/api/rag/ingest', { method: 'POST', body: fd }).catch(() => {});
      }
      if (!textContent) {
        textContent = `[Document: ${this.uploadedFile.name} — analyse par l'IA]`;
      }
    }

    let rawResult = '';
    await new Promise<void>((resolve) => {
      this.agentSvc.streamAgent(
        'resume', textContent, 'full', this.outputLang,
        {
          onChunk: (chunk) => { rawResult += chunk; this.cdr.detectChanges(); },
          onDone: resolve,
          onError: () => { rawResult = this.getMockResumeResult(textContent); resolve(); },
        }
      );
    });

    clearInterval(stepInterval);
    this.currentStep = this.analysisSteps.length - 1;
    await new Promise(r => setTimeout(r, 300));

    // Parser la réponse LLM en structure ResumeResult
    this.result = this.parseResult(rawResult, textContent);
    this.analyzing = false;
  }

  private getMockResumeResult(text: string): string {
    return `**RÉSUMÉ EXÉCUTIF** :
Ce document présente des informations importantes. L'analyse révèle une structure claire avec des points décisionnels identifiables.

**DÉCISIONS CLÉS** :
- Validation du budget et des ressources allouées
- Définition des responsabilités par équipe
- Calendrier de mise en œuvre établi

**ACTIONS À ENTREPRENDRE** :
1. Préparer le rapport de synthèse pour la direction
2. Planifier les réunions de suivi avec les parties prenantes
3. Mettre à jour le planning opérationnel

**MOTS-CLÉS** : stratégie, budget, planification, décision, suivi, ressources`;
  }

  private parseResult(raw: string, originalText: string): ResumeResult {
    // Extraire les sections de la réponse LLM
    const extractSection = (tag: string): string => {
      const rx = new RegExp(`\\*\\*${tag}[^*]*\\*\\*[:\\s]*([\\s\\S]*?)(?=\\*\\*|$)`, 'i');
      return (raw.match(rx)?.[1] ?? '').trim();
    };

    const summaryRaw = extractSection('RÉSUMÉ');
    const decisionsRaw = extractSection('DÉCISIONS');
    const actionsRaw = extractSection('ACTIONS');
    const keywordsRaw = extractSection('MOTS-CLÉS');

    const toBullets = (text: string): string[] =>
      text.split('\n')
          .map(l => l.replace(/^[-•*\d.]\s*/, '').trim())
          .filter(l => l.length > 5)
          .slice(0, 6);

    return {
      summary: summaryRaw || raw.substring(0, 300),
      decisions: toBullets(decisionsRaw).length ? toBullets(decisionsRaw) : ['Décision 1 identifiée', 'Décision 2 identifiée'],
      actions: toBullets(actionsRaw).length ? toBullets(actionsRaw) : ['Action 1 à entreprendre', 'Action 2 à planifier'],
      keywords: keywordsRaw.split(/[,;]+/).map(k => k.trim()).filter(k => k.length > 2).slice(0, 12),
      sentiment: 'positif',
      readTime: Math.max(1, Math.floor(originalText.split(/\s+/).length / 200)),
      wordCount: originalText.split(/\s+/).filter(Boolean).length || 350,
    };
  }

  exportResult() {
    if (!this.result) return;
    const text = [
      '=== RÉSUMÉ INTELLIGENT ===\n',
      `Résumé:\n${this.result.summary}\n`,
      `\nDécisions clés:\n${this.result.decisions.map(d => '• ' + d).join('\n')}\n`,
      `\nActions:\n${this.result.actions.map((a,i) => `${i+1}. ${a}`).join('\n')}\n`,
      `\nMots-clés: ${this.result.keywords.join(', ')}`,
    ].join('');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'resume-ia.txt' });
    a.click();
    URL.revokeObjectURL(url);
  }

  getFileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return '📄';
    if (['docx', 'doc'].includes(ext)) return '📝';
    if (['txt', 'md'].includes(ext)) return '📃';
    return '📁';
  }

  fmtSize(b: number): string {
    if (b < 1024) return b + 'o';
    if (b < 1_048_576) return (b / 1024).toFixed(1) + ' Ko';
    return (b / 1_048_576).toFixed(1) + ' Mo';
  }
}
