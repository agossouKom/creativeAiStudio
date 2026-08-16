import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { zipSync, unzipSync } from 'fflate';

interface MediaFile {
  id: string;
  file: File;
  status: 'waiting' | 'analyzing' | 'done' | 'error';
  category?: string;
  subCategory?: string;
  confidence?: number;
  icon?: string;
  color?: string;
  detail?: string;
}

const CATEGORIES: Record<string, { label: string; icon: string; color: string }> = {
  // Vidéo
  'video-adult':    { label: 'Contenu adulte',        icon: '🔞', color: '#dc2626' },
  'video-action':   { label: 'Action / Thriller',      icon: '💥', color: '#ef4444' },
  'video-dance':    { label: 'Danse / Performance',    icon: '💃', color: '#ec4899' },
  'video-sport':    { label: 'Sport',                  icon: '⚽', color: '#84cc16' },
  'video-clip':     { label: 'Clip / Court-métrage',   icon: '🎬', color: '#f97316' },
  'video-nature':   { label: 'Paysage / Nature',       icon: '🌿', color: '#22c55e' },
  'video-pres':     { label: 'Présentation / Tuto',    icon: '📺', color: '#eab308' },
  'video-screen':   { label: 'Capture d\'écran',       icon: '🖥️', color: '#64748b' },
  'video-other':    { label: 'Vidéo diverse',          icon: '🎥', color: '#94a3b8' },
  // Audio
  'audio-dance':    { label: 'Musique danse / Club',   icon: '🎧', color: '#6366f1' },
  'audio-speech':   { label: 'Parole / Discours',      icon: '🗣️', color: '#8b5cf6' },
  'audio-podcast':  { label: 'Podcast / Conférence',   icon: '🎙️', color: '#7c3aed' },
  'audio-music':    { label: 'Musique',                icon: '🎵', color: '#a855f7' },
  'audio-fx':       { label: 'Son / Effet sonore',     icon: '🔊', color: '#c084fc' },
  // Image
  'img-adult':      { label: 'Contenu adulte',         icon: '🔞', color: '#dc2626' },
  'img-document':   { label: 'Document / CV / Texte',  icon: '📄', color: '#3b82f6' },
  'img-logo':       { label: 'Logo / Icône',           icon: '🎨', color: '#06b6d4' },
  'img-flyer':      { label: 'Flyer / Affiche',        icon: '📋', color: '#f59e0b' },
  'img-photo':      { label: 'Photo / Scène',          icon: '🖼️', color: '#84cc16' },
  'img-screenshot': { label: 'Capture d\'écran',       icon: '🖥️', color: '#475569' },
  // Documents
  'doc-cv':         { label: 'CV / Portfolio',         icon: '👤', color: '#2563eb' },
  'doc-memoir':     { label: 'Mémoire / Rapport',      icon: '📚', color: '#7c3aed' },
  'doc-lettre':     { label: 'Lettre / Courrier',      icon: '✉️', color: '#0ea5e9' },
  'doc-facture':    { label: 'Facture / Contrat',      icon: '💼', color: '#0d9488' },
  'doc-text':       { label: 'Document texte',         icon: '📝', color: '#6366f1' },
  excel:            { label: 'Tableaux Excel',         icon: '📊', color: '#16a34a' },
  pptx:             { label: 'Présentation',           icon: '📽️', color: '#ea580c' },
  text:             { label: 'Fichier texte',          icon: '📃', color: '#64748b' },
  autre:            { label: 'Autres',                 icon: '📦', color: '#94a3b8' },
};

// ─── ANALYSE PROFONDE ────────────────────────────────────────────────────────

async function analyzeDeep(file: File): Promise<{ category: string; subCategory: string; confidence: number; detail: string }> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const magicType = await getMagicType(file, ext);

  if (magicType === 'image') return analyzeImage(file, ext);
  if (magicType === 'video') return analyzeVideo(file, ext);
  if (magicType === 'audio') return analyzeAudio(file, ext);
  if (magicType === 'pdf')   return analyzePdf(file);
  if (magicType === 'docx')  return analyzeDocx(file);
  if (magicType === 'ole')   return analyzeOle(file, ext);

  if (['xlsx','xls'].includes(ext)) return { category:'excel',  subCategory:'XLSX/XLS', confidence:85, detail:'Tableur détecté par extension' };
  if (['pptx','ppt'].includes(ext)) return { category:'pptx',   subCategory:'PPTX/PPT', confidence:85, detail:'Présentation détectée' };
  if (['txt','md','csv','log'].includes(ext)) return { category:'text', subCategory:ext.toUpperCase(), confidence:90, detail:'Fichier texte' };
  return { category:'autre', subCategory:ext.toUpperCase() || '?', confidence:50, detail:'Type non reconnu' };
}

// ── Magic bytes ──────────────────────────────────────────────────────────────
async function getMagicType(file: File, ext: string): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const b = new Uint8Array(ev.target?.result as ArrayBuffer);
      if (!b || b.length < 4) { resolve('unknown'); return; }
      if (b[0]===0xFF&&b[1]===0xD8)                                         { resolve('image'); return; }
      if (b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47)              { resolve('image'); return; }
      if (b[0]===0x47&&b[1]===0x49&&b[2]===0x46)                           { resolve('image'); return; }
      if (b[0]===0x42&&b[1]===0x4D)                                         { resolve('image'); return; }
      if (b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b.length>=12&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42) { resolve('image'); return; }
      if (b[0]===0x49&&b[1]===0x44&&b[2]===0x33)                           { resolve('audio'); return; }
      if (b[0]===0xFF&&(b[1]&0xE0)===0xE0)                                  { resolve('audio'); return; }
      if (b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b.length>=12&&b[8]===0x57&&b[9]===0x41&&b[10]===0x56) { resolve('audio'); return; }
      if (b[0]===0x66&&b[1]===0x4C&&b[2]===0x61&&b[3]===0x43)              { resolve('audio'); return; }
      if (b[0]===0x4F&&b[1]===0x67&&b[2]===0x67&&b[3]===0x53)              { resolve('audio'); return; }
      if (b.length>=12&&b[4]===0x66&&b[5]===0x74&&b[6]===0x79&&b[7]===0x70) {
        const br = String.fromCharCode(b[8],b[9],b[10],b[11]);
        if (/M4A|mp42|isom|avc1|mp41|mmp4/.test(br)) { resolve(['mp4','mov','m4v','3gp'].includes(ext)?'video':'audio'); return; }
        if (/mdat|ftyp/.test(br) || ['mp4','mov','m4v'].includes(ext)) { resolve('video'); return; }
      }
      if (b[0]===0x1A&&b[1]===0x45&&b[2]===0xDF&&b[3]===0xA3)              { resolve('video'); return; }
      if (b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b.length>=12&&b[8]===0x41&&b[9]===0x56&&b[10]===0x49) { resolve('video'); return; }
      if (['mp4','mov','avi','mkv','webm','m4v','flv','wmv'].includes(ext)) { resolve('video'); return; }
      if (['mp3','wav','flac','ogg','aac','m4a','opus'].includes(ext))       { resolve('audio'); return; }
      if (b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46)              { resolve('pdf');   return; }
      if (b[0]===0x50&&b[1]===0x4B&&(b[2]===0x03||b[2]===0x05))            { resolve('docx');  return; }
      if (b[0]===0xD0&&b[1]===0xCF&&b[2]===0x11&&b[3]===0xE0)              { resolve('ole');   return; }
      resolve('unknown');
    };
    reader.readAsArrayBuffer(file.slice(0, 16));
  });
}

