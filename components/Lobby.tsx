
import React, { useState, useEffect, useRef } from 'react';

interface LobbyProps {
  onStartTournament: (playerName: string, tankIndex: number) => void;
  aiNames: string[];
  onBack: () => void;
  walletAddress: string | null;
}

interface ChatMessage {
  sender: string;
  text: string;
  color?: string;
  isPlayer?: boolean;
}

const TANK_PRESETS = [
  { name: "ST-1 BALANCED", color: "#cc8400", health: 5, speed: "MEDIUM", desc: "Classic combat unit." },
  { name: "HV-7 HEAVY", color: "#b91c1c", health: 8, speed: "SLOW", desc: "Thick armor, heavy hits." },
  { name: "LT-3 SCOUT", color: "#15803d", health: 4, speed: "FAST", desc: "Highly mobile, fragile." },
  { name: "SN-5 SNIPER", color: "#1d4ed8", health: 4, speed: "FAST BULLETS", desc: "Long range precision." },
  { name: "VT-X ELITE", color: "#7e22ce", health: 6, speed: "QUICK", desc: "Experimental tech." }
];

const AI_PHRASES = [
  "Armor status: 100%. Ready for scrap metal.",
  "Who's ready to lose some SOL today?",
  "I've updated my targeting sensors. Watch out.",
  "Scout tanks are annoying... I'll crush them first.",
  "See you in the ruins, Commander.",
  "My treads are itching for some action!",
  "Is the prize pool really 10 SOL? Huge.",
  "Don't hide in the bushes, it won't help you.",
  "Calculated trajectory: Victory.",
  "GL HF, but I'm taking the gold.",
  "Wait, who invited COMMANDER_YOU? Easy win.",
  "Engine tuned. Ready for deployment."
];

