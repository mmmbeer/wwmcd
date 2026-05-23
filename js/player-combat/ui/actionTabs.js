import { getCombatOptions } from "../rules/combatOptionsService.js";
import { hasActiveAiSettings } from "../ai/aiSettings.js";
import {
  getRankedRecommendations,
  getRankedRecommendationSets
} from "../recommendations/recommendationScoring.js";
import { findOption } from "./actionOptionHandlers.js";
import { renderMobileActionList, toggleActionDetail } from "./mobileActionList.js";
import { getPlannedTurn, selectPlannedOption, validatePlannedOption } from "./plannedTurnState.js";
import {
  bindRecommendationWizardEvents,
  getRecommendationAnswers,
  renderAiRecommendationSets,
  renderRecommendationSets,
  renderRecommendationWizardPanel
} from "./recommendationWizardPanel.js";
import { openAiRecommendationModal } from "./aiRecommendationModal.js";
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
let cachedPlanKey = "";
let aiRecommendationSets = [];
let aiRecommendationCharacterId = null;

export function renderActionTabs(root, snapshot, { stateManager, modalApi, showToast, storage, openAiSettings }) {
  const services = { stateManager, modalApi, showToast, storage, openAiSettings };
  lastRender = () => renderActionTabs(root, snapshot, services);
  bindGroupSelection();
  const character = snapshot.activeCharacter;
  const combatState = snapshot.combatState;

  if (!character || !combatState) {
    aiRecommendationSets = [];
    aiRecommendationCharacterId = null;
    root.innerHTML = `<p class="inline-message">Combat options appear after character import.</p>`;
    return;
  }
  if (aiRecommendationCharacterId && aiRecommendationCharacterId !== character.id) {
    aiRecommendationSets = [];
    aiRecommendationCharacterId = null;
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
      ${visibleGroup === "recommended" ? renderRecommendationWizardPanel(groups, rankedRecommendations, { aiEnabled: hasActiveAiSettings(storage) }) : ""}
      ${visibleGroup === "recommended"
    ? aiRecommendationCount(aiRecommendationSets) ? renderAiRecommendationSets(aiRecommendationSets) : renderRecommendationSets(recommendationSets)
    : renderMobileActionList(visibleGroup, groupLabel(visibleGroup), visibleOptions, combatState, { hideUnavailable })}
    </div>
  `;

  bindActionTabEvents(root, snapshot, services, groups, combatState);
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

  bindRecommendationWizardEvents(root, () => {
    aiRecommendationSets = [];
    renderActionTabs(root, snapshot, services);
  }, {
    onAiClick: () => openAiRecommendationModal({
      modalApi: services.modalApi,
      storage: services.storage,
      snapshot,
      groups,
      recommendationSets: getRankedRecommendationSets({
        rankedEntries: getRankedRecommendations({
          groups,
          character: snapshot.activeCharacter,
          combatState,
          answers: getRecommendationAnswers(),
          referenceData: snapshot.referenceData
        }),
        answers: getRecommendationAnswers()
      }),
      answers: getRecommendationAnswers(),
      showToast: services.showToast,
      openSettings: services.openAiSettings,
      onRecommendations: (sets) => {
        aiRecommendationSets = sets;
        aiRecommendationCharacterId = snapshot.activeCharacter?.id ?? null;
        selectedGroup = "recommended";
        renderActionTabs(root, snapshot, services);
      }
    })
  });

  root.querySelectorAll("[data-plan-option]").forEach((button) => {
    button.addEventListener("click", () => selectPlanOptionById(button.dataset.planOption, groups, combatState, services));
  });

  root.querySelectorAll("[data-toggle-action-detail]").forEach((button) => {
    button.addEventListener("click", () => toggleActionDetail(root, button.dataset.toggleActionDetail));
  });

}

async function selectPlanOptionById(optionId, groups, combatState, services) {
  const option = findOption(groups, optionId);
  if (!option) {
    services.showToast?.({ type: "warning", message: "That recommendation is not available in the current action list." });
    return;
  }
  const validation = validatePlannedOption(option, { combatState });
  if (!validation.ok) {
    services.showToast?.({ type: "warning", message: validation.message });
    return;
  }
  if (willReplaceConcentration(option, combatState)) {
    const confirmed = await confirmConcentrationChange(services.modalApi, option, combatState);
    if (!confirmed) return;
  }
  const result = selectPlannedOption(option, { combatState });
  if (!result.ok) services.showToast?.({ type: "warning", message: result.message });
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
  const planKey = plannedPrerequisiteKey();
  if (cachedSnapshot === snapshot && cachedPlanKey === planKey && cachedGroups) return cachedGroups;
  cachedSnapshot = snapshot;
  cachedPlanKey = planKey;
  cachedGroups = getCombatOptions({
    character: snapshot.activeCharacter,
    combatState: combatStateWithPlannedPrerequisites(snapshot.combatState),
    referenceData: snapshot.referenceData
  });
  return cachedGroups;
}

function plannedPrerequisiteKey() {
  const plan = getPlannedTurn();
  return [
    plan.action?.id,
    ...plan.actionAttacks.map((option) => option.id),
    plan.bonusAction?.id,
    plan.reaction?.id,
    ...plan.freeActions.map((option) => option.id)
  ].filter(Boolean).join("|");
}

function combatStateWithPlannedPrerequisites(combatState) {
  const plan = getPlannedTurn();
  const plannedOptions = [
    plan.action,
    ...plan.actionAttacks,
    plan.bonusAction,
    plan.reaction,
    ...plan.freeActions
  ].filter(Boolean);
  if (!plannedOptions.length) return combatState;

  return {
    ...combatState,
    turn: {
      ...combatState.turn,
      attackActionUsed: Boolean(combatState.turn?.attackActionUsed || plannedOptions.some(isAttackAction)),
      ...plannedTurnFlags(plannedOptions)
    },
    current: {
      ...combatState.current,
      activeEffects: plannedActiveEffects(combatState.current?.activeEffects, plannedOptions)
    }
  };
}

function isAttackAction(option) {
  return Boolean(option?.cost?.action)
    && (option.tags?.includes("attack") || option.rolls?.some((roll) => roll.type === "attack" || roll.id === "attack"));
}

function plannedTurnFlags(options) {
  return options.reduce((flags, option) => {
    if (option.effect?.turnFlag) flags[option.effect.turnFlag] = true;
    return flags;
  }, {});
}

function plannedActiveEffects(currentEffects = [], options) {
  const effects = new Set(currentEffects);
  options.forEach((option) => {
    if (option.effect?.activeEffect) effects.add(option.effect.activeEffect);
    if (option.effect?.clearEffect) effects.delete(option.effect.clearEffect);
  });
  return [...effects];
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

function aiRecommendationCount(result) {
  return (result?.recommendations ?? result?.sets ?? result ?? []).length;
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
