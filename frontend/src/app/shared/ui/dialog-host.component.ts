import {
  Component, HostListener, ChangeDetectionStrategy, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogService, DialogConfig, DialogType } from './dialog.service';

@Component({
  selector: 'app-dialog-host',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .dlg-backdrop {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,.65);
      backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      animation: dlg-fade .18s ease;
    }
    @keyframes dlg-fade { from { opacity: 0 } to { opacity: 1 } }

    .dlg-card {
      background: rgba(15,23,42,.97);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 18px;
      box-shadow: 0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(99,102,241,.12);
      width: min(420px, calc(100vw - 2rem));
      padding: 2rem 2rem 1.5rem;
      animation: dlg-pop .2s cubic-bezier(.34,1.56,.64,1);
      position: relative;
      outline: none;
    }
    @keyframes dlg-pop {
      from { transform: scale(.88) translateY(10px); opacity: 0 }
      to   { transform: scale(1)   translateY(0);    opacity: 1 }
    }

    .dlg-icon-wrap {
      display: flex; justify-content: center; margin-bottom: 1.25rem;
    }
    .dlg-icon {
      width: 52px; height: 52px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem;
    }
    .dlg-icon--info    { background: rgba(99,102,241,.18); color: #818cf8; border: 1px solid rgba(99,102,241,.3); }
    .dlg-icon--success { background: rgba(34,197,94,.15);  color: #4ade80; border: 1px solid rgba(34,197,94,.3); }
    .dlg-icon--warning { background: rgba(245,158,11,.15); color: #fbbf24; border: 1px solid rgba(245,158,11,.3); }
    .dlg-icon--error   { background: rgba(239,68,68,.15);  color: #f87171; border: 1px solid rgba(239,68,68,.3); }

    .dlg-title {
      margin: 0 0 .5rem;
      text-align: center;
      font-size: 1.05rem;
      font-weight: 600;
      color: #f1f5f9;
      letter-spacing: -.01em;
    }
    .dlg-msg {
      margin: 0 0 1.5rem;
      text-align: center;
      font-size: .9rem;
      color: rgba(203,213,225,.8);
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .dlg-msg:empty { display: none; }

    .dlg-input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(30,41,59,.8);
      border: 1px solid rgba(99,102,241,.3);
      border-radius: 10px;
      padding: .65rem .875rem;
      color: #f1f5f9;
      font-size: .9rem;
      outline: none;
      transition: border-color .15s;
      margin-bottom: 1.5rem;
    }
    .dlg-input:focus { border-color: #6366f1; }
    .dlg-input::placeholder { color: rgba(148,163,184,.5); }

    .dlg-actions {
      display: flex; gap: .75rem; justify-content: flex-end;
    }
    .dlg-btn {
      padding: .55rem 1.25rem;
      border-radius: 10px;
      font-size: .875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all .15s;
      border: none;
    }
    .dlg-btn--cancel {
      background: rgba(51,65,85,.6);
      color: #94a3b8;
      border: 1px solid rgba(100,116,139,.3);
    }
    .dlg-btn--cancel:hover { background: rgba(71,85,105,.7); color: #cbd5e1; }

    .dlg-btn--confirm {
      background: linear-gradient(135deg,#6366f1,#0ea5e9);
      color: #fff;
      box-shadow: 0 4px 14px rgba(99,102,241,.35);
    }
    .dlg-btn--confirm:hover { filter: brightness(1.1); transform: translateY(-1px); }
    .dlg-btn--confirm:active { filter: brightness(.95); transform: translateY(0); }

    .dlg-btn--confirm--danger {
      background: linear-gradient(135deg,#ef4444,#dc2626);
      box-shadow: 0 4px 14px rgba(239,68,68,.35);
    }
    .dlg-btn--confirm--success {
      background: linear-gradient(135deg,#10b981,#059669);
      box-shadow: 0 4px 14px rgba(16,185,129,.35);
    }
  `],
  template: `
@for (dlg of svc.dialogs(); track dlg.id) {
  <div class="dlg-backdrop" (mousedown)="onBackdrop($event, dlg)">
    <div class="dlg-card" tabindex="0"
         (keydown.enter)="onEnter(dlg)"
         (keydown.escape)="onEscape(dlg)"
         (mousedown)="$event.stopPropagation()">

      <div class="dlg-icon-wrap">
        <div class="dlg-icon" [class]="'dlg-icon--' + dlg.type">
          {{ iconFor(dlg.type) }}
        </div>
      </div>

      @if (dlg.title) {
        <h2 class="dlg-title">{{ dlg.title }}</h2>
      }
      <p class="dlg-msg">{{ dlg.message }}</p>

      @if (dlg.kind === 'prompt') {
        <input class="dlg-input" type="text"
               [placeholder]="dlg.placeholder || ''"
               [value]="dlg.defaultValue || ''"
               #promptInput
               (input)="promptValues[dlg.id] = promptInput.value"
               (keydown.enter)="confirmPrompt(dlg, promptInput.value)" />
      }

      <div class="dlg-actions">
        @if (dlg.kind !== 'alert') {
          <button class="dlg-btn dlg-btn--cancel"
                  (click)="svc.dismiss(dlg.id, dlg.kind === 'confirm' ? false : null)">
            {{ dlg.cancelText }}
          </button>
        }
        <button class="dlg-btn dlg-btn--confirm"
                [class.dlg-btn--confirm--danger]="isDanger(dlg)"
                [class.dlg-btn--confirm--success]="dlg.type === 'success' && !isDanger(dlg)"
                (click)="onConfirm(dlg)">
          {{ dlg.confirmText }}
        </button>
      </div>
    </div>
  </div>
}
  `
})
export class DialogHostComponent {
  promptValues: Record<string, string> = {};

  constructor(public svc: DialogService) {}

  iconFor(type: DialogType): string {
    return { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' }[type] ?? 'ℹ️';
  }

  isDanger(dlg: DialogConfig): boolean {
    return dlg.kind === 'confirm' && (
      dlg.message.toLowerCase().includes('supprimer') ||
      dlg.message.toLowerCase().includes('irréversible') ||
      dlg.message.toLowerCase().includes('effacer')
    );
  }

  onConfirm(dlg: DialogConfig): void {
    if (dlg.kind === 'prompt') {
      this.svc.dismiss(dlg.id, this.promptValues[dlg.id] ?? dlg.defaultValue ?? '');
    } else if (dlg.kind === 'confirm') {
      this.svc.dismiss(dlg.id, true);
    } else {
      this.svc.dismiss(dlg.id, undefined);
    }
  }

  confirmPrompt(dlg: DialogConfig, value: string): void {
    this.svc.dismiss(dlg.id, value);
  }

  onEnter(dlg: DialogConfig): void {
    if (dlg.kind === 'prompt') return;
    this.onConfirm(dlg);
  }

  onEscape(dlg: DialogConfig): void {
    if (dlg.kind === 'alert') {
      this.svc.dismiss(dlg.id, undefined);
    } else {
      this.svc.dismiss(dlg.id, dlg.kind === 'confirm' ? false : null);
    }
  }

  onBackdrop(event: MouseEvent, dlg: DialogConfig): void {
    if (dlg.kind === 'alert') this.svc.dismiss(dlg.id, undefined);
  }
}
