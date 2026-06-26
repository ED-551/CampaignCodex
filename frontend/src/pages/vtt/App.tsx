/**
 * App.tsx — VTT root layout: canvas + all React overlays.
 *
 * In CampaignCodex mode, campaignId is passed as a prop and auth is JWT-based.
 * The NetworkModal (standalone room-code flow) is hidden — connection happens
 * automatically via joinCampaign() on mount.
 *
 * The PixiJS canvas sits behind everything. React UI components (toolbar,
 * sidebars, modals) are positioned absolutely on top using CSS z-index.
 * All overlays use pointer-events: none on containers that should pass
 * clicks through to the canvas, and pointer-events: auto on interactive elements.
 */

import { useEffect, useState } from 'react'
import './index.css'
import { VTTCanvas }           from './canvas/VTTCanvas'
import { Toolbar }             from './components/Toolbar'
import { TokenPanel }          from './components/TokenPanel'
import { TokenProperties }     from './components/TokenProperties'
import { WallPanel }           from './components/WallPanel'
import { LightPanel }          from './components/LightPanel'
import { FogPanel }            from './components/FogPanel'
import { DrawingPanel }        from './components/DrawingPanel'
import { AssetPanel }           from './components/AssetPanel'
import { InitiativeTracker }   from './components/InitiativeTracker'
import { SceneManager }        from './components/SceneManager'
import { SettingsPanel }       from './components/SettingsPanel'
import { RoomBadge }           from './components/RoomBadge'
import { useVTTStore }         from './store'
import { vttSocket }           from './socket/client'
import type { Tool }           from './types'

// ── Global keyboard shortcuts for tool switching ──────────────────────────────
const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',  V: 'select',
  t: 'token',   T: 'token',
  w: 'wall',    W: 'wall',
  l: 'light',   L: 'light',
  f: 'fog',     F: 'fog',
  d: 'draw',    D: 'draw',
  m: 'measure', M: 'measure',
  p: 'ping',    P: 'ping',
}

interface AppProps {
  campaignId?: string
}

export default function App({ campaignId }: AppProps) {
  const setTool = useVTTStore(s => s.setTool)
  const [assetOpen,    setAssetOpen]    = useState(false)
  const [combatOpen,   setCombatOpen]   = useState(false)
  const [sceneOpen,    setSceneOpen]    = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  // ── Auto-connect to campaign VTT session ──────────────────────────────────
  useEffect(() => {
    if (!campaignId) return
    vttSocket.joinCampaign(campaignId).catch((err: Error) => {
      setConnectError(err.message)
    })
    return () => { vttSocket.disconnect() }
  }, [campaignId])

  // ── Tool key shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'a' || e.key === 'A') { setAssetOpen(prev => !prev); return }
      if (e.key === 'i' || e.key === 'I') { setCombatOpen(prev => !prev); return }
      if (e.key === 's' || e.key === 'S') { setSceneOpen(prev => !prev); return }
      if (e.key === ',') { setSettingsOpen(prev => !prev); return }
      if (e.key === 'Escape') {
        setSceneOpen(false); setAssetOpen(false)
        setCombatOpen(false); setSettingsOpen(false)
        return
      }
      const tool = TOOL_KEYS[e.key]
      if (tool) setTool(tool)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setTool])

  if (connectError) {
    return (
      <div className="vtt-root flex items-center justify-center bg-[#0a0b0f] text-white">
        <div className="text-center">
          <p className="text-red-400 mb-2">Could not connect to VTT session.</p>
          <p className="text-white/50 text-sm">{connectError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="vtt-root">
      {/* Layer 0: PixiJS canvas */}
      <VTTCanvas />

      {/* Layer 1: UI overlays */}
      <Toolbar
        onOpenAssets={() => setAssetOpen(prev => !prev)}
        assetPanelOpen={assetOpen}
        onOpenCombat={() => setCombatOpen(prev => !prev)}
        combatPanelOpen={combatOpen}
        onOpenScenes={() => setSceneOpen(prev => !prev)}
        scenePanelOpen={sceneOpen}
        onOpenSettings={() => setSettingsOpen(prev => !prev)}
        settingsPanelOpen={settingsOpen}
      />
      <TokenPanel />
      <WallPanel />
      <LightPanel />
      <FogPanel />
      <DrawingPanel />
      <TokenProperties />
      <AssetPanel open={assetOpen} onClose={() => setAssetOpen(false)} />
      <InitiativeTracker open={combatOpen} onClose={() => setCombatOpen(false)} />
      <SceneManager open={sceneOpen} onClose={() => setSceneOpen(false)} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Network status badge (read-only in integrated mode — shows connected/role) */}
      <RoomBadge onOpenModal={() => {}} />
    </div>
  )
}
