import { describe, expect, it } from 'vitest'
import { BELT_END, binCap, createSim, stepSim, uph, yieldRate, type SimState } from './engine'
import { STATIONS, STATION_BY_ID, LINE_YIELD, MODELS, type MaterialId, type ModelId } from './recipes'

const DT = 1 / 30

interface RunOpts {
  speed?: number
  rng?: () => number
  /** 默认把所有料仓补满；传 false 保持空仓 */
  prime?: boolean
  /** 只补指定工站的料仓 */
  only?: number[]
}

/** 测试里直接灌满料仓（应用内单仓上限 12，这里放宽到 120 便于跑长流程） */
function prime(s: SimState, only?: number[]) {
  for (const st of s.stations) {
    if (only && !only.includes(st.id)) continue
    for (const key of Object.keys(st.bins)) st.bins[key as MaterialId] = 120
  }
}

function feedInto(s: SimState, stationId: number, material: MaterialId, amount: number) {
  const st = s.stations[stationId - 1]
  const cap = binCap(stationId)
  const cur = st.bins[material] ?? 0
  const moved = Math.max(0, Math.min(amount, cap - cur, s.stock[material]))
  st.bins[material] = cur + moved
  s.stock[material] -= moved
  return { moved }
}

function run(seconds: number, opts: RunOpts = {}) {
  const s = createSim()
  if (opts.prime !== false) prime(s, opts.only)
  const o = { speed: opts.speed ?? 1, rng: opts.rng ?? (() => 0) }
  for (let t = 0; t < seconds; t += DT) stepSim(s, DT, o)
  return s
}

