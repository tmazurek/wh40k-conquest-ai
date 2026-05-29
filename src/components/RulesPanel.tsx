import { BookOpen, CheckCircle, ShieldCheck, HelpCircle } from 'lucide-react';

export default function RulesPanel() {
  return (
    <div className="bg-black/40 rounded-xl border border-white/10 p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-1">
        <BookOpen className="w-4 h-4 text-amber-500" />
        <h3 className="font-heading font-semibold text-white">Rules & Tactical Guide</h3>
      </div>

      <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
        {/* Victory conditions */}
        <div>
          <h4 className="font-semibold text-amber-500 font-heading mb-1.5 flex items-center gap-1 uppercase tracking-wider text-[11px]">
            <CheckCircle className="w-3.5 h-3.5 text-amber-500" />
            Victory Conditions
          </h4>
          <p className="text-gray-400">
            You win instantly if you slay the enemy Warlord (<span className="text-emerald-400 font-medium">Nazdreg</span> Orks Warlord) OR capture 3 planets that share a planet symbol (Tech, Strongpoint, or Material).
          </p>
        </div>

        {/* Action / Trigger Phases */}
        <div>
          <h4 className="font-semibold text-amber-500 font-heading mb-1.5 flex items-center gap-1 uppercase tracking-wider text-[11px]">
            <CheckCircle className="w-3.5 h-3.5 text-amber-500" />
            Phase Sequences
          </h4>
          <ul className="list-disc pl-4 space-y-1 text-gray-400">
            <li><strong>DEPLOY:</strong> Alternatingly deploy army cards, Supports or play Actions. Keep playing or pass. Once consecutive passes occur, Deployment closes.</li>
            <li><strong>COMMAND STRUGGLE:</strong> Choose secretly which planet your Warlord commits to. Winners are revealed and receive bonuses.</li>
            <li><strong>COMBAT:</strong> Sequentially address planets. Complete Ranged Skirmish first, then complete Melee rounds.</li>
            <li><strong>HQ MAINTENANCE:</strong> Ready forces, earn +4 Resources, and +2 Card Draws. Initiative switches, turn advances!</li>
          </ul>
        </div>

        {/* Shield Logic */}
        <div>
          <h4 className="font-semibold text-amber-500 font-heading mb-1.5 flex items-center gap-1 uppercase tracking-wider text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            3-Step Shields
          </h4>
          <p className="text-gray-400">
            When attacking, defender matches ATK against targets. Defender can optionally discard 1 shield card from hand to absorbs damage equal to shields count.
            <em className="block mt-1 text-[10px] text-red-400">Exception: Armorbane keyword cancels shield absorbtion completely!</em>
          </p>
        </div>

        {/* Keyword Reference info */}
        <div className="border-t border-white/5 pt-3">
          <h4 className="font-semibold text-gray-300 font-heading mb-1.5 flex items-center gap-1 uppercase tracking-wider text-[10px]">
            <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
            Keywords Reference
          </h4>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
            <div className="p-2 bg-black/20 rounded border border-white/5">
              <strong className="text-yellow-500 uppercase font-bold block mb-0.5 tracking-wide">Ranged</strong>
              Attacks early during Ranged step.
            </div>
            <div className="p-2 bg-black/20 rounded border border-white/5">
              <strong className="text-yellow-500 uppercase font-bold block mb-0.5 tracking-wide">Brutal</strong>
              ATK is boosted by damage counters on itself (+1 per dot).
            </div>
            <div className="p-2 bg-black/20 rounded border border-white/5">
              <strong className="text-yellow-500 uppercase font-bold block mb-0.5 tracking-wide">Armorbane</strong>
              Prevents target from discarding shield cards.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
