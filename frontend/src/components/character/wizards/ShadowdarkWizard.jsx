import { useState, useEffect, useRef, useCallback } from 'react'
import {
  gearToAttacks,
  SD_WEAPONS, SD_ARMOR, SD_BASIC_GEAR,
  SD_STARTING_GEAR_D12, SD_CRAWLING_KIT, SD_LANGUAGES,
  toGP, fmtCost, fmtGP,
  detectWeapon,
  SD_SPELLS, SD_SPELLS_BY_CLASS, SD_SPELLS_KNOWN,
} from '../../../utils/shadowdark'

// ─── Data ────────────────────────────────────────────────────────────────────

const ANCESTRIES = [
  {
    name: 'Human',
    ability: 'Ambitious',
    description:
      'Gain one additional talent roll at 1st level. You also know one additional common language of your choice.',
  },
  {
    name: 'Elf',
    ability: 'Farsight',
    description:
      'You get a +1 bonus to attack rolls with ranged weapons, or a +1 bonus to spellcasting checks.',
  },
  {
    name: 'Dwarf',
    ability: 'Stout',
    description: 'Start with +2 HP. Roll hit points per level with advantage.',
  },
  {
    name: 'Halfling',
    ability: 'Stealthy',
    description:
      'Once per day, you can become invisible for 3 rounds.',
  },
  {
    name: 'Half-Orc',
    ability: 'Mighty',
    description:
      'You have a +1 bonus to attack and damage rolls with melee weapons.',
  },
  {
    name: 'Goblin',
    ability: 'Keen Senses',
    description: "You can't be surprised.",
  },
]

const CLASSES = [
  // ── Core rulebook ─────────────────────────────────────────────────────────
  {
    name: 'Fighter',
    hit_die: 'd8',
    prime: 'STR or DEX',
    armor: 'All armor & shields',
    description: 'Masters of combat, unmatched in the art of war.',
    gear: ['Longsword (1 slot)', 'Chainmail (2 slots)'],
  },
  {
    name: 'Thief',
    hit_die: 'd4',
    prime: 'DEX',
    armor: 'Leather armor, mithral chainmail',
    description: 'Cunning rogues who rely on speed and trickery.',
    gear: ['Shortsword (1 slot)', 'Leather armor (1 slot)'],
  },
  {
    name: 'Wizard',
    hit_die: 'd4',
    prime: 'INT',
    armor: 'None',
    description: 'Wielders of arcane secrets at great personal risk.',
    gear: ['Staff (1 slot)', 'Spellbook (1 slot)'],
  },
  {
    name: 'Priest',
    hit_die: 'd6',
    prime: 'WIS',
    armor: 'All armor',
    description: 'Devoted servants of a deity, channeling divine power.',
    gear: ['Mace (1 slot)', 'Holy symbol (0 slots)'],
  },
  // ── Bard & Ranger supplement ──────────────────────────────────────────────
  {
    name: 'Ranger',
    hit_die: 'd8',
    prime: 'STR or DEX',
    armor: 'Leather armor, chainmail',
    description: 'Skilled trackers and wilderness warriors, peerless in the wilds.',
    gear: ['Longbow + 20 arrows (2 slots)', 'Leather armor (1 slot)'],
  },
  {
    name: 'Bard',
    hit_die: 'd6',
    prime: 'CHA',
    armor: 'Leather armor, chainmail, shields',
    description: 'Wandering performers who weave knowledge, diplomacy, and magic through music.',
    gear: ['Shortsword (1 slot)', 'Lute (1 slot)'],
  },
  // ── Playtests ─────────────────────────────────────────────────────────────
  {
    name: 'Necromancer',
    hit_die: 'd6',
    prime: 'CHA',
    armor: 'Leather armor, chainmail',
    description: 'Feared mystics who commune with death and command the dead.',
    gear: ['Staff (1 slot)', 'Spellbook (1 slot)'],
  },
  {
    name: 'Paladin',
    hit_die: 'd8',
    prime: 'STR or CHA',
    armor: 'All armor & shields',
    description: 'Oath-sworn knights of honor, wielding divine might and blessed steel.',
    gear: ['Longsword (1 slot)', 'Chainmail (2 slots)'],
  },
  {
    name: 'Roustabout',
    hit_die: 'd4',
    prime: 'None',
    armor: 'Leather armor',
    description: 'Average souls of no particular talent — until their back is against the wall.',
    gear: ['Club (1 slot)', 'Leather armor (1 slot)'],
  },
]

const HIT_DIE_MAX = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12 }

// ─── Class Talent Tables (Shadowdark V4-9 core rulebook, pg. 18-25) ──────────
// Roll 2d6 at 1st level. Humans (Ambitious) get one additional roll.
// Ranger / Bard are not in the V4-9 core — those classes skip required rolls.

const CLASS_TALENTS = {
  Fighter: [
    { min: 2,  max: 2,  effect: 'Gain Weapon Mastery with one additional weapon type' },
    { min: 3,  max: 6,  effect: '+1 to melee and ranged attacks' },
    { min: 7,  max: 9,  effect: '+2 to Strength, Dexterity, or Constitution stat' },
    { min: 10, max: 11, effect: 'Choose one kind of armor — you get +1 AC from that armor type' },
    { min: 12, max: 12, effect: 'Choose any talent or distribute +2 points to stats' },
  ],
  Priest: [
    { min: 2,  max: 2,  effect: 'Gain advantage on casting one spell you know' },
    { min: 3,  max: 6,  effect: '+1 to melee or ranged attacks' },
    { min: 7,  max: 9,  effect: '+1 to priest spellcasting checks' },
    { min: 10, max: 11, effect: '+2 to Strength or Wisdom stat' },
    { min: 12, max: 12, effect: 'Choose any talent or distribute +2 points to stats' },
  ],
  Thief: [
    { min: 2,  max: 2,  effect: 'Gain advantage on initiative rolls (reroll if duplicate)' },
    { min: 3,  max: 5,  effect: 'Your Backstab deals +1 die of damage' },
    { min: 6,  max: 9,  effect: '+2 to Strength, Dexterity, or Charisma stat' },
    { min: 10, max: 11, effect: '+1 to melee and ranged attacks' },
    { min: 12, max: 12, effect: 'Choose any talent or distribute +2 points to stats' },
  ],
  Wizard: [
    { min: 2,  max: 2,  effect: 'Make 1 random magic item of a type you choose' },
    { min: 3,  max: 7,  effect: '+2 to Intelligence stat or +1 to wizard spellcasting checks' },
    { min: 8,  max: 9,  effect: 'Gain advantage on casting one spell you know' },
    { min: 10, max: 11, effect: 'Learn one additional wizard spell of any tier you know' },
    { min: 12, max: 12, effect: 'Choose any talent or distribute +2 points to stats' },
  ],
  // ── Bard & Ranger supplement (V1-3) ───────────────────────────────────────
  Bard: [
    { min: 2,  max: 2,  effect: 'You find a random priest or wizard wand (your choice of class)' },
    { min: 3,  max: 6,  effect: '+1 to melee and ranged attacks or +1 to Magical Dabbler rolls' },
    { min: 7,  max: 9,  effect: '+2 points to distribute to any stats' },
    { min: 10, max: 11, effect: 'Your Presence effects become DC 9 to enact (reroll if duplicate)' },
    { min: 12, max: 12, effect: 'Choose any talent' },
  ],
  Ranger: [
    { min: 2,  max: 2,  effect: 'You deal d12 damage with one weapon type you choose' },
    { min: 3,  max: 6,  effect: '+1 to melee or ranged attacks and damage' },
    { min: 7,  max: 9,  effect: '+2 to Strength, Dexterity, or Intelligence stat' },
    { min: 10, max: 11, effect: 'You gain advantage on Herbalism checks for a remedy you choose' },
    { min: 12, max: 12, effect: 'Choose any talent or distribute +2 points to stats' },
  ],
  // ── Playtests ─────────────────────────────────────────────────────────────
  Necromancer: [
    { min: 2,  max: 2,  effect: 'The next time you die, you may return to life with full HP (additional use if rolled again)' },
    { min: 3,  max: 7,  effect: '+1 to your spellcasting checks or +1 to melee attacks' },
    { min: 8,  max: 9,  effect: '+2 to Strength, Constitution, or Charisma stat' },
    { min: 10, max: 11, effect: 'Gain advantage on casting one spell you know' },
    { min: 12, max: 12, effect: 'Choose any talent or distribute +2 points to stats' },
  ],
  Paladin: [
    { min: 2,  max: 2,  effect: 'Your Named Blade gains a random magic weapon benefit' },
    { min: 3,  max: 6,  effect: '+1 to attacks and damage with your Named Blade' },
    { min: 7,  max: 9,  effect: '+2 to Strength, Constitution, or Charisma stat' },
    { min: 10, max: 11, effect: 'Increase your Inspiring Presence dying roll range by 1' },
    { min: 12, max: 12, effect: 'Choose any talent or distribute +2 points to stats' },
  ],
  Roustabout: [
    { min: 2,  max: 2,  effect: '+1 to any stat of your choice — then roll this table again (bonus roll!)' },
    { min: 3,  max: 6,  effect: 'Gain the ability to wield a new weapon type or armor type' },
    { min: 7,  max: 9,  effect: '+1 to any two different stats of your choice' },
    { min: 10, max: 11, effect: 'Roll an extra hit points die at this level' },
    { min: 12, max: 12, effect: 'Learn any spell of a tier equal to half your level rounded down (min. 1). Cast it using that class\'s spellcasting stat.' },
  ],
}