// ── UTILITAIRES PIXEL ────────────────────────────────────────────────────────

interface PixelStats {
  whites: number; darks: number; colorRatio: number;
  skinRatio: number; avgR: number; avgG: number; avgB: number;
}

function analyzePixels(data: Uint8ClampedArray): PixelStats {
  let whites = 0, darks = 0, colorPixels = 0, skin = 0;
  let rSum = 0, gSum = 0, bSum = 0;
  const n = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const brightness = (r + g + b) / 3;
    const saturation = Math.max(r,g,b) - Math.min(r,g,b);
    if (brightness > 230) whites++;
    if (brightness < 45)  darks++;
    if (saturation > 40)  colorPixels++;
    rSum += r; gSum += g; bSum += b;
    if (isSkinTone(r, g, b)) skin++;
  }

  return {
    whites: whites/n, darks: darks/n, colorRatio: colorPixels/n, skinRatio: skin/n,
    avgR: rSum/(n*255), avgG: gSum/(n*255), avgB: bSum/(n*255),
  };
}

// Détection de ton de peau — algorithme Kovač/RGB strict
// Réduit les faux positifs sur objets orange, rouges, bois, sable, etc.
function isSkinTone(r: number, g: number, b: number): boolean {
  // Plage de luminosité raisonnable (ni trop sombre, ni surexposé)
  const brightness = (r + g + b) / 3;
  if (brightness < 60 || brightness > 230) return false;
  // Règles RGB de Kovač : R dominant, contraste minimal, différence R-G marquée
  if (r < 95 || g < 40 || b < 20) return false;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  if (max - min < 15) return false;      // trop gris/neutre
  if (Math.abs(r - g) < 15) return false; // pas assez de dominante rouge
  if (r <= g || r <= b) return false;     // R doit être dominant
  // Exclure les objets visiblement non-peau
  if (r > 210 && g > 170 && b < 100) return false; // orange vif (fruits, etc.)
  if (r > 220 && g < 100 && b < 100) return false; // rouge vif (logos, etc.)
  if (g > r * 0.95 && g > b) return false;          // vert dominant → végétation
  return true;
}

function frameDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let diff = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4)
    diff += Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2]);
  return diff / (n * 3 * 255);
}

// ── Image analysis ───────────────────────────────────────────────────────────
async function analyzeImage(file: File, ext: string): Promise<any> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const W = Math.min(img.width, 256), H = Math.min(img.height, 256);
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, W, H);
      const px = analyzePixels(ctx.getImageData(0, 0, W, H).data);

      const aspect  = img.width / img.height;
      const isA4    = aspect > 0.68 && aspect < 0.78;
      const isWide  = aspect > 1.5;
      const isSquare = aspect > 0.85 && aspect < 1.15;
      const isSmall  = img.width * img.height < 80000;

      let category = 'img-photo', detail = '', confidence = 68;

      // Catégories claires en premier — adulte seulement en dernier recours
      if (px.whites > 0.62 && px.colorRatio < 0.22) {
        category = 'img-document';
        detail = isA4 ? 'Format A4 + fond blanc → document/CV' : 'Fond blanc dominant → document texte';
        confidence = isA4 ? 88 : 80;
      } else if ((isSquare || isSmall) && px.colorRatio < 0.55 && px.whites > 0.12) {
        category = 'img-logo';
        detail = 'Format compact + palette limitée → logo/icône';
        confidence = 72;
      } else if (px.colorRatio > 0.45 && !isWide && px.whites < 0.42 && px.skinRatio < 0.38) {
        category = 'img-flyer';
        detail = `Contenu coloré (${Math.round(px.colorRatio*100)}%) format ${isA4?'A4':'portrait'} → flyer/affiche`;
        confidence = 74;
      } else if (px.whites > 0.38 && px.darks > 0.05 && !isA4 && px.skinRatio < 0.20) {
        category = 'img-screenshot';
        detail = 'Interface claire avec éléments sombres → capture d\'écran';
        confidence = 65;
      } else if (px.skinRatio > 0.42 && px.whites < 0.28 && !isSquare && !isSmall) {
        // Seuil élevé (42%) + fond sombre + pas un logo/icône → contenu adulte probable
        category = 'img-adult';
        detail = `Ratio peau: ${Math.round(px.skinRatio*100)}% (heuristique — faux positifs possibles)`;
        confidence = Math.min(80, 58 + Math.round(px.skinRatio * 55));
      } else {
        category = 'img-photo';
        detail = 'Analyse générale → photo ou image diverse';
        confidence = 62;
      }

      resolve({ category, subCategory: ext.toUpperCase(), confidence, detail });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ category:'img-photo', subCategory:ext.toUpperCase(), confidence:50, detail:'Chargement image échoué' }); };
    img.src = url;
  });
}

