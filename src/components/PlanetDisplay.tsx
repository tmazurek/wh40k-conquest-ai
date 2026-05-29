import React, { useState, useEffect } from 'react';
import { Planet, CardInstance, GameState } from '../engine/types';
import { Globe, FileText, Eye, Sparkles } from 'lucide-react';
import CardDisplay from './CardDisplay';

const CATO_SICARIUS_CARD = {
  id: 'sm-cato',
  name: 'Captain Cato Sicarius',
  type: 'Warlord',
  faction: 'Space Marines',
  cost: 0,
  commandIcons: 2,
  attack: 2,
  hp: 6,
  shields: 0,
  traits: ['Astartes', 'Warrior', 'Ultramarines'],
  keywords: [],
  description: 'Reaction: Whenever an enemy unit is destroyed at this planet, you gain 1 Resource.',
  conquestCardId: '01001'
};

const NAZDREG_CARD = {
  id: 'ork-nazdreg',
  name: 'Nazdreg',
  type: 'Warlord',
  faction: 'Orks',
  cost: 0,
  commandIcons: 2,
  attack: 2,
  hp: 6,
  shields: 0,
  traits: ['Goff', 'Warboss'],
  keywords: ['Brutal'],
  description: 'Brutal. Constant: Each other friendly Ork unit at this Warlord’s planet gains Brutal.',
  conquestCardId: '01053'
};

import atroxPrimeImg from './card-images/planets/Atrox_Prime.jpg';
import barlusImg from './card-images/planets/Barlus.jpg';
import carnathImg from './card-images/planets/Carnath.jpg';
import elouithImg from './card-images/planets/Elouith.jpg';
import ferrinImg from './card-images/planets/Ferrin.jpg';
import iridialImg from './card-images/planets/Iridial.jpg';
import osusIvImg from './card-images/planets/Osus_IV.jpg';
import tarrusImg from './card-images/planets/Tarrus.jpg';
import yvarnImg from "./card-images/planets/Y'varn.jpg";

const LOCAL_PLANET_IMAGES: Record<string, string> = {
  'Atrox Prime': atroxPrimeImg,
  'Barlus': barlusImg,
  'Carnath': carnathImg,
  'Elouith': elouithImg,
  'Elouira': elouithImg,
  'Ferrin': ferrinImg,
  'Iridial': iridialImg,
  'Osus IV': osusIvImg,
  'Osiris': osusIvImg,
  'Tarrus': tarrusImg,
  'Y\'varn': yvarnImg,
};

interface PlanetDisplayProps {
  key?: string | number;
  planet: Planet;
  index: number;
  gameState: GameState;
  p1Command: number;
  aiCommand: number;
  isUnderConflict: boolean;
  hasP1Warlord: boolean;
  hasAiWarlord: boolean;
  smHere: CardInstance[];
  orkHere: CardInstance[];
  selectedAttackerId: string | null;
  handleDeclareAttackTarget: (targetId: string) => void;
  handleStartCombatClick: (attackerId: string) => void;
  handleRetreatClick: (unitInstanceId: string) => void;
}

