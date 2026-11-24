const q = new URLSearchParams(location.search)

/** 开发期开关：只影响调试，不影响正常使用 */
const focusAtRaw = q.get('focusat')

export const FLAGS = {
  probe: q.has('probe'),
  ascii: q.has('ascii'),
  noLabel: q.has('nolabel'),
  noShadow: q.has('noshadow'),
  noBloom: q.has('nobloom'),
  noEnv: q.has('noenv'),
  /** 调试：强制某个工站出不良，用来验回收箱与判定灯 */
  bad: Number(q.get('bad')) || 0,
  /** 调试：开局把料仓灌满，方便快速验收产线后半段 */
  full: q.has('full'),
  /** 调试：强制显示新手引导 */
  guide: q.has('guide'),
  /** 调试：?focusat=x,z —— 进场 2.5s 后自动聚焦该点，用来验证镜头 */
  focusAt: focusAtRaw ? (focusAtRaw.split(',').map(Number) as [number, number]) : null,
}
