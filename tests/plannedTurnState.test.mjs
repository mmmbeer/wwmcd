import test from "node:test";
import assert from "node:assert/strict";

globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
globalThis.window = { dispatchEvent() {} };

const {
  clearPlannedTurn,
  confirmPlannedTurn,
  getPlannedTurn,
  isOptionPlanned,
  selectPlannedOption
} = await import("../js/player-combat/ui/plannedTurnState.js");

test("planned Attack action can contain mixed attack pieces", () => {
  clearPlannedTurn();

  const longsword = attack("weapon_longsword", "Longsword", { count: 2, rolls: ["attack", "damage"] });
  const shove = attack("attack_shove", "Shove", { count: 2, rolls: ["check"] });

  assert.equal(selectPlannedOption(longsword).ok, true);
  assert.equal(selectPlannedOption(shove).ok, true);

  const plan = getPlannedTurn();
  assert.equal(plan.action.id, "weapon_longsword");
  assert.deepEqual(plan.actionAttacks.map((option) => option.name), ["Longsword", "Shove"]);
  assert.equal(isOptionPlanned(longsword), true);
  assert.equal(isOptionPlanned(shove), true);
});

test("spell attacks do not join Extra Attack sequences", () => {
  clearPlannedTurn();

  const longsword = attack("weapon_longsword", "Longsword", { count: 2, rolls: ["attack", "damage"] });
  const shockingGrasp = spellAttack("spell_shocking_grasp", "Shocking Grasp");

  assert.equal(selectPlannedOption(longsword).ok, true);
  assert.equal(selectPlannedOption(shockingGrasp).ok, true);

  const plan = getPlannedTurn();
  assert.equal(plan.action.id, "spell_shocking_grasp");
  assert.deepEqual(plan.actionAttacks, []);
});

test("confirming a mixed attack plan rolls each piece once but commits one action", async () => {
  clearPlannedTurn();

  const longsword = attack("weapon_longsword", "Longsword", { count: 2, rolls: ["attack", "damage"] });
  const shove = attack("attack_shove", "Shove", { count: 2, rolls: ["check"] });
  selectPlannedOption(longsword);
  selectPlannedOption(shove);

  const rolled = [];
  const used = [];
  const stateManager = {
    useCombatOptions(options) {
      used.push(...options);
    }
  };

  const result = await confirmPlannedTurn(stateManager, {
    beforeUseOption(option) {
      rolled.push(option);
      return true;
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(rolled.map((option) => option.name), ["Longsword", "Shove"]);
  assert.deepEqual(rolled.map((option) => option.attack.count), [1, 1]);
  assert.deepEqual(used.map((option) => option.name), ["Longsword"]);
});

function attack(id, name, { count, rolls }) {
  return {
    id,
    name,
    available: true,
    cost: { action: true },
    tags: ["attack"],
    attack: { count, consumesAttackAction: true },
    rolls: rolls.map((kind) => ({
      id: kind,
      label: kind,
      formula: kind === "damage" ? "1d8+3" : "1d20+5",
      type: kind
    }))
  };
}

function spellAttack(id, name) {
  return {
    id,
    name,
    source: "spell",
    available: true,
    spell: { level: 0, castingTime: "1 action", castingCost: "action" },
    cost: { action: true },
    tags: ["spell", "cantrip"],
    rolls: [{ id: "spellAttack", label: "Roll Attack", formula: "1d20+5", type: "attack" }]
  };
}
