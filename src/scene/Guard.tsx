import { useGLTF } from '@react-three/drei'
import { useFactory } from '@/store/useFactory'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * 安保人员：外部绑定角色（Mixamo 骨骼 + Idle/Walk 动作），
 * 用 SkeletonUtils 克隆才能让每个实例有独立的骨骼状态。
 *
 * 说明：模型来自 three.js 示例资源（Mixamo 系），是"装甲特勤"形象，
 * 不是便服保安。程序化的便服保安脚本仍保留在 scripts/blender_guard.py。
 */

const URL = './models/security.glb'
useGLTF.preload(URL)

/**
 * 角色在 glTF 里正面朝 -Z（由面罩的世界坐标验算得出），
 * 所以要转到本项目约定（正面朝 +Z）需要额外转 180°。
 * 注意：巡逻时目标朝向是 ±X，符号不能写反，否则会倒着走。
 */
const MODEL_FACING = Math.PI

function useActor() {
  const { scene, animations } = useGLTF(URL) as unknown as {
    scene: THREE.Object3D
    animations: THREE.AnimationClip[]
  }
  const actor = useMemo(() => {
    const root = skeletonClone(scene)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
        m.frustumCulled = false
      }
    })
    const mixer = new THREE.AnimationMixer(root)
    const clips = Object.fromEntries(animations.map((c) => [c.name, c]))
    return { root, mixer, clips }
  }, [scene, animations])

  useEffect(() => {
    return () => {
      actor.mixer.stopAllAction()
      actor.root.parent?.remove(actor.root)
    }
  }, [actor])

  return actor
}

/** 巡逻：沿通道往返，播放 Walk */
export function PatrolGuard({
  from,
  to,
  z,
  speed = 0.85,
  offset = 0,
}: {
  from: number
  to: number
  z: number
  speed?: number
  offset?: number
}) {
  const { root, mixer, clips } = useActor()
  const group = useRef<THREE.Group>(null)
  const phase = useRef(offset)

  useEffect(() => {
    const walk = clips.Walk ?? clips.Idle
    if (!walk) return
    const action = mixer.clipAction(walk)
    action.play()
    return () => {
      action.stop()
    }
  }, [mixer, clips])

  useFrame((_, dt) => {
    const span = to - from
    phase.current += dt * speed
    const cycle = ((phase.current % (span * 2)) + span * 2) % (span * 2)
    const forward = cycle < span
    const x = from + (forward ? cycle : span * 2 - cycle)

    if (group.current) group.current.position.x = x
    // 朝向：正面（-Z）先转到 +Z，再按行进方向转 ±90°
    root.rotation.y = MODEL_FACING + (forward ? Math.PI / 2 : -Math.PI / 2)
    mixer.update(dt)
  })

  return (
    <group
      ref={group}
      position={[from, 0, z]}
      onClick={(e) => {
        e.stopPropagation()
        const g = group.current
        if (g) useFactory.getState().focusActorAt(g.position.x, z, '安保 · 巡逻岗')
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <primitive object={root} />
    </group>
  )
}

/** 站岗：播放 Idle，身体随时间轻微转向 */
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
  const { root, mixer, clips } = useActor()
  const group = useRef<THREE.Group>(null)

  useEffect(() => {
    const idle = clips.Idle ?? clips.Walk
    if (!idle) return
    const action = mixer.clipAction(idle)
    action.play()
    return () => {
      action.stop()
    }
  }, [mixer, clips])

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime + phase
    if (group.current) {
      group.current.rotation.y = facing + Math.sin(t * 0.22) * 0.14
    }
    root.rotation.y = MODEL_FACING
    mixer.update(dt)
  })

  return (
    <group
      ref={group}
      position={[x, 0, z]}
      rotation={[0, facing, 0]}
      onClick={(e) => {
        e.stopPropagation()
        useFactory.getState().focusActorAt(x, z, '安保 · 后门岗')
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <primitive object={root} />
    </group>
  )
}

export function Guards() {
  return (
    <group>
      <PatrolGuard from={-10} to={9.5} z={6.15} speed={0.85} offset={6} />
      <StandingGuard x={-5.6} z={-7.4} facing={0} phase={2.1} />
    </group>
  )
}
