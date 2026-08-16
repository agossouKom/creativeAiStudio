import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private socket: WebSocket | null = null;
  private resultsSubject = new Subject<any>();

  public results$ = this.resultsSubject.asObservable();

  constructor() {
    this.connect();
  }

  private connect() {
    // Note: In a real app with STOMP, you'd use Stomp.over(new SockJS(...))
    // This is a simplified WebSocket connection for demonstration
    this.socket = new WebSocket('ws://localhost:8080/ws');

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.resultsSubject.next(data);
    };

    this.socket.onclose = () => {
      setTimeout(() => this.connect(), 5000); // Reconnect
    };
  }
}
