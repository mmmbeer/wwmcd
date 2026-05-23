import { createEventBus } from "./core/eventBus.js";
import { createStateManager } from "./core/stateManager.js";
import { createStorage } from "./core/storage.js";
import { loadReferenceData } from "./data/referenceDataService.js";
import { hasActiveAiSettings } from "./ai/aiSettings.js";
import { getEffectiveWalkSpeed } from "./rules/movementRules.js";
import { renderCharacterImportPanel } from "./ui/characterImportPanel.js";
import { renderCombatStatusBar } from "./ui/combatStatusBar.js";
import { createModal } from "./ui/modal.js";
import { renderSpellcastingBar } from "./ui/spellcastingBar.js";
import { renderActionTabs } from "./ui/actionTabs.js";
import { createToast } from "./ui/toast.js";
import { longRestNotice, shortRestNotice, showTransitionNotice } from "./ui/transitionNotice.js";
import { renderTurnEconomyPanel } from "./ui/turnEconomyPanel.js";
import { openAiOptionsModal } from "./ui/aiOptionsModal.js";

export async function createPlayerCombatApp() {
  const eventBus = createEventBus();
  const storage = createStorage();
  const stateManager = createStateManager({ storage, eventBus });
  const modalApi = createModal(document.querySelector("#modal-root"));
  const showToast = createToast(document.querySelector("#toast-region"));
  const busyApi = createBusyOverlay(document.querySelector("#busy-overlay"));
  const roots = {
    appShell: document.querySelector("#player-combat-app"),
    appHeader: document.querySelector(".app-header"),
    appTitle: document.querySelector("#app-title"),
    headerCharacter: document.querySelector("#header-character"),
    headerActions: document.querySelector("#header-actions"),
    utilityMenuButton: document.querySelector("#utility-menu-button"),
    utilityMenu: document.querySelector("#utility-menu"),
    importLauncher: document.querySelector("#import-launcher"),
    turnPanel: document.querySelector("#turn-economy-panel"),
    spellcastingBar: document.querySelector("#spellcasting-bar"),
    statusBar: document.querySelector("#combat-status-bar"),
    tabs: document.querySelector("#action-tabs")
  };

  let latestSnapshot = null;
  const render = (snapshot) => {
    latestSnapshot = snapshot;
    renderHeaderIdentity(roots, snapshot);
    renderUtilityMenu(roots, snapshot, { stateManager, storage, modalApi, showToast, busyApi, onSettingsChanged: () => render(latestSnapshot) });
    renderHeaderActions(roots.headerActions, snapshot, { stateManager, modalApi, showToast, busyApi });
    renderImportLauncher(roots.importLauncher, snapshot, { stateManager, modalApi, showToast, busyApi });
    renderTurnEconomyPanel(roots.turnPanel, snapshot, { stateManager, modalApi });
    renderSpellcastingBar(roots.spellcastingBar, snapshot, stateManager);
    renderCombatStatusBar(roots.statusBar, snapshot, { stateManager, modalApi });
    renderActionTabs(roots.tabs, snapshot, {
      stateManager,
      storage,
      modalApi,
      showToast,
      openAiSettings: () => openAiOptionsModal({
        modalApi,
        storage,
        showToast,
        onSettingsChanged: () => render(latestSnapshot)
      })
    });
    updateStickyHeaderOffset(roots);
  };

  installStickyHeaderOffset(roots);
  eventBus.on("state:changed", render);
  window.addEventListener("combat:end-turn-requested", () => showEndTurnModal({ modalApi, stateManager, busyApi }));

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

function installStickyHeaderOffset(roots) {
  updateStickyHeaderOffset(roots);
  window.addEventListener("resize", () => updateStickyHeaderOffset(roots));
  if (!roots.appHeader || typeof ResizeObserver === "undefined") return;
  const observer = new ResizeObserver(() => updateStickyHeaderOffset(roots));
  observer.observe(roots.appHeader);
}

function updateStickyHeaderOffset(roots) {
  if (!roots.appShell || !roots.appHeader) return;
  const height = Math.ceil(roots.appHeader.getBoundingClientRect().height);
  roots.appShell.style.setProperty("--sticky-header-height", `${height}px`);
}

export function showEndTurnModal({ modalApi, stateManager, busyApi }) {
  const snapshot = stateManager.getSnapshot?.();
  const reactionAvailable = snapshot?.combatState && !snapshot.combatState.turn?.reactionUsed;
  const unused = unusedTurnFeatures(snapshot);
  const actions = [
    reactionAvailable ? {
      label: "Use Reaction",
      variant: "secondary",
      close: false,
      onClick: () => {
        modalApi.close();
        window.dispatchEvent(new CustomEvent("combat:select-option-group", { detail: { group: "reaction" } }));
      }
    } : null,
    {
      label: "Return",
      variant: "secondary"
    },
    {
      label: "Start New Turn",
      variant: "primary",
      close: false,
      onClick: async () => {
        await busyApi.run("Starting new turn...", () => {
          const current = stateManager.getSnapshot?.();
          if (current?.combatState?.turnActive !== false) {
            stateManager.endTurn();
          }
          stateManager.startTurn();
        });
        modalApi.close();
      }
    }
  ].filter(Boolean);

  modalApi.showModal({
    title: "Turn Complete",
    body: `
      <p>Your turn is ready to end.</p>
      <p>You still have: ${escapeHeader(unused.length ? unused.join(", ") : "nothing unused this turn")}.</p>
    `,
    actions
  });
}

function unusedTurnFeatures(snapshot) {
  const character = snapshot?.activeCharacter;
  const state = snapshot?.combatState;
  if (!character || !state) return [];
  const speed = getEffectiveWalkSpeed(character, snapshot.referenceData);
  const movementLeft = Math.max(0, speed - Number(state.turn?.movementUsed ?? 0));
  return [
    state.turn?.actionUsed ? null : "Action",
    state.turn?.bonusActionUsed ? null : "Bonus Action",
    state.turn?.reactionUsed ? null : "Reaction",
    movementLeft > 0 ? `${movementLeft} ft movement` : null
  ].filter(Boolean);
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

function renderHeaderActions(root, snapshot, { stateManager, modalApi, showToast, busyApi }) {
  if (!root) return;
  if (!snapshot.activeCharacter) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = `
    <button class="btn btn-secondary" type="button" data-header-action="roll-log">Roll Log</button>
    <button class="btn btn-secondary" type="button" data-header-action="short-rest">Short Rest</button>
    <button class="btn btn-secondary" type="button" data-header-action="long-rest">Long Rest</button>
  `;

  root.querySelector("[data-header-action='roll-log']")?.addEventListener("click", () => openRollLogModal(snapshot.combatState, modalApi));
  root.querySelector("[data-header-action='short-rest']")?.addEventListener("click", async (event) => {
    showTransitionNotice(event.currentTarget, shortRestNotice(snapshot.activeCharacter, snapshot.combatState));
    await busyApi.run("Taking short rest...", () => stateManager.takeShortRest());
  });
  root.querySelector("[data-header-action='long-rest']")?.addEventListener("click", async (event) => {
    showTransitionNotice(event.currentTarget, longRestNotice(snapshot.activeCharacter, snapshot.combatState));
    await busyApi.run("Taking long rest...", () => stateManager.takeLongRest());
  });
}

function openRollLogModal(state, modalApi) {
  const rolls = (state?.log ?? []).filter((entry) => entry.type === "roll" || looksLikeRoll(entry.message));
  modalApi.showModal({
    title: "Dice Log",
    body: rolls.length ? `
      <ol class="dice-log-list">
        ${rolls.map((entry) => `
          <li class="dice-log-entry">
            <span>${escapeHeader(entry.message)}</span>
            <small>R${escapeHeader(entry.round)} ${escapeHeader(formatTime(entry.at))}</small>
          </li>
        `).join("")}
      </ol>
    ` : `<p class="inline-message">No dice rolls yet.</p>`,
    actions: [{ label: "Close", variant: "secondary" }]
  });
}

function looksLikeRoll(message) {
  return /:\s*-?\d+\s*\([^)]*(?:d\d+|modifier)/i.test(String(message ?? ""));
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderUtilityMenu(roots, snapshot, { stateManager, storage, modalApi, showToast, busyApi, onSettingsChanged }) {
  const button = roots.utilityMenuButton;
  const menu = roots.utilityMenu;
  if (!button || !menu) return;

  menu.innerHTML = `
    <button class="utility-menu-item" type="button" data-menu-action="import">
      ${snapshot.activeCharacter ? "Import / Replace Character" : "Import Character"}
    </button>
    <button class="utility-menu-item" type="button" data-menu-action="ai-options">
      AI Options${hasActiveAiSettings(storage) ? " (saved)" : ""}
    </button>
  `;

  if (!renderUtilityMenu.bound) {
    renderUtilityMenu.bound = true;
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") === "true";
      setUtilityMenuOpen(button, menu, !open);
    });
    document.addEventListener("click", (event) => {
      if (event.target === button || menu.contains(event.target)) return;
      setUtilityMenuOpen(button, menu, false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setUtilityMenuOpen(button, menu, false);
    });
  }

  menu.querySelector("[data-menu-action='import']")?.addEventListener("click", () => {
    setUtilityMenuOpen(button, menu, false);
    openImportModal({ modalApi, stateManager, showToast, busyApi });
  });
  menu.querySelector("[data-menu-action='ai-options']")?.addEventListener("click", () => {
    setUtilityMenuOpen(button, menu, false);
    openAiOptionsModal({ modalApi, storage, showToast, onSettingsChanged });
  });
}

function setUtilityMenuOpen(button, menu, open) {
  button.setAttribute("aria-expanded", String(open));
  menu.hidden = !open;
}

function renderImportLauncher(root, snapshot, { stateManager, modalApi, showToast, busyApi }) {
  if (!root) return;
  root.innerHTML = snapshot.activeCharacter ? "" : `
    <section class="import-empty" aria-label="Import character">
      <button class="btn btn-primary" type="button" data-action="import-character">Import Character</button>
    </section>
  `;
  root.querySelector("[data-action='import-character']")?.addEventListener("click", () => openImportModal({ modalApi, stateManager, showToast, busyApi }));
}

function openImportModal({ modalApi, stateManager, showToast, busyApi }) {
  const body = document.createElement("div");
  renderCharacterImportPanel(body, { stateManager, showToast, modalApi, busyApi });
  modalApi.showModal({
    title: "Import Character",
    body,
    actions: [{ label: "Close", variant: "secondary" }]
  });
}

function createBusyOverlay(root) {
  let depth = 0;
  const message = root?.querySelector("#busy-message");

  async function run(label, task) {
    show(label);
    await nextPaint();
    try {
      return await task();
    } finally {
      hide();
    }
  }

  function show(label = "Working...") {
    depth += 1;
    if (!root) return;
    if (message) message.textContent = label;
    root.hidden = false;
    root.classList.add("is-visible");
    document.body.classList.add("is-busy");
  }

  function hide() {
    depth = Math.max(0, depth - 1);
    if (depth || !root) return;
    root.classList.remove("is-visible");
    root.hidden = true;
    document.body.classList.remove("is-busy");
  }

  return { run, show, hide };
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}
