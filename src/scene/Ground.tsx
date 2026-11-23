import { Grid } from '@react-three/drei'
import { GROUND, LINE } from '@/lib/layout'
import { GROUND_MARKS_SIZE, groundMarksTexture } from './groundMarks'
import { C } from '@/lib/palette'

/** 车间地面：深灰哑光 + 网格线 + 产线安全区 */
export function Ground() {
  const cx = (LINE.x0 + LINE.x1) / 2
  const len = LINE.x1 - LINE.x0

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[GROUND.w, GROUND.d]} />
        <meshStandardMaterial color={C.floor} roughness={0.9} metalness={0.1} />
      </mesh>

      {/* 产线区域：略浅的环氧地坪色块 */}
      <mesh position={[cx, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[len + 7, 5]} />
        <meshStandardMaterial color="#22282f" roughness={0.8} metalness={0.14} />
      </mesh>

      <Grid
        position={[cx, 0.004, 0]}
        args={[len + 7, 5]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#2e373f"
        sectionSize={2.5}
        sectionThickness={1}
        sectionColor="#3b464f"
        fadeDistance={40}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      {/* 地面标线：安全区 / 工站落位 / 物流箭头 / 人行通道 */}
      <mesh position={[cx, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[GROUND_MARKS_SIZE[0], GROUND_MARKS_SIZE[1]]} />
        <meshBasicMaterial map={groundMarksTexture()} transparent depthWrite={false} />
      </mesh>

      {/* 地面接收阴影的暗部收边 */}
      <mesh position={[cx, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[len + 9, GROUND.d - 1]} />
        <meshBasicMaterial color="#0e1115" transparent opacity={0.25} />
      </mesh>
    </group>
  )
}