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
