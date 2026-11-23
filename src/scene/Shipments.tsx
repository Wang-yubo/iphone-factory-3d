import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { MATS } from '@/lib/materials'
import { sim } from '@/sim/sim'

const POOL = 4

/** 成品从线尾飞向货架的动画 */
export function Shipments() {
  const meshes = useRef<(THREE.Mesh | null)[]>([])

  useFrame(() => {
    for (let i = 0; i < POOL; i++) {
      const m = meshes.current[i]
      if (!m) continue
      const sh = sim.shipments[i]
      if (!sh) {
        m.visible = false
        continue
      }
      m.visible = true
      m.position.set(sh.x, sh.y, sh.z)
      const k = Math.min(1, sh.t / sh.dur)
      m.rotation.set(Math.sin(k * Math.PI) * 0.9, k * 1.2, Math.sin(k * Math.PI) * 0.5)
      m.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.12)
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
          material={MATS.glow('#f4f8fc', 0.25)}
          castShadow
        >
          <boxGeometry args={[0.36, 0.08, 0.2]} />
        </mesh>
      ))}
    </group>
  )
}
