import assert from "node:assert/strict";
import test from "node:test";

import {
  getRankedRecommendations,
  getRecommendationQuestionConfig
} from "../js/player-combat/recommendations/recommendationScoring.js";

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

function attack(id, name, damage) {
  return {
    id,
    name,
    source: "weapon",
    description: "Weapon attack.",
    tags: ["attack", "weapon", "melee"],
    cost: { action: true },
    range: { type: "melee", label: "5 ft", normal: 5 },
    rolls: [
      { id: "attack", type: "attack", formula: "1d20+7" },
      { id: "damage", type: "damage", formula: damage, damageType: "slashing" }
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
