import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgentService } from '../../services/agent.service';
import { AgentSessionBarComponent } from '../../shared/components/agent-session-bar/agent-session-bar.component';

interface ContentResult {
  type: string;
  icon: string;
  content: string;
  hashtags?: string[];
  platform?: string;
}

@Component({
  selector: 'app-agent-marketing',
  standalone: true,
  imports: [CommonModule, FormsModule, AgentSessionBarComponent],
  template: `
<div class="mkt-page">
  <div class="bg-orb orb1"></div>
  <div class="bg-orb orb2"></div>

  <app-agent-session-bar></app-agent-session-bar>

  <div class="mkt-wrap">

    <!-- Header -->
    <div class="page-header">
      <div class="agent-icon">📈</div>
      <div>
        <h1 class="page-title">Agent Marketing Digital</h1>
        <p class="page-sub">Génération de contenu IA pour réseaux sociaux, SEO, campagnes et scripts</p>
      </div>
    </div>

    <div class="mkt-cols">

      <!-- Config -->
      <div class="config-panel">

        <div class="section">
          <div class="section-title">📌 Sujet / Produit</div>
          <textarea class="big-input" [(ngModel)]="topic" rows="3"
                    placeholder="Décrivez votre produit, service ou sujet marketing…"></textarea>
        </div>

        <div class="section">
          <div class="section-title">🎯 Type de contenu</div>
          <div class="content-types">
            <button *ngFor="let ct of contentTypes" class="ct-btn"
                    [class.active]="selectedTypes.includes(ct.id)"
                    (click)="toggleType(ct.id)"
                    [style.--ctc]="ct.color">
              {{ ct.icon }} {{ ct.label }}
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-title">📣 Plateforme cible</div>
          <div class="platform-btns">
            <button *ngFor="let p of platforms" class="plat-btn"
                    [class.active]="selectedPlatform === p.id"
                    (click)="selectedPlatform = p.id">
              {{ p.icon }} {{ p.label }}
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-title">🎨 Ton de communication</div>
          <div class="tone-btns">
            <button *ngFor="let t of tones" class="tone-btn"
                    [class.active]="selectedTone === t.id"
                    (click)="selectedTone = t.id">
              {{ t.label }}
            </button>
          </div>
        </div>

        <div class="section">
          <div class="section-title">🌐 Langue</div>
          <select class="form-select" [(ngModel)]="language">
            <option>Français</option>
            <option>Anglais</option>
            <option>Espagnol</option>
          </select>
        </div>

        <button class="generate-btn" (click)="generate()" [disabled]="generating || !topic.trim() || selectedTypes.length === 0">
          <span *ngIf="!generating">⚡ Générer le contenu</span>
          <span *ngIf="generating" class="spin-wrap"><span class="btn-spin"></span> Génération en cours…</span>
        </button>
      </div>

      <!-- Results -->
      <div class="results-col">
        <div *ngIf="results.length === 0 && !generating" class="results-empty">
          <div class="empty-icon">✨</div>
          <h3 class="empty-title">Prêt à générer</h3>
          <p class="empty-sub">Configurez votre contenu et cliquez sur "Générer"</p>
          <div class="features-list">
            <div *ngFor="let f of features" class="feature-item">
              <span class="feat-ico">{{ f.icon }}</span>
              <div>
                <span class="feat-name">{{ f.name }}</span>
                <span class="feat-desc">{{ f.desc }}</span>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="generating" class="generating-state">
          <div class="gen-spinner"></div>
          <span class="gen-label">L'agent génère votre contenu…</span>
          <div class="gen-progress">
            <div class="gen-bar" [style.width.%]="genProgress"></div>
          </div>
        </div>

        <div *ngIf="results.length > 0 && !generating" class="results-list">
          <div *ngFor="let r of results; let i = index" class="result-card" [style.animation-delay]="(i * 0.08) + 's'">
            <div class="rc-header">
              <span class="rc-type-icon">{{ r.icon }}</span>
              <span class="rc-type-label">{{ r.type }}</span>
              <span *ngIf="r.platform" class="rc-platform">{{ r.platform }}</span>
              <div class="rc-actions">
                <button class="rc-btn" (click)="copyResult(r, i)" [class.copied]="copiedIdx === i">
                  {{ copiedIdx === i ? '✓' : '📋' }}
                </button>
                <button class="rc-btn" (click)="refreshResult(i)">🔄</button>
              </div>
            </div>
            <div class="rc-content">{{ r.content }}</div>
            <div *ngIf="r.hashtags && r.hashtags.length > 0" class="rc-hashtags">
              <span *ngFor="let h of r.hashtags" class="hashtag">#{{ h }}</span>
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
    .mkt-page { height:calc(100vh - 64px); background:var(--fp-bg); position:relative; overflow:hidden; display:flex; flex-direction:column; }
    .bg-orb { position:absolute; border-radius:50%; filter:blur(130px); pointer-events:none; z-index:0; }
    .orb1 { width:600px; height:600px; top:-150px; right:-100px; background:rgba(245,158,11,.08); }
    .orb2 { width:500px; height:500px; bottom:-100px; left:-100px; background:rgba(236,72,153,.06); }
    .mkt-wrap { flex:1; min-height:0; max-width:1200px; width:100%; margin:0 auto; position:relative; z-index:1; display:flex; flex-direction:column; gap:1.25rem; padding:1.5rem 1.5rem 0; overflow:hidden; }

    .page-header { display:flex; align-items:center; gap:1rem; }
    .agent-icon { width:48px; height:48px; background:linear-gradient(135deg,#f59e0b,#d97706); border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; flex-shrink:0; }
    .page-title { font-size:1.5rem; font-weight:900; color:var(--fp-text); margin:0; }
    .page-sub { font-size:.8rem; color:var(--fp-text-2); margin:.2rem 0 0; }

    .mkt-cols { flex:1; min-height:0; display:grid; grid-template-columns:340px 1fr; gap:1.25rem; overflow:hidden; padding-bottom:1.5rem; }
    @media(max-width:900px) { .mkt-cols { grid-template-columns:1fr; overflow:visible; } }

    /* scrollbars colonnes */
    ::-webkit-scrollbar { width:5px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(245,158,11,.25); border-radius:5px; } ::-webkit-scrollbar-thumb:hover { background:rgba(245,158,11,.5); }

    .config-panel {
      overflow-y:auto; overflow-x:hidden;
      background:var(--fp-card);
      border:1px solid var(--fp-border);
      border-radius:16px;
      padding:1.25rem;
      display:flex;
      flex-direction:column;
      gap:1.1rem;
      height:fit-content;
    }

    .section { display:flex; flex-direction:column; gap:.5rem; }
    .section-title { font-size:.68rem; font-weight:800; color:var(--fp-text-2); text-transform:uppercase; letter-spacing:.08em; }

    .big-input {
      background:var(--fp-input);
      border:1px solid var(--fp-border);
      border-radius:10px;
      padding:.65rem .85rem;
      color:var(--fp-text);
      font-size:.82rem;
      line-height:1.6;
      resize:vertical;
      outline:none;
      font-family:inherit;
      transition:.15s;
    }
    .big-input:focus { border-color:rgba(245,158,11,.4); box-shadow:0 0 0 3px rgba(245,158,11,.06); }
    .big-input::placeholder { color:#374151; }

    .content-types { display:flex; flex-wrap:wrap; gap:.4rem; }
    .ct-btn {
      background:var(--fp-input);
      border:1px solid var(--fp-border);
      color:var(--fp-text-2);
      font-size:.72rem;
      font-weight:700;
      padding:.3rem .65rem;
      border-radius:8px;
      cursor:pointer;
      transition:.15s;
    }
    .ct-btn:hover { color:var(--fp-text-2); border-color:rgba(255,255,255,.15); }
    .ct-btn.active { background:rgba(245,158,11,.15); border-color:rgba(245,158,11,.4); color:#fbbf24; }

    .platform-btns, .tone-btns { display:flex; flex-wrap:wrap; gap:.35rem; }
    .plat-btn, .tone-btn {
      background:var(--fp-input);
      border:1px solid var(--fp-border);
      color:var(--fp-text-2);
      font-size:.72rem;
      font-weight:600;
      padding:.28rem .6rem;
      border-radius:8px;
      cursor:pointer;
      transition:.15s;
    }
    .plat-btn:hover, .tone-btn:hover { color:var(--fp-text-2); }
    .plat-btn.active { background:rgba(14,165,233,.15); border-color:rgba(14,165,233,.4); color:#38bdf8; }
    .tone-btn.active { background:rgba(139,92,246,.15); border-color:rgba(139,92,246,.4); color:#c4b5fd; }

    .form-select {
      background:var(--fp-input);
      border:1px solid var(--fp-border);
      border-radius:8px;
      padding:.45rem .7rem;
      color:var(--fp-text);
      font-size:.8rem;
      outline:none;
      font-family:inherit;
    }
    .form-select option { background:#1e293b; }

    .generate-btn {
      background:linear-gradient(135deg,#f59e0b,#d97706);
      color:#000;
      border:none;
      border-radius:10px;
      padding:.65rem 1.2rem;
      font-size:.85rem;
      font-weight:800;
      cursor:pointer;
      transition:.15s;
      display:flex; align-items:center; justify-content:center; gap:.5rem;
    }
    .generate-btn:hover:not(:disabled) { opacity:.88; transform:translateY(-1px); }
    .generate-btn:disabled { opacity:.45; cursor:not-allowed; transform:none; }
    .spin-wrap { display:flex; align-items:center; gap:.5rem; }
    .btn-spin { width:14px; height:14px; border:2px solid rgba(0,0,0,.3); border-top-color:#000; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; }

    /* ── Results ── */
    .results-col { display:flex; flex-direction:column; gap:1rem; overflow-y:auto; overflow-x:hidden; }

    .results-empty {
      background:var(--fp-card-2);
      border:1px solid var(--fp-border);
      border-radius:16px;
      padding:2.5rem;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:.75rem;
      text-align:center;
      flex:1;
    }
    .empty-icon { font-size:2.5rem; }
    .empty-title { font-size:1rem; font-weight:800; color:var(--fp-text-2); margin:0; }
    .empty-sub { font-size:.8rem; color:var(--fp-text-3); margin:0; }
    .features-list { display:flex; flex-direction:column; gap:.6rem; margin-top:.5rem; text-align:left; width:100%; max-width:380px; }
    .feature-item { display:flex; align-items:flex-start; gap:.6rem; padding:.5rem; background:rgba(255,255,255,.02); border-radius:8px; }
    .feat-ico { font-size:1.1rem; flex-shrink:0; }
    .feat-name { display:block; font-size:.78rem; font-weight:700; color:var(--fp-text-2); }
    .feat-desc { display:block; font-size:.7rem; color:#374151; }

    .generating-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; flex:1; min-height:300px; }
    .gen-spinner { width:40px; height:40px; border:4px solid rgba(245,158,11,.2); border-top-color:#f59e0b; border-radius:50%; animation:spin .7s linear infinite; }
    .gen-label { font-size:.85rem; color:var(--fp-text-2); font-style:italic; }
    .gen-progress { width:200px; height:4px; background:var(--fp-input); border-radius:20px; overflow:hidden; }
    .gen-bar { height:100%; background:linear-gradient(90deg,#f59e0b,#fbbf24); border-radius:20px; transition:width .3s ease; }

    .results-list { display:flex; flex-direction:column; gap:.85rem; }
    .result-card {
      background:var(--fp-card);
      border:1px solid var(--fp-border);
      border-radius:14px;
      overflow:hidden;
      animation:fadeUp .4s ease-out both;
    }
    .rc-header {
      display:flex; align-items:center; gap:.5rem;
      padding:.65rem 1rem;
      background:rgba(255,255,255,.02);
      border-bottom:1px solid var(--fp-border);
    }
    .rc-type-icon { font-size:1rem; }
    .rc-type-label { font-size:.72rem; font-weight:800; color:var(--fp-text-2); text-transform:uppercase; letter-spacing:.06em; flex:1; }
    .rc-platform { font-size:.62rem; font-weight:700; background:rgba(14,165,233,.12); color:#38bdf8; padding:.15rem .45rem; border-radius:5px; }
    .rc-actions { display:flex; gap:.3rem; }
    .rc-btn { background:var(--fp-input); border:1px solid var(--fp-border); color:var(--fp-text-2); font-size:.75rem; width:26px; height:26px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:.15s; }
    .rc-btn:hover { color:#a5b4fc; border-color:rgba(99,102,241,.3); }
    .rc-btn.copied { color:#10b981; border-color:rgba(16,185,129,.3); }
    .rc-content { padding:1rem; font-size:.83rem; color:var(--fp-text-2); line-height:1.72; white-space:pre-wrap; }
    .rc-hashtags { padding:.5rem 1rem .85rem; display:flex; flex-wrap:wrap; gap:.3rem; }
    .hashtag { font-size:.68rem; font-weight:700; color:#818cf8; background:rgba(99,102,241,.1); padding:.15rem .45rem; border-radius:5px; }

    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  `]
})
export class AgentMarketingComponent {
  constructor(private agentSvc: AgentService, private cdr: ChangeDetectorRef) {}

