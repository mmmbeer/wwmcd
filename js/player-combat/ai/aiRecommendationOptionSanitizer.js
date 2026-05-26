const SPELL_ATTACK_NAMES = /\b(?:fire bolt|eldritch blast|guiding bolt|inflict wounds|shocking grasp|ray of frost|chromatic orb|scorching ray|chill touch|produce flame|sacred flame|toll the dead)\b/i;

export function characterSpellNames(character) {
  return new Set([
    ...(character?.spells?.cantrips ?? []),
    ...(character?.spells?.known ?? []),
    ...(character?.spells?.prepared ?? [])
  ].map((spell) => String(spell?.name ?? spell).trim().toLowerCase()).filter(Boolean));
}

export function isSpellLikeWeaponOption(option, spellNames = new Set()) {
  if (!option || option.source !== "weapon") return false;
  const name = String(option.name ?? "").trim().toLowerCase();
  const text = [
    option.id,
    option.name,
    option.description,
    option.summary,
    ...(option.tags ?? []),
    ...(option.meta ?? [])
  ].filter(Boolean).join(" ");
  return spellNames.has(name)
    || SPELL_ATTACK_NAMES.test(name)
    || /\bspell attack\b|\bcantrip\b|\bV\/?S(?:\/?M)?\b|\bcomponents?\b/i.test(text);
}

export function isSpellLikeWeaponItem(item, spellNames = new Set()) {
  const name = String(item?.name ?? "").trim().toLowerCase();
  const text = [
    item?.name,
    item?.type,
    item?.category,
    item?.properties,
    item?.description,
    item?.note
  ].filter(Boolean).join(" ");
  return spellNames.has(name)
    || SPELL_ATTACK_NAMES.test(name)
    || /\bspell attack\b|\bcantrip\b|\bV\/?S(?:\/?M)?\b|\bcomponents?\b/i.test(text);
}
