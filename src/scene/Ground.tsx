import { Grid } from '@react-three/drei'
import { GROUND, LINE } from '@/lib/layout'
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

      {/* 安全黄线 */}
      {[-2.45, 2.45].map((z) => (
        <mesh key={z} position={[cx, 0.006, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[len + 7, 0.05]} />
          <meshBasicMaterial color={C.safety} transparent opacity={0.45} />
        </mesh>
      ))}

      {/* 地面接收阴影的暗部收边 */}
      <mesh position={[cx, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[len + 9, GROUND.d - 1]} />
        <meshBasicMaterial color="#0e1115" transparent opacity={0.25} />
      </mesh>
    </group>
  )
}