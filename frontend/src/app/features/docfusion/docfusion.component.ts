import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

type Op = 'merge' | 'merge-docx' | 'split' | 'compress' | 'watermark'
        | 'to-pdf' | 'to-docx' | 'ocr' | 'base64-encode' | 'base64-decode';
type View = 'workspace' | 'history';

interface OpDef {
  id: Op; icon: string; name: string; desc: string; hint: string;
  formats: string[]; group: string; multi: boolean;
}

interface OpState {
  files: File[];
  checked: boolean[];
  results: JobResult[];
  b64Input: string;
  selectedResultIdx: number;
}

interface JobResult {
  fileName: string;
  jobId?: string;
  status: string;
  error?: string;
  base64?: string;
  sizeBytes?: number;
  base64Length?: number;
  chars?: number;
  operationType?: string;
  text?: string;        // OCR: texte extrait (depuis /jobs/{id})
  resultText?: string;  // OCR: texte extrait (depuis /jobs liste)
  resultUrl?: string;   // jobs avec fichier généré
}

const GW = 'http://localhost:8480/api/docfusion';

const EXT_OPTIONS = [
  { label: '.pdf',  value: '.pdf'  },
  { label: '.png',  value: '.png'  },
  { label: '.jpg',  value: '.jpg'  },
  { label: '.docx', value: '.docx' },
  { label: '.xlsx', value: '.xlsx' },
  { label: '.txt',  value: '.txt'  },
  { label: '.zip',  value: '.zip'  },
  { label: '.bin',  value: '.bin'  },
];

