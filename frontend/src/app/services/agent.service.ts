import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

export interface AgentStreamOptions {
  onChunk: (chunk: string) => void;
  onDone: () => void;
  onError?: (err: string) => void;
}

/** Provider LLM résolu côté backend (agent > équipe > compte > admin). */
export interface ResolvedLlmProvider {
  type?: string;
  modelId?: string;
}

export interface UserContext {
  name: string;
  email: string;
  role: string;
  credits: number;
  isLoggedIn: boolean;
  llmProvider?: ResolvedLlmProvider;
}

/**
 * Service central pour tous les agents IA.
 *
 * PRIORITÉ des appels :
 *  1. /api/agent/<agent>/stream  (AgentController Spring Boot — Groq live)
 *  2. Fallback /api/rag/chat/stream  (même LLM, prompt métier construit ici)
 *  3. Mock local  (si backend totalement indisponible)
 *
 * Contexte utilisateur injecté dans TOUS les prompts pour une réponse personnalisée.
 */
@Injectable({ providedIn: 'root' })
export class AgentService {

  private readonly AGENT_BASE = '/api/agent';
  private readonly RAG_STREAM = '/api/rag/chat/stream';

  private auth   = inject(AuthService);
  private http   = inject(HttpClient);

  /** Provider LLM réellement résolu par le backend, mis en cache. */
  private readonly llmProvider = signal<ResolvedLlmProvider | undefined>(undefined);

  // ── Contexte session courante ────────────────────────────────────────────

  getUserContext(): UserContext {
    const user = this.auth.currentUser();
    if (!user) {
      return { name: '', email: '', role: '', credits: 0, isLoggedIn: false };
    }
    return {
      name: user.fullName,
      email: user.email,
      role: user.role,
      credits: user.credits,
      isLoggedIn: true,
      llmProvider: this.llmProvider(),
    };
  }

  /**
   * Demande au backend quel provider il utilise réellement pour cet agent
   * (agent > équipe > compte > admin) et le met en cache pour l'affichage.
   *
   * <p>Un 404 signifie qu'aucun modèle n'est configuré pour le compte : le
   * bandeau reste masqué plutôt que d'afficher un modèle fictif.
   */
  async refreshLlmProvider(agentId?: string): Promise<ResolvedLlmProvider | undefined> {
    if (!this.auth.isLoggedIn()) return undefined;
    const params: Record<string, string> = agentId ? { agentId } : {};
    try {
      const p = await firstValueFrom(
        this.http.get<ResolvedLlmProvider>('/api/users/me/llm-providers/resolved', { params })
      );
      this.llmProvider.set(p);
      return p;
    } catch {
      this.llmProvider.set(undefined);
      return undefined;
    }
  }

  /** Bloc de contexte utilisateur injecté en tête de chaque prompt système */
  private buildUserBlock(): string {
    const u = this.getUserContext();
    if (!u.isLoggedIn) {
      return '[CONTEXTE UTILISATEUR]\nUtilisateur non connecté — si on te demande qui il est, invite-le à se connecter pour profiter de toutes les fonctionnalités.';
    }
    return `[CONTEXTE UTILISATEUR]
Nom complet : ${u.name}
Email       : ${u.email}
Rôle        : ${u.role}
Crédits     : ${u.credits}
Utilise ces informations si l'utilisateur pose des questions sur lui-même (son nom, email, rôle...).
Si tu génères une réponse à un email, signe avec le nom "${u.name}" par défaut.`;
  }

  // ── Point d'entrée principal ──────────────────────────────────────────────

