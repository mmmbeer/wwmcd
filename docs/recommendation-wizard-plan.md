# Recommendation Wizard Development Plan

## Summary

The Recommendation tab will become a compact tactical wizard that ranks sets of compatible turn actions from the character's current combat options. It uses the existing combat option pipeline, asks only questions that matter for the imported character sheet, and ranks turn plans by damage, support, control, defense, mobility, resource fit, and availability.

This is a deterministic rules-based recommendation system. It does not use an external AI service.

## Key Behavior

- Show the wizard at the top of the existing Recommendation tab as one horizontal row of dropdowns:
  - Goal
  - Situation
  - Range
  - DC
  - Resources
  - Roll
  - Concentration
  - Reset
- Ask adaptive tactical questions:
  - Goal: Balanced, Damage, Support, Control, Defense, Mobility.
  - Situation: Single target, Multiple foes, Big Bad, Big Bad + Minions, Ally in danger, Self in danger.
  - Range: Any, Melee, Near (< 30 ft), Long (30-90 ft), Far (> 90 ft).
  - DC: Easy, Medium, Hard, Deadly.
  - Resources: Conserve, Normal, Spend.
  - Rolls: Normal, Advantage, Disadvantage.
  - Concentration: Allow, Avoid changing, Prefer.
- Hide irrelevant questions when the current options do not support them.
- Rank all options produced by `getCombatOptions()`, then compose compatible options into recommended turn sets.
- Recommended sets should include compatible action economy pieces such as Action, Bonus, Free, Move, and defensive Reaction suggestions when relevant.
- Keep existing action behavior intact:
  - rollable options open the roll modal when selected
  - concentration changes still warn before selection
  - planned turn state still controls action economy
  - unavailable options stay visible unless the user selects Available only

## Implementation Notes

- Recommendation scoring lives in `js/player-combat/recommendations/recommendationScoring.js`.
- Wizard rendering and session-local answer state live in `js/player-combat/ui/recommendationWizardPanel.js`.
- `js/player-combat/ui/actionTabs.js` integrates the wizard only for the `recommended` group.
- `js/player-combat/ui/recommendationWizardPanel.js` displays ranked turn-set cards with clickable action pieces that reuse the normal planned-turn selection flow.

Option ranking returns structured entries:

```js
{
  option,
  rank,
  score,
  categoryScores,
  reasons,
  warnings
}
```

Turn-set ranking returns structured entries:

```js
{
  id,
  rank,
  score,
  title,
  pieces,
  reasons,
  warnings
}
```

The score is explainable and based on:

- damage dice averages and attack rolls
- support, control, defense, and mobility keywords
- resource cost and selected resource stance
- encounter difficulty from the selected DC
- advantage or disadvantage context for attack rolls
- current concentration state
- current availability and action economy
- tactical metadata from source-data enrichment files

## Wizard Answer Semantics

### Situation

The situation answer should steer both target count and tactical urgency:

- `single`: Prefer efficient single-target attacks and avoid spending area effects unless they are still strong.
- `multiple`: Prefer area damage, multi-target control, forced movement, and effects that scale with target count.
- `bigBad`: Prefer high expected value, reliable damage, save-or-suck control, advantage generation, debuffs, and resource spending when the resource stance allows it.
- `bigBadMinions`: Prefer plans that combine pressure on the priority target with area, cleave, control, or minion-clearing options.
- `ally`: Prefer healing, protection, forced movement away from allies, buffs, and defensive reactions.
- `self`: Prefer Dodge, Disengage, mobility, defensive spells, healing, and escape/control options.

### Range

The range answer should normalize all option ranges into explicit bands:

- `unknown`: Do not penalize by distance.
- `melee`: Adjacent or weapon reach. Prioritize melee attacks, touch features, shove/grapple, and escape tools if the option is defensive.
- `near`: Less than 30 ft. Prioritize short-range spells/features and most thrown or close skirmish options.
- `long`: 30-90 ft. Prioritize ranged weapons, most combat cantrips, ranged spells, and movement gap-closers.
- `far`: More than 90 ft. Penalize short-range options heavily, and prefer long-range attacks, Dash, teleportation, or setup turns.

The scorer should parse numeric ranges where possible and fall back to metadata tags when text is ambiguous.

### DC

The DC selector represents encounter danger, not a rules save DC. Use it as a risk and resource-pressure input:

- `easy`: Prefer low-resource, efficient, low-risk options.
- `medium`: Keep current balanced behavior.
- `hard`: Raise the value of control, defense, advantage generation, reliable damage, and moderate resource spending.
- `deadly`: Strongly favor survival, disabling priority threats, action denial, high-impact limited resources, and reliable advantage-enabled damage.

For `hard` and `deadly` encounters, the recommendation engine should be more willing to recommend limited resources when they materially improve the turn, even when the resource stance is `normal`.

## Tactical Source Metadata

The existing source JSON files provide rules text, but rules text alone does not tell the recommendation engine how good an option is in combat. Add curated tactical metadata as sidecar source-data files rather than directly modifying generated or upstream-style JSON datasets.

Recommended files:

