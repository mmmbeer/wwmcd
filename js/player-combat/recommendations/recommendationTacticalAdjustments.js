const MARK_DAMAGE_SPELL_TERMS = /\b(hex|hunter'?s mark)\b/i;
const DAMAGE_TYPES = ["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"];

export function applySpecialTacticalAdjustments(scores, option, context) {
  applyMarkDamageSpellAdjustments(scores, option, context);
  applyBattlefieldKnowledgeAdjustments(scores, option, context);
}

export function specialTacticalReasons(option, context) {
  if (isMarkDamageSpell(option) && !context.combatState?.current?.concentration) {
    return ["Sets up bonus-action damage concentration"];
  }
  return [];
}

export function specialTacticalWarnings(option, context) {
  const avoided = avoidedDamageTypes(option, context.battlefieldKnowledge);
  return avoided.length ? [`Avoid ${avoided.join("/")} damage against the named creature if possible.`] : [];
}

export function inferBattlefieldKnowledge(answers) {
  const text = [answers.userNotes, answers.situation].filter(Boolean).join(" ").toLowerCase();
  const avoidDamageTypes = [];
  if (/\b(red|gold|brass)\s+dragon\b|\bfire\s+elemental\b/.test(text)) avoidDamageTypes.push("fire");
  if (/\b(blue|bronze)\s+dragon\b/.test(text)) avoidDamageTypes.push("lightning");
  if (/\b(green)\s+dragon\b|\bfire\s+elemental\b/.test(text)) avoidDamageTypes.push("poison");
  if (/\b(black|copper)\s+dragon\b/.test(text)) avoidDamageTypes.push("acid");
  if (/\b(white|silver)\s+dragon\b|\bfrost\s+giant\b/.test(text)) avoidDamageTypes.push("cold");
  return { avoidDamageTypes: [...new Set(avoidDamageTypes)] };
}

function applyMarkDamageSpellAdjustments(scores, option, context) {
  if (!isMarkDamageSpell(option)) return;
  scores.damage += context.answers.situation === "single" || context.answers.situation === "bigBad" ? 28 : 16;
  scores.control += 6;
  if (!context.combatState?.current?.concentration) scores.resourceFit += 14;
  if (context.answers.resources !== "conserve") scores.resourceFit += 8;
}

function applyBattlefieldKnowledgeAdjustments(scores, option, context) {
  const avoided = avoidedDamageTypes(option, context.battlefieldKnowledge);
  if (!avoided.length) return;
  scores.damage -= 110;
  scores.control -= 18;
  if (option.cost?.resource || option.resource) scores.resourceFit -= 24;
}

function isMarkDamageSpell(option) {
  return Boolean(option?.spell)
    && option.cost?.bonus
    && option.spell?.concentration
    && MARK_DAMAGE_SPELL_TERMS.test(option.name);
}

function avoidedDamageTypes(option, battlefieldKnowledge = {}) {
  const avoid = new Set((battlefieldKnowledge.avoidDamageTypes ?? []).map((type) => String(type).toLowerCase()));
  if (!avoid.size) return [];
  return optionDamageTypes(option).filter((type) => avoid.has(type));
}

function optionDamageTypes(option) {
  const explicit = [
    option.damageType,
    option.damage?.type,
    ...(Array.isArray(option.damageTypes) ? option.damageTypes : []),
    ...(Array.isArray(option.rolls) ? option.rolls.map((roll) => roll.damageType ?? roll.typeLabel) : [])
  ];
  const text = [
    ...explicit,
    option.name,
    option.description,
    option.longDescription,
    option.spell?.reference?.description
  ].filter(Boolean).join(" ");
  return [...new Set(DAMAGE_TYPES.filter((type) => new RegExp(`\\b${type}\\b`, "i").test(text)))];
}
