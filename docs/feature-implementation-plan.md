# Feature Implementation Plan

## Audit Summary

Audited `data/feats.json`, `data/races.json`, and `data/classes.json` against the current player combat assistant rules modules.

Current implemented coverage:

- Direct feature action parsing in `js/player-combat/data/featureActionParser.js` finds 52 source-data features with action, bonus action, or reaction text.
- `js/player-combat/rules/featureActions.js` turns parsed direct feature actions into action cards when the imported character has the feature.
- `js/player-combat/rules/attackCountRules.js` implements Extra Attack counts for weapon, unarmed, grapple, and shove options.
- `js/player-combat/rules/monkActions.js` implements Martial Arts and Flurry of Blows with Attack-action prerequisites and Ki/Focus spending.
- `js/player-combat/rules/highImpactFeatureActions.js` implements dedicated cards for Action Surge, Wild Shape, Divine Smite, Patient Defense, Step of the Wind, Polearm Master, Shield Master, Great Weapon Master, and Telekinetic.
- `js/player-combat/rules/movementRules.js` applies common speed modifiers from Fast Movement, Unarmored Movement, Mobile, Squat Nimbleness, and Fleet of Foot.
- Spell actions are handled from imported character spell data rather than from class Spellcasting feature text.

Known coverage limitation:

- The generic feature parser creates reminder/action-economy cards only. It does not apply conditional attack modifiers, speed modifiers, spellcasting transformations, resource spend choices, critical-hit riders, initiative recovery, or reaction trigger rules unless a dedicated rule module handles them.
- The class feature parser currently walks `Class Features` only. Source-data sections stored beside that key, such as Fighter `Martial Archetypes`, Monk `Monastic Traditions`, Paladin `Sacred Oaths`, Ranger `Ranger Archetypes`, Rogue `Roguish Archetypes`, Sorcerer `Sorcerous Origins`, Warlock `Eldritch Invocations` and `Otherworldly Patrons`, and Wizard `Arcane Traditions`, are not indexed as feature actions today.

## Missing or Partial Class Features