```txt
data/recommendations/spellTactics.json
data/recommendations/featTactics.json
data/recommendations/itemTactics.json
data/recommendations/equipmentTactics.json
data/recommendations/classFeatureTactics.json
data/recommendations/raceFeatureTactics.json
```

Each file should be keyed by normalized entity name and optional source/type where needed to avoid collisions. The loader should merge this metadata into normalized combat options before scoring, keeping the UI and scoring modules independent from raw source formats.

Example tactical metadata shape:

```json
{
  "Light": {
    "combatUsefulness": "avoid",
    "recommendationPenalty": 80,
    "roles": ["utility"],
    "badSituations": ["single", "multiple", "bigBad", "bigBadMinions"],
    "reasonBoosts": ["Usually not worth an action during combat unless darkness/visibility is the actual problem."]
  },
  "Hide": {
    "roles": ["advantageSetup", "defense"],
    "goodForClasses": ["rogue"],
    "synergies": ["Sneak Attack", "Elven Accuracy"],
    "goodSituations": ["single", "bigBad"],
    "reasonBoosts": ["Sets up advantage for Sneak Attack."]
  },
  "Elven Accuracy": {
    "roles": ["advantageAmplifier", "damage"],
    "requires": ["advantage"],
    "synergies": ["Sneak Attack"],
    "reasonBoosts": ["Makes advantage-based attacks more reliable."]
  }
}
```

Supported metadata fields:

- `combatUsefulness`: `avoid`, `situational`, `normal`, `strong`, or `signature`.
- `recommendationBonus` / `recommendationPenalty`: deterministic score adjustment after the normal category score.
- `roles`: tactical tags such as `damage`, `control`, `support`, `defense`, `mobility`, `utility`, `advantageSetup`, `advantageAmplifier`, `minionClear`, `bossDebuff`, `saveOrSuck`, `nova`, `escape`, or `reactionProtection`.
- `goodSituations` / `badSituations`: situation IDs where the option should be boosted or penalized.
- `goodRanges` / `badRanges`: range-band IDs where the option should be boosted or penalized.
- `goodDifficulties` / `badDifficulties`: DC IDs where the option should be boosted or penalized.
- `synergies`: other features, feats, items, spells, or class mechanics that should be named in reasons and scored together when present.
- `requires`: tactical prerequisites such as `advantage`, `hidden`, `meleeWeapon`, `rangedWeapon`, `concentrationFree`, or `allyInDanger`.
- `antiSynergies`: mechanics that make the option weaker or redundant.
- `reasonBoosts`: short UI-safe explanation strings to show in recommendation reasons.

The first enrichment pass should prioritize:

- Spells that are poor in normal combat despite being legal actions, such as `Light`, `Alarm`, and other exploration/utility spells.
- Rogue advantage workflows: Hide, Steady Aim if present, Sneak Attack, Elven Accuracy, familiar/help effects, invisibility, and restraint/prone setup.
- High-impact boss options: advantage generation, debuffs, save-or-suck spells, smites, action surge, rage, stunning strike, and concentration control.
- Minion-clearing options: area spells, cleave-like effects, multiattack, breath weapons, and forced movement.
- Defensive emergency options: Shield, Absorb Elements, Dodge, Disengage, healing, teleportation, Uncanny Dodge, and protective reactions.

Scoring should treat metadata as advisory. It can boost, penalize, or explain options, but it should not make an unavailable option selectable or bypass the existing action economy/resource rules.

## Test Scenarios

- Damage goal ranks a high-damage attack above support options.
- Support goal ranks healing or ally help above weapon damage.
- Big Bad situation favors reliable high-value damage, debuffs, advantage setup, and meaningful resource use.
- Big Bad + Minions situation favors turn sets that pressure the priority target while controlling or clearing secondary enemies.
- Range bands correctly distinguish Melee, Near (< 30 ft), Long (30-90 ft), and Far (> 90 ft).
- Hard and Deadly DC settings raise the value of reliable control, defense, advantage setup, and high-impact limited resources.
- Conserve resources favors no-cost actions over spell slots.
- Tactical metadata penalizes low-combat utility options such as `Light` during ordinary combat.
- Rogue tactical metadata boosts advantage setup and explains Sneak Attack/Elven Accuracy synergy when present.
- Concentration options show a warning when they may replace an active concentration effect.
- Wizard questions appear only when relevant option types exist.
- Manual mobile verification:
- change wizard dropdowns and confirm ranked turn sets update immediately
- click a piece in a recommended turn set and confirm it uses the normal planning/roll/concentration flow
  - select a recommended attack and confirm the roll modal opens
  - select a recommended concentration spell and confirm the concentration warning appears
  - confirm the planned turn bar still updates normally
  - verify no native `alert()`, `prompt()`, or `confirm()` calls are introduced

## Known Limits

- The first version uses heuristic scoring only.
- Enemy AC, enemy save weaknesses, tactical map position, and party state are not modeled unless already present in app data.
- Wizard answers are session-local and reset when the page reloads.
- Recommendations are only as complete as the normalized combat options already available from the character sheet.
- Tactical metadata must be curated incrementally; incomplete metadata should degrade to the existing heuristic behavior.