  topic = '';
  selectedTypes: string[] = ['social'];
  selectedPlatform = 'linkedin';
  selectedTone = 'pro';
  language = 'Français';
  generating = false;
  genProgress = 0;
  results: ContentResult[] = [];
  copiedIdx: number | null = null;

  readonly contentTypes = [
    { id: 'social',    icon: '📱', label: 'Post réseaux sociaux', color: '#818cf8' },
    { id: 'seo',       icon: '🔍', label: 'Article SEO',          color: '#10b981' },
    { id: 'hashtags',  icon: '#',  label: 'Hashtags',             color: '#f59e0b' },
    { id: 'campaign',  icon: '📣', label: 'Campagne email',        color: '#ec4899' },
    { id: 'script',    icon: '🎬', label: 'Script vidéo',         color: '#0ea5e9' },
  ];

  readonly platforms = [
    { id: 'linkedin',  icon: '💼', label: 'LinkedIn' },
    { id: 'instagram', icon: '📸', label: 'Instagram' },
    { id: 'twitter',   icon: '🐦', label: 'X/Twitter' },
    { id: 'facebook',  icon: '👥', label: 'Facebook' },
  ];

  readonly tones = [
    { id: 'pro',    label: 'Professionnel' },
    { id: 'casual', label: 'Décontracté' },
    { id: 'humor',  label: 'Humour' },
    { id: 'expert', label: 'Expert' },
  ];

