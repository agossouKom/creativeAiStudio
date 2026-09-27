import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SocialConnectWizardComponent } from './social-connect-wizard.component';

type MediaKind = 'VIDEO' | 'IMAGE';
type StudioTab = 'generation' | 'montage' | 'gallery' | 'social' | 'planning';

interface ImageModelEntry {
  id: string;
  label: string;
  description: string;
  defaultSize: number;
  available: boolean;
  unavailableReason?: string;
}

interface UploadedMediaItem {
  url: string;
  fileName: string;
  type: 'image' | 'video';
  size?: number;
  verified: boolean;
}

@Component({
  selector: 'app-generation-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SocialConnectWizardComponent],
  template: `
    <main class="studio">
      <header class="studio-header">
        <div>
          <a routerLink="/agentique/workspace" class="back-link">← Espace de travail</a>
          <h1>Creative AI Studio</h1>
          <p class="subtitle">Plateforme unifiée de création média : storyboard IA, montage automatique, rendu graphique et publication multi-plateformes.</p>
        </div>
        <div class="header-actions">
          <button class="secondary" type="button" (click)="loadJobs()" [disabled]="loadingJobs">↻ Actualiser</button>
        </div>
      </header>

      <!-- Navigation des onglets -->
      <nav class="studio-tabs" role="tablist" aria-label="Onglets du Studio">
        <button type="button" class="tab-btn" [class.active]="activeTab === 'generation'" (click)="activeTab = 'generation'" role="tab" [attr.aria-selected]="activeTab === 'generation'">
          <span class="tab-icon">✨</span>
          <span>1. Génération</span>
        </button>
        <button type="button" class="tab-btn" [class.active]="activeTab === 'montage'" (click)="activeTab = 'montage'" role="tab" [attr.aria-selected]="activeTab === 'montage'">
          <span class="tab-icon">🎬</span>
          <span>2. Montage</span>
        </button>
        <button type="button" class="tab-btn" [class.active]="activeTab === 'gallery'" (click)="activeTab = 'gallery'" role="tab" [attr.aria-selected]="activeTab === 'gallery'">
          <span class="tab-icon">🖼️</span>
          <span>3. Galerie</span>
          <span *ngIf="jobs.length" class="badge-count">{{ jobs.length }}</span>
        </button>
        <button type="button" class="tab-btn" [class.active]="activeTab === 'social'" (click)="activeTab = 'social'" role="tab" [attr.aria-selected]="activeTab === 'social'">
          <span class="tab-icon">🌐</span>
          <span>4. Réseaux Sociaux</span>
        </button>
        <button type="button" class="tab-btn" [class.active]="activeTab === 'planning'" (click)="activeTab = 'planning'" role="tab" [attr.aria-selected]="activeTab === 'planning'">
          <span class="tab-icon">📅</span>
          <span>5. Planning</span>
        </button>
      </nav>

      <!-- ============================================================== -->
      <!-- ONGLET 1 : GÉNÉRATION                                         -->
      <!-- ============================================================== -->
      <section *ngIf="activeTab === 'generation'" class="studio-card animate-fade">
        <div class="card-header-row">
          <div>
            <h2 class="section-title">Nouveau projet média</h2>
            <p class="section-desc">Définissez votre brief de création, joignez vos fichiers multimédias de référence et laissez l'agent IA orchestrer le scénario et le rendu.</p>
          </div>
          <!-- Sélecteur de média avec Tooltip -->
          <div class="field-with-tip mode-toggle-wrap">
            <div class="mode-switch" role="group" aria-label="Type de média">
              <button type="button" [class.selected]="mediaKind === 'VIDEO'" (click)="mediaKind = 'VIDEO'">🎬 Vidéo</button>
              <button type="button" [class.selected]="mediaKind === 'IMAGE'" (click)="mediaKind = 'IMAGE'">🎨 Image</button>
            </div>
            <div class="tip-anchor" tabindex="0" role="tooltip" aria-label="Aide sur le type de média">
              <span class="tip-icon">ℹ️</span>
              <div class="tip-card">
                <strong>Type de média :</strong>
                <p>• 🎬 <em>Vidéo</em> : Génère un clip narratif complet (storyboard IA, voix de synthèse, sous-titres, transitions et séquences vidéo).</p>
                <p>• 🎨 <em>Image</em> : Produit des visuels haute fidélité via le modèle graphique sélectionné.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 1.1 Brief de création avec Tooltip -->
        <div class="field-group">
          <div class="field-label-row">
            <span class="field-label">Brief de création <span class="required">*</span></span>
            <div class="tip-anchor" tabindex="0" role="tooltip" aria-label="Aide sur le brief">
              <span class="tip-icon">ℹ️</span>
              <div class="tip-card">
                <strong>Conseils pour le brief :</strong>
                <p>Indiquez clairement le sujet, l'objectif (ex: vente, sensibilisation, humour), le public visé et l'ambiance souhaitée. L'agent IA s'appuiera dessus pour composer le script et le découpage technique.</p>
              </div>
            </div>
          </div>
          <textarea [(ngModel)]="prompt" [maxlength]="mediaKind === 'VIDEO' ? 8000 : 4000" rows="4"
                    placeholder="Ex: Présenter notre nouvelle plateforme SaaS aux entrepreneurs francophones, avec une accroche dynamique, un ton professionnel et un appel à l'action percutant…"></textarea>
          <div class="textarea-footer">
            <span class="muted text-xs">Caractères restants : {{ (mediaKind === 'VIDEO' ? 8000 : 4000) - prompt.length }}</span>
          </div>
        </div>

        <!-- 1.2 Téléversement / Upload de médias de référence avec Tooltip -->
        <div class="field-group upload-section">
          <div class="field-label-row">
            <span class="field-label">Médias de référence & séquences utilisateur (Optionnel)</span>
            <div class="tip-anchor" tabindex="0" role="tooltip" aria-label="Aide sur l'import de médias">
              <span class="tip-icon">ℹ️</span>
              <div class="tip-card">
                <strong>Protection & Contrôle :</strong>
                <p>Vos fichiers (PNG, JPG, WEBP, MP4) sont vérifiés par analyse binaire (Magic Bytes) et protection antivirus avant stockage sécurisé MinIO. Ils servent de contexte visuel ou de clips prioritaires.</p>
              </div>
            </div>
          </div>

          <!-- Zone de Drop / Sélection -->
          <div class="dropzone" [class.dragover]="isDragging"
               (dragover)="onDragOver($event)" (dragleave)="onDragLeave($event)" (drop)="onDrop($event)">
            <input type="file" #fileInput (change)="onFileSelected($event)" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" style="display:none">
            <div class="dropzone-content">
              <span class="dropzone-icon">📁</span>
              <div>
                <p class="dropzone-text">Glissez-déposez vos fichiers ici, ou <button type="button" class="link-btn" (click)="fileInput.click()">parcourez vos dossiers</button></p>
                <p class="dropzone-sub">Formats acceptés : PNG, JPG, WEBP, MP4, WebM · Max 10 Mo par image, 50 Mo par vidéo</p>
              </div>
              <button type="button" class="secondary dropzone-btn" (click)="fileInput.click()" [disabled]="uploadingMedia">
                {{ uploadingMedia ? 'Téléversement…' : '+ Ajouter un fichier' }}
              </button>
            </div>
          </div>

          <div *ngIf="uploadError" class="notice error text-sm mt-2">{{ uploadError }}</div>

          <!-- Liste des médias uploadés -->
          <div *ngIf="uploadedMedia.length > 0" class="uploaded-list">
            <div *ngFor="let item of uploadedMedia; let i = index" class="media-pill">
              <span class="media-type-tag">{{ item.type === 'video' ? '🎬 Vidéo' : '🖼️ Image' }}</span>
              <span class="media-filename" [title]="item.fileName">{{ item.fileName }}</span>
              <span *ngIf="item.verified" class="verified-tag" title="Signature binaire vérifiée">✓ Magic Bytes OK</span>
              <button type="button" class="remove-btn" (click)="removeUploadedMedia(i)" title="Retirer ce média">×</button>
            </div>
          </div>
        </div>

        <!-- 1.3 Sélection automatique ou manuelle de l'Agent IA -->
        <div class="agent-banner">
          <div class="agent-banner-info">
            <div class="agent-avatar">🤖</div>
            <div>
              <div class="agent-banner-title">
                <span>Agent Storyboard & Réalisation : <strong>{{ autoAgentName }}</strong></span>
                <span class="badge-auto">Attribution automatique</span>
              </div>
              <p class="agent-banner-desc">L'agent Studio est pré-configuré pour scripter vos vidéos, structurer le découpage des scènes et garantir la cohérence artistique.</p>
            </div>
          </div>
          <button type="button" class="secondary text-xs" (click)="manualAgentSelect = !manualAgentSelect">
            {{ manualAgentSelect ? 'Masquer la sélection' : 'Changer d’agent' }}
          </button>
        </div>

        <div *ngIf="manualAgentSelect" class="fields-grid mt-3 p-3 sub-card animate-fade">
          <label class="field">
            <div class="field-label-row">
              <span>Sélectionner manuellement un agent</span>
              <div class="tip-anchor" tabindex="0">
                <span class="tip-icon">ℹ️</span>
                <div class="tip-card">
                  <strong>Choix de l'agent :</strong>
                  <p>Permet d'utiliser un agent spécialisé (ex: Marketing, Commercial, RH) pour que le script de la vidéo adopte sa persona et son vocabulaire spécifique.</p>
                </div>
              </div>
            </div>
            <select [(ngModel)]="agentId">
              <option value="">Provider worker (sans agent personnalisé)</option>
              <option *ngFor="let agent of agents" [value]="agent.id">
                {{ agent.name || agent.id }}{{ agent.teamName ? ' · ' + agent.teamName : '' }}
              </option>
            </select>
          </label>
        </div>

        <!-- 1.4 Options Spécifiques VIDÉO -->
        <ng-container *ngIf="mediaKind === 'VIDEO'">
          <h3 class="group-title mt-4">Paramètres de réalisation vidéo</h3>
          <div class="fields-grid">
            <!-- Voix de narration avec Tooltip -->
            <label class="field">
              <div class="field-label-row">
                <span>Voix de narration</span>
                <div class="tip-anchor" tabindex="0">
                  <span class="tip-icon">ℹ️</span>
                  <div class="tip-card">
                    <strong>Voix de synthèse :</strong>
                    <p>Synthèse vocale neuronale naturelle Edge TTS. Choisissez la voix correspondant à la langue et au genre désiré.</p>
                  </div>
                </div>
              </div>
              <select [(ngModel)]="videoOptions.voice">
                <option value="fr-FR-DeniseNeural">Français — Denise (Femme, posée)</option>
                <option value="fr-FR-HenriNeural">Français — Henri (Homme, dynamique)</option>
                <option value="en-US-AriaNeural">Anglais — Aria (Standard international)</option>
                <option value="es-ES-ElviraNeural">Espagnol — Elvira</option>
                <option value="de-DE-KatjaNeural">Allemand — Katja</option>
                <option value="pt-BR-FranciscaNeural">Portugais — Francisca</option>
              </select>
            </label>

            <!-- Ratio d'aspect avec Tooltip -->
            <label class="field">
              <div class="field-label-row">
                <span>Format de cadrage</span>
                <div class="tip-anchor" tabindex="0">
                  <span class="tip-icon">ℹ️</span>
                  <div class="tip-card">
                    <strong>Format d'image :</strong>
                    <p>• <strong>9:16</strong> : Vertical (Reels, TikTok, Shorts).<br>• <strong>16:9</strong> : Paysage (YouTube, LinkedIn, TV).<br>• <strong>1:1</strong> : Carré (Posts Instagram / Facebook).</p>
                  </div>
                </div>
              </div>
              <select [(ngModel)]="videoOptions.aspectRatio">
                <option value="9:16">📱 Vertical — 9:16 (TikTok, Reels, Shorts)</option>
                <option value="16:9">💻 Paysage — 16:9 (YouTube, TV)</option>
                <option value="1:1">🟦 Carré — 1:1 (Flux Instagram / Facebook)</option>
              </select>
            </label>

            <!-- Source des séquences vidéo avec Tooltip -->
            <label class="field">
              <div class="field-label-row">
                <span>Banque de séquences vidéo</span>
                <div class="tip-anchor" tabindex="0">
                  <span class="tip-icon">ℹ️</span>
                  <div class="tip-card">
                    <strong>Source des clips :</strong>
                    <p>Fournisseur de vidéos d'illustration libres de droits synchronisées automatiquement avec les phrases du script.</p>
                  </div>
                </div>
              </div>
              <select [(ngModel)]="videoOptions.source">
                <option value="pexels">Pexels Video (Haute définition)</option>
                <option value="pixabay">Pixabay Video (Large variété)</option>
              </select>
            </label>

            <!-- Durée par clip avec Tooltip -->
            <label class="field">
              <div class="field-label-row">
                <span>Rythme moyen par séquence</span>
                <div class="tip-anchor" tabindex="0">
                  <span class="tip-icon">ℹ️</span>
                  <div class="tip-card">
                    <strong>Dynamisme du montage :</strong>
                    <p>Durée en secondes de chaque plan. 3 à 5 secondes recommandées pour captiver l'attention sur les réseaux sociaux.</p>
                  </div>
                </div>
              </div>
              <input type="number" min="2" max="30" [(ngModel)]="videoOptions.clipDurationSeconds">
            </label>

            <!-- Sous-titres automatiques avec Tooltip -->
            <label class="field">
              <div class="field-label-row">
                <span>Sous-titres synchronisés</span>
                <div class="tip-anchor" tabindex="0">
                  <span class="tip-icon">ℹ️</span>
                  <div class="tip-card">
                    <strong>Incrustation texte :</strong>
                    <p>Ajoute des sous-titres animés et lisibles sur la vidéo pour les spectateurs consultant sans le son (85% sur mobile).</p>
                  </div>
                </div>
              </div>
              <select [(ngModel)]="videoOptions.subtitles">
                <option [ngValue]="true">Oui — Incruster les sous-titres animés</option>
                <option [ngValue]="false">Non — Vidéo sans sous-titres</option>
              </select>
            </label>

            <!-- Variantes avec Tooltip -->
            <label class="field">
              <div class="field-label-row">
                <span>Nombre de variantes</span>
                <div class="tip-anchor" tabindex="0">
                  <span class="tip-icon">ℹ️</span>
                  <div class="tip-card">
                    <strong>Variations :</strong>
                    <p>Génère plusieurs propositions alternatives de montage pour tester le meilleur rendu (A/B testing).</p>
                  </div>
                </div>
              </div>
              <input type="number" min="1" max="5" [(ngModel)]="videoOptions.videoCount">
            </label>
          </div>
        </ng-container>

        <!-- 1.5 Options Spécifiques IMAGE -->
        <ng-container *ngIf="mediaKind === 'IMAGE'">
          <h3 class="group-title mt-4">Paramètres de rendu d'image</h3>

          <!-- Modèle d'image dynamique avec Tooltip -->
          <div class="fields-grid">
            <label class="field">
              <div class="field-label-row">
                <span>Modèle d'image</span>
                <div class="tip-anchor" tabindex="0">
                  <span class="tip-icon">ℹ️</span>
                  <div class="tip-card">
                    <strong>Modèles graphiques :</strong>
                    <p>• <strong>Qualité maximale (gpt-image-1)</strong> : Rendu ultra-détaillé et photoréaliste.<br>• <strong>Style illustré (dall-e-3)</strong> : Stylisé, idéal pour les visuels de marque.<br>• <strong>Rapide & économe (dall-e-2)</strong> : Parfait pour esquisses et maquettes.</p>
                  </div>
                </div>
              </div>
              <select [(ngModel)]="imageOptions.model">
                <option *ngFor="let m of imageModels" [value]="m.id">
                  {{ m.label }} — {{ m.id }}
                </option>
                <option *ngIf="imageModels.length === 0" value="gpt-image-1">Qualité maximale (Standard)</option>
              </select>
            </label>

            <!-- Dimensions avec Tooltip -->
            <label class="field">
              <div class="field-label-row">
                <span>Dimensions en pixels</span>
                <div class="tip-anchor" tabindex="0">
                  <span class="tip-icon">ℹ️</span>
                  <div class="tip-card">
                    <strong>Résolution :</strong>
                    <p>Format de sortie garanti en PNG haute fidélité. Adapté aux bannières web, fiches produits et publications sociales.</p>
                  </div>
                </div>
              </div>
              <select [(ngModel)]="imageOptions.size">
                <option value="1024x1024">1024 × 1024 px (Carré universel)</option>
                <option value="1024x1536">1024 × 1536 px (Portrait / Story)</option>
                <option value="1536x1024">1536 × 1024 px (Paysage / Bannière)</option>
              </select>
            </label>

            <!-- Nombre d'images avec Tooltip -->
            <label class="field">
              <div class="field-label-row">
                <span>Nombre de rendus</span>
                <div class="tip-anchor" tabindex="0">
                  <span class="tip-icon">ℹ️</span>
                  <div class="tip-card">
                    <strong>Quantité :</strong>
                    <p>Nombre d'images distinctes générées pour cette même consigne.</p>
                  </div>
                </div>
              </div>
              <input type="number" min="1" max="4" [(ngModel)]="imageOptions.count">
            </label>
          </div>

          <!-- Description du modèle sélectionné -->
          <div *ngIf="selectedImageModel" class="model-info-box mt-2">
            <strong>{{ selectedImageModel.label }} :</strong> {{ selectedImageModel.description }}
            <div *ngIf="!selectedImageModel.available" class="warning-tag mt-1">
              ⚠️ {{ selectedImageModel.unavailableReason || 'Fournisseur non initialisé' }}
            </div>
          </div>
        </ng-container>

        <!-- Messages de statut -->
        <div *ngIf="errorMessage" class="notice error mt-4" role="alert">{{ errorMessage }}</div>
        <div *ngIf="successMessage" class="notice success mt-4" role="status">{{ successMessage }}</div>

        <!-- Bouton d'action principal -->
        <div class="form-actions mt-4">
          <button class="primary launch-btn" type="button" (click)="submit()" [disabled]="submitting || !prompt.trim()">
            <span *ngIf="submitting">🚀 Lancement de la génération en cours…</span>
            <span *ngIf="!submitting">🚀 Lancer la génération {{ mediaKind === 'VIDEO' ? 'vidéo' : 'd’image' }}</span>
          </button>
        </div>
      </section>

      <!-- ============================================================== -->
      <!-- ONGLET 2 : MONTAGE (TIMELINE)                                  -->
      <!-- ============================================================== -->
      <section *ngIf="activeTab === 'montage'" class="studio-card animate-fade">
        <h2 class="section-title">🎬 Éditeur de Montage Vidéo</h2>
        <p class="section-desc">Aperçu interactif des séquences vidéo, synchronisation de la bande son et gestion des transitions.</p>

        <div class="montage-preview-box">
          <div class="timeline-container">
            <div class="timeline-header">
              <span>Piste 1 : Séquences visuelles (B-Roll)</span>
              <span class="muted text-xs">Durée estimée : ~{{ videoOptions.clipDurationSeconds * 4 }}s</span>
            </div>
            <div class="timeline-track clips-track">
              <div class="track-block clip-block">Clip 1 : Intro</div>
              <div class="track-block clip-block">Clip 2 : Développement</div>
              <div class="track-block clip-block">Clip 3 : Argument clé</div>
              <div class="track-block clip-block">Clip 4 : Call-to-action</div>
            </div>

            <div class="timeline-header mt-3">
              <span>Piste 2 : Voix off & Synthèse</span>
              <span class="muted text-xs">{{ videoOptions.voice }}</span>
            </div>
            <div class="timeline-track voice-track">
              <div class="track-block voice-block">Narration IA synchronisée</div>
            </div>

            <div class="timeline-header mt-3">
              <span>Piste 3 : Sous-titres & Titrages</span>
              <span class="muted text-xs">Styles & Emojis auto</span>
            </div>
            <div class="timeline-track text-track">
              <div class="track-block text-block">Sous-titres dynamiques</div>
            </div>
          </div>

          <div class="montage-actions mt-4">
            <button class="secondary" type="button" (click)="activeTab = 'generation'">← Ajuster le brief</button>
            <button class="primary" type="button" (click)="submit()" [disabled]="!prompt.trim() || submitting">Lancer le rendu complet</button>
          </div>
        </div>
      </section>

      <!-- ============================================================== -->
      <!-- ONGLET 3 : GALERIE                                            -->
      <!-- ============================================================== -->
      <section *ngIf="activeTab === 'gallery'" class="studio-card animate-fade">
        <div class="history-heading">
          <div>
            <h2 class="section-title">🖼️ Galerie des créations</h2>
            <p class="section-desc">Consultez, prévisualisez, téléchargez et republiez l'ensemble de vos médias générés.</p>
          </div>
          <button class="secondary text-sm" (click)="loadJobs()">↻ Rafraîchir</button>
        </div>

        <div *ngIf="!loadingJobs && jobs.length === 0" class="empty">Aucune génération terminée pour le moment. Lancez votre premier projet depuis l'onglet Génération !</div>
        
        <div class="gallery-grid">
          <article *ngFor="let job of jobs" class="gallery-card">
            <div class="gallery-card-header">
              <span class="kind">{{ job.mediaType === 'VIDEO' ? '🎬 Vidéo' : '🎨 Image' }}</span>
              <span class="status" [attr.data-status]="job.status">{{ job.status }}<ng-container *ngIf="job.progress"> ({{ job.progress }}%)</ng-container></span>
            </div>

            <div class="gallery-card-body">
              <p class="job-prompt-text" [title]="job.prompt">{{ job.prompt }}</p>
              <div class="job-meta-details">
                <span class="muted text-xs">Créé le : {{ job.createdAt | date:'short' }}</span>
                <span *ngIf="job.outputs?.length" class="text-xs text-indigo-400 font-semibold">{{ job.outputs.length }} fichier(s) généré(s)</span>
              </div>
              <p *ngIf="job.error?.message" class="job-error mt-2">{{ job.error.message }}</p>
            </div>

            <div class="gallery-card-actions">
              <button type="button" class="secondary text-xs" (click)="refreshJob(job)" [disabled]="job.refreshing">Détails</button>
              <button *ngFor="let output of job.outputs" type="button" class="secondary text-xs" (click)="download(job, output.index)">
                📥 Télécharger
              </button>
              <button *ngFor="let output of job.outputs" type="button" class="primary text-xs"
                      [disabled]="job.status !== 'DONE' || availablePlatforms(job).length === 0"
                      (click)="openPublisher(job, output.index)">
                🚀 Publier
              </button>
              <button *ngIf="job.status === 'FAILED' || job.status === 'DONE'" type="button" class="secondary text-xs"
                      (click)="retry(job)" [disabled]="job.retrying">
                {{ job.retrying ? 'Relance…' : '↻ Relancer' }}
              </button>
            </div>

            <!-- Panneau de publication intégré -->
            <div *ngIf="publishJobId === job.jobId" class="publish-panel mt-3">
              <h4 class="text-sm font-bold text-indigo-300">Diffusion sur les réseaux sociaux</h4>
              <label class="field">
                <div class="field-label-row">
                  <span>Réseau social cible</span>
                  <div class="tip-anchor" tabindex="0">
                    <span class="tip-icon">ℹ️</span>
                    <div class="tip-card">
                      <strong>Diffusion :</strong>
                      <p>Facebook et Instagram sont disponibles immédiatement. Les autres plateformes sont en cours d'intégration.</p>
                    </div>
                  </div>
                </div>
                <select [(ngModel)]="publishPlatform">
                  <option *ngFor="let platform of availablePlatforms(job)" [value]="platform.platform">{{ platform.label }}</option>
                </select>
              </label>

              <label class="field">
                <div class="field-label-row">
                  <span>Agent propriétaire du canal</span>
                  <div class="tip-anchor" tabindex="0">
                    <span class="tip-icon">ℹ️</span>
                    <div class="tip-card">
                      <strong>Canal connecté :</strong>
                      <p>Sélectionnez l'agent disposant des identifiants et autorisations du compte cible.</p>
                    </div>
                  </div>
                </div>
                <select [(ngModel)]="publishAgentId">
                  <option value="">Sélectionner l'agent</option>
                  <option *ngFor="let agent of agents" [value]="agent.id">{{ agent.name || agent.id }}</option>
                </select>
              </label>

              <label class="field">
                <div class="field-label-row">
                  <span>Légende du post</span>
                  <div class="tip-anchor" tabindex="0">
                    <span class="tip-icon">ℹ️</span>
                    <div class="tip-card">
                      <strong>Légende :</strong>
                      <p>Texte de présentation, hashtags et mentions affichés sous la vidéo ou l'image.</p>
                    </div>
                  </div>
                </div>
                <textarea [(ngModel)]="publishCaption" rows="2" maxlength="2200"></textarea>
              </label>

              <p *ngIf="publishResult" class="hint">Publication {{ publishResult.status }} · {{ publishResult.requestId }}</p>

              <div class="job-actions mt-2">
                <button class="secondary text-xs" type="button" (click)="publishJobId = ''">Fermer</button>
                <button class="primary text-xs" type="button" (click)="publish(job, publishOutputIndex)"
                        [disabled]="publishing || !publishPlatform || !publishAgentId">
                  {{ publishing ? 'Envoi…' : 'Confirmer la publication' }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- ============================================================== -->
      <!-- ============================================================== -->
      <!-- ONGLET 4 : RÉSEAUX SOCIAUX                                    -->
      <!-- ============================================================== -->
      <section *ngIf="activeTab === 'social'" class="studio-card animate-fade">
        <!-- Wizard OAuth — connexion en 1 clic, sans copier-coller de tokens -->
        <app-social-connect-wizard
          [agentId]="agentId || ''"
        ></app-social-connect-wizard>
      </section>

      <!-- ONGLET 5 : PLANNING                                           -->
      <!-- ============================================================== -->
      <section *ngIf="activeTab === 'planning'" class="studio-card animate-fade">
        <h2 class="section-title">📅 Planning & Calendrier Éditorial</h2>
        <p class="section-desc">Programmez vos publications sur les réseaux sociaux pour les diffuser automatiquement au meilleur créneau horaire.</p>

        <div class="planning-box mt-4">
          <div class="empty p-4">
            <span class="text-2xl">🗓️</span>
            <h3 class="font-bold text-lg mt-2">Planification automatique</h3>
            <p class="text-sm text-slate-400 mt-1">Vous pouvez sélectionner un média depuis la <strong>Galerie</strong> et choisir une date et une heure de diffusion différée.</p>
            <button class="primary mt-3 text-sm" (click)="activeTab = 'gallery'">Ouvrir la Galerie</button>
          </div>
        </div>
      </section>

    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:#080d19; color:#e2e8f0; padding:clamp(1rem,3vw,2.5rem); font-family:'Inter',system-ui,sans-serif; }
    .studio { max-width:1160px; margin:0 auto; }
    .studio-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem; }
    h1 { margin:.35rem 0 .2rem; font-size:clamp(1.7rem,3.5vw,2.3rem); font-weight:800; color:#f8fafc; letter-spacing:-0.02em; }
    .subtitle { color:#94a3b8; font-size:.92rem; max-width:750px; line-height:1.5; margin:0; }
    .back-link { color:#818cf8; text-decoration:none; font-size:.85rem; font-weight:600; display:inline-flex; align-items:center; transition:color .2s; }
    .back-link:hover { color:#a5b4fc; }

    /* Onglets de navigation */
    .studio-tabs { display:flex; gap:.5rem; margin-bottom:1.5rem; border-bottom:1px solid #1e293b; padding-bottom:.5rem; overflow-x:auto; }
    .tab-btn { display:inline-flex; align-items:center; gap:.5rem; padding:.65rem 1.15rem; background:transparent; border:1px solid transparent; border-radius:10px; color:#94a3b8; font-weight:600; font-size:.88rem; cursor:pointer; transition:all .2s; white-space:nowrap; }
    .tab-btn:hover { background:#111c30; color:#cbd5e1; }
    .tab-btn.active { background:#4f46e5; color:#ffffff; border-color:#6366f1; box-shadow:0 4px 12px rgba(79,70,229,.3); }
    .tab-icon { font-size:1rem; }
    .badge-count { background:#312e81; color:#c7d2fe; padding:.15rem .45rem; border-radius:99px; font-size:.72rem; }

    /* Cartes & Structures */
    .studio-card { background:#101a2d; border:1px solid #23334d; border-radius:18px; padding:clamp(1.2rem,3vw,2rem); box-shadow:0 8px 30px rgba(0,0,0,.35); }
    .card-header-row { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1.2rem; margin-bottom:1.5rem; }
    .section-title { margin:0 0 .3rem; font-size:1.3rem; color:#f8fafc; font-weight:700; }
    .section-desc { margin:0; color:#94a3b8; font-size:.88rem; line-height:1.5; max-width:680px; }
    .group-title { font-size:1rem; font-weight:700; color:#cbd5e1; margin-bottom:.8rem; border-bottom:1px solid #1e293b; padding-bottom:.4rem; }

    /* Sélecteur de mode */
    .mode-toggle-wrap { display:flex; align-items:center; gap:.5rem; }
    .mode-switch { display:flex; background:#0b1322; padding:3px; border-radius:10px; border:1px solid #25334c; }
    .mode-switch button { border:none; padding:.5rem 1rem; border-radius:8px; background:transparent; color:#94a3b8; font-weight:600; font-size:.85rem; cursor:pointer; transition:all .2s; }
    .mode-switch button.selected { background:#4f46e5; color:#ffffff; box-shadow:0 2px 8px rgba(79,70,229,.4); }

    /* Labels et Tooltips */
    .field-group { margin-bottom:1.25rem; }
    .field { display:flex; flex-direction:column; gap:.4rem; min-width:0; }
    .field-label-row { display:flex; align-items:center; gap:.4rem; margin-bottom:.35rem; }
    .field-label, .field span { font-size:.84rem; font-weight:600; color:#cbd5e1; }
    .required { color:#f87171; font-weight:bold; }

    /* Tooltip enrichi interactif */
    .tip-anchor { position:relative; display:inline-flex; align-items:center; cursor:help; outline:none; }
    .tip-icon { font-size:.8rem; opacity:.7; transition:opacity .2s; user-select:none; }
    .tip-anchor:hover .tip-icon, .tip-anchor:focus .tip-icon { opacity:1; }
    .tip-card { display:none; position:absolute; z-index:100; left:50%; bottom:calc(100% + 8px); transform:translateX(-50%); width:max-content; max-width:280px; background:#1e293b; color:#e2e8f0; font-size:.78rem; font-weight:normal; line-height:1.45; padding:.65rem .85rem; border-radius:10px; border:1px solid #3b82f6; box-shadow:0 10px 25px rgba(0,0,0,.5); pointer-events:none; }
    .tip-card::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border-width:5px; border-style:solid; border-color:#3b82f6 transparent transparent transparent; }
    .tip-anchor:hover .tip-card, .tip-anchor:focus .tip-card { display:block; animation:fadeUp .2s ease-out; }
    .tip-card p { margin:.3rem 0 0; color:#cbd5e1; }
    .tip-card strong { color:#93c5fd; }

    /* Champs de saisie */
    input, select, textarea { width:100%; box-sizing:border-box; border:1px solid #2b3a55; border-radius:10px; padding:.7rem .85rem; background:#0b1322; color:#f1f5f9; font:inherit; font-size:.88rem; transition:border-color .2s; }
    input:focus, select:focus, textarea:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.2); }
    textarea { resize:vertical; }
    .textarea-footer { display:flex; justify-content:flex-end; margin-top:.3rem; }

    /* Section Upload & Dropzone */
    .dropzone { border:2px dashed #2d3e5e; border-radius:12px; padding:1.25rem; background:#0b1322; text-align:center; transition:all .2s; }
    .dropzone.dragover { border-color:#6366f1; background:#141e33; }
    .dropzone-content { display:flex; flex-direction:column; align-items:center; gap:.5rem; }
    .dropzone-icon { font-size:2rem; }
    .dropzone-text { margin:0; font-size:.88rem; color:#cbd5e1; }
    .dropzone-sub { margin:0; font-size:.75rem; color:#64748b; }
    .link-btn { background:none; border:none; color:#818cf8; text-decoration:underline; font-weight:600; cursor:pointer; padding:0; }
    .dropzone-btn { margin-top:.4rem; font-size:.82rem; }

    .uploaded-list { display:flex; flex-wrap:wrap; gap:.5rem; margin-top:.75rem; }
    .media-pill { display:inline-flex; align-items:center; gap:.5rem; background:#1a273f; border:1px solid #334566; padding:.3rem .65rem; border-radius:8px; font-size:.8rem; }
    .media-type-tag { font-weight:700; color:#a5b4fc; }
    .media-filename { max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .verified-tag { background:#064e3b; color:#6ee7b7; padding:.1rem .4rem; border-radius:4px; font-size:.7rem; }
    .remove-btn { background:none; border:none; color:#f87171; font-size:1.1rem; cursor:pointer; padding:0 .2rem; line-height:1; }

    /* Bandeau Agent Studio */
    .agent-banner { display:flex; justify-content:space-between; align-items:center; background:#141f36; border:1px solid #293d63; border-radius:12px; padding:.9rem 1.2rem; margin:1rem 0; flex-wrap:wrap; gap:.8rem; }
    .agent-banner-info { display:flex; align-items:center; gap:.8rem; }
    .agent-avatar { font-size:1.8rem; background:#1e293b; padding:.4rem; border-radius:10px; border:1px solid #3b82f6; }
    .agent-banner-title { display:flex; align-items:center; gap:.5rem; font-size:.9rem; color:#f1f5f9; }
    .badge-auto { background:#312e81; color:#c7d2fe; font-size:.7rem; font-weight:700; padding:.15rem .45rem; border-radius:99px; }
    .agent-banner-desc { margin:.2rem 0 0; font-size:.78rem; color:#94a3b8; }
    .sub-card { background:#0b1322; border-radius:10px; border:1px solid #1e293b; }

    /* Grille de champs */
    .fields-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:1rem; margin-top:.5rem; }
    .model-info-box { background:#0e182a; border-left:3px solid #6366f1; padding:.65rem .85rem; border-radius:0 8px 8px 0; font-size:.82rem; color:#cbd5e1; }
    .warning-tag { color:#f59e0b; font-size:.78rem; font-weight:600; }

    /* Boutons */
    button { border:1px solid #334464; border-radius:9px; padding:.65rem 1.1rem; color:#e2e8f0; background:#172338; cursor:pointer; font-weight:600; font-size:.86rem; transition:all .2s; }
    button:hover:not(:disabled) { background:#22334f; border-color:#485f8a; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    .primary { background:#4f46e5; border-color:#6366f1; color:#fff; }
    .primary:hover:not(:disabled) { background:#4338ca; }
    .secondary { background:#141f35; border-color:#293b5c; }
    .launch-btn { padding:.85rem 2rem; font-size:1rem; font-weight:700; border-radius:12px; }
    .form-actions { display:flex; justify-content:flex-end; }

    /* Messages & Alertes */
    .notice { padding:.75rem 1rem; border-radius:10px; font-size:.85rem; font-weight:500; }
    .error { background:#451a1a; color:#fca5a5; border:1px solid #7f1d1d; }
    .success { background:#064e3b; color:#a7f3d0; border:1px solid #047857; }

    /* Galerie & Cards */
    .gallery-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:1.25rem; margin-top:1.25rem; }
    .gallery-card { background:#0b1322; border:1px solid #233450; border-radius:14px; padding:1.1rem; display:flex; flex-direction:column; justify-content:space-between; }
    .gallery-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:.65rem; }
    .kind, .status { padding:.2rem .55rem; border-radius:99px; font-size:.72rem; font-weight:700; background:#1e293b; color:#94a3b8; }
    .status[data-status="DONE"] { background:#064e3b; color:#6ee7b7; }
    .status[data-status="FAILED"] { background:#7f1d1d; color:#fca5a5; }
    .status[data-status="PROCESSING"] { background:#78350f; color:#fde68a; }
    .job-prompt-text { font-size:.85rem; color:#f1f5f9; margin:0 0 .5rem; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
    .gallery-card-actions { display:flex; flex-wrap:wrap; gap:.4rem; margin-top:1rem; border-top:1px solid #1a273f; padding-top:.75rem; }
    .publish-panel { background:#141f35; border:1px solid #2b3d63; border-radius:10px; padding:.85rem; }

    /* Réseaux Sociaux */
    .platform-cards-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:1rem; }
    .platform-card { background:#0b1322; border:1px solid #1e293b; border-radius:12px; padding:1rem; }
    .platform-card.live-card { border-color:#10b981; background:#091a1e; }
    .platform-card-header { display:flex; justify-content:space-between; align-items:center; }
    .status-badge { font-size:.68rem; font-weight:700; padding:.15rem .45rem; border-radius:99px; }
    .badge-live { background:#064e3b; color:#6ee7b7; }
    .badge-planned { background:#3b2d11; color:#fcd34d; }
    .platform-notes { color:#94a3b8; line-height:1.4; }

    /* Montage preview */
    .montage-preview-box { background:#0b1322; border:1px solid #233450; border-radius:14px; padding:1.2rem; }
    .timeline-container { display:flex; flex-direction:column; gap:.3rem; }
    .timeline-header { display:flex; justify-content:space-between; font-size:.78rem; font-weight:600; color:#cbd5e1; }
    .timeline-track { display:flex; gap:.3rem; background:#141d2f; border-radius:8px; padding:.4rem; }
    .track-block { flex:1; padding:.6rem .4rem; text-align:center; font-size:.72rem; font-weight:700; border-radius:6px; }
    .clip-block { background:#312e81; color:#c7d2fe; border:1px solid #4338ca; }
    .voice-block { background:#064e3b; color:#a7f3d0; border:1px solid #059669; }
    .text-block { background:#701a75; color:#f5d0fe; border:1px solid #86198f; }

    .empty { padding:2.5rem; text-align:center; color:#94a3b8; border:1px dashed #233450; border-radius:14px; }
    .muted { color:#94a3b8; }
    .text-xs { font-size:.75rem; }
    .mt-1 { margin-top:.25rem; }
    .mt-2 { margin-top:.5rem; }
    .mt-3 { margin-top:.75rem; }
    .mt-4 { margin-top:1rem; }
    .p-3 { padding:.75rem; }
    .p-4 { padding:1rem; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    .animate-fade { animation:fadeUp .25s ease-out; }

    @media(max-width:768px) {
      .card-header-row { flex-direction:column; align-items:stretch; }
      .agent-banner { flex-direction:column; align-items:flex-start; }
      .form-actions { justify-content:stretch; }
      .launch-btn { width:100%; }
    }
  `]
})
export class GenerationStudioComponent implements OnInit, OnDestroy {
  activeTab: StudioTab = 'generation';
  mediaKind: MediaKind = 'VIDEO';
  prompt = '';
  agentId = '';
  autoAgentName = 'Studio Media Creator';
  manualAgentSelect = false;

