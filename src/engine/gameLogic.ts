import { GameState, CardInstance, CardDefinition, Planet, PlayerState, Phase, CombatSubPhase, ShieldDecisionContext } from './types';
import { CARD_DB, DECK_SM, DECK_ORK } from '../data/cards';
import { DEFAULT_PLANETS } from '../data/planets';

// A simple pseudo-random number generator to support seed action log if needed
class SeededRandom {
  private seed: number;
  constructor(seed: number = 42) {
    this.seed = seed;
  }
  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
}

const rng = new SeededRandom();

export const generateId = () => Math.random().toString(36).substring(2, 11);

export const createCardInstance = (cardId: string, controllerId: string): CardInstance => {
  const def = CARD_DB[cardId];
  if (!def) {
    throw new Error(`Card definition not found for id: ${cardId}`);
  }
  return {
    ...def,
    instanceId: `${cardId}-${generateId()}`,
    controllerId,
    damage: 0,
    isExhausted: false,
    isBloodied: false,
    location: 'HAND'
  };
};

export const shuffle = <T>(array: T[], randomFunc: () => number = () => Math.random()): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(randomFunc() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Log helper
export const addLog = (state: GameState, message: string, playerId?: string): void => {
  const timestamp = new Date().toISOString().substring(11, 19);
  state.log.unshift({ timestamp, message, playerId });
};

// Initialize Game
export const initGame = (seed: number = 42): GameState => {
  const p1Id = 'player-1';
  const aiId = 'ai-1';

  // Clone default planets to ensure game isolation/fresh stats each game
  const defaultPlanetsRaw: Planet[] = JSON.parse(JSON.stringify(DEFAULT_PLANETS));
  // Set up 5 active face-up planets, with the remaining 2 kept in the face-down planet deck.
  const activePlanets = defaultPlanetsRaw.slice(0, 5);
  const planetDeck = defaultPlanetsRaw.slice(5);

  activePlanets.forEach((p, idx) => {
    p.index = idx;
    p.isFirstPlanet = (idx === 0);
  });

  // Prepare randomized decks
  const smDeckRaw = DECK_SM.map(cid => createCardInstance(cid, p1Id));
  const orkDeckRaw = DECK_ORK.map(cid => createCardInstance(cid, aiId));

  const gameRng = new SeededRandom(seed);
  const smDeck = shuffle(smDeckRaw, () => gameRng.next());
  const orkDeck = shuffle(orkDeckRaw, () => gameRng.next());

  // Warlords starting in HQ
  const catoWarlord = { ...createCardInstance('sm-cato', p1Id), location: 'HQ' as const };
  const nazdregWarlord = { ...createCardInstance('ork-nazdreg', aiId), location: 'HQ' as const };

  const state: GameState = {
    turn: 1,
    phase: 'DEPLOY',
    firstPlayerId: p1Id,
    activePlayerId: p1Id,
    planets: activePlanets,
    planetDeck: planetDeck,
    isGameOver: false,
    log: [],
    players: {
      [p1Id]: {
        id: p1Id,
        faction: 'Space Marines',
        resources: 6, // Starter resources
        hand: [],
        deck: smDeck,
        discard: [],
        hq: [catoWarlord],
        victoryDisplay: []
      },
      [aiId]: {
        id: aiId,
        faction: 'Orks',
        resources: 6, // Starter resources
        hand: [],
        deck: orkDeck,
        discard: [],
        hq: [nazdregWarlord],
        victoryDisplay: []
      }
    },
    combat: {
      activePlanetIndex: -1,
      subPhase: 'NONE',
      unitsAttackedThisRound: []
    },
    warlordCommitments: {
      [p1Id]: null,
      [aiId]: null
    },
    warlordCommitmentsRevealed: false,
    deployPassCount: 0,
    playersPassedDeploy: {
      [p1Id]: false,
      [aiId]: false
    }
  };

  addLog(state, '🎯 Warhammer 40k: Conquest AI Trainer Started!');
  addLog(state, '🛡️ Player 1 command: Space Marines (Captain Cato Sicarius)');
  addLog(state, '🪓 AI command: Orks (Nazdreg)');

  // Draw 6 cards as starting hand
  drawCardsForPlayer(state, p1Id, 6);
  drawCardsForPlayer(state, aiId, 6);

  return state;
};

export const drawCardsForPlayer = (state: GameState, playerId: string, count: number) => {
  const p = state.players[playerId];
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (p.deck.length === 0) {
      // Out of cards triggers shuffle of discard pile back to deck
      if (p.discard.length > 0) {
        addLog(state, `🔄 ${p.faction} shuffles discard pile back to deck.`);
        p.deck = shuffle(p.discard.map(c => ({ ...c, location: 'HAND', damage: 0, isExhausted: false })), () => rng.next());
        p.discard = [];
      } else {
        break;
      }
    }
    const card = p.deck.pop();
    if (card) {
      card.location = 'HAND';
      p.hand.push(card);
      drawn++;
    }
  }
  if (drawn > 0) {
    addLog(state, `🃏 ${p.faction} draws ${drawn} card(s).`);
  }
};

// Deploy Unit
export const deployUnit = (state: GameState, playerId: string, cardInstanceId: string, planetId: string): boolean => {
  if (state.activePlayerId !== playerId) {
    addLog(state, `⚠️ It is not your turn to deploy!`, playerId);
    return false;
  }
  if (state.playersPassedDeploy && state.playersPassedDeploy[playerId]) {
    addLog(state, `⚠️ You have already passed during this Deploy Phase!`, playerId);
    return false;
  }

  const player = state.players[playerId];
  const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
  if (cardIndex === -1) return false;
  const card = player.hand[cardIndex];

  if (player.resources < card.cost) {
    addLog(state, `⚠️ Not enough resources to deploy ${card.name}!`, playerId);
    return false;
  }

  // Deduct resources
  player.resources -= card.cost;
  // Remove from hand
  player.hand.splice(cardIndex, 1);

  // Determine destination
  if (planetId === 'HQ') {
    card.location = 'HQ';
    player.hq.push(card);
    addLog(state, `🚀 Deployed ${card.name} into HQ. Cost: ${card.cost} Resources.`, playerId);
  } else {
    card.location = 'PLANET';
    card.locationId = planetId;
    player.hq.push(card);
    addLog(state, `🪐 Deployed ${card.name} to ${getPlanetName(state, planetId)}. Cost: ${card.cost} Resources.`, playerId);
    
    // Register custom triggers
    triggerDeployReactions(state, card, playerId, planetId);
  }

  // Reset pass counts, alternate turn
  state.deployPassCount = 0;
  alternateDeployTurn(state);
  return true;
};

const getPlanetName = (state: GameState, planetId: string): string => {
  const p = state.planets.find(pl => pl.id === planetId);
  return p ? p.name : planetId;
};

