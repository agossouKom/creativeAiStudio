import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { forkJoin } from 'rxjs';
Chart.register(...registerables);

import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AdminService, User, Entreprise, Contact, Pub, Promotion, Resultat, HistoryEntry, Categorie, Fonction, Produit, ClientPub, Vente, UserSession, SocialLink } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="dash-container">

      <!-- ══ SIDEBAR ══════════════════════════════════════════ -->
      <aside class="dash-sidebar">
        <div class="sb-logo">
          <div class="logo-box"></div>
          <span class="sb-title">Creative AI Studio AI</span>
        </div>

        <nav class="sb-nav">
          <p class="sb-section-label">Général</p>
          <a class="sb-item" routerLink="/">🏠 <span>Accueil</span></a>
          <a class="sb-item" [class.active]="tab==='overview'" (click)="tab='overview'">📊 <span>Aperçu</span></a>

          <p class="sb-section-label">Catalogue</p>
          <a class="sb-item" [class.active]="tab==='produits'" (click)="tab='produits'">📦 <span>Produits</span></a>
          <a class="sb-item" [class.active]="tab==='categories'" (click)="tab='categories'">📂 <span>Catégories</span></a>
          <a class="sb-item" [class.active]="tab==='fonctions'" (click)="tab='fonctions'">⚙️ <span>Fonctions</span></a>

          <p class="sb-section-label">CRM</p>
          <a class="sb-item" [class.active]="tab==='entreprises'" (click)="tab='entreprises'">🏢 <span>Entreprises</span></a>

          <p class="sb-section-label">Utilisateurs</p>
          <a class="sb-item" [class.active]="tab==='users'" (click)="tab='users'">👥 <span>Utilisateurs</span></a>
          <a class="sb-item" [class.active]="tab==='sessions'" (click)="tab='sessions'">🔐 <span>Sessions</span></a>

          <p class="sb-section-label">Marketing</p>
          <a class="sb-item" [class.active]="tab==='promos'" (click)="tab='promos'">🏷️ <span>Promotions</span></a>
          <a class="sb-item" [class.active]="tab==='ads'" (click)="tab='ads'">📢 <span>Publicités</span></a>
          <a class="sb-item" [class.active]="tab==='clientpubs'" (click)="tab='clientpubs'">🤝 <span>Annonceurs</span></a>
          <a class="sb-item" [class.active]="tab==='sociallinks'" (click)="tab='sociallinks'; loadSocialLinks()">🌐 <span>Réseaux Sociaux</span></a>

          <p class="sb-section-label">Business</p>
          <a class="sb-item" [class.active]="tab==='ventes'" (click)="tab='ventes'">💰 <span>Ventes</span></a>
          <a class="sb-item" [class.active]="tab==='contacts'" (click)="tab='contacts'">📧 <span>Messages</span></a>

          <p class="sb-section-label">Système</p>
          <a class="sb-item" [class.active]="tab==='llm'" (click)="tab='llm'; loadLlmProviders()">🔑 <span>Providers LLM</span></a>
          <a class="sb-item" [class.active]="tab==='api'" (click)="tab='api'">📖 <span>Swagger</span></a>
          <a class="sb-item" href="http://localhost:3002" target="_blank">📈 <span>Grafana</span></a>
        </nav>

        <div class="sb-footer" *ngIf="authService.currentUser() as user">
          <div class="sb-profile">
            <div class="sb-avatar">{{ user.fullName[0] | uppercase }}</div>
            <div class="sb-uinfo">
              <div class="sb-uname">{{ user.fullName }}</div>
              <div class="sb-urole">{{ user.role }}</div>
            </div>
            <button class="logout-btn" (click)="logout()">🚪</button>
          </div>
        </div>
      </aside>

      <!-- ══ MAIN CONTENT ════════════════════════════════════ -->
      <main class="dash-main">
        
        <header class="dash-header">
          <div class="status-pill"><span class="pulse"></span> Système Opérationnel</div>
          <div class="flex gap-3">
             <button class="btn-secondary btn-sm" (click)="loadAll()">Sync</button>
          </div>
        </header>

        <div class="content-area">

        <!-- ── OVERVIEW ── -->
        <div *ngIf="tab==='overview'" class="tab-pane">
          <div class="page-header">
            <div>
              <h1 class="page-title">Tableau de Bord</h1>
              <p class="page-sub">Bienvenue sur la console d'administration Creative AI Studio.</p>
            </div>
            <div class="header-actions">
              <div class="status-pill"><span class="pulse"></span>Système en ligne</div>
              <button class="btn-primary" (click)="loadAll()">Rafraîchir</button>
            </div>
          </div>

          <!-- Stats Cards -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-top"><span class="stat-label">Utilisateurs</span><span class="stat-trend">+100%</span></div>
              <div class="stat-value">{{ users.length }}</div>
              <div class="stat-bar"><div class="stat-bar-fill" style="width: 100%"></div></div>
            </div>
            <div class="stat-card">
              <div class="stat-top"><span class="stat-label">Entreprises</span><span class="stat-trend">Nouveau</span></div>
              <div class="stat-value">{{ entreprises.length }}</div>
              <div class="stat-bar"><div class="stat-bar-fill" style="width: 100%; background: #22c55e"></div></div>
            </div>
            <div class="stat-card">
              <div class="stat-top"><span class="stat-label">Contacts</span><span class="stat-trend">{{ getUnhandledCount() }} non lus</span></div>
              <div class="stat-value">{{ contacts.length }}</div>
              <div class="stat-bar"><div class="stat-bar-fill" style="width: 100%; background: #f59e0b"></div></div>
            </div>
            <div class="stat-card">
              <div class="stat-top"><span class="stat-label">Uptime</span><span class="stat-trend">Stable</span></div>
              <div class="stat-value">99.9%</div>
              <div class="stat-bar"><div class="stat-bar-fill" style="width: 100%"></div></div>
            </div>
          </div>

          <!-- Charts Grid -->
          <div class="charts-grid">
            <div class="card chart-card">
              <div class="card-header">
                <h2 class="card-title">Croissance Utilisateurs</h2>
              </div>
              <div class="chart-container">
                <canvas id="userGrowthChart"></canvas>
              </div>
            </div>
            <div class="card chart-card">
              <div class="card-header">
                <h2 class="card-title">Activité Système</h2>
              </div>
              <div class="chart-container">
                <canvas id="activityChart"></canvas>
              </div>
            </div>
          </div>

          <!-- Recent Users Table -->
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">Utilisateurs Récents</h2>
              <button class="link-btn" (click)="tab='users'">Tout voir →</button>
            </div>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  <tr *ngFor="let u of users | slice:0:5">
                    <td>
                      <div class="user-cell">
                        <div class="user-ava">{{ u.fullName[0] }}</div>
                        <span>{{ u.fullName }}</span>
                      </div>
                    </td>
                    <td>{{ u.email }}</td>
                    <td><span class="role-badge">{{ u.role }}</span></td>
                    <td>
                      <div class="action-btns">
                        <button class="btn-sm btn-block" (click)="revokeSessions(u.id)" title="Révoquer sessions">⚡</button>
                        <button class="btn-sm btn-revoke" (click)="deleteUser(u.id)" title="Supprimer">🗑️</button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ── UTILISATEURS ── -->
        <div *ngIf="tab==='users'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Gestion des Utilisateurs</h1><p class="page-sub">Contrôle des comptes utilisateurs et accès système.</p></div>
            <button class="btn-primary" (click)="openAddUser()">+ Nouvel Utilisateur</button>
          </div>

          <div class="toolbar card">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Nom ou email...">
            </div>
            <div class="filters">
              <select [(ngModel)]="roleFilter" class="filter-select">
                <option value="ALL">Tous les rôles</option>
                <option value="ADMIN">Administrateurs</option>
                <option value="USER">Utilisateurs</option>
              </select>
              <select [(ngModel)]="userStatusFilter" class="filter-select">
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actifs</option>
                <option value="DELETED">Supprimés</option>
              </select>
            </div>
          </div>

          <div class="card">
            <table class="data-table">
              <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Crédits</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let u of filteredUsers">
                  <td>
                    <div class="user-cell">
                      <div class="user-ava bg-blue-900">{{ u.fullName[0] }}</div>
                      <div>
                        <div class="font-bold text-white">{{ u.fullName }}</div>
                        <div class="text-[10px] text-slate-500">{{ u.email }}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="role-badge">{{ u.role }}</span></td>
                  <td><span class="font-bold text-emerald-400">{{ u.credits }}</span></td>
                  <td><span class="badge" [class.badge-on]="u.enabled" [class.badge-off]="!u.enabled">{{ u.enabled ? 'ACTIF' : 'INACTIF' }}</span></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm btn-block" (click)="openEditUser(u)" title="Modifier">✏️</button>
                      <button *ngIf="!u.deleted" class="btn-sm btn-revoke" (click)="deleteUser(u.id)" title="Supprimer">🗑️</button>
                      <button *ngIf="u.deleted" class="btn-sm btn-block" (click)="restoreUser(u.id)" title="Restaurer">♻️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── SESSIONS ── -->
        <div *ngIf="tab==='sessions'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Sessions Actives</h1><p class="page-sub">Gérez les connexions de tous les utilisateurs.</p></div>
            <button class="btn-primary" (click)="loadSessions()">Actualiser</button>
          </div>
          <div class="card">
            <table class="data-table">
              <thead><tr><th>Email</th><th>IP</th><th>Appareil</th><th>Connexion</th><th>Expiration</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let s of sessions">
                  <td>{{ s.userEmail || 'Inconnu' }}</td>
                  <td>{{ s.ipAddress || '-' }}</td>
                  <td>{{ s.deviceType || 'Web' }} <span class="text-xs text-slate-400">({{ s.userAgent | slice:0:30 }}...)</span></td>
                  <td>{{ s.createdAt | date:'short' }}</td>
                  <td>{{ s.accessTokenExpiresAt | date:'short' }}</td>
                  <td>
                    <span class="role-badge" [class.bg-red-900]="s.revoked" [class.text-red-300]="s.revoked"
                          [class.bg-green-900]="!s.revoked" [class.text-green-300]="!s.revoked">
                      {{ s.revoked ? 'Révoqué' : 'Actif' }}
                    </span>
                  </td>
                  <td>
                    <div class="action-btns">
                      <button *ngIf="!s.revoked" class="btn-sm btn-revoke" (click)="revokeSession(s.id)" title="Révoquer cette session">⚡</button>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="sessions.length === 0">
                  <td colspan="7" class="text-center p-4 text-slate-400">Aucune session trouvée.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── CLIENTELE ── -->
        <div *ngIf="tab==='entreprises'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Gestion des Entreprises</h1><p class="page-sub">Partenaires, entreprises et clients institutionnels.</p></div>
            <button class="btn-primary" (click)="openAddEntreprise()">+ Nouveau Client institutionnel</button>
          </div>

          <div class="toolbar card">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Nom, email ou raison sociale...">
            </div>
            <div class="filters">
              <select [(ngModel)]="statusFilter" class="filter-select">
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actives</option>
                <option value="DELETED">Supprimées</option>
              </select>
            </div>
          </div>

          <div class="card">
            <table class="data-table">
              <thead><tr><th>Entreprise</th><th>Email</th><th>Téléphone</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let e of filteredEntreprises">
                  <td>
                    <div class="user-cell">
                      <div class="user-ava bg-emerald-900">{{ e.nom[0] }}</div>
                      <div>
                        <div class="font-bold text-white">{{ e.nom }}</div>
                        <div class="text-[10px] text-slate-500">{{ e.raisonSociale }}</div>
                      </div>
                    </div>
                  </td>
                  <td>{{ e.email }}</td>
                  <td>{{ e.telephone }}</td>
                  <td><span class="badge" [class.badge-on]="e.active" [class.badge-off]="!e.active">{{ e.active ? 'ACTIF' : 'INACTIF' }}</span></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm btn-block" (click)="openEditEntreprise(e)" title="Modifier">✏️</button>
                      <button *ngIf="!e.deleted" class="btn-sm btn-revoke" (click)="deleteEntreprise(e.id)" title="Supprimer">🗑️</button>
                      <button *ngIf="e.deleted" class="btn-sm btn-block" (click)="restoreEntreprise(e.id)" title="Restaurer">♻️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── PUBLICITÉS ── -->
        <div *ngIf="tab==='ads'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Gestion des Publicités</h1><p class="page-sub">Campagnes et bannières publicitaires.</p></div>
            <button class="btn-primary" (click)="openAddPub()">+ Nouvelle Publicité</button>
          </div>

          <div class="toolbar card">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher par annonceur...">
            </div>
            <div class="filters">
              <select [(ngModel)]="statusFilter" class="filter-select">
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actives</option>
                <option value="DELETED">Supprimées</option>
              </select>
            </div>
          </div>

          <div class="card">
            <table class="data-table">
              <thead><tr><th>Publicité</th><th>Annonceur</th><th>Période</th><th>Prix</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let a of filteredAds">
                  <td>
                    <div class="flex items-center gap-2">
                      <div class="w-12 h-8 rounded bg-slate-800 overflow-hidden border border-slate-700">
                        <img *ngIf="a.imageUrls.length > 0" [src]="a.imageUrls[0]" class="w-full h-full object-cover">
                        <div *ngIf="a.imageUrls.length === 0" class="w-full h-full flex items-center justify-center text-[10px] text-slate-600">NO IMG</div>
                      </div>
                      <span class="text-xs font-semibold text-slate-300">PUB #{{ a.id.substring(0,5) }}</span>
                    </div>
                  </td>
                  <td>
                    <div class="text-white font-medium">{{ a.clientPub?.nom }} {{ a.clientPub?.prenom }}</div>
                    <div class="text-[10px] text-slate-500">{{ a.clientPub?.raisonSociale }}</div>
                  </td>
                  <td>
                    <div class="text-[11px] text-slate-400">{{ a.debut | date:'shortDate' }} - {{ a.fin | date:'shortDate' }}</div>
                    <div class="text-[10px] text-blue-500">{{ a.duree }} jours</div>
                  </td>
                  <td><span class="font-bold text-blue-400">{{ a.prix }} €</span></td>
                  <td><span class="badge" [class.badge-on]="a.active" [class.badge-off]="!a.active">{{ a.active ? 'ACTIF' : 'INACTIF' }}</span></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm btn-block" (click)="openEditPub(a)" title="Modifier">✏️</button>
                      <button *ngIf="!a.deleted" class="btn-sm btn-revoke" (click)="deletePub(a.id)" title="Supprimer">🗑️</button>
                      <button *ngIf="a.deleted" class="btn-sm btn-block" (click)="restorePub(a.id)" title="Restaurer">♻️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── MESSAGES (Inbox) ── -->
        <div *ngIf="tab==='contacts'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Boîte de réception</h1><p class="page-sub">Gérez les demandes et retours clients.</p></div>
          </div>
          
          <div class="toolbar card mb-6">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher par nom, email, sujet...">
            </div>
            <div class="filters">
              <select [(ngModel)]="statusFilter" class="filter-select">
                <option value="ALL">Tous les messages</option>
                <option value="ACTIVE">À traiter (Nouveaux)</option>
                <option value="DELETED">Supprimés</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div *ngFor="let m of filteredContacts" 
                 class="msg-card group animate-slide-up"
                 [class.msg-handled]="m.traite"
                 [class.msg-deleted]="m.deleted">
              
              <div class="msg-card-accent"></div>
              
              <div class="p-5">
                <div class="flex justify-between items-start mb-4">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 font-bold border border-slate-700">
                      {{ m.nomComplet[0] | uppercase }}
                    </div>
                    <div>
                      <div class="text-sm font-bold text-white leading-tight">{{ m.nomComplet }}</div>
                      <div class="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{{ m.createdAt | date:'shortDate' }}</div>
                    </div>
                  </div>
                  <span class="badge" [class.badge-on]="m.traite" [class.badge-off]="!m.traite">
                    {{ m.traite ? 'Traité' : 'Nouveau' }}
                  </span>
                </div>

                <div class="space-y-3 mb-6">
                  <div class="flex items-start gap-2">
                    <span class="text-slate-500 text-xs mt-0.5">📧</span>
                    <span class="text-xs text-slate-400 truncate">{{ m.email }}</span>
                  </div>
                  <div class="flex items-start gap-2">
                    <span class="text-slate-500 text-xs mt-0.5">🏷️</span>
                    <span class="text-xs font-bold text-slate-200">{{ m.sujet }}</span>
                  </div>
                  <div class="bg-slate-900/50 p-3 rounded-xl border border-slate-800/50 text-[13px] text-slate-400 line-clamp-3 italic leading-relaxed">
                    "{{ m.message }}"
                  </div>
                </div>

                <div class="flex gap-2 pt-2 border-t border-white/5">
                  <button class="flex-1 btn-sm btn-primary !bg-blue-600/10 !text-blue-400 hover:!bg-blue-600 hover:!text-white border border-blue-600/20" 
                          (click)="openReply(m)">
                    Répondre
                  </button>
                  <button *ngIf="!m.traite && !m.deleted" 
                          class="btn-sm btn-secondary !bg-emerald-600/10 !text-emerald-400 hover:!bg-emerald-600 hover:!text-white border border-emerald-600/20" 
                          (click)="markContactHandled(m.id)">
                    ✓
                  </button>
                  <button *ngIf="!m.deleted" class="btn-sm btn-revoke" (click)="deleteContact(m.id)">🗑️</button>
                  <button *ngIf="m.deleted" class="btn-sm btn-block" (click)="restoreContact(m.id)">♻️</button>
                </div>
              </div>
            </div>

            <div *ngIf="filteredContacts.length === 0" class="col-span-full py-20 text-center card bg-slate-900/20 border-dashed">
              <div class="text-4xl mb-4">📥</div>
              <h3 class="text-slate-400 font-bold">Aucun message trouvé</h3>
              <p class="text-slate-600 text-sm">Votre boîte de réception est vide ou aucun message ne correspond aux filtres.</p>
            </div>
          </div>
        </div>

        <!-- ── LLM PROVIDERS ── -->
        <div *ngIf="tab==='llm'" class="tab-pane">
          <div class="page-header">
            <div>
              <h1 class="page-title">Providers LLM</h1>
              <p class="page-sub">Clés API et modèles configurés par agent. Chiffrés AES-256.</p>
            </div>
          </div>

          <!-- Filtres -->
          <div class="card toolbar" style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;margin-bottom:1.25rem;">
            <div style="display:flex;flex-direction:column;gap:.3rem;">
              <span class="text-xs text-slate-400 uppercase tracking-wide">Équipe</span>
              <select class="form-input" style="min-width:160px;" [(ngModel)]="llmFilter.teamId" (change)="onLlmTeamChange()">
                <option value="">Toutes</option>
                <option *ngFor="let t of llmTeams" [value]="t.id">{{t.name}}</option>
              </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:.3rem;">
              <span class="text-xs text-slate-400 uppercase tracking-wide">Agent</span>
              <select class="form-input" style="min-width:160px;" [(ngModel)]="llmFilter.agentId" (change)="reloadLlmForFilter()">
                <option value="">Tous</option>
                <option *ngFor="let a of llmFilteredAgents" [value]="a.id">{{a.name}}</option>
              </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:.3rem;">
              <span class="text-xs text-slate-400 uppercase tracking-wide">Statut</span>
              <div style="display:flex;gap:.35rem;">
                <button class="btn-sm" [class.btn-primary]="llmFilter.deleted==='false'" [class.btn-secondary]="llmFilter.deleted!=='false'" (click)="llmFilter.deleted='false'; reloadLlmForFilter()">Actifs</button>
                <button class="btn-sm" [class.btn-primary]="llmFilter.deleted==='true'"  [class.btn-secondary]="llmFilter.deleted!=='true'"  (click)="llmFilter.deleted='true';  reloadLlmForFilter()">Supprimés</button>
                <button class="btn-sm" [class.btn-primary]="llmFilter.deleted==='all'"   [class.btn-secondary]="llmFilter.deleted!=='all'"   (click)="llmFilter.deleted='all';   reloadLlmForFilter()">Tous</button>
              </div>
            </div>
          </div>

          <div *ngIf="llmLoading" class="text-slate-400 text-sm p-4">Chargement…</div>

          <div *ngIf="!llmLoading">
            <div *ngFor="let grp of llmGroups" class="card mb-4" [style.display]="grp.providers.length===0 ? 'none' : ''">
              <!-- Agent header -->
              <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;">
                <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#a855f7);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.95rem;flex-shrink:0;">{{grp.agent.name[0]}}</div>
                <div>
                  <span style="font-weight:700;font-size:1rem;">{{grp.agent.name}}</span>
                  <span style="margin-left:.5rem;font-size:.65rem;font-weight:700;text-transform:uppercase;padding:.15rem .45rem;border-radius:5px;background:rgba(99,102,241,.12);color:#818cf8;">{{grp.agent.type}}</span>
                </div>
                <span style="margin-left:auto;font-size:.75rem;color:var(--subtext);">{{llmActiveCount(grp.providers)}} actif(s)</span>
              </div>

              <!-- Providers -->
              <div style="display:flex;flex-direction:column;gap:.5rem;">
                <div *ngFor="let p of grp.providers"
                  style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;border-radius:10px;padding:.65rem .9rem;border:1.5px solid;"
                  [style.border-color]="p.primary ? 'rgba(234,179,8,.35)' : p.deleted ? 'rgba(239,68,68,.2)' : 'var(--border)'"
                  [style.background]="p.primary ? 'rgba(234,179,8,.04)' : p.deleted ? 'rgba(239,68,68,.03)' : 'var(--surface)'"
                  [style.opacity]="p.deleted ? '0.55' : '1'">

                  <!-- Type badge -->
                  <span style="font-size:.7rem;font-weight:800;padding:.2rem .55rem;border-radius:7px;border:1px solid;"
                    [style.background]="llmTypeMeta(p.type).color+'18'"
                    [style.color]="llmTypeMeta(p.type).color"
                    [style.border-color]="llmTypeMeta(p.type).color+'44'">
                    {{llmTypeMeta(p.type).icon}} {{llmTypeMeta(p.type).label}}
                  </span>
                  <!-- Model -->
                  <span style="font-family:monospace;font-size:.8rem;font-weight:600;flex:1;">{{p.modelId || '—'}}</span>
                  <!-- Meta -->
                  <span style="font-size:.7rem;color:var(--subtext);">T={{p.temperature}} · max={{p.maxTokens}}</span>

                  <!-- Status badges -->
                  <span *ngIf="p.primary && !p.deleted" style="font-size:.68rem;font-weight:700;padding:.15rem .5rem;border-radius:6px;background:rgba(234,179,8,.15);color:#ca8a04;border:1px solid rgba(234,179,8,.3);">⭐ Principal</span>
                  <span *ngIf="p.deleted"               style="font-size:.68rem;font-weight:700;padding:.15rem .5rem;border-radius:6px;background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2);">🗑 Supprimé</span>
                  <span *ngIf="!p.primary && !p.deleted" style="font-size:.68rem;font-weight:700;padding:.15rem .5rem;border-radius:6px;background:rgba(148,163,184,.08);color:#64748b;border:1px solid rgba(148,163,184,.15);">Backup</span>

                  <!-- Actions -->
                  <div style="display:flex;gap:.35rem;margin-left:auto;">
                    <button *ngIf="!p.primary && !p.deleted" class="btn-sm btn-block" title="Définir comme principal" (click)="llmSetPrimary(grp.agent, p)">⭐</button>
                    <button *ngIf="p.deleted"                class="btn-sm btn-block" title="Restaurer"              (click)="llmRestore(grp.agent, p)">♻️</button>
                    <button *ngIf="!p.deleted"               class="btn-sm btn-revoke" title="Supprimer"            (click)="llmAskDelete(grp.agent, p)">🗑</button>
                  </div>
                </div>
              </div>
            </div>

            <div *ngIf="llmGroups.length===0 || llmAllEmpty()" class="text-slate-400 text-sm text-center p-8">
              Aucun provider LLM trouvé pour cette sélection.
            </div>
          </div>
        </div>

        <!-- ── API DOCS ── -->
        <div *ngIf="tab==='api'" class="tab-pane h-full flex flex-col">
          <div class="page-header">
            <div><h1 class="page-title">Swagger UI</h1><p class="page-sub">Documentation des endpoints Creative AI Studio.</p></div>
            <a href="http://localhost:8480/swagger-ui.html" target="_blank" class="btn-primary">Plein écran ↗</a>
          </div>
          <div class="flex-1 bg-white rounded-2xl overflow-hidden min-h-[600px]">
            <iframe [src]="swaggerUrl" class="w-full h-full border-none"></iframe>
          </div>
        </div>

        <!-- ── PROMOS ── -->
        <div *ngIf="tab==='promos'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Marketing & Promotions</h1><p class="page-sub">Gérez les offres spéciales et réductions tarifaires.</p></div>
            <button class="btn-primary" (click)="openAddPromo()">+ Nouvelle Promo</button>
          </div>

          <div class="toolbar card">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher une promotion...">
            </div>
            <div class="filters">
              <select [(ngModel)]="statusFilter" class="filter-select">
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actives</option>
                <option value="DELETED">Supprimées</option>
              </select>
            </div>
          </div>

          <div class="card">
            <table class="data-table">
              <thead><tr><th>Promotion</th><th>Période</th><th>Prix Promo</th><th>Produits</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let p of filteredPromos">
                  <td><div class="font-bold text-white">{{ p.libelle }}</div></td>
                  <td>
                    <div class="text-xs text-slate-400">Du {{ p.dateDebut | date:'shortDate' }}</div>
                    <div class="text-xs text-slate-400">Au {{ p.dateFin | date:'shortDate' }}</div>
                  </td>
                  <td><span class="font-bold text-blue-400">{{ p.prixPromo }} €</span></td>
                  <td><span class="badge !bg-slate-800">{{ p.produits.length }} produits</span></td>
                  <td><span class="badge" [class.badge-on]="p.active" [class.badge-off]="!p.active">{{ p.active ? 'ACTIF' : 'INACTIF' }}</span></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm btn-block" (click)="openEditPromo(p)" title="Modifier">✏️</button>
                      <button *ngIf="!p.deleted" class="btn-sm btn-revoke" (click)="deletePromo(p.id)" title="Supprimer">🗑️</button>
                      <button *ngIf="p.deleted" class="btn-sm btn-block" (click)="restorePromo(p.id)" title="Restaurer">♻️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── RESULTS ── -->
        <div *ngIf="tab==='results'" class="tab-pane">
          <div class="page-header"><div><h1 class="page-title">Intelligence Résultats</h1><p class="page-sub">Index des contenus indexés.</p></div></div>
          <div class="card"><table class="data-table">
            <thead><tr><th>Titre</th><th>Média</th><th>Abonnement</th></tr></thead>
            <tbody><tr *ngFor="let r of results"><td>{{r.titre}}</td><td>{{r.mediaType}}</td><td><span class="role-badge">{{r.abonnement}}</span></td></tr></tbody>
          </table></div>
        </div>

        <!-- ── HISTORY ── -->
        <div *ngIf="tab==='history'" class="tab-pane">
          <div class="page-header"><div><h1 class="page-title">Historique des Recherches</h1><p class="page-sub">Analyse des requêtes utilisateurs.</p></div></div>
          <div class="card"><table class="data-table">
            <thead><tr><th>Requête</th><th>Résultats</th><th>Succès</th><th>Date</th></tr></thead>
            <tbody><tr *ngFor="let h of history"><td>{{h.query}}</td><td>{{h.resultCount}}</td><td>{{h.found?'✅':'❌'}}</td><td>{{h.createdAt | date:'short'}}</td></tr></tbody>
          </table></div>
        </div>

        <!-- ── PRODUITS ── -->
        <div *ngIf="tab==='produits'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Services & Tarifs</h1><p class="page-sub">Gestion des plans d'abonnement.</p></div>
            <button class="btn-primary" (click)="openAddProduit()">+ Ajouter Produit</button>
          </div>

          <div class="toolbar card">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher un produit...">
            </div>
            <div class="filters">
              <select [(ngModel)]="statusFilter" class="filter-select">
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actif</option>
                <option value="DELETED">Supprimé</option>
              </select>
              <button class="btn-primary" (click)="loadProducts()">Actualiser</button>
            </div>
          </div>

          <div class="card">
            <table class="data-table">
              <thead><tr><th>Produit</th><th>Catégorie</th><th>Prix</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let p of filteredProduits">
                  <td>
                    <div class="user-cell">
                      <div class="user-ava bg-purple-900">{{ p.libelle[0] }}</div>
                      <div>
                        <div class="font-bold text-white">{{ p.libelle }}</div>
                        <div class="flex flex-wrap gap-1 mt-1">
                          <span *ngFor="let f of p.fonctions" 
                                class="text-[9px] px-1.5 py-0.5 rounded border transition-all"
                                [class.bg-slate-800]="f.disponible"
                                [class.text-slate-300]="f.disponible"
                                [class.border-slate-700]="f.disponible"
                                [class.bg-slate-900]="!f.disponible"
                                [class.text-slate-600]="!f.disponible"
                                [class.border-slate-800]="!f.disponible"
                                [class.opacity-40]="!f.disponible">
                            {{ f.libelle }} {{ !f.disponible ? '🚫' : '' }}
                          </span>
                          <span *ngIf="p.fonctions.length === 0" class="text-[9px] text-slate-500 italic">Aucune fonction</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td><span class="role-badge">{{ p.categorieLibelle }}</span></td>
                  <td><span class="font-bold text-blue-400">{{ p.prix }} €</span></td>
                  <td><span class="badge" [class.badge-on]="p.active" [class.badge-off]="!p.active">{{ p.active ? 'ACTIF' : 'INACTIF' }}</span></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm btn-block" (click)="openEditProduit(p)" title="Modifier">✏️</button>
                      <button *ngIf="!p.deleted" class="btn-sm btn-revoke" (click)="deleteProduit(p.id)" title="Supprimer">🗑️</button>
                      <button *ngIf="p.deleted" class="btn-sm btn-block" (click)="restoreProduit(p.id)" title="Restaurer">♻️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── VENTES ── -->
        <div *ngIf="tab==='ventes'" class="tab-pane">
          <div class="page-header"><div><h1 class="page-title">Transactions</h1><p class="page-sub">Journal des ventes et abonnements.</p></div></div>
          <div class="card"><table class="data-table">
            <thead><tr><th>Client ID</th><th>Montant</th><th>Date</th></tr></thead>
            <tbody><tr *ngFor="let v of ventes"><td>{{v.clientId}}</td><td>{{v.montant}} €</td><td>{{v.dateVente | date:'short'}}</td></tr></tbody>
          </table></div>
        </div>

        <!-- ── CLIENTS-PUB ── -->
        <div *ngIf="tab==='clientpubs'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Gestion des Clients Annonceurs</h1><p class="page-sub">Suivi des annonceurs, régies et partenaires publicitaires.</p></div>
            <button class="btn-primary" (click)="openAddClientPub()">+ Nouvel Annonceur</button>
          </div>

          <div class="toolbar card">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Nom, email ou raison sociale...">
            </div>
            <div class="filters">
              <select [(ngModel)]="statusFilter" class="filter-select">
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actifs</option>
                <option value="DELETED">Supprimés</option>
              </select>
            </div>
          </div>

          <div class="card">
            <table class="data-table">
              <thead><tr><th>Annonceur</th><th>Email</th><th>Contact</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let c of filteredClientPubs">
                  <td>
                    <div class="user-cell">
                      <div class="user-ava bg-amber-900">{{ c.nom[0] }}</div>
                      <div>
                        <div class="font-bold text-white">{{ c.nom }} {{ c.prenom }}</div>
                        <div class="text-[10px] text-slate-500">{{ c.raisonSociale }}</div>
                      </div>
                    </div>
                  </td>
                  <td>{{ c.email }}</td>
                  <td>{{ c.contact1 }}</td>
                  <td><span class="badge" [class.badge-on]="c.active" [class.badge-off]="!c.active">{{ c.active ? 'ACTIF' : 'INACTIF' }}</span></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm btn-block" (click)="openEditClientPub(c)" title="Modifier">✏️</button>
                      <button *ngIf="!c.deleted" class="btn-sm btn-revoke" (click)="deleteClientPub(c.id)" title="Supprimer">🗑️</button>
                      <button *ngIf="c.deleted" class="btn-sm btn-block" (click)="restoreClientPub(c.id)" title="Restaurer">♻️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── RESEAUX SOCIAUX ── -->
        <div *ngIf="tab==='sociallinks'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Réseaux Sociaux</h1><p class="page-sub">Gérez les profils et liens des réseaux sociaux globaux de la plateforme.</p></div>
            <button class="btn-primary" (click)="openAddSocialLink()">+ Nouveau Lien Social</button>
          </div>

          <div class="toolbar card">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher par plateforme ou URL...">
            </div>
          </div>

          <div class="card">
            <table class="data-table">
              <thead><tr><th>Plateforme</th><th>Lien</th><th>Ordre</th><th>Type</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let s of filteredSocialLinks">
                  <td>
                    <div class="flex items-center gap-2 text-white">
                      <span class="text-lg"><i [class]="s.iconClass || 'fa-solid fa-globe'"></i></span>
                      <span class="font-bold">{{ s.platform }}</span>
                    </div>
                  </td>
                  <td class="max-w-xs truncate"><a [href]="s.url" target="_blank" class="text-blue-400 hover:underline">{{ s.url }}</a></td>
                  <td>{{ s.displayOrder }}</td>
                  <td>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold"
                          [class.bg-blue-900]="s.ownerType==='US'" [class.text-blue-200]="s.ownerType==='US'"
                          [class.bg-amber-900]="s.ownerType==='CLIENT'" [class.text-amber-200]="s.ownerType==='CLIENT'">
                      {{ s.ownerType === 'US' ? 'PLATEFORME' : 'ANNONCEURS' }}
                    </span>
                  </td>
                  <td>
                    <button class="badge cursor-pointer" [class.badge-on]="s.isActive" [class.badge-off]="!s.isActive"
                            (click)="toggleSocialLink(s.id)" title="Cliquer pour changer le statut">
                      {{ s.isActive ? 'ACTIF' : 'INACTIF' }}
                    </button>
                  </td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm btn-block" (click)="openEditSocialLink(s)" title="Modifier">✏️</button>
                      <button class="btn-sm btn-revoke" (click)="deleteSocialLink(s.id)" title="Supprimer">🗑️</button>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="filteredSocialLinks.length === 0">
                  <td colspan="6" class="text-center py-6 text-slate-500">Aucun lien social trouvé.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── CATEGORIES ── -->
        <div *ngIf="tab==='categories'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Catégories</h1><p class="page-sub">Classification des produits.</p></div>
            <button class="btn-primary" (click)="openAddCategorie()">+ Ajouter Catégorie</button>
          </div>

          <div class="toolbar card">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher une catégorie...">
            </div>
            <div class="filters">
              <select [(ngModel)]="statusFilter" class="filter-select">
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actif</option>
                <option value="DELETED">Supprimé</option>
              </select>
            </div>
          </div>

          <div class="card">
            <table class="data-table">
              <thead><tr><th>Libellé</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let c of filteredCategories">
                  <td>{{ c.libelle }}</td>
                  <td><span class="badge" [class.badge-on]="c.active" [class.badge-off]="!c.active">{{ c.active ? 'ACTIF' : 'INACTIF' }}</span></td>
                  <td>{{ c.createdAt | date:'short' }}</td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm btn-block" (click)="openEditCategorie(c)" title="Modifier">✏️</button>
                      <button *ngIf="!c.deleted" class="btn-sm btn-revoke" (click)="deleteCategorie(c.id)" title="Supprimer">🗑️</button>
                      <button *ngIf="c.deleted" class="btn-sm btn-block" (click)="restoreCategorie(c.id)" title="Restaurer">♻️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── FONCTIONS ── -->
        <div *ngIf="tab==='fonctions'" class="tab-pane">
          <div class="page-header">
            <div><h1 class="page-title">Fonctions</h1><p class="page-sub">Capacités et modules du système.</p></div>
            <button class="btn-primary" (click)="openAddFonction()">+ Ajouter Fonction</button>
          </div>

          <div class="toolbar card">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" [(ngModel)]="searchQuery" placeholder="Rechercher une fonction...">
            </div>
            <div class="filters">
              <select [(ngModel)]="statusFilter" class="filter-select">
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actif</option>
                <option value="DELETED">Supprimé</option>
              </select>
            </div>
          </div>

          <div class="card">
            <table class="data-table">
              <thead><tr><th>Libellé</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let f of filteredFonctions">
                  <td>{{ f.libelle }}</td>
                  <td><span class="badge" [class.badge-on]="f.active" [class.badge-off]="!f.active">{{ f.active ? 'ACTIF' : 'INACTIF' }}</span></td>
                  <td>{{ f.createdAt | date:'short' }}</td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm btn-block" (click)="openEditFonction(f)" title="Modifier">✏️</button>
                      <button *ngIf="!f.deleted" class="btn-sm btn-revoke" (click)="deleteFonction(f.id)" title="Supprimer">🗑️</button>
                      <button *ngIf="f.deleted" class="btn-sm btn-block" (click)="restoreFonction(f.id)" title="Restaurer">♻️</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        </div> <!-- End content-area -->
      </main>

      <!-- ══ QUICK ADD MODAL ══════════════════════════════════ -->
      <div *ngIf="showAddModal" class="modal-overlay" (click)="showAddModal=false">
        <div class="modal-card animate-slide-up" (click)="$event.stopPropagation()">
          <h2 class="text-xl font-bold mb-6">Ajouter une Entreprise</h2>
          <form (submit)="saveEntreprise($event)" class="space-y-4">
            <div class="form-group">
              <label>Nom de l'entreprise</label>
              <input name="nom" type="text" required [(ngModel)]="newEntreprise.nom" placeholder="Ex: Creative AI Studio">
            </div>
            <div class="form-group">
              <label>Raison Sociale</label>
              <input name="raisonSociale" type="text" [(ngModel)]="newEntreprise.raisonSociale" placeholder="Ex: SAS Creative AI Studio">
            </div>
            <div class="form-group">
              <label>Email Contact</label>
              <input name="email" type="email" required [(ngModel)]="newEntreprise.email" placeholder="contact@entreprise.com">
            </div>
            <div class="form-group">
              <label>Téléphone</label>
              <input name="telephone" type="tel" [(ngModel)]="newEntreprise.telephone" placeholder="+33 6 ...">
            </div>
            <div class="flex gap-4 pt-4">
              <button type="button" class="btn-secondary flex-1" (click)="showAddModal=false">Annuler</button>
              <button type="submit" class="btn-primary flex-1">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ══ ADD USER MODAL ══════════════════════════════════ -->
      <div *ngIf="showAddUserModal" class="modal-overlay" (click)="showAddUserModal=false">
        <div class="modal-card animate-slide-up" (click)="$event.stopPropagation()">
          <h2 class="text-xl font-bold mb-6">Ajouter un Utilisateur</h2>
          <form (submit)="createUser($event)" class="space-y-4">
            <div class="form-group">
              <label>Nom complet</label>
              <input name="fullName" type="text" required [(ngModel)]="newUser.fullName">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input name="email" type="email" required [(ngModel)]="newUser.email">
            </div>
            <div class="form-group">
              <label>Mot de passe</label>
              <input name="password" type="password" required [(ngModel)]="newUser.password">
            </div>
            <div class="form-group">
              <label>Confirmer le mot de passe</label>
              <input name="confirmPassword" type="password" required [(ngModel)]="newUser.confirmPassword">
            </div>
            <div class="form-group">
              <label>Rôle</label>
              <select name="role" [(ngModel)]="newUser.role" class="filter-select w-full" style="width:100%; border:1px solid #334155;">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div class="form-group">
              <label>Crédits</label>
              <input name="credits" type="number" required [(ngModel)]="newUser.credits">
            </div>
            <div class="flex gap-4 pt-4">
              <button type="button" class="btn-secondary flex-1" (click)="showAddUserModal=false">Annuler</button>
              <button type="submit" class="btn-primary flex-1">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ══ EDIT USER MODAL ══════════════════════════════════ -->
      <div *ngIf="showEditUserModal" class="modal-overlay" (click)="showEditUserModal=false">
        <div class="modal-card animate-slide-up" (click)="$event.stopPropagation()">
          <h2 class="text-xl font-bold mb-6">Modifier l'Utilisateur</h2>
          <form (submit)="saveUser($event)" class="space-y-4">
            <div class="form-group">
              <label>Nom complet</label>
              <input name="fullName" type="text" required [(ngModel)]="editingUser.fullName">
            </div>
            <div class="form-group">
              <label>Rôle</label>
              <select name="role" [(ngModel)]="editingUser.role" class="filter-select w-full" style="width:100%; border:1px solid #334155;">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div class="form-group">
              <label>Crédits</label>
              <input name="credits" type="number" required [(ngModel)]="editingUser.credits">
            </div>
            <div class="form-group">
              <label>Statut (Actif)</label>
              <input name="enabled" type="checkbox" [(ngModel)]="editingUser.enabled" style="width:auto;">
            </div>
            <div class="flex gap-4 pt-4">
              <button type="button" class="btn-secondary flex-1" (click)="showEditUserModal=false">Annuler</button>
              <button type="submit" class="btn-primary flex-1">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>
      <!-- ══ CONFIRM DIALOG ══════════════════════════════════ -->
      <div *ngIf="confirmDialog.isOpen" class="cd-backdrop" (click)="confirmDialog.onCancel()">
        <div class="cd-card" (click)="$event.stopPropagation()">
          <div class="cd-icon">🗑️</div>
          <h3 class="cd-title">Confirmation</h3>
          <p class="cd-msg">{{ confirmDialog.message }}</p>
          <div class="cd-actions">
            <button class="cd-btn cd-btn--cancel" (click)="confirmDialog.onCancel()">Annuler</button>
            <button class="cd-btn cd-btn--danger" (click)="confirmDialog.onConfirm()">Supprimer</button>
          </div>
        </div>
      </div>

      <!-- ══ PRODUIT MODAL ══════════════════════════════════ -->
      <div *ngIf="showProduitModal" class="modal-overlay" (click)="showProduitModal=false">
        <div class="modal-card modal-xl animate-slide-up" (click)="$event.stopPropagation()">
          <h2 class="text-xl font-bold mb-6">{{ isEditingProduit ? 'Modifier' : 'Ajouter' }} un Produit</h2>
          <form (submit)="saveProduit($event)" class="grid grid-cols-2 gap-4">
            <div class="form-group col-span-2">
              <label>Nom du Produit</label>
              <input name="libelle" type="text" required [(ngModel)]="currProduit.libelle">
            </div>
            <div class="form-group">
              <label>Prix (€)</label>
              <input name="prix" type="number" required [(ngModel)]="currProduit.prix">
            </div>
            <div class="form-group">
              <label>Image URL</label>
              <input name="urlImage" type="text" [(ngModel)]="currProduit.urlImage" placeholder="https://...">
            </div>
            
            <!-- Categorie Selection with QuickAdd -->
            <div class="form-group col-span-2">
              <label>Catégorie</label>
              <div class="flex gap-2">
                <select name="categorieId" [(ngModel)]="currProduit.categorieId" class="filter-select flex-1 !bg-slate-800" (change)="currProduit.categorieLibelle=''">
                  <option [value]="null">-- Sélectionner --</option>
                  <option *ngFor="let c of categories" [value]="c.id">{{ c.libelle }}</option>
                  <option value="NEW">+ Créer une nouvelle catégorie</option>
                </select>
                <input *ngIf="currProduit.categorieId === 'NEW'" name="categorieLibelle" type="text" 
                       class="flex-1 !bg-slate-800" placeholder="Nom de la nouvelle catégorie" 
                       [(ngModel)]="currProduit.categorieLibelle" required>
              </div>
            </div>

            <!-- Fonctions Selection (Multiple) -->
            <div class="form-group col-span-2">
              <label class="flex justify-between items-center mb-2">
                <span>Fonctions & Disponibilités</span>
                <span class="text-[10px] text-slate-500 uppercase tracking-wider">Activer "Disponible" pour rendre la fonction active</span>
              </label>
              
              <div class="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
                <div class="grid grid-cols-12 gap-2 p-3 bg-slate-900 border-b border-slate-700 text-[10px] font-bold uppercase text-slate-500">
                  <div class="col-span-8">Fonctionnalité</div>
                  <div class="col-span-2 text-center">Inclus</div>
                  <div class="col-span-2 text-center">Disponible</div>
                </div>
                
                <div class="max-h-60 overflow-y-auto">
                  <div *ngFor="let f of fonctions" class="grid grid-cols-12 gap-2 p-3 items-center hover:bg-white/5 border-b border-white/5 last:border-0">
                    <div class="col-span-7">
                      <div class="text-sm font-medium text-slate-200">{{ f.libelle }}</div>
                    </div>
                    
                    <div class="col-span-2 flex justify-center">
                      <div class="custom-check" 
                           [class.checked]="isFonctionSelected(f.id)"
                           (click)="toggleFonction(f.id)">
                        <span *ngIf="isFonctionSelected(f.id)">✓</span>
                      </div>
                    </div>
                    
                    <div class="col-span-3 flex items-center justify-center gap-2">
                      <div class="custom-check dispo-check" 
                           [class.checked]="currProduit.disponibleFonctionIds.includes(f.id)"
                           [class.disabled]="!isFonctionSelected(f.id)"
                           (click)="isFonctionSelected(f.id) && toggleFonctionDispo(f.id)">
                        <span *ngIf="currProduit.disponibleFonctionIds.includes(f.id)">✓</span>
                      </div>
                      <span *ngIf="!isFonctionSelected(f.id)" class="text-[9px] text-slate-600 uppercase font-bold">Désactivé</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group col-span-2 flex items-center gap-3">
              <input name="active" type="checkbox" [(ngModel)]="currProduit.active" class="w-auto">
              <label class="mb-0">Produit Actif</label>
            </div>

            <div class="flex gap-4 pt-4 col-span-2">
              <button type="button" class="btn-secondary flex-1" (click)="showProduitModal=false">Annuler</button>
              <button type="submit" class="btn-primary flex-1">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ══ REPLY MODAL (Inbox) ══════════════════════════════════ -->
      <div *ngIf="showReplyModal" class="modal-overlay" (click)="showReplyModal=false">
        <div class="modal-card modal-xl animate-slide-up" (click)="$event.stopPropagation()">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold mb-0">Répondre à {{ currContact?.nomComplet }}</h2>
            <div class="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">À: {{ currContact?.email }}</div>
          </div>
          
          <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-6">
            <div class="text-[10px] uppercase font-bold text-slate-500 mb-1">Message Reçu :</div>
            <div class="text-sm text-slate-300 italic">"{{ currContact?.message }}"</div>
          </div>

          <form (submit)="sendReply()" class="space-y-4">
            <div class="form-group">
              <label>Sujet de la réponse</label>
              <input name="replySujet" type="text" required [(ngModel)]="currReply.sujet">
            </div>
            <div class="form-group">
              <label>Votre Message</label>
              <textarea name="replyMessage" rows="8" required [(ngModel)]="currReply.message" 
                        class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-blue-500 outline-none"></textarea>
            </div>
            <div class="flex gap-4 pt-4">
              <button type="button" class="btn-secondary flex-1" (click)="showReplyModal=false">Annuler</button>
              <button type="submit" class="btn-primary flex-1">Envoyer la réponse par email</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ══ GENERIC MODAL (Categorie/Fonction) ══════════════════════════════════ -->
      <div *ngIf="showGenericModal" class="modal-overlay" (click)="showGenericModal=false">
        <div class="modal-card animate-slide-up" (click)="$event.stopPropagation()">
          <h2 class="text-xl font-bold mb-6">
            {{ isEditingGeneric ? 'Modifier' : 'Ajouter' }} 
            {{ genericType === 'cat' ? 'une Catégorie' : 'une Fonction' }}
            <span *ngIf="!isEditingGeneric" class="text-xs text-blue-400 cursor-pointer ml-4" (click)="isBulkMode = !isBulkMode">
               {{ isBulkMode ? 'Saisie simple' : 'Saisie en masse' }}
            </span>
          </h2>
          
          <form (submit)="saveGeneric($event)" class="space-y-4">
            <div *ngIf="!isBulkMode" class="form-group">
              <label>Libellé</label>
              <input name="libelle" type="text" required [(ngModel)]="currGeneric.libelle">
            </div>

            <div *ngIf="isBulkMode" class="form-group">
              <label>Libellés (séparés par une virgule ou retour à la ligne)</label>
              <textarea name="bulkLibelles" rows="5" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white"
                        [(ngModel)]="bulkLibelles" placeholder="Ex: Catégorie 1, Catégorie 2, Catégorie 3..."></textarea>
            </div>

            <div *ngIf="!isBulkMode" class="form-group flex items-center gap-3">
              <input name="active" type="checkbox" [(ngModel)]="currGeneric.active" class="w-auto">
              <label class="mb-0">Actif</label>
            </div>
            
            <div class="flex gap-4 pt-4">
              <button type="button" class="btn-secondary flex-1" (click)="showGenericModal=false">Annuler</button>
              <button type="submit" class="btn-primary flex-1">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ══ ENTREPRISE MODAL ══════════════════════════════════ -->
      <div *ngIf="showEntrepriseModal" class="modal-overlay" (click)="showEntrepriseModal=false">
        <div class="modal-card animate-slide-up !max-w-2xl" (click)="$event.stopPropagation()">
          <h2 class="text-xl font-bold mb-6">{{ isEditingEntreprise ? 'Modifier' : 'Ajouter' }} une Entreprise</h2>
          <form (submit)="saveEntreprise($event)" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group"><label>Nom Commercial</label><input name="enom" type="text" required [(ngModel)]="currEntreprise.nom"></div>
              <div class="form-group"><label>Raison Sociale</label><input name="ers" type="text" [(ngModel)]="currEntreprise.raisonSociale"></div>
              <div class="form-group"><label>Email</label><input name="eemail" type="email" required [(ngModel)]="currEntreprise.email"></div>
              <div class="form-group"><label>Téléphone</label><input name="etel" type="text" [(ngModel)]="currEntreprise.telephone"></div>
            </div>
            <div class="form-group flex items-center gap-3"><input name="eactive" type="checkbox" [(ngModel)]="currEntreprise.active" class="w-auto"><label class="mb-0">Entreprise Active</label></div>
            <div class="flex gap-4 pt-4"><button type="button" class="btn-secondary flex-1" (click)="showEntrepriseModal=false">Annuler</button><button type="submit" class="btn-primary flex-1">Enregistrer</button></div>
          </form>
        </div>
      </div>

      <!-- ══ CLIENTPUB MODAL ══════════════════════════════════ -->
      <div *ngIf="showClientPubModal" class="modal-overlay !z-[1100]" (click)="showClientPubModal=false">
        <div class="modal-card animate-slide-up !max-w-2xl" (click)="$event.stopPropagation()">
          <h2 class="text-xl font-bold mb-6">{{ isEditingClientPub ? 'Modifier' : 'Ajouter' }} un Annonceur</h2>
          <form (submit)="saveClientPub($event)" class="space-y-4">
            <!-- Infos principales -->
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group"><label>Nom *</label><input name="cnom" type="text" required [(ngModel)]="currClientPub.nom"></div>
              <div class="form-group"><label>Prénom</label><input name="cprenom" type="text" [(ngModel)]="currClientPub.prenom"></div>
              <div class="form-group col-span-2"><label>Email Professionnel *</label><input name="cemail" type="email" [(ngModel)]="currClientPub.email"></div>
              <div class="form-group"><label>Raison Sociale</label><input name="crs" type="text" [(ngModel)]="currClientPub.raisonSociale"></div>
              <div class="form-group"><label>Contact Direct</label><input name="cc1" type="text" [(ngModel)]="currClientPub.contact1"></div>
              <div class="form-group"><label>Site Web</label><input name="csw" type="url" [(ngModel)]="currClientPub.siteWeb" placeholder="https://..."></div>
              <div class="form-group"><label>Responsable</label><input name="cresp" type="text" [(ngModel)]="currClientPub.responsable"></div>
            </div>

            <!-- Réseaux sociaux -->
            <div class="form-group">
              <div class="flex items-center justify-between mb-2">
                <label class="!mb-0">Réseaux Sociaux</label>
                <button type="button" class="text-[10px] text-blue-400 hover:text-blue-300"
                        (click)="addSocialRow()">➕ Ajouter</button>
              </div>
              <div class="space-y-2 max-h-40 overflow-y-auto">
                <div *ngFor="let s of currClientPub.reseauxSociaux; let i = index"
                     class="grid grid-cols-[1.2fr_1.5fr_1.2fr_auto] gap-2 items-center">
                  <input type="text" [(ngModel)]="s.plateforme" [name]="'sp'+i" list="socialPlatforms" (change)="onPlatformChange(s)"
                         placeholder="Plateforme (ex: Facebook)" class="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white w-full">
                  <input type="url"  [(ngModel)]="s.url"        [name]="'su'+i"
                         placeholder="Lien (https://...)" class="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white w-full">
                  <input type="text" [(ngModel)]="s.iconClass" [name]="'si'+i" list="socialIcons"
                         placeholder="Icône (fa-brands fa-...)" class="bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white w-full">
                  <button type="button" class="text-red-400 hover:text-red-300 text-lg leading-none"
                          (click)="currClientPub.reseauxSociaux.splice(i, 1)">×</button>
                </div>
                <div *ngIf="currClientPub.reseauxSociaux?.length === 0" class="text-xs text-slate-500 text-center py-2">
                  Aucun réseau social ajouté.
                </div>
              </div>
            </div>

            <!-- Listes de suggestions réutilisables -->
            <datalist id="socialPlatforms">
              <option value="Facebook"></option>
              <option value="Twitter"></option>
              <option value="Instagram"></option>
              <option value="LinkedIn"></option>
              <option value="YouTube"></option>
              <option value="TikTok"></option>
              <option value="WhatsApp"></option>
            </datalist>
            <datalist id="socialIcons">
              <option value="fa-brands fa-facebook"></option>
              <option value="fa-brands fa-x-twitter"></option>
              <option value="fa-brands fa-instagram"></option>
              <option value="fa-brands fa-linkedin"></option>
              <option value="fa-brands fa-youtube"></option>
              <option value="fa-brands fa-tiktok"></option>
              <option value="fa-brands fa-whatsapp"></option>
            </datalist>

            <div class="form-group flex items-center gap-3">
              <input name="cactive" type="checkbox" [(ngModel)]="currClientPub.active" class="w-auto">
              <label class="mb-0">Annonceur Actif</label>
            </div>
            <div class="flex gap-4 pt-4">
              <button type="button" class="btn-secondary flex-1" (click)="showClientPubModal=false">Annuler</button>
              <button type="submit" class="btn-primary flex-1">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ══ PROMO MODAL ══════════════════════════════════ -->
      <div *ngIf="showPromoModal" class="modal-overlay" (click)="showPromoModal=false">
        <div class="modal-card animate-slide-up" (click)="$event.stopPropagation()">
          <h2 class="text-xl font-bold mb-6">{{ isEditingPromo ? 'Modifier' : 'Ajouter' }} une Promotion</h2>
          <form (submit)="savePromo($event)" class="space-y-4">
            <div class="form-group"><label>Libellé de l'offre</label><input name="pl" type="text" required [(ngModel)]="currPromo.libelle"></div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group"><label>Date de début</label><input name="pdd" type="datetime-local" required [(ngModel)]="currPromo.dateDebut"></div>
              <div class="form-group"><label>Date de fin</label><input name="pdf" type="datetime-local" required [(ngModel)]="currPromo.dateFin"></div>
            </div>
            <div class="form-group"><label>Prix Promotionnel (€)</label><input name="pp" type="number" step="0.01" required [(ngModel)]="currPromo.prixPromo"></div>
            
            <div class="form-group">
              <label>Produits éligibles
                <span class="text-[10px] text-slate-500 font-normal ml-1">(actifs uniquement)</span>
              </label>
              <div class="max-h-44 overflow-y-auto border border-slate-700 rounded-xl p-3 space-y-2 bg-slate-900/50">
                <ng-container *ngFor="let p of produits">
                  <label *ngIf="p.active && !p.deleted"
                         class="flex items-center gap-3 cursor-pointer hover:bg-slate-800 rounded-lg px-2 py-1.5 transition-colors">
                    <input type="checkbox"
                           [checked]="currPromo.produitIds.includes(p.id)"
                           (change)="currPromo.produitIds.includes(p.id)
                             ? currPromo.produitIds.splice(currPromo.produitIds.indexOf(p.id), 1)
                             : currPromo.produitIds.push(p.id)"
                           class="w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0">
                    <span class="text-sm text-slate-200 leading-tight">{{ p.libelle }}</span>
                    <span class="ml-auto text-[10px] text-blue-400 font-semibold">{{ p.prix | number:'1.2-2' }} €</span>
                  </label>
                </ng-container>
                <div *ngIf="activeProduitsCount === 0" class="text-center text-xs text-slate-500 py-3">
                  Aucun produit actif disponible.
                </div>
              </div>
            </div>

            <div class="flex gap-4 pt-4"><button type="button" class="btn-secondary flex-1" (click)="showPromoModal=false">Annuler</button><button type="submit" class="btn-primary flex-1">Enregistrer</button></div>
          </form>
        </div>
      </div>

      <!-- ══ PUB MODAL ══════════════════════════════════ -->
      <div *ngIf="showPubModal" class="modal-overlay" (click)="showPubModal=false">
        <div class="modal-card modal-xl animate-slide-up" (click)="$event.stopPropagation()">
          <h2 class="text-xl font-bold mb-6">{{ isEditingPub ? 'Modifier' : 'Ajouter' }} une Publicité</h2>
          <form (submit)="savePub($event)" class="space-y-4">

            <!-- Annonceur -->
            <div class="form-group">
              <div class="flex items-center justify-between mb-1">
                <label class="!mb-0">Annonceur (Client-Pub)</label>
                <button type="button" class="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        (click)="openQuickAddClientPub()">
                  ➕ Nouvel annonceur
                </button>
              </div>
              <select name="paid" [(ngModel)]="currPub.clientPubId"
                      class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white">
                <option value="">— Sélectionner un annonceur —</option>
                <option *ngFor="let c of activeClientPubs" [value]="c.id">
                  {{ c.nom }}{{ c.prenom ? ' ' + c.prenom : '' }}{{ c.raisonSociale ? ' (' + c.raisonSociale + ')' : '' }}
                </option>
              </select>
              <div *ngIf="activeClientPubs.length === 0" class="text-[11px] text-amber-500 mt-1">
                ⚠️ Aucun annonceur actif — créez-en un via le bouton ci-dessus.
              </div>
            </div>

            <!-- Période -->
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group"><label>Début de campagne</label>
                <input name="pab" type="datetime-local" required [(ngModel)]="currPub.debut">
              </div>
              <div class="form-group"><label>Fin de campagne</label>
                <input name="paf" type="datetime-local" required [(ngModel)]="currPub.fin">
              </div>
            </div>

            <!-- Budget / Durée -->
            <div class="grid grid-cols-2 gap-4">
              <div class="form-group"><label>Budget (€)</label>
                <input name="pap" type="number" step="0.01" min="0" required [(ngModel)]="currPub.prix">
              </div>
              <div class="form-group"><label>Durée d'affichage (sec.)</label>
                <input name="pad" type="number" min="1" [(ngModel)]="currPub.duree">
              </div>
            </div>

            <!-- Images : file picker -->
            <div class="form-group">
              <label>Visuels de la campagne</label>
              <div class="border-2 border-dashed border-slate-700 rounded-xl p-4 text-center cursor-pointer hover:border-blue-500 transition-colors relative"
                   (click)="pubFileInput.click()" (dragover)="$event.preventDefault()" (drop)="onPubImageDrop($event)">
                <input #pubFileInput type="file" multiple accept="image/*" class="hidden"
                       (change)="onPubImageSelect($event)">
                <div *ngIf="currPub.imageUrls.length === 0 && !pubUploading" class="py-4">
                  <div class="text-3xl mb-2">📷</div>
                  <p class="text-sm text-slate-400">Cliquer ou glisser-déposer des images</p>
                  <p class="text-[11px] text-slate-600 mt-1">JPG, PNG, WebP — Upload automatique vers MinIO</p>
                </div>
                <div *ngIf="pubUploading" class="py-4">
                  <div class="text-2xl animate-spin inline-block">&#8987;</div>
                  <p class="text-xs text-blue-400 mt-2">Upload en cours...</p>
                </div>
              </div>
              <!-- Thumbnails -->
              <div *ngIf="currPub.imageUrls.length > 0" class="grid grid-cols-4 gap-2 mt-3">
                <div *ngFor="let url of currPub.imageUrls; let i = index"
                     class="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video bg-slate-900">
                  <img [src]="url" class="w-full h-full object-cover">
                  <button type="button"
                          class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                          (click)="currPub.imageUrls.splice(i, 1)">×</button>
                </div>
              </div>
            </div>

            <!-- Statut -->
            <div class="flex items-center gap-3">
              <input name="pactive" type="checkbox" [(ngModel)]="currPub.active" class="w-auto">
              <label class="mb-0 text-sm">Campagne active</label>
            </div>

            <div class="flex gap-4 pt-4">
              <button type="button" class="btn-secondary flex-1" (click)="showPubModal=false">Annuler</button>
              <button type="submit" class="btn-primary flex-1">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ══ SOCIALLINK MODAL ══════════════════════════════════ -->
      <div *ngIf="showSocialLinkModal" class="modal-overlay" (click)="showSocialLinkModal=false">
        <div class="modal-card animate-slide-up !max-w-xl" (click)="$event.stopPropagation()">
          <h2 class="text-xl font-bold mb-6">{{ isEditingSocialLink ? 'Modifier' : 'Ajouter' }} un Lien Social</h2>
          <form (submit)="saveSocialLink($event)" class="space-y-4">
            
            <div class="form-group">
              <label>Plateforme *</label>
              <input name="slplatform" type="text" required [(ngModel)]="currSocialLink.platform" list="socialPlatforms" (change)="onPlatformChange(currSocialLink)"
                     placeholder="Facebook, Instagram, custom...">
            </div>

            <div class="form-group">
              <label>URL du Profil *</label>
              <input name="slurl" type="url" required [(ngModel)]="currSocialLink.url"
                     placeholder="https://...">
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="form-group">
                <label>Classe d'Icône *</label>
                <input name="slicon" type="text" required [(ngModel)]="currSocialLink.iconClass" list="socialIcons"
                       placeholder="fa-brands fa-facebook">
              </div>
              <div class="form-group">
                <label>Ordre d'Affichage</label>
                <input name="slorder" type="number" min="0" [(ngModel)]="currSocialLink.displayOrder">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 items-center pt-2">
              <div class="form-group">
                <label>Type de Propriétaire</label>
                <select name="slowner" [(ngModel)]="currSocialLink.ownerType"
                        class="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-sm text-white">
                  <option value="US">Plateforme (Interne)</option>
                  <option value="CLIENT">Annonceurs (CRM)</option>
                </select>
              </div>
              <div class="flex items-center gap-3 pt-6">
                <input name="slactive" type="checkbox" [(ngModel)]="currSocialLink.isActive" class="w-auto">
                <label class="mb-0 text-sm">Lien Actif</label>
              </div>
            </div>

            <div class="flex gap-4 pt-4">
              <button type="button" class="btn-secondary flex-1" (click)="showSocialLinkModal=false">Annuler</button>
              <button type="submit" class="btn-primary flex-1">Enregistrer</button>
            </div>
          </form>
        </div>
      </div>

      <!-- ══ TOAST NOTIFICATIONS ══════════════════════════════════ -->
      <div class="fixed bottom-6 right-6 z-[2000] flex flex-col gap-3">
        <div *ngFor="let toast of toasts" 
             class="px-5 py-3 rounded-xl shadow-lg font-medium text-sm flex items-center gap-3 animate-slide-up"
             [ngClass]="{'bg-green-500 text-white': toast.type==='success', 'bg-red-500 text-white': toast.type==='error', 'bg-blue-500 text-white': toast.type==='info'}">
          <span *ngIf="toast.type==='success'">✅</span>
          <span *ngIf="toast.type==='error'">❌</span>
          <span *ngIf="toast.type==='info'">ℹ️</span>
          {{ toast.message }}
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { 
      --bg: #0b0f19; --card: #151b2d; --accent: #3b82f6; --text: #f8fafc; 
      --subtext: #94a3b8; --border: rgba(255,255,255,0.06); 
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      font-size: 13px; color: var(--text);
    }
    * { box-sizing: border-box; }
    
    /* Premium Scrollbar */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--accent); }
    
    .dash-container { display: flex; height: 100vh; background: var(--bg); overflow: hidden; }
    
    /* Sidebar */
    .dash-sidebar { width: 220px; background: #0f172a; border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; }
    .sb-logo { padding: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
    .logo-box { width: 26px; height: 26px; background: var(--accent); border-radius: 6px; }
    .sb-title { font-weight: 800; font-size: 15px; letter-spacing: -0.5px; }
    
    .sb-nav { flex: 1; padding: 0.75rem; overflow-y: auto; }
    .sb-section-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--subtext); margin: 1.25rem 0 0.5rem 0.75rem; opacity: 0.6; font-weight: 700; }
    .sb-item { 
      display: flex; align-items: center; gap: 0.75rem; padding: 0.55rem 0.75rem; 
      color: var(--subtext); cursor: pointer; border-radius: 8px; transition: 0.2s;
      margin-bottom: 2px; font-size: 12.5px;
    }
    .sb-item:hover { background: rgba(255,255,255,0.03); color: #fff; }
    .sb-item.active { background: rgba(59, 130, 246, 0.1); color: var(--accent); font-weight: 500; }
    .sb-icon { font-size: 15px; }

    /* Footer Profile */
    .sb-footer { padding: 1rem; border-top: 1px solid var(--border); }
    .sb-profile { display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.02); padding: 0.6rem; border-radius: 10px; }
    .sb-avatar { width: 28px; height: 28px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; }
    .sb-uname { font-size: 11.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sb-urole { font-size: 9px; color: var(--subtext); text-transform: uppercase; letter-spacing: 0.5px; }

    /* Main Content */
    .dash-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .dash-header { 
      height: 50px; border-bottom: 1px solid var(--border); display: flex; 
      align-items: center; justify-content: space-between; padding: 0 1.5rem; 
      background: rgba(11, 15, 25, 0.8); backdrop-filter: blur(8px); flex-shrink: 0;
    }
    
    .content-area { flex: 1; padding: 1.5rem; overflow-y: auto; scroll-behavior: smooth; }
    
    /* Cards & Tables */
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .card-title { font-size: 13px; font-weight: 600; margin: 0; color: #fff; }
    
    .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .data-table th { text-align: left; padding: 0.6rem 0.75rem; color: var(--subtext); font-weight: 600; border-bottom: 1px solid var(--border); text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.5px; }
    .data-table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--border); vertical-align: middle; color: #cbd5e1; }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover { background: rgba(255,255,255,0.01); }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .stat-card { background: var(--card); padding: 1rem; border-radius: 10px; border: 1px solid var(--border); }
    .stat-label { font-size: 10px; color: var(--subtext); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
    .stat-value { font-size: 18px; font-weight: 700; margin: 0.25rem 0; color: #fff; }
    .stat-trend { font-size: 9px; padding: 1px 5px; border-radius: 4px; background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: 600; }
    .stat-bar { height: 4px; background: rgba(255,255,255,0.03); border-radius: 2px; margin-top: 0.75rem; overflow: hidden; }
    .stat-bar-fill { height: 100%; background: var(--accent); }

    /* Inputs & Forms - Compact */
    .form-group { margin-bottom: 0.75rem; }
    .form-group label { display: block; font-size: 10.5px; color: var(--subtext); margin-bottom: 0.35rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    input, select, textarea { 
      width: 100%; background: #1a202e; border: 1px solid var(--border); 
      border-radius: 6px; padding: 0.45rem 0.6rem; color: #fff; font-size: 12.5px; outline: none; transition: 0.2s;
    }
    input:focus { border-color: var(--accent); background: #1e293b; }
    
    .btn-primary { background: var(--accent); color: #fff; border: none; padding: 0.45rem 0.9rem; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 12px; }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-secondary { background: rgba(255,255,255,0.04); color: #fff; border: 1px solid var(--border); padding: 0.45rem 0.9rem; border-radius: 6px; cursor: pointer; font-size: 12px; }
    .btn-sm { padding: 0.25rem 0.5rem; font-size: 10px; border-radius: 4px; }

    /* Badges */
    .badge { padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .badge-on { background: rgba(16, 185, 129, 0.1); color: #10b981; }
    .badge-off { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
    .role-badge { font-size: 9px; background: rgba(59, 130, 246, 0.1); color: var(--accent); padding: 1px 5px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }

    /* Modals */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1.5rem; }
    .modal-card { 
      background: var(--card); width: 100%; max-width: 420px; border-radius: 12px; 
      padding: 1.5rem; border: 1px solid var(--border); box-shadow: 0 20px 50px rgba(0,0,0,0.4); 
      max-height: 90vh; overflow-y: auto;
    }
    .modal-card.modal-xl { max-width: 650px; }
    .modal-card h2 { font-size: 16px; margin-bottom: 1.25rem; font-weight: 700; color: #fff; }

    /* Layout Helpers */
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
    .page-title { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; color: #fff; }
    .page-sub { font-size: 11.5px; color: var(--subtext); margin-top: 0.1rem; }
    
    .toolbar { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1.25rem; padding: 0.6rem 0.8rem !important; }
    .search-box { flex: 1; position: relative; }
    .search-icon { position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%); opacity: 0.5; font-size: 12px; }
    .search-box input { padding-left: 2rem; background: rgba(255,255,255,0.02); }
    .filter-select { width: auto; font-size: 11.5px; padding: 0.4rem 0.75rem; background: rgba(255,255,255,0.03); }

    .user-cell { display: flex; align-items: center; gap: 0.6rem; }
    .user-ava { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 10px; color: #fff; }
    
    .action-btns { display: flex; gap: 0.35rem; }
    .btn-revoke { background: rgba(239, 68, 68, 0.08); color: #ef4444; }
    .btn-block { background: rgba(245, 158, 11, 0.08); color: #f59e0b; }

    .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem; }

    /* Inbox Cards */
    .msg-card { 
      background: var(--card); border-radius: 20px; border: 1px solid var(--border); 
      position: relative; overflow: hidden; transition: 0.3s;
    }
    .msg-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.1); }
    .msg-card-accent { 
      position: absolute; left: 0; top: 0; bottom: 0; width: 4px; 
      background: var(--accent); opacity: 0.8;
    }
    .msg-handled .msg-card-accent { background: #10b981; }
    .msg-handled { opacity: 0.8; }
    .msg-handled:hover { opacity: 1; }
    .msg-deleted { opacity: 0.5; grayscale: 1; }

    .custom-check {
      width: 20px; height: 20px; border-radius: 4px; border: 2px solid var(--border);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      transition: 0.2s; font-size: 12px; color: transparent;
    }
    .custom-check.checked { background: var(--accent); border-color: var(--accent); color: #fff; }
    .custom-check.dispo-check.checked { background: #10b981; border-color: #10b981; }
    .custom-check.disabled { opacity: 0.2; cursor: not-allowed; pointer-events: none; }
    .custom-check:hover:not(.disabled) { border-color: var(--accent); transform: scale(1.1); }
    .chart-card { min-height: 320px; display: flex; flex-direction: column; }
    .chart-container { flex: 1; position: relative; width: 100%; min-height: 220px; }

    .animate-slide-up { animation: slideUp 0.3s ease-out; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

    /* ── Modern Confirm Dialog ── */
    .cd-backdrop {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,.6); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
      animation: cdFade .18s ease;
    }
    @keyframes cdFade { from { opacity:0 } to { opacity:1 } }
    .cd-card {
      background: #0f172a; border: 1px solid rgba(255,255,255,.1);
      border-radius: 22px; padding: 2.25rem 2rem 1.75rem;
      max-width: 400px; width: 100%; text-align: center;
      box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(239,68,68,.1);
      animation: cdPop .24s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes cdPop { from { opacity:0; transform:scale(.85) translateY(8px) } to { opacity:1; transform:scale(1) translateY(0) } }
    .cd-icon  { font-size: 2.8rem; margin-bottom: 1rem; filter: drop-shadow(0 0 12px rgba(239,68,68,.4)); }
    .cd-title { font-size: 1.15rem; font-weight: 700; color: #f1f5f9; margin: 0 0 .5rem; }
    .cd-msg   { font-size: .88rem; color: #94a3b8; margin: 0 0 1.75rem; line-height: 1.55; }
    .cd-actions { display: flex; gap: .75rem; }
    .cd-btn {
      flex: 1; padding: .65rem 1rem; border-radius: 11px; border: none;
      font-size: .87rem; font-weight: 700; cursor: pointer; transition: all .15s;
    }
    .cd-btn--cancel { background: rgba(255,255,255,.07); color: #94a3b8; border: 1px solid rgba(255,255,255,.1); }
    .cd-btn--cancel:hover { background: rgba(255,255,255,.12); color: #f1f5f9; }
    .cd-btn--danger { background: linear-gradient(135deg,#ef4444,#dc2626); color: #fff; box-shadow: 0 4px 14px rgba(239,68,68,.3); }
    .cd-btn--danger:hover { background: linear-gradient(135deg,#f87171,#ef4444); box-shadow: 0 6px 18px rgba(239,68,68,.4); transform: translateY(-1px); }

    @media(max-width:1024px) {
      .dash-sidebar { width: 64px; }
      .sb-title, .sb-sub, .sb-section-label, .sb-item span:last-child, .sb-uname, .sb-urole { display: none; }
      .dash-main { margin-left: 0; }
    }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit {
  tab = 'overview';
  users: User[] = [];
  sessions: UserSession[] = [];
  entreprises: Entreprise[] = [];
  contacts: Contact[] = [];
  ads: Pub[] = [];
  promos: Promotion[] = [];
  results: Resultat[] = [];
  history: HistoryEntry[] = [];
  categories: Categorie[] = [];
  fonctions: Fonction[] = [];
  produits: Produit[] = [];
  clientpubs: ClientPub[] = [];
  ventes: Vente[] = [];
  socialLinks: SocialLink[] = [];
  swaggerUrl: SafeResourceUrl;

  // Search & Filters
  searchQuery = '';
  roleFilter = 'ALL';
  statusFilter = 'ALL';
  userStatusFilter = 'ALL';

  // Quick Add / Edit
  showAddModal = false;
  showAddUserModal = false;
  showEditUserModal = false;
  
  newEntreprise = {
    nom: '',
    raisonSociale: '',
    email: '',
    telephone: '',
    active: true
  };

  newUser: any = {};
  editingUser: any = {};

  // Products CRUD State
  showProduitModal = false;
  isEditingProduit = false;
  currProduit: any = { libelle: '', prix: 0.01, categorieId: null, categorieLibelle: '', urlImage: '', active: true, fonctionIds: [], fonctionLibelles: [] };

  // Generic CRUD (Cat/Fonction)
  // CRM & Business Modals
  showEntrepriseModal = false;
  isEditingEntreprise = false;
  currEntreprise: any = { nom: '', raisonSociale: '', email: '', telephone: '', active: true };

  showClientPubModal = false;
  isEditingClientPub = false;
  currClientPub: any = { nom: '', prenom: '', email: '', raisonSociale: '', active: true };

  // Marketing Modals
  showPromoModal = false;
  isEditingPromo = false;
  currPromo: any = { libelle: '', prixPromo: 0, active: true, produitIds: [], dateDebut: '', dateFin: '' };

  showPubModal = false;
  isEditingPub = false;
  currPub: any = { debut: '', fin: '', prix: 0, active: true, imageUrls: [], clientPubId: '' };

  showSocialLinkModal = false;
  isEditingSocialLink = false;
  currSocialLink: any = { platform: '', url: '', iconClass: '', displayOrder: 0, isActive: true, ownerType: 'US' };

  // Common Dialog
  showGenericModal = false;
  isEditingGeneric = false;
  genericType: 'cat' | 'fon' = 'cat';
  currGeneric: any = { libelle: '', active: true };
  isBulkMode = false;
  bulkLibelles = '';

  toasts: { id: number, message: string, type: 'success' | 'error' | 'info' }[] = [];
  toastId = 0;
  confirmDialog = { isOpen: false, message: '', onConfirm: () => {}, onCancel: () => {} };

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = this.toastId++;
    this.toasts.push({ id, message, type });
    setTimeout(() => this.toasts = this.toasts.filter(t => t.id !== id), 4000);
  }

  openConfirm(message: string, onConfirm: () => void) {
    this.confirmDialog = {
      isOpen: true,
      message,
      onConfirm: () => { onConfirm(); this.confirmDialog.isOpen = false; },
      onCancel: () => this.confirmDialog.isOpen = false
    };
  }

  constructor(
    private adminService: AdminService, 
    private sanitizer: DomSanitizer,
    public authService: AuthService,
    private router: Router
  ) {
    this.swaggerUrl = this.sanitizer.bypassSecurityTrustResourceUrl('http://localhost:8480/swagger-ui.html');
  }

  ngOnInit() {
    this.loadAll();
  }

  ngAfterViewInit() {
    setTimeout(() => this.initCharts(), 500);
  }

  initCharts() {
    const ctx1 = document.getElementById('userGrowthChart') as HTMLCanvasElement;
    if (ctx1) {
      new Chart(ctx1, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Nouveaux Utilisateurs',
            data: [12, 19, 3, 5, 2, 3],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { 
            legend: { display: false },
            tooltip: { backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#cbd5e1' }
          },
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
            x: { grid: { display: false }, ticks: { color: '#64748b' } }
          }
        }
      });
    }

    const ctx2 = document.getElementById('activityChart') as HTMLCanvasElement;
    if (ctx2) {
      new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
          datasets: [{
            label: 'Requêtes API',
            data: [65, 59, 80, 81, 56, 55, 40],
            backgroundColor: '#2563eb',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
            x: { grid: { display: false }, ticks: { color: '#64748b' } }
          }
        }
      });
    }
  }

  get filteredUsers() {
    return this.users.filter(u => {
      const matchSearch = !this.searchQuery || 
        u.fullName.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
        u.email.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchRole = this.roleFilter === 'ALL' || u.role === this.roleFilter;
      const matchStatus = this.userStatusFilter === 'ALL' || 
        (this.userStatusFilter === 'ACTIVE' ? !u.deleted : u.deleted);
      return matchSearch && matchRole && matchStatus;
    });
  }

  get filteredEntreprises() {
    return this.entreprises.filter(e => {
      const matchSearch = !this.searchQuery || 
        e.nom.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
        e.raisonSociale?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        e.email.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || 
        (this.statusFilter === 'ACTIVE' ? !e.deleted : e.deleted);
      return matchSearch && matchStatus;
    });
  }

  get filteredProduits() {
    return this.produits.filter(p => {
      const matchSearch = !this.searchQuery || p.libelle.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || (this.statusFilter === 'ACTIVE' ? !p.deleted : p.deleted);
      return matchSearch && matchStatus;
    });
  }

  get filteredCategories() {
    return this.categories.filter(c => {
      const matchSearch = !this.searchQuery || c.libelle.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || (this.statusFilter === 'ACTIVE' ? !c.deleted : c.deleted);
      return matchSearch && matchStatus;
    });
  }

  get filteredFonctions() {
    return this.fonctions.filter(f => {
      const matchSearch = !this.searchQuery || f.libelle.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || (this.statusFilter === 'ACTIVE' ? !f.deleted : f.deleted);
      return matchSearch && matchStatus;
    });
  }

  get activeClientPubs() {
    return this.clientpubs.filter(c => !c.deleted && c.active);
  }

  get activeProduitsCount() {
    return this.produits.filter(p => p.active && !p.deleted).length;
  }

  get filteredClientPubs() {
    return this.clientpubs.filter(c => {
      const matchSearch = !this.searchQuery || 
        c.nom.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
        c.prenom?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || (this.statusFilter === 'ACTIVE' ? !c.deleted : c.deleted);
      return matchSearch && matchStatus;
    });
  }

  get filteredPromos() {
    return this.promos.filter(p => {
      const matchSearch = !this.searchQuery || p.libelle.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || (this.statusFilter === 'ACTIVE' ? !p.deleted : p.deleted);
      return matchSearch && matchStatus;
    });
  }

  get filteredAds() {
    return this.ads.filter(a => {
      const matchSearch = !this.searchQuery || (a.clientPub?.nom || '').toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchStatus = this.statusFilter === 'ALL' || (this.statusFilter === 'ACTIVE' ? !a.deleted : a.deleted);
      return matchSearch && matchStatus;
    });
  }

  get filteredContacts() {
    return this.contacts.filter(c => {
      const matchSearch = !this.searchQuery || 
        c.nomComplet.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        c.sujet.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchStatus = this.statusFilter === 'ALL' || (this.statusFilter === 'ACTIVE' ? !c.traite && !c.deleted : c.deleted);
      return matchSearch && matchStatus;
    });
  }

  get filteredSocialLinks() {
    return this.socialLinks.filter(s => {
      const matchSearch = !this.searchQuery || 
        s.platform.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
        s.url.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchSearch;
    });
  }

  loadAll() {
    this.loadUsers();
    this.loadSessions();
    this.loadEntreprises();
    this.loadContacts();
    this.loadAds();
    this.loadPromos();
    this.loadResults();
    this.loadHistory();
    this.loadProducts();
    this.loadCRM();
    this.loadBusiness();
    this.loadSocialLinks();
  }

  loadUsers() { 
    forkJoin([this.adminService.getUsers(false), this.adminService.getUsers(true)])
      .subscribe(([active, deleted]) => this.users = [...active, ...deleted]);
  }
  loadSessions() { this.adminService.getSessions().subscribe(s => this.sessions = s); }
  loadEntreprises() { 
    forkJoin([this.adminService.getEntreprises(false), this.adminService.getEntreprises(true)])
      .subscribe(([active, deleted]) => this.entreprises = [...active, ...deleted]);
  }
  loadContacts() { 
    forkJoin([this.adminService.getContacts(false), this.adminService.getContacts(true)])
      .subscribe(([active, deleted]) => this.contacts = [...active, ...deleted]);
  }
  loadAds() { 
    forkJoin([this.adminService.getPubs(false), this.adminService.getPubs(true)])
      .subscribe(([active, deleted]) => this.ads = [...active, ...deleted]);
  }
  loadPromos() { 
    forkJoin([this.adminService.getPromos(false), this.adminService.getPromos(true)])
      .subscribe(([active, deleted]) => this.promos = [...active, ...deleted]);
  }
  loadResults() { this.adminService.getResults().subscribe(r => this.results = r); }
  loadHistory() { this.adminService.getHistory().subscribe(h => this.history = h); }
  loadCRM() {
    forkJoin([this.adminService.getClientPubs(false), this.adminService.getClientPubs(true)])
      .subscribe(([active, deleted]) => this.clientpubs = [...active, ...deleted]);
  }
  loadBusiness() { this.adminService.getVentes().subscribe(v => this.ventes = v); }
  
  loadProducts() {
    forkJoin([this.adminService.getCategories(false), this.adminService.getCategories(true)])
      .subscribe(([active, deleted]) => this.categories = [...active, ...deleted]);
      
    forkJoin([this.adminService.getFonctions(false), this.adminService.getFonctions(true)])
      .subscribe(([active, deleted]) => this.fonctions = [...active, ...deleted]);
      
    forkJoin([this.adminService.getProduits(false), this.adminService.getProduits(true)])
      .subscribe(([active, deleted]) => this.produits = [...active, ...deleted]);

    forkJoin([this.adminService.getContacts(false), this.adminService.getContacts(true)])
      .subscribe(([active, deleted]) => this.contacts = [...active, ...deleted]);
  }

  // --- Products CRUD ---
  openAddProduit() {
    this.isEditingProduit = false;
    this.currProduit = { libelle: '', prix: 0.01, categorieId: null, categorieLibelle: '', urlImage: '', active: true, fonctionIds: [], disponibleFonctionIds: [], fonctionLibelles: [] };
    this.showProduitModal = true;
  }
  openEditProduit(p: Produit) {
    this.isEditingProduit = true;
    this.currProduit = { 
      id: p.id, libelle: p.libelle, prix: p.prix, 
      categorieId: p.categorieId, urlImage: p.urlImage, active: p.active,
      fonctionIds: p.fonctions.map(f => f.id),
      disponibleFonctionIds: p.fonctions.filter(f => f.disponible).map(f => f.id),
      fonctionLibelles: []
    };
    this.showProduitModal = true;
  }
  toggleFonction(id: string) {
    const ids = [...this.currProduit.fonctionIds];
    const dispoIds = [...this.currProduit.disponibleFonctionIds];
    
    const idx = ids.indexOf(id);
    if (idx > -1) {
      ids.splice(idx, 1);
      const dIdx = dispoIds.indexOf(id);
      if (dIdx > -1) dispoIds.splice(dIdx, 1);
    } else {
      ids.push(id);
      dispoIds.push(id); // Auto-dispo when included
    }
    
    this.currProduit.fonctionIds = ids;
    this.currProduit.disponibleFonctionIds = dispoIds;
  }

  toggleFonctionDispo(id: string) {
    const dispoIds = [...this.currProduit.disponibleFonctionIds];
    const idx = dispoIds.indexOf(id);
    if (idx > -1) dispoIds.splice(idx, 1);
    else dispoIds.push(id);
    
    this.currProduit.disponibleFonctionIds = dispoIds;
  }
  // Inbox / Contacts
  showReplyModal = false;
  currContact: Contact | null = null;
  currReply = { sujet: '', message: '' };

  openReply(c: Contact) {
    this.currContact = c;
    this.currReply = { 
      sujet: `Réponse à votre message: ${c.sujet}`, 
      message: `Bonjour ${c.nomComplet},\n\n` 
    };
    this.showReplyModal = true;
  }

  sendReply() {
    if (!this.currContact) return;
    this.adminService.replyToContact(this.currContact.id, this.currReply).subscribe({
      next: () => {
        this.showToast('Réponse envoyée avec succès', 'success');
        this.showReplyModal = false;
        this.loadAll(); // Refresh to update 'traite' status
      },
      error: () => this.showToast("Erreur lors de l'envoi de l'email", 'error')
    });
  }

  deleteContact(id: string) {
    this.openConfirm('Voulez-vous supprimer ce message ?', () => {
      this.adminService.deleteContact(id).subscribe(() => {
        this.showToast('Message supprimé');
        this.loadAll();
      });
    });
  }

  markContactHandled(id: string) {
    this.adminService.markContactHandled(id).subscribe(() => {
      this.showToast('Message marqué comme traité');
      this.loadAll();
    });
  }

  restoreContact(id: string) {
    this.adminService.restoreContact(id).subscribe(() => {
      this.showToast('Message restauré');
      this.loadAll();
    });
  }

  isFonctionSelected(id: string) { return this.currProduit.fonctionIds.includes(id); }

  saveProduit(e: Event) {
    e.preventDefault();
    if (!this.currProduit.libelle || this.currProduit.prix <= 0) {
      this.showToast('Veuillez remplir tous les champs obligatoires (Libellé et Prix > 0)', 'error');
      return;
    }

    const req = { ...this.currProduit };
    if (req.categorieId === 'NEW') {
      req.categorieId = null;
      // libelle is already in req.categorieLibelle
    } else {
      req.categorieLibelle = null;
    }
    
    // Ensure lists are present
    req.fonctionIds = req.fonctionIds || [];
    req.fonctionLibelles = req.fonctionLibelles || [];

    const obs = this.isEditingProduit 
      ? this.adminService.updateProduit(req.id, req)
      : this.adminService.createProduit(req);
    
    obs.subscribe({
      next: () => {
        this.showToast('Produit enregistré !', 'success');
        this.showProduitModal = false;
        this.loadProducts();
      },
      error: (err: any) => {
        console.error('Save Product Error:', err);
        const msg = err.error ? Object.values(err.error).join(', ') : 'Erreur lors de l\'enregistrement';
        this.showToast(msg, 'error');
      }
    });
  }
  deleteProduit(id: string) {
    this.openConfirm('Supprimer ce produit ?', () => {
      this.adminService.deleteProduit(id).subscribe(() => { this.showToast('Produit supprimé', 'success'); this.loadProducts(); });
    });
  }
  restoreProduit(id: string) {
    this.adminService.restoreProduit(id).subscribe(() => { this.showToast('Produit restauré', 'success'); this.loadProducts(); });
  }

  // --- Generic CRUD (Cat/Fonction) ---
  openAddCategorie() { 
    this.genericType = 'cat'; this.isEditingGeneric = false; this.isBulkMode = false; this.bulkLibelles = '';
    this.currGeneric = { libelle: '', active: true }; this.showGenericModal = true; 
  }
  openEditCategorie(c: Categorie) { this.genericType = 'cat'; this.isEditingGeneric = true; this.isBulkMode = false; this.currGeneric = { ...c }; this.showGenericModal = true; }
  openAddFonction() { 
    this.genericType = 'fon'; this.isEditingGeneric = false; this.isBulkMode = false; this.bulkLibelles = '';
    this.currGeneric = { libelle: '', active: true }; this.showGenericModal = true; 
  }
  openEditFonction(f: Fonction) { this.genericType = 'fon'; this.isEditingGeneric = true; this.isBulkMode = false; this.currGeneric = { ...f }; this.showGenericModal = true; }

  saveGeneric(e: Event) {
    e.preventDefault();
    const isCat = this.genericType === 'cat';
    
    if (this.isBulkMode && !this.isEditingGeneric) {
      const libelles = this.bulkLibelles.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 0);
      const obs = isCat ? this.adminService.createCategorieBulk(libelles) : this.adminService.createFonctionBulk(libelles);
      obs.subscribe({
        next: () => {
          this.showToast(`${libelles.length} éléments ajoutés !`, 'success');
          this.showGenericModal = false;
          this.loadProducts();
        },
        error: (err: any) => this.showToast(err.error?.message || 'Erreur', 'error')
      });
      return;
    }

    const obs = isCat
      ? (this.isEditingGeneric ? this.adminService.updateCategorie(this.currGeneric.id, this.currGeneric) : this.adminService.createCategorie(this.currGeneric))
      : (this.isEditingGeneric ? this.adminService.updateFonction(this.currGeneric.id, this.currGeneric) : this.adminService.createFonction(this.currGeneric));
    
    obs.subscribe({
      next: () => {
        this.showToast('Enregistré avec succès !', 'success');
        this.showGenericModal = false;
        this.loadProducts();
      },
      error: (err: any) => this.showToast(err.error?.message || 'Erreur', 'error')
    });
  }

  // --- Entreprises CRUD ---
  openAddEntreprise() { this.isEditingEntreprise = false; this.currEntreprise = { nom: '', raisonSociale: '', email: '', telephone: '', active: true }; this.showEntrepriseModal = true; }
  openEditEntreprise(e: Entreprise) { this.isEditingEntreprise = true; this.currEntreprise = { ...e }; this.showEntrepriseModal = true; }
  saveEntreprise(e: Event) {
    e.preventDefault();
    const obs = this.isEditingEntreprise ? this.adminService.updateEntreprise(this.currEntreprise.id, this.currEntreprise) : this.adminService.createEntreprise(this.currEntreprise);
    obs.subscribe({
      next: () => { this.showToast('Entreprise enregistrée'); this.showEntrepriseModal = false; this.loadEntreprises(); },
      error: (err: any) => this.showToast(err.error?.message || 'Erreur', 'error')
    });
  }
  deleteEntreprise(id: string) { this.openConfirm('Supprimer cette entreprise ?', () => this.adminService.deleteEntreprise(id).subscribe(() => this.loadEntreprises())); }
  restoreEntreprise(id: string) { this.adminService.restoreEntreprise(id).subscribe(() => this.loadEntreprises()); }

  // --- ClientPub CRUD ---
  openAddClientPub() {
    this._returnToPubModal = false;
    this.isEditingClientPub = false;
    this.currClientPub = { nom: '', prenom: '', email: '', raisonSociale: '', contact1: '', active: true };
    this.showClientPubModal = true;
  }
  openEditClientPub(c: ClientPub) { this.isEditingClientPub = true; this.currClientPub = { ...c }; this.showClientPubModal = true; }
  saveClientPub(e: Event) {
    e.preventDefault();
    const obs = this.isEditingClientPub
      ? this.adminService.updateClientPub(this.currClientPub.id, this.currClientPub)
      : this.adminService.createClientPub(this.currClientPub);
    obs.subscribe({
      next: (saved: ClientPub) => {
        this.showToast('Annonceur enregistré ✓', 'success');
        this.showClientPubModal = false;
        // Refresh list then optionally auto-select in Pub modal
        this.adminService.getClientPubs(false).subscribe(list => {
          this.clientpubs = [...list];
          if (this._returnToPubModal) {
            this._returnToPubModal = false;
            this.currPub.clientPubId = saved.id;   // auto-select new client
            this.showPubModal = true;               // re-open pub modal
          }
        });
      },
      error: (err: any) => this.showToast(err.error?.message || 'Erreur lors de la création', 'error')
    });
  }
  deleteClientPub(id: string) { this.openConfirm('Supprimer ce client-pub ?', () => this.adminService.deleteClientPub(id).subscribe(() => this.loadCRM())); }
  restoreClientPub(id: string) { this.adminService.restoreClientPub(id).subscribe(() => this.loadCRM()); }

  // --- Promotions CRUD ---
  openAddPromo() { this.isEditingPromo = false; this.currPromo = { libelle: '', prixPromo: 0, active: true, produitIds: [], dateDebut: '', dateFin: '' }; this.showPromoModal = true; }
  openEditPromo(p: Promotion) { this.isEditingPromo = true; this.currPromo = { ...p, produitIds: p.produits.map(x => x.id) }; this.showPromoModal = true; }
  savePromo(e: Event) {
    e.preventDefault();
    const obs = this.isEditingPromo ? this.adminService.updatePromo(this.currPromo.id, this.currPromo) : this.adminService.createPromo(this.currPromo);
    obs.subscribe({
      next: () => { this.showToast('Promotion enregistrée'); this.showPromoModal = false; this.loadPromos(); },
      error: (err: any) => this.showToast(err.error?.message || 'Erreur', 'error')
    });
  }
  deletePromo(id: string) { this.openConfirm('Supprimer cette promotion ?', () => this.adminService.deletePromo(id).subscribe(() => this.loadPromos())); }
  restorePromo(id: string) { this.adminService.restorePromo(id).subscribe(() => this.loadPromos()); }

  // --- Pubs CRUD ---
  openAddPub() {
    this.isEditingPub = false;
    this.currPub = { debut: '', fin: '', prix: 0, active: true, imageUrls: [], clientPubId: '' };
    this.loadCRM(); // Refresh clients list
    this.showPubModal = true;
  }
  openEditPub(p: Pub) {
    this.isEditingPub = true;
    this.currPub = { ...p, clientPubId: p.clientPub?.id || '' };
    this.loadCRM(); // Refresh clients list
    this.showPubModal = true;
  }

  /** Open ClientPub modal inline from the Pub modal (quick-add flow) */
  openQuickAddClientPub() {
    this._returnToPubModal = true;
    this.isEditingClientPub = false;
    this.currClientPub = { nom: '', prenom: '', email: '', raisonSociale: '', contact1: '', siteWeb: '', responsable: '', active: true, reseauxSociaux: [] };
    this.showPubModal = false;   // hide pub modal to avoid stacking issues
    this.showClientPubModal = true;
  }

  /** Add an empty social row to current ClientPub */
  addSocialRow() {
    if (!this.currClientPub.reseauxSociaux) this.currClientPub.reseauxSociaux = [];
    this.currClientPub.reseauxSociaux.push({ plateforme: '', url: '', iconClass: '' });
  }

  /** Automatically fill icon class based on typed or selected platform */
  onPlatformChange(s: any) {
    const platformName = s.plateforme || s.platform || '';
    const platform = platformName.trim().toLowerCase();
    const icons: { [key: string]: string } = {
      'facebook': 'fa-brands fa-facebook',
      'twitter': 'fa-brands fa-x-twitter',
      'x': 'fa-brands fa-x-twitter',
      'instagram': 'fa-brands fa-instagram',
      'linkedin': 'fa-brands fa-linkedin',
      'youtube': 'fa-brands fa-youtube',
      'tiktok': 'fa-brands fa-tiktok',
      'whatsapp': 'fa-brands fa-whatsapp'
    };
    if (icons[platform]) {
      s.iconClass = icons[platform];
    }
  }

  /** Internal flag – know we should return to Pub modal after ClientPub save */
  private _returnToPubModal = false;

  // ─── Image upload for Pub ───────────────────────────────────────────────────
  pubUploading = false;

  onPubImageSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.uploadPubFiles(Array.from(input.files));
  }

  onPubImageDrop(event: DragEvent) {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length) this.uploadPubFiles(files);
  }

  private uploadPubFiles(files: File[]) {
    this.pubUploading = true;
    this.adminService.uploadPubImages(files).subscribe({
      next: (urls: string[]) => {
        this.currPub.imageUrls = [...(this.currPub.imageUrls || []), ...urls];
        this.pubUploading = false;
        this.showToast(`${urls.length} image(s) uploadée(s) ✓`, 'success');
      },
      error: (err: any) => {
        this.pubUploading = false;
        this.showToast(err.error?.message || 'Erreur upload', 'error');
      }
    });
  }

  savePub(e: Event) {
    e.preventDefault();
    const obs = this.isEditingPub ? this.adminService.updatePub(this.currPub.id, this.currPub) : this.adminService.createPub(this.currPub);
    obs.subscribe({
      next: () => { this.showToast('Publicité enregistrée'); this.showPubModal = false; this.loadAds(); },
      error: (err: any) => this.showToast(err.error?.message || 'Erreur', 'error')
    });
  }
  deletePub(id: string) { this.openConfirm('Supprimer cette publicité ?', () => this.adminService.deletePub(id).subscribe(() => this.loadAds())); }
  restorePub(id: string) { this.adminService.restorePub(id).subscribe(() => this.loadAds()); }

  deleteCategorie(id: string) { this.openConfirm('Supprimer cette catégorie ?', () => this.adminService.deleteCategorie(id).subscribe(() => this.loadProducts())); }
  restoreCategorie(id: string) { this.adminService.restoreCategorie(id).subscribe(() => this.loadProducts()); }
  deleteFonction(id: string) { this.openConfirm('Supprimer cette fonction ?', () => this.adminService.deleteFonction(id).subscribe(() => this.loadProducts())); }
  restoreFonction(id: string) { this.adminService.restoreFonction(id).subscribe(() => this.loadProducts()); }

  deleteUser(id: string) {
    this.openConfirm('Voulez-vous supprimer / désactiver cet utilisateur ?', () => {
      this.adminService.deleteUser(id).subscribe(() => {
        this.loadUsers();
        this.showToast('Utilisateur supprimé', 'success');
      });
    });
  }

  restoreUser(id: string) {
    this.openConfirm('Voulez-vous restaurer cet utilisateur ?', () => {
      this.adminService.restoreUser(id).subscribe(() => {
        this.loadUsers();
        this.showToast('Utilisateur restauré', 'success');
      });
    });
  }

  openAddUser() {
    this.newUser = {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'USER',
      credits: 0,
      enabled: true
    };
    this.showAddUserModal = true;
  }

  createUser(event: Event) {
    event.preventDefault();
    if (this.newUser.password !== this.newUser.confirmPassword) {
      this.showToast('Les mots de passe ne correspondent pas.', 'error');
      return;
    }
    this.adminService.createUser(this.newUser).subscribe({
      next: () => {
        this.showAddUserModal = false;
        this.loadUsers();
        this.showToast('Utilisateur créé avec succès', 'success');
      },
      error: (err: any) => this.showToast('Erreur lors de l\'ajout: ' + (err.error?.message || ''), 'error')
    });
  }

  openEditUser(u: User) {
    this.editingUser = {
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      credits: u.credits,
      enabled: u.enabled
    };
    this.showEditUserModal = true;
  }

  saveUser(event: Event) {
    event.preventDefault();
    this.adminService.updateUser(this.editingUser.id, this.editingUser).subscribe({
      next: () => {
        this.showEditUserModal = false;
        this.loadUsers();
        this.showToast('Utilisateur mis à jour', 'success');
      },
      error: (err: any) => this.showToast('Erreur lors de la mise à jour: ' + (err.error?.message || ''), 'error')
    });
  }

  revokeSessions(id: string) {
    this.openConfirm('Révoquer toutes les sessions de cet utilisateur ?', () => {
      this.adminService.revokeUserSessions(id).subscribe(() => {
        this.showToast('Sessions révoquées.', 'success');
        this.loadSessions();
      });
    });
  }

  revokeSession(sessionId: string) {
    this.openConfirm('Révoquer cette session ?', () => {
      this.adminService.revokeSession(sessionId).subscribe(() => {
        this.showToast('Session révoquée.', 'success');
        this.loadSessions();
      });
    });
  }

  markHandled(id: string) {
    this.adminService.markContactHandled(id).subscribe(() => this.loadContacts());
  }

  getUnhandledCount() {
    return this.contacts.filter(c => !c.traite).length;
  }

  loadSocialLinks() {
    this.adminService.getSocialLinks().subscribe({
      next: (data) => this.socialLinks = data,
      error: (err) => this.showToast('Erreur lors du chargement des réseaux sociaux', 'error')
    });
  }

  openAddSocialLink() {
    this.isEditingSocialLink = false;
    this.currSocialLink = { platform: '', url: '', iconClass: '', displayOrder: 0, isActive: true, ownerType: 'US' };
    this.showSocialLinkModal = true;
  }

  openEditSocialLink(s: SocialLink) {
    this.isEditingSocialLink = true;
    this.currSocialLink = { ...s };
    this.showSocialLinkModal = true;
  }

  saveSocialLink(event: Event) {
    event.preventDefault();
    const obs = this.isEditingSocialLink 
      ? this.adminService.updateSocialLink(this.currSocialLink.id, this.currSocialLink)
      : this.adminService.createSocialLink(this.currSocialLink);
    
    obs.subscribe({
      next: () => {
        this.showToast('Lien social enregistré', 'success');
        this.showSocialLinkModal = false;
        this.loadSocialLinks();
      },
      error: (err: any) => this.showToast(err.error?.message || 'Erreur', 'error')
    });
  }

  toggleSocialLink(id: string) {
    this.adminService.toggleSocialLink(id).subscribe({
      next: () => {
        this.showToast('Statut mis à jour', 'success');
        this.loadSocialLinks();
      },
      error: (err: any) => this.showToast('Erreur de mise à jour', 'error')
    });
  }

  deleteSocialLink(id: string) {
    this.openConfirm('Voulez-vous supprimer ce lien social ?', () => {
      this.adminService.deleteSocialLink(id).subscribe({
        next: () => {
          this.showToast('Lien social supprimé', 'success');
          this.loadSocialLinks();
        },
        error: (err: any) => this.showToast('Erreur de suppression', 'error')
      });
    });
  }

  logout() {
    this.openConfirm('Voulez-vous vous déconnecter du tableau de bord ?', () => {
      this.authService.logout('/admin-login');
    });
  }

  // ── LLM Providers ─────────────────────────────────────────────────────────

  llmTeams:          any[] = [];
  llmAgents:         any[] = [];
  llmFilteredAgents: any[] = [];
  llmGroups:         { agent: any; providers: any[] }[] = [];
  llmLoading  = false;
  llmFilter   = { teamId: '', agentId: '', deleted: 'false' };

  private get llmHeaders(): Record<string, string> {
    const token = this.authService.currentUser()?.token;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async loadLlmProviders() {
    this.llmLoading = true;
    const [tr, ar] = await Promise.all([
      fetch('/api/teams',  { headers: this.llmHeaders }),
      fetch('/api/agents', { headers: this.llmHeaders })
    ]);
    this.llmTeams  = tr.ok ? await tr.json() : [];
    this.llmAgents = ar.ok ? await ar.json() : [];
    this.llmFilteredAgents = [...this.llmAgents];
    await this.reloadLlmForFilter();
  }

  onLlmTeamChange() {
    this.llmFilter.agentId = '';
    const team = this.llmTeams.find((t: any) => t.id === this.llmFilter.teamId);
    const ids  = team?.memberAgentIds ?? [];
    this.llmFilteredAgents = ids.length
      ? this.llmAgents.filter((a: any) => ids.includes(a.id))
      : [...this.llmAgents];
    this.reloadLlmForFilter();
  }

  async reloadLlmForFilter() {
    this.llmLoading = true;
    const includeDeleted = this.llmFilter.deleted !== 'false';
    const targets = this.llmFilter.agentId
      ? this.llmAgents.filter((a: any) => a.id === this.llmFilter.agentId)
      : this.llmFilteredAgents;

    this.llmGroups = await Promise.all(
      targets.map(async (agent: any) => {
        const r = await fetch(
          `/api/agents/${agent.id}/llm-providers?includeDeleted=${includeDeleted}`,
          { headers: this.llmHeaders }
        );
        let providers: any[] = r.ok ? await r.json() : [];
        if (this.llmFilter.deleted === 'false') providers = providers.filter((p: any) => !p.deleted);
        if (this.llmFilter.deleted === 'true')  providers = providers.filter((p: any) =>  p.deleted);
        return { agent, providers };
      })
    );
    this.llmLoading = false;
  }

  async llmSetPrimary(agent: any, provider: any) {
    await fetch(`/api/agents/${agent.id}/llm-providers/${provider.id}/primary`,
      { method: 'PATCH', headers: this.llmHeaders });
    await this.reloadLlmForFilter();
  }

  async llmRestore(agent: any, provider: any) {
    await fetch(`/api/agents/${agent.id}/llm-providers/${provider.id}/restore`,
      { method: 'POST', headers: this.llmHeaders });
    await this.reloadLlmForFilter();
  }

  async llmDelete(agent: any, provider: any) {
    await fetch(`/api/agents/${agent.id}/llm-providers/${provider.id}`,
      { method: 'DELETE', headers: this.llmHeaders });
    await this.reloadLlmForFilter();
  }

  llmAllEmpty() {
    return this.llmGroups.every(g => g.providers.length === 0);
  }

  llmActiveCount(providers: any[]): number {
    return providers.filter(p => !p.deleted).length;
  }

  llmAskDelete(agent: any, provider: any) {
    this.openConfirm('Supprimer ce provider LLM ?', () => this.llmDelete(agent, provider));
  }

  llmTypeMeta(type: string) {
    const m: Record<string, { label: string; color: string; icon: string }> = {
      GROQ:      { label: 'Groq',      color: '#f97316', icon: '⚡' },
      ANTHROPIC: { label: 'Anthropic', color: '#f59e0b', icon: '🤖' },
      OPENAI:    { label: 'OpenAI',    color: '#10b981', icon: '✨' },
      GEMINI:    { label: 'Gemini',    color: '#3b82f6', icon: '♊' },
      MISTRAL:   { label: 'Mistral',   color: '#8b5cf6', icon: '🌊' },
      OLLAMA:    { label: 'Ollama',    color: '#6b7280', icon: '🦙' },
    };
    return m[type] ?? { label: type, color: '#6b7280', icon: '🔧' };
  }
}

