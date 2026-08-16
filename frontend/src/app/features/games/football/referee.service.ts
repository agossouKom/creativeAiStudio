import * as BABYLON from '@babylonjs/core';
import { FOOTBALL_CONFIG } from './football.config';
import { PlayerInstance, BallInstance, MatchState, MatchEvent } from './football.types';

/**
 * Types de remise en jeu
 */
export type RestartType = 'kickoff' | 'throwIn' | 'corner' | 'goalKick' | 'freeKick' | 'penalty' | null;

/** Coup franc direct (faute de contact/main volontaire) vs indirect (ex : passe en retrait au gardien) */
export type RestartKind = 'direct' | 'indirect';

/**
 * Résultat d'une décision arbitrale
 */
export interface RefereeDecision {
  type: RestartType;
  /** Uniquement pertinent pour `type: 'freeKick'` — absent pour les autres types de remise en jeu */
  restartKind?: RestartKind;
  team: 'home' | 'away';
  position: BABYLON.Vector3;
  reason: string;
  card?: 'yellow' | 'red';
  player?: PlayerInstance;
}

/**
 * Service arbitre complet
 * Gère les fautes, cartons, hors-jeu, corners, touches, penalties, coups francs
 */
export class RefereeService {
  private matchState: MatchState;
  private foulCount: { home: number; away: number } = { home: 0, away: 0 };
  private lastDecision: RefereeDecision | null = null;
  private decisionTimer = 0;
  private readonly DECISION_DELAY = 2; // secondes avant reprise
  /** Vrai après le changement de camp à la mi-temps : inverse quelle équipe défend quel côté */
  private sideSwapped = false;

  constructor(matchState: MatchState) {
    this.matchState = matchState;
  }

  setSideSwapped(swapped: boolean): void {
    this.sideSwapped = swapped;
  }

  /** Équipe qui défend le côté Z négatif ('home' normalement, inversé après la mi-temps) */
  private teamDefendingNegativeZ(): 'home' | 'away' {
    return this.sideSwapped ? 'away' : 'home';
  }

  /** Équipe qui défend le côté Z positif ('away' normalement, inversé après la mi-temps) */
  private teamDefendingPositiveZ(): 'home' | 'away' {
    return this.sideSwapped ? 'home' : 'away';
  }

  /**
   * Met à jour le chronomètre des décisions
   */
  update(deltaTime: number): void {
    if (this.decisionTimer > 0) {
      this.decisionTimer -= deltaTime;
    }
  }

  /**
   * Vérifie le hors-jeu
   */
  checkOffside(
    attackingPlayers: PlayerInstance[],
    defendingPlayers: PlayerInstance[],
    ballPos: BABYLON.Vector3,
    attackingDirection: number
  ): PlayerInstance | null {
    if (!FOOTBALL_CONFIG.MATCH.OFFSIDE_ENABLED) return null;

    // Trouver l'avant-dernier défenseur
    const defPositions = defendingPlayers
      .filter(p => !p.isSentOff)
      .map(p => p.body.translation().z)
      .sort((a, b) => attackingDirection > 0 ? b - a : a - b);

    const secondLastDefender = defPositions[1] ?? defPositions[0] ?? 0;

    for (const player of attackingPlayers) {
      if (player.isSentOff || player.config.role === 'gk') continue;

      const playerPos = player.body.translation();

      // L'attaquant est-il dans la moitié adverse ?
      const inOpponentHalf = attackingDirection > 0
        ? playerPos.z > 0
        : playerPos.z < 0;

      if (!inOpponentHalf) continue;

      // L'attaquant est-il plus proche du but que l'avant-dernier défenseur ?
      const isBeyondDefender = attackingDirection > 0
        ? playerPos.z > secondLastDefender
        : playerPos.z < secondLastDefender;

      // L'attaquant est-il plus proche du but que le ballon ?
      const isBeyondBall = attackingDirection > 0
        ? playerPos.z > ballPos.z
        : playerPos.z < ballPos.z;

      if (isBeyondDefender && isBeyondBall) {
        this.matchState.offsides[player.config.teamId]++;
        this.createEvent('hors-jeu', player.config.id, player.config.teamId,
          `🚩 Hors-jeu! ${player.config.name}`);
        return player;
      }
    }

    return null;
  }

