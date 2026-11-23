import { useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { useFactory } from '@/store/useFactory'
import { binTargets } from './binRegistry'

function findStation(obj: THREE.Object3D | undefined): number | null {
  let o: THREE.Object3D | null | undefined = obj
  while (o) {
    if (typeof o.userData.stationId === 'number') return o.userData.stationId
    o = o.parent
  }
  return null
}

/**
 * 拖拽/点选原料时，每帧用射线找鼠标下方的料仓，
 * 高亮由 Bin 自己根据 hoverBin 处理。
 */
export function BinPicker() {
  const camera = useThree((s) => s.camera)
  const raycaster = useThree((s) => s.raycaster)
  const pointer = useThree((s) => s.pointer)

  useFrame(() => {
    const st = useFactory.getState()
    const engaged = st.drag?.active || st.selected !== null
    if (!engaged) {
      if (st.hoverBin !== null) st.setHoverBin(null)
      return
    }
    raycaster.setFromCamera(pointer, camera)
    const targets = [...binTargets.values()]
    const hit = targets.length ? raycaster.intersectObjects(targets, true)[0] : undefined
    const id = hit ? findStation(hit.object) : null
    if (id !== st.hoverBin) st.setHoverBin(id)
  })

  return null
}
