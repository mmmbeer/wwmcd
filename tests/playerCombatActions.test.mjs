import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { transformCombatData } from "../js/player-combat/data/combatDataTransformer.js";
import { getAttackCount } from "../js/player-combat/rules/attackCountRules.js";
import { getCombatOptions } from "../js/player-combat/rules/combatOptionsService.js";

const combatState = {
  turn: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, objectInteractionUsed: false, movementUsed: 0 },
  current: { conditions: [] },
  resourcesUsed: { spellSlots: {}, classResources: {} }
};

test("imported Cunning Action uses SRD text to add bonus options", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      classes: [{ name: "Rogue", level: 2 }],
      features: { class: [{ name: "Cunning Action" }], race: [], feats: [], other: [] }
    }),
    combatState,
    referenceData: referenceDataWithFeatures({
      classes: {
        Rogue: {
          "Class Features": {
            "Cunning Action": "Starting at 2nd level, you can take a bonus action on each of your turns in combat. This action can be used only to take the Dash, Disengage, or Hide action."
          }
        }
      }
    })
  });

  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Dash"));
  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Disengage"));
  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Hide"));
  assert.equal(groups.bonus.find((option) => option.name === "Cunning Action: Dash").cost.bonus, true);
});

test("class levels alone do not invent feature actions", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      classes: [{ name: "Rogue", level: 2 }],
      features: { class: [], race: [], feats: [], other: [] }
    }),
    combatState,
    referenceData: referenceDataWithFeatures({
      classes: {
        Rogue: {
          "Class Features": {
            "Cunning Action": "Starting at 2nd level, you can take a bonus action on each of your turns in combat. This action can be used only to take the Dash, Disengage, or Hide action."
          }
        }
      }
    })
  });

  assert.equal(groups.bonus.some((option) => option.name.startsWith("Cunning Action")), false);
});

test("class, racial, and feat descriptions become action economy options", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      features: {
        class: [{ name: "Battle Cry", description: "As an action, choose allies that can hear you." }],
        race: [{ name: "Fey Step", description: "As a bonus action, magically teleport up to 30 feet." }],
        feats: [{ name: "Defensive Duelist" }, { name: "Chromatic Gift" }],
        other: []
      }
    }),
    combatState,
    referenceData: {
      indexes: {
        featIndexByName: new Map([
          ["defensive duelist", { name: "Defensive Duelist", description: "Use your reaction to add your proficiency bonus to AC." }],
          ["chromatic gift", { name: "Chromatic Gift", description: "Empower a weapon (bonus action). Gain resistance in reaction to damage." }]
        ])
      }
    }
  });

  assert.ok(groups.actions.some((option) => option.name === "Battle Cry"));
  assert.ok(groups.bonus.some((option) => option.name === "Fey Step"));
  assert.ok(groups.reaction.some((option) => option.name === "Defensive Duelist"));
  assert.ok(groups.bonus.some((option) => option.name === "Chromatic Gift"));
  assert.ok(groups.reaction.some((option) => option.name === "Chromatic Gift"));
});

test("reference data transform parses class, feat, and race action features", () => {
  const referenceData = loadRealReferenceData();
  const parsed = referenceData.featureActions;

  assert.ok(parsed.some((entry) => entry.type === "class" && entry.name === "Rage" && entry.action.costs.includes("bonus")));
  assert.ok(parsed.some((entry) => entry.type === "feat" && entry.name === "Defensive Duelist" && entry.action.costs.includes("reaction")));
  assert.ok(parsed.some((entry) => entry.type === "race" && entry.name === "Breath Weapon" && entry.action.costs.includes("action")));

  const cunningAction = referenceData.indexes.featureActionIndexByName.get("cunning action")?.[0];
  assert.deepEqual(cunningAction.action.grantedActions.map((entry) => entry.name), ["Dash", "Disengage", "Hide"]);
});

test("parsed reference actions map imported features to UI options without target-only actions", () => {
  const referenceData = loadRealReferenceData();
  const groups = getCombatOptions({
    character: baseCharacter({
      features: {
        class: [{ name: "Cunning Action" }, { name: "Turn Undead" }],
        race: [{ name: "Breath Weapon" }],
        feats: [{ name: "Defensive Duelist" }],
        other: []
      }
    }),
    combatState,
    referenceData
  });

  assert.ok(groups.bonus.some((option) => option.name === "Cunning Action: Dash"));
  assert.ok(groups.actions.some((option) => option.name === "Breath Weapon"));
  assert.ok(groups.reaction.some((option) => option.name === "Defensive Duelist"));
  assert.ok(groups.actions.some((option) => option.name === "Turn Undead"));
  assert.equal(groups.actions.some((option) => option.name === "Turn Undead: Dash"), false);
  assert.equal(groups.actions.some((option) => option.name === "Turn Undead: Dodge"), false);
});

test("default reaction options include opportunity attack and readied action when readied", () => {
  const groups = getCombatOptions({
    character: baseCharacter(),
    combatState: { ...combatState, turn: { ...combatState.turn, readiedAction: false } },
    referenceData: null
  });
  const readiedGroups = getCombatOptions({
    character: baseCharacter(),
    combatState: { ...combatState, turn: { ...combatState.turn, readiedAction: true } },
    referenceData: null
  });

  assert.ok(groups.reaction.some((option) => option.name === "Opportunity Attack"));
  assert.equal(groups.reaction.some((option) => option.name === "Use Readied Action"), false);
  assert.ok(readiedGroups.reaction.some((option) => option.name === "Use Readied Action"));
});

