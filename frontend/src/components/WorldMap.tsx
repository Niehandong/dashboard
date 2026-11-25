import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import * as echarts from 'echarts'
import type { Company, CompanyData, Coord } from '../types'
import { cityKey, fmt, hexA, STAGE_COLOR, isDomestic } from '../utils'
import { areas, inScope, isTarget, sameScope, DONE, NONE, WORLD, type Scope } from '../stats'

// 底图（由 scripts/build_geo.sh 生成）：
//   world.json      面：其他国家按国家一块 + 中国按省份；
//                   线：经纬网、省/州分界线、国界（名称以 _ 开头，样式见 PALETTES 里的 lines）
//                   线条做在底图里，拖动、缩放时只需整体移动，不用逐点重算坐标
//   countries.json / provinces.json  国家名、省/州名标注点
//   china.json      中国省级地图，这里只用各省的中心点（cp）放省份的汇总标牌
// demo 用开源数据，正式对外展示前需替换为带审图号的标准地图。
type Label = { name: string; coord: Coord; rank?: number }
const geoData: { cnNames: Set<string>; countries: Label[]; provinces: Label[]; provinceCenter: Map<string, Coord> } = {
  cnNames: new Set(), countries: [], provinces: [], provinceCenter: new Map(),
}

// 底图中各线条的样式：从暗到亮叠放
type LineStyle = { borderColor: string; borderWidth: number; shadowColor?: string; shadowBlur?: number }

// 两套配色：dark = 原来的深色作战沙盘；light = 照 demo2 的白底浅蓝（「作战地图」原图的风格）
const PALETTES = {
  dark: {
    lines: {
      _graticule: { borderColor: 'rgba(111,168,230,.09)', borderWidth: 0.6 },
      _inner: { borderColor: '#1E4470', borderWidth: 0.5 },
      // 国界光晕：一条宽而淡的线垫在下面，代替 shadowBlur（模糊在每帧重画时很耗性能）
      _border_glow: { borderColor: 'rgba(61,139,217,.14)', borderWidth: 4 },
      _border: { borderColor: 'rgba(75,155,232,.85)', borderWidth: 1 },
      _china_border: { borderColor: '#9ADBFF', borderWidth: 1.6, shadowColor: '#4FB3FF', shadowBlur: 14 },
    } as Record<string, LineStyle>,
    land: '#0D2647', litLo: '#123A66', litHi: '#2468AD', regionBorder: '#2B5E92',
    geoLabel: 'rgba(170,198,230,.62)', countryLabel: 'rgba(170,198,230,.55)', provinceLabel: 'rgba(170,198,230,.62)',
    tip: { bg: 'rgba(8,24,46,.94)', border: '#2B5E92', ink: '#E6EDF5', shadow: 'rgba(61,139,217,.35)', hint: '#8FB3D9' },
    tag: { base: '#051226', fill: 0.42, fillBlank: 0.22, fillHot: 0.6, name: '#EEF5FF', count: '#FFFFFF', sub: 'rgba(238,245,255,.72)', blankName: '#B8C4D6', blankCount: '#D5DDE8', hot: '#FFFFFF' },
  },
  light: {
    lines: {
      _graticule: { borderColor: 'rgba(0,0,0,0)', borderWidth: 0 },
      _inner: { borderColor: '#FFFFFF', borderWidth: 0.6 },
      _border_glow: { borderColor: 'rgba(120,165,225,.18)', borderWidth: 4 },
      _border: { borderColor: '#FFFFFF', borderWidth: 1 },
      _china_border: { borderColor: '#8CB1DE', borderWidth: 1.2 },
    } as Record<string, LineStyle>,
    land: '#E3EDF9', litLo: '#D3E3F6', litHi: '#8DB5E6', regionBorder: '#FFFFFF',
    geoLabel: '#6E7D95', countryLabel: '#8693A8', provinceLabel: '#6E7D95',
    tip: { bg: 'rgba(255,255,255,.97)', border: '#D6E1EF', ink: '#1F2A44', shadow: 'rgba(40,80,150,.16)', hint: '#6B7689' },
    tag: { base: '#FFFFFF', fill: 0.14, fillBlank: 0.08, fillHot: 0.28, name: '#13285A', count: '#13285A', sub: '#5A6478', blankName: '#6B7689', blankCount: '#4A5568', hot: '#13285A' },
  },
}
type Palette = typeof PALETTES.dark

let mapReady: Promise<boolean> | null = null
function loadWorld() {
  const get = (f: string) => fetch(`/geo/${f}`).then(r => { if (!r.ok) throw new Error(f); return r.json() })
  mapReady ??= Promise.all([get('world.json'), get('countries.json'), get('provinces.json'), get('china.json')])
    .then(([world, countries, provinces, china]) => {
      geoData.cnNames = new Set(world.features
        .filter((f: { properties: { cn?: boolean } }) => f.properties.cn)
        .map((f: { properties: { name: string } }) => f.properties.name))
      geoData.countries = countries
      geoData.provinces = provinces
      for (const f of china.features as { properties: { name: string; cp?: Coord } }[]) {
        if (f.properties.cp) geoData.provinceCenter.set(f.properties.name, f.properties.cp)
      }
      echarts.registerMap('world', world)
      return true
    })
    .catch(() => false)
  return mapReady
}

