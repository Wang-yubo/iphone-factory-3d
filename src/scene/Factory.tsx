import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { CAMERA_PRESETS } from '@/lib/layout'
import { C } from '@/lib/palette'
import { STATIONS } from '@/sim/recipes'
import { fillAllBins } from '@/sim/sim'
import { useFactory } from '@/store/useFactory'
import { FLAGS } from '@/lib/flags'
import { BinPicker } from './BinPicker'
import { CameraRig } from './CameraRig'
import { Probe } from './Probe'
import { Products } from './Products'
import { Conveyor } from './Conveyor'
import { StudioEnvironment } from './Environment'
import { Effects } from './Effects'
import { Ground } from './Ground'
import { Guards } from './Guard'
import { Hall } from './Hall'
import { Lights } from './Lights'
import { Logistics } from './Logistics'
import { FloorDetail } from './FloorDetail'
import { Loop } from './Loop'
import { People } from './People'
import { ScrapArea } from './Scrap'
import { Shipments } from './Shipments'
import { Shelf } from './Shelf'
import { Station } from './Station'
import { Warehouse } from './Warehouse'
import { Workshop } from './Workshop'

export function Factory() {
  const quality = useFactory((s) => s.quality)
  const probing = import.meta.env.DEV && FLAGS.probe
  const shadows = quality !== 'low' && !FLAGS.noShadow

  useEffect(() => {
    if (!FLAGS.full) return
    fillAllBins()
    useFactory.getState().bump()
  }, [])

  return (
    <Canvas
      shadows={shadows}
      dpr={quality === 'high' ? [1, 1.75] : quality === 'medium' ? [1, 1.25] : 1}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: probing && FLAGS.ascii }}
      camera={{
        position: CAMERA_PRESETS.overview.pos,
        fov: 42,
        near: 0.4,
        far: 140,
      }}
      onPointerMissed={() => {
        const st = useFactory.getState()
        if (st.focusStationId !== null) st.focusStation(null)
        if (st.focusProductId !== null) st.focusProduct(null)
      }}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.fog, 38, 88]} />

      <Suspense fallback={null}>
        {!FLAGS.noEnv && <StudioEnvironment />}
        <Lights shadowMapSize={quality === 'high' ? 2048 : 1024} />
        <Hall />
        <Workshop />
        <FloorDetail />
        <People />
        <Guards />
        <Logistics />
        <Ground />
        <Conveyor />
        <Products />
        {STATIONS.map((def, index) => (
          <Station key={def.id} def={def} index={index} />
        ))}
        <ScrapArea />
        <Shipments />
        <Warehouse />
        <Shelf />
        <Loop />
        <BinPicker />
        <CameraRig />
        {probing && <Probe />}
        <Effects enabled={quality !== 'low' && !FLAGS.noBloom} />
      </Suspense>
    </Canvas>
  )
}