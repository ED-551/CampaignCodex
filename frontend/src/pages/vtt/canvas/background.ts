/**
 * background.ts — Background map image rendering.
 *
 * The background is a PixiJS Sprite placed on the background layer.
 * It sits beneath the grid and everything else in world-space.
 *
 * Supported interactions (GM only):
 *  • Drag to reposition (when not locked)
 *  • Scale handles (future — Chunk 13 polish)
 *
 * The image is stored as a data URL in the scene so it survives export/import.
 */

import { Container, Sprite, Assets, Texture } from 'pixi.js'
import type { Background }                     from '../types'

export class BackgroundManager {
  private container: Container
  private sprite:    Sprite | null = null
  private isDragging = false
  private dragOffsetX = 0
  private dragOffsetY = 0

  constructor(container: Container) {
    this.container = container
  }

  /** Load and display a background from a Background config object. */
  async setBackground(bg: Background): Promise<void> {
    this.clear()

    let texture: Texture
    try {
      // Assets.load handles both data URLs and regular URLs
      texture = await Assets.load(bg.imageUrl)
    } catch {
      console.error('[BackgroundManager] Failed to load background image')
      return
    }

    const sprite = new Sprite(texture)
    sprite.anchor.set(0)   // top-left origin
    sprite.position.set(bg.offsetX, bg.offsetY)
    sprite.scale.set(bg.scaleX, bg.scaleY)
    sprite.alpha = 1

    // Make the sprite interactive for GM dragging (when not locked)
    if (!bg.locked) {
      sprite.eventMode = 'static'
      sprite.cursor    = 'move'

      sprite.on('pointerdown', (e) => {
        if (bg.locked) return
        this.isDragging  = true
        this.dragOffsetX = e.global.x - sprite.x
        this.dragOffsetY = e.global.y - sprite.y
        e.stopPropagation()
      })

      sprite.on('pointermove', (e) => {
        if (!this.isDragging) return
        sprite.x = e.global.x - this.dragOffsetX
        sprite.y = e.global.y - this.dragOffsetY
      })

      sprite.on('pointerup', () => {
        this.isDragging = false
      })

      sprite.on('pointerupoutside', () => {
        this.isDragging = false
      })
    }

    this.container.addChild(sprite)
    this.sprite = sprite
  }

  /** Update the position of the existing sprite (called after drag). */
  updatePosition(offsetX: number, offsetY: number): void {
    if (!this.sprite) return
    this.sprite.position.set(offsetX, offsetY)
  }

  /** Update the scale of the existing sprite. */
  updateScale(scaleX: number, scaleY: number): void {
    if (!this.sprite) return
    this.sprite.scale.set(scaleX, scaleY)
  }

  /** Remove the background sprite and release the texture. */
  clear(): void {
    if (this.sprite) {
      this.sprite.destroy({ texture: false })  // keep texture in cache
      this.sprite = null
    }
    this.container.removeChildren()
  }

  destroy(): void {
    this.clear()
  }
}

/**
 * Read a File as a data URL.
 * Used when the user drags an image onto the canvas.
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