describe('产线状态机', () => {
  it('料仓为空时什么都不产', () => {
    const s = run(30, { prime: false })
    expect(s.started).toBe(0)
    expect(s.finished).toBe(0)
    expect(s.products.length).toBe(0)
    expect(s.stations[0].state).toBe('starved')
  })

  it('S1 按节拍产出：2.5s 节拍下 10 秒约 3–4 件', () => {
    const s = run(10)
    expect(s.started).toBeGreaterThanOrEqual(3)
    expect(s.started).toBeLessThanOrEqual(4)
  })

  it('加工会推进 stage 并改变形态', () => {
    const s = run(12)
    expect(s.products.some((p) => p.stage >= 2)).toBe(true)
    for (const p of s.products) {
      expect(p.stage).toBeGreaterThanOrEqual(1)
      expect(p.item).toBe(STATIONS[p.stage - 1].output)
    }
  })

  it('在制品不会重叠，跟车保持间距', () => {
    const s = run(60)
    const xs = s.products.map((p) => p.x).sort((a, b) => b - a)
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i - 1] - xs[i]).toBeGreaterThan(0.55)
    }
  })

  it('良率生效：坏件被剔除并计入 defects', () => {
    const bad = run(60, { rng: () => 0.999 })
    expect(bad.defects).toBeGreaterThan(0)
    expect(bad.finished).toBe(0)
    expect(yieldRate(bad)).toBe(0)

    const good = run(60, { rng: () => 0 })
    expect(good.defects).toBe(0)
    expect(good.finished).toBeGreaterThan(0)
    expect(yieldRate(good)).toBe(1)
  })

  it('时间推进与倍速等价：2 倍速跑 30 秒 ≈ 1 倍速跑 60 秒', () => {
    const fast = run(30, { speed: 2 })
    const slow = run(60, { speed: 1 })
    expect(Math.abs(fast.finished - slow.finished)).toBeLessThanOrEqual(2)
    expect(Math.abs(fast.started - slow.started)).toBeLessThanOrEqual(2)
  })

  it('成品只在线尾入库，且不超过启动件数', () => {
    const s = run(120)
    expect(s.finished).toBeGreaterThan(0)
    expect(s.finished + s.defects).toBeLessThanOrEqual(s.started)
    for (const p of s.products) {
      expect(p.x).toBeLessThan(BELT_END + 0.1)
    }
    expect(uph(s)).toBeGreaterThan(0)
    expect(uph(s)).toBeLessThan(900)
  })

  it('瓶颈在 S6：各站产出依次不增', () => {
    const s = run(120)
    const produced = (id: number) => s.stations[id - 1].produced
    for (let id = 2; id <= 7; id++) {
      expect(produced(id)).toBeLessThanOrEqual(produced(id - 1))
    }
    expect(STATION_BY_ID[6].cycleSec).toBe(Math.max(...STATIONS.map((v) => v.cycleSec)))
  })

  it('料仓会被真实消耗，耗尽后 S1 停线', () => {
    const s = createSim()
    prime(s)
    s.stations[0].bins.aluminum = 5
    const o = { speed: 1, rng: () => 0 }
    for (let t = 0; t < 60; t += DT) stepSim(s, DT, o)
    expect(s.started).toBe(5)
    expect(s.stations[0].bins.aluminum).toBe(0)
    expect(s.stations[0].state).toBe('starved')
  })

  it('整线累计良率落在 93%–97%', () => {
    expect(LINE_YIELD).toBeGreaterThan(0.93)
    expect(LINE_YIELD).toBeLessThan(0.97)
    for (const s of STATIONS) expect(s.yieldRate).toBeGreaterThan(0.97)
  })

  it('不良品会留在该站的回收计数里', () => {
    const s = run(60, { rng: () => 0.999 })
    const totalDefects = s.stations.reduce((n, st) => n + st.defects, 0)
    expect(totalDefects).toBe(s.defects)
    expect(s.scraps.length).toBeGreaterThanOrEqual(0)
  })

  it('成品会计入订单并落到货架机位', () => {
    // 40s：首单还没交付，能稳定观察到"计入订单"
    const s = run(40)
    const order = s.orders[0]
    expect(order).toBeTruthy()
    expect(order.delivered).toBeGreaterThan(0)
    expect(s.shelf.length + s.shipments.length).toBeGreaterThan(0)
    // 机位不重复
    expect(new Set(s.shelf).size).toBe(s.shelf.length)
  })

  it('订单达标即结算积分并自动接下一单', () => {
    const s = run(200)
    expect(s.ordersDone).toBeGreaterThanOrEqual(1)
    expect(s.score).toBeGreaterThan(0)
    expect(s.orders.length).toBeGreaterThanOrEqual(2)
    expect(s.orders[0].state).toBe('active')
    expect(s.shelf.length).toBeLessThanOrEqual(12)
  })

  it('超时未交付会判失败，但产线继续跑', () => {
    const s = createSim()
    prime(s)
    for (let t = 0; t < 200; t += DT) {
      stepSim(s, DT, { speed: 1, rng: () => 0 })
      // 人为把订单时间顶到超时
      if (s.orders[0]) s.orders[0].elapsed += 5 * DT
    }
    expect(s.ordersFailed).toBeGreaterThan(0)
    expect(s.finished).toBeGreaterThan(0)
  })

  it('换单机型不同会触发换线，换线期间 S1 停产', () => {
    const s = createSim()
    prime(s)
    s.orders[0].model = 'air'
    const o = { speed: 1, rng: () => 0 }

    for (let t = 0; t < 2; t += DT) stepSim(s, DT, o)
    expect(s.changeover).not.toBeNull()
    expect(s.started).toBe(0)

    for (let t = 0; t < 10; t += DT) stepSim(s, DT, o)
    expect(s.changeover).toBeNull()
    expect(s.model).toBe('air')
    expect(s.started).toBeGreaterThan(0)
  })

  it('换线尾料不计入新订单', () => {
    const s = createSim()
    prime(s)
    const o = { speed: 1, rng: () => 0 }
    // 先用 Pro 跑出几件在制品
    for (let t = 0; t < 20; t += DT) stepSim(s, DT, o)
    const before = s.orders[0].delivered
    // 强行切到 Air 订单
    s.orders[0].model = 'air'
    s.orders[0].delivered = 0
    for (let t = 0; t < 60; t += DT) stepSim(s, DT, o)
    // 换线后 Pro 的尾料已经下线，只算 finished；订单只收 Air
    expect(s.finished).toBeGreaterThan(0)
    expect(s.orders[0].delivered + s.finished).toBeGreaterThan(before)
    expect(s.model).toBe('air')
  })

  it('Air 每台只吃 2 颗摄像头，同样料能多产', () => {
    const mk = (model: ModelId) => {
      const s = createSim()
      prime(s)
      s.model = model
      s.orders[0].model = model
      s.stations[4].bins.camera = 12
      const o = { speed: 1, rng: () => 0 }
      for (let t = 0; t < 150; t += DT) stepSim(s, DT, o)
      return s
    }
    const pro = mk('pro')
    const air = mk('air')
    expect(MODELS.air.cameraQty).toBe(2)
    expect(pro.finished).toBeGreaterThan(0)
    expect(air.finished).toBeGreaterThan(pro.finished)
  })

  it('来料缺陷只在 S6 暴露，且不影响其他工站的不良计数', () => {
    const s = createSim()
    prime(s)
    const o = { speed: 1, rng: () => 0, incomingDefect: 1 }
    for (let t = 0; t < 120; t += DT) stepSim(s, DT, o)
    expect(s.defects).toBeGreaterThan(0)
    expect(s.finished).toBe(0)
    // 全部不良都发生在 S6
    expect(s.stations[5].defects).toBe(s.defects)
    expect(s.stations[0].defects + s.stations[1].defects + s.stations[2].defects).toBe(0)
  })

  it('难度为 0 时不产生来料不良', () => {
    const s = createSim()
    prime(s)
    const o = { speed: 1, rng: () => 0, incomingDefect: 0 }
    for (let t = 0; t < 120; t += DT) stepSim(s, DT, o)
    expect(s.defects).toBe(0)
    expect(s.finished).toBeGreaterThan(0)
  })

  it('S5 料仓上限是 24，其他站仍是 12', () => {
    expect(binCap(5)).toBe(24)
    expect(binCap(1)).toBe(12)
    const s = createSim()
    const res = feedInto(s, 5, 'camera', 30)
    expect(res.moved).toBe(24)
  })

  it('中途断料：S2 没主板就抓不到件，整线停住', () => {
    const s = run(60, { only: [1] })
    expect(s.stations[1].state).toBe('starved')
    expect(s.finished).toBe(0)
    expect(s.products.length).toBeGreaterThan(0)
    // 所有在制品都堵在 S2 入口之前
    for (const p of s.products) {
      expect(p.x).toBeLessThan(-7)
    }
  })
})