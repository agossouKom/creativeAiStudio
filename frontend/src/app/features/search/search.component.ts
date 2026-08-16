import { Component, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { SearchService } from '../../services/search.service';
import { DialogService } from '../../shared/ui/dialog.service';

type SearchMode = 'audio' | 'video' | 'person';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="search-page animate-fade">
      <div class="background-glow"></div>

      <div class="search-container">
        <!-- Title -->
        <h1 class="hero-title">
          Recherche<br><span class="hero-accent">multimédia IA</span>
        </h1>
        <p class="hero-sub">
          Analysez vos sons, vidéos et visages instantanément — le type de fichier est détecté automatiquement.
        </p>

        <!-- Mode Selection -->
        <div class="mode-tabs">
          <button *ngFor="let tab of tabs"
                  (click)="setModeManual(tab.id)"
                  class="mode-btn"
                  [class.active]="mode === tab.id">
            <span class="mode-icon">{{ tab.icon }}</span>
            <span class="mode-label">{{ tab.label }}</span>
          </button>
        </div>

        <!-- Search Bar -->
        <div class="glass-search">
          <div class="search-inner">
            <input
              type="text"
              class="search-input"
              [placeholder]="currentPlaceholder"
              [(ngModel)]="searchQuery"
              (keyup.enter)="onSearch()">

            <div class="search-actions">
              <!-- Bouton d'enregistrement micro (uniquement en mode audio) -->
              <div *ngIf="mode === 'audio'" class="mic-btn-wrap" [class.recording]="isRecording">
                <button
                  class="mic-action-btn"
                  [class.recording]="isRecording"
                  (click)="toggleRecording()"
                  [attr.aria-label]="isRecording ? 'Stopper le micro' : 'Activer le micro'"
                  id="mic-btn">
                  <!-- Icône micro -->
                  <svg *ngIf="!isRecording" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                  <!-- Icône stop -->
                  <svg *ngIf="isRecording" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12"></rect></svg>
                </button>
                <span class="mic-tooltip">{{ isRecording ? 'Cliquez pour stopper et lancer la recherche' : 'Enregistrer via le micro' }}</span>
              </div>

              <button class="action-btn" (click)="fileInput.click()" title="Joindre un fichier">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              </button>
              <button class="send-btn" (click)="onSearch()">
                <span>Analyser</span>
              </button>
            </div>
          </div>
        </div>
        <input #fileInput type="file" class="hidden" (change)="onFileSelected($event)">

        <!-- Drag & Drop Zone -->
        <div class="drop-box"
             [class.active]="isDragging"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (drop)="onDrop($event)"
             (click)="fileInput.click()">
          <div class="drop-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          </div>
          <p class="drop-text">Déposez un fichier ou cliquez pour parcourir</p>
          <p class="drop-detect">Le type est detecte automatiquement</p>
          <div class="format-chips">
            <span>MP3</span><span>WAV</span><span>MP4</span><span>JPG</span><span>PNG</span>
          </div>
        </div>

        <!-- Technology Strip -->
        <div class="tech-strip">
          <span class="tech-item"><i class="dot blue"></i> Empreinte Acoustique</span>
          <span class="tech-item"><i class="dot green"></i> Vision par Ordinateur</span>
          <span class="tech-item"><i class="dot purple"></i> Analyse Sémantique</span>
        </div>

      </div>
    </div>

    <!-- Toast auto-detection -->
    <div *ngIf="toastMsg" class="detect-toast animate-fade">
      <span class="toast-icon">✨</span>
      <span>{{ toastMsg }}</span>
    </div>

    <!-- Loading Overlay -->
    <div *ngIf="isProcessing" class="loading-overlay">
      <div class="spinner"></div>
      <p class="font-bold text-slate-900 text-lg mt-4">Traitement IA en cours...</p>
      <p class="text-slate-500 text-sm">Analyse de votre média avec précision.</p>
    </div>
  `,
  styles: [`
    :host {
      --accent: #3b82f6;
      font-family: 'Inter', sans-serif;
    }

    .search-page {
      min-height: calc(100vh - 64px);
      background: var(--bg);
      display: flex;
      justify-content: center;
      padding: 5rem 1rem;
      position: relative;
      overflow: hidden;
      color: var(--text);
      transition: background .25s, color .25s;
    }

    .background-glow {
      position: absolute;
      top: -10%; left: 50%;
      width: 600px; height: 600px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 70%);
      transform: translateX(-50%);
      filter: blur(80px);
      pointer-events: none;
    }

    .search-container {
      width: 100%;
      max-width: 780px;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 10;
    }

    .badge-pill {
      background: rgba(59, 130, 246, 0.08);
      color: var(--accent);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 6px;
      border: 1px solid rgba(59, 130, 246, 0.1);
      margin-bottom: 2rem;
    }

    .hero-title {
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 900;
      text-align: center;
      line-height: 1;
      letter-spacing: -2px;
      margin-bottom: 1.25rem;
      color: var(--text);
    }

    .hero-sub {
      color: var(--text-2);
      font-size: 17px;
      text-align: center;
      max-width: 500px;
      margin-bottom: 3rem;
      line-height: 1.5;
    }

    /* Mode Selection */
    .mode-tabs {
      display: flex;
      background: var(--surface);
      padding: 4px;
      border-radius: 12px;
      gap: 4px;
      margin-bottom: 1.5rem;
      transition: background .25s;
    }
    .mode-btn {
      background: transparent;
      border: none;
      color: var(--text-2);
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: 0.2s;
    }
    .mode-btn.active {
      background: var(--card-bg);
      color: var(--accent);
      box-shadow: 0 4px 12px var(--shadow);
    }

    /* Glass Search Bar */
    .glass-search {
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 8px;
      box-shadow: 0 10px 40px var(--shadow);
      margin-bottom: 1.5rem;
      transition: background .25s, border-color .25s;
    }
    .search-inner {
      display: flex;
      align-items: center;
      padding-left: 1rem;
    }
    .search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text);
      font-size: 15px;
      padding: 12px 0;
    }
    .search-input::placeholder { color: var(--text-3); }

    .search-actions { display: flex; align-items: center; gap: 8px; }
    .action-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; border-radius: 10px; transition: 0.2s;
    }
    .action-btn:hover { background: var(--surface); color: var(--accent); }

    /* Mic button wrapper */
    .mic-btn-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .mic-btn-wrap:hover .mic-tooltip { opacity: 1; pointer-events: auto; transform: translateY(0); }
    .mic-tooltip {
      position: absolute;
      bottom: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%) translateY(6px);
      background: #0f172a;
      color: #e2e8f0;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 8px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: all 0.2s ease;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }
    .mic-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 5px solid transparent;
      border-top-color: #0f172a;
    }
    .mic-btn-wrap.recording .mic-tooltip { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }

    .mic-action-btn {
      background: rgba(59, 130, 246, 0.1);
      border: 2px solid rgba(59, 130, 246, 0.3);
      color: var(--accent);
      width: 42px; height: 42px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; border-radius: 12px;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    .mic-action-btn:hover { background: rgba(59, 130, 246, 0.2); border-color: var(--accent); transform: scale(1.05); }
    .mic-action-btn.recording {
      background: rgba(239, 68, 68, 0.15);
      border-color: #ef4444;
      color: #ef4444;
      animation: pulse-red 1.5s infinite;
    }
    @keyframes pulse-red {
      0%   { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      70%  { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    
    .send-btn {
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 0 20px;
      height: 40px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      transition: 0.2s;
    }
    .send-btn:hover { background: #2563eb; transform: translateY(-1px); }

    /* Drop Box */
    .drop-box {
      width: 100%;
      border: 1px dashed var(--border);
      background: var(--bg-2);
      border-radius: 16px;
      padding: 2.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transition: 0.2s;
    }
    .drop-box:hover, .drop-box.active {
      border-color: var(--accent);
      background: rgba(59, 130, 246, 0.04);
    }
    .drop-icon {
      color: var(--text-3);
      margin-bottom: 1rem;
    }
    .drop-text { font-size: 14px; color: var(--text-2); font-weight: 500; }

    .format-chips { display: flex; gap: 6px; margin-top: 1rem; }
    .format-chips span {
      font-size: 9px; font-weight: 800;
      padding: 2px 8px; background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 4px; color: var(--text-2);
    }

    /* Tech Strip */
    .tech-strip {
      margin-top: 4rem;
      display: flex;
      gap: 2.5rem;
    }
    .tech-item { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
    .dot { width: 6px; height: 6px; border-radius: 50%; }
    .dot.blue { background: var(--accent); }
    .dot.green { background: #10b981; }
    .dot.purple { background: #8b5cf6; }

    /* Loading Overlay */
    .loading-overlay {
      position: fixed; inset: 0;
      background: rgba(255,255,255,.9);
      backdrop-filter: blur(8px); z-index: 2000;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    html[data-theme="dark"] .loading-overlay {
      background: rgba(8,13,26,.92);
    }
    .spinner {
      width: 50px; height: 50px;
      border: 3px solid rgba(255,255,255,0.05);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .hero-accent { background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

    .drop-detect { font-size: 11px; color: #94a3b8; margin-top: 4px; font-style: italic; }

    /* Toast detection */
    .detect-toast {
      position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
      background: #0f172a; color: white; padding: .625rem 1.25rem;
      border-radius: 999px; font-size: .82rem; font-weight: 600;
      display: flex; align-items: center; gap: .5rem;
      box-shadow: 0 8px 24px rgba(0,0,0,.25); z-index: 3000;
      white-space: nowrap;
    }
    .toast-icon { font-size: 1rem; }

    .animate-fade { animation: fadeIn 0.5s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

    :host { display: block; width: 100%; }

    .tech-item { color: var(--text-3); }
  `]
})
export class SearchComponent implements OnDestroy {
  mode: SearchMode = 'audio';
  searchQuery      = '';
  isProcessing     = false;
  isDragging       = false;
  isRecording      = false;
  selectedFile: File | null = null;
  toastMsg         = '';
  private userChoseMode = false;
  private toastTimer: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  tabs = [
    { id: 'audio'  as SearchMode, icon: '🎵', label: 'Audio'  },
    { id: 'video'  as SearchMode, icon: '🎬', label: 'Vidéo'  },
    { id: 'person' as SearchMode, icon: '👤', label: 'Visage' },
  ];

  get currentPlaceholder() {
    switch (this.mode) {
      case 'audio':  return 'Chantez, fredonnez ou collez un lien...';
      case 'video':  return 'Décrivez une scène ou uploadez un extrait...';
      case 'person': return 'Uploadez une photo pour identification...';
      default:       return 'Posez votre question...';
    }
  }

  constructor(private searchService: SearchService, private router: Router, private dialog: DialogService, private ngZone: NgZone) {}

  /** Sélection manuelle du mode — désactive l'auto-détection */
  setModeManual(m: SearchMode) {
    this.mode         = m;
    this.userChoseMode = true;
  }

  onDragOver(e: DragEvent)  { e.preventDefault(); e.stopPropagation(); this.isDragging = true; }
  onDragLeave(e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.isDragging = false; }

  onDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation();
    this.isDragging = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) this.handleFile(files[0]);
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) this.handleFile(file);
  }

  async toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Détecter le meilleur format selon le navigateur
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
            ? 'audio/ogg;codecs=opus'
            : '';

      this.mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.ngZone.run(() => {
          const actualMime = this.mediaRecorder?.mimeType || mimeType || 'audio/webm';
          const ext = actualMime.includes('ogg') ? 'ogg' : 'webm';
          const audioBlob = new Blob(this.audioChunks, { type: actualMime });
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const fileName = `enregistrement-${timestamp}.${ext}`;
          const file = new File([audioBlob], fileName, { type: actualMime });
          
          // 💾 Sauvegarde automatique sur le disque
          this.saveRecordingToDisk(audioBlob, fileName);
          
          // Arrêter le flux micro
          stream.getTracks().forEach(track => track.stop());
          
          // Lancer la recherche automatiquement
          this.handleFile(file);
        });
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.showToast('🎙️ Enregistrement en cours — Cliquez sur le bouton rouge pour stopper et analyser.');
    } catch (err: any) {
      console.error('Erreur accès micro:', err);
      const msg = err?.name === 'NotAllowedError'
        ? 'Accès au microphone refusé. Autorisez le micro dans les paramètres du navigateur.'
        : 'Impossible d\'accéder au microphone. Vérifiez vos permissions.';
      this.dialog.alert(msg, 'Erreur Micro', 'error');
    }
  }

  /** Sauvegarde l'enregistrement sur le disque via téléchargement navigateur */
  private saveRecordingToDisk(blob: Blob, fileName: string): void {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Sauvegarde locale échouée:', e);
    }
  }

  private stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  private handleFile(file: File) {
    this.selectedFile = file;
    this.autoDetectMode(file);
    this.onSearch();
  }

  /** Détecte le type via MIME et ajuste le mode si l'utilisateur n'a pas fait de choix */
  private autoDetectMode(file: File) {
    if (this.userChoseMode) return;
    const mime = file.type || '';
    let detected: SearchMode | null = null;
    let label = '';
    if (mime.startsWith('audio/'))                          { detected = 'audio';  label = 'audio'; }
    else if (mime.startsWith('video/'))                     { detected = 'video';  label = 'vidéo'; }
    else if (mime.startsWith('image/'))                     { detected = 'person'; label = 'image'; }

    if (!detected) {
      // Fallback extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['mp3','wav','flac','ogg','aac','m4a'].includes(ext!)) { detected = 'audio';  label = 'audio'; }
      else if (['mp4','avi','mkv','mov','webm'].includes(ext!))  { detected = 'video';  label = 'vidéo'; }
      else if (['jpg','jpeg','png','gif','bmp','webp'].includes(ext!)) { detected = 'person'; label = 'image'; }
    }

    if (detected) {
      this.mode = detected;
      this.showToast(`Fichier détecté comme ${label} — mode ajusté automatiquement.`);
    }
  }

  private showToast(msg: string) {
    this.toastMsg = msg;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastMsg = ''; }, 3500);
  }

  onSearch() {
    if (!this.searchQuery && !this.selectedFile) return;

    const stateData: any = {
      type: this.mode,
      file: this.selectedFile,
      query: this.searchQuery
    };

    this.selectedFile = null;
    this.searchQuery  = '';
    this.router.navigate(['/results'], { state: { searchData: stateData } });
  }

  ngOnDestroy() { 
    if (this.toastTimer) clearTimeout(this.toastTimer); 
    if (this.isRecording) this.stopRecording();
  }
}
