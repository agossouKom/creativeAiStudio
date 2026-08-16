import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';

export interface AuthUser {
  email:    string;
  fullName: string;
  role:     string;
  credits:  number;
  token:    string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = 'http://localhost:8480/api/auth';
  private readonly KEY = 'ms_auth';

  /** Signal réactif — partagé dans toute l'app */
  currentUser = signal<AuthUser | null>(this.loadFromStorage());

  constructor(private http: HttpClient, private router: Router) {}

  register(fullName: string, email: string, password: string) {
    return this.http.post<AuthUser>(`${this.API}/register`, { fullName, email, password, confirmPassword: password })
      .pipe(tap(user => this.saveSession(user)));
  }

  login(email: string, password: string) {
    return this.http.post<any>(`${this.API}/login`, { email, password })
      .pipe(tap(res => this.handleAuthResponse(res)));
  }

  sendOtp(email: string) {
    return this.http.post<any>(`${this.API}/otp/send?email=${email}`, {});
  }

  loginWithOtp(email: string, password: string, otpCode: string) {
    return this.http.post<any>(`${this.API}/otp/login`, { email, password, otpCode })
      .pipe(tap(res => this.handleAuthResponse(res)));
  }

  verifyRegistration(email: string, code: string) {
    return this.http.post<any>(`${this.API}/register/verify?email=${email}&code=${code}`, {})
      .pipe(tap(res => this.handleAuthResponse(res)));
  }

  loginWithGoogle(token: string) {
    return this.http.post<any>(`${this.API}/google`, { token })
      .pipe(tap(res => this.handleAuthResponse(res)));
  }

  private handleAuthResponse(res: any) {
    const user: AuthUser = {
      email:    res.email,
      fullName: res.fullName,
      role:     res.role,
      credits:  res.credits,
      token:    res.accessToken,
    };
    this.saveSession(user);
  }

  logout(redirectUrl: string = '/auth') {
    localStorage.removeItem(this.KEY);
    this.currentUser.set(null);
    this.router.navigate([redirectUrl]);
  }

  getToken(): string | null {
    return this.currentUser()?.token ?? null;
  }

  isLoggedIn(): boolean {
    return !!this.currentUser();
  }

  private saveSession(user: AuthUser) {
    localStorage.setItem(this.KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private loadFromStorage(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const user = JSON.parse(raw) as AuthUser;
      // Session invalide si le token est absent (ex : loginné avant le fix cleanResponse)
      if (!user?.token) { localStorage.removeItem(this.KEY); return null; }
      return user;
    } catch { return null; }
  }
}
