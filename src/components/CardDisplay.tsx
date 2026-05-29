import React, { useState, useEffect } from 'react';
import { CardInstance, CardDefinition } from '../engine/types';
import { Skull, Shield, Zap, Sparkles, AlertCircle, FileText, Eye } from 'lucide-react';

import badDokImg from './card-images/orks/Bad_Dok.jpg';
import battleCryImg from './card-images/orks/Battle_Cry.jpg';
import biggaIsBettaImg from './card-images/orks/Bigga_Is_Betta.jpg';
import burnaBoyzImg from './card-images/orks/Burna_Boyz.jpg';
import crushfaceImg from './card-images/orks/Crushface.jpg';
import cyborkBodyImg from './card-images/orks/Cybork_Body.jpg';
import enragedOrkImg from './card-images/orks/Enraged_Ork.jpg';
import goffBoyzImg from './card-images/orks/Goff_Boyz.jpg';
import goffNobImg from './card-images/orks/Goff_Nob.jpg';
import kraktoofHallImg from './card-images/orks/Kraktoof_Hall.jpg';
import flashGitzImg from "./card-images/orks/Nazdreg's_Flash_Gitz.jpg";
import orkKannonImg from './card-images/orks/Ork_Kannon.jpg';
import rokkitLaunchaImg from './card-images/orks/Rokkit_Launcha.jpg';
import shootaMobImg from './card-images/orks/Shoota_Mob.jpg';
import snotlingAttackImg from './card-images/orks/Snotling_Attack.jpg';
import squigBombinImg from "./card-images/orks/Squig_Bombin'.jpg";
import tellyportaPadImg from './card-images/orks/Tellyporta_Pad.jpg';
import weirdboyManiakImg from './card-images/orks/Weirdboy_Maniak.jpg';

import playsianImg from './card-images/astra/Elysian_Assault_Team.jpg';
import hostileEnvImg from './card-images/astra/Hostile_Environment_Gear.jpg';
import suppressiveImg from './card-images/astra/Suppressive_Fire.jpg';

import promotionImg from './card-images/neutral/Promotion.jpg';
import fallbackImg from './card-images/neutral/Fall_Back!.jpg';
import noMercyImg from './card-images/neutral/No_Mercy.jpg';

import catoWarlordImg from './card-images/warlord/Captain_Cato_Sicarius.jpg';
import catoWarlordBloodiedImg from './card-images/warlord/Captain_Cato_Sicarius_bloodied.jpg';
import nazdregWarlordImg from './card-images/warlord/Nazdreg.jpg';
import nazdregWarlordBloodiedImg from './card-images/warlord/Nazdreg_bloodied.jpg';

import scScoutImg from './card-images/space_marines/10th_Company_Scout.jpg';
import baVeteransImg from './card-images/space_marines/Blood_Angels_Veterans.jpg';
import catoStrongholdImg from "./card-images/space_marines/Cato's_Stronghold.jpg";
import dropPodAssaultImg from './card-images/space_marines/Drop_Pod_Assault.jpg';
import eagerRecruitImg from './card-images/space_marines/Eager_Recruit.jpg';
import exterminatusImg from './card-images/space_marines/Exterminatus.jpg';
import fortressMonasteryImg from './card-images/space_marines/Fortress-Monastery.jpg';
import godwynBolterImg from './card-images/space_marines/Godwyn_Pattern_Bolter.jpg';
import honoredLibrarianImg from './card-images/space_marines/Honored_Librarian.jpg';
import indomitableImg from './card-images/space_marines/Indomitable.jpg';
import ironHaloImg from './card-images/space_marines/Iron_Halo.jpg';
import sicariusChosenImg from "./card-images/space_marines/Sicarius's_Chosen.jpg";
import squadCardinisImg from './card-images/space_marines/Tactical_Squad_Cardinis.jpg';
import tempestBladeImg from './card-images/space_marines/Tallassarian_Tempest_Blade.jpg';
import furyOfSicariusImg from './card-images/space_marines/The_Fury_of_Sicarius.jpg';
import umDreadnoughtImg from './card-images/space_marines/Ultramarines_Dreadnought.jpg';
import veteranMaxosImg from './card-images/space_marines/Veteran_Brother_Maxos.jpg';

import earthTechnicianImg from './card-images/tau/Earth_Caste_Technician.jpg';
import fireWarriorEliteImg from './card-images/tau/Fire_Warrior_Elite.jpg';
import ionRifleImg from './card-images/tau/Ion_Rifle.jpg';

