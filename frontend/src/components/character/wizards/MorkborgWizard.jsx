import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6

// Canonical classes from Mörk Borg Rules Reference
// Classless = base; optional classes from the d6 table (pp. 46-57)
const CLASSES = [
  {
    name: 'Classless',
    description: 'No divine favor. No special powers. Just a wretch trying to survive the end of the world.',
    omenDie: 2,
    hpDie: 8,
  },
  {
    name: 'Fanged Deserter',
    description: 'Your parliament of teeth — enormous, protruding, thick and sharp — have always been your allies. Built like a bull, you deserted some forgotten war.',
    omenDie: 2,
    hpDie: 10,
  },
  {
    name: 'Gutter Born Scum',
    description: 'An ill star smiled upon your birth. Poverty, crime and bad parenting didn\'t help. A razor blade and a moonless night are worth a week of honest work.',
    omenDie: 2,
    hpDie: 6,
  },
  {
    name: 'Esoteric Hermit',
    description: 'The stone of your cave is one with the stars. Silence and perfection. Now the chaos of a fallen world disturbs your rituals.',
    omenDie: 4,
    hpDie: 4,
  },
  {
    name: 'Wretched Royalty',
    description: 'Slowed only by the memories of your own lost glory, you could never submit to anyone else. Not you, of noble blood.',
    omenDie: 2,
    hpDie: 6,
  },
  {
    name: 'Heretical Priest',
    description: 'Hunted by the Two-Headed Basilisks of the One True Faith, raving in ruins, traipsing dusty roads and desecrating cathedrals by night.',
    omenDie: 4,
    hpDie: 8,
  },
  {
    name: 'Occult Herbmaster',
    description: 'Born of the mushroom, raised in the glade, watched by the eye of the moon. You brew horrors and cures alike from your portable laboratory.',
    omenDie: 2,
    hpDie: 6,
  },
]

// Canonical d10 weapon table
const MB_WEAPONS = [
  { name: 'Femur',      damage: 'd4',  notes: '' },
  { name: 'Staff',      damage: 'd4',  notes: '' },
  { name: 'Shortsword', damage: 'd4',  notes: '' },
  { name: 'Knife',      damage: 'd4',  notes: '' },
  { name: 'Warhammer',  damage: 'd6',  notes: '' },
  { name: 'Sword',      damage: 'd6',  notes: '' },
  { name: 'Bow',        damage: 'd6',  notes: 'Presence+10 arrows' },
  { name: 'Flail',      damage: 'd8',  notes: '' },
  { name: 'Crossbow',   damage: 'd8',  notes: 'Presence+10 bolts' },
  { name: 'Zweihänder', damage: 'd10', notes: 'Two-handed' },
]

// d6 starting container table (1-2 = nothing)
const MB_D6_TABLE = [
  null, null,
  'Backpack (holds 7 items)',
  'Sack (holds 10 items)',
  'Small wagon',
  'Donkey',
]

// Starting gear: roll BOTH d12 tables and take one item from each (Mörk Borg, pg. 19)
// Table 1 (first d12)
const MB_D12_TABLE_1 = [
  'Rope (30 feet)',
  'Torches (Presence+4)',
  'Lantern with oil (Presence+6 hours)',
  'Magnesium strip',
  'Random unclean scroll',
  'Sharp needle',
  'Medicine chest — Presence+4 uses, stops bleeding/infection, heals d6 HP',
  'Metal file and lockpicks',
  'Bear trap — Presence DR14 to spot, d8 damage',
  'Bomb — sealed bottle, d10 damage',
  'Red poison — d4 doses, Toughness DR12 or d10 damage',
  'Silver crucifix',
]
// Table 2 (second d12)
const MB_D12_TABLE_2 = [
  'Life elixir — d4 doses, heals d6 HP, removes infection',
  'Random sacred scroll',
  'Small but vicious dog — d6+2 HP, bite d4, only obeys you',
  'd4 monkeys that love you (d4+2 HP, punch/bite d4)',
  'Exquisite perfume (worth 25s)',
  'Toolbox — 10 nails, tongs, hammer, small saw and drill',
  'Heavy chain (15 feet)',
  'Grappling hook',
  'Shield — ignore one attack but shield breaks',
  'Crowbar (d4 damage)',
  'Lard — may function as 5 meals in a pinch',
  'Tent',
]

// Armor tier example names
const ARMOR_NAMES_BY_TIER = {
  1: ['Fur', 'Padded cloth', 'Leather'],
  2: ['Scale mail', 'Chain mail'],
  3: ['Splint', 'Plate mail'],
}

// Per-class silver dice formula
function rollSilverForClass(className) {
  switch (className) {
    case 'Gutter Born Scum':   return roll(6) * 10
    case 'Esoteric Hermit':    return roll(6) * 10
    case 'Wretched Royalty':   return roll(6) + roll(6) + roll(6) + roll(6) + 10
    case 'Fanged Deserter':    return (roll(6) + roll(6)) * 10
    case 'Occult Herbmaster':  return (roll(6) + roll(6)) * 10
    case 'Heretical Priest':   return (roll(6) + roll(6) + roll(6)) * 10
    default:                   return (roll(6) + roll(6)) * 10  // Classless: 2d6×10
  }
}

