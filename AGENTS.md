```md
# AGENTS.md

## Project Context

This project is a mobile-friendly D&D 5e Player Combat Assistant that extends an existing DM-centric character/party management project.

The app helps players understand what they can do on their turn in combat by loading character data, tracking combat state, showing available actions, managing resources, and supporting dice rolls.

Primary technologies:

- HTML
- CSS
- JavaScript
- Local storage
- JSON data files for rules, classes, races, spells, equipment, and conditions

The project should remain lightweight, modular, mobile-friendly, and maintainable.

---

# Core Development Rules

## 1. Keep Scripts Small and Focused

Do not create monolithic scripts.

JavaScript files should generally stay under **500 lines**.

Each script should be limited to a specific, related set of responsibilities.

Good examples:

```txt
diceRoller.js
turnEngine.js
spellcastingRules.js
conditionRules.js
characterNormalizer.js
resourceTracker.js
modal.js
toast.js
```

Bad examples:

```txt
appEverything.js
combatManagerWithUIAndRules.js
allRules.js
main.js with thousands of lines
```

If a file is approaching 500 lines, split it into smaller modules before adding more logic.

Preferred separation:

```txt
/js/core
  stateManager.js
  storage.js
  eventBus.js
  diceRoller.js
  turnEngine.js

/js/loaders
  dndBeyondLoader.js
  characterNormalizer.js
  srdDataLoader.js
  combatDataTransformer.js

/js/rules
  actionEconomyRules.js
  movementRules.js
  spellcastingRules.js
  conditionRules.js
  classFeatureRules.js
  raceFeatureRules.js
  equipmentRules.js

/js/features
  actionPanel.js
  spellPanel.js
  resourceTracker.js
  dicePanel.js
  conditionManager.js

/js/ui
  modal.js
  drawer.js
  tabs.js
  cards.js
  toast.js
```

Each module should expose a small, clear API.

Avoid deeply coupling UI rendering, state mutation, and rules logic in the same file.

---

## 2. Reuse Common UI Patterns

UI elements should follow reusable patterns.

Do not create one-off button styles, modal styles, card layouts, drawer panels, or notification components unless there is a strong reason.

Use shared UI helpers and shared CSS classes for:

* Buttons
* Cards
* Modals
* Toasts
* Drawers
* Tabs
* Form fields
* Toggle controls
* Action cards
* Resource trackers
* Status badges
* Dice result displays

Preferred pattern:

```html
<button class="btn btn-primary">Roll Attack</button>
<button class="btn btn-secondary">Use Action</button>
<button class="btn btn-danger">End Turn</button>
```

Avoid:

```html
<button style="background: blue; padding: 12px; border-radius: 20px;">
```

UI should be consistent across the app.

When adding a new interface element, first check whether an existing component or CSS pattern can be reused.

If a new pattern is needed, create it as a reusable component rather than embedding it directly in one feature.

---

## 3. Do Not Use Built-In Alerts, Prompts, or Confirms

Do not use:

```js
alert()
prompt()
confirm()
```

Use custom modal, toast, drawer, or inline validation components instead.

Bad:

```js
alert("Character imported.");
const name = prompt("Enter character name");
if (confirm("End your turn?")) {
  endTurn();
}
```

Good:

```js
showToast({
  type: "success",
  message: "Character imported."
});

showModal({
  title: "Rename Character",
  body: renderRenameCharacterForm(),
  actions: [
    { label: "Cancel", variant: "secondary" },
    { label: "Save", variant: "primary", onClick: saveCharacterName }
  ]
});

showConfirmModal({
  title: "End Turn?",
  message: "This will reset your action, bonus action, and movement for the next turn.",
  confirmLabel: "End Turn",
  cancelLabel: "Cancel",
  onConfirm: endTurn
});
```

If modal utilities do not exist yet, create reusable utilities before implementing features that need alerts, prompts, or confirmations.

Suggested files:

```txt
/js/ui/modal.js
/js/ui/toast.js
/js/ui/confirmDialog.js
```

---

# Architecture Guidelines

## Separate Data, Rules, State, and UI

Keep these concerns separate:

```txt
Data loading:
  Reads D&D Beyond JSON and project JSON data.

