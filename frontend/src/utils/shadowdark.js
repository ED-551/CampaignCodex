/**
 * Shadowdark RPG core equipment tables.
 * Source: Shadowdark RPG V4-9 core rulebook.
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a cost to gold pieces (fractional for sp/cp) */
export function toGP(cost, unit) {
  if (unit === 'gp') return cost
  if (unit === 'sp') return cost / 10
  if (unit === 'cp') return cost / 100
  return cost
}

/** Human-readable cost string */
export function fmtCost(cost, unit) { return `${cost} ${unit}` }

/** Format a GP amount with appropriate denomination */
export function fmtGP(gp) {
  if (gp === 0) return '0 gp'
  if (Number.isInteger(gp)) return `${gp} gp`
  const sp = Math.round(gp * 10)
  if (Math.abs(gp - sp / 10) < 0.001) return `${sp} sp`
  return `${gp.toFixed(2)} gp`
}

// ─── Weapons ─────────────────────────────────────────────────────────────────
// 15 core weapons from the rulebook.
// cost / costUnit: from the weapons table (pg. 37).
// stat: 'str' | 'dex' | 'finesse'

export const SD_WEAPONS = {
  // ── Melee — STR ──────────────────────────────────────────────
  'bastard sword': { damage: '1d8',  stat: 'str', slots: 2, cost: 10, costUnit: 'gp', notes: 'Versatile (1d10 two-handed)' },
  club:            { damage: '1d4',  stat: 'str', slots: 1, cost: 5,  costUnit: 'cp', notes: '' },
  greataxe:        { damage: '1d8',  stat: 'str', slots: 2, cost: 10, costUnit: 'gp', notes: 'Versatile (1d10 two-handed)' },
  greatsword:      { damage: '1d12', stat: 'str', slots: 2, cost: 12, costUnit: 'gp', notes: 'Two-handed' },
  javelin:         { damage: '1d4',  stat: 'str', slots: 1, cost: 5,  costUnit: 'sp', notes: 'Thrown, Close/Far' },
  longsword:       { damage: '1d8',  stat: 'str', slots: 1, cost: 9,  costUnit: 'gp', notes: '' },
  mace:            { damage: '1d6',  stat: 'str', slots: 1, cost: 5,  costUnit: 'gp', notes: '' },
  shortsword:      { damage: '1d6',  stat: 'str', slots: 1, cost: 7,  costUnit: 'gp', notes: '' },
  spear:           { damage: '1d6',  stat: 'str', slots: 1, cost: 5,  costUnit: 'sp', notes: 'Thrown, Close/Near' },
  staff:           { damage: '1d4',  stat: 'str', slots: 1, cost: 5,  costUnit: 'sp', notes: 'Two-handed' },
  warhammer:       { damage: '1d10', stat: 'str', slots: 1, cost: 10, costUnit: 'gp', notes: 'Two-handed' },
  // ── Melee — Finesse ──────────────────────────────────────────
  dagger:          { damage: '1d4',  stat: 'finesse', slots: 1, cost: 1, costUnit: 'gp', notes: 'Finesse, Thrown Close/Near' },
  // ── Ranged — DEX ─────────────────────────────────────────────
  crossbow:        { damage: '1d6',  stat: 'dex', slots: 1, cost: 8,  costUnit: 'gp', notes: 'Two-handed, Loading' },
  longbow:         { damage: '1d8',  stat: 'dex', slots: 1, cost: 8,  costUnit: 'gp', notes: 'Two-handed, Far' },
  shortbow:        { damage: '1d4',  stat: 'dex', slots: 1, cost: 6,  costUnit: 'gp', notes: 'Two-handed, Far' },
}

// ─── Armor ────────────────────────────────────────────────────────────────────

export const SD_ARMOR = {
  leather:   { label: 'Leather armor', ac: 11, dexBonus: true,  slots: 1, isShield: false, cost: 10,  costUnit: 'gp', notes: '' },
  chainmail: { label: 'Chainmail',     ac: 13, dexBonus: true,  slots: 2, isShield: false, cost: 60,  costUnit: 'gp', notes: 'Disadv. stealth & swim' },
  plate:     { label: 'Plate mail',    ac: 15, dexBonus: false, slots: 3, isShield: false, cost: 130, costUnit: 'gp', notes: 'No swim, disadv. stealth' },
  shield:    { label: 'Shield',        ac: 2,  dexBonus: false, slots: 1, isShield: true,  cost: 10,  costUnit: 'gp', notes: 'Occupies one hand' },
}

// ─── Basic Gear Shop ──────────────────────────────────────────────────────────
// From the Basic Gear table (pg. 34).
// type 'arrows' / 'bolts' are tracked separately as ammo counters.

