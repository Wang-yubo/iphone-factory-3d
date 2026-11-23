import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { MATS } from '@/lib/materials'
import { C } from '@/lib/palette'
import { sim } from '@/sim/sim'

/**
 * 七个工站各自的工艺头与加工演出。
 * 进度来自状态机的 station.progress（0..1），渲染层只做映射。
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (v: number) => {
  const t = clamp01(v)
  return t * t * (3 - 2 * t)
}

interface HeadProps {
  id: number
  accent: string
}

function useStation(id: number) {
  return () => sim.stations[id - 1]
}

/** 工作窗口：把 progress 映射成 0..1 的"正在干活"程度，两端留出进退刀时间 */
function workPhase(id: number) {
  const st = useStation(id)()
  if (st.state !== 'working') return 0
  return clamp01((st.progress - 0.12) / 0.74)
}

/** 冲击闪光环：在工序最深处亮一下 */
function Flash({ color, visible }: { color: string; visible: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
      <ringGeometry args={[0.16, 0.22, 32]} />
      <meshBasicMaterial color={color} transparent opacity={visible * 0.85} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** S1 冲压：冲头快速下压 → 停顿 → 回程，触底闪一下 */
export function PressHead({ id, accent }: HeadProps) {
  const head = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)

  useFrame((_, dt) => {
    const w = workPhase(id)
    const down = Math.min(1, w * 3.2)
    const up = w > 0.86 ? (w - 0.86) / 0.14 : 0
    const depth = down * (1 - up)
    if (head.current) {
      head.current.position.y = THREE.MathUtils.damp(head.current.position.y, -0.34 * depth, 18, dt)
    }
    if (flash.current) {
      const m = flash.current.material as THREE.MeshBasicMaterial
      m.opacity = depth > 0.9 ? m.opacity + (1 - m.opacity) * Math.min(1, dt * 18) : Math.max(0, m.opacity - dt * 6)
    }
  })

  return (
    <group ref={head}>
      <mesh material={MATS.darkSteel()} castShadow>
        <boxGeometry args={[0.56, 0.34, 0.56]} />
      </mesh>
      <mesh position={[0, -0.3, 0]} material={MATS.aluminum()}>
        <boxGeometry args={[0.44, 0.28, 0.44]} />
      </mesh>
      <mesh ref={flash}>
        <ringGeometry args={[0.22, 0.3, 32]} />
        <meshBasicMaterial color={accent} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** S2 贴装：吸嘴在一个小网格上快速点打，伴随扫描光 */
export function PlaceHead({ id, accent }: HeadProps) {
  const nozzle = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)

  useFrame((_, dt) => {
    const w = workPhase(id)
    const dots = Math.abs(Math.sin(w * Math.PI * 5))
    if (nozzle.current) {
      nozzle.current.position.y = THREE.MathUtils.damp(nozzle.current.position.y, -0.1 - 0.14 * dots, 22, dt)
      nozzle.current.position.x = THREE.MathUtils.damp(nozzle.current.position.x, Math.sin(w * Math.PI * 10) * 0.09, 16, dt)
    }
    if (beam.current) {
      const m = beam.current.material as THREE.MeshBasicMaterial
      m.opacity = w > 0.02 ? 0.35 : 0
    }
  })

  return (
    <group>
      <mesh material={MATS.darkSteel()} castShadow>
        <boxGeometry args={[0.6, 0.16, 0.42]} />
      </mesh>
      <group ref={nozzle}>
        <mesh position={[0, -0.16, 0]} material={MATS.steel()}>
          <cylinderGeometry args={[0.05, 0.03, 0.26, 16]} />
        </mesh>
        <mesh position={[0, -0.3, 0]} material={MATS.glow(accent, 1.6)}>
          <sphereGeometry args={[0.035, 12, 12]} />
        </mesh>
      </group>
      <mesh ref={beam} position={[0, -0.36, 0]} material={MATS.glow(accent, 0.9)}>
        <coneGeometry args={[0.12, 0.26, 16, 1, true]} />
      </mesh>
    </group>
  )
}

/** S3 贴合：压板缓慢下压，UV 紫光扫过 */
export function LaminateHead({ id, accent }: HeadProps) {
  const plate = useRef<THREE.Group>(null)
  const uv = useRef<THREE.Mesh>(null)

  useFrame((_, dt) => {
    const w = workPhase(id)
    const press = smooth(clamp01((w - 0.05) / 0.55)) * (w > 0.88 ? 1 - (w - 0.88) / 0.12 : 1)
    if (plate.current) {
      plate.current.position.y = THREE.MathUtils.damp(plate.current.position.y, -0.22 * press, 10, dt)
    }
    if (uv.current) {
      const m = uv.current.material as THREE.MeshBasicMaterial
      m.opacity = press > 0.5 ? Math.min(0.5, m.opacity + dt * 3) : Math.max(0, m.opacity - dt * 4)
    }
  })

  return (
    <group>
      <mesh material={MATS.darkSteel()} castShadow>
        <boxGeometry args={[0.66, 0.14, 0.66]} />
      </mesh>
      <group ref={plate} position={[0, -0.1, 0]}>
        <mesh material={MATS.aluminum()}>
          <boxGeometry args={[0.58, 0.05, 0.58]} />
        </mesh>
        <mesh ref={uv} position={[0, -0.05, 0]}>
          <boxGeometry args={[0.54, 0.02, 0.54]} />
          <meshBasicMaterial color="#b48cff" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}

/** S4 电池装配：电动螺丝刀边转边下压 */
export function ScrewHead({ id, accent }: HeadProps) {
  const bit = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    const w = workPhase(id)
    const down = smooth(clamp01(w / 0.5))
    if (bit.current) {
      bit.current.position.y = THREE.MathUtils.damp(bit.current.position.y, -0.16 * down, 12, dt)
      bit.current.rotation.y += dt * (w > 0.05 ? 18 : 0)
    }
  })

  return (
    <group>
      <mesh material={MATS.darkSteel()} castShadow>
        <boxGeometry args={[0.42, 0.2, 0.42]} />
      </mesh>
      <group ref={bit}>
        <mesh position={[0, -0.18, 0]} material={MATS.steel()}>
          <cylinderGeometry args={[0.035, 0.02, 0.32, 14]} />
        </mesh>
        <mesh position={[0, -0.34, 0]} material={MATS.glow(accent, 1.6)}>
          <cylinderGeometry args={[0.012, 0.012, 0.06, 8]} />
        </mesh>
      </group>
    </group>
  )
}

/** S5 相机装配：三颗镜头依次吸附落位 */
export function CameraHead({ id, accent }: HeadProps) {
  const nozzles = useRef<(THREE.Group | null)[]>([])

  useFrame((_, dt) => {
    const w = workPhase(id)
    nozzles.current.forEach((n, i) => {
      if (!n) return
      const win = clamp01((w - i * 0.28) / 0.3)
      const depth = Math.sin(Math.PI * win) * (win > 0 ? 1 : 0)
      n.position.y = THREE.MathUtils.damp(n.position.y, -0.06 - 0.2 * depth, 16, dt)
    })
  })

  return (
    <group>
      <mesh material={MATS.darkSteel()} castShadow>
        <boxGeometry args={[0.5, 0.18, 0.3]} />
      </mesh>
      {[-0.13, 0, 0.13].map((dx, i) => (
        <group
          key={dx}
          position={[dx, -0.06, 0]}
          ref={(el) => {
            nozzles.current[i] = el
          }}
        >
          <mesh material={MATS.steel()}>
            <cylinderGeometry args={[0.04, 0.04, 0.16, 12]} />
          </mesh>
          <mesh position={[0, -0.1, 0]} material={MATS.glow(accent, 1.8)}>
            <cylinderGeometry args={[0.028, 0.028, 0.02, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** S6 功能检测：探针下压，末尾亮绿/红灯给出判定 */
export function ProbeHead({ id, accent }: HeadProps) {
  const bar = useRef<THREE.Group>(null)
  const lamp = useRef<THREE.Mesh>(null)
  const state = useRef({ lit: 0 })

  useFrame((_, dt) => {
    const w = workPhase(id)
    const down = smooth(clamp01((w - 0.1) / 0.45)) * (w > 0.85 ? 1 - (w - 0.85) / 0.15 : 1)
    if (bar.current) {
      bar.current.position.y = THREE.MathUtils.damp(bar.current.position.y, -0.2 * down, 14, dt)
    }
    if (lamp.current) {
      const st = sim.stations[id - 1]
      const fresh = sim.time - st.lastOkAt < 1.2
      state.current.lit = THREE.MathUtils.damp(state.current.lit, fresh ? 1 : 0, 10, dt)
      const m = lamp.current.material as THREE.MeshStandardMaterial
      const target = st.lastOk ? C.ok : C.danger
      m.emissive.set(target)
      m.color.set(target)
      m.emissiveIntensity = 0.4 + state.current.lit * 2.2
    }
  })

  return (
    <group>
      <mesh material={MATS.darkSteel()} castShadow>
        <boxGeometry args={[0.5, 0.16, 0.34]} />
      </mesh>
      <mesh ref={lamp} position={[0, 0.12, 0]} material={MATS.glow(C.ok, 0.6)}>
        <boxGeometry args={[0.46, 0.03, 0.3]} />
      </mesh>
      <group ref={bar}>
        {[-0.12, -0.04, 0.04, 0.12].map((dx) => (
          <mesh key={dx} position={[dx, -0.2, 0]} material={MATS.aluminum()}>
            <cylinderGeometry args={[0.009, 0.009, 0.26, 6]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** S7 包装：两侧夹爪合拢、压盖下压 */
export function PackHead({ id, accent }: HeadProps) {
  const left = useRef<THREE.Mesh>(null)
  const right = useRef<THREE.Mesh>(null)
  const lid = useRef<THREE.Mesh>(null)

  useFrame((_, dt) => {
    const w = workPhase(id)
    const close = smooth(clamp01((w - 0.25) / 0.35)) * (w > 0.9 ? 1 - (w - 0.9) / 0.1 : 1)
    if (left.current) left.current.position.x = THREE.MathUtils.damp(left.current.position.x, -0.2 + 0.07 * close, 14, dt)
    if (right.current) right.current.position.x = THREE.MathUtils.damp(right.current.position.x, 0.2 - 0.07 * close, 14, dt)
    if (lid.current) lid.current.position.y = THREE.MathUtils.damp(lid.current.position.y, -0.14 * close, 14, dt)
  })

  return (
    <group>
      <mesh material={MATS.darkSteel()} castShadow>
        <boxGeometry args={[0.62, 0.18, 0.46]} />
      </mesh>
      <mesh ref={lid} position={[0, -0.12, 0]} material={MATS.whitePlastic()}>
        <boxGeometry args={[0.4, 0.05, 0.3]} />
      </mesh>
      <mesh ref={left} position={[-0.2, -0.26, 0]} material={MATS.steel()}>
        <boxGeometry args={[0.05, 0.28, 0.34]} />
      </mesh>
      <mesh ref={right} position={[0.2, -0.26, 0]} material={MATS.steel()}>
        <boxGeometry args={[0.05, 0.28, 0.34]} />
      </mesh>
      <mesh position={[0, -0.42, 0]} material={MATS.glow(accent, 0.7)}>
        <boxGeometry args={[0.3, 0.02, 0.22]} />
      </mesh>
    </group>
  )
}

/** 按站号选择工艺头 */
export function StationHead({ id, accent }: HeadProps) {
  switch (id) {
    case 1:
      return <PressHead id={id} accent={accent} />
    case 2:
      return <PlaceHead id={id} accent={accent} />
    case 3:
      return <LaminateHead id={id} accent={accent} />
    case 4:
      return <ScrewHead id={id} accent={accent} />
    case 5:
      return <CameraHead id={id} accent={accent} />
    case 6:
      return <ProbeHead id={id} accent={accent} />
    default:
      return <PackHead id={id} accent={accent} />
  }
}