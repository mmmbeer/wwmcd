export function getBasicActions(character) {
  const speed = Number(character?.combat?.speed?.walk ?? 0);
  return [
    basic("basic_dash", "Dash", `Gain extra movement equal to your speed (${speed} ft).`, { action: true }, true),
    basic("basic_disengage", "Disengage", "Your movement does not provoke opportunity attacks this turn.", { action: true }),
    basic("basic_dodge", "Dodge", "Attackers have disadvantage and you gain advantage on Dexterity saves.", { action: true }, true),
    basic("basic_help", "Help", "Give an ally advantage on an ability check or attack against a nearby foe.", { action: true }),
    basic("basic_hide", "Hide", "Make a Dexterity (Stealth) check when you have cover or concealment.", { action: true }, false, {
      rolls: [{ id: "stealth", label: "Roll Stealth", formula: abilityCheck(character, "dex"), type: "check" }]
    }),
    basic("basic_ready", "Ready", "Prepare a perceivable trigger and response.", { action: true }),
    basic("basic_search", "Search", "Make a Wisdom (Perception) or Intelligence (Investigation) check.", { action: true }, false, {
      rolls: [
        { id: "perception", label: "Roll Perception", formula: abilityCheck(character, "wis"), type: "check" },
        { id: "investigation", label: "Roll Investigation", formula: abilityCheck(character, "int"), type: "check" }
      ]
    }),
    basic("basic_object_interaction", "Object Interaction", "Draw, stow, open, close, pick up, or hand off one simple object.", { object: true }),
    basic("basic_use_object", "Use an Object", "Interact with a second object or use an item that needs your action.", { action: true, object: true })
  ];
}

function basic(id, name, description, cost, recommended = false, extra = {}) {
  return {
    id,
    name,
    description,
    source: "basic",
    group: "action",
    tags: ["basic"],
    cost,
    recommended,
    rolls: [],
    ...extra
  };
}

function abilityCheck(character, ability) {
  const modifier = Math.floor((Number(character?.stats?.[ability] ?? 10) - 10) / 2);
  return `1d20${signed(modifier)}`;
}

function signed(value) {
  return value >= 0 ? `+${value}` : String(value);
}
