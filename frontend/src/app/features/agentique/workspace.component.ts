import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DialogService } from '../../shared/ui/dialog.service';
import { AuthService } from '../../services/auth.service';
import { TipDirective } from '../../shared/ui/tooltip.directive';
import * as XLSX from 'xlsx';

const API = '';

type Tab = 'agents' | 'equipes' | 'taches' | 'inbox' | 'email' | 'prompts' | 'workflow' | 'chat' | 'llm' | 'rag' | 'canaux' | 'profil' | 'social' | 'studio';

/** Origine de la liste de modèles affichée à l'étape 2 de l'assistant LLM. */
type ModelCatalogSource = 'api' | 'provider-config' | 'none';

/** Le backend est la seule source de vérité : on n'invente pas de source. */
function normalizeModelSource(value: unknown): ModelCatalogSource {
  return value === 'api' || value === 'provider-config' ? value : 'none';
}

const AGENT_TYPES = [
  { v:'SCRUM_MASTER',      l:'Scrum Master' },
  { v:'EMAIL_MANAGER',     l:'Email Manager' },
  { v:'COMMUNITY_MANAGER', l:'Community Manager' },
  { v:'PROSPECTION',       l:'Prospection' },
  { v:'MARKETING',         l:'Marketing' },
  { v:'CUSTOMER_SUPPORT',  l:'Support Client' },
  { v:'CREATIVE_LEAD',     l:'Direction Créative' },
  { v:'RAG_DOCUMENT',      l:'Analyse Document' },
  { v:'CV_CREATOR',        l:'Créateur CV' },
  { v:'IMAGE_CREATOR',     l:'Création Image' },
  { v:'VIDEO_CREATOR',     l:'Création Vidéo' },
  { v:'SECURITY_AUDIT',          l:'Audit Sécurité' },
  { v:'ONLY_OFFICE',             l:'OnlyOffice' },
  { v:'ACCOUNTANT',              l:'Agent Comptable' },
  { v:'DOCUMENT_SUMMARIZER',     l:'Résumeur Documents' },
  { v:'PRESENTATION_CREATOR',    l:'Présentations & Slides' },
  { v:'SOCIAL_CONTENT_CREATOR',  l:'Contenu Réseaux Sociaux' },
];

const AGENT_TYPE_DETAILS = [
  { v:'SCRUM_MASTER',           icon:'🎯', l:'Scrum Master',               color:'#6366f1',
    resume: 'Chef d\'orchestre de l\'équipe IA',
    competences: ['Décomposer une demande complexe en sous-tâches','Assigner les tâches aux agents compétents','Superviser le workflow et relancer si besoin','Synthétiser les résultats en rapport final','Gérer les priorités et les délais'],
    usecases: ['Demande multi-agent (email + rapport + post social)','Coordination campagne marketing bout-en-bout','Gestion de projet agile IA'],
    limits: 'N\'exécute pas lui-même — coordonne et délègue uniquement.' },
  { v:'EMAIL_MANAGER',          icon:'📧', l:'Email Manager',               color:'#0ea5e9',
    resume: 'Spécialiste de la communication email professionnelle',
    competences: ['Rédiger des emails professionnels avec votre signature','Répondre aux emails entrants avec le bon ton','Classer et transférer les messages','Relancer automatiquement les contacts','Personnaliser le contenu par destinataire'],
    usecases: ['Campagne d\'emailing personnalisée','Relance clients inactifs','Réponse automatique SAV','Invitation à un événement'],
    limits: 'Nécessite une adresse email configurée dans les canaux.' },
  { v:'COMMUNITY_MANAGER',      icon:'📱', l:'Community Manager',           color:'#ec4899',
    resume: 'Expert en gestion des réseaux sociaux',
    competences: ['Créer des publications pour LinkedIn, Instagram, Facebook','Rédiger des réponses aux commentaires','Planifier le calendrier éditorial','Analyser les métriques d\'engagement','Adapter le ton à chaque réseau'],
    usecases: ['Publication quotidienne automatisée','Réponse aux avis clients','Veille concurrentielle','Lancement de produit sur les réseaux'],
    limits: 'Publication effective requiert connexion API réseau social.' },
  { v:'PROSPECTION',            icon:'🎣', l:'Prospection',                 color:'#f59e0b',
    resume: 'Chasseur de prospects qualifiés B2B/B2C',
    competences: ['Construire des listes de prospects ciblés','Qualifier les contacts selon vos critères','Rédiger des messages d\'approche personnalisés','Séquencer des campagnes de prospection','Analyser les taux de conversion'],
    usecases: ['Prospection commerciale par email','Identification de leads sur LinkedIn','Campagne de cold emailing','Extension du portefeuille clients'],
    limits: 'Scraping web limité selon disponibilité des sources configurées.' },
  { v:'MARKETING',              icon:'📣', l:'Marketing',                   color:'#10b981',
    resume: 'Stratège en communication et marketing digital',
    competences: ['Créer des plans de communication complets','Rédiger des copies publicitaires (Facebook Ads, Google Ads)','Analyser les marchés et la concurrence','Concevoir des tunnels de vente','Produire des contenus SEO-optimisés'],
    usecases: ['Plan marketing trimestriel','Campagne publicitaire digitale','Audit de positionnement','Brief créatif pour une agence'],
    limits: 'Nécessite des données produits et cibles bien renseignées.' },
  { v:'CUSTOMER_SUPPORT',       icon:'🎧', l:'Support Client',              color:'#8b5cf6',
    resume: 'Agent de support client multicanal',
    competences: ['Répondre aux tickets clients (email, chat)','Mettre à jour les FAQ automatiquement','Gérer les escalades et réclamations','Suivre les demandes en cours','Proposer des solutions ou remboursements'],
    usecases: ['Réponse aux réclamations produit','Mise à jour base de connaissances','Rapport hebdomadaire du support','Détection de clients à risque de churn'],
    limits: 'Intégration CRM requise pour accès à l\'historique client.' },
  { v:'CREATIVE_LEAD',          icon:'✍️', l:'Direction Créative',          color:'#f97316',
    resume: 'Créateur de contenu textuel haute qualité',
    competences: ['Rédiger des articles de blog et contenus long-format','Créer des scripts vidéo et podcasts','Concevoir des slogans et identités verbales','Écrire des storytellings de marque','Produire des newsletters engageantes'],
    usecases: ['Article de blog SEO 2000 mots','Script publicitaire 30 secondes','Charte éditoriale de marque','Newsletter hebdomadaire'],
    limits: 'Génère du texte uniquement — pas d\'images ni vidéos.' },
  { v:'RAG_DOCUMENT',           icon:'🔍', l:'Analyse Document',            color:'#06b6d4',
    resume: 'Expert en extraction et analyse documentaire (RAG)',
    competences: ['Indexer et analyser des documents PDF, Word, Excel','Répondre à des questions précises sur un document','Extraire des données structurées','Comparer plusieurs documents','Créer des résumés exécutifs'],
    usecases: ['Analyse de contrat juridique','Extraction de données financières','Q&A sur documentation technique','Synthèse de rapport d\'audit'],
    limits: 'Documents doivent être uploadés dans le module RAG au préalable.' },
  { v:'CV_CREATOR',             icon:'📄', l:'Créateur CV',                 color:'#64748b',
    resume: 'Spécialiste en rédaction de CV et profils professionnels',
    competences: ['Créer un CV professionnel optimisé ATS','Rédiger des lettres de motivation percutantes','Optimiser le profil LinkedIn','Adapter le CV à une offre d\'emploi spécifique','Mettre en valeur les compétences clés'],
    usecases: ['CV cadre dirigeant','Lettre de motivation ciblée','Profil LinkedIn optimisé','Dossier complet candidature senior'],
    limits: 'Utilise les informations fournies — pas de recherche de données manquantes.' },
  { v:'IMAGE_CREATOR',          icon:'🎨', l:'Création Image',              color:'#a855f7',
    resume: 'Générateur d\'images et de visuels IA',
    competences: ['Générer des images réalistes à partir d\'un prompt','Créer des illustrations et icônes','Retoucher et améliorer des photos existantes','Upscaler des images basse résolution','Créer des maquettes produits'],
    usecases: ['Visuels pour campagne pub','Illustration d\'article de blog','Photo produit e-commerce','Avatar et identité visuelle'],
    limits: 'Qualité dépend du modèle image configuré (Stable Diffusion, DALL-E…).' },
  { v:'VIDEO_CREATOR',          icon:'🎬', l:'Création Vidéo',              color:'#ef4444',
    resume: 'Producteur et éditeur de contenu vidéo',
    competences: ['Transcrire des vidéos et audios en texte','Créer des sous-titres automatiques','Résumer des contenus vidéo','Générer des scripts vidéo','Extraire des clips pertinents'],
    usecases: ['Transcription interview','Sous-titrage automatique','Résumé de webinaire','Script YouTube'],
    limits: 'Génération vidéo native limitée aux workers configurés.' },
  { v:'SECURITY_AUDIT',         icon:'🛡️', l:'Audit Sécurité',              color:'#dc2626',
    resume: 'Expert en cybersécurité et audit de conformité',
    competences: ['Scanner les vulnérabilités applicatives','Détecter les secrets et credentials exposés','Analyser les configurations serveur','Produire des rapports de conformité (RGPD, ISO 27001)','Recommander des corrections priorisées'],
    usecases: ['Audit pré-déploiement','Rapport conformité RGPD','Scan de credentials dans le code','Revue de sécurité infrastructure'],
    limits: 'Scan limité aux accès et tokens configurés dans les canaux.' },
  { v:'ONLY_OFFICE',            icon:'📝', l:'OnlyOffice',                  color:'#0f766e',
    resume: 'Créateur et éditeur de documents Office collaboratifs',
    competences: ['Créer des documents Word/Excel/PowerPoint','Remplir des templates avec des données dynamiques','Convertir des formats de fichiers','Générer des tableaux et graphiques Excel','Produire des rapports structurés'],
    usecases: ['Rapport mensuel automatisé','Tableau de bord Excel dynamique','Présentation PowerPoint sur-mesure','Contrat pré-rempli depuis un template'],
    limits: 'Nécessite que le service OnlyOffice soit actif dans Docker.' },
  { v:'ACCOUNTANT',             icon:'💰', l:'Agent Comptable',             color:'#15803d',
    resume: 'Analyste financier et comptable certifié',
    competences: ['Produire des états financiers (bilan, compte de résultat)','Analyser les flux de trésorerie','Appliquer les normes OHADA, IFRS et PCG','Créer des tableaux de bord financiers','Calculer les ratios et indicateurs clés'],
    usecases: ['Rapport comptable mensuel','Analyse de rentabilité produit','Budget prévisionnel','Déclaration fiscale synthèse'],
    limits: 'Analyse basée sur les données fournies — pas de connexion ERP directe.' },
  { v:'DOCUMENT_SUMMARIZER',    icon:'📋', l:'Résumeur Documents',          color:'#0284c7',
    resume: 'Spécialiste en synthèse et extraction d\'information',
    competences: ['Résumer des documents longs (50+ pages)','Extraire les points clés et décisions','Créer des fiches de synthèse structurées','Comparer des versions de documents','Répondre à des questions précises par Q&A'],
    usecases: ['Synthèse d\'appel d\'offres','Résumé de rapport annuel','Fiche de lecture académique','Comparatif de contrats'],
    limits: 'Optimisé pour les textes — tableaux complexes peuvent nécessiter un retraitement.' },
  { v:'PRESENTATION_CREATOR',   icon:'🖼️', l:'Présentations & Slides',      color:'#7c3aed',
    resume: 'Expert en création de présentations percutantes',
    competences: ['Structurer un pitch deck en quelques slides','Créer un plan de présentation logique','Rédiger les textes de chaque slide','Suggérer des visuels et data-vizes','Adapter le style à l\'audience (investisseur, client, interne)'],
    usecases: ['Pitch deck investisseurs','Présentation client','Support de formation','Rapport de performance trimestriel'],
    limits: 'Produit la structure et le contenu texte — mise en page finale via OnlyOffice ou PowerPoint.' },
  { v:'SOCIAL_CONTENT_CREATOR', icon:'🚀', l:'Contenu Réseaux Sociaux',     color:'#db2777',
    resume: 'Créateur de contenu viral pour tous les réseaux',
    competences: ['Rédiger des posts LinkedIn engageants','Créer des captions Instagram avec hashtags','Produire des tweets/threads percutants','Adapter le message selon la plateforme','Créer des calendriers éditoriaux'],
    usecases: ['Stratégie contenu 30 jours','Annonce lancement produit','Thread Twitter viral','Série de posts LinkedIn expert'],
    limits: 'Publication effective requiert connexion API réseau social ou Community Manager.' },
];

const TASK_STATUSES = ['PENDING','QUEUED','IN_PROGRESS','DONE','FAILED','CANCELLED'];
const PRIORITIES    = ['LOW','MEDIUM','HIGH','URGENT','CRITICAL'];

const TASK_AGENT_MAP: Record<string, string[]> = {
  'GENERAL':           ['SCRUM_MASTER','EMAIL_MANAGER','COMMUNITY_MANAGER','MARKETING','PROSPECTION','CUSTOMER_SUPPORT','CREATIVE_LEAD','RAG_DOCUMENT','CV_CREATOR','IMAGE_CREATOR','VIDEO_CREATOR','SECURITY_AUDIT','ONLY_OFFICE','ACCOUNTANT','DOCUMENT_SUMMARIZER','PRESENTATION_CREATOR','SOCIAL_CONTENT_CREATOR'],
  'CONTENT_GENERATE':  ['CREATIVE_LEAD','SOCIAL_CONTENT_CREATOR','MARKETING'],
  'DOCUMENT_SUMMARIZE':['DOCUMENT_SUMMARIZER','RAG_DOCUMENT'],
  'EMAIL_RESPONSE':    ['EMAIL_MANAGER'],
  'MARKETING':         ['MARKETING','EMAIL_MANAGER','SOCIAL_CONTENT_CREATOR'],
  'PROSPECTION':       ['PROSPECTION','EMAIL_MANAGER'],
  'CAMPAIGN_CREATE':   ['MARKETING','EMAIL_MANAGER','COMMUNITY_MANAGER','SOCIAL_CONTENT_CREATOR'],
  'PROSPECT_SEARCH':   ['PROSPECTION'],
  'REPORT_GENERATE':   ['CREATIVE_LEAD','DOCUMENT_SUMMARIZER','ACCOUNTANT','ONLY_OFFICE'],
  'PRESENTATION_CREATE':['PRESENTATION_CREATOR','CREATIVE_LEAD','ONLY_OFFICE'],
  'DOCUMENT_PDF':      ['ONLY_OFFICE','CREATIVE_LEAD'],
  'ACCOUNTING_REPORT': ['ACCOUNTANT','ONLY_OFFICE'],
  'CV_CREATE':         ['CV_CREATOR'],
  'SOCIAL_CONTENT':    ['SOCIAL_CONTENT_CREATOR','COMMUNITY_MANAGER','CREATIVE_LEAD'],
  'IMAGE_CREATE':      ['IMAGE_CREATOR','CREATIVE_LEAD'],
  'VIDEO_CREATE':      ['VIDEO_CREATOR'],
  'FLYER_CREATE':      ['IMAGE_CREATOR','CREATIVE_LEAD'],
  'SECURITY_AUDIT':    ['SECURITY_AUDIT'],
  'CUSTOMER_SUPPORT':  ['CUSTOMER_SUPPORT'],
  'ACCOUNTING':        ['ACCOUNTANT'],
  'SCRUM':             ['SCRUM_MASTER'],
  'PRODUCT_PROMOTION': ['COMMUNITY_MANAGER','SOCIAL_CONTENT_CREATOR','MARKETING','CREATIVE_LEAD'],
};

