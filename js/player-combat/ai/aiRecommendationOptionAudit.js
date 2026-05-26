const SPELL_ATTACK_NAMES = /\b(fire bolt|eldritch blast|guiding bolt|inflict wounds|shocking grasp|ray of frost|chromatic orb|scorching ray)\b/i;
const LOW_SYNERGY_BONUS = /\b(harness divine power|healing word)\b/i;
const TERRAIN_HAZARDS = /\b(ravine|cliff|pit|lava|hazard|chasm|ledge|precipice)\b/i;
const DANGEROUS_MELEE = /\b(multiattack|claw|bite|gore|pounce|swallow|grapple|restrain|paralyz|stun|cold gaze|chilling gaze|breath|aura)\b/i;
const TACTICAL_CATEGORIES = [
  "damage", "support", "control", "defense", "mobility", "rider", "setup",
  "reaction", "resourceSpend", "concentration", "area", "singleTarget", "saveOrAttack"
];

export function auditRecommendationContext({ availableOptions, optionIndex, deterministicRecommendations, character, combatState, playerIntent, selectedCreatures }) {
  const options = Object.values(availableOptions ?? {}).flat();
  const indexed = new Map((optionIndex ?? []).map((option) => [option.id, option]));
  const indexedOptions = [...indexed.values()];
  const spellAttackBonus = character?.spells?.attackBonus ?? null;
  const dangerousMelee = hasDangerousShortRangePressure(selectedCreatures);
  const hazards = TERRAIN_HAZARDS.test(`${playerIntent?.userNotes ?? ""} ${playerIntent?.situation ?? ""}`);

  const dataWarnings = [
    ...options.flatMap((option) => auditOption(option, spellAttackBonus)),
    ...auditDeterministicIds(deterministicRecommendations, indexed),
    ...auditTacticalMetadataCoverage(options)
  ];
  const ignoredDeterministicRecommendations = deterministicRecommendations
    .flatMap((set) => auditDeterministicSet(set, indexed, { dangerousMelee, hazards }));
  const candidateDowngrades = options.flatMap((option) => tacticalDowngrades(option, { dangerousMelee, hazards, playerIntent }));
  const highValueTacticalHooks = tacticalHooks({ options: indexedOptions, selectedCreatures, playerIntent, dangerousMelee, hazards });

  return {
    dataWarnings: unique(dataWarnings).slice(0, 12),
    ignoredDeterministicRecommendations: unique(ignoredDeterministicRecommendations).slice(0, 10),
    candidateDowngrades: unique(candidateDowngrades).slice(0, 10),
    highValueTacticalHooks: unique(highValueTacticalHooks).slice(0, 10)
  };
}

export function auditTacticalMetadataCoverage(options = []) {
  return (options ?? [])
    .filter((option) => option?.available !== false)
    .filter((option) => meaningfulCombatOption(option))
    .map((option) => {
      const categories = inferredTacticalCategories(option);
      if (categories.length) return null;
      return `${option.name} has no tactical metadata category (${TACTICAL_CATEGORIES.join(", ")}).`;
    })
    .filter(Boolean)
    .slice(0, 12);
}

export function validateDeterministicRecommendations(recommendations = [], optionIndex = []) {
  const indexed = new Map((optionIndex ?? []).map((option) => [option.id, option]));
  const ignored = [];
  const valid = [];

  (recommendations ?? []).forEach((set) => {
    const problems = deterministicSetProblems(set, indexed);
    if (problems.length) {
      ignored.push(`Removed deterministic recommendation "${set?.title ?? "Untitled recommendation"}": ${problems.join(" ")}`);
      return;
    }
    valid.push(set);
  });

  return { recommendations: valid, ignored };
}

function auditOption(option, spellAttackBonus) {
  const warnings = [];
  const name = String(option?.name ?? "");
  const isSpellNamedAttack = SPELL_ATTACK_NAMES.test(name);
  if (isSpellNamedAttack && option?.source === "weapon") warnings.push(`${name} is a spell attack represented as a weapon.`);
  if (option?.source === "spell" && optionHasAttackRoll(option) && option?.range?.type === "melee" && /ranged spell attack/i.test(option?.summary ?? "")) {
    warnings.push(`${name} is a ranged spell attack but has melee range metadata.`);
  }
  if (isSpellNamedAttack && option?.source === "weapon" && option?.range?.type === "melee") {
    warnings.push(`${name} is encoded as a melee weapon despite being a spell attack.`);
  }
  const attackFormula = option?.rolls?.find((roll) => roll.type === "attack" || roll.id === "spellAttack")?.formula;
  if (option?.source === "spell" && optionHasAttackRoll(option) && spellAttackBonus !== null && attackFormula && !attackFormula.includes(signed(spellAttackBonus))) {
    warnings.push(`${name} attack roll ${attackFormula} does not match spell attack bonus ${signed(spellAttackBonus)}.`);
  }
  if (/eldritch blast/i.test(name) && option?.attack?.count && option?.rollCount && Number(option.attack.count) !== Number(option.rollCount)) {
    warnings.push(`${name} attack count conflicts between attack.count and rollCount.`);
  }
  return warnings;
}

