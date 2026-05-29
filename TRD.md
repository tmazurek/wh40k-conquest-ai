# Technical Requirements Document: Conquest AI Engine

## 1. Tech Stack Recommendation
*   **Language:** TypeScript (Strict mode). Essential for managing complex game states and card types.
*   **Architecture:** Headless Redux-style State Machine.
*   **Frontend:** React (functional components) with Tailwind CSS.
*   **State Management:** Immer.js (for immutable state updates) or Redux Toolkit.
*   **Testing:** Jest/Vitest for headless engine testing.

---

## 2. Core Data Structures (The "State")
The game state must be a single, serializable JSON object. This allows for the "Deterministic Replay" requirement.

### 2.1 GameState Interface
```typescript
interface GameState {
  seed: string;
  phase: 'DEPLOY' | 'COMMAND' | 'COMBAT' | 'HQ';
  activePlayerId: string; // The player whose turn it is
  priorityPlayerId: string; // The player currently allowed to take an Action/Interrupt
  initiativePlayerId: string; // Holder of the Initiative token
  planets: PlanetInstance[];
  players: Record<string, PlayerState>;
  turnHistory: GameAction[];
  interruptStack: InterruptContext[]; // Track nested effects
}
```

### 2.2 Card Instance
Cards should have a base template (JSON) but a unique `instanceId` when in game to track damage and exhaustion.
```typescript
interface CardInstance {
  id: string; // e.g., "sm-001"
  instanceId: string; // unique guid
  controllerId: string;
  location: 'HAND' | 'PLANET' | 'HQ' | 'DISCARD';
  locationId?: string; // Planet index 0-6
  isExhausted: boolean;
  damage: number;
  isBloodied: boolean; // For Warlords
}
```

---

## 3. The "Action Window" Controller
This is the most critical logic block. It manages how the game pauses for player input.

### 3.1 Window Logic Flow
1.  **Trigger Window:** Engine enters a phase (e.g., "Combat Action Window").
2.  **Set Priority:** `priorityPlayerId` is set to the `initiativePlayerId`.
3.  **Wait for Input:**
    *   If `Action` is taken: Resolve action, reset "Pass" count, keep priority with that player (Conquest rules: you can keep taking actions until you pass).
    *   If `Pass` is taken: Switch `priorityPlayerId` to the opponent.
4.  **Close Window:** When both players pass consecutively, the engine moves to the next game step.

---

## 4. Combat Step Resolution (The "Sub-State")
Combat is a "game within a game." The developer must implement a **Combat Manager** that tracks:
1.  **Active Planet:** Which planet is currently resolving.
2.  **Combat Step:** Ranged -> Melee Round 1 -> Melee Round 2...
3.  **Attacker Selection:** Prompting the active player to pick a ready unit.
4.  **Damage Assignment:** 
    *   Calculate raw damage.
    *   **Pause Engine:** Create a `ShieldContext`.
    *   **Request Input:** Ask defender for a Shield Card.
    *   **Apply Result:** Modify unit HP/Damage.

---

## 5. AI Heuristic Implementation
Since we aren't using Machine Learning, the AI will use a **"Weighted Move Scorer."**

### 5.1 The Scoring Function
For every legal move, the AI calculates a score:
*   **Winning Command Struggle:** +50 points.
*   **Killing a Unit:** + (Cost of unit * 10) points.
*   **Warlord taking damage:** -20 points per damage.
*   **Using a Shield:** If it saves a unit worth > 2 resources, +30 points.

### 5.2 AI Decision Loop
1.  Generate list of all `LegalActions`.
2.  For each action, simulate the *immediate* resulting state.
3.  Apply the scoring function.
4.  Execute the action with the highest score.
5.  If no actions score above a "Pass Threshold," the AI executes a `Pass`.

---

## 6. Card Scripting System
To avoid hard-coding 60+ cards, use a **Hook System**.

**Example: Cato Sicarius (Reaction: Gain 1 resource when enemy is killed)**
```typescript
// cards/sm/cato.ts
export const CatoSicarius: CardDefinition = {
  id: 'sm-001',
  name: 'Captain Cato Sicarius',
  hooks: {
    onEnemyDestroyed: (state, context) => {
      if (context.location === state.cards[this.id].location) {
        state.players[this.controllerId].resources += 1;
        state.log.push("Cato's ability grants 1 resource.");
      }
    }
  }
}
```

---

## 7. UI/UX Technical Specs
*   **Asset Management:** UI should fetch card art via ID (`/assets/cards/{id}.jpg`).
*   **Drag-and-Drop:** Use `react-dnd` or `dnd-kit` for deploying units to planets.
*   **Responsiveness:** The board state is horizontal. Use a "Scrollable Row" for planets 1-7.
*   **The Log:** Implement a "Log Provider" that captures every state change and converts it to a human-readable string (e.g., `ACTION_PLAY_UNIT` -> "Player plays Void Pirate to Planet 1").

---

## 8. Development Testing Requirements
*   **Headless Test Suite:** A script that runs the AI against itself for 1,000 games.
    *   *Pass Condition:* 0 crashes, 100% of games reach a "Victory" state.
*   **Scenario Injection:** Ability to load a JSON state (e.g., "Warlord has 5 damage, it is the Shield Window") and verify the UI displays the correct buttons.