export default function PlanetDisplay({
  planet,
  index,
  gameState,
  p1Command,
  aiCommand,
  isUnderConflict,
  hasP1Warlord,
  hasAiWarlord,
  smHere,
  orkHere,
  selectedAttackerId,
  handleDeclareAttackTarget,
  handleStartCombatClick,
  handleRetreatClick,
}: PlanetDisplayProps) {
  const [viewMode, setViewMode] = useState<'image' | 'text'>('image');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [planet.id]);

  const [isHovered, setIsHovered] = useState(false);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const offsetX = 15;
    const offsetY = -160;
    let x = e.clientX + offsetX;
    let y = e.clientY + offsetY;

    if (x + 300 > window.innerWidth) {
      x = e.clientX - 305;
    }
    if (y + 420 > window.innerHeight) {
      y = window.innerHeight - 425;
    }
    if (y < 10) {
      y = 10;
    }
    setHoverPosition({ x, y });
  };

  const [hoveredUnit, setHoveredUnit] = useState<any>(null);
  const [unitHoverPosition, setUnitHoverPosition] = useState({ x: 0, y: 0 });

  const handleUnitMouseEnter = (unit: any) => {
    setHoveredUnit(unit);
  };

  const handleUnitMouseLeave = () => {
    setHoveredUnit(null);
  };

  const handleUnitMouseMove = (e: React.MouseEvent) => {
    const offsetX = 15;
    const offsetY = -160;
    let x = e.clientX + offsetX;
    let y = e.clientY + offsetY;

    if (x + 300 > window.innerWidth) {
      x = e.clientX - 305;
    }
    if (y + 420 > window.innerHeight) {
      y = window.innerHeight - 425;
    }
    if (y < 10) {
      y = 10;
    }
    setUnitHoverPosition({ x, y });
  };

  const localImageUrl = LOCAL_PLANET_IMAGES[planet.name];

  const rawImageUrl = planet.conquestCardId
    ? `https://www.conquestdb.com/allowed/cards/${planet.conquestCardId}.png`
    : null;
  const externalImageUrl = rawImageUrl
    ? `https://images.weserv.nl/?url=${encodeURIComponent(rawImageUrl.replace(/^https?:\/\//, ''))}`
    : null;

  const imageUrl = localImageUrl || externalImageUrl;

  const handleImageError = () => {
    setImageError(true);
    setViewMode('text');
  };

  const hasImage = imageUrl && !imageError;

  // Outer container border color and background depending on battle state
  const isCapturedByP1 = planet.capturedBy === 'player-1';
  const isCapturedByAi = planet.capturedBy === 'ai-1';

  const borderClass =
    isUnderConflict ? 'border-red-500/40 ring-1 ring-red-500/20 shadow-lg shadow-red-500/5' :
    isCapturedByP1 ? 'border-amber-500/15 bg-amber-950/[0.04]' :
    isCapturedByAi ? 'border-red-950/20 bg-red-950/[0.04]' : 'border-white/5 hover:border-white/10';

  return (
    <>
      <div
        id={`planet-display-${planet.id}`}
        className={`bg-zinc-950/65 border rounded-2xl flex flex-col p-3 min-h-[440px] min-w-[215px] max-w-[230px] justify-between space-y-2.5 transition-all duration-300 relative ${borderClass}`}
      >
      {/* 1. SECTOR HEADER STATUS BAR */}
      <div className="flex justify-between items-center text-[9px] font-mono tracking-wider text-gray-500 uppercase pb-1.5 border-b border-white/5">
        <span className="flex items-center gap-1">
          <Globe className={`w-3 h-3 ${isUnderConflict ? 'text-red-500 animate-spin-slow' : 'text-gray-600'}`} />
          Sector 0{index + 1}
        </span>
        
        {isUnderConflict ? (
          <span className="flex items-center gap-1 text-red-500 font-bold animate-pulse">
            <span className="w-1 h-1 rounded-full bg-red-500" /> COMBAT READY
          </span>
        ) : isCapturedByP1 ? (
          <span className="text-amber-500 font-bold tracking-tight">SECURED P1</span>
        ) : isCapturedByAi ? (
          <span className="text-red-400 font-bold tracking-tight">SECURED AI</span>
        ) : planet.isFirstPlanet ? (
          <span className="text-red-400 font-bold uppercase text-[8px] px-1 bg-red-950/50 rounded-sm border border-red-900/40 animate-pulse-slow">
            First Line
          </span>
        ) : (
          <span className="text-gray-600">STABLE</span>
        )}
      </div>

      {/* 2. TOP FORCES PANEL (ORK AI FORCES) */}
      <div className="flex flex-col min-h-[60px] max-h-[85px] bg-red-950/[0.05] border border-red-500/[0.03] rounded-lg p-1.5">
        <div className="flex items-center justify-between text-[8px] text-red-500/80 tracking-widest uppercase font-mono mb-1 font-semibold">
          <span>ORK AI FORCES</span>
          <span>({orkHere.length + (hasAiWarlord ? 1 : 0)})</span>
        </div>

        <div className="space-y-1 overflow-y-auto flex-grow pr-0.5 scrollbar-thin scrollbar-thumb-white/5">
          {/* Nazdreg Warlord if committed here */}
          {hasAiWarlord && (
            <div 
              onMouseEnter={() => handleUnitMouseEnter(NAZDREG_CARD)}
              onMouseLeave={handleUnitMouseLeave}
              onMouseMove={handleUnitMouseMove}
              className="flex items-center justify-between p-1 bg-gradient-to-r from-red-950/30 to-red-900/10 border border-red-900/30 rounded text-[9px] shadow-sm animate-pulse-slow cursor-pointer"
            >
              <span className="font-serif italic text-red-400 font-bold flex items-center gap-1">
                🪓 Nazdreg <span className="text-[6.5px] text-red-500 not-italic font-sans font-bold uppercase tracking-widest px-1 bg-red-950 rounded-sm border border-red-800/20">Warlord</span>
              </span>
              <span className="text-red-400 font-mono font-medium text-[8px]">ACTIVE</span>
            </div>
          )}

          {/* Standard Units */}
          {orkHere.map(u => (
            <div
              key={u.instanceId}
              onMouseEnter={() => handleUnitMouseEnter(u)}
              onMouseLeave={handleUnitMouseLeave}
              onMouseMove={handleUnitMouseMove}
              onClick={() => {
                // Designate combat targets
                if (selectedAttackerId && isUnderConflict) {
                  handleDeclareAttackTarget(u.instanceId);
                }
              }}
              className={`flex items-center justify-between p-1.5 bg-red-950/10 rounded border border-red-900/10 text-[9.5px] hover:bg-red-950/25 hover:border-red-500/20 transition-all cursor-pointer ${
                selectedAttackerId ? 'ring-1 ring-red-500/30 animate-pulse bg-red-950/20' : ''
              }`}
              title={`${u.name}: Click to elect as target`}
            >
              <span className="truncate flex-grow text-gray-300 font-sans pr-1" title={u.name}>
                {u.name}
              </span>
              <span className="text-red-400 font-mono shrink-0 font-bold">
                {u.hp - u.damage}❤️
              </span>
            </div>
          ))}

          {!hasAiWarlord && orkHere.length === 0 && (
            <div className="text-center py-2 text-[8px] text-gray-700 italic font-mono uppercase tracking-wider">
              Sector Vacant
            </div>
          )}
        </div>
      </div>

      {/* 3. CENTERPIECE: TACTICAL PORTRAIT PLANET CARD (RENDERED IN HORIZONTAL LANDSCAPE ASPECT) */}
      <div 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        className={`relative aspect-[3/2] w-[185px] mx-auto rounded-xl border overflow-hidden shadow-lg transition-all duration-300 group ${
          isUnderConflict ? 'border-red-500/40 ring-1 ring-red-550/20 shadow-red-500/10 scale-102 font-bold' : 
          isCapturedByP1 ? 'border-amber-500/30' :
          isCapturedByAi ? 'border-red-500/20 bg-red-950/5' : 'border-white/10 hover:border-white/20'
        } cursor-zoom-in`}
      >
        {hasImage && viewMode === 'image' ? (
          /* UN-CROPPED OFFICIAL FULL PLANET CARD ART (MAPS 2:3 IMAGE FILE ROTATED INTO 3:2 LANDSCAPE PERFECTLY) */
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <img
              src={imageUrl!}
              alt={planet.name}
              className="absolute top-1/2 left-1/2 w-[66.6%] h-[150%] -translate-x-1/2 -translate-y-1/2 -rotate-90 object-cover origin-center transition-transform duration-500 group-hover:scale-[1.04]"
              onError={handleImageError}
              referrerPolicy="no-referrer"
            />
            {/* Visual Captured overlays painted directly on the cards */}
            {isCapturedByP1 && (
              <div className="absolute inset-x-0 bottom-0 py-1 bg-amber-500/90 text-black text-center font-mono font-bold text-[8.5px] tracking-wider uppercase backdrop-blur-[0.5px] z-10">
                🏆 Secured by Imperium
              </div>
            )}
            {isCapturedByAi && (
              <div className="absolute inset-x-0 bottom-0 py-1 bg-[#991b1b] text-white text-center font-mono font-bold text-[8.5px] tracking-wider uppercase backdrop-blur-[0.5px] z-10">
                🪓 Secured by Waaagh
              </div>
            )}

            {/* Quick click toggle button hovering in top-right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewMode('text');
              }}
              title="See technical properties monitor"
              className="absolute top-2 right-2 p-1 rounded-md bg-black/65 hover:bg-black/90 border border-white/10 text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-15"
            >
              <FileText className="w-3 h-3" />
            </button>
          </div>
        ) : (
          /* HIGH-CONTRAST DIGITAL STATS MONITOR VIEW SHRUNK TO FIT LANDSCAPE CARD CONTAINER */
          <div className="p-2 h-full flex flex-col justify-between relative bg-[#09090b] text-white">
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[7px] text-gray-500 font-mono tracking-widest uppercase">
                <span>Sector 0{index + 1} Monitor</span>
                {planet.isFirstPlanet && !planet.capturedBy && (
                  <span className="text-[7px] text-red-405 border border-red-900/50 px-1 rounded-sm tracking-normal animate-pulse">
                    FRONT LINE
                  </span>
                )}
              </div>
              <h4 className="font-serif italic font-extrabold text-[10.5px] tracking-tight text-white leading-none">
                {planet.name}
              </h4>

              {/* Resource Rewards display */}
              <div className="bg-white/[0.02] py-0.5 px-1 rounded border border-white/5 text-center">
                <span className="text-[6.5px] text-gray-500 uppercase tracking-tight font-mono block">Conquest Loot</span>
                <span className="font-bold text-[8.5px] text-amber-500 tracking-wider">
                  💎 +{planet.materials} Mat  |  🃏 +{planet.cards} Crd
                </span>
              </div>
            </div>

            {/* Planet Symbols Icons */}
            <div className="flex flex-wrap gap-1 justify-center py-0.5 border-t border-white/5">
              {planet.symbols.map(sym => (
                <span
                  key={sym}
                  className={`text-[6.5px] px-1 py-0.1 rounded-sm border inline-block tracking-wider uppercase font-mono ${
                    sym === 'Tech' ? 'bg-cyan-950/30 text-cyan-400 border-cyan-800/15' :
                    sym === 'Strongpoint' ? 'bg-blue-950/30 text-blue-400 border-blue-800/15' :
                    'bg-rose-950/30 text-rose-455 border-rose-800/15'
                  }`}
                >
                  {sym}
                </span>
              ))}
            </div>

            {/* Image toggle button inside text view */}
            {hasImage && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('image');
                }}
                title="Restore physical card view"
                className="absolute top-1.5 right-1.5 p-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer z-10"
              >
                <Eye className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. BOTTOM FORCES PANEL (PLAYER 1 SPACE MARINES) */}
      <div className="flex flex-col min-h-[60px] max-h-[85px] bg-amber-500/[0.02] border border-amber-500/[0.03] rounded-lg p-1.5 pt-2">
        <div className="flex items-center justify-between text-[8px] text-sky-450 tracking-widest uppercase font-mono mb-1 font-semibold">
          <span>YOUR FORCE</span>
          <span>({smHere.length + (hasP1Warlord ? 1 : 0)})</span>
        </div>

        <div className="space-y-1 overflow-y-auto flex-grow pr-0.5 scrollbar-thin scrollbar-thumb-white/5">
          {/* Cato Sicarius Warlord if committed here */}
          {hasP1Warlord && (
            <div 
              onMouseEnter={() => handleUnitMouseEnter(CATO_SICARIUS_CARD)}
              onMouseLeave={handleUnitMouseLeave}
              onMouseMove={handleUnitMouseMove}
              className="flex items-center justify-between p-1 bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded text-[9px] shadow-sm animate-pulse-slow cursor-pointer"
            >
              <span className="font-serif italic text-amber-450 font-bold flex items-center gap-1">
                👑 Cato Sicarius <span className="text-[6.5px] text-amber-500 not-italic font-sans font-bold uppercase tracking-widest px-1 bg-amber-950 rounded-sm border border-amber-800/20">Warlord</span>
              </span>
              <span className="text-amber-500 font-mono font-medium text-[8px]">ACTIVE</span>
            </div>
          )}

          {/* Standard Units */}
          {smHere.map(u => (
            <div
              key={u.instanceId}
              onMouseEnter={() => handleUnitMouseEnter(u)}
              onMouseLeave={handleUnitMouseLeave}
              onMouseMove={handleUnitMouseMove}
              onClick={() => {
                // Player active attack selecting
                if (gameState.phase === 'COMBAT' && isUnderConflict && gameState.activePlayerId === 'player-1') {
                  if (gameState.combat.subPhase === 'MELEE' && !u.isExhausted) {
                    handleStartCombatClick(u.instanceId);
                  } else if (gameState.combat.subPhase === 'RETREAT' && !u.isExhausted) {
                    handleRetreatClick(u.instanceId);
                  }
                }
              }}
              className={`flex items-center justify-between p-1.5 bg-white/5 rounded border border-white/5 text-[9.5px] hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer ${
                selectedAttackerId === u.instanceId ? 'ring-1 ring-amber-400 bg-amber-500/10' : ''
              } ${u.isExhausted ? 'opacity-35 cursor-not-allowed' : ''}`}
              title={`${u.name}${u.isExhausted ? ' (Exhausted)' : ''}: Click to execute action`}
            >
              <span className={`truncate flex-grow font-sans pr-1 ${u.isExhausted ? 'text-gray-500 line-through' : 'text-gray-300'}`} title={u.name}>
                {u.name}
              </span>
              <span className="text-green-450 font-mono shrink-0 font-bold">
                {u.hp - u.damage}❤️
              </span>
            </div>
          ))}

          {!hasP1Warlord && smHere.length === 0 && (
            <div className="text-center py-2 text-[8px] text-gray-700 italic font-mono uppercase tracking-wider">
              Sector Vacant
            </div>
          )}
        </div>
      </div>
    </div>

    {isHovered && (
      <div
        className="fixed pointer-events-none z-[9999] shadow-2xl transition-opacity duration-200 bg-zinc-950/95 border border-white/10 rounded-2xl w-96 h-64 overflow-hidden flex flex-col justify-between p-4"
        style={{
          left: `${hoverPosition.x}px`,
          top: `${hoverPosition.y}px`,
        }}
      >
        {hasImage && viewMode === 'image' ? (
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <img
              src={imageUrl!}
              alt={planet.name}
              className="absolute top-1/2 left-1/2 w-[66.6%] h-[150%] -translate-x-1/2 -translate-y-1/2 -rotate-90 object-cover origin-center"
              referrerPolicy="no-referrer"
            />
            {/* Captured tags over image */}
            {isCapturedByP1 && (
              <div className="absolute inset-x-0 bottom-0 py-2 bg-amber-500/95 text-black text-center font-mono font-bold text-xs tracking-wider uppercase backdrop-blur-[0.5px] z-10">
                🏆 Secured by Imperium (Player 1)
              </div>
            )}
            {isCapturedByAi && (
              <div className="absolute inset-x-0 bottom-0 py-2 bg-[#991b1b]/95 text-white text-center font-mono font-bold text-xs tracking-wider uppercase backdrop-blur-[0.5px] z-10">
                🪓 Secured by Waaagh (AI)
              </div>
            )}
            
            {/* Visual Title Header overlay for premium look */}
            <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 to-transparent p-3 flex flex-col z-10">
              <span className="text-[9px] text-amber-500 font-mono uppercase tracking-widest leading-none">Sector 0{index + 1}</span>
              <h4 className="text-white font-serif italic font-extrabold text-sm tracking-tight">{planet.name}</h4>
            </div>

            {/* Quick materials badge floating on bottom-right/bottom-left */}
            <div className="absolute bottom-3 right-3 flex flex-col gap-1 items-end z-10">
              <span className="bg-black/85 border border-white/15 rounded px-2 py-0.5 text-[8.5px] font-mono text-gray-300">
                💎 {planet.materials} Materials
              </span>
              <span className="bg-black/85 border border-white/15 rounded px-2 py-0.5 text-[8.5px] font-mono text-gray-300">
                🃏 {planet.cards} Cards
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full justify-between">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[9px] text-gray-500 font-mono tracking-widest uppercase pb-1.5 border-b border-white/10">
                <span>Sector 0{index + 1} Monitor</span>
                {planet.isFirstPlanet && !planet.capturedBy && (
                  <span className="text-[8px] text-red-400 border border-red-900/50 px-1.5 py-0.2 rounded tracking-normal animate-pulse">
                    FRONT LINE
                  </span>
                )}
              </div>
              <h4 className="font-serif italic font-extrabold text-base tracking-tight text-white leading-tight">
                {planet.name}
              </h4>

              {/* Resource Rewards display */}
              <div className="bg-white/[0.03] p-2 rounded-lg border border-white/10 text-center mt-1">
                <span className="text-[8px] text-gray-400 uppercase tracking-wider font-mono block mb-0.5">Conquest Loot</span>
                <span className="font-bold text-xs text-amber-500 tracking-wider">
                  💎 +{planet.materials} Materials   |   🃏 +{planet.cards} Card Draws
                </span>
              </div>

              {/* Command value tally display */}
              <div className="grid grid-cols-2 gap-2 text-[9px] font-mono mt-2">
                <div className="bg-black/40 p-2 rounded-md border border-white/5 text-center">
                  <span className="text-[7px] text-amber-500 uppercase block tracking-wider mb-0.5">P1 Command</span>
                  <span className="font-extrabold text-[#f59e0b] text-xs">{p1Command}</span>
                </div>
                <div className="bg-black/40 p-2 rounded-md border border-white/5 text-center">
                  <span className="text-[7px] text-green-500 uppercase block tracking-wider mb-0.5">AI Command</span>
                  <span className="font-extrabold text-[#22c55e] text-xs">{aiCommand}</span>
                </div>
              </div>
            </div>

            {/* Planet Symbols Icons */}
            <div className="flex flex-wrap gap-1.5 justify-center py-2 border-t border-white/5">
              {planet.symbols.map(sym => (
                <span
                  key={sym}
                  className={`text-[8px] px-2 py-0.5 rounded border inline-block tracking-wider uppercase font-mono ${
                    sym === 'Tech' ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/30' :
                    sym === 'Strongpoint' ? 'bg-blue-950/40 text-blue-400 border-blue-800/30' :
                    'bg-rose-950/40 text-rose-455 border-rose-800/30'
                  }`}
                >
                  {sym}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    )}

    {hoveredUnit && (
      <div
        className="fixed pointer-events-none z-[9999] shadow-2xl transition-opacity duration-200"
        style={{
          left: `${unitHoverPosition.x}px`,
          top: `${unitHoverPosition.y}px`,
        }}
      >
        <CardDisplay
          card={hoveredUnit}
          canPlay={false}
          size="lg"
        />
      </div>
    )}
  </>
);
}

