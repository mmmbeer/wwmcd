# Recommendation Wizard Development Plan

## Summary

The Recommendation tab will become a compact tactical wizard that ranks sets of compatible turn actions from the character's current combat options. It uses the existing combat option pipeline, asks only questions that matter for the imported character sheet, and ranks turn plans by damage, support, control, defense, mobility, resource fit, and availability.

This is a deterministic rules-based recommendation system. It does not use an external AI service.

## Key Behavior

- Show the wizard at the top of the existing Recommendation tab as one horizontal row of dropdowns:
  - Goal
  - Situation
  - Range
  - Resources
  - Roll
  - Concentration
  - Reset
- Ask adaptive tactical questions:
  - Goal: Balanced, Damage, Support, Control, Defense, Mobility.
  - Situation: Single target, Multiple foes, Ally in danger, Self in danger.
  - Range: Any, Melee, Near, Far.
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
- advantage or disadvantage context for attack rolls
- current concentration state
- current availability and action economy

## Test Scenarios

- Damage goal ranks a high-damage attack above support options.
- Support goal ranks healing or ally help above weapon damage.
- Conserve resources favors no-cost actions over spell slots.
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
