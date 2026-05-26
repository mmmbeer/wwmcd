export function buildTacticalFacts({ playerIntent = {}, combatState = {}, selectedCreatures = [] } = {}) {
  const notes = [playerIntent.userNotes, playerIntent.situation, playerIntent.range].filter(Boolean).join(" ");
  const lower = notes.toLowerCase();
  const cover = parseDirectionalDistance(notes, /\bcover\b/i);
  const darkness = parseDirectionalDistance(notes, /\bdarkness\b/i);
  return pruneEmpty({
    targetDistanceFt: parseDistanceFt(notes),
    hasLineOfSight: inferLineOfSight(lower),
    coverAvailable: /\bcover\b/i.test(notes),
    coverDistanceFt: cover.distanceFt,
    coverDirection: cover.direction,
    darknessDistanceFt: darkness.distanceFt,
    darknessDirection: darkness.direction,
    exitBlocked: /\b(exit|escape|door|path|way)\b[^.]{0,30}\b(blocked|sealed|shut|closed)\b/i.test(notes)
      || /\b(blocked|sealed|shut|closed)\b[^.]{0,30}\b(exit|escape|door|path|way)\b/i.test(notes),
    currentConcentration: combatState?.concentration ?? combatState?.current?.concentration ?? null,
    hexTarget: inferHexTarget(notes, selectedCreatures),
    targetName: inferTargetName(notes, selectedCreatures),
    playerGoal: playerIntent.goal || "best overall turn"
  });
}

function parseDistanceFt(text) {
  const match = String(text ?? "").match(/\b(\d{1,3})\s*(?:ft|feet|foot)\b/i);
  return match ? Number(match[1]) : undefined;
}

function parseDirectionalDistance(text, keywordPattern) {
  const source = String(text ?? "");
  if (!keywordPattern.test(source)) return {};
  const segments = source.split(/[.;,]/).filter((segment) => keywordPattern.test(segment));
  const relevant = segments[0] ?? source;
  return pruneEmpty({
    distanceFt: parseDistanceFt(relevant) ?? parseDistanceFt(source),
    direction: parseDirection(relevant) ?? parseDirection(source)
  });
}

function parseDirection(text) {
  const match = String(text ?? "").match(/\b(left|right|behind|ahead|front|north|south|east|west)\b/i);
  return match ? match[1].toLowerCase() : undefined;
}

function inferLineOfSight(text) {
  if (/\b(no|without|blocked)\s+line of sight\b/.test(text) || /\bline of sight\s+(blocked|lost)\b/.test(text)) return false;
  if (/\b(line of sight|can see|visible|clear shot)\b/.test(text)) return true;
  return undefined;
}

function inferHexTarget(text, selectedCreatures) {
  if (!/\bhex\b/i.test(text)) return undefined;
  const creature = inferTargetName(text, selectedCreatures);
  return creature || undefined;
}

function inferTargetName(text, selectedCreatures = []) {
  const creature = (selectedCreatures ?? []).find((entry) => {
    const name = String(entry?.name ?? "");
    return name && new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text);
  });
  if (creature?.name) return creature.name;
  const match = String(text ?? "").match(/\b(?:target|enemy|fighting|against|hex(?:ed)?(?: on)?)\s+(?:is\s+)?(?:an?\s+|the\s+)?([A-Z][A-Za-z' -]{2,40})\b/);
  return match ? match[1].trim() : undefined;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pruneEmpty(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""));
}
