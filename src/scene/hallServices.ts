import * as THREE from 'three'
import { COL, box, cyl, merge, strut } from './geo'

/**
 * 车间管线：三根工艺管道 + 吊杆、后墙桥架、女儿墙压顶、柱间剪刀撑。
 * 这些是"背景骨架"，全是静态件，合并成一个顶点色 mesh。
 */

let cached: THREE.BufferGeometry | null = null

export function hallServicesGeometry() {
  if (cached) return cached

  const parts: THREE.BufferGeometry[] = []
  const X0 = -18
  const X1 = 18

  // 三根主管道（沿 X 通长）
  const pipes: [number, number][] = [
    [5.78, 0.062],
    [5.52, 0.048],
    [5.28, 0.038],
  ]
  for (const [y, r] of pipes) {
    cyl(parts, r, X1 - X0, 0, y, -7.6, COL.steel, 'x', 14)
    // 法兰接头
    for (let x = X0 + 3; x < X1; x += 6) {
      cyl(parts, r + 0.018, 0.05, x, y, -7.6, COL.dark, 'x', 12)
    }
    // 吊杆
    for (let x = X0 + 2; x < X1; x += 4) {
      box(parts, 0.018, 0.5, 0.018, x, y + 0.25, -7.6, COL.steel)
    }
  }

  // 后墙桥架
  box(parts, X1 - X0 - 2, 0.015, 0.22, 0, 4.92, -8.3, COL.dark)
  for (const sz of [-1, 1]) {
    box(parts, X1 - X0 - 2, 0.06, 0.014, 0, 4.95, -8.3 + sz * 0.1, COL.dark)
  }
  for (const dz of [-0.05, 0, 0.05]) {
    cyl(parts, 0.014, X1 - X0 - 2.4, 0, 4.945, -8.3 + dz, COL.rubber, 'x', 10)
  }
  for (let x = X0 + 2; x < X1; x += 5) {
    box(parts, 0.02, 1.2, 0.02, x, 4.3, -8.3, COL.steel)
  }

  // 女儿墙压顶（后墙顶）
  box(parts, X1 - X0, 0.16, 0.3, 0, 6.4, -8.6, COL.aluDark)
  box(parts, X1 - X0, 0.04, 0.36, 0, 6.5, -8.6, COL.steel)

  // 柱间剪刀撑（后排，两个柱距）
  const cols = [-16.5, -10, -3.5, 3.5, 10, 16.5]
  for (let i = 0; i < cols.length - 1; i += 2) {
    const a = cols[i]
    const b = cols[i + 1]
    strut(parts, a, 0.45, -8.55, b, 5.2, -8.55, 0.045, COL.aluDark)
    strut(parts, a, 5.2, -8.55, b, 0.45, -8.55, 0.045, COL.aluDark)
  }

  cached = merge(parts)
  return cached
}