// ── Video analysis — extraction multi-frames ─────────────────────────────────
async function analyzeVideo(file: File, ext: string): Promise<any> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    const url   = URL.createObjectURL(file);
    video.muted = true; video.preload = 'metadata';

    const cleanup = () => URL.revokeObjectURL(url);

    const seekAndCapture = (time: number, ctx: CanvasRenderingContext2D, W: number, H: number): Promise<Uint8ClampedArray | null> =>
      new Promise(res => {
        const timer = setTimeout(() => res(null), 4000);
        video.onseeked = () => {
          clearTimeout(timer);
          try {
            ctx.drawImage(video, 0, 0, W, H);
            res(ctx.getImageData(0, 0, W, H).data);
          } catch { res(null); }
        };
        video.currentTime = time;
      });

    video.onloadedmetadata = async () => {
      const duration = video.duration || 1;
      const W = 200;
      const H = Math.round(200 * (video.videoHeight / (video.videoWidth || 1))) || 112;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      // Extraire 4 frames: 10%, 30%, 55%, 75% de la durée
      const positions = [0.10, 0.30, 0.55, 0.75]
        .map(p => Math.min(duration * p, duration - 0.5))
        .filter(t => t >= 0);

      const frames: Uint8ClampedArray[] = [];
      for (const pos of positions) {
        const data = await seekAndCapture(pos, ctx, W, H);
        if (data) frames.push(data);
      }
      cleanup();

      if (frames.length === 0) {
        resolve({ category:'video-other', subCategory:ext.toUpperCase(), confidence:50, detail:'Frames non lisibles' });
        return;
      }

      // Moyenner les métriques sur toutes les frames
      const stats = frames.map(analyzePixels);
      const avg = (key: keyof PixelStats) => stats.reduce((s, p) => s + (p[key] as number), 0) / stats.length;
      const avgSkin  = avg('skinRatio');
      const avgWhite = avg('whites');
      const avgDark  = avg('darks');
      const avgColor = avg('colorRatio');
      const avgG     = avg('avgG');
      const avgB     = avg('avgB');

      // Mouvement entre frames consécutives
      let motion = 0;
      for (let i = 1; i < frames.length; i++) motion += frameDiff(frames[i-1], frames[i]);
      motion /= Math.max(1, frames.length - 1);

      // Skin minimum sur toutes les frames (cohérence, exclut les gros plans passagers)
      const minSkin = Math.min(...stats.map(s => s.skinRatio));

      const subCat = `${ext.toUpperCase()} • ${fmtDuration(duration)}`;
      let category = 'video-other', detail = '', confidence = 58;

      // ── Cascade : catégories claires en premier, adulte en dernier recours ──
      if (avgWhite > 0.48 && avgColor < 0.20) {
        category = 'video-pres';
        detail = 'Image claire + palette sobre → présentation/tutoriel';
        confidence = 72;
      } else if (avgWhite > 0.38 && avgColor < 0.28 && avgDark < 0.15) {
        category = 'video-screen';
        detail = 'Interface claire → capture d\'écran vidéo';
        confidence = 65;
      } else if (avgG > 0.35 && avgG > avgB * 1.1 && motion < 0.08) {
        category = 'video-nature';
        detail = `Dominante verte (${Math.round(avgG*100)}%) + scène calme → nature/paysage`;
        confidence = 70;
      } else if (avgDark > 0.22 && motion > 0.07 && avgColor > 0.12) {
        category = 'video-action';
        detail = `Scènes sombres (${Math.round(avgDark*100)}%) + mouvement (${Math.round(motion*100)}%) → action/thriller`;
        confidence = 68;
      } else if (avgColor > 0.42 && avgDark < 0.28 && motion > 0.04) {
        category = 'video-dance';
        detail = `Contenu coloré (${Math.round(avgColor*100)}%) + dynamisme → danse/performance`;
        confidence = 65;
      } else if (duration <= 300 && avgColor > 0.25) {
        category = 'video-clip';
        detail = `Court (${fmtDuration(duration)}) + coloré → clip/divertissement`;
        confidence = 60;
      } else if (avgSkin > 0.42 && minSkin > 0.28 && avgWhite < 0.20) {
        // Adulte EN DERNIER : ratio moyen très élevé (42%) ET cohérent sur toutes
        // les frames (min 28%) ET fond sombre. Un gros plan visage normal
        // atteint ~15-25% max — ce seuil le filtre.
        category = 'video-adult';
        detail = `Ratio peau élevé: moy. ${Math.round(avgSkin*100)}%, min. ${Math.round(minSkin*100)}% sur ${frames.length} frames`;
        confidence = Math.min(76, 52 + Math.round(avgSkin * 55));
      } else {
        category = 'video-other';
        detail = `Contenu vidéo divers (${fmtDuration(duration)})`;
        confidence = 52;
      }

      resolve({ category, subCategory: subCat, confidence, detail });
    };

    video.onerror = () => { cleanup(); resolve({ category:'video-other', subCategory:ext.toUpperCase(), confidence:50, detail:'Vidéo non décodable' }); };
    video.src = url;
  });
}

// ── Audio analysis — fréquences + BPM ────────────────────────────────────────
async function analyzeAudio(file: File, ext: string): Promise<any> {
  try {
    const buf = await file.arrayBuffer();
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) throw new Error('No AudioContext');

    const ctx     = new AudioCtx();
    const decoded = await ctx.decodeAudioData(buf);
    ctx.close();

    const duration   = decoded.duration;
    const data       = decoded.getChannelData(0);
    const sampleRate = decoded.sampleRate;

    // Analyse spectrale par FFT
    const fftSize  = 1024;
    const segment  = data.slice(Math.floor(data.length * 0.3), Math.floor(data.length * 0.3) + fftSize);
    const spectrum = computeSpectrum(segment, fftSize);
    const binHz    = sampleRate / fftSize;

    let speechEnergy = 0, bassEnergy = 0, totalEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      totalEnergy += spectrum[i];
      if (i <= Math.floor(250 / binHz))   bassEnergy   += spectrum[i];
      if (i >= Math.floor(300 / binHz) && i <= Math.floor(3400 / binHz)) speechEnergy += spectrum[i];
    }
    if (totalEnergy === 0) totalEnergy = 1;
    const speechRatio = speechEnergy / totalEnergy;
    const bassRatio   = bassEnergy   / totalEnergy;

    // Détection du BPM par flux d'énergie
    const bpm = detectBPM(data, sampleRate);

    const subCat = `${ext.toUpperCase()} • ${fmtDuration(duration)}`;
    let category = 'audio-music', detail = '', confidence = 65;

    if (duration < 5) {
      category = 'audio-fx';
      detail = `Durée courte (${Math.round(duration)}s) → son/effet`;
      confidence = 82;
    } else if (speechRatio > 0.44 && bassRatio < 0.18) {
      if (duration > 900) {
        // Parole longue durée → podcast/conférence
        category = 'audio-podcast';
        detail = `Parole dominante (${Math.round(speechRatio*100)}%) + durée ${fmtDuration(duration)} → podcast/conférence`;
        confidence = 80;
      } else {
        category = 'audio-speech';
        detail = `Fréquences vocales (${Math.round(speechRatio*100)}%) → parole/discours`;
        confidence = 78;
      }
    } else if (bpm >= 100 && bpm <= 185 && bassRatio > 0.17) {
      // Rythme régulier + basses → musique danse
      category = 'audio-dance';
      detail = `BPM détecté: ${bpm} bpm + basses (${Math.round(bassRatio*100)}%) → danse/club`;
      confidence = 76;
    } else if (bassRatio > 0.22) {
      category = 'audio-music';
      detail = `Basses marquées (${Math.round(bassRatio*100)}%)${bpm > 0 ? ` • ${bpm} BPM` : ''} → musique`;
      confidence = 72;
    } else if (speechRatio > 0.30) {
      category = 'audio-speech';
      detail = `Mix voix/son → parole (${Math.round(speechRatio*100)}% fréq. vocales)`;
      confidence = 62;
    } else {
      category = 'audio-music';
      detail = `Spectre musical${bpm > 0 ? ` • ${bpm} BPM` : ''} → musique`;
      confidence = 60;
    }

    return { category, subCategory: subCat, confidence, detail };
  } catch {
    return { category:'audio-music', subCategory:ext.toUpperCase(), confidence:55, detail:'Analyse audio indisponible' };
  }
}

