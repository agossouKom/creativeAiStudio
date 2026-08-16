import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentEmailService, CredentialResponse } from '../../services/agent-email.service';

@Component({
  selector: 'app-api-credentials',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="cred-page">
  <div class="cred-wrap">

    <!-- Header -->
    <div class="cred-header">
      <div class="cred-header-left">
        <div class="cred-icon">🔑</div>
        <div>
          <h1 class="cred-title">Clés API</h1>
          <p class="cred-sub">Gérez vos clés API pour les agents IA. Chiffrées AES-256 côté serveur.</p>
        </div>
      </div>
    </div>

    <!-- Groq API Key Form -->
    <div class="cred-card">
      <div class="cred-card-header">
        <div class="cred-provider-badge cred-provider-badge--groq">
          <span>⚡</span> Groq
        </div>
        <span class="cred-provider-desc">Modèle LLM ultra-rapide pour l'Agent Email (llama-3.3-70b)</span>
      </div>

      <div *ngIf="groqCred" class="cred-existing">
        <div class="cred-masked-row">
          <span class="cred-masked-key">{{ groqCred.maskedKey }}</span>
          <span class="cred-status cred-status--ok">✓ Configurée</span>
          <span *ngIf="groqCred.lastUsedAt" class="cred-last-used">Dernière utilisation : {{ formatDate(groqCred.lastUsedAt) }}</span>
        </div>
        <button class="cred-btn cred-btn--danger" (click)="confirmDelete()">Supprimer</button>
      </div>

      <div class="cred-form">
        <label class="cred-label">{{ groqCred ? 'Remplacer la clé Groq' : 'Clé API Groq' }}</label>
        <div class="cred-input-row">
          <input [(ngModel)]="groqKey" type="password"
                 placeholder="gsk_••••••••••••••••••••••••••••••••••••••••••••••••"
                 class="cred-input" autocomplete="off"/>
          <button class="cred-btn cred-btn--test" (click)="testGroq()" [disabled]="!groqKey || testing">
            {{ testing ? '...' : '🧪 Tester' }}
          </button>
          <button class="cred-btn cred-btn--save" (click)="saveGroq()" [disabled]="!groqKey || saving">
            {{ saving ? '...' : '💾 Sauvegarder' }}
          </button>
        </div>
        <div *ngIf="testResult" class="cred-test-result" [class.cred-test-result--ok]="testResult.valid" [class.cred-test-result--err]="!testResult.valid">
          {{ testResult.valid ? '✓' : '✗' }} {{ testResult.message }}
        </div>
      </div>
    </div>

    <!-- Security notice -->
    <div class="cred-notice">
      <span class="cred-notice-icon">🛡️</span>
      <div>
        <strong>Sécurité :</strong> vos clés API sont chiffrées avec AES-256-GCM avant d'être stockées en base de données.
        Elles ne sont jamais visibles en clair et ne transitent pas dans les logs.
        Chaque clé est isolée par compte utilisateur.
      </div>
    </div>

    <!-- Where to get Groq key -->
    <div class="cred-help">
      <p>💡 <strong>Obtenir une clé Groq gratuite :</strong>
        <a href="https://console.groq.com/keys" target="_blank" rel="noopener" class="cred-link">
          console.groq.com/keys
        </a>
        — Plan gratuit : 14 400 req/jour, 30 req/min.
      </p>
    </div>

  </div>
</div>

<!-- Modern confirm dialog -->
<div *ngIf="showConfirm" class="cd-backdrop" (click)="showConfirm=false">
  <div class="cd-card" (click)="$event.stopPropagation()">
    <div class="cd-icon">🗑️</div>
    <h3 class="cd-title">Supprimer la clé ?</h3>
    <p class="cd-msg">Cette action est irréversible. Vous devrez reconfigurer la clé Groq pour utiliser les agents.</p>
    <div class="cd-actions">
      <button class="cd-btn cd-btn--cancel" (click)="showConfirm=false">Annuler</button>
      <button class="cd-btn cd-btn--danger" (click)="deleteGroq()">Supprimer</button>
    </div>
  </div>
</div>
  `,
  styles: [`
    .cred-page { min-height: calc(100vh - 64px); background: var(--bg); padding: 2.5rem 1.5rem; }
    .cred-wrap { max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }

    .cred-header { display: flex; align-items: flex-start; gap: 1rem; }
    .cred-header-left { display: flex; align-items: center; gap: 1rem; }
    .cred-icon { font-size: 2rem; }
    .cred-title { font-size: 1.5rem; font-weight: 800; color: var(--text); margin: 0; }
    .cred-sub   { font-size: .85rem; color: var(--text-2); margin: .25rem 0 0; }

    .cred-card  { background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; }
    .cred-card-header { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.25rem; }
    .cred-provider-badge { display: flex; align-items: center; gap: .35rem; font-size: .78rem; font-weight: 800; padding: .25rem .65rem; border-radius: 8px; }
    .cred-provider-badge--groq { background: rgba(249,115,22,.1); color: #f97316; border: 1px solid rgba(249,115,22,.2); }
    .cred-provider-desc { font-size: .78rem; color: var(--text-2); }

    .cred-existing { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; background: var(--surface,rgba(255,255,255,.04)); border-radius: 10px; padding: .75rem 1rem; margin-bottom: 1rem; }
    .cred-masked-row { display: flex; align-items: center; gap: .75rem; flex: 1; flex-wrap: wrap; }
    .cred-masked-key { font-family: monospace; font-size: .82rem; color: var(--text); }
    .cred-status    { font-size: .72rem; font-weight: 700; padding: .18rem .5rem; border-radius: 5px; }
    .cred-status--ok { background: rgba(16,185,129,.1); color: #10b981; }
    .cred-last-used { font-size: .68rem; color: var(--text-3); }

    .cred-form { display: flex; flex-direction: column; gap: .65rem; }
    .cred-label { font-size: .75rem; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: .05em; }
    .cred-input-row { display: flex; gap: .5rem; flex-wrap: wrap; }
    .cred-input { flex: 1; min-width: 200px; padding: .65rem .9rem; border: 1.5px solid var(--input-border); border-radius: 10px; background: var(--input-bg); color: var(--text); font-size: .85rem; outline: none; font-family: monospace; }
    .cred-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }

    .cred-btn { padding: .55rem 1rem; border-radius: 9px; border: none; font-size: .78rem; font-weight: 700; cursor: pointer; transition: .15s; white-space: nowrap; }
    .cred-btn:disabled { opacity: .5; cursor: not-allowed; }
    .cred-btn--test   { background: var(--surface,rgba(255,255,255,.04)); color: var(--text-2); border: 1px solid var(--border); }
    .cred-btn--test:hover:not(:disabled)  { background: var(--border); }
    .cred-btn--save   { background: #6366f1; color: #fff; }
    .cred-btn--save:hover:not(:disabled)  { background: #4f46e5; }
    .cred-btn--danger { background: rgba(239,68,68,.08); color: #ef4444; border: 1px solid rgba(239,68,68,.2); font-size: .72rem; padding: .3rem .65rem; }
    .cred-btn--danger:hover { background: rgba(239,68,68,.15); }

    .cred-test-result { font-size: .78rem; font-weight: 600; padding: .45rem .75rem; border-radius: 8px; }
    .cred-test-result--ok  { background: rgba(16,185,129,.08); color: #10b981; }
    .cred-test-result--err { background: rgba(239,68,68,.08); color: #ef4444; }

    .cred-notice { display: flex; gap: .75rem; background: rgba(99,102,241,.06); border: 1px solid rgba(99,102,241,.15); border-radius: 12px; padding: 1rem 1.25rem; font-size: .82rem; color: var(--text-2); line-height: 1.6; }
    .cred-notice-icon { font-size: 1.25rem; flex-shrink: 0; }
    .cred-help { font-size: .82rem; color: var(--text-2); }
    .cred-link { color: #6366f1; text-decoration: none; font-weight: 600; }
    .cred-link:hover { text-decoration: underline; }

    /* Modern confirm dialog */
    .cd-backdrop {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,.55); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
      animation: cdFade .18s ease;
    }
    @keyframes cdFade { from { opacity:0 } to { opacity:1 } }
    .cd-card {
      background: #0f172a; border: 1px solid rgba(255,255,255,.1);
      border-radius: 20px; padding: 2rem 2rem 1.5rem;
      max-width: 380px; width: 100%; text-align: center;
      box-shadow: 0 24px 60px rgba(0,0,0,.5);
      animation: cdPop .22s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes cdPop { from { opacity:0; transform:scale(.88) } to { opacity:1; transform:scale(1) } }
    .cd-icon  { font-size: 2.5rem; margin-bottom: .75rem; }
    .cd-title { font-size: 1.1rem; font-weight: 700; color: #f1f5f9; margin: 0 0 .5rem; }
    .cd-msg   { font-size: .88rem; color: #94a3b8; margin: 0 0 1.5rem; line-height: 1.5; }
    .cd-actions { display: flex; gap: .75rem; }
    .cd-btn { flex: 1; padding: .6rem 1rem; border-radius: 10px; border: none; font-size: .85rem; font-weight: 600; cursor: pointer; transition: .15s; }
    .cd-btn--cancel { background: rgba(255,255,255,.07); color: #94a3b8; }
    .cd-btn--cancel:hover { background: rgba(255,255,255,.12); color: #f1f5f9; }
    .cd-btn--danger { background: #ef4444; color: #fff; }
    .cd-btn--danger:hover { background: #dc2626; }
  `]
})
export class ApiCredentialsComponent implements OnInit {

  groqKey     = '';
  saving      = false;
  testing     = false;
  showConfirm = false;
  groqCred: CredentialResponse | null = null;
  testResult: { valid: boolean; message: string } | null = null;

  constructor(
    private svc: AgentEmailService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    const creds = await this.svc.getCredentials();
    this.groqCred = creds.find(c => c.provider === 'groq') ?? null;
    this.cdr.detectChanges();
  }

  async saveGroq() {
    if (!this.groqKey) return;
    this.saving = true;
    const ok = await this.svc.saveCredential('groq', this.groqKey, 'Groq API Key');
    if (ok) {
      const creds = await this.svc.getCredentials();
      this.groqCred = creds.find(c => c.provider === 'groq') ?? null;
      this.groqKey  = '';
    }
    this.saving = false;
    this.cdr.detectChanges();
  }

  async testGroq() {
    if (!this.groqKey) return;
    this.testing    = true;
    this.testResult = await this.svc.testCredential('groq', this.groqKey);
    this.testing    = false;
    this.cdr.detectChanges();
  }

  confirmDelete() {
    this.showConfirm = true;
  }

  async deleteGroq() {
    this.showConfirm = false;
    if (!this.groqCred) return;
    await this.svc.deleteCredential(this.groqCred.id);
    this.groqCred = null;
    this.cdr.detectChanges();
  }

  formatDate(iso: string): string {
    try { return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }
    catch { return iso; }
  }
}
