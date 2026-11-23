import { C } from '@/lib/palette'

/** 车间照明：半球打底 + 主光投影 + 冷色补光（灯具几何在 Hall 里） */
export function Lights({ shadowMapSize = 2048 }: { shadowMapSize?: number }) {
  return (
    <>
      <hemisphereLight args={['#dbe9f7', '#0d1116', 1.05]} />

      <directionalLight
        position={[9, 14, 8]}
        intensity={2.9}
        color="#ffffff"
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-camera-left={-21}
        shadow-camera-right={21}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={1}
        shadow-camera-far={64}
      />

      <directionalLight position={[-11, 7, -9]} intensity={0.8} color="#8fb8da" />
      <directionalLight position={[2, 5, 15]} intensity={0.4} color="#a9c8e4" />

      {/* 两端局部补光，避免仓库与出货区发闷 */}
      <pointLight position={[-12.4, 3.4, -3.5]} intensity={22} distance={14} color="#9ec7ea" />
      <pointLight position={[12.4, 3.4, 3]} intensity={22} distance={13} color="#bfe3ff" />

      {/* 极弱环境色，给金属一点冷调 */}
      <ambientLight intensity={0.25} color={C.accent} />
    </>
  )
}