import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AgentService } from '../../../services/agent.service';
import { CvWorkspaceService } from '../../../features/agentique/cv-workspace.service';

/**
 * Bannière de session réutilisable dans tous les agents.
 * Affiche les infos utilisateur si connecté, sinon invite à se connecter.
 */
@Component({
  selector: 'app-agent-session-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
<div class="session-bar" [class.session-bar--guest]="!ctx.isLoggedIn">

  <!-- Connecté -->
  <div *ngIf="ctx.isLoggedIn" class="sb-left">
    <div class="sb-avatar">{{ initial }}</div>
    <div class="sb-info">
      <span class="sb-name">{{ ctx.name }}</span>
      <span class="sb-email">{{ ctx.email }}</span>
    </div>
    <div class="sb-mid">
      <span class="sb-badge-live"><span class="sb-dot"></span>Session active</span>
      <span class="sb-role">{{ roleLabel }}</span>
    </div>
  </div>
  <div *ngIf="ctx.isLoggedIn" class="sb-right">
    <button *ngIf="showWorkspace" class="sb-workspace-btn" (click)="goWorkspace()">
      <span class="sb-ws-icon">📋</span>
      Workspace
      <span *ngIf="wsCount > 0" class="sb-ws-badge">{{ wsCount }}</span>
    </button>
    <div class="sb-credits">
      <span class="sb-credits-n">{{ ctx.credits }}</span>
      <span class="sb-credits-l">crédits</span>
    </div>
    <div class="sb-model" *ngIf="providerLabel" [title]="providerLabel">
      <span class="sb-model-dot"></span>
      {{ providerLabel }}
    </div>
  </div>

  <!-- Non connecté -->
  <div *ngIf="!ctx.isLoggedIn" class="sb-guest">
    <span class="sb-guest-icon">👤</span>
    <div class="sb-guest-text">
      <strong>Vous n'êtes pas connecté</strong>
      <span>Connectez-vous pour des réponses personnalisées avec votre nom, sauvegarder l'historique et accéder aux fonctionnalités avancées.</span>
    </div>
    <a routerLink="/auth" class="sb-login-btn">Se connecter →</a>
  </div>

</div>
  `,
  styles: [`
    :host { display:block; }

    .session-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .5rem 1.25rem;
      background: var(--fp-card),.97);
      border-bottom: 1px solid rgba(99,102,241,.15);
      gap: 1rem;
      flex-shrink: 0;
      position: relative;
      z-index: 20;
      flex-wrap: wrap;
    }
    .session-bar--guest {
      border-bottom-color: rgba(245,158,11,.2);
    }

    /* ── Connecté ── */
    .sb-left {
      display: flex;
      align-items: center;
      gap: .7rem;
    }
    .sb-avatar {
      width: 30px; height: 30px;
      border-radius: 8px;
      background: linear-gradient(135deg,#6366f1,#a855f7);
      color: #fff; font-size: .8rem; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .sb-info {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
    .sb-name  { font-size: .8rem; font-weight: 700; color: #e2e8f0; }
    .sb-email { font-size: .67rem; color: #475569; }
    .sb-mid {
      display: flex;
      align-items: center;
      gap: .75rem;
      margin-left: .5rem;
    }
    .sb-badge-live {
      display: flex;
      align-items: center;
      gap: .3rem;
      font-size: .67rem;
      font-weight: 700;
      color: #10b981;
    }
    .sb-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #10b981;
      animation: pulse 2s ease infinite;
      flex-shrink: 0;
    }
    .sb-role {
      font-size: .65rem;
      font-weight: 700;
      background: rgba(99,102,241,.12);
      border: 1px solid rgba(99,102,241,.2);
      color: #818cf8;
      padding: .12rem .45rem;
      border-radius: 10px;
    }
    .sb-right {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-left: auto;
    }
    .sb-credits {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .05rem;
    }
    .sb-credits-n {
      font-size: .95rem;
      font-weight: 800;
      color: #a5b4fc;
      line-height: 1;
    }
    .sb-credits-l {
      font-size: .6rem;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    .sb-model {
      display: flex;
      align-items: center;
      gap: .35rem;
      font-size: .67rem;
      font-weight: 700;
      color: #475569;
      background: rgba(255,255,255,.04);
      border: 1px solid var(--fp-border));
      padding: .25rem .6rem;
      border-radius: 8px;
    }
    .sb-model-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #10b981;
      animation: pulse 2s ease infinite;
      flex-shrink: 0;
    }

    /* ── Non connecté ── */
    .sb-guest {
      display: flex;
      align-items: center;
      gap: .75rem;
      width: 100%;
    }
    .sb-guest-icon { font-size: 1.2rem; flex-shrink: 0; }
    .sb-guest-text {
      display: flex;
      flex-direction: column;
      gap: .15rem;
      flex: 1;
      min-width: 0;
    }
    .sb-guest-text strong {
      font-size: .78rem;
      color: #94a3b8;
    }
    .sb-guest-text span {
      font-size: .72rem;
      color: #475569;
      line-height: 1.5;
    }
    .sb-login-btn {
      flex-shrink: 0;
      background: linear-gradient(135deg,#6366f1,#a855f7);
      color: #fff;
      font-size: .72rem;
      font-weight: 800;
      padding: .35rem .85rem;
      border-radius: 8px;
      text-decoration: none;
      transition: .15s;
      white-space: nowrap;
    }
    .sb-login-btn:hover { opacity: .88; transform: translateY(-1px); }

    /* ── Workspace button ── */
    .sb-workspace-btn {
      display: flex; align-items: center; gap: .35rem;
      background: rgba(13,148,136,.12); border: 1px solid rgba(13,148,136,.3);
      color: #5eead4; font-size: .7rem; font-weight: 700;
      padding: .28rem .65rem; border-radius: 8px; cursor: pointer; transition: .15s;
      white-space: nowrap;
    }
    .sb-workspace-btn:hover { background: rgba(13,148,136,.22); }
    .sb-ws-icon { font-size: .85rem; }
    .sb-ws-badge {
      background: #0d9488; color: #fff; font-size: .6rem; font-weight: 900;
      padding: .05rem .38rem; border-radius: 10px; min-width: 16px; text-align: center;
    }

    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  `]
})
export class AgentSessionBarComponent implements OnInit {
  @Input() agentName = '';
  @Input() showWorkspace = false;

  private agentSvc = inject(AgentService);
  private wsSvc    = inject(CvWorkspaceService);
  private router   = inject(Router);

  get ctx()     { return this.agentSvc.getUserContext(); }
  get wsCount() { return this.wsSvc.count; }

  /**
   * Modèle réellement résolu par le backend pour cet agent. Le LlmGateway
   * choisit le provider le plus spécifique (agent > équipe > compte > admin) :
   * l'afficher ici évite d'annoncer un modèle qui n'est pas utilisé.
   */
  get providerLabel(): string {
    const p = this.ctx?.llmProvider;
    if (!p || (!p.type && !p.modelId)) return '';
    return [p.type, p.modelId].filter(Boolean).join(' · ');
  }

  goWorkspace() { this.router.navigate(['/agentique/cv-workspace']); }

  ngOnInit() {
    this.agentSvc.refreshLlmProvider().catch(() => {});
  }

  get initial(): string {
    return this.ctx.name?.[0]?.toUpperCase() ?? '?';
  }

  get roleLabel(): string {
    const r = this.ctx.role;
    if (r === 'ROLE_ADMIN') return 'Admin';
    if (r === 'ROLE_USER')  return 'Membre';
    return r ?? 'Visiteur';
  }
}
