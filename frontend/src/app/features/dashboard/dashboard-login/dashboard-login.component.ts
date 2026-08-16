import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-dashboard-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard-login.component.html',
  styleUrls: ['./dashboard-login.component.css']
})
export class DashboardLoginComponent {
  loginForm: FormGroup;
  otpForm: FormGroup;
  
  step = signal<'LOGIN' | 'OTP'>('LOGIN');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });

    this.otpForm = this.fb.group({
      otpCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
  }

  requestOtp() {
    if (this.loginForm.invalid) return;
    
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const email = this.loginForm.value.email;

    // Call sendOtp first
    this.auth.sendOtp(email).subscribe({
      next: () => {
        this.step.set('OTP');
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Erreur lors de l\'envoi du code OTP.');
        this.isLoading.set(false);
      }
    });
  }

  verifyOtp() {
    if (this.otpForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    
    const { email, password } = this.loginForm.value;
    const { otpCode } = this.otpForm.value;

    this.auth.loginWithOtp(email, password, otpCode).subscribe({
      next: (user) => {
        // Admin validation
        if (user.role !== 'ADMIN') {
           this.errorMessage.set('Accès refusé : Droits administrateur requis.');
           this.auth.logout(); // Clear token immediately
           this.step.set('LOGIN');
        } else {
           this.router.navigate(['/dashboard']);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Code OTP invalide ou expiré.');
        this.isLoading.set(false);
      }
    });
  }
}