  readonly features = [
    { icon: '📱', name: 'Posts réseaux sociaux', desc: 'LinkedIn, Instagram, Facebook, X' },
    { icon: '🔍', name: 'Contenu SEO optimisé',  desc: 'Articles avec mots-clés ciblés' },
    { icon: '📣', name: 'Campagnes email',       desc: 'Objets et corps d\'email A/B testables' },
    { icon: '🎬', name: 'Scripts vidéo',         desc: 'YouTube, TikTok, Reels' },
    { icon: '#',  name: 'Générateur hashtags',   desc: 'Hashtags tendance et pertinents' },
  ];

  toggleType(id: string) {
    const idx = this.selectedTypes.indexOf(id);
    if (idx >= 0) this.selectedTypes.splice(idx, 1);
    else this.selectedTypes.push(id);
  }

  async generate() {
    if (!this.topic.trim() || this.selectedTypes.length === 0) return;
    this.generating = true;
    this.results = [];
    this.genProgress = 0;

    const interval = setInterval(() => {
      if (this.genProgress < 85) this.genProgress += 5;
    }, 200);

    // Générer chaque type sélectionné via le backend
    const generated: ContentResult[] = [];
    for (const type of this.selectedTypes) {
      try {
        const result = await this.callAgentBackend(type);
        generated.push(result);
      } catch {
        generated.push(this.buildResult(type)); // fallback mock
      }
    }

    clearInterval(interval);
    this.genProgress = 100;
    await new Promise(r => setTimeout(r, 200));
    this.results = generated;
    this.generating = false;
  }

