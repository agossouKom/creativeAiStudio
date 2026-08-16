import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../services/agent.service';
import { AgentSessionBarComponent } from '../../shared/components/agent-session-bar/agent-session-bar.component';

interface Prospect {
  id: string;
  name: string;
  title: string;
  company: string;
  sector: string;
  location: string;
  score: number;
  email?: string;
  linkedin?: string;
  status: 'new' | 'contacted' | 'replied' | 'converted';
}

const PROSPECTS: Prospect[] = [
  { id:'1', name:'Sophie Leclerc',   title:'Directrice Marketing',  company:'TechVision SA',    sector:'Tech',     location:'Paris',   score:94, email:'s.leclerc@techvision.fr',   linkedin:'linkedin.com/in/sophie-leclerc',  status:'new' },
  { id:'2', name:'Marc Fontaine',    title:'CEO',                   company:'Startup Digital',  sector:'Digital',  location:'Lyon',    score:88, email:'marc@startupdigital.fr',     linkedin:'linkedin.com/in/marc-fontaine',   status:'contacted' },
  { id:'3', name:'Isabelle Moreau',  title:'Responsable RH',        company:'Groupe Horizon',   sector:'RH',       location:'Bordeaux',score:79, email:'i.moreau@horizon.com',        linkedin:'linkedin.com/in/isabelle-moreau', status:'replied' },
  { id:'4', name:'Pierre Dubois',    title:'Directeur Commercial',  company:'Commerce Plus',    sector:'Commerce', location:'Nantes',  score:85, email:'p.dubois@commerce-plus.fr',  linkedin:'linkedin.com/in/pierre-dubois',   status:'new' },
  { id:'5', name:'Laura Bernard',    title:'CMO',                   company:'MediaGroup',       sector:'Médias',   location:'Paris',   score:91, email:'laura.b@mediagroup.fr',      linkedin:'linkedin.com/in/laura-bernard',   status:'converted' },
];

const STATUS_CONFIG = {
  new:       { label:'Nouveau',    color:'#6366f1', bg:'rgba(99,102,241,.12)' },
  contacted: { label:'Contacté',   color:'#f59e0b', bg:'rgba(245,158,11,.12)' },
  replied:   { label:'Répondu',    color:'#10b981', bg:'rgba(16,185,129,.12)' },
  converted: { label:'Converti',   color:'#ec4899', bg:'rgba(236,72,153,.12)' },
};

