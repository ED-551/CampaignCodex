import { useState, useCallback } from 'react'

// ─── Canonical Data ────────────────────────────────────────────────────────────

const NIMBLE_WEAPONS = [
  { name: 'Dagger',           category: 'Melee',  damage: '1d4+DEX',  type: 'Piercing',         properties: 'Light, Thrown 4',                        cost: '3 gp'   },
  { name: 'Sickle',           category: 'Melee',  damage: '1d4+DEX',  type: 'Slashing',          properties: 'Vicious',                                cost: '10 gp'  },
  { name: 'Club/Mace',        category: 'Melee',  damage: '1d6+STR',  type: 'Bludgeoning',       properties: '',                                       cost: '5 gp'   },
  { name: 'Hand Axe',         category: 'Melee',  damage: '1d6+STR',  type: 'Slashing',          properties: 'Thrown 4',                               cost: '8 gp'   },
  { name: 'Short Sword',      category: 'Melee',  damage: '1d6+DEX',  type: 'Piercing',          properties: 'Light',                                  cost: '10 gp'  },
  { name: 'Rapier',           category: 'Melee',  damage: '2d4+DEX',  type: 'Piercing',          properties: '',                                       cost: '60 gp'  },
  { name: 'Staff',            category: 'Melee',  damage: '1d8+STR',  type: 'Bludgeoning',       properties: '2-handed',                               cost: '8 gp'   },
  { name: 'Longsword',        category: 'Melee',  damage: '1d8+STR',  type: 'Slashing',          properties: '2-handed (1H: Req. 2 STR)',               cost: '60 gp'  },
  { name: 'Battleaxe',        category: 'Melee',  damage: '1d10+STR', type: 'Slashing',          properties: '2-handed',                               cost: '30 gp'  },
  { name: 'Pole Hammer',      category: 'Melee',  damage: '1d10+STR', type: 'Bludgeoning',       properties: '2-handed, Reach 2',                      cost: '60 gp'  },
  { name: 'Glaive',           category: 'Melee',  damage: '1d10+STR', type: 'Slashing',          properties: '2-handed, Reach 2',                      cost: '60 gp'  },
  { name: 'Spear',            category: 'Melee',  damage: '1d10+STR', type: 'Piercing',          properties: '2-handed, Reach 2',                      cost: '60 gp'  },
  { name: 'Greatmaul',        category: 'Melee',  damage: '1d12+STR', type: 'Bludgeoning',       properties: '2-handed (Req. 2 STR)',                   cost: '80 gp'  },
  { name: 'Greataxe',         category: 'Melee',  damage: '2d6+STR',  type: 'Slashing',          properties: '2-handed (Req. 2 STR)',                   cost: '100 gp' },
  { name: 'Greatsword',       category: 'Melee',  damage: '3d4+STR',  type: 'Slashing/Piercing', properties: '2-handed (Req. 2 STR)',                   cost: '120 gp' },
  { name: 'Sling',            category: 'Ranged', damage: '1d4+DEX',  type: 'Bludgeoning',       properties: '2-handed, Range 12, Vicious',             cost: '4 gp'   },
  { name: 'Javelins',         category: 'Ranged', damage: '1d6+STR',  type: 'Piercing',          properties: 'Range 8, Stack of 4',                    cost: '20 gp'  },
  { name: 'Throwing Hammers', category: 'Ranged', damage: '1d8+STR',  type: 'Bludgeoning',       properties: 'Range 4, Stack of 3',                    cost: '25 gp'  },
  { name: 'Shortbow',         category: 'Ranged', damage: '1d6+DEX',  type: 'Piercing',          properties: '2-handed, Range 12',                     cost: '25 gp'  },
  { name: 'Longbow',          category: 'Ranged', damage: '1d8+DEX',  type: 'Piercing',          properties: '2-handed, Range 16 (Req. 1 STR)',         cost: '30 gp'  },
  { name: 'Crossbow',         category: 'Ranged', damage: '4d4+DEX',  type: 'Piercing',          properties: '2-handed, Load: 1 action, Range 8',       cost: '60 gp'  },
  { name: 'Handheld Ballista',category: 'Ranged', damage: '1d20+DEX', type: 'Piercing',          properties: '2-handed, Load: 2 actions, Range 8 (Req. 2 STR)', cost: '120 gp' },
]

const NIMBLE_ARMOR = [
  { name: "Adventurer's Garb", type: 'Cloth',   formula: '2+DEX',           req: null,    cost: '10 gp'    },
  { name: 'Minor Enchantment', type: 'Cloth',   formula: '3+DEX',           req: null,    cost: '100 gp'   },
  { name: 'Major Enchantment', type: 'Cloth',   formula: '4+DEX',           req: null,    cost: '1,000 gp' },
  { name: 'Epic Enchantment',  type: 'Cloth',   formula: '5+DEX',           req: null,    cost: '10,000 gp'},
  { name: 'Cheap Hides',       type: 'Leather', formula: '3+DEX',           req: null,    cost: '5 gp'     },
  { name: 'Ox Hide',           type: 'Leather', formula: '4+DEX',           req: null,    cost: '25 gp'    },
  { name: 'Hard Leather',      type: 'Leather', formula: '5+DEX',           req: '1 STR', cost: '300 gp'   },
  { name: 'Wyrmhide',          type: 'Leather', formula: '6+DEX',           req: '1 STR', cost: '2,000 gp' },
  { name: 'Rusty Mail',        type: 'Mail',    formula: '6+DEX (max +2)',  req: null,    cost: '15 gp'    },
  { name: 'Chain Shirt',       type: 'Mail',    formula: '9+DEX (max +2)',  req: '2 STR', cost: '60 gp'    },
  { name: 'Scale Mail',        type: 'Mail',    formula: '12+DEX (max +2)', req: '3 STR', cost: '700 gp'   },
  { name: 'Dragonscale',       type: 'Mail',    formula: '15+DEX (max +2)', req: '4 STR', cost: '3,000 gp' },
  { name: 'Rusty Plate',       type: 'Plate',   formula: '10 (flat)',        req: '2 STR', cost: '25 gp'    },
  { name: 'Half Plate',        type: 'Plate',   formula: '14 (flat)',        req: '3 STR', cost: '200 gp'   },
  { name: 'Full Plate',        type: 'Plate',   formula: '18 (flat)',        req: '4 STR', cost: '2,000 gp' },
  { name: 'Mithril Plate',     type: 'Plate',   formula: '22 (flat)',        req: '5 STR', cost: '5,000 gp' },
  { name: 'Wooden Buckler',    type: 'Shield',  formula: '+2',              req: null,    cost: '5 gp'     },
  { name: 'Iron Shield',       type: 'Shield',  formula: '+4',              req: '2 STR', cost: '80 gp'    },
  { name: 'Tower Shield',      type: 'Shield',  formula: '+6',              req: '3 STR', cost: '1,500 gp' },
  { name: 'Dragon Shield',     type: 'Shield',  formula: '+8',              req: '3 STR', cost: '9,000 gp' },
]

const NIMBLE_ITEMS = [
  { item: 'Healing Potion (2d4+4 HP)',  slots: 1 },
  { item: 'Rope (50 ft.)',              slots: 1 },
  { item: 'Torch (stack of 2)',         slots: 1 },
  { item: 'Lantern & Oil',              slots: 1 },
  { item: 'Camping Supplies',           slots: 1 },
  { item: 'Rations',                    slots: 1 },
  { item: 'Hunting Trap',               slots: 1 },
  { item: 'Quiver & Ammo',              slots: 1 },
  { item: 'Lock Pick',                  slots: 1 },
  { item: 'Grappling Hook',             slots: 1 },
  { item: 'Mirror',                     slots: 1 },
  { item: 'Chalk',                      slots: 1 },
  { item: 'Manacles',                   slots: 1 },
  { item: 'Shovel',                     slots: 1 },
  { item: 'Crowbar',                    slots: 1 },
  { item: 'Vial of Pitch',              slots: 1 },
  { item: 'Bell',                       slots: 1 },
  { item: 'Magnifying Glass',           slots: 1 },
  { item: 'Padlock & Key',              slots: 1 },
  { item: 'Blanket',                    slots: 1 },
  { item: 'Large Sack',                 slots: 1 },
  { item: 'Instrument',                 slots: 1 },
]

// Weapon lookup by name (includes starting-gear aliases)
const WEAPON_LOOKUP = Object.fromEntries(NIMBLE_WEAPONS.map(w => [w.name, w]))
WEAPON_LOOKUP['Mace'] = WEAPON_LOOKUP['Club/Mace']
WEAPON_LOOKUP['Javelins (4)'] = WEAPON_LOOKUP['Javelins']

// Armor/shield lookups
const ARMOR_LOOKUP = Object.fromEntries(
  NIMBLE_ARMOR.filter(a => a.type !== 'Shield').map(a => [a.name, a])
)
const SHIELD_LOOKUP = Object.fromEntries(
  NIMBLE_ARMOR.filter(a => a.type === 'Shield').map(a => [a.name, a])
)

// Build weapons/armor/shield/equipment from a class's starting gear strings
function buildClassGear(cls) {
  const weapons = []
  let armor = null
  let shield = null
  const equipment = []

  for (const item of cls.startingGear) {
    if (WEAPON_LOOKUP[item]) {
      weapons.push({ ...WEAPON_LOOKUP[item], notes: '' })
    } else if (ARMOR_LOOKUP[item]) {
      armor = { ...ARMOR_LOOKUP[item] }
    } else if (SHIELD_LOOKUP[item]) {
      shield = { ...SHIELD_LOOKUP[item] }
    } else {
      equipment.push({ item, slots: 1 })
    }
  }
  return { weapons, armor, shield, equipment }
}

