import { useState, useEffect, useCallback, useRef } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────

const STAT_KEYS = ['str', 'dex', 'int', 'wil'];
const STAT_LABELS = { str: 'STR', dex: 'DEX', int: 'INT', wil: 'WIL' };

const SKILL_GROUPS = [
  { stat: 'str', skills: ['might'] },
  { stat: 'dex', skills: ['stealth', 'finesse'] },
  { stat: 'int', skills: ['arcana', 'examination', 'lore'] },
  { stat: 'wil', skills: ['insight', 'influence', 'naturecraft', 'perception'] },
];

const SKILL_LABEL = {
  might: 'Might',
  stealth: 'Stealth',
  finesse: 'Finesse',
  arcana: 'Arcana',
  examination: 'Examination',
  lore: 'Lore',
  insight: 'Insight',
  influence: 'Influence',
  naturecraft: 'Naturecraft',
  perception: 'Perception',
};

const ALL_LANGUAGES = [
  'Common', 'Dwarvish', 'Elvish', 'Goblin', 'Infernal',
  "Thieves' Cant", 'Celestial', 'Draconic', 'Primordial', 'Deep Speak',
];

const STAT_ARRAYS = [
  { label: 'Standard (+2,+2,+0,−1)', values: [2, 2, 0, -1] },
  { label: 'Balanced (+2,+1,+1,+0)', values: [2, 1, 1, 0] },
  { label: 'Min-Max (+3,+1,−1,−1)', values: [3, 1, -1, -1] },
];

const SIZE_OPTIONS = ['Tiny', 'Small', 'Medium', 'Large', 'Huge'];
const SAVE_STATES = ['none', 'advantage', 'disadvantage'];
const SAVE_ICONS = { advantage: '▲', disadvantage: '▼', none: '—' };
const SAVE_COLORS = {
  advantage: 'text-ni-gold border-ni-gold bg-ni-gold/12',
  disadvantage: 'text-red-400 border-red-500 bg-red-900/20',
  none: 'text-codex-subtext border-codex-border bg-codex-surface',
};

const ABILITY_SOURCES = ['Class', 'Ancestry', 'Background', 'Feat', 'Item', 'Other'];

// ── Gear Constants ────────────────────────────────────────────────────────────

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
];

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
];

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
];

const ARMOR_ONLY = NIMBLE_ARMOR.filter(a => a.type !== 'Shield');
const SHIELD_ONLY = NIMBLE_ARMOR.filter(a => a.type === 'Shield');
const ARMOR_TYPES = ['Cloth', 'Leather', 'Mail', 'Plate'];

// ── Class Resource Definitions (PDF-verified) ─────────────────────────────────

const CLASS_RESOURCES = {
  Berserker: [
    { key: 'fury_dice', label: 'Fury Dice', color: 'text-orange-400 border-orange-500/40 bg-orange-900/10',
      maxFn: (s, _l) => Math.max(s.str || 0, s.dex || 0),
      hint: 'Action: Roll & hold a 1d4. Add to every STR attack. Max = KEY stat. Lost when Rage ends.' },
  ],
  Commander: [
    { key: 'coordinated_strikes', label: 'Coordinated Strikes', color: 'text-blue-400 border-blue-500/40 bg-blue-900/10',
      maxFn: (s, _l) => s.int || 0,
      hint: '(1/round) You + ally within Reach 6 both attack or cast a cantrip for free. Uses/Safe Rest = INT.' },
  ],
  Hunter: [
    { key: 'hunters_mark_target', label: "Hunter's Mark — Quarry", color: 'text-amber-400 border-amber-500/40 bg-amber-900/10',
      isText: true,
      hint: 'Marked creature. Cannot hide from you. Your attacks gain advantage OR +Level damage.' },
  ],
  Oathsworn: [
    { key: 'lay_on_hands', label: 'Lay on Hands', color: 'text-amber-400 border-amber-500/40 bg-amber-900/10',
      maxFn: (_s, l) => 5 * (l || 1),
      hint: 'Healing pool = 5×Level HP. Recharges on Safe Rest. Action: touch target, spend any amount.' },
  ],
  Shepherd: [
    { key: 'searing_light', label: 'Searing Light', color: 'text-yellow-400 border-yellow-500/40 bg-yellow-900/10',
      maxFn: (s, _l) => s.wil || 0,
      hint: '(WIL uses/Safe Rest) Heal WIL×d8 to a Dying creature OR deal WIL×d8 radiant to undead/Bloodied.' },
  ],
  Songweaver: [
    { key: 'inspiration', label: "Songweaver's Inspiration", color: 'text-sky-400 border-sky-500/40 bg-sky-900/10',
      maxFn: (s, _l) => 2 * (s.wil || 0),
      hint: '(Free Reaction) Allow ally to reroll one attack/save die. Must keep either result. Uses = 2×WIL.' },
  ],
  Stormshifter: [
    { key: 'beastshift', label: 'Beastshift Charges', color: 'text-sky-400 border-sky-500/40 bg-sky-900/10',
      maxFn: (s, _l) => s.dex || 0,
      hint: 'Action: Transform into a harmless beast and speak with animals. Charges/Safe Rest = DEX.' },
  ],
}

// Mana pool recalculation fns for level-up
const MANA_FORMULA_FN = {
  Mage:         (s, l) => ((s.int || 0) * 3) + l,
  Oathsworn:    (s, l) => (s.wil || 0) + l,
  Shadowmancer: (_s, _l) => 0, // Pilfered Power — no mana pool
  Shepherd:     (s, l) => ((s.wil || 0) * 3) + l,
  Songweaver:   (s, l) => ((s.int || 0) * 3) + l,
  Stormshifter: (s, l) => ((s.wil || 0) * 3) + l,
}
const MANA_UNLOCK_LEVEL = 2 // all casters unlock mana at L2

// ── Defaults ─────────────────────────────────────────────────────────────────

