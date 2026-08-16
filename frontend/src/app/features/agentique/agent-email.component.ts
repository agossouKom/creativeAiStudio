import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AgentService } from '../../services/agent.service';
import { GmailService, GmailEmail } from '../../services/gmail.service';
import { AgentEmailService, AgentTask, ScheduledTask } from '../../services/agent-email.service';
import { AgentSessionBarComponent } from '../../shared/components/agent-session-bar/agent-session-bar.component';
import { DialogService } from '../../shared/ui/dialog.service';

interface ChatMsg { role: 'user' | 'assistant'; content: string; ts: Date; }

const CAT_CONFIG = {
  urgent:     { label: 'Urgent',     color: '#ef4444', bg: 'rgba(239,68,68,.15)',   icon: '🔴' },
  work:       { label: 'Travail',    color: '#6366f1', bg: 'rgba(99,102,241,.15)',  icon: '💼' },
  commercial: { label: 'Commercial', color: '#10b981', bg: 'rgba(16,185,129,.15)', icon: '💰' },
  info:       { label: 'Info',       color: '#0ea5e9', bg: 'rgba(14,165,233,.15)', icon: 'ℹ️' },
  spam:       { label: 'Spam',       color: '#94a3b8', bg: 'rgba(148,163,184,.1)', icon: '🗑️' },
};

const SAMPLE_EMAILS: GmailEmail[] = [
  { id:'s1', threadId:'t1', from:'Marie Dupont', fromEmail:'marie@acme.fr', to:'vous@exemple.fr',
    subject:'URGENT : Validation du contrat avant 17h',
    snippet:'Le client attend notre retour aujourd\'hui impérativement…',
    body:'Bonjour,\n\nLe client Acme Corp attend notre validation du contrat avant 17h aujourd\'hui. Sans retour de votre part, le deal sera annulé.\n\nCordialement,\nMarie Dupont',
    date:'Aujourd\'hui, 10:23', dateRaw:'', read:false, hasAttachment:false, labels:['IMPORTANT'], category:'urgent' },
  { id:'s2', threadId:'t2', from:'Thomas Martin', fromEmail:'thomas@startup.io', to:'equipe@exemple.fr',
    subject:'Réunion projet Alpha — Compte-rendu',
    snippet:'Suite à notre réunion, voici les décisions prises…',
    body:'Bonjour équipe,\n\nSuite à notre réunion :\n1. Lancement MVP : 15 juillet\n2. Budget : 50 000€\n3. Équipe : 3 dev + 1 designer\n\nBonne continuation,\nThomas',
    date:'Aujourd\'hui, 09:45', dateRaw:'', read:false, hasAttachment:false, labels:[], category:'work' },
  { id:'s3', threadId:'t3', from:'Jean-Paul Leroy', fromEmail:'jp@prospect.com', to:'vous@exemple.fr',
    subject:'Proposition commerciale CRM',
    snippet:'Je vous transmets notre proposition pour la mise en place d\'une solution CRM adaptée…',
    body:'Monsieur,\n\nSuite à notre appel, voici notre proposition pour une solution CRM.\nBudget estimé : 12 000€/an.\n\nCordialement,\nJean-Paul Leroy',
    date:'Hier, 14:12', dateRaw:'', read:true, hasAttachment:false, labels:[], category:'commercial' },
];

