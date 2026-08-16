import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id: string; fullName: string; email: string; role: string; enabled: boolean; deleted: boolean; credits: number; createdAt: string;
}

export interface UserSession {
  id: string; userId: string; userEmail: string; ipAddress: string; userAgent: string; deviceType: string; accessTokenExpiresAt: string; revoked: boolean; lastAccessedAt: string; createdAt: string;
}

export interface Entreprise {
  id: string; nom: string; raisonSociale: string; email: string; telephone: string; active: boolean; deleted: boolean; createdAt: string;
}

export interface Contact {
  id: string; nomComplet: string; email: string; sujet: string; message: string; traite: boolean; deleted: boolean; createdAt: string;
}

export interface Pub {
  id: string; debut: string; fin: string; imageUrls: string[]; active: boolean; deleted: boolean; duree: number; prix: number; clientPub?: ClientPub; createdAt: string;
}

export interface Promotion {
  id: string; libelle: string; dateDebut: string; dateFin: string; prixPromo: number; active: boolean; deleted: boolean; produits: Produit[]; createdAt: string;
}

export interface Resultat {
  id: string; titre: string; description: string; url: string; mediaType: string; abonnement: string;
}

export interface HistoryEntry {
  id: string; query: string; clientId: string; resultCount: number; found: boolean; createdAt: string;
}

export interface Categorie { id: string; libelle: string; active: boolean; deleted: boolean; createdAt: string; }
export interface Fonction  { id: string; libelle: string; active: boolean; deleted: boolean; createdAt: string; }

export interface ProduitFonction {
  id: string; libelle: string; active: boolean; disponible: boolean; createdAt: string;
}

export interface Produit { 
  id: string; libelle: string; prix: number; active: boolean; deleted: boolean; categorieId: string; categorieLibelle: string; urlImage: string; fonctions: ProduitFonction[]; createdAt: string; 
}

export interface ClientPub {
  id: string; nom: string; prenom: string; raisonSociale: string; email: string; contact1: string; contact2: string; responsable: string; siteWeb: string; active: boolean; deleted: boolean; createdAt: string;
}

export interface Vente {
  id: string; clientId: string; produitId: string; montant: number; dateVente: string;
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
  iconClass: string;
  displayOrder: number;
  isActive: boolean;
  ownerType: 'US' | 'CLIENT';
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly API = 'http://localhost:8480/api/auth/api';

  constructor(private http: HttpClient) {}

  // --- Users ---
  getUsers(deleted: boolean | null = false): Observable<User[]> {
    const url = deleted === null ? `${this.API}/users` : `${this.API}/users?deleted=${deleted}`;
    return this.http.get<User[]>(url);
  }
  createUser(req: any): Observable<User> { return this.http.post<User>(`${this.API}/users`, req); }
  updateUser(id: string, req: any): Observable<User> { return this.http.put<User>(`${this.API}/users/${id}`, req); }
  deleteUser(id: string): Observable<void> { return this.http.delete<void>(`${this.API}/users/${id}`); }
  restoreUser(id: string): Observable<User> { return this.http.patch<User>(`${this.API}/users/${id}/restore`, {}); }
  getSessions(): Observable<UserSession[]> { return this.http.get<UserSession[]>(`${this.API}/users/all-sessions`); }
  revokeSession(sessionId: string): Observable<any> { return this.http.post(`${this.API}/users/revoke-session/${sessionId}`, {}); }
  revokeUserSessions(id: string): Observable<void> { return this.http.post<void>(`${this.API}/users/${id}/revoke-sessions`, {}); }

  // --- Entreprises ---
  getEntreprises(deleted = false): Observable<Entreprise[]> { return this.http.get<Entreprise[]>(`${this.API}/entreprise?deleted=${deleted}`); }
  createEntreprise(req: any): Observable<Entreprise> { return this.http.post<Entreprise>(`${this.API}/entreprise`, req); }
  updateEntreprise(id: string, req: any): Observable<Entreprise> { return this.http.put<Entreprise>(`${this.API}/entreprise/${id}`, req); }
  deleteEntreprise(id: string): Observable<void> { return this.http.delete<void>(`${this.API}/entreprise/${id}`); }
  restoreEntreprise(id: string): Observable<Entreprise> { return this.http.patch<Entreprise>(`${this.API}/entreprise/${id}/restore`, {}); }