// Check Reactions for Space Marines & Neutrals
const triggerDeployReactions = (state: GameState, card: CardInstance, playerId: string, planetId: string) => {
  // Rogue Trader: deploy -> gain 1 resource
  if (card.id === 'neutral-roguetrader') {
    state.players[playerId].resources += 1;
    addLog(state, `💰 Rogue Trader deployed: Gain +1 Resource.`, playerId);
  }

  // Sicarius's Chosen: deploy to planet containing Warlord -> gain 1 resource
  if (card.id === 'sm-chosen') {
    const hasWarlord = hasWarlordAtPlanet(state, playerId, planetId);
    if (hasWarlord) {
      state.players[playerId].resources += 1;
      addLog(state, `👑 Sicarius's Chosen deployed near Warlord: Gain +1 Resource.`, playerId);
    }
  }

  // 10th Company Tactician: move another friendly unit at that planet to an adjacent planet
  if (card.id === 'sm-tactician') {
    const friendlyUnits = getUnitsAtPlanet(state, planetId).filter(u => u.controllerId === playerId && u.instanceId !== card.instanceId);
    if (friendlyUnits.length > 0) {
      // Find a safe/valid adjacent planet
      const planetIndex = state.planets.findIndex(p => p.id === planetId);
      const adjacentPlaces: string[] = [];
      if (planetIndex > 0) adjacentPlaces.push(state.planets[planetIndex - 1].id);
      if (planetIndex < state.planets.length - 1) adjacentPlaces.push(state.planets[planetIndex + 1].id);

      if (adjacentPlaces.length > 0) {
        const victim = friendlyUnits[0];
        const dest = adjacentPlaces[0]; // pick first one automatically for clean automation
        victim.locationId = dest;
        addLog(state, `🗺️ 10th Company Tactician redeploys ${victim.name} to adjacent planet ${getPlanetName(state, dest)}.`, playerId);
      }
    }
  }
};

export const hasWarlordAtPlanet = (state: GameState, playerId: string, planetId: string): boolean => {
  const pIdx = state.planets.findIndex(pl => pl.id === planetId);
  if (pIdx === -1) return false;
  const committedIndex = state.warlordCommitments[playerId];
  
  // Also check if Warlord card is physically present on that planet index
  const hqWarlord = state.players[playerId].hq.find(c => c.type === 'Warlord');
  const planetWarlords = getUnitsAtPlanet(state, planetId).filter(u => u.type === 'Warlord' && u.controllerId === playerId);
  return planetWarlords.length > 0 || (committedIndex === pIdx && hqWarlord !== undefined && state.warlordCommitmentsRevealed);
};

export const getCombatInitiativePlayer = (state: GameState, planetId: string): string => {
  const p1Warlord = hasWarlordAtPlanet(state, 'player-1', planetId);
  const aiWarlord = hasWarlordAtPlanet(state, 'ai-1', planetId);
  if (p1Warlord && !aiWarlord) {
    return 'player-1';
  }
  if (aiWarlord && !p1Warlord) {
    return 'ai-1';
  }
  return state.firstPlayerId;
};

export const getUnitsAtPlanet = (state: GameState, planetId: string): CardInstance[] => {
  const units: CardInstance[] = [];
  // Gather from players
  Object.values(state.players).forEach(p => {
    p.hand.concat(p.hq).concat(p.discard); // don't count hand/hq
    p.hq.forEach(c => {
      // Under commitment reveal, Warlords may temporarily count at planet
      if (c.type === 'Warlord' && state.warlordCommitmentsRevealed) {
        const commitmentIdx = state.warlordCommitments[c.controllerId];
        if (commitmentIdx !== null && state.planets[commitmentIdx]?.id === planetId) {
          units.push(c);
        }
      }
    });
    // Physically placed units
    const planetUnits = getPlacedUnitsForPlayer(state, p.id).filter(c => c.locationId === planetId);
    units.push(...planetUnits);
  });
  return units;
};

export const getPlacedUnitsForPlayer = (state: GameState, playerId: string): CardInstance[] => {
  // In our simplified structure, army units have flat location: PLANET
  // Let us iterate through the player's cards. We'll find them
  const player = state.players[playerId];
  const list: CardInstance[] = [];
  // Traverse card listings, just representing placing them
  // To avoid deep nested arrays we make sure we have flat arrays easily
  return player.deck.concat(player.hand).concat(player.discard).concat(player.hq).filter(c => c.location === 'PLANET');
};

// Play Support Card (Activated Ability)
export const playSupportCard = (state: GameState, playerId: string, cardInstanceId: string): boolean => {
  if (state.activePlayerId !== playerId) {
    addLog(state, `⚠️ It is not your turn to play support structures!`, playerId);
    return false;
  }
  if (state.playersPassedDeploy && state.playersPassedDeploy[playerId]) {
    addLog(state, `⚠️ You have already passed during this Deploy Phase!`, playerId);
    return false;
  }

  const player = state.players[playerId];
  const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
  if (cardIndex === -1) return false;
  const card = player.hand[cardIndex];

  if (player.resources < card.cost) {
    addLog(state, `⚠️ Not enough resources to build ${card.name}!`, playerId);
    return false;
  }

  player.resources -= card.cost;
  player.hand.splice(cardIndex, 1);
  card.location = 'HQ'; // Lives in player HQ
  player.hq.push(card);

  addLog(state, `🏛️ Put Support ${card.name} into HQ. Cost: ${card.cost} Resources.`, playerId);
  
  // Custom Rogue Trader reaction
  if (card.id === 'neutral-mine') {
    // Promethium Mine yields resources on tap
  }

  state.deployPassCount = 0;
  alternateDeployTurn(state);
  return true;
};

