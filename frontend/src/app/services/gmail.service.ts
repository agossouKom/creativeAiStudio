import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { DialogService } from '../shared/ui/dialog.service';

export interface GmailEmail {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  dateRaw: string;
  read: boolean;
  hasAttachment: boolean;
  labels: string[];
  // Champs enrichis côté frontend
  category?: 'urgent' | 'work' | 'commercial' | 'info' | 'spam';
}

export interface GmailStatus {
  connected: boolean;
  gmailEmail: string | null;
  connectedAt: string | null;
}

export interface GmailSendRequest {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
}

@Injectable({ providedIn: 'root' })
export class GmailService {

  private auth   = inject(AuthService);
  private dialog = inject(DialogService);

  // ── État réactif ─────────────────────────────────────────────────────────
  status   = signal<GmailStatus>({ connected: false, gmailEmail: null, connectedAt: null });
  loading  = signal(false);
  emails   = signal<GmailEmail[]>([]);

  private readonly BASE = '/api/gmail';

  // ── Headers JWT ──────────────────────────────────────────────────────────

  private get headers(): Record<string, string> {
    const token = this.auth.getToken();
    return token
      ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  // ── 1. Vérifier le statut Gmail ──────────────────────────────────────────

  async checkStatus(): Promise<GmailStatus> {
    if (!this.auth.isLoggedIn()) {
      this.status.set({ connected: false, gmailEmail: null, connectedAt: null });
      return this.status();
    }
    try {
      const res = await fetch(`${this.BASE}/status`, { headers: this.headers });
      if (res.status === 401) {
        this.auth.logout('/auth');
        return this.status();
      }
      if (res.ok) {
        const data: GmailStatus = await res.json();
        this.status.set(data);
        return data;
      }
    } catch (e) {
      console.warn('Gmail status check failed:', e);
    }
    return this.status();
  }

  // ── 2. Lancer le flux OAuth ──────────────────────────────────────────────

  async connectGmail(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) { this.dialog.alert('Connectez-vous d\'abord à votre compte Creative AI Studio.', 'Non connecté', 'warning'); return; }

    // Récupérer l'URL d'autorisation depuis le backend
    const res = await fetch(
      `/api/auth/gmail/auth/url?userId=${encodeURIComponent(user.email)}`,
      { headers: this.headers }
    );
    if (!res.ok) throw new Error('Impossible d\'obtenir l\'URL Gmail');

    const { url } = await res.json();
    // Rediriger vers Google OAuth2 (même onglet — retour via callback puis redirect)
    window.location.href = url;
  }

  // ── 3. Charger les emails ─────────────────────────────────────────────────

  loadError = signal<string | null>(null);

  async loadEmails(maxResults = 20, labelId = 'INBOX'): Promise<GmailEmail[]> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const res = await fetch(
        `${this.BASE}/emails?maxResults=${maxResults}&labelId=${labelId}`,
        { headers: this.headers }
      );
      if (res.status === 401) {
        this.auth.logout('/auth');
        return [];
      }
      if (res.status === 403) {
        this.loadError.set('Session expirée — veuillez reconnecter Gmail.');
        this.status.set({ connected: false, gmailEmail: null, connectedAt: null });
        return [];
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        this.loadError.set(`Erreur ${res.status} lors du chargement des emails.`);
        console.error('loadEmails HTTP error:', res.status, errText);
        return [];
      }
      const data: GmailEmail[] = await res.json();
      const enriched = data.map(e => ({ ...e, category: this.classify(e) }));
      this.emails.set(enriched);
      this.loadError.set(null);
      return enriched;
    } catch (e) {
      console.error('loadEmails error:', e);
      this.loadError.set('Impossible de charger les emails. Vérifiez la connexion.');
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  // ── 3b. Charger le body d'un email spécifique ────────────────────────────

  async loadEmailBody(messageId: string): Promise<string> {
    try {
      const res = await fetch(`${this.BASE}/emails/${messageId}`, { headers: this.headers });
      if (!res.ok) return '';
      const data: GmailEmail = await res.json();
      // Update the email in the signal with the full body
      this.emails.update(list =>
        list.map(e => e.id === messageId ? { ...e, body: data.body } : e)
      );
      return data.body;
    } catch (e) {
      console.error('loadEmailBody error:', e);
      return '';
    }
  }

  // ── 4. Envoyer un email ───────────────────────────────────────────────────

  async sendEmail(req: GmailSendRequest): Promise<boolean> {
    try {
      const res = await fetch(`${this.BASE}/emails/send`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(req),
      });
      return res.ok;
    } catch (e) {
      console.error('sendEmail error:', e);
      return false;
    }
  }

  // ── 5. Marquer comme lu ───────────────────────────────────────────────────

  async markRead(messageId: string): Promise<void> {
    try {
      await fetch(`${this.BASE}/emails/${messageId}/read`, {
        method: 'POST',
        headers: this.headers,
      });
      // Mettre à jour le signal local
      this.emails.update(list =>
        list.map(e => e.id === messageId ? { ...e, read: true } : e)
      );
    } catch (e) { /* best-effort */ }
  }

  // ── 6. Déconnecter ────────────────────────────────────────────────────────

  async disconnect(): Promise<void> {
    await fetch(`${this.BASE}/disconnect`, { method: 'DELETE', headers: this.headers });
    this.status.set({ connected: false, gmailEmail: null, connectedAt: null });
    this.emails.set([]);
  }

  // ── Classification automatique des emails ────────────────────────────────

  private classify(email: GmailEmail): GmailEmail['category'] {
    const subj = (email.subject + ' ' + email.snippet).toLowerCase();
    const from = email.fromEmail.toLowerCase();

    // Urgence : mots-clés + labels IMPORTANT
    if (email.labels.includes('IMPORTANT') ||
        /urgent|asap|immédiat|impératif|aujourd'hui|deadline|before|avant|dès que/.test(subj))
      return 'urgent';

    // Spam / promotions
    if (email.labels.includes('CATEGORY_PROMOTIONS') || email.labels.includes('SPAM') ||
        /unsubscribe|désabonner|promo|offre|réduction|newsletter|deal|%\s*off/.test(subj))
      return 'spam';

    // Commercial
    if (/devis|facture|commande|achat|invoice|order|payment|paiement|proposition/.test(subj) ||
        /sales@|billing@|noreply@/.test(from))
      return 'commercial';

    // Info / social
    if (email.labels.includes('CATEGORY_SOCIAL') || email.labels.includes('CATEGORY_UPDATES') ||
        /notification|update|no-reply|noreply/.test(from))
      return 'info';

    // Par défaut : travail
    return 'work';
  }

  // ── Utilitaire : lire le retour OAuth dans l'URL ──────────────────────────

  parseOAuthReturn(): { success: boolean; email: string | null; error: string | null } {
    const params = new URLSearchParams(window.location.search);
    const gmail  = params.get('gmail');
    if (!gmail) return { success: false, email: null, error: null };

    if (gmail === 'connected') {
      const email = params.get('email');
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return { success: true, email, error: null };
    }
    const msg = params.get('message') ?? 'Erreur inconnue';
    window.history.replaceState({}, document.title, window.location.pathname);
    return { success: false, email: null, error: msg };
  }
}
