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
export function initGame(
  seed = 77,
  p1DeckList?: string[],
  p1WarlordId?: string,
  aiDeckList?: string[],
  aiWarlordId?: string
): GameState {
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

  const finalP1WarlordId = p1WarlordId || 'sm-cato';
  const finalAiWarlordId = aiWarlordId || 'ork-nazdreg';
  const finalP1DeckList = p1DeckList || DECK_SM;
  const finalAiDeckList = aiDeckList || DECK_ORK;

  // Prepare randomized decks
  const smDeckRaw = finalP1DeckList.map(cid => createCardInstance(cid, p1Id));
  const orkDeckRaw = finalAiDeckList.map(cid => createCardInstance(cid, aiId));

  const gameRng = new SeededRandom(seed);
  const smDeck = shuffle(smDeckRaw, () => gameRng.next());
  const orkDeck = shuffle(orkDeckRaw, () => gameRng.next());

  // Warlords starting in HQ
  const catoWarlord = { ...createCardInstance(finalP1WarlordId, p1Id), location: 'HQ' as const };
  const nazdregWarlord = { ...createCardInstance(finalAiWarlordId, aiId), location: 'HQ' as const };

  const p1StartingResources = catoWarlord.startingResources ?? 7;
  const p1StartingCards = catoWarlord.startingCards ?? 7;
  const aiStartingResources = nazdregWarlord.startingResources ?? 7;
  const aiStartingCards = nazdregWarlord.startingCards ?? 7;

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
        faction: CARD_DB[finalP1WarlordId]?.faction || 'Space Marines',
        resources: p1StartingResources,
        hand: [],
        deck: smDeck,
        discard: [],
        hq: [catoWarlord],
        victoryDisplay: []
      },
      [aiId]: {
        id: aiId,
        faction: CARD_DB[finalAiWarlordId]?.faction || 'Orks',
        resources: aiStartingResources,
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
  addLog(state, `🛡️ Player 1 command: ${state.players[p1Id].faction} (${catoWarlord.name})`);
  addLog(state, `🪓 AI command: ${state.players[aiId].faction} (${nazdregWarlord.name})`);

  // Draw starting hand based on Warlord specifications
  drawCardsForPlayer(state, p1Id, p1StartingCards);
  drawCardsForPlayer(state, aiId, aiStartingCards);

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

  let cost = card.cost;
  if (card.faction === 'Orks' && planetId !== 'HQ') {
    const crushfacePresent = getUnitsAtPlanet(state, planetId).some(u => u.id === 'ork-crushface' && u.controllerId === playerId);
    if (crushfacePresent) {
      cost = Math.max(0, cost - 1);
    }
  }

  // astra-infantryconscripts: cost reduced by 1 if Warlord is at the target planet
  if (card.id === 'astra-infantryconscripts' && planetId !== 'HQ') {
    if (hasWarlordAtPlanet(state, playerId, planetId)) {
      cost = Math.max(0, cost - 1);
    }
  }

  // Support-based discounts:
  // astra-imperialbunker: when deploying ASTRA MILITARUM unit, exhaust to reduce cost by 1
  if (card.faction === 'Astra Militarum' && card.type === 'Army') {
    const bunker = player.hq.find(u => u.id === 'astra-imperialbunker' && !u.isExhausted);
    if (bunker) {
      bunker.isExhausted = true;
      cost = Math.max(0, cost - 1);
      addLog(state, `🏢 Imperial Bunker exhausted: Cost of ${card.name} reduced by 1.`, playerId);
    }
  }

  // eldar-frontlinelaunchbay / tau-frontlinelaunchbay: when deploying Eldar/Tau vehicle, exhaust to reduce cost by 1 (or 2 for bonesinger etc - let's stick to simple -1)
  if (card.traits.includes('Vehicle')) {
    const bay = player.hq.find(u => (u.id === 'eldar-frontlinelaunchbay' || u.id === 'tau-frontlinelaunchbay') && !u.isExhausted);
    if (bay) {
      bay.isExhausted = true;
      cost = Math.max(0, cost - 1);
      addLog(state, `🚢 Frontline Launch Bay exhausted: Cost of ${card.name} reduced by 1.`, playerId);
    }
  }

  // Splintered Path Acolyte: Interrupt: When you deploy a Daemon unit, sacrifice this unit to reduce its cost by 2.
  if (card.traits.includes('Daemon')) {
    // Check if we have splinered path acolyte in play at target planet or HQ
    const acolyte = player.hq.find(u => u.id === 'chaos-splinteredpathacolyte') || 
                    (planetId !== 'HQ' ? getUnitsAtPlanet(state, planetId).find(u => u.id === 'chaos-splinteredpathacolyte' && u.controllerId === playerId) : undefined);
    if (acolyte) {
      destroyUnit(state, acolyte);
      cost = Math.max(0, cost - 2);
      addLog(state, `🩸 Splintered Path Acolyte sacrificed: Cost of Daemon ${card.name} reduced by 2.`, playerId);
    }
  }

  if (player.resources < cost) {
    addLog(state, `⚠️ Not enough resources to deploy ${card.name}!`, playerId);
    return false;
  }

  // Deduct resources
  player.resources -= cost;
  // Remove from hand
  player.hand.splice(cardIndex, 1);

  // Determine destination
  if (planetId === 'HQ') {
    card.location = 'HQ';
    player.hq.push(card);
    addLog(state, `🚀 Deployed ${card.name} into HQ. Cost: ${cost} Resources.`, playerId);
  } else {
    card.location = 'PLANET';
    card.locationId = planetId;
    player.hq.push(card);
    addLog(state, `🪐 Deployed ${card.name} to ${getPlanetName(state, planetId)}. Cost: ${cost} Resources.`, playerId);
    
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

  // tau-technician reaction
  if (card.id === 'tau-technician') {
    const player = state.players[playerId];
    if (player.deck.length > 0) {
      const top6 = player.deck.slice(-6).reverse();
      const matchIdx = top6.findIndex(c => c.type === 'Attachment' || c.traits.includes('Drone') || c.id.includes('drone'));
      if (matchIdx !== -1) {
        const matchedCard = top6[matchIdx];
        const deckIdx = player.deck.findIndex(c => c.instanceId === matchedCard.instanceId);
        if (deckIdx !== -1) {
          player.deck.splice(deckIdx, 1);
          matchedCard.location = 'HAND';
          player.hand.push(matchedCard);
          addLog(state, `🔧 Earth Caste Technician search: Found and drew attachment/drone card ${matchedCard.name}!`, playerId);
        }
      } else {
        addLog(state, `🔧 Earth Caste Technician search: No attachment or drone card found in top 6 cards.`, playerId);
      }
    }
  }

  // ork-weirdboy reaction
  if (card.id === 'ork-weirdboy') {
    const unitsAtPlanet = getUnitsAtPlanet(state, planetId);
    unitsAtPlanet.forEach(u => {
      if (u.instanceId !== card.instanceId) {
        applyDamageToUnit(state, u, 1);
      }
    });
    addLog(state, `⚡ Weirdboy Maniak enters play! Deals 1 damage to each other unit at ${getPlanetName(state, planetId)}.`, playerId);
  }

  // eldar-eldarsurvivalist / eldar-starbanescouncil: enters play -> draw 1 card
  if (card.id === 'eldar-eldarsurvivalist' || card.id === 'eldar-starbanescouncil') {
    drawCardsForPlayer(state, playerId, 1);
  }

  // eldar-wailingwraithfighter: enters play -> exhaust target enemy unit at this planet
  if (card.id === 'eldar-wailingwraithfighter') {
    const enemies = getUnitsAtPlanet(state, planetId).filter(u => u.controllerId !== playerId && !u.isExhausted);
    if (enemies.length > 0) {
      const victim = enemies[0];
      victim.isExhausted = true;
      addLog(state, `✈️ Wailing Wraithfighter enters play: Exhausts enemy unit ${victim.name} at ${getPlanetName(state, planetId)}.`, playerId);
    }
  }

  // chaos-zarathursflamers: enters play -> deal 1 damage to each enemy unit at this planet
  if (card.id === 'chaos-zarathursflamers') {
    const enemies = getUnitsAtPlanet(state, planetId).filter(u => u.controllerId !== playerId);
    enemies.forEach(u => {
      // isCardEffect = true so that Zarathur can boost it!
      applyDamageToUnitInternal(state, u, 1, true);
    });
    addLog(state, `🔥 Zarathur's Flamers enters play: Deals 1 damage to all enemy units at ${getPlanetName(state, planetId)}.`, playerId);
  }

  // chaos-alphalegioninfiltrator: enters play -> target enemy unit gets -2 ATK until the end of the phase
  if (card.id === 'chaos-alphalegioninfiltrator') {
    const enemies = getUnitsAtPlanet(state, planetId).filter(u => u.controllerId !== playerId);
    if (enemies.length > 0) {
      const targetUnit = enemies[0];
      (targetUnit as any).tempAttackBuff = ((targetUnit as any).tempAttackBuff || 0) - 2;
      addLog(state, `👥 Alpha Legion Infiltrator enters play: Debuffs ${targetUnit.name}'s attack by -2 until end of phase.`, playerId);
    }
  }

  // de-kabalitestrikeforce: enters play -> deal 1 damage to target unit at this planet
  if (card.id === 'de-kabalitestrikeforce') {
    const targets = getUnitsAtPlanet(state, planetId);
    if (targets.length > 0) {
      const victim = targets[0];
      applyDamageToUnitInternal(state, victim, 1, true);
      addLog(state, `🗡️ Kabalite Strike Force enters play: Deals 1 damage to ${victim.name}.`, playerId);
    }
  }

  // astra-captainmarkis: enters play -> deal 2 damage to a unit at this planet
  if (card.id === 'astra-captainmarkis') {
    const targets = getUnitsAtPlanet(state, planetId);
    if (targets.length > 0) {
      const victim = targets[0];
      applyDamageToUnitInternal(state, victim, 2, true);
      addLog(state, `🎖️ Captain Markis enters play: Deals 2 damage to ${victim.name}.`, playerId);
    }
  }

  // de-kithskhymeramasters: enters play -> spawn a Khymera token at this planet
  if (card.id === 'de-kithskhymeramasters') {
    const khymeraToken: CardInstance = {
      id: 'de-khymeratoken',
      instanceId: `de-khymeratoken-${generateId()}`,
      name: "Khymera",
      type: 'Army',
      faction: 'Dark Eldar',
      cost: 0,
      commandIcons: 0,
      attack: 1,
      hp: 1,
      shields: 0,
      traits: ["Khymera","Beast"],
      keywords: [],
      description: "Token unit.",
      controllerId: playerId,
      damage: 0,
      isExhausted: false,
      isBloodied: false,
      location: 'PLANET',
      locationId: planetId
    };
    state.players[playerId].hq.push(khymeraToken);
    addLog(state, `🐾 Khymeramasters enters play: Spawns a Khymera token at ${getPlanetName(state, planetId)}.`, playerId);
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
  return player.deck.concat(player.hand).concat(player.discard).concat(player.hq).filter(c => c.location === 'PLANET' && c.type !== 'Attachment');
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

// Exhaust Support/Unit for Ability
export const triggerSupportAbility = (state: GameState, playerId: string, cardInstanceId: string, targetId?: string): boolean => {
  const player = state.players[playerId];
  const card = player.hq.find(c => c.instanceId === cardInstanceId) ||
               state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)).find(c => c.instanceId === cardInstanceId && c.controllerId === playerId);
  
  if (!card) return false;

  // Flash Gitz can be triggered when exhausted to ready it
  if (card.id === 'ork-flashgitz') {
    if (state.phase !== 'COMBAT') {
      addLog(state, `⚠️ Flash Gitz ability can only be triggered during the Combat Phase!`, playerId);
      return false;
    }
    if (!card.isExhausted) {
      addLog(state, `⚠️ Flash Gitz is already ready!`, playerId);
      return false;
    }
    if ((card as any).flashGitzUsedThisPhase) {
      addLog(state, `⚠️ Flash Gitz ability can only be used once per phase!`, playerId);
      return false;
    }
    (card as any).flashGitzUsedThisPhase = true;
    card.isExhausted = false;
    applyDamageToUnit(state, card, 1);
    addLog(state, `🪓 Nazdreg's Flash Gitz deals itself 1 damage to ready!`, playerId);
    return true;
  }

  if (card.isExhausted) return false;

  // sm-maxos: Combat Action: Deploy SM unit from hand
  if (card.id === 'sm-maxos') {
    if (state.phase !== 'COMBAT' || state.activePlayerId !== playerId) {
      addLog(state, `⚠️ Maxos ability can only be triggered as a Combat Action during your turn!`, playerId);
      return false;
    }
    const activePlanet = state.planets[state.combat.activePlanetIndex];
    if (!activePlanet || card.locationId !== activePlanet.id) {
      addLog(state, `⚠️ Veteran Brother Maxos must be at the active combat planet to trigger!`, playerId);
      return false;
    }
    const smUnit = player.hand.find(u => u.type === 'Army' && u.faction === 'Space Marines' && player.resources >= u.cost);
    if (!smUnit) {
      addLog(state, `⚠️ No affordable Space Marine army units in hand to deploy!`, playerId);
      return false;
    }
    card.isExhausted = true;
    player.resources -= smUnit.cost;
    const handIdx = player.hand.findIndex(u => u.instanceId === smUnit.instanceId);
    player.hand.splice(handIdx, 1);
    smUnit.location = 'PLANET';
    smUnit.locationId = activePlanet.id;
    player.hq.push(smUnit);
    addLog(state, `🚀 Veteran Brother Maxos deploys ${smUnit.name} from hand to ${activePlanet.name} for ${smUnit.cost} resources!`, playerId);
    return true;
  }

  // tau-communicationsrelay: Action: exhaust to move one of your committed units to an adjacent planet
  if (card.id === 'tau-communicationsrelay') {
    const friendlyUnits = state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)).filter(u => u.controllerId === playerId && u.type === 'Army' && u.locationId);
    if (friendlyUnits.length > 0) {
      const targetUnit = friendlyUnits[0];
      const pIdx = state.planets.findIndex(p => p.id === targetUnit.locationId);
      const destIdx = pIdx === 0 ? 1 : pIdx - 1;
      const destPlanet = state.planets[destIdx];
      targetUnit.locationId = destPlanet.id;
      card.isExhausted = true;
      addLog(state, `📡 Communications Relay: Moved ${targetUnit.name} to adjacent planet ${destPlanet.name}.`, playerId);
      return true;
    }
    return false;
  }

  // eldar-alaitocshrine: Support Action: exhaust to move a friendly unit from a planet to HQ
  if (card.id === 'eldar-alaitocshrine') {
    const friendlyUnits = state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)).filter(u => u.controllerId === playerId && u.type === 'Army');
    if (friendlyUnits.length > 0) {
      const targetUnit = friendlyUnits[0];
      targetUnit.location = 'HQ';
      targetUnit.locationId = undefined;
      card.isExhausted = true;
      addLog(state, `⛩️ Alaitoc Shrine: Moved ${targetUnit.name} back to HQ.`, playerId);
      return true;
    }
    return false;
  }

  // tau-ambushplatform: Support Action: exhaust to deploy an attachment card from hand with cost reduced by 1
  if (card.id === 'tau-ambushplatform') {
    const attachmentsInHand = player.hand.filter(c => c.type === 'Attachment');
    if (attachmentsInHand.length > 0) {
      const targetUnit = state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)).find(u => u.controllerId === playerId && u.type === 'Army');
      if (targetUnit) {
        const item = attachmentsInHand[0];
        card.isExhausted = true;
        deployAttachment(state, playerId, item.instanceId, targetUnit.instanceId);
        return true;
      }
    }
    return false;
  }

  // chaos-fortressofmadness: Support Action: exhaust to deal 1 damage to each unit at a planet
  if (card.id === 'chaos-fortressofmadness') {
    const planet = state.planets[0];
    const targets = getUnitsAtPlanet(state, planet.id);
    card.isExhausted = true;
    targets.forEach(u => {
      applyDamageToUnitInternal(state, u, 1, true);
    });
    addLog(state, `🏯 Fortress of Madness: Dealt 1 damage to all units at ${planet.name}.`, playerId);
    return true;
  }

  // de-khymeraden: Support Action: exhaust to move any number of Khymera tokens to a target planet
  if (card.id === 'de-khymeraden') {
    const khymeras = state.players[playerId].hq.concat(state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)))
      .filter(u => u.id === 'de-khymeratoken');
    if (khymeras.length > 0) {
      const planet = state.planets[0];
      khymeras.forEach(k => {
        k.location = 'PLANET';
        k.locationId = planet.id;
      });
      card.isExhausted = true;
      addLog(state, `🐾 Khymera Den: Moved all Khymera tokens to ${planet.name}.`, playerId);
      return true;
    }
    return false;
  }

  // ork-tellyporta: Combat Action: Exhaust to move Ork unit to first planet
  if (card.id === 'ork-tellyporta') {
    if (state.phase !== 'COMBAT') {
      addLog(state, `⚠️ Tellyporta Pad can only be activated during the Combat Phase!`, playerId);
      return false;
    }
    const firstPlanet = state.planets.find(p => p.isFirstPlanet) || state.planets[0];
    let targetOrk: CardInstance | undefined;
    if (targetId) {
      targetOrk = state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)).find(u => u.instanceId === targetId && u.controllerId === playerId && u.faction === 'Orks');
    } else {
      targetOrk = state.planets.flatMap(p => getUnitsAtPlanet(state, p.id))
                   .find(u => u.controllerId === playerId && u.faction === 'Orks' && u.locationId !== firstPlanet.id);
    }
    if (!targetOrk) {
      addLog(state, `⚠️ No eligible Ork units to teleport!`, playerId);
      return false;
    }
    card.isExhausted = true;
    targetOrk.location = 'PLANET';
    targetOrk.locationId = firstPlanet.id;
    addLog(state, `🌌 Tellyporta Pad teleports ${targetOrk.name} to first planet ${firstPlanet.name}!`, playerId);
    return true;
  }

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

  // tau-squadronredeployment / eldar-mobility: move a friendly unit to an adjacent planet
  if (card.id === 'tau-squadronredeployment' || card.id === 'eldar-mobility') {
    const friendlyUnits = state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)).filter(u => u.controllerId === playerId && u.type === 'Army');
    const targetUnit = friendlyUnits.find(u => u.instanceId === targetId) || friendlyUnits[0];
    if (targetUnit && targetUnit.locationId) {
      const pIdx = state.planets.findIndex(p => p.id === targetUnit.locationId);
      const destIdx = pIdx === 0 ? 1 : pIdx - 1; // Pick adjacent
      const destPlanet = state.planets[destIdx];
      targetUnit.locationId = destPlanet.id;
      addLog(state, `🗺️ Redeployed ${targetUnit.name} to adjacent planet ${destPlanet.name}.`, playerId);
    }
  }

  // tau-calculatedstrike: Event: deal 2 damage to a target non-warlord army unit
  if (card.id === 'tau-calculatedstrike') {
    let allUnits: CardInstance[] = [];
    state.planets.forEach(p => {
      allUnits.push(...getUnitsAtPlanet(state, p.id).filter(u => u.type !== 'Warlord'));
    });
    const victim = allUnits.find(u => u.instanceId === targetId) || allUnits[0];
    if (victim) {
      applyDamageToUnitInternal(state, victim, 2, true);
      addLog(state, `💥 Calculated Strike: Deals 2 damage to ${victim.name}.`, playerId);
    }
  }

  // tau-deception: Event: Swap the location of two friendly army units
  if (card.id === 'tau-deception') {
    const friendlyUnits = state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)).filter(u => u.controllerId === playerId && u.type === 'Army' && u.locationId);
    if (friendlyUnits.length >= 2) {
      const u1 = friendlyUnits[0];
      const u2 = friendlyUnits[1];
      const loc1 = u1.locationId;
      u1.locationId = u2.locationId;
      u2.locationId = loc1;
      addLog(state, `🎭 Deception: Swapped locations of ${u1.name} and ${u2.name}.`, playerId);
    }
  }

  // tau-eventheodds: Event: after opponent wins a battle, exhaust target enemy unit there
  if (card.id === 'tau-eventheodds') {
    const activePlanet = state.planets[state.combat.activePlanetIndex];
    if (activePlanet) {
      const enemyUnits = getUnitsAtPlanet(state, activePlanet.id).filter(u => u.controllerId !== playerId && !u.isExhausted);
      if (enemyUnits.length > 0) {
        const victim = enemyUnits[0];
        victim.isExhausted = true;
        addLog(state, `⚖️ Even the Odds: Exhausted enemy unit ${victim.name} at ${activePlanet.name}.`, playerId);
      }
    }
  }

  // eldar-doom: Event: destroy each non-unique unit at each player's HQ
  if (card.id === 'eldar-doom') {
    // In our simplified database, uniqueness can be determined by cost or id name (signature/elite).
    // Let's assume unique means Warlords, and cards costing >= 5 or that have names indicating unique characters.
    // Let's just destroy all army units in HQ (since signature/warlords are protected or unique is cost>=4)
    Object.values(state.players).forEach(p => {
      const targets = p.hq.filter(u => u.type === 'Army' && u.cost < 4);
      targets.forEach(u => {
        addLog(state, `👁️ Doom: Destroying non-unique unit ${u.name} in HQ.`, playerId);
        destroyUnit(state, u);
      });
    });
  }

  // eldar-superiority / eldar-starbanebattlewin: draw cards
  if (card.id === 'eldar-superiority') {
    drawCardsForPlayer(state, playerId, 2);
    addLog(state, `🏆 Superiority: Drew 2 cards.`, playerId);
  }

  // eldar-foresight: look at top 3 cards of deck, reorder them, and draw 1 card
  if (card.id === 'eldar-foresight') {
    const player = state.players[playerId];
    if (player.deck.length > 0) {
      const top3 = player.deck.slice(-3).reverse();
      // Auto-reorder (shuffle or leave as is) and draw 1
      drawCardsForPlayer(state, playerId, 1);
      addLog(state, `🔮 Foresight: Inspected top cards and drew 1.`, playerId);
    }
  }

  // eldar-giftofisha: put topmost Eldar unit from discard into play, sacrifice at end of phase
  if (card.id === 'eldar-giftofisha') {
    const player = state.players[playerId];
    const discardUnitIdx = player.discard.findIndex(u => u.type === 'Army' && u.faction === 'Eldar');
    if (discardUnitIdx !== -1) {
      const unit = player.discard.splice(discardUnitIdx, 1)[0];
      const planet = state.planets[0]; // deploy to first planet
      unit.location = 'PLANET';
      unit.locationId = planet.id;
      (unit as any).infernalGatewayDeployed = true; // reuse this sacrifice flag
      player.hq.push(unit);
      addLog(state, `😇 Gift of Isha: Resurrected ${unit.name} to ${planet.name} (temporary).`, playerId);
    }
  }

  // eldar-nullify: cancel event card (for simplicity, log it and gain 1 resource to refund or cancel last action if played immediately)
  if (card.id === 'eldar-nullify') {
    addLog(state, `⛔ Nullify: Cancelled target event card effect.`, playerId);
  }

  // astra-gloriousintervention: target army unit gets +2 ATK until the end of the phase
  if (card.id === 'astra-gloriousintervention') {
    const activePlanet = state.planets[state.combat.activePlanetIndex];
    if (activePlanet) {
      const friendlyUnits = getUnitsAtPlanet(state, activePlanet.id).filter(u => u.controllerId === playerId && u.type === 'Army');
      if (friendlyUnits.length > 0) {
        const targetUnit = friendlyUnits[0];
        (targetUnit as any).tempAttackBuff = ((targetUnit as any).tempAttackBuff || 0) + 2;
        addLog(state, `🎖️ Glorious Intervention: +2 ATK granted to ${targetUnit.name} until end of phase.`, playerId);
      }
    }
  }

  // astra-strakenscunning: choose a planet. Ready all Astra Militarum units at that planet.
  if (card.id === 'astra-strakenscunning' || card.id === 'astra-strakenscunningevent') { // support attachment is strakenscunning, let's allow event name too
    const planet = state.planets[0];
    const units = getUnitsAtPlanet(state, planet.id).filter(u => u.controllerId === playerId && u.faction === 'Astra Militarum');
    units.forEach(u => u.isExhausted = false);
    addLog(state, `🧠 Straken's Cunning: Readied all Astra Militarum units at ${planet.name}.`, playerId);
  }

  // astra-preemptivebarrage: target up to 3 friendly AM units at a planet, they gain Ranged until end of phase
  if (card.id === 'astra-preemptivebarrage') {
    const planet = state.planets[0];
    const units = getUnitsAtPlanet(state, planet.id).filter(u => u.controllerId === playerId && u.faction === 'Astra Militarum');
    units.slice(0, 3).forEach(u => {
      (u as any).tempRangedGranted = true;
    });
    addLog(state, `🎯 Preemptive Barrage: Granted Ranged to friendly units at ${planet.name} until end of phase.`, playerId);
  }

  // chaos-infernalgateway: Put a Daemon unit (cost <= 3) from hand into play at a planet; sacrifice at end of phase
  if (card.id === 'chaos-infernalgateway') {
    const player = state.players[playerId];
    const daemonIdx = player.hand.findIndex(u => u.type === 'Army' && u.traits.includes('Daemon') && u.cost <= 3);
    if (daemonIdx !== -1) {
      const daemon = player.hand.splice(daemonIdx, 1)[0];
      const planet = state.planets[0];
      daemon.location = 'PLANET';
      daemon.locationId = planet.id;
      (daemon as any).infernalGatewayDeployed = true;
      player.hq.push(daemon);
      addLog(state, `🚪 Infernal Gateway: Summoned ${daemon.name} to ${planet.name} until end of phase.`, playerId);
      triggerDeployReactions(state, daemon, playerId, planet.id);
    }
  }

  // chaos-warpstorm: deal 2 damage to each unit without attachments at a target planet or HQ
  if (card.id === 'chaos-warpstorm') {
    const planet = state.planets[0];
    const targets = getUnitsAtPlanet(state, planet.id).filter(u => getAttachmentsForUnit(state, u.instanceId).length === 0);
    targets.forEach(u => {
      applyDamageToUnitInternal(state, u, 2, true);
    });
    addLog(state, `⚡ Warpstorm: Dealt 2 damage to all ${targets.length} unattached units at ${planet.name}.`, playerId);
  }

  // chaos-tzeentchsfirestorm: deal 3 damage to a target non-warlord unit
  if (card.id === 'chaos-tzeentchsfirestorm') {
    const planet = state.planets[0];
    const targets = getUnitsAtPlanet(state, planet.id).filter(u => u.type !== 'Warlord');
    if (targets.length > 0) {
      const victim = targets[0];
      applyDamageToUnitInternal(state, victim, 3, true);
      addLog(state, `🔥 Tzeentch's Firestorm: Dealt 3 damage to ${victim.name}.`, playerId);
    }
  }

  // de-pactofthehaemonculi: Sacrifice a unit to discard 1 random card from opponent hand, draw 2
  if (card.id === 'de-pactofthehaemonculi') {
    const friendlyUnits = state.planets.flatMap(p => getUnitsAtPlanet(state, p.id)).filter(u => u.controllerId === playerId && u.type === 'Army');
    if (friendlyUnits.length > 0) {
      const sacrificial = friendlyUnits[0];
      destroyUnit(state, sacrificial);
      const opponentId = playerId === 'player-1' ? 'ai-1' : 'player-1';
      const opponent = state.players[opponentId];
      if (opponent.hand.length > 0) {
        const randIdx = Math.floor(Math.random() * opponent.hand.length);
        const discarded = opponent.hand.splice(randIdx, 1)[0];
        discarded.location = 'DISCARD';
        opponent.discard.push(discarded);
        addLog(state, `🩸 Pact of the Haemonculi: Sacrificed ${sacrificial.name} to discard ${discarded.name} from opponent's hand.`, playerId);
      }
      drawCardsForPlayer(state, playerId, 2);
    }
  }

  state.deployPassCount = 0;
  alternateDeployTurn(state);
  return true;
};

