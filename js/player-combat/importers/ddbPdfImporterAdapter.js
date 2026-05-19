const ABILITY_FIELDS = [
  ["str", 1, "STR"],
  ["dex", 2, "DEX"],
  ["con", 3, "CON"],
  ["int", 4, "INT"],
  ["wis", 5, "WIS"],
  ["cha", 6, "CHA"]
];

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

function buildNormalizerInput(fields, sourceName) {
  const classes = parseClasses(firstField(fields, ["CLASS LEVEL", "ClassLevel"]));
  const level = classes.reduce((sum, entry) => sum + Number(entry.level ?? 0), 0);
  const proficiencyBonus = numberFrom(field(fields, "ProfBonus"), proficiencyBonusForLevel(level));
  const spells = extractSpells(fields);
  return {
    name: firstField(fields, ["CharacterName", "CharacterName2", "CharacterName4"]) || sourceName.replace(/\.pdf$/i, ""),
    race: { name: firstField(fields, ["RACE", "RACE2", "Race"]) },
    classes,
    stats: ABILITY_FIELDS.map(([, id, name]) => ({ id, value: numberFrom(field(fields, name), 10) })),
    baseHitPoints: numberFrom(firstField(fields, ["MaxHP", "HPMax"]), 0),
    currentHp: numberFrom(firstField(fields, ["CurrentHP", "HPCurrent"]), numberFrom(firstField(fields, ["MaxHP", "HPMax"]), 0)),
    temporaryHitPoints: numberFrom(firstField(fields, ["TempHP", "HPTemp"]), 0),
    armorClass: numberFrom(field(fields, "AC"), 10),
    initiative: numberFrom(firstField(fields, ["Init", "Initiative"]), 0),
    proficiencyBonus,
    speed: { walk: numberFromText(field(fields, "Speed"), 30) },
    inventory: extractWeapons(fields),
    spellSlots: Object.fromEntries(spells.slots.map((slot) => [slot.level, slot.max])),
    spells: { pdf: spells.known },
    features: extractFeatures(fields),
    source: { type: "pdf", sourceName, importedAt: new Date().toISOString() }
  };
}

function extractWeapons(fields) {
  const weapons = [];
  for (let index = 1; index <= 12; index += 1) {
    const suffix = index === 1 ? "" : ` ${index}`;
    const name = field(fields, `Wpn Name${suffix}`);
    if (!name) continue;
    const damage = parseDamage(field(fields, `Wpn${index} Damage`));
    weapons.push({
      equipped: true,
      definition: {
        name,
        filterType: "Weapon",
        type: "Weapon",
        damage: damage.dice ? { diceString: damage.dice } : null,
        damageType: damage.type,
        propertiesText: field(fields, `Wpn Notes ${index}`)
      }
    });
  }
  return weapons;
}

function extractSpells(fields) {
  let currentLevel = 0;
  const slots = [];
  const spells = [];
  const castingAbility = abilityFromText(field(fields, "spellCastingAbility0"));

  for (const [name, value] of fields.entries()) {
    const clean = cleanValue(value);
    if (/^spellHeader\d+$/i.test(name)) {
      currentLevel = parseSpellHeaderLevel(clean);
      continue;
    }
    if (/^spellSlotHeader\d+$/i.test(name)) {
      const slot = parseSpellSlotHeader(clean, currentLevel);
      if (slot) slots.push(slot);
      continue;
    }

    const match = name.match(/^spellName(\d+)$/i);
    if (!match || !clean) continue;
    const index = match[1];
    const saveHit = field(fields, `spellSaveHit${index}`);
    spells.push({
      prepared: isMarked(field(fields, `spellPrepared${index}`)) || currentLevel === 0,
      spellCastingAbilityId: castingAbility,
      definition: {
        name: clean,
        level: currentLevel,
        castingTime: field(fields, `spellCastingTime${index}`),
        range: field(fields, `spellRange${index}`),
        duration: field(fields, `spellDuration${index}`),
        concentration: /concentration/i.test(field(fields, `spellDuration${index}`)),
        description: [field(fields, `spellNotes${index}`), saveHit].filter(Boolean).join(" "),
        saveDcAbilityId: abilityIdFromSaveHit(saveHit)
      }
    });
  }

  return { known: uniqueSpells(spells), slots: uniqueSlots(slots) };
}

