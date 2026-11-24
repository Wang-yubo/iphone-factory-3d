import { create } from 'zustand'
import { FLAGS } from '@/lib/flags'
import type { Difficulty } from '@/sim/difficulty'
import { resetSim } from '@/sim/sim'
import type { MaterialId } from '@/sim/recipes'

export type LineState = 'idle' | 'running' | 'paused'
export type Quality = 'high' | 'medium' | 'low'

const readQuality = (): Quality => {
  try {
    const v = localStorage.getItem('factory.quality')
    if (v === 'medium' || v === 'low') return v
  } catch {
    /* ignore */
  }
  return 'high'
}

const readDifficulty = (): Difficulty => {
  try {
    const v = localStorage.getItem('factory.difficulty')
    if (v === 'easy' || v === 'hard') return v
  } catch {
    /* ignore */
  }
  return 'normal'
}

const readGuideDone = () => {
  try {
    return localStorage.getItem('factory.guideDone') === '1'
  } catch {
    return false
  }
}
export type Speed = 1 | 2 | 4
export type ViewKey = 'overview' | 'top' | 'side' | 'output' | 'free' | `s${number}`

export interface Toast {
  id: number
  text: string
  kind: 'ok' | 'warn' | 'info'
}

export interface DragState {
  material: MaterialId
  x: number
  y: number
  startX: number
  startY: number
  /** 按下后移动超过阈值才算拖拽，否则算"点选" */
  active: boolean
}

interface FactoryStore {
  lineState: LineState
  speed: Speed
  view: ViewKey
  focusStationId: number | null
  /** 由 Loop 递增，驱动 HUD 重新读取 sim */
  simVersion: number

  drag: DragState | null
  selected: MaterialId | null
  hoverBin: number | null
  toast: Toast | null
  quality: Quality
  difficulty: Difficulty
  /** 0=投料 1=启动 2=看成品 3=结束 */
  guideStep: number
  /** 正在跟随的在制品 */
  focusProductId: number | null
  /** 被点选的人物（镜头聚焦点） */
  focusActor: { x: number; z: number; label: string } | null

  start: () => void
  togglePause: () => void
  setSpeed: (speed: Speed) => void
  setView: (view: ViewKey) => void
  focusStation: (id: number | null) => void
  bump: () => void
  reset: () => void

  beginDrag: (material: MaterialId, x: number, y: number) => void
  moveDrag: (x: number, y: number) => void
  endDrag: () => void
  selectMaterial: (material: MaterialId | null) => void
  setHoverBin: (id: number | null) => void
  showToast: (text: string, kind?: Toast['kind']) => void
  cycleQuality: () => void
  cycleDifficulty: () => void
  focusProduct: (id: number | null) => void
  focusActorAt: (x: number, z: number, label: string) => void
  clearFocusActor: () => void
  setQuality: (q: Quality) => void
  advanceGuide: (step: number) => void
  skipGuide: () => void
}

let toastId = 1
let toastTimer: number | undefined

export const useFactory = create<FactoryStore>((set, get) => ({
  lineState: 'idle',
  speed: 1,
  view: 'overview',
  focusStationId: null,
  simVersion: 0,

  drag: null,
  selected: null,
  hoverBin: null,
  toast: null,
  quality: readQuality(),
  difficulty: readDifficulty(),
  guideStep: FLAGS.guide ? 0 : readGuideDone() ? 3 : 0,
  focusProductId: null,
  focusActor: null,

  start: () => set((s) => (s.lineState === 'idle' ? { lineState: 'running' } : s)),
  togglePause: () =>
    set((s) => ({
      lineState: s.lineState === 'running' ? 'paused' : s.lineState === 'paused' ? 'running' : s.lineState,
    })),
  setSpeed: (speed) => set({ speed }),
  setView: (view) => set({ view }),
  focusStation: (id) =>
    set({
      focusStationId: id,
      view: id === null ? 'free' : (`s${id}` as ViewKey),
    }),
  bump: () => set((s) => ({ simVersion: (s.simVersion + 1) % 100000 })),
  reset: () => {
    resetSim()
    set({
      lineState: 'idle',
      speed: 1,
      focusStationId: null,
      view: 'overview',
      simVersion: 0,
      drag: null,
      selected: null,
      hoverBin: null,
      toast: null,
      guideStep: readGuideDone() ? 3 : 0,
      focusProductId: null,
      focusActor: null,
    })
  },

  beginDrag: (material, x, y) =>
    set({ drag: { material, x, y, startX: x, startY: y, active: false } }),
  moveDrag: (x, y) =>
    set((s) => {
      if (!s.drag) return s
      const moved = Math.abs(x - s.drag.startX) + Math.abs(y - s.drag.startY)
      return { drag: { ...s.drag, x, y, active: s.drag.active || moved > 6 } }
    }),
  endDrag: () => set({ drag: null }),
  selectMaterial: (material) =>
    set((s) => ({ selected: s.selected === material ? null : material })),
  setHoverBin: (id) => set({ hoverBin: id }),
  cycleQuality: () =>
    set((s) => {
      const next = s.quality === 'high' ? 'medium' : s.quality === 'medium' ? 'low' : 'high'
      try {
        localStorage.setItem('factory.quality', next)
      } catch {
        /* ignore */
      }
      return { quality: next }
    }),
  setQuality: (quality) =>
    set(() => {
      try {
        localStorage.setItem('factory.quality', quality)
      } catch {
        /* ignore */
      }
      return { quality }
    }),
  cycleDifficulty: () =>
    set((s) => {
      const next: Difficulty = s.difficulty === 'easy' ? 'normal' : s.difficulty === 'normal' ? 'hard' : 'easy'
      try {
        localStorage.setItem('factory.difficulty', next)
      } catch {
        /* ignore */
      }
      return { difficulty: next }
    }),
  focusProduct: (id) => set({ focusProductId: id }),
  focusActorAt: (x, z, label) => set({ focusActor: { x, z, label } }),
  clearFocusActor: () => set({ focusActor: null }),
  advanceGuide: (step) => set((s) => (s.guideStep >= step ? s : { guideStep: step })),
  skipGuide: () =>
    set(() => {
      try {
        localStorage.setItem('factory.guideDone', '1')
      } catch {
        /* ignore */
      }
      return { guideStep: 3 }
    }),
  showToast: (text, kind = 'info') => {
    const id = toastId++
    set({ toast: { id, text, kind } })
    if (toastTimer) window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 2400)
  },
}))