import {
  characterSpellNames,
  isSpellLikeWeaponItem
} from "./aiRecommendationOptionSanitizer.js";

export function summarizeCharacter(character, combatState) {
  if (!character) return null;
  const spellNames = characterSpellNames(character);
  return pruneEmpty({
    name: character.name,
    level: character.level,
    race: character.race?.name,
    classes: (character.classes ?? []).map((entry) => ({
      name: entry.name,
      subclass: entry.subclass,
      level: entry.level
    })),
    stats: character.stats,
    combat: character.combat,
    resources: summarizeCharacterResources(character),
    features: summarizeFeatureBuckets(character.features),
    traits: summarizeList(character.race?.features, 24),
    equipment: summarizeInventory(character.inventory, spellNames),
    spells: summarizeSpells(character.spells, character, combatState)
  });
}

export function summarizeCombatState(state, character) {
  if (!state) return null;
  return {
    round: state.round,
    hp: {
      current: state.current?.hp,
      max: character?.combat?.maxHp,
      temp: state.current?.tempHp
    },
    ac: state.current?.ac,
    conditions: state.current?.conditions ?? [],
    concentration: state.current?.concentration,
    activeEffects: state.current?.activeEffects ?? [],
    currentForm: state.current?.currentForm,
    turn: state.turn,
    resourcesUsed: state.resourcesUsed,
    lastRoll: state.lastRoll
  };
}

function summarizeCharacterResources(character) {
  return {
    spellSlots: character.resources?.spellSlots ?? {},
    classResources: summarizeList(character.resources?.classResources, 30),
    limitedUses: summarizeList(character.resources?.limitedUses, 30)
  };
}

function summarizeFeatureBuckets(features = {}) {
  return Object.fromEntries(Object.entries(features).map(([key, value]) => [key, summarizeList(value, 35)]));
}

function summarizeInventory(inventory = {}, spellNames = new Set()) {
  return {
    weapons: summarizeList((inventory.weapons ?? []).filter((item) => !isSpellLikeWeaponItem(item, spellNames)), 30),
    armor: summarizeList(inventory.armor, 20),
    consumables: summarizeList(inventory.consumables, 25),
    magicItems: summarizeList(inventory.magicItems, 25),
    items: summarizeList(inventory.other, 50)
  };
}

function summarizeSpells(spells = {}, character, combatState) {
  return pruneEmpty({
    spellcastingAbility: spells.spellcastingAbility,
    attackBonus: spells.attackBonus,
    saveDc: spells.saveDc,
    cantrips: summarizeList(spells.cantrips, 30),
    prepared: summarizeList(filterCastableSpells(spells.prepared, character, combatState), 80),
    known: summarizeList(filterCastableSpells(spells.known, character, combatState), 100)
  });
}

function filterCastableSpells(spells = [], character, combatState) {
  return (spells ?? []).filter((spell) => {
    const level = normalizeSpellLevel(spell?.level);
    return level === 0 || remainingSpellSlots(character, combatState, level) > 0;
  });
}

function remainingSpellSlots(character, combatState, level) {
  const slots = character?.resources?.spellSlots ?? {};
  const max = spellSlotMax(slots[level]);
  const used = Number(combatState?.resourcesUsed?.spellSlots?.[level] ?? 0);
  return Math.max(0, max - used);
}

function spellSlotMax(value) {
  if (value && typeof value === "object") return Number(value.available ?? value.max ?? value.value ?? 0);
  return Number(value ?? 0);
}

function normalizeSpellLevel(level) {
  if (String(level).toLowerCase() === "cantrip") return 0;
  const numeric = Number(level);
  return Number.isFinite(numeric) ? numeric : 0;
}

function summarizeList(items = [], max = 20) {
  return (items ?? []).slice(0, max).map((item) => {
    if (typeof item === "string") return item;
    return {
      name: item.name,
      level: item.level,
      prepared: item.prepared,
      equipped: item.equipped,
      quantity: item.quantity,
      damage: item.damage,
      damageType: item.damageType,
      properties: item.properties,
      max: item.max,
      reset: item.reset,
      note: item.note,
      description: trimText(item.description ?? item.snippet ?? item.text, 500)
    };
  });
}

function trimText(value, max) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function pruneEmpty(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => {
    if (entry == null || entry === "") return false;
    if (Array.isArray(entry)) return entry.length > 0;
    if (typeof entry === "object") return Object.keys(entry).length > 0;
    return true;
  }));
}
