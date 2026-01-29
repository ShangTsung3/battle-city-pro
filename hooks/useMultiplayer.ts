import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface NetworkPlayer {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  lives: number;
  isEliminated: boolean;
  shieldTime: number;
  bulletLevel: number;
  speedLevel: number;
  piercingTime: number;
  score: number;
}

interface BulletData {
  id: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  ownerId: string;
  isPiercing: boolean;
}

export const useMultiplayer = (serverUrl: string, playerName: string) => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [players, setPlayers] = useState<NetworkPlayer[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [remoteBullets, setRemoteBullets] = useState<BulletData[]>([]);
  const [tileUpdates, setTileUpdates] = useState<{r: number, c: number, tile: number}[]>([]);
  const [remoteItems, setRemoteItems] = useState<{id: string, x: number, y: number, type: string}[]>([]);

  useEffect(() => {
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    socket.on('init', (data) => {
      setMyId(data.playerId);
      setPlayers(data.players);
      setGameStarted(data.gameStarted);
      // Set player name
      socket.emit('setName', playerName);
    });

    socket.on('playerJoined', (player: NetworkPlayer) => {
      setPlayers(prev => [...prev, player]);
    });

    socket.on('playerUpdated', (player: NetworkPlayer) => {
      setPlayers(prev => prev.map(p => p.id === player.id ? player : p));
    });

    socket.on('playerMoved', (data) => {
      setPlayers(prev => prev.map(p =>
        p.id === data.id ? { ...p, ...data } : p
      ));
    });

    socket.on('playerLeft', (playerId: string) => {
      setPlayers(prev => prev.filter(p => p.id !== playerId));
    });

    socket.on('bulletFired', (bullet: BulletData) => {
      setRemoteBullets(prev => [...prev, bullet]);
      // Remove bullet after 3 seconds (safety cleanup)
      setTimeout(() => {
        setRemoteBullets(prev => prev.filter(b => b.id !== bullet.id));
      }, 3000);
    });

    socket.on('playerHit', (data) => {
      setPlayers(prev => prev.map(p =>
        p.id === data.playerId ? { ...p, health: data.health } : p
      ));
    });

    socket.on('playerDeath', (data) => {
      setPlayers(prev => prev.map(p =>
        p.id === data.playerId ? { ...p, lives: data.lives, isEliminated: data.isEliminated } : p
      ));
    });

    socket.on('tileDestroyed', (data) => {
      setTileUpdates(prev => [...prev, data]);
    });

    socket.on('itemSpawned', (data) => {
      setRemoteItems(prev => [...prev, data]);
    });

    socket.on('itemPickup', (data) => {
      setRemoteItems(prev => prev.filter(i => i.id !== data.id));
    });

    socket.on('gameStarted', () => {
      setGameStarted(true);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [serverUrl, playerName]);

  const updateMyPosition = useCallback((data: Partial<NetworkPlayer>) => {
    socketRef.current?.emit('updatePosition', data);
  }, []);

  const fireBullet = useCallback((bullet: BulletData) => {
    socketRef.current?.emit('bulletFired', bullet);
  }, []);

  const reportHit = useCallback((playerId: string, health: number) => {
    socketRef.current?.emit('playerHit', { playerId, health });
  }, []);

  const reportDeath = useCallback((playerId: string, lives: number, isEliminated: boolean) => {
    socketRef.current?.emit('playerDeath', { playerId, lives, isEliminated });
  }, []);

  const destroyTile = useCallback((r: number, c: number, tile: number) => {
    socketRef.current?.emit('tileDestroyed', { r, c, tile });
  }, []);

  const spawnItem = useCallback((id: string, x: number, y: number, type: string) => {
    socketRef.current?.emit('itemSpawned', { id, x, y, type });
  }, []);

  const pickupItem = useCallback((id: string) => {
    socketRef.current?.emit('itemPickup', { id });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit('startGame');
  }, []);

  const clearTileUpdate = useCallback((r: number, c: number) => {
    setTileUpdates(prev => prev.filter(t => t.r !== r || t.c !== c));
  }, []);

  const clearRemoteBullet = useCallback((id: string) => {
    setRemoteBullets(prev => prev.filter(b => b.id !== id));
  }, []);

  return {
    connected,
    myId,
    players,
    gameStarted,
    remoteBullets,
    tileUpdates,
    remoteItems,
    updateMyPosition,
    fireBullet,
    reportHit,
    reportDeath,
    destroyTile,
    spawnItem,
    pickupItem,
    startGame,
    clearTileUpdate,
    clearRemoteBullet
  };
};
