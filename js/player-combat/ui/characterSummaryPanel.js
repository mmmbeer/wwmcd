import { escapeHtml, formatFeet } from "./renderUtils.js";

export function renderCharacterSummaryPanel(root, snapshot) {
  const character = snapshot.activeCharacter;
  const state = snapshot.combatState;

  if (!character) {
    root.innerHTML = `
      <article class="summary-card">
        <h2>Active Character</h2>
        <p class="inline-message">Import a character to start tracking combat.</p>
      </article>
    `;
    return;
  }

  const classText = character.classes.map((entry) => `${entry.name} ${entry.level}`).join(" / ") || "Unknown class";
  root.innerHTML = `
    <article class="summary-card">
      <div class="summary-main">
        <span class="summary-name">${escapeHtml(character.name)}</span>
        <span>${escapeHtml(`Level ${character.level || "?"} ${character.race.name} ${classText}`)}</span>
      </div>
      <div class="stat-grid">
        <div class="stat"><span class="stat-label">HP</span><span class="stat-value">${state?.current.hp ?? character.combat.currentHp} / ${character.combat.maxHp}</span></div>
        <div class="stat"><span class="stat-label">Temp</span><span class="stat-value">${state?.current.tempHp ?? 0}</span></div>
        <div class="stat"><span class="stat-label">AC</span><span class="stat-value">${state?.current.ac ?? character.combat.ac}</span></div>
        <div class="stat"><span class="stat-label">Speed</span><span class="stat-value">${formatFeet(character.combat.speed.walk)}</span></div>
      </div>
    </article>
  `;
}
