import { useState, useEffect } from 'react'
import { X, Sword } from 'lucide-react'
import { api } from '../../utils/api'

const INPUT = `w-full bg-codex-bg border border-codex-border rounded-lg px-3 py-2 text-sm text-codex-text placeholder-codex-muted focus:outline-none focus:border-codex-gold/50 transition-colors`

const LABEL = `block text-xs font-medium text-codex-subtext mb-1.5`

export default function QuickMonsterModal({ gameSystem, onCreated, onClose }) {
  const [form, setForm] = useState({
    name:     '',
    hp:       '',
    ac:       '12',
    hitDie:   'd8',
    level:    '1',
    dexBonus: '0',
    attack:   '',
    special:  '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!form.hp || Number(form.hp) < 1) { setError('HP must be at least 1.'); return }

    setSubmitting(true)
    try {
      const payload = {
        name:      form.name.trim(),
        gameSystem,
        challenge: String(form.level),
        tags:      [],
        statData: {
          hp:         Number(form.hp),
          ac:         Number(form.ac),
          hitDie:     form.hitDie,
          level:      Number(form.level),
          combatRole: 'monster',
          movement:   'near',
          stats: {
            str: 0,
            dex: Number(form.dexBonus),
            con: 0,
            int: 0,
            wis: 0,
            cha: 0,
          },
          attacks: form.attack.trim()
            ? [{
                count:     1,
                weapon:    form.attack.trim(),
                range:     '',
                bonus:     0,
                damage:    '',
                connector: '',
              }]
            : [],
          talents: form.special.trim()
            ? [{
                name:        form.special.trim(),
                description: '',
              }]
            : [],
        },
      }

      const { monster } = await api.post('/bestiary', payload)
      onCreated(monster)
    } catch (err) {
      setError(err.message || 'Failed to create monster.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-codex-card border border-amber-500/20 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">

        {/* Amber top accent line */}
        <div className="h-0.5 bg-gradient-to-r from-amber-500/60 via-codex-gold to-amber-500/60" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Sword size={13} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-codex-text">Quick Monster</h2>
              <p className="text-[10px] text-codex-muted">Saved to bestiary automatically</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-codex-muted hover:text-codex-text transition-colors p-1 rounded-lg hover:bg-codex-surface"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 pb-5 flex flex-col gap-4">

          {/* Name */}
          <div>
            <label className={LABEL}>
              Name <span className="text-amber-500">*</span>
            </label>
            <input
              type="text"
              maxLength={80}
              placeholder="e.g. Cave Goblin"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className={INPUT}
              autoFocus
            />
          </div>

          {/* HP + AC */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>
                HP <span className="text-amber-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 8"
                value={form.hp}
                onChange={e => set('hp', e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>AC</label>
              <input
                type="number"
                min={0}
                value={form.ac}
                onChange={e => set('ac', e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {/* Hit Die + Level */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Hit Die</label>
              <select
                value={form.hitDie}
                onChange={e => set('hitDie', e.target.value)}
                className={INPUT + ' cursor-pointer'}
              >
                <option value="d4">d4</option>
                <option value="d6">d6</option>
                <option value="d8">d8</option>
                <option value="d10">d10</option>
                <option value="d12">d12</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Level</label>
              <input
                type="number"
                min={0}
                value={form.level}
                onChange={e => set('level', e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {/* Dex Bonus */}
          <div>
            <label className={LABEL}>
              Dex Bonus{' '}
              <span className="text-codex-muted font-normal">(initiative modifier)</span>
            </label>
            <input
              type="number"
              value={form.dexBonus}
              onChange={e => set('dexBonus', e.target.value)}
              placeholder="0"
              className={INPUT}
            />
          </div>

          {/* Attack */}
          <div>
            <label className={LABEL}>Attack</label>
            <input
              type="text"
              placeholder="e.g. Claw 1d6+2"
              value={form.attack}
              onChange={e => set('attack', e.target.value)}
              className={INPUT}
            />
          </div>

          {/* Special */}
          <div>
            <label className={LABEL}>Special</label>
            <input
              type="text"
              placeholder="e.g. Pack Tactics — advantage when ally adjacent"
              value={form.special}
              onChange={e => set('special', e.target.value)}
              className={INPUT}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-codex-border text-codex-subtext hover:text-codex-text hover:border-codex-gold/40 text-sm transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-lg bg-codex-gold text-codex-bg hover:bg-codex-goldHover font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating…' : 'Add to Combat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
