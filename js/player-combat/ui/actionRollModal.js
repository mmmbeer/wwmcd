import { rollDice } from "../core/diceRoller.js";
import { formatRollSummary } from "./diceResult.js";
import { escapeHtml } from "./renderUtils.js";

export async function resolvePlannedActionRolls({ modalApi, stateManager, options = [] }) {
  const rollOptions = options.filter((option) => primaryRoll(option));
  for (const option of rollOptions) {
    const confirmed = await showActionRollModal({ modalApi, stateManager, option });
    if (!confirmed) return false;
  }
  return true;
}

function showActionRollModal({ modalApi, stateManager, option }) {
  return new Promise((resolve) => {
    const roll = primaryRoll(option);
    const body = document.createElement("div");
    body.className = "action-roll-form";
    body.innerHTML = `
      <p class="roll-modal-summary">${escapeHtml(roll.label ?? option.name)}</p>
      <div class="roll-core">
        <span>Core roll</span>
        <strong>${escapeHtml(roll.formula)}</strong>
      </div>
      ${supportsAdvantage(roll.formula) ? `
        <label class="roll-check">
          <input type="checkbox" data-roll-advantage>
          <span>Roll with advantage</span>
        </label>
      ` : ""}
      <label class="field">
        <span>Additional dice</span>
        <input type="text" inputmode="text" data-extra-dice placeholder="Example: 1d4 or 2d6">
      </label>
      <div data-roll-feedback></div>
    `;

    let rolled = false;
    const resolveOnce = (value) => {
      if (resolveOnce.done) return;
      resolveOnce.done = true;
      resolve(value);
    };

    modalApi.showModal({
      title: `Roll ${option.name}`,
      body,
      onClose: () => resolveOnce(false),
      actions: [
        { label: "Cancel", variant: "secondary", onClick: () => resolveOnce(false) },
        {
          label: "Roll",
          variant: "primary",
          close: false,
          onClick: () => {
            const result = rollForForm(body, option, roll);
            const summary = formatRollSummary(result);
            if (result.ok) {
              stateManager.logRoll(result, summary);
              rolled = true;
            }
            body.querySelector("[data-roll-feedback]").innerHTML = `
              <div class="roll-result ${result.ok ? "is-ok" : "is-error"}">
                <span>${escapeHtml(result.ok ? "Result" : "Error")}</span>
                <strong>${escapeHtml(result.ok ? result.total : summary)}</strong>
                ${result.ok ? `<small>${escapeHtml(summary)}</small>` : ""}
              </div>
            `;
          }
        },
        {
          label: "OK",
          variant: "primary",
          close: false,
          onClick: () => {
            if (!rolled) {
              body.querySelector("[data-roll-feedback]").innerHTML = `<p class="inline-message warning">Roll before marking this action used.</p>`;
              return;
            }
            modalApi.close();
            resolveOnce(true);
          }
        }
      ]
    });
  });
}

function rollForForm(body, option, roll) {
  const extra = normalizeExtraDice(body.querySelector("[data-extra-dice]")?.value);
  const formula = [roll.formula, extra].filter(Boolean).join("+");
  const advantage = body.querySelector("[data-roll-advantage]")?.checked;
  if (!advantage || !supportsAdvantage(formula)) {
    return rollDice(formula, { label: `${option.name} ${roll.label}`, type: roll.type });
  }

  const first = rollDice(formula, { label: `${option.name} ${roll.label}`, type: roll.type });
  const second = rollDice(formula, { label: `${option.name} ${roll.label}`, type: roll.type });
  if (!first.ok) return first;
  if (!second.ok) return second;
  const selected = first.total >= second.total ? first : second;
  return {
    ...selected,
    label: `${option.name} ${roll.label} (advantage)`,
    alternatives: [first, second]
  };
}

function primaryRoll(option) {
  return option?.rolls?.find((roll) => roll.type === "attack" || roll.id === "attack")
    ?? option?.rolls?.find((roll) => roll.type === "check")
    ?? option?.rolls?.find((roll) => roll.type === "damage" && roll.id === "damage")
    ?? option?.rolls?.find((roll) => roll.type === "healing" || roll.id === "healing")
    ?? option?.rolls?.[0]
    ?? null;
}

function supportsAdvantage(formula) {
  return /\b1d20\b/i.test(String(formula ?? ""));
}

function normalizeExtraDice(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, "");
  if (!text) return "";
  return /^\d*d\d+(?:[+-]\d*d\d+)*$/i.test(text) ? text : "";
}