const LOCAL_CARD_IMAGES: Record<string, string> = {
  'Captain Cato Sicarius': catoWarlordImg,
  'Captain Cato Sicarius_bloodied': catoWarlordBloodiedImg,
  'Nazdreg': nazdregWarlordImg,
  'Nazdreg_bloodied': nazdregWarlordBloodiedImg,
  'Bad Dok': badDokImg,
  'Battle Cry': battleCryImg,
  'Bigga Is Betta': biggaIsBettaImg,
  'Burna Boyz': burnaBoyzImg,
  'Crushface': crushfaceImg,
  'Cybork Body': cyborkBodyImg,
  'Enraged Ork': enragedOrkImg,
  'Goff Boyz': goffBoyzImg,
  'Goff Nob': goffNobImg,
  'Kraktoof Hall': kraktoofHallImg,
  "Nazdreg's Flash Gitz": flashGitzImg,
  "Nazdregs Flash Gitz": flashGitzImg,
  'Ork Kannon': orkKannonImg,
  'Rokkit Launcha': rokkitLaunchaImg,
  'Shoota Mob': shootaMobImg,
  'Shoota Boyz': shootaMobImg,
  'Snotling Attack': snotlingAttackImg,
  "Squig Bombin'": squigBombinImg,
  "Squig Bombin": squigBombinImg,
  'Tellyporta Pad': tellyportaPadImg,
  'Weirdboy Maniak': weirdboyManiakImg,
  'Elysian Assault Team': playsianImg,
  'Hostile Environment Gear': hostileEnvImg,
  'Suppressive Fire': suppressiveImg,
  'Promotion': promotionImg,
  'Fall Back!': fallbackImg,
  'No Mercy': noMercyImg,
  '10th Company Scout': scScoutImg,
  'Blood Angels Veterans': baVeteransImg,
  "Cato's Stronghold": catoStrongholdImg,
  'Drop Pod Assault': dropPodAssaultImg,
  'Eager Recruit': eagerRecruitImg,
  'Exterminatus': exterminatusImg,
  'Fortress-Monastery': fortressMonasteryImg,
  'Godwyn Pattern Bolter': godwynBolterImg,
  'Honored Librarian': honoredLibrarianImg,
  'Indomitable': indomitableImg,
  'Iron Halo': ironHaloImg,
  "Sicarius's Chosen": sicariusChosenImg,
  'Tactical Squad Cardinis': squadCardinisImg,
  'Tallassarian Tempest Blade': tempestBladeImg,
  'The Fury of Sicarius': furyOfSicariusImg,
  'Ultramarines Dreadnought': umDreadnoughtImg,
  'Veteran Brother Maxos': veteranMaxosImg,
  'Earth Caste Technician': earthTechnicianImg,
  'Fire Warrior Elite': fireWarriorEliteImg,
  'Ion Rifle': ionRifleImg,
};

interface CardDisplayProps {
  card: CardInstance | CardDefinition;
  onClick?: () => void;
  isSelected?: boolean;
  canPlay?: boolean;
  size?: 'sm' | 'md' | 'mini' | 'lg';
}