  /**
   * Vérifie si une action est une faute
   */
  checkFoul(
    tackler: PlayerInstance,
    ballPos: BABYLON.Vector3,
    isInPenaltyArea: boolean
  ): RefereeDecision | null {
    if (!FOOTBALL_CONFIG.MATCH.FOULS_ENABLED) return null;

    const tacklerPos = tackler.body.translation();
    const dist = Math.sqrt(
      (tacklerPos.x - ballPos.x) ** 2 +
      (tacklerPos.z - ballPos.z) ** 2
    );

    // Tacle trop loin du ballon = faute
    if (dist > FOOTBALL_CONFIG.PLAYER.TACKLE_RANGE + 0.5) {
      const severity = this.determineFoulSeverity(tackler, dist);
      const card = this.checkCard(tackler, severity);
      const isPenalty = isInPenaltyArea;

      this.foulCount[tackler.config.teamId]++;
      this.matchState.fouls[tackler.config.teamId]++;

      const decision: RefereeDecision = {
        type: isPenalty ? 'penalty' : 'freeKick',
        restartKind: 'direct', // faute de contact (tacle) : toujours un coup franc direct (loi 12.1)
        team: tackler.config.teamId === 'home' ? 'away' : 'home',
        position: new BABYLON.Vector3(ballPos.x, 0, ballPos.z),
        reason: `Faute de ${tackler.config.name}`,
        card: card ?? undefined,
        player: tackler,
      };

      if (card) {
        this.applyCard(tackler, card);
      }

      this.lastDecision = decision;
      this.decisionTimer = this.DECISION_DELAY;

      this.createEvent(
        isPenalty ? 'penalty' : 'faute',
        tackler.config.id,
        tackler.config.teamId,
        `${isPenalty ? '🔴 Penalty!' : '🟡 Faute'} - ${tackler.config.name}`
      );

      return decision;
    }

    return null;
  }

  /**
   * Détermine la sévérité d'une faute
   */
  private determineFoulSeverity(player: PlayerInstance, distance: number): 'light' | 'medium' | 'severe' {
    // Tacle par derrière
    const vel = player.body.linvel();
    const isFromBehind = vel.z < -2;

    if (isFromBehind || distance > 3) return 'severe';
    if (distance > 2) return 'medium';
    return 'light';
  }

  /**
   * Vérifie si un carton est nécessaire
   */
  checkCard(player: PlayerInstance, foulSeverity: 'light' | 'medium' | 'severe'): 'yellow' | 'red' | null {
    if (!FOOTBALL_CONFIG.MATCH.YELLOW_CARDS_ENABLED && !FOOTBALL_CONFIG.MATCH.RED_CARDS_ENABLED) return null;

    if (foulSeverity === 'severe') {
      return 'red';
    }

    if (foulSeverity === 'medium' || player.yellowCards >= 1) {
      if (player.yellowCards >= 1) {
        return 'red'; // Second jaune = rouge
      }
      return 'yellow';
    }

    return null;
  }

  /**
   * Applique un carton à un joueur
   */
  applyCard(player: PlayerInstance, card: 'yellow' | 'red'): MatchEvent {
    const event: MatchEvent = {
      type: card === 'yellow' ? 'carton-jaune' : 'carton-rouge',
      time: this.matchState.clock,
      period: this.matchState.period,
      playerId: player.config.id,
      teamId: player.config.teamId,
      description: `${card === 'yellow' ? '🟡 Carton jaune' : '🔴 Carton rouge'} pour ${player.config.name}`,
    };

    if (card === 'yellow') {
      player.yellowCards++;
    } else {
      player.isSentOff = true;
      // Le joueur est expulsé, son corps disparaît
      player.mesh.setEnabled(false);
    }

    this.matchState.events.push(event);
    return event;
  }