function buildDefaults(sd = {}) {
  return {
    name: sd.name ?? '',
    ancestry: sd.ancestry ?? '',
    class_name: sd.class_name ?? '',
    level: sd.level ?? 1,
    size: sd.size ?? 'Medium',
    speed: sd.speed ?? 6,
    stats: {
      str: sd.stats?.str ?? 0,
      dex: sd.stats?.dex ?? 0,
      int: sd.stats?.int ?? 0,
      wil: sd.stats?.wil ?? 0,
    },
    saves: {
      str: sd.saves?.str ?? 'none',
      dex: sd.saves?.dex ?? 'none',
      int: sd.saves?.int ?? 'none',
      wil: sd.saves?.wil ?? 'none',
    },
    skills: {
      might:       sd.skills?.might       ?? 0,
      stealth:     sd.skills?.stealth     ?? 0,
      finesse:     sd.skills?.finesse     ?? 0,
      arcana:      sd.skills?.arcana      ?? 0,
      examination: sd.skills?.examination ?? 0,
      lore:        sd.skills?.lore        ?? 0,
      insight:     sd.skills?.insight     ?? 0,
      influence:   sd.skills?.influence   ?? 0,
      naturecraft: sd.skills?.naturecraft ?? 0,
      perception:  sd.skills?.perception  ?? 0,
    },
    hp_current:       sd.hp_current       ?? 0,
    hp_max:           sd.hp_max           ?? 0,
    hit_dice:         sd.hit_dice         ?? 'd8',
    hit_die_count:    sd.hit_die_count    ?? 1,
    wounds_current:   sd.wounds_current   ?? 0,
    initiative:       sd.initiative       ?? 'DEX',
    weapons:  Array.isArray(sd.weapons)  ? sd.weapons  : [],
    armor:    sd.armor  ?? null,
    shield:   sd.shield ?? null,
    equipment: Array.isArray(sd.equipment) ? sd.equipment : [],
    gold:   sd.gold   ?? 0,
    silver: sd.silver ?? 0,
    copper: sd.copper ?? 0,
    spells:       Array.isArray(sd.spells) ? sd.spells : [],
    mana_max:     sd.mana_max     ?? 0,
    mana_current: sd.mana_current ?? 0,
    resources:    typeof sd.resources === 'object' && sd.resources !== null ? sd.resources : {},
    languages: Array.isArray(sd.languages) ? sd.languages : ['Common'],
    abilities: Array.isArray(sd.abilities) ? sd.abilities : [],
    notes: sd.notes ?? '',
  };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function fmtMod(n) {
  const num = Number(n) || 0;
  return num >= 0 ? `+${num}` : `${num}`;
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, Number(val) || 0));
}

// ── Armor calculator ─────────────────────────────────────────────────────────

function calcArmor(armor, shield, dex, str = 0, className = '') {
  // Zephyr: Iron Defense — DEX+STR when unarmored
  let value = (className === 'Zephyr' && !armor) ? dex + str : dex;
  if (armor) {
    const base = parseInt(armor.formula, 10) || 0;
    if (armor.type === 'Cloth' || armor.type === 'Leather') {
      value = base + dex;
    } else if (armor.type === 'Mail') {
      value = base + Math.min(dex, 2);
    } else if (armor.type === 'Plate') {
      value = base; // flat
    }
  }
  if (shield) {
    const bonus = parseInt(shield.formula.replace('+', ''), 10) || 0;
    value += bonus;
  }
  return value;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ children }) {
  return (
    <h2 className="font-display text-ni-gold text-xs tracking-widest uppercase mb-3 border-b border-codex-border pb-1">
      {children}
    </h2>
  );
}

function FieldLabel({ children, className = '' }) {
  return (
    <span className={`text-codex-subtext text-xs uppercase tracking-wider ${className}`}>
      {children}
    </span>
  );
}

function TextInput({ value, onChange, placeholder, className = '', readOnly, maxLength }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={readOnly}
      className={`bg-codex-surface border border-codex-border rounded px-2 py-1.5 text-codex-text text-sm
        placeholder-codex-muted focus:outline-none focus:border-ni-gold/60 transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed w-full ${className}`}
    />
  );
}

