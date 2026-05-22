# Development Plan

## Current Session: Groq AI Recommendation Support

### Implemented

- Added local AI settings for a user-provided Groq API key, model list cache, and selected model under the existing `pca.settings` storage key.
- Added an `AI Options` item to the hamburger menu for saving the key locally and loading available Groq models through the existing PHP proxy.
- Added an `AI` button to the Recommendation Wizard header after a Groq key is saved.
- Added an AI recommendation modal that captures user tactical notes, includes the wizard answers, and sends a compact app context covering combat state, resources, conditions, spell slots, features, traits, equipment, spell lists, attacks, available options, and deterministic turn-set recommendations.
- Added a Groq chat service that requests structured ranked turn-plan JSON with actions, bonus actions, reactions, explanations, reasons, and warnings.
- Added an automatic fallback for models that reject Groq `json_schema` structured output. The fallback retries without `responseFormat` and uses a stricter JSON-only prompt with the same response contract.
- Rendered AI results directly in the Recommendation tab after the request completes, replacing the deterministic recommendation list until the wizard answers change.
- Marked AI-sourced turn sets and pieces with visible `AI` / `AI Recommendation` labels.
- Kept the `Getting recommendations...` spinner hidden until the player clicks `Get Recommendations`.
- Matched AI action pieces can be added to the planned turn through the existing validation path.
- Added focused test coverage for the AI context payload shape.

### Files Changed

- `js/player-combat/ai/aiSettings.js`
- `js/player-combat/ai/groqClient.js`
- `js/player-combat/ai/aiRecommendationContext.js`
- `js/player-combat/ai/aiRecommendationService.js`
- `js/player-combat/ui/aiOptionsModal.js`
- `js/player-combat/ui/aiRecommendationModal.js`
- `js/player-combat/app.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/recommendationWizardPanel.js`
- `css/player-combat.css`
- `tests/aiRecommendationContext.test.mjs`
- `tests/aiRecommendationService.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- The API key is stored locally in browser local storage, not on the server. This keeps the server from retaining the key, but local storage is not an encrypted secret store.
- AI recommendations depend on Groq model behavior and may still need player review against table rulings.
- PHP CLI is not installed in this environment, so the existing Groq proxy could not be linted locally.

### Manual Test Checklist

1. Open the hamburger menu and choose `AI Options`.
2. Save a Groq API key and confirm the menu shows `AI Options (saved)`.
3. Load models, select a model, close the modal, and confirm the Recommendation Wizard header shows the `AI` button.
4. Open AI recommendations, enter tactical notes, click `Get Recommendations`, and confirm the inline spinner appears while the request is in flight.
5. Confirm ranked AI turn sets render in the Recommendation tab, not only inside the modal, with explanations, reasons, warnings, and action pieces.
6. Click a matched AI action piece and confirm it stages in the planned turn using the same availability and concentration validation as normal recommendations.
7. Refresh the page and confirm the saved key/model remain available locally.

### Verification Completed

- `node --check js\player-combat\ai\aiSettings.js`
- `node --check js\player-combat\ai\groqClient.js`
- `node --check js\player-combat\ai\aiRecommendationContext.js`
- `node --check js\player-combat\ai\aiRecommendationService.js`
- `node --check tests\aiRecommendationService.test.mjs`
- `node --check js\player-combat\ui\aiOptionsModal.js`
- `node --check js\player-combat\ui\aiRecommendationModal.js`
- `node --check js\player-combat\app.js`
- `node --check js\player-combat\ui\actionTabs.js`
- `node --check js\player-combat\ui\recommendationWizardPanel.js`
- `node --test tests\aiRecommendationContext.test.mjs`
- `node --test tests\aiRecommendationService.test.mjs`
- `node --test tests\recommendationScoring.test.mjs`
- `node --test tests\*.test.mjs`

## Current Session: Leveled Spell Recommendation Pairing

### Implemented

- Added a recommendation-set compatibility check that prevents any set from containing more than one leveled spell.
- Applied the check to bonus actions, reactions, free/special pieces, movement, and extra attack selection through a shared helper.
- Added regression coverage for the reported `Hold Person` plus bonus-action `Misty Step` pairing.

### Files Changed

- `js/player-combat/recommendations/recommendationSets.js`
- `tests/recommendationScoring.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- This follows the app's existing simplified rule of one leveled spell per turn. It does not model the full 5e bonus-action spell rule separately.

### Manual Test Checklist

1. Open recommendations for a character with `Hold Person` and `Misty Step`.
2. Confirm a `Hold Person` turn set does not include `Misty Step` as a bonus action.
3. Confirm non-spell bonus actions can still pair with `Hold Person` when otherwise compatible.

### Verification Completed

- `node --check js\player-combat\recommendations\recommendationSets.js`
- `node --test tests\recommendationScoring.test.mjs`

## Current Session: Damage Recommendation Default

### Implemented

- Changed the Recommendation wizard default goal from `Balanced` to `Damage`.
- Updated recommendation turn-set defaults so generated set titles and reaction inclusion behavior use the same damage-first default.
- Added regression coverage for the default recommendation goal.

### Files Changed

- `js/player-combat/recommendations/recommendationScoring.js`
- `js/player-combat/recommendations/recommendationSets.js`
- `tests/recommendationScoring.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Users can still switch the wizard goal back to Balanced, Support, Control, Defense, or Mobility when those options are available.

### Manual Test Checklist

1. Open the Recommendation tab on a fresh page load.
2. Confirm the Goal dropdown defaults to `Damage`.
3. Confirm initial recommended turn sets are titled as damage turns when applicable.

### Verification Completed

- `node --check js\player-combat\recommendations\recommendationScoring.js`
- `node --check js\player-combat\recommendations\recommendationSets.js`
- `node --test tests\recommendationScoring.test.mjs`

## Current Session: Act Now Turn Queue Audit

### Implemented

- Changed the planned turn footer action from `Confirm Turn` to `Act now`.
- Changed compact action row controls to stage choices with `Add to turn`.
- When another action, bonus action, or reaction is already staged, matching rows now show `Replace [current option]` and replace that planned slot without spending resources.
- Removed pre-roll behavior from action selection. Tapping an option now only queues it in the planned turn.
- Moved attack roll prompts into the `Act now` flow. Queued attack options prompt for attack and damage rolls in sequence before the queued turn is committed.
- Kept resources, concentration, active effects, Wild Shape, spell slots, Ki/Focus, and action economy spending at execution time through the existing `useCombatOptions` state path.
- Updated the completion modal to `Actions Taken` with remaining unused turn features and `Start New Turn` / `Continue Turn` actions.
- Let planned Attack actions satisfy planning-time prerequisites for follow-up bonus options such as Martial Arts, Flurry of Blows, and Shield Master without marking the action as spent until `Act now`.
- Fixed the action roll modal OK path so a completed roll resolves before modal close handling runs.

### Files Changed

- `js/player-combat/app.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/actionRollModal.js`
- `js/player-combat/ui/mobileActionList.js`
- `js/player-combat/ui/plannedTurnState.js`
- `docs/development-plan.md`

### Known Limitations

- Planned resource reservations are displayed in state but do not yet prevent selecting two queued options that would overspend the same remaining resource if they occupy compatible turn slots.
- Attack execution prompts once per queued attack option; target-by-target multiattack sequencing and on-hit branch prompts are still future work.
- Recommendation set cards still act as quick-add buttons; their labels are not yet expanded into full `Add to turn` button text.

### Manual Test Checklist

1. Import a spellcaster, tap a leveled spell, and confirm it is added to the planned footer without spending a spell slot.
2. Tap `Act now`, complete any attack prompt if present, and confirm the spell slot and concentration update only after execution.
3. Import a druid with Wild Shape, add Wild Shape to the turn, and confirm the Wild Shape resource is not spent until `Act now`.
4. Import a monk, add an Attack action, and confirm Martial Arts or Flurry of Blows becomes available to add before execution.
5. Add one action, then tap a different action and confirm the button says `Replace [current action]` and the footer updates.
6. After `Act now`, choose `Continue Turn` and confirm spent actions or bonus actions are unavailable while unused reaction or movement remains available.

### Verification Completed

- `node --check js\player-combat\app.js`
- `node --check js\player-combat\ui\actionTabs.js`
- `node --check js\player-combat\ui\mobileActionList.js`
- `node --check js\player-combat\ui\plannedTurnState.js`
- `node --check js\player-combat\ui\actionRollModal.js`
- `node --test tests\*.test.mjs tests\*.test.js`

## Current Session: Multiattack Recommendation Sets

### Implemented

- Recommendation sets now read `option.attack.count` from weapon/special attack options.
- Characters with Extra Attack or similar multiple-attack metadata now get `Attack 1`, `Attack 2`, and additional attack pieces in recommended turn sets.
- Additional attack pieces use the next ranked compatible attack option when available, falling back to the same attack if it is the only option.
- Recommendation set labels now derive from actual option cost for the primary piece, so action-cost Wild Shape is labeled `Action` and bonus-action Wild Shape is labeled `Bonus`, not `Special`.
- Added regression coverage for multiple-attack recommendations and Wild Shape slot labeling.

### Files Changed

- `js/player-combat/recommendations/recommendationSets.js`
- `tests/recommendationScoring.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Multiple attacks are represented in recommendation sets as separate recommended pieces, but the planned-turn state still stores a single Attack action selection.
- The composer does not yet model target-specific per-attack choices, advantage state changes between attacks, or on-hit branching per individual attack.

### Manual Test Checklist

1. Import or simulate a character with `Extra Attack`.
2. Open Recommendation and confirm a weapon Attack turn set shows `Attack 1` and `Attack 2`.
3. Confirm a non-Moon druid's `Wild Shape` appears as `Action`.
4. Confirm a Moon druid or `Combat Wild Shape` option appears as `Bonus`.
5. Confirm no `Wild Shape` recommendation piece is labeled `Special` when it has an action or bonus cost.

### Verification Completed

- `node --check js\player-combat\recommendations\recommendationSets.js`
- `node --test tests\recommendationScoring.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`

## Current Session: Recommendation Prerequisite Pairing

### Implemented

- Added a focused prerequisite helper for recommendation set composition.
- Applied prerequisite checks to bonus, rider, and special set pieces.
- Blocked hit-dependent options such as `Divine Smite`, `Sneak Attack`, `Stunning Strike`, and similar "after/when/on hit" effects from pairing after non-attack actions such as `Hold Person`.
- Blocked Attack-action prerequisite features from pairing after non-Attack actions.
- Treated uncertain trigger follow-ups such as critical-hit or kill-trigger options as not guaranteed for planned recommendation sets.
- Added regression coverage for the reported `Hold Person` plus `Divine Smite` pairing, including a misclassified bonus-action Divine Smite option.

### Files Changed

- `js/player-combat/recommendations/recommendationPrerequisites.js`
- `js/player-combat/recommendations/recommendationSets.js`
- `tests/recommendationScoring.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Prerequisite detection is still text/name based; it covers common combat prerequisite wording but is not a complete formal parser for every feature and spell.
- The recommendation set composer remains conservative for trigger-only options because it does not know whether a crit, kill, opportunity trigger, or similar event has already occurred.

### Manual Test Checklist

1. Open recommendations with `Hold Person` and `Divine Smite`; confirm the `Hold Person` turn set does not include `Divine Smite`.
2. Confirm `Divine Smite` can still appear as a rider after a compatible weapon Attack action.
3. Confirm `Shield Master: Shove` or similar Attack-action follow-ups only pair after an Attack action.
4. Confirm critical-hit or kill-trigger bonus options are not treated as guaranteed bonus actions in planned recommendation sets.

### Verification Completed

- `node --check js\player-combat\recommendations\recommendationPrerequisites.js`
- `node --check js\player-combat\recommendations\recommendationSets.js`
- `node --test tests\recommendationScoring.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`

## Current Session: Spell Casting-Time Recommendation Filter

### Implemented

- Excluded spell options from turn recommendations unless they have an action, bonus-action, or reaction casting cost.
- Prevented long-casting spells such as `Ceremony` from appearing in ranked recommendations or composed recommendation sets.
- Kept the filter inside recommendation candidate collection so source spell JSON and spell loading remain unchanged.
- Added regression coverage proving a `1 hour` spell is excluded while an action spell remains recommendable.

### Files Changed

- `js/player-combat/recommendations/recommendationScoring.js`
- `tests/recommendationScoring.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- This only filters recommendation ranking and turn-set composition; non-combat spells can still exist in spell data/details elsewhere.
- Imported spell fixtures without explicit `spell.castingCost` are accepted if they have an explicit action, bonus, or reaction cost.

### Manual Test Checklist

1. Import or create a character with `Ceremony` and an action spell such as `Cure Wounds`.
2. Open the Recommendation tab and confirm `Ceremony` does not appear in ranked recommendations or turn sets.
3. Confirm action, bonus-action, and reaction spells still appear when otherwise available.

### Verification Completed

- `node --check js\player-combat\recommendations\recommendationScoring.js`
- `node --test tests\recommendationScoring.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`

## Current Session: Recommendation Set Sequencing

### Implemented

- Split recommendation turn-set composition into `recommendationSets.js` so scoring and set sequencing stay focused.
- Added post-attack rider sequencing for options such as `Divine Smite`, `Sneak Attack`, and `Stunning Strike`.
- Recommendation sets now attach post-attack riders only after a compatible Attack action; for example, `Divine Smite` will not be paired after a `Cast Haste` action.
- Replaced misleading `Free` labeling for conditional attack riders with `Rider`.
- Limited `Free` recommendation-set pieces to true free/object-style interactions such as object interaction, speaking, dropping an item, dropping prone, or stopping concentration.

### Files Changed

