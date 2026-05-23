import { getCombatOptions } from "../rules/combatOptionsService.js";
import { hasActiveAiSettings } from "../ai/aiSettings.js";
import {
  getRankedRecommendations,
  getRankedRecommendationSets
} from "../recommendations/recommendationScoring.js";
import { canPairAfterPrimary, isDependentOption } from "../recommendations/recommendationPrerequisites.js";
import { isAttackActionOption } from "../rules/attackActionRules.js";
import { findOption } from "./actionOptionHandlers.js";
import { hasActionRollModal, resolveActionRoll } from "./actionRollModal.js";
import { confirmActionUse, shouldConfirmActionUse } from "./actionUseConfirmModal.js";
import { recommendationTableOptions } from "./aiRecommendationTableAdapter.js";
import { renderFollowupButton, toggleFollowupDescription } from "./followupOptionRenderer.js";
import { renderMobileActionList, toggleActionDetail } from "./mobileActionList.js";
import { getPlannedTurn, validatePlannedOption } from "./plannedTurnState.js";
import {
  bindRecommendationWizardEvents,
  getRecommendationAnswers,
  renderRecommendationWizardPanel,
  setRecommendationAnswers,
  syncRecommendationAnswers
} from "./recommendationWizardPanel.js";
import { openAiRecommendationModal } from "./aiRecommendationModal.js";
import { openRecommendationOptionsModal } from "./recommendationOptionsModal.js";
import { escapeHtml } from "./renderUtils.js";

