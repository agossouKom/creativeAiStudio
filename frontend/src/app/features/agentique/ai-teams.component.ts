import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { DialogService } from '../../shared/ui/dialog.service';
import { AuthService } from '../../services/auth.service';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentCard {
  id: string; name: string; agentType: string; description: string;
  status: string; photoUrl?: string; model?: string;
  competencies: string[]; badgeColor: string; badgeLabel: string;
  teamId?: string; systemPrompt?: string; temperature?: number; maxTokens?: number;
}

interface Team { id: string; name: string; description: string; status: string; teamType: string; }

interface EditForm {
  id: string; name: string; description: string; status: string;
  agentType: string; model: string; temperature: number; maxTokens: number;
  systemPrompt: string; photoUrl: string;
}

interface TaskCard {
  id: string; title: string; description: string; priority: string;
  status: string; type: string; dueDate: string | null; createdAt: string;
  assignedAgentId: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API = '';

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  SCRUM_MASTER:      { label: 'Scrum Manager',    color: '#6366f1' },
  EMAIL_MANAGER:     { label: 'Agent Email',      color: '#10b981' },
  COMMUNITY_MANAGER: { label: 'Community Mgr',   color: '#f59e0b' },
  CUSTOMER_SUPPORT:  { label: 'Support Client',   color: '#0ea5e9' },
  PROSPECTION:       { label: 'Prospection',      color: '#ec4899' },
  MARKETING:         { label: 'Marketing',        color: '#8b5cf6' },
  CREATIVE_LEAD:     { label: 'Créatif Lead',     color: '#f97316' },
  CV_CREATOR:        { label: 'CV Creator',       color: '#14b8a6' },
  CV_EDITOR:         { label: 'CV Editor',        color: '#64748b' },
  IMAGE_CREATOR:     { label: 'Image IA',         color: '#a855f7' },
  VIDEO_CREATOR:     { label: 'Vidéo IA',         color: '#ef4444' },
  RAG_DOCUMENT:      { label: 'Documents RAG',    color: '#0891b2' },
  SECURITY_AUDIT:    { label: 'Sécurité',         color: '#dc2626' },
  ONLY_OFFICE:       { label: 'OnlyOffice',       color: '#2563eb' },
  ANIMATION:         { label: 'Animation',        color: '#d946ef' },
  AD_SPOT:           { label: 'Publicité',        color: '#ea580c' },
};

const TASK_TYPES = [
  { v: 'GENERAL',             l: 'Général',                agentType: null },
  { v: 'EMAIL_RESPONSE',      l: 'Email',                  agentType: 'EMAIL_MANAGER' },
  { v: 'SOCIAL_POST',         l: 'Réseaux sociaux',        agentType: 'COMMUNITY_MANAGER' },
  { v: 'SOCIAL_CONTENT',      l: 'Contenu social media',   agentType: 'SOCIAL_CONTENT_CREATOR' },
  { v: 'PROSPECT_SEARCH',     l: 'Prospection',            agentType: 'PROSPECTION' },
  { v: 'CAMPAIGN_CREATE',     l: 'Campagne marketing',     agentType: 'MARKETING' },
  { v: 'CONTENT_GENERATE',    l: 'Génération contenu',     agentType: 'CREATIVE_LEAD' },
  { v: 'PRESENTATION_CREATE', l: 'Présentation / Slides',  agentType: 'PRESENTATION_CREATOR' },
  { v: 'DOCUMENT_SUMMARIZE',  l: 'Résumé document',        agentType: 'DOCUMENT_SUMMARIZER' },
  { v: 'DOCUMENT_PDF',        l: 'Document / Rapport PDF', agentType: 'DOCUMENT_SUMMARIZER' },
  { v: 'IMAGE_GENERATE',      l: 'Génération image',       agentType: 'IMAGE_CREATOR' },
  { v: 'VIDEO_GENERATE',      l: 'Génération vidéo',       agentType: 'VIDEO_CREATOR' },
  { v: 'CV_CREATE',           l: 'Création CV',            agentType: 'CV_CREATOR' },
  { v: 'REPORT_GENERATE',     l: 'Rapport analytique',     agentType: 'ACCOUNTANT' },
  { v: 'ACCOUNTING_REPORT',   l: 'Rapport comptable',      agentType: 'ACCOUNTANT' },
  { v: 'SECURITY_SCAN',       l: 'Audit sécurité',         agentType: 'SECURITY_AUDIT' },
  { v: 'PRODUCT_PROMOTION',  l: '📦 Promotion produit (réseaux sociaux)', agentType: 'COMMUNITY_MANAGER' },
];

const AGENT_TYPES = [
  { v: 'EMAIL_MANAGER',          l: 'Agent Email' },
  { v: 'COMMUNITY_MANAGER',      l: 'Community Manager' },
  { v: 'CUSTOMER_SUPPORT',       l: 'Support Client' },
  { v: 'PROSPECTION',            l: 'Prospection' },
  { v: 'MARKETING',              l: 'Marketing' },
  { v: 'CREATIVE_LEAD',          l: 'Creative Lead' },
  { v: 'SCRUM_MASTER',           l: 'Scrum Manager' },
  { v: 'CV_CREATOR',             l: 'Créateur CV' },
  { v: 'IMAGE_CREATOR',          l: 'Image IA' },
  { v: 'VIDEO_CREATOR',          l: 'Vidéo IA' },
  { v: 'RAG_DOCUMENT',           l: 'Documents RAG' },
  { v: 'SECURITY_AUDIT',         l: 'Audit Sécurité' },
  { v: 'ONLY_OFFICE',            l: 'OnlyOffice' },
  { v: 'ACCOUNTANT',             l: 'Agent Comptable' },
  { v: 'DOCUMENT_SUMMARIZER',    l: 'Résumeur Documents' },
  { v: 'PRESENTATION_CREATOR',   l: 'Présentations & Slides' },
  { v: 'SOCIAL_CONTENT_CREATOR', l: 'Contenu Réseaux Sociaux' },
];

const PRIORITY_COLOR: Record<string, string> = {
  LOW: '#10b981', MEDIUM: '#0ea5e9', HIGH: '#f59e0b', URGENT: '#f97316', CRITICAL: '#ef4444'
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#94a3b8', IN_PROGRESS: '#6366f1', COMPLETED: '#10b981',
  FAILED: '#ef4444', CANCELLED: '#64748b'
};

const WORKFLOW_STEPS = [
  { n: 1, label: 'DEMANDE',                   desc: 'Le patron envoie sa demande au Scrum Manager' },
  { n: 2, label: 'ANALYSE',                   desc: 'Analyse de la tâche, identification des compétences' },
  { n: 3, label: 'SÉLECTION AGENT',           desc: 'Le Scrum consulte et sélectionne l\'agent compétent' },
  { n: 4, label: 'ASSIGNATION',               desc: 'La tâche est assignée à l\'agent avec toutes les informations' },
  { n: 5, label: 'EXÉCUTION',                 desc: 'L\'agent exécute la tâche selon les instructions' },
  { n: 6, label: 'RÉCUPÉRATION',              desc: 'L\'agent envoie le résultat au Scrum Manager' },
  { n: 7, label: 'LIVRAISON',                 desc: 'Le Scrum dépose le rapport de clôture dans l\'Inbox et ferme la tâche' },
];

const AVATAR_SVG = (initials: string, color: string) => `
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <defs><linearGradient id="g${initials}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color}88"/>
  </linearGradient></defs>
  <circle cx="40" cy="40" r="40" fill="url(#g${initials})"/>
  <text x="40" y="47" text-anchor="middle" font-family="system-ui,sans-serif"
        font-size="22" font-weight="700" fill="white">${initials}</text>
</svg>`;

function svgDataUrl(initials: string, color: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(AVATAR_SVG(initials, color));
}
function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}
function makeCompetencies(type: string, desc: string): string[] {
  const map: Record<string, string[]> = {
    EMAIL_MANAGER:     ['Email', 'Communication', 'Organisation'],
    COMMUNITY_MANAGER: ['Réseaux sociaux', 'Contenu', 'Veille'],
    CUSTOMER_SUPPORT:  ['Support client', 'Résolution', 'Suivi'],
    PROSPECTION:       ['Prospection B2B', 'Rédaction', 'Analyse'],
    MARKETING:         ['Campagnes', 'SEO', 'Publicité'],
    CREATIVE_LEAD:     ['Direction créative', 'Identité visuelle', 'Synthèse'],
    CV_CREATOR:        ['Rédaction CV', 'ATS', 'Lettre motivation'],
    IMAGE_CREATOR:     ['Génération image', 'Prompt IA', 'Design'],
    VIDEO_CREATOR:     ['Script vidéo', 'Production', 'Montage'],
    RAG_DOCUMENT:      ['Analyse docs', 'Extraction info', 'Synthèse'],
    SECURITY_AUDIT:    ['Audit sécurité', 'Conformité', 'Rapport'],
    SCRUM_MASTER:      ['Coordination', 'Planification', 'Livraison'],
  };
  return map[type] || desc.split(/[,\-–]/).slice(0, 3).map(w => w.trim()).filter(w => w.length > 2 && w.length < 30);
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-ai-teams',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
<div class="at-page">
  <div class="at-orb at-orb1"></div>
  <div class="at-orb at-orb2"></div>
  <div class="at-orb at-orb3"></div>

  <!-- ── Teaser (visiteur non connecté) ──────────────────────────────────── -->
  <div *ngIf="!isLoggedIn" class="at-teaser">
    <div class="at-teaser-badge">🤖 Agents IA · Entreprise · Réseaux sociaux</div>
    <h1 class="at-teaser-title">Une équipe d'agents IA<br/>sur mesure pour votre entreprise</h1>
    <p class="at-teaser-sub">
      Capable de vous assister dans la gestion de votre entreprise, vos réseaux sociaux
      et vos événements divers — votre collaborateur intelligent disponible 24&nbsp;/&nbsp;7.
    </p>

    <div class="at-teaser-features">
      <div class="at-teaser-feat"><span class="at-teaser-ico">🧠</span><span>Une équipe d'agents IA sur mesure</span></div>
      <div class="at-teaser-feat"><span class="at-teaser-ico">⚙️</span><span>Agents variés : email, community manager, prospection, marketing, support…</span></div>
      <div class="at-teaser-feat"><span class="at-teaser-ico">📦</span><span>Créer des équipes, des produits et des listes de contacts</span></div>
      <div class="at-teaser-feat"><span class="at-teaser-ico">🔑</span><span>Gérer vos clés API et vos providers LLM</span></div>
      <div class="at-teaser-feat"><span class="at-teaser-ico">📚</span><span>Base de connaissance, chat et bien plus</span></div>
    </div>

    <div class="at-teaser-cta">
      <a routerLink="/auth" [queryParams]="{ mode: 'register' }" class="at-teaser-btn at-teaser-btn--primary">Créer un compte</a>
      <a routerLink="/auth" class="at-teaser-btn at-teaser-btn--ghost">Se connecter</a>
    </div>

    <p class="at-teaser-note">
      Déjà inscrit ? <a routerLink="/auth" class="at-teaser-link">Connectez-vous</a> et découvrez votre espace de travail.
    </p>

    <div class="at-teaser-discover">
      <span class="at-teaser-discover-label">Ou testez librement :</span>
      <a routerLink="/docfusion" class="at-teaser-chip">📄 Fusion de documents</a>
      <a routerLink="/dashboard" class="at-teaser-chip">📊 Tableau de bord</a>
    </div>
  </div>

  <div *ngIf="isLoggedIn" class="at-wrap">

    <!-- ── Header ────────────────────────────────────────────────────────── -->
    <div class="at-header">
      <div class="at-header-top-row">
        <h1 class="at-title">Gestion des agents</h1>
        <a routerLink="/agentique" class="at-back-btn">← Retour</a>
      </div>
    </div>

    <!-- ── Team bar ───────────────────────────────────────────────────────── -->
    <div class="at-team-bar">
      <div class="at-team-select-wrap">
        <label class="at-label">Équipe</label>
        <select class="at-select" [(ngModel)]="selectedTeamId" (ngModelChange)="onTeamChange($event)">
          <option value="">— Toutes les équipes —</option>
          <option *ngFor="let t of teams" [value]="t.id">{{ t.name }}</option>
        </select>
      </div>
      <div class="at-team-bar-actions">
        <a routerLink="/agentique/workspace" class="at-btn-secondary" title="Tableau de bord">⚙ Espace de travail</a>
        <button class="at-btn-secondary" (click)="toggleTasksPanel()">📋 Mes demandes <span *ngIf="myTasks.length" class="at-badge-count">{{ myTasks.length }}</span></button>
        <button class="at-btn-primary" (click)="openCreateTeamModal()">+ Nouvelle équipe</button>
      </div>
    </div>

    <!-- ── Tasks Panel ────────────────────────────────────────────────────── -->
    <div class="at-tasks-panel" *ngIf="showTasksPanel">
      <div class="at-panel-header">
        <span class="at-panel-title">📋 Mes demandes</span>
        <button class="at-panel-close" (click)="showTasksPanel = false">✕</button>
      </div>
      <div class="at-panel-body">
        <div *ngIf="loadingTasks" class="at-panel-loading"><div class="at-spinner"></div></div>
        <div *ngIf="!loadingTasks && myTasks.length === 0" class="at-panel-empty">Aucune demande pour le moment.</div>
        <!-- Filtre statut -->
        <div class="at-task-filter-row">
          <button *ngFor="let f of taskFilters" class="at-filter-chip"
                  [class.at-filter-chip--active]="taskFilterStatus === f.v"
                  (click)="taskFilterStatus = f.v">{{ f.l }}</button>
        </div>
        <div *ngFor="let t of filteredMyTasks" class="at-task-row">
          <div class="at-task-row-left">
            <span class="at-task-status-dot" [style.background]="getStatusColor(t.status)"></span>
            <div>
              <div class="at-task-row-title">{{ t.title }}</div>
              <div class="at-task-row-meta">
                <span class="at-task-chip" [style.background]="getPriorityColor(t.priority) + '22'" [style.color]="getPriorityColor(t.priority)">{{ t.priority }}</span>
                <span class="at-task-chip" [style.background]="getStatusColor(t.status) + '22'" [style.color]="getStatusColor(t.status)">{{ taskStatusLabel(t.status) }}</span>
                <span class="at-task-date" *ngIf="t.dueDate">⏰ {{ formatDate(t.dueDate) }}</span>
              </div>
            </div>
          </div>
          <button class="at-relaunch-btn" (click)="relaunchTask(t)" title="Relancer comme nouvelle demande">↺ Relancer</button>
        </div>
      </div>
    </div>

    <!-- ── Loading ────────────────────────────────────────────────────────── -->
    <div *ngIf="loading" class="at-loading"><div class="at-spinner"></div><span>Chargement…</span></div>

    <!-- ── Main layout ────────────────────────────────────────────────────── -->
    <div *ngIf="!loading" class="at-main-layout"
         [class.at-main-layout--lc]="leftCollapsed"
         [class.at-main-layout--rc]="rightCollapsed">

      <!-- LEFT COLUMN -->
      <div class="at-col at-col-left" [class.at-col--collapsed]="leftCollapsed">
        <div class="at-col-header">
          <span *ngIf="!leftCollapsed">ÉQUIPE D'AGENTS</span>
          <div class="at-col-hdr-btns">
            <button *ngIf="!leftCollapsed" class="at-col-add-btn" (click)="openCreateAgentModal()" title="Ajouter un agent">＋</button>
            <button class="at-sidebar-toggle" (click)="leftCollapsed=!leftCollapsed" [title]="leftCollapsed ? 'Déplier' : 'Replier'">
              {{ leftCollapsed ? '›' : '‹' }}
            </button>
          </div>
        </div>
        <ng-container *ngIf="!leftCollapsed">
          <ng-container *ngFor="let agent of leftAgents">
            <div class="at-agent-card" [class.at-agent-card--active]="agent.status === 'ACTIVE'">
              <img [src]="agent.photoUrl || getAvatarUrl(agent)" [alt]="agent.name" class="at-avatar-sm"/>
              <div class="at-card-body">
                <div class="at-card-name">{{ agent.name }}</div>
                <div class="at-card-badge" [style.background]="agent.badgeColor + '33'" [style.color]="agent.badgeColor">{{ agent.badgeLabel }}</div>
                <div class="at-avail">
                  <span class="at-dot" [class.at-dot--on]="agent.status === 'ACTIVE'"></span>
                  {{ agent.status === 'ACTIVE' ? 'Disponible' : 'Inactif' }}
                </div>
              </div>
              <div class="at-card-btns">
                <button class="at-btn-icon at-btn-info"  (click)="openDetails(agent)"     title="Détails">👁</button>
                <button class="at-btn-icon at-btn-edit"  (click)="openEditModal(agent)"   title="Modifier">✎</button>
                <button class="at-btn-icon at-btn-del"   (click)="deleteAgent(agent, $event)" title="Supprimer" [class.at-busy]="deletingId === agent.id">🗑</button>
              </div>
            </div>
          </ng-container>
          <div *ngIf="leftAgents.length === 0" class="at-col-empty">
            <button class="at-add-empty-btn" (click)="openCreateAgentModal()">＋ Ajouter un agent</button>
          </div>
        </ng-container>
      </div>

      <!-- CENTER COLUMN -->
      <div class="at-col at-col-center">

        <!-- PATRON + SCRUM side by side -->
        <div class="at-top-row">

          <!-- PATRON -->
          <div class="at-top-card at-patron-card">
            <div class="at-top-card-label">PATRON / UTILISATEUR</div>
            <div class="at-top-card-inner">
              <div class="at-avatar-wrap">
                <img [src]="patronAvatarUrl" alt="Patron" class="at-avatar-lg"/>
                <div class="at-dot at-dot--on at-dot--abs"></div>
              </div>
              <div class="at-top-name">{{ patronName }}</div>
              <div class="at-top-role">Commanditaire</div>
              <button class="at-request-btn" (click)="openPatronRequestModal()" [disabled]="!scrumCard">
                📋 Faire une demande
              </button>
              <div *ngIf="!scrumCard" class="at-no-scrum-hint">Ajoutez d'abord un Scrum Manager</div>
            </div>
          </div>

          <!-- SCRUM -->
          <div class="at-top-card at-scrum-card" *ngIf="scrumCard">
            <div class="at-top-card-label">SCRUM / MANAGER</div>
            <div class="at-top-card-inner">
              <div class="at-avatar-wrap">
                <img [src]="scrumCard.photoUrl || getAvatarUrl(scrumCard)" [alt]="scrumCard.name" class="at-avatar-lg"/>
                <div class="at-dot at-dot--on at-dot--abs"></div>
              </div>
              <div class="at-top-name">{{ scrumCard.name }}</div>
              <div class="at-top-role">Chef de Projet Agent</div>
              <div class="at-top-card-btns">
                <button class="at-btn-icon at-btn-info" (click)="openDetails(scrumCard)" title="Détails">👁</button>
                <button class="at-btn-icon at-btn-edit" (click)="openEditModal(scrumCard)" title="Modifier">✎</button>
                <button class="at-btn-icon at-btn-del"  (click)="deleteAgent(scrumCard, $event)" title="Supprimer">🗑</button>
              </div>
            </div>
          </div>

          <!-- SCRUM placeholder -->
          <div class="at-top-card at-scrum-card at-scrum-empty" *ngIf="!scrumCard">
            <div class="at-top-card-label">SCRUM / MANAGER</div>
            <div class="at-top-card-inner">
              <img [src]="scrumAvatarUrl" alt="Scrum" class="at-avatar-lg at-avatar-ghost"/>
              <div class="at-top-name" style="color:rgba(148,163,184,.5)">Aucun Scrum Manager</div>
              <button class="at-add-empty-btn" style="margin-top:.5rem" (click)="openCreateAgentModal()">＋ Ajouter</button>
            </div>
          </div>

        </div><!-- end at-top-row -->


      </div><!-- end center -->

      <!-- RIGHT COLUMN -->
      <div class="at-col at-col-right" [class.at-col--collapsed]="rightCollapsed">
        <div class="at-col-header">
          <div class="at-col-hdr-btns">
            <button class="at-sidebar-toggle" (click)="rightCollapsed=!rightCollapsed" [title]="rightCollapsed ? 'Déplier' : 'Replier'">
              {{ rightCollapsed ? '‹' : '›' }}
            </button>
            <button *ngIf="!rightCollapsed" class="at-col-add-btn" (click)="openCreateAgentModal()" title="Ajouter un agent">＋</button>
          </div>
          <span *ngIf="!rightCollapsed">ÉQUIPE D'AGENTS</span>
        </div>
        <ng-container *ngIf="!rightCollapsed">
          <ng-container *ngFor="let agent of rightAgents">
            <div class="at-agent-card" [class.at-agent-card--active]="agent.status === 'ACTIVE'">
              <img [src]="agent.photoUrl || getAvatarUrl(agent)" [alt]="agent.name" class="at-avatar-sm"/>
              <div class="at-card-body">
                <div class="at-card-name">{{ agent.name }}</div>
                <div class="at-card-badge" [style.background]="agent.badgeColor + '33'" [style.color]="agent.badgeColor">{{ agent.badgeLabel }}</div>
                <div class="at-avail">
                  <span class="at-dot" [class.at-dot--on]="agent.status === 'ACTIVE'"></span>
                  {{ agent.status === 'ACTIVE' ? 'Disponible' : 'Inactif' }}
                </div>
              </div>
              <div class="at-card-btns">
                <button class="at-btn-icon at-btn-info" (click)="openDetails(agent)"        title="Détails">👁</button>
                <button class="at-btn-icon at-btn-edit" (click)="openEditModal(agent)"       title="Modifier">✎</button>
                <button class="at-btn-icon at-btn-del"  (click)="deleteAgent(agent, $event)" title="Supprimer" [class.at-busy]="deletingId === agent.id">🗑</button>
              </div>
            </div>
          </ng-container>
          <div *ngIf="rightAgents.length === 0" class="at-col-empty">
            <button class="at-add-empty-btn" (click)="openCreateAgentModal()">＋ Ajouter un agent</button>
          </div>
        </ng-container>
      </div>

    </div><!-- end at-main-layout -->


    <!-- ── Restore Panel ──────────────────────────────────────────────────── -->
    <div class="at-restore-panel" *ngIf="!loading">
      <button class="at-restore-toggle" (click)="toggleRestorePanel()">
        🗑 Agents supprimés
        <span class="at-chevron" [class.at-chevron--open]="showRestorePanel">▼</span>
      </button>
      <div class="at-restore-list" *ngIf="showRestorePanel">
        <div *ngIf="deletedAgents.length === 0" class="at-restore-empty">Aucun agent supprimé</div>
        <div *ngFor="let a of deletedAgents" class="at-restore-row">
          <img [src]="getAvatarUrl(a)" class="at-restore-avatar"/>
          <div class="at-restore-info">
            <div class="at-restore-name">{{ a.name }}</div>
            <div class="at-restore-type" [style.color]="a.badgeColor">{{ a.badgeLabel }}</div>
          </div>
          <button class="at-restore-btn" (click)="restoreAgent(a)">↩ Restaurer</button>
        </div>
      </div>
    </div>

  </div><!-- end at-wrap -->
</div><!-- end at-page -->

<!-- ═══════════════════════════ MODALS ════════════════════════════════════ -->

<!-- ── Details Modal ─────────────────────────────────────────────────────── -->
<div class="at-overlay" *ngIf="detailsModal.open">
  <div class="at-modal" (click)="$event.stopPropagation()">
    <div class="at-modal-hdr">
      <div class="at-modal-ttl">Détails de l'agent</div>
      <button class="at-modal-x" (click)="detailsModal.open = false">✕</button>
    </div>
    <div class="at-modal-body" *ngIf="detailsModal.agent as a">
      <div class="at-details-hero">
        <img [src]="a.photoUrl || getAvatarUrl(a)" class="at-details-avatar"/>
        <div>
          <div class="at-details-name">{{ a.name }}</div>
          <div class="at-details-badge" [style.background]="a.badgeColor+'33'" [style.color]="a.badgeColor">{{ a.badgeLabel }}</div>
          <div class="at-details-status" [class.at-details-status--on]="a.status === 'ACTIVE'">
            <span class="at-dot" [class.at-dot--on]="a.status === 'ACTIVE'"></span>
            {{ a.status === 'ACTIVE' ? 'Disponible' : 'Inactif' }}
          </div>
        </div>
      </div>
      <div class="at-details-grid">
        <div class="at-details-item"><span class="at-details-k">ID</span><span class="at-details-v at-mono">{{ a.id }}</span></div>
        <div class="at-details-item"><span class="at-details-k">Type</span><span class="at-details-v">{{ a.agentType }}</span></div>
        <div class="at-details-item" *ngIf="a.model"><span class="at-details-k">Modèle LLM</span><span class="at-details-v">{{ a.model }}</span></div>
        <div class="at-details-item" *ngIf="a.teamId"><span class="at-details-k">Équipe</span><span class="at-details-v at-mono">{{ a.teamId }}</span></div>
        <div class="at-details-item at-details-full"><span class="at-details-k">Description</span><span class="at-details-v">{{ a.description || '—' }}</span></div>
        <div class="at-details-item at-details-full" *ngIf="a.competencies.length">
          <span class="at-details-k">Compétences</span>
          <div class="at-comp-chips"><span *ngFor="let c of a.competencies" class="at-comp-chip">{{ c }}</span></div>
        </div>
        <div class="at-details-item at-details-full" *ngIf="a.systemPrompt">
          <span class="at-details-k">Prompt système</span>
          <pre class="at-details-prompt">{{ a.systemPrompt }}</pre>
        </div>
      </div>
    </div>
    <div class="at-modal-ftr">
      <button class="at-btn-primary" (click)="openEditModal(detailsModal.agent!); detailsModal.open = false">✎ Modifier</button>
      <button class="at-btn-cancel" (click)="detailsModal.open = false">Fermer</button>
    </div>
  </div>
</div>

<!-- ── Edit Modal ─────────────────────────────────────────────────────────── -->
<div class="at-overlay" *ngIf="editModal.open">
  <div class="at-modal" (click)="$event.stopPropagation()">
    <div class="at-modal-hdr">
      <div class="at-modal-ttl">Modifier l'agent</div>
      <button class="at-modal-x" (click)="closeEditModal()">✕</button>
    </div>
    <div class="at-modal-body">
      <div class="at-modal-hero">
        <img [src]="editForm.photoUrl || getAvatarUrl(editModal.agent)" class="at-modal-avatar"/>
        <div>
          <div class="at-modal-name">{{ editModal.agent?.name }}</div>
          <div class="at-modal-badge" [style.color]="editModal.agent?.badgeColor">{{ editModal.agent?.badgeLabel }}</div>
        </div>
      </div>
      <div class="at-form-grid">
        <div class="at-field">
          <label class="at-lbl">Nom</label>
          <input class="at-input" [(ngModel)]="editForm.name" placeholder="Nom de l'agent"/>
        </div>
        <div class="at-field">
          <label class="at-lbl">Statut</label>
          <select class="at-input" [(ngModel)]="editForm.status">
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
            <option value="PAUSED">En pause</option>
          </select>
        </div>
        <div class="at-field at-field--full">
          <label class="at-lbl">Description</label>
          <textarea class="at-input at-textarea" [(ngModel)]="editForm.description" rows="2"></textarea>
        </div>
        <div class="at-field">
          <label class="at-lbl">Modèle LLM</label>
          <select class="at-input" [(ngModel)]="editForm.model">
            <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Groq)</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            <option value="claude-opus-4-8">Claude Opus 4</option>
            <option value="mistral-large-latest">Mistral Large</option>
          </select>
        </div>
        <div class="at-field">
          <label class="at-lbl">Température ({{ editForm.temperature }})</label>
          <input class="at-input" type="range" min="0" max="2" step="0.1" [(ngModel)]="editForm.temperature"/>
        </div>
        <!-- Photo upload -->
        <div class="at-field at-field--full">
          <label class="at-lbl">Photo de l'agent</label>
          <div class="at-photo-row">
            <img *ngIf="editForm.photoUrl" [src]="editForm.photoUrl" class="at-photo-preview"/>
            <label class="at-upload-btn">
              📂 Choisir une image
              <input type="file" accept="image/*" class="at-file-hidden" (change)="onEditPhotoChange($event)"/>
            </label>
            <span *ngIf="uploadingPhoto" class="at-upload-status">Upload en cours…</span>
            <span *ngIf="editForm.photoUrl && !uploadingPhoto" class="at-upload-ok">✓ Photo chargée</span>
          </div>
          <input class="at-input" [(ngModel)]="editForm.photoUrl" placeholder="ou coller une URL…" style="margin-top:.4rem"/>
        </div>
        <div class="at-field at-field--full">
          <label class="at-lbl">Prompt système</label>
          <textarea class="at-input at-textarea at-textarea--lg" [(ngModel)]="editForm.systemPrompt" rows="5"></textarea>
        </div>
      </div>
    </div>
    <div *ngIf="editError" class="at-modal-error">{{ editError }}</div>
    <div class="at-modal-ftr">
      <button class="at-btn-cancel" (click)="closeEditModal()">Annuler</button>
      <button class="at-btn-primary" (click)="saveAgent()" [disabled]="saving">
        <span *ngIf="!saving">Enregistrer</span>
        <span *ngIf="saving" class="at-spin"></span>
      </button>
    </div>
  </div>