// Exhaust Support for Ability
export const triggerSupportAbility = (state: GameState, playerId: string, cardInstanceId: string, targetId?: string): boolean => {
  const player = state.players[playerId];
  const card = player.hq.find(c => c.instanceId === cardInstanceId);
  if (!card || card.isExhausted) return false;

  if (card.id === 'neutral-mine') {
    card.isExhausted = true;
    player.resources += 1;
    addLog(state, `💎 Exhausted ${card.name} Support: Gained +1 Resource.`, playerId);
    return true;
  }

  if (card.id === 'sm-flagship') {
    // Deal 2 damage to any non-warlord unit at a planet containing Captain Cato Sicarius
    const targetPlanet = state.planets.find(p => hasWarlordAtPlanet(state, 'player-1', p.id));
    if (!targetPlanet) {
      addLog(state, `⚠️ Cato Sicarius is not committed to any planet! Support action aborted.`, playerId);
      return false;
    }
    const enemies = getUnitsAtPlanet(state, targetPlanet.id).filter(u => u.controllerId === 'ai-1' && u.type !== 'Warlord');
    if (enemies.length === 0) {
      addLog(state, `⚠️ No valid non-warlord enemy units to target at ${targetPlanet.name}!`, playerId);
      return false;
    }
    
    // Auto-pick first enemy target or use targetId
    const victim = enemies.find(e => e.instanceId === targetId) || enemies[0];
    card.isExhausted = true;
    applyDamageToUnit(state, victim, 2);
    addLog(state, `🚢 Flagship orbital strike! Dealt 2 damage to ${victim.name} at ${targetPlanet.name}.`, playerId);
    return true;
  }

  if (card.id === 'ork-kannon') {
    // Exhaust to deal 1 damage to any unit at Planet 1 (index 0)
    const firstPlanet = state.planets.find(p => p.isFirstPlanet) || state.planets[0];
    const units = getUnitsAtPlanet(state, firstPlanet.id);
    if (units.length === 0) {
      addLog(state, `⚠️ No units to target at ${firstPlanet.name}!`, playerId);
      return false;
    }
    const victim = units.find(u => u.instanceId === targetId) || units[0];
    card.isExhausted = true;
    applyDamageToUnit(state, victim, 1);
    addLog(state, `💥 Ork Kannon bombards ${victim.name} on First Planet: Dealt 1 Damage.`, playerId);
    return true;
  }

  if (card.id === 'ork-kraktoof') {
    // Exhaust to ready any friendly Ork unit
    let friendlyOrks: CardInstance[] = [];
    state.planets.forEach(p => {
      friendlyOrks.push(...getUnitsAtPlanet(state, p.id).filter(u => u.controllerId === playerId && u.faction === 'Orks'));
    });
    const targetOrk = friendlyOrks.find(u => u.isExhausted);
    if (!targetOrk) {
      addLog(state, `⚠️ No exhausted friendly Ork units available to ready!`, playerId);
      return false;
    }
    card.isExhausted = true;
    targetOrk.isExhausted = false;
    addLog(state, `🏯 Kraktoof Hall readies friendly Ork unit ${targetOrk.name}!`, playerId);
    return true;
  }

  if (card.id === 'sm-stronghold') {
    let friendlySMs: CardInstance[] = [];
    state.planets.forEach(p => {
      friendlySMs.push(...getUnitsAtPlanet(state, p.id).filter(u => u.controllerId === playerId && u.faction === 'Space Marines'));
    });
    const targetSM = friendlySMs.find(u => u.isExhausted);
    if (!targetSM) {
      addLog(state, `⚠️ No exhausted friendly Space Marine units available to ready!`, playerId);
      return false;
    }
    card.isExhausted = true;
    targetSM.isExhausted = false;
    addLog(state, `🏯 Cato's Stronghold readies friendly Space Marine unit ${targetSM.name}!`, playerId);
    return true;
  }

  if (card.id === 'sm-fortress') {
    card.isExhausted = true;
    player.resources += 1;
    addLog(state, `🏢 Fortress-Monastery activated: Gained +1 Resource.`, playerId);
    return true;
  }

  if (card.id === 'sm-ironhalo') {
    const cato = player.hq.find(u => u.id === 'sm-cato') ||
                 state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)).find(u => u.id === 'sm-cato');
    if (!cato || cato.damage === 0) {
      addLog(state, `⚠️ Captain Cato Sicarius is not injured or in play!`, playerId);
      return false;
    }
    card.isExhausted = true;
    cato.damage = Math.max(0, cato.damage - 1);
    addLog(state, `😇 Activated Iron Halo: Cato Sicarius absorbs holy energy and heals 1 Damage!`, playerId);
    return true;
  }

  if (card.id === 'tau-ionrifle') {
    let allEnemies: CardInstance[] = [];
    state.planets.forEach(p => {
      allEnemies.push(...getUnitsAtPlanet(state, p.id).filter(u => u.controllerId !== playerId));
    });
    const victim = allEnemies.find(u => u.instanceId === targetId) || allEnemies[0];
    if (!victim) {
      addLog(state, `⚠️ No enemies in play to target with the Ion Rifle!`, playerId);
      return false;
    }
    card.isExhausted = true;
    applyDamageToUnit(state, victim, 1);
    addLog(state, `🔫 Ion Rifle discharges! Dealt 1 splash damage to ${victim.name}.`, playerId);
    return true;
  }

  return false;
};

