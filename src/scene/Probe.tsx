import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { FLAGS } from '@/lib/flags'
import { sim } from '@/sim/sim'

/**
 * 开发期自检探针（仅 ?probe=1 时输出）：
 * 帧率、GPU 型号、关键物体屏幕投影，以及把画面降采样成 ASCII 亮度图 + 直方图。
 * 运行中按 P 可随时抓一帧，用来确认物料是不是真的在流动。
 */
const POINTS: [string, number, number, number][] = [
  ['S1', -9, 1.5, 0],
  ['S4', 0, 1.5, 0],
  ['S7', 9, 1.5, 0],
  ['shelf', 11.9, 1.2, -1.9],
  ['warehouse', -12.2, 1.6, -5.0],
  ['binS1', -9, 3.0, 0.29],
]

export function Probe() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const state = useRef({ t0: 0, frames: 0, logged: 0 })
  const captureReq = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') captureReq.current = true
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    let n = 0
    const t0 = performance.now()
    let id = 0
    const loop = () => {
      n += 1
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    const to = window.setTimeout(() => {
      const dt = (performance.now() - t0) / 1000
      console.log(`[raf] ${n} ticks in ${dt.toFixed(1)}s => ${(n / dt).toFixed(1)}Hz visibility=${document.visibilityState}`)
      cancelAnimationFrame(id)
      window.clearTimeout(to)
    }, 5000)
  }, [])

  const dump = useCallback(() => {
    const ctx = gl.getContext()
    const W = 84
    const H = 34
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')
    if (!g) return
    g.drawImage(gl.domElement, 0, 0, W, H)
    const { data } = g.getImageData(0, 0, W, H)
    const chars = ' .:-=+*#%@'
    let out = ''
    let sum = 0
    const buckets = new Array(6).fill(0)
    for (let y = 0; y < H; y++) {
      let line = ''
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        const l = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
        sum += l
        const b = l < 0.05 ? 0 : l < 0.15 ? 1 : l < 0.3 ? 2 : l < 0.5 ? 3 : l < 0.7 ? 4 : 5
        buckets[b] += 1
        line += chars[Math.min(chars.length - 1, Math.floor(Math.pow(l, 0.38) * chars.length))]
      }
      out += line + '\n'
    }
    console.log(`[ascii]\n${out}`)
    const total = W * H
    console.log(
      `[hist] ${buckets
        .map((n, i) => `${['<.05', '.05-.15', '.15-.3', '.3-.5', '.5-.7', '>.7'][i]}=${((n / total) * 100).toFixed(1)}%`)
        .join('  ')}`,
    )
    console.log(`[probe] meanLuma=${(sum / total).toFixed(3)}`)
    console.log(
      `[sim] 在制=${sim.products.length} ` +
        sim.products
          .slice(0, 8)
          .map((p) => `${p.item}@${p.x.toFixed(1)}/${p.mode}`)
          .join(' '),
    )
  }, [gl])

  useFrame(() => {
    const s = state.current
    const now = performance.now()
    if (s.t0 === 0) s.t0 = now
    s.frames += 1

    const elapsed = now - s.t0
    if (s.logged < 3 && elapsed >= 3000) {
      s.logged += 1
      const ctx = gl.getContext()
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info')
      const gpu = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown'
      const fps = (s.frames * 1000) / elapsed
      console.log(`[probe#${s.logged}] gpu="${gpu}" fps≈${fps.toFixed(1)} frames=${s.frames}`)

      const v = new THREE.Vector3()
      const w = gl.domElement.clientWidth
      const h = gl.domElement.clientHeight
      const proj = POINTS.map(([name, x, y, z]) => {
        v.set(x, y, z).project(camera)
        return `${name}=(${Math.round(((v.x + 1) / 2) * w)},${Math.round(((1 - v.y) / 2) * h)})`
      }).join(' ')
      console.log(`[proj] ${proj} viewport=${w}x${h}`)

      if (s.logged === 1 && FLAGS.ascii) dump()
    }

    if (captureReq.current) {
      captureReq.current = false
      dump()
    }
  })

  return null
}