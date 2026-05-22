import { rollDice } from "../core/diceRoller.js";
import { formatRollSummary } from "./diceResult.js";
import { escapeHtml } from "./renderUtils.js";

export function resolveActionRoll({ modalApi, stateManager, option }) {
  if (!rollBundle(option).length) return Promise.resolve(true);
  return showActionRollModal({ modalApi, stateManager, option });
}

function showActionRollModal({ modalApi, stateManager, option }) {
  return new Promise((resolve) => {
    const rolls = rollBundle(option);
    const body = document.createElement("div");
    body.className = "action-roll-form";
    body.innerHTML = `
      <p class="roll-modal-summary">${escapeHtml(option.name)}</p>
      <div class="roll-core">
        <span>Core rolls</span>
        ${rolls.map((roll) => `<strong>${escapeHtml(roll.label)}: ${escapeHtml(roll.formula)}</strong>`).join("")}
      </div>
      ${rolls.some((roll) => supportsD20Mode(roll.formula)) ? `
        <label class="field">
          <span>D20 mode</span>
          <select data-roll-mode>
            <option value="normal">Normal</option>
            <option value="advantage">Advantage</option>
            <option value="disadvantage">Disadvantage</option>
          </select>
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
            const result = rollForForm(body, option, rolls);
            const summary = formatBundleSummary(result);
            if (result.ok) {
              stateManager.logRoll(result, summary);
              rolled = true;
            }
            body.querySelector("[data-roll-feedback]").innerHTML = renderResult(result, summary);
          }
        },
        {
          label: "OK",
          variant: "primary",
          close: false,
          onClick: () => {
            if (!rolled) {
              body.querySelector("[data-roll-feedback]").innerHTML = `<p class="inline-message warning">Roll before taking this action.</p>`;
              return;
            }
            resolveOnce(true);
            modalApi.close();
          }
        }
      ]
    });
  });
}

function rollForForm(body, option, rolls) {
  const extra = normalizeExtraDice(body.querySelector("[data-extra-dice]")?.value);
  const mode = body.querySelector("[data-roll-mode]")?.value ?? "normal";
  const results = rolls.map((roll, index) => {
    const formula = [roll.formula, index === 0 ? extra : ""].filter(Boolean).join("+");
    return supportsD20Mode(formula) ? rollD20Mode(formula, `${option.name} ${roll.label}`, roll.type, mode) : rollDice(formula, {
      label: `${option.name} ${roll.label}`,
      type: roll.type
    });
  });
  const failed = results.find((result) => !result.ok);
  if (failed) return failed;
  return {
    ok: true,
    label: option.name,
    type: "actionRoll",
    formula: results.map((result) => result.formula).join(" + "),
    total: results.reduce((sum, result) => sum + Number(result.total ?? 0), 0),
    results
  };
}

function rollD20Mode(formula, label, type, mode) {
  if (mode === "normal") return rollDice(formula, { label, type });
  const first = rollDice(formula, { label, type });
  const second = rollDice(formula, { label, type });
  if (!first.ok) return first;
  if (!second.ok) return second;
  const selected = mode === "advantage"
    ? (first.total >= second.total ? first : second)
    : (first.total <= second.total ? first : second);
  return {
    ...selected,
    label: `${label} (${mode})`,
    mode,
    alternatives: [first, second]
  };
}

function renderResult(result, summary) {
  if (!result.ok) {
    return `
      <div class="roll-result is-error">
        <span>Error</span>
        <strong>${escapeHtml(summary)}</strong>
      </div>
    `;
  }
  return `
    <div class="roll-result is-ok">
      <span>Results</span>
      ${result.results.map((entry) => `
        <div class="roll-result-line">
          <strong>${escapeHtml(entry.label)}: ${escapeHtml(entry.total)}</strong>
          <small>${escapeHtml(formatRollSummary(entry))}</small>
          ${entry.alternatives?.length ? `<small>${escapeHtml(formatAlternatives(entry))}</small>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function formatBundleSummary(result) {
  if (!result?.ok) return result?.error ?? "Roll failed.";
  return result.results.map(formatRollSummary).join(" | ");
}

function formatAlternatives(result) {
  return `All d20 rolls: ${result.alternatives.map((entry) => entry.total).join(", ")}; kept ${result.total}.`;
}

function rollBundle(option) {
  const attack = option?.rolls?.find((roll) => roll.type === "attack" || roll.id === "attack");
  const damage = option?.rolls?.find((roll) => roll.type === "damage" && roll.id === "damage");
  if (attack && damage) return [attack, damage];
  return [
    attack,
    option?.rolls?.find((roll) => roll.type === "check"),
    damage,
    option?.rolls?.find((roll) => roll.type === "healing" || roll.id === "healing"),
    option?.rolls?.[0]
  ].filter(Boolean).slice(0, 1);
}

function supportsD20Mode(formula) {
  return /\b1d20\b/i.test(String(formula ?? ""));
}

function normalizeExtraDice(value) {
  const text = String(value ?? "").trim().replace(/\s+/g, "");
  if (!text) return "";
  return /^\d*d\d+(?:[+-]\d*d\d+)*$/i.test(text) ? text : "";
}