| Feature | Source | Description | Implementation plan |
| --- | --- | --- | --- |
| Reckless Attack | Barbarian | Before the first attack on your turn, choose advantage on Strength melee weapon attacks, with attacks against you gaining advantage until your next turn. | Add an attack modifier toggle in a barbarian feature rule. Apply advantage metadata to eligible melee weapon attacks and log the defensive drawback as an active turn state. |
| Fast Movement | Barbarian | Speed increases by 10 feet while not wearing heavy armor. | Implemented: movement rules add the speed bonus when heavy armor is not equipped. |
| Feral Instinct | Barbarian | Advantage on initiative and can act while surprised if rage is entered first. | Add initiative/reminder support and a first-turn surprised-state rule that surfaces Rage as the required first action while surprised. |
| Brutal Critical | Barbarian | Adds extra weapon damage dice on melee critical hits, scaling by level. | Add critical-hit damage metadata to melee weapon options and include the extra dice in critical roll output. |
| Frenzy | Barbarian, Path of the Berserker | While frenzied, make one melee weapon attack as a bonus action on turns after rage starts. | Replace the generic parsed card with a stateful Rage/Frenzy rule: require active rage and not the rage-start turn, then render a bonus melee attack option. |
| Retaliation | Barbarian, Path of the Berserker | Reaction melee weapon attack when a nearby creature damages you. | Add a triggered reaction attack option with melee weapon rolls and reaction consumption. |
| Bardic Inspiration | Bard | Bonus action grants an inspiration die to another creature. | Add resource-aware Bardic Inspiration action with die scaling and uses tied to imported class resources. |
| Superior Inspiration | Bard | Regain one Bardic Inspiration on initiative if none remain. | Add initiative resource recovery rule and combat-start prompt/log entry. |
| Cutting Words | Bard, College of Lore | Reaction spends Bardic Inspiration to reduce a creature's attack roll, ability check, or damage roll. | Add resource-aware reaction option using Bardic Inspiration die and trigger metadata. |
| Blessed Healer | Cleric, Life Domain | Healing spells cast on others also heal you. | Add a spell rider rule for healing spells that displays self-heal amount on eligible spell cards. |
| Divine Strike | Cleric, Life Domain | Once per turn, add radiant damage to a weapon hit. | Add once-per-turn damage rider to weapon attacks with scaling at 14th level. |
| Wild Shape | Druid | Action to assume beast form, with uses recovered on rest. | Partially implemented: dedicated resource-aware action sets current form. Beast form selection remains future work. |
| Combat Wild Shape / Beast Shapes bonus action | Druid, Circle of the Moon | Moon druids can Wild Shape as a bonus action and spend spell slots to heal while shaped. | Partially implemented: Moon druids use Wild Shape as a bonus action. Spell-slot healing remains future work. |
| Beast Spells | Druid | Can cast many druid spells while in Wild Shape. | Add Wild Shape spellcasting gate so spells are hidden while shaped until this feature is present. |
| Land's Stride | Druid, Circle of the Land | Nonmagical difficult terrain and plants do not cost extra movement. | Add movement-terrain rule notes and optional difficult-terrain movement calculation. |
| Action Surge | Fighter | Gain one additional action on your turn once per rest. | Implemented: dedicated resource-aware option clears action use and marks Action Surge used. |
| Improved Critical / Superior Critical | Fighter, Champion | Weapon attacks score critical hits on 19-20, then 18-20. | Add attack critical range metadata to weapon and unarmed attack cards. |
| Protection | Fighter/Paladin Fighting Style | Reaction imposes disadvantage on an attack against a nearby ally while using a shield. | Add equipment prerequisite check for shield and show unavailable reason when not met. |
| Second Wind | Fighter | Bonus action heals 1d10 + fighter level once per rest. | Add resource-aware healing roll and rest recovery. |
| Survivor | Fighter, Champion | Regain hit points at the start of each turn while below half HP. | Add start-turn healing prompt/rule with HP threshold check. |
| Patient Defense | Monk | Spend 1 Ki to Dodge as a bonus action. | Implemented: dedicated Ki/Focus bonus action. |
| Step of the Wind | Monk | Spend 1 Ki to Dash or Disengage as a bonus action; jump distance doubles. | Implemented: dedicated Ki/Focus Dash and Disengage bonus actions. |
| Deflect Missiles | Monk | Reaction reduces ranged weapon damage; if reduced to 0, may spend Ki to make a ranged attack. | Add reaction reduction roll and optional Ki spend attack follow-up. |
| Slow Fall | Monk | Reaction reduces falling damage by five times monk level. | Add reaction card with calculated reduction amount. |
| Stunning Strike | Monk | Spend 1 Ki after a melee weapon hit to force a Con save or stun. | Add on-hit rider on melee weapon/unarmed attacks with Ki/Focus cost and save DC. |
| Unarmored Movement | Monk | Speed increases while unarmored and later allows special movement. | Partially implemented: walking speed bonus is applied while unarmored/unshielded. Special movement remains future work. |
| Open Hand Technique | Monk, Way of the Open Hand | Flurry of Blows hits can knock prone, push, or block reactions. | Add Flurry-specific rider choices when the subclass feature is present. |
| Wholeness of Body | Monk, Way of the Open Hand | Action heals three times monk level once per long rest. | Add resource-aware healing action. |
| Quivering Palm | Monk, Way of the Open Hand | Spend 3 Ki on unarmed hit to set vibrations, then use an action later to trigger damage or death save. | Add on-hit setup rider, active target state, and follow-up action card. |
| Perfect Self | Monk | Regain Ki on initiative if none remain. | Add initiative resource recovery rule. |
| Divine Smite | Paladin | Spend spell slot on melee weapon hit for radiant damage. | Partially implemented: resource-aware on-hit smite card uses the lowest available slot and rolls radiant damage. Direct weapon-card rider remains future work. |
| Cleansing Touch | Paladin | Action ends one spell on self or willing creature, limited by Charisma modifier. | Replace generic card with resource-aware limited-use action. |
| Sacred Weapon / Turn the Unholy | Paladin, Oath of Devotion | Channel Divinity action adds Charisma to weapon attacks or turns fiends/undead. | Expand subclass parser coverage and add resource-aware Channel Divinity options. |
| Holy Nimbus | Paladin, Oath of Devotion | Action creates damaging sunlight aura for 1 minute. | Add long-rest limited action and active aura reminder. |
| Primeval Awareness | Ranger | Action spends a ranger spell slot to sense creature types. | Add spell-slot-aware feature action and unavailable reason when no ranger slot is available. |
| Land's Stride | Ranger | Nonmagical difficult terrain and plants do not cost extra movement. | Share the druid Land's Stride movement-terrain rule. |
| Hunter's Prey | Ranger, Hunter | Colossus Slayer, Giant Killer, or Horde Breaker add weapon damage or attacks. | Add selected-option support and attack riders/reaction attack options. |
| Defensive Tactics | Ranger, Hunter | Escape the Horde, Multiattack Defense, or Steel Will alter opportunity attacks, AC, or fear saves. | Add selected-option defensive reminders and reaction/AC metadata. |
| Multiattack | Ranger, Hunter | Volley or Whirlwind Attack creates special multi-target action attacks. | Add special action attack cards that use equipped weapon rolls. |
| Superior Hunter's Defense | Ranger, Hunter | Evasion, Stand Against the Tide, or Uncanny Dodge alters saves/reactions. | Add selected-option reaction and save rider support. |
| Vanish | Ranger | Hide as a bonus action. | Keep parsed bonus option, but add a dedicated Hide option so it is grouped and labelled consistently with Cunning Action. |
| Sneak Attack | Rogue | Once per turn, add scaling damage to an eligible finesse/ranged weapon hit. | Add eligibility checks and once-per-turn damage rider to weapon attacks. |
| Uncanny Dodge | Rogue | Reaction halves damage from a visible attacker's hit. | Add trigger-specific reaction card with damage-halving metadata. |
| Evasion | Monk/Rogue | Dexterity save effects deal no damage on success and half on failure. | Add saving-throw reminder/rider support for area-effect damage; this affects combat resolution rather than action availability. |
| Fast Hands | Rogue, Thief | Cunning Action can also use Sleight of Hand, thieves' tools, or Use an Object. | Extend Cunning Action granted actions when Thief feature is present. |
| Second-Story Work | Rogue, Thief | Climbing no longer costs extra movement and running jumps improve. | Add movement modifier/reminder metadata. |
| Supreme Sneak | Rogue, Thief | Advantage on Stealth if moving no more than half speed. | Add Hide/Stealth roll modifier tied to movement used this turn. |
| Thief's Reflexes | Rogue, Thief | Take two turns in the first combat round. | Add first-round extra-turn state and initiative tracker support. |
| Flexible Casting | Sorcerer | Bonus action converts spell slots and sorcery points. | Replace generic card with two resource conversion actions that update spell slots and sorcery points. |
| Metamagic options | Sorcerer | Careful, Distant, Empowered, Extended, Heightened, Quickened, Subtle, and Twinned Spell modify spell casting. | Add a metamagic rule layer for spell cards. Show eligible metamagic controls, sorcery point costs, and transformed casting time/range/targets/damage metadata. |
| Elemental Affinity | Sorcerer, Draconic Bloodline | Add Charisma modifier to matching spell damage and optionally spend a sorcery point for resistance. | Add ancestry damage-type mapping, spell damage rider, and resistance spend control. |
| Dragon Wings | Sorcerer, Draconic Bloodline | Bonus action creates or dismisses wings and grants flying speed. | Add bonus action state toggle and fly speed movement mode. |
| Draconic Presence | Sorcerer, Draconic Bloodline | Action spends 5 sorcery points to create frighten/charm aura. | Add resource-aware action with aura state and save DC. |
| Pact of the Chain | Warlock | Forgo one of your own attacks to let familiar attack with its reaction. | Add an Attack-action replacement option when the feature is present and the character has a familiar state. |
| Pact of the Blade | Warlock | Action creates pact weapon. | Keep parsed action, then add pact weapon state so the created weapon can appear in weapon attacks. |
| Mystic Arcanum | Warlock | Cast arcanum spell once without a spell slot. | Add arcanum spell resource tracking when imported spell data marks these spells or when feature metadata can identify them. |
| Eldritch Invocations | Warlock | Invocations grant at-will spells, limited-use spells, Eldritch Blast riders, special invisibility actions, and pact weapon Extra Attack. | Expand parser coverage to `Eldritch Invocations`; add spell-grant, at-will cast, invocation resource, Eldritch Blast modifier, and Thirsting Blade attack-count rules. |
| Dark One's Blessing / Dark One's Own Luck | Warlock, The Fiend | Gain temporary HP on reducing a hostile creature to 0 HP; add d10 to ability check or save once per rest. | Add kill-trigger temp HP prompt and limited-use roll modifier. |
| Arcane Recovery | Wizard | Recover spell slots on short rest once per day. | Add short-rest recovery dialog for wizard slot recovery. |
| Spell Mastery | Wizard | Cast selected 1st- and 2nd-level wizard spells at will. | Add at-will spell override metadata for selected mastered spells. |
| Signature Spells | Wizard | Cast selected 3rd-level spells once per rest without expending a slot. | Add per-spell limited-use tracking and spell-slot bypass for selected signature spells. |
| Sculpt Spells | Wizard, School of Evocation | Protect allies inside evocation spell areas. | Add evocation spell rider showing protected creature count. |
| Potent Cantrip | Wizard, School of Evocation | Damaging cantrips deal half damage on successful saves. | Add save-based cantrip damage metadata. |
| Empowered Evocation | Wizard, School of Evocation | Add Intelligence modifier to one evocation spell damage roll. | Add spell damage rider for wizard evocation spells. |
| Overchannel | Wizard, School of Evocation | Maximize damage for 1st-5th level wizard spells, with later self-damage. | Add spell damage mode with use tracking and self-damage warning. |

