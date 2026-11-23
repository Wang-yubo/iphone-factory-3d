import { useMemo } from 'react'
import { MATS } from '@/lib/materials'
import { tintedMaterial } from './geo'
import { hallServicesGeometry } from './hallServices'

/** 车间骨架：后排立柱 + 两道屋架 + 悬挂灯带，用纵深把画面撑起来 */
const COLUMNS = [-16.5, -10, -3.5, 3.5, 10, 16.5]
const TRUSS_Z = [-3.4, 3.4]
const BAR_X = [-12, -6.6, -1.2, 4.2, 9.6]
const TRUSS_Y = 6.05

export function Hall() {
  const services = useMemo(hallServicesGeometry, [])

  return (
    <group>
      {/* 管道 / 桥架 / 压顶 / 剪刀撑 */}
      <mesh geometry={services} material={tintedMaterial()} castShadow receiveShadow />

      {/* 后排立柱 */}
      {COLUMNS.map((x) => (
        <group key={x} position={[x, 0, -8.6]}>
          <mesh position={[0, 3.2, 0]} material={MATS.darkSteel()} castShadow>
            <boxGeometry args={[0.32, 6.4, 0.32]} />
          </mesh>
          <mesh position={[0, 0.12, 0]} material={MATS.deepSteel()}>
            <boxGeometry args={[0.72, 0.24, 0.72]} />
          </mesh>
          <mesh position={[0, 6.32, 0]} material={MATS.steel()}>
            <boxGeometry args={[0.5, 0.12, 0.5]} />
          </mesh>
        </group>
      ))}

      {/* 纵向屋架 + 斜撑 */}
      {TRUSS_Z.map((z) => (
        <group key={z}>
          <mesh position={[0, TRUSS_Y, z]} material={MATS.deepSteel()} castShadow>
            <boxGeometry args={[34, 0.24, 0.3]} />
          </mesh>
          <mesh position={[0, TRUSS_Y - 0.55, z]} material={MATS.darkSteel()}>
            <boxGeometry args={[34, 0.1, 0.14]} />
          </mesh>
          {Array.from({ length: 11 }, (_, i) => -17 + i * 3.4).map((x) => (
            <mesh key={x} position={[x, TRUSS_Y - 0.28, z]} material={MATS.darkSteel()}>
              <boxGeometry args={[0.05, 0.56, 0.05]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 灯带：吊在屋架下方 */}
      {TRUSS_Z.map((z) =>
        BAR_X.map((x) => (
          <group key={`${z}-${x}`} position={[x, 5.05, z]}>
            <mesh material={MATS.deepSteel()}>
              <boxGeometry args={[5.4, 0.1, 0.3]} />
            </mesh>
            <mesh position={[0, -0.06, 0]} material={MATS.glow('#eaf4ff', 2.4)}>
              <boxGeometry args={[5.1, 0.02, 0.2]} />
            </mesh>
            {[-2.2, 2.2].map((dx) => (
              <mesh key={dx} position={[dx, 0.55, 0]} material={MATS.steel()}>
                <boxGeometry args={[0.03, 1, 0.03]} />
              </mesh>
            ))}
          </group>
        )),
      )}
    </group>
  )
}