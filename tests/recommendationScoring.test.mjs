import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getContextualRecommendationAnswers,
  getDefaultRecommendationAnswers,
  getRankedRecommendations,
  getRankedRecommendationSets,
  getRecommendationQuestionConfig
} from "../js/player-combat/recommendations/recommendationScoring.js";

const tacticalMetadata = loadTacticalMetadata();

test("damage goal ranks damaging attacks above support options", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("greataxe", "Greataxe", "1d12+4"),
      support("help", "Help Ally")
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage" }
  });

  assert.equal(ranked[0].option.name, "Greataxe");
  assert.ok(ranked[0].reasons.includes("High damage"));
});

test("default recommendation goal is damage", () => {
  assert.equal(getDefaultRecommendationAnswers().goal, "damage");
});

test("support goal ranks healing and aid effects above weapon damage", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("shortsword", "Shortsword", "1d6+3"),
      {
        id: "cure-wounds",
        name: "Cure Wounds",
        source: "spell",
        description: "A creature you touch regains hit points.",
        spell: { level: 1, range: "Touch" },
        cost: { action: true, resource: { type: "spellSlot", level: 1 } },
        rolls: [{ id: "healing", type: "healing", formula: "1d8+3" }],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "support", situation: "ally", resources: "spend" }
  });

  assert.equal(ranked[0].option.name, "Cure Wounds");
  assert.ok(ranked[0].reasons.includes("Strong support"));
});

test("conserve resources favors no-cost options over spell slots", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("longsword", "Longsword", "1d8+4"),
      {
        id: "burning-hands",
        name: "Burning Hands",
        source: "spell",
        description: "Each creature in a cone takes 3d6 fire damage.",
        spell: { level: 1, range: "Self" },
        cost: { action: true, resource: { type: "spellSlot", level: 1 } },
        rolls: [{ id: "damage", type: "damage", formula: "3d6" }],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage", resources: "conserve" }
  });

  assert.equal(ranked[0].option.name, "Longsword");
  assert.ok(ranked[0].reasons.includes("No resource cost"));
});

test("concentration-changing options carry a recommendation warning", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "web",
        name: "Web",
        source: "spell",
        description: "Creatures in the area make a Dexterity saving throw or are restrained.",
        spell: { level: 2, concentration: true, range: "60 ft", saveDc: 15 },
        cost: { action: true, resource: { type: "spellSlot", level: 2 } },
        rolls: [],
        available: true
      }
    ]),
    combatState: {
      ...baseCombatState(),
      current: { concentration: "Bless", conditions: [] }
    },
    answers: { goal: "control", concentration: "prefer" }
  });

  assert.ok(ranked[0].warnings.includes("May replace Bless"));
});

test("wizard questions adapt to available spells, resources, and concentration", () => {
  const questions = getRecommendationQuestionConfig(groupsWith([
    {
      id: "bless",
      name: "Bless",
      source: "spell",
      description: "Bolster allies with extra dice.",
      spell: { level: 1, concentration: true },
      cost: { action: true, resource: { type: "spellSlot", level: 1 } },
      rolls: [],
      available: true
    }
  ]));

  assert.ok(questions.some((question) => question.id === "resources"));
  assert.ok(questions.some((question) => question.id === "concentration"));
  assert.ok(questions.find((question) => question.id === "goal").options.some(([value]) => value === "support"));
  assert.ok(questions.find((question) => question.id === "situation").options.some(([value]) => value === "bigBad"));
  assert.ok(questions.find((question) => question.id === "situation").options.some(([value]) => value === "bigBadMinions"));
  assert.ok(questions.find((question) => question.id === "distance").options.some(([value]) => value === "long"));
  assert.ok(questions.some((question) => question.id === "difficulty"));
});

