import { parseDiceFormula } from "../core/diceRoller.js";
import { escapeHtml } from "./renderUtils.js";

const DICE_ASSET_PATH = "./assets/dice";
const SUPPORTED_SIDES = new Set([4, 6, 8, 10, 12, 20]);

export function renderDicePreview(container, rollGroups) {
  if (!container) return;
  const dice = flattenDiceGroups(rollGroups, { useMaxValue: true });
  container.innerHTML = `
    <div class="dice-preview-grid" aria-label="Dice to roll">
      ${dice.map((die) => renderDieFace({ ...die, value: die.sides, pending: true })).join("")}
    </div>
  `;
}

export async function playAnimatedDiceRoll({ result, container }) {
  if (!result?.ok || !container) return;
  const dice = flattenDiceGroups(result.results);
  container.innerHTML = renderFinalDiceGroups(result.results, { settling: true });

  const targets = [...container.querySelectorAll("[data-dice-target]")];
  if (!dice.length || targets.length !== dice.length || prefersReducedMotion()) {
    revealSettledDice(container);
    return;
  }

  const layer = document.createElement("div");
  layer.className = "dice-animation-layer";
  document.body.append(layer);

  const actors = dice.map((die, index) => createActor(die, targets[index]));
  actors.forEach((actor) => layer.append(actor.node));

  await rollActors(actors);
  revealSettledDice(container);
  layer.remove();
}

export function buildPreviewGroups(rolls, extra = "") {
  return rolls.map((roll, index) => ({
    label: roll.label,
    formula: [roll.formula, index === 0 ? extra : ""].filter(Boolean).join("+")
  }));
}

function flattenDiceGroups(groups, { useMaxValue = false } = {}) {
  const dice = [];
  for (const group of groups ?? []) {
    let rollOffset = 0;
    for (const roll of group.rolls ?? diceTermsFromFormula(group.formula)) {
      for (let index = 0; index < Number(roll.count ?? 0); index += 1) {
        const sides = Number(roll.sides);
        dice.push({
          groupLabel: group.label,
          sides,
          value: useMaxValue ? sides : Math.abs(Number(roll.values?.[index] ?? sides)),
          sign: Number(roll.sign ?? 1),
          index: rollOffset + index
        });
      }
      rollOffset += Number(roll.count ?? 0);
    }
  }
  return dice.filter((die) => SUPPORTED_SIDES.has(die.sides));
}

function diceTermsFromFormula(formula) {
  return parseDiceFormula(formula)
    .filter((term) => term.kind === "dice")
    .map((term) => ({
      count: term.count,
      sides: term.sides,
      sign: term.sign,
      values: Array.from({ length: term.count }, () => term.sides)
    }));
}

function renderFinalDiceGroups(results, { settling = false } = {}) {
  return `
    <div class="dice-final-groups ${settling ? "is-settling" : "is-settled"}">
      ${results.map((entry) => `
        <section class="dice-final-group" aria-label="${escapeHtml(entry.label)} dice">
          <div class="dice-final-heading">
            <span>${escapeHtml(entry.label)}</span>
            <strong>${escapeHtml(entry.total)}</strong>
          </div>
          <div class="dice-final-row">
            ${flattenDiceGroups([entry]).map((die) => renderDieFace({ ...die, target: true })).join("")}
            ${entry.modifier ? `<span class="dice-modifier-pop" data-dice-modifier>${entry.modifier > 0 ? "+" : ""}${escapeHtml(entry.modifier)}</span>` : ""}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function renderDieFace({ sides, value, pending = false, target = false }) {
  const attrs = target ? "data-dice-target" : "";
  return `
    <span class="animated-die ${pending ? "is-pending" : ""}" ${attrs} style="--die-rotation:${randomBetween(-14, 14)}deg; --die-url:url('${DICE_ASSET_PATH}/dice-d${sides}.svg')">
      <span class="dice-shape" aria-hidden="true"></span>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `;
}

function createActor(die, target) {
  const rect = target.getBoundingClientRect();
  const size = Math.max(76, Math.min(96, (rect.width || 68) * 1.18));
  const node = document.createElement("span");
  node.className = "animated-die is-flying";
  node.style.width = `${size}px`;
  node.style.height = `${size}px`;
  node.style.setProperty("--die-url", `url('${DICE_ASSET_PATH}/dice-d${die.sides}.svg')`);
  node.innerHTML = `<span class="dice-shape" aria-hidden="true"></span><strong>${escapeHtml(die.value)}</strong>`;
  return {
    node,
    target,
    sides: die.sides,
    finalValue: die.value,
    x: rect.left,
    y: rect.top,
    vx: randomVelocity(),
    vy: randomVelocity(),
    spin: randomBetween(-10, 10),
    angle: randomBetween(0, 360),
    size
  };
}

function rollActors(actors) {
  const started = performance.now();
  const rollDuration = 1450;
  const settleDuration = 720;

  return new Promise((resolve) => {
    function frame(now) {
      const elapsed = now - started;
      if (elapsed < rollDuration) {
        updateRollingActors(actors, elapsed / rollDuration);
      } else if (elapsed < rollDuration + settleDuration) {
        updateSettlingActors(actors, (elapsed - rollDuration) / settleDuration);
      } else {
        actors.forEach((actor) => {
          const target = actor.target.getBoundingClientRect();
          setActorTransform(actor, target.left, target.top, actor.angle, actor.finalValue);
        });
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

function updateRollingActors(actors, progress) {
  const maxX = window.innerWidth;
  const maxY = window.innerHeight;
  actors.forEach((actor) => {
    const friction = 1 - progress * 0.018;
    actor.x += actor.vx;
    actor.y += actor.vy;
    actor.vx *= friction;
    actor.vy *= friction;
    actor.angle += actor.spin;

    if (actor.x <= 0 || actor.x + actor.size >= maxX) {
      actor.vx *= -1;
      actor.x = clamp(actor.x, 0, maxX - actor.size);
      rerollActor(actor);
    }
    if (actor.y <= 0 || actor.y + actor.size >= maxY) {
      actor.vy *= -1;
      actor.y = clamp(actor.y, 0, maxY - actor.size);
      rerollActor(actor);
    }
    setActorTransform(actor, actor.x, actor.y, actor.angle);
  });
}

function updateSettlingActors(actors, progress) {
  const eased = easeOutCubic(progress);
  actors.forEach((actor) => {
    const target = actor.target.getBoundingClientRect();
    const x = actor.x + (target.left - actor.x) * eased;
    const y = actor.y + (target.top - actor.y) * eased;
    const angle = actor.angle + (0 - actor.angle) * eased;
    setActorTransform(actor, x, y, angle, actor.finalValue);
  });
}

function rerollActor(actor) {
  actor.node.querySelector("strong").textContent = String(randomInt(1, actor.sides));
  actor.spin = randomBetween(-13, 13) || 8;
}

function setActorTransform(actor, x, y, angle, value = null) {
  if (value !== null) actor.node.querySelector("strong").textContent = String(value);
  actor.node.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg)`;
}

function revealSettledDice(container) {
  container.querySelector(".dice-final-groups")?.classList.replace("is-settling", "is-settled");
  container.querySelectorAll("[data-dice-modifier]").forEach((node) => node.classList.add("is-visible"));
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function randomVelocity() {
  const speed = randomBetween(7, 13);
  return Math.random() > 0.5 ? speed : -speed;
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}