  // --- Pubs ---
  getPubs(deleted = false): Observable<Pub[]> { return this.http.get<Pub[]>(`${this.API}/pubs?deleted=${deleted}`); }
  createPub(req: any): Observable<Pub> { return this.http.post<Pub>(`${this.API}/pubs`, req); }
  updatePub(id: string, req: any): Observable<Pub> { return this.http.put<Pub>(`${this.API}/pubs/${id}`, req); }
  deletePub(id: string): Observable<void> { return this.http.delete<void>(`${this.API}/pubs/${id}`); }
  restorePub(id: string): Observable<Pub> { return this.http.patch<Pub>(`${this.API}/pubs/${id}/restore`, {}); }

  // --- Promos ---
  getPromos(deleted = false): Observable<Promotion[]> { return this.http.get<Promotion[]>(`${this.API}/promotions?deleted=${deleted}`); }
  createPromo(req: any): Observable<Promotion> { return this.http.post<Promotion>(`${this.API}/promotions`, req); }
  updatePromo(id: string, req: any): Observable<Promotion> { return this.http.put<Promotion>(`${this.API}/promotions/${id}`, req); }
  deletePromo(id: string): Observable<void> { return this.http.delete<void>(`${this.API}/promotions/${id}`); }
  restorePromo(id: string): Observable<Promotion> { return this.http.patch<Promotion>(`${this.API}/promotions/${id}/restore`, {}); }

  // --- Results & History ---
  getResults(deleted = false): Observable<Resultat[]> { return this.http.get<Resultat[]>(`${this.API}/resultats?deleted=${deleted}`); }
  getHistory(deleted = false): Observable<HistoryEntry[]> { return this.http.get<HistoryEntry[]>(`${this.API}/historique?deleted=${deleted}`); }

  // --- Categories ---
  getCategories(deleted: boolean | null = null): Observable<Categorie[]> { 
    const url = deleted === null ? `${this.API}/categories` : `${this.API}/categories?deleted=${deleted}`;
    return this.http.get<Categorie[]>(url); 
  }
  createCategorie(req: any): Observable<Categorie> { return this.http.post<Categorie>(`${this.API}/categories`, req); }
  createCategorieBulk(libelles: string[]): Observable<Categorie[]> { return this.http.post<Categorie[]>(`${this.API}/categories/bulk`, libelles); }
  updateCategorie(id: string, req: any): Observable<Categorie> { return this.http.put<Categorie>(`${this.API}/categories/${id}`, req); }
  deleteCategorie(id: string): Observable<void> { return this.http.delete<void>(`${this.API}/categories/${id}`); }
  restoreCategorie(id: string): Observable<Categorie> { return this.http.patch<Categorie>(`${this.API}/categories/${id}/restore`, {}); }

  // --- Fonctions ---
  getFonctions(deleted: boolean | null = null): Observable<Fonction[]> { 
    const url = deleted === null ? `${this.API}/fonctions` : `${this.API}/fonctions?deleted=${deleted}`;
    return this.http.get<Fonction[]>(url); 
  }
  createFonction(req: any): Observable<Fonction> { return this.http.post<Fonction>(`${this.API}/fonctions`, req); }
  createFonctionBulk(libelles: string[]): Observable<Fonction[]> { return this.http.post<Fonction[]>(`${this.API}/fonctions/bulk`, libelles); }
  updateFonction(id: string, req: any): Observable<Fonction> { return this.http.put<Fonction>(`${this.API}/fonctions/${id}`, req); }
  deleteFonction(id: string): Observable<void> { return this.http.delete<void>(`${this.API}/fonctions/${id}`); }
  restoreFonction(id: string): Observable<Fonction> { return this.http.patch<Fonction>(`${this.API}/fonctions/${id}/restore`, {}); }