  agents: any[] = [];
  platforms: any[] = [];
  jobs: any[] = [];
  imageModels: ImageModelEntry[] = [];

  // Téléversement média
  uploadingMedia = false;
  uploadError = '';
  isDragging = false;
  uploadedMedia: UploadedMediaItem[] = [];

  submitting = false;
  loadingJobs = false;
  errorMessage = '';
  successMessage = '';

  // Publication sociale
  publishJobId = '';
  publishOutputIndex = 0;
  publishPlatform = '';
  publishAgentId = '';
  publishCaption = '';
  publishResult: any = null;
  publishing = false;

  readonly videoOptions = {
    aspectRatio: '9:16',
    language: 'fr',
    voice: 'fr-FR-DeniseNeural',
    subtitles: true,
    videoCount: 1,
    clipDurationSeconds: 5,
    source: 'pexels'
  };

  readonly imageOptions = {
    size: '1024x1024',
    count: 1,
    model: 'gpt-image-1'
  };

  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  get selectedImageModel(): ImageModelEntry | undefined {
    return this.imageModels.find(m => m.id === this.imageOptions.model);
  }

  ngOnInit(): void {
    this.loadAgents();
    this.loadImageModels();
    this.loadPlatforms();
    this.loadJobs();
    this.refreshTimer = setInterval(() => this.loadJobs(), 15000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  // ── Drag & Drop & Upload ───────────────────────────────────────────────────

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
    if (e.dataTransfer?.files?.length) {
      this.uploadFiles(e.dataTransfer.files);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.uploadFiles(input.files);
    }
  }

  uploadFiles(files: FileList): void {
    this.uploadError = '';
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVid = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|avi)$/i);
      const isImg = file.type.startsWith('image/') || file.name.match(/\.(png|jpe?g|webp|gif)$/i);