@Component({
  selector: 'app-docfusion',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  styles: [`
    :host { display: block; }

    /* ── Page ─── */
    .df-page { min-height: calc(100vh - 64px); background: #f8fafc;
               padding: .75rem 1.5rem 3rem; position: relative; overflow: hidden; }
    .bg-blob { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; opacity: .28; }
    .bg-blob.b1 { width: 500px; height: 500px; background: radial-gradient(circle, #6366f1 0%, transparent 70%); top: -180px; right: -150px; }
    .bg-blob.b2 { width: 350px; height: 350px; background: radial-gradient(circle, #a855f7 0%, transparent 70%); bottom: -80px; left: -80px; }
    .df-inner { max-width: 1160px; margin: 0 auto; position: relative; }

    /* ── Hero ─── */
    .hero { padding: .5rem 0 1rem; display: flex; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
    .hero-h1  { font-family: 'Outfit', sans-serif; font-size: clamp(1.15rem, 2.5vw, 1.5rem);
                font-weight: 900; color: #0f172a; letter-spacing: -.5px; margin: 0; }
    .hero-h1 span { background: linear-gradient(135deg, #6366f1, #a855f7);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero-sub { color: #94a3b8; font-size: .78rem; margin: 0; }

    /* ── Grid ─── */
    .df-grid { display: grid; gap: 1.25rem; transition: grid-template-columns .25s ease;
               align-items: start; }
    .df-grid.expanded  { grid-template-columns: 220px 1fr; }
    .df-grid.collapsed { grid-template-columns: 48px  1fr; }
    @media (max-width: 768px) { .df-grid.expanded, .df-grid.collapsed { grid-template-columns: 1fr; } }

    /* ── Sidebar (mode sombre) ─── */
    .sidebar-wrap { display: flex; flex-direction: column; }
    .sidebar-toggle { display: flex; align-items: center; justify-content: center;
                      width: 32px; height: 32px; border-radius: 8px; border: 1.5px solid #334155;
                      background: #1e293b; cursor: pointer; color: #94a3b8; transition: all .18s;
                      margin-bottom: .5rem; flex-shrink: 0; }
    .sidebar-toggle:hover { border-color: #6366f1; color: #a5b4fc; background: #1e293b; }
    .ops-sidebar { display: flex; flex-direction: column; gap: .1rem; overflow: hidden;
                   background: #0f172a; border-radius: 14px; padding: .5rem .35rem; }
    .ops-group-label { font-size: .6rem; font-weight: 800; text-transform: uppercase;
                       letter-spacing: .08em; color: #475569; padding: .6rem .5rem .2rem;
                       white-space: nowrap; overflow: hidden; }
    .ops-group-label.hidden { display: none; }
    .op-btn { display: flex; align-items: center; gap: .5rem; padding: .48rem .6rem;
              border-radius: 8px; border: none; background: transparent; cursor: pointer;
              text-align: left; transition: all .15s; width: 100%; }
    .op-btn:hover { background: #1e293b; }
    .op-btn.active { background: #1e293b; border-left: 3px solid #6366f1; padding-left: calc(.6rem - 1px); }
    .op-ico   { font-size: 1rem; flex-shrink: 0; }
    .op-texts { display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
    .op-name  { font-size: .76rem; font-weight: 700; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .op-desc  { font-size: .6rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .op-check { margin-left: auto; color: #6366f1; flex-shrink: 0; }
    .sidebar-divider { height: 1px; background: #1e293b; margin: .4rem 0; }
    .hist-nav-btn { display: flex; align-items: center; gap: .5rem; padding: .48rem .6rem;
                    border-radius: 8px; border: none; cursor: pointer; width: 100%;
                    font-size: .76rem; font-weight: 700; transition: all .15s;
                    background: transparent; color: #94a3b8; }
    .hist-nav-btn:hover { background: #1e293b; color: #e2e8f0; }
    .hist-nav-btn.active { background: #1e293b; color: #a5b4fc; border-left: 3px solid #6366f1; }

    /* ── Panel ─── */
    .panel { background: white; border-radius: 18px; border: 1.5px solid #f1f5f9;
             padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,.05); }
    .panel-head { display: flex; align-items: center; gap: .875rem; margin-bottom: 1.25rem;
                  padding-bottom: 1rem; border-bottom: 1.5px solid #f1f5f9; }
    .panel-ico-wrap { width: 46px; height: 46px; border-radius: 12px;
                      background: linear-gradient(135deg, #6366f1, #8b5cf6);
                      display: flex; align-items: center; justify-content: center;
                      font-size: 1.4rem; box-shadow: 0 3px 12px rgba(99,102,241,.3); flex-shrink: 0; }
    .panel-title { font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: .15rem; }
    .panel-hint  { font-size: .76rem; color: #64748b; }

    /* ── Drop zone ─── */
    .drop-zone { border: 2px dashed #e2e8f0; border-radius: 14px; padding: 1.5rem;
                 text-align: center; cursor: pointer; transition: all .22s; background: #fafbfc; }
    .drop-zone:hover, .drop-zone.drag { border-color: #6366f1; background: #f5f3ff; }
    .drop-zone.filled { border-color: #6366f1; background: #f5f3ff; border-style: solid; }
    .drop-up-icon { width: 42px; height: 42px; border-radius: 10px; margin: 0 auto .625rem;
                    background: white; border: 1.5px solid #e2e8f0; display: flex;
                    align-items: center; justify-content: center; transition: all .2s; }
    .drop-zone.filled .drop-up-icon { background: #6366f1; border-color: #6366f1; }
    .drop-zone.filled .drop-up-icon svg { stroke: white; }
    .drop-title { font-size: .85rem; font-weight: 700; color: #374151; margin-bottom: .2rem; }
    .drop-sub   { font-size: .72rem; color: #94a3b8; margin-bottom: .75rem; }
    .fmt-row    { display: flex; gap: .3rem; flex-wrap: wrap; justify-content: center; }
    .fmt-chip   { font-size: .62rem; font-weight: 700; background: #f1f5f9; color: #475569; padding: .15rem .45rem; border-radius: 5px; }

    /* ── File list ─── */
    .file-list-head { display: flex; align-items: center; justify-content: space-between;
                      padding: .4rem .625rem; margin-top: .875rem;
                      background: #f8fafc; border: 1.5px solid #f1f5f9; border-radius: 9px 9px 0 0; }
    .select-all-wrap { display: flex; align-items: center; gap: .45rem; }
    .cb-all  { width: 15px; height: 15px; accent-color: #6366f1; cursor: pointer; }
    .cb-all-label { font-size: .72rem; font-weight: 700; color: #475569; cursor: pointer; }
    .sel-count { font-size: .68rem; color: #94a3b8; }
    .clear-btn { display: flex; align-items: center; gap: .3rem; padding: .28rem .65rem;
                 border: 1.5px solid #fca5a5; background: #fef2f2; color: #dc2626;
                 font-size: .7rem; font-weight: 700; border-radius: 7px; cursor: pointer; transition: all .18s; }
    .clear-btn:hover { background: #fee2e2; }
    .file-list  { display: flex; flex-direction: column; }
    .file-row   { display: flex; align-items: center; gap: .625rem; background: white;
                  border: 1.5px solid #f1f5f9; border-top: none; padding: .425rem .625rem;
                  transition: background .2s, border-left-color .2s; cursor: default; }
    .file-row:last-child { border-radius: 0 0 9px 9px; }
    .file-row.drag-over  { border-color: #6366f1; background: #f5f3ff; }
    .file-row.unchecked  { opacity: .45; }
    /* ✅ Traitement terminé */
    .file-row.done       { background: #f0fdf4; border-left: 3px solid #22c55e; cursor: pointer; }
    .file-row.done:hover { background: #dcfce7; }
    /* ✅ Sélectionné (texte affiché) */
    .file-row.selected   { background: #eff6ff; border-left: 3px solid #3b82f6 !important; }
    /* ❌ Erreur */
    .file-row.row-failed { background: #fef2f2; border-left: 3px solid #ef4444; }
    /* ⏳ En cours */
    .file-row.row-working{ background: #fffbeb; border-left: 3px solid #f59e0b; }
    .file-cb    { width: 15px; height: 15px; accent-color: #6366f1; cursor: pointer; flex-shrink: 0; }
    .file-drag-handle { color: #cbd5e1; font-size: .85rem; cursor: grab; flex-shrink: 0; }
    .file-ico   { font-size: 1.15rem; flex-shrink: 0; }
    .file-info  { flex: 1; min-width: 0; }
    .file-name  { font-size: .76rem; font-weight: 600; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .file-size  { font-size: .63rem; color: #94a3b8; }
    .file-status-badge { font-size: .6rem; font-weight: 800; padding: .12rem .42rem; border-radius: 5px; flex-shrink: 0; }
    .fsb-done    { background: #dcfce7; color: #16a34a; }
    .fsb-failed  { background: #fee2e2; color: #dc2626; }
    .fsb-working { background: #fef9c3; color: #b45309; }
    .file-rm    { border: none; background: transparent; color: #cbd5e1; cursor: pointer;
                  padding: .2rem; border-radius: 5px; transition: all .15s; flex-shrink: 0; }
    .file-rm:hover { background: #fee2e2; color: #ef4444; }

    /* Drop zone désactivée (traitement en cours) */
    .drop-zone.locked { pointer-events: none; opacity: .55; border-color: #e2e8f0; background: #f8fafc; }
    .drop-lock-msg { font-size: .74rem; color: #f59e0b; font-weight: 700; margin-top: .4rem; }

    /* Prévisualisation inline résultat */
    .inline-preview { margin-top: .625rem; border-radius: 10px; border: 1.5px solid #bfdbfe;
                      overflow: hidden; animation: fadeIn .2s ease-out; }
    .inline-preview-head { display: flex; align-items: center; justify-content: space-between;
                           padding: .5rem .875rem; background: #eff6ff; border-bottom: 1px solid #bfdbfe; }
    .inline-preview-label { font-size: .7rem; font-weight: 800; color: #1d4ed8; text-transform: uppercase; letter-spacing: .04em; }
    .inline-preview-hint  { font-size: .66rem; color: #93c5fd; }
    .inline-preview-actions { display: flex; gap: .35rem; }
    .inline-preview-body  { padding: .75rem 1rem; background: white; }
    .inline-result-text   { font-family: 'Inter', system-ui, sans-serif; font-size: .82rem; line-height: 1.75;
                            color: #1e293b; white-space: pre-wrap; word-break: break-word; margin: 0;
                            max-height: 280px; overflow-y: auto; }
    .inline-result-text::-webkit-scrollbar { width: 4px; }
    .inline-result-text::-webkit-scrollbar-thumb { background: #bfdbfe; border-radius: 4px; }
    .inline-dl-row { margin-top: .625rem; display: flex; gap: .35rem; flex-wrap: wrap; }
    .busy-overlay { position: absolute; inset: 0; background: rgba(248,250,252,.6);
                    border-radius: 14px; z-index: 10; display: flex; align-items: center; justify-content: center;
                    pointer-events: all; cursor: not-allowed; }

    /* ── Params ─── */
    .params-section { margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: 10px; border: 1.5px solid #f1f5f9; }
    .params-title { font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; margin-bottom: .75rem; }
    .params-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .75rem; }
    .param-group { display: flex; flex-direction: column; gap: .3rem; }
    .param-label { font-size: .72rem; font-weight: 700; color: #374151; }
    .param-input { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: .45rem .7rem;
                   font-size: .82rem; color: #0f172a; outline: none; transition: border-color .2s; width: 100%; }
    .param-input:focus { border-color: #6366f1; }
    .param-select { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: .45rem .7rem;
                    font-size: .82rem; color: #0f172a; outline: none; width: 100%; background: white; cursor: pointer; }
    .param-select:focus { border-color: #6366f1; }
    .param-row  { display: flex; gap: .45rem; align-items: center; }
    .color-preview { width: 34px; height: 34px; border-radius: 7px; border: 2px solid #e2e8f0; cursor: pointer; flex-shrink: 0; padding: 0; }
    .rot-pills { display: flex; gap: .3rem; flex-wrap: wrap; }
    .rot-pill  { border: 1.5px solid #e2e8f0; background: white; color: #475569;
                 font-size: .68rem; font-weight: 700; padding: .2rem .55rem; border-radius: 999px; cursor: pointer; transition: all .15s; }
    .rot-pill.active { background: #6366f1; border-color: #6366f1; color: white; }

    /* ── Base64 textarea ─── */
    .b64-ta { width: 100%; border: 1.5px solid #e2e8f0; border-radius: 10px;
              padding: .7rem .9rem; font-family: monospace; font-size: .7rem;
              line-height: 1.5; resize: vertical; min-height: 90px; outline: none; color: #334155; }
    .b64-ta:focus { border-color: #6366f1; }

    /* Extension picker */
    .ext-pills { display: flex; gap: .35rem; flex-wrap: wrap; margin-top: .25rem; }
    .ext-pill  { border: 1.5px solid #e2e8f0; background: white; color: #475569;
                 font-size: .72rem; font-weight: 700; padding: .25rem .6rem;
                 border-radius: 8px; cursor: pointer; transition: all .15s; font-family: monospace; }
    .ext-pill.active { background: #6366f1; border-color: #6366f1; color: white; }

    /* ── CTA ─── */
    .cta-wrap  { margin-top: 1rem; }
    .cta-btn   { width: 100%; padding: .8rem; border-radius: 12px; border: none;
                 background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;
                 font-size: .9rem; font-weight: 800; cursor: pointer;
                 display: flex; align-items: center; justify-content: center; gap: .5rem;
                 transition: all .2s; box-shadow: 0 4px 14px rgba(99,102,241,.35); }
    .cta-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 7px 20px rgba(99,102,241,.4); }
    .cta-btn:disabled { opacity: .52; cursor: not-allowed; transform: none; }
    .spin-sm { width: 15px; height: 15px; border-radius: 50%;
               border: 2px solid rgba(255,255,255,.4); border-top-color: white;
               animation: spin .7s linear infinite; flex-shrink: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .prog-wrap { margin-top: .75rem; }
    .prog-bar  { height: 3px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
    .prog-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #a855f7); border-radius: 999px; transition: width .3s; }
    .prog-text { font-size: .68rem; color: #64748b; text-align: center; margin-top: .3rem; }

    /* ── Results (multi) ─── */
    .results-list { margin-top: 1rem; display: flex; flex-direction: column; gap: .625rem; }
    .result-item { border-radius: 12px; overflow: hidden; border: 1.5px solid #f1f5f9; }
    .result-item-head { display: flex; align-items: center; gap: .625rem; padding: .7rem 1rem;
                        background: #f8fafc; border-bottom: 1px solid #f1f5f9; }
    .result-item-fname { font-size: .78rem; font-weight: 700; color: #374151; flex: 1; min-width: 0;
                         white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .result-item-status { font-size: .65rem; font-weight: 800; padding: .18rem .5rem; border-radius: 999px; flex-shrink: 0; }
    .s-done    { background: #f0fdf4; color: #16a34a; }
    .s-failed  { background: #fef2f2; color: #dc2626; }
    .s-working { background: #fffbeb; color: #d97706; }
    .result-item-body { padding: .625rem 1rem; }
    .res-error-small { font-size: .78rem; color: #dc2626; font-weight: 600; }
    .dl-btn-sm { display: inline-flex; align-items: center; gap: .4rem; padding: .45rem .875rem;
                 background: #0f172a; color: white; font-size: .78rem; font-weight: 700;
                 border-radius: 8px; cursor: pointer; border: none; transition: background .2s; }
    .dl-btn-sm:hover { background: #1e293b; }

    /* Base64 encode result */
    .b64-result-card { background: #f8fafc; border-radius: 12px; padding: 1rem; border: 1.5px solid #e2e8f0; }
    .b64-result-top  { display: flex; align-items: center; justify-content: space-between; margin-bottom: .625rem; }
    .b64-result-label { font-size: .7rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
    .b64-actions { display: flex; gap: .5rem; }
    .b64-copy-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .35rem .75rem;
                    background: #6366f1; color: white; font-size: .73rem; font-weight: 700;
                    border-radius: 7px; cursor: pointer; border: none; transition: all .18s; }
    .b64-copy-btn:hover { background: #4f46e5; }
    .b64-dl-btn   { display: inline-flex; align-items: center; gap: .35rem; padding: .35rem .75rem;
                    background: #0f172a; color: white; font-size: .73rem; font-weight: 700;
                    border-radius: 7px; cursor: pointer; border: none; transition: all .18s; }
    .b64-dl-btn:hover { background: #1e293b; }
    .b64-preview { font-family: monospace; font-size: .65rem; color: #334155;
                   word-break: break-all; max-height: 90px; overflow-y: auto; line-height: 1.5;
                   background: white; padding: .5rem; border-radius: 6px; border: 1px solid #e2e8f0; }
    .b64-stats { display: flex; gap: 1rem; margin-top: .5rem; }
    .b64-stat { font-size: .68rem; color: #94a3b8; }
    .b64-stat span { font-weight: 700; color: #475569; }

    /* ── OCR text result card ─── */
    .ocr-result-card { background: #f8fafc; border-radius: 12px; padding: 1rem; border: 1.5px solid #e2e8f0; margin-top: .25rem; }
    .ocr-result-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .75rem; gap: .5rem; flex-wrap: wrap; }
    .ocr-result-label { font-size: .72rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
    .ocr-chars { font-size: .68rem; color: #94a3b8; margin-left: .5rem; }
    .ocr-actions { display: flex; gap: .4rem; flex-wrap: wrap; }
    .ocr-copy-btn { display: inline-flex; align-items: center; gap: .3rem; padding: .35rem .7rem;
                    background: #6366f1; color: white; font-size: .72rem; font-weight: 700;
                    border-radius: 7px; cursor: pointer; border: none; transition: all .18s; }
    .ocr-copy-btn:hover { background: #4f46e5; }
    .ocr-dl-btn { display: inline-flex; align-items: center; gap: .3rem; padding: .35rem .7rem;
                  background: #0f172a; color: white; font-size: .72rem; font-weight: 700;
                  border-radius: 7px; cursor: pointer; border: none; transition: all .18s; }
    .ocr-dl-btn:hover { background: #1e293b; }
    .ocr-text-body { font-family: 'Inter', system-ui, sans-serif; font-size: .82rem; line-height: 1.7;
                     color: #1e293b; white-space: pre-wrap; word-break: break-word;
                     background: white; padding: .875rem 1rem; border-radius: 8px;
                     border: 1px solid #e2e8f0; max-height: 320px; overflow-y: auto; margin: 0; }
    .ocr-text-body::-webkit-scrollbar { width: 5px; }
    .ocr-text-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 5px; }

    /* OCR modal (historique) */
    .ocr-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); z-index: 1000;
                         display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .ocr-modal { background: white; border-radius: 18px; width: 100%; max-width: 640px;
                 max-height: 80vh; display: flex; flex-direction: column;
                 box-shadow: 0 24px 60px rgba(0,0,0,.25); animation: fadeIn .2s ease-out; }
    .ocr-modal-head { display: flex; align-items: center; justify-content: space-between;
                      padding: 1.25rem 1.5rem; border-bottom: 1.5px solid #f1f5f9; }
    .ocr-modal-title { font-family: 'Outfit',sans-serif; font-size: 1rem; font-weight: 800; color: #0f172a; }
    .ocr-modal-close { border: none; background: #f1f5f9; border-radius: 8px; width: 30px; height: 30px;
                       cursor: pointer; color: #64748b; font-size: 1rem; display: flex; align-items: center; justify-content: center; }
    .ocr-modal-close:hover { background: #fee2e2; color: #ef4444; }
    .ocr-modal-body { padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1; }
    .ocr-modal-text { font-family: 'Inter',system-ui,sans-serif; font-size: .85rem; line-height: 1.75;
                      color: #1e293b; white-space: pre-wrap; word-break: break-word; margin: 0; }
    .ocr-modal-foot { padding: 1rem 1.5rem; border-top: 1.5px solid #f1f5f9;
                      display: flex; gap: .5rem; justify-content: flex-end; }

    /* hist view text button */
    .hist-txt { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px;
                border-radius: 7px; background: #f5f3ff; color: #6366f1; border: none; cursor: pointer; transition: all .18s; }
    .hist-txt:hover { background: #ede9fe; }

    /* ── Toast notification ─── */
    .toast { position: fixed; bottom: 2rem; right: 2rem; z-index: 9999;
             background: #0f172a; color: white; padding: .75rem 1.25rem;
             border-radius: 12px; font-size: .82rem; font-weight: 700;
             display: flex; align-items: center; gap: .625rem;
             box-shadow: 0 8px 24px rgba(0,0,0,.25); animation: slideUp .25s ease-out; }
    .toast.success { border-left: 4px solid #22c55e; }
    .toast.info    { border-left: 4px solid #6366f1; }
    .toast-icon { font-size: 1rem; }
    @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }

    /* ── History panel ─── */
    .hist-panel { background: white; border-radius: 18px; border: 1.5px solid #f1f5f9;
                  padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,.05); }
    .hist-panel-head { display: flex; align-items: center; justify-content: space-between;
                       margin-bottom: 1.25rem; padding-bottom: 1rem; border-bottom: 1.5px solid #f1f5f9; }
    .hist-panel-title { font-family: 'Outfit', sans-serif; font-size: 1.05rem; font-weight: 800; color: #0f172a; }
    .hist-refresh { border: 1.5px solid #e2e8f0; background: white; color: #475569;
                    font-size: .75rem; font-weight: 700; padding: .35rem .8rem;
                    border-radius: 7px; cursor: pointer; transition: all .18s; display: flex; align-items: center; gap: .35rem; }
    .hist-refresh:hover { border-color: #6366f1; color: #6366f1; }
    .hist-empty { text-align: center; padding: 3rem 1rem; color: #94a3b8; font-size: .85rem; }
    .hist-empty-icon { font-size: 2.5rem; margin-bottom: .75rem; }
    .hist-table { width: 100%; border: 1.5px solid #f1f5f9; border-radius: 12px; overflow: hidden; }
    .hist-row   { display: grid; grid-template-columns: 110px 1fr 95px 85px 44px;
                  gap: .5rem; padding: .575rem .875rem; align-items: center; border-bottom: 1px solid #f8fafc;
                  transition: background .15s; }
    .hist-row:last-child { border-bottom: none; }
    .hist-row.hdr { background: #f8fafc; font-size: .66rem; font-weight: 800; text-transform: uppercase;
                    letter-spacing: .05em; color: #94a3b8; }
    .hist-row.h-done   { background: #f0fdf4; border-left: 3px solid #22c55e; }
    .hist-row.h-failed { background: #fef2f2; border-left: 3px solid #ef4444; }
    .hist-op    { font-size: .72rem; font-weight: 700; color: #6366f1; background: #f5f3ff; padding: .18rem .45rem; border-radius: 5px; width: fit-content; }
    .hist-file  { font-size: .75rem; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hist-date  { font-size: .68rem; color: #94a3b8; }
    .hist-stat  { font-size: .65rem; font-weight: 800; text-transform: uppercase; padding: .18rem .45rem; border-radius: 999px; width: fit-content; }
    .hist-stat.done { background: #f0fdf4; color: #16a34a; }
    .hist-stat.fail { background: #fef2f2; color: #dc2626; }
    .hist-stat.proc { background: #fffbeb; color: #d97706; }
    .hist-dl    { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px;
                  border-radius: 7px; background: #f1f5f9; color: #475569; border: none; cursor: pointer; transition: all .18s; }
    .hist-dl:hover { background: #dbeafe; color: #2563eb; }

    .animate-fade { animation: fadeIn .3s ease-out; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
  `],
  template: `
<!-- Toast -->
<div *ngIf="toastMsg" class="toast" [class.success]="toastType==='success'" [class.info]="toastType==='info'">
  <span class="toast-icon">{{ toastType === 'success' ? '✓' : 'ℹ' }}</span>
  {{ toastMsg }}
</div>

<div class="df-page">
  <div class="bg-blob b1"></div>
  <div class="bg-blob b2"></div>

  <div class="df-inner">

    <!-- Hero -->
    <div class="hero animate-fade">
      <h1 class="hero-h1">Vos fichiers,&nbsp;<span>transformes en quelques secondes.</span></h1>
      <span class="hero-sub">Fusionnez, convertissez, compressez, filigranez, encodez.</span>
    </div>

    <!-- Grid -->
    <div class="df-grid animate-fade" [class.expanded]="!sidebarCollapsed" [class.collapsed]="sidebarCollapsed">

      <!-- Sidebar -->
      <div class="sidebar-wrap">
        <button class="sidebar-toggle" (click)="sidebarCollapsed = !sidebarCollapsed"
                [title]="sidebarCollapsed ? 'Deployer' : 'Replier'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <ng-container *ngIf="!sidebarCollapsed">
              <line x1="3" y1="6"  x2="21" y2="6"/> <line x1="3" y1="12" x2="21" y2="12"/> <line x1="3" y1="18" x2="21" y2="18"/>
            </ng-container>
            <ng-container *ngIf="sidebarCollapsed"><polyline points="9 18 15 12 9 6"/></ng-container>
          </svg>
        </button>
        <nav class="ops-sidebar">
          <ng-container *ngFor="let grp of opGroups">
            <div class="ops-group-label" [class.hidden]="sidebarCollapsed">{{ grp.label }}</div>
            <button *ngFor="let op of grp.ops"
                    class="op-btn" [class.active]="view==='workspace' && selectedOp===op.id"
                    (click)="select(op.id)" [title]="sidebarCollapsed ? op.name : ''">
              <span class="op-ico">{{ op.icon }}</span>
              <ng-container *ngIf="!sidebarCollapsed">
                <div class="op-texts">
                  <span class="op-name">{{ op.name }}</span>
                  <span class="op-desc">{{ op.desc }}</span>
                </div>
                <svg *ngIf="view==='workspace'&&selectedOp===op.id" class="op-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              </ng-container>
            </button>
          </ng-container>
          <div class="sidebar-divider"></div>
          <button class="hist-nav-btn" [class.active]="view==='history'"
                  (click)="switchView('history')" [title]="sidebarCollapsed ? 'Historique' : ''">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span *ngIf="!sidebarCollapsed">Historique</span>
          </button>
        </nav>
      </div>

      <!-- WORKSPACE -->
      <div class="panel animate-fade" *ngIf="view==='workspace'">

        <div class="panel-head">
          <div class="panel-ico-wrap">{{ currentOp.icon }}</div>
          <div style="flex:1">
            <h2 class="panel-title">{{ currentOp.name }}</h2>
            <p class="panel-hint">{{ currentOp.hint }}</p>
          </div>
          <button *ngIf="files.length>0 || results.length>0" class="clear-btn" (click)="clearCurrentOp()" title="Effacer tout">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Effacer
          </button>
        </div>

        <!-- Base64 Decode -->
        <ng-container *ngIf="selectedOp==='base64-decode'">
          <div class="param-group">
            <label class="param-label">Donnees Base64 a decoder</label>
            <textarea class="b64-ta" [(ngModel)]="b64Input"
                      placeholder="Collez votre chaine Base64 ici (brut ou data:...;base64,...)"></textarea>
          </div>
          <div class="params-section" style="margin-top:.75rem">
            <div class="params-title">Format de sortie</div>
            <div class="ext-pills">
              <button *ngFor="let ext of extOptions" class="ext-pill"
                      [class.active]="b64Ext===ext.value"
                      (click)="setExt(ext.value)">{{ ext.label }}</button>
            </div>
            <div class="param-group" style="margin-top:.625rem">
              <label class="param-label">Nom du fichier</label>
              <input class="param-input" [(ngModel)]="b64OutputName" placeholder="fichier.pdf">
            </div>
          </div>
        </ng-container>

        <!-- Drop Zone -->
        <div *ngIf="selectedOp!=='base64-decode'" style="position:relative">
          <div class="drop-zone" [class.drag]="isDragging&&!busy" [class.filled]="files.length>0" [class.locked]="busy"
               (dragover)="onDragOver($event)" (dragleave)="isDragging=false"
               (drop)="onDrop($event)" (click)="!busy && fi.click()">
            <input #fi type="file" style="display:none"
                   [multiple]="currentOp.multi"
                   (change)="onFileSel($event)">
            <div class="drop-up-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p class="drop-title">{{ files.length>0 ? files.length+' fichier(s) charge(s)' : 'Deposez vos fichiers ici' }}</p>
            <p class="drop-sub">{{ files.length>0 ? fmtTotalSize() : currentOp.hint }}</p>
            <div class="fmt-row"><span *ngFor="let f of currentOp.formats" class="fmt-chip">{{ f }}</span></div>
            <p *ngIf="busy" class="drop-lock-msg">⏳ Traitement en cours — dépôt désactivé</p>
          </div>
        </div>

        <!-- File list -->
        <ng-container *ngIf="files.length>0">
          <div class="file-list-head">
            <div class="select-all-wrap">
              <input type="checkbox" class="cb-all" id="cbAll"
                     [checked]="allChecked" [indeterminate]="someChecked&&!allChecked"
                     (change)="toggleAll($event)">
              <label class="cb-all-label" for="cbAll">{{ allChecked?'Tout decocher':'Tout cocher' }}</label>
            </div>
            <span class="sel-count">{{ checkedCount }}/{{ files.length }}</span>
          </div>
          <div class="file-list">
            <div *ngFor="let f of files; let i=index"
                 class="file-row"
                 [class.drag-over]="dragOverIdx===i"
                 [class.unchecked]="!checked[i] && results[i]?.status!=='DONE'"
                 [class.done]="results[i]?.status==='DONE'"
                 [class.selected]="selectedResultIdx===i"
                 [class.row-failed]="results[i]?.status==='FAILED'"
                 [class.row-working]="results[i]?.status==='WORKING'"
                 [draggable]="currentOp.multi && !busy"
                 (click)="onRowClick(i)"
                 (dragstart)="!busy && onFileDragStart(i)"
                 (dragover)="!busy && onFileDragOver($event,i)"
                 (dragleave)="dragOverIdx=-1"
                 (drop)="!busy && onFileDrop(i)">
              <input type="checkbox" class="file-cb" [(ngModel)]="checked[i]" (click)="$event.stopPropagation()">
              <span *ngIf="currentOp.multi && !busy" class="file-drag-handle">&#8801;</span>
              <span class="file-ico">{{ fileIcon(f.name) }}</span>
              <div class="file-info">
                <div class="file-name" [title]="f.name">{{ f.name }}</div>
                <div class="file-size">{{ fmtSize(f.size) }}</div>
              </div>
              <!-- Badge statut -->
              <span *ngIf="results[i]?.status==='DONE'"    class="file-status-badge fsb-done">✓ Traité</span>
              <span *ngIf="results[i]?.status==='FAILED'"  class="file-status-badge fsb-failed">✗ Erreur</span>
              <span *ngIf="results[i]?.status==='WORKING'" class="file-status-badge fsb-working">⏳</span>
              <button class="file-rm" [disabled]="busy" (click)="removeFile(i);$event.stopPropagation()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <!-- Prévisualisation inline du résultat sélectionné -->
          <ng-container *ngIf="selectedResultIdx>=0 && results[selectedResultIdx] as sr">
            <!-- OCR / texte -->
            <div *ngIf="ocrText(sr)" class="inline-preview">
              <div class="inline-preview-head">
                <span class="inline-preview-label">🔎 Texte extrait — {{ ocrText(sr)!.length | number }} car.</span>
                <span class="inline-preview-hint">{{ files[selectedResultIdx]?.name }}</span>
                <div class="inline-preview-actions">
                  <button class="ocr-copy-btn" (click)="copyOcrText(sr)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copier
                  </button>
                  <button class="ocr-dl-btn" (click)="downloadOcrText(sr)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    .txt
                  </button>
                </div>
              </div>
              <div class="inline-preview-body">
                <pre class="inline-result-text">{{ ocrText(sr) }}</pre>
              </div>
            </div>
            <!-- Fichier généré (PDF, DOCX…) -->
            <div *ngIf="!ocrText(sr) && sr.status==='DONE' && sr.jobId && !sr.base64" class="inline-preview">
              <div class="inline-preview-head">
                <span class="inline-preview-label">✅ Traitement terminé</span>
                <span class="inline-preview-hint">{{ files[selectedResultIdx]?.name }}</span>
              </div>
              <div class="inline-preview-body">
                <div class="inline-dl-row">
                  <button class="dl-btn-sm" (click)="downloadJob(sr.jobId!,sr.fileName)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Télécharger {{ sr.fileName }}
                  </button>
                </div>
              </div>
            </div>
            <!-- Base64 -->
            <div *ngIf="sr.base64" class="inline-preview">
              <div class="inline-preview-head">
                <span class="inline-preview-label">🔑 Base64 encodé</span>
                <span class="inline-preview-hint">{{ (sr.base64||'').length | number }} car.</span>
                <div class="inline-preview-actions">
                  <button class="ocr-copy-btn" (click)="copyB64(sr)">Copier</button>
                  <button class="ocr-dl-btn"   (click)="downloadB64Text(sr)">.txt</button>
                </div>
              </div>
              <div class="inline-preview-body">
                <div class="b64-preview">{{ sr.base64 | slice:0:240 }}{{ (sr.base64||'').length>240?'...':'' }}</div>
              </div>
            </div>
            <!-- Erreur -->
            <div *ngIf="sr.status==='FAILED'" class="inline-preview" style="border-color:#fca5a5">
              <div class="inline-preview-head" style="background:#fef2f2;border-bottom-color:#fca5a5">
                <span class="inline-preview-label" style="color:#dc2626">✗ Echec du traitement</span>
              </div>
              <div class="inline-preview-body">
                <p style="font-size:.8rem;color:#dc2626;margin:0">{{ sr.error }}</p>
              </div>
            </div>
          </ng-container>
        </ng-container>

        <!-- Params -->
        <div *ngIf="needsParams" class="params-section">
          <div class="params-title">Options</div>
          <div *ngIf="selectedOp==='split'" class="params-grid">
            <div class="param-group"><label class="param-label">Page debut</label><input type="number" class="param-input" [(ngModel)]="splitStart" min="1"></div>
            <div class="param-group"><label class="param-label">Page fin</label><input type="number" class="param-input" [(ngModel)]="splitEnd" min="1"></div>
          </div>
          <div *ngIf="selectedOp==='watermark'" class="params-grid">
            <div class="param-group"><label class="param-label">Texte</label><input type="text" class="param-input" [(ngModel)]="watermarkText" placeholder="CONFIDENTIEL"></div>
            <div class="param-group">
              <label class="param-label">Rotation</label>
              <div class="rot-pills">
                <button class="rot-pill" [class.active]="watermarkRot===0"  (click)="watermarkRot=0">0°</button>
                <button class="rot-pill" [class.active]="watermarkRot===45" (click)="watermarkRot=45">45°</button>
                <button class="rot-pill" [class.active]="watermarkRot===90" (click)="watermarkRot=90">90°</button>
                <button class="rot-pill" [class.active]="watermarkRot===-1" (click)="watermarkRot=-1">Libre</button>
              </div>
              <input *ngIf="watermarkRot===-1" type="number" class="param-input" style="margin-top:.3rem" [(ngModel)]="watermarkCustomRot" placeholder="Ex: 30">
            </div>
            <div class="param-group">
              <label class="param-label">Couleur</label>
              <div class="param-row">
                <input type="color" class="color-preview" [(ngModel)]="watermarkColor">
                <input type="text" class="param-input" [(ngModel)]="watermarkColor" placeholder="#808080" style="flex:1">
              </div>
            </div>
          </div>
          <div *ngIf="selectedOp==='compress'" class="params-grid">
            <div class="param-group">
              <label class="param-label">Format de sortie</label>
              <select class="param-select" [(ngModel)]="compressFormat">
                <option value="zip">ZIP</option>
                <option value="pdf">PDF compresse</option>
              </select>
            </div>
          </div>
        </div>

        <!-- CTA -->
        <div class="cta-wrap">
          <button class="cta-btn" [disabled]="!canSubmit" (click)="submit()">
            <ng-container *ngIf="!busy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {{ currentOp.name }}
              <span *ngIf="checkedCount>0&&checkedCount<files.length" style="font-size:.74rem;opacity:.8">({{ checkedCount }})</span>
            </ng-container>
            <ng-container *ngIf="busy"><span class="spin-sm"></span>Traitement...</ng-container>
          </button>
          <div *ngIf="busy" class="prog-wrap">
            <div class="prog-bar"><div class="prog-fill" [style.width]="progress+'%'"></div></div>
            <p class="prog-text">{{ progressMsg }}</p>
          </div>
        </div>

        <!-- Résultat fusion (1 seul job — merge/merge-docx) -->
        <div *ngIf="results.length===1 && results[0].status!=='WORKING' && !files.length" class="results-list">
          <div class="result-item">
            <div class="result-item-head">
              <span class="result-item-fname">{{ results[0].fileName }}</span>
              <span class="result-item-status" [class.s-done]="results[0].status==='DONE'" [class.s-failed]="results[0].status==='FAILED'">
                {{ results[0].status==='DONE'?'Termine':'Echec' }}
              </span>
            </div>
            <div class="result-item-body">
              <p *ngIf="results[0].status==='FAILED'" class="res-error-small">⚠ {{ results[0].error }}</p>
              <button *ngIf="results[0].status==='DONE'&&results[0].jobId" class="dl-btn-sm" (click)="downloadJob(results[0].jobId!,results[0].fileName)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Telecharger le fichier fusionné
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- HISTORY VIEW -->
      <div class="hist-panel animate-fade" *ngIf="view==='history'">
        <div class="hist-panel-head">
          <h3 class="hist-panel-title">Historique de traitements</h3>
          <button class="hist-refresh" (click)="loadJobs()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Actualiser
          </button>
        </div>
        <div *ngIf="jobs.length===0" class="hist-empty">
          <div class="hist-empty-icon">🗂️</div>
          <p>Aucun traitement effectue pour le moment.</p>
        </div>
        <div *ngIf="jobs.length>0" class="hist-table">
          <div class="hist-row hdr"><span>Operation</span><span>Fichier</span><span>Date ▼</span><span>Statut</span><span></span></div>
          <div *ngFor="let j of jobs" class="hist-row"
               [class.h-done]="j.status==='DONE'"
               [class.h-failed]="j.status==='FAILED'">
            <span class="hist-op">{{ j.operation }}</span>
            <span class="hist-file" [title]="j.fileName">{{ j.fileName||'—' }}</span>
            <span class="hist-date">{{ j.createdAt | date:'dd/MM HH:mm' }}</span>
            <span class="hist-stat" [class.done]="j.status==='DONE'" [class.fail]="j.status==='FAILED'" [class.proc]="j.status==='PROCESSING'">
              {{ j.status==='DONE'?'Termine':j.status==='FAILED'?'Echec':'En cours' }}
            </span>
            <!-- OCR → bouton texte -->
            <button *ngIf="j.status==='DONE' && j.operation==='OCR' && j.resultText" class="hist-txt" (click)="openOcrModal(j)" title="Voir le texte extrait">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <!-- Autres → bouton download -->
            <button *ngIf="j.status==='DONE' && j.operation!=='OCR'" class="hist-dl" (click)="downloadJob(j.jobId,j.fileName)" title="Telecharger">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <span *ngIf="j.status!=='DONE'"></span>
          </div>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- Modal OCR texte (historique) -->
<div *ngIf="ocrModal" class="ocr-modal-overlay" (click)="ocrModal=null">
  <div class="ocr-modal" (click)="$event.stopPropagation()">
    <div class="ocr-modal-head">
      <div>
        <div class="ocr-modal-title">🔎 Texte extrait</div>
        <div style="font-size:.72rem;color:#94a3b8;margin-top:.15rem">{{ ocrModal.fileName }} · {{ (ocrModal.resultText||'').length | number }} car.</div>
      </div>
      <button class="ocr-modal-close" (click)="ocrModal=null">✕</button>
    </div>
    <div class="ocr-modal-body">
      <pre class="ocr-modal-text">{{ ocrModal.resultText }}</pre>
    </div>
    <div class="ocr-modal-foot">
      <button class="ocr-copy-btn" (click)="copyText(ocrModal.resultText)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copier le texte
      </button>
      <button class="ocr-dl-btn" (click)="downloadTextFile(ocrModal.resultText, ocrModal.fileName)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Télécharger .txt
      </button>
    </div>
  </div>
</div>
  `
})
export class DocFusionComponent implements OnInit, OnDestroy {

