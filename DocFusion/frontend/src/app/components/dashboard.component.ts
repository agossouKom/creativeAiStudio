import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <div class="sidebar">
        <div class="sidebar-item active">My Documents</div>
        <div class="sidebar-item">Recent Tasks</div>
        <div class="sidebar-item">Settings</div>
      </div>
      
      <div class="content">
        <header>
          <h1>My Documents</h1>
          <button class="btn-primary" (click)="fileInput.click()">+ Upload New</button>
          <input #fileInput type="file" (change)="onFileSelected($event)" style="display: none">
        </header>

        <div class="notification-banner premium-card" *ngIf="lastResult">
          <div class="icon">✨</div>
          <div class="text">
            <strong>OCR Finished!</strong>
            <p>{{ lastResult.fileName }} has been processed.</p>
          </div>
          <button class="btn-primary-sm" (click)="lastResult = null">Dismiss</button>
        </div>

        <div class="upload-zone" [class.uploading]="isUploading">
          <div *ngIf="!isUploading; else loading" (click)="fileInput.click()">
            <div class="icon">📁</div>
            <p>Drag and drop files here or click to browse</p>
            <span>PDF, DOCX, XLSX up to 50MB</span>
          </div>
          <ng-template #loading>
            <div class="loader"></div>
            <p>Uploading and processing your document...</p>
          </ng-template>
        </div>

        <div class="recent-files">
          <h3>Recent Files</h3>
          <div class="file-list">
            <div class="file-item premium-card" *ngFor="let file of files">
              <div class="file-icon">📄</div>
              <div class="file-info">
                <span class="file-name">{{ file.name }}</span>
                <span class="file-meta">{{ file.date }} • {{ file.size }}</span>
              </div>
              <div class="file-actions">
                <button class="btn-icon">⚡</button>
                <button class="btn-icon">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      height: 100vh;
      background: #0f172a;
      padding-top: 80px; /* Space for navbar */
    }
    .sidebar {
      width: 280px;
      background: rgba(255, 255, 255, 0.02);
      border-right: 1px solid rgba(255, 255, 255, 0.05);
      padding: 2rem 1rem;
    }
    .sidebar-item {
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      color: #94a3b8;
      cursor: pointer;
      margin-bottom: 0.5rem;
      transition: all 0.3s ease;
    }
    .sidebar-item.active, .sidebar-item:hover {
      background: rgba(99, 102, 241, 0.1);
      color: #6366f1;
    }
    .content {
      flex: 1;
      padding: 2rem 4rem;
      overflow-y: auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: 800;
    }
    .upload-zone {
      border: 2px dashed rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 4rem;
      text-align: center;
      background: rgba(255, 255, 255, 0.01);
      cursor: pointer;
      transition: all 0.3s ease;
      margin-bottom: 3rem;
    }
    .upload-zone:hover {
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.03);
    }
    .upload-zone.uploading {
      pointer-events: none;
      opacity: 0.7;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    .upload-zone p { font-weight: 600; margin-bottom: 0.5rem; }
    .upload-zone span { color: #94a3b8; font-size: 0.875rem; }
    
    .file-item {
      display: flex;
      align-items: center;
      padding: 1rem 1.5rem;
      margin-bottom: 1rem;
      gap: 1.5rem;
    }
    .file-icon { font-size: 1.5rem; }
    .file-info { flex: 1; display: flex; flex-direction: column; }
    .file-name { font-weight: 600; margin-bottom: 0.25rem; }
    .file-meta { font-size: 0.75rem; color: #94a3b8; }
    .file-actions { display: flex; gap: 0.5rem; }
    .btn-icon {
      background: rgba(255, 255, 255, 0.05);
      border: none;
      color: white;
      padding: 0.5rem;
      border-radius: 8px;
      cursor: pointer;
    }
    .btn-icon:hover { background: rgba(99, 102, 241, 0.2); }
    
    .loader {
      width: 48px;
      height: 48px;
      border: 5px solid #FFF;
      border-bottom-color: #6366f1;
      border-radius: 50%;
      display: inline-block;
      box-sizing: border-box;
      animation: rotation 1s linear infinite;
      margin-bottom: 1rem;
    }
    @keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn-primary-sm {
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
    }
    .notification-banner {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 1rem 2rem;
      margin-bottom: 2rem;
      border-left: 4px solid #6366f1;
      animation: slideDown 0.5s ease;
    }
    .notification-banner .text { flex: 1; }
    .notification-banner p { margin: 0; color: #94a3b8; font-size: 0.875rem; }
    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  isUploading = false;
  lastResult: any = null;
  files = [
    { name: 'Financial_Report_Q1.pdf', date: '2 hours ago', size: '1.2 MB', status: 'READY' },
    { name: 'Invoice_7748.docx', date: 'Yesterday', size: '450 KB', status: 'READY' }
  ];

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.notificationService.results$.subscribe(result => {
      this.lastResult = result;
      // Update file status in list
      const file = this.files.find(f => f.name === result.fileName);
      if (file) file.status = result.status;
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.uploadFile(file);
    }
  }

  uploadFile(file: File) {
    this.isUploading = true;
    const formData = new FormData();
    formData.append('file', file);

    this.http.post('http://localhost:8080/api/v1/documents/upload', formData, { withCredentials: true })
      .subscribe({
        next: (res: any) => {
          this.files.unshift({
            name: file.name,
            date: 'Just now',
            size: this.formatBytes(file.size),
            status: 'UPLOADING'
          });
          this.isUploading = false;
        },
        error: (err) => {
          console.error('Upload failed', err);
          this.isUploading = false;
        }
      });
  }

  formatBytes(bytes: number, decimals = 2) {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
