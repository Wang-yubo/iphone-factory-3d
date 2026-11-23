import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { COL, box, cyl, merge, strut, tintedMaterial } from './geo'

/**
 * 车间配套：厂房围护、洁净送风（FFU + 风管）、动力配电柜、压缩空气站与管路、
 * 老化测试架、物料暂存区、工具柜、消防器材。
 *
 * 全部静态，合并成 4 个顶点色 mesh + 1 个自发光 mesh，总开销约 5 个 draw call。
 */

const WALL_Z = -9.6
const HALL_X = 18
const HALL_H = 7.2

const WALL_LOW = new THREE.Color('#2b3138')
const WALL_HI = new THREE.Color('#4a525a')
const GLASS = new THREE.Color('#1d2b38')
const FRAME = new THREE.Color('#8f979f')
const LIGHT = new THREE.Color('#dff1ff')

/** 厂房围护：后墙 + 两端墙 + 窗带 + 踢脚 + 左侧办公夹层 */
function buildBuilding() {
  const p: THREE.BufferGeometry[] = []

  // 后墙（分段，留出竖向分缝）
  const seg = 3
  for (let x = -HALL_X; x < HALL_X; x += seg) {
    const w = Math.min(seg, HALL_X - x)
    // 踢脚
    box(p, w - 0.04, 1.15, 0.25, x + w / 2, 0.575, WALL_Z, WALL_LOW)
    // 窗下墙
    box(p, w - 0.04, 1.3, 0.2, x + w / 2, 1.8, WALL_Z, WALL_HI)
    // 窗带（深色玻璃）
    box(p, w - 0.12, 2.1, 0.12, x + w / 2, 3.5, WALL_Z + 0.02, GLASS)
    // 窗上墙
    box(p, w - 0.04, 2.7, 0.2, x + w / 2, 5.9, WALL_Z, WALL_HI)
    // 竖向分缝
    box(p, 0.06, 6.9, 0.26, x, 3.45, WALL_Z, COL.deep)
    // 窗框
    box(p, w - 0.04, 0.06, 0.24, x + w / 2, 2.46, WALL_Z, FRAME)
    box(p, w - 0.04, 0.06, 0.24, x + w / 2, 4.54, WALL_Z, FRAME)
  }

  // 两端墙
  for (const sx of [-1, 1]) {
    const x = sx * HALL_X
    box(p, 0.25, 1.15, 18, x, 0.575, -0.6, WALL_LOW)
    box(p, 0.2, 1.3, 18, x, 1.8, -0.6, WALL_HI)
    box(p, 0.12, 2.1, 17.6, x - sx * 0.02, 3.5, -0.6, GLASS)
    box(p, 0.2, 2.7, 18, x, 5.9, -0.6, WALL_HI)
    for (let z = -9; z < 9; z += 3) {
      box(p, 0.26, 6.9, 0.06, x, 3.45, z, COL.deep)
    }
  }

  // 左端办公夹层（两层的盒子，带窗）
  box(p, 4.6, 0.25, 7.2, -15.4, 3.1, -5.6, COL.dark)
  box(p, 4.4, 2.6, 7.0, -15.4, 4.5, -5.6, WALL_HI)
  box(p, 4.2, 1.1, 6.8, -15.4, 4.2, -5.6 + 3.42, GLASS)
  box(p, 4.4, 0.2, 7.2, -15.4, 5.85, -5.6, COL.deep)
  // 夹层栏杆
  for (let z = -8.9; z <= -2.3; z += 0.55) {
    box(p, 0.04, 1.0, 0.04, -13.15, 3.6, z, FRAME)
  }
  box(p, 0.06, 0.06, 6.7, -13.15, 4.1, -5.6, FRAME)

  // 后墙两扇卷帘门
  for (const x of [-6, 7.5]) {
    box(p, 3.2, 3.0, 0.12, x, 1.5, WALL_Z + 0.16, COL.aluDark)
    for (let i = 0; i < 10; i++) {
      box(p, 3.1, 0.03, 0.14, x, 0.2 + i * 0.29, WALL_Z + 0.18, COL.steel)
    }
    box(p, 3.6, 0.18, 0.3, x, 3.1, WALL_Z + 0.16, COL.dark)
  }

  return merge(p)
}

/** 顶部：FFU 送风单元框架 + 矩形风管 + 吊杆 */
function buildCeiling() {
  const p: THREE.BufferGeometry[] = []

  // FFU：1.2 × 1.2 的方形送风单元
  for (let x = -12; x <= 12; x += 6) {
    for (let z = -6; z <= 3; z += 4.5) {
      box(p, 1.24, 0.14, 1.24, x, 6.35, z, COL.aluDark)
      box(p, 1.1, 0.04, 1.1, x, 6.27, z, COL.deep)
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          box(p, 0.03, 0.9, 0.03, x + sx * 0.56, 6.85, z + sz * 0.56, COL.steel)
        }
      }
    }
  }

  // 矩形风管（沿 X 两条）
  for (const z of [-7.2, 4.4]) {
    box(p, 34, 0.55, 0.9, 0, 6.75, z, COL.aluDark)
    for (let x = -16; x <= 16; x += 2) {
      box(p, 0.05, 0.02, 0.92, x, 7.03, z, COL.deep)
    }
    // 吊杆
    for (let x = -15; x <= 15; x += 3.5) {
      box(p, 0.025, 0.7, 0.025, x, 7.1, z - 0.4, COL.steel)
      box(p, 0.025, 0.7, 0.025, x, 7.1, z + 0.4, COL.steel)
    }
    // 支管
    for (let x = -12; x <= 12; x += 6) {
      box(p, 0.45, 0.4, 0.7, x, 6.6, z + (z < 0 ? 0.9 : -0.9), COL.aluDark)
    }
  }

  return merge(p)
}

