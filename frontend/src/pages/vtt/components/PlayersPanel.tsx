/**
 * PlayersPanel.tsx — Who is currently at the table.
 *
 * Sits under the room badge in the top-right. Knowing who is actually
 * connected matters constantly during play: whether a player has loaded in,
 * whether someone dropped, whether the GM is present.
 *
 * The roster is seeded from the join_campaign response and kept current by
 * the vtt:member_joined / vtt:member_left broadcasts.
 */

import { useState }    from 'react'
import { useVTTStore } from '../store'

export function PlayersPanel() {
  const members   = useVTTStore(s => s.network.members)
  const connected = useVTTStore(s => s.network.connected)
  const [open, setOpen] = useState(false)

  if (!connected) return null

  // GM first, then players alphabetically — a stable order so rows don't
  // jump around as people connect and disconnect.
  const sorted = [...members].sort((a, b) => {
    if (a.isGM !== b.isGM) return a.isGM ? -1 : 1
    return a.username.localeCompare(b.username)
  })

  return (
    <div className="fixed right-3 top-24 z-[150] w-44 pointer-events-auto">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/70 px-2.5 py-1.5 text-xs text-white/70 backdrop-blur-sm transition-colors hover:text-white"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] leading-none">👥</span>
          At the table
        </span>
        <span className="flex items-center gap-1.5">
          <span className="tabular-nums text-white/50">{sorted.length}</span>
          <span className="text-[9px] text-white/40">{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <ul className="mt-1 overflow-hidden rounded-lg border border-white/10 bg-black/70 backdrop-blur-sm">
          {sorted.length === 0 && (
            <li className="px-2.5 py-2 text-[11px] italic text-white/40">
              No one else connected
            </li>
          )}
          {sorted.map(m => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 border-b border-white/5 px-2.5 py-1.5 last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate text-[11px] text-white/80">{m.username}</span>
              </span>
              <span
                className={[
                  'shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide',
                  m.isGM
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-white/10 text-white/50',
                ].join(' ')}
              >
                {m.isGM ? 'GM' : 'Player'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
