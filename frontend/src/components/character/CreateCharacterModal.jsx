import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Sword, Skull, Shield } from 'lucide-react'

const SYSTEMS = [
  {
    id:          'shadowdark',
    name:        'Shadowdark',
    tagline:     'Old-school dungeon crawling in the dark.',
    icon:        <Sword size={22} />,
    accent:      'border-amber-500/60 hover:border-amber-500',
    iconColor:   'text-amber-500',
    badgeCls:    'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  {
    id:          'morkborg',
    name:        'Mörk Borg',
    tagline:     'Doom metal, doom magic, doom everything.',
    icon:        <Skull size={22} />,
    accent:      'border-yellow-300/60 hover:border-yellow-300',
    iconColor:   'text-yellow-300',
    badgeCls:    'bg-yellow-300/10 text-yellow-300 border-yellow-300/30',
  },
  {
    id:          'nimble',
    name:        'Nimble RPG',
    tagline:     'Fast, action-driven tactical play.',
    icon:        <Shield size={22} />,
    accent:      'border-emerald-500/60 hover:border-emerald-500',
    iconColor:   'text-emerald-400',
    badgeCls:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
]

export default function CreateCharacterModal({ onClose, campaigns = [] }) {
  const navigate             = useNavigate()
  const [selected, setSelected] = useState(null)
  const [campaignId, setCampaignId] = useState('')

  // Only show campaigns that match the selected system and the user is a player in
  const eligibleCampaigns = campaigns.filter(
    c => c.game_system === selected && c.gm_user_id === undefined
      // show all campaigns matching the system — user can optionally link
      || c.game_system === selected
  )

  function handleCreate() {
    if (!selected) return
    const params = new URLSearchParams({ system: selected })
    if (campaignId) params.set('campaignId', campaignId)
    navigate(`/characters/new?${params.toString()}`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-codex-card border border-codex-border rounded-2xl overflow-hidden shadow-2xl">

        {/* Gold top line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-codex-gold to-transparent opacity-70" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-codex-text">New Character</h2>
            <p className="text-xs text-codex-subtext mt-0.5">Choose a game system to get started</p>
          </div>
          <button onClick={onClose}
            className="text-codex-muted hover:text-codex-text transition-colors p-1 rounded-lg hover:bg-codex-surface">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">

          {/* System picker */}
          <div className="flex flex-col gap-2">
            {SYSTEMS.map(sys => (
              <button
                key={sys.id}
                onClick={() => { setSelected(sys.id); setCampaignId('') }}
                className={`flex items-center gap-4 text-left p-4 rounded-xl border-2 bg-codex-surface transition-all duration-150
                  ${selected === sys.id
                    ? sys.accent + ' bg-codex-bg'
                    : 'border-codex-border hover:bg-codex-bg'}`}
              >
                <span className={`flex-shrink-0 ${selected === sys.id ? sys.iconColor : 'text-codex-muted'} transition-colors`}>
                  {sys.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-codex-text">{sys.name}</span>
                    {selected === sys.id && (
                      <span className={`text-[10px] border rounded-full px-2 py-0.5 ${sys.badgeCls}`}>
                        selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-codex-subtext mt-0.5">{sys.tagline}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all
                  ${selected === sys.id ? sys.iconColor.replace('text-', 'border-') + ' bg-current scale-110' : 'border-codex-border'}`} />
              </button>
            ))}
          </div>

          {/* Optional: link to a campaign */}
          {selected && campaigns.filter(c => c.game_system === selected).length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-codex-subtext">
                Link to a campaign <span className="text-codex-muted">(optional)</span>
              </label>
              <select
                value={campaignId}
                onChange={e => setCampaignId(e.target.value)}
                className="w-full bg-codex-surface border border-codex-border rounded-lg px-3 py-2 text-sm text-codex-text focus:outline-none focus:border-codex-gold transition-colors"
              >
                <option value="">No campaign — standalone character</option>
                {campaigns
                  .filter(c => c.game_system === selected)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-codex-border text-codex-subtext text-sm hover:border-codex-text hover:text-codex-text transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!selected}
              className="flex-1 py-2.5 rounded-xl bg-codex-gold hover:bg-codex-goldHover text-codex-bg font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create Character
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
