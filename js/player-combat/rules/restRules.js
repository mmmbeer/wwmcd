export function resetShortRestResources(character, resourcesUsed = {}) {
  const shortRestIds = new Set(getShortRestResourceIds(character));
  return {
    ...resourcesUsed,
    classResources: Object.fromEntries(Object.entries(resourcesUsed.classResources ?? {}).map(([id, used]) => [
      id,
      shortRestIds.has(id) ? 0 : used
    ]))
  };
}

export function resetLongRestResources(resourcesUsed = {}) {
  return {
    ...resourcesUsed,
    spellSlots: {},
    classResources: {}
  };
}

export function getShortRestResourceIds(character) {
  return uniqueResources([
    ...(character?.resources?.classResources ?? []),
    ...(character?.resources?.limitedUses ?? [])
  ]).filter((resource) => resetsOnShortRest(resource.reset)).map((resource) => resource.id);
}

export function resetsOnShortRest(resetText) {
  return /\bshort\b.{0,30}\brest\b/i.test(String(resetText ?? ""));
}

function uniqueResources(resources) {
  const seen = new Set();
  return resources.filter((resource) => {
    const key = resource.id || resource.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