function silverDiceLabel(className) {
  switch (className) {
    case 'Gutter Born Scum':  return 'd6×10'
    case 'Esoteric Hermit':   return 'd6×10'
    case 'Wretched Royalty':  return '4d6+10'
    case 'Heretical Priest':  return '3d6×10'
    default:                  return '2d6×10'
  }
}

const ABILITIES = ['strength', 'agility', 'presence', 'toughness']
const ABILITY_LABELS = {
  strength: 'STRENGTH',
  agility: 'AGILITY',
  presence: 'PRESENCE',
  toughness: 'TOUGHNESS',
}

// ─── Dice helpers ─────────────────────────────────────────────────────────────

function roll(sides) {
  return Math.floor(Math.random() * sides) + 1
}

function roll3d6() {
  return [roll(6), roll(6), roll(6)]
}

// Mörk Borg ability modifier table (pg. 26)
// 3d6 sum → modifier:  1-4 = -3 | 5-6 = -2 | 7-8 = -1 | 9-12 = 0 | 13-14 = +1 | 15-16 = +2 | 17-20 = +3
function sumToMod(sum) {
  if (sum <= 4)  return -3
  if (sum <= 6)  return -2
  if (sum <= 8)  return -1
  if (sum <= 12) return 0
  if (sum <= 14) return 1
  if (sum <= 16) return 2
  return 3  // 17+
}

function rollAbility() {
  const dice = roll3d6()
  const sum = dice.reduce((a, b) => a + b, 0)
  return { dice, sum, mod: sumToMod(sum) }
}

function getClassData(className) {
  return CLASSES.find(c => c.name === className) ?? CLASSES[0]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GrimInput({ value, onChange, placeholder, className = '', maxLength }) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`
        w-full bg-black border border-yellow-300/20 rounded
        px-3 py-2 text-sm text-yellow-100 font-mono
        placeholder-yellow-300/20
        focus:outline-none focus:border-yellow-300/50 focus:ring-1 focus:ring-yellow-300/10
        transition-colors
        ${className}
      `}
    />
  )
}

function SectionLabel({ children }) {
  return (
    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-300/60 font-mono">
      {children}
    </span>
  )
}