  /**
   * Détermine le type de remise en jeu
   */
  determineRestart(
    ballPos: BABYLON.Vector3,
    lastTouch: BallInstance['lastTouch']
  ): RefereeDecision | null {
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const halfW = FOOTBALL_CONFIG.FIELD.WIDTH / 2;

    // But
    if (Math.abs(ballPos.z) > halfL + 0.5) {
      const inGoal = Math.abs(ballPos.x) < FOOTBALL_CONFIG.FIELD.GOAL_WIDTH / 2
        && ballPos.y < FOOTBALL_CONFIG.FIELD.GOAL_HEIGHT;

      if (inGoal) {
        const concedingTeam = ballPos.z > 0 ? this.teamDefendingPositiveZ() : this.teamDefendingNegativeZ();
        return {
          type: 'kickoff',
          team: concedingTeam, // L'équipe qui encaisse engage
          position: BABYLON.Vector3.Zero(),
          reason: 'But!',
        };
      }

      // Corner ou six mètres — l'équipe qui attaque ce but est celle qui NE le défend PAS
      if (lastTouch) {
        const attackingTeam = ballPos.z > 0 ? this.teamDefendingNegativeZ() : this.teamDefendingPositiveZ();
        if (lastTouch.teamId === attackingTeam) {
          // Six mètres pour l'équipe qui défend
          const defendingTeam = attackingTeam === 'home' ? 'away' : 'home';
          const goalZ = defendingTeam === this.teamDefendingNegativeZ() ? -halfL : halfL;
          return {
            type: 'goalKick',
            team: defendingTeam,
            position: new BABYLON.Vector3(0, 0, goalZ + 5),
            reason: 'Six mètres',
          };
        } else {
          // Corner pour l'équipe qui attaque
          const cornerX = ballPos.x > 0 ? halfW : -halfW;
          const cornerZ = ballPos.z > 0 ? halfL : -halfL;
          this.matchState.corners[attackingTeam]++;
          return {
            type: 'corner',
            team: attackingTeam,
            position: new BABYLON.Vector3(cornerX, 0, cornerZ),
            reason: 'Corner',
          };
        }
      }
    }

    // Touche
    if (Math.abs(ballPos.x) > halfW) {
      const team = lastTouch?.teamId === 'home' ? 'away' : 'home';
      const touchZ = BABYLON.Scalar.Clamp(ballPos.z, -halfL, halfL);
      const touchX = ballPos.x > 0 ? halfW : -halfW;
      return {
        type: 'throwIn',
        team: team || 'home',
        position: new BABYLON.Vector3(touchX, 0, touchZ),
        reason: 'Touche',
      };
    }

    return null;
  }

  /**
   * Passe en retrait illégale (loi 12.2) : le gardien ne peut pas prendre le ballon à la
   * main s'il lui a été volontairement joué au pied par un coéquipier juste avant. Coup
   * franc INDIRECT pour l'adversaire, à l'endroit où le gardien a pris le ballon.
   */
  awardBackPassOffense(goalkeeper: PlayerInstance, ballPos: BABYLON.Vector3): RefereeDecision {
    const decision: RefereeDecision = {
      type: 'freeKick',
      restartKind: 'indirect',
      team: goalkeeper.config.teamId === 'home' ? 'away' : 'home',
      position: ballPos,
      reason: `Passe en retrait illégale (${goalkeeper.config.name})`,
    };
    this.lastDecision = decision;
    this.decisionTimer = this.DECISION_DELAY;
    this.createEvent('faute', goalkeeper.config.id, goalkeeper.config.teamId,
      `🥅 Passe en retrait au gardien — coup franc indirect`);
    return decision;
  }

  /**
   * Amplitude maximale du balancement de bras pendant la course normale (voir
   * player.service.ts syncPositions : min(0.7, ...) * 0.8 ≈ 0.56 rad max). Au-delà,
   * un bras est manifestement écarté du corps — main volontaire plutôt que position
   * naturelle. Approximation raisonnable en l'absence de hitbox dédiée aux mains.
   */
  private readonly NATURAL_ARM_SWING_MAX = 0.75;

