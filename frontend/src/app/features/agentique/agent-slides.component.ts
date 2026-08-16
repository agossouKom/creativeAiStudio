import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../services/agent.service';
import { AgentSessionBarComponent } from '../../shared/components/agent-session-bar/agent-session-bar.component';

interface Slide {
  number: number;
  title: string;
  content: string[];
  type: 'title' | 'content' | 'quote' | 'stats' | 'conclusion';
  emoji?: string;
}

@Component({
  selector: 'app-agent-slides',
  standalone: true,
  imports: [CommonModule, FormsModule, AgentSessionBarComponent],
  template: `
<div class="slides-page">
  <div class="bg-orb orb1"></div>
  <div class="bg-orb orb2"></div>

  <app-agent-session-bar></app-agent-session-bar>

  <div class="slides-wrap">

    <!-- Header -->
    <div class="page-header">
      <div class="agent-icon">📊</div>
      <div>
        <h1 class="page-title">Agent PowerPoint / Slides</h1>
        <p class="page-sub">Génération automatique de présentations professionnelles par IA</p>
      </div>
    </div>

    <div class="slides-cols">

      <!-- Config -->
      <div class="config-panel">

        <div class="section">
          <div class="section-lbl">📌 Sujet de la présentation</div>
          <textarea class="topic-input" [(ngModel)]="topic" rows="3"
                    placeholder="ex: Présentation du projet IA, Rapport de performance Q2, Pitch startup…"></textarea>
        </div>

        <div class="section">
          <div class="section-lbl">📊 Nombre de slides</div>
          <div class="slides-count">
            <button class="count-btn" (click)="slideCount = Math.max(3, slideCount - 1)">−</button>
            <span class="count-val">{{ slideCount }}</span>
            <button class="count-btn" (click)="slideCount = Math.min(15, slideCount + 1)">+</button>
          </div>
        </div>

        <div class="section">
          <div class="section-lbl">🎨 Style visuel</div>
          <div class="theme-grid">
            <button *ngFor="let th of themes" class="theme-btn"
                    [class.active]="selectedTheme === th.id"
                    (click)="selectedTheme = th.id"
                    [style.--thc]="th.color">
              <span class="th-preview" [style.background]="th.color"></span>
              {{ th.label }}
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-lbl">🗂️ Type de présentation</div>
          <div class="ptype-list">
            <button *ngFor="let pt of presTypes" class="ptype-btn"
                    [class.active]="presType === pt.id"
                    (click)="presType = pt.id">
              {{ pt.icon }} {{ pt.label }}
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-lbl">👥 Audience</div>
          <select class="form-select" [(ngModel)]="audience">
            <option>Direction / Investisseurs</option>
            <option>Équipe interne</option>
            <option>Clients</option>
            <option>Grand public</option>
          </select>
        </div>

        <div class="section">
          <div class="section-lbl">🌐 Langue</div>
          <select class="form-select" [(ngModel)]="language">
            <option>Français</option>
            <option>Anglais</option>
          </select>
        </div>

        <button class="gen-btn" (click)="generate()" [disabled]="generating || !topic.trim()">
          <span *ngIf="!generating">⚡ Générer la présentation</span>
          <span *ngIf="generating" class="spin-row"><span class="btn-spin"></span>Génération…</span>
        </button>
      </div>

      <!-- Preview -->
      <div class="preview-col">

        <div *ngIf="!slides.length && !generating" class="preview-empty">
          <div class="pe-icon">📊</div>
          <h3 class="pe-title">Aperçu de la présentation</h3>
          <p class="pe-sub">Configurez votre présentation et cliquez sur "Générer"</p>
          <div class="pe-mock">
            <div class="mock-slide mock-title-slide">
              <div class="mock-line mock-title-line"></div>
              <div class="mock-line mock-sub-line"></div>
            </div>
            <div class="mock-slide">
              <div class="mock-line mock-title-line short"></div>
              <div class="mock-line"></div>
              <div class="mock-line short2"></div>
              <div class="mock-line"></div>
            </div>
            <div class="mock-slide">
              <div class="mock-line mock-title-line short"></div>
              <div class="mock-line"></div>
              <div class="mock-line short2"></div>
            </div>
          </div>
        </div>

        <div *ngIf="generating" class="gen-state">
          <div class="gs-spinner"></div>
          <p class="gs-label">Génération des slides en cours…</p>
          <div class="gs-progress">
            <div class="gs-bar" [style.width.%]="genProgress"></div>
          </div>
          <div class="gs-slides-preview">
            <div *ngFor="let i of progressSlides" class="gs-mini-slide" [class.done]="i <= currentGenSlide">
              <span class="gs-mini-n">{{ i }}</span>
            </div>
          </div>
        </div>

        <div *ngIf="slides.length > 0 && !generating" class="slides-preview">

          <div class="preview-toolbar">
            <span class="pt-count">{{ slides.length }} slides générées</span>
            <div class="pt-actions">
              <button class="pt-btn" (click)="copyAll()">{{ copiedAll ? '✓ Copié' : '📋 Copier tout' }}</button>
              <button class="pt-btn pt-btn--primary" (click)="exportTxt()">📥 Exporter TXT</button>
              <button class="pt-btn" (click)="regenerate()">🔄 Régénérer</button>
            </div>
          </div>

          <!-- Slide cards -->
          <div class="slides-list">
            <div *ngFor="let slide of slides; let i = index" class="slide-card"
                 [class.selected]="selectedSlide === i"
                 [class.slide-title]="slide.type === 'title'"
                 [class.slide-conclusion]="slide.type === 'conclusion'"
                 (click)="selectedSlide = i"
                 [style.animation-delay]="(i * 0.06) + 's'">

              <div class="slide-header" [style.background]="getThemeColor()">
                <span class="slide-n">{{ slide.number }}</span>
                <span class="slide-type-badge">{{ getTypeBadge(slide.type) }}</span>
              </div>

              <div class="slide-body">
                <h3 class="slide-title-text">
                  <span *ngIf="slide.emoji">{{ slide.emoji }} </span>{{ slide.title }}
                </h3>
                <ul class="slide-points">
                  <li *ngFor="let pt of slide.content.slice(0, 4)">{{ pt }}</li>
                  <li *ngIf="slide.content.length > 4" class="more-points">+{{ slide.content.length - 4 }} points…</li>
                </ul>
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
    .slides-page { height:calc(100vh - 64px); background:var(--fp-bg); position:relative; overflow:hidden; display:flex; flex-direction:column; }
    ::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(236,72,153,.25); border-radius:5px; } ::-webkit-scrollbar-thumb:hover { background:rgba(236,72,153,.5); }
    .bg-orb { position:absolute; border-radius:50%; filter:blur(130px); pointer-events:none; z-index:0; }
    .orb1 { width:600px; height:600px; top:-150px; right:-100px; background:rgba(236,72,153,.08); }
    .orb2 { width:500px; height:500px; bottom:-100px; left:-100px; background:rgba(99,102,241,.07); }
    .slides-wrap { flex:1; min-height:0; max-width:1200px; width:100%; margin:0 auto; position:relative; z-index:1; display:flex; flex-direction:column; gap:1.25rem; padding:1.5rem 1.5rem 0; overflow:hidden; }

    .page-header { display:flex; align-items:center; gap:1rem; }
    .agent-icon { width:48px; height:48px; background:linear-gradient(135deg,#ec4899,#db2777); border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0; }
    .page-title { font-size:1.5rem; font-weight:900; color:var(--fp-text); margin:0; }
    .page-sub { font-size:.8rem; color:var(--fp-text-2); margin:.2rem 0 0; }

    .slides-cols { flex:1; min-height:0; display:grid; grid-template-columns:320px 1fr; gap:1.25rem; overflow:hidden; padding-bottom:1.5rem; }
    @media(max-width:900px) { .slides-cols { grid-template-columns:1fr; overflow:visible; } }

    .config-panel {
      background:var(--fp-card);
      border:1px solid var(--fp-border);
      border-radius:16px;
      padding:1.25rem;
      display:flex;
      flex-direction:column;
      gap:1rem;
      overflow-y:auto;
      overflow-x:hidden;
    }

    .section { display:flex; flex-direction:column; gap:.45rem; }
    .section-lbl { font-size:.65rem; font-weight:800; color:var(--fp-text-2); text-transform:uppercase; letter-spacing:.08em; }

    .topic-input {
      background:var(--fp-input); border:1px solid var(--fp-border);
      border-radius:10px; padding:.65rem .85rem;
      color:var(--fp-text); font-size:.82rem; line-height:1.6;
      resize:vertical; outline:none; font-family:inherit; transition:.15s;
    }
    .topic-input:focus { border-color:rgba(236,72,153,.4); box-shadow:0 0 0 3px rgba(236,72,153,.06); }
    .topic-input::placeholder { color:#374151; }

    .slides-count { display:flex; align-items:center; gap:.75rem; }
    .count-btn { width:32px; height:32px; background:var(--fp-input); border:1px solid rgba(255,255,255,.1); border-radius:8px; color:var(--fp-text); font-size:1.1rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:.15s; }
    .count-btn:hover { background:rgba(236,72,153,.15); border-color:rgba(236,72,153,.35); }
    .count-val { font-size:1.4rem; font-weight:800; color:var(--fp-text); min-width:32px; text-align:center; }

    .theme-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:.4rem; }
    .theme-btn {
      display:flex; align-items:center; gap:.4rem;
      background:var(--fp-input); border:1px solid var(--fp-border);
      color:var(--fp-text-2); font-size:.7rem; font-weight:700;
      padding:.35rem .5rem; border-radius:8px; cursor:pointer; transition:.15s;
    }
    .theme-btn:hover { color:var(--fp-text-2); }
    .theme-btn.active { background:rgba(236,72,153,.1); border-color:rgba(236,72,153,.35); color:#f9a8d4; }
    .th-preview { width:12px; height:12px; border-radius:3px; flex-shrink:0; }

    .ptype-list { display:flex; flex-direction:column; gap:.3rem; }
    .ptype-btn { background:var(--fp-input); border:1px solid var(--fp-border); color:var(--fp-text-2); font-size:.75rem; font-weight:600; padding:.35rem .65rem; border-radius:8px; cursor:pointer; transition:.15s; text-align:left; }
    .ptype-btn:hover { color:var(--fp-text-2); }
    .ptype-btn.active { background:rgba(236,72,153,.1); border-color:rgba(236,72,153,.3); color:#f9a8d4; }

    .form-select { background:var(--fp-input); border:1px solid var(--fp-border); border-radius:8px; padding:.4rem .65rem; color:var(--fp-text); font-size:.8rem; outline:none; font-family:inherit; }
    .form-select option { background:#1e293b; }

    .gen-btn {
      background:linear-gradient(135deg,#ec4899,#db2777);
      color:#fff; border:none; border-radius:10px;
      padding:.65rem 1.2rem; font-size:.85rem; font-weight:800;
      cursor:pointer; transition:.15s;
      display:flex; align-items:center; justify-content:center; gap:.5rem;
    }
    .gen-btn:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
    .gen-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; }
    .spin-row { display:flex; align-items:center; gap:.5rem; }
    .btn-spin { width:14px; height:14px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; }

    /* ── Preview col ── */
    .preview-col { display:flex; flex-direction:column; overflow-y:auto; overflow-x:hidden; }

    .preview-empty {
      background:var(--fp-card-2);
      border:1px solid var(--fp-border);
      border-radius:16px;
      padding:2rem;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:.75rem;
      text-align:center;
      flex:1;
    }
    .pe-icon { font-size:2.5rem; }
    .pe-title { font-size:1rem; font-weight:800; color:var(--fp-text-2); margin:0; }
    .pe-sub { font-size:.8rem; color:var(--fp-text-3); margin:0; }
    .pe-mock { display:flex; gap:.75rem; margin-top:.75rem; }
    .mock-slide { background:var(--fp-input); border:1px solid var(--fp-border); border-radius:8px; padding:.75rem; width:120px; display:flex; flex-direction:column; gap:.35rem; }
    .mock-title-slide { border-top:3px solid rgba(236,72,153,.4); align-items:center; padding:1rem .75rem; }
    .mock-line { height:6px; background:var(--fp-input); border-radius:3px; width:100%; }
    .mock-title-line { height:8px; background:rgba(255,255,255,.12); width:85%; }
    .mock-title-line.short { width:65%; }
    .mock-sub-line { height:5px; background:var(--fp-input); width:70%; }
    .mock-line.short2 { width:80%; }

    .gen-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; flex:1; min-height:300px; padding:2rem; }
    .gs-spinner { width:40px; height:40px; border:4px solid rgba(236,72,153,.2); border-top-color:#ec4899; border-radius:50%; animation:spin .7s linear infinite; }
    .gs-label { font-size:.85rem; color:var(--fp-text-2); font-style:italic; margin:0; }
    .gs-progress { width:220px; height:5px; background:var(--fp-input); border-radius:20px; overflow:hidden; }
    .gs-bar { height:100%; background:linear-gradient(90deg,#ec4899,#f9a8d4); border-radius:20px; transition:width .3s ease; }
    .gs-slides-preview { display:flex; gap:.4rem; flex-wrap:wrap; justify-content:center; margin-top:.5rem; }
    .gs-mini-slide { width:30px; height:22px; background:var(--fp-input); border:1px solid var(--fp-border); border-radius:4px; display:flex; align-items:center; justify-content:center; transition:.3s; }
    .gs-mini-slide.done { background:rgba(236,72,153,.15); border-color:rgba(236,72,153,.4); }
    .gs-mini-n { font-size:.6rem; color:var(--fp-text-2); font-weight:700; }
    .gs-mini-slide.done .gs-mini-n { color:#f9a8d4; }

    .slides-preview { display:flex; flex-direction:column; gap:1rem; }
    .preview-toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:.6rem; }
    .pt-count { font-size:.8rem; font-weight:700; color:var(--fp-text-2); }
    .pt-actions { display:flex; gap:.4rem; }
    .pt-btn { background:var(--fp-input); border:1px solid var(--fp-border); color:var(--fp-text-2); font-size:.7rem; font-weight:700; padding:.3rem .65rem; border-radius:8px; cursor:pointer; transition:.15s; }
    .pt-btn:hover { color:var(--fp-text); border-color:rgba(255,255,255,.15); }
    .pt-btn--primary { background:rgba(236,72,153,.15); border-color:rgba(236,72,153,.3); color:#f9a8d4; }
    .pt-btn--primary:hover { background:rgba(236,72,153,.25); }

    .slides-list { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:.75rem; }
    .slide-card {
      background:var(--fp-card);
      border:1px solid var(--fp-border);
      border-radius:12px;
      overflow:hidden;
      cursor:pointer;
      transition:border-color .15s, transform .15s;
      animation:fadeUp .4s ease-out both;
    }
    .slide-card:hover { border-color:rgba(236,72,153,.3); transform:translateY(-2px); }
    .slide-card.selected { border-color:#ec4899; }
    .slide-card.slide-title .slide-header { background:linear-gradient(135deg,#ec4899,#db2777) !important; }
    .slide-card.slide-conclusion .slide-header { background:linear-gradient(135deg,#6366f1,#4f46e5) !important; }

    .slide-header { display:flex; align-items:center; justify-content:space-between; padding:.45rem .7rem; }
    .slide-n { font-size:.68rem; font-weight:800; color:rgba(255,255,255,.7); }
    .slide-type-badge { font-size:.58rem; font-weight:700; background:rgba(255,255,255,.15); color:rgba(255,255,255,.8); padding:.1rem .35rem; border-radius:4px; text-transform:uppercase; letter-spacing:.04em; }

    .slide-body { padding:.75rem; }
    .slide-title-text { font-size:.82rem; font-weight:800; color:var(--fp-text); margin:0 0 .5rem; line-height:1.3; }
    .slide-points { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:.2rem; }
    .slide-points li { font-size:.68rem; color:var(--fp-text-2); padding-left:.75rem; position:relative; line-height:1.5; }
    .slide-points li::before { content:'•'; position:absolute; left:0; color:var(--fp-text-2); }
    .more-points { font-size:.65rem; color:#374151; font-style:italic; }
    .more-points::before { content:''; }

    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  `]
})
export class AgentSlidesComponent {
  constructor(private agentSvc: AgentService) {}

