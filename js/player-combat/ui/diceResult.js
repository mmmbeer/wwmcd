import { escapeHtml } from "./renderUtils.js";

export function renderDiceResult(result) {
  if (!result) return "";
  if (!result.ok) {
    return `<p class="inline-message error">${escapeHtml(result.error)}</p>`;
  }

  return `
    <article class="dice-result">
      <span class="dice-label">${escapeHtml(result.label)}</span>
      <strong class="dice-total">${escapeHtml(result.total)}</strong>
      <span class="dice-formula">${escapeHtml(result.formula)}${result.mode ? ` (${escapeHtml(result.mode)})` : ""}</span>
      <small>${escapeHtml(formatRolls(result))}</small>
    </article>
  `;
}

export function formatRollSummary(result) {
  if (!result?.ok) return result?.error ?? "Roll failed.";
  return `${result.label}: ${result.total} (${result.formula}; ${formatRolls(result)})`;
}

function formatRolls(result) {
  return (result.rolls ?? []).map((roll) => {
    const sign = roll.sign < 0 ? "-" : "";
    return `${sign}${roll.count}d${roll.sides} [${roll.values.join(", ")}]`;
  }).join(", ") || `modifier ${result.modifier}`;
}