export const SD_BASIC_GEAR = [
  { item: 'Arrows (20)',          cost: 1,  costUnit: 'gp', slots: 1, type: 'arrows'  },
  { item: 'Backpack',            cost: 2,  costUnit: 'gp', slots: 0                  },  // 0 slots when worn
  { item: 'Caltrops (one bag)',  cost: 5,  costUnit: 'sp', slots: 1                  },
  { item: 'Crossbow bolts (20)', cost: 1,  costUnit: 'gp', slots: 1, type: 'bolts'   },
  { item: 'Crowbar',             cost: 5,  costUnit: 'sp', slots: 1                  },
  { item: 'Flask or bottle',     cost: 3,  costUnit: 'sp', slots: 1                  },
  { item: 'Flint and steel',     cost: 5,  costUnit: 'sp', slots: 1                  },
  { item: 'Grappling hook',      cost: 1,  costUnit: 'gp', slots: 1                  },
  { item: 'Iron spikes (10)',    cost: 1,  costUnit: 'gp', slots: 1                  },
  { item: 'Lantern',             cost: 5,  costUnit: 'gp', slots: 1                  },
  { item: 'Mirror',              cost: 10, costUnit: 'gp', slots: 1                  },
  { item: 'Oil, flask',          cost: 5,  costUnit: 'sp', slots: 1                  },
  { item: 'Pole',                cost: 5,  costUnit: 'sp', slots: 1                  },
  { item: 'Rations (3)',         cost: 5,  costUnit: 'sp', slots: 1                  },
  { item: "Rope, 60'",           cost: 1,  costUnit: 'gp', slots: 1                  },
  { item: 'Torch',               cost: 5,  costUnit: 'sp', slots: 1                  },
]

// ─── 0-Level Starting Kit ─────────────────────────────────────────────────────
// d12 gear table for 0-level characters (pg. 33).
// Players roll 1d4 to determine how many items they get.

export const SD_STARTING_GEAR_D12 = [
  'Torch',
  'Dagger',
  'Pole',
  'Shortbow and 5 arrows',
  "Rope, 60'",
  'Oil, flask',
  'Crowbar',
  'Iron spikes (10)',
  'Flint and steel',
  'Grappling hook',
  'Club',
  'Caltrops (one bag)',
]

// ─── Crawling Kit ─────────────────────────────────────────────────────────────
// Pre-bundled kit (pg. 34): 7 gp, 7 slots.

export const SD_CRAWLING_KIT = {
  cost:  7,
  slots: 7,
  items: [
    { item: 'Backpack',         slots: 0 },
    { item: 'Flint and steel',  slots: 1 },
    { item: 'Torch',            slots: 1 },
    { item: 'Torch',            slots: 1 },
    { item: 'Rations (3)',      slots: 1 },
    { item: 'Iron spikes (10)', slots: 1 },
    { item: 'Grappling hook',   slots: 1 },
    { item: "Rope, 60'",        slots: 1 },
  ],
}

// ─── Languages ────────────────────────────────────────────────────────────────

export const SD_LANGUAGES = {
  common: ['Common','Dwarvish','Elvish','Giant','Goblin','Merran','Orcish','Reptilian','Sylvan','Thanian'],
  rare:   ['Celestial','Diabolic','Draconic','Primordial'],
}

// ─── AC Calculator ───────────────────────────────────────────────────────────

export function computeAC(gear, dexScore) {
  const dexMod = Math.floor((Number(dexScore ?? 10) - 10) / 2)
  let baseAC      = 10 + dexMod
  let shieldBonus = 0
  for (const g of gear) {
    if (g.type !== 'armor' || !g.equipped) continue
    const key = Object.keys(SD_ARMOR).find(
      k => SD_ARMOR[k].label.toLowerCase() === (g.item ?? '').toLowerCase()
    )
    if (!key) continue
    const armor = SD_ARMOR[key]
    if (armor.isShield) { shieldBonus = armor.ac }
    else { baseAC = armor.dexBonus ? armor.ac + dexMod : armor.ac }
  }
  return baseAC + shieldBonus
}

// ─── Detection Helpers ────────────────────────────────────────────────────────

export function detectWeapon(itemStr) {
  const normalized = String(itemStr).toLowerCase().replace(/[^a-z\s]/g, ' ')
  const sorted = Object.entries(SD_WEAPONS).sort((a, b) => b[0].length - a[0].length)
  for (const [key, data] of sorted) {
    if (normalized.includes(key)) return { key, ...data }
  }
  return null
}

export function detectArmor(itemStr) {
  const norm = String(itemStr).toLowerCase().replace(/\s+/g, '')
  for (const [key, a] of Object.entries(SD_ARMOR)) {
    const labelNorm = a.label.toLowerCase().replace(/\s+/g, '')
    if (norm.includes(labelNorm) || norm.includes(key)) return key
  }
  return null
}

// ─── Attack Builders ─────────────────────────────────────────────────────────

export function weaponToAttack(weapon, stats = {}) {
  const strMod = Math.floor((Number(stats.str ?? 10) - 10) / 2)
  const dexMod = Math.floor((Number(stats.dex ?? 10) - 10) / 2)
  let mod
  if      (weapon.stat === 'str')     mod = strMod
  else if (weapon.stat === 'dex')     mod = dexMod
  else /* finesse */                  mod = Math.max(strMod, dexMod)
  const bonus = mod >= 0 ? `+${mod}` : `${mod}`
  const name  = weapon.key.replace(/\b\w/g, c => c.toUpperCase())
  return { weapon: name, bonus, damage: weapon.damage, notes: weapon.notes }
}