- `js/player-combat/recommendations/recommendationSets.js`
- `js/player-combat/recommendations/recommendationScoring.js`
- `tests/recommendationScoring.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Post-attack rider detection is intentionally conservative and name/text based for the current first pass.
- The composer sequences one high-ranked rider per turn set; future work can support multiple compatible riders after one attack when the UI can explain the stack clearly.
- This changes recommendation-set labeling and composition only; it does not change underlying action availability or resource rules.

### Manual Test Checklist

1. Open a paladin with `Divine Smite`, a weapon attack, and `Haste`; confirm a `Haste` recommendation set does not include `Divine Smite`.
2. Confirm a weapon Attack recommendation set can include `Divine Smite` as a `Rider`.
3. Open a rogue with `Sneak Attack`; confirm it appears as a `Rider` after a compatible attack, not as a `Free` action.
4. Confirm true object/free-style interactions can still appear as `Free`.

### Verification Completed

- `node --check js\player-combat\recommendations\recommendationScoring.js`
- `node --check js\player-combat\recommendations\recommendationSets.js`
- `node --test tests\recommendationScoring.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`

## Current Session: Tactical Recommendation Metadata

### Implemented

- Added sidecar tactical recommendation metadata under `data/recommendations/` for spells, feats, items, equipment, class features, and race features.
- Added a focused recommendation metadata loader that loads sidecar JSON without mutating upstream-style rules data.
- Enriched normalized combat options with `option.tactics` before recommendation scoring.
- Applied tactical metadata to score adjustments, roles, reasons, situation/range/difficulty boosts, and character synergy explanations.
- Preserved existing availability, action economy, resource, and concentration checks; metadata only changes recommendation ranking and explanatory reasons.
- Added coverage for low-combat utility penalties, rogue Hide/Sneak Attack setup, Elven Accuracy advantage synergy, Big Bad pressure, Big Bad + Minions area pressure, and missing metadata fallback.

### Files Changed

- `data/recommendations/spellTactics.json`
- `data/recommendations/featTactics.json`
- `data/recommendations/itemTactics.json`
- `data/recommendations/equipmentTactics.json`
- `data/recommendations/classFeatureTactics.json`
- `data/recommendations/raceFeatureTactics.json`
- `js/player-combat/data/recommendationMetadataLoader.js`
- `js/player-combat/data/referenceDataService.js`
- `js/player-combat/recommendations/tacticalMetadata.js`
- `js/player-combat/recommendations/recommendationScoring.js`
- `js/player-combat/ui/actionTabs.js`
- `tests/recommendationScoring.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Metadata is a first-pass curated set, not complete coverage for every spell, feat, item, equipment entry, class feature, or race feature.
- Synergy detection is name-based against normalized character features, so it cannot yet understand every imported feature alias or tactical board state.
- Requirements such as `advantage`, `hidden`, and `allyInDanger` are explanatory metadata only; the scorer does not treat them as hard prerequisites.
- Range and situation boosts depend on existing normalized option range and wizard answers.

### Manual Test Checklist

1. Open the Recommendation tab with a caster who knows `Light` and a damage cantrip; confirm `Light` is ranked lower in normal combat and explains its low-combat utility.
2. Open a rogue character with `Sneak Attack`; set Situation to Big Bad and Range to Far, then confirm `Hide` is promoted as advantage setup.
3. Add or import `Elven Accuracy`; set Rolls to Advantage and confirm recommendation reasons mention advantage synergy.
4. Set Situation to Big Bad and confirm boss pressure options such as `Stunning Strike`, `Divine Smite`, `Rage`, or strong single-target attacks rank higher when available.
5. Set Situation to Big Bad + Minions and confirm area damage/control such as `Fireball`, `Burning Hands`, `Web`, or `Breath Weapon` is promoted.
6. Confirm unavailable options remain unavailable and still show their existing unavailable reasons.

### Verification Completed

- `node --check js\player-combat\recommendations\recommendationScoring.js`
- `node --check js\player-combat\recommendations\tacticalMetadata.js`
- `node --check js\player-combat\data\recommendationMetadataLoader.js`
- `node --test tests\recommendationScoring.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`

## Current Session: Recommendation Wizard Decision Tree

### Implemented

- Added Big Bad and Big Bad + Minions to the live Recommendation wizard Situation dropdown.
- Updated the live Range dropdown to Melee, Near (< 30 ft), Long (30-90 ft), and Far (> 90 ft).
- Added the live DC dropdown with Easy, Medium, Hard, and Deadly.
- Flowed the new situation answers into recommendation scoring:
  - Big Bad boosts reliable single-target pressure, control, and meaningful resource use.
  - Big Bad + Minions boosts area damage/control and mixed priority-target pressure.
- Flowed the new range bands into scoring with numeric range parsing from option and spell metadata.
- Flowed DC into scoring and turn-set composition:
  - Easy favors low-resource options.
  - Hard and Deadly raise the value of control, defense, attacks, and impactful resource use.
  - Hard and Deadly can include defensive reactions in balanced turn sets.

### Files Changed

- `js/player-combat/recommendations/recommendationScoring.js`
- `tests/recommendationScoring.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Range classification still depends on available normalized range metadata or parseable range text.
- DC is treated as encounter difficulty pressure, not a monster saving throw DC or enemy AC model.
- Tactical source metadata sidecar files are still planned but not implemented in this session.

### Manual Test Checklist

1. Open the Recommendation tab and confirm Situation includes Big Bad and Big Bad + Minions.
2. Confirm Range includes Melee, Near (< 30 ft), Long (30-90 ft), and Far (> 90 ft).
3. Confirm DC includes Easy, Medium, Hard, and Deadly.
4. Compare Big Bad + Minions against Multiple foes and confirm area/control options become more prominent.
5. Set Range to Long and confirm melee-only options drop below compatible ranged options.
6. Set DC to Deadly and confirm defensive/control/resource options are more likely to appear in recommended turn sets.

### Verification Completed

- `node --check js\player-combat\recommendations\recommendationScoring.js`
- `node --test tests\recommendationScoring.test.mjs`

## Current Session: Recommendation Wizard Extension Plan

### Implemented

- Extended the recommendation wizard plan with Big Bad and Big Bad + Minions situations.
- Updated range planning to use Melee, Near (< 30 ft), Long (30-90 ft), and Far (> 90 ft).
- Added an encounter DC selector concept for Easy, Medium, Hard, and Deadly recommendation pressure.
- Added a tactical source-metadata plan for enriching spells, feats, items, equipment, class features, and race features without mutating generated source datasets directly.
- Documented examples for penalizing low-combat utility spells such as Light and boosting rogue advantage/Sneak Attack/Elven Accuracy workflows.

### Files Changed

- `docs/recommendation-wizard-plan.md`
- `docs/development-plan.md`

### Known Limitations

- This session updated planning documentation only; scorer implementation and JSON metadata files remain future work.

### Manual Test Checklist

1. Open `docs/recommendation-wizard-plan.md` and confirm the wizard controls include Situation, Range, DC, Resources, Rolls, and Concentration.
2. Confirm the tactical metadata section describes sidecar JSON files and example metadata for Light, Hide, and Elven Accuracy.
3. During implementation, verify the scorer degrades to existing heuristic behavior when tactical metadata is missing.

### Verification Completed

- Documentation-only change; no automated tests were run.

## Current Session: Full Spell Long Descriptions

### Implemented

- Spell action options now prefer the full `data/spells.json` reference description for long-form spell details when a matching reference spell is available.
- Expanded spell details, recommendation set details, and spell tab details now use the actual spell effect text instead of imported metadata-only descriptions.
- Spell reference cards no longer truncate descriptions after four paragraphs.

### Files Changed

- `js/player-combat/rules/spellActions.js`
- `js/player-combat/ui/spellDetailCard.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Full reference descriptions depend on a name match between the imported spell and `data/spells.json`; unmatched spells still fall back to the imported description.

### Manual Test Checklist

1. Import a spellcaster with prepared spells that match `data/spells.json`.
2. Open Recommendation and expand a recommended turn set containing a spell; confirm the spell effect text is visible.
3. Open Actions/Bonus/Reaction for spell options and expand the row; confirm Long Description shows the spell effect.
4. Open the Spells tab and expand a spell; confirm Long Description and Spell Reference include the full effect and higher-level text when available.

### Verification Completed

- `node --check js\player-combat\rules\spellActions.js`
- `node --check js\player-combat\ui\spellDetailCard.js`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`
- `rg -n "alert\(|prompt\(|confirm\(" js\player-combat -S` returned no matches.

## Previous Session: Recommendation Wizard

### Implemented

- Moved the Recommendation wizard Reset control into the wizard header and aligned it to the top right.
- Restored full spell/feature descriptions inside recommended turn-set cards using expandable detail sections.
- Stabilized `app-main`, action panels, and option tab widths so wide table/card content scrolls instead of resizing the main area.
- Changed the Recommendation wizard controls from chip groups to horizontal dropdowns with Reset at the end.
- Replaced the individual recommendation list on the Recommendation tab with ranked turn-set cards that combine compatible action, bonus, free, movement, and relevant reaction options.
- Moved Import / Replace Character out of the header action group and into the upper-left hamburger menu.
- Added a compact wizard to the existing Recommendation tab.
- Ranked combat options from the current `getCombatOptions()` pipeline using tactical answers for goal, situation, range, resources, roll context, and concentration preference.
- Added rank, score, and reason chips to recommendation UI without changing the existing action selection, roll modal, concentration warning, or planned-turn flows.
- Added a focused recommendation wizard plan at `docs/recommendation-wizard-plan.md`.

### Files Changed

- `css/player-combat.css`
- `index.html`
- `js/player-combat/recommendations/recommendationScoring.js`
- `js/player-combat/app.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/mobileActionList.js`
- `js/player-combat/ui/recommendationWizardPanel.js`
- `tests/recommendationScoring.test.mjs`
- `docs/recommendation-wizard-plan.md`
- `docs/development-plan.md`

### Known Limitations

- Recommendation scoring is heuristic and deterministic; it does not account for enemy AC, enemy save weaknesses, map position, or party state unless that data is later added to combat state.
- Wizard answers are session-local and reset on page reload.

### Manual Test Checklist

1. Open the Recommendation tab and confirm the wizard appears above the ranked action list.
2. Confirm Reset sits in the wizard header at the top right.
3. Change Goal, Situation, Range, Resources, Rolls, and Concentration dropdowns and confirm ranked turn sets update immediately.
4. Expand a spell or feature detail inside a recommended turn set and confirm the full description is visible.
5. Select a recommended attack inside a turn set and confirm the existing roll modal opens before the option is added to the planned turn.
6. Select a recommended concentration spell inside a turn set while concentrating and confirm the concentration warning still appears.
7. Toggle Available only and confirm unavailable recommendations hide without breaking rankings.
8. Open the upper-left hamburger menu and confirm Import / Replace Character opens the import modal.
9. Confirm `app-main` keeps a stable full width while wide tables/cards scroll internally.
10. Confirm the UI remains usable on a narrow mobile viewport.

### Verification Completed

- `node --check js\player-combat\recommendations\recommendationScoring.js`
- `node --check js\player-combat\ui\recommendationWizardPanel.js`
- `node --check js\player-combat\ui\actionTabs.js`
- `node --check js\player-combat\ui\mobileActionList.js`
- `node --check js\player-combat\app.js`
- `node --test tests\recommendationScoring.test.mjs`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\*.test.mjs`
- `rg -n "alert\(|prompt\(|confirm\(" js\player-combat -S` returned no matches.
- Confirmed touched UI/rules files remain under 500 lines: `recommendationScoring.js` 309, `recommendationWizardPanel.js` 126, `app.js` 229, `actionTabs.js` 204, `mobileActionList.js` 304.

## Current Session: Rest and Turn Transition Notices

### Implemented

- Added a reusable transient transition popover for quick UI state changes.
- `Done` now shows a short reset summary before ending the turn:
  - Action, bonus action, free action, movement, and this-turn spell limits reset.
  - The round advances.
  - Reaction/readied-action carryover is called out when applicable.
- `Short Rest` now shows which spent short-rest resources will reset and notes that spell slots/long-rest resources stay unchanged.
- `Long Rest` now shows whether spent spell slots reset and lists spent limited resources that reset.
- Popovers are anchored to the clicked button, use `role="status"`, and auto-dismiss without blocking play.

### Files Changed

- `css/player-combat.css`
- `js/player-combat/app.js`
- `js/player-combat/ui/transitionNotice.js`
- `js/player-combat/ui/turnEconomyPanel.js`
- `docs/development-plan.md`

### Known Limitations

- The transition notice is intentionally informational; it does not pause or confirm the action.
- The reset summary follows the app's current tracked reset behavior, so untracked sheet-only resources are not listed.

### Manual Test Checklist

1. Spend an action, bonus action, movement, and a spell/limited resource.
2. Click `Done` and confirm a popover appears near the button before the UI resets/advances.
3. Spend a short-rest resource such as Ki or Action Surge, click `Short Rest`, and confirm the popover names the reset resource.
4. Spend spell slots and limited resources, click `Long Rest`, and confirm the popover names what resets.
5. Confirm repeated clicks replace the previous popover instead of stacking.

### Verification Completed

- `node --check js\player-combat\app.js`
- `node --check js\player-combat\ui\turnEconomyPanel.js`
- `node --check js\player-combat\ui\transitionNotice.js`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`
- `rg -n "alert\(|prompt\(|confirm\(" js\player-combat -S` returned no matches.
- Confirmed touched UI files remain under 500 lines: `transitionNotice.js` 90, `turnEconomyPanel.js` 95, `app.js` 122.

### Next Recommended Phase

Add a browser smoke test for the transient popover position/content on mobile and desktop widths.

## Previous Session: Action Table Polish

### Implemented

- Removed the outer action-panel spacing by dropping `app-main` gap/padding and the extra panel padding.
- Updated action tables so unavailable rows are muted, italicized, sorted to the end, and optionally hidden with a header checkbox.
- Removed compact “already used” unavailable notices while keeping non-economy unavailable reasons available in expanded details.
- Reworked the Attacks table:
  - Removed the `Damage / Notes` column.
  - Removed attack/damage text buttons from attack rows and attack expanded details.
  - Kept small clickable dice controls beside the attack modifier and damage formula in the Roll column.
  - The `Use` button now rolls attack and damage before consuming the attack action.
- Closed the import modal after a successful import and returned the action tabs to `Recommendation`.
- Tightened expanded long-description wrapping so long imported feature/action text wraps inside the detail row.

### Files Changed

- `css/player-combat.css`
- `js/player-combat/app.js`
- `js/player-combat/ui/actionOptionHandlers.js`
- `js/player-combat/ui/actionOptionRenderers.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/characterImportPanel.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- The hide-unavailable checkbox is a UI-only preference for the current session and is not persisted.
- Import warnings are no longer held open in the modal after import; they are superseded by the success toast and the app returning to Recommendation.

### Manual Test Checklist

1. Open Recommendation, Actions, and Attacks and confirm the panel starts flush with the app main content.
2. Use an action, confirm unavailable rows move to the end, appear muted/italicized, and do not show an “already used” compact notice.
3. Toggle `Hide unavailable` in a table header and confirm unavailable rows hide and return.
4. Open Attacks and confirm `Damage / Notes`, `Roll Attack`, and `Roll Damage` are absent from compact and expanded rows.
5. Click the small dice beside attack and damage values and confirm each roll logs independently.
6. Click `Use` on an attack and confirm both attack and damage roll, then the action is consumed.
7. Import a new PDF character and confirm the modal closes and the Recommendation tab is selected.
8. Expand a long action detail row and confirm the long description wraps within the table area.

