
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { CANVAS_SIZE, TILE_SIZE, COLORS, GRID_SIZE } from '../constants';
import { Direction, Entity, TileType, Particle, Explosion, Item } from '../types';
import { sounds } from '../services/SoundManager';
import { Socket } from 'socket.io-client';

interface NetworkPlayer {
  id: string;
  name: string;
  color: string;
}

interface GameCanvasProps {
  map: number[][];
  setMap: React.Dispatch<React.SetStateAction<number[][]>>;
  onGameOver: () => void;
  onVictory: () => void;
  onScoreUpdate: (s: number) => void;
  onLifeLost: () => void;
  onPlayerUpdate: (health: number) => void;
  isGameOver: boolean;
  selectedTankIndex?: number;
  tournamentStage?: string;
  playerName?: string;
  aiNames?: string[];
  // Multiplayer props
  multiplayerSocket?: Socket | null;
  multiplayerPlayers?: NetworkPlayer[];
  myPlayerId?: string | null;
  isMultiplayerGame?: boolean;
}

const TANK_PRESETS = [
  { name: "ST-1 BALANCED", color: "#cc8400", health: 5, speedMod: 0 },
  { name: "HV-7 HEAVY", color: "#b91c1c", health: 8, speedMod: -0.2 },
  { name: "LT-3 SCOUT", color: "#15803d", health: 3, speedMod: 0.3 },
  { name: "SN-5 SNIPER", color: "#1d4ed8", health: 4, speedMod: 0.1 },
  { name: "VT-X ELITE", color: "#7e22ce", health: 6, speedMod: 0.15 }
];

// AI Tank colors
const AI_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#78716c', '#a1a1aa', '#fbbf24',
  '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c', '#4ade80',
  '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#e879f9', '#fb7185', '#fcd34d'
];

interface BattleRoyalePlayer extends Entity {
  name: string;
  lives: number;
  isEliminated: boolean;
  isHuman: boolean;
  color: string;
  lastFireTime: number;
  aiMoveTimer: number;
  targetAngle: number;
}

// Spawn positions around the 21x21 map - 16 spread out positions
const SPAWN_POSITIONS = [
  // Corners
  {r: 0, c: 0}, {r: 0, c: 10}, {r: 0, c: 20},
  {r: 5, c: 0}, {r: 5, c: 20},
  {r: 10, c: 0}, {r: 10, c: 20},
  {r: 15, c: 0}, {r: 15, c: 20},
  {r: 20, c: 0}, {r: 20, c: 10}, {r: 20, c: 20},
  // Inner positions
  {r: 5, c: 5}, {r: 5, c: 15},
  {r: 15, c: 5}, {r: 15, c: 15}
];

