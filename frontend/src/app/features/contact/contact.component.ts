import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { DialogService } from '../../shared/ui/dialog.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="contact-page animate-fade">
      <div class="contact-card">
        <div class="text-center mb-8">
          <h1 class="title">Contactez-nous</h1>
          <p class="sub">Notre équipe vous répond sous 24 heures.</p>
        </div>

        <form (ngSubmit)="submitContact()" class="contact-form">
          <div class="form-group">
            <label>Nom Complet</label>
            <input [(ngModel)]="contactForm.name" name="name" class="modern-input" placeholder="Votre nom" required>
          </div>
          
          <div class="form-group">
            <label>Email</label>
            <input [(ngModel)]="contactForm.email" name="email" type="email" class="modern-input" placeholder="votre@email.com" required>
          </div>
          
          <div class="form-group">
            <label>Sujet</label>
            <select [(ngModel)]="contactForm.subject" name="subject" class="modern-input" required>
              <option value="support">Support Technique</option>
              <option value="billing">Facturation</option>
              <option value="demo">Demande de Démo</option>
              <option value="other">Autre</option>
            </select>
          </div>

          <div class="form-group">
            <label>Message</label>
            <textarea [(ngModel)]="contactForm.message" name="message" rows="4" class="modern-input" placeholder="Comment pouvons-nous vous aider ?" required></textarea>
          </div>

          <button type="submit" class="submit-btn" [disabled]="loading">
            {{ loading ? 'Envoi...' : 'Envoyer le message' }}
          </button>
        </form>

        <div *ngIf="success" class="success-message">
          ✓ Votre message a été transmis avec succès.
        </div>
      </div>
    </div>
  `,
  styles: [`
    .contact-page {
      min-height: calc(100vh - 64px); background: var(--bg);
      display: flex; align-items: center; justify-content: center;
      padding: 3rem 1.5rem; transition: background .25s;
    }
    .contact-card {
      width: 100%; max-width: 500px;
      background: var(--card-bg); border: 1px solid var(--border);
      border-radius: 24px; padding: 3rem;
      box-shadow: 0 10px 40px var(--shadow);
      transition: background .25s, border-color .25s;
    }
    .title { font-size: 28px; font-weight: 800; color: var(--text); margin-bottom: 0.5rem; }
    .sub { color: var(--text-2); font-size: 14px; }

    .contact-form { display: flex; flex-direction: column; gap: 1.25rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .form-group label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-3); letter-spacing: 0.5px; }

    .modern-input {
      width: 100%; padding: 12px 16px; border: 1px solid var(--input-border); border-radius: 12px;
      font-size: 14px; font-family: 'Inter', sans-serif; transition: 0.2s;
      background: var(--bg-2); color: var(--text);
    }
    .modern-input::placeholder { color: var(--text-3); }
    .modern-input:focus { border-color: #3b82f6; outline: none; background: var(--card-bg); box-shadow: 0 0 0 4px rgba(59,130,246,.08); }

    .submit-btn {
      width: 100%; padding: 14px; background: #3b82f6; color: #fff; border: none;
      border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; transition: 0.2s;
      margin-top: 1rem;
    }
    .submit-btn:hover { background: #2563eb; transform: translateY(-1px); }
    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .success-message {
      margin-top: 1.5rem; padding: 12px; background: rgba(16,185,129,.08);
      color: #10b981; border-radius: 10px; text-align: center; font-size: 13px; font-weight: 700;
    }
  `]
})
export class ContactComponent {
  contactForm = { name: '', email: '', subject: 'support', message: '' };
  loading = false;
  success = false;

  constructor(private adminService: AdminService, private dialog: DialogService) {}

  submitContact() {
    this.loading = true;
    
    const req = {
      nomComplet: this.contactForm.name,
      email: this.contactForm.email,
      sujet: this.contactForm.subject,
      message: this.contactForm.message
    };

    this.adminService.createContact(req).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        this.contactForm = { name: '', email: '', subject: 'support', message: '' };
        setTimeout(() => this.success = false, 5000);
      },
      error: () => {
        this.loading = false;
        this.dialog.alert("Une erreur est survenue lors de l'envoi du message.", 'Erreur', 'error');
      }
    });
  }
}
