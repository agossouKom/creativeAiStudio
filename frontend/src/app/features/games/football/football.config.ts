/**
 * Configuration du jeu de football
 * Basé sur les specs FIFA adaptées pour le web
 */
export const FOOTBALL_CONFIG = {
  // ─── Terrain (proportions FIFA 105x68 adaptées) ───────────────────────
  FIELD: {
    LENGTH: 105,           // mètres
    WIDTH: 68,             // mètres
    GOAL_WIDTH: 7.32,      // mètres (FIFA)
    GOAL_HEIGHT: 2.44,     // mètres (FIFA)
    GOAL_DEPTH: 2.0,       // profondeur du but
    PENALTY_AREA_WIDTH: 40.3,
    PENALTY_AREA_LENGTH: 16.5,
    GOAL_AREA_WIDTH: 18.3,
    GOAL_AREA_LENGTH: 5.5,
    PENALTY_SPOT_DISTANCE: 11.0,
    CENTER_CIRCLE_RADIUS: 9.15,
    PENALTY_ARC_RADIUS: 9.15, // même rayon que le cercle central (règle FIFA)
    CORNER_ARC_RADIUS: 1.0,
    BORDER_MARGIN: 10,     // marge autour du terrain (piste d'athlétisme + tribunes)
    TRACK_WIDTH: 7,        // largeur de la piste d'athlétisme
    TRACK_GAP: 1.5,        // espace entre la ligne de touche/but et le bord intérieur de la piste
  },

  // ─── Ballon ───────────────────────────────────────────────────────────
  BALL: {
    DIAMETER: 0.45,        // mètres (taille 5 FIFA)
    MASS: 0.45,            // kg
    FRICTION: 0.6,
    RESTITUTION: 0.7,      // rebond
    LINEAR_DAMPING: 0.3,
    ANGULAR_DAMPING: 0.5,
    MAX_SPEED: 30,         // m/s (~108 km/h)
  },

  // ─── Joueurs ──────────────────────────────────────────────────────────
  PLAYER: {
    HEIGHT: 1.80,          // mètres
    WIDTH: 0.5,
    DEPTH: 0.3,
    SPEED: 7.0,            // m/s (~25 km/h)
    SPRINT_SPEED: 12.5,    // m/s (~45 km/h) — relevé (était 10/36 km/h, jugé trop lent)
    ACCELERATION: 8.0,
    TURN_SPEED: 4.0,       // rad/s
    STAMINA_MAX: 100,
    STAMINA_DRAIN_SPRINT: 15,  // par seconde
    STAMINA_RECOVER: 8,        // par seconde au repos
    KICK_POWER_MIN: 5,
    KICK_POWER_MAX: 25,
    PASS_POWER: 15,
    TACKLE_RANGE: 1.5,
    TACKLE_COOLDOWN: 1.0,  // secondes
  },

  // ─── Match ────────────────────────────────────────────────────────────
  MATCH: {
    HALF_DURATION: 180,    // 3 minutes par mi-temps (configurable)
    HALF_TIME_BREAK: 10,   // secondes
    EXTRA_TIME_HALF: 60,   // 1 minute par prolongation
    PENALTY_ROUNDS: 5,
    MAX_SUBSTITUTIONS: 3,
    OFFSIDE_ENABLED: true,
    FOULS_ENABLED: true,
    YELLOW_CARDS_ENABLED: true,
    RED_CARDS_ENABLED: true,
  },

  // ─── Caméra ───────────────────────────────────────────────────────────
  CAMERA: {
    DEFAULT_POSITION: { x: 0, y: 40, z: 50 },
    TARGET_OFFSET: { x: 0, y: 0, z: 0 },
    MIN_DISTANCE: 15,
    MAX_DISTANCE: 220, // assez loin pour la "vue d'ensemble du stade" premium et les plus grands anneaux (hexagonal)
    ZOOM_SPEED: 2,
    ROTATION_SPEED: 0.5,
  },

  // ─── Graphismes ───────────────────────────────────────────────────────
  GRAPHICS: {
    SHADOWS: true,
    SHADOW_MAP_SIZE: 2048,
    FOG: true,
    // Éclairage terne signalé (comparé à des captures de référence à l'éclairage net/
    // contrasté) : brouillard par défaut (temps clair) éclairci (était un bleu marine
    // sombre 0.09/0.16/0.28, presque du brouillard de nuit même en plein jour) et
    // lumières ambiante/directionnelle renforcées ci-dessous. Le brouillard spécifique
    // à la pluie/neige (fogColorHex, cf. football.component.ts startMatch()) reste
    // inchangé — lui doit rester sombre/dense.
    FOG_COLOR: { r: 0.35, g: 0.42, b: 0.55 },
    AMBIENT_LIGHT_INTENSITY: 0.55,
    DIRECTIONAL_LIGHT_INTENSITY: 1.1,
    FLOODLIGHT_INTENSITY: 0.3,
    STADIUM_SEATS: 5000,   // nombre de sièges à générer
    CROWD_ANIMATED: true,
  },

  // ─── Formations ───────────────────────────────────────────────────────
  FORMATIONS: {
    '4-4-2': {
      name: '4-4-2 Classique',
      defenders: 4,
      midfielders: 4,
      forwards: 2,
      positions: [
        // Gardien
        { x: 0, z: -48, role: 'gk' },
        // Défenseurs
        { x: -12, z: -38, role: 'def' },
        { x: -4, z: -38, role: 'def' },
        { x: 4, z: -38, role: 'def' },
        { x: 12, z: -38, role: 'def' },
        // Milieux
        { x: -10, z: -25, role: 'mid' },
        { x: -3, z: -22, role: 'mid' },
        { x: 3, z: -22, role: 'mid' },
        { x: 10, z: -25, role: 'mid' },
        // Attaquants
        { x: -5, z: -12, role: 'fwd' },
        { x: 5, z: -12, role: 'fwd' },
      ]
    },
    '4-3-3': {
      name: '4-3-3 Offensif',
      defenders: 4,
      midfielders: 3,
      forwards: 3,
      positions: [
        { x: 0, z: -48, role: 'gk' },
        { x: -12, z: -38, role: 'def' },
        { x: -4, z: -38, role: 'def' },
        { x: 4, z: -38, role: 'def' },
        { x: 12, z: -38, role: 'def' },
        { x: -6, z: -25, role: 'mid' },
        { x: 0, z: -22, role: 'mid' },
        { x: 6, z: -25, role: 'mid' },
        { x: -10, z: -12, role: 'fwd' },
        { x: 0, z: -10, role: 'fwd' },
        { x: 10, z: -12, role: 'fwd' },
      ]
    },
    '3-5-2': {
      name: '3-5-2 Milieu renforcé',
      defenders: 3,
      midfielders: 5,
      forwards: 2,
      positions: [
        { x: 0, z: -48, role: 'gk' },
        { x: -8, z: -38, role: 'def' },
        { x: 0, z: -40, role: 'def' },
        { x: 8, z: -38, role: 'def' },
        { x: -14, z: -25, role: 'mid' },
        { x: -5, z: -22, role: 'mid' },
        { x: 0, z: -20, role: 'mid' },
        { x: 5, z: -22, role: 'mid' },
        { x: 14, z: -25, role: 'mid' },
        { x: -6, z: -12, role: 'fwd' },
        { x: 6, z: -12, role: 'fwd' },
      ]
    },
    '4-2-3-1': {
      name: '4-2-3-1 Équilibré',
      defenders: 4,
      midfielders: 5,
      forwards: 1,
      positions: [
        { x: 0, z: -48, role: 'gk' },
        { x: -12, z: -38, role: 'def' },
        { x: -4, z: -38, role: 'def' },
        { x: 4, z: -38, role: 'def' },
        { x: 12, z: -38, role: 'def' },
        { x: -6, z: -30, role: 'mid' },
        { x: 6, z: -30, role: 'mid' },
        { x: -12, z: -18, role: 'mid' },
        { x: 0, z: -16, role: 'mid' },
        { x: 12, z: -18, role: 'mid' },
        { x: 0, z: -8, role: 'fwd' },
      ]
    },
    '4-1-4-1': {
      name: '4-1-4-1 Défensif',
      defenders: 4,
      midfielders: 5,
      forwards: 1,
      positions: [
        { x: 0, z: -48, role: 'gk' },
        { x: -12, z: -38, role: 'def' },
        { x: -4, z: -38, role: 'def' },
        { x: 4, z: -38, role: 'def' },
        { x: 12, z: -38, role: 'def' },
        { x: 0, z: -30, role: 'mid' },
        { x: -14, z: -20, role: 'mid' },
        { x: -5, z: -18, role: 'mid' },
        { x: 5, z: -18, role: 'mid' },
        { x: 14, z: -20, role: 'mid' },
        { x: 0, z: -8, role: 'fwd' },
      ]
    },
    '3-4-3': {
      name: '3-4-3 Offensif',
      defenders: 3,
      midfielders: 4,
      forwards: 3,
      positions: [
        { x: 0, z: -48, role: 'gk' },
        { x: -10, z: -40, role: 'def' },
        { x: 0, z: -42, role: 'def' },
        { x: 10, z: -40, role: 'def' },
        { x: -14, z: -25, role: 'mid' },
        { x: -5, z: -22, role: 'mid' },
        { x: 5, z: -22, role: 'mid' },
        { x: 14, z: -25, role: 'mid' },
        { x: -10, z: -12, role: 'fwd' },
        { x: 0, z: -10, role: 'fwd' },
        { x: 10, z: -12, role: 'fwd' },
      ]
    },
    '5-3-2': {
      name: '5-3-2 Verrouillé',
      defenders: 5,
      midfielders: 3,
      forwards: 2,
      positions: [
        { x: 0, z: -48, role: 'gk' },
        { x: -16, z: -38, role: 'def' },
        { x: -8, z: -40, role: 'def' },
        { x: 0, z: -41, role: 'def' },
        { x: 8, z: -40, role: 'def' },
        { x: 16, z: -38, role: 'def' },
        { x: -8, z: -24, role: 'mid' },
        { x: 0, z: -22, role: 'mid' },
        { x: 8, z: -24, role: 'mid' },
        { x: -6, z: -12, role: 'fwd' },
        { x: 6, z: -12, role: 'fwd' },
      ]
    },
    '4-5-1': {
      name: '4-5-1 Milieu dominant',
      defenders: 4,
      midfielders: 5,
      forwards: 1,
      positions: [
        { x: 0, z: -48, role: 'gk' },
        { x: -12, z: -38, role: 'def' },
        { x: -4, z: -38, role: 'def' },
        { x: 4, z: -38, role: 'def' },
        { x: 12, z: -38, role: 'def' },
        { x: -16, z: -24, role: 'mid' },
        { x: -8, z: -22, role: 'mid' },
        { x: 0, z: -20, role: 'mid' },
        { x: 8, z: -22, role: 'mid' },
        { x: 16, z: -24, role: 'mid' },
        { x: 0, z: -10, role: 'fwd' },
      ]
    },
    '5-4-1': {
      name: '5-4-1 Bus garé',
      defenders: 5,
      midfielders: 4,
      forwards: 1,
      positions: [
        { x: 0, z: -48, role: 'gk' },
        { x: -16, z: -38, role: 'def' },
        { x: -8, z: -40, role: 'def' },
        { x: 0, z: -41, role: 'def' },
        { x: 8, z: -40, role: 'def' },
        { x: 16, z: -38, role: 'def' },
        { x: -12, z: -24, role: 'mid' },
        { x: -4, z: -22, role: 'mid' },
        { x: 4, z: -22, role: 'mid' },
        { x: 12, z: -24, role: 'mid' },
        { x: 0, z: -10, role: 'fwd' },
      ]
    },
    '4-4-1-1': {
      name: '4-4-1-1 Duo étagé',
      defenders: 4,
      midfielders: 4,
      forwards: 2,
      positions: [
        { x: 0, z: -48, role: 'gk' },
        { x: -12, z: -38, role: 'def' },
        { x: -4, z: -38, role: 'def' },
        { x: 4, z: -38, role: 'def' },
        { x: 12, z: -38, role: 'def' },
        { x: -12, z: -24, role: 'mid' },
        { x: -4, z: -22, role: 'mid' },
        { x: 4, z: -22, role: 'mid' },
        { x: 12, z: -24, role: 'mid' },
        { x: 0, z: -16, role: 'fwd' },
        { x: 0, z: -8, role: 'fwd' },
      ]
    }
  },

  // ─── Couleurs des équipes ─────────────────────────────────────────────
  TEAMS: {
    home: {
      primary: { r: 0.2, g: 0.35, b: 0.95 },     // Bleu
      secondary: { r: 1, g: 1, b: 1 },             // Blanc
      keeper: { r: 0.1, g: 0.7, b: 0.2 },          // Vert
      skin: { r: 0.9, g: 0.7, b: 0.5 },            // Peau
    },
    away: {
      primary: { r: 0.95, g: 0.2, b: 0.2 },        // Rouge
      secondary: { r: 1, g: 1, b: 1 },              // Blanc
      keeper: { r: 0.1, g: 0.2, b: 0.7 },           // Bleu foncé
      skin: { r: 0.9, g: 0.7, b: 0.5 },             // Peau
    }
  },

  // ─── Niveaux de difficulté IA ─────────────────────────────────────────
  DIFFICULTY: {
    easy: {
      reactionTime: 0.5,       // délai de réaction (secondes)
      passAccuracy: 0.6,
      shotAccuracy: 0.4,
      speed: 0.7,              // facteur de vitesse
      aggression: 0.3,         // probabilité de tacle
      positioning: 0.5,        // qualité du placement
    },
    medium: {
      reactionTime: 0.3,
      passAccuracy: 0.75,
      shotAccuracy: 0.6,
      speed: 0.85,
      aggression: 0.5,
      positioning: 0.7,
    },
    hard: {
      reactionTime: 0.15,
      passAccuracy: 0.9,
      shotAccuracy: 0.8,
      speed: 1.0,
      aggression: 0.7,
      positioning: 0.9,
    }
  }
} as const;

