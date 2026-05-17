# Development Plan: Player Combat Turn Assistant

## Implementation Status: Phases 1-2 Foundation

The initial "what would my character do?" foundation now lives at `index.html`.

Current architecture:

- `js/player-combat/data/referenceDataLoader.js` loads player app reference JSON directly.
- `js/player-combat/data/referenceDataService.js` wraps the player reference loader and exposes player-facing indexes.
- `js/player-combat/importers/ddbJsonImporter.js` handles JSON file/text parsing only.
- `js/player-combat/normalizers/characterNormalizer.js` converts raw D&D Beyond-style JSON into the player combat model.
- `js/player-combat/core/storage.js` owns all `localStorage` access.
- `js/player-combat/core/stateManager.js` coordinates active character state, separate combat state, persistence, and UI refresh events.
- `js/player-combat/models/combatStateModel.js` creates/reset combat state without mutating the imported character.
- `js/player-combat/ui/*` renders focused panels for import, summaries, turn economy, combat controls, modal, toast, and placeholder tabs.

Data loading approach:

- The app loads reference data through its own player-combat data loader.
- The player wrapper loads all required data files and builds name indexes for spells, classes, races, conditions, equipment, feats, items, and magic items.
- The DM IndexedDB SRD repository was not directly reused because it depends on DM database stores; a small browser adapter provides lookup methods over the player indexes.

Current model boundary:

- Imported character data is normalized once into a base character model.
- Current HP, temp HP, AC overrides, conditions, concentration, turn usage, movement, resources used, and log entries live in the separate combat state model.
- Resetting combat state does not delete or mutate the imported character.

Remaining phases:

- Dice roller.
- Basic action cards.
- Weapon attack cards.
- Simple spell action cards.
- Resource spending controls.
- Rules pipeline for action economy, conditions, concentration, equipment, class features, and race features.
- Optional PDF import adapter integration after JSON import is stable.

## 1. Project Goal

Build a mobile-friendly browser app that helps a D&D 5e player answer one practical question during combat:

> “What can I do on my turn right now?”

The app should load a player character, understand the character’s combat-relevant options, track current combat state, and present clear, usable action choices grouped by turn economy:

* Movement
* Action
* Bonus Action
* Reaction
* Free/object interactions
* Class/race/item/spell-specific options
* Conditional options
* Dice rolls and resource spending

This should extend the existing DM-centric party sheet/project rather than replace it. The player-facing app can share the same data loaders, SRD JSON files, parser utilities, and local storage patterns, but should have its own focused mobile UI.

---

# 2. Core Design Philosophy

The app should not try to be a full VTT.

It should be a  **combat decision assistant** .

The main screen should help the player quickly understand:

1. Current HP, AC, conditions, spell slots, and resources.
2. What actions are available this turn.
3. What requires an action, bonus action, reaction, or resource.
4. What rolls are needed.
5. What options are currently unavailable and why.
6. What the character may want to remember, such as concentration, rage, wild shape, sneak attack, ki, superiority dice, channel divinity, and similar features.

The UI should be optimized for phone use at the table.

---

# 3. Recommended App Structure

```txt
/player-combat-assistant
  index.html
  /css
    variables.css
    layout.css
    combat.css
    mobile.css
  /js
    app.js
    router.js

    /core
      storage.js
      eventBus.js
      stateManager.js
      rulesEngine.js
      turnEngine.js
      diceRoller.js

    /loaders
      dndBeyondLoader.js
      characterNormalizer.js
      srdDataLoader.js
      combatDataTransformer.js

    /models
      characterModel.js
      combatStateModel.js
      actionModel.js
      resourceModel.js

    /rules
      actionEconomyRules.js
      movementRules.js
      spellcastingRules.js
      conditionRules.js
      concentrationRules.js
      equipmentRules.js
      classFeatureRules.js
      raceFeatureRules.js

    /features
      actionPanel.js
      bonusActionPanel.js
      reactionPanel.js
      movementPanel.js
      spellPanel.js
      equipmentPanel.js
      wildShapePanel.js
      resourceTracker.js
      dicePanel.js
      conditionManager.js

    /ui
      modal.js
      toast.js
      tabs.js
      drawer.js
      cards.js
      confirmDialog.js

  /data
    classes.json
    races.json
    spells.json
    equipment.json
    conditions.json
    actions.json
    rules.json

  /docs
    development-plan.md
    data-normalization.md
    rules-engine.md
```