  private callAgentBackend(type: string): Promise<ContentResult> {
    const platform = this.platforms.find(p => p.id === this.selectedPlatform)?.label ?? 'LinkedIn';
    const ct = this.contentTypes.find(c => c.id === type);

    return new Promise((resolve) => {
      let content = '';
      this.agentSvc.streamAgent(
        'marketing',
        this.topic,
        type,
        `Plateforme: ${platform} | Ton: ${this.selectedTone} | Langue: ${this.language}`,
        {
          onChunk: (chunk) => { content += chunk; this.cdr.detectChanges(); },
          onDone: () => resolve({
            type: ct?.label ?? type,
            icon: ct?.icon ?? '✨',
            platform,
            content: content.trim(),
            hashtags: type === 'hashtags'
              ? content.match(/#\w+/g)?.map(h => h.slice(1)) ?? []
              : type === 'social' ? [this.topic.split(' ')[0], 'Marketing', 'IA'] : [],
          }),
          onError: () => resolve(this.buildResult(type)),
        }
      );
    });
  }

  private buildResult(type: string): ContentResult {
    const platform = this.platforms.find(p => p.id === this.selectedPlatform)?.label ?? 'LinkedIn';
    const t = this.topic;
    const toneMap: Record<string,string> = {
      pro: 'Dans un contexte professionnel en constante évolution,',
      casual: 'Vous savez quoi ? Je viens de découvrir quelque chose d\'incroyable sur',
      humor: 'Spoiler : votre concurrent ne veut pas que vous lisiez ça sur',
      expert: 'Selon les dernières études sectorielles,',
    };
    const intro = toneMap[this.selectedTone] ?? toneMap['pro'];

    const templates: Record<string, ContentResult> = {
      social: {
        type: 'Post réseau social',
        icon: '📱',
        platform,
        content: `${intro} ${t}.\n\n✅ Point clé 1 : Adoptez une approche centrée sur la valeur\n✅ Point clé 2 : Mesurez vos résultats en temps réel\n✅ Point clé 3 : Automatisez pour scaler\n\n💡 Les entreprises qui ont adopté cette stratégie ont vu +47% de leads qualifiés en 90 jours.\n\nPartagez si vous trouvez ça utile ! 👇`,
        hashtags: ['MarketingDigital', 'IA', 'Croissance', 'Business', t.split(' ')[0]],
      },
      seo: {
        type: 'Article SEO',
        icon: '🔍',
        content: `**${t} : Guide Complet 2025**\n\nIntroduction : ${t} est devenu un enjeu majeur pour les entreprises modernes.\n\n## Pourquoi ${t} est essentiel\nDans un marché compétitif, les organisations qui maîtrisent ${t} obtiennent un avantage concurrentiel durable.\n\n## Les 5 étapes clés\n1. Analyse de la situation actuelle\n2. Définition des objectifs SMART\n3. Mise en place des outils adaptés\n4. Suivi des KPIs\n5. Optimisation continue\n\n**Conclusion** : En appliquant ces principes, vous transformerez votre approche de ${t}.`,
        hashtags: [],
      },
      hashtags: {
        type: 'Hashtags optimisés',
        icon: '#',
        platform,
        content: 'Hashtags générés pour maximiser votre portée :',
        hashtags: [t.replace(/\s+/g,''), 'Marketing2025', 'DigitalMarketing', 'Startup', 'Entrepreneur', 'Innovation', 'Growth', 'Business', 'IA', 'Automatisation'],
      },
      campaign: {
        type: 'Campagne email',
        icon: '📣',
        content: `**Objet A :** Vous perdez du temps sur ${t} — voici la solution\n**Objet B :** [EXCLUSIF] Notre guide gratuit sur ${t}\n\n---\n\nBonjour [Prénom],\n\nEn tant que professionnel, vous savez que ${t} peut faire la différence.\n\nNous avons compilé les meilleures pratiques en un guide actionnable :\n→ Stratégie en 5 étapes\n→ Outils recommandés\n→ Cas clients réels\n\n[Télécharger le guide gratuit →]\n\nÀ votre succès,\nL'équipe Marketing`,
        hashtags: [],
      },
      script: {
        type: 'Script vidéo',
        icon: '🎬',
        content: `[INTRO — 0:00-0:15]\n"Bonjour, aujourd'hui on parle de ${t} — et à la fin de cette vidéo vous aurez une feuille de route complète."\n\n[PROBLÈME — 0:15-0:45]\n"Beaucoup d'entreprises se trompent sur ${t}. Elles font X alors qu'il faut faire Y."\n\n[SOLUTION — 0:45-2:00]\n"Voici les 3 étapes qui fonctionnent vraiment : [Étape 1]... [Étape 2]... [Étape 3]..."\n\n[CALL TO ACTION — 2:00-2:15]\n"Likez, partagez et dites-moi en commentaire : quelle étape vous semble la plus difficile ?"`,
        hashtags: [],
      },
    };
    return templates[type] ?? templates['social'];
  }

  async copyResult(r: ContentResult, idx: number) {
    const text = [r.content, ...(r.hashtags?.map(h => '#'+h) ?? [])].join('\n');
    await navigator.clipboard.writeText(text).catch(() => {});
    this.copiedIdx = idx;
    setTimeout(() => this.copiedIdx = null, 2000);
  }

  async refreshResult(idx: number) {
    const type = this.selectedTypes[idx] ?? this.selectedTypes[0];
    this.results[idx] = this.buildResult(type);
  }
}