// 「全球」用 0.6 倍：整幅世界地图不被左侧面板和顶部指标条盖住
const WORLD_ZOOM = 0.6
// 大区按钮的排列顺序（数据里出现了才显示；不在这里的排在最后）
const AREA_ORDER = ['亚洲', '东南亚', '欧洲', '北美', '南美', '非洲', '大洋洲']
// 让一组公司都落在画面中间：返回中心点和缩放倍数。1 倍时每经度约 5.2 像素、每纬度约 6.9 像素
function fitView(list: Company[]): { center: Coord; zoom: number } {
  const xs = list.map(f => f.coord[0]), ys = list.map(f => f.coord[1])
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const zoom = Math.min(820 / (5.2 * Math.max(x1 - x0, 1)), 520 / (6.9 * Math.max(y1 - y0, 1)))
  // 不小于 2.3（保持在"省份/国家"这一级），不大于 4（只有一两个国家时不要放得太大）
  return { center: [(x0 + x1) / 2, (y0 + y1) / 2], zoom: Math.max(2.3, Math.min(4, zoom)) }
}

// ---------- 底图文字：分三档 ----------
// < 3 只显示国家名；3～6 其他国家显示国家名；≥ 6 所有国家显示省/州名
// 中国的省名：放大到城市级（≥ 6）才显示，之前由省份的汇总标牌显示省名
type Tier = 0 | 1 | 2
const tierOf = (zoom: number): Tier => (zoom < 3 ? 0 : zoom < 6 ? 1 : 2)
const labelData = (list: Label[]) => list.map(x => ({ name: x.name, value: x.coord, rank: x.rank }))
// taken：已经由汇总标牌显示出来的地名（如"德国 3"），底图不再重复写一遍
function labelOption(zoom: number, provinces: Label[] = [], taken: Set<string> = new Set()) {
  const tier = tierOf(zoom)
  const maxRank = tier === 0 ? 3 : 6
  const countries = tier === 2 ? [] : geoData.countries.filter(x => (x.rank ?? 9) <= maxRank && !(tier === 1 && x.name === '中国') && !taken.has(x.name))
  return {
    geo: { label: { show: zoom >= 6, formatter: (p: { name: string }) => (geoData.cnNames.has(p.name) && !taken.has(p.name) ? p.name : '') } },
    series: [
      // 只把当前这一档要显示的标注点放进去：点越少，拖动时排布标签越快
      { id: 'country-labels', data: labelData(countries) },
      { id: 'province-labels', data: tier === 2 ? labelData(provinces.filter(x => !taken.has(x.name))) : [] },
    ],
  }
}

// ---------- 公司分级汇总（类似房源地图：国家 → 省 → 市） ----------
// 地图只精确到城市：点击城市的标牌，在右侧列出该市的全部公司
type Level = 0 | 1 | 2
const LEVELS = ['按国家汇总', '按省份汇总', '按城市汇总']
// 参考：1× 为完整世界；3.5× 约为整个中国；10× 约为一个省；40× 约为一个城市
const levelOf = (zoom: number): Level => (zoom < 2.2 ? 0 : zoom < 6 ? 1 : 2)
// 点击汇总标牌后放大到的倍数（即下一级）；海外国家没有省这一级，直接到城市
const DRILL_ZOOM = { country: 3.5, province: 10 }
const OVERSEAS_DRILL_ZOOM = 8
// 最大倍数：够把相邻的城市分开即可，不再往下放大
const MIN_ZOOM = 0.55, MAX_ZOOM = 48
// 滚轮缩放步长：鼠标滚两格放大一倍（和常见在线地图接近）；触控板的小幅滚动按比例折算
const WHEEL_PX_PER_DOUBLE = 200

type Agg = {
  kind: 'country' | 'province' | 'city'
  key: string
  name: string
  center: Coord
  list: Company[]
  byStage: Record<string, number>
  scale: number
  target: number // 目标公司（目标产品不是「不适用」）
  done: number // 已合作
  top: string // 走得最远的阶段：整块标牌按它上色
  plain: boolean // 图例筛掉了部分阶段时，标牌只写显示出来的公司数，不写「已合作/目标」
  parent?: string // 省份的标牌：所属国家；城市：所属省份（海外为所属国家）
  members?: string[] // 画面上挨得太近而合并的几个地方
}
// 国家的标牌挨得近，名字长的国家用简称（提示框和底图仍用全称）
const COUNTRY_SHORT: Record<string, string> = { 沙特阿拉伯: '沙特', 印度尼西亚: '印尼', 哈萨克斯坦: '哈萨克' }
const shortCountry = (name: string) => COUNTRY_SHORT[name] ?? name
// 数据里的国家名和底图里的区域名不一样的
const GEO_NAME: Record<string, string> = { 阿联酋: '阿拉伯联合酋长国' }
const mean = (list: Company[]): Coord => [
  list.reduce((s, f) => s + f.coord[0], 0) / list.length,
  list.reduce((s, f) => s + f.coord[1], 0) / list.length,
]
// 汇总时用到的阶段顺序和是否筛选过
type AggCtx = { stages: string[]; plain: boolean }
const further = (stages: string[], a: string, b: string) => (stages.indexOf(b) > stages.indexOf(a) ? b : a)
function aggregate(ctx: AggCtx, kind: Agg['kind'], list: Company[], keyOf: (f: Company) => string, nameOf: (f: Company) => string,
  centerOf: (key: string, list: Company[]) => Coord, parentOf?: (f: Company) => string): Agg[] {
  const groups = new Map<string, Company[]>()
  for (const f of list) {
    const k = keyOf(f)
    groups.get(k)?.push(f) ?? groups.set(k, [f])
  }
  return [...groups].map(([key, items]) => {
    const byStage: Record<string, number> = {}
    for (const f of items) byStage[f.stage] = (byStage[f.stage] ?? 0) + 1
    return {
      kind, key, name: nameOf(items[0]), center: centerOf(key, items), list: items, byStage,
      scale: items.reduce((s, f) => s + f.scale, 0), parent: parentOf?.(items[0]),
      target: items.filter(isTarget).length, done: items.filter(f => isTarget(f) && f.stage === DONE).length,
      top: items.reduce((t, f) => further(ctx.stages, t, f.stage), ctx.stages[0] ?? NONE), plain: ctx.plain,
    }
  })
}