export default function CardDisplay({ card, onClick, isSelected, canPlay = true, size = 'md' }: CardDisplayProps) {
  const isInstance = 'instanceId' in card;
  const instance = isInstance ? (card as CardInstance) : null;
  const [viewMode, setViewMode] = useState<'image' | 'text'>('image');
  const [imageError, setImageError] = useState(false);

  // Auto-reset imageError if card changes
  useEffect(() => {
    setImageError(false);
  }, [card.id, instance?.isBloodied]);

  // Background and borders based on faction under Sophisticated Dark styling
  const factionBorderClass =
    card.faction === 'Space Marines' ? 'border-amber-500/20 hover:border-amber-400/40 bg-zinc-900/30 text-[#e2e8f0]' :
      card.faction === 'Orks' ? 'border-red-550/20 hover:border-red-400/40 bg-zinc-900/30 text-[#e2e8f0]' :
        card.faction === 'Tau' ? 'border-cyan-500/20 hover:border-cyan-400/40 bg-zinc-900/30 text-[#e2e8f0]' :
          'border-white/5 hover:border-white/20 bg-black/20 text-[#e2e8f0]';

  const factionHeaderBg =
    card.faction === 'Space Marines' ? 'bg-amber-400/5 text-amber-450 border-amber-500/10' :
      card.faction === 'Orks' ? 'bg-red-500/5 text-red-500 border-red-500/10' :
        card.faction === 'Tau' ? 'bg-cyan-500/5 text-cyan-400 border-cyan-550/10' :
          'bg-white/5 text-gray-400 border-white/5';

  const typeColor =
    card.type === 'Warlord' ? 'text-amber-500 font-serif italic font-bold' :
      card.type === 'Army' ? 'text-cyan-400/95 font-medium' :
        card.type === 'Support' ? 'text-purple-400 font-medium' :
          'text-orange-400 font-medium';

  const isBloodied = instance?.isBloodied || false;
  const conqId = card.conquestCardId;
  const localImageKey = isBloodied ? `${card.name}_bloodied` : card.name;
  const localImage = LOCAL_CARD_IMAGES[localImageKey] || LOCAL_CARD_IMAGES[card.name];
  const rawImageUrl = conqId
    ? `https://www.conquestdb.com/allowed/cards/${conqId}${isBloodied ? 'b' : ''}.png`
    : null;
  const remoteImageUrl = rawImageUrl
    ? `https://images.weserv.nl/?url=${encodeURIComponent(rawImageUrl.replace(/^https?:\/\//, ''))}`
    : null;
  const imageUrl = localImage || remoteImageUrl;

  const handleImageError = () => {
    setImageError(true);
    setViewMode('text');
  };

  const hasImage = imageUrl && !imageError;

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

  const dimensionsClass = size === 'mini'
    ? 'w-[105px] h-[160px] p-2 rounded-lg text-[8px]'
    : size === 'sm'
      ? 'w-[130px] h-[200px] p-2 rounded-lg text-[9px]'
      : size === 'lg'
        ? 'w-72 h-[410px] p-5 rounded-2xl text-[12.5px]'
        : 'w-56 h-80 p-4 rounded-xl';

  return (
    <>
      <div
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        id={`card-${card.id}`}
        className={`relative flex flex-col ${dimensionsClass} border transition-all duration-300 cursor-pointer select-none overflow-hidden hover:scale-102 hover:-translate-y-1 ${factionBorderClass} ${isSelected ? 'ring-2 ring-amber-500/60 ring-offset-2 ring-offset-[#0a0a0c] scale-103 shadow-lg shadow-white/5' : ''
          } ${!canPlay ? 'opacity-40 cursor-not-allowed' : 'shadow-md shadow-black/80 bg-black/40'} ${instance?.isExhausted && hasImage && viewMode === 'image' ? 'grayscale opacity-75' : ''
          }`}
      >
        {/* Background radial highlight - subtle elegance */}
        <div className={`absolute -right-24 -top-24 w-44 h-44 rounded-full blur-3xl opacity-15 ${card.faction === 'Space Marines' ? 'bg-amber-500' : card.faction === 'Orks' ? 'bg-red-600' : card.faction === 'Tau' ? 'bg-cyan-500' : 'bg-slate-400'
          }`} />

        {/* RENDER MODE: FULL CONQUEST SCANNED CARD FACE */}
        {hasImage && viewMode === 'image' ? (
          <div className="absolute inset-0 w-full h-full rounded-xl overflow-hidden z-0">
            <img
              src={imageUrl!}
              alt={card.name}
              className="w-full h-full object-cover"
              onError={handleImageError}
              referrerPolicy="no-referrer"
            />

            {/* Quick interactive Toggle Button over Image (Top Right) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewMode('text');
              }}
              title="Switch to detailed text view"
              className="absolute top-2.5 right-2.5 p-1 rounded bg-black/60 hover:bg-black/85 border border-white/10 text-gray-300 hover:text-white transition-all z-30"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            {/* Damage Overlay */}
            {instance && instance.damage > 0 && (
              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 bg-red-650 px-2 py-1 rounded font-mono text-xs font-black text-white border border-red-500/30 shadow shadow-black/80 z-20 animate-pulse">
                💥 {instance.damage} Damage
              </div>
            )}

            {/* Exhausted semi-opaque overlay inside image mode for robust playability */}
            {instance && instance.isExhausted && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px] flex items-center justify-center z-10">
                <div className="bg-red-950/90 border border-red-500/40 text-red-400 font-mono text-[9px] font-extrabold px-2.5 py-1 rounded tracking-widest uppercase shadow shadow-black">
                  EXHAUSTED
                </div>
              </div>
            )}

            {/* Bloodied Overlay Tag */}
            {instance && instance.isBloodied && (
              <div className="absolute top-2.5 left-2.5 flex items-center text-[9px] bg-red-950/80 text-red-500 border border-red-500/30 px-1.5 py-0.5 rounded font-black uppercase tracking-wider shadow z-20">
                🩸 BLOODIED
              </div>
            )}
          </div>
        ) : (
          /* RENDER MODE: HIGH-CONTRAST TEXT DESCRIPTION CARD */
          <>
            {/* Header: Cost + Name */}
            <div className="flex justify-between items-start gap-1 pb-1.5 z-10">
              <h3 className={`font-heading font-semibold tracking-tight leading-snug line-clamp-2 ${size === 'mini' ? 'text-[8.5px]' : size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-[15.5px]' : 'text-sm'
                } ${card.type === 'Warlord' ? 'font-serif italic text-white font-bold' : 'text-gray-200'}`}>
                {card.name}
              </h3>

              {/* Cost Badge */}
              {card.type !== 'Warlord' ? (
                <div className={`flex items-center justify-center rounded-md bg-white/5 text-gray-300 border border-white/10 font-mono font-semibold ${size === 'mini' ? 'min-w-3.5 h-3.5 text-[8px] px-0.5' : size === 'sm' ? 'min-w-4 h-4 text-[9px] px-0.5' : size === 'lg' ? 'min-w-8 h-8 text-sm px-1' : 'min-w-6 h-6 text-xs px-1'
                  }`}>
                  {card.cost}
                </div>
              ) : (
                <div className={`flex items-center justify-center rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-serif font-bold tracking-widest uppercase ${size === 'mini' ? 'text-[6px] px-0.5 py-0.1' : size === 'sm' ? 'text-[7px] px-0.5 py-0.2' : size === 'lg' ? 'text-[11px] px-1.5 h-7 flex items-center' : 'text-[10px] px-1 h-6'
                  }`}>
                  HQ
                </div>
              )}
            </div>

            {/* Subheader: Faction + Type */}
            <div className={`flex items-center justify-between px-1.5 py-0.5 rounded border text-[8px] tracking-wider uppercase font-semibold font-heading z-10 ${size === 'mini' ? 'mb-0.5 text-[6.5px] py-0' : size === 'sm' ? 'mb-1 text-[7px] py-[1px]' : size === 'lg' ? 'mb-3.5 text-[10px] py-[2px]' : 'mb-3'
              } ${factionHeaderBg}`}>
              <span className="truncate">{card.faction}</span>
              <span className={typeColor}>{card.type}</span>
            </div>

            {/* Middle Banner: Stats Block */}
            {card.type !== 'Support' && card.type !== 'Event' ? (
              <div className={`flex items-center justify-around bg-[#0a0a0c]/80 rounded-lg border border-white/5 font-mono z-10 ${size === 'mini' ? 'py-0.2 px-0.5 mb-0.5 text-[8px]' : size === 'sm' ? 'py-0.5 px-0.5 mb-1 text-[9px]' : size === 'lg' ? 'py-2 px-1 mb-3.5 text-sm' : 'py-1.5 px-1 mb-3 text-xs'
                }`}>
                <div className="text-center group" title="Attack Strength">
                  <span className={`text-[#888899] uppercase block font-sans tracking-tight ${size === 'lg' ? 'text-[9px]' : 'text-[7.5px]'}`}>ATK</span>
                  <span className={`font-bold text-red-400 ${size === 'lg' ? 'text-base' : ''}`}>{card.attack}</span>
                </div>
                <div className="border-r border-white/5 h-4" />
                <div className="text-center" title="Hit Points (Max HP)">
                  <span className={`text-[#888899] uppercase block font-sans tracking-tight ${size === 'lg' ? 'text-[9px]' : 'text-[7.5px]'}`}>HP</span>
                  <span className={`font-bold text-green-400 ${size === 'lg' ? 'text-base' : ''}`}>
                    {instance ? `${instance.hp - instance.damage}/${instance.hp}` : card.hp}
                  </span>
                </div>
                <div className="border-r border-white/5 h-4" />
                <div className="text-center" title="Command Icons">
                  <span className={`text-[#888899] uppercase block font-sans tracking-tight ${size === 'lg' ? 'text-[9px]' : 'text-[7.5px]'}`}>CMD</span>
                  <span className={`font-bold text-[#38bdf8] ${size === 'lg' ? 'text-sm' : ''}`}>
                    {'🔨'.repeat(card.commandIcons) || '0'}
                  </span>
                </div>
              </div>
            ) : (
              <div className={size === 'mini' ? 'h-0.5' : size === 'sm' ? 'h-1' : size === 'lg' ? 'h-6' : 'h-4'} />
            )}

            {/* Keywords / Traits tags */}
            {size !== 'mini' && size !== 'sm' && (card.traits.length > 0 || card.keywords.length > 0) ? (
              <div className="flex flex-wrap gap-1.5 mb-3 z-10 font-heading">
                {card.traits.slice(0, 2).map(t => (
                  <span key={t} className={`bg-white/5 border border-white/5 text-gray-450 px-1.5 py-0.5 rounded tracking-wide ${size === 'lg' ? 'text-[11px]' : 'text-[9px]'}`}>
                    {t}
                  </span>
                ))}
                {card.keywords.slice(0, 2).map(k => (
                  <span key={k} className={`bg-yellow-500/5 border border-yellow-500/20 text-yellow-500 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${size === 'lg' ? 'text-[11px]' : 'text-[9px]'}`}>
                    {k}
                  </span>
                ))}
              </div>
            ) : null}

            {/* Card Rules text */}
            {size !== 'mini' && (
              <div className={`flex-grow text-gray-400 leading-normal z-10 font-sans italic p-1.5 bg-black/25 rounded border border-white/5 ${size === 'sm' ? 'line-clamp-2 text-[8px] tracking-tight p-0.5' : size === 'lg' ? 'text-[12px] line-clamp-5' : 'text-[9.5px] line-clamp-4'
                }`}>
                {card.description}
              </div>
            )}

            {/* Toggle back to Image view if image is locally cached/available */}
            {hasImage && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('image');
                }}
                title="Switch to card visual art mode"
                className={`absolute p-1 rounded bg-black/60 hover:bg-black/85 border border-white/10 text-gray-300 hover:text-white transition-all z-35 ${size === 'mini' ? 'top-1 right-1 p-0.5' : size === 'sm' ? 'top-1 right-1 p-0.5' : size === 'lg' ? 'top-3 right-3 p-1' : 'top-2.5 right-2.5'
                  }`}
              >
                <Eye className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} />
              </button>
            )}

            {/* Footer / Status Indicator inside game Instance */}
            {instance && (
              <div className={`flex justify-between items-center border-t border-white/5 z-10 ${size === 'mini' ? 'mt-0.5 pt-0.5' : size === 'sm' ? 'mt-1 pt-1' : size === 'lg' ? 'mt-4 pt-2.5' : 'mt-3 pt-2'
                }`}>
                <div className="flex items-center gap-1">
                  {instance.isExhausted ? (
                    <span className={`bg-red-950/20 text-red-500 border border-red-900/20 px-1 py-0.2 rounded font-semibold uppercase tracking-wider ${size === 'mini' ? 'text-[6.5px]' : size === 'sm' ? 'text-[7px]' : size === 'lg' ? 'text-[11px] px-1.5' : 'text-[9px]'
                      }`}>
                      EXHAUSTED
                    </span>
                  ) : (
                    <span className={`bg-green-950/20 text-green-400 border border-green-900/20 px-1 py-0.2 rounded font-semibold uppercase tracking-wider ${size === 'mini' ? 'text-[6.5px]' : size === 'sm' ? 'text-[7px]' : size === 'lg' ? 'text-[11px] px-1.5' : 'text-[9px]'
                      }`}>
                      READY
                    </span>
                  )}

                  {instance.isBloodied && size !== 'mini' && size !== 'sm' && (
                    <span className={`flex items-center bg-red-950/30 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${size === 'lg' ? 'text-[11px]' : 'text-[9px]'
                      }`}>
                      <AlertCircle className="w-2.5 h-2.5 mr-0.5 inline-block" />
                      BLOODIED
                    </span>
                  )}
                </div>

                {/* Shields count icon trigger */}
                {card.shields > 0 && (
                  <div className={`flex items-center text-amber-500 font-mono ${size === 'mini' ? 'text-[7px]' : size === 'sm' ? 'text-[8px]' : size === 'lg' ? 'text-[11px]' : 'text-[10px]'
                    }`} title="Shield Count">
                    <Shield className="w-2.5 h-2.5 text-amber-500 mr-0.5 hover:scale-110 transition-transform" />
                    <span>{card.shields}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {isHovered && (size === 'mini' || size === 'sm') && (
        <div
          className="fixed pointer-events-none z-[9999] shadow-2xl transition-opacity duration-200"
          style={{
            left: `${hoverPosition.x}px`,
            top: `${hoverPosition.y}px`,
          }}
        >
          <CardDisplay
            card={card}
            canPlay={canPlay}
            size="lg"
          />
        </div>
      )}
    </>
  );
}
