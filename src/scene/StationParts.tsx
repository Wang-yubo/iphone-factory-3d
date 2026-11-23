import { Edges, Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BIN, STATION_SIZE } from '@/lib/layout'
import { FLAGS } from '@/lib/flags'
import { MATS } from '@/lib/materials'
import { C } from '@/lib/palette'
import { binCap } from '@/sim/engine'
import { binSlots, feed } from '@/sim/feed'
import { MATERIAL_BY_ID, MATERIAL_SHORT } from '@/sim/recipes'
import { sim } from '@/sim/sim'
import { useFactory } from '@/store/useFactory'
import { thock } from '@/lib/sfx'
import { binTargets } from './binRegistry'
import { perforatedTexture } from './stationFrame'
import { StationHead } from './StationHeads'

const W = STATION_SIZE.w
const H = STATION_SIZE.h
const D = STATION_SIZE.d
const T = STATION_SIZE.post

/** 背面机柜：冲孔侧板 + 控制屏 + 工站色灯带 */
export function Cabinet({ accent }: { accent: string }) {
  const perf = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: perforatedTexture(),
        metalness: 0.7,
        roughness: 0.42,
        color: '#b9c0c7',
      }),
    [],
  )

  return (
    <group position={[0, 0, -0.95]}>
      {/* 柜体 */}
      <mesh position={[0, 0.62, 0]} material={MATS.deepSteel()} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.94, 0.62]} />
      </mesh>

      {/* 顶盖 */}
      <mesh position={[0, 1.1, 0]} material={MATS.darkSteel()} castShadow>
        <boxGeometry args={[1.74, 0.04, 0.66]} />
      </mesh>

      {/* 两侧冲孔板 */}
      {[-1, 1].map((sx) => (
        <mesh
          key={sx}
          position={[sx * 0.851, 0.62, 0]}
          rotation={[0, (sx * Math.PI) / 2, 0]}
          material={perf}
          receiveShadow
        >
          <planeGeometry args={[0.56, 0.84]} />
        </mesh>
      ))}

      {/* 前面板 */}
      <mesh position={[0, 0.62, 0.313]} material={MATS.darkSteel()}>
        <boxGeometry args={[1.48, 0.82, 0.02]} />
      </mesh>

      {/* 工站色灯带 */}
      <mesh position={[0, 0.96, 0.322]} material={MATS.glow(accent, 1.3)}>
        <boxGeometry args={[1.24, 0.035, 0.01]} />
      </mesh>

      {/* 控制屏 */}
      <mesh position={[-0.42, 0.7, 0.325]}>
        <planeGeometry args={[0.38, 0.22]} />
        <meshStandardMaterial color="#0a1a24" emissive={accent} emissiveIntensity={0.55} roughness={0.25} />
      </mesh>

      {/* 三个按钮 */}
      {[0, 0.12, 0.24].map((dx, i) => (
        <mesh
          key={dx}
          position={[0.42 + dx, 0.7, 0.324]}
          rotation={[Math.PI / 2, 0, 0]}
          material={MATS.glow(i === 0 ? '#57d99a' : '#5a636c', i === 0 ? 0.9 : 0.1)}
        >
          <cylinderGeometry args={[0.022, 0.022, 0.012, 14]} />
        </mesh>
      ))}

      {/* 下部散热格栅 */}
      {[0.42, 0.46, 0.5, 0.54].map((y) => (
        <mesh key={y} position={[0, y, 0.322]} material={MATS.steel()}>
          <boxGeometry args={[0.92, 0.008, 0.008]} />
        </mesh>
      ))}
    </group>
  )
}

