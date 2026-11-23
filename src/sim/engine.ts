/**
 * 产线状态机（纯逻辑，可单测）
 *
 * 时间单位：秒；长度单位：米；坐标：产线沿 X 轴，传送带面 Y = 0.92。
 *
 * 物料流动：
 *   S1 是"源"工站：料仓有铝锭 → 按节拍产出机壳，直接放到传送带上
 *   S2…S7 是"加工"工站：先从传送带入口抓件，再从料仓取原料（缺料就抓不到）
 *   每个工站同一时刻只能加工一件；后车跟车保持 GAP，天然形成排队与阻塞
 */
import { shelfSlotWorld } from '@/lib/layout'
import {
  MATERIALS,
  MODELS,
  STATIONS,
  STATION_BY_ID,
  type ItemId,
  type MaterialId,
  type ModelId,
} from './recipes'

export const BELT_END = 11.4
const BELT_Y = 0.92

const ENTRY_OFFSET = 1.15
const RELEASE_OFFSET = 0.9
const GAP = 0.62
export const BELT_SPEED = 1.15
const ENTER_TIME = 0.38

export type ProductMode = 'moving' | 'queued' | 'entering' | 'processing'
export type StationState = 'idle' | 'working' | 'starved' | 'blocked'

export interface Product {
  id: number
  x: number
  /** 已完成的工站数；0 = 尚未经过 S1 */
  stage: number
  item: ItemId
  model: ModelId
  /** 来料就带缺陷：S6 一定判不良 */
  flawed: boolean
  mode: ProductMode
  t: number
}

export interface StationRun {
  id: number
  state: StationState
  occupant: number | null
  /** 0..1 */
  progress: number
  produced: number
  /** 入口前排队件数 */
  waiting: number
  /** 该站所需原料的料仓余量 */
  bins: Partial<Record<MaterialId, number>>
  /** 该站累计剔除的不良品数 */
  defects: number
  /** 最近一次判定结果与时间，用于检测站的绿/红灯 */
  lastOk: boolean
  lastOkAt: number
}

/** 不良品被剔除时的飞行动画（渲染层只读） */
export interface Scrap {
  id: number
  x0: number
  z0: number
  x1: number
  z1: number
  x: number
  y: number
  z: number
  t: number
  dur: number
}

export interface Order {
  id: number
  client: string
  model: ModelId
  qty: number
  delivered: number
  timeLimit: number
  elapsed: number
  reward: number
  state: 'active' | 'queued' | 'done' | 'failed'
}

/** 成品从线尾飞向货架机位的动画 */
export interface Shipment {
  id: number
  slot: number
  t: number
  dur: number
  x: number
  y: number
  z: number
  x0: number
  y0: number
  z0: number
  x1: number
  y1: number
  z1: number
}

export interface SimEvent {
  id: number
  t: number
  kind: 'info' | 'ok' | 'warn'
  text: string
}

export interface SimState {
  time: number
  runTime: number
  products: Product[]
  scraps: Scrap[]
  /** 当前产线在产的机型 */
  model: ModelId
  /** 换线进度；null = 不需要换线 */
  changeover: { model: ModelId; t: number; need: number } | null
  stations: StationRun[]
  stock: Record<MaterialId, number>
  finished: number
  defects: number
  started: number
  orders: Order[]
  orderSeq: number
  shipments: Shipment[]
  /** 货架上已摆好的机位 */
  shelf: number[]
  score: number
  ordersDone: number
  ordersFailed: number
  nextId: number
  eventSeq: number
  events: SimEvent[]
}

export interface StepOpts {
  speed: number
  rng: () => number
  /** 来料缺陷率 0..1 */
  incomingDefect?: number
  /** 调试：强制该工站判定失败（验不良品链路） */
  forceDefectAt?: number
}

export const BIN_CAP = 12

/** 摄像头是小件，S5 的料仓放大到 24，正好够 8 台 Pro / 12 台 Air */
export const BIN_CAP_BY_STATION: Record<number, number> = { 5: 24 }

