export const CLASS_TACTICS = {
  artificer: {
    priorities: [
      "Use prepared spells, infused items, and subclass tools to solve the most urgent tactical problem.",
      "Prefer repeatable item or cantrip value when spell slots are not needed.",
      "Protect allies with control, support, positioning, or defensive features when damage is not decisive."
    ],
    checks: [
      "Before recommending an infused item or subclass device, check that it appears in the provided options or character data.",
      "Before recommending a leveled spell, check available spell slots and concentration.",
      "Before recommending pet or turret tactics, check that the relevant subclass feature is present."
    ],
    resourceGuidance: [
      "Spend spell slots or limited subclass uses when they prevent serious harm, enable control, or secure an objective.",
      "Prefer cantrips, weapon attacks, or active item features for routine turns."
    ],
    avoid: [
      "Do not invent infusions, magic items, turrets, elixirs, or defender actions.",
      "Do not treat artificer spell slots like full-caster slots."
    ],
    reminderQuestions: [
      "Which infused items or subclass devices are active?",
      "Is the artificer already concentrating?",
      "Would a support or control option matter more than damage this turn?"
    ]
  },
  barbarian: {
    priorities: [
      "Prefer melee engagement against the most dangerous reachable enemy.",
      "Use Rage when the fight is dangerous, expected to last more than one round, or the barbarian is likely to take weapon damage.",
      "Use Reckless Attack when the damage gain is worth granting enemies advantage against the barbarian.",
      "Protect fragile allies by occupying space, threatening opportunity attacks, or drawing attacks."
    ],
    checks: [
      "Before recommending Rage, check whether Rage is available and whether the character is already raging.",
      "Before recommending Reckless Attack, consider current HP and how many enemies can attack the barbarian.",
      "Before recommending a ranged option, consider whether melee engagement is practical."
    ],
    resourceGuidance: [
      "Rage is usually worth spending in meaningful fights but not against trivial or nearly defeated enemies.",
      "Avoid spending limited subclass resources unless they materially improve survival, control, or damage."
    ],
    avoid: [
      "Do not recommend defensive stalling if the barbarian can safely engage and pressure a priority target.",
      "Do not recommend Reckless Attack automatically when the barbarian is badly wounded or surrounded."
    ],
    reminderQuestions: [
      "Is the enemy reachable in melee?",
      "How many enemies can attack the barbarian before their next turn?",
      "Is this fight important enough to justify Rage?"
    ]
  },
  bard: {
    priorities: [
      "Use control, debuffs, inspiration, and support to swing important rolls or deny enemy actions.",
      "Prefer concentration spells that create lasting team value when the fight is meaningful.",
      "Use Bardic Inspiration when an ally is likely to make an important attack, save, or check."
    ],
    checks: [
      "Before recommending Bardic Inspiration, check that uses remain and the bonus action is available.",
      "Before recommending a concentration spell, check existing concentration.",
      "Before recommending a control spell, check whether target type, range, and saving throw assumptions are uncertain."
    ],
    resourceGuidance: [
      "Spend Bardic Inspiration proactively in dangerous fights or when an ally's next roll matters.",
      "Conserve spell slots if a cantrip, weapon attack, or inspiration creates comparable value."
    ],
    avoid: [
      "Do not recommend minor damage when a control or support option would likely change the fight more.",
      "Do not replace strong concentration casually."
    ],
    reminderQuestions: [
      "Which ally is about to make an important roll?",
      "Is the bard already concentrating?",
      "Are enemies clustered for control or area effects?"
    ]
  },
  cleric: {
    priorities: [
      "Preserve allies who are down, near down, or exposed to lethal pressure.",
      "Use concentration buffs, control, or spirit-based effects when they will last long enough to matter.",
      "Choose between damage, healing, and support based on urgency rather than defaulting to healing."
    ],
    checks: [
      "Before recommending healing, check whether an ally is down or likely to drop before their next turn.",
      "Before recommending Channel Divinity, check availability and domain-specific options in provided data.",
      "Before recommending a concentration spell, check existing concentration."
    ],
    resourceGuidance: [
      "Spend spell slots to prevent a downed ally from losing turns or to establish major control in serious fights.",
      "Avoid inefficient healing when preventing damage or ending the threat is stronger."
    ],
    avoid: [
      "Do not assume healing is always the best cleric action.",
      "Do not invent domain features or Channel Divinity uses."
    ],
    reminderQuestions: [
      "Is any ally down or likely to drop soon?",
      "Is the cleric already concentrating?",
      "Are undead or clustered enemies relevant?"
    ]
  },
  druid: {
    priorities: [
      "Use concentration control, terrain, summons, or area effects to shape the battlefield.",
      "Use Wild Shape when it provides meaningful mobility, durability, scouting, or combat value.",
      "Prefer sustainable control or support over low-impact direct damage when positioning allows."
    ],
    checks: [
      "Before recommending Wild Shape, check uses, form availability, and whether the subclass supports combat use.",
      "Before recommending a concentration spell, check existing concentration.",
      "Before recommending area control, check whether allies would be hindered."
    ],
    resourceGuidance: [
      "Spend Wild Shape or spell slots when the effect changes positioning, survival, or enemy action choices.",
      "Conserve limited resources when a cantrip or existing concentration effect is already useful."
    ],
    avoid: [
      "Do not assume a combat beast form is available without character data.",
      "Do not stack new concentration over a valuable active control spell without warning."
    ],
    reminderQuestions: [
      "Which Wild Shape forms are available?",
      "Is the druid already concentrating?",
      "Will terrain or area control block allies?"
    ]
  },
  fighter: {
    priorities: [
      "Apply reliable weapon pressure to the highest-value reachable target.",
      "Use Action Surge when an extra action can remove a major threat or secure a decisive objective.",
      "Use Second Wind when survival risk is meaningful and the bonus action is not more valuable elsewhere.",
      "Exploit Extra Attack by choosing targets and attack riders deliberately."
    ],
    checks: [
      "Before recommending Action Surge, check that it is available and the extra action has high value.",
      "Before recommending Second Wind, check current HP and incoming threat.",
      "Before recommending multiple attacks, check the available attack count and legal targets."
    ],
    resourceGuidance: [
      "Action Surge is worth spending in decisive rounds, not for routine overkill.",
      "Conserve limited subclass resources unless they increase hit chance, control, defense, or burst at a key moment."
    ],
    avoid: [
      "Do not recommend Action Surge for a trivial gain.",
      "Do not ignore defensive options when the fighter is holding a dangerous position at low HP."
    ],
    reminderQuestions: [
      "Can Action Surge finish or disable a priority target?",
      "How many attacks are available this turn?",
      "Is the fighter likely to take heavy damage before acting again?"
    ]
  },
  monk: {
    priorities: [
      "Use mobility to reach vulnerable targets, escape bad positions, or control enemy movement.",
      "Prefer Attack plus Martial Arts or Flurry-style follow-ups when melee pressure is safe and valuable.",
      "Use Stunning Strike or similar control only when the target is important enough to justify the resource."
    ],
    checks: [
      "Before recommending Ki or Focus options, check remaining uses and prerequisite attacks.",
      "Before recommending melee engagement, check current HP and escape options.",
      "Before recommending Stunning Strike, check that a qualifying hit or attack option is plausible."
    ],
    resourceGuidance: [
      "Spend Ki or Focus on decisive control, survival, or finishing pressure.",
      "Conserve resources when a normal attack and movement plan accomplishes the goal."
    ],
    avoid: [
      "Do not recommend staying surrounded if mobility can reduce incoming attacks.",
      "Do not treat hit-triggered abilities as guaranteed before a hit occurs."
    ],
    reminderQuestions: [
      "How many Ki or Focus points remain?",
      "Can the monk safely leave after attacking?",
      "Is the target important enough for a control attempt?"
    ]
  },
  paladin: {
    priorities: [
      "Pressure high-value enemies in melee while protecting nearby allies.",
      "Use Divine Smite or similar burst only when a hit lands and the target merits the slot.",
      "Balance spell slots between burst damage, emergency support, and concentration buffs."
    ],
    checks: [
      "Before recommending Divine Smite, check that a qualifying melee weapon hit is part of the plan and slots remain.",
      "Before recommending a smite spell or buff, check concentration and bonus action availability.",
      "Before recommending healing, check whether Lay on Hands or spell healing is actually available."
    ],
    resourceGuidance: [
      "Spend smite resources on dangerous targets, critical hits, fiends, undead, or decisive finishing blows.",
      "Avoid spending slots on minor damage when the fight is already controlled."
    ],
    avoid: [
      "Do not recommend Divine Smite as a standalone action.",
      "Do not burn spell slots before confirming the attack hits unless the option is a separate legal spell."
    ],
    reminderQuestions: [
      "Did a melee weapon attack hit?",
      "How many spell slots remain?",
      "Is the target dangerous enough to justify burst damage?"
    ]
  },
  ranger: {
    priorities: [
      "Use positioning, range, and target focus to apply steady pressure.",
      "Prefer concentration damage or control spells when they will persist across multiple rounds.",
      "Use mobility and terrain to avoid unnecessary melee exposure unless built for it."
    ],
    checks: [
      "Before recommending a concentration mark or control spell, check existing concentration.",
      "Before recommending ranged attacks, check line of sight, range, and disadvantage risks.",
      "Before recommending companion tactics, check that companion options are present."
    ],
    resourceGuidance: [
      "Spend spell slots when the effect will last or solve a positioning problem.",
      "Prefer weapon attacks when a spell slot would add only minor immediate value."
    ],
    avoid: [
      "Do not recommend a new concentration rider without warning about the current one.",
      "Do not invent favored enemy, terrain, or companion benefits."
    ],
    reminderQuestions: [
      "Is the ranger already concentrating?",
      "Is the target within weapon range and line of sight?",
      "Will the chosen target survive long enough for a mark or ongoing spell to matter?"
    ]
  },
  rogue: {
    priorities: [
      "Prioritize qualifying for Sneak Attack once per turn.",
      "Prefer attacks with advantage or attacks against enemies engaged by an ally.",
      "Use Cunning Action to Hide, Disengage, or Dash when it improves safety or enables Sneak Attack.",
      "Favor positioning that allows offense without remaining exposed."
    ],
    checks: [
      "Before recommending Sneak Attack, check whether the rogue has advantage or another qualifying condition.",
      "Before recommending Hide, check whether cover, concealment, darkness, or another hiding opportunity exists.",
      "Before recommending two-weapon fighting, check whether the bonus action is not better used for Cunning Action."
    ],
    resourceGuidance: [
      "Conserve limited subclass resources unless they secure Sneak Attack, prevent serious harm, or help achieve the stated objective."
    ],
    avoid: [
      "Do not recommend a low-value attack if a different target or position would enable Sneak Attack.",
      "Do not recommend staying in melee unless there is a tactical reason to do so.",
      "Do not assume the rogue can hide without a plausible hiding condition."
    ],
    reminderQuestions: [
      "Does the rogue have advantage?",
      "Is an ally within 5 feet of the target?",
      "Is there cover, concealment, darkness, or another hiding opportunity?",
      "Has Sneak Attack already been used this turn?"
    ]
  },
  sorcerer: {
    priorities: [
      "Use flexible spellcasting and metamagic to create high-impact burst, control, or protection.",
      "Prefer cantrips when preserving slots and sorcery points is more important than immediate impact.",
      "Use mobility or defensive spells to protect concentration and low hit points."
    ],
    checks: [
      "Before recommending metamagic, check that the specific option and sorcery points are present.",
      "Before recommending a leveled spell, check slots, action economy, and concentration.",
      "Before recommending area damage, check ally positions if unknown."
    ],
    resourceGuidance: [
      "Spend sorcery points when metamagic meaningfully changes target count, timing, safety, or reliability.",
      "Avoid converting or spending resources for marginal damage."
    ],
    avoid: [
      "Do not invent metamagic options.",
      "Do not recommend fragile positioning for a concentration caster without a defensive reason."
    ],
    reminderQuestions: [
      "Which metamagic options are known?",
      "How many sorcery points remain?",
      "Are allies inside the area of effect?"
    ]
  },
  warlock: {
    priorities: [
      "Prefer efficient use of Eldritch Blast or other reliable cantrips when conserving spell slots.",
      "Spend Pact Magic slots only when the spell meaningfully changes the fight.",
      "Consider concentration carefully because many strong warlock spells compete for it.",
      "Use invocations, pact features, and battlefield positioning to create repeatable value."
    ],
    checks: [
      "Before recommending a leveled spell, check available Pact Magic slots.",
      "Before recommending a concentration spell, check whether the warlock is already concentrating.",
      "Before recommending Eldritch Blast riders, check whether the relevant invocations are present.",
      "Before recommending melee pact tactics, check whether the warlock is built and positioned for melee."
    ],
    resourceGuidance: [
      "Pact Magic slots are limited but return on a short rest, so spending one is reasonable when it creates control, burst damage, escape, or a decisive advantage.",
      "Avoid spending a slot for minor damage if a cantrip would be nearly as useful."
    ],
    avoid: [
      "Do not recommend replacing a strong concentration effect without warning.",
      "Do not recommend melee engagement unless the character has features, equipment, or positioning that support it.",
      "Do not treat warlock spell slots like ordinary full-caster slots."
    ],
    reminderQuestions: [
      "How many Pact Magic slots remain?",
      "Is the warlock already concentrating?",
      "Which Eldritch Blast invocations are active?",
      "Is a short rest likely after this fight?"
    ]
  },
  wizard: {
    priorities: [
      "Use control, area effects, utility, and defensive reactions to change enemy choices and protect concentration.",
      "Prefer high-impact leveled spells when they affect multiple enemies or prevent dangerous actions.",
      "Use cantrips, positioning, or defensive options when conserving slots is the better plan."
    ],
    checks: [
      "Before recommending a prepared spell, check that it is available and that a slot remains.",
      "Before recommending a concentration spell, check current concentration.",
      "Before recommending area effects, check whether ally positions or target clustering are unknown."
    ],
    resourceGuidance: [
      "Spend higher-level slots when the spell can swing the encounter, not for routine single-target damage unless decisive.",
      "Conserve defensive reactions when the wizard is exposed or concentrating."
    ],
    avoid: [
      "Do not recommend standing exposed after casting if movement or defense can improve safety.",
      "Do not invent prepared spells or assume every spell in a spellbook is prepared."
    ],
    reminderQuestions: [
      "Which spells are prepared?",
      "Is the wizard already concentrating?",
      "Are enemies clustered without allies in the area?"
    ]
  }
};
