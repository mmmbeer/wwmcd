import { normalizeName } from "../data/combatDataTransformer.js";

export function getResourceActions(character, combatState) {
  return uniqueResources([
    ...(character?.resources?.classResources ?? []),
    ...(character?.resources?.limitedUses ?? [])
  ]).map((resource, index) => createResourceOption(resource, combatState, index));
}

function createResourceOption(resource, combatState, index) {
  const max = Number(resource.max ?? 0);
  const used = Math.min(Number(combatState?.resourcesUsed?.classResources?.[resource.id] ?? 0), max);
  const remaining = Math.max(0, max - used);
  return {
    id: `resource_${normalizeName(resource.name).replace(/[^a-z0-9]+/g, "_") || index}`,
    name: resource.name,
    description: `${remaining} of ${max} remaining.`,
    source: "resource",
    group: "resources",
    resource: "Limited resource",
    tags: ["resource", resource.source].filter(Boolean),
    cost: {},
    recommended: false,
    rolls: [],
    warnings: remaining <= 0 ? [`${resource.name} has no uses remaining.`] : [],
    meta: [
      `${used} / ${max} used`,
      resource.reset ? `Resets: ${resource.reset}` : null,
      resource.cost ? `Typical cost: ${resource.cost}` : null,
      resource.note || null
    ].filter(Boolean)
  };
}

function uniqueResources(resources) {
  const seen = new Set();
  return resources.filter((resource) => {
    const key = resource.id || normalizeName(resource.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