export type FormationKey = keyof typeof FOOTBALL_CONFIG.FORMATIONS;
export type DifficultyKey = keyof typeof FOOTBALL_CONFIG.DIFFICULTY;
export type PlayerRole = 'gk' | 'def' | 'mid' | 'fwd';

// ─── Réglages avant-match (stade, ballon, météo, commentateurs, ambiance) ──

/**
 * Forme réelle des tribunes (pas juste une couleur) — portée depuis les maquettes
 * Three.js de référence (footBall/gallerieStadeOK/) vers la construction Babylon.js
 * du stade (stadium.service.ts). 'oval' est le stade "premium" (le plus riche
 * visuellement : écrans géants, toit complet, panneaux publicitaires).
 */
export type StadiumShape = 'oval' | 'rect' | 'round' | 'hex' | 'boutique' | 'simple' | 'modular' | 'training';

export interface StadiumOption {
  id: string;
  name: string;
  city: string;
  capacity: number;
  standColor: string;
  roofColor: string;
  shape: StadiumShape;
  /** Stade phare : tribunes ovales complètes, écrans géants, options supplémentaires en jeu */
  premium?: boolean;
}

export const STADIUMS: StadiumOption[] = [
  { id: 'olympia-arena', name: 'Olympia Arena', city: 'Cité Olympique', capacity: 82000, standColor: '#171f2e', roofColor: '#dfe4ea', shape: 'oval', premium: true },
  { id: 'riverside', name: 'Riverside Park', city: 'Londres', capacity: 60000, standColor: '#1f3a2a', roofColor: '#2f5c3f', shape: 'rect' },
  { id: 'coliseo', name: 'Coliseo Central', city: 'Buenos Aires', capacity: 68000, standColor: '#2a1f3a', roofColor: '#4a2f5c', shape: 'round' },
  { id: 'nordarena', name: 'Nord Arena', city: 'Dortmund', capacity: 65000, standColor: '#3a3a1f', roofColor: '#5c5c2f', shape: 'hex' },
  { id: 'petit-parc', name: 'Le Petit Parc', city: 'Lyon', capacity: 32000, standColor: '#2a2a2a', roofColor: '#454545', shape: 'boutique' },
  { id: 'stade-municipal', name: 'Stade Municipal', city: 'Périgueux', capacity: 8000, standColor: '#1f2a44', roofColor: '#2f3b5c', shape: 'simple' },
  { id: 'arena-modulaire', name: 'Arena Modulaire', city: 'Site temporaire', capacity: 15000, standColor: '#4a4f58', roofColor: '#4a4f58', shape: 'modular' },
  { id: 'centre-entrainement', name: "Centre d'Entraînement", city: 'Complexe sportif', capacity: 500, standColor: '#22262e', roofColor: '#22262e', shape: 'training' },
];