@Component({
  selector: 'app-agent-email',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AgentSessionBarComponent],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
<div class="ae-wrap">
  <app-agent-session-bar agentName="Agent Email"></app-agent-session-bar>

  <!-- ── Dual-panel layout ────────────────────────────────────────────────── -->
  <div class="ae-dual">

    <!-- LEFT: Email viewer (existing) -->
    <div class="ae-left-panel">

  <!-- ── Header ──────────────────────────────────────────────────────────── -->
  <div class="ae-header">
    <div class="ae-header-left">
      <div class="ae-avatar">📧</div>
      <div class="ae-title-block">
        <h1 class="ae-title">Agent Email</h1>
        <p class="ae-subtitle">{{ userCtx.isLoggedIn ? 'Bonjour ' + firstName + ' !' : 'Assistant IA' }}</p>
      </div>
    </div>
    <div class="ae-header-right">
      <ng-container *ngIf="!gmailSvc.status().connected">
        <span class="ae-demo-badge">📋 Démo</span>
        <button class="ae-connect-btn" (click)="connectGmail()" [disabled]="!userCtx.isLoggedIn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20 18H4V8l8 5 8-5v10zM4 6h16l-8 5-8-5z"/></svg>
          Connecter Gmail
        </button>
      </ng-container>
      <ng-container *ngIf="gmailSvc.status().connected">
        <div class="ae-gmail-status">
          <span class="ae-gmail-dot"></span>
          <span class="ae-gmail-addr">{{ gmailSvc.status().gmailEmail }}</span>
        </div>
        <button class="ae-icon-btn ae-icon-btn--refresh" (click)="loadGmailEmails()"
                [disabled]="gmailSvc.loading()" title="Actualiser">
          <span *ngIf="!gmailSvc.loading()">↻</span>
          <span *ngIf="gmailSvc.loading()" class="ae-spin-sm"></span>
        </button>
        <button class="ae-icon-btn ae-icon-btn--disc" (click)="disconnect()" title="Déconnecter">✕</button>
      </ng-container>
    </div>
  </div>

  <!-- ── Stats ───────────────────────────────────────────────────────────── -->
  <div class="ae-stats-bar">
    <!-- Urgents -->
    <div class="ae-stat ae-stat--urgent">
      <svg class="ae-donut" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(239,68,68,.15)" stroke-width="4"/>
        <circle cx="18" cy="18" r="14" fill="none" stroke="#ef4444" stroke-width="4"
          [attr.stroke-dasharray]="donutDash(urgentCount, displayEmails.length)"
          stroke-dashoffset="22" stroke-linecap="round" transform="rotate(-90 18 18)"/>
      </svg>
      <div class="ae-stat-info">
        <span class="ae-stat-num ae-stat-num--urgent">{{ urgentCount }}</span>
        <span class="ae-stat-lbl">Urgents</span>
      </div>
    </div>
    <!-- Non lus -->
    <div class="ae-stat ae-stat--unread">
      <svg class="ae-donut" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(99,102,241,.15)" stroke-width="4"/>
        <circle cx="18" cy="18" r="14" fill="none" stroke="#6366f1" stroke-width="4"
          [attr.stroke-dasharray]="donutDash(unreadCount, displayEmails.length)"
          stroke-dashoffset="22" stroke-linecap="round" transform="rotate(-90 18 18)"/>
      </svg>
      <div class="ae-stat-info">
        <span class="ae-stat-num ae-stat-num--unread">{{ unreadCount }}</span>
        <span class="ae-stat-lbl">Non lus</span>
      </div>
    </div>
    <!-- Total -->
    <div class="ae-stat ae-stat--total">
      <div class="ae-stat-icon">📬</div>
      <div class="ae-stat-info">
        <span class="ae-stat-num ae-stat-num--total">{{ displayEmails.length }}</span>
        <span class="ae-stat-lbl">Total</span>
      </div>
    </div>
    <div class="ae-stats-actions">
      <button class="ae-analyze-btn" (click)="analyzeAll()"
              [disabled]="analyzing || filteredEmails.length === 0">
        <span *ngIf="!analyzing">🤖 Analyser tout</span>
        <span *ngIf="analyzing" class="ae-spin-sm"></span>
      </button>
    </div>
  </div>

  <!-- ── Filtres ──────────────────────────────────────────────────────────── -->
  <div class="ae-filters">
    <button *ngFor="let cat of categories" class="ae-filter"
            [class.ae-filter--active]="activeFilter === cat.id"
            [style.--fc]="cat.color"
            (click)="setFilter(cat.id)">
      {{ cat.icon }} {{ cat.label }}
      <span class="ae-filter-n">{{ countByCat(cat.id) }}</span>
    </button>
  </div>

  <!-- ── Liste emails (accordéon) ────────────────────────────────────────── -->
  <div class="ae-list">

    <!-- Loading -->
    <div *ngIf="gmailSvc.loading()" class="ae-state ae-state--loading">
      <div class="ae-spinner"></div>
      <span>Chargement depuis Gmail…</span>
    </div>

    <!-- Erreur -->
    <div *ngIf="!gmailSvc.loading() && gmailSvc.loadError()" class="ae-state ae-state--error">
      <span>⚠️ {{ gmailSvc.loadError() }}</span>
      <button class="ae-reconnect-btn" (click)="connectGmail()">↺ Reconnecter</button>
    </div>

    <!-- Vide -->
    <div *ngIf="!gmailSvc.loading() && !gmailSvc.loadError() && filteredEmails.length === 0" class="ae-state ae-state--empty">
      <span class="ae-empty-icon">📭</span>
      <span>Aucun email dans cette catégorie</span>
    </div>

    <!-- Items -->
    <div *ngFor="let email of filteredEmails; trackBy: trackById"
         class="ae-item"
         [class.ae-item--expanded]="expandedId === email.id"
         [class.ae-item--urgent]="email.category === 'urgent'"
         [class.ae-item--unread]="!email.read">

      <!-- Ligne principale (clic = expand/collapse) -->
      <div class="ae-row" (click)="toggleExpand(email)">
        <span class="ae-arrow" [class.ae-arrow--open]="expandedId === email.id">›</span>
        <div class="ae-av"
             [style.background]="CAT[email.category ?? 'work'].bg"
             [style.color]="CAT[email.category ?? 'work'].color">
          {{ email.from[0]?.toUpperCase() }}
        </div>
        <div class="ae-row-body">
          <div class="ae-row-top">
            <span class="ae-from" [class.ae-from--unread]="!email.read">{{ email.from }}</span>
            <span class="ae-date">{{ formatDate(email.date) }}</span>
          </div>
          <span class="ae-subject" [class.ae-subject--unread]="!email.read">{{ email.subject }}</span>
          <span class="ae-preview" *ngIf="expandedId !== email.id">{{ email.snippet }}</span>
        </div>
        <div class="ae-row-meta">
          <span class="ae-cat-icon">{{ CAT[email.category ?? 'work'].icon }}</span>
          <span *ngIf="!email.read" class="ae-dot"></span>
        </div>
      </div>

      <!-- Corps déplié -->
      <div class="ae-body" *ngIf="expandedId === email.id">
        <div class="ae-meta-line">
          <span>De : <strong>{{ email.from }}</strong> &lt;{{ email.fromEmail }}&gt;</span>
          <span *ngIf="email.to" class="ae-meta-sep">|</span>
          <span *ngIf="email.to">À : {{ email.to }}</span>
          <span class="ae-meta-sep">|</span>
          <span>{{ email.date }}</span>
        </div>

        <div class="ae-content">
          <p *ngFor="let line of getBodyLines(email)">{{ line || '&nbsp;' }}</p>
        </div>

        <!-- Bouton Gérer -->
        <div class="ae-gerer-row">
          <button class="ae-gerer-btn" (click)="toggleGerer($event, email)">
            ⚙️ Gérer
            <span class="ae-gerer-chevron" [class.ae-gerer-chevron--open]="showGerer && expandedId === email.id">▾</span>
          </button>
          <button *ngIf="activeTab === 'reply' && iaResult && gmailSvc.status().connected"
                  class="ae-send-quick-btn" (click)="sendReply()" [disabled]="sending || iaStreaming">
            {{ sending ? 'Envoi…' : '📤 Envoyer la réponse' }}
          </button>
        </div>

        <!-- Panel IA -->
        <div class="ae-ia" *ngIf="showGerer && expandedId === email.id">
          <!-- Onglets -->
          <div class="ae-ia-tabs">
            <button *ngFor="let t of tabs" class="ae-ia-tab"
                    [class.ae-ia-tab--active]="activeTab === t.id"
                    (click)="switchTab(t.id); $event.stopPropagation()">
              {{ t.icon }} {{ t.label }}
            </button>
          </div>

          <!-- Contenu IA -->
          <div class="ae-ia-content" (click)="$event.stopPropagation()">

            <!-- État vide -->
            <div *ngIf="!iaResult && !iaLoading && !iaStreaming" class="ae-ia-empty">
              <p class="ae-ia-desc">{{ currentTab?.desc }}</p>
              <button class="ae-run-btn" (click)="runIA()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Lancer l'agent IA
              </button>
            </div>

            <!-- Loading -->
            <div *ngIf="iaLoading && !iaStreaming" class="ae-ia-loading">
              <div class="ae-spinner"></div>
              <span>Agent en cours d'analyse…</span>
            </div>

            <!-- Résultat -->
            <div *ngIf="iaResult || iaStreaming" class="ae-ia-result">
              <div class="ae-ia-result-top">
                <span class="ae-ia-result-label">{{ currentTab?.icon }} Résultat IA</span>
                <div class="ae-ia-actions">
                  <button class="ae-action-btn ae-action-btn--copy" (click)="copyResult()">
                    {{ copied ? '✓ Copié' : '📋 Copier' }}
                  </button>
                  <button *ngIf="!iaStreaming" class="ae-action-btn ae-action-btn--regen" (click)="clearResult()">
                    ↺ Régénérer
                  </button>
                </div>
              </div>
              <div class="ae-ia-text">{{ iaResult }}<span *ngIf="iaStreaming" class="ae-cursor">|</span></div>
            </div>

          </div>
        </div>

      </div>
    </div>
    </div><!-- /ae-left-panel -->

    <!-- RIGHT: Chat + Tasks panel -->
    <div class="ae-right-panel">

      <!-- No credential warning -->
      <div *ngIf="!hasGroqKey" class="ae-no-cred">
        <span>🔑</span>
        <div>
          <strong>Clé Groq manquante</strong>
          <p>Configurez votre clé API pour activer l'agent.</p>
          <a routerLink="/settings/credentials" class="ae-cred-link">Configurer →</a>
        </div>
      </div>

      <!-- Chat section -->
      <div class="ae-chat-section">
        <div class="ae-chat-header">
          <span class="ae-chat-title">🤖 Agent IA</span>
          <button class="ae-clear-btn" (click)="clearChat()" title="Effacer la conversation">↺</button>
        </div>

        <div class="ae-chat-messages" #chatContainer>
          <div *ngIf="chatMessages.length === 0" class="ae-chat-empty">
            <span>💬</span>
            <p>Posez une question à l'agent :<br>"Résume mes emails urgents"<br>"Crée une tâche pour appeler Marc"<br>"Y a-t-il des emails en attente de réponse ?"</p>
          </div>
          <div *ngFor="let msg of chatMessages" class="ae-chat-msg"
               [class.ae-chat-msg--user]="msg.role === 'user'"
               [class.ae-chat-msg--assistant]="msg.role === 'assistant'">
            <div class="ae-chat-bubble">
              <span *ngIf="msg.role === 'assistant'" class="ae-bubble-icon">🤖</span>
              <div class="ae-bubble-text" [class.streaming]="msg === lastMsg && isStreaming">{{ msg.content }}<span *ngIf="msg === lastMsg && isStreaming" class="ae-cursor">|</span></div>
            </div>
            <span class="ae-chat-ts">{{ formatChatTime(msg.ts) }}</span>
          </div>
        </div>

        <div class="ae-chat-input-row">
          <textarea class="ae-chat-input" [(ngModel)]="chatInput"
                    placeholder="Demandez à l'agent…"
                    (keydown.enter)="onChatEnter($event)"
                    rows="2"></textarea>
          <button class="ae-voice-btn" [class.ae-voice-btn--active]="voiceActive"
                  (click)="startVoice()" [disabled]="isStreaming" title="Saisie vocale">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V20H9v2h6v-2h-2v-2.07A7 7 0 0 0 19 11h-2z"/>
            </svg>
          </button>
          <button class="ae-chat-send" (click)="sendChat()" [disabled]="!chatInput.trim() || isStreaming">
            <span *ngIf="!isStreaming">▶</span>
            <span *ngIf="isStreaming" class="ae-spin-sm"></span>
          </button>
        </div>
      </div>

      <!-- Tasks section -->
      <div class="ae-tasks-section">
        <div class="ae-tasks-header">
          <div class="ae-tasks-tabs">
            <button class="ae-tasks-tab" [class.active]="taskTab === 'tasks'" (click)="taskTab = 'tasks'; loadTasks()">✅ Tâches <span class="ae-task-count">{{ tasks.length }}</span></button>
            <button class="ae-tasks-tab" [class.active]="taskTab === 'scheduled'" (click)="taskTab = 'scheduled'; loadScheduled()">⏰ Planifié <span class="ae-task-count">{{ scheduledTasks.length }}</span></button>
          </div>
          <button class="ae-add-btn" (click)="taskTab === 'tasks' ? showNewTask = !showNewTask : showNewScheduled = !showNewScheduled">+</button>
        </div>

        <!-- New task form -->
        <div *ngIf="showNewTask && taskTab === 'tasks'" class="ae-new-task-form">
          <input [(ngModel)]="newTask.title" placeholder="Titre de la tâche" class="ae-task-input"/>
          <div class="ae-task-form-row">
            <select [(ngModel)]="newTask.priority" class="ae-task-select">
              <option value="LOW">Basse</option>
              <option value="MEDIUM">Moyenne</option>
              <option value="HIGH">Haute</option>
              <option value="CRITICAL">Critique</option>
            </select>
            <button class="ae-task-save-btn" (click)="saveNewTask()" [disabled]="!newTask.title">Créer</button>
          </div>
        </div>

        <!-- New scheduled form -->
        <div *ngIf="showNewScheduled && taskTab === 'scheduled'" class="ae-new-task-form">
          <input [(ngModel)]="newSched.name" placeholder="Nom de la tâche planifiée" class="ae-task-input"/>
          <textarea [(ngModel)]="newSched.prompt" placeholder="Instruction à l'agent…" class="ae-task-input" rows="2"></textarea>
          <div class="ae-task-form-row">
            <input [(ngModel)]="newSched.cronExpression" placeholder="Cron (ex: 0 9 * * MON)" class="ae-task-input" style="flex:1"/>
            <button class="ae-task-save-btn" (click)="saveNewScheduled()" [disabled]="!newSched.name || !newSched.prompt">Planifier</button>
          </div>
        </div>

        <!-- Tasks list -->
        <div *ngIf="taskTab === 'tasks'" class="ae-task-list">
          <div *ngIf="tasks.length === 0" class="ae-task-empty">Aucune tâche</div>
          <div *ngFor="let t of tasks" class="ae-task-item" [class.done]="t.status === 'DONE'">
            <div class="ae-task-left">
              <button class="ae-task-check" (click)="toggleTaskDone(t)" [class.checked]="t.status === 'DONE'">
                {{ t.status === 'DONE' ? '✓' : '' }}
              </button>
            </div>
            <div class="ae-task-body">
              <span class="ae-task-title">{{ t.title }}</span>
              <div class="ae-task-meta">
                <span class="ae-priority" [class]="'ae-priority--' + t.priority.toLowerCase()">{{ t.priority }}</span>
                <span *ngIf="t.agentGenerated" class="ae-agent-badge">🤖</span>
              </div>
            </div>
            <button class="ae-task-del" (click)="deleteTask(t)">✕</button>
          </div>
        </div>

        <!-- Scheduled list -->
        <div *ngIf="taskTab === 'scheduled'" class="ae-task-list">
          <div *ngIf="scheduledTasks.length === 0" class="ae-task-empty">Aucune tâche planifiée</div>
          <div *ngFor="let s of scheduledTasks" class="ae-task-item">
            <div class="ae-task-body">
              <span class="ae-task-title">{{ s.name }}</span>
              <div class="ae-task-meta">
                <span class="ae-sched-cron">{{ s.cronExpression || 'Une fois' }}</span>
                <span class="ae-sched-next">→ {{ formatDate(s.nextRunAt) }}</span>
                <span class="ae-sched-count">× {{ s.runCount }}</span>
              </div>
            </div>
            <div class="ae-sched-actions">
              <button class="ae-sched-run" (click)="runNow(s)" title="Exécuter maintenant">▶</button>
              <button class="ae-task-del" (click)="deleteScheduled(s)">✕</button>
            </div>
          </div>
        </div>
      </div>

    </div><!-- /ae-right-panel -->

  </div><!-- /ae-dual -->
</div>
  `,
  styles: [`
    :host { display:block; height:calc(100vh - 64px); overflow:hidden; font-family:'Inter',sans-serif; }
    ::-webkit-scrollbar { width:4px; height:4px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:rgba(99,102,241,.3); border-radius:4px; }

    /* ── Wrapper ── */
    .ae-wrap {
      display:flex; flex-direction:column; height:100%;
      background:var(--fp-bg); color:var(--fp-text); overflow:hidden;
    }

    /* ── Dual panel ── */
    .ae-dual { display:flex; flex:1; min-height:0; overflow:hidden; }
    .ae-left-panel { flex:1.4; min-width:0; display:flex; flex-direction:column; overflow:hidden; border-right:1px solid var(--fp-border); }
    .ae-right-panel { width:340px; flex-shrink:0; display:flex; flex-direction:column; overflow:hidden; background:var(--fp-card); }

    /* ── No credential ── */
    .ae-no-cred { display:flex; gap:.75rem; align-items:flex-start; padding:.85rem 1rem; background:rgba(249,115,22,.07); border-bottom:1px solid rgba(249,115,22,.15); font-size:.78rem; color:var(--fp-text-2); }
    .ae-no-cred strong { color:var(--fp-text); display:block; margin-bottom:.2rem; }
    .ae-no-cred p { margin:.1rem 0; }
    .ae-cred-link { color:#f97316; font-weight:700; text-decoration:none; }
    .ae-cred-link:hover { text-decoration:underline; }

    /* ── Chat ── */
    .ae-chat-section { display:flex; flex-direction:column; flex:1; min-height:0; border-bottom:1px solid var(--fp-border); }
    .ae-chat-header { display:flex; align-items:center; justify-content:space-between; padding:.6rem 1rem; border-bottom:1px solid var(--fp-border); flex-shrink:0; }
    .ae-chat-title { font-size:.82rem; font-weight:700; color:var(--fp-text); }
    .ae-clear-btn { background:none; border:none; color:var(--fp-text-2); cursor:pointer; font-size:.9rem; transition:.15s; padding:.25rem; }
    .ae-clear-btn:hover { color:var(--fp-text); }

    .ae-chat-messages { flex:1; overflow-y:auto; padding:.75rem; display:flex; flex-direction:column; gap:.65rem; }
    .ae-chat-empty { text-align:center; color:var(--fp-text-2); font-size:.75rem; margin:auto; display:flex; flex-direction:column; align-items:center; gap:.5rem; padding:1rem; }
    .ae-chat-empty span { font-size:2rem; }
    .ae-chat-empty p { line-height:1.7; }
    .ae-chat-msg { display:flex; flex-direction:column; gap:.18rem; }
    .ae-chat-msg--user { align-items:flex-end; }
    .ae-chat-msg--assistant { align-items:flex-start; }
    .ae-chat-bubble { display:flex; align-items:flex-start; gap:.4rem; max-width:90%; }
    .ae-bubble-icon { font-size:.85rem; flex-shrink:0; margin-top:.1rem; }
    .ae-bubble-text { font-size:.78rem; line-height:1.65; padding:.5rem .75rem; border-radius:12px; white-space:pre-wrap; word-break:break-word; }
    .ae-chat-msg--user    .ae-bubble-text { background:#6366f1; color:#fff; border-radius:12px 12px 3px 12px; }
    .ae-chat-msg--assistant .ae-bubble-text { background:var(--fp-card-2); color:var(--fp-text); border-radius:12px 12px 12px 3px; border:1px solid var(--fp-border); }
    .ae-bubble-text.streaming { opacity:.85; }
    .ae-chat-ts { font-size:.58rem; color:var(--fp-text-3); padding:0 .35rem; }

    .ae-chat-input-row { display:flex; gap:.4rem; padding:.6rem; border-top:1px solid var(--fp-border); flex-shrink:0; }
    .ae-chat-input { flex:1; background:var(--fp-card-2); border:1px solid var(--fp-border); border-radius:10px; padding:.5rem .7rem; font-size:.78rem; color:var(--fp-text); resize:none; outline:none; font-family:'Inter',sans-serif; }
    .ae-chat-input:focus { border-color:#6366f1; }
    .ae-chat-input::placeholder { color:var(--fp-text-3); }
    .ae-chat-send { width:34px; height:34px; border-radius:9px; border:none; background:#6366f1; color:#fff; cursor:pointer; font-size:.85rem; display:flex; align-items:center; justify-content:center; transition:.15s; flex-shrink:0; align-self:flex-end; }
    .ae-chat-send:hover:not(:disabled) { background:#4f46e5; }
    .ae-chat-send:disabled { opacity:.5; cursor:not-allowed; }
    .ae-voice-btn { width:34px; height:34px; border-radius:9px; border:1px solid var(--fp-border); background:var(--fp-card-2); color:var(--fp-text-2); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:.15s; flex-shrink:0; align-self:flex-end; }
    .ae-voice-btn:hover:not(:disabled) { background:rgba(99,102,241,.12); color:#818cf8; border-color:rgba(99,102,241,.3); }
    .ae-voice-btn:disabled { opacity:.5; cursor:not-allowed; }
    .ae-voice-btn--active { background:rgba(239,68,68,.12); color:#ef4444; border-color:rgba(239,68,68,.3); animation:pulse .8s ease infinite; }

    /* ── Tasks ── */
    .ae-tasks-section { display:flex; flex-direction:column; max-height:320px; min-height:200px; overflow:hidden; }
    .ae-tasks-header { display:flex; align-items:center; justify-content:space-between; padding:.45rem .75rem; border-bottom:1px solid var(--fp-border); flex-shrink:0; }
    .ae-tasks-tabs { display:flex; gap:.3rem; }
    .ae-tasks-tab { background:none; border:none; font-size:.72rem; font-weight:600; color:var(--fp-text-2); cursor:pointer; padding:.25rem .55rem; border-radius:7px; transition:.15s; }
    .ae-tasks-tab.active { background:rgba(99,102,241,.1); color:#818cf8; }
    .ae-task-count { font-size:.62rem; background:rgba(255,255,255,.08); padding:.05rem .28rem; border-radius:8px; margin-left:.25rem; }
    .ae-add-btn { width:24px; height:24px; border-radius:6px; border:1px solid var(--fp-border); background:var(--fp-card-2); color:var(--fp-text); font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; line-height:1; }

    .ae-new-task-form { padding:.5rem .75rem; display:flex; flex-direction:column; gap:.35rem; border-bottom:1px solid var(--fp-border); flex-shrink:0; }
    .ae-task-input { background:var(--fp-card-2); border:1px solid var(--fp-border); border-radius:8px; padding:.4rem .65rem; font-size:.76rem; color:var(--fp-text); outline:none; font-family:'Inter',sans-serif; width:100%; resize:none; }
    .ae-task-input:focus { border-color:#6366f1; }
    .ae-task-input::placeholder { color:var(--fp-text-3); }
    .ae-task-form-row { display:flex; gap:.35rem; }
    .ae-task-select { flex:1; background:var(--fp-card-2); border:1px solid var(--fp-border); border-radius:8px; padding:.38rem .5rem; font-size:.74rem; color:var(--fp-text); outline:none; }
    .ae-task-save-btn { background:#6366f1; color:#fff; border:none; border-radius:8px; padding:.38rem .75rem; font-size:.74rem; font-weight:700; cursor:pointer; }
    .ae-task-save-btn:disabled { opacity:.5; cursor:not-allowed; }

    .ae-task-list { flex:1; overflow-y:auto; padding:.4rem .5rem; display:flex; flex-direction:column; gap:.3rem; }
    .ae-task-empty { font-size:.74rem; color:var(--fp-text-3); text-align:center; padding:1rem; }
    .ae-task-item { display:flex; align-items:center; gap:.5rem; padding:.4rem .5rem; border-radius:8px; background:var(--fp-card-2); border:1px solid transparent; transition:.12s; }
    .ae-task-item:hover { border-color:var(--fp-border); }
    .ae-task-item.done { opacity:.5; }
    .ae-task-left { flex-shrink:0; }
    .ae-task-check { width:18px; height:18px; border:1.5px solid var(--fp-border); border-radius:5px; background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:.65rem; color:#10b981; transition:.12s; }
    .ae-task-check.checked { background:#10b981; border-color:#10b981; color:#fff; }
    .ae-task-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:.12rem; }
    .ae-task-title { font-size:.74rem; font-weight:600; color:var(--fp-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ae-task-meta { display:flex; align-items:center; gap:.35rem; }
    .ae-priority { font-size:.6rem; font-weight:700; padding:.07rem .32rem; border-radius:4px; text-transform:uppercase; }
    .ae-priority--low      { background:rgba(148,163,184,.1); color:#94a3b8; }
    .ae-priority--medium   { background:rgba(59,130,246,.1);  color:#3b82f6; }
    .ae-priority--high     { background:rgba(245,158,11,.1);  color:#f59e0b; }
    .ae-priority--critical { background:rgba(239,68,68,.1);   color:#ef4444; }
    .ae-agent-badge { font-size:.65rem; }
    .ae-task-del { background:none; border:none; color:var(--fp-text-3); cursor:pointer; font-size:.72rem; padding:.15rem; opacity:0; transition:.12s; }
    .ae-task-item:hover .ae-task-del { opacity:1; }
    .ae-sched-actions { display:flex; gap:.25rem; }
    .ae-sched-run { background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.2); color:#10b981; border-radius:5px; padding:.18rem .45rem; font-size:.68rem; cursor:pointer; }
    .ae-sched-cron { font-size:.62rem; color:var(--fp-text-3); font-family:monospace; }
    .ae-sched-next { font-size:.62rem; color:#818cf8; }
    .ae-sched-count { font-size:.6rem; color:var(--fp-text-3); }

    /* ── Header ── */
    .ae-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:.7rem 1.5rem; flex-shrink:0;
      background:var(--fp-card);
      border-bottom:1px solid var(--fp-border);
    }
    .ae-header-left  { display:flex; align-items:center; gap:.75rem; }
    .ae-header-right { display:flex; align-items:center; gap:.5rem; }
    .ae-avatar {
      width:38px; height:38px; border-radius:11px; flex-shrink:0;
      background:linear-gradient(135deg,#4f46e5,#7c3aed);
      display:flex; align-items:center; justify-content:center; font-size:1.15rem;
    }
    .ae-title-block  { display:flex; flex-direction:column; gap:1px; }
    .ae-title        { font-size:.95rem; font-weight:800; color:var(--fp-text); margin:0; line-height:1.2; }
    .ae-subtitle     { font-size:.68rem; color:var(--fp-text-2); margin:0; }

    .ae-demo-badge   { font-size:.65rem; color:var(--fp-text-2); padding:.2rem .5rem; background:var(--fp-input); border-radius:6px; border:1px solid var(--fp-border); }
    .ae-connect-btn  {
      display:flex; align-items:center; gap:.4rem;
      background:linear-gradient(135deg,#4285f4,#2563eb); color:#fff;
      border:none; border-radius:8px; padding:.38rem .8rem;
      font-size:.73rem; font-weight:700; cursor:pointer; transition:.15s;
    }
    .ae-connect-btn:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); }
    .ae-connect-btn:disabled { opacity:.4; cursor:not-allowed; }

    .ae-gmail-status { display:flex; align-items:center; gap:.4rem; }
    .ae-gmail-dot    { width:7px; height:7px; border-radius:50%; background:#10b981; flex-shrink:0; animation:pulse 2s ease infinite; }
    .ae-gmail-addr   { font-size:.7rem; color:#6ee7b7; font-weight:600; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .ae-icon-btn     { width:30px; height:30px; border:1px solid var(--fp-border); border-radius:8px; background:var(--fp-input); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:.85rem; transition:.15s; color:var(--fp-text-2); }
    .ae-icon-btn:hover { background:rgba(255,255,255,.1); color:var(--fp-text); }
    .ae-icon-btn:disabled { opacity:.4; cursor:not-allowed; }
    .ae-icon-btn--disc:hover { background:rgba(239,68,68,.15); color:#f87171; border-color:rgba(239,68,68,.2); }

    /* ── Stats ── */
    .ae-stats-bar {
      display:flex; align-items:center; gap:1.25rem;
      padding:.65rem 1.5rem; flex-shrink:0;
      background:var(--fp-card);
      border-bottom:1px solid var(--fp-border);
    }
    .ae-stat         { display:flex; align-items:center; gap:.55rem; }
    .ae-donut        { width:38px; height:38px; flex-shrink:0; }
    .ae-stat-icon    { font-size:1.5rem; }
    .ae-stat-info    { display:flex; flex-direction:column; gap:1px; }
    .ae-stat-num     { font-size:1.2rem; font-weight:900; line-height:1; font-family:'Outfit',sans-serif; }
    .ae-stat-num--urgent { color:#ef4444; }
    .ae-stat-num--unread { color:#818cf8; }
    .ae-stat-num--total  { color:#6ee7b7; }
    .ae-stat-lbl     { font-size:.62rem; color:var(--fp-text-2); text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
    .ae-stats-actions { margin-left:auto; }
    .ae-analyze-btn  {
      display:flex; align-items:center; gap:.35rem;
      background:rgba(99,102,241,.15); border:1px solid rgba(99,102,241,.3); color:#a5b4fc;
      font-size:.72rem; font-weight:700; padding:.35rem .8rem; border-radius:8px; cursor:pointer; transition:.15s;
    }
    .ae-analyze-btn:hover:not(:disabled) { background:rgba(99,102,241,.25); }
    .ae-analyze-btn:disabled { opacity:.4; cursor:not-allowed; }

    /* ── Filters ── */
    .ae-filters {
      display:flex; gap:.3rem; padding:.5rem 1.5rem; flex-shrink:0;
      background:var(--fp-card);
      border-bottom:1px solid var(--fp-border);
      overflow-x:auto; -webkit-overflow-scrolling:touch;
    }
    .ae-filter {
      display:flex; align-items:center; gap:.3rem;
      background:none; border:1px solid transparent;
      color:var(--fp-text-2); font-size:.72rem; font-weight:600;
      padding:.28rem .65rem; border-radius:20px; cursor:pointer;
      white-space:nowrap; transition:.15s;
    }
    .ae-filter:hover { background:var(--fp-input); color:var(--fp-text); }
    .ae-filter--active {
      background:rgba(99,102,241,.12);
      border-color:rgba(99,102,241,.3);
      color:var(--fc, #818cf8);
    }
    .ae-filter-n {
      font-size:.62rem; font-weight:800;
      background:var(--fp-input); padding:.05rem .3rem; border-radius:10px;
    }

    /* ── Email List ── */
    .ae-list { flex:1; overflow-y:auto; overflow-x:hidden; }

    /* States */
    .ae-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.75rem; padding:3rem 2rem; text-align:center; }
    .ae-state--loading { color:var(--fp-text-2); font-size:.8rem; font-style:italic; }
    .ae-state--error   { color:#f87171; font-size:.8rem; }
    .ae-state--empty   { color:var(--fp-text-3); font-size:.8rem; }
    .ae-empty-icon { font-size:2.5rem; }
    .ae-reconnect-btn { background:rgba(99,102,241,.12); border:1px solid rgba(99,102,241,.3); color:#a5b4fc; font-size:.7rem; font-weight:700; padding:.3rem .7rem; border-radius:7px; cursor:pointer; transition:.15s; }
    .ae-reconnect-btn:hover { background:rgba(99,102,241,.2); }

    /* Accordion item */
    .ae-item { border-bottom:1px solid var(--fp-border); transition:background .12s; }
    .ae-item--expanded { background:rgba(99,102,241,.04); }
    .ae-item--urgent > .ae-row  { border-left:3px solid rgba(239,68,68,.55); }
    .ae-item--unread  > .ae-row { background:rgba(99,102,241,.035); }

    /* Row */
    .ae-row {
      display:flex; align-items:center; gap:.75rem;
      padding:.8rem 1.25rem .8rem 1rem;
      cursor:pointer; transition:background .1s;
    }
    .ae-row:hover { background:rgba(255,255,255,.025); }
    .ae-item--expanded > .ae-row { background:rgba(99,102,241,.07); }

    .ae-arrow { font-size:1.1rem; color:var(--fp-text-3); transition:transform .2s; font-weight:700; flex-shrink:0; line-height:1; }
    .ae-arrow--open { transform:rotate(90deg); color:#818cf8; }
    .ae-av { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:.88rem; font-weight:800; flex-shrink:0; }
    .ae-row-body  { flex:1; min-width:0; display:flex; flex-direction:column; gap:.1rem; }
    .ae-row-top   { display:flex; justify-content:space-between; align-items:baseline; gap:.5rem; }
    .ae-from      { font-size:.78rem; font-weight:500; color:var(--fp-text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ae-from--unread { color:var(--fp-text); font-weight:700; }
    .ae-date      { font-size:.62rem; color:var(--fp-text-3); flex-shrink:0; }
    .ae-subject   { font-size:.75rem; color:var(--fp-text-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ae-subject--unread { color:var(--fp-text); font-weight:700; }
    .ae-preview   { font-size:.67rem; color:var(--fp-text-3); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ae-row-meta  { display:flex; flex-direction:column; align-items:flex-end; gap:.3rem; flex-shrink:0; }
    .ae-cat-icon  { font-size:.85rem; }
    .ae-dot       { width:7px; height:7px; border-radius:50%; background:#6366f1; }

    /* Expanded body */
    .ae-body {
      padding:.85rem 1.25rem .85rem 1rem;
      border-top:1px solid rgba(255,255,255,.04);
      background:var(--fp-card-2);
    }
    .ae-meta-line {
      display:flex; flex-wrap:wrap; gap:.4rem; align-items:center;
      font-size:.7rem; color:var(--fp-text-2); margin-bottom:.75rem; padding-bottom:.65rem;
      border-bottom:1px solid var(--fp-border);
    }
    .ae-meta-line strong { color:var(--fp-text-2); font-weight:600; }
    .ae-meta-sep { color:#1e293b; }
    .ae-content {
      font-size:.82rem; color:var(--fp-text-2); line-height:1.72;
      white-space:pre-wrap; word-break:break-word;
      background:rgba(0,0,0,.18); border-radius:10px;
      padding:.9rem 1rem; margin-bottom:.75rem;
      border-left:3px solid rgba(99,102,241,.25);
    }
    .ae-content p { margin:0 0 .35rem; }
    .ae-content p:last-child { margin:0; }

    /* Gérer */
    .ae-gerer-row { display:flex; align-items:center; gap:.5rem; margin-bottom:.5rem; }
    .ae-gerer-btn {
      display:inline-flex; align-items:center; gap:.4rem;
      background:rgba(99,102,241,.12); border:1px solid rgba(99,102,241,.25); color:#a5b4fc;
      font-size:.73rem; font-weight:700; padding:.32rem .75rem; border-radius:8px; cursor:pointer; transition:.15s;
    }
    .ae-gerer-btn:hover { background:rgba(99,102,241,.2); }
    .ae-gerer-chevron { transition:transform .2s; display:inline-block; font-size:.7rem; }
    .ae-gerer-chevron--open { transform:rotate(180deg); }
    .ae-send-quick-btn {
      display:inline-flex; align-items:center; gap:.35rem;
      background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.25); color:#6ee7b7;
      font-size:.72rem; font-weight:700; padding:.32rem .75rem; border-radius:8px; cursor:pointer; transition:.15s;
    }
    .ae-send-quick-btn:hover:not(:disabled) { background:rgba(16,185,129,.22); }
    .ae-send-quick-btn:disabled { opacity:.5; cursor:not-allowed; }

    /* IA Panel */
    .ae-ia {
      background:var(--fp-card-2); border:1px solid rgba(99,102,241,.18);
      border-radius:12px; overflow:hidden; margin-top:.35rem;
    }
    .ae-ia-tabs { display:flex; border-bottom:1px solid var(--fp-border); }
    .ae-ia-tab {
      flex:1; background:none; border:none; border-bottom:2px solid transparent;
      color:var(--fp-text-2); font-size:.71rem; font-weight:700; padding:.5rem .4rem;
      cursor:pointer; transition:.15s;
    }
    .ae-ia-tab:hover { color:var(--fp-text-2); background:var(--fp-input); }
    .ae-ia-tab--active { color:#a5b4fc; border-bottom-color:#6366f1; background:rgba(99,102,241,.06); }

    .ae-ia-content { padding:1rem; min-height:100px; display:flex; flex-direction:column; justify-content:center; }
    .ae-ia-empty  { display:flex; flex-direction:column; align-items:center; gap:.6rem; text-align:center; }
    .ae-ia-desc   { font-size:.76rem; color:var(--fp-text-2); }
    .ae-run-btn   {
      display:inline-flex; align-items:center; gap:.4rem;
      background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff;
      border:none; border-radius:9px; padding:.45rem 1rem;
      font-size:.76rem; font-weight:700; cursor:pointer; transition:.15s;
    }
    .ae-run-btn:hover { opacity:.88; transform:translateY(-1px); }

    .ae-ia-loading { display:flex; flex-direction:column; align-items:center; gap:.6rem; color:var(--fp-text-2); font-size:.76rem; font-style:italic; }

    .ae-ia-result { display:flex; flex-direction:column; gap:.6rem; }
    .ae-ia-result-top { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:.35rem; }
    .ae-ia-result-label { font-size:.68rem; font-weight:800; color:#a5b4fc; text-transform:uppercase; letter-spacing:.05em; }
    .ae-ia-actions { display:flex; gap:.3rem; }
    .ae-action-btn {
      font-size:.65rem; font-weight:700; padding:.18rem .45rem; border-radius:6px; cursor:pointer; transition:.15s; border:1px solid;
    }
    .ae-action-btn--copy { background:var(--fp-input); border-color:rgba(255,255,255,.08); color:var(--fp-text-2); }
    .ae-action-btn--copy:hover { color:#a5b4fc; border-color:rgba(99,102,241,.3); }
    .ae-action-btn--regen { background:rgba(16,185,129,.08); border-color:rgba(16,185,129,.2); color:#6ee7b7; }
    .ae-action-btn--regen:hover { background:rgba(16,185,129,.15); }
    .ae-ia-text {
      font-size:.8rem; color:var(--fp-text); line-height:1.72;
      background:rgba(0,0,0,.2); border-radius:8px; padding:.75rem .9rem;
      border-left:3px solid #6366f1; white-space:pre-wrap; word-break:break-word;
    }

    /* Spinners & animations */
    .ae-spinner    { width:26px; height:26px; border:3px solid rgba(99,102,241,.15); border-top-color:#6366f1; border-radius:50%; animation:spin .7s linear infinite; }
    .ae-spin-sm    { width:12px; height:12px; border:2px solid rgba(165,180,252,.3); border-top-color:#a5b4fc; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; vertical-align:middle; }
    .ae-cursor     { display:inline-block; width:2px; margin-left:1px; animation:blink .8s step-end infinite; color:#6366f1; }

    @keyframes spin  { to { transform:rotate(360deg) } }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    /* Responsive */
    @media(max-width:768px) {
      .ae-header { padding:.6rem 1rem; }
      .ae-stats-bar { padding:.5rem 1rem; gap:.85rem; }
      .ae-filters { padding:.45rem 1rem; }
      .ae-row { padding:.7rem 1rem .7rem .75rem; }
      .ae-body { padding:.75rem 1rem .75rem .75rem; }
      .ae-gmail-addr { max-width:130px; }
    }
    @media(max-width:480px) {
      .ae-stat--total { display:none; }
      .ae-filter span:first-child { display:none; }
    }
  `]
})
export class AgentEmailComponent implements OnInit {

  @ViewChild('chatContainer') chatContainer!: ElementRef;

  constructor(
    private agentSvc:      AgentService,
    public  gmailSvc:      GmailService,
    private agentEmailSvc: AgentEmailService,
    private cdr:           ChangeDetectorRef,
    private dialog:        DialogService
  ) {}

  readonly CAT = CAT_CONFIG;

  // ── Chat state ────────────────────────────────────────────────────────────
  chatMessages: ChatMsg[] = [];
  chatInput    = '';
  isStreaming  = false;
  hasGroqKey   = false;
  voiceActive  = false;
  private recognition: any;
  get lastMsg(): ChatMsg | undefined { return this.chatMessages[this.chatMessages.length - 1]; }

  // ── Task state ────────────────────────────────────────────────────────────
  tasks:          AgentTask[]    = [];
  scheduledTasks: ScheduledTask[] = [];
  taskTab         = 'tasks';
  showNewTask     = false;
  showNewScheduled = false;
  newTask         = { title: '', priority: 'MEDIUM', description: '' };
  newSched        = { name: '', prompt: '', cronExpression: '' };

  // ── Email state ───────────────────────────────────────────────────────────
  expandedId: string | null = null;
  showGerer   = false;
  activeFilter = 'all';
  activeTab    = 'summary';
  iaResult     = '';
  iaLoading    = false;
  iaStreaming  = false;
  analyzing    = false;
  copied       = false;
  sending      = false;

  readonly categories = [
    { id:'all',        label:'Tous',       icon:'📬', color:'#818cf8' },
    { id:'urgent',     label:'Urgents',    icon:'🔴', color:'#ef4444' },
    { id:'work',       label:'Travail',    icon:'💼', color:'#6366f1' },
    { id:'commercial', label:'Commercial', icon:'💰', color:'#10b981' },
    { id:'info',       label:'Info',       icon:'ℹ️', color:'#0ea5e9' },
    { id:'spam',       label:'Spam',       icon:'🗑️', color:'#94a3b8' },
  ];

  readonly tabs = [
    { id:'summary', icon:'📝', label:'Résumer',  desc:'L\'IA résume l\'email en points clés.' },
    { id:'reply',   icon:'✉️',  label:'Répondre', desc:'L\'IA génère une réponse professionnelle.' },
    { id:'task',    icon:'✅', label:'Tâches',   desc:'L\'IA extrait les actions à réaliser.' },
    { id:'urgency', icon:'🚨', label:'Urgence',  desc:'L\'IA évalue le niveau d\'urgence.' },
  ];

  // ── Getters ───────────────────────────────────────────────────────────────
  get userCtx()       { return this.agentSvc.getUserContext(); }
  get currentTab()    { return this.tabs.find(t => t.id === this.activeTab); }
  get firstName()     { return this.userCtx.name.split(' ')[0]; }

  get selectedEmail(): GmailEmail | null {
    return this.expandedId
      ? this.filteredEmails.find(e => e.id === this.expandedId) ?? null
      : null;
  }

  get displayEmails(): GmailEmail[] {
    const real = this.gmailSvc.emails();
    return (this.gmailSvc.status().connected || real.length > 0) ? real : SAMPLE_EMAILS;
  }

  get filteredEmails(): GmailEmail[] {
    const emails = this.displayEmails;
    return this.activeFilter === 'all' ? emails : emails.filter(e => e.category === this.activeFilter);
  }

  get unreadCount() { return this.displayEmails.filter(e => !e.read).length; }
  get urgentCount() { return this.displayEmails.filter(e => e.category === 'urgent').length; }

  countByCat(id: string) {
    const e = this.displayEmails;
    return id === 'all' ? e.length : e.filter(x => x.category === id).length;
  }

  donutDash(count: number, total: number): string {
    const circ = 87.96; // 2 * π * 14
    const pct  = total > 0 ? (count / total) : 0;
    const fill = Math.max(pct * circ, pct > 0 ? 4 : 0);
    return `${fill.toFixed(1)} ${circ}`;
  }

  formatDate(date: string): string {
    if (!date) return '—';
    if (date.length < 20) return date;
    try {
      return new Date(date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
    } catch { return date.substring(0, 16); }
  }

  getBodyLines(email: GmailEmail): string[] {
    return (email.body || email.snippet || '').split('\n');
  }

  trackById(_: number, e: GmailEmail) { return e.id; }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  async ngOnInit() {
    // Check Groq credential
    const creds = await this.agentEmailSvc.getCredentials().catch(() => []);
    this.hasGroqKey = creds.some((c: any) => c.provider === 'groq' && c.active);

    // Load tasks and scheduled tasks
    this.loadTasks();
    this.loadScheduled();

    // Gmail OAuth return check
    const oauthReturn = this.gmailSvc.parseOAuthReturn();
    if (oauthReturn.success) {
      if (oauthReturn.email) {
        this.gmailSvc.status.set({ connected:true, gmailEmail:oauthReturn.email, connectedAt:new Date().toISOString() });
        this.cdr.detectChanges();
      }
      await this.gmailSvc.checkStatus();
      await this.loadGmailEmails();
      return;
    }
    if (oauthReturn.error) this.dialog.alert('Erreur Gmail OAuth : ' + oauthReturn.error, 'Gmail OAuth', 'error');

    const status = await this.gmailSvc.checkStatus();
    if (status.connected) await this.loadGmailEmails();
  }

  // ── Gmail ─────────────────────────────────────────────────────────────────
  async connectGmail() {
    try { await this.gmailSvc.connectGmail(); }
    catch (e: any) { this.dialog.alert('Erreur : ' + e.message, 'Connexion Gmail', 'error'); }
  }

  async loadGmailEmails() {
    await this.gmailSvc.loadEmails(30, 'INBOX');
    this.cdr.detectChanges();
  }

  async disconnect() {
    const ok = await this.dialog.confirm('Déconnecter Gmail ?', 'Déconnexion', 'Déconnecter', 'Annuler');
    if (!ok) return;
    await this.gmailSvc.disconnect();
    this.expandedId = null;
    this.showGerer  = false;
    this.cdr.detectChanges();
  }

  // ── Accordion ─────────────────────────────────────────────────────────────
  async toggleExpand(email: GmailEmail) {
    if (this.expandedId === email.id) {
      this.expandedId = null;
      this.showGerer  = false;
      return;
    }
    this.expandedId = email.id;
    this.showGerer  = false;
    this.clearResult();
    this.activeTab = 'summary';
    if (this.gmailSvc.status().connected) {
      if (!email.body) {
        const body = await this.gmailSvc.loadEmailBody(email.id);
        const idx = this.gmailSvc.emails().findIndex(e => e.id === email.id);
        if (idx !== -1) {
          const updated = [...this.gmailSvc.emails()];
          updated[idx] = { ...updated[idx], body };
          this.gmailSvc.emails.set(updated);
        }
      }
      if (!email.read) this.gmailSvc.markRead(email.id);
    }
    this.cdr.detectChanges();
  }

  toggleGerer(e: Event, _email: GmailEmail) {
    e.stopPropagation();
    this.showGerer = !this.showGerer;
    if (this.showGerer) this.clearResult();
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  setFilter(id: string) {
    this.activeFilter = id;
    this.expandedId   = null;
    this.showGerer    = false;
    this.cdr.detectChanges();
  }

  switchTab(id: string) { this.activeTab = id; this.clearResult(); }
  clearResult() { this.iaResult = ''; this.iaLoading = false; this.iaStreaming = false; }

  // ── IA ────────────────────────────────────────────────────────────────────
  async runIA() {
    if (!this.selectedEmail) return;
    this.iaLoading = true; this.iaStreaming = false; this.iaResult = '';
    await this.agentSvc.streamAgent(
      'email',
      this.selectedEmail.body || this.selectedEmail.snippet,
      this.activeTab,
      `De: ${this.selectedEmail.from} <${this.selectedEmail.fromEmail}> — Sujet: ${this.selectedEmail.subject}`,
      {
        onChunk: (chunk) => {
          if (this.iaLoading) { this.iaLoading = false; this.iaStreaming = true; }
          this.iaResult += chunk;
          this.cdr.detectChanges();
        },
        onDone: () => { this.iaLoading = false; this.iaStreaming = false; this.cdr.detectChanges(); },
        onError: () => {
          this.iaResult   = this.agentSvc.getMock('email', this.activeTab, this.selectedEmail!.body);
          this.iaLoading  = false; this.iaStreaming = false;
          this.cdr.detectChanges();
        },
      }
    );
  }

  async analyzeAll() {
    if (!this.filteredEmails.length) return;
    this.analyzing = true;
    const email = this.filteredEmails.find(e => !e.read) ?? this.filteredEmails[0];
    await this.toggleExpand(email);
    this.showGerer = true;
    await this.runIA();
    this.analyzing = false;
  }

  async sendReply() {
    if (!this.selectedEmail || !this.iaResult) return;
    this.sending = true;
    const ok = await this.gmailSvc.sendEmail({
      to:       this.selectedEmail.fromEmail,
      subject:  'Re: ' + this.selectedEmail.subject,
      body:     this.iaResult,
      threadId: this.selectedEmail.threadId,
    });
    this.sending = false;
    if (ok) this.dialog.alert('Réponse envoyée via Gmail !', 'Envoi', 'success');
    else    this.dialog.alert('Erreur lors de l\'envoi de la réponse.', 'Erreur', 'error');
  }

  async copyResult() {
    await navigator.clipboard.writeText(this.iaResult).catch(() => {});
    this.copied = true;
    setTimeout(() => { this.copied = false; this.cdr.detectChanges(); }, 2000);
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { this.dialog.alert('Votre navigateur ne supporte pas la reconnaissance vocale.\nUtilisez Chrome ou Edge.', 'Commande vocale', 'warning'); return; }
    if (this.voiceActive) {
      this.recognition?.stop();
      this.voiceActive = false;
      this.cdr.detectChanges();
      return;
    }
    this.recognition = new SR();
    this.recognition.lang = 'fr-FR';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.voiceActive = true;
    this.cdr.detectChanges();
    this.recognition.start();
    this.recognition.onresult = (event: any) => {
      this.chatInput  = event.results[0][0].transcript;
      this.voiceActive = false;
      this.cdr.detectChanges();
    };
    this.recognition.onerror = () => { this.voiceActive = false; this.cdr.detectChanges(); };
    this.recognition.onend   = () => { this.voiceActive = false; this.cdr.detectChanges(); };
  }

  onChatEnter(e: Event) {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) { ke.preventDefault(); this.sendChat(); }
  }

  sendChat() {
    const msg = this.chatInput.trim();
    if (!msg || this.isStreaming) return;

    this.chatMessages.push({ role: 'user', content: msg, ts: new Date() });
    this.chatInput  = '';
    this.isStreaming = true;
    const assistant: ChatMsg = { role: 'assistant', content: '', ts: new Date() };
    this.chatMessages.push(assistant);
    this.cdr.detectChanges();
    this.scrollChat();

    this.agentEmailSvc.chatStream(
      msg,
      (chunk) => {
        assistant.content += chunk;
        this.cdr.detectChanges();
        this.scrollChat();
      },
      () => {
        this.isStreaming = false;
        this.loadTasks(); // refresh tasks (agent may have created some)
        this.cdr.detectChanges();
      },
      (err) => {
        assistant.content = '⚠️ ' + err;
        this.isStreaming = false;
        this.cdr.detectChanges();
      }
    );
  }

  async clearChat() {
    await this.agentEmailSvc.clearMemory();
    this.chatMessages = [];
    this.cdr.detectChanges();
  }

  private scrollChat() {
    setTimeout(() => {
      if (this.chatContainer?.nativeElement)
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    }, 50);
  }

  formatChatTime(d: Date): string {
    return d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  async loadTasks() {
    this.tasks = await this.agentEmailSvc.getTasks().catch(() => []);
    this.cdr.detectChanges();
  }

  async loadScheduled() {
    this.scheduledTasks = await this.agentEmailSvc.getScheduled().catch(() => []);
    this.cdr.detectChanges();
  }

  async saveNewTask() {
    if (!this.newTask.title) return;
    await this.agentEmailSvc.createTask({
      title: this.newTask.title,
      priority: this.newTask.priority as AgentTask['priority'],
      description: this.newTask.description
    });
    this.newTask = { title: '', priority: 'MEDIUM', description: '' };
    this.showNewTask = false;
    this.loadTasks();
  }

  async saveNewScheduled() {
    if (!this.newSched.name || !this.newSched.prompt) return;
    await this.agentEmailSvc.createScheduled(this.newSched);
    this.newSched = { name: '', prompt: '', cronExpression: '' };
    this.showNewScheduled = false;
    this.loadScheduled();
  }

  async toggleTaskDone(task: AgentTask) {
    const next = task.status === 'DONE' ? 'TODO' : 'DONE';
    await this.agentEmailSvc.updateTaskStatus(task.id, next);
    this.loadTasks();
  }

  async deleteTask(task: AgentTask) {
    await this.agentEmailSvc.deleteTask(task.id);
    this.loadTasks();
  }

  async runNow(task: ScheduledTask) {
    await this.agentEmailSvc.runScheduledNow(task.id);
  }

  async deleteScheduled(task: ScheduledTask) {
    await this.agentEmailSvc.deleteScheduled(task.id);
    this.loadScheduled();
  }
}
