export async function parseDdbJsonFile(file) {
  if (!file) {
    return { raw: null, errors: ["Choose a JSON file to import."] };
  }

  try {
    return parseDdbJsonText(await file.text());
  } catch (error) {
    return { raw: null, errors: [`Could not read ${file.name}: ${error.message}`] };
  }
}

export function parseDdbJsonText(text) {
  if (!text?.trim()) {
    return { raw: null, errors: ["Paste character JSON before importing."] };
  }

  try {
    return { raw: JSON.parse(text), errors: [] };
  } catch (error) {
    return { raw: null, errors: [`Invalid JSON: ${error.message}`] };
  }
}
