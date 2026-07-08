/**
 * tokenManager.ts — PixiJS rendering of all tokens.
 *
 * Maintains a Map<tokenId, TokenSprite> and syncs it with the store.
 * Each TokenSprite handles its own rendering: image or shape fallback,
 * HP bar, name label, condition ring segments, and selection highlight.
 *
 * The manager subscribes to the token slice of the store and diffs:
 *  • New tokens → create sprite
 *  • Updated tokens → update sprite in place
 *  • Deleted tokens → destroy sprite
 *  • Selection changes → update highlight on affected sprites
 */

import {
  Container, Graphics, Sprite, Text, Assets,
} from 'pixi.js'
import { CONDITION_COLORS } from '../types'
import type { Token, Condition } from '../types'
import { useVTTStore }                         from '../store'

// ─── TokenSprite ──────────────────────────────────────────────────────────────

class TokenSprite {
  readonly root:     Container   // positioned in world-space
  private body:      Graphics | Sprite
  private hpBar:     Graphics
  private hpBarBg:   Graphics
  private labelText: Text
  private ring:      Graphics   // condition ring + selection highlight
  private condRing:  Graphics

  private token: Token
  private cellSize: number

  constructor(token: Token, cellSize: number) {
    this.token    = token
    this.cellSize = cellSize
    this.root     = new Container()

    // Order within root: condRing (bottom) → body → hpBarBg → hpBar → ring (selection) → label
    this.condRing  = new Graphics()
    this.body      = new Graphics()
    this.hpBarBg   = new Graphics()
    this.hpBar     = new Graphics()
    this.ring      = new Graphics()
    this.labelText = new Text({ text: '', style: { fontSize: 11, fill: 0xffffff, dropShadow: { distance: 1, blur: 2, alpha: 0.8 } } })
    this.labelText.anchor.set(0.5, 0)

    this.root.addChild(this.condRing, this.body, this.hpBarBg, this.hpBar, this.ring, this.labelText)

    this.draw(token, cellSize, false)
  }

  /** Full redraw — called when token data changes. */
  draw(token: Token, cellSize: number, selected: boolean): void {
    this.token    = token
    this.cellSize = cellSize

    const size = token.widthCells * cellSize   // pixel size of the token
    const r    = size / 2                       // radius

    this.root.position.set(token.x, token.y)
    this.root.alpha = token.visible ? 1 : 0.4

    // ── Body (image or shape) ──────────────────────────────────────────────────
    if (this.body instanceof Graphics) {
      this.body.clear()
    }

    if (token.image) {
      // Replace Graphics body with Sprite (async — handled in updateImage)
    } else {
      const g     = this.body as Graphics
      const color = parseInt(token.color.replace('#', ''), 16)
      if (token.shape === 'circle') {
        g.circle(0, 0, r - 2).fill({ color, alpha: 1 })
        g.circle(0, 0, r - 2).stroke({ color: 0x000000, alpha: 0.4, width: 1.5 })
      } else {
        g.rect(-r + 2, -r + 2, size - 4, size - 4).fill({ color, alpha: 1 })
        g.rect(-r + 2, -r + 2, size - 4, size - 4).stroke({ color: 0x000000, alpha: 0.4, width: 1.5 })
      }
    }

    // ── Selection highlight ring ───────────────────────────────────────────────
    this.ring.clear()
    if (selected) {
      if (token.shape === 'circle') {
        this.ring.circle(0, 0, r).stroke({ color: 0x60a5fa, width: 2.5, alpha: 1 })
      } else {
        this.ring.rect(-r, -r, size, size).stroke({ color: 0x60a5fa, width: 2.5, alpha: 1 })
      }
    }

    // ── Condition ring (colored arc segments around the token) ─────────────────
    this.condRing.clear()
    if (token.conditions.length > 0) {
      const conditions = token.conditions.slice(0, 8)  // max 8 shown
      const sliceAngle = (Math.PI * 2) / conditions.length
      const outerR     = r + 5
      const innerR     = r + 2

      conditions.forEach((cond: Condition, i: number) => {
        const startAngle = i * sliceAngle - Math.PI / 2
        const endAngle   = startAngle + sliceAngle - 0.08
        const color      = parseInt(
          CONDITION_COLORS[cond].replace('#', ''), 16
        )
        this.condRing.arc(0, 0, outerR, startAngle, endAngle)
        this.condRing.arc(0, 0, innerR, endAngle, startAngle, true)
        this.condRing.closePath()
        this.condRing.fill({ color, alpha: 0.9 })
      })
    }

    // ── HP bar ─────────────────────────────────────────────────────────────────
    this.hpBarBg.clear()
    this.hpBar.clear()

    if (token.hp !== null && token.maxHp !== null && token.maxHp > 0) {
      const barW  = size - 4
      const barH  = 5
      const barX  = -barW / 2
      const barY  = -r - 8

      // Background (dark)
      this.hpBarBg.rect(barX, barY, barW, barH).fill({ color: 0x111111, alpha: 0.7 })

      // Foreground (health-colored)
      const ratio     = Math.max(0, Math.min(1, token.hp / token.maxHp))
      const fillColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444
      if (ratio > 0) {
        this.hpBar.rect(barX, barY, barW * ratio, barH).fill({ color: fillColor, alpha: 1 })
      }
    }

    // ── Label ──────────────────────────────────────────────────────────────────
    this.labelText.text     = token.label
    this.labelText.position.set(0, r + 3)
  }

