import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SearchService } from '../../services/search.service';
import { interval, Subscription, Observable } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="results-page animate-fade">
      <div class="bg-orb bg-orb-1"></div>
      <div class="bg-orb bg-orb-2"></div>

      <div class="results-container">
        <!-- Header -->
        <header class="results-header">
          <button routerLink="/" class="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Retour
          </button>
          <div class="status-pill" [class.done]="status === 'COMPLETED'" [class.running]="status === 'PROCESSING'" [class.failed]="status === 'FAILED'">
            <span class="pulse-dot"></span>
            {{ statusLabel }}
          </div>
        </header>

        <!-- Processing State -->
        <div *ngIf="status === 'PROCESSING'" class="loading-card">
          <div class="dna-spinner">
            <div class="ring r1"></div>
            <div class="ring r2"></div>
            <div class="ring r3"></div>
            <div class="core">{{ spinnerIcon }}</div>
          </div>
          <h2 class="loading-title">{{ loadingTitle }}</h2>
          <p class="loading-sub">{{ loadingSubtitle }}</p>
          <div class="progress-track"><div class="progress-bar"></div></div>
          <code class="job-code">ID: {{ jobId }}</code>
        </div>

        <!-- Empty / Failed State -->
        <div *ngIf="!result && status !== 'PROCESSING'" class="empty-card">
          <div class="empty-icon">{{ status === 'FAILED' ? '❌' : '🔍' }}</div>
          <h2>{{ emptyTitle }}</h2>
          <p>{{ emptyMessage }}</p>
          <button routerLink="/" class="btn-primary">Nouvelle recherche</button>
        </div>

        <!-- ══════════════════════════════════════════════════════════
             AUDIO RESULTS
             ══════════════════════════════════════════════════════════ -->
        <div *ngIf="result && status === 'COMPLETED' && result.type === 'audio'" class="audio-layout animate-fade">

          <!-- Hero: cover art + track identity -->
          <div class="audio-hero-card">
            <div class="cover-wrap">
              <img *ngIf="result.match?.cover_url"
                   [src]="result.match.cover_url"
                   alt="Pochette"
                   class="cover-img"
                   (error)="onCoverError($event)">
              <div *ngIf="!result.match?.cover_url" class="cover-placeholder">🎵</div>
              <div class="source-badge" [class.shazam]="result.match?.source === 'shazam'" [class.acoustid]="result.match?.source === 'acoustid'">
                {{ result.match?.source === 'shazam' ? 'Shazam' : result.match?.source === 'acoustid' ? 'AcoustID' : '?' }}
              </div>
            </div>

            <div class="track-info">
              <div class="track-header-row">
                <span class="track-type-label">🎵 Titre identifié</span>
                <span *ngIf="result.match?.genre" class="track-genre">{{ result.match.genre }}</span>
              </div>
              <h1 class="track-title">{{ result.match?.title || 'Non reconnu' }}</h1>
              <p class="track-artist">{{ result.match?.artist }}</p>
              <p *ngIf="result.match?.album" class="track-album">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                {{ result.match.album }}
                <span *ngIf="result.match.release_date"> — {{ result.match.release_date }}</span>
              </p>

              <div *ngIf="result.match?.score" class="match-summary">
                <div class="match-bar-track">
                  <div class="match-bar-fill" [style.width]="(result.match.score) + '%'" aria-hidden="true"></div>
                </div>
                <span class="match-label">{{ result.match.score }}% de correspondance</span>
              </div>

              <div class="streaming-row">
                <a [href]="spotifySearchUrl" target="_blank" class="stream-btn spotify-btn" *ngIf="result.match">
                  <span class="stream-icon">🎧</span>
                  Spotify
                </a>
                <a [href]="youtubeSearchUrl" target="_blank" class="stream-btn yt-btn" *ngIf="result.match">
                  <span class="stream-icon">▶</span>
                  YouTube
                </a>
                <a *ngIf="result.match?.shazam_url" [href]="result.match.shazam_url" target="_blank" class="stream-btn shazam-btn">
                  <span class="stream-icon">🎵</span>
                  Shazam
                </a>
              </div>
            </div>
          </div>

          <!-- Audio Features row -->
          <div *ngIf="result.features" class="features-row">
            <div class="feat-card bpm-card">
              <div class="feat-card-top">
                <span class="feat-icon">♩</span>
                <span class="feat-chip">BPM</span>
              </div>
              <div class="feat-value">{{ result.features.bpm }}</div>
              <div class="feat-label">BPM</div>
            </div>
            <div class="feat-card key-card">
              <div class="feat-card-top">
                <span class="feat-icon">🎼</span>
                <span class="feat-chip">Tonalité</span>
              </div>
              <div class="feat-value">{{ result.features.key }}</div>
              <div class="feat-label">Tonalité</div>
            </div>
            <div class="feat-card energy-card">
              <div class="feat-card-top">
                <span class="feat-icon">⚡</span>
                <span class="feat-chip">Énergie RMS</span>
              </div>
              <div class="feat-value">{{ result.features.energy }}</div>
              <div class="feat-label">Énergie RMS</div>
            </div>
            <div class="feat-card duration-card">
              <div class="feat-card-top">
                <span class="feat-icon">⏱</span>
                <span class="feat-chip">Durée</span>
              </div>
              <div class="feat-value">{{ result.features.duration }}</div>
              <div class="feat-label">Durée</div>
            </div>
          </div>

          <!-- "Not found" fallback -->
          <div *ngIf="!result.match" class="not-found-banner">
            <span class="nf-icon">🔇</span>
            <div>
              <p class="nf-title">Titre non identifié</p>
              <p class="nf-sub">Ni Shazam ni AcoustID n'ont trouvé de correspondance. Les caractéristiques audio ont quand même été extraites.</p>
            </div>
          </div>

          <!-- Lyrics -->
          <div *ngIf="result.lyrics" class="lyrics-card">

            <!-- Header -->
            <div class="lyrics-header">
              <div class="lyrics-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                Paroles
              </div>
              <span class="lyrics-source-tag">lyrics.ovh</span>
            </div>

            <!-- Scroll zone with gradient fade -->
            <div class="lyrics-scroll" [class.expanded]="lyricsExpanded">
              <div class="lyrics-lines">
                <ng-container *ngFor="let line of lyricsLines">
                  <div *ngIf="isLyricsSection(line)" class="lyrics-section-tag">{{ line }}</div>
                  <p   *ngIf="line.trim() && !isLyricsSection(line)" class="lyrics-line">{{ line }}</p>
                  <div *ngIf="!line.trim()" class="lyrics-gap"></div>
                </ng-container>
              </div>
              <div class="lyrics-fade" *ngIf="!lyricsExpanded"></div>
            </div>

            <!-- Toggle button -->
            <button class="lyrics-toggle-btn" (click)="lyricsExpanded = !lyricsExpanded">
              <span>{{ lyricsExpanded ? 'Réduire' : 'Voir toutes les paroles' }}</span>
              <svg class="chevron-icon" [class.flipped]="lyricsExpanded" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>

          </div>

          <!-- Actions -->
          <div class="audio-actions">
            <button class="action-btn" routerLink="/">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nouvelle recherche
            </button>
            <button class="action-btn relancer-btn" (click)="relaunchSearch()" title="Relancer l'analyse sur le même fichier">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Relancer l'analyse
            </button>
          </div>

        </div>

        <!-- ══════════════════════════════════════════════════════════
             VIDEO RESULTS (Unified UI with Audio Layout)
             ══════════════════════════════════════════════════════════ -->
        <div *ngIf="result && status === 'COMPLETED' && result.type === 'video'" class="audio-layout animate-fade">

          <!-- Hero: poster art + track identity -->
          <div class="audio-hero-card">
            <div class="cover-wrap">
              <img *ngIf="result.tmdb_match?.poster"
                   [src]="result.tmdb_match.poster"
                   alt="Affiche"
                   class="cover-img"
                   (error)="onCoverError($event)">
              <div *ngIf="!result.tmdb_match?.poster && result.audio_match?.cover_url"
                   style="background-image: url('{{ result.audio_match.cover_url }}'); background-size: cover; background-position: center; width: 100%; height: 100%;">
              </div>
              <div *ngIf="!result.tmdb_match?.poster && !result.audio_match?.cover_url" class="cover-placeholder">🎬</div>
              <div class="source-badge" [class.shazam]="result.tmdb_match?.source === 'tmdb'" [class.acoustid]="result.audio_match">
                {{ result.tmdb_match ? 'TMDb' : result.audio_match ? 'Audio' : '?' }}
              </div>
            </div>

            <div class="track-info">
              <div class="track-header-row">
                <span class="track-type-label">🎬 {{ result.tmdb_match?.media_type === 'tv' ? 'Série' : 'Film identifié' }}</span>
                <span *ngIf="result.tmdb_match?.genres?.[0]" class="track-genre">{{ result.tmdb_match.genres[0] }}</span>
              </div>
              <h1 class="track-title">{{ result.tmdb_match?.title || result.audio_match?.song_title || 'Non reconnu' }}</h1>
              <p class="track-artist">
                {{ result.tmdb_match?.director || result.audio_match?.song_artist || 'Information manquante' }}
              </p>
              <p *ngIf="result.tmdb_match?.release_date || result.audio_match?.album" class="track-album">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                {{ result.tmdb_match?.release_date | slice:0:4 || result.audio_match?.album }}
              </p>

              <div *ngIf="result.tmdb_match?.vote_average" class="match-summary">
                <div class="match-bar-track">
                  <div class="match-bar-fill" [style.width]="(result.tmdb_match.vote_average * 10) + '%'" aria-hidden="true"></div>
                </div>
                <span class="match-label">{{ result.tmdb_match.vote_average }}/10 TMDb</span>
              </div>

              <div class="streaming-row">
                <a [href]="result.tmdb_match?.trailer || videoYoutubeUrl" target="_blank" class="stream-btn yt-btn" *ngIf="result.tmdb_match?.trailer || result.audio_match">
                  <span class="stream-icon">▶</span>
                  YouTube
                </a>
                <a *ngIf="result.audio_match?.shazam_url" [href]="result.audio_match.shazam_url" target="_blank" class="stream-btn shazam-btn">
                  <span class="stream-icon">🎵</span>
                  Shazam (BO)
                </a>
              </div>

              <!-- Watch on streaming platforms -->
              <div class="watch-section">
                <p class="watch-title">🍿 Regarder le film</p>
                <div class="platform-grid">
                  <a [href]="getTiktokSearchUrl()" target="_blank" class="platform-btn tiktok-btn" title="Rechercher sur TikTok">
                    <span class="platform-icon">🎵</span>
                    <span class="platform-name">TikTok</span>
                  </a>
                  <a [href]="getNetflixSearchUrl()" target="_blank" class="platform-btn netflix-btn" title="Rechercher sur Netflix">
                    <span class="platform-icon">N</span>
                    <span class="platform-name">Netflix</span>
                  </a>
                  <a [href]="getImdbUrl()" target="_blank" class="platform-btn imdb-btn" title="Voir sur IMDB">
                    <span class="platform-icon">★</span>
                    <span class="platform-name">IMDb</span>
                  </a>
                  <a [href]="getJustWatchUrl()" target="_blank" class="platform-btn justwatch-btn" title="JustWatch - où regarder">
                    <span class="platform-icon">🎬</span>
                    <span class="platform-name">JustWatch</span>
                  </a>
                  <a [href]="getRottenTomatoesUrl()" target="_blank" class="platform-btn rottentomatoes-btn" title="Rotten Tomatoes">
                    <span class="platform-icon">🍅</span>
                    <span class="platform-name">Rotten T.</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <!-- Video Specs row (Unified as features) -->
          <div *ngIf="result.metadata" class="features-row">
            <div class="feat-card bpm-card">
              <div class="feat-card-top">
                <span class="feat-icon">📺</span>
                <span class="feat-chip">Résolution</span>
              </div>
              <div class="feat-value">{{ result.metadata.resolution }}</div>
              <div class="feat-label">Résolution</div>
            </div>
            <div class="feat-card key-card">
              <div class="feat-card-top">
                <span class="feat-icon">⚙</span>
                <span class="feat-chip">FPS</span>
              </div>
              <div class="feat-value">{{ result.metadata.fps }}</div>
              <div class="feat-label">FPS</div>
            </div>
            <div class="feat-card energy-card">
              <div class="feat-card-top">
                <span class="feat-icon">⏱</span>
                <span class="feat-chip">Durée</span>
              </div>
              <div class="feat-value">{{ result.metadata.duration }}s</div>
              <div class="feat-label">Durée</div>
            </div>
            <div class="feat-card duration-card">
              <div class="feat-card-top">
                <span class="feat-icon">🖼</span>
                <span class="feat-chip">Frames</span>
              </div>
              <div class="feat-value">{{ result.frames_analyzed }}</div>
              <div class="feat-label">Frames analysées</div>
            </div>
          </div>

          <!-- Synopsis Section -->
          <div *ngIf="result.tmdb_match?.overview" class="lyrics-card">
            <div class="lyrics-header">
              <div class="lyrics-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                Synopsis
              </div>
              <span class="lyrics-source-tag">TMDb</span>
            </div>
            <div class="lyrics-scroll">
              <div class="lyrics-lines">
                <p class="lyrics-line">{{ result.tmdb_match.overview }}</p>
              </div>
            </div>
          </div>

          <!-- "Not found" fallback -->
          <div *ngIf="!result.tmdb_match && !result.audio_match" class="not-found-banner">
            <span class="nf-icon">🔇</span>
            <div>
              <p class="nf-title">Vidéo non identifiée</p>
              <p class="nf-sub">Aucune correspondance TMDb ou audio trouvée. Les métadonnées techniques ont été extraites.</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="audio-actions">
            <button class="action-btn" routerLink="/">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nouvelle recherche
            </button>
            <button class="action-btn relancer-btn" (click)="relaunchSearch()" title="Relancer l'analyse sur le même fichier">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              Relancer l'analyse
            </button>
          </div>

        </div>

        <!-- ══════════════════════════════════════════════════════════
             FACE / PERSON RESULTS (existing)
             ══════════════════════════════════════════════════════════ -->
        <div *ngIf="result && status === 'COMPLETED' && result.type === 'person'" class="result-layout">

          <!-- LEFT: Summary + Faces -->
          <div class="left-col">

            <!-- Identity Card -->
            <div class="identity-card">
              <div class="id-icon">{{ result.type === 'video' ? '🎬' : '👤' }}</div>
              <div class="id-body">
                <h1 class="id-name">{{ result.title || 'Analyse terminée' }}</h1>
                <p class="id-sub">{{ result.description }}</p>
                <div class="confidence-bar-wrap">
                  <div class="confidence-bar" [style.width.%]="result.confidence || 92"></div>
                </div>
                <span class="confidence-label">{{ result.confidence || 92 }}% de correspondance</span>
              </div>
            </div>

            <!-- Detected Faces -->
            <div *ngIf="result.face_analysis?.faces?.length > 0" class="section-card">
              <h3 class="section-title">
                <span class="icon-badge">🧬</span> Visages détectés
                <span class="count-badge">{{ result.face_analysis.faces.length }}</span>
              </h3>
              <div class="faces-grid">
                <div *ngFor="let face of result.face_analysis.faces; let i = index" class="face-chip">
                  <div class="face-avatar">{{ face.gender === 'Homme' ? '👨' : '👩' }}</div>
                  <div class="face-info">
                    <strong>Visage {{ i + 1 }}</strong>
                    <span>{{ face.gender }} — ~{{ face.age }} ans</span>
                    <span class="score-tag">{{ (face.det_score * 100).toFixed(0) }}% confiance</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Milvus Status -->
            <div class="section-card milvus-card">
              <div class="milvus-icon">🔬</div>
              <div>
                <p class="milvus-title">Recherche vectorielle Milvus</p>
                <p class="milvus-sub">{{ result.identity_search?.message || 'Embeddings extraits et prêts.' }}</p>
                <span class="phase-badge">Phase 4 — En développement</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="actions-col">
              <button class="action-btn" routerLink="/">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Nouvelle recherche
              </button>
              <button class="action-btn outline">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Exporter PDF
              </button>
            </div>

          </div>

          <!-- RIGHT: Visual Matches / OSINT -->
          <div class="right-col">
            <div *ngIf="result.public_image_url" class="osint-cards-container animate-fade">
              <div class="osint-header-wrap">
                 <div class="osint-source-img-wrap">
                   <img [src]="result.public_image_url" alt="Photo analysée" class="osint-source-img" (error)="onImgError($event)">
                 </div>
                 <div class="osint-header-text">
                   <h2 class="gallery-title">
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                     Recherche visuelle approfondie
                   </h2>
                   <p class="osint-desc">Les résultats de correspondances directes ont été masqués. Sélectionnez un moteur d'intelligence OSINT ci-dessous pour lancer l'investigation visuelle sécurisée.</p>
                 </div>
              </div>
              <div class="search-engine-cards">
                <a [href]="'https://lens.google.com/uploadbyurl?url=' + encodeURIComponent(result.public_image_url)" target="_blank" class="engine-card google-card">
                  <div class="engine-icon-wrap"><span class="engine-icon">🌐</span></div>
                  <div class="engine-info">
                    <h3>Google Lens</h3>
                    <p>Excellente précision pour les réseaux sociaux (Facebook, LinkedIn, Instagram).</p>
                  </div>
                  <div class="engine-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </div>
                </a>
                <a [href]="'https://yandex.com/images/search?rpt=imageview&url=' + encodeURIComponent(result.public_image_url)" target="_blank" class="engine-card yandex-card">
                  <div class="engine-icon-wrap"><span class="engine-icon">🇷🇺</span></div>
                  <div class="engine-info">
                    <h3>Yandex Images</h3>
                    <p>Moteur russe puissant pour l'analyse faciale globale et les sites non-occidentaux.</p>
                  </div>
                  <div class="engine-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </div>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block; width: 100%;
      --accent: #3b82f6; --accent2: #8b5cf6;
      --bg: #f8fafc; --card: #ffffff;
      --border: #e2e8f0; --text: #0f172a; --sub: #64748b;
    }

    .results-page { min-height: 100vh; background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 70%); padding: 3rem 1.5rem 4rem; position: relative; overflow: hidden; color: var(--text); }
    .bg-orb { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; }
    .bg-orb-1 { width: 520px; height: 520px; top: -120px; right: -120px; background: rgba(59,130,246,0.08); }
    .bg-orb-2 { width: 420px; height: 420px; bottom: -120px; left: -120px; background: rgba(139,92,246,0.06); }
    .results-container { max-width: 1200px; margin: 0 auto; position: relative; z-index: 10; }

    /* Header */
    .results-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.3rem; gap: 1rem; flex-wrap: wrap; }
    .back-btn { display: flex; align-items: center; gap: 8px; background: var(--card); border: 1px solid var(--border); color: var(--sub); padding: 10px 18px; border-radius: 14px; cursor: pointer; font-weight: 700; font-size: 13px; transition: 0.25s ease; box-shadow: 0 10px 30px rgba(15,23,42,0.04); }
    .back-btn:hover { background: #eef2ff; color: var(--text); }
    .status-pill { display: flex; align-items: center; gap: 10px; background: var(--card); border: 1px solid var(--border); padding: 10px 20px; border-radius: 99px; font-size: 12px; font-weight: 800; letter-spacing: 0.7px; transition: all 0.3s ease; box-shadow: 0 10px 30px rgba(15,23,42,0.08); }
    .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: #94a3b8; flex-shrink: 0; }
    .status-pill.running { background: #fffbeb; border-color: #fcd34d; color: #92400e; }
    .status-pill.running .pulse-dot { background: #f59e0b; animation: pulse 1.5s infinite; }
    .status-pill.done { background: #f0fdf4; border-color: #86efac; color: #166534; }
    .status-pill.done .pulse-dot { background: #10b981; }
    .status-pill.failed { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
    .status-pill.failed .pulse-dot { background: #ef4444; }

    /* Loading */
    .loading-card { display: flex; flex-direction: column; align-items: center; padding: 6rem 2rem; text-align: center; background: var(--card); border: 1px solid var(--border); border-radius: 28px; }
    .dna-spinner { position: relative; width: 80px; height: 80px; margin-bottom: 2rem; }
    .ring { position: absolute; inset: 0; border-radius: 50%; border: 3px solid transparent; }
    .r1 { border-top-color: var(--accent); animation: spin 1.2s linear infinite; }
    .r2 { inset: 8px; border-top-color: var(--accent2); animation: spin 1.8s linear infinite reverse; }
    .r3 { inset: 16px; border-top-color: #10b981; animation: spin 2.4s linear infinite; }
    .core { position: absolute; inset: 20px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .loading-title { font-size: 22px; font-weight: 800; margin-bottom: 0.5rem; }
    .loading-sub { color: var(--sub); font-size: 14px; margin-bottom: 1.5rem; }
    .progress-track { width: 200px; height: 3px; background: var(--border); border-radius: 99px; overflow: hidden; margin-bottom: 1rem; }
    .progress-bar { height: 100%; width: 60%; background: linear-gradient(90deg, var(--accent), var(--accent2)); animation: progress 2s ease-in-out infinite alternate; border-radius: 99px; }
    .job-code { font-size: 10px; color: #94a3b8; font-family: monospace; }

    /* Empty */
    .empty-card { text-align: center; padding: 5rem 2rem; background: var(--card); border: 1px solid var(--border); border-radius: 28px; }
    .empty-icon { font-size: 48px; margin-bottom: 1rem; }
    .btn-primary { margin-top: 1.5rem; padding: 12px 28px; background: var(--accent); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 14px; }

    /* ── Audio Layout ── */
    .audio-layout { display: flex; flex-direction: column; gap: 1.25rem; }

    /* Hero card */
    .audio-hero-card { background: var(--card); border: 1px solid var(--border); border-radius: 30px; padding: 2rem; display: grid; grid-template-columns: 240px minmax(0,1fr); gap: 2rem; align-items: center; box-shadow: 0 24px 60px rgba(15,23,42,0.08); }
    @media (max-width: 760px) { .audio-hero-card { display: flex; flex-direction: column; align-items: center; text-align: center; } }

    .cover-wrap { position: relative; flex-shrink: 0; width: 240px; height: 240px; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 40px rgba(15,23,42,0.16); border: 1px solid rgba(15,23,42,0.05); }
    .cover-img { width: 100%; height: 100%; object-fit: cover; }
    .cover-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, #1e3a8a, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 56px; color: white; }
    .source-badge { position: absolute; bottom: 12px; right: 12px; padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: white; box-shadow: 0 10px 24px rgba(15,23,42,0.12); }
    .source-badge.shazam { background: #0d7ef5; }
    .source-badge.acoustid { background: #7c3aed; }

    .track-info { flex: 1; display: flex; flex-direction: column; gap: 12px; }
    .track-header-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .track-type-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; }
    .track-title { font-size: clamp(2rem, 4vw, 3.2rem); font-weight: 900; color: var(--text); line-height: 1.05; margin: 0; }
    .track-artist { font-size: 1rem; font-weight: 700; color: #475569; margin: 0; }
    .track-album { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; margin: 0; }
    .track-genre { display: inline-flex; align-items: center; justify-content: center; background: rgba(139,92,246,0.18); color: #7c3aed; font-size: 11px; font-weight: 700; padding: 6px 16px; border-radius: 999px; text-transform: uppercase; letter-spacing: 1px; }

    .match-summary { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 1rem; margin-top: 1rem; }
    .match-bar-track { width: 100%; height: 12px; background: rgba(59,130,246,0.14); border-radius: 999px; overflow: hidden; }
    .match-bar-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #a855f7); border-radius: 999px; transition: width 0.8s ease; }
    .match-label { font-size: 12px; font-weight: 700; color: #0f172a; white-space: nowrap; }

    .streaming-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 1.6rem; }
    .stream-btn { min-width: 130px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 18px; border-radius: 18px; font-size: 13px; font-weight: 700; text-decoration: none; transition: transform 0.2s ease, background-color 0.2s ease; box-shadow: 0 10px 20px rgba(15,23,42,0.08); }
    .stream-btn:hover { transform: translateY(-1px); }
    .stream-icon { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 12px; background: rgba(255,255,255,0.18); }
    .spotify-btn { background: #1db954; color: white; }
    .spotify-btn:hover { background: #17a74b; }
    .yt-btn { background: #ff0000; color: white; }
    .yt-btn:hover { background: #d40000; }
    .shazam-btn { background: #0d7ef5; color: white; }
    .shazam-btn:hover { background: #0b6fd8; }
    /* Feature badges row */
    .features-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; margin-top: 1rem; }
    @media (max-width: 760px) { .features-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .feat-card { background: var(--card); border: 1px solid rgba(148,163,184,0.16); border-radius: 24px; padding: 1.4rem; display: flex; flex-direction: column; align-items: flex-start; gap: 1rem; min-height: 160px; box-shadow: 0 18px 40px rgba(15,23,42,0.055); }
    .feat-card-top { display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 0.75rem; }
    .feat-icon { width: 42px; height: 42px; display: inline-flex; align-items: center; justify-content: center; border-radius: 14px; background: rgba(226,232,240,0.9); font-size: 20px; }
    .feat-chip { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 999px; background: rgba(148,163,184,0.12); color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; }
    .feat-value { font-size: 2rem; font-weight: 900; color: var(--text); line-height: 1; }
    .feat-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    .bpm-card { border-top: 4px solid #3b82f6; }
    .key-card { border-top: 4px solid #8b5cf6; }
    .energy-card { border-top: 4px solid #f59e0b; }
    .duration-card { border-top: 4px solid #10b981; }

    /* Not found banner */
    .not-found-banner { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 16px; padding: 1.2rem 1.5rem; display: flex; align-items: flex-start; gap: 14px; }
    .nf-icon { font-size: 28px; flex-shrink: 0; }
    .nf-title { font-size: 14px; font-weight: 700; color: #92400e; margin-bottom: 3px; }
    .nf-sub { font-size: 13px; color: #b45309; }

    /* Lyrics */
    /* ── Lyrics card ── */
    .lyrics-card { background: #0f172a; border-radius: 24px; overflow: hidden; }

    .lyrics-header { display: flex; align-items: center; justify-content: space-between; padding: 1.2rem 1.6rem 0; }
    .lyrics-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #475569; }
    .lyrics-title svg { opacity: 0.6; }
    .lyrics-source-tag { font-size: 10px; font-weight: 700; color: #334155; background: #1e293b; padding: 3px 10px; border-radius: 99px; }

    .lyrics-scroll { position: relative; max-height: 320px; overflow: hidden; transition: max-height 0.55s cubic-bezier(0.4, 0, 0.2, 1); }
    .lyrics-scroll.expanded { max-height: 3000px; }

    .lyrics-lines { padding: 1.4rem 1.6rem 2rem; display: flex; flex-direction: column; gap: 0; }

    .lyrics-section-tag { font-size: 11px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1.5px; margin: 1.4rem 0 0.6rem; opacity: 0.85; }
    .lyrics-section-tag:first-child { margin-top: 0; }

    .lyrics-line { font-size: 15px; line-height: 2; color: #e2e8f0; font-weight: 400; margin: 0; letter-spacing: 0.01em; }

    .lyrics-gap { height: 1rem; }

    .lyrics-fade { position: absolute; bottom: 0; left: 0; right: 0; height: 100px; background: linear-gradient(to bottom, transparent, #0f172a); pointer-events: none; }

    .lyrics-toggle-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 1rem; background: #1e293b; border: none; color: #94a3b8; font-size: 13px; font-weight: 700; cursor: pointer; transition: 0.2s; letter-spacing: 0.3px; }
    .lyrics-toggle-btn:hover { background: #263347; color: #e2e8f0; }
    .chevron-icon { transition: transform 0.3s ease; flex-shrink: 0; }
    .chevron-icon.flipped { transform: rotate(180deg); }

    /* Audio actions */
    .audio-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .action-btn { flex: 1; min-width: 160px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 16px; background: var(--accent); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.2s; }
    .action-btn:hover { background: #2563eb; transform: translateY(-1px); }
    .relancer-btn { background: linear-gradient(135deg, #7c3aed, #8b5cf6); }
    .relancer-btn:hover { background: linear-gradient(135deg, #6d28d9, #7c3aed); }
    .result-layout { display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; align-items: start; }
    @media (max-width: 900px) { .result-layout { grid-template-columns: 1fr; } }
    .left-col, .right-col { display: flex; flex-direction: column; gap: 1rem; }

    .identity-card { background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #7c3aed 100%); border-radius: 22px; padding: 1.8rem; display: flex; gap: 1rem; align-items: flex-start; color: white; box-shadow: 0 16px 40px rgba(37,99,235,0.25); }
    .id-icon { font-size: 36px; flex-shrink: 0; margin-top: 4px; }
    .id-body { flex: 1; }
    .id-name { font-size: 18px; font-weight: 800; margin-bottom: 0.4rem; }
    .id-sub { font-size: 13px; opacity: 0.8; margin-bottom: 1rem; }
    .confidence-bar-wrap { height: 4px; background: rgba(255,255,255,0.2); border-radius: 99px; margin-bottom: 0.4rem; }
    .confidence-bar { height: 100%; background: #10b981; border-radius: 99px; transition: width 1s ease; }
    .confidence-label { font-size: 11px; font-weight: 700; opacity: 0.85; }

    .section-card { background: var(--card); border: 1px solid var(--border); border-radius: 18px; padding: 1.4rem; }
    .section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 800; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--sub); }
    .icon-badge { font-size: 16px; }
    .count-badge { margin-left: auto; background: var(--accent); color: white; font-size: 10px; padding: 2px 8px; border-radius: 99px; }

    .faces-grid { display: flex; flex-direction: column; gap: 10px; }
    .face-chip { display: flex; align-items: center; gap: 12px; background: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; }
    .face-avatar { font-size: 24px; }
    .face-info { display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
    .face-info strong { font-size: 13px; color: var(--text); }
    .face-info span { color: var(--sub); }
    .score-tag { display: inline-block; background: rgba(16,185,129,0.1); color: #059669; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-top: 2px; }

    .milvus-card { display: flex; gap: 14px; align-items: flex-start; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-color: #86efac; }
    .milvus-icon { font-size: 28px; flex-shrink: 0; }
    .milvus-title { font-size: 13px; font-weight: 700; color: #166534; margin-bottom: 3px; }
    .milvus-sub { font-size: 12px; color: #166534; opacity: 0.8; margin-bottom: 6px; }
    .phase-badge { display: inline-block; background: #bbf7d0; color: #166534; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }

    .actions-col { display: flex; gap: 10px; }
    .action-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px; background: var(--accent); color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 13px; cursor: pointer; transition: 0.2s; }
    .action-btn:hover { background: #2563eb; }
    .action-btn.outline { background: var(--card); color: var(--text); border: 1px solid var(--border); }
    .action-btn.outline:hover { background: var(--bg); }

    .osint-cards-container { display: flex; flex-direction: column; gap: 1.5rem; }
    .osint-header-wrap { display: flex; align-items: center; gap: 1.5rem; background: var(--card); border: 1px solid var(--border); padding: 1.5rem; border-radius: 20px; }
    .osint-source-img-wrap { flex-shrink: 0; width: 110px; height: 110px; border-radius: 14px; overflow: hidden; border: 3px solid var(--accent); box-shadow: 0 8px 20px rgba(59,130,246,0.2); }
    .osint-source-img { width: 100%; height: 100%; object-fit: cover; }
    .osint-header-text { flex: 1; }
    .gallery-title { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 800; margin-bottom: 0.5rem; color: var(--text); }
    .osint-desc { font-size: 13px; color: var(--sub); line-height: 1.5; }
    .search-engine-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    @media (max-width: 900px) { .search-engine-cards { grid-template-columns: 1fr; } }
    @media (max-width: 600px) { .osint-header-wrap { flex-direction: column; text-align: center; } }
    .engine-card { display: flex; align-items: center; gap: 1.2rem; background: var(--card); border: 1px solid var(--border); padding: 1.5rem; border-radius: 20px; text-decoration: none; color: inherit; transition: all 0.3s cubic-bezier(0.4,0,0.2,1); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .engine-card:hover { transform: translateY(-4px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .engine-icon-wrap { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 28px; }
    .google-card { border-top: 4px solid #4285f4; }
    .google-card .engine-icon-wrap { background: linear-gradient(135deg, rgba(66,133,244,0.1), rgba(234,67,53,0.1)); }
    .yandex-card { border-top: 4px solid #ff0000; }
    .yandex-card .engine-icon-wrap { background: linear-gradient(135deg, rgba(255,0,0,0.1), rgba(230,0,0,0.1)); }
    .engine-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .engine-info h3 { font-size: 16px; font-weight: 800; color: var(--text); margin: 0; }
    .engine-info p { font-size: 12px; color: var(--sub); line-height: 1.4; margin: 0; }
    .engine-arrow { color: var(--sub); opacity: 0.5; transition: all 0.3s; }
    .engine-card:hover .engine-arrow { opacity: 1; transform: translateX(4px); color: var(--accent); }

    /* Watch section for video platforms */
    .watch-section { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 20px; padding: 1.5rem; margin-top: 1rem; }
    .watch-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #0284c7; margin: 0 0 1rem; }
    .platform-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 10px; }
    @media (max-width: 768px) { .platform-grid { grid-template-columns: repeat(auto-fit, minmax(60px, 1fr)); } }
    .platform-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 12px 10px; background: white; border: 1.5px solid #bae6fd; border-radius: 14px; text-decoration: none; font-size: 11px; font-weight: 700; color: #0284c7; transition: all 0.2s ease; }
    .platform-btn:hover { transform: translateY(-2px); border-color: #0284c7; background: #ecf8ff; box-shadow: 0 8px 16px rgba(2,132,199,0.12); }
    .platform-icon { font-size: 20px; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 8px; background: rgba(2,132,199,0.1); }
    .platform-name { display: block; text-align: center; }
    
    .tiktok-btn { --tiktok: #25f4ee; }
    .tiktok-btn:hover { border-color: #25f4ee; background: rgba(37,244,238,0.05); color: #000; }
    .tiktok-btn .platform-icon { background: linear-gradient(135deg, rgba(37,244,238,0.2), rgba(254,44,85,0.2)); color: #25f4ee; }

    .netflix-btn { --netflix: #e50914; }
    .netflix-btn:hover { border-color: #e50914; background: rgba(229,9,20,0.05); color: #e50914; }
    .netflix-btn .platform-icon { background: rgba(229,9,20,0.15); color: #e50914; }
    
    .imdb-btn { --imdb: #f5d547; }
    .imdb-btn:hover { border-color: #f5d547; background: rgba(245,213,71,0.05); color: #333; }
    .imdb-btn .platform-icon { background: rgba(245,213,71,0.15); color: #f5d547; }
    
    .justwatch-btn { --jw: #4ba3ff; }
    .justwatch-btn:hover { border-color: #4ba3ff; background: rgba(75,163,255,0.05); color: #4ba3ff; }
    .justwatch-btn .platform-icon { background: rgba(75,163,255,0.15); color: #4ba3ff; }
    
    .rottentomatoes-btn { --rt: #fa320a; }
    .rottentomatoes-btn:hover { border-color: #fa320a; background: rgba(250,50,10,0.05); color: #fa320a; }
    .rottentomatoes-btn .platform-icon { background: rgba(250,50,10,0.15); color: #fa320a; }

    /* Animations */
    .animate-fade { animation: fadeIn 0.5s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
    @keyframes progress { from { width: 20%; } to { width: 85%; } }
  `]
})
export class ResultsComponent implements OnInit, OnDestroy {
  result: any;
  jobId: string | null = null;
  status: 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED' = 'IDLE';
  lyricsExpanded = false;
  private originalJobId: string | null = null;  // pour le relancement
  private originalSearchData: any = null;      // pour le relancement complet de l'upload

  // ── Getters for template strings (avoids apostrophe parsing issues) ──
  get statusLabel(): string {
    if (this.status === 'COMPLETED') return 'Analyse terminée';
    if (this.status === 'FAILED') return "Erreur d'analyse";
    return 'Traitement en cours...';
  }

  get emptyTitle(): string {
    return this.status === 'FAILED' ? "Erreur d'analyse" : 'Aucun résultat';
  }

  get emptyMessage(): string {
    if (this.status === 'FAILED') return "Une erreur s'est produite lors du traitement. Réessayez.";
    return "L'analyse n'a renvoyé aucune correspondance pour ce fichier.";
  }

  get lyricsLines(): string[] {
    return (this.result?.lyrics || '').split('\n');
  }

  isLyricsSection(line: string): boolean {
    return /^\[.+\]$/.test(line.trim());
  }
  private pollSub?: Subscription;
  private jobType = 'person';

  get spinnerIcon(): string {
    return this.jobType === 'audio' ? '🎵' : this.jobType === 'video' ? '🎬' : '👤';
  }
  get loadingTitle(): string {
    if (this.jobType === 'audio') return 'Reconnaissance Audio';
    if (this.jobType === 'video') return 'Analyse Vidéo';
    return 'Analyse Neuronale';
  }
  get loadingSubtitle(): string {
    if (this.jobType === 'audio') return 'Shazam + AcoustID en cours...';
    if (this.jobType === 'video') return 'Extraction audio + identification TMDb en cours...';
    return 'Identification des signatures numériques en cours...';
  }

  get videoYoutubeUrl(): string {
    const am = this.result?.audio_match;
    if (!am) return '#';
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(am.song_artist + ' ' + am.song_title)}`;
  }

  get spotifySearchUrl(): string {
    if (!this.result?.match) return '#';
    const q = encodeURIComponent(`${this.result.match.artist} ${this.result.match.title}`);
    return `https://open.spotify.com/search/${q}`;
  }
  get youtubeSearchUrl(): string {
    if (!this.result?.match) return '#';
    const q = encodeURIComponent(`${this.result.match.artist} ${this.result.match.title}`);
    return `https://www.youtube.com/results?search_query=${q}`;
  }

  constructor(private searchService: SearchService) {}

  encodeURIComponent(val: string): string {
    return encodeURIComponent(val || '');
  }

  ngOnInit() {
    const state = history.state;
    if (state && state.result) {
      const res = state.result;
      if (res.jobId) {
        this.jobId    = res.jobId;
        this.jobType  = res.type || 'person';
        this.status   = 'PROCESSING';
        this.startPolling();
      } else {
        this.result = res;
        this.status = 'COMPLETED';
        if (res.jobId) this.originalJobId = res.jobId;
      }
    } else if (state && state.searchData) {
      this.originalSearchData = state.searchData;
      this.jobType = state.searchData.type || 'person';
      this.status  = 'PROCESSING';
      this.executeSearch(state.searchData);
    }
  }

  /** Exécute la recherche de manière asynchrone ou synchrone */
  private executeSearch(data: any) {
    let obs: Observable<any>;
    if (data.file) {
      if (data.type === 'audio') {
        obs = this.searchService.searchAudio(data.file);
      } else if (data.type === 'video') {
        obs = this.searchService.searchVideo(data.file);
      } else {
        obs = this.searchService.searchPerson(data.file);
      }
    } else {
      obs = this.searchService.searchPerson(undefined, data.query);
    }

    obs.subscribe({
      next: (res) => {
        if (res && res.jobId) {
          this.jobId = res.jobId;
          this.originalJobId = res.jobId;
          this.startPolling();
        } else {
          this.result = res;
          this.status = 'COMPLETED';
        }
      },
      error: (err) => {
        console.error("Erreur de recherche:", err);
        this.status = 'FAILED';
      }
    });
  }

  /** Relance l'analyse complète (upload ou requêtage) ou le polling */
  relaunchSearch() {
    this.result = null;
    this.status = 'PROCESSING';
    this.pollSub?.unsubscribe();

    if (this.originalSearchData) {
      this.executeSearch(this.originalSearchData);
    } else {
      const idToUse = this.originalJobId || this.jobId;
      if (!idToUse) {
        this.status = 'FAILED';
        return;
      }
      this.jobId = idToUse;
      this.startPolling();
    }
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).src =
      'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=300&q=80';
  }

  onCoverError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  private startPolling() {
    if (!this.jobId) return;
    this.pollSub = interval(2000).pipe(
      switchMap(() => this.searchService.getJobStatus(this.jobId!)),
      takeWhile(res => {
        const s = (res.status || '').toUpperCase();
        return s === 'PROCESSING' || s === 'PENDING';
      }, true)
    ).subscribe({
      next: (res) => {
        const s = (res.status || '').toUpperCase();
        if (s === 'DONE' || s === 'COMPLETED') {
          if (res.type === 'audio') {
            this.result = {
              type:     'audio',
              match:    res.match   || null,
              features: res.features || null,
              lyrics:   res.lyrics   || null,
              title:    res.match?.title || 'Analyse audio terminée',
            };
          } else if (res.type === 'video') {
            this.result = {
              type:            'video',
              metadata:        res.metadata        || null,
              frames_analyzed: res.frames_analyzed || 0,
              audio_match:     res.audio_match     || null,
              tmdb_match:      res.tmdb_match      || null,
              title:           res.title           || 'Vidéo analysée',
            };
          } else {
            this.result = {
              type:           res.type || 'person',
              title:          res.title || 'Analyse terminée',
              description:    res.description || '',
              confidence:     res.face_analysis?.faces?.[0]?.det_score
                ? Math.round(res.face_analysis.faces[0].det_score * 100) : 92,
              face_analysis:  res.face_analysis,
              identity_search: res.identity_search,
              visual_matches: res.visual_matches || [],
              public_image_url: res.public_image_url,
            };
          }
          this.status = 'COMPLETED';
          this.pollSub?.unsubscribe();
        } else if (s === 'FAILED') {
          this.status = 'FAILED';
          this.pollSub?.unsubscribe();
        }
      },
      error: () => { this.status = 'FAILED'; }
    });
  }

  // ── Video Streaming Platform URLs ──
  getTiktokSearchUrl(): string {
    const title = this.result?.tmdb_match?.title || this.result?.audio_match?.song_title || 'vidéo';
    return `https://www.tiktok.com/search/video?q=${encodeURIComponent(title)}`;
  }

  getNetflixSearchUrl(): string {
    const title = this.result?.tmdb_match?.title || this.result?.audio_match?.song_title || 'film';
    return `https://www.netflix.com/search?q=${encodeURIComponent(title)}`;
  }

  getImdbUrl(): string {
    if (this.result?.tmdb_match?.tmdb_id) {
      // Convert TMDb ID to IMDb ID (requires external API, fallback to search)
      const title = this.result.tmdb_match.title || '';
      return `https://www.imdb.com/find?q=${encodeURIComponent(title)}`;
    }
    const title = this.result?.tmdb_match?.title || this.result?.audio_match?.song_title || 'film';
    return `https://www.imdb.com/find?q=${encodeURIComponent(title)}`;
  }

  getJustWatchUrl(): string {
    const title = this.result?.tmdb_match?.title || this.result?.audio_match?.song_title || 'film';
    return `https://www.justwatch.com/search?q=${encodeURIComponent(title)}`;
  }

  getRottenTomatoesUrl(): string {
    const title = this.result?.tmdb_match?.title || this.result?.audio_match?.song_title || 'film';
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return `https://www.rottentomatoes.com/search?search=${encodeURIComponent(title)}`;
  }

  ngOnDestroy() { this.pollSub?.unsubscribe(); }
}
