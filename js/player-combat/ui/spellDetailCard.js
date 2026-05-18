import { escapeHtml } from "./renderUtils.js";

export function renderSpellDetailCard(option) {
  const spell = option?.spell?.reference ?? {};
  return `
    <aside class="srd-hover-card spell-detail-card" aria-label="${escapeHtml(option?.name ?? "Spell")} details">
      <div class="srd-hover-card__header">
        <div class="srd-hover-card__title">${escapeHtml(option?.name ?? spell.name ?? "Spell")}</div>
        <button class="srd-hover-card__close" type="button" title="Dismiss spell details" aria-label="Dismiss spell details">x</button>
      </div>
      <div class="srd-hover-card__subtitle">${escapeHtml([spell.type, spell.level === 0 ? "Cantrip" : spell.level ? `Level ${spell.level}` : null].filter(Boolean).join(" | "))}</div>
      <dl class="srd-hover-card__facts">
        ${fact("Time", spell.casting_time)}
        ${fact("Range", spell.range)}
        ${fact("Comp", spell.components?.raw)}
        ${fact("Dur", spell.duration)}
      </dl>
      <div class="srd-hover-card__description">
        ${paragraphs(spell.description)}
        ${spell.higher_levels ? `<p><strong>At Higher Levels. </strong>${escapeHtml(spell.higher_levels)}</p>` : ""}
      </div>
    </aside>
  `;
}

function fact(label, value) {
  if (!value) return "";
  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
}

function paragraphs(value) {
  const entries = normalizeDescription(value)
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const visible = entries.slice(0, 4).map((entry) => `<p>${escapeHtml(entry)}</p>`).join("");
  const more = entries.length > 4
    ? `<p class="srd-hover-card__more">+${entries.length - 4} more paragraph${entries.length - 4 === 1 ? "" : "s"}</p>`
    : "";
  return visible || `<p>${escapeHtml("No spell description available.")}</p>` + more;
}

function normalizeDescription(value) {
  if (Array.isArray(value)) return value.map(normalizeDescription).filter(Boolean).join("\n\n");
  if (value && typeof value === "object") return normalizeDescription(value.content ?? value.description ?? value.text ?? "");
  return String(value ?? "");
}
