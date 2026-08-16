import { Component, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as BABYLON from '@babylonjs/core';
import * as RAPIER from '@dimforge/rapier3d-compat';
import nipplejs from 'nipplejs';
import {
  FOOTBALL_CONFIG, FormationKey, DifficultyKey,
  STADIUMS, StadiumOption, BALLS, BallOption, WEATHER_OPTIONS, WeatherKey,
  COMMENTATORS, CommentatorOption, CROWD_STYLES, CrowdStyleOption,
  SUBSTITUTION_OPTIONS, MATCH_DURATIONS, DurationOption,
  PLAYER_SIZE_OPTIONS, PlayerSizeOption, CAMERA_PRESETS, CameraPreset
} from './football.config';
import { FootballGameState, MatchState, MatchPeriod, PlayerInput, TeamConfig, PlayerInstance, BallInstance } from './football.types';
import { StadiumService } from './stadium.service';
import { PlayerService } from './player.service';
import { CrowdService } from './crowd.service';
import { BallService } from './ball.service';
import { AIService } from './ai.service';
import { RefereeService, RefereeDecision } from './referee.service';
import { MatchService, MatchResult } from './match.service';
import { AudioService, CrowdMood } from './audio.service';
import { GameChromeService } from '../../../services/game-chrome.service';
import { TEAMS_DATA, TeamData, PlayerData } from './teams.data';
import { GamepadDiagramComponent } from './gamepad-diagram.component';
import {
  getCountryFlag, deriveExtendedAttributes, ExtendedPlayerAttributes,
  getTeamJerseys, JerseyOption, computeTeamAttributes, TeamAggregateAttributes
} from './roster-meta';

/** État de composition d'équipe pour l'écran "Configuration et classement" */
interface TeamRosterState {
  roster: PlayerData[];         // 22 joueurs : index 0-10 = titulaires, 11-21 = remplaçants
  formationIndex: number;       // index dans allFormations
  selectedIndex: number | null; // ligne dont le menu contextuel est ouvert
  substitutionsUsed: number;
  captainNumber: number;        // numéro de maillot du capitaine (brassard), choisi ici
}

/** Réglages d'avant-match, partagés par les deux équipes et verrouillés dès le coup d'envoi */
interface MatchSettings {
  substitutionsAllowed: number;
  stadiumId: string;
  ballId: string;
  weather: WeatherKey;
  dayNight: 'jour' | 'nuit';
  commentatorId: string;
  crowdStyleId: string;
  durationId: string;
  showPlayerLabels: boolean;
  playerSizeId: string;
}

/** Un instantané de positions pour le tampon de ralenti/revoir le but */
interface ReplayFrame {
  ball: { x: number; y: number; z: number };
  players: { id: number; teamId: 'home' | 'away'; x: number; z: number; rotY: number }[];
}

@Component({
  selector: 'app-football',
  standalone: true,
  imports: [CommonModule, FormsModule, GamepadDiagramComponent],
  templateUrl: './football.component.html',
  styleUrls: ['./football.component.css']
})
export class FootballComponent implements OnInit, OnDestroy {
  @ViewChild('renderCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('joystickZone', { static: true }) joystickZoneRef!: ElementRef<HTMLDivElement>;
  @ViewChild('previewCanvas', { static: true }) previewCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('contextMenuEl') contextMenuElRef?: ElementRef<HTMLDivElement>;
  @ViewChild('pauseModalEl') pauseModalElRef?: ElementRef<HTMLDivElement>;
  @ViewChild('menuOptionsEl') menuOptionsElRef?: ElementRef<HTMLDivElement>;
  @ViewChild('tutorialMenuEl') tutorialMenuElRef?: ElementRef<HTMLDivElement>;
  @ViewChild('teamSelectEl') teamSelectElRef?: ElementRef<HTMLDivElement>;
  @ViewChild('teamDetailModalEl') teamDetailModalElRef?: ElementRef<HTMLDivElement>;
  @ViewChild('formationEl') formationElRef?: ElementRef<HTMLDivElement>;
  @ViewChild('settingsEl') settingsElRef?: ElementRef<HTMLDivElement>;
  @ViewChild('recapEl') recapElRef?: ElementRef<HTMLDivElement>;

  constructor(private gameChrome: GameChromeService, private ngZone: NgZone) {
    // Démarré ici plutôt qu'en fin de ngOnInit() : ngOnInit est async et commence par
    // `await RAPIER.init()` (moteur physique WASM) sans aucun try/catch dans tout le
    // fichier — si cette initialisation échoue ou traîne (WASM bloqué, lent au premier
    // chargement...), tout ce qui suit dans ngOnInit, pollMenuGamepad() y compris,
    // n'est simplement jamais atteint : la manette resterait alors muette sur l'écran
    // menu SANS AUCUNE erreur visible ("même en appuyant sur une touche, rien ne se
    // passe"). pollMenuGamepad() ne dépend ni de RAPIER ni de Babylon (juste du DOM/de
    // la Gamepad API), donc rien ne l'empêche de démarrer indépendamment, tout de suite.
    this.pollMenuGamepad();
  }

  // Babylon
  private engine!: BABYLON.Engine;
  private scene!: BABYLON.Scene;
  private camera!: BABYLON.ArcRotateCamera;

  // Aperçu 3D du stade sélectionné, affiché en arrière-plan des écrans de préparation
  // (sélection d'équipe, composition, réglages, récap) — moteur partagé avec le match
  // (créé une seule fois dans ngOnInit), mais scène/caméra/service dédiés, jetés avant
  // le vrai coup d'envoi pour laisser la place à la scène de match.
  private previewEngine!: BABYLON.Engine;
  private previewScene: BABYLON.Scene | null = null;
  private previewCamera: BABYLON.ArcRotateCamera | null = null;
  private previewStadiumService: StadiumService | null = null;
  private previewRenderLoopStarted = false;

  // Rapier
  private world!: RAPIER.World;

  // Services
  private stadiumService!: StadiumService;
  private playerService!: PlayerService;
  private crowdService!: CrowdService;
  private ballService!: BallService;
  private aiServiceHome!: AIService;
  private aiServiceAway!: AIService;
  private refereeService!: RefereeService;
  private matchService!: MatchService;
  private audioService!: AudioService;

  // État du jeu
  gameState!: FootballGameState;
  input: PlayerInput = {
    moveX: 0, moveZ: 0, sprint: false,
    kick: false, pass: false, crossLong: false, passDeep: false, tackle: false,
    switchPlayer: false, pause: false
  };

  /** Coéquipier actuellement choisi comme destinataire de la prochaine passe courte —
   * construction du jeu : en possession du ballon, L1/Q fait défiler les coéquipiers
   * proches (cyclePassTarget()) au lieu de changer de joueur contrôlé, pour choisir
   * délibérément À QUI passer plutôt que de subir la cible "la plus proche" calculée. */
  private selectedPassTarget: PlayerInstance | null = null;

  // UI - Écrans
  showMenu = true;
  showTutorialCards = false;
  showTeamSelect = false;
  showFormation = false;
  showSettings = false;
  showRecap = false;
  showMatch = false;
  showResult = false;

  /** Exercice choisi sur la page Tutoriel (cartes), lancé automatiquement une fois la
   * scène de match prête (cf. launchPendingExercise(), appelée en fin de startMatch()). */
  private pendingExercise: string | null = null;

  /**
   * Catalogue des ateliers du Tutoriel. `enabled: false` = affiché mais désactivé
   * ("Bientôt"), en attendant une vraie mécanique/scénario dédié (ex: tir en finesse
   * vs puissant, tacle glissé, contrôle orienté... n'existent pas encore comme actions
   * distinctes du tir/tacle génériques). `scenario` est null pour les ateliers qui
   * n'ont pas de mise en scène propre (le tir libre est déjà l'état par défaut).
   */
  readonly tutorialExercises: { id: string; title: string; description: string; icon: string; enabled: boolean }[] = [
    { id: 'guided',   title: 'Prise en main guidée', description: 'Pas-à-pas des commandes de base, une action à la fois.', icon: '🧭', enabled: true },
    { id: 'shoot',    title: 'Tir libre',             description: 'Tire au but face à un gardien, à ton rythme.',           icon: '🎯', enabled: true },
    { id: 'penalty',  title: 'Penalty',               description: 'Tireur face au gardien, en situation de penalty.',       icon: '⚽', enabled: true },
    { id: 'freekick', title: 'Coup franc',            description: 'Mur de défenseurs, tir à 22 mètres du but.',              icon: '🧱', enabled: true },
    { id: 'passshort',title: 'Passe courte',          description: 'Trouve un coéquipier proche.',                          icon: '➡️', enabled: true },
    { id: 'passlong', title: 'Passe longue',          description: 'Envoie un ballon en profondeur.',                       icon: '🎯', enabled: true },
    { id: 'cross',    title: 'Centre',                description: 'Centre depuis le côté vers la surface adverse.',        icon: '↗️', enabled: true },
    { id: 'tackle',   title: 'Tacle',                 description: 'Récupère le ballon sur un attaquant adverse.',           icon: '🛑', enabled: true },
    { id: 'sprint',   title: 'Course / Sprint',       description: 'Rejoins le ballon le plus vite possible.',               icon: '🏃', enabled: true },
    { id: 'fullmatch',title: 'Match complet',         description: 'Quitte le tutoriel et lance un vrai match.',             icon: '🏟️', enabled: true },
    { id: 'dribble',       title: 'Conduite de balle',   description: 'Contrôle le ballon et slalome entre les piquets.', icon: '⚽', enabled: true },
    { id: 'finesse',       title: 'Tir en finesse',      description: 'Bientôt disponible.', icon: '🎯', enabled: false },
    { id: 'powershot',     title: 'Tir puissant',        description: 'Bientôt disponible.', icon: '💥', enabled: false },
    { id: 'corner',        title: 'Corner',              description: 'Bientôt disponible.', icon: '🚩', enabled: false },
    { id: 'throwin',       title: 'Touche',              description: 'Bientôt disponible.', icon: '🤾', enabled: false },
    { id: 'goalkeeper',    title: 'Gardien',             description: 'Bientôt disponible.', icon: '🧤', enabled: false },
    { id: 'orientedctrl',  title: 'Contrôle orienté',    description: 'Bientôt disponible.', icon: '🎛️', enabled: false },
    { id: 'defense',       title: 'Défense',             description: 'Bientôt disponible.', icon: '🛡️', enabled: false },
    { id: 'slidetackle',   title: 'Tacle glissé',        description: 'Bientôt disponible.', icon: '🛷', enabled: false },
    { id: 'pressing',      title: 'Pressing',            description: 'Bientôt disponible.', icon: '🔥', enabled: false },
    { id: 'switchplayer',  title: 'Changement de joueur',description: 'Choisis un coéquipier (L1) et enchaîne les passes.', icon: '🔄', enabled: true },
    { id: 'duel1v1',       title: 'Duel 1 contre 1',     description: 'Bientôt disponible.', icon: '⚔️', enabled: false },
    { id: 'minimatch',     title: 'Mini-match',          description: 'Bientôt disponible.', icon: '🥅', enabled: false },
  ];

  // Données des équipes
  allTeams: TeamData[] = TEAMS_DATA;
  filteredTeams: TeamData[] = [];
  selectedCategory: 'club' | 'national' | 'all' = 'all';
  selectedHomeTeam: TeamData | null = null;
  selectedAwayTeam: TeamData | null = null;
  searchQuery = '';

  /** Mode entraînement : une seule équipe à choisir (pour apprendre/s'entraîner) — l'adversaire
   * est auto-assigné à la confirmation pour ne pas dupliquer le flux de match habituel. */
  trainingMode = false;

  // Attributs / drapeaux / maillots affichés après sélection d'une équipe
  homeAttributes: TeamAggregateAttributes | null = null;
  awayAttributes: TeamAggregateAttributes | null = null;
  homeJerseys: JerseyOption[] = [];
  awayJerseys: JerseyOption[] = [];
  selectedHomeJersey: JerseyOption | null = null;
  selectedAwayJersey: JerseyOption | null = null;
  getCountryFlag = getCountryFlag;

  // Configuration et classement (feuille de match : formation, composition, réglages)
  allFormations: FormationKey[] = Object.keys(FOOTBALL_CONFIG.FORMATIONS) as FormationKey[];
  homeRosterState!: TeamRosterState;
  awayRosterState!: TeamRosterState;
  stadiums: StadiumOption[] = STADIUMS;
  balls: BallOption[] = BALLS;
  weatherOptions = WEATHER_OPTIONS;
  commentators: CommentatorOption[] = COMMENTATORS;
  crowdStyles: CrowdStyleOption[] = CROWD_STYLES;
  substitutionOptions: number[] = SUBSTITUTION_OPTIONS;
  matchDurations: DurationOption[] = MATCH_DURATIONS;
  playerSizeOptions: PlayerSizeOption[] = PLAYER_SIZE_OPTIONS;
  cameraPresets: CameraPreset[] = CAMERA_PRESETS;
  matchSettings: MatchSettings = {
    substitutionsAllowed: 3,
    stadiumId: STADIUMS[0].id,
    ballId: BALLS[0].id,
    weather: 'soleil',
    dayNight: 'jour',
    commentatorId: COMMENTATORS[0].id,
    crowdStyleId: CROWD_STYLES[0].id,
    durationId: 'courte',
    showPlayerLabels: true,
    playerSizeId: PLAYER_SIZE_OPTIONS[0].id,
  };
  matchStarted = false;
  substitutionFlowActive = false;
  private matchStartersHome: PlayerData[] = [];
  private matchStartersAway: PlayerData[] = [];

  // Pause en jeu
  showPauseModal = false;

  // Verrouillage de la caméra (évite la rotation accidentelle du stade en jeu)
  viewLocked = true;

  /** Vrai après le changement de camp à la mi-temps (les 2 équipes inversent le but qu'elles défendent) */
  private sideSwapped = false;

  // Menu contextuel (clic droit) : pause, verrouillage caméra, quitter
  contextMenuVisible = false;
  contextMenuX = 0;
  contextMenuY = 0;
  contextCameraOpen = false;

  /** Index (dans getMenuFocusables()) de l'item actuellement en surbrillance à la
   * manette — partagé entre le menu contextuel et le modal pause, un seul des deux
   * étant navigable à la fois (cf. getActiveMenuRoot()). */
  private menuFocusIndex = 0;
  /** Front montant manuel pour les axes du stick gauche en navigation de menu (pas de
   * "bouton" à surveiller via gamepadPrevButtons ici) : évite qu'un stick maintenu
   * fasse défiler/ouvrir plusieurs crans par seconde au lieu d'un cran par pression. */
  private menuAxisHeld = { up: false, down: false, left: false, right: false };

  /** Même principe que menuFocusIndex/menuAxisHeld, mais pour les écrans d'avant-match
   * (galerie d'ateliers, sélection des équipes, composition/classement, réglages,
   * récapitulatif — cf. getActiveStepRoot()) : grilles/zones plus riches qu'un simple
   * menu vertical, navigation par plus-proche-voisin géométrique (findNearestFocusable)
   * plutôt que l'incrément simple utilisé pour les menus contextuel/pause/principal. */
  private stepFocusIndex = 0;
  private stepAxisHeld = { up: false, down: false, left: false, right: false };
  /** Détecte un changement d'écran (l'utilisateur peut y arriver par de nombreux
   * chemins différents — Confirmer, Retour, ouverture d'un remplacement en cours de
   * match...) pour remettre stepFocusIndex à zéro automatiquement, sans avoir à modifier
   * individuellement chaque méthode de transition d'écran. */
  private lastStepRoot: HTMLElement | null = null;

  // Ajustement en direct de la taille des joueurs (visuel uniquement, cf. player.service.ts)
  playerSizeMultiplier = 1;
  private readonly PLAYER_SIZE_MULTIPLIER_MIN = 0.6;
  private readonly PLAYER_SIZE_MULTIPLIER_MAX = 2;
  private readonly PLAYER_SIZE_MULTIPLIER_STEP = 0.15;

  // Vitesse du jeu (multiplie deltaTime avant qu'il n'atteigne la logique de jeu ET
  // le pas de la simulation physique, cf. startGameLoop() — un seul réglage affecte
  // donc uniformément le chronomètre, les déplacements et la physique, sans les
  // désynchroniser les uns des autres).
  contextSpeedOpen = false;
  gameSpeedMultiplier = 1;
  readonly GAME_SPEED_MIN = 0.25;
  readonly GAME_SPEED_MAX = 2;
  readonly gameSpeedPresets: { label: string; value: number }[] = [
    { label: 'Très lent', value: 0.4 },
    { label: 'Lent', value: 0.7 },
    { label: 'Normal', value: 1 },
    { label: 'Rapide', value: 1.4 },
    { label: 'Très rapide', value: 2 },
  ];

  /** Vrai pendant la mise en place d'un coup franc (mur défensif) : gèle le jeu comme une célébration de but */
  private setPieceActive = false;

  /** Chant de tribune ponctuel (ambiance), décompté dans updateGame() — intervalle
   * aléatoire pour ne pas sonner "programmé". */
  private chantTimer = 45 + Math.random() * 30;

  /** Auto-play : l'IA prend aussi en charge le joueur normalement humain (les deux équipes s'affrontent seules) */
  autoPlayEnabled = false;

  // ─── Tutoriel guidé (pas-à-pas des contrôles, carte "Prise en main guidée") ────
  /** Vrai entre le clic sur "Tutoriel guidé" et le vrai coup d'envoi (le match doit
   * encore démarrer : composition, réglages, récap...) — converti en `tutorialActive`
   * une fois `startMatch()` réellement atteint. */
  tutorialPending = false;
  tutorialActive = false;
  tutorialStepIndex = 0;
  readonly tutorialSteps: { title: string; description: string; kbd: string; pad: string; padHighlight: string; check: (i: PlayerInput) => boolean }[] = [
    { title: 'Déplacement', description: 'Déplacez-vous sur la pelouse.', kbd: 'W A S D', pad: 'Stick gauche / croix directionnelle', padHighlight: 'dpad', check: (i) => Math.abs(i.moveX) > 0.3 || Math.abs(i.moveZ) > 0.3 },
    { title: 'Sprint', description: 'Accélérez en sprintant.', kbd: 'Shift', pad: 'R1', padHighlight: 'r1', check: (i) => i.sprint },
    { title: 'Changer de joueur', description: 'Prenez le contrôle du joueur le plus proche du ballon.', kbd: 'Q', pad: 'L1', padHighlight: 'l1', check: (i) => i.switchPlayer },
    { title: 'Passe courte', description: 'Approchez-vous du ballon puis faites une passe courte à un coéquipier proche.', kbd: 'E', pad: 'Bouton "3" (avec le ballon)', padHighlight: 'btn3', check: (i) => i.pass },
    { title: 'Passe en profondeur', description: 'Envoyez un ballon "dans la course" d\'un attaquant plus avancé.', kbd: 'T', pad: 'Bouton "1"', padHighlight: 'btn1', check: (i) => i.passDeep },
    { title: 'Centre', description: 'Depuis une position excentrée, centrez vers la surface adverse.', kbd: 'C', pad: 'Bouton "2" (avec le ballon)', padHighlight: 'btn2', check: (i) => i.crossLong },
    { title: 'Tir', description: 'Tirez au but quand vous êtes proche du ballon.', kbd: 'Espace', pad: 'Bouton "4"', padHighlight: 'btn4', check: (i) => i.kick },
    { title: 'Tacle', description: 'Tentez de récupérer le ballon sur un adversaire.', kbd: 'F', pad: 'Bouton "2"/"3" (sans le ballon)', padHighlight: 'btn2', check: (i) => i.tackle },
  ];

  get tutorialCurrentStep() {
    return this.tutorialSteps[this.tutorialStepIndex] ?? null;
  }

  /** Avance le tutoriel si l'action attendue vient d'être détectée — appelée en tout
   * premier dans handlePlayerInput(), AVANT que les indicateurs one-shot (kick/pass/...)
   * ne soient consommés et remis à faux par les gestionnaires d'action. */
  private advanceTutorialIfNeeded(): void {
    if (!this.tutorialActive) return;
    const step = this.tutorialCurrentStep;
    if (!step || !step.check(this.input)) return;
    this.tutorialStepIndex++;
    if (this.tutorialStepIndex >= this.tutorialSteps.length) {
      this.tutorialActive = false;
    }
  }

  skipTutorial(): void {
    this.tutorialActive = false;
  }

  /** Trajectoire visuelle du ballon (traînée) sur tir/passe, désactivable */
  ballTrailEnabled = true;

  /** Noms/numéros au-dessus de la tête de TOUS les joueurs (pas seulement le sélectionné/porteur), togglable en jeu */
  showAllPlayerLabels = true;

  /** Petit cercle jaune au sol sous le porteur du ballon, togglable en jeu */
  showBallCarrierRing = true;

  /** Équipe dont la composition/formation est affichée à l'écran pendant la révélation d'avant-match */
  revealingTeam: 'home' | 'away' | null = null;

  /** Dernière équipe ayant engagé (coup d'envoi initial, après un but, mi-temps...) —
   * l'équipe adverse engage la période suivante (alternance réelle des règles du foot) */
  private lastKickoffTeam: 'home' | 'away' = 'home';
  /** Les 2 joueurs placés côte à côte au rond central pour le vrai coup d'envoi
   * (cf. setupKickoffPair/triggerKickoffPass) */
  private kickoffPair: { taker: PlayerInstance; receiver: PlayerInstance } | null = null;
  /** Mannequins statiques du mode Entraînement (dribble/tacle), à nettoyer avec la scène */
  private trainingDummies: BABYLON.Mesh[] = [];

  /** Stade phare (tribunes ovales complètes, écrans géants) : débloque des options supplémentaires en jeu */
  isPremiumStadium = false;
  /** "Terrain seul" (menu contextuel) : masque les tribunes/toit/projecteurs */
  pitchOnlyMode = false;

  // Modale d'aide "Comment jouer" (menu contextuel)
  showHelpModal = false;

  // Célébration de but : minuteur annulable (pour pouvoir la stopper depuis le menu contextuel)
  private goalCelebrationTimeout: ReturnType<typeof setTimeout> | null = null;

  // Ralenti/revoir le but marqué : tampon glissant des positions récentes
  private replayBuffer: ReplayFrame[] = [];
  private readonly REPLAY_BUFFER_MAX_FRAMES = 240; // ~4s à 60 fps
  private lastGoalReplay: ReplayFrame[] | null = null;
  private replayFrameIndex = 0;
  replayActive = false;
  private replayPlaybackTimer: ReturnType<typeof setInterval> | null = null;

  // Étiquettes de nom/numéro au-dessus des joueurs (sélectionné / porteur du ballon)
  labelPlayers: { id: number; text: string; x: number; y: number; teamId: 'home' | 'away'; highlight: boolean }[] = [];

  /** Radar (mini-carte) en bas de l'écran : positions des joueurs/ballon, togglable en jeu */
  showRadar = true;
  radarDots: { x: number; y: number; teamId: 'home' | 'away' | 'ball'; highlight: boolean }[] = [];

  /** Preset de caméra actif (mise en avant visuelle dans le menu contextuel) */
  activeCameraPresetId = 'end2end';
  /** 'player' (Vue joueur) pilote directement alpha/target chaque frame plutôt que de
   * suivre le ballon comme les presets "orbit" classiques — cf. updateCamera() */
  private activeCameraMode: 'orbit' | 'player' = 'orbit';
  /** Zoom dynamique du preset "Dynamique (Télé)" — null pour tous les autres presets */
  private dynamicZoomRange: { min: number; max: number } | null = null;

  // Configuration
  selectedDifficulty: DifficultyKey = 'medium';
  matchScore = { home: 0, away: 0 };
  matchClock = '00:00';
  matchPeriod = '1ère';
  matchEvents: string[] = [];
  possessionHome = 50;
  possessionAway = 50;
  matchStats = { home: { shots: 0, shotsOnTarget: 0, fouls: 0, corners: 0 },
                 away: { shots: 0, shotsOnTarget: 0, fouls: 0, corners: 0 } };
  resultText = '';
  goalNotification = '';
  goalNotificationVisible = false;
  refereeNotification = '';
  refereeNotificationVisible = false;
  penaltyScore = { home: 0, away: 0 };
  showControlsHint = true;

  // Tirs au but jouables : viser + puissance (tireur humain) / plonger (gardien humain)
  penaltyPhase: 'idle' | 'aiming' | 'keeper' | 'resolving' = 'idle';
  penaltyAimX = 0;   // -1 (gauche) à 1 (droite)
  penaltyAimY = 0.4; // 0 (ras du sol) à 1 (lucarne)
  penaltyPower = 0;  // 0 à 1
  penaltyCharging = false;
  private penaltyShooterTeam: 'home' | 'away' = 'home';
  private aiPenaltyAimX = 0;
  private aiPenaltyAimY = 0.5;
  private penaltyKeeperTimeout: ReturnType<typeof setTimeout> | null = null;

  // ─── Menu d'entraînement (panneau pliable/dépliable) ────────────────────
  // Remplace l'ancienne carte de rappel des touches, fixe et non repliable :
  // même panneau, mais replié par défaut (juste un onglet) et réutilisé en
  // mode Entraînement pour choisir un exercice ciblé plutôt que de laisser
  // uniquement l'entraînement libre (gardien + mannequins) par défaut.
  controlsHintExpanded = false;
  /** Null = pas d'exercice ciblé choisi (entraînement libre par défaut) */
  trainingScenario: 'penalty' | 'freekick' | 'tackle' | 'passes' | 'running' | 'dribble' | 'switchplayer' | null = null;
  /** Vrai pendant un penalty d'ENTRAÎNEMENT (répétitions libres, hors séance de tirs
   * au but d'un vrai match) — resolvePenalty() bifurque vers un traitement allégé
   * (pas de score de match, relance automatique du même exercice). */
  private penaltyTrainingActive = false;
  private penaltyTrainingRole: 'shooter' | 'keeper' = 'shooter';

  private animationFrameId: number | null = null;
  /** Boucle dédiée (démarrée dans ngOnInit, indépendante de startGameLoop) pour la
   * navigation manette de l'écran menu principal, cf. pollMenuGamepad(). */
  private menuGamepadFrameId: number | null = null;
  private keysPressed: Set<string> = new Set();

  // Manette (Gamepad API standard) : stick gauche + A/B/X/Y/Start
  private gamepadWasMoving = false;
  private gamepadPrevButtons: boolean[] = [];
  /** Statut manette affiché dans le panneau replié (nom + connectée/débranchée, une
   * entrée par manette si plusieurs sont branchées en même temps) */
  connectedGamepadNames: string[] = [];
  gamepadConnected = false;
  /** Bouton actuellement enfoncé, pour mettre en surbrillance le schéma <app-gamepad-diagram> */
  gamepadHighlight: string | null = null;

  /** Jauges de puissance de tir (bas gauche = domicile, bas droite = extérieur),
   * mises à jour chaque frame par updateShotPowerGauges() — null quand personne de ce
   * camp n'a le ballon (jauge masquée côté template). */
  homeShotPowerCarrier: { name: string; number: number; pct: number } | null = null;
  awayShotPowerCarrier: { name: string; number: number; pct: number } | null = null;

  // Contrôles tactiles (nipplejs)
  private joystickManager: ReturnType<typeof nipplejs.create> | null = null;

  get isTouchDevice(): boolean {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }

  async ngOnInit(): Promise<void> {
    await RAPIER.init();
    this.initEngine();
    this.initPreviewScene();
    this.showMenu = true;
    this.filterTeams();

    if (this.isTouchDevice) {
      this.initJoystick();
    }
  }

  ngOnDestroy(): void {
    this.disposeGame();
    this.disposePreviewScene();
    this.audioService?.dispose();
    this.joystickManager?.destroy();
    this.gameChrome.showHeader();
    if (this.menuGamepadFrameId !== null) {
      cancelAnimationFrame(this.menuGamepadFrameId);
      this.menuGamepadFrameId = null;
    }
    if (this.engine) {
      this.engine.dispose();
    }
    if (this.previewEngine) {
      this.previewEngine.dispose();
    }
  }

  /** Joystick virtuel (déplacement) pour les écrans tactiles — les boutons d'action sont dans le template */
  private initJoystick(): void {
    this.joystickManager = nipplejs.create({
      zone: this.joystickZoneRef.nativeElement,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'white',
      size: 100,
    });

    this.joystickManager.on('move', (evt) => {
      if (!evt.data.vector) return;

      // Tirs au but : le joystick pilote la visée (ou mémorise la direction pour le
      // plongeon du gardien), pas le déplacement normal — même logique que les
      // flèches au clavier (voir onKeyDown)
      if (this.penaltyPhase === 'aiming') {
        this.penaltyAimX = Math.max(-1, Math.min(1, evt.data.vector.x));
        this.penaltyAimY = Math.max(0, Math.min(1, (evt.data.vector.y + 1) / 2));
        return;
      }
      if (this.penaltyPhase === 'keeper') {
        this.touchKeeperDiveDir = evt.data.vector.x;
        return;
      }

      // Même correction de mappage que le clavier/manette (cf. onKeyDown) : l'axe
      // horizontal du joystick pilote Z (horizontal à l'écran), l'axe vertical pilote X.
      this.input.moveZ = evt.data.vector.x;
      this.input.moveX = -evt.data.vector.y; // le joystick a le nord en haut, le terrain avance en +z
    });

    this.joystickManager.on('end', () => {
      if (this.penaltyPhase === 'aiming' || this.penaltyPhase === 'keeper') return;
      this.input.moveX = 0;
      this.input.moveZ = 0;
    });
  }

  /** Dernière direction horizontale du joystick tactile, utilisée pour le plongeon du gardien (tirs au but) */
  private touchKeeperDiveDir = 0;

  // ─── Boutons d'action tactiles (appelés depuis le template) ───────────

  touchSprint(active: boolean): void {
    this.input.sprint = active;
  }

  /**
   * Bouton ⚽ : tir normal, OU (pendant un tir au but/penalty) début de la charge
   * de puissance, OU (pendant le plongeon du gardien) confirmation du plongeon
   * dans la direction actuelle du joystick — même logique que le clavier.
   */
  touchKick(): void {
    if (this.penaltyPhase === 'aiming') {
      this.penaltyCharging = true;
      return;
    }
    if (this.penaltyPhase === 'keeper') {
      const dir = this.touchKeeperDiveDir > 0.3 ? 1 : this.touchKeeperDiveDir < -0.3 ? -1 : 0;
      this.confirmKeeperDive(dir);
      return;
    }
    this.input.kick = true;
  }

  /** Relâchement du bouton ⚽ : déclenche le tir si on était en train de charger la puissance */
  touchKickRelease(): void {
    if (this.penaltyPhase === 'aiming' && this.penaltyCharging) {
      this.penaltyCharging = false;
      this.executePenaltyShot();
    }
  }

  touchPass(): void {
    this.input.pass = true;
  }

  touchTackle(): void {
    this.input.tackle = true;
  }

  touchSwitchPlayer(): void {
    this.input.switchPlayer = true;
  }

  // ─── Filtrage des équipes ──────────────────────────────────────────

  filterTeams(): void {
    let teams = this.allTeams;
    if (this.selectedCategory !== 'all') {
      teams = teams.filter(t => t.category === this.selectedCategory);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      teams = teams.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.country.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q)
      );
    }
    this.filteredTeams = teams;
  }

  setCategory(cat: 'club' | 'national' | 'all'): void {
    this.selectedCategory = cat;
    this.filterTeams();
  }

  onSearch(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.filterTeams();
  }

  selectHomeTeam(team: TeamData): void {
    // Si cette équipe est déjà choisie côté extérieur, on échange les deux colonnes
    // au lieu de se retrouver avec la même équipe des deux côtés (ou l'extérieur vidé).
    if (this.selectedAwayTeam?.id === team.id) {
      const previousHome = this.selectedHomeTeam;
      if (previousHome) {
        this.selectedAwayTeam = previousHome;
        this.awayAttributes = computeTeamAttributes(previousHome);
        this.awayJerseys = getTeamJerseys(previousHome);
        this.selectedAwayJersey = this.awayJerseys[0];
      } else {
        this.selectedAwayTeam = null;
        this.awayAttributes = null;
        this.awayJerseys = [];
        this.selectedAwayJersey = null;
      }
    }
    this.selectedHomeTeam = team;
    this.homeAttributes = computeTeamAttributes(team);
    this.homeJerseys = getTeamJerseys(team);
    this.selectedHomeJersey = this.homeJerseys[0];
  }

  selectAwayTeam(team: TeamData): void {
    // Même échange que selectHomeTeam(), dans l'autre sens.
    if (this.selectedHomeTeam?.id === team.id) {
      const previousAway = this.selectedAwayTeam;
      if (previousAway) {
        this.selectedHomeTeam = previousAway;
        this.homeAttributes = computeTeamAttributes(previousAway);
        this.homeJerseys = getTeamJerseys(previousAway);
        this.selectedHomeJersey = this.homeJerseys[0];
      } else {
        this.selectedHomeTeam = null;
        this.homeAttributes = null;
        this.homeJerseys = [];
        this.selectedHomeJersey = null;
      }
    }
    this.selectedAwayTeam = team;
    this.awayAttributes = computeTeamAttributes(team);
    this.awayJerseys = getTeamJerseys(team);
    this.selectedAwayJersey = this.awayJerseys[0];
  }

  /** Bascule du mode entraînement (une seule équipe à choisir) : oublie toute équipe
   * extérieure déjà choisie, elle sera auto-assignée à la confirmation si besoin. */
  onTrainingModeChange(): void {
    if (this.trainingMode) {
      this.selectedAwayTeam = null;
      this.awayAttributes = null;
      this.awayJerseys = [];
      this.selectedAwayJersey = null;
    }
  }

  /** Fait défiler la sélection de maillot d'une équipe (flèches gauche/droite) */
  cycleJersey(team: 'home' | 'away', direction: 1 | -1): void {
    const jerseys = team === 'home' ? this.homeJerseys : this.awayJerseys;
    const current = team === 'home' ? this.selectedHomeJersey : this.selectedAwayJersey;
    if (jerseys.length === 0) return;
    const currentIndex = current ? jerseys.findIndex(j => j.id === current.id) : 0;
    const nextIndex = (currentIndex + direction + jerseys.length) % jerseys.length;
    if (team === 'home') this.selectedHomeJersey = jerseys[nextIndex];
    else this.selectedAwayJersey = jerseys[nextIndex];
  }

  teamTooltip(team: TeamData): string {
    return `${team.name} (${team.country}) — Formation type ${team.formation}`;
  }

  // ─── Modale détail d'équipe (icône sur la carte, écran Sélection des équipes) ──
  detailTeam: TeamData | null = null;
  detailSelectedIndex = 0;

  openTeamDetail(team: TeamData, event: Event): void {
    event.stopPropagation(); // ne pas déclencher selectHomeTeam/selectAwayTeam de la carte
    this.detailTeam = team;
    this.detailSelectedIndex = 0;
  }

  closeTeamDetail(): void {
    this.detailTeam = null;
  }

  selectDetailPlayer(index: number): void {
    this.detailSelectedIndex = index;
  }

  get detailSelectedPlayer(): PlayerData | null {
    return this.detailTeam?.players[this.detailSelectedIndex] ?? null;
  }

  // ─── Configuration et classement (feuille de match) ──────────────────

  private initRosterState(team: 'home' | 'away', data: TeamData): void {
    const defaultFormationIndex = Math.max(0, this.allFormations.indexOf(data.formation as FormationKey));
    const state: TeamRosterState = {
      roster: [...data.players],
      formationIndex: defaultFormationIndex,
      selectedIndex: null,
      substitutionsUsed: 0,
      captainNumber: data.players[0]?.number ?? 1,
    };
    if (team === 'home') this.homeRosterState = state;
    else this.awayRosterState = state;
  }

  /** Choix du brassard de capitaine (écran de composition) */
  setCaptain(team: 'home' | 'away', number: number): void {
    if (this.matchStarted) return;
    this.getRosterState(team).captainNumber = number;
  }

  getRosterState(team: 'home' | 'away'): TeamRosterState {
    return team === 'home' ? this.homeRosterState : this.awayRosterState;
  }

  getRosterTeamData(team: 'home' | 'away'): TeamData | null {
    return team === 'home' ? this.selectedHomeTeam : this.selectedAwayTeam;
  }

  cycleFormation(team: 'home' | 'away', direction: 1 | -1): void {
    const state = this.getRosterState(team);
    const count = this.allFormations.length;
    state.formationIndex = (state.formationIndex + direction + count) % count;
  }

  currentFormation(team: 'home' | 'away'): FormationKey {
    const state = this.getRosterState(team);
    return this.allFormations[state.formationIndex];
  }

  /** Sélectionne une ligne du tableau : ouvre/ferme son menu contextuel (attributs + déplacement) */
  selectRosterRow(team: 'home' | 'away', index: number): void {
    const state = this.getRosterState(team);
    state.selectedIndex = state.selectedIndex === index ? null : index;
  }

  closeRosterContextMenu(team: 'home' | 'away'): void {
    this.getRosterState(team).selectedIndex = null;
  }

  /** Déplace le joueur sélectionné d'une place vers le haut/bas (échange avec son voisin) */
  moveRosterPlayer(team: 'home' | 'away', direction: -1 | 1): void {
    const state = this.getRosterState(team);
    if (state.selectedIndex === null) return;
    const target = state.selectedIndex + direction;
    if (target < 0 || target >= state.roster.length) return;

    [state.roster[state.selectedIndex], state.roster[target]] = [state.roster[target], state.roster[state.selectedIndex]];
    state.selectedIndex = target;
  }

  getExtendedAttributes(player: PlayerData, team: 'home' | 'away'): ExtendedPlayerAttributes {
    const data = this.getRosterTeamData(team);
    const teamIndex = data ? this.allTeams.indexOf(data) + 1 : 1;
    return deriveExtendedAttributes(player, teamIndex);
  }

  isStarter(index: number): boolean {
    return index < 11;
  }

  getRosterJerseyColors(team: 'home' | 'away'): JerseyOption | null {
    return team === 'home' ? this.selectedHomeJersey : this.selectedAwayJersey;
  }

  /**
   * Applique les remplacements décidés pendant la pause : seuls les joueurs qui
   * entrent depuis le banc (index 11-21 -> 0-10) consomment un remplacement ;
   * réorganiser l'ordre des titulaires entre eux reste gratuit.
   */
  private applyPendingSubstitutions(team: 'home' | 'away'): void {
    if (!this.gameState) return;
    const state = this.getRosterState(team);
    const previousStarters = team === 'home' ? this.matchStartersHome : this.matchStartersAway;
    const newStarters = state.roster.slice(0, 11);

    const prevNumbers = new Set(previousStarters.map(p => p.number));
    const enteringIndices: number[] = [];
    newStarters.forEach((p, idx) => { if (!prevNumbers.has(p.number)) enteringIndices.push(idx); });

    const remainingSubs = this.matchSettings.substitutionsAllowed - state.substitutionsUsed;
    const allowedEntries = enteringIndices.slice(0, Math.max(0, remainingSubs));

    if (enteringIndices.length > allowedEntries.length) {
      this.showRefereeNotification('🚫 Nombre de remplacements atteint');
    }

    const players = team === 'home' ? this.gameState.homePlayers : this.gameState.awayPlayers;
    const teamConfig = team === 'home' ? this.gameState.homeTeam : this.gameState.awayTeam;

    allowedEntries.forEach(idx => {
      const outgoing = players[idx];
      const incoming = newStarters[idx];
      if (!outgoing) return;
      const replacement = this.playerService.replacePlayer(outgoing, incoming, teamConfig);
      players[idx] = replacement;
      if (this.gameState.controlledPlayer === outgoing) this.gameState.controlledPlayer = replacement;
      state.substitutionsUsed++;
      this.showRefereeNotification(`🔄 ${incoming.name} remplace ${outgoing.config.name}`);
    });

    previousStarters.splice(0, previousStarters.length, ...newStarters);
  }

  // ─── Initialisation ──────────────────────────────────────────────────

  private initEngine(): void {
    const canvas = this.canvasRef.nativeElement;
    this.engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    // Pas de suréchantillonnage (1 = résolution native) : à 0.5 (rendu 2x plus grand
    // que la taille CSS, pour la netteté), le moteur tournait bien mais explosait en
    // mémoire (~40 Mo/s, navigateur tué en 1-2s) sur du rendu logiciel — bug resté
    // invisible jusqu'ici uniquement parce qu'un bug séparé (résolution de rendu
    // jamais resynchronisée à la taille CSS réelle, voir initScene()) maintenait le
    // moteur bloqué sur un tampon minuscule, empêchant ce réglage de jamais s'appliquer
    // pour de vrai. Le corriger a réactivé le suréchantillonnage pour la première fois
    // — et révélé qu'il n'est pas soutenable ici.
    this.engine.setHardwareScalingLevel(1);

    window.addEventListener('resize', () => this.engine.resize());
  }

  /**
   * Aperçu 3D du stade sélectionné, affiché en arrière-plan des écrans de préparation
   * (sélection d'équipe → composition → réglages → récap), à la place de l'ancien
   * dégradé CSS "façon ambiance stade" (pas de vraie photo disponible) : maintenant
   * qu'un vrai stade 3D existe, autant le montrer directement plutôt qu'un dégradé
   * de couleurs approximatif.
   */
  private initPreviewScene(): void {
    const canvas = this.previewCanvasRef.nativeElement;
    this.previewEngine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    this.previewEngine.setHardwareScalingLevel(1);
    window.addEventListener('resize', () => this.previewEngine.resize());

    this.rebuildPreviewStadium();

    if (!this.previewRenderLoopStarted) {
      this.previewRenderLoopStarted = true;
      this.previewEngine.runRenderLoop(() => {
        if (!this.previewScene || this.matchStarted) return;
        if (this.previewCamera) this.previewCamera.alpha += 0.0012;
        this.previewScene.render();
      });
    }
  }

  /** (Re)construit la scène d'aperçu pour refléter le stade actuellement sélectionné */
  rebuildPreviewStadium(): void {
    if (!this.previewEngine) return;
    this.previewStadiumService?.dispose();
    this.previewScene?.dispose();

    const stadium = this.stadiums.find(s => s.id === this.matchSettings.stadiumId) ?? this.stadiums[0];

    this.previewScene = new BABYLON.Scene(this.previewEngine);
    this.previewScene.clearColor = new BABYLON.Color4(0.05, 0.08, 0.15, 1);

    this.previewCamera = new BABYLON.ArcRotateCamera(
      'previewCamera', 0.6, 1.05, 150, BABYLON.Vector3.Zero(), this.previewScene
    );
    this.previewCamera.fov = 0.75;

    this.previewStadiumService = new StadiumService(this.previewScene);
    this.previewStadiumService.build({
      standColorHex: stadium.standColor,
      capacity: stadium.capacity,
      nightMode: this.matchSettings.dayNight === 'nuit',
      shape: stadium.shape,
      premium: stadium.premium,
      stadiumName: stadium.name,
    });
  }

  /** Libère l'aperçu 3D (appelé juste avant le vrai coup d'envoi, et à la destruction du composant) */
  private disposePreviewScene(): void {
    this.previewStadiumService?.dispose();
    this.previewStadiumService = null;
    this.previewScene?.dispose();
    this.previewScene = null;
    this.previewCamera = null;
  }

  private async initScene(): Promise<void> {
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.05, 0.08, 0.15, 1);

    // Caméra — vue d'ensemble du rectangle vert par défaut ("End-to-End", cf.
    // CAMERA_PRESETS) : légèrement en perspective plutôt qu'un pur aplomb, pour rester
    // lisible en gardant toute l'aire de jeu visible (l'ancien défaut, plus proche/plus
    // plongeant, ne laissait pas assez voir venir le jeu).
    this.camera = new BABYLON.ArcRotateCamera(
      'camera',
      0,
      0.3,
      105,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    this.camera.fov = 0.7;
    this.camera.lowerRadiusLimit = FOOTBALL_CONFIG.CAMERA.MIN_DISTANCE;
    this.camera.upperRadiusLimit = FOOTBALL_CONFIG.CAMERA.MAX_DISTANCE;
    this.camera.attachControl(this.canvasRef.nativeElement, true);
    this.camera.panningSensibility = 0;
    this.camera.lowerBetaLimit = 0.08;
    this.camera.upperBetaLimit = Math.PI / 2.2;
    if (this.viewLocked) {
      this.camera.detachControl();
    }
    this.activeCameraPresetId = 'end2end';
    this.activeCameraMode = 'orbit';
    this.dynamicZoomRange = null;

    // Monde physique
    const gravity = { x: 0, y: -9.81, z: 0 };
    this.world = new RAPIER.World(gravity);

    // Sol physique statique : le terrain visuel (stadium.service.ts) n'a pas
    // de collider — sans ça, joueurs et ballon tombent à l'infini sous gravité
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0);
    const groundBody = this.world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(150, 0.1, 100)
      .setFriction(FOOTBALL_CONFIG.BALL.FRICTION)
      .setRestitution(0.2);
    this.world.createCollider(groundColliderDesc, groundBody);
  }

  private initMatchState(): MatchState {
    const duration = this.matchDurations.find(d => d.id === this.matchSettings.durationId);
    return {
      period: '1ère',
      clock: 0,
      halfDuration: duration?.halfSeconds ?? FOOTBALL_CONFIG.MATCH.HALF_DURATION,
      stoppageSeconds: 0,
      score: { home: 0, away: 0 },
      events: [],
      isPaused: false,
      isGoalScored: false,
      goalScoredTeam: null,
      goalScoredTimer: 0,
      possession: { home: 50, away: 50 },
      shots: { home: 0, away: 0 },
      shotsOnTarget: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      offsides: { home: 0, away: 0 },
    };
  }

  private teamDataToConfig(data: TeamData, id: 'home' | 'away', jersey: JerseyOption, formation: FormationKey): TeamConfig {
    const keeperColor = data.colors[id === 'home' ? 'home' : 'away'].keeper;
    return {
      id,
      name: data.name,
      colors: {
        primary: this.hexToRgb(jersey.primary),
        secondary: this.hexToRgb(jersey.secondary),
        keeper: this.hexToRgb(keeperColor),
        skin: this.hexToRgb(data.colors.skin),
      },
      formation,
      difficulty: this.selectedDifficulty,
    };
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    } : { r: 0.5, g: 0.5, b: 0.5 };
  }

  private rgbToHex(rgb: { r: number; g: number; b: number }): string {
    const channel = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
    return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
  }

  // ─── Navigation entre écrans ──────────────────────────────────────

  startGame(): void {
    if (!this.audioService) this.audioService = new AudioService();
    this.audioService.unlock(); // doit être déclenché par un geste utilisateur (clic)

    // Reconstruit l'aperçu du stade (jeté après le coup d'envoi de la partie précédente)
    if (!this.previewScene) this.rebuildPreviewStadium();

    this.showMenu = false;
    this.showTeamSelect = true;
    this.showFormation = false;
    this.showSettings = false;
    this.showRecap = false;
    this.showMatch = false;
    this.showResult = false;
    // Le mode Entraînement n'a plus de case à cocher (tout est regroupé dans le
    // Tutoriel, cf. openTutorialMenu()) — un vrai "Nouveau Match" n'est donc plus
    // jamais en entraînement, même si une session Tutoriel précédente l'avait activé.
    this.trainingMode = false;
  }

  /** Bouton "Tutoriel" du menu principal : ouvre la page de cartes (ateliers), ne
   * charge plus directement le terrain. */
  openTutorialMenu(): void {
    if (!this.audioService) this.audioService = new AudioService();
    this.audioService.unlock(); // doit être déclenché par un geste utilisateur (clic)
    if (!this.previewScene) this.rebuildPreviewStadium();
    this.showMenu = false;
    this.showTutorialCards = true;
  }

  backToTutorialMenu(): void {
    this.showTutorialCards = false;
    this.showMenu = true;
  }

  /** Clic sur une carte d'atelier — lance instantanément la scène correspondante
   * (équipe par défaut, écrans de formation/réglages/récap sautés). */
  selectExercise(id: string): void {
    const exercise = this.tutorialExercises.find(e => e.id === id);
    if (!exercise?.enabled) return;

    if (id === 'fullmatch') {
      this.showTutorialCards = false;
      this.startGame(); // vrai match : flux normal de sélection d'équipes, inchangé
      return;
    }

    this.showTutorialCards = false;
    this.trainingMode = true;
    this.pendingExercise = id === 'guided' ? null : id;
    this.tutorialPending = id === 'guided';
    this.quickPickDefaultTeamAndLaunch();
  }

  /** Équipe par défaut + saute formation/réglages/récap pour lancer la scène tout de
   * suite ("lancer instantanément la scène", pas de clics à travers 3 écrans). */
  private quickPickDefaultTeamAndLaunch(): void {
    if (!this.audioService) this.audioService = new AudioService();
    this.audioService.unlock();
    if (!this.previewScene) this.rebuildPreviewStadium();

    this.selectHomeTeam(this.allTeams[0]);
    this.onTrainingModeChange();
    this.confirmTeams();
    this.confirmFormation();
    this.confirmSettings();
    this.startMatch();
  }

  /** Démarre le scénario choisi sur la page Tutoriel — appelée en fin de startMatch()
   * une fois les joueurs/gardien/mannequins d'entraînement réellement en place. */
  private launchPendingExercise(): void {
    const id = this.pendingExercise;
    this.pendingExercise = null;
    switch (id) {
      case 'penalty': this.startPenaltyTraining('shooter'); break;
      case 'freekick': this.startFreeKickTraining(); break;
      case 'tackle': this.startTackleTraining(); break;
      case 'passshort': case 'passlong': case 'cross': this.startPassTraining(); break;
      case 'sprint': this.startRunningTraining(); break;
      case 'dribble': this.startDribbleTraining(); break;
      case 'switchplayer': this.startSwitchPlayerTraining(); break;
      default: break; // 'shoot' (ou null) : l'entraînement libre par défaut suffit
    }
  }

  confirmTeams(): void {
    if (!this.selectedHomeTeam) return;
    if (this.trainingMode) {
      // Pas d'adversaire à choisir en entraînement : une équipe adverse est auto-assignée
      // pour continuer à réutiliser tel quel le flux de match habituel (22 joueurs, IA,
      // arbitre...) sans dupliquer toute cette logique pour un mode "solo".
      if (!this.selectedAwayTeam) {
        const opponent = this.allTeams.find(t => t.id !== this.selectedHomeTeam!.id) ?? this.allTeams[0];
        this.selectAwayTeam(opponent);
      }
    } else if (!this.selectedAwayTeam) {
      return;
    }
    this.initRosterState('home', this.selectedHomeTeam);
    this.initRosterState('away', this.selectedAwayTeam!);
    this.showTeamSelect = false;
    this.showFormation = true;
  }

  /** Bouton "Continuer" de l'écran Configuration et classement */
  confirmFormation(): void {
    if (this.substitutionFlowActive) {
      this.applyPendingSubstitutions('home');
      this.applyPendingSubstitutions('away');
      this.substitutionFlowActive = false;
      this.showFormation = false;
      this.showMatch = true;
      this.showPauseModal = true; // revenir sur le modal pause
      return;
    }
    this.showFormation = false;
    this.showSettings = true;
  }

  backToFormationFromSettings(): void {
    this.showSettings = false;
    this.showFormation = true;
  }

  /** Bouton "Continuer" de l'écran Réglages du match */
  confirmSettings(): void {
    this.showSettings = false;
    this.showRecap = true;
    // Le bandeau de navigation de l'appli (au-dessus, hors de ce composant) réduisait
    // la hauteur disponible au point de pousser le bouton "Coup d'envoi" (en bas de
    // l'écran) hors de la fenêtre sans défilement vertical — masqué ici comme il
    // l'est déjà pendant le match, restauré si on revient en arrière (Modifier).
    this.gameChrome.hideHeader();
    // Musique d'avant-match (montée en tension avant le coup d'envoi), arrêtée au
    // coup d'envoi (cf. startMatch()) ou si on revient en arrière.
    if (!this.audioService) this.audioService = new AudioService();
    this.audioService.playPreMatchAnthem(this.matchSettings.crowdStyleId as CrowdMood);
  }

  backToSettingsFromRecap(): void {
    this.showRecap = false;
    this.showSettings = true;
    this.gameChrome.showHeader();
    this.audioService?.stopPreMatchAnthem();
  }

  confirmRecapAndKickoff(): void {
    this.showRecap = false;
    this.audioService?.stopPreMatchAnthem();
    this.startMatch();
  }

  get recapStadiumName(): string {
    return this.stadiums.find(s => s.id === this.matchSettings.stadiumId)?.name ?? '';
  }

  get recapBallName(): string {
    return this.balls.find(b => b.id === this.matchSettings.ballId)?.name ?? '';
  }

  get recapCommentatorName(): string {
    return this.commentators.find(c => c.id === this.matchSettings.commentatorId)?.name ?? '';
  }

  get recapCrowdStyleName(): string {
    return this.crowdStyles.find(c => c.id === this.matchSettings.crowdStyleId)?.name ?? '';
  }

  get recapDurationLabel(): string {
    return this.matchDurations.find(d => d.id === this.matchSettings.durationId)?.label ?? '';
  }

  backToMenu(): void {
    this.disposeGame();
    this.matchStarted = false;
    this.substitutionFlowActive = false;
    this.showPauseModal = false;
    this.gameChrome.showHeader();
    this.showMenu = true;
    this.showTeamSelect = false;
    this.showFormation = false;
    this.showSettings = false;
    this.showRecap = false;
    this.showMatch = false;
    this.showResult = false;
  }

  backToTeamSelect(): void {
    this.showTeamSelect = true;
    this.showFormation = false;
  }

  /** "🎓 Retour aux ateliers" (panneau manette, en plein entraînement) : quitte la
   * séance en cours et revient directement sur la page de cartes du Tutoriel — jamais
   * un rechargement complet de l'application, juste un changement d'écran interne
   * (même mécanisme que backToMenu(), qui dispose déjà proprement la scène 3D). */
  returnToTutorialCardsFromMatch(): void {
    this.disposeGame();
    this.matchStarted = false;
    this.substitutionFlowActive = false;
    this.showPauseModal = false;
    this.gameChrome.showHeader();
    this.showMenu = false;
    this.showTeamSelect = false;
    this.showFormation = false;
    this.showSettings = false;
    this.showRecap = false;
    this.showMatch = false;
    this.showResult = false;
    this.showTutorialCards = true;
  }

  /** Bouton "Retour" de l'écran Configuration et classement (désactivé pendant un remplacement en cours de match) */
  handleFormationBack(): void {
    if (this.substitutionFlowActive) return;
    this.backToTeamSelect();
  }

  // ─── Démarrage du match ──────────────────────────────────────────────

  startMatch(): void {
    // Laisse la place à la vraie scène de match sur le même moteur/canvas de rendu
    this.disposePreviewScene();

    this.showMenu = false;
    this.showTeamSelect = false;
    this.showFormation = false;
    this.showSettings = false;
    this.showRecap = false;
    this.showMatch = true;
    this.showResult = false;
    this.matchStarted = true;
    this.controlsHintExpanded = false;
    this.trainingScenario = null;
    this.penaltyTrainingActive = false;
    this.gameChrome.hideHeader(); // plein écran pendant le match
    this.showControlsHint = true;
    this.playerSizeMultiplier = 1;
    this.replayBuffer = [];
    this.lastGoalReplay = null;
    this.contextCameraOpen = false;
    this.contextSpeedOpen = false;
    this.gameSpeedMultiplier = 1;
    this.autoPlayEnabled = false;
    this.ballTrailEnabled = true;
    this.showAllPlayerLabels = this.matchSettings.showPlayerLabels;
    this.showBallCarrierRing = true;
    this.showRadar = true;
    this.pitchOnlyMode = false;
    this.tutorialActive = this.tutorialPending;
    this.tutorialPending = false;
    this.tutorialStepIndex = 0;
    this.chantTimer = 45 + Math.random() * 30;

    this.initScene().then(async () => {
      // Le canvas peut ne pas encore avoir sa taille CSS finale au moment de la
      // construction du moteur (masquage de l'en-tête, mise en page qui vient de
      // basculer) — resize() explicite ici, sans quoi le moteur reste bloqué sur
      // une résolution de rendu obsolète (window ne se redimensionne pas, lui,
      // donc son seul listener 'resize' ne se déclenche jamais tout seul dans ce
      // cas). Ce décalage rendait par exemple les étiquettes des joueurs projetées
      // n'importe où (calculées dans l'espace de la résolution de rendu, appliquées
      // comme si c'était celui de la taille CSS réelle du canvas).
      this.engine.resize();
      requestAnimationFrame(() => this.engine.resize());

      const homeTeamData = this.selectedHomeTeam!;
      const awayTeamData = this.selectedAwayTeam!;
      const teams = {
        home: this.teamDataToConfig(homeTeamData, 'home', this.selectedHomeJersey ?? getTeamJerseys(homeTeamData)[0], this.currentFormation('home')),
        away: this.teamDataToConfig(awayTeamData, 'away', this.selectedAwayJersey ?? getTeamJerseys(awayTeamData)[0], this.currentFormation('away')),
      };
      const matchState = this.initMatchState();

      const stadium = this.stadiums.find(s => s.id === this.matchSettings.stadiumId) ?? this.stadiums[0];
      const weather = this.weatherOptions.find(w => w.id === this.matchSettings.weather) ?? this.weatherOptions[0];
      const isNight = this.matchSettings.dayNight === 'nuit';
      const ballOption = this.balls.find(b => b.id === this.matchSettings.ballId) ?? this.balls[0];

      // Services
      this.stadiumService = new StadiumService(this.scene, this.world);
      this.stadiumService.build({
        standColorHex: stadium.standColor,
        capacity: stadium.capacity,
        fogColorHex: weather.id !== 'soleil' ? this.rgbToHex(weather.fogColor) : undefined,
        nightMode: isNight,
        precipitation: weather.id === 'pluie' || weather.id === 'neige' ? weather.id : null,
        shape: stadium.shape,
        premium: stadium.premium,
        stadiumName: stadium.name,
      });
      this.isPremiumStadium = !!stadium.premium;

      this.matchStartersHome = this.homeRosterState.roster.slice(0, 11);
      this.matchStartersAway = this.awayRosterState.roster.slice(0, 11);

      const playerSize = this.playerSizeOptions.find(s => s.id === this.matchSettings.playerSizeId) ?? this.playerSizeOptions[0];
      this.playerService = new PlayerService(this.scene, this.world);
      this.playerService.setBaseScale(playerSize.scale);
      this.playerService.setWeatherFactors(weather.playerSpeedFactor, weather.playerAccelFactor);
      // Modèle 3D des joueurs (Mixamo, ~3,9 Mo) : chargé une seule fois par match, attendu
      // ici avant de créer le moindre joueur (createTeam reste synchrone ensuite).
      await this.playerService.preload();
      const homePlayers = this.playerService.createTeam(teams.home, true, this.matchStartersHome, this.homeRosterState.captainNumber);
      // Mode Entraînement : pas de véritable onze adverse — seulement son gardien (pour
      // s'entraîner à marquer), et des mannequins statiques pour le dribble/tacle,
      // plutôt qu'une vraie équipe IA en face (ce n'est pas un match, juste une séance).
      const awayPlayers = this.trainingMode
        ? this.playerService.createGoalkeeperOnly(teams.away, false)
        : this.playerService.createTeam(teams.away, false, this.matchStartersAway, this.awayRosterState.captainNumber);
      if (this.trainingMode) {
        this.trainingDummies = this.playerService.createTrainingDummies(this.attackingDirection('home'));
      }

      // Supporters 3D (rangées avant des tribunes) : couleurs de maillot selon les
      // équipes en présence, taille/intensité selon l'ambiance et le remplissage du
      // stade (mêmes proportions que l'ambiance sonore, cf. AudioService).
      this.crowdService = new CrowdService(this.scene);
      await this.crowdService.preload();
      this.crowdService.spawn(
        teams.home,
        teams.away,
        this.matchSettings.crowdStyleId as CrowdMood,
        stadium.capacity / 90000
      );

      this.ballService = new BallService(this.scene, this.world);
      const ball = this.ballService.create(ballOption.accentColor, {
        frictionFactor: weather.ballFrictionFactor,
        restitutionFactor: weather.ballRestitutionFactor,
      });

      this.refereeService = new RefereeService(matchState);
      this.aiServiceHome = new AIService(matchState, teams.home);
      this.aiServiceAway = new AIService(matchState, teams.away);
      this.aiServiceHome.setWeatherSpeedFactor(weather.playerSpeedFactor);
      this.aiServiceAway.setWeatherSpeedFactor(weather.playerSpeedFactor);

      this.matchService = new MatchService(matchState);
      this.matchService.setCallbacks({
        onPeriodChange: (period) => this.handlePeriodChange(period),
        onMatchEnd: () => this.showResultScreen(),
        onPenaltyResult: (team, scored) => this.handlePenaltyResult(team, scored),
      });

      // État du jeu
      this.gameState = {
        gameState: 'playing',
        match: matchState,
        homeTeam: teams.home,
        awayTeam: teams.away,
        homePlayers,
        awayPlayers,
        ball,
        controlledPlayer: this.playerService.getClosestToBall('home', BABYLON.Vector3.Zero()),
        selectedFormation: this.currentFormation('home'),
        difficulty: this.selectedDifficulty,
      };

      // Commentateur configuré tout de suite ; coup de sifflet et ambiance repoussés
      // après la révélation des compositions (voir plus bas)
      const commentator = this.commentators.find(c => c.id === this.matchSettings.commentatorId);
      this.audioService.setCommentator(this.matchSettings.commentatorId, commentator?.language ?? 'Français');

      // Vrai coup d'envoi : 2 joueurs de l'équipe qui engage se placent côte à côte au
      // rond central (le reste de l'équipe garde sa formation), visible dès la révélation
      this.setupKickoffPair('home');

      if (this.trainingMode) {
        // Pas de révélation de compositions en entraînement (pas de vrai adversaire à
        // présenter) : on démarre directement la séance.
        this.startGameLoop();
        this.gameState.match.isPaused = false;
        this.triggerKickoffPass();
        // Ambiance de séance calme (bug corrigé) : chants/bruit de tribune ("le mode
        // Entraînement doit être immersif mais calme") supprimés en Tutoriel — ni
        // ambiance de foule, ni annonce vocale, seuls les sons de gameplay restent
        // (frappe, passe, sifflet...), déjà déclenchés individuellement ailleurs.
        this.audioService.playWhistle(true);
        // Atelier choisi sur la page Tutoriel (cartes) : lancé maintenant que joueurs/
        // gardien/mannequins d'entraînement sont réellement en place.
        if (this.pendingExercise) this.launchPendingExercise();
      } else {
        // Joueurs déjà en place (formation de coup d'envoi), mais jeu figé : révélation
        // des compositions (drapeau en filigrane sur la pelouse, équipe par équipe) avant
        // le coup d'envoi, comme une vraie retransmission télé.
        this.gameState.match.isPaused = true;
        this.startGameLoop();
        this.playFormationReveal(homeTeamData.name, homeTeamData.country, awayTeamData.name, awayTeamData.country, () => {
          this.gameState.match.isPaused = false;
          this.triggerKickoffPass();
          this.audioService.playWhistle(true);
          this.audioService.speak(`Coup d'envoi entre ${teams.home.name} et ${teams.away.name} !`);
          this.audioService.startCrowdAmbiance(this.matchSettings.crowdStyleId as CrowdMood, stadium.capacity / 90000);
        });
      }
    });
  }

  /**
   * Révélation des compositions avant le coup d'envoi : le drapeau de chaque équipe,
   * en filigrane, est projeté sur la pelouse (grand plan semi-transparent au-dessus du
   * marquage du terrain) pendant que ses joueurs sont déjà visibles à leur poste —
   * l'équipe à gauche d'abord, puis l'équipe à droite quelques secondes après. La
   * formation choisie (schéma "4-3-3" etc., même widget que l'écran de composition)
   * s'affiche en overlay HTML par-dessus, synchronisée avec le drapeau projeté.
   */
  private playFormationReveal(
    homeName: string, homeCountry: string,
    awayName: string, awayCountry: string,
    onDone: () => void
  ): void {
    const REVEAL_DURATION_MS = 2600;

    // La construction/texture du mesh 3D tourne hors zone Angular (comme la boucle de
    // rendu Babylon) : créé depuis l'intérieur de la zone Angular (via les setTimeout
    // habituels d'un composant), ce mesh reste invisible dans ce pipeline — actif,
    // dans le frustum, matériau/texture prêts (vérifié à la main), mais aucun pixel ne
    // s'affiche — alors que la même construction déclenchée hors zone (ou injectée
    // directement depuis l'extérieur de l'app) fonctionne normalement à l'identique.
    // En revanche `revealingTeam` (overlay HTML du schéma de formation) DOIT être
    // modifié À L'INTÉRIEUR de la zone Angular pour que le template se mette à jour —
    // d'où les `ngZone.run(...)` ponctuels ci-dessous, imbriqués dans le bloc hors-zone.
    this.ngZone.runOutsideAngular(() => {
      const plane = this.createFormationRevealPlane();
      this.setFormationRevealTexture(plane, homeName, getCountryFlag(homeCountry));
      this.ngZone.run(() => { this.revealingTeam = 'home'; });
      setTimeout(() => {
        this.setFormationRevealTexture(plane, awayName, getCountryFlag(awayCountry));
        this.ngZone.run(() => { this.revealingTeam = 'away'; });
        setTimeout(() => {
          plane.dispose();
          this.ngZone.run(() => { this.revealingTeam = null; onDone(); });
        }, REVEAL_DURATION_MS);
      }, REVEAL_DURATION_MS);
    });
  }

  private createFormationRevealPlane(): BABYLON.Mesh {
    // Cloné du ground du marquage du terrain plutôt que construit via CreateGround :
    // un CreateGround fraîchement créé à ce stade (après tous les meshes du stade/joueurs)
    // reste bloqué invisible dans ce pipeline (mesh actif, dans le frustum, matériau prêt —
    // vérifié à la main — mais aucun pixel ne s'affiche, même avec un matériau opaque uni sans
    // texture ni alpha). Cloner un ground déjà correctement rendu (le marquage, lui-même
    // alpha-blendé) contourne le problème de façon fiable.
    const markings = this.scene.getMeshByName('fieldMarkings') as BABYLON.Mesh;
    const plane = markings.clone('formationRevealPlane');
    const bb = markings.getBoundingInfo().boundingBox;
    plane.scaling.x = 30 / bb.maximum.x;
    plane.scaling.z = 30 / bb.maximum.z;
    plane.position.y = 0.04; // au-dessus du marquage du terrain (0.005) et de la pelouse
    plane.isPickable = false;
    const mat = new BABYLON.StandardMaterial('formationRevealMat', this.scene);
    mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    mat.backFaceCulling = false;
    mat.useAlphaFromDiffuseTexture = true;
    plane.material = mat;
    return plane;
  }

  private setFormationRevealTexture(plane: BABYLON.Mesh, teamName: string, flagEmoji: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 512);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.32;
    ctx.font = '340px sans-serif';
    ctx.fillText(flagEmoji, 256, 220);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px "Segoe UI", Arial, sans-serif';
    ctx.fillText(teamName.toUpperCase(), 256, 430);
    ctx.globalAlpha = 1;

    // canvas.toDataURL() renvoie déjà une URI data: complète — ne pas la re-préfixer
    const texture = new BABYLON.Texture(canvas.toDataURL(), this.scene);
    texture.hasAlpha = true;
    const mat = plane.material as BABYLON.StandardMaterial;
    mat.diffuseTexture?.dispose();
    mat.diffuseTexture = texture;
    mat.emissiveTexture = texture;
  }

  // ─── Boucle de jeu ───────────────────────────────────────────────────

  private startGameLoop(): void {
    let lastTime = performance.now();

    const loop = () => {
      const now = performance.now();
      // gameSpeedMultiplier (menu contextuel) s'applique ICI, avant toute autre
      // utilisation de deltaTime : logique de jeu, synchronisation d'animation ET pas
      // de simulation physique (world.timestep = deltaTime dans updateGame()) restent
      // ainsi parfaitement synchronisés entre eux à n'importe quelle vitesse.
      const deltaTime = Math.min((now - lastTime) / 1000, 0.05) * this.gameSpeedMultiplier;
      lastTime = now;

      if (!this.gameState.match.isPaused && !this.gameState.match.isGoalScored && !this.setPieceActive) {
        this.updateGame(deltaTime);
      } else if (this.gameState.match.isPaused && this.showPauseModal) {
        // Bug corrigé (signalé : "le menu pause ne répond pas à la manette, le menu
        // contextuel oui") : isPaused=true coupe updateGame() entièrement — et donc
        // pollGamepad() avec, puisqu'il n'était appelé QUE depuis là — alors que le
        // menu contextuel (clic droit) n'a lui jamais mis isPaused à vrai. Résultat :
        // la navigation manette du modal pause n'avait tout simplement plus aucune
        // chance de s'exécuter, contrairement à celle du menu contextuel. Appelé ici à
        // part, hors d'updateGame() (donc sans réveiller physique/IA/chronomètre) —
        // pollGamepad() détecte lui-même showPauseModal et ne fait QUE la navigation.
        this.pollGamepad(deltaTime);
      }

      // Synchroniser les positions (sauf pendant la lecture d'un ralenti, qui pilote
      // directement les meshes depuis le tampon enregistré)
      if (!this.replayActive) {
        // Bug corrigé (célébration de but "cassée" par une transition d'animation) :
        // syncPositions() choisit aussi l'animation de base (Idle/Run/Sprint) selon la
        // vélocité physique du joueur (cf. player.service.ts) — comme world.step() n'est
        // plus appelé pendant isGoalScored (updateGame() déjà coupé ci-dessus), cette
        // vélocité reste figée à sa dernière valeur d'avant le but (souvent > 0, un
        // joueur courait vers le ballon). syncPositions() continuait pourtant de
        // tourner et écrasait donc IMMÉDIATEMENT (en un instant) l'animation de
        // célébration (CelebrationFlip/IdleHappy, cf. celebratePlayersGoal()) par Run/
        // Sprint, alors même que les joueurs ne bougent plus du tout à l'écran. Ne PAS
        // appeler syncPositions() pendant la célébration règle le problème à la racine
        // (les AnimationGroup Babylon continuent de tourner seules via scene.render(),
        // syncPositions() n'étant nécessaire que pour la position ET le choix
        // d'animation, tous deux figés le temps de la célébration).
        if (!this.gameState.match.isGoalScored) {
          const ballPos = this.gameState.ball?.body.translation();
          this.playerService.syncPositions(deltaTime, ballPos ? new BABYLON.Vector3(ballPos.x, ballPos.y, ballPos.z) : undefined);
        }
        this.ballService.syncPosition();

        if (!this.gameState.match.isPaused && !this.gameState.match.isGoalScored && !this.setPieceActive) {
          this.recordReplayFrame();
        }
      }

      // Caméra suit le ballon
      this.updateCamera();

      // Rendu
      this.scene.render();

      this.animationFrameId = requestAnimationFrame(loop);
    };

    loop();
  }

  private updateGame(deltaTime: number): void {
    const state = this.gameState;
    const ball = state.ball!;

    // 1. Mettre à jour le chronomètre, les périodes (mi-temps/prolongations/tab) et l'arbitre
    this.matchService.update(deltaTime);
    this.refereeService.update(deltaTime);
    this.updateClockDisplay();

    // 2. Gérer les entrées du joueur contrôlé (clavier + manette) — sauf en auto-play,
    // où l'IA prend aussi en charge le joueur normalement humain (les deux équipes s'affrontent seules)
    if (!this.autoPlayEnabled) {
      this.pollGamepad(deltaTime);
      this.handlePlayerInput(deltaTime);
    }

    // 2bis. Chant de tribune ponctuel (ambiance) — jamais en Tutoriel (séance calme,
    // uniquement les sons de gameplay), pas pendant un arrêt de jeu
    if (!this.trainingMode && !this.gameState.match.isPaused && !this.gameState.match.isGoalScored) {
      this.chantTimer -= deltaTime;
      if (this.chantTimer <= 0) {
        this.audioService?.playChant();
        this.chantTimer = 45 + Math.random() * 30;
      }
    }
    this.crowdService?.update(deltaTime);

    // 3. Décrémenter les cooldowns de tacle et de décision IA (tir/passe), et le
    // "maintien" visuel de l'anneau du porteur du ballon (cf. checkBallCollisions)
    [...state.homePlayers, ...state.awayPlayers].forEach(p => {
      if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - deltaTime);
      if (p.ballActionCooldown > 0) p.ballActionCooldown = Math.max(0, p.ballActionCooldown - deltaTime);
      if (p.ringLingerTimer > 0) {
        p.ringLingerTimer = Math.max(0, p.ringLingerTimer - deltaTime);
        p.ballCarrierRing.isVisible = this.showBallCarrierRing && p.ringLingerTimer > 0;
      }
    });

    // 4. Mettre à jour l'IA des deux équipes (déplacement)
    this.aiServiceHome.update(
      state.homePlayers,
      state.awayPlayers,
      ball,
      this.autoPlayEnabled ? null : state.controlledPlayer,
      deltaTime
    );
    this.aiServiceAway.update(
      state.awayPlayers,
      state.homePlayers,
      ball,
      null, // L'IA contrôle toute l'équipe adverse
      deltaTime
    );

    // 4bis. Applique le lissage de vélocité à CHAQUE frame (indépendamment du throttle
    // à 200 ms de update() ci-dessus) — sans ça, la vitesse restait figée entre deux
    // décisions IA puis sautait instantanément, donnant une course saccadée.
    this.aiServiceHome.applySmoothMovement(state.homePlayers, deltaTime);
    this.aiServiceAway.applySmoothMovement(state.awayPlayers, deltaTime);

    // Réflexes des gardiens à chaque frame (un tir traverse la surface bien plus vite
    // que le cycle de décision IA à 200 ms, cf. updateGoalkeeperReflexes).
    {
      const bv = ball.body.linvel();
      const bp = ball.body.translation();
      const ballPosVec = new BABYLON.Vector3(bp.x, bp.y, bp.z);
      const homeKeeper = state.homePlayers.find(p => p.config.role === 'gk' && !p.isSentOff);
      const awayKeeper = state.awayPlayers.find(p => p.config.role === 'gk' && !p.isSentOff);
      const diffCfg = FOOTBALL_CONFIG.DIFFICULTY[this.selectedDifficulty];
      if (homeKeeper) this.aiServiceHome.updateGoalkeeperReflexes(homeKeeper, ballPosVec, { x: bv.x, z: bv.z }, diffCfg);
      if (awayKeeper) this.aiServiceAway.updateGoalkeeperReflexes(awayKeeper, ballPosVec, { x: bv.x, z: bv.z }, diffCfg);
    }

    // 4ter. Décisions IA avec le ballon (tir/passe) — sans ça l'IA ne fait que courir autour du ballon
    this.handleAIBallActions();

    // 4quater. Avancer la simulation physique — sans ça les corps ne bougent jamais
    // (les vitesses/impulsions sont bien réglées, mais rien ne les intègre en position)
    this.world.timestep = deltaTime;
    this.world.step();

    // 5. Détection des collisions ballon-joueur
    this.checkBallCollisions(deltaTime);

    // 6. Vérifier les buts
    this.checkGoals();

    // 7. Vérifier les sorties de terrain
    this.checkOutOfBounds();

    // 8. Mettre à jour la possession
    this.updatePossession();

    // 9. Mettre à jour l'affichage
    this.updateUI();

    // 10. Charger la puissance du tir au but pendant que Espace est maintenu
    if (this.penaltyCharging) {
      this.penaltyPower = Math.min(1, this.penaltyPower + deltaTime * 0.8);
    }
  }

  // ─── Contrôles joueur ────────────────────────────────────────────────

  private handlePlayerInput(deltaTime: number): void {
    this.advanceTutorialIfNeeded();

    const player = this.gameState.controlledPlayer;
    if (!player || player.isSentOff) {
      this.switchToNearestPlayer();
      return;
    }

    // Mouvement
    const direction = new BABYLON.Vector3(this.input.moveX, 0, this.input.moveZ);
    if (direction.length() > 0) {
      this.playerService.movePlayer(player, direction, this.input.sprint, deltaTime);
    } else {
      this.playerService.stopPlayer(player);
    }

    // Bug corrigé : pendant un exercice Penalty, la visée/le tir/le plongeon sont
    // entièrement pilotés par la HUD dédiée (penaltyPhase, runPenaltyRound...) — mais
    // rien n'empêchait le jeu ouvert NORMAL (tir/passe/tacle au contact du ballon,
    // ci-dessous) de s'activer EN PARALLÈLE. Un appui perdu pendant le bref intervalle
    // "idle" entre deux tentatives déclenchait alors un tir "de match" classique, qui
    // pouvait marquer via le pipeline de score standard ("But de <équipe>") — aberrant
    // en entraînement, où l'"adversaire" auto-assigné n'a aucun sens pour le joueur.
    if (this.penaltyTrainingActive) {
      this.input.kick = false;
      this.input.pass = false;
      this.input.passDeep = false;
      this.input.crossLong = false;
      this.input.tackle = false;
      return;
    }

    // Le ballon a changé de camp/de porteur (tacle subi, dégagement adverse...) sans
    // passer par le chemin normal de passe ci-dessous : la sélection de cible n'a plus
    // de sens, on efface le marqueur plutôt que de le laisser flotter sur un coéquipier
    // au hasard.
    if (!player.ballControlled && this.selectedPassTarget) {
      this.setPassTarget(null);
    }

    // Tir
    // Bug corrigé : visait toujours le but à Z positif quel que soit le camp — après un
    // changement de côté à la mi-temps (cf. attackingDirection()), un tir humain aurait
    // pu viser SON PROPRE but plutôt que celui de l'adversaire.
    if (this.input.kick && this.isPlayerNearBall(player)) {
      const ballPos = new BABYLON.Vector3(
        this.gameState.ball!.body.translation().x,
        this.gameState.ball!.body.translation().y,
        this.gameState.ball!.body.translation().z
      );
      const goalPos = new BABYLON.Vector3(0, 1, this.attackingDirection(player.config.teamId) * FOOTBALL_CONFIG.FIELD.LENGTH / 2);
      const direction = this.applyShotAccuracy(goalPos.subtract(ballPos), player, ballPos, goalPos);
      direction.y = 0.5; // Légère hauteur
      this.ballService.kick(this.gameState.ball!, direction, FOOTBALL_CONFIG.PLAYER.KICK_POWER_MAX);
      this.gameState.ball!.lastTouch = { playerId: player.config.id, teamId: player.config.teamId, viaKick: true };
      this.input.kick = false;
      player.ballControlled = false;
      this.refereeService.updateStats('shot', player.config.teamId, true);
      this.audioService.playKick(FOOTBALL_CONFIG.PLAYER.KICK_POWER_MAX);
      this.playerService.playOneShot(player, 'Shoot');
    }

    // Bouton "3" près du ballon : au tout premier contact, PREND LE CONTRÔLE (amortit le
    // ballon sous le pied — un vrai "premier touché") au lieu de le relancer aussitôt vers
    // un coéquipier. Une fois le ballon maîtrisé (ballControlled), "3" redevient la passe
    // courte comme avant — si un coéquipier a été délibérément choisi (L1, cf.
    // cyclePassTarget()), le ballon lui est adressé À LUI ; sinon, repli sur la meilleure
    // cible calculée automatiquement.
    if (this.input.pass && this.isPlayerNearBall(player)) {
      if (!player.ballControlled) {
        this.takeBallControl(player);
      } else {
        const ballPos = new BABYLON.Vector3(
          this.gameState.ball!.body.translation().x,
          this.gameState.ball!.body.translation().y,
          this.gameState.ball!.body.translation().z
        );
        const manualTarget = this.selectedPassTarget && !this.selectedPassTarget.isSentOff
          && this.gameState.homePlayers.includes(this.selectedPassTarget)
          ? this.selectedPassTarget : null;
        const target = manualTarget ?? this.aiServiceHome.findShortPassTarget(player, this.gameState.homePlayers, ballPos);
        if (target) {
          const targetPos = new BABYLON.Vector3(
            target.body.translation().x,
            target.body.translation().y,
            target.body.translation().z
          );
          this.ballService.pass(this.gameState.ball!, ballPos, targetPos);
          this.gameState.ball!.lastTouch = { playerId: player.config.id, teamId: player.config.teamId, viaKick: true };
          this.checkOffsideOnPass(player.config.teamId);
          this.audioService.playKick(FOOTBALL_CONFIG.PLAYER.PASS_POWER);
          this.playerService.playOneShot(player, 'Pass');
          player.ballControlled = false;
          this.setPassTarget(null); // le ballon a changé de pieds : nouvelle sélection pour le prochain porteur
        }
      }
      this.input.pass = false;
    }

    // Passe en profondeur (through ball — manette : bouton "1")
    if (this.input.passDeep && this.isPlayerNearBall(player)) {
      const ballPos = new BABYLON.Vector3(
        this.gameState.ball!.body.translation().x,
        this.gameState.ball!.body.translation().y,
        this.gameState.ball!.body.translation().z
      );
      const target = this.aiServiceHome.findDeepPassTarget(player, this.gameState.homePlayers, ballPos);
      if (target) {
        const targetPos = new BABYLON.Vector3(
          target.body.translation().x,
          target.body.translation().y,
          target.body.translation().z
        );
        this.ballService.pass(this.gameState.ball!, ballPos, targetPos, FOOTBALL_CONFIG.PLAYER.PASS_POWER * 1.5);
        this.gameState.ball!.lastTouch = { playerId: player.config.id, teamId: player.config.teamId, viaKick: true };
        this.checkOffsideOnPass(player.config.teamId);
        this.audioService.playKick(FOOTBALL_CONFIG.PLAYER.PASS_POWER * 1.5);
        this.playerService.playOneShot(player, 'Pass');
        player.ballControlled = false;
      }
      this.input.passDeep = false;
    }

    // Centre (cross — manette : bouton "2" quand le joueur a le ballon)
    if (this.input.crossLong && this.isPlayerNearBall(player)) {
      const ballPos = new BABYLON.Vector3(
        this.gameState.ball!.body.translation().x,
        this.gameState.ball!.body.translation().y,
        this.gameState.ball!.body.translation().z
      );
      const target = this.aiServiceHome.findCrossTarget(player, this.gameState.homePlayers);
      if (target) {
        const targetPos = new BABYLON.Vector3(
          target.body.translation().x,
          target.body.translation().y,
          target.body.translation().z
        );
        this.ballService.pass(this.gameState.ball!, ballPos, targetPos, FOOTBALL_CONFIG.PLAYER.PASS_POWER * 1.3);
        this.gameState.ball!.lastTouch = { playerId: player.config.id, teamId: player.config.teamId, viaKick: true };
        this.checkOffsideOnPass(player.config.teamId);
        this.audioService.playKick(FOOTBALL_CONFIG.PLAYER.PASS_POWER * 1.3);
        this.playerService.playOneShot(player, 'Chip');
        player.ballControlled = false;
      }
      this.input.crossLong = false;
    }

    // Tacle
    if (this.input.tackle) {
      this.attemptTackle(player);
      this.input.tackle = false;
    }

    // Changement de joueur — bug/demande corrigée : L1 servait UNIQUEMENT à changer de
    // joueur contrôlé (utile hors possession, pour presser/défendre), mais rien ne
    // permettait de choisir délibérément un destinataire de passe parmi les
    // coéquipiers proches EN possession du ballon — la "construction du jeu" (choisir
    // à qui on passe, de proche en proche, jusqu'à l'autre camp) demandée. En
    // possession, L1 fait donc maintenant défiler les coéquipiers proches (cible
    // marquée d'un cône bleu) au lieu de changer de joueur contrôlé.
    if (this.input.switchPlayer) {
      if (player.ballControlled) {
        this.cyclePassTarget(player);
      } else {
        this.switchToNearestPlayer();
        this.setPassTarget(null);
      }
      this.input.switchPlayer = false;
    }
  }

  /**
   * Tente un tacle sur l'adversaire le plus proche ; une faute déclenche
   * un coup franc/penalty (et éventuellement un carton) via RefereeService
   */
  private attemptTackle(player: PlayerInstance): void {
    if (player.tackleCooldown > 0 || this.refereeService.hasActiveDecision()) return;

    const opponents = player.config.teamId === 'home' ? this.gameState.awayPlayers : this.gameState.homePlayers;
    const playerPos = player.body.translation();

    const nearbyOpponent = opponents.find(o => {
      if (o.isSentOff) return false;
      const oPos = o.body.translation();
      const dist = Math.sqrt((oPos.x - playerPos.x) ** 2 + (oPos.z - playerPos.z) ** 2);
      return dist < FOOTBALL_CONFIG.PLAYER.TACKLE_RANGE + 1;
    });

    if (!nearbyOpponent) return;

    player.isTackling = true;
    player.tackleCooldown = FOOTBALL_CONFIG.PLAYER.TACKLE_COOLDOWN;
    this.playerService.playOneShot(player, 'Tackle');
    setTimeout(() => { player.isTackling = false; }, 300);

    const ball = this.gameState.ball!;
    const ballPos = new BABYLON.Vector3(ball.body.translation().x, ball.body.translation().y, ball.body.translation().z);
    const inPenaltyArea = this.refereeService.isInPenaltyArea(ballPos, player.config.teamId);
    const decision = this.refereeService.checkFoul(player, ballPos, inPenaltyArea);

    if (decision) {
      this.evaluateAdvantage(decision, nearbyOpponent.config.teamId);
    } else {
      // Tacle propre : le ballon est repris en direction du tacleur
      const pushDir = new BABYLON.Vector3(ballPos.x - playerPos.x, 0, ballPos.z - playerPos.z).normalize();
      ball.body.applyImpulse(new RAPIER.Vector3(pushDir.x * 3, 0.3, pushDir.z * 3), true);
      ball.lastTouch = { playerId: player.config.id, teamId: player.config.teamId };
    }
  }

  /**
   * Règle de l'avantage : plutôt que de siffler immédiatement une faute simple (sans
   * carton, hors surface), laisse jouer ~1,5s. Si l'équipe fautée garde une possession
   * utile du ballon pendant ce délai, la faute est oubliée (pas de coup franc) — sinon
   * elle est sifflée rétroactivement, à l'endroit exact où elle a eu lieu. Les cartons et
   * penalties, eux, sont toujours sifflés immédiatement (l'avantage ne s'applique jamais
   * aux sanctions disciplinaires, et une faute dans la surface doit être signalée tout de
   * suite pour ne pas laisser planer le doute sur un penalty).
   */
  private evaluateAdvantage(decision: RefereeDecision, fouledTeam: 'home' | 'away'): void {
    if (decision.card || decision.type === 'penalty') {
      this.handleRefereeDecision(decision);
      return;
    }

    this.showRefereeNotification('👐 Avantage !');
    const ball = this.gameState.ball!;

    setTimeout(() => {
      if (!this.gameState || this.gameState.match.isGoalScored || this.gameState.match.isPaused) return;
      const advantagePlayed = ball.lastTouch?.teamId === fouledTeam;
      if (advantagePlayed) {
        this.refereeService.clearDecision();
      } else {
        this.handleRefereeDecision(decision);
      }
    }, 1500);
  }

  /**
   * Vérifie le hors-jeu au moment d'une passe et arrête le jeu si nécessaire
   */
  /** Direction (signe Z) vers laquelle cette équipe attaque ; tient compte du changement de camp à la mi-temps */
  private attackingDirection(teamId: 'home' | 'away'): 1 | -1 {
    const base: 1 | -1 = teamId === 'home' ? 1 : -1;
    return this.sideSwapped ? (-base as 1 | -1) : base;
  }

  /**
   * Indicateur "de quel côté je suis" (HUD) : le joueur humain contrôle toujours
   * l'équipe domicile (l'IA gère l'équipe extérieure en entier, cf. handleAIBallActions),
   * sauf en auto-play où personne n'est humain. Avec la convention caméra établie (axe Z
   * monde = horizontal écran, Z positif = droite — cf. correctif des flèches
   * directionnelles), le signe de `attackingDirection('home')` donne directement le
   * côté écran vers lequel le joueur humain attaque.
   */
  get humanAttackingSideLabel(): string {
    return this.attackingDirection('home') > 0 ? 'Droite →' : '← Gauche';
  }

  /**
   * Changement de camp à la mi-temps (et entre les 2 prolongations) : les deux
   * équipes inversent le but qu'elles défendent. Sans ça, une équipe défendrait
   * indéfiniment le même but, ce qui n'est pas le football — et ça évite la
   * confusion "qui est à droite/à gauche" signalée par l'utilisateur, puisque
   * chaque équipe reste identifiable par sa couleur de maillot, pas par son côté.
   */
  private swapSides(kickoffTeam?: 'home' | 'away'): void {
    this.sideSwapped = !this.sideSwapped;
    this.repositionPlayersToFormation(kickoffTeam);

    this.aiServiceHome.setSideSwapped(this.sideSwapped);
    this.aiServiceAway.setSideSwapped(this.sideSwapped);
    this.ballService.setSideSwapped(this.sideSwapped);
    this.refereeService.setSideSwapped(this.sideSwapped);
  }

  /**
   * Replace tous les joueurs à leur poste de formation (coup d'envoi/engagement) sans
   * changer de camp — utilisé après la célébration d'un but et à chaque coup d'envoi de
   * période. `swapSides()` réutilise cette même repositions puis inverse en plus le camp.
   * Si `kickoffTeam` est fourni, place en plus 2 joueurs de cette équipe au rond central
   * pour le vrai coup d'envoi (cf. setupKickoffPair).
   */
  private repositionPlayersToFormation(kickoffTeam?: 'home' | 'away'): void {
    const sign = this.sideSwapped ? -1 : 1;
    [...this.gameState.homePlayers, ...this.gameState.awayPlayers].forEach(p => {
      const y = p.body.translation().y;
      p.body.setTranslation(new RAPIER.Vector3(p.config.initialX, y, sign * p.config.initialZ), true);
      p.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
    });
    if (kickoffTeam) this.setupKickoffPair(kickoffTeam);
  }

  /**
   * Vrai coup d'envoi : place 2 joueurs de l'équipe qui engage (2 attaquants, ou 1
   * attaquant + 1 milieu selon la formation) côte à côte au rond central, sur leur
   * propre moitié de terrain — le reste de l'équipe garde sa formation normale. Sans
   * ça, les 22 joueurs restaient figés en formation complète et le ballon immobile au
   * centre, qu'aucun joueur ne venait jamais explicitement mettre en jeu.
   * `triggerKickoffPass()` doit être appelé séparément, au moment exact où le jeu
   * reprend réellement (après le sifflet).
   */
  private setupKickoffPair(kickoffTeam: 'home' | 'away'): void {
    this.lastKickoffTeam = kickoffTeam;
    const players = kickoffTeam === 'home' ? this.gameState.homePlayers : this.gameState.awayPlayers;
    const ownSign = -this.attackingDirection(kickoffTeam); // leur propre moitié = opposé de leur sens d'attaque
    const forwards = players.filter(p => !p.isSentOff && p.config.role === 'fwd');
    const mids = players.filter(p => !p.isSentOff && p.config.role === 'mid');
    const pair = (forwards.length >= 2 ? forwards : [...forwards, ...mids]).slice(0, 2);
    this.kickoffPair = pair.length >= 2 ? { taker: pair[0], receiver: pair[1] } : null;
    if (!this.kickoffPair) return;

    const { taker, receiver } = this.kickoffPair;
    const y = taker.body.translation().y;
    taker.body.setTranslation(new RAPIER.Vector3(-1.3, y, ownSign * 1.3), true);
    taker.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
    receiver.body.setTranslation(new RAPIER.Vector3(1.3, y, ownSign * 1.3), true);
    receiver.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
  }

  /** Petite passe d'ouverture entre les 2 joueurs placés par `setupKickoffPair()` —
   * met réellement le ballon en jeu, comme un vrai coup d'envoi télévisé. */
  private triggerKickoffPass(): void {
    const pair = this.kickoffPair;
    this.kickoffPair = null;
    if (!pair || pair.taker.isSentOff || !this.gameState?.ball) return;
    const takerPos = pair.taker.body.translation();
    const receiverPos = pair.receiver.body.translation();
    this.ballService.pass(
      this.gameState.ball,
      new BABYLON.Vector3(takerPos.x, takerPos.y, takerPos.z),
      new BABYLON.Vector3(receiverPos.x, receiverPos.y, receiverPos.z),
      FOOTBALL_CONFIG.PLAYER.PASS_POWER * 0.5,
    );
    this.gameState.ball.lastTouch = { playerId: pair.taker.config.id, teamId: pair.taker.config.teamId, viaKick: true };
    this.playerService.playOneShot(pair.taker, 'Pass');
  }

  private checkOffsideOnPass(passingTeam: 'home' | 'away'): void {
    const ball = this.gameState.ball!;
    const ballPos = new BABYLON.Vector3(ball.body.translation().x, ball.body.translation().y, ball.body.translation().z);
    const isHome = passingTeam === 'home';
    const attackers = isHome ? this.gameState.homePlayers : this.gameState.awayPlayers;
    const defenders = isHome ? this.gameState.awayPlayers : this.gameState.homePlayers;

    const offsidePlayer = this.refereeService.checkOffside(attackers, defenders, ballPos, this.attackingDirection(passingTeam));
    if (offsidePlayer) {
      const pos = offsidePlayer.body.translation();
      this.showRefereeNotification(`🚩 Hors-jeu ! ${offsidePlayer.config.name}`);
      this.audioService.playWhistle(false);
      this.ballService.reset(new BABYLON.Vector3(pos.x, 0.3, pos.z));
    }
  }

  /**
   * Applique une décision arbitrale (coup franc, penalty, carton) : notifie et repositionne le ballon
   */
  private handleRefereeDecision(decision: RefereeDecision): void {
    const restartPos = decision.type === 'penalty'
      ? this.refereeService.getPenaltyPosition(decision.team)
      : this.refereeService.getFreeKickPosition(decision);

    this.audioService.playWhistle(false);
    this.addStoppageTime(decision.card ? 12 : 6); // arrêt de jeu plus long si un carton est montré

    if (decision.card === 'red') {
      this.showRefereeNotification(`🔴 Carton rouge ! ${decision.player?.config.name}`);
      this.audioService.playCard('red');
      this.audioService.speak(`Carton rouge pour ${decision.player?.config.name} !`);
    } else if (decision.card === 'yellow') {
      this.showRefereeNotification(`🟡 Carton jaune ! ${decision.player?.config.name}`);
      this.audioService.playCard('yellow');
    } else if (decision.type === 'penalty') {
      this.showRefereeNotification('🔴 Penalty !');
    } else {
      this.showRefereeNotification(decision.restartKind === 'indirect' ? '🟡 Coup franc indirect' : '🟡 Coup franc direct');
    }

    // Mur défensif à 9,15m pour un coup franc (direct ou indirect) dangereux
    if (decision.type === 'freeKick') {
      this.formDefensiveWall(decision, restartPos);
    }

    setTimeout(() => {
      this.ballService.reset(new BABYLON.Vector3(restartPos.x, 0.3, restartPos.z));
      this.setPieceActive = false;
    }, 1500);
  }

  /**
   * Place les défenseurs les plus proches en mur à 9,15m du ballon (règle FIFA), sur la
   * ligne ballon→but ; gèle brièvement le jeu (comme une célébration de but) le temps que
   * le mur se mette en place, sans quoi l'IA les remettrait en mouvement instantanément.
   */
  private formDefensiveWall(decision: RefereeDecision, ballPos: BABYLON.Vector3): void {
    const defendingTeam = decision.team === 'home' ? 'away' : 'home';
    const defenders = (defendingTeam === 'home' ? this.gameState.homePlayers : this.gameState.awayPlayers)
      .filter(p => !p.isSentOff && p.config.role !== 'gk');
    if (defenders.length === 0) return;

    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const ownGoalZ = -this.attackingDirection(defendingTeam) * halfL;
    const positions = this.refereeService.getWallPositions(ballPos, ownGoalZ, defenders.length);
    if (positions.length === 0) return;

    this.setPieceActive = true;

    const sorted = [...defenders].sort((a, b) => {
      const da = (a.body.translation().x - ballPos.x) ** 2 + (a.body.translation().z - ballPos.z) ** 2;
      const db = (b.body.translation().x - ballPos.x) ** 2 + (b.body.translation().z - ballPos.z) ** 2;
      return da - db;
    });

    positions.forEach((pos, i) => {
      const p = sorted[i];
      const y = p.body.translation().y;
      p.body.setTranslation(new RAPIER.Vector3(pos.x, y, pos.z), true);
      p.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
    });
  }

  private showRefereeNotification(text: string): void {
    this.refereeNotification = text;
    this.refereeNotificationVisible = true;
    setTimeout(() => { this.refereeNotificationVisible = false; }, 2500);
  }

  /**
   * Bug corrigé ("chaque tir est un but") : `ballService.kick()` n'a aucune dispersion
   * propre — la direction fournie est suivie exactement, à pleine puissance. Sans
   * variation, un tir vers le centre exact de la cage à puissance max finissait presque
   * toujours au fond des filets, quel que soit l'angle/la distance/le tireur. Ajoute une
   * déviation latérale aléatoire, d'autant plus grande que le tir est lointain et le
   * tireur peu adroit (`shotPower`, 5-25) — un featureur excellent proche du but reste
   * très précis, un tir lointain d'un joueur moyen peut nettement rater le cadre.
   */
  private applyShotAccuracy(direction: BABYLON.Vector3, shooter: PlayerInstance, ballPos: BABYLON.Vector3, goalPos: BABYLON.Vector3): BABYLON.Vector3 {
    const distance = BABYLON.Vector3.Distance(ballPos, goalPos);
    const skillFactor = Math.min(1, Math.max(0, (shooter.config.shotPower - 5) / 20)); // 0 (faible) à 1 (excellent)
    const maxDeviation = (distance / 25) * (1 - skillFactor * 0.75) * 6; // jusqu'à ~6 m à 25m+ pour un tireur faible
    const deviation = (Math.random() - 0.5) * 2 * maxDeviation;
    const perpendicular = new BABYLON.Vector3(-direction.z, 0, direction.x).normalize();
    return direction.add(perpendicular.scale(deviation));
  }

  private isPlayerNearBall(player: PlayerInstance): boolean {
    const ballPos = this.gameState.ball!.body.translation();
    const playerPos = player.body.translation();
    const dx = ballPos.x - playerPos.x;
    const dz = ballPos.z - playerPos.z;
    return Math.sqrt(dx * dx + dz * dz) < 1.5;
  }

  /**
   * Décisions IA avec le ballon : tir ou passe quand un joueur IA (des deux
   * équipes) est près du ballon. Sans ça, shouldShoot/shouldPass/findBestPassTarget
   * (ai.service.ts) ne sont jamais appelées et l'IA ne fait que courir autour
   * du ballon sans jamais l'envoyer où que ce soit.
   */
  private handleAIBallActions(): void {
    const ball = this.gameState.ball!;
    const ballPos = new BABYLON.Vector3(ball.body.translation().x, ball.body.translation().y, ball.body.translation().z);

    const decideForTeam = (
      players: PlayerInstance[],
      aiService: AIService,
      isHome: boolean,
      skip: PlayerInstance | null,
    ): void => {
      // Bug corrigé (même défaut que le tir humain) : ce signe utilisait `isHome`
      // directement, sans tenir compte du changement de côté à la mi-temps.
      const opponentGoal = new BABYLON.Vector3(0, 1, this.attackingDirection(isHome ? 'home' : 'away') * FOOTBALL_CONFIG.FIELD.LENGTH / 2);

      for (const player of players) {
        if (player.isSentOff || player === skip) continue;
        if (player.ballActionCooldown > 0) continue;
        if (!this.isPlayerNearBall(player)) continue;

        const playerPos = player.body.translation();
        const posVec = new BABYLON.Vector3(playerPos.x, playerPos.y, playerPos.z);

        // Construction de jeu : un joueur excentré dans le dernier tiers centre plutôt
        // que de tenter un tir à angle fermé (shouldShoot l'exclut désormais de toute
        // façon) ou une passe latérale sans intérêt — c'est le vrai geste du football
        // dans cette situation (centrer vers la surface, pas rabattre sur le côté).
        const distToGoalZ = Math.abs(opponentGoal.z - posVec.z);
        const lateralOffset = Math.abs(posVec.x - opponentGoal.x);
        const isWideAttackingThird = distToGoalZ < 35 && lateralOffset > 15;

        if (isWideAttackingThird && Math.random() < 0.5) {
          const target = aiService.findCrossTarget(player, players);
          if (target) {
            const targetPos = target.body.translation();
            this.ballService.pass(ball, posVec, new BABYLON.Vector3(targetPos.x, targetPos.y, targetPos.z), FOOTBALL_CONFIG.PLAYER.PASS_POWER * 1.3);
            ball.lastTouch = { playerId: player.config.id, teamId: player.config.teamId, viaKick: true };
            player.ballActionCooldown = 1.4;
            this.audioService.playKick(FOOTBALL_CONFIG.PLAYER.PASS_POWER * 1.3);
            this.playerService.playOneShot(player, 'Chip');
          }
        } else if (aiService.shouldShoot(player, posVec, opponentGoal)) {
          const direction = this.applyShotAccuracy(opponentGoal.subtract(posVec), player, posVec, opponentGoal);
          direction.y = 0.5;
          this.ballService.kick(ball, direction, FOOTBALL_CONFIG.PLAYER.KICK_POWER_MAX * 0.8);
          ball.lastTouch = { playerId: player.config.id, teamId: player.config.teamId, viaKick: true };
          player.ballActionCooldown = 1.5;
          this.audioService.playKick(FOOTBALL_CONFIG.PLAYER.KICK_POWER_MAX * 0.8);
          this.refereeService.updateStats('shot', player.config.teamId, true);
          this.playerService.playOneShot(player, 'Shoot');
        } else if (aiService.shouldPass(player, players, posVec)) {
          const target = aiService.findBestPassTarget(player, players, posVec);
          if (target) {
            const targetPos = target.body.translation();
            this.ballService.pass(ball, posVec, new BABYLON.Vector3(targetPos.x, targetPos.y, targetPos.z));
            ball.lastTouch = { playerId: player.config.id, teamId: player.config.teamId, viaKick: true };
            player.ballActionCooldown = 1.2;
            this.audioService.playKick(FOOTBALL_CONFIG.PLAYER.PASS_POWER);
            this.playerService.playOneShot(player, 'Pass');
          }
        }
      }
    };

    // Domicile : l'IA ne décide que pour les coéquipiers du joueur humain, jamais pour lui
    // (sauf en auto-play, où elle décide aussi pour lui — les deux équipes s'affrontent seules)
    decideForTeam(this.gameState.homePlayers, this.aiServiceHome, true, this.autoPlayEnabled ? null : this.gameState.controlledPlayer);
    // Extérieur : équipe entièrement IA
    decideForTeam(this.gameState.awayPlayers, this.aiServiceAway, false, null);
  }

  private switchToNearestPlayer(): void {
    const ballPos = new BABYLON.Vector3(
      this.gameState.ball!.body.translation().x,
      0,
      this.gameState.ball!.body.translation().z
    );
    this.gameState.controlledPlayer = this.playerService.getClosestToBall('home', ballPos);
  }

  /** Bouton "3" au tout premier contact avec le ballon : ni un tir (bouton "4"), ni une
   * passe/un centre (bouton "3" une fois le ballon maîtrisé, ou bouton "2") — juste une
   * LÉGÈRE poussée du ballon devant le joueur (ou dans la direction tenue au stick/
   * clavier au moment de l'appui), à charge pour lui de courir après pour le rattraper.
   * Vitesse fixe et volontairement faible (très en dessous de la vitesse de course) :
   * l'ancienne version amortissait juste la vitesse existante du ballon (×0,12), ce qui
   * ne poussait RIEN quand il était déjà quasi immobile, et pouvait sembler propulser le
   * ballon au loin quand il arrivait vite (contact perçu comme "un tir"). Marque le
   * ballon comme maîtrisé (ballControlled) : une seconde pression sur "3" devient alors
   * une passe (cf. handlePlayerInput) au lieu de re-déclencher une prise de contrôle. */
  private takeBallControl(player: PlayerInstance): void {
    const ball = this.gameState.ball!;
    const moveDir = new BABYLON.Vector3(this.input.moveX, 0, this.input.moveZ);
    const pushDir = moveDir.length() > 0.01
      ? moveDir.normalize()
      : new BABYLON.Vector3(Math.sin(player.mesh.rotation.y), 0, Math.cos(player.mesh.rotation.y));
    const CONTROL_NUDGE_SPEED = 5; // m/s — nettement sous SPEED (7) et SPRINT_SPEED (10) : le joueur rattrape le ballon en courant
    ball.body.setLinvel(new RAPIER.Vector3(pushDir.x * CONTROL_NUDGE_SPEED, 0, pushDir.z * CONTROL_NUDGE_SPEED), true);
    ball.body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);
    ball.lastTouch = { playerId: player.config.id, teamId: player.config.teamId };
    player.ballControlled = true;
  }

  /** Change/efface le cône bleu de cible de passe (jamais deux affichés en même temps) */
  private setPassTarget(target: PlayerInstance | null): void {
    if (this.selectedPassTarget) this.selectedPassTarget.passTargetMarker.isVisible = false;
    this.selectedPassTarget = target;
    if (target) target.passTargetMarker.isVisible = true;
  }

  /** Fait défiler les coéquipiers les plus proches (hors gardien, hors soi-même) comme
   * destinataire de la prochaine passe courte (E / bouton "3") — construction du jeu :
   * L1 répété fait tourner la sélection parmi les options réellement proches, plutôt
   * qu'une passe automatique systématique vers la "meilleure" cible calculée. */
  private cyclePassTarget(passer: PlayerInstance): void {
    const passerPos = passer.body.translation();
    const candidates = this.gameState.homePlayers
      .filter(p => p !== passer && !p.isSentOff && p.config.role !== 'gk')
      .sort((a, b) => {
        const da = a.body.translation(); const db = b.body.translation();
        const distA = (da.x - passerPos.x) ** 2 + (da.z - passerPos.z) ** 2;
        const distB = (db.x - passerPos.x) ** 2 + (db.z - passerPos.z) ** 2;
        return distA - distB;
      });
    if (candidates.length === 0) return;

    const currentIndex = this.selectedPassTarget ? candidates.indexOf(this.selectedPassTarget) : -1;
    const next = candidates[(currentIndex + 1) % candidates.length];
    this.setPassTarget(next);
  }

  // ─── Détection des collisions ────────────────────────────────────────

  private checkBallCollisions(deltaTime: number): void {
    const ball = this.gameState.ball!;
    const ballPos = ball.body.translation();
    const ballVec = new BABYLON.Vector3(ballPos.x, ballPos.y, ballPos.z);

    // Magnétisme joueur-ballon (demande : "que le ballon se laisse contrôler
    // facilement" à proximité) — un ballon LENT/perdu juste hors de portée de contrôle
    // immédiate (0,8 m) est légèrement attiré vers le joueur le plus proche dans un
    // rayon élargi, en match réel comme à l'entraînement (checkBallCollisions() est déjà
    // appelée dans les deux cas, aucune branche spécifique nécessaire). Un seuil de
    // vitesse évite de perturber un ballon qui vole encore (passe/tir/dégagement en
    // cours) : l'assist n'aide qu'à RÉCUPÉRER un ballon déjà quasi immobile, jamais à en
    // détourner un en plein vol.
    const MAGNET_RADIUS = 2.2;
    const MAGNET_MAX_BALL_SPEED = 3.5;
    const MAGNET_ACCEL = 3.5; // m/s² — doux, pas un aimant qui téléporte
    let magnetTarget: PlayerInstance | null = null;
    let magnetDist = Infinity;

    // Vérifier les contacts avec les joueurs
    const allPlayers = [...this.gameState.homePlayers, ...this.gameState.awayPlayers];
    for (const player of allPlayers) {
      if (player.isSentOff) continue;

      // Main : ballon aérien (hauteur de bras) près d'un défenseur dans sa propre surface.
      // Réaction instinctive rare (bras levé) distinguée d'une simple position naturelle
      // (bras dans l'amplitude de course normale, cf. referee.service.ts checkHandball).
      if (ballPos.y > 0.5 && player.config.role !== 'gk' && !this.refereeService.hasActiveDecision()) {
        const dxArea = ballPos.x - player.body.translation().x;
        const dzArea = ballPos.z - player.body.translation().z;
        if (dxArea * dxArea + dzArea * dzArea < 4
          && this.refereeService.isInPenaltyArea(ballVec, player.config.teamId)
          && Math.random() < 0.006) {
          player.armPivots[0].rotation.x = 1.0;
          player.armPivots[1].rotation.x = 1.0;
        }

        const handball = this.refereeService.checkHandball(player, ballVec);
        if (handball?.isDeliberate) {
          const inPenaltyArea = this.refereeService.isInPenaltyArea(ballVec, player.config.teamId);
          const decision = this.refereeService.awardHandball(player, new BABYLON.Vector3(ballPos.x, 0, ballPos.z), inPenaltyArea);
          this.handleRefereeDecision(decision);
          continue;
        }
      }

      const playerPos = player.body.translation();
      const dx = ballPos.x - playerPos.x;
      const dz = ballPos.z - playerPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.8) {
        // Passe en retrait illégale (loi 12.2) : le gardien ne peut pas prendre le ballon
        // à la main si un coéquipier vient de le lui jouer volontairement au pied
        if (player.config.role === 'gk' && ball.lastTouch?.viaKick
          && ball.lastTouch.teamId === player.config.teamId
          && ball.lastTouch.playerId !== player.config.id
          && !this.refereeService.hasActiveDecision()) {
          const decision = this.refereeService.awardBackPassOffense(player, new BABYLON.Vector3(ballPos.x, 0, ballPos.z));
          this.handleRefereeDecision(decision);
          ball.lastTouch = { playerId: player.config.id, teamId: player.config.teamId };
          continue;
        }

        // Collision ! Le joueur touche le ballon. Le contact ne dure parfois qu'une
        // fraction de seconde (le ballon est aussitôt repoussé/tiré) : l'anneau reste
        // affiché un court instant après (ringLingerTimer, décrémenté dans updateGame)
        // plutôt que de disparaître instantanément dès que `hasBall` redevient faux.
        const isNewContact = !player.hasBall;
        ball.lastTouch = { playerId: player.config.id, teamId: player.config.teamId };
        player.hasBall = true;
        player.ringLingerTimer = 0.4;
        player.ballCarrierRing.isVisible = this.showBallCarrierRing;

        // Bug corrigé (contrôle de balle peu fiable, "le joueur est à côté du ballon
        // mais ne le contrôle pas") : cette impulsion s'appliquait à CHAQUE frame tant
        // que le joueur restait à moins de 0,6 m du ballon — donc en continu pendant tout
        // le temps où un joueur essayait de le contrôler/dribbler, repoussant le ballon
        // hors de portée en boucle au lieu de le laisser suivre le porteur. Appliquée
        // maintenant une seule fois, au moment précis du PREMIER contact (front montant
        // de `hasBall`), comme une réception/déviation ponctuelle — pas à chaque frame
        // où le joueur reste simplement à proximité en le dribblant.
        if (isNewContact) {
          const pushDir = new BABYLON.Vector3(dx, 0, dz).normalize();
          ball.body.applyImpulse(
            new RAPIER.Vector3(pushDir.x * 2, 0.5, pushDir.z * 2),
            true
          );
        }
      } else {
        player.hasBall = false;
        player.ballControlled = false;
        if (dist < MAGNET_RADIUS && dist < magnetDist) {
          magnetTarget = player;
          magnetDist = dist;
        }
      }
    }

    if (magnetTarget) {
      const vel = ball.body.linvel();
      const ballSpeed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
      if (ballSpeed < MAGNET_MAX_BALL_SPEED) {
        const tp = magnetTarget.body.translation();
        const pull = new BABYLON.Vector3(tp.x - ballPos.x, 0, tp.z - ballPos.z).normalize();
        ball.body.setLinvel(
          new RAPIER.Vector3(vel.x + pull.x * MAGNET_ACCEL * deltaTime, vel.y, vel.z + pull.z * MAGNET_ACCEL * deltaTime),
          true
        );
      }
    }

    this.updateShotPowerGauges();
  }

  /** Jauge de puissance de tir (demande : "une jauge en bas de l'écran pour indiquer la
   * puissance du tir de chaque porteur du ballon, pour chaque équipe, en tutoriel comme
   * en match réel") — reflète la stat shotPower (5-25, cf. PLAYER.KICK_POWER_MIN/MAX)
   * du porteur actuel de chaque équipe, la même normalisation déjà utilisée pour le
   * facteur de précision du tir (cf. applyShotAccuracy skillFactor). Vide/masquée côté
   * template quand personne de ce camp n'a le ballon (this.gameState.home/awayPlayers
   * n'a alors aucun hasBall=true), pas de valeur figée trompeuse. */
  private updateShotPowerGauges(): void {
    const carrierHome = this.gameState.homePlayers.find(p => p.hasBall && !p.isSentOff);
    const carrierAway = this.gameState.awayPlayers.find(p => p.hasBall && !p.isSentOff);
    this.homeShotPowerCarrier = carrierHome
      ? { name: carrierHome.config.name, number: carrierHome.config.number, pct: this.shotPowerToPct(carrierHome.config.shotPower) }
      : null;
    this.awayShotPowerCarrier = carrierAway
      ? { name: carrierAway.config.name, number: carrierAway.config.number, pct: this.shotPowerToPct(carrierAway.config.shotPower) }
      : null;
  }

  private shotPowerToPct(shotPower: number): number {
    const { KICK_POWER_MIN, KICK_POWER_MAX } = FOOTBALL_CONFIG.PLAYER;
    return Math.round(Math.min(1, Math.max(0, (shotPower - KICK_POWER_MIN) / (KICK_POWER_MAX - KICK_POWER_MIN))) * 100);
  }

  // ─── Vérification des buts ───────────────────────────────────────────

  private checkGoals(): void {
    const ball = this.gameState.ball!;
    const goalTeam = this.ballService.checkGoal(ball);

    if (goalTeam) {
      // Ballon "rangé" visuellement dans le filet dès la détection du but : le filet
      // (stadium.service.ts) est un mesh purement visuel, sans aucun collider physique
      // dans tout le module — sans ce recadrage, le ballon continuait sa trajectoire au
      // moment du but et finissait souvent visible hors du filet plutôt que dedans.
      const pos = ball.body.translation();
      const { GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH, LENGTH } = FOOTBALL_CONFIG.FIELD;
      const zSign = pos.z > 0 ? 1 : -1;
      const netZ = zSign * (LENGTH / 2 + GOAL_DEPTH * 0.5);
      const clampedX = BABYLON.Scalar.Clamp(pos.x, -GOAL_WIDTH / 2 + 0.3, GOAL_WIDTH / 2 - 0.3);
      const clampedY = BABYLON.Scalar.Clamp(pos.y, 0.3, GOAL_HEIGHT - 0.3);
      ball.body.setTranslation(new RAPIER.Vector3(clampedX, clampedY, netZ), true);
      ball.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
      ball.body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);

      const scoringTeam = goalTeam === 'home' ? 'away' : 'home'; // L'équipe qui marque est l'inverse de celle qui encaisse

      // Bug corrigé : un but marqué pendant un atelier du Tutoriel déclenchait toute la
      // machinerie d'un VRAI match (score, notification "But de <équipe>", commentaire
      // vocal, célébration des tribunes, ralenti...) — hors-sujet en entraînement, où
      // "l'adversaire" auto-assigné n'a même pas de sens pour le joueur. On bifurque tôt
      // vers un retour pédagogique léger, sans toucher au score ni au flux de match réel.
      if (this.trainingMode) {
        this.handleTrainingGoal();
        return;
      }

      this.gameState.match.score[scoringTeam]++;
      this.gameState.match.isGoalScored = true;
      this.gameState.match.goalScoredTeam = scoringTeam;
      this.gameState.match.goalScoredTimer = 3; // Célébration de 3 secondes
      this.addStoppageTime(15); // temps additionnel pour la célébration

      // Événement
      const scorer = ball.lastTouch;
      this.refereeService.createEvent(
        'but',
        scorer?.playerId,
        scoringTeam,
        `⚽ But! ${scoringTeam === 'home' ? this.gameState.homeTeam.name : this.gameState.awayTeam.name} marque!`
      );

      // Notification
      const scoringTeamName = scoringTeam === 'home' ? this.gameState.homeTeam.name : this.gameState.awayTeam.name;
      this.showGoalNotification(scoringTeamName);
      this.audioService.playGoalHorn();
      this.audioService.speak(`Goaaal ! ${scoringTeamName} marque !`);
      this.crowdService?.celebrate(scoringTeam);
      this.celebratePlayersGoal(scoringTeam, scorer?.playerId);

      // Sauvegarde des dernières secondes avant le but pour le ralenti (menu contextuel)
      this.lastGoalReplay = [...this.replayBuffer];

      // Réinitialiser le ballon et les joueurs (coup d'envoi) après la célébration,
      // sauf si l'utilisateur la stoppe plus tôt via le menu contextuel
      this.goalCelebrationTimeout = setTimeout(() => this.endGoalCelebration(), 3000);
    }
  }

  /**
   * Retour "but" en atelier — pédagogique, jamais le style match (pas de score, pas de
   * nom d'équipe, pas de commentaire vocal, pas de célébration de tribune). Le penalty
   * gère déjà sa propre relance (resolvePenalty()) : ici on ne relance que pour les
   * ateliers qui n'ont pas leur propre boucle (Tir libre, Coup franc...).
   */
  private handleTrainingGoal(): void {
    this.showRefereeNotification('🎯 But ! Objectif atteint.');
    this.audioService.playKick(0.6);
    if (!this.penaltyTrainingActive) {
      setTimeout(() => this.ballService.reset(), 1200);
    }
  }

  /**
   * Célébration des joueurs eux-mêmes (indépendante de celle des tribunes, cf.
   * `CrowdService.celebrate`) : le buteur identifié (`scorer.playerId`) fait le salto
   * (`CelebrationFlip`, un clip Mixamo importé dès la Phase 8 mais jamais déclenché
   * jusqu'ici), ses équipiers passent en boucle `IdleHappy`. Utilise
   * `playCelebrationLoop` (contourne volontairement le garde-fou `oneShotTimer` de
   * `setBaseAnimation`) car `syncPositions()` — qui piloterait normalement ce
   * state-machine — est en pause tant que `isGoalScored` est vrai (cf.
   * `startGameLoop()`) : sans ce contournement, l'appel serait silencieusement ignoré.
   */
  private celebratePlayersGoal(scoringTeam: 'home' | 'away', scorerId: number | undefined): void {
    const players = scoringTeam === 'home' ? this.gameState.homePlayers : this.gameState.awayPlayers;
    const scorer = scorerId !== undefined ? players.find(p => p.config.id === scorerId) : undefined;
    players.forEach(p => {
      if (p.isSentOff) return;
      if (p === scorer) {
        this.playerService.playOneShot(p, 'CelebrationFlip');
      } else {
        this.playerService.playCelebrationLoop(p);
      }
    });
  }

  /**
   * Termine la célébration de but (naturellement après 3s, ou immédiatement si
   * l'utilisateur clique "Stopper la célébration" dans le menu contextuel) : ballon
   * ET joueurs sont replacés à leur poste, comme un vrai coup d'envoi/engagement.
   */
  private endGoalCelebration(): void {
    if (this.goalCelebrationTimeout) {
      clearTimeout(this.goalCelebrationTimeout);
      this.goalCelebrationTimeout = null;
    }
    if (!this.gameState?.match.isGoalScored) return;
    const scoringTeam = this.gameState.match.goalScoredTeam;
    this.gameState.match.isGoalScored = false;
    this.gameState.match.goalScoredTeam = null;
    this.ballService.reset(new BABYLON.Vector3(0, 0.3, 0));
    // L'équipe qui encaisse engage (règle du foot)
    this.repositionPlayersToFormation(scoringTeam === 'home' ? 'away' : 'home');
    setTimeout(() => this.triggerKickoffPass(), 400);
  }

  // ─── Ralenti / revoir le but (menu contextuel) ─────────────────────────

  /** Empile un instantané des positions courantes ; le plus ancien est retiré au-delà de ~4s */
  private recordReplayFrame(): void {
    const state = this.gameState;
    if (!state?.ball) return;
    const ballPos = state.ball.body.translation();
    const frame: ReplayFrame = {
      ball: { x: ballPos.x, y: ballPos.y, z: ballPos.z },
      players: [...state.homePlayers, ...state.awayPlayers].map(p => ({
        id: p.config.id,
        teamId: p.config.teamId,
        x: p.mesh.position.x,
        z: p.mesh.position.z,
        rotY: p.mesh.rotation.y,
      })),
    };
    this.replayBuffer.push(frame);
    if (this.replayBuffer.length > this.REPLAY_BUFFER_MAX_FRAMES) {
      this.replayBuffer.shift();
    }
  }

  /** Lit le tampon du dernier but au ralenti (2x plus lent que le direct), en pilotant les meshes directement */
  private playGoalReplay(): void {
    if (this.replayActive || !this.gameState || !this.lastGoalReplay || this.lastGoalReplay.length < 2) return;
    this.replayActive = true;
    this.gameState.match.isPaused = true;
    this.replayFrameIndex = 0;

    this.replayPlaybackTimer = setInterval(() => {
      if (!this.lastGoalReplay || this.replayFrameIndex >= this.lastGoalReplay.length) {
        this.stopGoalReplay();
        return;
      }
      this.applyReplayFrame(this.lastGoalReplay[this.replayFrameIndex]);
      this.replayFrameIndex++;
    }, 66); // 2x plus lent qu'un enregistrement à ~33ms/frame
  }

  private applyReplayFrame(frame: ReplayFrame): void {
    const state = this.gameState;
    if (!state?.ball) return;
    state.ball.mesh.position.set(frame.ball.x, frame.ball.y, frame.ball.z);
    const allPlayers = [...state.homePlayers, ...state.awayPlayers];
    for (const fp of frame.players) {
      const player = allPlayers.find(p => p.config.id === fp.id && p.config.teamId === fp.teamId);
      if (!player) continue;
      player.mesh.position.set(fp.x, player.mesh.position.y, fp.z);
      player.mesh.rotation.y = fp.rotY;
    }
  }

  private stopGoalReplay(): void {
    if (this.replayPlaybackTimer) {
      clearInterval(this.replayPlaybackTimer);
      this.replayPlaybackTimer = null;
    }
    this.replayActive = false;
    if (this.gameState) this.gameState.match.isPaused = false;
  }

  // ─── Vérification des sorties ────────────────────────────────────────

  private checkOutOfBounds(): void {
    // Un but vient d'être marqué cette frame (checkGoals()) : déjà traité, ne
    // pas retraiter la même sortie de balle comme une touche/corner/six mètres
    if (this.gameState.match.isGoalScored) return;

    const ball = this.gameState.ball!;
    const outType = this.ballService.checkOutOfBounds(ball);

    if (outType) {
      const decision = this.refereeService.determineRestart(
        new BABYLON.Vector3(ball.body.translation().x, 0, ball.body.translation().z),
        ball.lastTouch
      );

      if (decision) {
        switch (decision.type) {
          case 'corner':
            this.refereeService.createEvent('corner', undefined, decision.team, '🚩 Corner');
            break;
          case 'goalKick':
            this.refereeService.createEvent('six-metres', undefined, decision.team, '🥅 Six mètres');
            break;
          case 'throwIn':
            this.refereeService.createEvent('touche', undefined, decision.team, '📤 Touche');
            break;
          case 'kickoff':
            this.refereeService.createEvent('but', undefined, decision.team, '⚽ But! Engagement');
            break;
        }
      }

      // Remise en jeu à l'endroit calculé par l'arbitre (corner/six mètres/touche),
      // pas systématiquement au centre — un `reset()` sans position (bug corrigé ici)
      // téléportait le ballon au rond central à CHAQUE sortie de balle, y compris les
      // touches et corners, qui doivent reprendre depuis la ligne/le poteau concerné.
      const restartPos = decision
        ? new BABYLON.Vector3(decision.position.x, FOOTBALL_CONFIG.BALL.DIAMETER / 2, decision.position.z)
        : undefined;
      this.ballService.reset(restartPos);
    }
  }

  // ─── Possession ──────────────────────────────────────────────────────

  private updatePossession(): void {
    const ball = this.gameState.ball!;
    if (ball.lastTouch) {
      const total = this.gameState.match.possession.home + this.gameState.match.possession.away;
      if (ball.lastTouch.teamId === 'home') {
        this.gameState.match.possession.home = Math.min(99, this.gameState.match.possession.home + 0.1);
        this.gameState.match.possession.away = 100 - this.gameState.match.possession.home;
      } else {
        this.gameState.match.possession.away = Math.min(99, this.gameState.match.possession.away + 0.1);
        this.gameState.match.possession.home = 100 - this.gameState.match.possession.away;
      }
    }
  }

  // ─── Périodes du match (mi-temps, prolongations, tirs au but) ─────────

  private handlePeriodChange(period: MatchPeriod): void {
    this.matchPeriod = period;

    if (period === 'mi-temps') {
      const isExtraTimeBreak = this.gameState.match.halfDuration === FOOTBALL_CONFIG.MATCH.EXTRA_TIME_HALF;
      this.showRefereeNotification('⏸️ Mi-temps — changement de camp');
      this.audioService.playWhistle(true);
      this.audioService.speak('Fin de la première période. Changement de camp.');
      setTimeout(() => {
        // L'équipe qui n'a pas engagé la période précédente engage celle-ci (règle du foot)
        const kickoffTeam = this.lastKickoffTeam === 'home' ? 'away' : 'home';
        this.swapSides(kickoffTeam);
        this.ballService.reset();
        if (isExtraTimeBreak) {
          this.matchService.startExtraSecondHalf();
        } else {
          this.matchService.startSecondHalf();
        }
        setTimeout(() => this.triggerKickoffPass(), 400);
      }, FOOTBALL_CONFIG.MATCH.HALF_TIME_BREAK * 1000);
    } else if (period === 'prolongation-1') {
      this.showRefereeNotification('⏱️ Prolongations !');
      this.audioService.playWhistle(true);
      this.ballService.reset();
      this.repositionPlayersToFormation(this.lastKickoffTeam === 'home' ? 'away' : 'home');
      setTimeout(() => this.triggerKickoffPass(), 400);
    } else if (period === 'prolongation-2') {
      this.showRefereeNotification('⏱️ Deuxième période de prolongation');
      this.audioService.playWhistle(true);
    } else if (period === 'penalties') {
      this.showRefereeNotification('🥅 Tirs au but !');
      this.audioService.playWhistle(true);
      this.penaltyScore = { home: 0, away: 0 };
      setTimeout(() => this.runPenaltyRound('home'), 1500);
    } else if (period === 'fini') {
      this.gameState.gameState = 'finished';
      this.audioService.playWhistle(true);
      this.audioService.speak('Le match est terminé.');
      this.audioService.stopCrowdAmbiance();
    }
  }

  /**
   * Lance un tir au but : le camp "home" (joueur humain) vise et tire ;
   * le camp "away" (IA) tire et c'est le joueur humain qui plonge dans les buts.
   */
  private runPenaltyRound(team: 'home' | 'away'): void {
    if (this.gameState.match.period !== 'penalties' && !this.penaltyTrainingActive) return;
    this.penaltyShooterTeam = team;

    const spot = this.refereeService.getPenaltyPosition(team);
    this.ballService.reset(new BABYLON.Vector3(spot.x, 0.3, spot.z));

    if (team === 'home') {
      this.penaltyAimX = 0;
      this.penaltyAimY = 0.4;
      this.penaltyPower = 0;
      this.penaltyCharging = false;
      this.penaltyPhase = 'aiming';
    } else {
      this.aiPenaltyAimX = (Math.random() * 2 - 1) * 0.85;
      this.aiPenaltyAimY = 0.3 + Math.random() * 0.6;
      this.penaltyPhase = 'keeper';
      this.penaltyKeeperTimeout = setTimeout(() => {
        if (this.penaltyPhase === 'keeper') this.confirmKeeperDive(0);
      }, 3000);
    }
  }

  /** Tir du joueur humain (relâchement de la touche Espace pendant la visée) */
  private executePenaltyShot(): void {
    if (this.penaltyPhase !== 'aiming') return;
    this.penaltyPhase = 'resolving';

    const ball = this.gameState.ball!;
    const spot = this.refereeService.getPenaltyPosition(this.penaltyShooterTeam);
    const target = this.penaltyGoalTarget(this.penaltyShooterTeam, this.penaltyAimX, this.penaltyAimY);
    const direction = target.subtract(spot);
    const power = FOOTBALL_CONFIG.PLAYER.KICK_POWER_MIN +
      Math.max(0.15, this.penaltyPower) * (FOOTBALL_CONFIG.PLAYER.KICK_POWER_MAX - FOOTBALL_CONFIG.PLAYER.KICK_POWER_MIN);

    this.ballService.kick(ball, direction, power);
    this.audioService.playKick(power);
    // Bug corrigé (signalé : "je dois voir le joueur prendre son élan et frapper le
    // ballon") : cette fonction ne déclenchait AUCUNE animation sur le tireur — le
    // ballon partait via la seule physique pendant que le joueur restait figé/idle.
    // Le tir en jeu ouvert (handlePlayerInput, plus haut) le fait déjà ; appliqué ici
    // au tireur réellement contrôlé (isolé par isolateHomePlayerForScenario en
    // entraînement, ou le joueur choisi par l'utilisateur en séance de tirs au but réelle).
    if (this.gameState.controlledPlayer) {
      this.playerService.playOneShot(this.gameState.controlledPlayer, 'Shoot');
    }

    const keeperDive = this.simulateKeeperReaction(this.penaltyAimX);
    setTimeout(() => {
      const covered = Math.abs(this.penaltyAimX - keeperDive) < 0.35;
      this.resolvePenalty(!covered);
    }, 900);
  }

  /** Choix du gardien humain quand l'IA tire (flèches gauche/droite, bas = rester au centre) */
  private confirmKeeperDive(dive: -1 | 0 | 1): void {
    if (this.penaltyPhase !== 'keeper') return;
    if (this.penaltyKeeperTimeout) clearTimeout(this.penaltyKeeperTimeout);
    this.penaltyPhase = 'resolving';

    const ball = this.gameState.ball!;
    const spot = this.refereeService.getPenaltyPosition('away');
    const target = this.penaltyGoalTarget('away', this.aiPenaltyAimX, this.aiPenaltyAimY);
    const direction = target.subtract(spot);
    const power = FOOTBALL_CONFIG.PLAYER.KICK_POWER_MAX * (0.7 + Math.random() * 0.3);

    this.ballService.kick(ball, direction, power);
    this.audioService.playKick(power);
    // Même correction que executePenaltyShot() côté tireur adverse (IA) — seulement
    // en séance de tirs au but réelle : en entraînement (rôle gardien),
    // resetToFreeTraining() ne garde que le gardien adverse, aucun tireur IA à animer.
    const aiShooter = this.gameState.awayPlayers.find(p => p.config.role !== 'gk' && !p.isSentOff);
    if (aiShooter) {
      this.playerService.playOneShot(aiShooter, 'Shoot');
    }

    setTimeout(() => {
      const covered = Math.abs(this.aiPenaltyAimX - dive) < 0.35;
      this.resolvePenalty(!covered);
    }, 900);
  }

  /** Point 3D visé dans la cage, à partir d'une visée horizontale/verticale normalisée (-1..1 / 0..1) */
  private penaltyGoalTarget(team: 'home' | 'away', aimX: number, aimY: number): BABYLON.Vector3 {
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const goalHalfWidth = FOOTBALL_CONFIG.FIELD.GOAL_WIDTH / 2 - 0.4; // marge pour rester dans le cadre
    const z = team === 'home' ? halfL : -halfL;
    const y = 0.3 + aimY * (FOOTBALL_CONFIG.FIELD.GOAL_HEIGHT - 0.5);
    return new BABYLON.Vector3(aimX * goalHalfWidth, y, z);
  }

  /** Le gardien IA devine plus ou moins bien selon la difficulté choisie */
  private simulateKeeperReaction(actualAimX: number): number {
    const diff = FOOTBALL_CONFIG.DIFFICULTY[this.selectedDifficulty];
    const readsShot = Math.random() < diff.shotAccuracy * 0.6;
    if (readsShot) {
      return actualAimX + (Math.random() - 0.5) * 0.3;
    }
    const guesses = [-1, 0, 1];
    return guesses[Math.floor(Math.random() * guesses.length)];
  }

  private resolvePenalty(scored: boolean): void {
    const team = this.penaltyShooterTeam;
    this.penaltyPhase = 'idle';

    this.showRefereeNotification(scored ? '⚽ But !' : '🧤 Arrêté / Manqué !');
    if (scored) {
      this.audioService.playGoalHorn();
    } else {
      this.audioService.playWhistle(false);
    }

    // Penalty d'ENTRAÎNEMENT (répétitions libres) : ni score de match, ni séquence
    // de tirs au but réelle — juste une relance automatique du même exercice, dans
    // le même rôle choisi (tireur ou gardien), pour enchaîner les répétitions.
    if (this.penaltyTrainingActive) {
      setTimeout(() => {
        if (this.penaltyTrainingActive) {
          this.runPenaltyRound(this.penaltyTrainingRole === 'shooter' ? 'home' : 'away');
        }
      }, 2000);
      return;
    }

    this.matchService.executePenalty(team, scored);

    if (this.gameState.match.period === 'penalties') {
      setTimeout(() => this.runPenaltyRound(team === 'home' ? 'away' : 'home'), 2500);
    }
  }

  // ─── Menu d'entraînement ─────────────────────────────────────────────

  /** Ouvre/ferme le panneau replié (rappel des touches, ou menu d'exercices en mode Entraînement) */
  toggleControlsHint(): void {
    this.controlsHintExpanded = !this.controlsHintExpanded;
  }

  /** Lance l'exercice penalty (rôle tireur ou gardien) — appelée depuis launchPendingExercise() */
  startPenaltyTraining(role: 'shooter' | 'keeper'): void {
    this.resetToFreeTraining(); // repart d'un état propre (mannequins, effectif away) avant de lancer
    this.trainingScenario = 'penalty';
    this.penaltyTrainingActive = true;
    this.penaltyTrainingRole = role;

    const dir = this.attackingDirection('home');
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    this.isolateHomePlayerForScenario(0, dir * (halfL - 14));

    this.gameState.match.isPaused = false;
    this.runPenaltyRound(role === 'shooter' ? 'home' : 'away');
  }

  /**
   * Coup franc : ballon à ~22m du but adverse, mur de mannequins positionné à la
   * distance réglementaire (9,15m) via la même formule que les coups francs joués en
   * match (`RefereeService.getWallPositions`) — pas de phase de visée dédiée, le tir
   * se fait avec les touches normales (Espace) comme n'importe quel tir en jeu ouvert.
   */
  private startFreeKickTraining(): void {
    this.resetToFreeTraining();
    this.trainingScenario = 'freekick';

    const dir = this.attackingDirection('home');
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const ballPos = new BABYLON.Vector3(0, 0.3, dir * (halfL - 22));
    this.ballService.reset(ballPos);
    this.isolateHomePlayerForScenario(ballPos.x, ballPos.z - dir * 1.5);

    const targetGoalZ = dir * halfL;
    const wallPositions = this.refereeService.getWallPositions(ballPos, targetGoalZ, 3);
    this.trainingDummies = this.playerService.createDummiesAtPositions(wallPositions);

    this.gameState.match.isPaused = false;
  }

  /**
   * Tacle : contrairement aux mannequins statiques (impossibles à tacler, ce sont de
   * simples obstacles physiques), cet exercice ajoute un vrai attaquant piloté par
   * AIService (comme n'importe quel adversaire en match) au lieu d'un mannequin — la
   * seule façon d'avoir une cible mobile qui porte réellement le ballon à tacler.
   */
  private startTackleTraining(): void {
    this.resetToFreeTraining();
    this.trainingScenario = 'tackle';

    const attacker = this.playerService.createSingleAttacker(this.gameState.awayTeam, false, 0, 0);
    this.gameState.awayPlayers = [...this.gameState.awayPlayers, attacker];
    this.ballService.reset(new BABYLON.Vector3(3, 0.3, 5));
    this.isolateHomePlayerForScenario(-3, -5);

    this.gameState.match.isPaused = false;
  }

  /**
   * Passes : trois mannequins-cibles à des distances/angles différents (courte devant,
   * longue en profondeur, sur le côté pour le centre) — les touches de passe existantes
   * (E/T/C) restent inchangées, l'exercice ne fait que positionner des cibles claires.
   */
  private startPassTraining(): void {
    this.resetToFreeTraining();
    this.trainingScenario = 'passes';

    const dir = this.attackingDirection('home');
    this.ballService.reset(new BABYLON.Vector3(0, 0.3, 0));
    this.isolateHomePlayerForScenario(0, -dir * 3);
    this.trainingDummies = this.playerService.createDummiesAtPositions([
      new BABYLON.Vector3(0, 0, dir * 10),   // passe courte
      new BABYLON.Vector3(0, 0, dir * 32),   // passe en profondeur
      new BABYLON.Vector3(18, 0, dir * 15),  // centre côté droit
    ]);

    this.gameState.match.isPaused = false;
  }

  /**
   * Course / Sprint / Courir après le ballon : aucune opposition, juste un ballon
   * replacé loin du joueur pour un aller-sprint chronométré à l'œil — le déplacement/
   * sprint (WASD + Shift) est déjà entièrement fonctionnel, l'exercice ne fait que
   * cadrer l'objectif.
   */
  private startRunningTraining(): void {
    this.resetToFreeTraining();
    this.trainingScenario = 'running';

    // Bug corrigé ("je ne vois pas le ballon en running") : le ballon était TÉLÉPORTÉ
    // immobile loin du joueur (ballService.reset() ne fait que repositionner, sans
    // vitesse) — rien à voir se déplacer, juste une disparition/réapparition. Il faut un
    // vrai coup de pied (ballService.kick(), même mécanisme que n'importe quel tir/passe
    // en jeu) depuis un point proche du joueur vers le point de chute lointain, pour que
    // le ballon roule réellement du départ à l'arrivée, comme demandé.
    const dir = this.attackingDirection('home');
    const halfL = FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const startZ = -dir * 10;
    const targetZ = dir * (halfL - 5);
    this.isolateHomePlayerForScenario(0, startZ);

    const startPos = new BABYLON.Vector3(0, 0.3, startZ);
    const targetPos = new BABYLON.Vector3(0, 0.3, targetZ);
    this.ballService.reset(startPos);
    // Puissance volontairement FAIBLE (proche de KICK_POWER_MIN, pas MAX comme un vrai
    // tir) : le but est de laisser un vrai laps de temps pour courir/rattraper le
    // ballon — un tir plein pot couvrirait la distance en ~1s, arrivant déjà chez le
    // gardien avant que le joueur ait pu faire ne serait-ce que quelques foulées.
    this.ballService.kick(this.gameState.ball!, targetPos.subtract(startPos), FOOTBALL_CONFIG.PLAYER.KICK_POWER_MIN * 1.4);

    this.showRefereeNotification('🏃 Sprint ! Rattrape le ballon avant qu\'il ne sorte du terrain');

    this.gameState.match.isPaused = false;
  }

  /**
   * Conduite de balle : slalom entre des piquets (les mêmes mannequins-cônes que le mur
   * de coup franc, déjà conçus comme "un vrai obstacle de dribble" — cf.
   * PlayerService.createDummyAt) jusqu'au bout du terrain. Aucune nouvelle mécanique :
   * s'appuie entièrement sur le contrôle de balle ("3" = prise en main puis légère
   * poussée, cf. takeBallControl()) déjà en place — l'exercice ne fait que poser un
   * parcours clair pour s'entraîner à l'enchaîner plusieurs fois de suite.
   */
  private startDribbleTraining(): void {
    this.resetToFreeTraining();
    this.trainingScenario = 'dribble';

    const dir = this.attackingDirection('home');
    const startZ = -dir * 20;
    this.isolateHomePlayerForScenario(0, startZ);
    this.ballService.reset(new BABYLON.Vector3(0, 0.3, startZ));

    const slalom: BABYLON.Vector3[] = [];
    for (let i = 1; i <= 5; i++) {
      const x = i % 2 === 0 ? 5 : -5;
      slalom.push(new BABYLON.Vector3(x, 0, startZ + dir * i * 8));
    }
    this.trainingDummies = this.playerService.createDummiesAtPositions(slalom);

    this.showRefereeNotification('⚽ Contrôle le ballon ("3") et slalome entre les piquets jusqu\'au bout');
    this.gameState.match.isPaused = false;
  }

  /**
   * Changement de joueur / construction du jeu : à la différence des autres exercices
   * (isolateHomePlayerForScenario réduit à UN SEUL joueur), celui-ci a justement besoin
   * de plusieurs coéquipiers proches — tout l'objet est de choisir parmi eux au L1 (cf.
   * cyclePassTarget()) avant de leur passer le ballon, pour enchaîner les passes vers
   * l'avant ("construction du jeu"). Isole d'abord comme d'habitude puis rajoute deux
   * coéquipiers via createSingleAttacker() (déjà utilisé pour l'adversaire du Tacle,
   * réutilisé ici côté domicile) — cette fonction code en dur id=1, donc réattribution
   * manuelle d'id/numéro uniques après coup pour éviter une collision entre les deux.
   */
  private startSwitchPlayerTraining(): void {
    this.resetToFreeTraining();
    this.trainingScenario = 'switchplayer';

    const dir = this.attackingDirection('home');
    const baseZ = -dir * 5;
    this.isolateHomePlayerForScenario(0, baseZ);

    const teammateA = this.playerService.createSingleAttacker(this.gameState.homeTeam, true, -14, baseZ + dir * 4);
    teammateA.config.id = 201;
    teammateA.config.number = 7;
    const teammateB = this.playerService.createSingleAttacker(this.gameState.homeTeam, true, 14, baseZ + dir * 8);
    teammateB.config.id = 202;
    teammateB.config.number = 11;
    this.gameState.homePlayers = [...this.gameState.homePlayers, teammateA, teammateB];

    this.ballService.reset(new BABYLON.Vector3(0, 0.3, baseZ));
    this.showRefereeNotification('🔄 Prends le ballon ("3"), puis L1 pour choisir un coéquipier et lui passer ("3")');
    this.gameState.match.isPaused = false;
  }

  /**
   * Bug corrigé (signalé après la mise en place des ateliers) : chaque exercice ne
   * touchait que le ballon/l'effectif adverse/les mannequins, mais laissait les 10
   * autres titulaires HOME en formation complète sur la pelouse — visuellement, ça
   * ressemblait toujours à "l'équipe qui joue" plutôt qu'au scénario isolé demandé
   * (ex: Penalty = "uniquement un tireur, un gardien, un ballon"). On retire donc les
   * coéquipiers non pertinents pour ne garder que le joueur contrôlé, repositionné au
   * bon endroit pour l'exercice.
   */
  private isolateHomePlayerForScenario(startX: number, startZ: number): void {
    const controlled = this.gameState.controlledPlayer ?? this.gameState.homePlayers[0];
    this.gameState.homePlayers
      .filter(p => p !== controlled)
      .forEach(p => this.playerService.disposePlayer(p));
    this.gameState.homePlayers = [controlled];
    this.gameState.controlledPlayer = controlled;
    const pos = controlled.body.translation();
    controlled.body.setTranslation({ x: startX, y: pos.y, z: startZ }, true);
    controlled.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Remet l'entraînement dans un état propre avant de lancer un nouvel exercice ou de
   * revenir au tir libre : arrête un éventuel penalty en boucle, retire les mannequins/
   * l'attaquant ajoutés par l'exercice précédent (jamais accumulés d'un exercice à l'autre). */
  private resetToFreeTraining(): void {
    this.penaltyTrainingActive = false;
    this.penaltyPhase = 'idle';
    if (this.penaltyKeeperTimeout) clearTimeout(this.penaltyKeeperTimeout);

    this.playerService.disposeDummies(this.trainingDummies);
    this.trainingDummies = [];

    // Retire l'attaquant ajouté par l'exercice Tacle (ne garde que le gardien) — même
    // bug corrigé qu'isolateHomePlayerForScenario() : disposePlayer() (pas juste un
    // filter() sur le tableau) pour éviter un mannequin fantôme + un crash Rapier au
    // prochain accès à son corps physique par PlayerService.syncPositions().
    this.gameState.awayPlayers
      .filter(p => p.config.role !== 'gk')
      .forEach(p => this.playerService.disposePlayer(p));
    this.gameState.awayPlayers = this.gameState.awayPlayers.filter(p => p.config.role === 'gk');
  }

  private handlePenaltyResult(team: 'home' | 'away', scored: boolean): void {
    if (scored) {
      this.penaltyScore[team]++;
    }
  }

  // ─── Caméra ──────────────────────────────────────────────────────────

  private updateCamera(): void {
    if (!this.gameState?.ball) return;

    if (this.activeCameraMode === 'player') {
      const player = this.gameState.controlledPlayer;
      if (player && !player.isSentOff) {
        this.updatePlayerCamera(player);
        return;
      }
      // Pas de joueur contrôlable valide (mi-temps, expulsion...) : retombe sur le
      // suivi classique plutôt que de figer la caméra sur une cible disparue.
    }

    const ballPos = this.gameState.ball.body.translation();
    const target = new BABYLON.Vector3(ballPos.x * 0.5, 0, ballPos.z * 0.5);

    // Interpolation douce
    this.camera.target.x += (target.x - this.camera.target.x) * 0.02;
    this.camera.target.z += (target.z - this.camera.target.z) * 0.02;

    if (this.dynamicZoomRange) {
      this.updateDynamicZoom(this.dynamicZoomRange);
    }
  }

  /**
   * "Vue joueur" (FIFA Player Cam) : caméra à la troisième personne, collée derrière le
   * joueur contrôlé, dans l'axe de sa direction de course. `alpha` est recalculé chaque
   * frame à partir de `mesh.rotation.y` (même angle que `syncPositions()`,
   * `atan2(vel.x, vel.z)` — convention établie : rotY=0 fait face à +Z) : la caméra doit
   * s'orbiter à l'opposé de cette direction pour rester DANS LE DOS du joueur, d'où
   * `alpha = -(facing + PI/2)` (dérivé de la formule de position sphérique de Babylon :
   * offset caméra = (cos(alpha), sin(alpha)) * sin(beta), qui doit pointer vers -facing).
   */
  private updatePlayerCamera(player: PlayerInstance): void {
    const pos = player.body.translation();
    const facing = player.mesh.rotation.y;
    const forwardX = Math.sin(facing);
    const forwardZ = Math.cos(facing);

    // Cible légèrement devant le joueur (pas pile sur lui) : rend le "vers où il va"
    // plus lisible que si la caméra visait exactement ses pieds.
    const lookX = pos.x + forwardX * 3;
    const lookZ = pos.z + forwardZ * 3;
    this.camera.target.x += (lookX - this.camera.target.x) * 0.15;
    this.camera.target.z += (lookZ - this.camera.target.z) * 0.15;
    this.camera.target.y += (0.5 - this.camera.target.y) * 0.15;

    const desiredAlpha = -(facing + Math.PI / 2);
    let diff = desiredAlpha - this.camera.alpha;
    diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI; // normalise vers [-π, π] (évite un tour complet au passage ±π)
    this.camera.alpha += diff * 0.12;
  }

  /**
   * Zoom dynamique du preset "Dynamique (Télé)" : plus les joueurs sont regroupés
   * (mêlée), plus la caméra se rapproche ; plus le jeu est étiré (contre-attaque, jeu
   * long), plus elle recule — façon caméra de retransmission qui zoome/dézoome selon
   * l'action plutôt que de garder un cadrage fixe.
   */
  private updateDynamicZoom(range: { min: number; max: number }): void {
    const all = [...this.gameState.homePlayers, ...this.gameState.awayPlayers].filter(p => !p.isSentOff);
    if (all.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    all.forEach(p => {
      const t = p.body.translation();
      minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x);
      minZ = Math.min(minZ, t.z); maxZ = Math.max(maxZ, t.z);
    });
    const spread = Math.hypot(maxX - minX, maxZ - minZ);
    // Étalement observé en pratique : ~25 m (mêlée compacte) à ~90 m (jeu très étiré)
    const t = BABYLON.Scalar.Clamp((spread - 25) / (90 - 25), 0, 1);
    const desiredRadius = range.min + (range.max - range.min) * t;
    this.camera.radius += (desiredRadius - this.camera.radius) * 0.03;
  }

  // ─── UI ──────────────────────────────────────────────────────────────

  private updateClockDisplay(): void {
    const { clock, halfDuration } = this.gameState.match;

    if (clock > halfDuration) {
      // Temps additionnel : affiche "45+X" plutôt que de continuer à égrener les minutes
      const regMinutes = Math.floor(halfDuration / 60);
      const extraSeconds = Math.floor(clock - halfDuration);
      const extraMinutes = Math.floor(extraSeconds / 60) + 1;
      this.matchClock = `${regMinutes.toString().padStart(2, '0')}+${extraMinutes}`;
    } else {
      const minutes = Math.floor(clock / 60);
      const seconds = Math.floor(clock % 60);
      this.matchClock = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    this.matchPeriod = this.gameState.match.period;
  }

  /** Ajoute du temps additionnel (but, faute/carton...) à jouer avant la fin de la période en cours */
  private addStoppageTime(seconds: number): void {
    if (!this.gameState) return;
    this.gameState.match.stoppageSeconds += seconds;
  }

  private updateUI(): void {
    this.matchScore = { ...this.gameState.match.score };
    this.possessionHome = Math.round(this.gameState.match.possession.home);
    this.possessionAway = Math.round(this.gameState.match.possession.away);
    this.matchStats.home.shots = this.gameState.match.shots.home;
    this.matchStats.home.shotsOnTarget = this.gameState.match.shotsOnTarget.home;
    this.matchStats.home.fouls = this.gameState.match.fouls.home;
    this.matchStats.home.corners = this.gameState.match.corners.home;
    this.matchStats.away.shots = this.gameState.match.shots.away;
    this.matchStats.away.shotsOnTarget = this.gameState.match.shotsOnTarget.away;
    this.matchStats.away.fouls = this.gameState.match.fouls.away;
    this.matchStats.away.corners = this.gameState.match.corners.away;

    this.updatePlayerLabels();
    this.updateRadar();
  }

  /**
   * Radar (mini-carte) en bas de l'écran : projection orthographique top-down
   * (indépendante de l'angle de caméra, contrairement aux étiquettes joueurs) des
   * positions réelles sur le terrain, pour repérer les appuis/décrochages sans devoir
   * lever les yeux du joueur contrôlé — surtout utile avec les nouveaux presets de
   * caméra bas/rapprochés (Broadcast/Coop/Vue joueur) où le champ de vision est réduit.
   */
  private updateRadar(): void {
    if (!this.showRadar || !this.gameState) {
      this.radarDots = [];
      return;
    }
    const { LENGTH, WIDTH } = FOOTBALL_CONFIG.FIELD;
    // Convention établie (cf. updateCamera/stadium.service.ts) : axe Z monde = axe
    // horizontal écran, axe X monde = axe vertical écran — le radar reprend la même
    // orientation pour rester intuitif par rapport à ce qu'on voit sur le terrain.
    const toRadar = (x: number, z: number) => ({
      x: 50 + (z / (LENGTH / 2)) * 50,
      y: 50 + (x / (WIDTH / 2)) * 50,
    });

    const state = this.gameState;
    const dots: { x: number; y: number; teamId: 'home' | 'away' | 'ball'; highlight: boolean }[] = [...state.homePlayers, ...state.awayPlayers]
      .filter(p => !p.isSentOff)
      .map(p => {
        const t = p.body.translation();
        const { x, y } = toRadar(t.x, t.z);
        return { x, y, teamId: p.config.teamId, highlight: p === state.controlledPlayer };
      });

    if (state.ball) {
      const b = state.ball.body.translation();
      const { x, y } = toRadar(b.x, b.z);
      dots.push({ x, y, teamId: 'ball' as const, highlight: false });
    }

    this.radarDots = dots.filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));
  }

  /**
   * Étiquette numéro/nom au-dessus de la tête des joueurs (flèche pointant vers le
   * joueur). Togglable en jeu (menu contextuel) : quand activé, TOUS les joueurs sont
   * étiquetés (juste le numéro, pour rester lisible avec 22 joueurs à l'écran) ; le
   * joueur contrôlé et le porteur du ballon sont mis en avant avec leur nom complet.
   */
  private updatePlayerLabels(): void {
    if (!this.showAllPlayerLabels || !this.scene || !this.camera) {
      this.labelPlayers = [];
      return;
    }

    const state = this.gameState;
    const carrier = [...state.homePlayers, ...state.awayPlayers].find(p => p.hasBall);
    const allPlayers = [...state.homePlayers, ...state.awayPlayers].filter(p => !p.isSentOff);

    // Le moteur suréchantillonne le rendu (setHardwareScalingLevel(0.5) → tampon 2x
    // plus grand que la taille CSS, pour la qualité) : engine.getRenderWidth/Height()
    // renvoie donc cette résolution interne, PAS la taille CSS réelle du canvas où les
    // étiquettes (positionnées en pixels CSS) doivent s'aligner. Utiliser la taille CSS
    // du canvas directement pour que la projection corresponde à l'espace d'affichage.
    const canvasEl = this.canvasRef.nativeElement;
    const viewport = this.camera.viewport.toGlobal(canvasEl.clientWidth, canvasEl.clientHeight);

    this.labelPlayers = allPlayers.map(p => {
      const pos = p.body.translation();
      // Un décalage fixe en mètres (monde) avant projection est exagéré par la
      // perspective dès que la caméra n'est plus quasi zénithale (presets Diffusion
      // TV/Rapprochée) : plus un joueur est loin, plus ce décalage se traduit par un
      // grand déplacement à l'écran — les étiquettes s'envolaient vers les tribunes.
      // On projette donc la position réelle du joueur (à peine surélevée du sol) et
      // le report "au-dessus de la tête" se fait entièrement en CSS (pixels d'écran,
      // insensible à l'angle de caméra).
      const projected = BABYLON.Vector3.Project(
        new BABYLON.Vector3(pos.x, pos.y + 0.3, pos.z),
        BABYLON.Matrix.Identity(),
        this.scene.getTransformMatrix(),
        viewport
      );
      const highlight = p === state.controlledPlayer || p === carrier;
      return {
        id: p.config.id,
        text: highlight ? `#${p.config.number} ${p.config.name}` : `#${p.config.number}`,
        x: projected.x,
        y: projected.y,
        teamId: p.config.teamId,
        highlight,
      };
    }).filter(l => Number.isFinite(l.x) && Number.isFinite(l.y));
  }

  private showGoalNotification(teamName: string): void {
    this.goalNotification = `⚽ BUT! ${teamName}`;
    this.goalNotificationVisible = true;
    setTimeout(() => {
      this.goalNotificationVisible = false;
    }, 2500);
  }

  private showResultScreen(): void {
    this.showMatch = false;
    this.showResult = true;
    this.gameChrome.showHeader();
    const homeScore = this.gameState.match.score.home;
    const awayScore = this.gameState.match.score.away;
    const penalties = this.matchService?.getPenaltyScore();
    const decidedOnPenalties = homeScore === awayScore && !!penalties && penalties.home !== penalties.away;

    if (decidedOnPenalties) {
      const winner = penalties!.home > penalties!.away ? this.gameState.homeTeam.name : this.gameState.awayTeam.name;
      this.resultText = `🏆 ${winner} l'emporte aux tirs au but (${penalties!.home} - ${penalties!.away}) ! ${homeScore} - ${awayScore}`;
    } else if (homeScore > awayScore) {
      this.resultText = `🏆 Victoire! ${this.gameState.homeTeam.name} ${homeScore} - ${awayScore} ${this.gameState.awayTeam.name}`;
    } else if (awayScore > homeScore) {
      this.resultText = `😔 Défaite... ${this.gameState.homeTeam.name} ${homeScore} - ${awayScore} ${this.gameState.awayTeam.name}`;
    } else {
      this.resultText = `🤝 Match nul! ${this.gameState.homeTeam.name} ${homeScore} - ${awayScore} ${this.gameState.awayTeam.name}`;
    }

    this.matchEvents = this.gameState.match.events.map(e => e.description);
  }

  // ─── Entrées clavier ─────────────────────────────────────────────────

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.keysPressed.add(event.code);

    // Tirs au but : les flèches/Espace pilotent la visée ou le plongeon du gardien,
    // pas le déplacement normal du joueur
    if (this.penaltyPhase === 'aiming') {
      switch (event.code) {
        case 'ArrowLeft': this.penaltyAimX = Math.max(-1, this.penaltyAimX - 0.08); break;
        case 'ArrowRight': this.penaltyAimX = Math.min(1, this.penaltyAimX + 0.08); break;
        case 'ArrowUp': this.penaltyAimY = Math.min(1, this.penaltyAimY + 0.08); break;
        case 'ArrowDown': this.penaltyAimY = Math.max(0, this.penaltyAimY - 0.08); break;
        case 'Space': this.penaltyCharging = true; break;
      }
      return;
    }
    if (this.penaltyPhase === 'keeper') {
      switch (event.code) {
        case 'ArrowLeft': this.confirmKeeperDive(-1); break;
        case 'ArrowRight': this.confirmKeeperDive(1); break;
        case 'ArrowDown': case 'Space': this.confirmKeeperDive(0); break;
      }
      return;
    }

    switch (event.code) {
      // Bug corrigé : la caméra affiche l'axe monde Z à l'horizontale de l'écran et
      // l'axe monde X à la verticale (buts en haut/bas de l'écran) — l'ancien mappage
      // (Z↔haut/bas, X↔gauche/droite) supposait l'inverse, faisant tourner tous les
      // déplacements de 90° par rapport à ce que le joueur voit réellement à l'écran
      // (flèche gauche = joueur vers le haut, flèche haut = joueur vers la gauche...).
      case 'KeyW': case 'ArrowUp': this.input.moveX = -1; break;
      case 'KeyS': case 'ArrowDown': this.input.moveX = 1; break;
      case 'KeyA': case 'ArrowLeft': this.input.moveZ = -1; break;
      case 'KeyD': case 'ArrowRight': this.input.moveZ = 1; break;
      case 'ShiftLeft': case 'ShiftRight': this.input.sprint = true; break;
      case 'Space': this.input.kick = true; break;
      case 'KeyE': this.input.pass = true; break;
      case 'KeyT': this.input.passDeep = true; break;   // T = passe en profondeur (Through ball)
      case 'KeyC': this.input.crossLong = true; break;  // C = Centre (Cross)
      case 'KeyF': this.input.tackle = true; break;
      case 'KeyQ': this.input.switchPlayer = true; break;
      case 'KeyP': this.input.pause = !this.input.pause; break;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    this.keysPressed.delete(event.code);

    if (this.penaltyPhase === 'aiming') {
      if (event.code === 'Space' && this.penaltyCharging) {
        this.penaltyCharging = false;
        this.executePenaltyShot();
      }
      return;
    }
    if (this.penaltyPhase === 'keeper' || this.penaltyPhase === 'resolving') return;

    switch (event.code) {
      case 'KeyW': case 'ArrowUp': if (!this.keysPressed.has('KeyS')) this.input.moveX = 0; break;
      case 'KeyS': case 'ArrowDown': if (!this.keysPressed.has('KeyW')) this.input.moveX = 0; break;
      case 'KeyA': case 'ArrowLeft': if (!this.keysPressed.has('KeyD')) this.input.moveZ = 0; break;
      case 'KeyD': case 'ArrowRight': if (!this.keysPressed.has('KeyA')) this.input.moveZ = 0; break;
      case 'ShiftLeft': case 'ShiftRight': this.input.sprint = false; break;
    }
  }

  // ─── Manette (Gamepad API standard) ───────────────────────────────────

  /**
   * Mapping manette générique numérotée 1-4, relevé EMPIRIQUEMENT bouton par bouton
   * (hardwaretester.com) plutôt que supposé — correspondance en LIGNE DROITE entre le
   * numéro physique et l'index Gamepad API standard ("1"=0, "2"=1, "3"=2, "4"=3), PAS la
   * disposition "losange" façon DualShock (3/1/0/2) initialement supposée, qui inversait
   * "3" et "4" (le tir se déclenchait sur "3" au lieu de "4") :
   *  - Gauche : stick + croix directionnelle = déplacement, L1 = changer de joueur.
   *  - Droite : bouton "1" = passe en profondeur ; bouton "4" = tir ; boutons "2"/"3"
   *    contextuels selon la possession du ballon (passe/centre si le joueur contrôlé a
   *    le ballon, tacle sinon) ; R1 = sprint.
   * Compatible Xbox/PlayStation/générique tant que le navigateur expose un mapping
   * "standard" — sinon (comme ici), l'ordre en ligne droite ci-dessus s'applique.
   * N'écrase jamais les entrées clavier quand aucune manette n'est utilisée (voir
   * gamepadWasMoving).
   */
  /** Navigation manette d'un menu (contextuel, pause, ou l'écran menu principal) — stick
   * gauche haut/bas défile, gauche/droite entre/sort d'un sous-menu, bouton "2" valide,
   * bouton "3" ferme. Factorisé car utilisé à la fois par pollGamepad() (pendant un
   * match/en pause) et par pollMenuGamepad() (écran menu principal, avant tout match, où
   * la boucle de jeu normale ne tourne pas encore). */
  private handleMenuGamepadNav(connectedPads: Gamepad[]): void {
    const axisValue = (i: number) => {
      for (const pad of connectedPads) {
        const v = pad.axes[i] ?? 0;
        if (Math.abs(v) > 0.5) return v;
      }
      return 0;
    };
    const menuPressed = (i: number) => connectedPads.some((p) => p.buttons[i]?.pressed ?? false);
    const menuWasPressed = (i: number) => this.gamepadPrevButtons[i] ?? false;

    const ax0 = axisValue(0); // gauche/droite : entre/sort d'un sous-menu
    const ax1 = axisValue(1); // haut/bas : fait défiler

    if (ax1 < -0.5) { if (!this.menuAxisHeld.up) { this.navigateMenu(-1); this.menuAxisHeld.up = true; } }
    else this.menuAxisHeld.up = false;
    if (ax1 > 0.5) { if (!this.menuAxisHeld.down) { this.navigateMenu(1); this.menuAxisHeld.down = true; } }
    else this.menuAxisHeld.down = false;
    if (ax0 > 0.5) { if (!this.menuAxisHeld.right) { this.expandMenuFocused(); this.menuAxisHeld.right = true; } }
    else this.menuAxisHeld.right = false;
    if (ax0 < -0.5) { if (!this.menuAxisHeld.left) { this.collapseMenuFocused(); this.menuAxisHeld.left = true; } }
    else this.menuAxisHeld.left = false;

    if (menuPressed(1) && !menuWasPressed(1)) this.activateMenuFocused();  // bouton "2" : valider
    if (menuPressed(2) && !menuWasPressed(2)) this.closeMenuViaGamepad();  // bouton "3" : fermer le menu

    // Retour visuel sur le petit schéma manette (même logique que pollGamepad en match) —
    // utile pour confirmer qu'une entrée est bien reçue, pas seulement pour l'esthétique.
    if (Math.abs(ax0) > 0.5 || Math.abs(ax1) > 0.5) this.gamepadHighlight = 'dpad';
    else if (menuPressed(1)) this.gamepadHighlight = 'btn2';
    else if (menuPressed(2)) this.gamepadHighlight = 'btn3';
    else this.gamepadHighlight = null;
  }

  /** Équivalent de handleMenuGamepadNav() pour les écrans d'avant-match (cf.
   * getActiveStepRoot()) : les 4 directions naviguent toutes par plus-proche-voisin
   * (navigateStep), pas de sémantique "sous-menu" gauche/droite ici — ces écrans n'ont
   * pas cette notion, juste des grilles/zones à parcourir dans les 4 sens. Bouton "2"
   * valide ; pas de bouton "3" dédié (le retour se fait en naviguant jusqu'au vrai
   * bouton "Retour", comme à la souris). */
  private handleStepGamepadNav(connectedPads: Gamepad[]): void {
    const axisValue = (i: number) => {
      for (const pad of connectedPads) {
        const v = pad.axes[i] ?? 0;
        if (Math.abs(v) > 0.5) return v;
      }
      return 0;
    };
    const stepPressed = (i: number) => connectedPads.some((p) => p.buttons[i]?.pressed ?? false);
    const stepWasPressed = (i: number) => this.gamepadPrevButtons[i] ?? false;

    const ax0 = axisValue(0);
    const ax1 = axisValue(1);

    if (ax1 < -0.5) { if (!this.stepAxisHeld.up) { this.navigateStep('up'); this.stepAxisHeld.up = true; } }
    else this.stepAxisHeld.up = false;
    if (ax1 > 0.5) { if (!this.stepAxisHeld.down) { this.navigateStep('down'); this.stepAxisHeld.down = true; } }
    else this.stepAxisHeld.down = false;
    if (ax0 > 0.5) { if (!this.stepAxisHeld.right) { this.navigateStep('right'); this.stepAxisHeld.right = true; } }
    else this.stepAxisHeld.right = false;
    if (ax0 < -0.5) { if (!this.stepAxisHeld.left) { this.navigateStep('left'); this.stepAxisHeld.left = true; } }
    else this.stepAxisHeld.left = false;

    if (stepPressed(1) && !stepWasPressed(1)) this.activateStepFocused(); // bouton "2" : valider

    if (Math.abs(ax0) > 0.5 || Math.abs(ax1) > 0.5) this.gamepadHighlight = 'dpad';
    else if (stepPressed(1)) this.gamepadHighlight = 'btn2';
    else this.gamepadHighlight = null;
  }

  /** Écran menu principal (avant tout match) et écrans d'avant-match (galerie
   * d'ateliers, sélection des équipes, composition, réglages, récapitulatif) : la
   * boucle de jeu (startGameLoop) qui porte habituellement pollGamepad() ne tourne pas
   * encore à ce stade — sondage dédié, léger, démarré dans le constructeur et actif
   * pendant toute la vie du composant, mais qui ne fait quoi que ce soit que lorsqu'un
   * de ces écrans est affiché (jamais en concurrence avec pollGamepad() pendant un
   * match, tous ces états sont mutuellement exclusifs). */
  private pollMenuGamepad(): void {
    const stepRoot = this.getActiveStepRoot();
    // Changement d'écran détecté (quel que soit le chemin emprunté pour y arriver —
    // Confirmer, Retour, remplacement en cours de match...) : remet la surbrillance au
    // premier item plutôt que de garder un index qui ne correspond plus à rien.
    if (stepRoot !== this.lastStepRoot) {
      this.lastStepRoot = stepRoot;
      this.stepFocusIndex = 0;
      if (stepRoot) setTimeout(() => this.updateStepFocusVisual(), 0);
    }

    if (this.showMenu || stepRoot) {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const connectedPads = Array.from(pads).filter((p): p is Gamepad => !!p && p.connected);
      // Bug corrigé (signalé : "aucun changement" à la manette sur cet écran) : cette
      // boucle ne mettait jamais à jour gamepadConnected/connectedGamepadNames — aucun
      // moyen de savoir si le navigateur voyait ne serait-ce que la manette. La Gamepad
      // API des navigateurs n'expose une manette via getGamepads() qu'APRÈS une première
      // interaction dessus (bouton pressé) depuis le chargement de la page — avant ça,
      // même une manette branchée renvoie un tableau vide, ce qui explique une absence
      // totale de réaction tant qu'aucun bouton n'a encore été pressé.
      this.connectedGamepadNames = connectedPads.map(p => p.id);
      this.gamepadConnected = connectedPads.length > 0;
      if (connectedPads.length > 0) {
        if (stepRoot) this.handleStepGamepadNav(connectedPads);
        else this.handleMenuGamepadNav(connectedPads);
        this.syncGamepadButtonState(connectedPads);
      }
    }
    this.menuGamepadFrameId = requestAnimationFrame(() => this.pollMenuGamepad());
  }

  private pollGamepad(deltaTime: number): void {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    // Bug corrigé (même famille que le pont clavier de la galerie de mini-jeux, cf.
    // gamepad-keyboard-bridge.service.ts) : ne lire QUE pads[0] échoue silencieusement
    // dès que deux manettes sont branchées (adaptateur "dual", ou deux manettes USB
    // distinctes) et que la manette réellement utilisée se retrouve à un autre index —
    // on fusionne donc les entrées de TOUTES les manettes connectées.
    const connectedPads = Array.from(pads).filter((p): p is Gamepad => !!p && p.connected);

    this.connectedGamepadNames = connectedPads.map(p => p.id);
    this.gamepadConnected = connectedPads.length > 0;
    if (connectedPads.length === 0) {
      this.gamepadHighlight = null;
      return;
    }

    // Menu contextuel ouvert (Select) ou modal pause affiché (Start) : le stick gauche et
    // les boutons "2"/"3" pilotent la navigation du menu plutôt que le jeu — sinon on
    // déplacerait le joueur ET on ferait défiler le menu en même temps.
    if (this.contextMenuVisible || this.showPauseModal) {
      this.handleMenuGamepadNav(connectedPads);
      this.syncGamepadButtonState(connectedPads);
      return;
    }

    const deadzone = 0.2;
    let isMoving = false;
    let moveX = 0;
    let moveZ = 0;
    connectedPads.forEach((pad) => {
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      if (Math.abs(ax) > deadzone) { moveZ = ax; isMoving = true; }
      if (Math.abs(ay) > deadzone) { moveX = ay; isMoving = true; }
    });

    if (isMoving) {
      // Même correction de mappage que le clavier (cf. onKeyDown) : l'axe horizontal
      // du stick doit piloter Z (horizontal à l'écran), l'axe vertical piloter X.
      this.input.moveZ = moveZ;
      this.input.moveX = moveX;
    } else if (this.gamepadWasMoving) {
      this.input.moveX = 0;
      this.input.moveZ = 0;
    }
    this.gamepadWasMoving = isMoving;

    // Bouton i "pressé" si au moins une des manettes connectées le presse
    const pressed = (i: number) => connectedPads.some((p) => p.buttons[i]?.pressed ?? false);
    const wasPressed = (i: number) => this.gamepadPrevButtons[i] ?? false;

    // Bug corrigé (mapping relevé empiriquement par l'utilisateur via hardwaretester.com,
    // touche par touche) : cette manette (mapping Gamepad API "n/a", pas "standard")
    // numérote ses 4 boutons de face en LIGNE DROITE — "1"=index 0, "2"=index 1,
    // "3"=index 2, "4"=index 3 — et NON selon la disposition "losange" façon DualShock
    // (3/1/0/2) supposée jusqu'ici. Résultat : le tir (censé être sur "4") se déclenchait
    // en réalité sur "3". Indices corrigés partout ci-dessous (aiming/keeper compris)
    // pour suivre ce relevé plutôt qu'une supposition.
    if (this.penaltyPhase === 'aiming') {
      const step = deltaTime * 2.5;
      if (pressed(14)) this.penaltyAimX = Math.max(-1, this.penaltyAimX - step);
      if (pressed(15)) this.penaltyAimX = Math.min(1, this.penaltyAimX + step);
      if (pressed(12)) this.penaltyAimY = Math.min(1, this.penaltyAimY + step);
      if (pressed(13)) this.penaltyAimY = Math.max(0, this.penaltyAimY - step);
      if (pressed(3) && !this.penaltyCharging) {
        this.penaltyCharging = true;
      } else if (!pressed(3) && this.penaltyCharging) {
        this.penaltyCharging = false;
        this.executePenaltyShot();
      }
      this.syncGamepadButtonState(connectedPads);
      return;
    }
    if (this.penaltyPhase === 'keeper') {
      if (pressed(14) && !wasPressed(14)) this.confirmKeeperDive(-1);
      if (pressed(15) && !wasPressed(15)) this.confirmKeeperDive(1);
      if ((pressed(13) || pressed(3)) && !(wasPressed(13) || wasPressed(3))) this.confirmKeeperDive(0);
      this.syncGamepadButtonState(connectedPads);
      return;
    }

    const hasBall = this.gameState?.controlledPlayer?.hasBall ?? false;

    // Croix directionnelle (indices standard 12-15) : redondante avec le stick, même
    // mappage que les flèches clavier (haut/bas -> moveX, gauche/droite -> moveZ).
    if (pressed(12)) this.input.moveX = -1;
    else if (pressed(13)) this.input.moveX = 1;
    if (pressed(14)) this.input.moveZ = -1;
    else if (pressed(15)) this.input.moveZ = 1;

    if (pressed(0) && !wasPressed(0)) this.input.passDeep = true;                          // Bouton "1" : passe en profondeur
    if (pressed(3) && !wasPressed(3)) this.input.kick = true;                               // Bouton "4" : tir
    if (pressed(1) && !wasPressed(1)) {                                                     // Bouton "2"
      if (hasBall) this.input.crossLong = true; else this.input.tackle = true;              // Centre si ballon, sinon tacle agressif
    }
    if (pressed(2) && !wasPressed(2)) {                                                     // Bouton "3"
      if (hasBall) this.input.pass = true; else this.input.tackle = true;                   // Contrôle puis passe courte si ballon, sinon tacle
    }
    if (pressed(4) && !wasPressed(4)) this.input.switchPlayer = true;                       // L1 : changer de joueur
    if (pressed(9) && !wasPressed(9)) this.pauseGame();                                      // Start : pause
    if (pressed(8) && !wasPressed(8)) this.openContextMenuViaGamepad();                      // Select : menu contextuel (= clic droit souris)
    this.input.sprint = pressed(5) || pressed(7) || pressed(10);                             // R1, gâchette R2 ou stick cliqué

    // Pour le petit schéma manette (statut en jeu) : quel élément mettre en surbrillance
    // (correspondance directe 1-2-3-4 -> btn1-2-3-4, cf. mapping relevé ci-dessus)
    if (pressed(12) || pressed(13) || pressed(14) || pressed(15) || isMoving) this.gamepadHighlight = 'dpad';
    else if (pressed(0)) this.gamepadHighlight = 'btn1';
    else if (pressed(1)) this.gamepadHighlight = 'btn2';
    else if (pressed(2)) this.gamepadHighlight = 'btn3';
    else if (pressed(3)) this.gamepadHighlight = 'btn4';
    else if (pressed(4)) this.gamepadHighlight = 'l1';
    else if (pressed(5)) this.gamepadHighlight = 'r1';
    else this.gamepadHighlight = null;

    this.syncGamepadButtonState(connectedPads);
  }

  /** Fusionne l'état de TOUTES les manettes connectées pour le calcul de front montant
   * (wasPressed) au prochain appel — factorisé car utilisé par les 3 sorties de
   * pollGamepad() (visée penalty, plongeon gardien, mappage normal). */
  private syncGamepadButtonState(connectedPads: Gamepad[]): void {
    const merged: boolean[] = [];
    connectedPads.forEach((pad) => {
      pad.buttons.forEach((b, i) => { merged[i] = merged[i] || b.pressed; });
    });
    this.gamepadPrevButtons = merged;
  }

  // ─── Méthodes UI ─────────────────────────────────────────────────────

  /** Lignes def/mid/fwd d'une formation, pour le petit schéma tactique du carrousel */
  getFormationRows(formation: FormationKey): number[][] {
    const f = FOOTBALL_CONFIG.FORMATIONS[formation];
    const rows: number[][] = [[f.defenders]];
    if (f.midfielders <= 5) {
      rows.push([f.midfielders]);
    } else {
      rows.push([2], [f.midfielders - 2]);
    }
    rows.push([f.forwards]);
    return rows;
  }

  /** Position (%) + numéro de chaque titulaire sur le mini-terrain de la révélation
   * avant coup d'envoi — reprend les vraies positions x/z de la formation choisie
   * (les mêmes que celles utilisées par `PlayerService.createTeam()` pour le coup
   * d'envoi réel), pour un schéma fidèle plutôt qu'un simple nombre de points par ligne. */
  getFormationLayout(team: 'home' | 'away'): { xPct: number; yPct: number; role: string; number: number }[] {
    const formation = FOOTBALL_CONFIG.FORMATIONS[this.currentFormation(team)];
    const roster = (team === 'home' ? this.homeRosterState : this.awayRosterState)?.roster;
    return formation.positions.map((pos, i) => ({
      xPct: 50 + (pos.x / 16) * 40,
      yPct: 90 - ((pos.z + 48) / 40) * 80,
      role: pos.role,
      number: roster?.[i]?.number ?? i + 1,
    }));
  }

  /** Couleur de maillot à afficher sur un poste du schéma de formation (gardien distingué) */
  formationJerseyColor(team: 'home' | 'away', role: string): string {
    if (role === 'gk') {
      const teamData = team === 'home' ? this.selectedHomeTeam : this.selectedAwayTeam;
      return teamData?.colors?.[team]?.keeper ?? '#e8b400';
    }
    const jersey = team === 'home' ? this.selectedHomeJersey : this.selectedAwayJersey;
    return jersey?.primary ?? '#ffffff';
  }

  // ─── Réglages du match : listes horizontales défilantes ──────────────
  // Chaque bloc de réglages (difficulté, stade, ballon...) affiche une fenêtre de
  // 2-3 éléments à la fois plutôt que la liste complète empilée verticalement, pour
  // gagner de l'espace — les flèches gauche/droite décalent cette fenêtre.
  private settingsScrollOffsets: Record<string, number> = {};

  /** Fenêtre visible (2-3 éléments) d'une liste de réglages, à partir du décalage courant */
  settingsWindow<T>(blockId: string, items: T[], size = 3): T[] {
    const offset = this.settingsScrollOffsets[blockId] ?? 0;
    return items.slice(offset, offset + size);
  }

  /** Vrai si la flèche gauche/droite doit être active pour ce bloc */
  canScrollSettings(blockId: string, itemsLength: number, dir: -1 | 1, size = 3): boolean {
    const offset = this.settingsScrollOffsets[blockId] ?? 0;
    return dir < 0 ? offset > 0 : offset + size < itemsLength;
  }

  scrollSettings(blockId: string, itemsLength: number, dir: -1 | 1, size = 3): void {
    const offset = this.settingsScrollOffsets[blockId] ?? 0;
    const next = Math.min(Math.max(0, offset + dir), Math.max(0, itemsLength - size));
    this.settingsScrollOffsets[blockId] = next;
  }

  selectDifficulty(difficulty: DifficultyKey): void {
    if (this.matchStarted) return;
    this.selectedDifficulty = difficulty;
  }

  // ─── Caméra ────────────────────────────────────────────────────────────

  /** Verrouille/déverrouille la rotation de la caméra à la souris/tactile (le suivi automatique du ballon reste actif) */
  toggleViewLock(): void {
    this.viewLocked = !this.viewLocked;
    if (!this.camera) return;
    if (this.viewLocked) {
      this.camera.detachControl();
    } else {
      this.camera.attachControl(this.canvasRef.nativeElement, true);
    }
  }

  /** Rapproche/éloigne la caméra (fonctionne même vue verrouillée, indépendant du pan/rotation souris) */
  cameraZoomIn(): void {
    if (!this.camera) return;
    this.camera.radius = Math.max(FOOTBALL_CONFIG.CAMERA.MIN_DISTANCE, this.camera.radius - 8);
  }

  cameraZoomOut(): void {
    if (!this.camera) return;
    this.camera.radius = Math.min(FOOTBALL_CONFIG.CAMERA.MAX_DISTANCE, this.camera.radius + 8);
  }

  /** Applique un preset d'angle de caméra (façon jeux de foot : End-to-End/Tactique/
   * Broadcast/Dynamique/Coop/Rapprochée/Vue joueur) */
  setCameraPreset(preset: CameraPreset): void {
    if (!this.camera) return;
    this.camera.alpha = preset.alpha;
    this.camera.beta = preset.beta;
    this.camera.radius = preset.radius;
    this.activeCameraPresetId = preset.id;
    this.activeCameraMode = preset.mode ?? 'orbit';
    this.dynamicZoomRange = preset.dynamicZoom ?? null;

    // "Vue joueur" pilote alpha/target elle-même chaque frame (cf. updatePlayerCamera) :
    // le contrôle souris/tactile serait sinon en conflit permanent avec ce pilotage.
    if (this.activeCameraMode === 'player') {
      this.camera.detachControl();
    } else if (!this.viewLocked) {
      this.camera.attachControl(this.canvasRef.nativeElement, true);
    }
  }

  // ─── Taille des joueurs (ajustement en direct) ─────────────────────────

  increasePlayerSize(): void {
    this.playerSizeMultiplier = Math.min(this.PLAYER_SIZE_MULTIPLIER_MAX, +(this.playerSizeMultiplier + this.PLAYER_SIZE_MULTIPLIER_STEP).toFixed(2));
    this.playerService?.setLiveScaleMultiplier(this.playerSizeMultiplier);
  }

  decreasePlayerSize(): void {
    this.playerSizeMultiplier = Math.max(this.PLAYER_SIZE_MULTIPLIER_MIN, +(this.playerSizeMultiplier - this.PLAYER_SIZE_MULTIPLIER_STEP).toFixed(2));
    this.playerService?.setLiveScaleMultiplier(this.playerSizeMultiplier);
  }

  // ─── Aide "Comment jouer" ───────────────────────────────────────────────

  helpTab: 'clavier' | 'manette' | 'tactile' = 'clavier';

  openHelpModal(): void {
    this.closeContextMenu();
    // Ouvre directement sur l'onglet pertinent pour l'appareil utilisé
    this.helpTab = this.isTouchDevice ? 'tactile' : 'clavier';
    this.showHelpModal = true;
  }

  closeHelpModal(): void {
    this.showHelpModal = false;
  }

  setHelpTab(tab: 'clavier' | 'manette' | 'tactile'): void {
    this.helpTab = tab;
  }

  // ─── Menu contextuel (clic droit) ──────────────────────────────────────

  onCanvasContextMenu(event: MouseEvent): void {
    if (!this.showMatch) return;
    event.preventDefault();
    this.contextMenuX = event.clientX;
    this.contextMenuY = event.clientY;
    this.contextMenuVisible = true;
  }

  closeContextMenu(): void {
    this.contextMenuVisible = false;
  }

  // ─── Navigation manette du menu contextuel / du modal pause ────────────
  // Demande : même logique que la souris (clic droit = ouvrir, clic = valider) mais à
  // la manette — Select (bouton "Select"/B8) ouvre le menu contextuel, stick gauche
  // haut/bas fait défiler, gauche/droite entre/sort d'un sous-menu (Caméra, Vitesse du
  // jeu), bouton "2" valide l'item en surbrillance, bouton "3" ferme tout le menu. Le
  // modal pause (Continuer/Remplacement/Quitter) réutilise exactement la même
  // navigation, sans bouton d'ouverture dédié : il s'ouvre déjà via Start (pauseGame()).

  /** Racine DOM du menu actuellement navigable (un seul à la fois : le modal pause a
   * priorité s'il est affiché, sinon le menu contextuel s'il est ouvert). */
  private getActiveMenuRoot(): HTMLElement | null {
    if (this.showPauseModal && this.pauseModalElRef) return this.pauseModalElRef.nativeElement;
    if (this.contextMenuVisible && this.contextMenuElRef) return this.contextMenuElRef.nativeElement;
    if (this.showMenu && this.menuOptionsElRef) return this.menuOptionsElRef.nativeElement;
    return null;
  }

  /** Boutons actuellement cliquables dans l'ordre du DOM — grâce à *ngIf/*ngFor, un
   * sous-menu replié ou un item conditionnel absent n'apparaissent tout simplement pas
   * ici : pas besoin de gérer la visibilité séparément de la liste navigable. */
  private getMenuFocusables(): HTMLButtonElement[] {
    const root = this.getActiveMenuRoot();
    if (!root) return [];
    return Array.from(root.querySelectorAll('button:not([disabled])'));
  }

  private updateMenuFocusVisual(): void {
    const items = this.getMenuFocusables();
    items.forEach((el, i) => el.classList.toggle('gamepad-focused', i === this.menuFocusIndex));
    items[this.menuFocusIndex]?.scrollIntoView({ block: 'nearest' });
  }

  /** Select (manette) : ouvre le menu contextuel — équivalent du clic droit, mais sans
   * position de souris à réutiliser donc centré à l'écran. */
  openContextMenuViaGamepad(): void {
    if (!this.showMatch || this.contextMenuVisible || this.showPauseModal) return;
    this.contextMenuX = Math.max(20, window.innerWidth / 2 - 140);
    this.contextMenuY = Math.max(20, window.innerHeight / 2 - 220);
    this.contextMenuVisible = true;
    this.menuFocusIndex = 0;
    setTimeout(() => this.updateMenuFocusVisual(), 0);
  }

  /** Stick gauche haut/bas : fait défiler l'item en surbrillance dans le menu actif */
  navigateMenu(delta: 1 | -1): void {
    const items = this.getMenuFocusables();
    if (items.length === 0) return;
    this.menuFocusIndex = (this.menuFocusIndex + delta + items.length) % items.length;
    this.updateMenuFocusVisual();
  }

  /** Stick gauche à droite : ouvre le sous-menu (Caméra / Vitesse du jeu) si l'item en
   * surbrillance en est un déclencheur, et avance la surbrillance sur son premier item. */
  expandMenuFocused(): void {
    const items = this.getMenuFocusables();
    const el = items[this.menuFocusIndex];
    if (!el || !el.hasAttribute('data-submenu-toggle')) return;
    el.click();
    setTimeout(() => {
      const refreshed = this.getMenuFocusables();
      const idx = refreshed.indexOf(el);
      if (idx >= 0 && idx + 1 < refreshed.length) this.menuFocusIndex = idx + 1;
      this.updateMenuFocusVisual();
    }, 0);
  }

  /** Stick gauche à gauche : si l'item en surbrillance est À L'INTÉRIEUR d'un sous-menu
   * ouvert, le referme et remet la surbrillance sur son bouton bascule. */
  collapseMenuFocused(): void {
    const items = this.getMenuFocusables();
    const el = items[this.menuFocusIndex];
    const submenu = el?.closest('.context-submenu');
    if (!submenu) return;
    const toggleBtn = submenu.previousElementSibling;
    if (!(toggleBtn instanceof HTMLButtonElement)) return;
    toggleBtn.click();
    setTimeout(() => {
      const refreshed = this.getMenuFocusables();
      const idx = refreshed.indexOf(toggleBtn);
      this.menuFocusIndex = idx >= 0 ? idx : 0;
      this.updateMenuFocusVisual();
    }, 0);
  }

  /** Bouton "2" : active l'item actuellement en surbrillance (comme un clic souris dessus) */
  activateMenuFocused(): void {
    const items = this.getMenuFocusables();
    items[this.menuFocusIndex]?.click();
    setTimeout(() => this.updateMenuFocusVisual(), 0);
  }

  /** Bouton "3" : ferme le menu contextuel entièrement (pas juste un sous-menu). Le
   * modal pause ne se ferme pas ainsi (comme à la souris, il faut valider "Continuer") */
  closeMenuViaGamepad(): void {
    if (this.contextMenuVisible) this.closeContextMenu();
  }

  // ─── Navigation manette des écrans d'avant-match ────────────────────────
  // Demande : étendre la navigation manette à la galerie d'ateliers du Tutoriel, à la
  // Sélection des équipes, à Configuration et classement, aux Réglages du match et au
  // Récapitulatif. Contrairement au menu contextuel/pause (liste verticale simple), ce
  // sont des grilles/zones plus riches (cartes de jeu ou d'équipe, lignes d'effectif,
  // 11 blocs de réglages indépendants) : navigation par plus proche voisin géométrique
  // (comme la grille de la galerie /games) plutôt qu'un simple index +1/-1.

  /** Racine DOM de l'écran d'avant-match actuellement navigable — un seul à la fois,
   * la modale de détail d'équipe (ouverte PAR-DESSUS la sélection des équipes) a
   * priorité si elle est ouverte. */
  private getActiveStepRoot(): HTMLElement | null {
    if (this.detailTeam && this.teamDetailModalElRef) return this.teamDetailModalElRef.nativeElement;
    if (this.showTutorialCards && this.tutorialMenuElRef) return this.tutorialMenuElRef.nativeElement;
    if (this.showTeamSelect && this.teamSelectElRef) return this.teamSelectElRef.nativeElement;
    if (this.showFormation && this.formationElRef) return this.formationElRef.nativeElement;
    if (this.showSettings && this.settingsElRef) return this.settingsElRef.nativeElement;
    if (this.showRecap && this.recapElRef) return this.recapElRef.nativeElement;
    return null;
  }

  /** Éléments cliquables navigables de l'écran actif. Au-delà des vrais `<button>`,
   * plusieurs contrôles de ces écrans sont de simples `<div (click)>` (cartes d'équipe
   * `.ts-card`, lignes d'effectif `.roster-row`) ou une case à cocher HTML — inclus
   * explicitement, une manette ne pouvait sinon pas du tout les atteindre. */
  private getStepFocusables(): HTMLElement[] {
    const root = this.getActiveStepRoot();
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), .ts-card, .roster-row, input[type="checkbox"]'
    ));
  }

  private updateStepFocusVisual(): void {
    const items = this.getStepFocusables();
    items.forEach((el, i) => el.classList.toggle('gamepad-focused', i === this.stepFocusIndex));
    items[this.stepFocusIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /** Stick gauche : déplace la surbrillance vers le plus proche voisin dans la
   * direction pressée (même algorithme que GamesHubComponent — géométrie réelle via
   * getBoundingClientRect, pas un calcul de colonnes fixe qui serait faux dès que la
   * grille change de largeur). */
  private navigateStep(direction: 'up' | 'down' | 'left' | 'right'): void {
    const items = this.getStepFocusables();
    if (items.length === 0) return;
    if (this.stepFocusIndex >= items.length) this.stepFocusIndex = 0;

    const fromRect = items[this.stepFocusIndex].getBoundingClientRect();
    const fromCenter = { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 };
    let best = -1;
    let bestScore = Infinity;

    items.forEach((el, i) => {
      if (i === this.stepFocusIndex) return;
      const r = el.getBoundingClientRect();
      const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const dx = center.x - fromCenter.x;
      const dy = center.y - fromCenter.y;
      let primary: number;
      let secondary: number;
      switch (direction) {
        case 'right': if (dx <= 1) return; primary = dx; secondary = Math.abs(dy); break;
        case 'left': if (dx >= -1) return; primary = -dx; secondary = Math.abs(dy); break;
        case 'down': if (dy <= 1) return; primary = dy; secondary = Math.abs(dx); break;
        case 'up': if (dy >= -1) return; primary = -dy; secondary = Math.abs(dx); break;
      }
      const score = primary + secondary * 3;
      if (score < bestScore) { bestScore = score; best = i; }
    });

    if (best !== -1) this.stepFocusIndex = best;
    this.updateStepFocusVisual();
  }

  /** Bouton "2" : active l'item en surbrillance — un clic programmatique déclenche
   * normalement le binding Angular (click) sous-jacent, que la cible soit un vrai
   * `<button>` ou un `<div (click)>` (.ts-card/.roster-row) ; sur une case à cocher,
   * .click() bascule aussi correctement son état et déclenche le [(ngModel)]. */
  private activateStepFocused(): void {
    const items = this.getStepFocusables();
    const el = items[this.stepFocusIndex];
    if (!el) return;
    el.click();
    setTimeout(() => this.updateStepFocusVisual(), 0);
  }

  contextTogglePause(): void {
    this.closeContextMenu();
    if (this.gameState?.match.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  contextToggleViewLock(): void {
    this.closeContextMenu();
    this.toggleViewLock();
  }

  contextSubstitution(): void {
    this.closeContextMenu();
    if (!this.gameState?.match.isPaused) this.pauseGame();
    this.openSubstitutionFlow();
  }

  /** Ouvre/ferme le sous-panneau caméra + taille des joueurs à l'intérieur du menu contextuel (ne ferme pas le menu) */
  toggleContextCameraPanel(): void {
    this.contextCameraOpen = !this.contextCameraOpen;
  }

  /** Ouvre/ferme le sous-panneau vitesse du jeu à l'intérieur du menu contextuel (ne ferme pas le menu) */
  toggleContextSpeedPanel(): void {
    this.contextSpeedOpen = !this.contextSpeedOpen;
  }

  /** Change la vitesse du jeu (glissière ou préréglage) — cf. startGameLoop() pour son application */
  setGameSpeed(value: number): void {
    this.gameSpeedMultiplier = Math.min(this.GAME_SPEED_MAX, Math.max(this.GAME_SPEED_MIN, value));
  }

  onGameSpeedSlider(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setGameSpeed(+input.value);
  }

  get hasActiveGoalCelebration(): boolean {
    return !!this.gameState?.match.isGoalScored;
  }

  get hasGoalReplay(): boolean {
    return !!this.lastGoalReplay && this.lastGoalReplay.length > 5;
  }

  contextStopCelebration(): void {
    this.closeContextMenu();
    this.endGoalCelebration();
  }

  contextShowGoalReplay(): void {
    this.closeContextMenu();
    if (this.gameState?.match.isGoalScored) this.endGoalCelebration();
    this.playGoalReplay();
  }

  /** Auto-play : laisse les deux équipes s'affronter automatiquement (utile pour apprendre le jeu en observant) */
  contextToggleAutoPlay(): void {
    this.closeContextMenu();
    this.autoPlayEnabled = !this.autoPlayEnabled;
  }

  /** Trajectoire (traînée) du ballon sur tir/passe */
  contextToggleBallTrail(): void {
    this.closeContextMenu();
    this.ballTrailEnabled = !this.ballTrailEnabled;
    this.ballService?.setTrailEnabled(this.ballTrailEnabled);
  }

  /** Noms/numéros au-dessus de la tête de tous les joueurs */
  contextToggleAllPlayerLabels(): void {
    this.closeContextMenu();
    this.showAllPlayerLabels = !this.showAllPlayerLabels;
  }

  /** Cercle jaune au sol sous le porteur du ballon */
  contextToggleBallCarrierRing(): void {
    this.closeContextMenu();
    this.showBallCarrierRing = !this.showBallCarrierRing;
    // Applique tout de suite au porteur actuel (sans attendre son prochain contact
    // avec le ballon, seul autre moment où la visibilité de l'anneau est recalculée)
    const allPlayers = [...(this.gameState?.homePlayers ?? []), ...(this.gameState?.awayPlayers ?? [])];
    for (const p of allPlayers) {
      p.ballCarrierRing.isVisible = p.ringLingerTimer > 0 && this.showBallCarrierRing;
    }
  }

  /** Radar (mini-carte) en bas de l'écran */
  contextToggleRadar(): void {
    this.closeContextMenu();
    this.showRadar = !this.showRadar;
    if (!this.showRadar) this.radarDots = [];
  }

  /** "Terrain seul" : masque les tribunes/toit/projecteurs du stade choisi en réglages */
  contextTogglePitchOnly(): void {
    this.closeContextMenu();
    this.pitchOnlyMode = !this.pitchOnlyMode;
    this.stadiumService?.setStandsVisible(!this.pitchOnlyMode);
  }

  /** Vue d'ensemble du stade (recul caméra pour admirer l'anneau/toit/écrans) — stade premium uniquement */
  contextStadiumOverview(): void {
    this.closeContextMenu();
    if (!this.camera) return;
    this.camera.alpha = 0.5;
    this.camera.beta = 0.42;
    this.camera.radius = 190;
  }

  contextQuit(): void {
    this.closeContextMenu();
    this.backToMenu();
  }

  // ─── Pause / remplacements en cours de match ──────────────────────────

  pauseGame(): void {
    if (!this.gameState) return;
    this.gameState.match.isPaused = true;
    this.showPauseModal = true;
  }

  resumeGame(): void {
    if (!this.gameState) return;
    this.gameState.match.isPaused = false;
    this.showPauseModal = false;
  }

  openSubstitutionFlow(): void {
    this.substitutionFlowActive = true;
    this.showPauseModal = false;
    this.showMatch = false;
    this.showFormation = true;
  }

  remainingSubstitutions(team: 'home' | 'away'): number {
    return this.matchSettings.substitutionsAllowed - this.getRosterState(team).substitutionsUsed;
  }

  // ─── Nettoyage ───────────────────────────────────────────────────────

  private disposeGame(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.goalCelebrationTimeout) {
      clearTimeout(this.goalCelebrationTimeout);
      this.goalCelebrationTimeout = null;
    }
    if (this.replayPlaybackTimer) {
      clearInterval(this.replayPlaybackTimer);
      this.replayPlaybackTimer = null;
    }
    this.replayActive = false;
    this.audioService?.stopCrowdAmbiance();
    this.stadiumService?.dispose();
    this.playerService?.dispose();
    this.crowdService?.dispose();
    this.ballService?.dispose();
    this.playerService?.disposeDummies(this.trainingDummies);
    this.trainingDummies = [];
    this.scene?.dispose();
    this.world?.free();
  }
}