test("recommendation defaults spend resources for non-single target unless resources are low", () => {
  const character = {
    resources: {
      spellSlots: { 1: 4 },
      classResources: [{ id: "resource-ki", name: "Ki", max: 4 }],
      limitedUses: []
    }
  };

  assert.equal(getDefaultRecommendationAnswers({
    character,
    combatState: baseCombatState(),
    answers: { situation: "multiple" }
  }).resources, "spend");
  assert.equal(getDefaultRecommendationAnswers({
    character,
    combatState: baseCombatState(),
    answers: { situation: "single" }
  }).resources, "normal");
  assert.equal(getDefaultRecommendationAnswers({
    character,
    combatState: {
      ...baseCombatState(),
      resourcesUsed: { spellSlots: { 1: 4 }, classResources: { "resource-ki": 3 } }
    },
    answers: { situation: "multiple" }
  }).resources, "conserve");
});

test("recommendation defaults avoid changing existing concentration", () => {
  assert.equal(getDefaultRecommendationAnswers({
    combatState: { ...baseCombatState(), current: { concentration: "Bless", conditions: [] } }
  }).concentration, "avoid");

  assert.equal(getContextualRecommendationAnswers({
    situation: "multiple",
    resources: "normal",
    concentration: "allow"
  }, {
    combatState: { ...baseCombatState(), current: { concentration: "Bless", conditions: [] } }
  }).concentration, "avoid");
});

test("big bad plus minions favors area pressure over single-target damage", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "burning-hands",
        name: "Burning Hands",
        source: "spell",
        description: "Each creature in a cone takes fire damage.",
        spell: { level: 1, range: "Self" },
        cost: { action: true, resource: { type: "spellSlot", level: 1 } },
        rolls: [{ id: "damage", type: "damage", formula: "3d6" }],
        available: true
      },
      {
        id: "guiding-bolt",
        name: "Guiding Bolt",
        source: "spell",
        description: "A ranged spell attack against one target.",
        spell: { level: 1, range: "120 feet" },
        cost: { action: true, resource: { type: "spellSlot", level: 1 } },
        rolls: [
          { id: "attack", type: "attack", formula: "1d20+6" },
          { id: "damage", type: "damage", formula: "4d6" }
        ],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage", situation: "bigBadMinions", resources: "normal" }
  });

  assert.equal(ranked[0].option.name, "Burning Hands");
  assert.ok(ranked[0].reasons.includes("Handles minions"));
});

test("long range favors options in the 30-90 ft band over melee", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("longsword", "Longsword", "1d8+4"),
      rangedAttack("shortbow", "Shortbow", "1d6+4", 80)
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage", distance: "long" }
  });

  assert.equal(ranked[0].option.name, "Shortbow");
  assert.ok(ranked[0].reasons.includes("Range fit"));
});

test("deadly DC pulls defensive reactions into balanced turn sets", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("longsword", "Longsword", "1d8+4"),
      {
        id: "shield",
        name: "Shield",
        source: "spell",
        description: "Reaction protection that increases AC.",
        spell: { level: 1, range: "Self" },
        cost: { reaction: true, resource: { type: "spellSlot", level: 1 } },
        rolls: [],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "balanced", difficulty: "deadly" }
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "balanced", difficulty: "deadly" } });

  assert.ok(sets[0].pieces.some((piece) => piece.slot === "Reaction" && piece.entry.option.name === "Shield"));
});

test("recommendation sets combine compatible action economy pieces", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("longsword", "Longsword", "1d8+4"),
      {
        id: "second-wind",
        name: "Second Wind",
        source: "feature",
        description: "Recover hit points as a bonus action.",
        cost: { bonus: true },
        rolls: [{ id: "healing", type: "healing", formula: "1d10+5" }],
        available: true
      },
      {
        id: "movement_walk",
        name: "Move",
        source: "basic",
        group: "movement",
        description: "Move up to your speed.",
        cost: { movement: true },
        rolls: [],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "balanced" }
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "balanced" } });

  assert.equal(sets[0].pieces[0].slot, "Action");
  assert.ok(sets[0].pieces.some((piece) => piece.slot === "Bonus" && piece.entry.option.name === "Second Wind"));
  assert.ok(sets[0].pieces.some((piece) => piece.slot === "Move"));
});

