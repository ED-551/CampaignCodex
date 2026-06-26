import type { StateCreator } from 'zustand'
import type { VTTStore }     from './index'
import type { Tool }         from '../types'

export interface ToolSlice {
  activeTool: Tool
  setTool:    (tool: Tool) => void
}

export const createToolSlice: StateCreator<
  VTTStore,
  [['zustand/immer', never]],
  [],
  ToolSlice
> = (set) => ({
  activeTool: 'select',
  setTool: (tool) => set(state => { state.activeTool = tool }),
})