function getTalentForRoll(className, roll) {
  const table = CLASS_TALENTS[className]
  if (!table) return null
  return table.find(row => roll >= row.min && roll <= row.max) ?? null
}

// Backgrounds — canonical d20 table (Shadowdark V4-9, pg. 26)
const BACKGROUNDS = [
  { value: 'Urchin',              label: 'Urchin',              flavor: 'You grew up in the merciless streets of a large city.' },
  { value: 'Wanted',              label: 'Wanted',              flavor: "There's a price on your head, but you have allies." },
  { value: 'Cult Initiate',       label: 'Cult Initiate',       flavor: 'You know blasphemous secrets and rituals.' },
  { value: "Thieves' Guild",      label: "Thieves' Guild",      flavor: 'You have connections, contacts, and debts.' },
  { value: 'Banished',            label: 'Banished',            flavor: 'Your people cast you out for supposed crimes.' },
  { value: 'Orphaned',            label: 'Orphaned',            flavor: 'An unusual guardian rescued and raised you.' },
  { value: "Wizard's Apprentice", label: "Wizard's Apprentice", flavor: 'You have a knack and eye for magic.' },
  { value: 'Jeweler',             label: 'Jeweler',             flavor: 'You can easily appraise value and authenticity.' },
  { value: 'Herbalist',           label: 'Herbalist',           flavor: 'You know plants, medicines, and poisons.' },
  { value: 'Barbarian',           label: 'Barbarian',           flavor: 'You left the horde, but it never quite left you.' },
  { value: 'Mercenary',           label: 'Mercenary',           flavor: 'You fought friend and foe alike for your coin.' },
  { value: 'Sailor',              label: 'Sailor',              flavor: 'Pirate, privateer, or merchant — the seas are yours.' },
  { value: 'Acolyte',             label: 'Acolyte',             flavor: "You're well trained in religious rites and doctrines." },
  { value: 'Soldier',             label: 'Soldier',             flavor: 'You served as a fighter in an organized army.' },
  { value: 'Ranger',              label: 'Ranger',              flavor: 'The woods and wilds are your true home.' },
  { value: 'Scout',               label: 'Scout',               flavor: 'You survived on stealth, observation, and speed.' },
  { value: 'Minstrel',            label: 'Minstrel',            flavor: "You've traveled far with your charm and talent." },
  { value: 'Scholar',             label: 'Scholar',             flavor: 'You know much about ancient history and lore.' },
  { value: 'Noble',               label: 'Noble',               flavor: 'A famous name has opened many doors for you.' },
  { value: 'Chirurgeon',          label: 'Chirurgeon',          flavor: 'You know anatomy, surgery, and first aid.' },
]

const ALIGNMENTS = ['Lawful', 'Neutral', 'Chaotic']

// ─── Name Tables ──────────────────────────────────────────────────────────────
// Shadowdark-appropriate name pools by ancestry, drawn from the book's style
// and expanded to give variety on every new character.

const NAMES_BY_ANCESTRY = {
  Human: {
    m: [
      'Aldric','Bram','Cael','Dorn','Edric','Finn','Garen','Hawk','Ivan',
      'Keld','Lars','Mord','Nels','Oskar','Rand','Soren','Theron','Ulric',
      'Vael','Wade','Aldwyn','Bryn','Caden','Erik','Gareth','Holt','Jasper',
      'Kern','Lorn','Nils','Orin','Rolf','Silas','Talwyn','Uther','Wulf',
      'Beorn','Calder','Darrow','Erwan','Gideon','Hadwin','Ingvar','Joran',
      'Leoric','Malric','Nordin','Oryn','Pendric','Qualt','Roen','Severyn',
    ],
    f: [
      'Agna','Berta','Cass','Dara','Elga','Freda','Greta','Helga','Irna',
      'Jada','Kara','Lena','Mira','Nora','Petra','Rada','Sara','Tara',
      'Una','Vera','Wren','Aldis','Brynn','Dova','Elra','Frea','Gael',
      'Hilda','Inga','Lyra','Maren','Nisha','Oril','Pira','Reva','Seyla',
      'Thessa','Ula','Vessa','Wylla','Aela','Celdra','Dagna','Edda','Fira',
      'Gyla','Harna','Idris','Jera','Kessa','Lorra','Milla','Nella',
    ],
  },
  Elf: {
    m: [
      'Aelindra','Caelum','Farath','Thandril','Aerith','Caladrel','Faern',
      'Elovar','Sylvar','Lirath','Aeryn','Caelen','Fael','Thandin','Erevan',
      'Lirion','Sylrien','Vaerin','Nyloth','Quinth','Aelvorn','Caelthas',
    ],
    f: [
      'Sylvara','Elowen','Liriel','Nymeria','Caladwen','Sylwen','Elowin',
      'Liri','Faelwen','Aelith','Caelith','Nymer','Syliel','Elowynn',
      'Lirielle','Aeriel','Caeliel','Faelis','Thaindel','Nylwen','Quivara',
    ],
  },
  Dwarf: {
    m: [
      'Baran','Thordak','Torgin','Bofri','Korvar','Duhm','Grint','Harn',
      'Mord','Norg','Orm','Tark','Ulf','Barek','Thodak','Horfin','Korvald',
      'Brun','Durgin','Gimmel','Holgrim','Kordak','Mordin','Orvald','Thunk',
    ],
    f: [
      'Hilda','Grumna','Dagna','Thora','Hilde','Gruna','Dagni','Korva',
      'Bruna','Dorla','Gilda','Herla','Ilda','Morda','Urna','Brina','Dagda',
      'Helga','Korla','Mirna','Norna','Orla','Thurda','Vigna','Yrsa',
    ],
  },
  Halfling: {
    m: [
      'Pip','Tomlin','Fenwick','Bardo','Merric','Cobb','Dodric','Elric',
      'Fitch','Garlan','Hob','Largo','Moss','Nobb','Puck','Rue','Samkin',
      'Tobbin','Wim','Addoc','Burly','Callum','Drogo','Ello',
    ],
    f: [
      'Merry','Rosie','Calla','Livy','Bess','Celia','Dory','Ella','Fae',
      'Gael','Isla','Jilly','Kessa','Lorra','Milla','Nella','Orla','Petal',
      'Rue','Stella','Addie','Bina','Coral','Dulcy','Effy',
    ],
  },
  'Half-Orc': {
    m: [
      'Gruk','Thrak','Keld','Vulk','Barg','Druk','Frak','Garm','Hruk',
      'Krut','Ruk','Skruk','Targ','Urg','Zug','Brak','Grul','Krag','Morg',
      'Nurg','Ork','Rulk','Skrag','Trug','Ulg',
    ],
    f: [
      'Marga','Borva','Raga','Orra','Braga','Draga','Fraga','Gora','Hraga',
      'Kraga','Morga','Nurga','Orka','Rulka','Skraga','Truga','Ulga','Vraga',
      'Wraga','Zora','Akra','Bhraga','Curga','Durga','Erga',
    ],
  },
  Goblin: {
    m: ['Grix','Skrix','Nib','Vex','Skab','Flit','Mox','Dunk','Grin',
        'Nix','Vix','Skap','Muks','Dug','Glip','Krip','Pix','Rix','Zik','Blurp'],
    f: ['Snip','Tip','Wix','Yip','Zip','Bix','Crit','Drib','Frig','Glib',
        'Hrix','Lix','Prix','Sniv','Twix','Ulk','Vrix','Wrix','Xip','Yrk'],
  },
}

const _DEFAULT_NAMES = [
  'Aldric','Bram','Cass','Dorn','Elra','Finn','Garet','Holt',
  'Inga','Jada','Keld','Lena','Mira','Nels','Orin','Petra',
  'Rand','Sara','Theron','Una','Vael','Wren','Yara','Zole',
]

const EPITHETS = [
  'Ironjaw','The Pale One','Blackblade','Ashwalker','Bonecold','Crownless',
  'Doomwhisper','Embereye','Frosthand','Ghostfoot','Hollowsong','Ironhide',
  'Jadeclaw','Knifetongue','Longstride','Mirthless','Nightfall','Oathbound',
  'Pale Fire','Quietstep','Rootwalker','Stoneheart','Thornback','Undertow',
  'Voidwalker','Yellowtooth','The Sleepless','The Unnamed','Twice-Dead',
  'No-Shadow','Ironteeth','Coldwater','The Hollow','Whiteeye','Sevenscar',
  'Harrowborn','Ashen','Grimward','Saltblood','The Patient','Bonemarrow',
  'Deepwatcher','Fireless','Graveborn','The Hesitant','Ironstride','Stillwater',
  'The Unburied','Coldfire','Ashbone','Grimtide','Last-Light','Emberglass',
]

const TITLES = [
  'The Cursed','Bane of Rats','of No Name','The Unforgiven','Child of Dust',
  'Twice-Hanged','The Marked','Called by Shadow','Blade Without Honor',
  'Ever-Falling','The Debtor','Herald of Nothing','Broken Oathkeeper',
  'Born Under a Black Moon','Walker Between Worlds','The Reluctant',
  'Seeker of Forgotten Things','Last of a Dead Name','Who Answers to Nothing',
  'Owed by the Dark','The Miscounted','Who Walked Away','Of No Fixed Stars',
  'Who Cheated the Ferryman','The Unlucky','Who Owes the Night',
  'Keeper of One Secret','Who Came Back Wrong','The Unwanted',
  'Of Borrowed Time','Marked by the Worm','The Twice-Warned',
  'Child of a Nameless God','The Faithless','The Overcautious',
  'Who Remembers Too Much','Killer of Small Things','The Almost-Great',
]

