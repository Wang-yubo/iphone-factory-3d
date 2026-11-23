import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { LINE } from '@/lib/layout'
import { BELT_SPEED } from '@/sim/engine'
import { useFactory } from '@/store/useFactory'
import { conveyorFrame } from './conveyorFrame'

const LEN = LINE.x1 - LINE.x0

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
    // 使用后的磨损痕迹
    g.strokeStyle = 'rgba(255,255,255,0.025)'
    g.lineWidth = 10
    for (let i = 0; i < 6; i++) {
      const y = 20 + i * 18
      g.beginPath()
      g.moveTo(0, y)
      g.lineTo(128, y + 3)
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
  const frame = conveyorFrame()
  const cx = (LINE.x0 + LINE.x1) / 2

  // 皮带纹理滚动：跑得越快，人字纹走得越快
  useFrame((_, dt) => {
    const { lineState, speed } = useFactory.getState()
    if (lineState !== 'running') return
    tex.offset.x -= (BELT_SPEED * speed * dt) / 0.9
  })

  return (
    <group>
      {/* 机架：侧框 / 支腿 / 导条 / 驱动 / 控制盒 / 桥架，全部合并成 1 个 mesh */}
      <mesh geometry={frame.geometry} material={frame.material} castShadow receiveShadow />

      {/* 带面 */}
      <mesh position={[cx, LINE.beltY + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[LEN, LINE.beltW]} />
        <meshStandardMaterial map={tex} roughness={0.94} metalness={0.05} />
      </mesh>
    </group>
  )
}