  /**
   * Détecte un contact bras/ballon (distance à hauteur d'épaule) et distingue position
   * naturelle (bras dans l'amplitude de course normale) de main volontaire (bras levé
   * au-delà de cette amplitude).
   *
   * Depuis le passage au modèle Mixamo animé, `armPivots` sont de vrais os du squelette
   * (cf. player.service.ts) : `Bone.getAbsolutePosition()` sans le mesh lié ne compose PAS
   * avec le pivot du joueur (position/échelle) et donnerait une position hors-monde
   * incorrecte. On approxime donc la position des bras par le centre du joueur + une
   * hauteur d'épaule (mise à l'échelle courante via `mesh.scaling`), et on ne garde des
   * os que la rotation locale (toujours valide) pour distinguer bras levé/naturel —
   * approximation raisonnable en l'absence de hitbox dédiée aux mains (déjà le cas avant).
   */
  checkHandball(player: PlayerInstance, ballPos: BABYLON.Vector3): { isDeliberate: boolean } | null {
    const shoulderHeight = 1.4 * player.mesh.scaling.y;
    const shoulderPos = player.mesh.getAbsolutePosition().add(new BABYLON.Vector3(0, shoulderHeight, 0));
    const dist = Math.sqrt(
      (shoulderPos.x - ballPos.x) ** 2 + (shoulderPos.y - ballPos.y) ** 2 + (shoulderPos.z - ballPos.z) ** 2
    );
    if (dist < 0.4) {
      const raised = player.armPivots.some(b => Math.abs(b.rotation.x) > this.NATURAL_ARM_SWING_MAX);
      return { isDeliberate: raised };
    }
    return null;
  }

  /** Main volontaire : coup franc DIRECT, ou penalty si dans la surface (loi 12.1) */
  awardHandball(player: PlayerInstance, ballPos: BABYLON.Vector3, isInPenaltyArea: boolean): RefereeDecision {
    this.matchState.fouls[player.config.teamId]++;
    const decision: RefereeDecision = {
      type: isInPenaltyArea ? 'penalty' : 'freeKick',
      restartKind: 'direct',
      team: player.config.teamId === 'home' ? 'away' : 'home',
      position: ballPos,
      reason: `Main volontaire de ${player.config.name}`,
    };
    this.lastDecision = decision;
    this.decisionTimer = this.DECISION_DELAY;
    this.createEvent(
      isInPenaltyArea ? 'penalty' : 'faute',
      player.config.id,
      player.config.teamId,
      `${isInPenaltyArea ? '🔴 Penalty !' : '✋ Main volontaire'} - ${player.config.name}`
    );
    return decision;
  }

  /**
   * Positions du mur défensif à 9,15m (10 yards) du ballon, sur la ligne ballon→but, pour
   * un coup franc (direct ou indirect) proche du but défendu par `defendingTeam`. Le
   * nombre de joueurs augmente à mesure que le coup franc se rapproche du but.
   */
  getWallPositions(ballPos: BABYLON.Vector3, ownGoalZ: number, availableDefenders: number): BABYLON.Vector3[] {
    const toGoal = new BABYLON.Vector3(0 - ballPos.x, 0, ownGoalZ - ballPos.z);
    const distToGoal = Math.sqrt(toGoal.x * toGoal.x + toGoal.z * toGoal.z);
    // Trop loin du but pour menacer directement : pas besoin de mur (coup franc dans son propre camp)
    if (distToGoal < 1 || distToGoal > 40) return [];

    const dir = new BABYLON.Vector3(toGoal.x / distToGoal, 0, toGoal.z / distToGoal);
    const perp = new BABYLON.Vector3(-dir.z, 0, dir.x);
    const wallCenter = ballPos.add(dir.scale(FOOTBALL_CONFIG.FIELD.PENALTY_ARC_RADIUS)); // 9.15m

    const wallCount = Math.max(0, Math.min(availableDefenders, distToGoal < 18 ? 4 : distToGoal < 30 ? 3 : 2));
    const spacing = 0.9;
    const positions: BABYLON.Vector3[] = [];
    for (let i = 0; i < wallCount; i++) {
      const offset = (i - (wallCount - 1) / 2) * spacing;
      positions.push(wallCenter.add(perp.scale(offset)));
    }
    return positions;
  }

