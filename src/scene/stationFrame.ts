import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { STATION_SIZE } from '@/lib/layout'

/**
 * 工站机架：4 根铝型材立柱 + 上下横梁 + 角码 + 调平脚 + 顶部走线槽 + 警示条。
 * 全部合并成一个几何体（顶点色区分铝/深灰/橡胶/黄），7 个工站共用同一份，
 * 每个工站只多 1 个 draw call，但能换来一堆细节。
 */

const ALU = new THREE.Color('#c7cdd4')
const ALU_DARK = new THREE.Color('#9aa2aa')
const DARK = new THREE.Color('#2f353c')
const RUBBER = new THREE.Color('#14181c')
const YELLOW = new THREE.Color('#c19a26')
const STEEL = new THREE.Color('#8b949c')

function tint(input: THREE.BufferGeometry, color: THREE.Color) {
  // mergeGeometries 要求索引状态一致：统一转成非索引
  const geo = input.index ? input.toNonIndexed() : input
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = color.r
    arr[i * 3 + 1] = color.g
    arr[i * 3 + 2] = color.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

/** 统一走 tint 生成，顺带保证几何体都带 color 且非索引 */

/** 40×40 铝型材截面：外方内孔，带一点壁厚感 */
function profile(len: number) {
  const o = 0.045
  const i = 0.029
  const shape = new THREE.Shape()
  shape.moveTo(-o, -o)
  shape.lineTo(o, -o)
  shape.lineTo(o, o)
  shape.lineTo(-o, o)
  shape.closePath()

  const hole = new THREE.Path()
  hole.moveTo(-i, -i)
  hole.lineTo(i, -i)
  hole.lineTo(i, i)
  hole.lineTo(-i, i)
  hole.closePath()
  shape.holes.push(hole)

  return new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, steps: 1 })
}

const Z = new THREE.Vector3(0, 0, 1)

/** 从 a 到 b 拉一根型材 */
function strut(a: THREE.Vector3, b: THREE.Vector3, color: THREE.Color) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  if (len < 1e-4) return null
  const g = profile(len)
  const q = new THREE.Quaternion().setFromUnitVectors(Z, dir.clone().normalize())
  g.applyMatrix4(new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1)))
  return tint(g, color)
}

function boxAt(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: THREE.Color,
  rotY = 0,
) {
  const g = new THREE.BoxGeometry(w, h, d)
  if (rotY) g.rotateY(rotY)
  g.translate(x, y, z)
  return tint(g, color)
}

function cylAt(r: number, h: number, x: number, y: number, z: number, color: THREE.Color) {
  const g = new THREE.CylinderGeometry(r, r, h, 20)
  g.translate(x, y, z)
  return tint(g, color)
}

let cached: THREE.BufferGeometry | null = null
let cachedMat: THREE.MeshStandardMaterial | null = null

export function stationFrame() {
  if (cached) return { geometry: cached, material: cachedMat! }

  const W = STATION_SIZE.w
  const D = STATION_SIZE.d
  const px = W / 2 - 0.06
  const pz = D / 2 - 0.06
  const y0 = 0.15
  const y1 = 2.3
  const parts: THREE.BufferGeometry[] = []

  // 四根立柱
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = strut(new THREE.Vector3(sx * px, y0, sz * pz), new THREE.Vector3(sx * px, y1, sz * pz), ALU)
      if (g) parts.push(g)
    }
  }

  // 顶部横梁
  for (const sz of [-1, 1]) {
    const g = strut(new THREE.Vector3(-px, y1, sz * pz), new THREE.Vector3(px, y1, sz * pz), ALU)
    if (g) parts.push(g)
  }
  for (const sx of [-1, 1]) {
    const g = strut(new THREE.Vector3(sx * px, y1, -pz), new THREE.Vector3(sx * px, y1, pz), ALU_DARK)
    if (g) parts.push(g)
  }

  // 下部横梁（比顶部细一档，用深色区分）
  for (const sz of [-1, 1]) {
    const g = strut(new THREE.Vector3(-px, y0 + 0.1, sz * pz), new THREE.Vector3(px, y0 + 0.1, sz * pz), ALU_DARK)
    if (g) parts.push(g)
  }

  // 八个角码
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const y of [y1 - 0.06, y0 + 0.12]) {
        parts.push(boxAt(0.18, 0.03, 0.03, sx * (px - 0.09), y, sz * (pz - 0.02), DARK, Math.PI / 4))
        parts.push(boxAt(0.03, 0.03, 0.18, sx * (px - 0.02), y, sz * (pz - 0.09), DARK, Math.PI / 4))
      }
    }
  }

  // 顶部走线槽（U 型）
  parts.push(boxAt(2.2, 0.015, 0.14, 0, 2.37, -1.36, DARK))
  parts.push(boxAt(2.2, 0.07, 0.015, 0, 2.4, -1.43, DARK))
  parts.push(boxAt(2.2, 0.07, 0.015, 0, 2.4, -1.29, DARK))
  // 槽里的线束
  for (const dx of [-0.02, 0.03]) {
    parts.push(cylAt(0.012, 2.1, dx, 2.38, -1.36, RUBBER))
  }

  // 基座侧面的警示带
  parts.push(boxAt(W + 0.14, 0.055, 0.006, 0, 0.075, D / 2 + 0.082, YELLOW))
  parts.push(boxAt(W + 0.14, 0.055, 0.006, 0, 0.075, -D / 2 - 0.082, YELLOW))

  const merged = mergeGeometries(parts, false)!
  for (const p of parts) p.dispose()

  cached = merged
  cachedMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.72,
    roughness: 0.34,
  })
  return { geometry: cached, material: cachedMat }
}

/** 磨砂冲孔板纹理：给机柜侧面用，程序化生成 */
let panelTex: THREE.CanvasTexture | null = null
export function perforatedTexture() {
  if (panelTex) return panelTex
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#9aa2aa'
  g.fillRect(0, 0, size, size)
  g.fillStyle = '#6f777f'
  for (let y = 6; y < size; y += 12) {
    for (let x = (y / 12) % 2 === 0 ? 6 : 12; x < size; x += 12) {
      g.beginPath()
      g.arc(x, y, 2.1, 0, Math.PI * 2)
      g.fill()
    }
  }
  panelTex = new THREE.CanvasTexture(c)
  panelTex.wrapS = panelTex.wrapT = THREE.RepeatWrapping
  panelTex.repeat.set(4, 1.2)
  panelTex.colorSpace = THREE.SRGBColorSpace
  return panelTex
}