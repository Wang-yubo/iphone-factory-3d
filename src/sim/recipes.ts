/**
 * 产线配方表：物料、BOM、7 个工站的节拍与良率。
 * P1 只用于展示与命名；P2 起由 sim/engine.ts 驱动。
 */

export type MaterialId = 'aluminum' | 'board' | 'soc' | 'glass' | 'battery' | 'camera' | 'box'

export type ItemId =
  | MaterialId
  | 'shell'
  | 'boardAssy'
  | 'displayAssy'
  | 'batteryAssy'
  | 'phoneBody'
  | 'phoneOk'
  | 'phone'
  | 'defect'

export interface MaterialDef {
  id: MaterialId
  name: string
  /** 单台成品的用量 */
  unit: number
  /** 供货工站 */
  stationId: number
  color: string
  /** 3D 里的形状：决定原料箱与零件的外观 */
  shape: 'billet' | 'slab' | 'chip' | 'panel' | 'cell' | 'lens' | 'carton'
}

export const MATERIALS: MaterialDef[] = [
  { id: 'aluminum', name: '铝锭', unit: 1, stationId: 1, color: '#c3c9d0', shape: 'billet' },
  { id: 'board', name: '主板基板', unit: 1, stationId: 2, color: '#1f6f4a', shape: 'slab' },
  { id: 'soc', name: 'SoC 芯片', unit: 1, stationId: 2, color: '#d9b45b', shape: 'chip' },
  { id: 'glass', name: '玻璃面板', unit: 1, stationId: 3, color: '#9fe3ff', shape: 'panel' },
  { id: 'battery', name: '电池', unit: 1, stationId: 4, color: '#2b2f36', shape: 'cell' },
  { id: 'camera', name: '摄像头模组', unit: 3, stationId: 5, color: '#a78bfa', shape: 'lens' },
  { id: 'box', name: '包装盒', unit: 1, stationId: 7, color: '#e8e2d4', shape: 'carton' },
]

export const MATERIAL_BY_ID = Object.fromEntries(MATERIALS.map((m) => [m.id, m])) as Record<
  MaterialId,
  MaterialDef
>

/** 料仓标签用的单字简写 */
export const MATERIAL_SHORT: Record<MaterialId, string> = {
  aluminum: '铝',
  board: '板',
  soc: '芯',
  glass: '玻',
  battery: '电',
  camera: '相',
  box: '盒',
}

export const ITEM_NAMES: Record<ItemId, string> = {
  aluminum: '铝锭',
  board: '主板基板',
  soc: 'SoC 芯片',
  glass: '玻璃面板',
  battery: '电池',
  camera: '摄像头模组',
  box: '包装盒',
  shell: '机壳',
  boardAssy: '主板总成',
  displayAssy: '屏装机壳',
  batteryAssy: '电池总成',
  phoneBody: '半成品机身',
  phoneOk: '良品机身',
  phone: '成品手机',
  defect: '不良品',
}

export interface StationDef {
  id: number
  code: string
  name: string
  /** 工站正在做什么，展示在 HUD 与工站卡片上 */
  action: string
  accent: string
  cycleSec: number
  yieldRate: number
  inputs: { item: ItemId; qty: number }[]
  output: ItemId
}

export const STATIONS: StationDef[] = [
  {
    id: 1,
    code: 'S1',
    name: '冲压成型',
    action: '铝锭冲压成一体式机壳',
    accent: '#6ea8d8',
    cycleSec: 2.5,
    yieldRate: 0.998,
    inputs: [{ item: 'aluminum', qty: 1 }],
    output: 'shell',
  },
  {
    id: 2,
    code: 'S2',
    name: '主板贴装',
    action: 'SoC 贴装到主板基板',
    accent: '#5fd1c0',
    cycleSec: 3.0,
    yieldRate: 0.995,
    inputs: [
      { item: 'board', qty: 1 },
      { item: 'soc', qty: 1 },
    ],
    output: 'boardAssy',
  },
  {
    id: 3,
    code: 'S3',
    name: '屏幕贴合',
    action: '玻璃面板与机壳真空贴合',
    accent: '#7f9cf5',
    cycleSec: 3.0,
    yieldRate: 0.993,
    inputs: [
      { item: 'glass', qty: 1 },
      { item: 'shell', qty: 1 },
    ],
    output: 'displayAssy',
  },
  {
    id: 4,
    code: 'S4',
    name: '电池装配',
    action: '电池装入屏装机壳',
    accent: '#b58cf0',
    cycleSec: 2.0,
    yieldRate: 0.998,
    inputs: [
      { item: 'battery', qty: 1 },
      { item: 'displayAssy', qty: 1 },
    ],
    output: 'batteryAssy',
  },
  {
    id: 5,
    code: 'S5',
    name: '相机装配',
    action: '三颗摄像头模组依次落位',
    accent: '#f0a35e',
    cycleSec: 2.5,
    yieldRate: 0.99,
    inputs: [
      { item: 'camera', qty: 3 },
      { item: 'batteryAssy', qty: 1 },
    ],
    output: 'phoneBody',
  },
  {
    id: 6,
    code: 'S6',
    name: '功能检测',
    action: '探针自检，判定良品与不良品',
    accent: '#ffcc4d',
    cycleSec: 4.0,
    yieldRate: 0.975,
    inputs: [{ item: 'phoneBody', qty: 1 }],
    output: 'phoneOk',
  },
  {
    id: 7,
    code: 'S7',
    name: '包装入库',
    action: '装入包装盒、封膜、贴标',
    accent: '#57d99a',
    cycleSec: 2.0,
    yieldRate: 0.999,
    inputs: [
      { item: 'phoneOk', qty: 1 },
      { item: 'box', qty: 1 },
    ],
    output: 'phone',
  },
]

export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s])) as Record<
  number,
  StationDef
>

export type ModelId = 'pro' | 'air'

export interface ModelDef {
  id: ModelId
  name: string
  short: string
  /** 单台摄像头模组用量 */
  cameraQty: number
  /** 全站节拍倍率：air 更快 */
  cycleScale: number
  /** 订单报酬倍率 */
  rewardScale: number
  /** 换线耗时（秒） */
  changeoverSec: number
  accent: string
}

export const MODELS: Record<ModelId, ModelDef> = {
  pro: {
    id: 'pro',
    name: 'iPhone 17 Pro',
    short: 'Pro',
    cameraQty: 3,
    cycleScale: 1,
    rewardScale: 1,
    changeoverSec: 0,
    accent: '#e8eef4',
  },
  air: {
    id: 'air',
    name: 'iPhone 17 Air',
    short: 'Air',
    cameraQty: 2,
    cycleScale: 0.86,
    rewardScale: 0.9,
    changeoverSec: 8,
    accent: '#9fd8ff',
  },
}

/** 单台成品的完整物料清单 */
export const BOM: { material: MaterialId; qty: number }[] = MATERIALS.map((m) => ({
  material: m.id,
  qty: m.unit,
}))

export const TOTAL_UNITS_PER_PHONE = BOM.reduce((n, b) => n + b.qty, 0)
/** 整线累计良率 = 各站良率连乘（约 94.9%） */
export const LINE_YIELD = STATIONS.reduce((n, s) => n * s.yieldRate, 1)

/** 理论节拍由最慢工站决定 */
export const BOTTLENECK_CYCLE = Math.max(...STATIONS.map((s) => s.cycleSec))
export const THEORETICAL_UPH = Math.round(3600 / BOTTLENECK_CYCLE)