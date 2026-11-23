import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * 顶点色几何体构建工具：把一堆零件合并成一个 mesh，
 * 用顶点色区分材质，避免细节一多 draw call 就爆。
 */

export const COL = {
  alu: new THREE.Color('#c9cfd6'),
  aluDark: new THREE.Color('#9aa2aa'),
  dark: new THREE.Color('#31373e'),
  deep: new THREE.Color('#23282e'),
  steel: new THREE.Color('#8b949c'),
  rubber: new THREE.Color('#15191d'),
  yellow: new THREE.Color('#c19a26'),
  wood: new THREE.Color('#8a6a45'),
  red: new THREE.Color('#a8322f'),
}

export function tint(input: THREE.BufferGeometry, c: THREE.Color) {
  const geo = input.index ? input.toNonIndexed() : input
  const n = geo.attributes.position.count
  if (!geo.attributes.color) {
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  }
  return geo
}

export function box(
  list: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  c: THREE.Color,
) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  list.push(tint(g, c))
}

export function cyl(
  list: THREE.BufferGeometry[],
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  c: THREE.Color,
  axis: 'x' | 'y' | 'z' = 'y',
  segments = 16,
) {
  const g = new THREE.CylinderGeometry(r, r, h, segments)
  if (axis === 'x') g.rotateZ(Math.PI / 2)
  if (axis === 'z') g.rotateX(Math.PI / 2)
  g.translate(x, y, z)
  list.push(tint(g, c))
}

/** 斜撑：从 a 到 b 拉一根方料 */
export function strut(
  list: THREE.BufferGeometry[],
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  thick: number,
  c: THREE.Color,
) {
  const a = new THREE.Vector3(ax, ay, az)
  const b = new THREE.Vector3(bx, by, bz)
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  if (len < 1e-4) return
  const g = new THREE.BoxGeometry(thick, len, thick)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  g.applyQuaternion(q)
  g.translate((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
  list.push(tint(g, c))
}

export function merge(list: THREE.BufferGeometry[]) {
  const merged = mergeGeometries(list, false)
  for (const g of list) g.dispose()
  return merged ?? new THREE.BufferGeometry()
}

let cachedMat: THREE.MeshStandardMaterial | null = null
export function tintedMaterial() {
  if (!cachedMat) {
    cachedMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.36 })
  }
  return cachedMat
}
