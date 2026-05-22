import { getCombatOptions } from "../rules/combatOptionsService.js";
import {
  getRankedRecommendations,
  getRankedRecommendationSets
} from "../recommendations/recommendationScoring.js";
import { findOption } from "./actionOptionHandlers.js";
import { resolveActionRoll } from "./actionRollModal.js";
import { renderMobileActionList, toggleActionDetail } from "./mobileActionList.js";
import { selectPlannedOption, validatePlannedOption } from "./plannedTurnState.js";
import {
  bindRecommendationWizardEvents,
  getRecommendationAnswers,
  renderRecommendationSets,
  renderRecommendationWizardPanel
} from "./recommendationWizardPanel.js";
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
let hideUnavailable = false;
let lastRender = null;
let cachedSnapshot = null;
let cachedGroups = null;

export function renderActionTabs(root, snapshot, { stateManager, modalApi, showToast }) {
  lastRender = () => renderActionTabs(root, snapshot, { stateManager, modalApi, showToast });
  bindGroupSelection();
  const character = snapshot.activeCharacter;
  const combatState = snapshot.combatState;

  if (!character || !combatState) {
    root.innerHTML = `<p class="inline-message">Combat options appear after character import.</p>`;
    return;
  }

  const groups = getCachedGroups(snapshot);
  const visibleGroup = groups[selectedGroup] ? selectedGroup : "recommended";
  const rankedRecommendations = visibleGroup === "recommended"
    ? getRankedRecommendations({ groups, character, combatState, answers: getRecommendationAnswers(), referenceData: snapshot.referenceData })
    : [];
  const recommendationSets = visibleGroup === "recommended"
    ? getRankedRecommendationSets({ rankedEntries: rankedRecommendations, answers: getRecommendationAnswers() })
    : [];
  const baseOptions = visibleGroup === "recommended"
    ? rankedRecommendations.map((entry) => entry.option).slice(0, 8)
    : groups[visibleGroup] ?? [];
  const visibleOptions = filterOptions(visibleGroup, baseOptions, hideUnavailable);
  root.innerHTML = `
    <nav class="option-nav" aria-label="Action categories">
      ${NAV_GROUPS.map(([key, label]) => `<button class="btn ${key === visibleGroup ? "btn-primary" : "btn-secondary"}" type="button" data-tab-group="${escapeHtml(key)}">${escapeHtml(label)}</button>`).join("")}
    </nav>
    <div class="option-tabs">
      ${visibleGroup === "recommended" ? renderRecommendationWizardPanel(groups, rankedRecommendations) : ""}
      ${visibleGroup === "recommended"
    ? renderRecommendationSets(recommendationSets)
    : renderMobileActionList(visibleGroup, groupLabel(visibleGroup), visibleOptions, combatState, { hideUnavailable })}
    </div>
  `;

  bindActionTabEvents(root, snapshot, { stateManager, modalApi, showToast }, groups, combatState);
}

function bindActionTabEvents(root, snapshot, services, groups, combatState) {
  root.querySelectorAll("[data-tab-group]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.tabGroup === selectedGroup && selectedSpellLevel === null && selectedSpellCost === null) return;
      selectedGroup = button.dataset.tabGroup;
      selectedSpellLevel = null;
      selectedSpellCost = null;
      renderActionTabs(root, snapshot, services);
    });
  });

  root.querySelectorAll("[data-select-group]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const nextGroup = button.dataset.selectGroup;
      const nextSpellLevel = button.dataset.spellLevel ? Number(button.dataset.spellLevel) : null;
      const nextSpellCost = button.dataset.spellCost ?? null;
      if (nextGroup === selectedGroup && nextSpellLevel === selectedSpellLevel && nextSpellCost === selectedSpellCost) return;
      selectedGroup = nextGroup;
      selectedSpellLevel = nextSpellLevel;
      selectedSpellCost = nextSpellCost;
      renderActionTabs(root, snapshot, services);
    });
  });

  root.querySelectorAll("[data-toggle-unavailable]").forEach((checkbox) => {
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      hideUnavailable = checkbox.checked;
      renderActionTabs(root, snapshot, services);
    });
  });

  bindRecommendationWizardEvents(root, () => renderActionTabs(root, snapshot, services));

  root.querySelectorAll("[data-plan-option]").forEach((button) => {
    button.addEventListener("click", async () => {
      const option = findOption(groups, button.dataset.planOption);
      const validation = validatePlannedOption(option, { combatState });
      if (!validation.ok) {
        services.showToast?.({ type: "warning", message: validation.message });
        return;
      }
      if (willReplaceConcentration(option, combatState)) {
        const confirmed = await confirmConcentrationChange(services.modalApi, option, combatState);
        if (!confirmed) return;
      }
      if (option?.available !== false && hasRoll(option)) {
        const rolled = await resolveActionRoll({
          modalApi: services.modalApi,
          stateManager: services.stateManager,
          option
        });
        if (!rolled) return;
      }
      const result = selectPlannedOption(option, { combatState });
      if (!result.ok) services.showToast?.({ type: "warning", message: result.message });
    });
  });

  root.querySelectorAll("[data-toggle-action-detail]").forEach((button) => {
    button.addEventListener("click", () => toggleActionDetail(root, button.dataset.toggleActionDetail));
  });

}

function hasRoll(option) {
  return Boolean(option?.rolls?.length);
}

function willReplaceConcentration(option, combatState) {
  return Boolean(option?.spell?.concentration)
    && Boolean(combatState?.current?.concentration)
    && combatState.current.concentration !== option.name;
}

function confirmConcentrationChange(modalApi, option, combatState) {
  return new Promise((resolve) => {
    const current = combatState.current?.concentration;
    let resolved = false;
    const done = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };
    modalApi.showModal({
      title: "Replace Concentration?",
      body: `<p>You are currently concentrating on ${escapeHtml(current)}. Casting ${escapeHtml(option.name)} will end that concentration.</p>`,
      onClose: () => done(false),
      actions: [
        { label: "Cancel", variant: "secondary", onClick: () => done(false) },
        { label: "Replace Concentration", variant: "primary", onClick: () => done(true) }
      ]
    });
  });
}

function getCachedGroups(snapshot) {
  if (cachedSnapshot === snapshot && cachedGroups) return cachedGroups;
  cachedSnapshot = snapshot;
  cachedGroups = getCombatOptions({
    character: snapshot.activeCharacter,
    combatState: snapshot.combatState,
    referenceData: snapshot.referenceData
  });
  return cachedGroups;
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

function filterOptions(group, options, hideUnavailableOptions) {
  const filtered = group === "spells" ? options.filter((option) => {
    const levelMatches = selectedSpellLevel === null || option.spell?.level === selectedSpellLevel;
    const costMatches = !selectedSpellCost || option.cost?.[selectedSpellCost];
    return levelMatches && costMatches;
  }) : options;
  return filtered
    .filter((option) => !hideUnavailableOptions || option.available !== false)
    .slice()
    .sort((a, b) => Number(a.available === false) - Number(b.available === false));
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
