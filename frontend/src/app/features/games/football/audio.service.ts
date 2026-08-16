/**
 * Moteur audio du jeu de football.
 *
 * Effets et ambiance basés sur de vrais enregistrements (sifflet, frappe, foule,
 * musique d'avant-match — cf. src/assets/football/audio/, CREDITS.md), chargés une
 * fois via Web Audio API (`decodeAudioData`) et mixés à travers le même `masterGain`
 * que les effets synthétisés — conservés en repli si un fichier n'a pas fini de charger
 * (l'AudioContext ne peut démarrer qu'après un geste utilisateur, cf. unlock()). Le
 * commentaire est fait par la synthèse vocale native du navigateur (SpeechSynthesis),
 * pas une voix enregistrée.
 */
export type CrowdMood = 'calme' | 'energique' | 'festif' | 'hostile';

const AUDIO_BASE = 'assets/football/audio/';
const AUDIO_FILES: Record<string, string> = {
  whistle: 'whistle.mp3',
  kick: 'kick.mp3',
  crowdAmbiance1: 'crowd-ambiance-1.mp3',
  crowdAmbiance2: 'crowd-ambiance-2.mp3',
  crowdChant: 'crowd-chant.mp3',
  crowdCheer: 'crowd-cheer.mp3',
  crowdCheerStrong: 'crowd-cheer-strong.mp3',
  anthemHype: 'anthem-hype.mp3',
  anthemLatin: 'anthem-latin.mp3',
};