export interface BallOption {
  id: string;
  name: string;
  accentColor: string;
}

export const BALLS: BallOption[] = [
  { id: 'classic', name: 'Classique Pentagones', accentColor: '#222222' },
  { id: 'flash', name: 'Flash Orange', accentColor: '#ff6a00' },
  { id: 'aurora', name: 'Aurora Bleu', accentColor: '#0057ff' },
  { id: 'gold-cup', name: 'Gold Cup', accentColor: '#d4af37' },
  { id: 'night-glow', name: 'Night Glow', accentColor: '#39ff14' },
];

export type WeatherKey = 'soleil' | 'pluie' | 'neige';

export interface WeatherOption {
  id: WeatherKey;
  name: string;
  icon: string;
  fogColor: { r: number; g: number; b: number };
  /** Impact gameplay : vitesse/accélération des joueurs (glisse), et friction/rebond du ballon */
  playerSpeedFactor: number;
  playerAccelFactor: number;
  ballFrictionFactor: number;
  ballRestitutionFactor: number;
}

export const WEATHER_OPTIONS: WeatherOption[] = [
  { id: 'soleil', name: 'Soleil', icon: '☀️', fogColor: { r: 0.4, g: 0.55, b: 0.75 },
    playerSpeedFactor: 1, playerAccelFactor: 1, ballFrictionFactor: 1, ballRestitutionFactor: 1 },
  { id: 'pluie', name: 'Pluie', icon: '🌧️', fogColor: { r: 0.25, g: 0.28, b: 0.32 },
    playerSpeedFactor: 0.92, playerAccelFactor: 0.8, ballFrictionFactor: 0.55, ballRestitutionFactor: 0.7 },
  { id: 'neige', name: 'Neige', icon: '❄️', fogColor: { r: 0.75, g: 0.78, b: 0.85 },
    playerSpeedFactor: 0.8, playerAccelFactor: 0.65, ballFrictionFactor: 0.4, ballRestitutionFactor: 0.5 },
];

