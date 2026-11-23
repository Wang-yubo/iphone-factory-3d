import type * as THREE from 'three'

/** 投料射线检测的目标：工站号 → 料仓组的根节点 */
export const binTargets = new Map<number, THREE.Object3D>()