</div>

<!-- ── Create Agent Modal ─────────────────────────────────────────────────── -->
<div class="at-overlay" *ngIf="createAgentModal.open">
  <div class="at-modal at-modal--sm" (click)="$event.stopPropagation()">
    <div class="at-modal-hdr">
      <div class="at-modal-ttl">Nouvel agent</div>
      <button class="at-modal-x" (click)="closeCreateAgentModal()">✕</button>
    </div>
    <div class="at-modal-body">
      <div class="at-field">
        <label class="at-lbl">Nom *</label>
        <input class="at-input" [(ngModel)]="createAgentForm.name" placeholder="Ex: Agent Email Pro"/>
      </div>
      <div class="at-field" style="margin-top:.75rem">
        <label class="at-lbl">Type *</label>
        <select class="at-input" [(ngModel)]="createAgentForm.type">
          <option *ngFor="let t of agentTypes" [value]="t.v">{{ t.l }}</option>
        </select>
      </div>
      <!-- Équipe d'appartenance — avec filtre + quick add -->
      <div class="at-field" style="margin-top:.75rem">
        <label class="at-lbl">🏢 Équipe d'appartenance</label>
        <div class="at-team-search-wrap">
          <input class="at-input at-team-search-input" [(ngModel)]="agentTeamFilter"
                 placeholder="🔍 Filtrer les équipes…" autocomplete="off"/>
          <select class="at-input" [(ngModel)]="createAgentForm.teamId">
            <option value="">— Aucune équipe —</option>
            <option *ngFor="let t of filteredTeamsForAgent" [value]="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div class="at-team-hint" style="display:flex;align-items:center;gap:.5rem">
          <span *ngIf="createAgentForm.teamId">✓ Agent rattaché à l'équipe sélectionnée</span>
          <span *ngIf="!createAgentForm.teamId">ℹ Sans équipe — global uniquement</span>
          <button class="at-quick-add-link" (click)="quickAddTeamMode = !quickAddTeamMode">
            {{ quickAddTeamMode ? '✕ Annuler' : '＋ Créer une équipe' }}
          </button>
        </div>
        <!-- Quick add team inline -->
        <div *ngIf="quickAddTeamMode" class="at-quick-team-form">
          <input class="at-input" [(ngModel)]="quickTeamName" placeholder="Nom de l'équipe…" (keyup.enter)="quickCreateTeam()"/>
          <button class="at-btn-primary at-btn--xs" (click)="quickCreateTeam()" [disabled]="!quickTeamName.trim() || quickTeamSaving">
            <span *ngIf="!quickTeamSaving">Créer</span>
            <span *ngIf="quickTeamSaving" class="at-spin at-spin--sm"></span>
          </button>
          <span *ngIf="quickTeamError" class="at-error-txt">{{ quickTeamError }}</span>
        </div>
      </div>
      <div class="at-field" style="margin-top:.75rem">
        <label class="at-lbl">Description</label>
        <textarea class="at-input at-textarea" [(ngModel)]="createAgentForm.description" rows="3" placeholder="Rôle de l'agent…"></textarea>
      </div>
      <!-- Photo upload -->
      <div class="at-field" style="margin-top:.75rem">
        <label class="at-lbl">Photo</label>
        <div class="at-photo-row">
          <img *ngIf="createAgentForm.photoUrl" [src]="createAgentForm.photoUrl" class="at-photo-preview"/>
          <label class="at-upload-btn">
            📂 Choisir une image
            <input type="file" accept="image/*" class="at-file-hidden" (change)="onCreatePhotoChange($event)"/>
          </label>
          <span *ngIf="uploadingPhoto" class="at-upload-status">Upload en cours…</span>
        </div>
        <input class="at-input" [(ngModel)]="createAgentForm.photoUrl" placeholder="ou coller une URL…" style="margin-top:.4rem"/>
      </div>
    </div>
    <div *ngIf="createAgentError" class="at-modal-error">{{ createAgentError }}</div>
    <div class="at-modal-ftr">
      <button class="at-btn-cancel" (click)="closeCreateAgentModal()">Annuler</button>
      <button class="at-btn-primary" (click)="createAgent()" [disabled]="saving">
        <span *ngIf="!saving">Créer</span>
        <span *ngIf="saving" class="at-spin"></span>
      </button>
    </div>
  </div>
</div>