export const applyDamageToUnitInternal = (state: GameState, unit: CardInstance, rawDamage: number, isCardEffect = false) => {
  let finalDamage = rawDamage;

  // Zarathur's Flamers, Doom, Warpstorm, calculatedstrike etc. can set isCardEffect = true
  if (isCardEffect && rawDamage > 0 && unit.location === 'PLANET' && unit.locationId) {
    // Zarathur, High Sorcerer: Interrupt: When damage is assigned to an enemy unit at this planet, increase that damage by 1.
    // Check if opponent's warlord is Zarathur at this planet
    const opponentId = unit.controllerId === 'player-1' ? 'ai-1' : 'player-1';
    const hasZarathur = getUnitsAtPlanet(state, unit.locationId).some(
      u => u.id === 'chaos-zarathurhighsorcerer' && u.controllerId === opponentId && !u.isBloodied
    );
    if (hasZarathur) {
      finalDamage += 1;
      addLog(state, `🔥 Zarathur High Sorcerer increases card effect damage by +1!`, opponentId);
    }
  }

  // Rockcrete Bunker: upgrade: If this card has 4 or more damage on it, sacrifice it.
  // Reaction: After damage is assigned to a unit you control, exhaust this support to reassign 1 of that damage to this support.
  if (finalDamage > 0 && unit.location === 'PLANET' && unit.locationId) {
    const player = state.players[unit.controllerId];
    const rockcrete = player.hq.find(u => u.id === 'astra-rockcretebunker' && !u.isExhausted);
    if (rockcrete) {
      rockcrete.isExhausted = true;
      finalDamage = Math.max(0, finalDamage - 1);
      (rockcrete as any).damage = ((rockcrete as any).damage || 0) + 1;
      addLog(state, `🧱 Rockcrete Bunker exhausts to absorb 1 damage. Bunker damage: ${(rockcrete as any).damage}/4`, unit.controllerId);
      if ((rockcrete as any).damage >= 4) {
        // Sacrifice it
        const hqIdx = player.hq.findIndex(u => u.instanceId === rockcrete.instanceId);
        if (hqIdx !== -1) player.hq.splice(hqIdx, 1);
        rockcrete.location = 'DISCARD';
        player.discard.push(rockcrete);
        addLog(state, `🧱 Rockcrete Bunker is sacrificed due to 4 or more damage!`, unit.controllerId);
      }
    }
  }

  // neutral-bodyguard: Forced Reaction: After a unit you control is assigned damage by an attack at this planet, reassign 1 of that damage to attached unit.
  if (finalDamage > 0 && unit.location === 'PLANET' && unit.locationId) {
    const attachments = getAttachmentsForUnit(state, unit.instanceId);
    const bodyguard = attachments.find(att => att.id === 'neutral-bodyguard');
    if (bodyguard) {
      finalDamage = Math.max(0, finalDamage - 1);
      // Reassign 1 damage to the host/attached unit? Wait, it says "reassign 1 of that damage to attached unit". Bodyguard is attached to an army unit, so it reassigns damage to itself.
      // In Conquest, attachments don't have separate HP unless specified, but let's make it damage the bodyguard unit itself or just apply it directly. Oh! Bodyguard is attached to host, so host takes it but it gets +2 HP. So reassigning it to attached unit means applying it to the host itself? Wait, "attached unit" in Conquest grammar refers to the unit this card is attached to (host unit). So it redirects damage to the host unit itself, which already has +2 HP.
      // Wait, "reassign 1 of that damage to attached unit" means if a DIFFERENT unit you control takes damage, you reassign to host. Let's check: "After a unit you control is assigned damage... reassign 1 to attached unit".
      // Yes! If a different friendly unit takes damage, 1 of that is reassigned to the bodyguard's host unit.
      // Let's implement this: if another unit is damaged, the bodyguard host takes 1.
    }
  }

  // sm-bloodangels: prevent 1 damage while ready
  if (unit.id === 'sm-bloodangels' && !unit.isExhausted && rawDamage > 0) {
    finalDamage = Math.max(0, finalDamage - 1);
    addLog(state, `🛡️ Blood Angels Veterans ability prevents 1 damage!`, unit.controllerId);
  }

  unit.damage += finalDamage;
  const currentHp = getUnitAdjustedHp(state, unit);
  
  if (unit.damage >= currentHp) {
    if (unit.type === 'Warlord' && !unit.isBloodied) {
      // Bloodied flip transition!
      unit.isBloodied = true;
      unit.damage = 0;
      unit.description = "";
      unit.keywords = [];
      
      // Immediate move to HQ and exhaust
      unit.location = 'HQ';
      unit.locationId = undefined;
      unit.isExhausted = true;
      
      if (unit.id === 'sm-cato') {
        unit.attack = 1;
        unit.hp = 6;
      } else if (unit.id === 'ork-nazdreg') {
        unit.attack = 2;
        unit.hp = 6;
      } else if (unit.id === 'tau-commandershadowsun') {
        unit.attack = 1;
        unit.hp = 6;
      } else if (unit.id === 'eldar-eldorathstarbane') {
        unit.attack = 1;
        unit.hp = 6;
      } else if (unit.id === 'astra-colonelstraken') {
        unit.attack = 2;
        unit.hp = 6;
      } else if (unit.id === 'chaos-zarathurhighsorcerer') {
        unit.attack = 1;
        unit.hp = 6;
      } else if (unit.id === 'de-packmasterkith') {
        unit.attack = 2;
        unit.hp = 6;
      }
      
      addLog(state, `🩸 Warlord ${unit.name} is BLOODIED! Relocated to HQ exhausted, damage reset, ability lost.`, unit.controllerId);

      // Keep attachments on the bloodied Warlord by updating their location to HQ
      const attachments = getAttachmentsForUnit(state, unit.instanceId);
      attachments.forEach(att => {
        att.location = 'HQ';
        att.locationId = undefined;
      });
    } else {
      // Normal unit death or a bloodied warlord slain
      destroyUnit(state, unit);
    }
  }
};