  view: View     = 'workspace';
  selectedOp: Op = 'merge';
  sidebarCollapsed = false;

  files: File[]      = [];
  checked: boolean[] = [];
  isDragging     = false;
  busy           = false;
  progress       = 0;
  progressMsg    = '';

  // Multi-résultats
  results: JobResult[] = [];

  jobs: any[]    = [];
  b64Input       = '';
  b64OutputName  = 'fichier.pdf';
  b64Ext         = '.pdf';
  dragIdx        = -1;
  dragOverIdx    = -1;

  toastMsg  = '';
  toastType = 'success';
  private toastTimer: any;

  // OCR modal (historique)
  ocrModal: any = null;

  // Résultat sélectionné dans la liste (prévisualisation inline)
  selectedResultIdx = -1;

  // État persistant par opération (pas d'effacement au changement d'onglet)
  private opStates = new Map<Op, OpState>();

  splitStart = 1; splitEnd = 5;
  watermarkText = 'CONFIDENTIEL'; watermarkRot = 45; watermarkCustomRot = 45; watermarkColor = '#808080';
  compressFormat = 'zip';

  readonly extOptions = EXT_OPTIONS;

  private pollTimers: Map<string, any> = new Map();

  opGroups = [
    {
      label: 'PDF',
      ops: [
        { id: 'merge'      as Op, icon: '🔗', name: 'Fusionner',     desc: 'PDF, Images, DOCX, TXT',  hint: 'Glissez au moins 2 fichiers',  formats: ['PDF','JPG','PNG','DOCX','TXT'], group:'PDF', multi:true  },
        { id: 'merge-docx' as Op, icon: '📝', name: 'Fusionner DOCX', desc: 'Vers Word unifie',        hint: 'Glissez 2+ fichiers',          formats: ['PDF','DOCX','DOC','TXT'],      group:'PDF', multi:true  },
        { id: 'split'      as Op, icon: '✂️', name: 'Decouper',      desc: 'Extraire des pages',      hint: 'PDF + plage de pages',         formats: ['PDF'],                          group:'PDF', multi:false },
        { id: 'compress'   as Op, icon: '📦', name: 'Compresser',    desc: 'Reduire la taille',       hint: '1 PDF a compresser',           formats: ['PDF'],                          group:'PDF', multi:false },
        { id: 'watermark'  as Op, icon: '💧', name: 'Filigrane',     desc: 'Rotation + couleur',      hint: '1 PDF',                        formats: ['PDF'],                          group:'PDF', multi:false },
      ]
    },
    {
      label: 'Conversion',
      ops: [
        { id: 'to-pdf'  as Op, icon: '📄', name: 'Vers PDF',    desc: 'Image / DOCX / TXT → PDF',  hint: 'Glissez 1 ou plusieurs fichiers', formats: ['JPG','PNG','WebP','DOCX','TXT'], group:'Conversion', multi:true },
        { id: 'to-docx' as Op, icon: '📃', name: 'Vers DOCX',   desc: 'PDF / Image → Word',        hint: 'Glissez 1 ou plusieurs fichiers', formats: ['PDF','JPG','PNG','WebP'],        group:'Conversion', multi:true },
        { id: 'ocr'     as Op, icon: '🔎', name: 'OCR',         desc: 'Extraire le texte (LLM)',   hint: 'Glissez 1 ou plusieurs fichiers', formats: ['JPG','PNG','WebP','PDF'],        group:'Conversion', multi:true },
      ]
    },
    {
      label: 'Utilitaires',
      ops: [
        { id: 'base64-encode' as Op, icon: '🔑', name: 'Encoder Base64', desc: 'Fichier → Base64', hint: 'Glissez 1 ou plusieurs fichiers', formats: ['Tout'],  group:'Utilitaires', multi:true  },
        { id: 'base64-decode' as Op, icon: '🔓', name: 'Decoder Base64', desc: 'Base64 → Fichier', hint: 'Collez votre Base64 ci-dessous',  formats: [],       group:'Utilitaires', multi:false },
      ]
    }
  ];

