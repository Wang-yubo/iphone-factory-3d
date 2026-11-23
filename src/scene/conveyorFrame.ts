import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LINE } from '@/lib/layout'

/**
 * 输送机机架：型材侧框 + 支腿 + 横撑 + 可调地脚 + 导条支架 + 驱动电机 + 急停盒 + 桥架线束。
 * 全部合并成一个顶点色几何体，整条 23m 只占 1 个 draw call。
 */

const ALU = new THREE.Color('#c7cdd4')
const ALU_DARK = new THREE.Color('#9aa2aa')
const DARK = new THREE.Color('#31373e')
const STEEL = new THREE.Color('#8b949c')
const RUBBER = new THREE.Color('#14181c')
const YELLOW = new THREE.Color('#c19a26')
const RED = new THREE.Color('#a8322f')

function tint(input: THREE.BufferGeometry, c: THREE.Color) {
  const geo = input.index ? input.toNonIndexed() : input
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

const box = (
  list: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  c: THREE.Color,
) => {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  list.push(tint(g, c))
}

const cyl = (
  list: THREE.BufferGeometry[],
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  c: THREE.Color,
  axis: 'x' | 'y' | 'z' = 'y',
) => {
  const g = new THREE.CylinderGeometry(r, r, h, 16)
  if (axis === 'x') g.rotateZ(Math.PI / 2)
  if (axis === 'z') g.rotateX(Math.PI / 2)
  g.translate(x, y, z)
  list.push(tint(g, c))
}

let cached: THREE.BufferGeometry | null = null
let cachedMat: THREE.MeshStandardMaterial | null = null

export function conveyorFrame() {
  if (cached) return { geometry: cached, material: cachedMat! }

  const cx = (LINE.x0 + LINE.x1) / 2
  const len = LINE.x1 - LINE.x0
  const halfW = LINE.beltW / 2
  const beltY = LINE.beltY
  const sideZ = halfW + 0.055
  const parts: THREE.BufferGeometry[] = []

  // ---------- 两侧型材侧框（C 型：腹板 + 上下翼板） ----------
  for (const s of [-1, 1]) {
    const z = s * sideZ
    box(parts, len, 0.085, 0.045, cx, beltY - 0.075, z, ALU)
    box(parts, len, 0.012, 0.085, cx, beltY - 0.032, z, ALU_DARK)
    box(parts, len, 0.012, 0.085, cx, beltY - 0.118, z, ALU_DARK)
    // 侧框上的腰形减重孔（用深色薄片示意）
    for (let x = LINE.x0 + 0.6; x < LINE.x1 - 0.4; x += 0.62) {
      box(parts, 0.26, 0.03, 0.002, x, beltY - 0.075, z + s * 0.024, DARK)
    }
  }

  // ---------- 皮带槽体 ----------
  box(parts, len, 0.055, LINE.beltW, cx, beltY - 0.028, 0, RUBBER)
  // 皮带边缘压条
  for (const s of [-1, 1]) {
    box(parts, len, 0.008, 0.02, cx, beltY + 0.002, s * (halfW - 0.012), ALU_DARK)
  }

  // ---------- 导条 + 支架 ----------
  for (const s of [-1, 1]) {
    const z = s * (halfW + 0.02)
    box(parts, len, 0.05, 0.022, cx, beltY + 0.045, z, ALU)
    for (let x = LINE.x0 + 1.1; x < LINE.x1; x += 2.3) {
      box(parts, 0.03, 0.07, 0.06, x, beltY + 0.02, z, DARK)
    }
  }

  // ---------- 支腿（避开工站落位） ----------
  const legXs = [-10.8, -7.5, -1.5, 1.5, 7.5, 10.8]
  for (const x of legXs) {
    for (const s of [-1, 1]) {
      box(parts, 0.075, beltY - 0.16, 0.075, x, (beltY - 0.14) / 2 + 0.02, s * 0.34, DARK)
      // 可调地脚
      cyl(parts, 0.045, 0.03, x, 0.02, s * 0.34, STEEL)
      cyl(parts, 0.065, 0.012, x, 0.006, s * 0.34, RUBBER)
    }
    // 横撑 + 斜撑
    box(parts, 0.05, 0.05, 0.68, x, 0.26, 0, ALU_DARK)
    box(parts, 0.05, 0.04, 0.72, x, 0.66, 0, ALU_DARK)
  }

  // ---------- 端部：滚筒 + 张紧座 + 驱动电机 ----------
  for (const s of [-1, 1]) {
    cyl(parts, 0.062, LINE.beltW + 0.06, cx + s * (len / 2 - 0.05), beltY - 0.035, 0, STEEL, 'z')
    box(parts, 0.14, 0.16, LINE.beltW + 0.1, cx + s * (len / 2 - 0.06), beltY - 0.07, 0, DARK)
  }
  // 驱动单元挂在出料端侧面
  const motorX = cx + len / 2 - 0.42
  box(parts, 0.3, 0.26, 0.2, motorX, beltY - 0.24, -0.5, DARK)
  cyl(parts, 0.105, 0.34, motorX - 0.05, beltY - 0.24, -0.62, STEEL, 'x')
  for (let i = 0; i < 6; i++) {
    cyl(parts, 0.112, 0.012, motorX - 0.05 + (i - 2.5) * 0.05, beltY - 0.24, -0.62, ALU_DARK, 'x')
  }
  box(parts, 0.09, 0.09, 0.09, motorX, beltY - 0.24, -0.4, YELLOW) // 接线盒

  // ---------- 现场控制盒（带急停） ----------
  const cbX = cx - 6.6
  box(parts, 0.06, 0.9, 0.06, cbX, 0.45, 0.92, DARK)
  box(parts, 0.22, 0.3, 0.13, cbX, 1.02, 0.92, ALU_DARK)
  box(parts, 0.16, 0.1, 0.005, cbX, 1.08, 0.99, DARK)
  cyl(parts, 0.032, 0.02, cbX, 0.97, 0.99, RED, 'z')
  box(parts, 0.05, 0.02, 0.02, cbX + 0.06, 0.94, 0.99, YELLOW)
  // 到控制盒的线缆
  cyl(parts, 0.012, 0.9, cbX + 0.02, 0.5, 0.88, RUBBER)

  // ---------- 桥架 + 线束 ----------
  box(parts, len - 1.2, 0.015, 0.16, cx, 0.54, -0.52, DARK)
  for (const s of [-1, 1]) {
    box(parts, len - 1.2, 0.05, 0.012, cx, 0.57, -0.52 + s * 0.074, DARK)
  }
  for (const dz of [-0.03, 0.01, 0.04]) {
    cyl(parts, 0.011, len - 1.6, cx, 0.556, -0.52 + dz, RUBBER, 'x')
  }
  // 桥架吊杆
  for (let x = LINE.x0 + 1.6; x < LINE.x1 - 1; x += 3.4) {
    box(parts, 0.025, 0.36, 0.025, x, 0.38, -0.52, STEEL)
  }

  const merged = mergeGeometries(parts, false)!
  for (const p of parts) p.dispose()

  cached = merged
  cachedMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.36 })
  return { geometry: cached, material: cachedMat }
}