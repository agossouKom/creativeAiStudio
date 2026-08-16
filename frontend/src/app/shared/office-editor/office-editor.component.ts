import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild, inject, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type OfficeDocType = 'word' | 'cell' | 'slide';

export interface OfficeEditorConfig {
  docType:     OfficeDocType;
  title:       string;
  documentUrl: string;   // URL accessible depuis le container OnlyOffice (réseau Docker)
  fileType?:   string;   // 'docx' | 'html' | 'xlsx' | 'pptx' (défaut: selon docType)
  callbackUrl?: string;  // URL de sauvegarde OnlyOffice (doit être joignable depuis le container)
  downloadKey?: string;  // Clé Redis pour télécharger le DOCX sauvegardé
  lang?:       string;
}

// Extension de Window pour DocsAPI OnlyOffice
declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (container: string | HTMLElement, config: object) => OnlyOfficeEditor;
    };
  }
}

interface OnlyOfficeEditor {
  destroyEditor(): void;
}

@Component({
  selector: 'app-office-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="oe-root">

      <!-- Barre supérieure -->
      <div class="oe-topbar">
        <div class="oe-topbar-left">
          <span class="oe-type-icon">{{ typeIcon }}</span>
          <span class="oe-title">{{ config.title }}</span>
        </div>
        <div class="oe-topbar-right">
          <button class="oe-btn oe-btn-ghost" (click)="cancel.emit()" title="Fermer l'éditeur">
            ✕ Fermer
          </button>
        </div>
      </div>

      <!-- Indicateur de chargement -->
      <div class="oe-loading" *ngIf="loading">
        <div class="oe-loading-spinner"></div>
        <p>Chargement de l'éditeur Office…</p>
      </div>

      <!-- Erreur -->
      <div class="oe-error" *ngIf="error">
        <div class="oe-error-icon">⚠️</div>
        <h3>OnlyOffice — Erreur de chargement</h3>
        <p *ngIf="errorMsg">{{ errorMsg }}</p>
        <p *ngIf="!errorMsg">Le service OnlyOffice a renvoyé une erreur.</p>
        <code *ngIf="errorCode !== null">Code : {{ errorCode }}</code>
        <button class="oe-btn oe-btn-primary" (click)="retryInit()">Réessayer</button>
        <button class="oe-btn oe-btn-ghost" (click)="cancel.emit()">Fermer</button>
      </div>

      <!-- Conteneur OnlyOffice — toujours visible pour que l'iframe puisse s'initialiser -->
      <div #editorContainer [id]="containerId" class="oe-container"></div>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; height: 100%; }

    .oe-root {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #1a1f2e;
      position: relative;
    }

    .oe-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      height: 44px;
      background: #0f172a;
      border-bottom: 1px solid #334155;
      flex-shrink: 0;
      z-index: 10;
    }
    .oe-topbar-left { display: flex; align-items: center; gap: .6rem; }
    .oe-type-icon { font-size: 1.2rem; }
    .oe-title { font-size: .85rem; font-weight: 700; color: #f1f5f9; }
    .oe-topbar-right { display: flex; gap: .5rem; }

    .oe-btn {
      padding: .35rem .9rem;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: .78rem;
      font-weight: 700;
      transition: .2s;
    }
    .oe-btn-primary  { background: #3b82f6; color: #fff; }
    .oe-btn-primary:hover { background: #2563eb; }
    .oe-btn-ghost    { background: rgba(255,255,255,.08); color: #94a3b8; }
    .oe-btn-ghost:hover { background: rgba(255,255,255,.15); color: #f1f5f9; }

    .oe-loading, .oe-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 1rem;
      color: #94a3b8;
      font-size: .9rem;
    }
    .oe-loading-spinner {
      width: 44px; height: 44px;
      border: 3px solid #334155;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .oe-error { background: #0f172a; }
    .oe-error-icon { font-size: 3rem; }
    .oe-error h3 { color: #f1f5f9; margin: 0; }
    .oe-error code {
      background: #1e293b;
      padding: .4rem .8rem;
      border-radius: 8px;
      font-family: monospace;
      font-size: .8rem;
      color: #67e8f9;
    }

    .oe-container {
      flex: 1;
      min-height: 0;
      height: 100%;
      background: #f1f5f9;
    }
    .oe-container iframe { width: 100% !important; height: 100% !important; border: none; }

    /* Spinner/error superposés par-dessus le container (pas display:none) */
    .oe-loading, .oe-error {
      position: absolute;
      inset: 44px 0 0 0;
      z-index: 20;
      background: #0f172a;
    }
  `]
})
export class OfficeEditorComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input()  config!: OfficeEditorConfig;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved  = new EventEmitter<string>(); // émet le downloadKey quand doc sauvegardé

  @ViewChild('editorContainer') containerRef!: ElementRef<HTMLDivElement>;

  private zone    = inject(NgZone);
  private editor: OnlyOfficeEditor | null = null;
  private initTimeout: any;

  loading    = true;
  error      = false;
  errorCode: number | null = null;
  errorMsg   = '';

  // ID unique pour éviter les conflits si plusieurs instances
  readonly containerId = 'oe-container-' + Math.random().toString(36).slice(2, 8);

  get typeIcon(): string {
    switch (this.config?.docType) {
      case 'word':  return '📝';
      case 'cell':  return '📊';
      case 'slide': return '📽';
      default:      return '📄';
    }
  }

  private get apiScriptUrl(): string {
    // Chargé via le proxy nginx /office/ → conteneur onlyoffice:80
    return '/office/web-apps/apps/api/documents/api.js';
  }

  ngOnInit() {}

  ngAfterViewInit() {
    this.zone.runOutsideAngular(() => this.loadApiAndInit());
  }

  ngOnDestroy() {
    clearTimeout(this.initTimeout);
    try { this.editor?.destroyEditor(); } catch {}
    this.editor = null;
    this.removeScript();
    // Réinitialise DocsAPI pour éviter les conflits lors de la prochaine ouverture
    (window as any).DocsAPI = undefined;
  }

  retryInit() {
    clearTimeout(this.initTimeout);
    this.error = false; this.errorCode = null; this.errorMsg = '';
    this.loading = true;
    try { this.editor?.destroyEditor(); } catch {}
    this.editor = null;
    (window as any).DocsAPI = undefined;
    this.removeScript();
    this.zone.runOutsideAngular(() => this.loadApiAndInit());
  }

  private loadApiAndInit() {
    if (window.DocsAPI) {
      this.initEditor();
      return;
    }
    const existing = document.getElementById('only-office-api-script');
    if (existing) {
      existing.addEventListener('load', () => this.initEditor());
      return;
    }
    const script = document.createElement('script');
    script.id  = 'only-office-api-script';
    script.src = this.apiScriptUrl;
    script.async = true;
    script.onload = () => this.initEditor();
    script.onerror = () => this.zone.run(() => { this.loading = false; this.error = true; });
    document.head.appendChild(script);
  }

  private initEditor() {
    if (!window.DocsAPI) {
      this.zone.run(() => { this.loading = false; this.error = true; });
      return;
    }

    const key = 'doc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const ext = this.config.fileType ?? (
                  this.config.docType === 'word' ? 'docx'
                : this.config.docType === 'cell' ? 'xlsx'
                : 'pptx');

    const editorConfig: Record<string, unknown> = {
      lang: this.config.lang ?? 'fr',
      customization: {
        autosave: true,
        comments: false,
        compactHeader: true,
        toolbarNoTabs: false,
        spellcheck: true,
      }
    };
    if (this.config.callbackUrl) {
      editorConfig['callbackUrl'] = this.config.callbackUrl;
    }

    const onlyOfficeConfig = {
      document: {
        fileType: ext,
        key,
        title: this.config.title,
        url: this.config.documentUrl,
        permissions: {
          download: true,
          edit: true,
          print: true,
        }
      },
      documentType: this.config.docType,
      editorConfig,
      events: {
        onAppReady: () => this.zone.run(() => { this.loading = false; }),
        // state=false → document vient d'être sauvegardé (plus de changements en attente)
        onDocumentStateChange: (event: unknown) => {
          const ev = event as any;
          if (ev?.data === false && this.config.downloadKey) {
            this.zone.run(() => this.saved.emit(this.config.downloadKey!));
          }
        },
        onError: (event: unknown) => {
          const ev = event as any;
          const code: number = ev?.data?.errorCode ?? ev?.errorCode ?? -1;
          const errorMessages: Record<number,string> = {
            [-1]: 'Erreur inconnue',
            [0]:  'Aucune erreur',
            [1]:  'Document introuvable',
            [2]:  'Document corrompu',
            [3]:  'Version incompatible',
            [4]:  'Téléchargement impossible (document inaccessible depuis OnlyOffice)',
            [5]:  'Connexion non sécurisée',
            [6]:  'Accès refusé',
            [7]:  'Erreur de conversion',
            [8]:  'Fichier téléchargé introuvable',
          };
          const msg = errorMessages[code] ?? `Erreur code ${code}`;
          console.error('OnlyOffice error', code, event);
          this.zone.run(() => {
            this.loading = false; this.error = true;
            this.errorCode = code; this.errorMsg = msg;
          });
        },
      },
      height: '100%',
      width:  '100%',
    };

    // Timeout de sécurité : si onAppReady ne se déclenche pas en 60s → erreur
    this.initTimeout = setTimeout(() => {
      if (this.loading) {
        this.zone.run(() => { this.loading = false; this.error = true; });
      }
    }, 60000);

    this.zone.runOutsideAngular(() => {
      try {
        // DocEditor attend un string ID, pas un élément DOM
        this.editor = new window.DocsAPI!.DocEditor(
          this.containerId,
          onlyOfficeConfig
        );
      } catch (e) {
        console.error('OnlyOffice init failed', e);
        this.zone.run(() => { this.loading = false; this.error = true; });
      }
    });
  }

  private removeScript() {
    document.getElementById('only-office-api-script')?.remove();
  }
}
