import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { LINE } from '@/lib/layout'
import { MATS } from '@/lib/materials'
import { C } from '@/lib/palette'
import { BELT_SPEED } from '@/sim/engine'
import { useFactory } from '@/store/useFactory'

const LEN = LINE.x1 - LINE.x0
const HALF_W = LINE.beltW / 2

/** 程序化生成皮带纹理：斜向人字纹，运行时无外部贴图 */
function useBeltTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = '#14171c'
    g.fillRect(0, 0, 128, 128)

    g.strokeStyle = '#1d232a'
    g.lineWidth = 6
    for (let i = -128; i < 256; i += 32) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i + 128, 128)
      g.stroke()
    }
    // 中间的导向细线
    g.strokeStyle = '#242b33'
    g.lineWidth = 2
    for (let i = -128; i < 256; i += 32) {
      g.beginPath()
      g.moveTo(i + 8, 0)
      g.lineTo(i + 136, 128)
      g.stroke()
    }

    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(LEN / 0.9, 1)
    tex.anisotropy = 4
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

export function Conveyor() {
  const tex = useBeltTexture()
  const cx = (LINE.x0 + LINE.x1) / 2

  // 皮带纹理滚动：跑得越快，人字纹走得越快
  useFrame((_, dt) => {
    const { lineState, speed } = useFactory.getState()
    if (lineState !== 'running') return
    tex.offset.x -= (BELT_SPEED * speed * dt) / 0.9
  })

  return (
    <group position={[cx, 0, 0]}>
      {/* 带面 */}
      <mesh position={[0, LINE.beltY + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[LEN, LINE.beltW]} />
        <meshStandardMaterial map={tex} roughness={0.95} metalness={0.04} />
      </mesh>

      {/* 带体 */}
      <mesh position={[0, LINE.beltY - 0.04, 0]} material={MATS.rubber()} castShadow receiveShadow>
        <boxGeometry args={[LEN, 0.07, LINE.beltW]} />
      </mesh>

      {/* 两侧导轨 */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[0, LINE.beltY + 0.035, s * (HALF_W + 0.025)]}
          material={MATS.aluminum()}
          castShadow
        >
          <boxGeometry args={[LEN, 0.055, 0.035]} />
        </mesh>
      ))}

      {/* 侧裙板 */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[0, LINE.beltY - 0.16, s * (HALF_W + 0.03)]}
          material={MATS.aluminumDark()}
          receiveShadow
        >
          <boxGeometry args={[LEN, 0.2, 0.035]} />
        </mesh>
      ))}

      {/* 支撑腿（成对） */}
      {[-1, 1].map((side) =>
        [LINE.x0 + 0.55, LINE.x1 - 0.55].map((legX) => (
          <group key={`${side}-${legX}`} position={[legX - cx, 0, side * 0.36]}>
            <mesh position={[0, (LINE.beltY - 0.16) / 2, 0]} material={MATS.darkSteel()} castShadow>
              <boxGeometry args={[0.07, LINE.beltY - 0.16, 0.07]} />
            </mesh>
            <mesh position={[0, 0.02, -side * 0.18]} material={MATS.darkSteel()}>
              <boxGeometry args={[0.16, 0.04, 0.44]} />
            </mesh>
          </group>
        )),
      )}

      {/* 两端驱动/张紧装置 */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (LEN / 2 - 0.06), 0, 0]}>
          <mesh position={[0, LINE.beltY - 0.06, 0]} rotation={[0, 0, Math.PI / 2]} material={MATS.darkSteel()}>
            <cylinderGeometry args={[0.11, 0.11, LINE.beltW + 0.1, 20]} />
          </mesh>
          <mesh position={[0, LINE.beltY - 0.34, 0]} material={MATS.steel()} castShadow>
            <boxGeometry args={[0.24, 0.5, LINE.beltW + 0.22]} />
          </mesh>
          <mesh position={[s * 0.06, LINE.beltY - 0.34, 0.3]} material={MATS.glow(C.accent, 0.9)}>
            <boxGeometry args={[0.03, 0.05, 0.05]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}