  /**
   * Calcule la position de remise en jeu pour un coup franc
   */
  getFreeKickPosition(decision: RefereeDecision): BABYLON.Vector3 {
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const halfW = FOOTBALL_CONFIG.FIELD.WIDTH / 2;

    // Limiter la position dans le terrain
    return new BABYLON.Vector3(
      BABYLON.Scalar.Clamp(decision.position.x, -halfW + 2, halfW - 2),
      0,
      BABYLON.Scalar.Clamp(decision.position.z, -halfL + 2, halfL - 2)
    );
  }

  /**
   * Calcule la position de penalty
   */
  getPenaltyPosition(attackingTeam: 'home' | 'away'): BABYLON.Vector3 {
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    // Le point de penalty est du côté du but adverse (celui que l'équipe attaquante ne défend pas)
    const opponentDefendsNegativeZ = this.teamDefendingNegativeZ() !== attackingTeam;
    const z = opponentDefendsNegativeZ
      ? -halfL + FOOTBALL_CONFIG.FIELD.PENALTY_SPOT_DISTANCE
      : halfL - FOOTBALL_CONFIG.FIELD.PENALTY_SPOT_DISTANCE;
    return new BABYLON.Vector3(0, 0, z);
  }

  /**
   * Vérifie si une position est dans la surface de réparation
   */
  isInPenaltyArea(position: BABYLON.Vector3, team: 'home' | 'away'): boolean {
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const penaltyCenterZ = team === this.teamDefendingNegativeZ() ? -halfL : halfL;
    const halfWidth = FOOTBALL_CONFIG.FIELD.PENALTY_AREA_WIDTH / 2;
    const halfLength = FOOTBALL_CONFIG.FIELD.PENALTY_AREA_LENGTH;

    return Math.abs(position.x) < halfWidth
      && Math.abs(position.z - penaltyCenterZ) < halfLength;
  }

  /**
   * Crée un événement de match
   */
  createEvent(type: MatchEvent['type'], playerId: number | undefined, teamId: 'home' | 'away', description: string): MatchEvent {
    const event: MatchEvent = {
      type,
      time: this.matchState.clock,
      period: this.matchState.period,
      playerId,
      teamId,
      description,
    };
    this.matchState.events.push(event);
    return event;
  }

  /**
   * Met à jour les statistiques du match
   */
  updateStats(type: 'shot' | 'foul' | 'corner' | 'offside', teamId: 'home' | 'away', onTarget: boolean = false): void {
    switch (type) {
      case 'shot':
        this.matchState.shots[teamId]++;
        if (onTarget) this.matchState.shotsOnTarget[teamId]++;
        break;
      case 'foul':
        this.matchState.fouls[teamId]++;
        break;
      case 'corner':
        this.matchState.corners[teamId]++;
        break;
      case 'offside':
        this.matchState.offsides[teamId]++;
        break;
    }
  }

  /**
   * Récupère la dernière décision
   */
  getLastDecision(): RefereeDecision | null {
    return this.lastDecision;
  }

  /**
   * Efface la dernière décision
   */
  clearDecision(): void {
    this.lastDecision = null;
    this.decisionTimer = 0;
  }

  /**
   * Vérifie si une décision est en cours
   */
  hasActiveDecision(): boolean {
    return this.decisionTimer > 0;
  }

  /**
   * Récupère le nombre de fautes
   */
  getFoulCount(): { home: number; away: number } {
    return { ...this.foulCount };
  }
}
