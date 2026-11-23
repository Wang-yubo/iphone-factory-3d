import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { LINE } from '@/lib/layout'
import { sim } from '@/sim/sim'
import type { ItemId } from '@/sim/recipes'

const POOL = 30

interface Form {
  /** 主体尺寸与圆角 */
  w: number
  h: number
  d: number
  r: number
  color: string
  metalness: number
  roughness: number
  /** 顶面屏/窗口 */
  screen?: {
    /** 相对主体的缩进比例 */
    inset: number
    color: string
    emissive: string
    intensity: number
  }
}

/**
 * 在制品外形：从铝锭到成品手机，每一站都能一眼看出"做到哪了"。
 * 主体用圆角盒（真实手机的圆角），屏幕是顶面一层薄片——主相机是俯视的，正好看得见。
 */
const FORMS: Record<ItemId, Form> = {
  aluminum: { w: 0.3, h: 0.1, d: 0.18, r: 0.02, color: '#c3c9d0', metalness: 0.85, roughness: 0.3 },
  shell: {
    w: 0.34,
    h: 0.05,
    d: 0.19,
    r: 0.028,
    color: '#c9ced4',
    metalness: 0.8,
    roughness: 0.3,
    screen: { inset: 0.72, color: '#2a2f35', emissive: '#0a0d10', intensity: 0.15 },
  },
  boardAssy: {
    w: 0.3,
    h: 0.02,
    d: 0.16,
    r: 0.006,
    color: '#1f6f4a',
    metalness: 0.15,
    roughness: 0.7,
    screen: { inset: 0.45, color: '#d9b45b', emissive: '#a97f22', intensity: 0.4 },
  },
  displayAssy: {
    w: 0.34,
    h: 0.07,
    d: 0.19,
    r: 0.026,
    color: '#b9c3cd',
    metalness: 0.75,
    roughness: 0.32,
    screen: { inset: 0.84, color: '#0b2030', emissive: '#2fb8ff', intensity: 0.35 },
  },
  batteryAssy: {
    w: 0.35,
    h: 0.08,
    d: 0.19,
    r: 0.026,
    color: '#3a4149',
    metalness: 0.4,
    roughness: 0.5,
    screen: { inset: 0.84, color: '#0b2030', emissive: '#2fb8ff', intensity: 0.5 },
  },
  phoneBody: {
    w: 0.35,
    h: 0.08,
    d: 0.19,
    r: 0.026,
    color: '#e6ebf0',
    metalness: 0.5,
    roughness: 0.35,
    screen: { inset: 0.84, color: '#0d2537', emissive: '#43c8ff', intensity: 0.7 },
  },
  phoneOk: {
    w: 0.36,
    h: 0.075,
    d: 0.2,
    r: 0.028,
    color: '#eef3f8',
    metalness: 0.45,
    roughness: 0.3,
    screen: { inset: 0.86, color: '#0e2a3d', emissive: '#54d6ff', intensity: 0.9 },
  },
  phone: {
    w: 0.36,
    h: 0.075,
    d: 0.2,
    r: 0.028,
    color: '#f4f8fc',
    metalness: 0.4,
    roughness: 0.28,
    screen: { inset: 0.86, color: '#103246', emissive: '#6fe0ff', intensity: 1.15 },
  },
  defect: {
    w: 0.34,
    h: 0.05,
    d: 0.19,
    r: 0.028,
    color: '#c3ced8',
    metalness: 0.7,
    roughness: 0.35,
  },
  // 以下原料单独出现的情况很少，给个便宜的方块兜底
  glass: { w: 0.32, h: 0.025, d: 0.17, r: 0.02, color: '#9fe3ff', metalness: 0.2, roughness: 0.08 },
  battery: { w: 0.22, h: 0.05, d: 0.14, r: 0.01, color: '#2b2f36', metalness: 0.3, roughness: 0.6 },
  camera: { w: 0.06, h: 0.04, d: 0.06, r: 0.012, color: '#a78bfa', metalness: 0.5, roughness: 0.3 },
  board: { w: 0.26, h: 0.02, d: 0.16, r: 0.005, color: '#1f6f4a', metalness: 0.15, roughness: 0.7 },
  soc: { w: 0.12, h: 0.02, d: 0.12, r: 0.004, color: '#d9b45b', metalness: 0.6, roughness: 0.35 },
  box: { w: 0.3, h: 0.12, d: 0.22, r: 0.01, color: '#e8e2d4', metalness: 0.05, roughness: 0.8 },
}

