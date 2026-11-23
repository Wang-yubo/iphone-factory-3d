import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { sim } from '@/sim/sim'

/**
 * 六轴工业机械臂（简化到 4 个可见关节）：
 * 底座法兰 → J1 转台 → J2 肩 → 大臂 → J3 肘 → 小臂 → J5 腕 → 二指夹爪
 *
 * 关节角由两连杆逆解算出，夹爪会真的落在工件上，而不是"对着空气摆姿势"。
 * 每个连杆几何体各自合并成一个 mesh（顶点色区分铝/深灰/橡胶），一条臂 7 个 draw call。
 */

const L1 = 0.62 // 大臂
const L2 = 0.62 // 小臂
const PIVOT_Y = 0.4 // 肩关节高度（相对臂底座）

/** 两连杆逆解：给定工件在臂坐标系里的 (y, z)，返回肩、肘角度 */
function solveIK(ty: number, tz: number) {
  const dy = ty - PIVOT_Y
  const d = Math.min(Math.hypot(dy, tz), L1 + L2 - 0.002)
  const phi = Math.atan2(tz, dy)
  const cosA = (d * d + L1 * L1 - L2 * L2) / (2 * d * L1)
  const cosB = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)
  const a = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1))
  const b = Math.acos(THREE.MathUtils.clamp(cosB, -1, 1))
  return { shoulder: phi - a, elbow: Math.PI - b }
}

const ALU = new THREE.Color('#ccd2d8')
const ALU_DARK = new THREE.Color('#9aa2aa')
const DARK = new THREE.Color('#343a41')
const STEEL = new THREE.Color('#8b949c')
const RUBBER = new THREE.Color('#161a1e')

function tint(g: THREE.BufferGeometry, c: THREE.Color) {
  const geo = g.index ? g.toNonIndexed() : g
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

const cyl = (list: THREE.BufferGeometry[], rTop: number, rBot: number, h: number, x: number, y: number, z: number, c: THREE.Color, axis: 'x' | 'y' | 'z' = 'y') => {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, 18)
  if (axis === 'x') g.rotateZ(Math.PI / 2)
  if (axis === 'z') g.rotateX(Math.PI / 2)
  g.translate(x, y, z)
  list.push(tint(g, c))
}

const box = (list: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number, c: THREE.Color) => {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  list.push(tint(g, c))
}

function merge(list: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(list, false)
  for (const g of list) g.dispose()
  return merged ?? list[0]
}

function buildArm(accent: string) {
  const C = new THREE.Color(accent)
  const base: THREE.BufferGeometry[] = []
  const turret: THREE.BufferGeometry[] = []
  const upper: THREE.BufferGeometry[] = []
  const fore: THREE.BufferGeometry[] = []
  const end: THREE.BufferGeometry[] = []

  // ---------- 底座法兰 ----------
  cyl(base, 0.215, 0.225, 0.028, 0, 0.014, 0, DARK)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    cyl(base, 0.014, 0.014, 0.014, Math.cos(a) * 0.178, 0.035, Math.sin(a) * 0.178, STEEL)
  }
  cyl(base, 0.178, 0.186, 0.1, 0, 0.078, 0, ALU)
  cyl(base, 0.16, 0.16, 0.012, 0, 0.133, 0, DARK)
  // 后侧出线口
  box(base, 0.1, 0.07, 0.06, 0, 0.06, -0.19, DARK)
  cyl(base, 0.028, 0.028, 0.03, 0, 0.06, -0.225, RUBBER, 'z')

  // ---------- J1 转台 ----------
  cyl(turret, 0.152, 0.158, 0.13, 0, 0.2, 0, ALU)
  cyl(turret, 0.155, 0.155, 0.014, 0, 0.272, 0, ALU_DARK)
  // 肩部叉架两侧颊板
  for (const sx of [-1, 1]) {
    box(turret, 0.045, 0.19, 0.17, sx * 0.115, 0.36, 0, ALU)
    cyl(turret, 0.062, 0.062, 0.03, sx * 0.15, 0.4, 0, DARK, 'x')
    cyl(turret, 0.045, 0.045, 0.014, sx * 0.168, 0.4, 0, C, 'x')
  }
  box(turret, 0.2, 0.03, 0.14, 0, 0.455, 0, DARK)
  // 转台侧面的伺服电机
  cyl(turret, 0.05, 0.05, 0.11, 0, 0.22, -0.16, DARK, 'z')
  cyl(turret, 0.038, 0.038, 0.02, 0, 0.22, -0.222, C, 'z')

  // ---------- 大臂（沿 +Y 伸出） ----------
  box(upper, 0.1, 0.6, 0.125, 0, 0.31, 0, ALU)
  for (const sx of [-1, 1]) box(upper, 0.014, 0.52, 0.095, sx * 0.055, 0.3, 0, ALU_DARK)
  // 筋板
  box(upper, 0.13, 0.02, 0.1, 0, 0.06, 0, DARK)
  box(upper, 0.115, 0.05, 0.14, 0, 0.6, 0, DARK)
  // 肘关节电机
  cyl(upper, 0.072, 0.072, 0.15, 0, 0.62, 0, ALU_DARK, 'x')
  cyl(upper, 0.078, 0.078, 0.018, 0.077, 0.62, 0, C, 'x')
  // 沿臂走的线束
  cyl(upper, 0.011, 0.011, 0.5, 0, 0.3, -0.075, RUBBER)
  cyl(upper, 0.009, 0.009, 0.5, 0.03, 0.3, -0.078, RUBBER)

  // ---------- 小臂 ----------
  box(fore, 0.085, 0.5, 0.105, 0, 0.28, 0, ALU)
  box(fore, 0.1, 0.02, 0.1, 0, 0.04, 0, DARK)
  // 腕部钟形壳
  cyl(fore, 0.055, 0.068, 0.09, 0, 0.565, 0, ALU_DARK)
  cyl(fore, 0.05, 0.05, 0.02, 0, 0.615, 0, STEEL)
  cyl(fore, 0.012, 0.012, 0.5, -0.05, 0.28, 0, RUBBER)

  // ---------- 腕 + 夹爪 ----------
  box(end, 0.1, 0.05, 0.12, 0, 0.03, 0, DARK)
  box(end, 0.12, 0.02, 0.03, 0, 0.045, 0.06, STEEL) // 导轨
  for (const sx of [-1, 1]) {
    box(end, 0.024, 0.09, 0.05, sx * 0.05, 0.1, 0.03, ALU_DARK)
  }
  cyl(end, 0.006, 0.006, 0.09, 0, 0.02, -0.06, RUBBER, 'z')

  return {
    base: merge(base),
    turret: merge(turret),
    upper: merge(upper),
    fore: merge(fore),
    end: merge(end),
  }
}

