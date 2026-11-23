/**
 * 场景坐标规划（单位：米）
 *
 * 产线沿 X 轴，传送带中心线在 Z = 0，带面高度 Y = 0.92。
 * 7 个工站以 3m 等距排列于 X = -9 … +9，站体 2.5 × 2.32 × 2.7。
 * 原料仓库在产线左后方 (-12.2, -5.0)，成品货架在产线右后方 (11.6, -4.3)，都朝向 +Z。
 * 相机默认从 +X+Z 方向俯看整条线。
 */
export const GROUND = { w: 110, d: 90 } as const

export const LINE = {
  x0: -11.5,
  x1: 11.5,
  beltY: 0.92,
  beltW: 0.92,
  beltThickness: 0.06,
  pitch: 3,
} as const

export const STATION_SIZE = {
  w: 2.5,
  h: 2.32,
  d: 2.7,
  post: 0.09,
} as const

export const BIN = {
  y: 2.66,
  size: 0.54,
  cap: 12,
  bufferCap: 3,
} as const

export const stationX = (index: number) => (index - 3) * LINE.pitch

export const WAREHOUSE = { x: -12.2, z: -5.0 }
export const SHELF = { x: 11.9, z: -1.9 }

export type Vec3 = [number, number, number]

export interface CameraPreset {
  pos: Vec3
  target: Vec3
}

export const CAMERA_PRESETS: Record<'overview' | 'top' | 'side' | 'output', CameraPreset> = {
  overview: { pos: [7.6, 15.9, 21.5], target: [-0.2, 1.4, 0] },
  top: { pos: [0.01, 26, 0.8], target: [0, 0, 0] },
  side: { pos: [0, 5.2, 22], target: [0, 1.5, 0] },
  output: { pos: [15.4, 3.4, 7.6], target: [11.8, 1.15, 0] },
}

/** 成品货架的 3 层 × 4 格（局部坐标，货架朝 +Z） */
export const SHELF_SLOTS = {
  rows: [0.42, 1.02, 1.62],
  cols: [-1.35, -0.45, 0.45, 1.35],
  lx: -0.1,
}

/** 第 slot 个机位的世界坐标（slot: 0..11，从下往上、从左往右） */
export function shelfSlotWorld(slot: number): [number, number, number] {
  const row = Math.floor(slot / 4) % 3
  const col = slot % 4
  return [SHELF.x + SHELF_SLOTS.cols[col], SHELF_SLOTS.rows[row] + 0.1, SHELF.z - SHELF_SLOTS.lx]
}

/** 第 slot 个机位的局部坐标（给货架内部用） */
export function shelfSlotLocal(slot: number): [number, number, number] {
  const row = Math.floor(slot / 4) % 3
  const col = slot % 4
  return [SHELF_SLOTS.lx, SHELF_SLOTS.rows[row] + 0.1, SHELF_SLOTS.cols[col]]
}

export const stationPreset = (x: number): CameraPreset => ({
  pos: [x + 2.9, 2.5, 5.6],
  target: [x, 1.35, -0.15],
})