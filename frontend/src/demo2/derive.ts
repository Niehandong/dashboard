// demo2 四个板块用到的数据，都从公司列表算出来。本文件不引用其它运行时模块，便于直接用 node --test 测试。
import type { Company, Coord } from '../types'

const NONE = '未合作', DONE = '已合作', DOMESTIC = '中国'

// 公司属于哪个地区：国内算「中国」一块，海外按大区
export const areaOf = (c: Company) => (c.country === DOMESTIC ? DOMESTIC : c.region)

// 表格里用简称：去掉末尾的"有限公司"等
export const shortName = (n: string) => n.replace(/(股份)?有限(责任)?公司$/, '') || n

// 按字符串算一个固定的数，用来给模拟数据挑值（同一家公司每次结果一样）
function hash(s: string) {
  let h = 7
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  return h
}

// 重点子公司：在推进的公司（不是未合作）里，每个阶段轮流取预计规模最大的，一共 n 家。
// 不直接取规模最大的 n 家：那样会全部是「已合作」，看不到正在谈的。
export function keyCompanies(list: Company[], stages: string[], n = 10): Company[] {
  const order = stages.filter(s => s !== NONE).reverse() // 走得远的阶段在前
  const pools = order.map(s => list.filter(c => c.stage === s).sort((a, b) => b.scale - a.scale || a.name.localeCompare(b.name, 'zh')))
  const out: Company[] = []
  for (let i = 0; out.length < n && pools.some(p => p.length > i); i++) {
    for (const p of pools) if (p[i] && out.length < n) out.push(p[i])
  }
  return out.sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage) || b.scale - a.scale)
}

// 布局概览：中国 + 海外各大区，各有多少家、已合作多少、走得最远到哪个阶段
export interface Area { name: string; total: number; done: number; talking: number; top: string; coord: Coord; countries: string[] }
export function areaOverview(list: Company[], stages: string[]): Area[] {
  const groups = new Map<string, Company[]>()
  for (const c of list) {
    const k = areaOf(c)
    const g = groups.get(k)
    if (g) g.push(c)
    else groups.set(k, [c])
  }
  return [...groups].map(([name, l]) => ({
    name,
    total: l.length,
    done: l.filter(c => c.stage === DONE).length,
    talking: l.filter(c => c.stage !== DONE && c.stage !== NONE).length,
    top: stages[Math.max(0, ...l.map(c => stages.indexOf(c.stage)))] ?? NONE,
    // 标记放在这个大区各公司的中间；中国固定放在版图中部
    coord: (name === DOMESTIC ? [104, 34] : [l.reduce((s, c) => s + c.coord[0], 0) / l.length, l.reduce((s, c) => s + c.coord[1], 0) / l.length]) as Coord,
    countries: [...new Set(l.map(c => c.country))],
  })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh'))
}

// 产品布局：每个产品涉及多少家、各阶段多少家、走得最远的阶段、重点子公司（推进最靠前、规模最大的两家）
export interface ProductRow { name: string; total: number; done: number; talking: number; todo: number; top: string; focus: string[] }
export function productLayout(list: Company[], stages: string[]): ProductRow[] {
  const groups = new Map<string, Company[]>()
  for (const c of list) for (const p of new Set(c.products)) {
    const g = groups.get(p)
    if (g) g.push(c)
    else groups.set(p, [c])
  }
  return [...groups].map(([name, l]) => {
    const done = l.filter(c => c.stage === DONE).length, todo = l.filter(c => c.stage === NONE).length
    const lead = l.filter(c => c.stage !== NONE).sort((a, b) => stages.indexOf(b.stage) - stages.indexOf(a.stage) || b.scale - a.scale)
    return { name, total: l.length, done, talking: l.length - done - todo, todo, top: lead[0]?.stage ?? NONE, focus: lead.slice(0, 2).map(c => shortName(c.name)) }
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'zh'))
}

// 关键项目：现有数据里没有项目，这里按重点子公司编出来（界面上标「示例」）。对接真实项目数据后删掉这个函数。
export const PROJECT_STAGES = ['需求确认', '方案报价', '技术验证', '打样验证', '量产交付']
export interface ProjectRow { id: string; code: string; name: string; company: string; stage: string; owner: string; due: string }
const KINDS = ['导入项目', '产线配套', '工艺升级', '扩产配套']
export function mockProjects(keys: Company[], updatedAt: string, n = 8): ProjectRow[] {
  const [y, m] = updatedAt.split('-').map(Number)
  const rows = keys.slice(0, n).map(c => {
    const h = hash(c.name)
    // 公司走得越远，项目也越靠后
    const stage = c.stage === DONE ? PROJECT_STAGES[3 + (h % 2)] : c.stage === '商机开发' ? PROJECT_STAGES[1 + (h % 2)] : PROJECT_STAGES[0]
    const d = new Date(y, m - 1 + 2 + (h >>> 3) % 8, 1) // 数据日期之后 2～9 个月
    return { id: c.id, name: `${c.products[0]}${KINDS[(h >>> 6) % KINDS.length]}`, company: shortName(c.name), stage, owner: c.owner, due: `${d.getFullYear()}/${d.getMonth() + 1}`, t: d.getTime() }
  }).sort((a, b) => a.t - b.t)
  return rows.map(({ t, ...r }, i) => ({ code: `P${new Date(t).getFullYear()}-${String(i + 1).padStart(3, '0')}`, ...r }))
}