// Play Event Action
export const playEventCard = (state: GameState, playerId: string, cardInstanceId: string, targetId: string): boolean => {
  if (state.activePlayerId !== playerId) {
    addLog(state, `⚠️ It is not your turn to play event cards!`, playerId);
    return false;
  }
  // Events are played during DEPLOY phase, protect against playing after pass
  if (state.phase === 'DEPLOY' && state.playersPassedDeploy && state.playersPassedDeploy[playerId]) {
    addLog(state, `⚠️ You have already passed during this Deploy Phase!`, playerId);
    return false;
  }

  const player = state.players[playerId];
  const cardIndex = player.hand.findIndex(c => c.instanceId === cardInstanceId);
  if (cardIndex === -1) return false;
  const card = player.hand[cardIndex];

  if (player.resources < card.cost) {
    addLog(state, `⚠️ Not enough resources to cast ${card.name}!`, playerId);
    return false;
  }

  player.resources -= card.cost;
  player.hand.splice(cardIndex, 1);
  card.location = 'DISCARD';
  player.discard.push(card);

  addLog(state, `⚡ Played Event ${card.name}!`, playerId);

  if (card.id === 'sm-fury') {
    // Treat Cato Sicarius as making an immediate combat attack (deals 3 damage to any unit at Cato's planet)
    const catoWarlord = state.players['player-1'].hq.find(u => u.id === 'sm-cato') ||
                        state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)).find(u => u.id === 'sm-cato');
    let planetId = 'planet-0';
    if (catoWarlord && catoWarlord.locationId) {
      planetId = catoWarlord.locationId;
    } else {
      const catoPlanetIdx = state.warlordCommitments['player-1'];
      if (catoPlanetIdx !== null && catoPlanetIdx !== undefined) {
        planetId = state.planets[catoPlanetIdx]?.id || 'planet-0';
      }
    }
    const unitsAtPlanet = getUnitsAtPlanet(state, planetId);
    const enemies = unitsAtPlanet.filter(u => u.controllerId === 'ai-1');
    const victim = enemies.find(u => u.instanceId === targetId) || enemies[0];
    if (victim) {
      applyDamageToUnit(state, victim, 3);
      addLog(state, `⚔️ The Fury of Sicarius! Cato Sicarius strikes immediately, dealing 3 damage to ${victim.name}!`, playerId);
    } else {
      addLog(state, `⚔️ The Fury of Sicarius! No enemies at Cato's sector to strike.`, playerId);
    }
  }

  if (card.id === 'sm-droppod') {
    // Deploy free Army unit from hand directly into combat at currently committed planet (or Planet 1 as default)
    const hand = state.players[playerId].hand;
    const army = hand.find(c => c.type === 'Army');
    if (army) {
      const planetIdx = state.warlordCommitments[playerId] !== null && state.warlordCommitments[playerId] !== undefined ? state.warlordCommitments[playerId]! : 0;
      const planetId = state.planets[planetIdx]?.id || 'planet-0';
      const isCardInHand = hand.findIndex(c => c.instanceId === army.instanceId);
      if (isCardInHand !== -1) {
        hand.splice(isCardInHand, 1);
        army.location = 'PLANET';
        army.locationId = planetId;
        // Insert into active players cards tracking
        state.players[playerId].hq.push(army);
        addLog(state, `🚀 Drop Pod Assault! Deployed ${army.name} directly into combat sector ${getPlanetName(state, planetId)}!`, playerId);
      }
    } else {
      addLog(state, `🚀 Drop Pod Assault! No army units in hand to deploy.`, playerId);
    }
  }

  if (card.id === 'sm-indomitable') {
    // Prevent damage / heal 2 damage from friendly Space Marine
    let friendlySMs: CardInstance[] = [];
    state.planets.forEach(p => {
      friendlySMs.push(...getUnitsAtPlanet(state, p.id).filter(u => u.controllerId === playerId && u.faction === 'Space Marines'));
    });
    const injured = friendlySMs.find(u => u.damage > 0);
    if (injured) {
      injured.damage = Math.max(0, injured.damage - 2);
      addLog(state, `🛡️ Indomitable! Warded and healed 2 damage from frontline squad ${injured.name}.`, playerId);
    } else {
      addLog(state, `🛡️ Indomitable! Frontlines are secure (No injured primary units found).`, playerId);
    }
  }

  if (card.id === 'sm-exterminatus') {
    // Purge the first planet!
    const firstPlanet = state.planets.find(p => p.isFirstPlanet) || state.planets[0];
    const targets = getUnitsAtPlanet(state, firstPlanet.id).filter(u => u.type !== 'Warlord');
    targets.forEach(unit => {
      applyDamageToUnit(state, unit, 4);
    });
    addLog(state, `☣️ EXTERMINATUS! Cato Sicarius orders doomsday orbital bombardment of ${firstPlanet.name}! Dealt 4 damage to all ${targets.length} non-warlord units.`, playerId);
  }

  if (card.id === 'neutral-nomercy') {
    // Deals 2 extra combat damage to any unit
    let allEnemies: CardInstance[] = [];
    state.planets.forEach(p => {
      allEnemies.push(...getUnitsAtPlanet(state, p.id).filter(u => u.controllerId !== playerId));
    });
    const victim = allEnemies.find(u => u.instanceId === targetId) || allEnemies[0];
    if (victim) {
      applyDamageToUnit(state, victim, 2);
      addLog(state, `💥 No Mercy! Dealt 2 extra combat damage to target ${victim.name}.`, playerId);
    }
  }

  if (card.id === 'neutral-fallback') {
    // Move an exhausted unit back to safety/HQ
    let friendlyUnits: CardInstance[] = [];
    state.planets.forEach(p => {
      friendlyUnits.push(...getUnitsAtPlanet(state, p.id).filter(u => u.controllerId === playerId));
    });
    const exhausted = friendlyUnits.find(u => u.isExhausted);
    if (exhausted) {
      exhausted.location = 'HQ';
      exhausted.locationId = undefined;
      exhausted.isExhausted = false;
      addLog(state, `🏃 Fall Back! Returned exhausted unit ${exhausted.name} back to headquarters and readied them.`, playerId);
    } else if (friendlyUnits.length > 0) {
      const unit = friendlyUnits[0];
      unit.location = 'HQ';
      unit.locationId = undefined;
      addLog(state, `🏃 Fall Back! Ordered ${unit.name} to retreat to HQ.`, playerId);
    } else {
      addLog(state, `🏃 Fall Back! No tactical squads in forward sectors.`, playerId);
    }
  }

  if (card.id === 'ork-battlecry') {
    addLog(state, `📣 Battle Cry! All friendly Ork units surge with extra Waaagh! energy.`, playerId);
  }

  if (card.id === 'ork-snotling') {
    // Deal 1 damage to any unit
    let allUnits: CardInstance[] = [];
    state.planets.forEach(p => {
      allUnits.push(...getUnitsAtPlanet(state, p.id));
    });
    const victim = allUnits.find(u => u.instanceId === targetId) || allUnits[0];
    if (victim) {
      applyDamageToUnit(state, victim, 1);
      addLog(state, `💥 Snotling Attack! Dealt 1 damage to ${victim.name}.`, playerId);
    }
  }

  if (card.id === 'ork-squigbomb') {
    // Deal 3 damage to any unit
    let allUnits: CardInstance[] = [];
    state.planets.forEach(p => {
      allUnits.push(...getUnitsAtPlanet(state, p.id));
    });
    const victim = allUnits.find(u => u.instanceId === targetId) || allUnits[0];
    if (victim) {
      applyDamageToUnit(state, victim, 3);
      addLog(state, `💣 Squig Bombin' detonates! Dealt 3 massive damage to ${victim.name}.`, playerId);
    }
  }

  if (card.id === 'astra-suppressive') {
    // Exhaust/pin unit
    let allUnits: CardInstance[] = [];
    state.planets.forEach(p => {
      allUnits.push(...getUnitsAtPlanet(state, p.id));
    });
    const victim = allUnits.find(u => u.instanceId === targetId) || allUnits[0];
    if (victim) {
      victim.isExhausted = true;
      addLog(state, `💨 Suppressive Fire! Exhausted and pinned down ${victim.name}.`, playerId);
    }
  }

  if (card.id === 'ork-bigga') {
    // Draw 2 cards
    drawCardsForPlayer(state, playerId, 2);
    addLog(state, `📈 Bigga Is Betta! Drew 2 reinforcement cards.`, playerId);
  }

  state.deployPassCount = 0;
  alternateDeployTurn(state);
  return true;
};

// Apply damage and handle death
export const applyDamageToUnit = (state: GameState, unit: CardInstance, rawDamage: number) => {
  unit.damage += rawDamage;
  const currentHp = unit.hp;
  
  if (unit.damage >= currentHp) {
    // Dead! Move to discard pile
    destroyUnit(state, unit);
  } else if (unit.type === 'Warlord' && unit.damage >= (currentHp / 2) && !unit.isBloodied) {
    // Bloodied
    unit.isBloodied = true;
    addLog(state, `🩸 Warlord ${unit.name} is BLOODIED! ATK stats remain but danger is peak.`, unit.controllerId);
  }
};

const destroyUnit = (state: GameState, unit: CardInstance) => {
  const p = state.players[unit.controllerId];
  unit.location = 'DISCARD';
  
  // Remove from active HQ array (where both HQ and PLANET units are tracked)
  const hqIdx = p.hq.findIndex(u => u.instanceId === unit.instanceId);
  if (hqIdx !== -1) p.hq.splice(hqIdx, 1);
  
  p.discard.push(unit);

  addLog(state, `💀 Unit ${unit.name} was destroyed. Move to Discard pile.`, unit.controllerId);

  // Trigger Cato reaction if destroyed on Cato's planet
  const catoWarlord = state.players['player-1'].hq.find(u => u.id === 'sm-cato');
  if (catoWarlord && state.warlordCommitmentsRevealed) {
    const catoPlanetIdx = state.warlordCommitments['player-1'];
    if (catoPlanetIdx !== null) {
      const catoPlanetId = state.planets[catoPlanetIdx]?.id;
      if (unit.locationId === catoPlanetId || (unit.type === 'Warlord' && state.warlordCommitments['ai-1'] === catoPlanetIdx)) {
        state.players['player-1'].resources += 1;
        addLog(state, `👑 Cato Sicarius reactions on destruction: Gained +1 Resource.`, 'player-1');
      }
    }
  }

  // Check Game Over: If a Warlord is destroyed, immediately end the game!
  if (unit.type === 'Warlord') {
    state.isGameOver = true;
    state.winner = unit.controllerId === 'player-1' ? 'ai-1' : 'player-1';
    addLog(state, `🏆 GAME OVER! Warlord ${unit.name} was slain. ${state.winner === 'player-1' ? 'Space Marines' : 'Orks'} win!`);
  }
};

