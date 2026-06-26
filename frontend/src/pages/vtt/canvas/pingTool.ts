/**
 * pingTool.ts — Click-to-ping tool.
 *
 * Registers with InteractionManager for the 'ping' tool.
 * On click: fires a local ping via PingManager and, if connected, emits
 * a 'ping_marker' socket event so all players see it too.
 */

import { InteractionManager }  from './interactionManager'
import { PingManager }         from './pingManager'
import { vttSocket }           from '../socket/client'
import { useVTTStore }         from '../store'
import type { Point }          from '../types'

export class PingTool {
  private interaction: InteractionManager
  private pingManager: PingManager

  constructor(interaction: InteractionManager, pingManager: PingManager) {
    this.interaction = interaction
    this.pingManager = pingManager

    interaction.registerToolHandler('ping', {
      onPointerDown: this.onPointerDown.bind(this),
    })
  }

  private onPointerDown(world: Point): void {
    this.pingManager.addPing(world.x, world.y)

    if (useVTTStore.getState().network.connected) {
      vttSocket.emit('ping_marker', { x: world.x, y: world.y })
    }
  }

  destroy(): void {
    this.interaction.unregisterToolHandler('ping')
  }
}