const NAV_GROUPS = [
  ["recommended", "Recommendations"],
  ["attacks", "Attacks"],
  ["spells", "Spells"],
  ["actions", "Actions"]
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
let selectedActionCost = null;
let hideUnavailable = true;
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
  syncRecommendationAnswers({ character, combatState });
  const visibleGroup = groups[selectedGroup] ? selectedGroup : "recommended";
  const rankedRecommendations = visibleGroup === "recommended"
    ? constrainedRecommendations(getRankedRecommendations({ groups, character, combatState, answers: getRecommendationAnswers(), referenceData: snapshot.referenceData }))
    : [];
  const baseOptions = visibleGroup === "recommended"
    ? recommendationTableOptions(rankedRecommendations, aiRecommendationSets, groups)
    : visibleGroup === "actions"
      ? combinedActionOptions(groups)
    : groups[visibleGroup] ?? [];
  const visibleOptions = filterOptions(visibleGroup, baseOptions, hideUnavailable);
  root.innerHTML = `
    <nav class="option-nav" aria-label="Action categories">
      ${NAV_GROUPS.map(([key, label]) => `<button class="btn ${key === visibleGroup ? "btn-primary" : "btn-secondary"}" type="button" data-tab-group="${escapeHtml(key)}">${escapeHtml(label)}</button>`).join("")}
    </nav>
    <div class="option-tabs">
      ${visibleGroup === "recommended" ? renderRecommendationWizardPanel(groups, rankedRecommendations, { aiEnabled: hasActiveAiSettings(storage), character, combatState }) : ""}
      ${visibleGroup === "recommended"
    ? renderMobileActionList(visibleGroup, "Recommended This Turn", visibleOptions, combatState, { hideUnavailable })
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
      selectedActionCost = null;
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
      selectedActionCost = null;
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
    character: snapshot.activeCharacter,
    combatState,
    onHelpClick: () => openRecommendationOptionsModal({
      modalApi: services.modalApi,
      groups,
      character: snapshot.activeCharacter,
      combatState,
      answers: getRecommendationAnswers(),
      onApply: ({ answers }) => {
        setRecommendationAnswers(answers, { character: snapshot.activeCharacter, combatState });
        aiRecommendationSets = [];
        renderActionTabs(root, snapshot, services);
      }
    }),
    onAiClick: () => openAiRecommendationModal({
      modalApi: services.modalApi,
      storage: services.storage,
      snapshot,
      groups,
      character: snapshot.activeCharacter,
      combatState,
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
      onAnswersChanged: (answers) => {
        setRecommendationAnswers(answers, { character: snapshot.activeCharacter, combatState });
        aiRecommendationSets = [];
        renderActionTabs(root, snapshot, services);
      },
      onRecommendations: (sets) => {
        aiRecommendationSets = sets;
        aiRecommendationCharacterId = snapshot.activeCharacter?.id ?? null;
        selectedGroup = "recommended";
        renderActionTabs(root, snapshot, services);
      }
    })
  });

  root.querySelectorAll("[data-use-option], [data-plan-option]").forEach((button) => {
    button.addEventListener("click", () => useOptionById(button.dataset.useOption ?? button.dataset.planOption, groups, combatState, services));
  });

  root.querySelectorAll("[data-toggle-action-detail]").forEach((button) => {
    button.addEventListener("click", () => toggleActionDetail(root, button.dataset.toggleActionDetail));
  });

}

async function useOptionById(optionId, groups, combatState, services) {
  const option = findOption(groups, optionId);
  if (!option) {
    services.showToast?.({ type: "warning", message: "That option is not available in the current action list." });
    return;
  }
  const validation = validatePlannedOption(option, { combatState });
  if (!validation.ok) {
    services.showToast?.({ type: "warning", message: validation.message });
    return;
  }
  const hasConcentrationModal = willReplaceConcentration(option, combatState);
  if (hasConcentrationModal) {
    const confirmed = await confirmConcentrationChange(services.modalApi, option, combatState);
    if (!confirmed) return;
  }
  const hasExistingModal = hasConcentrationModal || hasActionRollModal(option);
  if (shouldConfirmActionUse({ hadExistingModal: hasExistingModal })) {
    const confirmed = await confirmActionUse(services.modalApi, option);
    if (!confirmed) return;
  }
  const rolled = await resolveActionRoll({ modalApi: services.modalApi, stateManager: services.stateManager, option });
  if (!rolled) return;
  if (option.cost?.movement) {
    services.stateManager.useMovement(Number(option.movement?.step ?? 5));
  } else {
    services.stateManager.useCombatOption(option);
  }
  showAfterUseModal(option, services);
}

function showAfterUseModal(option, services) {
  const snapshot = services.stateManager.getSnapshot?.();
  const character = snapshot?.activeCharacter;
  const combatState = snapshot?.combatState;
  if (!character || !combatState) return;
  const groups = getCombatOptions({ character, combatState, referenceData: snapshot.referenceData });
  const followups = followupOptions(groups, option);
  const body = document.createElement("div");
  body.className = "post-action-modal";
  body.innerHTML = `
    <p>${escapeHtml(option.name)} was used.</p>
    ${followups.length ? `
      <div class="post-action-followups">
        <span class="section-label">Available Next</span>
        ${followups.map(renderFollowupButton).join("")}
      </div>
    ` : `<p class="inline-message">No immediate riders or follow-up actions are currently available.</p>`}
  `;
  services.modalApi.showModal({
    title: "Action Complete",
    body,
    actions: [
      { label: "Return", variant: "secondary" },
      { label: "End Turn", variant: "primary", close: false, onClick: () => endTurnFromModal(services) }
    ]
  });
  body.querySelectorAll("[data-followup-use]").forEach((button) => {
    button.addEventListener("click", () => {
      services.modalApi.close();
      useOptionById(button.dataset.followupUse, groups, combatState, services);
    });
  });
  body.querySelectorAll("[data-followup-toggle]").forEach((button) => {
    button.addEventListener("click", () => toggleFollowupDescription(body, button.dataset.followupToggle));
  });
}

export function followupOptions(groups, usedOption) {
  const options = [
    ...(groups.resources ?? []),
    ...(groups.free ?? []),
    ...(groups.movement ?? []),
    ...(groups.attacks ?? []),
    ...(groups.actions ?? []),
    ...(groups.bonus ?? []),
    ...(groups.reaction ?? [])
  ];
  return options
    .filter((option) => option.id !== usedOption.id && option.available !== false)
    .filter((option) => !isDependentOption(option) || canPairAfterPrimary(option, usedOption))
    .filter((option) => isDependentOption(option) || option.cost?.action || option.cost?.bonus || option.cost?.reaction || option.cost?.movement || option.cost?.object)
    .slice(0, 6);
}

function endTurnFromModal(services) {
  services.modalApi.close();
  window.dispatchEvent(new CustomEvent("combat:end-turn-requested"));
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
  return isAttackActionOption(option);
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
    const requestedGroup = event.detail?.group ?? selectedGroup;
    selectedGroup = normalizeSelectedGroup(requestedGroup);
    selectedSpellLevel = event.detail?.spellLevel ?? null;
    selectedSpellCost = event.detail?.spellCost ?? null;
    selectedActionCost = actionCostFilterForGroup(requestedGroup);
    lastRender?.();
    document.querySelector("#actions-title")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function normalizeSelectedGroup(group) {
  return ["bonus", "free", "reaction", "movement", "resources", "log"].includes(group) ? "actions" : group;
}

function combinedActionOptions(groups) {
  return [
    ...(groups.actions ?? []),
    ...(groups.bonus ?? []),
    ...(groups.reaction ?? []),
    ...(groups.free ?? []),
    ...(groups.movement ?? []),
    ...(groups.resources ?? [])
  ];
}

function actionCostFilterForGroup(group) {
  return {
    actions: "action",
    bonus: "bonus",
    reaction: "reaction",
    movement: "movement",
    free: "free"
  }[group] ?? null;
}

function constrainedRecommendations(rankedEntries) {
  const plan = getPlannedTurn();
  const plannedPrimary = plan.action;
  if (!plannedPrimary) return rankedEntries;
  return rankedEntries.map((entry) => {
    if (!isDependentOption(entry.option) || canPairAfterPrimary(entry.option, plannedPrimary)) return entry;
    const reason = `Requires a compatible predicate action instead of ${plannedPrimary.name}.`;
    return {
      ...entry,
      option: {
        ...entry.option,
        available: false,
        unavailableReasons: [...(entry.option.unavailableReasons ?? []), reason],
        recommendation: {
          ...(entry.option.recommendation ?? {}),
          warnings: [...(entry.option.recommendation?.warnings ?? []), reason]
        }
      }
    };
  });
}

function filterOptions(group, options, hideUnavailableOptions) {
  const filtered = group === "spells" ? options.filter((option) => {
    const levelMatches = selectedSpellLevel === null || option.spell?.level === selectedSpellLevel;
    const costMatches = !selectedSpellCost || option.cost?.[selectedSpellCost];
    return levelMatches && costMatches;
  }) : group === "actions" && selectedActionCost ? options.filter((option) => actionCostMatches(option, selectedActionCost)) : options;
  return filtered
    .filter((option) => !hideUnavailableOptions || option.available !== false)
    .slice()
    .sort((a, b) => Number(a.available === false) - Number(b.available === false));
}

function actionCostMatches(option, cost) {
  if (cost === "action") return Boolean(option.cost?.action);
  if (cost === "bonus") return Boolean(option.cost?.bonus);
  if (cost === "reaction") return Boolean(option.cost?.reaction);
  if (cost === "movement") return Boolean(option.cost?.movement);
  if (cost === "free") return Boolean(option.cost?.object || (!option.cost?.action && !option.cost?.bonus && !option.cost?.reaction && !option.cost?.movement));
  return true;
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
