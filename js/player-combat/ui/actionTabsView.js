import { hasActiveAiSettings } from "../ai/aiSettings.js";
import { getRecommendationAnswers, renderRecommendationWizardPanel } from "./recommendationWizardPanel.js";
import { renderMobileActionList } from "./mobileActionList.js";
import { escapeHtml } from "./renderUtils.js";

export function renderActionTabsShell(root, navGroups) {
  if (root.querySelector("[data-action-tabs-shell]")) return;
  root.innerHTML = `
    <div data-action-tabs-shell>
      <nav class="option-nav" role="tablist" aria-label="Action categories">
        ${navGroups.map(([key, label]) => `<button class="btn btn-secondary" type="button" role="tab" aria-selected="false" data-tab-group="${escapeHtml(key)}">${escapeHtml(label)}</button>`).join("")}
      </nav>
      <div class="option-tabs">
        <div data-recommendation-wizard-slot></div>
        <div data-action-list-slot></div>
      </div>
    </div>
  `;
  root.dataset.navKey = "";
  root.dataset.wizardKey = "";
  root.dataset.listKey = "";
}

export function updateActionNav(root, visibleGroup) {
  if (root.dataset.navKey === visibleGroup) return;
  root.dataset.navKey = visibleGroup;
  root.querySelectorAll("[data-tab-group]").forEach((button) => {
    const active = button.dataset.tabGroup === visibleGroup;
    button.classList.toggle("btn-primary", active);
    button.classList.toggle("btn-secondary", !active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
}

export function updateRecommendationWizard(root, visibleGroup, groups, rankedRecommendations, context) {
  const slot = root.querySelector("[data-recommendation-wizard-slot]");
  if (!slot) return;
  const key = visibleGroup === "recommended"
    ? stableString({
      answers: getRecommendationAnswers(),
      ai: hasActiveAiSettings(context.storage),
      character: context.character?.id,
      turn: context.combatState?.turn,
      count: rankedRecommendations.length
    })
    : "empty";
  if (root.dataset.wizardKey === key) return;
  root.dataset.wizardKey = key;
  slot.innerHTML = visibleGroup === "recommended"
    ? renderRecommendationWizardPanel(groups, rankedRecommendations, {
      aiEnabled: hasActiveAiSettings(context.storage),
      character: context.character,
      combatState: context.combatState
    })
    : "";
}

export function updateActionList(root, visibleGroup, label, visibleOptions, combatState, { hideUnavailable, actionCostFilter = null }) {
  const slot = root.querySelector("[data-action-list-slot]");
  if (!slot) return;
  const key = stableString({
    group: visibleGroup,
    label,
    hideUnavailable,
    actionCostFilter,
    turn: combatState?.turn,
    options: visibleOptions.map(optionRenderKey)
  });
  if (root.dataset.listKey === key) return;
  root.dataset.listKey = key;
  slot.innerHTML = renderMobileActionList(visibleGroup, label, visibleOptions, combatState, { hideUnavailable, actionCostFilter });
}

function optionRenderKey(option) {
  return [
    option.id,
    option.available === false ? "0" : "1",
    option.name,
    option.cost?.action ? "a" : "",
    option.cost?.bonus ? "b" : "",
    option.cost?.reaction ? "r" : "",
    option.cost?.movement ? "m" : "",
    option.cost?.object ? "o" : "",
    option.cost?.resource?.id,
    option.cost?.resource?.amount,
    option.spell?.level,
    option.spell?.concentration ? "c" : "",
    option.recommendation?.source,
    option.recommendation?.score,
    option.unavailableReasons?.join("~"),
    option.warnings?.join("~")
  ].filter((value) => value !== undefined && value !== null).join("|");
}

function stableString(value) {
  return JSON.stringify(value);
}
