import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

const AGENTS = [
  {
    id: 'email',
    icon: '📧',
    color: '#6366f1',
    colorDark: 'rgba(99,102,241,0.12)',
    title: 'Agent Email',
    subtitle: 'Assistant Email IA',
    description: 'Lecture, classification, résumés intelligents et réponses automatiques pour vos emails.',
    features: ['Classification automatique', 'Résumés intelligents', 'Réponses suggérées', 'Détection d\'urgences'],
    route: '/agentique/email',
    badge: 'IA',
  },
  {
    id: 'prospection',
    icon: '🎯',
    color: '#10b981',
    colorDark: 'rgba(16,185,129,0.12)',
    title: 'Agent Prospection',
    subtitle: 'Prospection Commerciale IA',
    description: 'Recherche de prospects, rédaction de messages LinkedIn et emails de vente personnalisés.',
    features: ['Recherche de prospects', 'Messages LinkedIn IA', 'Emails de vente', 'Suivi automatique'],
    route: '/agentique/prospection',
    badge: 'NEW',
  },
  {
    id: 'marketing',
    icon: '📈',
    color: '#f59e0b',
    colorDark: 'rgba(245,158,11,0.12)',
    title: 'Agent Marketing',
    subtitle: 'Marketing Digital IA',
    description: 'Génération de contenus pour réseaux sociaux, campagnes SEO, hashtags et scripts vidéo.',
    features: ['Publications sociales', 'Contenu SEO', 'Génération hashtags', 'Scripts vidéo'],
    route: '/agentique/marketing',
    badge: 'IA',
  },
  {
    id: 'resume',
    icon: '📋',
    color: '#8b5cf6',
    colorDark: 'rgba(139,92,246,0.12)',
    title: 'Agent Résumé',
    subtitle: 'Résumé Intelligent IA',
    description: 'Résumé automatique de PDF/DOCX, extraction des décisions et génération de comptes-rendus.',
    features: ['Résumé PDF/DOCX', 'Extraction décisions', 'Comptes-rendus', 'Analyse documentaire'],
    route: '/agentique/resume',
    badge: 'IA',
  },
  {
    id: 'slides',
    icon: '📊',
    color: '#ec4899',
    colorDark: 'rgba(236,72,153,0.12)',
    title: 'Agent Slides',
    subtitle: 'PowerPoint / Présentations IA',
    description: 'Création automatique de présentations, transformation de rapports en slides visuels.',
    features: ['Présentations auto', 'Rapports → Slides', 'Contenu visuel', 'Export PPTX/PDF'],
    route: '/agentique/slides',
    badge: 'NEW',
  },
  {
    id: 'cv-analyzer',
    icon: '🔍',
    color: '#0d9488',
    colorDark: 'rgba(13,148,136,0.12)',
    title: 'Analyseur de CV',
    subtitle: 'CV Analyzer IA',
    description: 'Analyse complète de votre CV : score ATS, mots-clés, feedback par section et postes suggérés.',
    features: ['Score ATS complet', 'Mots-clés secteur', 'Feedback par section', 'Postes recommandés'],
    route: '/agentique/cv-analyzer',
    badge: 'IA',
  },
];