  topic = '';
  slideCount = 8;
  selectedTheme = 'corporate';
  presType = 'pitch';
  audience = 'Direction / Investisseurs';
  language = 'Français';
  generating = false;
  genProgress = 0;
  currentGenSlide = 0;
  slides: Slide[] = [];
  selectedSlide = 0;
  copiedAll = false;

  readonly Math = Math;

  readonly themes = [
    { id: 'corporate', label: 'Corporate',  color: '#6366f1' },
    { id: 'dark',      label: 'Dark',       color: '#0f172a' },
    { id: 'vibrant',   label: 'Vibrant',    color: '#ec4899' },
    { id: 'minimal',   label: 'Minimal',    color: '#e2e8f0' },
    { id: 'green',     label: 'Green',      color: '#10b981' },
    { id: 'orange',    label: 'Orange',     color: '#f59e0b' },
  ];

  readonly presTypes = [
    { id: 'pitch',    icon: '🚀', label: 'Pitch / Startup' },
    { id: 'report',   icon: '📊', label: 'Rapport / Bilan' },
    { id: 'training', icon: '📚', label: 'Formation / Tuto' },
    { id: 'proposal', icon: '💼', label: 'Proposition commerciale' },
  ];

  get progressSlides() {
    return Array.from({ length: this.slideCount }, (_, i) => i + 1);
  }

