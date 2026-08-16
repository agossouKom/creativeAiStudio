import * as BABYLON from '@babylonjs/core';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { FOOTBALL_CONFIG, DifficultyKey } from './football.config';
import { PlayerInstance, BallInstance, MatchState, TeamConfig } from './football.types';

/**
 * Service d'intelligence artificielle
 * Gère le comportement des joueurs non contrôlés
 */
export class AIService {
  private matchState: MatchState;
  private difficulty: DifficultyKey = 'medium';
  private teamConfig: TeamConfig;
  private updateTimer = 0;
  private readonly UPDATE_INTERVAL = 0.2; // Mise à jour tous les 200ms
  /** Facteur météo (glisse sous la pluie/neige) appliqué à la vitesse des joueurs IA */
  private weatherSpeedFactor = 1;
  /** Vrai après le changement de camp à la mi-temps : inverse le but à défendre/attaquer */
  private sideSwapped = false;

  constructor(matchState: MatchState, teamConfig: TeamConfig) {
    this.matchState = matchState;
    this.teamConfig = teamConfig;
  }

  setDifficulty(difficulty: DifficultyKey): void {
    this.difficulty = difficulty;
  }

  setWeatherSpeedFactor(factor: number): void {
    this.weatherSpeedFactor = factor;
  }

  setSideSwapped(swapped: boolean): void {
    this.sideSwapped = swapped;
  }

  /** Signe Z du but que cette équipe défend (-1 = but côté -Z, +1 = but côté +Z) ; tient compte du changement de camp à la mi-temps */
  private ownGoalSign(): 1 | -1 {
    const base: 1 | -1 = this.teamConfig.id === 'home' ? -1 : 1;
    return this.sideSwapped ? (-base as 1 | -1) : base;
  }

  /**
   * Met à jour l'IA de tous les joueurs de l'équipe
   */
  update(
    players: PlayerInstance[],
    opponentPlayers: PlayerInstance[],
    ball: BallInstance,
    controlledPlayer: PlayerInstance | null,
    deltaTime: number
  ): void {
    this.updateTimer += deltaTime;
    if (this.updateTimer < this.UPDATE_INTERVAL) return;
    this.updateTimer = 0;

    const diff = FOOTBALL_CONFIG.DIFFICULTY[this.difficulty];
    const ballPos = new BABYLON.Vector3(
      ball.body.translation().x,
      ball.body.translation().y,
      ball.body.translation().z
    );

    // Le joueur de champ le plus proche du ballon fonce TOUJOURS dessus, quel que
    // soit son rôle — sans ça, un ballon hors de portée du seuil de réaction de
    // chaque rôle (pression/soutien : 8-12m) n'est jamais approché par personne.
    // C'est exactement le cas au coup d'envoi (ballon au centre, joueurs étalés en
    // formation) : sans ce comportement, aucun joueur IA ne va jamais chercher le
    // ballon, et le match ne démarre jamais tout seul (mode auto-play notamment,
    // qui n'a aucune intervention humaine pour donner le coup d'envoi à la place).
    let closest: PlayerInstance | null = null;
    let closestDist = Infinity;
    players.forEach(player => {
      if (player.isSentOff || player.isInjured || player.config.role === 'gk' || player === controlledPlayer) return;
      const d = BABYLON.Vector3.Distance(
        new BABYLON.Vector3(player.body.translation().x, 0, player.body.translation().z),
        ballPos
      );
      if (d < closestDist) {
        closestDist = d;
        closest = player;
      }
    });

    // Marquage individuel : calculé UNE FOIS par équipe/tick (pas par joueur), sous
    // peine que chaque défenseur choisisse indépendamment "l'adversaire le plus proche"
    // et que plusieurs se retrouvent à marquer LE MÊME attaquant pendant que d'autres
    // ne sont marqués par personne — cause directe de l'agglutinement rapporté. Un
    // appariement glouton (la paire la plus proche en premier) donne un marquage
    // stable et sans doublon.
    const defenders = players.filter(p => p.config.role === 'def' && !p.isSentOff && !p.isInjured && p !== controlledPlayer);
    const markAssignments = this.computeManMarking(defenders, opponentPlayers);

    // De même, si PLUSIEURS défenseurs sont à portée de pression (distToBall < 8),
    // les laisser tous foncer sur le ballon les fait se superposer sur ce point unique.
    // Seul le plus proche presse réellement ; les autres retombent sur le marquage.
    let closestDefender: PlayerInstance | null = null;
    let closestDefenderDist = Infinity;
    defenders.forEach(def => {
      const d = BABYLON.Vector3.Distance(
        new BABYLON.Vector3(def.body.translation().x, 0, def.body.translation().z),
        ballPos
      );
      if (d < closestDefenderDist) {
        closestDefenderDist = d;
        closestDefender = def;
      }
    });

    players.forEach(player => {
      if (player.isSentOff || player.isInjured) return;
      if (player === controlledPlayer) return; // Ne pas contrôler le joueur humain

      const playerPos = new BABYLON.Vector3(
        player.body.translation().x,
        player.body.translation().y,
        player.body.translation().z
      );

      // Le seuil de handoff doit rester tout près du rayon de contact réel (0,6m,
      // cf. isPlayerNearBall/checkBallCollisions) : le rendre trop généreux (ex. 2m)
      // renvoyait la décision à la logique de rôle AVANT le contact, qui elle-même
      // exige souvent que le ballon ait déjà franchi le milieu de terrain (comparaison
      // stricte z>0/z<0) — au coup d'envoi (ballon pile à z=0), cette condition reste
      // fausse indéfiniment, donc le joueur rebroussait chemin juste avant de toucher
      // le ballon, qui ne bougeait alors jamais.
      if (player === closest && closestDist > 1) {
        this.moveTowards(player, ballPos.subtract(playerPos), diff.speed * 1.05);
        return;
      }

      switch (player.config.role) {
        case 'gk':
          this.updateGoalkeeper(player, ballPos, diff);
          break;
        case 'def':
          this.updateDefender(player, playerPos, ballPos, diff, player === closestDefender, markAssignments.get(player) ?? null);
          break;
        case 'mid':
          this.updateMidfielder(player, playerPos, ballPos, opponentPlayers, diff);
          break;
        case 'fwd':
          this.updateForward(player, playerPos, ballPos, opponentPlayers, diff);
          break;
      }
    });
  }