## Missing or Partial Feats

| Feature | Description | Implementation plan |
| --- | --- | --- |
| Alert | +5 initiative, cannot be surprised, hidden attackers do not gain advantage. | Add initiative bonus/rules metadata and surprise immunity reminder in combat start state. |
| Artificer Initiate | Grants one cantrip and one 1st-level artificer spell cast without a slot. | Add feat-granted spell import fallback and once-per-rest cast tracking if imported character data does not already include the spells. |
| Charger | As part of Dash, make a melee attack with bonus damage after moving 10 feet. | Add a Dash-linked attack option requiring movement this turn; the current parser detects granted actions but creates no card because there is no explicit feature cost. |
| Crusher | Move a target after bludgeoning hit; critical hits grant advantage against the target. | Add bludgeoning weapon hit rider and critical-hit rider state. |
| Defensive Duelist | Reaction adds proficiency bonus to AC against a melee attack while wielding a finesse weapon. | Add finesse weapon prerequisite and calculated AC bonus to the existing reaction card. |
| Dragon Hide | Grants retractable claws as unarmed/natural weapons. | Add natural weapon attack option when the feat is present. |
| Drow High Magic | Grants at-will and limited-use spells. | Add feat-granted spell fallback and limited-use tracking. |
| Dwarf Fortitude | Spend a Hit Die when taking Dodge. | Add a Dodge-linked healing action; the current parser detects Dodge but creates no card because there is no explicit feature cost. |
| Fade Away | Reaction to become invisible after taking damage. | Add limited-use reaction state and invisibility condition/reminder. |
| Fey Teleportation | Grants Misty Step once per rest. | Add feat-granted spell fallback and limited-use tracking. |
| Flames of Phlegethos | Reroll 1s on fire spell damage and gain flame retaliation after casting fire spells. | Add fire spell damage reroll metadata and post-cast active aura state. |
| Fury of the Frost Giant | Reaction-style cold damage and speed reduction, limited by proficiency bonus. | Add triggered limited-use reaction once source text trigger is normalized. |
| Gift of the Chromatic Dragon | Bonus action weapon infusion and reaction resistance. | Add weapon damage rider state, reaction resistance card, and proficiency-bonus use tracking. |
| Gift of the Gem Dragon | Reaction damage and push after taking damage. | Add triggered limited-use reaction with save DC and damage roll. |
| Gift of the Metallic Dragon | Cure Wounds cast and reaction AC bonus. | Add feat-granted spell fallback and resource-aware protective reaction. |
| Great Weapon Master | Bonus attack after critical hit or reducing a creature to 0 HP; optional -5/+10 heavy weapon attack mode. | Add heavy weapon attack toggle and conditional bonus attack state. |
| Mage Slayer | Reaction melee attack against nearby spellcaster and defensive spell-save reminders. | Add trigger-specific reaction attack with melee weapon rolls. |
| Mobile | Speed increase, better Dash through difficult terrain, and no opportunity attacks from attacked targets. | Partially implemented: speed modifier is applied. Dash terrain and opportunity attack target state remain future work. |
| Orcish Fury | Add weapon die damage and reaction attack after Relentless Endurance. | Add limited-use weapon damage rider and Half-Orc feature dependency for reaction trigger. |
| Piercer | Reroll piercing damage die and add die on critical hits. | Add piercing weapon damage controls and critical-hit metadata. |
| Poisoner | Apply poison as a bonus action and ignore poison resistance. | Add poison application state and attach poison damage/save metadata to weapon attacks. |
| Polearm Master | Bonus haft attack and opportunity attack when creatures enter reach. | Partially implemented: qualifying polearms add a bonus haft attack with rolls. Expanded opportunity attack trigger remains future work. |
| Rune Shaper | Grants rune spells and limited free casts. | Add feat-granted spell fallback and long-rest resource tracking. |
| Savage Attacker | Reroll melee weapon damage once per turn. | Add once-per-turn melee damage reroll control. |
| Sentinel | Opportunity attacks stop movement, ignore Disengage, and reaction attack when nearby ally is attacked. | Add opportunity attack trigger metadata and ally-attack reaction card. |
| Shield Master | Bonus action shove after Attack, shield bonus to Dex saves, and no-damage save rider. | Partially implemented: shield and Attack-action-gated bonus shove card. Saving throw automation remains future work. |
| Skulker | Hide while lightly obscured and ranged misses do not reveal position. | Add Hide availability modifier and ranged attack miss reminder. |
| Slasher | Reduce target speed on slashing hit and impose attack disadvantage on critical hit. | Add slashing weapon hit and critical-hit riders. |
| Soul of the Storm Giant | Limited-use storm aura/reaction-style defensive effect. | Add triggered limited-use reaction once source text trigger is normalized. |
| Squat Nimbleness | Speed increase and advantage to escape grapples. | Partially implemented: speed modifier is applied. Grapple-escape advantage remains future work. |
| Strike of the Giants | Limited-use weapon hit rider based on selected giant option. | Add feat option selection, per-option damage/effect rider, and proficiency-bonus use tracking. |
| Tavern Brawler | Improvised weapon proficiency, d4 unarmed strike, and bonus action grapple after hit. | Add unarmed damage override and hit-triggered bonus grapple prerequisite. |
| Telekinetic | Bonus action shove one creature. | Implemented: bonus action shove card with calculated save DC. |
| Telepathic | Grants Detect Thoughts once per rest. | Add feat-granted spell fallback and limited-use tracking. |
| War Caster | Cast a spell instead of an opportunity attack and advantage on concentration saves. | Add opportunity-spell reaction selector and concentration save advantage metadata. |
| Wood Elf Magic | Grants druid cantrip, Longstrider, and Pass without Trace. | Add feat-granted spell fallback and limited-use tracking. |