test("recommendation sets show multiple attacks from Extra Attack metadata", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("longsword", "Longsword", "1d8+4", { attackCount: 2 }),
      attack("handaxe", "Handaxe", "1d6+4", { attackCount: 2 })
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage" }
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "damage" } });
  const attackSet = sets.find((set) => set.pieces[0].slot === "Attack 1");

  assert.ok(attackSet);
  assert.ok(attackSet.pieces.some((piece) => piece.slot === "Attack 2"));
});

test("spell attacks do not get Extra Attack pieces or Attack-action bonus riders", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "spell_shocking_grasp",
        name: "Shocking Grasp",
        source: "spell",
        description: "Make a melee spell attack against the target.",
        tags: ["spell", "cantrip"],
        spell: { level: 0, castingTime: "1 action", castingCost: "action", range: "Touch" },
        cost: { action: true },
        rolls: [{ id: "spellAttack", type: "attack", formula: "1d20+6" }],
        available: true
      },
      {
        id: "monk_flurry_of_blows",
        name: "Flurry of Blows",
        source: "feature",
        description: "After taking the Attack action, spend 1 Ki to make two unarmed strikes as a bonus action.",
        tags: ["monk", "feature", "attack", "unarmed"],
        cost: { bonus: true, resource: { type: "classResource", id: "resource-ki", amount: 1, name: "Ki" } },
        rolls: [],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage", resources: "spend" }
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "damage", resources: "spend" } });
  const shockSet = sets.find((set) => set.pieces[0].entry.option.name === "Shocking Grasp");

  assert.ok(shockSet);
  assert.equal(shockSet.pieces[0].slot, "Action");
  assert.ok(!shockSet.pieces.some((piece) => piece.slot === "Attack 2"));
  assert.ok(!shockSet.pieces.some((piece) => piece.entry.option.name === "Flurry of Blows"));
});

test("wild shape recommendation pieces use action economy labels, not Special", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "feature_wild_shape",
        name: "Wild Shape",
        source: "feature",
        description: "Assume a beast form you have seen before.",
        tags: ["druid", "feature", "shapechange"],
        cost: { action: true, resource: { type: "classResource", id: "wild-shape", amount: 1 } },
        resource: "Wild Shape",
        rolls: [],
        available: true
      },
      {
        id: "feature_combat_wild_shape",
        name: "Wild Shape",
        source: "feature",
        description: "Assume a beast form you have seen before.",
        tags: ["druid", "feature", "shapechange"],
        cost: { bonus: true, resource: { type: "classResource", id: "wild-shape", amount: 1 } },
        resource: "Wild Shape",
        rolls: [],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "defense", resources: "spend" }
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "defense", resources: "spend" } });
  const labels = sets.flatMap((set) => set.pieces.filter((piece) => piece.entry.option.name === "Wild Shape").map((piece) => piece.slot));

  assert.ok(labels.includes("Action") || labels.includes("Bonus"));
  assert.ok(!labels.includes("Special"));
});

test("post-attack riders only follow compatible Attack actions in recommendation sets", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("longsword", "Longsword", "1d8+4"),
      {
        id: "spell_haste",
        name: "Haste",
        source: "spell",
        description: "Choose a willing creature; it gains speed, AC, and an extra limited action.",
        spell: { level: 3, concentration: true, range: "30 feet" },
        cost: { action: true, resource: { type: "spellSlot", level: 3 } },
        rolls: [],
        available: true
      },
      {
        id: "feature_divine_smite",
        name: "Divine Smite",
        source: "feature",
        description: "After a melee weapon hit, spend a spell slot for radiant damage.",
        tags: ["paladin", "feature", "damage", "melee"],
        cost: { resource: { type: "spellSlot", level: 1 } },
        rolls: [{ id: "smiteDamage", type: "damage", formula: "2d8" }],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage", resources: "spend" },
    tacticalMetadata
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "damage", resources: "spend" } });
  const hasteSet = sets.find((set) => set.pieces[0].entry.option.name === "Haste");
  const attackSet = sets.find((set) => set.pieces[0].entry.option.name === "Longsword");

  assert.ok(hasteSet);
  assert.ok(!hasteSet.pieces.some((piece) => piece.entry.option.name === "Divine Smite"));
  assert.ok(attackSet.pieces.some((piece) => piece.slot === "Rider" && piece.entry.option.name === "Divine Smite"));
});

