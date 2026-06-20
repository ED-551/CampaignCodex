#!/usr/bin/env node
/**
 * Mörk Borg Bestiary Seed — official creatures from the core rulebook (pages 58–66)
 * Source: Mörk Borg English edition (Free League Publishing)
 *
 * Run from project root: node backend/src/db/seed-morkborg-bestiary.js
 *
 * Creatures seeded (9 confirmed + note on 1 incomplete):
 *   Seth         — Goblin                        p.58
 *   Bent         — Scum                          p.59
 *   Zukuma       — Berserker                     p.60
 *   Wrat         — Wraith                        p.61
 *   Belze        — Blood-drenched skeleton       p.62
 *   Lich         — Undead (weak) necromancer     p.63
 *   Troll        — Troll                         p.64
 *   Nodh         — Zombie                        p.65
 *   Lady Porcelain — Undead doll                 p.66
 *
 * NOTE: There is a 10th creature visible on the p.64–65 spread (pale, horned,
 * bounties: Captured 200s / Corpse 70s / Horn 25s) whose name and stats were
 * not fully legible in the source images. Add manually when confirmed.
 *
 * rewards format: [{label, amount}] — new flexible bounty system.
 * Backward-compatible with old {dead, captured} format via MorkborgMonsterForm's initForm.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const db = require('./index')

const USER_ID     = '0621b230-8244-4d0a-bf1d-ede3d6b0f792'  // ragnarok1414
const GAME_SYSTEM = 'morkborg'

// ─── CREATURES ────────────────────────────────────────────────────────────────

const CREATURES = [

  // ── SETH — GOBLIN ─────────────────────────────────────────────────────────
  {
    name:      'Seth',
    challenge: '6',
    tags:      'Goblin,Cursed,Undead',
    stat_data: {
      creatureType: 'Goblin',
      hp:           6,
      morale:       '7',
      armor:        'Ropy skin -d2',
      attacks: [
        { name: 'Knife/shortbow', damage: 'd4' },
      ],
      special:     'Quick — attacks and defence against this creature are DR14.',
      description: 'All goblins carry a curse. Once like you, they are now trapped in the prison of their crazed goblin flesh. Only their eyes reveal the truth: a ruined mind watching its body-prison perform terrible deeds. Even being attacked by goblins sends the curse, carried on the winds of their hate. Hit or miss, it doesn\'t matter. In the dark of Sarkash they shoot at passers-by with twanging bows. The goblin before your mind is paralyzed. If the curse-carrying creature still lives do days after the attack, you will warp irrevocably into one yourself. Then, only the dark of Sarkash will hide you.',
      tables:  [],
      rewards: [
        { label: 'Head',     amount: '7s' },
        { label: 'Captured', amount: '150s' },
        { label: 'Dead',     amount: '20s' },
      ],
    },
  },

  // ── BENT — SCUM ───────────────────────────────────────────────────────────
  {
    name:      'Bent',
    challenge: '7',
    tags:      'Scum,Humanoid,Wanted',
    stat_data: {
      creatureType: 'Scum',
      hp:           7,
      morale:       '8',
      armor:        'No armor',
      attacks: [
        { name: 'Poisoned knife', damage: 'd4 + special' },
      ],
      special:     'Poisoned knife — test Toughness DR10 or become infected. The PC with the highest Presence makes a DR14 test at the start of battle. Failure means a random party member is automatically hit with a cowardly backstab — normal damage +3.',
      description: 'There are few fiends more fell than poverty or monsters more powerful than hate. In this stricken world, the slums and black alleyways are fecund scum, mothering countless abhorned miscreants.',
      tables:  [],
      rewards: [
        { label: 'Captured', amount: '50–120s (wanted, serious crime)' },
        { label: 'Dead',     amount: '20–70s (wanted, serious crime)' },
      ],
    },
  },

  // ── ZUKUMA — BERSERKER ────────────────────────────────────────────────────
  {
    name:      'Zukuma',
    challenge: '13',
    tags:      'Berserker,Humanoid',
    stat_data: {
      creatureType: 'Berserker',
      hp:           13,
      morale:       '9',
      armor:        'Hardened skin -d2',
      attacks:      [],   // weapon determined by Wields table below
      special:     'Attacks twice per round but doesn\'t have time for defence (DR10 to hit them).',
      description: 'They\'re on you! As if from nowhere, a frenzied ambush in dusty hallways and from behind the stacked black stones of catacombs.',
      tables: [
        {
          label:   'Wields',
          die:     'd4',
          entries: [
            'Long flail d8',
            'Heavy mace d6',
            'Chained sword d6',
            'Huge warhammer d10',
          ],
        },
      ],
      rewards: [
        { label: 'Captured',         amount: '55s' },
        { label: 'Dead',             amount: '20s' },
        { label: 'Blood, per litre', amount: '3s' },
      ],
    },
  },

  // ── WRAT — WRAITH ─────────────────────────────────────────────────────────
  {
    name:      'Wrat',
    challenge: '15',
    tags:      'Wraith,Undead,Spectral',
    stat_data: {
      creatureType: 'Wraith',
      hp:           15,
      morale:       '—',
      armor:        'No armor',
      attacks: [
        { name: 'Touch', damage: 'd4 + special' },
      ],
      special:     'Swift, elusive and difficult to hit (DR14). These soundless phantoms always win initiative. Their touch drains Strength, Presence and Agility by 1 for the duration of the fight.',
      description: '',
      tables:  [],
      rewards: [
        { label: 'Captured',  amount: '120s' },
        { label: 'Skull',     amount: '70s' },
        { label: 'Ectoplasm', amount: '25s' },
      ],
    },
  },

  // ── BELZE — BLOOD-DRENCHED SKELETON ───────────────────────────────────────
  {
    name:      'Belze',
    challenge: '7',
    tags:      'Skeleton,Undead',
    stat_data: {
      creatureType: 'Blood-drenched skeleton',
      hp:           7,
      morale:       '8',
      armor:        'No armor',
      attacks: [
        { name: 'Shortsword or Knife', damage: 'd4' },
        { name: 'Bony knuckles',       damage: 'd2' },
      ],
      special:     'Skulks about, impossibly soundless. Attacks by surprise. Can mimic voices to lure victims, but can only repeat what it has heard. Attacks on them with piercing weapons are DR14. Any strike doing 5 or more damage destroys the skeleton completely.',
      description: '',
      tables:  [],
      rewards: [
        { label: 'Captured',  amount: '35s' },
        { label: 'Destroyed', amount: '7s' },
      ],
    },
  },

  // ── LICH — UNDEAD (WEAK) NECROMANCER ──────────────────────────────────────
  {
    name:      'Lich',
    challenge: '15',
    tags:      'Lich,Undead,Necromancer,Spellcaster',
    stat_data: {
      creatureType: 'Undead (weak) necromancer',
      hp:           15,
      morale:       '—',
      armor:        'Barrier (necro) -d4',
      attacks: [
        { name: 'Strike', damage: 'd6 + special' },
      ],
      special:     'Paralyzing touch — Presence DR14 every round to break free. No one can use Powers near this anti-magical wound in reality. Every round they can steal the contents of a nearby scroll and use this Power against its owner.',
      description: '',
      tables:  [],
      rewards: [
        { label: 'Captured', amount: '200s' },
        { label: 'Remains',  amount: '130s' },
        { label: 'Skull',    amount: '100s' },
      ],
    },
  },

  // ── TROLL ─────────────────────────────────────────────────────────────────
  {
    name:      'Troll',
    challenge: '32',
    tags:      'Troll,Beast,Regenerating',
    stat_data: {
      creatureType: 'Troll',
      hp:           32,
      morale:       'special',
      armor:        'Thick hide -d2',
      attacks: [
        { name: 'Fist', damage: '2d6' },
      ],
      special:     'Easy to hit — attacks are DR10. Cowards despite their size. Usually retreat if badly wounded. Never forget who hurt them. They grow larger during the healing process and will definitely come back, stronger than before. Any HP healed is added to their maximum HP. Every time they return, add another d6 to their damage.',
      description: '',
      tables:  [],
      rewards: [],
    },
  },

  // ── NODH — ZOMBIE ─────────────────────────────────────────────────────────
  {
    name:      'Nodh',
    challenge: '7',
    tags:      'Zombie,Undead,Infectious',
    stat_data: {
      creatureType: 'Zombie',
      hp:           7,
      morale:       '—',
      armor:        'Leather scraps -d2',
      attacks: [
        { name: 'Claw/bite', damage: 'd2 + special' },
      ],
      special:     'Anyone bitten tests Toughness DR8 or dies within two days before rising as a zombie. The only cure or vaccine is said to be found at the peak of a pale mountain within an infinitely-miserable forest of dark leaves. King Fathmu IX of Wästland in particular seeks this cure and knows the name and location of the forest which the mountain overlooks.',
      description: '',
      tables:  [],
      rewards: [
        { label: 'Captured',         amount: '30s' },
        { label: 'Blood, per litre', amount: '5s' },
      ],
    },
  },

  // ── LADY PORCELAIN — UNDEAD DOLL ──────────────────────────────────────────
  {
    name:      'Lady Porcelain',
    challenge: '11',
    tags:      'Undead,Doll,Spectral,Fear',
    stat_data: {
      creatureType: 'Undead doll',
      hp:           11,
      morale:       '—',
      armor:        'Porcelain -d2',
      attacks: [
        { name: 'Claws/piercing bite', damage: 'd4' },
      ],
      special:     'Their mad gaze demands a Presence DR12 test at the start of combat to avoid being frozen with fear for d4 rounds.',
      description: 'In Tveland relic thieves, defamers and corrupt clerks suffer a punishment of exquisite and deeply impractical cruelty. Their children or grandchildren are enclosed in porcelain dolls then placed in cathedral windows, to die slowly of starvation and heat. Despite warding rituals, many return as vengeful undead, often gathering in large throngs to hunt their tormentors.',
      tables:  [],
      rewards: [
        { label: 'Head',     amount: '20s' },
        { label: 'Captured', amount: '80s' },
      ],
    },
  },

]

// ─── INSERT LOGIC ─────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n💀  Mörk Borg Bestiary Seeder')
  console.log(`    Source : Core Rulebook (pages 58–66)`)
  console.log(`    User   : ${USER_ID} (ragnarok1414)`)
  console.log(`    System : ${GAME_SYSTEM}\n`)

  // Wipe existing Mörk Borg monsters for this user
  const del = await db.query(
    'DELETE FROM monsters WHERE user_id = $1 AND game_system = $2',
    [USER_ID, GAME_SYSTEM]
  )
  console.log(`    Cleared ${del.rowCount} existing Mörk Borg monsters.`)

  let count = 0
  for (const m of CREATURES) {
    await db.query(
      `INSERT INTO monsters (user_id, game_system, name, challenge, tags, stat_data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [USER_ID, GAME_SYSTEM, m.name, m.challenge, m.tags, JSON.stringify(m.stat_data)]
    )
    count++
    console.log(`    ✓  [${count}/${CREATURES.length}] ${m.name} — ${m.stat_data.creatureType}`)
  }

  console.log(`\n✅  Done! ${count} Mörk Borg creatures seeded.`)
  console.log('    ⚠  NOTE: One creature (pale, horned, ~p.64–65) has incomplete stats.')
  console.log('       Bounties seen: Captured 200s / Corpse 70s / Horn 25s.')
  console.log('       Add manually once name and stat block are confirmed from the physical book.\n')
  process.exit(0)
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err.message)
  process.exit(1)
})
