/** 难度只改一件事：来料里混进坏料的概率。坏料要到 S6 检测才暴露，等于白做一台。 */
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface DifficultyDef {
  id: Difficulty
  label: string
  /** 来料缺陷率 */
  incomingDefect: number
  hint: string
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { id: 'easy', label: '轻松', incomingDefect: 0, hint: '来料全检，不会出现坏料' },
  normal: { id: 'normal', label: '标准', incomingDefect: 0.04, hint: '约 4% 来料带缺陷，S6 会拦下来' },
  hard: { id: 'hard', label: '硬核', incomingDefect: 0.09, hint: '约 9% 来料带缺陷，产能会被吃掉一块' },
}
