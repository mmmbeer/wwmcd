const LINE_OF_SIGHT = /\b(line of sight|los|can see|visible|not visible|total cover)\b/i;
const COVER = /\b(cover|half cover|three-quarters cover|wall|pillar|corner)\b/i;
const TARGET_COUNT = /\b(\d+\s+(enemies|targets|creatures)|single target|cluster|group|mob|horde)\b/i;
const ALLY_STATUS = /\b(ally|allies|down|unconscious|injured|bloodied|healing)\b/i;

export function buildClarificationContext({ answers = {}, userNotes = "", combatState = {}, selectedCreatures = [] } = {}) {
  const notes = String(userNotes ?? "");
  const prompts = [];
  if (!answers.distance || answers.distance === "unknown") {
    prompts.push(prompt("distance", "Enemy distance or range band"));
  }
  if (!LINE_OF_SIGHT.test(notes)) {
    prompts.push(prompt("lineOfSight", "Line of sight or total cover"));
  }
  if (!TARGET_COUNT.test(notes) && ["multiple", "bigBadMinions"].includes(answers.situation)) {
    prompts.push(prompt("targetCount", "Approximate target count and clustering"));
  }
  if (answers.goal === "support" && !ALLY_STATUS.test(notes)) {
    prompts.push(prompt("allyStatus", "Which ally is hurt, down, or threatened"));
  }
  if (!COVER.test(notes) && dangerPressure(combatState, selectedCreatures)) {
    prompts.push(prompt("cover", "Reachable cover or safe retreat path"));
  }
  if (!answers.resources) {
    prompts.push(prompt("resourcePreference", "Whether to conserve limited resources"));
  }
  return {
    prompts: prompts.slice(0, 6),
    canSkip: true,
    policy: "Show conditional recommendations when these facts are missing; ask only when the answer would materially change ranking."
  };
}

export function quickClarificationPrompts(context = {}) {
  return (context.prompts ?? []).map((entry) => entry.question);
}

function prompt(id, question) {
  return {
    id,
    question,
    noteTemplate: `${question}: `
  };
}

function dangerPressure(combatState, selectedCreatures) {
  const hp = Number(combatState?.current?.hp ?? combatState?.hp?.current ?? 0);
  const max = Number(combatState?.hp?.max ?? 0);
  if (max && hp > 0 && hp / max <= 0.4) return true;
  return (selectedCreatures ?? []).length > 0;
}
