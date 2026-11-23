/** 全局色板：工业极简白 × 苹果式留白 × 青蓝科技光 */
export const C = {
  bg: '#080a0d',
  fog: '#0b0e12',
  floor: '#181c21',
  floorEdge: '#22272d',
  grid: '#2c333a',

  white: '#eef1f4',
  aluminum: '#c3c9d0',
  steel: '#7d848c',
  darkSteel: '#3b424a',
  deepSteel: '#23282e',
  rubber: '#12151a',

  accent: '#2fb8ff',
  accentDim: '#1a6a91',
  warn: '#ffb020',
  danger: '#ff4d4f',
  ok: '#34d399',

  safety: '#c9a227',
} as const

/** 工站强调色：冷暖交替，让 7 个工站在全景里可分辨 */
export const STATION_ACCENTS = [
  '#6ea8d8',
  '#5fd1c0',
  '#7f9cf5',
  '#b58cf0',
  '#f0a35e',
  '#ffcc4d',
  '#57d99a',
] as const