import { Injectable } from '@angular/core';

export interface CvSectionResult {
  id: string; icon: string; title: string;
  score: number; color: string; feedback: string; tips: string[];
}

export interface WorkspaceCv {
  id: string;
  fileName: string;
  fileSize: number;
  analyzedAt: string;
  targetJob: string;
  status: 'selected' | 'waiting' | 'rejected' | 'favorite' | 'pending';
  notes: string;
  workspaceMode: string;
  globalScore: number;
  globalLabel: string;
  atsPct: number;
  sections: CvSectionResult[];
  keywords: { word: string; present: boolean }[];
  strengths: string[];
  improvements: string[];
  suggestedJobs: string[];
}

export type WorkspaceMode = 'recruiter' | 'candidate' | 'hr' | null;

@Injectable({ providedIn: 'root' })
export class CvWorkspaceService {

  private _cvs: WorkspaceCv[] = [];
  private _mode: WorkspaceMode = null;
  private _loaded = false;

  // ── count (sync, pour badge dans la session bar) ──
  get count(): number { return this._cvs.length; }

  get mode(): WorkspaceMode { return this._mode; }

  // ── Chargement initial depuis l'API ──────────────────────────────────────

  async loadFromApi(): Promise<void> {
    if (this._loaded) return;
    try {
      const [cvsRes, settingsRes] = await Promise.all([
        fetch('/api/cv-workspace', { credentials: 'include' }),
        fetch('/api/cv-workspace/settings', { credentials: 'include' }),
      ]);
      if (cvsRes.ok) {
        const raw: any[] = await cvsRes.json();
        this._cvs = raw.map(r => this._mapFromApi(r));
      }
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        this._mode = (s.mode || null) as WorkspaceMode;
      }
    } catch { /* service dégradé */ }
    this._loaded = true;
  }

  get cvs(): WorkspaceCv[] { return [...this._cvs]; }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async add(cv: WorkspaceCv): Promise<void> {
    try {
      const res = await fetch('/api/cv-workspace', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this._mapToApi(cv)),
      });
      if (res.ok) {
        const saved = await res.json();
        const mapped = this._mapFromApi(saved);
        this._cvs = [mapped, ...this._cvs.filter(c => c.id !== mapped.id)];
      }
    } catch { /* hors-ligne — on n'insère pas localement */ }
  }

  async updateStatus(id: string, status: WorkspaceCv['status']): Promise<void> {
    const cv = this._cvs.find(c => c.id === id);
    if (cv) cv.status = status;
    try {
      await fetch(`/api/cv-workspace/${id}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch {}
  }

  async updateNotes(id: string, notes: string): Promise<void> {
    const cv = this._cvs.find(c => c.id === id);
    if (cv) cv.notes = notes;
    try {
      await fetch(`/api/cv-workspace/${id}/notes`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
    } catch {}
  }

  async remove(id: string): Promise<void> {
    this._cvs = this._cvs.filter(c => c.id !== id);
    try {
      await fetch(`/api/cv-workspace/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {}
  }

  async clear(): Promise<void> {
    this._cvs = [];
    try {
      await fetch('/api/cv-workspace', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {}
  }

  async setMode(m: WorkspaceMode): Promise<void> {
    this._mode = m;
    try {
      await fetch('/api/cv-workspace/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: m ?? '' }),
      });
    } catch {}
  }

  // ── Mapping API ↔ Frontend ───────────────────────────────────────────────

  private _mapFromApi(r: any): WorkspaceCv {
    return {
      id:            r.id,
      fileName:      r.fileName,
      fileSize:      r.fileSize ?? 0,
      analyzedAt:    r.analyzedAt ?? new Date().toISOString(),
      targetJob:     r.targetJob ?? '',
      status:        r.status ?? 'pending',
      notes:         r.notes ?? '',
      workspaceMode: r.workspaceMode ?? 'recruiter',
      globalScore:   r.globalScore ?? 0,
      globalLabel:   r.globalLabel ?? '',
      atsPct:        r.atsPct ?? 0,
      sections:      this._parseJson(r.sections, []),
      keywords:      this._parseJson(r.keywords, []),
      strengths:     this._parseJson(r.strengths, []),
      improvements:  this._parseJson(r.improvements, []),
      suggestedJobs: this._parseJson(r.suggestedJobs, []),
    };
  }

  private _mapToApi(cv: WorkspaceCv): any {
    return {
      id:            cv.id,
      fileName:      cv.fileName,
      fileSize:      cv.fileSize,
      analyzedAt:    cv.analyzedAt,
      targetJob:     cv.targetJob,
      status:        cv.status,
      notes:         cv.notes,
      workspaceMode: cv.workspaceMode ?? 'recruiter',
      globalScore:   cv.globalScore,
      globalLabel:   cv.globalLabel,
      atsPct:        cv.atsPct,
      sections:      JSON.stringify(cv.sections),
      keywords:      JSON.stringify(cv.keywords),
      strengths:     JSON.stringify(cv.strengths),
      improvements:  JSON.stringify(cv.improvements),
      suggestedJobs: JSON.stringify(cv.suggestedJobs),
    };
  }

  private _parseJson(val: any, fallback: any): any {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return fallback; }
    }
    return fallback;
  }
}