// Deploys priority alternation
const alternateDeployTurn = (state: GameState) => {
  const current = state.activePlayerId;
  const next = current === 'player-1' ? 'ai-1' : 'player-1';
  
  if (!state.playersPassedDeploy) {
    state.playersPassedDeploy = { 'player-1': false, 'ai-1': false };
  }

  if (state.playersPassedDeploy[next]) {
    if (state.playersPassedDeploy[current]) {
      startCommandPhase(state);
    } else {
      // Keep turn on the current player because next player has already passed and cannot deploy anymore
      state.activePlayerId = current;
    }
  } else {
    state.activePlayerId = next;
  }
};

// Player passes deployment
export const passDeployTurn = (state: GameState, playerId: string) => {
  if (state.activePlayerId !== playerId) return;
  if (!state.playersPassedDeploy) {
    state.playersPassedDeploy = { 'player-1': false, 'ai-1': false };
  }
  if (state.playersPassedDeploy[playerId]) return;

  state.playersPassedDeploy[playerId] = true;
  addLog(state, `⏱️ ${state.players[playerId].faction} passed during Deployment.`, playerId);
  
  const bothPassed = Object.values(state.playersPassedDeploy).every(p => p === true);
  if (bothPassed) {
    // Both pass: Deploy phase ends. Go to Command Phase!
    startCommandPhase(state);
  } else {
    alternateDeployTurn(state);
  }
};

// Start Command Phase
export const startCommandPhase = (state: GameState) => {
  state.phase = 'COMMAND';
  state.warlordCommitments = { 'player-1': null, 'ai-1': null };
  state.warlordCommitmentsRevealed = false;
  state.activePlayerId = state.firstPlayerId;
  addLog(state, `🪐 Phase transition: COMMAND STRUGGLE begins!`);
  addLog(state, `🤫 Players must commit their Warlords secretly to any of the 5 planets.`);
  
  // AI immediately makes its commitment pre-calculation
  aiSelectWarlordCommitment(state);
};

// Resolve Warlord Commitments and run struggle
export const commitWarlord = (state: GameState, playerId: string, planetIndex: number) => {
  state.warlordCommitments[playerId] = planetIndex;
  
  const allSet = Object.values(state.warlordCommitments).every(val => val !== null);
  if (allSet) {
    state.warlordCommitmentsPlaced = true;
    addLog(state, `🤐 Both commanders have locked their coordinates. Commitments are ready on the tactical dial!`);
  }
};

const aiSelectWarlordCommitment = (state: GameState) => {
  // Simple heuristic: AI chooses First Planet index (0) or the planet with highest command/materials
  // to pressure human, staying within valid remaining planets
  const maxIdx = state.planets.length;
  const targetIndex = Math.floor(rng.next() * Math.min(3, maxIdx));
  state.warlordCommitments['ai-1'] = targetIndex;
};

export const revealWarlordCommitments = (state: GameState) => {
  state.warlordCommitmentsPlaced = false;
  state.warlordCommitmentsRevealed = true;
  
  const p1PlanetIdx = state.warlordCommitments['player-1'] ?? 0;
  const aiPlanetIdx = state.warlordCommitments['ai-1'] ?? 0;
  
  const p1Planet = state.planets[p1PlanetIdx];
  const aiPlanet = state.planets[aiPlanetIdx];

  addLog(state, `👁️ Warlords revealed!`);
  addLog(state, `👑 Space Marines: Captain Cato Sicarius commits to ${p1Planet.name}!`, 'player-1');
  addLog(state, `🪓 Orks: Nazdreg commits to ${aiPlanet.name}!`, 'ai-1');

  // Trigger Nazdreg's Brutal buff logs
  if (aiPlanetIdx !== null) {
    addLog(state, `🟢 Nazdreg’s constant command logic: Orks committed alongside him gain Brutal keyword!`, 'ai-1');
  }

  // Stop for manual clicks
  state.commandStrugglesResolved = false;
};

export const executeCommandStruggle = (state: GameState) => {
  addLog(state, `📊 Computing Command Struggles across all planets...`);

  state.planets.forEach(p => {
    const p1Units = getUnitsAtPlanet(state, p.id).filter(u => u.controllerId === 'player-1');
    const aiUnits = getUnitsAtPlanet(state, p.id).filter(u => u.controllerId === 'ai-1');

    // Count command icons
    let p1Command = p1Units.reduce((acc, unit) => acc + (unit.isExhausted ? 0 : unit.commandIcons), 0);
    let aiCommand = aiUnits.reduce((acc, unit) => acc + (unit.isExhausted ? 0 : unit.commandIcons), 0);

    // If active Warlord is present and ready, add 2 command icons
    if (state.warlordCommitments['player-1'] === p.index) {
      const cato = state.players['player-1'].hq.find(u => u.id === 'sm-cato');
      if (cato && !cato.isExhausted) p1Command += cato.commandIcons;
    }
    if (state.warlordCommitments['ai-1'] === p.index) {
      const naz = state.players['ai-1'].hq.find(u => u.id === 'ork-nazdreg');
      if (naz && !naz.isExhausted) aiCommand += naz.commandIcons;
    }

    if (p1Command > 0 || aiCommand > 0) {
      let winnerId = '';
      if (p1Command > aiCommand) {
        winnerId = 'player-1';
      } else if (aiCommand > p1Command) {
        winnerId = 'ai-1';
      } else {
        // TIE: Initiative player wins tie-break!
        winnerId = state.firstPlayerId;
        addLog(state, `⚖️ Command Struggle tie at ${p.name}! First Player (holder of initiative) ${winnerId === 'player-1' ? 'Space Marines' : 'Orks'} wins.`);
      }

      const winnerState = state.players[winnerId];
      if (winnerState) {
        if (p.materials > 0) winnerState.resources += p.materials;
        if (p.cards > 0) drawCardsForPlayer(state, winnerId, p.cards);
        addLog(state, `📈 Winner at ${p.name}: ${winnerState.faction} with icons ${Math.max(p1Command, aiCommand)} vs ${Math.min(p1Command, aiCommand)}. Gain +${p.materials} Resources and +${p.cards} Card Draws.`);
      }
    } else {
      addLog(state, `🦗 ${p.name}: No ready command icons present. Struggle skipped.`);
    }
  });

  state.commandStrugglesResolved = true;
};

export const manualProceedToCombat = (state: GameState) => {
  state.commandStrugglesResolved = undefined;
  startCombatPhase(state);
};

