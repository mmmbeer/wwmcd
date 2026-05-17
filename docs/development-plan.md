# Development Plan

## Current Session: Player Combat Assistant Resource and Condition Warning Pass

### Implemented

- Added focused manual spell slot controls in the Combat State panel:
  - Remaining slots are shown as the primary value for each imported spell level.
  - Used slots can be decremented, incremented, directly edited, reset by level, or reset for all levels.
  - Slot changes are clamped to the imported maximum and persist only through `combatState.resourcesUsed.spellSlots`.
  - Imported character spell slot data remains unchanged.
- Added a focused condition rules module for simple combat warnings and blockers.
- Preserved hard action/movement blockers for Incapacitated, Paralyzed, Petrified, Stunned, and Unconscious.
- Added movement blocking for Grappled and Restrained.
- Added Prone movement reminder metadata when movement options are shown.
- Added simple non-automated warning metadata for:
  - Blinded attack rolls.
  - Poisoned attack rolls and ability checks.
  - Frightened attack rolls and ability checks while the source is in sight.
  - Restrained attack rolls.
- Improved unavailable reasons for movement blocked by condition while keeping existing action, bonus action, reaction, movement, and spell slot reasons.
- Rendered rule warnings on action cards without applying advantage/disadvantage automation.
- Added focused tests for condition warnings/blockers and manual spell slot combat-state persistence.

### Files Changed

- `css/player-combat.css`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/rules/actionEconomyRules.js`
- `js/player-combat/rules/conditionRules.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/combatStatePanel.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Condition warnings are reminders only; the app does not automate advantage/disadvantage, saving throw changes, attack targeting rules, or speed-cost math.
- Prone only shows a standing movement reminder; it does not spend half speed automatically.
- Grappled and Restrained reduce available movement to 0 for the simple movement option, but no escape action automation is implemented.
- Spell slot controls only cover imported standard spell slot levels. Pact magic, class resources, item charges, and custom limited-use resources remain future work.
- Spell slot spending still consumes only the spell's base level and does not support upcasting selection.
- Class features, race features, wild shape, VTT features, and multiplayer remain out of scope.

### Data Assumptions

- Normalized character spell slots are keyed by spell level and contain either a number or an object with `available`, `max`, or `value`.
- Active conditions in combat state are user-managed strings that match common SRD condition names.
- Condition warnings are intentionally broad because source-specific details such as Frightened line of sight are not tracked.

### Manual Test Checklist

1. Serve the project from the repo root and open `/player-combat.html`.
2. Import a spellcaster with spell slot data.
3. Confirm each spell level shows remaining slots, used slots, and `-`, `+`, direct input, per-level reset, and all-slot reset controls.
4. Spend a spell slot with a spell card and confirm the matching level's remaining count decreases.
5. Manually increment, decrement, directly edit, and reset a slot level; refresh and confirm the combat state persists.
6. Confirm the imported character's base spell slot maximum does not change after manual slot edits.
7. Add Grappled or Restrained and confirm movement options are unavailable with a movement-blocked reason.
8. Add Prone and confirm movement options show a standing-cost reminder.
9. Add Poisoned, Blinded, Frightened, or Restrained and confirm relevant attack/check cards show warning reminders without changing formulas.
10. Mark action, bonus action, or reaction used and confirm existing unavailable reasons still appear.
11. At mobile width, confirm spell slot controls remain readable and touch-sized.

### Verification Completed

- `node --test tests\playerCombatImport.test.mjs`
- `node --check` for every `js/player-combat/**/*.js` file.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `characterNormalizer.js` at 340 lines.
- Searched player app code for `alert(`, `prompt(`, and `confirm(`; no native dialogs are used.
- Served the repo with `python -m http.server` and confirmed `/player-combat.html` and `/data/spells.json` return HTTP 200.

### Next Recommended Phase

Add a small resource tracker for class resources and limited-use features using the same combat-state-only persistence pattern, or add targeted spell override data for high-value spell metadata gaps.

## Previous Session: Player Combat Assistant Import Reliability Pass

### Implemented