Keep modules short and single-purpose. The existing DM app can remain the source for party loading and character display, while this app adds a player-facing combat layer.

---

# 4. Data Sources

## 4.1 D&D Beyond Character Sheet

The app should support importing a character from D&D Beyond using one or more of these methods:

### Phase 1

Manual JSON upload or paste.

```txt
Player exports/saves character JSON.
Player uploads or pastes it into the app.
App normalizes the character into internal format.
```

### Phase 2

Support D&D Beyond public character URL import if technically available in the current project.

```txt
Player pastes D&D Beyond character URL.
App attempts to retrieve or parse the character data.
Fallback to JSON upload if direct loading is not available.
```

### Phase 3

Support PDF import only if needed.

PDF parsing should be treated as lower priority because it is less reliable for structured combat options.

---

## 4.2 Existing JSON Rules Data

The existing project already has JSON files for things like:

```txt
classes.json
conditions.json
equipment.json
races.json
spells.json
```

These should be transformed into combat-friendly indexes.

For example:

```js
spellIndex = {
  "misty step": {
    name: "Misty Step",
    castingTime: "1 bonus action",
    actionType: "bonusAction",
    range: "Self",
    requiresConcentration: false,
    attackRoll: false,
    savingThrow: null,
    damage: null,
    movementEffect: "teleport",
    resourceCost: {
      type: "spellSlot",
      minimumLevel: 2
    }
  }
}
```

The app should not repeatedly parse raw SRD text during combat. Instead, it should pre-process rules data into fast lookup tables.

---

# 5. Internal Character Model

Normalize all imported characters into one internal model.

```js
const character = {
  id: "char_001",
  name: "Thalia",
  level: 5,

  race: {
    name: "Wood Elf",
    features: []
  },

  classes: [
    {
      name: "Druid",
      subclass: "Circle of the Moon",
      level: 5,
      features: []
    }
  ],

  stats: {
    str: 10,
    dex: 14,
    con: 14,
    int: 12,
    wis: 18,
    cha: 11
  },

  combat: {
    maxHp: 38,
    currentHp: 38,
    tempHp: 0,
    ac: 16,
    initiativeBonus: 2,
    speed: {
      walk: 35,
      swim: 0,
      fly: 0,
      climb: 0
    },
    conditions: [],
    concentration: null
  },

  resources: {
    spellSlots: {
      1: { max: 4, used: 0 },
      2: { max: 3, used: 0 },
      3: { max: 2, used: 0 }
    },
    classResources: [],
    limitedUses: []
  },

  inventory: {
    weapons: [],
    armor: [],
    consumables: [],
    magicItems: []
  },

  spells: {
    known: [],
    prepared: [],
    cantrips: []
  },

  actions: []
};
```

The key is that imported data should not be used directly by the UI. Always normalize first.

---

# 6. Combat State Model

The character model describes the character. The combat state describes the current moment.

```js
const combatState = {
  round: 1,
  turnActive: false,

  turn: {
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    movementUsed: 0,
    objectInteractionUsed: false
  },

  characterState: {
    currentHp: 38,
    tempHp: 0,
    ac: 16,
    activeConditions: [],
    concentration: null,
    activeEffects: [],
    currentForm: null
  },

  resourcesUsed: {
    spellSlots: {},
    classResources: {},
    itemCharges: {}
  },

  log: []
};
```

This should live separately from the character’s base sheet so the player can reset combat without re-importing the character.

---

# 7. Action Economy Engine

Create a central `turnEngine.js` that answers:

```js
getAvailableOptions(character, combatState)
```

It should return grouped options:

```js
{
  movement: [],
  actions: [],
  bonusActions: [],
  reactions: [],
  freeActions: [],
  unavailable: []
}
```

Each option should have a consistent structure:

```js
const actionOption = {
  id: "attack_longsword",
  name: "Attack with Longsword",
  source: "equipment",
  type: "action",
  tags: ["attack", "weapon", "melee"],

  cost: {
    action: true,
    bonusAction: false,
    reaction: false,
    movement: 0,
    resource: null
  },

  roll: {
    type: "attack",
    attackBonus: 6,
    damage: "1d8+4",
    damageType: "slashing"
  },

  requirements: [],
  effects: [],

  available: true,
  unavailableReason: null
};
```

The UI should never independently decide whether an option is available. The rules engine decides. The UI renders.

---

# 8. Rule Categories

## 8.1 Basic Combat Actions

Create a base combat action file:

```js
const basicActions = [
  "Attack",
  "Cast a Spell",
  "Dash",
  "Disengage",
  "Dodge",
  "Help",
  "Hide",
  "Ready",
  "Search",
  "Use an Object"
];
```

Each should be represented structurally.

Example:

```js
{
  id: "basic_dash",
  name: "Dash",
  type: "action",
  source: "basicRules",
  effect: {
    movementBonus: "speed"
  }
}
```

## 8.2 Movement

Movement should track:

* Walk speed
* Climb speed
* Swim speed
* Fly speed
* Difficult terrain
* Dash
* Prone movement cost
* Standing from prone
* Grappled speed reduction
* Restrained condition
* Wild shape movement changes
* Spell effects such as Longstrider, Fly, Haste

Start simple:

```js
movementAvailable = speed - movementUsed;
```

Then layer conditions and effects.

## 8.3 Actions

Actions come from:

* Basic combat rules
* Weapons
* Cantrips
* Spells with casting time of 1 action
* Class features
* Race features
* Item activations
* Current form features, such as wild shape

## 8.4 Bonus Actions

Bonus actions come from:

* Spells with casting time of 1 bonus action
* Two-weapon fighting
* Cunning Action
* Rage
* Bardic Inspiration
* Monk Martial Arts
* Ki options
* Wild Shape for Circle of the Moon
* Healing Word
* Misty Step
* Class/subclass features
* Magic items

The app should avoid showing a generic “bonus action” unless the character actually has a bonus action option.

## 8.5 Reactions

Reactions should include:

* Opportunity attack
* Shield
* Absorb Elements
* Counterspell
* Hellish Rebuke
* Protection fighting style
* Sentinel
* Class or race reactions

The app should distinguish between:

```txt
Available on your turn
Available outside your turn
Already used this round
```

## 8.6 Concentration

The app should track:

* Current concentration spell
* Whether a new spell would break concentration
* Reminders after damage
* Constitution saving throw DC

Example warning:

```txt
Casting Faerie Fire will end concentration on Entangle.
```

## 8.7 Conditions

Conditions should affect available options.

Examples:

```txt
Paralyzed: cannot move or take actions.
Stunned: cannot move, cannot take actions, can speak only falteringly.
Grappled: speed becomes 0.
Prone: standing costs half movement.
Invisible: affects attack advantage logic.
Restrained: speed 0, attacks affected.
```

The app does not need to fully adjudicate every combat modifier at first, but it should at least show condition warnings.

---

# 9. Spell Parsing and Transformation

Spells need to be transformed into combat option metadata.

Raw spell text is not enough. Create a transformation process that derives:

```js
{
  actionType: "action" | "bonusAction" | "reaction" | "minute" | "ritual",
  isAttack: true,
  attackType: "meleeSpell" | "rangedSpell" | null,
  savingThrow: "dex" | "wis" | "con" | null,
  damageFormula: "3d6",
  damageType: "fire",
  healingFormula: null,
  requiresConcentration: true,
  duration: "1 minute",
  range: "60 feet",
  aoe: {
    type: "sphere",
    size: 20
  },
  consumesSpellSlot: true,
  minimumSlotLevel: 1,
  upcast: true
}
```

### Parsing priority

Do not try to perfectly parse all rules text in the first pass.

Use layered parsing:

1. Explicit fields from JSON if available.
2. Known spell metadata.
3. Keyword parsing.
4. Manual override file.

Add:

```txt
/data/overrides/spellOverrides.json
```

Example:

```json
{
  "shield": {
    "actionType": "reaction",
    "trigger": "when you are hit by an attack or targeted by magic missile",
    "acBonus": 5,
    "duration": "until start of your next turn"
  },
  "misty step": {
    "actionType": "bonusAction",
    "movementEffect": "teleport",
    "range": "self",
    "distance": 30
  }
}
```

This avoids spending too much effort on brittle natural-language parsing.

---

# 10. Class Feature Handling

Class features should be normalized into combat options and resources.

Examples:

## Fighter

```txt
Second Wind
Action Surge
Extra Attack
Fighting Style
```

## Rogue

```txt
Sneak Attack
Cunning Action
Uncanny Dodge
Evasion
```

## Barbarian

```txt
Rage
Reckless Attack
Danger Sense
```

## Druid

```txt
Wild Shape
Combat Wild Shape
Circle forms
Spellcasting
```

## Monk

```txt
Martial Arts
Flurry of Blows
Patient Defense
Step of the Wind
Ki points
```

## Cleric / Paladin

```txt
Channel Divinity
Divine Smite
Lay on Hands
Turn Undead
```

Use a rules adapter pattern:

```js
classFeatureRules = {
  "wild shape": applyWildShapeRules,
  "cunning action": applyCunningActionRules,
  "rage": applyRageRules,
  "action surge": applyActionSurgeRules
};
```

Each rule adds options or modifies state.

---

# 11. Wild Shape Support

Wild shape is complex enough to deserve its own module.

```txt
/js/features/wildShapePanel.js
/js/rules/wildShapeRules.js
/data/beasts.json
```

Wild shape should support:

* Selecting a beast form
* Replacing HP with beast HP
* Replacing AC if applicable
* Replacing speed
* Replacing attacks
* Preserving mental ability scores
* Tracking form HP
* Reverting when form HP reaches 0
* Circle of the Moon bonus action Wild Shape
* Combat Wild Shape healing by spending spell slots

Internal state:

```js
currentForm: {
  type: "wildShape",
  name: "Brown Bear",
  hp: 34,
  maxHp: 34,
  ac: 11,
  speed: {
    walk: 40,
    climb: 30
  },
  attacks: []
}
```

The app should clearly show:

```txt
You are currently in Brown Bear form.
Available attacks are Bite and Claws.
Your normal spellcasting options are hidden unless a feature allows them.
```

---

# 12. Dice Roller

The dice roller should support:

* Basic rolls: `d20`, `1d8+3`
* Attack rolls
* Damage rolls
* Healing rolls
* Saving throws
* Ability checks
* Advantage
* Disadvantage
* Critical hit damage
* Resource-linked rolls

Example API:

```js
rollDice("1d20+6");
rollAttack({ bonus: 6, advantage: true });
rollDamage({ formula: "1d8+4", critical: false });
```

Result object:

```js
{
  formula: "1d20+6",
  rolls: [14],
  modifier: 6,
  total: 20,
  type: "attack",
  label: "Longsword Attack"
}
```

For mobile, every roll result should be large, readable, and saved to a small combat log.

---

# 13. UI Plan

## 13.1 Mobile Layout

The app should use a single-column mobile layout by default.

```txt
[Character Summary Header]
HP | AC | Speed | Conditions

[Turn Status Bar]
Movement: 20/30
Action: Available
Bonus Action: Used
Reaction: Available

[Primary Tabs]
Recommended
Actions
Bonus
Movement
Spells
Resources
Log
```

Desktop can use a wider layout:

```txt
Left rail: Character state
Center: Available options
Right rail: Dice/log/resources
```

## 13.2 Recommended Tab

This is the most important screen.

Group options by practical use:

```txt
Attack
Cast a useful spell
Move
Defend
Help an ally
Use class feature
Use item
```

Each card should show:

```txt
Longsword
Action
Attack: +6 to hit
Damage: 1d8+4 slashing
[Roll Attack] [Roll Damage] [Use Action]
```

Spell example:

```txt
Misty Step
Bonus Action
Teleport up to 30 feet
Consumes 2nd-level spell slot
[Cast] [View Spell]
```

Unavailable example:

```txt
Healing Word
Unavailable
Reason: Bonus action already used.
```