const CLASSES = [
  {
    id: 'Berserker',     keyStats: ['STR','DEX'], hitDie: 'd12', startingHP: 20,
    savePlus: 'str', saveMinus: 'int',
    armorProf: 'None', weaponProf: 'All STR weapons',
    startingGear: ['Battleaxe','Rations (meat)','Rope (50 ft.)'],
    description: 'An unstoppable force of wrath and ruin.',
  },
  {
    id: 'The Cheat',     keyStats: ['DEX','INT'], hitDie: 'd6',  startingHP: 10,
    savePlus: 'dex', saveMinus: 'wil',
    armorProf: 'Leather Armor', weaponProf: 'DEX Weapons',
    startingGear: ['Dagger','Dagger','Sling','Cheap Hides','Chalk'],
    description: 'Sneaky, backstabbing, dirty-fighting rogue.',
  },
  {
    id: 'Commander',    keyStats: ['STR','INT'], hitDie: 'd10', startingHP: 17,
    savePlus: 'str', saveMinus: 'dex',
    armorProf: 'Mail Armor, Shields', weaponProf: 'All Martial Weapons',
    startingGear: ['Hand Axe','Javelins (4)','Rusty Mail'],
    description: 'A battlefield tactician, leader, and weapon master.',
  },
  {
    id: 'Hunter',       keyStats: ['DEX','WIL'], hitDie: 'd8',  startingHP: 13,
    savePlus: 'dex', saveMinus: 'int',
    armorProf: 'Leather Armor', weaponProf: 'DEX Weapons',
    startingGear: ['Shortbow','Cheap Hides','Dagger','Hunting Trap'],
    description: 'Resourceful survivalist, bow master, and skilled tracker.',
  },
  {
    id: 'Mage',         keyStats: ['INT','WIL'], hitDie: 'd6',  startingHP: 10,
    savePlus: 'int', saveMinus: 'str',
    armorProf: 'Cloth Armor', weaponProf: 'Blades, Staves, Wands',
    startingGear: ["Adventurer's Garb",'Staff','Soap'],
    description: 'Wield and shape the elements of fire, ice, and lightning.',
  },
  {
    id: 'Oathsworn',    keyStats: ['STR','WIL'], hitDie: 'd10', startingHP: 17,
    savePlus: 'str', saveMinus: 'dex',
    armorProf: 'All Armor', weaponProf: 'STR Weapons',
    startingGear: ['Mace','Rusty Mail','Wooden Buckler','Manacles'],
    description: 'Faithful guardian, protector, and avenger of the weak.',
  },
  {
    id: 'Shadowmancer', keyStats: ['INT','DEX'], hitDie: 'd8',  startingHP: 13,
    savePlus: 'int', saveMinus: 'wil',
    armorProf: 'Cloth Armor', weaponProf: 'Blades, Wands',
    startingGear: ["Adventurer's Garb",'Sickle','Shovel'],
    description: 'Summon hordes of expendable minions from the shadow realm.',
  },
  {
    id: 'Shepherd',     keyStats: ['WIL','STR'], hitDie: 'd10', startingHP: 17,
    savePlus: 'wil', saveMinus: 'dex',
    armorProf: 'Mail Armor, Shields', weaponProf: 'STR Weapons, Wands',
    startingGear: ['Rusty Mail','Mace','Wooden Buckler','Bell'],
    description: 'Master life and death. Lead a faithful companion.',
  },
  {
    id: 'Songweaver',   keyStats: ['WIL','INT'], hitDie: 'd8',  startingHP: 13,
    savePlus: 'wil', saveMinus: 'str',
    armorProf: 'Cloth or Leather', weaponProf: 'DEX Weapons, Wands',
    startingGear: ["Adventurer's Garb",'Instrument','Dagger','Mirror'],
    description: 'Inspiring presence, sharp wit, sharper tongue.',
  },
  {
    id: 'Stormshifter', keyStats: ['WIL','DEX'], hitDie: 'd8',  startingHP: 13,
    savePlus: 'wil', saveMinus: 'str',
    armorProf: 'Cloth or Leather', weaponProf: 'Staves, Wands',
    startingGear: ['Cheap Hides','Staff','Strange Plant'],
    description: 'Master of weather, beast, and nature.',
  },
  {
    id: 'Zephyr',       keyStats: ['DEX','STR'], hitDie: 'd8',  startingHP: 13,
    savePlus: 'dex', saveMinus: 'int',
    armorProf: 'None', weaponProf: 'Melee Weapons',
    startingGear: ['Staff','Traveling Robes & Sandals'],
    description: 'A disciplined martial artist with swift hands and swift feet.',
  },
]

const ANCESTRIES = [
  {
    id: 'Human',        trait: 'Tenacious',
    description: '+1 to all skills and Initiative.',
  },
  {
    id: 'Dwarf',        trait: 'Stout',
    description: '+2 max Hit Dice, +1 max Wounds, −1 Speed. Know Dwarvish if INT ≥ 0.',
  },
  {
    id: 'Elf',          trait: 'Lithe',
    description: 'Advantage on Initiative, +1 Speed. Know Elvish if INT ≥ 0.',
  },
  {
    id: 'Halfling',     trait: 'Elusive',
    description: '+1 to Stealth. Once per Safe Rest: if you fail a save you may succeed instead.',
  },
  {
    id: 'Gnome',        trait: 'Optimistic',
    description: 'Allow an ally within Reach 6 to reroll any die (resets when healed to max HP). −1 Speed. Know Dwarvish if INT ≥ 0.',
  },
  {
    id: 'Exotic / Other', trait: 'Custom',
    description: 'Dragonborn, Fiendkin, Goblin, Orc, Bunbun, Birdfolk, Kobold, Ratfolk, and more. Note your ancestry trait on the sheet. Check with your GM.',
  },
]

const STAT_ARRAYS = [
  { id: 'standard',   label: 'Standard',   values: [2, 2, 0, -1],  flavor: 'Balanced and reliable' },
  { id: 'balanced',   label: 'Balanced',   values: [2, 1, 1, 0],   flavor: 'Even across the board' },
  { id: 'focused',    label: 'Focused',    values: [3, 1, 1, -1],  flavor: 'Dominant in one area' },
  { id: 'specialist', label: 'Specialist', values: [3, 2, -1, -1], flavor: 'High peak, clear weakness' },
  { id: 'custom',     label: 'Custom',     values: null,            flavor: 'Set your own modifiers' },
]

const STAT_KEYS   = ['str', 'dex', 'int', 'wil']
const STAT_LABELS = { str: 'STR', dex: 'DEX', int: 'INT', wil: 'WIL' }

const SKILL_GROUPS = [
  { stat: 'str', skills: ['might'] },
  { stat: 'dex', skills: ['stealth', 'finesse'] },
  { stat: 'int', skills: ['arcana', 'examination', 'lore'] },
  { stat: 'wil', skills: ['insight', 'influence', 'naturecraft', 'perception'] },
]

const SKILL_LABEL = {
  might: 'Might', stealth: 'Stealth', finesse: 'Finesse',
  arcana: 'Arcana', examination: 'Examination', lore: 'Lore',
  insight: 'Insight', influence: 'Influence', naturecraft: 'Naturecraft',
  perception: 'Perception',
}

const ALL_LANGUAGES = [
  'Common', 'Dwarvish', 'Elvish', 'Goblin', 'Infernal',
  "Thieves' Cant", 'Celestial', 'Draconic', 'Primordial', 'Deep Speak',
]

const SIZE_OPTIONS  = ['Tiny', 'Small', 'Medium', 'Large', 'Huge']
const SAVE_STATES   = ['none', 'advantage', 'disadvantage']
const SAVE_ICONS    = { advantage: '▲', disadvantage: '▼', none: '—' }
const SAVE_COLORS   = {
  advantage:    'text-emerald-400 border-emerald-500 bg-emerald-900/30',
  disadvantage: 'text-red-400 border-red-500 bg-red-900/20',
  none:         'text-codex-subtext border-codex-border bg-codex-surface',
}

const STEP_LABELS   = ['Identity', 'Ancestry', 'Class', 'Stats', 'Skills', 'Spells', 'Gear', 'Vitals', 'Legend']
const BONUS_POINTS_TOTAL  = 4
const MAX_BONUS_PER_SKILL = 3

// ─── Spell Data ───────────────────────────────────────────────────────────────