@Component({
  selector: 'app-agentique-hub',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
<div class="hub-page">
  <div class="bg-orb orb1"></div>
  <div class="bg-orb orb2"></div>
  <div class="bg-orb orb3"></div>

  <div class="hub-wrap">

    <!-- Hero -->
    <div class="hero">
      <div class="hero-badge">
        <span class="badge-dot"></span>
        Agents IA — Propulsé par Claude &amp; GPT
      </div>
      <h1 class="hero-title">
        Équipe d'Agents<br>
        <span class="grad">Intelligents IA</span>
      </h1>
      <p class="hero-sub">
        5 agents spécialisés pour automatiser vos tâches professionnelles —
        emails, prospection, marketing, documents et présentations.
      </p>
      <div class="hero-stats">
        <div class="stat"><span class="stat-n">5</span><span class="stat-l">Agents IA</span></div>
        <div class="stat-sep"></div>
        <div class="stat"><span class="stat-n">∞</span><span class="stat-l">Automatisations</span></div>
        <div class="stat-sep"></div>
        <div class="stat"><span class="stat-n">LLM</span><span class="stat-l">Claude / GPT</span></div>
      </div>
    </div>

    <!-- Grid agents -->
    <div class="agents-grid">
      <a *ngFor="let agent of agents; let i = index"
         [routerLink]="agent.route"
         class="agent-card"
         [style.--agent-color]="agent.color"
         [style.--agent-bg]="agent.colorDark"
         [style.animation-delay]="(i * 0.07) + 's'">

        <div class="card-top">
          <div class="agent-icon" [style.background]="agent.colorDark" [style.box-shadow]="'0 0 0 1px ' + agent.color + '33'">
            {{ agent.icon }}
          </div>
          <span class="agent-badge" [style.background]="agent.color + '22'" [style.color]="agent.color" [style.border]="'1px solid ' + agent.color + '44'">{{ agent.badge }}</span>
        </div>

        <div class="card-body">
          <h3 class="card-title">{{ agent.title }}</h3>
          <p class="card-sub">{{ agent.subtitle }}</p>
          <p class="card-desc">{{ agent.description }}</p>
        </div>

        <div class="card-features">
          <span *ngFor="let f of agent.features" class="feat-tag" [style.background]="agent.colorDark" [style.color]="agent.color">
            ✓ {{ f }}
          </span>
        </div>

        <div class="card-footer">
          <span class="cta-link" [style.color]="agent.color">
            Lancer l'agent
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </span>
        </div>

        <div class="card-glow" [style.background]="'radial-gradient(ellipse at 50% 100%, ' + agent.color + '18, transparent 70%)'"></div>
      </a>
    </div>

    <!-- Architecture section -->
    <div class="archi-section">
      <h2 class="archi-title">Architecture technique</h2>
      <div class="archi-grid">
        <div *ngFor="let tech of techStack" class="tech-item">
          <span class="tech-icon">{{ tech.icon }}</span>
          <div class="tech-info">
            <span class="tech-label">{{ tech.label }}</span>
            <span class="tech-value">{{ tech.value }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>
  `,
  styles: [`
    :host { display:block; width:100%; font-family:'Inter',sans-serif; }

    .hub-page {
      min-height: calc(100vh - 64px);
      background: var(--fp-bg);
      position: relative;
      overflow-x: hidden;
      overflow-y: auto;
      padding: 3rem 1.5rem 5rem;
    }
    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-track { background:var(--fp-card-3); }
    ::-webkit-scrollbar-thumb { background:rgba(99,102,241,.3); border-radius:6px; }
    ::-webkit-scrollbar-thumb:hover { background:rgba(99,102,241,.6); }

    .bg-orb { position:absolute; border-radius:50%; filter:blur(140px); pointer-events:none; z-index:0; }
    .orb1 { width:700px; height:700px; top:-200px; right:-150px; background:rgba(99,102,241,0.1); }
    .orb2 { width:500px; height:500px; bottom:-100px; left:-100px; background:rgba(16,185,129,0.07); }
    .orb3 { width:400px; height:400px; top:40%; left:40%; background:rgba(236,72,153,0.05); }

    .hub-wrap {
      max-width: 1160px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 3rem;
    }

    /* ── Hero ── */
    .hero { text-align:center; padding: .5rem 0 1rem; }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      background: rgba(99,102,241,.12);
      border: 1px solid rgba(99,102,241,.3);
      color: #a5b4fc;
      font-size: .72rem;
      font-weight: 700;
      padding: .3rem .9rem;
      border-radius: 20px;
      margin-bottom: 1.25rem;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .badge-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: #10b981;
      animation: pulse 2s ease infinite;
    }

    .hero-title {
      font-size: clamp(2rem, 5vw, 3.2rem);
      font-weight: 900;
      color: #f1f5f9;
      line-height: 1.1;
      margin: 0 0 1rem;
    }
    .grad {
      background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub {
      font-size: 1rem;
      color: #64748b;
      max-width: 580px;
      margin: 0 auto 1.75rem;
      line-height: 1.75;
    }
    .hero-stats {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      flex-wrap: wrap;
    }
    .stat { display:flex; flex-direction:column; align-items:center; gap:.2rem; }
    .stat-n { font-size:1.4rem; font-weight:800; color:var(--fp-text); }
    .stat-l { font-size:.68rem; color:var(--fp-text-2); text-transform:uppercase; letter-spacing:.06em; }
    .stat-sep { width:1px; height:36px; background:var(--fp-input); }

    /* ── Grid ── */
    .agents-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.25rem;
    }

    .agent-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: .9rem;
      padding: 1.5rem;
      background: var(--fp-card);
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 20px;
      text-decoration: none;
      cursor: pointer;
      transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
      overflow: hidden;
      animation: fadeUp .5s ease-out both;
    }
    .agent-card:hover {
      transform: translateY(-4px);
      border-color: var(--agent-color, #6366f1);
      box-shadow: 0 20px 50px rgba(0,0,0,.35), 0 0 0 1px var(--agent-color, #6366f1);
    }
    .agent-card:hover .card-glow { opacity: 1; }

    .card-glow {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 140px;
      opacity: 0;
      transition: opacity .3s ease;
      pointer-events: none;
    }

    .card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .agent-icon {
      width: 52px; height: 52px;
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.6rem;
      flex-shrink: 0;
    }
    .agent-badge {
      font-size: .6rem;
      font-weight: 800;
      padding: .2rem .5rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: .06em;
    }

    .card-body { display:flex; flex-direction:column; gap:.2rem; }
    .card-title {
      font-size: 1.05rem;
      font-weight: 800;
      color: #e2e8f0;
      margin: 0;
    }
    .card-sub {
      font-size: .72rem;
      font-weight: 600;
      color: var(--agent-color, #6366f1);
      margin: 0;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    .card-desc {
      font-size: .82rem;
      color: #64748b;
      line-height: 1.6;
      margin: .35rem 0 0;
    }

    .card-features {
      display: flex;
      flex-wrap: wrap;
      gap: .35rem;
    }
    .feat-tag {
      font-size: .65rem;
      font-weight: 700;
      padding: .18rem .5rem;
      border-radius: 6px;
    }

    .card-footer {
      margin-top: auto;
      padding-top: .5rem;
      border-top: 1px solid rgba(255,255,255,.05);
    }
    .cta-link {
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      font-size: .8rem;
      font-weight: 700;
      text-decoration: none;
    }
    .cta-link svg { transition: transform .2s ease; }
    .agent-card:hover .cta-link svg { transform: translateX(4px); }

    /* ── Architecture ── */
    .archi-section {
      background: var(--fp-card);
      border: 1px solid rgba(255,255,255,.06);
      border-radius: 20px;
      padding: 2rem;
    }
    .archi-title {
      font-size: .72rem;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: .1em;
      margin: 0 0 1.25rem;
    }
    .archi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: .75rem;
    }
    .tech-item {
      display: flex;
      align-items: center;
      gap: .65rem;
      padding: .6rem .85rem;
      background: rgba(255,255,255,.03);
      border: 1px solid rgba(255,255,255,.05);
      border-radius: 10px;
    }
    .tech-icon { font-size: 1.2rem; flex-shrink: 0; }
    .tech-info { display:flex; flex-direction:column; min-width:0; }
    .tech-label { font-size: .62rem; color: #475569; text-transform: uppercase; letter-spacing: .04em; }
    .tech-value { font-size: .78rem; font-weight: 700; color: #94a3b8; }

    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }

    @media (max-width:640px) {
      .agents-grid { grid-template-columns:1fr; }
      .archi-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class AgentiqueHubComponent {
  readonly agents = AGENTS;

  readonly techStack = [
    { icon: '⚡', label: 'Frontend', value: 'Angular 17' },
    { icon: '☕', label: 'Backend', value: 'Spring Boot' },
    { icon: '🤖', label: 'Orchestration', value: 'CrewAI / LangGraph' },
    { icon: '🦙', label: 'LLM Local', value: 'Ollama' },
    { icon: '🧠', label: 'LLM Cloud', value: 'Claude / GPT' },
    { icon: '📄', label: 'Documents', value: 'OnlyOffice' },
    { icon: '📊', label: 'Slides', value: 'PptxGenJS' },
    { icon: '🔍', label: 'OCR', value: 'Tesseract' },
    { icon: '🗄️', label: 'Vectoriel', value: 'Qdrant' },
    { icon: '📨', label: 'Queue', value: 'Redis' },
    { icon: '🐳', label: 'Infra', value: 'Docker Compose' },
  ];
}
