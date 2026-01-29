import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface Player {
  id: string;
  name: string;
  color: string;
}

interface MultiplayerLobbyProps {
  onBack: () => void;
  onStartGame: (socket: Socket, players: Player[], myId: string) => void;
  playerName: string;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({ onBack, onStartGame, playerName }) => {
  const [serverIp, setServerIp] = useState('battle-city-server-8cqf.onrender.com');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  // Use refs to avoid stale closure issues
  const socketRef = React.useRef<Socket | null>(null);
  const playersRef = React.useRef<Player[]>([]);
  const myIdRef = React.useRef<string | null>(null);

  const connect = () => {
    setConnecting(true);
    setError(null);

    // Use https for remote server, http for localhost
    const isLocal = serverIp === 'localhost' || serverIp.startsWith('192.168');
    const url = isLocal ? `http://${serverIp}:3001` : `https://${serverIp}`;
    const newSocket = io(url, {
      transports: ['websocket', 'polling'],
      timeout: 10000
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      setConnected(true);
      setConnecting(false);
      setSocket(newSocket);
    });

    newSocket.on('init', (data) => {
      setMyId(data.playerId);
      myIdRef.current = data.playerId;
      setPlayers(data.players);
      playersRef.current = data.players;
      newSocket.emit('setName', playerName);
    });

    newSocket.on('playerJoined', (player: Player) => {
      setPlayers(prev => {
        const updated = [...prev, player];
        playersRef.current = updated;
        return updated;
      });
    });

    newSocket.on('playerUpdated', (player: Player) => {
      setPlayers(prev => {
        const updated = prev.map(p => p.id === player.id ? player : p);
        playersRef.current = updated;
        return updated;
      });
    });

    newSocket.on('playerLeft', (playerId: string) => {
      setPlayers(prev => {
        const updated = prev.filter(p => p.id !== playerId);
        playersRef.current = updated;
        return updated;
      });
    });

    newSocket.on('gameStarted', (data: { players: Player[] }) => {
      console.log('gameStarted event received:', data);
      // Use refs to get latest values
      const currentSocket = socketRef.current;
      const currentMyId = myIdRef.current;
      const currentPlayers = data.players || playersRef.current;

      console.log('Current state:', {
        hasSocket: !!currentSocket,
        myId: currentMyId,
        playerCount: currentPlayers?.length
      });

      if (currentSocket && currentMyId) {
        console.log('Starting game for player:', currentMyId);
        onStartGame(currentSocket, currentPlayers, currentMyId);
      } else {
        console.error('Cannot start game - missing socket or myId');
      }
    });

    newSocket.on('connect_error', () => {
      setError('ვერ დაუკავშირდა სერვერს. შეამოწმე IP მისამართი.');
      setConnecting(false);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      setError('კავშირი გაწყდა');
    });
  };

  const startGame = () => {
    if (socket && myId) {
      socket.emit('startGame', { players });
    }
  };

  const disconnect = () => {
    socket?.disconnect();
    setSocket(null);
    setConnected(false);
    setPlayers([]);
    setMyId(null);
  };

  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-black/80 border-2 border-yellow-500/50 max-w-lg mx-auto mt-10">
      <h2 className="text-2xl font-black text-yellow-500 uppercase">LAN Multiplayer</h2>

      {!connected ? (
        <>
          <div className="w-full space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">სერვერის IP მისამართი:</label>
              <input
                type="text"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                placeholder="localhost ან 192.168.x.x"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 text-white focus:border-yellow-500 outline-none"
              />
            </div>
            <p className="text-[10px] text-gray-500">
              Host-მა უნდა გაუშვას: <span className="text-cyan-400">node server.js</span>
            </p>
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <div className="flex gap-4">
            <button
              onClick={connect}
              disabled={connecting}
              className={`px-6 py-3 font-bold uppercase ${connecting ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-500'} text-white`}
            >
              {connecting ? 'კავშირი...' : 'დაკავშირება'}
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 font-bold uppercase bg-gray-700 hover:bg-gray-600 text-white"
            >
              უკან
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="w-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-green-400 text-sm">დაკავშირებულია სერვერთან</span>
              <span className="text-xs text-gray-500">{serverIp}:3001</span>
            </div>

            <div className="bg-gray-900 p-4 border border-gray-700">
              <p className="text-xs text-gray-400 mb-2">მოთამაშეები ({players.length}/16):</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-2 p-2 bg-gray-800"
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: player.color }}
                    />
                    <span className={`text-sm ${player.id === myId ? 'text-yellow-400 font-bold' : 'text-white'}`}>
                      {player.name} {player.id === myId && '(შენ)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            {players.length >= 2 ? (
              <button
                onClick={startGame}
                className="px-8 py-3 font-bold uppercase bg-yellow-600 hover:bg-yellow-500 text-black animate-pulse"
              >
                თამაშის დაწყება ({players.length} მოთამაშე + {16 - players.length} AI)
              </button>
            ) : (
              <p className="text-yellow-500 text-sm animate-pulse">ელოდე მეგობარს... ({players.length}/2 მინიმუმ)</p>
            )}
            <button
              onClick={disconnect}
              className="px-6 py-3 font-bold uppercase bg-red-700 hover:bg-red-600 text-white"
            >
              გათიშვა
            </button>
          </div>
        </>
      )}

      <div className="text-[10px] text-gray-600 text-center mt-4">
        <p>სერვერის გასაშვებად Terminal-ში:</p>
        <code className="text-cyan-500">npm run server</code>
      </div>
    </div>
  );
};
