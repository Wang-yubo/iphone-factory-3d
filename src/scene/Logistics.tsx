import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { stationX } from '@/lib/layout'
import { binCap } from '@/sim/engine'
import { binSlots, feed } from '@/sim/feed'
import { MATERIAL_BY_ID, type MaterialId } from '@/sim/recipes'
import { sim } from '@/sim/sim'
import { thock } from '@/lib/sfx'
import { useFactory } from '@/store/useFactory'
import { COL, box, cyl, merge, tintedMaterial } from './geo'

/**
 * 车间里的动态件：
 *  - AGV 沿前场通道往返，在两端装卸停留
 *  - 老化测试架 12 个机位轮流点亮（模拟测试周期）
 *  - 卷帘门下方的透光光斑
 */

// ---------------- AGV ----------------

/** 线边暂存区（取货点）与产线前的行驶通道 */
const PICKUP = { x: -13.5, z: 3.05 }
const LANE_Z = 2.15
const SPEED = 1.25
const LOAD_TIME = 2.6
const UNLOAD_TIME = 3.0

type Phase = 'idle' | 'loading' | 'toStation' | 'unloading' | 'returning'

interface Task {
  stationId: number
  material: MaterialId
  amount: number
}

function agvGeometry() {
  const p: THREE.BufferGeometry[] = []
  box(p, 0.92, 0.24, 0.66, 0, 0.18, 0, new THREE.Color('#3d4650'))
  box(p, 0.98, 0.05, 0.72, 0, 0.325, 0, new THREE.Color('#c2c9d0'))
  box(p, 0.06, 0.1, 0.68, 0.48, 0.15, 0, COL.yellow)
  box(p, 0.06, 0.1, 0.68, -0.48, 0.15, 0, COL.yellow)
  // 车头方向指示灯条
  box(p, 0.02, 0.05, 0.5, 0.5, 0.3, 0, COL.deep)
  return merge(p)
}

function agvCargo() {
  const p: THREE.BufferGeometry[] = []
  box(p, 0.78, 0.06, 0.58, 0, 0.37, 0, COL.wood)
  box(p, 0.5, 0.32, 0.4, -0.06, 0.56, 0, COL.aluDark)
  box(p, 0.4, 0.24, 0.32, 0.12, 0.42, 0.02, COL.steel)
  return merge(p)
}

function agvWheels() {
  const p: THREE.BufferGeometry[] = []
  for (const dx of [-0.3, 0.3]) {
    for (const dz of [-0.3, 0.3]) {
      cyl(p, 0.095, 0.07, dx, 0.095, dz, COL.rubber, 'z', 14)
      cyl(p, 0.035, 0.08, dx, 0.095, dz, COL.steel, 'z', 10)
    }
  }
  return merge(p)
}

/** 找一台快见底的料仓，返回补料任务 */
function pickTask(cooldown: Map<number, number>, now: number): Task | null {
  let best: Task | null = null
  let bestRatio = 0.35
  for (const st of sim.stations) {
    if ((cooldown.get(st.id) ?? 0) > now) continue
    for (const slot of binSlots(st.id)) {
      const count = st.bins[slot.id] ?? 0
      const ratio = count / binCap(st.id)
      if (ratio < bestRatio && (sim.stock[slot.id] ?? 0) >= 2) {
        bestRatio = ratio
        best = {
          stationId: st.id,
          material: slot.id,
          amount: Math.max(3, Math.round(binCap(st.id) * 0.55)),
        }
      }
    }
  }
  return best
}

