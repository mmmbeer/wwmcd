import assert from "node:assert/strict";
import test from "node:test";

import { renderMobileActionList } from "../js/player-combat/ui/mobileActionList.js";

test("compact attack and recommendation rows include damage dice and type", () => {
  const option = {
    id: "attack_longbow",
    name: "Longbow",
    source: "weapon",
    tags: ["weapon", "attack", "ranged"],
    cost: { action: true },
    range: { label: "150/600 ft" },
    available: true,
    rolls: [
      { id: "attack", label: "Roll Attack", formula: "1d20+7", type: "attack" },
      { id: "damage", label: "Roll Damage", formula: "1d8+4", type: "damage", damageType: "piercing" }
    ]
  };

  const attacks = renderMobileActionList("attacks", "Attacks", [option], {});
  const recommendations = renderMobileActionList("recommended", "Recommended This Turn", [{
    ...option,
    recommendation: { reasons: ["High damage"] }
  }], {});

  assert.match(attacks, /150\/600 ft/);
  assert.match(attacks, /1d8\+4/);
  assert.match(attacks, /piercing/);
  assert.match(recommendations, /1d8\+4/);
  assert.match(recommendations, /piercing/);
});

test("actions list header includes synchronized turn cost filter", () => {
  const option = {
    id: "basic_dodge",
    name: "Dodge",
    source: "basic",
    cost: { action: true },
    available: true,
    rolls: []
  };

  const html = renderMobileActionList("actions", "Actions", [option], {}, {
    hideUnavailable: true,
    actionCostFilter: "bonus"
  });

  assert.match(html, /data-action-cost-filter/);
  assert.match(html, /<option value="">All<\/option>/);
  assert.match(html, /<option value="action"[^>]*>Action<\/option>/);
  assert.match(html, /<option value="bonus" selected>Bonus Action<\/option>/);
  assert.match(html, /<option value="reaction"[^>]*>Reaction<\/option>/);
});

test("recommended list header includes synchronized turn cost filter", () => {
  const html = renderMobileActionList("recommended", "Recommended This Turn", [{
    id: "healing_word",
    name: "Healing Word",
    source: "spell",
    cost: { bonus: true },
    available: true,
    rolls: [],
    recommendation: { reasons: ["Revive ally"] }
  }], {}, {
    actionCostFilter: "reaction"
  });

  assert.match(html, /data-action-cost-filter/);
  assert.match(html, /<option value="">All<\/option>/);
  assert.match(html, /<option value="reaction" selected>Reaction<\/option>/);
});

test("spells list header includes spell level filter and level column", () => {
  const html = renderMobileActionList("spells", "Spells", [{
    id: "spell_fireball",
    name: "Fireball",
    source: "spell",
    cost: { action: true, resource: { type: "spellSlot", level: 3 } },
    spell: { level: 3, range: "150 ft" },
    available: true,
    rolls: [{ id: "damage", type: "damage", formula: "8d6", damageType: "fire" }]
  }], {}, {
    spellLevelFilter: 3
  });

  assert.match(html, /data-spell-level-filter/);
  assert.match(html, /<option value="">All<\/option>/);
  assert.match(html, /<option value="0"[^>]*>Cantrips<\/option>/);
  assert.match(html, /<option value="3" selected>Level 3<\/option>/);
  assert.match(html, /aria-label="Level 3 spell">3<\/span>/);
});

test("recommended rows show spell level or named resource cost in the resource column", () => {
  const html = renderMobileActionList("recommended", "Recommended This Turn", [
    {
      id: "spell_healing_word",
      name: "Healing Word",
      source: "spell",
      cost: { bonus: true, resource: { type: "spellSlot", level: 1 } },
      spell: { level: 1 },
      available: true,
      rolls: [],
      recommendation: { reasons: ["Revive ally"] }
    },
    {
      id: "feature_flurry",
      name: "Flurry of Blows",
      source: "feature",
      cost: { bonus: true, resource: { type: "classResource", id: "ki", name: "Focus", amount: 1 } },
      available: true,
      rolls: [],
      recommendation: { reasons: ["Pressure target"] }
    }
  ], {});

  assert.match(html, /aria-label="Level 1 spell">1<\/span>/);
  assert.match(html, /aria-label="Focus">Focus<\/span>/);
});