export const binCap = (stationId: number) => BIN_CAP_BY_STATION[stationId] ?? BIN_CAP

/** 每个工站消耗哪些原料、各消耗几个（中途件来自传送带，不在这里） */
export const STATION_MATERIALS: Record<number, { id: MaterialId; qty: number }[]> = Object.fromEntries(
  STATIONS.map((s) => [
    s.id,
    s.inputs
      .filter((i) => MATERIALS.some((m) => m.id === i.item))
      .map((i) => ({ id: i.item as MaterialId, qty: i.qty })),
  ]),
)

const INITIAL_STOCK: Record<MaterialId, number> = {
  aluminum: 240,
  board: 240,
  soc: 240,
  glass: 240,
  battery: 240,
  camera: 720,
  box: 240,
}

export const stationSlotX = (index: number) => (index - 3) * 3
export const stationEntryX = (index: number) => stationSlotX(index) - ENTRY_OFFSET

export function createSim(): SimState {
  const state: SimState = {
    time: 0,
    runTime: 0,
    products: [],
    scraps: [],
    model: 'pro',
    changeover: null,
    stations: STATIONS.map((s) => ({
      id: s.id,
      state: 'idle' as StationState,
      occupant: null,
      progress: 0,
      produced: 0,
      waiting: 0,
      defects: 0,
      lastOk: true,
      lastOkAt: -99,
      bins: Object.fromEntries((STATION_MATERIALS[s.id] ?? []).map((m) => [m.id, 0])),
    })),
    stock: { ...INITIAL_STOCK },
    finished: 0,
    defects: 0,
    started: 0,
    orders: [],
    orderSeq: 1,
    shipments: [],
    shelf: [],
    score: 0,
    ordersDone: 0,
    ordersFailed: 0,
    nextId: 1,
    eventSeq: 1,
    events: [],
  }
  seedOrders(state)
  return state
}

const ORDER_POOL: { client: string; qty: number; timeLimit: number; reward: number; model: ModelId }[] = [
  { client: '星河零售', qty: 6, timeLimit: 180, reward: 70, model: 'pro' },
  { client: '蓝湖通信', qty: 10, timeLimit: 190, reward: 120, model: 'air' },
  { client: '加急 · 环球渠道', qty: 8, timeLimit: 120, reward: 110, model: 'pro' },
  { client: '大单 · 天穹电子', qty: 16, timeLimit: 300, reward: 240, model: 'air' },
]

function makeOrder(seq: number): Order {
  const tpl = ORDER_POOL[(seq - 1) % ORDER_POOL.length]
  return {
    id: seq,
    client: tpl.client,
    model: tpl.model,
    qty: tpl.qty,
    delivered: 0,
    timeLimit: tpl.timeLimit,
    elapsed: 0,
    reward: tpl.reward,
    state: 'queued',
  }
}

function seedOrders(s: SimState) {
  for (let i = 0; i < 3; i++) s.orders.push(makeOrder(s.orderSeq++))
  s.orders[0].state = 'active'
}

/** 活跃订单（永远在队首） */
export function activeOrder(s: SimState): Order | undefined {
  return s.orders[0]
}

export function evaluation(s: SimState) {
  if (s.ordersDone === 0) return '—'
  if (s.ordersFailed === 0 && s.ordersDone >= 3) return 'S'
  if (s.ordersFailed <= 1) return 'A'
  return 'B'
}

function pushEvent(s: SimState, text: string, kind: SimEvent['kind'] = 'info') {
  s.events.push({ id: s.eventSeq++, t: s.time, kind, text })
  if (s.events.length > 40) s.events.shift()
}

/** 料仓是否够这一件所需 */
export function qtyFor(id: MaterialId, base: number, model: ModelId) {
  return id === 'camera' ? MODELS[model].cameraQty : base
}

export function hasMaterial(st: StationRun, stationId: number, model: ModelId = 'pro') {
  const req = STATION_MATERIALS[stationId] ?? []
  return req.every((r) => (st.bins[r.id] ?? 0) >= qtyFor(r.id, r.qty, model))
}