function extractPdfFormFields(texts) {
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

async function inflatePdfStreams(buffer) {
  if (typeof DecompressionStream !== "function") return [];
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const text = decodeBytes(bytes);
  const streams = [];
  let index = 0;
  while (index < text.length) {
    const streamMarker = text.indexOf("stream", index);
    if (streamMarker === -1) break;
    const dictStart = text.lastIndexOf("<<", streamMarker);
    const dictText = dictStart === -1 ? "" : text.slice(dictStart, streamMarker);
    const start = streamDataStart(text, streamMarker + "stream".length);
    const end = text.indexOf("endstream", start);
    if (end === -1) break;
    if (/\/FlateDecode\b/.test(dictText)) {
      try {
        streams.push(await inflateDeflateBytes(trimStreamBytes(bytes.subarray(start, end))));
      } catch {
        // Some PDFs advertise FlateDecode streams that are not plain deflate form data.
      }
    }
    index = end + "endstream".length;
  }
  return streams;
}

function parseClasses(value) {
  const text = cleanValue(value);
  if (!text) return [];
  const entries = text.split(/\s*(?:\/|,|;|\band\b)\s*/i).map((part) => {
    const match = part.match(/^(.+?)\s+(\d+)$/);
    return match ? { name: match[1].trim(), level: Number(match[2]) } : null;
  }).filter(Boolean);
  return entries.length ? entries : [{ name: text, level: 0 }];
}

function extractFeatures(fields) {
  const classFeatures = splitNotes(firstField(fields, ["ClassFeatures", "ClassFeatures1"]));
  const racialTraits = splitNotes(firstField(fields, ["RacialTraits", "RacialTraits1"]));
  const feats = splitNotes(firstField(fields, ["Feats", "Feats1"]));
  const genericFeatures = parseFeatureBlocks([
    numberedFields(fields, "FeaturesTraits").join("\n"),
    numberedFields(fields, "Actions").join("\n")
  ].filter(Boolean).join("\n"));

  return {
    classFeatures,
    racialTraits,
    feats,
    other: genericFeatures
  };
}

function parseFeatureBlocks(text) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const entries = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = normalizeFeatureHeading(rawLine);
    if (!line || isFeatureSectionHeading(line) || isFeatureDetailLine(line)) continue;

    const description = collectFeatureDescription(lines, index + 1);
    entries.push(description ? { name: line, description } : { name: line });
  }

  return uniqueFeatureEntries(entries);
}

function collectFeatureDescription(lines, start) {
  const details = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || isFeatureSectionHeading(line)) break;
    if (!isFeatureDetailLine(line)) break;
    details.push(line.trim().replace(/^\s*(?:[-*]|\d+[.)])\s*/, ""));
  }
  return details.join(" ");
}

