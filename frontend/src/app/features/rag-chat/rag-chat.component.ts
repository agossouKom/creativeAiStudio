import { Component, ChangeDetectorRef, ElementRef, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DialogService } from '../../shared/ui/dialog.service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: string[];
  streaming?: boolean;
}

interface IngestResult {
  filename: string;
  chunksCreated: number;
  status: string;
  detail: string;
}

interface IndexedDoc {
  filename: string;
  chunks: number;
  deleting?: boolean;
}

@Component({
  selector: 'app-rag-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="rag-page">
  <div class="bg-orb orb1"></div>
  <div class="bg-orb orb2"></div>

  <div class="rag-layout">

    <!-- ── LEFT SIDEBAR: Knowledge Base ───────────────────────────────────── -->
    <aside class="rag-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        <div>
          <h2 class="sidebar-title">Base de connaissances</h2>
          <p class="sidebar-sub">Indexez vos documents</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-card">
        <div class="stats-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div class="stats-info">
          <span class="stats-count">{{ docCount }}</span>
          <span class="stats-label">chunk(s) indexé(s)</span>
        </div>
        <button class="stats-refresh" (click)="refreshCount()" title="Actualiser">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      <!-- Drop zone -->
      <div class="drop-zone"
           [class.over]="dragging"
           [class.uploading]="uploading"
           (dragover)="onDragOver($event)"
           (dragleave)="dragging = false"
           (drop)="onDrop($event)"
           (click)="!uploading && fileInput.click()">
        <input #fileInput type="file" class="hidden"
               multiple
               accept=".pdf,.docx,.doc,.txt,.html,.md,.odt,.pptx,.xlsx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.mp4,.mov,.avi,.mkv,.webm,.m4v"
               (change)="onFileSelect($event)">

        <div class="dz-inner" *ngIf="!uploading">
          <div class="dz-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <p class="dz-title">Glissez vos fichiers ici</p>
          <p class="dz-sub">PDF, DOCX, TXT · Images 🖼️ · Vidéos 🎬 — Analyse IA vision</p>
          <span class="dz-btn">Choisir des fichiers</span>
        </div>

        <div class="dz-uploading" *ngIf="uploading">
          <div class="upload-spinner"></div>
          <p class="upload-label">{{ uploadStatus }}</p>
          <div class="upload-progress-bar">
            <div class="upload-progress-fill" [style.width.%]="uploadProgress"></div>
          </div>
        </div>
      </div>

      <!-- Documents indexés avec suppression individuelle -->
      <div class="indexed-docs" *ngIf="indexedDocs.length > 0">
        <h4 class="log-title">Documents indexés</h4>
        <div class="doc-list">
          <div *ngFor="let doc of indexedDocs" class="doc-item">
            <span class="doc-icon">{{ getDocIcon(doc.filename) }}</span>
            <div class="doc-info">
              <span class="doc-name" [title]="doc.filename">{{ doc.filename | slice:0:22 }}{{ doc.filename.length > 22 ? '…' : '' }}</span>
              <span class="doc-chunks">{{ doc.chunks }} chunk{{ doc.chunks > 1 ? 's' : '' }}</span>
            </div>
            <button class="doc-del" (click)="deleteDocument(doc)" [disabled]="doc.deleting" title="Supprimer ce document">
              <svg *ngIf="!doc.deleting" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              <span *ngIf="doc.deleting" class="del-spin"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Log upload récent (erreurs/succès) -->
      <div class="ingestion-log" *ngIf="ingestResults.length > 0">
        <div class="log-list">
          <div *ngFor="let r of ingestResults.slice().reverse().slice(0, 3)"
               class="log-item" [class.log-success]="r.status === 'success'" [class.log-error]="r.status === 'error'">
            <span class="log-icon">{{ r.status === 'success' ? '✓' : '✗' }}</span>
            <span class="log-detail" [title]="r.detail">{{ r.status === 'error' ? (r.detail | slice:0:45) : (r.chunksCreated + ' chunks ajoutés') }}</span>
          </div>
        </div>
      </div>

      <!-- Clear all -->
      <div class="sidebar-footer">
        <button class="clear-btn"
                *ngIf="docCount > 0"
                (click)="confirmClear()"
                [disabled]="clearing">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
          {{ clearing ? 'Suppression…' : 'Vider la base' }}
        </button>

        <!-- Confirm overlay -->
        <div class="confirm-overlay" *ngIf="showClearConfirm">
          <p class="confirm-text">Supprimer tous les documents indexés ?</p>
          <div class="confirm-actions">
            <button class="confirm-yes" (click)="clearAll()">Oui, vider</button>
            <button class="confirm-no" (click)="showClearConfirm = false">Annuler</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- ── RIGHT: Chat Area ────────────────────────────────────────────────── -->
    <main class="rag-chat-area">

      <!-- Chat header -->
      <div class="chat-header">
        <div class="chat-header-left">
          <div class="ai-avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
              <circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>
            </svg>
          </div>
          <div>
            <h1 class="chat-title">Assistant IA — RAG</h1>
            <span class="chat-subtitle">Interrogez votre base de connaissances</span>
          </div>
        </div>
        <div class="model-badge">
          <span class="model-dot"></span>
          llama-3.3-70b
        </div>
        <button *ngIf="messages.length > 0" class="rag-clear-btn" (click)="clearHistory()" title="Effacer l'historique">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>

      <!-- Messages -->
      <div class="messages-wrap" #messagesContainer>

        <!-- Welcome screen -->
        <div class="welcome-screen" *ngIf="messages.length === 0">
          <div class="welcome-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h2 class="welcome-title">Posez une question sur vos documents</h2>
          <p class="welcome-sub">
            Importez d'abord vos documents dans la base de connaissances,<br>
            puis interrogez-les en langage naturel.
          </p>
          <div class="welcome-suggestions">
            <button *ngFor="let s of suggestions" class="suggestion-chip" (click)="sendSuggestion(s)">
              {{ s }}
            </button>
          </div>
        </div>

        <!-- Message list -->
        <div *ngFor="let msg of messages" class="message-row"
             [class.message-user]="msg.role === 'user'"
             [class.message-ai]="msg.role === 'assistant'">

          <!-- AI avatar -->
          <div class="msg-avatar msg-avatar-ai" *ngIf="msg.role === 'assistant'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
              <circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>
            </svg>
          </div>

          <!-- Bubble -->
          <div class="msg-bubble">
            <!-- Thinking indicator -->
            <div *ngIf="msg.role === 'assistant' && msg.streaming && msg.content === ''"
                 class="thinking-indicator">
              <span>En cours de réflexion</span>
              <span class="thinking-dots"><span></span><span></span><span></span></span>
            </div>

            <!-- Content -->
            <!-- Pendant le streaming : texte brut (évite le markdown partiel) -->
            <p class="msg-content msg-streaming" *ngIf="msg.content && msg.streaming">{{ msg.content }}<span class="cursor-blink">|</span></p>
            <!-- Rendu markdown final -->
            <div class="msg-content msg-markdown" *ngIf="msg.content && !msg.streaming" [innerHTML]="renderMarkdown(msg.content)"></div>

            <!-- Sources -->
            <div class="msg-sources" *ngIf="!msg.streaming && msg.sources && msg.sources.length > 0">
              <span class="sources-label">Sources :</span>
              <span *ngFor="let src of msg.sources" class="source-tag">{{ src }}</span>
            </div>

            <!-- Actions IA : copier -->
            <div class="msg-actions" *ngIf="msg.role === 'assistant' && !msg.streaming && msg.content">
              <button class="action-btn" (click)="copyMessage(msg)" [class.copied]="copiedId === msg.id" title="Copier la réponse">
                <svg *ngIf="copiedId !== msg.id" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <svg *ngIf="copiedId === msg.id" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {{ copiedId === msg.id ? 'Copié !' : 'Copier' }}
              </button>
            </div>
          </div>

          <!-- User avatar -->
          <div class="msg-avatar msg-avatar-user" *ngIf="msg.role === 'user'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        </div>

      </div>

      <!-- Input area -->
      <div class="input-area">
        <div class="input-wrap">
          <textarea
            class="chat-input"
            [(ngModel)]="userInput"
            (keydown.enter)="onEnter($event)"
            [disabled]="isStreaming"
            placeholder="Posez votre question sur vos documents…"
            rows="1"
            #inputRef></textarea>
          <!-- Bouton micro -->
          <button class="voice-btn" (click)="startVoice()" [class.voice-active]="isListening" [disabled]="isStreaming" title="Commande vocale (fr-FR)">
            <svg *ngIf="!isListening" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <div *ngIf="isListening" class="voice-pulse"></div>
          </button>
          <!-- Bouton envoyer -->
          <button class="send-btn" (click)="sendMessage()" [disabled]="!userInput.trim() || isStreaming">
            <svg *ngIf="!isStreaming" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            <div *ngIf="isStreaming" class="send-spinner"></div>
          </button>
        </div>
        <p class="input-hint">Entrée pour envoyer · Maj+Entrée pour nouvelle ligne · 🎤 Micro pour voix</p>
      </div>

    </main>
  </div>
</div>
  `,
  styles: [`
    :host { display: block; width: 100%; font-family: 'Inter', sans-serif; }
    .hidden { display: none !important; }

    /* ── Page layout ─────────────────────────────────────────────────────── */
    .rag-page {
      height: calc(100vh - 64px);
      background: #0b0f1a;
      position: relative;
      overflow: hidden;
      display: flex;
    }
    .bg-orb {
      position: absolute; border-radius: 50%;
      filter: blur(120px); pointer-events: none; z-index: 0;
    }
    .orb1 { width: 600px; height: 600px; top: -150px; right: -80px;  background: rgba(99,102,241,0.12); }
    .orb2 { width: 500px; height: 500px; bottom: -80px; left: -80px; background: rgba(16,185,129,0.08); }

    .rag-layout {
      display: flex;
      width: 100%;
      height: 100%;
      position: relative;
      z-index: 1;
    }

    /* ── LEFT SIDEBAR ────────────────────────────────────────────────────── */
    .rag-sidebar {
      width: 30%;
      min-width: 280px;
      max-width: 380px;
      height: 100%;
      background: rgba(15,23,42,0.95);
      border-right: 1px solid rgba(99,102,241,0.15);
      display: flex;
      flex-direction: column;
      gap: .75rem;
      padding: 1.25rem;
      backdrop-filter: blur(12px);
      overflow-y: auto;
      overflow-x: hidden;
      flex-shrink: 0;
    }
    .rag-sidebar::-webkit-scrollbar { width: 3px; }
    .rag-sidebar::-webkit-scrollbar-track { background: transparent; }
    .rag-sidebar::-webkit-scrollbar-thumb { background: rgba(99,102,241,.15); border-radius: 2px; }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: .75rem;
    }
    .sidebar-icon {
      width: 40px; height: 40px;
      background: linear-gradient(135deg, rgba(99,102,241,.25), rgba(16,185,129,.15));
      border: 1px solid rgba(99,102,241,.3);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: #818cf8; flex-shrink: 0;
    }
    .sidebar-title { font-size: .95rem; font-weight: 800; color: #e2e8f0; margin: 0; }
    .sidebar-sub   { font-size: .72rem; color: #64748b; margin: .15rem 0 0; }

    /* Stats card */
    .stats-card {
      display: flex;
      align-items: center;
      gap: .75rem;
      background: rgba(99,102,241,.08);
      border: 1px solid rgba(99,102,241,.2);
      border-radius: 10px;
      padding: .65rem .9rem;
    }
    .stats-icon { color: #818cf8; flex-shrink: 0; }
    .stats-info { flex: 1; display: flex; flex-direction: column; }
    .stats-count { font-size: 1.1rem; font-weight: 800; color: #a5b4fc; }
    .stats-label { font-size: .68rem; color: #64748b; }
    .stats-refresh {
      background: none; border: none; cursor: pointer;
      color: #475569; padding: .25rem; border-radius: 4px;
      display: flex; align-items: center;
    }
    .stats-refresh:hover { color: #818cf8; background: rgba(99,102,241,.1); }

    /* Drop zone */
    .drop-zone {
      border: 2px dashed rgba(99,102,241,.3);
      border-radius: 14px;
      padding: 1.5rem 1rem;
      text-align: center;
      cursor: pointer;
      transition: .2s;
      background: rgba(15,23,42,.5);
      min-height: 130px;
      display: flex; align-items: center; justify-content: center;
    }
    .drop-zone.over,
    .drop-zone:hover {
      border-color: #6366f1;
      background: rgba(99,102,241,.06);
    }
    .drop-zone.uploading {
      cursor: default;
      border-color: rgba(16,185,129,.4);
    }
    .dz-inner { display: flex; flex-direction: column; align-items: center; gap: .5rem; }
    .dz-icon  { color: #475569; }
    .dz-title { font-size: .82rem; font-weight: 700; color: #94a3b8; margin: 0; }
    .dz-sub   { font-size: .7rem; color: #475569; margin: 0; }
    .dz-btn {
      margin-top: .35rem;
      background: rgba(99,102,241,.15);
      border: 1px solid rgba(99,102,241,.3);
      color: #818cf8;
      font-size: .72rem; font-weight: 700;
      padding: .3rem .8rem; border-radius: 20px; cursor: pointer;
    }

    /* Upload progress */
    .dz-uploading { display: flex; flex-direction: column; align-items: center; gap: .6rem; width: 100%; }
    .upload-spinner {
      width: 28px; height: 28px;
      border: 3px solid rgba(16,185,129,.2);
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    .upload-label { font-size: .75rem; color: #6ee7b7; font-weight: 600; }
    .upload-progress-bar {
      width: 100%; height: 4px;
      background: rgba(255,255,255,.1);
      border-radius: 20px; overflow: hidden;
    }
    .upload-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #34d399);
      border-radius: 20px;
      transition: width .3s ease;
    }

    /* Ingestion log */
    .ingestion-log { flex: 1; min-height: 0; overflow-y: auto; }
    .log-title { font-size: .72rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .5px; margin: 0 0 .5rem; }
    .log-list { display: flex; flex-direction: column; gap: .35rem; }
    .log-item {
      display: flex; align-items: flex-start; gap: .5rem;
      background: rgba(255,255,255,.03);
      border-radius: 8px; padding: .45rem .6rem;
      border-left: 3px solid transparent;
    }
    .log-item.log-success { border-left-color: #10b981; }
    .log-item.log-error   { border-left-color: #ef4444; }
    .log-icon { font-size: .75rem; font-weight: 800; flex-shrink: 0; margin-top: .1rem; }
    .log-item.log-success .log-icon { color: #10b981; }
    .log-item.log-error   .log-icon { color: #ef4444; }
    .log-text { display: flex; flex-direction: column; min-width: 0; }
    .log-name   { font-size: .72rem; font-weight: 600; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .log-detail { font-size: .65rem; color: #475569; }

    /* Sidebar footer */
    .sidebar-footer { margin-top: auto; position: relative; }
    .clear-btn {
      width: 100%;
      display: flex; align-items: center; justify-content: center; gap: .5rem;
      background: rgba(239,68,68,.08);
      border: 1px solid rgba(239,68,68,.2);
      color: #f87171;
      font-size: .75rem; font-weight: 700;
      padding: .5rem; border-radius: 8px; cursor: pointer;
      transition: .15s;
    }
    .clear-btn:hover:not(:disabled) { background: rgba(239,68,68,.15); border-color: rgba(239,68,68,.4); }
    .clear-btn:disabled { opacity: .5; cursor: not-allowed; }

    .confirm-overlay {
      position: absolute; bottom: 110%; left: 0; right: 0;
      background: #1e293b;
      border: 1px solid rgba(239,68,68,.3);
      border-radius: 10px;
      padding: .75rem;
      animation: fadeIn .18s ease;
    }
    .confirm-text { font-size: .78rem; color: #f1f5f9; margin: 0 0 .6rem; text-align: center; }
    .confirm-actions { display: flex; gap: .5rem; }
    .confirm-yes {
      flex: 1; background: #dc2626; color: #fff;
      border: none; border-radius: 7px; padding: .4rem;
      font-size: .72rem; font-weight: 700; cursor: pointer;
    }
    .confirm-yes:hover { background: #b91c1c; }
    .confirm-no {
      flex: 1; background: rgba(255,255,255,.06); color: #94a3b8;
      border: 1px solid rgba(255,255,255,.1); border-radius: 7px; padding: .4rem;
      font-size: .72rem; font-weight: 700; cursor: pointer;
    }
    .confirm-no:hover { background: rgba(255,255,255,.1); }

    /* ── RIGHT CHAT AREA ─────────────────────────────────────────────────── */
    .rag-chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      height: 100%;
      overflow: hidden;
      background: rgba(11,15,26,.85);
    }

    /* Chat header */
    .chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(255,255,255,.06);
      background: rgba(15,23,42,.9);
      backdrop-filter: blur(8px);
    }
    .chat-header-left { display: flex; align-items: center; gap: .75rem; }
    .ai-avatar {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, #4f46e5, #0ea5e9);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; flex-shrink: 0;
    }
    .chat-title    { font-size: 1rem; font-weight: 800; color: #e2e8f0; margin: 0; }
    .chat-subtitle { font-size: .72rem; color: #64748b; display: block; margin-top: .1rem; }

    .model-badge {
      display: flex; align-items: center; gap: .4rem;
      background: rgba(99,102,241,.12);
      border: 1px solid rgba(99,102,241,.25);
      color: #a5b4fc;
      font-size: .7rem; font-weight: 700;
      padding: .3rem .7rem; border-radius: 20px;
    }
    .model-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #10b981;
      animation: pulse 2s ease infinite;
    }
    .rag-clear-btn {
      background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.2);
      border-radius: 8px; color: #f87171; cursor: pointer;
      display: flex; align-items: center; padding: .35rem .5rem; transition: .15s;
    }
    .rag-clear-btn:hover { background: rgba(239,68,68,.18); }

    /* Messages */
    .messages-wrap {
      flex: 1;
      min-height: 0;       /* critique pour flex + overflow */
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      scroll-behavior: smooth;
    }
    .messages-wrap::-webkit-scrollbar { width: 4px; }
    .messages-wrap::-webkit-scrollbar-track { background: transparent; }
    .messages-wrap::-webkit-scrollbar-thumb { background: rgba(99,102,241,.2); border-radius: 2px; }

    /* Welcome */
    .welcome-screen {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 3rem 1rem;
      gap: 1rem;
    }
    .welcome-icon {
      width: 80px; height: 80px;
      background: rgba(99,102,241,.1);
      border: 1px solid rgba(99,102,241,.2);
      border-radius: 20px;
      display: flex; align-items: center; justify-content: center;
      color: #6366f1;
    }
    .welcome-title { font-size: 1.2rem; font-weight: 800; color: #e2e8f0; margin: 0; }
    .welcome-sub   { font-size: .85rem; color: #475569; line-height: 1.7; margin: 0; }
    .welcome-suggestions {
      display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center;
      margin-top: .5rem;
    }
    .suggestion-chip {
      background: rgba(99,102,241,.1);
      border: 1px solid rgba(99,102,241,.25);
      color: #a5b4fc;
      font-size: .75rem; font-weight: 600;
      padding: .4rem .9rem; border-radius: 20px; cursor: pointer;
      transition: .15s;
    }
    .suggestion-chip:hover {
      background: rgba(99,102,241,.2);
      border-color: rgba(99,102,241,.5);
    }

    /* Message rows */
    .message-row {
      display: flex;
      align-items: flex-end;
      gap: .6rem;
      animation: fadeIn .25s ease;
    }
    .message-user { flex-direction: row-reverse; }

    .msg-avatar {
      width: 28px; height: 28px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: .75rem;
    }
    .msg-avatar-ai {
      background: linear-gradient(135deg, #4f46e5, #0ea5e9);
      color: #fff;
    }
    .msg-avatar-user {
      background: linear-gradient(135deg, #059669, #10b981);
      color: #fff;
    }

    /* Bubbles */
    .msg-bubble {
      max-width: 75%;
      padding: .8rem 1rem;
      border-radius: 14px;
      line-height: 1.65;
    }
    .message-user .msg-bubble {
      background: linear-gradient(135deg, #4338ca, #3b82f6);
      color: #f0f4ff;
      border-bottom-right-radius: 4px;
    }
    .message-ai .msg-bubble {
      background: linear-gradient(135deg, rgba(30,41,59,.95), rgba(15,23,42,.95));
      border: 1px solid rgba(99,102,241,.15);
      color: #e2e8f0;
      border-bottom-left-radius: 4px;
    }

    .msg-content { margin:0; font-size:.875rem; word-break:break-word; }
    .msg-streaming { white-space:pre-wrap; }

    /* ── Markdown rendu ──────────────────────────────────────────── */
    .msg-markdown { line-height:1.7; }
    .msg-markdown .md-h1 { font-size:1.2rem; font-weight:800; color:#e2e8f0; margin:.9rem 0 .4rem; border-bottom:1px solid rgba(99,102,241,.25); padding-bottom:.3rem; }
    .msg-markdown .md-h2 { font-size:1.05rem; font-weight:700; color:#c7d2fe; margin:.75rem 0 .35rem; }
    .msg-markdown .md-h3 { font-size:.95rem; font-weight:700; color:#a5b4fc; margin:.6rem 0 .3rem; }
    .msg-markdown .md-h4 { font-size:.88rem; font-weight:600; color:#818cf8; margin:.5rem 0 .25rem; }
    .msg-markdown strong { color:#e2e8f0; font-weight:700; }
    .msg-markdown em { color:#cbd5e1; font-style:italic; }
    .msg-markdown .md-hr { border:none; border-top:1px solid rgba(99,102,241,.2); margin:.75rem 0; }
    .msg-markdown .md-ul,.msg-markdown .md-ol { margin:.4rem 0 .4rem 1.2rem; padding:0; display:flex; flex-direction:column; gap:.2rem; }
    .msg-markdown .md-ul { list-style:disc; }
    .msg-markdown .md-ol { list-style:decimal; }
    .msg-markdown li { color:#cbd5e1; font-size:.865rem; line-height:1.6; }
    .msg-markdown .md-pre { background:rgba(0,0,0,.4); border:1px solid rgba(99,102,241,.2); border-radius:8px; padding:.75rem 1rem; margin:.5rem 0; overflow-x:auto; }
    .msg-markdown .md-code { font-family:'Fira Code','Cascadia Code','Consolas',monospace; font-size:.8rem; color:#a5f3fc; white-space:pre; }
    .msg-markdown .md-code-inline { background:rgba(99,102,241,.15); color:#c4b5fd; font-family:monospace; font-size:.82rem; padding:.1rem .35rem; border-radius:4px; border:1px solid rgba(99,102,241,.2); }

    /* Messages utilisateur — fond bleu */
    .msg-bubble.user .msg-content { white-space:pre-wrap; }

    /* Thinking indicator */
    .thinking-indicator {
      display: flex;
      align-items: center;
      gap: .5rem;
      color: #64748b;
      font-size: .8rem;
      font-style: italic;
    }
    .thinking-dots {
      display: flex; gap: 3px;
    }
    .thinking-dots span {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: #6366f1;
      animation: bounce .9s ease infinite;
    }
    .thinking-dots span:nth-child(2) { animation-delay: .15s; }
    .thinking-dots span:nth-child(3) { animation-delay: .3s; }

    .cursor-blink {
      display: inline-block;
      width: 2px; margin-left: 1px;
      animation: blink .8s step-end infinite;
      color: #6366f1;
    }

    /* Sources */
    .msg-sources {
      display: flex; flex-wrap: wrap; align-items: center; gap: .35rem;
      margin-top: .6rem; padding-top: .5rem;
      border-top: 1px solid rgba(99,102,241,.15);
    }
    .sources-label { font-size: .65rem; color: #475569; font-weight: 700; text-transform: uppercase; }
    .source-tag {
      background: rgba(99,102,241,.12);
      border: 1px solid rgba(99,102,241,.2);
      color: #818cf8;
      font-size: .65rem; font-weight: 600;
      padding: .1rem .45rem; border-radius: 20px;
    }

    /* ── Input area ──────────────────────────────────────────────────────── */
    .input-area {
      padding: 1rem 1.5rem 1.25rem;
      border-top: 1px solid rgba(255,255,255,.06);
      background: rgba(15,23,42,.9);
    }
    .input-wrap {
      display: flex;
      align-items: flex-end;
      gap: .75rem;
      background: rgba(30,41,59,.8);
      border: 1px solid rgba(99,102,241,.2);
      border-radius: 14px;
      padding: .65rem .65rem .65rem 1rem;
      transition: .2s;
    }
    .input-wrap:focus-within {
      border-color: rgba(99,102,241,.5);
      box-shadow: 0 0 0 3px rgba(99,102,241,.08);
    }
    .chat-input {
      flex: 1;
      background: none; border: none; outline: none;
      color: #e2e8f0;
      font-size: .875rem;
      line-height: 1.5;
      resize: none;
      max-height: 120px;
      overflow-y: auto;
      font-family: inherit;
    }
    .chat-input::placeholder { color: #475569; }
    .chat-input:disabled { opacity: .5; }

    .send-btn {
      width: 38px; height: 38px; flex-shrink: 0;
      background: linear-gradient(135deg, #4f46e5, #3b82f6);
      border: none; border-radius: 10px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: #fff; transition: .15s;
    }
    .send-btn:hover:not(:disabled) { opacity: .9; transform: scale(1.05); }
    .send-btn:disabled { background: rgba(99,102,241,.25); cursor: not-allowed; transform: none; }
    .send-spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .6s linear infinite; }

    /* Bouton micro */
    .voice-btn {
      width: 36px; height: 36px; flex-shrink: 0;
      background: rgba(99,102,241,.1);
      border: 1px solid rgba(99,102,241,.2);
      border-radius: 9px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: #94a3b8; transition: .15s;
    }
    .voice-btn:hover:not(:disabled) { background: rgba(99,102,241,.2); color: #a5b4fc; }
    .voice-btn:disabled { opacity: .4; cursor: not-allowed; }
    .voice-btn.voice-active { background: rgba(239,68,68,.15); border-color: rgba(239,68,68,.4); color: #ef4444; }
    .voice-pulse {
      width: 14px; height: 14px; border-radius: 50%;
      background: #ef4444;
      animation: voicePulse .8s ease infinite;
    }
    @keyframes voicePulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:.6} }

    /* Bouton copier */
    .msg-actions { display:flex; gap:.5rem; margin-top:.4rem; padding-top:.4rem; border-top:1px solid rgba(255,255,255,.05); }
    .action-btn {
      display: flex; align-items: center; gap: .3rem;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08);
      color: #64748b; font-size: .68rem; font-weight: 600;
      padding: .25rem .6rem; border-radius: 6px; cursor: pointer; transition: .15s;
    }
    .action-btn:hover { background: rgba(99,102,241,.1); color: #a5b4fc; border-color: rgba(99,102,241,.2); }
    .action-btn.copied { color: #10b981; border-color: rgba(16,185,129,.3); background: rgba(16,185,129,.08); }

    /* Alerte sécurité upload */
    .security-alert { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); border-radius:8px; padding:.5rem .75rem; font-size:.73rem; color:#fca5a5; margin-top:.3rem; }

    .input-hint { font-size: .65rem; color: #334155; margin: .4rem 0 0; text-align: center; }

    /* ── Animations ──────────────────────────────────────────────────────── */
    @keyframes spin    { to { transform: rotate(360deg); } }
    @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.4} }
    @keyframes bounce  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
    @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

    /* ── Responsive ──────────────────────────────────────────────────────── */
    .img-warning { background:rgba(245,158,11,.12); border:1px solid rgba(245,158,11,.35); border-radius:8px; padding:.5rem .75rem; font-size:.75rem; color:#fbbf24; line-height:1.5; margin-bottom:.5rem; }
    .indexed-docs { margin-bottom:.75rem; }
    .doc-list { display:flex; flex-direction:column; gap:.3rem; }
    .doc-item { display:flex; align-items:center; gap:.5rem; padding:.4rem .6rem; background:rgba(255,255,255,.04); border-radius:8px; border:1px solid rgba(255,255,255,.06); }
    .doc-icon { font-size:1rem; flex-shrink:0; }
    .doc-info { flex:1; min-width:0; display:flex; flex-direction:column; }
    .doc-name { font-size:.72rem; font-weight:600; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .doc-chunks { font-size:.65rem; color:#64748b; }
    .doc-del { background:none; border:none; cursor:pointer; color:#475569; padding:.2rem; border-radius:4px; display:flex; align-items:center; flex-shrink:0; transition:.15s; }
    .doc-del:hover:not(:disabled) { background:rgba(239,68,68,.15); color:#ef4444; }
    .doc-del:disabled { opacity:.4; cursor:not-allowed; }
    .del-spin { display:inline-block; width:10px; height:10px; border:1.5px solid rgba(99,102,241,.3); border-top-color:#6366f1; border-radius:50%; animation:spin .6s linear infinite; }
    @keyframes spin { to{transform:rotate(360deg)} }

    @media (max-width: 768px) {
      .rag-layout { flex-direction: column; }
      .rag-sidebar { width: 100%; max-width: none; min-width: unset; border-right: none; border-bottom: 1px solid rgba(99,102,241,.15); max-height: 40vh; overflow-y: auto; }
      .rag-chat-area { min-height: 60vh; }
    }
  `]
})
export class RagChatComponent implements OnInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  messages: Message[] = [];
  userInput = '';
  isStreaming = false;

  // Sidebar state
  dragging = false;
  uploading = false;
  uploadStatus = '';
  uploadProgress = 0;
  ingestResults: IngestResult[] = [];
  docCount = 0;
  indexedDocs: IndexedDoc[] = [];
  imageWarning = false;

  // Clear confirmation
  showClearConfirm = false;
  clearing = false;

  private static readonly IMAGE_EXTS   = ['jpg','jpeg','png','gif','bmp','webp','tiff','heic','avif'];
  private static readonly VIDEO_EXTS   = ['mp4','mov','avi','mkv','webm','m4v','flv','wmv','3gp','ts'];
  private static readonly BLOCKED_EXTS = ['exe','dll','bat','cmd','sh','ps1','vbs','msi','reg','scr','com','pif','lnk','inf','js','ts','php','asp','jsp','py','rb'];
  private static readonly MAX_SIZE_MB  = 100;

  // Copy & voice state
  copiedId: string | null = null;
  isListening = false;
  private recognition: any = null;

  suggestions = [
    'Quels sont les points clés de ces documents ?',
    'Résume le contenu de ma base de connaissances',
    'Quelles procédures sont décrites ?',
    'Quelles sont les dates importantes mentionnées ?',
  ];

  constructor(private cdr: ChangeDetectorRef, private sanitizer: DomSanitizer, private dialog: DialogService) {}

  ngOnInit() {
    this.refreshCount();
    this.loadIndexedDocs();
    this.loadHistory();
  }

  // ── Copier ───────────────────────────────────────────────────────────────

  async copyMessage(msg: Message) {
    try {
      await navigator.clipboard.writeText(msg.content);
      this.copiedId = msg.id;
      setTimeout(() => { this.copiedId = null; this.cdr.detectChanges(); }, 2000);
      this.cdr.detectChanges();
    } catch { /* clipboard non disponible */ }
  }

  // ── Commande vocale ───────────────────────────────────────────────────────

  startVoice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { this.dialog.alert('Votre navigateur ne supporte pas la reconnaissance vocale.\nChrome ou Edge recommandé.', 'Commande vocale', 'warning'); return; }

    if (this.isListening) {
      this.recognition?.stop();
      this.isListening = false;
      this.cdr.detectChanges();
      return;
    }

    this.recognition = new SR();
    this.recognition.lang = 'fr-FR';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onresult = (e: any) => {
      this.userInput = e.results[0][0].transcript;
      this.isListening = false;
      this.cdr.detectChanges();
      setTimeout(() => this.sendMessage(), 150);
    };
    this.recognition.onerror = () => { this.isListening = false; this.cdr.detectChanges(); };
    this.recognition.onend   = () => { this.isListening = false; this.cdr.detectChanges(); };

    this.recognition.start();
    this.isListening = true;
    this.cdr.detectChanges();
  }

  // ── Sécurité fichiers ─────────────────────────────────────────────────────

  private validateFileSecurity(file: File): { safe: boolean; reason: string } {
    const name = file.name;
    const ext  = name.split('.').pop()?.toLowerCase() ?? '';
    const parts = name.toLowerCase().split('.');

    if (file.size > RagChatComponent.MAX_SIZE_MB * 1024 * 1024)
      return { safe: false, reason: `Trop volumineux (max ${RagChatComponent.MAX_SIZE_MB} Mo)` };

    if (RagChatComponent.BLOCKED_EXTS.includes(ext))
      return { safe: false, reason: `Extension .${ext} bloquée (risque sécurité)` };

    // Double extension (ex: rapport.pdf.exe)
    if (parts.length > 2 && RagChatComponent.BLOCKED_EXTS.includes(parts[parts.length - 1]))
      return { safe: false, reason: 'Double extension suspecte détectée' };

    if (name.includes('..') || /[/\\<>|:*?"{}]/.test(name))
      return { safe: false, reason: 'Nom de fichier invalide' };

    return { safe: true, reason: '' };
  }

  // ── Extraction frame vidéo (frontend → JPEG → vision LLM) ───────────────

  private async extractVideoFrame(file: File): Promise<File | null> {
    return new Promise(resolve => {
      const video = document.createElement('video');
      const url   = URL.createObjectURL(file);
      video.muted = true; video.preload = 'metadata';

      video.onloadedmetadata = () => {
        video.currentTime = Math.max(0.5, Math.min(video.duration * 0.1, 8));
      };
      video.onseeked = () => {
        const W = Math.min(video.videoWidth || 1280, 1280);
        const H = Math.round(W * (video.videoHeight || 720) / (video.videoWidth || 1));
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H || 720;
        canvas.getContext('2d')!.drawImage(video, 0, 0, W, H);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          if (!blob) { resolve(null); return; }
          // Nom explicite pour que le LLM vision sache c'est une frame de vidéo
          resolve(new File([blob], `[Vidéo] ${file.name} — frame.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.88);
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      video.src = url;
    });
  }

  /** Convertit le markdown LLM en HTML sanitisé pour affichage professionnel. */
  renderMarkdown(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    let h = text
      // Échapper le HTML pour la sécurité
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Blocs de code (avant tout le reste)
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, code) =>
        `<pre class="md-pre"><code class="md-code ${lang}">${code.trim()}</code></pre>`)
      // Code inline
      .replace(/`([^`\n]+)`/g, '<code class="md-code-inline">$1</code>')
      // Titres
      .replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
      .replace(/^### (.+)$/gm,  '<h3 class="md-h3">$1</h3>')
      .replace(/^## (.+)$/gm,   '<h2 class="md-h2">$1</h2>')
      .replace(/^# (.+)$/gm,    '<h1 class="md-h1">$1</h1>')
      // Gras + italique
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,         '<em>$1</em>')
      // Séparateur
      .replace(/^[-—]{3,}$/gm, '<hr class="md-hr">')
      // Listes à puces
      .replace(/^[ \t]*[-•*] (.+)$/gm, '<li>$1</li>')
      // Listes numérotées
      .replace(/^[ \t]*\d+\. (.+)$/gm, '<li class="li-num">$1</li>')
      // Grouper les <li> en <ul> ou <ol>
      .replace(/(<li>(?:(?!<\/li>)[\s\S])*<\/li>\n?)+/g, m =>
        m.includes('class="li-num"')
          ? `<ol class="md-ol">${m.replace(/ class="li-num"/g,'')}</ol>`
          : `<ul class="md-ul">${m}</ul>`)
      // Sauts de ligne (hors blocs déjà convertis)
      .replace(/\n(?!<)/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(h);
  }

  async loadIndexedDocs() {
    try {
      const res = await fetch('/api/rag/documents', { headers: this.ragHeaders() });
      if (res.ok) {
        const data: { filename: string; chunks: number }[] = await res.json();
        this.indexedDocs = data.map(d => ({ filename: d.filename, chunks: Number(d.chunks) }));
        this.cdr.detectChanges();
      }
    } catch { /* service peut ne pas être joignable */ }
  }

  async deleteDocument(doc: IndexedDoc) {
    doc.deleting = true;
    this.cdr.detectChanges();
    try {
      const res = await fetch(`/api/rag/documents?filename=${encodeURIComponent(doc.filename)}`, {
        method: 'DELETE',
        headers: this.ragHeaders(),
      });
      if (res.ok) {
        this.indexedDocs = this.indexedDocs.filter(d => d.filename !== doc.filename);
        await this.refreshCount();
      }
    } catch { doc.deleting = false; }
    this.cdr.detectChanges();
  }

  getDocIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf')                                              return '📄';
    if (['docx','doc'].includes(ext))                              return '📝';
    if (['xlsx','xls'].includes(ext))                              return '📊';
    if (['pptx','ppt'].includes(ext))                              return '📽️';
    if (['txt','md','csv'].includes(ext))                          return '📃';
    if (['html','htm'].includes(ext))                              return '🌐';
    if (RagChatComponent.IMAGE_EXTS.includes(ext))                 return '🖼️';
    if (RagChatComponent.VIDEO_EXTS.includes(ext) || filename.startsWith('[Vidéo]')) return '🎬';
    return '📁';
  }

  // ── File drag & drop ─────────────────────────────────────────────────────

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragging = true;
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragging = false;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length > 0) this.uploadFiles(files);
  }

  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length > 0) this.uploadFiles(files);
    input.value = '';
  }

  // ── Document ingestion ───────────────────────────────────────────────────

  async uploadFiles(files: File[]) {
    // 1. Vérification sécurité
    const blocked: string[] = [];
    const safe: File[] = [];
    for (const f of files) {
      const check = this.validateFileSecurity(f);
      if (!check.safe) {
        blocked.push(`🚫 ${f.name} — ${check.reason}`);
        this.ingestResults.push({ filename: f.name, chunksCreated: 0, status: 'error', detail: check.reason });
      } else {
        safe.push(f);
      }
    }
    if (blocked.length) this.cdr.detectChanges();
    if (!safe.length) return;

    // 2. Extraction frames vidéo (frontend → JPEG → vision LLM)
    const toUpload: File[] = [];
    for (const f of safe) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (RagChatComponent.VIDEO_EXTS.includes(ext)) {
        this.uploading = true;
        this.uploadStatus = `🎬 Extraction frame de ${f.name}…`;
        this.cdr.detectChanges();
        const frame = await this.extractVideoFrame(f);
        if (frame) toUpload.push(frame);
        else this.ingestResults.push({ filename: f.name, chunksCreated: 0, status: 'error', detail: 'Impossible d\'extraire une frame vidéo' });
      } else {
        toUpload.push(f);
      }
    }
    if (!toUpload.length) { this.cdr.detectChanges(); return; }

    // 3. Upload
    this.uploading = true;
    this.uploadProgress = 0;
    const hasVision = toUpload.some(f => {
      const e = f.name.split('.').pop()?.toLowerCase() ?? '';
      return RagChatComponent.IMAGE_EXTS.includes(e) || f.name.startsWith('[Vidéo]');
    });
    this.uploadStatus = hasVision ? `🔍 Analyse IA vision + indexation…` : `📄 Indexation de ${toUpload.length} fichier(s)…`;
    this.cdr.detectChanges();

    const formData = new FormData();
    for (const file of toUpload) {
      formData.append('files', file);
    }

    try {
      // Animate progress bar while uploading
      const progressInterval = setInterval(() => {
        if (this.uploadProgress < 85) {
          this.uploadProgress += 5;
          this.cdr.detectChanges();
        }
      }, 200);

      const response = await fetch('/api/rag/ingest', {
        method: 'POST',
        headers: this.ragHeaders(),
        body: formData,
      });

      clearInterval(progressInterval);
      this.uploadProgress = 100;
      this.cdr.detectChanges();

      if (response.ok) {
        const results: IngestResult[] = await response.json();
        this.ingestResults.push(...results);
        const successful = results.filter(r => r.status === 'success');
        this.uploadStatus = `${successful.length} fichier(s) indexé(s) avec succès`;
        await this.refreshCount();
        await this.loadIndexedDocs();
      } else {
        this.uploadStatus = `Erreur serveur: ${response.status}`;
      }
    } catch (err) {
      this.uploadStatus = 'Erreur de connexion au service RAG';
      console.error('Ingest error:', err);
    }

    setTimeout(() => {
      this.uploading = false;
      this.uploadProgress = 0;
      this.cdr.detectChanges();
    }, 1500);
  }

  async refreshCount() {
    try {
      const res = await fetch('/api/rag/documents/count', { headers: this.ragHeaders() });
      if (res.ok) {
        const data = await res.json();
        this.docCount = data.count ?? 0;
        this.cdr.detectChanges();
      }
    } catch {
      // Service may not be running yet
    }
  }

  confirmClear() {
    this.showClearConfirm = true;
  }

  async clearAll() {
    this.showClearConfirm = false;
    this.clearing = true;
    this.cdr.detectChanges();

    try {
      const res = await fetch('/api/rag/documents', { method: 'DELETE', headers: this.ragHeaders() });
      if (res.ok) {
        this.docCount = 0;
        this.ingestResults = [];
        this.indexedDocs = [];
      }
    } catch (err) {
      console.error('Clear error:', err);
    }

    this.clearing = false;
    this.cdr.detectChanges();
  }

  // ── Chat ─────────────────────────────────────────────────────────────────

  onEnter(e: Event) {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  sendSuggestion(text: string) {
    this.userInput = text;
    this.sendMessage();
  }

  async sendMessage() {
    const question = this.userInput.trim();
    if (!question || this.isStreaming) return;

    this.userInput = '';
    this.isStreaming = true;

    // Add user message
    this.messages.push({
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      sources: [],
    });

    // Add placeholder AI message
    const aiMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      sources: [],
      streaming: true,
    };
    this.messages.push(aiMsg);
    this.scrollToBottom();
    this.cdr.detectChanges();

    try {
      const response = await fetch('/api/rag/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.ragHeaders() },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        aiMsg.content = `Erreur ${response.status}: impossible de joindre le service RAG.`;
        aiMsg.streaming = false;
        this.isStreaming = false;
        this.cdr.detectChanges();
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });

        // Parse SSE — Spring envoie "data:<token>" (sans espace après :)
        // Cas 1 : token normal   → "data: les"  → slice(5) = " les"  ✓
        // Cas 2 : token début    → "data:Il"    → slice(5) = "Il"    ✓
        // Cas 3 : token newline  → "data:"      → chunk vide = '\n'  ✓ (LLM a émis \n)
        for (const line of text.split('\n')) {
          const l = line.trimEnd();
          if (!l.startsWith('data:')) continue;
          const chunk = l.slice(5);
          if (chunk === '[DONE]') break;
          // chunk vide = le LLM a émis un \n (Spring le sépare en data: vide)
          aiMsg.content += chunk.length > 0 ? chunk : '\n';
          this.scrollToBottom();
          this.cdr.detectChanges();
        }
      }

    } catch (err) {
      console.error('Stream error:', err);
      aiMsg.content = "Erreur de connexion. Vérifiez que le service RAG est démarré.";
    }

    aiMsg.streaming = false;
    this.isStreaming = false;
    this.scrollToBottom();
    this.saveHistory();
    this.cdr.detectChanges();
  }

  clearHistory(): void {
    this.messages = [];
    try { localStorage.removeItem('rag_chat_history'); } catch {}
    this.cdr.detectChanges();
  }

  private saveHistory(): void {
    try {
      const data = this.messages.filter(m => !m.streaming).map(m => ({
        id: m.id, role: m.role, content: m.content,
        sources: m.sources ?? [],
        timestamp: (m as any).timestamp?.toISOString?.() ?? new Date().toISOString(),
      }));
      localStorage.setItem('rag_chat_history', JSON.stringify(data.slice(-80)));
    } catch {}
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem('rag_chat_history');
      if (!raw) return;
      const data = JSON.parse(raw) as any[];
      if (!Array.isArray(data) || !data.length) return;
      this.messages = data.map(m => ({
        id: m.id ?? Math.random().toString(36).slice(2),
        role: m.role,
        content: m.content,
        sources: m.sources ?? [],
        streaming: false,
      }));
    } catch {}
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 0);
  }

  /**
   * /api/rag/** est protege par le filtre JWT de la gateway depuis que
   * l'ingestion et la suppression etaient ouvertes a quiconque atteignait
   * le domaine public. Ces appels passaient par fetch() brut, sans header :
   * on lit donc le jeton au meme endroit que AuthService.
   */
  private ragHeaders(): Record<string, string> {
    try {
      const raw = localStorage.getItem('ms_auth');
      const token = raw ? (JSON.parse(raw).token ?? null) : null;
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }

}
