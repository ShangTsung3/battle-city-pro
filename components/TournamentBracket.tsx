
import React, { useState, useEffect } from 'react';
import { TournamentState, TournamentMatch } from '../types';

interface BracketProps {
  tournament: TournamentState;
  playerName: string;
}

const STATUS_MESSAGES = ["Simulating other matches...", "Syncing pilot data...", "Broadcasting live combat...", "Updating ladder..."];

export const TournamentBracket: React.FC<BracketProps> = ({ tournament, playerName }) => {
  const [waitProgress, setWaitProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    let pi: number, si: number;
    if (tournament.waitingForOpponent) {
      setWaitProgress(0); setStatusIdx(0);
      pi = window.setInterval(() => setWaitProgress(p => Math.min(p + 1.6, 100)), 100);
      si = window.setInterval(() => setStatusIdx(p => (p + 1) % STATUS_MESSAGES.length), 1500);
    }
    return () => { clearInterval(pi); clearInterval(si); };
  }, [tournament.waitingForOpponent]);

  const renderMatch = (match: TournamentMatch) => {
    const isPlayer = match.player1 === playerName || match.player2 === playerName;
    return (
      <div key={match.id} className={`border p-2 mb-2 w-36 text-[6px] transition-all bg-black/80 ${isPlayer ? 'border-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'border-gray-800 opacity-60'}`}>
        <div className="flex justify-between items-center mb-1">
          <span className={match.winner === match.player1 ? 'text-yellow-500 font-bold' : 'text-gray-400'}>{match.player1.substring(0, 10)}</span>
          {match.winner === match.player1 && <span className="text-[5px]">W</span>}
        </div>
        <div className="h-[1px] bg-white/10 my-1" />
        <div className="flex justify-between items-center">
          <span className={match.winner === match.player2 ? 'text-yellow-500 font-bold' : 'text-gray-400'}>{match.player2.substring(0, 10)}</span>
          {match.winner === match.player2 && <span className="text-[5px]">W</span>}
        </div>
      </div>
    );
  };

  const rounds = [
    { name: 'R-32', prefix: 'r32' },
    { name: 'R-16', prefix: 'r16' },
    { name: 'QUARTERS', prefix: 'q' },
    { name: 'SEMIS', prefix: 's' },
    { name: 'FINALS', prefix: 'f' }
  ];

  return (
    <div className="flex flex-col items-center gap-6 bg-[#0a0a0a] p-8 border-4 border-[#222] shadow-[0_0_40px_rgba(0,0,0,0.8)] max-w-full relative overflow-hidden">
      <div className="absolute top-2 right-2 border-2 border-yellow-500 text-yellow-500 px-2 py-1 text-[7px] font-black uppercase rotate-12">
        Reward: 10 SOL
      </div>
      <h2 className="text-lg text-yellow-500 font-black tracking-widest uppercase italic">Championship Ladder</h2>
      <div className="flex gap-4 items-start overflow-x-auto pb-4 max-w-full no-scrollbar">
        {rounds.map((round, idx) => (
          <div key={round.name} className={`flex flex-col min-w-[150px] ${idx > 0 ? 'mt-' + (idx * 4) : ''}`} style={{ marginTop: `${idx * 20}px` }}>
            <p className="text-[8px] text-gray-500 mb-2 text-center font-bold border-b border-gray-800 pb-1">{round.name}</p>
            <div className="flex flex-col">
              {tournament.matches.filter(m => m.id.startsWith(round.prefix)).map(renderMatch)}
            </div>
          </div>
        ))}
      </div>
      {tournament.waitingForOpponent && (
        <div className="w-full max-w-md p-4 bg-cyan-950/20 border border-cyan-500/30 text-center animate-pulse">
            <p className="text-[8px] text-cyan-400 uppercase mb-2 tracking-widest">{STATUS_MESSAGES[statusIdx]}</p>
            <div className="w-full h-1 bg-gray-900 overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${waitProgress}%` }} /></div>
        </div>
      )}
    </div>
  );
};
