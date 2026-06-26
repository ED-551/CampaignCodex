/**
 * placeholders.ts — Built-in SVG token placeholders.
 *
 * These are generated at module load time as data:image/svg+xml URLs so they
 * work immediately without any upload or IndexedDB interaction.
 *
 * They are listed in the Asset Panel before user-uploaded assets.
 * They are never stored in IndexedDB — their IDs start with "__ph_" so the
 * canvas can detect them and resolve the dataUrl from this module directly.
 */

import type { AssetRecord } from './assetDb'

// ─── SVG generator ───────────────────────────────────────────────────────────

function svgToken(letter: string, bg: string, fg = '#ffffff'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <circle cx="64" cy="64" r="58" fill="${bg}" stroke="${fg}" stroke-width="5"/>
  <text x="64" y="64" font-family="'Segoe UI',Arial,sans-serif" font-size="54"
    font-weight="700" fill="${fg}" text-anchor="middle" dominant-baseline="central">${letter}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

// ─── Placeholder definitions ──────────────────────────────────────────────────

interface PlaceholderDef {
  id:    string
  name:  string
  color: string
  letter: string
}

const DEFS: PlaceholderDef[] = [
  // Player characters
  { id: '__ph_fighter', name: 'Fighter', color: '#2563eb', letter: 'F' },
  { id: '__ph_wizard',  name: 'Wizard',  color: '#7c3aed', letter: 'W' },
  { id: '__ph_rogue',   name: 'Rogue',   color: '#1e293b', letter: 'R' },
  { id: '__ph_cleric',  name: 'Cleric',  color: '#d97706', letter: 'C' },
  { id: '__ph_ranger',  name: 'Ranger',  color: '#16a34a', letter: 'R' },
  { id: '__ph_bard',    name: 'Bard',    color: '#db2777', letter: 'B' },
  { id: '__ph_paladin', name: 'Paladin', color: '#f59e0b', letter: 'P' },
  { id: '__ph_druid',   name: 'Druid',   color: '#65a30d', letter: 'D' },
  // NPCs & monsters
  { id: '__ph_npc',     name: 'NPC',     color: '#64748b', letter: 'N' },
  { id: '__ph_monster', name: 'Monster', color: '#dc2626', letter: 'M' },
  { id: '__ph_goblin',  name: 'Goblin',  color: '#84cc16', letter: 'G' },
  { id: '__ph_dragon',  name: 'Dragon',  color: '#b91c1c', letter: 'D' },
  { id: '__ph_undead',  name: 'Undead',  color: '#374151', letter: 'U' },
  { id: '__ph_boss',    name: 'Boss',    color: '#7f1d1d', letter: '★' },
]

export const PLACEHOLDER_TOKENS: AssetRecord[] = DEFS.map(def => {
  const url = svgToken(def.letter, def.color)
  return {
    id:        def.id,
    name:      def.name,
    type:      'token',
    dataUrl:   url,
    thumbnail: url,
    width:     128,
    height:    128,
    createdAt: 0,
  }
})

/** Look up a placeholder by id. Returns undefined if id is not a placeholder. */
export function getPlaceholder(id: string): AssetRecord | undefined {
  return PLACEHOLDER_TOKENS.find(p => p.id === id)
}

/** True if the asset id refers to a built-in placeholder. */
export function isPlaceholder(id: string): boolean {
  return id.startsWith('__ph_')
}
