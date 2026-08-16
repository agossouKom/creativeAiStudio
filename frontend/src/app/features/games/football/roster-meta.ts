import { PlayerData, TeamData } from './teams.data';

/**
 * Données dérivées pour la sélection d'équipe / feuille de match :
 * drapeaux, attributs étendus par joueur, maillots, attributs agrégés d'équipe.
 * Les 54 équipes x 22 joueurs n'ont pas d'attributs scoutés réels au-delà de
 * `stats` (voir teams.data.ts) : le reste est dérivé de façon déterministe.
 */

// ─── Drapeaux par pays ──────────────────────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {
  'France': '🇫🇷', 'Argentine': '🇦🇷', 'Brésil': '🇧🇷', 'Allemagne': '🇩🇪', 'Angleterre': '🏴',
  'Espagne': '🇪🇸', 'Italie': '🇮🇹', 'Portugal': '🇵🇹', 'Pays-Bas': '🇳🇱', 'Belgique': '🇧🇪',
  'Croatie': '🇭🇷', 'Uruguay': '🇺🇾', 'Colombie': '🇨🇴', 'Maroc': '🇲🇦', 'Sénégal': '🇸🇳',
  'Algérie': '🇩🇿', 'Tunisie': '🇹🇳', 'Cameroun': '🇨🇲', 'Nigeria': '🇳🇬', 'Ghana': '🇬🇭',
  'Égypte': '🇪🇬', 'Japon': '🇯🇵', 'Corée du Sud': '🇰🇷', 'Australie': '🇦🇺', 'Suisse': '🇨🇭',
  'Suède': '🇸🇪', 'Norvège': '🇳🇴', 'Danemark': '🇩🇰', 'Pologne': '🇵🇱', 'Turquie': '🇹🇷',
  'Ukraine': '🇺🇦', 'Côte d\'Ivoire': '🇨🇮',
};

export function getCountryFlag(country: string): string {
  return COUNTRY_FLAGS[country] ?? '🏳️';
}

// ─── Attributs étendus par joueur (dérivés des stats existantes) ────────
export interface ExtendedPlayerAttributes {
  dribble: number;      // 1-10
  agility: number;      // 1-10
  strongFoot: 'gauche' | 'droit' | 'ambidextre';
  weight: number;       // kg
  age: number;          // années
  form: 'bas' | 'moyen' | 'haut';
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function deriveExtendedAttributes(player: PlayerData, teamIndex: number): ExtendedPlayerAttributes {
  const seed = teamIndex * 31 + player.number * 7;
  const clamp10 = (n: number) => Math.max(1, Math.min(10, Math.round(n)));

  const dribble = clamp10((player.stats.speed + player.stats.passAccuracy) / 2 + (pseudoRandom(seed) - 0.5) * 2);
  const agility = clamp10((player.stats.speed + player.stats.acceleration) / 2);

  const footRoll = pseudoRandom(seed + 1);
  const strongFoot: ExtendedPlayerAttributes['strongFoot'] = footRoll < 0.75 ? 'droit' : footRoll < 0.9 ? 'gauche' : 'ambidextre';

  const weight = Math.round(68 + pseudoRandom(seed + 2) * 22); // 68-90 kg
  const baseAge = player.role === 'gk' ? 27 : 25;
  const age = Math.round(baseAge + (pseudoRandom(seed + 3) - 0.5) * 14); // ±7 ans

  const formRoll = pseudoRandom(seed + 4);
  const form: ExtendedPlayerAttributes['form'] = formRoll < 0.25 ? 'bas' : formRoll < 0.75 ? 'moyen' : 'haut';

  return { dribble, agility, strongFoot, weight, age, form };
}

// ─── Maillots dérivés des couleurs d'équipe ──────────────────────────────
export interface JerseyOption {
  id: 'home' | 'away' | 'third';
  label: string;
  primary: string;
  secondary: string;
}

export function getTeamJerseys(team: TeamData): JerseyOption[] {
  return [
    { id: 'home', label: 'Domicile', primary: team.colors.home.primary, secondary: team.colors.home.secondary },
    { id: 'away', label: 'Extérieur', primary: team.colors.away.primary, secondary: team.colors.away.secondary },
    { id: 'third', label: 'Third', primary: team.colors.away.secondary, secondary: team.colors.home.primary },
  ];
}

// ─── Attributs agrégés d'équipe (pour l'écran de sélection) ─────────────
export interface TeamAggregateAttributes {
  rapidite: number; // 0-100
  attaque: number;  // 0-100
  defense: number;  // 0-100
}

export function computeTeamAttributes(team: TeamData): TeamAggregateAttributes {
  const starters = team.players.slice(0, 11);
  const outfield = starters.filter(p => p.role !== 'gk');
  const attackers = outfield.filter(p => p.role === 'mid' || p.role === 'fwd');
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const rapidite = avg(outfield.map(p => (p.stats.speed + p.stats.acceleration) / 2));
  const attaque = avg(attackers.map(p => (p.stats.shotPower + p.stats.passAccuracy) / 2));
  const defense = avg(starters.map(p => p.stats.defense));

  return {
    rapidite: Math.round(rapidite * 10),
    attaque: Math.round(attaque * 10),
    defense: Math.round(defense * 10),
  };
}