function GrimButton({ onClick, children, variant = 'primary', className = '', disabled = false, type = 'button' }) {
  const base = 'font-mono font-black uppercase tracking-widest text-xs px-4 py-2 rounded transition-all duration-150 border disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-yellow-300 text-black border-yellow-300 hover:bg-yellow-200',
    ghost:   'bg-transparent text-yellow-300 border-yellow-300/30 hover:border-yellow-300/60 hover:bg-yellow-300/5',
    danger:  'bg-transparent text-red-400 border-red-400/30 hover:border-red-400/60 hover:bg-red-400/5',
    roll:    'bg-zinc-900 text-yellow-300 border-yellow-300/30 hover:bg-zinc-800 hover:border-yellow-300/60 px-3 py-1.5',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const stepNum = i + 1
        const isDone = stepNum < currentStep
        const isCurrent = stepNum === currentStep
        return (
          <div key={stepNum} className="flex items-center">
            <div
              className={`
                w-8 h-8 rounded-full border-2 flex items-center justify-center
                font-mono font-black text-xs transition-all duration-300
                ${isDone
                  ? 'bg-yellow-300 border-yellow-300 text-black'
                  : isCurrent
                    ? 'bg-transparent border-yellow-300 text-yellow-300'
                    : 'bg-transparent border-yellow-300/20 text-yellow-300/20'
                }
              `}
            >
              {isDone ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : stepNum}
            </div>
            {i < TOTAL_STEPS - 1 && (
              <div className={`w-6 h-px mx-1 transition-all duration-300 ${stepNum < currentStep ? 'bg-yellow-300/60' : 'bg-yellow-300/10'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Rolling animation hook ───────────────────────────────────────────────────

// ─── Step 1: Identity ─────────────────────────────────────────────────────────

function StepIdentity({ data, onChange }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-widest text-yellow-300 font-mono mb-1">
          IDENTITY
        </h2>
        <p className="text-yellow-300/40 font-mono text-xs uppercase tracking-widest">
          Who were you before the world started dying?
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <SectionLabel>Name *</SectionLabel>
          <GrimInput
            value={data.name}
            onChange={e => onChange('name', e.target.value)}
            placeholder="The name the living gave you"
          />
        </div>

        <div className="space-y-1.5">
          <SectionLabel>Sobriquet</SectionLabel>
          <GrimInput
            value={data.nickname}
            onChange={e => onChange('nickname', e.target.value)}
            placeholder="What they whisper after you pass"
          />
        </div>

        <div className="space-y-1.5">
          <SectionLabel>What You Look Like</SectionLabel>
          <GrimInput
            value={data.description}
            onChange={e => onChange('description', e.target.value)}
            placeholder="Gaunt. Hollow-eyed. Reeking of tallow and regret."
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Class ────────────────────────────────────────────────────────────

function StepClass({ data, onChange }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-widest text-yellow-300 font-mono mb-1">
          CLASS
        </h2>
        <p className="text-yellow-300/40 font-mono text-xs uppercase tracking-widest">
          What manner of wretch are you?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 max-h-[420px] overflow-y-auto pr-1">
        {CLASSES.map(cls => {
          const selected = data.class_name === cls.name
          return (
            <button
              key={cls.name}
              type="button"
              onClick={() => onChange('class_name', cls.name)}
              className={`
                text-left p-4 rounded border transition-all duration-150
                ${selected
                  ? 'bg-yellow-300/10 border-yellow-300/60 ring-1 ring-yellow-300/20'
                  : 'bg-black border-yellow-300/20 hover:border-yellow-300/40 hover:bg-yellow-300/5'
                }
              `}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-mono font-black uppercase tracking-widest text-sm ${selected ? 'text-yellow-300' : 'text-yellow-100/80'}`}>
                      {cls.name}
                    </span>
                    {selected && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-yellow-300 text-black px-1.5 py-0.5 rounded font-mono">
                        CHOSEN
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-yellow-300/50 font-mono leading-relaxed">
                    {cls.description}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                  <span className="text-[9px] font-mono text-yellow-300/40 uppercase tracking-widest">HP d{cls.hpDie}</span>
                  <span className="text-[9px] font-mono text-yellow-300/40 uppercase tracking-widest">Omen d{cls.omenDie}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 3: Abilities ────────────────────────────────────────────────────────

function AbilityRollBox({ ability, rollState, onReroll, rolling }) {
  const mod = rollState?.mod ?? 0
  const dice = rollState?.dice ?? [null, null, null]
  const modColor = mod > 0 ? 'text-yellow-300' : mod < 0 ? 'text-red-400' : 'text-yellow-100/50'
  const isRolling = rolling[ability]

  return (
    <div className="bg-black border border-yellow-300/20 rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-yellow-300/60 font-mono">
          {ABILITY_LABELS[ability]}
        </span>
        <button
          type="button"
          onClick={() => onReroll(ability)}
          disabled={isRolling}
          className="text-[9px] font-mono uppercase tracking-widest text-yellow-300/40 hover:text-yellow-300/80 border border-yellow-300/20 hover:border-yellow-300/40 px-2 py-0.5 rounded transition-all disabled:opacity-40"
        >
          {isRolling ? '...' : 'REROLL'}
        </button>
      </div>

      <div className={`text-5xl font-black font-mono text-center leading-none ${modColor} ${isRolling ? 'animate-pulse' : ''}`}>
        {mod > 0 ? `+${mod}` : `${mod}`}
      </div>

      <div className="flex justify-center gap-2">
        {dice.map((d, i) => (
          <div
            key={i}
            className={`w-7 h-7 border border-yellow-300/20 rounded flex items-center justify-center text-xs font-mono font-black ${isRolling ? 'text-yellow-300/60 animate-pulse' : 'text-yellow-300/40'}`}
          >
            {d ?? '?'}
          </div>
        ))}
        <div className="w-7 h-7 border border-yellow-300/10 rounded flex items-center justify-center text-[9px] font-mono text-yellow-300/20">
          {rollState?.sum ?? '?'}
        </div>
      </div>
    </div>
  )
}

function AbilityManualBox({ ability, value, onChange }) {
  const mod = Number(value)
  const modColor = mod > 0 ? 'text-yellow-300' : mod < 0 ? 'text-red-400' : 'text-yellow-100/50'

  return (
    <div className="bg-black border border-yellow-300/20 rounded p-4 space-y-3">
      <span className="block text-[9px] font-black uppercase tracking-[0.25em] text-yellow-300/60 font-mono">
        {ABILITY_LABELS[ability]}
      </span>
      <div className={`text-5xl font-black font-mono text-center leading-none ${modColor}`}>
        {mod > 0 ? `+${mod}` : `${mod}`}
      </div>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => onChange(ability, Math.max(-3, mod - 1))}
          className="w-7 h-7 border border-yellow-300/20 rounded text-yellow-300/60 hover:text-yellow-300 hover:border-yellow-300/40 font-mono font-black text-sm transition-all"
        >
          -
        </button>
        <input
          type="number"
          min={-3}
          max={3}
          value={value}
          onChange={e => onChange(ability, Math.max(-3, Math.min(3, Number(e.target.value))))}
          className="
            w-12 text-center text-sm font-mono text-yellow-300/60 bg-transparent
            border border-yellow-300/10 rounded px-1 py-0.5
            focus:outline-none focus:border-yellow-300/40
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
          "
        />
        <button
          type="button"
          onClick={() => onChange(ability, Math.min(3, mod + 1))}
          className="w-7 h-7 border border-yellow-300/20 rounded text-yellow-300/60 hover:text-yellow-300 hover:border-yellow-300/40 font-mono font-black text-sm transition-all"
        >
          +
        </button>
      </div>
    </div>
  )
}

function StepAbilities({ data, onChange, mode, setMode, onAllRolled }) {
  const [rollStates, setRollStates] = useState({
    strength: null, agility: null, presence: null, toughness: null,
  })
  const [rolling, setRolling] = useState({
    strength: false, agility: false, presence: false, toughness: false,
  })
  const timerRefs = useRef({})

  const animateAbility = useCallback((ability, finalResult) => {
    setRolling(prev => ({ ...prev, [ability]: true }))
    const start = Date.now()
    const duration = 400

    const tick = () => {
      if (Date.now() - start < duration) {
        const tempDice = [roll(6), roll(6), roll(6)]
        const tempSum = tempDice.reduce((a, b) => a + b, 0)
        setRollStates(prev => ({
          ...prev,
          [ability]: { dice: tempDice, sum: tempSum, mod: sumToMod(tempSum) },
        }))
        timerRefs.current[ability] = setTimeout(tick, 60)
      } else {
        setRollStates(prev => {
          const next = { ...prev, [ability]: finalResult }
          if (ABILITIES.every(a => next[a] !== null)) onAllRolled?.()
          return next
        })
        setRolling(prev => ({ ...prev, [ability]: false }))
        onChange(`abilities.${ability}`, finalResult.mod)
      }
    }
    tick()
  }, [onChange, onAllRolled])

  const handleReroll = useCallback((ability) => {
    if (rolling[ability]) return
    if (timerRefs.current[ability]) clearTimeout(timerRefs.current[ability])
    const result = rollAbility()
    animateAbility(ability, result)
  }, [rolling, animateAbility])

  const handleRollAll = useCallback(() => {
    const anyRolling = Object.values(rolling).some(Boolean)
    if (anyRolling) return
    ABILITIES.forEach((ability, i) => {
      setTimeout(() => {
        const result = rollAbility()
        animateAbility(ability, result)
      }, i * 100)
    })
  }, [rolling, animateAbility])

  const handleManualChange = useCallback((ability, value) => {
    onChange(`abilities.${ability}`, value)
  }, [onChange])

  useEffect(() => {
    return () => {
      Object.values(timerRefs.current).forEach(t => { if (t) clearTimeout(t) })
    }
  }, [])

  const anyRolling = Object.values(rolling).some(Boolean)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-widest text-yellow-300 font-mono mb-1">
          ABILITIES
        </h2>
        <p className="text-yellow-300/40 font-mono text-xs uppercase tracking-widest">
          What fate has granted. Or withheld.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('roll')}
          className={`font-mono font-black uppercase tracking-widest text-xs px-4 py-1.5 rounded border transition-all ${mode === 'roll' ? 'bg-yellow-300 text-black border-yellow-300' : 'bg-transparent text-yellow-300/50 border-yellow-300/20 hover:border-yellow-300/40'}`}
        >
          ROLL
        </button>
        <button
          type="button"
          onClick={() => { setMode('manual'); onAllRolled?.() }}
          className={`font-mono font-black uppercase tracking-widest text-xs px-4 py-1.5 rounded border transition-all ${mode === 'manual' ? 'bg-yellow-300 text-black border-yellow-300' : 'bg-transparent text-yellow-300/50 border-yellow-300/20 hover:border-yellow-300/40'}`}
        >
          ASSIGN
        </button>
      </div>

      {mode === 'roll' && (
        <div className="space-y-4">
          <GrimButton onClick={handleRollAll} disabled={anyRolling} variant="ghost">
            {anyRolling ? 'ROLLING...' : 'ROLL ALL'}
          </GrimButton>
          <div className="grid grid-cols-2 gap-3">
            {ABILITIES.map(ability => (
              <AbilityRollBox
                key={ability}
                ability={ability}
                rollState={rollStates[ability]}
                onReroll={handleReroll}
                rolling={rolling}
              />
            ))}
          </div>
          {ABILITIES.some(a => rollStates[a] === null) && (
            <p className="text-yellow-300/30 font-mono text-xs text-center">
              Roll all four abilities to continue.
            </p>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <div className="space-y-4">
          <p className="text-yellow-300/30 font-mono text-xs italic">
            "Total spread cannot exceed 6 points, but fate does not follow rules."
          </p>
          <div className="grid grid-cols-2 gap-3">
            {ABILITIES.map(ability => (
              <AbilityManualBox
                key={ability}
                ability={ability}
                value={data.abilities[ability]}
                onChange={handleManualChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 4: HP, Omens, Silver ────────────────────────────────────────────────

function RollResultBlock({ label, value, onRoll, rolling, flavourDie, children }) {
  return (
    <div className="bg-black border border-yellow-300/20 rounded p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-yellow-300/60 font-mono">
          {label}
        </span>
        <button
          type="button"
          onClick={onRoll}
          disabled={rolling}
          className="text-[9px] font-mono uppercase tracking-widest text-yellow-300/40 hover:text-yellow-300/80 border border-yellow-300/20 hover:border-yellow-300/40 px-2 py-0.5 rounded transition-all disabled:opacity-40"
        >
          {rolling ? '...' : (flavourDie === '?' ? 'ROLL' : `ROLL d${flavourDie}`)}
        </button>
      </div>
      <div className={`text-6xl font-black font-mono text-center text-yellow-300 leading-none ${rolling ? 'animate-pulse' : ''}`}>
        {value ?? '—'}
      </div>
      {children}
    </div>
  )
}

function StepResources({ data, onChange, classData }) {
  const [rollingHp, setRollingHp] = useState(false)
  const [rollingOmens, setRollingOmens] = useState(false)
  const [rollingSilver, setRollingSilver] = useState(false)
  const timers = useRef({})

  const animateRoll = useCallback((sides, setFlag, onSettle) => {
    setFlag(true)
    const start = Date.now()
    const duration = 400
    const tick = () => {
      if (Date.now() - start < duration) {
        onSettle(Math.floor(Math.random() * sides) + 1, true)
        timers.current[sides] = setTimeout(tick, 60)
      } else {
        const final = Math.floor(Math.random() * sides) + 1
        onSettle(final, false)
        setFlag(false)
      }
    }
    tick()
  }, [])

  const handleRollHp = useCallback(() => {
    if (rollingHp) return
    const hpDie = classData.hpDie
    animateRoll(hpDie, setRollingHp, (val, interim) => {
      const raw = Math.max(1, val + (data.abilities?.toughness ?? 0))
      if (!interim) {
        onChange('hp_max', raw)
        onChange('hp_current', raw)
      } else {
        onChange('hp_max', raw)
        onChange('hp_current', raw)
      }
    })
  }, [rollingHp, classData, data.abilities, animateRoll, onChange])

  const handleRollOmens = useCallback(() => {
    if (rollingOmens) return
    animateRoll(classData.omenDie, setRollingOmens, (val) => {
      onChange('omens', val)
    })
  }, [rollingOmens, classData, animateRoll, onChange])

  const handleRollSilver = useCallback(() => {
    if (rollingSilver) return
    setRollingSilver(true)
    const finalVal = rollSilverForClass(classData.name)
    const start = Date.now()
    const duration = 400
    const tick = () => {
      if (Date.now() - start < duration) {
        onChange('silver', rollSilverForClass(classData.name))
        timers.current['silver'] = setTimeout(tick, 60)
      } else {
        onChange('silver', finalVal)
        setRollingSilver(false)
      }
    }
    tick()
  }, [rollingSilver, classData, onChange])

  useEffect(() => {
    return () => { Object.values(timers.current).forEach(t => { if (t) clearTimeout(t) }) }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-widest text-yellow-300 font-mono mb-1">
          HIT POINTS & OMENS
        </h2>
        <p className="text-yellow-300/40 font-mono text-xs uppercase tracking-widest italic">
          "What the dying world allows you."
        </p>
      </div>

      <div className="space-y-1.5 text-xs font-mono text-yellow-300/40 bg-yellow-300/5 border border-yellow-300/10 rounded px-3 py-2">
        <span>Class: <span className="text-yellow-300/70">{classData.name}</span></span>
        <span className="mx-3">|</span>
        <span>HP die: <span className="text-yellow-300/70">d{classData.hpDie}</span></span>
        <span className="mx-3">|</span>
        <span>Omen die: <span className="text-yellow-300/70">d{classData.omenDie}</span></span>
        <span className="mx-3">|</span>
        <span>Toughness: <span className="text-yellow-300/70">{data.abilities?.toughness >= 0 ? `+${data.abilities?.toughness}` : data.abilities?.toughness}</span></span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <RollResultBlock
          label="Hit Points"
          value={data.hp_max}
          onRoll={handleRollHp}
          rolling={rollingHp}
          flavourDie={classData.hpDie}
        >
          <p className="text-yellow-300/25 font-mono text-[10px] text-center">
            d{classData.hpDie} + Toughness ({data.abilities?.toughness >= 0 ? '+' : ''}{data.abilities?.toughness ?? 0}), minimum 1
          </p>
          <div className="flex items-center justify-center gap-2">
            <button type="button" onClick={() => { onChange('hp_max', Math.max(1, (data.hp_max ?? 1) - 1)); onChange('hp_current', Math.max(1, (data.hp_max ?? 1) - 1)) }}
              className="w-7 h-7 border border-yellow-300/20 rounded text-yellow-300/60 hover:text-yellow-300 hover:border-yellow-300/40 font-mono font-black text-sm transition-all">-</button>
            <span className="text-yellow-300/50 font-mono text-xs w-8 text-center">{data.hp_max ?? '—'}</span>
            <button type="button" onClick={() => { onChange('hp_max', (data.hp_max ?? 1) + 1); onChange('hp_current', (data.hp_max ?? 1) + 1) }}
              className="w-7 h-7 border border-yellow-300/20 rounded text-yellow-300/60 hover:text-yellow-300 hover:border-yellow-300/40 font-mono font-black text-sm transition-all">+</button>
          </div>
        </RollResultBlock>

        <div className="grid grid-cols-2 gap-4">
          <RollResultBlock
            label="Omens"
            value={data.omens}
            onRoll={handleRollOmens}
            rolling={rollingOmens}
            flavourDie={classData.omenDie}
          >
            <p className="text-yellow-300/25 font-mono text-[10px] text-center">d{classData.omenDie}</p>
          </RollResultBlock>

          <RollResultBlock
            label="Silver"
            value={data.silver}
            onRoll={handleRollSilver}
            rolling={rollingSilver}
            flavourDie={'?'}
          >
            <p className="text-yellow-300/25 font-mono text-[10px] text-center">{silverDiceLabel(classData.name)}</p>
          </RollResultBlock>
        </div>
      </div>
    </div>
  )
}

// ─── Step 5: Starting Gear ────────────────────────────────────────────────────

function StepEquipment({ data, onChange }) {
  const [weaponPick, setWeaponPick] = useState('')
  const weapons   = data.weapons   ?? []
  const equipment = data.equipment ?? []

  // ── Weapon helpers ──
  function addPickedWeapon() {
    const w = MB_WEAPONS.find(x => x.name === weaponPick)
    if (!w) return
    onChange('weapons', [...weapons, { ...w }])
    setWeaponPick('')
  }
  function rollWeapon() {
    const w = MB_WEAPONS[roll(10) - 1]
    onChange('weapons', [...weapons, { ...w }])
  }
  function removeWeapon(i) {
    onChange('weapons', weapons.filter((_, idx) => idx !== i))
  }

  // ── Armor helpers ──
  function setArmorTier(tier) {
    onChange('armor_tier', tier)
    if (tier === 0) onChange('armor_name', '')
  }
  function rollArmor() {
    const tierResult = roll(4) - 1   // 0=none, 1=light, 2=medium, 3=heavy
    onChange('armor_tier', tierResult)
    if (tierResult > 0) {
      const names = ARMOR_NAMES_BY_TIER[tierResult]
      onChange('armor_name', names[Math.floor(Math.random() * names.length)])
    } else {
      onChange('armor_name', '')
    }
  }

  // ── Misc equipment helpers ──
  function addEquipItem(item) {
    onChange('equipment', [...equipment, { item }])
  }
  function removeEquipItem(i) {
    onChange('equipment', equipment.filter((_, idx) => idx !== i))
  }
  function changeEquipItem(i, val) {
    onChange('equipment', equipment.map((e, idx) => idx === i ? { item: val } : e))
  }
  function rollD6Item() {
    const item = MB_D6_TABLE[roll(6) - 1]
    if (item) addEquipItem(item)
    // 1-2 = nothing, skip
  }
  // Rules: roll BOTH d12 tables and receive one item from each (pg. 19)
  function rollD12Items() {
    const item1 = MB_D12_TABLE_1[roll(12) - 1]
    const item2 = MB_D12_TABLE_2[roll(12) - 1]
    addEquipItem(item1)
    addEquipItem(item2)
  }
  function rollFood() {
    addEquipItem(`${roll(4)} food rations`)
  }

  const armorTier = data.armor_tier ?? 0
  const armorName = data.armor_name ?? ''
  const ARMOR_TIERS = [
    { value: 0, label: 'None',   detail: '—' },
    { value: 1, label: 'Light',  detail: '-d2 DR' },
    { value: 2, label: 'Medium', detail: '-d4 DR' },
    { value: 3, label: 'Heavy',  detail: '-d6 DR' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-widest text-yellow-300 font-mono mb-1">
          STARTING GEAR
        </h2>
        <p className="text-yellow-300/40 font-mono text-xs uppercase tracking-widest">
          Roll or choose — then carry it into the dark.
        </p>
      </div>

      {/* ── Weapon ── */}
      <div className="space-y-3">
        <SectionLabel>Weapon</SectionLabel>
        {weapons.length > 0 && (
          <div className="space-y-1.5">
            {weapons.map((w, i) => (
              <div key={i} className="flex items-center gap-2 bg-black border border-yellow-300/20 rounded px-3 py-2">
                <span className="flex-1 text-xs font-mono text-yellow-100">{w.name}</span>
                <span className="text-xs font-mono text-yellow-300/60">{w.damage}</span>
                {w.notes && <span className="text-xs font-mono text-yellow-300/40">{w.notes}</span>}
                <button type="button" onClick={() => removeWeapon(i)}
                  className="text-yellow-300/20 hover:text-red-400 font-mono font-black text-base leading-none ml-1 transition-colors">×</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <GrimButton onClick={rollWeapon} variant="roll">ROLL d10</GrimButton>
          <span className="text-yellow-300/30 font-mono text-xs self-center">or</span>
          <div className="flex gap-2 flex-1 min-w-0">
            <select
              value={weaponPick}
              onChange={e => setWeaponPick(e.target.value)}
              className="flex-1 bg-black border border-yellow-300/20 rounded px-2 py-1.5 text-xs text-yellow-100 font-mono focus:outline-none focus:border-yellow-300/40"
            >
              <option value="">— choose weapon —</option>
              {MB_WEAPONS.map(w => (
                <option key={w.name} value={w.name}>{w.name} ({w.damage}){w.notes ? ' · '+w.notes : ''}</option>
              ))}
            </select>
            <GrimButton onClick={addPickedWeapon} variant="ghost" disabled={!weaponPick}>ADD</GrimButton>
          </div>
        </div>
      </div>

      {/* ── Armor ── */}
      <div className="space-y-3">
        <SectionLabel>Armor</SectionLabel>
        <div className="flex gap-2 flex-wrap items-center">
          {ARMOR_TIERS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setArmorTier(opt.value)}
              className={`
                flex flex-col items-center px-3 py-1.5 rounded border text-[10px] font-black uppercase tracking-wider font-mono transition-all
                ${armorTier === opt.value
                  ? 'bg-yellow-300/15 border-yellow-300/60 text-yellow-300'
                  : 'bg-transparent border-yellow-300/20 text-yellow-300/40 hover:border-yellow-300/40 hover:text-yellow-300/70'
                }
              `}
            >
              <span>{opt.label}</span>
              <span className="font-normal opacity-70 text-[9px] mt-0.5">{opt.detail}</span>
            </button>
          ))}
          <GrimButton onClick={rollArmor} variant="roll">ROLL d4</GrimButton>
        </div>
        {armorTier > 0 && (
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              {(ARMOR_NAMES_BY_TIER[armorTier] ?? []).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange('armor_name', n)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-all ${
                    armorName === n
                      ? 'border-yellow-300/60 bg-yellow-300/10 text-yellow-300'
                      : 'border-yellow-300/20 text-yellow-300/40 hover:border-yellow-300/40 hover:text-yellow-300/70'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <GrimInput
              value={armorName}
              onChange={e => onChange('armor_name', e.target.value)}
              placeholder="Armor description"
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* ── Supplies (d6, d12×2, d4 food) ── */}
      <div className="space-y-3">
        <SectionLabel>Supplies & Gear</SectionLabel>
        <p className="text-yellow-300/30 font-mono text-[10px] italic">
          Waterskin is always included. Roll d4 for food, d6 for a container, then roll d12+d12 for misc items (adds one item from each table).
        </p>
        <div className="flex gap-2 flex-wrap">
          <GrimButton onClick={rollFood}      variant="roll">ROLL d4 FOOD</GrimButton>
          <GrimButton onClick={rollD6Item}    variant="roll">ROLL d6 ITEM</GrimButton>
          <GrimButton onClick={rollD12Items}  variant="roll">ROLL d12+d12</GrimButton>
        </div>
      </div>

      {/* ── Equipment list ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 bg-black border border-yellow-300/20 rounded px-3 py-2">
          <span className="text-[9px] text-yellow-300/20 font-black w-5 text-right">★</span>
          <span className="text-xs font-mono text-yellow-300/60">Waterskin</span>
        </div>
        {equipment.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-yellow-300/20 font-mono text-[9px] w-5 shrink-0 text-right font-black">{i + 1}</span>
            <GrimInput
              value={e.item}
              onChange={ev => changeEquipItem(i, ev.target.value)}
              placeholder="Item..."
              className="flex-1"
            />
            <button type="button" onClick={() => removeEquipItem(i)}
              className="text-yellow-300/20 hover:text-red-400 font-mono font-black text-lg leading-none px-1 transition-colors">×</button>
          </div>
        ))}
        <GrimButton onClick={() => addEquipItem('')} variant="ghost">+ ADD ITEM</GrimButton>
      </div>
    </div>
  )
}

// ─── Step 6: Vibe / The Ruin You Carry ───────────────────────────────────────

function StepVibe({ data, onChange }) {
  const vibe = data.vibe ?? ''
  const count = vibe.length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-widest text-yellow-300 font-mono mb-1">
          THE RUIN YOU CARRY
        </h2>
        <p className="text-yellow-300/40 font-mono text-xs leading-relaxed max-w-prose">
          What has the dying world taken from you? What curse follows you like a faithful hound?{' '}
          Speak plainly — fate has no patience for euphemism.
        </p>
      </div>

      <div className="space-y-2">
        <textarea
          value={vibe}
          onChange={e => onChange('vibe', e.target.value.slice(0, 1000))}
          placeholder="A debt measured in corpses. Three gods have cursed this wretch, two by name. The third has forgotten why, but continues out of habit."
          rows={8}
          maxLength={1000}
          className="
            w-full bg-black border border-yellow-300/20 rounded
            px-4 py-3 text-sm text-yellow-100 font-mono leading-relaxed
            placeholder-yellow-300/15
            focus:outline-none focus:border-yellow-300/50 focus:ring-1 focus:ring-yellow-300/10
            transition-colors resize-y
          "
        />
        <div className="flex justify-end">
          <span className={`text-[10px] font-mono ${count > 900 ? 'text-red-400' : count > 700 ? 'text-yellow-300/50' : 'text-yellow-300/25'}`}>
            {count} / 1000
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateStep(step, data, rollMode, abilitiesRolled) {
  switch (step) {
    case 1:
      return data.name.trim().length > 0
    case 2:
      return Boolean(data.class_name)
    case 3:
      if (rollMode === 'roll') return abilitiesRolled
      return true
    case 4:
      return data.hp_max != null && data.omens != null && data.silver != null
    case 5:
      return true
    case 6:
      return true
    default:
      return true
  }
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function MorkborgWizard({ onComplete, onCancel }) {
  const [step, setStep] = useState(1)
  const [abilityMode, setAbilityMode] = useState('roll')
  const [abilitiesRolled, setAbilitiesRolled] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    description: '',
    class_name: 'Classless',
    abilities: { strength: 0, agility: 0, presence: 0, toughness: 0 },
    hp_max: null,
    hp_current: null,
    omens: null,
    silver: null,
    weapons: [],
    armor_tier: 0,
    armor_name: '',
    equipment: [],
    vibe: '',
  })

  const classData = getClassData(formData.class_name)

  // When class changes, reset HP/omens/silver/weapons/armor
  const handleChange = useCallback((field, value) => {
    setFormData(prev => {
      if (field === 'class_name') {
        return {
          ...prev,
          class_name: value,
          hp_max: null,
          hp_current: null,
          omens: null,
          silver: null,
          weapons: [],
          armor_tier: 0,
          armor_name: '',
          equipment: [],
        }
      }

      if (field.startsWith('abilities.')) {
        const ability = field.split('.')[1]
        return { ...prev, abilities: { ...prev.abilities, [ability]: value } }
      }

      return { ...prev, [field]: value }
    })
  }, [])

  const canProceed = validateStep(step, formData, abilityMode, abilitiesRolled)

  const handleNext = () => {
    if (canProceed && step < TOTAL_STEPS) setStep(s => s + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(s => s - 1)
  }

  const handleComplete = () => {
    // Always include waterskin in equipment
    const equipWithWaterskin = formData.equipment.some(e => /waterskin/i.test(e.item))
      ? formData.equipment
      : [{ item: 'Waterskin' }, ...formData.equipment]

    const sheetData = {
      name:        formData.name,
      nickname:    formData.nickname,
      description: formData.description,
      class_name:  formData.class_name,
      abilities: {
        strength:  formData.abilities.strength,
        agility:   formData.abilities.agility,
        presence:  formData.abilities.presence,
        toughness: formData.abilities.toughness,
      },
      hp_max:      formData.hp_max     ?? 1,
      hp_current:  formData.hp_current ?? 1,
      omens:       formData.omens      ?? 1,
      silver:      formData.silver     ?? 0,
      weapons:     formData.weapons,
      armor_tier:  formData.armor_tier ?? 0,
      armor_name:  formData.armor_name ?? '',
      equipment:   equipWithWaterskin,
      powers_list: [],
      powers_per_day: null,
      miseries:    [false, false, false, false, false, false],
      notes:       '',
      vibe:        formData.vibe,
    }
    onComplete(sheetData)
  }

  const STEP_TITLES = [
    'Identity',
    'Class',
    'Abilities',
    'Hit Points & Omens',
    'Starting Gear',
    'The Ruin You Carry',
  ]

  return (
    <div className="min-h-screen bg-black flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-yellow-300/30 font-mono text-[10px] uppercase tracking-[0.3em] mb-0.5">
              Mörk Borg
            </p>
            <h1 className="text-3xl font-black uppercase tracking-widest text-yellow-300 font-mono leading-none">
              CHARACTER CREATION
            </h1>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-yellow-300/30 hover:text-yellow-300/70 font-mono text-xs uppercase tracking-widest transition-colors mt-1"
          >
            CANCEL
          </button>
        </div>

        {/* Progress */}
        <ProgressBar currentStep={step} />

        {/* Step label */}
        <div className="mb-4 text-center">
          <span className="text-yellow-300/30 font-mono text-[10px] uppercase tracking-[0.3em]">
            Step {step} of {TOTAL_STEPS} — {STEP_TITLES[step - 1]}
          </span>
        </div>

        {/* Card */}
        <div className="bg-zinc-950 border border-yellow-300/20 rounded-lg p-6 mb-6">
          {step === 1 && (
            <StepIdentity data={formData} onChange={handleChange} />
          )}
          {step === 2 && (
            <StepClass data={formData} onChange={handleChange} />
          )}
          {step === 3 && (
            <StepAbilities
              data={formData}
              onChange={handleChange}
              mode={abilityMode}
              setMode={setAbilityMode}
              onAllRolled={() => setAbilitiesRolled(true)}
            />
          )}
          {step === 4 && (
            <StepResources
              data={formData}
              onChange={handleChange}
              classData={classData}
            />
          )}
          {step === 5 && (
            <StepEquipment
              data={formData}
              onChange={handleChange}
            />
          )}
          {step === 6 && (
            <StepVibe data={formData} onChange={handleChange} />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <GrimButton
            onClick={handleBack}
            variant="ghost"
            disabled={step === 1}
          >
            BACK
          </GrimButton>

          <div className="flex items-center gap-2">
            {step < TOTAL_STEPS ? (
              <GrimButton
                onClick={handleNext}
                disabled={!canProceed}
                variant="primary"
              >
                NEXT
              </GrimButton>
            ) : (
              <GrimButton
                onClick={handleComplete}
                variant="primary"
                className="px-6"
              >
                BEGIN YOUR DOOM
              </GrimButton>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
