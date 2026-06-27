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

import { useEffect, useState, useCallback } from 'react'
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
  const setTool            = useVTTStore(s => s.setTool)
  const isGM               = useVTTStore(s => s.network.isGM)
  const sessionActive      = useVTTStore(s => s.sessionActive)
  const setSessionActive   = useVTTStore(s => s.setSessionActive)
  const playerPreviewMode  = useVTTStore(s => s.playerPreviewMode)
  const setPlayerPreviewMode = useVTTStore(s => s.setPlayerPreviewMode)

  const [assetOpen,    setAssetOpen]    = useState(false)
  const [combatOpen,   setCombatOpen]   = useState(false)
  const [sceneOpen,    setSceneOpen]    = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)

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

  // ── Go Live / End Session ─────────────────────────────────────────────────
  const handleToggleSession = useCallback(async () => {
    if (!campaignId || sessionLoading) return
    setSessionLoading(true)
    const token = localStorage.getItem('cc_token')
    const endpoint = sessionActive ? 'end' : 'start'
    try {
      const res = await fetch(`/api/vtt/${campaignId}/session/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setSessionActive(!sessionActive)
    } catch {
      // silent — user can retry
    } finally {
      setSessionLoading(false)
    }
  }, [campaignId, sessionActive, sessionLoading, setSessionActive])

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

      {/* GM-only: Go Live / End Session + Player Preview controls */}
      {isGM && (
        <div className="fixed top-3 right-3 z-[100] flex items-center gap-2 pointer-events-auto">
          {/* Player Preview toggle */}
          <button
            onClick={() => setPlayerPreviewMode(!playerPreviewMode)}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm transition-colors',
              playerPreviewMode
                ? 'bg-amber-500/20 border border-amber-400/60 text-amber-300 hover:bg-amber-500/30'
                : 'bg-black/60 border border-white/10 text-white/70 hover:text-white hover:border-white/20',
            ].join(' ')}
            title={playerPreviewMode ? 'Exit player preview' : 'Preview as player'}
          >
            {playerPreviewMode ? '👁 GM View' : '👁 Player View'}
          </button>

          {/* Go Live / End Session */}
          <button
            onClick={handleToggleSession}
            disabled={sessionLoading}
            className={[
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold backdrop-blur-sm transition-colors disabled:opacity-50',
              sessionActive
                ? 'bg-red-900/60 border border-red-500/50 text-red-300 hover:bg-red-900/80'
                : 'bg-emerald-900/60 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80',
            ].join(' ')}
            title={sessionActive ? 'End the VTT session' : 'Go live — notify players'}
          >
            {sessionActive && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            {sessionLoading ? '…' : sessionActive ? 'End Session' : 'Go Live'}
          </button>
        </div>
      )}

      {/* Player preview mode banner */}
      {isGM && playerPreviewMode && (
        <div className="fixed top-0 left-0 right-0 z-[99] flex items-center justify-center py-1.5 bg-amber-500/15 border-b border-amber-400/30 pointer-events-none">
          <span className="text-xs font-semibold text-amber-300 tracking-wide">
            👁 Previewing player view — your changes are paused
          </span>
        </div>
      )}
    </div>
  )
}