const AGENT_TASK_LABELS: Record<string, string[]> = {
  'SCRUM_MASTER':          ['Coordination multi-agents','Gestion de projet Scrum'],
  'EMAIL_MANAGER':         ['Réponse email','Marketing','Prospection','Campagne emailing'],
  'COMMUNITY_MANAGER':     ['Contenu réseaux sociaux','Campagne sociale'],
  'PROSPECTION':           ['Prospection commerciale','Recherche de prospects'],
  'MARKETING':             ['Campagne Marketing','Campagne','Contenu marketing'],
  'CUSTOMER_SUPPORT':      ['Support client'],
  'CREATIVE_LEAD':         ['Génération de contenu','Flyer','Présentation','Rapport','Image'],
  'RAG_DOCUMENT':          ['Analyse documentaire','Résumé de document'],
  'CV_CREATOR':            ['Création de CV'],
  'IMAGE_CREATOR':         ['Création d\'image','Infographie','Flyer'],
  'VIDEO_CREATOR':         ['Création de vidéo'],
  'SECURITY_AUDIT':        ['Audit sécurité'],
  'ONLY_OFFICE':           ['Document PDF','Rapport Office','Présentation PPTX'],
  'ACCOUNTANT':            ['Comptabilité','Rapport comptable'],
  'DOCUMENT_SUMMARIZER':   ['Résumé de document','Analyse documentaire'],
  'PRESENTATION_CREATOR':  ['Présentation / Slides','Pitch deck'],
  'SOCIAL_CONTENT_CREATOR':['Contenu réseaux sociaux','Campagne sociale'],
};

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TipDirective],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
<div class="ws-page" [class.ws-sidebar-collapsed]="sidebarCollapsed">

  <!-- ── Sidebar verticale pliable ─────────────────────────────────────── -->
  <aside class="ws-sidebar" [class.ws-sidebar--collapsed]="sidebarCollapsed" aria-label="Navigation workspace">
    <!-- Toggle collapse -->
    <button class="ws-sb-toggle" (click)="sidebarCollapsed = !sidebarCollapsed"
            [attr.aria-label]="sidebarCollapsed ? 'Déplier le menu' : 'Replier le menu'"
            [tip]="sidebarCollapsed ? 'Déplier' : 'Replier'" tipSide="right">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
        <path *ngIf="!sidebarCollapsed" d="M15 18l-6-6 6-6"/>
        <path *ngIf="sidebarCollapsed"  d="M9 18l6-6-6-6"/>
      </svg>
    </button>

    <!-- Navigation items -->
    <nav class="ws-sb-nav">
      <button *ngFor="let t of tabs"
              class="ws-sb-item"
              [class.ws-sb-item--active]="activeTab === t.id"
              (click)="switchTab(t.id)"
              [tip]="sidebarCollapsed ? (t.label + '\n' + t.hint) : ''"
              tipSide="right">
        <span class="ws-sb-icon">{{ t.icon }}</span>
        <span class="ws-sb-label">{{ t.label }}</span>
        <span *ngIf="t.count && t.count > 0" class="ws-tab-badge ws-sb-badge">{{ t.count }}</span>
      </button>
    </nav>
  </aside>

  <!-- ── Zone de contenu principale ────────────────────────────────────── -->
  <div class="ws-content-area">
    <div class="ws-wrap">

    <!-- Header -->
    <div class="ws-header">
      <div class="ws-header-row">
        <button class="ws-tabs-btn" (click)="toggleTabsMenu()" [attr.aria-expanded]="tabsMenuOpen" [attr.aria-label]="tabsMenuOpen ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation'">
          <svg *ngIf="!tabsMenuOpen" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          <svg *ngIf="tabsMenuOpen" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <a routerLink="/agentique/teams" class="ws-back-btn">← Équipes</a>
        <div class="ws-badge"><span class="ws-dot"></span>Espace de travail</div>
        <button class="ws-theme-toggle-btn" (click)="toggleTheme()" [tip]="isDark ? 'Basculer en mode clair' : 'Basculer en mode sombre'" tipSide="bottom">
          <span>{{ isDark ? '☀️' : '🌙' }}</span>
          <span>{{ isDark ? 'Clair' : 'Sombre' }}</span>
        </button>
        <span class="ws-user-label">{{ userName }}</span>
      </div>
      <h1 class="ws-title">TABLEAU DE BORD</h1>
      <p class="ws-sub">Gérez vos agents, équipes, tâches, canaux et workflows</p>
    </div>

    <!-- Drawer menu onglets (mobile uniquement) -->
    <div class="ws-tab-backdrop" [class.open]="tabsMenuOpen" (click)="tabsMenuOpen = false"></div>
    <aside class="ws-tab-drawer" [class.open]="tabsMenuOpen" [attr.aria-hidden]="!tabsMenuOpen">
      <div class="ws-tab-drawer-head">
        <span class="ws-tab-drawer-ttl">⚡ Espace de travail</span>
        <button class="ws-tab-drawer-close" (click)="tabsMenuOpen = false" aria-label="Fermer le menu">✕</button>
      </div>
      <nav class="ws-tab-drawer-list">
        <button *ngFor="let t of tabs" class="ws-tab ws-tab--drawer" [class.ws-tab--active]="activeTab === t.id"
                (click)="switchTab(t.id)" tipSide="right" [tip]="t.label + '\\n' + t.hint">
          <span class="ws-tab-icon">{{ t.icon }}</span>{{ t.label }}
          <span *ngIf="t.count && t.count > 0" class="ws-tab-badge">{{ t.count }}</span>
        </button>
      </nav>
    </aside>

    <!-- ── Agents Tab ─────────────────────────────────────────────────────── -->
    <div *ngIf="activeTab === 'agents'" class="ws-panel">
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">🤖 Agents IA</span>
        <div class="ws-panel-hdr-actions">
          <button class="ws-btn-secondary" (click)="showAgentTypesModal = true">ℹ Types d'agents</button>
          <button class="ws-btn-primary" (click)="toggleQuickAdd('agent')">
            {{ quickAdd === 'agent' ? '✕ Fermer' : '＋ Nouvel agent' }}
          </button>
        </div>
      </div>

      <!-- Quick Add Agent -->
      <div *ngIf="quickAdd === 'agent'" class="ws-quick-form">
        <div class="ws-qf-grid">
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Nom *</label>
            <input class="ws-input" [(ngModel)]="agentForm.name" placeholder="Ex: Agent Email Pro" (keyup.enter)="saveAgent()"/>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Type *</label>
            <select class="ws-input" [(ngModel)]="agentForm.type" (ngModelChange)="cd.markForCheck()">
              <option *ngFor="let t of agentTypes" [value]="t.v">{{ t.l }}</option>
            </select>
            <div *ngIf="agentForm.type && agentTaskLabels(agentForm.type).length" class="ws-agent-type-hint">
              Tâches traitées : {{ agentTaskLabels(agentForm.type).join(' · ') }}
            </div>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Équipe</label>
            <div style="display:flex;gap:.4rem;">
              <!-- Pas d'option « sans équipe » : un agent dérive son modèle de son
                   équipe, il ne peut pas en être détaché. -->
              <select class="ws-input" [(ngModel)]="agentForm.teamId" style="flex:1">
                <option *ngFor="let t of teams" [value]="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div *ngIf="!teams.length" class="ws-error">
              Créez d'abord une équipe : un agent doit appartenir à une équipe pour
              hériter d'un modèle.
            </div>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Description</label>
            <input class="ws-input" [(ngModel)]="agentForm.description" placeholder="Rôle de l'agent…"/>
          </div>
        </div>
        <div *ngIf="formError" class="ws-error">{{ formError }}</div>
        <div class="ws-qf-actions">
          <button class="ws-btn-cancel" (click)="quickAdd = ''">Annuler</button>
          <button class="ws-btn-primary" (click)="saveAgent()" [disabled]="saving">
            <span *ngIf="!saving">{{ editingId ? "Mettre à jour" : "Créer l'agent" }}</span>
            <span *ngIf="saving" class="ws-spin"></span>
          </button>
        </div>
      </div>

      <!-- Search + filter -->
      <div class="ws-search-row">
        <input class="ws-search" [(ngModel)]="searchAgents" placeholder="🔍 Rechercher un agent…"/>
        <select class="ws-filter-sel" [(ngModel)]="filterAgentTeam">
          <option value="">Toutes les équipes</option>
          <option *ngFor="let t of teams" [value]="t.id">{{ t.name }}</option>
        </select>
        <select class="ws-filter-sel" [(ngModel)]="filterAgentType">
          <option value="">Tous les types</option>
          <option *ngFor="let t of agentTypes" [value]="t.v">{{ t.l }}</option>
        </select>
      </div>

      <div *ngIf="loadingAgents" class="ws-loading"><div class="ws-spinner"></div></div>
      <div *ngIf="!loadingAgents && filteredAgents.length === 0" class="ws-empty">Aucun agent trouvé.</div>
      <div class="ws-table-wrap" *ngIf="!loadingAgents && filteredAgents.length > 0">
        <table class="ws-table">
          <thead><tr>
            <th>Agent</th><th>Code</th><th>Type</th><th>Équipe</th><th>Statut</th><th>Actions</th>
          </tr></thead>
          <tbody>
            <tr *ngFor="let a of filteredAgents">
              <td data-label="Agent">
                <div class="ws-agent-cell">
                  <img *ngIf="a.avatarUrl || a.photoUrl" [src]="a.avatarUrl || a.photoUrl" class="ws-agent-avatar"/>
                  <div *ngIf="!a.avatarUrl && !a.photoUrl" class="ws-agent-initials">{{ a.name[0] }}</div>
                  <div>
                    <div class="ws-cell-name">{{ a.name }}</div>
                    <div class="ws-cell-sub">{{ a.description | slice:0:50 }}</div>
                  </div>
                </div>
              </td>
              <td data-label="Code"><span class="ws-code-badge">{{ a.code || '—' }}</span></td>
              <td data-label="Type"><span class="ws-type-badge">{{ agentTypeLabel(a.type || a.agentType) }}</span></td>
              <td data-label="Équipe">{{ getTeamName(a.teamId) || '—' }}</td>
              <td data-label="Statut"><span class="ws-status-dot" [class.ws-status-dot--active]="a.status==='ACTIVE'" [class.ws-status-dot--paused]="a.status==='PAUSED'">{{ a.status === 'ACTIVE' ? 'Actif' : a.status === 'PAUSED' ? 'Pausé' : a.status }}</span></td>
              <td data-label="Actions">
                <div class="ws-row-actions">
                  <button class="ws-act-btn ws-act-edit" (click)="editAgent(a)" title="Modifier">✏</button>
                  <button class="ws-act-btn ws-act-del" (click)="deleteAgent(a)" title="Supprimer">🗑</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Équipes Tab ─────────────────────────────────────────────────────── -->
    <div *ngIf="activeTab === 'equipes'" class="ws-panel">
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">🏢 Équipes</span>
        <button class="ws-btn-primary" (click)="toggleQuickAdd('team')">
          {{ quickAdd === 'team' ? '✕ Fermer' : '＋ Nouvelle équipe' }}
        </button>
      </div>

      <!-- Quick Add Team -->
      <div *ngIf="quickAdd === 'team'" class="ws-quick-form">
        <div class="ws-qf-grid">
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Nom *</label>
            <input class="ws-input" [(ngModel)]="teamForm.name" placeholder="Ex: Équipe Marketing" (keyup.enter)="saveTeam()"/>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Description</label>
            <input class="ws-input" [(ngModel)]="teamForm.description" placeholder="Description de l'équipe…"/>
          </div>
        </div>
        <div *ngIf="formError" class="ws-error">{{ formError }}</div>
        <div class="ws-qf-actions">
          <button class="ws-btn-cancel" (click)="quickAdd = ''">Annuler</button>
          <button class="ws-btn-primary" (click)="saveTeam()" [disabled]="saving">
            <span *ngIf="!saving">{{ editingId ? "Mettre à jour" : "Créer l'équipe" }}</span>
            <span *ngIf="saving" class="ws-spin"></span>
          </button>
        </div>
      </div>

      <input class="ws-search" style="margin-bottom:.75rem" [(ngModel)]="searchTeams" placeholder="🔍 Rechercher une équipe…"/>
      <div *ngIf="loadingTeams" class="ws-loading"><div class="ws-spinner"></div></div>
      <div class="ws-table-wrap" *ngIf="!loadingTeams">
        <table class="ws-table">
          <thead><tr><th>Équipe</th><th>Agents</th><th>Créée le</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let t of filteredTeams">
              <td data-label="Équipe">
                <div class="ws-cell-name">{{ t.name }}</div>
                <div class="ws-cell-sub">{{ t.description }}</div>
              </td>
              <td data-label="Agents"><span class="ws-count-badge">{{ t.agentCount ?? 0 }} agents</span></td>
              <td data-label="Créée le">{{ t.createdAt ? (t.createdAt | date:'dd/MM/yy') : '—' }}</td>
              <td data-label="Actions">
                <div class="ws-row-actions">
                  <button class="ws-act-btn ws-act-edit" (click)="editTeam(t)">✏</button>
                  <button class="ws-act-btn ws-act-del" (click)="deleteTeam(t)">🗑</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="filteredTeams.length === 0" class="ws-empty">Aucune équipe.</div>
      </div>
    </div>

    <!-- ── Tâches Tab ──────────────────────────────────────────────────────── -->
    <div *ngIf="activeTab === 'taches'" class="ws-panel">
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">📋 Tâches</span>
        <div class="ws-panel-hdr-actions">
          <select class="ws-filter-sel" [(ngModel)]="filterTaskStatus">
            <option value="">Tous les statuts</option>
            <option *ngFor="let s of taskStatuses" [value]="s">{{ s }}</option>
          </select>
          <select class="ws-filter-sel" [(ngModel)]="filterTaskPriority">
            <option value="">Toutes priorités</option>
            <option *ngFor="let p of priorities" [value]="p">{{ p }}</option>
          </select>
          <button class="ws-btn-secondary" (click)="loadTasks()" [disabled]="loadingTasks">↻ Rafraîchir</button>
        </div>
      </div>

      <input class="ws-search" style="margin-bottom:.75rem" [(ngModel)]="searchTasks" placeholder="🔍 Rechercher une tâche…"/>
      <div *ngIf="loadingTasks" class="ws-loading"><div class="ws-spinner"></div></div>

      <ng-container *ngIf="!loadingTasks">
        <div *ngIf="groupedFilteredTasks.length === 0" class="ws-empty">Aucune tâche.</div>

        <div *ngFor="let group of groupedFilteredTasks; trackBy: trackByGroupKey" class="ws-task-group">
          <!-- En-tête de groupe cliquable -->
          <div class="ws-task-group-header" (click)="toggleTaskGroup(group.key)">
            <span class="ws-task-group-icon">{{ group.icon }}</span>
            <span class="ws-task-group-label">{{ group.label }}</span>
            <span class="ws-task-group-count">{{ group.tasks.length }}</span>
            <span class="ws-task-group-chevron" [class.ws-task-group-chevron--open]="!collapsedGroups.has(group.key)">›</span>
          </div>

          <!-- Table du groupe -->
          <div class="ws-task-group-body" *ngIf="!collapsedGroups.has(group.key)">
            <table class="ws-table">
              <thead><tr><th>Titre</th><th>Code</th><th>Priorité</th><th>Statut</th><th>Créée</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let t of group.tasks; trackBy: trackByTaskId">
                  <td data-label="Titre">
                    <div class="ws-cell-name">{{ t.title }}</div>
                    <div *ngIf="t.platforms" class="ws-promo-platforms-row">
                      <span *ngFor="let pl of parsePlatforms(t.platforms)" class="ws-promo-platform-tag">{{ pl }}</span>
                    </div>
                    <div *ngIf="!t.platforms" class="ws-cell-sub">{{ t.description | slice:0:60 }}</div>
                  </td>
                  <td data-label="Code"><span class="ws-code-badge">{{ t.code || '—' }}</span></td>
                  <td data-label="Priorité"><span class="ws-priority" [attr.data-p]="t.priority">{{ t.priority }}</span></td>
                  <td data-label="Statut">
                    <select class="ws-status-sel" [(ngModel)]="t.status" (ngModelChange)="updateTaskStatus(t, $event)">
                      <option *ngFor="let s of taskStatuses" [value]="s">{{ s }}</option>
                    </select>
                  </td>
                  <td data-label="Créée">{{ t.createdAt ? (t.createdAt | date:'dd/MM/yy HH:mm') : '—' }}</td>
                  <td data-label="Actions">
                    <div class="ws-row-actions">
                      <button class="ws-act-btn ws-act-del" (click)="deleteTask(t)" title="Supprimer">🗑</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
    </div>

    <!-- ── Email Tab ─────────────────────────────────────────────────────── -->
    <div *ngIf="activeTab === 'email'" class="ws-panel">
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">📧 Email — Réponses IA</span>
        <button class="ws-btn-secondary" (click)="loadInbox()">↻ Rafraîchir</button>
      </div>
      <div *ngIf="loadingInbox" class="ws-loading"><div class="ws-spinner"></div></div>
      <div class="ws-table-wrap" *ngIf="!loadingInbox">
        <table class="ws-table">
          <thead><tr><th>Objet</th><th>De</th><th>Agent</th><th>Statut</th><th>Reçu</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let item of inboxItems">
              <td data-label="Objet">
                <div class="ws-cell-name">{{ item.subject || '(sans objet)' }}</div>
                <div class="ws-cell-sub">{{ item.body | slice:0:80 }}</div>
              </td>
              <td data-label="De">{{ item.fromAddress || '—' }}</td>
              <td data-label="Agent">
                <ng-container *ngIf="getAgentById(item.agentId) as ag; else agentFallback">
                  <div class="ws-cell-name" style="font-size:.85rem">{{ ag.name }}</div>
                  <span class="ws-type-badge">{{ agentTypeLabel(ag.type || ag.agentType) }}</span>
                </ng-container>
                <ng-template #agentFallback>{{ item.agentId || '—' }}</ng-template>
              </td>
              <td data-label="Statut"><span class="ws-inbox-status">{{ item.status }}</span></td>
              <td data-label="Reçu">{{ item.createdAt ? (item.createdAt | date:'dd/MM HH:mm') : '—' }}</td>
              <td data-label="Actions">
                <div class="ws-row-actions">
                  <button class="ws-act-btn ws-act-edit" (click)="selectInboxItem(item)" title="Rédiger">✉</button>
                  <button class="ws-act-btn ws-act-approve" (click)="approveInbox(item)" title="Approuver">✓</button>
                  <button class="ws-act-btn ws-act-reject" (click)="rejectInbox(item)" title="Rejeter">✗</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="inboxItems.length === 0" class="ws-empty">Aucun email à traiter.</div>
      </div>
    </div>

    <div *ngIf="emailReplyModalOpen" class="cd-backdrop" (click)="closeInboxReplyModal()">
      <div class="cd-card" (click)="$event.stopPropagation()" style="max-width:700px;min-width:320px">
        <div class="cd-icon">✉️</div>
        <h3 class="cd-title">Répondre à l’email</h3>
        <p class="cd-msg">
          {{ selectedInboxItem?.fromAddress ? 'Destinataire : ' + selectedInboxItem.fromAddress : '' }}
        </p>
        <div class="ws-qf-grid ws-qf-grid--1col" style="margin-top:.75rem">
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Objet</label>
            <input class="ws-input" [(ngModel)]="replyDraftSubject" placeholder="Objet de la réponse" />
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Message</label>
            <textarea class="ws-input ws-textarea" [(ngModel)]="replyDraftBody" rows="8" placeholder="Votre réponse…"></textarea>
          </div>
          <div class="ws-qf-field" style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
            <label class="ws-primary-chk" style="margin:0">
              <input type="checkbox" [(ngModel)]="emailAutoMode" />
              <span>Réponse automatique / envoyer immédiatement</span>
            </label>
          </div>
        </div>
        <div class="cd-actions" style="justify-content:flex-end;gap:.5rem;margin-top:1rem">
          <button class="cd-btn cd-btn--cancel" (click)="closeInboxReplyModal()">Annuler</button>
          <button class="cd-btn" [class.cd-btn--primary]="!emailAutoMode" [class.cd-btn--secondary]="emailAutoMode"
                  (click)="emailAutoMode ? sendInboxReply(selectedInboxItem) : prepareInboxReply(selectedInboxItem)"
                  [disabled]="processingInboxReply">
            {{ processingInboxReply ? 'Traitement…' : (emailAutoMode ? 'Envoyer maintenant' : 'Demander approbation') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Prompts Tab ─────────────────────────────────────────────────────── -->
    <div *ngIf="activeTab === 'prompts'" class="ws-panel">
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">✍️ Prompts Système</span>
        <button class="ws-btn-primary" (click)="toggleQuickAdd('prompt')">
          {{ quickAdd === 'prompt' ? '✕ Fermer' : '＋ Nouveau prompt' }}
        </button>
      </div>

      <!-- Quick Add Prompt -->
      <div *ngIf="quickAdd === 'prompt'" class="ws-quick-form">
        <div class="ws-qf-grid ws-qf-grid--1col">
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Agent cible</label>
            <select class="ws-input" [(ngModel)]="promptForm.agentId">
              <option value="">— Sélectionner un agent —</option>
              <option *ngFor="let a of agents" [value]="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Nom du prompt</label>
            <input class="ws-input" [(ngModel)]="promptForm.name" placeholder="Ex: Prompt vendeur expert"/>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Contenu du prompt</label>
            <textarea class="ws-input ws-textarea" [(ngModel)]="promptForm.content" rows="5"
              placeholder="Tu es un agent IA spécialisé dans…"></textarea>
          </div>
        </div>
        <div *ngIf="formError" class="ws-error">{{ formError }}</div>
        <div class="ws-qf-actions">
          <button class="ws-btn-cancel" (click)="quickAdd = ''">Annuler</button>
          <button class="ws-btn-primary" (click)="savePrompt()" [disabled]="saving">
            <span *ngIf="!saving">Enregistrer</span>
            <span *ngIf="saving" class="ws-spin"></span>
          </button>
        </div>
      </div>

      <div *ngIf="loadingPrompts" class="ws-loading"><div class="ws-spinner"></div></div>
      <div class="ws-table-wrap" *ngIf="!loadingPrompts">
        <table class="ws-table">
          <thead><tr><th>Nom</th><th>Agent</th><th>Actif</th><th>Extrait</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let p of prompts">
              <td data-label="Nom" class="ws-cell-name">{{ p.name }}</td>
              <td data-label="Agent">{{ p.agentName || '—' }}</td>
              <td data-label="Actif"><span class="ws-bool" [class.ws-bool--on]="p.active">{{ p.active ? 'Oui' : 'Non' }}</span></td>
              <td data-label="Extrait" class="ws-cell-sub">{{ p.content | slice:0:80 }}…</td>
              <td data-label="Actions">
                <div class="ws-row-actions">
                  <button class="ws-act-btn ws-act-edit" (click)="editPrompt(p)">✏</button>
                  <button class="ws-act-btn ws-act-del" (click)="deletePrompt(p)">🗑</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="prompts.length === 0" class="ws-empty">Aucun prompt configuré.</div>
      </div>
    </div>

    <!-- ── Workflow Tab ────────────────────────────────────────────────────── -->
    <div *ngIf="activeTab === 'workflow'" class="ws-panel">
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">⚡ Historique Workflows</span>
        <button class="ws-btn-secondary" (click)="loadWorkflows()">↻ Rafraîchir</button>
      </div>
      <div *ngIf="loadingWorkflows" class="ws-loading"><div class="ws-spinner"></div></div>
      <div class="ws-table-wrap" *ngIf="!loadingWorkflows">
        <table class="ws-table">
          <thead><tr><th>Tâche</th><th>Agent</th><th>Source</th><th>Priorité</th><th>Statut</th><th>Durée</th></tr></thead>
          <tbody>
            <tr *ngFor="let w of workflows">
              <td data-label="Tâche">
                <div class="ws-cell-name">{{ w.title }}</div>
                <div class="ws-cell-sub">{{ w.description | slice:0:60 }}</div>
              </td>
              <td data-label="Agent">
                <ng-container *ngIf="getAgentById(w.assignedAgentId) as ag; else wfAgentFallback">
                  <div class="ws-cell-name" style="font-size:.85rem">{{ ag.name }}</div>
                  <span class="ws-type-badge">{{ agentTypeLabel(ag.type || ag.agentType) }}</span>
                </ng-container>
                <ng-template #wfAgentFallback>{{ w.assignedAgentId || '—' }}</ng-template>
              </td>
              <td data-label="Source"><span class="ws-type-badge ws-type-badge--sm">{{ w.source }}</span></td>
              <td data-label="Priorité"><span class="ws-priority" [attr.data-p]="w.priority">{{ w.priority }}</span></td>
              <td data-label="Statut">
                <span class="ws-wf-status" [attr.data-s]="w.status">{{ w.status }}</span>
              </td>
              <td data-label="Durée">{{ w.duration || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="workflows.length === 0" class="ws-empty">Aucun workflow exécuté.</div>
      </div>
    </div>

    <!-- ── Chat Tab ───────────────────────────────────────────────────────── -->
    <div *ngIf="activeTab === 'chat'" class="ws-panel" (click)="chatMenuOpen && (chatMenuOpen=false)">
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">💬 Chat avec un agent</span>
        <div class="ws-hist-wrap" *ngIf="savedConversations.length > 0">
          <button class="ws-hist-btn" (click)="$event.stopPropagation(); chatMenuOpen=!chatMenuOpen">
            📚 Historique
            <span class="ws-hist-badge">{{ savedConversations.length }}</span>
          </button>
          <div *ngIf="chatMenuOpen" class="ws-hist-dropdown" (click)="$event.stopPropagation()">
            <div class="ws-hist-dropdown-title">Conversations sauvegardées</div>
            <div *ngFor="let conv of savedConversations" class="ws-hist-row">
              <button class="ws-hist-load" (click)="loadConversation(conv.agentId); chatMenuOpen=false">
                <span class="ws-hist-agent">{{ conv.agentName }}</span>
                <span class="ws-hist-meta">{{ conv.msgCount }} msg · {{ conv.lastMsg | date:'dd/MM HH:mm' }}</span>
              </button>
              <button class="ws-hist-del" (click)="clearConversation(conv.agentId)" title="Effacer">✕</button>
            </div>
          </div>
        </div>
        <button *ngIf="chatMessages.length > 0" class="ws-btn-cancel" style="font-size:.75rem;padding:.3rem .7rem"
                (click)="clearChatHistory()" title="Effacer la discussion courante">🗑️</button>
      </div>

      <!-- Agent selector -->
      <div class="ws-chat-agent-sel">
        <label class="ws-qf-lbl">Agent</label>
        <select class="ws-input" [(ngModel)]="chatAgentId" (ngModelChange)="onChatAgentChange($event)" style="max-width:320px">
          <option value="">— Sélectionner —</option>
          <option *ngFor="let a of agents" [value]="a.id">{{ a.name }}{{ a.type ? ' · ' + agentTypeLabel(a.type) : '' }}</option>
        </select>
      </div>

      <!-- Quota bar -->
      <div *ngIf="chatAgentId && chatProviders.length > 0" class="ws-quota-bar">
        <div *ngFor="let p of chatProviders" class="ws-quota-chip"
             [class.ws-quota-chip--primary]="p.primary"
             [class.ws-quota-chip--low]="chatQuota && p.primary && chatQuota.hasData && chatQuota.dailyRemaining < chatQuota.dailyLimit * 0.05"
             [class.ws-quota-chip--warn]="chatQuota && p.primary && chatQuota.hasData && chatQuota.dailyRemaining >= chatQuota.dailyLimit * 0.05 && chatQuota.dailyRemaining < chatQuota.dailyLimit * 0.20">
          <span class="ws-quota-dot"></span>
          <span class="ws-quota-type">{{ p.type }}</span>
          <span class="ws-quota-model">{{ p.modelId }}</span>
          <span *ngIf="p.primary && chatProviders[0]?.id === p.id" class="ws-quota-primary-badge">⭐ principal</span>
          <ng-container *ngIf="p.primary && chatQuota?.hasData">
            <span class="ws-quota-sep">·</span>
            <span class="ws-quota-tokens">{{ chatQuota.dailyRemaining | number }} / {{ chatQuota.dailyLimit | number }} tokens</span>
          </ng-container>
          <ng-container *ngIf="p.primary && !chatQuota?.hasData">
            <span class="ws-quota-sep">·</span>
            <span class="ws-quota-unknown">quota inconnu</span>
          </ng-container>
        </div>
      </div>

      <!-- Device toolbar -->
      <div class="ws-dv-toolbar">
        <div class="ws-dv-seg">
          <button class="ws-dv-seg-btn" [class.active]="chatDevice==='phone'"  (click)="chatDevice='phone'">📱 Téléphone</button>
          <button class="ws-dv-seg-btn" [class.active]="chatDevice==='tablet'" (click)="chatDevice='tablet'">🖥️ Tablette</button>
        </div>
        <div class="ws-dv-controls">
          <label class="ws-dv-ctrl-label">Police</label>
          <select class="ws-dv-select" [(ngModel)]="chatFontFamily">
            <option value="'Roboto',system-ui,sans-serif">Roboto</option>
            <option value="system-ui,-apple-system,sans-serif">Système</option>
            <option value="Georgia,serif">Serif</option>
            <option value="'Fira Code',monospace">Mono</option>
          </select>
          <span class="ws-dv-sep">|</span>
          <label class="ws-dv-ctrl-label">Taille</label>
          <button class="ws-dv-ctrl-btn" (click)="chatFontSize = chatFontSize > 10 ? chatFontSize - 1 : chatFontSize">A−</button>
          <span class="ws-dv-ctrl-val">{{ chatFontSize }}px</span>
          <button class="ws-dv-ctrl-btn" (click)="chatFontSize = chatFontSize < 20 ? chatFontSize + 1 : chatFontSize">A+</button>
          <span class="ws-dv-sep">|</span>
          <label class="ws-dv-ctrl-label">Zoom</label>
          <button class="ws-dv-ctrl-btn" (click)="chatZoom = chatZoom > 55 ? chatZoom - 5 : chatZoom">−</button>
          <span class="ws-dv-ctrl-val">{{ chatZoom }}%</span>
          <button class="ws-dv-ctrl-btn" (click)="chatZoom = chatZoom < 130 ? chatZoom + 5 : chatZoom">+</button>
        </div>
      </div>

      <!-- Device stage -->
      <div class="ws-dv-stage">
        <div class="ws-dv" [class.ws-dv--tablet]="chatDevice==='tablet'"
             [style.transform]="'scale('+chatZoom/100+')'" [style.transform-origin]="'top center'">
          <!-- Side buttons (phone only) -->
          <div class="ws-dv-btn-vol" *ngIf="chatDevice==='phone'"></div>
          <div class="ws-dv-btn-pwr" *ngIf="chatDevice==='phone'"></div>

          <!-- Screen face -->
          <div class="ws-dv-face">
            <!-- Status bar -->
            <div class="ws-dv-statusbar">
              <span class="ws-dv-time">{{ deviceTime }}</span>
              <div class="ws-dv-notch" *ngIf="chatDevice==='phone'"></div>
              <div class="ws-dv-status-icons">
                <svg width="14" height="10" viewBox="0 0 14 10" fill="white" opacity=".9"><rect x="0" y="3" width="3" height="7" rx="1"/><rect x="4" y="2" width="3" height="8" rx="1"/><rect x="8" y="1" width="3" height="9" rx="1"/><rect x="12" y="0" width="2" height="10" rx="1" opacity=".35"/></svg>
                <svg width="22" height="11" viewBox="0 0 22 11" fill="none"><rect x="0.5" y="0.5" width="18" height="10" rx="3" stroke="white" stroke-opacity=".4"/><rect x="1.5" y="1.5" width="14" height="8" rx="2" fill="white"/><rect x="19" y="3" width="2.5" height="5" rx="1.5" fill="white" opacity=".4"/></svg>
              </div>
            </div>

            <!-- App bar (WhatsApp/Messages style) -->
            <div class="ws-dv-appbar">
              <span class="ws-dv-back">‹</span>
              <div class="ws-dv-avatar-wrap">
                <div class="ws-dv-avatar">🤖</div>
                <div class="ws-dv-online-dot"></div>
              </div>
              <div class="ws-dv-agent-info">
                <div class="ws-dv-agent-name">{{ selectedAgentName }}</div>
                <div class="ws-dv-agent-status">en ligne</div>
              </div>
              <span class="ws-dv-more">⋮</span>
            </div>

            <!-- Messages area -->
            <div class="ws-dv-messages" #msgContainer
                 [style.font-family]="chatFontFamily"
                 [style.font-size]="chatFontSize+'px'">
              <div *ngIf="!chatAgentId && chatMessages.length === 0" class="ws-dv-empty">
                <div class="ws-dv-empty-icon">🤖</div>
                <div>Sélectionnez un agent pour démarrer</div>
              </div>
              <div *ngFor="let m of chatMessages; let i = index"
                   class="ws-dv-msg"
                   [class.ws-dv-msg--out]="m.role==='user'"
                   [class.ws-dv-msg--in]="m.role==='assistant'">
                <div class="ws-dv-bubble">
                  <div class="ws-dv-msg-text" [innerHTML]="formatMsg(m.content)"></div>
                  <div class="ws-dv-msg-meta">
                    <span>{{ m.timestamp | date:'HH:mm' }}</span>
                    <span *ngIf="m.role==='user'" class="ws-dv-check">✓✓</span>
                    <button *ngIf="m.role==='assistant'" class="ws-dv-copy-btn" [class.copied]="copiedMsgIdx===i" (click)="copyMsg(m.content, i)" title="Copier">
                      <svg *ngIf="copiedMsgIdx!==i" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      <svg *ngIf="copiedMsgIdx===i"  width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button *ngIf="m.role==='assistant'" class="ws-dv-copy-btn" (click)="speakText(m.content)" title="Relire" style="font-size:11px">🔊</button>
                  </div>
                </div>
              </div>
              <!-- Streaming bubble -->
              <div *ngIf="chatStreaming" class="ws-dv-msg ws-dv-msg--in">
                <div class="ws-dv-bubble">
                  <div *ngIf="!chatBuffer" class="ws-typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                  <div *ngIf="chatBuffer" class="ws-dv-msg-text ws-dv-streaming"
                       [style.font-family]="chatFontFamily" [style.font-size]="chatFontSize+'px'">{{ chatBuffer }}<span class="ws-cursor">▋</span></div>
                </div>
              </div>
            </div>

            <!-- Input row -->
            <div class="ws-dv-input-row">
              <div class="ws-dv-input-wrap" [class.focused]="chatFocused" [class.disabled]="chatStreaming || !chatAgentId">
                <button class="ws-dv-attach" title="Pièce jointe">📎</button>
                <textarea class="ws-dv-input" [(ngModel)]="chatInput"
                          placeholder="Message…"
                          (keydown.enter)="onChatEnter($event)"
                          (input)="autoResizeChat($event)"
                          (focus)="chatFocused=true" (blur)="chatFocused=false"
                          [disabled]="chatStreaming || !chatAgentId"
                          rows="1" #chatTextarea
                          [style.font-family]="chatFontFamily"
                          [style.font-size]="chatFontSize+'px'"></textarea>
                <button class="ws-dv-voice-btn ws-dv-tts-btn" (click)="toggleTts()"
                        [class.ws-dv-voice-btn--on]="ttsEnabled"
                        title="Réponse vocale (TTS)"
                        style="font-size:15px;margin-right:2px">
                  🔊
                </button>
                <button *ngIf="isSpeaking" class="ws-dv-voice-btn ws-dv-voice-btn--on"
                        (click)="stopSpeaking()"
                        title="Arrêter la lecture"
                        style="font-size:13px;background:#e53e3e;color:#fff">
                  &#9632;
                </button>
                <button *ngIf="!isSpeaking" class="ws-dv-voice-btn" (click)="replayLastTts()"
                        title="Relire le dernier message"
                        style="font-size:13px">
                  &#x21A9;
                </button>
                <button class="ws-dv-voice-btn" (click)="toggleVoice()"
                        [class.ws-dv-voice-btn--on]="isListening"
                        [title]="isListening ? 'Arrêter' : 'Commande vocale — parlez clairement'">
                  <svg *ngIf="!isListening" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                  <span *ngIf="isListening" class="ws-dv-voice-pulse"></span>
                </button>
                <button class="ws-dv-send-btn" (click)="checkQuotaThenSend()"
                        [disabled]="!chatInput.trim() || chatStreaming || !chatAgentId" title="Envoyer">
                  <span *ngIf="chatStreaming" class="ws-spin"></span>
                  <svg *ngIf="!chatStreaming" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Home bar / nav strip -->
            <div class="ws-dv-homebar" *ngIf="chatDevice==='phone'"></div>
            <div class="ws-dv-navstrip" *ngIf="chatDevice==='tablet'"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── RAG Chat Tab — iframe conservé en vie après premier chargement ── -->
    <div *ngIf="ragLoaded"
         class="ws-panel ws-rag-panel"
         [style.display]="activeTab === 'rag' ? 'block' : 'none'">
      <iframe src="/rag-chat?embed=1" class="ws-rag-frame" title="RAG Chat"></iframe>
    </div>

    <!-- ── Redirect tâches dialog ───────────────────────────────────────── -->
    <div *ngIf="taskRedirect.show" class="cd-backdrop" (click)="taskRedirect.show=false">
      <div class="cd-card" (click)="$event.stopPropagation()">
        <div class="cd-icon">📋</div>
        <h3 class="cd-title">Créer ou gérer une tâche</h3>
        <p class="cd-msg">
          Pour créer ou gérer des tâches, utilisez l'interface dédiée de votre espace de travail — c'est plus rapide et vous évite des allers-retours dans le chat.
        </p>
        <div class="cd-actions" style="flex-direction:column;gap:.5rem">
          <button class="cd-btn cd-btn--primary" style="width:100%"
             (click)="goToTeams()">
            🚀 Créer / gérer la tâche
          </button>
          <div style="display:flex;gap:.5rem">
            <button class="cd-btn cd-btn--cancel" style="flex:1" (click)="taskRedirect.show=false; sendChatMessage()">Continuer dans le chat</button>
            <button class="cd-btn cd-btn--cancel" style="flex:1" (click)="taskRedirect.show=false">Annuler</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Quota warning dialog ──────────────────────────────────────────── -->
    <div *ngIf="quotaWarning.show" class="cd-backdrop" (click)="quotaWarning.show=false">
      <div class="cd-card" (click)="$event.stopPropagation()">
        <div class="cd-icon">⚠️</div>
        <h3 class="cd-title">Tokens insuffisants</h3>
        <p class="cd-msg">
          <strong>Provider :</strong> {{ quotaWarning.provider }} — <em>{{ quotaWarning.model }}</em>
        </p>
        <div class="cd-quota-bar-wrap">
          <div class="cd-quota-bar">
            <div class="cd-quota-used" [style.width.%]="100 - (quotaWarning.remaining / (quotaWarning.remaining + quotaWarning.needed) * 100)"></div>
          </div>
          <div class="cd-quota-labels">
            <span class="cd-quota-need">{{ quotaWarning.needed | number }} tokens nécessaires</span>
            <span class="cd-quota-left">{{ quotaWarning.remaining | number }} restants</span>
          </div>
        </div>
        <p class="cd-msg" style="font-size:.8rem;margin-top:.5rem">
          La réponse risque d'être tronquée. Attendez la recharge du quota (fenêtre glissante 24 h) ou configurez un provider de backup dans l'onglet <strong>Clés API</strong>.
        </p>
        <div class="cd-actions">
          <button class="cd-btn cd-btn--cancel" (click)="quotaWarning.show=false">Annuler</button>
          <button class="cd-btn cd-btn--warn" (click)="quotaWarning.show=false; sendChatMessage()">Envoyer quand même</button>
        </div>
      </div>
    </div>

    <!-- ── Clés API / LLM Providers Tab ─────────────────────────────────── -->
    <div *ngIf="activeTab === 'llm'" class="ws-panel">

      <!-- Header + mode toggle -->
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">🔑 Clés API &amp; Providers LLM</span>
        <div class="ws-llm-mode-toggle">
          <button class="ws-llm-mode-btn" [class.ws-llm-mode-btn--active]="llmMode==='agent'"
                  (click)="setLlmMode('agent')">Par agent</button>
          <button class="ws-llm-mode-btn" [class.ws-llm-mode-btn--active]="llmMode==='team'"
                  (click)="setLlmMode('team')">Toute une équipe</button>
          <button class="ws-llm-mode-btn" [class.ws-llm-mode-btn--active]="llmMode==='account'"
                  (click)="setLlmMode('account')">Mon compte</button>
        </div>
      </div>

      <!-- ── Mode : Agent ── -->
      <ng-container *ngIf="llmMode === 'agent'">
        <div class="ws-llm-target-bar">
          <!-- 1. Filtre par équipe -->
          <select class="ws-filter-sel" style="min-width:160px" [(ngModel)]="llmFilterTeam" (ngModelChange)="onLlmTeamFilterChange()">
            <option value="">— Toutes équipes —</option>
            <option *ngFor="let t of teams" [value]="t.id">{{ t.name }}</option>
          </select>
          <!-- 2. Sélecteur agent (filtré par équipe) -->
          <select class="ws-filter-sel" style="min-width:220px" [(ngModel)]="llmAgentId" (ngModelChange)="loadLlmProviders($event)">
            <option value="">— Choisir un agent —</option>
            <option *ngFor="let a of (llmFilterTeam ? agentsInTeam(llmFilterTeam) : agents)" [value]="a.id">{{ a.name }} ({{ agentTypeLabel(a.type) }})</option>
          </select>
          <!-- 3. Pills filtre soft-delete -->
          <div *ngIf="llmAgentId" class="ws-llm-filter-pills">
            <button class="ws-pill" [class.ws-pill--active]="llmFilter==='active'" (click)="setLlmFilter('active')">Actifs</button>
            <button class="ws-pill" [class.ws-pill--active]="llmFilter==='deleted'" (click)="setLlmFilter('deleted')">Supprimés</button>
            <button class="ws-pill" [class.ws-pill--active]="llmFilter==='all'" (click)="setLlmFilter('all')">Tous</button>
          </div>
          <button *ngIf="llmAgentId" class="ws-btn-primary" (click)="toggleQuickAdd('llm')">
            {{ quickAdd === 'llm' ? '✕ Fermer' : '＋ Ajouter provider' }}
          </button>
        </div>

        <!-- Formulaire ajout (mode agent) -->
        <div *ngIf="quickAdd === 'llm' && llmAgentId" class="ws-quick-form">
          <ng-container *ngTemplateOutlet="llmForm_tpl"></ng-container>
          <div *ngIf="llmHint" class="ws-llm-hint">{{ llmHint }}</div>
          <div *ngIf="formError" class="ws-error">{{ formError }}</div>
          <div class="ws-qf-actions">
            <button class="ws-btn-cancel" (click)="quickAdd = ''">Annuler</button>
            <button class="ws-btn-primary" (click)="addLlmProvider()" [disabled]="saving">
              <span *ngIf="!saving">Ajouter le provider</span>
              <span *ngIf="saving" class="ws-spin"></span>
            </button>
          </div>
        </div>

        <div *ngIf="!llmAgentId" class="ws-empty">Sélectionnez un agent pour voir et configurer ses providers LLM.</div>
        <div *ngIf="llmAgentId && loadingLlm" class="ws-loading"><div class="ws-spinner"></div></div>
        <div class="ws-table-wrap" *ngIf="llmAgentId && !loadingLlm">
          <table class="ws-table">
            <thead><tr><th>Type</th><th>Modèle</th><th>Base URL</th><th>Max Tokens</th><th>Clé API</th><th>Principal</th><th>Actif</th><th>Actions</th></tr></thead>
            <tbody>
              <tr *ngFor="let p of llmDisplayedProviders" [class.ws-row--deleted]="p.deleted">
                <td data-label="Type"><span class="ws-type-badge" [class.ws-type-badge--faded]="p.deleted">{{ p.type }}</span></td>
                <td data-label="Modèle" class="ws-cell-name">
                  {{ p.modelId }}
                  <span *ngIf="p.deleted" class="ws-deleted-tag">supprimé</span>
                </td>
                <td data-label="Base URL"><span class="ws-cell-sub">{{ p.baseUrl || '(défaut)' }}</span></td>
                <td data-label="Max Tokens">{{ p.maxTokens }}</td>
                <td data-label="Clé API" class="ws-key-cell">
                  <ng-container *ngIf="p.hasApiKey; else noKey">
                    <span class="ws-key-mask" [title]="revealedKeys[p.id] || 'Cliquez pour révéler'">
                      {{ revealedKeys[p.id] ? maskDisplay(revealedKeys[p.id]) : '••••••••••••' }}
                    </span>
                    <button class="ws-key-btn" (click)="revealAndCopyKey(p)" [title]="revealedKeys[p.id] ? 'Copier la clé' : 'Révéler et copier'">
                      <span *ngIf="copiedKeyId !== p.id">{{ revealedKeys[p.id] ? '📋' : '👁' }}</span>
                      <span *ngIf="copiedKeyId === p.id" style="color:#34d399">✓</span>
                    </button>
                  </ng-container>
                  <ng-template #noKey><span class="ws-cell-sub">—</span></ng-template>
                </td>
                <td data-label="Principal"><span [class.ws-bool--on]="p.primary && !p.deleted" class="ws-bool">{{ p.primary && !p.deleted ? '★ Oui' : '—' }}</span></td>
                <td data-label="Actif"><span [class.ws-bool--on]="p.active && !p.deleted" class="ws-bool">{{ p.active && !p.deleted ? '✓' : '✗' }}</span></td>
                <td data-label="Actions" class="ws-act-cell">
                  <button *ngIf="!p.primary && !p.deleted" class="ws-act-btn ws-act-star" title="Définir comme principal" (click)="llmSetPrimary(p)">⭐</button>
                  <button *ngIf="p.deleted" class="ws-act-btn ws-act-restore" title="Restaurer" (click)="llmRestore(p)">♻️</button>
                  <button *ngIf="!p.deleted" class="ws-act-btn ws-act-del" title="Supprimer" (click)="llmAskDelete(p)">🗑</button>
                </td>
              </tr>
              <tr *ngIf="llmDisplayedProviders.length === 0">
                <td colspan="8">
                  <div class="ws-empty" style="padding:1rem">
                    <ng-container *ngIf="llmFilter==='deleted'">Aucun provider supprimé.</ng-container>
                    <ng-container *ngIf="llmFilter!=='deleted'">Aucun provider — cet agent utilise la clé <code style="color:#a5b4fc">GROQ_API_KEY</code> globale.</ng-container>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Confirm dialog suppression -->
        <div *ngIf="llmConfirmOpen" class="cd-backdrop" (click)="llmConfirmOpen=false">
          <div class="cd-card" (click)="$event.stopPropagation()">
            <div class="cd-icon">🗑️</div>
            <h3 class="cd-title">Supprimer ce provider ?</h3>
            <p class="cd-msg">Le provider sera marqué comme supprimé (soft-delete). Vous pourrez le restaurer depuis le filtre "Supprimés".</p>
            <div class="cd-actions">
              <button class="cd-btn cd-btn--cancel" (click)="llmConfirmOpen=false">Annuler</button>
              <button class="cd-btn cd-btn--danger" (click)="llmDoDelete()">Supprimer</button>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ── Mode : Équipe ── -->
      <ng-container *ngIf="llmMode === 'team'">
        <div class="ws-llm-target-bar">
          <select class="ws-filter-sel" style="min-width:220px" [(ngModel)]="llmTeamId" (ngModelChange)="loadTeamLlmProviders($event)">
            <option value="">— Choisir une équipe —</option>
            <option *ngFor="let t of teams" [value]="t.id">{{ t.name }}</option>
          </select>
          <span *ngIf="llmTeamId" class="ws-llm-team-count">
            {{ agentsInTeam(llmTeamId).length }} agent(s)
          </span>
          <div *ngIf="llmTeamId" class="ws-llm-filter-pills">
            <button class="ws-pill" [class.ws-pill--active]="llmFilter==='active'" (click)="setLlmFilter('active')">Actifs</button>
            <button class="ws-pill" [class.ws-pill--active]="llmFilter==='deleted'" (click)="setLlmFilter('deleted')">Supprimés</button>
            <button class="ws-pill" [class.ws-pill--active]="llmFilter==='all'" (click)="setLlmFilter('all')">Tous</button>
          </div>
          <button *ngIf="llmTeamId" class="ws-btn-primary" (click)="toggleQuickAdd('llm-team')">
            {{ quickAdd === 'llm-team' ? "✕ Fermer" : "＋ Ajouter un provider à l'équipe" }}
          </button>
        </div>

        <!-- Provider partagé par l'équipe -->
        <div *ngIf="quickAdd === 'llm-team' && llmTeamId" class="ws-quick-form">
          <ng-container *ngTemplateOutlet="llmForm_tpl"></ng-container>
          <div *ngIf="llmHint" class="ws-llm-hint">{{ llmHint }}</div>
          <div *ngIf="formError" class="ws-error">{{ formError }}</div>
          <div class="ws-qf-actions">
            <button class="ws-btn-cancel" (click)="quickAdd = ''">Annuler</button>
            <button class="ws-btn-primary" (click)="addLlmProvider()" [disabled]="saving">
              <span *ngIf="!saving">Ajouter au provider de l'équipe</span>
              <span *ngIf="saving" class="ws-spin"></span>
            </button>
          </div>
        </div>

        <div *ngIf="llmTeamId && loadingLlm" class="ws-loading"><div class="ws-spinner"></div></div>
        <div class="ws-table-wrap" *ngIf="llmTeamId && !loadingLlm">
          <table class="ws-table">
            <thead><tr><th>Type</th><th>Modèle</th><th>Base URL</th><th>Clé API</th><th>Principal</th><th>Actions</th></tr></thead>
            <tbody>
              <tr *ngFor="let p of llmDisplayedProviders" [class.ws-row--deleted]="p.deleted">
                <td data-label="Type"><span class="ws-type-badge">{{ p.type }}</span></td>
                <td data-label="Modèle" class="ws-cell-name">{{ p.modelId }} <span *ngIf="p.deleted" class="ws-deleted-tag">supprimé</span></td>
                <td data-label="Base URL"><span class="ws-cell-sub">{{ p.baseUrl || '(défaut)' }}</span></td>
                <td data-label="Clé API" class="ws-key-cell">
                  <ng-container *ngIf="p.hasApiKey; else teamNoKey">
                    <span class="ws-key-mask">{{ revealedKeys[p.id] ? maskDisplay(revealedKeys[p.id]) : '••••••••••••' }}</span>
                    <button class="ws-key-btn" (click)="revealAndCopyKey(p)" title="Révéler et copier">👁</button>
                  </ng-container>
                  <ng-template #teamNoKey><span class="ws-cell-sub">—</span></ng-template>
                </td>
                <td data-label="Principal"><span class="ws-bool" [class.ws-bool--on]="p.primary && !p.deleted">{{ p.primary && !p.deleted ? '★ Oui' : '—' }}</span></td>
                <td data-label="Actions" class="ws-act-cell">
                  <button *ngIf="!p.primary && !p.deleted" class="ws-act-btn ws-act-star" title="Définir comme principal" (click)="llmSetPrimary(p)">⭐</button>
                  <button *ngIf="p.deleted" class="ws-act-btn ws-act-restore" title="Restaurer" (click)="llmRestore(p)">♻️</button>
                  <button *ngIf="!p.deleted" class="ws-act-btn ws-act-del" title="Supprimer" (click)="llmAskDelete(p)">🗑</button>
                </td>
              </tr>
              <tr *ngIf="llmDisplayedProviders.length === 0">
                <td colspan="6"><div class="ws-empty" style="padding:1rem">Aucun provider propre à cette équipe. Les providers des agents et du compte restent utilisables comme fallback.</div></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div *ngIf="!llmTeamId" class="ws-empty">Sélectionnez une équipe pour gérer ses providers partagés.</div>
      </ng-container>

      <!-- ── Mode : Compte ── -->
      <ng-container *ngIf="llmMode === 'account'">
        <div class="ws-llm-hint">
          Ces providers s'appliquent à <strong>tous vos agents</strong>, y compris ceux d'une équipe.
          Ils servent de repli lorsqu'un agent n'a aucun provider propre.
        </div>

        <!-- Provider par défaut de la plateforme : réservé aux administrateurs -->
        <div *ngIf="isAdmin" class="ws-llm-default-box">
          <div class="ws-llm-default-hdr">🌐 Provider par défaut de la plateforme</div>
          <div *ngIf="llmPlatformDefaultLoading" class="ws-loading"><div class="ws-spinner"></div></div>
          <ng-container *ngIf="!llmPlatformDefaultLoading">
            <p *ngIf="llmPlatformDefault" class="ws-llm-default-desc">
              Défini : <strong>{{ llmPlatformDefault.type }} · {{ llmPlatformDefault.modelId }}</strong>
              <span class="ws-cell-sub">({{ llmPlatformDefault.displayName || 'sans nom' }})</span>
            </p>
            <p *ngIf="!llmPlatformDefault" class="ws-llm-default-desc">
              Aucun provider par défaut. Les nouveaux comptes s'inscrivent avec un modèle vide et
              doivent en configurer un eux-mêmes avant de pouvoir discuter.
            </p>
            <p class="ws-llm-default-note">
              Marquer un provider ici le recopie automatiquement dans chaque compte qui n'en
              possède pas encore. Les comptes ayant déjà choisi leur modèle ne sont pas touchés,
              et chaque utilisateur peut remplacer ou supprimer le provider reçu.
            </p>
            <div class="ws-qf-actions">
              <button *ngIf="llmPlatformDefault" class="ws-btn-cancel"
                      (click)="clearPlatformDefault()">Retirer le défaut</button>
              <button class="ws-btn-cancel" (click)="loadAccountLlmProviders()">Actualiser</button>
            </div>
          </ng-container>
        </div>

        <div class="ws-llm-target-bar">
          <div class="ws-llm-filter-pills">
            <button class="ws-pill" [class.ws-pill--active]="llmFilter==='active'" (click)="setLlmFilter('active')">Actifs</button>
            <button class="ws-pill" [class.ws-pill--active]="llmFilter==='deleted'" (click)="setLlmFilter('deleted')">Supprimés</button>
            <button class="ws-pill" [class.ws-pill--active]="llmFilter==='all'" (click)="setLlmFilter('all')">Tous</button>
          </div>
          <button class="ws-btn-primary" (click)="toggleQuickAdd('llm-account')">
            {{ quickAdd === 'llm-account' ? "✕ Fermer" : "＋ Ajouter un provider à mon compte" }}
          </button>
        </div>

        <div *ngIf="quickAdd === 'llm-account'" class="ws-quick-form">
          <ng-container *ngTemplateOutlet="llmForm_tpl"></ng-container>
          <div *ngIf="llmHint" class="ws-llm-hint">{{ llmHint }}</div>
          <div *ngIf="formError" class="ws-error">{{ formError }}</div>
          <div class="ws-qf-actions">
            <button class="ws-btn-cancel" (click)="quickAdd = ''">Annuler</button>
            <button class="ws-btn-primary" (click)="addLlmProvider()" [disabled]="saving">
              <span *ngIf="!saving">Ajouter à mon compte</span>
              <span *ngIf="saving" class="ws-spin"></span>
            </button>
          </div>
        </div>

        <div *ngIf="loadingLlm" class="ws-loading"><div class="ws-spinner"></div></div>
        <div class="ws-table-wrap" *ngIf="!loadingLlm">
          <table class="ws-table">
            <thead><tr>
              <th>Type</th><th>Modèle</th><th>Base URL</th><th>Clé API</th><th>Principal</th>
              <th *ngIf="isAdmin">Défaut plateforme</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>
              <tr *ngFor="let p of llmDisplayedProviders" [class.ws-row--deleted]="p.deleted">
                <td data-label="Type"><span class="ws-type-badge">{{ p.type }}</span></td>
                <td data-label="Modèle" class="ws-cell-name">{{ p.modelId }} <span *ngIf="p.deleted" class="ws-deleted-tag">supprimé</span></td>
                <td data-label="Base URL"><span class="ws-cell-sub">{{ p.baseUrl || '(défaut)' }}</span></td>
                <td data-label="Clé API" class="ws-key-cell">
                  <ng-container *ngIf="p.hasApiKey; else accountNoKey">
                    <span class="ws-key-mask">{{ revealedKeys[p.id] ? maskDisplay(revealedKeys[p.id]) : '••••••••••••' }}</span>
                    <button class="ws-key-btn" (click)="revealAndCopyKey(p)" title="Révéler et copier">👁</button>
                  </ng-container>
                  <ng-template #accountNoKey><span class="ws-cell-sub">—</span></ng-template>
                </td>
                <td data-label="Principal"><span class="ws-bool" [class.ws-bool--on]="p.primary && !p.deleted">{{ p.primary && !p.deleted ? '★ Oui' : '—' }}</span></td>
                <td *ngIf="isAdmin" data-label="Défaut plateforme">
                  <span class="ws-bool" [class.ws-bool--on]="p.platformDefault">
                    {{ p.platformDefault ? '🌐 Défaut' : '—' }}
                  </span>
                </td>
                <td data-label="Actions" class="ws-act-cell">
                  <button *ngIf="isAdmin && !p.deleted && !p.platformDefault"
                          class="ws-act-btn ws-act-star"
                          title="Définir comme provider par défaut de la plateforme"
                          (click)="markPlatformDefault(p)">🌐</button>
                  <button *ngIf="!p.primary && !p.deleted" class="ws-act-btn ws-act-star" title="Définir comme principal" (click)="llmSetPrimary(p)">⭐</button>
                  <button *ngIf="p.deleted" class="ws-act-btn ws-act-restore" title="Restaurer" (click)="llmRestore(p)">♻️</button>
                  <button *ngIf="!p.deleted" class="ws-act-btn ws-act-del" title="Supprimer" (click)="llmAskDelete(p)">🗑</button>
                </td>
              </tr>
              <tr *ngIf="llmDisplayedProviders.length === 0">
                <td [attr.colspan]="isAdmin ? 7 : 6">
                  <div class="ws-empty" style="padding:1rem">
                    Aucun provider à mon compte. Vos agents utilisent alors le repli : provider d'agent,
                    d'équipe, puis défaut de la plateforme.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>

    </div>

    <!-- Template partagé du formulaire LLM — Wizard 3 étapes -->
    <ng-template #llmForm_tpl>

      <!-- ÉTAPE 1 : Grille des providers -->
      <div class="llm-step">
        <div class="llm-step-hdr"><span class="llm-step-num">1</span>Choisir un provider</div>
        <div class="llm-pgrid">
          <button *ngFor="let pKey of llmCatalogKeys"
                  class="llm-pcard"
                  [class.llm-pcard--on]="llmSelectedProvider === pKey"
                  (click)="selectLlmProvider(pKey)">
            <span class="llm-pcard-icon">{{ LLM_PROVIDERS[pKey].icon }}</span>
            <span class="llm-pcard-name">{{ LLM_PROVIDERS[pKey].label }}</span>
            <span *ngIf="LLM_PROVIDERS[pKey].free" class="llm-pcard-badge">Gratuit</span>
          </button>
        </div>
      </div>

      <!-- ÉTAPE 2 : Modèles réellement exposés par le fournisseur -->
      <div *ngIf="llmSelectedProvider" class="llm-step">
        <div class="llm-step-hdr"><span class="llm-step-num">2</span>Choisir un modèle</div>

        <div *ngIf="llmModelsLoading" class="llm-phint">Chargement des modèles disponibles…</div>

        <div *ngIf="!llmModelsLoading && llmModels.length > 0" class="llm-mlist">
          <label *ngFor="let m of llmModels"
                 class="llm-mrow"
                 [class.llm-mrow--on]="llmForm.modelId === m"
                 (click)="selectLlmModel({ id: m })">
            <div class="llm-mrow-radio" [class.llm-mrow-radio--on]="llmForm.modelId === m"></div>
            <div class="llm-mrow-body">
              <span class="llm-mrow-name">{{ m }}</span>
            </div>
            <span *ngIf="llmForm.modelId === m" class="llm-mrow-check">✓</span>
          </label>
        </div>

        <div *ngIf="!llmModelsLoading && llmModelsMessage" class="llm-phint">
          {{ llmModelsMessage }}
        </div>

        <div class="llm-step" style="padding:0;margin-top:.6rem">
          <div class="llm-step-hdr" style="font-size:.78rem">
            Identifiant du modèle
            <span style="font-weight:400;color:#64748b">
              (saisie libre — nécessaire sans clé API, ou si le fournisseur n'expose pas /models)
            </span>
          </div>
          <input class="ws-input" [(ngModel)]="llmForm.modelId"
                 [disabled]="llmModelsLoading"
                 placeholder="ex. qwen/qwen3.8-27b, gpt-4o-mini, deepseek-chat…"/>
        </div>
      </div>

      <!-- ÉTAPE 3 : Clé API + config auto-remplie -->
      <div *ngIf="llmSelectedProvider && llmForm.modelId" class="llm-step">
        <div class="llm-step-hdr"><span class="llm-step-num">3</span>Clé API &amp; Options</div>
        <div class="llm-phint">{{ LLM_PROVIDERS[llmSelectedProvider].hint }}</div>
        <div class="llm-key-row">
          <input class="ws-input llm-key-input"
                 [(ngModel)]="llmForm.apiKey"
                 [type]="llmShowKey ? 'text' : 'password'"
                 [placeholder]="LLM_PROVIDERS[llmSelectedProvider].type === 'OLLAMA' ? 'Aucune clé requise (Ollama local)' : 'Collez votre clé API ici…'"/>
          <button class="llm-key-eye" (click)="llmShowKey=!llmShowKey" title="Afficher / masquer">{{ llmShowKey ? '🙈' : '👁' }}</button>
          <button class="llm-refresh-btn" (click)="loadLlmModels()"
                  [disabled]="llmModelsLoading"
                  title="Relire la liste des modèles chez {{ LLM_PROVIDERS[llmSelectedProvider].label }} avec cette clé">
            {{ llmModelsLoading ? 'Chargement…' : 'Actualiser' }}
          </button>
        </div>
        <div class="llm-recap">
          <div class="llm-recap-chip"><span class="llm-rc-lbl">Backend</span><span class="llm-rc-val">{{ llmForm.type }}</span></div>
          <div class="llm-recap-chip"><span class="llm-rc-lbl">Modèle</span><span class="llm-rc-val">{{ llmForm.modelId }}</span></div>
          <div *ngIf="llmForm.baseUrl" class="llm-recap-chip" style="flex:1 1 100%"><span class="llm-rc-lbl">Base URL</span><span class="llm-rc-val" style="font-size:.7rem">{{ llmForm.baseUrl }}</span></div>
        </div>
        <div class="llm-adv">
          <div class="ws-qf-field" style="max-width:150px">
            <label class="ws-qf-lbl">Max tokens</label>
            <input class="ws-input" [(ngModel)]="llmForm.maxTokens" type="number" min="256" max="32768"/>
          </div>
          <label class="llm-primary-chk">
            <input type="checkbox" [(ngModel)]="llmForm.primary"/>
            <span>Provider principal (prioritaire)</span>
          </label>
        </div>
      </div>

    </ng-template>

    <!-- ── Facebook Comments Tab ────────────────────────────────────────── -->
    <div *ngIf="activeTab === 'social'" class="ws-panel">
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">📲 Réseaux Sociaux</span>
      </div>

      <!-- Sous-onglets par réseau -->
      <div class="ws-social-tabs">
        <button class="ws-social-tab" [class.active]="socialTab==='facebook'" (click)="socialTab='facebook'">
          <span>📘</span> Facebook
        </button>
        <button class="ws-social-tab" [class.active]="socialTab==='instagram'" (click)="socialTab='instagram'">
          <span>📸</span> Instagram
        </button>
        <button class="ws-social-tab" [class.active]="socialTab==='linkedin'" (click)="socialTab='linkedin'">
          <span>💼</span> LinkedIn
        </button>
        <button class="ws-social-tab" [class.active]="socialTab==='twitter'" (click)="socialTab='twitter'">
          <span>🐦</span> X / Twitter
        </button>
        <button class="ws-social-tab" [class.active]="socialTab==='tiktok'" (click)="socialTab='tiktok'">
          <span>🎵</span> TikTok
        </button>
        <button class="ws-social-tab" [class.active]="socialTab==='youtube'" (click)="socialTab='youtube'">
          <span>▶️</span> YouTube
        </button>
      </div>

      <!-- ── Facebook ── -->
      <ng-container *ngIf="socialTab === 'facebook'">

      <!-- Sélection agent + période -->
      <div class="ws-llm-target-bar" style="gap:.75rem;flex-wrap:wrap;">
        <select class="ws-filter-sel" style="min-width:240px" [(ngModel)]="fbAgentId" (ngModelChange)="onFbAgentChange($event)">
          <option value="">— Choisir un agent Facebook —</option>
          <option *ngFor="let a of agents" [value]="a.id">{{ a.name }}</option>
        </select>
        <select class="ws-filter-sel" [(ngModel)]="fbSinceHours">
          <option [value]="6">Dernières 6h</option>
          <option [value]="24">Dernières 24h</option>
          <option [value]="72">3 derniers jours</option>
          <option [value]="168">7 derniers jours</option>
        </select>
        <button class="ws-btn-primary" (click)="loadFbPosts()" [disabled]="!fbAgentId || fbLoadingPosts">
          <span *ngIf="!fbLoadingPosts">🔄 Charger les posts</span>
          <span *ngIf="fbLoadingPosts"><span class="ws-spinner" style="width:14px;height:14px;margin-right:6px;"></span>Chargement…</span>
        </button>
        <button class="ws-btn-secondary" (click)="triggerFbScan()" [disabled]="!fbAgentId || fbTriggeringNow" title="Force le scan immédiat de tous les posts récents — sans attendre l'intervalle de 5 min">
          <span *ngIf="!fbTriggeringNow">⚡ Scanner maintenant</span>
          <span *ngIf="fbTriggeringNow"><span class="ws-spinner" style="width:12px;height:12px;margin-right:4px;"></span>Scan…</span>
        </button>
      </div>

      <!-- Compte à rebours token Facebook -->
      <div *ngIf="fbTokenInfo" class="fb-token-banner fb-token-banner--{{ fbTokenInfo.level }}" style="margin-top:.5rem">
        <span class="fb-token-icon">
          <ng-container *ngIf="fbTokenInfo.level === 'expired'">🔴</ng-container>
          <ng-container *ngIf="fbTokenInfo.level === 'critical'">🟠</ng-container>
          <ng-container *ngIf="fbTokenInfo.level === 'warning'">🟡</ng-container>
          <ng-container *ngIf="fbTokenInfo.level === 'ok'">🟢</ng-container>
        </span>
        <span class="fb-token-msg">
          <ng-container *ngIf="fbTokenInfo.level === 'expired'">
            <strong>Token Facebook expiré</strong> — L'agent ne peut plus lire les commentaires. Renouvelez le token immédiatement.
          </ng-container>
          <ng-container *ngIf="fbTokenInfo.level === 'critical'">
            <strong>Token expire dans {{ fbTokenInfo.daysLeft }} jour(s)</strong> — Renouvelez-le dès maintenant pour éviter une interruption.
          </ng-container>
          <ng-container *ngIf="fbTokenInfo.level === 'warning'">
            <strong>Token expire dans {{ fbTokenInfo.daysLeft }} jours</strong> — Pensez à le renouveler avant le {{ fbTokenInfo.expiresAt | date:'dd/MM/yyyy' }}.
          </ng-container>
          <ng-container *ngIf="fbTokenInfo.level === 'ok'">
            Token valide encore <strong>{{ fbTokenInfo.daysLeft }} jours</strong> — expire le {{ fbTokenInfo.expiresAt | date:'dd/MM/yyyy' }}.
          </ng-container>
        </span>
      </div>

      <!-- Panneau renouvellement token -->
      <div *ngIf="fbAgentId" style="margin-top:.5rem">
        <button class="ws-btn-secondary" style="font-size:.78rem;padding:.3rem .75rem"
                (click)="fbShowRenew=!fbShowRenew">
          🔑 {{ fbShowRenew ? 'Masquer' : 'Renouveler le token Facebook' }}
        </button>

        <div *ngIf="fbShowRenew" class="fb-renew-panel">
          <div class="fb-renew-title">🔄 Renouvellement du token Facebook</div>
          <div class="fb-renew-hint">
            L'APP_ID et l'APP_SECRET ne changent pas — trouvez-les sur
            <strong>developers.facebook.com → votre app → Paramètres → Général</strong>.
            Le token court se génère sur le <strong>Graph API Explorer</strong>.
          </div>
          <div class="fb-renew-fields">
            <div class="ws-qf-field">
              <label class="ws-qf-lbl">APP ID</label>
              <input class="ws-input" [(ngModel)]="fbRenewForm.appId" placeholder="Ex : 2107973403096515"/>
            </div>
            <div class="ws-qf-field">
              <label class="ws-qf-lbl">APP Secret</label>
              <input class="ws-input" [(ngModel)]="fbRenewForm.appSecret" type="password" placeholder="Clé secrète de l'app"/>
            </div>
            <div class="ws-qf-field" style="grid-column:1/-1">
              <label class="ws-qf-lbl">Token court (Graph API Explorer)</label>
              <input class="ws-input" [(ngModel)]="fbRenewForm.shortToken" placeholder="EAAd9MM3..."/>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:.75rem;margin-top:.75rem;flex-wrap:wrap">
            <button class="ws-btn-primary"
                    (click)="renewFbToken()"
                    [disabled]="!fbRenewForm.appId || !fbRenewForm.appSecret || !fbRenewForm.shortToken || fbRenewing">
              <span *ngIf="!fbRenewing">⚡ Générer et enregistrer le token</span>
              <span *ngIf="fbRenewing"><span class="ws-spinner" style="width:12px;height:12px;margin-right:4px"></span>Renouvellement…</span>
            </button>
            <div *ngIf="fbRenewResult" class="fb-renew-success">
              ✅ Token enregistré pour <strong>{{ fbRenewResult.pageName }}</strong> ({{ fbRenewResult.pageId }})
            </div>
          </div>
        </div>
      </div>

      <!-- Accès à une ancienne publication par URL ou ID -->
      <div class="ws-llm-target-bar" style="gap:.5rem;flex-wrap:wrap;margin-top:.5rem" *ngIf="fbAgentId">
        <input class="ws-input" style="flex:1;min-width:260px"
               [(ngModel)]="fbPostUrlInput"
               placeholder="🔗 URL ou ID d'une ancienne publication Facebook…"
               (keydown.enter)="loadFbPostById()"/>
        <button class="ws-btn-secondary" (click)="loadFbPostById()" [disabled]="!fbPostUrlInput.trim()">
          Charger cette publication
        </button>
      </div>

      <div class="fb-layout" *ngIf="fbPosts.length > 0 || fbLoadingPosts">

        <!-- Liste des posts -->
        <div class="fb-posts-col">
          <div class="ws-section-title" style="margin-bottom:.5rem">📄 Posts ({{ fbPosts.length }})</div>
          <div *ngIf="fbLoadingPosts" class="ws-loading"><div class="ws-spinner"></div></div>
          <div *ngFor="let post of fbPosts"
               class="fb-post-card"
               [class.active]="fbSelectedPost?.id === post.id"
               (click)="selectFbPost(post)">

            <!-- Mode édition inline -->
            <ng-container *ngIf="fbEditingPostId === post.id; else postView">
              <textarea class="ws-input fb-edit-textarea"
                        [(ngModel)]="fbEditingPostText"
                        rows="4"
                        (click)="$event.stopPropagation()"></textarea>
              <div class="fb-post-edit-actions" (click)="$event.stopPropagation()">
                <button class="ws-btn-primary" style="font-size:.75rem;padding:.3rem .7rem"
                        (click)="confirmEditFbPost(post)" [disabled]="fbEditSaving">
                  <span *ngIf="!fbEditSaving">✓ Sauvegarder</span>
                  <span *ngIf="fbEditSaving">…</span>
                </button>
                <button class="ws-btn-cancel" style="font-size:.75rem;padding:.3rem .7rem"
                        (click)="cancelEditFbPost()">Annuler</button>
              </div>
            </ng-container>

            <ng-template #postView>
              <div class="fb-post-msg">{{ (post.message || '(post sans texte)') | slice:0:120 }}{{ post.message?.length > 120 ? '…' : '' }}</div>
              <div class="fb-post-footer">
                <span class="fb-post-meta">{{ post.created_time | date:'dd/MM/yyyy HH:mm' }}</span>
                <div class="fb-post-actions" (click)="$event.stopPropagation()">
                  <button class="fb-post-act-btn fb-post-act-btn--edit"
                          title="Modifier" (click)="startEditFbPost(post)">✏</button>
                  <button class="fb-post-act-btn fb-post-act-btn--delete"
                          title="Supprimer" (click)="deleteFbPost(post)">🗑</button>
                </div>
              </div>
            </ng-template>

          </div>
        </div>

        <!-- Commentaires du post sélectionné -->
        <div class="fb-comments-col" *ngIf="fbSelectedPost">
          <div class="ws-section-title" style="margin-bottom:.5rem">
            💬 Commentaires — <em style="font-weight:400;font-size:.8rem">{{ (fbSelectedPost.message || fbSelectedPost.id || '') | slice:0:60 }}</em>
          </div>

          <!-- Commenter le post directement -->
          <div class="fb-comment-card" style="border-color:rgba(99,102,241,.3);background:rgba(99,102,241,.06)">
            <div style="font-size:.78rem;color:#a5b4fc;margin-bottom:.4rem;font-weight:600">✍️ Commenter cette publication</div>
            <div class="fb-reply-row">
              <textarea class="ws-input fb-reply-input" rows="2"
                        [(ngModel)]="fbPostComment"
                        placeholder="Votre commentaire sur ce post…"
                        style="resize:vertical"></textarea>
              <button class="ws-btn-primary fb-reply-btn"
                      (click)="sendFbPostComment()"
                      [disabled]="!fbPostComment.trim() || fbSendingPostComment">
                <span *ngIf="!fbSendingPostComment">Publier</span>
                <span *ngIf="fbSendingPostComment">…</span>
              </button>
            </div>
          </div>

          <!-- Scanner les commentaires de ce post pour déclencher les réponses de l'agent -->
          <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0">
            <button class="ws-btn-secondary" style="font-size:.78rem;padding:.3rem .7rem"
                    (click)="scanFbPost()" [disabled]="fbScanning">
              <span *ngIf="!fbScanning">🤖 Déclencher la réponse automatique</span>
              <span *ngIf="fbScanning"><span class="ws-spinner" style="width:12px;height:12px;margin-right:4px"></span>Scan en cours…</span>
            </button>
            <span style="font-size:.72rem;color:rgba(148,163,184,.5)">
              L'agent détecte les nouveaux commentaires et répond automatiquement
            </span>
          </div>

          <div *ngIf="fbLoadingComments" class="ws-loading"><div class="ws-spinner"></div></div>
          <div *ngIf="!fbLoadingComments && fbComments.length === 0" class="ws-empty">Aucun commentaire sur ce post.</div>

          <div *ngFor="let comment of fbComments" class="fb-comment-card">
            <div class="fb-comment-author">
              <strong>{{ comment.author_name || 'Utilisateur' }}</strong>
              <span class="fb-comment-date">{{ comment.created_time | date:'dd/MM HH:mm' }}</span>
              <span *ngIf="comment.like_count > 0" class="fb-comment-likes">👍 {{ comment.like_count }}</span>
            </div>
            <div class="fb-comment-body">{{ comment.message }}</div>
            <div class="fb-reply-row">
              <input class="ws-input fb-reply-input"
                     [(ngModel)]="fbReplyText[comment.id]"
                     placeholder="Votre réponse…"
                     (keydown.enter)="sendFbReply(comment)"/>
              <button class="ws-btn-primary fb-reply-btn"
                      (click)="sendFbReply(comment)"
                      [disabled]="!fbReplyText[comment.id]?.trim() || fbSendingReply[comment.id]">
                <span *ngIf="!fbSendingReply[comment.id]">Répondre</span>
                <span *ngIf="fbSendingReply[comment.id]">…</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      <div *ngIf="!fbLoadingPosts && fbPosts.length === 0 && fbAgentId" class="ws-empty">
        Aucun post trouvé pour cet agent sur la période sélectionnée.<br>
        <span style="font-size:.8rem;opacity:.6">Vérifiez que le canal Facebook est CONNECTED dans l'onglet Canaux.</span>
      </div>
      <div *ngIf="!fbAgentId" class="ws-empty" style="margin-top:2rem">
        Sélectionnez un agent dont le canal Facebook est configuré.
      </div>
      </ng-container>

      <!-- ── Instagram ── -->
      <ng-container *ngIf="socialTab === 'instagram'">

        <!-- Sélection agent -->
        <div class="ws-llm-target-bar" style="gap:.75rem;flex-wrap:wrap;">
          <select class="ws-filter-sel" style="min-width:240px" [(ngModel)]="igAgentId" (ngModelChange)="onIgAgentChange($event)">
            <option value="">— Choisir un agent Instagram —</option>
            <option *ngFor="let a of agents" [value]="a.id">{{ a.name }}</option>
          </select>
          <button class="ws-btn-primary" (click)="loadIgMedia()" [disabled]="!igAgentId || igLoadingMedia">
            <span *ngIf="!igLoadingMedia">🔄 Charger les publications</span>
            <span *ngIf="igLoadingMedia"><span class="ws-spinner" style="width:14px;height:14px;margin-right:6px;"></span>Chargement…</span>
          </button>
          <button class="ws-btn-secondary" (click)="triggerIgScan()" [disabled]="!igAgentId || igTriggeringNow" title="Scanne tous les médias récents et crée les tâches de réponse">
            <span *ngIf="!igTriggeringNow">⚡ Scanner maintenant</span>
            <span *ngIf="igTriggeringNow"><span class="ws-spinner" style="width:12px;height:12px;margin-right:4px;"></span>Scan…</span>
          </button>
        </div>

        <div class="fb-layout" *ngIf="igMedia.length > 0 || igLoadingMedia">

          <!-- Grille de médias -->
          <div class="fb-posts-col">
            <div class="ws-section-title" style="margin-bottom:.5rem">📸 Publications ({{ igMedia.length }})</div>
            <div *ngIf="igLoadingMedia" class="ws-loading"><div class="ws-spinner"></div></div>
            <div *ngFor="let media of igMedia"
                 class="fb-post-card"
                 [class.active]="igSelectedMedia?.id === media.id"
                 (click)="selectIgMedia(media)">
              <!-- Miniature -->
              <div *ngIf="media.thumbnail_url || media.media_url" style="margin-bottom:.4rem">
                <img [src]="media.thumbnail_url || media.media_url"
                     style="max-width:100%;border-radius:6px;max-height:140px;object-fit:cover"
                     [alt]="media.caption || 'Instagram media'"
                     (error)="onImgError($event)"/>
              </div>
              <div class="fb-post-msg">{{ (media.caption || '(publication sans légende)') | slice:0:120 }}{{ media.caption?.length > 120 ? '…' : '' }}</div>
              <div class="fb-post-footer">
                <span class="fb-post-meta">{{ media.timestamp | date:'dd/MM/yyyy HH:mm' }}</span>
                <span class="fb-post-meta" style="text-transform:uppercase;font-size:.68rem;opacity:.5">{{ media.media_type }}</span>
                <div class="fb-post-actions" (click)="$event.stopPropagation()">
                  <button class="fb-post-act-btn fb-post-act-btn--delete"
                          title="Supprimer" (click)="deleteIgMedia(media)">🗑</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Commentaires du média sélectionné -->
          <div class="fb-comments-col" *ngIf="igSelectedMedia">
            <div class="ws-section-title" style="margin-bottom:.5rem">
              💬 Commentaires — <em style="font-weight:400;font-size:.8rem">{{ (igSelectedMedia.caption || igSelectedMedia.id || '') | slice:0:60 }}</em>
            </div>

            <!-- Scanner ce média -->
            <div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0">
              <button class="ws-btn-secondary" style="font-size:.78rem;padding:.3rem .7rem"
                      (click)="scanIgMedia()" [disabled]="igScanning">
                <span *ngIf="!igScanning">🤖 Déclencher la réponse automatique</span>
                <span *ngIf="igScanning"><span class="ws-spinner" style="width:12px;height:12px;margin-right:4px"></span>Scan…</span>
              </button>
              <span style="font-size:.72rem;color:rgba(148,163,184,.5)">L'agent détecte les nouveaux commentaires et répond automatiquement</span>
            </div>

            <div *ngIf="igLoadingComments" class="ws-loading"><div class="ws-spinner"></div></div>
            <div *ngIf="!igLoadingComments && igComments.length === 0" class="ws-empty">Aucun commentaire sur cette publication.</div>

            <div *ngFor="let comment of igComments" class="fb-comment-card">
              <div class="fb-comment-author">
                <strong>{{'@'}}{{ comment.username || 'utilisateur' }}</strong>
                <span class="fb-comment-date">{{ comment.timestamp | date:'dd/MM HH:mm' }}</span>
                <span *ngIf="comment.like_count > 0" class="fb-comment-likes">❤️ {{ comment.like_count }}</span>
              </div>
              <div class="fb-comment-body">{{ comment.text }}</div>
              <div class="fb-reply-row">
                <input class="ws-input fb-reply-input"
                       [(ngModel)]="igReplyText[comment.id]"
                       placeholder="Votre réponse…"
                       (keydown.enter)="sendIgReply(comment)"/>
                <button class="ws-btn-primary fb-reply-btn"
                        (click)="sendIgReply(comment)"
                        [disabled]="!igReplyText[comment.id]?.trim() || igSendingReply[comment.id]">
                  <span *ngIf="!igSendingReply[comment.id]">Répondre</span>
                  <span *ngIf="igSendingReply[comment.id]">…</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        <div *ngIf="!igLoadingMedia && igMedia.length === 0 && igAgentId" class="ws-empty">
          Aucune publication trouvée pour cet agent.<br>
          <span style="font-size:.8rem;opacity:.6">Vérifiez que le canal Instagram est CONNECTED dans l'onglet Canaux.</span>
        </div>
        <div *ngIf="!igAgentId" class="ws-empty" style="margin-top:2rem">
          Sélectionnez un agent dont le canal Instagram est configuré.
        </div>

      </ng-container>

      <!-- ── LinkedIn ── -->
      <ng-container *ngIf="socialTab === 'linkedin'">
        <div class="ws-social-coming-soon">
          <div class="ws-social-coming-icon">💼</div>
          <div class="ws-social-coming-title">LinkedIn — Bientôt disponible</div>
          <div class="ws-social-coming-desc">Gestion des commentaires sur posts d'entreprise via LinkedIn API. Configurez un canal LinkedIn dans l'onglet <strong>Canaux</strong>.</div>
        </div>
      </ng-container>

      <!-- ── X / Twitter ── -->
      <ng-container *ngIf="socialTab === 'twitter'">
        <div class="ws-social-coming-soon">
          <div class="ws-social-coming-icon">🐦</div>
          <div class="ws-social-coming-title">X / Twitter — Bientôt disponible</div>
          <div class="ws-social-coming-desc">Gestion des mentions et réponses via X API v2. Configurez un canal Twitter/X dans l'onglet <strong>Canaux</strong>.</div>
        </div>
      </ng-container>

      <!-- ── TikTok ── -->
      <ng-container *ngIf="socialTab === 'tiktok'">
        <div class="ws-social-coming-soon">
          <div class="ws-social-coming-icon">🎵</div>
          <div class="ws-social-coming-title">TikTok — Bientôt disponible</div>
          <div class="ws-social-coming-desc">Gestion des commentaires TikTok via TikTok API. Configurez un canal TikTok dans l'onglet <strong>Canaux</strong>.</div>
        </div>
      </ng-container>

      <!-- ── YouTube ── -->
      <ng-container *ngIf="socialTab === 'youtube'">
        <div class="ws-social-coming-soon">
          <div class="ws-social-coming-icon">▶️</div>
          <div class="ws-social-coming-title">YouTube — Bientôt disponible</div>
          <div class="ws-social-coming-desc">Modération des commentaires YouTube via YouTube Data API v3. Configurez un canal YouTube dans l'onglet <strong>Canaux</strong>.</div>
        </div>
      </ng-container>

    </div>

    <!-- ── Canaux Tab ────────────────────────────────────────────────────── -->
    <div *ngIf="activeTab === 'canaux'" class="ws-panel">
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">📡 Canaux de communication</span>
      </div>

      <!-- Agent selector -->
      <div class="ws-llm-target-bar">
        <select class="ws-filter-sel" style="min-width:240px" [(ngModel)]="channelAgentId" (ngModelChange)="loadChannels($event)">
          <option value="">— Choisir un agent —</option>
          <option *ngFor="let a of agents" [value]="a.id">{{ a.name }} ({{ agentTypeLabel(a.type) }})</option>
        </select>
        <button *ngIf="channelAgentId" class="ws-btn-primary" (click)="editingChannelId ? cancelChannelForm() : toggleQuickAdd('channel')">
          {{ (quickAdd === 'channel' || editingChannelId) ? '✕ Fermer' : '＋ Ajouter un canal' }}
        </button>
      </div>

      <!-- Add / Edit channel form -->
      <div *ngIf="(quickAdd === 'channel' || editingChannelId) && channelAgentId" class="ws-quick-form">
        <div class="ws-qf-title">{{ editingChannelId ? '✏️ Modifier le canal' : '➕ Nouveau canal' }}</div>
        <div class="ws-qf-grid ws-qf-grid--2col">
          <!-- Type (lecture seule en mode édition) -->
          <div class="ws-qf-field" *ngIf="!editingChannelId">
            <label class="ws-qf-lbl">Type de canal</label>
            <select class="ws-input" [(ngModel)]="channelForm.type" (ngModelChange)="onChannelTypeChange(); cd.markForCheck()">
              <option value="SOCIAL_MEDIA">📱 Réseau social (Instagram, LinkedIn…)</option>
              <option value="GMAIL">📧 Gmail (OAuth2)</option>
              <option value="EMAIL_SMTP">📬 Email SMTP custom</option>
              <option value="WHATSAPP">💬 WhatsApp Business</option>
              <option value="TELEGRAM">✈️ Telegram Bot</option>
              <option value="SLACK">💼 Slack</option>
              <option value="WEBHOOK">🔗 Webhook HTTP</option>
            </select>
          </div>
          <div class="ws-qf-field" *ngIf="editingChannelId">
            <label class="ws-qf-lbl">Type de canal</label>
            <div class="ws-input" style="opacity:.6;pointer-events:none">{{ channelForm.type }}</div>
          </div>
          <div class="ws-qf-field" *ngIf="channelForm.type === 'SOCIAL_MEDIA'">
            <label class="ws-qf-lbl">Plateforme</label>
            <select class="ws-input" [(ngModel)]="channelForm.platformType">
              <option value="INSTAGRAM">Instagram</option>
              <option value="LINKEDIN">LinkedIn</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="TWITTER_X">Twitter / X</option>
              <option value="TIKTOK">TikTok</option>
              <option value="YOUTUBE">YouTube</option>
            </select>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Nom affiché</label>
            <input class="ws-input" [(ngModel)]="channelForm.displayName" placeholder="Ex: Facebook Page Entreprise"/>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Nom du compte</label>
            <input class="ws-input" [(ngModel)]="channelForm.accountName" placeholder="Ex: Labibpro Bénin Officiel"/>
          </div>
          <div class="ws-qf-field" style="grid-column:span 2"
               *ngIf="!(channelForm.type === 'SOCIAL_MEDIA' && (channelForm.platformType === 'FACEBOOK' || channelForm.platformType === 'INSTAGRAM'))">
            <label class="ws-qf-lbl">🔑 ID du compte <span style="color:#f87171;font-size:.7rem">(obligatoire pour LinkedIn)</span></label>
            <input class="ws-input" [(ngModel)]="channelForm.accountId" placeholder="Ex: @handle ou ID numérique"/>
          </div>
          <!-- Champs Facebook dédiés -->
          <ng-container *ngIf="channelForm.type === 'SOCIAL_MEDIA' && channelForm.platformType === 'FACEBOOK'">
            <div class="ws-qf-field" style="grid-column:span 2">
              <label class="ws-qf-lbl">🔑 Page Access Token{{ editingChannelId ? ' — laisser vide pour ne pas modifier' : '' }}</label>
              <input class="ws-input" [(ngModel)]="channelForm.fbAccessToken"
                     placeholder="EAAxxxxx… (depuis Meta Business Suite → Paramètres → Token de page)"
                     [attr.type]="'text'"/>
              <div class="ws-ch-hint">Token de longue durée (60 jours) ou permanent depuis Meta Business Suite.</div>
            </div>
            <div class="ws-qf-field" style="grid-column:span 2">
              <label class="ws-qf-lbl">🆔 Page ID <span style="color:#f87171;font-size:.7rem">(obligatoire)</span></label>
              <input class="ws-input" [(ngModel)]="channelForm.fbPageId"
                     placeholder="Ex : 1181996944992363"/>
              <div class="ws-ch-hint">Visible dans Meta Business Suite → Paramètres de la Page → Informations de la page.</div>
            </div>
          </ng-container>

          <!-- Champs Instagram dédiés -->
          <ng-container *ngIf="channelForm.type === 'SOCIAL_MEDIA' && channelForm.platformType === 'INSTAGRAM'">
            <div class="ws-qf-field" style="grid-column:span 2">
              <label class="ws-qf-lbl">🔑 Page Access Token{{ editingChannelId ? ' — laisser vide pour ne pas modifier' : '' }}</label>
              <input class="ws-input" [(ngModel)]="channelForm.igAccessToken"
                     placeholder="EAAxxxxx… (même token que Facebook si page liée)"/>
              <div class="ws-ch-hint">Token de la page Facebook liée au compte Instagram Business.</div>
            </div>
            <div class="ws-qf-field">
              <label class="ws-qf-lbl">🆔 Page ID Facebook <span style="color:#94a3b8;font-size:.7rem">(pour auto-fetch)</span></label>
              <input class="ws-input" [(ngModel)]="channelForm.fbPageId"
                     placeholder="Ex : 1181996944992363"/>
            </div>
            <div class="ws-qf-field" style="display:flex;flex-direction:column;gap:.4rem">
              <label class="ws-qf-lbl">🆔 Instagram Business Account ID <span style="color:#f87171;font-size:.7rem">(obligatoire)</span></label>
              <div style="display:flex;gap:.5rem;align-items:center">
                <input class="ws-input" [(ngModel)]="channelForm.igUserId"
                       placeholder="Ex : 17841400123456789" style="flex:1"/>
                <button class="ws-btn-secondary" style="white-space:nowrap;font-size:.78rem;padding:.4rem .75rem"
                        (click)="fetchIgUserId()" [disabled]="igFetchingIgId">
                  <span *ngIf="!igFetchingIgId">🔍 Auto-fetch</span>
                  <span *ngIf="igFetchingIgId"><span class="ws-spinner" style="width:12px;height:12px"></span></span>
                </button>
              </div>
              <div *ngIf="igFetchIgIdError" style="font-size:.75rem;color:#f87171">{{ igFetchIgIdError }}</div>
              <div class="ws-ch-hint">Cliquez "Auto-fetch" après avoir saisi le Token et le Page ID pour récupérer l'ID automatiquement.</div>
            </div>
          </ng-container>

          <!-- Credentials génériques pour les autres plateformes -->
          <ng-container *ngIf="!(channelForm.type === 'SOCIAL_MEDIA' && (channelForm.platformType === 'FACEBOOK' || channelForm.platformType === 'INSTAGRAM'))">
            <div class="ws-qf-field" style="grid-column:span 2">
              <label class="ws-qf-lbl">Credentials (JSON){{ editingChannelId ? ' — laisser vide pour ne pas modifier' : '' }}</label>
              <div class="ws-ch-hint" *ngIf="channelCredHint">{{ channelCredHint }}</div>
              <textarea class="ws-input ws-textarea" [(ngModel)]="channelForm.credentials" rows="4"
                placeholder="{{ channelCredPlaceholder }}"></textarea>
            </div>
          </ng-container>

          <div class="ws-qf-field" style="grid-column:span 2"
               *ngIf="channelForm.type === 'SOCIAL_MEDIA' && (channelForm.platformType === 'FACEBOOK' || channelForm.platformType === 'INSTAGRAM')">
            <label class="ws-qf-lbl">⏱ Intervalle de polling des commentaires</label>
            <select class="ws-input" [(ngModel)]="channelForm.pollIntervalMs">
              <option [ngValue]="60000">1 minute</option>
              <option [ngValue]="300000">5 minutes (défaut)</option>
              <option [ngValue]="900000">15 minutes</option>
              <option [ngValue]="1800000">30 minutes</option>
              <option [ngValue]="3600000">1 heure</option>
            </select>
            <div class="ws-ch-hint">L'agent vérifie les nouveaux commentaires selon cet intervalle.</div>
          </div>
        </div>
        <div *ngIf="formError" class="ws-error">{{ formError }}</div>
        <div class="ws-qf-actions">
          <button class="ws-btn-cancel" (click)="cancelChannelForm()">Annuler</button>
          <button class="ws-btn-primary" (click)="editingChannelId ? updateChannel() : addChannel()" [disabled]="saving">
            <span *ngIf="!saving">{{ editingChannelId ? '💾 Mettre à jour' : 'Créer le canal' }}</span>
            <span *ngIf="saving" class="ws-spin"></span>
          </button>
        </div>
      </div>

      <div *ngIf="!channelAgentId" class="ws-empty">Sélectionnez un agent pour voir et configurer ses canaux.</div>
      <div *ngIf="channelAgentId && loadingChannels" class="ws-loading"><div class="ws-spinner"></div></div>
      <div class="ws-table-wrap" *ngIf="channelAgentId && !loadingChannels">
        <table class="ws-table">
          <thead><tr><th>Type</th><th>Plateforme</th><th>Nom</th><th>Page ID / Compte</th><th>Token</th><th>Statut</th><th>Webhook</th><th>Actions</th></tr></thead>
          <tbody>
            <ng-container *ngFor="let ch of channels">
            <tr>
              <td data-label="Type"><span class="ws-type-badge ws-type-badge--sm">{{ ch.type }}</span></td>
              <td data-label="Plateforme">{{ ch.platformType || '—' }}</td>
              <td data-label="Nom" class="ws-cell-name">{{ ch.displayName }}</td>
              <td data-label="Page ID / Compte">
                <div class="ws-cell-name" style="font-size:.75rem">{{ ch.accountId || '—' }}</div>
                <div class="ws-cell-sub" *ngIf="ch.accountName">{{ ch.accountName }}</div>
              </td>
              <td data-label="Token"><span class="ws-ch-token-hint">{{ ch.id ? '🔐 chiffré' : '—' }}</span></td>
              <td data-label="Statut">
                <span class="ws-ch-status" [attr.data-s]="ch.status">{{ ch.status }}</span>
              </td>
              <td data-label="Webhook">
                <button *ngIf="ch.webhookUrl" class="ws-webhook-toggle" [class.open]="openWebhookId === ch.id"
                        (click)="toggleWebhook(ch)">
                  <span class="dot"></span>{{ openWebhookId === ch.id ? 'Masquer' : 'Configurer' }}
                </button>
                <span *ngIf="!ch.webhookUrl" class="ws-cell-sub">—</span>
              </td>
              <td data-label="Actions">
                <div class="ws-row-actions">
                  <button class="ws-act-btn ws-act-edit" title="Modifier" (click)="editChannel(ch)">✏</button>
                  <button *ngIf="ch.status !== 'CONNECTED'" class="ws-act-btn ws-act-approve" title="Marquer comme connecté" (click)="connectChannel(ch)">✓</button>
                  <button *ngIf="ch.status === 'CONNECTED'" class="ws-act-btn" style="color:#94a3b8" title="Déconnecter" (click)="disconnectChannel(ch)">⏏</button>
                  <button class="ws-act-btn ws-act-del" title="Supprimer" (click)="deleteChannel(ch)">🗑</button>
                </div>
              </td>
            </tr>
            <tr class="ws-webhook-detail" *ngIf="openWebhookId === ch.id">
              <td colspan="8">
                <div class="ws-ch-hint">
                  Declarez <strong>une seule fois</strong> l'URL applicative dans le dashboard Meta
                  (Developpeurs → Webhooks), puis cochez les champs à écouter.
                  Le routage vers ce canal se fait automatiquement via <code>entry.id</code>.
                </div>

                <div class="ws-webhook-grid">
                  <div class="ws-webhook-field">
                    <label>URL de callback (tous les canaux)</label>
                    <div class="ws-webhook-value">
                      <code>{{ globalWebhookUrl(ch) }}</code>
                      <button class="ws-copy-btn" [class.copied]="copiedWebhookKey === ch.id + ':g'"
                              (click)="copyWebhook(globalWebhookUrl(ch), ch.id + ':g')" title="Copier">
                        <svg *ngIf="copiedWebhookKey !== ch.id + ':g'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 1 1 2 2v1"/></svg>
                        <svg *ngIf="copiedWebhookKey === ch.id + ':g'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    </div>
                  </div>

                  <div class="ws-webhook-field">
                    <label>URL dédiée à ce canal</label>
                    <div class="ws-webhook-value">
                      <code>{{ ch.webhookUrl }}</code>
                      <button class="ws-copy-btn" [class.copied]="copiedWebhookKey === ch.id + ':c'"
                              (click)="copyWebhook(ch.webhookUrl, ch.id + ':c')" title="Copier">
                        <svg *ngIf="copiedWebhookKey !== ch.id + ':c'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 1 1 2 2v1"/></svg>
                        <svg *ngIf="copiedWebhookKey === ch.id + ':c'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    </div>
                  </div>

                  <div class="ws-webhook-field">
                    <label>Verify token</label>
                    <div class="ws-webhook-value">
                      <code>{{ ch.verifyToken || '— non défini —' }}</code>
                      <button class="ws-copy-btn" *ngIf="ch.verifyToken" [class.copied]="copiedWebhookKey === ch.id + ':t'"
                              (click)="copyWebhook(ch.verifyToken, ch.id + ':t')" title="Copier">
                        <svg *ngIf="copiedWebhookKey !== ch.id + ':t'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 1 1 2 2v1"/></svg>
                        <svg *ngIf="copiedWebhookKey === ch.id + ':t'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="ws-ch-hint" style="margin-bottom:0">
                  <strong>Facebook</strong> : champs « messages », « comments », « feed » (et « mentions » si l'appli l'expose).
                  <strong>Instagram</strong> : champs « comments » et « live_comments ».
                  L'abonnement est déclenché automatiquement à la connexion du compte ; sinon le handshake
                  (<code>GET</code> avec <code>hub.verify_token</code>) suffit à valider l'URL, pas à recevoir d'événements.
                </div>
              </td>
            </tr>
            </ng-container>
            <tr *ngIf="channels.length === 0">
              <td colspan="8"><div class="ws-empty" style="padding:1rem">Aucun canal configuré pour cet agent.</div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div><!-- /ws-wrap -->
    <!-- ── Profil Expéditeur Tab ─────────────────────────────────────────── -->
    <div *ngIf="activeTab === 'profil'" class="ws-panel">
      <div class="ws-panel-hdr">
        <span class="ws-panel-title">Mon Profil Expéditeur</span>
        <div class="ws-panel-hdr-actions">
          <button class="ws-btn-secondary" (click)="showProfilDetail=true">Détail profil</button>
          <button class="ws-btn-secondary" (click)="openClientModal()">Mes Clients</button>
          <button class="ws-btn-secondary" (click)="openProductModal()">Mes Produits</button>
          <button class="ws-btn-secondary" (click)="downloadProfilTemplate()" title="Télécharger profil JSON">Modèle XLSX</button>
          <button class="ws-btn-primary" (click)="saveProfil()" [disabled]="savingProfil" title="Enregistrer le profil">
            <span *ngIf="!savingProfil && !profilSaved">💾 Enregistrer</span>
            <span *ngIf="profilSaved" style="color:#4ade80">✓ Enregistré</span>
            <span *ngIf="savingProfil" class="ws-spin"></span>
          </button>
        </div>
      </div>

      <div class="ws-profil-wizard">

        <!-- ── Step indicator ── -->
        <div class="ws-pstep-bar">
          <div class="ws-pstep-track">
            <div class="ws-pstep-fill" [style.width.%]="(profilStep - 1) / (profilStepCount - 1) * 100"></div>
          </div>
          <button *ngFor="let s of profilSteps; let i = index"
            class="ws-pstep-dot"
            [class.ws-pstep-dot--done]="profilStep > i + 1"
            [class.ws-pstep-dot--active]="profilStep === i + 1"
            [class.ws-pstep-dot--locked]="profilStep <= i + 1"
            [disabled]="profilStep <= i + 1"
            (click)="profilGotoStep(i + 1)">
            <span class="ws-pstep-num">{{ profilStep > i + 1 ? '✓' : i + 1 }}</span>
            <span class="ws-pstep-label">{{ s }}</span>
          </button>
        </div>

        <!-- ── Card ── -->
        <div class="ws-profil-card">

          <!-- Step 1 — Identité -->
          <div *ngIf="profilStep === 1" class="ws-profil-step">
            <div class="ws-profil-step-hdr">
              <span class="ws-profil-step-icon">🧑</span>
              <div>
                <div class="ws-profil-step-title">Identité</div>
                <div class="ws-profil-step-sub">Vos informations personnelles</div>
              </div>
            </div>
            <div class="ws-pf-grid">
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Prénom <span class="ws-pf-req">*</span></label>
                <input class="ws-input" [class.ws-input--err]="profilTouched && !profilForm.prenom.trim()"
                  [(ngModel)]="profilForm.prenom" (ngModelChange)="onProfilFieldChange(); profilTouched && clearStepError()"
                  placeholder="Jean"/>
                <span *ngIf="profilTouched && !profilForm.prenom.trim()" class="ws-pf-err-msg">Champ obligatoire</span>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Nom <span class="ws-pf-req">*</span></label>
                <input class="ws-input" [class.ws-input--err]="profilTouched && !profilForm.nom.trim()"
                  [(ngModel)]="profilForm.nom" (ngModelChange)="onProfilFieldChange(); profilTouched && clearStepError()"
                  placeholder="Dupont"/>
                <span *ngIf="profilTouched && !profilForm.nom.trim()" class="ws-pf-err-msg">Champ obligatoire</span>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Poste / Titre</label>
                <input class="ws-input" [(ngModel)]="profilForm.poste"
                  (ngModelChange)="onProfilFieldChange()" placeholder="Directeur Commercial"/>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Département</label>
                <input class="ws-input" [(ngModel)]="profilForm.departement"
                  placeholder="Sales & Marketing"/>
              </div>
            </div>
          </div>

          <!-- Step 2 — Société & Contact -->
          <div *ngIf="profilStep === 2" class="ws-profil-step">
            <div class="ws-profil-step-hdr">
              <span class="ws-profil-step-icon">🏢</span>
              <div>
                <div class="ws-profil-step-title">Société & Contact</div>
                <div class="ws-profil-step-sub">Vos coordonnées professionnelles</div>
              </div>
            </div>
            <div class="ws-pf-grid">
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Nom de la société <span class="ws-pf-req">*</span></label>
                <input class="ws-input" [class.ws-input--err]="profilTouched && !profilForm.societe.trim()"
                  [(ngModel)]="profilForm.societe" (ngModelChange)="onProfilFieldChange(); profilTouched && clearStepError()"
                  placeholder="TechCorp SAS"/>
                <span *ngIf="profilTouched && !profilForm.societe.trim()" class="ws-pf-err-msg">Champ obligatoire</span>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Secteur d'activité</label>
                <input class="ws-input" [(ngModel)]="profilForm.secteur"
                  placeholder="Intelligence Artificielle / SaaS"/>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Site web</label>
                <input class="ws-input" [(ngModel)]="profilForm.siteWeb"
                  (ngModelChange)="onProfilFieldChange()" placeholder="https://www.techcorp.fr"/>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Adresse</label>
                <input class="ws-input" [(ngModel)]="profilForm.adresse"
                  placeholder="12 rue de la Paix, 75001 Paris"/>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Email professionnel <span class="ws-pf-req">*</span></label>
                <input class="ws-input" [class.ws-input--err]="profilTouched && !profilForm.email.trim()"
                  [(ngModel)]="profilForm.email" (ngModelChange)="onProfilFieldChange(); profilTouched && clearStepError()"
                  placeholder="jean.dupont@techcorp.fr"/>
                <span *ngIf="profilTouched && !profilForm.email.trim()" class="ws-pf-err-msg">Champ obligatoire</span>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Téléphone direct</label>
                <input class="ws-input" [(ngModel)]="profilForm.telephone"
                  (ngModelChange)="onProfilFieldChange()" placeholder="+33 6 12 34 56 78"/>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Téléphone fixe</label>
                <input class="ws-input" [(ngModel)]="profilForm.telephoneFixe"
                  (ngModelChange)="onProfilFieldChange()" placeholder="+33 1 23 45 67 89"/>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">LinkedIn</label>
                <input class="ws-input" [(ngModel)]="profilForm.linkedin"
                  placeholder="linkedin.com/in/jean-dupont"/>
              </div>
            </div>
          </div>

          <!-- Step 3 — Signature -->
          <div *ngIf="profilStep === 3" class="ws-profil-step">
            <div class="ws-profil-step-hdr">
              <span class="ws-profil-step-icon">✍️</span>
              <div>
                <div class="ws-profil-step-title">Signature email</div>
                <div class="ws-profil-step-sub">Ton et signature automatique ou personnalisée</div>
              </div>
              <div style="margin-left:auto;display:flex;gap:.5rem;align-items:center">
                <span class="ws-profil-mode-badge" [class.ws-profil-mode-badge--auto]="signatureAutoMode">
                  <ng-container *ngIf="signatureAutoMode">🔄 Auto</ng-container>
                  <ng-container *ngIf="!signatureAutoMode">✏ Manuel</ng-container>
                </span>
                <button class="ws-btn-secondary ws-btn-xs" (click)="toggleSignatureMode()">
                  <ng-container *ngIf="signatureAutoMode">Éditer manuellement</ng-container>
                  <ng-container *ngIf="!signatureAutoMode">Revenir en auto</ng-container>
                </button>
              </div>
            </div>
            <div class="ws-pf-field">
              <label class="ws-pf-lbl">Ton préféré pour les emails</label>
              <select class="ws-input ws-input--narrow" [(ngModel)]="profilForm.tonEmail"
                (ngModelChange)="onProfilFieldChange()">
                <option value="professionnel">Professionnel</option>
                <option value="chaleureux">Chaleureux & Amical</option>
                <option value="formel">Formel</option>
                <option value="direct">Direct & Concis</option>
                <option value="commercial">Commercial / Persuasif</option>
              </select>
            </div>
            <div class="ws-pf-field">
              <label class="ws-pf-lbl">
                Signature
                <span *ngIf="signatureAutoMode" class="ws-profil-auto-tag">— mise à jour automatiquement</span>
              </label>
              <div class="ws-profil-sig-wrap">
                <textarea class="ws-input ws-textarea ws-profil-sig-textarea"
                  [(ngModel)]="profilForm.signature"
                  [readonly]="signatureAutoMode"
                  [class.ws-profil-sig-auto]="signatureAutoMode"
                  rows="9" placeholder="Votre signature apparaîtra ici…"></textarea>
              </div>
            </div>
          </div>

          <!-- Step 4 — Préférences & Contexte IA -->
          <div *ngIf="profilStep === 4" class="ws-profil-step">
            <div class="ws-profil-step-hdr">
              <span class="ws-profil-step-icon">⚙️</span>
              <div>
                <div class="ws-profil-step-title">Préférences & Contexte IA</div>
                <div class="ws-profil-step-sub">Personnalisez le comportement de vos agents</div>
              </div>
            </div>
            <div class="ws-pf-grid">
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Langue de travail</label>
                <select class="ws-input" [(ngModel)]="profilForm.langue">
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="de">Deutsch</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
              <div class="ws-pf-field">
                <label class="ws-pf-lbl">Devise par défaut</label>
                <select class="ws-input" [(ngModel)]="profilForm.devise">
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="XOF">XOF (FCFA)</option>
                  <option value="MAD">MAD (DH)</option>
                </select>
              </div>
            </div>
            <div class="ws-pf-field" style="margin-top:.5rem">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem">
                <label class="ws-pf-lbl" style="margin:0">
                  Contexte IA
                  <span style="color:#475569;font-weight:400"> — injecté dans chaque tâche</span>
                </label>
                <button class="ws-btn-secondary ws-btn-xs" (click)="generateContext()"
                  [disabled]="generatingContext">
                  <span *ngIf="!generatingContext && agents.length > 0">✨ Générer avec l'IA</span>
                  <span *ngIf="!generatingContext && agents.length === 0">⚡ Générer automatiquement</span>
                  <span *ngIf="generatingContext" class="ws-spin"></span>
                </button>
              </div>
              <textarea class="ws-input ws-textarea" [(ngModel)]="profilForm.contexteSup" rows="6"
                placeholder="Laissez l'IA rédiger ce contexte ou rédigez-le vous-même…"></textarea>
              <div *ngIf="generatingContext" class="ws-profil-generating">
                <span class="ws-spin"></span> Génération en cours…
              </div>
            </div>
            <div *ngIf="profilSaved" class="ws-profil-saved">
              ✅ Profil enregistré — vos agents utiliseront ces informations automatiquement.
            </div>
          </div>

          <!-- ── Navigation ── -->
          <div *ngIf="profilStepError" class="ws-pf-step-error">
            {{ profilStepError }}
          </div>
          <div class="ws-profil-nav">
            <button class="ws-btn-secondary" (click)="profilPrevStep()" [disabled]="profilStep === 1">
              ← Précédent
            </button>
            <span class="ws-profil-nav-counter">{{ profilStep }} / {{ profilStepCount }}</span>
            <button *ngIf="profilStep < profilStepCount" class="ws-btn-secondary" (click)="profilNextStep()">
              Suivant →
            </button>
          </div>
        </div><!-- /ws-profil-card -->

        <p class="ws-profil-hint">
          Ces informations sont automatiquement injectées dans chaque tâche pour que vos agents
          personnalisent emails, rapports et documents avec vos vraies coordonnées.
        </p>
      </div><!-- /ws-profil-wizard -->
    </div>

<!-- ══ MODAL — Contact Picker ════════════════════════════════════════════ -->
<div class="ws-overlay" *ngIf="showContactPicker" (click)="showContactPicker=false">
  <div class="ws-modal ws-modal--picker" (click)="$event.stopPropagation()">
    <div class="ws-modal-hdr">
      <span class="ws-modal-ttl">👥 Sélectionner des contacts</span>
      <button class="ws-modal-x" (click)="showContactPicker=false">✕</button>
    </div>
    <div class="ws-picker-modal-body">
      <div class="ws-picker-search-row">
        <input class="ws-input" [(ngModel)]="contactPickerSearch"
          placeholder="Rechercher par nom, email, entreprise…" autocomplete="off"/>
        <span class="ws-picker-sel-count">{{ contactPickerTemp.length }} sélectionné(s)</span>
      </div>
      <div class="ws-picker-list">
        <div *ngIf="filteredPickerClients.length === 0" class="ws-empty">Aucun contact trouvé.</div>
        <label *ngFor="let c of filteredPickerClients" class="ws-picker-item"
          [class.ws-picker-item--checked]="contactPickerTemp.includes(c.code)"
          (click)="toggleContactPick(c.code)">
          <div class="ws-picker-check">
            <span *ngIf="contactPickerTemp.includes(c.code)">✓</span>
          </div>
          <div class="ws-picker-item-info">
            <div class="ws-picker-item-name">{{ c.nom }} {{ c.prenoms }}</div>
            <div class="ws-picker-item-sub">
              <code class="ws-code-chip" style="font-size:.68rem">{{ c.code }}</code>
              <span *ngIf="c.entrepriseName">{{ c.entrepriseName }}</span>
              <span *ngIf="c.email" class="ws-picker-email">✉ {{ c.email }}</span>
            </div>
          </div>
        </label>
      </div>
    </div>
    <div class="ws-picker-modal-footer">
      <button class="ws-btn-secondary" (click)="contactPickerTemp=[]">Tout désélectionner</button>
      <div style="display:flex;gap:.5rem">
        <button class="ws-btn-cancel" (click)="showContactPicker=false">Annuler</button>
        <button class="ws-btn-primary" (click)="confirmContactPicker()">
          Valider ({{ contactPickerTemp.length }})
        </button>
      </div>
    </div>
  </div>
</div>

<!-- ══ MODAL — Product Picker ════════════════════════════════════════════ -->
<div class="ws-overlay" *ngIf="showProductPicker" (click)="showProductPicker=false">
  <div class="ws-modal ws-modal--picker" (click)="$event.stopPropagation()">
    <div class="ws-modal-hdr">
      <span class="ws-modal-ttl">📦 Sélectionner des produits</span>
      <button class="ws-modal-x" (click)="showProductPicker=false">✕</button>
    </div>
    <div class="ws-picker-modal-body">
      <div class="ws-picker-search-row">
        <input class="ws-input" [(ngModel)]="productPickerSearch"
          placeholder="Rechercher par nom, code…" autocomplete="off"/>
        <span class="ws-picker-sel-count">{{ productPickerTemp.length }} sélectionné(s)</span>
      </div>
      <div class="ws-picker-list">
        <div *ngIf="filteredPickerProducts.length === 0" class="ws-empty">Aucun produit trouvé.</div>
        <label *ngFor="let p of filteredPickerProducts" class="ws-picker-item"
          [class.ws-picker-item--checked]="productPickerTemp.includes(p.code)"
          (click)="toggleProductPick(p.code)">
          <div class="ws-picker-check">
            <span *ngIf="productPickerTemp.includes(p.code)">✓</span>
          </div>
          <div class="ws-picker-item-thumb" *ngIf="p.photos?.length || p.videos?.length">
            <img *ngIf="p.photos?.length" [src]="p.photos[0]" style="width:36px;height:36px;object-fit:cover;border-radius:6px"/>
            <div *ngIf="!p.photos?.length && p.videos?.length" style="width:36px;height:36px;border-radius:6px;position:relative;overflow:hidden">
              <video [src]="p.videos[0]" style="width:36px;height:36px;object-fit:cover" preload="metadata" muted playsinline></video>
              <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:.8rem;color:#fff;background:rgba(0,0,0,.3)">▶</div>
            </div>
          </div>
          <div class="ws-picker-item-info">
            <div class="ws-picker-item-name">{{ p.nom }}</div>
            <div class="ws-picker-item-sub">
              <code class="ws-code-chip" style="font-size:.68rem">{{ p.code }}</code>
              <span *ngIf="p.prixPromo" class="ws-price-promo" style="font-size:.75rem">{{ p.prixPromo | number:'1.0-0' }}</span>
              <span [class.ws-price-crossed]="p.prixPromo" style="font-size:.75rem">{{ p.prix | number:'1.0-0' }}</span>
            </div>
          </div>
        </label>
      </div>
    </div>
    <div class="ws-picker-modal-footer">
      <button class="ws-btn-secondary" (click)="productPickerTemp=[]">Tout désélectionner</button>
      <div style="display:flex;gap:.5rem">
        <button class="ws-btn-cancel" (click)="showProductPicker=false">Annuler</button>
        <button class="ws-btn-primary" (click)="confirmProductPicker()">
          Valider ({{ productPickerTemp.length }})
        </button>
      </div>
    </div>
  </div>
</div>

<!-- ══ MODAL — Détail Profil ════════════════════════════════════════════ -->
<div class="ws-overlay" *ngIf="showProfilDetail" (click)="showProfilDetail=false">
  <div class="ws-modal ws-modal--profil" (click)="$event.stopPropagation()">
    <div class="ws-modal-hdr">
      <span class="ws-modal-ttl">Profil Expéditeur</span>
      <button class="ws-modal-x" (click)="showProfilDetail=false">✕</button>
    </div>
    <div class="ws-pdmodal-body">

      <!-- Carte identité -->
      <div class="ws-pdmodal-hero">
        <div class="ws-pdmodal-avatar">
          {{ (profilForm.prenom[0]||'?') }}{{ (profilForm.nom[0]||'') }}
        </div>
        <div class="ws-pdmodal-hero-info">
          <div class="ws-pdmodal-fullname">
            {{ profilForm.prenom || '—' }} {{ profilForm.nom }}
          </div>
          <div class="ws-pdmodal-poste" *ngIf="profilForm.poste">{{ profilForm.poste }}</div>
          <div class="ws-pdmodal-dept" *ngIf="profilForm.departement">{{ profilForm.departement }}</div>
          <div class="ws-pdmodal-societe" *ngIf="profilForm.societe">
            🏢 {{ profilForm.societe }}
            <span *ngIf="profilForm.secteur" class="ws-pdmodal-secteur">— {{ profilForm.secteur }}</span>
          </div>
        </div>
      </div>

      <div class="ws-pdmodal-grid">

        <!-- Contact -->
        <div class="ws-pdmodal-section">
          <div class="ws-pdmodal-section-ttl">Contact</div>
          <div class="ws-pdmodal-row" *ngIf="profilForm.email">
            <span class="ws-pdmodal-icon">✉</span>
            <span>{{ profilForm.email }}</span>
          </div>
          <div class="ws-pdmodal-row" *ngIf="profilForm.telephone">
            <span class="ws-pdmodal-icon">📱</span>
            <span>{{ profilForm.telephone }}</span>
          </div>
          <div class="ws-pdmodal-row" *ngIf="profilForm.telephoneFixe">
            <span class="ws-pdmodal-icon">☎</span>
            <span>{{ profilForm.telephoneFixe }}</span>
          </div>
          <div class="ws-pdmodal-row" *ngIf="profilForm.linkedin">
            <span class="ws-pdmodal-icon">in</span>
            <span>{{ profilForm.linkedin }}</span>
          </div>
          <div class="ws-pdmodal-row" *ngIf="profilForm.siteWeb">
            <span class="ws-pdmodal-icon">🌐</span>
            <span>{{ profilForm.siteWeb }}</span>
          </div>
          <div class="ws-pdmodal-row" *ngIf="profilForm.adresse">
            <span class="ws-pdmodal-icon">📍</span>
            <span>{{ profilForm.adresse }}</span>
          </div>
        </div>

        <!-- Préférences -->
        <div class="ws-pdmodal-section">
          <div class="ws-pdmodal-section-ttl">Préférences</div>
          <div class="ws-pdmodal-kv">
            <span class="ws-pdmodal-k">Langue</span>
            <span class="ws-pdmodal-v">{{ profilForm.langue === 'fr' ? '🇫🇷 Français' : profilForm.langue === 'en' ? '🇬🇧 English' : profilForm.langue === 'es' ? '🇪🇸 Español' : profilForm.langue === 'de' ? '🇩🇪 Deutsch' : profilForm.langue === 'ar' ? '🇸🇦 العربية' : profilForm.langue }}</span>
          </div>
          <div class="ws-pdmodal-kv">
            <span class="ws-pdmodal-k">Devise</span>
            <span class="ws-pdmodal-v">{{ profilForm.devise }}</span>
          </div>
          <div class="ws-pdmodal-kv">
            <span class="ws-pdmodal-k">Ton email</span>
            <span class="ws-pdmodal-v ws-pdmodal-badge">{{ profilForm.tonEmail }}</span>
          </div>
        </div>

      </div>

      <!-- Signature -->
      <div class="ws-pdmodal-section ws-pdmodal-section--full" *ngIf="profilForm.signature">
        <div class="ws-pdmodal-section-ttl">Signature email</div>
        <pre class="ws-pdmodal-signature">{{ profilForm.signature }}</pre>
      </div>

      <!-- Contexte IA -->
      <div class="ws-pdmodal-section ws-pdmodal-section--full" *ngIf="profilForm.contexteSup">
        <div class="ws-pdmodal-section-ttl">Contexte IA injecté dans les tâches</div>
        <p class="ws-pdmodal-context">{{ profilForm.contexteSup }}</p>
      </div>

    </div>
    <div class="ws-pdmodal-footer">
      <button class="ws-btn-secondary" (click)="showProfilDetail=false; activeTab='profil'; profilStep=1">
        Modifier le profil
      </button>
      <button class="ws-btn-primary" (click)="showProfilDetail=false">Fermer</button>
    </div>
  </div>
</div>

<!-- ══ MODAL — Types d'agents ══════════════════════════════════════════ -->
<!-- ══ MODAL — Types d'agents ══════════════════════════════════════════ -->
<div class="ws-overlay" *ngIf="showAgentTypesModal">
  <div class="ws-modal ws-modal--lg">
    <div class="ws-modal-hdr">
      <span class="ws-modal-ttl">🤖 Types d'agents — Capacités détaillées</span>
      <button class="ws-modal-x" (click)="showAgentTypesModal=false">✕</button>
    </div>
    <div class="ws-modal-body ws-agent-types-grid">
      <div *ngFor="let a of agentTypeDetails" class="ws-at-card" [style.border-color]="a.color+'44'">
        <div class="ws-at-card-hdr" [style.background]="a.color+'18'">
          <span class="ws-at-icon">{{ a.icon }}</span>
          <div>
            <div class="ws-at-name">{{ a.l }}</div>
            <div class="ws-at-resume">{{ a.resume }}</div>
          </div>
        </div>
        <div class="ws-at-card-body">
          <div class="ws-at-section-lbl">✅ Compétences</div>
          <ul class="ws-at-list">
            <li *ngFor="let c of a.competences">{{ c }}</li>
          </ul>
          <div class="ws-at-section-lbl">💡 Cas d'usage</div>
          <div class="ws-at-tags">
            <span *ngFor="let u of a.usecases" class="ws-at-tag" [style.background]="a.color+'22'" [style.color]="a.color">{{ u }}</span>
          </div>
          <div class="ws-at-limit">⚠ {{ a.limits }}</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ══ MODAL — Clients ══════════════════════════════════════════════════ -->
<div class="ws-overlay" *ngIf="showClientModal">
  <div class="ws-modal ws-modal--md">
    <div class="ws-modal-hdr">
      <span class="ws-modal-ttl">👥 Mes Clients</span>
      <div style="display:flex;gap:.5rem;align-items:center">
        <button class="ws-btn-secondary" style="font-size:.75rem;padding:.25rem .65rem" (click)="downloadClientsXlsx()">⬇ XLSX</button>
        <button class="ws-modal-x" (click)="showClientModal=false">✕</button>
      </div>
    </div>
    <!-- Onglets -->
    <div class="ws-modal-tabs">
      <button class="ws-modal-tab" [class.ws-modal-tab--active]="clientTab==='form'" (click)="clientTab='form'">
        {{ editingClientIdx>=0 ? '✏ Modifier' : '➕ Ajouter' }}
      </button>
      <button class="ws-modal-tab" [class.ws-modal-tab--active]="clientTab==='list'" (click)="clientTab='list'">
        📋 Liste <span class="ws-tab-badge" *ngIf="clients.length">{{ clients.length }}</span>
      </button>
      <button class="ws-modal-tab" [class.ws-modal-tab--active]="clientTab==='trash'" (click)="clientTab='trash'">
        🗑 Corbeille <span class="ws-tab-badge ws-tab-badge--red" *ngIf="clientsTrash.length">{{ clientsTrash.length }}</span>
      </button>
    </div>
    <div class="ws-modal-body">

      <!-- TAB FORM -->
      <ng-container *ngIf="clientTab==='form'">
        <div class="ws-qf-grid ws-qf-grid--2col">
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Code client <span style="color:#475569;font-weight:400">(généré auto)</span></label>
            <input class="ws-input ws-input--readonly" [value]="clientForm.code" readonly/>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Nom *</label>
            <input class="ws-input" [(ngModel)]="clientForm.nom" placeholder="Nom de famille"/>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Prénom(s)</label>
            <input class="ws-input" [(ngModel)]="clientForm.prenoms" placeholder="Prénom(s)"/>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Contact (téléphone)</label>
            <input class="ws-input" [(ngModel)]="clientForm.contact" placeholder="+33 6 12 34 56 78"/>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Email *</label>
            <input class="ws-input" type="email" [(ngModel)]="clientForm.email" placeholder="client@exemple.com"/>
          </div>
          <div class="ws-qf-field">
            <label class="ws-qf-lbl">Entreprise</label>
            <input class="ws-input" [(ngModel)]="clientForm.entrepriseName" placeholder="Nom de l'entreprise"/>
          </div>
        </div>
        <div class="ws-qf-actions" style="margin-top:.75rem">
          <button class="ws-btn-cancel" (click)="resetClientForm()">Réinitialiser</button>
          <button class="ws-btn-primary" (click)="saveClient()">
            {{ editingClientIdx>=0 ? '✏ Mettre à jour' : '＋ Ajouter le client' }}
          </button>
        </div>
      </ng-container>

      <!-- TAB LIST -->
      <ng-container *ngIf="clientTab==='list'">
        <div *ngIf="clients.length===0" class="ws-empty">Aucun client actif.</div>
        <table class="ws-table" *ngIf="clients.length>0">
          <thead><tr><th>Code</th><th>Nom</th><th>Email</th><th>Entreprise</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let c of clients; let i=index">
              <td data-label="Code"><code class="ws-code-chip">{{ c.code }}</code></td>
              <td data-label="Nom">{{ c.nom }} {{ c.prenoms }}</td>
              <td data-label="Email">{{ c.email }}</td>
              <td data-label="Entreprise">{{ c.entrepriseName||'—' }}</td>
              <td data-label="Actions">
                <div class="ws-row-actions">
                  <button class="ws-act-btn ws-act-edit" (click)="editClient(i); clientTab='form'" title="Modifier">✏</button>
                  <button class="ws-act-btn ws-act-del" (click)="softDeleteClient(i)" title="Mettre à la corbeille">🗑</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </ng-container>

      <!-- TAB TRASH -->
      <ng-container *ngIf="clientTab==='trash'">
        <div *ngIf="clientsTrash.length===0" class="ws-empty">Corbeille vide.</div>
        <table class="ws-table" *ngIf="clientsTrash.length>0">
          <thead><tr><th>Code</th><th>Nom</th><th>Email</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let c of clientsTrash; let i=index" class="ws-row-deleted">
              <td data-label="Code"><code class="ws-code-chip ws-code-chip--dim">{{ c.code }}</code></td>
              <td data-label="Nom">{{ c.nom }} {{ c.prenoms }}</td>
              <td data-label="Email">{{ c.email }}</td>
              <td data-label="Actions">
                <div class="ws-row-actions">
                  <button class="ws-act-btn ws-act-restore" (click)="restoreClient(i)" title="Restaurer">↩</button>
                  <button class="ws-act-btn ws-act-del" (click)="hardDeleteClient(i)" title="Supprimer définitivement">✕</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="clientsTrash.length>0" style="margin-top:.75rem;display:flex;justify-content:flex-end">
          <button class="ws-btn-cancel" style="font-size:.75rem" (click)="emptyClientTrash()">Vider la corbeille</button>
        </div>
      </ng-container>

    </div>
  </div>
</div>

<!-- ══ MODAL — Produits ════════════════════════════════════════════════ -->
<div class="ws-overlay" *ngIf="showProductModal">
  <div class="ws-modal ws-modal--xl">
    <div class="ws-modal-hdr">
      <span class="ws-modal-ttl">📦 Mes Produits</span>
      <div style="display:flex;gap:.5rem;align-items:center">
        <button class="ws-btn-secondary" style="font-size:.75rem;padding:.25rem .65rem" (click)="downloadProductsXlsx()">⬇ XLSX</button>
        <button class="ws-modal-x" (click)="showProductModal=false">✕</button>
      </div>
    </div>
    <!-- Onglets -->
    <div class="ws-modal-tabs">
      <button class="ws-modal-tab" [class.ws-modal-tab--active]="productTab==='form'" (click)="productTab='form'">
        {{ editingProductIdx>=0 ? '✏ Modifier' : '➕ Ajouter' }}
      </button>
      <button class="ws-modal-tab" [class.ws-modal-tab--active]="productTab==='list'" (click)="productTab='list'">
        📋 Liste <span class="ws-tab-badge" *ngIf="products.length">{{ products.length }}</span>
      </button>
      <button class="ws-modal-tab" [class.ws-modal-tab--active]="productTab==='trash'" (click)="productTab='trash'">
        🗑 Corbeille <span class="ws-tab-badge ws-tab-badge--red" *ngIf="productsTrash.length">{{ productsTrash.length }}</span>
      </button>
    </div>
    <div class="ws-modal-body">

      <!-- TAB FORM -->
      <ng-container *ngIf="productTab==='form'">
        <div class="ws-prod-form">
          <div class="ws-qf-grid ws-qf-grid--2col">
            <div class="ws-qf-field">
              <label class="ws-qf-lbl">Code produit <span style="color:#475569;font-weight:400">(généré auto)</span></label>
              <input class="ws-input ws-input--readonly" [value]="productForm.code" readonly/>
            </div>
            <div class="ws-qf-field">
              <label class="ws-qf-lbl">Nom *</label>
              <input class="ws-input" [(ngModel)]="productForm.nom" placeholder="Nom du produit"/>
            </div>
            <div class="ws-qf-field">
              <label class="ws-qf-lbl">Prix (€)</label>
              <input class="ws-input" type="number" [(ngModel)]="productForm.prix" placeholder="0.00"/>
            </div>
            <div class="ws-qf-field">
              <label class="ws-qf-lbl">Prix promo (€)</label>
              <input class="ws-input" type="number" [(ngModel)]="productForm.prixPromo" placeholder="0.00"/>
            </div>
            <div class="ws-qf-field ws-qf-full">
              <label class="ws-qf-lbl">Description</label>
              <textarea class="ws-input ws-textarea" [(ngModel)]="productForm.description" rows="2" placeholder="Description du produit…"></textarea>
            </div>
          </div>
          <div class="ws-prod-section">
            <div class="ws-prod-section-lbl">🔀 Variantes</div>
            <div class="ws-variant-row" *ngFor="let v of productForm.variantes; let vi=index">
              <input class="ws-input ws-var-in" [(ngModel)]="v.nom" placeholder="Nom variante (ex: Couleur)"/>
              <input class="ws-input ws-var-in" [(ngModel)]="v.valeur" placeholder="Valeur (ex: Rouge, XL…)"/>
              <input class="ws-input ws-var-in" [(ngModel)]="v.prix" type="number" placeholder="Prix variante"/>
              <button class="ws-act-btn ws-act-del" (click)="removeVariant(vi)">×</button>
            </div>
            <button class="ws-btn-cancel" style="font-size:.75rem;margin-top:.35rem" (click)="addVariant()">＋ Ajouter variante</button>
          </div>
          <div class="ws-prod-section">
            <div class="ws-prod-section-lbl">⭐ Mentions spéciales</div>
            <div class="ws-variant-row" *ngFor="let m of productForm.mentions; let mi=index">
              <select class="ws-input ws-var-in" [(ngModel)]="m.type" style="max-width:160px">
                <option value="ingredients">Ingrédients</option>
                <option value="allergenes">Allergènes</option>
                <option value="composition">Composition</option>
                <option value="utilisation">Mode d'emploi</option>
                <option value="conservation">Conservation</option>
                <option value="certification">Certification</option>
                <option value="autre">Autre</option>
              </select>
              <textarea class="ws-input ws-var-in" [(ngModel)]="m.contenu" rows="1" placeholder="Contenu…" style="flex:2"></textarea>
              <button class="ws-act-btn ws-act-del" (click)="removeMention(mi)">×</button>
            </div>
            <button class="ws-btn-cancel" style="font-size:.75rem;margin-top:.35rem" (click)="addMention()">＋ Ajouter mention</button>
          </div>
          <div class="ws-prod-section">
            <div class="ws-prod-section-lbl">📸 Photos & 🎬 Vidéos (MinIO)</div>
            <div class="ws-media-upload-row">
              <label class="ws-upload-btn">📷 Photos<input type="file" multiple accept="image/*" class="ws-file-hidden" (change)="uploadProductMedia($event,'photos')"/></label>
              <label class="ws-upload-btn">🎬 Vidéos<input type="file" multiple accept="video/*" class="ws-file-hidden" (change)="uploadProductMedia($event,'videos')"/></label>
              <span *ngIf="uploadingMedia" class="ws-spin" style="margin-left:.5rem"></span>
            </div>
            <div class="ws-media-preview" *ngIf="productForm.photos.length||productForm.videos.length">
              <div class="ws-media-thumb" *ngFor="let u of productForm.photos; let pi=index">
                <img [src]="u" class="ws-thumb-img"/>
                <button class="ws-thumb-del" (click)="productForm.photos.splice(pi,1)">×</button>
              </div>
              <div class="ws-media-thumb ws-media-thumb--video" *ngFor="let u of productForm.videos; let vi=index">
                <video [src]="u" class="ws-thumb-vid" preload="metadata" muted playsinline></video>
                <div class="ws-thumb-vid-overlay">▶</div>
                <button class="ws-thumb-del" (click)="productForm.videos.splice(vi,1)">×</button>
              </div>
            </div>
          </div>
          <div class="ws-qf-actions">
            <button class="ws-btn-cancel" (click)="resetProductForm()">Réinitialiser</button>
            <button class="ws-btn-primary" (click)="saveProduct()">
              {{ editingProductIdx>=0 ? '✏ Mettre à jour' : '＋ Enregistrer le produit' }}
            </button>
          </div>
        </div>
      </ng-container>

      <!-- TAB LIST -->
      <ng-container *ngIf="productTab==='list'">
        <div *ngIf="products.length===0" class="ws-empty">Aucun produit actif.</div>
        <div class="ws-pcard-list" *ngIf="products.length>0">
          <div *ngFor="let p of products; let i=index"
            class="ws-pcard" [class.ws-pcard--open]="expandedProductIdx===i">

            <!-- ── En-tête cliquable ── -->
            <div class="ws-pcard-hdr" (click)="toggleProductExpand(i)">
              <div class="ws-pcard-hdr-left">
                <div class="ws-pcard-thumb" *ngIf="p.photos?.length">
                  <img [src]="p.photos[0]" class="ws-pcard-thumb-img" loading="lazy"/>
                </div>
                <div class="ws-pcard-thumb ws-pcard-thumb--empty" *ngIf="!p.photos?.length">📦</div>
                <div>
                  <div class="ws-pcard-name">{{ p.nom }}</div>
                  <code class="ws-code-chip">{{ p.code }}</code>
                </div>
              </div>
              <div class="ws-pcard-hdr-right">
                <div class="ws-pcard-price-block">
                  <span *ngIf="p.prixPromo" class="ws-price-promo">{{ p.prixPromo | number:'1.0-0' }}</span>
                  <span [class.ws-price-crossed]="p.prixPromo" class="ws-pcard-prix">{{ p.prix | number:'1.0-0' }}</span>
                </div>
                <div class="ws-pcard-badges">
                  <span *ngIf="p.variantes?.length" class="ws-count-badge">{{ p.variantes.length }} var.</span>
                  <span *ngIf="(p.photos?.length||0)+(p.videos?.length||0)" class="ws-count-badge">
                    {{ (p.photos?.length||0)+(p.videos?.length||0) }} 📎
                  </span>
                </div>
                <div class="ws-row-actions" (click)="$event.stopPropagation()">
                  <button class="ws-act-btn ws-act-edit" (click)="editProduct(i); productTab='form'" title="Modifier">✏</button>
                  <button class="ws-act-btn ws-act-del" (click)="softDeleteProduct(i)" title="Corbeille">🗑</button>
                </div>
                <span class="ws-pcard-chevron" [class.ws-pcard-chevron--open]="expandedProductIdx===i">▾</span>
              </div>
            </div>

            <!-- ── Corps dépliable ── -->
            <div class="ws-pcard-body" *ngIf="expandedProductIdx===i">

              <div *ngIf="p.description" class="ws-pcard-section">
                <div class="ws-pcard-section-lbl">Description</div>
                <p class="ws-pcard-desc">{{ p.description }}</p>
              </div>

              <div *ngIf="p.variantes?.length" class="ws-pcard-section">
                <div class="ws-pcard-section-lbl">Variantes</div>
                <div class="ws-pcard-variants">
                  <div *ngFor="let v of p.variantes" class="ws-pcard-variant-row">
                    <span class="ws-pcard-variant-nom">{{ v.nom }}</span>
                    <span *ngIf="v.valeur" class="ws-pcard-variant-val">{{ v.valeur }}</span>
                    <span *ngIf="v.prix" class="ws-pcard-variant-prix">{{ v.prix | number:'1.0-0' }}</span>
                    <span *ngIf="v.note" class="ws-pcard-variant-note">{{ v.note }}</span>
                  </div>
                </div>
              </div>

              <div *ngIf="p.mentions?.length" class="ws-pcard-section">
                <div class="ws-pcard-section-lbl">Mentions spéciales</div>
                <div class="ws-pcard-mentions">
                  <span *ngFor="let m of p.mentions" class="ws-pcard-mention-chip">{{ m.texte }}</span>
                </div>
              </div>

              <div *ngIf="p.photos?.length" class="ws-pcard-section">
                <div class="ws-pcard-section-lbl">Photos ({{ p.photos.length }})</div>
                <div class="ws-pcard-photos">
                  <img *ngFor="let ph of p.photos" [src]="ph" class="ws-pcard-photo" loading="lazy"/>
                </div>
              </div>

              <div *ngIf="p.videos?.length" class="ws-pcard-section">
                <div class="ws-pcard-section-lbl">Vidéos ({{ p.videos.length }})</div>
                <div class="ws-pcard-photos">
                  <div *ngFor="let v of p.videos" class="ws-pcard-video-wrap">
                    <video [src]="v" class="ws-pcard-photo ws-pcard-video" preload="metadata" muted playsinline></video>
                    <div class="ws-pcard-video-play">▶</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </ng-container>

      <!-- TAB TRASH -->
      <ng-container *ngIf="productTab==='trash'">
        <div *ngIf="productsTrash.length===0" class="ws-empty">Corbeille vide.</div>
        <table class="ws-table" *ngIf="productsTrash.length>0">
          <thead><tr><th>Code</th><th>Nom</th><th>Prix</th><th>Actions</th></tr></thead>
          <tbody>
            <tr *ngFor="let p of productsTrash; let i=index" class="ws-row-deleted">
              <td data-label="Code"><code class="ws-code-chip ws-code-chip--dim">{{ p.code }}</code></td>
              <td data-label="Nom">{{ p.nom }}</td>
              <td data-label="Prix">{{ p.prix }}€</td>
              <td data-label="Actions">
                <div class="ws-row-actions">
                  <button class="ws-act-btn ws-act-restore" (click)="restoreProduct(i)" title="Restaurer">↩</button>
                  <button class="ws-act-btn ws-act-del" (click)="hardDeleteProduct(i)" title="Supprimer définitivement">✕</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="productsTrash.length>0" style="margin-top:.75rem;display:flex;justify-content:flex-end">
          <button class="ws-btn-cancel" style="font-size:.75rem" (click)="emptyProductTrash()">Vider la corbeille</button>
        </div>
      </ng-container>

    </div><!-- /ws-wrap -->
  </div><!-- /ws-content-area -->
</div><!-- /ws-page -->
`,
  styles: [`
:host {
  /* ── STANDARD LIGHT THEME (Default) ── */
  --ws-bg: #f8fafc;
  --ws-sidebar-bg: #ffffff;
  --ws-card: #ffffff;
  --ws-card-alt: #f1f5f9;
  --ws-card-subtle: #f8fafc;
  --ws-border: #e2e8f0;
  --ws-border-subtle: #f1f5f9;
  --ws-border-focus: #2563eb;
  --ws-text: #0f172a;
  --ws-text-muted: #64748b;
  --ws-text-dim: #94a3b8;
  --ws-primary: #2563eb;
  --ws-primary-hover: #1d4ed8;
  --ws-primary-subtle: #eff6ff;
  --ws-primary-border: #bfdbfe;
  --ws-primary-text: #1d4ed8;
  --ws-table-th: #f8fafc;
  --ws-table-hover: #f1f5f9;
  --ws-input-bg: #ffffff;
  --ws-input-border: #cbd5e1;
  --ws-modal-bg: #ffffff;
  --ws-modal-hdr: #f8fafc;
  --ws-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08);
  --ws-shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --ws-shadow-lg: 0 10px 25px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
}

:host-context(html[data-theme="dark"]),
html[data-theme="dark"] :host {
  /* ── STANDARD DARK THEME (Slate Neutral) ── */
  --ws-bg: #0f172a;
  --ws-sidebar-bg: #1e293b;
  --ws-card: #1e293b;
  --ws-card-alt: #182234;
  --ws-card-subtle: #0f172a;
  --ws-border: #334155;
  --ws-border-subtle: #1e293b;
  --ws-border-focus: #3b82f6;
  --ws-text: #f8fafc;
  --ws-text-muted: #94a3b8;
  --ws-text-dim: #64748b;
  --ws-primary: #2563eb;
  --ws-primary-hover: #1d4ed8;
  --ws-primary-subtle: rgba(37, 99, 235, 0.15);
  --ws-primary-border: rgba(37, 99, 235, 0.35);
  --ws-primary-text: #93c5fd;
  --ws-table-th: #182234;
  --ws-table-hover: #243248;
  --ws-input-bg: #0f172a;
  --ws-input-border: #334155;
  --ws-modal-bg: #1e293b;
  --ws-modal-hdr: #182234;
  --ws-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
  --ws-shadow-card: 0 4px 12px rgba(0,0,0,0.25);
  --ws-shadow-lg: 0 20px 35px -5px rgba(0,0,0,0.4);
}

/* ── Layout général : sidebar + contenu ── */
.ws-page {
  min-height: 100vh;
  background: var(--ws-bg);
  color: var(--ws-text);
  position: relative;
  overflow: hidden;
  overflow: clip;
  display: flex;
  align-items: flex-start;
  transition: background .2s, color .2s;
}

/* ── Sidebar verticale ── */
.ws-sidebar {
  position: fixed;
  top: 64px;
  left: 0;
  bottom: 0;
  width: 232px;
  z-index: 600;
  display: flex;
  flex-direction: column;
  background: var(--ws-sidebar-bg);
  border-right: 1px solid var(--ws-border);
  box-shadow: var(--ws-shadow);
  transition: width .24s cubic-bezier(.4,0,.2,1), background .2s, border-color .2s;
  overflow: hidden;
}
.ws-sidebar--collapsed { width: 60px; }

/* Bouton collapse (chevron) */
.ws-sb-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 40px;
  flex-shrink: 0;
  background: var(--ws-card-alt);
  border: none;
  border-bottom: 1px solid var(--ws-border);
  color: var(--ws-text-muted);
  cursor: pointer;
  transition: background .2s, color .2s;
}
.ws-sb-toggle:hover { background: var(--ws-primary-subtle); color: var(--ws-primary); }
.ws-sb-toggle svg { flex-shrink: 0; transition: transform .24s; }

/* Liste nav */
.ws-sb-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--ws-border) transparent;
  padding: .6rem .45rem;
  display: flex;
  flex-direction: column;
  gap: .25rem;
}
.ws-sb-nav::-webkit-scrollbar { width: 4px; }
.ws-sb-nav::-webkit-scrollbar-thumb { background: var(--ws-border); border-radius: 4px; }

/* Bouton nav item */
.ws-sb-item {
  display: flex;
  align-items: center;
  gap: .65rem;
  width: 100%;
  padding: .58rem .75rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ws-text-muted);
  font-size: .88rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background .18s, color .18s, border-color .18s;
  text-align: left;
  position: relative;
}
.ws-sb-item:hover {
  background: var(--ws-primary-subtle);
  border-color: var(--ws-primary-border);
  color: var(--ws-primary-text);
}
.ws-sb-item--active {
  background: var(--ws-primary-subtle);
  border-color: var(--ws-primary-border);
  color: var(--ws-primary-text);
  font-weight: 600;
}
.ws-sb-item--active::before {
  content: '';
  position: absolute;
  left: 0; top: 18%; bottom: 18%;
  width: 3.5px;
  background: var(--ws-primary);
  border-radius: 0 3px 3px 0;
}
.ws-sb-icon { font-size: 1.05rem; flex-shrink: 0; width: 22px; text-align: center; }
.ws-sb-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity .2s, max-width .24s;
  max-width: 155px;
}
.ws-sb-badge {
  margin-left: auto;
  flex-shrink: 0;
  transition: opacity .2s;
  font-size: .68rem;
}

