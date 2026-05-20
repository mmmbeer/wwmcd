export function field(fields, name) {
  if (fields.has(name)) return cleanValue(fields.get(name));
  const normalized = normalizeFieldName(name);
  for (const [fieldName, value] of fields.entries()) {
    if (normalizeFieldName(fieldName) === normalized) return cleanValue(value);
  }
  return "";
}

export function firstField(fields, names) {
  return names.map((name) => field(fields, name)).find(Boolean) ?? "";
}

export function numberedFields(fields, prefix) {
  return [...fields.entries()]
    .filter(([name]) => new RegExp(`^${prefix}\\d+$`, "i").test(name))
    .sort(([left], [right]) => Number(left.match(/\d+$/)?.[0] ?? 0) - Number(right.match(/\d+$/)?.[0] ?? 0))
    .map(([, value]) => cleanValue(value))
    .filter(Boolean);
}

export function cleanValue(value) {
  return decodePdfUnicodeText(String(value ?? "")).replace(/\r/g, "\n").replace(/\s+\n/g, "\n").trim();
}

export function normalizeFieldName(value) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

function decodePdfUnicodeText(value) {
  if (!value) return "";
  if (value.startsWith("\u00FE\u00FF")) return decodeUtf16BeBytes(value, 2);
  if ((value.match(/\u0000/g) ?? []).length > value.length / 4) return decodeUtf16BeBytes(value, 0);
  return value;
}

function decodeUtf16BeBytes(value, start) {
  let text = "";
  for (let index = start; index + 1 < value.length; index += 2) {
    const code = (value.charCodeAt(index) << 8) + value.charCodeAt(index + 1);
    if (code) text += String.fromCharCode(code);
  }
  return text;
}
