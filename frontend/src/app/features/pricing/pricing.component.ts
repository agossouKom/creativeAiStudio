import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService, Produit } from '../../services/admin.service';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: { [key: string]: boolean };
}

interface Feature {
  id: string;
  label: string;
}

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="pricing-page animate-fade">
      <div class="background-glow"></div>

      <div class="pricing-container">
        <!-- Header -->
        <div class="text-center mb-12">
          <h1 class="hero-title">Identifiez sans limites</h1>
          <p class="hero-sub">Choisissez la puissance d'analyse qui correspond à vos ambitions.</p>
        </div>

        <!-- Plans Grid -->
        <div class="plans-grid">
          <div *ngFor="let plan of plans" 
               class="glass-card plan-card"
               [class.premium]="plan.id === 'premium'">
            
            <div *ngIf="plan.price > 0 && plan.price < 50" class="plan-badge">RECOMMANDÉ</div>

            <div class="plan-header">
              <h2 class="plan-name">{{ plan.name }}</h2>
              <div class="plan-price">
                <span class="currency">€</span>
                <span class="amount">{{ plan.price }}</span>
                <span class="period">/{{ plan.period }}</span>
              </div>
            </div>

            <ul class="features-list">
              <li *ngFor="let feat of allFeatures" [class.disabled]="!plan.features[feat.id]">
                <span class="check-icon">{{ plan.features[feat.id] ? '✓' : '×' }}</span>
                {{ feat.label }}
              </li>
            </ul>

            <button (click)="openSubscribe(plan)" 
                    class="subscribe-btn"
                    [class.btn-premium]="plan.price > 0">
              {{ plan.price === 0 ? 'Démarrer gratuitement' : 'Choisir ' + plan.name }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ SUBSCRIPTION MODAL (OTP + PAYMENTS) ══ -->
    <div *ngIf="showModal" class="modal-overlay animate-fade">
      <div class="modal-card">
        <button (click)="closeModal()" class="modal-close">×</button>
        
        <!-- Step 1: Email & OTP -->
        <div *ngIf="step === 1">
          <h2 class="brand-font text-2xl font-bold mb-2">Vérification Email</h2>
          <p class="text-slate-500 text-sm mb-6">Un code OTP va être envoyé à votre adresse pour valider l'abonnement.</p>
          
          <div class="space-y-4">
            <input type="email" [(ngModel)]="subEmail" class="input-premium" placeholder="votre@email.com">
            <button (click)="sendOTP()" class="w-full py-3 bg-blue-600 text-white rounded-xl font-bold" [disabled]="!subEmail">
              Envoyer le Code OTP
            </button>
          </div>
        </div>

        <!-- Step 2: Enter OTP -->
        <div *ngIf="step === 2">
          <h2 class="brand-font text-2xl font-bold mb-2">Entrez le code</h2>
          <p class="text-slate-500 text-sm mb-6">Veuillez saisir le code à 6 chiffres reçu par email.</p>
          
          <div class="space-y-4">
            <input type="text" maxlength="6" [(ngModel)]="otpCode" class="input-premium text-center tracking-[1em] text-2xl font-black" placeholder="000000">
            <button (click)="verifyOTP()" class="w-full py-3 bg-blue-600 text-white rounded-xl font-bold" [disabled]="otpCode.length < 6">
              Vérifier le code
            </button>
          </div>
        </div>

        <!-- Step 3: Payment Selection -->
        <div *ngIf="step === 3">
          <h2 class="brand-font text-2xl font-bold mb-2">Paiement Sécurisé</h2>
          <p class="text-slate-500 text-sm mb-8">Choisissez votre méthode de paiement pour activer le plan <strong>{{ selectedPlan?.name }}</strong>.</p>
          
          <div class="space-y-3">
            <button (click)="completePayment('Stripe')" class="w-full py-4 bg-[#635BFF] text-white rounded-xl font-black flex items-center justify-center gap-3">
              <span class="text-xl">💳</span> Payer avec Stripe
            </button>
            <button (click)="completePayment('PayPal')" class="w-full py-4 bg-[#0070BA] text-white rounded-xl font-black flex items-center justify-center gap-3">
              <span class="text-xl">🅿️</span> Payer avec PayPal
            </button>
          </div>
        </div>

        <!-- Step 4: Success -->
        <div *ngIf="step === 4" class="text-center py-6">
          <div class="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">✓</div>
          <h2 class="brand-font text-2xl font-bold mb-2">Félicitations !</h2>
          <p class="text-slate-500 mb-8">Votre abonnement est activé. Bienvenue chez Creative AI Studio Premium.</p>
          <button (click)="closeModal()" class="w-full py-3 bg-slate-900 text-white rounded-xl font-bold">Accéder à mon espace</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      --accent: #3b82f6;
      font-family: 'Inter', sans-serif;
    }

    .pricing-page {
      min-height: calc(100vh - 64px);
      background: var(--bg);
      padding: 4rem 1.5rem;
      position: relative;
      overflow: hidden;
      color: var(--text);
      transition: background .25s, color .25s;
    }

    .background-glow {
      position: absolute; top: -10%; left: 50%; transform: translateX(-50%);
      width: 700px; height: 700px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.04) 0%, transparent 70%);
      filter: blur(80px); pointer-events: none;
    }

    .pricing-container { max-width: 900px; margin: 0 auto; position: relative; z-index: 10; }

    .badge-pill {
      background: rgba(59, 130, 246, 0.08); color: var(--accent);
      padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 800;
      text-transform: uppercase; letter-spacing: 1px; border: 1px solid rgba(59, 130, 246, 0.1);
      display: inline-block; margin-bottom: 1rem;
    }

    .hero-title { font-size: 42px; font-weight: 900; letter-spacing: -2px; margin-bottom: 1rem; color: var(--text); }
    .hero-sub { color: var(--text-2); max-width: 500px; margin: 0 auto 3rem; }

    .plans-grid { 
      display: flex; 
      justify-content: center; 
      gap: 1.5rem; 
      flex-wrap: wrap; 
    }

    .glass-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 2.5rem;
      transition: 0.3s ease-in-out, background .25s;
      position: relative;
      width: 100%;
      max-width: 320px;
      box-shadow: 0 10px 40px var(--shadow);
    }
    .plan-card:hover { transform: translateY(-8px); border-color: var(--text-3); box-shadow: 0 20px 40px var(--shadow); }
    .plan-card.premium { border-color: var(--accent); border-width: 2px; }

    .plan-badge {
      position: absolute; top: 1rem; right: 1rem;
      background: var(--accent); color: #fff; font-size: 9px; font-weight: 900;
      padding: 3px 8px; border-radius: 4px;
    }

    .plan-name { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-2); margin-bottom: 1rem; }
    .plan-price { display: flex; align-items: baseline; gap: 4px; margin-bottom: 2rem; color: var(--text); }
    .currency { font-size: 18px; font-weight: 600; }
    .amount { font-size: 48px; font-weight: 900; letter-spacing: -2px; }
    .period { font-size: 14px; color: var(--subtext); }

    .features-list { list-style: none; margin-bottom: 2.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .features-list li { font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 12px; color: var(--text-2); }
    .features-list li.disabled { opacity: 0.3; }
    .check-icon { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; background: var(--surface); border-radius: 50%; font-size: 10px; font-weight: 800; color: var(--accent); }

    .subscribe-btn {
      width: 100%; padding: 14px; border-radius: 14px; border: 1px solid var(--border);
      background: var(--bg-2); color: var(--text); font-weight: 800; font-size: 13px; cursor: pointer; transition: 0.2s;
    }
    .subscribe-btn:hover { background: var(--surface); }
    .btn-premium { background: var(--accent); border: none; color: #fff; }
    .btn-premium:hover { background: #2563eb; transform: scale(1.02); }

    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(8px);
      z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    }
    .modal-card {
      background: var(--card-bg); border: 1px solid var(--border);
      width: 100%; max-width: 400px; padding: 2.5rem; border-radius: 24px; position: relative;
      box-shadow: 0 25px 50px var(--shadow);
      transition: background .25s;
    }
    .modal-close { position: absolute; top: 1.25rem; right: 1.25rem; border: none; background: none; color: var(--text-3); font-size: 24px; cursor: pointer; }
  `]
})
export class PricingComponent implements OnInit {
  plans: PricingPlan[] = [];
  allFeatures: Feature[] = [];
  
  // Modal State
  showModal = false;
  step = 1;
  selectedPlan: PricingPlan | null = null;
  subEmail = '';
  otpCode = '';

  constructor(private adminService: AdminService) {}

  ngOnInit() {
    this.adminService.getProduitsFront().subscribe((produits: Produit[]) => {
      if (produits.length > 0) {
        this.allFeatures = produits[0].fonctions.map((f: any) => ({
          id: f.id, 
          label: f.libelle
        }));
      }

      this.plans = produits.map((p: Produit) => {
        const planFeatures: { [key: string]: boolean } = {};
        p.fonctions.forEach((f: any) => {
          planFeatures[f.id] = f.disponible;
        });
        
        return {
          id: p.id,
          name: p.libelle,
          price: p.prix,
          period: 'mois',
          features: planFeatures
        };
      });
    });
  }

  openSubscribe(plan: PricingPlan) {
    if (plan.price === 0) return; // Free plan logic
    this.selectedPlan = plan;
    this.showModal = true;
    this.step = 1;
  }

  closeModal() { this.showModal = false; }

  sendOTP() { this.step = 2; }

  verifyOTP() { this.step = 3; }

  completePayment(method: string) {
    console.log(`Payment via ${method} completed.`);
    this.step = 4;
  }
}