function NumberInput({ value, onChange, min, max, className = '', readOnly }) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(clamp(e.target.value, min, max))}
      min={min}
      max={max}
      disabled={readOnly}
      className={`bg-codex-surface border border-codex-border rounded px-2 py-1.5 text-codex-text text-sm text-center
        focus:outline-none focus:border-ni-gold/60 transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    />
  );
}

function SelectInput({ value, onChange, options, className = '', readOnly }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={readOnly}
      className={`bg-codex-surface border border-codex-border rounded px-2 py-1.5 text-codex-text text-sm
        focus:outline-none focus:border-ni-gold/60 transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

// ── WeaponQuickPick ───────────────────────────────────────────────────────────

function WeaponQuickPick({ onAdd }) {
  const [value, setValue] = useState('');
  function handleAdd() {
    if (!value) return;
    const w = NIMBLE_WEAPONS.find(w => w.name === value);
    if (w) onAdd({ ...w, notes: '' });
    setValue('');
  }
  return (
    <div className="flex gap-2 mt-3">
      <select
        value={value}
        onChange={e => setValue(e.target.value)}
        className="flex-1 min-w-0 bg-codex-surface border border-codex-border rounded px-2 py-1.5 text-codex-text text-sm
          focus:outline-none focus:border-ni-gold/60 transition-colors"
      >
        <option value="">— Quick-add weapon —</option>
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
      <button
        onClick={handleAdd}
        disabled={!value}
        className="px-3 py-1.5 rounded border border-ni-gold/40 text-ni-gold text-xs font-medium
          hover:bg-ni-gold/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>
  );
}

// ── EquipmentQuickAdd ─────────────────────────────────────────────────────────

function EquipmentQuickAdd({ onAdd }) {
  const [value, setValue] = useState('');
  function handleAdd() {
    if (!value) return;
    onAdd(value);
    setValue('');
  }
  return (
    <div className="flex gap-2 mt-2">
      <select
        value={value}
        onChange={e => setValue(e.target.value)}
        className="flex-1 min-w-0 bg-codex-surface border border-codex-border rounded px-2 py-1.5 text-codex-text text-sm
          focus:outline-none focus:border-ni-gold/60 transition-colors"
      >
        <option value="">— Quick-add common item —</option>
        {NIMBLE_ITEMS.map(i => <option key={i.item} value={i.item}>{i.item}</option>)}
      </select>
      <button
        onClick={handleAdd}
        disabled={!value}
        className="px-3 py-1.5 rounded border border-codex-border text-codex-subtext text-xs font-medium
          hover:border-ni-gold/40 hover:text-ni-gold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Add
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NimbleSheet({ character, onSave, readOnly = false, onEdit }) {
  const statsLocked = !!onEdit
  const [sheet, setSheet] = useState(() => buildDefaults(character?.sheet_data));
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [levelUpRoll, setLevelUpRoll] = useState(null); // { roll1, roll2, hpGain, newMana }
  const debounceRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Sync if character prop changes externally
  useEffect(() => {
    setSheet(buildDefaults(character?.sheet_data));
  }, [character?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save with debounce
  const triggerSave = useCallback((nextSheet) => {
    if (readOnly || !onSave) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus('saving');
    debounceRef.current = setTimeout(async () => {
      try {
        await onSave(nextSheet);
        if (isMounted.current) setSaveStatus('saved');
        setTimeout(() => { if (isMounted.current) setSaveStatus('idle'); }, 2000);
      } catch {
        if (isMounted.current) setSaveStatus('idle');
      }
    }, 1500);
  }, [readOnly, onSave]);

  function update(path, value) {
    setSheet(prev => {
      const next = deepSet(prev, path, value);
      triggerSave(next);
      return next;
    });
  }

  // Derived
  const inventoryMax  = 10 + (Number(sheet.stats.str) || 0);
  const slotsUsed     = sheet.equipment.reduce((acc, e) => acc + (Number(e.slots) || 0), 0);
  const effectiveArmor = calcArmor(
    sheet.armor, sheet.shield,
    Number(sheet.stats.dex) || 0,
    Number(sheet.stats.str) || 0,
    sheet.class_name,
  );
  const intStat = Number(sheet.stats.int) || 0;
  const langMax = 1 + Math.max(0, intStat); // Common + INT bonus
  const langCount = sheet.languages.length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function applyStatArray(arr) {
    if (readOnly) return;
    const [str, dex, int_, wil] = arr;
    setSheet(prev => {
      const next = { ...prev, stats: { str, dex, int: int_, wil } };
      triggerSave(next);
      return next;
    });
  }

  function cycleSave(stat) {
    if (readOnly) return;
    const cur = sheet.saves[stat];
    const idx = SAVE_STATES.indexOf(cur);
    const next = SAVE_STATES[(idx + 1) % SAVE_STATES.length];
    update(['saves', stat], next);
  }

  function toggleLanguage(lang) {
    if (readOnly || lang === 'Common') return;
    const has = sheet.languages.includes(lang);
    let next;
    if (has) {
      next = sheet.languages.filter(l => l !== lang);
    } else {
      if (langCount >= langMax) return;
      next = [...sheet.languages, lang];
    }
    update(['languages'], next);
  }

  function setWound(idx) {
    if (readOnly) return;
    // clicking the currently-last filled pip removes it; clicking any fills up to that pip
    const newVal = sheet.wounds_current === idx + 1 ? idx : idx + 1;
    update(['wounds_current'], newVal);
  }

  // Weapons
  function addWeapon(weapon) {
    if (readOnly) return;
    update(['weapons'], [...sheet.weapons, weapon]);
  }
  function removeWeapon(i) {
    if (readOnly) return;
    update(['weapons'], sheet.weapons.filter((_, idx) => idx !== i));
  }
  function updateWeapon(i, field, val) {
    const next = sheet.weapons.map((w, idx) => idx === i ? { ...w, [field]: val } : w);
    update(['weapons'], next);
  }
  function addCustomWeapon() {
    if (readOnly) return;
    update(['weapons'], [...sheet.weapons, { name: '', category: 'Melee', damage: '', type: '', properties: '', cost: '', notes: '' }]);
  }

  // Armor / Shield
  function setArmor(name) {
    if (readOnly) return;
    const a = ARMOR_ONLY.find(a => a.name === name) || null;
    update(['armor'], a);
  }
  function setShield(name) {
    if (readOnly) return;
    const s = SHIELD_ONLY.find(s => s.name === name) || null;
    update(['shield'], s);
  }

  // Equipment
  function addEquipment(name = null) {
    if (readOnly) return;
    update(['equipment'], [...sheet.equipment, { item: name || '', slots: 1 }]);
  }
  function removeEquipment(i) {
    if (readOnly) return;
    update(['equipment'], sheet.equipment.filter((_, idx) => idx !== i));
  }
  function updateEquipment(i, field, val) {
    const next = sheet.equipment.map((e, idx) => idx === i ? { ...e, [field]: val } : e);
    update(['equipment'], next);
  }

  // Abilities
  function addAbility() {
    if (readOnly) return;
    update(['abilities'], [...sheet.abilities, { name: '', source: 'Class', description: '' }]);
  }
  function removeAbility(i) {
    if (readOnly) return;
    update(['abilities'], sheet.abilities.filter((_, idx) => idx !== i));
  }
  function updateAbility(i, field, val) {
    const next = sheet.abilities.map((a, idx) => idx === i ? { ...a, [field]: val } : a);
    update(['abilities'], next);
  }

  // Spells
  function addSpell() {
    if (readOnly) return;
    update(['spells'], [...sheet.spells, { name: '', school: '', tier: 'Cantrip', actions: 1, target: '', summary: '' }]);
  }
  function removeSpell(i) {
    if (readOnly) return;
    update(['spells'], sheet.spells.filter((_, idx) => idx !== i));
  }
  function updateSpell(i, field, val) {
    const next = sheet.spells.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
    update(['spells'], next);
  }

  // Class resources
  function setResource(key, val) {
    if (readOnly) return;
    update(['resources'], { ...sheet.resources, [key]: val });
  }

  // Level-up
  function rollLevelUp() {
    if (readOnly) return;
    const die = parseInt((sheet.hit_dice || 'd8').replace('d', '')) || 8;
    const roll1 = Math.floor(Math.random() * die) + 1;
    const roll2 = Math.floor(Math.random() * die) + 1;
    const hpGain = Math.max(roll1, roll2);
    const nextLvl = (sheet.level || 1) + 1;
    const manaFn = MANA_FORMULA_FN[sheet.class_name];
    const newMana = manaFn && nextLvl >= MANA_UNLOCK_LEVEL
      ? manaFn(sheet.stats, nextLvl)
      : sheet.mana_max;
    setLevelUpRoll({ roll1, roll2, hpGain, newMana, nextLvl });
  }

  function confirmLevelUp() {
    if (!levelUpRoll) return;
    const { hpGain, newMana, nextLvl } = levelUpRoll;
    setSheet(prev => {
      const next = {
        ...prev,
        level: nextLvl,
        hp_max: prev.hp_max + hpGain,
        hp_current: prev.hp_current + hpGain,
        mana_max: newMana,
        mana_current: newMana > prev.mana_max ? newMana : prev.mana_current,
      };
      triggerSave(next);
      return next;
    });
    setLevelUpRoll(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-codex-bg text-codex-text font-nimble">
      {/* Top bar — title centered on full viewport; save status pinned right */}
      <div className="sticky top-0 z-10 bg-codex-bg/95 backdrop-blur border-b border-codex-border px-6 py-2 relative flex items-center justify-center">
        <span className="font-display text-ni-gold text-sm tracking-widest uppercase">
          Nimble Character Sheet
        </span>
        {onEdit && (
          <button
            onClick={onEdit}
            className="absolute left-6 flex items-center gap-1.5 px-3 py-1 rounded border border-ni-gold/40
              text-ni-gold text-xs font-medium hover:bg-ni-gold/10 transition-colors"
          >
            ✏ Edit
          </button>
        )}
        {!readOnly && (
          <span className={`absolute right-6 text-xs font-medium transition-opacity duration-300 ${
            saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'
          } ${saveStatus === 'saving' ? 'text-codex-subtext' : 'text-ni-gold'}`}>
            {saveStatus === 'saving' ? 'Saving…' : 'Saved ✓'}
          </span>
        )}
        {readOnly && (
          <span className="absolute right-6 text-xs text-codex-subtext italic">Read Only</span>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── BASIC IDENTITY ─────────────────────────────────────────────── */}
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Identity</SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="col-span-2 md:col-span-1">
              <FieldLabel>Character Name</FieldLabel>
              <TextInput
                value={sheet.name}
                onChange={v => update(['name'], v)}
                placeholder="Enter name…"
                className="mt-1"
                readOnly={readOnly || statsLocked}
              />
            </div>
            <div>
              <FieldLabel>Ancestry</FieldLabel>
              <TextInput
                value={sheet.ancestry}
                onChange={v => update(['ancestry'], v)}
                placeholder="Human, Elf…"
                className="mt-1"
                readOnly={readOnly || statsLocked}
              />
            </div>
            <div>
              <FieldLabel>Class</FieldLabel>
              <TextInput
                value={sheet.class_name}
                onChange={v => update(['class_name'], v)}
                placeholder="Fighter, Wizard…"
                className="mt-1"
                readOnly={readOnly || statsLocked}
              />
            </div>
            <div>
              <FieldLabel>Level</FieldLabel>
              <NumberInput
                value={sheet.level}
                onChange={v => update(['level'], clamp(v, 1, 20))}
                min={1} max={20}
                className="mt-1 w-full"
                readOnly={readOnly || statsLocked}
              />
            </div>
            <div>
              <FieldLabel>Size</FieldLabel>
              <SelectInput
                value={sheet.size}
                onChange={v => update(['size'], v)}
                options={SIZE_OPTIONS}
                className="mt-1 w-full"
                readOnly={readOnly || statsLocked}
              />
            </div>
            <div>
              <FieldLabel>Speed (squares)</FieldLabel>
              <NumberInput
                value={sheet.speed}
                onChange={v => update(['speed'], clamp(v, 1, 20))}
                min={1} max={20}
                className="mt-1 w-full"
                readOnly={readOnly}
              />
            </div>
          </div>
        </div>

        {/* ── STATS ──────────────────────────────────────────────────────── */}
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Ability Scores</SectionHeader>

          {/* Stat array quick-pick */}
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-codex-subtext text-xs">Quick fill:</span>
              {STAT_ARRAYS.map(arr => (
                <button
                  key={arr.label}
                  onClick={() => applyStatArray(arr.values)}
                  className="px-2 py-0.5 text-xs border border-codex-border rounded text-codex-subtext
                    hover:border-ni-gold/50 hover:text-ni-gold/80 transition-colors bg-codex-surface"
                >
                  {arr.label}
                </button>
              ))}
              <span className="text-codex-muted text-xs italic ml-1">Assign to your class key stats.</span>
            </div>
          )}

          {/* Stat boxes */}
          <div className="grid grid-cols-4 gap-3">
            {STAT_KEYS.map(key => (
              <div key={key} className="flex flex-col items-center bg-codex-surface border border-codex-border rounded-lg py-4 px-2 gap-2">
                <span className="font-display text-ni-gold text-xs tracking-widest uppercase">
                  {STAT_LABELS[key]}
                </span>
                <span className="text-3xl font-bold text-ni-gold/80 leading-none min-h-[2.25rem] flex items-center">
                  {fmtMod(sheet.stats[key])}
                </span>
                <input
                  type="number"
                  value={sheet.stats[key]}
                  onChange={e => update(['stats', key], clamp(e.target.value, -2, 5))}
                  min={-2} max={5}
                  disabled={readOnly || statsLocked}
                  className="w-12 bg-transparent border-b border-codex-border text-center text-codex-subtext text-xs
                    focus:outline-none focus:border-ni-gold/60 disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label={`${STAT_LABELS[key]} modifier`}
                />
                <span className="text-codex-muted text-xs">−2 to +5</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SAVES ──────────────────────────────────────────────────────── */}
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Saving Throws</SectionHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STAT_KEYS.map(key => {
              const state = sheet.saves[key];
              return (
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <FieldLabel>{STAT_LABELS[key]}</FieldLabel>
                  <button
                    onClick={() => cycleSave(key)}
                    disabled={readOnly}
                    title="Click to cycle: None → Advantage → Disadvantage"
                    className={`w-full py-2 rounded border font-semibold text-sm transition-all
                      disabled:cursor-not-allowed ${SAVE_COLORS[state]}`}
                  >
                    <span className="mr-1">{SAVE_ICONS[state]}</span>
                    <span className="capitalize text-xs">{state === 'none' ? 'Normal' : state}</span>
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-codex-muted text-xs mt-3 italic">Click to cycle: Normal → Advantage (▲) → Disadvantage (▼)</p>
        </div>

        {/* ── SKILLS ─────────────────────────────────────────────────────── */}
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Skills</SectionHeader>
          <p className="text-codex-subtext text-xs mb-4 italic">
            Start each skill at its stat bonus. Add 4 bonus points at level 1.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {SKILL_GROUPS.map(group => (
              <div key={group.stat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-display text-ni-gold text-xs tracking-widest uppercase">
                    {STAT_LABELS[group.stat]}
                  </span>
                  <span className="text-ni-gold text-xs">{fmtMod(sheet.stats[group.stat])}</span>
                  <div className="flex-1 h-px bg-codex-border" />
                </div>
                <div className="space-y-2">
                  {group.skills.map(skill => (
                    <div key={skill} className="flex items-center justify-between gap-3">
                      <span className="text-codex-text text-sm">{SKILL_LABEL[skill]}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-codex-subtext text-xs w-6 text-right">
                          {fmtMod(sheet.skills[skill])}
                        </span>
                        <NumberInput
                          value={sheet.skills[skill]}
                          onChange={v => update(['skills', skill], clamp(v, -2, 12))}
                          min={-2} max={12}
                          className="w-14"
                          readOnly={readOnly}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── COMBAT & VITALS ────────────────────────────────────────────── */}
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Combat &amp; Vitals</SectionHeader>

          {/* ── Primary combat stat badges ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">

            {/* HP */}
            <div className="col-span-2 md:col-span-1 flex flex-col items-center bg-codex-surface border border-red-900/40 rounded-xl py-4 px-3 gap-1">
              <FieldLabel className="text-red-400/80">Hit Points</FieldLabel>
              <div className="flex items-baseline gap-1.5 mt-1">
                <input
                  type="number"
                  value={sheet.hp_current}
                  onChange={e => update(['hp_current'], clamp(e.target.value, 0, 999))}
                  min={0} max={999}
                  disabled={readOnly}
                  className="w-14 bg-transparent text-center text-3xl font-bold text-red-400 focus:outline-none
                    disabled:opacity-60 disabled:cursor-not-allowed [appearance:textfield]
                    [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-codex-muted text-lg">/</span>
                <input
                  type="number"
                  value={sheet.hp_max}
                  onChange={e => update(['hp_max'], clamp(e.target.value, 0, 999))}
                  min={0} max={999}
                  disabled={readOnly}
                  className="w-12 bg-transparent text-center text-xl font-semibold text-codex-subtext focus:outline-none
                    disabled:opacity-60 disabled:cursor-not-allowed [appearance:textfield]
                    [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <FieldLabel className="text-[10px]">current / max</FieldLabel>
            </div>

            {/* Armor */}
            <div className="flex flex-col items-center bg-codex-surface border border-codex-border rounded-xl py-4 px-3 gap-1">
              <FieldLabel>Armor</FieldLabel>
              <span className="text-3xl font-bold text-ni-gold mt-1 leading-none">{effectiveArmor}</span>
              <span className="text-[10px] text-codex-muted text-center leading-tight mt-1">
                {sheet.armor
                  ? <>{sheet.armor.name}{sheet.shield ? ` + ${sheet.shield.name}` : ''}</>
                  : <>Unarmored{sheet.shield ? ` + ${sheet.shield.name}` : ''}</>
                }
              </span>
            </div>

            {/* Initiative */}
            <div className="flex flex-col items-center bg-codex-surface border border-codex-border rounded-xl py-4 px-3 gap-1">
              <FieldLabel>Initiative</FieldLabel>
              <span className={`text-3xl font-bold mt-1 leading-none ${
                (sheet.stats.dex || 0) >= 0 ? 'text-ni-gold' : 'text-red-400'
              }`}>
                {fmtMod(sheet.stats.dex)}
              </span>
              <span className="text-[10px] text-codex-muted mt-1">
                DEX{sheet.ancestry === 'Elf' ? ' · ▲ Adv.' : ''}
              </span>
            </div>

            {/* Speed */}
            <div className="flex flex-col items-center bg-codex-surface border border-codex-border rounded-xl py-4 px-3 gap-1">
              <FieldLabel>Speed</FieldLabel>
              <input
                type="number"
                value={sheet.speed}
                onChange={e => update(['speed'], clamp(e.target.value, 1, 20))}
                min={1} max={20}
                disabled={readOnly}
                className="w-14 bg-transparent text-center text-3xl font-bold text-codex-text focus:outline-none mt-1
                  disabled:opacity-60 disabled:cursor-not-allowed [appearance:textfield]
                  [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <FieldLabel className="text-[10px]">squares</FieldLabel>
            </div>
          </div>

          {/* ── Secondary row ── */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {/* Hit Die */}
            <div>
              <FieldLabel>Hit Die</FieldLabel>
              <TextInput
                value={sheet.hit_dice}
                onChange={v => update(['hit_dice'], v)}
                placeholder="d8"
                className="mt-1"
                readOnly={readOnly}
                maxLength={4}
              />
            </div>
            <div>
              <FieldLabel>Hit Die Count</FieldLabel>
              <NumberInput
                value={sheet.hit_die_count}
                onChange={v => update(['hit_die_count'], clamp(v, 0, 30))}
                min={0} max={30}
                className="mt-1 w-full"
                readOnly={readOnly}
              />
            </div>
            {/* Inventory Slots */}
            <div>
              <FieldLabel>Inventory Slots</FieldLabel>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className={`text-lg font-bold ${slotsUsed > inventoryMax ? 'text-red-400' : 'text-codex-text'}`}>
                  {slotsUsed}
                </span>
                <span className="text-codex-subtext text-sm">/ {inventoryMax}</span>
              </div>
              <FieldLabel className="block mt-0.5">used / max (10 + STR)</FieldLabel>
            </div>
          </div>

          {/* Wounds */}
          <div>
            <FieldLabel>Wounds</FieldLabel>
            <div className="flex items-center gap-2 mt-2">
              {Array.from({ length: 6 }).map((_, i) => {
                const filled = i < sheet.wounds_current;
                return (
                  <button
                    key={i}
                    onClick={() => setWound(i)}
                    disabled={readOnly}
                    title={`Wound ${i + 1}`}
                    className={`w-8 h-8 rounded-full border-2 transition-all disabled:cursor-not-allowed
                      ${filled
                        ? 'bg-red-600 border-red-500 shadow-[0_0_8px_rgba(220,38,38,0.5)]'
                        : 'bg-codex-surface border-codex-border hover:border-red-700/60'
                      }`}
                  />
                );
              })}
              <span className="text-codex-subtext text-xs ml-1">{sheet.wounds_current} / 6</span>
            </div>
          </div>
        </div>

        {/* ── WEAPONS ────────────────────────────────────────────────────── */}
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Weapons</SectionHeader>

          {/* Armor & Shield pickers */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div>
              <FieldLabel>Armor</FieldLabel>
              <select
                value={sheet.armor?.name || ''}
                onChange={e => setArmor(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full bg-codex-surface border border-codex-border rounded px-2 py-1.5 text-codex-text text-sm
                  focus:outline-none focus:border-ni-gold/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">— Unarmored (DEX only) —</option>
                {ARMOR_TYPES.map(type => (
                  <optgroup key={type} label={type}>
                    {ARMOR_ONLY.filter(a => a.type === type).map(a => (
                      <option key={a.name} value={a.name}>
                        {a.name} ({a.formula}){a.req ? ` [${a.req}]` : ''} — {a.cost}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Shield</FieldLabel>
              <select
                value={sheet.shield?.name || ''}
                onChange={e => setShield(e.target.value)}
                disabled={readOnly}
                className="mt-1 w-full bg-codex-surface border border-codex-border rounded px-2 py-1.5 text-codex-text text-sm
                  focus:outline-none focus:border-ni-gold/60 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">— No Shield —</option>
                {SHIELD_ONLY.map(s => (
                  <option key={s.name} value={s.name}>{s.name} ({s.formula}) — {s.cost}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Effective armor readout */}
          <div className="flex items-center gap-4 bg-codex-surface border border-codex-border rounded-lg px-4 py-3 mb-5">
            <div className="flex flex-col">
              <FieldLabel>Effective Armor</FieldLabel>
              <span className="text-2xl font-bold text-ni-gold mt-0.5">{effectiveArmor}</span>
            </div>
            <div className="flex-1 text-xs text-codex-muted leading-relaxed">
              {sheet.armor ? (
                <>
                  <span className="text-codex-subtext">{sheet.armor.name}</span>
                  {' '}<span className="opacity-60">({sheet.armor.formula})</span>
                  {sheet.shield && <>{' + '}<span className="text-codex-subtext">{sheet.shield.name}</span>{' '}<span className="opacity-60">({sheet.shield.formula})</span></>}
                </>
              ) : (
                <span>Unarmored — DEX modifier ({fmtMod(sheet.stats.dex)}){sheet.shield ? ` + ${sheet.shield.name} (${sheet.shield.formula})` : ''}</span>
              )}
              {sheet.armor?.req && (
                <div className="mt-0.5 text-amber-400">Requires {sheet.armor.req}</div>
              )}
            </div>
          </div>

          {/* Weapon list */}
          <div className="space-y-3 mb-1">
            {sheet.weapons.length === 0 && (
              <p className="text-codex-muted text-xs italic">No weapons yet.</p>
            )}
            {sheet.weapons.map((w, i) => (
              <div key={i} className="border border-codex-border rounded-lg p-3 bg-codex-surface">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Name + damage row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <input
                        type="text"
                        value={w.name}
                        onChange={e => updateWeapon(i, 'name', e.target.value)}
                        placeholder="Weapon name"
                        disabled={readOnly}
                        className="flex-1 min-w-[140px] bg-codex-card border border-codex-border rounded px-2 py-1 text-codex-text text-sm font-semibold
                          placeholder-codex-muted focus:outline-none focus:border-ni-gold/60 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        value={w.damage}
                        onChange={e => updateWeapon(i, 'damage', e.target.value)}
                        placeholder="Damage (e.g. 1d8+STR)"
                        disabled={readOnly}
                        className="w-36 bg-codex-card border border-ni-gold/30 rounded px-2 py-1 text-ni-gold text-sm font-mono
                          placeholder-codex-muted focus:outline-none focus:border-ni-gold/60 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    {/* Type + properties row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={w.type || ''}
                        onChange={e => updateWeapon(i, 'type', e.target.value)}
                        placeholder="Damage type"
                        disabled={readOnly}
                        className="w-32 bg-codex-card border border-codex-border rounded px-2 py-1 text-codex-subtext text-xs
                          placeholder-codex-muted focus:outline-none focus:border-ni-gold/60 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        value={w.properties || ''}
                        onChange={e => updateWeapon(i, 'properties', e.target.value)}
                        placeholder="Properties (2-handed, Reach 2…)"
                        disabled={readOnly}
                        className="flex-1 min-w-[160px] bg-codex-card border border-codex-border rounded px-2 py-1 text-codex-muted text-xs
                          placeholder-codex-muted focus:outline-none focus:border-ni-gold/60 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    {/* Notes */}
                    <input
                      type="text"
                      value={w.notes || ''}
                      onChange={e => updateWeapon(i, 'notes', e.target.value)}
                      placeholder="Notes…"
                      disabled={readOnly}
                      className="mt-2 w-full bg-codex-card border border-codex-border rounded px-2 py-1 text-codex-muted text-xs
                        placeholder-codex-muted focus:outline-none focus:border-ni-gold/60 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => removeWeapon(i)}
                      className="text-codex-muted hover:text-red-400 transition-colors text-xl leading-none mt-0.5 px-1 flex-shrink-0"
                      title="Remove weapon"
                    >×</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add buttons */}
          {!readOnly && (
            <>
              <WeaponQuickPick onAdd={addWeapon} />
              <button
                onClick={addCustomWeapon}
                className="mt-2 text-xs text-codex-subtext border border-codex-border rounded px-3 py-1
                  hover:border-ni-gold/40 hover:text-ni-gold transition-colors"
              >
                + Custom Weapon
              </button>
            </>
          )}
        </div>

        {/* ── SPELLS & MANA ──────────────────────────────────────────────── */}
        {(sheet.spells.length > 0 || sheet.mana_max > 0 || !readOnly) && (
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Spells &amp; Mana</SectionHeader>

          {/* Mana pool — only show if character has one */}
          {(sheet.mana_max > 0 || !readOnly) && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-codex-subtext text-xs uppercase tracking-wider w-20">Mana</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={sheet.mana_current}
                  min={0}
                  max={sheet.mana_max}
                  disabled={readOnly}
                  onChange={e => update(['mana_current'], Math.max(0, Math.min(sheet.mana_max, Number(e.target.value))))}
                  className="w-14 bg-codex-surface border border-violet-500/40 rounded px-2 py-1 text-center
                    text-violet-300 font-mono text-sm focus:outline-none focus:border-violet-400 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <span className="text-codex-muted text-xs">/</span>
                <input
                  type="number"
                  value={sheet.mana_max}
                  min={0}
                  disabled={readOnly}
                  onChange={e => update(['mana_max'], Math.max(0, Number(e.target.value)))}
                  className="w-14 bg-codex-surface border border-codex-border rounded px-2 py-1 text-center
                    text-codex-subtext font-mono text-sm focus:outline-none focus:border-violet-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <span className="text-codex-muted text-xs ml-1">current / max</span>
              </div>
              {sheet.mana_max === 0 && (
                <span className="text-xs text-codex-muted italic">No mana pool yet (unlocks at Level 2)</span>
              )}
            </div>
          )}

          {/* Spell list */}
          <div className="space-y-2 mb-3">
            {sheet.spells.length === 0 && (
              <p className="text-codex-muted text-xs italic">No spells known.</p>
            )}
            {sheet.spells.map((sp, i) => {
              const schoolColorMap = {
                Fire:      { badge: 'bg-orange-900/30 text-orange-400 border-orange-500/40', dot: 'bg-orange-400' },
                Ice:       { badge: 'bg-cyan-900/30 text-cyan-400 border-cyan-500/40',       dot: 'bg-cyan-400' },
                Lightning: { badge: 'bg-yellow-900/30 text-yellow-400 border-yellow-500/40', dot: 'bg-yellow-400' },
                Wind:      { badge: 'bg-sky-900/30 text-sky-400 border-sky-500/40',          dot: 'bg-sky-400' },
                Radiant:   { badge: 'bg-amber-900/30 text-amber-400 border-amber-500/40',    dot: 'bg-amber-400' },
                Necrotic:  { badge: 'bg-purple-900/30 text-purple-400 border-purple-500/40', dot: 'bg-purple-400' },
              };
              const sc = schoolColorMap[sp.school] || { badge: 'bg-codex-surface text-codex-subtext border-codex-border', dot: 'bg-codex-muted' };
              const isCantrip = sp.tier === 'Cantrip' || sp.tier === 0 || sp.tier === 'cantrip';
              const tierLabel = isCantrip ? 'Cantrip' : `Tier ${sp.tier}`;
              return (
                <div key={i} className="rounded-lg border border-codex-border bg-codex-surface p-3">
                  <div className="flex items-start gap-2">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sc.dot}`} />
                    <div className="flex-1 min-w-0">
                      {readOnly ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-codex-text text-sm font-medium">{sp.name || '—'}</span>
                          {sp.school && (
                            <span className={`text-[10px] border rounded px-1.5 py-0.5 font-medium ${sc.badge}`}>
                              {sp.school}
                            </span>
                          )}
                          <span className="text-[10px] border border-codex-border rounded px-1.5 py-0.5 text-codex-muted">
                            {tierLabel}
                          </span>
                          {sp.actions && (
                            <span className="text-[10px] text-codex-muted">{sp.actions} {sp.actions === 1 ? 'action' : 'actions'}</span>
                          )}
                          {sp.target && (
                            <span className="text-[10px] text-codex-muted">· {sp.target}</span>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <input
                            type="text"
                            value={sp.name}
                            onChange={e => updateSpell(i, 'name', e.target.value)}
                            placeholder="Spell name…"
                            className="col-span-2 bg-codex-bg border border-codex-border rounded px-2 py-1 text-sm text-codex-text
                              placeholder-codex-muted focus:outline-none focus:border-violet-500/40"
                          />
                          <select
                            value={sp.school}
                            onChange={e => updateSpell(i, 'school', e.target.value)}
                            className="bg-codex-bg border border-codex-border rounded px-2 py-1 text-sm text-codex-subtext
                              focus:outline-none focus:border-violet-500/40"
                          >
                            <option value="">School…</option>
                            {['Fire','Ice','Lightning','Wind','Radiant','Necrotic'].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <select
                            value={sp.tier}
                            onChange={e => updateSpell(i, 'tier', e.target.value)}
                            className="bg-codex-bg border border-codex-border rounded px-2 py-1 text-sm text-codex-subtext
                              focus:outline-none focus:border-violet-500/40"
                          >
                            <option value="Cantrip">Cantrip (0 mana)</option>
                            <option value="1">Tier 1 (1 mana)</option>
                            <option value="2">Tier 2 (2 mana)</option>
                            <option value="3">Tier 3 (3 mana)</option>
                          </select>
                        </div>
                      )}
                      {sp.summary && (
                        <p className="text-xs text-codex-muted mt-1 leading-relaxed">{sp.summary}</p>
                      )}
                      {!readOnly && !sp.summary && (
                        <input
                          type="text"
                          value={sp.summary || ''}
                          onChange={e => updateSpell(i, 'summary', e.target.value)}
                          placeholder="Effect summary…"
                          className="w-full mt-1 bg-codex-bg border border-codex-border rounded px-2 py-1 text-xs text-codex-muted
                            placeholder-codex-muted focus:outline-none focus:border-violet-500/40"
                        />
                      )}
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() => removeSpell(i)}
                        className="text-codex-muted hover:text-red-400 transition-colors mt-0.5 flex-shrink-0"
                        title="Remove spell"
                      >
                        <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 fill-current">
                          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!readOnly && (
            <button
              onClick={addSpell}
              className="text-xs text-codex-subtext border border-codex-border rounded px-3 py-1
                hover:border-violet-500/40 hover:text-violet-400 transition-colors"
            >
              + Add Spell
            </button>
          )}
        </div>
        )}

        {/* ── CLASS RESOURCES ────────────────────────────────────────────── */}
        {CLASS_RESOURCES[sheet.class_name] && (
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Class Resources</SectionHeader>
          <p className="text-xs text-codex-muted italic mb-4">
            Recharge on Safe Rest unless noted. Tap +/− to track uses mid-session.
          </p>
          <div className="space-y-4">
            {CLASS_RESOURCES[sheet.class_name].map(res => {
              const max = res.maxFn ? res.maxFn(sheet.stats, sheet.level || 1) : null;
              const current = res.isText
                ? (sheet.resources[res.key] ?? '')
                : Math.min(sheet.resources[res.key] ?? max ?? 0, max ?? 999);
              return (
                <div key={res.key} className={`rounded-xl border p-4 ${res.color}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{res.label}</div>
                      <p className="text-[11px] opacity-70 mt-0.5 leading-relaxed">{res.hint}</p>
                    </div>
                    {res.isText ? (
                      <input
                        type="text"
                        value={current}
                        onChange={e => setResource(res.key, e.target.value)}
                        placeholder="Creature name…"
                        disabled={readOnly}
                        className="w-40 bg-codex-bg border border-codex-border rounded px-2 py-1 text-sm text-codex-text
                          placeholder-codex-muted focus:outline-none focus:border-amber-500/60 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    ) : (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!readOnly && (
                          <button
                            onClick={() => setResource(res.key, Math.max(0, current - 1))}
                            className="w-8 h-8 rounded-lg border border-current bg-black/20 flex items-center justify-center
                              text-lg font-bold hover:bg-black/40 transition-colors"
                          >−</button>
                        )}
                        <div className="text-center min-w-[3.5rem]">
                          <div className="text-2xl font-bold leading-none">{current}</div>
                          {max !== null && (
                            <div className="text-[10px] opacity-60 mt-0.5">/ {max}</div>
                          )}
                        </div>
                        {!readOnly && (
                          <button
                            onClick={() => setResource(res.key, Math.min(max ?? 999, current + 1))}
                            className="w-8 h-8 rounded-lg border border-current bg-black/20 flex items-center justify-center
                              text-lg font-bold hover:bg-black/40 transition-colors"
                          >+</button>
                        )}
                        {!readOnly && max !== null && (
                          <button
                            onClick={() => setResource(res.key, max)}
                            className="text-[10px] opacity-60 hover:opacity-100 transition-opacity ml-1 underline"
                            title="Reset to max"
                          >reset</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* ── EQUIPMENT & MONEY ──────────────────────────────────────────── */}
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Equipment &amp; Money</SectionHeader>

          {/* Equipment list */}
          <div className="space-y-2 mb-4">
            {sheet.equipment.length === 0 && (
              <p className="text-codex-muted text-xs italic">No equipment yet.</p>
            )}
            {sheet.equipment.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={e.item}
                  onChange={ev => updateEquipment(i, 'item', ev.target.value)}
                  placeholder="Item name…"
                  disabled={readOnly}
                  className="flex-1 bg-codex-surface border border-codex-border rounded px-2 py-1.5 text-codex-text text-sm
                    placeholder-codex-muted focus:outline-none focus:border-ni-gold/60 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <input
                  type="number"
                  value={e.slots}
                  onChange={ev => updateEquipment(i, 'slots', clamp(ev.target.value, 0, 20))}
                  min={0} max={20}
                  disabled={readOnly}
                  title="Slots"
                  className="w-16 bg-codex-surface border border-codex-border rounded px-2 py-1.5 text-codex-text text-sm text-center
                    focus:outline-none focus:border-ni-gold/60 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <span className="text-codex-subtext text-xs w-8">slots</span>
                {!readOnly && (
                  <button
                    onClick={() => removeEquipment(i)}
                    className="text-codex-muted hover:text-red-400 transition-colors text-lg leading-none px-1"
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {!readOnly && (
            <>
              <EquipmentQuickAdd onAdd={name => addEquipment(name)} />
              <button
                onClick={() => addEquipment(null)}
                className="mt-2 text-xs text-ni-gold border border-ni-gold/30 rounded px-3 py-1
                  hover:bg-ni-gold/10 transition-colors"
              >
                + Custom Item
              </button>
            </>
          )}

          {/* Money */}
          <div className="grid grid-cols-3 gap-4 mt-5">
            {[
              { key: 'gold',   label: 'Gold',   color: 'text-ni-gold' },
              { key: 'silver', label: 'Silver', color: 'text-gray-300' },
              { key: 'copper', label: 'Copper', color: 'text-amber-700' },
            ].map(({ key, label, color }) => (
              <div key={key} className="text-center">
                <FieldLabel>{label}</FieldLabel>
                <NumberInput
                  value={sheet[key]}
                  onChange={v => update([key], clamp(v, 0, 999999))}
                  min={0} max={999999}
                  className={`mt-1 w-full ${color}`}
                  readOnly={readOnly}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ── LANGUAGES ──────────────────────────────────────────────────── */}
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <div className="flex items-baseline justify-between mb-3">
            <SectionHeader>Languages</SectionHeader>
            <span className={`text-xs mb-3 ${langCount > langMax ? 'text-red-400' : 'text-codex-subtext'}`}>
              Known: {langCount} / Max: {langMax}
            </span>
          </div>
          <p className="text-codex-subtext text-xs mb-3 italic">
            Each point of INT grants +1 additional language beyond Common.
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_LANGUAGES.map(lang => {
              const selected = sheet.languages.includes(lang);
              const isCommon = lang === 'Common';
              const disabled = readOnly || isCommon || (!selected && langCount >= langMax);
              return (
                <button
                  key={lang}
                  onClick={() => toggleLanguage(lang)}
                  disabled={disabled}
                  className={`px-3 py-1 rounded-full text-sm border transition-all
                    ${selected
                      ? 'bg-ni-gold/30 border-ni-gold text-ni-gold/80'
                      : 'bg-codex-surface border-codex-border text-codex-subtext'
                    }
                    ${!disabled && !selected ? 'hover:border-ni-gold/50 hover:text-ni-gold' : ''}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {lang}
                  {isCommon && <span className="ml-1 text-xs opacity-60">(always)</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── OTHER ABILITIES ────────────────────────────────────────────── */}
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Abilities &amp; Features</SectionHeader>
          <div className="space-y-4">
            {sheet.abilities.length === 0 && (
              <p className="text-codex-muted text-xs italic">No abilities yet.</p>
            )}
            {sheet.abilities.map((a, i) => (
              <div key={i} className="border border-codex-border rounded-lg p-3 bg-codex-surface relative">
                {!readOnly && (
                  <button
                    onClick={() => removeAbility(i)}
                    className="absolute top-2 right-2 text-codex-muted hover:text-red-400 transition-colors text-lg leading-none"
                    title="Remove ability"
                  >
                    ×
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3 mb-2 pr-6">
                  <div>
                    <FieldLabel>Name</FieldLabel>
                    <TextInput
                      value={a.name}
                      onChange={v => updateAbility(i, 'name', v)}
                      placeholder="Ability name…"
                      className="mt-1"
                      readOnly={readOnly}
                    />
                  </div>
                  <div>
                    <FieldLabel>Source</FieldLabel>
                    <SelectInput
                      value={a.source}
                      onChange={v => updateAbility(i, 'source', v)}
                      options={ABILITY_SOURCES}
                      className="mt-1 w-full"
                      readOnly={readOnly}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    value={a.description}
                    onChange={e => updateAbility(i, 'description', e.target.value)}
                    placeholder="Describe the ability…"
                    disabled={readOnly}
                    rows={3}
                    className="mt-1 w-full bg-codex-card border border-codex-border rounded px-2 py-1.5 text-codex-text text-sm
                      placeholder-codex-muted focus:outline-none focus:border-ni-gold/60 transition-colors resize-y
                      disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            ))}
          </div>
          {!readOnly && (
            <button
              onClick={addAbility}
              className="mt-3 text-xs text-ni-gold border border-ni-gold/30 rounded px-3 py-1
                hover:bg-ni-gold/10 transition-colors"
            >
              + Add Ability
            </button>
          )}
        </div>

        {/* ── NOTES ──────────────────────────────────────────────────────── */}
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Notes</SectionHeader>
          <textarea
            value={sheet.notes}
            onChange={e => update(['notes'], e.target.value)}
            placeholder="Session notes, backstory, reminders…"
            disabled={readOnly}
            rows={6}
            className="w-full bg-codex-surface border border-codex-border rounded px-3 py-2 text-codex-text text-sm
              placeholder-codex-muted focus:outline-none focus:border-ni-gold/60 transition-colors resize-y
              disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* ── LEVEL & ADVANCEMENT ────────────────────────────────────────── */}
        {!readOnly && (
        <div className="bg-codex-card border border-codex-border rounded-lg p-5 shadow-card">
          <SectionHeader>Level &amp; Advancement</SectionHeader>

          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-codex-subtext text-sm">Current Level</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => update(['level'], Math.max(1, (sheet.level || 1) - 1))}
                  className="w-7 h-7 rounded border border-codex-border text-codex-subtext hover:border-codex-text hover:text-codex-text
                    flex items-center justify-center text-base transition-colors"
                >−</button>
                <span className="text-2xl font-bold text-codex-text w-8 text-center">{sheet.level || 1}</span>
                <button
                  onClick={() => update(['level'], Math.min(10, (sheet.level || 1) + 1))}
                  className="w-7 h-7 rounded border border-codex-border text-codex-subtext hover:border-codex-text hover:text-codex-text
                    flex items-center justify-center text-base transition-colors"
                >+</button>
              </div>
            </div>
            <button
              onClick={rollLevelUp}
              className="px-4 py-2 rounded-lg bg-ni-gold/20 border border-ni-gold/50 text-ni-gold
                text-sm font-medium hover:bg-ni-gold/40 transition-colors"
            >
              Roll Level-Up HP ({sheet.hit_dice || 'd8'} with Advantage)
            </button>
          </div>

          {/* Roll result + confirmation */}
          {levelUpRoll && (
            <div className="rounded-xl border border-ni-gold/30 bg-ni-gold/6 p-4 space-y-3">
              <div className="text-sm font-semibold text-ni-gold">
                Level {levelUpRoll.nextLvl} — HP Roll Result
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-center">
                  <div className="text-xs text-codex-muted mb-1">Roll 1</div>
                  <div className={`text-2xl font-bold ${levelUpRoll.roll1 >= levelUpRoll.roll2 ? 'text-ni-gold' : 'text-codex-muted'}`}>
                    {levelUpRoll.roll1}
                  </div>
                </div>
                <div className="text-codex-muted text-xs">vs</div>
                <div className="text-center">
                  <div className="text-xs text-codex-muted mb-1">Roll 2</div>
                  <div className={`text-2xl font-bold ${levelUpRoll.roll2 > levelUpRoll.roll1 ? 'text-ni-gold' : 'text-codex-muted'}`}>
                    {levelUpRoll.roll2}
                  </div>
                </div>
                <div className="flex-1 border-l border-codex-border pl-4">
                  <div className="text-xs text-codex-muted">HP Gain</div>
                  <div className="text-3xl font-bold text-ni-gold">+{levelUpRoll.hpGain}</div>
                </div>
                {levelUpRoll.newMana > sheet.mana_max && (
                  <div className="flex-1 border-l border-codex-border pl-4">
                    <div className="text-xs text-codex-muted">Mana Pool</div>
                    <div className="text-xl font-bold text-violet-400">{sheet.mana_max} → {levelUpRoll.newMana}</div>
                    <div className="text-[10px] text-codex-muted mt-0.5">Unlocks at Level {MANA_UNLOCK_LEVEL}</div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmLevelUp}
                  className="px-4 py-2 rounded-lg bg-ni-gold/40 border border-ni-gold text-ni-gold/80
                    text-sm font-medium hover:bg-ni-gold/55 transition-colors"
                >
                  ✓ Confirm — Apply to Sheet
                </button>
                <button
                  onClick={() => setLevelUpRoll(null)}
                  className="px-4 py-2 rounded-lg border border-codex-border text-codex-subtext
                    text-sm hover:border-codex-text hover:text-codex-text transition-colors"
                >
                  Re-roll
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-codex-muted mt-3 leading-relaxed">
            Per Nimble rules: roll your hit die <strong className="text-codex-subtext">twice</strong> at level-up and take the higher result.
            Caster mana pools recalculate automatically from stats + level when confirmed.
          </p>
        </div>
        )}

      </div>
    </div>
  );
}

// ── Utility: immutable deep-set via path array ────────────────────────────────

function deepSet(obj, path, value) {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    return Array.isArray(obj)
      ? obj.map((v, i) => (i === Number(head) ? value : v))
      : { ...obj, [head]: value };
  }
  const child = obj[head] ?? (typeof rest[0] === 'number' ? [] : {});
  return { ...obj, [head]: deepSet(child, rest, value) };
}