  getThemeColor(): string {
    const t = this.themes.find(th => th.id === this.selectedTheme);
    return t ? `linear-gradient(135deg, ${t.color}88, ${t.color}44)` : 'rgba(99,102,241,.3)';
  }

  getTypeBadge(type: Slide['type']): string {
    const map: Record<Slide['type'], string> = {
      title: 'Titre', content: 'Contenu', quote: 'Citation', stats: 'Chiffres', conclusion: 'Conclusion',
    };
    return map[type] ?? 'Slide';
  }

  async generate() {
    if (!this.topic.trim()) return;
    this.generating = true;
    this.slides = [];
    this.genProgress = 0;
    this.currentGenSlide = 0;

    // Animation de progression pendant l'appel LLM
    const progressInterval = setInterval(() => {
      if (this.genProgress < 90) {
        this.genProgress += 7;
        if (this.currentGenSlide < this.slideCount - 1) this.currentGenSlide++;
      }
    }, 350);

    let llmRaw = '';
    await this.agentSvc.streamAgent(
      'slides',
      this.topic,
      'default',
      String(this.slideCount),
      {
        onChunk: (chunk) => { llmRaw += chunk; },
        onDone: () => {},
        onError: () => {},
      }
    );

    clearInterval(progressInterval);
    this.genProgress = 100;
    this.currentGenSlide = this.slideCount - 1;

    // Parser la réponse LLM ou fallback
    this.slides = llmRaw.length > 100
      ? this.parseLlmSlides(llmRaw)
      : this.buildSlides();

    this.generating = false;
    this.selectedSlide = 0;
  }

