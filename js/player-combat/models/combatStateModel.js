export function createCombatState(character) {
  return {
    characterId: character.id,
    round: 1,
    turnActive: false,
    turn: {
      actionUsed: false,
      bonusActionUsed: false,
      reactionUsed: false,
      attackActionUsed: false,
      readiedAction: false,
      leveledSpellCast: false,
      leveledSpellName: null,
      movementUsed: 0,
      objectInteractionUsed: false
    },
    current: {
      hp: numberOr(character.combat?.currentHp, character.combat?.maxHp ?? 0),
      tempHp: numberOr(character.combat?.tempHp, 0),
      ac: numberOr(character.combat?.ac, 10),
      conditions: [...(character.combat?.conditions ?? [])],
      concentration: character.combat?.concentration ?? null,
      concentrationSource: null,
      activeEffects: [],
      currentForm: null
    },
    resourcesUsed: {
      spellSlots: {},
      classResources: {},
      itemCharges: {}
    },
    lastRoll: null,
    log: []
  };
}

export function resetTurn(turn = {}) {
  return {
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: turn.reactionUsed ?? false,
    attackActionUsed: false,
    readiedAction: turn.readiedAction ?? false,
    leveledSpellCast: false,
    leveledSpellName: null,
    movementUsed: 0,
    objectInteractionUsed: false
  };
}

export function addLogEntry(state, message, details = {}) {
  return {
    ...state,
    log: [
      {
        at: new Date().toISOString(),
        round: state.round,
        message,
        ...details
      },
      ...(state.log ?? [])
    ].slice(0, 40)
  };
}

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
