import {
  canPairAfterPrimary,
  isAttackAction,
  isDependentOption,
  prerequisiteKind
} from "./recommendationPrerequisites.js";
import { attackCapacity } from "../rules/attackActionRules.js";

const DEFAULT_ANSWERS = {
  goal: "damage",
  situation: "single",
  difficulty: "medium"
};

const TRUE_FREE_ACTIONS = /\b(speak|drop an item|drop item|drop prone|stop concentrating|end concentration|object interaction)\b/i;

export function getRankedRecommendationSets({ rankedEntries, answers = {} }) {
  const resolvedAnswers = { ...DEFAULT_ANSWERS, ...answers };
  const available = rankedEntries.filter((entry) => entry.option.available !== false);
  const actions = available.filter((entry) => entry.option.cost?.action);
  const bonus = available.filter((entry) => entry.option.cost?.bonus);
  const reactions = available.filter((entry) => entry.option.cost?.reaction);
  const movement = available.filter((entry) => entry.option.cost?.movement || entry.option.group === "movement");
  const attackActions = actions.filter((entry) => isAttackAction(entry.option));
  const free = available.filter((entry) => isTrueFreeOption(entry.option));
  const riders = available.filter((entry) => isPostAttackRider(entry.option));
  const special = available.filter((entry) => isSpecialNoActionOption(entry.option));
  const primaries = actions.length ? actions : available.filter((entry) => !entry.option.cost?.reaction).slice(0, 4);

  return primaries.slice(0, 5).map((primary, index) => {
    const attackCount = attackActionCount(primary.option);
    const pieces = [piece(attackCount > 1 ? "Attack 1" : slotForOption(primary.option), primary)];
    addExtraAttacks(pieces, primary, attackActions, attackCount);
    const nextBonus = firstCompatible(bonus.filter((entry) => canFollowPrimary(entry.option, primary.option)), pieces);
    const nextRider = firstCompatible(riders.filter((entry) => canFollowPrimary(entry.option, primary.option)), pieces);
    const nextSpecial = firstCompatible(special.filter((entry) => canFollowPrimary(entry.option, primary.option)), pieces);
    const nextMove = firstCompatible(movement, pieces);
    const nextFree = free.filter((entry) => canAddEntry(entry, pieces)).slice(0, 2);
    const wantsReaction = resolvedAnswers.goal === "defense"
      || resolvedAnswers.situation === "self"
      || resolvedAnswers.difficulty === "hard"
      || resolvedAnswers.difficulty === "deadly";
    const nextReaction = wantsReaction ? firstCompatible(reactions, pieces) : null;

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

function addExtraAttacks(pieces, primary, attackActions, attackCount) {
  if (attackCount <= 1 || !isAttackAction(primary.option)) return;
  for (let index = 2; index <= attackCount; index += 1) {
    const next = firstCompatible(attackActions, pieces) ?? primary;
    pieces.push(piece(`Attack ${index}`, next));
  }
}

function attackActionCount(option) {
  return attackCapacity(option);
}

function canFollowPrimary(option, primary) {
  return canPairAfterPrimary(option, primary);
}

function isPostAttackRider(option) {
  return (prerequisiteKind(option) === "hit" || prerequisiteKind(option) === "weaponHit")
    && !option.cost?.action
    && !option.cost?.bonus
    && !option.cost?.reaction
    && !option.cost?.movement;
}

function isSpecialNoActionOption(option) {
  if (isTrueFreeOption(option) || isPostAttackRider(option)) return false;
  if (isDependentOption(option)) return false;
  return !option.cost?.action && !option.cost?.bonus && !option.cost?.reaction && !option.cost?.movement && !option.cost?.object;
}

function isTrueFreeOption(option) {
  if (option.cost?.action || option.cost?.bonus || option.cost?.reaction || option.cost?.movement) return false;
  if (option.cost?.object) return true;
  return TRUE_FREE_ACTIONS.test(option.name);
}

function firstCompatible(entries, pieces) {
  return entries.find((entry) => canAddEntry(entry, pieces));
}

function canAddEntry(entry, pieces) {
  if (pieces.some((piece) => piece.entry.option.id === entry.option.id)) return false;
  if (isLeveledSpell(entry.option) && pieces.some((piece) => isLeveledSpell(piece.entry.option))) return false;
  return true;
}

function isLeveledSpell(option) {
  return Boolean(option?.spell) && Number(option.spell?.level ?? 0) > 0;
}

function piece(slot, entry) {
  return { slot, entry };
}

function slotForOption(option) {
  if (option.cost?.action) return "Action";
  if (option.cost?.bonus) return "Bonus";
  if (option.cost?.reaction) return "Reaction";
  if (option.cost?.movement || option.group === "movement") return "Move";
  if (isTrueFreeOption(option)) return "Free";
  return "Special";
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
