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
