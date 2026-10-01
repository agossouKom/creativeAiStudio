import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, interval, switchMap } from 'rxjs';

export interface SocialPlatformStatus {
  platform: string;
  connected: boolean;
  channelId: string;
  accountName: string;
  configured: boolean;
  lastSync: string;
  /** Le canal a été connecté avec plusieurs Pages : l'utilisateur doit choisir. */
  pageSelectionPending?: boolean;
  availablePageCount?: number;
}

/** Pageiexposée par l'API. Volontairement sans `accessToken` : le backend ne
 *  renvoie jamais de secret dans une réponse. */
export interface SocialPage {
  id: string;
  name: string;
}

interface PlatformMeta {
  key: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  setupSteps: string[];
  docsUrl: string;
  docsSummary: string;
  /**
   * Plateformes à connecter AVANT celle-ci. Instagram emprunte son jeton au
   * canal Facebook du même agent : sans Page Meta il n'a rien à quoi se
   * raccrocher, et l'échec n'apparaît qu'au moment de publier.
   */
  requires?: string[];
  /**
   * L'agent peut-il RÉELLEMENT publier sur cette plateforme ?
   *
   * L'OAuth est implémenté pour les 5 plateformes, mais la publication n'existe
   * que pour Facebook et Instagram : `ChannelSenderService.PUBLISHABLE_PLATFORMS`
   * refuse les autres en 409 PLATFORM_NOT_AVAILABLE. Sans ce drapeau, l'écran
   * annonçait « votre agent peut maintenant publier sur LinkedIn » pour une
   * connexion qui, elle, aboutirait.
   */
  publishable?: boolean;
}

const PLATFORMS: PlatformMeta[] = [
  {
    key: 'FACEBOOK',
    label: 'Facebook',
    icon: 'fab fa-facebook-f',
    color: '#1877F2',
    description: 'Publier sur votre Page Facebook, répondre aux commentaires automatiquement.',
    setupSteps: [
      'Vous avez besoin d\'une Page Facebook (pas un profil personnel)',
      'Cliquez "Connecter Facebook" — une fenêtre s\'ouvre',
      'Connectez-vous à Facebook puis autorisez l\'accès',
      'Sélectionnez votre Page dans la liste',
      'C\'est tout ! Votre agent peut maintenant publier.'
    ],
    docsUrl: 'https://developers.facebook.com/apps',
    docsSummary: 'Si vous êtes développeur : créez une Meta App → Produits → Facebook Login.'
  },
  {
    key: 'INSTAGRAM',
    label: 'Instagram',
    icon: 'fab fa-instagram',
    color: '#E1306C',
    description: 'Publier des photos et vidéos sur votre compte Instagram Business.',
    requires: ['FACEBOOK'],
    setupSteps: [
      'Votre compte Instagram doit être un compte Professionnel/Business',
      'Liez-le à une Page Facebook (obligatoire par Meta)',
      'Connectez d\'abord Facebook ci-contre — Instagram utilise sa Page',
      'Cliquez "Connecter Instagram" — une fenêtre s\'ouvre',
      'Autorisez l\'accès à votre Page et à Instagram',
      'Votre agent peut maintenant publier sur Instagram.'
    ],
    docsUrl: 'https://developers.facebook.com/docs/instagram-api',
    docsSummary: 'Compte Instagram Business requis + Page Facebook liée.'
  },
  {
    key: 'YOUTUBE',
    label: 'YouTube',
    icon: 'fab fa-youtube',
    color: '#FF0000',
    description: 'Uploader des vidéos et gérer votre chaîne YouTube.',
    setupSteps: [
      'Vous avez besoin d\'une chaîne YouTube',
      'Cliquez "Connecter YouTube" — une fenêtre Google s\'ouvre',
      'Connectez-vous avec le compte Google de votre chaîne',
      'Autorisez l\'accès à YouTube',
      'Votre compte est connecté. La publication automatique n\'est pas encore activée sur cette plateforme.'
    ],
    docsUrl: 'https://console.cloud.google.com/',
    docsSummary: 'Si vous êtes développeur : Google Cloud Console → YouTube Data API v3 → OAuth 2.0.',
    publishable: false,
  },
  {
    key: 'LINKEDIN',
    label: 'LinkedIn',
    icon: 'fab fa-linkedin-in',
    color: '#0A66C2',
    description: 'Publier des articles et posts sur votre profil ou Page LinkedIn.',
    setupSteps: [
      'Vous avez besoin d\'un compte LinkedIn (profil personnel ou Page)',
      'Cliquez "Connecter LinkedIn" — une fenêtre LinkedIn s\'ouvre',
      'Autorisez l\'accès à votre profil',
      'Votre compte est connecté. La publication automatique n\'est pas encore activée sur cette plateforme.'
    ],
    docsUrl: 'https://www.linkedin.com/developers/apps',
    docsSummary: 'Si vous êtes développeur : LinkedIn Developers → Créer une app → Products → Share on LinkedIn.',
    publishable: false,
  },
  {
    key: 'TWITTER_X',
    label: 'X (Twitter)',
    icon: 'fab fa-x-twitter',
    color: '#000000',
    description: 'Tweeter, répondre et gérer votre compte X (anciennement Twitter).',
    setupSteps: [
      'Vous avez besoin d\'un compte X',
      'Cliquez "Connecter X" — une fenêtre X s\'ouvre',
      'Autorisez l\'accès à votre compte',
      'Votre compte est connecté. La publication automatique n\'est pas encore activée sur cette plateforme.'
    ],
    docsUrl: 'https://developer.twitter.com/en/portal/dashboard',
    docsSummary: 'Si vous êtes développeur : X Developer Portal → Project → App → OAuth 2.0 PKCE.',
    publishable: false,
  },
  {
    key: 'TIKTOK',
    label: 'TikTok',
    icon: 'fab fa-tiktok',
    color: '#000000',
    description: 'Publier des vidéos sur votre compte TikTok.',
    setupSteps: [
      'Vous avez besoin d\'un compte TikTok',
      'Cliquez "Connecter TikTok" — une fenêtre TikTok s\'ouvre',
      'Autorisez l\'accès à votre compte',
      'Votre compte est connecté. La publication automatique n\'est pas encore activée sur cette plateforme.'
    ],
    docsUrl: 'https://developers.tiktok.com/apps',
    docsSummary: 'Si vous êtes développeur : TikTok for Developers → App → Products → Login Kit + Content Posting API.',
    publishable: false,
  }
];