function auditDeterministicIds(recommendations, indexed) {
  return (recommendations ?? []).flatMap((set) => deterministicOptionIds(set)
    .filter((id) => id && !indexed.has(id))
    .map((id) => `Deterministic recommendation "${set.title}" references missing optionId ${id}.`));
}

function auditDeterministicSet(set, indexed, context) {
  const warnings = [];
  warnings.push(...deterministicSetProblems(set, indexed).map((problem) => `Ignore "${set.title}": ${problem}`));
  const pieces = set?.pieces ?? [];
  const options = pieces.map((piece) => piece?.option).filter(Boolean);
  const missing = options.filter((option) => option.id && !indexed.has(option.id));
  if (missing.length) warnings.push(`Ignore "${set.title}" until missing option IDs are fixed.`);
  const bonus = pieces.find((piece) => /bonus/i.test(piece?.slot ?? ""))?.option;
  const primary = pieces.find((piece) => /action|attack/i.test(piece?.slot ?? ""))?.option;
  if (bonus && isLowSynergyBonus(bonus, primary)) warnings.push(`Downgrade "${set.title}": ${bonus.name} does not materially improve this turn plan.`);
  if (hasMultipleConcentration(options)) warnings.push(`Downgrade "${set.title}": combines multiple concentration options.`);
  if (context.dangerousMelee && primary?.range?.type === "melee") warnings.push(`Downgrade "${set.title}": melee plan is risky against dangerous short-range pressure.`);
  if (context.hazards && options.some((option) => option?.cost?.movement || option?.group === "movement")) {
    warnings.push(`Treat "${set.title}" movement as conditional until a safe path around terrain hazards is known.`);
  }
  return warnings;
}

function deterministicSetProblems(set, indexed) {
  const pieces = Array.isArray(set?.pieces) ? set.pieces : [];
  const explicitIds = Array.isArray(set?.optionIds) ? set.optionIds.filter(Boolean) : [];
  if (!pieces.length && !explicitIds.length) return ["no concrete optionIds."];
  const pieceProblems = pieces.flatMap((piece) => {
    const option = piece?.option;
    const id = option?.id;
    if (!id) return [`${piece?.slot ?? "Plan piece"} has no optionId.`];
    const indexedOption = indexed.get(id);
    if (!indexedOption) return [`${id} is missing from optionIndex.`];
    if (option?.name && indexedOption.name && !sameName(option.name, indexedOption.name)) {
      return [`${id} is named "${option.name}" but optionIndex names it "${indexedOption.name}".`];
    }
    return [];
  });
  const idProblems = explicitIds
    .filter((id) => !indexed.has(id))
    .map((id) => `${id} is missing from optionIndex.`);
  return [...pieceProblems, ...idProblems];
}

function deterministicOptionIds(set) {
  return [
    ...(Array.isArray(set?.optionIds) ? set.optionIds : []),
    ...(Array.isArray(set?.pieces) ? set.pieces.map((piece) => piece?.option?.id) : [])
  ].filter(Boolean);
}

function tacticalDowngrades(option, { dangerousMelee, hazards, playerIntent }) {
  const warnings = [];
  if (dangerousMelee && option?.range?.type === "melee" && option?.source === "spell") {
    warnings.push(`${option.name} is touch/melee range and should be downgraded if ranged options are available.`);
  }
  if (hazards && (option?.cost?.movement || option?.group === "movement")) {
    warnings.push(`${option.name} movement is conditional near hazards unless a safe path is explicitly stated.`);
  }
  if (/^unknown$/i.test(playerIntent?.range ?? "") && /\b\d+\s*ft\b/i.test(playerIntent?.userNotes ?? "")) {
    warnings.push("Use the concrete distance in user notes instead of the generic unknown range answer.");
  }
  return warnings;
}

