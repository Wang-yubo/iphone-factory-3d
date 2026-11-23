import * as THREE from 'three'
import { stationX } from '@/lib/layout'
import { STATIONS } from '@/sim/recipes'

/**
 * 地面标线：安全区虚线边框、7 个工站落位框与编号、物流方向箭头、人行通道实线。
 * 用一张程序化 Canvas 贴图铺在产线区地面上，0 外部资源、1 个 draw call。
 */

const MAP_W = 26 // 米
const MAP_H = 6.5

let cached: THREE.CanvasTexture | null = null

export function groundMarksTexture() {
  if (cached) return cached

  const W = 2048
  const H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!

  const px = (x: number) => ((x + MAP_W / 2) / MAP_W) * W
  const py = (z: number) => ((MAP_H / 2 - z) / MAP_H) * H
  const s = (m: number) => (m / MAP_W) * W

  const YELLOW = 'rgba(196, 154, 46, 0.62)'
  const DIM = 'rgba(180, 196, 208, 0.17)'

  // 安全区虚线外框
  g.strokeStyle = YELLOW
  g.lineWidth = s(0.07)
  g.setLineDash([s(0.34), s(0.22)])
  g.strokeRect(px(-12.7), py(3.0), s(25.4), s(6.0))

  // 人行通道实线
  g.setLineDash([])
  g.strokeStyle = 'rgba(196, 154, 46, 0.38)'
  g.lineWidth = s(0.09)
  for (const z of [-2.62, 2.62]) {
    g.beginPath()
    g.moveTo(px(-12.6), py(z))
    g.lineTo(px(12.6), py(z))
    g.stroke()
  }

  // 工站落位框 + 编号
  g.setLineDash([s(0.16), s(0.12)])
  g.lineWidth = s(0.045)
  for (let i = 0; i < STATIONS.length; i++) {
    const x = stationX(i)
    g.strokeStyle = DIM
    g.strokeRect(px(x - 1.34), py(1.52), s(2.68), s(3.04))

    // 编号牌
    g.setLineDash([])
    g.fillStyle = 'rgba(12, 18, 24, 0.55)'
    g.fillRect(px(x - 0.42), py(1.74), s(0.84), s(0.36))
    g.fillStyle = 'rgba(200, 214, 226, 0.75)'
    g.font = `600 ${Math.round(s(0.26))}px ui-monospace, Menlo, monospace`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(STATIONS[i].code, px(x), py(1.56))
    g.setLineDash([s(0.16), s(0.12)])
  }

  // 物流方向箭头（沿产线两侧）
  g.setLineDash([])
  g.strokeStyle = YELLOW
  g.lineWidth = s(0.075)
  g.lineCap = 'round'
  for (const z of [-2.15, 2.15]) {
    for (let x = -11; x <= 11; x += 3.0) {
      g.beginPath()
      g.moveTo(px(x - 0.28), py(z) - s(0.2))
      g.lineTo(px(x), py(z))
      g.lineTo(px(x - 0.28), py(z) + s(0.2))
      g.stroke()
    }
  }

  // 区域名
  g.fillStyle = 'rgba(196, 154, 46, 0.42)'
  g.font = `700 ${Math.round(s(0.34))}px -apple-system, "PingFang SC", sans-serif`
  g.textAlign = 'left'
  g.fillText('生产区 A', px(-12.55), py(2.36))
  g.font = `500 ${Math.round(s(0.2))}px ui-monospace, monospace`
  g.fillStyle = 'rgba(196, 154, 46, 0.3)'
  g.fillText('PRODUCTION LINE · 7 STATIONS', px(-12.55), py(2.66) + s(0.42))

  cached = new THREE.CanvasTexture(c)
  cached.colorSpace = THREE.SRGBColorSpace
  cached.anisotropy = 8
  return cached
}

export const GROUND_MARKS_SIZE = [MAP_W, MAP_H] as const