test("used reaction makes default reaction options unavailable", () => {
  const groups = getCombatOptions({
    character: baseCharacter(),
    combatState: { ...combatState, turn: { ...combatState.turn, reactionUsed: true, readiedAction: true } },
    referenceData: null
  });

  assert.equal(groups.reaction.find((option) => option.name === "Opportunity Attack").available, false);
  assert.equal(groups.reaction.find((option) => option.name === "Use Readied Action").available, false);
});

test("bonus and reaction spell activation objects sort into matching groups", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      resources: { spellSlots: { 1: 2 }, classResources: [], limitedUses: [] },
      spells: {
        spellcastingAbility: "wis",
        prepared: [
          { name: "Misty Step", level: 1, activation: { activationTime: 1, activationType: "Bonus Action" } },
          { name: "Shield", level: 1, activation: { activationTime: 1, activationType: { name: "Reaction" } } }
        ],
        known: [],
        cantrips: []
      }
    }),
    combatState,
    referenceData: null
  });

  assert.ok(groups.bonus.some((option) => option.name === "Misty Step"));
  assert.ok(groups.reaction.some((option) => option.name === "Shield"));
});

test("imported Extra Attack uses SRD text to affect attack count", () => {
  const character = baseCharacter({
    features: { class: [{ name: "Extra Attack" }], race: [], feats: [], other: [] }
  });
  const referenceData = referenceDataWithFeatures({
    classes: {
      Fighter: {
        "Class Features": {
          "Extra Attack": {
            content: "Beginning at 5th level, you can attack twice, instead of once, whenever you take the Attack action on your turn."
          }
        }
      }
    }
  });

  assert.equal(getAttackCount(character, referenceData), 2);
});

test("higher Extra Attack imports affect attack count by feature name", () => {
  const character = baseCharacter({
    features: { class: [{ name: "Extra Attack (2)" }], race: [], feats: [], other: [] }
  });

  assert.equal(getAttackCount(character, null), 3);
});

test("weapon attacks expose multiple attacks from Extra Attack features", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      features: { class: [{ name: "Extra Attack (2)" }], race: [], feats: [], other: [] },
      inventory: {
        weapons: [{
          name: "Longsword",
          type: "Martial Melee Weapon",
          damage: { diceString: "1d8" },
          damageType: "slashing"
        }]
      }
    }),
    combatState,
    referenceData: null
  });

  const longsword = groups.attacks.find((option) => option.name === "Longsword");

  assert.equal(longsword.attack.count, 3);
  assert.ok(longsword.meta.includes("3 attacks with the Attack action"));
});

test("monk martial arts waits for Attack action and flurry spends Ki", () => {
  const character = baseCharacter({
    classes: [{ name: "Monk", level: 3 }],
    stats: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
    resources: {
      spellSlots: {},
      classResources: [{ id: "resource-ki", name: "Ki", max: 3, reset: "Short Rest" }],
      limitedUses: []
    },
    features: {
      class: [{ name: "Martial Arts" }, { name: "Flurry of Blows" }],
      race: [],
      feats: [],
      other: []
    }
  });
  const beforeAttack = getCombatOptions({ character, combatState, referenceData: null });
  const afterAttack = getCombatOptions({
    character,
    combatState: { ...combatState, turn: { ...combatState.turn, attackActionUsed: true } },
    referenceData: null
  });
  const noKi = getCombatOptions({
    character,
    combatState: {
      ...combatState,
      turn: { ...combatState.turn, attackActionUsed: true },
      resourcesUsed: { spellSlots: {}, classResources: { "resource-ki": 3 } }
    },
    referenceData: null
  });

  assert.equal(beforeAttack.bonus.find((option) => option.id === "monk_martial_arts_bonus_unarmed").available, false);
  assert.equal(afterAttack.bonus.find((option) => option.id === "monk_martial_arts_bonus_unarmed").available, true);
  assert.equal(afterAttack.bonus.find((option) => option.id === "monk_flurry_of_blows").cost.resource.id, "resource-ki");
  assert.equal(afterAttack.bonus.find((option) => option.id === "monk_flurry_of_blows").available, true);
  assert.equal(noKi.bonus.find((option) => option.id === "monk_flurry_of_blows").available, false);
});

function baseCharacter(overrides = {}) {
  return {
    classes: [],
    stats: { str: 10, dex: 14, con: 12, int: 10, wis: 12, cha: 10 },
    combat: { proficiencyBonus: 2, speed: { walk: 30 } },
    resources: { spellSlots: {}, classResources: [], limitedUses: [] },
    inventory: { weapons: [] },
    spells: { prepared: [], known: [], cantrips: [] },
    features: { class: [], race: [], feats: [], other: [] },
    ...overrides
  };
}

function referenceDataWithFeatures(data) {
  return {
    data,
    indexes: {
      featIndexByName: new Map((data.feats ?? []).map((entry) => [String(entry.name).toLowerCase(), entry]))
    }
  };
}

function loadRealReferenceData() {
  const data = {
    classes: readJson("data/classes.json"),
    feats: readJson("data/feats.json"),
    races: readJson("data/races.json")
  };
  return {
    data,
    ...transformCombatData(data)
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(/^\uFEFF/, ""));
}