test("hit prerequisites block misclassified bonus riders after non-attack actions", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "spell_hold_person",
        name: "Hold Person",
        source: "spell",
        description: "A humanoid must make a Wisdom saving throw or be paralyzed.",
        spell: { level: 2, castingTime: "1 action", castingCost: "action", range: "60 feet", concentration: true },
        cost: { action: true, resource: { type: "spellSlot", level: 2 } },
        rolls: [],
        available: true
      },
      {
        id: "feature_divine_smite_bonus_bug",
        name: "Divine Smite",
        source: "feature",
        description: "After a melee weapon hit, spend a spell slot for radiant damage.",
        tags: ["paladin", "feature", "damage", "melee"],
        cost: { bonus: true, resource: { type: "spellSlot", level: 1 } },
        rolls: [{ id: "smiteDamage", type: "damage", formula: "2d8" }],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "control", resources: "spend" }
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "control", resources: "spend" } });
  const holdPersonSet = sets.find((set) => set.pieces[0].entry.option.name === "Hold Person");

  assert.ok(holdPersonSet);
  assert.ok(!holdPersonSet.pieces.some((piece) => piece.entry.option.name === "Divine Smite"));
});

test("recommendation sets do not pair two leveled spells in one turn", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "spell_hold_person",
        name: "Hold Person",
        source: "spell",
        description: "Paralyze a humanoid that fails a Wisdom saving throw.",
        spell: { level: 2, castingTime: "1 action", castingCost: "action", range: "60 feet", concentration: true },
        cost: { action: true, resource: { type: "spellSlot", level: 2 } },
        rolls: [],
        available: true
      },
      {
        id: "spell_misty_step",
        name: "Misty Step",
        source: "spell",
        description: "Briefly surrounded by silvery mist, you teleport up to 30 feet.",
        spell: { level: 2, castingTime: "1 bonus action", castingCost: "bonus", range: "Self" },
        cost: { bonus: true, resource: { type: "spellSlot", level: 2 } },
        rolls: [],
        available: true
      },
      {
        id: "feature_quick_rally",
        name: "Quick Rally",
        source: "feature",
        description: "Use a bonus action to help an ally.",
        cost: { bonus: true },
        rolls: [],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "control", resources: "spend" }
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "control", resources: "spend" } });
  const holdPersonSet = sets.find((set) => set.pieces[0].entry.option.name === "Hold Person");

  assert.ok(holdPersonSet);
  assert.ok(!holdPersonSet.pieces.some((piece) => piece.entry.option.name === "Misty Step"));
});

test("attack-action prerequisite bonus features only pair after attacks", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("longsword", "Longsword", "1d8+4"),
      {
        id: "spell_hold_person",
        name: "Hold Person",
        source: "spell",
        description: "A humanoid must make a Wisdom saving throw or be paralyzed.",
        spell: { level: 2, castingTime: "1 action", castingCost: "action", range: "60 feet", concentration: true },
        cost: { action: true, resource: { type: "spellSlot", level: 2 } },
        rolls: [],
        available: true
      },
      {
        id: "feature_shield_master_shove",
        name: "Shield Master: Shove",
        source: "feature",
        description: "After taking the Attack action, shove a creature within 5 feet as a bonus action.",
        tags: ["feat", "shove"],
        cost: { bonus: true },
        rolls: [{ id: "athletics", type: "check", formula: "1d20+6" }],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "control" }
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "control" } });
  const attackSet = sets.find((set) => set.pieces[0].entry.option.name === "Longsword");
  const holdPersonSet = sets.find((set) => set.pieces[0].entry.option.name === "Hold Person");

  assert.ok(attackSet.pieces.some((piece) => piece.slot === "Bonus" && piece.entry.option.name === "Shield Master: Shove"));
  assert.ok(!holdPersonSet.pieces.some((piece) => piece.entry.option.name === "Shield Master: Shove"));
});

