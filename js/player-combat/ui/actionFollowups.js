import { canPairAfterPrimary, isDependentOption } from "../recommendations/recommendationPrerequisites.js";

export function followupOptions(groups, usedOption) {
  const options = [
    ...(groups.resources ?? []),
    ...(groups.free ?? []),
    ...(groups.movement ?? []),
    ...(groups.attacks ?? []),
    ...(groups.actions ?? []),
    ...(groups.bonus ?? []),
    ...(groups.reaction ?? [])
  ];
  return options
    .filter((option) => option.id !== usedOption.id && option.available !== false)
    .filter((option) => !isDependentOption(option) || canPairAfterPrimary(option, usedOption))
    .filter((option) => isDependentOption(option) || option.cost?.action || option.cost?.bonus || option.cost?.reaction || option.cost?.movement || option.cost?.object)
    .slice(0, 6);
}