/** 机械臂：有活时探身到传送带上方，空闲时收回 */
export function Arm({ accent, stationId }: { accent: string; stationId: number }) {
  const shoulder = useRef<THREE.Group>(null)
  const forearm = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    const st = sim.stations[stationId - 1]
    const active = st.state === 'working'
    if (shoulder.current) {
      shoulder.current.rotation.x = THREE.MathUtils.damp(
        shoulder.current.rotation.x,
        active ? 1.18 : 0.9,
        7,
        dt,
      )
    }
    if (forearm.current) {
      forearm.current.rotation.x = THREE.MathUtils.damp(
        forearm.current.rotation.x,
        active ? 1.0 : 1.2,
        7,
        dt,
      )
    }
  })

  return (
    <group position={[0, 1.12, -0.95]}>
      <mesh material={MATS.darkSteel()} castShadow>
        <cylinderGeometry args={[0.19, 0.22, 0.14, 24]} />
      </mesh>
      <mesh position={[0, 0.1, 0]} material={MATS.steel()} castShadow>
        <cylinderGeometry args={[0.13, 0.14, 0.18, 24]} />
      </mesh>

      <group ref={shoulder} rotation={[0.9, 0, 0]}>
        <mesh position={[0, 0.4, 0]} material={MATS.whitePlastic()} castShadow>
          <boxGeometry args={[0.11, 0.8, 0.11]} />
        </mesh>
        {/* 关节 */}
        <mesh position={[0, 0.8, 0]} rotation={[0, 0, Math.PI / 2]} material={MATS.darkSteel()}>
          <cylinderGeometry args={[0.09, 0.09, 0.16, 20]} />
        </mesh>

        <group ref={forearm} position={[0, 0.8, 0]} rotation={[1.2, 0, 0]}>
          <mesh position={[0, 0.33, 0]} material={MATS.aluminum()} castShadow>
            <boxGeometry args={[0.085, 0.66, 0.085]} />
          </mesh>
          <mesh position={[0, 0.7, 0]} material={MATS.glow(accent, 0.8)}>
            <boxGeometry args={[0.16, 0.09, 0.16]} />
          </mesh>
          {/* 夹爪 */}
          <mesh position={[0, 0.78, 0]} material={MATS.steel()}>
            <boxGeometry args={[0.2, 0.03, 0.2]} />
          </mesh>
          {[-0.07, 0.07].map((dx) => (
            <mesh key={dx} position={[dx, 0.86, 0]} material={MATS.darkSteel()}>
              <boxGeometry args={[0.028, 0.14, 0.03]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  )
}

/** 工站工艺头：具体形态与动作在 StationHeads 里，这里只加一点整体浮动 */
export function ToolHead({ id, accent }: { id: number; accent: string }) {
  const root = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    if (!root.current) return
    const active = sim.stations[id - 1].state === 'working'
    root.current.position.y = THREE.MathUtils.damp(root.current.position.y, active ? 1.875 : 1.9, 8, dt)
  })

  return (
    <group ref={root} position={[0, 1.9, 0]}>
      <StationHead id={id} accent={accent} />
    </group>
  )
}

/** 料仓吊架：让料仓看起来是挂在工站结构上的，而不是浮在空中 */
export function BinGantry() {
  return (
    <group>
      {/* 立柱：从后侧顶梁升起 */}
      <mesh position={[0, 2.62, -1.26]} material={MATS.darkSteel()} castShadow>
        <boxGeometry args={[0.11, 0.68, 0.11]} />
      </mesh>
      {/* 悬臂 */}
      <mesh position={[0, 2.95, -0.58]} material={MATS.darkSteel()} castShadow>
        <boxGeometry args={[0.13, 0.09, 1.5]} />
      </mesh>
      {/* 吊点 */}
      <mesh position={[0, 2.92, 0.05]} material={MATS.steel()}>
        <boxGeometry args={[0.09, 0.06, 0.09]} />
      </mesh>
      <mesh position={[0, 2.9, 0.05]} material={MATS.steel()}>
        <boxGeometry args={[0.03, 0.1, 0.03]} />
      </mesh>
    </group>
  )
}

/** 料仓：每个原料一个仓，悬在工站上方，是本作最重要的可交互物体 */
export function Bin({
  stationId,
  accent,
  code,
  name,
}: {
  stationId: number
  accent: string
  code: string
  name: string
}) {
  const version = useFactory((s) => s.simVersion)
  const hoverBin = useFactory((s) => s.hoverBin)
  const selected = useFactory((s) => s.selected)
  const guideStep = useFactory((s) => s.guideStep)
  const root = useRef<THREE.Group>(null)
  const guideRing = useRef<THREE.Mesh>(null)
  const guide = guideStep === 0 && stationId === 1
  const slots = binSlots(stationId)
  const cap = binCap(stationId)
  const st = sim.stations[stationId - 1]
  const hovered = hoverBin === stationId
  const armed = hovered && (selected !== null || useFactory.getState().drag?.active)
  void version

  useEffect(() => {
    const g = root.current
    if (!g) return
    g.userData.stationId = stationId
    binTargets.set(stationId, g)
    return () => {
      binTargets.delete(stationId)
    }
  }, [stationId])

  useFrame((_, dt) => {
    const g = root.current
    if (!g) return
    const target = armed ? 1.09 : 1
    const s = THREE.MathUtils.damp(g.scale.x, target, 12, dt)
    g.scale.setScalar(s)

    // 新手引导：S1 料仓脚下扩散的光环
    const ring = guideRing.current
    if (ring) {
      const k = (performance.now() % 1500) / 1500
      ring.scale.setScalar(0.85 + k * 0.7)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k)
    }
  })

  if (slots.length === 0) return null

  const two = slots.length > 1
  const size = two ? 0.42 : BIN.size
  const offset = two ? 0.29 : 0
  const counts = slots.map((s) => st?.bins[s.id] ?? 0)

  const onPick = (e: ThreeEvent<MouseEvent>) => {
    const sel = useFactory.getState().selected
    if (!sel) return
    e.stopPropagation()
    const res = feed(stationId, sel, 1)
    const store = useFactory.getState()
    if (res.ok) {
      thock()
      store.advanceGuide(1)
      store.bump()
      store.showToast(`${MATERIAL_BY_ID[sel].name} +1 → ${code}`, 'ok')
    } else if (res.reason === 'wrong-station') {
      store.showToast(`${MATERIAL_BY_ID[sel].name} 不适用 ${code}`, 'warn')
    } else if (res.reason === 'full') {
      store.showToast(`${code} 料仓已满`, 'warn')
    } else {
      store.showToast('仓库库存不足', 'warn')
    }
  }

  return (
    <group ref={root} position={[0, BIN.y, 0]}>
      {slots.map((slot, i) => {
        const count = counts[i]
        const pct = Math.min(1, count / cap)
        const color = MATERIAL_BY_ID[slot.id].color
        return (
          <group key={slot.id} position={[i === 0 ? -offset : offset, 0, 0]}>
            <mesh material={MATS.glassTint(accent)}>
              <boxGeometry args={[size, 0.46, size]} />
              <Edges threshold={15} color={armed ? '#ffffff' : accent} />
            </mesh>

            {pct > 0 && (
              <mesh position={[0, -0.23 + (0.44 * pct) / 2, 0]} material={MATS.glow(color, 0.55)}>
                <boxGeometry args={[size - 0.04, Math.max(0.02, 0.44 * pct), size - 0.04]} />
              </mesh>
            )}

            <mesh position={[0, 0.235, 0]} material={MATS.aluminumDark()}>
              <boxGeometry args={[size + 0.05, 0.03, size + 0.05]} />
            </mesh>
            <mesh position={[0, -0.3, 0]} material={MATS.steel()}>
              <cylinderGeometry args={[0.1, 0.16, 0.18, 16, 1, true]} />
            </mesh>
          </group>
        )
      })}

      {/* 下料管 */}
      <mesh position={[0, -0.5, 0]} material={MATS.steel()}>
        <cylinderGeometry args={[0.05, 0.05, 0.16, 12]} />
      </mesh>

      {/* 交互热区：透明但可被射线命中 */}
      <mesh position={[0, 0, 0]} onClick={onPick}>
        <boxGeometry args={[two ? 1.06 : 0.82, 0.9, 0.86]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {guide && (
        <mesh ref={guideRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]}>
          <ringGeometry args={[0.5, 0.6, 44]} />
          <meshBasicMaterial color="#2fb8ff" transparent opacity={0.6} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {armed && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.52, 0]}>
          <ringGeometry args={[0.42, 0.5, 40]} />
          <meshBasicMaterial color={accent} transparent opacity={0.75} side={THREE.DoubleSide} />
        </mesh>
      )}

      {!FLAGS.noLabel && (
        <Html
          position={[0, 0.36, 0.03]}
          center
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          zIndexRange={[20, 0]}
        >
          <div className={`bin-tag${hovered ? ' is-hover' : ''}`} style={{ '--accent': accent } as CSSProperties}>
            <div className="bin-tag__row">
              <span className="bin-tag__code">{code}</span>
              {slots.map((slot, i) => (
                <span className="bin-tag__chip" key={slot.id}>
                  <em>{MATERIAL_SHORT[slot.id]}</em>
                  <b>{counts[i]}</b>
                  <i>/{cap}</i>
                </span>
              ))}
            </div>
            <div className="bin-tag__name">{name}</div>
          </div>
        </Html>
      )}
    </group>
  )
}

/** 状态灯柱：运行绿 / 阻塞琥珀 / 缺料红 / 待机工站色 */
export function Beacon({ accent, stationId }: { accent: string; stationId: number }) {
  const lamp = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const l = lamp.current
    if (!l) return
    const st = sim.stations[stationId - 1]
    if (l.userData.state === st.state) return
    l.userData.state = st.state
    const color =
      st.state === 'working' ? C.ok : st.state === 'blocked' ? C.warn : st.state === 'starved' ? C.danger : accent
    l.material = MATS.glow(color, 1.5)
  })

  return (
    <group position={[W / 2 - 0.16, 2.32, D / 2 - 0.18]}>
      <mesh position={[0, 0.04, 0]} material={MATS.darkSteel()}>
        <cylinderGeometry args={[0.055, 0.06, 0.08, 16]} />
      </mesh>
      <mesh ref={lamp} position={[0, 0.11, 0]} material={MATS.glow(accent, 0.6)}>
        <cylinderGeometry args={[0.05, 0.05, 0.07, 16]} />
      </mesh>
    </group>
  )
}