### Verification Completed

- `node --check js\player-combat\ui\actionOptionRenderers.js`
- `node --check js\player-combat\ui\actionTabs.js`
- `node --check js\player-combat\ui\actionOptionHandlers.js`
- `node --check js\player-combat\ui\characterImportPanel.js`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`
- `rg -n "alert\(|prompt\(|confirm\(" js\player-combat -S` returned no matches.
- Confirmed touched UI files remain under 500 lines: `actionOptionRenderers.js` 498, `actionTabs.js` 175, `actionOptionHandlers.js` 78, `characterImportPanel.js` 158.

### Next Recommended Phase

Add a browser-level smoke test for the attack table controls, hide-unavailable checkbox, and successful import modal transition.

## Previous Session: Action Tab UI Performance

### Implemented

- Audited the action tab render path for tab-switch lag.
- Cached combat option groups for the active state snapshot so local tab changes no longer rerun the full combat option pipeline.
- Ignored clicks on the already-selected tab or already-selected spell filter to avoid redundant renders.
- Changed expanded action/spell detail rows to lazy-render their full detail panel only when opened.
  - Compact table rows still render immediately.
  - Hidden spell reference cards are no longer generated for every spell during tab switches.
- Guarded spell detail close-button binding so repeated expansion does not attach duplicate listeners.

### Files Changed

- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/actionOptionRenderers.js`
- `docs/development-plan.md`

### Known Limitations

- The selected tab's compact table still re-renders when switching categories; the expensive rules recomputation and hidden detail-card rendering are removed from normal tab switching.
- No browser profiler trace was captured in this session, so the improvement is based on code-path reduction and automated regression checks.

### Manual Test Checklist

1. Import or simulate a spellcaster with a larger spell list.
2. Switch between Recommendation, Actions, Attacks, and Spells and confirm tab changes feel responsive.
3. Expand a weapon, feature, and spell row and confirm details render on first open and toggle closed/open afterward.
4. Close an expanded spell detail card with its close button and confirm the row collapses without triggering a roll or cast action.
5. Click the already-selected tab and confirm the UI does not visibly refresh.

### Verification Completed

- `node --check js\player-combat\ui\actionTabs.js`
- `node --check js\player-combat\ui\actionOptionRenderers.js`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`
- `rg -n "alert\(|prompt\(|confirm\(" js\player-combat -S` returned no matches.
- Confirmed touched UI files remain under 500 lines: `actionTabs.js` 158 lines, `actionOptionRenderers.js` 455 lines.

### Next Recommended Phase

Add a small browser smoke/performance test around tab switching and row expansion so future action-table changes catch large DOM rewrites before manual testing.

## Previous Session: Feature Spell Limited Uses

### Implemented

- Added tracked limited-use resources for feature-granted spell casts when feature text says the spell can be cast once without a spell slot and recharges on a rest.
  - Each tracked feature spell gets a stable resource id based on the feature and spell name.
  - The option becomes unavailable after the tracked use is spent.
  - Long rest reset clears the spent feature-spell resource through the existing limited-resource state bucket.
  - Spell action economy, leveled spellcasting, and concentration tracking still apply to the feature spell.
- Updated action economy resource checks to honor inline resource metadata on generated options when the imported character does not already contain that resource.

### Files Changed

- `js/player-combat/rules/featureActions.js`
- `js/player-combat/rules/actionEconomyRules.js`
- `tests/playerCombatActions.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Limited-use detection is conservative and targets clear once-per-rest spellcasting text that also says the feature cast does not use a spell slot.
- Inferred feature-spell resources are enforced on the option and reset with rest state, but they are not yet added to the editable Limited Resources panel unless the import already provides them.

### Manual Test Checklist

1. Import or simulate an Air Genasi with Mingle with the Wind and confirm Levitate appears as a feature spell with a one-use long-rest resource.
2. Use Levitate from the feature option and confirm it becomes unavailable after the cast.
3. Take a long rest and confirm the feature spell is available again.
4. Confirm Levitate still uses an Action, marks leveled spellcasting, and starts concentration.

### Verification Completed

- `node --check js\player-combat\rules\featureActions.js`
- `node --check js\player-combat\rules\actionEconomyRules.js`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `js/player-combat/normalizers/characterNormalizer.js` at 451 lines.

### Next Recommended Phase

Surface inferred feature-spell resources in the Limited Resources panel so players can manually adjust them before or after using an option.

## Previous Session: Compact Rows and Feature Spellcasting

### Implemented

- Removed compact-table description text from under non-spell action names; longer descriptions now stay in the expanded detail panel.
- Limited the compact `Damage / Notes` column for attacks to short tactical metadata, keeping long imported feature reminders out of the table row.
- Added feature-granted spellcasting options from imported/reference feature text that says the character can cast named spells:
  - Feature casts use the referenced spell's action cost, level, range, concentration, and save metadata.
  - Feature casts do not require spell slots, so racial/feature casts such as Air Genasi Feather Fall or Levitate remain available to characters without spell slots.
  - Feature casts still count as leveled spellcasting for turn tracking and can start concentration.
- Fixed feature collection so race features from both normalized feature storage locations are considered.

### Files Changed

- `js/player-combat/ui/actionOptionRenderers.js`
- `js/player-combat/rules/featureActions.js`
- `js/player-combat/rules/featureData.js`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/ui/actionOptionHandlers.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Feature-granted spell usage limits are surfaced as manual-tracking notes unless the import provides a tracked limited-use resource.
- Feature spell detection depends on feature text mentioning a spell name from the loaded spell reference data near the word `cast`.

### Manual Test Checklist

1. Open Attacks and confirm action names no longer show long description text beneath them.
2. Confirm the compact `Damage / Notes` column only shows short notes such as attack ability, while expanded details still show full notes and descriptions.
3. Import or simulate an Air Genasi Monk and confirm Feather Fall appears as a Reaction feature cast and Levitate appears as an Action feature cast.
4. Confirm those feature spell casts are available even when the character has no spell slots.
5. Cast Levitate from the feature option and confirm Action is used and concentration is tracked.

### Verification Completed

- `node --check js\player-combat\rules\featureActions.js`
- `node --check js\player-combat\rules\featureData.js`
- `node --check js\player-combat\ui\actionOptionRenderers.js`
- `node --check js\player-combat\ui\actionOptionHandlers.js`
- `node --check js\player-combat\core\stateManager.js`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\*.test.mjs tests\*.test.js`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `js/player-combat/normalizers/characterNormalizer.js` at 451 lines.

### Next Recommended Phase

Add explicit limited-use controls for feature-granted spell casts when imports provide once-per-rest spellcasting traits.

## Previous Session: PDF-Only Import Modal

### Implemented

- Removed JSON file upload and pasted JSON entry from the character import modal.
- Reworked the import modal around fillable PDF import only:
  - Added a large clickable PDF drop zone.
  - Added drag-and-drop support for PDF files.
  - Disabled the Import button until a PDF has been parsed and normalized successfully.
- Added a loaded-file preview that shows the character name, class, level, and PDF filename before import.
- Kept import warnings visible after the selected file is cleared from the modal.

### Files Changed

- `js/player-combat/ui/characterImportPanel.js`
- `css/player-combat.css`
- `docs/development-plan.md`

### Known Limitations

- PDF import is still limited to fillable character sheet PDFs; scanned or flattened PDFs are rejected by the existing importer.
- JSON import code still exists in the importer module for now, but it is no longer exposed in the import modal.

### Manual Test Checklist

1. Open the import modal and confirm it only offers fillable PDF import.
2. Click the drop zone, choose a fillable character sheet PDF, and confirm the preview shows character name, class, and level.
3. Drag a fillable PDF onto the drop zone and confirm the same preview appears.
4. Try a non-PDF file and confirm the modal shows an inline error and keeps Import disabled.
5. Import a valid PDF and confirm the character loads and any warnings remain visible.

### Verification Completed

- `node --check js\player-combat\ui\characterImportPanel.js`
- `node --test tests\playerCombatImport.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `js/player-combat/normalizers/characterNormalizer.js` at 451 lines.

### Next Recommended Phase

Add a browser smoke test for the import modal's click-select, drag-and-drop, preview, and disabled Import states.

## Previous Session: Expandable Action Row Details

### Implemented

- Added a data-table UI rule for action option rows:
  - Every option row now starts with a down-chevron expansion control.
  - Clicking the row or the chevron opens a detail row below the compact data row.
  - The detail row uses a consistent panel layout for features, spells, attacks, resources, and basic actions.
- Built a shared long-form detail presentation:
  - Header with option name, source/cost/range subtitle, and compact badges.
  - Quick facts for range, roll, damage, save, and resource when available.
  - A `Long Description` section for the full action/feature/spell text available to the option.
  - A `Rolls` section with all roll buttons and formulas.
  - A `Notes` section for rule metadata, warnings, and unavailable reasons.
  - Spell rows keep their spell reference content, but inside the same detail panel structure as other rows.
- Generic parsed feature actions now preserve their imported/reference feature text as `longDescription` so the expanded detail section can show the fuller source text instead of only the compact row summary.
- Added a small slide/fade animation for expanded detail panels and a rotating chevron indicator.

### Files Changed

- `css/player-combat.css`
- `js/player-combat/rules/featureActions.js`
- `js/player-combat/ui/actionOptionRenderers.js`
- `docs/development-plan.md`

### Known Limitations

- Dedicated hand-authored feature cards only have the descriptions and metadata currently encoded in their rule modules. Generic parsed feature cards can show fuller imported/reference text.
- The slide-out animation is intentionally subtle because the content lives inside semantic table rows.

### Manual Test Checklist

1. Open Recommended, Actions, Attacks, Spells, Bonus, Free, and Reaction tabs and confirm every data row starts with a chevron.
2. Click a row and then its chevron; confirm both toggle the same detail section.
3. Confirm attack, feature, and spell detail panels share the same header, quick facts, Long Description, Rolls, and Notes layout.
4. Confirm row action buttons still roll/use/cast without toggling the detail row.
5. Confirm spell details still include spell reference content inside the shared detail panel.

### Verification Completed

- `node --check js\player-combat\ui\actionOptionRenderers.js`
- `node --check js\player-combat\rules\featureActions.js`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file is under 500 lines; largest file is `js/player-combat/normalizers/characterNormalizer.js` at 451 lines.

### Next Recommended Phase

Add a browser smoke test for row expansion and action-button click isolation so future table changes preserve the chevron/detail behavior.

## Previous Session: Consumable Resource Bar and Action Table Alignment

### Implemented

- Expanded the fixed consumable resource bar between turn progress and options:
  - It still shows concentration and spell slots.
  - It now also shows tracked class resources and limited-use resources such as Ki/Focus, Rage, Wild Shape, and similar consumables.
  - Resource badges route to the Resources option group for detailed controls.
- Normalized non-spell action table rows across Recommended, Actions, Attacks, Bonus, Free, and Reaction:
  - Shared columns now include Type, M/R, Name, Range, Roll, Damage/Notes, and Buttons.
  - Attack rows now include a Use button through the same option-use path as other action rows.
  - Attack rows no longer lose range, damage, rider, or use details when shown outside the Attacks tab.
- Added weapon range metadata in rules:
  - Ranged and thrown weapons parse normal/long range from weapon properties such as `range 150/600`.
  - Melee attacks show reach in feet.
  - Reach weapons add 5 ft.
  - Imported reach-changing feature text is checked for common reach bonuses, including Long-Limbed-style features.
- Added a thin M/R column for attack rows, including spell attack rows where the spell looks like a melee or ranged spell attack.

### Files Changed

- `css/player-combat.css`
- `js/player-combat/rules/weaponActions.js`
- `js/player-combat/ui/actionOptionRenderers.js`
- `js/player-combat/ui/spellcastingBar.js`
- `tests/playerCombatActions.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Reach feature detection is conservative and based on imported feature names/text. It covers explicit numeric reach increases and Long-Limbed-style text, but unusual homebrew phrasing may not be detected.
- The top resource bar is compact and links to the Resources group for editing; it does not directly increment/decrement class resources.
- Spell M/R detection is heuristic for spell attacks using range and description text.

### Manual Test Checklist

1. Import or simulate a character with spell slots and Ki/Focus; confirm both spell slots and Ki/Focus appear in the fixed resource bar between turn progress and options.
2. Click a spell slot badge and confirm the Spells group filters to that level; click a limited resource badge and confirm the Resources group opens.
3. Open Recommended and Attacks with a melee weapon, reach weapon, thrown weapon, and ranged weapon; confirm M/R, range, roll, damage/notes, and Use controls appear consistently.
4. Use an attack from the Attacks tab and confirm the action/attack turn state updates.
5. Import or simulate a reach-changing feature and confirm melee attack range includes the feature bonus.

### Verification Completed

- `node --check js\player-combat\ui\spellcastingBar.js`
- `node --check js\player-combat\ui\actionOptionRenderers.js`
- `node --check js\player-combat\rules\weaponActions.js`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file is under 500 lines; largest file is `js/player-combat/normalizers/characterNormalizer.js` at 451 lines.

### Next Recommended Phase

Add a browser smoke test for resource-bar rendering and row controls, especially attack Use buttons and M/R/range columns across Recommended, Attacks, and Spells.

## Previous Session: Action Tabs UI Refactor

### Implemented

- Split the oversized `js/player-combat/ui/actionTabs.js` into focused UI modules:
  - `actionTabs.js` now owns tab selection state, option filtering, top-level render flow, and event binding.
  - `actionOptionRenderers.js` owns option, attack, spell, log, badge, meta, warning, and detail-row rendering.
  - `actionOptionHandlers.js` owns roll handling, option lookup, spell-casting guards, concentration replacement confirmation, and option use.
- Preserved the existing action option behavior and moved rider roll buttons into expanded attack details so inline attack riders are reachable from weapon cards.
- Reduced `actionTabs.js` from 499 lines to 135 lines; the largest player-combat file is now `characterNormalizer.js` at 451 lines.

### Files Changed

- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/actionOptionRenderers.js`
- `js/player-combat/ui/actionOptionHandlers.js`
- `docs/development-plan.md`

### Known Limitations

- `actionOptionRenderers.js` is intentionally still a rendering bundle for all action tables. If attack or spell rendering grows further, split those table renderers into dedicated modules.
- The refactor does not add new browser-level UI automation tests; existing rules and import tests cover the option model, while syntax checks cover module wiring.

### Manual Test Checklist

