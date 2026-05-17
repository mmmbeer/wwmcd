import { createEventBus } from "./core/eventBus.js";
import { createStateManager } from "./core/stateManager.js";
import { createStorage } from "./core/storage.js";
import { loadReferenceData } from "./data/referenceDataService.js";
import { renderCharacterImportPanel } from "./ui/characterImportPanel.js";
import { renderCombatStatePanel } from "./ui/combatStatePanel.js";
import { renderCombatStatusBar } from "./ui/combatStatusBar.js";
import { createModal } from "./ui/modal.js";
import { renderSpellcastingBar } from "./ui/spellcastingBar.js";
import { renderActionTabs } from "./ui/actionTabs.js";
import { createToast } from "./ui/toast.js";
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
    combatPanel: document.querySelector("#combat-state-panel"),
    tabs: document.querySelector("#action-tabs")
  };

  eventBus.on("state:changed", (snapshot) => {
    renderHeaderIdentity(roots, snapshot);
    renderHeaderActions(roots.headerActions, snapshot, { stateManager, modalApi, showToast });
    renderImportLauncher(roots.importLauncher, snapshot, { stateManager, modalApi, showToast });
    renderTurnEconomyPanel(roots.turnPanel, snapshot, stateManager);
    renderSpellcastingBar(roots.spellcastingBar, snapshot);
    renderCombatStatusBar(roots.statusBar, snapshot, { stateManager, modalApi });
    renderCombatStatePanel(roots.combatPanel, snapshot, { stateManager, modalApi });
    renderActionTabs(roots.tabs, snapshot, { stateManager, modalApi });
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

function renderHeaderIdentity(roots, snapshot) {
  const character = snapshot.activeCharacter;
  roots.appTitle.textContent = character ? "WWMCD" : "what would my character do?";
  roots.headerCharacter.innerHTML = character ? `
    <strong>${escapeHeader(character.name)}</strong>
    <span>${escapeHeader(characterLine(character))}</span>
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
  root.querySelector("[data-header-action='short-rest']")?.addEventListener("click", () => stateManager.takeShortRest());
  root.querySelector("[data-header-action='long-rest']")?.addEventListener("click", () => stateManager.takeLongRest());
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
  renderCharacterImportPanel(body, { stateManager, showToast });
  modalApi.showModal({
    title: "Import Character",
    body,
    actions: [{ label: "Close", variant: "secondary" }]
  });
}
