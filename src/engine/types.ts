export type Faction = 'Space Marines' | 'Orks' | 'Neutral' | 'Tau' | 'Chaos' | 'Astra Militarum' | 'Dark Eldar' | 'Eldar' | 'Necron' | 'Tyranid';
export type CardType = 'Warlord' | 'Army' | 'Attachment' | 'Event' | 'Support';
export type Phase = 'DEPLOY' | 'COMMAND' | 'COMBAT' | 'HQ';
export type CombatSubPhase = 'NONE' | 'RANGED' | 'MELEE' | 'RETREAT' | 'SHIELD_PROMPT';

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  faction: Faction;
  cost: number;
  commandIcons: number;
  attack: number;
  hp: number;
  shields: number;
  traits: string[];
  keywords: string[];
  description: string;
  conquestCardId?: string;
  startingCards?: number;
  startingResources?: number;
}

export interface CardInstance extends CardDefinition {
  instanceId: string;
  controllerId: string; // "player-1" or "ai-1"
  damage: number;
  isExhausted: boolean;
  isBloodied: boolean;
  location: 'HAND' | 'PLANET' | 'HQ' | 'DISCARD';
  locationId?: string; // "planet-0" to "planet-4"
  attachedToId?: string; // For attachments (if implemented)
}

export interface Planet {
  id: string; // "planet-0" to "planet-4"
  name: string;
  index: number; // 0 to 4
  materials: number; // Resources gained by winning command
  cards: number; // Card draws gained by winning command
  symbols: ('Tech' | 'Strongpoint' | 'Material')[];
  isFirstPlanet: boolean;
  capturedBy?: string; // "player-1" or "ai-1"
  conquestCardId?: string;
}

export interface ActionLog {
  timestamp: string;
  message: string;
  playerId?: string;
}

export interface ShieldDecisionContext {
  attackerId: string;
  targetId: string;
  damageAmount: number;
  isArmorbane: boolean;
}

export interface CombatState {
  activePlanetIndex: number; // -1 if not active
  subPhase: CombatSubPhase;
  activeAttackerId?: string; // unit that is attacking
  targetUnitId?: string;     // unit targeted for attack
  pendingDamage?: ShieldDecisionContext; // damage waiting for shield/assign
  unitsAttackedThisRound: string[]; // instanceIds that have already attacked
  wasPlanetSplicedInResolution?: boolean;
}

export interface PlayerState {
  id: string;
  faction: Faction;
  resources: number;
  hand: CardInstance[];
  deck: CardInstance[];
  discard: CardInstance[];
  hq: CardInstance[]; // Warlord usually, and units that retreated or deployed here
  victoryDisplay: Planet[];
}

export interface GameState {
  turn: number;
  phase: Phase;
  firstPlayerId: string; // Player with initiative token
  activePlayerId: string; // Whose turn it is to act right now
  planets: Planet[];
  planetDeck?: Planet[];
  players: Record<string, PlayerState>;
  log: ActionLog[];
  isGameOver: boolean;
  winner?: string;
  combat: CombatState;

  // Warlord commitments (secret until revealed)
  warlordCommitments: Record<string, number | null>; // playerId -> planetIndex
  warlordCommitmentsRevealed: boolean;

  // Deployment Consecutive passes
  deployPassCount: number;
  playersPassedDeploy: Record<string, boolean>;

  // Manual phase transition navigation flags
  warlordCommitmentsPlaced?: boolean;
  commandStrugglesResolved?: boolean;
  combatPlanetAwaitingAcknowledgement?: boolean;
  pendingPlanetBattleAbilityTrigger?: {
    planetId: string;
    winnerId: string;
  };
}
