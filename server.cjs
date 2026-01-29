const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Game state
const gameState = {
  players: new Map(),
  bullets: [],
  items: [],
  gameStarted: false,
  map: null
};

// Player colors
const PLAYER_COLORS = [
  '#ffd700', '#00ff00', '#00ffff', '#ff00ff', '#ff6600', '#00ff99',
  '#ff3366', '#66ff33', '#3366ff', '#ffff00', '#ff0099', '#99ff00'
];

let colorIndex = 0;

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Assign player info
  const playerColor = PLAYER_COLORS[colorIndex % PLAYER_COLORS.length];
  colorIndex++;

  const playerInfo = {
    id: socket.id,
    name: `Player_${gameState.players.size + 1}`,
    color: playerColor,
    x: 0,
    y: 0,
    angle: 0,
    health: 5,
    maxHealth: 5,
    lives: 3,
    isEliminated: false,
    shieldTime: 180,
    bulletLevel: 1,
    speedLevel: 1,
    piercingTime: 0,
    score: 0
  };

  gameState.players.set(socket.id, playerInfo);

  // Send player their info and current game state
  socket.emit('init', {
    playerId: socket.id,
    playerInfo: playerInfo,
    players: Array.from(gameState.players.values()),
    gameStarted: gameState.gameStarted
  });

  // Notify others about new player
  socket.broadcast.emit('playerJoined', playerInfo);

  // Handle player name update
  socket.on('setName', (name) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      player.name = name;
      io.emit('playerUpdated', player);
    }
  });

  // Handle player position update
  socket.on('updatePosition', (data) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      player.x = data.x;
      player.y = data.y;
      player.angle = data.angle;
      player.health = data.health;
      player.lives = data.lives;
      player.isEliminated = data.isEliminated;
      player.shieldTime = data.shieldTime;
      player.bulletLevel = data.bulletLevel;
      player.piercingTime = data.piercingTime;
      // Broadcast to others
      socket.broadcast.emit('playerMoved', {
        id: socket.id,
        ...data
      });
    }
  });

  // Handle bullet fired
  socket.on('bulletFired', (bulletData) => {
    socket.broadcast.emit('bulletFired', {
      ...bulletData,
      ownerId: socket.id
    });
  });

  // Handle player hit
  socket.on('playerHit', (data) => {
    io.emit('playerHit', data);
  });

  // Handle player death
  socket.on('playerDeath', (data) => {
    const player = gameState.players.get(data.playerId);
    if (player) {
      player.lives = data.lives;
      player.isEliminated = data.isEliminated;
      io.emit('playerDeath', data);
    }
  });

  // Handle map tile destruction
  socket.on('tileDestroyed', (data) => {
    socket.broadcast.emit('tileDestroyed', data);
  });

  // Handle item spawn
  socket.on('itemSpawned', (data) => {
    socket.broadcast.emit('itemSpawned', data);
  });

  // Handle item pickup
  socket.on('itemPickup', (data) => {
    socket.broadcast.emit('itemPickup', data);
  });

  // Handle game start
  socket.on('startGame', () => {
    gameState.gameStarted = true;
    const playersArray = Array.from(gameState.players.values());
    console.log(`Game starting with ${playersArray.length} players`);
    console.log('Players:', playersArray.map(p => ({ id: p.id, name: p.name })));
    console.log('Emitting gameStarted to all clients...');
    io.emit('gameStarted', { players: playersArray });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    gameState.players.delete(socket.id);
    io.emit('playerLeft', socket.id);

    // Check if game should reset
    if (gameState.players.size === 0) {
      gameState.gameStarted = false;
      colorIndex = 0;
    }
  });

  // Chat message
  socket.on('chat', (message) => {
    const player = gameState.players.get(socket.id);
    if (player) {
      io.emit('chat', {
        playerId: socket.id,
        playerName: player.name,
        message: message
      });
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ====================================
  Battle City Multiplayer Server
  ====================================
  Server running on port ${PORT}

  Local:   http://localhost:${PORT}
  Network: http://${getLocalIP()}:${PORT}

  Share the Network URL with friends!
  ====================================
  `);
});

function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}
