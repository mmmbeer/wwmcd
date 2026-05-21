import { importCharacterFromPdf } from "../importers/ddbPdfImporterAdapter.js";
import { normalizeCharacter } from "../normalizers/characterNormalizer.js";
import { escapeHtml } from "./renderUtils.js";

export function renderCharacterImportPanel(root, { stateManager, showToast, modalApi, busyApi }) {
  root.innerHTML = `
    <form class="form-stack" id="character-import-form">
      <div class="field">
        <span class="field-label">Fillable Character Sheet PDF</span>
        <label class="pdf-dropzone" for="character-pdf-file" data-dropzone>
          <input class="visually-hidden" id="character-pdf-file" type="file" accept="application/pdf,.pdf">
          <span class="pdf-dropzone__title">Choose a PDF or drop it here</span>
          <span class="pdf-dropzone__meta">Fillable D&D Beyond or WotC character sheet</span>
        </label>
      </div>
      <div id="import-preview"></div>
      <div class="button-row">
        <button class="btn btn-primary" type="submit" data-action="import-character" disabled>Import</button>
        <button class="btn btn-secondary" type="button" data-action="clear-import">Clear</button>
      </div>
      <div id="import-feedback"></div>
    </form>
  `;

  const form = root.querySelector("#character-import-form");
  const pdfInput = root.querySelector("#character-pdf-file");
  const dropzone = root.querySelector("[data-dropzone]");
  const preview = root.querySelector("#import-preview");
  const feedback = root.querySelector("#import-feedback");
  const importButton = root.querySelector("[data-action='import-character']");
  let pendingImport = null;
  let loadToken = 0;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!pendingImport?.character) {
      feedback.innerHTML = `<div class="inline-message error">Choose a fillable PDF before importing.</div>`;
      return;
    }

    importButton.disabled = true;
    await runBusy(busyApi, "Importing character...", () => stateManager.importCharacter(pendingImport.character));
    feedback.innerHTML = renderWarnings(pendingImport.warnings);
    showToast({ type: "success", message: `${pendingImport.character.name} imported.` });
    window.dispatchEvent(new CustomEvent("combat:select-option-group", { detail: { group: "recommended" } }));
    modalApi?.close?.();
    clearImport({ keepFeedback: true });
  });

  pdfInput.addEventListener("change", () => {
    handlePdfFile(pdfInput.files?.[0]);
  });

  dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });

  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  });

  dropzone.addEventListener("dragleave", (event) => {
    if (!dropzone.contains(event.relatedTarget)) {
      dropzone.classList.remove("is-dragging");
    }
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
    handlePdfFile(event.dataTransfer?.files?.[0]);
  });

  root.querySelector("[data-action='clear-import']").addEventListener("click", () => {
    clearImport();
  });

  async function handlePdfFile(file) {
    const token = ++loadToken;
    pendingImport = null;
    importButton.disabled = true;
    feedback.replaceChildren();

    if (!file) {
      preview.replaceChildren();
      return;
    }

    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      preview.innerHTML = `<div class="inline-message error">Choose a PDF file.</div>`;
      return;
    }

    preview.innerHTML = `<div class="inline-message">Reading ${escapeHtml(file.name)}.</div>`;
    const parsed = await importCharacterFromPdf(file);
    if (token !== loadToken) return;

    if (parsed.errors.length) {
      preview.innerHTML = `<div class="inline-message error">${escapeHtml(parsed.errors.join(" "))}</div>`;
      return;
    }

    const result = normalizeCharacter(parsed.raw);
    if (result.errors.length) {
      preview.innerHTML = `<div class="inline-message error">${escapeHtml(result.errors.join(" "))}</div>`;
      return;
    }

    pendingImport = {
      character: result.character,
      warnings: [...(parsed.warnings ?? []), ...result.warnings]
    };
    importButton.disabled = false;
    preview.innerHTML = renderImportPreview(result.character, file.name);
  }

  function clearImport({ keepFeedback = false } = {}) {
    loadToken++;
    pendingImport = null;
    form.reset();
    importButton.disabled = true;
    preview.replaceChildren();
    if (!keepFeedback) feedback.replaceChildren();
    dropzone.classList.remove("is-dragging");
  }
}

function runBusy(busyApi, label, task) {
  return busyApi?.run ? busyApi.run(label, task) : task();
}

function renderImportPreview(character, fileName) {
  return `
    <div class="import-preview">
      <span class="status-label">Ready to import</span>
      <strong>${escapeHtml(character.name)}</strong>
      <span>${escapeHtml(formatCharacterClasses(character))}</span>
      <small>${escapeHtml(fileName)}</small>
    </div>
  `;
}

function formatCharacterClasses(character) {
  const classes = character.classes ?? [];
  if (classes.length) {
    return classes.map((entry) => `${entry.name} ${entry.level || "?"}`).join(" / ");
  }
  return character.level ? `Level ${character.level}` : "Class and level not found";
}

function renderWarnings(warnings) {
  if (!warnings.length) return "";
  return `
    <div class="inline-message warning">
      <strong>Imported with warnings</strong>
      <ul class="warning-list">
        ${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
      </ul>
    </div>
  `;
}
