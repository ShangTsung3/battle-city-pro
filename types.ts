
export enum TileType {
  EMPTY = 0,
  BRICK = 1,
  STEEL = 2,
  BUSH = 3,
  WATER = 4,
  CRATE = 5,
  SPAWN_POINT = 6,
  BRICK_CRACKED_1 = 11,
  BRICK_CRACKED_2 = 12,
  BASE_PLAYER = 9,
  BASE_PLAYER_DEAD = 10,
  BASE_ENEMY = 13,
  BASE_ENEMY_DEAD = 14
}

export enum Direction {
  UP = 0,
  RIGHT = 1,
  DOWN = 2,
  LEFT = 3
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface Explosion {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface Item {
  x: number;
  y: number;
  type: 'star' | 'armor' | 'speed' | 'piercing';
  life: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  angle: number;
  dir: Direction;
  speed: number;
  type: 'player' | 'enemy' | 'bullet';
  health: number;
  maxHealth: number;
  recoil: number;
  bulletLevel: number;
  speedLevel: number;
  shieldTime: number;
  hitFlash?: number; // Frames to flash white on hit
  weaponTime?: number;
  owner?: 'player' | 'enemy';
  vx?: number;
  vy?: number;
  isElite?: boolean;
  piercingTime?: number; // Time remaining for piercing bullets (can destroy steel)
  isPiercing?: boolean; // For bullets - can this bullet destroy steel?
}

export type TournamentStage = 'ROUND_32' | 'ROUND_16' | 'QUARTERS' | 'SEMIS' | 'FINALS' | 'WINNER';

export interface TournamentMatch {
  id: string;
  player1: string;
  player2: string;
  winner?: string;
  isPlayerMatch: boolean;
}

export interface TournamentState {
  matches: TournamentMatch[];
  currentStage: TournamentStage;
  playerActive: boolean;
  waitingForOpponent: boolean;
}