function tacticalHooks({ options, selectedCreatures, playerIntent, dangerousMelee, hazards }) {
  const hooks = [];
  const creatureText = JSON.stringify(selectedCreatures ?? []).toLowerCase();
  const immunities = new Set((selectedCreatures ?? []).flatMap((creature) => creature.immunities ?? []));
  if (dangerousMelee) hooks.push("Selected creature has dangerous short-range pressure; ending outside that danger zone may outrank raw damage.");
  if (hazards) hooks.push("Terrain hazards are present; movement should be conditional unless a safe path is stated.");
  if (/\bfire\b/.test(creatureText)) hooks.push("Fire damage has creature-specific tactical relevance; distinguish weakness, immunity, and triggered behavior before ranking it.");
  immunities.forEach((type) => hooks.push(`Avoid ${type} damage when alternatives exist because selected creature context lists immunity.`));
  if (options.some((option) => /\bhex\b/i.test(option.name)) && options.some((option) => /eldritch blast/i.test(option.name))) {
    hooks.push("Hex plus Eldritch Blast is high value against a durable single target when concentration and range are legal.");
  }
  if (/\b\d+\s*ft\b/i.test(playerIntent?.userNotes ?? "")) hooks.push("User notes include a concrete distance; use it for range legality.");
  return hooks;
}

function meaningfulCombatOption(option) {
  return option?.cost?.action
    || option?.cost?.bonus
    || option?.cost?.reaction
    || option?.cost?.movement
    || option?.resource
    || option?.spell
    || option?.source === "feature";
}

function inferredTacticalCategories(option) {
  const categories = new Set([
    ...(option?.tactics?.roles ?? []),
    ...(option?.tags ?? []),
    ...(option?.damageTypes?.length ? ["damage"] : []),
    ...(option?.spell?.concentration ? ["concentration"] : []),
    ...(option?.resource || option?.cost?.resource ? ["resourceSpend"] : []),
    ...(option?.cost?.reaction ? ["reaction"] : [])
  ]);
  const text = `${option?.name ?? ""} ${option?.summary ?? ""} ${option?.description ?? ""} ${option?.spell?.reference?.description ?? ""}`.toLowerCase();
  if (/\b(damage|deal|hit points?|attack)\b/.test(text)) categories.add("damage");
  if (/\b(heal|restore|help|bless|buff|ally)\b/.test(text)) categories.add("support");
  if (/\b(restrain|prone|frighten|charm|stun|slow|control|save)\b/.test(text)) categories.add("control");
  if (/\b(ac|dodge|shield|protect|temporary hit points|resistance)\b/.test(text)) categories.add("defense");
  if (/\b(move|dash|disengage|teleport|speed|fly|climb)\b/.test(text)) categories.add("mobility");
  if (/\b(on a hit|when you hit|rider|smite|sneak attack|stunning strike)\b/.test(text)) categories.add("rider");
  if (/\b(setup|advantage|mark|hex|hunter'?s mark)\b/.test(text)) categories.add("setup");
  if (/\b(area|radius|cone|cube|sphere|line)\b/.test(text)) categories.add("area");
  if (/\b(single target|one target|a target|one creature)\b/.test(text)) categories.add("singleTarget");
  if (optionHasAttackRoll(option) || option?.spell?.requiresSave || option?.spell?.saveAbility || /\bsaving throw\b/.test(text)) {
    categories.add("saveOrAttack");
  }
  return [...categories].filter((category) => TACTICAL_CATEGORIES.includes(category));
}

function sameName(left, right) {
  return String(left ?? "").trim().toLowerCase() === String(right ?? "").trim().toLowerCase();
}

function optionHasAttackRoll(option) {
  return (option?.rolls ?? []).some((roll) => roll.type === "attack" || roll.id === "spellAttack");
}

function isLowSynergyBonus(bonus, primary) {
  if (LOW_SYNERGY_BONUS.test(bonus?.name ?? "")) return !/heal/i.test(bonus?.name ?? "") || !/ally|injur|down/i.test(primary?.summary ?? "");
  const text = `${bonus?.name ?? ""} ${bonus?.summary ?? ""} ${(bonus?.tags ?? []).join(" ")}`;
  if (/\b(hex|hunter'?s mark|smite|rage|sanctuary|shield of faith|misty step|dash|disengage|hide|heal|restore hit points)\b/i.test(text)) return false;
  return Boolean(primary?.rolls?.some((roll) => roll.type === "damage"));
}

function hasMultipleConcentration(options) {
  return options.filter((option) => option?.spell?.concentration).length > 1;
}

function hasDangerousShortRangePressure(creatures = []) {
  return creatures.some((creature) => [
    ...(creature.traits ?? []),
    ...(creature.actions ?? []),
    ...(creature.bonusActions ?? []),
    ...(creature.legendaryActions ?? [])
  ].some((entry) => DANGEROUS_MELEE.test(`${entry.name ?? ""} ${entry.summary ?? ""}`)));
}

function signed(value) {
  return Number(value) >= 0 ? `+${value}` : String(value);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
