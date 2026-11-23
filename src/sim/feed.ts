import { sim } from './sim'
import { STATION_MATERIALS, binCap, hasMaterial } from './engine'
import { MATERIAL_BY_ID, MATERIALS, type MaterialId } from './recipes'

export type FeedReason = 'ok' | 'wrong-station' | 'full' | 'no-stock' | 'no-bin'

export interface FeedResult {
  ok: boolean
  moved: number
  reason: FeedReason
}

/** 该工站的料位定义（最多两个） */
export function binSlots(stationId: number) {
  return STATION_MATERIALS[stationId] ?? []
}

export function binOf(stationId: number, material: MaterialId) {
  return sim.stations[stationId - 1]?.bins[material] ?? 0
}

/** 投料：仓库 → 工站料仓。返回实际搬运件数与失败原因 */
export function feed(stationId: number, material: MaterialId, amount = 1): FeedResult {
  const slot = binSlots(stationId).find((s) => s.id === material)
  if (!slot) return { ok: false, moved: 0, reason: 'wrong-station' }

  const st = sim.stations[stationId - 1]
  if (!st) return { ok: false, moved: 0, reason: 'no-bin' }

  const current = st.bins[material] ?? 0
  const room = binCap(stationId) - current
  if (room <= 0) return { ok: false, moved: 0, reason: 'full' }

  const available = sim.stock[material] ?? 0
  if (available <= 0) return { ok: false, moved: 0, reason: 'no-stock' }

  const moved = Math.max(0, Math.min(amount, room, available))
  st.bins[material] = current + moved
  sim.stock[material] = available - moved
  return { ok: true, moved, reason: 'ok' }
}

/** 某个原料应该投到哪个工站 */
export function targetStationOf(material: MaterialId) {
  return MATERIAL_BY_ID[material].stationId
}

/** 按单台 BOM 一键配齐：每个原料投到对应工站，够做 1 台 */
export function feedBom(): { moved: number; skipped: number } {
  let moved = 0
  let skipped = 0
  for (const m of MATERIALS) {
    const res = feed(m.stationId, m.id, m.unit)
    if (res.ok) moved += res.moved
    else skipped += 1
  }
  return { moved, skipped }
}

/** 工站当前是否具备开工的料 */
export function stationStocked(stationId: number) {
  const st = sim.stations[stationId - 1]
  return st ? hasMaterial(st, stationId) : false
}

/** 料仓总体填充率，用于 HUD 的概览条 */
export function fillRatio(stationId: number) {
  const slots = binSlots(stationId)
  if (!slots.length) return 1
  const total = slots.reduce((n, s) => n + (sim.stations[stationId - 1]?.bins[s.id] ?? 0), 0)
  return Math.min(1, total / (binCap(stationId) * slots.length))
}