- Improved combat-focused D&D Beyond JSON normalization for common real export shapes without exposing raw D&D Beyond objects to UI modules.
- Preserved the normalized character/combat-state split; current HP, turn usage, spent slots, and log entries remain combat state only.
- Extended class normalization with spellcasting ability IDs when present.
- Extended inventory normalization for D&D Beyond `definition` items, including equipped/carried flags, base names, type/filter type, quantity, weapon damage, damage type, and weapon properties.
- Extended spell normalization across `spells.*` buckets and `classSpells[].spells`, including prepared/cantrip status, level, casting time from activation data, range, duration, concentration, save ability, casting ability, description, and damage.
- Normalized spell slot arrays, pact magic arrays, and object-shaped slot maps into the existing numeric `{ level: max }` slot model.
- Fixed numeric fallback handling so missing D&D Beyond fields no longer coerce `null` to `0` and accidentally erase defaults such as proficiency bonus.
- Improved weapon card reliability:
  - Uses normalized item fields before SRD fallback data.
  - Matches SRD reference weapons by base name when available.
  - Finesse weapons choose the better Strength/Dexterity modifier.
  - Ranged/ammunition weapons use Dexterity.
  - Melee weapons default to Strength.
  - Damage type is preserved when imported separately from damage dice.
- Improved spell card metadata:
  - Uses normalized casting time, range, duration, concentration, attack bonus, save DC, and save ability when available.
  - Falls back to SRD spell reference data when normalized fields are incomplete.
  - Detects spell attacks, simple damage formulas, simple healing formulas, and common saving throw text.
  - Shows clearer resource reasons for missing imported spell slot data or missing slots at a spell's level.
- Added focused `node --test` coverage for D&D Beyond-style weapon/spell/slot normalization and card formula generation.

### Files Changed

