import * as BABYLON from '@babylonjs/core';
import { FOOTBALL_CONFIG } from './football.config';
import { MatchState, MatchPeriod, MatchEvent, PlayerInstance, BallInstance } from './football.types';

/**
 * Service de gestion du match
 * Gère le temps, les périodes, les prolongations, les tirs au but
 */
export class MatchService {
  private matchState: MatchState;
  private extraTimePlayed = false;
  private penaltyShootout: { home: number; away: number } = { home: 0, away: 0 };
  private penaltyRound = 0;
  private currentPenaltyTaker: 'home' | 'away' = 'home';
  private onMatchEnd?: (result: MatchResult) => void;
  private onPeriodChange?: (period: MatchPeriod) => void;
  private onPenaltyResult?: (team: 'home' | 'away', scored: boolean) => void;

  constructor(matchState: MatchState) {
    this.matchState = matchState;
  }

  /**
   * Configure les callbacks
   */
  setCallbacks(callbacks: {
    onMatchEnd?: (result: MatchResult) => void;
    onPeriodChange?: (period: MatchPeriod) => void;
    onPenaltyResult?: (team: 'home' | 'away', scored: boolean) => void;
  }): void {
    this.onMatchEnd = callbacks.onMatchEnd;
    this.onPeriodChange = callbacks.onPeriodChange;
    this.onPenaltyResult = callbacks.onPenaltyResult;
  }

  /**
   * Met à jour le chronomètre
   */
  update(deltaTime: number): void {
    if (this.matchState.isPaused || this.matchState.isGoalScored) return;

    this.matchState.clock += deltaTime;

    // Vérifier la fin de période
    this.checkPeriodEnd();
  }

  /**
   * Vérifie si la période est terminée
   */
  private checkPeriodEnd(): void {
    const clock = this.matchState.clock;
    // Le temps additionnel (but, faute/carton) prolonge la période avant de la clore
    const halfDuration = this.matchState.halfDuration + this.matchState.stoppageSeconds;

    if (clock >= halfDuration) {
      switch (this.matchState.period) {
        case '1ère':
          this.endFirstHalf();
          break;
        case '2ème':
          this.endSecondHalf();
          break;
        case 'prolongation-1':
          this.endExtraFirstHalf();
          break;
        case 'prolongation-2':
          this.endMatch();
          break;
      }
    }
  }

  /**
   * Fin de la première mi-temps
   */
  private endFirstHalf(): void {
    this.matchState.period = 'mi-temps';
    this.matchState.clock = 0;
    this.matchState.stoppageSeconds = 0;
    this.onPeriodChange?.('mi-temps');
  }

  /**
   * Démarre la deuxième mi-temps
   */
  startSecondHalf(): void {
    this.matchState.period = '2ème';
    this.matchState.clock = 0;
    this.matchState.stoppageSeconds = 0;
    this.onPeriodChange?.('2ème');
  }

  /**
   * Fin de la deuxième mi-temps
   */
  private endSecondHalf(): void {
    // Vérifier si prolongations nécessaires
    if (this.matchState.score.home === this.matchState.score.away) {
      this.startExtraTime();
    } else {
      this.endMatch();
    }
  }

  /**
   * Démarre les prolongations
   */
  private startExtraTime(): void {
    this.matchState.period = 'prolongation-1';
    this.matchState.clock = 0;
    this.matchState.stoppageSeconds = 0;
    this.matchState.halfDuration = FOOTBALL_CONFIG.MATCH.EXTRA_TIME_HALF;
    this.extraTimePlayed = true;
    this.onPeriodChange?.('prolongation-1');
  }

  /**
   * Fin de la première prolongation
   */
  private endExtraFirstHalf(): void {
    this.matchState.period = 'mi-temps';
    this.matchState.clock = 0;
    this.matchState.stoppageSeconds = 0;
    this.onPeriodChange?.('mi-temps');
  }