// ---------- 汇总标牌：地面落点 + 光柱 + 顶端的切角标牌（地名、已合作/目标公司） ----------
// 整块标牌（落点、光柱、牌面）只用一种颜色：这个地方走得最远的阶段的颜色，站远了也能分出合作进展。
// 光柱越高，子公司越多。
const TAG = {
  cut: 7, // 右上角切掉的大小
  bar: 4, // 牌面左侧的实色条
}
// 各级标牌的字号和高度：级别越高越大
const TAG_SIZE = {
  country: { name: 14, count: 22, h: 30 },
  province: { name: 13, count: 20, h: 28 },
  city: { name: 12, count: 18, h: 24 },
}
const NUM_FONT = "'Barlow Condensed', sans-serif"
// 文字宽度的估算：汉字按一个字号宽，数字、字母约半个
const textWidth = (t: string, size: number) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? size : size * 0.56), 0)
// 标牌上的数字：有目标公司时写「已合作/目标公司」（大字 + 小字），否则只写子公司数
const tagNumbers = (a: Agg) => (a.plain || !a.target ? { main: String(a.list.length), sub: '' } : { main: String(a.done), sub: `/${a.target}` })
function tagBox(a: Agg) {
  const z = TAG_SIZE[a.kind], n = tagNumbers(a), subSize = Math.round(z.count * 0.72)
  const nameW = textWidth(a.name, z.name), mainW = n.main.length * z.count * 0.46, subW = n.sub.length * subSize * 0.46
  return { ...z, ...n, subSize, nameW, mainW, w: Math.ceil(TAG.bar + 9 + nameW + 9 + mainW + (n.sub ? 2 + subW : 0) + 10) }
}
// 光柱高度（像素）：1 家约 30，10 家约 64，100 家以上封顶 100
const beamOf = (a: Agg) => Math.min(100, Math.round(16 + 14 * Math.log2(1 + a.list.length)))
const MAX_BEAM = 170

// 两个颜色之间插值（省份底色按公司数量由暗到亮）
function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

// 画面范围（向外多留 20%）内的标注点
function pointsInView(inst: echarts.ECharts, list: Label[]) {
  const w = inst.getWidth(), h = inst.getHeight()
  const a = inst.convertFromPixel({ geoIndex: 0 }, [-w * 0.2, -h * 0.2]) as Coord | undefined
  const b = inst.convertFromPixel({ geoIndex: 0 }, [w * 1.2, h * 1.2]) as Coord | undefined
  if (!a || !b) return []
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])], [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])]
  return list.filter(({ coord: [x, y] }) => x >= x0 && x <= x1 && y >= y0 && y <= y1)
}


// 按画面排布标牌。标牌会压到已放好的标牌时，先把光柱加高、让标牌错开；
// 省、市的标牌错两次还压着，就并进对方（如"苏州等4地"），点击合并的标牌会继续放大。
// 国家的标牌不合并：每个国家始终单独一块。公司多的先放，保留自己的位置和名称。
type Placed = Agg & { beam: number }
function layoutTags(inst: echarts.ECharts | undefined, list: Agg[], stages: string[]): Placed[] {
  const sorted = [...list].sort((a, b) => b.list.length - a.list.length)
  if (!inst) return sorted.map(a => ({ ...a, beam: beamOf(a) }))
  const kept: { a: Placed; x: number; y: number; w: number; h: number }[] = []
  const GAP = 5
  for (const a of sorted) {
    const [x, y] = inst.convertToPixel({ geoIndex: 0 }, a.center) as number[]
    const { w, h } = tagBox(a)
    let beam = beamOf(a)
    // 标牌占的位置：左边贴着光柱，底边在光柱顶端
    const blocker = () => kept.find(k => x < k.x + k.w + GAP && k.x < x + w + GAP && y - beam - h < k.y - k.a.beam + GAP && k.y - k.a.beam - k.h < y - beam + GAP)
    let hit = blocker()
    for (let tries = a.kind === 'country' ? 6 : 2; hit && tries > 0; tries--) {
      const lifted = y - (hit.y - hit.a.beam - hit.h) + GAP // 抬到对方标牌的上面
      if (lifted > MAX_BEAM) break
      beam = lifted
      hit = blocker()
    }
    if (hit && a.kind !== 'country' && hit.a.kind !== 'country') {
      const m = hit.a
      m.members!.push(a.name)
      m.list = [...m.list, ...a.list]
      m.scale += a.scale
      m.target += a.target
      m.done += a.done
      m.top = further(stages, m.top, a.top)
      m.byStage = { ...m.byStage }
      for (const [st, n] of Object.entries(a.byStage)) m.byStage[st] = (m.byStage[st] ?? 0) + n
      continue
    }
    kept.push({ a: { ...a, members: [a.name], beam: Math.min(beam, MAX_BEAM) }, x, y, w, h })
  }
  // 靠下（离观看者近）的后画，盖在靠上的前面
  return kept.sort((p, q) => p.y - q.y)
    .map(k => (k.a.members!.length > 1 ? { ...k.a, name: `${k.a.members![0]}等${k.a.members!.length}地` } : k.a))
}