## Missing or Partial Race Features

| Feature | Source | Description | Implementation plan |
| --- | --- | --- | --- |
| Speed | Dwarf, Elf, Halfling, Human, Dragonborn, Gnome, Half-Elf, Half-Orc, Tiefling | Base walking speed differs by race; dwarf speed is not reduced by heavy armor. | Add race feature fallback speed calculation when imported character data lacks normalized speed, including dwarf heavy-armor exception. |
| Fleet of Foot | Wood Elf | Walking speed increases to 35 feet. | Add race speed modifier fallback. |
| Mask of the Wild | Wood Elf | Can hide while lightly obscured by natural phenomena. | Add Hide availability modifier/reminder. |
| Halfling Nimbleness | Halfling | Can move through spaces of larger creatures. | Add movement reminder metadata. |
| Naturally Stealthy | Lightfoot Halfling | Can hide when obscured by larger creatures. | Add Hide availability modifier/reminder. |
| Breath Weapon | Dragonborn | Action exhale with save DC and damage based on ancestry. | Replace generic parsed card with ancestry-aware area, damage, save DC, and rest resource tracking. |
| Savage Attacks | Half-Orc | Add one weapon damage die on melee critical hit. | Add race critical-hit damage rider. |
| Relentless Endurance | Half-Orc | Drop to 1 HP instead of 0 once per long rest. | Add damage/HP trigger and long-rest resource tracking; needed by Orcish Fury reaction. |
| Infernal Legacy | Tiefling | Grants Thaumaturgy, Hellish Rebuke, and Darkness with limited casts. | Add race-granted spell fallback and limited-use tracking. |

