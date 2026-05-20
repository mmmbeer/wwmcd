import { extractFeatures } from "./pdfFeatureExtractor.js";
import { cleanValue, field, firstField } from "./pdfFieldUtils.js";

const ABILITY_FIELDS = [
  ["str", 1, "STR"],
  ["dex", 2, "DEX"],
  ["con", 3, "CON"],
  ["int", 4, "INT"],
  ["wis", 5, "WIS"],
  ["cha", 6, "CHA"]
];

export function buildNormalizerInput(fields, sourceName) {
  const classes = parseClasses(firstField(fields, ["CLASS LEVEL", "ClassLevel"]));
  const level = classes.reduce((sum, entry) => sum + Number(entry.level ?? 0), 0);
  const proficiencyBonus = numberFrom(field(fields, "ProfBonus"), proficiencyBonusForLevel(level));
  const spells = extractSpells(fields);
  return {
    name: firstField(fields, ["CharacterName", "CharacterName2", "CharacterName4"]) || sourceName.replace(/\.pdf$/i, ""),
    race: { name: firstField(fields, ["RACE", "RACE2", "Race"]) },
    classes,
    stats: ABILITY_FIELDS.map(([, id, name]) => ({ id, value: numberFrom(field(fields, name), 10) })),
    baseHitPoints: numberFrom(firstField(fields, ["MaxHP", "HPMax"]), 0),
    currentHp: numberFrom(firstField(fields, ["CurrentHP", "HPCurrent"]), numberFrom(firstField(fields, ["MaxHP", "HPMax"]), 0)),
    temporaryHitPoints: numberFrom(firstField(fields, ["TempHP", "HPTemp"]), 0),
    armorClass: numberFrom(field(fields, "AC"), 10),
    initiative: numberFrom(firstField(fields, ["Init", "Initiative"]), 0),
    proficiencyBonus,
    speed: { walk: numberFromText(field(fields, "Speed"), 30) },
    inventory: extractWeapons(fields),
    spellSlots: Object.fromEntries(spells.slots.map((slot) => [slot.level, slot.max])),
    spells: { pdf: spells.known },
    features: extractFeatures(fields),
    source: { type: "pdf", sourceName, importedAt: new Date().toISOString() }
  };
}

function parseClasses(value) {
  const text = cleanValue(value);
  if (!text) return [];
  const entries = text.split(/\s*(?:\/|,|;|\band\b)\s*/i).map((part) => {
    const match = part.match(/^(.+?)\s+(\d+)$/);
    return match ? { name: match[1].trim(), level: Number(match[2]) } : null;
  }).filter(Boolean);
  return entries.length ? entries : [{ name: text, level: 0 }];
}

function extractWeapons(fields) {
  const weapons = [];
  for (let index = 1; index <= 12; index += 1) {
    const suffix = index === 1 ? "" : ` ${index}`;
    const name = field(fields, `Wpn Name${suffix}`);
    if (!name) continue;
    const damage = parseDamage(field(fields, `Wpn${index} Damage`));
    weapons.push({
      equipped: true,
      definition: {
        name,
        filterType: "Weapon",
        type: "Weapon",
        damage: damage.dice ? { diceString: damage.dice } : null,
        damageType: damage.type,
        propertiesText: field(fields, `Wpn Notes ${index}`)
      }
    });
  }
  return weapons;
}

function extractSpells(fields) {
  let currentLevel = 0;
  const slots = [];
  const spells = [];
  const castingAbility = abilityFromText(field(fields, "spellCastingAbility0"));

  for (const [name, value] of fields.entries()) {
    const clean = cleanValue(value);
    if (/^spellHeader\d+$/i.test(name)) {
      currentLevel = parseSpellHeaderLevel(clean);
      continue;
    }
    if (/^spellSlotHeader\d+$/i.test(name)) {
      const slot = parseSpellSlotHeader(clean, currentLevel);
      if (slot) slots.push(slot);
      continue;
    }

    const match = name.match(/^spellName(\d+)$/i);
    if (!match || !clean) continue;
    const index = match[1];
    const saveHit = field(fields, `spellSaveHit${index}`);
    spells.push({
      prepared: isMarked(field(fields, `spellPrepared${index}`)) || currentLevel === 0,
      spellCastingAbilityId: castingAbility,
      definition: {
        name: clean,
        level: currentLevel,
        castingTime: field(fields, `spellCastingTime${index}`),
        range: field(fields, `spellRange${index}`),
        duration: field(fields, `spellDuration${index}`),
        concentration: /concentration/i.test(field(fields, `spellDuration${index}`)),
        description: [field(fields, `spellNotes${index}`), saveHit].filter(Boolean).join(" "),
        saveDcAbilityId: abilityIdFromSaveHit(saveHit)
      }
    });
  }

  return { known: uniqueSpells(spells), slots: uniqueSlots(slots) };
}

function parseSpellHeaderLevel(value) {
  if (/cantrip/i.test(value)) return 0;
  const match = String(value ?? "").match(/(\d+)(?:st|nd|rd|th)?\s+level/i);
  return match ? Number(match[1]) : 0;
}

function parseSpellSlotHeader(value, level) {
  const match = String(value ?? "").match(/(\d+)\s+Slots?/i);
  return match && level > 0 ? { level, max: Number(match[1]) } : null;
}

function parseDamage(value) {
  const match = String(value ?? "").match(/(\d+d\d+)(?:\s*[+-]\s*\d+)?\s*([a-z]+)?/i);
  return { dice: match?.[1] ?? "", type: match?.[2] ?? "" };
}

function abilityFromText(value) {
  return ({ str: 1, strength: 1, dex: 2, dexterity: 2, con: 3, constitution: 3, int: 4, intelligence: 4, wis: 5, wisdom: 5, cha: 6, charisma: 6 })[
    String(value ?? "").trim().toLowerCase()
  ] ?? null;
}

function abilityIdFromSaveHit(value) {
  const match = String(value ?? "").match(/\b(STR|DEX|CON|INT|WIS|CHA)\b/i);
  return abilityFromText(match?.[1]);
}

function isMarked(value) {
  return /^(yes|true|on|1|x|checked)$/i.test(String(value ?? "").trim());
}

function uniqueSpells(spells) {
  const seen = new Set();
  return spells.filter((spell) => {
    const key = spell.definition.name.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueSlots(slots) {
  const byLevel = new Map();
  for (const slot of slots) byLevel.set(slot.level, slot);
  return [...byLevel.values()];
}

function numberFrom(value, fallback) {
  const numeric = Number(String(value ?? "").replace(/^\+/, ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function numberFromText(value, fallback) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : fallback;
}

function proficiencyBonusForLevel(level) {
  return Math.max(2, Math.ceil((Number(level || 1) - 1) / 4) + 2);
}