1. Import or simulate a character and switch between Recommended, Attacks, Actions, Spells, Bonus, Free, and Reaction tabs.
2. Expand weapon and spell rows and confirm details still open and close.
3. Roll primary weapon/spell dice and inline rider dice from expanded attack details.
4. Use normal actions, movement, spells, and concentration spells and confirm the existing modal behavior is unchanged.

### Verification Completed

- `node --check js\player-combat\ui\actionTabs.js`
- `node --check js\player-combat\ui\actionOptionRenderers.js`
- `node --check js\player-combat\ui\actionOptionHandlers.js`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file is under 500 lines; largest file is `js/player-combat/normalizers/characterNormalizer.js` at 451 lines.

### Next Recommended Phase

Add a small browser smoke test around tab switching, row expansion, and rider roll buttons before adding more UI behavior.

## Previous Session: Inline Weapon and Spell Feature Riders

### Implemented

- Added `js/player-combat/rules/weaponFeatureRiders.js` to attach feature metadata and rider rolls to base weapon/unarmed attack cards without duplicating the primary attack cards.
- Added inline Rage support:
  - Eligible active-Rage Strength melee weapon and unarmed attacks show Rage damage bonus metadata.
  - Active Rage metadata also surfaces the bludgeoning, piercing, and slashing resistance reminder.
- Added inline Reckless Attack support:
  - When `turn.recklessAttackUsed` is set, eligible Strength melee weapon/unarmed attacks show advantage metadata.
  - The defensive drawback remains visible as a warning on those attacks.
- Added inline Sneak Attack support:
  - Eligible finesse or ranged weapon attacks expose the scaling Sneak Attack damage roll.
  - When `turn.sneakAttackUsed` is set, eligible attacks show the spent state instead of another rider damage roll.
- Added inline Stunning Strike support:
  - Melee weapon and unarmed attacks show the Ki/Focus spend reminder and calculated Constitution save DC.
- Added inline Great Weapon Master support:
  - Eligible heavy weapon attacks expose a -5 attack roll and +10 damage rider roll in attack details.
- Added `js/player-combat/rules/spellFeatureRiders.js` for War Caster spell metadata:
  - The War Caster reaction card lists likely eligible single-target action spells.
  - Eligible spell cards are marked as usable for War Caster opportunity spell reactions.
- Updated attack detail rows to render non-primary rider roll buttons, leaving the compact attack table unchanged.

### Files Changed

- `js/player-combat/rules/advancedFeatureActions.js`
- `js/player-combat/rules/combatOptionsService.js`
- `js/player-combat/rules/spellActions.js`
- `js/player-combat/rules/spellFeatureRiders.js`
- `js/player-combat/rules/weaponActions.js`
- `js/player-combat/rules/weaponFeatureRiders.js`
- `js/player-combat/ui/actionTabs.js`
- `tests/playerCombatActions.test.mjs`
- `docs/feature-implementation-plan.md`
- `docs/development-plan.md`

### Known Limitations

- Sneak Attack and Stunning Strike still use the existing dedicated cards for actual turn/resource spending; inline riders expose rolls and spend metadata but do not provide nested per-hit spend buttons yet.
- Rage damage and Great Weapon Master damage are shown as rider metadata/extra rolls rather than mutating the base weapon damage formula.
- Reckless Attack first-attack timing is not enforced.
- War Caster spell eligibility is heuristic and may miss or include edge-case spells with complex target text.
- `js/player-combat/ui/actionTabs.js` is now 499 lines; split it before adding more UI behavior.

### Manual Test Checklist

1. Import or simulate an active-Rage Barbarian with Reckless Attack enabled and confirm eligible Strength melee attacks show Rage damage, Rage resistance, advantage, and the defensive warning.
2. Import or simulate a Rogue with finesse and non-finesse weapons; confirm only eligible weapons show Sneak Attack damage and that the rider disappears after `turn.sneakAttackUsed`.
3. Import or simulate a Monk with Ki and Stunning Strike; confirm melee weapon and unarmed attacks show the Ki spend and Con save DC.
4. Import or simulate a Great Weapon Master character with a heavy weapon; expand the attack detail and confirm the GWM attack and +10 damage rider buttons appear.
5. Import or simulate a War Caster spellcaster with a single-target action spell and an area spell; confirm only the single-target spell is listed/marked.

### Verification Completed

- `node --check js\player-combat\rules\weaponFeatureRiders.js`
- `node --check js\player-combat\rules\spellFeatureRiders.js`
- `node --check js\player-combat\rules\weaponActions.js`
- `node --check js\player-combat\rules\spellActions.js`
- `node --check js\player-combat\rules\advancedFeatureActions.js`
- `node --check js\player-combat\ui\actionTabs.js`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file is under 500 lines; largest file is `js/player-combat/ui/actionTabs.js` at 499 lines.

### Next Recommended Phase

Split `actionTabs.js` before adding more UI, then add a general per-rider spend control so inline Sneak Attack, Stunning Strike, Divine Smite, and similar on-hit riders can spend resources or set turn flags directly from the attack card.

## Previous Session: Advanced Action-Affecting Feature Rules

### Implemented

- Added `js/player-combat/rules/advancedFeatureActions.js` for the next batch of dedicated feature behavior.
- Added Barbarian feature cards:
  - `Rage` as a bonus-action active effect with tracked resource spending when a Rage resource exists.
  - `End Rage` while Rage is active.
  - `Reckless Attack` as a free turn marker with the defensive drawback documented.
  - `Frenzy: Bonus Attack` for Berserker/Frenzy characters, gated by active Rage.
- Added Monk feature cards:
  - `Deflect Missiles` reaction with calculated reduction roll.
  - `Slow Fall` reaction with calculated damage reduction.
  - `Stunning Strike` on-hit Ki/Focus spend with calculated save DC.
- Added Rogue feature cards:
  - `Sneak Attack` once-per-turn damage card with scaling dice.
  - Dedicated `Uncanny Dodge` reaction card.
- Added feat feature cards:
  - `War Caster: Opportunity Spell`.
  - `Great Weapon Master: Heavy Attack` with the -5 attack roll.
  - `Polearm Master: Enter Reach` reaction reminder.
  - `Shield Master: Dexterity Save` reminder.
- Extended `useCombatOption` to support generic active-effect, clear-effect, and turn-flag effects.
- Updated Free grouping so no-cost feature cards render in the Free tab instead of only appearing in Recommended.
- Prevented generic parsed feature actions from duplicating the new dedicated cards.

### Files Changed

- `js/player-combat/core/stateManager.js`
- `js/player-combat/rules/actionEconomyRules.js`
- `js/player-combat/rules/advancedFeatureActions.js`
- `js/player-combat/rules/combatOptionsService.js`
- `js/player-combat/rules/featureActions.js`
- `tests/playerCombatActions.test.mjs`
- `docs/feature-implementation-plan.md`
- `docs/development-plan.md`

### Known Limitations

- Rage damage, damage resistance, and Reckless Attack advantage are represented as feature state/reminder cards, not inline roll modifiers yet.
- Frenzy does not yet track exhaustion or distinguish the turn Rage was entered.
- Deflect Missiles does not yet automate the optional Ki throw-back attack after reducing damage to 0.
- Sneak Attack and Stunning Strike are on-hit cards rather than inline weapon attack riders.
- War Caster does not yet provide spell selection for the opportunity spell.
- Great Weapon Master heavy attack applies the -5 attack roll but does not yet attach +10 damage to a specific weapon damage roll.

### Manual Test Checklist

1. Import or simulate a Barbarian with Rage, Reckless Attack, and Frenzy; confirm Rage appears as a bonus action, Reckless Attack appears under Free, and Frenzy is unavailable until Rage is active.
2. Import or simulate a level 5 Monk with Ki; confirm Deflect Missiles, Slow Fall, and Stunning Strike show the correct reaction/resource behavior and calculated values.
3. Import or simulate a level 5 Rogue; confirm Sneak Attack rolls 3d6 once per turn and Uncanny Dodge appears as a reaction.
4. Import or simulate feats War Caster, Great Weapon Master, Polearm Master, and Shield Master; confirm their new reaction/free/action reminders and prerequisite checks appear.

### Verification Completed

- `node --check js\player-combat\rules\advancedFeatureActions.js`
- `node --check js\player-combat\rules\combatOptionsService.js`
- `node --check js\player-combat\core\stateManager.js`
- `node --check tests\playerCombatActions.test.mjs`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file is under 500 lines; largest file is `js/player-combat/ui/actionTabs.js` at 483 lines.

### Next Recommended Phase

Turn the new on-hit/reminder cards into inline attack and spell riders where useful: Rage damage, Reckless Attack advantage, Sneak Attack eligibility, Stunning Strike, Great Weapon Master +10 damage, and War Caster spell selection.

## Previous Session: PDF Importer Refactor

### Implemented

- Split the oversized `ddbPdfImporterAdapter.js` into focused importer modules:
  - `ddbPdfImporterAdapter.js` now only owns the public import API and high-level flow.
  - `pdfTextExtractor.js` decodes PDF bytes and inflates FlateDecode streams.
  - `pdfFormFieldExtractor.js` extracts fillable PDF `/T` and `/V` form-field values.
  - `pdfFieldUtils.js` contains shared field lookup, cleanup, and field-name normalization helpers.
  - `pdfFeatureExtractor.js` parses D&D Beyond-style feature/action blocks from extracted PDF fields.
  - `pdfCharacterInputBuilder.js` maps extracted fields into the existing normalizer input shape.
- Preserved existing PDF import behavior for fillable fields, weapon rows, spells, spell slots, and feature blocks.
- Tightened PDF feature heading cleanup to strip source tags such as `PHB-2024 130` and `TCoE` so imported feature names still match rules data after the split.

### Files Changed

- `js/player-combat/importers/ddbPdfImporterAdapter.js`
- `js/player-combat/importers/pdfCharacterInputBuilder.js`
- `js/player-combat/importers/pdfFeatureExtractor.js`
- `js/player-combat/importers/pdfFieldUtils.js`
- `js/player-combat/importers/pdfFormFieldExtractor.js`
- `js/player-combat/importers/pdfTextExtractor.js`
- `docs/development-plan.md`

### Known Limitations

- PDF import remains best-effort and supports fillable form fields only; scanned or flattened sheets are still unsupported.
- Feature parsing still depends on recognizable D&D Beyond/WotC field names and text layout.
- Limited-use resources embedded in PDF action text are still not converted into spendable resources.

### Manual Test Checklist

1. Upload a fillable D&D Beyond or WotC character sheet PDF and confirm import succeeds with best-effort warnings.
2. Confirm extracted weapons, spells, spell slots, class/race/feat text, and generic feature blocks still appear after normalization.
3. Import an example rogue PDF and confirm Cunning Action, Steady Aim, and Uncanny Dodge produce combat options.
4. Upload a flattened or scanned PDF and confirm the unsupported message appears inline.

### Verification Completed

- `node --check js\player-combat\importers\ddbPdfImporterAdapter.js`
- `node --check js\player-combat\importers\pdfCharacterInputBuilder.js`
- `node --check js\player-combat\importers\pdfFeatureExtractor.js`
- `node --check js\player-combat\importers\pdfFormFieldExtractor.js`
- `node --check js\player-combat\importers\pdfFieldUtils.js`
- `node --check js\player-combat\importers\pdfTextExtractor.js`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file is under 500 lines; largest file is `js/player-combat/ui/actionTabs.js` at 483 lines.

### Next Recommended Phase

Continue moving the next set of action-affecting features from reminder cards into dedicated rules: Reckless Attack, Rage/Frenzy state, Deflect Missiles, Slow Fall, Stunning Strike, Sneak Attack, metamagic, and War Caster opportunity spell casting.

## Previous Session: Highest-Impact Feature Gaps

### Implemented

- Added dedicated high-impact feature rules for:
  - Action Surge: resource-aware extra-action control that clears action use and marks Action Surge used.
  - Wild Shape: resource-aware action, with Circle of the Moon using a bonus action.
  - Divine Smite: on-hit spell-slot resource option using the lowest available slot and rolling radiant damage.
  - Patient Defense and Step of the Wind: Ki/Focus-spending Monk bonus actions.
  - Polearm Master, Shield Master, Great Weapon Master, and Telekinetic: common feat bonus-action options with prerequisites, warnings, or rolls.
- Added shared feature rule helpers for feature detection, class levels, subclass checks, resources, spell-slot availability, and ability modifiers.
- Added movement rules for Fast Movement, Unarmored Movement, Mobile, Squat Nimbleness, and Fleet of Foot.
- Inferred missing Action Surge and Wild Shape resources during normalization, similar to the existing inferred Monk Ki resource.
- Prevented generic feature parsing from duplicating dedicated feature cards for the newly handled high-impact features.
- Extended spell-slot resource availability checks so non-spell feature options can spend spell slots.

### Files Changed

- `js/player-combat/core/stateManager.js`
- `js/player-combat/models/combatStateModel.js`
- `js/player-combat/normalizers/characterNormalizer.js`
- `js/player-combat/rules/actionEconomyRules.js`
- `js/player-combat/rules/basicActions.js`
- `js/player-combat/rules/combatOptionsService.js`
- `js/player-combat/rules/featureActions.js`
- `js/player-combat/rules/featureRuleHelpers.js`
- `js/player-combat/rules/highImpactFeatureActions.js`
- `js/player-combat/rules/movementRules.js`
- `tests/playerCombatActions.test.mjs`
- `docs/feature-implementation-plan.md`
- `docs/development-plan.md`

### Known Limitations

- Divine Smite is implemented as a resource-aware on-hit feature card, not yet as an inline rider attached to each melee weapon attack.
- Wild Shape tracks that the character entered Wild Shape but does not yet provide beast form selection or form stat replacement.
- Great Weapon Master exposes the conditional bonus attack and reminder text, but the -5/+10 attack mode is not yet an inline weapon attack toggle.
- Polearm Master includes the bonus haft attack; the expanded opportunity attack trigger is still a reminder.
- Shield Master includes the bonus shove; Dexterity save automation remains future work.
- `ddbPdfImporterAdapter.js` is an existing 515-line file and should be split in a future importer cleanup pass.

### Manual Test Checklist

1. Import or simulate a Fighter with Action Surge, use an action, then use Action Surge and confirm action availability is restored and the Action Surge resource is spent.
2. Import or simulate a Druid with Wild Shape and confirm normal druids use an action while Circle of the Moon druids use a bonus action.
3. Import or simulate a Paladin with spell slots and Divine Smite; spend lower-level slots and confirm Smite uses the next available slot.
4. Import or simulate a Monk with Ki and confirm Patient Defense, Step of the Wind: Dash, and Step of the Wind: Disengage spend Ki and bonus action.
5. Import or simulate characters with Polearm Master, Shield Master, Great Weapon Master, Telekinetic, Mobile, and Fast Movement; confirm the expected bonus cards and movement speed changes.

