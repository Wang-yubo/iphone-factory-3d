import { Html } from '@react-three/drei'
import { SHELF, SHELF_SLOTS, shelfSlotLocal } from '@/lib/layout'
import { MATS } from '@/lib/materials'
import { C } from '@/lib/palette'
import { sim } from '@/sim/sim'
import { useFactory } from '@/store/useFactory'

const W = 2.7 // 沿 Z
const D = 0.85 // 沿 X
const H = 2.25
const ROWS = SHELF_SLOTS.rows
const COLS = SHELF_SLOTS.cols

/** 成品出货区：3 层 × 4 格，成品逐台落位；订单完成时整批清空 */
export function Shelf() {
  const version = useFactory((s) => s.simVersion)
  const order = sim.orders[0]
  void version

  return (
    <group position={[SHELF.x, 0, SHELF.z]} rotation={[0, Math.PI / 2, 0]}>
      {/* 底座 */}
      <mesh position={[0, 0.09, 0]} material={MATS.deepSteel()} castShadow receiveShadow>
        <boxGeometry args={[D + 0.2, 0.18, W + 0.2]} />
      </mesh>

      {/* 背板 */}
      <mesh position={[D / 2 - 0.03, H / 2, 0]} material={MATS.deepSteel()} castShadow receiveShadow>
        <boxGeometry args={[0.06, H, W]} />
      </mesh>

      {/* 层板 */}
      {ROWS.map((y) => (
        <mesh key={y} position={[0, y, 0]} material={MATS.steel()} castShadow receiveShadow>
          <boxGeometry args={[D, 0.045, W]} />
        </mesh>
      ))}

      {/* 竖隔板 */}
      {COLS.map((z) => (
        <mesh key={z} position={[0.02, H / 2, z]} material={MATS.darkSteel()} castShadow>
          <boxGeometry args={[D - 0.04, H, 0.035]} />
        </mesh>
      ))}

      {/* 每一格的承接灯带 */}
      {ROWS.map((y) =>
        COLS.slice(0, -1).map((z, i) => {
          const zCenter = (z + COLS[i + 1]) / 2
          return (
            <mesh key={`${y}-${zCenter}`} position={[-0.1, y + 0.03, zCenter]} material={MATS.glow(C.ok, 0.35)}>
              <boxGeometry args={[0.5, 0.012, 0.7]} />
            </mesh>
          )
        }),
      )}

      {/* 已经入库的成品 */}
      {sim.shelf.map((slot) => {
        const [lx, ly, lz] = shelfSlotLocal(slot)
        return (
          <group key={slot} position={[lx + 0.04, ly, lz]}>
            <mesh material={MATS.glow('#eef4f9', 0.12)} castShadow>
              <boxGeometry args={[0.19, 0.07, 0.33]} />
            </mesh>
            <mesh position={[0, 0.04, 0]} material={MATS.glow(C.accent, 0.5)}>
              <boxGeometry args={[0.15, 0.006, 0.27]} />
            </mesh>
          </group>
        )
      })}

      {/* 顶部指示灯条 */}
      <mesh position={[-0.3, H + 0.06, 0]} material={MATS.glow(C.ok, 1.4)}>
        <boxGeometry args={[0.05, 0.04, W - 0.3]} />
      </mesh>

      <Html
        position={[-D / 2 + 0.02, H + 0.42, 0]}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        zIndexRange={[10, 0]}
      >
        <div className="zone-sign zone-sign--ok">
          <b>成品出货区</b>
          <span>
            {sim.shelf.length} 台在架{order ? ` · ${order.client}` : ''}
          </span>
        </div>
      </Html>
    </group>
  )
}