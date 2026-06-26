/**
 * RoomBadge.tsx — Fixed corner badge showing connection status + room code.
 *
 * Always visible in the top-right corner. When offline: subtle grey indicator.
 * When online: shows room code + role. Clicking opens the NetworkModal.
 */

interface Props {
  onOpenModal: () => void
}

import { useVTTStore } from '../store'

export function RoomBadge({ onOpenModal }: Props) {
  const network = useVTTStore(s => s.network)

  return (
    <button
      className={`room-badge ${network.connected ? 'connected' : 'offline'}`}
      onClick={onOpenModal}
      title={network.connected ? `Room ${network.roomCode}` : 'Go online'}
    >
      {network.connected ? (
        <>
          <span className="room-badge-dot" />
          <span className="room-badge-code">{network.roomCode}</span>
          <span className="room-badge-role">{network.isGM ? 'GM' : 'Player'}</span>
        </>
      ) : (
        <>
          <span className="room-badge-dot" />
          <span className="room-badge-code">Offline</span>
        </>
      )}
    </button>
  )
}
