# Product Requirements Document: Warhammer 40,000: Conquest vs. AI (MVP)

## 1. Product Overview
This project is a browser-based, single-player implementation of the *Warhammer 40,000: Conquest* Living Card Game (LCG). The MVP focuses on providing a high-fidelity rules engine and a functional AI opponent for a specific "Starter Set" matchup: **Space Marines vs. Orks**.

## 2. Problem Statement & Goals
*   **Problem:** There is no modern, browser-accessible way to practice *Conquest* against an AI. Existing options require manual rule enforcement or human opponents.
*   **Goal:** Create a "headless-first" game engine that enforces the complex timing and rules of *Conquest*, allowing a player to complete a full game against an AI that always makes legal, coherent moves.

## 3. Target User
*   **New Players:** Seeking to learn the phase flow and keyword interactions.
*   **Veteran Players:** Looking for quick solo practice or testing deck-specific interactions (limited to the MVP card pool).

## 4. MVP Scope

### 4.1 Included
*   **Single-Player Only:** Human vs. AI.
*   **Specific Matchup:** Space Marines (Cato Sicarius) vs. Orks (Nazdreg) Core Set starter decks.
*   **Full Rules Enforcement:** Correct handling of all 5 phases (Deploy, Command, Combat, HQ).
*   **Keyword Support:** Armorbane, Area Effect (X), Brutal, Ranged, Mobile.
*   **Action Windows:** A priority-pass system for Interrupts and Actions.
*   **Deterministic Engine:** Seeded RNG for debugging and replays.

### 4.2 Excluded
*   Multiplayer or Deckbuilding.
*   Full card pool (beyond the specified starter decks).
*   Advanced AI (Neural networks/MCTS)—the MVP uses heuristic-based logic.
*   Undo/Rewind functionality.

---

## 5. Gameplay & Rules Engine Requirements

### 5.1 The "Priority" System
The engine must implement a formal **Action Window** system to handle the game's high level of interactivity:
*   **Priority Pass:** For every action window defined in the rules, the player with Initiative has the first opportunity to act.
*   **Window Closure:** A window closes only after both players "Pass" consecutively.
*   **Interrupts:** The engine must pause execution to check for "Interrupt" triggers (e.g., when a unit is about to take damage).

### 5.2 Damage & The Shield Mechanic
Damage must follow a strict 3-step resolution to allow for the **Shield** mechanic:
1.  **Assign:** Calculate potential damage (including Brutal or Area Effect).
2.  **Shield Window:** The defender may discard exactly **one** card with shield icons from their hand to reduce damage.
3.  **Apply:** Remaining damage is placed as tokens. If damage ≥ HP, the unit is destroyed (triggering relevant Reactions).

### 5.3 Combat Phase Flow
The engine must resolve combat at each planet sequentially:
*   **Ranged Skirmish:** Ranged units attack first.
*   **Melee Rounds:** Alternating attacks between players.
*   **Retreat Option:** Players must be prompted to "Retreat" their units to HQ at the end of each combat round.

### 5.4 Command Struggle
The engine must automatically calculate the winner of the Command Struggle at each planet based on Command Icons, awarding resources and card draws instantly before moving to the Combat Phase.

---

## 6. AI Requirements
The AI is not required to be "Expert," but it must be **Legal** and **Consistent**.
*   **Deterministic Logic:** Given the same board state and seed, the AI should make the same move.
*   **Heuristic Decision Making:**
    *   **Deploy:** Prioritize high-command units at early planets.
    *   **Combat:** Target units that can be destroyed in one hit; use Shields to protect the Warlord or high-cost units.
    *   **Commitment:** Use a simple weighted check (Value of Planet vs. Risk of Warlord death).
*   **Stall Prevention:** If the AI has no valid moves or resources, it must automatically "Pass" to avoid hanging the game.

---

## 7. Technical Requirements

### 7.1 Headless Engine Architecture
The core logic must be entirely decoupled from the UI.
*   **Core:** State machine managing phases and the "Active Player" token.
*   **Rules Engine:** Logic for keywords, damage calculation, and win conditions.
*   **Action Log:** A JSON-based history of every action taken for replayability.

### 7.2 Card Data Schema
Cards must be stored as JSON objects. This allows the engine to be "data-driven" rather than hard-coding every card effect.
```json
{
  "id": "sm-001",
  "name": "Captain Cato Sicarius",
  "traits": ["Astartes", "Warrior"],
  "stats": { "atk": 2, "hp": 6, "command": 2, "shields": 0 },
  "abilities": [
    {
      "trigger": "after_enemy_destroyed",
      "type": "Reaction",
      "effect": "gain_resource",
      "value": 1
    }
  ]
}
```

---

## 8. UI & UX Requirements
*   **Board Layout:** Clear separation of the 5-7 Planets, HQ zones, Hands, and Discard piles.
*   **The Command Dial:** A dedicated UI modal for secret Warlord commitment.
*   **Decision Prompts:** Clear "Action" vs "Interrupt" prompts so the player knows why the game has paused.
*   **Visual Tally:** A live display of Command Icons and total ATK/HP at each planet to reduce manual counting.
*   **Game Log:** A scrollable text feed of all events (e.g., "AI plays 10th Company Tactician to Planet 1").

---

## 9. Success Criteria
1.  **Full Loop:** A player can start, play, and finish a game (Win/Loss) without the engine breaking.
2.  **Rule Accuracy:** No illegal moves (e.g., playing a card without resources, attacking with an exhausted unit).
3.  **Stability:** The browser tab does not crash during long combat resolutions.
4.  **Debugging:** A developer can take a "Save State" (JSON) and reload it to reproduce a specific bug.

---

## 10. Milestones
*   **M1: Schema & State:** Define all JSON card data and the initial game-state object.
*   **M2: Phase Engine:** Implement the transition logic from Deploy through HQ Phase (headless).
*   **M3: Combat & Shield Kernel:** Implement the 3-step damage loop and priority-pass windows.
*   **M4: Basic AI:** Integrate the heuristic-based AI for legal play.
*   **M5: UI Implementation:** Build the React/Web interface over the engine.
*   **M6: Testing & Polish:** Stress test AI vs. AI games to ensure 0% crash rate.