  /** Update selected state without full redraw. */
  setSelected(selected: boolean): void {
    const token = this.token
    const size  = token.widthCells * this.cellSize
    const r     = size / 2

    this.ring.clear()
    if (selected) {
      if (token.shape === 'circle') {
        this.ring.circle(0, 0, r).stroke({ color: 0x60a5fa, width: 2.5, alpha: 1 })
      } else {
        this.ring.rect(-r, -r, size, size).stroke({ color: 0x60a5fa, width: 2.5, alpha: 1 })
      }
    }
  }

  /** Async: replace the body Graphics with a Sprite from a URL. */
  async loadImage(url: string): Promise<void> {
    try {
      const texture = await Assets.load(url)
      const sprite  = new Sprite(texture)
      const size    = this.token.widthCells * this.cellSize
      sprite.anchor.set(0.5)
      sprite.width  = size - 4
      sprite.height = size - 4

      // Replace the old body
      const idx = this.root.children.indexOf(this.body)
      if (this.body instanceof Graphics) this.body.destroy()
      this.root.addChildAt(sprite, idx)
      this.body = sprite
    } catch {
      /* keep the shape fallback on error */
    }
  }

  destroy(): void {
    this.root.destroy({ children: true })
  }
}

// ─── TokenManager ─────────────────────────────────────────────────────────────

export class TokenManager {
  private container: Container
  private sprites:   Map<string, TokenSprite> = new Map()
  private unsub:     (() => void)[] = []
  private gmView   = true   // GM sees hidden tokens ghosted; players don't see them at all

  constructor(container: Container) {
    this.container = container
    this.bindStore()
  }

  private bindStore(): void {
    // Sync tokens
    const unsubTokens = useVTTStore.subscribe(
      s => ({ tokens: s.tokens, selected: s.selectedTokenIds, cellSize: s.grid.cellSize }),
      ({ tokens, selected, cellSize }) => this.sync(tokens, selected, cellSize),
    )

    // GM/player view — re-sync so hidden-token visibility updates
    const unsubGmView = useVTTStore.subscribe(
      s => s.network.isGM && !s.playerPreviewMode,
      (gmView) => {
        this.gmView = gmView
        const s = useVTTStore.getState()
        this.sync(s.tokens, s.selectedTokenIds, s.grid.cellSize)
      },
      { fireImmediately: true },
    )

    this.unsub.push(unsubTokens, unsubGmView)
  }

  private sync(
    tokens:   Record<string, import('../types').Token>,
    selected: Set<string>,
    cellSize: number,
  ): void {
    const nextIds = new Set(Object.keys(tokens))

    // Remove deleted
    for (const [id, sprite] of this.sprites) {
      if (!nextIds.has(id)) {
        sprite.destroy()
        this.container.removeChild(sprite.root)
        this.sprites.delete(id)
      }
    }

    // Add or update
    for (const token of Object.values(tokens)) {
      const isSelected = selected.has(token.id)
      const existing   = this.sprites.get(token.id)

      let sprite = existing
      if (!sprite) {
        sprite = new TokenSprite(token, cellSize)
        this.sprites.set(token.id, sprite)
        this.container.addChild(sprite.root)

        // Load image if present
        if (token.image) {
          sprite.loadImage(token.image)
        }
      } else {
        sprite.draw(token, cellSize, isSelected)
      }

      // GM sees hidden tokens ghosted (alpha 0.4 from draw); players and
      // GM-in-player-preview must not see them at all.
      sprite.root.visible = token.visible || this.gmView
    }
  }

  destroy(): void {
    for (const unsub of this.unsub) unsub()
    for (const sprite of this.sprites.values()) sprite.destroy()
    this.sprites.clear()
  }
}