export interface CommentatorOption {
  id: string;
  name: string;
  language: string;
}

export const COMMENTATORS: CommentatorOption[] = [
  { id: 'none', name: 'Aucun commentateur', language: '—' },
  { id: 'julien-fr', name: 'Julien Duprix', language: 'Français' },
  { id: 'martina-fr', name: 'Martina Costa', language: 'Français' },
  { id: 'mike-en', name: 'Mike Sanders', language: 'English' },
  { id: 'olu-en', name: 'Olu Bankole', language: 'English' },
  { id: 'diego-es', name: 'Diego Fuentes', language: 'Español' },
];

export interface CrowdStyleOption {
  id: string;
  name: string;
  description: string;
}

export const CROWD_STYLES: CrowdStyleOption[] = [
  { id: 'calme', name: 'Calme', description: 'Réactions discrètes, ambiance posée' },
  { id: 'energique', name: 'Énergique', description: 'Chants continus, vagues fréquentes' },
  { id: 'festif', name: 'Festif', description: 'Fumigènes, tifos et percussions' },
  { id: 'hostile', name: 'Hostile', description: 'Sifflets envers l\'équipe visiteuse' },
];

export const SUBSTITUTION_OPTIONS: number[] = [0, 1, 2, 3, 4, 5];

export interface DurationOption {
  id: string;
  label: string;
  halfSeconds: number;
}

