import { cleanValue, field, normalizeFieldName } from "./pdfFieldUtils.js";

export function extractPdfFormFields(texts) {
  const fields = new Map();
  const normalizedNames = new Map();
  for (const text of texts) {
    let index = 0;
    while (index < text.length) {
      const marker = text.indexOf("/T", index);
      if (marker === -1) break;
      const nameToken = readPdfStringObject(text, marker + 2);
      if (!nameToken) {
        index = marker + 2;
        continue;
      }
      const nextMarker = findNextFieldNameMarker(text, nameToken.end);
      const searchEnd = nextMarker === -1 ? Math.min(text.length, nameToken.end + 4000) : nextMarker;
      const valueMarker = text.indexOf("/V", nameToken.end);
      if (valueMarker !== -1 && valueMarker < searchEnd) {
        const valueToken = readPdfValueObject(text, valueMarker + 2);
        const name = cleanValue(nameToken.value);
        const value = cleanValue(valueToken?.value);
        const normalized = normalizeFieldName(name);
        const existing = normalizedNames.get(normalized);
        if (name && value && (!existing || !field(fields, existing))) {
          fields.set(existing ?? name, value);
          normalizedNames.set(normalized, existing ?? name);
        }
      }
      index = nameToken.end;
    }
  }
  return fields;
}

function readPdfValueObject(text, start) {
  const stringToken = readPdfStringObject(text, start);
  if (stringToken) return stringToken;
  const index = skipWhitespace(text, start);
  if (text[index] !== "/") return null;
  const match = text.slice(index).match(/^\/([^\s/<>\[\]()]+)/);
  return match ? { value: match[1], end: index + match[0].length } : null;
}

function readPdfStringObject(text, start) {
  const index = skipWhitespace(text, start);
  if (text[index] === "(") return readLiteralString(text, index);
  if (text[index] === "<" && text[index + 1] !== "<") return readHexString(text, index);
  return null;
}

function readLiteralString(text, start) {
  let value = "";
  let depth = 0;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (index === start) {
      depth = 1;
    } else if (escaped) {
      value += decodeEscapedChar(char);
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "(") {
      depth += 1;
      value += char;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) return { value, end: index + 1 };
      value += char;
    } else {
      value += char;
    }
  }
  return null;
}

function readHexString(text, start) {
  const end = text.indexOf(">", start + 1);
  if (end === -1) return null;
  const hex = text.slice(start + 1, end).replace(/[^0-9a-f]/gi, "");
  let value = "";
  for (let index = 0; index < hex.length; index += 2) {
    value += String.fromCharCode(parseInt(hex.slice(index, index + 2).padEnd(2, "0"), 16));
  }
  return { value, end: end + 1 };
}

function findNextFieldNameMarker(text, start) {
  let index = start;
  while (index < text.length) {
    const marker = text.indexOf("/T", index);
    if (marker === -1) return -1;
    if (/\s|\(|</.test(text[marker + 2] ?? "")) return marker;
    index = marker + 2;
  }
  return -1;
}

function skipWhitespace(text, index) {
  while (/\s/.test(text[index] ?? "")) index += 1;
  return index;
}

function decodeEscapedChar(char) {
  return ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" })[char] ?? char;
}
