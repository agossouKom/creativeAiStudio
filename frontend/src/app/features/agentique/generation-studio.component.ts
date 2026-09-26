import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

type MediaKind = 'VIDEO' | 'IMAGE';

@Component({
  selector: 'app-generation-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <main class="studio">
      <header class="studio-header">
        <div>
          <a routerLink="/agentique/workspace" class="back-link">← Espace de travail</a>
          <h1>Studio de génération</h1>
          <p>Générez des médias et suivez leur traitement. Le storyboard vidéo peut utiliser le provider LLM de l’agent sélectionné.</p>
        </div>
        <button class="secondary" type="button" (click)="loadJobs()" [disabled]="loadingJobs">↻ Actualiser l’historique</button>
      </header>

      <section class="studio-card">
        <div class="mode-switch" role="group" aria-label="Type de média">
          <button type="button" [class.selected]="mediaKind === 'VIDEO'" (click)="mediaKind = 'VIDEO'">🎬 Vidéo</button>
          <button type="button" [class.selected]="mediaKind === 'IMAGE'" (click)="mediaKind = 'IMAGE'">🎨 Image</button>
        </div>

        <label class="field">
          <span>Brief de création</span>
          <textarea [(ngModel)]="prompt" [maxlength]="mediaKind === 'VIDEO' ? 8000 : 4000"
                    rows="5" placeholder="Décrivez le contenu, son objectif, son ton et son public…"></textarea>
        </label>

        <ng-container *ngIf="mediaKind === 'VIDEO'">
          <div class="fields-grid">
            <label class="field">
              <span>Voix de narration</span>
              <select [(ngModel)]="videoOptions.voice">
                <option value="fr-FR-DeniseNeural">Français — Denise</option>
                <option value="fr-FR-HenriNeural">Français — Henri</option>
                <option value="en-US-AriaNeural">Anglais — Aria</option>
                <option value="es-ES-ElviraNeural">Espagnol — Elvira</option>
                <option value="de-DE-KatjaNeural">Allemand — Katja</option>
                <option value="pt-BR-FranciscaNeural">Portugais — Francisca</option>
              </select>
            </label>
            <label class="field">
              <span>Agent pour le storyboard</span>
              <select [(ngModel)]="agentId">
                <option value="">Provider worker (sans agent)</option>
                <option *ngFor="let agent of agents" [value]="agent.id">
                  {{ agent.name || agent.id }}{{ agent.teamName ? ' · ' + agent.teamName : '' }}
                </option>
              </select>
            </label>
            <label class="field">
              <span>Format</span>
              <select [(ngModel)]="videoOptions.aspectRatio">
                <option value="9:16">Vertical — 9:16</option>
                <option value="16:9">Paysage — 16:9</option>
                <option value="1:1">Carré — 1:1</option>
              </select>
            </label>
            <label class="field">
              <span>Source des séquences vidéo</span>
              <select [(ngModel)]="videoOptions.source">
                <option value="pexels">Pexels</option>
                <option value="pixabay">Pixabay</option>
              </select>
            </label>
            <label class="field">
              <span>Durée par clip (secondes)</span>
              <input type="number" min="1" max="60" [(ngModel)]="videoOptions.clipDurationSeconds">
            </label>
            <label class="field">
              <span>Nombre de variantes</span>
              <input type="number" min="1" max="10" [(ngModel)]="videoOptions.videoCount">
            </label>
          </div>
          <p class="hint">
            La narration utilise Edge TTS sans clé API (connexion Internet requise). L’agent produit le storyboard avec son provider résolu ; les clés restent dans agent-team.
          </p>
        </ng-container>

        <ng-container *ngIf="mediaKind === 'IMAGE'">
          <div class="fields-grid">
            <label class="field">
              <span>Dimensions</span>
              <select [(ngModel)]="imageOptions.size">
                <option value="1024x1024">1024 × 1024</option>
                <option value="1024x1536">1024 × 1536</option>
                <option value="1536x1024">1536 × 1024</option>
              </select>
            </label>
            <label class="field">
              <span>Nombre d’images</span>
              <input type="number" min="1" max="10" [(ngModel)]="imageOptions.count">
            </label>
            <label class="field">
              <span>Modèle (facultatif)</span>
              <input [(ngModel)]="imageOptions.model" maxlength="64" placeholder="Modèle configuré côté worker">
            </label>
          </div>
          <p class="hint">Le provider d’image est configuré côté worker. La sélection du provider LLM d’agent pilote actuellement le storyboard vidéo, pas la génération d’image.</p>
        </ng-container>

        <div *ngIf="errorMessage" class="notice error" role="alert">{{ errorMessage }}</div>
        <div *ngIf="successMessage" class="notice success" role="status">{{ successMessage }}</div>
        <div class="form-actions">
          <button class="primary" type="button" (click)="submit()" [disabled]="submitting || !prompt.trim()">
            <span *ngIf="submitting">Lancement…</span>
            <span *ngIf="!submitting">Lancer la génération {{ mediaKind === 'VIDEO' ? 'vidéo' : 'image' }}</span>
          </button>
        </div>
      </section>

      <section class="history">
        <div class="history-heading">
          <div>
            <h2>Historique récent</h2>
            <p>Les jobs restent consultables pendant leur traitement et après leur achèvement.</p>
          </div>
          <span *ngIf="loadingJobs" class="muted">Chargement…</span>
        </div>

        <div *ngIf="!loadingJobs && jobs.length === 0" class="empty">Aucune génération pour le moment.</div>
        <article *ngFor="let job of jobs" class="job-card">
          <div class="job-main">
            <div class="job-meta">
              <span class="kind">{{ job.mediaType === 'VIDEO' ? '🎬 Vidéo' : '🎨 Image' }}</span>
              <span class="status" [attr.data-status]="job.status">{{ job.status }}<ng-container *ngIf="job.progress"> · {{ job.progress }}%</ng-container></span>
              <time *ngIf="job.createdAt">{{ job.createdAt | date:'short' }}</time>
            </div>
            <p class="job-prompt">{{ job.prompt }}</p>
            <p *ngIf="job.error?.message" class="job-error">{{ job.error.message }}</p>
            <p *ngIf="job.outputs?.length" class="muted">{{ job.outputs.length }} sortie(s) disponible(s)</p>
          </div>
          <div class="job-actions">
            <button type="button" class="secondary" (click)="refreshJob(job)" [disabled]="job.refreshing">Détails</button>
            <button *ngFor="let output of job.outputs" type="button" class="secondary"
                    (click)="download(job, output.index)">Télécharger {{ output.index + 1 }}</button>
            <button *ngFor="let output of job.outputs" type="button" class="secondary"
                    [disabled]="job.status !== 'DONE' || availablePlatforms(job).length === 0"
                    (click)="openPublisher(job, output.index)">Publier {{ output.index + 1 }}</button>
            <button *ngIf="job.status === 'FAILED' || job.status === 'DONE'" type="button"
                    class="secondary" (click)="retry(job)" [disabled]="job.retrying">
              {{ job.retrying ? 'Relance…' : 'Relancer' }}
            </button>
          </div>
          <div *ngIf="publishJobId === job.jobId" class="publish-panel">
            <label class="field">
              <span>Réseau disponible pour ce média</span>
              <select [(ngModel)]="publishPlatform">
                <option *ngFor="let platform of availablePlatforms(job)" [value]="platform.platform">{{ platform.label }}</option>
              </select>
            </label>
            <label class="field">
              <span>Agent propriétaire du canal</span>
              <select [(ngModel)]="publishAgentId">
                <option value="">Choisir un agent</option>
                <option *ngFor="let agent of agents" [value]="agent.id">{{ agent.name || agent.id }}</option>
              </select>
            </label>
            <label class="field">
              <span>Légende</span>
              <textarea [(ngModel)]="publishCaption" rows="3" maxlength="2200"></textarea>
            </label>
            <p *ngIf="publishResult" class="hint">Publication {{ publishResult.status }} · {{ publishResult.requestId }}</p>
            <div class="job-actions">
              <button class="secondary" type="button" (click)="publishJobId = ''">Annuler</button>
              <button class="primary" type="button" (click)="publish(job, publishOutputIndex)"
                      [disabled]="publishing || !publishPlatform || !publishAgentId">
                {{ publishing ? 'Envoi…' : 'Confirmer la publication' }}
              </button>
            </div>
          </div>
        </article>
      </section>
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:#080d19; color:#e2e8f0; padding:clamp(1rem,4vw,3rem); }
    .studio { max-width:1100px; margin:0 auto; }
    .studio-header,.history-heading { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
    .studio-header { margin-bottom:1.5rem; }
    h1 { margin:.45rem 0; font-size:clamp(1.7rem,4vw,2.5rem); color:#f8fafc; }
    h2 { margin:0; font-size:1.25rem; color:#f8fafc; }
    p { color:#94a3b8; line-height:1.55; }
    .studio-header p,.history-heading p { margin:.35rem 0 0; }
    .back-link { color:#a5b4fc; text-decoration:none; font-size:.9rem; }
    .studio-card,.job-card { background:#111a2b; border:1px solid #25324a; border-radius:16px; padding:clamp(1rem,3vw,1.5rem); }
    .mode-switch { display:flex; gap:.5rem; margin-bottom:1.25rem; }
    button { border:1px solid #34425d; border-radius:9px; padding:.65rem 1rem; color:#e2e8f0; background:#172338; cursor:pointer; }
    button:disabled { opacity:.55; cursor:not-allowed; }
    .mode-switch button.selected { background:#4338ca; border-color:#6366f1; }
    .field { display:flex; flex-direction:column; gap:.45rem; min-width:0; }
    .field span { color:#cbd5e1; font-size:.85rem; font-weight:600; }
    input,select,textarea { width:100%; box-sizing:border-box; border:1px solid #34425d; border-radius:8px; padding:.7rem .8rem; background:#0b1322; color:#f1f5f9; font:inherit; }
    textarea { resize:vertical; }
    .fields-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:1rem; margin-top:1rem; }
    .hint,.muted { color:#94a3b8; font-size:.82rem; }
    .hint { margin:.8rem 0 0; }
    .form-actions { display:flex; justify-content:flex-end; margin-top:1rem; }
    .primary { background:#4f46e5; border-color:#6366f1; font-weight:700; }
    .secondary { background:#172338; }
    .history { margin-top:2rem; }
    .history-heading { margin-bottom:1rem; }
    .empty { padding:2rem; text-align:center; color:#94a3b8; border:1px dashed #34425d; border-radius:12px; }
    .job-card { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin:.75rem 0; }
    .job-main { min-width:0; }
    .job-meta,.job-actions { display:flex; align-items:center; flex-wrap:wrap; gap:.5rem; }
    .job-meta { color:#94a3b8; font-size:.78rem; }
    .kind,.status { padding:.25rem .5rem; border-radius:999px; background:#1d2940; color:#cbd5e1; }
    .status[data-status="DONE"] { background:#064e3b; color:#a7f3d0; }
    .status[data-status="FAILED"] { background:#7f1d1d; color:#fecaca; }
    .status[data-status="PROCESSING"] { background:#78350f; color:#fde68a; }
    .job-prompt { margin:.65rem 0; color:#e2e8f0; overflow-wrap:anywhere; }
    .job-error { color:#fca5a5; }
    .job-actions { justify-content:flex-end; }
    .publish-panel { display:grid; gap:.8rem; width:100%; margin-top:1rem; padding-top:1rem; border-top:1px solid #25324a; }
    .notice { margin-top:1rem; padding:.75rem 1rem; border-radius:8px; }
    .error { color:#fecaca; background:#451a1a; }
    .success { color:#a7f3d0; background:#064e3b; }
    @media(max-width:700px) { .studio-header,.job-card { align-items:stretch; flex-direction:column; } .job-actions { justify-content:flex-start; } }
  `]
})
export class GenerationStudioComponent implements OnInit, OnDestroy {
  mediaKind: MediaKind = 'VIDEO';
  prompt = '';
  agentId = '';
  agents: any[] = [];
  platforms: any[] = [];
  jobs: any[] = [];
  submitting = false;
  loadingJobs = false;
  errorMessage = '';
  successMessage = '';
  publishJobId = '';
  publishOutputIndex = 0;
  publishPlatform = '';
  publishAgentId = '';
  publishCaption = '';
  publishResult: any = null;
  publishing = false;
  readonly videoOptions = { aspectRatio: '9:16', language: 'fr', voice: 'fr-FR-DeniseNeural', subtitles: true, videoCount: 1, clipDurationSeconds: 5, source: 'pexels' };
  readonly imageOptions = { size: '1024x1024', count: 1, model: '' };
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  ngOnInit(): void {
    this.loadAgents();
    this.loadPlatforms();
    this.loadJobs();
    this.refreshTimer = setInterval(() => this.loadJobs(), 15000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  submit(): void {
    if (!this.prompt.trim() || this.submitting) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.submitting = true;
    const body = this.mediaKind === 'VIDEO'
      ? { prompt: this.prompt.trim(), agentId: this.agentId || null, options: this.videoOptions }
      : { prompt: this.prompt.trim(), options: { ...this.imageOptions, model: this.imageOptions.model || null } };
    this.http.post<any>(`/api/generation/${this.mediaKind.toLowerCase()}`, body).subscribe({
      next: job => {
        this.jobs = [job, ...this.jobs.filter(item => item.jobId !== job.jobId)];
        this.prompt = '';
        this.successMessage = `Génération lancée — job ${job.jobId}.`;
        this.submitting = false;
        this.loadJobs();
      },
      error: error => {
        this.errorMessage = error?.error?.detail || error?.error?.message || 'Impossible de lancer la génération. Vérifiez la configuration et réessayez.';
        this.submitting = false;
      }
    });
  }

  loadJobs(): void {
    this.loadingJobs = true;
    this.http.get<any>('/api/generation/jobs?page=0&size=20').subscribe({
      next: response => {
        this.jobs = Array.isArray(response) ? response : response?.content || [];
        this.loadingJobs = false;
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'Impossible de charger l’historique des générations.';
        this.loadingJobs = false;
      }
    });
  }

  refreshJob(job: any): void {
    job.refreshing = true;
    this.http.get<any>(`/api/generation/jobs/${encodeURIComponent(job.jobId)}`).subscribe({
      next: detail => this.replaceJob(detail, job),
      error: error => {
        this.errorMessage = error?.error?.detail || error?.error?.message || 'Impossible de charger le détail de ce job.';
        job.refreshing = false;
      }
    });
  }

  retry(job: any): void {
    job.retrying = true;
    this.errorMessage = '';
    this.http.post<any>(`/api/generation/jobs/${encodeURIComponent(job.jobId)}/retry`, {}).subscribe({
      next: updated => this.replaceJob(updated, job),
      error: error => {
        this.errorMessage = error?.error?.detail || error?.error?.message || 'Impossible de relancer ce job.';
        job.retrying = false;
      }
    });
  }

  download(job: any, index: number): void {
    this.http.get<any>(`/api/generation/jobs/${encodeURIComponent(job.jobId)}/outputs/${index}/download-url`).subscribe({
      next: result => {
        if (result?.url) window.open(result.url, '_blank', 'noopener');
        else this.errorMessage = 'Le service n’a pas fourni d’URL de téléchargement.';
      },
      error: error => this.errorMessage = error?.error?.detail || error?.error?.message || 'Impossible de créer le lien de téléchargement.'
    });
  }

  availablePlatforms(job: any): any[] {
    return this.platforms.filter(platform =>
      platform.supportLevel === 'LIVE' && platform.supportedMedia?.includes(job.mediaType));
  }

  openPublisher(job: any, index: number): void {
    this.publishJobId = job.jobId;
    this.publishOutputIndex = index;
    this.publishPlatform = this.availablePlatforms(job)[0]?.platform || '';
    this.publishAgentId = job.agentId || '';
    this.publishCaption = job.prompt || '';
    this.publishResult = null;
  }

  publish(job: any, index: number): void {
    if (!this.publishPlatform || !this.publishAgentId || this.publishing) return;
    this.publishing = true;
    this.errorMessage = '';
    this.http.post<any>(
      `/api/generation/jobs/${encodeURIComponent(job.jobId)}/outputs/${index}/publish`,
      { platform: this.publishPlatform, agentId: this.publishAgentId, caption: this.publishCaption }
    ).subscribe({
      next: result => {
        this.publishResult = result;
        this.publishing = false;
      },
      error: error => {
        this.errorMessage = error?.error?.detail || error?.error?.message || 'La publication a échoué. Vérifiez le canal et les contraintes de la plateforme.';
        this.publishing = false;
      }
    });
  }

  private loadPlatforms(): void {
    this.http.get<any[]>('/api/generation/social/platforms').subscribe({
      next: platforms => this.platforms = platforms || [],
      error: error => {
        this.errorMessage = error?.error?.detail || 'Impossible de charger les plateformes de publication.';
      }
    });
  }

  private loadAgents(): void {
    this.http.get<any>('/api/agents').subscribe({
      next: response => this.agents = Array.isArray(response) ? response : response?.content || [],
      error: error => this.errorMessage = error?.error?.message || 'Impossible de charger la liste des agents.'
    });
  }

  private replaceJob(updated: any, current: any): void {
    const index = this.jobs.findIndex(job => job.jobId === current.jobId);
    if (index >= 0) this.jobs[index] = { ...updated, refreshing: false, retrying: false };
    else this.jobs.unshift(updated);
  }
}
