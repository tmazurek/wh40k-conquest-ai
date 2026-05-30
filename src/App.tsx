import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  initGame, 
  deployUnit, 
  playSupportCard, 
  triggerSupportAbility, 
  playEventCard, 
  passDeployTurn, 
  commitWarlord, 
  revealWarlordCommitments,
  executeCommandStruggle,
  manualProceedToCombat,
  manualAcknowledgeCombatPlanet,
  declareAttack, 
  resolveShieldCard, 
  retreatUnitFromCombat, 
  completePlayerRetreatWindow, 
  retreatWarlordActiveTurn,
  runAiTurn, 
  getUnitsAtPlanet, 
  getPlacedUnitsForPlayer,
  hasWarlordAtPlanet,
  passCombatAction,
  resolvePlanetBattleAbilityChoice
} from './engine/gameLogic';
import { GameState, CardInstance, Planet } from './engine/types';
import CardDisplay from './components/CardDisplay';
import PlanetDisplay from './components/PlanetDisplay';
import LogPanel from './components/LogPanel';
import RulesPanel from './components/RulesPanel';
import { 
  Plus, Swords, Shield, Zap, RefreshCw, Bot, HelpCircle, ArrowRight,
  Sparkles, Coins, Trophy, Skull, Info, LogOut, Globe
} from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => initGame(77));
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedHQCardId, setSelectedHQCardId] = useState<string | null>(null);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  
  // Rules info toggle drawer
  const [showRulesDrawer, setShowRulesDrawer] = useState(false);
  
  // Custom seed
  const [seed, setSeed] = useState(77);

  const resetGame = () => {
    const nextSeed = Math.floor(Math.random() * 100);
    setSeed(nextSeed);
    setGameState(initGame(nextSeed));
    setSelectedHandCardId(null);
    setSelectedHQCardId(null);
    setSelectedAttackerId(null);
  };

  // Helper selectors
  const p1 = gameState.players['player-1'];
  const ai = gameState.players['ai-1'];

  const p1Symbols = useMemo(() => {
    const counts = { Tech: 0, Strongpoint: 0, Material: 0 };
    p1.victoryDisplay.forEach((p) => {
      p.symbols.forEach((sym) => {
        if (sym === 'Tech') counts.Tech++;
        if (sym === 'Strongpoint') counts.Strongpoint++;
        if (sym === 'Material') counts.Material++;
      });
    });
    return counts;
  }, [p1.victoryDisplay]);

  const aiSymbols = useMemo(() => {
    const counts = { Tech: 0, Strongpoint: 0, Material: 0 };
    ai.victoryDisplay.forEach((p) => {
      p.symbols.forEach((sym) => {
        if (sym === 'Tech') counts.Tech++;
        if (sym === 'Strongpoint') counts.Strongpoint++;
        if (sym === 'Material') counts.Material++;
      });
    });
    return counts;
  }, [ai.victoryDisplay]);

  // AI Automatic trigger on turn switch
  useEffect(() => {
    if (gameState.activePlayerId === 'ai-1' && !gameState.isGameOver && (gameState.phase === 'DEPLOY' || gameState.phase === 'COMBAT')) {
      const timer = setTimeout(() => {
        setGameState(prev => {
          const next = JSON.parse(JSON.stringify(prev));
          runAiTurn(next);
          return next;
        });
      }, 1000); // 1-second strategic buffer for smooth viewing
      return () => clearTimeout(timer);
    }
  }, [gameState.activePlayerId, gameState.phase, gameState.combat.subPhase, gameState.isGameOver, gameState.log.length]);

  const activeHandCard = useMemo(() => {
    return p1.hand.find(c => c.instanceId === selectedHandCardId) || null;
  }, [selectedHandCardId, p1.hand]);

  const activeHQCard = useMemo(() => {
    return p1.hq.find(c => c.instanceId === selectedHQCardId) || null;
  }, [selectedHQCardId, p1.hq]);

  // Planet utility totals
  const getPlanetCommandTally = useCallback((planet: Planet) => {
    const p1Units = getUnitsAtPlanet(gameState, planet.id).filter(u => u.controllerId === 'player-1' && !u.isExhausted);
    const aiUnits = getUnitsAtPlanet(gameState, planet.id).filter(u => u.controllerId === 'ai-1' && !u.isExhausted);

    let p1Command = p1Units.reduce((acc, u) => acc + u.commandIcons, 0);
    let aiCommand = aiUnits.reduce((acc, u) => acc + u.commandIcons, 0);

    // HQ commitment virtual check
    if (gameState.warlordCommitments['player-1'] === planet.index) {
      const warlord = p1.hq.find(u => u.type === 'Warlord');
      if (warlord && !warlord.isExhausted) p1Command += warlord.commandIcons;
    }
    if (gameState.warlordCommitments['ai-1'] === planet.index) {
      const warlord = ai.hq.find(u => u.type === 'Warlord');
      if (warlord && !warlord.isExhausted) aiCommand += warlord.commandIcons;
    }

    return { p1Command, aiCommand };
  }, [gameState, p1.hq, ai.hq]);

  // Card deploying actions
  const handleDeployToPlanet = (planetId: string) => {
    if (!selectedHandCardId) return;
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      deployUnit(next, 'player-1', selectedHandCardId, planetId);
      return next;
    });
    setSelectedHandCardId(null);
  };

  const handleBuildSupport = () => {
    if (!selectedHandCardId) return;
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      playSupportCard(next, 'player-1', selectedHandCardId);
      return next;
    });
    setSelectedHandCardId(null);
  };

  const handleCastEvent = (targetUnitId: string) => {
    if (!selectedHandCardId) return;
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      playEventCard(next, 'player-1', selectedHandCardId, targetUnitId);
      return next;
    });
    setSelectedHandCardId(null);
  };

  const handleExhaustSupportAbility = (cardId: string) => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      triggerSupportAbility(next, 'player-1', cardId);
      return next;
    });
    setSelectedHQCardId(null);
  };

  const handlePassDeploy = () => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      passDeployTurn(next, 'player-1');
      return next;
    });
  };

  // Secret Warlord commitment
  const handleCommitWarlord = (planetIndex: number) => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      commitWarlord(next, 'player-1', planetIndex);
      return next;
    });
  };

  // Combat selects
  const handleStartCombatClick = (attackerId: string) => {
    if (gameState.activePlayerId !== 'player-1') return;
    setSelectedAttackerId(attackerId);
  };

  const handleDeclareAttackTarget = (targetId: string) => {
    if (!selectedAttackerId) return;
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      declareAttack(next, selectedAttackerId, targetId);
      return next;
    });
    setSelectedAttackerId(null);
  };

  const handleShieldDecision = (shieldCardId: string | 'none') => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      resolveShieldCard(next, 'player-1', shieldCardId);
      return next;
    });
  };

  const handleRetreatClick = (unitInstanceId: string) => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      retreatUnitFromCombat(next, 'player-1', unitInstanceId);
      return next;
    });
  };

  const handleDoneRetreating = () => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      completePlayerRetreatWindow(next, 'player-1');
      return next;
    });
  };

  const handleRetreatWarlordActiveTurn = () => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      retreatWarlordActiveTurn(next, 'player-1');
      return next;
    });
    setSelectedAttackerId(null);
  };

  const handlePassCombatAction = () => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      passCombatAction(next, 'player-1');
      return next;
    });
  };

  const handleRevealWarlords = () => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      revealWarlordCommitments(next);
      return next;
    });
  };

  const handleResolveCommandStruggles = () => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      executeCommandStruggle(next);
      return next;
    });
  };

  const handleProceedToCombatPhase = () => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      manualProceedToCombat(next);
      return next;
    });
  };

  const handleAcknowledgeCombatPlanet = () => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      manualAcknowledgeCombatPlanet(next);
      return next;
    });
  };

  const handleResolvePlanetBattleAbilityChoice = (choice: boolean) => {
    setGameState(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      resolvePlanetBattleAbilityChoice(next, choice);
      return next;
    });
  };

  // Combat status indicators
  const activeCombatPlanetIndex = gameState.combat.activePlanetIndex;
  const activeCombatPlanet = activeCombatPlanetIndex !== -1 ? gameState.planets[activeCombatPlanetIndex] : null;
  const activeCombatPlanetUnits = activeCombatPlanet ? getUnitsAtPlanet(gameState, activeCombatPlanet.id) : [];

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-gray-200 flex flex-col font-sans relative antialiased leading-relaxed">
      
      {/* Background ambience overlay */}
      <div className="absolute inset-x-0 top-0 h-[350px] bg-gradient-to-b from-white/5 via-transparent to-transparent pointer-events-none z-0" />

      {/* HEADER BAR */}
      <header className="h-16 px-6 bg-black/40 border-b border-white/10 sticky top-0 backdrop-blur z-40 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/15 text-yellow-550 shadow-inner">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-serif italic text-base tracking-wide text-white flex items-center gap-2">
              Conquest <span className="text-[10px] not-italic font-bold font-sans tracking-widest text-[#991b1b] bg-red-950/40 px-2 py-0.5 rounded border border-red-900/40">AI COMBAT</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-mono">
              Space Marines vs Orks — Seed {seed}
            </p>
          </div>
        </div>

        {/* Phase / turn information */}
        <div className="flex items-center gap-4 font-mono text-xs max-md:hidden">
          <div className="flex flex-col items-center px-3 py-1 bg-white/5 border border-white/10 rounded">
            <span className="text-[8px] text-gray-500 uppercase tracking-widest">Turn</span>
            <span className="font-bold text-white text-xs">{gameState.turn}</span>
          </div>

          <div className="flex flex-col px-3 py-1 bg-white/5 border border-white/10 rounded">
            <span className="text-[8px] text-gray-500 uppercase tracking-widest text-center">Active Phase</span>
            <span className="font-bold text-yellow-500 text-[10px] tracking-widest uppercase">
              {gameState.phase}
            </span>
          </div>

          <div className="flex flex-col items-center px-3 py-1 bg-white/5 border border-white/10 rounded">
            <span className="text-[8px] text-gray-500 uppercase tracking-widest">Initiative Holder</span>
            <span className="font-bold text-gray-350 uppercase text-[9px] tracking-wider">
              {gameState.firstPlayerId === 'player-1' ? '👤 Player' : '🤖 Ork AI'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRulesDrawer(!showRulesDrawer)}
            className="flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 tracking-widest text-[10px] gap-1.5 transition-colors uppercase font-medium"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="max-sm:hidden">Guide</span>
          </button>
          <button
            onClick={resetGame}
            className="flex items-center justify-center px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold text-[10px] tracking-widest uppercase gap-1.5 transition-all border border-white/20 active:scale-97"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restart Drill
          </button>
        </div>
      </header>

      {/* WORKSPACE PANELS */}
      <main className="flex-grow grid grid-cols-12 gap-6 p-6 z-10">

        {/* GAME PLAYFIELD: 9 cols broad */}
        <div className="col-span-12 xl:col-span-9 space-y-6">

          {/* ORK AI DASHBOARD (TOP TIER) */}
          <div className="bg-red-950/15 border border-red-900/20 rounded-2xl p-4 space-y-3 shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-900/5 via-transparent to-transparent pointer-events-none" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-900/15 pb-2 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                <h3 className="font-mono text-red-400 font-bold uppercase tracking-widest text-[10px] flex items-center gap-1.5">
                  🤖 ORK AI COMMANDER BOARD
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[9px]">
                <div className="bg-black/40 border border-red-900/15 px-2 py-0.5 rounded flex items-center gap-1.5">
                  <Coins className="w-3 h-3 text-red-500" />
                  <span>Resources: <strong className="text-red-400 font-bold">{ai.resources}</strong></span>
                </div>
                <div className="bg-black/40 border border-red-900/15 px-2 py-0.5 rounded">
                  <span>Deck: <strong className="text-gray-300 font-bold">{ai.deck.length}</strong></span>
                </div>
                <div className="bg-black/40 border border-red-900/15 px-2 py-0.5 rounded">
                  <span>Discard: <strong className="text-gray-450 font-bold">{ai.discard.length}</strong></span>
                </div>
                <div className="bg-black/40 border border-red-900/15 px-2 py-0.5 rounded flex items-center gap-1.5">
                  <span className="text-gray-500 uppercase font-semibold text-[8px] mr-0.5">Symbols:</span>
                  <span className="text-cyan-400 font-bold flex items-center gap-0.5" title="Tech">🧪 {aiSymbols.Tech}</span>
                  <span className="text-blue-400 font-bold flex items-center gap-0.5" title="Strongpoint">🛡️ {aiSymbols.Strongpoint}</span>
                  <span className="text-rose-400 font-bold flex items-center gap-0.5" title="Material">💎 {aiSymbols.Material}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 relative z-10">
              {/* ORK AI HAND (CARD BACKS) */}
              <div className="md:col-span-6 space-y-2">
                <span className="text-[9px] text-red-550 font-mono tracking-widest block uppercase font-bold">
                  🃏 INTEL HAND ({ai.hand.length} Cards)
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                  {ai.hand.length === 0 ? (
                    <div className="text-[9px] text-gray-500 italic py-3 font-mono">Hand is empty</div>
                  ) : (
                    ai.hand.map((_, index) => (
                      <div 
                        key={index}
                        className="w-11 h-16 rounded-lg bg-gradient-to-br from-[#7f1d1d] to-[#450a0a] border border-[#ef4444]/30 shadow-md relative overflow-hidden shrink-0 flex items-center justify-center select-none"
                      >
                        <div className="absolute inset-1 rounded border border-[#ef4444]/10 flex flex-col items-center justify-center">
                          <Swords className="w-4 h-4 text-[#ef4444]/20 rotate-45" />
                          <span className="text-[6px] text-[#ef4444]/35 font-mono font-bold tracking-widest mt-1">ORK</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ORK AI GARRISON (HQ & SUPPORTS) */}
              <div className="md:col-span-6 space-y-2">
                <span className="text-[9px] text-red-555 font-mono tracking-widest block uppercase font-bold">
                  🏗️ HQ & SUPPORT ARRAY ({ai.hq.filter(c => c.location === 'HQ').length} Cards)
                </span>
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full items-center">
                  {ai.hq.filter(c => c.location === 'HQ').length === 0 ? (
                    <div className="text-[9px] text-gray-500 italic py-3 font-mono">HQ is empty</div>
                  ) : (
                    ai.hq.filter(c => c.location === 'HQ').map(c => (
                      <div key={c.instanceId} className="shrink-0 scale-90 origin-top">
                        <CardDisplay
                          size="mini"
                          card={c}
                          canPlay={false}
                          onClick={() => {}}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* MAIN STATUS SUB-SCREEN IF GAME IS OVER */}
          {gameState.isGameOver ? (
            <div className="w-full text-center p-12 cosmic-panel rounded-2xl border-white/10 text-slate-100 flex flex-col items-center justify-center space-y-4 animate-fade-in relative overflow-hidden">
              <div className="absolute inset-y-0 w-80 bg-radial-gradient from-yellow-500/10 to-transparent blur-3xl" />
              <Trophy className="w-16 h-16 text-yellow-550 animate-pulse-slow" />
              <h2 className="font-serif italic text-3xl tracking-wide text-white uppercase">
                Drill Completed
              </h2>
              <p className="text-sm text-gray-400 max-w-md">
                {gameState.winner === 'player-1' 
                  ? '🏅 Victory to the Emperor’s Finest! Cato Sicarius has secured the sector from Ork infamy.'
                  : '👹 Deff and Destruction! Nazdreg’s Ork boyz have overrun the planets and smashed the defense forces.'}
              </p>
              <button
                onClick={resetGame}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-heading font-bold rounded-xl transition-all shadow-lg active:scale-97 text-xs tracking-widest uppercase"
              >
                Launch New Training Combat
              </button>
            </div>
          ) : null}



          {/* THE PLANET ROW */}
          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-xs text-gray-400 uppercase tracking-widest flex items-center justify-between px-1 py-1">
              <span className="flex items-center gap-1.5 font-sans">
                <Globe className="w-3.5 h-3.5 text-gray-500" />
                Tactical Sector Planet Row
              </span>
              {gameState.planetDeck && gameState.planetDeck.length > 0 && (
                <span className="text-[9px] text-zinc-400 font-mono tracking-widest bg-zinc-900/60 border border-white/5 px-2 py-0.5 rounded-md uppercase">
                  📦 Planet Deck: {gameState.planetDeck.length} Remaining (Face-Down)
                </span>
              )}
            </h2>

            <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-2">
              {gameState.planets.map((planet, idx) => {
                const { p1Command, aiCommand } = getPlanetCommandTally(planet);
                
                // Active battle highlight
                const isUnderConflict = gameState.phase === 'COMBAT' && gameState.combat.activePlanetIndex === planet.index;

                // Units at this planet
                const unitsHere = getUnitsAtPlanet(gameState, planet.id);
                const smHere = unitsHere.filter(u => u.controllerId === 'player-1' && u.type !== 'Warlord');
                const orkHere = unitsHere.filter(u => u.controllerId === 'ai-1' && u.type !== 'Warlord');

                const hasP1Warlord = hasWarlordAtPlanet(gameState, 'player-1', planet.id);
                const hasAiWarlord = hasWarlordAtPlanet(gameState, 'ai-1', planet.id);

                return (
                  <PlanetDisplay
                    key={planet.id}
                    planet={planet}
                    index={idx}
                    gameState={gameState}
                    p1Command={p1Command}
                    aiCommand={aiCommand}
                    isUnderConflict={isUnderConflict}
                    hasP1Warlord={hasP1Warlord}
                    hasAiWarlord={hasAiWarlord}
                    smHere={smHere}
                    orkHere={orkHere}
                    selectedAttackerId={selectedAttackerId}
                    handleDeclareAttackTarget={handleDeclareAttackTarget}
                    handleStartCombatClick={handleStartCombatClick}
                    handleRetreatClick={handleRetreatClick}
                  />
                );
              })}
            </div>
          </section>

          {/* PLAYER COMMANDER BOARD (BOTTOM TIER) */}
          <div className="bg-amber-950/[0.03] border border-white/5 rounded-2xl p-4 space-y-4 shadow-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-900/5 via-transparent to-transparent pointer-events-none" />
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-2 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-550 animate-pulse" />
                <h3 className="font-mono text-amber-500 font-bold uppercase tracking-widest text-[10px] flex items-center gap-1.5">
                  👤 PLAYER COMMANDER BOARD
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-mono text-[9px]">
                <div className="bg-black/40 border border-white/10 px-2 py-0.5 rounded flex items-center gap-1.5">
                  <Coins className="w-3 h-3 text-amber-500" />
                  <span>Resources: <strong className="text-amber-500 font-bold">{p1.resources}</strong></span>
                </div>
                <div className="bg-black/40 border border-white/10 px-2 py-0.5 rounded">
                  <span>Deck: <strong className="text-gray-300 font-bold">{p1.deck.length}</strong></span>
                </div>
                <div className="bg-black/40 border border-white/10 px-2 py-0.5 rounded">
                  <span>Discard: <strong className="text-gray-450 font-bold">{p1.discard.length}</strong></span>
                </div>
                <div className="bg-black/40 border border-white/10 px-2 py-0.5 rounded flex items-center gap-1.5">
                  <span className="text-gray-500 uppercase font-semibold text-[8px] mr-0.5">Symbols:</span>
                  <span className="text-cyan-400 font-bold flex items-center gap-0.5" title="Tech">🧪 {p1Symbols.Tech}</span>
                  <span className="text-blue-400 font-bold flex items-center gap-0.5" title="Strongpoint">🛡️ {p1Symbols.Strongpoint}</span>
                  <span className="text-rose-400 font-bold flex items-center gap-0.5" title="Material">💎 {p1Symbols.Material}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
              
              {/* GARRISON OUTPOST COLUMN */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-heading font-semibold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2 font-mono">
                    🏗️ GARRISON OUTPOST (HQ & SUPPORTS)
                  </h2>
                </div>

              {/* Outpost grid: Support cards built, Warlord in Garrison */}
              <div className="bg-black/40 rounded-xl border border-white/10 p-3 flex flex-wrap gap-2.5 min-h-[180px] content-start items-start overflow-y-auto">
                {p1.hq.filter(c => c.location === 'HQ').length === 0 ? (
                  <div className="text-center w-full text-xs text-gray-500 italic py-10 font-mono">
                    HQ Orbit and Outpost are cleared.
                  </div>
                ) : (
                  p1.hq.filter(c => c.location === 'HQ').map(c => {
                    const isSupport = c.type === 'Support';
                    const isSelected = selectedHQCardId === c.instanceId;
                    return (
                      <div key={c.instanceId} className="relative select-none shrink-0">
                        <CardDisplay
                          size="sm"
                          card={c}
                          isSelected={isSelected}
                          onClick={() => setSelectedHQCardId(c.instanceId === selectedHQCardId ? null : c.instanceId)}
                        />
                        {isSelected && isSupport && !c.isExhausted && (
                          <div className="absolute inset-x-0 -bottom-1 bg-black/95 border border-purple-500/30 rounded-lg p-1.5 shadow-xl z-20 text-center animate-slide-up">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExhaustSupportAbility(c.instanceId);
                              }}
                              className="w-full text-center py-1 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/40 text-purple-300 text-[8px] font-bold tracking-wider uppercase font-mono rounded"
                            >
                              Activate Ability
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CARDS IN HAND COLUMN */}
            <div className="lg:col-span-7 space-y-3">
              <h2 className="font-heading font-semibold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1 py-1 font-mono">
                🃏 CARDS IN YOUR HAND
              </h2>

              {/* Scrollable hand drawer */}
              <div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x select-none min-h-[180px]">
                {p1.hand.map(card => {
                  const canAfford = p1.resources >= card.cost;
                  return (
                    <div
                      key={card.instanceId}
                      className="snap-start shrink-0 relative"
                    >
                      <CardDisplay
                        size="mini"
                        card={card}
                        onClick={() => {
                          if (gameState.phase !== 'DEPLOY') return;
                          setSelectedHandCardId(card.instanceId === selectedHandCardId ? null : card.instanceId);
                        }}
                        isSelected={selectedHandCardId === card.instanceId}
                        canPlay={canAfford}
                      />

                      {/* Quick deploy overlay buttons if hand card index is actively selected */}
                      {selectedHandCardId === card.instanceId && gameState.phase === 'DEPLOY' && gameState.activePlayerId === 'player-1' && (
                        <div className="absolute inset-x-0 -bottom-2 bg-black/90 border border-white/10 rounded-xl p-3 shadow-2xl z-20 space-y-2 text-center animate-slide-up">
                          <span className="text-[9px] text-amber-500 font-mono tracking-widest block font-bold mb-1 uppercase">
                            🛠️ Play Actions
                          </span>
                          
                          {card.type === 'Army' && (
                            <div className="grid grid-cols-5 gap-1.5">
                              {gameState.planets.map((pl, i) => (
                                <button
                                  key={pl.id}
                                  onClick={() => handleDeployToPlanet(pl.id)}
                                  disabled={!canAfford}
                                  className="p-1 px-1.5 bg-[#0a0a0c] hover:bg-white/10 border border-white/10 rounded text-[9px] text-gray-300 font-bold font-mono hover:text-white transition-all disabled:opacity-40"
                                  title={`Deploy to ${pl.name}`}
                                >
                                  P{i + 1}
                                </button>
                              ))}
                            </div>
                          )}

                          {card.type === 'Support' && (
                            <button
                              onClick={handleBuildSupport}
                              disabled={!canAfford}
                              className="w-full py-1 bg-[#0a0a0c] hover:bg-white/10 text-purple-300 font-mono font-bold text-[9px] tracking-widest rounded border border-purple-800/40 uppercase"
                            >
                              Build Support Structure
                            </button>
                          )}

                          {card.type === 'Event' && (
                            <div className="space-y-1">
                              <span className="text-[8px] text-gray-400 block font-mono">Select target combat unit:</span>
                              <div className="flex flex-wrap gap-1 justify-center max-h-[100px] overflow-y-auto">
                                {/* Collect all units across current planets */}
                                {gameState.planets.map(p => {
                                  return getUnitsAtPlanet(gameState, p.id).map(u => (
                                    <button
                                      key={u.instanceId}
                                      onClick={() => handleCastEvent(u.instanceId)}
                                      className="px-1.5 py-0.5 bg-[#0a0a0c] hover:bg-white/10 border border-white/5 text-[8px] font-mono rounded text-gray-300"
                                    >
                                      {u.name.substring(0, 10)}
                                    </button>
                                  ));
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        </div>

        {/* LOG PANEL & RULES: 3 cols broad (right margin) */}
        <div className="col-span-12 xl:col-span-3 space-y-6">
          
          {/* DEPLOYMENT STATUS WIDGET */}
          {gameState.phase === 'DEPLOY' && (
            <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3 font-mono text-xs shadow-lg animate-fade-in">
              <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                <span className={`w-2 h-2 rounded-full ${gameState.activePlayerId === 'player-1' ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`} />
                <span className="font-mono text-cyan-450 tracking-wider text-[11px] font-bold">DEPLOYMENT STATUS:</span>
              </div>
              
              <div className="text-gray-300 text-xs leading-relaxed">
                {gameState.activePlayerId === 'player-1' ? (
                  <span>Your turn to deploy cards or pass</span>
                ) : (
                  <span className="italic text-gray-400">Ork AI is deploying troops...</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 pt-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500 font-semibold uppercase">Player Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    gameState.playersPassedDeploy && gameState.playersPassedDeploy['player-1'] 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/10' 
                      : 'bg-green-500/15 text-green-400 border border-green-500/10'
                  }`}>
                    {gameState.playersPassedDeploy && gameState.playersPassedDeploy['player-1'] ? 'PASSED' : 'ACTIVE'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-gray-500 font-semibold uppercase">Ork AI:</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    gameState.playersPassedDeploy && gameState.playersPassedDeploy['ai-1'] 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/10' 
                      : 'bg-green-500/15 text-green-400 border border-green-500/10'
                  }`}>
                    {gameState.playersPassedDeploy && gameState.playersPassedDeploy['ai-1'] ? 'PASSED' : 'ACTIVE'}
                  </span>
                </div>
              </div>

              <button
                disabled={gameState.activePlayerId !== 'player-1' || (gameState.playersPassedDeploy && gameState.playersPassedDeploy['player-1'])}
                onClick={handlePassDeploy}
                className="w-full mt-1 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 border border-white/15 rounded font-bold tracking-wider uppercase transition-colors text-[10px] text-center"
              >
                ⏱️ Pass Deployment
              </button>
            </div>
          )}

          {/* COMMITMENTS READY TO REVEAL WIDGET */}
          {gameState.warlordCommitmentsPlaced && (
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl p-4 space-y-3 font-mono text-xs shadow-lg animate-fade-in text-center">
              <div className="flex items-center justify-center gap-1.5 border-b border-white/5 pb-2">
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                <span className="font-mono text-amber-450 tracking-wider text-[11px] font-bold uppercase">
                  🤫 DIAL CO-ORDINATES LOCKED
                </span>
              </div>
              <p className="text-gray-300 text-[10px] leading-relaxed">
                Both commanders have logged their target planet sectors secretly on their dials.
              </p>
              <button
                onClick={handleRevealWarlords}
                className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 font-bold border border-amber-600/50 text-black text-[10px] tracking-widest uppercase rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                Reveal Commitments <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* SECRET WARLORD COMMITMENT RADIAL DIAL */}
          {gameState.phase === 'COMMAND' && !gameState.warlordCommitmentsRevealed && (
            <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3 shadow-lg animate-fade-in relative text-center">
              <div className="flex items-center justify-center gap-1.5 border-b border-white/5 pb-2">
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                <span className="font-serif italic text-xs tracking-wide text-white uppercase">
                  ⚔️ Warlord commitment dial
                </span>
              </div>
              <p className="text-[10px] text-gray-400 leading-normal">
                Commit Captain Cato Sicarius secretly to a planet sector. Nazdreg will commit secretly too.
              </p>

              <div className="grid grid-cols-5 gap-1 pt-1">
                {gameState.planets.map((planet, idx) => (
                  <button
                    key={planet.id}
                    onClick={() => handleCommitWarlord(idx)}
                    disabled={gameState.warlordCommitments['player-1'] !== null}
                    className={`py-2 px-1 rounded border font-mono text-center text-xs tracking-wider font-bold transition-all ${
                      gameState.warlordCommitments['player-1'] === idx
                        ? 'bg-white text-black border-white scale-102 font-extrabold shadow shadow-white/10'
                        : 'bg-black/20 hover:bg-white/5 hover:border-white/20 border-white/10 text-gray-300'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    <span className="block text-[7px] scale-90 tracking-tighter opacity-70 mt-0.5 uppercase">
                      {planet.name.substring(0, 5)}
                    </span>
                  </button>
                ))}
              </div>

              {gameState.warlordCommitments['player-1'] !== null && (
                <div className="text-[10px] text-yellow-500 font-mono italic animate-pulse-slow">
                  Locked on Planet {gameState.warlordCommitments['player-1'] + 1}. Waiting for AI...
                </div>
              )}
            </div>
          )}

          {/* WARLORDS ALIGNED & DEPLOYED RESOLVE STRUGGLES WIDGET */}
          {gameState.warlordCommitmentsRevealed && gameState.commandStrugglesResolved === false && (
            <div className="bg-gradient-to-r from-cyan-500/15 via-cyan-500/5 to-transparent border border-cyan-500/30 rounded-xl p-4 space-y-3 font-mono text-xs shadow-lg animate-fade-in text-center">
              <div className="flex items-center justify-center gap-1.5 border-b border-white/5 pb-2">
                <Coins className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="font-mono text-cyan-400 tracking-wider text-[11px] font-bold uppercase">
                  🪐 WARLORDS ALIGNED
                </span>
              </div>
              <p className="text-gray-300 text-[10px] leading-relaxed">
                Captain Cato Sicarius and Nazdreg are positioned. Execute struggles to claim materials and card draws!
              </p>
              <button
                onClick={handleResolveCommandStruggles}
                className="w-full py-1.5 bg-cyan-500 hover:bg-cyan-600 font-bold border border-cyan-600 text-black text-[10px] tracking-widest uppercase rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                Resolve Command Struggles <Coins className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* PLANET BATTLE ABILITY DECISION WIDGET */}
          {gameState.pendingPlanetBattleAbilityTrigger && (() => {
            const pending = gameState.pendingPlanetBattleAbilityTrigger;
            const planet = gameState.planets.find(p => p.id === pending.planetId);
            if (!planet) return null;
            return (
              <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl p-4 space-y-3 font-mono text-xs shadow-lg animate-fade-in text-center">
                <div className="flex items-center justify-center gap-1.5 border-b border-white/5 pb-2">
                  <Globe className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span className="font-mono text-amber-450 tracking-wider text-[11px] font-bold uppercase">
                    🪐 PLANET BATTLE TRIGGER
                  </span>
                </div>
                <p className="text-gray-300 text-[10px] leading-relaxed">
                  You captured <strong className="text-white">{planet.name}</strong>! Do you want to trigger its Battle ability?
                </p>
                <div className="text-[9.5px] text-amber-200/90 bg-black/45 border border-white/5 p-2 rounded text-left max-h-[85px] overflow-y-auto italic">
                  {planet.name === 'Elouith' && "Search the top 3 cards of your deck for a card. Add it to your hand, and place the remaining cards on the bottom of your deck in any order."}
                  {planet.name === 'Iridial' && "Remove all damage from a target unit."}
                  {planet.name === 'Osus IV' && "Take 1 Resource from your opponent."}
                  {planet.name === 'Carnath' && "Trigger the Battle ability of another planet in play."}
                  {planet.name === 'Tarrus' && "If you control fewer units than your opponent, gain 3 Resources or draw 3 cards."}
                  {planet.name === 'Barlus' && "Discard 1 card at random from your opponent's hand."}
                  {planet.name === "Y'varn" && "Each player puts a unit into play from his hand at his HQ."}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolvePlanetBattleAbilityChoice(true)}
                    className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 font-bold border border-amber-600 text-black text-[10px] tracking-widest uppercase rounded transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    ✅ Yes
                  </button>
                  <button
                    onClick={() => handleResolvePlanetBattleAbilityChoice(false)}
                    className="flex-1 py-1.5 bg-white/10 hover:bg-white/15 font-bold border border-white/20 text-white text-[10px] tracking-widest uppercase rounded transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    ❌ No
                  </button>
                </div>
              </div>
            );
          })()}

          {/* COMBAT PHASE DEEP OVERVIEW WIDGET */}
          {gameState.phase === 'COMBAT' && activeCombatPlanet && !gameState.isGameOver && !gameState.combatPlanetAwaitingAcknowledgement && !gameState.pendingPlanetBattleAbilityTrigger && (
            <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3 shadow-lg animate-fade-in relative text-center">
              <div className="flex items-center justify-center gap-1.5 border-b border-white/5 pb-2">
                <Swords className="w-4 h-4 text-red-500" />
                <span className="font-mono text-red-500 tracking-wider text-[11px] font-bold uppercase">
                  ⚔️ BATTLE: {activeCombatPlanet.name.substring(0, 10)}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 font-mono space-y-1">
                <div>Sub-phase: <strong className="text-yellow-500 uppercase">{gameState.combat.subPhase}</strong></div>
                <div>Turn: <strong>{gameState.activePlayerId === 'player-1' ? '👤 YOU' : '🤖 ORK AI'}</strong></div>
              </div>

              {/* ACTION DIALOGS BASED ON COMBAT STATE */}
              <div className="flex flex-col gap-2 pt-1">
                {gameState.combat.subPhase === 'SHIELD_PROMPT' && gameState.activePlayerId === 'player-1' && (
                  <div className="flex flex-col gap-1.5 bg-black/40 p-2 rounded border border-sky-500/30 animate-pulse text-center">
                    <span className="text-[9px] text-sky-455 font-mono tracking-wider font-bold">🛡️ DISCARD SHIELD?</span>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {p1.hand.filter(c => c.shields > 0).map(sc => (
                        <button
                          key={sc.instanceId}
                          onClick={() => handleShieldDecision(sc.instanceId)}
                          className="px-2 py-1 text-[9px] bg-sky-950/40 hover:bg-sky-900/60 border border-sky-700/40 rounded text-sky-300 font-bold transition-colors cursor-pointer"
                          title={sc.name}
                        >
                          {sc.name.split(' ').slice(-1)} (+{sc.shields}🛡️)
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleShieldDecision('none')}
                      className="w-full py-1 text-[9px] bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-405 font-bold transition-colors cursor-pointer"
                    >
                      Use No Shield (Take damage)
                    </button>
                  </div>
                )}

                {gameState.combat.subPhase === 'RETREAT' && gameState.activePlayerId === 'player-1' && (
                  <div className="flex flex-col gap-1.5 bg-black/40 p-2 rounded border border-white/10 text-center">
                    <span className="text-[9px] text-amber-500 font-mono uppercase tracking-widest font-bold">🏳️ Retreat ready forces</span>
                    <button
                      onClick={handleDoneRetreating}
                      className="w-full py-1 bg-white/10 hover:bg-white/15 border border-white/25 text-white text-[9px] font-bold tracking-widest uppercase rounded transition-colors cursor-pointer"
                    >
                      Done Retreating
                    </button>
                  </div>
                )}

                {(gameState.combat.subPhase === 'MELEE' || gameState.combat.subPhase === 'RANGED') && gameState.activePlayerId === 'player-1' && (
                  <div className="flex flex-col gap-2 w-full">
                    {selectedAttackerId && (() => {
                      const warlord = p1.hq.find(u => u.type === 'Warlord');
                      return warlord && selectedAttackerId === warlord.instanceId && !warlord.isExhausted ? (
                        <button
                          onClick={handleRetreatWarlordActiveTurn}
                          className="w-full py-1.5 bg-red-950/50 hover:bg-red-900/60 border border-red-900/40 text-red-400 text-[10px] font-bold tracking-widest uppercase rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          🏃 Exhaust Warlord to Retreat
                        </button>
                      ) : null;
                    })()}

                    <button
                      onClick={handlePassCombatAction}
                      className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 border border-amber-600/40 text-black text-[10px] font-bold tracking-widest uppercase rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      ⏮️ Pass Action
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STRUGGLES RESOLVED PROCEED TO COMBAT WIDGET */}
          {gameState.commandStrugglesResolved && (
            <div className="bg-gradient-to-r from-purple-500/15 via-purple-500/5 to-transparent border border-purple-500/30 rounded-xl p-4 space-y-3 font-mono text-xs shadow-lg animate-fade-in text-center">
              <div className="flex items-center justify-center gap-1.5 border-b border-white/5 pb-2">
                <Trophy className="w-4 h-4 text-purple-400 animate-pulse" />
                <span className="font-mono text-purple-450 tracking-wider text-[11px] font-bold uppercase">
                  📈 STRUGGLES COMPUTED
                </span>
              </div>
              <p className="text-gray-300 text-[10px] leading-relaxed">
                Resource flows and card draws have been allocated. Advance into the combat stage.
              </p>
              <button
                onClick={handleProceedToCombatPhase}
                className="w-full py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 font-bold text-white text-[10px] tracking-widest uppercase rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                Begin Sector Combat ⚔️ <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* SECTOR BATTLE CONCLUDED WIDGET */}
          {gameState.combatPlanetAwaitingAcknowledgement && (
            <div className="bg-gradient-to-r from-red-500/15 via-red-500/5 to-transparent border border-red-500/30 rounded-xl p-4 space-y-3 font-mono text-xs shadow-lg animate-fade-in text-center">
              <div className="flex items-center justify-center gap-1.5 border-b border-white/5 pb-2">
                <Swords className="w-4 h-4 text-red-550 animate-pulse" />
                <span className="font-mono text-red-450 tracking-wider text-[11px] font-bold uppercase">
                  🏅 BATTLE CONCLUDED
                </span>
              </div>
              <p className="text-gray-300 text-[10px] leading-relaxed">
                Forces on the active sector have resolved their clash. Capture/retreats are finalized.
              </p>
              <button
                onClick={handleAcknowledgeCombatPlanet}
                className="w-full py-1.5 bg-red-650 hover:bg-red-700 font-bold border border-red-600 text-white text-[10px] tracking-widest uppercase rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 animate-pulse"
              >
                Next Sector <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          <LogPanel logs={gameState.log} />
          
          <RulesPanel />
        </div>

      </main>

      {/* RULES TOOL DRAWER MODAL OVERLAY */}
      {showRulesDrawer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6 transition-all animate-fade-in">
          <div className="bg-black/95 border border-white/10 p-6 rounded-2xl max-w-lg w-full relative space-y-4">
            <button
              onClick={() => setShowRulesDrawer(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold text-lg cursor-pointer"
            >
              ✕
            </button>
            <RulesPanel />
          </div>
        </div>
      )}

      {/* FOOTER credit and portal */}
      <footer className="py-4 text-center text-[10px] text-slate-600 border-t border-slate-900 font-mono">
        Warhammer 40,000 Conquest adaptation client rules sandbox. Non-profit tactical prototype.
      </footer>

    </div>
  );
}