// Détection BPM par énergie d'enveloppe (O(N), rapide)
function detectBPM(data: Float32Array, sampleRate: number): number {
  const hopSize = Math.max(1, Math.floor(sampleRate * 0.01)); // fenêtres de 10ms
  const maxSamples = Math.min(data.length, sampleRate * 90);  // analyse max 90s
  const onsets: number[] = [];
  let prevE = 0;

  for (let i = 0; i < maxSamples - hopSize; i += hopSize) {
    let e = 0;
    for (let j = i; j < i + hopSize; j++) e += data[j] * data[j];
    e /= hopSize;
    onsets.push(Math.max(0, e - prevE));
    prevE = e * 0.85 + prevE * 0.15;
  }

  const mean = onsets.reduce((a,b)=>a+b,0) / onsets.length;
  const threshold = mean * 2.8;
  const peaks: number[] = [];

  for (let i = 1; i < onsets.length - 1; i++) {
    if (onsets[i] > threshold && onsets[i] >= onsets[i-1] && onsets[i] >= onsets[i+1]) {
      if (peaks.length === 0 || i - peaks[peaks.length-1] > 12) peaks.push(i);
    }
  }

  if (peaks.length < 5) return 0;

  const iois = peaks.slice(1).map((p,i) => (p - peaks[i]) * hopSize * 1000 / sampleRate);
  const valid = iois.filter(d => d > 250 && d < 1500); // plage 40–240 BPM
  if (valid.length < 3) return 0;

  valid.sort((a,b)=>a-b);
  const median = valid[Math.floor(valid.length / 2)];
  return Math.round(60000 / median);
}

function computeSpectrum(signal: Float32Array | number[], N: number): number[] {
  const out: number[] = new Array(N / 2).fill(0);
  for (let k = 0; k < N / 2; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += (signal[n] || 0) * Math.cos(angle);
      im -= (signal[n] || 0) * Math.sin(angle);
    }
    out[k] = Math.sqrt(re * re + im * im);
  }
  return out;
}

function fmtDuration(s: number): string {
  if (s < 60)   return Math.round(s) + 's';
  if (s < 3600) return Math.floor(s/60) + 'min ' + Math.round(s%60) + 's';
  return Math.floor(s/3600) + 'h ' + Math.floor((s%3600)/60) + 'min';
}

// ── PDF text extraction ──────────────────────────────────────────────────────
async function analyzePdf(file: File): Promise<any> {
  const buf   = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let text = '';
  for (let i = 0; i < Math.min(bytes.length, 200000); i++) {
    const c = bytes[i];
    if (c >= 32 && c < 127) text += String.fromCharCode(c);
    else if (c === 10 || c === 13) text += ' ';
  }
  const { category, detail, confidence } = classifyDocText(text.toLowerCase(), 'pdf');
  return { category, subCategory:'PDF', confidence, detail };
}

// ── DOCX text extraction ─────────────────────────────────────────────────────
async function analyzeDocx(file: File): Promise<any> {
  try {
    const buf      = await file.arrayBuffer();
    const unzipped = unzipSync(new Uint8Array(buf));
    const xmlKey   = Object.keys(unzipped).find(k => k === 'word/document.xml');
    if (!xmlKey) throw new Error('No document.xml');
    const xml  = new TextDecoder().decode(unzipped[xmlKey]);
    const text = xml.replace(/<[^>]+>/g, ' ').toLowerCase();
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'docx';
    const { category, detail, confidence } = classifyDocText(text, ext);
    return { category, subCategory: ext.toUpperCase(), confidence, detail };
  } catch {
    return { category:'doc-text', subCategory:'DOCX', confidence:60, detail:'Extraction texte échouée' };
  }
}

// ── OLE (.doc/.xls/.ppt) ─────────────────────────────────────────────────────
async function analyzeOle(file: File, ext: string): Promise<any> {
  if (['xls'].includes(ext)) return { category:'excel',  subCategory:'XLS', confidence:88, detail:'Tableur OLE' };
  if (['ppt'].includes(ext)) return { category:'pptx',   subCategory:'PPT', confidence:88, detail:'Présentation OLE' };
  const buf   = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let text = '';
  for (let i = 0; i < Math.min(bytes.length, 100000); i++) {
    const c = bytes[i];
    if (c >= 32 && c < 127) text += String.fromCharCode(c);
  }
  const { category, detail, confidence } = classifyDocText(text.toLowerCase(), 'doc');
  return { category, subCategory:'DOC', confidence, detail };
}

