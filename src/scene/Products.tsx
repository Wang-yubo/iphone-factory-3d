import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LINE } from '@/lib/layout'
import { sim } from '@/sim/sim'
import type { ItemId } from '@/sim/recipes'

const POOL = 30

/** 手机宽高比接近 2:1，厚度只有宽度的 ~12%——这三条决定了它像不像手机 */
interface Form {
  w: number
  h: number
  d: number
  r: number
  color: string
  metalness: number
  roughness: number
  /** 屏幕：占主体的比例、离中心的偏移、发光 */
  screen?: {
    sw: number
    sd: number
    color: string
    emissive: string
    intensity: number
  }
  /** 顶部灵动岛 */
  notch?: boolean
  /** 侧键（右边缘两颗 + 左边缘一颗） */
  buttons?: boolean
}

const FORMS: Record<ItemId, Form> = {
  aluminum: { w: 0.3, h: 0.1, d: 0.17, r: 0.018, color: '#c3c9d0', metalness: 0.9, roughness: 0.28 },

  // 机壳：薄、带内腔
  shell: {
    w: 0.34,
    h: 0.03,
    d: 0.165,
    r: 0.026,
    color: '#c9ced4',
    metalness: 0.88,
    roughness: 0.26,
    screen: { sw: 0.88, sd: 0.88, color: '#20262c', emissive: '#0a0d10', intensity: 0.12 },
  },

  // 主板总成：绿色基板 + 金色芯片位
  boardAssy: {
    w: 0.2,
    h: 0.012,
    d: 0.11,
    r: 0.004,
    color: '#1d6b47',
    metalness: 0.15,
    roughness: 0.72,
    screen: { sw: 0.34, sd: 0.42, color: '#d9b45b', emissive: '#b98a2a', intensity: 0.5 },
  },

  // 屏装机壳：屏幕亮起
  displayAssy: {
    w: 0.34,
    h: 0.032,
    d: 0.165,
    r: 0.026,
    color: '#b9c3cd',
    metalness: 0.85,
    roughness: 0.28,
    screen: { sw: 0.88, sd: 0.9, color: '#0a1822', emissive: '#2fb8ff', intensity: 0.5 },
    notch: true,
    buttons: true,
  },

  batteryAssy: {
    w: 0.34,
    h: 0.034,
    d: 0.165,
    r: 0.026,
    color: '#414952',
    metalness: 0.55,
    roughness: 0.42,
    screen: { sw: 0.88, sd: 0.9, color: '#0a1822', emissive: '#2fb8ff', intensity: 0.55 },
    notch: true,
    buttons: true,
  },

  phoneBody: {
    w: 0.34,
    h: 0.036,
    d: 0.165,
    r: 0.026,
    color: '#e7ecf1',
    metalness: 0.6,
    roughness: 0.3,
    screen: { sw: 0.88, sd: 0.9, color: '#0c1c28', emissive: '#43c8ff', intensity: 0.75 },
    notch: true,
    buttons: true,
  },

  phoneOk: {
    w: 0.345,
    h: 0.036,
    d: 0.168,
    r: 0.027,
    color: '#eef3f8',
    metalness: 0.55,
    roughness: 0.26,
    screen: { sw: 0.89, sd: 0.9, color: '#0e2130', emissive: '#5bd8ff', intensity: 0.85 },
    notch: true,
    buttons: true,
  },

  phone: {
    w: 0.35,
    h: 0.036,
    d: 0.17,
    r: 0.027,
    color: '#f5f9fd',
    metalness: 0.5,
    roughness: 0.24,
    screen: { sw: 0.9, sd: 0.91, color: '#102838', emissive: '#6fe0ff', intensity: 1 },
    notch: true,
    buttons: true,
  },

  defect: { w: 0.34, h: 0.03, d: 0.165, r: 0.026, color: '#c3ced8', metalness: 0.7, roughness: 0.35 },

  // 原料件
  glass: { w: 0.3, h: 0.012, d: 0.15, r: 0.018, color: '#9fe3ff', metalness: 0.2, roughness: 0.06 },
  battery: { w: 0.18, h: 0.04, d: 0.1, r: 0.008, color: '#2b2f36', metalness: 0.3, roughness: 0.6 },
  camera: { w: 0.05, h: 0.03, d: 0.05, r: 0.01, color: '#a78bfa', metalness: 0.5, roughness: 0.3 },
  board: { w: 0.2, h: 0.012, d: 0.11, r: 0.004, color: '#1d6b47', metalness: 0.15, roughness: 0.72 },
  soc: { w: 0.09, h: 0.012, d: 0.09, r: 0.003, color: '#d9b45b', metalness: 0.6, roughness: 0.35 },
  box: { w: 0.3, h: 0.11, d: 0.21, r: 0.01, color: '#e8e2d4', metalness: 0.05, roughness: 0.8 },
}

