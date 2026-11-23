import { useState } from 'react'
import { stationX, STATION_SIZE } from '@/lib/layout'
import { MATS } from '@/lib/materials'
import { useFactory } from '@/store/useFactory'
import type { StationDef } from '@/sim/recipes'
import { Arm, Beacon, Bin, BinGantry, Cabinet, ToolHead } from './StationParts'
import { stationFrame } from './stationFrame'

const W = STATION_SIZE.w
const D = STATION_SIZE.d

export function Station({ def, index }: { def: StationDef; index: number }) {
  const frame = stationFrame()
  const x = stationX(index)
  const focused = useFactory((s) => s.focusStationId === def.id)
  const focusStation = useFactory((s) => s.focusStation)
  const setView = useFactory((s) => s.setView)
  const [hovered, setHovered] = useState(false)

  return (
    <group
      position={[x, 0, 0]}
      onClick={(e) => {
        e.stopPropagation()
        if (focused) {
          focusStation(null)
          setView('overview')
        } else {
          focusStation(def.id)
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >
      {/* 基座 */}
      <mesh position={[0, 0.075, 0]} material={MATS.deepSteel()} receiveShadow castShadow>
        <boxGeometry args={[W + 0.16, 0.15, D + 0.16]} />
      </mesh>

      {/* 铝型材机架（型材 + 角码 + 调平脚 + 走线槽，合并成 1 个 mesh） */}
      <mesh geometry={frame.geometry} material={frame.material} castShadow receiveShadow />

      {/* 工站色灯带 */}
      <mesh position={[0, 2.255, D / 2 - 0.055]} material={MATS.glow(def.accent, focused ? 2.4 : 1.15)}>
        <boxGeometry args={[W - 0.5, 0.026, 0.018]} />
      </mesh>

      <Cabinet accent={def.accent} />
      <Arm accent={def.accent} stationId={def.id} />
      <ToolHead id={def.id} accent={def.accent} />
      <BinGantry />
      <Bin stationId={def.id} accent={def.accent} code={def.code} name={def.name} />
      <Beacon accent={def.accent} stationId={def.id} />

      {/* 选中/悬停地环 */}
      {(hovered || focused) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[1.62, 1.7, 64]} />
          <meshBasicMaterial color={def.accent} transparent opacity={focused ? 0.9 : 0.35} />
        </mesh>
      )}
    </group>
  )
}