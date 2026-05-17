import { formatFeet } from "./renderUtils.js";

export function renderTurnEconomyPanel(root, snapshot, stateManager) {
  const character = snapshot.activeCharacter;
  const state = snapshot.combatState;

  if (!character || !state) {
    root.innerHTML = "";
    return;
  }

  const movement = `${formatFeet(state.turn.movementUsed)} / ${formatFeet(character.combat.speed.walk)}`;
  root.innerHTML = `
    <article class="turn-card">
      <div class="panel-header">
        <h2>Turn Economy</h2>
        <span class="badge ${state.turnActive ? "is-ready" : ""}">${state.turnActive ? "Active" : "Idle"}</span>
      </div>
      <div class="economy-grid">
        ${economyItem("Movement", movement)}
        ${economyItem("Action", state.turn.actionUsed ? "Used" : "Available")}
        ${economyItem("Bonus", state.turn.bonusActionUsed ? "Used" : "Available")}
        ${economyItem("Reaction", state.turn.reactionUsed ? "Used" : "Available")}
      </div>
      <div class="button-row">
        <button class="btn btn-primary" type="button" data-turn="start">Start Turn</button>
        <button class="btn btn-secondary" type="button" data-turn="end">End Turn</button>
        <button class="btn btn-secondary" type="button" data-turn="action">Use Action</button>
        <button class="btn btn-secondary" type="button" data-turn="bonus">Use Bonus</button>
        <button class="btn btn-secondary" type="button" data-turn="reaction">Use Reaction</button>
        <button class="btn btn-secondary" type="button" data-rest="short">Short Rest</button>
        <button class="btn btn-secondary" type="button" data-rest="long">Long Rest</button>
      </div>
    </article>
  `;

  root.querySelector("[data-turn='start']").addEventListener("click", () => stateManager.startTurn());
  root.querySelector("[data-turn='end']").addEventListener("click", () => stateManager.endTurn());
  root.querySelector("[data-turn='action']").addEventListener("click", () => stateManager.useAction());
  root.querySelector("[data-turn='bonus']").addEventListener("click", () => stateManager.useBonusAction());
  root.querySelector("[data-turn='reaction']").addEventListener("click", () => stateManager.useReaction());
  root.querySelector("[data-rest='short']").addEventListener("click", () => stateManager.takeShortRest());
  root.querySelector("[data-rest='long']").addEventListener("click", () => stateManager.takeLongRest());
}

function economyItem(label, value) {
  return `
    <div class="economy-item">
      <span class="economy-label">${label}</span>
      <span class="economy-value">${value}</span>
    </div>
  `;
}