  // --- Produits ---
  getProduits(deleted: boolean | null = null): Observable<Produit[]> { 
    const url = deleted === null ? `${this.API}/produits` : `${this.API}/produits?deleted=${deleted}`;
    return this.http.get<Produit[]>(url); 
  }
  createProduit(req: any): Observable<Produit> { return this.http.post<Produit>(`${this.API}/produits`, req); }
  updateProduit(id: string, req: any): Observable<Produit> { return this.http.put<Produit>(`${this.API}/produits/${id}`, req); }
  deleteProduit(id: string): Observable<void> { return this.http.delete<void>(`${this.API}/produits/${id}`); }
  restoreProduit(id: string): Observable<Produit> { return this.http.patch<Produit>(`${this.API}/produits/${id}/restore`, {}); }
  getProduitsFront(): Observable<Produit[]> { return this.http.get<Produit[]>(`${this.API}/produits/front`); }

  // --- Contacts ---
  getContacts(deleted = false): Observable<Contact[]> { return this.http.get<Contact[]>(`${this.API}/contacts?deleted=${deleted}`); }
  createContact(req: any): Observable<Contact> { return this.http.post<Contact>(`${this.API}/contacts`, req); }
  deleteContact(id: string): Observable<void> { return this.http.delete<void>(`${this.API}/contacts/${id}`); }
  restoreContact(id: string): Observable<Contact> { return this.http.patch<Contact>(`${this.API}/contacts/${id}/restore`, {}); }
  markContactHandled(id: string): Observable<Contact> { return this.http.patch<Contact>(`${this.API}/contacts/${id}/handle`, {}); }
  replyToContact(id: string, reply: { sujet: string, message: string }): Observable<Contact> {
    return this.http.post<Contact>(`${this.API}/contacts/${id}/reply`, reply);
  }

  // --- CRM ---
  getClientPubs(deleted = false): Observable<ClientPub[]> { return this.http.get<ClientPub[]>(`${this.API}/clients-pub?deleted=${deleted}`); }
  createClientPub(req: any): Observable<ClientPub> { return this.http.post<ClientPub>(`${this.API}/clients-pub`, req); }
  updateClientPub(id: string, req: any): Observable<ClientPub> { return this.http.put<ClientPub>(`${this.API}/clients-pub/${id}`, req); }
  deleteClientPub(id: string): Observable<void> { return this.http.delete<void>(`${this.API}/clients-pub/${id}`); }
  restoreClientPub(id: string): Observable<ClientPub> { return this.http.patch<ClientPub>(`${this.API}/clients-pub/${id}/restore`, {}); }

  // --- Upload ---
  uploadPubImages(files: File[]): Observable<string[]> {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    return this.http.post<string[]>(`${this.API}/upload/pub-images`, fd);
  }

  // --- Social Links ---
  getSocialLinks(): Observable<SocialLink[]> { return this.http.get<SocialLink[]>(`${this.API}/social-links`); }
  getSocialLinksByOwnerType(type: 'US' | 'CLIENT'): Observable<SocialLink[]> { return this.http.get<SocialLink[]>(`${this.API}/social-links/by-owner?type=${type}`); }
  createSocialLink(req: any): Observable<SocialLink> { return this.http.post<SocialLink>(`${this.API}/social-links`, req); }
  updateSocialLink(id: string, req: any): Observable<SocialLink> { return this.http.put<SocialLink>(`${this.API}/social-links/${id}`, req); }
  toggleSocialLink(id: string): Observable<SocialLink> { return this.http.patch<SocialLink>(`${this.API}/social-links/${id}/toggle`, {}); }
  deleteSocialLink(id: string): Observable<void> { return this.http.delete<void>(`${this.API}/social-links/${id}`); }

  // --- Business ---
  getVentes(): Observable<Vente[]> { return this.http.get<Vente[]>(`${this.API}/ventes`); }
}