export function gearToAttacks(gearList, stats = {}, existingAttacks = []) {
  const taken = new Set(existingAttacks.map(a => (a.weapon ?? '').toLowerCase()))
  const result = []
  for (const entry of gearList) {
    const itemStr = typeof entry === 'string' ? entry : entry.item
    if (!itemStr) continue
    const w = detectWeapon(itemStr)
    if (!w) continue
    const atk = weaponToAttack(w, stats)
    if (taken.has(atk.weapon.toLowerCase())) continue
    taken.add(atk.weapon.toLowerCase())
    result.push(atk)
  }
  return result
}

// ─── Spell Data ───────────────────────────────────────────────────────────────
// Source: Shadowdark RPG V4-9 core rulebook (Wizard pg.52, Priest pg.51)
//         Necromancer Playtest PDF.
// classes: which class lists include this spell (same tier across all).
// Shared spells (e.g. Light, Speak With Dead) appear once with classes: [...]

export const SD_SPELLS = {
  // ── Tier 1 ──────────────────────────────────────────────────────────────────
  'Alarm':            { tier:1, classes:['Wizard'],                         duration:'1 day',    range:'Close',     description:'Touch one object to set a magical alarm. If any creature you didn\'t designate touches or crosses past it, a magical bell sounds in your head.' },
  'Burning Hands':    { tier:1, classes:['Wizard'],                         duration:'Instant',  range:'Close',     description:'You spread your fingers and unleash a circle of flame around you. Creatures in the area take 1d6 damage; flammable objects catch fire.' },
  'Charm Person':     { tier:1, classes:['Wizard'],                         duration:'1d8 days', range:'Near',      description:'One humanoid of LV 2 or less regards you as a friend for the duration. The spell ends if you hurt it. The target knows it was enchanted after the spell ends.' },
  'Cure Wounds':      { tier:1, classes:['Priest'],                         duration:'Instant',  range:'Close',     description:'Your touch restores ebbing life. Roll d6s equal to 1 + half your level (round down). One creature you touch regains that many HP.' },
  'Detect Magic':     { tier:1, classes:['Wizard'],                         duration:'Focus',    range:'Near',      description:'You sense the presence of magic within near range. Focus for two rounds to discern its general properties. Full barriers block this spell.' },
  'Feather Fall':     { tier:1, classes:['Wizard'],                         duration:'Instant',  range:'Self',      description:'Cast when you fall. Your rate of descent slows so that you land safely on your feet.' },
  'First Gate':       { tier:1, classes:['Necromancer'],                    duration:'Instant',  range:'Close',     description:'Target a living creature of LV 2 or less, or an undead of LV 4 or less. The creature falls into a deep sleep; being injured wakes it.' },
  'Floating Disk':    { tier:1, classes:['Wizard'],                         duration:'10 rounds',range:'Near',      description:'A floating circular disk of force can carry up to 20 gear slots. It hovers at waist level and stays within near of you automatically.' },
  'Hold Portal':      { tier:1, classes:['Wizard'],                         duration:'10 rounds',range:'Near',      description:'You magically hold a portal closed. A creature must pass a STR check vs. your spellcasting check to open it. The knock spell ends this spell.' },
  'Holy Weapon':      { tier:1, classes:['Priest'],                         duration:'5 rounds', range:'Close',     description:'One weapon you touch becomes magical with +1 to attack and damage rolls for the duration.' },
  'Light':            { tier:1, classes:['Wizard','Priest'],                 duration:'1 hour',   range:'Close',     description:'One object you touch glows with bright, heatless light illuminating out to a near distance for 1 hour of real time.' },
  'Mage Armor':       { tier:1, classes:['Wizard'],                         duration:'10 rounds',range:'Self',      description:'An invisible layer of magical force protects your vitals. Your AC becomes 14 (18 on a critical spellcasting check) for the duration.' },
  'Magic Missile':    { tier:1, classes:['Wizard'],                         duration:'Instant',  range:'Far',       description:'You have advantage on your check to cast this spell. A glowing bolt of force deals 1d4 damage to one target.' },
  'Protection From Evil': { tier:1, classes:['Wizard','Priest','Necromancer'], duration:'Focus', range:'Close',     description:'Chaotic beings have disadvantage on attacks and hostile spellcasting against the target and can\'t possess, compel, or beguile it. Cast on a possessed target, the entity makes a CHA check vs. your check — failure expels it.' },
  'Seal Soul':        { tier:1, classes:['Necromancer'],                    duration:'Permanent',range:'Close',     description:'One dead body you touch becomes sealed against necromantic energy. It cannot be used to create undead or be possessed by a dead spirit.' },
  'Shield of Faith':  { tier:1, classes:['Priest'],                         duration:'5 rounds', range:'Self',      description:'A protective force wrought of your holy conviction surrounds you. You gain +2 to your armor class for the duration.' },
  'Sleep':            { tier:1, classes:['Wizard'],                         duration:'Instant',  range:'Near',      description:'You weave a lulling spell. Living creatures of LV 2 or less in a near-sized cube from you fall into a deep sleep. Vigorous shaking or injury wakes them.' },
  'Turn Undead':      { tier:1, classes:['Priest','Necromancer'],           duration:'Instant',  range:'Near',      description:'Undead within near make a CHA check vs. your spellcasting check. Failure by 10+ destroys them if equal to or lower than your level; otherwise they flee for 5 rounds. You must present a holy symbol.' },
  'Undeath':          { tier:1, classes:['Necromancer'],                    duration:'5 rounds', range:'Close',     description:'Humanoid remains you touch rise as a zombie or skeleton under your control. You can only have one such undead at a time. When the spell ends, it collapses into grave dust.' },
  'Withermark':       { tier:1, classes:['Necromancer'],                    duration:'Instant',  range:'Far',       description:'You fling a dark rune of necrotic energy at a target. It takes 1d4 damage (2d4 at 5th level). Undead are unharmed by this spell.' },

  // ── Tier 2 ──────────────────────────────────────────────────────────────────
  'Acid Arrow':       { tier:2, classes:['Wizard'],                         duration:'Focus',    range:'Far',       description:'A corrosive bolt hits one foe, dealing 1d6 damage per round. The bolt remains for as long as you focus.' },
  'Alter Self':       { tier:2, classes:['Wizard'],                         duration:'5 rounds', range:'Self',      description:'You gain one feature modifying your existing anatomy (e.g. gills, bear claws). This spell can\'t grow wings or new limbs.' },
  'Augury':           { tier:2, classes:['Priest'],                         duration:'Instant',  range:'Self',      description:'Ask the GM one question about a specific course of action. The GM says whether it leads to "weal" or "woe."' },
  'Bane':             { tier:2, classes:['Necromancer'],                    duration:'5 rounds', range:'Close',     description:'One weapon you touch is empowered with necrotic energy, dealing +1d6 damage against living creatures for the duration.' },
  'Bless':            { tier:2, classes:['Priest'],                         duration:'Instant',  range:'Close',     description:'One creature you touch gains a luck token.' },
  'Blind/Deafen':     { tier:2, classes:['Priest'],                         duration:'Focus',    range:'Near',      description:'You utter a divine censure, blinding or deafening one creature you can see. The creature has disadvantage on tasks requiring the lost sense.' },
  'Cleansing Weapon': { tier:2, classes:['Priest'],                         duration:'5 rounds', range:'Close',     description:'One weapon you touch is wreathed in purifying flames, dealing +1d4 damage (+1d6 vs. undead) for the duration.' },
  'Command Undead':   { tier:2, classes:['Necromancer'],                    duration:'Focus',    range:'Far',       description:'Issue a one-word command to one undead of LV 5 or less in range (e.g. "stop"). It obeys for as long as you focus.' },
  'Detect Thoughts':  { tier:2, classes:['Wizard'],                         duration:'Focus',    range:'Near',      description:'You learn the immediate thoughts of one creature you can see each round. On its turn it makes a WIS check vs. your check — success reveals your presence and ends the spell.' },
  'Final Toll':       { tier:2, classes:['Necromancer'],                    duration:'Instant',  range:'Close',     description:'One undead you touch of LV 2 or less instantly crumbles to dust.' },
  'Fixed Object':     { tier:2, classes:['Wizard'],                         duration:'5 rounds', range:'Close',     description:'An object of 5 lbs or less you touch becomes fixed in its current location, supporting up to 5,000 lbs for the duration.' },
  'Ghoul Touch':      { tier:2, classes:['Necromancer'],                    duration:'Instant',  range:'Close',     description:'A living creature takes 1d6 damage. If it is LV 4 or less, it becomes paralyzed for 1d4 rounds.' },
  'Hold Person':      { tier:2, classes:['Wizard'],                         duration:'Focus',    range:'Near',      description:'You magically paralyze one humanoid of LV 4 or less you can see within range.' },
  'Invisibility':     { tier:2, classes:['Wizard'],                         duration:'10 rounds',range:'Close',     description:'A creature you touch becomes invisible for the duration. The spell ends if the target attacks or casts a spell.' },
  'Knock':            { tier:2, classes:['Wizard'],                         duration:'Instant',  range:'Near',      description:'A door, window, gate, chest, or portal in range opens instantly, defeating all mundane locks. Creates a loud knock audible to all within earshot.' },
  'Lamentation':      { tier:2, classes:['Necromancer'],                    duration:'Focus',    range:'Near',      description:'You sing a death dirge about one creature equal to or lower than your level. It can\'t act on its turn unless it passes a CHA check vs. your last spellcasting check.' },
  'Levitate':         { tier:2, classes:['Wizard'],                         duration:'Focus',    range:'Self',      description:'You can float a near distance vertically per round and push against solid objects to move horizontally.' },
  'Mirror Image':     { tier:2, classes:['Wizard'],                         duration:'5 rounds', range:'Self',      description:'Illusory duplicates equal to half your level (min. 1) surround you. Each attack that hits you misses and destroys one duplicate instead.' },
  'Misty Step':       { tier:2, classes:['Wizard'],                         duration:'Instant',  range:'Self',      description:'In a puff of smoke, you teleport a near distance to an area you can see.' },
  'Second Gate':      { tier:2, classes:['Necromancer'],                    duration:'Focus',    range:'Near',      description:'You render one creature mute for the duration — it can\'t speak and has disadvantage on spellcasting checks. Alternatively, restore lost speech or thought to one creature in range.' },
  'Silence':          { tier:2, classes:['Wizard'],                         duration:'Focus',    range:'Far',       description:'Sound is magically muted in a near cube within range. Creatures inside are deafened; sounds they create can\'t be heard outside.' },
  'Smite':            { tier:2, classes:['Priest'],                         duration:'Instant',  range:'Near',      description:'You call down punishing flames on a creature you can see within range. It takes 1d6 damage.' },
  'Web':              { tier:2, classes:['Wizard'],                         duration:'5 rounds', range:'Far',       description:'A near-sized cube of sticky spider web fills the area. Creatures stuck in the web can\'t move and must pass a STR check vs. your check to free themselves.' },
  'Zone of Truth':    { tier:2, classes:['Priest'],                         duration:'Focus',    range:'Near',      description:'A creature you can see can\'t utter a deliberate lie while within range.' },

  // ── Tier 3 ──────────────────────────────────────────────────────────────────
  'Animate Dead':     { tier:3, classes:['Wizard','Necromancer'],            duration:'1 day',    range:'Close',     description:'Humanoid remains with at least three limbs and a head rise as a zombie or skeleton under your control, acting on your turn. After 1 day it collapses into grave dust.' },
  'Command':          { tier:3, classes:['Priest'],                          duration:'Focus',    range:'Far',       description:'Issue a one-word verbal command to one creature in range that understands you (e.g. "kneel"). It obeys for as long as you focus. If directly harmful it makes a CHA check vs. your check to end the spell.' },
  'Dispel Magic':     { tier:3, classes:['Wizard'],                          duration:'Instant',  range:'Near',      description:'End one spell affecting one target you can see in range.' },
  'Drain Life':       { tier:3, classes:['Necromancer'],                     duration:'Instant',  range:'Close',     description:'A living creature you touch takes 2d6 damage. You regain HP equal to half the damage dealt (round down). Targeting an undead reverses the effect.' },
  'Fabricate':        { tier:3, classes:['Wizard'],                          duration:'10 rounds',range:'Near',      description:'You turn a tree-sized collection of raw materials into a finished work (e.g. bricks into a bridge). The work reverts to raw materials when the spell ends. This spell can\'t target creatures.' },
  'Fireball':         { tier:3, classes:['Wizard'],                          duration:'Instant',  range:'Far',       description:'A small flame erupts into a fiery blast. All creatures in a near-sized cube around where the flame lands take 4d6 damage.' },
  'Fly':              { tier:3, classes:['Wizard'],                          duration:'5 rounds', range:'Self',      description:'Your feet lift from the ground. You can fly near per round and hover in place for the duration.' },
  'Gaseous Form':     { tier:3, classes:['Wizard'],                          duration:'10 rounds',range:'Self',      description:'You and your gear turn into a cloud of smoke. You can fly and pass through any gap smoke could. You can\'t cast spells in this form.' },
  'Illusion':         { tier:3, classes:['Wizard'],                          duration:'Focus',    range:'Far',       description:'A convincing visible and audible illusion fills up to a near-sized cube. It can\'t cause harm. Creatures must pass a WIS check vs. your check to see through it; touching it also reveals it.' },
  'Lay To Rest':      { tier:3, classes:['Priest','Necromancer'],            duration:'Instant',  range:'Close',     description:'You instantly send an undead of LV 9 or less you touch to its final afterlife, destroying it utterly.' },
  'Lightning Bolt':   { tier:3, classes:['Wizard'],                          duration:'Instant',  range:'Far',       description:'A blue-white ray of lightning hits all creatures in a straight line out to far distance, dealing 3d6 damage each.' },
  'Magic Circle':     { tier:3, classes:['Wizard'],                          duration:'Focus',    range:'Near',      description:'You conjure a circle of runes and name a creature type. Those creatures can\'t attack, cast hostile spells, or beguile anyone inside the circle for the duration.' },
  'Mass Cure':        { tier:3, classes:['Priest'],                          duration:'Instant',  range:'Near',      description:'All allies within near range of you regain 2d6 hit points.' },
  'Protection From Energy': { tier:3, classes:['Wizard'],                   duration:'Focus',    range:'Close',     description:'One creature you touch is immune to harm from one chosen energy type (fire, cold, or electricity) for the duration.' },
  'Reap The Soul':    { tier:3, classes:['Necromancer'],                     duration:'Instant',  range:'Near',      description:'You draw life force from one creature killed within the last round. You gain HP and a bonus to your next attack roll or spellcasting check equal to the target\'s level.' },
  'Rebuke Unholy':    { tier:3, classes:['Priest'],                          duration:'Instant',  range:'Near',      description:'You rebuke creatures opposing your alignment (demons/devils for lawful/neutral; angels/wild creatures for chaotic), forcing them to flee. Failure by 10+ and equal to or lower than your level: destroyed.' },
  'Restoration':      { tier:3, classes:['Priest'],                          duration:'Instant',  range:'Close',     description:'One curse, illness, or affliction of your choice affecting the target creature ends.' },
  'Sending':          { tier:3, classes:['Wizard'],                          duration:'Instant',  range:'Unlimited', description:'You send a brief mental message to any creature you are familiar with on the same plane.' },
  'Speak With Dead':  { tier:3, classes:['Wizard','Priest','Necromancer'],   duration:'Instant',  range:'Close',     description:'A dead body you touch answers up to three yes-or-no questions in a wheezing voice. Cast more than once in 24 hours: treat a failed check as a critical failure.' },
  'Third Gate':       { tier:3, classes:['Necromancer'],                     duration:'Instant',  range:'Near',      description:'You read the mind of a creature within range, learning one memory of your choosing. Alternatively, permanently erase one memory of a creature within range.' },

  // ── Tier 4 ──────────────────────────────────────────────────────────────────
  'Arcane Eye':       { tier:4, classes:['Wizard'],                          duration:'Focus',    range:'Near',      description:'An invisible eye conjured within range lets you see in darkness out to near, fly near per turn, and squeeze through keyholes.' },
  'Ashes To Ashes':   { tier:4, classes:['Necromancer'],                     duration:'Focus',    range:'Near',      description:'A living creature of LV 5 or less begins crumbling into ash. Focus for 3 consecutive rounds and the target dies and crumbles.' },
  'Cloudkill':        { tier:4, classes:['Wizard'],                          duration:'5 rounds', range:'Far',       description:'A putrid yellow poison cloud fills a near cube. Creatures inside are blinded and take 2d6 damage at the start of their turns. A creature of LV 9 or less that ends its turn fully inside dies.' },
  'Commune':          { tier:4, classes:['Priest'],                          duration:'Instant',  range:'Self',      description:'You seek your god\'s counsel. Ask the GM up to three yes-or-no questions; they answer truthfully. Cast more than once in 24 hours: treat failure as a critical failure.' },
  'Confusion':        { tier:4, classes:['Wizard'],                          duration:'Focus',    range:'Near',      description:'One creature can\'t take actions and moves randomly on its turn. LV 9+ may make a WIS check vs. your check at the start of its turns to end the spell.' },
  'Control Water':    { tier:4, classes:['Wizard','Priest'],                  duration:'Focus',    range:'Far',       description:'You move and shape a section of water up to 100 feet wide and deep, changing its flow, shape, or defying gravity.' },
  'Dimension Door':   { tier:4, classes:['Wizard'],                          duration:'Instant',  range:'Self',      description:'You teleport yourself and up to one willing creature within close to any point you can see.' },
  'Divination':       { tier:4, classes:['Wizard'],                          duration:'Instant',  range:'Self',      description:'You seek a portent from the stars. Ask the GM one yes-or-no question; they answer truthfully. Cast more than once in 24 hours: treat failure as a critical failure.' },
  'Excoriate':        { tier:4, classes:['Necromancer'],                     duration:'Focus',    range:'Near',      description:'You burn the life force away from one living creature, dealing 1d10 damage per round. Undead are healed by this spell instead.' },
  'Flame Strike':     { tier:4, classes:['Priest'],                          duration:'Instant',  range:'Far',       description:'You call down a holy pillar of fire on one creature you can see within range. It takes 2d6 damage.' },
  'Fourth Gate':      { tier:4, classes:['Necromancer'],                     duration:'10 rounds',range:'Close',     description:'Transform a willing creature of LV 10 or less into an undead creature of equal or lower level for the duration. Alternatively, permanently restore a shape-changed creature to its original form.' },
  'Necronomicon':     { tier:4, classes:['Necromancer'],                     duration:'3 rounds', range:'Self',      description:'You draw on the Book of the Dead to seek portents. Ask the GM up to three yes-or-no questions (one per round). Cast more than once a week: treat failure as a critical failure.' },
  'Passwall':         { tier:4, classes:['Wizard'],                          duration:'5 rounds', range:'Close',     description:'A tunnel of your height opens in a barrier you touch, up to near distance long in a straight line.' },
  'Pillar of Salt':   { tier:4, classes:['Priest'],                          duration:'Focus',    range:'Near',      description:'A creature of LV 5 or less you can see turns into a statue of hardened salt. Focus for 3 consecutive rounds to make the transformation permanent.' },
  'Polymorph':        { tier:4, classes:['Wizard'],                          duration:'10 rounds',range:'Close',     description:'Transform a creature into another natural creature of equal or smaller size. It gains physical stats/features but retains non-physical ones. Dropping to 0 HP reverts it at half prior HP.' },
  'Regenerate':       { tier:4, classes:['Priest'],                          duration:'Focus',    range:'Close',     description:'A creature you touch regains 1d4 HP on your turn for the duration. This spell also regrows lost body parts.' },
  'Resilient Sphere': { tier:4, classes:['Wizard'],                          duration:'5 rounds', range:'Close',     description:'A weightless, glassy sphere surrounds you out to close range. Nothing can pass through or crush it. You can roll the sphere a near distance on your turn.' },
  'Revenant':         { tier:4, classes:['Necromancer'],                     duration:'Instant',  range:'Close',     description:'Transform an undead creature you touch into another undead up to two levels higher. You can\'t bring an undead above 10th level with this spell.' },
  'Stoneskin':        { tier:4, classes:['Wizard'],                          duration:'10 rounds',range:'Self',      description:'Your skin becomes like granite. Your AC becomes 17 (20 on a critical spellcasting check) for the duration.' },
  'Telekinesis':      { tier:4, classes:['Wizard'],                          duration:'Focus',    range:'Far',       description:'Lift a creature or object of 1,000 lbs or less with your mind. Move it near in any direction and hold it in place.' },
  'Vision':           { tier:4, classes:['Necromancer'],                     duration:'5 rounds', range:'Self',      description:'Cast only while standing in a river. The waters become the River of Death and visions dance on its surface. You can see and hear a creature or location you choose. A failed check is always a critical failure.' },
  'Wall of Force':    { tier:4, classes:['Wizard'],                          duration:'5 rounds', range:'Near',      description:'A transparent wall of force covers a near-sized area. Nothing on the same plane can physically pass through it. You choose its shape.' },
  'Wrath':            { tier:4, classes:['Priest'],                          duration:'10 rounds',range:'Self',      description:'Your weapons become magical +2 and deal an additional d8 damage for the duration.' },

  // ── Tier 5 ──────────────────────────────────────────────────────────────────
  'Anchor In Death':  { tier:5, classes:['Necromancer'],                     duration:'Permanent',range:'Close',     description:'A creature of LV 10 or less you touch is fixed to its location by a black thread severable only by a silver or magic blade. The creature becomes comatose and immune to all harm while under this spell.' },
  'Antimagic Shell':  { tier:5, classes:['Wizard'],                          duration:'Focus',    range:'Self',      description:'An invisible near-sized cube of null-magic centers on you. No spells can be cast inside it, magic items have no effect, and no magic can enter. The cube moves with you.' },
  'Create Undead':    { tier:5, classes:['Wizard','Necromancer'],             duration:'1 day',    range:'Close',     description:'You summon a wight or wraith of your choice under your control, acting on your turn. After 1 day it melts away into smoke.' },
  'Disintegrate':     { tier:5, classes:['Wizard'],                          duration:'Instant',  range:'Far',       description:'A green ray turns a creature or object into ash. A target of LV 5 or less instantly dies; LV 6+ takes 3d8 damage. A non-magical object up to the size of a large tree is destroyed.' },
  'Divine Vengeance': { tier:5, classes:['Priest'],                          duration:'10 rounds',range:'Self',      description:'You become the divine avatar of your god\'s wrath. You can fly near, your weapons are magical, and you have +4 to weapon attacks and damage for the duration.' },
  'Dominion':         { tier:5, classes:['Priest'],                          duration:'10 rounds',range:'Near',      description:'Mighty beings with a combined total of 16 levels or less come to your aid. They act freely on your turn. You can\'t cast this again until you complete penance.' },
  'Dust To Dust':     { tier:5, classes:['Necromancer'],                     duration:'Instant',  range:'Near',      description:'All undead of LV 10 or less within range must make a DC 15 CHA check. On a failure, they are destroyed.' },
  'Fifth Gate':       { tier:5, classes:['Necromancer'],                     duration:'Instant',  range:'Near',      description:'A dying creature gains 5 rounds on its death timer and acts normally while dying. Damage costs rounds instead. If it dies, it makes a DC 18 CON check — success returns it to life at 1 HP.' },
  'Heal':             { tier:5, classes:['Priest'],                          duration:'Instant',  range:'Close',     description:'One creature you touch is healed to full hit points. You cannot cast this spell again until you complete a rest.' },
  'Hold Monster':     { tier:5, classes:['Wizard'],                          duration:'Focus',    range:'Near',      description:'You paralyze one creature you can see. LV 9+ creatures may make a STR check vs. your check at the start of their turns to end the spell.' },
  'Judgment':         { tier:5, classes:['Priest'],                          duration:'5 rounds', range:'Close',     description:'A creature of LV 10 or less you touch is banished to face your god\'s judgment. It returns in 5 rounds healed to full HP (if its deeds pleased your god) or at 1 HP (if they angered it).' },
  'Plane Shift':      { tier:5, classes:['Wizard','Priest'],                  duration:'Instant',  range:'Close',     description:'You fold space and time, transporting yourself and all willing creatures within close to another plane. Without prior knowledge of the location, you arrive in a random place.' },
  'Power Word Kill':  { tier:5, classes:['Wizard'],                          duration:'Instant',  range:'Near',      description:'You utter the Word of Doom. One creature of LV 9 or less that hears you dies. A failed check is a critical failure rolled with disadvantage.' },
  'Prismatic Orb':    { tier:5, classes:['Wizard'],                          duration:'Instant',  range:'Far',       description:'A strobing orb of energy deals 3d8 damage of a chosen type (fire, cold, or electricity). If that energy is anathema to the target (e.g. cold vs. a fire elemental), it deals double damage.' },
  'Prophecy':         { tier:5, classes:['Priest'],                          duration:'Instant',  range:'Self',      description:'You commune directly with your god. Ask the GM one question; they answer truthfully using what your god knows. You can\'t cast this again until you complete penance.' },
  'Riverwalk':        { tier:5, classes:['Necromancer'],                     duration:'Instant',  range:'Far',       description:'Cast only while standing in a river. You and willing creatures within close range teleport to another river you\'ve stood in on your same plane.' },
  'Scrying':          { tier:5, classes:['Wizard'],                          duration:'Focus',    range:'Self',      description:'Looking into a crystal ball or pool, you can see and hear a creature or location on the same plane. DC 18 if unfamiliar. Observed creatures may make a WIS check vs. yours to detect your observation.' },
  'Shapechange':      { tier:5, classes:['Wizard'],                          duration:'Focus',    range:'Self',      description:'You transform into any natural creature of LV 10 or less you\'ve seen. You gain its physical stats/features but retain INT, WIS, and CHA. Dropping to 0 HP reverts you at 1 HP.' },
  'Summon Extraplanar': { tier:5, classes:['Wizard'],                        duration:'Focus',    range:'Near',      description:'You summon an elemental or outsider of LV 7 or less under your control. Losing focus makes it hostile toward you. Pass a check on your turn to return it to the outer planes.' },
  'Summon Soul':      { tier:5, classes:['Necromancer'],                     duration:'10 rounds',range:'Near',      description:'An undead being you know by name comes to your aid and acts freely to help you. Harming the being ends the spell. After 10 rounds it departs; you can\'t summon it again for a year.' },
  'Teleport':         { tier:5, classes:['Wizard'],                          duration:'Instant',  range:'Close',     description:'You and willing creatures within close range teleport to a known sigil or prior location on your same plane. Otherwise there\'s a 50% chance of arriving off-target.' },
  'Wish':             { tier:5, classes:['Wizard'],                          duration:'Instant',  range:'Self',      description:'Make a single wish, stated as exactly as possible. It occurs as interpreted by the GM. A failed check is a critical failure rolled with disadvantage.' },
}

