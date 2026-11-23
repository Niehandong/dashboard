import type { Company } from './types'
// 阶段配色：由冷到暖再到绿，表达"越往后越接近合作"
export const STAGE_COLOR: Record<string, string> = {
  未合作: '#6B7C95',
  规划中: '#4C9BF0',
  初步接洽: '#4C7BD9',
  商机开发: '#E3A33B',
  技术验证: '#F0661E',
  已合作: '#1F9D6B',
}

export type Mode = 'desk' | 'screen'

export const PALETTE: Record<Mode, { land: string; edge: string; ink: string; muted: string; surface: string; line: string; signal: string }> = {
  desk: { land: '#D9DFE6', edge: '#FFFFFF', ink: '#18212C', muted: '#5E6978', surface: '#FFFFFF', line: '#D7DDE4', signal: '#F0661E' },
  screen: { land: '#15304F', edge: '#071425', ink: '#E6EDF5', muted: '#8A9BB2', surface: '#0D2038', line: '#1D3554', signal: '#FF7A2E' },
}

export const fmt = (n: number) => n.toLocaleString('zh-CN')
export const pct = (x: number) => `${Math.round(x * 100)}`

export const parseYM = (s: string) => {
  const [y, m] = s.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + (b.getDate() - a.getDate()) / 30
}

export function isDueSoon(due: string, today: Date) {
  const m = monthsBetween(today, parseYM(due))
  return m >= 0 && m <= 6
}

export function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

// 公司按城市聚合（地图上的城市圆、城市公司列表共用）
export interface CityGroup {
  key: string // 省份|城市
  city: string
  province: string // 所属省份；海外为所属国家
  coord: [number, number] // 城市内各公司坐标的平均值
  list: Company[]
  byStage: Record<string, number>
  top: string // 城市内推进得最靠前的阶段
  scale: number
}
export const isDomestic = (c: Company) => c.country === '中国'
// 城市的唯一标识：省份|城市；海外没有省份，用 国家|城市
export const cityKey = (f: Company) => `${f.province || f.country}|${f.city}`

export function groupByCity(list: Company[], stages: string[]): CityGroup[] {
  const map = new Map<string, CityGroup>()
  for (const f of list) {
    const k = cityKey(f)
    let g = map.get(k)
    if (!g) map.set(k, (g = { key: k, city: f.city, province: f.province || f.country, coord: [0, 0], list: [], byStage: {}, top: f.stage, scale: 0 }))
    g.list.push(f)
    g.byStage[f.stage] = (g.byStage[f.stage] ?? 0) + 1
    g.scale += f.scale
    if (stages.indexOf(f.stage) > stages.indexOf(g.top)) g.top = f.stage
  }
  for (const g of map.values()) {
    g.coord = [g.list.reduce((s, f) => s + f.coord[0], 0) / g.list.length, g.list.reduce((s, f) => s + f.coord[1], 0) / g.list.length]
  }
  return [...map.values()].sort((a, b) => b.list.length - a.list.length)
}

// 按阶段从后往前、同阶段按规模从大到小排序（列表展示用）
export const byProgress = (stages: string[]) => (a: Company, b: Company) =>
  stages.indexOf(b.stage) - stages.indexOf(a.stage) || b.scale - a.scale
