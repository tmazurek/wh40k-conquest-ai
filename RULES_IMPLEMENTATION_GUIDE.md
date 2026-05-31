# Warhammer 40,000: Conquest — Rules Implementation Guide

**Purpose:** This document describes **game mechanics and rules as implemented** in the TypeScript MVP, so you can rebuild the engine in Python (or any language) and cross-check behavior phase by phase.

## 📋 Project Roadmap & Prioritized TODOs

Here is the prioritized list of engine and rules gaps to implement next:

### 🔴 High Priority
- **Programmatic Keywords**:
  - **`Area Effect (X)`**: ✅ Fully implemented in combat resolution.
  - **`Mobile`**: Allow eligible units to shift adjacent to other planets at the start of the combat phase.
  - **Planet Command Rewards**: ✅ Corrected Tarrus (1, 1 command rewards and Material/Strongpoint symbols) and verified standard starting planet configurations against core-set rules.
- **AI Upgrades**: Teach the Heuristic AI to compute value for Area Effect placement and Mobile maneuvers.

### 🟡 Medium Priority
- **Automated Planet Battle Abilities**: ✅ Fully automated on capture for all standard planets (Elouith, Iridial, Osus IV, Carnath, Tarrus, Barlus, Y'varn).
- **Extended Deck Pools**: Incorporate Astra Militarum, Eldar, Chaos, and Dark Eldar signature squads and cards into custom AI and player decks.

### 🟢 Low Priority
- **Nested Event Stack**: Implement a robust priority-chain interrupt stack to handle intricate nested reaction sequences.
- **Multiplayer Mode**: Set up a local or network lobby for human vs. human matches.


**Companion docs:**

| Document | Use for |
|----------|---------|
| **This file** | *What the rules are* — setup, phases, combat, command, victory |
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | *Where the TypeScript code lives* — files, adding cards |
| [PRD-new.md](./PRD-new.md) | Product goals and future features (not all implemented yet) |

**Convention:** “Implemented” = current engine behavior. “Full Conquest” = tabletop rules; differences are called out in §16.

---

## Table of contents

1. [Game overview](#1-game-overview)
2. [Players, zones, and entities](#2-players-zones-and-entities)
3. [Match configuration](#3-match-configuration)
4. [Setup](#4-setup)
5. [Round and phase order](#5-round-and-phase-order)
6. [Deploy phase](#6-deploy-phase)
7. [Command phase](#7-command-phase)
8. [Combat phase](#8-combat-phase)
9. [Headquarters phase](#9-headquarters-phase)
10. [End of round → next deploy](#10-end-of-round--next-deploy)
11. [Resources and paying costs](#11-resources-and-paying-costs)
12. [Deck structure](#12-deck-structure)
13. [Planets](#13-planets)
14. [Capture and First Planet](#14-capture-and-first-planet)
15. [Victory conditions](#15-victory-conditions)
16. [Keywords and card properties](#16-keywords-and-card-properties)
17. [Card types and when they can be played](#17-card-types-and-when-they-can-be-played)
18. [Damage and shields](#18-damage-and-shields)
19. [Action catalog](#19-action-catalog)
20. [Suggested Python state model](#20-suggested-python-state-model)
21. [Phase flow pseudocode](#21-phase-flow-pseudocode)
22. [Implemented vs not implemented](#22-implemented-vs-not-implemented)

---

## 1. Game overview

- **2 players** (MVP: human vs AI).
- **5 planets** in a row (some may leave the row when captured as First Planet).
- Each player has a **warlord**, **deck**, **hand**, **resource row**, **HQ**, **discard**.
- Units fight on **planets**; warlords commit to planets during **command**.
- Win by **destroying the enemy warlord** or claiming **3 symbols of the same type** (Tech, Material, or Strongpoint).

**Round loop:**

```
Deploy → Command → Combat → Headquarters → (next round) Deploy → …
```

---

## 2. Players, zones, and entities

### 2.1 Player zones

| Zone | Contents | Notes |
|------|----------|--------|
| **Hand** | Card instance IDs (face-down to opponent in UI) | Draw from deck |
| **Deck** | Remaining deck instances (top = end of list) | Shuffled at setup |
| **Discard** | Played/discarded cards | Reshuffled into deck when deck empty (on draw/resource) |
| **Resource row** | “Ready” resources used to pay costs | Count = number of cards in row |
| **HQ** | Supports + army units waiting at base | Warlord is **not** in this list (see below) |

### 2.2 Warlord

- One **warlord instance** per player, stored separately from `hq[]`.
- **Starts in HQ:** `planet_index = None` (not on any planet).
- Acts like a unit for combat/command presence when committed to a planet.
- Has ATK, HP, command icons like a unit card.

### 2.3 In-play instance (unit / warlord / attachment on host)

Each instance tracks:

| Field | Meaning |
|-------|---------|
| `instance_id` | Unique per copy, e.g. `goff-boyz#2` |
| `card_id` | Printed card, e.g. `goff-boyz` |
| `owner` | `player1` or `player2` |
| `wounds` / `damage` | Damage tokens on card (same value; both names supported) |
| `exhausted` | Cannot attack if true; warlord/units can be ready or exhausted |
| `planet_index` | Which planet (if on board); `None` = HQ |
| `attachments[]` | Attached cards hosted on this unit/warlord |

### 2.4 Planet

| Field | Meaning |
|-------|---------|
| `index` | 0..4 in default row |
| `name`, rewards | `materials`, `cards` for command winner |
| `symbols[]` | `Tech`, `Material`, `Strongpoint` (for victory claim) |
| `units[]` | Army units on planet |
| `controller` | Who captured (sole presence at end of combat) |
| `command_winner` | Who won command struggle this round |
| `command_resolved` | Struggle already paid out this round |
| `captured` | First Planet removed from active row |
| `is_first_planet` | Marks starting first planet card (token moves) |

**Presence at planet P:** warlord with `planet_index == P` **OR** any friendly unit in `planets[P].units`.

---

## 3. Match configuration

| Setting | Default | Meaning |
|---------|---------|---------|
| `seed` | 1 | Deterministic shuffle / tie-breaks |
| `player1_deck_id` | `cato-core` | Space Marines starter |
| `player2_deck_id` | `nazdreg-core` | Orks starter |
| `planets_to_win` | 3 | Symbols of **one type** needed to win |
| `opening_hand_size` | 7 | Overridden by warlord card if set |

---

## 4. Setup

**Phase:** `setup` → single action `SETUP_COMPLETE` → `deploy`.

### 4.1 Steps (in order)

1. **Load decks** — expand deck list to instance IDs (`cardId#copyIndex`).
2. **Shuffle** each player’s deck (seeded RNG).
3. **Determine first player** — random 50/50 from seed.
4. **Build planet row** — 5 planets from data (Elouith = First Planet at index 0).
5. **Per player:**
   - Draw **opening hand** (warlord’s `starting_hand_size`, default 7).
   - Take **starting resources** from top of deck (warlord’s `starting_resources`, default 7) into resource row.
   - Remaining cards = deck.
6. **Warlords** — create instances in HQ (`planet_index = None`, `exhausted = false`, `wounds = 0`).
7. **HQ** — empty (no units yet).
8. **Symbol victory track** — `{ Tech: 0, Material: 0, Strongpoint: 0 }` per player.

### 4.2 Starting positions

- Warlords: **HQ only** (not on planets).
- All units: in deck (not deployed until deploy phase).

---

## 5. Round and phase order

```
setup (once)
  └─► deploy
        └─► command
              └─► combat
                    └─► headquarters
                          └─► deploy (round 2, first player alternates)
                                └─► …
```

| Phase | Active player default | End condition |
|-------|----------------------|---------------|
| Deploy | First player | Both players **passed** deploy |
| Command | First player (then simultaneous commit) | Both submitted; struggles resolved; **END_PHASE** |
| Combat | Command winner at active planet | Combat manager `done`; both **passed** combat finish |
| Headquarters | First player | Both **passed** HQ → end round |

**First player token** alternates each round (after HQ).

**First Planet token** moves to next uncaptured planet in row when current First Planet is captured.

---

## 6. Deploy phase

**Goal:** Spend resources to put cards into play before command/combat.

### 6.1 Initiative

- **First player** acts first at start of deploy.
- After most deploy actions, **turn passes to opponent** (unless opponent already passed deploy — see below).

### 6.2 Legal actions (active player)

| Action | Effect |
|--------|--------|
| **Deploy unit** | Pay cost; place unit on chosen planet (not captured); unit enters **ready** (`exhausted = false`); **pass turn** |
| **Play support** | Pay cost; place support in **HQ** (exhausted); **pass turn** |
| **Play event** | Pay cost; resolve effect (MVP: discard only); **does not pass turn** in current code |
| **Play attachment** | Pay cost; attach to eligible host on planet/HQ/warlord; deploy only |
| **Pass (deploy)** | Mark deploy finished for this player; **first player to pass** gains **+1 resource** from deck; pass turn |
| **End phase** | Only when **both** players have passed deploy |

### 6.3 Turn alternation rule

After **deploy unit** or **play support**:

```
if opponent has NOT passed deploy:
    active_player = opponent
else:
    active_player = self   # opponent already passed; keep acting
```

### 6.4 Deploy unit rules

- Must be **active player**.
- Card in hand, type `unit`.
- `cost <= resource count`.
- Target planet not `captured`.
- Unit added to `planet.units[]` with `planet_index` set.

### 6.5 Play support rules

- Phases: **deploy**, **headquarters**.
- Support goes to `player.hq[]`, **exhausted = true**.
- **Does not move** with warlord on command commit (stays in HQ).

### 6.6 No income during deploy

Deploy phase does **not** grant resources by itself. (Promethium Mine triggers at **start of deploy** next round — see §10.)

---

## 7. Command phase

**Goal:** Secretly commit warlord (or stay HQ), reveal, resolve **command struggles** at every planet with forces, award rewards.

### 7.1 Flow

1. **Reset** (start of command): warlords return to HQ in data model for commit (`planet_index` cleared at phase start); planet command flags cleared.
2. **Simultaneous secret commit** (each player once):
   - **Commit warlord** to planet index `P`, OR
   - **Pass** = stay at HQ (`null` commit).
3. When **both** submitted → **reveal** (see 7.2).
4. **Auto-resolve** command struggle at **every planet** where either player has **presence** (units or warlord).
5. **END_PHASE** → combat (after optional manual resolve actions if needed).

### 7.2 Reveal (commit resolution)

For each player who committed to planet `P`:

| What moves | Destination | State |
|------------|-------------|--------|
| **Warlord** | Planet `P` | **Ready** (`exhausted = false`) |
| **Army units in HQ** (`type == unit`) | Planet `P` | **Exhausted** |
| **Supports in HQ** | Stay in HQ | Unchanged |

**Important:** Supports (e.g. Promethium Mine) **never** travel with the warlord.

### 7.3 Command strength at a planet

Sum for that player at planet `P`:

- Warlord’s printed `command` + attachment `command_bonus` (if warlord on `P`)
- Each friendly unit on `P`: printed `command` + attachment bonuses

### 7.4 Command struggle resolution (per planet)

**Eligible planets:** Any planet where **at least one** player has presence (after reveal).

**Winner:**

| Situation | Winner |
|-----------|--------|
| Only player 1 present | Player 1 |
| Only player 2 present | Player 2 |
| Both present, unequal command total | Higher total |
| Both present, tied | **First player** this round |

**Rewards to winner:**

```
materials = planet.materials + sum(unit.command_bonus_resources for winner's units on planet)
cards     = planet.cards     + sum(unit.command_bonus_cards for winner's units on planet)
```

- Each **material** → take 1 card from deck into **resource row**.
- Each **card** reward → draw 1 from deck to **hand**.
- Deck empty → reshuffle discard (seeded).

**Examples (neutral units):**

- **Rogue Trader** at planet: `command_bonus_resources = 1`
- **Void Pirate** at planet: `command_bonus_cards = 1`

Record `command_winner` and `command_resolved = true` on planet.

### 7.5 Command struggle does NOT require warlord

Planets with **only** deployed units (no warlord) still resolve command if any unit is present.

Example from a typical round:

- Elouith: Nazdreg committed → struggle uses warlord + units.
- Iridial: only Player 1’s deployed units → Player 1 wins (sole presence or strength).
- All planets with units get a struggle.

---

## 8. Combat phase

**Goal:** Fight at **First Planet** and any planet with a **warlord**; ranged then melee; retreat; capture.

### 8.1 Which planets battle?

Build `planet_order` starting from `first_planet_index`, wrapping:

Include planet `i` if:

- `(i is First Planet OR any warlord on i)` **AND**
- `any presence on i` **AND**
- `not captured`

**Not included:** Planet with only units, no warlord, and not First Planet (no battle that round).

### 8.2 Combat at each planet (sequential)

Process planets in `planet_order` one at a time.

**Initiative for attacks:** `command_winner` at that planet, else **first player**.

### 8.3 Steps per planet per “combat round”

```
┌─────────────┐
│   RANGED    │  Only Ranged keyword may attack
└──────┬──────┘
       │  both pass (2 consecutive) OR no contested fight
       ▼
┌─────────────┐
│    MELEE    │  All units/warlords may attack
└──────┬──────┘
       │  both pass
       ▼
┌─────────────┐
│   RETREAT   │  First player chooses stay/retreat, then opponent
└──────┬──────┘
       │
       ├─ still contested → combat_round += 1, back to RANGED (units ready)
       └─ one side gone → next planet in order
```

**Pass window:** In ranged/melee, **2 consecutive passes** close the step (active player alternates each pass).

### 8.4 Attack rules

Attacker must:

- Be on **active combat planet**
- Be **active player**
- Not **exhausted**
- **ATK > 0** after modifiers
- **Ranged step:** have `Ranged` keyword (card or attachment)
- Defender: enemy unit or warlord on **same planet**

**Attack power:**

```
ATK = printed_attack + attachment_attack_bonuses + brutal_bonus

brutal_bonus = wounds if attacker has Brutal now else 0

Brutal now =
  printed/attachment Brutal keyword
  OR Nazdreg on same planet (grants Brutal to other friendly units there)
```

**On attack:**

1. Attacker becomes **exhausted** immediately.
2. Damage = attack power (assigned to pending damage).
3. **Shield window** opens (defender active).

### 8.5 Shield window

While `pending_damage` is set:

- **Defender** is active player.
- May **use shield**: discard 1 hand card with `shields > 0` → reduce pending damage by 1.
- May **resolve damage**: apply remaining damage to defender; close window; **attacker’s opponent** becomes active (normal combat turn).

If defender has **no** shield cards in hand → damage **auto-applies** (no window).

### 8.6 Applying damage

- Add damage to defender’s wounds.
- If `wounds >= max_hp` → unit **destroyed** (removed from planet); warlord at 0 HP = defeated (game over check).

**Max HP** = printed HP + attachment HP bonuses.

### 8.7 Retreat step

At the end of a combat round (when all units at the planet are exhausted):

1. **Simultaneous Readying**: All units at the active planet ready simultaneously.
2. **Sequential Retreat Windows**: Starting with the initiative player, each player gets exactly one retreat opportunity:
   - Move **any number of your units** (including Warlord) from the planet to your **HQ**.
   - Units arriving at HQ are **exhausted**.
3. **Contested Check**: After both players resolve their retreat windows, if the planet is still contested (both players have at least one unit present), a new combat round begins (starting with Melee or Ranged).

Additionally, **Warlord Retreat** is permitted during a player's combat turn in Melee or Ranged steps:
- A Warlord may **exhaust** to retreat to HQ as their combat action instead of making an attack.
- The Warlord moves to HQ exhausted, and this immediately **consumes the player's combat turn**, passing action to the opponent.
- Regular units cannot retreat during active combat turns.

### 8.8 Battle Resolution & Planet Abilities

Combat occurs at the **First Planet**, and at any other planet where at least one **Warlord** is present at the start of the Combat Phase. 

Whenever a battle at a planet ends (when one side is wiped out or mutual destruction occurs):
1. **Declare Winner**: The player with remaining units/warlords present at the sector wins the battle.
2. **Trigger Planet Battle Ability**: The winner triggers the planet's **Battle** ability:
   - For the human player, the UI prompts a manual choice (`Yes` to trigger, `No` to skip).
   - For the AI, the Battle ability triggers automatically.
3. **Capture and Relocation (First Planet Only)**:
   - If the battle occurred at the First Planet, it is marked as captured (`capturedBy`) by the winner.
   - The winner's units at that planet relocate to HQ ready, and remaining opposing units are discarded.
   - The captured planet remains in the active sectors row visually until the Headquarters Phase (§9).
4. **Transition (Non-First Planets)**:
   - If the battle occurred at another planet where Warlords were present, the planet is **not** captured.
   - All surviving units remain at that planet, and combat transitions to the next eligible planet.

---

## 9. Headquarters phase

**Runs automatically** when entering HQ (before upkeep and upkeep actions):

1. **Captured Planet Removal & Replacement**: Any planets captured during combat are removed (spliced out) from the active sectors row. If there are planets in the planet deck, a new planet is drawn and appended to the end of the planets row. All remaining active planets are re-indexed, and index 0 is set as the new First Planet.
2. **Ready** all exhausted cards (units, warlords, supports in HQ).
3. Each player **draws 2** cards.
4. Each player **gains 4 resources** (standard tabletop maintenance upkeep).

Then players alternate **pass** until both passed → **END_PHASE** → end round (§10).

**Play support** allowed during HQ (same as deploy).

---

## 10. End of round → next deploy

When HQ ends:

1. `round += 1`
2. **First player** ↔ other player
3. **First Planet index** → next uncaptured planet in row
4. Phase = **deploy**
5. Reset deploy pass flags
6. **Start-of-deploy triggers** (e.g. Promethium Mine)

### Promethium Mine (implemented)

- Support in HQ with `start_of_deploy_gain_resources = 1`, `start_of_deploy_limit = 4`.
- At **start of deploy** (each round after round 1 HQ): if triggers left, gain 1 resource from deck.
- Per-instance counter; max 4 times per game.

---

## 11. Resources and paying costs

- **Resource** = card taken from **bottom of deck** into resource row (face-up pool).
- **Pay cost N:** remove N cards from resource row; those instance IDs return to **bottom of deck** (order preserved in implementation).
- **Cannot pay** if `resources < cost`.

**Gain resource:** pop deck → resource row (reshuffle discard if deck empty).

**No exhaust/spend distinction** on resources in MVP — only count matters.

---

## 12. Deck structure

### 12.1 Deck definition

```yaml
id: nazdreg-core
faction: orks
warlord_id: nazdreg
entries:
  - card_id: goff-boyz
    copies: 3
  - card_id: neutral-mine
    copies: 1
```

### 12.2 Instance IDs

Expanding `copies: 3` for `goff-boyz` → `goff-boyz#0`, `goff-boyz#1`, `goff-boyz#2`.

### 12.3 Card definition (printed)

Key fields for rules:

| Field | Used for |
|-------|----------|
| `type` | warlord / unit / attachment / event / support |
| `cost` | Deploy / play from hand |
| `attack`, `hit_points` | Combat |
| `command` | Command struggle |
| `shields` | Shield window |
| `keywords` | Ranged, Brutal, … |
| `command_bonus_resources`, `command_bonus_cards` | Command rewards |
| `start_of_deploy_gain_resources`, `start_of_deploy_limit` | Promethium Mine |
| `attack_bonus`, `hit_points_bonus`, `command_bonus` | Attachments |
| `text` | UI only (except Nazdreg Brutal grant parsed from text) |

---

## 13. Planets

Default row (index → name):

| Index | Name | Materials | Cards | Symbols |
|-------|------|-----------|-------|---------|
| 0 | Elouith | 0 | 2 | Tech (First Planet) |
| 1 | Iridial | 1 | 0 | Strongpoint, Tech, Material |
| 2 | Osus IV | 1 | 1 | Material |
| 3 | Carnath | 1 | 1 | Tech, Strongpoint |
| 4 | Tarrus | 1 | 1 | Material, Strongpoint |

Planet **battle abilities** are triggered immediately upon combat resolution at **any** active planet (supporting Elouith, Iridial, Osus IV, Carnath, Tarrus, Barlus, and Y'varn), with optional activation prompts for the human player and automated execution for the AI.

---

## 14. Capture and First Planet

### 14.1 End of Combat Capture

When a player wins a battle at the first planet:
- The planet is marked as captured by the winner (`capturedBy`).
- The player's victory display claims the planet (adding its symbols toward their victory condition).
- The winner's units at the captured planet are returned to HQ, and the opponent's remaining units at that planet are discarded.
- The planet remains in the active sectors row visually. It is **not** immediately removed, replaced, or re-indexed.

### 14.2 Optional Battle Abilities Prompt

Immediately upon winning combat at any planet (the First Planet or planets with Warlords):
- If the victor is the human player, they are prompted via the UI to choose whether to trigger the planet's **Battle** ability (Yes/No).
- If the victor is the AI, the Battle ability triggers automatically.
- For non-First planets, triggering the Battle ability does not capture the planet; surviving forces remain at the planet, and combat transitions to the next eligible planet.

### 14.3 Headquarters Phase Removal & Replenishment

At the start of the next Headquarters Phase:
- All captured planets are spliced out from the active sectors row.
- If there are face-down planets remaining in the planet deck, a new planet is drawn and pushed onto the end of the row.
- The first planet index 0 is re-assigned as `isFirstPlanet`.

---

## 15. Victory conditions

Checked after every action:

| Condition | Result |
|-----------|--------|
| Warlord defeated while already bloodied | That player **loses**; opponent wins |
| `symbol_victories[Tech] >= 3` OR Material OR Strongpoint | That player **wins** (planet victory) |
| Concede | Opponent wins |

Default threshold = **3** (config `planets_to_win`).

---

## 16. Keywords and card properties

| Keyword / property | Behavior |
|--------------------|----------|
| **Ranged** | May attack during **ranged** combat step only |
| **Brutal** | `ATK += current_wounds` when attacking |
| **Nazdreg aura** | Other friendly units at his planet gain Brutal (not Nazdreg himself from aura) |
| **Area Effect (X)** | When a unit with Area Effect (X) attacks, the main defender may shield normally. All other opposing units at the planet immediately take X splash damage. |
| **command_bonus_resources** | +N resources when winning command at planet |
| **command_bonus_cards** | +N card draws when winning command at planet |
| **shields** (numeric on card) | Card can be discarded in shield window to absorb 1 damage |

**Not implemented in MVP:** Area Effect, Mobile, Armorbane, Ambush, most reaction/interrupt text.

---

## 17. Card types and when they can be played

| Type | Deploy | Command | Combat | HQ |
|------|--------|---------|--------|-----|
| Unit | Deploy to planet | — | Attack if on planet | — |
| Support | Play to HQ | — | — | Play to HQ |
| Event | Play (discard) | Play (discard) | Play (discard) | — |
| Attachment | Attach to host | — | — | — |
| Warlord | (in play at setup) | Commit to planet | Attack if on planet | — |

---

## 18. Damage and shields

### 18.1 Pipeline (implemented)

```
1. ASSIGN   attack_power → pending_damage.amount
2. SHIELD   defender may discard shield cards (-1 per card) OR resolve
3. APPLY    wounds += amount;
            - Standard units: destroy if wounds >= HP.
            - Warlords:
              - If healthy: transition to bloodied, discard excess damage, reset current damage to 0, blank card text (abilities lost), and reduce stats (Cato becomes ATK 1/HP 6, Nazdreg becomes ATK 2/HP 6).
              - If already bloodied: destroy (triggers Game Over).
```

### 18.2 Shield rules

- One shield card per `USE_SHIELD` action.
- Must be in defender’s hand, `shields > 0`.
- Can repeat while damage > 0 and shields remain.
- Defender must actively **RESOLVE_DAMAGE** to finish (unless no shields in hand → auto).

---

## 19. Action catalog

| Action | Phase(s) | Who |
|--------|----------|-----|
| `SETUP_COMPLETE` | setup | Either |
| `DEPLOY_UNIT` | deploy | Active |
| `PLAY_SUPPORT` | deploy, HQ | Active |
| `PLAY_EVENT` | deploy, command, combat, HQ | Active |
| `PLAY_ATTACHMENT` | deploy | Active |
| `PASS` | deploy, command, combat, HQ | Context-dependent |
| `COMMIT_WARLORD` | command | Each player once (secret) |
| `RESOLVE_COMMAND` | command | Either (if struggles not auto’d) |
| `ATTACK` | combat | Active |
| `USE_SHIELD` | combat (window) | Defender |
| `RESOLVE_DAMAGE` | combat (window) | Defender |
| `RETREAT` | combat (retreat step) | Active |
| `CLAIM_FIRST_PLANET_SYMBOL` | any (when pending) | Claiming player |
| `END_PHASE` | deploy, command, combat, HQ | When phase complete |
| `CONCEDE` | any | Either |

---

## 20. Suggested Python state model

```python
@dataclass
class CardInstance:
    instance_id: str
    card_id: str
    owner: str  # "player1" | "player2"
    wounds: int = 0
    exhausted: bool = False
    planet_index: int | None = None
    attachments: list["CardInstance"] = field(default_factory=list)

@dataclass
class PlanetState:
    index: int
    name: str
    materials: int
    cards: int
    symbols: list[str]  # "Tech" | "Material" | "Strongpoint"
    units: list[CardInstance]
    controller: str | None = None
    command_winner: str | None = None
    command_resolved: bool = False
    captured: bool = False

@dataclass
class PlayerState:
  id: str
  hand: list[str]
  deck: list[str]
  discard: list[str]
  resources: list[CardInstance]
  hq: list[CardInstance]
  symbol_victories: dict[str, int]  # Tech, Material, Strongpoint
  deploy_phase_done: bool = False
  # ...

@dataclass
class GameState:
  phase: str
  round: int
  active_player: str
  first_player: str
  first_planet_index: int
  planets: list[PlanetState]
  players: dict[str, PlayerState]
  warlords: dict[str, CardInstance]
  combat: CombatState | None = None
  pending_damage: PendingDamage | None = None
  pending_first_planet_claim: PendingFirstPlanetClaim | None = None
  command_commit_choice: dict[str, int | None] | None = None
```

Keep **card definitions** in a separate immutable registry keyed by `card_id`.

---

## 21. Phase flow pseudocode

### 21.1 Full round

```python
def run_round(state):
    state = deploy_phase(state)
    state = command_phase(state)
    state = combat_phase(state)
    state = headquarters_phase(state)
    state = end_round(state)  # → deploy phase round+1
    return state
```

### 21.2 Deploy phase

```python
def deploy_phase(state):
    reset_deploy_flags(state)
    state.active_player = state.first_player
    while not both_passed_deploy(state):
        actions = legal_deploy_actions(state)
        action = choose(actions)  # human or AI
        state = apply(action, state)
        if action.type == "PASS":
            mark_deploy_done(state, action.player)
    return advance_phase(state, "command")
```

### 21.3 Command phase

```python
def command_phase(state):
    reset_command(state)  # warlords to HQ, clear planet command flags
    while not both_committed(state):
        # simultaneous: each picks COMMIT_WARLORD or PASS (stay HQ)
        record_commit(state, player, planet_or_none)
    state = reveal_commits(state)
    for planet in planets_needing_command(state):
        state = resolve_command_struggle(state, planet.index)
    return advance_phase(state, "combat")
```

### 21.4 Combat phase

```python
def combat_phase(state):
    order = build_planet_order(state)
    state.combat = init_combat(state, order)
    while state.combat.step != "done":
        if state.combat.step in ("ranged", "melee"):
            while not window_closed(state):
                apply_attack_or_pass(state)
                if pending_damage(state):
                    run_shield_window(state)
        elif state.combat.step == "retreat":
            run_retreat_choices(state)
    wait_both_combat_finish_pass(state)
    state = apply_planet_captures(state)
    state = check_victory(state)
    return advance_phase(state, "headquarters")
```

---

## 22. Implemented vs not implemented

| Feature | Status |
|---------|--------|
| 4 phases + setup | ✅ |
| Warlord in HQ at start | ✅ |
| Deploy units / supports | ✅ |
| Turn pass on deploy unit/support | ✅ |
| First passer +1 resource (deploy) | ✅ |
| Secret warlord commit | ✅ |
| Command at all planets with units | ✅ |
| Rogue Trader / Void Pirate bonuses | ✅ |
| Warlord ready on commit; HQ units exhausted | ✅ |
| Supports stay in HQ on commit | ✅ |
| Combat: First Planet + warlord planets | ✅ |
| Ranged / melee / retreat steps | ✅ (simplified pass windows) |
| Brutal + Nazdreg aura | ✅ |
| Shield window | ✅ |
| First Planet capture + symbol choice | ✅ |
| Symbol victory (3 of one type) | ✅ |
| Warlord defeat victory | ✅ |
| Promethium Mine (start of deploy) | ✅ |
| HQ draw 2 + 1 resource | ✅ (simplified vs full rules) |
| Planet battle abilities | ✅ fully automated on capture |
| Full interrupt/reaction priority system | ❌ simplified triggers |
| Events with real effects | ✅ (Major SM/Ork/Astra events active) |
| Area Effect, Mobile, Armorbane | ⚠️ (Area Effect and Armorbane active; Mobile text only) |
| Card Database & Factions | ✅ (1,100+ cards accurate to CSV across 10 factions) |
| Full Conquest resource ready/exhaust | ❌ count-based only |
| Multiplayer | ❌ |

---

## Cross-reference index (quick lookup)

| Topic | Section |
|-------|---------|
| Setup / opening hands | §4 |
| Deploy turn order | §6 |
| Warlord commit + HQ army | §7.2 |
| Command struggles (all planets) | §7.4 |
| Which planets fight | §8.1 |
| Attack / Brutal / Ranged | §8.4, §16 |
| Shields | §18 |
| First Planet removal | §14.2 |
| Win conditions | §15 |
| Deck / card data | §12 |
| Python structs | §20 |

---

*This guide reflects the TypeScript MVP as of the current repository. When in doubt, `tests/` are the executable specification.*
