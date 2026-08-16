import { Injectable, signal } from '@angular/core';

export type DialogType = 'info' | 'success' | 'warning' | 'error';

export interface DialogConfig {
  id: string;
  kind: 'alert' | 'confirm' | 'prompt';
  type: DialogType;
  title: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText: string;
  cancelText: string;
  resolve: (value: any) => void;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly dialogs = signal<DialogConfig[]>([]);

  alert(message: string, title = '', type: DialogType = 'info'): Promise<void> {
    return new Promise(resolve => {
      this.dialogs.update(d => [...d, {
        id: crypto.randomUUID(), kind: 'alert', type,
        title, message, confirmText: 'OK', cancelText: '',
        resolve
      }]);
    });
  }

  confirm(
    message: string,
    title = 'Confirmation',
    confirmText = 'Confirmer',
    cancelText = 'Annuler',
    type: DialogType = 'warning'
  ): Promise<boolean> {
    return new Promise(resolve => {
      this.dialogs.update(d => [...d, {
        id: crypto.randomUUID(), kind: 'confirm', type,
        title, message, confirmText, cancelText,
        resolve
      }]);
    });
  }

  prompt(
    title: string,
    message = '',
    placeholder = '',
    defaultValue = ''
  ): Promise<string | null> {
    return new Promise(resolve => {
      this.dialogs.update(d => [...d, {
        id: crypto.randomUUID(), kind: 'prompt', type: 'info',
        title, message, placeholder, defaultValue,
        confirmText: 'Valider', cancelText: 'Annuler',
        resolve
      }]);
    });
  }

  dismiss(id: string, value: any): void {
    const cfg = this.dialogs().find(d => d.id === id);
    if (cfg) cfg.resolve(value);
    this.dialogs.update(d => d.filter(x => x.id !== id));
  }
}
