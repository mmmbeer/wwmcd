const DEFAULT_ANSWERS = {
  goal: "balanced",
  situation: "single",
  difficulty: "medium"
};

const POST_ATTACK_RIDERS = /\b(divine smite|sneak attack|stunning strike|great weapon master: heavy attack)\b/i;
const TRUE_FREE_ACTIONS = /\b(speak|drop an item|drop item|drop prone|stop concentrating|end concentration|object interaction)\b/i;

export function getRankedRecommendationSets({ rankedEntries, answers = {} }) {
  const resolvedAnswers = { ...DEFAULT_ANSWERS, ...answers };
  const available = rankedEntries.filter((entry) => entry.option.available !== false);
  const actions = available.filter((entry) => entry.option.cost?.action);
  const bonus = available.filter((entry) => entry.option.cost?.bonus);
  const reactions = available.filter((entry) => entry.option.cost?.reaction);
  const movement = available.filter((entry) => entry.option.cost?.movement || entry.option.group === "movement");
  const free = available.filter((entry) => isTrueFreeOption(entry.option));
  const riders = available.filter((entry) => isPostAttackRider(entry.option));
  const special = available.filter((entry) => isSpecialNoActionOption(entry.option));
  const primaries = actions.length ? actions : available.filter((entry) => !entry.option.cost?.reaction).slice(0, 4);

  return primaries.slice(0, 5).map((primary, index) => {
    const pieces = [piece("Action", primary)];
    const nextBonus = firstDifferent(bonus, pieces);
    const nextRider = firstDifferent(riders.filter((entry) => canFollowPrimary(entry.option, primary.option)), pieces);
    const nextSpecial = firstDifferent(special.filter((entry) => canFollowPrimary(entry.option, primary.option)), pieces);
    const nextMove = firstDifferent(movement, pieces);
    const nextFree = free.filter((entry) => !pieces.some((item) => item.entry.option.id === entry.option.id)).slice(0, 2);
    const wantsReaction = resolvedAnswers.goal === "defense"
      || resolvedAnswers.situation === "self"
      || resolvedAnswers.difficulty === "hard"
      || resolvedAnswers.difficulty === "deadly";
    const nextReaction = wantsReaction ? firstDifferent(reactions, pieces) : null;

    if (nextRider) pieces.push(piece("Rider", nextRider));
    if (nextSpecial) pieces.push(piece("Special", nextSpecial));
    if (nextBonus) pieces.push(piece("Bonus", nextBonus));
    nextFree.forEach((entry) => pieces.push(piece("Free", entry)));
    if (nextMove) pieces.push(piece("Move", nextMove));
    if (nextReaction) pieces.push(piece("Reaction", nextReaction));

    const score = Math.round(pieces.reduce((total, item, pieceIndex) => total + item.entry.score * (pieceIndex ? 0.45 : 1), 0));
    return {
      id: `recommendation-set-${index + 1}`,
      rank: index + 1,
      score,
      title: setTitle(primary.option, resolvedAnswers),
      pieces,
      reasons: setReasons(pieces),
      warnings: [...new Set(pieces.flatMap((item) => item.entry.warnings ?? []))].slice(0, 3)
    };
  }).sort((a, b) => b.score - a.score).map((set, index) => ({ ...set, rank: index + 1 }));
}

function canFollowPrimary(option, primary) {
  if (requiresAttackAction(option)) return isAttackAction(primary);
  return true;
}

function requiresAttackAction(option) {
  return POST_ATTACK_RIDERS.test(option.name) || /\bafter (?:a|an|the)?\s*(?:melee |ranged |weapon )?(?:weapon )?hit\b/i.test(optionText(option));
}

function isAttackAction(option) {
  return Boolean(option.cost?.action) && (option.tags?.includes("attack") || option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack"));
}

function isPostAttackRider(option) {
  return requiresAttackAction(option) && !option.cost?.action && !option.cost?.bonus && !option.cost?.reaction && !option.cost?.movement;
}

function isSpecialNoActionOption(option) {
  if (isTrueFreeOption(option) || isPostAttackRider(option)) return false;
  return !option.cost?.action && !option.cost?.bonus && !option.cost?.reaction && !option.cost?.movement && !option.cost?.object;
}

function isTrueFreeOption(option) {
  if (option.cost?.action || option.cost?.bonus || option.cost?.reaction || option.cost?.movement) return false;
  if (option.cost?.object) return true;
  return TRUE_FREE_ACTIONS.test(option.name);
}

function firstDifferent(entries, pieces) {
  return entries.find((entry) => !pieces.some((piece) => piece.entry.option.id === entry.option.id));
}

function piece(slot, entry) {
  return { slot, entry };
}

function setTitle(option, answers) {
  const goal = {
    balanced: "Balanced turn",
    damage: "Damage turn",
    support: "Support turn",
    control: "Control turn",
    defense: "Defensive turn",
    mobility: "Mobility turn"
  }[answers.goal] ?? "Recommended turn";
  return `${goal}: ${option.name}`;
}

function setReasons(pieces) {
  const reasons = pieces.flatMap((piece) => piece.entry.reasons ?? []);
  return [...new Set(reasons)].slice(0, 6);
}

function optionText(option) {
  return [
    option.description,
    option.longDescription,
    option.featureAction?.description,
    ...(option.meta ?? [])
  ].filter(Boolean).join(" ");
}