export const Lobby: React.FC<LobbyProps> = ({ onStartTournament, aiNames, onBack, walletAddress }) => {
  const [playerName, setPlayerName] = useState('COMMANDER_YOU');
  const [selectedTank, setSelectedTank] = useState(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const [joinedPlayers, setJoinedPlayers] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [playerInput, setPlayerInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    if (isRegistered && joinedPlayers.length < 16) {
      const timer = setTimeout(() => {
        const nextAi = aiNames[joinedPlayers.length - 1];
        if (nextAi) {
          setJoinedPlayers(prev => [...prev, nextAi]);
          setProgress(Math.round(((joinedPlayers.length + 1) / 16) * 100));

          // Random chance for AI to speak when joining
          if (Math.random() < 0.3) {
            const phrase = AI_PHRASES[Math.floor(Math.random() * AI_PHRASES.length)];
            setChatMessages(prev => [...prev, { 
              sender: nextAi, 
              text: phrase,
              color: '#999'
            }]);
          }
        }
      }, 150 + Math.random() * 400);
      return () => clearTimeout(timer);
    } else if (isRegistered && joinedPlayers.length === 16) {
      const startTimer = setTimeout(() => {
        onStartTournament(playerName, selectedTank);
      }, 2000);
      return () => clearTimeout(startTimer);
    }
  }, [isRegistered, joinedPlayers, aiNames, onStartTournament, playerName, selectedTank]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && walletAddress) {
      setIsRegistered(true);
      setJoinedPlayers([playerName.trim()]);
      setProgress(Math.round((1 / 16) * 100));
      setChatMessages([{ sender: 'SYSTEM', text: 'TACTICAL LINK ESTABLISHED. GOOD LUCK PILOT.', color: '#0f0' }]);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerInput.trim()) return;
    setChatMessages(prev => [...prev, { 
      sender: playerName, 
      text: playerInput.toUpperCase(), 
      isPlayer: true,
      color: '#06b6d4'
    }]);
    setPlayerInput('');
  };

  return (
    <div className="z-50 flex flex-col items-center gap-4 sm:gap-8 bg-black/95 p-4 sm:p-10 border-4 sm:border-8 border-[#222] shadow-[0_0_50px_rgba(0,255,255,0.1)] max-w-5xl w-full animate-in fade-in zoom-in duration-500 font-mono mx-2 overflow-y-auto max-h-[90vh]">
      {!isRegistered ? (
        <div className="w-full space-y-4 sm:space-y-8">
          <div className="text-center space-y-2 relative">
            <div className="absolute -top-2 sm:-top-4 right-0 bg-yellow-500 text-black px-1.5 sm:px-2 py-0.5 sm:py-1 text-[6px] sm:text-[8px] font-black rotate-3 shadow-[4px_4px_0_#000]">
              PRIZE: 10 SOL
            </div>
            <h2 className="text-xl sm:text-3xl font-black italic text-cyan-500 tracking-tighter uppercase">Tournament Registration</h2>
            <div className="flex justify-center items-center gap-2">
              <span className="text-[6px] sm:text-[8px] text-green-500 uppercase tracking-widest">Secured by Solana</span>
              <span className="text-[6px] sm:text-[8px] text-gray-600">•</span>
              <span className="text-[6px] sm:text-[8px] text-gray-500 uppercase tracking-widest">{walletAddress?.substring(0,6)}...</span>
            </div>
          </div>

          <div className="bg-black/40 border border-white/5 p-2 sm:p-4 grid grid-cols-3 gap-2 sm:gap-4 text-center">
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[5px] sm:text-[6px] text-gray-500 uppercase">1st Place</p>
              <p className="text-[10px] sm:text-xs font-black text-yellow-500">4 SOL</p>
            </div>
            <div className="space-y-0.5 sm:space-y-1 border-x border-white/5">
              <p className="text-[5px] sm:text-[6px] text-gray-500 uppercase">2nd Place</p>
              <p className="text-[10px] sm:text-xs font-black text-white">3 SOL</p>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <p className="text-[5px] sm:text-[6px] text-gray-500 uppercase">3rd Place</p>
              <p className="text-[10px] sm:text-xs font-black text-orange-500">3 SOL</p>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] text-center">Select Your Unit</h3>
            <div className="grid grid-cols-5 gap-1 sm:gap-3">
              {TANK_PRESETS.map((tank, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedTank(idx)}
                  className={`flex flex-col items-center p-1.5 sm:p-3 border-2 sm:border-4 transition-all ${
                    selectedTank === idx
                      ? 'border-cyan-500 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-105'
                      : 'border-[#1a1a1a] bg-black hover:border-gray-700'
                  }`}
                >
                  <div className="w-6 h-6 sm:w-8 sm:h-8 mb-1 sm:mb-3 flex items-center justify-center relative">
                    <div className="w-full h-full" style={{ backgroundColor: tank.color }} />
                    <div className="absolute w-1.5 sm:w-2 h-3 sm:h-4 left-full" style={{ backgroundColor: tank.color }} />
                  </div>
                  <span className="text-[5px] sm:text-[7px] font-black text-center h-3 sm:h-4 overflow-hidden leading-tight">{tank.name}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4 sm:space-y-6 pt-4 border-t border-white/5">
            <div className="space-y-2">
              <label className="text-[7px] sm:text-[8px] text-gray-400 uppercase tracking-widest">Pilot Callsign</label>
              <input
                autoFocus
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
                maxLength={15}
                className="w-full bg-black border-2 sm:border-4 border-[#333] p-2 sm:p-4 text-yellow-500 font-black text-base sm:text-xl focus:border-cyan-500 outline-none transition-colors"
              />
            </div>

            <div className="flex gap-2 sm:gap-4">
              <button
                type="button"
                onClick={onBack}
                className="flex-1 p-2 sm:p-4 bg-gray-900 text-gray-400 font-black uppercase border-b-2 sm:border-b-4 border-black hover:bg-gray-800 transition-all text-xs sm:text-base"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!walletAddress}
                className={`flex-[2] p-2 sm:p-4 font-black uppercase transition-all transform hover:scale-105 border-b-2 sm:border-b-4 shadow-[0_4px_0_rgba(0,0,0,0.5)] text-xs sm:text-base
                  ${walletAddress
                    ? 'bg-cyan-700 hover:bg-cyan-600 text-white border-cyan-900'
                    : 'bg-gray-800 text-gray-600 border-gray-900 cursor-not-allowed'}`}
              >
                Register
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-3 sm:gap-6">
          <div className="text-center space-y-2 relative">
            <div className="absolute -top-2 sm:-top-4 right-0 bg-yellow-500 text-black px-1.5 sm:px-2 py-0.5 sm:py-1 text-[6px] sm:text-[8px] font-black rotate-3 animate-pulse">
              JACKPOT: 10 SOL
            </div>
            <h2 className="text-xl sm:text-3xl font-black italic text-yellow-500 tracking-tighter uppercase">Tactical Lobby</h2>
            <div className="flex justify-between items-end">
              <p className="text-[8px] sm:text-[10px] text-cyan-400 uppercase tracking-widest">Filling Match Slots...</p>
              <p className="text-lg sm:text-xl font-black text-white">{joinedPlayers.length}/16</p>
            </div>
          </div>

          <div className="w-full h-3 sm:h-4 bg-gray-900 border-2 border-[#333] relative overflow-hidden">
            <div
              className="h-full bg-cyan-500 shadow-[0_0_15px_#06b6d4] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex flex-col lg:flex-row gap-3 sm:gap-6 h-[250px] sm:h-[400px]">
            {/* Player List */}
            <div className="flex-[1] grid grid-cols-2 gap-2 overflow-y-auto p-4 bg-black/50 border-4 border-[#1a1a1a] no-scrollbar">
              {joinedPlayers.map((name, idx) => (
                <div key={idx} className={`text-[8px] p-2 border border-[#222] truncate animate-in slide-in-from-left duration-200 ${name === playerName ? 'text-cyan-400 font-black bg-cyan-950/20' : 'text-gray-500'}`}>
                  {idx + 1}. {name}
                </div>
              ))}
            </div>

            {/* Chat System */}
            <div className="flex-[1.5] flex flex-col bg-black/80 border-4 border-[#222] overflow-hidden">
              <div className="p-2 border-b border-[#333] bg-[#111] flex justify-between items-center">
                <span className="text-[8px] text-gray-400 font-black uppercase">COMMUNICATION_LINK_ACTIVE</span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#0f0]" />
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono no-scrollbar">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`animate-in slide-in-from-bottom-2 duration-300`}>
                    <span className="text-[7px] opacity-60 mr-2">[{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                    <span className="text-[8px] font-black mr-2" style={{ color: msg.color }}>{msg.sender}:</span>
                    <span className={`text-[8px] ${msg.isPlayer ? 'text-white' : 'text-gray-300'}`}>{msg.text}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 bg-[#111] border-t border-[#333] flex gap-2">
                <input 
                  type="text" 
                  value={playerInput}
                  onChange={(e) => setPlayerInput(e.target.value)}
                  placeholder="TYPE MESSAGE..."
                  maxLength={50}
                  className="flex-1 bg-black border-2 border-[#333] p-2 text-[10px] text-cyan-400 outline-none focus:border-cyan-500 placeholder:text-gray-700 uppercase"
                />
                <button type="submit" className="px-4 bg-cyan-900/30 border-2 border-cyan-500 text-cyan-400 text-[8px] font-black uppercase hover:bg-cyan-500 hover:text-white transition-all">
                  SEND
                </button>
              </form>
            </div>
          </div>

          {joinedPlayers.length === 16 && (
            <div className="text-center animate-pulse text-yellow-500 font-black uppercase tracking-[0.3em] text-xs py-4">
              Generating Bracket...
            </div>
          )}
        </div>
      )}
    </div>
  );
};
