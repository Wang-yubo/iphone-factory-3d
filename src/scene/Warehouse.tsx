import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { WAREHOUSE } from '@/lib/layout'
import { MATS } from '@/lib/materials'
import { MATERIALS } from '@/sim/recipes'
import { COL, box, merge, strut, tintedMaterial } from './geo'

const RACK_W = 2.7 // 沿 Z
const RACK_D = 0.95 // 沿 X
const RACK_H = 2.9
const SHELVES = [0.52, 1.12, 1.72, 2.32]

/** 仓库货架本体：立柱 + 斜拉 + 层板梁 + 托盘，合并成一个顶点色 mesh */
function rackGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const hx = RACK_D / 2 - 0.045
  const hz = RACK_W / 2 - 0.045

  // 四根立柱（带正面的孔列示意）
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(parts, 0.085, RACK_H, 0.085, sx * hx, RACK_H / 2, sz * hz, COL.aluDark)
      for (let y = 0.25; y < RACK_H - 0.1; y += 0.34) {
        box(parts, 0.02, 0.02, 0.005, sx * hx + 0.04, y, sz * hz + 0.043, COL.deep)
      }
    }
  }

  // 侧面斜拉（Z 字撑）
  for (const sx of [-1, 1]) {
    strut(parts, sx * hx, 0.35, -hz, sx * hx, 1.55, hz, 0.038, COL.aluDark)
    strut(parts, sx * hx, 1.55, -hz, sx * hx, 2.75, hz, 0.038, COL.aluDark)
  }

  // 层板梁（前后各一根 C 型梁）
  for (const y of SHELVES) {
    for (const sx of [-1, 1]) {
      box(parts, 0.05, 0.1, RACK_W, sx * hx, y - 0.05, 0, COL.alu)
      box(parts, 0.085, 0.012, RACK_W, sx * hx, y, 0, COL.steel)
    }
    // 层板
    box(parts, RACK_D - 0.06, 0.012, RACK_W - 0.06, 0, y + 0.004, 0, COL.steel)
  }

  // 顶部框架 + 招牌架
  box(parts, RACK_D, 0.06, RACK_W, 0, RACK_H + 0.03, 0, COL.dark)
  box(parts, RACK_D + 0.1, 0.035, RACK_W + 0.1, 0, RACK_H - 0.02, 0, COL.aluDark)
  for (const sz of [-1, 1]) {
    box(parts, 0.03, 0.34, 0.03, 0, RACK_H + 0.2, sz * (RACK_W / 2 - 0.2), COL.dark)
  }
  box(parts, 0.03, 0.03, RACK_W - 0.3, 0, RACK_H + 0.37, 0, COL.dark)

  // 托盘（每个料箱下面一块）
  MATERIALS.forEach((_, i) => {
    const row = Math.floor(i / 2)
    const col = i % 2 === 0 ? -1 : 1
    const y = SHELVES[row] + 0.014
    box(parts, 0.56, 0.05, 0.5, 0, y, col * 0.64, COL.wood)
    for (const dz of [-0.18, 0, 0.18]) {
      box(parts, 0.6, 0.02, 0.05, 0, y - 0.035, col * 0.64 + dz, COL.deep)
    }
  })

  // 底部地脚
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(parts, 0.14, 0.02, 0.14, sx * hx, 0.01, sz * hz, COL.steel)
    }
  }

  return merge(parts)
}

/** 原料仓库：七种原料的货架，P3 起可以从这里拖料投线 */
export function Warehouse() {
  const geo = useMemo(rackGeometry, [])
  const mat = tintedMaterial()

  return (
    <group position={[WAREHOUSE.x, 0, WAREHOUSE.z]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />

      {/* 原料箱 */}
      {MATERIALS.map((m, i) => {
        const row = Math.floor(i / 2)
        const col = i % 2 === 0 ? -1 : 1
        const y = SHELVES[row] + 0.19
        return (
          <group key={m.id} position={[0, y, col * 0.64]}>
            <mesh material={MATS.whitePlastic()} castShadow>
              <boxGeometry args={[0.52, 0.34, 0.44]} />
            </mesh>
            <mesh position={[0, 0.005, 0.002]} material={MATS.glow(m.color, 0.14)}>
              <boxGeometry args={[0.46, 0.24, 0.38]} />
            </mesh>
            <mesh position={[0, 0.12, 0]} material={MATS.darkSteel()}>
              <boxGeometry args={[0.5, 0.02, 0.42]} />
            </mesh>
          </group>
        )
      })}

      <Html
        position={[RACK_D / 2 + 0.02, RACK_H + 0.42, 0]}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[10, 0]}
      >
        <div className="zone-sign">
          <b>原料仓库</b>
          <span>RAW MATERIAL</span>
        </div>
      </Html>
    </group>
  )
}