## 13.3 Turn Controls

Add clear turn controls:

```txt
Start Turn
End Turn
Reset Action
Reset Bonus Action
Reset Reaction
Short Rest
Long Rest
```

End Turn should:

* Clear action usage
* Clear bonus action usage
* Preserve reaction status until the start of next turn if needed
* Log active concentration/status reminders

---

# 14. Local Storage

Use local storage first.

```js
localStorage keys:
  pca.characters
  pca.activeCharacterId
  pca.combatState
  pca.settings
  pca.importHistory
```

Later, the existing DM app could sync combat state across devices, but that should not be required for the first version.

---

# 15. Rules Engine Design

Use a pipeline.

```js
function getAvailableOptions(character, combatState) {
  let options = [];

  options.push(...getBasicActions(character, combatState));
  options.push(...getWeaponActions(character, combatState));
  options.push(...getSpellActions(character, combatState));
  options.push(...getClassFeatureActions(character, combatState));
  options.push(...getRaceFeatureActions(character, combatState));
  options.push(...getEquipmentActions(character, combatState));
  options.push(...getCurrentFormActions(character, combatState));

  options = applyActionEconomyRules(options, combatState);
  options = applyConditionRules(options, character, combatState);
  options = applyResourceRules(options, character, combatState);
  options = applyConcentrationRules(options, character, combatState);

  return groupOptionsByTurnCost(options);
}
```

This makes it easier to add features without rewriting the whole rules engine.

---

# 16. Data Transformation Plan

Create a build-time or app-start transformation step.

```js
transformCombatData({
  classes,
  races,
  spells,
  equipment,
  conditions,
  rules
});
```

Output:

```js
{
  spellIndex,
  classFeatureIndex,
  raceFeatureIndex,
  equipmentIndex,
  conditionIndex,
  actionIndex
}
```

Add a diagnostic screen for developers:

```txt
Loaded 319 spells
Parsed 286 spell action types
33 spells need manual override
Loaded 12 classes
Loaded 44 class combat features
Loaded 82 weapons/items
```

This will make the parser problems visible instead of hidden.

---

# 17. Phased Implementation Plan

## Phase 1: App Shell and Character Import

### Goals

* Create the player combat assistant shell.
* Import a D&D Beyond character JSON file.
* Normalize basic character data.
* Show a mobile-friendly character summary.

### Deliverables

```txt
index.html
css/variables.css
css/combat.css
js/app.js
js/loaders/dndBeyondLoader.js
js/loaders/characterNormalizer.js
js/core/storage.js
js/models/characterModel.js
```

### Features

* Upload/paste character JSON.
* Extract name, level, race, class, ability scores, HP, AC, speed.
* Save character locally.
* Select active character.
* Render basic character dashboard.

### Acceptance Criteria

* A player can load a character.
* The app displays HP, AC, speed, class, race, and level.
* The character persists after refresh.
* The UI works on phone width.

---

## Phase 2: Combat State Tracking

### Goals

Track the character’s current combat state separately from the imported sheet.

### Deliverables

```txt
js/models/combatStateModel.js
js/core/stateManager.js
js/features/resourceTracker.js
js/features/conditionManager.js
```

### Features

* Current HP
* Temp HP
* AC override
* Conditions
* Concentration
* Spell slots
* Action used
* Bonus action used
* Reaction used
* Movement used
* Start turn / end turn

### Acceptance Criteria

* Player can adjust HP and temp HP.
* Player can mark action, bonus action, reaction, and movement as used.
* Player can add/remove conditions.
* Combat state persists separately from character import.

---

## Phase 3: Dice Roller

### Goals

Add a reliable dice roller that can be used independently or from action cards.

### Deliverables

```txt
js/core/diceRoller.js
js/features/dicePanel.js
```

### Features

* Roll formulas like `1d20+5`, `2d6+3`.
* Advantage/disadvantage.
* Attack rolls.
* Damage rolls.
* Critical damage toggle.
* Combat log.

### Acceptance Criteria

* Player can roll arbitrary dice.
* Action cards can trigger rolls.
* Roll results are logged.
* Advantage/disadvantage works correctly.