@Component({
  selector: 'app-agent-prospection',
  standalone: true,
  imports: [CommonModule, FormsModule, AgentSessionBarComponent],
  template: `
<div class="prosp-page">
  <div class="bg-orb orb1"></div>
  <div class="bg-orb orb2"></div>

  <app-agent-session-bar></app-agent-session-bar>

  <div class="prosp-wrap">

    <!-- Header -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-icon" style="background:linear-gradient(135deg,#10b981,#059669)">🎯</div>
        <div>
          <h1 class="page-title">Agent Prospection</h1>
          <p class="page-sub">Recherche &amp; gestion automatique des prospects commerciaux</p>
        </div>
      </div>
      <div class="header-stats">
        <div class="hstat" *ngFor="let s of headerStats">
          <span class="hstat-n" [style.color]="s.color">{{ s.n }}</span>
          <span class="hstat-l">{{ s.label }}</span>
        </div>
      </div>
    </div>

    <div class="main-cols">

      <!-- LEFT: recherche + génération -->
      <div class="left-col">

        <!-- Recherche prospects -->
        <div class="panel">
          <div class="panel-head">
            <span class="panel-icon">🔍</span>
            <h3 class="panel-title">Recherche de prospects</h3>
          </div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-lbl">Secteur d'activité</label>
              <input class="form-input" [(ngModel)]="searchSector" placeholder="ex: Tech, Finance, Santé…">
            </div>
            <div class="form-group">
              <label class="form-lbl">Poste cible</label>
              <input class="form-input" [(ngModel)]="searchTitle" placeholder="ex: Directeur Marketing, CEO…">
            </div>
            <div class="form-group">
              <label class="form-lbl">Localisation</label>
              <input class="form-input" [(ngModel)]="searchLocation" placeholder="ex: Paris, Lyon, France…">
            </div>
            <div class="form-group">
              <label class="form-lbl">Taille entreprise</label>
              <select class="form-input" [(ngModel)]="searchSize">
                <option value="">Toutes tailles</option>
                <option>1-10 employés</option>
                <option>11-50 employés</option>
                <option>51-200 employés</option>
                <option>200+ employés</option>
              </select>
            </div>
          </div>
          <button class="search-btn" (click)="searchProspects()" [disabled]="searching">
            <span *ngIf="!searching">🤖 Lancer la recherche IA</span>
            <span *ngIf="searching" class="btn-spin"></span>
          </button>
        </div>

        <!-- Générateur de messages -->
        <div class="panel">
          <div class="panel-head">
            <span class="panel-icon">✍️</span>
            <h3 class="panel-title">Générateur de messages</h3>
          </div>
          <div class="msg-type-btns">
            <button *ngFor="let t of msgTypes" class="msg-type-btn"
                    [class.active]="msgType === t.id"
                    (click)="msgType = t.id; generatedMsg = ''">
              {{ t.icon }} {{ t.label }}
            </button>
          </div>
          <div class="form-group" style="margin-top:.75rem">
            <label class="form-lbl">Prospect cible (nom ou secteur)</label>
            <input class="form-input" [(ngModel)]="msgTarget" placeholder="ex: Sophie Leclerc – TechVision">
          </div>
          <div class="form-group">
            <label class="form-lbl">Votre proposition de valeur</label>
            <input class="form-input" [(ngModel)]="msgValue" placeholder="ex: Automatisation des ventes, gain de 30% de temps">
          </div>
          <button class="generate-btn" (click)="generateMessage()" [disabled]="generating">
            <span *ngIf="!generating">⚡ Générer le message</span>
            <span *ngIf="generating" class="btn-spin"></span>
          </button>

          <div *ngIf="generatedMsg" class="generated-msg">
            <div class="gen-header">
              <span class="gen-label">Message généré</span>
              <button class="copy-btn" (click)="copyMsg()">{{ copiedMsg ? '✓ Copié' : '📋 Copier' }}</button>
            </div>
            <div class="gen-content">{{ generatedMsg }}</div>
          </div>
        </div>
      </div>

      <!-- RIGHT: liste prospects -->
      <div class="right-col">
        <div class="prospects-panel">
          <div class="prospects-head">
            <h3 class="prospects-title">Pipeline Prospects</h3>
            <div class="status-filters">
              <button *ngFor="let s of statusList" class="status-filter"
                      [class.active]="statusFilter === s.id"
                      (click)="statusFilter = s.id"
                      [style.--sc]="s.color">
                {{ s.label }}
              </button>
            </div>
          </div>

          <div class="prospects-list">
            <div *ngFor="let p of filteredProspects" class="prospect-card"
                 [class.selected]="selectedProspect?.id === p.id"
                 (click)="selectedProspect = p">
              <div class="pc-score" [class.score-high]="p.score >= 90" [class.score-mid]="p.score >= 75 && p.score < 90">
                {{ p.score }}
              </div>
              <div class="pc-body">
                <div class="pc-name">{{ p.name }}</div>
                <div class="pc-role">{{ p.title }} · {{ p.company }}</div>
                <div class="pc-meta">{{ p.sector }} · {{ p.location }}</div>
              </div>
              <div class="pc-status">
                <span class="status-badge"
                      [style.background]="STATUS[p.status].bg"
                      [style.color]="STATUS[p.status].color">
                  {{ STATUS[p.status].label }}
                </span>
                <div class="pc-actions">
                  <button class="pc-btn" (click)="useProspect(p, $event)" title="Générer un message">✉️</button>
                  <button class="pc-btn" (click)="advanceStatus(p, $event)" title="Avancer le statut">→</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</div>
  `,
  styles: [`
    :host { display:block; width:100%; font-family:'Inter',sans-serif; }
    .prosp-page { height:calc(100vh - 64px); background:var(--fp-bg); position:relative; overflow:hidden; display:flex; flex-direction:column; }
    ::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(16,185,129,.25); border-radius:5px; } ::-webkit-scrollbar-thumb:hover { background:rgba(16,185,129,.5); }
    .bg-orb { position:absolute; border-radius:50%; filter:blur(130px); pointer-events:none; z-index:0; }
    .orb1 { width:600px; height:600px; top:-150px; right:-100px; background:rgba(16,185,129,.09); }
    .orb2 { width:500px; height:500px; bottom:-100px; left:-100px; background:rgba(99,102,241,.07); }
    .prosp-wrap { flex:1; min-height:0; max-width:1200px; width:100%; margin:0 auto; position:relative; z-index:1; display:flex; flex-direction:column; gap:1.25rem; padding:1.5rem 1.5rem 0; overflow:hidden; }

    .page-header { display:flex; align-items:center; justify-content:space-between; gap:1.5rem; flex-wrap:wrap; }
    .page-header-left { display:flex; align-items:center; gap:1rem; }
    .page-icon { width:48px; height:48px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0; }
    .page-title { font-size:1.5rem; font-weight:900; color:var(--fp-text); margin:0; }
    .page-sub { font-size:.8rem; color:var(--fp-text-2); margin:.2rem 0 0; }
    .header-stats { display:flex; align-items:center; gap:1.25rem; }
    .hstat { display:flex; flex-direction:column; align-items:center; gap:.15rem; }
    .hstat-n { font-size:1.3rem; font-weight:800; }
    .hstat-l { font-size:.62rem; color:var(--fp-text-2); text-transform:uppercase; letter-spacing:.06em; }

    .main-cols { flex:1; min-height:0; display:grid; grid-template-columns:1fr 1fr; gap:1.25rem; overflow:hidden; padding-bottom:1.5rem; }
    @media(max-width:900px) { .main-cols { grid-template-columns:1fr; overflow:visible; } }

    .left-col { display:flex; flex-direction:column; gap:1.25rem; overflow-y:auto; overflow-x:hidden; }
    .panel {
      background: var(--fp-card);
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 16px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: .85rem;
    }
    .panel-head { display:flex; align-items:center; gap:.6rem; }
    .panel-icon { font-size:1.1rem; }
    .panel-title { font-size:.9rem; font-weight:800; color:var(--fp-text); margin:0; }

    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:.65rem; }
    .form-group { display:flex; flex-direction:column; gap:.3rem; }
    .form-lbl { font-size:.68rem; font-weight:700; color:var(--fp-text-2); text-transform:uppercase; letter-spacing:.05em; }
    .form-input {
      background: rgba(255,255,255,.04);
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 8px;
      padding: .5rem .7rem;
      color: #e2e8f0;
      font-size: .82rem;
      outline: none;
      font-family: inherit;
      transition: .15s;
    }
    .form-input:focus { border-color:rgba(16,185,129,.4); box-shadow:0 0 0 3px rgba(16,185,129,.06); }
    .form-input option { background:#1e293b; }

    .search-btn, .generate-btn {
      display:flex; align-items:center; justify-content:center; gap:.5rem;
      padding:.6rem 1.2rem;
      border:none; border-radius:10px; cursor:pointer;
      font-size:.82rem; font-weight:700; transition:.15s;
    }
    .search-btn { background:linear-gradient(135deg,#10b981,#059669); color:#fff; }
    .search-btn:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
    .generate-btn { background:linear-gradient(135deg,#6366f1,#7c3aed); color:#fff; }
    .generate-btn:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
    .search-btn:disabled, .generate-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
    .btn-spin { width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }

    .msg-type-btns { display:flex; gap:.5rem; flex-wrap:wrap; }
    .msg-type-btn { background:var(--fp-input); border:1px solid var(--fp-border); color:var(--fp-text-2); font-size:.72rem; font-weight:700; padding:.3rem .7rem; border-radius:8px; cursor:pointer; transition:.15s; }
    .msg-type-btn.active { background:rgba(99,102,241,.15); border-color:rgba(99,102,241,.35); color:#a5b4fc; }

    .generated-msg { background:rgba(0,0,0,.25); border:1px solid rgba(99,102,241,.2); border-radius:10px; padding:1rem; display:flex; flex-direction:column; gap:.6rem; }
    .gen-header { display:flex; align-items:center; justify-content:space-between; }
    .gen-label { font-size:.68rem; font-weight:800; color:#a5b4fc; text-transform:uppercase; letter-spacing:.05em; }
    .copy-btn { background:var(--fp-input); border:1px solid var(--fp-border); color:var(--fp-text-2); font-size:.68rem; font-weight:600; padding:.2rem .5rem; border-radius:6px; cursor:pointer; transition:.15s; }
    .copy-btn:hover { color:#a5b4fc; }
    .gen-content { font-size:.8rem; color:var(--fp-text-2); line-height:1.7; white-space:pre-wrap; }

    /* ── Prospects panel ── */
    .right-col { display:flex; flex-direction:column; }
    .prospects-panel { background:var(--fp-card); border:1px solid var(--fp-border); border-radius:16px; overflow:hidden; height:100%; display:flex; flex-direction:column; }
    .prospects-head { padding:1rem 1.25rem; border-bottom:1px solid var(--fp-border); display:flex; flex-direction:column; gap:.6rem; }
    .prospects-title { font-size:.9rem; font-weight:800; color:var(--fp-text); margin:0; }
    .status-filters { display:flex; gap:.35rem; flex-wrap:wrap; }
    .status-filter { background:var(--fp-input); border:1px solid var(--fp-border); color:var(--fp-text-2); font-size:.65rem; font-weight:700; padding:.2rem .55rem; border-radius:20px; cursor:pointer; transition:.15s; }
    .status-filter:hover { color:var(--fp-text-2); }
    .status-filter.active { background:rgba(var(--sc),.15); border-color:var(--sc); color:var(--sc); }

    .prospects-list { flex:1; overflow-y:auto; padding:.75rem; display:flex; flex-direction:column; gap:.5rem; }
    .prospects-list::-webkit-scrollbar { width:3px; }
    .prospects-list::-webkit-scrollbar-thumb { background:rgba(99,102,241,.15); border-radius:2px; }

    .prospect-card {
      display:flex; align-items:center; gap:.75rem;
      padding:.75rem;
      background:rgba(255,255,255,.02);
      border:1px solid var(--fp-border);
      border-radius:10px;
      cursor:pointer;
      transition:background .12s;
    }
    .prospect-card:hover, .prospect-card.selected { background:rgba(99,102,241,.07); border-color:rgba(99,102,241,.2); }

    .pc-score {
      width:38px; height:38px; border-radius:10px; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      font-size:.85rem; font-weight:800;
      background:rgba(99,102,241,.12); color:#818cf8;
    }
    .pc-score.score-high { background:rgba(16,185,129,.15); color:#10b981; }
    .pc-score.score-mid  { background:rgba(245,158,11,.12); color:#f59e0b; }

    .pc-body { flex:1; min-width:0; }
    .pc-name { font-size:.82rem; font-weight:700; color:var(--fp-text); }
    .pc-role { font-size:.72rem; color:var(--fp-text-2); }
    .pc-meta { font-size:.65rem; color:#374151; margin-top:.1rem; }

    .pc-status { display:flex; flex-direction:column; align-items:flex-end; gap:.35rem; flex-shrink:0; }
    .status-badge { font-size:.62rem; font-weight:700; padding:.15rem .45rem; border-radius:6px; }
    .pc-actions { display:flex; gap:.3rem; }
    .pc-btn { background:var(--fp-input); border:1px solid var(--fp-border); color:var(--fp-text-2); width:24px; height:24px; border-radius:6px; cursor:pointer; font-size:.7rem; display:flex; align-items:center; justify-content:center; transition:.12s; }
    .pc-btn:hover { background:rgba(99,102,241,.15); color:#a5b4fc; border-color:rgba(99,102,241,.3); }

    @keyframes spin { to{transform:rotate(360deg)} }
  `]
})
export class AgentProspectionComponent {
  constructor(private agentSvc: AgentService) {}

