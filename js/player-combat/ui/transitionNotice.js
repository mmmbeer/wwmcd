import { getShortRestResourceIds } from "../rules/restRules.js";

export function showTransitionNotice(anchor, { title, items = [], detail = "", timeout = 2600 }) {
  if (!anchor) return;
  document.querySelectorAll(".transition-popover").forEach((node) => node.remove());

  const popover = document.createElement("div");
  popover.className = "transition-popover";
  popover.setAttribute("role", "status");
  popover.setAttribute("aria-live", "polite");

  const heading = document.createElement("strong");
  heading.textContent = title;
  popover.append(heading);

  if (items.length) {
    const list = document.createElement("ul");
    for (const item of items) {
      const row = document.createElement("li");
      row.textContent = item;
      list.append(row);
    }
    popover.append(list);
  }

  if (detail) {
    const text = document.createElement("small");
    text.textContent = detail;
    popover.append(text);
  }

  document.body.append(popover);
  positionPopover(anchor, popover);
  window.setTimeout(() => popover.classList.add("is-visible"), 20);
  window.setTimeout(() => popover.remove(), timeout);
}

export function turnDoneNotice(state) {
  const items = [
    "Resets action, bonus action, free action, movement, and this-turn spell limits.",
    `Advances round ${Number(state?.round ?? 1)} to ${Number(state?.round ?? 1) + 1}.`
  ];
  if (state?.turn?.reactionUsed) items.push("Reaction remains spent until its round reset.");
  if (state?.turn?.readiedAction) items.push("Readied action remains available as a reaction.");
  return { title: "Turn Done", items };
}

export function shortRestNotice(character, state) {
  const resetIds = new Set(getShortRestResourceIds(character));
  const resetNames = spentResourceNames(character, state).filter((resource) => resetIds.has(resource.id));
  return {
    title: "Short Rest",
    items: [
      resetNames.length ? `Resets: ${resetNames.map((entry) => entry.name).join(", ")}.` : "No spent short-rest resources to reset.",
      "Keeps spell slots and long-rest resources unchanged."
    ]
  };
}

export function longRestNotice(character, state) {
  const resources = spentResourceNames(character, state);
  const spellSlotsUsed = Object.values(state?.resourcesUsed?.spellSlots ?? {}).some((used) => Number(used) > 0);
  const items = [];
  items.push(spellSlotsUsed ? "Resets spent spell slots." : "No spent spell slots to reset.");
  items.push(resources.length ? `Resets limited resources: ${resources.map((entry) => entry.name).join(", ")}.` : "No spent limited resources to reset.");
  return { title: "Long Rest", items };
}

function spentResourceNames(character, state) {
  const resourcesById = new Map([
    ...(character?.resources?.classResources ?? []),
    ...(character?.resources?.limitedUses ?? [])
  ].map((resource) => [resource.id, resource.name ?? resource.id]));
  return Object.entries(state?.resourcesUsed?.classResources ?? {})
    .filter(([, used]) => Number(used) > 0)
    .map(([id]) => ({ id, name: resourcesById.get(id) ?? id }));
}

function positionPopover(anchor, popover) {
  const rect = anchor.getBoundingClientRect();
  const gap = 8;
  const maxLeft = window.innerWidth - popover.offsetWidth - 8;
  const left = Math.max(8, Math.min(rect.left, maxLeft));
  const below = rect.bottom + gap;
  const top = below + popover.offsetHeight < window.innerHeight
    ? below
    : Math.max(8, rect.top - popover.offsetHeight - gap);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}