  async streamAgent(
    agent: 'email' | 'resume' | 'marketing' | 'slides' | 'prospection' | 'cv',
    content: string,
    type: string,
    context: string,
    opts: AgentStreamOptions
  ): Promise<void> {
    // Enrichir le contexte avec les infos de session
    const userBlock = this.buildUserBlock();
    const enrichedContext = `${userBlock}\n\n${context}`.trim();

    const body = JSON.stringify({ content, type, context: enrichedContext });
    const url  = `${this.AGENT_BASE}/${agent}/stream`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Transmettre le JWT si disponible (pour futures routes authentifiées)
          ...(this.auth.getToken() ? { 'Authorization': `Bearer ${this.auth.getToken()}` } : {}),
        },
        body,
      });

      if (res.status === 404) {
        await this.streamViaRag(agent, content, type, enrichedContext, opts);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      await this.consumeSSE(res, opts);

    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('404') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        await this.streamViaRag(agent, content, type, enrichedContext, opts).catch(() => {
          opts.onChunk(this.getMock(agent, type, content));
          opts.onDone();
        });
      } else {
        opts.onError?.(msg);
        opts.onChunk(this.getMock(agent, type, content));
        opts.onDone();
      }
    }
  }

  // ── Fallback RAG chat avec prompt métier ─────────────────────────────────

  private async streamViaRag(
    agent: string, content: string, type: string, context: string,
    opts: AgentStreamOptions
  ): Promise<void> {
    const question = this.buildRagPrompt(agent, content, type, context);
    const res = await fetch(this.RAG_STREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) throw new Error(`RAG HTTP ${res.status}`);
    await this.consumeSSE(res, opts);
  }

  private buildRagPrompt(agent: string, content: string, type: string, context: string): string {
    // Extraire le nom utilisateur du contexte s'il est disponible
    const nameMatch = context.match(/Nom complet\s*:\s*(.+)/);
    const userName = nameMatch ? nameMatch[1].trim() : '';
    const signOff  = userName ? `\n\nCordialement,\n${userName}` : '\n\nCordialement';

    const prompts: Record<string, Record<string, string>> = {
      email: {
        summary: `${context}\n\nRésume cet email en 3 points clés (bullet points) en français :\n\n${content}`,
        reply:   `${context}\n\nRédige une réponse professionnelle et concise à cet email en français. Signe avec le nom indiqué dans le contexte utilisateur.${signOff}\n\nEmail à répondre :\n${content}`,
        task:    `${context}\n\nExtrais toutes les tâches et actions concrètes à réaliser depuis cet email (bullet points avec priorité) :\n\n${content}`,
        urgency: `${context}\n\nÉvalue le niveau d'urgence de cet email : CRITIQUE / ÉLEVÉ / MODÉRÉ / FAIBLE / NUL. Justifie en 2 phrases.\n\n${content}`,
      },
      resume: {
        full: `${context}\n\nTu es expert en analyse documentaire. Analyse ce texte et fournis :\n**RÉSUMÉ EXÉCUTIF** :\n**DÉCISIONS CLÉS** :\n**ACTIONS À ENTREPRENDRE** :\n**MOTS-CLÉS** :\n\nTexte :\n${content}`,
      },
      marketing: {
        social:   `${context}\n\nCrée un post professionnel et percutant sur : ${content}. Max 300 mots, emojis, CTA.`,
        seo:      `${context}\n\nRédige un article SEO optimisé sur : ${content}. Structure : H1, intro, 3 sections H2, conclusion.`,
        hashtags: `${context}\n\nGénère 15 hashtags pertinents pour : ${content}. Format : #hashtag.`,
        campaign: `${context}\n\nCrée un email marketing pour : ${content}. Objet A/B, accroche, corps, CTA.`,
        script:   `${context}\n\nÉcris un script vidéo YouTube 2 min sur : ${content}. Hook, problème, solution, CTA.`,
      },
      slides: {
        default: `${context}\n\nGénère le contenu de slides pour : ${content}. Format : [SLIDE N] Type: ...\nTitre: ...\n• Point 1\n• Point 2`,
      },
      prospection: {
        linkedin: `${context}\n\nMessage LinkedIn de prospection (max 300 car.) pour : ${content}. Direct, humain.`,
        email:    `${context}\n\nEmail de prospection froid pour : ${content}. Objet + corps structuré. Max 200 mots.`,
        followup: `${context}\n\nRelance professionnelle non-intrusive pour : ${content}. Max 100 mots.`,
      },
      cv: {
        full: `${context}\n\nTu es expert RH. Analyse ce CV :\n**SCORE** : X/100\n**ATS** : X%\n**SECTIONS** :\n**POINTS FORTS** :\n**À AMÉLIORER** :\n**POSTES SUGGÉRÉS** :\n\nCV :\n${content}`,
      },
    };

    const agentMap = prompts[agent] ?? {};
    return agentMap[type] ?? agentMap['full'] ?? agentMap['default']
      ?? `${context}\n\nAnalyse ce contenu en français pour l'agent ${agent} :\n${content}`;
  }

  // ── Consommateur SSE ─────────────────────────────────────────────────────

  private async consumeSSE(res: Response, opts: AgentStreamOptions): Promise<void> {
    const reader  = res.body!.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const l = line.trimEnd();
        if (!l.startsWith('data:')) continue;
        const chunk = l.slice(5);
        if (chunk === '[DONE]') { opts.onDone(); return; }
        opts.onChunk(chunk.length > 0 ? chunk : '\n');
      }
    }
    opts.onDone();
  }

  // ── Mock local ──────────────────────────────────────────────────────────

  getMock(agent: string, type: string, content: string): string {
    const u = this.getUserContext();
    const name = u.isLoggedIn ? u.name : 'Visiteur';
    const first60 = content.substring(0, 60).trim();

    const mocks: Record<string, Record<string, string>> = {
      email: {
        summary:  `**Résumé pour ${name} :**\n\n• Point clé 1 identifié\n• Point clé 2 identifié\n• Action requise détectée\n\n_Connectez le backend pour l'analyse Groq._`,
        reply:    `Bonjour,\n\nMerci pour votre message. Je reviens vers vous rapidement.\n\nCordialement,\n${name}`,
        task:     `✅ **Tâches pour ${name} :**\n• Tâche 1 à planifier\n• Tâche 2 à déléguer`,
        urgency:  `🟡 **MODÉRÉ** — Email à traiter sous 24-48h.`,
      },
      resume:     { full: `**RÉSUMÉ** : "${first60}…"\n**DÉCISIONS** :\n• Point 1\n**ACTIONS** :\n1. Action` },
      marketing:  { default: `Post pour : "${first60}…"\n\nContenu disponible avec le backend.` },
      slides:     { default: `[SLIDE 1] ${first60}\n• Point 1\n• Point 2` },
      prospection:{ default: `Message pour "${first60}" disponible avec le backend.` },
      cv:         { full: `**SCORE** : 72/100\n**ATS** : 68%\n\nAnalyse complète disponible avec le backend.` },
    };
    return mocks[agent]?.[type] ?? mocks[agent]?.['full'] ?? mocks[agent]?.['default']
      ?? '_Backend agent non disponible_';
  }
}
