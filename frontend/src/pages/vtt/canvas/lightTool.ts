/**
 * lightTool.ts — Click-to-place light source tool.
 *
 * Registers with InteractionManager for the 'light' tool.
 * Reads the selected preset from LightPanel's module-level export
 * (same pattern as WallTool reads selectedWallType from WallPanel).
 *
 * On click: places a LightSource at the world position.
 * Wraps in a history command for undo/redo.
 * If a token is currently selected, offers to attach the light to that token.
 */

import { InteractionManager }       from './interactionManager'
import { useVTTStore }               from '../store'
import { nanoid }                    from '../utils/nanoid'
import { selectedLightPreset }       from '../components/LightPanel'
import type { Point, LightSource }   from '../types'

export class LightTool {
  private interaction: InteractionManager

  constructor(interaction: InteractionManager) {
    this.interaction = interaction

    interaction.registerToolHandler('light', {
      onPointerDown: this.onPointerDown.bind(this),
    })
  }

  private onPointerDown(world: Point): void {
    const store   = useVTTStore.getState()
    const preset  = selectedLightPreset

    // If exactly one token is selected, ask whether to attach
    // For now: auto-attach when a single token is selected
    let attachedTokenId: string | null = null
    if (store.selectedTokenIds.size === 1) {
      attachedTokenId = [...store.selectedTokenIds][0]
    }

    const light: LightSource = {
      id:              nanoid(),
      x:               attachedTokenId
        ? (store.tokens[attachedTokenId]?.x ?? world.x)
        : world.x,
      y:               attachedTokenId
        ? (store.tokens[attachedTokenId]?.y ?? world.y)
        : world.y,
      brightRadiusFt:  preset.brightRadiusFt,
      dimRadiusFt:     preset.dimRadiusFt,
      color:           preset.color,
      intensity:       preset.intensity,
      attachedTokenId,
      castsShadows:    preset.castsShadows,
    }

    store.execute({
      label:   `Place ${preset.label}`,
      execute: () => useVTTStore.getState().addLight(light),
      undo:    () => useVTTStore.getState().deleteLight(light.id),
    })
  }

  destroy(): void {
    this.interaction.unregisterToolHandler('light')
  }
}
