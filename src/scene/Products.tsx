import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LINE } from '@/lib/layout'
import { sim } from '@/sim/sim'
import { useFactory } from '@/store/useFactory'
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
    h: 0.02,
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
    h: 0.008,
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
    h: 0.022,
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
    h: 0.024,
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
    h: 0.025,
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
    h: 0.024,
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
    h: 0.023,
    d: 0.17,
    r: 0.027,
    color: '#f5f9fd',
    metalness: 0.5,
    roughness: 0.24,
    screen: { sw: 0.92, sd: 0.92, color: '#0f2735', emissive: '#6fe0ff', intensity: 1.2 },
    notch: true,
    buttons: true,
  },

  defect: { w: 0.34, h: 0.021, d: 0.165, r: 0.026, color: '#c3ced8', metalness: 0.7, roughness: 0.35 },

  // 原料件
  glass: { w: 0.3, h: 0.012, d: 0.15, r: 0.018, color: '#9fe3ff', metalness: 0.2, roughness: 0.06 },
  battery: { w: 0.18, h: 0.04, d: 0.1, r: 0.008, color: '#2b2f36', metalness: 0.3, roughness: 0.6 },
  camera: { w: 0.05, h: 0.03, d: 0.05, r: 0.01, color: '#a78bfa', metalness: 0.5, roughness: 0.3 },
  board: { w: 0.2, h: 0.008, d: 0.11, r: 0.004, color: '#1d6b47', metalness: 0.15, roughness: 0.72 },
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
      const g = new THREE.BoxGeometry(0.055, 0.0015, 0.012)
      g.translate(f.w / 2 - 0.045, f.h / 2 + 0.0015, 0)
      notchGeo = g
    }

    out[key] = { body: mergeParts(parts), bodyMat, screenGeo, screenMat, notchGeo, halfY: f.h / 2 }
  }

  return out
}

const NOTCH_MAT = new THREE.MeshStandardMaterial({ color: '#05080a', roughness: 0.4, metalness: 0.1 })

/** 在制品只有几厘米宽，用球形拾取体放大点击范围 */
function sphereRaycast(radius: number) {
  const sphere = new THREE.Sphere()
  const center = new THREE.Vector3()
  return function (this: THREE.Object3D, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
    this.getWorldPosition(center)
    sphere.set(center, radius)
    if (raycaster.ray.intersectsSphere(sphere)) {
      intersects.push({ distance: raycaster.ray.origin.distanceTo(center), point: center.clone(), object: this })
    }
  }
}


export function Products() {
  const groups = useRef<(THREE.Group | null)[]>([])
  const focusId = useFactory((s) => s.focusProductId)
  const bodies = useRef<(THREE.Mesh | null)[]>([])
  const screens = useRef<(THREE.Mesh | null)[]>([])
  const notches = useRef<(THREE.Mesh | null)[]>([])
  const lifts = useRef<number[]>([])
  const ringRef = useRef<THREE.Mesh>(null)

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

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    if (ringRef.current) ringRef.current.visible = false
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
      // 抬升缓动：进站时工件被"端起来"，出站再落下
      const targetLift = p.mode === 'processing' ? 0.36 : 0
      const prevLift = lifts.current[i] ?? 0
      const lift = prevLift + (targetLift - prevLift) * Math.min(1, dt * 11)
      lifts.current[i] = lift
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
          // 屏幕必须贴在机身上表面：bodyY 是机身中心，要再加半厚
          screen.position.y = bodyY + asset.halfY + 0.0012
        }
      }

      if (ringRef.current && focusId === p.id) {
        ringRef.current.visible = true
        ringRef.current.position.set(p.x, LINE.beltY + 0.012, 0)
        const k = 1 + Math.sin(t * 4) * 0.06
        ringRef.current.scale.setScalar(k)
      }

      if (notch) {
        const on = Boolean(asset.notchGeo)
        notch.visible = on
        if (on) {
          if (notch.userData.key !== p.item) {
            notch.userData.key = p.item
            notch.geometry = asset.notchGeo!
          }
          notch.position.y = bodyY + asset.halfY + 0.0021
        }
      }
    }
  })

  return (
    <group>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.26, 0.31, 44]} />
        <meshBasicMaterial color="#2fb8ff" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
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
            raycast={sphereRaycast(0.45) as unknown as THREE.Mesh['raycast']}
            onClick={(e) => {
              e.stopPropagation()
              const prod = sim.products[i]
              if (prod) useFactory.getState().focusProduct(prod.id)
            }}
            onPointerOver={() => {
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto'
            }}
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