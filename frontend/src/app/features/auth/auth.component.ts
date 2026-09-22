import { Component, signal, OnInit } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { FormsModule }        from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService }        from '../../services/auth.service';
import { DialogService }      from '../../shared/ui/dialog.service';

type AuthMode = 'login' | 'register' | 'otp' | 'forgot' | 'reset';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <!-- Page de connexion premium plein écran -->
    <div class="auth-page">

      <!-- Orbes décoratives -->
      <div class="auth-orb auth-orb--1"></div>
      <div class="auth-orb auth-orb--2"></div>

      <div class="auth-card">

        <!-- Brand -->
        <div class="auth-brand">
          <div class="auth-logo">
            <svg width="48" height="48" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoG" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#6366f1"/><stop offset="1" stop-color="#0ea5e9"/>
                </linearGradient>
              </defs>
              <rect width="36" height="36" rx="10" fill="url(#logoG)"/>
              <path d="M6 26V12L12.5 21L18 12L23.5 21L30 12V26" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="29" cy="7" r="5.5" fill="#f59e0b"/>
              <path d="M30 4.5L28 7.5H30L28 10" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1 class="auth-title">Creative <span class="auth-title-ai">AI</span> Studio</h1>
          <p class="auth-subtitle">{{ getSubtitle() }}</p>
        </div>

        <!-- ════ SOCIAL BUTTONS ════ -->
        <div class="auth-social" *ngIf="mode() !== 'otp'">
          <button class="social-btn" (click)="socialLogin('Google')" type="button">
            <svg class="social-icon" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            <span>Continuer avec Google</span>
          </button>
          <button class="social-btn" (click)="socialLogin('LinkedIn')" type="button">
            <svg class="social-icon" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            <span>Continuer avec LinkedIn</span>
          </button>
          <button class="social-btn" (click)="socialLogin('X')" type="button">
            <svg class="social-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span>Continuer avec X</span>
          </button>
        </div>

        <!-- Divider -->
        <div class="auth-divider" *ngIf="mode() !== 'otp'">
          <span>ou avec email</span>
        </div>

        <!-- ════ MODE LOGIN ════ -->
        <form *ngIf="mode() === 'login'" (ngSubmit)="initiateLogin()" class="auth-form">
          <div class="field">
            <label class="field-label">Email</label>
            <input [(ngModel)]="email" name="email" type="email"
                   class="field-input" placeholder="votre@email.com" required autocomplete="email">
          </div>
          <div class="field">
            <div class="field-row">
              <label class="field-label">Mot de passe</label>
              <button type="button" class="field-link" (click)="forgotPassword()">Mot de passe oublié ?</button>
            </div>
            <input [(ngModel)]="password" name="password" type="password"
                   class="field-input" placeholder="••••••••" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn-primary" [disabled]="loading">
            {{ loading ? 'Envoi du code...' : 'Se connecter' }}
          </button>
          <button type="button" class="btn-primary btn-primary--ghost" [disabled]="loading" (click)="directLogin()">
            Connexion sans OTP (temporaire)
          </button>
        </form>

        <!-- ════ MODE REGISTER ════ -->
        <form *ngIf="mode() === 'register'" (ngSubmit)="doRegister()" class="auth-form">
          <div class="field">
            <label class="field-label">Nom complet</label>
            <input [(ngModel)]="fullName" name="fullName"
                   class="field-input" placeholder="Jean Dupont" required>
          </div>
          <div class="field">
            <label class="field-label">Email</label>
            <input [(ngModel)]="email" name="email" type="email"
                   class="field-input" placeholder="nom@entreprise.com" required autocomplete="email">
          </div>
          <div class="field">
            <label class="field-label">Mot de passe</label>
            <input [(ngModel)]="password" name="password" type="password"
                   class="field-input" placeholder="8 caractères minimum" required minlength="8" autocomplete="new-password">
          </div>
          <div class="field">
            <label class="field-label">Confirmer le mot de passe</label>
            <input [(ngModel)]="confirmPassword" name="confirmPassword" type="password"
                   class="field-input" placeholder="••••••••" required autocomplete="new-password">
          </div>
          <button type="submit" class="btn-primary btn-primary--blue" [disabled]="loading">
            {{ loading ? 'Création...' : 'Créer mon compte' }}
          </button>
        </form>

        <!-- ════ MODE OTP ════ -->
        <form *ngIf="mode() === 'otp'" (ngSubmit)="verifyOtp()" class="auth-form">
          <div class="otp-banner">
            <svg class="otp-banner-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
            <p>Un code de sécurité a été envoyé à<br><strong>{{ email }}</strong></p>
          </div>
          <div class="field">
            <label class="field-label">Code de vérification</label>
            <input [(ngModel)]="otpCode" name="otpCode" type="text" maxlength="6"
                   class="field-input field-input--otp" placeholder="000000" required inputmode="numeric">
          </div>
          <button type="submit" class="btn-primary btn-primary--blue" [disabled]="loading">
            {{ loading ? 'Vérification...' : 'Confirmer' }}
          </button>
          <button type="button" class="field-link field-link--center" (click)="resendOtp()">Renvoyer le code</button>
        </form>

        <!-- ════ MODE FORGOT ════ -->
        <form *ngIf="mode() === 'forgot'" (ngSubmit)="requestReset()" class="auth-form">
          <div class="otp-banner otp-banner--amber">
            <svg class="otp-banner-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 8a6 6 0 11-12 0 6 6 0 0112 0zM5.94 2.06a1 1 0 11-1.88-.68 1 1 0 011.88.68zM13.06 7.8a1 1 0 011.06-1.7 3 3 0 011.5 2.4 1 1 0 11-2 .02 1 1 0 00-.56-.72zM10 4a4 4 0 00-4 4v1h8V8a4 4 0 00-4-4zm-6 5v1h1v-1H4zm11 0h1v1h-1v-1zm-8.5 8.5a6.97 6.97 0 013-1.5 6.97 6.97 0 013 1.5l-.94.94A5 5 0 009 19a5.98 5.98 0 01-5-3l.5-.5z" clip-rule="evenodd"/></svg>
            <div>
              <p style="margin:0">Saisissez votre email, nous vous enverrons un<br>code de sécurité pour réinitialiser votre mot de passe.</p>
            </div>
          </div>
          <div class="field">
            <label class="field-label">Email</label>
            <input [(ngModel)]="email" name="forgotEmail" type="email"
                   class="field-input" placeholder="votre@email.com" required autocomplete="email">
          </div>
          <button type="submit" class="btn-primary" [disabled]="loading">
            {{ loading ? 'Envoi du code...' : 'Envoyer le code' }}
          </button>
        </form>

        <!-- ════ MODE RESET ════ -->
        <form *ngIf="mode() === 'reset'" (ngSubmit)="confirmReset()" class="auth-form">
          <div class="otp-banner">
            <svg class="otp-banner-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
            <p>Un code de sécurité a été envoyé à<br><strong>{{ email }}</strong></p>
          </div>
          <div class="field">
            <label class="field-label">Code de vérification</label>
            <input [(ngModel)]="otpCode" name="resetCode" type="text" maxlength="6"
                   class="field-input field-input--otp" placeholder="000000" required inputmode="numeric">
          </div>
          <div class="field">
            <label class="field-label">Nouveau mot de passe</label>
            <input [(ngModel)]="password" name="newPassword" type="password"
                   class="field-input" placeholder="8 caractères minimum" required minlength="8" autocomplete="new-password">
          </div>
          <div class="field">
            <label class="field-label">Confirmer le mot de passe</label>
            <input [(ngModel)]="confirmPassword" name="confirmPassword" type="password"
                   class="field-input" placeholder="••••••••" required autocomplete="new-password">
          </div>
          <button type="submit" class="btn-primary btn-primary--blue" [disabled]="loading">
            {{ loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe' }}
          </button>
        </form>

        <!-- ════ FOOTER ════ -->
        <div class="auth-footer">
          <ng-container *ngIf="mode() === 'login'">
            Pas encore de compte ? <button (click)="mode.set('register')" class="auth-footer-link">Créer un compte</button>
          </ng-container>
          <ng-container *ngIf="mode() === 'register'">
            Déjà membre ? <button (click)="mode.set('login')" class="auth-footer-link">Se connecter</button>
          </ng-container>
          <ng-container *ngIf="mode() === 'otp'">
            <button (click)="mode.set('login')" class="auth-footer-link auth-footer-link--muted">← Modifier mes identifiants</button>
          </ng-container>
          <ng-container *ngIf="mode() === 'forgot' || mode() === 'reset'">
            <button (click)="mode.set('login')" class="auth-footer-link auth-footer-link--muted">← Retour à la connexion</button>
          </ng-container>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }

    /* ── Fullscreen page ─────────────────────────────────── */
    .auth-page {
      position: fixed; inset: 0; z-index: 50;
      display: flex;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
      overflow-x: hidden; overflow-y: auto; padding: 2rem 1.5rem;
    }

    /* Orbes décoratives */
    .auth-orb {
      position: absolute; border-radius: 50%; filter: blur(100px); opacity: .35; pointer-events: none;
    }
    .auth-orb--1 {
      width: 500px; height: 500px; top: -15%; left: -10%;
      background: radial-gradient(circle, #6366f1, transparent 70%);
    }
    .auth-orb--2 {
      width: 450px; height: 450px; bottom: -15%; right: -8%;
      background: radial-gradient(circle, #0ea5e9, transparent 70%);
    }

    /* ── Card ─────────────────────────────────────────────── */
    .auth-card {
      position: relative; z-index: 1; margin: auto;
      width: 100%; max-width: 440px;
      background: rgba(255,255,255,0.98);
      border-radius: 24px; padding: 2.5rem;
      box-shadow: 0 25px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,0.08);
      animation: cardIn .4s ease;
    }
    @media (prefers-color-scheme: dark) {
      .auth-card { background: rgba(30,41,59,0.96); color: #e2e8f0; }
      .auth-card .field-input { background: #1e293b; border-color: #334155; color: #e2e8f0; }
      .auth-card .field-input::placeholder { color: #64748b; }
      .auth-card .auth-subtitle, .auth-card .field-label, .auth-card .auth-footer { color: #94a3b8; }
    }

    @keyframes cardIn {
      from { opacity: 0; transform: translateY(12px) scale(.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ── Brand ────────────────────────────────────────────── */
    .auth-brand { text-align: center; margin-bottom: 1.75rem; }
    .auth-logo {
      width: 60px; height: 60px; margin: 0 auto 1rem;
      display: flex; align-items: center; justify-content: center;
      border-radius: 16px;
      background: linear-gradient(135deg, #6366f1, #0ea5e9);
      box-shadow: 0 8px 24px rgba(99,102,241,0.3);
    }
    .auth-logo svg { width: 32px; height: 32px; }
    .auth-title {
      font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 .25rem; letter-spacing: -.02em;
    }
    .auth-title-ai { color: #6366f1; }
    .auth-subtitle {
      font-size: .82rem; font-weight: 600; color: #64748b; margin: 0;
    }

    /* ── Social buttons ───────────────────────────────────── */
    .auth-social { display: flex; flex-direction: column; gap: .65rem; margin-bottom: 1.25rem; }
    .social-btn {
      display: flex; align-items: center; gap: .75rem;
      width: 100%; padding: .7rem 1rem;
      border: 1.5px solid #e2e8f0; border-radius: 12px;
      background: #fff; cursor: pointer; font-weight: 600; font-size: .85rem; color: #334155;
      transition: background .15s, border-color .15s, box-shadow .15s;
    }
    .social-btn:hover { background: #f8fafc; border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
    @media (prefers-color-scheme: dark) {
      .social-btn { background: #1e293b; border-color: #334155; color: #e2e8f0; }
      .social-btn:hover { background: #334155; }
    }
    .social-icon { width: 20px; height: 20px; flex-shrink: 0; }

    /* ── Divider ──────────────────────────────────────────── */
    .auth-divider {
      display: flex; align-items: center; gap: 1rem;
      margin-bottom: 1.25rem; color: #94a3b8; font-size: .72rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: .08em;
    }
    .auth-divider::before, .auth-divider::after {
      content: ''; flex: 1; height: 1px; background: #e2e8f0;
    }
    @media (prefers-color-scheme: dark) {
      .auth-divider::before, .auth-divider::after { background: #334155; }
    }

    /* ── Form ─────────────────────────────────────────────── */
    .auth-form { display: flex; flex-direction: column; gap: 1rem; }
    .field { display: flex; flex-direction: column; gap: .3rem; }
    .field-row { display: flex; justify-content: space-between; align-items: center; }
    .field-label { font-size: .75rem; font-weight: 800; color: #334155; text-transform: uppercase; letter-spacing: .04em; }
    .field-link {
      background: none; border: none; padding: 0; cursor: pointer;
      font-size: .75rem; font-weight: 700; color: #6366f1;
      transition: color .15s;
    }
    .field-link:hover { color: #4f46e5; text-decoration: underline; }
    .field-link--center { display: block; text-align: center; margin-top: -.25rem; }
    .field-input {
      width: 100%; padding: .8rem 1rem; border: 1.5px solid #e2e8f0; border-radius: 12px;
      background: #f8fafc; font-size: .95rem; font-weight: 600; color: #0f172a;
      outline: none; transition: border-color .15s, box-shadow .15s;
    }
    .field-input::placeholder { color: #94a3b8; }
    .field-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
    .field-input--otp {
      text-align: center; font-size: 1.6rem; letter-spacing: .55em; font-weight: 800;
      padding: .9rem 1rem;
    }

    /* OTP banner */
    .otp-banner {
      display: flex; align-items: center; gap: .75rem;
      padding: .85rem 1rem; background: #eff6ff; border-radius: 12px;
      font-size: .82rem; font-weight: 600; color: #1e40af; margin-bottom: .75rem;
    }
    .otp-banner--amber {
      background: #fffbeb; color: #92400e;
    }
    .otp-banner strong { font-weight: 800; }
    .otp-banner-icon { width: 22px; height: 22px; flex-shrink: 0; color: #3b82f6; }
    @media (prefers-color-scheme: dark) {
      .otp-banner { background: rgba(99,102,241,.15); color: #93aaf7; }
      .otp-banner--amber { background: rgba(217,119,6,.15); color: #fbbf24; }
      .otp-banner-icon { color: #818cf8; }
    }

    /* ── Buttons ──────────────────────────────────────────── */
    .btn-primary {
      width: 100%; padding: .85rem; margin-top: .25rem;
      background: #0f172a; color: #fff; border: none; border-radius: 12px;
      font-weight: 800; font-size: .82rem; text-transform: uppercase; letter-spacing: .06em;
      cursor: pointer; transition: background .15s, transform .1s, opacity .15s;
    }
    .btn-primary:hover { background: #1e293b; }
    .btn-primary:active { transform: scale(.985); }
    .btn-primary:disabled { opacity: .55; cursor: not-allowed; }
    .btn-primary--blue { background: linear-gradient(135deg, #6366f1, #0ea5e9); }
    .btn-primary--blue:hover { filter: brightness(1.05); }
    .btn-primary--ghost {
      margin-top: .4rem;
      background: transparent; border: 1px dashed #475569; color: #94a3b8;
      font-size: .78rem; letter-spacing: .04em;
    }
    .btn-primary--ghost:hover { background: rgba(100,116,139,.12); color: #cbd5e1; }

    /* ── Footer ───────────────────────────────────────────── */
    .auth-footer {
      text-align: center; margin-top: 1.5rem;
      font-size: .85rem; font-weight: 600; color: #64748b;
    }
    .auth-footer-link {
      background: none; border: none; padding: 0; cursor: pointer;
      font-weight: 800; color: #6366f1; transition: color .15s;
    }
    .auth-footer-link:hover { color: #4f46e5; text-decoration: underline; }
    .auth-footer-link--muted { color: #64748b; }
    .auth-footer-link--muted:hover { color: #475569; }
  `]
})
export class AuthComponent implements OnInit {
  mode     = signal<AuthMode>('login');
  email    = '';
  password = '';
  confirmPassword = '';
  fullName = '';
  otpCode  = '';
  loading  = false;
  otpOrigin: 'LOGIN' | 'REGISTER' | 'RESET' = 'LOGIN';

  constructor(private authService: AuthService, private router: Router, private dialog: DialogService) {}

  ngOnInit() {}

  getSubtitle() {
    switch(this.mode()) {
      case 'login':    return 'Connectez-vous à votre espace';
      case 'register': return 'Rejoignez l\'infrastructure IA';
      case 'otp':      return 'Vérification en deux étapes';
      case 'forgot':   return 'Récupération de votre compte';
      case 'reset':    return 'Nouveau mot de passe';
    }
  }

  directLogin() {
    if (!this.email || !this.password) return;
    this.loading = true;
    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.role === 'ADMIN') {
          this.router.navigate(['/dashboard']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.dialog.alert(err.error?.message || "Email ou mot de passe incorrect.", 'Connexion', 'error');
      }
    });
  }

  initiateLogin() {
    if (!this.email || !this.password) return;
    this.loading = true;
    this.authService.sendOtp(this.email).subscribe({
      next: () => {
        this.loading = false;
        this.otpOrigin = 'LOGIN';
        this.mode.set('otp');
      },
      error: (err) => {
        this.loading = false;
        this.dialog.alert(err.error?.message || "Erreur lors de l'envoi du code.", 'Connexion', 'error');
      }
    });
  }

  doRegister() {
    if (this.password !== this.confirmPassword) {
      this.dialog.alert('Les mots de passe ne correspondent pas.', 'Inscription', 'error');
      return;
    }
    this.loading = true;
    this.authService.register(this.fullName, this.email, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.otpOrigin = 'REGISTER';
        this.mode.set('otp');
      },
      error: (err) => {
        this.loading = false;
        this.dialog.alert(err.error?.message || "Erreur lors de l'inscription.", 'Inscription', 'error');
      }
    });
  }

  verifyOtp() {
    if (!this.otpCode) return;
    this.loading = true;

    const obs = this.otpOrigin === 'LOGIN'
      ? this.authService.loginWithOtp(this.email, this.password, this.otpCode)
      : this.authService.verifyRegistration(this.email, this.otpCode);

    obs.subscribe({
      next: (res) => {
        this.loading = false;
        if (res.role === 'ADMIN') {
          this.router.navigate(['/dashboard']);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.dialog.alert(err.error?.message || "Code invalide ou expiré.", 'Vérification', 'error');
      }
    });
  }

  resendOtp() {
    this.authService.sendOtp(this.email).subscribe(() => this.dialog.alert('Code renvoyé !', '', 'success'));
  }

  forgotPassword() {
    this.email = '';
    this.mode.set('forgot');
  }

  requestReset() {
    if (!this.email) return;
    this.loading = true;
    this.authService.requestPasswordReset(this.email).subscribe({
      next: () => {
        this.loading = false;
        this.otpOrigin = 'RESET';
        this.otpCode = '';
        this.password = '';
        this.confirmPassword = '';
        this.mode.set('reset');
      },
      error: (err) => {
        this.loading = false;
        this.dialog.alert(err.error?.message || "Erreur lors de l'envoi du code.", 'Réinitialisation', 'error');
      }
    });
  }

  confirmReset() {
    if (!this.otpCode || !this.password) return;
    if (this.password !== this.confirmPassword) {
      this.dialog.alert('Les mots de passe ne correspondent pas.', 'Réinitialisation', 'error');
      return;
    }
    this.loading = true;
    this.authService.resetPassword(this.email, this.otpCode, this.password).subscribe({
      next: () => {
        this.loading = false;
        this.mode.set('login');
        this.dialog.alert('Mot de passe réinitialisé avec succès. Connectez-vous avec votre nouveau mot de passe.', 'Succès', 'success');
      },
      error: (err) => {
        this.loading = false;
        this.dialog.alert(err.error?.message || "Erreur lors de la réinitialisation.", 'Réinitialisation', 'error');
      }
    });
  }

  socialLogin(provider: string) {
    this.dialog.alert(
      `Connexion avec ${provider} bientôt disponible.\nUtilisez l'authentification par email en attendant.`,
      `${provider} Login`,
      'info'
    );
  }
}
