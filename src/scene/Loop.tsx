import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { FLAGS } from '@/lib/flags'
import { buzz, chime, fanfare } from '@/lib/sfx'
import { DIFFICULTIES } from '@/sim/difficulty'
import { stepSim } from '@/sim/engine'
import { sim } from '@/sim/sim'
import { useFactory } from '@/store/useFactory'

const FIXED_STEP = 1 / 60
const MAX_STEPS = 8

/**
 * 产线主循环：固定步长推进模拟，与渲染解耦。
 * 渲染层每帧直接读 sim（不进 React），HUD 以 8Hz 读版本号刷新数字。
 * 顺带做两件事：把模拟事件翻译成音效、在持续掉帧时自动降画质。
 */
export function Loop() {
  const acc = useRef(0)
  const pub = useRef(0)
  const probe = useRef(0)
  const seen = useRef({ eventId: 0, finished: 0, ordersDone: 0 })
  const perf = useRef({ frames: 0, t: 0, cooldown: 12, startedAt: 0, downgrades: 0 })

  useFrame((_, delta) => {
    const state = useFactory.getState()

    if (state.lineState === 'running') {
      // 切后台/掉帧时不要让时间跳变
      acc.current += Math.min(delta, 0.12)
      let steps = 0
      while (acc.current >= FIXED_STEP && steps < MAX_STEPS) {
        stepSim(sim, FIXED_STEP, {
          speed: state.speed,
          rng: Math.random,
          incomingDefect: DIFFICULTIES[state.difficulty].incomingDefect,
          forceDefectAt: FLAGS.bad || undefined,
        })
        acc.current -= FIXED_STEP
        steps += 1
      }
      if (steps === MAX_STEPS) acc.current = 0
    }

    // ---------- 事件 → 音效 ----------
    if (sim.finished > seen.current.finished) {
      seen.current.finished = sim.finished
      chime()
    }
    if (sim.ordersDone > seen.current.ordersDone) {
      seen.current.ordersDone = sim.ordersDone
      fanfare()
    }
    const ev = sim.events[sim.events.length - 1]
    if (ev && ev.id > seen.current.eventId) {
      seen.current.eventId = ev.id
      if (ev.kind === 'warn') buzz()
    }

    if (FLAGS.probe) {
      probe.current += delta
      if (probe.current >= 2) {
        probe.current = 0
        const bins = sim.stations
          .map((st) => `${st.id}[${Object.entries(st.bins).map(([k, v]) => `${k.slice(0, 2)}:${v}`).join(',')}]`)
          .join(' ')
        console.log(
          `[sim] t=${sim.time.toFixed(1)} 在制=${sim.products.length} 启动=${sim.started} 成品=${sim.finished} 不良=${sim.defects} 状态=${state.lineState} 机型=${sim.model}${sim.changeover ? '(换线)' : ''} 单=${sim.orders[0]?.model ?? '-'} ${sim.orders[0]?.delivered ?? 0}/${sim.orders[0]?.qty ?? 0} 架=${sim.shelf.length} 完成=${sim.ordersDone} 分=${sim.score}`,
        )
        console.log(`[bins] ${bins}`)
      }
    }

    // ---------- 自动降画质 ----------
    // 只在页面可见、且已经跑了一会儿之后判断，后台标签的帧率没有意义
    const now = performance.now()
    if (perf.current.startedAt === 0) perf.current.startedAt = now
    perf.current.frames += 1
    perf.current.t += delta
    perf.current.cooldown = Math.max(0, perf.current.cooldown - delta)

    // 前 12 秒在编译着色器、加载资源，帧率没有参考价值
    const warmedUp = now - perf.current.startedAt > 12000
    if (warmedUp && perf.current.t >= 6 && perf.current.cooldown === 0 && document.visibilityState === 'visible') {
      const fps = perf.current.frames / perf.current.t
      const samples = perf.current.frames
      perf.current.frames = 0
      perf.current.t = 0
      // 帧数太少说明刚切回来/被节流，不做判断
      if (samples >= 45 && perf.current.downgrades < 2) {
        if (fps < 34 && state.quality !== 'low') {
          state.setQuality(state.quality === 'high' ? 'medium' : 'low')
          perf.current.cooldown = 12
          perf.current.downgrades += 1
        } else if (fps < 48 && state.quality === 'high') {
          state.setQuality('medium')
          perf.current.cooldown = 12
          perf.current.downgrades += 1
        }
      }
    }

    // 跟随目标下线/报废后自动退出
    if (state.focusProductId != null && !sim.products.some((v) => v.id === state.focusProductId)) {
      state.focusProduct(null)
    }

    pub.current += delta
    if (pub.current >= 0.12) {
      pub.current = 0
      state.bump()
    }
  })

  return null
}