export const GameCanvas: React.FC<GameCanvasProps> = ({
  map, setMap, onGameOver, onVictory, onScoreUpdate, onLifeLost, onPlayerUpdate, isGameOver,
  selectedTankIndex = 0, tournamentStage = 'BATTLE_ROYALE', playerName = 'PLAYER', aiNames = [],
  multiplayerSocket = null, multiplayerPlayers = [], myPlayerId = null, isMultiplayerGame = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tankPreset = TANK_PRESETS[selectedTankIndex] || TANK_PRESETS[0];
  const HALF_TILE = TILE_SIZE / 2;

  const stateRef = useRef<{
    players: BattleRoyalePlayer[];
    bullets: Entity[];
    items: Item[];
    particles: Particle[];
    explosions: Explosion[];
    keys: Set<string>;
    shake: number;
    frame: number;
    gameEnded: boolean;
    alivePlayers: number;
    // Shrinking zone
    zone: {
      centerX: number;
      centerY: number;
      targetCenterX: number;
      targetCenterY: number;
      radius: number;
      targetRadius: number;
      shrinkTimer: number;
      damageTimer: number;
    };
    // Kill feed
    killFeed: { killer: string; victim: string; time: number }[];
    // Player scores
    scores: Map<string, number>;
    // Airstrikes
    airstrikes: { x: number; y: number; timer: number; maxTimer: number; radius: number }[];
    // Supply drops
    supplyDrops: { x: number; y: number; timer: number; falling: boolean }[];
    // Timers for spawning
    nextAirstrikeTimer: number;
    nextSupplyDropTimer: number;
    // Bounty system
    bountyPlayerId: string | null;
    // Revenge system - maps victimId -> killerId
    revengeTargets: Map<string, string>;
    // Announcements (big text on screen)
    announcements: { text: string; color: string; time: number }[];
  } | null>(null);

  // Initialize game state
  if (!stateRef.current) {
    const players: BattleRoyalePlayer[] = [];

    if (isMultiplayerGame && multiplayerPlayers.length > 0) {
      // Multiplayer mode - create players from network
      multiplayerPlayers.forEach((netPlayer, index) => {
        const spawn = SPAWN_POSITIONS[index % SPAWN_POSITIONS.length];
        const isMe = netPlayer.id === myPlayerId;
        players.push({
          id: netPlayer.id,
          name: netPlayer.name,
          x: spawn.c * TILE_SIZE,
          y: spawn.r * TILE_SIZE,
          angle: Math.PI / 2,
          dir: Direction.DOWN,
          speed: 0,
          type: isMe ? 'player' : 'enemy',
          health: tankPreset.health,
          maxHealth: tankPreset.health,
          recoil: 0,
          bulletLevel: 1,
          speedLevel: 1,
          shieldTime: 240,
          lives: 3,
          isEliminated: false,
          isHuman: isMe,
          color: isMe ? tankPreset.color : netPlayer.color,
          lastFireTime: 0,
          aiMoveTimer: 0,
          targetAngle: Math.PI / 2,
          piercingTime: 0
        });
      });

      // Fill remaining slots with AI if less than 16 players
      const aiCount = Math.max(0, 16 - multiplayerPlayers.length);
      for (let i = 0; i < aiCount; i++) {
        const spawn = SPAWN_POSITIONS[(multiplayerPlayers.length + i) % SPAWN_POSITIONS.length];
        const aiPreset = TANK_PRESETS[Math.floor(Math.random() * TANK_PRESETS.length)];
        players.push({
          id: `ai_${i}`,
          name: aiNames[i] || `AI_${i + 1}`,
          x: spawn.c * TILE_SIZE + (Math.random() - 0.5) * TILE_SIZE * 0.5,
          y: spawn.r * TILE_SIZE + (Math.random() - 0.5) * TILE_SIZE * 0.5,
          angle: Math.random() * Math.PI * 2,
          dir: Direction.DOWN,
          speed: 0,
          type: 'enemy',
          health: aiPreset.health,
          maxHealth: aiPreset.health,
          recoil: 0,
          bulletLevel: 1,
          speedLevel: 1,
          shieldTime: 240,
          lives: 3,
          isEliminated: false,
          isHuman: false,
          color: AI_COLORS[i % AI_COLORS.length],
          lastFireTime: 0,
          aiMoveTimer: Math.random() * 60,
          targetAngle: Math.random() * Math.PI * 2,
          piercingTime: 0
        });
      }
    } else {
      // Solo mode - create human player
      const humanSpawn = SPAWN_POSITIONS[0];
      players.push({
        id: 'player',
        name: playerName,
        x: humanSpawn.c * TILE_SIZE,
        y: humanSpawn.r * TILE_SIZE,
        angle: Math.PI / 2,
        dir: Direction.DOWN,
        speed: 0,
        type: 'player',
        health: tankPreset.health,
        maxHealth: tankPreset.health,
        recoil: 0,
        bulletLevel: 1,
        speedLevel: 1,
        shieldTime: 180,
        lives: 3,
        isEliminated: false,
        isHuman: true,
        color: tankPreset.color,
        lastFireTime: 0,
        aiMoveTimer: 0,
        targetAngle: Math.PI / 2,
        piercingTime: 0
      });

      // Create 15 AI players
      for (let i = 1; i < 16; i++) {
        const spawn = SPAWN_POSITIONS[i % SPAWN_POSITIONS.length];
        const aiPreset = TANK_PRESETS[Math.floor(Math.random() * TANK_PRESETS.length)];
        players.push({
          id: `ai_${i}`,
          name: aiNames[i - 1] || `AI_${i}`,
          x: spawn.c * TILE_SIZE + (Math.random() - 0.5) * TILE_SIZE * 0.5,
          y: spawn.r * TILE_SIZE + (Math.random() - 0.5) * TILE_SIZE * 0.5,
          angle: Math.random() * Math.PI * 2,
          dir: Direction.DOWN,
          speed: 0,
          type: 'enemy',
          health: aiPreset.health,
          maxHealth: aiPreset.health,
          recoil: 0,
          bulletLevel: 1,
          speedLevel: 1,
          shieldTime: 240,
          lives: 3,
          isEliminated: false,
          isHuman: false,
          color: AI_COLORS[i % AI_COLORS.length],
          lastFireTime: 0,
          aiMoveTimer: Math.random() * 60,
          targetAngle: Math.random() * Math.PI * 2,
          piercingTime: 0
        });
      }
    }

    stateRef.current = {
      players,
      bullets: [],
      items: [],
      particles: [],
      explosions: [],
      keys: new Set(),
      shake: 0,
      frame: 0,
      gameEnded: false,
      alivePlayers: players.length,
      // Shrinking zone - starts covering full map, shrinks over time
      zone: {
        centerX: CANVAS_SIZE / 2,
        centerY: CANVAS_SIZE / 2,
        targetCenterX: CANVAS_SIZE / 2,
        targetCenterY: CANVAS_SIZE / 2,
        radius: CANVAS_SIZE * 0.9,
        targetRadius: CANVAS_SIZE * 0.65, // First target - zone starts shrinking immediately but slowly
        shrinkTimer: 3000, // 50 seconds pause after reaching first target
        damageTimer: 0
      },
      killFeed: [],
      scores: new Map(),
      airstrikes: [],
      supplyDrops: [],
      nextAirstrikeTimer: 600 + Math.random() * 300, // First airstrike after 10-15 seconds
      nextSupplyDropTimer: 360 + Math.random() * 240, // First supply drop after 6-10 seconds
      bountyPlayerId: null,
      revengeTargets: new Map(),
      announcements: []
    };
  }

  useEffect(() => {
    sounds.init();
    sounds.playStartMelody();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current) stateRef.current.keys.add(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (stateRef.current) stateRef.current.keys.delete(e.code);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      sounds.setEngine(false);
    };
  }, []);

  // Multiplayer socket handlers
  useEffect(() => {
    if (!isMultiplayerGame || !multiplayerSocket) return;

    const socket = multiplayerSocket;

    // Handle other player movement
    socket.on('playerMoved', (data: { id: string; x: number; y: number; angle: number; health: number; lives: number; isEliminated: boolean }) => {
      const state = stateRef.current;
      if (!state) return;
      const player = state.players.find(p => p.id === data.id);
      if (player && !player.isHuman) {
        player.x = data.x;
        player.y = data.y;
        player.angle = data.angle;
        player.health = data.health;
        player.lives = data.lives;
        player.isEliminated = data.isEliminated;
      }
    });

    // Handle bullets from other players
    socket.on('bulletFired', (data: { id: string; x: number; y: number; angle: number; speed: number; ownerId: string; isPiercing: boolean }) => {
      const state = stateRef.current;
      if (!state) return;
      state.bullets.push({
        id: data.id,
        x: data.x,
        y: data.y,
        angle: data.angle,
        dir: Direction.DOWN,
        speed: data.speed,
        type: 'bullet',
        health: 1,
        maxHealth: 1,
        recoil: 0,
        owner: data.ownerId as any,
        bulletLevel: 1,
        speedLevel: 1,
        shieldTime: 0,
        isPiercing: data.isPiercing
      });
    });

    // Handle tile destruction
    socket.on('tileDestroyed', (data: { r: number; c: number; tile: number }) => {
      setMap(prev => {
        const nm = prev.map(row => [...row]);
        nm[data.r][data.c] = data.tile;
        return nm;
      });
    });

    // Handle player death
    socket.on('playerDeath', (data: { playerId: string; lives: number; isEliminated: boolean }) => {
      const state = stateRef.current;
      if (!state) return;
      const player = state.players.find(p => p.id === data.playerId);
      if (player) {
        player.lives = data.lives;
        player.isEliminated = data.isEliminated;
      }
    });

    return () => {
      socket.off('playerMoved');
      socket.off('bulletFired');
      socket.off('tileDestroyed');
      socket.off('playerDeath');
    };
  }, [isMultiplayerGame, multiplayerSocket, setMap]);

  // Send my position to server periodically
  const lastPositionUpdate = useRef(0);
  const sendPositionUpdate = useCallback(() => {
    if (!isMultiplayerGame || !multiplayerSocket) return;
    const state = stateRef.current;
    if (!state) return;
    const me = state.players.find(p => p.isHuman);
    if (!me) return;

    const now = Date.now();
    if (now - lastPositionUpdate.current < 50) return; // 20 updates per second max
    lastPositionUpdate.current = now;

    multiplayerSocket.emit('updatePosition', {
      x: me.x,
      y: me.y,
      angle: me.angle,
      health: me.health,
      lives: me.lives,
      isEliminated: me.isEliminated,
      shieldTime: me.shieldTime,
      bulletLevel: me.bulletLevel,
      piercingTime: me.piercingTime
    });
  }, [isMultiplayerGame, multiplayerSocket]);

  const createExplosion = (x: number, y: number, big = false) => {
    const state = stateRef.current;
    if (!state) return;
    state.explosions.push({ x, y, radius: big ? 50 : 20, life: 0, maxLife: 20 });
    state.shake = Math.max(state.shake, big ? 15 : 4);
    sounds.playExplosion(big);
    for (let i = 0; i < (big ? 25 : 10); i++) {
      state.particles.push({
        x, y, vx: (Math.random() - 0.5) * (big ? 8 : 5), vy: (Math.random() - 0.5) * (big ? 8 : 5),
        life: 0, maxLife: big ? 35 : 25, color: big ? (Math.random() > 0.5 ? '#ff4500' : '#ffff00') : '#ffa500',
        size: Math.random() * (big ? 4 : 3) + 1
      });
    }
  };

  const spawnItem = (x: number, y: number) => {
    const types: ('star' | 'armor' | 'speed' | 'piercing')[] = ['star', 'armor', 'speed', 'piercing'];
    const type = types[Math.floor(Math.random() * types.length)];
    stateRef.current?.items.push({ x, y, type, life: 900 });
  };

  const checkCollision = (x: number, y: number, size: number) => {
    const margin = Math.floor(TILE_SIZE * 0.1);
    const gridX1 = Math.floor((x + margin) / TILE_SIZE), gridY1 = Math.floor((y + margin) / TILE_SIZE);
    const gridX2 = Math.floor((x + size - margin) / TILE_SIZE), gridY2 = Math.floor((y + size - margin) / TILE_SIZE);

    for (let r = gridY1; r <= gridY2; r++) {
      for (let c = gridX1; c <= gridX2; c++) {
        if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return true;
        const tile = map[r]?.[c];
        const passable = [TileType.EMPTY, TileType.BUSH, TileType.SPAWN_POINT, TileType.WATER];
        if (tile !== undefined && !passable.includes(tile)) return { r, c, tile };
      }
    }
    return false;
  };

  const findRespawnPosition = (): {x: number, y: number} => {
    const state = stateRef.current;
    if (!state) return { x: TILE_SIZE, y: TILE_SIZE };

    // Find a spawn position far from other players
    let bestSpawn = SPAWN_POSITIONS[Math.floor(Math.random() * SPAWN_POSITIONS.length)];
    let maxDist = 0;

    for (const spawn of SPAWN_POSITIONS) {
      let minDistToPlayer = Infinity;
      for (const p of state.players) {
        if (!p.isEliminated) {
          const dist = Math.hypot(spawn.c * TILE_SIZE - p.x, spawn.r * TILE_SIZE - p.y);
          minDistToPlayer = Math.min(minDistToPlayer, dist);
        }
      }
      if (minDistToPlayer > maxDist) {
        maxDist = minDistToPlayer;
        bestSpawn = spawn;
      }
    }

    return { x: bestSpawn.c * TILE_SIZE, y: bestSpawn.r * TILE_SIZE };
  };

  const fire = (player: BattleRoyalePlayer) => {
    const state = stateRef.current;
    if (!state) return;
    const now = Date.now();
    const cooldown = 400 - (player.bulletLevel - 1) * 80;
    if (now - player.lastFireTime < cooldown) return;
    player.lastFireTime = now;

    if (player.isHuman) sounds.playFire();

    const bSpeed = 2 + player.bulletLevel * 0.5;
    const hasPiercing = (player.piercingTime || 0) > 0;
    const bulletId = Math.random().toString();
    const bulletX = player.x + HALF_TILE + Math.cos(player.angle) * TILE_SIZE * 0.4;
    const bulletY = player.y + HALF_TILE + Math.sin(player.angle) * TILE_SIZE * 0.4;

    state.bullets.push({
      id: bulletId,
      x: bulletX,
      y: bulletY,
      angle: player.angle,
      dir: player.dir,
      speed: bSpeed,
      type: 'bullet',
      health: 1,
      maxHealth: 1,
      recoil: 0,
      owner: player.id as any,
      bulletLevel: player.bulletLevel,
      speedLevel: 1,
      shieldTime: 0,
      isPiercing: hasPiercing
    });

    // Broadcast bullet in multiplayer
    if (isMultiplayerGame && multiplayerSocket && player.isHuman) {
      multiplayerSocket.emit('bulletFired', {
        id: bulletId,
        x: bulletX,
        y: bulletY,
        angle: player.angle,
        speed: bSpeed,
        isPiercing: hasPiercing
      });
    }
  };

  const update = useCallback(() => {
    const state = stateRef.current;
    if (!state || isGameOver || state.gameEnded) return;
    state.frame++;

    const humanPlayer = state.players.find(p => p.isHuman);
    if (!humanPlayer) return;

    // Check win/lose conditions
    const alivePlayers = state.players.filter(p => !p.isEliminated);
    state.alivePlayers = alivePlayers.length;

    if (humanPlayer.isEliminated) {
      state.gameEnded = true;
      sounds.playGameOver();
      setTimeout(onGameOver, 1500);
      return;
    }

    if (alivePlayers.length === 1 && alivePlayers[0].isHuman) {
      state.gameEnded = true;
      sounds.playVictory();
      setTimeout(onVictory, 1500);
      return;
    }

    // Human player movement (slower speed)
    let dx = 0, dy = 0;
    const baseSpeed = 0.4 * (humanPlayer.speedLevel > 1 ? 1.3 : 1);

    if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) { dy = -baseSpeed; humanPlayer.angle = -Math.PI / 2; }
    else if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) { dy = baseSpeed; humanPlayer.angle = Math.PI / 2; }
    else if (state.keys.has('KeyA') || state.keys.has('ArrowLeft')) { dx = -baseSpeed; humanPlayer.angle = Math.PI; }
    else if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) { dx = baseSpeed; humanPlayer.angle = 0; }

    const collisionSize = TILE_SIZE * 0.85;
    if (dx !== 0 && !checkCollision(humanPlayer.x + dx, humanPlayer.y, collisionSize)) humanPlayer.x += dx;
    if (dy !== 0 && !checkCollision(humanPlayer.x, humanPlayer.y + dy, collisionSize)) humanPlayer.y += dy;

    // Keep player in bounds
    humanPlayer.x = Math.max(0, Math.min(CANVAS_SIZE - TILE_SIZE, humanPlayer.x));
    humanPlayer.y = Math.max(0, Math.min(CANVAS_SIZE - TILE_SIZE, humanPlayer.y));

    if (state.keys.has('Space')) fire(humanPlayer);

    // Send position to multiplayer server
    sendPositionUpdate();

    // Update timers
    if (humanPlayer.shieldTime > 0) humanPlayer.shieldTime--;
    if (humanPlayer.piercingTime && humanPlayer.piercingTime > 0) humanPlayer.piercingTime--;

    // Zone shrinking logic - slow shrink, pause, repeat
    const zoneReachedTarget = state.zone.radius <= state.zone.targetRadius + 1;

    if (zoneReachedTarget) {
      // Zone reached target - wait before next shrink
      state.zone.shrinkTimer--;
      if (state.zone.shrinkTimer <= 0) {
        // Set new target
        state.zone.targetRadius = Math.max(TILE_SIZE * 4, state.zone.targetRadius * 0.75);
        state.zone.shrinkTimer = 2400; // 40 seconds pause before next shrink

        // Pick new random center within current zone
        const maxOffset = state.zone.targetRadius * 0.35;
        const angle = Math.random() * Math.PI * 2;
        const offset = Math.random() * maxOffset;
        let newCenterX = state.zone.centerX + Math.cos(angle) * offset;
        let newCenterY = state.zone.centerY + Math.sin(angle) * offset;

        // Keep new center so zone stays within map bounds
        const margin = state.zone.targetRadius;
        newCenterX = Math.max(margin, Math.min(CANVAS_SIZE - margin, newCenterX));
        newCenterY = Math.max(margin, Math.min(CANVAS_SIZE - margin, newCenterY));

        state.zone.targetCenterX = newCenterX;
        state.zone.targetCenterY = newCenterY;
      }
    } else {
      // Zone is shrinking - move very slowly
      state.zone.radius -= 0.15; // Very slow shrink

      // Smoothly move center toward target
      const centerSpeed = 0.3;
      if (Math.abs(state.zone.centerX - state.zone.targetCenterX) > centerSpeed) {
        state.zone.centerX += Math.sign(state.zone.targetCenterX - state.zone.centerX) * centerSpeed;
      }
      if (Math.abs(state.zone.centerY - state.zone.targetCenterY) > centerSpeed) {
        state.zone.centerY += Math.sign(state.zone.targetCenterY - state.zone.centerY) * centerSpeed;
      }
    }

    // Zone damage - hurt players outside zone
    state.zone.damageTimer++;
    if (state.zone.damageTimer >= 30) { // Damage every 0.5 seconds
      state.zone.damageTimer = 0;
      state.players.forEach(player => {
        if (player.isEliminated) return;
        const distFromCenter = Math.hypot(
          player.x + HALF_TILE - state.zone.centerX,
          player.y + HALF_TILE - state.zone.centerY
        );
        if (distFromCenter > state.zone.radius) {
          player.health -= 1;
          player.hitFlash = 8;
          if (player.health <= 0) {
            // Killed by zone
            state.killFeed.unshift({ killer: 'ZONE', victim: player.name, time: state.frame });
            if (state.killFeed.length > 5) state.killFeed.pop();
            createExplosion(player.x + HALF_TILE, player.y + HALF_TILE, true);
            player.lives--;
            if (player.lives <= 0) {
              player.isEliminated = true;
              if (player.isHuman) onLifeLost();
            } else {
              // Respawn inside zone
              const angle = Math.random() * Math.PI * 2;
              const dist = Math.random() * state.zone.radius * 0.5;
              player.x = state.zone.centerX + Math.cos(angle) * dist - HALF_TILE;
              player.y = state.zone.centerY + Math.sin(angle) * dist - HALF_TILE;
              player.health = player.maxHealth;
              player.shieldTime = 240;
            }
          }
        }
      });
    }

    // Clean old kill feed entries (after 5 seconds)
    state.killFeed = state.killFeed.filter(k => state.frame - k.time < 300);
    // Clean old announcements (after 3 seconds)
    state.announcements = state.announcements.filter(a => state.frame - a.time < 180);

    // Airstrike spawning
    state.nextAirstrikeTimer--;
    if (state.nextAirstrikeTimer <= 0) {
      // Spawn new airstrike within the safe zone
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * state.zone.radius * 0.7;
      const x = state.zone.centerX + Math.cos(angle) * dist;
      const y = state.zone.centerY + Math.sin(angle) * dist;
      state.airstrikes.push({
        x, y,
        timer: 480, // 8 seconds warning
        maxTimer: 480,
        radius: TILE_SIZE * 3.5
      });
      state.nextAirstrikeTimer = 600 + Math.random() * 600; // Next in 10-20 seconds
      sounds.playPowerup(); // Warning sound
    }

    // Update airstrikes
    state.airstrikes = state.airstrikes.filter(strike => {
      strike.timer--;
      if (strike.timer <= 0) {
        // BOOM! Damage all players in radius
        state.players.forEach(player => {
          if (player.isEliminated) return;
          const dist = Math.hypot(player.x + HALF_TILE - strike.x, player.y + HALF_TILE - strike.y);
          if (dist < strike.radius) {
            if (player.shieldTime <= 0) {
              const damage = dist < strike.radius * 0.5 ? 3 : 2;
              player.health -= damage;
              player.hitFlash = 12;
              if (player.health <= 0) {
                state.killFeed.unshift({ killer: 'AIRSTRIKE', victim: player.name, time: state.frame });
                if (state.killFeed.length > 5) state.killFeed.pop();
                createExplosion(player.x + HALF_TILE, player.y + HALF_TILE, true);
                player.lives--;
                if (player.lives <= 0) {
                  player.isEliminated = true;
                  if (player.isHuman) onLifeLost();
                } else {
                  const respawn = findRespawnPosition();
                  player.x = respawn.x;
                  player.y = respawn.y;
                  player.health = player.maxHealth;
                  player.shieldTime = 240;
                }
              }
            }
          }
        });
        // Big explosion effect
        createExplosion(strike.x, strike.y, true);
        state.shake = 15;
        sounds.playExplosion();
        return false;
      }
      return true;
    });

    // Supply drop spawning
    state.nextSupplyDropTimer--;
    if (state.nextSupplyDropTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * state.zone.radius * 0.6;
      const x = state.zone.centerX + Math.cos(angle) * dist;
      const y = state.zone.centerY + Math.sin(angle) * dist;
      state.supplyDrops.push({ x, y, timer: 120, falling: true }); // 2 second fall
      state.nextSupplyDropTimer = 480 + Math.random() * 300; // Next in 8-13 seconds
    }

    // Update supply drops
    state.supplyDrops = state.supplyDrops.filter(drop => {
      if (drop.falling) {
        drop.timer--;
        if (drop.timer <= 0) {
          drop.falling = false;
          // Spawn random power-up at this location
          const types: ('star' | 'armor' | 'speed' | 'piercing')[] = ['star', 'armor', 'speed', 'piercing'];
          const randomType = types[Math.floor(Math.random() * types.length)];
          state.items.push({ x: drop.x - HALF_TILE, y: drop.y - HALF_TILE, type: randomType, life: 1800 });
          sounds.playPowerup();
          return false;
        }
      }
      return true;
    });

    // Item pickup
    state.items = state.items.filter(item => {
      const dist = Math.hypot(humanPlayer.x + HALF_TILE - (item.x + HALF_TILE), humanPlayer.y + HALF_TILE - (item.y + HALF_TILE));
      if (dist < TILE_SIZE * 0.6) {
        sounds.playPowerup();
        if (item.type === 'star') humanPlayer.bulletLevel = Math.min(4, humanPlayer.bulletLevel + 1);
        if (item.type === 'armor') humanPlayer.shieldTime = 600;
        if (item.type === 'speed') humanPlayer.speedLevel = 2;
        if (item.type === 'piercing') humanPlayer.piercingTime = 900;
        onScoreUpdate(100);
        return false;
      }
      item.life--;
      return item.life > 0;
    });

    // AI player behavior
    state.players.forEach(player => {
      if (player.isHuman || player.isEliminated) return;

      if (player.shieldTime > 0) player.shieldTime--;
      if (player.piercingTime && player.piercingTime > 0) player.piercingTime--;

      // Find nearest enemy for this AI (ignore shielded players)
      let nearestEnemy: BattleRoyalePlayer | null = null;
      let nearestDist = Infinity;
      state.players.forEach(other => {
        if (other.id === player.id || other.isEliminated) return;
        if (other.shieldTime > 0) return; // Don't target shielded players
        const d = Math.hypot(other.x - player.x, other.y - player.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = other;
        }
      });

      const detectRange = TILE_SIZE * 5; // Detection range
      const hasTarget = nearestEnemy && nearestDist < detectRange;

      // AI movement
      player.aiMoveTimer--;
      if (hasTarget && nearestEnemy) {
        // Hunt mode - move toward nearest enemy
        const targetAngle = Math.atan2(
          nearestEnemy.y - player.y,
          nearestEnemy.x - player.x
        );
        player.targetAngle = targetAngle;
        player.aiMoveTimer = 10 + Math.random() * 20; // Re-evaluate often
      } else if (player.aiMoveTimer <= 0) {
        // Patrol mode - wander randomly
        player.targetAngle = Math.random() * Math.PI * 2;
        player.aiMoveTimer = 60 + Math.random() * 120;
      }

      // Smoothly turn towards target angle
      let angleDiff = player.targetAngle - player.angle;
      // Normalize angle difference to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      player.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.03);

      const aiSpeed = hasTarget ? 0.18 : 0.1; // Slower AI
      const adx = Math.cos(player.angle) * aiSpeed;
      const ady = Math.sin(player.angle) * aiSpeed;

      if (!checkCollision(player.x + adx, player.y + ady, collisionSize)) {
        player.x += adx;
        player.y += ady;
      } else {
        // Try to go around obstacle
        player.targetAngle += Math.PI / 2 + Math.random() * Math.PI;
        player.aiMoveTimer = 15;
      }

      // Keep AI in bounds
      player.x = Math.max(0, Math.min(CANVAS_SIZE - TILE_SIZE, player.x));
      player.y = Math.max(0, Math.min(CANVAS_SIZE - TILE_SIZE, player.y));

      // AI firing - shoot at enemies when facing them
      const angleSettled = Math.abs(angleDiff) < 0.2;
      if (hasTarget && angleSettled) {
        // Aggressive firing when target in sight
        if (Math.random() < 0.02) fire(player);
      } else if (angleSettled && Math.random() < 0.005) {
        // Occasional random shot while patrolling
        fire(player);
      }

      // AI item pickup
      state.items = state.items.filter(item => {
        const dist = Math.hypot(player.x + HALF_TILE - (item.x + HALF_TILE), player.y + HALF_TILE - (item.y + HALF_TILE));
        if (dist < TILE_SIZE * 0.6) {
          if (item.type === 'star') player.bulletLevel = Math.min(4, player.bulletLevel + 1);
          if (item.type === 'armor') player.shieldTime = 600;
          if (item.type === 'speed') player.speedLevel = 2;
          if (item.type === 'piercing') player.piercingTime = 900;
          return false;
        }
        return true;
      });

      // AI avoids zone edge - move toward zone center if close to edge
      const distToZoneCenter = Math.hypot(
        player.x + HALF_TILE - state.zone.centerX,
        player.y + HALF_TILE - state.zone.centerY
      );
      if (distToZoneCenter > state.zone.radius * 0.8) {
        player.targetAngle = Math.atan2(
          state.zone.centerY - player.y,
          state.zone.centerX - player.x
        );
        player.aiMoveTimer = 30;
      }
    });

    // Bullet updates
    state.bullets = state.bullets.filter(b => {
      b.x += Math.cos(b.angle) * b.speed;
      b.y += Math.sin(b.angle) * b.speed;

      // Out of bounds
      if (b.x < 0 || b.x > CANVAS_SIZE || b.y < 0 || b.y > CANVAS_SIZE) return false;

      // Tile collision
      const hit = checkCollision(b.x - 2, b.y - 2, 4);
      if (hit === true) return false;
      if (hit && typeof hit === 'object') {
        const { r, c, tile } = hit;
        if (tile === TileType.WATER || tile === TileType.BUSH) return true;
        if (tile === TileType.BRICK || tile === TileType.BRICK_CRACKED_1 || tile === TileType.CRATE) {
          setMap(prev => {
            const nm = prev.map(row => [...row]);
            if (tile === TileType.BRICK) nm[r][c] = TileType.BRICK_CRACKED_1;
            else nm[r][c] = TileType.EMPTY;
            return nm;
          });
          if (tile === TileType.CRATE) spawnItem(c * TILE_SIZE, r * TILE_SIZE);
          createExplosion(b.x, b.y);
          return false;
        }
        if (tile === TileType.STEEL) {
          if (b.isPiercing) {
            setMap(prev => { const nm = prev.map(row => [...row]); nm[r][c] = TileType.EMPTY; return nm; });
            createExplosion(b.x, b.y, true);
          } else {
            sounds.playSteelHit();
            createExplosion(b.x, b.y);
          }
          return false;
        }
      }

      // Player collision
      const hitRadius = TILE_SIZE * 0.4;
      for (const player of state.players) {
        if (player.isEliminated || b.owner === player.id) continue;

        if (Math.abs(player.x + HALF_TILE - b.x) < hitRadius && Math.abs(player.y + HALF_TILE - b.y) < hitRadius) {
          if (player.shieldTime > 0) {
            sounds.playSteelHit();
            createExplosion(b.x, b.y);
            return false;
          }

          player.health--;
          player.hitFlash = 8;

          if (player.health <= 0) {
            createExplosion(player.x + HALF_TILE, player.y + HALF_TILE, true);
            player.lives--;

            // Add to kill feed
            const shooter = state.players.find(p => p.id === b.owner);
            if (shooter) {
              state.killFeed.unshift({ killer: shooter.name, victim: player.name, time: state.frame });
              if (state.killFeed.length > 5) state.killFeed.pop();
              // Update score
              const currentScore = state.scores.get(shooter.id) || 0;
              state.scores.set(shooter.id, currentScore + 1);
              const newKills = currentScore + 1;

              // Bounty system - player with most kills gets bounty
              let maxKills = 0;
              let maxKillerId: string | null = null;
              state.scores.forEach((kills, id) => {
                if (kills > maxKills) { maxKills = kills; maxKillerId = id; }
              });
              if (maxKills >= 3 && maxKillerId) {
                state.bountyPlayerId = maxKillerId;
              }

              // Bounty bonus - killed the bounty target
              if (player.id === state.bountyPlayerId && shooter.id !== player.id) {
                const bountyBonus = 3;
                state.scores.set(shooter.id, newKills + bountyBonus - 1);
                if (shooter.isHuman) onScoreUpdate(1500);
                state.announcements.push({ text: `BOUNTY CLAIMED!`, color: '#ffd700', time: state.frame });
                state.bountyPlayerId = null; // Reset bounty
              }

              // Revenge system - mark killer as revenge target for victim
              state.revengeTargets.set(player.id, shooter.id);

              // Check if this kill was revenge
              const victimRevengeTarget = state.revengeTargets.get(shooter.id);
              if (victimRevengeTarget === player.id) {
                if (shooter.isHuman) onScoreUpdate(500);
                state.announcements.push({ text: `REVENGE!`, color: '#ff4444', time: state.frame });
                state.revengeTargets.delete(shooter.id);
              }

              // Award regular score
              if (shooter.isHuman) {
                onScoreUpdate(200);
              }
            }

            if (player.lives <= 0) {
              player.isEliminated = true;
              if (player.isHuman) {
                onLifeLost();
              } else {
                if (!shooter) onScoreUpdate(500);
              }
            } else {
              // Respawn
              const respawn = findRespawnPosition();
              player.x = respawn.x;
              player.y = respawn.y;
              player.health = player.maxHealth;
              player.shieldTime = 240;
              player.bulletLevel = 1;
              player.speedLevel = 1;
              player.piercingTime = 0;
              if (player.isHuman) onLifeLost();
            }
          } else {
            createExplosion(b.x, b.y, false);
          }

          return false;
        }
      }

      return true;
    });

    // Update player health display
    if (state.frame % 15 === 0) onPlayerUpdate(humanPlayer.health);

    // Update particles
    state.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life++; });
    state.particles = state.particles.filter(p => p.life < p.maxLife);
    state.explosions.forEach(e => e.life++);
    state.explosions = state.explosions.filter(e => e.life < e.maxLife);
    if (state.shake > 0) state.shake *= 0.9;
  }, [map, isGameOver, onGameOver, onVictory, onScoreUpdate, onLifeLost, onPlayerUpdate, sendPositionUpdate, isMultiplayerGame, multiplayerSocket]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = stateRef.current;
    if (!state) return;

    ctx.save();
    if (state.shake > 0.5) ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);

    // Background
    ctx.fillStyle = COLORS.BACKGROUND;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw tiles
    map.forEach((row, r) => row.forEach((tile, c) => {
      const x = c * TILE_SIZE, y = r * TILE_SIZE;
      if (tile === TileType.BRICK || tile === TileType.BRICK_CRACKED_1) {
        ctx.fillStyle = COLORS.BRICK;
        ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        ctx.strokeStyle = COLORS.BRICK_DARK;
        ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      } else if (tile === TileType.STEEL) {
        ctx.fillStyle = COLORS.STEEL;
        ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        ctx.fillStyle = COLORS.STEEL_LIGHT;
        ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
      } else if (tile === TileType.WATER) {
        ctx.fillStyle = COLORS.WATER;
        const pulse = Math.sin(state.frame * 0.05 + (r + c) * 0.5) * 2;
        ctx.fillRect(x, y + pulse / 2, TILE_SIZE, TILE_SIZE);
      } else if (tile === TileType.CRATE) {
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.fillStyle = '#3e2723';
        ctx.font = `bold ${Math.floor(TILE_SIZE * 0.4)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('?', x + HALF_TILE, y + HALF_TILE + 4);
      }
    }));

    // Draw items
    state.items.forEach(item => {
      ctx.save();
      const pulse = Math.sin(state.frame * 0.15) * 3;
      ctx.translate(item.x + HALF_TILE, item.y + HALF_TILE + pulse);
      const color = item.type === 'star' ? COLORS.STAR_1 : item.type === 'armor' ? COLORS.SHIELD : item.type === 'piercing' ? '#ff0066' : COLORS.SPEED;
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc(0, 0, TILE_SIZE * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 0;
      ctx.font = `bold ${Math.floor(TILE_SIZE * 0.3)}px Arial`;
      ctx.textAlign = 'center';
      const icon = item.type === 'star' ? '★' : item.type === 'armor' ? '🛡' : item.type === 'piercing' ? '💥' : '⚡';
      ctx.fillText(icon, 0, TILE_SIZE * 0.1);
      ctx.restore();
    });

    // Draw tanks
    const T = TILE_SIZE;
    state.players.forEach(player => {
      if (player.isEliminated) return;

      ctx.save();
      ctx.translate(player.x + HALF_TILE, player.y + HALF_TILE);

      // Check if this is a network player (not AI)
      const isNetworkPlayer = isMultiplayerGame && !player.id.startsWith('ai_');
      const isLocalPlayer = player.isHuman;

      // Draw player indicator BEFORE rotation (so arrow always points down)
      if (isLocalPlayer) {
        ctx.save();
        // Pulsing glow around human player
        const pulse = Math.sin(state.frame * 0.1) * 0.3 + 0.7;
        ctx.shadowBlur = 25;
        ctx.shadowColor = `rgba(255, 215, 0, ${pulse})`;
        ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, T * 0.55, 0, Math.PI * 2);
        ctx.stroke();

        // Arrow pointing to player (always above tank)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(0, -T * 0.7);
        ctx.lineTo(-T * 0.15, -T * 0.9);
        ctx.lineTo(T * 0.15, -T * 0.9);
        ctx.closePath();
        ctx.fill();

        // "YOU" text above arrow
        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${Math.floor(T * 0.28)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('YOU', 0, -T * 1.05);
        ctx.restore();
      } else if (isNetworkPlayer) {
        // Draw name for other network players (friends)
        ctx.save();
        // Cyan glow for friends
        const pulse = Math.sin(state.frame * 0.1) * 0.3 + 0.7;
        ctx.shadowBlur = 15;
        ctx.shadowColor = `rgba(0, 255, 255, ${pulse})`;
        ctx.strokeStyle = `rgba(0, 255, 255, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, T * 0.55, 0, Math.PI * 2);
        ctx.stroke();

        // Player name above tank
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#000';
        ctx.fillStyle = '#00ffff';
        ctx.font = `bold ${Math.floor(T * 0.26)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(player.name, 0, -T * 0.75);
        ctx.restore();
      }

      ctx.rotate(player.angle);

      let bodyColor = player.color;
      if (player.hitFlash && player.hitFlash > 0) {
        bodyColor = '#ffffff';
        player.hitFlash--;
      }

      // Tracks
      ctx.fillStyle = '#222';
      ctx.fillRect(-T * 0.4, -T * 0.35, T * 0.8, T * 0.12);
      ctx.fillRect(-T * 0.4, T * 0.23, T * 0.8, T * 0.12);

      // Body - human player has golden border
      if (player.isHuman) {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-T * 0.33, -T * 0.28, T * 0.66, T * 0.56);
      }
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-T * 0.3, -T * 0.25, T * 0.6, T * 0.5);
      ctx.strokeStyle = player.isHuman ? '#ffd700' : '#000';
      ctx.lineWidth = player.isHuman ? 2 : 1;
      ctx.strokeRect(-T * 0.3, -T * 0.25, T * 0.6, T * 0.5);

      // Turret
      ctx.beginPath();
      ctx.arc(0, 0, T * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Barrel
      ctx.fillRect(T * 0.1, -T * 0.05, T * 0.25, T * 0.1);

      ctx.restore();

      // Shield effect - very visible blinking bubble
      if (player.shieldTime > 0) {
        ctx.save();
        ctx.translate(player.x + HALF_TILE, player.y + HALF_TILE);

        // Blinking transparent bubble
        const blink = Math.sin(state.frame * 0.4) * 0.5 + 0.5;
        const isFlashing = player.shieldTime < 60; // Flash faster when about to expire

        ctx.fillStyle = `rgba(0, 200, 255, ${isFlashing ? blink * 0.25 : 0.15})`;
        ctx.beginPath();
        ctx.arc(0, 0, T * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Bright rotating border
        ctx.strokeStyle = `rgba(0, 220, 255, ${isFlashing ? blink : 0.9})`;
        ctx.lineWidth = isFlashing ? 2 : 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ccff';
        ctx.setLineDash([8, 4]);
        ctx.lineDashOffset = -state.frame * 3;
        ctx.beginPath();
        ctx.arc(0, 0, T * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // "SHIELD" text
        if (!isFlashing || blink > 0.5) {
          ctx.fillStyle = '#00eeff';
          ctx.font = `bold ${Math.floor(T * 0.18)}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText('SHIELD', 0, T * 0.7);
        }

        ctx.restore();
      }

      // Piercing effect
      if ((player.piercingTime || 0) > 0) {
        ctx.save();
        ctx.translate(player.x + HALF_TILE, player.y + HALF_TILE);
        ctx.strokeStyle = '#ff0066';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff0066';
        ctx.beginPath();
        ctx.arc(0, 0, T * 0.35 + Math.sin(state.frame * 0.3) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // HP bar
      const hpBarWidth = T * 0.7;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(player.x + (T - hpBarWidth) / 2, player.y - T * 0.2, hpBarWidth, T * 0.1);
      const hpPerc = player.health / player.maxHealth;
      ctx.fillStyle = hpPerc < 0.3 ? '#f00' : hpPerc < 0.6 ? '#fa0' : '#0f0';
      ctx.fillRect(player.x + (T - hpBarWidth) / 2, player.y - T * 0.2, hpBarWidth * hpPerc, T * 0.1);

      // Lives indicator for human
      if (player.isHuman) {
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.floor(T * 0.25)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(`♥${player.lives}`, player.x + HALF_TILE, player.y - T * 0.35);
      }

      // Bounty marker - skull above bounty target
      if (player.id === state.bountyPlayerId && !player.isHuman) {
        ctx.save();
        ctx.fillStyle = '#ffd700';
        ctx.font = `bold ${Math.floor(T * 0.4)}px Arial`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffd700';
        const bounce = Math.sin(state.frame * 0.15) * 3;
        ctx.fillText('💰', player.x + HALF_TILE, player.y - T * 0.55 + bounce);
        ctx.font = `bold ${Math.floor(T * 0.2)}px Arial`;
        ctx.fillStyle = '#ffd700';
        ctx.fillText('BOUNTY', player.x + HALF_TILE, player.y - T * 0.85 + bounce);
        ctx.restore();
      }
      // Bounty on self
      if (player.id === state.bountyPlayerId && player.isHuman) {
        ctx.save();
        ctx.fillStyle = '#ff4444';
        ctx.font = `bold ${Math.floor(T * 0.2)}px Arial`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff0000';
        const bounce = Math.sin(state.frame * 0.15) * 3;
        ctx.fillText('BOUNTY ON YOU!', player.x + HALF_TILE, player.y - T * 0.85 + bounce);
        ctx.restore();
      }

      // Revenge marker - red target on revenge target
      if (player.isHuman) {
        const revengeId = state.revengeTargets.get(player.id);
        if (revengeId) {
          const revengeTarget = state.players.find(p => p.id === revengeId && !p.isEliminated);
          if (revengeTarget) {
            ctx.save();
            ctx.translate(revengeTarget.x + HALF_TILE, revengeTarget.y + HALF_TILE);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ff0000';
            // Crosshair
            const r = T * 0.55;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-r - 4, 0); ctx.lineTo(r + 4, 0);
            ctx.moveTo(0, -r - 4); ctx.lineTo(0, r + 4);
            ctx.stroke();
            // Label
            ctx.fillStyle = '#ff4444';
            ctx.font = `bold ${Math.floor(T * 0.22)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('REVENGE', 0, -r - 6);
            ctx.restore();
          }
        }
      }
    });

    // Draw airstrike warnings
    state.airstrikes.forEach(strike => {
      ctx.save();
      const progress = 1 - strike.timer / strike.maxTimer;
      const pulse = Math.sin(state.frame * 0.3) * 0.3 + 0.7;

      // Danger zone circle
      ctx.beginPath();
      ctx.arc(strike.x, strike.y, strike.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 0, 0, ${0.15 + progress * 0.2})`;
      ctx.fill();

      // Pulsing border
      ctx.strokeStyle = `rgba(255, 50, 50, ${pulse})`;
      ctx.lineWidth = 3 + progress * 3;
      ctx.setLineDash([15, 8]);
      ctx.lineDashOffset = -state.frame * 2;
      ctx.stroke();
      ctx.setLineDash([]);

      // Warning icon in center
      ctx.fillStyle = `rgba(255, 255, 0, ${pulse})`;
      ctx.font = `bold ${20 + progress * 15}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💣', strike.x, strike.y);

      // Countdown
      const secondsLeft = Math.ceil(strike.timer / 60);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(`${secondsLeft}s`, strike.x, strike.y + 25);

      ctx.restore();
    });

    // Draw supply drops (falling)
    state.supplyDrops.forEach(drop => {
      if (drop.falling) {
        ctx.save();
        const progress = 1 - drop.timer / 120;
        const y = drop.y - (1 - progress) * 100; // Falling animation

        // Parachute
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(drop.x, y - 20, 15, Math.PI, 0);
        ctx.fill();

        // Strings
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(drop.x - 12, y - 15);
        ctx.lineTo(drop.x, y);
        ctx.moveTo(drop.x + 12, y - 15);
        ctx.lineTo(drop.x, y);
        ctx.stroke();

        // Crate
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(drop.x - 12, y - 5, 24, 20);
        ctx.strokeStyle = '#5D3A1A';
        ctx.lineWidth = 2;
        ctx.strokeRect(drop.x - 12, y - 5, 24, 20);

        // Gift ribbon
        ctx.fillStyle = '#ff0';
        ctx.fillRect(drop.x - 2, y - 5, 4, 20);
        ctx.fillRect(drop.x - 12, y + 3, 24, 4);

        ctx.restore();
      }
    });

    // Draw bullets
    state.bullets.forEach(b => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      if (b.isPiercing) {
        ctx.fillStyle = '#ff0066';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0066';
        ctx.rotate(state.frame * 0.3);
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(0, 4);
        ctx.lineTo(-6, 0);
        ctx.lineTo(0, -4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Draw bushes on top
    map.forEach((row, r) => row.forEach((tile, c) => {
      if (tile === TileType.BUSH) {
        ctx.fillStyle = COLORS.BUSH;
        ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }));

    // Particles
    state.particles.forEach(p => {
      ctx.globalAlpha = 1 - p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // Explosions
    state.explosions.forEach(e => {
      const p = e.life / e.maxLife;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * p, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 80, 0, ${1 - p})`;
      ctx.lineWidth = 3 * (1 - p);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(e.x, e.y, (e.radius * 0.5) * (1 - p), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 0, ${0.7 * (1 - p)})`;
      ctx.fill();
    });

    // Draw shrinking zone border
    ctx.save();
    // Danger zone outside (red overlay)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(state.zone.centerX, state.zone.centerY, state.zone.radius, 0, Math.PI * 2, true);
    ctx.fill();

    // Zone border
    ctx.strokeStyle = state.zone.radius > state.zone.targetRadius ? '#ff4444' : '#44ff44';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.lineDashOffset = -state.frame * 0.5;
    ctx.beginPath();
    ctx.arc(state.zone.centerX, state.zone.centerY, state.zone.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // UI - Alive players count (top left)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(5, 5, 130, 35);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`🎮 Alive: ${state.alivePlayers}/16`, 12, 25);

    // Human player lives
    const human = state.players.find(p => p.isHuman);
    if (human) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(CANVAS_SIZE - 105, 5, 100, 35);
      ctx.fillStyle = human.lives > 1 ? '#4ade80' : '#ef4444';
      ctx.textAlign = 'right';
      ctx.fillText(`Lives: ${'♥'.repeat(human.lives)}`, CANVAS_SIZE - 10, 25);
    }

    // Kill Feed (top right, below lives)
    if (state.killFeed.length > 0) {
      ctx.textAlign = 'right';
      state.killFeed.forEach((kill, i) => {
        const y = 55 + i * 22;
        const alpha = 1 - (state.frame - kill.time) / 300;
        ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * alpha})`;
        ctx.fillRect(CANVAS_SIZE - 200, y - 14, 195, 20);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = 'bold 11px Arial';
        if (kill.killer === 'ZONE') {
          ctx.fillText(`☠️ ${kill.victim} → ZONE`, CANVAS_SIZE - 10, y);
        } else {
          ctx.fillText(`${kill.killer} 💀 ${kill.victim}`, CANVAS_SIZE - 10, y);
        }
      });
    }

    // Leaderboard (bottom right corner)
    const sortedPlayers = [...state.players]
      .filter(p => !p.isEliminated)
      .map(p => ({ name: p.name, kills: state.scores.get(p.id) || 0, isHuman: p.isHuman }))
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 5);

    if (sortedPlayers.length > 0) {
      const lbHeight = 22 + sortedPlayers.length * 16;
      const lbY = CANVAS_SIZE - lbHeight - 10;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(CANVAS_SIZE - 145, lbY, 140, lbHeight);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('🏆 TOP KILLERS', CANVAS_SIZE - 138, lbY + 14);

      sortedPlayers.forEach((p, i) => {
        const y = lbY + 30 + i * 16;
        ctx.fillStyle = p.isHuman ? '#ffd700' : '#fff';
        ctx.font = '10px Arial';
        const displayName = p.name.length > 10 ? p.name.substring(0, 8) + '..' : p.name;
        ctx.fillText(`${i + 1}. ${displayName}: ${p.kills}`, CANVAS_SIZE - 138, y);
      });
    }

    // Zone warning
    if (human && !human.isEliminated) {
      const distFromCenter = Math.hypot(
        human.x + HALF_TILE - state.zone.centerX,
        human.y + HALF_TILE - state.zone.centerY
      );
      if (distFromCenter > state.zone.radius * 0.85) {
        ctx.fillStyle = distFromCenter > state.zone.radius ? '#ff0000' : '#ffaa00';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        const warning = distFromCenter > state.zone.radius ? '⚠️ OUTSIDE ZONE! ⚠️' : '⚠️ ZONE CLOSING ⚠️';
        ctx.fillText(warning, CANVAS_SIZE / 2, CANVAS_SIZE - 20);
      }
    }

    // Announcements (big centered text)
    state.announcements.forEach(ann => {
      const age = state.frame - ann.time;
      const alpha = age < 30 ? age / 30 : Math.max(0, 1 - (age - 120) / 60);
      const scale = age < 20 ? 0.5 + (age / 20) * 0.5 : 1;
      ctx.save();
      ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE * 0.35);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ann.color;
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 15;
      ctx.shadowColor = ann.color;
      ctx.fillText(ann.text, 0, 0);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeText(ann.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }, [map]);

  useEffect(() => {
    let aid: number;
    const loop = () => {
      update();
      draw();
      aid = requestAnimationFrame(loop);
    };
    aid = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(aid);
  }, [update, draw]);

  return (
    <div className="game-canvas-wrapper w-full h-full flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className="border-4 border-[#333] shadow-[0_0_30px_rgba(0,0,0,0.5)] max-w-full max-h-full"
        style={{
          imageRendering: 'pixelated',
          width: '100%',
          height: 'auto',
          maxWidth: `${CANVAS_SIZE}px`,
          aspectRatio: '1 / 1'
        }}
      />
    </div>
  );
};