  /**
   * Appariement glouton défenseur↔attaquant adverse le plus proche, sans doublon (un
   * attaquant déjà marqué n'est plus disponible pour un autre défenseur). Recalculé à
   * chaque tick IA (200 ms) — assez stable pour ne pas faire "sauter" le marquage
   * d'un défenseur à l'autre à chaque frame, assez réactif pour suivre le jeu.
   */
  private computeManMarking(defenders: PlayerInstance[], opponents: PlayerInstance[]): Map<PlayerInstance, BABYLON.Vector3> {
    const attackers = opponents.filter(o => !o.isSentOff && o.config.role === 'fwd');
    const pairs: { def: PlayerInstance; atk: PlayerInstance; dist: number }[] = [];
    defenders.forEach(def => {
      const defPos = new BABYLON.Vector3(def.body.translation().x, 0, def.body.translation().z);
      attackers.forEach(atk => {
        const atkPos = new BABYLON.Vector3(atk.body.translation().x, 0, atk.body.translation().z);
        pairs.push({ def, atk, dist: BABYLON.Vector3.Distance(defPos, atkPos) });
      });
    });
    pairs.sort((a, b) => a.dist - b.dist);

    const assignment = new Map<PlayerInstance, BABYLON.Vector3>();
    const takenAttackers = new Set<PlayerInstance>();
    for (const p of pairs) {
      if (assignment.has(p.def) || takenAttackers.has(p.atk)) continue;
      assignment.set(p.def, new BABYLON.Vector3(p.atk.body.translation().x, 0, p.atk.body.translation().z));
      takenAttackers.add(p.atk);
    }
    return assignment;
  }

