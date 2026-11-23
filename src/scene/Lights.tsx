import { C } from '@/lib/palette'

/**
 * 车间照明：整体压暗 + 局部提亮，做出"灯下亮、过道暗"的层次。
 * 主光负责投影和金属高光，3 盏点光在产线上方形成光池。
 */
export function Lights({ shadowMapSize = 2048 }: { shadowMapSize?: number }) {
  return (
    <>
      {/* 天光：上冷下暗，压到 0.7 让局部光有存在感 */}
      <hemisphereLight args={['#cfe3f5', '#080b0e', 0.86]} />

      {/* 主光：略暖，负责投影与金属高光 */}
      <directionalLight
        position={[9, 15, 9]}
        intensity={3.2}
        color="#fff5e8"
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-left={-21}
        shadow-camera-right={21}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={1}
        shadow-camera-far={64}
      />

      {/* 冷色补光：从后方勾轮廓 */}
      <directionalLight position={[-11, 7, -10]} intensity={0.6} color="#8fb8da" />
      {/* 前方极弱补光，避免正面死黑 */}
      <directionalLight position={[2, 5, 16]} intensity={0.22} color="#a9c8e4" />

      {/* 产线上方的三盏工位光，形成光池 */}
      {[-6, 0, 6].map((x) => (
        <pointLight key={x} position={[x, 5.1, -1.1]} intensity={16} distance={9} decay={2} color="#e6f2ff" />
      ))}

      {/* 出货区与仓库的局部照明 */}
      <pointLight position={[12.4, 3.6, -1.4]} intensity={14} distance={8} decay={2} color="#dff0ff" />
      <pointLight position={[-12.2, 3.6, -4.6]} intensity={12} distance={8} decay={2} color="#cfe6f7" />

      {/* 极弱环境色，只用于提亮暗部色相 */}
      <ambientLight intensity={0.14} color={C.accent} />
    </>
  )
}
