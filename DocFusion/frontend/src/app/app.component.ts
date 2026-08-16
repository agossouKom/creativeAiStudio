import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { HeroComponent } from './components/hero.component';
import { FeaturesComponent } from './components/features.component';
import { AuthService } from './services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, HeroComponent, FeaturesComponent, CommonModule],
  template: `
    <div class="gradient-bg"></div>
    <div class="gradient-sphere" style="top: 10%; left: 10%;"></div>
    <div class="gradient-sphere" style="bottom: 10%; right: 10%;"></div>
    
    <nav class="navbar">
      <div class="logo">DocFusion</div>
      <div class="nav-links">
        <a href="#" *ngIf="!authService.isLoggedIn()">Solutions</a>
        <a href="#" *ngIf="!authService.isLoggedIn()">Pricing</a>
        <a href="#" *ngIf="!authService.isLoggedIn()">Docs</a>
        <a routerLink="/dashboard" *ngIf="authService.isLoggedIn()">My Documents</a>
        
        <ng-container *ngIf="authService.isLoggedIn(); else loginBtn">
          <span class="user-email">{{ authService.getCurrentUser()?.email }}</span>
          <button class="btn-outline-sm" (click)="authService.logout()">Logout</button>
        </ng-container>
        
        <ng-template #loginBtn>
          <button class="btn-primary" routerLink="/auth">Sign In</button>
        </ng-template>
      </div>
    </nav>

    <main>
      <app-hero></app-hero>
      <app-features></app-features>
    </main>

    <router-outlet />
  `,
  styles: [`
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 4rem;
      position: fixed;
      top: 0;
      width: 100%;
      box-sizing: border-box;
      z-index: 100;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .logo {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -1px;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 2rem;
    }
    .nav-links a {
      color: #94a3b8;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.3s ease;
    }
    .nav-links a:hover {
      color: white;
    }
    .user-email {
      font-weight: 600;
      color: #6366f1;
    }
    .btn-outline-sm {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      padding: 0.4rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      cursor: pointer;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'frontend';

  constructor(public authService: AuthService) {}

  ngOnInit() {
    this.authService.getMe().subscribe({
      next: (user) => console.log('Session restored', user),
      error: () => console.log('No active session')
    });
  }
}