test("spells and attack riders are not labeled as free actions", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("rapier", "Rapier", "1d8+4"),
      {
        id: "feature_sneak_attack",
        name: "Sneak Attack",
        source: "feature",
        description: "Once per turn, add damage to an eligible finesse or ranged weapon hit.",
        tags: ["rogue", "feature", "damage", "attack"],
        cost: {},
        rolls: [{ id: "sneakDamage", type: "damage", formula: "3d6" }],
        available: true,
        meta: ["Requires advantage or an ally adjacent to the target"]
      },
      {
        id: "spell_light",
        name: "Light",
        source: "spell",
        description: "Cantrip - Touch",
        spell: { level: 0, range: "Touch" },
        cost: { action: true },
        rolls: [],
        available: true
      },
      {
        id: "basic_object_interaction",
        name: "Object Interaction",
        source: "basic",
        group: "action",
        description: "Draw, stow, open, close, pick up, or hand off one simple object.",
        cost: { object: true },
        rolls: [],
        available: true
      }
    ]),
    character: rogueCharacter(),
    combatState: baseCombatState(),
    answers: { goal: "damage" },
    tacticalMetadata
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "damage" } });
  const allFreeNames = sets.flatMap((set) => set.pieces.filter((piece) => piece.slot === "Free").map((piece) => piece.entry.option.name));

  assert.ok(allFreeNames.includes("Object Interaction"));
  assert.ok(!allFreeNames.includes("Sneak Attack"));
  assert.ok(!allFreeNames.includes("Light"));
});

test("non-combat casting time spells are excluded from turn recommendations", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "spell_ceremony",
        name: "Ceremony",
        source: "spell",
        description: "Level 1 - Range Touch",
        spell: { level: 1, castingTime: "1 hour", castingCost: "special", range: "Touch" },
        cost: { resource: { type: "spellSlot", level: 1 } },
        resource: "Level 1 spell slot",
        recommended: true,
        rolls: [],
        available: true
      },
      {
        id: "spell_cure_wounds",
        name: "Cure Wounds",
        source: "spell",
        description: "A creature you touch regains hit points.",
        spell: { level: 1, castingTime: "1 action", castingCost: "action", range: "Touch" },
        cost: { action: true, resource: { type: "spellSlot", level: 1 } },
        resource: "Level 1 spell slot",
        rolls: [{ id: "healing", type: "healing", formula: "1d8+3" }],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "support", situation: "ally", resources: "spend" }
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "support", situation: "ally" } });

  assert.ok(!ranked.some((entry) => entry.option.name === "Ceremony"));
  assert.ok(ranked.some((entry) => entry.option.name === "Cure Wounds"));
  assert.ok(!sets.some((set) => set.pieces.some((piece) => piece.entry.option.name === "Ceremony")));
});

test("Light is penalized in normal combat recommendations", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "spell_light",
        name: "Light",
        source: "spell",
        description: "Cantrip - Touch",
        spell: { level: 0, range: "Touch" },
        cost: { action: true },
        rolls: [],
        available: true
      },
      {
        id: "spell_fire_bolt",
        name: "Fire Bolt",
        source: "spell",
        description: "Make a ranged spell attack.",
        spell: { level: 0, range: "120 feet" },
        cost: { action: true },
        rolls: [
          { id: "spellAttack", type: "attack", formula: "1d20+6" },
          { id: "damage", type: "damage", formula: "1d10" }
        ],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    tacticalMetadata
  });

  assert.equal(ranked[0].option.name, "Fire Bolt");
  const light = ranked.find((entry) => entry.option.name === "Light");
  assert.ok(light.score < ranked[0].score);
  assert.ok(light.reasons.includes("Low-combat utility; usually cast before combat."));
});

