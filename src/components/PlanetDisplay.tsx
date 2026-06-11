import React, { useState, useEffect } from 'react';
import { Planet, CardInstance, GameState } from '../engine/types';
import { Globe, FileText, Eye, Sparkles } from 'lucide-react';
import CardDisplay from './CardDisplay';
import { getUnitAdjustedAttack, getUnitAdjustedHp } from '../engine/gameLogic';

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

import atroxPrimeImg from './card-images/CardImages/Atrox_Prime.jpg';
import barlusImg from './card-images/CardImages/Barlus.jpg';
import carnathImg from './card-images/CardImages/Carnath.jpg';
import elouithImg from './card-images/CardImages/Elouith.jpg';
import ferrinImg from './card-images/CardImages/Ferrin.jpg';
import iridialImg from './card-images/CardImages/Iridial.jpg';
import osusIvImg from './card-images/CardImages/Osus_IV.jpg';
import tarrusImg from './card-images/CardImages/Tarrus.jpg';
import yvarnImg from "./card-images/CardImages/Y'varn.jpg";

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
  selectedHQCardId: string | null;
  setSelectedHQCardId: (id: string | null) => void;
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
  selectedHQCardId,
  setSelectedHQCardId,
}: PlanetDisplayProps) {
  const [viewMode, setViewMode] = useState<'image' | 'text'>('image');
  const [imageError, setImageError] = useState(false);

  const aiWarlordInstance = gameState.players['ai-1'].hq.find(u => u.type === 'Warlord');
  const aiWarlordHp = aiWarlordInstance ? getUnitAdjustedHp(gameState, aiWarlordInstance) - aiWarlordInstance.damage : 6;

  const p1WarlordInstance = gameState.players['player-1'].hq.find(u => u.type === 'Warlord');
  const p1WarlordHp = p1WarlordInstance ? getUnitAdjustedHp(gameState, p1WarlordInstance) - p1WarlordInstance.damage : 6;

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
      <div className="flex flex-col items-center space-y-2 shrink-0 min-w-[215px] max-w-[230px]">
            {/* 2. TOP FORCES PANEL (ORK AI FORCES) */}
      <div className="flex flex-wrap justify-center gap-1.5 min-h-[45px] w-full bg-red-950/10 border border-red-900/10 rounded-xl p-1.5 items-center">
        {hasAiWarlord && (
          <div 
            onMouseEnter={() => handleUnitMouseEnter(NAZDREG_CARD)}
            onMouseLeave={handleUnitMouseLeave}
            onMouseMove={handleUnitMouseMove}
            onClick={() => {
              if (aiWarlordInstance && selectedAttackerId && isUnderConflict) {
                handleDeclareAttackTarget(aiWarlordInstance.instanceId);
              }
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-red-950/70 to-red-900/40 border border-red-900/50 rounded-lg text-[9px] shadow-sm animate-pulse-slow cursor-pointer text-red-400 font-bold shrink-0 transition-all ${
              selectedAttackerId ? 'ring-1 ring-red-500 animate-pulse bg-red-950/20' : ''
            } ${aiWarlordInstance && aiWarlordInstance.isExhausted ? 'opacity-35 cursor-not-allowed' : ''}`}
          >
            👑 Nazdreg (W)
            <span className="text-red-400 font-bold font-mono text-[8.5px] ml-1 flex items-center">⚔️{aiWarlordInstance ? getUnitAdjustedAttack(gameState, aiWarlordInstance) : 2}</span>
            <span className="text-green-400 font-bold font-mono text-[8.5px] flex items-center">❤️{aiWarlordHp}</span>
            <span className="text-cyan-400 font-bold font-mono text-[8.5px] flex items-center">🔨2</span>
          </div>
        )}

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
            className={`flex items-center gap-1 px-1.5 py-0.5 bg-red-950/40 border border-red-900/30 rounded-lg text-[9px] text-gray-300 font-sans cursor-pointer hover:bg-red-900/50 transition-all shrink-0 ${
              selectedAttackerId ? 'ring-1 ring-red-500 animate-pulse bg-red-950/20' : ''
            }`}
            title={`${u.name}: Click to elect as target`}
          >
            <span className="truncate max-w-[50px] font-medium">{u.name.split(' ').slice(-1)}</span>
            <span className="text-red-400 font-bold font-mono text-[8.5px] flex items-center">⚔️{getUnitAdjustedAttack(gameState, u)}</span>
            <span className="text-green-400 font-bold font-mono text-[8.5px] flex items-center">❤️{getUnitAdjustedHp(gameState, u) - u.damage}</span>
            {u.commandIcons > 0 && (
              <span className="text-cyan-400 font-bold font-mono text-[8.5px] flex items-center">🔨{u.commandIcons}</span>
            )}
          </div>
        ))}

        {!hasAiWarlord && orkHere.length === 0 && (
          <span className="text-[7.5px] text-gray-650 font-mono tracking-wider uppercase">VACANT</span>
        )}
      </div>

      {/* CENTRAL PLANET CARD PORTRAIT CONTAINER */}
      <div
        id={`planet-display-${planet.id}`}
        className={`bg-zinc-950/65 border rounded-2xl flex flex-col p-2.5 min-h-[190px] w-full justify-between space-y-2 transition-all duration-300 relative ${borderClass}`}
      >
        {/* 1. SECTOR HEADER STATUS BAR */}
        <div className="flex justify-between items-center text-[9px] font-mono tracking-wider text-gray-500 uppercase pb-1 border-b border-white/5">
          <span className="flex items-center gap-1">
            <Globe className={`w-3 h-3 ${isUnderConflict ? 'text-red-500 animate-spin-slow' : 'text-gray-650'}`} />
            Sector 0{index + 1}
          </span>
          
          {isUnderConflict ? (
            <span className="flex items-center gap-1 text-red-500 font-bold animate-pulse">
              COMBAT READY
            </span>
          ) : isCapturedByP1 ? (
            <span className="text-amber-500 font-bold tracking-tight">SECURED P1</span>
          ) : isCapturedByAi ? (
            <span className="text-red-450 font-bold tracking-tight">SECURED AI</span>
          ) : planet.isFirstPlanet ? (
            <span className="text-red-405 font-bold uppercase text-[7.5px] px-1 bg-red-950/50 rounded-sm border border-red-900/40 animate-pulse-slow">
              First Line
            </span>
          ) : (
            <span className="text-gray-600">STABLE</span>
          )}
        </div>

        {/* 3. CENTERPIECE: TACTICAL PORTRAIT PLANET CARD */}
        <div 
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          className={`relative aspect-[3/2] w-full rounded-xl border overflow-hidden shadow-lg transition-all duration-300 group ${
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
                <div className="absolute inset-x-0 bottom-0 py-1 bg-amber-500/90 text-black text-center font-mono font-bold text-[8px] tracking-wider uppercase backdrop-blur-[0.5px] z-10">
                  🏆 Secured by Imperium
                </div>
              )}
              {isCapturedByAi && (
                <div className="absolute inset-x-0 bottom-0 py-1 bg-[#991b1b] text-white text-center font-mono font-bold text-[8px] tracking-wider uppercase backdrop-blur-[0.5px] z-10">
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
                className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/65 hover:bg-black/90 border border-white/10 text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer z-15"
              >
                <FileText className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            /* HIGH-CONTRAST DIGITAL STATS MONITOR VIEW SHRUNK TO FIT LANDSCAPE CARD CONTAINER */
            <div className="p-2 h-full flex flex-col justify-between relative bg-[#09090b] text-white">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[6.5px] text-gray-500 font-mono tracking-widest uppercase">
                  <span>Sector 0{index + 1} Monitor</span>
                  {planet.isFirstPlanet && !planet.capturedBy && (
                    <span className="text-[6.5px] text-red-405 border border-red-900/50 px-1 rounded-sm tracking-normal animate-pulse">
                      FRONT LINE
                    </span>
                  )}
                </div>
                <h4 className="font-serif italic font-extrabold text-[10px] tracking-tight text-white leading-none">
                  {planet.name}
                </h4>

                {/* Resource Rewards display */}
                <div className="bg-white/[0.02] py-0.5 px-1 rounded border border-white/5 text-center">
                  <span className="text-[6px] text-gray-550 uppercase tracking-tight font-mono block">Conquest Loot</span>
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
                    className={`text-[6px] px-1 py-0.1 rounded-sm border inline-block tracking-wider uppercase font-mono ${
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
                  className="absolute top-1 right-1 p-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer z-10"
                >
                  <Eye className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. BOTTOM FORCES PANEL (PLAYER 1 SPACE MARINES) */}
      <div className="flex flex-wrap justify-center gap-1.5 min-h-[45px] w-full bg-amber-500/[0.02] border border-white/5 rounded-xl p-1.5 items-center">
        {hasP1Warlord && (
          <div 
            onMouseEnter={() => handleUnitMouseEnter(CATO_SICARIUS_CARD)}
            onMouseLeave={handleUnitMouseLeave}
            onMouseMove={handleUnitMouseMove}
            onClick={() => {
              if (p1WarlordInstance) {
                setSelectedHQCardId(selectedHQCardId === p1WarlordInstance.instanceId ? null : p1WarlordInstance.instanceId);
                if (gameState.phase === 'COMBAT' && isUnderConflict && gameState.activePlayerId === 'player-1') {
                  if (gameState.combat.subPhase === 'MELEE' && !p1WarlordInstance.isExhausted) {
                    handleStartCombatClick(p1WarlordInstance.instanceId);
                  } else if (gameState.combat.subPhase === 'RETREAT' && !p1WarlordInstance.isExhausted) {
                    handleRetreatClick(p1WarlordInstance.instanceId);
                  }
                }
              }
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 bg-gradient-to-r from-amber-550/40 to-amber-500/15 border border-amber-500/30 rounded-lg text-[9px] shadow-sm animate-pulse-slow cursor-pointer text-amber-500 font-bold shrink-0 transition-all ${
              p1WarlordInstance && selectedAttackerId === p1WarlordInstance.instanceId ? 'ring-1 ring-amber-400 bg-amber-500/10 animate-pulse' : ''
            } ${
              p1WarlordInstance && selectedHQCardId === p1WarlordInstance.instanceId ? 'ring-2 ring-purple-500 bg-purple-950/20 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : ''
            } ${p1WarlordInstance && p1WarlordInstance.isExhausted ? 'opacity-35 cursor-not-allowed' : ''}`}
          >
            👑 Cato (W)
            <span className="text-red-400 font-bold font-mono text-[8.5px] ml-1 flex items-center">⚔️{p1WarlordInstance ? getUnitAdjustedAttack(gameState, p1WarlordInstance) : 2}</span>
            <span className="text-green-455 font-bold font-mono text-[8.5px] flex items-center">❤️{p1WarlordHp}</span>
            <span className="text-cyan-400 font-bold font-mono text-[8.5px] flex items-center">🔨2</span>
          </div>
        )}

        {smHere.map(u => (
          <div
            key={u.instanceId}
            onMouseEnter={() => handleUnitMouseEnter(u)}
            onMouseLeave={handleUnitMouseLeave}
            onMouseMove={handleUnitMouseMove}
            onClick={() => {
              setSelectedHQCardId(selectedHQCardId === u.instanceId ? null : u.instanceId);
              // Player active attack selecting
              if (gameState.phase === 'COMBAT' && isUnderConflict && gameState.activePlayerId === 'player-1') {
                if (gameState.combat.subPhase === 'MELEE' && !u.isExhausted) {
                  handleStartCombatClick(u.instanceId);
                } else if (gameState.combat.subPhase === 'RETREAT' && !u.isExhausted) {
                  handleRetreatClick(u.instanceId);
                }
              }
            }}
            className={`flex items-center gap-1 px-1.5 py-0.5 bg-white/5 border border-white/10 rounded-lg text-[9px] text-gray-300 font-sans cursor-pointer hover:bg-white/10 transition-all shrink-0 ${
              selectedAttackerId === u.instanceId ? 'ring-1 ring-amber-400 bg-amber-500/10 animate-pulse' : ''
            } ${
              selectedHQCardId === u.instanceId ? 'ring-2 ring-purple-500 bg-purple-950/20 shadow-[0_0_8px_rgba(168,85,247,0.5)]' : ''
            } ${u.isExhausted ? 'opacity-35 cursor-not-allowed' : ''}`}
            title={`${u.name}${u.isExhausted ? ' (Exhausted)' : ''}: Click to attack/retreat/select`}
          >
            <span className={`truncate max-w-[50px] font-medium ${u.isExhausted ? 'text-gray-500 line-through' : ''}`}>{u.name.split(' ').slice(-1)}</span>
            <span className="text-red-400 font-bold font-mono text-[8.5px] flex items-center">⚔️{getUnitAdjustedAttack(gameState, u)}</span>
            <span className="text-green-400 font-bold font-mono text-[8.5px] flex items-center">❤️{getUnitAdjustedHp(gameState, u) - u.damage}</span>
            {u.commandIcons > 0 && (
              <span className="text-cyan-400 font-bold font-mono text-[8.5px] flex items-center">🔨{u.commandIcons}</span>
            )}
          </div>
        ))}

        {!hasP1Warlord && smHere.length === 0 && (
          <span className="text-[7.5px] text-gray-650 font-mono tracking-wider uppercase">VACANT</span>
        )}
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
          adjustedAttack={hoveredUnit.instanceId ? getUnitAdjustedAttack(gameState, hoveredUnit) : undefined}
          adjustedHp={hoveredUnit.instanceId ? getUnitAdjustedHp(gameState, hoveredUnit) : undefined}
        />
      </div>
    )}
  </>
);
}