// 画一个标牌。原点是地面落点，向上为负
function tagGraphic(a: Placed, pal: Palette) {
  const T = pal.tag
  const b = tagBox(a), top = -a.beam - b.h, c = TAG.cut, mid = top + b.h / 2 - 1
  const blank = a.top === NONE // 全部未合作：灰色，整体调暗
  const col = STAGE_COLOR[a.top] ?? STAGE_COLOR[NONE], k = blank ? 0.6 : 1
  const hot = { stroke: T.hot } // 鼠标移上去：描边变白（浅色版变深蓝；橙色和「商机开发」的颜色太接近）
  const x0 = TAG.bar + 9
  return [
    // 地面落点：压扁的两圈光环（像投在地面上）+ 中心亮点
    { type: 'ellipse', shape: { cx: 0, cy: 0, rx: 13, ry: 5.5 }, style: { fill: hexA(col, 0.12 * k), stroke: hexA(col, 0.4 * k), lineWidth: 1 }, silent: true },
    { type: 'ellipse', shape: { cx: 0, cy: 0, rx: 6.5, ry: 2.8 }, style: { fill: hexA(col, 0.35 * k), stroke: col, lineWidth: 1.2 }, emphasis: { style: hot }, silent: true },
    { type: 'circle', shape: { cx: 0, cy: 0, r: 1.8 }, style: { fill: blank ? '#B8C4D6' : '#FFFFFF' }, silent: true },
    // 光柱：外面一层淡的宽线当光晕（不用 shadowBlur，拖动时更流畅），里面一根亮线
    { type: 'line', shape: { x1: 0, y1: 0, x2: 0, y2: top }, style: { stroke: hexA(col, 0.22 * k), lineWidth: 7 }, silent: true },
    { type: 'line', shape: { x1: 0, y1: 0, x2: 0, y2: top }, style: { lineWidth: 2, stroke: hexA(col, blank ? 0.7 : 1) }, emphasis: { style: hot }, silent: true },
    // 牌面：左边贴着光柱，右上角切角；底色是深色里掺进阶段色
    {
      type: 'polygon',
      shape: { points: [[0, top], [b.w - c, top], [b.w, top + c], [b.w, -a.beam], [0, -a.beam]] },
      style: { fill: mix(T.base, col, blank ? T.fillBlank : T.fill), stroke: col, lineWidth: 1.2, opacity: 0.96 },
      emphasis: { style: { stroke: T.hot, lineWidth: 2, fill: mix(T.base, col, T.fillHot) } },
    },
    { type: 'rect', shape: { x: 0, y: top, width: TAG.bar, height: b.h }, style: { fill: col }, silent: true },
    { type: 'text', style: { text: a.name, x: x0, y: mid, fill: blank ? T.blankName : T.name, font: `${b.name}px sans-serif`, verticalAlign: 'middle' }, silent: true },
    { type: 'text', style: { text: b.main, x: x0 + b.nameW + 9, y: mid, fill: blank ? T.blankCount : T.count, font: `600 ${b.count}px ${NUM_FONT}`, verticalAlign: 'middle' }, silent: true },
    ...(b.sub ? [{ type: 'text', style: { text: b.sub, x: x0 + b.nameW + 9 + b.mainW + 2, y: mid + 1.5, fill: T.sub, font: `500 ${b.subSize}px ${NUM_FONT}`, verticalAlign: 'middle' }, silent: true }] : []),
  ]
}

// 让拖动保持流畅：ECharts 拖动地图时，自带的散点等系列只挪位置，但 custom 系列没有这条快速路径，
// 每拖一步都会把全部标牌重新生成、重画一遍（实测 148 个标牌时每步多花约 27 毫秒，地图明显跟不上鼠标）。
// 这里给标牌系列补上"只挪位置"的做法：按新的视图把每个标牌整体移到新坐标，不重建。
// 系列被重建（整份配置重设）后要再补一次，所以每次排布标牌和拖动时都会调用；已补过的直接跳过。
type TagEl = { attr(v: { x: number; y: number }): void }
type TagSeries = {
  coordinateSystem: { dataToPoint(v: number[]): number[] }
  getRawValue(i: number): number[]
  getData(): { each(cb: (i: number) => void): void; getItemGraphicEl(i: number): TagEl | undefined }
}
function enableFastPan(inst: echarts.ECharts) {
  const ec = inst as unknown as {
    getModel(): { getSeriesByIndex(i: number): TagSeries | undefined }
    getViewOfSeriesModel(m: TagSeries): { updateTransform?: (m: TagSeries) => void } | undefined
  }
  const series = ec.getModel().getSeriesByIndex(SERIES_INDEX.bubbles)
  const view = series && ec.getViewOfSeriesModel(series)
  if (!view || view.updateTransform) return
  view.updateTransform = m => {
    const data = m.getData()
    data.each(i => {
      const [x, y] = m.coordinateSystem.dataToPoint(m.getRawValue(i))
      data.getItemGraphicEl(i)?.attr({ x, y })
    })
  }
}

