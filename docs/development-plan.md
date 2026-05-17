# Development Plan

## Current Session: Player Combat Assistant Phases 1-2

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

### Existing DM Roster Reuse Findings

- `dm-roster/data/referenceDataLoader.js` is browser-safe and directly reusable. The player app wraps it in `referenceDataService.js` so the rest of the app sees player-focused lookup helpers rather than the DM loader.
- `dm-roster/db/srdRepository.js` is IndexedDB/repository-oriented and depends on the DM database module. It was not reused directly. A browser-safe `srdRepositoryAdapter.js` now exposes the small lookup surface needed for this phase.
- `dm-roster/importers/ddbPdfImporter.js` is substantial and best-effort. PDF import is intentionally not primary for this phase, so `ddbPdfImporterAdapter.js` exposes a safe unsupported result for future integration.
- `dm-roster/importers/ddbJsonImporter.js` has useful extraction ideas, but it normalizes into the DM roster model and is larger than needed for this first player phase. The player app uses a small JSON parser plus a separate player normalizer.
- `dm-roster/importers/normalizedCharacter.js` informed defensive defaults, but the player app uses its required combat-focused model.

### Known Limitations

- No full rules engine, dice roller, weapon attack cards, or spell action parsing yet.
- D&D Beyond JSON structures vary; the normalizer handles common paths and records warnings, but some exports may need additional field mappings.
- Spell slots and inventory are displayed only when available in straightforward imported fields.
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
12. Search the codebase for `alert(`, `prompt(`, and `confirm(`; none should be used by the player app.

### Verification Completed

- `node --check js/player-combat/app.js`
- `node --check js/player-combat/normalizers/characterNormalizer.js`
- `node --check js/player-combat/ui/combatStatePanel.js`
- `rg "\b(alert|prompt|confirm)\s*\("`
- Checked new script sizes; all new JavaScript files are under 500 lines.

### Next Recommended Phase

Add the focused dice roller module, basic D&D combat actions, weapon attack extraction, and simple spell cards grouped by turn cost. Keep the rules engine separate from UI rendering and use the existing reference-data indexes for lookups.