// Start Combat Phase
export const startCombatPhase = (state: GameState) => {
  state.phase = 'COMBAT';
  addLog(state, `⚔️ Phase transition: COMBAT PHASE begins!`);
  
  // Find first planet that has units to battle, starting with Index 0
  // Combat resolves at First Planet AND planets containing Warlords
  state.combat = {
    activePlanetIndex: 0,
    subPhase: 'NONE',
    unitsAttackedThisRound: []
  };

  resolveNextCombatPlanet(state);
};

export const resolveNextCombatPlanet = (state: GameState) => {
  const currentIdx = state.combat.activePlanetIndex;
  if (currentIdx >= state.planets.length) {
    // Combat complete! Go to HQ Phase
    startHqPhase(state);
    return;
  }

  const planet = state.planets[currentIdx];
  const units = getUnitsAtPlanet(state, planet.id);
  
  // Determine if combat occurs: must contain units of opposing forces, OR must be First Planet
  const hasOpposingForces = units.some(u => u.controllerId === 'player-1') && units.some(u => u.controllerId === 'ai-1');
  const isWarlordHere = state.warlordCommitments['player-1'] === currentIdx || state.warlordCommitments['ai-1'] === currentIdx;
  const isFirst = planet.isFirstPlanet;

  if (hasOpposingForces && (isFirst || isWarlordHere)) {
    addLog(state, `📣 Combat initiated at ${planet.name}!`);
    state.combat.subPhase = 'RANGED';
    state.combat.unitsAttackedThisRound = [];
    
    const initPlayerId = getCombatInitiativePlayer(state, planet.id);
    state.activePlayerId = initPlayerId;
    addLog(state, `⚡ Battle Initiative belongs to ${state.players[initPlayerId].faction} for this planet.`);
    
    // Check if there are any ranged units to skirmish
    const rangedPresent = units.some(u => u.keywords.includes('Ranged') && !u.isExhausted);
    if (!rangedPresent) {
      addLog(state, `💨 No active Ranged units present. Proceeding to Melee attacks.`);
      state.combat.subPhase = 'MELEE';
    } else {
      addLog(state, `🏹 RANGED SKIRMISH step has begun. Only Ranged units can fire.`);
    }
  } else {
    // If only one faction has units here and it is the first planet, they win it uncontested!
    let didSplice = false;
    if (isFirst && units.length > 0) {
      const winnerId = units[0].controllerId;
      capturePlanet(state, winnerId, currentIdx);
      didSplice = true;

      // Pause here to notify the user of uncontested capture!
      state.combat.wasPlanetSplicedInResolution = true;
      state.combatPlanetAwaitingAcknowledgement = true;
      return;
    }
    
    // Skip to next planet
    if (!didSplice) {
      state.combat.activePlanetIndex++;
    }
    resolveNextCombatPlanet(state);
  }
};

const capturePlanet = (state: GameState, winnerId: string, planetIdx: number) => {
  const planet = state.planets[planetIdx];
  planet.capturedBy = winnerId;
  state.players[winnerId].victoryDisplay.push(planet);
  addLog(state, `🚩 Victory! ${state.players[winnerId].faction} captures planet ${planet.name}!`);

  // Move winner units at that planet back to HQ!
  const friendlyUnits = getUnitsAtPlanet(state, planet.id).filter(u => u.controllerId === winnerId);
  friendlyUnits.forEach(u => {
    u.location = 'HQ';
    u.locationId = undefined;
  });

  // Clean up and discard other forces remaining (e.g. AI units if they surrendered or uncontested survival)
  const remainingUnits = getUnitsAtPlanet(state, planet.id);
  remainingUnits.forEach(u => {
    if (u.location === 'PLANET') {
      u.location = 'DISCARD';
      u.locationId = undefined;
      const p = state.players[u.controllerId];
      const hqIdx = p.hq.findIndex(u2 => u2.instanceId === u.instanceId);
      if (hqIdx !== -1) p.hq.splice(hqIdx, 1);
      p.discard.push(u);
    }
  });

  // Splicing removes the planet from active list
  state.planets.splice(planetIdx, 1);

  // Draw a planet from the planet deck to replace the captured one if any left
  if (state.planetDeck && state.planetDeck.length > 0) {
    const newPlanet = state.planetDeck.shift();
    if (newPlanet) {
      state.planets.push(newPlanet);
      addLog(state, `🪐 A new sector has emerged from the planet deck: ${newPlanet.name}!`);
    }
  }

  // Recalculate remaining planets index and set the new index 0 as the first planet
  state.planets.forEach((p, idx) => {
    p.index = idx;
    p.isFirstPlanet = (idx === 0);
  });

  if (state.planets[0]) {
    addLog(state, `🚨 New First Planet of the galaxy is: ${state.planets[0].name}!`);
  }

  // Check shared planet victory: if 3 symbols of same type are collected
  checkPlanetSymbolVictory(state, winnerId);
};

const checkPlanetSymbolVictory = (state: GameState, playerId: string) => {
  const captured = state.players[playerId].victoryDisplay;
  const counts = { Tech: 0, Strongpoint: 0, Material: 0 };
  
  captured.forEach(p => {
    p.symbols.forEach(sym => {
      if (sym === 'Tech') counts.Tech++;
      if (sym === 'Strongpoint') counts.Strongpoint++;
      if (sym === 'Material') counts.Material++;
    });
  });

  if (counts.Tech >= 3 || counts.Strongpoint >= 3 || counts.Material >= 3) {
    state.isGameOver = true;
    state.winner = playerId;
    addLog(state, `👑 COGNITIVE VICTORY! ${state.players[playerId].faction} captured 3 matching planet symbols! Match over!`);
  }
};

// Declare Attack
export const declareAttack = (st: GameState, attackerId: string, targetId: string): boolean => {
  const planet = st.planets[st.combat.activePlanetIndex];
  const units = getUnitsAtPlanet(st, planet.id);
  
  const attacker = units.find(u => u.instanceId === attackerId);
  const target = units.find(u => u.instanceId === targetId);

  if (!attacker || !target) return false;
  if (attacker.isExhausted) return false;

  // Compute Base ATK
  let finalAtk = attacker.attack;
  
  // Apply Brutal
  if (attacker.keywords.includes('Brutal') || 
     (attacker.faction === 'Orks' && hasWarlordAtPlanet(st, 'ai-1', planet.id) && st.players['ai-1'].hq.some(u => u.id === 'ork-nazdreg'))) {
    finalAtk += attacker.damage;
  }

  // Tallassarian Tempest Blade Relic weapon: Cato Sicarius gets +2 ATK while it is in his Support array
  if (attacker.id === 'sm-cato' && st.players['player-1'].hq.some(u => u.id === 'sm-tempestblade')) {
    finalAtk += 2;
  }

  // Exhaust the attacker
  attacker.isExhausted = true;
  st.combat.unitsAttackedThisRound.push(attackerId);

  // Set pending damage to check shields!
  st.combat.pendingDamage = {
    attackerId: attacker.instanceId,
    targetId: target.instanceId,
    damageAmount: finalAtk,
    isArmorbane: attacker.keywords.includes('Armorbane')
  };

  addLog(st, `⚔️ ${attacker.name} attacks ${target.name} for ${finalAtk} raw damage!`, attacker.controllerId);

  // Prompt defender for shield if applicable
  const defenderId = target.controllerId;
  const defenderHasHandShield = st.players[defenderId].hand.some(c => c.shields > 0);
  
  if (defenderHasHandShield && !attacker.keywords.includes('Armorbane')) {
    st.combat.subPhase = 'SHIELD_PROMPT';
    st.activePlayerId = defenderId; // Let defender choose shield
    addLog(st, `🛡️ Waiting for ${st.players[defenderId].faction} to resolve Shields...`);
  } else {
    // No shield possible
    if (attacker.keywords.includes('Armorbane')) {
      addLog(st, `⛔ Armorbane prevents defending shields from being played!`);
    }
    applyPendingDamageNoShield(st);
  }

  return true;
};

