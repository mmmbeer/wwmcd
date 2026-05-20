import { getCombatOptions } from "../rules/combatOptionsService.js";
import { findOption, handleRoll, useOption } from "./actionOptionHandlers.js";
import { bindSpellDetailCards, renderGroup, toggleExpandedRow } from "./actionOptionRenderers.js";
import { escapeHtml } from "./renderUtils.js";

const NAV_GROUPS = [
  ["recommended", "Recommendation"],
  ["attacks", "Attacks"],
  ["actions", "Actions"],
  ["spells", "Spells"],
  ["bonus", "Bonus"],
  ["free", "Free"],
  ["reaction", "Reaction"]
];
const GROUP_LABELS = {
  ...Object.fromEntries(NAV_GROUPS),
  movement: "Movement",
  resources: "Resources",
  log: "Log"
};
let selectedGroup = "recommended";
let selectedSpellLevel = null;
let selectedSpellCost = null;
let lastRender = null;

export function renderActionTabs(root, snapshot, { stateManager, modalApi, showToast }) {
  lastRender = () => renderActionTabs(root, snapshot, { stateManager, modalApi, showToast });
  bindGroupSelection();
  const character = snapshot.activeCharacter;
  const combatState = snapshot.combatState;

  if (!character || !combatState) {
    root.innerHTML = `<p class="inline-message">Combat options appear after character import.</p>`;
    return;
  }

  const groups = getCombatOptions({ character, combatState, referenceData: snapshot.referenceData });
  const visibleGroup = groups[selectedGroup] ? selectedGroup : "recommended";
  const visibleOptions = filterOptions(visibleGroup, groups[visibleGroup] ?? []);
  root.innerHTML = `
    <nav class="option-nav" aria-label="Action categories">
      ${NAV_GROUPS.map(([key, label]) => `<button class="btn ${key === visibleGroup ? "btn-primary" : "btn-secondary"}" type="button" data-tab-group="${escapeHtml(key)}">${escapeHtml(label)}</button>`).join("")}
    </nav>
    <div class="option-tabs">
      ${renderGroup(visibleGroup, groupLabel(visibleGroup), visibleOptions, combatState)}
    </div>
  `;

  bindActionTabEvents(root, snapshot, { stateManager, modalApi, showToast }, groups, combatState);
}

function bindActionTabEvents(root, snapshot, services, groups, combatState) {
  root.querySelectorAll("[data-tab-group]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedGroup = button.dataset.tabGroup;
      selectedSpellLevel = null;
      selectedSpellCost = null;
      renderActionTabs(root, snapshot, services);
    });
  });

  root.querySelectorAll("[data-select-group]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedGroup = button.dataset.selectGroup;
      selectedSpellLevel = button.dataset.spellLevel ? Number(button.dataset.spellLevel) : null;
      selectedSpellCost = button.dataset.spellCost ?? null;
      renderActionTabs(root, snapshot, services);
    });
  });

  root.querySelectorAll("[data-roll-option]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handleRoll(button, groups, services.stateManager, services.showToast);
    });
  });

  root.querySelectorAll("[data-use-option]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const option = findOption(groups, button.dataset.useOption);
      if (option) useOption(option, combatState, services.stateManager, services.modalApi);
    });
  });

  root.querySelectorAll("[data-use-movement]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      services.stateManager.useMovement(Number(button.dataset.useMovement || 5));
    });
  });

  root.querySelectorAll("[data-expand-target]").forEach((row) => {
    row.addEventListener("click", () => toggleExpandedRow(root, row));
  });

  bindSpellDetailCards(root);
}

function bindGroupSelection() {
  if (bindGroupSelection.bound) return;
  bindGroupSelection.bound = true;
  window.addEventListener("combat:select-option-group", (event) => {
    selectedGroup = event.detail?.group ?? selectedGroup;
    selectedSpellLevel = event.detail?.spellLevel ?? null;
    selectedSpellCost = event.detail?.spellCost ?? null;
    lastRender?.();
    document.querySelector("#actions-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function filterOptions(group, options) {
  if (group !== "spells") return options;
  return options.filter((option) => {
    const levelMatches = selectedSpellLevel === null || option.spell?.level === selectedSpellLevel;
    const costMatches = !selectedSpellCost || option.cost?.[selectedSpellCost];
    return levelMatches && costMatches;
  });
}

function groupLabel(group) {
  if (group !== "spells") return GROUP_LABELS[group];
  if (selectedSpellLevel !== null) return `Spells: Level ${selectedSpellLevel}`;
  if (selectedSpellCost) return `Spells: ${costFilterLabel(selectedSpellCost)}`;
  return GROUP_LABELS[group];
}

function costFilterLabel(cost) {
  return {
    action: "Action",
    bonus: "Bonus Action",
    reaction: "Reaction"
  }[cost] ?? cost;
}