/** 把圆角主体和侧键合并成一份几何体（同材质，1 个 draw call） */
function mergeParts(parts: THREE.BufferGeometry[]) {
  const normalized = parts.map((g) => (g.index ? g.toNonIndexed() : g))
  const merged = mergeGeometries(normalized, false)
  if (!merged) return parts[0]
  for (const g of normalized) if (g !== parts[0]) g.dispose()
  return merged
}

interface Asset {
  body: THREE.BufferGeometry
  bodyMat: THREE.MeshStandardMaterial
  screenGeo?: THREE.PlaneGeometry
  screenMat?: THREE.MeshStandardMaterial
  notchGeo?: THREE.BufferGeometry
  halfY: number
}

function buildAssets(): Record<ItemId, Asset> {
  const out = {} as Record<ItemId, Asset>
  const keys = Object.keys(FORMS) as ItemId[]

  for (const key of keys) {
    const f = FORMS[key]
    const parts: THREE.BufferGeometry[] = [new RoundedBoxGeometry(f.w, f.h, f.d, 3, f.r)]

    // 侧键：右侧两颗 + 左侧一颗，凸出 2mm
    if (f.buttons) {
      const by = f.h * 0.1
      for (const [z, len] of [
        [f.d * 0.18, 0.05],
        [f.d * 0.02, 0.036],
      ] as const) {
        const g = new THREE.BoxGeometry(0.006, by, len)
        g.translate(f.w / 2 + 0.002, 0, z)
        parts.push(g)
      }
      const g = new THREE.BoxGeometry(0.006, by, 0.03)
      g.translate(-f.w / 2 - 0.002, 0, f.d * 0.1)
      parts.push(g)
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(f.color),
      metalness: f.metalness,
      roughness: f.roughness,
    })

    let screenGeo: THREE.PlaneGeometry | undefined
    let screenMat: THREE.MeshStandardMaterial | undefined
    if (f.screen) {
      screenGeo = new THREE.PlaneGeometry(f.w * f.screen.sw, f.d * f.screen.sd)
      screenMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(f.screen.color),
        emissive: new THREE.Color(f.screen.emissive),
        emissiveIntensity: f.screen.intensity,
        metalness: 0.25,
        roughness: 0.06,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
    }

    // 灵动岛：贴在屏幕的一端
    let notchGeo: THREE.BufferGeometry | undefined
    if (f.notch) {
      const g = new THREE.BoxGeometry(0.058, 0.004, 0.013)
      g.translate(f.w / 2 - 0.045, f.h / 2 + 0.0015, 0)
      notchGeo = g
    }

    out[key] = { body: mergeParts(parts), bodyMat, screenGeo, screenMat, notchGeo, halfY: f.h / 2 }
  }

  return out
}

const NOTCH_MAT = new THREE.MeshStandardMaterial({ color: '#05080a', roughness: 0.4, metalness: 0.1 })

export function Products() {
  const groups = useRef<(THREE.Group | null)[]>([])
  const bodies = useRef<(THREE.Mesh | null)[]>([])
  const screens = useRef<(THREE.Mesh | null)[]>([])
  const notches = useRef<(THREE.Mesh | null)[]>([])

  const assets = useMemo(buildAssets, [])

  useEffect(() => {
    return () => {
      for (const a of Object.values(assets)) {
        a.body.dispose()
        a.bodyMat.dispose()
        a.screenGeo?.dispose()
        a.screenMat?.dispose()
        a.notchGeo?.dispose()
      }
      NOTCH_MAT.dispose()
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
      const notch = notches.current[i]
      const key = `${p.item}:${p.model ?? 'pro'}`

      if (body && body.userData.key !== key) {
        body.userData.key = key
        body.geometry = asset.body
        body.material = asset.bodyMat
      }

      const scale = p.model === 'air' ? 0.94 : 1
      const lift = p.mode === 'processing' ? 0.36 : p.mode === 'entering' ? 0.12 * Math.min(1, p.t * 2) : 0
      const bob = p.mode === 'processing' ? Math.sin(t * 12) * 0.004 : 0
      const bodyY = lift + asset.halfY

      g.visible = true
      g.position.set(p.x, LINE.beltY + 0.004 + bob, 0)
      g.scale.setScalar(scale)
      g.rotation.y = p.mode === 'processing' ? Math.sin(t * 2.2 + p.id) * 0.12 : 0

      if (body) body.position.y = bodyY

      if (screen) {
        const on = Boolean(asset.screenGeo && asset.screenMat)
        screen.visible = on
        if (on) {
          if (screen.userData.key !== p.item) {
            screen.userData.key = p.item
            screen.geometry = asset.screenGeo!
            screen.material = asset.screenMat!
          }
          screen.position.y = bodyY + 0.0012
        }
      }

      if (notch) {
        const on = Boolean(asset.notchGeo)
        notch.visible = on
        if (on) {
          if (notch.userData.key !== p.item) {
            notch.userData.key = p.item
            notch.geometry = asset.notchGeo!
          }
          notch.position.y = bodyY + 0.0035
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
          <mesh
            ref={(el) => {
              notches.current[i] = el
            }}
            material={NOTCH_MAT}
            visible={false}
          />
        </group>
      ))}
    </group>
  )
}