  readonly STATUS = STATUS_CONFIG;

  prospects: Prospect[] = PROSPECTS.map(p => ({ ...p }));
  selectedProspect: Prospect | null = null;
  statusFilter = 'all';
  searching = false;
  generating = false;
  copiedMsg = false;
  searchSector = '';
  searchTitle = '';
  searchLocation = '';
  searchSize = '';
  msgType = 'linkedin';
  msgTarget = '';
  msgValue = '';
  generatedMsg = '';

  readonly msgTypes = [
    { id: 'linkedin', icon: '🔗', label: 'LinkedIn' },
    { id: 'email',    icon: '📧', label: 'Email froid' },
    { id: 'followup', icon: '🔁', label: 'Relance' },
  ];

  readonly statusList = [
    { id: 'all',       label: 'Tous',      color: '#818cf8' },
    { id: 'new',       label: 'Nouveaux',  color: '#6366f1' },
    { id: 'contacted', label: 'Contactés', color: '#f59e0b' },
    { id: 'replied',   label: 'Répondus',  color: '#10b981' },
    { id: 'converted', label: 'Convertis', color: '#ec4899' },
  ];

  get filteredProspects() {
    return this.statusFilter === 'all'
      ? this.prospects
      : this.prospects.filter(p => p.status === this.statusFilter);
  }

