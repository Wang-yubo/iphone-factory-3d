import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { stationX } from '@/lib/layout'
import { mat, MATS } from '@/lib/materials'
import { C } from '@/lib/palette'
import { sim } from '@/sim/sim'
import { STATIONS } from '@/sim/recipes'
import { useFactory } from '@/store/useFactory'

/** 暗红注塑箱体 */
const matBin = () => mat('#3c2022', { roughness: 0.55, metalness: 0.2 })

/** 每个工站正面右侧一只不良品回收箱 */
export function ScrapBin({ index }: { index: number }) {
  const x = stationX(index) + 0.66
  const version = useFactory((s) => s.simVersion)
  const defects = sim.stations[index]?.defects ?? 0
  void version

  return (
    <group position={[x, 0.16, 1.02]}>
      {/* 箱体 */}
      <mesh material={matBin()} castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.32, 0.34]} />
      </mesh>
      {/* 喇叭口 */}
      <mesh position={[0, 0.2, 0]} material={MATS.darkSteel()}>
        <cylinderGeometry args={[0.19, 0.13, 0.12, 4, 1, true]} />
      </mesh>
      {/* 内壁红光 */}
      <mesh position={[0, 0.16, 0]} material={MATS.glow(C.danger, 0.8)}>
        <boxGeometry args={[0.28, 0.02, 0.28]} />
      </mesh>
      {defects > 0 && (
        <Html position={[0, 0.34, 0]} center style={{ pointerEvents: 'none', userSelect: 'none' }} zIndexRange={[15, 0]}>
          <div className="scrap-tag">{defects}</div>
        </Html>
      )}
    </group>
  )
}

const POOL = 6

/** 不良品飞向回收箱的动画（位置由状态机算好，这里只负责画） */
export function ScrapUnits() {
  const meshes = useRef<(THREE.Mesh | null)[]>([])

  useFrame(() => {
    for (let i = 0; i < POOL; i++) {
      const m = meshes.current[i]
      if (!m) continue
      const sc = sim.scraps[i]
      if (!sc) {
        m.visible = false
        continue
      }
      m.visible = true
      m.position.set(sc.x, sc.y, sc.z)
      const k = Math.min(1, sc.t / sc.dur)
      m.rotation.x = k * 2.2
      m.scale.setScalar(1 - k * 0.25)
    }
  })

  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el
          }}
          visible={false}
          material={MATS.glow(C.danger, 0.35)}
        >
          <boxGeometry args={[0.34, 0.07, 0.19]} />
        </mesh>
      ))}
    </group>
  )
}

export function ScrapArea() {
  return (
    <group>
      {STATIONS.map((s, i) => (
        <ScrapBin key={s.id} index={i} />
      ))}
      <ScrapUnits />
    </group>
  )
}

