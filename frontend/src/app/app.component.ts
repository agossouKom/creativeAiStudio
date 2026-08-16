import { Component, OnInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { SidebarAdComponent } from './shared/components/sidebar-ad/sidebar-ad.component';
import { AuthService } from './services/auth.service';
import { GameChromeService } from './services/game-chrome.service';
import { DialogHostComponent } from './shared/ui/dialog-host.component';
import { GamepadKeyboardBridgeService } from './features/games/gamepad-keyboard-bridge.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarAdComponent, DialogHostComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  isAdmin   = false;
  isPremium = false;
  showDropdown = false;
  megaOpen     = false;
  agentiqueOpen = false;
  isDark = false;

  /** Routes sans aucune sidebar (cv-builder, creative-studio, docfusion, rag-chat, agentique) */
  private noSidebarRoutes = ['/creative-studio', '/cv-builder', '/card-builder', '/docfusion', '/rag-chat', '/agentique', '/games'];
  currentUrl = '';

  /** Vrai quand la page est chargée avec ?embed=1 (iframe dans le workspace) */
  get isEmbedded(): boolean {
    return new URLSearchParams(window.location.search).get('embed') === '1';
  }

  get hideAllSidebars(): boolean {
    return this.noSidebarRoutes.some(r => this.currentUrl.startsWith(r));
  }

  /** Alias conservé pour compatibilité */
  get hideRightSidebar(): boolean { return this.hideAllSidebars; }

  /** Le jeu de football est en plein écran : pas de pied de page */
  get isFootballGame(): boolean {
    return this.currentUrl.startsWith('/games/football');
  }

  /** Vrai quand une page (ex: match de foot en cours) a demandé à masquer l'en-tête pour le plein écran */
  chromeHeaderHidden = false;

  constructor(
    private router: Router,
    public authService: AuthService,
    private cdr: ChangeDetectorRef,
    private gameChrome: GameChromeService,
    // Injecté uniquement pour le démarrer avec l'appli (providedIn:'root', jamais
    // utilisé directement ici) : traduit la manette en évènements clavier pour
    // toute la galerie de mini-jeux, cf. gamepad-keyboard-bridge.service.ts.
    private gamepadBridge: GamepadKeyboardBridgeService,
  ) {}

  toggleChromeHeader(): void {
    if (this.chromeHeaderHidden) {
      this.gameChrome.showHeader();
    } else {
      this.gameChrome.hideHeader();
    }
  }

  get currentUser() {
    return this.authService.currentUser();
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get userName(): string {
    return this.currentUser?.fullName || 'Utilisateur';
  }

  get userInitials(): string {
    if (!this.currentUser || !this.currentUser.fullName) return 'U';
    const parts = this.currentUser.fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  get userRoleLabel(): string {
    const role = this.currentUser?.role;
    if (role === 'ROLE_ADMIN')    return 'Administrateur';
    if (role === 'ROLE_PREMIUM')  return 'Premium';
    return 'Membre';
  }

  get userRoleBadgeClass(): string {
    const role = this.currentUser?.role;
    if (role === 'ROLE_ADMIN')   return 'badge-admin';
    if (role === 'ROLE_PREMIUM') return 'badge-premium';
    return 'badge-member';
  }

  get userCredits(): number {
    return this.currentUser?.credits ?? 0;
  }

  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
    if (this.showDropdown) this.megaOpen = false;
  }

  closeDropdown() {
    this.showDropdown = false;
  }

  toggleMega() {
    this.megaOpen = !this.megaOpen;
    if (this.megaOpen) { this.showDropdown = false; this.agentiqueOpen = false; }
  }

  closeMega() {
    this.megaOpen = false;
    this.cdr.detectChanges();
  }

  toggleAgentique() {
    this.agentiqueOpen = !this.agentiqueOpen;
    if (this.agentiqueOpen) { this.showDropdown = false; this.megaOpen = false; }
  }

  closeAgentique() {
    this.agentiqueOpen = false;
    this.cdr.detectChanges();
  }

  @HostListener('document:click')
  onDocClick() {
    if (this.megaOpen) this.megaOpen = false;
    if (this.agentiqueOpen) this.agentiqueOpen = false;
  }

  logout() {
    this.showDropdown = false;
    this.authService.logout();
  }

  toggleTheme() {
    this.isDark = !this.isDark;
    const theme = this.isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cas-theme', theme);
  }

  ngOnInit() {
    const saved = localStorage.getItem('cas-theme') || 'light';
    this.isDark = saved === 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentUrl = event.url;
      // Fermer les menus à chaque navigation
      this.megaOpen    = false;
      this.showDropdown = false;
      // Détecter si on est sur le dashboard admin
      this.isAdmin = event.url.includes('/dashboard');
      this.agentiqueOpen = false;

      // Appliquer la classe sur le body pour le design global
      if (this.isAdmin) {
        document.body.classList.add('admin-mode');
        document.body.classList.remove('public-mode');
      } else {
        document.body.classList.add('public-mode');
        document.body.classList.remove('admin-mode');
      }
    });

    this.gameChrome.headerHidden$.subscribe((hidden) => {
      this.chromeHeaderHidden = hidden;
      this.cdr.detectChanges();
    });
  }
}
