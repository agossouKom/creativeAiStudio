import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-overlay">
      <div class="premium-card auth-card">
        <h2>{{ isLogin ? 'Welcome Back' : 'Create Account' }}</h2>
        <p class="subtitle">{{ isLogin ? 'Sign in to continue to DocFusion' : 'Start your enterprise journey today' }}</p>
        
        <form (ngSubmit)="onSubmit()">
          <div class="input-group">
            <label>Email Address</label>
            <input type="email" [(ngModel)]="authData.email" name="email" placeholder="name@company.com" required>
          </div>
          
          <div class="input-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="authData.password" name="password" placeholder="••••••••" required>
          </div>
          
          <button type="submit" class="btn-primary w-full">{{ isLogin ? 'Sign In' : 'Register' }}</button>
        </form>
        
        <div class="footer">
          <span>{{ isLogin ? "Don't have an account?" : "Already have an account?" }}</span>
          <button (click)="toggleMode()" class="btn-link">{{ isLogin ? 'Sign Up' : 'Log In' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.9);
      backdrop-filter: blur(10px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .auth-card {
      width: 100%;
      max-width: 450px;
      padding: 3rem;
    }
    h2 {
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #94a3b8;
      margin-bottom: 2rem;
    }
    .input-group {
      margin-bottom: 1.5rem;
      text-align: left;
    }
    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #cbd5e1;
    }
    input {
      width: 100%;
      padding: 0.75rem 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: white;
      outline: none;
      transition: border-color 0.3s ease;
    }
    input:focus {
      border-color: #6366f1;
    }
    .w-full {
      width: 100%;
      margin-top: 1rem;
    }
    .footer {
      margin-top: 2rem;
      font-size: 0.875rem;
      color: #94a3b8;
    }
    .btn-link {
      background: none;
      border: none;
      color: #6366f1;
      font-weight: 600;
      cursor: pointer;
      margin-left: 0.5rem;
    }
  `]
})
export class AuthComponent {
  isLogin = true;
  authData = { email: '', password: '' };

  constructor(private authService: AuthService) {}

  toggleMode() {
    this.isLogin = !this.isLogin;
  }

  onSubmit() {
    if (this.isLogin) {
      this.authService.login(this.authData).subscribe(res => {
        console.log('Logged in', res);
        // Redirect or close modal
      });
    } else {
      this.authService.register(this.authData).subscribe(res => {
        console.log('Registered', res);
        // Redirect or close modal
      });
    }
  }
}