  /**
   * Démarre la deuxième prolongation
   */
  startExtraSecondHalf(): void {
    this.matchState.period = 'prolongation-2';
    this.matchState.clock = 0;
    this.matchState.stoppageSeconds = 0;
    this.onPeriodChange?.('prolongation-2');
  }

  /**
   * Fin du match
   */
  private endMatch(): void {
    // Vérifier si égalité après prolongations → tirs au but (une seule fois : si les tirs
    // au but sont déjà en cours, le score règlementaire reste égal par définition, donc on
    // ne doit pas relancer une séance quand executePenalty() rappelle endMatch())
    if (this.matchState.period !== 'penalties' && this.matchState.score.home === this.matchState.score.away && this.extraTimePlayed) {
      this.startPenaltyShootout();
    } else {
      this.matchState.period = 'fini';
      this.onMatchEnd?.(this.getResult());
    }
  }

  /**
   * Démarre les tirs au but
   */
  private startPenaltyShootout(): void {
    this.matchState.period = 'penalties';
    this.penaltyRound = 0;
    this.penaltyShootout = { home: 0, away: 0 };
    this.currentPenaltyTaker = 'home';
    this.onPeriodChange?.('penalties');
  }

  /**
   * Exécute un tir au but
   */
  executePenalty(team: 'home' | 'away', scored: boolean): void {
    if (this.matchState.period !== 'penalties') return;

    if (scored) {
      this.penaltyShootout[team]++;
    }

    this.onPenaltyResult?.(team, scored);

    // Alterner les tireurs
    this.currentPenaltyTaker = this.currentPenaltyTaker === 'home' ? 'away' : 'home';

    // Si le tour actuel est terminé
    if (this.currentPenaltyTaker === 'home') {
      this.penaltyRound++;
    }

    // Vérifier si les tirs au but sont terminés
    if (this.penaltyRound >= FOOTBALL_CONFIG.MATCH.PENALTY_ROUNDS) {
      if (this.penaltyShootout.home !== this.penaltyShootout.away) {
        this.endMatch();
      }
      // Si égalité, continuer en mort subite
    }
  }

  /**
   * Récupère le résultat du match
   */
  getResult(): MatchResult {
    return {
      homeScore: this.matchState.score.home,
      awayScore: this.matchState.score.away,
      homeTeam: 'FC Blue',
      awayTeam: 'FC Red',
      events: this.matchState.events,
      possession: { ...this.matchState.possession },
      shots: { ...this.matchState.shots },
      shotsOnTarget: { ...this.matchState.shotsOnTarget },
      fouls: { ...this.matchState.fouls },
      corners: { ...this.matchState.corners },
      manOfTheMatch: this.findManOfTheMatch(),
      duration: this.matchState.clock,
      penaltyScore: this.matchState.period === 'penalties' || this.matchState.period === 'fini'
        ? { ...this.penaltyShootout }
        : undefined,
    };
  }

  /**
   * Trouve le meilleur joueur du match
   */
  private findManOfTheMatch(): string {
    // Logique simple: le joueur qui a marqué le dernier but
    const lastGoal = [...this.matchState.events].reverse().find(e => e.type === 'but');
    return lastGoal?.playerId ? `Joueur #${lastGoal.playerId}` : 'Inconnu';
  }

  /**
   * Récupère l'état du match
   */
  getState(): MatchState {
    return this.matchState;
  }

  /**
   * Récupère le score des tirs au but
   */
  getPenaltyScore(): { home: number; away: number } {
    return { ...this.penaltyShootout };
  }
}

export interface MatchResult {
  homeScore: number;
  awayScore: number;
  homeTeam: string;
  awayTeam: string;
  events: MatchEvent[];
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  fouls: { home: number; away: number };
  corners: { home: number; away: number };
  manOfTheMatch: string;
  duration: number;
  penaltyScore?: { home: number; away: number };
}
