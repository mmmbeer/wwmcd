const TERM_PATTERN = /([+-]?\s*(?:\d*d\d+|\d+))/gi;

export function rollDice(formula, options = {}) {
  const normalized = normalizeFormula(formula);
  if (!normalized) {
    return { ok: false, error: "Enter a dice formula.", formula };
  }

  const terms = parseTerms(normalized);
  if (!terms.length) {
    return { ok: false, error: "Could not read that dice formula.", formula };
  }

  const rolls = [];
  let modifier = 0;
  let total = 0;

  for (const term of terms) {
    if (term.kind === "modifier") {
      modifier += term.value;
      total += term.value;
      continue;
    }

    const dice = [];
    for (let index = 0; index < term.count; index += 1) {
      const value = randomInt(1, term.sides);
      dice.push(value);
      total += value * term.sign;
    }
    rolls.push({ count: term.count, sides: term.sides, sign: term.sign, values: dice });
  }

  return {
    ok: true,
    formula: normalized,
    label: options.label ?? normalized,
    type: options.type ?? "roll",
    rolls,
    modifier,
    total
  };
}

export function rollAttack({ bonus = 0, label = "Attack", mode = "normal" } = {}) {
  const first = rollDice(`1d20${signed(bonus)}`, { label, type: "attack" });
  if (mode !== "advantage" && mode !== "disadvantage") return first;

  const second = rollDice(`1d20${signed(bonus)}`, { label, type: "attack" });
  const selected = mode === "advantage"
    ? (first.total >= second.total ? first : second)
    : (first.total <= second.total ? first : second);

  return {
    ...selected,
    mode,
    alternatives: [first, second]
  };
}

export function rollDamage({ formula, label = "Damage", critical = false } = {}) {
  const nextFormula = critical ? doubleDice(formula) : formula;
  return rollDice(nextFormula, { label, type: critical ? "criticalDamage" : "damage" });
}

function parseTerms(formula) {
  return [...formula.matchAll(TERM_PATTERN)].map((match) => parseTerm(match[1])).filter(Boolean);
}

function parseTerm(rawTerm) {
  const compact = rawTerm.replace(/\s+/g, "");
  const sign = compact.startsWith("-") ? -1 : 1;
  const body = compact.replace(/^[+-]/, "");
  const diceMatch = body.match(/^(\d*)d(\d+)$/i);

  if (diceMatch) {
    return {
      kind: "dice",
      sign,
      count: Number(diceMatch[1] || 1),
      sides: Number(diceMatch[2])
    };
  }

  const value = Number(body);
  return Number.isFinite(value) ? { kind: "modifier", value: value * sign } : null;
}

function normalizeFormula(formula) {
  return String(formula ?? "").trim().replace(/\s+/g, "");
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function signed(value) {
  const numeric = Number(value || 0);
  return numeric >= 0 ? `+${numeric}` : String(numeric);
}

function doubleDice(formula) {
  return normalizeFormula(formula).replace(/(\d*)d(\d+)/gi, (_, count, sides) => {
    return `${Number(count || 1) * 2}d${sides}`;
  });
}