### Verification Completed

- `node --check js\player-combat\rules\highImpactFeatureActions.js`
- `node --check js\player-combat\rules\movementRules.js`
- `node --check js\player-combat\rules\featureRuleHelpers.js`
- `node --check js\player-combat\core\stateManager.js`
- `node --check tests\playerCombatActions.test.mjs`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.

### Next Recommended Phase

Move the next set of action-affecting features from reminder cards into dedicated rules: Reckless Attack, Rage/Frenzy state, Deflect Missiles, Slow Fall, Stunning Strike, Sneak Attack, metamagic, and War Caster opportunity spell casting.

## Previous Session: Source Feature Audit

### Implemented

- Audited action-affecting class, race, and feat features from:
  - `data/classes.json`
  - `data/races.json`
  - `data/feats.json`
- Compared the source-data features against current parser and rules coverage:
  - Generic feature action parsing.
  - Extra Attack attack-count rules.
  - Monk Martial Arts and Flurry of Blows rules.
  - Spell action generation from imported character spell data.
- Created a focused missing-feature plan with descriptions and implementation steps.

### Files Changed

- `docs/feature-implementation-plan.md`
- `docs/development-plan.md`

### Known Limitations

- This session documents missing and partial support; it does not implement the missing feature rules.
- The audit treats generic parsed reminder cards as partial coverage when the feature needs resource spending, conditional triggers, roll changes, movement changes, or stateful effects.
- Spellcasting class features are considered covered only when the imported character spell data already includes the granted spells.
- The current source feature parser only indexes class entries under `Class Features`; subclass-adjacent sections such as `Martial Archetypes`, `Sacred Oaths`, `Eldritch Invocations`, and `Arcane Traditions` need expanded traversal.

### Manual Test Checklist

1. Review `docs/feature-implementation-plan.md` and confirm the feature list matches the desired app scope.
2. Use the plan to prioritize dedicated rules for Action Surge, Wild Shape, Divine Smite, Metamagic, speed modifiers, and feat-based bonus/reaction attacks.
3. For each future feature implementation, add targeted tests to `tests/playerCombatActions.test.mjs` or a focused feature test file.

### Verification Completed

- Parsed `data/classes.json`, `data/races.json`, and `data/feats.json` locally with BOM handling.
- Confirmed current parser finds 52 direct action-economy source features.
- Confirmed the parser produces entries without usable cards for source features that grant actions but do not state a direct cost, including Charger and Dwarf Fortitude.
- Confirmed subclass-adjacent class sections contain additional action-affecting features that are not currently indexed by the parser.

### Next Recommended Phase

Implement the highest-impact missing rules first: Action Surge, Patient Defense, Step of the Wind, Divine Smite, Wild Shape, Metamagic, Polearm Master, Great Weapon Master, Shield Master, and race/feat speed modifiers.

## Previous Session: Player Combat Assistant Monk Attacks and Ki Tracking

### Implemented

- Weapon attack options now carry the computed number of attacks granted by `Extra Attack` and related imported feature text.
- Attack rows show whether the Attack action grants one or multiple attacks.
- Grapple and Shove now clarify that they replace one attack from the Attack action, including multi-attack cases.
- Added focused Monk combat options:
  - `Martial Arts: Unarmed Strike` appears as a bonus-action option after the Attack action has been taken.
  - `Flurry of Blows` appears as a bonus-action option after the Attack action and spends 1 tracked Ki/Focus-style class resource.
- Added `turn.attackActionUsed` to distinguish taking the Attack action from using any other action.
- Added generic class-resource spending through `useCombatOption`, so feature options can spend tracked resources the same way spells spend slots.
- Added class-resource availability checks so Ki-spending options become unavailable when no uses remain.
- The normalizer now infers a Monk `Ki` resource for level 2+ Monks when imported class-resource data is missing.

### Files Changed

- `js/player-combat/core/stateManager.js`
- `js/player-combat/models/combatStateModel.js`
- `js/player-combat/normalizers/characterNormalizer.js`
- `js/player-combat/rules/actionEconomyRules.js`
- `js/player-combat/rules/combatOptionsService.js`
- `js/player-combat/rules/monkActions.js`
- `js/player-combat/rules/weaponActions.js`
- `tests/playerCombatActions.test.mjs`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Martial Arts and Flurry of Blows depend on `turn.attackActionUsed`; the app does not yet verify that the Attack action specifically used an unarmed strike or monk weapon.
- Flurry of Blows rolls show the reusable attack and damage buttons once; the UI does not yet duplicate the buttons into two separate strike rows.
- Monk weapon qualification, armor/shield restrictions, magic bonuses, subclass riders, and 2024-specific naming beyond Ki/Focus-style resource matching remain future work.
- One existing unrelated importer file is over the 500-line guideline and should be split in a future importer cleanup pass.

### Manual Test Checklist

1. Import or simulate a character with `Extra Attack` and confirm weapon, unarmed, grapple, and shove attack rows mention the number of attacks in the Attack action.
2. Import or simulate a level 2+ Monk with no explicit resource data and confirm `Ki` appears in Limited Resources with max equal to Monk level.
3. Before taking the Attack action, confirm `Martial Arts: Unarmed Strike` and `Flurry of Blows` are unavailable with a clear reason.
4. Use a weapon or unarmed Attack action and confirm Monk bonus options become available when a bonus action remains.
5. Use `Flurry of Blows` and confirm bonus action is spent and Ki used increases by 1.
6. Spend all Ki and confirm `Flurry of Blows` is unavailable while non-Ki options remain unaffected.
7. Take a short rest and confirm Ki resets if its reset text is `Short Rest`.

### Verification Completed

- `node --check js\player-combat\rules\monkActions.js`
- `node --check js\player-combat\rules\weaponActions.js`
- `node --check js\player-combat\rules\actionEconomyRules.js`
- `node --check js\player-combat\core\stateManager.js`
- `node --check js\player-combat\normalizers\characterNormalizer.js`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.

### Next Recommended Phase

Add a compact attack-use UI that lets a player track individual attacks inside a single Attack action, including Flurry's two unarmed strikes and future features such as Action Surge or Haste.

## Previous Session: Player Combat Assistant Spell Cast Rules and Concentration UI

### Implemented

- Added a thin concentration column between spell action type and spell name in the Spells table.
- Concentration spells now show a compact `C` badge with an accessible label and tooltip.
- Casting a concentration spell automatically sets concentration active and stores that the concentration came from a spell.
- Manually toggled concentration is still supported and is tracked separately from spell-set concentration.
- If concentration is already active and the player casts a concentration spell, the existing custom modal warns before replacing concentration.
- If concentration came from a spell cast, the warning names the current concentration spell.
- Cantrips continue to get `Cast` buttons and now have test coverage confirming their action type is spent when cast.
- Casting any spell now updates the matching action economy state through the existing cast path:
  - Action spells mark action used.
  - Bonus-action spells mark bonus action used.
  - Reaction spells mark reaction used.
- Casting a leveled spell records the spell name in turn state.
- If the player attempts to cast another leveled spell in the same turn, a custom modal warns and the second leveled spell is not cast.

### Files Changed

- `css/player-combat.css`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/models/combatStateModel.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/spellcastingBar.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- The leveled-spell restriction is implemented as a simple one-leveled-spell-per-turn guard per request. It does not yet model every official exception or table-specific interpretation.
- The concentration badge is intentionally compact; expanded spell details still carry the full duration/concentration text.
- The second-leveled-spell warning is enforced from the UI cast path. Direct test/helper calls into `stateManager.useCombatOption` can still bypass UI warnings.

### Manual Test Checklist

1. Import a spellcaster with cantrips, leveled spells, and at least one concentration spell.
2. Open the Spells tab and confirm the first columns are `Action Type`, `C`, and `Spell`.
3. Confirm concentration spells show a small `C` badge and non-concentration spells leave the column blank.
4. Cast a concentration spell and confirm the concentration status becomes active.
5. Cast another concentration spell while concentrating and confirm the custom replacement modal names the current spell when it was set by spell casting.
6. Cast an action cantrip and confirm the action state is spent.
7. Cast a bonus-action cantrip and confirm the bonus action state is spent.
8. Cast a leveled spell, then attempt another leveled spell in the same turn and confirm the custom warning appears and the second spell is not cast.

### Verification Completed

- `node --check js\player-combat\ui\actionTabs.js`
- `node --check js\player-combat\core\stateManager.js`
- `node --check js\player-combat\models\combatStateModel.js`
- `node --check js\player-combat\ui\spellcastingBar.js`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `ddbPdfImporterAdapter.js` at 456 lines.

### Next Recommended Phase

Add targeted browser smoke coverage for the Spells table to assert the concentration badge column and modal warning behavior against real DOM rendering.

## Previous Session: Player Combat Assistant Spell Action Type Fix

### Implemented

- Fixed spell action-type detection for compact PDF/D&D Beyond casting-time abbreviations:
  - `1A` now maps to Action.
  - `1BA` now maps to Bonus.
  - `1R` now maps to Reaction.
  - Values such as `1A + 10m` now still map to Action.
- Renamed the Spells table first column from `Action` to `Action Type` so it is clear the column shows the spell's casting action economy, not an action button.
- Added regression coverage for compact spell casting-time values so imported PDF spells no longer fall through to `Special`.

### Files Changed

- `js/player-combat/rules/spellActions.js`
- `js/player-combat/ui/actionTabs.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Unusual casting times that are not action, bonus action, or reaction still display as Special.
- Ritual timing is still represented as Action when the imported value is like `1A + 10m`; the extra ritual time remains in the spell metadata rather than becoming a separate action type.

### Manual Test Checklist

1. Import a PDF sheet with spells using compact casting-time values such as `1A` and `1BA`.
2. Open the Spells tab and confirm the first column is `Action Type`.
3. Confirm normal action spells display Action, bonus-action spells display Bonus, and reaction spells display Reaction.
4. Confirm bonus-action spells also appear in the Bonus tab and reaction spells also appear in the Reaction tab.

### Verification Completed

- `node --check js\player-combat\rules\spellActions.js`
- `node --check js\player-combat\ui\actionTabs.js`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `ddbPdfImporterAdapter.js` at 456 lines.

### Next Recommended Phase

Complete the rest of the spells-tab review once the second requested item is provided.

## Previous Session: Player Combat Assistant Reaction Defaults and Readied Actions

### Implemented

- Added `Opportunity Attack` as a default Reaction option for all characters.
- Added readied-action state tracking to combat state with `turn.readiedAction`.
- Using the basic `Ready` action now marks the action used and records that a readied action is pending.
- When a readied action is pending, the Reaction tab includes `Use Readied Action`.
- `Use Readied Action` spends the reaction and clears the pending readied action.
- Ending the turn preserves a pending readied action, so it remains available as a reaction after the player's turn.
- Starting the next turn clears any unused pending readied action.
- Reaction availability uses the existing action economy rules, so Opportunity Attack and Use Readied Action become unavailable once the reaction is spent.

### Files Changed

- `js/player-combat/rules/basicActions.js`
- `js/player-combat/rules/combatOptionsService.js`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/models/combatStateModel.js`
- `tests/playerCombatActions.test.mjs`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- The app does not yet prompt for the readied trigger or readied response details.
- `Use Readied Action` is a generic reaction entry; it does not replay the exact action, spell, or attack that was readied.
- Concentration requirements for readying a spell are not automated yet.

### Manual Test Checklist

1. Import or load any character and confirm the Reaction tab includes `Opportunity Attack`.
2. Use `Ready` from the Actions tab and confirm Action is marked used.
3. Confirm the Reaction tab now includes `Use Readied Action`.
4. End the turn and confirm `Use Readied Action` is still available if the reaction has not been spent.
5. Use `Use Readied Action` and confirm Reaction is marked used and the readied action option disappears.
6. Ready an action but do not use it, then start the next turn and confirm the pending readied action is cleared.

### Verification Completed

- `node --check js\player-combat\rules\basicActions.js`
- `node --check js\player-combat\rules\combatOptionsService.js`
- `node --check js\player-combat\core\stateManager.js`
- `node --check js\player-combat\models\combatStateModel.js`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `ddbPdfImporterAdapter.js` at 456 lines.

### Next Recommended Phase

Add a small Ready Action detail modal so a player can record the trigger and chosen response, then display that text on the `Use Readied Action` reaction row.

## Previous Session: Player Combat Assistant PDF Feature Import Mapping

### Implemented

- Fixed PDF import so applicable feature/action data from D&D Beyond-style fillable sheets is actually normalized into the character model.
- Added support for D&D Beyond PDF fields named `FeaturesTraits1..N` and `Actions1..N`.
- Added PDF Unicode text decoding for UTF-16 form-field values so extracted feature names are readable instead of null-byte text.
- Parsed sectioned PDF feature blocks into normalized feature entries with names and descriptions.
- Stored combined PDF feature/action blocks under `features.other` so imported features can match class, race, feat, or custom feature action metadata.
- Updated parsed feature action matching so generic imported features can resolve against class, race, or feat reference entries.
- Expanded granted-action parsing for D&D Beyond wording such as `following actions as a Bonus Action: Dash, Disengage, or Hide`.
- Verified an example PDF sheet now creates applicable options such as Cunning Action, Steady Aim, and Uncanny Dodge.

### Files Changed

- `js/player-combat/importers/ddbPdfImporterAdapter.js`
- `js/player-combat/data/featureActionParser.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- PDF feature parsing is still best-effort and depends on fillable form fields; scanned or flattened sheets remain unsupported.
- Some D&D Beyond feature descriptions can wrap awkwardly across lines, so long descriptions may be imperfect even when the feature name is captured.
- Imported PDF feature blocks are treated as generic features, then matched by name and parsed text. They are not yet filtered by exact class/subclass/race source.
- Feature resources and limited-use counts embedded in PDF action text are not yet converted into spendable resources.

### Manual Test Checklist

1. Upload `docs/example-sheets/mwokasch_134724530.pdf`.
2. Confirm the imported character has feature-derived Bonus options including Cunning Action: Dash, Cunning Action: Disengage, Cunning Action: Hide, and Steady Aim.
3. Confirm the imported character has a Reaction option for Uncanny Dodge.
4. Upload `docs/example-sheets/mwokasch_159359372.pdf` and confirm Combat Wild Shape appears as a Bonus option.
5. Upload `docs/example-sheets/mwokasch_33709378.pdf` and confirm Summon Wildfire Spirit and War Caster-derived actions appear where applicable.

### Verification Completed

- `node --check js\player-combat\importers\ddbPdfImporterAdapter.js`
- `node --check js\player-combat\data\featureActionParser.js`
- `node --test tests\playerCombatImport.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `ddbPdfImporterAdapter.js` at 456 lines.