  /**
   * IA du gardien de but (positionnement de base, décision throttlée à 200 ms comme le
   * reste de l'IA — cf. `updateGoalkeeperReflexes` ci-dessous pour la réaction rapide
   * face à un tir, appelée à CHAQUE frame séparément).
   */
  private updateGoalkeeper(player: PlayerInstance, ballPos: BABYLON.Vector3, diff: any): void {
    const goalZ = this.ownGoalSign() * FOOTBALL_CONFIG.FIELD.LENGTH / 2;

    const goalHalf = FOOTBALL_CONFIG.FIELD.GOAL_WIDTH / 2;

    // Le gardien suit le ballon sur sa ligne
    const targetX = BABYLON.Scalar.Clamp(
      ballPos.x * 0.6,
      -goalHalf + 0.5,
      goalHalf - 0.5
    );

    const direction = new BABYLON.Vector3(
      targetX - player.body.translation().x,
      0,
      goalZ - player.body.translation().z
    );

    if (direction.length() > 0.3) {
      direction.normalize();
      this.moveTowards(player, direction, diff.speed * 0.8);
    } else {
      this.stop(player);
    }
  }

  /**
   * Réflexe du gardien face à un tir — appelée à CHAQUE frame (pas throttlée à 200 ms
   * comme `update()`/`updateGoalkeeper`) : un tir peut traverser toute la surface en
   * bien moins de 200 ms, un gardien qui ne recalcule sa position qu'à ce rythme n'a
   * quasiment aucune chance de réagir à temps (root cause d'un gardien qui "ne sert à
   * rien", chaque tir cadré finissant au fond). Extrapole la trajectoire du ballon
   * (position + vitesse) pour anticiper le point d'arrivée sur la ligne de but, plutôt
   * que de suivre seulement sa position actuelle, et plonge plus vite (x1.6) qu'un
   * déplacement normal quand un tir rapide et cadré approche.
   */
  updateGoalkeeperReflexes(player: PlayerInstance, ballPos: BABYLON.Vector3, ballVel: { x: number; z: number }, diff: any): void {
    const goalZ = this.ownGoalSign() * FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    const goalHalf = FOOTBALL_CONFIG.FIELD.GOAL_WIDTH / 2;
    const approachingGoal = Math.sign(goalZ) === Math.sign(ballVel.z || 1) && Math.abs(ballVel.z) > 1;
    const speed = Math.sqrt(ballVel.x * ballVel.x + ballVel.z * ballVel.z);
    const isShot = approachingGoal && speed > 8 && Math.abs(goalZ - ballPos.z) < 28;

    let targetX: number;
    if (isShot && Math.abs(ballVel.z) > 0.5) {
      // Temps estimé avant que le ballon n'atteigne la ligne de but, position X prédite
      const t = Math.max(0, (goalZ - ballPos.z) / ballVel.z);
      const predictedX = ballPos.x + ballVel.x * t;
      targetX = BABYLON.Scalar.Clamp(predictedX, -goalHalf + 0.3, goalHalf - 0.3);
    } else {
      targetX = BABYLON.Scalar.Clamp(ballPos.x * 0.6, -goalHalf + 0.5, goalHalf - 0.5);
    }

    const direction = new BABYLON.Vector3(
      targetX - player.body.translation().x,
      0,
      goalZ - player.body.translation().z
    );
    if (direction.length() > 0.15) {
      direction.normalize();
      this.moveTowards(player, direction, diff.speed * (isShot ? 1.6 : 0.8));
    } else {
      this.stop(player);
    }
  }

