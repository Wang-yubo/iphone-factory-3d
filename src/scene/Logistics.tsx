import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { COL, box, cyl, merge, tintedMaterial } from './geo'

/**
 * 车间里的动态件：
 *  - AGV 沿前场通道往返，在两端装卸停留
 *  - 老化测试架 12 个机位轮流点亮（模拟测试周期）
 *  - 卷帘门下方的透光光斑
 */

// ---------------- AGV ----------------

const PATH = { x0: -13.2, x1: 10.8, z0: 4.9, z1: 6.9 }
const SPEED = 1.15
const DWELL = 3.2

function agvGeometry() {
  const p: THREE.BufferGeometry[] = []
  // 车体
  box(p, 0.92, 0.24, 0.66, 0, 0.18, 0, new THREE.Color('#3d4650'))
  box(p, 0.98, 0.05, 0.72, 0, 0.325, 0, new THREE.Color('#c2c9d0'))
  // 防撞条
  box(p, 0.06, 0.1, 0.68, 0.48, 0.15, 0, COL.yellow)
  box(p, 0.06, 0.1, 0.68, -0.48, 0.15, 0, COL.yellow)
  // 托盘 + 货箱
  box(p, 0.78, 0.06, 0.58, 0, 0.37, 0, COL.wood)
  box(p, 0.5, 0.32, 0.4, -0.08, 0.56, 0, COL.aluDark)
  box(p, 0.44, 0.26, 0.34, 0.12, 0.42, 0.02, COL.steel)
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

/** 圆角矩形巡游路径：前沿向东，末端折返，后排向西 */
function pathPoint(dist: number) {
  const w = PATH.x1 - PATH.x0
  const h = PATH.z1 - PATH.z0
  const perim = 2 * (w + h)
  let d = dist % perim
  const corners = [w, w + h, 2 * w + h, perim]

  if (d <= corners[0]) return { x: PATH.x0 + d, z: PATH.z0, dir: 0 }
  d -= corners[0]
  if (d <= corners[1]) return { x: PATH.x1, z: PATH.z0 + d, dir: Math.PI / 2 }
  d -= corners[1]
  if (d <= corners[2]) return { x: PATH.x1 - d, z: PATH.z1, dir: Math.PI }
  d -= corners[2]
  return { x: PATH.x0, z: PATH.z1 - d, dir: -Math.PI / 2 }
}

export function Agv() {
  const body = agvGeometry()
  const wheels = agvWheels()
  const mat = tintedMaterial()
  const group = useRef<THREE.Group>(null)
  const wheelRef = useRef<THREE.Mesh>(null)
  const lamp = useRef<THREE.Mesh>(null)
  const state = useRef({ dist: 0, rot: 0, dwell: 0 })

  const lampMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ffb020', emissiveIntensity: 1.4, roughness: 0.4 }),
    [],
  )

  useEffect(() => {
    return () => {
      body.dispose()
      wheels.dispose()
      lampMat.dispose()
    }
  }, [body, wheels, lampMat])

  useFrame((st, dt) => {
    const s = state.current
    const d = Math.min(dt, 0.1)

    if (s.dwell > 0) {
      s.dwell -= d
    } else {
      const w = PATH.x1 - PATH.x0
      const perim = 2 * (w + PATH.z1 - PATH.z0)
      const p0 = s.dist % perim
      s.dist += SPEED * d
      const p1 = s.dist % perim
      // 跨过站点阈值就停一次（装卸），任何帧率都不会漏判
      for (const stop of [w, 2 * w + (PATH.z1 - PATH.z0)]) {
        const crossed = p1 >= p0 ? p0 < stop && p1 >= stop : p0 < stop || p1 >= stop
        if (crossed) s.dwell = DWELL
      }
    }

    const pos = pathPoint(s.dist)
    if (group.current) {
      group.current.position.set(pos.x, 0, pos.z)
      // 车头平滑转向（+X 为车头方向）
      const target = pos.dir
      let diff = target - s.rot
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      s.rot += diff * Math.min(1, d * 6)
      group.current.rotation.y = s.rot
    }
    if (wheelRef.current) wheelRef.current.rotation.z = -s.dist / 0.095
    if (lamp.current) {
      const m = lamp.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 0.7 + Math.sin(st.clock.elapsedTime * 6) * 0.6
    }
  })

  return (
    <group ref={group}>
      <mesh geometry={body} material={mat} castShadow receiveShadow />
      <mesh ref={wheelRef} geometry={wheels} material={mat} />
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