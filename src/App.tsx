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
  completeCombatRoundAndReady, 
  runAiTurn, 
  getUnitsAtPlanet, 
  getPlacedUnitsForPlayer,
  hasWarlordAtPlanet,
  passCombatAction
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
      completeCombatRoundAndReady(next);
      return next;
    });
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

          {/* STEP-BY-STEP PHASE TRANSITION PANEL */}
          {!gameState.isGameOver && (
            <div className="w-full space-y-3">
              {/* 1. Commitments placed, awaiting Reveal */}
              {gameState.warlordCommitmentsPlaced && (
                <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 animate-slide-up shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 shrink-0">
                      <Sparkles className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-white uppercase tracking-widest flex items-center gap-1.5">
                        🤫 Coordinate Dial Prepared
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-sans">
                        Both commanders have logged their target planet sectors secretly on their dials. Ready to disclose choices?
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRevealWarlords}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-655 font-bold border border-amber-600/50 text-black text-[10px] tracking-widest uppercase rounded-xl transition-all shadow-md shadow-black/80 flex items-center gap-2 cursor-pointer"
                  >
                    Reveal Warlord Commitments <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* 2. Commitments revealed, awaiting Command Struggles resolution */}
              {gameState.warlordCommitmentsRevealed && gameState.commandStrugglesResolved === false && (
                <div className="bg-gradient-to-r from-cyan-500/15 via-cyan-500/5 to-transparent border border-cyan-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 animate-slide-up shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20 shrink-0">
                      <Coins className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-white uppercase tracking-widest">
                        🪐 Warlords Aligned & Deployed
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-sans">
                        Captain Cato Sicarius and Nazdreg are positioned on their target worlds. Execute struggles to claim strategic materials and intel card draws!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleResolveCommandStruggles}
                    className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 font-bold border border-cyan-600 text-black text-[10px] tracking-widest uppercase rounded-xl transition-all shadow-md shadow-black/80 flex items-center gap-2 cursor-pointer"
                  >
                    Resolve Command Struggles <Coins className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* 3. Command Struggles resolved, awaiting proceed to Combat Phase */}
              {gameState.commandStrugglesResolved && (
                <div className="bg-gradient-to-r from-purple-500/15 via-purple-500/5 to-transparent border border-purple-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 animate-slide-up shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20 shrink-0">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-white uppercase tracking-widest">
                        📈 Struggles Computed
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-sans">
                        Resource flow and card draws have been tallied and allocated to the log records. Advance into the combat stage!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleProceedToCombatPhase}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 font-bold text-white text-[10px] tracking-widest uppercase rounded-xl transition-all shadow-md shadow-black/80 flex items-center gap-2 cursor-pointer"
                  >
                    Begin Sector Combat ⚔️ <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* 4. Combat planet awaiting checklist acknowledgement */}
              {gameState.combatPlanetAwaitingAcknowledgement && (
                <div className="bg-gradient-to-r from-red-500/15 via-red-500/5 to-transparent border border-red-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 animate-slide-up shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 shrink-0">
                      <Swords className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-xs text-white uppercase tracking-widest">
                        🏅 Sector Battle Concluded
                      </h4>
                      <p className="text-[10px] text-gray-400 mt-1 font-sans">
                        Forces on the active sector have resolved their clash. Survival, capture, or retreat consequences are finalized. Check details in the logs.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAcknowledgeCombatPlanet}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 font-bold border border-red-500 text-white text-[10px] tracking-widest uppercase rounded-xl transition-all shadow-md shadow-black/80 flex items-center gap-2 cursor-pointer animate-pulse"
                  >
                    Acknowledge & Proceed to next Sector <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

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

          {/* COMBAT PHASE DEEP OVERVIEW BANNER */}
          {gameState.phase === 'COMBAT' && activeCombatPlanet && !gameState.isGameOver && !gameState.combatPlanetAwaitingAcknowledgement && (
            <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20 shrink-0">
                  <Swords className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-xs text-white uppercase tracking-widest">
                    ⚔️ Resolving Battle: {activeCombatPlanet.name} (Planet {activeCombatPlanet.index + 1})
                  </h4>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                    Sub-phase: <strong className="text-yellow-500 uppercase">{gameState.combat.subPhase}</strong> | 
                    Active priority player: <strong>{gameState.activePlayerId === 'player-1' ? '👤 YOU' : '🤖 ORK AI'}</strong>
                  </p>
                </div>
              </div>

              {/* ACTION DIALOGS BASED ON COMBAT STATE */}
              <div className="flex flex-wrap items-center gap-2">
                {gameState.combat.subPhase === 'SHIELD_PROMPT' && gameState.activePlayerId === 'player-1' && (
                  <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-sky-500/30 animate-pulse">
                    <span className="text-[10px] text-sky-450 font-mono px-2 tracking-wider">🛡️ DISCARD SHIELD?</span>
                    {p1.hand.filter(c => c.shields > 0).map(sc => (
                      <button
                        key={sc.instanceId}
                        onClick={() => handleShieldDecision(sc.instanceId)}
                        className="px-2.5 py-1 text-[10px] bg-sky-950/40 hover:bg-sky-900/60 border border-sky-700/40 rounded text-sky-300 font-bold transition-colors"
                        title={sc.name}
                      >
                        {sc.name.split(' ').slice(-1)} (+{sc.shields}🛡️)
                      </button>
                    ))}
                    <button
                      onClick={() => handleShieldDecision('none')}
                      className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-400 font-bold transition-colors"
                    >
                      Use No Shield (Take damage)
                    </button>
                  </div>
                )}

                {gameState.combat.subPhase === 'RETREAT' && gameState.activePlayerId === 'player-1' && (
                  <div className="flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/10">
                    <span className="text-[10px] text-amber-500 font-mono uppercase tracking-widest">🏳️ Retreat ready forces:</span>
                    <button
                      onClick={handleDoneRetreating}
                      className="px-3.5 py-1 bg-white/10 hover:bg-white/15 border border-white/25 text-white text-[10px] font-bold tracking-widest uppercase rounded transition-colors"
                    >
                      Done Retreating (Rerun upkeep Check)
                    </button>
                  </div>
                )}

                {(gameState.combat.subPhase === 'MELEE' || gameState.combat.subPhase === 'RANGED') && gameState.activePlayerId === 'player-1' && (
                  <button
                    onClick={handlePassCombatAction}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 border border-amber-600/40 text-black text-[10px] font-bold tracking-widest uppercase rounded transition-colors flex items-center gap-1.5"
                  >
                    ⏮️ Pass Action
                  </button>
                )}
              </div>
            </div>
          )}

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
                const smHere = unitsHere.filter(u => u.controllerId === 'player-1');
                const orkHere = unitsHere.filter(u => u.controllerId === 'ai-1');

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

          {/* SECRET WARLORD COMMITMENT RADIAL DIAL */}
          {gameState.phase === 'COMMAND' && !gameState.warlordCommitmentsRevealed && (
            <section className="bg-black/40 border border-white/10 rounded-2xl p-6 text-center shadow-lg animate-fade-in relative">
              <div className="max-w-md mx-auto space-y-4">
                <Sparkles className="w-8 h-8 text-amber-500 mx-auto animate-pulse" />
                <h3 className="font-serif italic text-base tracking-wide text-white uppercase">
                  ⚔️ Secret Warlord Commitment Dial
                </h3>
                <p className="text-xs text-gray-400">
                  Choose which planet your Warlord, Cato Sicarius, commits his forces to. Nazdreg will secretly commit too! The reveal will launch command struggles.
                </p>

                <div className="grid grid-cols-5 gap-2 pt-2">
                  {gameState.planets.map((planet, idx) => (
                    <button
                      key={planet.id}
                      onClick={() => handleCommitWarlord(idx)}
                      disabled={gameState.warlordCommitments['player-1'] !== null}
                      className={`p-3 rounded-lg border font-mono text-center text-xs tracking-wider font-bold transition-all ${
                        gameState.warlordCommitments['player-1'] === idx
                          ? 'bg-white text-black border-white scale-102 font-extrabold shadow shadow-white/10'
                          : 'bg-black/20 hover:bg-white/5 hover:border-white/20 border-white/10 text-gray-300'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      <span className="block text-[8px] scale-90 tracking-tighter opacity-70 mt-0.5 uppercase">
                        {planet.name.substring(0,6)}
                      </span>
                    </button>
                  ))}
                </div>

                {gameState.warlordCommitments['player-1'] !== null && (
                  <div className="text-xs text-yellow-500 font-mono italic animate-pulse-slow">
                    Waiting for Warlords reveal... Locked on Planet {gameState.warlordCommitments['player-1'] + 1}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* BOTTOM SHELF: GARRISON OUTPOST & CARDS IN YOUR HAND SIDE-BY-SIDE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
            
            {/* GARRISON OUTPOST COLUMN */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-heading font-semibold text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2 font-mono">
                  <Coins className="w-3.5 h-3.5 text-gray-500" />
                  GARRISON OUTPOST (HQ & SUPPORTS)
                </h2>

                <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-white/10 text-[10px] font-mono">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <strong className="text-amber-500 font-bold font-mono">{p1.resources}</strong>
                  <span className="text-white/10">|</span>
                  <span className="text-green-400 font-bold">{p1.victoryDisplay.length}/3 🪐</span>
                </div>
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