/* Collapsed */
.ws-sidebar--collapsed .ws-sb-label { opacity: 0; max-width: 0; }
.ws-sidebar--collapsed .ws-sb-badge { opacity: 0; }

/* ── Zone de contenu ── */
.ws-content-area {
  flex: 1;
  min-width: 0;
  margin-left: 232px;
  padding: 1.5rem 2rem;
  transition: margin-left .24s cubic-bezier(.4,0,.2,1);
}
.ws-sidebar-collapsed .ws-content-area { margin-left: 60px; }
.ws-wrap { max-width: none; margin-inline: 0; position: relative; z-index: 1; }

/* Header */
.ws-header { margin-bottom: 1.5rem; }
.ws-header-row { display: flex; align-items: center; gap: .75rem; margin-bottom: .75rem; flex-wrap: wrap; }
.ws-back-btn { color: var(--ws-text-muted); font-size: .86rem; text-decoration: none; padding: .35rem .8rem; border: 1px solid var(--ws-border); background: var(--ws-card); border-radius: 7px; transition: all .2s; }
.ws-back-btn:hover { color: var(--ws-primary); border-color: var(--ws-primary-border); background: var(--ws-primary-subtle); }
.ws-badge { display: flex; align-items: center; gap: .5rem; background: var(--ws-primary-subtle); border: 1px solid var(--ws-primary-border); border-radius: 20px; padding: .35rem 1rem; font-size: .84rem; color: var(--ws-primary-text); }
.ws-dot { width: 6px; height: 6px; background: var(--ws-primary); border-radius: 50%; }
.ws-theme-toggle-btn { display: flex; align-items: center; gap: .4rem; background: var(--ws-card); border: 1px solid var(--ws-border); border-radius: 20px; padding: .35rem .85rem; font-size: .82rem; font-weight: 500; color: var(--ws-text); cursor: pointer; transition: all .2s; box-shadow: var(--ws-shadow); margin-left: auto; }
.ws-theme-toggle-btn:hover { background: var(--ws-card-alt); border-color: var(--ws-border-focus); }
.ws-user-label { color: var(--ws-text-muted); font-size: .88rem; }
.ws-title { font-size: 1.95rem; font-weight: 800; color: var(--ws-text); letter-spacing: -.02em; margin: 0; }
.ws-sub { color: var(--ws-text-muted); font-size: .92rem; margin-top: .25rem; }

