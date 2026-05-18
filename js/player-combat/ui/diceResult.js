import { escapeHtml } from "./renderUtils.js";

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