---

## Phase 4: Basic Action Economy

### Goals

Show available basic combat actions.

### Deliverables

```txt
js/core/turnEngine.js
js/rules/actionEconomyRules.js
js/rules/movementRules.js
data/actions.json
```

### Features

* Attack
* Cast a Spell
* Dash
* Disengage
* Dodge
* Help
* Hide
* Ready
* Search
* Use an Object
* Movement tracking

### Acceptance Criteria

* App groups options by action type.
* Used actions become unavailable.
* Movement remaining is calculated.
* End Turn resets the turn economy.

---

## Phase 5: Weapons and Equipment

### Goals

Generate attack options from equipped weapons.

### Deliverables

```txt
js/rules/equipmentRules.js
js/features/equipmentPanel.js
```

### Features

* Detect equipped weapons.
* Calculate attack bonus.
* Calculate damage.
* Support finesse, ranged, thrown, versatile, ammunition, two-handed.
* Generate attack cards.
* Add Roll Attack and Roll Damage buttons.

### Acceptance Criteria

* Equipped weapons appear as action options.
* Attack and damage formulas are correct enough for normal cases.
* Two-weapon fighting is recognized where applicable.
* Unavailable options explain why they are unavailable.

---

## Phase 6: Spell Actions

### Goals

Generate combat options from known/prepared spells.

### Deliverables

```txt
js/rules/spellcastingRules.js
js/features/spellPanel.js
js/loaders/combatDataTransformer.js
data/overrides/spellOverrides.json
```

### Features

* Action spells
* Bonus action spells
* Reaction spells
* Cantrips
* Spell slots
* Concentration warnings
* Attack rolls
* Saving throws
* Healing rolls
* Damage rolls

### Acceptance Criteria

* Spells are grouped by action economy.
* Casting a spell can consume a spell slot.
* Concentration warnings appear.
* Spell cards show range, duration, save/attack, and damage/healing if available.

---

## Phase 7: Conditions and Turn Restrictions

### Goals

Make conditions affect available options.

### Deliverables

```txt
js/rules/conditionRules.js
data/conditions.json
```

### Features

* Grappled
* Prone
* Restrained
* Stunned
* Paralyzed
* Incapacitated
* Invisible
* Blinded
* Frightened
* Poisoned

### Acceptance Criteria

* Movement and action restrictions are reflected.
* The app explains condition effects.
* Condition warnings appear on relevant rolls or actions.

---

## Phase 8: Class and Race Features

### Goals

Add combat-relevant class and race features.

### Deliverables

```txt
js/rules/classFeatureRules.js
js/rules/raceFeatureRules.js
```

### Initial priority classes

Start with the most common and most turn-impacting features:

```txt
Fighter
Rogue
Barbarian
Cleric
Druid
Wizard
Paladin
Ranger
Monk
Bard
Sorcerer
Warlock
```

### Features

Examples:

```txt
Action Surge
Second Wind
Sneak Attack
Cunning Action
Rage
Reckless Attack
Divine Smite
Lay on Hands
Channel Divinity
Bardic Inspiration
Ki
Martial Arts
Warlock Pact Magic
Metamagic
```

### Acceptance Criteria

* Class features appear as action, bonus action, reaction, passive, or reminder cards.
* Class resources are tracked.
* Used features decrement resources.
* Features explain timing and cost.

---

## Phase 9: Wild Shape

### Goals

Add robust Wild Shape support for druids.

### Deliverables

```txt
js/features/wildShapePanel.js
js/rules/wildShapeRules.js
data/beasts.json
```

### Features

* Select beast form.
* Replace HP, AC, speeds, and attacks.
* Track beast HP.
* Revert to normal form.
* Circle of the Moon bonus action Wild Shape.
* Combat Wild Shape healing.

### Acceptance Criteria

* Druid can enter and exit Wild Shape.
* Available attacks change to beast attacks.
* Beast HP is tracked separately.
* Normal spellcasting is suppressed unless allowed.

---

## Phase 10: Rules Text Parsing and Overrides

### Goals

Improve the ability to extract turn-affecting options from 5e rules text.

### Deliverables

