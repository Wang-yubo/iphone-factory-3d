import * as THREE from 'three'
import { COL, box, cyl, merge } from './geo'

/**
 * 料仓的五金件：四角铝型材立柱、上沿围框、侧壁料位标尺、仓壁振动器、下料法兰、柔性套。
 * 玻璃仓体仍是半透明材质，这些金属件合并成一个顶点色 mesh。
 */

const cache = new Map<string, THREE.BufferGeometry>()

export function binHardwareGeometry(size: number) {
  const key = size.toFixed(3)
  const hit = cache.get(key)
  if (hit) return hit

  const parts: THREE.BufferGeometry[] = []
  const half = size / 2

  // 四角立柱
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(parts, 0.026, 0.66, 0.026, sx * (half + 0.018), -0.09, sz * (half + 0.018), COL.alu)
      // 立柱底部地脚
      box(parts, 0.04, 0.012, 0.04, sx * (half + 0.018), -0.42, sz * (half + 0.018), COL.dark)
    }
  }

  // 上沿围框
  for (const sz of [-1, 1]) {
    box(parts, size + 0.09, 0.022, 0.024, 0, 0.245, sz * (half + 0.02), COL.aluDark)
  }
  for (const sx of [-1, 1]) {
    box(parts, 0.024, 0.022, size + 0.09, sx * (half + 0.02), 0.245, 0, COL.aluDark)
  }

  // 侧面料位标尺（深色底板 + 5 条刻度）
  box(parts, 0.075, 0.4, 0.008, 0, -0.02, half + 0.026, COL.dark)
  for (let i = 0; i < 5; i++) {
    box(parts, i % 2 === 0 ? 0.06 : 0.04, 0.006, 0.004, 0, -0.19 + i * 0.09, half + 0.032, COL.aluDark)
  }

  // 仓壁振动器（右侧）
  cyl(parts, 0.05, 0.11, half + 0.07, -0.3, 0, COL.steel, 'x')
  cyl(parts, 0.052, 0.014, half + 0.128, -0.3, 0, COL.dark, 'x')
  box(parts, 0.03, 0.09, 0.09, half + 0.012, -0.3, 0, COL.aluDark)
  // 振动器接线
  cyl(parts, 0.008, 0.1, half + 0.062, -0.4, 0, COL.rubber)

  // 下料口法兰 + 柔性套
  cyl(parts, 0.092, 0.016, 0, -0.44, 0, COL.steel)
  cyl(parts, 0.058, 0.1, 0, -0.49, 0, COL.rubber)
  cyl(parts, 0.07, 0.012, 0, -0.545, 0, COL.aluDark)

  const g = merge(parts)
  cache.set(key, g)
  return g
}

