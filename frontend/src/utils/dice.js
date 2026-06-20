/**
 * dice.js — shared dice-roll utilities for CampaignCodex chat
 *
 * Handles: /XdY commands (1d2–100d100)
 * Special case: /1d2 → coin flip
 */

const DICE_CMD = /^\/(\d{1,3})d(\d{1,3})$/i

/**
 * Parse a raw chat input string for a dice command.
 * Returns { count, sides } on match, null otherwise.
 * Valid range: 1–100 dice, 2–100 sides.
 */
export function parseDiceCommand(raw) {
  const m = raw.trim().match(DICE_CMD)
  if (!m) return null
  const count = parseInt(m[1], 10)
  const sides = parseInt(m[2], 10)
  if (count < 1 || count > 100 || sides < 2 || sides > 100) return null
  return { count, sides }
}

/** Roll `count` fair dice with `sides` faces. Returns array of results. */
export function rollDice(count, sides) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
}

/**
 * Determine the display variant:
 *   'flip'      → 1d2 (coin)
 *   'single'    → 1dX (one die)
 *   'standard'  → 2–4 dice (show all)
 *   'condensed' → 5+ dice (show 4 + rest summed)
 */
export function getDiceVariant(count, sides) {
  if (count === 1 && sides === 2) return 'flip'
  if (count === 1)  return 'single'
  if (count <= 4)   return 'standard'
  return 'condensed'
}

/**
 * Build the metadata object to store with the message.
 */
export function buildDiceMetadata(count, sides, rolls) {
  const notation = `${count}d${sides}`
  const total    = rolls.reduce((a, b) => a + b, 0)
  const variant  = getDiceVariant(count, sides)
  return { type: 'dice', notation, count, sides, rolls, total, variant }
}

/**
 * Format the plain-text body that gets stored alongside the metadata.
 * This is the human-readable fallback shown if metadata rendering ever fails.
 */
export function formatDiceBody(username, meta) {
  const { count, sides, rolls, total, variant } = meta

  if (variant === 'flip') {
    const face = rolls[0] === 1 ? 'Heads' : 'Tails'
    return `${username} flipped a coin — ${face}`
  }

  if (variant === 'single') {
    return `${username} rolled 1d${sides} = ${total}`
  }

  if (variant === 'standard') {
    return `${username} rolled ${count}d${sides}: ${rolls.join(' + ')} = ${total}`
  }

  // condensed
  const shown   = rolls.slice(0, 4)
  const restSum = rolls.slice(4).reduce((a, b) => a + b, 0)
  return `${username} rolled ${count}d${sides}: ${shown.join(' + ')} (+ ${restSum}) = ${total}`
}