function consume(st: StationRun, stationId: number, model: ModelId) {
  const req = STATION_MATERIALS[stationId] ?? []
  if (!req.every((r) => (st.bins[r.id] ?? 0) >= qtyFor(r.id, r.qty, model))) return false
  for (const r of req) st.bins[r.id] = (st.bins[r.id] ?? 0) - qtyFor(r.id, r.qty, model)
  return true
}

function settleOrder(s: SimState, ok: boolean) {
  const order = s.orders.shift()
  if (!order) return

  if (ok) {
    const left = 1 - order.elapsed / order.timeLimit
    const mult = left > 0.5 ? 1.2 : left > 0.2 ? 1 : 0.8
    const gained = Math.round(order.reward * mult)
    s.score += gained
    s.ordersDone += 1
    pushEvent(s, `订单完成：${order.client} ${order.qty} 台，+${gained} 分`, 'ok')
  } else {
    s.ordersFailed += 1
    pushEvent(s, `订单超时：${order.client} 未按时交付`, 'warn')
  }

  // 整批发货：货架清空，在途件作废
  s.shelf = []
  s.shipments = []
  s.orders.push(makeOrder(s.orderSeq++))
  for (const o of s.orders) o.state = 'queued'
  s.orders[0].state = 'active'
}

/** 成品下线：计入订单并生成飞向货架的动画 */
function shipPhone(s: SimState, model: ModelId) {
  s.finished += 1
  const order = s.orders[0]
  // 换线尾料：上一机型的件照常下线，但不计入新订单
  if (order && order.model === model) order.delivered += 1

  const slot = Math.min(11, s.shelf.length + s.shipments.length)
  const [x1, y1, z1] = shelfSlotWorld(slot)
  const y0 = BELT_Y + 0.1
  s.shipments.push({
    id: s.nextId++,
    slot,
    t: 0,
    dur: 0.85,
    x: BELT_END,
    y: y0,
    z: 0,
    x0: BELT_END,
    y0,
    z0: 0,
    x1,
    y1,
    z1,
  })
}

/** 距离产线起点还有多远能被下游容纳：用于 S1 是否继续投放 */
function isClear(s: SimState, x: number) {
  return !s.products.some((p) => p.x > x - 0.2 && p.x < x + GAP * 1.6)
}

