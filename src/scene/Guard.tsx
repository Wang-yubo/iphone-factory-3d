import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * 保安（Blender 程序化建模，见 scripts/blender_guard.py）。
 * 模型是分件导出的：legL/legR/armL/armR 的原点就在髋/肩关节上，
 * 所以直接按名字取节点旋转就能走路。
 */

const GUARD = './models/guard.glb'
useGLTF.preload(GUARD)

interface Rig {
  root: THREE.Object3D
  legL: THREE.Object3D | null
  legR: THREE.Object3D | null
  armL: THREE.Object3D | null
  armR: THREE.Object3D | null
}

function buildRig(scene: THREE.Object3D): Rig {
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
  }
}

/** 巡逻：沿通道往返，摆腿摆臂 */
export function PatrolGuard({
  from,
  to,
  z,
  speed = 0.55,
  offset = 0,
}: {
  from: number
  to: number
  z: number
  speed?: number
  offset?: number
}) {
  const { scene } = useGLTF(GUARD)
  const rig = useMemo(() => buildRig(scene), [scene])
  const group = useRef<THREE.Group>(null)
  const phase = useRef(offset)

  useEffect(() => {
    return () => {
      rig.root.parent?.remove(rig.root)
    }
  }, [rig])

  useFrame((_, dt) => {
    const span = to - from
    phase.current += dt * speed
    const cycle = ((phase.current % (span * 2)) + span * 2) % (span * 2)
    const forward = cycle < span
    const x = from + (forward ? cycle : span * 2 - cycle)

    if (group.current) {
      group.current.position.x = x
    }
    rig.root.rotation.y = forward ? Math.PI / 2 : -Math.PI / 2
    // 走路节奏
    const t = phase.current * 7.5
    const swing = Math.sin(t) * 0.5
    if (rig.legL) rig.legL.rotation.x = swing
    if (rig.legR) rig.legR.rotation.x = -swing
    if (rig.armL) rig.armL.rotation.x = -swing * 0.55
    if (rig.armR) rig.armR.rotation.x = swing * 0.55
    rig.root.position.y = Math.abs(Math.cos(t)) * 0.018
    rig.root.rotation.z = Math.sin(t) * 0.012
  })

  return (
    <group ref={group} position={[from, 0, z]}>
      <primitive object={rig.root} />
    </group>
  )
}

/** 站岗：微微转动身体、偶尔换重心 */
export function StandingGuard({
  x,
  z,
  facing = 0,
  phase = 0,
}: {
  x: number
  z: number
  facing?: number
  phase?: number
}) {
  const { scene } = useGLTF(GUARD)
  const rig = useMemo(() => buildRig(scene), [scene])
  const group = useRef<THREE.Group>(null)

  useEffect(() => {
    return () => {
      rig.root.parent?.remove(rig.root)
    }
  }, [rig])

  useFrame((st) => {
    const t = st.clock.elapsedTime + phase
    if (group.current) {
      group.current.position.set(x, Math.sin(t * 0.9) * 0.004, z)
      group.current.rotation.y = facing + Math.sin(t * 0.22) * 0.16
    }
    // 换重心的微动作
    rig.root.rotation.z = Math.sin(t * 0.55) * 0.012
    if (rig.armL) rig.armL.rotation.x = Math.sin(t * 0.4) * 0.03
    if (rig.armR) rig.armR.rotation.x = -Math.sin(t * 0.4 + 1) * 0.03
  })

  return (
    <group ref={group} position={[x, 0, z]} rotation={[0, facing, 0]}>
      <primitive object={rig.root} />
    </group>
  )
}

export function Guards() {
  return (
    <group>
      {/* 通道里的巡逻保安 */}
      <PatrolGuard from={-10} to={9.5} z={6.15} speed={0.52} offset={6} />
      {/* 后门口站岗 */}
      <StandingGuard x={-5.6} z={-7.4} facing={0} phase={2.1} />
    </group>
  )
}
