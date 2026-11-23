import { Html } from '@react-three/drei'
import { WAREHOUSE } from '@/lib/layout'
import { MATS } from '@/lib/materials'
import { MATERIALS } from '@/sim/recipes'

const RACK_W = 2.7 // 沿 Z
const RACK_D = 0.95 // 沿 X
const RACK_H = 2.9
const SHELVES = [0.52, 1.12, 1.72, 2.32]

/** 原料仓库：七种原料的货架，P3 起可以从这里拖料投线 */
export function Warehouse() {
  return (
    <group position={[WAREHOUSE.x, 0, WAREHOUSE.z]} rotation={[0, -Math.PI / 2, 0]}>
      {/* 立柱 */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}-${sz}`}
            position={[sx * (RACK_D / 2 - 0.04), RACK_H / 2, sz * (RACK_W / 2 - 0.04)]}
            material={MATS.darkSteel()}
            castShadow
          >
            <boxGeometry args={[0.08, RACK_H, 0.08]} />
          </mesh>
        )),
      )}

      {/* 层板 */}
      {SHELVES.map((y) => (
        <mesh key={y} position={[0, y, 0]} material={MATS.steel()} castShadow receiveShadow>
          <boxGeometry args={[RACK_D, 0.05, RACK_W]} />
        </mesh>
      ))}

      {/* 顶板 */}
      <mesh position={[0, RACK_H + 0.02, 0]} material={MATS.deepSteel()}>
        <boxGeometry args={[RACK_D + 0.1, 0.06, RACK_W + 0.1]} />
      </mesh>

      {/* 原料箱：两列四层，颜色对应右侧面板 */}
      {MATERIALS.map((m, i) => {
        const row = Math.floor(i / 2)
        const col = i % 2 === 0 ? -1 : 1
        const y = SHELVES[row] + 0.19
        return (
          <group key={m.id} position={[0, y, col * 0.64]}>
            <mesh material={MATS.whitePlastic()} castShadow>
              <boxGeometry args={[0.52, 0.34, 0.44]} />
            </mesh>
            <mesh position={[0, 0.0, 0.001]} material={MATS.glow(m.color, 0.18)}>
              <boxGeometry args={[0.46, 0.24, 0.38]} />
            </mesh>
            <mesh position={[0, 0.12, 0]} material={MATS.darkSteel()}>
              <boxGeometry args={[0.5, 0.02, 0.42]} />
            </mesh>
          </group>
        )
      })}

      {/* 招牌 */}
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