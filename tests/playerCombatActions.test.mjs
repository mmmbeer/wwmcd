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

test("high-impact feature actions spend resources and update turn state", () => {
  const character = baseCharacter({
    classes: [{ name: "Fighter", level: 2 }],
    resources: {
      spellSlots: {},
      classResources: [{ id: "resource-action-surge", name: "Action Surge", max: 1, reset: "Short Rest" }],
      limitedUses: []
    },
    features: { class: [{ name: "Action Surge" }], race: [], feats: [], other: [] }
  });
  const groups = getCombatOptions({
    character,
    combatState: { ...combatState, turn: { ...combatState.turn, actionUsed: true } },
    referenceData: null
  });

  const surge = groups.resources.find((option) => option.name === "Action Surge");

  assert.equal(surge.available, true);
  assert.equal(surge.effect.actionSurge, true);
  assert.equal(surge.cost.resource.id, "resource-action-surge");
});

test("wild shape uses action by default and bonus action for moon druids", () => {
  const common = {
    resources: {
      spellSlots: {},
      classResources: [{ id: "resource-wild-shape", name: "Wild Shape", max: 2, reset: "Short Rest" }],
      limitedUses: []
    },
    features: { class: [{ name: "Wild Shape" }], race: [], feats: [], other: [] }
  };
  const land = getCombatOptions({
    character: baseCharacter({ classes: [{ name: "Druid", level: 2 }], ...common }),
    combatState,
    referenceData: null
  });
  const moon = getCombatOptions({
    character: baseCharacter({ classes: [{ name: "Druid", subclass: "Circle of the Moon", level: 2 }], ...common }),
    combatState,
    referenceData: null
  });

  assert.ok(land.actions.some((option) => option.name === "Wild Shape" && option.cost.action));
  assert.ok(moon.bonus.some((option) => option.name === "Wild Shape" && option.cost.bonus));
});

test("divine smite exposes lowest available spell slot as on-hit resource option", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      classes: [{ name: "Paladin", level: 2 }],
      resources: { spellSlots: { 1: 2, 2: 1 }, classResources: [], limitedUses: [] },
      features: { class: [{ name: "Divine Smite" }], race: [], feats: [], other: [] }
    }),
    combatState: {
      ...combatState,
      resourcesUsed: { spellSlots: { 1: 2 }, classResources: {} }
    },
    referenceData: null
  });

  const smite = groups.resources.find((option) => option.name === "Divine Smite");

  assert.equal(smite.cost.resource.level, 2);
  assert.equal(smite.rolls[0].formula, "3d8");
});

test("step of the wind and patient defense use tracked monk focus", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      classes: [{ name: "Monk", level: 2 }],
      resources: {
        spellSlots: {},
        classResources: [{ id: "resource-ki", name: "Ki", max: 2, reset: "Short Rest" }],
        limitedUses: []
      },
      features: {
        class: [{ name: "Patient Defense" }, { name: "Step of the Wind" }],
        race: [],
        feats: [],
        other: []
      }
    }),
    combatState,
    referenceData: null
  });

  assert.ok(groups.bonus.some((option) => option.name === "Patient Defense" && option.cost.resource.id === "resource-ki"));
  assert.ok(groups.bonus.some((option) => option.name === "Step of the Wind: Dash" && option.cost.resource.id === "resource-ki"));
  assert.ok(groups.bonus.some((option) => option.name === "Step of the Wind: Disengage" && option.cost.resource.id === "resource-ki"));
});

test("common feat bonus actions expose prerequisites and rolls", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      stats: { str: 16, dex: 12, con: 12, int: 10, wis: 14, cha: 8 },
      inventory: {
        weapons: [{ name: "Quarterstaff", type: "Simple Melee Weapon", damage: { diceString: "1d6" }, damageType: "bludgeoning" }],
        armor: [{ name: "Shield", type: "Shield", equipped: true }]
      },
      features: {
        class: [],
        race: [],
        feats: [{ name: "Polearm Master" }, { name: "Shield Master" }, { name: "Telekinetic" }],
        other: []
      }
    }),
    combatState: { ...combatState, turn: { ...combatState.turn, attackActionUsed: true } },
    referenceData: null
  });

  assert.ok(groups.bonus.some((option) => option.name === "Polearm Master: Haft Attack" && option.rolls.length === 2));
  assert.equal(groups.bonus.find((option) => option.name === "Shield Master: Shove").available, true);
  assert.ok(groups.bonus.some((option) => option.name === "Telekinetic Shove" && option.meta.some((entry) => /DC 12/.test(entry))));
});

test("feature speed modifiers affect movement remaining", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      combat: { proficiencyBonus: 2, speed: { walk: 30 } },
      inventory: { weapons: [], armor: [] },
      features: { class: [{ name: "Fast Movement" }], race: [], feats: [{ name: "Mobile" }], other: [] }
    }),
    combatState: { ...combatState, turn: { ...combatState.turn, movementUsed: 10 } },
    referenceData: null
  });

  assert.equal(groups.movement.find((option) => option.name === "Move").movement.speed, 50);
  assert.equal(groups.movement.find((option) => option.name === "Move").movement.remaining, 40);
});

