/**
 * socket/client.ts — CampaignCodex VTT socket client.
 *
 * Connects to the /vtt Socket.io namespace using the CampaignCodex JWT.
 * Auth is implicit — the user's existing login session grants VTT access.
 * No room codes. Campaign membership is checked server-side on join_campaign.
 *
 * Local-first optimistic updates: store mutations apply immediately.
 * suppressEmit prevents echo loops when applying incoming server events.
 */

import { io, Socket }   from 'socket.io-client'
import { useVTTStore }  from '../store'

// ─── Suppress-emit guard ──────────────────────────────────────────────────────

let suppressEmit = false

export function withoutEmit(fn: () => void): void {
  suppressEmit = true
  try { fn() } finally { suppressEmit = false }
}

// ─── Debounce ─────────────────────────────────────────────────────────────────

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; fn(...args) }, ms)
  }) as T
}

// ─── VTT Socket Client ────────────────────────────────────────────────────────

class VTTSocketClient {
  private socket:        Socket | null = null
  private campaignId:    string | null = null
  private unsubs:        (() => void)[] = []
  private sendSceneSync: (() => void) | null = null

  // ── Connect to /vtt namespace with JWT ────────────────────────────────────

  private connect(): Socket {
    if (this.socket?.connected) return this.socket
    const token = localStorage.getItem('cc_token')
    this.socket = io('/vtt', {
      auth:               { token },
      autoConnect:        true,
      reconnectionAttempts: 5,
    })
    this.setupIncoming()
    return this.socket
  }

  // ── Join a campaign VTT session ───────────────────────────────────────────

  async joinCampaign(campaignId: string): Promise<{
    isGM: boolean
    campaignName: string
    scene: { id: string; name: string; sceneData: Record<string, unknown> } | null
  }> {
    const socket = this.connect()
    this.campaignId = campaignId

    return new Promise((resolve, reject) => {
      socket.emit('join_campaign', { campaignId }, (res: {
        ok: boolean
        isGM?: boolean
        campaignName?: string
        scene?: { id: string; name: string; sceneData: Record<string, unknown> }
        error?: string
      }) => {
        if (!res.ok) {
          reject(new Error(res.error ?? 'Failed to join VTT session.'))
          return
        }

        useVTTStore.getState().setNetworkInfo({
          connected:  true,
          roomCode:   campaignId,
          isGM:       res.isGM ?? false,
          gmToken:    null,
          serverUrl:  '',
        })

        // Apply initial scene state if provided
        if (res.scene?.sceneData && Object.keys(res.scene.sceneData).length > 0) {
          withoutEmit(() => applySceneSync(res.scene!.sceneData))
        }

        this.setupOutgoing()
        resolve({
          isGM:         res.isGM ?? false,
          campaignName: res.campaignName ?? '',
          scene:        res.scene ?? null,
        })
      })
    })
  }

  // ── Disconnect ────────────────────────────────────────────────────────────

  disconnect(): void {
    for (const u of this.unsubs) u()
    this.unsubs = []
    this.socket?.disconnect()
    this.socket        = null
    this.campaignId    = null
    this.sendSceneSync = null

    useVTTStore.getState().setNetworkInfo({
      connected:  false,
      roomCode:   null,
      isGM:       false,
      gmToken:    null,
      serverUrl:  '',
    })
  }

  // ── Emit helper ───────────────────────────────────────────────────────────

  emit(event: string, data: unknown): void {
    if (!this.socket?.connected) return
    this.socket.emit(event, data)
  }

  // ── Incoming events ───────────────────────────────────────────────────────

