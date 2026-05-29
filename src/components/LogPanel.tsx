import { ActionLog } from '../engine/types';
import { Skull, Swords, Award, AlertTriangle, ShieldCheck } from 'lucide-react';

interface LogPanelProps {
  logs: ActionLog[];
}

export default function LogPanel({ logs }: LogPanelProps) {
  const getLogIcon = (msg: string) => {
    if (msg.includes('destroyed') || msg.includes('death') || msg.includes('slain')) {
      return <Skull className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    }
    if (msg.includes('attacks') || msg.includes('damage') || msg.includes('strike') || msg.includes('Combat')) {
      return <Swords className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    }
    if (msg.includes('captures') || msg.includes('Victory') || msg.includes('Winner') || msg.includes('won')) {
      return <Award className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    }
    if (msg.includes('Shield') || msg.includes('shielded') || msg.includes('discard')) {
      return <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
    return <AlertTriangle className="w-3.5 h-3.5 text-gray-500 shrink-0" />;
  };

  const getLogColor = (log: ActionLog) => {
    if (log.playerId === 'player-1') return 'text-amber-200 bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/10';
    if (log.playerId === 'ai-1') return 'text-emerald-250 bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10';
    if (log.message.includes('🏆') || log.message.includes('👑')) return 'text-yellow-200 bg-yellow-500/10 border-yellow-500/20';
    return 'text-gray-300 bg-white/5 border-white/5';
  };

  return (
    <div className="flex flex-col h-full bg-black/40 rounded-xl border border-white/10 p-4 font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <h3 className="font-heading font-semibold text-sm text-white uppercase tracking-wider flex items-center">
          📊 Tactical Log Feed
        </h3>
        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400 border border-white/5">
          {logs.length} entries
        </span>
      </div>

      <div className="flex-grow overflow-y-auto space-y-2 pr-1 select-text">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 italic">No events logged yet.</div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              id={`log-entry-${idx}`}
              className={`flex items-start gap-2 relative p-2 px-2.5 rounded-lg border text-[11px] leading-relaxed transition-colors ${getLogColor(log)}`}
            >
              <div className="text-gray-500 text-[10px] select-none shrink-0 pt-0.5">
                [{log.timestamp}]
              </div>
              <div className="pt-0.5 shrink-0">
                {getLogIcon(log.message)}
              </div>
              <div className="flex-grow break-words text-gray-350">
                {log.message}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