// 以下序号与 option.series 的顺序一致（轮播提示框按序号定位）
const SERIES_INDEX = { bubbles: 2 }

interface Props {
  data: CompanyData
  stages: Set<string> // 当前显示的阶段（图例筛选）
  paused?: boolean // 暂停轮播
  onPickCity?: (key: string) => void // 点击城市的标牌：key 见 utils 的 cityKey
  scope: Scope // 当前范围（面板按它统计）
  onScope: (s: Scope) => void // 点击标牌、缩小地图时由地图切换范围
  light?: boolean // 浅色主题（照 demo2）
}
// 面板让地图切换范围（点面包屑、点榜单里的地区）
export interface MapHandle { goto(s: Scope): void }

type View = { center?: Coord; zoom: number }

// 画布按实际显示尺寸渲染：1920×1080 的画布缩小显示时，没必要按原尺寸画满像素；
// 高分屏最多按 2 倍渲染。只有变化明显时才更新（更新需要重建图表）
const pixelRatio = () => {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080)
  return Math.min(2, Math.max(0.75, Math.round(devicePixelRatio * s * 4) / 4))
}
function usePixelRatio() {
  const [r, setR] = useState(pixelRatio)
  useEffect(() => {
    let t = 0
    const on = () => { clearTimeout(t); t = window.setTimeout(() => setR(pixelRatio()), 300) }
    addEventListener('resize', on)
    return () => { clearTimeout(t); removeEventListener('resize', on) }
  }, [])
  return r
}

const CAROUSEL_MS = 6000
const CHINA_CENTER: Coord = [104, 35]

