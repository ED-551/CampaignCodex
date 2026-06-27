/**
 * store/index.ts — Root Zustand store.
 *
 * All slices are combined here. Import `useVTTStore` anywhere in the app.
 * The `subscribeWithSelector` middleware enables fine-grained subscriptions
 * (used by canvas managers to react to store changes without re-rendering
 * every React component that uses the store).
 */

import { create }                from 'zustand'
import { immer }                 from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'

import { createViewportSlice } from './viewportSlice'
import type { ViewportSlice }  from './viewportSlice'
import { createGridSlice }     from './gridSlice'
import type { GridSlice }      from './gridSlice'
import { createToolSlice }     from './toolSlice'
import type { ToolSlice }      from './toolSlice'
import { createSceneSlice }    from './sceneSlice'
import type { SceneSlice }     from './sceneSlice'
import { createTokenSlice }    from './tokenSlice'
import type { TokenSlice }     from './tokenSlice'
import { createHistorySlice }  from './historySlice'
import type { HistorySlice }   from './historySlice'
import { createWallSlice }     from './wallSlice'
import type { WallSlice }      from './wallSlice'
import { createLightSlice }    from './lightSlice'
import type { LightSlice }     from './lightSlice'
import { createFogSlice }      from './fogSlice'
import type { FogSlice }       from './fogSlice'
import { createDrawingSlice }  from './drawingSlice'
import type { DrawingSlice }   from './drawingSlice'
import { createNetworkSlice }  from './networkSlice'
import type { NetworkSlice }   from './networkSlice'
import { createAssetSlice }    from './assetSlice'
import type { AssetSlice }     from './assetSlice'
import { createCombatSlice }   from './combatSlice'
import type { CombatSlice }    from './combatSlice'
import { createSessionSlice }  from './sessionSlice'
import type { SessionSlice }   from './sessionSlice'

export type VTTStore =
  ViewportSlice &
  GridSlice     &
  ToolSlice     &
  SceneSlice    &
  TokenSlice    &
  HistorySlice  &
  WallSlice     &
  LightSlice    &
  FogSlice      &
  DrawingSlice  &
  NetworkSlice  &
  AssetSlice    &
  CombatSlice   &
  SessionSlice

export const useVTTStore = create<VTTStore>()(
  subscribeWithSelector(
    immer((...args) => ({
      ...createViewportSlice(...args),
      ...createGridSlice(...args),
      ...createToolSlice(...args),
      ...createSceneSlice(...args),
      ...createTokenSlice(...args),
      ...createHistorySlice(...args),
      ...createWallSlice(...args),
      ...createLightSlice(...args),
      ...createFogSlice(...args),
      ...createDrawingSlice(...args),
      ...createNetworkSlice(...args),
      ...createAssetSlice(...args),
      ...createCombatSlice(...args),
      ...createSessionSlice(...args),
    }))
  )
)
