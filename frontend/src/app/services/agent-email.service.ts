import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface AgentTask {
  id: string; title: string; description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate: string | null; agentGenerated: boolean;
  createdAt: string; completedAt: string | null;
}
export interface CredentialResponse {
  id: string; provider: string; displayName: string;
  maskedKey: string; active: boolean; lastUsedAt: string | null;
}
export interface ScheduledTask {
  id: string; name: string; prompt: string;
  cronExpression: string | null; nextRunAt: string;
  lastRunAt: string | null; active: boolean; runCount: number;
}
export interface MemoryMessage {
  id: string; role: string; content: string;
  toolName: string | null; createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AgentEmailService {

  private auth = inject(AuthService);

  private get headers(): Record<string, string> {
    const token = this.auth.getToken();
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  // ── Chat SSE ────────────────────────────────────────────────────────────

  chatStream(message: string,
             onChunk: (c: string) => void,
             onDone: () => void,
             onError: (e: string) => void): void {
    fetch('/api/agent/email/chat', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ message })
    }).then(async res => {
      if (!res.ok || !res.body) {
        onError(`Erreur ${res.status}`); return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trimStart();
          if (data === '[DONE]') { onDone(); return; }
          if (data) onChunk(data);
        }
      }
      onDone();
    }).catch(e => onError(e.message));
  }

  async clearMemory(): Promise<void> {
    await fetch('/api/agent/email/memory', { method: 'DELETE', headers: this.headers });
  }

  async getMemory(): Promise<MemoryMessage[]> {
    const r = await fetch('/api/agent/email/memory', { headers: this.headers });
    return r.ok ? r.json() : [];
  }

  // ── Tasks ───────────────────────────────────────────────────────────────

  async getTasks(status?: string): Promise<AgentTask[]> {
    const url = '/api/agent/tasks' + (status ? `?status=${status}` : '');
    const r = await fetch(url, { headers: this.headers });
    return r.ok ? r.json() : [];
  }

  async createTask(req: Partial<AgentTask>): Promise<AgentTask | null> {
    const r = await fetch('/api/agent/tasks', { method: 'POST', headers: this.headers, body: JSON.stringify(req) });
    return r.ok ? r.json() : null;
  }

  async updateTaskStatus(id: string, status: string): Promise<void> {
    await fetch(`/api/agent/tasks/${id}/status?status=${status}`, { method: 'PATCH', headers: this.headers });
  }

  async deleteTask(id: string): Promise<void> {
    await fetch(`/api/agent/tasks/${id}`, { method: 'DELETE', headers: this.headers });
  }

  // ── Credentials ─────────────────────────────────────────────────────────

  async getCredentials(): Promise<CredentialResponse[]> {
    const r = await fetch('/api/user/credentials', { headers: this.headers });
    return r.ok ? r.json() : [];
  }

  async saveCredential(provider: string, apiKey: string, displayName: string): Promise<boolean> {
    const r = await fetch('/api/user/credentials', {
      method: 'POST', headers: this.headers,
      body: JSON.stringify({ provider, apiKey, displayName })
    });
    return r.ok;
  }

  async testCredential(provider: string, apiKey: string): Promise<{ valid: boolean; message: string }> {
    const r = await fetch('/api/user/credentials/test', {
      method: 'POST', headers: this.headers,
      body: JSON.stringify({ provider, apiKey, displayName: '' })
    });
    return r.ok ? r.json() : { valid: false, message: 'Erreur réseau' };
  }

  async deleteCredential(id: string): Promise<void> {
    await fetch(`/api/user/credentials/${id}`, { method: 'DELETE', headers: this.headers });
  }

  // ── Scheduled tasks ─────────────────────────────────────────────────────

  async getScheduled(): Promise<ScheduledTask[]> {
    const r = await fetch('/api/agent/scheduled', { headers: this.headers });
    return r.ok ? r.json() : [];
  }

  async createScheduled(req: { name: string; prompt: string; cronExpression?: string; runAt?: string }): Promise<ScheduledTask | null> {
    const r = await fetch('/api/agent/scheduled', { method: 'POST', headers: this.headers, body: JSON.stringify(req) });
    return r.ok ? r.json() : null;
  }

  async toggleScheduled(id: string, active: boolean): Promise<void> {
    await fetch(`/api/agent/scheduled/${id}?active=${active}`, { method: 'PATCH', headers: this.headers });
  }

  async runScheduledNow(id: string): Promise<void> {
    await fetch(`/api/agent/scheduled/${id}/run`, { method: 'POST', headers: this.headers });
  }

  async deleteScheduled(id: string): Promise<void> {
    await fetch(`/api/agent/scheduled/${id}`, { method: 'DELETE', headers: this.headers });
  }
}