<!-- ── Patron Request Modal ───────────────────────────────────────────────── -->
<div class="at-overlay" *ngIf="patronRequestModal.open">
  <div class="at-modal at-modal--xxl" (click)="$event.stopPropagation()">

    <!-- ══ HEADER with step track ══ -->
    <div class="at-req-hdr2">
      <div class="at-req-hdr2-left">
        <div class="at-modal-ttl">📋 Nouvelle demande</div>
        <div class="at-req-sub">Scrum Manager · {{ scrumCard?.name || 'N/A' }}</div>
      </div>
      <ng-container *ngIf="patronRequestModal.step === 'form'">
        <div class="at-step-track">
          <ng-container *ngFor="let n of [1,2,3,4,5]; let last = last">
            <div class="at-step-node"
                 [class.at-step-node--done]="formStep > n"
                 [class.at-step-node--active]="formStep === n"
                 [title]="['Identification','Type & Diffusion','Produits & Contenu','Livrables','Récapitulatif'][n-1]"
                 (click)="formStep > n && goToFormStep(n)">
              <span *ngIf="formStep > n">✓</span>
              <span *ngIf="formStep <= n">{{ n }}</span>
            </div>
            <div *ngIf="!last" class="at-step-sep" [class.at-step-sep--done]="formStep > n"></div>
          </ng-container>
        </div>
      </ng-container>
      <button class="at-modal-x" (click)="closePatronRequestModal()">✕</button>
    </div>

    <!-- ══ FORM STEPS ══ -->
    <ng-container *ngIf="patronRequestModal.step === 'form'">

      <!-- ─── STEP 1 : Identification ─── -->
      <ng-container *ngIf="formStep === 1">
        <div class="at-step-label-bar">
          <span class="at-step-title-chip">01</span>
          <span class="at-step-name">Identification de la tâche</span>
          <span class="at-step-hint">Nommez la tâche, définissez la priorité et l'équipe</span>
        </div>
        <div class="at-step-body">

          <!-- Titre -->
          <div class="at-field">
            <label class="at-lbl">Titre *</label>
            <input class="at-input" [(ngModel)]="patronRequestForm.title" placeholder="Ex: Envoyer un email aux contacts VIP"/>
          </div>

          <!-- Grille 3 colonnes: Priorité, Équipe, Date limite -->
          <div class="at-step-grid3">
            <div class="at-field">
              <label class="at-lbl">⚡ Priorité</label>
              <select class="at-input" [ngModel]="patronRequestForm.priority" (ngModelChange)="onPriorityChange($event)">
                <option value="LOW">🟢 Basse</option>
                <option value="MEDIUM">🔵 Normale</option>
                <option value="HIGH">🟡 Haute</option>
                <option value="URGENT">🟠 Urgente</option>
                <option value="CRITICAL">🔴 Critique</option>
              </select>
            </div>
            <div class="at-field">
              <label class="at-lbl">🏢 Équipe</label>
              <select class="at-input" [(ngModel)]="patronRequestForm.teamId">
                <option value="">— Aucune —</option>
                <option *ngFor="let t of filteredTeamsForPatron" [value]="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div class="at-field">
              <label class="at-lbl">⏰ Date limite</label>
              <input class="at-input" type="datetime-local" [(ngModel)]="patronRequestForm.dueDate"/>
            </div>
          </div>

        </div>
      </ng-container>

      <!-- ─── STEP 2 : Type, Diffusion & Planification ─── -->
      <ng-container *ngIf="formStep === 2">
        <div class="at-step-label-bar">
          <span class="at-step-title-chip">02</span>
          <span class="at-step-name">Type, Diffusion & Planification</span>
          <span class="at-step-hint">Type, canaux, exécution et destinataires</span>
        </div>
        <div class="at-step-body">

          <!-- Type + Confidentialité sur 2 colonnes -->
          <div class="at-step-grid2">
            <div class="at-field">
              <label class="at-lbl">📂 Type de tâche</label>
              <select class="at-input" [ngModel]="patronRequestForm.type" (ngModelChange)="onTaskTypeChange($event)">
                <option *ngFor="let t of availableTaskTypes" [value]="t.v">{{ t.l }}</option>
              </select>
            </div>
            <div class="at-field">
              <label class="at-lbl">🔒 Confidentialité</label>
              <select class="at-input" [(ngModel)]="patronRequestForm.confidentiality">
                <option value="TEAM">🌐 Public équipe</option>
                <option value="MANAGER">🔐 Privé manager</option>
                <option value="SENSITIVE">🔴 Sensible</option>
              </select>
            </div>
          </div>

          <!-- Plateformes + Objectif + Ton (PRODUCT_PROMOTION uniquement) -->
          <ng-container *ngIf="patronRequestForm.type === 'PRODUCT_PROMOTION'">
            <div class="at-field">
              <label class="at-lbl">📱 Plateformes cibles *</label>
              <div class="at-promo-platforms-grid">
                <label *ngFor="let p of socialPlatforms" class="at-promo-platform-check"
                       [class.at-promo-platform-check--active]="patronRequestForm.platforms.includes(p.v)"
                       (click)="togglePromoPlatform(p.v)">{{ p.l }}</label>
              </div>
            </div>
            <div class="at-step-grid2">
              <div class="at-field">
                <label class="at-lbl">🎯 Objectif campagne</label>
                <select class="at-input" [(ngModel)]="patronRequestForm.campaignObjective">
                  <option value="VENTES">💰 Augmenter les ventes</option>
                  <option value="NOTORIETE">📢 Notoriété de marque</option>
                  <option value="ENGAGEMENT">❤️ Engagement</option>
                  <option value="TRAFIC">🔗 Trafic vers site web</option>
                </select>
              </div>
              <div class="at-field">
                <label class="at-lbl">🎨 Ton de la publication</label>
                <select class="at-input" [(ngModel)]="patronRequestForm.tone">
                  <option value="dynamique">Dynamique</option>
                  <option value="professionnel">Professionnel</option>
                  <option value="inspirant">Inspirant</option>
                  <option value="humoristique">Humoristique</option>
                  <option value="informatif">Informatif</option>
                </select>
              </div>
            </div>
          </ng-container>

          <!-- Exécution -->
          <div class="at-field">
            <label class="at-lbl">🗓 Exécution</label>
            <div class="at-scheduling-row">
              <label class="at-radio-opt" [class.at-radio-opt--active]="patronRequestForm.schedulingMode === 'immediate'">
                <input type="radio" [(ngModel)]="patronRequestForm.schedulingMode" value="immediate"/>
                <span class="at-radio-icon">⚡</span> Immédiate
              </label>
              <label class="at-radio-opt" [class.at-radio-opt--active]="patronRequestForm.schedulingMode === 'scheduled'">
                <input type="radio" [(ngModel)]="patronRequestForm.schedulingMode" value="scheduled"/>
                <span class="at-radio-icon">⏰</span> Planifiée
              </label>
            </div>
            <div *ngIf="patronRequestForm.schedulingMode === 'scheduled'" class="at-scheduled-at-wrap">
              <label class="at-lbl" style="margin-top:.4rem">Date &amp; heure d'exécution *</label>
              <input class="at-input" type="datetime-local" [(ngModel)]="patronRequestForm.scheduledAt" [min]="todayIso"/>
              <div class="at-lbl-hint">La tâche sera déclenchée automatiquement à cette date.</div>
            </div>
            <div style="margin-top:.6rem">
              <label class="at-vip-toggle" style="cursor:pointer;gap:.5rem">
                <input type="checkbox" [(ngModel)]="patronRequestForm.semiAutomatic"/>
                <span>
                  <span class="at-lbl" style="margin:0">🤖 Mode semi-automatique</span>
                  <span class="at-lbl-hint" style="display:block">Cocher pour laisser l'agent décider lui-même qui exécute réellement la tâche (sélection + délégation libres). Sans la case, l'agent suit l'exécution prévue par le type sans re-sélectionner l'exécutant.</span>
                </span>
              </label>
            </div>
          </div>

          <!-- Contacts / Destinataires -->
          <div class="at-field">
            <label class="at-lbl">👥 Contacts / Destinataires <span class="at-lbl-hint">(optionnel sauf Email / Prospection)</span></label>
            <div class="at-contact-input-row">
              <input class="at-input at-contact-input" [(ngModel)]="patronRequestForm.contactInput"
                     placeholder="email@exemple.com" (keydown.enter)="addContact(); $event.preventDefault()"/>
              <button class="at-contact-add-btn" (click)="addContact()">＋ Ajouter</button>
              <button class="at-contact-add-btn" style="background:#3b5bdb" (click)="openClientPicker()">📋 Mes clients</button>
              <label class="at-upload-btn at-upload-btn--sm" title="Importer CSV/Excel">
                📎 Importer
                <input type="file" accept=".csv,.txt,.xls,.xlsx,text/csv,text/plain" class="at-file-hidden" (change)="importContactsFile($event)"/>
              </label>
            </div>
            <div *ngIf="selectedClientCodes.length" class="at-contact-list" style="margin-top:.35rem">
              <span *ngFor="let code of selectedClientCodes" class="at-contact-tag" style="background:#1e3a5f">
                👤 {{ getDbClientByCode(code)?.nom }} {{ getDbClientByCode(code)?.prenoms }}
                <span style="opacity:.6;font-size:.7rem"> — {{ getDbClientByCode(code)?.email }}</span>
                <button class="at-tag-remove" (click)="removeClientCode(code)">×</button>
              </span>
            </div>
            <div class="at-contact-list" *ngIf="patronRequestForm.contacts.length">
              <span *ngFor="let c of patronRequestForm.contacts; let i = index" class="at-contact-tag">
                {{ c }}
                <button class="at-tag-remove" (click)="removeContact(i)">×</button>
              </span>
            </div>
            <div class="at-vip-row" *ngIf="patronRequestForm.contacts.length">
              <label class="at-vip-toggle">
                <input type="checkbox" [(ngModel)]="patronRequestForm.markAsVip"/> Marquer comme contacts VIP
              </label>
            </div>
          </div>

        </div>
      </ng-container>

      <!-- ─── STEP 3 : Produits & Contenu ─── -->
      <ng-container *ngIf="formStep === 3">
        <div class="at-step-label-bar">
          <span class="at-step-title-chip">03</span>
          <span class="at-step-name">Produits & Contenu</span>
          <span class="at-step-hint">Associez vos produits puis générez la description</span>
        </div>
        <div class="at-step-body">

          <!-- Produits -->
          <div class="at-field">
            <label class="at-vip-toggle" style="cursor:pointer;gap:.5rem;margin-bottom:.4rem">
              <input type="checkbox" [(ngModel)]="includeProducts" [disabled]="patronRequestForm.type === 'PRODUCT_PROMOTION'" (ngModelChange)="cd.markForCheck()"/>
              <span class="at-lbl" style="margin:0">📦 Associer des produits à cette tâche</span>
            </label>
            <ng-container *ngIf="includeProducts">
              <div class="at-prod-select-row">
                <button class="at-contact-add-btn" style="background:#0d9488" (click)="openProductPicker()">
                  {{ selectedProductCodes.length ? '✏️ Modifier la sélection' : '＋ Sélectionner des produits' }}
                </button>
                <span *ngIf="selectedProductCodes.length" class="at-lbl-hint">{{ selectedProductCodes.length }} produit(s) sélectionné(s)</span>
              </div>
              <div *ngIf="!selectedProductCodes.length" class="at-contact-hint">Aucun produit sélectionné</div>
              <!-- Cartes produits avec miniatures -->
              <div class="at-prod-cards" *ngIf="selectedProductCodes.length">
                <div *ngFor="let code of selectedProductCodes" class="at-prod-card">
                  <!-- Miniature principale (image ou vidéo) -->
                  <div class="at-prod-thumb-wrap">
                    <ng-container *ngIf="getProductMedia(code).length > 0; else noMedia">
                      <img *ngIf="getProductMedia(code)[0].type === 'image'"
                           [src]="getProductMedia(code)[0].url" class="at-prod-thumb" [alt]="getDbProductByCode(code)?.nom"/>
                      <div *ngIf="getProductMedia(code)[0].type === 'video'" class="at-prod-thumb at-prod-thumb--video" style="position:relative;overflow:hidden">
                        <video [src]="getProductMedia(code)[0].url" style="width:100%;height:100%;object-fit:cover" preload="metadata" muted playsinline></video>
                        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;background:rgba(0,0,0,.25)">▶</div>
                      </div>
                    </ng-container>
                    <ng-template #noMedia>
                      <div class="at-prod-thumb at-prod-thumb--empty">📦</div>
                    </ng-template>
                    <div *ngIf="getProductMedia(code).length > 1" class="at-prod-more-badge">+{{ getProductMedia(code).length - 1 }}</div>
                  </div>
                  <!-- Infos produit -->
                  <div class="at-prod-info">
                    <div class="at-prod-name">{{ getDbProductByCode(code)?.nom }}</div>
                    <div class="at-prod-prices" *ngIf="getDbProductByCode(code)?.prix">
                      <span class="at-prod-price">{{ getDbProductByCode(code)?.prix }}€</span>
                      <span *ngIf="getDbProductByCode(code)?.prixPromo" class="at-prod-price-promo">→ {{ getDbProductByCode(code)?.prixPromo }}€</span>
                    </div>
                    <div class="at-prod-desc" *ngIf="getDbProductByCode(code)?.description">{{ getDbProductByCode(code)?.description }}</div>
                  </div>
                  <button class="at-prod-remove" (click)="removeProductCode(code)">×</button>
                </div>
              </div>
            </ng-container>
          </div>

          <!-- Description * (avec IA) — après produits pour que l'IA les prenne en compte -->
          <div class="at-field">
            <div class="at-lbl-row">
              <label class="at-lbl">Description * <span class="at-lbl-hint">(de la tâche)</span></label>
              <div class="at-ai-actions">
                <button class="at-ai-mini" (click)="generateDescription()" [disabled]="!patronRequestForm.title || generatingDesc">
                  <span *ngIf="!generatingDesc">✨ Générer</span>
                  <span *ngIf="generatingDesc" class="at-spin"></span>
                </button>
                <button class="at-ai-mini" (click)="analyzeTask()" [disabled]="!patronRequestForm.title">🔍 Analyser</button>
                <button class="at-ai-mini" (click)="suggestAgent()" [disabled]="!patronRequestForm.type">💡 Agent</button>
              </div>
            </div>
            <textarea class="at-input at-textarea" [(ngModel)]="patronRequestForm.description"
                      (ngModelChange)="descSource = 'none'" rows="4"
                      placeholder="Décrivez précisément la tâche, le contexte et les instructions…"></textarea>
            <div class="at-ai-hint" *ngIf="aiHint"
                 [class.at-ai-hint--template]="descSource === 'template'"
                 [class.at-ai-hint--ai]="descSource === 'ai'">{{ aiHint }}</div>
          </div>

        </div>
      </ng-container>

      <!-- ─── STEP 4 : Livrables ─── -->
      <ng-container *ngIf="formStep === 4">
        <div class="at-step-label-bar">
          <span class="at-step-title-chip">04</span>
          <span class="at-step-name">Livrables</span>
          <span class="at-step-hint">Résultat attendu et pièces jointes</span>
        </div>
        <div class="at-step-body">

          <!-- Résultat attendu -->
          <div class="at-field">
            <label class="at-lbl">🎯 Résultat attendu *</label>
            <textarea class="at-input at-textarea" [(ngModel)]="patronRequestForm.expectedResult" rows="3"
                      placeholder="Ex: Augmenter les ventes, Relancer les clients inactifs depuis 3 mois…"></textarea>
            <div class="at-result-examples">
              <span *ngFor="let e of resultExamples" class="at-result-chip" (click)="patronRequestForm.expectedResult = e">{{ e }}</span>
            </div>
          </div>

          <!-- Pièces jointes -->
          <div class="at-field">
            <label class="at-lbl">📎 Pièces jointes</label>
            <label class="at-dropzone at-dropzone--sm">
              <input type="file" multiple class="at-file-hidden"
                     accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.mp3,.mp4,.png,.jpg,.jpeg,.gif,.ppt,.pptx"
                     (change)="addAttachments($event)"/>
              <div class="at-dz-icon">📁</div>
              <div class="at-dz-text">Glissez ou cliquez pour ajouter</div>
            </label>
            <div class="at-attach-list" *ngIf="patronRequestForm.attachments.length">
              <div *ngFor="let f of patronRequestForm.attachments; let i = index" class="at-attach-row">
                <span class="at-attach-icon">{{ getFileIcon(f.name) }}</span>
                <span class="at-attach-name">{{ f.name }}</span>
                <span class="at-attach-size">{{ formatSize(f.size) }}</span>
                <button class="at-attach-del" (click)="removeAttachment(i)">×</button>
              </div>
            </div>
          </div>

        </div>
      </ng-container>

      <!-- ─── STEP 5 : Récapitulatif ─── -->
      <ng-container *ngIf="formStep === 5">
        <div class="at-step-label-bar">
          <span class="at-step-title-chip">05</span>
          <span class="at-step-name">Récapitulatif</span>
          <span class="at-step-hint">Vérifiez avant d'envoyer au Scrum Manager</span>
        </div>
        <div class="at-step-body">
          <div class="at-recap-grid">

            <div class="at-recap-card at-recap-card--full">
              <div class="at-recap-card-icon">📝</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Titre</div>
                <div class="at-recap-v">{{ patronRequestForm.title || '—' }}</div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(1)">✏️</button>
            </div>

            <div class="at-recap-card">
              <div class="at-recap-card-icon">⚡</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Priorité</div>
                <div class="at-recap-v">{{ getPriorityLabel(patronRequestForm.priority) }}</div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(1)">✏️</button>
            </div>

            <div class="at-recap-card">
              <div class="at-recap-card-icon">📂</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Type de tâche</div>
                <div class="at-recap-v">{{ getTaskTypeLabel(patronRequestForm.type) }}</div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(2)">✏️</button>
            </div>

            <div class="at-recap-card">
              <div class="at-recap-card-icon">🗓</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Exécution</div>
                <div class="at-recap-v">{{ patronRequestForm.schedulingMode === 'immediate' ? '⚡ Immédiate' : '⏰ Planifiée — ' + patronRequestForm.scheduledAt }}</div>
                <div class="at-recap-v" style="font-size:.72rem;margin-top:.2rem;color:#22d3ee">
                  {{ patronRequestForm.semiAutomatic ? '🤖 Semi-automatique : l\'agent décide qui exécute' : '👤 Manuel : exécution prévue selon le type' }}
                </div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(2)">✏️</button>
            </div>

            <div class="at-recap-card">
              <div class="at-recap-card-icon">🔒</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Confidentialité</div>
                <div class="at-recap-v">{{ getConfidentialityLabel(patronRequestForm.confidentiality) }}</div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(2)">✏️</button>
            </div>

            <div class="at-recap-card at-recap-card--full" *ngIf="patronRequestForm.description">
              <div class="at-recap-card-icon">📋</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Description</div>
                <div class="at-recap-v at-recap-v--truncate">{{ patronRequestForm.description }}</div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(3)">✏️</button>
            </div>

            <div class="at-recap-card at-recap-card--full" *ngIf="patronRequestForm.expectedResult">
              <div class="at-recap-card-icon">🎯</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Résultat attendu</div>
                <div class="at-recap-v">{{ patronRequestForm.expectedResult }}</div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(4)">✏️</button>
            </div>

            <div class="at-recap-card" *ngIf="patronRequestForm.platforms?.length">
              <div class="at-recap-card-icon">📱</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Plateformes</div>
                <div class="at-recap-v">{{ patronRequestForm.platforms.join(' · ') }}</div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(2)">✏️</button>
            </div>

            <div class="at-recap-card" *ngIf="selectedProductCodes.length">
              <div class="at-recap-card-icon">📦</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Produits associés</div>
                <div class="at-recap-v">{{ selectedProductCodes.length }} produit(s)</div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(3)">✏️</button>
            </div>

            <div class="at-recap-card" *ngIf="patronRequestForm.contacts.length || selectedClientCodes.length">
              <div class="at-recap-card-icon">👥</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Contacts</div>
                <div class="at-recap-v">{{ patronRequestForm.contacts.length + selectedClientCodes.length }} destinataire(s)</div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(2)">✏️</button>
            </div>

            <div class="at-recap-card" *ngIf="patronRequestForm.attachments.length">
              <div class="at-recap-card-icon">📎</div>
              <div class="at-recap-card-body">
                <div class="at-recap-k">Pièces jointes</div>
                <div class="at-recap-v">{{ patronRequestForm.attachments.length }} fichier(s)</div>
              </div>
              <button class="at-recap-edit" (click)="goToFormStep(4)">✏️</button>
            </div>

          </div>
        </div>
      </ng-container>

      <!-- Footer de navigation -->
      <div *ngIf="patronRequestError" class="at-modal-error">{{ patronRequestError }}</div>
      <div class="at-step-footer">
        <button class="at-btn-cancel" (click)="formStep > 1 ? prevFormStep() : closePatronRequestModal()">
          {{ formStep > 1 ? '← Précédent' : 'Annuler' }}
        </button>
        <div class="at-step-counter">{{ formStep }} / 5</div>
        <button *ngIf="formStep < 5" class="at-btn-primary" (click)="nextFormStep()">
          Suivant →
        </button>
        <button *ngIf="formStep === 5" class="at-btn-primary at-btn-request" (click)="submitPatronRequest()" [disabled]="saving">
          <span *ngIf="!saving">📤 Envoyer au Scrum Manager</span>
          <span *ngIf="saving" class="at-spin"></span>
        </button>
      </div>
    </ng-container>

    <!-- ══ STEP: ANALYSIS ══ -->
    <ng-container *ngIf="patronRequestModal.step === 'analysis'">
      <div class="at-analysis2-body">

        <!-- Banner de statut -->
        <div class="at-a2-banner"
             [class.at-a2-banner--success]="activeTaskStatus === 'DONE' || activeTaskStatus === 'COMPLETED'"
             [class.at-a2-banner--fail]="activeTaskStatus === 'FAILED' || activeTaskStatus === 'CANCELLED'">
          <div class="at-a2-banner-icon">
            {{ (activeTaskStatus === 'DONE' || activeTaskStatus === 'COMPLETED') ? '🎉' : (activeTaskStatus === 'FAILED' ? '❌' : '⚡') }}
          </div>
          <div style="flex:1;min-width:0">
            <div class="at-a2-banner-title">
              {{ (activeTaskStatus === 'DONE' || activeTaskStatus === 'COMPLETED') ? 'Tâche terminée avec succès !' : 'Traitement en cours…' }}
            </div>
            <div class="at-a2-banner-sub">{{ patronAnalysis.taskTitle }}</div>
          </div>
          <div class="at-a2-status-chip" [style.color]="getStatusColor(activeTaskStatus)">
            {{ activeTaskStatusLabel }}
            <span *ngIf="taskPollingActive" class="at-polling-dot"></span>
          </div>
        </div>

        <!-- Pipeline SCRUM en grille 4+3 -->
        <div class="at-scrum-pipeline">
          <ng-container *ngFor="let s of workflowSteps; let i = index">
            <div class="at-sn"
                 [class.at-sn--done]="workflowStep > s.n"
                 [class.at-sn--active]="workflowStep === s.n"
                 [class.at-sn--pending]="workflowStep < s.n"
                 [style.gridColumnStart]="i === 4 ? 2 : null">
              <div class="at-sn-circle">
                <span *ngIf="workflowStep > s.n" class="at-sn-check">✓</span>
                <span *ngIf="workflowStep <= s.n" class="at-sn-icon">{{ scrumStepIcons[s.n] }}</span>
                <div *ngIf="workflowStep === s.n" class="at-sn-ring"></div>
              </div>
              <div class="at-sn-lbl">{{ s.label }}</div>
              <div class="at-sn-num">{{ s.n }}/7</div>
            </div>
          </ng-container>
        </div>

        <!-- Métriques IA en 4 colonnes -->
        <div class="at-a2-metrics">
          <div class="at-a2-metric">
            <div class="at-a2-m-icon">🎯</div>
            <div class="at-a2-m-lbl">Compétence</div>
            <div class="at-a2-m-val">{{ patronAnalysis.skill }}</div>
          </div>
          <div class="at-a2-metric">
            <div class="at-a2-m-icon">🤖</div>
            <div class="at-a2-m-lbl">Agent</div>
            <div class="at-a2-m-val">{{ patronAnalysis.agentName }}</div>
          </div>
          <div class="at-a2-metric">
            <div class="at-a2-m-icon">⏱</div>
            <div class="at-a2-m-lbl">Temps estimé</div>
            <div class="at-a2-m-val">{{ patronAnalysis.time }}</div>
          </div>
          <div class="at-a2-metric">
            <div class="at-a2-m-icon">⚡</div>
            <div class="at-a2-m-lbl">Priorité</div>
            <div class="at-a2-m-val" [style.color]="getPriorityColor(patronAnalysis.priority)">{{ patronAnalysis.priorityLabel }}</div>
          </div>
        </div>

        <!-- Réponse streaming du Scrum -->
        <div class="at-a2-stream">
          <div class="at-a2-stream-hdr">
            💬 Scrum Manager
            <span *ngIf="scrumStreaming" class="at-typing-indicator"><span></span><span></span><span></span></span>
          </div>
          <div class="at-a2-stream-body" #scrumOutput>
            <div *ngIf="!scrumResponseText && scrumStreaming" class="at-scrum-waiting">
              <div class="at-spin"></div> Le Scrum Manager analyse et orchestre…
            </div>
            <div *ngIf="!scrumResponseText && !scrumStreaming" class="at-scrum-waiting at-scrum-waiting--muted">En attente…</div>
            <pre *ngIf="scrumResponseText" class="at-scrum-text">{{ scrumResponseText }}<span *ngIf="scrumStreaming" class="at-cursor">█</span></pre>
          </div>
        </div>

        <!-- Propositions de création d'agent du Scrum -->
        <div class="at-proposals" *ngIf="pendingProposals.length">
          <div class="at-proposals-hdr">🤖 Propositions du Scrum Manager — création d'agents</div>
          <div class="at-proposal" *ngFor="let p of pendingProposals">
            <div class="at-proposal-t">
              🧩 {{ p.name || p.agentType }}
              <span class="at-proposal-type">{{ p.agentType }}</span>
            </div>
            <div class="at-proposal-d" *ngIf="p.description">{{ p.description }}</div>
            <div class="at-proposal-meta" *ngIf="p.teamName">Team : {{ p.teamName }}</div>
            <div class="at-proposal-meta" *ngIf="p.requesterAgentName">Proposé par : {{ p.requesterAgentName }}</div>
            <div class="at-proposal-actions">
              <button class="at-proposal-ok" (click)="approveProposal(p)" [disabled]="proposalBusy">✅ Approuver la création</button>
              <button class="at-proposal-no" (click)="refuseProposal(p)" [disabled]="proposalBusy">✕ Refuser</button>
            </div>
            <div class="at-proposal-hint">L'agent sera créé tout configuré (outils, modèle IA, prompt) et apparaîtra dans la liste des agents existants.</div>
          </div>
          <div class="at-proposal-msg" *ngIf="proposalMsg">{{ proposalMsg }}</div>
        </div>

      </div>
      <div class="at-modal-ftr">
        <button class="at-btn-cancel" (click)="closePatronRequestModal()">Fermer</button>
        <button class="at-btn-primary" (click)="closePatronRequestModal(); showTasksPanel = true">📋 Mes demandes</button>
        <button *ngIf="activeTaskStatus === 'DONE' || activeTaskStatus === 'COMPLETED'"
                class="at-btn-primary at-btn-request" routerLink="/agentique/workspace" (click)="closePatronRequestModal()">
          🚀 Workspace
        </button>
      </div>
    </ng-container>

  </div>
</div>

<!-- ── Client Picker Modal ─────────────────────────────────────────────────── -->
<div class="at-overlay" *ngIf="showClientPicker" (click)="showClientPicker=false;cd.markForCheck()">
  <div class="at-modal at-modal--sm" (click)="$event.stopPropagation()" style="max-width:480px">
    <div class="at-modal-hdr">
      <div class="at-modal-ttl">👥 Sélectionner des contacts</div>
      <button class="at-modal-x" (click)="showClientPicker=false;cd.markForCheck()">✕</button>
    </div>
    <div style="padding:.75rem 1rem">
      <input class="at-input" [(ngModel)]="clientPickerSearch" placeholder="Rechercher par nom, email…" autocomplete="off" style="margin-bottom:.6rem"/>
      <div style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:.3rem">
        <div *ngIf="filteredDbClients.length===0" style="color:#6b7280;font-size:.85rem;padding:.5rem">Aucun client trouvé.</div>
        <label *ngFor="let c of filteredDbClients"
               style="display:flex;align-items:center;gap:.6rem;padding:.5rem .6rem;border-radius:6px;cursor:pointer;background:rgba(255,255,255,.03)"
               [style.background]="clientPickerTemp.includes(c.code)?'rgba(59,91,219,.2)':'rgba(255,255,255,.03)'"
               (click)="toggleClientPick(c.code)">
          <div style="width:16px;height:16px;border:1.5px solid #4b5563;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(59,91,219,.8)"
               *ngIf="clientPickerTemp.includes(c.code)">✓</div>
          <div style="width:16px;height:16px;border:1.5px solid #4b5563;border-radius:4px;flex-shrink:0"
               *ngIf="!clientPickerTemp.includes(c.code)"></div>
          <div>
            <div style="font-size:.85rem;font-weight:500">{{ c.nom }} {{ c.prenoms }}</div>
            <div style="font-size:.75rem;color:#9ca3af">{{ c.email }} <span *ngIf="c.entrepriseName">— {{ c.entrepriseName }}</span></div>
          </div>
        </label>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:.5rem;padding:.75rem 1rem;border-top:1px solid rgba(255,255,255,.06)">
      <button class="at-btn at-btn--ghost" (click)="showClientPicker=false;cd.markForCheck()">Annuler</button>
      <button class="at-btn at-btn--primary" (click)="confirmClientPicker()">Valider ({{ clientPickerTemp.length }})</button>
    </div>
  </div>
