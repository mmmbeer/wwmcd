import { parseDdbJsonFile, parseDdbJsonText } from "../importers/ddbJsonImporter.js";
import { normalizeCharacter } from "../normalizers/characterNormalizer.js";
import { escapeHtml } from "./renderUtils.js";

export function renderCharacterImportPanel(root, { stateManager, showToast }) {
  root.innerHTML = `
    <form class="form-stack" id="character-import-form">
      <div class="field">
        <label for="character-json-file">Upload D&D Beyond JSON</label>
        <input id="character-json-file" type="file" accept="application/json,.json">
      </div>
      <div class="field">
        <label for="character-json-text">Paste D&D Beyond JSON</label>
        <textarea id="character-json-text" placeholder="{ }"></textarea>
      </div>
      <div class="button-row">
        <button class="btn btn-primary" type="submit">Import</button>
        <button class="btn btn-secondary" type="button" data-action="clear-import">Clear</button>
      </div>
      <div id="import-feedback"></div>
    </form>
  `;

  const form = root.querySelector("#character-import-form");
  const fileInput = root.querySelector("#character-json-file");
  const textInput = root.querySelector("#character-json-text");
  const feedback = root.querySelector("#import-feedback");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const parsed = fileInput.files?.[0]
      ? await parseDdbJsonFile(fileInput.files[0])
      : parseDdbJsonText(textInput.value);

    if (parsed.errors.length) {
      feedback.innerHTML = `<div class="inline-message error">${escapeHtml(parsed.errors.join(" "))}</div>`;
      return;
    }

    const result = normalizeCharacter(parsed.raw);
    if (result.errors.length) {
      feedback.innerHTML = `<div class="inline-message error">${escapeHtml(result.errors.join(" "))}</div>`;
      return;
    }

    stateManager.importCharacter(result.character);
    feedback.innerHTML = renderWarnings(result.warnings);
    showToast({ type: "success", message: `${result.character.name} imported.` });
    form.reset();
  });

  root.querySelector("[data-action='clear-import']").addEventListener("click", () => {
    form.reset();
    feedback.replaceChildren();
  });
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