test("single durable targets prioritize Hex as a compatible bonus-action setup", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      rangedAttack("weapon_eldritch_blast", "Eldritch Blast", "1d10", 120),
      {
        id: "spell_hex",
        name: "Hex",
        source: "spell",
        description: "Bonus action concentration spell that adds necrotic damage when you hit the target.",
        spell: { level: 1, castingCost: "bonus", concentration: true, range: "90 feet" },
        cost: { bonus: true, resource: { type: "spellSlot", level: 1 } },
        damageTypes: ["necrotic"],
        rolls: [],
        available: true
      },
      {
        id: "spell_sanctuary",
        name: "Sanctuary",
        source: "spell",
        description: "Protect a creature from attacks.",
        spell: { level: 1, castingCost: "bonus", range: "30 feet" },
        cost: { bonus: true, resource: { type: "spellSlot", level: 1 } },
        rolls: [],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage", situation: "single", resources: "normal" },
    tacticalMetadata
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "damage", situation: "single" } });
  const blastSet = sets.find((set) => set.pieces[0].entry.option.name === "Eldritch Blast");

  assert.ok(ranked.find((entry) => entry.option.name === "Hex").reasons.includes("Sets up bonus-action damage concentration"));
  assert.ok(blastSet.pieces.some((piece) => piece.slot === "Bonus" && piece.entry.option.name === "Hex"));
});

test("damage recommendation sets do not attach low-synergy Harness Divine Power bonus actions", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "spell_eldritch_blast",
        name: "Eldritch Blast",
        source: "spell",
        description: "Make a ranged spell attack.",
        tags: ["spell", "cantrip", "attack", "ranged"],
        spell: { level: 0, castingCost: "action", range: "120 feet" },
        cost: { action: true },
        range: { type: "ranged", label: "120 ft", normal: 120 },
        rolls: [
          { id: "spellAttack", type: "attack", formula: "1d20+7" },
          { id: "damage", type: "damage", formula: "1d10", damageType: "force" }
        ],
        available: true
      },
      {
        id: "feature_harness_divine_power",
        name: "Harness Divine Power",
        source: "feature",
        description: "As a bonus action, expend a Channel Divinity use to regain one expended spell slot.",
        cost: { bonus: true, resource: { type: "classResource", id: "channel-divinity", amount: 1 } },
        rolls: [],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage", situation: "single", resources: "normal" }
  });
  const sets = getRankedRecommendationSets({ rankedEntries: ranked, answers: { goal: "damage", situation: "single", resources: "normal" } });
  const blastSet = sets.find((set) => set.pieces[0].entry.option.name === "Eldritch Blast");

  assert.ok(blastSet);
  assert.ok(!blastSet.pieces.some((piece) => piece.entry.option.name === "Harness Divine Power"));
});

test("battlefield creature lore penalizes avoided damage types", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      rangedAttack("weapon_fire_bolt", "Fire Bolt", "2d10", 120, "fire"),
      rangedAttack("weapon_eldritch_blast", "Eldritch Blast", "1d10", 120)
    ]),
    combatState: baseCombatState(),
    answers: {
      goal: "damage",
      situation: "single",
      userNotes: "I am fighting an adult red dragon."
    }
  });

  assert.equal(ranked[0].option.name, "Eldritch Blast");
  assert.ok(ranked.find((entry) => entry.option.name === "Fire Bolt").warnings.join(" ").includes("Avoid fire damage"));
});

test("Rogue Hide advantage setup is boosted when Sneak Attack is present", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "basic_hide",
        name: "Hide",
        source: "basic",
        description: "Make a Dexterity (Stealth) check when you have cover or concealment.",
        cost: { action: true },
        rolls: [{ id: "stealth", type: "check", formula: "1d20+7" }],
        available: true
      },
      {
        id: "basic_search",
        name: "Search",
        source: "basic",
        description: "Make a Wisdom (Perception) check.",
        cost: { action: true },
        rolls: [{ id: "perception", type: "check", formula: "1d20+2" }],
        available: true
      }
    ]),
    character: rogueCharacter(),
    combatState: baseCombatState(),
    answers: { situation: "bigBad", distance: "far" },
    tacticalMetadata
  });

  assert.equal(ranked[0].option.name, "Hide");
  assert.ok(ranked[0].reasons.includes("Hide can set up advantage for Sneak Attack."));
  assert.ok(ranked[0].reasons.some((reason) => reason.includes("Sneak Attack")));
});

