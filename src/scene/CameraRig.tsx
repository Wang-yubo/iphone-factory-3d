import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ComponentRef } from 'react'
import * as THREE from 'three'
import { CAMERA_PRESETS, stationPreset, stationX } from '@/lib/layout'
import { STATIONS } from '@/sim/recipes'
import { useFactory, type ViewKey } from '@/store/useFactory'

const DURATION = 0.85

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

interface Preset {
  pos: [number, number, number]
  target: [number, number, number]
}

function resolvePreset(view: ViewKey): Preset | null {
  if (view === 'free') return null
  if (view.startsWith('s')) {
    const id = Number(view.slice(1))
    const index = STATIONS.findIndex((s) => s.id === id)
    return index < 0 ? null : stationPreset(stationX(index))
  }
  return CAMERA_PRESETS[view as keyof typeof CAMERA_PRESETS] ?? null
}

/**
 * 相机：OrbitControls + 预设机位缓动。
 * 用户一旦手动拖拽，立即退出预设状态（HUD 机位按钮取消高亮）。
 */
export function CameraRig() {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const camera = useThree((s) => s.camera)
  const view = useFactory((s) => s.view)
  const setView = useFactory((s) => s.setView)

  const anim = useRef<{
    fromPos: THREE.Vector3
    toPos: THREE.Vector3
    fromTgt: THREE.Vector3
    toTgt: THREE.Vector3
    t: number
  } | null>(null)

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const preset = resolvePreset(view)
    if (!preset) return

    anim.current = {
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(...preset.pos),
      fromTgt: c.target.clone(),
      toTgt: new THREE.Vector3(...preset.target),
      t: 0,
    }
    c.enabled = false
  }, [view, camera])

  useFrame((_, delta) => {
    const a = anim.current
    const c = controls.current
    if (!a || !c) return

    a.t = Math.min(1, a.t + delta / DURATION)
    const k = easeInOutCubic(a.t)

    camera.position.lerpVectors(a.fromPos, a.toPos, k)
    c.target.lerpVectors(a.fromTgt, a.toTgt, k)
    camera.lookAt(c.target)
    c.update()

    if (a.t >= 1) {
      anim.current = null
      c.enabled = true
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      enablePan
      panSpeed={0.8}
      rotateSpeed={0.65}
      zoomSpeed={0.8}
      minDistance={3.2}
      maxDistance={34}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI / 2 - 0.06}
      onStart={() => {
        if (anim.current) {
          anim.current = null
          if (controls.current) controls.current.enabled = true
        }
        if (useFactory.getState().view !== 'free') setView('free')
      }}
    />
  )
}