test("barbarian rage, reckless attack, and berserker frenzy expose stateful options", () => {
  const character = baseCharacter({
    classes: [{ name: "Barbarian", subclass: "Path of the Berserker", level: 3 }],
    stats: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
    resources: {
      spellSlots: {},
      classResources: [{ id: "resource-rage", name: "Rage", max: 3, reset: "Long Rest" }],
      limitedUses: []
    },
    features: {
      class: [{ name: "Rage" }, { name: "Reckless Attack" }, { name: "Frenzy" }],
      race: [],
      feats: [],
      other: []
    }
  });
  const beforeRage = getCombatOptions({ character, combatState, referenceData: null });
  const raging = getCombatOptions({
    character,
    combatState: { ...combatState, current: { conditions: [], activeEffects: ["Rage"] } },
    referenceData: null
  });

  assert.ok(beforeRage.bonus.some((option) => option.name === "Rage" && option.cost.resource.id === "resource-rage"));
  assert.ok(beforeRage.free.some((option) => option.name === "Reckless Attack" && option.effect.turnFlag === "recklessAttackUsed"));
  assert.equal(beforeRage.bonus.find((option) => option.name === "Frenzy: Bonus Attack").available, false);
  assert.equal(raging.bonus.find((option) => option.name === "Frenzy: Bonus Attack").available, true);
  assert.ok(raging.bonus.some((option) => option.name === "End Rage"));
});

test("monk reactions and stunning strike use level and focus resource", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      classes: [{ name: "Monk", level: 5 }],
      stats: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
      resources: {
        spellSlots: {},
        classResources: [{ id: "resource-ki", name: "Ki", max: 5, reset: "Short Rest" }],
        limitedUses: []
      },
      features: {
        class: [{ name: "Deflect Missiles" }, { name: "Slow Fall" }, { name: "Stunning Strike" }],
        race: [],
        feats: [],
        other: []
      }
    }),
    combatState,
    referenceData: null
  });

  assert.ok(groups.reaction.some((option) => option.name === "Deflect Missiles" && option.rolls[0].formula === "1d10+8"));
  assert.ok(groups.reaction.some((option) => option.name === "Slow Fall" && option.meta.includes("Reduce falling damage by 25")));
  assert.ok(groups.resources.some((option) => option.name === "Stunning Strike" && option.cost.resource.id === "resource-ki"));
});

test("rogue sneak attack and uncanny dodge have dedicated cards", () => {
  const character = baseCharacter({
    classes: [{ name: "Rogue", level: 5 }],
    features: {
      class: [{ name: "Sneak Attack" }, { name: "Uncanny Dodge" }],
      race: [],
      feats: [],
      other: []
    }
  });
  const groups = getCombatOptions({ character, combatState, referenceData: null });
  const afterSneak = getCombatOptions({
    character,
    combatState: { ...combatState, turn: { ...combatState.turn, sneakAttackUsed: true } },
    referenceData: null
  });

  assert.ok(groups.free.some((option) => option.name === "Sneak Attack" && option.rolls[0].formula === "3d6"));
  assert.ok(groups.reaction.some((option) => option.name === "Uncanny Dodge"));
  assert.equal(afterSneak.free.find((option) => option.name === "Sneak Attack").available, false);
});

test("war caster and expanded feat reminders expose reaction/save options", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      stats: { str: 16, dex: 12, con: 12, int: 10, wis: 14, cha: 8 },
      inventory: {
        weapons: [
          { name: "Halberd", type: "Martial Melee Weapon", properties: "Heavy, Reach, Two-Handed", damage: { diceString: "1d10" }, damageType: "slashing" }
        ],
        armor: [{ name: "Shield", type: "Shield", equipped: true }]
      },
      features: {
        class: [],
        race: [],
        feats: [{ name: "War Caster" }, { name: "Polearm Master" }, { name: "Great Weapon Master" }, { name: "Shield Master" }],
        other: []
      }
    }),
    combatState,
    referenceData: null
  });

  assert.ok(groups.reaction.some((option) => option.name === "War Caster: Opportunity Spell"));
  assert.ok(groups.reaction.some((option) => option.name === "Polearm Master: Enter Reach"));
  assert.ok(groups.actions.some((option) => option.name === "Great Weapon Master: Heavy Attack" && option.rolls[0].formula === "1d20+0"));
  assert.ok(groups.free.some((option) => option.name === "Shield Master: Dexterity Save"));
});