const SCHOOL_COLORS = {
  Fire:      { text: 'text-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-900/10', badge: 'bg-orange-900/30 text-orange-400 border-orange-500/40' },
  Ice:       { text: 'text-cyan-400',   border: 'border-cyan-500/40',   bg: 'bg-cyan-900/10',   badge: 'bg-cyan-900/30 text-cyan-400 border-cyan-500/40'       },
  Lightning: { text: 'text-yellow-400', border: 'border-yellow-500/40', bg: 'bg-yellow-900/10', badge: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/40' },
  Wind:      { text: 'text-sky-400',    border: 'border-sky-500/40',    bg: 'bg-sky-900/10',    badge: 'bg-sky-900/30 text-sky-400 border-sky-500/40'         },
  Radiant:   { text: 'text-amber-400',  border: 'border-amber-500/40',  bg: 'bg-amber-900/10',  badge: 'bg-amber-900/30 text-amber-400 border-amber-500/40'   },
  Necrotic:  { text: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-900/10', badge: 'bg-purple-900/30 text-purple-400 border-purple-500/40' },
}

const NIMBLE_SPELLS = [
  // FIRE
  { name: 'Flame Dart',        school: 'Fire',      tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Range 8 · Dmg 1d10 · On crit: Smoldering' },
  { name: "Heart's Fire",      school: 'Fire',      tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: "Range 4 · Give an ally within range an extra action · Spend 1 mana to cast as a reaction when it's not your turn" },
  { name: 'Ignite',            school: 'Fire',      tier: 1,         actions: 2, target: 'Single Target',
    summary: 'Range 8 · Dmg 4d10 to a Smoldering target (ends condition on hit) · Upcast: +10 dmg' },
  // ICE
  { name: 'Ice Lance',         school: 'Ice',       tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Range 12 · Dmg 1d6 cold or piercing · On hit: Slowed' },
  { name: 'Snowblind',         school: 'Ice',       tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Reach 1 · Dmg 1d6 · On hit: Blinded until end of their next turn' },
  { name: 'Frost Shield',      school: 'Ice',       tier: 1,         actions: 1, target: 'Self',
    summary: 'Reaction when attacked: Gain 2×KEY temp HP and Defend for free. Temp HP lost at start of your next turn · Upcast: +2×KEY temp HP' },
  // LIGHTNING
  { name: 'Zap',               school: 'Lightning', tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Range 12 · Dmg 2d8 · On miss: lightning fails to find ground and strikes you instead' },
  { name: 'Overload',          school: 'Lightning', tier: 'Cantrip', actions: 1, target: 'AoE',
    summary: 'Only castable while Charged (ends condition) · Reach 2 · Dmg 2d8 to others within Reach' },
  { name: 'Arc Lightning',     school: 'Lightning', tier: 1,         actions: 2, target: 'Single Target',
    summary: 'Range 12 · Dmg 3d8 · Also damages the next closest creature to your target · On miss: strikes you instead · Upcast: +4 dmg' },
  // WIND
  { name: 'Razor Wind',        school: 'Wind',      tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Range 12 · Dmg 1d4 slashing (Vicious: extra crit die) · Also damages up to 1 adjacent target' },
  { name: 'Breath of Life',    school: 'Wind',      tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Range 6 · Restore 1 HP to a Dying creature' },
  { name: 'Vicious Mockery',   school: 'Wind',      tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Range 12 · Dmg 1d4+INT psychic (ignores armor) · On hit: target Taunted on their next turn · Songweaver only' },
  { name: 'Blustery Gale',     school: 'Wind',      tier: 1,         actions: 2, target: 'Single Target',
    summary: 'Range 12 · Dmg 3d4 bludgeoning (adv. vs flying/Small/Tiny) · On hit: push Med target 2 spaces · Upcast: +1 movement' },
  // RADIANT
  { name: 'Rebuke',            school: 'Radiant',   tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Reach 4 · Dmg 1d6 (ignores armor, never misses) · 2× damage vs undead or Frightened (behind cover)' },
  { name: 'True Strike',       school: 'Radiant',   tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Reach 2 · Give a creature advantage on their next attack (until end of next turn)' },
  { name: 'Heal',              school: 'Radiant',   tier: 1,         actions: 1, target: 'Single Target+',
    summary: 'Reach 1 · Heal 1d6+KEY HP · Upcast: +1 target, +4 Reach, or +1d6 healing (5+ mana also removes 1 negative condition)' },
  { name: 'Lifebinding Spirit',school: 'Radiant',   tier: 1,         actions: 1, target: 'Special',
    summary: 'Shepherd only (Level 2) · Summon a spirit companion immune to harm · Action: attack or heal Reach 4 for 1d6+WIL radiant · Upcast: increment die (+1 step), +1 healing use' },
  // NECROTIC
  { name: 'Entice',            school: 'Necrotic',  tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Range 8 · Dmg 1d4 (ignores armor) · On hit: target moves 2 spaces closer to you' },
  { name: 'Withering Touch',   school: 'Necrotic',  tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Reach 1 · Dmg 1d12 · On hit: target treated as undead for 1 round' },
  { name: 'Shadow Blast',      school: 'Necrotic',  tier: 'Cantrip', actions: 1, target: 'Single Target',
    summary: 'Shadowmancer only · Range 8 · Dmg 1d12+KEY · Once per round' },
  { name: 'Summon Shadows',    school: 'Necrotic',  tier: 'Cantrip', actions: 1, target: 'Special',
    summary: 'Shadowmancer only · Summon 1 shadow minion Reach 1 (max: INT or Level, whichever is lower) · Action (1/turn): command ALL minions to move 6 then attack (Reach 1, 1d12 each; die to any damage)' },
  { name: 'Shadow Trap',       school: 'Necrotic',  tier: 1,         actions: 2, target: 'Single Target',
    summary: 'Concentration (1 min) · Next creature to move adjacent takes 3d12; if Small/Tiny also Restrained · Upcast: +1 size category, +1d12 on escape' },
]

// Lookup by name
const SPELL_BY_NAME = Object.fromEntries(NIMBLE_SPELLS.map(s => [s.name, s]))

// All cantrips in each school (for Songweaver second school)
const CANTRIPS_BY_SCHOOL = {
  Fire:      ['Flame Dart', "Heart's Fire"],
  Ice:       ['Ice Lance', 'Snowblind'],
  Lightning: ['Zap', 'Overload'],
  Wind:      ['Razor Wind', 'Breath of Life', 'Vicious Mockery'],
  Radiant:   ['Rebuke', 'True Strike'],
  Necrotic:  ['Entice', 'Withering Touch'],
}

// Per-class spell config at level 1 (extracted from Heroes book)
const CASTER_CONFIG = {
  Mage: {
    schools:        ['Fire', 'Ice', 'Lightning'],
    autoCantrips:   ['Flame Dart', "Heart's Fire", 'Ice Lance', 'Snowblind', 'Zap', 'Overload'],
    autoTier1:      [],
    manaL1:         false,
    manaFormula:    '(INT×3) + Level',
    pilferedPower:  false,
    manaNote:       'Mana pool and Tier 1 spells (Fire/Ice/Lightning) unlock at Level 2.',
    schoolChoice:   null,
  },
  Oathsworn: {
    schools:        [],             // spells unlock at Level 2
    autoCantrips:   [],
    autoTier1:      [],
    manaL1:         false,
    manaFormula:    'WIL + Level',  // available at Level 2
    pilferedPower:  false,
    manaNote:       'Radiant cantrips, Tier 1 spells (including Heal), and mana pool (WIL + Level) all unlock at Level 2. At Level 1 you have Radiant Judgment and Lay on Hands instead.',
    schoolChoice:   null,
  },
  Shadowmancer: {
    schools:        ['Necrotic'],
    autoCantrips:   ['Shadow Blast', 'Summon Shadows'], // only these two at L1
    autoTier1:      [],             // Pilfered Power + Tier 1 unlock at Level 2
    manaL1:         false,
    manaFormula:    'Pilfered Power',
    pilferedPower:  false,          // Pilfered Power itself unlocks at Level 2
    manaNote:       'At Level 1 you only know Shadow Blast and Summon Shadows. All Necrotic cantrips + Tier 1 spells + Pilfered Power (DEX casts/Safe Rest) unlock at Level 2.',
    schoolChoice:   null,
  },
  Shepherd: {
    schools:        ['Radiant', 'Necrotic'],
    autoCantrips:   ['Rebuke', 'True Strike', 'Entice', 'Withering Touch'],
    autoTier1:      [],
    manaL1:         false,
    manaFormula:    '(WIL×3) + Level',
    pilferedPower:  false,
    manaNote:       'Mana pool and Tier 1 spells (Radiant/Necrotic, including Lifebinding Spirit) unlock at Level 2.',
    schoolChoice:   null,
  },
  Songweaver: {
    schools:        ['Wind'],
    autoCantrips:   ['Razor Wind', 'Breath of Life', 'Vicious Mockery'],
    autoTier1:      [],
    manaL1:         false,
    manaFormula:    '(INT×3) + Level',
    pilferedPower:  false,
    manaNote:       'Mana pool and Tier 1 spells (Wind + chosen school) unlock at Level 2.',
    schoolChoice:   ['Fire', 'Ice', 'Lightning', 'Radiant', 'Necrotic'],
  },
  Stormshifter: {
    schools:        ['Lightning', 'Wind'],
    autoCantrips:   ['Zap', 'Overload', 'Razor Wind', 'Breath of Life'],
    autoTier1:      [],
    manaL1:         false,
    manaFormula:    '(WIL×3) + Level',
    pilferedPower:  false,
    manaNote:       'Mana pool and Tier 1 spells (Lightning/Wind) unlock at Level 2.',
    schoolChoice:   null,
  },
}

const NON_CASTER_CLASSES = ['Berserker', 'The Cheat', 'Commander', 'Hunter', 'Zephyr']

// PDF-verified Level 1 class features (zero-hallucination rule)
const CLASS_FEATURES = {
  Berserker: [
    {
      name: 'Rage',
      description: '(1/turn) Action: Roll a Fury Die (1d4) and set it aside. Add it to every STR attack you make. Max KEY Fury Dice; lost when Rage ends. Your Rage ends if you leave combat, drop to 0 HP, or go 1 round without attacking or Raging.',
    },
    {
      name: 'That All You Got?!',
      description: 'When you are attacked, you may expend 1 or more Fury Dice to reduce the damage taken by STR+DEX for each die spent.',
    },
  ],
  'The Cheat': [
    {
      name: 'Sneak Attack',
      description: '(1/turn) When you crit, deal +1d6 damage.',
    },
    {
      name: 'Vicious Opportunist',
      description: '(1/turn) When you HIT a Distracted target with a melee attack, you may change the Primary Die roll to whatever you like (changing it to the max value counts as a crit). A target is Distracted if adjacent to an ally, Taunted by an ally, or if it cannot see you.',
    },
  ],
  Commander: [
    {
      name: 'Coordinated Strike!',
      description: '(1/round) You and an ally within Reach 6 both immediately make a weapon attack or cast a cantrip for free. Usable INT times per Safe Rest.',
    },
  ],
  Hunter: [
    {
      name: "Hunter's Mark",
      description: "Action: A creature you can see is marked as your Quarry for 1 day (or until you mark another). It can't be hidden from you. Attacks against your Quarry gain your choice of advantage OR +LVL damage (choose before each attack).",
    },
    {
      name: 'Forager',
      description: 'Gain advantage on skill checks to find food and water in the wild.',
    },
  ],
  Mage: [
    {
      name: 'Elemental Spellcasting',
      description: 'You know the Fire, Ice, and Lightning spell schools and can cast cantrips from them. Mana pool and Tier 1 spells unlock at Level 2.',
    },
  ],
  Oathsworn: [
    {
      name: 'Radiant Judgment',
      description: 'Whenever an enemy attacks you, roll 2d6 Judgment Dice (if none are currently rolled). They are expended on the next melee attack you make this encounter. On hit: deal that much additional radiant damage.',
    },
    {
      name: 'Lay on Hands',
      description: 'Gain a magical healing pool equal to 5×LVL HP (5 at Level 1). Recharges on Safe Rest. Action: Touch a target and spend any amount of your remaining healing power to restore that many HP.',
    },
  ],
  Shadowmancer: [
    {
      name: 'Conduit of Shadow',
      description: 'Learn the cantrips Shadow Blast and Summon Shadows. At Level 2, gain all Necrotic cantrips, Tier 1 Necrotic spells, and Pilfered Power (cast tiered spells DEX times per Safe Rest; exceeding the limit costs half your max HP).',
    },
  ],
  Shepherd: [
    {
      name: 'Keeper of Life & Death',
      description: 'You know the Radiant & Necrotic spell schools and can cast those cantrips. Mana pool and Tier 1 spells (including Lifebinding Spirit) unlock at Level 2.',
    },
    {
      name: 'Searing Light',
      description: '(WIL times/Safe Rest) Action: Choose one — (Reach 6) Heal WIL×d8 HP to a Dying creature, OR inflict WIL×d8 radiant damage to an undead or Bloodied enemy.',
    },
  ],
  Songweaver: [
    {
      name: 'Wind Spellcasting',
      description: 'You know the Wind spell school and 1 other school of your choice (chosen at character creation), and can cast cantrips from both. You also know the Songweaver-only cantrip Vicious Mockery (Range 12, 1d4+INT psychic, ignores armor; target is Taunted on hit). Mana pool, Tier 1 spells, Jack of All Trades, and Song of Rest (1/day Field Rest) unlock at Level 2.',
    },
    {
      name: "Songweaver's Inspiration",
      description: '(2×WIL times/Safe Rest) Free Reaction: Allow an ally to reroll a single die related to an attack or save. They must keep either result.',
    },
  ],
  Stormshifter: [
    {
      name: 'Master of Storms',
      description: 'You know the Lightning & Wind spell schools and can cast those cantrips. Mana pool and Tier 1 spells unlock at Level 2.',
    },
    {
      name: 'Beastshift',
      description: 'Action: Transform into a harmless beast (squirrel, pigeon, etc.). While transformed, you can speak with animals. Ends if you drop to 0 HP, cast a spell, or end it freely on your turn. DEX charges per Safe Rest. (Attacks against Tiny beast form are made with disadvantage, but ANY damage ends the form.)',
    },
  ],
  Zephyr: [
    {
      name: 'Iron Defense',
      description: 'Your armor equals DEX+STR as long as you are unarmored. You cannot benefit from worn armor or this ability simultaneously.',
    },
    {
      name: 'Swift Fists',
      description: 'Your unarmed strikes do not suffer disadvantage from Rushed Attacks and deal 1d4+STR damage.',
    },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMod(n) {
  if (n === undefined || n === null || n === '') return '—'
  return n >= 0 ? `+${n}` : `${n}`
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, Number(val) || 0))
}

function savesFromClass(cls) {
  return {
    str: cls.savePlus === 'str' ? 'advantage' : cls.saveMinus === 'str' ? 'disadvantage' : 'none',
    dex: cls.savePlus === 'dex' ? 'advantage' : cls.saveMinus === 'dex' ? 'disadvantage' : 'none',
    int: cls.savePlus === 'int' ? 'advantage' : cls.saveMinus === 'int' ? 'disadvantage' : 'none',
    wil: cls.savePlus === 'wil' ? 'advantage' : cls.saveMinus === 'wil' ? 'disadvantage' : 'none',
  }
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, totalSteps }) {
  return (
    <div className="w-full px-6 pt-6 pb-4">
      <div className="flex items-center justify-between gap-1">
        {STEP_LABELS.map((label, i) => {
          const idx      = i + 1
          const active   = idx === step
          const complete = idx < step
          return (
            <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
              <div className="flex items-center w-full">
                {i > 0 && (
                  <div className={`flex-1 h-0.5 transition-colors ${complete ? 'bg-emerald-500' : 'bg-codex-border'}`} />
                )}
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  complete  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : active  ? 'bg-codex-bg border-emerald-500 text-emerald-400'
                  :           'bg-codex-surface border-codex-border text-codex-muted'
                }`}>
                  {complete ? (
                    <svg viewBox="0 0 12 10" className="w-3 h-3 fill-white">
                      <polyline points="1,5 4,8.5 11,1" strokeWidth="2" stroke="white" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : idx}
                </div>
                {i < totalSteps - 1 && (
                  <div className={`flex-1 h-0.5 transition-colors ${idx < step ? 'bg-emerald-500' : 'bg-codex-border'}`} />
                )}
              </div>
              <span className={`text-[9px] font-medium text-center leading-tight truncate w-full ${
                active ? 'text-emerald-400' : complete ? 'text-emerald-600' : 'text-codex-muted'
              }`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 1: Identity ─────────────────────────────────────────────────────────

function StepIdentity({ data, onChange }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-display text-codex-text">Who Are You?</h2>
        <p className="text-sm text-codex-subtext mt-1">Every legend begins with a name.</p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-codex-subtext uppercase tracking-wider">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={data.name}
            onChange={e => onChange({ name: e.target.value })}
            placeholder="Enter your character's full name"
            className="bg-codex-surface border border-codex-border rounded-xl px-4 py-3 text-codex-text text-sm placeholder-codex-muted focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-codex-subtext uppercase tracking-wider">
            Epithet <span className="text-codex-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={data.nickname}
            onChange={e => onChange({ nickname: e.target.value })}
            placeholder="What companions call you in the dark"
            className="bg-codex-surface border border-codex-border rounded-xl px-4 py-3 text-codex-text text-sm placeholder-codex-muted focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Ancestry ─────────────────────────────────────────────────────────

function StepAncestry({ data, onChange }) {
  const selected = ANCESTRIES.find(a => a.id === data.ancestry)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-display text-codex-text">Your Ancestry</h2>
        <p className="text-sm text-codex-subtext mt-1">Blood and heritage shape your nature before you ever draw a blade.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ANCESTRIES.map(anc => {
          const isSelected = data.ancestry === anc.id
          return (
            <button
              key={anc.id}
              onClick={() => onChange({ ancestry: anc.id })}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                isSelected ? 'border-emerald-500 bg-codex-bg' : 'border-codex-border bg-codex-card hover:border-codex-muted hover:bg-codex-bg'
              }`}
            >
              <div className={`text-sm font-semibold ${isSelected ? 'text-emerald-400' : 'text-codex-text'}`}>{anc.id}</div>
              <div className="text-[11px] text-codex-muted mt-0.5 font-medium">{anc.trait}</div>
            </button>
          )
        })}
      </div>
      {selected && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-900/10 p-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1.5">Ancestry Trait</div>
          <div className="text-sm font-semibold text-emerald-400 mb-1">{selected.trait}</div>
          <p className="text-xs text-codex-subtext leading-relaxed">{selected.description}</p>
        </div>
      )}
    </div>
  )
}

// ─── Step 3: Class ────────────────────────────────────────────────────────────

function StepClass({ data, onChange }) {
  function handleSelectClass(cls) {
    const gear = buildClassGear(cls)
    onChange({
      class_name:  cls.id,
      hit_dice:    cls.hitDie,
      saves:       savesFromClass(cls),
      hp_max:      cls.startingHP,
      hp_current:  cls.startingHP,
      // reset gear
      gearMode:    'class_gear',
      weapons:     gear.weapons,
      armor:       gear.armor,
      shield:      gear.shield,
      equipment:   gear.equipment,
      gold:        0,
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-display text-codex-text">Your Class</h2>
        <p className="text-sm text-codex-subtext mt-1">How you solve problems — and what problems find you first.</p>
      </div>
      <div className="flex flex-col gap-3">
        {CLASSES.map(cls => {
          const isSelected = data.class_name === cls.id
          return (
            <button
              key={cls.id}
              onClick={() => handleSelectClass(cls)}
              className={`flex items-start gap-4 text-left p-4 rounded-xl border-2 transition-all ${
                isSelected ? 'border-emerald-500 bg-codex-bg' : 'border-codex-border bg-codex-card hover:border-codex-muted hover:bg-codex-bg'
              }`}
            >
              {/* Hit die badge */}
              <div className={`flex-shrink-0 w-14 rounded-lg flex flex-col items-center justify-center border py-2 ${
                isSelected ? 'border-emerald-500 bg-emerald-900/20' : 'border-codex-border bg-codex-surface'
              }`}>
                <span className={`text-lg font-display font-bold leading-none ${isSelected ? 'text-emerald-400' : 'text-codex-muted'}`}>
                  {cls.hitDie}
                </span>
                <span className="text-[9px] text-codex-muted mt-0.5">HP: {cls.startingHP}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${isSelected ? 'text-emerald-400' : 'text-codex-text'}`}>
                    {cls.id}
                  </span>
                  {cls.keyStats.map(s => (
                    <span key={s} className={`text-[10px] border rounded-full px-2 py-0.5 ${
                      isSelected ? 'border-emerald-500/40 bg-emerald-900/20 text-emerald-400'
                                 : 'border-codex-border bg-codex-surface text-codex-muted'
                    }`}>{s}</span>
                  ))}
                </div>
                <p className="text-xs text-codex-subtext mt-1 leading-relaxed">{cls.description}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
                  <span className="text-[10px] text-codex-muted">
                    <span className="text-codex-subtext">Armor:</span> {cls.armorProf}
                  </span>
                  <span className="text-[10px] text-codex-muted">
                    <span className="text-codex-subtext">Weapons:</span> {cls.weaponProf}
                  </span>
                </div>
                {/* Level 1 feature preview — expands when selected */}
                {isSelected && CLASS_FEATURES[cls.id] && (
                  <div className="mt-3 pt-3 border-t border-emerald-500/20 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-emerald-500/70 font-medium">Level 1 Features</p>
                    {CLASS_FEATURES[cls.id].map(feat => (
                      <div key={feat.name} className="rounded-lg bg-codex-surface border border-codex-border px-3 py-2">
                        <p className="text-xs font-semibold text-emerald-400 mb-0.5">{feat.name}</p>
                        <p className="text-[11px] text-codex-muted leading-relaxed">{feat.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-1 transition-all ${
                isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-codex-border'
              }`} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 4: Stats ────────────────────────────────────────────────────────────

function StepStats({ data, onChange }) {
  const isHuman     = data.ancestry === 'Human'
  const selectedArr = STAT_ARRAYS.find(a => a.id === data._arrayId) || null
  const isCustom    = data._arrayId === 'custom'
  const humanBonus  = data._humanBonus
  const assignments = data._assignments || { str: null, dex: null, int: null, wil: null }

  function pickArray(arr) {
    onChange({
      _arrayId:     arr.id,
      _assignments: { str: null, dex: null, int: null, wil: null },
      _humanBonus:  null,
      stats:        { str: 0, dex: 0, int: 0, wil: 0 },
    })
  }

  function assignStat(statKey, valueStr) {
    const value = valueStr === '' ? null : Number(valueStr)
    const newAssign = { ...assignments, [statKey]: value }
    const newStats  = { ...data.stats }
    STAT_KEYS.forEach(k => {
      const base  = newAssign[k]
      if (base !== null && base !== undefined) {
        const bonus = isHuman && humanBonus === k ? 1 : 0
        newStats[k] = base + bonus
      } else {
        newStats[k] = 0
      }
    })
    onChange({ _assignments: newAssign, stats: newStats })
  }

  function setCustomStat(statKey, val) {
    const n     = clamp(Number(val) || 0, -2, 5)
    const bonus = isHuman && humanBonus === statKey ? 1 : 0
    const newStats = { ...data.stats, [statKey]: n + bonus }
    onChange({ stats: newStats, _customRaw: { ...(data._customRaw || {}), [statKey]: n } })
  }

  function toggleHumanBonus(statKey) {
    if (!isHuman) return
    const newBonus = humanBonus === statKey ? null : statKey
    const newStats = { ...data.stats }
    STAT_KEYS.forEach(k => {
      const base = isCustom
        ? (data._customRaw?.[k] ?? data.stats[k])
        : (assignments[k] ?? 0)
      newStats[k] = base + (newBonus === k ? 1 : 0)
    })
    onChange({ _humanBonus: newBonus, stats: newStats })
  }

  function availableValues(statKey) {
    if (!selectedArr || !selectedArr.values) return []
    const usedElsewhere = STAT_KEYS.filter(k => k !== statKey).map(k => assignments[k])
    const pool = [...selectedArr.values]
    usedElsewhere.forEach(v => {
      if (v !== null && v !== undefined) {
        const idx = pool.indexOf(v)
        if (idx !== -1) pool.splice(idx, 1)
      }
    })
    return pool
  }

  const allAssigned = isCustom ? true : STAT_KEYS.every(k => assignments[k] !== null && assignments[k] !== undefined)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-display text-codex-text">Ability Stats</h2>
        <p className="text-sm text-codex-subtext mt-1">Stats are direct modifiers (−2 to +5). Pick an array, then assign each value.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {STAT_ARRAYS.map(arr => {
          const isSelected = data._arrayId === arr.id
          return (
            <button key={arr.id} onClick={() => pickArray(arr)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                isSelected ? 'border-emerald-500 bg-codex-bg' : 'border-codex-border bg-codex-card hover:border-codex-muted hover:bg-codex-bg'
              }`}>
              <div className={`text-sm font-semibold ${isSelected ? 'text-emerald-400' : 'text-codex-text'}`}>{arr.label}</div>
              <div className="text-[11px] text-codex-muted mt-0.5">{arr.values ? arr.values.map(fmtMod).join(', ') : 'Free entry'}</div>
              <div className="text-[10px] text-codex-muted mt-0.5 italic">{arr.flavor}</div>
            </button>
          )
        })}
      </div>
      {data._arrayId && (
        <div className="flex flex-col gap-3">
          {isHuman && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 px-4 py-3 text-xs text-emerald-400">
              <span className="font-semibold">Tenacious:</span> Click the <span className="font-bold text-codex-gold">+1</span> button on a stat to apply your ancestry bonus.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {STAT_KEYS.map(statKey => {
              const finalVal     = data.stats[statKey]
              const hasHumanBonus = isHuman && humanBonus === statKey
              return (
                <div key={statKey} className="bg-codex-surface border border-codex-border rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-codex-subtext uppercase tracking-wider">{STAT_LABELS[statKey]}</span>
                    {isHuman && (
                      <button onClick={() => toggleHumanBonus(statKey)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                          hasHumanBonus ? 'bg-codex-gold text-codex-bg border-codex-gold'
                                        : 'border-codex-border text-codex-muted hover:border-codex-gold hover:text-codex-gold'
                        }`}>+1</button>
                    )}
                  </div>
                  {isCustom ? (
                    <input type="number" min={-2} max={5}
                      value={data._customRaw?.[statKey] ?? 0}
                      onChange={e => setCustomStat(statKey, e.target.value)}
                      className="bg-codex-card border border-codex-border rounded-lg px-2 py-1.5 text-center text-codex-text text-sm focus:outline-none focus:border-emerald-500 transition-colors w-full"
                    />
                  ) : (
                    <select value={assignments[statKey] ?? ''}
                      onChange={e => assignStat(statKey, e.target.value)}
                      className="bg-codex-card border border-codex-border rounded-lg px-2 py-1.5 text-center text-codex-text text-sm focus:outline-none focus:border-emerald-500 transition-colors w-full appearance-none cursor-pointer">
                      <option value="">— assign —</option>
                      {assignments[statKey] !== null && assignments[statKey] !== undefined && (
                        <option value={assignments[statKey]}>{fmtMod(assignments[statKey])} (current)</option>
                      )}
                      {availableValues(statKey).map((v, i) => (
                        <option key={i} value={v}>{fmtMod(v)}</option>
                      ))}
                    </select>
                  )}
                  <div className={`text-center text-2xl font-bold ${
                    finalVal > 0 ? 'text-emerald-400' : finalVal < 0 ? 'text-red-400' : 'text-codex-muted'
                  }`}>{fmtMod(finalVal)}</div>
                </div>
              )
            })}
          </div>
          {!isCustom && !allAssigned && (
            <p className="text-xs text-codex-muted text-center">Assign all four values to continue.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 5: Skills ───────────────────────────────────────────────────────────

function StepSkills({ data, onChange }) {
  const stats   = data.stats || { str: 0, dex: 0, int: 0, wil: 0 }
  const bonuses = data._skillBonuses || {}
  const totalSpent = Object.values(bonuses).reduce((s, v) => s + (v || 0), 0)

  function setBonus(skill, delta) {
    const current = bonuses[skill] || 0
    const next    = current + delta
    if (next < 0 || next > MAX_BONUS_PER_SKILL) return
    if (delta > 0 && totalSpent >= BONUS_POINTS_TOTAL) return
    onChange({ _skillBonuses: { ...bonuses, [skill]: next } })
  }

  const statForSkill = {}
  SKILL_GROUPS.forEach(g => g.skills.forEach(s => { statForSkill[s] = g.stat }))
  const remaining = BONUS_POINTS_TOTAL - totalSpent

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-display text-codex-text">Skills</h2>
        <p className="text-sm text-codex-subtext mt-1">Each skill starts at its governing stat. Distribute 4 bonus points.</p>
      </div>
      <div className="flex items-center gap-3 bg-codex-surface rounded-xl border border-codex-border px-4 py-3">
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-codex-subtext font-medium">Bonus Points Spent</span>
            <span className={`font-bold ${remaining === 0 ? 'text-emerald-400' : 'text-codex-gold'}`}>{totalSpent} / {BONUS_POINTS_TOTAL}</span>
          </div>
          <div className="h-1.5 bg-codex-card rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(totalSpent / BONUS_POINTS_TOTAL) * 100}%` }} />
          </div>
        </div>
        <div className={`text-lg font-bold w-8 text-center ${remaining > 0 ? 'text-codex-gold' : 'text-emerald-400'}`}>{remaining}</div>
      </div>
      <div className="flex flex-col gap-4">
        {SKILL_GROUPS.map(group => (
          <div key={group.stat} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 border border-emerald-500/30 rounded px-1.5 py-0.5">
                {STAT_LABELS[group.stat]}
              </span>
              <span className="text-xs text-codex-muted">base {fmtMod(stats[group.stat])}</span>
            </div>
            <div className="flex flex-col gap-2">
              {group.skills.map(skill => {
                const base  = stats[group.stat] || 0
                const bonus = bonuses[skill] || 0
                const total = base + bonus
                return (
                  <div key={skill} className="flex items-center gap-3 bg-codex-surface border border-codex-border rounded-xl px-4 py-2.5">
                    <span className="flex-1 text-sm text-codex-text">{SKILL_LABEL[skill]}</span>
                    <span className="text-xs text-codex-muted w-10 text-center">{fmtMod(base)}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setBonus(skill, -1)} disabled={bonus <= 0}
                        className="w-6 h-6 rounded-md border border-codex-border text-codex-muted flex items-center justify-center text-sm font-bold hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">−</button>
                      <span className={`w-6 text-center text-sm font-bold ${bonus > 0 ? 'text-emerald-400' : 'text-codex-muted'}`}>
                        {bonus > 0 ? `+${bonus}` : '0'}
                      </span>
                      <button onClick={() => setBonus(skill, 1)} disabled={bonus >= MAX_BONUS_PER_SKILL || remaining <= 0}
                        className="w-6 h-6 rounded-md border border-codex-border text-codex-muted flex items-center justify-center text-sm font-bold hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">+</button>
                    </div>
                    <div className={`w-10 text-center text-lg font-bold tabular-nums ${
                      total > 0 ? 'text-emerald-400' : total < 0 ? 'text-red-400' : 'text-codex-muted'
                    }`}>{fmtMod(total)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step 6: Spells ───────────────────────────────────────────────────────────

function SpellCard({ spell }) {
  const colors = SCHOOL_COLORS[spell.school] || {}
  const isCantrip = spell.tier === 'Cantrip'
  return (
    <div className={`rounded-xl border p-3 ${colors.border} ${colors.bg}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${colors.text}`}>{spell.name}</span>
          <span className={`text-[10px] font-bold border rounded-full px-1.5 py-0.5 ${colors.badge}`}>
            {spell.school}
          </span>
          <span className="text-[10px] text-codex-muted border border-codex-border rounded-full px-1.5 py-0.5">
            {isCantrip ? 'Cantrip · Free' : `Tier ${spell.tier} · ${spell.tier} mana`}
          </span>
        </div>
        <span className="text-[10px] text-codex-muted whitespace-nowrap flex-shrink-0">
          {spell.actions} action{spell.actions !== 1 ? 's' : ''} · {spell.target}
        </span>
      </div>
      <p className="text-xs text-codex-subtext leading-relaxed">{spell.summary}</p>
    </div>
  )
}

function StepSpells({ data, onChange }) {
  const config  = CASTER_CONFIG[data.class_name]
  const isNonCaster = !config
  const school2 = data._spellSchool2 || ''

  // Oathsworn has CASTER_CONFIG but zero L1 spells — treat like non-caster for this step
  const hasL1Spells = config && (config.autoCantrips.length > 0 || config.autoTier1.length > 0 || config.schoolChoice)

  if (isNonCaster || !hasL1Spells) {
    const isOathsworn = data.class_name === 'Oathsworn'
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-display text-codex-text">Spells</h2>
          <p className="text-sm text-codex-subtext mt-1">Not all heroes bend reality at level 1.</p>
        </div>
        <div className="rounded-xl border border-codex-border bg-codex-surface px-5 py-6 text-center">
          <div className="text-3xl mb-3">{isOathsworn ? '🛡' : '⚔'}</div>
          <div className="text-sm font-semibold text-codex-text mb-1">No Spellcasting at Level 1</div>
          <p className="text-xs text-codex-muted leading-relaxed">
            The <span className="text-codex-text font-medium">{data.class_name || 'selected class'}</span>{' '}
            {isOathsworn
              ? "uses Lay on Hands (a 5-HP healing pool) and Radiant Judgment at level 1. Radiant cantrips, Tier 1 spells, and your mana pool (WIL + Level) all unlock at Level 2."
              : "doesn't use magic at level 1. Your power comes from training, instinct, and steel — not spellcraft."}
          </p>
        </div>
        {config && (
          <div className="rounded-xl border border-codex-border bg-codex-surface px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-codex-subtext mb-1">Coming at Level 2</div>
            <p className="text-xs text-codex-muted leading-relaxed">{config.manaNote}</p>
          </div>
        )}
      </div>
    )
  }

  // Gather spells to display
  const autoCantrips = config.autoCantrips.map(n => SPELL_BY_NAME[n]).filter(Boolean)
  const autoTier1    = config.autoTier1.map(n => SPELL_BY_NAME[n]).filter(Boolean)
  const chosenCantrips = school2 && CANTRIPS_BY_SCHOOL[school2]
    ? CANTRIPS_BY_SCHOOL[school2]
        .filter(n => !config.autoCantrips.includes(n))
        .map(n => SPELL_BY_NAME[n]).filter(Boolean)
    : []

  const allSchools = school2
    ? [...new Set([...config.schools, school2])]
    : config.schools

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-display text-codex-text">Starting Spells</h2>
        <p className="text-sm text-codex-subtext mt-1">
          These are the spells your {data.class_name} knows at level 1, extracted directly from the Heroes book.
        </p>
      </div>

      {/* Schools badge row */}
      <div className="flex flex-wrap gap-2">
        {allSchools.map(school => {
          const c = SCHOOL_COLORS[school] || {}
          return (
            <span key={school} className={`text-xs font-bold border rounded-full px-3 py-1 ${c.badge}`}>
              {school}
            </span>
          )
        })}
      </div>

      {/* Songweaver school choice */}
      {config.schoolChoice && (
        <div className="bg-codex-surface border border-codex-border rounded-xl p-4">
          <div className="text-xs font-semibold text-codex-subtext uppercase tracking-wider mb-2">
            Choose Your Second Spell School <span className="text-red-400">*</span>
          </div>
          <p className="text-xs text-codex-muted mb-3">
            At level 1, you know cantrips from the Wind school plus all cantrips from one additional school of your choice.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {config.schoolChoice.map(school => {
              const c = SCHOOL_COLORS[school] || {}
              const selected = school2 === school
              return (
                <button key={school} onClick={() => onChange({ _spellSchool2: school })}
                  className={`py-2 rounded-xl border text-sm font-medium transition-all ${
                    selected ? `${c.border} ${c.bg} ${c.text}` : 'border-codex-border bg-codex-card text-codex-muted hover:border-codex-text'
                  }`}>
                  {school}
                </button>
              )
            })}
          </div>
          {school2 && (
            <p className="text-xs text-emerald-400 mt-2">
              ✓ You know all <span className="font-semibold">{school2}</span> cantrips at level 1.
            </p>
          )}
        </div>
      )}

      {/* Mana / resource info */}
      <div className={`rounded-xl border px-4 py-3 ${
        config.manaL1        ? 'border-emerald-500/30 bg-emerald-900/10'
        : config.pilferedPower ? 'border-purple-500/30 bg-purple-900/10'
        :                        'border-codex-border bg-codex-surface'
      }`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5 text-codex-subtext">
              {config.pilferedPower ? 'Pilfered Power' : 'Mana Pool'}
            </div>
            <div className={`text-sm font-semibold ${
              config.manaL1 ? 'text-emerald-400' : config.pilferedPower ? 'text-purple-400' : 'text-codex-muted'
            }`}>
              {config.manaL1 ? config.manaFormula : config.pilferedPower ? 'DEX uses / Safe Rest' : 'Unlocks at Level 2'}
            </div>
          </div>
          {config.manaL1 && (
            <div className="text-right">
              <div className="text-[10px] text-codex-muted">At Level 1 with current stats</div>
              <div className="text-xl font-bold text-emerald-400">
                {config.manaFormula === 'WIL + Level'
                  ? (data.stats?.wil || 0) + 1
                  : config.manaFormula === '(INT×3) + Level'
                  ? ((data.stats?.int || 0) * 3) + 1
                  : '—'}
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-codex-muted mt-2 leading-relaxed">{config.manaNote}</p>
      </div>

      {/* Cantrip list */}
      {autoCantrips.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-codex-subtext">
            Cantrips — free to cast, no mana cost
          </div>
          {autoCantrips.map(spell => <SpellCard key={spell.name} spell={spell} />)}
          {chosenCantrips.map(spell => <SpellCard key={spell.name} spell={spell} />)}
        </div>
      )}

      {/* Tier 1 spell list */}
      {autoTier1.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-codex-subtext">
            Tier 1 Spells — cost 1 mana each
          </div>
          {autoTier1.map(spell => <SpellCard key={spell.name} spell={spell} />)}
        </div>
      )}

      <p className="text-xs text-codex-muted italic">
        These spells are recorded automatically on your character sheet. Higher tiers unlock as you level up.
      </p>
    </div>
  )
}

// ─── Step 7: Gear ─────────────────────────────────────────────────────────────

function WeaponPicker({ onAdd }) {
  const [value, setValue] = useState('')
  function handleAdd() {
    if (!value) return
    onAdd(value)
    setValue('')
  }
  return (
    <div className="flex gap-2">
      <select value={value} onChange={e => setValue(e.target.value)}
        className="flex-1 bg-codex-surface border border-codex-border rounded-xl px-3 py-2 text-codex-text text-sm focus:outline-none focus:border-emerald-500 transition-colors">
        <option value="">— Add a weapon —</option>
        <optgroup label="⚔ Melee">
          {NIMBLE_WEAPONS.filter(w => w.category === 'Melee').map(w => (
            <option key={w.name} value={w.name}>
              {w.name} · {w.damage} {w.type}{w.properties ? ' · ' + w.properties : ''} ({w.cost})
            </option>
          ))}
        </optgroup>
        <optgroup label="🏹 Ranged">
          {NIMBLE_WEAPONS.filter(w => w.category === 'Ranged').map(w => (
            <option key={w.name} value={w.name}>
              {w.name} · {w.damage} {w.type}{w.properties ? ' · ' + w.properties : ''} ({w.cost})
            </option>
          ))}
        </optgroup>
      </select>
      <button onClick={handleAdd} disabled={!value}
        className="px-4 py-2 rounded-xl border border-emerald-500/40 text-emerald-400 text-sm font-medium hover:bg-emerald-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        Add
      </button>
    </div>
  )
}

function ItemPicker({ onAdd }) {
  const [value, setValue] = useState('')
  function handleAdd() {
    if (!value) return
    onAdd(value)
    setValue('')
  }
  return (
    <div className="flex gap-2">
      <select value={value} onChange={e => setValue(e.target.value)}
        className="flex-1 bg-codex-surface border border-codex-border rounded-xl px-3 py-2 text-codex-text text-sm focus:outline-none focus:border-emerald-500 transition-colors">
        <option value="">— Add common item —</option>
        {NIMBLE_ITEMS.map(i => <option key={i.item} value={i.item}>{i.item}</option>)}
      </select>
      <button onClick={handleAdd} disabled={!value}
        className="px-4 py-2 rounded-xl border border-codex-border text-codex-muted text-sm font-medium hover:border-emerald-500/40 hover:text-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        Add
      </button>
    </div>
  )
}

function CustomItemInput({ onAdd }) {
  const [value, setValue] = useState('')
  function commit() {
    if (!value.trim()) return
    onAdd(value.trim())
    setValue('')
  }
  return (
    <div className="flex gap-2">
      <input type="text" value={value} onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && commit()}
        placeholder="Custom item…"
        className="flex-1 bg-codex-surface border border-codex-border rounded-xl px-3 py-2 text-codex-text text-sm placeholder-codex-muted focus:outline-none focus:border-emerald-500 transition-colors"
      />
      <button onClick={commit} disabled={!value.trim()}
        className="px-4 py-2 rounded-xl border border-codex-border text-codex-muted text-sm font-medium hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
        Add
      </button>
    </div>
  )
}

function StepGear({ data, onChange }) {
  const cls       = CLASSES.find(c => c.id === data.class_name)
  const weapons   = data.weapons   || []
  const armor     = data.armor     || null
  const shield    = data.shield    || null
  const equipment = data.equipment || []
  const gearMode  = data.gearMode  || 'class_gear'

  function switchMode(mode) {
    if (mode === gearMode) return
    if (mode === 'class_gear' && cls) {
      const gear = buildClassGear(cls)
      onChange({ gearMode: 'class_gear', ...gear, gold: 0 })
    } else {
      onChange({ gearMode: 'buy_gear', weapons: [], armor: null, shield: null, equipment: [], gold: 50 })
    }
  }

  function addWeapon(weaponName) {
    const w = NIMBLE_WEAPONS.find(w => w.name === weaponName)
    if (!w) return
    onChange({ weapons: [...weapons, { ...w, notes: '' }] })
  }
  function removeWeapon(i) {
    onChange({ weapons: weapons.filter((_, idx) => idx !== i) })
  }
  function setArmor(name) {
    const a = NIMBLE_ARMOR.find(a => a.name === name && a.type !== 'Shield')
    onChange({ armor: a || null })
  }
  function setShield(name) {
    const s = NIMBLE_ARMOR.find(a => a.name === name && a.type === 'Shield')
    onChange({ shield: s || null })
  }
  function addEquipment(item) {
    onChange({ equipment: [...equipment, { item, slots: 1 }] })
  }
  function removeEquipment(i) {
    onChange({ equipment: equipment.filter((_, idx) => idx !== i) })
  }

  const armorTypes    = ['Cloth', 'Leather', 'Mail', 'Plate']
  const shieldOptions = NIMBLE_ARMOR.filter(a => a.type === 'Shield')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-display text-codex-text">Starting Gear</h2>
        <p className="text-sm text-codex-subtext mt-1">
          Take your class's canonical starting gear, or spend 50 gp to equip your own loadout.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button onClick={() => switchMode('class_gear')}
          className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            gearMode === 'class_gear'
              ? 'border-emerald-500 bg-emerald-900/20 text-emerald-400'
              : 'border-codex-border bg-codex-surface text-codex-muted hover:border-emerald-500/50'
          }`}>
          Class Gear
        </button>
        <button onClick={() => switchMode('buy_gear')}
          className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            gearMode === 'buy_gear'
              ? 'border-codex-gold bg-codex-gold/10 text-codex-gold'
              : 'border-codex-border bg-codex-surface text-codex-muted hover:border-codex-gold/50'
          }`}>
          Buy Your Own — 50 gp
        </button>
      </div>

      {gearMode === 'buy_gear' && (
        <div className="rounded-xl border border-codex-gold/30 bg-codex-gold/5 px-4 py-3 text-sm text-codex-gold">
          You start with <strong>50 gp</strong>. Add weapons, armor, and items below. Track gold on your sheet.
        </div>
      )}
      {gearMode === 'class_gear' && cls && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/5 px-4 py-3 text-xs text-codex-subtext">
          <span className="font-semibold text-emerald-400">{cls.id}</span> canonical gear pre-loaded.
          You can add or remove items as needed.
        </div>
      )}

      {/* WEAPONS */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 border border-emerald-500/30 rounded px-1.5 py-0.5">Weapons</span>
          <div className="flex-1 h-px bg-codex-border" />
        </div>
        {weapons.length === 0 && <p className="text-xs text-codex-muted italic">No weapons selected.</p>}
        {weapons.map((w, i) => (
          <div key={i} className="flex items-start gap-2 bg-codex-surface border border-codex-border rounded-xl p-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-codex-text">{w.name}</div>
              <div className="text-xs text-codex-subtext mt-0.5 flex flex-wrap gap-1.5">
                <span className="text-emerald-400">{w.damage}</span>
                <span className="text-codex-muted">·</span>
                <span>{w.type}</span>
                {w.properties && (<><span className="text-codex-muted">·</span><span className="text-codex-muted">{w.properties}</span></>)}
                <span className="text-codex-muted">· {w.cost}</span>
              </div>
            </div>
            <button onClick={() => removeWeapon(i)} className="text-codex-muted hover:text-red-400 transition-colors text-xl leading-none mt-0.5">×</button>
          </div>
        ))}
        <WeaponPicker onAdd={addWeapon} />
      </div>

      {/* ARMOR */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 border border-emerald-500/30 rounded px-1.5 py-0.5">Armor</span>
          <div className="flex-1 h-px bg-codex-border" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-codex-subtext mb-1.5">Armor</div>
            <select value={armor?.name || ''} onChange={e => setArmor(e.target.value)}
              className="w-full bg-codex-surface border border-codex-border rounded-xl px-3 py-2.5 text-codex-text text-sm focus:outline-none focus:border-emerald-500 transition-colors">
              <option value="">— None / Unarmored (DEX) —</option>
              {armorTypes.map(type => (
                <optgroup key={type} label={type}>
                  {NIMBLE_ARMOR.filter(a => a.type === type).map(a => (
                    <option key={a.name} value={a.name}>
                      {a.name} ({a.formula}){a.req ? ` [Req. ${a.req}]` : ''} — {a.cost}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-codex-subtext mb-1.5">Shield</div>
            <select value={shield?.name || ''} onChange={e => setShield(e.target.value)}
              className="w-full bg-codex-surface border border-codex-border rounded-xl px-3 py-2.5 text-codex-text text-sm focus:outline-none focus:border-emerald-500 transition-colors">
              <option value="">— No Shield —</option>
              {shieldOptions.map(s => (
                <option key={s.name} value={s.name}>{s.name} ({s.formula}) — {s.cost}</option>
              ))}
            </select>
          </div>
        </div>
        {(armor || shield) && (
          <div className="rounded-xl border border-codex-border bg-codex-surface px-4 py-3 flex flex-col gap-1">
            {armor && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-codex-text font-medium">{armor.name}</span>
                <span className="text-emerald-400 font-mono">{armor.formula}</span>
              </div>
            )}
            {shield && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-codex-text font-medium">{shield.name}</span>
                <span className="text-emerald-400 font-mono">{shield.formula} bonus</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EQUIPMENT */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 border border-emerald-500/30 rounded px-1.5 py-0.5">Equipment</span>
          <div className="flex-1 h-px bg-codex-border" />
        </div>
        {equipment.length === 0 && <p className="text-xs text-codex-muted italic">No equipment items yet.</p>}
        <div className="flex flex-wrap gap-2">
          {equipment.map((e, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-codex-surface border border-codex-border rounded-lg px-3 py-1.5 text-sm text-codex-text">
              <span>{e.item}</span>
              <button onClick={() => removeEquipment(i)} className="text-codex-muted hover:text-red-400 transition-colors text-base leading-none">×</button>
            </div>
          ))}
        </div>
        <ItemPicker onAdd={addEquipment} />
        <CustomItemInput onAdd={addEquipment} />
      </div>
    </div>
  )
}

// ─── Step 7: Vitals ───────────────────────────────────────────────────────────

function StepVitals({ data, onChange }) {
  const cls         = CLASSES.find(c => c.id === data.class_name)
  const stats       = data.stats || { str: 0, dex: 0, int: 0, wil: 0 }
  const intMod      = stats.int || 0
  const maxLanguages = 1 + Math.max(0, intMod) + (data.ancestry === 'Human' ? 1 : 0)
  const languages   = data.languages || ['Common']
  const saves       = data.saves || { str: 'none', dex: 'none', int: 'none', wil: 'none' }
  const hp          = cls ? cls.startingHP : (data.hp_max || 0)

  function toggleLanguage(lang) {
    if (lang === 'Common') return
    if (languages.includes(lang)) {
      onChange({ languages: languages.filter(l => l !== lang) })
    } else {
      if (languages.length >= maxLanguages) return
      onChange({ languages: [...languages, lang] })
    }
  }

  function cycleSave(statKey) {
    const cur = saves[statKey]
    const idx = SAVE_STATES.indexOf(cur)
    const next = SAVE_STATES[(idx + 1) % SAVE_STATES.length]
    onChange({ saves: { ...saves, [statKey]: next } })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-display text-codex-text">Vitals</h2>
        <p className="text-sm text-codex-subtext mt-1">Your class sets your starting HP and saves. Languages scale with INT.</p>
      </div>

      {/* HP */}
      <div className="bg-codex-surface border border-emerald-500/30 rounded-xl p-4">
        <div className="text-xs font-semibold text-codex-subtext uppercase tracking-wider mb-1">Starting HP</div>
        <div className="text-4xl font-bold text-emerald-400">{hp}</div>
        {cls && (
          <div className="text-xs text-codex-muted mt-1">
            Fixed for {cls.id} · Hit Die: {cls.hitDie}
          </div>
        )}
      </div>

      {/* Saves */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold text-codex-subtext uppercase tracking-wider">Saving Throws</span>
          <span className="text-xs text-codex-muted">Auto-set by class · click to adjust</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {STAT_KEYS.map(key => {
            const state = saves[key]
            return (
              <div key={key} className="flex flex-col items-center gap-1.5">
                <span className="text-xs text-codex-muted">{STAT_LABELS[key]}</span>
                <button onClick={() => cycleSave(key)}
                  title="Click to cycle: Normal → Advantage → Disadvantage"
                  className={`w-full py-2 rounded-lg border font-semibold text-sm transition-all ${SAVE_COLORS[state]}`}>
                  {SAVE_ICONS[state]}
                </button>
                <span className={`text-[9px] ${state !== 'none' ? 'text-codex-text' : 'text-codex-muted'}`}>
                  {state === 'none' ? 'Normal' : state === 'advantage' ? 'Adv.' : 'Dis.'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Languages */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-codex-subtext uppercase tracking-wider">Languages Known</span>
          <span className={`text-xs font-bold ${languages.length >= maxLanguages ? 'text-emerald-400' : 'text-codex-gold'}`}>
            {languages.length} / {maxLanguages}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_LANGUAGES.map(lang => {
            const isCommon = lang === 'Common'
            const isActive = languages.includes(lang)
            const canAdd   = !isActive && languages.length < maxLanguages
            return (
              <button key={lang} onClick={() => toggleLanguage(lang)}
                disabled={isCommon || (!isActive && !canAdd)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isCommon   ? 'border-codex-border bg-codex-surface text-codex-subtext cursor-default'
                  : isActive ? 'border-emerald-500 bg-emerald-900/20 text-emerald-400'
                  : canAdd   ? 'border-codex-border bg-codex-surface text-codex-muted hover:border-emerald-500/50'
                  :            'border-codex-border bg-codex-surface text-codex-muted opacity-40 cursor-not-allowed'
                }`}>
                {lang}{isCommon && <span className="ml-1 opacity-60">✓</span>}
              </button>
            )
          })}
        </div>
        {intMod > 0 && (
          <p className="text-xs text-codex-muted">
            Your INT (+{intMod}) grants {intMod} additional language{intMod !== 1 ? 's' : ''} beyond Common.
          </p>
        )}
        {data.ancestry === 'Human' && intMod <= 0 && (
          <p className="text-xs text-codex-muted">Tenacious grants you one additional language beyond Common.</p>
        )}
      </div>

      <div className="h-px bg-codex-border" />

      {/* Speed, Size, Inventory */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-codex-surface border border-codex-border rounded-xl p-3">
          <div className="text-xs font-semibold text-codex-subtext mb-2">Speed</div>
          <input type="number" value={data.speed ?? 6} onChange={e => onChange({ speed: Number(e.target.value) })}
            className="bg-codex-card border border-codex-border rounded-lg px-2 py-1.5 text-codex-text text-sm text-center focus:outline-none focus:border-emerald-500 transition-colors w-full" />
          <div className="text-[10px] text-codex-muted mt-1 text-center">squares (default 6)</div>
        </div>
        <div className="bg-codex-surface border border-codex-border rounded-xl p-3">
          <div className="text-xs font-semibold text-codex-subtext mb-2">Size</div>
          <select value={data.size ?? 'Medium'} onChange={e => onChange({ size: e.target.value })}
            className="bg-codex-card border border-codex-border rounded-lg px-2 py-1.5 text-codex-text text-sm focus:outline-none focus:border-emerald-500 transition-colors w-full">
            {SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2 bg-codex-surface border border-codex-border rounded-xl p-3">
          <div className="text-xs font-semibold text-codex-subtext mb-1">Inventory Slots</div>
          <div className="text-center text-2xl font-bold text-codex-text py-1">{10 + (stats.str || 0)}</div>
          <div className="text-[10px] text-codex-muted text-center">10 + STR modifier</div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 8: Legend ───────────────────────────────────────────────────────────

function StepVibe({ data, onChange }) {
  const vibe  = data.vibe || ''
  const count = vibe.length
  const max   = 1000
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-display text-codex-text">The Legend in Your Shadow</h2>
        <p className="text-sm text-codex-subtext mt-2 leading-relaxed italic">
          "What does fate whisper when your name is spoken? Not your history — your essence."
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <textarea value={vibe} onChange={e => { if (e.target.value.length <= max) onChange({ vibe: e.target.value }) }}
          rows={8}
          placeholder="Moves like someone who has already seen how this ends — and came anyway…"
          className="bg-codex-surface border border-codex-border rounded-xl px-4 py-3 text-codex-text text-sm placeholder-codex-muted focus:outline-none focus:border-emerald-500 transition-colors resize-none leading-relaxed"
        />
        <div className="flex justify-end">
          <span className={`text-xs font-medium tabular-nums ${count > max * 0.9 ? 'text-amber-400' : 'text-codex-muted'}`}>
            {count} / {max}
          </span>
        </div>
      </div>
      <div className="rounded-xl border border-codex-border bg-codex-surface p-4 text-xs text-codex-muted leading-relaxed">
        This is your character's aura — not a biography. Write in third person or second. Capture <em className="text-codex-subtext">presence</em>, not history.
      </div>
    </div>
  )
}

// ─── Summary Banner ───────────────────────────────────────────────────────────

function SummaryBanner({ data }) {
  const cls = CLASSES.find(c => c.id === data.class_name)
  return (
    <div className="flex items-center gap-3 bg-codex-surface border border-emerald-500/20 rounded-xl px-4 py-3 mb-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-codex-text truncate">{data.name || '—'}</div>
        <div className="text-xs text-codex-subtext mt-0.5">
          {data.ancestry && <span>{data.ancestry} · </span>}
          {data.class_name && <span>{data.class_name}</span>}
          {cls && <span className="text-codex-muted"> · {cls.hitDie} · HP {cls.startingHP}</span>}
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {STAT_KEYS.map(k => (
          <div key={k} className="flex flex-col items-center">
            <span className="text-[9px] text-codex-muted">{STAT_LABELS[k]}</span>
            <span className={`text-xs font-bold ${(data.stats?.[k] || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtMod(data.stats?.[k] || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function NimbleWizard({ onComplete, onCancel, initialData, isEditMode = false }) {
  const [step, setStep] = useState(1)
  const totalSteps = 9

  const [data, setData] = useState(() => initialData ? {
    name:         initialData.name        ?? '',
    nickname:     initialData.nickname    ?? '',
    ancestry:     initialData.ancestry    ?? '',
    class_name:   initialData.class_name  ?? '',
    hit_dice:     initialData.hit_dice    ?? 'd8',
    _arrayId:     'custom',
    _assignments: { str: null, dex: null, int: null, wil: null },
    _customRaw:   initialData.stats       ?? { str: 0, dex: 0, int: 0, wil: 0 },
    _humanBonus:  null,
    stats:        initialData.stats       ?? { str: 0, dex: 0, int: 0, wil: 0 },
    _skillBonuses: {},
    _spellSchool2: '',
    gearMode:  'class_gear',
    weapons:   initialData.weapons   ?? [],
    armor:     initialData.armor     ?? null,
    shield:    initialData.shield    ?? null,
    equipment: initialData.equipment ?? [],
    saves:     initialData.saves     ?? { str: 'none', dex: 'none', int: 'none', wil: 'none' },
    languages: initialData.languages ?? ['Common'],
    hp_max:    initialData.hp_max    ?? 0,
    hp_current: initialData.hp_current ?? 0,
    speed:  initialData.speed  ?? 6,
    size:   initialData.size   ?? 'Medium',
    gold:   initialData.gold   ?? 0,
    silver: initialData.silver ?? 0,
    copper: initialData.copper ?? 0,
    vibe:   initialData.vibe   ?? '',
  } : {
    name: '', nickname: '',
    ancestry: '',
    class_name: '', hit_dice: 'd8',
    _arrayId: null,
    _assignments: { str: null, dex: null, int: null, wil: null },
    _customRaw: { str: 0, dex: 0, int: 0, wil: 0 },
    _humanBonus: null,
    stats: { str: 0, dex: 0, int: 0, wil: 0 },
    _skillBonuses: {},
    _spellSchool2: '',
    gearMode:  'class_gear',
    weapons:   [],
    armor:     null,
    shield:    null,
    equipment: [],
    saves: { str: 'none', dex: 'none', int: 'none', wil: 'none' },
    languages:  ['Common'],
    hp_max: 0, hp_current: 0,
    speed: 6, size: 'Medium',
    gold: 0, silver: 0, copper: 0,
    vibe: '',
  })

  const merge = useCallback(patch => {
    setData(prev => ({ ...prev, ...patch }))
  }, [])

  function canProceed() {
    switch (step) {
      case 1: return data.name.trim().length > 0
      case 2: return Boolean(data.ancestry)
      case 3: return Boolean(data.class_name)
      case 4: {
        if (!data._arrayId) return false
        if (data._arrayId === 'custom') return true
        return STAT_KEYS.every(k => data._assignments[k] !== null && data._assignments[k] !== undefined)
      }
      case 6: {
        // Songweaver must choose a second spell school
        const config = CASTER_CONFIG[data.class_name]
        if (config && config.schoolChoice) return Boolean(data._spellSchool2)
        return true
      }
      default: return true
    }
  }

  function buildSheetData() {
    const stats        = data.stats
    const skillBonuses = data._skillBonuses || {}
    const statForSkill = {}
    SKILL_GROUPS.forEach(g => g.skills.forEach(s => { statForSkill[s] = g.stat }))
    const allSkillKeys = SKILL_GROUPS.flatMap(g => g.skills)
    const skills = {}
    allSkillKeys.forEach(skill => {
      skills[skill] = (stats[statForSkill[skill]] || 0) + (skillBonuses[skill] || 0)
    })

    const cls    = CLASSES.find(c => c.id === data.class_name)
    const hp     = cls ? cls.startingHP : (data.hp_max || 0)
    const config = CASTER_CONFIG[data.class_name]

    // Build starting spell list
    let startingSpells = []
    if (config) {
      const cantripList = [
        ...config.autoCantrips,
        ...(config.schoolChoice && data._spellSchool2
          ? (CANTRIPS_BY_SCHOOL[data._spellSchool2] || []).filter(n => !config.autoCantrips.includes(n))
          : [])
      ]
      startingSpells = [
        ...cantripList.map(n => SPELL_BY_NAME[n]).filter(Boolean),
        ...config.autoTier1.map(n => SPELL_BY_NAME[n]).filter(Boolean),
      ]
    }

    // Mana pool at level 1
    let mana_max = 0
    if (config?.manaL1) {
      if (config.manaFormula === 'WIL + Level')       mana_max = (stats.wil || 0) + 1
      if (config.manaFormula === '(INT×3) + Level')   mana_max = ((stats.int || 0) * 3) + 1
      if (config.manaFormula === '(WIL×3) + Level')   mana_max = ((stats.wil || 0) * 3) + 1
    }

    return {
      name:           data.name.trim(),
      nickname:       data.nickname.trim(),
      ancestry:       data.ancestry,
      class_name:     data.class_name,
      hit_dice:       data.hit_dice || 'd8',
      hit_die_count:  1,
      level:          1,
      stats,
      saves:          data.saves || { str: 'none', dex: 'none', int: 'none', wil: 'none' },
      skills,
      languages:      data.languages || ['Common'],
      hp_max:         hp,
      hp_current:     hp,
      wounds_current: 0,
      speed:          data.speed ?? 6,
      size:           data.size  ?? 'Medium',
      initiative:     'DEX',
      spells:         startingSpells,
      mana_max,
      mana_current:   mana_max,
      weapons:        data.weapons   || [],
      armor:          data.armor     || null,
      shield:         data.shield    || null,
      equipment:      data.equipment || [],
      gold:           data.gearMode === 'buy_gear' ? 50 : 0,
      silver:         0,
      copper:         0,
      abilities:      [
        // Level 1 class features
        ...(CLASS_FEATURES[data.class_name] || []).map(f => ({
          name:        f.name,
          source:      'Class',
          description: f.description,
        })),
        // Ancestry trait
        ...(() => {
          const anc = ANCESTRIES.find(a => a.id === data.ancestry)
          if (!anc || anc.id === 'Exotic / Other') return []
          return [{ name: `${anc.trait} (${anc.id})`, source: 'Ancestry', description: anc.description }]
        })(),
      ],
      notes:          '',
      vibe:           data.vibe,
    }
  }

  function handleNext() {
    if (step < totalSteps) setStep(s => s + 1)
    else onComplete(buildSheetData())
  }

  function handleBack() {
    if (step > 1) setStep(s => s - 1)
  }

  function renderStep() {
    switch (step) {
      case 1: return <StepIdentity data={data} onChange={merge} />
      case 2: return <StepAncestry data={data} onChange={merge} />
      case 3: return <StepClass    data={data} onChange={merge} />
      case 4: return <StepStats    data={data} onChange={merge} />
      case 5: return <StepSkills   data={data} onChange={merge} />
      case 6: return <StepSpells   data={data} onChange={merge} />
      case 7: return <StepGear     data={data} onChange={merge} />
      case 8: return <StepVitals   data={data} onChange={merge} />
      case 9: return (<><SummaryBanner data={data} /><StepVibe data={data} onChange={merge} /></>)
      default: return null
    }
  }

  const proceed = canProceed()
  const isFinal = step === totalSteps

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 bg-codex-card border border-codex-border rounded-2xl overflow-hidden shadow-2xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-60" />
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div>
            <h1 className="text-lg font-display text-codex-text">
              Nimble RPG — {isEditMode ? 'Edit Character' : 'Character Creation'}
            </h1>
            <p className="text-xs text-codex-subtext mt-0.5">Step {step} of {totalSteps}</p>
          </div>
          <button onClick={onCancel}
            className="text-codex-muted hover:text-codex-text transition-colors p-1.5 rounded-lg hover:bg-codex-surface" title="Cancel">
            <svg viewBox="0 0 14 14" className="w-4 h-4 fill-current">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </div>
        <ProgressBar step={step} totalSteps={totalSteps} />
        <div className="h-px bg-codex-border mx-6" />
        <div className="px-6 py-6">{renderStep()}</div>
        <div className="px-6 pb-6 flex items-center gap-3">
          <button onClick={handleBack} disabled={step === 1}
            className="px-5 py-2.5 rounded-xl border border-codex-border text-codex-subtext text-sm font-medium hover:border-codex-text hover:text-codex-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            Back
          </button>
          <div className="flex-1" />
          <button onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-codex-border text-codex-subtext text-sm font-medium hover:border-red-500/50 hover:text-red-400 transition-colors">
            Cancel
          </button>
          <button onClick={handleNext} disabled={!proceed}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isFinal ? 'bg-codex-gold hover:bg-codex-goldHover text-codex-bg shadow-glow'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}>
            {isFinal ? (isEditMode ? 'Save Changes' : 'Forge Your Legend') : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