export function stepSim(s: SimState, rawDt: number, opts: StepOpts) {
  const dt = Math.max(0, rawDt) * opts.speed
  if (dt <= 0) return

  s.time += dt
  s.runTime += dt

  const removed: number[] = []

  // ---------- 1. 工站加工 ----------
  for (let i = 0; i < s.stations.length; i++) {
    const st = s.stations[i]
    const def = STATION_BY_ID[st.id]
    const slotX = stationSlotX(i)
    const outX = slotX + RELEASE_OFFSET

    // S1：源工站，没有入场件，靠料仓连续产出
    if (st.id === 1) {
      if (!isClear(s, outX)) continue
      // 换线时 S1 不投新件，让线上件自然排空
      if (s.changeover) continue

      const cycle = def.cycleSec * MODELS[s.model].cycleScale
      if (st.progress < 1) {
        if (!hasMaterial(st, 1, s.model)) continue
        st.progress = Math.min(1, st.progress + dt / cycle)
      }

      if (st.progress >= 1) {
        if (!consume(st, 1, s.model)) continue
        st.progress = 0
        st.produced += 1
        s.started += 1
        s.products.push({
          id: s.nextId++,
          x: outX,
          stage: 1,
          item: def.output,
          model: s.model,
          flawed: opts.rng() < (opts.incomingDefect ?? 0),
          mode: 'moving',
          t: 0,
        })
        if (s.started === 1) pushEvent(s, 'S1 冲压成型：首件机壳下线', 'ok')
      }
      continue
    }

    // S2…S7：加工入口件
    if (st.occupant == null) {
      st.progress = 0
      continue
    }
    const p = s.products.find((v) => v.id === st.occupant)
    if (!p) {
      st.occupant = null
      st.progress = 0
      continue
    }

    if (p.mode === 'entering') {
      p.t += dt / ENTER_TIME
      const k = Math.min(1, p.t)
      const e = 1 - Math.pow(1 - k, 3)
      p.x = stationEntryX(i) + (slotX - stationEntryX(i)) * e
      if (k >= 1) {
        p.mode = 'processing'
        p.t = 0
      }
      continue
    }

    // processing
    const cycle = def.cycleSec * MODELS[p.model].cycleScale
    p.t += dt
    st.progress = Math.min(1, p.t / cycle)
    if (p.t < cycle) continue

    // 出口被前车堵住：加工已完成但先不放行（真实产线的阻塞）
    const blocked = s.products.some((q) => q.id !== p.id && q.x > outX - 0.05 && q.x < outX + GAP)
    if (blocked) {
      st.progress = 1
      continue
    }

    // 判良率：来料缺陷只在检测站暴露
    const flawedCaught = p.flawed && st.id === 6
    const ok = opts.forceDefectAt === st.id ? false : !flawedCaught && opts.rng() < def.yieldRate
    st.produced += 1
    st.lastOk = ok
    st.lastOkAt = s.time
    st.occupant = null
    st.progress = 0

    if (!ok) {
      s.defects += 1
      st.defects += 1
      removed.push(p.id)
      s.scraps.push({
        id: p.id,
        x0: slotX,
        z0: 0,
        x1: slotX + 0.62,
        z1: 1.02,
        x: slotX,
        y: BELT_Y + 0.1,
        z: 0,
        t: 0,
        dur: 0.7,
      })
      pushEvent(
        s,
        flawedCaught ? `${def.code} 检出：来料不良，整台报废` : `${def.code} ${def.name}：检出不良品，已剔除`,
        'warn',
      )
      continue
    }

    p.stage += 1
    p.item = def.output
    p.mode = 'moving'
    p.t = 0
    p.x = outX
  }

  if (removed.length) {
    s.products = s.products.filter((p) => !removed.includes(p.id))
  }

  // ---------- 1.5 不良品落箱动画 ----------
  for (const sc of s.scraps) {
    sc.t += dt
    const k = Math.min(1, sc.t / sc.dur)
    const ease = k * k * (3 - 2 * k)
    sc.x = sc.x0 + (sc.x1 - sc.x0) * ease
    sc.z = sc.z0 + (sc.z1 - sc.z0) * ease
    sc.y = BELT_Y + 0.12 + (0.42 - 0.12) * ease + Math.sin(Math.PI * k) * 0.42
  }
  if (s.scraps.length) s.scraps = s.scraps.filter((sc) => sc.t < sc.dur + 0.15)

  // ---------- 1.6 换线 ----------
  if (s.changeover) {
    s.changeover.t += dt
    if (s.changeover.t >= s.changeover.need) {
      s.model = s.changeover.model
      pushEvent(s, `换线完成，开始生产 ${MODELS[s.model].name}`, 'ok')
      s.changeover = null
    }
  }

  // ---------- 1.7 订单计时与成品上架 ----------
  const active = s.orders[0]
  if (active) {
    active.elapsed += dt
    if (active.delivered >= active.qty) settleOrder(s, true)
    else if (active.elapsed >= active.timeLimit) settleOrder(s, false)
  }

  // 新订单机型不同 → 触发换线（等当前换线结束后再判断）
  if (!s.changeover && s.orders[0]) {
    const need = s.orders[0].model
    if (need !== s.model) {
      s.changeover = { model: need, t: 0, need: MODELS[need].changeoverSec }
      pushEvent(s, `换单：${MODELS[need].name}，换线 ${MODELS[need].changeoverSec}s`, 'info')
    }
  }

  for (const sh of s.shipments) {
    sh.t += dt
    const k = Math.min(1, sh.t / sh.dur)
    const ease = k * k * (3 - 2 * k)
    sh.x = sh.x0 + (sh.x1 - sh.x0) * ease
    sh.z = sh.z0 + (sh.z1 - sh.z0) * ease
    sh.y = sh.y0 + (sh.y1 - sh.y0) * ease + Math.sin(Math.PI * k) * 0.7
  }
  const landed = s.shipments.filter((sh) => sh.t >= sh.dur)
  if (landed.length) {
    for (const sh of landed) {
      if (!s.shelf.includes(sh.slot)) s.shelf.push(sh.slot)
    }
    s.shipments = s.shipments.filter((sh) => sh.t < sh.dur)
  }

  // ---------- 2. 传送带运输 ----------
  const traffic = s.products.filter((p) => p.mode !== 'processing')
  traffic.sort((a, b) => b.x - a.x)

  let leaderX = Number.POSITIVE_INFINITY
  for (const p of traffic) {
    // 正在进站的件只作为前车参与跟车，不自己移动
    if (p.mode === 'entering') {
      leaderX = p.x
      continue
    }
    const next = STATIONS[p.stage]
    const stopAt = next ? stationEntryX(p.stage) : BELT_END

    const allowed = Math.min(p.x + BELT_SPEED * dt, stopAt, leaderX - GAP)
    p.x = Math.max(p.x, allowed)
    leaderX = p.x

    if (p.x >= stopAt - 0.005) {
      if (next) {
        const st = s.stations[next.id - 1]
        // 料不够就抓不进来：车停在入口，形成缺料排队
        if (st.occupant == null && hasMaterial(st, next.id, p.model)) {
          consume(st, next.id, p.model)
          st.occupant = p.id
          p.mode = 'entering'
          p.t = 0
        } else {
          p.mode = 'queued'
        }
      } else {
        removed.push(p.id)
        shipPhone(s, p.model)
        if (s.finished % 5 === 0) {
          pushEvent(s, `第 ${s.finished} 台成品手机装箱入库`, 'ok')
        }
      }
    } else {
      p.mode = 'moving'
    }
  }

  if (removed.length) {
    s.products = s.products.filter((p) => !removed.includes(p.id))
  }

  // ---------- 3. 刷新工站状态 ----------
  for (let i = 0; i < s.stations.length; i++) {
    const st = s.stations[i]
    const entry = stationEntryX(i)
    st.waiting = s.products.filter(
      (p) => p.stage === st.id - 1 && p.x <= entry + 0.02 && p.x > entry - 2.4,
    ).length

    const stocked = hasMaterial(st, st.id, s.model)
    const prevState = st.state

    if (st.id === 1) {
      const jammed = !isClear(s, stationSlotX(i) + RELEASE_OFFSET)
      st.state = jammed ? 'blocked' : !stocked ? 'starved' : st.progress > 0.001 ? 'working' : 'idle'
    } else if (st.occupant != null) {
      st.state = 'working'
    } else if (!stocked) {
      st.state = 'starved'
    } else if (st.waiting >= 3) {
      st.state = 'blocked'
    } else {
      st.state = 'idle'
    }

    if (st.state !== prevState) {
      const code = STATION_BY_ID[st.id].code
      const name = STATION_BY_ID[st.id].name
      if (st.state === 'starved') {
        pushEvent(s, `${code} ${name}：料仓空了，停线等料`, 'warn')
      } else if (prevState === 'starved' && st.state === 'working') {
        pushEvent(s, `${code} 补料完成，恢复生产`, 'ok')
      }
    }
  }

  s.products.sort((a, b) => b.x - a.x)
}

/** 实际产能：台/小时 */
export function uph(s: SimState) {
  if (s.runTime < 5) return 0
  return (s.finished / s.runTime) * 3600
}

/** 良率 */
export function yieldRate(s: SimState) {
  const total = s.finished + s.defects
  return total === 0 ? 0 : s.finished / total
}

/** 整线是否因为缺料停住（S1 或任一工站缺料且前面有货） */
export function starvedStations(s: SimState) {
  return s.stations.filter((st) => st.state === 'starved').map((st) => st.id)
}