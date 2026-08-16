import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SearchService {
  /** Passe par l'API Gateway Java sur le port 8480 */
  private readonly GATEWAY = 'http://localhost:8480/api/search';

  constructor(private http: HttpClient, private auth: AuthService) {}

  private getHeaders() {
    const user = this.auth.currentUser();
    return new HttpHeaders({
      'X-User-Name': user?.email || 'anonymous@creativeaistudio.ai'
    });
  }

  searchAudio(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post(`${this.GATEWAY}/audio`, fd, { headers: this.getHeaders() });
  }

  searchVideo(file: File): Observable<any> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post(`${this.GATEWAY}/video`, fd, { headers: this.getHeaders() });
  }

  searchPerson(image?: File, query?: string, phone?: string): Observable<any> {
    const fd = new FormData();
    if (image) fd.append('image', image);
    if (query) fd.append('query', query);
    if (phone) fd.append('phone', phone);
    return this.http.post(`${this.GATEWAY}/person`, fd, { headers: this.getHeaders() });
  }

  /** Vérifie le statut d'un job asynchrone */
  getJobStatus(jobId: string): Observable<any> {
    return this.http.get(`${this.GATEWAY}/status/${jobId}`);
  }

  /** Récupère l'historique complet des recherches de l'utilisateur */
  getSearchHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.GATEWAY}/history`, { headers: this.getHeaders() });
  }
}
