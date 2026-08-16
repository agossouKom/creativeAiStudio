import * as BABYLON from '@babylonjs/core';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { PlayerRole, FormationKey, DifficultyKey } from './football.config';

// ─── Équipe ──────────────────────────────────────────────────────────────
export interface TeamColors {
  primary: { r: number; g: number; b: number };
  secondary: { r: number; g: number; b: number };
  keeper: { r: number; g: number; b: number };
  skin: { r: number; g: number; b: number };
}

export interface TeamConfig {
  id: 'home' | 'away';
  name: string;
  colors: TeamColors;
  formation: FormationKey;
  difficulty: DifficultyKey;
}

// ─── Joueur ──────────────────────────────────────────────────────────────
export interface PlayerConfig {
  id: number;
  teamId: 'home' | 'away';
  name: string;
  number: number;
  role: PlayerRole;
  // Stats
  speed: number;
  acceleration: number;
  shotPower: number;
  passAccuracy: number;
  defense: number;
  stamina: number;
  maxStamina: number;
  // Position initiale (formation)
  initialX: number;
  initialZ: number;
  /** Porte le brassard de capitaine (choisi à l'écran de composition) */
  isCaptain?: boolean;
}

export interface PlayerInstance {
  config: PlayerConfig;
  mesh: BABYLON.Mesh;
  body: RAPIER.RigidBody;
  // Animation
  targetPosition: BABYLON.Vector3;
  currentVelocity: BABYLON.Vector3;
  isSprinting: boolean;
  isTackling: boolean;
  tackleCooldown: number;
  hasBall: boolean;
  /** Anneau jaune au sol sous le porteur du ballon, togglable (menu contextuel) */
  ballCarrierRing: BABYLON.Mesh;
  /** Cône bleu au-dessus de la tête, visible quand ce joueur est la cible de passe
   * actuellement sélectionnée (L1, en possession du ballon) — cf. cyclePassTarget(). */
  passTargetMarker: BABYLON.Mesh;
  /** Vrai après une "prise de contrôle" délibérée du ballon (bouton "3" au premier
   * contact) — distinct de `hasBall` (simple proximité/contact physique, mis à jour en
   * continu pour TOUS les joueurs). `hasBall` seul ne suffit pas à décider si "3" doit
   * contrôler le ballon ou le passer : sans cette distinction, "3" déclenchait une passe
   * instantanée dès le premier contact, avant même que le joueur ait pu "sentir" le
   * ballon sous son pied. Repasse à faux dès que `hasBall` redevient faux (cf.
   * checkBallCollisions()) ou après une passe/tir/passe en profondeur/centre. */
  ballControlled: boolean;
  /** Temps restant (s) où l'anneau reste affiché après avoir perdu le ballon — un simple
   * contact (`hasBall`) ne dure parfois qu'une fraction de seconde (le ballon est aussitôt
   * repoussé/tiré), trop bref pour être perçu sans ce court "maintien" visuel. */
  ringLingerTimer: number;
  /** Anti-spam : délai avant la prochaine décision de tir/passe de l'IA pour ce joueur */
  ballActionCooldown: number;
  /** Os des cuisses/bras du squelette Mixamo (mixamorig5:*UpLeg / *Arm), utilisés par le
   * détecteur de main (referee.service.ts) — plus des pivots procéduraux dédiés, ce sont
   * maintenant les vrais os du modèle animé. */
  legPivots: BABYLON.Bone[];
  armPivots: BABYLON.Bone[];
  /** Clips d'animation de ce joueur (clonés indépendamment par instantiateModelsToScene),
   * indexés par nom ('Idle', 'Run', 'Sprint', 'Tackle', 'Pass', 'Shoot', 'GK_Catch', ...). */
  animationGroups: Record<string, BABYLON.AnimationGroup>;
  /** Nom du clip actuellement joué en boucle (état de base courant, hors one-shot) */
  currentAnimName: string;
  /** Clip vers lequel revenir au repos (ballon perdu, vitesse ~0) : 'GK_Idle' pour les
   * gardiens, sinon 'Idle' ou 'IdleOffensive' — choisi par joueur (cf. createPlayer) pour
   * que tous les joueurs sans ballon n'affichent pas exactement la même pose/chorégraphie. */
  idleAnimName: string;
  /** Minuteur d'un one-shot en cours (tacle/passe/tir/...) : tant que > 0, le state-machine
   * de base (Idle/Run/Sprint) ne reprend pas la main. */
  oneShotTimer: number;
  // État
  yellowCards: number;
  isSentOff: boolean;
  isInjured: boolean;
}