Normalization:
  Converts imported data into internal app models.

Rules engine:
  Determines what options are available.

State manager:
  Tracks HP, resources, turn usage, conditions, and local persistence.

UI:
  Renders cards, buttons, panels, tabs, modals, and forms.
```

The UI should not make rules decisions directly.

Bad:

```js
if (!combatState.turn.actionUsed && spell.castingTime === "1 action") {
  renderSpellButton(spell);
}
```

Good:

```js
const options = getAvailableOptions(character, combatState);
renderActionOptions(options.actions);
```

The rules engine should decide availability. The UI should render the result.

---

## Use a Normalized Character Model

Do not let D&D Beyond’s raw structure leak throughout the app.

Import data once, normalize it, then use the internal model everywhere else.

Example:

```js
const rawCharacter = await loadDndBeyondJson(file);
const character = normalizeCharacter(rawCharacter);
saveCharacter(character);
```

Feature modules should consume the normalized character, not the raw import.

---

## Use a Separate Combat State Model

The imported character sheet represents the base character.

The combat state represents the current combat situation.

Keep these separate.

Examples of combat state:

* Current HP
* Temporary HP
* Conditions
* Concentration
* Used spell slots
* Used class resources
* Action used this turn
* Bonus action used this turn
* Reaction used this round
* Movement used this turn
* Current wild shape form

Do not permanently mutate the imported base character when the player takes damage, spends a spell slot, enters wild shape, or uses an action.

---

# File Size and Refactoring Rules

Before adding code to an existing file, check whether the new logic belongs there.

If the file is already large or handles multiple unrelated responsibilities, refactor first.

Refactor triggers:

* File is near or over 500 lines.
* File mixes UI rendering with rules logic.
* File mixes storage, state mutation, and DOM manipulation.
* A function is doing more than one clear job.
* Similar code exists in multiple places.
* A feature needs repeated copy/paste to extend.

When refactoring, preserve existing behavior unless the task specifically asks to change it.

---

# CSS Guidelines

Use shared CSS variables and reusable classes.

Recommended structure:

```txt
/css
  variables.css
  base.css
  layout.css
  components.css
  combat.css
  mobile.css