interface Asset {
  geo: THREE.BufferGeometry
  body: THREE.MeshStandardMaterial
  screenGeo?: THREE.PlaneGeometry
  screen?: THREE.MeshStandardMaterial
  /** 主体高度的一半：让零件正好坐在带面上 */
  halfY: number
}

function buildAssets(): Record<ItemId, Asset> {
  const out = {} as Record<ItemId, Asset>
  for (const key of Object.keys(FORMS) as ItemId[]) {
    const f = FORMS[key]
    const geo = new RoundedBoxGeometry(f.w, f.h, f.d, 3, f.r)
    const body = new THREE.MeshStandardMaterial({
      color: new THREE.Color(f.color),
      metalness: f.metalness,
      roughness: f.roughness,
    })

    let screenGeo: THREE.PlaneGeometry | undefined
    let screen: THREE.MeshStandardMaterial | undefined
    if (f.screen) {
      screenGeo = new THREE.PlaneGeometry(f.w * f.screen.inset, f.d * f.screen.inset)
      screen = new THREE.MeshStandardMaterial({
        color: new THREE.Color(f.screen.color),
        emissive: new THREE.Color(f.screen.emissive),
        emissiveIntensity: f.screen.intensity,
        metalness: 0.2,
        roughness: 0.08,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    }

    out[key] = { geo, body, screenGeo, screen, halfY: f.h / 2 }
  }
  return out
}

export function Products() {
  const groups = useRef<(THREE.Group | null)[]>([])
  const bodies = useRef<(THREE.Mesh | null)[]>([])
  const screens = useRef<(THREE.Mesh | null)[]>([])

  const assets = useMemo(buildAssets, [])
  useEffect(() => {
    return () => {
      for (const a of Object.values(assets)) {
        a.geo.dispose()
        a.body.dispose()
        a.screenGeo?.dispose()
        a.screen?.dispose()
      }
    }
  }, [assets])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < POOL; i++) {
      const g = groups.current[i]
      if (!g) continue
      const p = sim.products[i]
      if (!p) {
        g.visible = false
        continue
      }

      const asset = assets[p.item] ?? assets.shell
      const body = bodies.current[i]
      const screen = screens.current[i]
      const key = `${p.item}:${p.model ?? 'pro'}`

      if (body && body.userData.key !== key) {
        body.userData.key = key
        body.geometry = asset.geo
        body.material = asset.body
      }

      const scale = p.model === 'air' ? 0.9 : 1
      const lift = p.mode === 'processing' ? 0.36 : p.mode === 'entering' ? 0.12 * Math.min(1, p.t * 2) : 0
      const bob = p.mode === 'processing' ? Math.sin(t * 12) * 0.004 : 0
      const bodyY = lift + asset.halfY

      g.visible = true
      g.position.set(p.x, LINE.beltY + 0.004 + bob, 0)
      g.scale.setScalar(scale)
      g.rotation.y = p.mode === 'processing' ? Math.sin(t * 2.2 + p.id) * 0.12 : 0

      if (body) body.position.y = bodyY

      if (screen) {
        const on = Boolean(asset.screen && asset.screenGeo)
        screen.visible = on
        if (on) {
          if (screen.userData.key !== p.item) {
            screen.userData.key = p.item
            screen.geometry = asset.screenGeo!
            screen.material = asset.screen!
          }
          screen.position.y = bodyY + 0.0016
        }
      }
    }
  })

  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el
          }}
          visible={false}
        >
          <mesh
            ref={(el) => {
              bodies.current[i] = el
            }}
            castShadow
          />
          <mesh
            ref={(el) => {
              screens.current[i] = el
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            visible={false}
          />
        </group>
      ))}
    </group>
  )
}