import { buildNormalizerInput } from "./pdfCharacterInputBuilder.js";
import { extractPdfFormFields } from "./pdfFormFieldExtractor.js";
import { decodeBytes, inflatePdfStreams } from "./pdfTextExtractor.js";

export function canImportPdf() {
  return true;
}

export async function importCharacterFromPdf(file) {
  try {
    const buffer = await file.arrayBuffer();
    return importCharacterFromPdfBuffer(buffer, { sourceName: file.name });
  } catch (error) {
    return {
      accepted: false,
      raw: null,
      warnings: [],
      errors: [`Could not read ${file?.name ?? "PDF file"}: ${error.message}`]
    };
  }
}

export async function importCharacterFromPdfBuffer(buffer, { sourceName = "Character Sheet.pdf" } = {}) {
  const text = decodeBytes(buffer);
  const inflatedTexts = await inflatePdfStreams(buffer);
  return importCharacterFromPdfText([text, ...inflatedTexts], { sourceName });
}

export function importCharacterFromPdfText(texts, { sourceName = "Character Sheet.pdf" } = {}) {
  const warnings = [];
  const sourceTexts = Array.isArray(texts) ? texts : [texts];
  const text = sourceTexts[0] ?? "";

  if (!text.startsWith("%PDF-")) {
    return { accepted: false, raw: null, warnings, errors: ["Unsupported PDF file: missing PDF header."] };
  }

  const fields = extractPdfFormFields(sourceTexts);
  if (!fields.size) {
    return {
      accepted: false,
      raw: null,
      warnings,
      errors: ["No fillable PDF form fields were found. Scanned or flattened character sheets are not supported."]
    };
  }

  warnings.push(`PDF form fields extracted: ${fields.size}.`);
  warnings.push("PDF import is best-effort; review extracted values before play.");

  const raw = buildNormalizerInput(fields, sourceName);
  if (!raw.name) warnings.push("Character name was not found; source file name was used.");
  if (!raw.classes.length) warnings.push("Class and level were not found.");
  if (!raw.inventory.length) warnings.push("No straightforward PDF weapon rows were found.");
  if (!raw.spells.pdf.length) warnings.push("No straightforward PDF spells were found.");

  return {
    accepted: Boolean(raw.name && (raw.classes.length || raw.stats.some((stat) => stat.value !== 10))),
    raw,
    warnings,
    errors: []
  };
}