// ── Classification texte document ────────────────────────────────────────────
function classifyDocText(text: string, ext: string): { category: string; detail: string; confidence: number } {
  const len = text.replace(/\s+/g,' ').trim().length;

  const cvKw      = ['curriculum vitae','cv ','expérience professionnelle','experience professionnelle','compétences','competences','formation','poste occupé','emploi','recrutement','lettre de motivation'];
  const memoireKw = ['introduction','conclusion','chapitre','sommaire','bibliographie','mémoire','memoire','résumé exécutif','plan de thèse','problématique','méthodologie'];
  const lettreKw  = ['madame','monsieur','je me permets','veuillez agréer','cordialement','objet :','destinataire','expéditeur','à l\'attention'];
  const factureKw = ['facture','invoice','montant','tva','ht','ttc','total','règlement','paiement','référence','bon de commande','contrat','signataire'];

  const score = (kws: string[]) => kws.filter(kw => text.includes(kw)).length;
  const cvScore      = score(cvKw);
  const memoireScore = score(memoireKw);
  const lettreScore  = score(lettreKw);
  const factureScore = score(factureKw);
  const best = Math.max(cvScore, memoireScore, lettreScore, factureScore);

  if (best === 0 || len < 200) {
    if (['xlsx','xls'].includes(ext)) return { category:'excel',    detail:'Tableur',         confidence:85 };
    if (['pptx','ppt'].includes(ext)) return { category:'pptx',     detail:'Présentation',    confidence:85 };
    return { category:'doc-text', detail:`Document texte (${Math.round(len/1000)}ko)`, confidence:62 };
  }
  if (cvScore === best)      return { category:'doc-cv',     detail:`Mots-clés CV: ${cvKw.filter(k=>text.includes(k)).slice(0,3).join(', ')}`,            confidence:Math.min(90, 65+cvScore*5) };
  if (memoireScore === best) return { category:'doc-memoir', detail:`Mots-clés académique: ${memoireKw.filter(k=>text.includes(k)).slice(0,3).join(', ')}`,confidence:Math.min(90, 65+memoireScore*5) };
  if (lettreScore === best)  return { category:'doc-lettre', detail:`Mots-clés lettre: ${lettreKw.filter(k=>text.includes(k)).slice(0,3).join(', ')}`,      confidence:Math.min(88, 65+lettreScore*6) };
  if (factureScore === best) return { category:'doc-facture',detail:`Mots-clés facture: ${factureKw.filter(k=>text.includes(k)).slice(0,3).join(', ')}`,    confidence:Math.min(88, 65+factureScore*6) };
  return { category:'doc-text', detail:'Document non catégorisé', confidence:60 };
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
@Component({
  selector: 'app-triage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="tri-page">
  <div class="bg-orb orb1"></div><div class="bg-orb orb2"></div>
  <div class="tri-wrap">

    <div class="hero animate-fade">
      <h1 class="hero-title">Tri intelligent<br><span class="grad">par contenu réel.</span></h1>
      <p class="hero-sub">Analyse multi-frames, détection de tons de peau, BPM, extraction textuelle. Chaque fichier est classé selon ce qu'il contient — pas juste son extension.</p>
      <div class="hero-stats">
        <div class="stat-item"><span class="stat-num">25+</span><span class="stat-lbl">Sous-catégories</span></div>
        <div class="stat-sep"></div>
        <div class="stat-item"><span class="stat-num">Multi-frames · BPM · Peau · Texte</span><span class="stat-lbl">Méthodes d'analyse</span></div>
        <div class="stat-sep"></div>
        <div class="stat-item"><span class="stat-num">100%</span><span class="stat-lbl">Client-side · Aucun envoi</span></div>
      </div>
    </div>

    <div *ngIf="items.length === 0 || showMore" class="upload-card animate-fade">
      <div class="drop-zone" [class.over]="dragging"
           (dragover)="onDragOver($event)" (dragleave)="dragging=false" (drop)="onDrop($event)" (click)="fi.click()">
        <input #fi type="file" class="hidden" multiple (change)="onSel($event)">
        <div class="dz-inner">
          <div class="dz-icon-bg"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
          <p class="dz-title">Déposez vos fichiers ici</p>
          <p class="dz-sub">Analyse profonde du contenu — pas seulement l'extension</p>
          <div class="fmt-grid">
            <span class="fmt-pill video">🎬 Vidéo → Action / Danse / Adulte / Clip / Nature</span>
            <span class="fmt-pill audio">🎵 Audio → Danse (BPM) / Parole / Podcast / Son</span>
            <span class="fmt-pill doc">📄 PDF/Word → CV / Mémoire / Lettre / Facture</span>
            <span class="fmt-pill img">🖼️ Image → Adulte / Logo / Flyer / Photo / Doc</span>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="items.length > 0" class="queue-card animate-fade">
      <div class="queue-head">
        <div>
          <h3 class="queue-title">Analyse en cours</h3>
          <p class="queue-sub">{{ doneCount }} / {{ items.length }} analysés</p>
        </div>
        <div class="queue-actions">
          <button (click)="clearDone()" *ngIf="doneCount>0" class="btn-ghost">Effacer traités</button>
          <button (click)="fi2.click()" class="btn-outline">+ Ajouter</button>
          <input #fi2 type="file" class="hidden" multiple (change)="onSel($event)">
        </div>
      </div>
      <div class="global-progress"><div class="gp-bar" [style.width.%]="(doneCount/items.length)*100"></div></div>
      <div class="file-queue">
        <div *ngFor="let item of items" class="fq-row" [class.analyzing]="item.status==='analyzing'">
          <div class="fq-icon">{{ getFileIcon(item.file) }}</div>
          <div class="fq-info">
            <span class="fq-name" [title]="item.file.name">{{ item.file.name }}</span>
            <span class="fq-meta">{{ fmtSize(item.file.size) }}</span>
          </div>
          <div *ngIf="item.status==='waiting'"   class="fq-state waiting"><span class="wait-dot"></span> En attente</div>
          <div *ngIf="item.status==='analyzing'" class="fq-state analyzing-badge"><span class="scan-ring"></span> Analyse…</div>
          <div *ngIf="item.status==='done'" class="fq-state">
            <div class="cat-badge" [style.background]="hexAlpha(item.color!,.12)" [style.color]="item.color" [style.border-color]="hexAlpha(item.color!,.25)">
              {{ item.icon }} {{ CATS[item.category!]?.label }}
            </div>
            <span class="conf-tag">{{ item.confidence }}%</span>
          </div>
          <div *ngIf="item.status==='error'" class="fq-state err-badge">⚠ Erreur</div>
          <button (click)="removeItem(item.id)" class="fq-rm"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      </div>
    </div>

    <div *ngIf="doneCount > 0" class="gallery-section animate-fade">
      <div class="gal-head">
        <h3 class="gal-title">Résultats d'analyse</h3>
        <div class="gal-filters">
          <button (click)="activeFilter=''" class="filter-btn" [class.active]="activeFilter===''">Tout ({{ doneCount }})</button>
          <button *ngFor="let cat of usedCategories" (click)="activeFilter=cat" class="filter-btn"
                  [class.active]="activeFilter===cat"
                  [style.border-color]="activeFilter===cat ? CATS[cat].color : ''"
                  [style.color]="activeFilter===cat ? CATS[cat].color : ''">
            {{ CATS[cat].icon }} {{ CATS[cat].label }} ({{ countInCat(cat) }})
          </button>
        </div>
      </div>

      <!-- Avertissement si contenu adulte détecté -->
      <div *ngIf="hasAdultContent" class="adult-notice">
        ⚠️ <strong>Note :</strong> La détection de contenu adulte est heuristique (analyse des tons de peau). Des faux positifs sont possibles (plage, sport, médical, etc.).
      </div>

      <div *ngFor="let cat of visibleCategories" class="cat-group">
        <div class="cat-group-header">
          <div class="cat-group-icon" [style.background]="hexAlpha(CATS[cat].color,.12)">{{ CATS[cat].icon }}</div>
          <div>
            <h4 class="cat-group-name">{{ CATS[cat].label }}</h4>
            <span class="cat-group-count">{{ countInCat(cat) }} fichier(s)</span>
          </div>
          <div class="cat-group-bar"><div class="cgb-fill" [style.width.%]="(countInCat(cat)/doneCount)*100" [style.background]="CATS[cat].color"></div></div>
        </div>
        <div class="media-grid">
          <div *ngFor="let item of doneInCat(cat)" class="media-card" [style.border-top-color]="item.color">
            <div class="mc-thumb" [style.background]="hexAlpha(item.color!,.08)"><span class="mc-file-ico">{{ getFileIcon(item.file) }}</span></div>
            <div class="mc-body">
              <p class="mc-name" [title]="item.file.name">{{ item.file.name }}</p>
              <div class="mc-tags">
                <span class="mc-tag" [style.background]="hexAlpha(item.color!,.1)" [style.color]="item.color">{{ item.icon }} {{ item.subCategory }}</span>
                <span class="mc-conf">{{ item.confidence }}%</span>
              </div>
              <span *ngIf="item.detail" class="mc-detail">💡 {{ item.detail }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sort CTA -->
      <div class="sort-action-card">
        <div *ngIf="!folderExporting && !folderDone" class="sa-idle">
          <div class="sa-icon-wrap">📂</div>
          <div class="sa-text">
            <p class="sa-title">Trier dans un dossier</p>
            <p class="sa-sub">Les sous-dossiers sont créés par catégorie détectée.<span class="sa-firefox-note" *ngIf="!hasDirectoryPicker"> Firefox → ZIP avec structure de dossiers.</span></p>
            <div class="sa-preview-folders">
              <span *ngFor="let cat of usedCategories" class="sa-folder-pill" [style.background]="hexAlpha(CATS[cat].color,.12)" [style.color]="CATS[cat].color">
                {{ CATS[cat].icon }} {{ CATS[cat].label }} ({{ countInCat(cat) }})
              </span>
            </div>
          </div>
          <div class="sa-actions">
            <button class="sa-btn-main" (click)="sortFiles()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              {{ hasDirectoryPicker ? 'Choisir dossier & Trier' : 'Télécharger ZIP' }}
            </button>
          </div>
        </div>
        <div *ngIf="folderExporting" class="sa-progress">
          <div class="sa-prog-header"><span class="sa-prog-spinner"></span><span class="sa-prog-label">{{ folderStatus }}</span></div>
          <div class="sa-prog-bar-wrap"><div class="sa-prog-bar" [style.width.%]="folderProgress"></div></div>
          <p class="sa-prog-pct">{{ folderProgress }}%</p>
          <div class="sa-folder-live">
            <div *ngFor="let cat of folderCreated" class="sa-folder-created"><span [style.color]="CATS[cat].color">{{ CATS[cat].icon }}</span><span class="sa-fc-name">{{ CATS[cat].label }}/</span><span class="sa-fc-count">{{ countInCat(cat) }}</span></div>
          </div>
        </div>
        <div *ngIf="folderDone && !folderExporting" class="sa-done">
          <div class="sa-done-check">✅</div>
          <div style="flex:1">
            <p class="sa-done-title">{{ folderStatus }}</p>
            <p class="sa-done-path">📂 {{ folderDestPath }}</p>
            <div class="sa-done-tree">
              <div *ngFor="let cat of folderCreated" class="sa-tree-row"><span class="sa-tree-line">└─</span><span [style.color]="CATS[cat].color">{{ CATS[cat].icon }} {{ CATS[cat].label }}/</span><span class="sa-tree-count">{{ countInCat(cat) }}</span></div>
            </div>
          </div>
          <button class="sa-btn-sec" (click)="resetFolder()">Nouveau tri</button>
        </div>
      </div>
    </div>

  </div>
</div>
  `,
  styles: [`
    :host { display:block; width:100%; font-family:'Inter',sans-serif; }
    .hidden { display:none !important; }
    .tri-page { min-height:calc(100vh - 64px); background:#f8fafc; padding:3rem 1.5rem 5rem; position:relative; overflow:hidden; }
    .bg-orb { position:absolute; border-radius:50%; filter:blur(120px); pointer-events:none; z-index:0; }
    .orb1 { width:600px; height:600px; top:-150px; right:-100px; background:rgba(16,185,129,0.07); }
    .orb2 { width:500px; height:500px; bottom:-100px; left:-100px; background:rgba(99,102,241,0.06); }
    .tri-wrap { max-width:960px; margin:0 auto; position:relative; z-index:1; display:flex; flex-direction:column; gap:2rem; }
    .hero { text-align:center; padding:1rem 0 .5rem; }
    .hero-title { font-size:clamp(1.8rem,4vw,2.8rem); font-weight:900; color:#0f172a; line-height:1.15; margin-bottom:1rem; }
    .grad { background:linear-gradient(135deg,#10b981,#6366f1); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
    .hero-sub { font-size:1rem; color:#64748b; max-width:600px; margin:0 auto 1.5rem; line-height:1.7; }
    .hero-stats { display:flex; align-items:center; justify-content:center; gap:1.5rem; flex-wrap:wrap; }
    .stat-item { text-align:center; } .stat-num { display:block; font-size:.95rem; font-weight:800; color:#0f172a; } .stat-lbl { font-size:.72rem; color:#94a3b8; text-transform:uppercase; letter-spacing:.5px; } .stat-sep { width:1px; height:32px; background:#e2e8f0; }
    .upload-card { background:#fff; border-radius:20px; box-shadow:0 1px 3px rgba(0,0,0,.07),0 8px 24px rgba(0,0,0,.04); overflow:hidden; }
    .drop-zone { border:2.5px dashed #e2e8f0; border-radius:16px; margin:1.25rem; padding:2.5rem 1rem; text-align:center; cursor:pointer; transition:.2s; }
    .drop-zone.over,.drop-zone:hover { border-color:#10b981; background:#f0fdf4; }
    .dz-inner { display:flex; flex-direction:column; align-items:center; gap:.75rem; }
    .dz-icon-bg { width:60px;height:60px;background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:16px;display:flex;align-items:center;justify-content:center;color:#10b981; }
    .dz-title { font-size:1.05rem; font-weight:700; color:#1e293b; } .dz-sub { font-size:.82rem; color:#94a3b8; }
    .fmt-grid { display:flex; flex-wrap:wrap; gap:.5rem; justify-content:center; }
    .fmt-pill { font-size:.72rem; font-weight:600; padding:.25rem .7rem; border-radius:20px; }
    .fmt-pill.video{background:#fee2e2;color:#ef4444;} .fmt-pill.audio{background:#ede9fe;color:#7c3aed;} .fmt-pill.doc{background:#dbeafe;color:#2563eb;} .fmt-pill.img{background:#fef3c7;color:#d97706;}
    .queue-card { background:#fff; border-radius:20px; box-shadow:0 1px 3px rgba(0,0,0,.07),0 8px 24px rgba(0,0,0,.04); padding:1.5rem; }
    .queue-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:1rem; }
    .queue-title { font-size:1rem; font-weight:800; color:#0f172a; margin:0; } .queue-sub { font-size:.8rem; color:#94a3b8; margin:.2rem 0 0; }
    .queue-actions { display:flex; gap:.5rem; }
    .btn-ghost { background:none; border:none; font-size:.78rem; color:#94a3b8; cursor:pointer; padding:.3rem .6rem; border-radius:6px; } .btn-ghost:hover { background:#f1f5f9; }
    .btn-outline { display:flex; align-items:center; gap:.3rem; background:#fff; border:1.5px solid #e2e8f0; color:#374151; font-size:.78rem; font-weight:600; padding:.3rem .7rem; border-radius:8px; cursor:pointer; transition:.15s; } .btn-outline:hover { border-color:#10b981; color:#10b981; }
    .global-progress { height:6px; background:#f1f5f9; border-radius:20px; overflow:hidden; margin-bottom:1rem; }
    .gp-bar { height:100%; background:linear-gradient(90deg,#10b981,#34d399); border-radius:20px; transition:width .4s ease; }
    .file-queue { display:flex; flex-direction:column; gap:.5rem; }
    .fq-row { display:flex; align-items:center; gap:.75rem; padding:.6rem .75rem; border-radius:10px; background:#f8fafc; transition:.15s; }
    .fq-row.analyzing { background:linear-gradient(90deg,#ecfdf5,#f0fdf4); }
    .fq-icon { font-size:1.3rem; flex-shrink:0; } .fq-info { flex:1; min-width:0; }
    .fq-name { display:block; font-size:.82rem; font-weight:600; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:300px; }
    .fq-meta { font-size:.7rem; color:#94a3b8; } .fq-state { display:flex; align-items:center; gap:.5rem; flex-shrink:0; }
    .waiting { font-size:.75rem; color:#94a3b8; } .wait-dot { width:6px;height:6px;border-radius:50%;background:#cbd5e1;animation:pulse 1.5s ease infinite; }
    @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
    .analyzing-badge { font-size:.75rem; color:#10b981; }
    .scan-ring { display:inline-block;width:12px;height:12px;border:2px solid rgba(16,185,129,.25);border-top-color:#10b981;border-radius:50%;animation:spin .7s linear infinite; }
    @keyframes spin { to{transform:rotate(360deg)} }
    .cat-badge { font-size:.72rem; font-weight:700; padding:.2rem .6rem; border-radius:20px; border:1.5px solid; } .conf-tag { font-size:.68rem; color:#94a3b8; }
    .err-badge { font-size:.75rem; color:#ef4444; }
    .fq-rm { background:none; border:none; cursor:pointer; color:#cbd5e1; padding:.2rem; border-radius:4px; display:flex; align-items:center; } .fq-rm:hover { color:#ef4444; background:#fee2e2; }
    .gallery-section { display:flex; flex-direction:column; gap:1.5rem; }
    .gal-head { display:flex; flex-direction:column; gap:.75rem; } .gal-title { font-size:1.1rem; font-weight:800; color:#0f172a; margin:0; }
    .gal-filters { display:flex; flex-wrap:wrap; gap:.4rem; }
    .filter-btn { background:#fff; border:1.5px solid #e2e8f0; color:#64748b; font-size:.75rem; font-weight:600; padding:.3rem .75rem; border-radius:20px; cursor:pointer; transition:.15s; }
    .filter-btn.active,.filter-btn:hover { border-color:currentColor; }
    .adult-notice { background:#fff7ed; border:1.5px solid #fed7aa; border-radius:12px; padding:.75rem 1rem; font-size:.8rem; color:#92400e; line-height:1.55; }
    .cat-group { background:#fff; border-radius:16px; box-shadow:0 1px 3px rgba(0,0,0,.06); overflow:hidden; }
    .cat-group-header { display:flex; align-items:center; gap:.75rem; padding:1rem 1.25rem; border-bottom:1px solid #f1f5f9; }
    .cat-group-icon { width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0; }
    .cat-group-name { font-size:.9rem; font-weight:800; color:#1e293b; margin:0; } .cat-group-count { font-size:.72rem; color:#94a3b8; }
    .cat-group-bar { flex:1; height:4px; background:#f1f5f9; border-radius:20px; overflow:hidden; margin-left:.5rem; } .cgb-fill { height:100%; border-radius:20px; transition:width .6s ease; }
    .media-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:.75rem; padding:1rem 1.25rem; }
    .media-card { border-radius:10px; border:1px solid #f1f5f9; border-top-width:3px; overflow:hidden; background:#fff; transition:.15s; }
    .media-card:hover { box-shadow:0 4px 12px rgba(0,0,0,.08); transform:translateY(-1px); }
    .mc-thumb { height:72px; display:flex; align-items:center; justify-content:center; } .mc-file-ico { font-size:2rem; }
    .mc-body { padding:.6rem .75rem .75rem; }
    .mc-name { font-size:.72rem; font-weight:600; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0 0 .35rem; }
    .mc-tags { display:flex; align-items:center; gap:.35rem; flex-wrap:wrap; margin-bottom:.25rem; }
    .mc-tag { font-size:.65rem; font-weight:700; padding:.15rem .45rem; border-radius:20px; } .mc-conf { font-size:.65rem; color:#94a3b8; }
    .mc-detail { display:block; font-size:.65rem; color:#94a3b8; font-style:italic; margin-top:.2rem; line-height:1.4; }
    .sort-action-card { background:linear-gradient(135deg,#0f172a,#1e293b); border-radius:20px; padding:2rem; }
    .sa-idle { display:flex; align-items:flex-start; gap:1.25rem; flex-wrap:wrap; }
    .sa-icon-wrap { font-size:3rem; flex-shrink:0; margin-top:.25rem; }
    .sa-text { flex:1; min-width:200px; }
    .sa-title { font-size:1.05rem; font-weight:800; color:#fff; margin:0 0 .35rem; }
    .sa-sub { font-size:.82rem; color:#94a3b8; line-height:1.55; margin:0 0 .75rem; }
    .sa-firefox-note { color:#f59e0b; font-weight:600; }
    .sa-preview-folders { display:flex; flex-wrap:wrap; gap:.4rem; }
    .sa-folder-pill { font-size:.72rem; font-weight:700; padding:.2rem .6rem; border-radius:20px; }
    .sa-actions { display:flex; flex-direction:column; gap:.6rem; justify-content:center; flex-shrink:0; }
    .sa-btn-main { display:flex; align-items:center; gap:.5rem; background:linear-gradient(135deg,#10b981,#059669); color:#fff; border:none; border-radius:12px; padding:.75rem 1.4rem; font-size:.88rem; font-weight:800; cursor:pointer; transition:.18s; white-space:nowrap; }
    .sa-btn-main:hover { opacity:.88; transform:translateY(-1px); }
    .sa-btn-sec { background:rgba(255,255,255,.08); color:#cbd5e1; border:1px solid rgba(255,255,255,.15); border-radius:10px; padding:.5rem 1rem; font-size:.78rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:.4rem; transition:.15s; }
    .sa-btn-sec:hover { background:rgba(255,255,255,.14); }
    .sa-progress { display:flex; flex-direction:column; gap:.75rem; }
    .sa-prog-header { display:flex; align-items:center; gap:.75rem; }
    .sa-prog-spinner { width:18px;height:18px;border:2.5px solid rgba(16,185,129,.3);border-top-color:#10b981;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0; }
    .sa-prog-label { font-size:.85rem; color:#e2e8f0; font-weight:600; }
    .sa-prog-bar-wrap { background:rgba(255,255,255,.1); border-radius:20px; height:8px; overflow:hidden; }
    .sa-prog-bar { background:linear-gradient(90deg,#10b981,#34d399); height:100%; border-radius:20px; transition:width .3s ease; }
    .sa-prog-pct { font-size:1.5rem; font-weight:800; color:#10b981; text-align:center; }
    .sa-folder-live { display:flex; flex-direction:column; gap:.3rem; }
    .sa-folder-created { display:flex; align-items:center; gap:.5rem; font-size:.8rem; color:#94a3b8; animation:fadeIn .3s ease; }
    .sa-fc-name { font-weight:700; color:#e2e8f0; } .sa-fc-count { opacity:.6; font-size:.72rem; }
    .sa-done { display:flex; align-items:flex-start; gap:1rem; flex-wrap:wrap; }
    .sa-done-check { font-size:2.5rem; flex-shrink:0; }
    .sa-done-title { font-size:1rem; font-weight:800; color:#10b981; margin:0 0 .25rem; }
    .sa-done-path { font-size:.75rem; color:#64748b; font-family:monospace; margin:0 0 .75rem; }
    .sa-done-tree { display:flex; flex-direction:column; gap:.25rem; }
    .sa-tree-row { display:flex; align-items:center; gap:.5rem; font-size:.8rem; color:#94a3b8; }
    .sa-tree-line { color:#475569; font-family:monospace; } .sa-tree-count { opacity:.6; font-size:.72rem; margin-left:auto; }
    .animate-fade { animation:fadeIn 0.4s ease-out; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  `]
})
export class TriageComponent {
  constructor(private cdr: ChangeDetectorRef) {}

  readonly CATS = CATEGORIES;
  items: MediaFile[] = [];
  dragging = false;
  activeFilter = '';
  showMore = true;
  readonly hasDirectoryPicker = typeof (window as any).showDirectoryPicker === 'function';
  folderExporting = false; folderDone = false; folderProgress = 0;
  folderStatus = ''; folderDestPath = ''; folderCreated: string[] = [];

  get doneCount() { return this.items.filter(i => i.status === 'done').length; }
  get usedCategories() { return [...new Set(this.items.filter(i => i.status === 'done').map(i => i.category!))]; }
  get visibleCategories() { return this.activeFilter ? [this.activeFilter] : this.usedCategories; }
  get hasAdultContent() { return this.items.some(i => i.status === 'done' && (i.category === 'img-adult' || i.category === 'video-adult')); }

  onDragOver(e: DragEvent) { e.preventDefault(); this.dragging = true; }
  onDrop(e: DragEvent) { e.preventDefault(); this.dragging = false; this.addFiles(Array.from(e.dataTransfer?.files ?? [])); }
  onSel(e: any) { this.addFiles(Array.from(e.target.files)); e.target.value = ''; }

  addFiles(files: File[]) {
    this.showMore = false;
    files.forEach(file => {
      const item: MediaFile = { id: crypto.randomUUID(), file, status: 'waiting' };
      this.items.push(item);
      this.analyzeFile(item);
    });
  }

  private analyzeFile(item: MediaFile) {
    item.status = 'analyzing';
    this.cdr.detectChanges();
    analyzeDeep(item.file).then(({ category, subCategory, confidence, detail }) => {
      item.category    = category;
      item.subCategory = subCategory;
      item.confidence  = confidence;
      item.icon        = CATEGORIES[category]?.icon ?? '📦';
      item.color       = CATEGORIES[category]?.color ?? '#94a3b8';
      item.detail      = detail;
      item.status      = 'done';
      this.cdr.detectChanges();
    }).catch(() => { item.status = 'error'; this.cdr.detectChanges(); });
  }

  removeItem(id: string) { this.items = this.items.filter(i => i.id !== id); }
  clearDone() { this.items = this.items.filter(i => i.status !== 'done'); }
  countInCat(cat: string) { return this.items.filter(i => i.status === 'done' && i.category === cat).length; }
  doneInCat(cat: string)  { return this.items.filter(i => i.status === 'done' && i.category === cat); }

  sortFiles() { this.hasDirectoryPicker ? this.exportToFolder() : this.exportAsZip(); }
  resetFolder() { this.folderDone=false; this.folderExporting=false; this.folderProgress=0; this.folderStatus=''; this.folderDestPath=''; this.folderCreated=[]; }

  async exportToFolder() {
    const doneItems = this.items.filter(i => i.status === 'done');
    if (!doneItems.length) return;
    this.folderExporting=true; this.folderDone=false; this.folderProgress=0; this.folderCreated=[];
    this.folderStatus='Sélection du dossier…';
    try {
      const root    = await (window as any).showDirectoryPicker({ mode:'readwrite', startIn:'downloads' });
      this.folderDestPath = root.name;
      const date    = new Date().toISOString().slice(0,10);
      const triDir  = await root.getDirectoryHandle(`MediaTri_${date}`, { create:true });
      this.folderStatus = 'Création des dossiers…';
      const usedCats = [...new Set(doneItems.map(i => i.category!))] as string[];
      const handles: Record<string,any> = {};
      for (const cat of usedCats) {
        handles[cat] = await triDir.getDirectoryHandle(CATEGORIES[cat].label.replace(/[/\\?%*:|"<>]/g,'-'), { create:true });
        this.folderCreated = [...this.folderCreated, cat]; this.cdr.detectChanges();
      }
      const total = doneItems.length; let done = 0;
      for (const item of doneItems) {
        this.folderStatus = `Copie ${done+1}/${total}: ${item.file.name}`;
        let fn = item.file.name;
        try { await handles[item.category!].getFileHandle(fn); fn = Date.now()+'_'+fn; } catch {}
        const fh = await handles[item.category!].getFileHandle(fn, { create:true });
        const w  = await fh.createWritable();
        await w.write(item.file); await w.close();
        done++; this.folderProgress = Math.round((done/total)*100); this.cdr.detectChanges();
      }
      this.folderStatus = `✅ ${total} fichier(s) triés dans ${usedCats.length} dossier(s)`;
      this.folderDestPath = root.name + ' / MediaTri_' + date;
      this.folderDone = true;
    } catch(e:any) { if (e?.name!=='AbortError') { this.folderStatus='❌ '+e?.message; this.folderDone=true; } }
    this.folderExporting = false; this.cdr.detectChanges();
  }

  async exportAsZip() {
    const doneItems = this.items.filter(i => i.status === 'done');
    if (!doneItems.length) return;
    this.folderExporting=true; this.folderDone=false; this.folderProgress=0; this.folderCreated=[];
    this.folderStatus='Préparation du ZIP…';
    try {
      const date     = new Date().toISOString().slice(0,10);
      const root     = `MediaTri_${date}`;
      const files: Record<string,Uint8Array> = {};
      const usedCats = [...new Set(doneItems.map(i => i.category!))] as string[];
      this.folderCreated = [...usedCats];
      const total = doneItems.length; let done = 0;
      for (const item of doneItems) {
        this.folderStatus = `Lecture ${done+1}/${total}: ${item.file.name}`;
        const buf     = await item.file.arrayBuffer();
        const catName = CATEGORIES[item.category!].label.replace(/[/\\?%*:|"<>]/g,'-');
        const path    = `${root}/${catName}/${item.file.name}`;
        files[files[path] ? `${root}/${catName}/${Date.now()}_${item.file.name}` : path] = new Uint8Array(buf);
        done++; this.folderProgress = Math.round((done/total)*100); this.cdr.detectChanges();
      }
      this.folderStatus = 'Génération du ZIP…';
      const zipped = zipSync(files, { level:0 });
      const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(new Blob([zipped],{type:'application/zip'})), download:`${root}.zip` });
      a.click(); URL.revokeObjectURL(a.href);
      this.folderStatus = `✅ ZIP téléchargé — ${total} fichier(s) dans ${usedCats.length} dossier(s)`;
      this.folderDestPath = `${root}.zip`; this.folderDone = true;
    } catch(e:any) { this.folderStatus='❌ '+e?.message; this.folderDone=true; }
    this.folderExporting=false; this.cdr.detectChanges();
  }

  getFileIcon(file: File): string {
    const e = file.name.split('.').pop()?.toLowerCase()??'';
    if (['mp4','mov','avi','mkv','webm','m4v'].includes(e)) return '🎬';
    if (['mp3','wav','flac','ogg','aac','m4a'].includes(e)) return '🎵';
    if (['pdf'].includes(e)) return '📄';
    if (['docx','doc'].includes(e)) return '📝';
    if (['xlsx','xls'].includes(e)) return '📊';
    if (['pptx','ppt'].includes(e)) return '📽️';
    if (['txt','md','csv'].includes(e)) return '📃';
    if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(e)) return '🖼️';
    return '📦';
  }

  fmtSize(b: number): string {
    if (b < 1024) return b+'o';
    if (b < 1_048_576) return (b/1024).toFixed(1)+'Ko';
    return (b/1_048_576).toFixed(1)+'Mo';
  }

  hexAlpha(hex: string, a: number): string {
    const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }
}
