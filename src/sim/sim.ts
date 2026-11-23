import { binCap, createSim } from './engine'

/** 运行期唯一的产线状态：3D 直接读它，HUD 通过版本号触发重渲染 */
export const sim = createSim()

export function resetSim() {
  Object.assign(sim, createSim())
}

/** 调试用：把所有料仓按各自上限灌满 */
export function fillAllBins() {
  for (const st of sim.stations) {
    for (const key of Object.keys(st.bins)) st.bins[key as keyof typeof st.bins] = binCap(st.id)
  }
}