/** 动力与公用工程：配电柜排、空压机站、压缩空气主管与支管、消防器材 */
function buildUtilities() {
  const p: THREE.BufferGeometry[] = []

  // 配电柜（后墙左侧一排 5 面）
  for (let i = 0; i < 5; i++) {
    const x = -13.4 + i * 0.85
    box(p, 0.8, 2.1, 0.55, x, 1.05, WALL_Z + 0.6, COL.aluDark)
    box(p, 0.72, 1.9, 0.02, x, 1.05, WALL_Z + 0.89, COL.steel)
    // 仪表与指示灯位
    box(p, 0.5, 0.24, 0.03, x, 1.7, WALL_Z + 0.9, COL.deep)
    // 散热百叶
    for (let j = 0; j < 6; j++) {
      box(p, 0.56, 0.02, 0.02, x, 0.35 + j * 0.06, WALL_Z + 0.9, COL.dark)
    }
    // 顶部线槽
    box(p, 0.86, 0.12, 0.6, x, 2.16, WALL_Z + 0.6, COL.dark)
  }

  // 空压机站（后墙右侧）
  const cx = 9.2
  box(p, 1.5, 1.35, 1.0, cx, 0.68, WALL_Z + 0.75, COL.aluDark) // 主机
  box(p, 1.3, 0.1, 0.9, cx, 1.4, WALL_Z + 0.75, COL.dark)
  cyl(p, 0.42, 2.0, cx + 1.45, 1.0, WALL_Z + 0.8, COL.steel) // 储气罐
  cyl(p, 0.44, 0.08, cx + 1.45, 2.02, WALL_Z + 0.8, COL.dark)
  cyl(p, 0.44, 0.08, cx + 1.45, 0.04, WALL_Z + 0.8, COL.dark)
  box(p, 0.9, 0.8, 0.7, cx + 2.4, 0.4, WALL_Z + 0.75, COL.aluDark) // 冷干机
  box(p, 1.7, 0.12, 1.2, cx, 0.06, WALL_Z + 0.75, COL.deep) // 基础

  // 压缩空气主管（沿后墙，y=3.55）
  const airY = 3.55
  cyl(p, 0.065, 32, 0, airY, WALL_Z + 0.35, COL.steel, 'x', 12)
  // 支管：每站一路下到机台
  for (let i = 0; i < 7; i++) {
    const x = -9 + i * 3
    cyl(p, 0.032, 1.0, x, airY + 0.5, WALL_Z + 0.35, COL.steel, 'y', 10)
    cyl(p, 0.032, 7.3, x, airY - 1.9, WALL_Z + 0.9, COL.steel, 'z', 10)
    cyl(p, 0.032, 1.9, x, airY - 1.9 - 0.95, -1.55, COL.steel, 'y', 10)
    // 三联件（过滤减压阀）
    box(p, 0.14, 0.3, 0.12, x, 1.55, -1.55, COL.dark)
    box(p, 0.2, 0.04, 0.16, x, 1.86, WALL_Z + 0.35, COL.dark)
  }
  // 管道支架
  for (let x = -15; x <= 15; x += 4) {
    box(p, 0.04, 0.3, 0.04, x, airY + 0.18, WALL_Z + 0.35, COL.dark)
  }

  // 消防器材：灭火器 + 消防栓
  for (const x of [-11.5, 3.5, 14]) {
    cyl(p, 0.075, 0.42, x, 0.23, WALL_Z + 0.95, COL.red, 'y', 12)
    cyl(p, 0.03, 0.12, x, 0.48, WALL_Z + 0.95, COL.dark, 'y', 8)
  }
  box(p, 0.55, 0.75, 0.2, -16.6, 0.95, WALL_Z + 0.75, COL.red)
  cyl(p, 0.09, 0.3, -16.6, 0.45, WALL_Z + 0.6, COL.steel, 'x', 10)

  return merge(p)
}

