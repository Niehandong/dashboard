// 看板各模块共用的统计口径（指标条、两侧面板、地图标牌都从这里取数，保证数字一致）
// 本文件不引用其它运行时模块，便于直接用 node --test 测试。
import type { Company } from './types'

// 当前范围：全球 / 海外的某个大区（公司的 region 字段，如东南亚）/ 某个国家 / 某个省。地图负责切换，模块只统计范围内的公司
export type Scope =
  | { kind: 'world' }
  | { kind: 'area'; area: string }
  | { kind: 'country'; country: string }
  | { kind: 'province'; country: string; province: string }
export const WORLD: Scope = { kind: 'world' }

export const NOT_TARGET = '不适用' // 目标产品为「不适用」的公司：产品卖不进去，不算目标公司
export const DONE = '已合作'
export const NONE = '未合作'

export const isTarget = (c: Company) => c.product !== NOT_TARGET
export const DOMESTIC = '中国'
export const inScope = (c: Company, s: Scope) =>
  s.kind === 'world' ? true
    : s.kind === 'area' ? c.country !== DOMESTIC && c.region === s.area
      : c.country === s.country && (s.kind === 'country' || c.province === s.province)
const scopeId = (s: Scope) => (s.kind === 'world' ? '' : s.kind === 'area' ? `a|${s.area}` : `c|${s.country}|${s.kind === 'province' ? s.province : ''}`)
export const sameScope = (a: Scope, b: Scope) => scopeId(a) === scopeId(b)
// 数据里出现的海外大区，公司多的在前
export function areas(list: Company[]) {
  const n = new Map<string, number>()
  for (const c of list) if (c.country !== DOMESTIC) n.set(c.region, (n.get(c.region) ?? 0) + 1)
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh')).map(x => x[0])
}

export interface Tally {
  total: number // 子公司总数（含不适用）
  target: number // 目标公司
  done: number // 已合作
  talking: number // 在谈：目标公司里既不是已合作也不是未合作的（规划中、商机开发）
  todo: number // 待突破 = 目标公司 − 已合作
  rate: number // 合作率 = 已合作 ÷ 目标公司
  byStage: Record<string, number> // 全部子公司按阶段
  targetByStage: Record<string, number> // 目标公司按阶段
  top: string // 走得最远的阶段
}

export function tally(list: Company[], stages: string[]): Tally {
  const byStage: Record<string, number> = {}, targetByStage: Record<string, number> = {}
  let target = 0, done = 0, talking = 0, top = 0
  for (const c of list) {
    byStage[c.stage] = (byStage[c.stage] ?? 0) + 1
    top = Math.max(top, stages.indexOf(c.stage))
    if (!isTarget(c)) continue
    target++
    targetByStage[c.stage] = (targetByStage[c.stage] ?? 0) + 1
    if (c.stage === DONE) done++
    else if (c.stage !== NONE) talking++
  }
  return { total: list.length, target, done, talking, todo: target - done, rate: target ? done / target : 0, byStage, targetByStage, top: stages[top] ?? NONE }
}

// 范围内的下一级地区：全球 → 国内各省 + 海外各国；大区 → 各国；中国 → 各省；省或海外国家 → 各城市
export interface Region {
  key: string
  name: string
  scope?: Scope // 点击后切换到的范围；城市没有（城市不是范围，点击打开该市的公司列表）
  cityKey?: string // 城市：省份|城市（海外为 国家|城市），与 utils 的 cityKey 一致
  t: Tally
}

export function regions(list: Company[], scope: Scope, stages: string[]): Region[] {
  const groups = new Map<string, { r: Omit<Region, 't'>; list: Company[] }>()
  for (const c of list) {
    if (!inScope(c, scope)) continue
    const domestic = c.country === '中国'
    let r: Omit<Region, 't'>
    if (scope.kind === 'province' || (scope.kind === 'country' && !domestic)) {
      const ck = `${c.province || c.country}|${c.city}`
      r = { key: ck, name: c.city, cityKey: ck }
    } else if (domestic) {
      r = { key: c.province, name: c.province, scope: { kind: 'province', country: c.country, province: c.province } }
    } else {
      r = { key: c.country, name: c.country, scope: { kind: 'country', country: c.country } }
    }
    const g = groups.get(r.key)
    if (g) g.list.push(c)
    else groups.set(r.key, { r, list: [c] })
  }
  return [...groups.values()].map(g => ({ ...g.r, t: tally(g.list, stages) }))
}

// 空白地区：有目标公司、一家都没合作上。目标公司多的排前面
export const blankRegions = (rs: Region[]) =>
  rs.filter(r => r.t.target > 0 && r.t.done === 0).sort((a, b) => b.t.target - a.t.target || b.t.talking - a.t.talking || a.name.localeCompare(b.name, 'zh'))
// 待扩大地区：已有合作，但还有没拿下的。待突破多的排前面
export const growRegions = (rs: Region[]) =>
  rs.filter(r => r.t.done > 0 && r.t.todo > 0).sort((a, b) => b.t.todo - a.t.todo || a.name.localeCompare(b.name, 'zh'))

// 各目标产品的合作情况（不含「不适用」），目标公司多的排前面
export function products(list: Company[], stages: string[]) {
  const groups = new Map<string, Company[]>()
  for (const c of list) {
    if (!isTarget(c)) continue
    const g = groups.get(c.product)
    if (g) g.push(c)
    else groups.set(c.product, [c])
  }
  return [...groups].map(([name, l]) => ({ name, t: tally(l, stages) })).sort((a, b) => b.t.target - a.t.target)
}
