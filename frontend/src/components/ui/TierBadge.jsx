/**
 * TierBadge — small metallic coin/token SVG badge for supporter tiers.
 * Renders inline next to usernames. Returns null for 'free' (no badge shown).
 *
 * SVG gradient IDs are scoped per-instance using a counter to avoid ID collisions
 * when multiple same-tier badges render on the same page (e.g. chat message lists).
 */
let _tbgCounter = 0

const TIER_CONFIG = {
  bronze: {
    label:       'Bronze Supporter',
    outerFill:   '#8B4513',
    gradFrom:    '#CD7F32',
    gradTo:      '#A0522D',
    rimStroke:   '#A0522D',
    textColor:   '#5C2A00',
    letter:      'B',
  },
  silver: {
    label:       'Silver Supporter',
    outerFill:   '#808080',
    gradFrom:    '#E8E8E8',
    gradTo:      '#A9A9A9',
    rimStroke:   '#A9A9A9',
    textColor:   '#555',
    letter:      'S',
  },
  gold: {
    label:       'Gold Supporter',
    outerFill:   '#B8860B',
    gradFrom:    '#FFD700',
    gradTo:      '#DAA520',
    rimStroke:   '#B8860B',
    textColor:   '#7A5800',
    letter:      'G',
  },
  platinum: {
    label:       'Platinum Supporter',
    outerFill:   '#666',
    gradFrom:    '#F0F0F0',
    gradTo:      '#C0C0C8',
    rimStroke:   '#999',
    textColor:   '#444',
    letter:      'P',
  },
  black: {
    label:       'Administrator',
    outerFill:   '#0a0a0a',
    gradFrom:    '#2e2e2e',
    gradTo:      '#060606',
    rimStroke:   '#4a4a4a',
    textColor:   '#c8c8c8',
    letter:      'A',
  },
}

export default function TierBadge({ tier, size = 16 }) {
  if (!tier || tier === 'free') return null

  const cfg = TIER_CONFIG[tier]
  if (!cfg) return null

  // Unique gradient ID per instance — SVG IDs are document-global, so sharing
  // one ID per tier causes incorrect gradient lookup when multiple same-tier
  // badges exist on the same page.
  const gradId = `tbg-${tier}-${++_tbgCounter}`
  const cx = size / 2
  const outerR = (size / 2) - 0.5
  const innerR = outerR - 1.5
  const rimR   = innerR - 1

  return (
    <span
      title={cfg.label}
      style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', lineHeight: 1 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={cfg.label}
        role="img"
      >
        <defs>
          <radialGradient id={gradId} cx="40%" cy="35%" r="65%" fx="40%" fy="35%">
            <stop offset="0%"   stopColor={cfg.gradFrom} />
            <stop offset="100%" stopColor={cfg.gradTo}   />
          </radialGradient>
        </defs>

        {/* Outer ring / border */}
        <circle cx={cx} cy={cx} r={outerR} fill={cfg.outerFill} />

        {/* Inner coin face */}
        <circle cx={cx} cy={cx} r={innerR} fill={`url(#${gradId})`} />

        {/* Subtle rim texture */}
        <circle
          cx={cx} cy={cx} r={rimR}
          fill="none"
          stroke={cfg.rimStroke}
          strokeWidth="0.5"
          strokeOpacity="0.5"
        />

        {/* Specular highlight — top-left gloss to simulate light on coin face */}
        {tier === 'black' && (
          <ellipse
            cx={cx * 0.68}
            cy={cx * 0.58}
            rx={innerR * 0.55}
            ry={innerR * 0.28}
            fill="white"
            fillOpacity="0.10"
          />
        )}

        {/* Center glyph */}
        {tier === 'black' ? (
          /* Silver "A" — administrator mark on dark coin */
          <text
            x={cx}
            y={cx + size * 0.17}
            textAnchor="middle"
            fill={cfg.textColor}
            fontSize={size * 0.42}
            fontWeight="bold"
            fontFamily="system-ui, sans-serif"
            style={{ userSelect: 'none' }}
          >
            A
          </text>
        ) : (
          <text
            x={cx}
            y={cx + size * 0.17}
            textAnchor="middle"
            fill={cfg.textColor}
            fontSize={size * 0.38}
            fontWeight="bold"
            fontFamily="system-ui, sans-serif"
            fillOpacity="0.75"
            style={{ userSelect: 'none' }}
          >
            {cfg.letter}
          </text>
        )}
      </svg>
    </span>
  )
}
