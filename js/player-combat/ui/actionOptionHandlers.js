import { rollDamage, rollDice } from "../core/diceRoller.js";
import { formatRollSummary } from "./diceResult.js";
import { showConfirmModal } from "./modal.js";
import { escapeHtml } from "./renderUtils.js";

export function handleRoll(button, groups, stateManager, showToast) {
  const option = findOption(groups, button.dataset.rollOption);
  const roll = option?.rolls?.find((entry) => entry.id === button.dataset.rollId);
  if (!option || !roll) return;

  const result = roll.type === "damage"
    ? rollDamage({ formula: roll.formula, label: `${option.name} ${roll.label}` })
    : rollDice(roll.formula, { label: `${option.name} ${roll.label}`, type: roll.type });

  const summary = formatRollSummary(result);
  stateManager.logRoll(result, summary);
  showToast?.({ type: result.ok ? "info" : "error", message: summary });
}

export function useOption(option, combatState, stateManager, modalApi) {
  if (blocksSecondLeveledSpell(option, combatState)) {
    modalApi.showModal({
      title: "Leveled Spell Already Cast",
      body: `<p>${escapeHtml(secondLeveledSpellMessage(option, combatState))}</p>`,
      actions: [{ label: "OK", variant: "primary" }]
    });
    return;
  }

  if (option.spell?.concentration && combatState.current?.concentration) {
    showConfirmModal(modalApi, {
      title: "Replace Concentration?",
      message: concentrationWarningMessage(option, combatState),
      confirmLabel: "Cast Spell",
      onConfirm: () => stateManager.useCombatOption(option)
    });
    return;
  }
  stateManager.useCombatOption(option);
}

export function findOption(groups, id) {
  return Object.values(groups).flat().find((option) => option.id === id);
}

function blocksSecondLeveledSpell(option, combatState) {
  return option.source === "spell"
    && Number(option.spell?.level ?? 0) > 0
    && combatState.turn?.leveledSpellCast;
}

function secondLeveledSpellMessage(option, combatState) {
  const current = combatState.turn?.leveledSpellName;
  return current
    ? `You already cast ${current}, a leveled spell, this turn. You cannot cast ${option.name} as another leveled spell this turn.`
    : `You already cast a leveled spell this turn. You cannot cast ${option.name} as another leveled spell this turn.`;
}

function concentrationWarningMessage(option, combatState) {
  const current = combatState.current?.concentration;
  const source = combatState.current?.concentrationSource;
  const currentText = source === "spell" && current
    ? `You are currently concentrating on ${current}.`
    : "You are currently concentrating.";
  return `${currentText} Casting ${option.name} will end that concentration.`;
}