</div>

<!-- ── Product Picker Modal ────────────────────────────────────────────────── -->
<div class="at-overlay" *ngIf="showProductPicker" (click)="showProductPicker=false;cd.markForCheck()">
  <div class="at-modal at-modal--sm" (click)="$event.stopPropagation()" style="max-width:480px">
    <div class="at-modal-hdr">
      <div class="at-modal-ttl">📦 Sélectionner des produits</div>
      <button class="at-modal-x" (click)="showProductPicker=false;cd.markForCheck()">✕</button>
    </div>
    <div style="padding:.75rem 1rem">
      <input class="at-input" [(ngModel)]="productPickerSearch" placeholder="Rechercher par nom, code…" autocomplete="off" style="margin-bottom:.6rem"/>
      <div style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:.3rem">
        <div *ngIf="filteredDbProducts.length===0" style="color:#6b7280;font-size:.85rem;padding:.5rem">Aucun produit trouvé.</div>
        <label *ngFor="let p of filteredDbProducts"
               style="display:flex;align-items:center;gap:.6rem;padding:.5rem .6rem;border-radius:6px;cursor:pointer"
               [style.background]="productPickerTemp.includes(p.code)?'rgba(13,148,136,.2)':'rgba(255,255,255,.03)'"
               (click)="toggleProductPick(p.code)">
          <div style="width:16px;height:16px;border:1.5px solid #4b5563;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(13,148,136,.8)"
               *ngIf="productPickerTemp.includes(p.code)">✓</div>
          <div style="width:16px;height:16px;border:1.5px solid #4b5563;border-radius:4px;flex-shrink:0"
               *ngIf="!productPickerTemp.includes(p.code)"></div>
          <div>
            <div style="font-size:.85rem;font-weight:500">{{ p.nom }}</div>
            <div style="font-size:.75rem;color:#9ca3af">{{ p.code }}<span *ngIf="p.prix"> — {{ p.prix }}€</span></div>
          </div>
        </label>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:.5rem;padding:.75rem 1rem;border-top:1px solid rgba(255,255,255,.06)">
      <button class="at-btn at-btn--ghost" (click)="showProductPicker=false;cd.markForCheck()">Annuler</button>
      <button class="at-btn at-btn--primary" (click)="confirmProductPicker()">Valider ({{ productPickerTemp.length }})</button>
    </div>
  </div>
</div>

<!-- ── Create Team Modal ──────────────────────────────────────────────────── -->
<div class="at-overlay" *ngIf="createTeamModal.open">
  <div class="at-modal at-modal--sm" (click)="$event.stopPropagation()">
    <div class="at-modal-hdr">
      <div class="at-modal-ttl">Nouvelle équipe</div>
      <button class="at-modal-x" (click)="closeCreateTeamModal()">✕</button>
    </div>
    <div class="at-modal-body">
      <div class="at-field">
        <label class="at-lbl">Nom *</label>
        <input class="at-input" [(ngModel)]="createTeamForm.name" placeholder="Ex: Équipe Marketing"/>
      </div>
      <div class="at-field" style="margin-top:.75rem">
        <label class="at-lbl">Description</label>
        <textarea class="at-input at-textarea" [(ngModel)]="createTeamForm.description" rows="3"></textarea>
      </div>
      <div class="at-field" style="margin-top:.75rem">
        <label class="at-lbl">Type</label>
        <select class="at-input" [(ngModel)]="createTeamForm.teamType">
          <option value="BUSINESS">Business</option>
          <option value="CREATIVE">Créative</option>
          <option value="HYBRID">Hybride</option>
          <option value="CUSTOM">Personnalisée</option>
        </select>
      </div>
    </div>
    <div *ngIf="createTeamError" class="at-modal-error">{{ createTeamError }}</div>
    <div class="at-modal-ftr">
      <button class="at-btn-cancel" (click)="closeCreateTeamModal()">Annuler</button>
      <button class="at-btn-primary" (click)="createTeam()" [disabled]="saving">
        <span *ngIf="!saving">Créer</span>
        <span *ngIf="saving" class="at-spin"></span>
      </button>
    </div>
  </div>
</div>
`,
  styles: [`
:host { display: block; }