  private setupIncoming(): void {
    const s = this.socket!

    s.on('scene_sync', (data: unknown) => {
      withoutEmit(() => applySceneSync(data))
    })

    s.on('token_move', (data: { id: string; x: number; y: number }) => {
      withoutEmit(() => useVTTStore.getState().moveToken(data.id, data.x, data.y))
    })

    s.on('token_add',      (d: { token: unknown })      => withoutEmit(() => {
      const store = useVTTStore.getState()
      store.addToken(d.token as Parameters<typeof store.addToken>[0])
    }))
    s.on('token_delete',   (d: { id: string })          => withoutEmit(() => useVTTStore.getState().deleteToken(d.id)))
    s.on('wall_add',       (d: { wall: unknown })       => withoutEmit(() => {
      const store = useVTTStore.getState()
      store.addWall(d.wall as Parameters<typeof store.addWall>[0])
    }))
    s.on('wall_delete',    (d: { id: string })          => withoutEmit(() => useVTTStore.getState().deleteWall(d.id)))
    s.on('door_toggle',    (d: { id: string; isOpen: boolean }) => withoutEmit(() => useVTTStore.getState().updateWall(d.id, { isOpen: d.isOpen })))
    s.on('light_add',      (d: { light: unknown })      => withoutEmit(() => {
      const store = useVTTStore.getState()
      store.addLight(d.light as Parameters<typeof store.addLight>[0])
    }))
    s.on('light_delete',   (d: { id: string })          => withoutEmit(() => useVTTStore.getState().deleteLight(d.id)))
    s.on('drawing_add',    (d: { drawing: unknown })    => withoutEmit(() => {
      const store = useVTTStore.getState()
      store.addDrawing(d.drawing as Parameters<typeof store.addDrawing>[0])
    }))
    s.on('drawing_delete', (d: { id: string })          => withoutEmit(() => useVTTStore.getState().deleteDrawing(d.id)))
    s.on('fog_update',     (d: { clearedCells: Record<string, true>; revealAll: boolean }) => {
      withoutEmit(() => {
        const store = useVTTStore.getState()
        store.fogRevealCells(Object.keys(d.clearedCells))
        if (d.revealAll) store.fogRevealAll()
      })
    })
    s.on('ping_marker', (d: { x: number; y: number }) => {
      window.dispatchEvent(new CustomEvent('vtt:ping', { detail: d }))
    })

    s.on('connect',    () => useVTTStore.getState().setNetworkInfo({ connected: true }))
    s.on('disconnect', () => useVTTStore.getState().setNetworkInfo({ connected: false }))
  }

  // ── Outgoing events (store → server, GM only) ─────────────────────────────

  private setupOutgoing(): void {
    if (!this.socket) return

    const debounced = debounce(() => {
      if (suppressEmit || !useVTTStore.getState().network.isGM) return
      this.sendSceneSyncNow()
    }, 300)

    this.sendSceneSync = debounced

    this.unsubs.push(
      useVTTStore.subscribe(s => s.tokens, (tokens, prev) => {
        if (suppressEmit || !this.socket?.connected || !useVTTStore.getState().network.isGM) return
        for (const [id, tok] of Object.entries(tokens)) {
          const p = prev[id]
          if (p && (p.x !== tok.x || p.y !== tok.y)) {
            this.emit('token_move', { id, x: tok.x, y: tok.y })
          }
        }
      }),
    )

    const scheduleSync = () => { if (!suppressEmit) this.sendSceneSync?.() }

    this.unsubs.push(
      useVTTStore.subscribe(s => s.tokens,   scheduleSync),
      useVTTStore.subscribe(s => s.walls,    scheduleSync),
      useVTTStore.subscribe(s => s.lights,   scheduleSync),
      useVTTStore.subscribe(s => s.drawings, scheduleSync),
      useVTTStore.subscribe(s => s.fog,      scheduleSync),
    )
  }

  sendSceneSyncNow(): void {
    const s = useVTTStore.getState()
    this.emit('scene_sync', {
      tokens:   s.tokens,
      walls:    s.walls,
      lights:   s.lights,
      drawings: s.drawings,
      fog:      s.fog,
    })
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const vttSocket = new VTTSocketClient()

// ─── Apply incoming scene state ───────────────────────────────────────────────

function applySceneSync(data: unknown): void {
  if (!data || typeof data !== 'object') return
  const d = data as Record<string, unknown>
  const store = useVTTStore.getState()

  if (d.tokens && typeof d.tokens === 'object') {
    const received = d.tokens as Record<string, Parameters<typeof store.addToken>[0]>
    for (const id of Object.keys(store.tokens)) store.deleteToken(id)
    for (const tok of Object.values(received)) store.addToken(tok)
  }
  if (d.walls && typeof d.walls === 'object') {
    const received = d.walls as Record<string, Parameters<typeof store.addWall>[0]>
    store.clearWalls()
    for (const w of Object.values(received)) store.addWall(w)
  }
  if (d.lights && typeof d.lights === 'object') {
    const received = d.lights as Record<string, Parameters<typeof store.addLight>[0]>
    store.clearLights()
    for (const l of Object.values(received)) store.addLight(l)
  }
  if (d.drawings && typeof d.drawings === 'object') {
    const received = d.drawings as Record<string, Parameters<typeof store.addDrawing>[0]>
    store.clearDrawings()
    for (const dr of Object.values(received)) store.addDrawing(dr)
  }
  if (d.fog && typeof d.fog === 'object') {
    const fog = d.fog as { clearedCells?: Record<string, true>; revealAll?: boolean }
    if (fog.clearedCells) store.fogRevealCells(Object.keys(fog.clearedCells))
    if (fog.revealAll)    store.fogRevealAll()
  }
}