  /**
   * IA du défenseur
   */
  private updateDefender(
    player: PlayerInstance,
    playerPos: BABYLON.Vector3,
    ballPos: BABYLON.Vector3,
    diff: any,
    isClosestPresser: boolean,
    assignedMark: BABYLON.Vector3 | null
  ): void {
    const isHome = this.teamConfig.id === 'home';
    const goalZ = this.ownGoalSign() * FOOTBALL_CONFIG.FIELD.LENGTH / 2;

    // Distance au ballon
    const distToBall = BABYLON.Vector3.Distance(playerPos, ballPos);

    // Seul le défenseur le plus proche du ballon presse réellement (cf. update()) — les
    // autres, même à moins de 8m, retombent sur le marquage individuel ci-dessous.
    // Sans cette exclusivité, plusieurs défenseurs convergeaient sur le même point
    // (le ballon), d'où l'agglutinement rapporté.
    if (isClosestPresser && distToBall < 8 && this.isBallInOurHalf(ballPos, isHome)) {
      // Presser le porteur du ballon
      this.moveTowards(player, ballPos.subtract(playerPos), diff.speed * diff.aggression);
    } else if (assignedMark && BABYLON.Vector3.Distance(playerPos, assignedMark) < 14) {
      // Marquage individuel (assigné une fois par équipe/tick, cf. computeManMarking —
      // garantit qu'un seul défenseur marque chaque attaquant adverse, pas plusieurs).
      this.moveTowards(player, assignedMark.subtract(playerPos), diff.speed * diff.positioning);
    } else {
      // Revenir en position défensive, 15m devant sa propre ligne de but (vers le
      // centre). Bug corrigé : l'ancien `goalZ + (isHome ? 15 : -15)` était câblé sur
      // `isHome` brut, pas sur `ownGoalSign()`/`sideSwapped` — après le changement de
      // camp à la mi-temps, `goalZ` s'inversait mais pas ce décalage, envoyant toute la
      // ligne défensive 15m AU-DELÀ de sa propre ligne de but (hors du terrain, dans les
      // tribunes) au lieu de 15m devant. `goalZ - ownGoalSign()*15` va toujours vers le
      // centre, quel que soit le camp.
      const targetZ = goalZ - this.ownGoalSign() * 15;
      const targetX = player.config.initialX * 0.5;
      const direction = new BABYLON.Vector3(targetX - playerPos.x, 0, targetZ - playerPos.z);
      this.moveTowards(player, direction, diff.speed * diff.positioning);
    }
  }

  /**
   * IA du milieu de terrain
   */
  private updateMidfielder(
    player: PlayerInstance,
    playerPos: BABYLON.Vector3,
    ballPos: BABYLON.Vector3,
    opponents: PlayerInstance[],
    diff: any
  ): void {
    const isHome = this.teamConfig.id === 'home';
    const distToBall = BABYLON.Vector3.Distance(playerPos, ballPos);

    if (distToBall < 10) {
      // Soutien au porteur du ballon
      const supportOffset = this.ownGoalSign() * 5;
      const supportPos = new BABYLON.Vector3(
        ballPos.x + (Math.random() - 0.5) * 5,
        0,
        ballPos.z + supportOffset
      );
      this.moveTowards(player, supportPos.subtract(playerPos), diff.speed);
    } else {
      // Revenir au centre du terrain
      const targetZ = player.config.initialZ * 0.7;
      const targetX = player.config.initialX * 0.8;
      const direction = new BABYLON.Vector3(targetX - playerPos.x, 0, targetZ - playerPos.z);
      this.moveTowards(player, direction, diff.speed * diff.positioning);
    }
  }

  /**
   * IA de l'attaquant
   */
  private updateForward(
    player: PlayerInstance,
    playerPos: BABYLON.Vector3,
    ballPos: BABYLON.Vector3,
    opponents: PlayerInstance[],
    diff: any
  ): void {
    const isHome = this.teamConfig.id === 'home';
    const opponentGoalZ = -this.ownGoalSign() * FOOTBALL_CONFIG.FIELD.LENGTH / 2;

    const distToBall = BABYLON.Vector3.Distance(playerPos, ballPos);

    if (distToBall < 12 && this.isBallInOpponentHalf(ballPos, isHome)) {
      // Courir vers le but adverse
      const runDirection = new BABYLON.Vector3(
        ballPos.x - playerPos.x + (Math.random() - 0.5) * 3,
        0,
        opponentGoalZ - playerPos.z
      );
      this.moveTowards(player, runDirection, diff.speed * 1.1);
    } else {
      // Se positionner pour une contre-attaque
      const targetZ = opponentGoalZ + this.ownGoalSign() * 15;
      const targetX = player.config.initialX * 0.6;
      const direction = new BABYLON.Vector3(targetX - playerPos.x, 0, targetZ - playerPos.z);
      this.moveTowards(player, direction, diff.speed * diff.positioning);
    }
  }