## Supporting Work

1. Add a feature rule registry, for example `js/player-combat/rules/classFeatureRules.js`, `raceFeatureRules.js`, and `featRules.js`, that can augment action options after base weapon/spell/basic options are built.
2. Add shared helpers for feature resources: proficiency-bonus uses, ability-modifier uses, rest recovery, and spell-slot spends.
3. Add combat state fields for conditional turn state: active rage, active wild shape, action surge available/used, once-per-turn riders used, last attack hit/critical, and combat-start initiative recovery.
4. Extend action cards to support rider controls on attacks and spells without duplicating the base weapon/spell cards.
5. Add focused tests for each feature group: speed modifiers, bonus attack prerequisites, reaction triggers, spell metamagic, on-hit damage riders, and limited-use recovery.

## Manual Test Scenarios

1. Import or construct a Fighter with Action Surge and Extra Attack; verify weapon cards show the correct attack count and Action Surge grants an extra action rather than consuming a bonus action.
2. Import or construct a Monk with Ki, Patient Defense, Step of the Wind, Deflect Missiles, and Stunning Strike; verify all Ki options show costs and become unavailable when Ki is spent.
3. Import or construct a Paladin with Divine Smite; verify melee weapon hits expose spell-slot smite damage without changing ranged attacks.
4. Import or construct a Sorcerer with Quickened Spell and other metamagic; verify eligible spell cards show sorcery point costs and transformed action economy.
5. Import or construct a character with Polearm Master, Great Weapon Master, Shield Master, and Sentinel; verify bonus/reaction attack prerequisites and unavailable reasons.
6. Import or construct Wood Elf, Lightfoot Halfling, Dragonborn, Half-Orc, and Tiefling characters; verify race-specific hide, breath weapon, critical damage, endurance, and spell options.
