import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFactory } from '@/store/useFactory'

/**
 * 具身智能机器人（Blender 参数化建模，见 scripts/blender_robot.py）。
 * 分件导出，legL/legR/armL/armR/head 的原点就在关节上，
 * 所以按节点名旋转即可做出走路的摆腿摆臂和转头。
 */

const URL = './models/robot.glb'
useGLTF.preload(URL)

/** 模型脚底略高于地面 0.025m，落到地面需要下移 */
const FOOT_OFFSET = -0.025

interface Rig {
  root: THREE.Object3D
  legL: THREE.Object3D | null
  legR: THREE.Object3D | null
  armL: THREE.Object3D | null
  armR: THREE.Object3D | null
  head: THREE.Object3D | null
}

function useRobot() {
  const { scene } = useGLTF(URL) as unknown as { scene: THREE.Object3D }
  const rig = useMemo<Rig>(() => {
    const root = scene.clone(true)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    return {
      root,
      legL: root.getObjectByName('legL') ?? null,
      legR: root.getObjectByName('legR') ?? null,
      armL: root.getObjectByName('armL') ?? null,
      armR: root.getObjectByName('armR') ?? null,
      head: root.getObjectByName('head') ?? null,
    }
  }, [scene])

  useEffect(() => {
    return () => {
      rig.root.parent?.remove(rig.root)
    }
  }, [rig])

  return rig
}

/** 行走的机器人 */
export function RobotWalker({
  from,
  to,
  z,
  speed = 0.75,
  offset = 0,
  label = '协作机器人',
}: {
  from: number
  to: number
  z: number
  speed?: number
  offset?: number
  label?: string
}) {
  const rig = useRobot()
  const group = useRef<THREE.Group>(null)
  const phase = useRef(offset)

  useFrame((_, dt) => {
    const span = to - from
    phase.current += dt * speed
    const cycle = ((phase.current % (span * 2)) + span * 2) % (span * 2)
    const forward = cycle < span
    const x = from + (forward ? cycle : span * 2 - cycle)

    if (group.current) {
      group.current.position.set(x, FOOT_OFFSET + Math.abs(Math.cos(phase.current * 7)) * 0.012, z)
      group.current.rotation.y = forward ? Math.PI / 2 : -Math.PI / 2
    }

    const t = phase.current * 7
    const swing = Math.sin(t) * 0.42
    if (rig.legL) rig.legL.rotation.x = swing
    if (rig.legR) rig.legR.rotation.x = -swing
    if (rig.armL) rig.armL.rotation.x = -swing * 0.62
    if (rig.armR) rig.armR.rotation.x = swing * 0.62
    if (rig.head) {
      rig.head.rotation.y = Math.sin(t * 0.35) * 0.12
      rig.head.rotation.x = -0.04 + Math.sin(t * 0.5) * 0.02
    }
  })

  return (
    <group
      ref={group}
      position={[from, FOOT_OFFSET, z]}
      onClick={(e) => {
        e.stopPropagation()
        const g = group.current
        if (g) useFactory.getState().focusActorAt(g.position.x, z, label)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <primitive object={rig.root} />
    </group>
  )
}

/** 在工位旁值守的机器人 */
export function RobotStanding({
  x,
  z,
  facing = 0,
  phase = 0,
  label = '协作机器人',
}: {
  x: number
  z: number
  facing?: number
  phase?: number
  label?: string
}) {
  const rig = useRobot()
  const group = useRef<THREE.Group>(null)

  useFrame((st) => {
    const t = st.clock.elapsedTime + phase
    if (group.current) {
      group.current.position.set(x, FOOT_OFFSET + Math.sin(t * 1.4) * 0.006, z)
      group.current.rotation.y = facing + Math.sin(t * 0.3) * 0.1
    }
    // 待机：头部缓慢扫视，手臂微动
    if (rig.head) {
      rig.head.rotation.y = Math.sin(t * 0.5) * 0.4
      rig.head.rotation.x = Math.sin(t * 0.33) * 0.08
    }
    if (rig.armL) rig.armL.rotation.x = Math.sin(t * 0.8) * 0.06 - 0.05
    if (rig.armR) rig.armR.rotation.x = Math.sin(t * 0.8 + 1.4) * 0.06 - 0.05
    if (rig.legL) rig.legL.rotation.x = 0
    if (rig.legR) rig.legR.rotation.x = 0
  })

  return (
    <group
      ref={group}
      position={[x, FOOT_OFFSET, z]}
      rotation={[0, facing, 0]}
      onClick={(e) => {
        e.stopPropagation()
        useFactory.getState().focusActorAt(x, z, label)
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <primitive object={rig.root} />
    </group>
  )
}

/** 车间里的机器人班组 */
export function People() {
  return (
    <group>
      <RobotWalker from={-10.5} to={8.5} z={4.1} speed={0.72} offset={0} label="协作机器人 · AGV-01" />
      <RobotWalker from={-6} to={10} z={3.5} speed={0.55} offset={22} label="协作机器人 · AGV-02" />
      <RobotStanding x={-3 + 1.3} z={1.95} facing={Math.PI * 0.86} phase={1.2} label="协作机器人 · S3 值守" />
      <RobotStanding x={6 + 1.3} z={1.95} facing={Math.PI * 0.92} phase={3.4} label="协作机器人 · S6 值守" />
    </group>
  )
}