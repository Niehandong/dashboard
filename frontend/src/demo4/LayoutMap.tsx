import { useCallback, useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { FACTORIES, STAGES, STAGE_STYLE, type Coord, type Factory } from '../demo2/battleData'

// demo4 的「集团布局概览」地图。样子照原图：亚太居中（欧洲在左、美洲在右）、浅蓝大陆、彩色定位针 + 地名 + 括号里的工厂数。
// 交互参考 demo2：拖动、滚轮/按钮缩放；缩小时按大区显示，放大到城市级后每个城市一根针；
// 点大区：放大过去并选中；点城市：选中这个城市；点空白处或「全球」取消。选中范围交给 onPick，04 栏的三张表跟着筛选。

// 底图沿用 demo1/demo2 的 /geo/world.json，把西半球的多边形整体挪到东边（经度 +360），拼成太平洋居中的版本
type Ring = number[][]
type Geom = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
type Feature = { type: 'Feature'; properties: { name: string }; geometry: Geom }
const WEST = -25 // 经度小于这个的挪到右边
const shift = ([x, y]: Coord): Coord => [x < WEST ? x + 360 : x, y]

const shiftPoly = (poly: Ring[]) => {
  const outer = poly[0]
  const lon = outer.reduce((s, p) => s + p[0], 0) / outer.length
  const lat = outer.reduce((s, p) => s + p[1], 0) / outer.length
  if (lat < -58) return null // 南极洲不画，和原图一样
  return lon < WEST ? poly.map(r => r.map(([x, y]) => [x + 360, y])) : poly
}

let ready: Promise<void> | null = null
function loadPacific() {
  ready ??= fetch('/geo/world.json').then(r => { if (!r.ok) throw new Error('world.json'); return r.json() }).then(world => {
    const features = (world.features as Feature[]).filter(f => !f.properties.name.startsWith('_')).flatMap(f => {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
      const out = polys.map(shiftPoly).filter((p): p is Ring[] => p != null)
      return out.length ? [{ ...f, geometry: { type: 'MultiPolygon', coordinates: out } }] : []
    })
    echarts.registerMap('world-pacific', { type: 'FeatureCollection', features } as never)
  })
  ready.catch(() => { ready = null })
  return ready
}

// 选中的范围：一个大区、一个城市或一个阶段。fly：选中后地图要飞过去（从表格点进来时）
export interface Pick { key: string; label: string; list: Factory[]; fly?: boolean }
type Level = 'region' | 'city'
interface Mark { key: string; kind: Level; name: string; coord: Coord; list: Factory[]; stage: string }

// 大区针的位置照原图摆（已换算成太平洋居中的经度）
const REGION_AT: Record<string, Coord> = { 欧洲: [6, 50], 中国: [116, 36], 东南亚: [114, 4], 北美: [256, 44] }
const BOUNDS: [Coord, Coord] = [[-20, 78], [310, -48]]
const HOME = { center: [(BOUNDS[0][0] + BOUNDS[1][0]) / 2, (BOUNDS[0][1] + BOUNDS[1][1]) / 2] as Coord, zoom: 1 }
const MIN_ZOOM = 1, MAX_ZOOM = 40, CITY_ZOOM = 2.6
const WHEEL_PX_PER_DOUBLE = 200 // 滚轮滚多少像素放大一倍
const PIN = 'path://M12 0C5.37 0 0 5.37 0 12c0 8.4 10.2 18.6 11.1 19.5a1.3 1.3 0 0 0 1.8 0C13.8 30.6 24 20.4 24 12 24 5.37 18.63 0 12 0z'
const NAVY = '#1B2D5C'
const PRESETS = ['全球', '中国', '东南亚', '欧洲', '北美'] as const
// 城市级标签默认在针右边；武汉夹在成都和苏州之间，放到下面免得压住苏州的针
const BELOW = new Set(['武汉'])

// 一组工厂里推进得最靠前的阶段（STAGES 里越靠前越远）
const topStage = (l: Factory[]) => STAGES[Math.min(...l.map(f => STAGES.indexOf(f.stage as typeof STAGES[number])))]

function marks(level: Level): Mark[] {
  const groups = new Map<string, Factory[]>()
  for (const f of FACTORIES) {
    const k = level === 'region' ? f.region : `${f.country}|${f.city}`
    groups.set(k, [...(groups.get(k) ?? []), f])
  }
  return [...groups].map(([key, list]) => ({
    key, kind: level, list, stage: topStage(list),
    name: level === 'region' ? key : list[0].city,
    coord: level === 'region' ? REGION_AT[key] : shift(list[0].coord),
  }))
}

function series(level: Level, picked: Pick | null) {
  const ms = marks(level)
  const inPick = (m: Mark) => !picked || m.list.some(f => picked.list.some(x => x.name === f.name))
  const h = 26
  return [
    {
      id: 'pin', type: 'scatter', coordinateSystem: 'geo', cursor: 'pointer', z: 3,
      labelLayout: { moveOverlap: 'shiftY' }, // 城市挨得近（武汉/苏州）时标签上下错开
      emphasis: { scale: 1.12 },
      data: ms.map(m => {
        const color = STAGE_STYLE[m.stage].color
        const on = picked?.key === `${m.kind}:${m.key}`, dim = !inPick(m)
        const k = on ? 1.2 : 1
        const sub = level === 'region' || m.list.length > 1 ? `(${m.list.length}个工厂)` : `(${m.list[0].name})`
        return {
          name: m.name, value: m.coord, mark: m,
          symbol: PIN, symbolSize: [h * 0.78 * k, h * k], symbolOffset: [0, '-50%'], symbolKeepAspect: true,
          itemStyle: { color, opacity: dim ? 0.3 : 1, shadowColor: 'rgba(30,60,110,.3)', shadowBlur: on ? 8 : 4, shadowOffsetY: 2 },
          label: {
            show: true, opacity: dim ? 0.35 : 1,
            ...(level === 'city' && BELOW.has(m.name) ? { position: 'bottom', distance: 2, align: 'center' } : { position: 'right', distance: 5, offset: [0, -6] }),
            backgroundColor: on ? 'rgba(255,255,255,.95)' : 'transparent', borderColor: on ? color : 'transparent', borderWidth: on ? 1 : 0, borderRadius: 4, padding: on ? [2, 6] : 0,
            formatter: `{n|${m.name}}\n{s|${sub}}`,
            rich: {
              n: { color: NAVY, fontSize: 13, fontWeight: 700, lineHeight: 17, textBorderColor: '#fff', textBorderWidth: 2 },
              s: { color: '#4A5873', fontSize: 11.5, lineHeight: 15, textBorderColor: '#fff', textBorderWidth: 2 },
            },
          },
        }
      }),
    },
    {
      // 针头的白心
      id: 'dot', type: 'scatter', coordinateSystem: 'geo', silent: true, z: 4,
      data: ms.map(m => {
        const k = picked?.key === `${m.kind}:${m.key}` ? 1.2 : 1
        return { name: m.name, value: m.coord, symbol: 'circle', symbolSize: 8 * k, symbolOffset: [0, -h * 0.63 * k], itemStyle: { color: '#fff', opacity: inPick(m) ? 1 : 0.5 } }
      }),
    },
  ]
}

export default function LayoutMap({ picked, onPick }: { picked: Pick | null; onPick: (p: Pick | null) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const [ok, setOk] = useState(false)
  const [failed, setFailed] = useState(false)
  const [level, setLevel] = useState<Level>('region')
  const [preset, setPreset] = useState<string | null>('全球')
  const view = useRef({ ...HOME })
  const pickRef = useRef({ picked, onPick })
  pickRef.current = { picked, onPick }

  useEffect(() => { let on = true; loadPacific().then(() => on && setOk(true), () => on && setFailed(true)); return () => { on = false } }, [])

  const sync = useCallback((zoom: number, center: Coord) => {
    view.current = { zoom, center }
    setLevel(zoom >= CITY_ZOOM ? 'city' : 'region')
  }, [])

  const flyTo = useCallback((center: Coord, zoom: number, key: string | null) => {
    const inst = chart.current; if (!inst) return
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
    inst.setOption({ geo: { center, zoom } })
    sync(zoom, center)
    setPreset(key)
  }, [sync])

  // 把一组工厂放进画面（留出边距），至少放大到城市级
  const fit = useCallback((list: Factory[], key: string | null) => {
    const inst = chart.current; if (!inst || !list.length) return
    const pts = list.map(f => shift(f.coord))
    const c: Coord = [(Math.min(...pts.map(p => p[0])) + Math.max(...pts.map(p => p[0]))) / 2, (Math.min(...pts.map(p => p[1])) + Math.max(...pts.map(p => p[1]))) / 2]
    let zoom = 6
    if (pts.length > 1) {
      const px = pts.map(p => inst.convertToPixel({ geoIndex: 0 }, p) as number[])
      const dx = Math.max(...px.map(p => p[0])) - Math.min(...px.map(p => p[0])) || 1
      const dy = Math.max(...px.map(p => p[1])) - Math.min(...px.map(p => p[1])) || 1
      zoom = Math.min(8, view.current.zoom * Math.min(inst.getWidth() * 0.45 / dx, inst.getHeight() * 0.4 / dy))
    }
    flyTo(c, Math.max(CITY_ZOOM + 0.4, zoom), key)
  }, [flyTo])

  // 选中一个大区并放大过去（点大区针、点快捷定位都走这里）；「全球」回到全图并取消选中
  const goRegion = useCallback((k: string) => {
    if (k === '全球') { flyTo(HOME.center, HOME.zoom, k); pickRef.current.onPick(null); return }
    const list = FACTORIES.filter(f => f.region === k)
    fit(list, k)
    pickRef.current.onPick({ key: `region:${k}`, label: `${k} · ${list.length}个工厂`, list })
  }, [flyTo, fit])

  // 初始化底图（只做一次；之后只换标记，不重设 geo，免得视图被重置）
  useEffect(() => {
    if (!ok || !el.current || chart.current) return
    const inst = chart.current = echarts.init(el.current)
    inst.setOption({
      geo: {
        map: 'world-pacific', roam: 'move', silent: true, selectedMode: false,
        boundingCoords: BOUNDS, center: HOME.center, zoom: HOME.zoom, scaleLimit: { min: MIN_ZOOM, max: MAX_ZOOM },
        top: 0, bottom: 0, left: 0, right: 0, aspectScale: 0.85,
        itemStyle: { areaColor: '#D6E6F7', borderColor: '#E9F2FC', borderWidth: 0.4, shadowColor: 'rgba(130,175,228,.45)', shadowBlur: 6 },
        emphasis: { disabled: true },
      },
      series: series('region', null),
    })
    inst.on('click', e => {
      const m = (e.data as { mark?: Mark } | undefined)?.mark
      if (!m) return
      if (m.kind === 'region') return goRegion(m.key)
      // ECharts 会深拷贝 data，按名称换回原来的工厂对象
      const key = `city:${m.key}`, list = FACTORIES.filter(f => m.list.some(x => x.name === f.name))
      pickRef.current.onPick(pickRef.current.picked?.key === key ? null : { key, label: list.length > 1 ? `${m.name} · ${list.length}个工厂` : list[0].name, list })
    })
    // 点空白处取消选中（拖动不算点击）
    inst.getZr().on('click', e => { if (!e.target) pickRef.current.onPick(null) })
    // 拖动：直接读 geo 组件的状态（getOption 会深拷贝整份配置，拖动时很卡）
    inst.on('georoam', () => {
      const geo = (inst as unknown as { getModel(): { getComponent(t: string): { get(k: string): unknown } } }).getModel().getComponent('geo')
      sync(geo.get('zoom') as number, geo.get('center') as Coord)
      setPreset(null)
    })
  }, [ok, goRegion, sync])

  // 级别或选中变了换标记
  useEffect(() => { chart.current?.setOption({ series: series(level, picked) }, { replaceMerge: ['series'] }) }, [level, ok, picked])

  // 从表格点进来的：地图飞到这些工厂
  useEffect(() => { if (ok && picked?.fly) fit(picked.list, null) }, [ok, picked, fit])

  // 滚轮缩放：鼠标下的地点保持不动
  useEffect(() => {
    const inst = chart.current
    if (!inst) return
    const dom = inst.getDom()
    let pending = 0, at: number[] = [0, 0], frame = 0
    const apply = () => {
      frame = 0
      const from = view.current.zoom
      const to = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, from * 2 ** (pending / WHEEL_PX_PER_DOUBLE)))
      pending = 0
      if (to === from) return
      if (to === MIN_ZOOM) return flyTo(HOME.center, MIN_ZOOM, '全球')
      const mid = inst.convertFromPixel({ geoIndex: 0 }, [inst.getWidth() / 2, inst.getHeight() / 2]) as Coord | undefined
      const g = inst.convertFromPixel({ geoIndex: 0 }, at) as Coord | undefined
      if (!mid || !g) return
      const k = from / to
      flyTo([g[0] - (g[0] - mid[0]) * k, g[1] - (g[1] - mid[1]) * k], to, null)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // 整个页面按窗口等比缩放过，鼠标位置要换算回画布自己的坐标
      const r = dom.getBoundingClientRect()
      at = [(e.clientX - r.left) * inst.getWidth() / r.width, (e.clientY - r.top) * inst.getHeight() / r.height]
      const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY
      pending -= Math.max(-WHEEL_PX_PER_DOUBLE, Math.min(WHEEL_PX_PER_DOUBLE, px))
      frame ||= requestAnimationFrame(apply)
    }
    dom.addEventListener('wheel', onWheel, { passive: false })
    return () => { dom.removeEventListener('wheel', onWheel); cancelAnimationFrame(frame) }
  }, [ok, flyTo])

  useEffect(() => {
    if (!el.current) return
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(el.current)
    return () => ro.disconnect()
  }, [ok])
  useEffect(() => () => { chart.current?.dispose(); chart.current = null }, [])

  const zoomBy = (k: number) => {
    const to = view.current.zoom * k
    if (to <= MIN_ZOOM) flyTo(HOME.center, MIN_ZOOM, '全球')
    else flyTo(view.current.center, to, null)
  }

  if (failed) return <div className="d4-map-fail">底图加载失败，刷新页面再试</div>
  return (
    <div className="d4-mapbox">
      <div ref={el} className="d4-map" aria-label={`工厂分布：${FACTORIES.map(f => `${f.name}（${f.city}，${f.stage}）`).join('，')}`} />
      <div className="d4-presets" role="group" aria-label="快捷定位">
        {PRESETS.map(k => <button key={k} className={preset === k ? 'on' : ''} aria-pressed={preset === k} onClick={() => goRegion(k)}>{k}</button>)}
      </div>
      <div className="d4-zoom">
        <button onClick={() => zoomBy(2)} aria-label="放大">+</button>
        <button onClick={() => zoomBy(0.5)} aria-label="缩小">−</button>
      </div>
    </div>
  )
}