  /**
   * Déplace un joueur vers une direction
   */
  /**
   * Bug corrigé (course IA saccadée) : `update()` (donc les décisions de rôle et leurs
   * appels à `moveTowards`) n'est throttlé qu'à 200 ms (`UPDATE_INTERVAL`), mais
   * `moveTowards` FIXAIT directement la vélocité — le joueur gardait donc une vitesse
   * strictement constante pendant 200 ms puis SAUTAIT instantanément vers la nouvelle
   * direction à chaque décision, sans la moindre accélération/décélération. Corrigé en
   * séparant la DÉCISION (`moveTowards`, toujours throttlée à 200 ms — se contente
   * maintenant de mémoriser la direction/vitesse visée) de son APPLICATION
   * (`applySmoothMovement`, appelée à CHAQUE frame depuis football.component.ts, qui
   * lisse la vélocité vers cette cible avec le même facteur indépendant du framerate
   * que le joueur humain, cf. player.service.ts `movePlayer`).
   */
  private moveTargets = new WeakMap<PlayerInstance, { dir: BABYLON.Vector3; speedFactor: number } | null>();

  private moveTowards(player: PlayerInstance, direction: BABYLON.Vector3, speedFactor: number): void {
    if (direction.length() < 0.5) {
      this.stop(player);
      return;
    }
    direction.normalize();
    this.moveTargets.set(player, { dir: direction.clone(), speedFactor });
  }

  /**
   * Lisse la vélocité de tous les joueurs de cette équipe vers leur dernière cible
   * décidée par l'IA — à appeler une fois par frame (pas throttlé), indépendamment de
   * `update()`.
   */
  applySmoothMovement(players: PlayerInstance[], deltaTime: number): void {
    const accel = FOOTBALL_CONFIG.PLAYER.ACCELERATION;
    const factor = 1 - Math.exp(-accel * deltaTime);
    players.forEach(player => {
      if (player.isSentOff || player.isInjured) return;
      const target = this.moveTargets.get(player);
      const currentVel = player.body.linvel();
      const speed = target ? FOOTBALL_CONFIG.PLAYER.SPEED * target.speedFactor * this.weatherSpeedFactor : 0;
      const targetVelX = target ? target.dir.x * speed : 0;
      const targetVelZ = target ? target.dir.z * speed : 0;
      player.body.setLinvel(
        new RAPIER.Vector3(
          currentVel.x + (targetVelX - currentVel.x) * factor,
          currentVel.y,
          currentVel.z + (targetVelZ - currentVel.z) * factor
        ),
        true
      );
    });
  }

  /**
   * Arrête un joueur
   */
  private stop(player: PlayerInstance): void {
    // Pas de cible : applySmoothMovement() décélère vers zéro avec le même lissage.
    this.moveTargets.set(player, null);
  }

  /**
   * Vérifie si le ballon est dans notre moitié
   */
  private isBallInOurHalf(ballPos: BABYLON.Vector3, _isHome: boolean): boolean {
    return this.ownGoalSign() < 0 ? ballPos.z < 0 : ballPos.z > 0;
  }

  /**
   * Vérifie si le ballon est dans la moitié adverse
   */
  private isBallInOpponentHalf(ballPos: BABYLON.Vector3, _isHome: boolean): boolean {
    return this.ownGoalSign() < 0 ? ballPos.z > 0 : ballPos.z < 0;
  }

  /**
   * Décide si un joueur doit tirer
   */
  shouldShoot(player: PlayerInstance, ballPos: BABYLON.Vector3, goalPos: BABYLON.Vector3): boolean {
    const distToGoal = BABYLON.Vector3.Distance(ballPos, goalPos);
    const diff = FOOTBALL_CONFIG.DIFFICULTY[this.difficulty];

    // Bug corrigé (construction de jeu irréaliste) : ne considérait QUE la distance au
    // but, pas l'angle — un joueur sur la ligne de touche à 19 m mais complètement
    // excentré était traité comme une occasion aussi bonne qu'un tir axial en pleine
    // surface. Exige maintenant une position raisonnablement centrale (écart latéral
    // au but < la moitié de la distance) : trop excentré, mieux vaut centrer
    // (cf. findCrossTarget, utilisé en priorité par handleAIBallActions).
    const lateralOffset = Math.abs(ballPos.x - goalPos.x);
    const isReasonablyOnAxis = lateralOffset < Math.max(8, distToGoal * 0.5);

    if (distToGoal < 20 && isReasonablyOnAxis && Math.random() < diff.shotAccuracy) {
      return true;
    }

    return false;
  }