const WorldMap = forwardRef<MapHandle, Props>(function WorldMap({ data, stages, paused = false, onPickCity, scope, onScope, light = false }, ref) {
  const pal = light ? PALETTES.light : PALETTES.dark
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [preset, setPreset] = useState<string | null>('全球')
  const [zoom, setZoom] = useState(WORLD_ZOOM)
  const dpr = usePixelRatio()
  const opts = useMemo(() => ({ devicePixelRatio: dpr }), [dpr])
  const chartRef = useRef<ReactECharts | null>(null)
  const view = useRef<View>({ zoom: WORLD_ZOOM })
  const home = useRef<Coord | null>(null)
  const provincesInView = useRef<Label[]>([])
  const roamTimer = useRef(0)
  // 图表实例：创建（或因分辨率变化而重建）完成后才有，滚轮监听要挂在它的画布上
  const [inst, setInst] = useState<echarts.ECharts | null>(null)
  useEffect(() => { loadWorld().then(ok => (ok ? setReady(true) : setFailed(true))) }, [])
  // 点击回调放在 ref 里：父组件每次渲染传入新函数时，不触发地图重建
  const pickCityRef = useRef(onPickCity)
  pickCityRef.current = onPickCity

  const scopeRef = useRef(scope)
  scopeRef.current = scope
  const onScopeRef = useRef(onScope)
  onScopeRef.current = onScope
  const setScope = (s: Scope) => { if (!sameScope(s, scopeRef.current)) { scopeRef.current = s; onScopeRef.current(s) } }

  // 按图例筛选后的公司
  const visible = useMemo(() => data.companies.filter(f => stages.has(f.stage)), [data.companies, stages])

  // 各级汇总
  const aggs = useMemo(() => {
    const domestic = visible.filter(isDomestic)
    const overseas = visible.filter(f => !isDomestic(f))
    const ctx: AggCtx = { stages: data.stages, plain: stages.size < data.stages.length }
    const countries = [
      ...(domestic.length ? aggregate(ctx, 'country', domestic, () => '中国', () => '中国', () => CHINA_CENTER) : []),
      ...aggregate(ctx, 'country', overseas, f => f.country, f => shortCountry(f.country), (_k, l) => mean(l)),
    ]
    const provinces = aggregate(ctx, 'province', domestic, f => f.province, f => f.province,
      (k, l) => geoData.provinceCenter.get(k) ?? mean(l), () => '中国')
    const cities = aggregate(ctx, 'city', visible, cityKey, f => f.city, (_k, l) => mean(l), f => f.province || f.country)
    return { countries, provinces, cities }
  }, [visible, ready, data.stages, stages]) // ready：省份中心点随底图一起加载

  // 各级别要显示的汇总标牌（未做画面排布前）
  const markers = useMemo<Agg[][]>(() => {
    const { countries, provinces, cities } = aggs
    // 省份级：国内按省，海外仍按国家（海外没有省这一级）
    return [countries, [...provinces, ...countries.filter(a => a.key !== '中国')], cities]
  }, [aggs])
  const chart = () => chartRef.current?.getEchartsInstance()
  const markersRef = useRef(markers)
  markersRef.current = markers
  // 当前画面上实际显示的汇总标牌及其排布（画标牌、轮播提示框都按它）
  const rendered = useRef<Placed[]>([])

  // 当前画面上的标牌已经带出的地名（含被合并进去的）
  const takenNames = () => new Set(rendered.current.flatMap(a => (a.kind === 'country' ? [a.key] : a.members ?? [a.name]))) // 国家用全称（key）

  // 生成某一级别的汇总标牌数据；有图表实例时按画面排布（错开、合并）
  const markerOption = (level: Level, inst?: echarts.ECharts) => {
    const bubbles = layoutTags(inst, markersRef.current[level], data.stages)
    rendered.current = bubbles
    return {
      series: [{ id: 'bubbles', data: bubbles.map(a => ({ name: a.name, value: [...a.center, a.list.length], a })) }],
    }
  }

  const option = useMemo(() => {
    const v = view.current
    const marks = markerOption(levelOf(v.zoom), chart()).series
    const labels = labelOption(v.zoom, provincesInView.current, takenNames())
    // 省份底色：国内公司越多越亮
    const perProvince = new Map(aggs.provinces.map(a => [a.key, a.list.length]))
    const maxN = Math.max(1, ...perProvince.values())
    return {
      animationDurationUpdate: 600,
      animationEasingUpdate: 'cubicInOut',
      tooltip: {
        trigger: 'item',
        backgroundColor: pal.tip.bg,
        borderColor: pal.tip.border,
        padding: [12, 16],
        textStyle: { color: pal.tip.ink, fontSize: 15 },
        extraCssText: `box-shadow:0 0 18px ${pal.tip.shadow};line-height:1.7`,
        formatter: (p: { data?: { a?: Agg } }) => {
          const a = p.data?.a
          if (a) {
            const rows = [...data.stages].reverse().filter(s => a.byStage[s])
              .map(s => `<span style="color:${STAGE_COLOR[s]}">●</span> ${s} ${a.byStage[s]} 家`).join('<br>')
            const merged = (a.members?.length ?? 1) > 1
            const hint = merged ? '点击放大，分开查看' : a.kind === 'city' ? '点击查看该市的公司列表' : '点击放大'
            return `<b style="font-size:18px">${a.kind === 'country' ? a.key : a.name}</b>${a.parent && !merged ? `　${a.parent}` : ''}<br>${merged ? `${a.members!.join('、')}<br>` : ''}子公司 ${a.list.length} 家${a.plain || a.target === a.list.length ? '' : `，其中目标公司 ${a.target} 家`}<br>预计规模 ${fmt(a.scale)} 万元<br>${rows}<br><span style="color:${pal.tip.hint}">${hint}</span>`
          }
          return ''
        },
      },
      geo: {
        map: 'world',
        roam: 'move', // 只用自带的拖动；滚轮缩放由下面的 onWheel 接管（自带的每格固定 10%，太慢）
        scaleLimit: { min: MIN_ZOOM, max: MAX_ZOOM },
        selectedMode: false,
        top: 24, bottom: 72, left: 24, right: 24,
        ...(v.center ? { center: v.center } : {}),
        zoom: v.zoom,
        // 区域不描边：国界、省/州分界线是底图里单独的线条区域
        itemStyle: { areaColor: pal.land, borderWidth: 0 },
        emphasis: { disabled: true },
        label: { ...labels.geo.label, color: pal.geoLabel, fontSize: 12 },
        tooltip: { show: false },
        regions: [
          ...[...geoData.cnNames].map(name => ({
            name,
            itemStyle: { areaColor: mix(pal.litLo, pal.litHi, Math.sqrt((perProvince.get(name) ?? 0) / maxN)), borderColor: pal.regionBorder, borderWidth: 0.6 },
          })),
          // 有子公司的海外国家也点亮（和中国公司较少的省份差不多亮）
          ...aggs.countries.filter(c => c.key !== '中国').map(c => ({
            name: GEO_NAME[c.key] ?? c.key,
            itemStyle: { areaColor: mix(pal.litLo, pal.litHi, 0.45), borderColor: pal.regionBorder, borderWidth: 0.6 },
          })),
          ...Object.entries(pal.lines).map(([name, itemStyle]) => ({ name, silent: true, itemStyle })),
        ],
      },
      series: [
        {
          // 单独一层（zlevel 3）：与底图同层时，文字会拖慢每一帧的重绘
          id: 'country-labels', type: 'scatter', coordinateSystem: 'geo', silent: true, zlevel: 3, z: 0, symbolSize: 1, itemStyle: { color: 'transparent' }, // 透明色而不是 opacity:0，否则标签会一起隐藏
          data: labels.series[0].data,
          label: { show: true, formatter: '{b}', color: pal.countryLabel, fontSize: 13 },
          labelLayout: { hideOverlap: true },
        },
        {
          // 放大到 6 倍以上时，显示各国省/州名
          id: 'province-labels', type: 'scatter', coordinateSystem: 'geo', silent: true, zlevel: 3, z: 0, symbolSize: 1, itemStyle: { color: 'transparent' },
          data: labels.series[1].data,
          // padding 加大标签的占位范围：重叠判断更宽松，留下的名字之间有空隙
          label: { show: true, formatter: '{b}', color: pal.provinceLabel, fontSize: 12, padding: [4, 8], backgroundColor: 'rgba(0,0,0,0)' }, // 透明背景：有背景时 padding 才计入占位
          labelLayout: { hideOverlap: true },
        },
        {
          // 汇总标牌（序号见 SERIES_INDEX）：每个数据点按 rendered 里同序号的排布结果来画
          id: 'bubbles', type: 'custom', coordinateSystem: 'geo', zlevel: 2, cursor: 'pointer',
          data: marks[0].data,
          renderItem: (params: { dataIndex: number }, api: { value(i: number): number; coord(v: number[]): number[] }) => {
            const a = rendered.current[params.dataIndex]
            if (!a) return
            const [x, y] = api.coord([api.value(0), api.value(1)])
            return { type: 'group', x, y, children: tagGraphic(a, pal) }
          },
        },
      ],
    }
  }, [data.stages, aggs, markers, ready, pal]) // ready：底图加载后重新生成，带上国界、标注等数据

  // 按缩放倍数更新底图文字和标记
  const applyZoom = (inst: echarts.ECharts, zoom: number) => {
    provincesInView.current = tierOf(zoom) === 2 ? pointsInView(inst, geoData.provinces) : []
    const marks = markerOption(levelOf(zoom), inst).series // 先排标记，才知道哪些地名已经被标记带出来了
    const labels = labelOption(zoom, provincesInView.current, takenNames())
    inst.setOption({ geo: labels.geo, series: [...labels.series, ...marks] })
    enableFastPan(inst)
  }
  // 文字分档或汇总级别变了，立即更新；同一级别内缩放、拖动，停下后再重新排布
  const bandOf = (zoom: number) => `${tierOf(zoom)}-${levelOf(zoom)}-${zoom >= 6}`

  // 数据或筛选变化后（图表已按新配置重画），按当前画面重新排布标记
  useEffect(() => {
    const inst = chart()
    if (inst && home.current) applyZoom(inst, view.current.zoom)
  }, [markers]) // eslint-disable-line react-hooks/exhaustive-deps

  // 记录"完整世界"时的中心点，用于「全球」复位
  const onReady = useCallback((inst: echarts.ECharts) => {
    setInst(inst)
    if (import.meta.env.DEV) (window as unknown as { __wm: echarts.ECharts }).__wm = inst // 仅开发调试用
    if (home.current) {
      // 图表重建（如窗口大小变化）后，恢复到重建前的视图
      const { center, zoom } = view.current
      inst.setOption({ geo: { ...(center ? { center } : {}), zoom } })
      applyZoom(inst, zoom)
      return
    }
    const w = inst.getWidth(), h = inst.getHeight()
    const pt = inst.convertFromPixel({ geoIndex: 0 }, [24 + (w - 48) / 2, 24 + (h - 96) / 2]) as Coord | undefined
    if (pt) home.current = pt
    applyZoom(inst, view.current.zoom)
  }, [])

  // 视图变化后（拖动、滚轮缩放），记住当前视图（数据刷新时保持不变），并按缩放倍数切换文字和汇总级别
  const syncView = useCallback((inst: echarts.ECharts, zoom: number, center: Coord | undefined) => {
    const before = bandOf(view.current.zoom)
    view.current = { center: center && [center[0], center[1]], zoom }
    setPreset(null)
    setZoom(zoom)
    // 缩小到上一级时，范围跟着回退：国家层回到全球；省的范围缩到省层以下回到所在国家
    const sc = scopeRef.current
    if (levelOf(zoom) === 0) setScope(WORLD)
    else if (sc.kind === 'province' && levelOf(zoom) < 2) setScope({ kind: 'country', country: sc.country })
    clearTimeout(roamTimer.current)
    if (before !== bandOf(zoom)) applyZoom(inst, zoom)
    // 停下后：按新画面重新排布汇总标牌，换成画面范围内的省/州名
    else roamTimer.current = window.setTimeout(() => applyZoom(inst, zoom), 150)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 拖动
  const onRoam = useCallback(() => {
    const inst = chart(); if (!inst) return
    enableFastPan(inst)
    // 直接读 geo 组件的当前状态；getOption() 会深拷贝整份配置（含全部边界线），每次拖动事件都调用会很卡
    const geo = (inst as unknown as { getModel(): { getComponent(t: string): { get(k: string): unknown } } }).getModel().getComponent('geo')
    syncView(inst, geo.get('zoom') as number, geo.get('center') as Coord | undefined)
  }, [syncView])

  // 滚轮缩放：以鼠标所在位置为中心，滚两格放大一倍。同一帧内的多次滚动合并成一次更新
  useEffect(() => {
    if (!inst || inst.isDisposed()) return
    const dom = inst.getDom()
    let pending = 0, at: [number, number] = [0, 0], frame = 0
    const apply = () => {
      frame = 0
      const from = view.current.zoom
      const to = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, from * 2 ** (pending / WHEEL_PX_PER_DOUBLE)))
      pending = 0
      if (to === from) return
      // 让鼠标下的地点保持不动：新中心 = 鼠标处 − (鼠标处 − 旧中心) × 旧倍数/新倍数（经纬度到像素是线性的）
      const mid = inst.convertFromPixel({ geoIndex: 0 }, [24 + (inst.getWidth() - 48) / 2, 24 + (inst.getHeight() - 96) / 2]) as Coord | undefined
      const g = inst.convertFromPixel({ geoIndex: 0 }, at) as Coord | undefined
      if (!mid || !g) return
      const k = from / to
      const center: Coord = [g[0] - (g[0] - mid[0]) * k, g[1] - (g[1] - mid[1]) * k]
      inst.dispatchAction({ type: 'hideTip' })
      inst.setOption({ geo: { center, zoom: to } })
      syncView(inst, to, center)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault() // 不让页面跟着滚动或被浏览器缩放
      // 画布显示时被整体缩放过（1920×1080 等比适配窗口），鼠标位置要换算回画布自己的坐标
      const r = dom.getBoundingClientRect()
      at = [(e.clientX - r.left) * inst.getWidth() / r.width, (e.clientY - r.top) * inst.getHeight() / r.height]
      const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY // 按行/按页滚动的折算成像素
      pending -= Math.max(-WHEEL_PX_PER_DOUBLE, Math.min(WHEEL_PX_PER_DOUBLE, px)) // 一次事件最多一倍
      frame ||= requestAnimationFrame(apply)
    }
    dom.addEventListener('wheel', onWheel, { passive: false })
    return () => { dom.removeEventListener('wheel', onWheel); cancelAnimationFrame(frame) }
  }, [inst, syncView])

  const flyTo = (center: Coord | undefined, z: number, key: string | null = null) => {
    const inst = chart(); if (!inst) return
    view.current = { center, zoom: z }
    setPreset(key)
    setZoom(z)
    inst.dispatchAction({ type: 'hideTip' })
    inst.setOption({ geo: { center, zoom: z } })
    applyZoom(inst, z)
  }

  // 点击汇总标牌：国家、省放大到下一级；城市打开该市的公司列表
  const onClick = (p: { data?: { a?: Agg } }) => {
    const a = p.data?.a
    if (!a) return
    // 合并的标牌：原地放大一倍，直到能分开
    if ((a.members?.length ?? 1) > 1) return flyTo(a.center, Math.min(MAX_ZOOM, view.current.zoom * 2))
    if (a.kind === 'city') return pickCityRef.current?.(a.key)
    flyTo(a.center, a.kind === 'country' && a.key !== '中国' ? OVERSEAS_DRILL_ZOOM : DRILL_ZOOM[a.kind])
    setScope(a.kind === 'country' ? { kind: 'country', country: a.key } : { kind: 'province', country: '中国', province: a.key })
  }

  // 面板要求切换范围：飞到对应的地方。该地区的标牌被图例筛掉时，用全部公司算位置
  const aggsRef = useRef(aggs)
  aggsRef.current = aggs
  const goto = (s: Scope) => {
    setScope(s)
    if (s.kind === 'world') return flyTo(home.current ?? undefined, WORLD_ZOOM, '全球')
    if (s.kind === 'area') {
      const all = data.companies.filter(f => inScope(f, s))
      if (!all.length) return
      const v = fitView(all)
      return flyTo(v.center, v.zoom, s.area)
    }
    if (s.kind === 'province') {
      const all = data.companies.filter(f => f.province === s.province && f.country === s.country)
      return flyTo(geoData.provinceCenter.get(s.province) ?? (all.length ? mean(all) : undefined), DRILL_ZOOM.province)
    }
    if (s.country === '中国') return flyTo(CHINA_CENTER, DRILL_ZOOM.country, '中国')
    const a = aggsRef.current.countries.find(x => x.key === s.country), all = data.companies.filter(f => f.country === s.country)
    flyTo(a?.center ?? (all.length ? mean(all) : undefined), OVERSEAS_DRILL_ZOOM)
  }
  const gotoRef = useRef(goto)
  gotoRef.current = goto
  useImperativeHandle(ref, () => ({ goto: s => gotoRef.current(s) }), [])
  // 快捷定位：全球、中国，再加数据里出现的海外大区。点击后地图飞过去，范围一起切换
  const presets = useMemo(() => {
    const list = areas(data.companies), rank = (k: string) => (AREA_ORDER.indexOf(k) + 1) || 99
    return ['全球', '中国', ...list.sort((a, b) => rank(a) - rank(b))]
  }, [data.companies])
  const pickPreset = (key: string) =>
    goto(key === '全球' ? WORLD : key === '中国' ? { kind: 'country', country: '中国' } : { kind: 'area', area: key })

  // 轮播：依次弹出画面内数量最多的几个汇总标牌的提示框；鼠标在地图上或打开详情时暂停
  useEffect(() => {
    const inst = chart()
    if (paused) { inst?.dispatchAction({ type: 'hideTip' }); return }
    if (!ready || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let i = 0
    const t = setInterval(() => {
      const c = chart(); if (!c) return
      const bubbles = rendered.current.map((a, d) => ({ s: SERIES_INDEX.bubbles, d, coord: a.center, n: a.list.length }))
      const w = c.getWidth(), h = c.getHeight()
      const inView = bubbles.sort((a, b) => b.n - a.n).filter(x => {
        const [px, py] = c.convertToPixel({ geoIndex: 0 }, x.coord) as number[]
        return px > 440 && px < w - 60 && py > 170 && py < h - 120 // 避开左侧面板和顶部指标条
      }).slice(0, 12)
      if (!inView.length) return
      const x = inView[i++ % inView.length]
      c.dispatchAction({ type: 'showTip', seriesIndex: x.s, dataIndex: x.d })
    }, CAROUSEL_MS)
    return () => clearInterval(t)
  }, [paused, ready])

  if (failed) return <div className="map-loading">底图数据加载失败，请检查 public/geo 目录下的地图文件后刷新页面。</div>
  if (!ready) return <div className="map-loading">正在加载世界地图…</div>
  return (
    <>
      <ReactECharts
        ref={chartRef}
        echarts={echarts}
        option={option}
        notMerge
        opts={opts}
        style={{ width: '100%', height: '100%' }}
        onChartReady={onReady}
        onEvents={{ georoam: onRoam, click: onClick }}
      />
      <div className="map-tools" role="group" aria-label="地图快捷定位">
        {presets.map(k => (
          <button key={k} aria-pressed={preset === k} onClick={() => pickPreset(k)}>{k}</button>
        ))}
      </div>
      <div className="map-status">
        <span>{LEVELS[levelOf(zoom)]}</span>
        <span>缩放 <b>{zoom.toFixed(1)}×</b></span>
        <span>示意图，非标准地图</span>
      </div>
    </>
  )
})

export default WorldMap