export const MATCH_DURATIONS: DurationOption[] = [
  { id: 'eclair', label: '2 x 3 min (Éclair)', halfSeconds: 180 },
  { id: 'courte', label: '2 x 5 min (Courte)', halfSeconds: 300 },
  { id: 'standard', label: '2 x 10 min (Standard)', halfSeconds: 600 },
  { id: 'longue', label: '2 x 15 min (Longue)', halfSeconds: 900 },
  { id: 'reglementaire', label: '2 x 45 min (Réglementaire)', halfSeconds: 2700 },
];

export interface PlayerSizeOption {
  id: string;
  label: string;
  scale: number;
}

/** Taille de base des joueurs (visuel + collider physique), choisie avant le coup d'envoi */
export const PLAYER_SIZE_OPTIONS: PlayerSizeOption[] = [
  { id: 'normal', label: 'Normale', scale: 1.8 },
  { id: 'grande', label: 'Grande', scale: 2.2 },
  { id: 'tres-grande', label: 'Très grande', scale: 2.6 },
];

export interface CameraPreset {
  id: string;
  label: string;
  alpha: number;
  beta: number;
  radius: number;
  /** 'orbit' (défaut, omis) : suit le ballon comme les presets existants (orbite à
   * alpha/beta/radius fixes autour d'une cible qui glisse vers le ballon). 'player' :
   * colle la caméra derrière le joueur contrôlé, vue à la troisième personne (façon
   * FIFA "Player Cam") — alpha recalculé chaque frame selon sa direction. */
  mode?: 'orbit' | 'player';
  /** Zoom dynamique (radius interpolé selon l'étalement des joueurs sur le terrain :
   * resserré en mêlée, élargi quand le jeu s'étire), pour un rendu plus cinématique
   * façon caméra "Télé" (FIFA Dynamic/Tele Broadcast). */
  dynamicZoom?: { min: number; max: number };
}

/**
 * Presets d'angle de caméra façon jeux de foot (menu contextuel, ajustable en jeu).
 * `end2end` sert aussi de vue par défaut au coup d'envoi (cf. initScene()) : vue
 * d'ensemble du rectangle vert, légèrement en perspective (pas un pur aplomb) pour
 * rester lisible tout en gardant toute l'aire de jeu visible.
 */
export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'end2end', label: 'End-to-End (tout le terrain)', alpha: 0, beta: 0.3, radius: 105 },
  { id: 'tactique', label: 'Tactique (dessus)', alpha: 0, beta: 0.22, radius: 78 },
  { id: 'broadcast', label: 'Broadcast (TV)', alpha: 0, beta: 1.22, radius: 135 },
  { id: 'dynamique', label: 'Dynamique (Télé)', alpha: 0, beta: 1.1, radius: 75, dynamicZoom: { min: 55, max: 95 } },
  { id: 'coop', label: 'Coop', alpha: 0, beta: 1.32, radius: 34 },
  { id: 'rapprochee', label: 'Rapprochée', alpha: 0, beta: 0.35, radius: 42 },
  { id: 'player', label: 'Vue joueur', alpha: 0, beta: 1.25, radius: 16, mode: 'player' },
];