export function RobotArm({ accent, stationId }: { accent: string; stationId: number }) {
  const turretRef = useRef<THREE.Group>(null)
  const shoulderRef = useRef<THREE.Group>(null)
  const elbowRef = useRef<THREE.Group>(null)
  const wristRef = useRef<THREE.Group>(null)
  const fingerRefs = useRef<(THREE.Mesh | null)[]>([])

  const geo = useMemo(() => buildArm(accent), [accent])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.78, roughness: 0.32 }),
    [],
  )
  const fingerMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#2b3137', metalness: 0.6, roughness: 0.45 }),
    [],
  )

  useEffect(() => {
    const g = geo
    const m = mat
    const fm = fingerMat
    return () => {
      g.base.dispose()
      g.turret.dispose()
      g.upper.dispose()
      g.fore.dispose()
      g.end.dispose()
      m.dispose()
      fm.dispose()
    }
  }, [geo, mat, fingerMat])

  const pose = useRef({ shoulder: 0.4, elbow: 2.1, wrist: 0, grip: 0.05, yaw: 0 })

  useFrame((state, dt) => {
    const st = sim.stations[stationId - 1]
    const active = st.state === 'working'
    const t = state.clock.elapsedTime

    // 工作时探到工件上方；空闲收回
    const targetY = active ? 0.17 : 0.52
    const targetZ = active ? 0.94 : 0.44
    const ik = solveIK(targetY, targetZ)

    const k = Math.min(1, dt * 7)
    pose.current.shoulder += (ik.shoulder - pose.current.shoulder) * k
    pose.current.elbow += (ik.elbow - pose.current.elbow) * k
    // 腕部随工序轻微摆动，避免"死物"感
    const wristTarget = active ? Math.sin(t * 3 + stationId) * 0.35 : 0
    pose.current.wrist += (wristTarget - pose.current.wrist) * k
    // 夹爪开合
    const gripTarget = active ? 0.032 : 0.05
    pose.current.grip += (gripTarget - pose.current.grip) * Math.min(1, dt * 10)
    // 转台轻微跟随
    const yawTarget = active ? Math.sin(t * 1.6 + stationId) * 0.06 : 0
    pose.current.yaw += (yawTarget - pose.current.yaw) * Math.min(1, dt * 4)

    if (shoulderRef.current) shoulderRef.current.rotation.x = pose.current.shoulder
    if (elbowRef.current) elbowRef.current.rotation.x = pose.current.elbow
    if (wristRef.current) {
      wristRef.current.rotation.y = pose.current.wrist
      wristRef.current.rotation.z = pose.current.wrist * 0.4
    }
    if (turretRef.current) turretRef.current.rotation.y = pose.current.yaw

    fingerRefs.current.forEach((f, i) => {
      if (!f) return
      f.position.x = (i === 0 ? -1 : 1) * pose.current.grip
    })
  })

  return (
    <group position={[0, 1.12, -0.95]}>
      <mesh geometry={geo.base} material={mat} castShadow receiveShadow />

      <group ref={turretRef}>
        <mesh geometry={geo.turret} material={mat} castShadow receiveShadow />

        <group ref={shoulderRef} position={[0, PIVOT_Y, 0]}>
          <mesh geometry={geo.upper} material={mat} castShadow />

          <group ref={elbowRef} position={[0, 0.62, 0]}>
            <mesh geometry={geo.fore} material={mat} castShadow />

            <group ref={wristRef} position={[0, 0.625, 0]}>
              <mesh geometry={geo.end} material={mat} castShadow />

              {[0, 1].map((i) => (
                <mesh
                  key={i}
                  ref={(el) => {
                    fingerRefs.current[i] = el
                  }}
                  material={fingerMat}
                  position={[(i === 0 ? -1 : 1) * 0.05, 0.16, 0.03]}
                  castShadow
                >
                  <boxGeometry args={[0.022, 0.12, 0.05]} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}