- `js/player-combat/normalizers/characterNormalizer.js`
- `js/player-combat/rules/weaponActions.js`
- `js/player-combat/rules/spellActions.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- The import pass remains intentionally combat-focused and does not attempt full 5e automation.
- Weapon proficiency is still assumed for normalized weapon inventory.
- Weapon formulas do not yet account for magic item bonuses, fighting styles, ammunition counts, thrown range, two-weapon fighting, versatile damage choice, or custom D&D Beyond modifiers.
- Spell parsing is still simple text/field extraction; it does not handle upcasting, scaling cantrip dice by character level, material costs, class features, metamagic, ritual-only behavior, or all saving throw/damage edge cases.
- Spell slot spending still consumes only the spell's base level.
- Class features, race features, wild shape, VTT features, and multiplayer remain out of scope.

### Data Assumptions

- D&D Beyond inventory items usually provide a `definition` object with `name`, `filterType`, `type`, `damage`, `damageType`, and `properties`.
- D&D Beyond spells may appear under `spells` buckets or `classSpells[].spells`; spell details usually live under each spell's `definition`.
- D&D Beyond activation type `1` maps to action, `2` maps to bonus action, and `3`/`4` map to reaction.
- Spell slots are expected as arrays of `{ level, available|max|value }`, `pactMagic` entries, or an object keyed by spell level.

### Manual Test Checklist

1. Serve the project from the repo root and open `/player-combat.html`.
2. Import a D&D Beyond JSON character with at least one weapon and one prepared spell.
3. Confirm weapon cards appear for imported weapon inventory.
4. Confirm a finesse weapon uses Dexterity when Dexterity is higher than Strength.
5. Confirm ranged/ammunition weapons use Dexterity and melee weapons default to Strength.
6. Confirm weapon damage cards show dice plus the chosen ability modifier and damage type when imported.
7. Confirm prepared spells and cantrips appear in the Spells tab.
8. Confirm spell cards show casting time, range, duration, concentration, save text, attack bonus, damage, or healing where straightforward data exists.
9. Cast a leveled spell and confirm a base-level spell slot is marked used.
10. Import or simulate a spellcaster without slot data and confirm leveled spell cards explain that spell slots were not imported.
11. Refresh the page and confirm imported characters and combat state still persist.
12. At mobile width, confirm cards remain readable and controls remain touch-sized.

### Verification Completed

- `node --test tests\playerCombatImport.test.mjs`
- `node --check` for every `js/player-combat/**/*.js` file.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `characterNormalizer.js` at 301 lines.
- Searched player app code for `alert(`, `prompt(`, and `confirm(`; no native dialogs are used.
- Served the repo with `python -m http.server` and confirmed `/player-combat.html` and `/data/spells.json` return HTTP 200.

### Next Recommended Phase

Add focused resource controls and the next layer of condition/resource warnings, then consider small override files for high-value spell and equipment exceptions rather than broad natural-language parsing.

## Previous Session: Player Combat Assistant Phase 3 Option Layer

### Implemented

- Added `player-combat.html` as the first player-facing combat assistant page.
- Added mobile-first shared UI styling in `css/player-combat.css`.
- Added reference data loading for `classes`, `conditions`, `equipment`, `feats`, `items`, `magic-items`, `races`, and `spells`.
- Added reference data status cards with loaded counts and non-blocking load errors.
- Added D&D Beyond JSON upload and paste import.
- Added defensive character normalization into the Player Combat Assistant model.
- Added local storage persistence through a single storage utility using:
  - `pca.characters`
  - `pca.activeCharacterId`
  - `pca.combatState`
  - `pca.settings`
  - `pca.importHistory`
- Added separate combat state tracking for HP, temp HP, AC, conditions, concentration, turn usage, movement, resources used, and log entries.
- Added mobile combat controls for HP, temp HP, AC, movement, conditions, concentration, start turn, end turn, action, bonus action, reaction, and reset combat.
- Added placeholder action tabs for later rules, dice, spell, and resource phases.
- Added a pure dice roller module that returns structured roll results without touching the DOM.
- Added the first combat option service pipeline for basic actions, movement, weapon attacks, simple spells, and action economy checks.
- Added basic action cards for Attack, Dash, Disengage, Dodge, Help, Hide, Ready, Search, and Use an Object.
- Added weapon attack cards from normalized weapon inventory, with reference equipment table enrichment when a weapon name matches SRD data.
- Added simple spell cards from normalized known/prepared/cantrip data, enriched from the reference spell index when available.
- Grouped cards into Recommended, Actions, Bonus, Movement, Spells, Resources, and Log sections.
- Added unavailable reasons for used action economy, spent spell slots, missing spell slot data, no movement remaining, and obvious action-blocking conditions.
- Added roll buttons for attack, check, damage, and healing formulas.
- Added option use/cast buttons that mark turn costs used, spend simple spell slots, and write combat log entries.
- Added latest dice result rendering separate from the dice roller.

### Files Created

- `player-combat.html`
- `css/player-combat.css`
- `js/player-combat/app.js`
- `js/player-combat/bootstrap.js`
- `js/player-combat/core/eventBus.js`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/core/storage.js`
- `js/player-combat/data/combatDataTransformer.js`
- `js/player-combat/data/referenceDataService.js`
- `js/player-combat/data/srdRepositoryAdapter.js`
- `js/player-combat/importers/ddbJsonImporter.js`
- `js/player-combat/importers/ddbPdfImporterAdapter.js`
- `js/player-combat/models/combatStateModel.js`
- `js/player-combat/normalizers/characterNormalizer.js`
- `js/player-combat/ui/cards.js`
- `js/player-combat/ui/characterImportPanel.js`
- `js/player-combat/ui/characterSummaryPanel.js`
- `js/player-combat/ui/combatStatePanel.js`
- `js/player-combat/ui/modal.js`
- `js/player-combat/ui/renderUtils.js`
- `js/player-combat/ui/tabs.js`
- `js/player-combat/ui/toast.js`
- `js/player-combat/ui/turnEconomyPanel.js`
- `js/player-combat/core/diceRoller.js`
- `js/player-combat/rules/actionEconomyRules.js`
- `js/player-combat/rules/basicActions.js`
- `js/player-combat/rules/weaponActions.js`
- `js/player-combat/rules/spellActions.js`
- `js/player-combat/rules/combatOptionsService.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/diceResult.js`

### Files Updated

- `js/player-combat/app.js`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/models/combatStateModel.js`
- `css/player-combat.css`
- `docs/development-plan.md`

### Existing DM Roster Reuse Findings

- `dm-roster/data/referenceDataLoader.js` is browser-safe and directly reusable. The player app wraps it in `referenceDataService.js` so the rest of the app sees player-focused lookup helpers rather than the DM loader.
- `dm-roster/db/srdRepository.js` is IndexedDB/repository-oriented and depends on the DM database module. It was not reused directly. A browser-safe `srdRepositoryAdapter.js` now exposes the small lookup surface needed for this phase.
- `dm-roster/importers/ddbPdfImporter.js` is substantial and best-effort. PDF import is intentionally not primary for this phase, so `ddbPdfImporterAdapter.js` exposes a safe unsupported result for future integration.
- `dm-roster/importers/ddbJsonImporter.js` has useful extraction ideas, but it normalizes into the DM roster model and is larger than needed for this first player phase. The player app uses a small JSON parser plus a separate player normalizer.
- `dm-roster/importers/normalizedCharacter.js` informed defensive defaults, but the player app uses its required combat-focused model.

### Known Limitations

- The option layer is intentionally simple and does not attempt full 5e automation.
- D&D Beyond JSON structures vary; the normalizer handles common paths and records warnings, but some exports may need additional field mappings.
- Spell slots and inventory are displayed and used only when available in straightforward imported fields.
- Weapon attack and damage formulas assume proficiency for normalized weapon inventory and use conservative ability choices from SRD weapon properties when available.
- Spell cards use casting time and simple text matching for attack, damage, and healing rolls; saving throws, upcasting, class features, material costs, and detailed spell effects are not fully parsed.
- Spell slot spending only tracks one slot at the spell's base level.
- PDF import is a placeholder and returns an unsupported message.
- Conditions are loaded from the SRD condition appendix and can be added/removed manually.

### Manual Test Checklist

1. Serve the project from the repo root and open `/player-combat.html`.
2. Confirm reference data status shows loaded counts for all eight data files.
3. At 375px browser width, confirm panels stack cleanly and controls remain touch-sized.
4. Paste invalid JSON and confirm an inline error appears.
5. Upload or paste D&D Beyond character JSON and confirm the character summary appears.
6. Refresh the page and confirm the imported character persists.
7. Change HP, temp HP, AC, and movement, then refresh and confirm combat state persists.
8. Start turn, mark action/bonus/reaction used, and end turn.
9. Add and remove a condition.
10. Set and clear concentration.
11. Reset combat and confirm the imported character remains.
12. Confirm Recommended, Actions, Bonus, Movement, Spells, Resources, and Log sections render after character import.
13. Roll a basic check from Hide or Search and confirm a large latest roll result appears and a log entry is added.
14. If the imported character has weapons, roll weapon attack and damage and confirm formulas are shown on the card.
15. If the imported character has spells, cast a cantrip and confirm only the action economy is marked used.
16. Cast a leveled spell and confirm the matching spell slot used count increments.
17. Mark action or bonus action used and confirm matching cards show unavailable reasons.
18. Add Stunned, Paralyzed, Incapacitated, Petrified, or Unconscious and confirm action/movement options show blocking reasons.
19. Search the codebase for `alert(`, `prompt(`, and `confirm(`; none should be used by the player app.

### Verification Completed

- `node --check js/player-combat/app.js`
- `node --check js/player-combat/core/diceRoller.js`
- `node --check js/player-combat/core/stateManager.js`
- `node --check js/player-combat/models/combatStateModel.js`
- `node --check js/player-combat/rules/actionEconomyRules.js`
- `node --check js/player-combat/rules/basicActions.js`
- `node --check js/player-combat/rules/weaponActions.js`
- `node --check js/player-combat/rules/spellActions.js`
- `node --check js/player-combat/rules/combatOptionsService.js`
- `node --check js/player-combat/ui/actionTabs.js`
- `node --check js/player-combat/ui/diceResult.js`
- `node --check js/player-combat/normalizers/characterNormalizer.js`
- `node --check js/player-combat/ui/combatStatePanel.js`
- `rg "\b(alert|prompt|confirm)\s*\("`
- Checked new script sizes; all new JavaScript files are under 500 lines.

### Next Recommended Phase

Improve normalization mappings for more D&D Beyond spell and weapon shapes, add focused resource controls, and add condition-specific warnings beyond the obvious action-blocking conditions.