function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function rollName(ancestry) {
  const pool = NAMES_BY_ANCESTRY[ancestry]
  if (pool) {
    const side = Math.random() < 0.5 ? 'm' : 'f'
    return _pick(pool[side])
  }
  return _pick(_DEFAULT_NAMES)
}

function rollEpithet() { return _pick(EPITHETS) }
function rollTitle()   { return _pick(TITLES) }

// ─── ──────────────────────────────────────────────────────────────────────────

const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const STAT_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const STEP_LABELS = [
  'Identity',
  'Ancestry',
  'Class',
  'Ability Scores',
  'Background',
  'Hit Points & Gear',
  'Fate',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcMod(score) {
  return Math.floor((Number(score) - 10) / 2)
}

function fmtMod(score) {
  const m = calcMod(score)
  return m >= 0 ? `+${m}` : `${m}`
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1
}

function roll3d6() {
  return [rollD6(), rollD6(), rollD6()]
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, total }) {
  return (
    <div className="flex items-center gap-1 mb-8">
      {Array.from({ length: total }, (_, i) => {
        const idx = i + 1
        const isComplete = idx < step
        const isCurrent = idx === step
        return (
          <div key={idx} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 flex-shrink-0
                  ${isComplete
                    ? 'bg-codex-gold border-codex-gold text-codex-bg'
                    : isCurrent
                      ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                      : 'border-codex-border text-codex-muted bg-codex-surface'
                  }`}
              >
                {isComplete ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : idx}
              </div>
              <span className={`text-[9px] uppercase tracking-wider whitespace-nowrap hidden sm:block
                ${isCurrent ? 'text-amber-400' : 'text-codex-muted'}`}>
                {STEP_LABELS[i]}
              </span>
            </div>
            {idx < total && (
              <div className={`flex-1 h-px mx-1 transition-colors duration-300
                ${isComplete ? 'bg-codex-gold/50' : 'bg-codex-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1 — Identity ────────────────────────────────────────────────────────

const rollBtnCls = `flex-shrink-0 w-10 h-10 rounded-xl border border-codex-border bg-codex-surface
  text-base text-codex-muted hover:text-codex-gold hover:border-codex-gold/40
  transition-colors flex items-center justify-center`

function StepIdentity({ data, onChange }) {
  // Placeholders are randomized on mount and when 🎲 is clicked.
  // The actual field values stay empty — user never has to delete anything.
  const [namePH,    setNamePH]    = useState(() => rollName(data.ancestry))
  const [epithetPH, setEpithetPH] = useState(rollEpithet)
  const [titlePH,   setTitlePH]   = useState(rollTitle)

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        title="Who Are You?"
        subtitle="Every legend begins with a name. The rest is earned in blood."
      />
      <div className="flex flex-col gap-4">
        <FieldGroup
          label="Full Name"
          required
          hint="The name spoken at your grave — or your bounty."
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={data.name}
              onChange={e => onChange({ name: e.target.value })}
              placeholder={namePH}
              className={`${inputCls} flex-1`}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setNamePH(rollName(data.ancestry))}
              title="Suggest a different name"
              className={rollBtnCls}
            >🎲</button>
          </div>
        </FieldGroup>

        <FieldGroup label="Epithet or Alias" hint="What do they call you in the taverns?">
          <div className="flex gap-2">
            <input
              type="text"
              value={data.nickname}
              onChange={e => onChange({ nickname: e.target.value })}
              placeholder={epithetPH}
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={() => setEpithetPH(rollEpithet())}
              title="Suggest a different epithet"
              className={rollBtnCls}
            >🎲</button>
          </div>
        </FieldGroup>

        <FieldGroup label="Title" hint="Self-appointed or otherwise earned.">
          <div className="flex gap-2">
            <input
              type="text"
              value={data.title}
              onChange={e => onChange({ title: e.target.value })}
              placeholder={titlePH}
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={() => setTitlePH(rollTitle())}
              title="Suggest a different title"
              className={rollBtnCls}
            >🎲</button>
          </div>
        </FieldGroup>
      </div>
    </div>
  )
}

// ─── Step 2 — Ancestry ───────────────────────────────────────────────────────

function StepAncestry({ data, onChange }) {
  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        title="Choose Your Ancestry"
        subtitle="Blood runs deep. Your heritage shapes what you are — not who you become."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ANCESTRIES.map(a => {
          const selected = data.ancestry === a.name
          return (
            <button
              key={a.name}
              onClick={() => onChange({ ancestry: a.name })}
              className={`text-left p-4 rounded-xl border-2 bg-codex-surface transition-all duration-150
                ${selected
                  ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_16px_rgba(245,158,11,0.1)]'
                  : 'border-codex-border hover:border-codex-gold/40 hover:bg-codex-bg'
                }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 transition-all
                  ${selected ? 'border-amber-500 bg-amber-500' : 'border-codex-muted'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold text-sm ${selected ? 'text-amber-400' : 'text-codex-text'}`}>
                      {a.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium
                      ${selected
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-codex-bg text-codex-muted border-codex-border'
                      }`}>
                      {a.ability}
                    </span>
                  </div>
                  <p className="text-xs text-codex-subtext leading-relaxed">{a.description}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 3 — Class ──────────────────────────────────────────────────────────

function StepClass({ data, onChange }) {
  const [pendingRoll, setPendingRoll] = useState(null)   // { d1, d2, roll, effect }
  const [pendingText, setPendingText] = useState('')
  const [animVal,     setAnimVal]     = useState(null)
  const [rolling,     setRolling]     = useState(false)
  const [bonusRolls,  setBonusRolls]  = useState(0)     // Roustabout "2" result grants extra roll
  const timerRef = useRef(null)

  const table        = CLASS_TALENTS[data.class_name] ?? null
  const isHuman      = data.ancestry === 'Human'
  // Roustabout: each "2" roll grants an additional required roll
  const roustaboutBonus = data.class_name === 'Roustabout'
    ? (data.talent_rolls ?? []).filter(t => t.roll === 2).length
    : 0
  const reqRolls     = table ? (isHuman ? 2 : 1) + roustaboutBonus + bonusRolls : 0
  const talentRolls  = data.talent_rolls ?? []

  // Clear animation state whenever class changes
  useEffect(() => {
    setPendingRoll(null)
    setPendingText('')
    setAnimVal(null)
    setRolling(false)
    setBonusRolls(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }, [data.class_name])

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  function rollTalent() {
    if (!table || rolling || talentRolls.length >= reqRolls) return
    setRolling(true)
    setPendingRoll(null)
    setPendingText('')
    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    const roll = d1 + d2
    const entry = getTalentForRoll(data.class_name, roll)
    let ticks = 0
    timerRef.current = setInterval(() => {
      ticks++
      setAnimVal(Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 2)
      if (ticks >= 14) {
        clearInterval(timerRef.current)
        setAnimVal(roll)
        setRolling(false)
        setPendingRoll({ d1, d2, roll, effect: entry?.effect ?? 'Consult rulebook' })
        setPendingText(entry?.effect ?? '')
      }
    }, 55)
  }

  function confirmTalent() {
    if (!pendingRoll) return
    onChange({ talent_rolls: [...talentRolls, { roll: pendingRoll.roll, effect: pendingText.trim() || pendingRoll.effect }] })
    setPendingRoll(null)
    setPendingText('')
    setAnimVal(null)
  }

  function removeTalent(idx) {
    onChange({ talent_rolls: talentRolls.filter((_, i) => i !== idx) })
  }

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        title="Choose Your Class"
        subtitle="What is your calling? Choose wisely — in Shadowdark, second chances are rare."
      />

      {/* Class grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CLASSES.map(cls => {
          const selected = data.class_name === cls.name
          return (
            <button
              key={cls.name}
              onClick={() => onChange({ class_name: cls.name, hit_die: cls.hit_die, talent_rolls: [] })}
              className={`text-left p-4 rounded-xl border-2 bg-codex-surface transition-all duration-150
                ${selected
                  ? 'border-amber-500 bg-amber-500/5 shadow-[0_0_16px_rgba(245,158,11,0.1)]'
                  : 'border-codex-border hover:border-codex-gold/40 hover:bg-codex-bg'
                }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 transition-all
                  ${selected ? 'border-amber-500 bg-amber-500' : 'border-codex-muted'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`font-semibold text-sm ${selected ? 'text-amber-400' : 'text-codex-text'}`}>
                      {cls.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-bold
                      ${selected
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-codex-bg text-codex-muted border-codex-border'
                      }`}>
                      {cls.hit_die}
                    </span>
                  </div>
                  <p className="text-xs text-codex-subtext leading-relaxed mb-1">{cls.description}</p>
                  <p className={`text-[10px] ${selected ? 'text-amber-500/70' : 'text-codex-muted'}`}>
                    Prime: {cls.prime} &bull; Armor: {cls.armor}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Talent rolling — only shown once a class is chosen */}
      {data.class_name && (
        <div className="rounded-xl border border-codex-border bg-codex-surface/50 p-4 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-codex-text">Class Talents</p>
              <p className="text-[11px] text-codex-muted mt-0.5">
                {reqRolls > 0
                  ? `Roll 2d6 on the ${data.class_name} table below.${isHuman ? ' Humans roll twice (Ambitious trait).' : ''}`
                  : `${data.class_name} talent table is not in the V4-9 core. Consult your GM or supplement.`}
              </p>
            </div>
            {reqRolls > 0 && (
              <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${
                talentRolls.length >= reqRolls
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
              }`}>
                {talentRolls.length} / {reqRolls}
              </span>
            )}
          </div>

          {/* Talent table */}
          {table && (
            <div className="rounded-lg overflow-hidden border border-codex-border text-xs">
              <div className="grid grid-cols-[3rem_1fr] bg-codex-surface">
                <span className="px-3 py-2 font-bold uppercase tracking-wider text-codex-muted">Roll</span>
                <span className="px-3 py-2 font-bold uppercase tracking-wider text-codex-muted">Effect</span>
              </div>
              {table.map((row, i) => {
                const lit = pendingRoll && pendingRoll.roll >= row.min && pendingRoll.roll <= row.max
                return (
                  <div key={i} className={`grid grid-cols-[3rem_1fr] border-t border-codex-border transition-colors ${
                    lit ? 'bg-amber-500/10' : 'hover:bg-codex-surface/60'
                  }`}>
                    <span className={`px-3 py-2 font-mono font-bold ${lit ? 'text-amber-400' : 'text-codex-muted'}`}>
                      {row.min === row.max ? row.min : `${row.min}–${row.max}`}
                    </span>
                    <span className={`px-3 py-2 leading-relaxed ${lit ? 'text-amber-200' : 'text-codex-subtext'}`}>
                      {row.effect}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Roll button */}
          {table && talentRolls.length < reqRolls && !pendingRoll && (
            <button
              type="button"
              onClick={rollTalent}
              disabled={rolling}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-codex-gold/40 text-sm font-medium
                hover:border-codex-gold hover:bg-codex-gold/5 transition-all disabled:opacity-50
                text-codex-gold flex items-center justify-center gap-2"
            >
              {rolling
                ? <span className="font-mono text-amber-400 animate-pulse text-base">🎲 {animVal ?? '…'}</span>
                : `🎲 Roll Talent — Roll ${talentRolls.length + 1} of ${reqRolls}`}
            </button>
          )}

          {/* Pending result */}
          {pendingRoll && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col gap-2">
              <p className="text-xs font-mono font-bold text-amber-400">
                🎲 Rolled {pendingRoll.d1} + {pendingRoll.d2} = {pendingRoll.roll}
              </p>
              <p className="text-[11px] text-codex-muted">Edit the description if needed (e.g. specify which weapon or stat).</p>
              <textarea
                value={pendingText}
                onChange={e => setPendingText(e.target.value)}
                rows={2}
                className="w-full bg-codex-surface border border-codex-border rounded-xl px-3 py-2
                  text-xs text-codex-text focus:outline-none focus:border-codex-gold transition-colors resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPendingRoll(null); setPendingText(''); setAnimVal(null) }}
                  className="flex-1 py-2 rounded-lg border border-codex-border text-codex-muted text-xs
                    hover:text-codex-text hover:border-codex-text/40 transition-colors"
                >
                  ↺ Reroll
                </button>
                <button
                  type="button"
                  onClick={confirmTalent}
                  className="flex-1 py-2 rounded-lg border border-codex-gold/40 bg-codex-gold/10
                    text-codex-gold text-xs font-semibold hover:bg-codex-gold/20 transition-colors"
                >
                  ✓ Keep Talent
                </button>
              </div>
            </div>
          )}

          {/* Confirmed talents */}
          {talentRolls.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {talentRolls.map((t, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 shrink-0 pt-0.5 w-5">{t.roll}</span>
                  <span className="text-xs text-codex-subtext flex-1 leading-relaxed">{t.effect}</span>
                  <button
                    type="button"
                    onClick={() => removeTalent(i)}
                    className="text-codex-muted hover:text-red-400 transition-colors text-sm leading-none shrink-0"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 4 — Ability Scores ──────────────────────────────────────────────────

const ANIM_DURATION_MS = 400
const ANIM_INTERVAL_MS = 40

function StatBlock({ statKey, value, rolling, onReroll }) {
  const mod = calcMod(value)
  const modStr = fmtMod(value)
  return (
    <div className={`flex flex-col items-center gap-1 p-3 rounded-xl border bg-codex-surface transition-all duration-150
      ${rolling ? 'border-amber-500/60 animate-pulse' : 'border-codex-border'}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-codex-subtext">
        {STAT_LABELS[statKey]}
      </span>
      <span className={`text-2xl font-bold font-display transition-all ${rolling ? 'text-amber-400' : 'text-codex-text'}`}>
        {value}
      </span>
      <span className={`text-sm font-semibold ${mod >= 0 ? 'text-codex-gold' : 'text-red-400'}`}>
        {modStr}
      </span>
      {onReroll && (
        <button
          onClick={() => onReroll(statKey)}
          disabled={rolling}
          className="mt-1 text-[10px] text-codex-muted hover:text-amber-400 transition-colors disabled:opacity-40 uppercase tracking-wider"
        >
          reroll
        </button>
      )}
    </div>
  )
}

function StepAbilityScores({ data, onChange }) {
  const [mode, setMode] = useState('roll') // 'roll' | 'standard'
  const [rolling, setRolling] = useState({})   // statKey -> bool
  const [diceSets, setDiceSets] = useState({}) // statKey -> [d1, d2, d3]
  const [assignments, setAssignments] = useState({}) // statKey -> value (standard array)
  const animTimers = useRef({})

  const startRollAnim = useCallback((statKey, finalDice, finalSum) => {
    setRolling(r => ({ ...r, [statKey]: true }))
    const end = Date.now() + ANIM_DURATION_MS
    function tick() {
      if (Date.now() >= end) {
        setRolling(r => ({ ...r, [statKey]: false }))
        setDiceSets(d => ({ ...d, [statKey]: finalDice }))
        // Pass only this stat — parent's handleStepChange merges with prev.stats
        // so concurrent animations don't overwrite each other's results
        onChange({ stats: { [statKey]: finalSum } })
        return
      }
      const fake = [rollD6(), rollD6(), rollD6()]
      setDiceSets(d => ({ ...d, [statKey]: fake }))
      onChange({ stats: { [statKey]: fake.reduce((a, b) => a + b, 0) } })
      animTimers.current[statKey] = setTimeout(tick, ANIM_INTERVAL_MS)
    }
    tick()
  }, [onChange])

  function rollStat(statKey) {
    const dice = roll3d6()
    const sum = dice.reduce((a, b) => a + b, 0)
    startRollAnim(statKey, dice, sum)
  }

  function rollAll() {
    STAT_KEYS.forEach((key, i) => {
      setTimeout(() => rollStat(key), i * 60)
    })
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(animTimers.current).forEach(clearTimeout)
    }
  }, [])

  // Standard array assignment
  function getUsedValues() {
    return Object.values(assignments).filter(v => v !== '')
  }

  function getAvailableValues(forKey) {
    const used = getUsedValues().filter(v => v !== assignments[forKey])
    return STANDARD_ARRAY.filter(v => !used.includes(v))
  }

  function handleAssign(statKey, val) {
    const next = { ...assignments, [statKey]: val === '' ? '' : Number(val) }
    setAssignments(next)
    const newStats = { ...data.stats }
    STAT_KEYS.forEach(k => {
      if (next[k] !== '') newStats[k] = Number(next[k])
    })
    onChange({ stats: newStats })
  }

  const allAssigned = mode === 'standard'
    ? STAT_KEYS.every(k => assignments[k] !== '' && assignments[k] !== undefined)
    : true

  const hasAnyRoll = STAT_KEYS.some(k => data.stats[k] !== 10)

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        title="Ability Scores"
        subtitle="Your body, your mind, your fate — distilled to six numbers."
      />

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-codex-border overflow-hidden self-start">
        {['roll', 'standard'].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all
              ${mode === m
                ? 'bg-codex-gold text-codex-bg'
                : 'bg-codex-surface text-codex-subtext hover:text-codex-text'
              }`}
          >
            {m === 'roll' ? 'Roll Dice' : 'Standard Array'}
          </button>
        ))}
      </div>

      {mode === 'roll' && (
        <>
          <button
            onClick={rollAll}
            disabled={Object.values(rolling).some(Boolean)}
            className="self-start px-5 py-2.5 rounded-xl bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {hasAnyRoll ? 'Reroll All Stats' : 'Roll All Stats'}
          </button>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {STAT_KEYS.map(key => (
              <div key={key} className="flex flex-col gap-1">
                <StatBlock
                  statKey={key}
                  value={data.stats[key]}
                  rolling={rolling[key]}
                  onReroll={rollStat}
                />
                {diceSets[key] && (
                  <div className="flex justify-center gap-0.5">
                    {diceSets[key].map((d, i) => (
                      <span key={i} className={`text-[10px] px-1 py-0.5 rounded bg-codex-bg border border-codex-border font-mono
                        ${rolling[key] ? 'text-amber-400' : 'text-codex-muted'}`}>
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {mode === 'standard' && (
        <>
          <p className="text-xs text-codex-subtext">
            Assign these values — each can only be used once:{' '}
            <span className="text-codex-gold font-mono">{STANDARD_ARRAY.join(', ')}</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STAT_KEYS.map(key => {
              const available = getAvailableValues(key)
              const current = assignments[key]
              return (
                <div key={key} className="flex flex-col gap-2 p-3 rounded-xl border border-codex-border bg-codex-surface">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-codex-subtext text-center">
                    {STAT_LABELS[key]}
                  </span>
                  <select
                    value={current ?? ''}
                    onChange={e => handleAssign(key, e.target.value)}
                    className="bg-codex-bg border border-codex-border rounded-lg px-2 py-1.5 text-sm text-codex-text text-center focus:outline-none focus:border-codex-gold transition-colors"
                  >
                    <option value="">—</option>
                    {[...(current ? [current] : []), ...available].sort((a, b) => b - a).map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  {current && (
                    <div className="text-center">
                      <span className={`text-sm font-semibold ${calcMod(current) >= 0 ? 'text-codex-gold' : 'text-red-400'}`}>
                        {fmtMod(current)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Step 5 — Background & Starting Info ─────────────────────────────────────

function StepBackground({ data, onChange }) {
  const selectedBg = BACKGROUNDS.find(b => b.value === data.background)
  const isPriest = data.class_name === 'Priest'

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        title="Background & Starting Info"
        subtitle="Where did you come from? What do you believe? The world will want to know."
      />
      <div className="flex flex-col gap-4">

        {/* Background select */}
        <FieldGroup label="Background" required>
          <select
            value={data.background}
            onChange={e => onChange({ background: e.target.value })}
            className={selectCls}
          >
            <option value="">Choose a background…</option>
            {BACKGROUNDS.map(b => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          {selectedBg && (
            <p className="text-xs text-codex-subtext italic mt-1.5 pl-1">&ldquo;{selectedBg.flavor}&rdquo;</p>
          )}
        </FieldGroup>

        {/* Alignment */}
        <FieldGroup label="Alignment" required>
          <div className="flex gap-2">
            {ALIGNMENTS.map(a => (
              <button
                key={a}
                onClick={() => onChange({ alignment: a })}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all
                  ${data.alignment === a
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-codex-border bg-codex-surface text-codex-subtext hover:border-codex-gold/40 hover:text-codex-text'
                  }`}
              >
                {a}
              </button>
            ))}
          </div>
        </FieldGroup>

        {/* Deity — Priest only */}
        {isPriest && (
          <FieldGroup label="Deity" hint="Name the god or power you serve.">
            <input
              type="text"
              value={data.deity}
              onChange={e => onChange({ deity: e.target.value })}
              placeholder="e.g. Memnon the Blind, Saint Yara"
              className={inputCls}
            />
          </FieldGroup>
        )}

        {/* Languages */}
        <LanguagePicker
          value={data.languages}
          onChange={val => onChange({ languages: val })}
          isHuman={data.ancestry === 'Human'}
        />

      </div>
    </div>
  )
}

// ─── Language Picker ─────────────────────────────────────────────────────────

// Common is always known — not listed as an option.
// Rare languages (Celestial etc.) revealed via "Other +" button.
const LANG_CHIPS = SD_LANGUAGES.common.filter(l => l !== 'Common')
const LANG_ALL   = [...SD_LANGUAGES.common.filter(l => l !== 'Common'), ...SD_LANGUAGES.rare]

function LanguagePicker({ value, onChange, isHuman }) {
  const selected    = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []
  const [showOther, setShowOther] = useState(false)
  const [custom,    setCustom]    = useState('')

  function toggle(lang) {
    const next = selected.includes(lang)
      ? selected.filter(l => l !== lang)
      : [...selected, lang]
    onChange(next.join(', '))
  }

  function addCustom() {
    const trimmed = custom.trim()
    if (!trimmed || selected.includes(trimmed)) { setCustom(''); return }
    onChange([...selected, trimmed].join(', '))
    setCustom('')
    setShowOther(false)
  }

  return (
    <FieldGroup
      label="Additional Languages"
      hint={isHuman ? 'Humans may speak one additional language of their choice.' : undefined}
    >
      {/* Common + Rare chips */}
      <div className="flex flex-wrap gap-1.5">
        {LANG_ALL.map(lang => {
          const isRare = SD_LANGUAGES.rare.includes(lang)
          const active = selected.includes(lang)
          return (
            <button
              key={lang}
              type="button"
              onClick={() => toggle(lang)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                active
                  ? 'border-codex-gold bg-codex-gold/15 text-codex-gold'
                  : isRare
                    ? 'border-codex-border/60 bg-codex-surface/60 text-codex-muted hover:border-codex-gold/30 hover:text-codex-text italic'
                    : 'border-codex-border bg-codex-surface text-codex-subtext hover:border-codex-gold/40 hover:text-codex-text'
              }`}
            >
              {lang}
            </button>
          )
        })}
        {/* Other button — reveals custom input */}
        <button
          type="button"
          onClick={() => setShowOther(v => !v)}
          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
            showOther
              ? 'border-codex-gold/60 bg-codex-gold/10 text-codex-gold'
              : 'border-dashed border-codex-border text-codex-muted hover:border-codex-gold/40 hover:text-codex-text'
          }`}
        >
          {showOther ? '– Other' : '+ Other'}
        </button>
      </div>

      {/* Custom language input — only shown when Other is open */}
      {showOther && (
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="Language name"
            autoFocus
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!custom.trim()}
            className="px-3 py-2.5 rounded-xl border border-codex-gold/40 text-codex-gold text-sm hover:bg-codex-gold/10 transition-colors disabled:opacity-30"
          >Add</button>
        </div>
      )}

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {selected.map(l => (
            <span key={l} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-codex-gold/10 border border-codex-gold/30 text-xs text-codex-gold">
              {l}
              <button type="button" onClick={() => toggle(l)} className="text-codex-muted hover:text-red-400 leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </FieldGroup>
  )
}

// ─── Step 6 — HP & Equipment ─────────────────────────────────────────────────

// All costs/items in the shop as a flat list with category labels
const SHOP_WEAPONS = Object.entries(SD_WEAPONS).sort((a, b) => a[0].localeCompare(b[0])).map(([key, w]) => ({
  item: key.replace(/\b\w/g, c => c.toUpperCase()),
  costGP: toGP(w.cost, w.costUnit),
  costLabel: fmtCost(w.cost, w.costUnit),
  slots: w.slots,
  detail: w.damage,
  category: 'Weapon',
}))
const SHOP_ARMOR = Object.entries(SD_ARMOR).map(([, a]) => ({
  item: a.label,
  costGP: toGP(a.cost, a.costUnit),
  costLabel: fmtCost(a.cost, a.costUnit),
  slots: a.slots,
  detail: a.isShield ? `+${a.ac} AC` : `AC ${a.dexBonus ? `${a.ac}+DEX` : a.ac}`,
  category: 'Armor',
  isArmor: true,
}))
const SHOP_GEAR = SD_BASIC_GEAR.map(g => ({
  item: g.item,
  costGP: toGP(g.cost, g.costUnit),
  costLabel: fmtCost(g.cost, g.costUnit),
  slots: g.slots,
  detail: `${g.slots} slot${g.slots !== 1 ? 's' : ''}`,
  category: 'Gear',
  type: g.type,
}))
const SHOP_ALL = [...SHOP_WEAPONS, ...SHOP_ARMOR, ...SHOP_GEAR]

// Caster classes that get starting spells
const STARTING_SPELL_COUNTS = {
  Wizard:      3,   // 3 Tier 1 spells
  Priest:      2,   // 2 Tier 1 spells
  Necromancer: 2,   // 2 Tier 1 spells
}

function StartingSpellPicker({ data, onChange }) {
  const cls    = data.class_name
  const target = STARTING_SPELL_COUNTS[cls]
  if (!target) return null

  const available  = SD_SPELLS_BY_CLASS[cls]?.[1] ?? []
  const selected   = data.starting_spells ?? []
  const selectedSet = new Set(selected)

  function toggle(name) {
    if (selectedSet.has(name)) {
      onChange({ starting_spells: selected.filter(n => n !== name) })
    } else if (selected.length < target) {
      onChange({ starting_spells: [...selected, name] })
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-codex-gold/30 bg-codex-surface/60 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-1 h-5 bg-codex-gold rounded-full flex-shrink-0" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-codex-gold">
          Starting Spells
        </h3>
        <div className="flex-1 h-px bg-codex-gold/20" />
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${selected.length >= target ? 'text-emerald-400 bg-emerald-900/30 border border-emerald-700/40' : 'text-codex-gold bg-codex-gold/10 border border-codex-gold/30'}`}>
          {selected.length} / {target}
        </span>
      </div>
      <p className="text-xs text-codex-subtext mb-3">
        {cls}s begin with {target} Tier 1 spell{target > 1 ? 's' : ''}. Choose {target === selected.length ? 'done!' : `${target - selected.length} more`}:
      </p>
      <div className="flex flex-wrap gap-2">
        {available.map(name => {
          const isChosen = selectedSet.has(name)
          const isFull   = !isChosen && selected.length >= target
          return (
            <button
              key={name}
              onClick={() => toggle(name)}
              disabled={isFull}
              title={SD_SPELLS[name]?.description}
              className={`
                px-3 py-1.5 rounded-lg border text-sm font-medium transition-all
                ${isChosen
                  ? 'bg-codex-gold/20 border-codex-gold text-codex-gold'
                  : isFull
                  ? 'bg-transparent border-codex-border text-codex-muted opacity-40 cursor-not-allowed'
                  : 'bg-transparent border-codex-border text-codex-subtext hover:border-codex-gold/60 hover:text-codex-text'}
              `}
            >
              {name}
              {isChosen && <span className="ml-1.5 text-[10px]">✓</span>}
            </button>
          )
        })}
      </div>
      {/* Show brief description of last hovered/selected spell */}
      {selected.length > 0 && (
        <div className="mt-3 space-y-1">
          {selected.map(name => (
            <div key={name} className="text-[11px] text-codex-subtext leading-relaxed">
              <span className="text-codex-gold font-semibold">{name}:</span>{' '}
              <span className="text-codex-muted">{SD_SPELLS[name]?.duration} · {SD_SPELLS[name]?.range}</span>{' '}
              — {SD_SPELLS[name]?.description?.slice(0, 100)}{SD_SPELLS[name]?.description?.length > 100 ? '…' : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StepHPGear({ data, onChange }) {
  const hitDieMax   = HIT_DIE_MAX[data.hit_die] ?? 6
  const conMod      = calcMod(data.stats.con)
  const dexMod      = calcMod(data.stats.dex)
  // Dwarf: Stout grants +2 HP at character creation (Shadowdark V4-9, pg. 16)
  const dwarfBonus  = data.ancestry === 'Dwarf' ? 2 : 0
  const hpMax       = Math.max(1, hitDieMax + conMod + dwarfBonus)
  const ac          = 10 + dexMod

  // Push derived HP/AC up on every relevant change
  useEffect(() => {
    onChange({ hp_max: hpMax, hp_current: hpMax, ac })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hpMax, ac])

  // ── Gold section ──────────────────────────────────────────────
  const [goldAnim, setGoldAnim] = useState(null)   // animated display value
  const goldTimerRef = useRef(null)

  function rollGold() {
    const d1 = Math.ceil(Math.random() * 6)
    const d2 = Math.ceil(Math.random() * 6)
    const total = (d1 + d2) * 5
    let ticks = 0
    clearInterval(goldTimerRef.current)
    goldTimerRef.current = setInterval(() => {
      setGoldAnim(Math.ceil(Math.random() * 6 + Math.random() * 6) * 5)
      ticks++
      if (ticks >= 10) {
        clearInterval(goldTimerRef.current)
        setGoldAnim(null)
        onChange({ gold: total, gold_mode: 'rolled' })
      }
    }, 60)
  }
  useEffect(() => () => clearInterval(goldTimerRef.current), [])

  const goldSpent    = (data.shop_items ?? []).reduce((s, i) => s + (i.costGP ?? 0), 0)
  const goldBalance  = (data.gold ?? 0) - goldSpent

  // ── Free kit section ─────────────────────────────────────────
  const [kitAnim, setKitAnim] = useState(null)
  const [kitMode, setKitMode] = useState(null)   // null | 'random' | 'choose'
  const [kitPicks, setKitPicks] = useState([])   // indices chosen in 'choose' mode
  const kitTimerRef = useRef(null)

  function rollKit() {
    let ticks = 0
    clearInterval(kitTimerRef.current)
    kitTimerRef.current = setInterval(() => {
      setKitAnim(Math.ceil(Math.random() * 4))
      ticks++
      if (ticks >= 10) {
        clearInterval(kitTimerRef.current)
        const result = Math.ceil(Math.random() * 4)
        setKitAnim(null)
        setKitMode(null)
        setKitPicks([])
        onChange({ free_kit_roll: result, gear_items: [] })
      }
    }, 60)
  }
  useEffect(() => () => clearInterval(kitTimerRef.current), [])

  function randomizeKit() {
    const count = data.free_kit_roll ?? 0
    const pool  = [...SD_STARTING_GEAR_D12]
    const picks = []
    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length)
      picks.push(pool.splice(idx, 1)[0])
    }
    setKitMode('random')
    setKitPicks([])
    onChange({ gear_items: picks })
  }

  function toggleKitPick(idx) {
    const max = data.free_kit_roll ?? 0
    setKitPicks(prev => {
      if (prev.includes(idx)) {
        const next = prev.filter(i => i !== idx)
        onChange({ gear_items: next.map(i => SD_STARTING_GEAR_D12[i]) })
        return next
      }
      if (prev.length >= max) return prev
      const next = [...prev, idx]
      onChange({ gear_items: next.map(i => SD_STARTING_GEAR_D12[i]) })
      return next
    })
  }

  // ── Shop section ─────────────────────────────────────────────
  const [shopSel, setShopSel] = useState('')
  const [shopCustom, setShopCustom] = useState('')
  const [shopCustomSlots, setShopCustomSlots] = useState(1)

  const selectedEntry = SHOP_ALL.find(e => e.item === shopSel)

  function addShopItem(entry) {
    if (!entry) return
    // Arrows / bolts — tracked as counters, not gear strings
    if (entry.type === 'arrows') {
      onChange({ arrows: 20 })
      setShopSel('')
      return
    }
    if (entry.type === 'bolts') {
      onChange({ bolts: 20 })
      setShopSel('')
      return
    }
    if (goldBalance < entry.costGP) return   // can't afford
    onChange({
      shop_items: [...(data.shop_items ?? []), {
        item:     entry.item,
        costGP:   entry.costGP,
        slots:    entry.slots,
        isArmor:  entry.isArmor ?? false,
      }],
    })
    setShopSel('')
  }

  function addCustomItem() {
    const name = shopCustom.trim()
    if (!name) return
    onChange({
      shop_items: [...(data.shop_items ?? []), { item: name, costGP: 0, slots: shopCustomSlots }],
    })
    setShopCustom('')
    setShopCustomSlots(1)
  }

  function removeShopItem(idx) {
    onChange({ shop_items: (data.shop_items ?? []).filter((_, i) => i !== idx) })
  }

  function removeFreeItem(idx) {
    const next = (data.gear_items ?? []).filter((_, i) => i !== idx)
    onChange({ gear_items: next })
    if (kitMode === 'choose') {
      // Sync kitPicks back (find which d12 indices remain)
      setKitPicks(prev => {
        const remaining = next.map(g => SD_STARTING_GEAR_D12.indexOf(g)).filter(i => i !== -1)
        return remaining
      })
    }
  }

  function addCrawlingKit() {
    if (goldBalance < SD_CRAWLING_KIT.cost) return
    const kitItems = SD_CRAWLING_KIT.items.map(k => ({
      item:    k.item,
      costGP:  0,   // cost absorbed in kit total
      slots:   k.slots,
      isArmor: false,
    }))
    onChange({
      shop_items: [
        ...(data.shop_items ?? []),
        // Add a single "Crawling Kit" entry for cost tracking, then individual items
        { item: 'Crawling Kit', costGP: SD_CRAWLING_KIT.cost, slots: 0, isBundleHeader: true },
        ...kitItems,
      ],
    })
  }

  const hasCrawlingKit = (data.shop_items ?? []).some(i => i.isBundleHeader)

  // All gear lines to show in summary
  const allGear = [
    ...(data.gear_items ?? []).map(g => ({ label: g, free: true })),
    ...(data.shop_items ?? [])
      .filter(i => !i.isBundleHeader)
      .map(i => ({ label: i.item, free: false, costGP: i.costGP })),
    ...(data.arrows > 0 ? [{ label: `Arrows × ${data.arrows}`, free: false, isAmmo: true }] : []),
    ...(data.bolts  > 0 ? [{ label: `Crossbow bolts × ${data.bolts}`, free: false, isAmmo: true }] : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title="Hit Points & Equipment"
        subtitle="Determine your starting health, gold, and the kit that keeps you alive underground."
      />

      {/* ── HP & AC readouts ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatReadout label="Starting HP" value={hpMax}
          subtext={`${data.hit_die} max (${hitDieMax}) + CON (${fmtMod(data.stats.con)})`} accent />
        <StatReadout label="Armor Class" value={ac}
          subtext={`10 + DEX (${fmtMod(data.stats.dex)})`} />
      </div>

      {/* ── Starting Gold ── */}
      <GearSection label="Starting Gold"
        hint="1st-level characters start with 2d6 × 5 gp to spend on gear.">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={rollGold}
            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all
              ${data.gold_mode === 'rolled' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-codex-border text-codex-subtext hover:border-codex-gold/40 hover:text-codex-text'}`}>
            🎲 Roll 2d6 × 5
          </button>
          <button type="button"
            onClick={() => onChange({ gold_mode: data.gold_mode === 'custom' ? null : 'custom' })}
            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all
              ${data.gold_mode === 'custom' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-codex-border text-codex-subtext hover:border-codex-gold/40 hover:text-codex-text'}`}>
            ✏ Set Amount
          </button>
        </div>
        {data.gold_mode === 'custom' && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="number"
              min={0}
              value={data.gold}
              onChange={e => onChange({ gold: Math.max(0, Number(e.target.value)) })}
              className={`${inputCls} w-32`}
            />
            <span className="text-sm text-codex-muted">gp</span>
          </div>
        )}
        {(data.gold > 0 || goldAnim !== null) && (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-display text-amber-400 font-mono">
              {goldAnim !== null ? goldAnim : data.gold} gp
            </span>
            {data.gold > 0 && goldSpent > 0 && (
              <span className="text-sm text-codex-muted">
                — <span className={goldBalance < 0 ? 'text-red-400' : 'text-codex-gold'}>{fmtGP(goldBalance)}</span> remaining
              </span>
            )}
          </div>
        )}
      </GearSection>

      {/* ── Free Starting Kit ── */}
      <GearSection label="0-Level Starting Kit"
        hint="Roll 1d4 to see how many free items you receive from the d12 gear table.">
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={rollKit}
            className="px-4 py-2 rounded-xl border border-codex-border text-sm font-medium text-codex-subtext hover:border-codex-gold/40 hover:text-codex-text transition-all">
            🎲 Roll 1d4
          </button>
          {(kitAnim !== null || data.free_kit_roll !== null) && (
            <span className="text-2xl font-bold font-display text-amber-400 font-mono">
              {kitAnim !== null ? kitAnim : data.free_kit_roll}
            </span>
          )}
          {data.free_kit_roll !== null && kitAnim === null && (
            <span className="text-sm text-codex-muted">
              — you get <strong className="text-codex-text">{data.free_kit_roll}</strong> free {data.free_kit_roll === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {data.free_kit_roll !== null && kitAnim === null && (
          <>
            <div className="flex gap-2 flex-wrap mt-1">
              <button type="button" onClick={randomizeKit}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all
                  ${kitMode === 'random' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-codex-border text-codex-subtext hover:border-codex-gold/40 hover:text-codex-text'}`}>
                🎲 Randomize
              </button>
              <button type="button" onClick={() => { setKitMode('choose'); setKitPicks([]); onChange({ gear_items: [] }) }}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all
                  ${kitMode === 'choose' ? 'border-amber-500 bg-amber-500/10 text-amber-400' : 'border-codex-border text-codex-subtext hover:border-codex-gold/40 hover:text-codex-text'}`}>
                ✅ Choose Items
              </button>
            </div>

            {kitMode === 'choose' && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {SD_STARTING_GEAR_D12.map((item, idx) => {
                  const checked = kitPicks.includes(idx)
                  const maxed   = !checked && kitPicks.length >= (data.free_kit_roll ?? 0)
                  return (
                    <label key={idx}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all
                        ${checked ? 'border-codex-gold bg-codex-gold/10 text-codex-text' : 'border-codex-border text-codex-subtext'}
                        ${maxed ? 'opacity-40 cursor-not-allowed' : 'hover:border-codex-gold/40'}`}>
                      <input type="checkbox" checked={checked} disabled={maxed && !checked}
                        onChange={() => toggleKitPick(idx)} className="accent-codex-gold" />
                      <span className="text-xs font-mono text-codex-muted mr-0.5">{idx + 1}.</span>
                      <span className="text-xs">{item}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </>
        )}
      </GearSection>

      {/* ── Gear Shop ── */}
      {(data.gold > 0 || data.gold_mode === 'custom') && (
        <GearSection label="Buy Equipment"
          hint={`Balance: ${fmtGP(Math.max(0, goldBalance))} — spend your gold on weapons, armor, and gear.`}>

          {/* Backpack tip */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300/80">
            <span className="flex-shrink-0">⚠</span>
            <span>You need a <strong>backpack (2 gp)</strong> to carry gear, or you can only hold <strong>1 item per hand</strong>.</span>
          </div>

          {/* Crawling Kit shortcut */}
          {!hasCrawlingKit && (
            <button type="button"
              onClick={addCrawlingKit}
              disabled={goldBalance < SD_CRAWLING_KIT.cost}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-codex-gold/30 hover:border-codex-gold/60 hover:bg-codex-gold/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <div className="text-left">
                <p className="text-sm font-semibold text-codex-text">⚔ Crawling Kit</p>
                <p className="text-xs text-codex-muted">Backpack, flint & steel, 2 torches, rations, iron spikes, grappling hook, rope 60'</p>
              </div>
              <span className="text-sm font-bold text-codex-gold flex-shrink-0">{SD_CRAWLING_KIT.cost} gp</span>
            </button>
          )}

          {/* Item dropdown */}
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <select
                value={shopSel}
                onChange={e => setShopSel(e.target.value)}
                className={selectCls}
              >
                <option value="">— choose an item —</option>
                <optgroup label="⚔ Weapons">
                  {SHOP_WEAPONS.map(w => (
                    <option key={w.item} value={w.item}>
                      {w.item} · {w.detail} · {w.costLabel}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🛡 Armor">
                  {SHOP_ARMOR.map(a => (
                    <option key={a.item} value={a.item}>
                      {a.item} · {a.detail} · {a.costLabel}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🎒 Gear">
                  {SHOP_GEAR.map(g => (
                    <option key={g.item} value={g.item}>
                      {g.item} · {g.costLabel}
                    </option>
                  ))}
                </optgroup>
                <option value="__custom__">✏ Other (type below)</option>
              </select>
            </div>
            {shopSel && shopSel !== '__custom__' && selectedEntry && (
              <button type="button"
                onClick={() => addShopItem(selectedEntry)}
                disabled={goldBalance < selectedEntry.costGP && selectedEntry.costGP > 0}
                className="px-4 py-2.5 rounded-xl border border-codex-gold/40 text-codex-gold text-sm font-medium hover:bg-codex-gold/10 transition-colors disabled:opacity-30">
                + Add ({selectedEntry.costLabel})
              </button>
            )}
          </div>

          {/* Custom item row */}
          {(shopSel === '__custom__' || (!shopSel && shopCustom)) && (
            <div className="flex gap-2 flex-wrap items-end">
              <input
                type="text"
                value={shopCustom}
                onChange={e => setShopCustom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomItem()}
                placeholder="Item name…"
                className={`${inputCls} flex-1 min-w-[140px]`}
              />
              <div className="flex items-center gap-1">
                <input
                  type="number" min={0} value={shopCustomSlots}
                  onChange={e => setShopCustomSlots(Math.max(0, Number(e.target.value)))}
                  className="w-14 bg-codex-surface border border-codex-border rounded-xl px-2 py-2.5 text-sm text-codex-text text-center focus:outline-none focus:border-codex-gold transition-colors [appearance:textfield]"
                />
                <span className="text-xs text-codex-muted">slots</span>
              </div>
              <button type="button" onClick={addCustomItem} disabled={!shopCustom.trim()}
                className="px-4 py-2.5 rounded-xl border border-codex-gold/40 text-codex-gold text-sm font-medium hover:bg-codex-gold/10 transition-colors disabled:opacity-30">
                + Add (free)
              </button>
            </div>
          )}
        </GearSection>
      )}

      {/* ── Gear Summary ── */}
      {allGear.length > 0 && (
        <GearSection label="Your Gear">
          <div className="flex flex-col gap-1.5">
            {allGear.map((g, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className={`text-[10px] w-5 flex-shrink-0 text-center rounded px-1
                  ${g.free ? 'bg-codex-gold/10 text-codex-gold' : g.isAmmo ? 'bg-blue-500/10 text-blue-400' : 'bg-codex-surface text-codex-muted'}`}>
                  {g.free ? '★' : g.isAmmo ? '🏹' : '🛒'}
                </span>
                <span className="flex-1 text-sm text-codex-text">{g.label}</span>
                {g.costGP > 0 && <span className="text-xs text-codex-muted flex-shrink-0">{fmtGP(g.costGP)}</span>}
                {!g.isAmmo && (
                  <button type="button"
                    onClick={() => g.free
                      ? removeFreeItem((data.gear_items ?? []).findIndex(x => x === g.label))
                      : removeShopItem((data.shop_items ?? []).findIndex(x => x.item === g.label && !x.isBundleHeader))
                    }
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded text-codex-muted hover:text-red-400 flex items-center justify-center text-sm transition-all">
                    ×
                  </button>
                )}
                {g.isAmmo && (
                  <button type="button"
                    onClick={() => g.label.includes('Arrows') ? onChange({ arrows: 0 }) : onChange({ bolts: 0 })}
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded text-codex-muted hover:text-red-400 flex items-center justify-center text-sm transition-all">
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {data.gold > 0 && (
            <div className="flex justify-between items-center border-t border-codex-border pt-2 mt-1">
              <span className="text-xs text-codex-muted">Gold remaining after purchases</span>
              <span className={`text-sm font-bold font-mono ${goldBalance < 0 ? 'text-red-400' : 'text-codex-gold'}`}>
                {fmtGP(Math.max(0, goldBalance))}
              </span>
            </div>
          )}
        </GearSection>
      )}

      {/* ── Starting Spells (caster classes only) ────────────────────── */}
      <StartingSpellPicker data={data} onChange={onChange} />
    </div>
  )
}

function GearSection({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-1 h-4 bg-codex-gold rounded-full flex-shrink-0" />
        <span className="text-xs font-bold uppercase tracking-widest text-codex-gold">{label}</span>
        <div className="flex-1 h-px bg-codex-gold/20" />
      </div>
      {hint && <p className="text-xs text-codex-subtext">{hint}</p>}
      {children}
    </div>
  )
}

function StatReadout({ label, value, subtext, accent }) {
  return (
    <div className={`flex flex-col gap-1 p-4 rounded-xl border bg-codex-surface
      ${accent ? 'border-amber-500/40' : 'border-codex-border'}`}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-codex-subtext">{label}</span>
      <span className={`text-3xl font-bold font-display ${accent ? 'text-amber-400' : 'text-codex-text'}`}>
        {value}
      </span>
      <span className="text-[11px] text-codex-muted leading-relaxed">{subtext}</span>
    </div>
  )
}

// ─── Step 7 — Vibe ────────────────────────────────────────────────────────────

const VIBE_MAX = 1000

function StepVibe({ data, onChange }) {
  const count = (data.vibe ?? '').length

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        title="The Mark of Your Fate"
        subtitle="What omen hangs over you? What shadow precedes your name into a room? Speak of yourself as legend, not biography."
      />
      <div className="flex flex-col gap-2">
        <textarea
          value={data.vibe}
          onChange={e => {
            if (e.target.value.length <= VIBE_MAX) onChange({ vibe: e.target.value })
          }}
          rows={7}
          placeholder="A wanderer of sunless roads, marked by a debt older than memory. Those who look too long into their eyes see something that has already died once — and chosen to return."
          className={`${inputCls} resize-none leading-relaxed`}
        />
        <div className="flex justify-end">
          <span className={`text-[11px] font-mono ${count > VIBE_MAX * 0.9 ? 'text-amber-400' : 'text-codex-muted'}`}>
            {count} / {VIBE_MAX}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputCls = `w-full bg-codex-surface border border-codex-border rounded-xl px-4 py-2.5
  text-sm text-codex-text placeholder:text-codex-muted
  focus:outline-none focus:border-codex-gold transition-colors`

const selectCls = `w-full bg-codex-surface border border-codex-border rounded-xl px-4 py-2.5
  text-sm text-codex-text focus:outline-none focus:border-codex-gold transition-colors`

function StepHeader({ title, subtitle }) {
  return (
    <div className="mb-1">
      <h2 className="text-xl font-display text-codex-gold mb-1">{title}</h2>
      {subtitle && <p className="text-sm text-codex-subtext leading-relaxed">{subtitle}</p>}
    </div>
  )
}

function FieldGroup({ label, required, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-codex-subtext">
          {label}
          {required && <span className="text-amber-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {hint && <p className="text-[11px] text-codex-muted italic">{hint}</p>}
    </div>
  )
}

// ─── Step validation ──────────────────────────────────────────────────────────

function canAdvance(step, data) {
  switch (step) {
    case 1: return data.name.trim().length > 0
    case 2: return Boolean(data.ancestry)
    case 3: {
      if (!data.class_name) return false
      const tTable = CLASS_TALENTS[data.class_name]
      if (!tTable) return true   // no talent table → no roll required
      const rolls = data.talent_rolls ?? []
      let needed = data.ancestry === 'Human' ? 2 : 1
      // Roustabout: each "2" result triggers an additional required roll
      if (data.class_name === 'Roustabout') {
        needed += rolls.filter(t => t.roll === 2).length
      }
      return rolls.length >= needed
    }
    case 4: return STAT_KEYS.every(k => data.stats[k] >= 3 && data.stats[k] <= 18)
    case 5: return Boolean(data.background) && Boolean(data.alignment)
    case 6: return true // hp/ac auto-computed, gear optional
    case 7: return true // vibe optional
    default: return false
  }
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

// Called once via useState lazy-init — name/nickname/title stay EMPTY so users
// don't have to delete anything; the random suggestions live in StepIdentity's
// placeholder text instead.
function createInitialState() {
  return {
    name:       '',
    nickname:   '',
    title:      '',
    ancestry:   '',
    class_name: '',
    hit_die:    '',
    stats:      { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    background: '',
    alignment:  'Neutral',
    deity:      '',
    languages:  '',
    hp_max:     4,
    hp_current: 4,
    ac:         10,
    // Gold & gear tracking
    gold:          0,        // starting gp (rolled or entered)
    gold_mode:     null,     // null | 'rolled' | 'custom'
    free_kit_roll: null,     // null | 1-4  (the 1d4 result)
    gear_items:    [],       // free kit strings
    shop_items:    [],       // [{ item, costGP, slots, type? }]
    arrows:        0,        // 0-20
    bolts:         0,        // 0-20
    talent_rolls:    [],       // [{ roll: number, effect: string }]
    starting_spells: [],       // [name: string] — chosen in StepHPGear
    vibe:            '',
  }
}

export default function ShadowdarkWizard({ onComplete, onCancel }) {
  const [step, setStep] = useState(1)
  // Lazy init: function is called once on mount, giving unique values each time
  const [data, setData] = useState(createInitialState)
  const TOTAL_STEPS = 7

  function update(patch) {
    setData(prev => ({ ...prev, ...patch }))
  }

  function handleStepChange(patch) {
    if (patch.stats) {
      setData(prev => ({ ...prev, stats: { ...prev.stats, ...patch.stats } }))
    } else {
      setData(prev => ({ ...prev, ...patch }))
    }
  }

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep(s => s + 1)
    } else {
      handleFinish()
    }
  }

  function handleBack() {
    if (step > 1) setStep(s => s - 1)
  }

  function handleFinish() {
    function parseSlots(itemStr) {
      const match = String(itemStr).match(/\((\d+)\s*slots?\)/i)
      return match ? parseInt(match[1], 10) : 1
    }

    // Merge free kit strings + purchased items → typed gear objects for the sheet
    const freeGear = (data.gear_items ?? [])
      .filter(g => String(g).trim())
      .map(g => ({ item: String(g).trim(), slots: parseSlots(g), equipped: false, type: detectWeapon(g) ? 'weapon' : 'gear', notes: '' }))

    const boughtGear = (data.shop_items ?? [])
      .filter(i => i.item && !i.type)   // exclude ammo entries (handled by arrows/bolts fields)
      .map(i => ({
        item:     i.item,
        slots:    i.slots ?? 1,
        equipped: false,
        type:     detectWeapon(i.item) ? 'weapon' : (i.isArmor ? 'armor' : 'gear'),
        notes:    '',
      }))

    const gear = [...freeGear, ...boughtGear]

    // Compute remaining gold after purchases
    const spent = (data.shop_items ?? []).reduce((s, i) => s + (i.costGP ?? 0), 0)

    // All gear strings for attack auto-detection
    const allItemStrings = [
      ...(data.gear_items ?? []),
      ...(data.shop_items ?? []).map(i => i.item),
    ]

    const sheetData = {
      name:       data.name,
      nickname:   data.nickname,
      title:      data.title,
      ancestry:   data.ancestry,
      class_name: data.class_name,
      hit_die:    data.hit_die,
      stats:      data.stats,
      background: data.background,
      alignment:  data.alignment,
      deity:      data.deity,
      languages:  data.languages,
      hp_max:     data.hp_max,
      hp_current: data.hp_current,
      ac:         data.ac,
      gold:       Math.max(0, (data.gold ?? 0) - spent),
      arrows:     data.arrows ?? 0,
      bolts:      data.bolts  ?? 0,
      gear,
      attacks: (() => {
        const wa = gearToAttacks(allItemStrings, data.stats)
        return wa.length > 0 ? wa : [{ weapon: '', bonus: '', damage: '', notes: '' }]
      })(),
      talents: (data.talent_rolls ?? []).map(t => ({ name: 'Talent', description: t.effect })),
      spells: (data.starting_spells ?? []).map(name => {
        const s = SD_SPELLS[name]
        if (!s) return { name, tier: 1, failed: false, custom: true, duration: '', range: '', description: '' }
        return { name, tier: s.tier, failed: false, custom: false, duration: s.duration, range: s.range, description: s.description }
      }),
      notes:   '',
      vibe:    data.vibe,
    }
    onComplete(sheetData)
  }

  const ready = canAdvance(step, data)

  function renderStep() {
    switch (step) {
      case 1: return <StepIdentity data={data} onChange={update} />
      case 2: return <StepAncestry data={data} onChange={update} />
      case 3: return <StepClass data={data} onChange={update} />
      case 4: return <StepAbilityScores data={data} onChange={handleStepChange} />
      case 5: return <StepBackground data={data} onChange={update} />
      case 6: return <StepHPGear data={data} onChange={update} />
      case 7: return <StepVibe data={data} onChange={update} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-codex-bg py-10 px-4 font-body">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display text-codex-text">New Character</h1>
            <p className="text-xs text-codex-muted mt-1 uppercase tracking-wider">
              Shadowdark &bull; Character Creation
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-codex-muted hover:text-codex-text text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-codex-surface border border-transparent hover:border-codex-border"
          >
            Cancel
          </button>
        </div>

        {/* Progress bar */}
        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* Step card */}
        <div className="bg-codex-card border border-codex-border rounded-2xl overflow-hidden shadow-card">
          {/* Gold accent line */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-60" />

          <div className="p-6 sm:p-8">
            {renderStep()}
          </div>

          {/* Navigation */}
          <div className="px-6 sm:px-8 pb-6 pt-2 flex items-center gap-3">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="px-5 py-2.5 rounded-xl border border-codex-border text-codex-subtext text-sm font-medium
                hover:border-codex-text hover:text-codex-text transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-codex-border disabled:hover:text-codex-subtext"
            >
              Back
            </button>
            <div className="flex-1" />
            <button
              onClick={handleNext}
              disabled={!ready}
              className="px-6 py-2.5 rounded-xl bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm
                transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === TOTAL_STEPS ? 'Create Character' : 'Next'}
            </button>
          </div>
        </div>

        {/* Step counter */}
        <p className="text-center text-xs text-codex-muted mt-4">
          Step {step} of {TOTAL_STEPS} — {STEP_LABELS[step - 1]}
        </p>

      </div>
    </div>
  )
}
