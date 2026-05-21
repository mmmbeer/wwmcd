import { createEventBus } from "./core/eventBus.js";
import { createStateManager } from "./core/stateManager.js";
import { createStorage } from "./core/storage.js";
import { loadReferenceData } from "./data/referenceDataService.js";
import { renderCharacterImportPanel } from "./ui/characterImportPanel.js";
import { renderCombatStatusBar } from "./ui/combatStatusBar.js";
import { createModal } from "./ui/modal.js";
import { renderSpellcastingBar } from "./ui/spellcastingBar.js";
import { renderActionTabs } from "./ui/actionTabs.js";
import { renderPlannedTurnBar } from "./ui/mobileActionList.js";
import { clearPlannedTurn, confirmPlannedTurn } from "./ui/plannedTurnState.js";
import { createToast } from "./ui/toast.js";
import { longRestNotice, shortRestNotice, showTransitionNotice } from "./ui/transitionNotice.js";
import { renderTurnEconomyPanel } from "./ui/turnEconomyPanel.js";

export async function createPlayerCombatApp() {
  const eventBus = createEventBus();
  const storage = createStorage();
  const stateManager = createStateManager({ storage, eventBus });
  const modalApi = createModal(document.querySelector("#modal-root"));
  const showToast = createToast(document.querySelector("#toast-region"));
  const roots = {
    appTitle: document.querySelector("#app-title"),
    headerCharacter: document.querySelector("#header-character"),
    headerActions: document.querySelector("#header-actions"),
    importLauncher: document.querySelector("#import-launcher"),
    turnPanel: document.querySelector("#turn-economy-panel"),
    spellcastingBar: document.querySelector("#spellcasting-bar"),
    statusBar: document.querySelector("#combat-status-bar"),
    tabs: document.querySelector("#action-tabs"),
    plannedTurnBar: document.querySelector("#planned-turn-bar")
  };

  let latestSnapshot = null;
  const render = (snapshot) => {
    latestSnapshot = snapshot;
    renderHeaderIdentity(roots, snapshot);
    renderHeaderActions(roots.headerActions, snapshot, { stateManager, modalApi, showToast });
    renderImportLauncher(roots.importLauncher, snapshot, { stateManager, modalApi, showToast });
    renderTurnEconomyPanel(roots.turnPanel, snapshot, { stateManager, modalApi });
    renderSpellcastingBar(roots.spellcastingBar, snapshot, stateManager);
    renderCombatStatusBar(roots.statusBar, snapshot, { stateManager, modalApi });
    renderActionTabs(roots.tabs, snapshot, { stateManager, modalApi, showToast });
    renderPlannedTurn(roots.plannedTurnBar, snapshot, { stateManager, showToast });
  };

  eventBus.on("state:changed", render);
  window.addEventListener("combat:planned-turn-changed", () => {
    if (latestSnapshot) render(latestSnapshot);
  });

  stateManager.initializeAppState();

  if (!storage.available) {
    showToast({ type: "warning", message: "Local storage is unavailable; changes will not persist." });
  }

  try {
    stateManager.setReferenceData(await loadReferenceData());
  } catch (error) {
    showToast({ type: "error", message: `Reference data failed: ${error.message}` });
  }

  return { stateManager };
}

function renderPlannedTurn(root, snapshot, { stateManager, showToast }) {
  if (!root) return;
  if (!snapshot.activeCharacter || !snapshot.combatState) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = renderPlannedTurnBar(snapshot);
  root.querySelector("[data-plan-clear]")?.addEventListener("click", () => clearPlannedTurn());
  root.querySelector("[data-plan-confirm]")?.addEventListener("click", () => {
    const result = confirmPlannedTurn(stateManager);
    showToast({
      type: "success",
      message: result.optionCount || result.movementUsed ? "Turn confirmed." : "No planned actions to confirm."
    });
  });
}

function renderHeaderIdentity(roots, snapshot) {
  const character = snapshot.activeCharacter;
  roots.appTitle.textContent = character ? "Combat Turn" : "what would my character do?";
  roots.headerCharacter.innerHTML = character ? `
    <strong>${escapeHeader(character.name)}</strong>
    <span>Round ${escapeHeader(snapshot.combatState?.round ?? 1)}</span>
  ` : "";
}

function characterLine(character) {
  const classes = (character.classes ?? []).map((entry) => `${entry.name} ${entry.level}`).join(" / ") || "Unknown class";
  return `Level ${character.level || "?"} ${classes}`;
}

function escapeHeader(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function renderHeaderActions(root, snapshot, { stateManager, modalApi, showToast }) {
  if (!root) return;
  if (!snapshot.activeCharacter) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = `
    <button class="btn btn-secondary" type="button" data-header-action="import">Import</button>
    <button class="btn btn-secondary" type="button" data-header-action="short-rest">Short Rest</button>
    <button class="btn btn-secondary" type="button" data-header-action="long-rest">Long Rest</button>
  `;

  root.querySelector("[data-header-action='import']").addEventListener("click", () => openImportModal({ modalApi, stateManager, showToast }));
  root.querySelector("[data-header-action='short-rest']")?.addEventListener("click", (event) => {
    showTransitionNotice(event.currentTarget, shortRestNotice(snapshot.activeCharacter, snapshot.combatState));
    stateManager.takeShortRest();
  });
  root.querySelector("[data-header-action='long-rest']")?.addEventListener("click", (event) => {
    showTransitionNotice(event.currentTarget, longRestNotice(snapshot.activeCharacter, snapshot.combatState));
    stateManager.takeLongRest();
  });
}

function renderImportLauncher(root, snapshot, { stateManager, modalApi, showToast }) {
  if (!root) return;
  root.innerHTML = snapshot.activeCharacter ? "" : `
    <section class="import-empty" aria-label="Import character">
      <button class="btn btn-primary" type="button" data-action="import-character">Import Character</button>
    </section>
  `;
  root.querySelector("[data-action='import-character']")?.addEventListener("click", () => openImportModal({ modalApi, stateManager, showToast }));
}

function openImportModal({ modalApi, stateManager, showToast }) {
  const body = document.createElement("div");
  renderCharacterImportPanel(body, { stateManager, showToast, modalApi });
  modalApi.showModal({
    title: "Import Character",
    body,
    actions: [{ label: "Close", variant: "secondary" }]
  });
}
