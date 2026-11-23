import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { stationX } from '@/lib/layout'
import { STATIONS } from '@/sim/recipes'

/**
 * 地坪细节：
 *  - FFU 正下方的柔和光斑（径向渐变贴图 + 加色混合）
 *  - 每个工位前的 ESD 防静电地垫
 */

let poolTex: THREE.CanvasTexture | null = null
function lightPoolTexture() {
  if (poolTex) return poolTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  grad.addColorStop(0, 'rgba(210,236,255,0.9)')
  grad.addColorStop(0.45, 'rgba(150,210,255,0.28)')
  grad.addColorStop(1, 'rgba(120,190,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  poolTex = new THREE.CanvasTexture(c)
  poolTex.colorSpace = THREE.SRGBColorSpace
  return poolTex
}

export function FloorDetail() {
  // 光斑与 FFU 位置对齐
  const pools = useMemo(() => {
    const list: THREE.BufferGeometry[] = []
    for (let x = -12; x <= 12; x += 6) {
      for (let z = -6; z <= 3.1; z += 4.5) {
        const g = new THREE.PlaneGeometry(4.6, 4.6)
        g.rotateX(-Math.PI / 2)
        g.translate(x, 0.021, z)
        list.push(g)
      }
    }
    const merged = mergeGeometries(list, false)!
    for (const g of list) g.dispose()
    return merged
  }, [])

  const mats = useMemo(() => {
    const list: THREE.BufferGeometry[] = []
    for (let i = 0; i < STATIONS.length; i++) {
      const g = new THREE.PlaneGeometry(2.3, 1.55)
      g.rotateX(-Math.PI / 2)
      g.translate(stationX(i), 0.014, 2.06)
      list.push(g)
    }
    // 工作台前也铺一块
    const wb = new THREE.PlaneGeometry(2.4, 1.6)
    wb.rotateX(-Math.PI / 2)
    wb.translate(-11.6, 0.014, 4.6)
    list.push(wb)
    const merged = mergeGeometries(list, false)!
    for (const g of list) g.dispose()
    return merged
  }, [])

  const poolMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: lightPoolTexture(),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  const matMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#151d24', roughness: 0.92, metalness: 0.05 }),
    [],
  )

  useEffect(() => {
    return () => {
      pools.dispose()
      mats.dispose()
      poolMat.dispose()
      matMat.dispose()
    }
  }, [pools, mats, poolMat, matMat])

  return (
    <group>
      <mesh geometry={pools} material={poolMat} />
      <mesh geometry={mats} material={matMat} receiveShadow />
    </group>
  )
}