// ─── Spell Derived Lookups ────────────────────────────────────────────────────

/** Spells grouped by class → tier (sorted alphabetically within each tier) */
export const SD_SPELLS_BY_CLASS = Object.entries(SD_SPELLS).reduce((acc, [name, s]) => {
  for (const cls of s.classes) {
    if (!acc[cls]) acc[cls] = { 1:[], 2:[], 3:[], 4:[], 5:[] }
    acc[cls][s.tier].push(name)
  }
  return acc
}, {})
Object.values(SD_SPELLS_BY_CLASS).forEach(byTier =>
  Object.values(byTier).forEach(arr => arr.sort())
)

// ─── Spells Known Tables ──────────────────────────────────────────────────────
// Source: V4-9 rulebook (Wizard pg.23, Priest pg.20, Necromancer playtest pg.52)
// Format: [T1, T2, T3, T4, T5] known at each level (index = level, index 0 unused)

export const SD_SPELLS_KNOWN = {
  Wizard: [
    null,
    [3,0,0,0,0], [4,0,0,0,0], [4,1,0,0,0], [4,2,0,0,0],
    [4,2,1,0,0], [4,2,2,0,0], [4,3,2,1,0], [4,3,2,2,0],
    [4,3,2,2,1], [4,3,3,2,2],
  ],
  Priest: [
    null,
    [2,0,0,0,0], [3,0,0,0,0], [3,1,0,0,0], [3,2,0,0,0],
    [3,2,1,0,0], [3,2,2,0,0], [3,3,2,1,0], [3,3,2,2,0],
    [3,3,2,2,1], [3,3,3,2,2],
  ],
  Necromancer: [
    null,
    [2,0,0,0,0], [3,0,0,0,0], [3,1,0,0,0], [3,2,0,0,0],
    [3,2,1,0,0], [3,2,2,0,0], [3,3,2,1,0], [3,3,2,2,0],
    [3,3,2,2,1], [3,3,3,2,2],
  ],
}