export const applyDamageToUnit = (state: GameState, unit: CardInstance, rawDamage: number) => {
  // Check bodyguard redirection first: if another unit is assigned damage by an attack, reassign 1 to the bodyguard host
  let targetUnit = unit;
  if (state.phase === 'COMBAT' && (state.combat.subPhase === 'MELEE' || state.combat.subPhase === 'RANGED')) {
    const player = state.players[unit.controllerId];
    const guards = player.hq.concat(getPlacedUnitsForPlayer(state, unit.controllerId))
      .filter(u => getAttachmentsForUnit(state, u.instanceId).some(att => att.id === 'astra-bodyguard') && u.instanceId !== unit.instanceId && u.locationId === unit.locationId);
    if (guards.length > 0 && rawDamage > 0) {
      const guardHost = guards[0];
      applyDamageToUnitInternal(state, guardHost, 1, false);
      applyDamageToUnitInternal(state, unit, rawDamage - 1, false);
      addLog(state, `🛡️ Bodyguard reassigns 1 damage to host unit ${guardHost.name}.`, unit.controllerId);
      return;
    }
  }

  applyDamageToUnitInternal(state, targetUnit, rawDamage, false);
};

const destroyUnit = (state: GameState, unit: CardInstance) => {
  const p = state.players[unit.controllerId];
  
  // Capture details before changing location
  const wasAtPlanet = unit.location === 'PLANET' && unit.locationId;
  const isSoldierOrWarrior = unit.traits.includes('Soldier') || unit.traits.includes('Warrior');

  unit.location = 'DISCARD';
  
  // Remove from active HQ array (where both HQ and PLANET units are tracked)
  const hqIdx = p.hq.findIndex(u => u.instanceId === unit.instanceId);
  if (hqIdx !== -1) p.hq.splice(hqIdx, 1);
  
  p.discard.push(unit);

  addLog(state, `💀 Unit ${unit.name} was destroyed. Move to Discard pile.`, unit.controllerId);

  // neutral-elysian interrupt: put into play from hand when Soldier or Warrior leaves play from planet
  if (wasAtPlanet && isSoldierOrWarrior) {
    const elysianIdx = p.hand.findIndex(h => h.id === 'neutral-elysian');
    if (elysianIdx !== -1) {
      const elysian = p.hand.splice(elysianIdx, 1)[0];
      elysian.location = 'PLANET';
      elysian.locationId = wasAtPlanet;
      p.hq.push(elysian);
      addLog(state, `🪂 Elysian Assault Team deploys from hand to ${getPlanetName(state, wasAtPlanet)} as an Interrupt!`, unit.controllerId);
    }
  }

  // astra-strakenscommandsquad: When this unit leaves play, put a Guardsman token into play at the same planet.
  if (unit.id === 'astra-strakenscommandsquad' && wasAtPlanet) {
    const guardsman: CardInstance = {
      id: 'astra-guardsmantoken',
      instanceId: `astra-guardsmantoken-${generateId()}`,
      name: "Guardsman",
      type: 'Army',
      faction: 'Astra Militarum',
      cost: 0,
      commandIcons: 0,
      attack: 1,
      hp: 1,
      shields: 0,
      traits: ["Soldier"],
      keywords: [],
      description: "Token unit.",
      controllerId: unit.controllerId,
      damage: 0,
      isExhausted: false,
      isBloodied: false,
      location: 'PLANET',
      locationId: wasAtPlanet
    };
    p.hq.push(guardsman);
    addLog(state, `🎖️ Straken's Command Squad dies: Spawned a Guardsman token at ${getPlanetName(state, wasAtPlanet)}.`, unit.controllerId);
  }

  // astra-omegazerocommand: Support: when a friendly Astra Militarum unit is destroyed, draw 1 card.
  if (unit.faction === 'Astra Militarum') {
    const omega = p.hq.find(u => u.id === 'astra-omegazerocommand');
    if (omega) {
      drawCardsForPlayer(state, unit.controllerId, 1);
      addLog(state, `🛰️ Omega Zero Command: Drew 1 card because friendly Astra Militarum unit ${unit.name} died.`, unit.controllerId);
    }
  }

  // chaos-shrineofwarpflame: Support: when a friendly Daemon unit is destroyed, deal 1 damage to an enemy unit at that planet.
  if (unit.traits.includes('Daemon') && wasAtPlanet) {
    const shrine = p.hq.find(u => u.id === 'chaos-shrineofwarpflame');
    if (shrine) {
      const enemies = getUnitsAtPlanet(state, wasAtPlanet).filter(u => u.controllerId !== unit.controllerId);
      if (enemies.length > 0) {
        const victim = enemies[0];
        applyDamageToUnitInternal(state, victim, 1, true);
        addLog(state, `🔥 Shrine of Warpflame: Dealt 1 damage to enemy ${victim.name} at ${getPlanetName(state, wasAtPlanet)}.`, unit.controllerId);
      }
    }
  }

  // Discard all attachments on this unit
  const attachments = getAttachmentsForUnit(state, unit.instanceId);
  attachments.forEach(att => {
    // astra-strakenscunning skill interrupt: When attached unit leaves play, draw 3 cards.
    if (att.id === 'astra-strakenscunning') {
      drawCardsForPlayer(state, att.controllerId, 3);
      addLog(state, `🧠 Straken's Cunning attachment leaves play: Drew 3 cards!`, att.controllerId);
    }

    // chaos-markofchaos: attach to army unit. Interrupt: When attached unit leaves play, deal 1 damage to each enemy unit at this planet.
    if (att.id === 'chaos-markofchaos' && wasAtPlanet) {
      const enemies = getUnitsAtPlanet(state, wasAtPlanet).filter(u => u.controllerId !== att.controllerId);
      enemies.forEach(enemy => {
        applyDamageToUnitInternal(state, enemy, 1, true);
      });
      addLog(state, `💀 Mark of Chaos leaves play: Dealt 1 damage to all enemy units at ${getPlanetName(state, wasAtPlanet)}.`, att.controllerId);
    }

    const attOwner = state.players[att.controllerId];
    att.location = 'DISCARD';
    att.attachedToId = undefined;
    const attIdx = attOwner.hq.findIndex(u => u.instanceId === att.instanceId);
    if (attIdx !== -1) attOwner.hq.splice(attIdx, 1);
    attOwner.discard.push(att);
    addLog(state, `🗑️ Attachment ${att.name} on ${unit.name} was discarded.`, att.controllerId);
  });

  // Trigger Cato reaction if an enemy unit is destroyed on Cato's planet
  const catoWarlord = state.players['player-1'].hq.find(u => u.id === 'sm-cato');
  if (catoWarlord && !catoWarlord.isBloodied && state.warlordCommitmentsRevealed && unit.controllerId !== 'player-1') {
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
    addLog(state, `🏆 GAME OVER! Warlord ${unit.name} was slain. Warlord's faction: ${p.faction} defeated!`);
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

  const p1Warlord = state.players['player-1'].hq.find(u => u.type === 'Warlord');
  const aiWarlord = state.players['ai-1'].hq.find(u => u.type === 'Warlord');

  addLog(state, `👁️ Warlords revealed!`);
  addLog(state, `👑 Player 1 Warlord: ${p1Warlord?.name || 'Unknown'} commits to ${p1Planet.name}!`, 'player-1');
  addLog(state, `🪓 AI Warlord: ${aiWarlord?.name || 'Unknown'} commits to ${aiPlanet.name}!`, 'ai-1');

  // Trigger Warlord Commitment Reactions
  const handleCommitmentReaction = (playerId: string, warlord: CardInstance | undefined, planetIdx: number) => {
    if (!warlord || warlord.isBloodied) return;
    const planet = state.planets[planetIdx];

    // tau-commandershadowsun: after committing, put a Tau attachment (cost <= 2) or "Shadowsun's Stealth Cadre" from hand/discard into play attached to a unit there.
    if (warlord.id === 'tau-commandershadowsun') {
      const player = state.players[playerId];
      const candidates = player.hand.concat(player.discard).filter(c => 
        (c.type === 'Attachment' && c.faction === 'Tau' && c.cost <= 2) || c.id === 'tau-shadowsunsstealthcadre'
      );
      if (candidates.length > 0) {
        const targetUnit = getUnitsAtPlanet(state, planet.id).find(u => u.controllerId === playerId && u.type === 'Army');
        if (targetUnit) {
          const item = candidates[0];
          // Remove from source
          const handIdx = player.hand.findIndex(c => c.instanceId === item.instanceId);
          if (handIdx !== -1) player.hand.splice(handIdx, 1);
          const discIdx = player.discard.findIndex(c => c.instanceId === item.instanceId);
          if (discIdx !== -1) player.discard.splice(discIdx, 1);

          if (item.type === 'Attachment') {
            item.location = 'PLANET';
            item.locationId = planet.id;
            item.attachedToId = targetUnit.instanceId;
            player.hq.push(item);
            addLog(state, `👑 Commander Shadowsun commits: Deploys and attaches ${item.name} to ${targetUnit.name} at ${planet.name}.`, playerId);
          } else {
            // Shadowsun's Stealth Cadre (Army)
            item.location = 'PLANET';
            item.locationId = planet.id;
            player.hq.push(item);
            addLog(state, `👑 Commander Shadowsun commits: Deploys army squad ${item.name} to ${planet.name}.`, playerId);
            triggerDeployReactions(state, item, playerId, planet.id);
          }
        }
      }
    }

    // eldar-eldorathstarbane: Reaction: After this warlord commits to a planet, exhaust a target non-warlord unit at that planet.
    if (warlord.id === 'eldar-eldorathstarbane') {
      const targets = getUnitsAtPlanet(state, planet.id).filter(u => u.type !== 'Warlord' && !u.isExhausted);
      if (targets.length > 0) {
        const victim = targets[0]; // Auto-pick first one
        victim.isExhausted = true;
        addLog(state, `👑 Eldorath Starbane commits: Exhausts enemy unit ${victim.name} at ${planet.name}!`, playerId);
      }
    }

    // de-packmasterkith: Reaction: After this warlord commits to a planet, put a Khymera token into play at this planet.
    if (warlord.id === 'de-packmasterkith') {
      const khymeraToken: CardInstance = {
        id: 'de-khymeratoken',
        instanceId: `de-khymeratoken-${generateId()}`,
        name: "Khymera",
        type: 'Army',
        faction: 'Dark Eldar',
        cost: 0,
        commandIcons: 0,
        attack: 1,
        hp: 1,
        shields: 0,
        traits: ["Khymera","Beast"],
        keywords: [],
        description: "Token unit.",
        controllerId: playerId,
        damage: 0,
        isExhausted: false,
        isBloodied: false,
        location: 'PLANET',
        locationId: planet.id
      };
      state.players[playerId].hq.push(khymeraToken);
      addLog(state, `🐾 Packmaster Kith commits: Spawns a Khymera token at ${planet.name}.`, playerId);
    }
  };

  handleCommitmentReaction('player-1', p1Warlord, p1PlanetIdx);
  handleCommitmentReaction('ai-1', aiWarlord, aiPlanetIdx);

  // Trigger Nazdreg's Brutal buff logs
  if (aiPlanetIdx !== null && aiWarlord?.id === 'ork-nazdreg') {
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
    let p1Command = p1Units.reduce((acc, unit) => acc + (unit.isExhausted ? 0 : getUnitAdjustedCommand(state, unit)), 0);
    let aiCommand = aiUnits.reduce((acc, unit) => acc + (unit.isExhausted ? 0 : getUnitAdjustedCommand(state, unit)), 0);

    // If active Warlord is present and ready, add command icons
    if (state.warlordCommitments['player-1'] === p.index) {
      const p1Warlord = state.players['player-1'].hq.find(u => u.type === 'Warlord');
      if (p1Warlord && !p1Warlord.isExhausted) p1Command += getUnitAdjustedCommand(state, p1Warlord);
    }
    if (state.warlordCommitments['ai-1'] === p.index) {
      const aiWarlord = state.players['ai-1'].hq.find(u => u.type === 'Warlord');
      if (aiWarlord && !aiWarlord.isExhausted) aiCommand += getUnitAdjustedCommand(state, aiWarlord);
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

  // Reset Flash Gitz once per phase limits
  Object.values(state.players).forEach(p => {
    p.hq.forEach(u => delete (u as any).flashGitzUsedThisPhase);
  });
  state.planets.forEach(pl => {
    getUnitsAtPlanet(state, pl.id).forEach(u => delete (u as any).flashGitzUsedThisPhase);
  });
  
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
    if (isFirst && units.length > 0) {
      const winnerId = units[0].controllerId;
      if (winnerId === 'player-1') {
        state.pendingPlanetBattleAbilityTrigger = { planetId: planet.id, winnerId: 'player-1' };
      } else {
        // AI automatically triggers Battle ability
        capturePlanet(state, winnerId, currentIdx, true);
        state.combat.wasPlanetSplicedInResolution = false;
        state.combatPlanetAwaitingAcknowledgement = true;
      }
      return;
    }
    
    // Skip to next planet
    state.combat.activePlanetIndex++;
    resolveNextCombatPlanet(state);
  }
};
export const triggerPlanetBattleAbility = (state: GameState, winnerId: string, planet: Planet) => {
  const winner = state.players[winnerId];
  const opponentId = winnerId === 'player-1' ? 'ai-1' : 'player-1';
  const opponent = state.players[opponentId];

  addLog(state, `🪐 Triggering Battle ability of ${planet.name} for ${winner.faction}...`);

  switch (planet.name) {
    case 'Elouith': {
      // Battle: Search the top 3 cards of your deck for a card. Add it to your hand, and place the remaining cards on the bottom of your deck in any order.
      if (winner.deck.length === 0) {
        if (winner.discard.length > 0) {
          addLog(state, `🔄 ${winner.faction} shuffles discard pile back to deck.`);
          winner.deck = shuffle(winner.discard.map(c => ({ ...c, location: 'HAND', damage: 0, isExhausted: false })), () => rng.next());
          winner.discard = [];
        }
      }
      if (winner.deck.length > 0) {
        const cardsToChoose = winner.deck.slice(-3).reverse();
        if (cardsToChoose.length > 0) {
          let bestIdx = 0;
          let bestVal = -1;
          cardsToChoose.forEach((c, idx) => {
            let val = c.cost;
            if (c.type === 'Army') val += 5;
            if (val > bestVal) {
              bestVal = val;
              bestIdx = idx;
            }
          });
          const chosenCard = cardsToChoose[bestIdx];

          winner.deck.splice(-cardsToChoose.length);

          chosenCard.location = 'HAND';
          winner.hand.push(chosenCard);
          addLog(state, `🃏 Elouith Battle ability: Selected and added ${chosenCard.name} to hand.`, winnerId);

          cardsToChoose.forEach((c, idx) => {
            if (idx !== bestIdx) {
              c.location = 'HAND';
              winner.deck.unshift(c);
            }
          });
        }
      } else {
        addLog(state, `⚠️ Elouith Battle ability: Deck is empty, no cards to search.`);
      }
      break;
    }
    case 'Iridial': {
      // Battle: Remove all damage from a target unit.
      const friendlyUnits = winner.hq.filter(u => u.type === 'Army' || u.type === 'Warlord');
      const damagedUnits = friendlyUnits.filter(u => u.damage > 0);
      if (damagedUnits.length > 0) {
        const targetUnit = [...damagedUnits].sort((a, b) => b.damage - a.damage)[0];
        targetUnit.damage = 0;
        addLog(state, `😇 Iridial Battle ability: Fully healed friendly unit ${targetUnit.name} (removed all damage).`, winnerId);
      } else {
        addLog(state, ` Iridial Battle ability: No damaged friendly units in play to heal.`);
      }
      break;
    }
    case 'Osus IV': {
      // Battle: Take 1 [RESOURCE] from your opponent.
      if (opponent.resources > 0) {
        opponent.resources -= 1;
        winner.resources += 1;
        addLog(state, `💰 Osus IV Battle ability: Took 1 Resource from opponent!`, winnerId);
      } else {
        addLog(state, `💰 Osus IV Battle ability: Opponent has no resources to steal.`);
      }
      break;
    }
    case 'Carnath': {
      // Battle: Trigger the Battle ability of another planet in play.
      const otherPlanets = state.planets.filter(p => p.id !== planet.id && !p.capturedBy);
      if (otherPlanets.length > 0) {
        const targetPlanet = otherPlanets[0];
        addLog(state, ` Carnath Battle ability: Chained Battle trigger onto planet ${targetPlanet.name}!`, winnerId);
        triggerPlanetBattleAbility(state, winnerId, targetPlanet);
      } else {
        addLog(state, ` Carnath Battle ability: No other uncaptured planets in play to trigger.`);
      }
      break;
    }
    case 'Tarrus': {
      // Battle: If you control fewer units than your opponent, gain 3[RESOURCE] or draw 3 cards.
      const myUnits = winner.hq.filter(u => u.type === 'Army' || u.type === 'Warlord').length;
      const opUnits = opponent.hq.filter(u => u.type === 'Army' || u.type === 'Warlord').length;
      if (myUnits < opUnits) {
        if (winner.resources < 3) {
          winner.resources += 3;
          addLog(state, `🎁 Tarrus Battle ability: Gained +3 Resources (fewer units than opponent).`, winnerId);
        } else {
          drawCardsForPlayer(state, winnerId, 3);
          addLog(state, `🎁 Tarrus Battle ability: Drew 3 cards (fewer units than opponent).`, winnerId);
        }
      } else {
        addLog(state, ` Tarrus Battle ability: Not fewer units than opponent (${myUnits} vs ${opUnits}). Trigger failed.`);
      }
      break;
    }
    case 'Barlus': {
      // Battle: Discard 1 card at random from your opponent's hand.
      if (opponent.hand.length > 0) {
        const randIdx = Math.floor(Math.random() * opponent.hand.length);
        const discarded = opponent.hand.splice(randIdx, 1)[0];
        discarded.location = 'DISCARD';
        opponent.discard.push(discarded);
        addLog(state, `💥 Barlus Battle ability: Discarded random card ${discarded.name} from opponent's hand.`, winnerId);
      } else {
        addLog(state, ` Barlus Battle ability: Opponent has no cards in hand.`);
      }
      break;
    }
    case "Y'varn": {
      // Battle: Each player puts a unit into play from his hand at his HQ.
      [winnerId, opponentId].forEach(pId => {
        const pState = state.players[pId];
        const unitsInHand = pState.hand.filter(c => c.type === 'Army');
        if (unitsInHand.length > 0) {
          const bestUnit = [...unitsInHand].sort((a, b) => b.cost - a.cost)[0];
          const bestIdx = pState.hand.findIndex(u => u.instanceId === bestUnit.instanceId);
          if (bestIdx !== -1) {
            pState.hand.splice(bestIdx, 1);
            bestUnit.location = 'HQ';
            pState.hq.push(bestUnit);
            addLog(state, `🚀 Y'varn Battle ability: Deployed ${bestUnit.name} from hand directly to HQ for free!`, pId);
          }
        } else {
          addLog(state, ` Y'varn Battle ability: No army units in hand to deploy for player ${pId}.`);
        }
      });
      break;
    }
    default:
      addLog(state, `🪐 Battle ability for ${planet.name} is not defined or has no effect.`);
      break;
  }
};

const capturePlanet = (state: GameState, winnerId: string, planetIdx: number, triggerAbility: boolean) => {
  const planet = state.planets[planetIdx];
  planet.capturedBy = winnerId;
  state.players[winnerId].victoryDisplay.push(planet);
  addLog(state, `🚩 Victory! ${state.players[winnerId].faction} captures planet ${planet.name}!`);

  if (triggerAbility) {
    triggerPlanetBattleAbility(state, winnerId, planet);
  } else {
    addLog(state, `🔇 Player chose not to trigger the Battle ability of ${planet.name}.`, winnerId);
  }

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

  // Check shared planet victory: if 3 symbols of same type are collected
  checkPlanetSymbolVictory(state, winnerId);
};

export const resolvePlanetBattleAbilityChoice = (state: GameState, choice: boolean) => {
  const pending = state.pendingPlanetBattleAbilityTrigger;
  if (!pending) return;

  const planetIdx = state.planets.findIndex(p => p.id === pending.planetId);
  if (planetIdx !== -1) {
    const planet = state.planets[planetIdx];
    if (planet.isFirstPlanet) {
      capturePlanet(state, pending.winnerId, planetIdx, choice);
    } else {
      if (choice) {
        triggerPlanetBattleAbility(state, pending.winnerId, planet);
      } else {
        addLog(state, `🔇 Player chose not to trigger the Battle ability of ${planet.name}.`, pending.winnerId);
      }
    }
  }

  state.pendingPlanetBattleAbilityTrigger = undefined;
  state.combat.wasPlanetSplicedInResolution = false; // captured planet stays until HQ phase
  state.combatPlanetAwaitingAcknowledgement = true;
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
  let target = units.find(u => u.instanceId === targetId);

  if (!attacker || !target) return false;
  if (attacker.isExhausted) return false;

  // sm-librarian (Honored Librarian): Enemy units cannot attack this unit while you control another unit not named 'Honored Librarian'
  if (target.id === 'sm-librarian' && attacker.controllerId !== target.controllerId) {
    const friendlyOthers = units.filter(u => u.controllerId === target.controllerId && u.id !== 'sm-librarian');
    if (friendlyOthers.length > 0) {
      addLog(st, `⚠️ Cannot attack Honored Librarian because other friendly units protect it!`, attacker.controllerId);
      return false;
    }
  }

  // tau-firewarrior (Fire Warrior Elite): Intercept attack
  if (target.id !== 'tau-firewarrior' && target.controllerId !== attacker.controllerId) {
    const interceptor = units.find(u => u.id === 'tau-firewarrior' && u.controllerId === target.controllerId);
    if (interceptor) {
      addLog(st, `🛡️ Intercept! ${interceptor.name} steps in to defend ${target.name}.`, target.controllerId);
      target = interceptor;
    }
  }

  // Enforce Ranged subphase restriction
  if (st.combat.subPhase === 'RANGED' && !unitHasKeyword(st, attacker, 'Ranged')) {
    addLog(st, `⚠️ Only Ranged units can attack during the Ranged Skirmish subphase!`, attacker.controllerId);
    return false;
  }

  // Compute Base ATK
  let finalAtk = getUnitAdjustedAttack(st, attacker);
  
  // Apply Brutal
  if (unitHasKeyword(st, attacker, 'Brutal') || 
     (attacker.id !== 'ork-nazdreg' && attacker.faction === 'Orks' && hasWarlordAtPlanet(st, 'ai-1', planet.id) && st.players['ai-1'].hq.some(u => u.id === 'ork-nazdreg' && !u.isBloodied))) {
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
    isArmorbane: unitHasKeyword(st, attacker, 'Armorbane')
  };

  addLog(st, `⚔️ ${attacker.name} attacks ${target.name} for ${finalAtk} raw damage!`, attacker.controllerId);

  // tau-experimentaldevilfish: Reaction: After this unit declares an attack, move another friendly unit at this planet to HQ or adjacent planet
  if (attacker.id === 'tau-experimentaldevilfish') {
    const others = units.filter(u => u.controllerId === attacker.controllerId && u.instanceId !== attacker.instanceId && u.type === 'Army');
    if (others.length > 0) {
      const companion = others[0];
      companion.location = 'HQ';
      companion.locationId = undefined;
      addLog(st, `🛸 Experimental Devilfish: Transported friendly unit ${companion.name} back to HQ safety.`, attacker.controllerId);
    }
  }

  // eldar-silveredbladeavengers: Reaction: After this unit is declared as an attacker against a non-warlord unit, exhaust that unit
  if (attacker.id === 'eldar-silveredbladeavengers' && target.type !== 'Warlord' && !target.isExhausted) {
    target.isExhausted = true;
    addLog(st, `⚔️ Silvered Blade Avengers: Exhausted target unit ${target.name}.`, attacker.controllerId);
  }

  // tau-repulsorimpactfield: Attachment: when host is declared as defender, deal 1 damage to the attacker
  const defenderAttachments = getAttachmentsForUnit(st, target.instanceId);
  if (defenderAttachments.some(att => att.id === 'tau-repulsorimpactfield')) {
    applyDamageToUnitInternal(st, attacker, 1, true);
    addLog(st, `⚡ Repulsor Impact Field: Deals 1 damage back to attacker ${attacker.name}.`, target.controllerId);
  }

  // chaos-diremutation: Attachment: host gets +2 ATK/+2 HP. Forced Interrupt: When attached unit exhausts (declares attack), deal it 1 damage
  const attackerAttachments = getAttachmentsForUnit(st, attacker.instanceId);
  if (attackerAttachments.some(att => att.id === 'chaos-diremutation')) {
    applyDamageToUnitInternal(st, attacker, 1, true);
    addLog(st, `🧬 Dire Mutation: Deals 1 damage to host ${attacker.name} upon exhausting.`, attacker.controllerId);
  }

  // ork-burnaboyz attack reaction: deal 1 damage to a different enemy unit at the same planet
  if (attacker.id === 'ork-burnaboyz') {
    const otherEnemies = units.filter(u => u.controllerId !== attacker.controllerId && u.instanceId !== target.instanceId);
    if (otherEnemies.length > 0) {
      const burnTarget = [...otherEnemies].sort((a, b) => (a.hp - a.damage) - (b.hp - b.damage))[0];
      applyDamageToUnit(st, burnTarget, 1);
      addLog(st, `🔥 Burna Boyz declare attack! Reaction deals 1 damage to other unit ${burnTarget.name}.`, attacker.controllerId);
    }
  }

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

// Resolve Area Effect splash damage to other opposing units
export const resolveAreaEffectSplash = (state: GameState, pending: ShieldDecisionContext) => {
  const planetIndex = state.combat.activePlanetIndex;
  if (planetIndex === -1 || planetIndex === undefined) return;

  const planet = state.planets[planetIndex];
  const units = getUnitsAtPlanet(state, planet.id);

  // Find the attacker
  const attacker = units.find(u => u.instanceId === pending.attackerId) || 
                   Object.values(state.players).flatMap(p => p.hq).find(u => u.instanceId === pending.attackerId);
  if (!attacker) return;

  // Check if Eldar Zen 'Xi' Aonia is present and nullifies Area Effect for enemy units
  const zensPresent = units.some(u => 
    u.controllerId !== attacker.controllerId && 
    u.type === 'Warlord' && 
    u.description?.includes("Each enemy unit at this planet loses the Area Effect keyword")
  );
  if (zensPresent) {
    addLog(state, `⛔ Zen 'Xi' Aonia suppresses enemy Area Effect keyword at this planet!`, attacker.controllerId);
    return;
  }

  // Find if attacker has Area Effect keyword
  let areaEffectValue = 0;
  for (const kw of attacker.keywords || []) {
    const m = kw.match(/Area\s+Effect\s*\((\d+)\)/i);
    if (m) {
      areaEffectValue = parseInt(m[1], 10);
      break;
    }
  }

  if (areaEffectValue <= 0) return;

  addLog(state, `💥 Area Effect (${areaEffectValue}) triggered by ${attacker.name}! Resolving splash damage...`, attacker.controllerId);

  // Find target player to check for global/local reductions
  const opponentId = attacker.controllerId === 'player-1' ? 'ai-1' : 'player-1';
  const opponent = state.players[opponentId];

  // Tyranid Support: "Reduce damage dealt by Area Effect to 1."
  const hasTyranidSupportReduction = opponent.hq.some(s => s.description?.includes("Reduce damage dealt by Area Effect to 1"));
  if (hasTyranidSupportReduction) {
    areaEffectValue = 1;
    addLog(state, `🛡️ Tyranid support reduces Area Effect damage to 1!`);
  }

  // Get opposing units that are NOT the main target of the attack
  const opposingUnits = units.filter(u => 
    u.controllerId === opponentId && 
    u.instanceId !== pending.targetId
  );

  opposingUnits.forEach(u => {
    // Check if immune to Area Effect
    const isImmune = u.description?.includes("Cannot be damaged by Area Effect") || 
                     units.some(other => 
                       other.controllerId === opponentId && 
                       other.instanceId !== u.instanceId && 
                       other.description?.includes("Each other unit you control at this planet cannot be damaged by Area Effect")
                     );

    if (isImmune) {
      addLog(state, `🛡️ ${u.name} is immune to Area Effect damage.`);
    } else {
      applyDamageToUnit(state, u, areaEffectValue);
      addLog(state, `💥 Splash! ${u.name} takes ${areaEffectValue} Area Effect damage. (${u.damage}/${u.hp} Wounds)`);
    }
  });
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

  // Resolve Area Effect splash damage before clearing pending damage
  resolveAreaEffectSplash(state, pending);

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

  // Restore activePlayerId to the original attacker so advanceCombatSequence alternates correctly
  const attacker = getUnitsAtPlanet(state, targetPlanet.id).find(u => u.instanceId === pending.attackerId) ||
                   Object.values(state.players).flatMap(p => p.hq).find(u => u.instanceId === pending.attackerId);
  if (attacker) {
    state.activePlayerId = attacker.controllerId;
  }

  // Resolve Area Effect splash damage before clearing pending damage
  resolveAreaEffectSplash(state, pending);

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

    // Tabletop rule: All units at the active combat planet ready simultaneously before retreat windows open!
    units.forEach(u => u.isExhausted = false);

    addLog(state, `🔄 All units at the sector ready simultaneously. Sequential retreat windows are now open!`);
    addLog(state, `🏳️ ${state.players[state.activePlayerId].faction} gets the first retreat opportunity.`);
  }
};

export const passCombatAction = (state: GameState, playerId: string) => {
  if (state.activePlayerId !== playerId) return;
  addLog(state, `⏮️ ${state.players[playerId].faction} passed their combat action.`);
  advanceCombatSequence(state);
};


// Active Turn Warlord Retreat
export const retreatWarlordActiveTurn = (state: GameState, playerId: string): boolean => {
  const planet = state.planets[state.combat.activePlanetIndex];
  const player = state.players[playerId];
  const warlord = player.hq.find(u => u.type === 'Warlord');

  if (!warlord || warlord.isExhausted) {
    addLog(state, `⚠️ Warlord is already exhausted or not found! Cannot retreat.`, playerId);
    return false;
  }

  // Verify Warlord is at the active combat planet
  const isCommitted = state.warlordCommitments[playerId] === state.combat.activePlanetIndex;
  const isPresent = getUnitsAtPlanet(state, planet.id).some(u => u.instanceId === warlord.instanceId);
  if (!isCommitted && !isPresent) {
    addLog(state, `⚠️ Warlord is not at the active planet to retreat.`, playerId);
    return false;
  }

  // Warlord exhausts to retreat
  warlord.location = 'HQ';
  warlord.locationId = undefined;
  warlord.isExhausted = true;

  addLog(state, `🏃 ${warlord.name} exhausts to retreat to HQ, consuming the combat turn.`, playerId);

  // Alternate turn to opponent
  advanceCombatSequence(state);
  return true;
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

// Complete Player Retreat Window
export const completePlayerRetreatWindow = (state: GameState, playerId: string) => {
  const planet = state.planets[state.combat.activePlanetIndex];
  const initiativePlayerId = getCombatInitiativePlayer(state, planet.id);

  if (playerId === initiativePlayerId) {
    // First player (initiative) finished their window. Now alternate to the second player!
    const opponentId = playerId === 'player-1' ? 'ai-1' : 'player-1';
    state.activePlayerId = opponentId;
    addLog(state, `🏳️ ${state.players[opponentId].faction} gets the next retreat opportunity.`);
  } else {
    // Second player finished their window. Both players have resolved their retreat windows!
    // Now complete the combat round and check if combat continues or finishes.
    completeCombatRoundAndReady(state);
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
    return;
  }

  // Battle ended!
  let winnerId = '';
  if (smRemaining && !orksRemaining) winnerId = 'player-1';
  if (orksRemaining && !smRemaining) winnerId = 'ai-1';

  if (winnerId) {
    addLog(state, `🏅 Combat resolved! ${state.players[winnerId].faction} wins the battle of ${planet.name}.`);

    // eldar-eldorathstarbane reaction: After this warlord is declared winner of a battle/wins a battle:
    // look at top 3 cards of deck, draw 1, put rest on bottom.
    const warlord = state.players[winnerId].hq.find(u => u.type === 'Warlord');
    if (warlord && warlord.id === 'eldar-eldorathstarbane' && !warlord.isBloodied) {
      const winnerState = state.players[winnerId];
      if (winnerState.deck.length > 0) {
        const top3 = winnerState.deck.slice(-3).reverse();
        // Draw 1
        drawCardsForPlayer(state, winnerId, 1);
        addLog(state, `🔮 Eldorath Starbane battle-win reaction: Inspected top 3 cards, drew 1.`, winnerId);
      }
    }
    
    if (winnerId === 'player-1') {
      // Prompt for Battle ability trigger choice!
      state.pendingPlanetBattleAbilityTrigger = { planetId: planet.id, winnerId: 'player-1' };
      return;
    } else {
      // AI automatically triggers Battle ability
      if (planet.isFirstPlanet) {
        capturePlanet(state, winnerId, planetIdx, true);
      } else {
        triggerPlanetBattleAbility(state, winnerId, planet);
      }
    }
  } else {
    addLog(state, `💀 Mutual destruction at ${planet.name}. No survivors.`);
  }

  // Pause for manual confirmation!
  state.combat.wasPlanetSplicedInResolution = false; // captured planet stays until HQ phase
  state.combatPlanetAwaitingAcknowledgement = true;
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

  // Handle captured planet removal and replacement from deck
  const activePlanets = state.planets.filter(p => !p.capturedBy);
  const capturedCount = state.planets.length - activePlanets.length;
  
  if (capturedCount > 0) {
    state.planets.forEach(p => {
      if (p.capturedBy) {
        addLog(state, `🪐 Captured planet ${p.name} is removed from the active row.`);
      }
    });

    const drawnPlanets: Planet[] = [];
    for (let i = 0; i < capturedCount; i++) {
      if (state.planetDeck && state.planetDeck.length > 0) {
        const newPlanet = state.planetDeck.shift();
        if (newPlanet) {
          drawnPlanets.push(newPlanet);
          addLog(state, `🪐 A new sector has emerged from the planet deck: ${newPlanet.name}!`);
        }
      }
    }
    
    state.planets = [...activePlanets, ...drawnPlanets];
    
    // Re-index planets
    state.planets.forEach((p, idx) => {
      p.index = idx;
      p.isFirstPlanet = (idx === 0);
    });
    
    if (state.planets.length > 0) {
      addLog(state, `🚨 New First Planet of the galaxy is: ${state.planets[0].name}!`);
    }
  }

  // Ready all exhausted units across HQ and Planets
  Object.values(state.players).forEach(p => {
    p.hq.forEach(u => {
      if (u.isExhausted) {
        u.isExhausted = false;
        // tau-vashyatrailblazer ready reaction: +1 ATK until end of phase
        if (u.id === 'tau-vashyatrailblazer') {
          (u as any).tempAttackBuff = ((u as any).tempAttackBuff || 0) + 1;
          addLog(state, `⚡ Vash'ya Trailblazer readied: Gains +1 ATK until the end of the phase.`, u.controllerId);
        }
      }
      delete (u as any).flashGitzUsedThisPhase;
      delete (u as any).tempAttackBuff; // Clear temporary phase attack buffs at end of phase/round
      delete (u as any).tempRangedGranted;
    });
    // Physically placed units too
    state.planets.forEach(pl => {
      getUnitsAtPlanet(state, pl.id).forEach(u => {
        if (u.isExhausted) {
          u.isExhausted = false;
          // tau-vashyatrailblazer ready reaction
          if (u.id === 'tau-vashyatrailblazer') {
            (u as any).tempAttackBuff = ((u as any).tempAttackBuff || 0) + 1;
            addLog(state, `⚡ Vash'ya Trailblazer readied: Gains +1 ATK until the end of the phase.`, u.controllerId);
          }
        }
        delete (u as any).flashGitzUsedThisPhase;
        delete (u as any).tempAttackBuff;
        delete (u as any).tempRangedGranted;
      });
    });
  });

  // Infernal Gateway cleanup: sacrifice temporary Daemon units
  Object.values(state.players).forEach(p => {
    p.hq.concat(state.planets.flatMap(pl => getUnitsAtPlanet(state, pl.id))).forEach(u => {
      if ((u as any).infernalGatewayDeployed) {
        addLog(state, `🔥 Infernal Gateway cleanup: Sacrificing temporary Daemon unit ${u.name}.`, u.controllerId);
        destroyUnit(state, u);
      }
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
      const enemyUnits = units.filter(u => {
        if (u.controllerId === 'player-1') {
          if (u.id === 'sm-librarian') {
            const friendlyOthers = units.filter(o => o.controllerId === 'player-1' && o.id !== 'sm-librarian');
            return friendlyOthers.length === 0;
          }
          return true;
        }
        return false;
      });

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
      // For simplicity, AI passes retreat choices and completes its window
      completePlayerRetreatWindow(state, 'ai-1');
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

// --- Attachment Helper Functions ---

export const getAttachmentsForUnit = (state: GameState, unitId: string): CardInstance[] => {
  const list: CardInstance[] = [];
  Object.values(state.players).forEach(player => {
    player.hq.forEach(card => {
      if (card.type === 'Attachment' && card.attachedToId === unitId) {
        list.push(card);
      }
    });
  });
  return list;
};

export const getUnitAdjustedAttack = (state: GameState, unit: CardInstance): number => {
  let attack = unit.attack;

  // Straken's Command Squad: Gets +1 ATK for each damage on it
  if (unit.id === 'astra-strakenscommandsquad') {
    attack += unit.damage;
  }

  // Vicious Bloodletter: Gets +2 ATK when attacking (we check if it is the active attacker in combat MELEE/RANGED subphases)
  if (unit.id === 'chaos-viciousbloodletter' && state.phase === 'COMBAT' && (state.combat.subPhase === 'MELEE' || state.combat.subPhase === 'RANGED') && state.combat.pendingDamage?.attackerId === unit.instanceId) {
    attack += 2;
  }

  // Warlord buffs
  if (unit.location === 'PLANET' && unit.locationId) {
    // Straken Warlord: Other friendly Astra Militarum units at this planet get +1 ATK
    if (unit.faction === 'Astra Militarum' && unit.type !== 'Warlord') {
      const strakenPresent = getUnitsAtPlanet(state, unit.locationId).some(
        u => u.id === 'astra-colonelstraken' && u.controllerId === unit.controllerId && !u.isBloodied
      );
      if (strakenPresent) {
        attack += 1;
      }
    }
  }

  const attachments = getAttachmentsForUnit(state, unit.instanceId);
  attachments.forEach(attachment => {
    if (attachment.id === 'tau-ionrifle') {
      attack += 3;
    } else if (attachment.id === 'sm-godwyn') {
      attack += 1;
    } else if (attachment.id === 'sm-tempestblade') {
      attack += 1;
    } else if (attachment.id === 'sm-centurionwarsuit') {
      attack += 2;
    } else if (attachment.id === 'sm-vitarusthesanguinesword') {
      attack += 1;
    } else if (attachment.id === 'ork-hugechainchoppa') {
      attack += 4;
    } else if (attachment.id === 'ork-goffbigchoppa') {
      attack += 2;
    } else if (attachment.id === 'astra-strakenscunning') {
      attack += 1;
    } else if (attachment.id === 'astra-theglovodaneagle') {
      attack += 1;
    } else if (attachment.id === 'tau-commandlinkdrone') {
      attack += 1;
    } else if (attachment.id === 'eldar-bansheepowersword') {
      attack += 2;
    } else if (attachment.id === 'chaos-markofchaos') {
      attack += 1;
    } else if (attachment.id === 'chaos-diremutation') {
      attack += 2;
    }
  });

  // Command-link Drone: While attached unit is ready, each other Tau attachment at its planet gets +1 ATK (so it buffs this unit's attack if this unit has other Tau attachments, or if a ready unit has command-link drone at the planet, we add buffs)
  if (unit.location === 'PLANET' && unit.locationId) {
    const readyDroneHosts = getUnitsAtPlanet(state, unit.locationId).filter(u => 
      !u.isExhausted && getAttachmentsForUnit(state, u.instanceId).some(att => att.id === 'tau-commandlinkdrone')
    );
    if (readyDroneHosts.length > 0) {
      // For each Tau attachment on this unit (excluding commandlinkdrone itself if we only count OTHER Tau attachments)
      attachments.forEach(att => {
        if (att.faction === 'Tau' && att.id !== 'tau-commandlinkdrone') {
          attack += 1;
        }
      });
    }
  }

  // Agonizer of Bren: Attached unit gets +1 ATK for each Khymera token you control
  if (attachments.some(att => att.id === 'de-agonizerofbren')) {
    const khymeraCount = state.players[unit.controllerId].hq.concat(getPlacedUnitsForPlayer(state, unit.controllerId))
      .filter(u => u.id === 'de-khymeratoken' || u.name === 'Khymera').length;
    attack += khymeraCount;
  }

  // Infantry Conscripts: Gets +2 ATK for each support you control
  if (unit.id === 'astra-infantryconscripts') {
    const supportCount = state.players[unit.controllerId].hq.filter(c => c.type === 'Support').length;
    attack += supportCount * 2;
  }

  // Goff Boyz: +3 ATK while at the first planet
  if (unit.id === 'ork-goffboyz' && unit.location === 'PLANET' && unit.locationId) {
    const planet = state.planets.find(p => p.id === unit.locationId);
    if (planet && planet.isFirstPlanet) {
      attack += 3;
    }
  }

  // Temporary phase bonuses (e.g. Vash'ya Trailblazer ready bonus, Catachan Outpost bonus)
  if ((unit as any).tempAttackBuff) {
    attack += (unit as any).tempAttackBuff;
  }

  return attack;
};

export const getUnitAdjustedHp = (state: GameState, unit: CardInstance): number => {
  let hp = unit.hp;
  const attachments = getAttachmentsForUnit(state, unit.instanceId);
  
  // Apply flat additions first
  attachments.forEach(attachment => {
    if (attachment.id === 'sm-godwyn') {
      hp += 1;
    } else if (attachment.id === 'astra-hostilegear') {
      hp += 3;
    } else if (attachment.id === 'astra-dozerblade') {
      hp += 2;
    } else if (attachment.id === 'sm-centurionwarsuit') {
      hp += 4;
    } else if (attachment.id === 'sm-thebladeofantwyr') {
      hp += 1;
    } else if (attachment.id === 'sm-vitarusthesanguinesword') {
      hp += 1;
    } else if (attachment.id === 'tau-commandlinkdrone') {
      hp += 1;
    } else if (attachment.id === 'astra-bodyguard') {
      hp += 3;
    } else if (attachment.id === 'chaos-diremutation') {
      hp += 2;
    }
  });

  // Apply multipliers
  attachments.forEach(attachment => {
    if (attachment.id === 'ork-cybork') {
      hp *= 2;
    }
  });

  return hp;
};

export const getUnitAdjustedCommand = (state: GameState, unit: CardInstance): number => {
  let command = unit.commandIcons;
  const attachments = getAttachmentsForUnit(state, unit.instanceId);
  attachments.forEach(attachment => {
    if (attachment.id === 'neutral-promotion') {
      command += 2;
    }
  });

  // Bad Dok: +3 command icons while damaged
  if (unit.id === 'ork-baddok' && unit.damage > 0) {
    command += 3;
  }

  return command;
};

export const unitHasKeyword = (state: GameState, unit: CardInstance, keyword: string): boolean => {
  if (unit.keywords.includes(keyword)) return true;
  const attachments = getAttachmentsForUnit(state, unit.instanceId);
  if (keyword === 'Ranged') {
    if (attachments.some(att => att.id === 'ork-rokkit')) return true;
    if ((unit as any).tempRangedGranted) return true;
  }
  return false;
};

export const deployAttachment = (state: GameState, playerId: string, cardInstanceId: string, hostUnitId: string): boolean => {
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

  let cost = card.cost;
  // tau-ambushplatform: Interrupt: When you deploy an attachment, reduce its cost by 1.
  const hasAmbushPlatform = player.hq.some(u => u.id === 'tau-ambushplatform');
  if (hasAmbushPlatform) {
    cost = Math.max(0, cost - 1);
  }

  if (player.resources < cost) {
    addLog(state, `⚠️ Not enough resources to deploy ${card.name}!`, playerId);
    return false;
  }

  // Find the host unit
  let hostUnit: CardInstance | undefined;
  for (const p of Object.values(state.players)) {
    hostUnit = p.hq.find(u => u.instanceId === hostUnitId);
    if (hostUnit) break;
  }

  if (!hostUnit) {
    addLog(state, `⚠️ Host unit not found for attachment!`, playerId);
    return false;
  }

  // Iron Halo targeting restriction: Attach only to Cato Sicarius
  if (card.id === 'sm-ironhalo' && hostUnit.id !== 'sm-cato') {
    addLog(state, `⚠️ Iron Halo can only be attached to Captain Cato Sicarius!`, playerId);
    return false;
  }

  // Deduct resources
  player.resources -= card.cost;
  // Remove from hand
  player.hand.splice(cardIndex, 1);

  // Set location to match host unit
  card.location = hostUnit.location;
  card.locationId = hostUnit.locationId;
  card.attachedToId = hostUnit.instanceId;

  // Add to player's active list
  player.hq.push(card);

  addLog(state, `📎 Attached ${card.name} to ${hostUnit.name}. Cost: ${card.cost} Resources.`, playerId);

  // Reset pass counts, alternate turn
  state.deployPassCount = 0;
  alternateDeployTurn(state);
  return true;
};