```

Use CSS variables for:

* Colors
* Spacing
* Borders
* Shadows
* Typography
* Z-index layers
* Breakpoints

Avoid large inline styles.

Avoid one-off component-specific CSS unless the component genuinely needs unique styling.

The UI should be compact, readable, and mobile-first.

---

# Mobile-First UI Requirements

This app is primarily for players using phones at a table.

Prioritize:

* Large readable roll results
* Clear action buttons
* Minimal scrolling where possible
* Sticky character summary
* Sticky turn economy bar
* Simple tabs or bottom navigation
* Clear unavailable reasons
* Fast access to dice, HP, conditions, actions, bonus actions, and spells

Avoid dense desktop character-sheet layouts on mobile.

---

# Dice Roller Rules

Dice rolling should live in a dedicated module.

Suggested file:

```txt
/js/core/diceRoller.js
```

The dice roller should not directly manipulate the DOM.

Good:

```js
const result = rollDice("1d20+5");
renderRollResult(result);
```

Bad:

```js
function rollDice(formula) {
  document.querySelector("#result").innerHTML = ...
}
```

The roller should return structured results that the UI can render.

---

# Rules Engine Guidelines

The rules engine should use a pipeline.

Example:

```js
function getAvailableOptions(character, combatState) {
  let options = [];

  options.push(...getBasicActions(character, combatState));
  options.push(...getWeaponActions(character, combatState));
  options.push(...getSpellActions(character, combatState));
  options.push(...getClassFeatureActions(character, combatState));
  options.push(...getRaceFeatureActions(character, combatState));
  options.push(...getEquipmentActions(character, combatState));

  options = applyActionEconomyRules(options, combatState);
  options = applyConditionRules(options, character, combatState);
  options = applyResourceRules(options, character, combatState);
  options = applyConcentrationRules(options, character, combatState);

  return groupOptionsByTurnCost(options);
}
```

Do not hard-code all rules into a single massive function.

Rules should be split by category:

```txt
actionEconomyRules.js
movementRules.js
spellcastingRules.js
conditionRules.js
equipmentRules.js
classFeatureRules.js
raceFeatureRules.js
wildShapeRules.js
```

---

# Data Transformation Guidelines

Raw JSON data may need to be transformed into combat-ready indexes.

Prefer transformation over repeated parsing during rendering.

Good:

```js
const combatData = transformCombatData({
  classes,
  races,
  spells,
  equipment,
  conditions
});
```

Avoid repeatedly searching raw arrays in UI components.

Use indexes such as:

```js
spellIndex
classFeatureIndex
raceFeatureIndex
equipmentIndex
conditionIndex
```

If rules text parsing is unreliable, use manual override files.

Suggested override files:

```txt
/data/overrides/spellOverrides.json
/data/overrides/classFeatureOverrides.json
/data/overrides/raceFeatureOverrides.json
/data/overrides/equipmentOverrides.json
```

---

# State and Persistence

Use local storage for the initial version.

Suggested keys:

```txt
pca.characters
pca.activeCharacterId
pca.combatState
pca.settings
pca.importHistory
```

All storage access should go through a storage utility.

Suggested file:

```txt
/js/core/storage.js
```

Do not scatter direct `localStorage.getItem()` and `localStorage.setItem()` calls throughout feature modules.

---

# Accessibility Requirements

Interactive elements should be keyboard-accessible where practical.

Use semantic HTML when possible.

Buttons should be real `<button>` elements.

Modals should:

* Trap focus while open
* Close with Escape
* Restore focus after closing
* Have accessible labels
* Avoid relying only on color to communicate state

---

# Testing and Verification

For each feature, verify at minimum:

* Works on mobile width.
* Persists after refresh if state should persist.
* Does not use `alert`, `prompt`, or `confirm`.
* Does not create a monolithic script.
* Reuses existing UI components where possible.
* Handles missing or incomplete character data gracefully.
* Shows unavailable options with clear reasons.

Manual test scenarios should be documented in the development plan.

---

# Documentation Rules

When completing a coding session, update the relevant documentation.

At minimum, update:

```txt
docs/development-plan.md
```

Include:

* What was implemented
* Files changed
* Known limitations
* Remaining work
* Manual test steps
* Any data assumptions or transformation issues

If a new subsystem is added, create or update a focused doc.

Examples:

```txt
docs/rules-engine.md
docs/data-normalization.md
docs/player-combat-assistant.md
```

---

# Do Not Do

Do not:

* Create huge all-in-one JavaScript files.
* Put unrelated functions into the same script.
* Use built-in `alert`, `prompt`, or `confirm`.
* Duplicate UI patterns instead of reusing components.
* Let raw D&D Beyond data spread throughout the app.
* Make UI components responsible for rules decisions.
* Hard-code every class feature into one giant rules file.
* Add inline styles unless absolutely necessary.
* Build a full VTT.
* Overcomplicate the first version with every possible 5e edge case.

---

# Preferred Implementation Order

1. App shell
2. Character import
3. Character normalization
4. Local persistence
5. Combat state tracking
6. HP, AC, conditions, spell slots, and turn economy controls
7. Dice roller
8. Basic combat actions
9. Weapon attacks
10. Spell actions
11. Conditions
12. Class and race features
13. Wild shape
14. Advanced rules parsing and overrides

Build the app in small, testable increments.

The first useful version should answer:

```txt
What can I do right now?
What have I already used this turn?
What do I roll?
What resources do I have left?
Why is this option unavailable?
```
