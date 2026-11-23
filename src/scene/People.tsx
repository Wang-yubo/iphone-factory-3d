import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { COL, box, cyl, merge, tint, tintedMaterial } from './geo'

/**
 * 车间里的作业人员：两名走动的巡检/搬运工，两名在工位前的操作工。
 * 剪影级别的低模（圆头 + 方身），靠姿态和动作传达"有人在干活"。
 */

const SKIN = new THREE.Color('#d9b79a')
const SHIRT = new THREE.Color('#9fb0c2')
const SHIRT_DARK = new THREE.Color('#7f90a2')
const PANTS = new THREE.Color('#39434f')
const SHOE = new THREE.Color('#161a1f')
const HAIR = new THREE.Color('#2a2320')
const CAP = new THREE.Color('#5d6b7a')

/** 躯干 + 头 + 手臂 + 鞋（合并成一个 mesh） */
function bodyGeometry(withCap: boolean) {
  const p: THREE.BufferGeometry[] = []
  // 胯 + 躯干
  box(p, 0.3, 0.16, 0.2, 0, 0.86, 0, PANTS)
  box(p, 0.34, 0.5, 0.22, 0, 1.16, 0, SHIRT)
  // 胸前工牌
  box(p, 0.08, 0.1, 0.01, 0.02, 1.22, 0.115, COL.aluDark)
  // 肩部斜线
  box(p, 0.36, 0.04, 0.24, 0, 1.4, 0, SHIRT_DARK)
  // 手臂
  for (const sx of [-1, 1]) {
    box(p, 0.085, 0.4, 0.1, sx * 0.215, 1.15, 0, SHIRT_DARK)
    box(p, 0.075, 0.12, 0.09, sx * 0.215, 0.92, 0, SKIN)
  }
  // 脖子 + 头
  cyl(p, 0.043, 0.07, 0, 1.44, 0, SKIN, 'y', 10)
  const head = new THREE.SphereGeometry(0.098, 14, 12)
  head.translate(0, 1.53, 0)
  p.push(tint(head, SKIN))
  if (withCap) {
    const cap = new THREE.SphereGeometry(0.104, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5)
    cap.translate(0, 1.54, 0)
    p.push(tint(cap, CAP))
    box(p, 0.16, 0.02, 0.09, 0, 1.55, 0.11, CAP)
  } else {
    const hair = new THREE.SphereGeometry(0.101, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45)
    hair.translate(0, 1.545, -0.005)
    p.push(tint(hair, HAIR))
  }
  return merge(p)
}

/** 单条腿（以髋为原点向下） */
function legGeometry() {
  const p: THREE.BufferGeometry[] = []
  box(p, 0.13, 0.76, 0.15, 0, -0.38, 0, PANTS)
  box(p, 0.115, 0.075, 0.24, 0, -0.79, 0.045, SHOE)
  return merge(p)
}

function useWorkerAssets(withCap: boolean) {
  const body = useMemo(() => bodyGeometry(withCap), [withCap])
  const leg = useMemo(legGeometry, [])
  const mat = tintedMaterial()
  useEffect(() => {
    return () => {
      body.dispose()
      leg.dispose()
    }
  }, [body, leg])
  return { body, leg, mat }
}

interface WalkerProps {
  from: number
  to: number
  z: number
  speed: number
  offset: number
  cap?: boolean
}

/** 沿通道往返走动的人 */
export function Walker({ from, to, z, speed, offset, cap = true }: WalkerProps) {
  const { body, leg, mat } = useWorkerAssets(cap)
  const group = useRef<THREE.Group>(null)
  const hipL = useRef<THREE.Group>(null)
  const hipR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)

  useFrame((st) => {
    const t = st.clock.elapsedTime * speed + offset
    const span = to - from
    const cycle = ((t % (span * 2)) + span * 2) % (span * 2)
    const forward = cycle < span
    const x = from + (forward ? cycle : span * 2 - cycle)

    if (group.current) {
      group.current.position.set(x, Math.abs(Math.cos(t * 6)) * 0.012, z)
      // 模型正面朝 +Z，转向行走方向
      group.current.rotation.y = forward ? Math.PI / 2 : -Math.PI / 2
    }
    const swing = Math.sin(t * 6) * 0.45
    if (hipL.current) hipL.current.rotation.x = swing
    if (hipR.current) hipR.current.rotation.x = -swing
    if (armL.current) armL.current.rotation.x = -swing * 0.7
    if (armR.current) armR.current.rotation.x = swing * 0.7
  })

  return (
    <group ref={group}>
      <mesh geometry={body} material={mat} castShadow />
      <group ref={hipL} position={[-0.085, 0.78, 0]}>
        <mesh geometry={leg} material={mat} castShadow />
      </group>
      <group ref={hipR} position={[0.085, 0.78, 0]}>
        <mesh geometry={leg} material={mat} castShadow />
      </group>
      {/* 手臂用独立的小 mesh 做摆动 */}
      <group ref={armL} position={[-0.215, 1.35, 0]}>
        <mesh material={mat} castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.085, 0.4, 0.1]} />
        </mesh>
      </group>
      <group ref={armR} position={[0.215, 1.35, 0]}>
        <mesh material={mat} castShadow position={[0, -0.2, 0]}>
          <boxGeometry args={[0.085, 0.4, 0.1]} />
        </mesh>
      </group>
    </group>
  )
}

/** 站在工位前操作的人（轻微侧身、偶尔点头） */
export function StandingWorker({
  x,
  z,
  facing = Math.PI,
  cap = false,
  phase = 0,
}: {
  x: number
  z: number
  facing?: number
  cap?: boolean
  phase?: number
}) {
  const { body, leg, mat } = useWorkerAssets(cap)
  const group = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)

  useFrame((st) => {
    const t = st.clock.elapsedTime + phase
    if (group.current) {
      group.current.position.set(x, 0, z)
      group.current.rotation.y = facing + Math.sin(t * 0.4) * 0.12
    }
    if (torso.current) {
      torso.current.rotation.x = Math.sin(t * 1.3) * 0.035 + 0.04
    }
  })

  return (
    <group ref={group}>
      <group ref={torso}>
        <mesh geometry={body} material={mat} castShadow />
      </group>
      <mesh geometry={leg} material={mat} castShadow position={[-0.085, 0.78, 0]} />
      <mesh geometry={leg} material={mat} castShadow position={[0.085, 0.78, 0]} />
    </group>
  )
}

/** 车间人员布置 */
export function People() {
  return (
    <group>
      {/* 通道里的两名走动人员，错开相位 */}
      <Walker from={-10.5} to={8.5} z={4.1} speed={0.62} offset={0} cap />
      <Walker from={-6} to={10} z={3.55} speed={0.48} offset={22} cap={false} />
      {/* 工位前的操作工：S3 与 S6 */}
      <StandingWorker x={-3 + 1.25} z={1.95} facing={Math.PI * 0.82} phase={1.2} />
      <StandingWorker x={6 + 1.25} z={1.95} facing={Math.PI * 0.9} phase={3.4} cap />
      {/* 工作台前的配料员 */}
      <StandingWorker x={-11.6} z={4.9} facing={Math.PI} phase={5.1} cap />
    </group>
  )
}