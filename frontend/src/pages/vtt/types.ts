/**
 * types.ts — Canonical type definitions for the entire VTT.
 *
 * All scene objects, store slices, and canvas managers use these types.
 * This file grows as chunks are added — nothing is removed, only extended.
 */

// ─── Geometry ─────────────────────────────────────────────────────────────────

export interface Point   { x: number; y: number }
export interface Segment { a: Point; b: Point }
export interface Rect    { x: number; y: number; w: number; h: number }

// ─── Viewport ─────────────────────────────────────────────────────────────────

export interface Viewport {
  x:     number
  y:     number
  scale: number
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

export type GridType = 'square' | 'hex-flat' | 'hex-pointy' | 'gridless'

/** How distances are counted on the grid. See canvas/measure.ts. */
export type MeasurementType = 'chessboard' | 'alternating' | 'euclidean' | 'manhattan'

export interface GridConfig {
  type:       GridType
  cellSize:   number   // pixels per cell at scale 1.0
  cellFeet:   number   // real-world feet per cell
  color:      string   // hex color string
  opacity:    number   // 0–1
  visible:    boolean
  snapToGrid: boolean
  /** Distance-counting rule for the measure tool and movement readouts. */
  measurement: MeasurementType
}

// ─── Background ───────────────────────────────────────────────────────────────

export interface Background {
  /** data URL (standalone) or upload path (integrated) */
  imageUrl:  string
  offsetX:   number
  offsetY:   number
  scaleX:    number
  scaleY:    number
  /** When true, the GM cannot accidentally drag the background */
  locked:    boolean
}

// ─── Conditions ───────────────────────────────────────────────────────────────

export type Condition =
  | 'blinded'
  | 'charmed'
  | 'deafened'
  | 'exhausted'
  | 'frightened'
  | 'grappled'
  | 'incapacitated'
  | 'invisible'
  | 'paralyzed'
  | 'petrified'
  | 'poisoned'
  | 'prone'
  | 'restrained'
  | 'stunned'
  | 'unconscious'
  | 'dying'
  | 'dead'
  | 'concentrating'

/** Visual color per condition category — used for ring segments and tracker icons */
export const CONDITION_COLORS: Record<Condition, string> = {
  blinded:        '#6b7280',
  charmed:        '#ec4899',
  deafened:       '#6b7280',
  exhausted:      '#9ca3af',
  frightened:     '#8b5cf6',
  grappled:       '#f59e0b',
  incapacitated:  '#ef4444',
  invisible:      '#a3e635',
  paralyzed:      '#ef4444',
  petrified:      '#78716c',
  poisoned:       '#22c55e',
  prone:          '#f97316',
  restrained:     '#f59e0b',
  stunned:        '#ef4444',
  unconscious:    '#374151',
  dying:          '#ef4444',
  dead:           '#111827',
  concentrating:  '#60a5fa',
}

export const ALL_CONDITIONS = Object.keys(CONDITION_COLORS) as Condition[]

// ─── Token ────────────────────────────────────────────────────────────────────

export type TokenLayer = 'terrain' | 'tokens' | 'gm'
export type TokenShape = 'circle' | 'square'

export interface Token {
  id:         string
  layer:      TokenLayer
  /** World-space position (center of token). */
  x:          number
  y:          number
  /** Token size in grid cells. Medium = 1, Large = 2, Huge = 3, Gargantuan = 4. */
  widthCells:  number
  heightCells: number
  /** Data URL or upload path. null = use shape + color. */
  image:      string | null
  shape:      TokenShape
  /** Fill color when no image, e.g. '#e74c3c' */
  color:      string
  label:      string
  hp:         number | null
  maxHp:      number | null
  ac:         number | null
  /** Sight radius in feet. 0 = no sight (blind). */
  sightRadius:     number
  /** Whether this token emits light. */
  emitsLight:      boolean
  lightBrightFt:   number
  lightDimFt:      number
  lightColor:      string
  conditions:      Condition[]
  /** false = GM-only; players cannot see this token */
  visible:         boolean
  /** Prevents players from moving this token */
  locked:          boolean
  /** userIds that control this token. Empty = GM-only control. */
  playerOwnerIds:  string[]
}

// ─── Wall ─────────────────────────────────────────────────────────────────────

export type WallType = 'wall' | 'window' | 'door' | 'invisible'

export interface Wall {
  id:     string
  /** Ordered list of points forming a polyline in world-space pixels. */
  points: Point[]
  type:   WallType
  /** Only meaningful when type === 'door'. */
  isOpen: boolean
}

// ─── Light source ─────────────────────────────────────────────────────────────

export interface LightSource {
  id:               string
  x:                number
  y:                number
  brightRadiusFt:   number
  dimRadiusFt:      number
  /** Hex color, e.g. '#ffa040' for torchlight */
  color:            string
  intensity:        number   // 0–1
  /** When set, this light moves with the named token */
  attachedTokenId:  string | null
  /** false = this light contributes illumination but does NOT cast shadows */
  castsShadows:     boolean
}

// ─── Fog of war ───────────────────────────────────────────────────────────────

export type FogMode = 'manual' | 'explorer'

/** Shape tools available while painting fog by hand. */
export type FogShapeType = 'rect' | 'polygon' | 'freehand'

/**
 * One piece of hand-placed fog geometry.
 *
 * Shapes either add fog or cut it away. Cuts always win regardless of the
 * order they were drawn, so a GM can lay a blanket of fog and then carve out
 * rooms as the party discovers them — and re-fog by deleting the cut.
 */
export interface FogShape {
  id:     string
  type:   FogShapeType
  /** Closed polygon in world space, flat [x0,y0,x1,y1,…]. */
  points: number[]
  /** true = removes fog; false = adds fog. */
  cut:    boolean
}

export interface FogState {
  mode:    FogMode
  /** Opacity of the fog overlay, 0–1. Typically 0.9. */
  opacity: number
  /** Fog color, typically '#000000'. */
  color:   string
  enabled: boolean
  /**
   * When true, overrides all cell state — fog overlay is fully transparent.
   * (GM "Reveal All" convenience toggle.)
   */
  revealAll: boolean
  /**
   * The set of grid cells where fog has been lifted.
   * Keys are "col,row" strings (integer grid coords in world space).
   *
   * Explorer mode: accumulated automatically as tokens move; cells are only
   * ever added, never removed (unless GM resets exploration).
   */
  clearedCells: Record<string, true>
  /** Hand-placed fog geometry. Manual mode only. */
  shapes: FogShape[]
  /**
   * Blanket of fog over the whole canvas, which cut shapes carve into.
   * Stored as a flag rather than a giant rectangle so it stays correct at any
   * pan or zoom — a player can never scroll far enough to find its edge.
   */
  fillAll: boolean
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

export type DrawingType = 'freehand' | 'line' | 'rect' | 'circle' | 'polygon' | 'text'
export type DrawingLayer = 'drawings' | 'gm'

export interface Drawing {
  id:      string
  layer:   DrawingLayer
  type:    DrawingType
  points:  number[]   // flat [x0,y0,x1,y1,...] array
  color:   string
  width:   number     // stroke width
  opacity: number
  fill:    boolean
  text:    string     // only used when type === 'text'
  fontSize: number
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export interface Scene {
  id:         string
  name:       string
  grid:       GridConfig
  background: Background | null
  tokens:     Token[]
  walls:      Wall[]
  lights:     LightSource[]
  fog:        FogState
  drawings:   Drawing[]
  /** Ambient light level 0–1. 0 = pitch black, 1 = fully lit (lighting disabled). */
  ambientLight: number
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export type Tool =
  | 'select'
  | 'token'
  | 'wall'
  | 'draw'
  | 'fog'
  | 'measure'
  | 'light'
  | 'ping'

// ─── Combat / Initiative ──────────────────────────────────────────────────────

/**
 * One entry in the initiative tracker.
 * id matches a Token.id on the map; all visual info is derived from the token
 * at add-time but can be overridden inside the tracker.
 */
export interface Combatant {
  /** Mirrors Token.id — used to locate and camera-follow the token. */
  id:              string
  name:            string
  /** d20 result + bonus. null = not yet rolled / entered. */
  initiative:      number | null
  /** Flat modifier applied before sort (DEX bonus, etc.). Default 0. */
  initiativeBonus: number
  hp:              number | null
  maxHp:           number | null
  ac:              number | null
  color:           string
  /** true when playerOwnerIds.length > 0 on the source token. */
  isPlayer:        boolean
  conditions:      Condition[]
  isSurprised:     boolean
}

// ─── Undo/redo ────────────────────────────────────────────────────────────────

export interface Command {
  label:   string
  execute: () => void
  undo:    () => void
}
