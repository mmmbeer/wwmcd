import { firstField, normalizeFieldName, numberedFields } from "./pdfFieldUtils.js";

export function extractFeatures(fields) {
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
    .replace(/\s+[^A-Za-z0-9]*\s*(?:PHB|XGE|TCE|TCoE|DMG|SCAG|EEPC|VGM|MTF|FTD|SCC|MOTM)(?:-\d+)?(?:\s+\d+)?.*$/i, "")
    .replace(/\s+â€¢.*$/, "")
    .replace(/\s+["â€œ].*$/, "")
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
    || /^[â€¢-]\s/.test(line)
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

function splitNotes(value) {
  return String(value ?? "").split(/\r?\n|;/).map((entry) => entry.trim()).filter(Boolean);
}