test("Elven Accuracy explains advantage synergy when applicable", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "feature_elven_accuracy",
        name: "Elven Accuracy",
        source: "feature",
        tags: ["feat", "feature"],
        description: "When you have advantage on an attack roll, reroll one die.",
        cost: {},
        rolls: [],
        available: true
      }
    ]),
    character: rogueCharacter(),
    combatState: baseCombatState(),
    answers: { situation: "bigBad", rollMode: "advantage" },
    tacticalMetadata
  });

  assert.ok(ranked[0].reasons.includes("Elven Accuracy amplifies advantage."));
  assert.ok(ranked[0].reasons.some((reason) => reason.includes("Sneak Attack")));
});

test("Big Bad boosts boss pressure options", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "feature_stunning_strike",
        name: "Stunning Strike",
        source: "feature",
        description: "After a melee weapon hit, spend 1 Ki to try to stun the target.",
        tags: ["feature", "attack"],
        cost: { resource: { type: "classResource", id: "ki", amount: 1 } },
        rolls: [],
        available: true,
        meta: ["CON save DC 15"]
      },
      {
        id: "burning-hands",
        name: "Burning Hands",
        source: "spell",
        description: "Each creature in a cone takes fire damage.",
        spell: { level: 1, range: "Self" },
        cost: { action: true, resource: { type: "spellSlot", level: 1 } },
        rolls: [{ id: "damage", type: "damage", formula: "3d6" }],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "control", situation: "bigBad", resources: "spend", difficulty: "deadly" },
    tacticalMetadata
  });

  assert.equal(ranked[0].option.name, "Stunning Strike");
  assert.ok(ranked[0].reasons.includes("Stun can swing a boss turn."));
  assert.ok(ranked[0].reasons.includes("Big Bad pressure"));
});

test("Big Bad plus Minions boosts area and minion-clear options from metadata", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "fireball",
        name: "Fireball",
        source: "spell",
        description: "A bright streak flashes to a point you choose.",
        spell: { level: 3, range: "150 feet" },
        cost: { action: true, resource: { type: "spellSlot", level: 3 } },
        rolls: [{ id: "damage", type: "damage", formula: "8d6" }],
        available: true
      },
      {
        id: "guiding-bolt",
        name: "Guiding Bolt",
        source: "spell",
        description: "A ranged spell attack against one target.",
        spell: { level: 1, range: "120 feet" },
        cost: { action: true, resource: { type: "spellSlot", level: 1 } },
        rolls: [
          { id: "attack", type: "attack", formula: "1d20+6" },
          { id: "damage", type: "damage", formula: "4d6" }
        ],
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage", situation: "bigBadMinions", resources: "spend" },
    tacticalMetadata
  });

  assert.equal(ranked[0].option.name, "Fireball");
  assert.ok(ranked[0].reasons.includes("Signature area burst for minion clearing."));
});

test("missing tactical metadata does not break recommendations", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      attack("longsword", "Longsword", "1d8+4"),
      support("help", "Help Ally")
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage" },
    tacticalMetadata: {}
  });

  assert.equal(ranked[0].option.name, "Longsword");
  assert.equal(ranked.length, 2);
});