### Next Recommended Phase

Add parsing for PDF limited-use/resource text so feature actions like Wild Shape, Bardic Inspiration, Ki options, and subclass resources can show remaining uses and spend the correct tracked resource.

## Previous Session: Player Combat Assistant Reference Feature Action Parser

### Implemented

- Added a dedicated reference-data parser for action-bearing class features, feats, and racial traits from:
  - `data/classes.json`
  - `data/feats.json`
  - `data/races.json`
- The reference data transform now exposes:
  - `featureActions`, a flat parsed list of features with action metadata.
  - `indexes.featureActionIndexByName`, a lookup map for feature names.
  - `counts.featureActions`, the number of parsed action-bearing reference features.
- Parsed metadata captures action economy costs (`action`, `bonus`, `reaction`), granted standard actions such as Dash/Disengage/Hide, source type, source name, path, and a short summary.
- Feature UI option generation now reads parsed reference metadata before falling back to parsing imported custom feature text.
- Added suffix matching for reference names such as `Channel Divinity: Turn Undead` when a character import only lists `Turn Undead`.
- Tightened granted-action parsing so target-only text such as Turn Undead's affected creature using Dash/Dodge does not create bogus player options.
- Added focused tests using the real class, feat, and race JSON files.

### Files Changed

- `js/player-combat/data/combatDataTransformer.js`
- `js/player-combat/data/featureActionParser.js`
- `js/player-combat/rules/featureActions.js`
- `tests/playerCombatActions.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- The parser classifies clear action economy hooks, but it does not yet enforce prerequisites, resource consumption, target validity, subclass selection, or feature-specific save/roll formulas.
- The parser still depends on conservative text patterns. Unusual wording may need future override metadata.
- Parsed feature actions only appear for features present on the imported character; class level alone still does not invent missing features.
- Some feature names are duplicated across classes/subclasses. The current index preserves all matches and filters by feature type, but it does not yet filter by the character's specific class/subclass source.

### Manual Test Checklist

1. Import or simulate a character with `Cunning Action` and confirm Bonus includes Dash, Disengage, and Hide.
2. Import or simulate a character with `Breath Weapon` and confirm it appears under Actions.
3. Import or simulate a character with `Defensive Duelist` and confirm it appears under Reaction.
4. Import or simulate a character with `Turn Undead` and confirm the player gets a Turn Undead action, not Turn Undead: Dash or Turn Undead: Dodge.
5. At phone width, confirm parsed feature rows render in the same reusable option table layout as other actions.

### Verification Completed

- `node --check js\player-combat\data\featureActionParser.js`
- `node --check js\player-combat\data\combatDataTransformer.js`
- `node --check js\player-combat\rules\featureActions.js`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `actionTabs.js` at 398 lines.

### Next Recommended Phase

Add a small override file for parsed feature actions so high-value edge cases can be corrected without adding named special cases to the parser.

## Previous Session: Player Combat Assistant Feature Action Audit

### Implemented

- Added a focused feature-data enrichment module that treats imported character features as the source of truth.
- Class, race, feat, and other imported feature names are now enriched from SRD/reference data when the import only provides the feature name.
- Added generic action economy classification from feature text:
  - Features that say they use an action, bonus action, or reaction are placed into the matching option group.
  - Features that grant standard actions such as Dash, Disengage, Hide, Dodge, Search, Help, or Use an Object create specific options for those actions.
  - Rogue Cunning Action now appears from imported `Cunning Action` plus SRD text, not from Rogue level alone.
- Added conservative description scanning for imported class/race/feat text that says a feature uses an action, bonus action, or reaction.
- Feature text that clearly contains more than one action economy hook now emits separate options, so feats with both a bonus action and reaction do not collapse into one category.
- Wired feature-derived options into the existing combat option pipeline and action economy availability checks.
- Extra Attack now derives attack count from imported feature names and enriched SRD text, including higher `Extra Attack (2)`/`(3)` feature names when imported.
- Expanded spell casting-time normalization for additional D&D Beyond-style activation object shapes so bonus-action and reaction spells sort into the Bonus and Reaction tabs more reliably.
- Added focused tests for imported Rogue Cunning Action with SRD enrichment, non-inference from class level alone, class/race/feat action extraction, multi-hook feat text, Extra Attack classification, and object-shaped spell activation sorting.

### Files Changed

- `js/player-combat/rules/actionEconomyRules.js`
- `js/player-combat/rules/attackCountRules.js`
- `js/player-combat/rules/combatOptionsService.js`
- `js/player-combat/rules/featureActions.js`
- `js/player-combat/rules/featureData.js`
- `js/player-combat/rules/spellActions.js`
- `js/player-combat/ui/turnEconomyPanel.js`
- `tests/playerCombatActions.test.mjs`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Feature extraction is intentionally conservative. It surfaces clear action economy hooks, but it does not fully automate prerequisites, target validation, subclass choices, advantage/disadvantage, or resource spending for every feature.
- The app no longer invents feature actions from class level alone. If an import omits a granted feature entirely, that feature will not appear until normalization/import coverage supplies it.
- Generic text scanning may produce reminder-style options when a feature description is clear, but ambiguous feature effects may still need override metadata later.
- Spell sorting depends on imported spell casting-time or activation metadata, with SRD reference fallback when a spell name can be matched.

### Manual Test Checklist

1. Import or simulate a character whose imported class features include `Cunning Action` and confirm Bonus includes Cunning Action: Dash, Disengage, and Hide.
2. Use one Cunning Action option and confirm the bonus action is marked used and other bonus options become unavailable.
3. Import or simulate a level 2+ Rogue without an imported `Cunning Action` feature and confirm the app does not invent Cunning Action from level alone.
4. Import a character with a reaction feature or feat such as Uncanny Dodge or Defensive Duelist and confirm it appears in Reaction.
5. Import a character with an imported `Extra Attack` feature and confirm the Action progress and attack descriptions reflect multiple attacks.
6. Import a spellcaster with Healing Word or Misty Step and confirm the spell appears in both Spells and Bonus.
7. Import a spellcaster with Shield or another reaction spell and confirm the spell appears in both Spells and Reaction.
8. At phone width, confirm the Bonus and Reaction tables remain readable and action buttons do not overlap.

### Verification Completed

- `node --check js\player-combat\rules\featureActions.js`
- `node --check js\player-combat\rules\featureData.js`
- `node --check js\player-combat\rules\attackCountRules.js`
- `node --check js\player-combat\rules\combatOptionsService.js`
- `node --check js\player-combat\rules\spellActions.js`
- `node --test tests\playerCombatActions.test.mjs`
- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html css tests` returned no matches.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `actionTabs.js` at 444 lines.

### Next Recommended Phase

Add a small feature override data file for class, race, and feat action metadata so future edge cases can be corrected without expanding named rules in code.

## Previous Session: Player Combat Assistant Table-Based Action Layout

### Implemented

- Reworked combat option rendering to use a shared data-table structure for option groups.
- Fixed the turn progress rail to the top of the browser while a character is loaded.
- Simplified turn progress cards into one horizontal line: Action, Bonus Action, Reaction, Free, Movement, and Done.
- Embedded the `+` movement control inside the Movement progress card.
- Removed the now-redundant Combat State panel from the main page.
- Removed the latest-roll dice result panel from the action tabs now that roll results appear as toast notifications.
- Added a Dice Log button to the right of Done in the turn progress rail:
  - Opens a custom modal with roll-only combat log entries.
  - New roll log entries are tagged with structured roll data while old roll-summary messages still display through fallback matching.
- Removed second-line detail text from turn progress cards and left a partial-progress display hook for multi-use action economy.
- Simplified the spellcasting bar:
  - Concentration is now a lit/unlit toggle instead of repeating the active spell name.
  - Slot buttons show only the slot level number and used-slot check marks.
  - Concentration toggle updates combat state directly instead of opening the Spells tab.
- Added a fixed action-category bar directly beneath the spellcasting bar:
  - Includes Recommendation, Attacks, Actions, Spells, Bonus, Free, and Reaction.
  - Replaces the action panel's embedded button row.
  - The action panel heading is visually hidden instead of shown as chrome.
- Added an `Attacks` tab so weapon attacks, unarmed strike, grapple, and shove are separate from standard combat actions.
- Removed the synthetic Attack and Cast a Spell rows from the Actions group because those workflows are covered by the Attacks and Spells tabs.
- Moved option type badges into the first table column instead of placing them beneath option names.
- Updated the movement row to show a compact `current of max remaining` description and a `+5 ft` action button.
- Reworked the Attacks tab into attack-specific columns:
  - Type badge.
  - Attack name.
  - Attack bonus with an icon roll button.
  - Damage dice with an icon roll button and tooltip damage-type icon.
  - Click-to-expand second row for attack descriptions, warnings, and unavailable reasons.
- Roll buttons now show the roll summary through the existing toast system while still logging the roll.
- Spell rows now expand on click and render a player-combat-owned spell detail card inspired by the SRD hover-card reference pattern.
- Updated the Spells table first column from generic Type to casting economy: Action, Bonus, or Reaction.
- Added test coverage confirming casting a leveled action spell spends a spell slot and marks the action used.
- Fixed spell casting-time normalization for D&D Beyond-style activation objects and numeric activation codes so spells no longer fall through to `Special` when they are actions, bonus actions, or reactions.
- Added Range and DC columns to the Spells table.
- Removed the Description column from the Spells table; clicking a spell row expands the player-combat spell detail card with the full SRD/imported spell description.
- Bonus-action and reaction spells now also appear in the Bonus and Reaction tabs.
- Confirmed cantrips still show a Cast button and consume the correct action economy without spending spell slots.
- Kept the `Actions` tab focused on standard non-attack, non-spell choices: Dash, Disengage, Dodge, Help, Hide, Ready, Search, Object Interaction, and Use an Object.
- Added a Reaction tab so the existing turn progress reaction segment has a matching option group.
- Added reusable table CSS that preserves existing buttons, badges, spacing, colors, and unavailable-state styling.

### Files Changed

