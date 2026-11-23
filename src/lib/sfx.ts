/**
 * 程序化音效：全部用 WebAudio 现场合成，不加载任何音频文件。
 * 浏览器策略要求首次用户手势后才能出声，所以 AudioContext 延迟创建。
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let muted = readMuted()
const listeners = new Set<(m: boolean) => void>()

function readMuted() {
  try {
    return localStorage.getItem('factory.muted') === '1'
  } catch {
    return false
  }
}

function ensure(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 0.55
  master.connect(ctx.destination)

  const len = Math.floor(ctx.sampleRate * 0.6)
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

  return ctx
}

/** 首次用户手势时调用，解锁音频 */
export function unlockAudio() {
  const c = ensure()
  if (c && c.state === 'suspended') void c.resume()
}

export function isMuted() {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem('factory.muted', next ? '1' : '0')
  } catch {
    /* 忽略隐私模式下的写入失败 */
  }
  if (master && ctx) master.gain.setTargetAtTime(next ? 0 : 0.55, ctx.currentTime, 0.02)
  for (const fn of listeners) fn(next)
}

export function onMutedChange(fn: (m: boolean) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function ready() {
  if (muted) return null
  const c = ensure()
  if (!c || c.state !== 'running') return null
  return c
}

function noise(c: AudioContext, dur: number) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  return src
}

/** 落料：一声闷响 */
export function thock() {
  const c = ready()
  if (!c || !master) return
  const t = c.currentTime

  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(210, t)
  osc.frequency.exponentialRampToValueAtTime(72, t + 0.16)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
  osc.connect(g).connect(master)
  osc.start(t)
  osc.stop(t + 0.24)

  const n = noise(c, 0.08)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 1600
  const ng = c.createGain()
  ng.gain.setValueAtTime(0.22, t)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
  n.connect(lp).connect(ng).connect(master)
  n.start(t)
  n.stop(t + 0.08)
}

/** 启动：气流上扬 */
export function whoosh() {
  const c = ready()
  if (!c || !master) return
  const t = c.currentTime
  const n = noise(c, 0.5)
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.2
  bp.frequency.setValueAtTime(320, t)
  bp.frequency.exponentialRampToValueAtTime(2400, t + 0.32)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.28, t + 0.06)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42)
  n.connect(bp).connect(g).connect(master)
  n.start(t)
  n.stop(t + 0.45)
}

/** 检测通过 / 完成：短促的叮 */
export function ding() {
  const c = ready()
  if (!c || !master) return
  const t = c.currentTime
  for (const [freq, delay, gain] of [
    [1046, 0, 0.16],
    [1568, 0.045, 0.09],
  ] as const) {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t + delay)
    g.gain.exponentialRampToValueAtTime(gain, t + delay + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.3)
    osc.connect(g).connect(master)
    osc.start(t + delay)
    osc.stop(t + delay + 0.32)
  }
}

/** 不良品：压抑的蜂鸣 */
export function buzz() {
  const c = ready()
  if (!c || !master) return
  const t = c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(120, t)
  osc.frequency.setValueAtTime(98, t + 0.12)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.01)
  g.gain.setValueAtTime(0.22, t + 0.18)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
  osc.connect(lp).connect(g).connect(master)
  osc.start(t)
  osc.stop(t + 0.32)
}

/** 成品下线：三音上行 */
export function chime() {
  const c = ready()
  if (!c || !master) return
  const t = c.currentTime
  const notes: [number, number][] = [
    [784, 0],
    [988, 0.09],
    [1319, 0.18],
  ]
  for (const [freq, delay] of notes) {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t + delay)
    g.gain.exponentialRampToValueAtTime(0.16, t + delay + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.42)
    osc.connect(g).connect(master)
    osc.start(t + delay)
    osc.stop(t + delay + 0.45)
  }
}

/** 订单完成：五音小琶音 */
export function fanfare() {
  const c = ready()
  if (!c || !master) return
  const t = c.currentTime
  const notes: [number, number][] = [
    [523, 0],
    [659, 0.1],
    [784, 0.2],
    [1046, 0.3],
    [1318, 0.44],
  ]
  for (const [freq, delay] of notes) {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t + delay)
    g.gain.exponentialRampToValueAtTime(0.15, t + delay + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.5)
    osc.connect(g).connect(master)
    osc.start(t + delay)
    osc.stop(t + delay + 0.52)
  }
}

/** UI 轻点 */
export function click() {
  const c = ready()
  if (!c || !master) return
  const t = c.currentTime
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = 1800
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  osc.connect(g).connect(master)
  osc.start(t)
  osc.stop(t + 0.06)
}