test("option-level spell tactics work without external metadata", () => {
  const ranked = getRankedRecommendations({
    groups: groupsWith([
      {
        id: "spell_fireball",
        name: "Fireball",
        source: "spell",
        description: "A bright streak flashes to a point you choose and explodes in a 20-foot-radius sphere.",
        spell: { level: 3, range: "150 feet" },
        cost: { action: true, resource: { type: "spellSlot", level: 3 } },
        rolls: [{ id: "damage", type: "damage", formula: "8d6" }],
        tactics: {
          combatUsefulness: "signature",
          roles: ["damage", "minionClear", "nova"],
          goodSituations: ["multiple", "bigBadMinions"]
        },
        available: true
      },
      {
        id: "spell_cure_wounds",
        name: "Cure Wounds",
        source: "spell",
        description: "A creature you touch regains hit points.",
        spell: { level: 1, range: "Touch" },
        cost: { action: true, resource: { type: "spellSlot", level: 1 } },
        rolls: [{ id: "healing", type: "healing", formula: "1d8+3" }],
        tactics: {
          combatUsefulness: "strong",
          roles: ["support"],
          goodSituations: ["ally"]
        },
        available: true
      }
    ]),
    combatState: baseCombatState(),
    answers: { goal: "damage", situation: "bigBadMinions", resources: "spend" },
    tacticalMetadata: {}
  });

  assert.equal(ranked[0].option.name, "Fireball");
  assert.ok(ranked[0].reasons.includes("Handles minions"));
  assert.equal(ranked.find((entry) => entry.option.name === "Cure Wounds").option.tactics.roles.includes("damage"), false);
});

function groupsWith(options) {
  return {
    recommended: options,
    actions: options.filter((option) => option.source !== "spell"),
    attacks: options.filter((option) => option.tags?.includes("attack")),
    bonus: options.filter((option) => option.cost?.bonus),
    reaction: options.filter((option) => option.cost?.reaction),
    movement: [],
    free: [],
    spells: options.filter((option) => option.source === "spell"),
    resources: options.filter((option) => option.cost?.resource),
    log: []
  };
}

function attack(id, name, damage, { attackCount = 1 } = {}) {
  return {
    id,
    name,
    source: "weapon",
    description: "Weapon attack.",
    tags: ["attack", "weapon", "melee"],
    cost: { action: true },
    range: { type: "melee", label: "5 ft", normal: 5 },
    attack: { count: attackCount, consumesAttackAction: true },
    rolls: [
      { id: "attack", type: "attack", formula: "1d20+7" },
      { id: "damage", type: "damage", formula: damage, damageType: "slashing" }
    ],
    available: true
  };
}

function rangedAttack(id, name, damage, range, damageType = "piercing") {
  return {
    id,
    name,
    source: "weapon",
    description: "Ranged weapon attack.",
    tags: ["attack", "weapon", "ranged"],
    cost: { action: true },
    range: { type: "ranged", label: `${range} ft`, normal: range },
    rolls: [
      { id: "attack", type: "attack", formula: "1d20+7" },
      { id: "damage", type: "damage", formula: damage, damageType }
    ],
    available: true
  };
}

function support(id, name) {
  return {
    id,
    name,
    source: "basic",
    description: "Help an ally with their next check or attack.",
    cost: { action: true },
    rolls: [],
    available: true
  };
}

function baseCombatState() {
  return {
    turn: { actionUsed: false, bonusActionUsed: false, reactionUsed: false, objectInteractionUsed: false, movementUsed: 0 },
    current: { concentration: null, conditions: [] },
    resourcesUsed: { spellSlots: {}, classResources: {} }
  };
}

function rogueCharacter() {
  return {
    features: {
      class: [{ name: "Sneak Attack", description: "Once per turn, deal extra damage." }],
      feats: [{ name: "Elven Accuracy", description: "When you have advantage, reroll one die." }],
      race: [],
      other: []
    },
    race: { features: [] },
    classes: [{ name: "Rogue", level: 5, features: [{ name: "Sneak Attack" }] }]
  };
}

function loadTacticalMetadata() {
  return {
    spellTactics: readJson("data/recommendations/spellTactics.json"),
    featTactics: readJson("data/recommendations/featTactics.json"),
    itemTactics: readJson("data/recommendations/itemTactics.json"),
    equipmentTactics: readJson("data/recommendations/equipmentTactics.json"),
    classFeatureTactics: readJson("data/recommendations/classFeatureTactics.json"),
    raceFeatureTactics: readJson("data/recommendations/raceFeatureTactics.json")
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
}