export class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private crowdSource: AudioBufferSourceNode | null = null;
  private anthemSource: AudioBufferSourceNode | null = null;

  private buffers = new Map<string, AudioBuffer>();
  private loadingStarted = false;

  private commentatorId = 'none';
  private commentatorLang = 'fr-FR';

  /** À appeler depuis un geste utilisateur (clic) : l'AudioContext ne démarre pas sans ça */
  unlock(): void {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);

    this.preloadAll();
  }

  /** Charge tous les fichiers réels une seule fois (fire-and-forget : tant qu'un son
   * n'a pas fini de charger, la méthode correspondante retombe sur la version
   * synthétisée — cf. playBuffer()). */
  private preloadAll(): void {
    if (this.loadingStarted || !this.ctx) return;
    this.loadingStarted = true;
    Object.entries(AUDIO_FILES).forEach(async ([key, file]) => {
      try {
        const res = await fetch(AUDIO_BASE + file);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx!.decodeAudioData(arr);
        this.buffers.set(key, buf);
      } catch {
        // Fichier indisponible : le repli synthétisé (déjà en place) reste utilisé
      }
    });
  }

  /** Joue un buffer chargé une seule fois (one-shot), à travers masterGain.
   * @returns faux si le buffer n'est pas (encore) disponible — l'appelant doit alors
   * utiliser son repli synthétisé. */
  private playBuffer(key: string, gain = 1, rate = 1): boolean {
    const buf = this.buffers.get(key);
    if (!this.ctx || !this.masterGain || !buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.masterGain);
    src.start();
    return true;
  }

  setCommentator(id: string, language: string): void {
    this.commentatorId = id;
    this.commentatorLang = language === 'English' ? 'en-US' : language === 'Español' ? 'es-ES' : 'fr-FR';
  }

  // ─── Effets ────────────────────────────────────────────────────────────

  private lastWhistleAt = 0;

  /**
   * Bug corrigé : `whistle.mp3` fourni est en réalité un pack de ~7 coups de
   * sifflet différents concaténés sur 20s (silences détectés entre chacun),
   * pas un seul son court — `playBuffer` le jouait donc en ENTIER à chaque
   * appel, et comme `playWhistle()` est appelé plusieurs fois par match (coup
   * d'envoi, fautes, buts...), les lectures se chevauchaient en un mélange de
   * sons différents ("siffle n'importe quoi" signalé). Fichier remplacé par un
   * unique extrait propre (~0,7s, un seul coup) — voir CREDITS.md. Garde-fou
   * ajouté en plus : un appel à moins de 300ms du précédent est ignoré, pour
   * ne jamais superposer deux lectures même avec des évènements rapprochés.
   */
  playWhistle(long = false): void {
    const now = performance.now();
    if (now - this.lastWhistleAt < 300) return;
    this.lastWhistleAt = now;

    if (this.playBuffer('whistle', 0.85)) {
      // Coup de sifflet final : un second coup peu après, comme un vrai double coup
      if (long && this.ctx) {
        setTimeout(() => this.playBuffer('whistle', 0.85), 350);
      }
      return;
    }
    this.playSynthWhistle(long);
  }

  private playSynthWhistle(long: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const t0 = this.ctx.currentTime;
    const duration = long ? 0.9 : 0.25;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2200, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.3, t0 + 0.02);
    gain.gain.setValueAtTime(0.3, t0 + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, t0 + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration);
  }

  playKick(power: number): void {
    // Léger aléa de hauteur pour éviter l'effet "copié-collé" à chaque frappe
    if (this.playBuffer('kick', Math.min(0.9, 0.35 + power / 30), 0.92 + Math.random() * 0.16)) return;
    this.playSynthKick(power);
  }

  private playSynthKick(power: number): void {
    if (!this.ctx || !this.masterGain) return;
    const t0 = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.12);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700 + power * 20;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.6, 0.15 + power / 30), t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t0);
    noise.stop(t0 + 0.15);
  }

  playCard(type: 'yellow' | 'red'): void {
    if (!this.ctx || !this.masterGain) return;
    const t0 = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const startFreq = type === 'red' ? 180 : 260;
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.5, t0 + 0.4);
    gain.gain.setValueAtTime(0.22, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  }

  playGoalHorn(): void {
    if (!this.ctx || !this.masterGain) return;
    const t0 = this.ctx.currentTime;

    [0, 0.15, 0.3].forEach((delay, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440 + i * 110, t0 + delay);
      gain.gain.setValueAtTime(0.28, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.5);
    });

    this.playCrowdBurst();
  }

  /** Acclamation légère (occasion manquée de peu, arrêt du gardien...) — plus discrète
   * que la liesse d'un but (cf. playGoalHorn/playCrowdBurst). */
  playNearMissCheer(): void {
    this.playBuffer('crowdCheer', 0.5);
  }

  /** Chant de tribune ponctuel (possession prolongée, temps fort du match) */
  playChant(): void {
    this.playBuffer('crowdChant', 0.45);
  }

  private playCrowdBurst(): void {
    if (this.playBuffer('crowdCheerStrong', 0.75)) return;
    if (!this.ctx || !this.masterGain) return;
    const t0 = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(2.5, true);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.5, t0 + 0.3);
    gain.gain.linearRampToValueAtTime(0, t0 + 2.5);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t0);
    src.stop(t0 + 2.5);
  }

  // ─── Ambiance de foule continue ────────────────────────────────────────

  startCrowdAmbiance(style: CrowdMood, fillRatio: number): void {
    if (!this.ctx || !this.masterGain) return;
    this.stopCrowdAmbiance();

    const base = { calme: 0.05, energique: 0.12, festif: 0.16, hostile: 0.14 }[style] ?? 0.08;
    const volume = base * Math.max(0.3, Math.min(1, fillRatio));

    // Boucle réelle : ambiance "chant"/festive pour energique/festif/hostile,
    // ambiance générique de stade pour calme.
    const bufferKey = style === 'calme' ? 'crowdAmbiance2' : 'crowdAmbiance1';
    const buf = this.buffers.get(bufferKey);
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      src.connect(gain);
      gain.connect(this.masterGain);
      src.start();
      this.crowdSource = src;
      return;
    }

    // Repli synthétisé si le fichier n'a pas fini de charger
    const src = this.ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(4, true);
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = style === 'hostile' ? 700 : style === 'festif' ? 1100 : 850;
    filter.Q.value = 0.5;

    const gain = this.ctx.createGain();
    gain.gain.value = volume;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start();

    this.crowdSource = src;
  }

  stopCrowdAmbiance(): void {
    try { this.crowdSource?.stop(); } catch { /* déjà arrêté */ }
    this.crowdSource = null;
  }

  // ─── Musique d'avant-match ──────────────────────────────────────────────

  /**
   * Lancée sur l'écran Récapitulatif (avant le coup d'envoi), arrêtée automatiquement
   * au coup d'envoi (cf. stopPreMatchAnthem()) — choix du morceau selon l'ambiance des
   * tribunes déjà réglée (pas de nouveau réglage dédié : festif → hymne rock
   * énergique, énergique/hostile → boucle latine entraînante, calme → aucune musique,
   * l'ambiance de foule douce suffit).
   */
  playPreMatchAnthem(crowdStyle: CrowdMood): void {
    if (!this.ctx || !this.masterGain || crowdStyle === 'calme') return;
    const key = crowdStyle === 'festif' ? 'anthemHype' : 'anthemLatin';
    const buf = this.buffers.get(key);
    if (!buf) return;

    this.stopPreMatchAnthem();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.35;
    src.connect(gain);
    gain.connect(this.masterGain);
    src.start();
    this.anthemSource = src;
  }

  stopPreMatchAnthem(): void {
    try { this.anthemSource?.stop(); } catch { /* déjà arrêté */ }
    this.anthemSource = null;
  }

  private createNoiseBuffer(durationSeconds: number, smooth = false): AudioBuffer {
    const sampleRate = this.ctx!.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * durationSeconds));
    const buffer = this.ctx!.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = smooth ? last * 0.98 + white * 0.02 : white;
      data[i] = last;
    }
    return buffer;
  }

  // ─── Commentaire (synthèse vocale native, pas de voix enregistrée) ────

  speak(text: string): void {
    if (this.commentatorId === 'none' || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // ne pas empiler les phrases si l'action va vite
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.commentatorLang;
    utterance.rate = 1.05;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  dispose(): void {
    this.stopCrowdAmbiance();
    this.stopPreMatchAnthem();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
  }
}