// ─── Ballon ──────────────────────────────────────────────────────────────
export interface BallInstance {
  mesh: BABYLON.Mesh;
  body: RAPIER.RigidBody;
  /** `viaKick` : vrai uniquement pour une passe/tir volontaire (E/Espace, ou décision IA
   *  shouldPass/shouldShoot) — distingue une passe délibérée d'un simple contact/rebond,
   *  utilisé pour la règle de la passe en retrait au gardien (loi 12.2) */
  lastTouch: { playerId: number; teamId: 'home' | 'away'; viaKick?: boolean } | null;
  isInPlay: boolean;
  spin: BABYLON.Vector3;
}

// ─── Match ───────────────────────────────────────────────────────────────
export type MatchPeriod = '1ère' | '2ème' | 'mi-temps' | 'prolongation-1' | 'prolongation-2' | 'penalties' | 'fini';
export type MatchEventType = 'but' | 'tir' | 'passe' | 'tacle' | 'faute' | 'carton-jaune' | 'carton-rouge' | 'corner' | 'touche' | 'six-metres' | 'coup-franc' | 'penalty' | 'hors-jeu';

export interface MatchEvent {
  type: MatchEventType;
  time: number;
  period: MatchPeriod;
  playerId?: number;
  teamId: 'home' | 'away';
  description: string;
}

export interface MatchState {
  period: MatchPeriod;
  clock: number;           // secondes écoulées dans la période
  halfDuration: number;    // durée de la mi-temps en secondes
  /** Temps additionnel accumulé (but, faute/carton...) dans la période en cours, en secondes */
  stoppageSeconds: number;
  score: { home: number; away: number };
  events: MatchEvent[];
  isPaused: boolean;
  isGoalScored: boolean;
  goalScoredTeam: 'home' | 'away' | null;
  goalScoredTimer: number;
  possession: { home: number; away: number }; // pourcentage
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  fouls: { home: number; away: number };
  corners: { home: number; away: number };
  offsides: { home: number; away: number };
}

// ─── État du jeu ─────────────────────────────────────────────────────────
export type GameState = 'menu' | 'formation' | 'kickoff' | 'playing' | 'halftime' | 'fulltime' | 'extratime' | 'penalties' | 'finished';

export interface FootballGameState {
  gameState: GameState;
  match: MatchState;
  homeTeam: TeamConfig;
  awayTeam: TeamConfig;
  homePlayers: PlayerInstance[];
  awayPlayers: PlayerInstance[];
  ball: BallInstance | null;
  controlledPlayer: PlayerInstance | null;
  selectedFormation: FormationKey;
  difficulty: DifficultyKey;
}

// ─── Événements de contrôle ──────────────────────────────────────────────
export interface PlayerInput {
  moveX: number;       // -1 à 1
  moveZ: number;       // -1 à 1
  sprint: boolean;
  kick: boolean;
  pass: boolean;
  /** Centre/passe longue vers l'avant (manette : bouton "2", contextuel — tacle si le
   * joueur contrôlé n'a pas le ballon, cf. pollGamepad()) */
  crossLong: boolean;
  /** Passe en profondeur (manette : bouton "1") — cible le coéquipier le plus avancé,
   * pas nécessairement le plus proche. */
  passDeep: boolean;
  tackle: boolean;
  switchPlayer: boolean;
  pause: boolean;
}

// ─── Résultat du match ───────────────────────────────────────────────────
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
}