  /**
   * Décide si un joueur doit passer
   */
  shouldPass(player: PlayerInstance, teammates: PlayerInstance[], ballPos: BABYLON.Vector3): boolean {
    const diff = FOOTBALL_CONFIG.DIFFICULTY[this.difficulty];

    // Passer si un coéquipier est mieux placé
    const hasOpenTeammate = teammates.some(t => {
      if (t === player || t.isSentOff) return false;
      const tPos = new BABYLON.Vector3(t.body.translation().x, 0, t.body.translation().z);
      const dist = BABYLON.Vector3.Distance(ballPos, tPos);
      return dist > 5 && dist < 25;
    });

    return hasOpenTeammate && Math.random() < diff.passAccuracy;
  }

  /**
   * Passe courte : privilégie nettement la proximité sur la progression vers l'avant
   * (poids distance x1 au lieu de x0.1) et une portée courte (3-16 m) — pour construire
   * le jeu de proche en proche (passes courtes à l'équipier) plutôt que d'enchaîner sur
   * le coéquipier le plus avancé quelle que soit la distance (l'ancien comportement,
   * repris par `findDeepPassTarget` ci-dessous pour la passe en profondeur explicite).
   */
  findShortPassTarget(player: PlayerInstance, teammates: PlayerInstance[], ballPos: BABYLON.Vector3): PlayerInstance | null {
    let best: PlayerInstance | null = null;
    let bestScore = -Infinity;

    teammates.forEach(t => {
      if (t === player || t.isSentOff) return;
      const tPos = new BABYLON.Vector3(t.body.translation().x, 0, t.body.translation().z);
      const dist = BABYLON.Vector3.Distance(ballPos, tPos);
      const forwardScore = this.teamConfig.id === 'home' ? tPos.z : -tPos.z;
      const score = forwardScore * 0.3 - dist;

      if (score > bestScore && dist > 2 && dist < 16) {
        bestScore = score;
        best = t;
      }
    });

    return best;
  }

  /** Alias conservé pour compatibilité (IA : décisions existantes qui ne distinguent pas
   * encore court/profond) — équivalent à `findShortPassTarget`. */
  findBestPassTarget(player: PlayerInstance, teammates: PlayerInstance[], ballPos: BABYLON.Vector3): PlayerInstance | null {
    return this.findShortPassTarget(player, teammates, ballPos);
  }

  /**
   * Passe en profondeur (through ball) : favorise fortement la progression vers l'avant,
   * portée plus longue (15-45 m) — un vrai ballon "dans la course" d'un attaquant, pas
   * juste le coéquipier le plus proche.
   */
  findDeepPassTarget(player: PlayerInstance, teammates: PlayerInstance[], ballPos: BABYLON.Vector3): PlayerInstance | null {
    let best: PlayerInstance | null = null;
    let bestScore = -Infinity;

    teammates.forEach(t => {
      if (t === player || t.isSentOff) return;
      const tPos = new BABYLON.Vector3(t.body.translation().x, 0, t.body.translation().z);
      const dist = BABYLON.Vector3.Distance(ballPos, tPos);
      const forwardScore = this.teamConfig.id === 'home' ? tPos.z : -tPos.z;
      const score = forwardScore - dist * 0.15;

      if (score > bestScore && dist > 15 && dist < 45) {
        bestScore = score;
        best = t;
      }
    });

    return best;
  }

  /**
   * Centre (cross) : cible un équipier proche de la cage adverse (surface de réparation),
   * peu importe sa distance latérale au tireur — c'est justement le principe du centre
   * (frappé depuis le couloir vers la surface), contrairement à une passe qui cherche le
   * partenaire le plus proche.
   */
  findCrossTarget(player: PlayerInstance, teammates: PlayerInstance[]): PlayerInstance | null {
    const opponentGoalZ = -this.ownGoalSign() * FOOTBALL_CONFIG.FIELD.LENGTH / 2;
    let best: PlayerInstance | null = null;
    let bestDist = Infinity;

    teammates.forEach(t => {
      if (t === player || t.isSentOff || t.config.role === 'gk') return;
      const tPos = new BABYLON.Vector3(t.body.translation().x, 0, t.body.translation().z);
      const distToGoal = Math.abs(opponentGoalZ - tPos.z);
      if (distToGoal < bestDist) {
        bestDist = distToGoal;
        best = t;
      }
    });

    return best;
  }
}