@Component({
  selector: 'app-social-connect-wizard',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="social-wizard">

  <!-- En-tête -->
  <div class="wizard-header">
    <h2><i class="fas fa-share-alt"></i> Connecter vos Réseaux Sociaux</h2>
    <p class="subtitle">
      Connectez vos comptes en un clic — aucune manipulation technique requise.
      Votre agent publiera automatiquement sur les plateformes connectées.
    </p>
  </div>

  <!-- Grille des plateformes -->
  <div class="platforms-grid">
    @for (pm of visiblePlatforms(); track pm.key) {
      <div class="platform-card" [class.connected]="isConnected(pm.key)" [class.not-configured]="!isConfigured(pm.key)">

        <!-- Badge statut -->
        <div class="status-badge" [class.connected]="isConnected(pm.key)" [class.disconnected]="!isConnected(pm.key)">
          @if (isConnected(pm.key)) {
            <i class="fas fa-check-circle"></i> Connecté
          } @else {
            <i class="fas fa-times-circle"></i> Déconnecté
          }
        </div>

        <!-- Icône plateforme -->
        <div class="platform-icon" [style.background]="pm.color + '20'" [style.color]="pm.color">
          <i [class]="pm.icon"></i>
        </div>

        <!-- Nom & description -->
        <h3>{{ pm.label }}</h3>

        <!-- Connexion possible, publication pas encore implémentée. -->
        @if (pm.publishable === false) {
          <div class="config-warning">
            <i class="fas fa-info-circle"></i>
            Connexion seule — la publication automatique sur {{ pm.label }} n'est pas encore disponible.
          </div>
        }

        @if (isConnected(pm.key)) {
          <p class="account-name"><i class="fas fa-user"></i> {{ getAccountName(pm.key) || 'Compte connecté' }}</p>

          <!-- Choix de Page : n'apparaît que si le canal gère plusieurs Pages.
               Un canal connecté avant cette fonctionnalité n'affiche rien ici. -->
          @if (hasPageChoice(pm.key)) {
            @if (needsPageChoice(pm.key)) {
              <p class="page-pending">
                <i class="fas fa-exclamation-triangle"></i>
                Plusieurs Pages détectées : choisissez celle où publier.
              </p>
            }
            <button class="btn-page-picker" (click)="togglePagePicker(pm.key)">
              <i class="fas fa-layer-group"></i>
              {{ pagePickerFor === pm.key ? 'Masquer les Pages' : 'Changer de Page' }}
              @if ((getStatus(pm.key)?.availablePageCount ?? 0) > 0) {
                <span class="page-count">{{ getStatus(pm.key)?.availablePageCount }}</span>
              }
            </button>

            @if (pagePickerFor === pm.key) {
              <div class="page-picker">
                @if (pagesLoading) {
                  <p class="page-message"><i class="fas fa-spinner fa-spin"></i> Chargement…</p>
                } @else if (pages.length <= 1) {
                  <p class="page-message">Une seule Page n'est accessible : rien à choisir.</p>
                } @else {
                  <label [for]="'page-select-' + pm.key">Page de publication</label>
                  <select [id]="'page-select-' + pm.key"
                          [value]="currentPageId"
                          [disabled]="pageSwitching"
                          (change)="selectPage(pm.key, $event)">
                    @for (p of pages; track p.id) {
                      <option [value]="p.id">{{ p.name }}</option>
                    }
                  </select>
                  <p class="page-hint">
                    Ce choix est enregistré et s'applique à toutes les prochaines publications.
                  </p>
                }
                @if (pageMessage) {
                  <p class="page-message error">{{ pageMessage }}</p>
                }
              </div>
            }
          }
        } @else {
          <p class="description">{{ pm.description }}</p>
        }

        <!-- Actions -->
        <div class="card-actions">
          @if (missingRequirements(pm).length > 0) {
            <p class="requirement-warning">
              <i class="fas fa-lock"></i>
              Connectez d'abord {{ labelOf(missingRequirements(pm)[0]) }}
            </p>
          }
          @if (!isConnected(pm.key)) {
            <button class="btn-connect" [style.background]="pm.color"
                    [disabled]="connecting === pm.key || missingRequirements(pm).length > 0"
                    (click)="startOAuth(pm)">
              @if (connecting === pm.key) {
                <i class="fas fa-spinner fa-spin"></i> Connexion…
              } @else {
                <i [class]="pm.icon"></i> Connecter {{ pm.label }}
              }
            </button>
          } @else {
            <button class="btn-disconnect" (click)="disconnect(pm, getChannelId(pm.key))">
              <i class="fas fa-unlink"></i> Déconnecter
            </button>
            <button class="btn-reconnect" [style.color]="pm.color" (click)="startOAuth(pm, getChannelId(pm.key))">
              <i class="fas fa-sync"></i> Reconnecter
            </button>
          }

          <!-- Guide étape par étape -->
          <button class="btn-guide" (click)="toggleGuide(pm.key)">
            <i class="fas fa-question-circle"></i>
            {{ activeGuide === pm.key ? 'Masquer le guide' : 'Comment ça marche ?' }}
          </button>
        </div>

        <!-- Guide contextuel -->
        @if (activeGuide === pm.key) {
          <div class="step-guide">
            <h4>Guide de connexion {{ pm.label }}</h4>
            <ol>
              @for (step of pm.setupSteps; track step; let i = $index) {
                <li [class.done]="isConnected(pm.key) && i < 3">
                  <span class="step-num">{{ i + 1 }}</span>
                  {{ step }}
                </li>
              }
            </ol>
            @if (!isConfigured(pm.key)) {
              <div class="config-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Configuration requise (développeur)</strong>
                <p>{{ pm.docsSummary }}</p>
                <a [href]="pm.docsUrl" target="_blank" rel="noopener">
                  <i class="fas fa-external-link-alt"></i> Voir la documentation officielle
                </a>
              </div>
            }
          </div>
        }

      </div>
    }
  </div>

  <!-- État vide : aucune plateforme activée par l'administrateur -->
  @if (statusesLoaded && visiblePlatforms().length === 0) {
    <div class="no-platform">
      <i class="fas fa-plug"></i>
      <p>
        Aucune plateforme n'est encore activée sur cette installation.
        Contactez l'administrateur pour ouvrir Facebook, Instagram ou une autre plateforme.
      </p>
    </div>
  }

  <!-- Plateformes non activées : listées sans action, pour ne pas Walls d'erreurs -->
  @if (hiddenPlatforms().length > 0) {
    <div class="coming-soon">
      <span class="coming-soon-label">
        <i class="fas fa-lock"></i>
        Pas encore activées sur cette installation
      </span>
      <span class="coming-soon-list">
        @for (pm of hiddenPlatforms(); track pm.key; let last = $last) {
          <span class="coming-soon-item">
            <i [class]="pm.icon" [style.color]="pm.color"></i> {{ pm.label }}{{ last ? '' : ',' }}
          </span>
        }
      </span>
    </div>
  }

  <!-- Message de succès / erreur OAuth -->
  @if (oauthMessage) {
    <div class="oauth-message" [class.success]="oauthSuccess" [class.error]="!oauthSuccess">
      <i [class]="oauthSuccess ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle'"></i>
      {{ oauthMessage }}
      <button class="close-msg" (click)="oauthMessage = ''">×</button>
    </div>
  }

</div>
`,
  styles: [`
.social-wizard { padding: 24px; max-width: 1100px; margin: 0 auto; font-family: inherit; }

.wizard-header { margin-bottom: 28px; }
.wizard-header h2 { font-size: 1.5rem; color: #1a1a2e; margin: 0 0 8px; }
.wizard-header h2 i { color: #7c3aed; margin-right: 10px; }
.subtitle { color: #64748b; margin: 0; font-size: 0.95rem; }

.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.platform-card {
  background: #fff;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  position: relative;
  transition: border-color .2s, box-shadow .2s;
}
.platform-card:hover { border-color: #c4b5fd; box-shadow: 0 4px 20px rgba(124,58,237,.08); }
.platform-card.connected { border-color: #10b981; background: #f0fdf4; }
.platform-card.not-configured { opacity: .85; }

/* Prérequis non satisfait (ex. Instagram sans Facebook) */
.requirement-warning {
  display: flex; align-items: center; gap: 6px;
  margin: 0 0 10px; padding: 7px 10px;
  background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
  color: #92400e; font-size: .8rem; font-weight: 600;
}
.requirement-warning + .btn-connect { opacity: .5; }

/* Aucune plateforme activée */
.no-platform {
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 36px 24px; text-align: center;
  background: #fff; border: 2px dashed #e2e8f0; border-radius: 16px;
  color: #64748b;
}
.no-platform i { font-size: 1.6rem; color: #cbd5e1; }
.no-platform p { margin: 0; max-width: 46ch; line-height: 1.5; }

/* Plateformes listées mais non activées : sans bouton, donc sans cul-de-sac */
.coming-soon {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px;
  margin-top: 18px; padding: 12px 16px;
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
}
.coming-soon-label {
  display: inline-flex; align-items: center; gap: 6px;
  color: #64748b; font-size: .78rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: .04em;
}
.coming-soon-list { display: flex; flex-wrap: wrap; gap: 12px; }
.coming-soon-item {
  display: inline-flex; align-items: center; gap: 5px;
  color: #94a3b8; font-size: .85rem;
}

.status-badge {
  position: absolute; top: 14px; right: 14px;
  font-size: .75rem; font-weight: 600; padding: 3px 10px; border-radius: 20px;
  display: flex; align-items: center; gap: 4px;
}
.status-badge.connected { background: #dcfce7; color: #166534; }
.status-badge.disconnected { background: #fee2e2; color: #991b1b; }

.platform-icon {
  width: 52px; height: 52px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem; margin-bottom: 12px;
}

.platform-card h3 { font-size: 1.05rem; font-weight: 700; color: #1a1a2e; margin: 0 0 6px; }
.description { font-size: .85rem; color: #64748b; margin: 0 0 16px; line-height: 1.5; }
.account-name { font-size: .85rem; color: #059669; margin: 0 0 16px; }
.account-name i { margin-right: 6px; }

.card-actions { display: flex; flex-direction: column; gap: 8px; }

.btn-connect {
  color: #fff; border: none; border-radius: 10px; padding: 10px 16px;
  font-size: .9rem; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: opacity .2s, transform .1s;
}
.btn-connect:hover:not(:disabled) { opacity: .88; transform: translateY(-1px); }
.btn-connect:disabled { opacity: .6; cursor: not-allowed; }

.btn-disconnect {
  background: #fee2e2; color: #991b1b; border: none; border-radius: 10px;
  padding: 8px 14px; font-size: .85rem; font-weight: 600; cursor: pointer; transition: opacity .2s;
}
.btn-disconnect:hover { opacity: .8; }

.btn-reconnect {
  background: transparent; border: 2px solid currentColor; border-radius: 10px;
  padding: 7px 14px; font-size: .85rem; font-weight: 600; cursor: pointer; transition: opacity .2s;
}
.btn-reconnect:hover { opacity: .7; }

/* Sélecteur de Page */
.page-pending {
  margin: .4rem 0 .2rem;
  font-size: .78rem;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: .35rem .5rem;
}
.btn-page-picker {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  margin-top: .4rem;
  padding: .35rem .6rem;
  font-size: .8rem;
  font-weight: 600;
  color: #1d4ed8;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  cursor: pointer;
}
.btn-page-picker:hover { background: #dbeafe; }
.page-count {
  padding: 0 .35rem;
  border-radius: 999px;
  background: #1d4ed8;
  color: #fff;
  font-size: .7rem;
}
.page-picker {
  margin-top: .5rem;
  padding: .6rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: .35rem;
}
.page-picker label { font-size: .78rem; font-weight: 600; color: #334155; }
.page-picker select {
  padding: .4rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: .85rem;
  background: #fff;
}
.page-picker select:disabled { opacity: .6; }
.page-hint { margin: 0; font-size: .72rem; color: #64748b; }
.page-message { margin: 0; font-size: .78rem; color: #475569; }
.page-message.error { color: #b91c1c; }

.btn-guide {
  background: transparent; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 6px 12px; font-size: .8rem; color: #7c3aed; cursor: pointer; text-align: left;
  display: flex; align-items: center; gap: 6px; transition: background .2s;
}
.btn-guide:hover { background: #f5f3ff; }

.step-guide {
  margin-top: 16px; background: #f8fafc; border-radius: 12px; padding: 16px;
  border-left: 3px solid #7c3aed;
}
.step-guide h4 { font-size: .9rem; color: #7c3aed; margin: 0 0 12px; }
.step-guide ol { margin: 0; padding-left: 0; list-style: none; }
.step-guide li {
  display: flex; align-items: flex-start; gap: 10px;
  font-size: .83rem; color: #475569; padding: 6px 0;
  border-bottom: 1px dashed #e2e8f0;
}
.step-guide li:last-child { border-bottom: none; }
.step-guide li.done { color: #059669; }
.step-num {
  min-width: 22px; height: 22px; background: #7c3aed; color: #fff;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: .75rem; font-weight: 700; flex-shrink: 0;
}
.step-guide li.done .step-num { background: #10b981; }

.config-warning {
  margin-top: 12px; background: #fffbeb; border: 1px solid #fcd34d;
  border-radius: 8px; padding: 12px; font-size: .82rem; color: #92400e;
}
.config-warning strong { display: block; margin-bottom: 4px; }
.config-warning a { color: #d97706; font-weight: 600; text-decoration: none; }
.config-warning a:hover { text-decoration: underline; }

.oauth-message {
  position: fixed; bottom: 24px; right: 24px;
  max-width: 420px; border-radius: 12px; padding: 14px 20px;
  display: flex; align-items: center; gap: 10px;
  font-weight: 600; font-size: .9rem; box-shadow: 0 4px 24px rgba(0,0,0,.15);
  z-index: 9999; animation: slideUp .3s ease;
}
.oauth-message.success { background: #dcfce7; color: #166534; border: 1px solid #10b981; }
.oauth-message.error   { background: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
.close-msg { margin-left: auto; background: none; border: none; font-size: 1.2rem; cursor: pointer; color: inherit; }

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
`]
})
export class SocialConnectWizardComponent implements OnInit, OnDestroy {
  @Input() agentId!: string;

  protected readonly PLATFORMS = PLATFORMS;
  protected statuses: SocialPlatformStatus[] = [];
  /** Tant que c'est false, on ne décide pas de masquer une plateforme : on
   *  afficherait « non configuré » pendant le simple temps du chargement. */
  protected statusesLoaded = false;
  protected connecting: string | null = null;
  protected activeGuide: string | null = null;
  protected oauthMessage = '';
  protected oauthSuccess = false;

  /** Plateforme dont on affiche le sélecteur de Page, ou null. */
  protected pagePickerFor: string | null = null;
  protected pages: SocialPage[] = [];
  protected currentPageId = '';
  protected pagesLoading = false;
  protected pageSwitching = false;
  protected pageMessage = '';

  private readonly API = '/api/oauth/social';
  private readonly AGENTS_API = '/api/agents';
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadStatuses();
    this.checkOAuthCallback();
    // Rafraîchir les statuts toutes les 5s si une connexion OAuth vient de se terminer
    interval(5000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.loadStatuses());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected isConnected(platform: string): boolean {
    return Boolean(this.getStatus(platform)?.connected);
  }

  protected isConfigured(platform: string): boolean {
    const s = this.getStatus(platform);
    return s ? Boolean(s.configured) : true;
  }

  /**
   * Ce qu'on montre dans la grille principale.
   *
   * Une plateforme configurée par l'administrateur, OU déjà connectée — même si
   * la configuration a disparu entre-temps, sinon l'utilisateur verrait son
   * canal disparaître de l'écran et ne pourrait plus le déconnecter.
   */
  protected visiblePlatforms(): PlatformMeta[] {
    if (!this.statusesLoaded) return this.PLATFORMS;
    return this.PLATFORMS.filter(pm => this.isConfigured(pm.key) || this.isConnected(pm.key));
  }

  /** Plateformes que l'administrateur n'a pas encore activées. */
  protected hiddenPlatforms(): PlatformMeta[] {
    if (!this.statusesLoaded) return [];
    return this.PLATFORMS.filter(pm => !this.isConfigured(pm.key) && !this.isConnected(pm.key));
  }

  /** Prérequis non satisfaits, ex. ['FACEBOOK'] pour Instagram. */
  protected missingRequirements(pm: PlatformMeta): string[] {
    return (pm.requires ?? []).filter(k => !this.isConnected(k));
  }

  protected labelOf(platform: string): string {
    return this.PLATFORMS.find(p => p.key === platform)?.label ?? platform;
  }

  protected getAccountName(platform: string): string {
    return this.getStatus(platform)?.accountName || '';
  }

  protected getChannelId(platform: string): string | undefined {
    return this.getStatus(platform)?.channelId;
  }

  protected getStatus(platform: string): SocialPlatformStatus | undefined {
    return this.statuses.find(s => s.platform === platform);
  }

  protected toggleGuide(key: string): void {
    this.activeGuide = this.activeGuide === key ? null : key;
  }

  protected startOAuth(pm: PlatformMeta, existingChannelId?: string): void {
    if (!this.agentId) {
      this.showMessage('Veuillez d\'abord sélectionner un agent.', false);
      return;
    }
    const missing = this.missingRequirements(pm);
    if (missing.length) {
      const names = missing.map(k => this.labelOf(k)).join(' et ');
      this.showMessage(`Connectez d\'abord ${names} : ${pm.label} en dépend.`, false);
      return;
    }
    this.connecting = pm.key;

    let url = `${this.API}/${pm.key.toLowerCase()}/authorize?agentId=${this.agentId}`;
    if (existingChannelId) url += `&channelId=${existingChannelId}`;

    this.http.get<{ authUrl: string; configured: boolean; message: string }>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (resp) => {
          this.connecting = null;
          if (!resp.configured) {
            this.showMessage(`${pm.label} n'est pas encore configuré par l'administrateur. ${resp.message}`, false);
            this.activeGuide = pm.key;
            return;
          }
          // Ouvrir la fenêtre OAuth (popup centré)
          const w = 600, h = 700;
          const left = window.screen.width  / 2 - w / 2;
          const top  = window.screen.height / 2 - h / 2;
          const win = window.open(
            resp.authUrl,
            'oauth_' + pm.key,
            `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
          );
          if (!win) {
            // Fallback : rediriger dans le même onglet
            sessionStorage.setItem('oauth_return', window.location.href);
            window.location.href = resp.authUrl;
          }
        },
        error: (err) => {
          this.connecting = null;
          this.showMessage('Erreur lors de la connexion : ' + (err.error?.error || err.message), false);
        }
      });
  }

  protected disconnect(pm: PlatformMeta, channelId?: string): void {
    if (!channelId || !this.agentId) return;
    const url = `${this.AGENTS_API}/${this.agentId}/channels/${channelId}/disconnect`;
    this.http.post(url, {}).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.showMessage(`${pm.label} déconnecté avec succès.`, true);
        this.loadStatuses();
      },
      error: () => this.showMessage('Erreur lors de la déconnexion.', false)
    });
  }

  // ── Choix de la Page (Facebook / Instagram) ──────────────────────────────

  /**
   * Un sélecteur n'est proposé que si le canal a été connecté via un échange
   * OAuth remontant plusieurs Pages. Les canaux historiques n'ont pas ces
   * informations : on ne montre alors rien du tout et la publication continue
   * sur la Page déjà enregistrée.
   */
  protected hasPageChoice(platform: string): boolean {
    const s = this.getStatus(platform);
    if (!s || !s.connected) return false;
    return (s.availablePageCount ?? 0) > 1;
  }

  protected needsPageChoice(platform: string): boolean {
    return this.hasPageChoice(platform) && Boolean(this.getStatus(platform)?.pageSelectionPending);
  }

  protected togglePagePicker(platform: string): void {
    if (this.pagePickerFor === platform) {
      this.closePagePicker();
      return;
    }
    const channelId = this.getStatus(platform)?.channelId;
    if (!channelId) return;

    this.pagePickerFor = platform;
    this.pages = [];
    this.currentPageId = '';
    this.pageMessage = '';
    this.pagesLoading = true;

    this.http.get<{ pageId: string; pageName: string; pages: SocialPage[] }>(
        `${this.API}/${platform.toLowerCase()}/pages/${channelId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.pages = res.pages ?? [];
          this.currentPageId = res.pageId ?? '';
          this.pagesLoading = false;
        },
        error: () => {
          this.pagesLoading = false;
          this.pageMessage = 'Impossible de charger vos Pages.';
        }
      });
  }

  protected closePagePicker(): void {
    this.pagePickerFor = null;
    this.pages = [];
    this.currentPageId = '';
    this.pageMessage = '';
  }

  protected selectPage(platform: string, event: Event): void {
    const channelId = this.getStatus(platform)?.channelId;
    const pageId = (event.target as HTMLSelectElement).value;
    if (!channelId || !pageId || pageId === this.currentPageId) return;

    this.pageSwitching = true;
    this.pageMessage = '';

    this.http.post<{ changed: boolean; pageName: string; error?: string }>(
        `${this.API}/${platform.toLowerCase()}/pages/${channelId}/select`, { pageId })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          this.pageSwitching = false;
          this.currentPageId = pageId;
          const name = this.pages.find(p => p.id === pageId)?.name ?? res.pageName;
          this.showMessage(`✅ ${platform} publiera désormais sur « ${name} ».`, true);
          this.closePagePicker();
          this.loadStatuses();
        },
        error: err => {
          this.pageSwitching = false;
          this.pageMessage = err?.error?.error
            ?? 'Impossible de changer de Page. Réessayez.';
        }
      });
  }

  private loadStatuses(): void {
    if (!this.agentId) return;
    this.http.get<SocialPlatformStatus[]>(`${this.API}/status/${this.agentId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: s => { this.statuses = s; this.statusesLoaded = true; },
        error: () => { this.statusesLoaded = true; }
      });
  }

  /** Lire les query params OAuth depuis l'URL courante (callback depuis popup/redirect) */
  private checkOAuthCallback(): void {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('oauth_success');
    const error   = params.get('oauth_error');
    const platform = params.get('platform') || '';
    const account  = params.get('account') || '';

    if (success === 'true') {
      this.showMessage(`✅ ${platform} connecté avec succès ! Compte : ${account}`, true);
      // Nettoyer l'URL
      window.history.replaceState({}, '', window.location.pathname);
      this.loadStatuses();
    } else if (error) {
      this.showMessage(`❌ Connexion ${platform} échouée : ${decodeURIComponent(error)}`, false);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  private showMessage(msg: string, success: boolean): void {
    this.oauthMessage = msg;
    this.oauthSuccess = success;
    setTimeout(() => this.oauthMessage = '', 7000);
  }
}