  get headerStats() {
    return [
      { n: this.prospects.length,                                        label: 'Prospects',  color: '#818cf8' },
      { n: this.prospects.filter(p => p.status === 'converted').length,  label: 'Convertis',  color: '#10b981' },
      { n: Math.round(this.prospects.filter(p => p.status === 'converted').length / this.prospects.length * 100) + '%', label: 'Taux conv.', color: '#ec4899' },
    ];
  }

  async searchProspects() {
    this.searching = true;
    await new Promise(r => setTimeout(r, 1800));
    const newP: Prospect = {
      id: Date.now().toString(),
      name: 'Alexandre Renaud',
      title: this.searchTitle || 'Directeur Commercial',
      company: 'NovaTech',
      sector: this.searchSector || 'Tech',
      location: this.searchLocation || 'Paris',
      score: Math.floor(75 + Math.random() * 20),
      email: 'a.renaud@novatech.fr',
      linkedin: 'linkedin.com/in/alexandre-renaud',
      status: 'new',
    };
    this.prospects = [newP, ...this.prospects];
    this.searching = false;
  }

  async generateMessage() {
    if (!this.msgTarget) return;
    this.generating = true;
    this.generatedMsg = '';

    await this.agentSvc.streamAgent(
      'prospection',
      this.msgTarget,
      this.msgType,
      this.msgValue,
      {
        onChunk: (chunk) => { this.generatedMsg += chunk; },
        onDone:  () => { this.generating = false; },
        onError: () => {
          this.generatedMsg = this.agentSvc.getMock('prospection', this.msgType, this.msgTarget);
          this.generating = false;
        },
      }
    );
  }

  useProspect(p: Prospect, e: Event) {
    e.stopPropagation();
    this.msgTarget = `${p.name} – ${p.company}`;
    this.generatedMsg = '';
  }

  advanceStatus(p: Prospect, e: Event) {
    e.stopPropagation();
    const order: Prospect['status'][] = ['new', 'contacted', 'replied', 'converted'];
    const idx = order.indexOf(p.status);
    if (idx < order.length - 1) p.status = order[idx + 1];
  }

  async copyMsg() {
    await navigator.clipboard.writeText(this.generatedMsg).catch(() => {});
    this.copiedMsg = true;
    setTimeout(() => this.copiedMsg = false, 2000);
  }
}
