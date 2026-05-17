import { createEventBus } from "./core/eventBus.js";
import { createStateManager } from "./core/stateManager.js";
import { createStorage } from "./core/storage.js";
import { loadReferenceData } from "./data/referenceDataService.js";
import { renderReferenceStatus } from "./ui/cards.js";
import { renderCharacterImportPanel } from "./ui/characterImportPanel.js";
import { renderCharacterSummaryPanel } from "./ui/characterSummaryPanel.js";
import { renderCombatStatePanel } from "./ui/combatStatePanel.js";
import { createModal } from "./ui/modal.js";
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
    referenceStatus: document.querySelector("#reference-status-list"),
    importPanel: document.querySelector("#character-import-panel"),
    summaryPanel: document.querySelector("#character-summary-panel"),
    turnPanel: document.querySelector("#turn-economy-panel"),
    combatPanel: document.querySelector("#combat-state-panel"),
    tabs: document.querySelector("#action-tabs")
  };

  eventBus.on("state:changed", (snapshot) => {
    renderReferenceStatus(roots.referenceStatus, snapshot);
    renderCharacterSummaryPanel(roots.summaryPanel, snapshot);
    renderTurnEconomyPanel(roots.turnPanel, snapshot, stateManager);
    renderCombatStatePanel(roots.combatPanel, snapshot, { stateManager, modalApi });
    renderActionTabs(roots.tabs, snapshot, { stateManager });
  });

  renderCharacterImportPanel(roots.importPanel, { stateManager, showToast });
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