export function Agv() {
  const body = agvGeometry()
  const cargo = agvCargo()
  const wheels = agvWheels()
  const mat = tintedMaterial()
  const group = useRef<THREE.Group>(null)
  const cargoRef = useRef<THREE.Mesh>(null)
  const wheelRef = useRef<THREE.Mesh>(null)
  const lamp = useRef<THREE.Mesh>(null)
  const state = useRef({
    x: PICKUP.x,
    z: PICKUP.z,
    rot: Math.PI,
    phase: 'idle' as Phase,
    timer: 0,
    target: { x: PICKUP.x, z: PICKUP.z },
    task: null as Task | null,
    cooldown: new Map<number, number>(),
    rolled: 0,
  })

  const lampMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ffb020', emissiveIntensity: 1.4, roughness: 0.4 }),
    [],
  )

  useEffect(() => {
    return () => {
      body.dispose()
      cargo.dispose()
      wheels.dispose()
      lampMat.dispose()
    }
  }, [body, cargo, wheels, lampMat])

  useFrame((st, rawDt) => {
    const s = state.current
    const dt = Math.min(rawDt, 0.1)
    const now = st.clock.elapsedTime
    const running = useFactory.getState().lineState === 'running'

    const moveTo = (tx: number, tz: number) => {
      const dx = tx - s.x
      const dz = tz - s.z
      const d = Math.hypot(dx, dz)
      if (d < 0.02) return true
      const step = Math.min(SPEED * dt, d)
      s.x += (dx / d) * step
      s.z += (dz / d) * step
      s.rolled += step
      const want = Math.atan2(-dz, dx)
      let diff = want - s.rot
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      s.rot += diff * Math.min(1, dt * 4)
      return d - step < 0.03
    }

    switch (s.phase) {
      case 'idle': {
        if (!running) break
        const task = pickTask(s.cooldown, now)
        if (!task) break
        s.task = task
        s.phase = 'loading'
        s.timer = LOAD_TIME
        if (cargoRef.current) cargoRef.current.visible = true
        break
      }
      case 'loading': {
        s.timer -= dt
        if (s.timer <= 0 && s.task) {
          s.phase = 'toStation'
          s.target = { x: stationX(s.task.stationId - 1) + 0.9, z: LANE_Z }
        }
        break
      }
      case 'toStation': {
        if (moveTo(s.target.x, s.target.z)) {
          s.phase = 'unloading'
          s.timer = UNLOAD_TIME
        }
        break
      }
      case 'unloading': {
        s.timer -= dt
        if (s.timer <= 0 && s.task) {
          const res = feed(s.task.stationId, s.task.material, s.task.amount)
          const store = useFactory.getState()
          if (res.ok) {
            thock()
            store.showToast(`AGV 送达 S${s.task.stationId} · ${MATERIAL_BY_ID[s.task.material].name} +${res.moved}`, 'ok')
          }
          s.cooldown.set(s.task.stationId, now + 18)
          s.task = null
          s.phase = 'returning'
          s.target = { x: PICKUP.x, z: PICKUP.z }
          if (cargoRef.current) cargoRef.current.visible = false
          store.bump()
        }
        break
      }
      case 'returning': {
        if (moveTo(s.target.x, s.target.z)) {
          s.phase = 'idle'
        }
        break
      }
    }

    // 停在站边时稍微侧一点，别压着工位
    if (group.current) {
      group.current.position.set(s.x, 0, s.z)
      group.current.rotation.y = s.rot
    }
    if (wheelRef.current) wheelRef.current.rotation.z = -s.rolled / 0.095
    if (lamp.current) {
      const m = lamp.current.material as THREE.MeshStandardMaterial
      const busy = s.phase !== 'idle'
      m.emissiveIntensity = busy ? 1.6 + Math.sin(st.clock.elapsedTime * 8) * 0.8 : 0.5 + Math.sin(st.clock.elapsedTime * 3) * 0.3
    }
  })

  return (
    <group ref={group}>
      <mesh geometry={body} material={mat} castShadow receiveShadow />
      <mesh ref={wheelRef} geometry={wheels} material={mat} />
      <mesh ref={cargoRef} geometry={cargo} material={mat} castShadow visible={false} />
      <mesh ref={lamp} position={[0, 0.42, 0.28]} material={lampMat}>
        <cylinderGeometry args={[0.05, 0.05, 0.1, 12]} />
      </mesh>
    </group>
  )
}

// ---------------- 老化测试架指示灯 ----------------

const RACK_SLOTS: { x: number; y: number }[] = []
for (let r = 0; r < 2; r++) {
  const x0 = 12.4 + r * 1.9
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 4; i++) {
      RACK_SLOTS.push({ x: x0 + 0.3 + i * 0.38, y: 0.48 + s * 0.55 })
    }
  }
}

export function AgingLights() {
  const geo = useMemo(() => {
    const p: THREE.BufferGeometry[] = []
    for (const slot of RACK_SLOTS) {
      box(p, 0.1, 0.006, 0.2, slot.x, slot.y, -8.4, new THREE.Color('#123246'))
    }
    return merge(p)
  }, [])

  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.1, roughness: 0.5 }),
    [],
  )

  useEffect(() => {
    return () => {
      geo.dispose()
      mat.dispose()
    }
  }, [geo, mat])

  const colors = useMemo(() => geo.getAttribute('color') as THREE.BufferAttribute, [geo])
  const phase = useRef(0)

  useFrame((_, dt) => {
    phase.current += dt
    // 每 1.6s 换一台"在测"的机器，其余保持微亮
    const active = Math.floor(phase.current / 1.6) % RACK_SLOTS.length
    const glow = 0.55 + Math.sin(phase.current * 7) * 0.25
    const arr = colors.array as Float32Array
    const perSlot = arr.length / RACK_SLOTS.length
    for (let i = 0; i < RACK_SLOTS.length; i++) {
      const on = i === active
      const r = on ? 0.18 : 0.07
      const g = on ? 0.72 * glow + 0.2 : 0.19
      const b = on ? 1.0 : 0.28
      for (let v = 0; v < perSlot; v += 3) {
        arr[i * perSlot + v] = r
        arr[i * perSlot + v + 1] = g
        arr[i * perSlot + v + 2] = b
      }
    }
    colors.needsUpdate = true
  })

  return <mesh geometry={geo} material={mat} />
}

// ---------------- 卷帘门透光 ----------------

export function DoorGlow() {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#9fd8ff',
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useEffect(() => () => mat.dispose(), [mat])

  useFrame((st) => {
    mat.opacity = 0.08 + Math.sin(st.clock.elapsedTime * 0.7) * 0.03
  })

  return (
    <group>
      {[-6, 7.5].map((x) => (
        <mesh key={x} ref={mesh} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, -8.4]}>
          <planeGeometry args={[3.4, 2.6]} />
          <primitive object={mat} attach="material" />
        </mesh>
      ))}
    </group>
  )
}

export function Logistics() {
  return (
    <group>
      <Agv />
      <AgingLights />
      <DoorGlow />
    </group>
  )
}