- `css/player-combat.css`
- `js/player-combat/app.js`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/models/combatStateModel.js`
- `js/player-combat/rules/actionEconomyRules.js`
- `js/player-combat/rules/basicActions.js`
- `js/player-combat/rules/combatOptionsService.js`
- `js/player-combat/rules/spellActions.js`
- `js/player-combat/rules/weaponActions.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/diceResult.js`
- `js/player-combat/ui/spellDetailCard.js`
- `js/player-combat/ui/spellcastingBar.js`
- `js/player-combat/ui/turnEconomyPanel.js`
- `index.html`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- The Attacks tab includes simple unarmed, grapple, and shove rows, but it does not yet automate target size, contested checks, advantage, or monster-specific edge cases.
- Cast a Spell filters by the rules layer's parsed casting-time cost; unusual imported casting-time text may still need normalization improvements.
- Mobile widths use horizontal table scrolling to preserve the denser table structure.
- Damage type icons use compact letter markers with native browser tooltips; a richer icon set can replace them if the app adopts one.
- Multi-use action economy currently has a rendering hook for partial progress, but the state model still tracks action, bonus action, reaction, and free action as booleans.
- The Dice Log is currently backed by the capped combat log, so it shows the latest retained roll entries rather than an unlimited roll history.

### Manual Test Checklist

1. Serve the project from the repo root and open `/`.
2. Import a character with at least one weapon and at least one spell.
3. Open Actions and confirm options render in a table with Type, Action Name, Description, and Action Buttons columns.
4. Confirm the fixed action-category bar appears beneath the spellcasting bar with Recommendation, Attacks, Actions, Spells, Bonus, Free, and Reaction.
5. Confirm the action panel has no visible panel header or embedded button row.
6. Confirm Actions does not include Attack or Cast a Spell rows.
7. Confirm weapon attacks, Unarmed Strike, Grapple, and Shove render with Type, Attack, Attack Bonus, and Damage Dice columns.
8. Click attack and damage icon buttons and confirm roll summaries appear as toast notifications.
9. Click an attack row and confirm the hidden description row expands.
10. Confirm the Spells table first column is `Action` and rows show Action, Bonus, or Reaction instead of Special for normal casting times.
11. Confirm the Spells table includes Range and DC columns and no Description column.
12. Click a spell row and confirm the spell detail card expands with the full spell description.
13. Confirm bonus-action and reaction spells appear in the Bonus and Reaction tabs.
14. Cast a leveled action spell and confirm one slot is checked off and Action is marked used.
15. Cast a cantrip and confirm it has a Cast button, marks the right action economy used, and does not spend a spell slot.
16. Use the Move row `+5 ft` button and confirm movement changes by 5 ft.
17. Scroll the page and confirm the turn progress rail remains fixed at the top of the browser.
18. Confirm the turn progress rail shows Dice Log immediately to the right of Done.
19. Roll attack or damage, confirm the toast appears, then open Dice Log and confirm the roll appears there.
20. Confirm the Combat State panel no longer appears on the page.
21. Confirm the latest-roll dice result panel no longer appears above action tabs.
22. Confirm the turn progress rail stays one horizontal row on phone width and the Movement card contains its `+` button.
23. Toggle Concentration in the spellcasting bar and confirm it lights up, then click again and confirm it clears.
24. Confirm spell slot buttons show only the level number and check marks for used slots.
25. Use Dash or Dodge and confirm the row spends the action and unavailable reasons appear.
26. At phone width, confirm the table remains usable with horizontal scrolling and no overlapping text.

### Verification Completed

- `node --check js\player-combat\ui\actionTabs.js`
- `node --check js\player-combat\rules\basicActions.js`
- `node --check js\player-combat\rules\combatOptionsService.js`
- `node --check js\player-combat\rules\spellActions.js`
- `node --check js\player-combat\rules\weaponActions.js`
- `node --check js\player-combat\app.js`
- `node --check js\player-combat\core\stateManager.js`
- `node --check js\player-combat\models\combatStateModel.js`
- `node --check js\player-combat\ui\spellcastingBar.js`
- `node --check js\player-combat\ui\turnEconomyPanel.js`
- `node --test tests\playerCombatImport.test.mjs`

### Next Recommended Phase

Add browser smoke coverage for tab navigation and table rendering, then refine the Attacks tab with class-feature attack variants as those rules are implemented.

## Previous Session: Player Combat Assistant Header Identity and Spellcasting Bar

### Implemented

- Moved the loaded character identity into the header:
  - When no character is loaded, the app title remains `what would my character do?`.
  - When a character is loaded, the app title collapses to `WWMCD`.
  - Header now shows character name, level, and classes.
- Removed the now-redundant character summary card from the main app layout.
- Added a horizontal spellcasting bar below the turn progress bar for characters with spell slots:
  - Shows `Concentration: [spell]`.
  - Shows spell slot boxes by level, such as `Level 1: [ ] [ ] [ ]`.
  - Used spell slots render with `X`.
  - Fully spent levels are visually muted.
  - Clicking a spell level opens the Spells action group filtered to that level.
  - Clicking Concentration opens the full Spells group.
- Casting a concentration spell now stores the spell name in `combatState.current.concentration`.
- Casting a different concentration spell while already concentrating opens a custom confirmation modal before replacing concentration.
- Removed the detailed Spell Slots card section from the Combat State panel; spell slot status is now shown in the spellcasting bar.
- Added focused test coverage for concentration spell casting updating combat state.

### Files Changed

- `index.html`
- `css/player-combat.css`
- `js/player-combat/app.js`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/combatStatePanel.js`
- `js/player-combat/ui/spellcastingBar.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- The spellcasting bar displays standard spell slots only; pact magic and item charges are not represented there yet.
- Slot boxes are status indicators, not direct manual slot editors.
- Concentration replacement confirmation only triggers for spells the rules layer marks as concentration.
- The app does not yet offer a compact clear-concentration button in the spellcasting bar; concentration can still be edited from the detailed Combat State panel.

### Manual Test Checklist

1. Serve the project from the repo root and open `/`.
2. Confirm the full app title appears before importing a character.
3. Import a character and confirm the header title changes to `WWMCD`.
4. Confirm the header shows character name, level, and class list.
5. Confirm the old character summary card is no longer shown.
6. Import a spellcaster with spell slots and confirm the spellcasting bar appears below the turn progress bar.
7. Cast a leveled spell and confirm one slot box for that level changes to `X`.
8. Spend all slots of a level and confirm spell options at that level are unavailable.
9. Click a spell level in the bar and confirm the Spells group opens filtered to that level.
10. Cast a concentration spell and confirm the Concentration area lights up with that spell name.
11. While concentrating, cast another concentration spell and confirm the custom replacement modal appears before casting.

### Verification Completed

- `node --test tests\playerCombatImport.test.mjs`
- `node --check` for every `js/player-combat/**/*.js` file.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `ddbPdfImporterAdapter.js` at 365 lines.
- Searched player app code for `alert(`, `prompt(`, and `confirm(`; no native dialogs are used.
- Served the repo with `python -m http.server` and confirmed `/`, `/data/classes.json`, and `/data/spells.json` return HTTP 200.

### Next Recommended Phase

Add direct compact controls for clearing concentration and manually adjusting spell slots from the spellcasting bar if table use shows the detailed panel is too far away.

## Previous Session: Player Combat Assistant Compact Combat Status Bar

### Implemented

- Added a compact combat status bar immediately below the turn progress bar.
- The new bar shows:
  - Current HP as an editable input with imported max HP displayed beside it.
  - Temporary HP as an editable input.
  - Current AC.
  - Walking speed.
  - Active conditions as removable badges.
  - A `+` condition button.
- Added a condition picker modal from the `+` button:
  - Uses loaded reference-data conditions when available.
  - Falls back to common SRD condition names if reference data has not loaded yet.
  - Adds conditions without duplicates.
- Condition badges include an `x` button that removes the condition directly from combat state.
- HP, temp HP, and condition changes continue to update only `combatState.current` through the existing state manager and storage path.

### Files Changed

- `index.html`
- `css/player-combat.css`
- `js/player-combat/app.js`
- `js/player-combat/ui/combatStatusBar.js`
- `docs/development-plan.md`

### Known Limitations

- The compact status bar displays walking speed only; alternate movement modes are not shown there.
- AC is displayed as read-only in the compact bar; the detailed Combat State panel still edits AC.
- The condition picker is a single-select modal, not a multi-select editor.

### Manual Test Checklist

1. Serve the project from the repo root and open `/`.
2. Import a character and confirm a status bar appears directly below the turn progress bar.
3. Edit HP and temp HP in the compact bar, refresh, and confirm values persist.
4. Confirm AC and walking speed display correctly.
5. Click `+`, select a condition, and confirm it appears as a badge.
6. Add the same condition twice and confirm it is not duplicated.
7. Click a badge `x` and confirm the condition is removed.
8. At mobile width, confirm HP/temp inputs, AC/speed, and condition badges wrap without overlap.

### Verification Completed

- `node --test tests\playerCombatImport.test.mjs`
- `node --check` for every `js/player-combat/**/*.js` file.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `ddbPdfImporterAdapter.js` at 365 lines.
- Searched player app code for `alert(`, `prompt(`, and `confirm(`; no native dialogs are used.
- Served the repo with `python -m http.server` and confirmed `/`, `/data/classes.json`, and `/data/spells.json` return HTTP 200.

### Next Recommended Phase

Consider collapsing or simplifying duplicate HP/temp/condition controls in the detailed Combat State panel now that the compact bar covers the most common at-table edits.

## Previous Session: Player Combat Assistant Header, Import Modal, and Turn Progress Bar

### Implemented

- Removed the top Reference Data card from the app shell while keeping reference data loading active in the background.
- Moved character import into a modal:
  - When no character is loaded, the main screen shows a single `Import Character` button.
  - When a character is loaded, the header shows `Import`, `Short Rest`, and `Long Rest` buttons.
  - JSON upload, PDF upload, and JSON paste continue to use the existing import form inside the modal.
- Replaced the old Turn Economy card with a compact progress bar below the header:
  - `Actions`, `Bonus Action`, `Reaction`, `Free Action`, `Movement x/NN`, and `Done`.
  - Segments start colored and gray out when their tracked turn resource is used.
  - Movement includes a `+` control that adds 5 feet at a time and clamps at walking speed.
  - `Done` ends the current turn through the existing state manager.
  - Clicking a segment opens the matching action group.
- Added a Free Action group backed by `turn.objectInteractionUsed`.
- Added a basic `Object Interaction` option for the free-action segment.
- Added conservative Extra Attack awareness:
  - Fighter level 11/20 shows 3/4 attacks.
  - Any explicit `Extra Attack` feature shows 2 attacks.
  - The action economy remains one Attack action; this only improves labels and descriptions.
- Added focused tests for free-action grouping and inferred multiple attacks.

### Files Changed

- `index.html`
- `css/player-combat.css`
- `js/player-combat/app.js`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/rules/actionEconomyRules.js`
- `js/player-combat/rules/attackCountRules.js`
- `js/player-combat/rules/basicActions.js`
- `js/player-combat/rules/combatOptionsService.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/turnEconomyPanel.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Extra Attack detection is intentionally conservative and does not cover every subclass, monster form, temporary effect, or special attack replacement rule.
- The progress bar tracks action economy usage, not every sub-choice inside an action.
- Movement uses walking speed only and does not incorporate Dash, difficult terrain, prone standing cost automation, or alternate movement modes.
- Free Action currently represents one simple object interaction.
- The import modal stays open after a successful import so warnings remain visible.

### Data Assumptions

- Normalized character features may expose an `Extra Attack` feature by name.
- Fighter class levels are available in `character.classes`.
- Walking speed is available as `character.combat.speed.walk`.
- Turn usage continues to live only in `combatState.turn`.

### Manual Test Checklist

1. Serve the project from the repo root and open `/`.
2. Confirm the Reference Data card is no longer visible.
3. With no character loaded, confirm the page shows one `Import Character` button and opens the import modal.
4. Import a character and confirm the header shows `Import`, `Short Rest`, and `Long Rest`.
5. Confirm the progress bar appears below the header with Actions, Bonus Action, Reaction, Free Action, Movement, and Done.
6. Click each progress segment and confirm the matching action group opens.
7. Use an action, bonus action, reaction, and object interaction, then confirm matching segments gray out.
8. Click the movement `+` button until walking speed is reached and confirm the movement segment grays out without exceeding max speed.
9. Click `Done` and confirm the turn ends.
10. Import or simulate a character with Extra Attack and confirm the Actions segment and Attack option reflect multiple attacks.
11. At mobile width, confirm the header buttons and progress bar wrap without text overlap.

### Verification Completed

- `node --test tests\playerCombatImport.test.mjs`
- `node --check` for every `js/player-combat/**/*.js` file.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `ddbPdfImporterAdapter.js` at 365 lines.
- Searched player app code for `alert(`, `prompt(`, and `confirm(`; no native dialogs are used.
- Served the repo with `python -m http.server` and confirmed `/`, `/data/classes.json`, and `/data/spells.json` return HTTP 200.

### Next Recommended Phase

Add a small Playwright/browser smoke test around the import modal and progress bar interactions, then refine mobile spacing from real screenshots if needed.

## Previous Session: Player Combat Assistant PDF Character Sheet Import

### Implemented

- Replaced the player PDF placeholder with a focused fillable-PDF importer modeled after the `dm-roster` form-field extraction approach.
- Kept the player app independent from `dm-roster` at runtime; the player importer lives in `js/player-combat/importers/ddbPdfImporterAdapter.js`.
- Added PDF upload support to the existing Import Character panel alongside JSON upload and JSON paste.
- Converted extracted PDF form fields into the existing player normalizer input shape so raw PDF data does not leak into UI modules.
- Extracted common fillable sheet fields when present:
  - Name, race, class/level, ability scores, HP, temp HP, AC, speed, proficiency bonus.
  - Weapon rows from `Wpn Name`, damage, and notes fields.
  - Spell headers, slot headers, spell names, prepared flags, casting time, range, duration, notes, and casting ability.
  - Simple feature text fields for class features, racial traits, and feats.
- Added best-effort PDF import warnings to the existing import feedback.
- Added lightweight tests for fillable PDF import and graceful rejection of flattened/no-form-field PDFs.

### Files Changed

- `js/player-combat/importers/ddbPdfImporterAdapter.js`
- `js/player-combat/ui/characterImportPanel.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- PDF import supports fillable form fields only; scanned, image-only, and flattened PDFs are rejected.
- PDF import is best-effort and depends on recognizable D&D Beyond or WotC-style field names.
- PDF parsing does not perform OCR, full text layout extraction, or complex class feature automation.
- Weapon attack bonuses from the PDF are not trusted as rules data; weapon cards still use the existing player weapon rules to calculate attacks from normalized stats.
- Spell parsing remains lightweight and does not handle every PDF spell sheet layout, upcasting, pact magic, or full rules text.
- Limited resource extraction from PDFs is not implemented in this pass.

### Data Assumptions

- Fillable PDFs store useful values in `/T` field-name and `/V` value entries, sometimes inside FlateDecode streams.
- Class level text appears in fields such as `CLASS LEVEL` or `ClassLevel`, using simple values like `Cleric 3`.
- D&D Beyond-style spell fields use names such as `spellHeader1`, `spellSlotHeader1`, `spellName1`, and related metadata fields.
- Weapon rows use fields such as `Wpn Name`, `Wpn1 Damage`, and `Wpn Notes 1`.

### Manual Test Checklist

1. Serve the project from the repo root and open `/`.
2. Upload a fillable D&D Beyond or WotC character sheet PDF.
3. Confirm import feedback shows best-effort PDF warnings instead of native dialogs.
4. Confirm the character summary shows name, class, race, HP, AC, speed, and ability-derived values.
5. If the PDF has weapon rows, confirm weapon action cards appear and can roll attack/damage.
6. If the PDF has spell sheet fields, confirm spell cards and spell slot controls appear where fields are recognized.
7. Refresh and confirm the imported PDF character persists through local storage.
8. Upload a flattened or scanned PDF and confirm a clear inline unsupported message appears.
9. At mobile width, confirm the import panel remains usable with JSON and PDF controls.

### Verification Completed

- `node --test tests\playerCombatImport.test.mjs`
- `node --check` for every `js/player-combat/**/*.js` file.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `ddbPdfImporterAdapter.js` at 365 lines.
- Searched player app code for `alert(`, `prompt(`, and `confirm(`; no native dialogs are used.
- Served the repo with `python -m http.server` and confirmed `/`, `/data/classes.json`, and `/data/spells.json` return HTTP 200.

### Next Recommended Phase

Exercise the PDF importer against real exported sheets and add narrow field mappings for missed common fields, especially limited resources and alternate spell slot layouts.

## Previous Session: Player Combat Assistant Rest Reset Helper Layer

### Implemented

- Added manual Short Rest and Long Rest controls to the Turn Economy panel.
- Added a focused rest rules helper for tracked resource resets:
  - Short Rest resets only limited resources whose normalized reset text clearly names short rest.
  - Long Rest resets tracked spell slot usage and tracked limited resource usage.
  - Vague reset text such as `Rest` is not treated as short-rest eligible.
- Preserved imported character resource definitions; rest buttons only update `combatState.resourcesUsed`.
- Added combat log entries for Short Rest and Long Rest reset actions.
- Added lightweight tests for short-rest filtering, long-rest reset behavior, conservative reset-text detection, log entries, and preserving imported resource definitions.

### Files Changed

- `js/player-combat/rules/restRules.js`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/ui/turnEconomyPanel.js`
- `tests/playerCombatImport.test.mjs`
- `docs/development-plan.md`

### Known Limitations

- Rest controls do not automate class-specific feature behavior, hit dice, HP recovery, exhaustion, pact magic, item charges, wild shape, or spell preparation.
- Short Rest depends on normalized reset display text and does not infer feature rules from class names or feature descriptions.
- Long Rest does not recalculate resource maximums; it only clears tracked usage maps.
- Rest controls do not currently ask for confirmation.

### Data Assumptions

- Normalized limited resources use `resource.reset` for display text such as `Short Rest`, `Short or Long Rest`, or `Long Rest`.
- `combatState.resourcesUsed.spellSlots` is the only tracked spell slot usage map.
- `combatState.resourcesUsed.classResources` is the shared tracked usage map for class resources and limited-use feature resources.
- Reset text that does not explicitly include `short` near `rest` is not short-rest eligible.

### Manual Test Checklist

1. Serve the project from the repo root and open `/`.
2. Import a character with spell slots and limited resources that include at least one `Short Rest` resource and one `Long Rest` resource.
3. Spend a spell slot and mark both limited resources used.
4. Tap `Short Rest` and confirm only the short-rest limited resource returns to 0 used.
5. Confirm spell slot usage and long-rest-only resource usage are unchanged after Short Rest.
6. Tap `Long Rest` and confirm spell slot usage and all limited resource usage reset.
7. Confirm the combat log records both rest actions.
8. Refresh and confirm rest changes persist through combat state.
9. Confirm imported resource maximums and reset labels are unchanged.
10. At mobile width, confirm the new rest buttons remain usable in the Turn Economy panel.

### Verification Completed

- `node --test tests\playerCombatImport.test.mjs`
- `node --check` for every `js/player-combat/**/*.js` file.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `characterNormalizer.js` at 341 lines.
- Searched player app code for `alert(`, `prompt(`, and `confirm(`; no native dialogs are used.
- Served the repo with `python -m http.server` and confirmed `/`, `/data/classes.json`, and `/data/spells.json` return HTTP 200.

### Next Recommended Phase

Add confirmation dialogs for high-impact reset buttons, or add narrow resource reminder metadata for common class resources without automating feature effects.

## Previous Session: Player Combat Assistant Limited Resource Tracker

### Implemented

- Moved the player-facing app entry point from `player-combat.html` to root `index.html` so it can be served at `https://www.fairway3games.com/wwmcd/`.
- Renamed the visible app title and header to `what would my character do?`.
- Added normalized support for simple imported class and limited-use resources:
  - `classResources` are read from `classResources`, `actions.classResources`, and `resources.classResources`.
  - `limitedUses` are read from `limitedUses`, `features.limitedUses`, and `resources.limitedUses`.
  - Resource definitions keep a stable id, name, max, reset text, source, optional cost, and simple note when available.
  - Missing names, missing maximums, and incomplete entries are ignored gracefully.
- Added manual limited resource controls in the Combat State panel:
  - Each resource shows name, max, used, and remaining.
  - Used counts can be decremented, incremented, directly edited, reset individually, or reset together.
  - Used counts are clamped to the normalized max.
  - Usage persists only through `combatState.resourcesUsed.classResources`.
  - Imported character resource definitions are not mutated.
- Added lightweight Resources-tab reminder cards for normalized limited resources:
  - Cards show remaining uses, used/max, reset text, and a no-uses warning when spent.
  - Cards do not automate class-specific timing, action economy, or feature effects.
- Added focused tests for limited resource normalization, combat-state-only persistence, clamping, reset, and reminder card metadata.

### Files Changed

- `js/player-combat/normalizers/characterNormalizer.js`
- `js/player-combat/core/stateManager.js`
- `js/player-combat/ui/combatStatePanel.js`
- `js/player-combat/rules/combatOptionsService.js`
- `js/player-combat/rules/resourceActions.js`
- `js/player-combat/data/referenceDataLoader.js`
- `js/player-combat/data/referenceDataService.js`
- `tests/playerCombatImport.test.mjs`
- `index.html`
- `player-combat.html` removed
- `docs/development-plan.md`
- `docs/player-combat-assistant.md`

### Runtime Dependency Cleanup

- Copied the browser reference data loader into `js/player-combat/data/referenceDataLoader.js`.
- Updated `referenceDataService.js` to use the local player-combat loader instead of importing from `dm-roster`.
- `dm-roster` scripts and data are now reference material only for the player app, not runtime dependencies.

### Known Limitations

- The resource tracker is manual-first and does not implement Rage, Ki, Channel Divinity, Wild Shape, Action Surge, or other class-specific automation.
- Resource max values are only normalized when the import provides an obvious numeric max such as `max`, `maxUses`, `uses`, `count`, `value`, or `available`.
- Stat-derived, proficiency-derived, level-derived, and formula-derived resource counts are not calculated yet.
- Imported current used counts, if present in raw data, are not treated as combat usage; combat usage starts in combat state.
- Resource cards are reminders only and do not create action, bonus action, reaction, or roll buttons.
- Pact magic, item charges, wild shape forms, VTT features, and multiplayer remain out of scope.

### Data Assumptions

- Simple limited resource imports provide an object with a displayable name and numeric maximum.
- D&D Beyond-style resource limits may appear directly on the resource entry or under `definition.limitedUse`.
- Reset information, when available, is display text only and does not drive short-rest or long-rest automation.
- `combatState.resourcesUsed.classResources` is the generic used-count map for both class resources and limited-use feature resources.

### Manual Test Checklist

1. Serve the project from the repo root and open `/` or `https://www.fairway3games.com/wwmcd/`.
2. Import a character JSON that includes simple limited resources such as Ki, Arcane Recovery, Fey Step, Bardic Inspiration, or another feature with an obvious numeric max.
3. Confirm the Combat State panel shows each resource with remaining, used/max, `-`, `+`, direct input, individual reset, and all-resource reset controls.
4. Increment, decrement, direct edit, and reset a resource; refresh and confirm the used count persists through combat state.
5. Confirm the imported character's normalized resource `max` does not change after manual edits.
6. Confirm resource used counts clamp between 0 and max.
7. Open the Resources tab and confirm resource reminder cards show remaining uses and reset text when available.
8. Spend all uses of a resource and confirm the reminder card shows a no-uses warning without disabling unrelated actions.
9. Import or simulate a character with no limited resources and confirm the panel shows a graceful empty message.
10. At mobile width, confirm resource controls remain readable and touch-sized.

### Verification Completed

- `node --test tests\playerCombatImport.test.mjs`
- `node --check` for every `js/player-combat/**/*.js` file.
- Confirmed every `js/player-combat` JavaScript file remains under 500 lines; largest file is `characterNormalizer.js` at 341 lines.
- Searched player app code for `alert(`, `prompt(`, and `confirm(`; no native dialogs are used.
- Served the repo with `python -m http.server` and confirmed `/` and `/data/spells.json` return HTTP 200.
- Confirmed `/` contains the app name `what would my character do?`.

### Next Recommended Phase

Add tiny generic rest/reset helpers for tracked limited resources, or add a narrow feature-reminder layer for common class resources without automating class-specific effects.

## Previous Session: Player Combat Assistant Resource and Condition Warning Pass

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

1. Serve the project from the repo root and open `/`.
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
- Served the repo with `python -m http.server` and confirmed `/` and `/data/spells.json` return HTTP 200.

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

1. Serve the project from the repo root and open `/`.
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
- Served the repo with `python -m http.server` and confirmed `/` and `/data/spells.json` return HTTP 200.

### Next Recommended Phase

Add focused resource controls and the next layer of condition/resource warnings, then consider small override files for high-value spell and equipment exceptions rather than broad natural-language parsing.

## Previous Session: Player Combat Assistant Phase 3 Option Layer

### Implemented

- Added `index.html` as the first player-facing combat assistant page.
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

- `index.html`
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

- `dm-roster/data/referenceDataLoader.js` informed the player copy, but the player app now uses `js/player-combat/data/referenceDataLoader.js` so it has no runtime dependency on `dm-roster`.
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

1. Serve the project from the repo root and open `/`.
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

---

## Dark Fantasy Combat Screen Refresh

### What Was Implemented

- Restyled the player combat app into a compact dark-fantasy mobile interface using reusable CSS design tokens.
- Replaced the top combat area with an individual action economy tracker for Action, Bonus, Reaction, Free, and Movement.
- Reworked character status into a dense strip with crest, name, ancestry/class/level line, HP meter, HP/temp controls, AC, speed, initiative, and conditions.
- Reworked limited resources into compact spell-slot/resource chips with pips and remaining counts.
- Replaced the desktop-style action tables in the main combat flow with compact tappable mobile action rows.
- Added a planned-turn state layer so Action, Bonus, Reaction, Free, and Movement choices can be staged before resources are spent.
- Added a sticky planned-turn bar with Clear and Confirm controls.
- Added compact bottom navigation placeholders for Combat, Spells, Features, Gear, and Notes.

### Files Changed

- `index.html`
- `css/player-combat.css`
- `js/player-combat/app.js`
- `js/player-combat/ui/actionTabs.js`
- `js/player-combat/ui/combatStatusBar.js`
- `js/player-combat/ui/mobileActionList.js`
- `js/player-combat/ui/plannedTurnState.js`
- `js/player-combat/ui/spellcastingBar.js`
- `js/player-combat/ui/turnEconomyPanel.js`
- `docs/development-plan.md`

### Known Limitations

- The bottom navigation is visual structure only; non-combat tabs are not routed yet.
- Planned-turn confirmation commits selected options through the existing combat option handler, but deeper multi-action spell edge cases still depend on current option availability rules.
- Movement planning supports 5-foot increments from the action row/top movement control; a dedicated picker can be added later.

### Manual Test Steps

1. Serve the repo root and open `/` at a phone-sized viewport such as 375x812.
2. Import or load a character and confirm no large portrait appears.
3. Confirm the top tracker shows Action, Bonus, Reaction, Free, and Movement instead of initiative order.
4. Tap an Action, Bonus Action, Reaction, Free action, and Movement row; confirm selected rows and the planned-turn bar update.
5. Tap another Action and confirm it replaces the previous planned Action.
6. Tap Clear and confirm no resources or economy slots are spent.
7. Tap Confirm and confirm selected resources/economy are committed, movement updates, a toast appears, and the plan clears.
8. Search for `alert(`, `prompt(`, and `confirm(` and confirm none are used.

### Verification Completed

- `node --test tests\*.test.mjs`
- `rg "\b(alert|prompt|confirm)\s*\(" js index.html`
- Checked new JavaScript module sizes; `mobileActionList.js`, `plannedTurnState.js`, and updated `turnEconomyPanel.js` are under 500 lines.

### Follow-Up Layout Adjustment

- Removed the bottom navigation from the app shell and fixed the planned-turn bar to the viewport bottom so the plan remains visible.
- Made the action economy tracker sticky below the compact header.
- Compressed combat status into two lines: identity on one line, then HP/temp HP, HP meter, AC, speed, initiative, and conditions on one horizontally scrolling line.
- Improved dark modal contrast for import and condition workflows by overriding form fields, dropzones, preview blocks, and inline messages.

### Follow-Up Verification

- `node --check js\player-combat\ui\combatStatusBar.js`
- `node --test tests\*.test.mjs`
- `git diff --check`

### Busy State Regression Fix

- Added a lightweight busy overlay for import, short rest, long rest, and confirm turn actions.
- Yielded to the browser before synchronous state transitions so the busy indicator can paint before full combat option re-rendering begins.
- Batched planned-turn confirmation into one combat-state update to avoid multiple intermediate renders when confirming action, bonus action, reaction, free actions, and movement together.

### Busy State Verification

- `node --check js\player-combat\app.js`
- `node --check js\player-combat\core\stateManager.js`
- `node --check js\player-combat\ui\characterImportPanel.js`
- `node --check js\player-combat\ui\plannedTurnState.js`
- `node --test tests\*.test.mjs`
- `git diff --check`

### Turn Complete Modal

- Confirming a planned turn now opens a custom Turn Complete modal after the selected actions/resources/movement are committed.
- The modal includes:
  - `Start New Turn`, which resets the turn economy through the existing turn-start flow.
  - `Use a Reaction`, which navigates to the Reaction action list so off-turn reaction options are immediately available.

### Turn Complete Verification

- `node --check js\player-combat\app.js`
- `node --test tests\*.test.mjs`

### Action Detail and Roll Modal Regression Fix

- Restored expandable details for compact mobile action rows. Each row now has a `Details` control that reveals source, range, roll, resource, description, notes, warnings, and unavailable reasons.
- Added a pre-commit roll modal for planned actions with dice rolls. Confirm Turn now prompts for each rollable planned option before committing action economy/resources.
- The roll modal shows the core roll, supports advantage for d20 rolls, accepts extra dice such as `1d4` or `2d6`, logs the roll result, and requires a completed roll before OK marks the action used.
- Canceling or dismissing the roll modal aborts the turn commit and leaves the planned turn intact.
- Follow-up correction: roll prompts now occur when selecting a rollable action. The action is added to the planned turn only after the roll modal is completed. Confirm Turn no longer prompts for rolls.

### Action Detail and Roll Verification

- `node --check js\player-combat\ui\mobileActionList.js`
- `node --check js\player-combat\ui\actionRollModal.js`
- `node --check js\player-combat\ui\actionTabs.js`
- `node --check js\player-combat\ui\modal.js`
- `node --check js\player-combat\app.js`
- `node --test tests\*.test.mjs`
- `git diff --check`

### Chevron Details and Leveled Spell Fix

- Moved the action detail control into a thin first column of each action row as a chevron toggle.
- Restored the one-leveled-spell-per-turn guard in both rules availability and planned action selection, so a second leveled spell cannot be planned before confirmation or cast after one has already been committed.
- Added a regression test for leveled spell unavailability after a leveled spell has been cast this turn.

### Chevron Details and Spell Verification

- `node --check js\player-combat\ui\mobileActionList.js`
- `node --check js\player-combat\ui\plannedTurnState.js`
- `node --check js\player-combat\ui\actionTabs.js`
- `node --check js\player-combat\rules\actionEconomyRules.js`
- `node --test tests\*.test.mjs`

### Combat Row Column Update

- Removed descriptive/effect text from the compact row columns; descriptions now live only in the expandable detail panel.
- Spell rows now render as: chevron, casting-time badge, level, name, range, DC, and `Cast`.
- Action, bonus-action, and reaction rows now render as: chevron, source badge, name, blank spacer, and `Use`.
- Attack rows now render as: chevron, action-cost badge, melee/ranged type, name, range, attack modifier, damage, and `Attack`.

### Combat Row Verification

- `node --check js\player-combat\ui\mobileActionList.js`
- `node --test tests\*.test.mjs`

### Attack Roll Modal Update

- Attack actions now roll both the attack roll and the primary damage roll in the same modal.
- Replaced the advantage checkbox with a `Normal / Advantage / Disadvantage` dropdown for d20 rolls.
- Roll results now display every component roll, including all d20 alternatives for advantage/disadvantage, and the combat log summary includes each rolled result.

### Attack Roll Modal Verification

- `node --check js\player-combat\ui\actionRollModal.js`
- `node --test tests\*.test.mjs`
- `git diff --check`

### Badge and Concentration Table Update

- Normalized action-cost badges across all compact tables to `action`, `bonus`, `reaction`, and `free`.
- Normalized type/source badges to lowercase `basic`, `feature`, `spell`, `melee`, and `ranged` where applicable.
- Added a thin concentration column to spell rows with a `C` badge for concentration spells.
- Restored concentration replacement warning when selecting a concentration spell while already concentrating; confirmed casts still update concentration state on commit.

### Badge and Concentration Verification

- `node --check js\player-combat\ui\mobileActionList.js`
- `node --check js\player-combat\ui\actionTabs.js`
- `node --test tests\*.test.mjs`
- `git diff --check`
