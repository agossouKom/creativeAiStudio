import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'Gratuit' | 'Premium' | 'Admin' | 'SuperAdmin';
  online: boolean;
  avatar?: string;
  hasAds: boolean;
}

export interface Feature {
  id: string;
  label: string;
  description: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  period: 'mensuel' | 'annuel';
  features: { [featureId: string]: boolean };
  active: boolean;
}

export interface Message {
  id: number;
  subject: string;
  sender: string;
  email: string;
  date: string;
  content: string;
  read: boolean;
  reply?: string;
}

export interface Advertisement {
  id: number;
  imageUrl: string;
  startDate: string;
  endDate: string;
  active: boolean;
  price: number;
  pageCount: number;
  targetUrl: string;
}

@Injectable({ providedIn: 'root' })
export class MockDataService {
  
  // --- Features Definition ---
  private readonly COMMON_FEATURES: Feature[] = [
    { id: 'audio', label: 'Analyse Audio', description: 'Identification d\'empreintes sonores' },
    { id: 'video', label: 'Analyse Vidéo 4K', description: 'Reconnaissance de scènes en haute définition' },
    { id: 'face', label: 'Reconnaissance Faciale', description: 'Matching biométrique' },
    { id: 'history', label: 'Historique Illimité', description: 'Conservation des analyses' },
    { id: 'api', label: 'Accès API Docs', description: 'Intégration développeur' },
    { id: 'support', label: 'Support 24/7', description: 'Assistance prioritaire' },
  ];

  // --- Users ---
  private _users = new BehaviorSubject<User[]>([
    { id: 1, name: 'Alice Dupont',  email: 'alice@example.com', role: 'Premium',    online: true,  avatar: 'A', hasAds: false },
    { id: 2, name: 'Bob Martin',    email: 'bob@example.com',   role: 'Gratuit',     online: true,  avatar: 'B', hasAds: true },
    { id: 3, name: 'Charlie Smith', email: 'charlie@test.com',  role: 'Admin',       online: false, avatar: 'C', hasAds: false },
    { id: 4, name: 'Damien Admin',  email: 'admin@mediacore.com', role: 'SuperAdmin', online: true,  avatar: 'D', hasAds: false },
  ]);

  // --- Plans ---
  private _plans = new BehaviorSubject<PricingPlan[]>([
    { 
      id: 'free', name: 'Plan Gratuit', price: 0, period: 'mensuel', active: true,
      features: { audio: true, video: false, face: false, history: false, api: false, support: false }
    },
    { 
      id: 'premium', name: 'Plan Premium', price: 19, period: 'mensuel', active: true,
      features: { audio: true, video: true, face: true, history: true, api: true, support: true }
    }
  ]);

  // --- Ads ---
  private _ads = new BehaviorSubject<Advertisement[]>([
    { 
      id: 1, imageUrl: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=800&auto=format&fit=crop', 
      startDate: '2026-05-01', endDate: '2026-06-01', active: true, price: 50, pageCount: 10, targetUrl: '#' 
    }
  ]);

  // --- Messages ---
  private _messages = new BehaviorSubject<Message[]>([
    { id: 1, subject: 'Support', sender: 'Jean Michel',   email: 'jean@michel.com', date: "Aujourd'hui", content: "Problème de connexion avec l'API Audio.", read: false },
    { id: 2, subject: 'Démo',    sender: 'Entreprise XYZ', email: 'hr@xyz.corp',    date: 'Hier',       content: 'Nous aimerions une démonstration pour notre équipe.', read: true },
  ]);

  // Observables
  users$ = this._users.asObservable();
  plans$ = this._plans.asObservable();
  ads$ = this._ads.asObservable();
  messages$ = this._messages.asObservable();

  getFeatures() { return this.COMMON_FEATURES; }

  // --- User CUD ---
  addUser(u: User) { this._users.next([...this._users.value, { ...u, id: Date.now() }]); }
  updateUser(u: User) { this._users.next(this._users.value.map(user => user.id === u.id ? u : user)); }
  deleteUser(id: number) { this._users.next(this._users.value.filter(u => u.id !== id)); }
  toggleUserStatus(userId: number) {
    this._users.next(this._users.value.map(u => u.id === userId ? { ...u, online: !u.online } : u));
  }

  // --- Plans CRUD ---
  updatePlan(p: PricingPlan) { this._plans.next(this._plans.value.map(plan => plan.id === p.id ? p : plan)); }

  // --- Ads CRUD ---
  addAd(ad: Advertisement) { this._ads.next([...this._ads.value, { ...ad, id: Date.now() }]); }
  updateAd(ad: Advertisement) { this._ads.next(this._ads.value.map(a => a.id === ad.id ? ad : a)); }
  deleteAd(id: number) { this._ads.next(this._ads.value.filter(a => a.id !== id)); }

  // --- Messages CRUD ---
  addMessage(msg: Partial<Message>) {
    const newMessage: Message = {
      id: Date.now(), subject: msg.subject || 'Support', sender: msg.sender || 'Anonyme',
      email: msg.email || '', date: "À l'instant", content: msg.content || '', read: false
    };
    this._messages.next([newMessage, ...this._messages.value]);
  }
  replyToMessage(id: number, text: string) {
    this._messages.next(this._messages.value.map(m => m.id === id ? { ...m, reply: text, read: true } : m));
  }
  deleteMessage(id: number) { this._messages.next(this._messages.value.filter(m => m.id !== id)); }
}
