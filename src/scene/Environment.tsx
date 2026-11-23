import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * 程序化环境贴图：用 three 自带的 RoomEnvironment（纯几何体）烘一张 PMREM。
 * 没有它，金属件（metalness > 0.6）会因为无处可反射而发黑。
 * 零外部资源：不下载任何 HDR。
 */
export function StudioEnvironment({ intensity = 1.15 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    pmrem.compileEquirectangularShader()
    const room = new RoomEnvironment()
    const rt = pmrem.fromScene(room, 0.04)
    scene.environment = rt.texture
    scene.environmentIntensity = intensity

    return () => {
      scene.environment = null
      rt.dispose()
      room.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, intensity])

  return null
}