test("rage and reckless attack become inline Strength melee weapon riders", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      classes: [{ name: "Barbarian", level: 9 }],
      stats: { str: 18, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
      inventory: {
        weapons: [{ name: "Longsword", type: "Martial Melee Weapon", damage: { diceString: "1d8" }, damageType: "slashing" }]
      },
      features: { class: [{ name: "Rage" }, { name: "Reckless Attack" }], race: [], feats: [], other: [] }
    }),
    combatState: {
      ...combatState,
      turn: { ...combatState.turn, recklessAttackUsed: true },
      current: { conditions: [], activeEffects: ["Rage"] }
    },
    referenceData: null
  });

  const longsword = groups.attacks.find((option) => option.name === "Longsword");

  assert.ok(longsword.meta.includes("Rage: +3 damage on Strength melee hits"));
  assert.ok(longsword.meta.includes("Rage: resistance to bludgeoning, piercing, and slashing damage"));
  assert.ok(longsword.meta.includes("Reckless Attack: roll this Strength melee attack with advantage"));
  assert.ok(longsword.warnings.includes("Reckless Attack: attacks against you have advantage until your next turn."));
});

test("sneak attack rider attaches damage only to eligible unused weapon attacks", () => {
  const character = baseCharacter({
    classes: [{ name: "Rogue", level: 5 }],
    inventory: {
      weapons: [
        { name: "Rapier", type: "Martial Melee Weapon", properties: "Finesse", damage: { diceString: "1d8" }, damageType: "piercing" },
        { name: "Greatclub", type: "Simple Melee Weapon", damage: { diceString: "1d8" }, damageType: "bludgeoning" }
      ]
    },
    features: { class: [{ name: "Sneak Attack" }], race: [], feats: [], other: [] }
  });
  const groups = getCombatOptions({ character, combatState, referenceData: null });
  const afterSneak = getCombatOptions({
    character,
    combatState: { ...combatState, turn: { ...combatState.turn, sneakAttackUsed: true } },
    referenceData: null
  });

  assert.equal(groups.attacks.find((option) => option.name === "Rapier").rolls.find((roll) => roll.id === "sneakAttackDamage").formula, "3d6");
  assert.equal(groups.attacks.find((option) => option.name === "Greatclub").rolls.some((roll) => roll.id === "sneakAttackDamage"), false);
  assert.equal(afterSneak.attacks.find((option) => option.name === "Rapier").rolls.some((roll) => roll.id === "sneakAttackDamage"), false);
  assert.ok(afterSneak.attacks.find((option) => option.name === "Rapier").meta.includes("Sneak Attack: already used this turn"));
});

test("stunning strike and great weapon master attach inline weapon riders", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      classes: [{ name: "Monk", level: 5 }, { name: "Fighter", level: 1 }],
      stats: { str: 16, dex: 14, con: 12, int: 10, wis: 16, cha: 8 },
      resources: {
        spellSlots: {},
        classResources: [{ id: "resource-ki", name: "Ki", max: 5, reset: "Short Rest" }],
        limitedUses: []
      },
      inventory: {
        weapons: [{ name: "Halberd", type: "Martial Melee Weapon", properties: "Heavy, Reach, Two-Handed", damage: { diceString: "1d10" }, damageType: "slashing" }]
      },
      features: {
        class: [{ name: "Stunning Strike" }],
        race: [],
        feats: [{ name: "Great Weapon Master" }],
        other: []
      }
    }),
    combatState,
    referenceData: null
  });

  const halberd = groups.attacks.find((option) => option.name === "Halberd");
  const unarmed = groups.attacks.find((option) => option.name === "Unarmed Strike");

  assert.ok(halberd.meta.includes("Stunning Strike: spend 1 Ki on hit"));
  assert.ok(halberd.meta.includes("Target makes CON save DC 13"));
  assert.equal(halberd.rolls.find((roll) => roll.id === "gwmAttack").formula, "1d20+0");
  assert.equal(halberd.rolls.find((roll) => roll.id === "gwmDamageBonus").formula, "10");
  assert.ok(unarmed.meta.includes("Stunning Strike: spend 1 Ki on hit"));
});

test("war caster lists eligible opportunity spells and marks spell cards", () => {
  const groups = getCombatOptions({
    character: baseCharacter({
      features: { class: [], race: [], feats: [{ name: "War Caster" }], other: [] },
      spells: {
        prepared: [
          { name: "Shocking Grasp", level: 0, castingTime: "1 action", description: "Make a melee spell attack against a creature." },
          { name: "Fireball", level: 3, castingTime: "1 action", range: "150 feet", description: "Each creature in a 20-foot-radius sphere makes a Dexterity saving throw." }
        ],
        known: [],
        cantrips: []
      },
      resources: { spellSlots: { 3: 1 }, classResources: [], limitedUses: [] }
    }),
    combatState,
    referenceData: null
  });

  const warCaster = groups.reaction.find((option) => option.name === "War Caster: Opportunity Spell");
  const shockingGrasp = groups.spells.find((option) => option.name === "Shocking Grasp");
  const fireball = groups.spells.find((option) => option.name === "Fireball");

  assert.ok(warCaster.meta.includes("Eligible spells: Shocking Grasp"));
  assert.ok(shockingGrasp.meta.includes("War Caster: eligible for opportunity spell reaction"));
  assert.equal(fireball.meta.includes("War Caster: eligible for opportunity spell reaction"), false);
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