```txt
js/core/rulesParser.js
data/overrides/classFeatureOverrides.json
data/overrides/raceFeatureOverrides.json
data/overrides/equipmentOverrides.json
data/overrides/spellOverrides.json
docs/rules-engine.md
```

### Parsing targets

Look for phrases such as:

```txt
as an action
as a bonus action
as a reaction
when you are hit
when you take damage
once per turn
once per short rest
once per long rest
you can expend
you regain
you must concentrate
```

### Acceptance Criteria

* Parser extracts likely action economy from rules text.
* Manual overrides can correct parser mistakes.
* Developer diagnostic screen shows unparsed or ambiguous features.

---

# 18. Recommended First Build Scope

Do not start by trying to solve every class and every rule.

Start with this narrow but useful scope:

```txt
Character import
HP / AC / spell slot tracking
Basic action economy
Dice roller
Weapon attacks
Cantrips and simple spells
Conditions as reminders
```

Then add class-specific logic.

The first playable version should answer:

```txt
Can I move?
Can I attack?
Can I cast this spell?
What do I roll?
Did I already use my action or bonus action?
What resources do I have left?
```

That is enough to be useful at the table.

---

# 19. Suggested UI Components

## Character Header

```txt
Thalia
Level 5 Wood Elf Druid

HP 38 / 38
AC 16
Speed 35
Conditions: None
```

## Turn Economy Bar

```txt
Move: 15 / 35
Action: Available
Bonus: Used
Reaction: Available
```

## Action Card

```txt
Scimitar
Action · Melee Weapon Attack
+5 to hit
1d6+2 slashing

[Roll Attack] [Roll Damage] [Use Action]
```

## Spell Card

```txt
Healing Word
Bonus Action · 60 ft
Heal 1d4+4
Consumes 1st-level spell slot

[Cast] [Roll Healing]
```

## Warning Card

```txt
Entangle
Action · Concentration

Warning:
Casting this will end concentration on Faerie Fire.
```

---

# 20. Recommended Coding-Agent Prompt

Use this as the initial implementation prompt.

```txt
You are extending the existing DM-centric D&D 5e party sheet project with a new mobile-friendly Player Combat Assistant.

Review the existing project structure, especially the current character loading, local storage, data folder, and any existing JSON files for classes, races, spells, equipment, and conditions.

Create a new player-facing combat assistant module/page that helps a player understand what they can do on their turn in combat.

Implement Phase 1 and Phase 2 from docs/development-plan.md:

1. Add a mobile-friendly app shell for the Player Combat Assistant.
2. Add character import from D&D Beyond JSON upload or paste.
3. Normalize imported character data into an internal character model.
4. Display character name, level, race, class, ability scores, HP, AC, speed, spellcasting summary, and equipped combat-relevant items if available.
5. Add local storage persistence for imported characters and active character selection.
6. Add combat state tracking separate from the base character sheet:
   - current HP
   - temp HP
   - AC override
   - conditions
   - concentration
   - spell slots
   - action used
   - bonus action used
   - reaction used
   - movement used
7. Add Start Turn and End Turn controls.
8. End Turn should reset action, bonus action, movement, and relevant turn state.
9. Keep scripts modular and single-purpose.
10. Avoid native alert, confirm, and prompt. Use existing modal/toast utilities if present. If not present, create simple reusable modal/toast helpers.
11. Use local storage for persistence.
12. Keep the UI compact, modern, and mobile-first.
13. Update docs/development-plan.md with what was implemented, what files were changed, and what remains.

Do not attempt full rules parsing yet.
Do not implement every class feature yet.
Focus on a clean foundation that later phases can extend.
```

---

# 21. Key Risk Areas

## D&D Beyond import inconsistency

Different exports may structure character data differently. The normalizer should be defensive and log missing fields.

## Rules text parsing

Natural-language rules parsing will be brittle. Use overrides early.

## Class feature complexity

Do not hard-code everything into one giant file. Use modular feature adapters.

## Spell parsing

Spell timing, damage, saves, scaling, and concentration need a structured metadata layer.

## Mobile usability

The app should avoid dense character-sheet-style layouts. Players need fast decisions during combat.