  private parseLlmSlides(raw: string): Slide[] {
    const slideBlocks = raw.split(/\[SLIDE\s+(\d+)\]/i).filter(Boolean);
    const results: Slide[] = [];

    for (let i = 0; i < slideBlocks.length - 1; i += 2) {
      const num = parseInt(slideBlocks[i]);
      const block = slideBlocks[i + 1] ?? '';
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const titleLine = lines.find(l => l.toLowerCase().startsWith('titre:') || l.toLowerCase().startsWith('type:') && false);
      const title = titleLine
        ? titleLine.replace(/^titre\s*:\s*/i, '').replace(/^type\s*:\s*/i, '')
        : lines[0] ?? `Slide ${num}`;
      const bullets = lines
        .filter(l => l.startsWith('•') || l.startsWith('-') || l.startsWith('*'))
        .map(l => l.replace(/^[•\-*]\s*/, ''))
        .slice(0, 5);

      const typeHint = block.match(/type\s*:\s*(\w+)/i)?.[1]?.toLowerCase() as Slide['type'];
      const validTypes: Slide['type'][] = ['title','content','stats','quote','conclusion'];
      const type = validTypes.includes(typeHint) ? typeHint : (num === 1 ? 'title' : 'content');

      results.push({
        number: num,
        title: title.substring(0, 80),
        content: bullets.length ? bullets : ['Point principal', 'Sous-point clé'],
        type,
        emoji: num === 1 ? '🚀' : type === 'conclusion' ? '🏆' : undefined,
      });
    }

    return results.length >= 3 ? results : this.buildSlides();
  }

