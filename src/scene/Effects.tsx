import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

/** 轻量后处理：只要一点辉光把灯带和料仓点亮，不做重口味霓虹 */
export function Effects({ enabled = true }: { enabled?: boolean }) {
  if (!enabled) return null
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={0.5} luminanceThreshold={0.75} luminanceSmoothing={0.3} mipmapBlur radius={0.6} />
      <Vignette offset={0.3} darkness={0.66} eskil={false} />
    </EffectComposer>
  )
}