// Apply pending damage without shield
export const applyPendingDamageNoShield = (state: GameState) => {
  const pending = state.combat.pendingDamage;
  if (!pending) return;

  const planet = state.planets[state.combat.activePlanetIndex];
  const units = getUnitsAtPlanet(state, planet.id);
  const target = units.find(u => u.instanceId === pending.targetId);

  if (target) {
    applyDamageToUnit(state, target, pending.damageAmount);
    addLog(state, `💥 Attack resolved! ${target.name} takes ${pending.damageAmount} Damage. Damage is now ${target.damage}/${target.hp}.`);
  }

  state.combat.pendingDamage = undefined;
  
  // Return priority back to attacking player, let next player attack
  advanceCombatSequence(state);
};

// Use shield to absorb damage
export const resolveShieldCard = (state: GameState, playerId: string, shieldCardInstanceId: string | 'none') => {
  const pending = state.combat.pendingDamage;
  if (!pending) return;

  const defender = state.players[playerId];
  const targetPlanet = state.planets[state.combat.activePlanetIndex];
  const target = getUnitsAtPlanet(state, targetPlanet.id).find(u => u.instanceId === pending.targetId);

  if (!target) return;

  if (shieldCardInstanceId === 'none') {
    applyDamageToUnit(state, target, pending.damageAmount);
    addLog(state, `❌ No shield used. ${target.name} takes ${pending.damageAmount} Damage.`);
  } else {
    const cardIdx = defender.hand.findIndex(c => c.instanceId === shieldCardInstanceId);
    if (cardIdx !== -1) {
      const shieldCard = defender.hand[cardIdx];
      const absorbValue = shieldCard.shields;
      
      // Calculate resulting damage
      const netDamage = Math.max(0, pending.damageAmount - absorbValue);
      
      // Move shield card to discard
      defender.hand.splice(cardIdx, 1);
      shieldCard.location = 'DISCARD';
      defender.discard.push(shieldCard);

      applyDamageToUnit(state, target, netDamage);
      addLog(state, `🛡️ Player discarded ${shieldCard.name} to shield ${absorbValue} damage! Net damage taken: ${netDamage}.`);
    }
  }

  state.combat.pendingDamage = undefined;
  advanceCombatSequence(state);
};

const advanceCombatSequence = (state: GameState) => {
  const planet = state.planets[state.combat.activePlanetIndex];
  const units = getUnitsAtPlanet(state, planet.id);
  
  const smRemaining = units.some(u => u.controllerId === 'player-1');
  const orksRemaining = units.some(u => u.controllerId === 'ai-1');

  if (!smRemaining || !orksRemaining) {
    // One or both sides are fully wiped out! End the battle immediately.
    completeCombatRoundAndReady(state);
    return;
  }
  
  // Set activePlayer back to normal combat priority
  // Standard mechanics: alternate ready units inside this combat round
  const hasReadySpaceMarines = units.some(u => u.controllerId === 'player-1' && !u.isExhausted);
  const hasReadyOrks = units.some(u => u.controllerId === 'ai-1' && !u.isExhausted);

  if (hasReadySpaceMarines && hasReadyOrks) {
    // Alternate priority
    const nextAttacker = state.activePlayerId === 'player-1' ? 'ai-1' : 'player-1';
    state.activePlayerId = nextAttacker;
    state.combat.subPhase = 'MELEE';
  } else if (hasReadySpaceMarines) {
    state.activePlayerId = 'player-1';
    state.combat.subPhase = 'MELEE';
  } else if (hasReadyOrks) {
    state.activePlayerId = 'ai-1';
    state.combat.subPhase = 'MELEE';
  } else {
    // No ready units left for either side. Prompt for retreats, or finish round
    state.combat.subPhase = 'RETREAT';
    // Initiative leader gets first retreat option
    state.activePlayerId = getCombatInitiativePlayer(state, planet.id);
    addLog(state, `🏳️ Combat round ended. Players may choose to retreat exhausted forces back to HQ.`);
  }
};

export const passCombatAction = (state: GameState, playerId: string) => {
  if (state.activePlayerId !== playerId) return;
  addLog(state, `⏮️ ${state.players[playerId].faction} passed their combat action.`);
  advanceCombatSequence(state);
};

// Retreat Unit
export const retreatUnitFromCombat = (state: GameState, playerId: string, unitInstanceId: string) => {
  const planet = state.planets[state.combat.activePlanetIndex];
  const units = getUnitsAtPlanet(state, planet.id);
  const unit = units.find(u => u.instanceId === unitInstanceId && u.controllerId === playerId);

  if (unit) {
    unit.location = 'HQ';
    unit.locationId = undefined;
    unit.isExhausted = true; // Retreated forces return exhausted
    addLog(state, `🏳️ ${unit.name} retreats back to safety of the HQ orbit.`, playerId);
  }
};

// Pass Retreat and resume/finish round
export const completeCombatRoundAndReady = (state: GameState) => {
  const planetIdx = state.combat.activePlanetIndex;
  const planet = state.planets[planetIdx];
  const units = getUnitsAtPlanet(state, planet.id);

  const smRemaining = units.some(u => u.controllerId === 'player-1');
  const orksRemaining = units.some(u => u.controllerId === 'ai-1');

  if (smRemaining && orksRemaining) {
    // Re-ready all units at the planet and repeat Melee
    units.forEach(u => u.isExhausted = false);
    state.combat.subPhase = 'MELEE';
    state.combat.unitsAttackedThisRound = [];
    state.activePlayerId = getCombatInitiativePlayer(state, planet.id);
    addLog(state, `🔄 Starting Combat Round 2 at ${planet.name}. All units readied!`);
  } else {
    // Battle ended!
    let winnerId = '';
    if (smRemaining) winnerId = 'player-1';
    if (orksRemaining) winnerId = 'ai-1';

    let didSplice = false;
    if (winnerId) {
      addLog(state, `🏅 Combat resolved! ${state.players[winnerId].faction} wins the battle of ${planet.name}.`);
      if (planet.isFirstPlanet) {
        capturePlanet(state, winnerId, planetIdx);
        didSplice = true;
      }
    } else {
      addLog(state, `💀 Mutual destruction at ${planet.name}. No survivors.`);
    }

    // Pause for manual confirmation!
    state.combat.wasPlanetSplicedInResolution = didSplice;
    state.combatPlanetAwaitingAcknowledgement = true;
  }
};

