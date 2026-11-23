import * as THREE from 'three'

interface MatOpts {
  roughness?: number
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
  flatShading?: boolean
}

const cache = new Map<string, THREE.MeshStandardMaterial>()

/**
 * 材质缓存：同色同参数复用同一个材质实例，
 * 减少状态切换与显存占用（7 个工站共用白铝/钢/橡胶）。
 */
export function mat(color: string, opts: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${opts.roughness ?? 0.6}|${opts.metalness ?? 0.2}|${opts.emissive ?? '-'}|${
    opts.emissiveIntensity ?? 1
  }|${opts.transparent ? 1 : 0}|${opts.opacity ?? 1}|${opts.flatShading ? 1 : 0}`

  const hit = cache.get(key)
  if (hit) return hit

  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness ?? 0.6,
    metalness: opts.metalness ?? 0.2,
    emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color('#000000'),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    flatShading: opts.flatShading ?? false,
  })
  if (m.transparent) m.depthWrite = false
  cache.set(key, m)
  return m
}

/** 常用材质，语义化命名，避免各处手写数值 */
export const MATS = {
  aluminum: () => mat('#cdd2d8', { roughness: 0.26, metalness: 0.9 }),
  aluminumDark: () => mat('#9aa1a9', { roughness: 0.4, metalness: 0.8 }),
  steel: () => mat('#7d848c', { roughness: 0.45, metalness: 0.7 }),
  darkSteel: () => mat('#3b424a', { roughness: 0.55, metalness: 0.5 }),
  deepSteel: () => mat('#23282e', { roughness: 0.65, metalness: 0.4 }),
  whitePlastic: () => mat('#eef1f4', { roughness: 0.42, metalness: 0.05 }),
  rubber: () => mat('#12151a', { roughness: 0.95, metalness: 0.05 }),
  glassTint: (color: string) => mat(color, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.16 }),
  glow: (color: string, intensity = 2.2) =>
    mat(color, { roughness: 0.4, metalness: 0, emissive: color, emissiveIntensity: intensity }),
}

/** 释放缓存（热更新时避免泄漏） */
export function disposeMaterialCache() {
  for (const m of cache.values()) m.dispose()
  cache.clear()
}