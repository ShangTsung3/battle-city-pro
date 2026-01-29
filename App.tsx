
import React, { useState, useCallback } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { Sidebar } from './components/Sidebar';
import { Lobby } from './components/Lobby';
import { Celebration } from './components/Celebration';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { INITIAL_MAP, getMapByStage } from './constants';
import { sounds } from './services/SoundManager';
import { Socket } from 'socket.io-client';

const NAMES = ["Tank_Destroyer", "Iron_Viper", "Steel_Titan", "Panzer_Fury", "Alpha_Unit", "Ghost_Driver", "Heavy_Gunner", "Red_Baron", "Desert_Fox", "Cobra_Commander", "Night_Stalker", "War_Machine", "Metal_Jacket", "T-800", "Abrams_A1"];

interface NetworkPlayer {
  id: string;
  name: string;
  color: string;
}

const App: React.FC = () => {
  const [map, setMap] = useState<number[][]>(JSON.parse(JSON.stringify(INITIAL_MAP)));
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [playerHealth, setPlayerHealth] = useState(5);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameSessionId, setGameSessionId] = useState(0);
  const [playerName, setPlayerName] = useState('COMMANDER_YOU');
  const [selectedTankIndex, setSelectedTankIndex] = useState(0);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [inLobby, setInLobby] = useState(false);
  const [inMultiplayerLobby, setInMultiplayerLobby] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [gameResult, setGameResult] = useState<'victory' | 'defeat' | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioStarted, setAudioStarted] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimTx, setClaimTx] = useState<string | null>(null);
  const [multiplayerSocket, setMultiplayerSocket] = useState<Socket | null>(null);
  const [multiplayerPlayers, setMultiplayerPlayers] = useState<NetworkPlayer[]>([]);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isMultiplayerGame, setIsMultiplayerGame] = useState(false);

  const startAudio = useCallback(() => {
    if (!audioStarted) {
      sounds.init();
      sounds.startMenuMusic();
      setAudioStarted(true);
    }
  }, [audioStarted]);

  const toggleSound = () => {
    startAudio();
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    sounds.setMute(nextMute);
  };

  const generateSolanaAddress = () => {
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let addr = "";
    for (let i = 0; i < 44; i++) addr += chars.charAt(Math.floor(Math.random() * chars.length));
    return addr;
  };

  const connectWallet = async () => {
    startAudio();
    setIsConnecting(true);
    await new Promise(r => setTimeout(r, 800));
    setWalletAddress(generateSolanaAddress());
    setIsConnecting(false);
  };

  const resetToMain = () => {
    setInLobby(false);
    setInMultiplayerLobby(false);
    setGameActive(false);
    setGameResult(null);
    setScore(0);
    setLives(3);
    setPlayerHealth(5);
    setIsGameOver(false);
    setIsClaiming(false);
    setClaimTx(null);
    setWalletAddress(null);
    setMap(JSON.parse(JSON.stringify(INITIAL_MAP)));
    setMultiplayerSocket(null);
    setMultiplayerPlayers([]);
    setMyPlayerId(null);
    setIsMultiplayerGame(false);
    sounds.stopMenuMusic();
    sounds.startMenuMusic();
  };

  const startMultiplayerGame = (socket: Socket, players: NetworkPlayer[], myId: string) => {
    startAudio();
    sounds.stopMenuMusic();
    setMultiplayerSocket(socket);
    setMultiplayerPlayers(players);
    setMyPlayerId(myId);
    setIsMultiplayerGame(true);
    setInMultiplayerLobby(false);
    const stageMap = getMapByStage('BATTLE_ROYALE');
    setMap(stageMap);
    setGameSessionId(prev => prev + 1);
    setGameActive(true);
    setIsGameOver(false);
    setGameResult(null);
    setScore(0);
    setLives(3);
  };

  const startBattleRoyale = (chosenName: string, tankIndex: number) => {
    startAudio();
    sounds.stopMenuMusic();
    setPlayerName(chosenName);
    setSelectedTankIndex(tankIndex);
    setInLobby(false);
    // Go directly to Battle Royale game
    const stageMap = getMapByStage('BATTLE_ROYALE');
    setMap(stageMap);
    setGameSessionId(prev => prev + 1);
    setGameActive(true);
    setIsGameOver(false);
    setGameResult(null);
    setScore(0);
    setLives(3);
  };

  const handleVictory = () => {
    setGameActive(false);
    setGameResult('victory');
    setScore(prev => prev + 5000);
  };

  const handleDefeat = () => {
    setGameActive(false);
    setGameResult('defeat');
    sounds.startMenuMusic();
  };

  const handleClaimReward = async () => {
    setIsClaiming(true);
    await new Promise(r => setTimeout(r, 2000));
    setClaimTx(generateSolanaAddress());
    setIsClaiming(false);
    sounds.playPowerup();
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono flex flex-col items-center p-2 sm:p-4 overflow-x-hidden" onClick={startAudio}>
      <div className="w-full max-w-[1400px] flex justify-between items-center mb-2 sm:mb-4 border-b border-white/5 pb-2 px-2">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-yellow-500 font-black italic text-xs sm:text-sm tracking-tighter">BATTLE CITY PRO // v2.0</div>
          <button
            onClick={(e) => { e.stopPropagation(); toggleSound(); }}
            className="text-[8px] sm:text-[10px] text-gray-400 hover:text-white border border-white/10 px-2 py-0.5 rounded uppercase flex items-center gap-1 sm:gap-2"
          >
            {isMuted ? '🔇 Off' : '🔊 On'}
          </button>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); if (!walletAddress) connectWallet(); }}
          className={`px-2 sm:px-3 py-1 border transition-all duration-300 ${walletAddress ? 'border-green-500 text-green-400' : 'border-purple-500 text-purple-400 hover:bg-purple-900/20'} text-[7px] sm:text-[8px] uppercase`}
        >
          {isConnecting ? 'CONNECTING...' : walletAddress ? `${walletAddress.substring(0, 4)}...${walletAddress.substring(walletAddress.length - 4)}` : 'Connect Solana'}
        </button>
      </div>

      {!inLobby && !inMultiplayerLobby && !gameActive && !gameResult ? (
        <div className="mt-10 sm:mt-20 flex flex-col items-center gap-4 sm:gap-6 animate-in fade-in duration-1000 px-4">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black italic text-yellow-500 tracking-tighter mb-2 sm:mb-4 shadow-yellow-500/20 text-center">BATTLE CITY</h1>
          <p className="text-lg sm:text-xl text-red-500 font-bold uppercase tracking-wider animate-pulse">Battle Royale</p>
          <p className="text-xs text-gray-400 text-center max-w-md">32 tanks enter, 1 tank leaves. Each player has 3 lives. Last one standing wins!</p>
          <div className="flex flex-col gap-4 w-full max-w-xs sm:max-w-sm">
            <button
              onClick={(e) => { e.stopPropagation(); startAudio(); setInLobby(true); }}
              disabled={!walletAddress}
              className={`px-6 sm:px-8 py-3 sm:py-4 font-black uppercase transition-all transform border-b-4 text-sm sm:text-base
                ${walletAddress
                  ? 'bg-red-600 text-white border-red-800 hover:scale-105 hover:bg-red-500'
                  : 'bg-gray-800 text-gray-500 border-gray-900 opacity-50 cursor-not-allowed grayscale'}`}
            >
              Solo vs AI
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); startAudio(); setInMultiplayerLobby(true); }}
              disabled={!walletAddress}
              className={`px-6 sm:px-8 py-3 sm:py-4 font-black uppercase transition-all transform border-b-4 text-sm sm:text-base
                ${walletAddress
                  ? 'bg-green-600 text-white border-green-800 hover:scale-105 hover:bg-green-500'
                  : 'bg-gray-800 text-gray-500 border-gray-900 opacity-50 cursor-not-allowed grayscale'}`}
            >
              LAN Multiplayer
            </button>
            {!walletAddress && (
              <p className="text-[7px] sm:text-[8px] text-purple-400 animate-pulse text-center tracking-[0.2em] uppercase">
                Connect Solana Wallet to Unlock
              </p>
            )}
          </div>
        </div>
      ) : inLobby ? (
        <Lobby onBack={() => { setInLobby(false); }} onStartTournament={startBattleRoyale} aiNames={NAMES} walletAddress={walletAddress} />
      ) : inMultiplayerLobby ? (
        <MultiplayerLobby
          onBack={() => { setInMultiplayerLobby(false); }}
          onStartGame={startMultiplayerGame}
          playerName={playerName}
        />
      ) : gameResult ? (
        <div className="flex flex-col items-center justify-center gap-6 mt-20">
          {gameResult === 'victory' && <Celebration />}
          <div className="text-center space-y-6 relative z-[110] bg-black/80 p-10 border-4 border-yellow-500/50 backdrop-blur-md w-full max-w-lg">
            <div className="text-6xl mb-2 animate-bounce">{gameResult === 'victory' ? '🏆' : '💀'}</div>
            <h2 className={`text-4xl font-black italic tracking-tighter ${gameResult === 'victory' ? 'text-yellow-500' : 'text-red-500'}`}>
              {gameResult === 'victory' ? 'VICTORY!' : 'ELIMINATED'}
            </h2>
            <p className="text-gray-300">
              {gameResult === 'victory'
                ? 'You are the last tank standing! Champion of the Battle Royale!'
                : 'You ran out of lives. Better luck next time!'}
            </p>
            <p className="text-2xl font-black text-cyan-400">Score: {score}</p>

            {gameResult === 'victory' && (
              <div className="p-6 bg-cyan-900/20 border border-cyan-500/30 rounded mt-6">
                {claimTx ? (
                  <div className="animate-in fade-in slide-in-from-bottom-4">
                    <p className="text-green-400 font-black text-xs mb-2">REWARD DISBURSED SUCCESSFULLY</p>
                    <p className="text-[6px] text-gray-500 break-all font-mono">TX: {claimTx}</p>
                  </div>
                ) : (
                  <button
                    onClick={handleClaimReward}
                    disabled={isClaiming}
                    className={`px-12 py-4 bg-cyan-600 text-white font-black uppercase hover:bg-cyan-500 transition-all ${isClaiming ? 'opacity-50 cursor-not-allowed animate-pulse' : ''}`}
                  >
                    {isClaiming ? 'VERIFYING ON CHAIN...' : 'CLAIM 10 SOL PRIZE'}
                  </button>
                )}
              </div>
            )}

            <button
              onClick={resetToMain}
              className="px-10 py-4 bg-white text-black font-black uppercase hover:bg-yellow-500 transition-all transform hover:scale-105 shadow-[0_4px_0_#aaa] active:translate-y-1 active:shadow-none mt-4"
            >
              Play Again
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 w-full max-w-[1400px] items-center lg:items-stretch justify-center px-2">
          <div className="relative border-4 sm:border-8 border-[#222] shadow-[0_0_60px_rgba(0,0,0,0.5)] w-full max-w-[95vmin] sm:max-w-[85vmin] lg:max-w-[806px] aspect-square flex-shrink-0">
            <GameCanvas
              key={gameSessionId}
              map={map}
              setMap={setMap}
              onGameOver={handleDefeat}
              onVictory={handleVictory}
              onScoreUpdate={s => setScore(p => p+s)}
              onLifeLost={() => setLives(p => Math.max(0, p-1))}
              onPlayerUpdate={h => setPlayerHealth(h)}
              isGameOver={isGameOver}
              selectedTankIndex={selectedTankIndex}
              tournamentStage="BATTLE_ROYALE"
              playerName={playerName}
              aiNames={NAMES}
              multiplayerSocket={multiplayerSocket}
              multiplayerPlayers={multiplayerPlayers}
              myPlayerId={myPlayerId}
              isMultiplayerGame={isMultiplayerGame}
            />
          </div>
          <div className="w-full lg:w-80 xl:w-96 mt-4 lg:mt-0 lg:self-stretch">
            <Sidebar
              score={score}
              lives={lives}
              playerHealth={playerHealth}
              onReset={resetToMain}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
