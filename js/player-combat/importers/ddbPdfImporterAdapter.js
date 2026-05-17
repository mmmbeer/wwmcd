export function canImportPdf() {
  return false;
}

export async function importCharacterFromPdf(file) {
  return {
    accepted: false,
    character: null,
    warnings: [
      `${file?.name ?? "PDF import"} is not enabled in this phase. Use D&D Beyond JSON upload or paste.`
    ],
    errors: []
  };
}
