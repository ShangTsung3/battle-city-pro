
import React from 'react';

interface SidebarProps {
  score: number;
  lives: number;
  playerHealth: number;
  onReset: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  score, lives, playerHealth, onReset 
}) => {
  return (
    <div className="bg-[#111] p-4 sm:p-6 lg:p-8 border-4 border-[#222] flex flex-col lg:flex-col gap-4 sm:gap-6 lg:gap-8 h-full font-mono text-white shadow-2xl">
      {/* Score Section */}
      <div className="flex lg:flex-col justify-between lg:justify-start items-center lg:items-start gap-2">
        <div>
          <h3 className="text-[10px] sm:text-xs lg:text-sm text-gray-500 uppercase tracking-widest mb-1 lg:mb-2">Combat Score</h3>
          <p className="text-xl sm:text-2xl lg:text-4xl font-black text-yellow-500 italic">{score.toLocaleString().padStart(7, '0')}</p>
        </div>
        <div className="lg:hidden flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-gray-400 uppercase">HP</span>
            <span className={`font-bold text-base ${playerHealth <= 2 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>{playerHealth}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`w-3 h-5 ${i < lives ? 'bg-orange-600' : 'bg-gray-800'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Stats Section - Desktop */}
      <div className="hidden lg:block space-y-5 xl:space-y-6 bg-black/50 p-5 xl:p-6 border border-white/5 flex-1">
        <div className="flex justify-between items-center py-3 border-b border-white/5 text-yellow-500">
            <span className="text-[10px] xl:text-xs text-gray-400 uppercase">Grand Prize</span>
            <span className="font-black text-base xl:text-lg">10 SOL</span>
        </div>

        <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="text-[10px] xl:text-xs text-gray-400 uppercase">Integrity</span>
            <span className={`font-bold text-lg xl:text-xl ${playerHealth <= 2 ? 'text-red-500 animate-pulse' : 'text-green-500'}`}>{playerHealth} HP</span>
        </div>

        <div className="flex justify-between items-center py-3 border-b border-white/5">
            <span className="text-[10px] xl:text-xs text-gray-400 uppercase">Units Left</span>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={`w-5 h-8 xl:w-6 xl:h-10 ${i < lives ? 'bg-orange-600 shadow-[0_0_12px_rgba(234,88,12,0.6)]' : 'bg-gray-800'}`} />
              ))}
            </div>
        </div>

        {/* HP Bar Visual */}
        <div className="py-3">
          <span className="text-[10px] xl:text-xs text-gray-400 uppercase block mb-3">Health Status</span>
          <div className="w-full h-6 xl:h-8 bg-gray-900 border-2 border-gray-700 relative overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${playerHealth <= 2 ? 'bg-red-600' : playerHealth <= 4 ? 'bg-yellow-600' : 'bg-green-600'}`}
              style={{ width: `${(playerHealth / 10) * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm xl:text-base">{playerHealth}/10</span>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-0 lg:mt-auto flex lg:flex-col gap-3 sm:gap-4">
        <div className="hidden lg:block p-4 xl:p-5 bg-cyan-900/10 border border-cyan-500/20 text-center">
          <p className="text-[9px] xl:text-[10px] text-cyan-400 uppercase leading-relaxed font-bold tracking-wider">
            CHAMPIONSHIP CIRCUIT<br/>PHASE ACTIVE
          </p>
        </div>
        <button onClick={onReset} className="flex-1 lg:w-full py-3 sm:py-4 lg:py-5 bg-red-900/20 border-2 border-red-500/50 text-red-500 text-[9px] sm:text-[10px] lg:text-xs font-black uppercase hover:bg-red-600 hover:text-white transition-all">
          Abort Tournament
        </button>
      </div>
    </div>
  );
};
