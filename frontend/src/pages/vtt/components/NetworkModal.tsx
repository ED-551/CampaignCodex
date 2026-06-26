/**
 * NetworkModal.tsx — Create / join a room modal.
 *
 * Opens when the user clicks the network button in the toolbar.
 * While offline: shows "Create Room" and "Join Room" forms.
 * While online:  shows current room code, connected status, and a disconnect button.
 *
 * On first load, tries to auto-reconnect if localStorage has a room code +
 * GM token from a previous session.
 */

import { useEffect, useState } from 'react'
import { useVTTStore }          from '../store'
import { vttSocket }            from '../socket/client'

interface Props {
  open:    boolean
  onClose: () => void
}

type Tab = 'create' | 'join'

export function NetworkModal({ open, onClose }: Props) {
  const network     = useVTTStore(s => s.network)
  const [tab,       setTab]       = useState<Tab>('create')
  const [serverUrl, setServerUrl] = useState('http://localhost:3001')
  const [password,  setPassword]  = useState('')
  const [joinCode,  setJoinCode]  = useState('')
  const [joinPass,  setJoinPass]  = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy')

  // On mount, populate server URL from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('vtt_server_url')
    if (saved) setServerUrl(saved)
  }, [])

  if (!open) return null

  async function handleCreate() {
    setError(null)
    setLoading(true)
    try {
      const storedGmToken = localStorage.getItem('vtt_gm_token') ?? undefined
      await vttSocket.createRoom(serverUrl, { password: password || undefined, gmToken: storedGmToken })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) { setError('Enter a room code'); return }
    setError(null)
    setLoading(true)
    try {
      const storedGmToken = localStorage.getItem('vtt_gm_token') ?? undefined
      await vttSocket.joinRoom(serverUrl, joinCode.trim(), {
        password: joinPass || undefined,
        gmToken:  storedGmToken,
      })
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleDisconnect() {
    vttSocket.disconnect()
    onClose()
  }

  async function copyCode() {
    if (!network.roomCode) return
    await navigator.clipboard.writeText(network.roomCode)
    setCopyLabel('Copied!')
    setTimeout(() => setCopyLabel('Copy'), 2000)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">🌐 Online Play</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Connected state ── */}
        {network.connected && network.roomCode ? (
          <div className="network-connected-view">
            <div className="net-status connected">● Connected</div>

            <div className="net-room-row">
              <div className="net-room-code">{network.roomCode}</div>
              <button className="net-copy-btn" onClick={copyCode}>{copyLabel}</button>
            </div>

            <div className="net-role-badge">
              {network.isGM ? '👑 Game Master' : '🎲 Player'}
            </div>

            <p className="net-hint">
              Share the room code with your players. They click Join Room and enter it.
            </p>

            <button className="net-disconnect-btn" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          /* ── Offline / connect state ── */
          <>
            {/* Server URL */}
            <div className="net-field">
              <label className="net-label">Server URL</label>
              <input
                type="text"
                className="net-input"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                placeholder="http://localhost:3001"
              />
            </div>

            {/* Tab selector */}
            <div className="net-tabs">
              <button
                className={`net-tab ${tab === 'create' ? 'active' : ''}`}
                onClick={() => { setTab('create'); setError(null) }}
              >
                Create Room
              </button>
              <button
                className={`net-tab ${tab === 'join' ? 'active' : ''}`}
                onClick={() => { setTab('join'); setError(null) }}
              >
                Join Room
              </button>
            </div>

            {tab === 'create' && (
              <div className="net-form">
                <div className="net-field">
                  <label className="net-label">Password <span className="net-optional">(optional)</span></label>
                  <input
                    type="password"
                    className="net-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Leave blank for open room"
                  />
                </div>
                <button
                  className="net-primary-btn"
                  onClick={handleCreate}
                  disabled={loading}
                >
                  {loading ? 'Creating…' : 'Create Room'}
                </button>
              </div>
            )}

            {tab === 'join' && (
              <div className="net-form">
                <div className="net-field">
                  <label className="net-label">Room Code</label>
                  <input
                    type="text"
                    className="net-input net-code-input"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABCDEF"
                    maxLength={6}
                  />
                </div>
                <div className="net-field">
                  <label className="net-label">Password <span className="net-optional">(if required)</span></label>
                  <input
                    type="password"
                    className="net-input"
                    value={joinPass}
                    onChange={e => setJoinPass(e.target.value)}
                    placeholder=""
                  />
                </div>
                <button
                  className="net-primary-btn"
                  onClick={handleJoin}
                  disabled={loading}
                >
                  {loading ? 'Joining…' : 'Join Room'}
                </button>
              </div>
            )}

            {error && <div className="net-error">{error}</div>}
          </>
        )}
      </div>
    </div>
  )
}
