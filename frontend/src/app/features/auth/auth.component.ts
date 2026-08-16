import { Component, signal, OnInit } from '@angular/core';
import { CommonModule }       from '@angular/common';
import { FormsModule }        from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService }        from '../../services/auth.service';
import { DialogService }      from '../../shared/ui/dialog.service';

type AuthMode = 'login' | 'register' | 'otp';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-page animate-fade">
      <div class="auth-card border border-slate-200 shadow-2xl">
        <!-- Header -->
        <div class="text-center mb-8">
          <div class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 shadow-lg shadow-blue-200">
            M
          </div>
          <h1 class="brand-font text-3xl font-bold text-slate-900 mb-2">Creative AI Studio</h1>
          <p class="text-slate-500 font-semibold">
            {{ getSubtitle() }}
          </p>
        </div>

        <!-- Mode Login -->
        <form *ngIf="mode() === 'login'" (ngSubmit)="initiateLogin()" class="space-y-4">
          <div class="space-y-1.5">
            <label class="text-xs font-black text-slate-900 uppercase tracking-wide ml-1">Email</label>
            <input [(ngModel)]="email" name="email" type="email"
                   class="input-premium border-2 focus:border-blue-600" placeholder="votre@email.com" required>
          </div>
          <div class="space-y-1.5">
            <div class="flex justify-between items-center px-1">
              <label class="text-xs font-black text-slate-900 uppercase tracking-wide">Mot de passe</label>
              <a href="#" class="text-[10px] font-black text-blue-600 uppercase hover:underline">Oublié ?</a>
            </div>
            <input [(ngModel)]="password" name="password" type="password"
                   class="input-premium border-2 focus:border-blue-600" placeholder="••••••••" required>
          </div>
          
          <button type="submit" class="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transform active:scale-[0.98] transition-all mt-6 shadow-xl shadow-slate-200" [disabled]="loading">
            {{ loading ? 'Envoi du code...' : 'Vérifier mes accès' }}
          </button>
        </form>

        <!-- Mode Register -->
        <form *ngIf="mode() === 'register'" (ngSubmit)="doRegister()" class="space-y-4">
          <div class="space-y-1.5">
            <label class="text-xs font-black text-slate-900 uppercase tracking-wide ml-1">Nom Complet</label>
            <input [(ngModel)]="fullName" name="fullName" class="input-premium border-2 focus:border-blue-600" placeholder="Damien Martin" required>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-black text-slate-900 uppercase tracking-wide ml-1">Email Professionnel</label>
            <input [(ngModel)]="email" name="email" type="email" class="input-premium border-2 focus:border-blue-600" placeholder="nom@entreprise.com" required>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-black text-slate-900 uppercase tracking-wide ml-1">Mot de passe</label>
            <input [(ngModel)]="password" name="password" type="password" class="input-premium border-2 focus:border-blue-600" placeholder="8+ caractères" required minlength="8">
          </div>
          
          <button type="submit" class="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transform active:scale-[0.98] transition-all mt-6 shadow-xl shadow-blue-100" [disabled]="loading">
            {{ loading ? 'Inscription...' : 'Créer le compte' }}
          </button>
        </form>

        <!-- Mode OTP -->
        <form *ngIf="mode() === 'otp'" (ngSubmit)="verifyOtp()" class="space-y-4">
          <div class="bg-blue-50 p-4 rounded-xl mb-6 text-center">
            <p class="text-xs font-bold text-blue-700">
              Un code de sécurité a été envoyé à :<br>
              <span class="text-blue-900">{{ email }}</span>
            </p>
          </div>
          
          <div class="space-y-1.5">
            <label class="text-xs font-black text-slate-900 uppercase tracking-wide ml-1">Code de vérification (OTP)</label>
            <input [(ngModel)]="otpCode" name="otpCode" type="text" maxlength="6"
                   class="input-premium border-2 focus:border-blue-600 text-center text-2xl tracking-[1em] font-bold" 
                   placeholder="000000" required>
          </div>
          
          <button type="submit" class="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 transform active:scale-[0.98] transition-all mt-6 shadow-xl shadow-blue-100" [disabled]="loading">
            {{ loading ? 'Vérification...' : 'Confirmer' }}
          </button>
          
          <button type="button" (click)="resendOtp()" class="w-full text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors py-2">
            Renvoyer le code
          </button>
        </form>

        <!-- Google Auth (Hidden in OTP) -->
        <div *ngIf="mode() !== 'otp'">
          <div class="flex items-center gap-4 my-6">
            <div class="flex-1 h-px bg-slate-200"></div>
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">OU</span>
            <div class="flex-1 h-px bg-slate-200"></div>
          </div>

          <button (click)="socialLogin('Google')" class="w-full flex items-center justify-center gap-3 py-3.5 border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-bold text-slate-700">
            <img src="https://www.google.com/favicon.ico" class="w-5 h-5">
            Continuer avec Google
          </button>
        </div>

        <!-- Footer -->
        <div class="text-center mt-8">
          <p class="text-slate-500 font-bold text-sm">
            <ng-container *ngIf="mode() === 'login'">
              Nouveau ici ? <button (click)="mode.set('register')" class="text-blue-600 hover:underline">Créer un compte</button>
            </ng-container>
            <ng-container *ngIf="mode() === 'register'">
              Déjà membre ? <button (click)="mode.set('login')" class="text-blue-600 hover:underline">Se connecter</button>
            </ng-container>
            <ng-container *ngIf="mode() === 'otp'">
              <button (click)="mode.set('login')" class="text-slate-400 hover:text-slate-600">← Modifier mes identifiants</button>
            </ng-container>
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .auth-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: var(--bg-2); padding: 2rem; transition: background .25s;
    }
    .auth-card {
      background: var(--card-bg); width: 100%; max-width: 440px; padding: 3rem;
      border-radius: 40px; border: 1px solid var(--border);
      box-shadow: 0 20px 40px var(--shadow); transition: background .25s, border-color .25s;
    }
    .input-premium {
      width: 100%; padding: 1rem 1.25rem; background: var(--surface);
      border: 1.5px solid var(--input-border); border-radius: 12px;
      color: var(--text); font-weight: 600; outline: none; transition: all 0.2s;
    }
    .input-premium:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 4px rgba(59,130,246,.1);
    }
  `]
})
export class AuthComponent implements OnInit {
  mode     = signal<AuthMode>('login');
  email    = '';
  password = '';
  fullName = '';
  otpCode  = '';
  loading  = false;
  otpOrigin: 'LOGIN' | 'REGISTER' = 'LOGIN';

  constructor(private authService: AuthService, private router: Router, private dialog: DialogService) {}

  ngOnInit() {}

  getSubtitle() {
    switch(this.mode()) {
      case 'login': return 'Sécurisez votre session Creative AI Studio';
      case 'register': return 'Rejoignez l\'infrastructure AI';
      case 'otp': return 'Code de sécurité requis';
    }
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

  socialLogin(provider: string) {
    this.dialog.alert("Veuillez utiliser l'authentification standard pour le dashboard administrateur.", 'Connexion sociale', 'info');
  }
}