function normalizeFeatureHeading(line) {
  return String(line ?? "")
    .trim()
    .replace(/^\*\s*/, "")
    .replace(/^\d+\s*:\s*/, "")
    .replace(/^=+\s*/, "")
    .replace(/\s*=+$/, "")
    .replace(/\s*\[[^\]]+\]\s*$/, "")
    .replace(/\s+•.*$/, "")
    .replace(/\s+["“].*$/, "")
    .replace(/\s+\d+\s*(?:Action|Bonus Action|Reaction)$/i, "")
    .trim();
}

function isFeatureSectionHeading(line) {
  return /^=+\s*[^=]+\s*=+$/i.test(line)
    || /^(?:[A-Z][A-Z\s]+ )?(?:FEATURES|TRAITS)$/i.test(normalizeFeatureHeading(line))
    || /^(actions?|bonus actions?|reactions?|special|other|limited use|limited uses)$/i.test(normalizeFeatureHeading(line));
}

function isFeatureDetailLine(line) {
  return /^\s/.test(line)
    || /^\|/.test(line)
    || /^[•-]\s/.test(line)
    || /^\d+\s+\w/.test(line)
    || /^(you|when|whenever|if|once|as |on |also|to |starting|beginning|after|before|while|until|this|the |a |an |speed )\b/i.test(line)
    || /^\d+\s*(?:Action|Bonus Action|Reaction)$/i.test(line);
}

function uniqueFeatureEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = normalizeFieldName(entry.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function numberedFields(fields, prefix) {
  return [...fields.entries()]
    .filter(([name]) => new RegExp(`^${prefix}\\d+$`, "i").test(name))
    .sort(([left], [right]) => Number(left.match(/\d+$/)?.[0] ?? 0) - Number(right.match(/\d+$/)?.[0] ?? 0))
    .map(([, value]) => cleanValue(value))
    .filter(Boolean);
}

function parseSpellHeaderLevel(value) {
  if (/cantrip/i.test(value)) return 0;
  const match = String(value ?? "").match(/(\d+)(?:st|nd|rd|th)?\s+level/i);
  return match ? Number(match[1]) : 0;
}

function parseSpellSlotHeader(value, level) {
  const match = String(value ?? "").match(/(\d+)\s+Slots?/i);
  return match && level > 0 ? { level, max: Number(match[1]) } : null;
}

function field(fields, name) {
  if (fields.has(name)) return cleanValue(fields.get(name));
  const normalized = normalizeFieldName(name);
  for (const [fieldName, value] of fields.entries()) {
    if (normalizeFieldName(fieldName) === normalized) return cleanValue(value);
  }
  return "";
}

function firstField(fields, names) {
  return names.map((name) => field(fields, name)).find(Boolean) ?? "";
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

function parseDamage(value) {
  const match = String(value ?? "").match(/(\d+d\d+)(?:\s*[+-]\s*\d+)?\s*([a-z]+)?/i);
  return { dice: match?.[1] ?? "", type: match?.[2] ?? "" };
}

function abilityFromText(value) {
  return ({ str: 1, strength: 1, dex: 2, dexterity: 2, con: 3, constitution: 3, int: 4, intelligence: 4, wis: 5, wisdom: 5, cha: 6, charisma: 6 })[
    String(value ?? "").trim().toLowerCase()
  ] ?? null;
}

function abilityIdFromSaveHit(value) {
  const match = String(value ?? "").match(/\b(STR|DEX|CON|INT|WIS|CHA)\b/i);
  return abilityFromText(match?.[1]);
}

function isMarked(value) {
  return /^(yes|true|on|1|x|checked)$/i.test(String(value ?? "").trim());
}

function uniqueSpells(spells) {
  const seen = new Set();
  return spells.filter((spell) => {
    const key = spell.definition.name.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueSlots(slots) {
  const byLevel = new Map();
  for (const slot of slots) byLevel.set(slot.level, slot);
  return [...byLevel.values()];
}

function splitNotes(value) {
  return String(value ?? "").split(/\r?\n|;/).map((entry) => entry.trim()).filter(Boolean);
}

function cleanValue(value) {
  return decodePdfUnicodeText(String(value ?? "")).replace(/\r/g, "\n").replace(/\s+\n/g, "\n").trim();
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

function normalizeFieldName(value) {
  return String(value ?? "").replace(/\s+/g, "").toLowerCase();
}

function decodeBytes(buffer) {
  return new TextDecoder("latin1").decode(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));
}

function skipWhitespace(text, index) {
  while (/\s/.test(text[index] ?? "")) index += 1;
  return index;
}

function decodeEscapedChar(char) {
  return ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" })[char] ?? char;
}

function numberFrom(value, fallback) {
  const numeric = Number(String(value ?? "").replace(/^\+/, ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function numberFromText(value, fallback) {
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : fallback;
}

function proficiencyBonusForLevel(level) {
  return Math.max(2, Math.ceil((Number(level || 1) - 1) / 4) + 2);
}

function streamDataStart(text, index) {
  if (text[index] === "\r" && text[index + 1] === "\n") return index + 2;
  if (text[index] === "\n" || text[index] === "\r") return index + 1;
  return index;
}

function trimStreamBytes(bytes) {
  let end = bytes.length;
  while (end > 0 && (bytes[end - 1] === 10 || bytes[end - 1] === 13)) end -= 1;
  return bytes.subarray(0, end);
}

async function inflateDeflateBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return decodeBytes(new Uint8Array(await new Response(stream).arrayBuffer()));
}