      if (!isVid && !isImg) {
        this.uploadError = `Fichier "${file.name}" non supporté. Formats acceptés : PNG, JPG, WEBP, MP4.`;
        continue;
      }

      const folder = isVid ? 'videos' : 'photos';
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      this.uploadingMedia = true;
      this.http.post<any>('/api/media/upload', formData).subscribe({
        next: res => {
          this.uploadedMedia.push({
            url: res.url || res.path || '',
            fileName: file.name,
            type: isVid ? 'video' : 'image',
            size: file.size,
            verified: true
          });
          this.uploadingMedia = false;
        },
        error: err => {
          this.uploadError = err?.error?.detail || err?.error?.message || `Erreur d'importation pour ${file.name}.`;
          this.uploadingMedia = false;
        }
      });
    }
  }

  removeUploadedMedia(index: number): void {
    this.uploadedMedia.splice(index, 1);
  }

  // ── Modèles d'image dynamiques ─────────────────────────────────────────────

  loadImageModels(): void {
    this.http.get<ImageModelEntry[]>('/api/generation/image-models').subscribe({
      next: models => {
        if (Array.isArray(models) && models.length > 0) {
          this.imageModels = models;
          if (!this.imageModels.some(m => m.id === this.imageOptions.model)) {
            this.imageOptions.model = this.imageModels[0].id;
          }
        }
      },
      error: () => {
        this.imageModels = [
          { id: 'gpt-image-1', label: 'Qualité maximale', description: 'Le plus fidèle aux indications, idéal couverture.', defaultSize: 1024, available: true },
          { id: 'dall-e-3', label: 'Style illustré', description: 'Rendu graphique/net, pour visuels de marque.', defaultSize: 1024, available: true },
          { id: 'dall-e-2', label: 'Rapide et économe', description: 'Génération simple, pour les brouillons.', defaultSize: 512, available: true }
        ];
      }
    });
  }

  // ── Agents & Sélection automatique ─────────────────────────────────────────

  loadAgents(): void {
    this.http.get<any>('/api/agents').subscribe({
      next: response => {
        this.agents = Array.isArray(response) ? response : response?.content || [];
        this.autoSelectStudioAgent();
      },
      error: error => this.errorMessage = error?.error?.message || 'Impossible de charger la liste des agents.'
    });
  }

  private autoSelectStudioAgent(): void {
    if (!this.agents.length) return;

    // 1. Recherche par slug ou nom Studio
    const studioAgent = this.agents.find(a =>
      a.slug === 'studio-media-creator' ||
      (a.name && a.name.toLowerCase().includes('studio')) ||
      a.type === 'VIDEO_CREATOR' ||
      a.type === 'SOCIAL_CONTENT_CREATOR'
    );

    if (studioAgent) {
      this.agentId = studioAgent.id;
      this.autoAgentName = studioAgent.name || studioAgent.displayName || 'Studio Media Creator';
    } else {
      // Fallback sur le premier agent disponible
      this.agentId = this.agents[0].id;
      this.autoAgentName = this.agents[0].name || this.agents[0].displayName || 'Agent IA Principal';
    }
  }

  // ── Soumission de Génération ───────────────────────────────────────────────

  submit(): void {
    if (!this.prompt.trim() || this.submitting) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.submitting = true;

    // Enrichir le prompt avec les médias de référence si uploadés
    let finalPrompt = this.prompt.trim();
    if (this.uploadedMedia.length > 0) {
      const mediaList = this.uploadedMedia.map(m => m.url).join(', ');
      finalPrompt += ` [Médias de référence rattachés : ${mediaList}]`;
    }

    const body = this.mediaKind === 'VIDEO'
      ? { prompt: finalPrompt, agentId: this.agentId || null, options: this.videoOptions }
      : { prompt: finalPrompt, options: { ...this.imageOptions, model: this.imageOptions.model || null } };

    this.http.post<any>(`/api/generation/${this.mediaKind.toLowerCase()}`, body).subscribe({
      next: job => {
        this.jobs = [job, ...this.jobs.filter(item => item.jobId !== job.jobId)];
        this.prompt = '';
        this.uploadedMedia = [];
        this.successMessage = `Génération lancée avec succès (Job ${job.jobId}). Consultez l'état dans l'onglet Galerie.`;
        this.submitting = false;
        this.loadJobs();
      },
      error: error => {
        this.errorMessage = error?.error?.detail || error?.error?.message || 'Impossible de lancer la génération. Vérifiez la configuration.';
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
    this.publishAgentId = job.agentId || this.agentId || '';
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
        this.errorMessage = error?.error?.detail || error?.error?.message || 'La publication a échoué. Vérifiez le canal et les contraintes.';
        this.publishing = false;
      }
    });
  }

  loadPlatforms(): void {
    this.http.get<any[]>('/api/generation/social/platforms').subscribe({
      next: platforms => this.platforms = platforms || [],
      error: error => {
        this.errorMessage = error?.error?.detail || 'Impossible de charger les plateformes de publication.';
      }
    });
  }

  private replaceJob(updated: any, current: any): void {
    const index = this.jobs.findIndex(job => job.jobId === current.jobId);
    if (index >= 0) this.jobs[index] = { ...updated, refreshing: false, retrying: false };
    else this.jobs.unshift(updated);
  }
}
