/**
 * DiceRollBubble — renders a dice roll message across all chat contexts.
 *
 * Layout: full-width banner, not left/right bubble — dice rolls are announcements.
 * Coin flips get a coin icon; all others get a dice icon.
 * The result text is always italic.
 */

const COIN_ICON = '🪙'
const DICE_ICON = '🎲'

function formatDisplay(meta) {
  const { count, sides, rolls, total, variant } = meta

  if (variant === 'flip') {
    const face = rolls[0] === 1 ? 'Heads' : 'Tails'
    return { label: `flipped a coin`, result: `— ${face}` }
  }

  if (variant === 'single') {
    return { label: `rolled 1d${sides}`, result: `= ${total}` }
  }

  if (variant === 'standard') {
    return {
      label: `rolled ${count}d${sides}`,
      result: `${rolls.join(' + ')} = ${total}`,
    }
  }

  // condensed (5+ dice)
  const shown   = rolls.slice(0, 4)
  const restSum = rolls.slice(4).reduce((a, b) => a + b, 0)
  return {
    label: `rolled ${count}d${sides}`,
    result: `${shown.join(' + ')} (+ ${restSum}) = ${total}`,
  }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Props:
 *   message  — the full message object; must have metadata.type === 'dice'
 *   username — display name (falls back to message.username / message.sender_username)
 */
export default function DiceRollBubble({ message }) {
  const meta     = message.metadata
  const username = message.username ?? message.sender_username ?? 'Someone'
  const isFlip   = meta?.variant === 'flip'
  const icon     = isFlip ? COIN_ICON : DICE_ICON

  if (!meta) return null

  const { label, result } = formatDisplay(meta)

  return (
    <div className="flex items-center gap-2 px-3 py-2 my-0.5 rounded-xl
      bg-amber-500/5 border border-amber-500/15
      text-sm italic text-codex-subtext select-none">
      {/* Icon */}
      <span className="shrink-0 text-base leading-none" aria-hidden="true">{icon}</span>

      {/* Text */}
      <span className="flex-1 min-w-0">
        <span className="font-semibold not-italic text-codex-text">{username}</span>
        {' '}{label}{' '}
        <span className="font-mono text-codex-gold not-italic font-semibold">{result}</span>
      </span>

      {/* Timestamp */}
      <span className="shrink-0 text-[10px] not-italic text-codex-muted">
        {formatTime(message.created_at)}
      </span>
    </div>
  )
}