  get allOps(): OpDef[] { return this.opGroups.flatMap(g => g.ops as OpDef[]); }
  get currentOp(): OpDef { return this.allOps.find(o => o.id === this.selectedOp)!; }
  get needsParams(): boolean { return ['split','watermark','compress'].includes(this.selectedOp); }
  get checkedCount(): number { return this.checked.filter(Boolean).length; }
  get allChecked(): boolean  { return this.files.length > 0 && this.checked.every(Boolean); }
  get someChecked(): boolean { return this.checked.some(Boolean); }
  get checkedFiles(): File[] { return this.files.filter((_, i) => this.checked[i]); }
  get canSubmit(): boolean {
    if (this.busy) return false;
    if (this.selectedOp === 'base64-decode') return this.b64Input.trim().length > 0;
    const a = this.checkedFiles;
    if (this.selectedOp === 'merge' || this.selectedOp === 'merge-docx') return a.length >= 2;
    return a.length >= 1;
  }

  constructor(private http: HttpClient, private auth: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit()    { this.loadJobs(); }
  ngOnDestroy() { this.pollTimers.forEach(t => clearInterval(t)); }

  switchView(v: View) { this.view = v; if (v === 'history') this.loadJobs(); }

  select(op: Op) {
    this.view = 'workspace';
    // Sauvegarder l'état de l'opération courante avant de changer
    this.saveOpState(this.selectedOp);
    this.selectedOp = op;
    // Restaurer l'état de la nouvelle opération (ou état vide)
    this.restoreOpState(op);
    this.progress = 0; this.progressMsg = '';
  }

  private saveOpState(op: Op) {
    this.opStates.set(op, {
      files: [...this.files],
      checked: [...this.checked],
      results: [...this.results],
      b64Input: this.b64Input,
      selectedResultIdx: this.selectedResultIdx,
    });
  }

  private restoreOpState(op: Op) {
    const s = this.opStates.get(op);
    if (s) {
      this.files = s.files; this.checked = s.checked;
      this.results = s.results; this.b64Input = s.b64Input;
      this.selectedResultIdx = s.selectedResultIdx;
    } else {
      this.files = []; this.checked = []; this.results = [];
      this.b64Input = ''; this.selectedResultIdx = -1;
    }
  }

  clearCurrentOp() {
    this.files = []; this.checked = []; this.results = [];
    this.b64Input = ''; this.selectedResultIdx = -1; this.progress = 0;
    this.opStates.delete(this.selectedOp);
    this.cdr.detectChanges();
  }

  onRowClick(i: number) {
    if (!this.results[i] || this.results[i].status === 'WORKING') return;
    // Toggle : clic sur la même ligne ferme la prévisualisation
    this.selectedResultIdx = this.selectedResultIdx === i ? -1 : i;
    this.cdr.detectChanges();
  }

  setExt(ext: string) {
    this.b64Ext = ext;
    const base = this.b64OutputName.replace(/\.[^.]+$/, '');
    this.b64OutputName = base + ext;
  }

  toggleAll(e: Event) {
    const v = (e.target as HTMLInputElement).checked;
    this.checked = this.files.map(() => v);
  }

  onFileSel(e: any) {
    if (this.busy) return;
    const inc: File[] = Array.from(e.target.files || []);
    if (this.currentOp.multi) {
      this.files   = [...this.files, ...inc];
      this.checked = [...this.checked, ...inc.map(() => true)];
    } else {
      this.files = inc.slice(0, 1); this.checked = [true]; this.results = [];
    }
    e.target.value = '';
  }

  onDragOver(e: DragEvent) {
    if (this.busy) return;
    e.preventDefault(); this.isDragging = true;
  }
  onDrop(e: DragEvent) {
    if (this.busy) { e.preventDefault(); return; }
    e.preventDefault(); this.isDragging = false;
    const inc: File[] = Array.from(e.dataTransfer?.files || []);
    if (this.currentOp.multi) {
      this.files   = [...this.files, ...inc];
      this.checked = [...this.checked, ...inc.map(() => true)];
    } else {
      this.files = inc.slice(0, 1); this.checked = [true]; this.results = [];
    }
  }

  removeFile(i: number) {
    if (this.busy) return;
    this.files   = this.files.filter((_, idx) => idx !== i);
    this.checked = this.checked.filter((_, idx) => idx !== i);
    this.results = this.results.filter((_, idx) => idx !== i);
    if (this.selectedResultIdx === i) this.selectedResultIdx = -1;
    else if (this.selectedResultIdx > i) this.selectedResultIdx--;
  }

  onFileDragStart(i: number) { this.dragIdx = i; }
  onFileDragOver(e: DragEvent, i: number) { e.preventDefault(); this.dragOverIdx = i; }
  onFileDrop(t: number) {
    if (this.dragIdx < 0 || this.dragIdx === t) { this.dragOverIdx = -1; return; }
    const [a, c] = [[...this.files], [...this.checked]];
    const [mf] = a.splice(this.dragIdx, 1); const [mc] = c.splice(this.dragIdx, 1);
    a.splice(t, 0, mf); c.splice(t, 0, mc);
    this.files = a; this.checked = c; this.dragIdx = -1; this.dragOverIdx = -1;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  submit() {
    this.selectedResultIdx = -1;
    this.results = []; this.busy = true; this.progress = 10; this.progressMsg = 'Envoi...';

    if (this.selectedOp === 'base64-decode') { this.submitBase64Decode(); return; }

    const active = this.checkedFiles;

    // Opérations fusionnant tous les fichiers → 1 seul job
    if (this.selectedOp === 'merge' || this.selectedOp === 'merge-docx') {
      this.submitMerge(active); return;
    }

    // Opérations à 1 fichier mais acceptant batch → N jobs parallèles
    active.forEach(f => {
      this.results.push({ fileName: f.name, status: 'WORKING' });
    });
    this.cdr.detectChanges();

    let done = 0;
    active.forEach((f, idx) => {
      this.submitSingle(f, idx, () => {
        done++;
        if (done === active.length) {
          this.busy = false; this.progress = 100; this.progressMsg = '';
          this.loadJobs(); this.cdr.detectChanges();
        }
      });
    });
  }

  private submitMerge(active: File[]) {
    const headers = new HttpHeaders({ 'X-User-Email': this.auth.currentUser()?.email || 'anonymous' });
    const fd = new FormData();
    const url = this.selectedOp === 'merge' ? GW+'/pdf/merge' : GW+'/pdf/merge-docx';
    active.forEach(f => fd.append('files', f));
    this.results = [{ fileName: active.map(f => f.name).join(' + '), status: 'WORKING' }];

    this.http.post<any>(url, fd, { headers }).subscribe({
      next: res => { this.progress = 40; this.progressMsg = 'Fusion...'; this.pollJobResult(res.jobId, 0); },
      error: err => { this.results[0] = { fileName: this.results[0].fileName, status: 'FAILED', error: err.error?.error||err.message }; this.busy = false; this.cdr.detectChanges(); }
    });
  }

  private submitSingle(file: File, idx: number, onDone: () => void) {
    const headers = new HttpHeaders({ 'X-User-Email': this.auth.currentUser()?.email || 'anonymous' });
    const fd = new FormData();
    let url = '';

    if (this.selectedOp === 'base64-encode') {
      fd.append('file', file);
      this.http.post<any>(GW+'/convert/base64/encode', fd, { headers }).subscribe({
        next:  res => { this.results[idx] = { fileName: file.name, status: 'DONE', operationType:'BASE64_ENCODE', base64: res.base64, sizeBytes: res.sizeBytes, base64Length: res.base64Length }; this.cdr.detectChanges(); onDone(); },
        error: err => { this.results[idx] = { fileName: file.name, status: 'FAILED', error: err.error?.error||err.message }; this.cdr.detectChanges(); onDone(); }
      });
      return;
    }

    switch (this.selectedOp) {
      case 'to-pdf':  url = GW+'/convert/to-pdf';  fd.append('file', file); break;
      case 'to-docx': url = GW+'/convert/to-docx'; fd.append('file', file); break;
      case 'ocr':     url = GW+'/ocr';              fd.append('file', file); break;
      case 'split':
        url = GW+'/pdf/split';
        fd.append('file', file); fd.append('start', String(this.splitStart)); fd.append('end', String(this.splitEnd)); break;
      case 'compress':
        url = GW+'/pdf/compress';
        fd.append('file', file); fd.append('outputFormat', this.compressFormat); break;
      case 'watermark': {
        const rot = this.watermarkRot===-1 ? this.watermarkCustomRot : this.watermarkRot;
        url = GW+'/pdf/watermark';
        fd.append('file', file); fd.append('text', this.watermarkText); fd.append('rotation', String(rot)); fd.append('color', this.watermarkColor); break;
      }
    }

    this.http.post<any>(url, fd, { headers }).subscribe({
      next:  res => { this.progress = 40; this.pollJobResult(res.jobId, idx, onDone); },
      error: err => { this.results[idx] = { fileName: file.name, status: 'FAILED', error: err.error?.error||err.message }; this.cdr.detectChanges(); onDone(); }
    });
  }

  private submitBase64Decode() {
    const fd = new FormData();
    fd.append('base64Data', this.b64Input.trim());
    fd.append('filename', this.b64OutputName);

    this.http.post(GW+'/convert/base64/decode', fd, { responseType: 'blob', observe: 'response' }).subscribe({
      next: resp => {
        const url = URL.createObjectURL(resp.body!);
        const a = document.createElement('a'); a.href = url; a.download = this.b64OutputName; a.click(); URL.revokeObjectURL(url);
        this.busy = false; this.progress = 100;
        this.results = [{ fileName: this.b64OutputName, status: 'DONE', operationType: 'BASE64_DECODE' }];
        this.showToast('Fichier decode et telecharge', 'success'); this.cdr.detectChanges();
      },
      error: err => {
        this.busy = false;
        const blob: Blob = err.error;
        if (blob instanceof Blob) {
          blob.text().then(t => {
            let m = 'Erreur decodage'; try { m = JSON.parse(t).error||m; } catch {}
            this.results = [{ fileName: this.b64OutputName, status: 'FAILED', error: m }]; this.cdr.detectChanges();
          });
        } else { this.results = [{ fileName: this.b64OutputName, status: 'FAILED', error: err.error?.error||'Base64 invalide' }]; this.cdr.detectChanges(); }
      }
    });
  }

  // ─── Polling ─────────────────────────────────────────────────────────────

  private pollJobResult(jobId: string, idx: number, onDone?: () => void) {
    let attempts = 0;
    const isOcr = this.selectedOp === 'ocr';
    const timer = setInterval(() => {
      attempts++;
      if (attempts > 300) {
        clearInterval(timer); this.pollTimers.delete(jobId);
        this.results[idx] = { ...this.results[idx], status: 'FAILED', error: 'Timeout (5 min)' };
        this.cdr.detectChanges(); onDone?.(); return;
      }
      this.progress = Math.round(Math.min(40 + attempts * (isOcr ? 0.28 : 0.8), 92));
      this.progressMsg = isOcr ? `OCR en cours... (${attempts}s)` : `Traitement... (${attempts}s)`;

      this.http.get<any>(GW+'/jobs/'+jobId).subscribe({ next: res => {
        if (res.status === 'DONE' || res.status === 'FAILED') {
          clearInterval(timer); this.pollTimers.delete(jobId);
          this.results[idx] = { ...this.results[idx], ...res, jobId };
          // Auto-sélectionner si fichier unique ou si aucune sélection active
          if (this.selectedResultIdx === -1) this.selectedResultIdx = idx;
          this.cdr.detectChanges(); onDone?.();
        }
      }});
    }, 1000);
    this.pollTimers.set(jobId, timer);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  downloadJob(jobId: string, fileName: string) {
    const headers = new HttpHeaders({ 'X-User-Email': this.auth.currentUser()?.email || 'anonymous' });
    this.http.get(GW+'/jobs/'+jobId+'/download', { headers, responseType: 'blob' }).subscribe({
      next: blob => { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = fileName||'resultat'; a.click(); URL.revokeObjectURL(u); },
      error: () => this.showToast('Impossible de telecharger', 'info')
    });
  }

  copyB64(r: JobResult) {
    if (!r.base64) return;
    navigator.clipboard.writeText(r.base64).then(() => {
      this.showToast('Base64 copie dans le presse-papiers ✓', 'success');
    }).catch(() => {
      // fallback textarea
      const ta = document.createElement('textarea'); ta.value = r.base64!;
      document.body.appendChild(ta); ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      this.showToast('Base64 copie ✓', 'success');
    });
  }

  downloadB64Text(r: JobResult) {
    if (!r.base64) return;
    const blob = new Blob([r.base64], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = (r.fileName || 'base64') + '.txt';
    a.click(); URL.revokeObjectURL(url);
    this.showToast('Fichier .txt telecharge', 'success');
  }

  // ─── OCR helpers ─────────────────────────────────────────────────────────

  /** Retourne le texte OCR quelle que soit la clé (text ou resultText) */
  ocrText(r: JobResult): string | null {
    const t = r.text || r.resultText || null;
    return t && t.trim().length > 0 ? t : null;
  }

  copyOcrText(r: JobResult) {
    const t = this.ocrText(r);
    if (t) this.copyText(t);
  }

  downloadOcrText(r: JobResult) {
    const t = this.ocrText(r);
    if (t) this.downloadTextFile(t, r.fileName || 'ocr_result');
  }

  copyText(text: string | undefined | null) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Texte copie dans le presse-papiers ✓', 'success');
    }).catch(() => {
      const ta = document.createElement('textarea'); ta.value = text;
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.showToast('Texte copie ✓', 'success');
    });
  }

  downloadTextFile(text: string | undefined | null, sourceName: string | undefined) {
    if (!text) return;
    const base = (sourceName || 'ocr_result').replace(/\.[^.]+$/, '');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = base + '.txt'; a.click();
    URL.revokeObjectURL(url);
    this.showToast('Fichier .txt telecharge', 'success');
  }

  openOcrModal(job: any) { this.ocrModal = job; }

  showToast(msg: string, type: 'success'|'info' = 'success') {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMsg = msg; this.toastType = type; this.cdr.detectChanges();
    this.toastTimer = setTimeout(() => { this.toastMsg = ''; this.cdr.detectChanges(); }, 3000);
  }

  loadJobs() {
    const headers = new HttpHeaders({ 'X-User-Email': this.auth.currentUser()?.email || 'anonymous' });
    this.http.get<any[]>(GW+'/jobs', { headers }).subscribe({
      next: j => {
        // Tri du plus récent au plus ancien
        this.jobs = (j || []).sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      },
      error: () => {}
    });
  }

  fmtSize(b: number): string {
    if (b < 1024) return b+' o'; if (b < 1048576) return (b/1024).toFixed(1)+' Ko'; return (b/1048576).toFixed(2)+' Mo';
  }
  fmtTotalSize(): string {
    return this.files.length+' fichier(s) — '+this.fmtSize(this.files.reduce((s,f) => s+f.size, 0));
  }
  fileIcon(name: string): string {
    const e = (name||'').split('.').pop()?.toLowerCase();
    if (e==='pdf') return '📄'; if (['doc','docx'].includes(e!)) return '📝';
    if (['xls','xlsx'].includes(e!)) return '📊'; if (['jpg','jpeg','png','gif','bmp','webp'].includes(e!)) return '🖼️';
    if (['mp3','wav','flac'].includes(e!)) return '🎵'; if (['mp4','avi','mkv'].includes(e!)) return '🎬';
    if (['zip','rar'].includes(e!)) return '📦'; return '📎';
  }
}