/* ── Page ────────────────────────────────────────────────────────────────── */
.at-page { min-height:100vh; background:#0f1117; color:#e2e8f0; position:relative; overflow:hidden; padding-bottom:4rem; }
.at-orb { position:fixed; border-radius:50%; pointer-events:none; z-index:0; filter:blur(80px); opacity:.1; }
.at-orb1 { width:600px; height:600px; background:#6366f1; top:-200px; left:-200px; }
.at-orb2 { width:500px; height:500px; background:#0ea5e9; bottom:-150px; right:-100px; }
.at-orb3 { width:400px; height:400px; background:#10b981; top:50%; left:40%; }
.at-wrap { position:relative; z-index:1; max-width:1400px; margin:0 auto; padding:1.5rem; }

/* ── Teaser (visiteur non connecté) ──────────────────────────────────────── */
.at-teaser { position:relative; z-index:1; max-width:860px; margin:0 auto; padding:4.5rem 1.5rem 3rem; text-align:center; }
.at-teaser-badge { display:inline-flex; align-items:center; gap:.5rem; padding:.4rem .9rem; border-radius:999px; background:rgba(99,102,241,.12); border:1px solid rgba(99,102,241,.3); color:#a5b4fc; font-size:.78rem; font-weight:700; letter-spacing:.03em; margin-bottom:1.5rem; }
.at-teaser-title { font-size:2.4rem; line-height:1.15; font-weight:800; color:#f1f5f9; margin:0 0 1rem; }
.at-teaser-title br { display:block; }
.at-teaser-sub { font-size:1.05rem; line-height:1.7; color:#94a3b8; max-width:640px; margin:0 auto 2rem; }
.at-teaser-features { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:.75rem; max-width:720px; margin:0 auto 2rem; text-align:left; }
.at-teaser-feat { display:flex; align-items:flex-start; gap:.6rem; padding:.85rem 1rem; background:rgba(255,255,255,.03); border:1px solid rgba(148,163,184,.14); border-radius:12px; color:#cbd5e1; font-size:.86rem; font-weight:600; line-height:1.4; }
.at-teaser-ico { font-size:1.05rem; line-height:1.3; }
.at-teaser-cta { display:flex; justify-content:center; gap:.9rem; flex-wrap:wrap; margin-bottom:1.1rem; }
.at-teaser-btn { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; padding:.85rem 1.9rem; border-radius:12px; font-size:.95rem; font-weight:700; transition:transform .15s, box-shadow .15s, opacity .15s; }
.at-teaser-btn:hover { transform:translateY(-2px); }
.at-teaser-btn--primary { background:linear-gradient(135deg,#6366f1,#0ea5e9); color:#fff; box-shadow:0 8px 24px rgba(99,102,241,.35); }
.at-teaser-btn--primary:hover { box-shadow:0 12px 32px rgba(99,102,241,.5); }
.at-teaser-btn--ghost { background:rgba(148,163,184,.08); border:1px solid rgba(148,163,184,.3); color:#e2e8f0; }
.at-teaser-btn--ghost:hover { background:rgba(148,163,184,.16); }
.at-teaser-note { font-size:.85rem; color:#64748b; margin:0 0 2rem; }
.at-teaser-link { color:#a5b4fc; font-weight:700; text-decoration:none; }
.at-teaser-link:hover { text-decoration:underline; }
.at-teaser-discover { display:flex; align-items:center; justify-content:center; gap:.6rem; flex-wrap:wrap; padding-top:1.5rem; border-top:1px solid rgba(148,163,184,.12); }
.at-teaser-discover-label { font-size:.78rem; color:#64748b; font-weight:600; }
.at-teaser-chip { padding:.4rem .85rem; border-radius:999px; background:rgba(148,163,184,.07); border:1px solid rgba(148,163,184,.18); color:#94a3b8; font-size:.78rem; font-weight:600; text-decoration:none; transition:all .2s; }
.at-teaser-chip:hover { color:#e2e8f0; border-color:rgba(99,102,241,.45); background:rgba(99,102,241,.1); }

/* ── Header ──────────────────────────────────────────────────────────────── */
.at-header { margin-bottom:1rem; padding-top:.75rem; }
.at-header-top-row { display:flex; align-items:center; justify-content:space-between; }
.at-title { font-size:1rem; font-weight:700; color:#c7d2fe; letter-spacing:.03em; margin:0; }

/* ── Team bar ────────────────────────────────────────────────────────────── */
.at-team-bar { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap; }
.at-team-select-wrap { display:flex; align-items:center; gap:.5rem; }
.at-label { font-size:.8rem; color:#94a3b8; font-weight:600; }
.at-select { background:#0f1117 !important; border:1px solid rgba(99,102,241,.3); border-radius:8px; color:#e2e8f0 !important; padding:.4rem .75rem; font-size:.85rem; outline:none; cursor:pointer; }
.at-team-bar-actions { display:flex; gap:.75rem; }
.at-btn-primary { background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border:none; border-radius:8px; padding:.5rem 1.2rem; font-size:.85rem; font-weight:600; cursor:pointer; transition:opacity .2s; }
.at-btn-primary:hover:not([disabled]) { opacity:.85; }
.at-btn-primary[disabled] { opacity:.5; cursor:not-allowed; }
.at-btn-secondary { background:rgba(99,102,241,.1); border:1px solid rgba(99,102,241,.25); color:#a5b4fc; border-radius:8px; padding:.5rem 1.2rem; font-size:.85rem; font-weight:600; cursor:pointer; transition:background .2s; display:flex; align-items:center; gap:.4rem; }
.at-btn-secondary:hover { background:rgba(99,102,241,.2); }
.at-badge-count { background:#6366f1; color:#fff; border-radius:10px; padding:.1rem .45rem; font-size:.7rem; font-weight:700; }

/* ── Tasks Panel ─────────────────────────────────────────────────────────── */
.at-back-btn { color:#94a3b8; font-size:.78rem; text-decoration:none; padding:.25rem .6rem; border:1px solid rgba(148,163,184,.2); border-radius:6px; transition:all .2s; }
.at-back-btn:hover { color:#c7d2fe; border-color:rgba(99,102,241,.4); background:rgba(99,102,241,.08); }
.at-tasks-panel { background:#151c30; border:1px solid rgba(99,102,241,.2); border-radius:14px; margin-bottom:1.5rem; overflow:hidden; }
.at-panel-header { display:flex; align-items:center; justify-content:space-between; padding:.85rem 1.25rem; border-bottom:1px solid rgba(99,102,241,.12); }
.at-panel-title { font-size:.9rem; font-weight:700; color:#c7d2fe; }
.at-panel-close { background:none; border:none; color:#94a3b8; cursor:pointer; font-size:1rem; }
.at-panel-body { padding:.75rem 1.25rem; max-height:340px; overflow-y:auto; }
.at-panel-loading { display:flex; justify-content:center; padding:1rem; }
.at-panel-empty { color:rgba(148,163,184,.5); font-size:.85rem; padding:.5rem; }
.at-task-filter-row { display:flex; gap:.4rem; flex-wrap:wrap; margin-bottom:.65rem; }
.at-filter-chip { background:rgba(99,102,241,.1); border:1px solid rgba(99,102,241,.2); border-radius:20px; color:#94a3b8; font-size:.72rem; cursor:pointer; padding:.2rem .65rem; transition:all .15s; }
.at-filter-chip--active,.at-filter-chip:hover { background:rgba(99,102,241,.3); border-color:#6366f1; color:#c7d2fe; }
.at-task-row { display:flex; align-items:center; gap:.75rem; padding:.6rem 0; border-bottom:1px solid rgba(99,102,241,.08); }
.at-task-row:last-child { border-bottom:none; }
.at-task-row-left { display:flex; align-items:flex-start; gap:.6rem; flex:1; min-width:0; }
.at-task-status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-top:.3rem; }
.at-task-row-title { font-size:.88rem; font-weight:600; color:#e2e8f0; margin-bottom:.3rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:260px; }
.at-task-row-meta { display:flex; gap:.35rem; flex-wrap:wrap; align-items:center; }
.at-task-chip { font-size:.7rem; font-weight:600; border-radius:4px; padding:.15rem .45rem; }
.at-task-date { font-size:.72rem; color:#94a3b8; }
.at-relaunch-btn { flex-shrink:0; background:rgba(99,102,241,.12); border:1px solid rgba(99,102,241,.3); border-radius:6px; color:#a5b4fc; font-size:.73rem; padding:.25rem .6rem; cursor:pointer; transition:all .15s; white-space:nowrap; }
.at-relaunch-btn:hover { background:rgba(99,102,241,.25); color:#c7d2fe; }
.at-team-search-wrap { display:flex; flex-direction:column; gap:.35rem; }
.at-team-search-input { font-size:.8rem !important; padding:.35rem .6rem !important; }
.at-quick-add-link { background:none; border:none; color:#6366f1; font-size:.75rem; cursor:pointer; padding:0; text-decoration:underline; margin-left:auto; }
.at-quick-add-link:hover { color:#a5b4fc; }
.at-quick-team-form { display:flex; gap:.5rem; align-items:center; margin-top:.5rem; }
.at-btn--xs { padding:.25rem .65rem !important; font-size:.78rem !important; }
.at-error-txt { color:#f87171; font-size:.75rem; }

/* ── Loading ─────────────────────────────────────────────────────────────── */
.at-loading { display:flex; align-items:center; justify-content:center; gap:1rem; padding:3rem; color:#94a3b8; }
.at-spinner { width:32px; height:32px; border-radius:50%; border:3px solid rgba(99,102,241,.2); border-top-color:#6366f1; animation:spin .8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* ── Main layout ─────────────────────────────────────────────────────────── */
.at-main-layout { display:grid; grid-template-columns:260px 1fr 260px; gap:1.5rem; align-items:start; margin-bottom:2rem; transition:grid-template-columns .25s ease; }
.at-main-layout--lc { grid-template-columns:36px 1fr 260px; }
.at-main-layout--rc { grid-template-columns:260px 1fr 36px; }
.at-main-layout--lc.at-main-layout--rc { grid-template-columns:36px 1fr 36px; }

/* ── Columns ─────────────────────────────────────────────────────────────── */
.at-col { display:flex; flex-direction:column; gap:.75rem; }
.at-col--collapsed { gap:0; }
.at-col-header { font-size:.7rem; font-weight:700; letter-spacing:.1em; color:#94a3b8; margin-bottom:.25rem; text-transform:uppercase; display:flex; align-items:center; justify-content:space-between; }
.at-col--collapsed .at-col-header { justify-content:center; margin-bottom:0; }
.at-col-hdr-btns { display:flex; align-items:center; gap:.3rem; }
.at-col-add-btn { width:22px; height:22px; border-radius:50%; border:1px solid rgba(99,102,241,.5); background:rgba(99,102,241,.15); color:#a5b4fc; font-size:.95rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .2s; line-height:1; }
.at-col-add-btn:hover { background:rgba(99,102,241,.35); }
.at-sidebar-toggle { width:26px; height:26px; border-radius:6px; border:1px solid rgba(99,102,241,.3); background:rgba(99,102,241,.08); color:#818cf8; font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background .2s,color .2s; line-height:1; flex-shrink:0; }
.at-sidebar-toggle:hover { background:rgba(99,102,241,.2); color:#c7d2fe; }
.at-col-empty { text-align:center; padding:1.5rem 0; }
.at-add-empty-btn { background:none; border:1px dashed rgba(99,102,241,.35); color:#818cf8; border-radius:8px; padding:.5rem 1rem; font-size:.82rem; cursor:pointer; width:100%; transition:border-color .2s,color .2s; }
.at-add-empty-btn:hover { border-color:rgba(99,102,241,.7); color:#a5b4fc; }

/* ── Agent Card ──────────────────────────────────────────────────────────── */
.at-agent-card { background:rgba(21,28,48,.8); border:1px solid rgba(99,102,241,.15); border-radius:12px; padding:.75rem; display:flex; align-items:center; gap:.6rem; transition:border-color .2s,box-shadow .2s; }
.at-agent-card:hover { border-color:rgba(99,102,241,.4); box-shadow:0 4px 16px rgba(0,0,0,.3); }
.at-agent-card--active { border-color:rgba(16,185,129,.2); }
.at-avatar-sm { width:42px; height:42px; border-radius:50%; flex-shrink:0; object-fit:cover; border:2px solid rgba(99,102,241,.25); }
.at-card-body { flex:1; min-width:0; }
.at-card-name { font-size:.88rem; font-weight:700; color:#f1f5f9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:.25rem; }
.at-card-badge { display:inline-block; font-size:.68rem; font-weight:700; border-radius:4px; padding:.15rem .45rem; margin-bottom:.3rem; }
.at-avail { display:flex; align-items:center; gap:.35rem; font-size:.72rem; color:#94a3b8; }
.at-dot { width:7px; height:7px; border-radius:50%; background:#475569; flex-shrink:0; }
.at-dot--on { background:#22c55e; box-shadow:0 0 5px #22c55e; }
.at-dot--abs { position:absolute; bottom:2px; right:2px; border:2px solid #0f1117; }

/* Card buttons */
.at-card-btns { display:flex; flex-direction:column; gap:.3rem; flex-shrink:0; }
.at-btn-icon { width:28px; height:28px; border-radius:6px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:.85rem; transition:background .15s,transform .1s; }
.at-btn-icon:hover { transform:scale(1.1); }
.at-btn-icon:active { transform:scale(.95); }
.at-btn-info { background:rgba(14,165,233,.2); color:#38bdf8; }
.at-btn-info:hover { background:rgba(14,165,233,.4); }
.at-btn-edit { background:rgba(99,102,241,.2); color:#a5b4fc; }
.at-btn-edit:hover { background:rgba(99,102,241,.4); }
.at-btn-del { background:rgba(239,68,68,.15); color:#fca5a5; }
.at-btn-del:hover { background:rgba(239,68,68,.3); }
.at-busy { opacity:.5; cursor:wait; }

/* ── Center column ───────────────────────────────────────────────────────── */
.at-col-center { display:flex; flex-direction:column; align-items:center; gap:1.25rem; }

/* ── Top row: Patron + Scrum ──────────────────────────────────────────────── */
.at-top-row { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; width:100%; }
.at-top-card { background:rgba(21,28,48,.8); border:1px solid rgba(99,102,241,.15); border-radius:14px; overflow:hidden; }
.at-patron-card { border-color:rgba(99,102,241,.25); }
.at-scrum-card { border-color:rgba(14,165,233,.25); }
.at-scrum-empty { border-color:rgba(99,102,241,.1); border-style:dashed; }
.at-top-card-label { font-size:.65rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:#94a3b8; padding:.5rem .75rem .25rem; border-bottom:1px solid rgba(99,102,241,.08); }
.at-top-card-inner { display:flex; flex-direction:column; align-items:center; padding:.75rem .75rem 1rem; gap:.4rem; text-align:center; }
.at-avatar-wrap { position:relative; }
.at-avatar-lg { width:64px; height:64px; border-radius:50%; object-fit:cover; border:2px solid rgba(99,102,241,.3); }
.at-avatar-ghost { opacity:.35; filter:grayscale(1); }
.at-top-name { font-size:.92rem; font-weight:700; color:#f1f5f9; }
.at-top-role { font-size:.75rem; color:#94a3b8; }
.at-top-card-btns { display:flex; gap:.35rem; margin-top:.25rem; }
.at-request-btn { margin-top:.5rem; background:linear-gradient(135deg,#6366f1,#0ea5e9); color:#fff; border:none; border-radius:8px; padding:.5rem .9rem; font-size:.8rem; font-weight:600; cursor:pointer; transition:opacity .2s; }
.at-request-btn:hover:not([disabled]) { opacity:.85; }
.at-request-btn[disabled] { opacity:.4; cursor:not-allowed; }
.at-no-scrum-hint { font-size:.7rem; color:rgba(148,163,184,.5); margin-top:.15rem; }


/* ── Restore panel ───────────────────────────────────────────────────────── */
.at-restore-panel { margin-bottom:1.5rem; }
.at-restore-toggle { background:none; border:1px solid rgba(99,102,241,.2); color:#94a3b8; border-radius:8px; padding:.4rem 1rem; font-size:.82rem; cursor:pointer; display:flex; align-items:center; gap:.5rem; transition:border-color .2s; }
.at-restore-toggle:hover { border-color:rgba(99,102,241,.5); color:#c7d2fe; }
.at-chevron { font-size:.7rem; transition:transform .2s; }
.at-chevron--open { transform:rotate(180deg); }
.at-restore-list { margin-top:.6rem; border:1px solid rgba(99,102,241,.12); border-radius:10px; overflow:hidden; }
.at-restore-empty { padding:.85rem 1.2rem; color:rgba(148,163,184,.5); font-size:.85rem; }
.at-restore-row { display:flex; align-items:center; gap:.6rem; padding:.6rem 1.2rem; border-bottom:1px solid rgba(99,102,241,.07); background:rgba(15,17,23,.5); }
.at-restore-row:last-child { border-bottom:none; }
.at-restore-avatar { width:30px; height:30px; border-radius:50%; }
.at-restore-info { flex:1; }
.at-restore-name { font-size:.85rem; font-weight:600; color:#e2e8f0; }
.at-restore-type { font-size:.72rem; }
.at-restore-btn { background:rgba(99,102,241,.15); border:1px solid rgba(99,102,241,.3); color:#a5b4fc; border-radius:6px; padding:.3rem .75rem; font-size:.78rem; cursor:pointer; transition:background .2s; }
.at-restore-btn:hover { background:rgba(99,102,241,.3); }

/* ── Overlay / Modal ─────────────────────────────────────────────────────── */
.at-overlay { position:fixed; inset:0; background:rgba(0,0,0,.75); display:flex; align-items:center; justify-content:center; z-index:1000; padding:1rem; animation:fade-in .15s ease; }
@keyframes fade-in { from { opacity:0; } to { opacity:1; } }
.at-modal { background:#111827; border:1px solid rgba(99,102,241,.25); border-radius:18px; width:100%; max-width:580px; max-height:90vh; overflow-y:auto; animation:slide-up .2s ease; box-shadow:0 24px 64px rgba(0,0,0,.6); }
.at-modal--sm { max-width:440px; }
@keyframes slide-up { from { transform:translateY(20px); opacity:0; } to { transform:none; opacity:1; } }
.at-modal-hdr { display:flex; align-items:center; justify-content:space-between; padding:1.1rem 1.4rem; border-bottom:1px solid rgba(99,102,241,.12); }
.at-modal-ttl { font-size:1rem; font-weight:700; color:#c7d2fe; }
.at-modal-x { background:none; border:none; color:#94a3b8; font-size:1rem; cursor:pointer; padding:.2rem; }
.at-modal-x:hover { color:#fff; }
.at-modal-body { padding:1.1rem 1.4rem; }
.at-modal-ftr { display:flex; align-items:center; justify-content:flex-end; gap:.6rem; padding:.9rem 1.4rem; border-top:1px solid rgba(99,102,241,.1); }
.at-modal-error { margin:0 1.4rem .6rem; background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); color:#fca5a5; border-radius:8px; padding:.55rem .85rem; font-size:.82rem; }
.at-modal-hero { display:flex; align-items:center; gap:.9rem; margin-bottom:1rem; padding-bottom:.9rem; border-bottom:1px solid rgba(99,102,241,.1); }
.at-modal-avatar { width:56px; height:56px; border-radius:50%; border:2px solid rgba(99,102,241,.3); object-fit:cover; }
.at-modal-name { font-size:.95rem; font-weight:700; color:#f1f5f9; }
.at-modal-badge { font-size:.75rem; color:#94a3b8; margin-top:.15rem; }

/* ── Form fields ─────────────────────────────────────────────────────────── */
.at-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:.7rem; }
.at-field { display:flex; flex-direction:column; gap:.3rem; }
.at-field--full { grid-column:1/-1; }
.at-lbl { font-size:.78rem; color:#94a3b8; font-weight:600; letter-spacing:.01em; }
.at-input { background:#0d111c !important; border:1px solid rgba(99,102,241,.3); border-radius:8px; color:#f1f5f9 !important; padding:.5rem .75rem; font-size:.87rem; outline:none; width:100%; box-sizing:border-box; font-family:inherit; transition:border-color .2s; }
.at-input::placeholder { color:rgba(148,163,184,.4) !important; }
.at-input:focus { border-color:rgba(99,102,241,.6); box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.at-input option { background:#1a2035 !important; color:#f1f5f9 !important; }
select.at-input { cursor:pointer; }
.at-textarea { resize:vertical; }
.at-textarea--lg { min-height:110px; }
input[type="range"].at-input { padding:.3rem 0; cursor:pointer; -webkit-appearance:auto; appearance:auto; background:none !important; border:none !important; box-shadow:none !important; }

/* Photo upload */
.at-photo-row { display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
.at-photo-preview { width:44px; height:44px; border-radius:50%; object-fit:cover; border:2px solid rgba(99,102,241,.3); }
.at-upload-btn { display:inline-flex; align-items:center; gap:.35rem; background:rgba(99,102,241,.15); border:1px solid rgba(99,102,241,.3); color:#a5b4fc; border-radius:7px; padding:.4rem .8rem; font-size:.8rem; cursor:pointer; transition:background .2s; }
.at-upload-btn:hover { background:rgba(99,102,241,.3); }
.at-file-hidden { display:none; }
.at-upload-status { font-size:.78rem; color:#f59e0b; }
.at-upload-ok { font-size:.78rem; color:#22c55e; }

/* Buttons */
.at-btn-cancel { background:none; border:1px solid rgba(148,163,184,.2); color:#94a3b8; border-radius:8px; padding:.5rem 1.1rem; font-size:.85rem; cursor:pointer; transition:border-color .2s; }
.at-btn-cancel:hover { border-color:rgba(148,163,184,.5); color:#e2e8f0; }
.at-btn-request { background:linear-gradient(135deg,#6366f1,#0ea5e9) !important; }
.at-spin { display:inline-block; width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,.2); border-top-color:#fff; animation:spin .7s linear infinite; vertical-align:middle; }

/* ── Details modal ───────────────────────────────────────────────────────── */
.at-details-hero { display:flex; align-items:center; gap:1rem; margin-bottom:1rem; padding-bottom:1rem; border-bottom:1px solid rgba(99,102,241,.1); }
.at-details-avatar { width:64px; height:64px; border-radius:50%; object-fit:cover; border:2px solid rgba(99,102,241,.3); }
.at-details-name { font-size:1rem; font-weight:700; color:#f1f5f9; }
.at-details-badge { display:inline-block; font-size:.75rem; font-weight:700; border-radius:5px; padding:.2rem .55rem; margin:.3rem 0; }
.at-details-status { display:flex; align-items:center; gap:.35rem; font-size:.78rem; color:#94a3b8; }
.at-details-status--on { color:#22c55e; }
.at-details-grid { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; }
.at-details-item { display:flex; flex-direction:column; gap:.2rem; }
.at-details-full { grid-column:1/-1; }
.at-details-k { font-size:.72rem; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
.at-details-v { font-size:.85rem; color:#e2e8f0; }
.at-mono { font-family:monospace; font-size:.75rem; word-break:break-all; color:#94a3b8; }
.at-comp-chips { display:flex; gap:.35rem; flex-wrap:wrap; margin-top:.2rem; }
.at-comp-chip { background:rgba(99,102,241,.15); color:#a5b4fc; border-radius:4px; padding:.2rem .5rem; font-size:.72rem; font-weight:600; }
.at-details-prompt { background:#0d111c; border:1px solid rgba(99,102,241,.15); border-radius:7px; padding:.6rem; font-size:.75rem; color:#94a3b8; white-space:pre-wrap; word-break:break-word; max-height:120px; overflow-y:auto; margin:0; }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media(max-width:1024px) { .at-main-layout { grid-template-columns:1fr 1fr; } .at-col-left,.at-col-right { display:none; } }
@media(max-width:768px) { .at-main-layout { grid-template-columns:1fr; } .at-top-row { grid-template-columns:1fr; } .at-bottom-row { grid-template-columns:1fr; } .at-form-grid { grid-template-columns:1fr; } }

/* ── Modal XL / XXL ──────────────────────────────────────────────────────── */
.at-modal--xl  { max-width:720px; }
.at-modal--xxl { max-width:820px; }

/* ── Multi-step header ───────────────────────────────────────────────────── */
.at-req-hdr2 { display:flex; align-items:center; gap:.8rem; padding:.85rem 1.4rem; border-bottom:1px solid rgba(99,102,241,.1); }
.at-req-hdr2-left { flex:1; }
.at-req-sub { font-size:.72rem; color:#64748b; margin-top:.1rem; }
.at-step-track { display:flex; align-items:center; gap:0; flex-shrink:0; }
.at-step-node { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:.72rem; font-weight:700; background:rgba(15,23,42,.6); border:1.5px solid rgba(148,163,184,.2); color:#64748b; transition:all .2s; }
.at-step-node--done { background:rgba(16,185,129,.15); border-color:#10b981; color:#10b981; cursor:pointer; }
.at-step-node--active { background:linear-gradient(135deg,#6366f1,#0ea5e9); border-color:transparent; color:#fff; box-shadow:0 0 10px rgba(99,102,241,.35); }
.at-step-sep { width:22px; height:2px; background:rgba(148,163,184,.12); flex-shrink:0; transition:background .3s; }
.at-step-sep--done { background:rgba(16,185,129,.35); }

/* ── Step label bar ──────────────────────────────────────────────────────── */
.at-step-label-bar { display:flex; align-items:center; gap:.65rem; padding:.45rem 1.4rem; background:rgba(99,102,241,.03); border-bottom:1px solid rgba(99,102,241,.07); }
.at-step-title-chip { display:flex; align-items:center; justify-content:center; width:26px; height:26px; background:linear-gradient(135deg,#6366f1,#0ea5e9); border-radius:7px; font-size:.75rem; font-weight:800; color:#fff; flex-shrink:0; }
.at-step-name { font-size:.88rem; font-weight:700; color:#c7d2fe; }
.at-step-hint { font-size:.73rem; color:#475569; margin-left:.1rem; }

/* ── Step body ───────────────────────────────────────────────────────────── */
.at-step-body { padding:.65rem 1.4rem; display:flex; flex-direction:column; gap:.5rem; }
.at-step-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; }
.at-step-grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:.65rem; }
@media(max-width:640px) { .at-step-grid2,.at-step-grid3 { grid-template-columns:1fr; } }

/* ── Step footer ─────────────────────────────────────────────────────────── */
.at-step-footer { display:flex; align-items:center; justify-content:space-between; padding:.75rem 1.4rem; border-top:1px solid rgba(99,102,241,.1); gap:.6rem; }
.at-step-counter { font-size:.75rem; color:#475569; font-weight:600; }

/* ── Title suggestion ────────────────────────────────────────────────────── */
.at-title-suggest { display:flex; align-items:center; gap:.45rem; background:rgba(139,92,246,.07); border:1px solid rgba(139,92,246,.2); border-radius:8px; padding:.4rem .65rem; flex-wrap:wrap; margin-top:.3rem; }
.at-title-suggest-lbl { font-size:.72rem; color:#a78bfa; font-weight:700; flex-shrink:0; }
.at-title-suggest-val { flex:1; font-size:.82rem; color:#c4b5fd; min-width:100px; font-style:italic; }

/* ── Recap cards ─────────────────────────────────────────────────────────── */
.at-recap-grid { display:grid; grid-template-columns:1fr 1fr; gap:.5rem; }
.at-recap-card { display:flex; align-items:flex-start; gap:.55rem; background:rgba(99,102,241,.05); border:1px solid rgba(99,102,241,.11); border-radius:10px; padding:.6rem .8rem; }
.at-recap-card--full { grid-column:1/-1; }
.at-recap-card-icon { font-size:1rem; flex-shrink:0; margin-top:.05rem; }
.at-recap-card-body { flex:1; min-width:0; }
.at-recap-k { font-size:.65rem; color:#64748b; text-transform:uppercase; letter-spacing:.04em; font-weight:600; margin-bottom:.15rem; }
.at-recap-v { font-size:.82rem; color:#e2e8f0; font-weight:500; }
.at-recap-v--truncate { overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.at-recap-edit { background:none; border:none; color:#475569; cursor:pointer; font-size:.85rem; flex-shrink:0; padding:.1rem; transition:color .15s; line-height:1; }
.at-recap-edit:hover { color:#a5b4fc; }

/* ── Compact dropzone ────────────────────────────────────────────────────── */
.at-dropzone--sm { padding:.65rem .85rem; flex-direction:row; gap:.5rem; }
.at-dropzone--sm .at-dz-icon { font-size:1rem; margin-bottom:0; }
.at-dropzone--sm .at-dz-text { font-size:.8rem; }

/* ── Promotion platforms ─────────────────────────────────────────────────── */
.at-promo-platforms-grid { display:flex; flex-wrap:wrap; gap:.5rem; margin-top:.35rem; }
.at-promo-platform-check { display:inline-flex; align-items:center; gap:.35rem; padding:.4rem .85rem; border-radius:20px; font-size:.8rem; font-weight:600; cursor:pointer; border:1.5px solid rgba(99,102,241,.25); color:#94a3b8; background:rgba(255,255,255,.04); transition:all .15s; user-select:none; }
.at-promo-platform-check:hover { border-color:rgba(99,102,241,.5); color:#c7d2fe; }
.at-promo-platform-check--active { border-color:#6366f1; background:rgba(99,102,241,.18); color:#c7d2fe; }

/* AI helpers */
.at-input-action-row { display:flex; gap:.5rem; }
.at-input-action-row .at-input { flex:1; }
.at-ai-btn { background:linear-gradient(135deg,rgba(139,92,246,.3),rgba(99,102,241,.3)); border:1px solid rgba(139,92,246,.4); color:#c4b5fd; border-radius:8px; padding:.5rem .9rem; font-size:.8rem; font-weight:600; cursor:pointer; white-space:nowrap; transition:background .2s; }
.at-ai-btn:hover:not([disabled]) { background:linear-gradient(135deg,rgba(139,92,246,.5),rgba(99,102,241,.5)); }
.at-ai-btn[disabled] { opacity:.45; cursor:not-allowed; }
.at-lbl-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:.3rem; flex-wrap:wrap; gap:.3rem; }
.at-ai-actions { display:flex; gap:.3rem; flex-wrap:wrap; }
.at-ai-mini { background:rgba(139,92,246,.12); border:1px solid rgba(139,92,246,.25); color:#c4b5fd; border-radius:6px; padding:.25rem .6rem; font-size:.72rem; cursor:pointer; transition:background .2s; }
.at-ai-mini:hover:not([disabled]) { background:rgba(139,92,246,.3); }
.at-ai-mini[disabled] { opacity:.4; cursor:not-allowed; }
.at-ai-hint { font-size:.76rem; color:#a78bfa; margin-top:.35rem; background:rgba(139,92,246,.08); border-radius:6px; padding:.3rem .6rem; border-left:2px solid #8b5cf6; }
.at-ai-hint--ai { color:#22c55e; background:rgba(34,197,94,.07); border-left-color:#22c55e; }
.at-ai-hint--template { color:#f59e0b; background:rgba(245,158,11,.07); border-left-color:#f59e0b; }
.at-team-hint { font-size:.73rem; color:#64748b; margin-top:.3rem; padding-left:.2rem; }
.at-textarea--xl { min-height:100px; }

/* Result examples */
.at-result-examples { display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.5rem; }
.at-result-chip { background:rgba(14,165,233,.08); border:1px solid rgba(14,165,233,.2); color:#38bdf8; border-radius:20px; padding:.2rem .65rem; font-size:.72rem; cursor:pointer; transition:background .2s; }
.at-result-chip:hover { background:rgba(14,165,233,.2); }

/* Contacts */
.at-contact-input-row { display:flex; gap:.4rem; align-items:center; flex-wrap:wrap; }
.at-contact-input { flex:1; min-width:180px; }
.at-contact-add-btn { background:rgba(99,102,241,.2); border:1px solid rgba(99,102,241,.35); color:#a5b4fc; border-radius:7px; padding:.45rem .8rem; font-size:.8rem; cursor:pointer; white-space:nowrap; transition:background .2s; }
.at-contact-add-btn:hover { background:rgba(99,102,241,.4); }
.at-upload-btn--sm { padding:.3rem .65rem !important; font-size:.75rem !important; }
.at-contact-list { display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.55rem; }
.at-contact-tag { display:inline-flex; align-items:center; gap:.3rem; background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.25); color:#6ee7b7; border-radius:20px; padding:.2rem .55rem; font-size:.75rem; }
.at-tag-remove { background:none; border:none; color:#6ee7b7; cursor:pointer; font-size:.9rem; line-height:1; padding:0 0 0 .1rem; opacity:.7; }
.at-tag-remove:hover { opacity:1; }
.at-lbl-hint { font-size:.72rem; color:rgba(148,163,184,.5); font-weight:400; margin-left:.3rem; }
.at-contact-hint { font-size:.75rem; color:rgba(148,163,184,.4); margin-top:.4rem; }
.at-vip-row { margin-top:.5rem; }
.at-vip-toggle { display:flex; align-items:center; gap:.4rem; font-size:.78rem; color:#f59e0b; cursor:pointer; }
.at-vip-toggle input { cursor:pointer; }

/* Dropzone */
.at-dropzone { display:flex; flex-direction:column; align-items:center; justify-content:center; border:2px dashed rgba(99,102,241,.25); border-radius:10px; padding:1.25rem; cursor:pointer; transition:border-color .2s,background .2s; text-align:center; }
.at-dropzone:hover { border-color:rgba(99,102,241,.5); background:rgba(99,102,241,.04); }
.at-dz-icon { font-size:1.5rem; margin-bottom:.3rem; }
.at-dz-text { font-size:.85rem; color:#c7d2fe; font-weight:600; }
.at-dz-hint { font-size:.72rem; color:#64748b; margin-top:.2rem; }
.at-attach-list { margin-top:.6rem; display:flex; flex-direction:column; gap:.35rem; }
.at-attach-row { display:flex; align-items:center; gap:.5rem; background:rgba(99,102,241,.06); border-radius:7px; padding:.4rem .65rem; }
.at-attach-icon { font-size:.95rem; flex-shrink:0; }
.at-attach-name { flex:1; font-size:.8rem; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.at-attach-size { font-size:.72rem; color:#64748b; white-space:nowrap; }
.at-attach-del { background:none; border:none; color:#94a3b8; cursor:pointer; font-size:1rem; }
.at-attach-del:hover { color:#ef4444; }

/* ── Product cards (Step 3) ─────────────────────────────────────────────── */
.at-prod-select-row { display:flex; align-items:center; gap:.75rem; margin-bottom:.5rem; }
.at-prod-cards { display:flex; flex-direction:column; gap:.5rem; margin-top:.25rem; }
.at-prod-card { display:flex; align-items:flex-start; gap:.75rem; background:rgba(13,148,136,.06); border:1px solid rgba(13,148,136,.2); border-radius:10px; padding:.6rem .75rem; }
.at-prod-thumb-wrap { position:relative; flex-shrink:0; }
.at-prod-thumb { width:56px; height:56px; border-radius:8px; object-fit:cover; background:#0d111c; border:1px solid rgba(255,255,255,.08); display:block; }
.at-prod-thumb--video { width:56px; height:56px; border-radius:8px; background:#1e293b; border:1px solid rgba(99,102,241,.2); display:flex; align-items:center; justify-content:center; font-size:1.3rem; color:#a5b4fc; }
.at-prod-thumb--empty { width:56px; height:56px; border-radius:8px; background:#0d111c; border:1px solid rgba(255,255,255,.05); display:flex; align-items:center; justify-content:center; font-size:1.4rem; }
.at-prod-more-badge { position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,.75); color:#fff; font-size:.6rem; font-weight:700; border-radius:4px; padding:.1rem .3rem; }
.at-prod-info { flex:1; min-width:0; }
.at-prod-name { font-size:.85rem; font-weight:700; color:#f1f5f9; }
.at-prod-prices { display:flex; align-items:center; gap:.5rem; margin-top:.1rem; }
.at-prod-price { font-size:.78rem; color:#0ea5e9; font-weight:600; }
.at-prod-price-promo { font-size:.78rem; color:#10b981; font-weight:700; }
.at-prod-desc { font-size:.72rem; color:#94a3b8; margin-top:.2rem; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.at-prod-remove { background:none; border:none; color:#64748b; cursor:pointer; font-size:1.2rem; flex-shrink:0; padding:.1rem; align-self:flex-start; line-height:1; }
.at-prod-remove:hover { color:#ef4444; }

/* ── Scheduling ──────────────────────────────────────────────────────────── */
.at-scheduling-row { display:flex; gap:.6rem; flex-wrap:wrap; margin-top:.3rem; }
.at-radio-opt { display:flex; align-items:center; gap:.45rem; cursor:pointer; padding:.5rem .85rem; border-radius:8px; border:1.5px solid rgba(99,102,241,.2); background:rgba(15,23,42,.4); color:#94a3b8; font-size:.82rem; font-weight:500; transition:all .18s; user-select:none; }
.at-radio-opt input[type=radio] { display:none; }
.at-radio-opt:hover { border-color:rgba(99,102,241,.45); color:#c7d2fe; }
.at-radio-opt--active { border-color:#6366f1; background:rgba(99,102,241,.15); color:#a5b4fc; }
.at-radio-icon { font-size:.9rem; }
.at-scheduled-at-wrap { margin-top:.5rem; display:flex; flex-direction:column; gap:.3rem; }

/* ── Analysis step v2 ────────────────────────────────────────────────────── */
.at-analysis2-body { padding:1rem 1.4rem; display:flex; flex-direction:column; gap:.85rem; }

/* Banner */
.at-a2-banner { display:flex; align-items:center; gap:.75rem; background:rgba(99,102,241,.07); border:1px solid rgba(99,102,241,.2); border-radius:12px; padding:.7rem 1rem; }
.at-a2-banner--success { background:rgba(16,185,129,.07); border-color:rgba(16,185,129,.25); }
.at-a2-banner--fail { background:rgba(239,68,68,.07); border-color:rgba(239,68,68,.2); }
.at-a2-banner-icon { font-size:1.7rem; flex-shrink:0; }
.at-a2-banner-title { font-size:.88rem; font-weight:700; color:#f1f5f9; }
.at-a2-banner-sub { font-size:.76rem; color:#94a3b8; margin-top:.1rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:380px; }
.at-a2-status-chip { margin-left:auto; font-size:.75rem; font-weight:700; white-space:nowrap; flex-shrink:0; }

/* SCRUM pipeline 4-column grid */
.at-scrum-pipeline { display:grid; grid-template-columns:repeat(4,1fr); gap:.5rem; }
.at-sn { display:flex; flex-direction:column; align-items:center; gap:.3rem; padding:.6rem .3rem; border-radius:10px; border:1px solid transparent; transition:all .3s; }
.at-sn--done { background:rgba(16,185,129,.06); border-color:rgba(16,185,129,.18); }
.at-sn--active { background:rgba(99,102,241,.1); border-color:rgba(99,102,241,.3); box-shadow:0 0 14px rgba(99,102,241,.18); }
.at-sn--pending { opacity:.38; }
.at-sn-circle { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; position:relative; border:2px solid; transition:all .3s; }
.at-sn--done .at-sn-circle { background:#10b981; border-color:#10b981; }
.at-sn--active .at-sn-circle { background:rgba(99,102,241,.15); border-color:#6366f1; }
.at-sn--pending .at-sn-circle { background:rgba(15,23,42,.5); border-color:rgba(148,163,184,.15); }
.at-sn-check { color:#fff; font-size:1rem; font-weight:800; }
.at-sn-icon { font-size:1.05rem; }
.at-sn-ring { position:absolute; inset:-5px; border-radius:50%; border:2px solid #6366f1; animation:ring-pulse 1.6s ease-in-out infinite; }
@keyframes ring-pulse { 0%,100% { opacity:.8; transform:scale(1); } 50% { opacity:.15; transform:scale(1.18); } }
.at-sn-lbl { font-size:.6rem; font-weight:600; color:#94a3b8; text-align:center; text-transform:uppercase; letter-spacing:.03em; line-height:1.2; max-width:72px; }
.at-sn--done .at-sn-lbl { color:#10b981; }
.at-sn--active .at-sn-lbl { color:#c7d2fe; }
.at-sn-num { font-size:.58rem; color:rgba(148,163,184,.35); }

/* Metrics row */
.at-a2-metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:.5rem; }
.at-a2-metric { background:rgba(99,102,241,.04); border:1px solid rgba(99,102,241,.1); border-radius:10px; padding:.6rem .5rem; text-align:center; }
.at-a2-m-icon { font-size:1.1rem; margin-bottom:.25rem; }
.at-a2-m-lbl { font-size:.62rem; color:#475569; text-transform:uppercase; letter-spacing:.04em; font-weight:700; margin-bottom:.2rem; }
.at-a2-m-val { font-size:.78rem; color:#e2e8f0; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* Scrum stream (compact) */
.at-a2-stream { background:#0d111c; border:1px solid rgba(99,102,241,.15); border-radius:10px; overflow:hidden; }
.at-a2-stream-hdr { display:flex; align-items:center; gap:.45rem; padding:.5rem .8rem; font-size:.75rem; font-weight:700; color:#a5b4fc; border-bottom:1px solid rgba(99,102,241,.1); }
.at-a2-stream-body { padding:.55rem .8rem; min-height:36px; max-height:90px; overflow-y:auto; }

/* Kept for compatibility */
.at-pulse-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; animation:pulse-green 1s infinite; }
.at-spin--sm { width:10px; height:10px; }
.at-polling-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:#6366f1; margin-left:.3rem; animation:pulse-green 1s infinite; }
.at-typing-indicator { display:flex; gap:3px; align-items:center; }
.at-typing-indicator span { width:5px; height:5px; border-radius:50%; background:#6366f1; animation:typing-bounce .8s infinite; }
.at-typing-indicator span:nth-child(2) { animation-delay:.15s; }
.at-typing-indicator span:nth-child(3) { animation-delay:.3s; }
@keyframes typing-bounce { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-4px); } }
.at-scrum-waiting { display:flex; align-items:center; gap:.5rem; color:rgba(148,163,184,.5); font-size:.78rem; }
.at-scrum-waiting--muted { color:rgba(148,163,184,.3); }
.at-scrum-text { font-size:.78rem; color:#c7d2fe; white-space:pre-wrap; word-break:break-word; margin:0; font-family:inherit; line-height:1.5; }
.at-cursor { display:inline-block; animation:blink .7s step-end infinite; color:#6366f1; }

.at-proposals { margin-top:.8rem; display:flex; flex-direction:column; gap:.6rem; }
.at-proposals-hdr { font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:#22d3ee; font-weight:700; }
.at-proposal { background:linear-gradient(135deg,rgba(16,185,129,.09),rgba(34,211,238,.06)); border:1px solid rgba(16,185,129,.35); border-radius:12px; padding:.75rem .9rem; animation:fade .3s ease; }
.at-proposal-t { font-size:.82rem; font-weight:700; color:#e2e8f0; display:flex; align-items:center; gap:.45rem; }
.at-proposal-type { background:rgba(34,211,238,.15); color:#22d3ee; font-size:.62rem; font-weight:700; padding:.15rem .45rem; border-radius:999px; letter-spacing:.04em; }
.at-proposal-d { font-size:.75rem; color:#94a3b8; margin-top:.35rem; line-height:1.45; }
.at-proposal-meta { font-size:.68rem; color:#64748b; margin-top:.2rem; }
.at-proposal-actions { display:flex; gap:.5rem; margin-top:.6rem; }
.at-proposal-ok { background:linear-gradient(135deg,#059669,#10b981); color:#fff; border:none; border-radius:8px; font-size:.72rem; font-weight:700; padding:.45rem .85rem; cursor:pointer; }
.at-proposal-ok:hover:not(:disabled) { filter:brightness(1.15); }
.at-proposal-no { background:rgba(239,68,68,.12); color:#f87171; border:1px solid rgba(239,68,68,.4); border-radius:8px; font-size:.72rem; font-weight:600; padding:.45rem .85rem; cursor:pointer; }
.at-proposal-no:hover:not(:disabled) { background:rgba(239,68,68,.22); }
.at-proposal-ok:disabled, .at-proposal-no:disabled { opacity:.5; cursor:not-allowed; }
.at-proposal-hint { font-size:.63rem; color:#64748b; margin-top:.45rem; line-height:1.4; }
.at-proposal-msg { font-size:.75rem; color:#fbbf24; margin-top:.3rem; }
@keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0; } }
.at-status-pending { color:#f59e0b; font-weight:600; }
`]
})
export class AiTeamsComponent implements OnInit {

  // ── State ──────────────────────────────────────────────────────────────────
  teams: Team[] = [];
  agents: AgentCard[] = [];
  leftAgents: AgentCard[] = [];
  rightAgents: AgentCard[] = [];
  patronCard: AgentCard | null = null;
  scrumCard: AgentCard | null = null;
  selectedTeamId = '';
  loading = false;
  saving = false;

  patronName = 'Utilisateur';
  patronAvatarUrl = '';
  scrumAvatarUrl = '';

  workflowSteps = WORKFLOW_STEPS;
  workflowStep = 0;
  hoverStep = 0;

  // Modals
  editModal:   { open: boolean; agent: AgentCard | null } = { open: false, agent: null };
  editForm:    EditForm = this.emptyForm();
  editError    = '';
  detailsModal:{ open: boolean; agent: AgentCard | null } = { open: false, agent: null };
  createTeamModal  = { open: false };
  createTeamForm   = { name: '', description: '', teamType: 'BUSINESS' };
  createTeamError  = '';
  createAgentModal = { open: false };
  createAgentForm  = { name: '', type: 'EMAIL_MANAGER', description: '', photoUrl: '', teamId: '' };
  createAgentError = '';
  patronRequestModal = { open: false, step: 'form' as 'form' | 'analysis' };
  formStep           = 1;
  titleSuggesting    = false;
  titleSuggestion: string | null = null;
  readonly scrumStepIcons: Record<number, string> = { 1:'📋', 2:'🔍', 3:'🤖', 4:'🎯', 5:'⚡', 6:'📥', 7:'🏁' };
  get todayIso() { return new Date().toISOString().slice(0, 16); }
  patronRequestForm  = this.emptyRequestForm();
  patronRequestError = '';
  generatingDesc     = false;
  aiHint             = '';
  descSource: 'none' | 'template' | 'ai' = 'none';
  patronAnalysis = { analyzing: false, skill: '', agentName: '', agentType: '', time: '', priority: '', priorityLabel: '', taskId: '', taskTitle: '' };
  // Live task tracking
  activeTaskId      = '';
  activeTaskStatus  = 'PENDING';
  activeTaskStatusLabel = 'En attente';
  taskPollingActive = false;
  scrumStreaming     = false;
  scrumResponseText = '';
  pendingProposals  = [] as any[];
  proposalBusy      = false;
  proposalMsg       = '';
  private pollingTimer: any = null;
  private streamAbort: AbortController | null = null;
  readonly resultExamples = [
    'Augmenter les ventes',
    'Inviter les contacts VIP',
    'Relancer les clients inactifs',
    'Générer un rapport mensuel',
    'Créer du contenu marketing',
  ];

  // Sidebar collapse
  leftCollapsed  = false;
  rightCollapsed = false;

  // Tasks
  myTasks: TaskCard[] = [];
  showTasksPanel  = false;
  loadingTasks    = false;
  taskFilterStatus = '';
  readonly taskFilters = [
    { v: '', l: 'Toutes' },
    { v: 'PENDING',     l: '⏳ En attente' },
    { v: 'IN_PROGRESS', l: '⚡ En cours' },
    { v: 'DONE',        l: '✅ Terminées' },
    { v: 'FAILED',      l: '❌ Échouées' },
    { v: 'CANCELLED',   l: '🚫 Annulées' },
  ];
  get filteredMyTasks() {
    return this.taskFilterStatus ? this.myTasks.filter(t => t.status === this.taskFilterStatus) : this.myTasks;
  }

  // Team filter state
  agentTeamFilter  = '';
  patronTeamFilter = '';
  get filteredTeamsForAgent()  { return this.teams.filter(t => t.name.toLowerCase().includes(this.agentTeamFilter.toLowerCase())); }
  get filteredTeamsForPatron() { return this.teams.filter(t => t.name.toLowerCase().includes(this.patronTeamFilter.toLowerCase())); }

  // Quick add team in agent modal
  quickAddTeamMode = false;
  quickTeamName    = '';
  quickTeamSaving  = false;
  quickTeamError   = '';

  // Delete / restore
  deletedAgents: AgentCard[] = [];
  showRestorePanel = false;
  deletingId: string | null = null;

  // Upload
  uploadingPhoto = false;

  // Constants exposed to template
  readonly agentTypes = AGENT_TYPES;
  readonly taskTypes       = TASK_TYPES;
  readonly TASK_TYPES_COUNT = TASK_TYPES.length;

  private jwtToken = '';

  constructor(
    private http: HttpClient,
    protected cd: ChangeDetectorRef,
    private dialog: DialogService,
    private router: Router,
    public authService: AuthService,
  ) {}

  /** Visiteur non connecté : on affiche la page de présentation, pas l'espace de travail. */
  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  ngOnInit(): void {
    if (!this.isLoggedIn) { this.loading = false; return; }
    this.jwtToken = this.readToken();
    const user = this.parseJwt();
    this.patronName     = user?.fullName || user?.sub || 'Utilisateur';
    this.patronAvatarUrl = svgDataUrl(getInitials(this.patronName), '#6366f1');
    this.scrumAvatarUrl  = svgDataUrl('SM', '#0ea5e9');
    this.loadTeams();
  }

  // ── Token helpers ──────────────────────────────────────────────────────────
  private readToken(): string {
    try { const r = localStorage.getItem('ms_auth'); if (r) { const p = JSON.parse(r); return p.token || ''; } }
    catch {}
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }
  private parseJwt(): any {
    try { if (!this.jwtToken) return null; return JSON.parse(atob(this.jwtToken.split('.')[1])); }
    catch { return null; }
  }

  // ── Teams ──────────────────────────────────────────────────────────────────
  loadTeams(): void {
    this.http.get<any>(`${API}/api/teams`).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : (res.content || res.data || []);
        this.teams = list.map((t: any) => ({ id: t.id, name: t.name, description: t.description || '', status: t.status, teamType: t.type || t.teamType }));
        if (this.teams.length) { this.selectedTeamId = this.teams[0].id; this.loadAgents(this.selectedTeamId); }
        this.cd.markForCheck();
      },
      error: () => { this.teams = []; this.loadAgents(); this.cd.markForCheck(); }
    });
  }

  onTeamChange(id: string): void { this.selectedTeamId = id; this.loadAgents(id || undefined); }

  // ── Agents ─────────────────────────────────────────────────────────────────
  loadAgents(teamId?: string): void {
    this.loading = true;
    const params: Record<string, string> = { size: '100' };
    if (teamId) params['teamId'] = teamId;
    this.http.get<any>(`${API}/api/agents`, { params }).subscribe({
      next: (res) => { const list: any[] = Array.isArray(res) ? res : (res.content || res.data || []); this.buildCards(list); this.loading = false; this.cd.markForCheck(); },
      error: () => { this.loading = false; this.agents = []; this.distributeAgents(); this.cd.markForCheck(); }
    });
  }

  private buildCards(list: any[]): void {
    const cards: AgentCard[] = list.map(a => {
      const type = a.type || a.agentType || '';
      const badge = TYPE_BADGE[type] || { label: type, color: '#6366f1' };
      return {
        id: a.id, name: a.name, agentType: type,
        description: a.description || '', status: a.status || 'INACTIVE',
        photoUrl: a.photoUrl || '', model: a.model || '',
        competencies: makeCompetencies(type, a.description || ''),
        badgeColor: badge.color, badgeLabel: badge.label,
        teamId: a.teamId, systemPrompt: a.systemPrompt || '',
        temperature: a.temperature ?? 0.7, maxTokens: a.maxTokens ?? 2048,
      };
    });
    this.scrumCard = cards.find(c => c.agentType === 'SCRUM_MASTER') || null;
    this.agents    = cards.filter(c => c.agentType !== 'SCRUM_MASTER');
    this.patronCard = null;
    this.distributeAgents();
  }

  private distributeAgents(): void {
    this.rightAgents = this.agents.filter((_, i) => i % 2 === 0);
    this.leftAgents  = this.agents.filter((_, i) => i % 2 === 1);
  }

  getAvatarUrl(agent: AgentCard | null): string {
    if (!agent) return svgDataUrl('?', '#6366f1');
    return svgDataUrl(getInitials(agent.name), agent.badgeColor || '#6366f1');
  }

  getStepTransform(i: number): string {
    const r = 110;
    const rad = (i * (360 / this.workflowSteps.length) - 90) * (Math.PI / 180);
    return `translate(calc(${Math.cos(rad) * r}px - 0px), calc(${Math.sin(rad) * r}px - 0px))`;
  }

  // ── Details ────────────────────────────────────────────────────────────────
  openDetails(agent: AgentCard): void { this.detailsModal = { open: true, agent }; }

  // ── Edit ───────────────────────────────────────────────────────────────────
  openEditModal(agent: AgentCard): void {
    this.editError = '';
    this.editModal = { open: true, agent };
    this.editForm  = {
      id: agent.id, name: agent.name, description: agent.description,
      status: agent.status, agentType: agent.agentType,
      model: agent.model || 'llama-3.3-70b-versatile',
      temperature: agent.temperature ?? 0.7, maxTokens: agent.maxTokens ?? 2048,
      systemPrompt: agent.systemPrompt || '', photoUrl: agent.photoUrl || '',
    };
  }
  closeEditModal(): void { this.editModal = { open: false, agent: null }; this.editError = ''; }

  saveAgent(): void {
    if (this.saving) return;
    this.saving = true;
    this.http.put<any>(`${API}/api/agents/${this.editForm.id}`, {
      name: this.editForm.name, description: this.editForm.description,
      status: this.editForm.status, model: this.editForm.model,
      temperature: this.editForm.temperature, maxTokens: this.editForm.maxTokens,
      systemPrompt: this.editForm.systemPrompt, photoUrl: this.editForm.photoUrl || null,
    }).subscribe({
      next: (u) => { this.applyUpdate(u); this.saving = false; this.closeEditModal(); this.cd.markForCheck(); },
      error: (e) => { this.editError = `Erreur ${e?.status || '?'} : ${e?.error?.message || e?.message || 'Impossible de sauvegarder'}`; this.saving = false; this.cd.markForCheck(); }
    });
  }

  private applyUpdate(u: any): void {
    const type  = u.type || u.agentType || '';
    const badge = TYPE_BADGE[type] || { label: type, color: '#6366f1' };
    const patch = (c: AgentCard) => {
      c.name = u.name; c.description = u.description; c.status = u.status;
      c.model = u.model; c.temperature = u.temperature; c.maxTokens = u.maxTokens;
      c.systemPrompt = u.systemPrompt; c.photoUrl = u.photoUrl || '';
      c.badgeColor = badge.color; c.badgeLabel = badge.label;
    };
    if (this.scrumCard?.id === u.id) { patch(this.scrumCard!); return; }
    const a = this.agents.find(x => x.id === u.id);
    if (a) { patch(a); this.distributeAgents(); }
  }

  // ── Create Agent ───────────────────────────────────────────────────────────
  openCreateAgentModal(): void {
    this.createAgentModal.open = true; this.createAgentError = '';
    this.createAgentForm = { name: '', type: 'EMAIL_MANAGER', description: '', photoUrl: '', teamId: this.selectedTeamId || '' };
    this.quickAddTeamMode = false; this.quickTeamName = ''; this.quickTeamError = ''; this.agentTeamFilter = '';
  }
  closeCreateAgentModal(): void { this.createAgentModal.open = false; this.createAgentError = ''; }

  createAgent(): void {
    if (this.saving) return;
    if (!this.createAgentForm.name.trim()) { this.createAgentError = 'Le nom est obligatoire.'; return; }
    this.saving = true; this.createAgentError = '';
    const type   = this.createAgentForm.type;
    const teamId = this.createAgentForm.teamId || this.selectedTeamId;
    const body: any = {
      name:        this.createAgentForm.name.trim(),
      description: this.createAgentForm.description.trim() || null,
      teamId:      teamId || null
    };
    this.http.post<any>(`${API}/api/agents/from-template/${type}`, body).subscribe({
      next: () => { this.saving = false; this.closeCreateAgentModal(); this.loadAgents(this.selectedTeamId || undefined); this.cd.markForCheck(); },
      error: (e) => { this.createAgentError = this.friendlyHttpError(e, 'Impossible de créer l\'agent.'); this.saving = false; this.cd.markForCheck(); }
    });
  }

  // ── Delete / Restore ───────────────────────────────────────────────────────
  async deleteAgent(agent: AgentCard, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.dialog.confirm(`Supprimer "${agent.name}" ?`, 'Supprimer l\'agent', 'Supprimer', 'Annuler');
    if (!ok) return;
    this.deletingId = agent.id;
    this.http.delete(`${API}/api/agents/${agent.id}`).subscribe({
      next: () => {
        if (this.scrumCard?.id === agent.id) this.scrumCard = null;
        else { this.agents = this.agents.filter(a => a.id !== agent.id); this.distributeAgents(); }
        this.deletingId = null; this.cd.markForCheck();
      },
      error: () => { this.deletingId = null; this.cd.markForCheck(); }
    });
  }

  toggleRestorePanel(): void {
    this.showRestorePanel = !this.showRestorePanel;
    if (this.showRestorePanel) this.loadDeletedAgents();
  }
  loadDeletedAgents(): void {
    this.http.get<any>(`${API}/api/agents/deleted`).subscribe({
      next: (res) => {
        const list: any[] = Array.isArray(res) ? res : [];
        this.deletedAgents = list.map(a => {
          const type = a.type || a.agentType || '';
          const badge = TYPE_BADGE[type] || { label: type, color: '#6366f1' };
          return { id: a.id, name: a.name, agentType: type, description: a.description || '', status: a.status || 'INACTIVE', photoUrl: a.photoUrl || '', model: '', competencies: [], badgeColor: badge.color, badgeLabel: badge.label, teamId: a.teamId, systemPrompt: '', temperature: 0.7, maxTokens: 2048 };
        });
        this.cd.markForCheck();
      },
      error: () => { this.deletedAgents = []; this.cd.markForCheck(); }
    });
  }
  restoreAgent(agent: AgentCard): void {
    this.http.post<any>(`${API}/api/agents/${agent.id}/restore`, {}).subscribe({
      next: () => { this.deletedAgents = this.deletedAgents.filter(a => a.id !== agent.id); this.loadAgents(this.selectedTeamId || undefined); this.cd.markForCheck(); },
      error: () => {}
    });
  }

  // ── Create Team ────────────────────────────────────────────────────────────
  openCreateTeamModal(): void { this.createTeamModal.open = true; this.createTeamError = ''; this.createTeamForm = { name: '', description: '', teamType: 'BUSINESS' }; }
  closeCreateTeamModal(): void { this.createTeamModal.open = false; this.createTeamError = ''; }

  private friendlyHttpError(e: any, fallback = 'Une erreur est survenue. Réessayez.') {
    if (!e) return fallback;
    if (e.status === 0) return 'Connexion au serveur impossible. Vérifiez votre connexion Internet puis réessayez.';
    return `Erreur ${e.status || ''} : ${e.error?.message || e.message || fallback}`.replace('Erreur  :', 'Erreur :');
  }

  createTeam(): void {
    if (this.saving) return;
    if (!this.createTeamForm.name.trim()) { this.createTeamError = 'Le nom est obligatoire.'; return; }
    this.saving = true; this.createTeamError = '';
    this.http.post<any>(`${API}/api/teams`, { name: this.createTeamForm.name.trim(), description: this.createTeamForm.description.trim() || null, type: this.createTeamForm.teamType }).subscribe({
      next: (t) => { this.teams.push({ id: t.id, name: t.name, description: t.description || '', status: t.status, teamType: t.type }); this.saving = false; this.closeCreateTeamModal(); this.selectedTeamId = t.id; this.loadAgents(t.id); this.cd.markForCheck(); },
      error: (e) => { this.createTeamError = this.friendlyHttpError(e, 'Impossible de créer l\'équipe.'); this.saving = false; this.cd.markForCheck(); }
    });
  }

  // ── Patron Request ─────────────────────────────────────────────────────────
  private emptyRequestForm() {
    return {
      title: '', description: '', priority: 'MEDIUM', type: 'GENERAL', dueDate: '',
      teamId: this.selectedTeamId || '',
      expectedResult: '', confidentiality: 'TEAM',
      contacts: [] as string[], contactInput: '', markAsVip: false,
      attachments: [] as { name: string; size: number; type: string; file: File }[],
      schedulingMode: 'immediate' as 'immediate' | 'scheduled',
      scheduledAt: '',
      semiAutomatic: false,
      platforms: [] as string[],
      hashtags: '',
      tone: 'dynamique',
      campaignObjective: 'VENTES',
    };
  }

  openPatronRequestModal(): void {
    this.patronRequestModal = { open: true, step: 'form' };
    this.formStep           = 1;
    this.titleSuggestion    = null;
    this.titleSuggesting    = false;
    this.patronRequestError = '';
    this.selectedClientCodes = [];
    this.selectedProductCodes = [];
    this.includeProducts = false;
    this.aiHint = '';
    this.descSource = 'none';
    this.patronRequestForm = this.emptyRequestForm();
    this.patronRequestForm.teamId = this.selectedTeamId || '';
  }

  validateStep(step: number): string | null {
    switch (step) {
      case 1:
        if (!this.patronRequestForm.title?.trim()) return 'Le titre est obligatoire.';
        return null;
      case 2:
        if (this.patronRequestForm.type === 'PRODUCT_PROMOTION' && !this.patronRequestForm.platforms.length)
          return 'Sélectionnez au moins une plateforme cible.';
        if (this.patronRequestForm.schedulingMode === 'scheduled' && !this.patronRequestForm.scheduledAt)
          return "Précisez la date et l'heure d'exécution planifiée.";
        return null;
      case 3:
        if (!this.patronRequestForm.description?.trim()) return 'La description est obligatoire. Utilisez le bouton ✨ Générer si besoin.';
        return null;
      case 4:
        if (!this.patronRequestForm.expectedResult?.trim()) return 'Le résultat attendu est obligatoire.';
        return null;
      default:
        return null;
    }
  }

  nextFormStep(): void {
    const err = this.validateStep(this.formStep);
    if (err) { this.patronRequestError = err; this.cd.markForCheck(); return; }
    this.patronRequestError = '';
    if (this.formStep < 5) { this.formStep++; this.cd.markForCheck(); }
  }
  prevFormStep(): void {
    this.patronRequestError = '';
    if (this.formStep > 1) { this.formStep--; this.cd.markForCheck(); }
  }
  goToFormStep(n: number): void {
    this.patronRequestError = '';
    if (n >= 1 && n <= 5) { this.formStep = n; this.cd.markForCheck(); }
  }

  improveTitleWithAI(): void {
    if (!this.patronRequestForm.title || this.titleSuggesting || !this.scrumCard) return;
    this.titleSuggesting = true;
    this.titleSuggestion = null;
    const prompt = `Améliore ce titre de tâche pour le rendre plus professionnel et précis, en français, en maximum 10 mots. Réponds uniquement avec le titre corrigé, sans guillemets ni explication.\n\nTitre original : ${this.patronRequestForm.title}`;
    this.http.post<any>(
      `${API}/api/agents/${this.scrumCard.id}/chat/generate-description`,
      { prompt },
      { headers: this.authHeaders() }
    ).subscribe({
      next: (res) => {
        const raw = (res?.description || '').trim();
        const firstLine = raw.split('\n').find((l: string) => l.trim().length > 3) || '';
        this.titleSuggestion = firstLine.replace(/^["""«»*-]+|["""«»*-]+$/g, '').trim() || null;
        this.titleSuggesting = false;
        this.cd.markForCheck();
      },
      error: () => { this.titleSuggesting = false; this.cd.markForCheck(); }
    });
  }

  applyTitleSuggestion(): void {
    if (this.titleSuggestion) {
      this.patronRequestForm.title = this.titleSuggestion;
      this.titleSuggestion = null;
      this.cd.markForCheck();
    }
  }

  getTaskTypeLabel(typeVal: string): string {
    return this.availableTaskTypes.find(t => t.v === typeVal)?.l || typeVal;
  }

  getPriorityLabel(p: string): string {
    const map: Record<string, string> = { LOW:'🟢 Basse', MEDIUM:'🔵 Normale', HIGH:'🟡 Haute', URGENT:'🟠 Urgente', CRITICAL:'🔴 Critique' };
    return map[p] || p;
  }

  getConfidentialityLabel(c: string): string {
    const map: Record<string, string> = { TEAM:'🌐 Public équipe', MANAGER:'🔐 Privé manager', SENSITIVE:'🔴 Sensible' };
    return map[c] || c;
  }
  closePatronRequestModal(): void {
    this.patronRequestModal.open = false;
    this.patronRequestError = '';
    this.stopTaskPolling();
    if (this.streamAbort) { this.streamAbort.abort(); this.streamAbort = null; }
  }

  // ── Task polling ───────────────────────────────────────────────────────────
  private startTaskPolling(taskId: string): void {
    this.activeTaskId     = taskId;
    this.taskPollingActive = true;
    this.stopTaskPolling();
    this.pollingTimer = setInterval(() => this.pollTaskStatus(), 5000);
  }
  private stopTaskPolling(): void {
    if (this.pollingTimer) { clearInterval(this.pollingTimer); this.pollingTimer = null; }
    this.taskPollingActive = false;
  }
  private pollTaskStatus(): void {
    if (!this.activeTaskId) return;
    this.http.get<any>(`${API}/api/tasks/${this.activeTaskId}`).subscribe({
      next: (task) => {
        this.loadPendingProposals();
        const prev = this.activeTaskStatus;
        this.activeTaskStatus      = task.status;
        this.activeTaskStatusLabel = this.taskStatusLabel(task.status);
        this.workflowStep          = this.taskStatusToStep(task.status, this.workflowStep);
        // Mettre à jour la liste "Mes demandes"
        const idx = this.myTasks.findIndex(t => t.id === this.activeTaskId);
        if (idx >= 0) this.myTasks[idx] = { ...this.myTasks[idx], status: task.status };
        // Arrêter le polling si terminé
        if (['DONE','COMPLETED','FAILED','CANCELLED'].includes(task.status)) {
          this.stopTaskPolling();
          if (['DONE','COMPLETED'].includes(task.status)) {
            this.dialog.confirm(
              'La tâche a été exécutée avec succès par l\'agent. Souhaitez-vous accéder au workspace pour consulter les résultats ?',
              '🎉 Tâche accomplie !',
              '🚀 Aller au workspace',
              '✕ Rester ici',
              'success'
            ).then(confirmed => {
              if (confirmed) {
                this.closePatronRequestModal();
                this.router.navigate(['/agentique/workspace']);
              }
            });
          }
        }
        this.cd.markForCheck();
      },
      error: () => {}
    });
  }
  taskStatusToStep(status: string, current: number): number {
    const map: Record<string, number> = {
      PENDING:     Math.max(current, 2),
      QUEUED:      Math.max(current, 3),
      IN_PROGRESS: Math.max(current, 4),
      WAITING_TOOL:Math.max(current, 5),
      ESCALATED:   Math.max(current, 6),
      DONE:        7,
      COMPLETED:   7,
      FAILED:      current,
      CANCELLED:   current,
    };
    return map[status] ?? current;
  }
  taskStatusLabel(s: string): string {
    return {
      PENDING:      '⏳ En attente',
      QUEUED:       '📋 En file',
      IN_PROGRESS:  '⚡ En cours',
      WAITING_TOOL: '🔧 Outil en attente',
      DONE:         '✅ Terminée',
      COMPLETED:    '✅ Terminée',
      FAILED:       '❌ Échouée',
      CANCELLED:    '🚫 Annulée',
      ESCALATED:    '🔺 Escaladée',
    }[s] || s;
  }

  // ── Scrum streaming via fetch (SSE sur POST) ───────────────────────────────
  private async streamScrumResponse(agentId: string, message: string, taskId: string): Promise<void> {
    this.scrumStreaming     = true;
    this.scrumResponseText = '';
    this.streamAbort = new AbortController();
    // Timeout 60s pour éviter de saturer le pool de connexions DB
    const timeoutId = setTimeout(() => this.streamAbort?.abort(), 60_000);

    // Lire le token depuis localStorage
    let token = '';
    try { const r = localStorage.getItem('ms_auth'); if (r) token = JSON.parse(r).token || ''; } catch {}

    try {
      const res = await fetch(`${API}/api/agents/${agentId}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, sessionId: `patron-${taskId}` }),
        signal: this.streamAbort.signal,
      });

      if (!res.ok || !res.body) {
        this.scrumStreaming = false;
        this.cd.markForCheck();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trimEnd();
          if (!trimmed) continue;
          if (trimmed.startsWith('data:')) {
            const data = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5);
            // Ignorer les marqueurs internes
            if (!data || data === '[DONE]' || data.startsWith('[SESSION:') || data.startsWith('[DONE]')) continue;
            try {
              // Format JSON SSE: {"content":"..."} ou {"choices":[{"delta":{"content":"..."}}]}
              const obj = JSON.parse(data);
              const chunk = obj.content || obj?.choices?.[0]?.delta?.content || '';
              if (chunk) { this.scrumResponseText += chunk; this.cd.markForCheck(); }
            } catch {
              // Texte brut token par token
              this.scrumResponseText += data; this.cd.markForCheck();
            }
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        this.scrumResponseText += this.scrumResponseText
          ? '\n\n[Connexion interrompue]'
          : '[Le Scrum Manager a traité la demande en arrière-plan.]';
      }
    } finally {
      clearTimeout(timeoutId);
    }
    this.scrumStreaming = false;
    this.loadPendingProposals();
    this.cd.markForCheck();
    // Avancer le step si toujours en cours
    if (this.workflowStep < 3) {
      this.workflowStep = 3; // Scrum a analysé
      this.cd.markForCheck();
    }
  }

  // ── Approbation des créations d'agent proposées par le SCRUM ─────────────
  loadPendingProposals(): void {
    this.http.get<any[]>(`${API}/api/agent-proposals?status=PENDING`).subscribe({
      next: (list) => {
        this.pendingProposals = list || [];
        this.cd.markForCheck();
      },
      error: () => {}
    });
  }

  approveProposal(p: any): void {
    if (this.proposalBusy) return;
    this.proposalBusy = true; this.proposalMsg = '';
    this.http.post<any>(`${API}/api/agent-proposals/${p.id}/approve`, {}).subscribe({
      next: (res) => {
        this.proposalMsg = `✅ Agent « ${res.name || res.agentType} » créé (${res.agentType}) et ajouté à l'équipe.`;
        this.pendingProposals = this.pendingProposals.filter(q => q.id !== p.id);
        this.loadAgents();
        this.proposalBusy = false;
        this.cd.markForCheck();
      },
      error: (e) => {
        this.proposalMsg = `❌ ${e?.error?.message || e?.message || 'Erreur lors de l\'approbation'}`;
        this.proposalBusy = false; this.cd.markForCheck();
      }
    });
  }

  refuseProposal(p: any): void {
    if (this.proposalBusy) return;
    this.proposalBusy = true; this.proposalMsg = '';
    this.http.post<any>(`${API}/api/agent-proposals/${p.id}/refuse`, {}).subscribe({
      next: () => {
        this.proposalMsg = `✕ Proposition refusée. Aucun agent n'a été créé.`;
        this.pendingProposals = this.pendingProposals.filter(q => q.id !== p.id);
        this.proposalBusy = false; this.cd.markForCheck();
      },
      error: (e) => {
        this.proposalMsg = `❌ ${e?.error?.message || e?.message || 'Erreur lors du refus'}`;
        this.proposalBusy = false; this.cd.markForCheck();
      }
    });
  }

  // ── Handlers synchronisation type/priorité ────────────────────────────────
  onTaskTypeChange(val: string): void {
    this.patronRequestForm.type = val;
    if (val === 'PRODUCT_PROMOTION') {
      this.includeProducts = true;
      this.loadDbProducts();
    }
    if (this.descSource === 'template') this.refreshTemplateDesc();
    this.cd.markForCheck();
  }
  onPriorityChange(val: string): void {
    this.patronRequestForm.priority = val;
    if (this.descSource === 'template') this.refreshTemplateDesc();
    this.cd.markForCheck();
  }
  private refreshTemplateDesc(): void {
    this.patronRequestForm.description = this.buildAutoDescription();
  }

  // ── AI helpers ─────────────────────────────────────────────────────────────

  getProductMedia(code: string): { url: string; type: 'image' | 'video' }[] {
    const product = this.getDbProductByCode(code);
    if (!product) return [];
    const result: { url: string; type: 'image' | 'video' }[] = [];
    const isValidSrc = (u: string) => typeof u === 'string' && u.length > 4 &&
      (u.startsWith('http') || u.startsWith('data:') || u.startsWith('/') || u.startsWith('blob:'));
    const addMedia = (raw: any, mediaType: 'image' | 'video') => {
      if (!raw) return;
      let parsed = raw;
      if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
      }
      if (Array.isArray(parsed)) {
        parsed.forEach((u: any) => { if (isValidSrc(String(u || ''))) result.push({ url: String(u), type: mediaType }); });
      } else if (isValidSrc(String(parsed || ''))) {
        result.push({ url: String(parsed), type: mediaType });
      }
    };
    addMedia(product.photos, 'image');
    addMedia(product.videos, 'video');
    return result;
  }

  generateDescription(): void {
    if (!this.patronRequestForm.title || this.generatingDesc) return;
    this.generatingDesc = true;
    this.aiHint = '';

    // Pas de Scrum agent → template (pas d'IA réelle)
    if (!this.scrumCard) {
      this.patronRequestForm.description = this.buildAutoDescription();
      this.descSource = 'template';
      this.generatingDesc = false;
      this.aiHint = '📋 Description générée depuis le formulaire (aucun Scrum Manager actif)';
      this.cd.markForCheck();
      return;
    }

    const typeLabel = this.taskTypes.find(x => x.v === this.patronRequestForm.type)?.l || this.patronRequestForm.type;
    const platformsStr = this.patronRequestForm.platforms?.length
      ? this.patronRequestForm.platforms.join(', ')
      : null;
    const platformsInstruction = platformsStr
      ? `\nPlatformes cibles : ${platformsStr}\nIMPORTANT : l'agent doit utiliser l'outil post_social pour publier effectivement le contenu sur ${platformsStr} — la description doit inclure cette instruction explicite.`
      : '';
    const productsInstruction = this.selectedProductCodes.length
      ? '\nProduits à promouvoir : ' + this.selectedProductCodes.map(code => {
          const p = this.getDbProductByCode(code);
          const mediaUrls = this.getProductMedia(code).map(m => m.url);
          const mediaStr = mediaUrls.length ? ` [images: ${mediaUrls.join(', ')}]` : '';
          return p ? `${p.nom}${p.description ? ' (' + p.description + ')' : ''}${p.prix ? ' — ' + p.prix + '€' : ''}${mediaStr}` : code;
        }).join(' / ')
      : '';
    const allMediaUrls = this.selectedProductCodes.flatMap(c => this.getProductMedia(c).map(m => m.url));
    const mediaInstruction = allMediaUrls.length
      ? `\nIMPORTANT : la description doit rappeler à l'agent d'utiliser le paramètre mediaUrls=${JSON.stringify(allMediaUrls)} dans post_social pour joindre les images.`
      : '';
    const prompt = `Tu es un Scrum Manager expert. Génère une description de tâche professionnelle et détaillée (5-8 lignes) pour :\nTitre : "${this.patronRequestForm.title}"\nType : ${typeLabel}\nPriorité : ${this.patronRequestForm.priority}${productsInstruction}${platformsInstruction}${mediaInstruction}\n\nLa description doit inclure : contexte, instructions précises, livrables attendus. Réponds uniquement avec la description, sans titre ni introduction.`;

    this.http.post<{description: string}>(`${API}/api/agents/${this.scrumCard.id}/chat/generate-description`,
      { prompt }
    ).subscribe({
      next: (r) => {
        const text = (r?.description || '').trim();
        if (text.length > 20) {
          this.patronRequestForm.description = text;
          this.descSource = 'ai';
          this.aiHint = '✨ Description générée par le Scrum Manager IA — modifiable';
        } else {
          this.patronRequestForm.description = this.buildAutoDescription();
          this.descSource = 'template';
          this.aiHint = '📋 Description générée depuis le formulaire (réponse IA vide)';
        }
        this.generatingDesc = false;
        this.cd.markForCheck();
      },
      error: () => {
        this.patronRequestForm.description = this.buildAutoDescription();
        this.descSource = 'template';
        this.aiHint = '📋 Description générée depuis le formulaire (erreur IA)';
        this.generatingDesc = false;
        this.cd.markForCheck();
      }
    });
  }

  private buildAutoDescription(): string {
    const t  = this.patronRequestForm.title;
    const tl = this.taskTypes.find(x => x.v === this.patronRequestForm.type)?.l || this.patronRequestForm.type;
    const pl = { LOW:'Basse', MEDIUM:'Normale', HIGH:'Haute', URGENT:'Urgente', CRITICAL:'Critique' }[this.patronRequestForm.priority] || this.patronRequestForm.priority;
    const contacts = this.patronRequestForm.contacts.length
      ? `\nDestinataires : ${this.patronRequestForm.contacts.join(', ')}` : '';
    const result = this.patronRequestForm.expectedResult
      ? `\nObjectif : ${this.patronRequestForm.expectedResult}` : '';
    const platforms = this.patronRequestForm.platforms?.length
      ? `\nPlatformes : ${this.patronRequestForm.platforms.join(', ')}\nIMPORTANT : utiliser l'outil post_social pour publier sur ${this.patronRequestForm.platforms.join(', ')}.`
      : '';
    return `Tâche : ${t}\nType : ${tl} | Priorité : ${pl}${result}${contacts}${platforms}\n\nMerci de traiter cette demande avec soin et de me notifier dès que le résultat est disponible.`;
  }

  analyzeTask(): void {
    if (!this.patronRequestForm.title) return;
    const skill  = this.detectSkill(this.patronRequestForm.type);
    const agent  = this.findBestAgentStrict(this.patronRequestForm.type);
    const agentMsg = agent ? `${agent.name} (${agent.badgeLabel})` : 'Aucun agent correspondant — le Scrum Manager assignera';
    this.aiHint = `🔍 Compétence détectée : "${skill}" · Agent : ${agentMsg} · Priorité sélectionnée : ${this.patronRequestForm.priority}`;
    this.cd.markForCheck();
  }

  suggestAgent(): void {
    const agent = this.findBestAgentStrict(this.patronRequestForm.type);
    const skill = this.detectSkill(this.patronRequestForm.type);
    if (agent) {
      this.aiHint = `💡 Agent recommandé : ${agent.name} — compétence "${skill}" correspond à ${agent.badgeLabel} (statut : ${agent.status === 'ACTIVE' ? '🟢 Actif' : '🔴 Inactif'})`;
    } else {
      this.aiHint = `💡 Aucun agent avec la compétence "${skill}" trouvé dans l'équipe. Le Scrum Manager choisira le meilleur agent disponible.`;
    }
    this.cd.markForCheck();
  }

  private detectSkill(type: string): string {
    const map: Record<string, string> = {
      EMAIL_RESPONSE:    'Email Marketing',
      SOCIAL_POST:       'Community Management',
      PROSPECT_SEARCH:   'Prospection B2B',
      CAMPAIGN_CREATE:   'Campagne Marketing',
      CONTENT_GENERATE:  'Création de Contenu',
      IMAGE_GENERATE:    'Génération Image IA',
      VIDEO_GENERATE:    'Production Vidéo',
      CV_CREATE:         'Rédaction CV',
      REPORT_GENERATE:   'Analyse & Rapport',
      SECURITY_SCAN:     'Audit Sécurité',
      DOCUMENT_SUMMARIZE:'Analyse Documentaire',
      PRODUCT_PROMOTION: 'Promotion Réseaux Sociaux',
    };
    return map[type] || 'Gestion de Projet Générale';
  }

  // Correspondance stricte type de tâche → agentType requis
  private readonly TASK_TO_AGENT_TYPE: Record<string, string> = {
    EMAIL_RESPONSE:      'EMAIL_MANAGER',
    SOCIAL_POST:         'COMMUNITY_MANAGER',
    SOCIAL_CONTENT:      'SOCIAL_CONTENT_CREATOR',
    PROSPECT_SEARCH:     'PROSPECTION',
    CAMPAIGN_CREATE:     'MARKETING',
    CONTENT_GENERATE:    'CREATIVE_LEAD',
    PRESENTATION_CREATE: 'PRESENTATION_CREATOR',
    DOCUMENT_SUMMARIZE:  'DOCUMENT_SUMMARIZER',
    DOCUMENT_PDF:        'DOCUMENT_SUMMARIZER',
    IMAGE_GENERATE:      'IMAGE_CREATOR',
    VIDEO_GENERATE:      'VIDEO_CREATOR',
    CV_CREATE:           'CV_CREATOR',
    REPORT_GENERATE:     'ACCOUNTANT',
    ACCOUNTING_REPORT:   'ACCOUNTANT',
    SECURITY_SCAN:       'SECURITY_AUDIT',
    PRODUCT_PROMOTION:   'COMMUNITY_MANAGER',
  };

  // Types de tâche disponibles selon les agents présents dans l'équipe
  get availableTaskTypes() {
    const agentTypeSet = new Set(this.agents.map(a => a.agentType));
    return TASK_TYPES.filter(t => !t.agentType || agentTypeSet.has(t.agentType));
  }

  // Retourne UNIQUEMENT l'agent dont l'agentType correspond exactement.
  // Ne fait PAS de fallback sur un agent aléatoire.
  private findBestAgentStrict(taskType: string): AgentCard | null {
    const requiredAgentType = this.TASK_TO_AGENT_TYPE[taskType];
    if (!requiredAgentType) return null; // GENERAL ou type inconnu : pas de match strict
    // Parmi les agents avec le bon type, préférer ACTIVE
    const matches = this.agents.filter(a => a.agentType === requiredAgentType);
    return matches.find(a => a.status === 'ACTIVE') || matches[0] || null;
  }

  private estimateTime(type: string, priority: string): string {
    const base: Record<string, number> = {
      EMAIL_RESPONSE: 2, SOCIAL_POST: 5, PROSPECT_SEARCH: 10, CAMPAIGN_CREATE: 15,
      CONTENT_GENERATE: 8, IMAGE_GENERATE: 3, VIDEO_GENERATE: 20, CV_CREATE: 10,
      REPORT_GENERATE: 12, SECURITY_SCAN: 25, DOCUMENT_SUMMARIZE: 5, GENERAL: 7,
    };
    const mult: Record<string, number> = { LOW: 1.5, MEDIUM: 1, HIGH: 0.7, URGENT: 0.4, CRITICAL: 0.2 };
    const mins = Math.round((base[type] || 7) * (mult[priority] || 1));
    return mins < 60 ? `${mins} minute${mins > 1 ? 's' : ''}` : `${Math.round(mins / 6) / 10}h`;
  }

  readonly socialPlatforms = [
    { v: 'INSTAGRAM', l: '📸 Instagram' },
    { v: 'FACEBOOK',  l: '👥 Facebook' },
    { v: 'TIKTOK',    l: '🎵 TikTok' },
    { v: 'LINKEDIN',  l: '💼 LinkedIn' },
    { v: 'TWITTER_X', l: '𝕏 Twitter / X' },
  ];
  togglePromoPlatform(v: string): void {
    const i = this.patronRequestForm.platforms.indexOf(v);
    i >= 0 ? this.patronRequestForm.platforms.splice(i, 1) : this.patronRequestForm.platforms.push(v);
    this.cd.markForCheck();
  }

  // ── Client / Product pickers ───────────────────────────────────────────────
  dbClients:  any[] = [];
  dbProducts: any[] = [];
  showClientPicker  = false;
  showProductPicker = false;
  clientPickerSearch  = '';
  productPickerSearch = '';
  clientPickerTemp:  string[] = [];
  productPickerTemp: string[] = [];
  selectedClientCodes:  string[] = [];
  selectedProductCodes: string[] = [];
  includeProducts = false;

  private authHeaders() {
    return { Authorization: `Bearer ${this.readToken()}` };
  }

  private loadDbClients(): void {
    if (this.dbClients.length) return;
    this.http.get<any[]>(`${API}/api/user/clients`, { headers: this.authHeaders() }).subscribe({
      next: d => { this.dbClients = d || []; this.cd.markForCheck(); },
      error: () => {}
    });
  }
  private loadDbProducts(): void {
    if (this.dbProducts.length) return;
    this.http.get<any[]>(`${API}/api/user/products`, { headers: this.authHeaders() }).subscribe({
      next: d => { this.dbProducts = d || []; this.cd.markForCheck(); },
      error: () => {}
    });
  }

  get filteredDbClients() {
    const q = this.clientPickerSearch.toLowerCase().trim();
    if (!q) return this.dbClients;
    return this.dbClients.filter(c =>
      c.nom?.toLowerCase().includes(q) || c.prenoms?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) || c.entrepriseName?.toLowerCase().includes(q)
    );
  }
  get filteredDbProducts() {
    const q = this.productPickerSearch.toLowerCase().trim();
    if (!q) return this.dbProducts;
    return this.dbProducts.filter(p => p.nom?.toLowerCase().includes(q) || p.code?.includes(q));
  }

  openClientPicker(): void {
    this.loadDbClients();
    this.clientPickerTemp = [...this.selectedClientCodes];
    this.clientPickerSearch = '';
    this.showClientPicker = true;
    this.cd.markForCheck();
  }
  toggleClientPick(code: string): void {
    const i = this.clientPickerTemp.indexOf(code);
    i >= 0 ? this.clientPickerTemp.splice(i, 1) : this.clientPickerTemp.push(code);
  }
  confirmClientPicker(): void {
    this.selectedClientCodes = [...this.clientPickerTemp];
    const emails = this.selectedClientCodes
      .map(code => this.dbClients.find(c => c.code === code)?.email)
      .filter(Boolean);
    emails.forEach(em => {
      if (!this.patronRequestForm.contacts.includes(em)) this.patronRequestForm.contacts.push(em);
    });
    this.showClientPicker = false;
    this.cd.markForCheck();
  }
  removeClientCode(code: string): void {
    this.selectedClientCodes = this.selectedClientCodes.filter(c => c !== code);
    const email = this.dbClients.find(c => c.code === code)?.email;
    if (email) this.patronRequestForm.contacts = this.patronRequestForm.contacts.filter(e => e !== email);
    this.cd.markForCheck();
  }

  openProductPicker(): void {
    this.loadDbProducts();
    this.productPickerTemp = [...this.selectedProductCodes];
    this.productPickerSearch = '';
    this.showProductPicker = true;
    this.cd.markForCheck();
  }
  toggleProductPick(code: string): void {
    const i = this.productPickerTemp.indexOf(code);
    i >= 0 ? this.productPickerTemp.splice(i, 1) : this.productPickerTemp.push(code);
  }
  confirmProductPicker(): void {
    this.selectedProductCodes = [...this.productPickerTemp];
    this.showProductPicker = false;
    this.cd.markForCheck();
  }
  removeProductCode(code: string): void {
    this.selectedProductCodes = this.selectedProductCodes.filter(c => c !== code);
    this.cd.markForCheck();
  }
  getDbClientByCode(code: string) { return this.dbClients.find(c => c.code === code); }
  getDbProductByCode(code: string) { return this.dbProducts.find(p => p.code === code); }

  // ── Contacts ───────────────────────────────────────────────────────────────
  addContact(): void {
    const v = this.patronRequestForm.contactInput.trim();
    if (v && !this.patronRequestForm.contacts.includes(v)) {
      this.patronRequestForm.contacts.push(v);
    }
    this.patronRequestForm.contactInput = '';
  }
  removeContact(i: number): void { this.patronRequestForm.contacts.splice(i, 1); }
  importContactsFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

    const pushEmails = (emails: string[]) => {
      let added = 0;
      emails.forEach(em => {
        if (!this.patronRequestForm.contacts.includes(em)) {
          this.patronRequestForm.contacts.push(em);
          added++;
        }
      });
      this.aiHint = `📎 ${added} contact(s) importé(s) depuis ${file.name}.`;
      this.cd.markForCheck();
      (event.target as HTMLInputElement).value = '';
    };

    if (ext === 'xls' || ext === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target?.result as ArrayBuffer), { type: 'array' });
          const emails: string[] = [];
          wb.SheetNames.forEach((name: string) => {
            const ws = wb.Sheets[name];
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            rows.forEach(row => row.forEach(cell => {
              const matches = String(cell).match(emailRegex);
              if (matches) emails.push(...matches);
            }));
          });
          pushEmails(emails);
        } catch (err) {
          this.aiHint = '⚠️ Impossible de lire le fichier Excel.';
          this.cd.markForCheck();
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV ou TXT : lecture texte brute + extraction regex
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string || '';
        const matches = text.match(emailRegex) || [];
        pushEmails(matches);
      };
      reader.readAsText(file);
    }
  }

  // ── Attachments ────────────────────────────────────────────────────────────
  addAttachments(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    files.forEach(f => {
      if (!this.patronRequestForm.attachments.find(a => a.name === f.name)) {
        this.patronRequestForm.attachments.push({ name: f.name, size: f.size, type: f.type, file: f });
      }
    });
    this.cd.markForCheck();
  }
  removeAttachment(i: number): void { this.patronRequestForm.attachments.splice(i, 1); }

  getFileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
      pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
      csv: '📋', mp3: '🎵', mp4: '🎬', png: '🖼', jpg: '🖼',
      jpeg: '🖼', gif: '🖼', ppt: '📊', pptx: '📊',
    };
    return map[ext] || '📎';
  }
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  submitPatronRequest(): void {
    if (this.saving) return;
    if (!this.patronRequestForm.title.trim()) { this.patronRequestError = 'Le titre est obligatoire.'; return; }
    if (!this.patronRequestForm.description.trim()) { this.patronRequestError = 'La description est obligatoire.'; return; }
    if (!this.scrumCard) { this.patronRequestError = 'Aucun Scrum Manager dans l\'équipe.'; return; }
    const isScheduled = this.patronRequestForm.schedulingMode === 'scheduled';
    if (isScheduled && !this.patronRequestForm.scheduledAt) { this.patronRequestError = 'Veuillez choisir une date de programmation.'; return; }

    this.saving = true; this.patronRequestError = '';
    const teamId = this.patronRequestForm.teamId || this.selectedTeamId;
    const contactsNote = this.patronRequestForm.contacts.length
      ? `\n\nDestinataires (${this.patronRequestForm.contacts.length}) : ${this.patronRequestForm.contacts.join(', ')}`
      : '';
    const resultNote = this.patronRequestForm.expectedResult
      ? `\n\nRésultat attendu : ${this.patronRequestForm.expectedResult}` : '';
    const attachNote = this.patronRequestForm.attachments.length
      ? `\n\nPièces jointes : ${this.patronRequestForm.attachments.map(a => a.name).join(', ')}` : '';

    // Collecter toutes les URLs de médias produits pour que l'agent les passe à post_social
    const productMediaUrls: string[] = [];
    if (this.selectedProductCodes.length) {
      this.selectedProductCodes.forEach(code => {
        this.getProductMedia(code).forEach(m => productMediaUrls.push(m.url));
      });
    }
    const mediaNote = productMediaUrls.length
      ? `\n\nMédias produit à joindre au post (paramètre mediaUrls de post_social) : ${JSON.stringify(productMediaUrls)}\nIMPORTANT : tu DOIS inclure ces URLs dans le paramètre mediaUrls lors de l'appel à post_social afin que les images apparaissent dans la publication.`
      : '';

    const fullDesc = this.patronRequestForm.description.trim() + resultNote + contactsNote + attachNote + mediaNote;

    const payload: any = {
      title: this.patronRequestForm.title.trim(),
      description: fullDesc,
      type: this.patronRequestForm.type,
      priority: this.patronRequestForm.priority,
      source: isScheduled ? 'SCHEDULED' : 'MANUAL',
      assignedAgentId: this.scrumCard.id,
      payload: JSON.stringify({ semiAutomatic: this.patronRequestForm.semiAutomatic }),
    };
    if (teamId) payload.teamId = teamId;
    if (this.patronRequestForm.dueDate) payload.dueDate = this.patronRequestForm.dueDate;
    if (isScheduled && this.patronRequestForm.scheduledAt) {
      payload.scheduledAt = this.patronRequestForm.scheduledAt;
    }
    if (this.patronRequestForm.type === 'PRODUCT_PROMOTION') {
      if (this.selectedProductCodes.length) payload.productCodes = this.selectedProductCodes;
      if (this.patronRequestForm.platforms.length) payload.platforms = this.patronRequestForm.platforms;
      if (this.patronRequestForm.hashtags) payload.hashtags = this.patronRequestForm.hashtags;
      if (this.patronRequestForm.tone) payload.tone = this.patronRequestForm.tone;
      if (this.patronRequestForm.campaignObjective) payload.campaignObjective = this.patronRequestForm.campaignObjective;
    }

    this.http.post<any>(`${API}/api/tasks`, payload).subscribe({
      next: (task) => {
        this.myTasks.unshift({
          id: task.id, title: task.title, description: task.description,
          priority: task.priority, status: task.status, type: task.type,
          dueDate: task.dueDate, createdAt: task.createdAt,
          assignedAgentId: task.assignedAgentId,
        });
        this.workflowStep = 1;
        this.activeTaskStatus = 'PENDING';
        this.activeTaskStatusLabel = this.taskStatusLabel('PENDING');
        // Compute analysis and show analysis step (avant le streaming)
        const bestAgent = this.findBestAgentStrict(task.type) || this.scrumCard;
        this.patronAnalysis = {
          analyzing: false,
          skill: this.detectSkill(task.type),
          agentName: bestAgent?.name || this.scrumCard?.name || 'Scrum Manager',
          agentType: bestAgent?.agentType || 'SCRUM_MASTER',
          time: this.estimateTime(task.type, task.priority),
          priority: task.priority,
          priorityLabel: { LOW: 'Basse', MEDIUM: 'Normale', HIGH: 'Haute', URGENT: 'Urgente', CRITICAL: 'Critique' }[task.priority as string] || task.priority,
          taskId: task.id,
          taskTitle: task.title,
        };
        this.saving = false;
        this.patronRequestModal.step = 'analysis';
        this.cd.markForCheck();

        // Démarrer le polling du statut tâche (toutes les 5s)
        this.startTaskPolling(task.id);

        // Démarrer le streaming SSE de la réponse du Scrum
        if (this.scrumCard) {
          const contacts = this.patronRequestForm.contacts;
          const contactsBlock = contacts.length
            ? `DESTINATAIRES (${contacts.length}) : ${contacts.join(', ')}\n→ Transmettre CES adresses exactes à l'agent, une par une. Ne pas en inventer d'autres.`
            : `AUCUN destinataire fourni → si la tâche nécessite un envoi email, NE PAS envoyer et répondre au patron qu'aucune adresse n'a été fournie.`;
          const modeInstruction = this.patronRequestForm.semiAutomatic
            ? `2. MODE SEMI-AUTOMATIQUE : c'est TOI qui décides qui exécute réellement cette tâche. Utilise select_agent pour identifier le meilleur agent disponible (n'importe quel agent de l'équipe est autorisé), justifie brièvement ton choix, puis passe à l'étape 3.
`
            : `2. MODE MANUEL : ne prends AUCUNE initiative sur l'exécutant. N'utilise PAS select_agent. Réalise la tâche par l'agent de ton équipe dont la compétence correspond au type ${task.type}, ou exécute toi-même si la demande relève de ton rôle de coordinateur.
`;
          const scrumMsg = `Nouvelle demande du patron.
Titre : "${task.title}"
Type : ${task.type}
Priorité : ${task.priority}
Résultat attendu : ${this.patronRequestForm.expectedResult}
TaskId : ${task.id}

${contactsBlock}

Description :
${fullDesc}

Instructions (à exécuter dans l'ordre) :
1. Utilise update_task_status pour passer la tâche ${task.id} en IN_PROGRESS
${modeInstruction}3. Utilise delegate_to_agent en transmettant dans le champ "message" :
   - L'instruction complète de la tâche
   - ${contacts.length ? `Les ${contacts.length} adresse(s) email EXACTES : ${contacts.join(', ')}` : 'Aucun destinataire fourni — signaler l\'absence au patron sans envoyer'}
   - Le ton souhaité, les contraintes, le contenu attendu
4. Une fois le résultat obtenu, utilise deliver_result avec :
   - taskId : "${task.id}"
   - title : "${task.title}"
   - result : le résultat complet retourné par l'agent
   - agentName : le nom de l'agent qui a exécuté la tâche
   (deliver_result ferme automatiquement la tâche et dépose le rapport dans l'inbox du patron)
5. Si l'agent échoue, utilise update_task_status pour passer la tâche ${task.id} en FAILED.`;
          this.streamScrumResponse(this.scrumCard.id, scrumMsg, task.id);
        }
      },
      error: (e) => {
        this.patronRequestError = this.friendlyHttpError(e, 'Impossible de créer la tâche.');
        this.saving = false; this.cd.markForCheck();
      }
    });
  }

  toggleTasksPanel(): void {
    this.showTasksPanel = !this.showTasksPanel;
    if (this.showTasksPanel && this.myTasks.length === 0) this.loadMyTasks();
  }

  relaunchTask(task: TaskCard): void {
    this.showTasksPanel = false;
    this.patronRequestForm = {
      ...this.emptyRequestForm(),
      title:       task.title + ' (relance)',
      description: task.description || '',
      type:        task.type || 'GENERAL',
      priority:    task.priority || 'MEDIUM',
      teamId:      this.selectedTeamId || '',
    };
    this.descSource = 'none';
    this.aiHint     = '';
    this.patronRequestModal = { open: true, step: 'form' };
    this.patronRequestError = '';
    this.cd.markForCheck();
  }

  quickCreateTeam(): void {
    const name = this.quickTeamName.trim();
    if (!name) return;
    this.quickTeamSaving = true; this.quickTeamError = '';
    this.http.post<any>(`${API}/api/teams`, { name, description: '', teamType: 'BUSINESS' }).subscribe({
      next: (team) => {
        this.teams = [...this.teams, { id: team.id, name: team.name, description: team.description || '', status: 'ACTIVE', teamType: 'BUSINESS' }];
        this.createAgentForm.teamId = team.id;
        this.quickAddTeamMode = false;
        this.quickTeamName    = '';
        this.quickTeamSaving  = false;
        this.cd.markForCheck();
      },
      error: (e) => {
        this.quickTeamError  = this.friendlyHttpError(e, 'Création d\'équipe rapide impossible.');
        this.quickTeamSaving = false;
        this.cd.markForCheck();
      }
    });
  }

  loadMyTasks(): void {
    this.loadingTasks = true;
    this.http.get<any>(`${API}/api/tasks`).subscribe({
      next: (res) => {
        const list: any[] = Array.isArray(res) ? res : (res.content || []);
        this.myTasks = list.map(t => ({ id: t.id, title: t.title, description: t.description || '', priority: t.priority, status: t.status, type: t.type, dueDate: t.dueDate, createdAt: t.createdAt, assignedAgentId: t.assignedAgentId }));
        this.loadingTasks = false; this.cd.markForCheck();
      },
      error: () => { this.loadingTasks = false; this.cd.markForCheck(); }
    });
  }

  // ── Photo upload ───────────────────────────────────────────────────────────
  onCreatePhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadPhoto(file, url => this.createAgentForm.photoUrl = url);
  }
  onEditPhotoChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.uploadPhoto(file, url => { this.editForm.photoUrl = url; if (this.editModal.agent) this.editModal.agent.photoUrl = url; });
  }
  private uploadPhoto(file: File, onSuccess: (url: string) => void): void {
    this.uploadingPhoto = true;
    const form = new FormData();
    form.append('file', file);
    this.http.post<any>(`${API}/api/agents/upload-photo`, form).subscribe({
      next: (res) => { onSuccess(res.url); this.uploadingPhoto = false; this.cd.markForCheck(); },
      error: () => { this.uploadingPhoto = false; this.cd.markForCheck(); }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getPriorityColor(p: string): string  { return PRIORITY_COLOR[p] || '#94a3b8'; }
  getStatusColor(s: string): string    { return STATUS_COLOR[s]   || '#94a3b8'; }
  formatDate(d: string): string { try { return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d; } }

  private emptyForm(): EditForm {
    return { id: '', name: '', description: '', status: 'ACTIVE', agentType: '', model: 'llama-3.3-70b-versatile', temperature: 0.7, maxTokens: 2048, systemPrompt: '', photoUrl: '' };
  }
}