/** 生产配套：老化测试架、物料暂存、工具柜、周转车 */
function buildProps() {
  const p: THREE.BufferGeometry[] = []

  // 老化测试架（右后，两组三层）
  for (let r = 0; r < 2; r++) {
    const x0 = 12.4 + r * 1.9
    for (const sz of [-1, 1]) {
      box(p, 0.07, 1.9, 0.07, x0, 0.95, WALL_Z + 1.2 + sz * 0.55, COL.aluDark)
      box(p, 0.07, 1.9, 0.07, x0 + 1.6, 0.95, WALL_Z + 1.2 + sz * 0.55, COL.aluDark)
    }
    for (let s = 0; s < 3; s++) {
      const y = 0.45 + s * 0.55
      box(p, 1.7, 0.04, 1.2, x0 + 0.8, y, WALL_Z + 1.2, COL.steel)
      // 每层放 4 台测试中的机器（用暗色方块示意）
      for (let i = 0; i < 4; i++) {
        box(p, 0.16, 0.02, 0.3, x0 + 0.3 + i * 0.38, y + 0.03, WALL_Z + 1.2, COL.deep)
      }
    }
  }

  // 物料暂存（左前）：两垛托盘 + 纸箱
  for (let s = 0; s < 2; s++) {
    const bx = -14.2 + s * 1.4
    const bz = 3.2
    box(p, 1.15, 0.12, 0.95, bx, 0.06, bz, COL.wood)
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        box(p, 0.5, 0.34, 0.42, bx - 0.28 + j * 0.56, 0.29 + i * 0.35, bz, COL.aluDark)
      }
    }
  }

  // 工具柜 + 工作台（左前）
  box(p, 1.2, 0.85, 0.6, -11.6, 0.42, 3.4, COL.aluDark)
  for (let i = 0; i < 3; i++) {
    box(p, 1.1, 0.02, 0.02, -11.6, 0.2 + i * 0.25, 3.71, COL.dark)
  }
  box(p, 1.9, 0.06, 0.75, -11.6, 0.9, 4.4, COL.steel)
  for (const dx of [-0.85, 0.85]) {
    box(p, 0.06, 0.9, 0.06, -11.6 + dx, 0.45, 4.4, COL.dark)
  }
  // 台上零件盒
  for (let i = 0; i < 4; i++) {
    box(p, 0.3, 0.12, 0.3, -12.3 + i * 0.45, 0.99, 4.4, COL.aluDark)
  }

  // 周转车
  box(p, 0.9, 0.05, 0.6, -8.6, 0.78, 4.2, COL.steel)
  box(p, 0.9, 0.05, 0.6, -8.6, 0.4, 4.2, COL.steel)
  for (const dx of [-0.42, 0.42]) {
    for (const dz of [-0.26, 0.26]) {
      box(p, 0.05, 0.78, 0.05, -8.6 + dx, 0.39, 4.2 + dz, COL.dark)
    }
  }

  return merge(p)
}

/** 自发光件：FFU 灯面、配电柜指示灯、安全出口灯、老化架指示灯 */
function buildEmissive() {
  const p: THREE.BufferGeometry[] = []

  // FFU 灯面
  for (let x = -12; x <= 12; x += 6) {
    for (let z = -6; z <= 3; z += 4.5) {
      box(p, 1.02, 0.02, 1.02, x, 6.22, z, LIGHT)
    }
  }
  // 配电柜指示灯
  for (let i = 0; i < 5; i++) {
    const x = -13.4 + i * 0.85
    box(p, 0.26, 0.03, 0.01, x, 1.62, WALL_Z + 0.91, new THREE.Color('#57d99a'))
    box(p, 0.1, 0.03, 0.01, x + 0.22, 1.62, WALL_Z + 0.91, new THREE.Color('#c19a26'))
  }
  // 安全出口（两樘门上方）
  for (const x of [-6, 7.5]) {
    box(p, 0.7, 0.22, 0.05, x, 3.4, WALL_Z + 0.22, new THREE.Color('#3ddc84'))
  }
  // 老化架上的测试指示灯
  for (let r = 0; r < 2; r++) {
    const x0 = 12.4 + r * 1.9
    for (let s = 0; s < 3; s++) {
      for (let i = 0; i < 4; i++) {
        box(p, 0.1, 0.006, 0.18, x0 + 0.3 + i * 0.38, 0.48 + s * 0.55, WALL_Z + 1.2, new THREE.Color('#2fb8ff'))
      }
    }
  }

  return merge(p)
}

export function Workshop() {
  const geos = useMemo(
    () => ({ building: buildBuilding(), ceiling: buildCeiling(), utilities: buildUtilities(), props: buildProps(), emissive: buildEmissive() }),
    [],
  )
  const mat = tintedMaterial()
  const glow = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.6, metalness: 0, roughness: 0.5 }),
    [],
  )

  useEffect(() => {
    return () => {
      Object.values(geos).forEach((g) => g.dispose())
      glow.dispose()
    }
  }, [geos, glow])

  return (
    <group>
      <mesh geometry={geos.building} material={mat} receiveShadow />
      <mesh geometry={geos.ceiling} material={mat} castShadow />
      <mesh geometry={geos.utilities} material={mat} castShadow receiveShadow />
      <mesh geometry={geos.props} material={mat} castShadow receiveShadow />
      <mesh geometry={geos.emissive} material={glow} />
    </group>
  )
}