  private buildSlides(): Slide[] {
    const t = this.topic;
    const types: Slide['type'][] = ['title', 'content', 'content', 'stats', 'content', 'content', 'quote', 'conclusion'];
    const emojis = ['🚀', '💡', '🎯', '📊', '✅', '🔑', '💬', '🏆'];

    const titleSlides: Partial<Slide>[] = [
      { title: t, content: [`Présentation — ${new Date().toLocaleDateString('fr')}`, this.audience, `Préparé avec Agent Slides IA`], type: 'title', emoji: '🚀' },
      { title: 'Contexte & Enjeux', content: [`Le marché évolue rapidement autour de ${t}`, 'Les entreprises cherchent des solutions innovantes', 'Notre approche apporte une réponse concrète'], type: 'content', emoji: '💡' },
      { title: 'Notre Proposition', content: [`Solution complète pour ${t}`, 'Approche centrée sur les résultats', 'Déploiement rapide et accompagnement', 'ROI mesurable dès les 90 premiers jours'], type: 'content', emoji: '🎯' },
      { title: 'Chiffres Clés', content: ['+47% d\'efficacité mesurée', '3× plus rapide que la méthode traditionnelle', 'Plus de 200 entreprises accompagnées', '98% de satisfaction client'], type: 'stats', emoji: '📊' },
      { title: 'Notre Méthode', content: ['Phase 1 : Audit et diagnostic', 'Phase 2 : Conception de la solution', 'Phase 3 : Déploiement et test', 'Phase 4 : Suivi et optimisation'], type: 'content', emoji: '✅' },
      { title: 'Avantages Concurrentiels', content: ['Technologie IA de pointe', 'Équipe d\'experts certifiés', 'Support 24/7', 'Scalabilité illimitée', 'Intégration facile avec vos outils'], type: 'content', emoji: '🔑' },
      { title: 'Témoignage Client', content: ['"Grâce à cette solution, nous avons transformé notre approche et gagné en compétitivité."', '— Directeur Général, Entreprise Fortune 500'], type: 'quote', emoji: '💬' },
      { title: 'Prochaines Étapes', content: ['Réunion de lancement J+7', 'Prototype opérationnel J+30', 'Déploiement complet J+90', 'Questions et discussion'], type: 'conclusion', emoji: '🏆' },
      { title: 'Notre Équipe', content: ['Experts certifiés en IA', '10+ années d\'expérience', 'Présence internationale', 'R&D continue'], type: 'content', emoji: '👥' },
      { title: 'Roadmap 2025', content: ['Q1 : Lancement MVP', 'Q2 : Expansion marché', 'Q3 : Nouvelles fonctionnalités', 'Q4 : Scale international'], type: 'content', emoji: '📅' },
      { title: 'Budget & Investissement', content: ['Investissement initial maîtrisé', 'ROI attendu en 6 mois', 'Options de financement flexibles', 'Garantie de résultats'], type: 'stats', emoji: '💰' },
      { title: 'Merci', content: ['Prêts à transformer votre business ?', 'Contactez-nous dès aujourd\'hui', 'contact@mediexpress.io'], type: 'conclusion', emoji: '🙏' },
    ];

    return Array.from({ length: this.slideCount }, (_, i) => ({
      number: i + 1,
      title: titleSlides[i % titleSlides.length]?.title ?? `Slide ${i + 1}`,
      content: titleSlides[i % titleSlides.length]?.content ?? ['Point principal', 'Sous-point 1', 'Sous-point 2'],
      type: titleSlides[i % titleSlides.length]?.type ?? 'content',
      emoji: titleSlides[i % titleSlides.length]?.emoji,
    }));
  }

  async copyAll() {
    const text = this.slides.map(s =>
      `[Slide ${s.number}] ${s.title}\n${s.content.map(c => '• ' + c).join('\n')}`
    ).join('\n\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    this.copiedAll = true;
    setTimeout(() => this.copiedAll = false, 2000);
  }

  exportTxt() {
    const text = this.slides.map(s =>
      `=== Slide ${s.number}: ${s.title} ===\n${s.content.map(c => '• ' + c).join('\n')}`
    ).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `presentation-ia.txt` });
    a.click();
    URL.revokeObjectURL(url);
  }

  regenerate() {
    this.generate();
  }
}