/* Compat legacy */
.ws-tabs { display: none; }
.ws-tab { background: var(--ws-card-alt); border: 1px solid var(--ws-border); border-radius: 8px; color: var(--ws-text-muted); cursor: pointer; font-size: .82rem; padding: .38rem .8rem; transition: all .2s; display: flex; align-items: center; gap: .35rem; white-space: nowrap; flex-shrink: 0; }
.ws-tab--active, .ws-tab:hover { background: var(--ws-primary-subtle); border-color: var(--ws-primary-border); color: var(--ws-primary-text); }
.ws-tab-icon { font-size: .92rem; }
.ws-tab-badge { background: #ef4444; border-radius: 10px; color: #fff; font-size: .68rem; font-weight: 700; padding: .1rem .45rem; }

/* Panel */
.ws-panel { background: var(--ws-card); border: 1px solid var(--ws-border); border-radius: 12px; overflow: hidden; box-shadow: var(--ws-shadow-card); }
.ws-panel-hdr { display: flex; align-items: center; justify-content: space-between; padding: 1.1rem 1.35rem; border-bottom: 1px solid var(--ws-border); gap: .75rem; flex-wrap: wrap; background: var(--ws-card); }
.ws-panel-title { font-size: 1.05rem; font-weight: 700; color: var(--ws-text); }
.ws-panel-hdr-actions { display: flex; gap: .5rem; align-items: center; }

/* Buttons */
.ws-btn-primary { background: var(--ws-primary); border: none; border-radius: 8px; color: #ffffff; cursor: pointer; font-size: .88rem; font-weight: 600; padding: .48rem 1.1rem; transition: all .2s; }
.ws-btn-primary:hover:not(:disabled) { background: var(--ws-primary-hover); transform: translateY(-1px); }
.ws-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.ws-btn-secondary { background: var(--ws-card-alt); border: 1px solid var(--ws-border); border-radius: 8px; color: var(--ws-text); cursor: pointer; font-size: .88rem; padding: .42rem .95rem; transition: all .2s; }
.ws-btn-secondary:hover { background: var(--ws-border); }
.ws-btn-cancel { background: var(--ws-card-alt); border: 1px solid var(--ws-border); border-radius: 8px; color: var(--ws-text-muted); cursor: pointer; font-size: .88rem; padding: .42rem .95rem; transition: all .2s; }
.ws-btn-cancel:hover { background: var(--ws-border); color: var(--ws-text); }

/* Quick Add Form */
.ws-quick-form { background: var(--ws-card-alt); border-bottom: 1px solid var(--ws-border); padding: 1.25rem 1.35rem; }
.ws-qf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: .75rem; margin-bottom: .75rem; }
.ws-qf-grid--1col { grid-template-columns: 1fr; }
.ws-qf-grid--2col { grid-template-columns: 1fr 1fr; }
.ws-qf-field { display: flex; flex-direction: column; gap: .3rem; }
.ws-qf-full { grid-column: 1/-1; }
.ws-qf-lbl { color: var(--ws-text-muted); font-size: .75rem; font-weight: 600; }
.ws-scheduling-row { display: flex; gap: 1.5rem; align-items: center; }
.ws-radio-label { display: flex; align-items: center; gap: .4rem; color: var(--ws-text); font-size: .85rem; cursor: pointer; }
.ws-radio-label input[type=radio] { accent-color: var(--ws-primary); }
.ws-download-link { display: inline-block; margin-top: .35rem; color: var(--ws-primary); font-size: .8rem; text-decoration: underline; }
.ws-download-link:hover { color: var(--ws-primary-hover); }

/* Form inputs */
.ws-input { background: var(--ws-input-bg); border: 1px solid var(--ws-input-border); border-radius: 7px; color: var(--ws-text); font-size: .85rem; padding: .5rem .75rem; width: 100%; transition: border-color .2s, box-shadow .2s; box-sizing: border-box; }
.ws-input:focus { border-color: var(--ws-border-focus); outline: none; box-shadow: 0 0 0 2px var(--ws-primary-subtle); }
.ws-textarea { resize: vertical; min-height: 80px; }
.ws-qf-actions { display: flex; gap: .5rem; justify-content: flex-end; }
.ws-error { color: #ef4444; font-size: .78rem; margin-bottom: .5rem; }

/* Search / Filter */
.ws-search-row { display: flex; gap: .5rem; flex-wrap: wrap; padding: .75rem 1.25rem; background: var(--ws-card-alt); border-bottom: 1px solid var(--ws-border); }
.ws-search { background: var(--ws-input-bg); border: 1px solid var(--ws-input-border); border-radius: 7px; color: var(--ws-text); font-size: .83rem; padding: .45rem .75rem; flex: 1; min-width: 180px; }
.ws-filter-sel { background: var(--ws-input-bg); border: 1px solid var(--ws-input-border); border-radius: 7px; color: var(--ws-text); font-size: .8rem; padding: .45rem .6rem; }

/* Tables */
.ws-table-wrap { overflow-x: auto; }
.ws-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.ws-table thead tr { background: var(--ws-table-th); }
.ws-table th { color: var(--ws-text-muted); font-size: .73rem; font-weight: 700; letter-spacing: .05em; padding: .75rem 1.25rem; text-align: left; text-transform: uppercase; border-bottom: 1px solid var(--ws-border); }
.ws-table td { padding: .75rem 1.25rem; border-bottom: 1px solid var(--ws-border); color: var(--ws-text); vertical-align: middle; }
.ws-table tr:hover td { background: var(--ws-table-hover); }
.ws-table tr:last-child td { border-bottom: none; }

.ws-agent-cell { display: flex; align-items: center; gap: .65rem; }
.ws-agent-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.ws-agent-initials { width: 32px; height: 32px; border-radius: 50%; background: var(--ws-primary); display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: .75rem; font-weight: 700; flex-shrink: 0; }
.ws-cell-name { color: var(--ws-text); font-weight: 600; }
.ws-cell-sub { color: var(--ws-text-muted); font-size: .75rem; margin-top: .15rem; }

.ws-type-badge { background: var(--ws-primary-subtle); border: 1px solid var(--ws-primary-border); border-radius: 4px; color: var(--ws-primary-text); font-size: .68rem; font-weight: 700; padding: .15rem .45rem; }
.ws-type-badge--sm { font-size: .65rem; }
.ws-code-badge { background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.3); border-radius: 4px; color: #059669; font-size: .72rem; font-weight: 700; font-family: monospace; padding: .15rem .45rem; letter-spacing: .04em; }
:host-context(html[data-theme="dark"]) .ws-code-badge, html[data-theme="dark"] .ws-code-badge { color: #34d399; }

.ws-status-dot { font-size: .75rem; font-weight: 600; }
.ws-status-dot--active { color: #10b981; }
.ws-status-dot--paused { color: #f59e0b; }
.ws-count-badge { background: var(--ws-primary-subtle); border-radius: 4px; color: var(--ws-primary-text); font-size: .75rem; padding: .15rem .5rem; }

/* Modals */
.ws-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; overflow-y: auto; padding: 2rem 1rem; pointer-events: auto; }
.ws-modal { background: var(--ws-modal-bg); border: 1px solid var(--ws-border); border-radius: 16px; width: 100%; box-shadow: var(--ws-shadow-lg); overflow: hidden; animation: wsModalIn .18s ease; }
.ws-modal--md { max-width: 700px; }
.ws-modal--lg { max-width: 1100px; }
.ws-modal--xl { max-width: 900px; }
@keyframes wsModalIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:none} }
.ws-modal-hdr { display: flex; align-items: center; justify-content: space-between; padding: .9rem 1.25rem; border-bottom: 1px solid var(--ws-border); background: var(--ws-modal-hdr); }
.ws-modal-ttl { font-size: .95rem; font-weight: 700; color: var(--ws-text); }
.ws-modal-x { background: none; border: none; color: var(--ws-text-muted); cursor: pointer; font-size: 1.1rem; padding: .2rem .5rem; border-radius: 5px; }
.ws-modal-x:hover { color: #ef4444; background: rgba(239,68,68,.1); }
.ws-modal-body { padding: 1.25rem; max-height: 80vh; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; }

.ws-modal-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--ws-border); background: var(--ws-card-alt); }
.ws-modal-tab { background: none; border: none; border-bottom: 2px solid transparent; color: var(--ws-text-muted); cursor: pointer; font-size: .82rem; padding: .65rem 1.1rem; transition: all .18s; display: flex; align-items: center; gap: .4rem; }
.ws-modal-tab:hover { color: var(--ws-primary-text); }
.ws-modal-tab--active { border-bottom-color: var(--ws-primary); color: var(--ws-primary-text); background: var(--ws-primary-subtle); font-weight: 600; }

/* Responsive & Drawer (Mobile) */
.ws-wrap { scroll-behavior: smooth; }

@media (max-width: 1280px) and (min-width: 1025px) {
  .ws-sidebar { width: 60px; }
  .ws-sidebar .ws-sb-label { opacity: 0; max-width: 0; }
  .ws-sidebar .ws-sb-badge { opacity: 0; }
  .ws-content-area { margin-left: 60px; }
  .ws-sidebar:not(.ws-sidebar--collapsed) { width: 232px; }
  .ws-page:not(.ws-sidebar-collapsed) .ws-content-area { margin-left: 232px; }
}

@media (max-width: 1024px) {
  .ws-sidebar { display: none; }
  .ws-content-area { margin-left: 0; padding: .75rem 1rem; }
  .ws-header { margin-bottom: 1rem; }
  .ws-title { font-size: 1.5rem; }
  .ws-sub { font-size: .8rem; }
  .ws-table { min-width: 760px; }
  .ws-qf-grid, .ws-qf-grid--2col, .ws-pf-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .ws-content-area { padding: .5rem; }
  .ws-header-row { flex-wrap: wrap; gap: .5rem; }
  .ws-user-label { display: none; }
  .ws-title { font-size: 1.2rem; }
}

.ws-tabs-btn { display: none; align-items: center; justify-content: center; width: 38px; height: 38px; flex-shrink: 0; border-radius: 8px; background: var(--ws-card-alt); border: 1px solid var(--ws-border); color: var(--ws-text); cursor: pointer; transition: all .2s; }
.ws-tabs-btn:hover { background: var(--ws-border); }
.ws-tabs-btn svg { display: block; }

.ws-tab-backdrop { position: fixed; top: 64px; inset-inline: 0; bottom: 0; z-index: 1290; background: rgba(0, 0, 0, .45); opacity: 0; pointer-events: none; transition: opacity .25s ease; display: none; }
.ws-tab-backdrop.open { opacity: 1; pointer-events: auto; }

.ws-tab-drawer { display: none; position: fixed; top: 64px; bottom: 0; left: 0; width: min(304px, 88vw); z-index: 1300; flex-direction: column; overflow-y: auto; padding: .9rem .8rem 1.4rem; background: var(--ws-sidebar-bg); border-right: 1px solid var(--ws-border); box-shadow: var(--ws-shadow-lg); transform: translateX(-108%); transition: transform .3s cubic-bezier(.4, 0, .2, 1); }
.ws-tab-drawer.open { transform: none; }
.ws-tab-drawer-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; padding: 0 .35rem .7rem; margin-bottom: .6rem; border-bottom: 1px solid var(--ws-border); }
.ws-tab-drawer-ttl { color: var(--ws-text); font-weight: 700; font-size: .85rem; }
.ws-tab-drawer-close { width: 30px; height: 30px; flex-shrink: 0; border-radius: 8px; background: var(--ws-card-alt); border: 1px solid var(--ws-border); color: var(--ws-text-muted); font-size: .8rem; cursor: pointer; transition: all .2s; }
.ws-tab-drawer-close:hover { background: rgba(239, 68, 68, .1); color: #ef4444; border-color: rgba(239, 68, 68, .3); }
.ws-tab-drawer-list { display: flex; flex-direction: column; gap: .3rem; }
.ws-tab--drawer { width: 100%; justify-content: flex-start; padding: .62rem .75rem; font-size: .88rem; border-radius: 8px; }
.ws-tab--drawer .ws-tab-badge { margin-left: auto; }

@media (max-width: 1024px) {
  .ws-tabs-btn { display: flex; }
  .ws-tab-backdrop { display: block; }
  .ws-tab-drawer { display: flex; }
}

@media (max-width: 900px) {
  .ws-table-wrap { overflow: visible; }
  .ws-table, .ws-table tbody, .ws-table tr, .ws-table td { display: block; }
  .ws-table { min-width: 0; }
  .ws-table thead { display: none; }
  .ws-table tbody { display: grid; grid-template-columns: 1fr; gap: .8rem; }
  .ws-table tr { background: var(--ws-card); border: 1px solid var(--ws-border); border-radius: 12px; padding: .85rem 1rem; box-shadow: var(--ws-shadow-card); }
  .ws-table tr:hover td { background: transparent; }
  .ws-table td { display: grid; grid-template-columns: minmax(92px, 32%) 1fr; gap: .35rem 1rem; align-items: center; border: none; padding: .3rem .35rem; font-size: .84rem; }
  .ws-table td::before { content: attr(data-label); text-transform: uppercase; letter-spacing: .06em; font-size: .6rem; font-weight: 800; color: var(--ws-text-muted); white-space: nowrap; }
  .ws-table tr:last-child td { border-bottom: none; }
}
`]
})
export class WorkspaceComponent implements OnInit, OnDestroy {

  @ViewChild('wsTabs', { static: false }) wsTabs?: ElementRef<HTMLElement>;

  activeTab: Tab = 'agents';
  tabsMenuOpen   = false;
  sidebarCollapsed = false;
  tabs = [
    { id: 'agents'   as Tab, icon: '🤖', label: 'Agents',    count: 0, hint: 'Créer, configurer et mettre en service vos agents' },
    { id: 'equipes'  as Tab, icon: '🏢', label: 'Équipes',   count: 0, hint: 'Regrouper des agents qui collaborent sur un même objectif' },
    { id: 'taches'   as Tab, icon: '📋', label: 'Tâches',    count: 0, hint: 'Suivre les demandes envoyées et leur avancement' },
    { id: 'inbox'    as Tab, icon: '📥', label: 'Inbox',     count: 0, hint: 'Réponses des agents, notifications et validations à traiter' },
    { id: 'prompts'  as Tab, icon: '✍️', label: 'Prompts',   count: 0, hint: 'Bibliothèque de prompts réutilisables entre agents' },
    { id: 'workflow' as Tab, icon: '⚡', label: 'Workflow',  count: 0, hint: 'Enchaîner plusieurs étapes et agents en un seul scénario' },
    { id: 'chat'     as Tab, icon: '💬', label: 'Chat',      count: 0, hint: 'Discuter avec un agent ou une équipe, en direct' },
    { id: 'rag'      as Tab, icon: '🔍', label: 'RAG Chat',  count: 0, hint: 'Interroger vos documents indexés par pertinence' },
    { id: 'llm'      as Tab, icon: '🔑', label: 'Clés API',  count: 0, hint: 'Connecter les fournisseurs de modèles (Groq, DeepSeek, Ollama)' },
    { id: 'canaux'   as Tab, icon: '📡', label: 'Canaux',    count: 0, hint: 'Brancher Telegram, Discord et autres points d\'entrée' },
    { id: 'social'   as Tab, icon: '📲', label: 'Réseaux',   count: 0, hint: 'Connecter vos comptes et publier du contenu généré' },
    { id: 'studio'   as Tab, icon: '🎬', label: 'Studio',   count: 0, hint: 'Générer des vidéos et des images de A à Z' },
    { id: 'email'    as Tab, icon: '📧', label: 'Email',     count: 0 },
    { id: 'profil'   as Tab, icon: '👤', label: 'Mon Profil', count: 0 },
  ];

  userName = '';
  isDark   = false;

  initTheme(): void {
    const saved = localStorage.getItem('cas-theme') || 'light';
    this.isDark = saved === 'dark';
    document.documentElement.setAttribute('data-theme', saved);
  }

  toggleTheme(): void {
    this.isDark = !this.isDark;
    const theme = this.isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cas-theme', theme);
    this.cd.markForCheck();
  }

  // ── AGENTS ───────────────────────────────────────────────────────────────
  agents: any[] = [];
  loadingAgents = false;
  searchAgents   = '';
  filterAgentTeam = '';
  filterAgentType = '';
  agentForm = { name: '', type: 'EMAIL_MANAGER', teamId: '', description: '' };
  readonly agentTypes = AGENT_TYPES;

  get filteredAgents() {
    return this.agents.filter(a => {
      const q = this.searchAgents.toLowerCase();
      return (!q || a.name?.toLowerCase().includes(q) || a.agentType?.toLowerCase().includes(q))
          // Studio est l'agent du compte : il reste visible dans le filtre de
          // chaque équipe, sinon il disparaît dès qu'on en sélectionne une.
          && (!this.filterAgentTeam || a.teamId === this.filterAgentTeam || a.defaultSystem)
          && (!this.filterAgentType || a.agentType === this.filterAgentType);
    });
  }

  // ── TEAMS ─────────────────────────────────────────────────────────────────
  teams: any[] = [];
  loadingTeams = false;
  searchTeams   = '';
  teamForm = { name: '', description: '' };

  get filteredTeams() {
    const q = this.searchTeams.toLowerCase();
    return this.teams.filter(t => !q || t.name?.toLowerCase().includes(q));
  }

  // ── TASKS ─────────────────────────────────────────────────────────────────
  tasks: any[] = [];
  loadingTasks = false;
  searchTasks       = '';
  filterTaskStatus  = '';
  filterTaskPriority = '';
  readonly taskStatuses = TASK_STATUSES;
  readonly priorities   = PRIORITIES;

  private readonly TASK_GROUP_CONFIG = [
    { key: 'EMAIL',       label: 'Email',           icon: '📧', types: ['EMAIL_RESPONSE','EMAIL_CAMPAIGN','EMAIL'] },
    { key: 'FACEBOOK',    label: 'Facebook',         icon: '📘', platform: 'FACEBOOK' },
    { key: 'INSTAGRAM',   label: 'Instagram',        icon: '📸', platform: 'INSTAGRAM' },
    { key: 'TIKTOK',      label: 'TikTok',           icon: '🎵', platform: 'TIKTOK' },
    { key: 'LINKEDIN',    label: 'LinkedIn',         icon: '💼', platform: 'LINKEDIN' },
    { key: 'TWITTER',     label: 'X / Twitter',      icon: '🐦', platform: 'TWITTER' },
    { key: 'YOUTUBE',     label: 'YouTube',          icon: '▶️', platform: 'YOUTUBE' },
    { key: 'SOCIAL',      label: 'Réseaux sociaux',  icon: '📱', types: ['SOCIAL_CONTENT'] },
    { key: 'MARKETING',   label: 'Marketing',        icon: '🎯', types: ['MARKETING','CAMPAIGN_CREATE'] },
    { key: 'PROSPECTION', label: 'Prospection',      icon: '🔍', types: ['PROSPECTION','PROSPECT_SEARCH'] },
    { key: 'CREATION',    label: 'Création',         icon: '🎨', types: ['IMAGE_CREATE','VIDEO_CREATE','FLYER_CREATE','PRESENTATION_CREATE'] },
    { key: 'GENERAL',     label: 'Général',          icon: '⚡', types: ['GENERAL'] },
    { key: 'AUTRES',      label: 'Autres',           icon: '📋', types: [] as string[] },
  ] as const;

  collapsedGroups = new Set<string>();

  toggleTaskGroup(key: string): void {
    if (this.collapsedGroups.has(key)) this.collapsedGroups.delete(key);
    else this.collapsedGroups.add(key);
    this.cd.markForCheck();
  }

  private getTaskGroupKey(task: any): string {
    const platforms: string[] = this.parsePlatforms(task.platforms);
    if (platforms.length) {
      for (const cfg of this.TASK_GROUP_CONFIG) {
        if ('platform' in cfg && platforms.some(p => p.toUpperCase() === cfg.platform)) return cfg.key;
      }
    }
    for (const cfg of this.TASK_GROUP_CONFIG) {
      if ('types' in cfg && (cfg.types as readonly string[]).includes(task.type)) return cfg.key;
    }
    return 'AUTRES';
  }

  get filteredTasks() {
    const q = this.searchTasks.toLowerCase();
    return this.tasks.filter(t =>
      (!q || t.title?.toLowerCase().includes(q))
      && (!this.filterTaskStatus || t.status === this.filterTaskStatus)
      && (!this.filterTaskPriority || t.priority === this.filterTaskPriority)
    );
  }

  get groupedFilteredTasks(): { key: string; label: string; icon: string; tasks: any[] }[] {
    const map = new Map<string, any[]>();
    for (const t of this.filteredTasks) {
      const key = this.getTaskGroupKey(t);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return this.TASK_GROUP_CONFIG
      .filter(cfg => map.has(cfg.key))
      .map(cfg => ({ key: cfg.key, label: cfg.label, icon: cfg.icon, tasks: map.get(cfg.key)! }));
  }

  trackByGroupKey(_i: number, g: any): string { return g.key; }
  trackByTaskId(_i: number, t: any): string   { return t.id; }

  // ── AGENT TYPES MODAL ─────────────────────────────────────────────────────
  showAgentTypesModal = false;
  readonly agentTypeDetails = AGENT_TYPE_DETAILS;

  // ── CLIENTS ───────────────────────────────────────────────────────────────
  // Keys kept only for one-time migration of existing localStorage data
  private readonly CLIENTS_KEY       = 'creativeai_clients';
  private readonly CLIENTS_TRASH_KEY = 'creativeai_clients_trash';
  showClientModal  = false;
  clientTab: 'form'|'list'|'trash' = 'form';
  clients:      any[] = [];
  clientsTrash: any[] = [];
  editingClientIdx = -1;
  clientForm = { code:'', nom:'', prenoms:'', contact:'', email:'', entrepriseName:'' };

  // ── PRODUCTS ──────────────────────────────────────────────────────────────
  private readonly PRODUCTS_KEY       = 'creativeai_products';
  private readonly PRODUCTS_TRASH_KEY = 'creativeai_products_trash';
  showProductModal  = false;
  productTab: 'form'|'list'|'trash' = 'form';
  products:      any[] = [];
  productsTrash: any[] = [];
  editingProductIdx = -1;
  uploadingMedia = false;
  productForm: any = this.emptyProductForm();

  private emptyProductForm() {
    return { code:'', nom:'', description:'', prix:0, prixPromo:0,
             variantes: [] as any[], mentions: [] as any[], photos: [] as string[], videos: [] as string[] };
  }

  // ── PROFIL EXPÉDITEUR ─────────────────────────────────────────────────────
  private readonly PROFIL_KEY = 'creativeai_profil_expediteur';
  profilForm = {
    prenom: '', nom: '', poste: '', departement: '',
    societe: '', secteur: '', siteWeb: '', adresse: '',
    email: '', telephone: '', telephoneFixe: '', linkedin: '',
    signature: '', tonEmail: 'professionnel',
    langue: 'fr', devise: 'EUR', contexteSup: ''
  };
  savingProfil      = false;
  profilSaved       = false;
  signatureAutoMode = true;
  generatingContext = false;
  profilStep          = 1;
  profilTouched       = false;
  profilStepError     = '';
  showProfilDetail    = false;
  expandedProductIdx: number | null = null;
  readonly profilStepCount = 4;
  readonly profilSteps     = ['Identité', 'Société', 'Signature', 'Préférences'];

  // ── TASK FORM ─────────────────────────────────────────────────────────────
  taskForm = {
    title: '', description: '', type: 'GENERAL', priority: 'MEDIUM',
    assignedAgentId: '', schedulingMode: 'immediate', scheduledAt: '',
    selectedProductCodes: [] as string[],
    selectedClientCodes:  [] as string[],
    includeProducts: false,
    // Promotion produit
    platforms:         [] as string[],
    hashtags:          '',
    tone:              'dynamique',
    campaignObjective: 'VENTES',
  };

  readonly socialPlatforms = [
    { value: 'INSTAGRAM', label: 'Instagram', icon: '📸' },
    { value: 'FACEBOOK',  label: 'Facebook',  icon: '👍' },
    { value: 'TIKTOK',    label: 'TikTok',    icon: '🎵' },
    { value: 'LINKEDIN',  label: 'LinkedIn',  icon: '💼' },
    { value: 'TWITTER_X', label: 'X / Twitter', icon: '🐦' },
  ];

  togglePlatform(value: string): void {
    const idx = this.taskForm.platforms.indexOf(value);
    if (idx >= 0) this.taskForm.platforms.splice(idx, 1);
    else this.taskForm.platforms.push(value);
    this.cd.markForCheck();
  }

  parsePlatforms(json: string): string[] {
    try { return JSON.parse(json) ?? []; } catch { return []; }
  }

  readonly CONTACTS_TASK_TYPES = ['MARKETING','PROSPECTION','EMAIL_RESPONSE','SOCIAL_CONTENT','CAMPAIGN_CREATE','PROSPECT_SEARCH'];
  readonly PRODUCTS_TASK_TYPES = ['MARKETING','SOCIAL_CONTENT','PRESENTATION_CREATE','PROSPECTION','CAMPAIGN_CREATE','IMAGE_CREATE','VIDEO_CREATE','FLYER_CREATE','PRODUCT_PROMOTION'];

  private readonly KW_CONTACTS = ['campagne','marketing','prospection','vente','promo','promotion','emailing','newsletter','client','destinataire','cible','audience','prospect','relance','outreach'];
  private readonly KW_PRODUCTS  = ['campagne','marketing','prospection','vente','promo','promotion','infographie','infographic','image','flyer','affiche','vidéo','video','réseaux sociaux','réseau social','tiktok','facebook','instagram','twitter','linkedin','x.com','reels','stories','post','contenu','création','creative','publicité','pub','annonce','ads','social media'];

  get showContactsField(): boolean {
    if (this.CONTACTS_TASK_TYPES.includes(this.taskForm.type)) return true;
    const text = (this.taskForm.title + ' ' + this.taskForm.description).toLowerCase();
    return this.KW_CONTACTS.some(kw => text.includes(kw));
  }
  get showProductsField(): boolean {
    if (this.PRODUCTS_TASK_TYPES.includes(this.taskForm.type)) return true;
    const text = (this.taskForm.title + ' ' + this.taskForm.description).toLowerCase();
    return this.KW_PRODUCTS.some(kw => text.includes(kw));
  }

  get compatibleAgentsForTask() {
    const types = TASK_AGENT_MAP[this.taskForm.type] ?? [];
    return this.agents.filter(a => types.includes(a.agentType));
  }

  get otherAgentsForTask() {
    const types = TASK_AGENT_MAP[this.taskForm.type] ?? [];
    if (!types.length) return this.agents;
    return this.agents.filter(a => !types.includes(a.agentType));
  }

  agentTaskLabels(agentType: string): string[] {
    return AGENT_TASK_LABELS[agentType] ?? [];
  }

  // Contact picker
  showContactPicker    = false;
  contactPickerSearch  = '';
  contactPickerTemp:   string[] = [];

  // Product picker
  showProductPicker    = false;
  productPickerSearch  = '';
  productPickerTemp:   string[] = [];

  get filteredPickerClients() {
    const q = this.contactPickerSearch.toLowerCase().trim();
    if (!q) return this.clients;
    return this.clients.filter(c =>
      c.nom?.toLowerCase().includes(q) || c.prenoms?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) || c.entrepriseName?.toLowerCase().includes(q) ||
      c.code?.includes(q)
    );
  }
  get filteredPickerProducts() {
    const q = this.productPickerSearch.toLowerCase().trim();
    if (!q) return this.products;
    return this.products.filter(p =>
      p.nom?.toLowerCase().includes(q) || p.code?.includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  }

  openContactPicker(): void {
    if (!this.clients.length) this.loadClientsFromApi();
    this.contactPickerTemp = [...this.taskForm.selectedClientCodes];
    this.contactPickerSearch = '';
    this.showContactPicker = true;
    this.cd.markForCheck();
  }
  toggleContactPick(code: string): void {
    const i = this.contactPickerTemp.indexOf(code);
    i >= 0 ? this.contactPickerTemp.splice(i, 1) : this.contactPickerTemp.push(code);
  }
  confirmContactPicker(): void {
    this.taskForm.selectedClientCodes = [...this.contactPickerTemp];
    this.showContactPicker = false;
    this.cd.markForCheck();
  }
  removeSelectedClient(code: string): void {
    this.taskForm.selectedClientCodes = this.taskForm.selectedClientCodes.filter(c => c !== code);
  }

  openProductPicker(): void {
    if (!this.products.length) this.loadProductsFromApi();
    this.productPickerTemp = [...this.taskForm.selectedProductCodes];
    this.productPickerSearch = '';
    this.showProductPicker = true;
    this.cd.markForCheck();
  }
  toggleProductPick(code: string): void {
    const i = this.productPickerTemp.indexOf(code);
    i >= 0 ? this.productPickerTemp.splice(i, 1) : this.productPickerTemp.push(code);
  }
  confirmProductPicker(): void {
    this.taskForm.selectedProductCodes = [...this.productPickerTemp];
    this.showProductPicker = false;
    this.cd.markForCheck();
  }
  removeSelectedProduct(code: string): void {
    this.taskForm.selectedProductCodes = this.taskForm.selectedProductCodes.filter(c => c !== code);
  }

  getClientByCode(code: string) { return this.clients.find(c => c.code === code); }
  getProductByCode(code: string) { return this.products.find(p => p.code === code); }

  toggleProductCode(code: string): void {
    const arr = this.taskForm.selectedProductCodes;
    const i = arr.indexOf(code);
    i >= 0 ? arr.splice(i, 1) : arr.push(code);
  }
  toggleClientCode(code: string): void {
    const arr = this.taskForm.selectedClientCodes;
    const i = arr.indexOf(code);
    i >= 0 ? arr.splice(i, 1) : arr.push(code);
  }
  savingTask = false;

  // ── INBOX ─────────────────────────────────────────────────────────────────
  inboxItems: any[] = [];
  loadingInbox = false;
  selectedInboxItem: any = null;
  replyDraftSubject = '';
  replyDraftBody = '';
  emailAutoMode = true;
  processingInboxReply = false;
  emailReplyModalOpen = false;

  // ── RÉSEAUX SOCIAUX ───────────────────────────────────────────────────────
  socialTab = 'facebook';

  // ── FACEBOOK TOKEN RENEWAL ────────────────────────────────────────────────
  fbRenewForm   = { appId: '', appSecret: '', shortToken: '' };
  fbRenewing    = false;
  fbRenewResult: { pageName: string; pageId: string } | null = null;
  fbShowRenew   = false;

  // ── FACEBOOK COMMENTS ─────────────────────────────────────────────────────
  fbAgentId     = '';
  fbPosts: any[] = [];
  fbLoadingPosts = false;
  fbSelectedPost: any = null;
  fbEditingPostId: string | null = null;
  fbEditingPostText = '';
  fbEditSaving = false;
  fbComments: any[] = [];
  fbLoadingComments = false;
  fbReplyText: Record<string, string> = {};
  fbSendingReply: Record<string, boolean> = {};
  fbSinceHours  = 24;
  fbPostUrlInput = '';
  fbPostComment  = '';
  fbSendingPostComment = false;
  fbScanning = false;
  fbTriggeringNow = false;
  fbTokenInfo: { daysLeft: number; expiresAt: Date; level: 'ok'|'warning'|'critical'|'expired' } | null = null;

  // ── INSTAGRAM ─────────────────────────────────────────────────────────────
  igAgentId       = '';
  igMedia: any[]  = [];
  igLoadingMedia  = false;
  igSelectedMedia: any = null;
  igComments: any[] = [];
  igLoadingComments = false;
  igReplyText: Record<string, string> = {};
  igSendingReply: Record<string, boolean> = {};
  igTriggeringNow = false;
  igScanning      = false;
  igFetchingIgId  = false;
  igFetchIgIdError = '';

  // ── PROMPTS ───────────────────────────────────────────────────────────────
  prompts: any[] = [];
  loadingPrompts = false;
  promptForm = { agentId: '', name: '', content: '' };

  // ── WORKFLOW ──────────────────────────────────────────────────────────────
  workflows: any[] = [];
  loadingWorkflows = false;

  // ── CHAT ──────────────────────────────────────────────────────────────────
  chatAgentId    = '';
  chatInput      = '';
  chatMessages: { role: string; content: string; timestamp: Date }[] = [];
  chatStreaming    = false;
  chatBuffer      = '';
  chatStreamStart = new Date();
  private chatAbort: AbortController | null = null;
  private _typewriterResolve: (() => void) | null = null;
  copiedMsgIdx: number | null = null;
  /** Clé du couple canal/valeur dont le texte vient d'être copié (webhookUrl / verifyToken). */
  copiedWebhookKey: string | null = null;
  /** Détail « webhook » déplié pour un canal Meta. */
  openWebhookId: string | null = null;
  chatFocused = false;
  chatDevice: 'phone' | 'tablet' = 'phone';
  chatFontFamily = "'Roboto',system-ui,sans-serif";
  chatFontSize = 13;
  chatZoom = 100;
  deviceTime = '';
  private deviceTimerHandle: any = null;
  isListening = false;
  isSpeaking  = false;
  ttsEnabled  = false;
  ttsVoice: SpeechSynthesisVoice | null = null;
  private recognition: any = null;
  chatMenuOpen = false;
  savedConversations: { agentId: string; agentName: string; msgCount: number; lastMsg: Date }[] = [];
  taskRedirect = { show: false };
  ragLoaded = false;
  quotaWarning    = { show: false, needed: 0, remaining: 0, provider: '', model: '' };
  chatProviders: any[] = [];
  chatQuota: any       = null;

  // ── LLM PROVIDERS ─────────────────────────────────────────────────────────
  llmMode: 'agent' | 'team' | 'account' = 'agent';
  llmAgentId    = '';
  llmTeamId     = '';
  llmProviders: any[] = [];
  loadingLlm    = false;
  llmHint       = '';
  llmPreset     = '';
  llmBulkResult: { agentName: string; status: 'ok' | 'error'; message?: string }[] = [];
  llmBulkRunning = false;

  /**
   * Provider par défaut de la plateforme (administration). DistINCT des
   * providers du compte affiché juste en dessous : c'est le modèle partagé que
   * l'administration a choisi pour les comptes qui n'en ont pas encore.
   */
  llmPlatformDefault: any = null;
  llmPlatformDefaultLoading = false;
  /**
   * Une seule demande de provisionnement par passage dans l'onglet « Mon
   * compte » : évite une boucle entre la liste vide et /resolved.
   */
  private accountProvisioningChecked = false;
  llmFilterTeam   = '';
  llmFilter: 'active' | 'deleted' | 'all' = 'active';
  llmConfirmOpen  = false;
  llmConfirmProvider: any = null;
  // modelId volontairement vide : il est choisi dans l'assistant (étape 2) ou saisi.
  llmForm          = { type: 'GEMINI', modelId: '', apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', maxTokens: 1024, primary: true };
  llmSelectedProvider = '';
  llmShowKey       = false;
  /** Modèles chargés depuis /llm-providers/models (jamais une liste figée). */
  llmModels         = [] as string[];
  llmModelsSource: ModelCatalogSource = 'none';
  llmModelsLoading  = false;
  llmModelsMessage  = '';
  revealedKeys: Record<string, string> = {};
  copiedKeyId: string | null = null;

  // ── CANAUX ────────────────────────────────────────────────────────────────
  channelAgentId    = '';
  channels: any[]   = [];
  loadingChannels   = false;
  editingChannelId  = '';
  channelForm = { type: 'SOCIAL_MEDIA', platformType: 'INSTAGRAM', displayName: '', credentials: '', accountId: '', accountName: '', pollIntervalMs: 300000, fbAccessToken: '', fbPageId: '', igAccessToken: '', igUserId: '' };
  channelCredHint     = '';
  channelCredPlaceholder = '{"accessToken":"...","pageId":"..."}';

  private readonly CHANNEL_HINTS: Record<string, { hint: string; placeholder: string }> = {
    SOCIAL_MEDIA: { hint: 'Instagram/LinkedIn : accessToken + pageId. LinkedIn : accessToken + organizationId.',       placeholder: '{"accessToken":"IGQVJxxxxx","pageId":"1234567890"}' },
    GMAIL:        { hint: 'OAuth2 : accessToken, refreshToken, clientId, clientSecret.',                               placeholder: '{"accessToken":"ya29.xxx","refreshToken":"1//xxx","clientId":"xxx.apps.googleusercontent.com","clientSecret":"GOCSPX-xxx"}' },
    EMAIL_SMTP:   { hint: 'SMTP : smtpHost, smtpPort, imapHost, imapPort, user, password.',                           placeholder: '{"smtpHost":"smtp.office365.com","smtpPort":587,"imapHost":"outlook.office365.com","imapPort":993,"user":"bot@company.com","password":"secret"}' },
    WHATSAPP:     { hint: 'Meta Business : phoneNumberId, accessToken, webhookVerifyToken.',                           placeholder: '{"phoneNumberId":"1234567890","accessToken":"EAAxxxxx","webhookVerifyToken":"my-token"}' },
    TELEGRAM:     { hint: 'Bot Telegram : botToken (depuis @BotFather).',                                              placeholder: '{"botToken":"1234567890:AAF-xxxxxx"}' },
    SLACK:        { hint: 'Bot Slack : botToken (xoxb-…) + channelId (optionnel).',                                   placeholder: '{"botToken":"xoxb-xxxxx","channelId":"C0XXXXXXX"}' },
    WEBHOOK:      { hint: 'URL cible, méthode HTTP, headers optionnels.',                                              placeholder: '{"url":"https://hook.example.com/agent","method":"POST","headers":{"X-Api-Key":"secret"}}' },
  };

  /**
   * Raccourcis de configuration : type de backend + base URL + hint.
   * Aucun modèle n'y est figé (voir {@link LLM_PROVIDERS}).
   */
  private readonly LLM_PRESETS: Record<string, { type: string; baseUrl: string; hint: string }> = {
    GEMINI:    { type:'GEMINI',    baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai', hint:'🆓 Gratuit — Clé sur aistudio.google.com (Google AI Studio)' },
    GROQ:      { type:'GROQ',      baseUrl:'https://api.groq.com/openai/v1',                         hint:'⚡ Gratuit 100K tokens/jour — console.groq.com' },
    OPENAI:    { type:'OPENAI',    baseUrl:'',                                                       hint:'💳 Payant — platform.openai.com' },
    DEEPSEEK:  { type:'OPENAI',    baseUrl:'https://api.deepseek.com',                               hint:'💰 ~$0.27/1M tokens — platform.deepseek.com (type backend = OPENAI)' },
    MISTRAL:   { type:'MISTRAL',   baseUrl:'',                                                       hint:'💳 Abordable — console.mistral.ai' },
    ANTHROPIC: { type:'ANTHROPIC', baseUrl:'',                                                       hint:'💳 Payant — console.anthropic.com' },
    OLLAMA:    { type:'OLLAMA',    baseUrl:'http://localhost:11434',                                hint:'🏠 Local — Ollama doit tourner sur ce poste' },
  };

  /**
   * Providers proposés dans l'espace de travail.
   *
   * <p>Volontairement SANS liste de modèles : les fournisseurs en retirent
   * régulièrement (Groq a supprimé llama-3.3-70b-versatile et
   * llama-3.1-8b-instant, qui échouaient ensuite en 404 au premier appel).
   * Les modèles sont chargés à la demande via
   * {@code GET /api/users/me/llm-providers/models}, avec saisie libre en
   * secours quand le fournisseur n'expose pas de catalogue.
   */
  readonly LLM_PROVIDERS: Record<string, {
    label: string; icon: string; color: string; type: string; baseUrl: string; free: boolean; hint: string;
  }> = {
    GROQ: {
      label: 'Groq', icon: '⚡', color: '#f59e0b', type: 'GROQ',
      baseUrl: 'https://api.groq.com/openai/v1', free: true,
      hint: '⚡ Gratuit — 100 000 tokens/jour · console.groq.com'
    },
    DEEPSEEK: {
      label: 'DeepSeek', icon: '🐳', color: '#1d6fa4', type: 'OPENAI',
      baseUrl: 'https://api.deepseek.com', free: false,
      hint: '💰 Très économique · platform.deepseek.com (compatible OpenAI)'
    },
    GEMINI: {
      label: 'Google Gemini', icon: '✨', color: '#4285f4', type: 'GEMINI',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', free: true,
      hint: '🆓 Gratuit (limites généreuses) · aistudio.google.com'
    },
    OPENAI: {
      label: 'OpenAI', icon: '🤖', color: '#74aa9c', type: 'OPENAI',
      baseUrl: '', free: false,
      hint: '💳 Payant · platform.openai.com'
    },
    ANTHROPIC: {
      label: 'Anthropic Claude', icon: '🔮', color: '#d4a76a', type: 'ANTHROPIC',
      baseUrl: '', free: false,
      hint: '💳 Payant · console.anthropic.com'
    },
    MISTRAL: {
      label: 'Mistral AI', icon: '🌊', color: '#ff7000', type: 'MISTRAL',
      baseUrl: 'https://api.mistral.ai/v1', free: false,
      hint: '💰 Abordable · console.mistral.ai'
    },
    QWEN: {
      label: 'Qwen (Alibaba)', icon: '🔱', color: '#ff6a00', type: 'OPENAI',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', free: false,
      hint: '💰 Économique · dashscope.aliyuncs.com (compatible OpenAI)'
    },
    TOGETHER_AI: {
      label: 'Together AI', icon: '🔗', color: '#7c3aed', type: 'TOGETHER_AI',
      baseUrl: 'https://api.together.xyz/v1', free: false,
      hint: '💰 200+ modèles · api.together.ai (compatible OpenAI)'
    },
    OPENROUTER: {
      label: 'OpenRouter', icon: '🌐', color: '#6366f1', type: 'OPENAI',
      baseUrl: 'https://openrouter.ai/api/v1', free: false,
      hint: '🌐 400+ modèles · openrouter.ai (compatible OpenAI — clé OR requise)'
    },
    OLLAMA: {
      label: 'Ollama (local)', icon: '🏠', color: '#34d399', type: 'OLLAMA',
      baseUrl: 'http://localhost:11434', free: true,
      hint: '🏠 Gratuit — local · ollama.com · aucune clé requise'
    },
  };

  // ── SHARED STATE ──────────────────────────────────────────────────────────
  quickAdd  = '';
  editingId = '';
  saving    = false;
  formError = '';

  constructor(private http: HttpClient, protected cd: ChangeDetectorRef, private router: Router, private sanitizer: DomSanitizer, private dialog: DialogService, private auth: AuthService) {}

  /**
   * Vrai pour un compte administrateur.
   *
   * Seuls les administrateurs peuvent marquer un provider comme défaut de la
   * plateforme : cela revient à faire porter sa clé API par tous les comptes.
   * Le contrôle est refait côté serveur (@PreAuthorize), l'interface se contente
   * de ne pas proposer l'action.
   */
  get isAdmin(): boolean {
    return this.auth.currentUser()?.role === 'ADMIN';
  }

  get selectedAgentName(): string {
    const a = this.agents.find(ag => ag.id === this.chatAgentId);
    return a ? a.name : 'Agent IA';
  }

  private stripEmojis(t: string): string {
    return t
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/[\u{2600}-\u{27BF}]/gu, '')
      .replace(/[\u{2B00}-\u{2BFF}]/gu, '')
      .replace(/️/g, '');
  }

  formatMsg(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    let h = this.stripEmojis(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre class="ws-code-block"><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="ws-code-inline">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^#{3}\s+(.+)$/gm, '<h3 class="ws-md-h3">$1</h3>')
      .replace(/^#{2}\s+(.+)$/gm, '<h2 class="ws-md-h2">$1</h2>')
      .replace(/^#{1}\s+(.+)$/gm, '<h2 class="ws-md-h2">$1</h2>')
      .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="ws-md-ul">$&</ul>')
      .replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(h);
  }

  ngOnInit(): void {
    this.initTheme();
    try {
      const raw  = localStorage.getItem('ms_auth');
      const user = raw ? JSON.parse(raw) : null;
      this.userName = user?.fullName || 'Utilisateur';
    } catch {}
    this.loadProfil();
    this.loadClientsFromApi();
    this.loadProductsFromApi();
    this.loadAgents();
    this.loadTeams();
    this.loadTasks();
    this.refreshSavedConversations();
    this.deviceTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    this.deviceTimerHandle = setInterval(() => {
      this.deviceTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (this.activeTab === 'chat') this.cd.markForCheck();
    }, 30_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.deviceTimerHandle);
  }

  goToTeams(): void {
    this.taskRedirect.show = false;
    this.router.navigate(['/agentique/teams']);
  }

  toggleTabsMenu(): void {
    this.tabsMenuOpen = !this.tabsMenuOpen;
  }

  switchTab(tab: Tab): void {
    if (tab === 'studio') {
      this.router.navigate(['/generation/studio']);
      return;
    }
    this.activeTab = tab;
    this.tabsMenuOpen = false;
    this.quickAdd  = '';
    this.editingId = '';
    this.formError = '';
    if (tab === 'agents'   && this.agents.length === 0)     this.loadAgents();
    if (tab === 'equipes'  && this.teams.length === 0)      this.loadTeams();
    if (tab === 'taches'   && this.tasks.length === 0)      this.loadTasks();
    if ((tab === 'inbox' || tab === 'email')) {
      if (this.inboxItems.length === 0) this.loadInbox();
      if (this.agents.length === 0) this.loadAgents();
    }
    if (tab === 'prompts'  && this.prompts.length === 0)    this.loadPrompts();
    if (tab === 'workflow') {
      if (this.workflows.length === 0) this.loadWorkflows();
      if (this.agents.length === 0) this.loadAgents();
    }
    if (tab === 'llm'      && this.agents.length === 0)     this.loadAgents();
    if (tab === 'llm'      && this.teams.length === 0)      this.loadTeams();
    if (tab === 'canaux'   && this.agents.length === 0)     this.loadAgents();
    if (tab === 'social'   && this.agents.length === 0)     this.loadAgents();
    if (tab === 'rag') this.ragLoaded = true;
    // Amène l'onglet actif dans la zone visible (rail scrollable mobile/tablette)
    setTimeout(() => {
      const el = this.wsTabs?.nativeElement;
      if (el) {
        const node = el.querySelector('.ws-tab--active');
        if (node) el.scrollTo({ left: (node as HTMLElement).offsetLeft - 12, behavior: 'smooth' });
      }
    }, 40);
  }

  toggleQuickAdd(type: string): void {
    if (this.quickAdd === type) { this.quickAdd = ''; this.editingId = ''; this.resetForms(); return; }
    this.quickAdd  = type;
    this.editingId = '';
    this.formError = '';
    this.resetForms();
  }

  private resetForms(): void {
    this.agentForm  = { name: '', type: 'EMAIL_MANAGER', teamId: '', description: '' };
    this.teamForm   = { name: '', description: '' };
    this.promptForm = { agentId: '', name: '', content: '' };
    this.taskForm   = { title: '', description: '', type: 'GENERAL', priority: 'MEDIUM', assignedAgentId: '', schedulingMode: 'immediate', scheduledAt: '', selectedProductCodes: [], selectedClientCodes: [], includeProducts: false, platforms: [], hashtags: '', tone: 'dynamique', campaignObjective: 'VENTES' };
  }

  // ── PROFIL EXPÉDITEUR ─────────────────────────────────────────────────────

  loadProfil(): void {
    this.http.get<any>(`${API}/api/user/profil`, { headers: this.authHeaders() }).subscribe({
      next: (data) => {
        if (data && data.prenom !== undefined) {
          Object.assign(this.profilForm, {
            prenom: data.prenom || '', nom: data.nom || '', poste: data.poste || '',
            departement: data.departement || '', societe: data.societe || '',
            secteur: data.secteur || '', siteWeb: data.siteWeb || '',
            adresse: data.adresse || '', email: data.email || '',
            telephone: data.telephone || '', telephoneFixe: data.telephoneFixe || '',
            linkedin: data.linkedin || '', signature: data.signature || '',
            tonEmail: data.tonEmail || 'professionnel', langue: data.langue || 'fr',
            devise: data.devise || 'EUR', contexteSup: data.contexteSup || ''
          });
          this.buildSignature();
          this.cd.markForCheck();
        } else {
          // Fallback: migrate from localStorage once
          try {
            const saved = localStorage.getItem(this.PROFIL_KEY);
            if (saved) { const p = JSON.parse(saved); Object.assign(this.profilForm, p); this.buildSignature(); }
          } catch {}
        }
      },
      error: () => {
        try {
          const saved = localStorage.getItem(this.PROFIL_KEY);
          if (saved) { const p = JSON.parse(saved); Object.assign(this.profilForm, p); this.buildSignature(); }
        } catch {}
      }
    });
  }

  saveProfil(): void {
    this.savingProfil = true;
    this.http.post<any>(`${API}/api/user/profil`, this.profilForm, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.profilSaved = true;
        this.savingProfil = false;
        localStorage.removeItem(this.PROFIL_KEY); // clean legacy
        setTimeout(() => { this.profilSaved = false; this.cd.markForCheck(); }, 4000);
        this.cd.markForCheck();
      },
      error: () => {
        this.savingProfil = false;
        this.dialog.alert('Impossible de sauvegarder le profil.', 'Erreur', 'error');
        this.cd.markForCheck();
      }
    });
  }

  /** Génère et télécharge le fichier profil_expediteur.json */
  downloadProfilTemplate(): void {
    const p = this.profilForm;
    const rows = [
      ['Champ', 'Valeur', 'Description'],
      ['Prénom',          p.prenom      || '',  'Votre prénom'],
      ['Nom',             p.nom         || '',  'Votre nom de famille'],
      ['Poste',           p.poste       || '',  'Titre / Fonction'],
      ['Département',     p.departement || '',  'Service ou département'],
      ['Société',         p.societe     || '',  'Nom de votre entreprise'],
      ['Secteur',         p.secteur     || '',  "Secteur d'activité"],
      ['Site web',        p.siteWeb     || '',  'URL du site web'],
      ['Adresse',         p.adresse     || '',  'Adresse postale'],
      ['Email',           p.email       || '',  'Email professionnel'],
      ['Téléphone mobile',p.telephone   || '',  'Numéro mobile'],
      ['Téléphone fixe',  p.telephoneFixe||'',  'Numéro de bureau'],
      ['LinkedIn',        p.linkedin    || '',  'URL profil LinkedIn'],
      ['Ton email',       p.tonEmail    || 'professionnel', 'professionnel / amical / formel / neutre'],
      ['Signature',       p.signature   || '',  'Signature email complète'],
      ['Langue',          p.langue      || 'fr','fr / en / es / ...'],
      ['Devise',          p.devise      || 'EUR','EUR / USD / XOF / ...'],
      ['Contexte sup.',   p.contexteSup || '',  'Instructions supplémentaires pour les agents'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 35 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mon Profil');
    XLSX.writeFile(wb, 'profil_expediteur.xlsx');
  }

  // ── Clients CRUD ──────────────────────────────────────────────────────────

  private authHeaders(): { [h: string]: string } {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private loadClientsFromApi(): void {
    this.http.get<any[]>(`${API}/api/user/clients`, { headers: this.authHeaders() }).subscribe({
      next: (data) => { this.clients = data || []; this.cd.markForCheck(); },
      error: () => {
        // Fallback migrate once from localStorage
        try { this.clients = JSON.parse(localStorage.getItem(this.CLIENTS_KEY) || '[]'); } catch {}
      }
    });
    this.http.get<any[]>(`${API}/api/user/clients/trash`, { headers: this.authHeaders() }).subscribe({
      next: (data) => { this.clientsTrash = data || []; this.cd.markForCheck(); },
      error: () => {
        try { this.clientsTrash = JSON.parse(localStorage.getItem(this.CLIENTS_TRASH_KEY) || '[]'); } catch {}
      }
    });
  }

  openClientModal(): void {
    this.loadClientsFromApi();
    this.resetClientForm();
    this.clientTab = 'list';
    this.showClientModal = true;
    this.cd.markForCheck();
  }

  private generateUniqueCode(existing: string[]): string {
    let code: string;
    do { code = String(Math.floor(100000 + Math.random() * 900000)); }
    while (existing.includes(code));
    return code;
  }

  resetClientForm(): void {
    const code = this.generateUniqueCode(this.clients.map(c => c.code));
    this.clientForm = { code, nom:'', prenoms:'', contact:'', email:'', entrepriseName:'' };
    this.editingClientIdx = -1;
  }

  saveClient(): void {
    if (!this.clientForm.nom.trim() || !this.clientForm.email.trim()) return;
    const editing = this.editingClientIdx >= 0 ? this.clients[this.editingClientIdx] : null;
    const payload = { ...this.clientForm };
    if (editing?.id) {
      this.http.put<any>(`${API}/api/user/clients/${editing.id}`, payload, { headers: this.authHeaders() }).subscribe({
        next: (updated) => {
          this.clients[this.editingClientIdx] = updated;
          this.resetClientForm(); this.clientTab = 'list'; this.cd.markForCheck();
        }
      });
    } else {
      this.http.post<any>(`${API}/api/user/clients`, payload, { headers: this.authHeaders() }).subscribe({
        next: (created) => {
          this.clients.push(created);
          this.resetClientForm(); this.clientTab = 'list'; this.cd.markForCheck();
        }
      });
    }
  }

  editClient(i: number): void {
    this.editingClientIdx = i;
    this.clientForm = { ...this.clients[i] };
  }

  softDeleteClient(i: number): void {
    const c = this.clients[i];
    if (!c?.id) return;
    this.http.delete(`${API}/api/user/clients/${c.id}`, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.clientsTrash.push(this.clients.splice(i, 1)[0]);
        this.cd.markForCheck();
      }
    });
  }

  restoreClient(i: number): void {
    const c = this.clientsTrash[i];
    if (!c?.id) return;
    this.http.put<any>(`${API}/api/user/clients/${c.id}/restore`, {}, { headers: this.authHeaders() }).subscribe({
      next: (restored) => {
        this.clientsTrash.splice(i, 1);
        this.clients.push(restored);
        this.cd.markForCheck();
      }
    });
  }

  hardDeleteClient(i: number): void {
    const c = this.clientsTrash[i];
    if (!c?.id) return;
    this.http.delete(`${API}/api/user/clients/${c.id}/hard`, { headers: this.authHeaders() }).subscribe({
      next: () => { this.clientsTrash.splice(i, 1); this.cd.markForCheck(); }
    });
  }

  emptyClientTrash(): void {
    this.http.delete(`${API}/api/user/clients/trash/empty`, { headers: this.authHeaders() }).subscribe({
      next: () => { this.clientsTrash = []; this.cd.markForCheck(); }
    });
  }

  downloadClientsXlsx(): void {
    const header = ['Code', 'Nom', 'Prénoms', 'Contact', 'Email', 'Entreprise'];
    const rows = this.clients.map(c => [c.code, c.nom, c.prenoms, c.contact, c.email, c.entrepriseName]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws['!cols'] = header.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, 'clients.xlsx');
  }

  // ── Produits CRUD ─────────────────────────────────────────────────────────

  private loadProductsFromApi(): void {
    this.http.get<any[]>(`${API}/api/user/products`, { headers: this.authHeaders() }).subscribe({
      next: (data) => {
        this.products = (data || []).map(p => ({
          ...p,
          variantes: this.tryParse(p.variantes, []),
          mentions:  this.tryParse(p.mentions,  []),
          photos:    this.tryParse(p.photos,     []),
          videos:    this.tryParse(p.videos,     [])
        }));
        this.cd.markForCheck();
      },
      error: () => {
        try { this.products = JSON.parse(localStorage.getItem(this.PRODUCTS_KEY) || '[]'); } catch {}
      }
    });
    this.http.get<any[]>(`${API}/api/user/products/trash`, { headers: this.authHeaders() }).subscribe({
      next: (data) => {
        this.productsTrash = (data || []).map(p => ({
          ...p,
          variantes: this.tryParse(p.variantes, []),
          mentions:  this.tryParse(p.mentions,  []),
          photos:    this.tryParse(p.photos,     []),
          videos:    this.tryParse(p.videos,     [])
        }));
        this.cd.markForCheck();
      },
      error: () => {
        try { this.productsTrash = JSON.parse(localStorage.getItem(this.PRODUCTS_TRASH_KEY) || '[]'); } catch {}
      }
    });
  }

  private tryParse(val: any, fallback: any): any {
    if (Array.isArray(val)) return val;
    try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
  }

  openProductModal(): void {
    this.loadProductsFromApi();
    this.resetProductForm();
    this.productTab = 'list';
    this.showProductModal = true;
    this.cd.markForCheck();
  }

  resetProductForm(): void {
    const code = this.generateUniqueCode(this.products.map(p => p.code));
    this.productForm = { code, nom:'', description:'', prix:0, prixPromo:0,
                         variantes: [], mentions: [], photos: [], videos: [] };
    this.editingProductIdx = -1;
  }

  addVariant(): void   { this.productForm.variantes.push({ nom:'', valeur:'', prix:0 }); }
  removeVariant(i: number): void { this.productForm.variantes.splice(i, 1); }
  addMention(): void   { this.productForm.mentions.push({ type:'ingredients', contenu:'' }); }
  removeMention(i: number): void { this.productForm.mentions.splice(i, 1); }

  uploadProductMedia(event: Event, folder: 'photos' | 'videos'): void {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    if (!files.length) return;
    this.uploadingMedia = true;
    let done = 0;
    files.forEach(f => {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('folder', folder);
      this.http.post<any>(`${API}/api/media/upload`, fd, { headers: this.authHeaders() }).subscribe({
        next: (r) => {
          if (folder === 'photos') this.productForm.photos.push(r.url);
          else this.productForm.videos.push(r.url);
          if (++done === files.length) { this.uploadingMedia = false; this.cd.markForCheck(); }
        },
        error: () => { if (++done === files.length) this.uploadingMedia = false; }
      });
    });
  }

  saveProduct(): void {
    if (!this.productForm.code.trim() || !this.productForm.nom.trim()) return;
    const editing = this.editingProductIdx >= 0 ? this.products[this.editingProductIdx] : null;
    const payload = {
      ...this.productForm,
      variantes: JSON.stringify(this.productForm.variantes),
      mentions:  JSON.stringify(this.productForm.mentions),
      photos:    JSON.stringify(this.productForm.photos),
      videos:    JSON.stringify(this.productForm.videos)
    };
    if (editing?.id) {
      this.http.put<any>(`${API}/api/user/products/${editing.id}`, payload, { headers: this.authHeaders() }).subscribe({
        next: (updated) => {
          this.products[this.editingProductIdx] = {
            ...updated,
            variantes: this.tryParse(updated.variantes, []),
            mentions:  this.tryParse(updated.mentions,  []),
            photos:    this.tryParse(updated.photos,     []),
            videos:    this.tryParse(updated.videos,     [])
          };
          this.resetProductForm(); this.productTab = 'list'; this.cd.markForCheck();
        }
      });
    } else {
      this.http.post<any>(`${API}/api/user/products`, payload, { headers: this.authHeaders() }).subscribe({
        next: (created) => {
          this.products.push({
            ...created,
            variantes: this.tryParse(created.variantes, []),
            mentions:  this.tryParse(created.mentions,  []),
            photos:    this.tryParse(created.photos,     []),
            videos:    this.tryParse(created.videos,     [])
          });
          this.resetProductForm(); this.productTab = 'list'; this.cd.markForCheck();
        }
      });
    }
  }

  editProduct(i: number): void {
    this.editingProductIdx = i;
    const p = this.products[i];
    this.productForm = { ...p,
      variantes: [...(p.variantes||[])],
      mentions:  [...(p.mentions||[])],
      photos:    [...(p.photos||[])],
      videos:    [...(p.videos||[])] };
  }

  softDeleteProduct(i: number): void {
    const p = this.products[i];
    if (!p?.id) return;
    this.http.delete(`${API}/api/user/products/${p.id}`, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.productsTrash.push(this.products.splice(i, 1)[0]);
        this.cd.markForCheck();
      }
    });
  }

  restoreProduct(i: number): void {
    const p = this.productsTrash[i];
    if (!p?.id) return;
    this.http.put<any>(`${API}/api/user/products/${p.id}/restore`, {}, { headers: this.authHeaders() }).subscribe({
      next: (restored) => {
        this.productsTrash.splice(i, 1);
        this.products.push({
          ...restored,
          variantes: this.tryParse(restored.variantes, []),
          mentions:  this.tryParse(restored.mentions,  []),
          photos:    this.tryParse(restored.photos,     []),
          videos:    this.tryParse(restored.videos,     [])
        });
        this.cd.markForCheck();
      }
    });
  }

  hardDeleteProduct(i: number): void {
    const p = this.productsTrash[i];
    if (!p?.id) return;
    this.http.delete(`${API}/api/user/products/${p.id}/hard`, { headers: this.authHeaders() }).subscribe({
      next: () => { this.productsTrash.splice(i, 1); this.cd.markForCheck(); }
    });
  }

  emptyProductTrash(): void {
    this.http.delete(`${API}/api/user/products/trash/empty`, { headers: this.authHeaders() }).subscribe({
      next: () => { this.productsTrash = []; this.cd.markForCheck(); }
    });
  }

  downloadProductsXlsx(): void {
    const wb = XLSX.utils.book_new();
    const header = ['Code', 'Nom', 'Description', 'Prix', 'Prix Promo', 'Photos', 'Vidéos'];
    const rows = this.products.map(p => [p.code, p.nom, p.description, p.prix, p.prixPromo||'', (p.photos||[]).join('\n'), (p.videos||[]).join('\n')]);
    const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws1['!cols'] = [{ wch:12 }, { wch:25 }, { wch:40 }, { wch:10 }, { wch:10 }, { wch:35 }, { wch:35 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Produits');
    // Feuille variantes
    const vh = ['Code Produit', 'Nom Variante', 'Valeur', 'Prix Variante'];
    const vr: any[] = [];
    this.products.forEach(p => (p.variantes||[]).forEach((v: any) => vr.push([p.code, v.nom, v.valeur, v.prix])));
    if (vr.length) {
      const ws2 = XLSX.utils.aoa_to_sheet([vh, ...vr]);
      XLSX.utils.book_append_sheet(wb, ws2, 'Variantes');
    }
    XLSX.writeFile(wb, 'produits.xlsx');
  }

  // ── Signature auto ────────────────────────────────────────────────────────

  /** Appelé à chaque changement de champ pertinent — met à jour la signature si mode auto */
  onProfilFieldChange(): void {
    if (this.signatureAutoMode) this.buildSignature();
    this.cd.markForCheck();
  }

  toggleSignatureMode(): void {
    this.signatureAutoMode = !this.signatureAutoMode;
    if (this.signatureAutoMode) this.buildSignature();
    this.cd.markForCheck();
  }

  profilNextStep(): void {
    const err = this.validateProfilStep(this.profilStep);
    if (err) {
      this.profilTouched = true;
      this.profilStepError = err;
      this.cd.markForCheck();
      return;
    }
    this.profilTouched = false;
    this.profilStepError = '';
    this.profilStep++;
    this.cd.markForCheck();
  }
  profilPrevStep(): void {
    if (this.profilStep > 1) {
      this.profilTouched = false;
      this.profilStepError = '';
      this.profilStep--;
      this.cd.markForCheck();
    }
  }
  profilGotoStep(n: number): void {
    if (n >= 1 && n < this.profilStep) {
      this.profilTouched = false;
      this.profilStepError = '';
      this.profilStep = n;
      this.cd.markForCheck();
    }
  }
  private validateProfilStep(step: number): string {
    const p = this.profilForm;
    if (step === 1) {
      if (!p.prenom.trim() && !p.nom.trim()) return 'Le prénom et le nom sont obligatoires.';
      if (!p.prenom.trim()) return 'Le prénom est obligatoire.';
      if (!p.nom.trim()) return 'Le nom est obligatoire.';
    }
    if (step === 2) {
      if (!p.societe.trim() && !p.email.trim()) return 'Le nom de la société et l\'email sont obligatoires.';
      if (!p.societe.trim()) return 'Le nom de la société est obligatoire.';
      if (!p.email.trim()) return 'L\'email professionnel est obligatoire.';
    }
    return '';
  }
  toggleProductExpand(i: number): void {
    this.expandedProductIdx = this.expandedProductIdx === i ? null : i;
    this.cd.markForCheck();
  }

  clearStepError(): void {
    const err = this.validateProfilStep(this.profilStep);
    if (!err) { this.profilStepError = ''; this.cd.markForCheck(); }
  }

  private buildSignature(): void {
    const p = this.profilForm;
    const civility = this.tonToCivility(p.tonEmail);
    const nom      = [p.prenom, p.nom].filter(Boolean).join(' ');
    const poste    = p.poste;
    const societe  = p.societe;
    const tel      = p.telephone || p.telephoneFixe;
    const email    = p.email;
    const web      = p.siteWeb;

    const lines: string[] = [civility];
    if (nom) lines.push(nom);

    const identity: string[] = [];
    if (poste)   identity.push(poste);
    if (societe) identity.push(societe);
    if (identity.length) lines.push(identity.join(' — '));

    const coords: string[] = [];
    if (tel)   coords.push(tel);
    if (email) coords.push(email);
    if (coords.length) lines.push(coords.join(' | '));

    if (web) lines.push(web);

    this.profilForm.signature = lines.join('\n');
  }

  private tonToCivility(ton: string): string {
    switch (ton) {
      case 'chaleureux': return 'Bien cordialement,';
      case 'formel':     return 'Veuillez agréer mes meilleures salutations,';
      case 'direct':     return 'Bien à vous,';
      case 'commercial': return 'Avec nos meilleures salutations,';
      default:           return 'Cordialement,';
    }
  }

  // ── Contexte IA ───────────────────────────────────────────────────────────

  generateContext(): void {
    const p = this.profilForm;
    // Si un agent est disponible → appel IA
    if (this.agents.length > 0) {
      this.generateContextWithAI(p);
    } else {
      // Fallback : génération locale depuis les champs
      this.profilForm.contexteSup = this.buildContextTemplate(p);
      this.cd.markForCheck();
    }
  }

  private generateContextWithAI(p: typeof this.profilForm): void {
    const agent = this.agents.find(a => a.agentType === 'EMAIL_MANAGER' || a.agentType === 'SCRUM_MASTER')
                  || this.agents[0];
    if (!agent) { this.profilForm.contexteSup = this.buildContextTemplate(p); this.cd.markForCheck(); return; }

    this.generatingContext = true;
    this.cd.markForCheck();

    const nom     = [p.prenom, p.nom].filter(Boolean).join(' ');
    const prompt  = `Tu es un assistant de rédaction professionnelle.
Génère un court paragraphe de contexte (3-5 phrases max) pour un agent IA, décrivant le profil de l'utilisateur suivant afin que l'agent adapte parfaitement ses communications et documents.

Informations disponibles :
- Nom : ${nom || '(non renseigné)'}
- Poste : ${p.poste || '(non renseigné)'}
- Société : ${p.societe || '(non renseigné)'}
- Secteur : ${p.secteur || '(non renseigné)'}
- Ton préféré : ${p.tonEmail}
- Langue : ${p.langue}

Le texte doit :
• Être rédigé à la 3ème personne ("L'expéditeur est…" / "La société X est…")
• Mentionner les points clés utiles pour personnaliser des emails professionnels
• Rester concis et factuel
• Être en ${p.langue === 'fr' ? 'français' : p.langue === 'en' ? 'anglais' : 'français'}

Génère uniquement le texte, sans titre ni formatage markdown.`;

    const sessionId = 'profil-ctx-' + Date.now();
    let buffer = '';

    fetch(`${this.getApiBase()}/api/agents/${agent.id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.getToken()
      },
      body: JSON.stringify({ message: prompt, sessionId })
    }).then(async resp => {
      if (!resp.body) throw new Error('No stream');
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data && data !== '[DONE]') buffer += data;
          }
        }
      }
      this.profilForm.contexteSup = buffer.trim() || this.buildContextTemplate(p);
    }).catch(() => {
      this.profilForm.contexteSup = this.buildContextTemplate(p);
    }).finally(() => {
      this.generatingContext = false;
      this.cd.markForCheck();
    });
  }

  private buildContextTemplate(p: typeof this.profilForm): string {
    const nom     = [p.prenom, p.nom].filter(Boolean).join(' ');
    const parts: string[] = [];

    if (nom && p.poste && p.societe)
      parts.push(`L'expéditeur est ${nom}, ${p.poste} chez ${p.societe}.`);
    else if (nom && p.societe)
      parts.push(`L'expéditeur est ${nom} de la société ${p.societe}.`);
    else if (p.societe)
      parts.push(`L'expéditeur représente la société ${p.societe}.`);

    if (p.secteur)
      parts.push(`La société opère dans le secteur : ${p.secteur}.`);

    if (p.siteWeb)
      parts.push(`Site web : ${p.siteWeb}.`);

    const tonMap: Record<string, string> = {
      professionnel: 'un ton professionnel et soigné',
      chaleureux:    'un ton chaleureux et amical',
      formel:        'un ton formel et institutionnel',
      direct:        'un ton direct et concis',
      commercial:    'un ton commercial et persuasif'
    };
    if (p.tonEmail)
      parts.push(`Les communications doivent utiliser ${tonMap[p.tonEmail] || p.tonEmail}.`);

    if (p.langue && p.langue !== 'fr')
      parts.push(`Langue de travail préférée : ${p.langue}.`);

    parts.push('Toujours utiliser les vraies coordonnées de l\'expéditeur (email, téléphone, nom) plutôt que des placeholders entre crochets.');

    return parts.join(' ');
  }

  private getApiBase(): string {
    return (window as any).__API_BASE__ || '';
  }

  /** Retourne le contexte profil formaté pour l'injection dans les tâches */
  getProfilContext(): string {
    const p = this.profilForm;
    if (!p.prenom && !p.nom && !p.societe) return '';

    const lines: string[] = ['[PROFIL EXPÉDITEUR]'];
    if (p.prenom || p.nom)       lines.push(`Nom complet : ${p.prenom} ${p.nom}`.trim());
    if (p.poste)                  lines.push(`Poste : ${p.poste}`);
    if (p.departement)            lines.push(`Département : ${p.departement}`);
    if (p.societe)                lines.push(`Société : ${p.societe}`);
    if (p.secteur)                lines.push(`Secteur : ${p.secteur}`);
    if (p.siteWeb)                lines.push(`Site web : ${p.siteWeb}`);
    if (p.adresse)                lines.push(`Adresse : ${p.adresse}`);
    if (p.email)                  lines.push(`Email : ${p.email}`);
    if (p.telephone)              lines.push(`Téléphone mobile : ${p.telephone}`);
    if (p.telephoneFixe)          lines.push(`Téléphone fixe : ${p.telephoneFixe}`);
    if (p.linkedin)               lines.push(`LinkedIn : ${p.linkedin}`);
    if (p.tonEmail)               lines.push(`Ton email préféré : ${p.tonEmail}`);
    if (p.langue)                 lines.push(`Langue de travail : ${p.langue}`);
    if (p.devise)                 lines.push(`Devise : ${p.devise}`);
    if (p.signature) {
      lines.push('Signature email :');
      lines.push(p.signature);
    }
    if (p.contexteSup)            lines.push(`Contexte supplémentaire : ${p.contexteSup}`);
    return lines.join('\n');
  }

  private getToken(): string {
    try { const r = localStorage.getItem('ms_auth'); return r ? JSON.parse(r).token || '' : ''; } catch { return ''; }
  }

  getTeamName(teamId: string): string {
    return this.teams.find(t => t.id === teamId)?.name || '';
  }

  agentTypeLabel(type: string): string {
    return AGENT_TYPES.find(t => t.v === type)?.l || type || '—';
  }

  getAgentById(id: string): any {
    return this.agents.find(a => a.id === id) ?? null;
  }

  // ── AGENTS CRUD ───────────────────────────────────────────────────────────
  loadAgents(): void {
    this.loadingAgents = true;
    this.http.get<any>(`${API}/api/agents`).subscribe({
      next: (res) => {
        this.agents = Array.isArray(res) ? res : res.content || [];
        this.tabs[0].count = this.agents.length;
        this.loadingAgents = false;
        this.cd.markForCheck();
      },
      error: () => { this.loadingAgents = false; this.cd.markForCheck(); }
    });
  }

  editAgent(a: any): void {
    this.agentForm = { name: a.name, type: a.agentType || a.type, teamId: a.teamId || '', description: a.description || '' };
    this.editingId = a.id;
    this.quickAdd  = 'agent';
    this.formError = '';
    this.cd.markForCheck();
  }

  saveAgent(): void {
    if (!this.agentForm.name.trim()) { this.formError = 'Le nom est obligatoire.'; return; }
    // L'équipe est obligatoire, et le refus est anticipé ici : le backend
    // répondrait 404 sur une équipe absente, message incompréhensible pour
    // l'utilisateur qui n'a simplement pas encore choisi.
    if (!this.agentForm.teamId) {
      this.formError = this.teams.length
        ? 'Choisissez l\'équipe de rattachement de l\'agent.'
        : 'Créez d\'abord une équipe : un agent doit appartenir à une équipe.';
      return;
    }
    this.saving = true; this.formError = '';
    const body: any = {
      name: this.agentForm.name.trim(),
      type: this.agentForm.type,
      description: this.agentForm.description,
      teamId: this.agentForm.teamId
    };

    const req = this.editingId
      ? this.http.put<any>(`${API}/api/agents/${this.editingId}`, body)
      : this.http.post<any>(`${API}/api/agents`, body);

    req.subscribe({
      next: (agent) => {
        if (this.editingId) {
          const i = this.agents.findIndex(a => a.id === this.editingId);
          if (i >= 0) this.agents[i] = agent;
        } else {
          this.agents = [agent, ...this.agents];
        }
        this.tabs[0].count = this.agents.length;
        this.saving = false; this.quickAdd = ''; this.editingId = '';
        this.cd.markForCheck();
      },
      error: (e) => { this.formError = `Erreur : ${e?.error?.message || e?.message || ''}`; this.saving = false; this.cd.markForCheck(); }
    });
  }

  async deleteAgent(a: any): Promise<void> {
    const ok = await this.dialog.confirm(`Supprimer "${a.name}" ?`, 'Supprimer l\'agent', 'Supprimer', 'Annuler');
    if (!ok) return;
    this.http.delete(`${API}/api/agents/${a.id}`).subscribe({
      next: () => { this.agents = this.agents.filter(x => x.id !== a.id); this.tabs[0].count = this.agents.length; this.cd.markForCheck(); },
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  // ── TEAMS CRUD ────────────────────────────────────────────────────────────
  loadTeams(): void {
    this.loadingTeams = true;
    this.http.get<any>(`${API}/api/teams`).subscribe({
      next: (res) => {
        this.teams = Array.isArray(res) ? res : res.content || [];
        this.tabs[1].count = this.teams.length;
        this.loadingTeams = false;
        this.cd.markForCheck();
      },
      error: () => { this.loadingTeams = false; this.cd.markForCheck(); }
    });
  }

  editTeam(t: any): void {
    this.teamForm  = { name: t.name, description: t.description || '' };
    this.editingId = t.id;
    this.quickAdd  = 'team';
    this.formError = '';
    this.cd.markForCheck();
  }

  saveTeam(): void {
    if (!this.teamForm.name.trim()) { this.formError = 'Le nom est obligatoire.'; return; }
    this.saving = true; this.formError = '';
    const body = { name: this.teamForm.name.trim(), description: this.teamForm.description, teamType: 'BUSINESS' };

    const req = this.editingId
      ? this.http.put<any>(`${API}/api/teams/${this.editingId}`, body)
      : this.http.post<any>(`${API}/api/teams`, body);

    req.subscribe({
      next: (team) => {
        if (this.editingId) {
          const i = this.teams.findIndex(t => t.id === this.editingId);
          if (i >= 0) this.teams[i] = { ...this.teams[i], ...team };
        } else {
          this.teams = [team, ...this.teams];
        }
        this.tabs[1].count = this.teams.length;
        this.saving = false; this.quickAdd = ''; this.editingId = '';
        this.cd.markForCheck();
      },
      error: (e) => { this.formError = `Erreur : ${e?.error?.message || ''}`; this.saving = false; this.cd.markForCheck(); }
    });
  }

  async deleteTeam(t: any): Promise<void> {
    const ok = await this.dialog.confirm(`Supprimer l'équipe "${t.name}" ?`, 'Supprimer l\'équipe', 'Supprimer', 'Annuler');
    if (!ok) return;
    this.http.delete(`${API}/api/teams/${t.id}`).subscribe({
      next: () => { this.teams = this.teams.filter(x => x.id !== t.id); this.tabs[1].count = this.teams.length; this.cd.markForCheck(); },
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  // ── TASKS CRUD ────────────────────────────────────────────────────────────
  loadTasks(): void {
    this.loadingTasks = true;
    let url = `${API}/api/tasks`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.tasks = Array.isArray(res) ? res : res.content || [];
        this.tabs[2].count = this.tasks.length;
        this.loadingTasks = false;
        this.cd.markForCheck();
      },
      error: () => { this.loadingTasks = false; this.cd.markForCheck(); }
    });
  }

  updateTaskStatus(task: any, status: string): void {
    const prev = task.status;
    this.http.patch(`${API}/api/tasks/${task.id}/status`, { status }).subscribe({
      next: () => { task.status = status; this.cd.markForCheck(); },
      error: (e) => { task.status = prev; this.dialog.alert(`Erreur statut : ${e?.error?.message || ''}`, 'Erreur', 'error'); this.cd.markForCheck(); }
    });
  }

  async deleteTask(task: any): Promise<void> {
    const hasSocialPosts = !!task.socialPostIds && task.socialPostIds !== '{}';
    let socialPlatforms: string[] = [];
    if (hasSocialPosts) {
      try { socialPlatforms = Object.keys(JSON.parse(task.socialPostIds)); } catch {}
    }
    const socialNote = socialPlatforms.length
      ? `\n\n⚠️ La publication associée sur ${socialPlatforms.join(', ')} sera également supprimée définitivement.`
      : '';
    const ok = await this.dialog.confirm(
      `Supprimer la tâche "${task.title}" ?${socialNote}`,
      'Supprimer la tâche', 'Supprimer', 'Annuler', 'error'
    );
    if (!ok) return;
    this.http.delete(`${API}/api/tasks/${task.id}`, { headers: this.authHeaders() }).subscribe({
      next: () => { this.tasks = this.tasks.filter(t => t.id !== task.id); this.tabs[2].count = this.tasks.length; this.cd.markForCheck(); },
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  saveTask(): void {
    if (!this.taskForm.title.trim()) { this.formError = 'Le titre est obligatoire.'; return; }
    if (this.taskForm.schedulingMode === 'scheduled' && !this.taskForm.scheduledAt) {
      this.formError = 'Choisissez une date/heure pour la tâche planifiée.'; return;
    }
    this.savingTask = true;
    this.formError = '';

    const profilCtx = this.getProfilContext();

    // Injection produits sélectionnés
    let prodCtx = '';
    if (this.taskForm.selectedProductCodes.length) {
      const selProds = this.products.filter(p => this.taskForm.selectedProductCodes.includes(p.code));
      prodCtx = '=== PRODUITS SÉLECTIONNÉS ===\n' + selProds.map(p => {
        let s = `[${p.code}] ${p.nom} — Prix: ${p.prix}€${p.prixPromo ? ` (promo: ${p.prixPromo}€)` : ''}\n${p.description||''}`;
        if (p.variantes?.length) s += `\nVariantes: ${p.variantes.map((v: any) => `${v.nom}=${v.valeur}`).join(', ')}`;
        if (p.mentions?.length)  s += `\n${p.mentions.map((m: any) => `${m.type}: ${m.contenu}`).join('\n')}`;
        return s;
      }).join('\n---\n');
    }
    // Injection clients sélectionnés
    let clientCtx = '';
    if (this.taskForm.selectedClientCodes.length) {
      const selClients = this.clients.filter(c => this.taskForm.selectedClientCodes.includes(c.code));
      clientCtx = '=== CLIENTS CIBLES ===\n' + selClients.map(c =>
        `[${c.code}] ${c.nom} ${c.prenoms} — Email: ${c.email}${c.entrepriseName ? ` — ${c.entrepriseName}` : ''}`
      ).join('\n');
    }

    const desc = [
      this.taskForm.description.trim(),
      prodCtx,
      clientCtx,
      profilCtx
    ].filter(Boolean).join('\n\n');

    const body: any = {
      title: this.taskForm.title.trim(),
      description: desc || null,
      type: this.taskForm.type,
      priority: this.taskForm.priority,
      assignedAgentId: this.taskForm.assignedAgentId || null,
      scheduledAt: this.taskForm.schedulingMode === 'scheduled' ? this.taskForm.scheduledAt : null,
    };

    // Promotion produit : champs dédiés envoyés au backend
    if (this.taskForm.type === 'PRODUCT_PROMOTION') {
      if (this.taskForm.selectedProductCodes.length)
        body.productCodes = this.taskForm.selectedProductCodes;
      if (this.taskForm.platforms.length)
        body.platforms = this.taskForm.platforms;
      if (this.taskForm.hashtags.trim())
        body.hashtags = this.taskForm.hashtags.trim();
      if (this.taskForm.tone)
        body.tone = this.taskForm.tone;
      if (this.taskForm.campaignObjective)
        body.campaignObjective = this.taskForm.campaignObjective;
    }

    this.http.post<any>(`${API}/api/tasks`, body).subscribe({
      next: (task) => {
        this.tasks.unshift(task);
        this.tabs[2].count = this.tasks.length;
        this.savingTask = false;
        this.quickAdd = '';
        this.resetForms();
        this.cd.markForCheck();
      },
      error: (e) => {
        this.formError = e?.error?.message || 'Erreur lors de la création.';
        this.savingTask = false;
        this.cd.markForCheck();
      }
    });
  }

  // ── INBOX ─────────────────────────────────────────────────────────────────
  private updateInboxTabCount(): void {
    const tab = this.tabs.find(t => t.id === 'email');
    if (tab) tab.count = this.inboxItems.length;
  }

  selectInboxItem(item: any): void {
    this.selectedInboxItem = item;
    this.replyDraftSubject = this.buildReplySubject(item);
    this.replyDraftBody = this.buildReplyBody(item);
    this.emailReplyModalOpen = true;
    this.cd.markForCheck();
  }

  closeInboxReplyModal(): void {
    this.emailReplyModalOpen = false;
    this.selectedInboxItem = null;
    this.cd.markForCheck();
  }

  private buildReplySubject(item: any): string {
    const base = item?.subject?.trim() || '(sans objet)';
    return base.startsWith('Re:') ? base : `Re: ${base}`;
  }

  private buildReplyBody(item: any): string {
    const sender = (item?.fromAddress || 'Bonjour').split('@')[0] || 'Bonjour';
    const sig = [this.profilForm.prenom, this.profilForm.nom].filter(Boolean).join(' ').trim();
    const company = this.profilForm.societe?.trim() || '';
    return [
      `Bonjour ${sender},`,
      '',
      'Merci pour votre message.',
      'Nous vous recontactons dans les meilleurs délais.',
      '',
      'Cordialement,',
      sig || 'L’équipe',
      company
    ].filter(Boolean).join('\n');
  }

  loadInbox(): void {
    this.loadingInbox = true;
    this.http.get<any>(`${API}/api/inbox`, { headers: this.authHeaders() }).subscribe({
      next: (res) => {
        const allItems = Array.isArray(res) ? res : res.content || [];
        const emailChannels = ['GMAIL', 'EMAIL', 'EMAIL_SMTP', 'SMTP'];
        this.inboxItems = allItems.filter((item: any) => {
          const channel = (item?.channel || '').toString().toUpperCase();
          const direction = (item?.direction || '').toString().toUpperCase();
          return emailChannels.includes(channel) && direction !== 'OUTBOUND';
        });
        this.updateInboxTabCount();
        this.loadingInbox = false;
        this.cd.markForCheck();
      },
      error: () => { this.loadingInbox = false; this.cd.markForCheck(); }
    });
  }

  prepareInboxReply(item: any): void {
    if (!this.replyDraftBody?.trim()) {
      this.dialog.alert('Ajoutez un contenu de réponse avant de continuer.', 'Information', 'info');
      return;
    }
    this.processingInboxReply = true;
    this.http.patch(`${API}/api/inbox/${item.id}/prepare-reply`, {
      replySubject: this.replyDraftSubject || this.buildReplySubject(item),
      replyBody: this.replyDraftBody,
      autoSend: this.emailAutoMode
    }, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.processingInboxReply = false;
        this.emailReplyModalOpen = false;
        this.selectedInboxItem = null;
        this.dialog.alert(this.emailAutoMode ? 'Réponse préparée pour envoi.' : 'Réponse mise en attente d’approbation.', 'Succès', 'success');
        this.loadInbox();
        this.cd.markForCheck();
      },
      error: (e) => {
        this.processingInboxReply = false;
        this.dialog.alert(`Erreur : ${e?.error?.message || 'Impossible de préparer la réponse.'}`, 'Erreur', 'error');
      }
    });
  }

  sendInboxReply(item: any): void {
    if (!this.replyDraftBody?.trim()) {
      this.dialog.alert('Ajoutez un contenu de réponse avant de l’envoyer.', 'Information', 'info');
      return;
    }
    this.processingInboxReply = true;
    this.http.post(`${API}/api/inbox/${item.id}/send-reply`, {
      replySubject: this.replyDraftSubject || this.buildReplySubject(item),
      replyBody: this.replyDraftBody,
      autoSend: true
    }, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.processingInboxReply = false;
        this.dialog.alert('Réponse envoyée avec succès.', 'Succès', 'success');
        this.inboxItems = this.inboxItems.filter(i => i.id !== item.id);
        this.updateInboxTabCount();
        this.selectedInboxItem = null;
        this.emailReplyModalOpen = false;
        this.cd.markForCheck();
      },
      error: (e) => {
        this.processingInboxReply = false;
        this.dialog.alert(`Erreur : ${e?.error?.message || 'Impossible d’envoyer la réponse.'}`, 'Erreur', 'error');
      }
    });
  }

  approveInbox(item: any): void {
    this.http.patch(`${API}/api/inbox/${item.id}/approve`, {}, { headers: this.authHeaders() }).subscribe({
      next: () => { this.inboxItems = this.inboxItems.filter(i => i.id !== item.id); this.updateInboxTabCount(); this.cd.markForCheck(); },
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  rejectInbox(item: any): void {
    this.http.patch(`${API}/api/inbox/${item.id}/reject`, {}, { headers: this.authHeaders() }).subscribe({
      next: () => { this.inboxItems = this.inboxItems.filter(i => i.id !== item.id); this.updateInboxTabCount(); this.cd.markForCheck(); },
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(
      () => this.dialog.alert('Copié dans le presse-papiers.', 'Copié', 'success'),
      () => this.dialog.alert('Impossible de copier.', 'Erreur', 'error')
    );
  }

  // ── FACEBOOK COMMENTS ─────────────────────────────────────────────────────

  loadFbPosts(): void {
    if (!this.fbAgentId) return;
    this.fbPosts = [];
    this.fbSelectedPost = null;
    this.fbComments = [];
    this.fbLoadingPosts = true;
    this.http.get<any>(`${API}/api/facebook/${this.fbAgentId}/posts?sinceHours=${this.fbSinceHours}&limit=20`).subscribe({
      next: (res) => {
        this.fbPosts = res.posts || [];
        this.fbLoadingPosts = false;
        this.cd.markForCheck();
      },
      error: (e) => {
        this.fbLoadingPosts = false;
        this.dialog.alert(`Erreur : ${e?.error?.message || e?.message || 'Canal Facebook non configuré ou déconnecté.'}`, 'Erreur Facebook', 'error');
        this.cd.markForCheck();
      }
    });
  }

  startEditFbPost(post: any): void {
    this.fbEditingPostId   = post.id;
    this.fbEditingPostText = post.message || '';
    this.cd.markForCheck();
  }

  cancelEditFbPost(): void {
    this.fbEditingPostId   = null;
    this.fbEditingPostText = '';
    this.cd.markForCheck();
  }

  confirmEditFbPost(post: any): void {
    const msg = this.fbEditingPostText.trim();
    if (!msg || !this.fbAgentId) return;
    this.fbEditSaving = true;
    this.cd.markForCheck();
    this.http.patch<any>(
      `${API}/api/facebook/${this.fbAgentId}/posts/${post.id}`,
      { message: msg },
      { headers: this.authHeaders() }
    ).subscribe({
      next: () => {
        post.message = msg;
        this.fbEditingPostId   = null;
        this.fbEditingPostText = '';
        this.fbEditSaving      = false;
        this.cd.markForCheck();
      },
      error: (e) => {
        this.fbEditSaving = false;
        this.cd.markForCheck();
        this.dialog.alert('Erreur lors de la modification : ' + (e.error?.error || e.message), 'Erreur', 'error');
      }
    });
  }

  deleteFbPost(post: any): void {
    this.dialog.confirm(
      `Supprimer définitivement cette publication Facebook ?\n\n"${(post.message || '').slice(0, 80)}…"`,
      '🗑 Supprimer la publication',
      'Supprimer', 'Annuler', 'error'
    ).then(confirmed => {
      if (!confirmed) return;
      this.http.delete<any>(
        `${API}/api/facebook/${this.fbAgentId}/posts/${post.id}`,
        { headers: this.authHeaders() }
      ).subscribe({
        next: () => {
          this.fbPosts = this.fbPosts.filter(p => p.id !== post.id);
          if (this.fbSelectedPost?.id === post.id) {
            this.fbSelectedPost = null;
            this.fbComments = [];
          }
          this.cd.markForCheck();
        },
        error: (e) => {
          this.dialog.alert('Erreur lors de la suppression : ' + (e.error?.error || e.message), 'Erreur', 'error');
        }
      });
    });
  }

  selectFbPost(post: any): void {
    this.fbSelectedPost = post;
    this.fbComments = [];
    this.fbLoadingComments = true;
    this.cd.markForCheck();
    this.http.get<any>(`${API}/api/facebook/${this.fbAgentId}/posts/${post.id}/comments?limit=50`).subscribe({
      next: (res) => {
        this.fbComments = res.comments || [];
        this.fbLoadingComments = false;
        this.cd.markForCheck();
      },
      error: (e) => {
        this.fbLoadingComments = false;
        this.dialog.alert(`Erreur commentaires : ${e?.error?.message || e?.message || ''}`, 'Erreur Facebook', 'error');
        this.cd.markForCheck();
      }
    });
  }

  sendFbReply(comment: any): void {
    const msg = (this.fbReplyText[comment.id] || '').trim();
    if (!msg) return;
    this.fbSendingReply[comment.id] = true;
    this.cd.markForCheck();
    this.http.post<any>(
      `${API}/api/facebook/${this.fbAgentId}/comments/${comment.id}/reply`,
      { message: msg }
    ).subscribe({
      next: () => {
        this.fbReplyText[comment.id] = '';
        this.fbSendingReply[comment.id] = false;
        this.dialog.alert('Réponse publiée et archivée dans l\'inbox.', 'Succès', 'success');
        this.cd.markForCheck();
      },
      error: (e) => {
        this.fbSendingReply[comment.id] = false;
        this.dialog.alert(`Erreur : ${e?.error?.error || e?.message || ''}`, 'Erreur Facebook', 'error');
        this.cd.markForCheck();
      }
    });
  }

  loadFbPostById(): void {
    const raw = this.fbPostUrlInput.trim();
    if (!raw || !this.fbAgentId) return;
    // Extraire l'ID depuis une URL Facebook ou utiliser directement si c'est un ID
    let postId = raw;
    // URLs type: https://www.facebook.com/permalink.php?story_fbid=XXX&id=YYY → XXX_YYY
    const permalinkMatch = raw.match(/story_fbid=(\d+).*?[&?]id=(\d+)/);
    if (permalinkMatch) postId = permalinkMatch[2] + '_' + permalinkMatch[1];
    // URLs type: https://www.facebook.com/PageName/posts/XXX → pageId_XXX
    else {
      const postsMatch = raw.match(/\/posts\/(\d+)/);
      if (postsMatch) postId = this.fbPostUrlInput.includes('/')
        ? (postsMatch[1].includes('_') ? postsMatch[1] : postsMatch[1])
        : postsMatch[1];
    }
    // Charger comme post sélectionné
    this.fbSelectedPost = { id: postId, message: 'Publication chargée par ID : ' + postId };
    this.fbPostUrlInput = '';
    this.fbComments = [];
    this.fbLoadingComments = true;
    this.cd.markForCheck();
    this.http.get<any>(`${API}/api/facebook/${this.fbAgentId}/posts/${postId}/comments?limit=50`).subscribe({
      next: (res) => {
        this.fbComments = res.comments || [];
        this.fbLoadingComments = false;
        this.cd.markForCheck();
      },
      error: (e) => {
        this.fbLoadingComments = false;
        this.dialog.alert(`Impossible de charger : ${e?.error?.message || e?.message || ''}`, 'Erreur Facebook', 'error');
        this.cd.markForCheck();
      }
    });
  }

  sendFbPostComment(): void {
    const msg = this.fbPostComment.trim();
    if (!msg || !this.fbSelectedPost) return;
    this.fbSendingPostComment = true;
    this.cd.markForCheck();
    this.http.post<any>(
      `${API}/api/facebook/${this.fbAgentId}/posts/${this.fbSelectedPost.id}/comment`,
      { message: msg }
    ).subscribe({
      next: () => {
        this.fbPostComment = '';
        this.fbSendingPostComment = false;
        this.dialog.alert('Commentaire publié et archivé dans l\'inbox.', 'Succès', 'success');
        // Recharger les commentaires pour voir le nouveau
        this.selectFbPost(this.fbSelectedPost);
        this.cd.markForCheck();
      },
      error: (e) => {
        this.fbSendingPostComment = false;
        this.dialog.alert(`Erreur : ${e?.error?.error || e?.message || ''}`, 'Erreur Facebook', 'error');
        this.cd.markForCheck();
      }
    });
  }

  scanFbPost(): void {
    if (!this.fbSelectedPost || !this.fbAgentId) return;
    this.fbScanning = true;
    this.cd.markForCheck();
    this.http.post<any>(
      `${API}/api/facebook/${this.fbAgentId}/posts/${this.fbSelectedPost.id}/scan`, {}
    ).subscribe({
      next: (res) => {
        this.fbScanning = false;
        const n = res.newTasksCreated ?? 0;
        if (n > 0)
          this.dialog.alert(`${n} nouveau(x) commentaire(s) détecté(s). L'agent va répondre dans quelques instants.`, 'Scan terminé', 'success');
        else
          this.dialog.alert('Aucun nouveau commentaire détecté (déjà traités ou aucun commentaire).', 'Scan terminé', 'info');
        this.cd.markForCheck();
      },
      error: (e) => {
        this.fbScanning = false;
        this.dialog.alert(`Erreur scan : ${e?.error?.message || e?.message || ''}`, 'Erreur', 'error');
        this.cd.markForCheck();
      }
    });
  }

  renewFbToken(): void {
    if (!this.fbAgentId || !this.fbRenewForm.appId || !this.fbRenewForm.appSecret || !this.fbRenewForm.shortToken) return;
    this.fbRenewing    = true;
    this.fbRenewResult = null;
    // Seul l'appId est mémorisé. L'appSecret ne doit jamais être écrit dans
    // le localStorage : il est de toute façon déjà présent côté serveur, dans
    // la configuration de plateforme.
    localStorage.setItem('fb_renew_appId', this.fbRenewForm.appId);
    localStorage.removeItem('fb_renew_appSecret');
    this.cd.markForCheck();
    this.http.post<any>(
      `${API}/api/facebook/${this.fbAgentId}/renew-token`,
      { appId: this.fbRenewForm.appId, appSecret: this.fbRenewForm.appSecret, shortToken: this.fbRenewForm.shortToken },
      { headers: this.authHeaders() }
    ).subscribe({
      next: (res) => {
        this.fbRenewing    = false;
        this.fbRenewResult = { pageName: res.pageName, pageId: res.pageId };
        this.fbRenewForm.shortToken = '';
        this.onFbAgentChange(this.fbAgentId); // rafraîchit le compte à rebours
        this.cd.markForCheck();
      },
      error: (e) => {
        this.fbRenewing = false;
        this.dialog.alert(e?.error?.error || e?.message || 'Erreur renouvellement', 'Erreur', 'error');
        this.cd.markForCheck();
      }
    });
  }

  onFbAgentChange(agentId: string): void {
    this.fbTokenInfo   = null;
    this.fbPosts       = [];
    this.fbSelectedPost = null;
    this.fbRenewResult = null;
    if (!agentId) return;
    // Restaurer l'APP_ID mémorisé. L'appSecret reste saisi à chaque fois :
    // il n'est jamais persisté dans le navigateur.
    this.fbRenewForm.appId = localStorage.getItem('fb_renew_appId') || '';
    this.fbRenewForm.appSecret = '';
    this.http.get<any[]>(`${API}/api/agents/${agentId}/channels`, { headers: this.authHeaders() }).subscribe({
      next: (channels) => {
        const fbChannel = (channels || []).find((c: any) =>
          c.platformType === 'FACEBOOK' && c.status === 'CONNECTED' && c.tokenExpiresAt
        );
        if (!fbChannel) return;
        const expiresAt = new Date(fbChannel.tokenExpiresAt);
        const now = new Date();
        const msLeft = expiresAt.getTime() - now.getTime();
        const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
        let level: 'ok'|'warning'|'critical'|'expired' =
          daysLeft <= 0  ? 'expired'  :
          daysLeft <= 7  ? 'critical' :
          daysLeft <= 20 ? 'warning'  : 'ok';
        this.fbTokenInfo = { daysLeft: Math.max(0, daysLeft), expiresAt, level };
        this.cd.markForCheck();
      }
    });
  }

  triggerFbScan(): void {
    if (!this.fbAgentId) return;
    this.fbTriggeringNow = true;
    this.cd.markForCheck();
    this.http.post<any>(`${API}/api/facebook/${this.fbAgentId}/scan`, {}).subscribe({
      next: (res) => {
        this.fbTriggeringNow = false;
        const n = res.channelsScanned ?? 0;
        this.dialog.alert(`Scan déclenché sur ${n} canal(aux). Les nouvelles réponses apparaîtront dans les tâches.`, 'Scan lancé', 'success');
        this.cd.markForCheck();
      },
      error: (e) => {
        this.fbTriggeringNow = false;
        this.dialog.alert(`Erreur : ${e?.error?.message || e?.message || ''}`, 'Erreur', 'error');
        this.cd.markForCheck();
      }
    });
  }

  // ── INSTAGRAM ─────────────────────────────────────────────────────────────

  onImgError(event: Event): void {
    const el = event.target as HTMLElement;
    if (el) el.style.display = 'none';
  }

  onIgAgentChange(agentId: string): void {
    this.igAgentId    = agentId;
    this.igMedia      = [];
    this.igSelectedMedia = null;
    this.igComments   = [];
    this.igReplyText  = {};
    this.igSendingReply = {};
    if (!agentId) return;
    this.loadIgMedia();
  }

  loadIgMedia(): void {
    if (!this.igAgentId) return;
    this.igLoadingMedia = true;
    this.cd.markForCheck();
    this.http.get<any>(`${API}/api/instagram/${this.igAgentId}/media?limit=20`, { headers: this.authHeaders() }).subscribe({
      next: (res) => {
        this.igMedia = Array.isArray(res.media) ? res.media : [];
        this.igLoadingMedia = false;
        this.cd.markForCheck();
      },
      error: (e) => {
        this.igLoadingMedia = false;
        this.dialog.alert(`Erreur chargement médias: ${e?.error?.error || e?.message || ''}`, 'Erreur', 'error');
        this.cd.markForCheck();
      }
    });
  }

  selectIgMedia(media: any): void {
    this.igSelectedMedia = media;
    this.igComments = [];
    this.igReplyText = {};
    this.igLoadingComments = true;
    this.cd.markForCheck();
    this.http.get<any>(`${API}/api/instagram/${this.igAgentId}/media/${media.id}/comments?limit=50`, { headers: this.authHeaders() }).subscribe({
      next: (res) => {
        this.igComments = Array.isArray(res.comments) ? res.comments : [];
        this.igLoadingComments = false;
        this.cd.markForCheck();
      },
      error: () => { this.igLoadingComments = false; this.cd.markForCheck(); }
    });
  }

  sendIgReply(comment: any): void {
    const text = this.igReplyText[comment.id]?.trim();
    if (!text || !this.igAgentId) return;
    this.igSendingReply[comment.id] = true;
    this.cd.markForCheck();
    this.http.post<any>(`${API}/api/instagram/${this.igAgentId}/comments/${comment.id}/reply`,
      { message: text }, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.igReplyText[comment.id] = '';
        this.igSendingReply[comment.id] = false;
        this.cd.markForCheck();
      },
      error: (e) => {
        this.igSendingReply[comment.id] = false;
        this.dialog.alert(`Erreur : ${e?.error?.error || e?.message || ''}`, 'Erreur', 'error');
        this.cd.markForCheck();
      }
    });
  }

  deleteIgMedia(media: any): void {
    if (!confirm(`Supprimer cette publication Instagram définitivement ?`)) return;
    this.http.delete<any>(`${API}/api/instagram/${this.igAgentId}/media/${media.id}`, { headers: this.authHeaders() }).subscribe({
      next: () => {
        this.igMedia = this.igMedia.filter(m => m.id !== media.id);
        if (this.igSelectedMedia?.id === media.id) { this.igSelectedMedia = null; this.igComments = []; }
        this.cd.markForCheck();
      },
      error: (e) => this.dialog.alert(`Erreur suppression : ${e?.error?.error || e?.message || ''}`, 'Erreur', 'error')
    });
  }

  triggerIgScan(): void {
    if (!this.igAgentId) return;
    this.igTriggeringNow = true;
    this.cd.markForCheck();
    this.http.post<any>(`${API}/api/instagram/${this.igAgentId}/scan`, {}, { headers: this.authHeaders() }).subscribe({
      next: (res) => {
        this.igTriggeringNow = false;
        this.dialog.alert(`Scan Instagram déclenché — ${res.newTasksCreated ?? 0} nouvelle(s) tâche(s) créée(s).`, 'Scan lancé', 'success');
        this.cd.markForCheck();
      },
      error: (e) => {
        this.igTriggeringNow = false;
        this.dialog.alert(`Erreur : ${e?.error?.message || e?.message || ''}`, 'Erreur', 'error');
        this.cd.markForCheck();
      }
    });
  }

  scanIgMedia(): void {
    if (!this.igAgentId || !this.igSelectedMedia) return;
    this.igScanning = true;
    this.cd.markForCheck();
    this.http.post<any>(`${API}/api/instagram/${this.igAgentId}/media/${this.igSelectedMedia.id}/scan`, {}, { headers: this.authHeaders() }).subscribe({
      next: (res) => {
        this.igScanning = false;
        this.dialog.alert(`${res.newTasksCreated ?? 0} nouvelle(s) tâche(s) de réponse créée(s).`, 'Scan terminé', 'success');
        this.cd.markForCheck();
      },
      error: () => { this.igScanning = false; this.cd.markForCheck(); }
    });
  }

  fetchIgUserId(): void {
    const token  = this.channelForm.igAccessToken.trim();
    const pageId = this.channelForm.fbPageId.trim();
    if (!token)  { this.igFetchIgIdError = 'Entrez le Page Access Token en premier.'; return; }
    if (!pageId) { this.igFetchIgIdError = 'Entrez le Page ID Facebook associé.'; return; }
    this.igFetchingIgId = true;
    this.igFetchIgIdError = '';
    this.cd.markForCheck();
    this.http.post<any>(`${API}/api/instagram/fetch-ig-user-id`,
      { pageId, accessToken: token }, { headers: this.authHeaders() }).subscribe({
      next: (res) => {
        this.channelForm.igUserId = res.igUserId || '';
        this.igFetchingIgId = false;
        this.cd.markForCheck();
      },
      error: (e) => {
        this.igFetchIgIdError = e?.error?.error || e?.message || 'Erreur récupération igUserId';
        this.igFetchingIgId = false;
        this.cd.markForCheck();
      }
    });
  }

  // ── PROMPTS CRUD ──────────────────────────────────────────────────────────
  loadPrompts(): void {
    this.loadingPrompts = true;
    this.http.get<any>(`${API}/api/agents/prompts`).subscribe({
      next: (res) => {
        this.prompts = Array.isArray(res) ? res : res.content || [];
        this.tabs[4].count = this.prompts.length;
        this.loadingPrompts = false;
        this.cd.markForCheck();
      },
      error: () => { this.loadingPrompts = false; this.cd.markForCheck(); }
    });
  }

  editPrompt(p: any): void {
    this.promptForm = { agentId: p.agentId || '', name: p.name || '', content: p.content || '' };
    this.editingId  = p.id;
    this.quickAdd   = 'prompt';
    this.formError  = '';
    this.cd.markForCheck();
  }

  savePrompt(): void {
    if (!this.promptForm.agentId) { this.formError = 'Sélectionnez un agent.'; return; }
    if (!this.promptForm.content.trim()) { this.formError = 'Le contenu est obligatoire.'; return; }
    this.saving = true; this.formError = '';
    const agentId = this.promptForm.agentId;
    const body = { name: this.promptForm.name || 'Prompt personnalisé', content: this.promptForm.content, type: 'SYSTEM', active: true };

    const req = this.editingId
      ? this.http.put<any>(`${API}/api/agents/${agentId}/prompts/${this.editingId}`, body)
      : this.http.post<any>(`${API}/api/agents/${agentId}/prompts`, body);

    req.subscribe({
      next: (p) => {
        if (this.editingId) {
          const i = this.prompts.findIndex(x => x.id === this.editingId);
          if (i >= 0) this.prompts[i] = p;
        } else {
          this.prompts = [p, ...this.prompts];
        }
        this.tabs[4].count = this.prompts.length;
        this.saving = false; this.quickAdd = ''; this.editingId = '';
        this.cd.markForCheck();
      },
      error: (e) => { this.formError = `Erreur : ${e?.error?.message || ''}`; this.saving = false; this.cd.markForCheck(); }
    });
  }

  async deletePrompt(p: any): Promise<void> {
    const ok = await this.dialog.confirm(`Supprimer le prompt "${p.name}" ?`, 'Supprimer le prompt', 'Supprimer', 'Annuler');
    if (!ok) return;
    const agentId = p.agentId;
    this.http.delete(`${API}/api/agents/${agentId}/prompts/${p.id}`).subscribe({
      next: () => { this.prompts = this.prompts.filter(x => x.id !== p.id); this.tabs[4].count = this.prompts.length; this.cd.markForCheck(); },
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  // ── WORKFLOW ──────────────────────────────────────────────────────────────
  loadWorkflows(): void {
    this.loadingWorkflows = true;
    this.http.get<any>(`${API}/api/tasks?source=INTER_AGENT&limit=50`).subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : res.content || [];
        this.workflows = list.map((t: any) => ({
          ...t,
          agentName: t.assignedAgentId,
          duration: t.completedAt && t.startedAt
            ? this.calcDuration(t.startedAt, t.completedAt) : null,
        }));
        this.tabs[5].count = this.workflows.length;
        this.loadingWorkflows = false;
        this.cd.markForCheck();
      },
      error: () => { this.loadingWorkflows = false; this.cd.markForCheck(); }
    });
  }

  private calcDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const s  = Math.floor(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s/60)}m${s%60}s`;
  }

  // ── LLM PROVIDERS ─────────────────────────────────────────────────────────
  setLlmMode(mode: 'agent' | 'team' | 'account'): void {
    this.llmMode = mode;
    this.quickAdd = '';
    this.llmBulkResult = [];
    this.llmSelectedProvider = '';
    this.formError = '';
    if (mode === 'agent' && this.llmAgentId) this.loadLlmProviders(this.llmAgentId);
    if (mode === 'team' && this.llmTeamId) this.loadTeamLlmProviders(this.llmTeamId);
    if (mode === 'account') {
      // Nouveau passage dans l'onglet : on réautorise une tentative de
      // provisionnement, pour qu'un défaut de plateforme marqué depuis peu
      // apparaisse chez un utilisateur qui était encore vide.
      this.accountProvisioningChecked = false;
      this.loadAccountLlmProviders();
      if (this.isAdmin) this.loadPlatformDefault();
    }
  }

  /**
   * Agents d'une équipe, augmentés de l'agent système du compte.
   *
   * Studio n'appartient à aucune équipe — il est rattaché au compte, pas à une
   * équipe — mais il est proposé dans chacune d'elles : c'est l'agent que
   * l'utilisateur retrouve quel que soit le filtre, et son modèle se règle
   * comme celui de n'importe quel agent.
   */
  agentsInTeam(teamId: string): any[] {
    return this.agents.filter(a => a.teamId === teamId || a.defaultSystem);
  }

  /**
   * Remplit le formulaire à partir d'un provider déjà enregistré.
   *
   * <p>Ne présélectionne plus de modèle : un identifiant mémorisé dans un preset
   * peut avoir été retiré par le fournisseur depuis. La liste réellement
   * disponible est rechargée et l'utilisateur choisit.
   */
  applyLlmPreset(preset: string): void {
    const p = this.LLM_PRESETS[preset];
    if (!p) return;
    this.llmSelectedProvider = preset;
    this.llmForm.type    = p.type;
    this.llmForm.modelId = '';
    this.llmForm.baseUrl = p.baseUrl;
    this.llmHint         = p.hint;
    this.llmShowKey      = false;
    this.formError       = '';
    this.loadLlmModels();
  }

  get llmCatalogKeys(): string[] { return Object.keys(this.LLM_PROVIDERS); }

  selectLlmProvider(key: string): void {
    this.llmSelectedProvider = key;
    const p = this.LLM_PROVIDERS[key];
    this.llmForm.type    = p.type;
    this.llmForm.baseUrl = p.baseUrl;
    this.llmHint         = p.hint;
    this.llmShowKey      = false;
    this.llmForm.modelId = '';
    this.formError = '';
    this.loadLlmModels();
  }

/**
   * Charge les modèles réellement exposés par le fournisseur.
   *
   * <p>La clé n'est envoyée que si l'utilisateur l'a déjà saisie dans le
   * formulaire : sans elle, Groq/OpenAI refusent /models et l'interface
   * bascule automatiquement en saisie libre (étape 2) plutôt que de proposer
   * une liste périmée.
   *
   * <p>La requête est un POST dont le corps porte la clé, pas un GET avec la
   * clé dans l'URL : une URL est consignée dans les journaux d'accès et dans
   * l'historique du navigateur, ce qui exposerait la clé en clair.
   */
  loadLlmModels(): void {
    const key = this.llmSelectedProvider;
    if (!key) return;
    const provider = this.LLM_PROVIDERS[key];
    this.llmModelsLoading = true;
    this.llmModelsMessage = '';
    this.cd.markForCheck();

    this.http.post<{ source: string; models: string[]; message?: string }>(
      `${API}/api/users/me/llm-providers/models/preview`, {
        type: provider.type,
        baseUrl: provider['baseUrl'] || null,
        apiKey: (this.llmForm['apiKey'] || '').trim() || null
      }
    ).subscribe({
      next: (res) => {
        if (this.llmSelectedProvider !== key) return;
        this.llmModels        = res?.models ?? [];
        this.llmModelsSource  = normalizeModelSource(res?.source);
        this.llmModelsMessage = this.llmModels.length === 0
          ? (res?.message || 'Modèles indisponibles : saisissez l\'identifiant ci-dessous.')
          : '';
        this.llmModelsLoading = false;
        // Ne présélectionne rien : on ne devine pas le modèle « principal ».
        this.cd.markForCheck();
      },
      error: () => {
        if (this.llmSelectedProvider !== key) return;
        this.llmModels        = [];
        this.llmModelsSource  = 'none';
        this.llmModelsMessage = 'Catalogue indisponible : saisissez l\'identifiant du modèle.';
        this.llmModelsLoading = false;
        this.cd.markForCheck();
      }
    });
  }

  selectLlmModel(m: { id: string }): void {
    this.llmForm.modelId = m.id;
    this.cd.markForCheck();
  }

  get llmFilteredAgents(): any[] {
    if (!this.llmFilterTeam) return this.agents;
    return this.agents.filter(a => a.teamId === this.llmFilterTeam || a.defaultSystem);
  }

  get llmDisplayedProviders(): any[] {
    if (this.llmFilter === 'active')   return this.llmProviders.filter(p => !p.deleted);
    if (this.llmFilter === 'deleted')  return this.llmProviders.filter(p => p.deleted);
    return this.llmProviders;
  }

  onLlmTeamFilterChange(): void {
    this.llmAgentId = '';
    this.llmProviders = [];
    this.llmSelectedProvider = '';
    this.cd.markForCheck();
  }

  setLlmFilter(f: 'active' | 'deleted' | 'all'): void {
    this.llmFilter = f;
    // Recharge selon le mode affiché. Sans ce aiguillage, changer de filtre en
    // mode équipe ou compte laissait la liste précédente : le filtre changeait
    // l'affichage, pas les données.
    this.reloadCurrentLlmProviders();
  }

  loadLlmProviders(agentId: string): void {
    if (!agentId) { this.llmProviders = []; return; }
    this.loadingLlm = true;
    const includeDeleted = this.llmFilter === 'deleted' || this.llmFilter === 'all';
    const url = `${API}/api/agents/${agentId}/llm-providers${includeDeleted ? '?includeDeleted=true' : ''}`;
    this.http.get<any[]>(url).subscribe({
      next: (res) => { this.llmProviders = Array.isArray(res) ? res : []; this.loadingLlm = false; this.cd.markForCheck(); },
      error: () => { this.llmProviders = []; this.loadingLlm = false; this.cd.markForCheck(); }
    });
  }

  loadTeamLlmProviders(teamId: string): void {
    if (!teamId) { this.llmProviders = []; return; }
    this.loadingLlm = true;
    const includeDeleted = this.llmFilter === 'deleted' || this.llmFilter === 'all';
    const url = `${API}/api/teams/${teamId}/llm-providers${includeDeleted ? '?includeDeleted=true' : ''}`;
    this.http.get<any[]>(url).subscribe({
      next: (res) => { this.llmProviders = Array.isArray(res) ? res : []; this.loadingLlm = false; this.cd.markForCheck(); },
      error: (e) => {
        this.llmProviders = [];
        this.loadingLlm = false;
        this.dialog.alert(`Impossible de charger les providers de l'équipe : ${e?.error?.message || ''}`, 'Erreur', 'error');
        this.cd.markForCheck();
      }
    });
  }

  private currentLlmProviderUrl(): string {
    if (this.llmMode === 'team')    return `${API}/api/teams/${this.llmTeamId}/llm-providers`;
    if (this.llmMode === 'account') return `${API}/api/users/me/llm-providers`;
    return `${API}/api/agents/${this.llmAgentId}/llm-providers`;
  }

  private reloadCurrentLlmProviders(): void {
    if (this.llmMode === 'team') this.loadTeamLlmProviders(this.llmTeamId);
    else if (this.llmMode === 'account') this.loadAccountLlmProviders();
    else this.loadLlmProviders(this.llmAgentId);
  }

  /**
   * Providers du scope compte. Ils s'appliquent à tous les agents de
   * l'utilisateur, agents d'équipe compris : c'est le niveau qui correspond au
   * « mon compte » de l'interface.
   */
  loadAccountLlmProviders(): void {
    this.loadingLlm = true;
    this.cd.markForCheck();
    const includeDeleted = this.llmFilter === 'deleted' || this.llmFilter === 'all';
    this.http.get<any[]>(`${API}/api/users/me/llm-providers?includeDeleted=${includeDeleted}`)
      .subscribe({
        next: (res) => {
          this.llmProviders = Array.isArray(res) ? res : [];
          this.loadingLlm = false;
          this.cd.markForCheck();
          // Un compte sans provider n'a rien à afficher : sans cet appel, la copie
          // du défaut plateforme n'est jamais demandée et l'espace paraît vide.
          if (this.llmProviders.length === 0 && !includeDeleted) {
            this.provisionAccountDefaultProvider();
          }
        },
        error: (e) => {
          this.llmProviders = [];
          this.loadingLlm = false;
          this.dialog.alert(`Impossible de charger les providers du compte : ${e?.error?.message || ''}`, 'Erreur', 'error');
          this.cd.markForCheck();
        }
      });
  }

  /**
   * Demande le provider résolu du compte, ce qui déclenche côté serveur la copie
   * du provider par défaut de la plateforme lorsqu'il n'existe encore aucun
   * provider pour cet utilisateur.
   *
   * <p>La liste seule ne suffit pas : le provisionnement vit dans
   * {@code /resolved}. Sans cet appel, l'espace de travail d'un compte créé
   * depuis peu resterait vide même quand un défaut de plateforme est défini, et
   * le mécanisme donnerait l'impression d'être cassé.
   *
   * <p>Une seule tentative par passage dans l'onglet : le drapeau évite que le
   * retour de {@code /resolved} puis le rechargement de la liste — qui reste vide
   * si aucun défaut n'est défini — ne redéclenche l'appel indéfiniment.
   * Un 404 n'est pas une erreur : il signifie simplement qu'aucun défaut n'est
   * marqué, et l'utilisateur voit alors l'état vide, ce qui est le comportement
   * attendu.
   */
  private provisionAccountDefaultProvider(): void {
    if (this.accountProvisioningChecked) return;
    this.accountProvisioningChecked = true;
    this.http.get<any>(`${API}/api/users/me/llm-providers/resolved`).subscribe({
      next: () => this.loadAccountLlmProviders(),
      error: () => { /* aucun défaut de plateforme : l'espace reste vide, c'est normal */ }
    });
  }

  /** Provider par défaut de la plateforme, lu à part : il est partagé. */
  loadPlatformDefault(): void {
    this.llmPlatformDefaultLoading = true;
    this.cd.markForCheck();
    this.http.get<any>(`${API}/api/admin/llm-providers/platform-default`).subscribe({
      next: (res) => { this.llmPlatformDefault = res; this.llmPlatformDefaultLoading = false; this.cd.markForCheck(); },
      error: () => {
        // 404 = aucun provider marqué : ce n'est pas une panne, c'est l'état initial.
        this.llmPlatformDefault = null;
        this.llmPlatformDefaultLoading = false;
        this.cd.markForCheck();
      }
    });
  }

  markPlatformDefault(p: any): void {
    this.http.put<any>(`${API}/api/admin/llm-providers/platform-default/${p.id}`, {}).subscribe({
      next: () => {
        this.loadPlatformDefault();
        this.loadAccountLlmProviders();
        this.dialog.alert(
          `${p.type} · ${p.modelId} est désormais le provider par défaut de la plateforme.\n\n`
          + 'Son modèle et sa clé sont recopiés dans chaque compte qui n\'a pas encore de provider.',
          'Provider par défaut défini', 'success');
      },
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.detail || e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  clearPlatformDefault(): void {
    this.http.delete(`${API}/api/admin/llm-providers/platform-default`).subscribe({
      next: () => {
        this.loadPlatformDefault();
        this.loadAccountLlmProviders();
        this.dialog.alert('Aucun provider n\'est désormais le défaut de la plateforme.', 'Défaut retiré', 'success');
      },
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.detail || e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  llmSetPrimary(p: any): void {
    this.http.patch<any>(`${this.currentLlmProviderUrl()}/${p.id}/primary`, {}).subscribe({
      next: () => this.reloadCurrentLlmProviders(),
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  llmRestore(p: any): void {
    this.http.post<any>(`${this.currentLlmProviderUrl()}/${p.id}/restore`, {}).subscribe({
      next: () => this.reloadCurrentLlmProviders(),
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  llmAskDelete(p: any): void {
    this.llmConfirmProvider = p;
    this.llmConfirmOpen = true;
  }

  revealAndCopyKey(p: any): void {
    if (this.revealedKeys[p.id]) {
      navigator.clipboard.writeText(this.revealedKeys[p.id]).then(() => {
        this.copiedKeyId = p.id;
        this.cd.markForCheck();
        setTimeout(() => { this.copiedKeyId = null; this.cd.markForCheck(); }, 2000);
      });
      return;
    }
    this.http.get<{ apiKey: string }>(`${this.currentLlmProviderUrl()}/${p.id}/reveal`).subscribe({
      next: (res) => {
        this.revealedKeys[p.id] = res.apiKey;
        navigator.clipboard.writeText(res.apiKey).then(() => {
          this.copiedKeyId = p.id;
          this.cd.markForCheck();
          setTimeout(() => { this.copiedKeyId = null; this.cd.markForCheck(); }, 2000);
        });
        this.cd.markForCheck();
      },
      error: (e) => this.dialog.alert(`Impossible de récupérer la clé : ${e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  maskDisplay(key: string): string {
    if (!key || key.length < 8) return '••••••••';
    return key.slice(0, 6) + '••••' + key.slice(-4);
  }

  llmDoDelete(): void {
    const p = this.llmConfirmProvider;
    this.llmConfirmOpen = false;
    this.llmConfirmProvider = null;
    if (!p) return;
    this.http.delete(`${this.currentLlmProviderUrl()}/${p.id}`).subscribe({
      next: () => this.reloadCurrentLlmProviders(),
      error: (e) => this.dialog.alert(`Erreur : ${e?.error?.message || ''}`, 'Erreur', 'error')
    });
  }

  addLlmProvider(): void {
    if (!this.llmForm.apiKey.trim() && this.llmForm.type !== 'OLLAMA') {
      this.formError = 'La clé API est obligatoire pour ce provider.';
      return;
    }
    if (!this.llmForm.modelId.trim()) { this.formError = 'L\'identifiant de modèle est obligatoire.'; return; }
    this.saving = true; this.formError = '';
    const body: any = {
      type:                 this.llmForm.type,
      modelId:              this.llmForm.modelId.trim(),
      maxTokens:            this.llmForm.maxTokens,
      primary:              this.llmForm.primary,
      streamingEnabled:     true,
      requestTimeoutSeconds: 60,
    };
    if (this.llmForm.apiKey.trim()) body.apiKey = this.llmForm.apiKey.trim();
    if (this.llmForm.baseUrl.trim()) body.baseUrl = this.llmForm.baseUrl.trim();

    this.http.post<any>(this.currentLlmProviderUrl(), body).subscribe({
      next: (p) => {
        this.llmProviders = [p, ...this.llmProviders];
        this.llmForm    = { type:'GEMINI', modelId:'gemini-2.0-flash', apiKey:'', baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai', maxTokens:1024, primary:true };
        this.llmPreset  = '';
        this.llmHint    = '';
        this.llmSelectedProvider = '';
        this.saving = false; this.quickAdd = '';
        this.reloadCurrentLlmProviders();
        this.cd.markForCheck();
      },
      error: (e) => { this.formError = `Erreur : ${e?.error?.message || e?.message || ''}`; this.saving = false; this.cd.markForCheck(); }
    });
  }


  applyToTeam(): void {
    this.addLlmProvider();
  }

  // ── CANAUX ────────────────────────────────────────────────────────────────
  onChannelTypeChange(): void {
    const preset = this.CHANNEL_HINTS[this.channelForm.type];
    if (preset) {
      this.channelCredHint        = preset.hint;
      this.channelCredPlaceholder = preset.placeholder;
    }
    if (this.channelForm.type !== 'SOCIAL_MEDIA') this.channelForm.platformType = '';
    else if (!this.channelForm.platformType)       this.channelForm.platformType = 'INSTAGRAM';
    this.channelForm.credentials = '';
  }

  loadChannels(agentId: string): void {
    if (!agentId) { this.channels = []; return; }
    this.loadingChannels = true;
    this.http.get<any[]>(`${API}/api/agents/${agentId}/channels`, { headers: this.authHeaders() }).subscribe({
      next:  (res) => { this.channels = Array.isArray(res) ? res : []; this.loadingChannels = false; this.cd.markForCheck(); },
      error: ()    => { this.channels = []; this.loadingChannels = false; this.cd.markForCheck(); }
    });
  }

  editChannel(ch: any): void {
    this.editingChannelId = ch.id;
    this.quickAdd = '';
    this.formError = '';
    let pollIntervalMs = 300000;
    if (ch.config) {
      try { pollIntervalMs = JSON.parse(ch.config)?.pollIntervalMs ?? 300000; } catch {}
    }
    this.channelForm = {
      type:           ch.type,
      platformType:   ch.platformType || 'INSTAGRAM',
      displayName:    ch.displayName  || '',
      credentials:    '',
      accountId:      ch.accountId    || '',
      accountName:    ch.accountName  || '',
      pollIntervalMs,
      fbAccessToken:  '',
      fbPageId:       ch.type === 'SOCIAL_MEDIA' && ch.platformType === 'FACEBOOK' ? (ch.accountId || '') : '',
      igAccessToken:  '',
      igUserId:       ch.type === 'SOCIAL_MEDIA' && ch.platformType === 'INSTAGRAM' ? (ch.accountId || '') : '',
    };
    this.igFetchIgIdError = '';
    const preset = this.CHANNEL_HINTS[ch.type];
    if (preset) { this.channelCredHint = preset.hint; this.channelCredPlaceholder = preset.placeholder; }
    this.cd.markForCheck();
  }

  cancelChannelForm(): void {
    this.editingChannelId = '';
    this.quickAdd = '';
    this.formError = '';
    this.channelForm = { type: 'SOCIAL_MEDIA', platformType: 'INSTAGRAM', displayName: '', credentials: '', accountId: '', accountName: '', pollIntervalMs: 300000, fbAccessToken: '', fbPageId: '', igAccessToken: '', igUserId: '' };
    this.channelCredHint = ''; this.channelCredPlaceholder = '{"accessToken":"...","pageId":"..."}';
    this.igFetchIgIdError = '';
  }

  private buildFbCredentials(): string | undefined {
    const token = this.channelForm.fbAccessToken.trim();
    const pageId = this.channelForm.fbPageId.trim();
    if (!token && !pageId) return undefined;
    return JSON.stringify({ accessToken: token, pageId });
  }

  addChannel(): void {
    if (!this.channelForm.displayName.trim()) { this.formError = 'Le nom affiché est obligatoire.'; return; }
    const isFacebook  = this.channelForm.type === 'SOCIAL_MEDIA' && this.channelForm.platformType === 'FACEBOOK';
    const isInstagram = this.channelForm.type === 'SOCIAL_MEDIA' && this.channelForm.platformType === 'INSTAGRAM';
    if (isFacebook  && !this.channelForm.fbAccessToken.trim()) { this.formError = 'Le Page Access Token est obligatoire.'; return; }
    if (isFacebook  && !this.channelForm.fbPageId.trim())     { this.formError = 'Le Page ID est obligatoire.'; return; }
    if (isInstagram && !this.channelForm.igAccessToken.trim()) { this.formError = 'Le Page Access Token est obligatoire.'; return; }
    if (isInstagram && !this.channelForm.igUserId.trim())     { this.formError = "L'Instagram Business Account ID (igUserId) est obligatoire."; return; }
    this.saving = true; this.formError = '';
    const body: any = {
      type:        this.channelForm.type,
      displayName: this.channelForm.displayName.trim(),
      accountId:   isFacebook ? this.channelForm.fbPageId.trim()
                 : isInstagram ? this.channelForm.igUserId.trim()
                 : (this.channelForm.accountId.trim() || undefined),
      accountName: this.channelForm.accountName.trim() || undefined,
      credentials: isFacebook  ? this.buildFbCredentials()
                 : isInstagram ? JSON.stringify({ accessToken: this.channelForm.igAccessToken.trim(), igUserId: this.channelForm.igUserId.trim() })
                 : (this.channelForm.credentials.trim() || undefined),
    };
    if (this.channelForm.type === 'SOCIAL_MEDIA' && this.channelForm.platformType) {
      body.platformType = this.channelForm.platformType;
      if (isFacebook || isInstagram)
        body.config = JSON.stringify({ pollIntervalMs: this.channelForm.pollIntervalMs });
    }
    this.http.post<any>(`${API}/api/agents/${this.channelAgentId}/channels`, body, { headers: this.authHeaders() }).subscribe({
      next: (ch) => {
        this.channels = [ch, ...this.channels];
        this.cancelChannelForm();
        this.saving = false; this.cd.markForCheck();
      },
      error: (e) => { this.formError = `Erreur : ${e?.error?.message || e?.message || ''}`; this.saving = false; this.cd.markForCheck(); }
    });
  }

  updateChannel(): void {
    if (!this.channelForm.displayName.trim()) { this.formError = 'Le nom affiché est obligatoire.'; return; }
    const isFacebook  = this.channelForm.type === 'SOCIAL_MEDIA' && this.channelForm.platformType === 'FACEBOOK';
    const isInstagram = this.channelForm.type === 'SOCIAL_MEDIA' && this.channelForm.platformType === 'INSTAGRAM';
    this.saving = true; this.formError = '';
    const body: any = {
      displayName: this.channelForm.displayName.trim(),
      accountId:   isFacebook  ? (this.channelForm.fbPageId.trim() || undefined)
                 : isInstagram ? (this.channelForm.igUserId.trim() || undefined)
                 : (this.channelForm.accountId.trim() || undefined),
      accountName: this.channelForm.accountName.trim() || undefined,
    };
    if (isFacebook) {
      const fbCreds = this.buildFbCredentials();
      if (fbCreds) body.credentials = fbCreds;
    } else if (isInstagram) {
      const t = this.channelForm.igAccessToken.trim();
      const u = this.channelForm.igUserId.trim();
      if (t || u) body.credentials = JSON.stringify({ accessToken: t || undefined, igUserId: u || undefined });
    } else if (this.channelForm.credentials.trim()) {
      body.credentials = this.channelForm.credentials.trim();
    }
    if (this.channelForm.type === 'SOCIAL_MEDIA' && this.channelForm.platformType) {
      body.platformType = this.channelForm.platformType;
      if (isFacebook || isInstagram)
        body.config = JSON.stringify({ pollIntervalMs: this.channelForm.pollIntervalMs });
    }
    this.http.put<any>(`${API}/api/agents/${this.channelAgentId}/channels/${this.editingChannelId}`, body, { headers: this.authHeaders() }).subscribe({
      next: (updated) => {
        const idx = this.channels.findIndex(c => c.id === this.editingChannelId);
        if (idx !== -1) this.channels[idx] = updated;
        this.cancelChannelForm();
        this.saving = false; this.cd.markForCheck();
      },
      error: (e) => { this.formError = `Erreur : ${e?.error?.message || e?.message || ''}`; this.saving = false; this.cd.markForCheck(); }
    });
  }

  connectChannel(ch: any): void {
    this.http.post<any>(`${API}/api/agents/${this.channelAgentId}/channels/${ch.id}/connect`, {}, { headers: this.authHeaders() }).subscribe({
      next: (updated) => { Object.assign(ch, updated); this.cd.markForCheck(); },
      error: () => {}
    });
  }

  disconnectChannel(ch: any): void {
    this.http.post<any>(`${API}/api/agents/${this.channelAgentId}/channels/${ch.id}/disconnect`, {}, { headers: this.authHeaders() }).subscribe({
      next: (updated) => { Object.assign(ch, updated); this.cd.markForCheck(); },
      error: () => {}
    });
  }

  deleteChannel(ch: any): void {
    if (!confirm(`Supprimer le canal "${ch.displayName}" ?`)) return;
    this.http.delete(`${API}/api/agents/${this.channelAgentId}/channels/${ch.id}`, { headers: this.authHeaders() }).subscribe({
      next: () => { this.channels = this.channels.filter(c => c.id !== ch.id); this.cd.markForCheck(); },
      error: () => {}
    });
  }

  // ── CHAT ──────────────────────────────────────────────────────────────────
  onChatAgentChange(agentId: string): void {
    // Sauvegarder la conversation en cours avant de changer d'agent
    if (this.chatAgentId && this.chatMessages.length > 0) this.saveChatHistory(this.chatAgentId);
    this.chatProviders = [];
    this.chatQuota     = null;
    if (!agentId) { this.chatMessages = []; this.refreshSavedConversations(); return; }
    // Charger l'historique de l'agent sélectionné
    this.chatMessages = this.loadChatHistory(agentId);
    this.refreshSavedConversations();
    this.http.get<any[]>(`${API}/api/agents/${agentId}/llm-providers`).subscribe({
      next: (res) => { this.chatProviders = Array.isArray(res) ? res : []; this.cd.markForCheck(); },
      error: () => {}
    });
    this.http.get<any>(`${API}/api/agents/${agentId}/quota`).subscribe({
      next: (q) => { this.chatQuota = q; this.cd.markForCheck(); },
      error: () => {}
    });
  }

  loadConversation(agentId: string): void {
    if (this.chatAgentId && this.chatMessages.length > 0) this.saveChatHistory(this.chatAgentId);
    this.chatAgentId  = agentId;
    this.chatMessages = this.loadChatHistory(agentId);
    this.onChatAgentChange(agentId);
  }

  clearChatHistory(): void {
    if (this.chatAgentId) this.deleteChatHistory(this.chatAgentId);
    this.chatMessages = [];
    this.refreshSavedConversations();
    this.cd.markForCheck();
  }

  clearConversation(agentId: string): void {
    this.deleteChatHistory(agentId);
    if (agentId === this.chatAgentId) this.chatMessages = [];
    this.refreshSavedConversations();
    this.cd.markForCheck();
  }

  private saveChatHistory(agentId: string): void {
    try {
      const key  = `creativeai_chat_${this.getUserId()}_${agentId}`;
      const data = this.chatMessages.map(m => ({ ...m, timestamp: m.timestamp.toISOString() }));
      localStorage.setItem(key, JSON.stringify(data.slice(-100)));
      this.refreshSavedConversations();
    } catch {}
  }

  private loadChatHistory(agentId: string): { role: string; content: string; timestamp: Date }[] {
    try {
      const raw = localStorage.getItem(`creativeai_chat_${this.getUserId()}_${agentId}`);
      if (!raw) return [];
      return (JSON.parse(raw) as any[]).map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
    } catch { return []; }
  }

  private deleteChatHistory(agentId: string): void {
    try { localStorage.removeItem(`creativeai_chat_${this.getUserId()}_${agentId}`); } catch {}
  }

  private getUserId(): string {
    try {
      const u = localStorage.getItem('ms_auth');
      const p = u ? JSON.parse(u) : null;
      return p?.id || p?.email || 'default';
    } catch { return 'default'; }
  }

  refreshSavedConversations(): void {
    const uid = this.getUserId();
    const prefix = `creativeai_chat_${uid}_`;
    const result: { agentId: string; agentName: string; msgCount: number; lastMsg: Date }[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith(prefix)) continue;
        const agentId = k.slice(prefix.length);
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const msgs = JSON.parse(raw) as any[];
        if (!msgs.length) continue;
        const agent = this.agents.find(a => a.id === agentId);
        result.push({
          agentId,
          agentName: agent?.name ?? agentId.slice(0, 8) + '…',
          msgCount:  msgs.length,
          lastMsg:   new Date(msgs[msgs.length - 1].timestamp ?? Date.now()),
        });
      }
    } catch {}
    this.savedConversations = result.sort((a, b) => b.lastMsg.getTime() - a.lastMsg.getTime());
    this.cd.markForCheck();
  }

  private isTaskRequest(msg: string): boolean {
    const t = msg.toLowerCase();
    return [
      /cr[ée]{1,2}r?\s+une?\s+t[âa]che/,
      /nouvelle?\s+t[âa]che/,
      /ajouter?\s+une?\s+t[âa]che/,
      /cr[ée]{1,2}r?\s+un?\s+ticket/,
      /planifier?\s+une?\s+t[âa]che/,
      /assigner?\s+une?\s+t[âa]che/,
      /cr[ée]{1,2}r?\s+un?\s+sprint/,
      /cr[ée]{1,2}r?\s+un?\s+workflow/,
      /organiser?\s+les?\s+t[âa]ches/,
    ].some(p => p.test(t));
  }

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];

  toggleVoice(): void {
    if (this.isListening) {
      this.mediaRecorder?.stop();
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.audioChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')            ? 'audio/webm'
        : 'audio/ogg';
      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstart = () => {
        this.isListening = true;
        this.chatInput = '🎙️ Enregistrement…';
        this.cd.markForCheck();
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        this.isListening = false;
        this.chatInput = '⏳ Transcription…';
        this.cd.markForCheck();

        const blob = new Blob(this.audioChunks, { type: mimeType });
        const ext  = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const form = new FormData();
        form.append('file', blob, `audio.${ext}`);

        const token = JSON.parse(localStorage.getItem('ms_auth') || '{}')?.token ?? '';
        this.http.post<{ text: string }>(`${API}/api/speech/transcribe`, form, {
          headers: { Authorization: `Bearer ${token}` }
        }).subscribe({
          next: res => {
            this.chatInput = res.text?.trim() ?? '';
            this.cd.markForCheck();
          },
          error: err => {
            const msg = err.error?.error ?? 'Erreur transcription';
            this.chatInput = '';
            this.dialog.alert(msg, 'Reconnaissance vocale', 'error');
            this.cd.markForCheck();
          }
        });
      };

      this.mediaRecorder.start();
    }).catch(() => {
      this.dialog.alert('Impossible d\'accéder au microphone. Vérifiez les permissions.', 'Microphone', 'warning');
    });
  }

  toggleTts(): void {
    this.ttsEnabled = !this.ttsEnabled;
    if (!this.ttsEnabled) { window.speechSynthesis?.cancel(); }
    else { this.pickBestVoice(); }
    this.cd.markForCheck();
  }

  private pickBestVoice(): void {
    const load = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      // Priorité : voix Google ou Microsoft FR (beaucoup plus naturelles)
      const preferred = [
        voices.find(v => v.lang === 'fr-FR' && v.name.includes('Google')),
        voices.find(v => v.lang === 'fr-FR' && v.name.toLowerCase().includes('microsoft')),
        voices.find(v => v.lang === 'fr-FR' && !v.localService),
        voices.find(v => v.lang === 'fr-FR'),
        voices.find(v => v.lang.startsWith('fr')),
        voices[0],
      ];
      this.ttsVoice = preferred.find(Boolean) ?? null;
    };
    const voices = window.speechSynthesis?.getVoices() || [];
    if (voices.length) { load(); }
    else { window.speechSynthesis.onvoiceschanged = () => { load(); window.speechSynthesis.onvoiceschanged = null; }; }
  }

  replayLastTts(): void {
    const last = [...this.chatMessages].reverse().find(m => m.role === 'assistant');
    if (last) this.speakText(last.content);
  }

  stopSpeaking(): void {
    window.speechSynthesis?.cancel();
    this.isSpeaking = false;
    this.cd.markForCheck();
  }

  speakText(text: string): void {
    if (!window.speechSynthesis) return;
    if (!this.ttsVoice) this.pickBestVoice();
    const clean = this.stripEmojis(text)
      .replace(/#{1,6}\s*/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[-|>]+/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang  = 'fr-FR';
    utt.rate  = 0.95;
    utt.pitch = 1.05;
    utt.volume = 1;
    if (this.ttsVoice) utt.voice = this.ttsVoice;
    utt.onstart = () => { this.isSpeaking = true;  this.cd.markForCheck(); };
    utt.onend   = () => { this.isSpeaking = false; this.cd.markForCheck(); };
    utt.onerror = () => { this.isSpeaking = false; this.cd.markForCheck(); };
    // Chrome bug workaround
    const resumeTimer = setInterval(() => { if (window.speechSynthesis.paused) window.speechSynthesis.resume(); }, 5000);
    utt.onend = () => { clearInterval(resumeTimer); this.isSpeaking = false; this.cd.markForCheck(); };
    window.speechSynthesis.speak(utt);
  }

  async checkQuotaThenSend(): Promise<void> {
    const msg = this.chatInput.trim();
    if (!msg || !this.chatAgentId) return;
    // Détection d'intention de création de tâche → rediriger vers l'UI
    if (this.isTaskRequest(msg)) {
      this.taskRedirect.show = true;
      this.cd.markForCheck();
      return;
    }
    try {
      const quota = await this.http.get<any>(`${API}/api/agents/${this.chatAgentId}/quota`).toPromise();
      if (quota?.hasData && quota.dailyRemaining !== null) {
        // Estimation : contexte complet + message + overhead système (~500 tokens) + réponse attendue
        const contextChars  = this.chatMessages.reduce((s, m) => s + m.content.length, 0);
        const inputTokens   = Math.ceil((contextChars + msg.length) / 4) + 500;
        const outputTokens  = quota.maxTokens ?? 2048;
        const needed        = inputTokens + outputTokens;
        if (needed > quota.dailyRemaining) {
          this.quotaWarning = { show: true, needed, remaining: quota.dailyRemaining, provider: quota.provider, model: quota.model };
          this.cd.markForCheck();
          return;
        }
      }
    } catch { /* non bloquant */ }
    this.sendChatMessage();
  }

  onChatEnter(e: Event): void {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) { e.preventDefault(); this.checkQuotaThenSend(); }
  }

  autoResizeChat(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  copyMsg(content: string, idx: number): void {
    navigator.clipboard.writeText(content).then(() => {
      this.copiedMsgIdx = idx;
      this.cd.markForCheck();
      setTimeout(() => { this.copiedMsgIdx = null; this.cd.markForCheck(); }, 1800);
    });
  }

  /**
   * Affiche / masque le bloc « webhook » d'un canal.
   * Un seul bloc ouvert à la fois : les URL sont longues et la table est déjà dense.
   */
  toggleWebhook(ch: any): void {
    this.openWebhookId = this.openWebhookId === ch.id ? null : ch.id;
    this.cd.markForCheck();
  }

  /** Copie l'URL de callback ou le verify token affiché pour un canal Meta. */
  copyWebhook(value: string, key: string): void {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      this.copiedWebhookKey = key;
      this.cd.markForCheck();
      setTimeout(() => { this.copiedWebhookKey = null; this.cd.markForCheck(); }, 1800);
    });
  }

  /**
   * URL « applicative » du webhook Meta : celle qu'on ne déclare qu'une fois dans
   * le dashboard, et qui route automatiquement l'événement vers le bon canal.
   * L'API renvoie l'URL par canal (…/webhook/{channelId}), on retire le dernier segment.
   */
  globalWebhookUrl(ch: any): string {
    return (ch?.webhookUrl || '').replace(/\/[^/]+\/?$/, '');
  }

  /** Append text character-by-character for a typing effect. Short chunks (≤3 chars) are appended instantly. */
  private typewriterAppend(text: string): Promise<void> {
    return new Promise(resolve => {
      if (text.length <= 3) {
        this.chatBuffer += text;
        this.cd.markForCheck();
        resolve();
        return;
      }
      let i = 0;
      const interval = setInterval(() => {
        this.chatBuffer += text[i];
        this.cd.markForCheck();
        i++;
        if (i >= text.length) {
          clearInterval(interval);
          resolve();
        }
      }, 18);
    });
  }

  async sendChatMessage(): Promise<void> {
    const msg = this.chatInput.trim();
    if (!msg || !this.chatAgentId || this.chatStreaming) return;
    this.chatMessages.push({ role: 'user', content: msg, timestamp: new Date() });
    this.chatInput      = '';
    // Reset textarea height after clearing
    const ta = document.querySelector('.ws-dv-input') as HTMLTextAreaElement;
    if (ta) { ta.style.height = 'auto'; }
    this.chatStreaming  = true;
    this.chatBuffer    = '';
    this.chatStreamStart = new Date();
    this.cd.markForCheck();

    const token = this.getToken();
    this.chatAbort = new AbortController();
    const timeout = setTimeout(() => this.chatAbort?.abort(), 300_000);

    try {
      const res = await fetch(`${API}/api/agents/${this.chatAgentId}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: msg }),
        signal: this.chatAbort.signal,
      });
      if (!res.body) throw new Error('no body');
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const t = line.replace(/\r$/, '');  // strip \r only — trimEnd() would eat meaningful trailing spaces
          if (!t || !t.startsWith('data:')) continue;
          const data = t.startsWith('data: ') ? t.slice(6) : t.slice(5);
          if (data === '[DONE]' || data.startsWith('[SESSION:') || data === '[PING]') continue;
          if (!data) continue;
          try {
            const o = JSON.parse(data);
            const chunk = o.content || o?.choices?.[0]?.delta?.content || '';
            if (chunk) await this.typewriterAppend(chunk);
          } catch {
            if (data) await this.typewriterAppend(data);
          }
        }
      }
    } catch (e: any) {
      // Ne montrer l'erreur que si aucun contenu n'est arrivé (broken pipe en fin de stream = normal)
      if (e?.name !== 'AbortError' && !this.chatBuffer.trim()) this.chatBuffer = '[Erreur de connexion]';
    } finally {
      clearTimeout(timeout);
    }
    if (this.chatBuffer) {
      const finalMsg = this.chatBuffer;
      this.chatMessages.push({ role: 'assistant', content: finalMsg, timestamp: new Date() });
      this.speakText(finalMsg);
    }
    this.chatStreaming = false; this.chatBuffer = '';
    this._typewriterResolve = null;
    // Persist conversation
    if (this.chatAgentId && this.chatMessages.length > 0) this.saveChatHistory(this.chatAgentId);
    // Refresh quota after each exchange (may have updated after a 429)
    if (this.chatAgentId) {
      this.http.get<any>(`${API}/api/agents/${this.chatAgentId}/quota`).subscribe({
        next: (q) => { this.chatQuota = q; this.cd.markForCheck(); }, error: () => {}
      });
    }
    this.cd.markForCheck();
  }
}