export const manualAcknowledgeCombatPlanet = (state: GameState) => {
  state.combatPlanetAwaitingAcknowledgement = false;
  const didSplice = state.combat.wasPlanetSplicedInResolution || false;
  state.combat.wasPlanetSplicedInResolution = undefined;

  if (!didSplice) {
    state.combat.activePlanetIndex++;
  }
  resolveNextCombatPlanet(state);
};

// Start HQ Phase (End of Turn cleanup & upkeep)
export const startHqPhase = (state: GameState) => {
  state.phase = 'HQ';
  addLog(state, `🏠 Phase transition: HQ MAINTENANCE begins.`);

  // Ready all exhausted units across HQ and Planets
  Object.values(state.players).forEach(p => {
    p.hq.forEach(u => u.isExhausted = false);
    p.hand.concat(p.discard); // none in list
    // Physically placed units too
    state.planets.forEach(pl => {
      getUnitsAtPlanet(state, pl.id).forEach(u => u.isExhausted = false);
    });
  });

  // Distribute Resources (+4) and Draws (+2) matching Conquest layout
  Object.keys(state.players).forEach(pId => {
    state.players[pId].resources += 4;
    drawCardsForPlayer(state, pId, 2);
  });

  addLog(state, `💰 Upkeep complete: +4 Resources and +2 Card Draws for all forces.`);

  // Shift Initiative Token
  const oldFirst = state.firstPlayerId;
  const newFirst = oldFirst === 'player-1' ? 'ai-1' : 'player-1';
  state.firstPlayerId = newFirst;
  state.activePlayerId = newFirst;

  // Next round setup
  state.turn++;
  state.phase = 'DEPLOY';
  state.deployPassCount = 0;
  state.playersPassedDeploy = {
    'player-1': false,
    'ai-1': false
  };
  state.warlordCommitmentsRevealed = false;
  state.warlordCommitments = { 'player-1': null, 'ai-1': null };

  addLog(state, `🌱 Turn ${state.turn} begins! Initiative belongs to: ${state.players[newFirst].faction}.`);
};

// Tactical AI Decisions
export const runAiTurn = (state: GameState) => {
  if (state.activePlayerId !== 'ai-1' || state.isGameOver) return;

  if (state.phase === 'DEPLOY') {
    if (state.playersPassedDeploy && state.playersPassedDeploy['ai-1']) {
      // Bulletproof guard: if the AI passed but is somehow designated as active, switch active player or go to Command Phase
      if (state.playersPassedDeploy['player-1']) {
        startCommandPhase(state);
      } else {
        state.activePlayerId = 'player-1';
      }
      return;
    }

    const ai = state.players['ai-1'];
    const playable = ai.hand.filter(c => c.cost <= ai.resources);
    
    // 1. Play support/attachment upgrades if they fit
    const supportUpgrade = playable.find(c => c.type === 'Support');
    if (supportUpgrade) {
      playSupportCard(state, 'ai-1', supportUpgrade.instanceId);
      return;
    }

    // 3. Play Army units
    const playableArmies = playable.filter(u => u.type === 'Army');
    if (playableArmies.length > 0) {
      const unit = playableArmies.find(u => u.traits.includes('Boyz') || u.traits.includes('Vehicle')) || playableArmies[0];
      const planetOptions = state.planets.filter(p => !p.capturedBy);
      if (planetOptions.length > 0) {
        const destPlanet = planetOptions[Math.floor(rng.next() * Math.min(planetOptions.length, 3))];
        deployUnit(state, 'ai-1', unit.instanceId, destPlanet.id);
        return;
      }
    }

    // Pass deployment if no affordable troops or supports
    passDeployTurn(state, 'ai-1');
  }

  else if (state.phase === 'COMBAT') {
    if (state.combat.subPhase === 'MELEE') {
      const activePlanet = state.planets[state.combat.activePlanetIndex];
      const units = getUnitsAtPlanet(state, activePlanet.id);
      
      const aiReadyUnits = units.filter(u => u.controllerId === 'ai-1' && !u.isExhausted);
      const enemyUnits = units.filter(u => u.controllerId === 'player-1');

      if (aiReadyUnits.length > 0 && enemyUnits.length > 0) {
        const attacker = aiReadyUnits[0];
        // Priority target: Cato Warlord, or lowest HP enemy unit to defeat it
        const warlordTarget = enemyUnits.find(e => e.type === 'Warlord');
        const standardTarget = [...enemyUnits].sort((a,b) => (a.hp - a.damage) - (b.hp - b.damage))[0];

        const target = warlordTarget && (warlordTarget.hp - warlordTarget.damage <= attacker.attack) ? warlordTarget : standardTarget;
        declareAttack(state, attacker.instanceId, target.instanceId);
      } else {
        // Can't attack
        advanceCombatSequence(state);
      }
    }
    else if (state.combat.subPhase === 'SHIELD_PROMPT') {
      // AI chooses whether to shield
      const pending = state.combat.pendingDamage;
      if (pending && pending.targetId) {
        // Find target
        const defender = state.players['ai-1'];
        const targets = defender.hq.concat(getPlacedUnitsForPlayer(state, 'ai-1'));
        const unitToProtect = targets.find(u => u.instanceId === pending.targetId);

        if (unitToProtect) {
          // If protecting Warlord, or unit costing > 2
          const isValuable = unitToProtect.type === 'Warlord' || unitToProtect.cost >= 2;
          const shieldsInHand = defender.hand.filter(c => c.shields > 0);

          if (isValuable && shieldsInHand.length > 0) {
            // Sort to prevent over-guarding
            const shieldCard = [...shieldsInHand].sort((a,b) => a.shields - b.shields)[0];
            resolveShieldCard(state, 'ai-1', shieldCard.instanceId);
          } else {
            resolveShieldCard(state, 'ai-1', 'none');
          }
        } else {
          resolveShieldCard(state, 'ai-1', 'none');
        }
      } else {
        resolveShieldCard(state, 'ai-1', 'none');
      }
    }
    else if (state.combat.subPhase === 'RETREAT') {
      // Heuristic: AI retreats if warlord has high damage (>3) or standard unit would die next round
      // For simplicity, AI passes retreat choices
      completeCombatRoundAndReady(state);
    }
    else {
      advanceCombatSequence(state);
    }
  } else {
    // Fallback: If AI gets turn initiative during COMMAND phase, yield back/no-op on UI blocking
    if (state.phase === 'COMMAND') {
      // Warlord commitments are secret and concurrent, human is active to pick their spot.
      // Do nothing so that user can select commitment, don't trigger state loops.
    } else {
      state.activePlayerId = 'player-1';
    }
  }
};
