import { useCallback, useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { hexA } from '../utils'
import { loadWorld } from './OverviewMap'
import { FACTORIES, REGION_COORD, STAGES, STAGE_STYLE, type Coord, type Factory } from './battleData'

// demo2 的布局概览图，照「作战地图」原图的样子：白底、淡蓝色大陆、彩色定位针 + 地名 + 括号里的工厂数。
// 可以拖动、滚轮缩放（以鼠标处为中心）。两级：缩小时按大区（欧洲/中国/东南亚/北美），放大到城市级后每个城市一根针；
// 点大区：放大到这个大区并选中它；点城市：选中这个城市（再点一次、点空白处或点「全球」取消）。
// 选中的工厂交给 onPick，页面上其它板块跟着筛选；选中的针高亮，其它变淡。demo3 仍用深色的 OverviewMap，互不影响。

const PIN = 'path://M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'
const NAVY = '#13285A'
const HOME: { center: Coord; zoom: number } = { center: [22, 22], zoom: 1.22 }
const MIN_ZOOM = 1, MAX_ZOOM = 40
const CITY_ZOOM = 3 // 放大到这个倍数以上按城市显示
const WHEEL_PX_PER_DOUBLE = 200 // 滚轮滚多少像素放大一倍（ECharts 自带的每格 10% 太慢）

type Level = 'region' | 'city'
// 地图上选中的范围：一个大区或一个城市
export interface MapPick { key: string; label: string; list: Factory[] }
interface Mark { key: string; kind: Level; name: string; coord: Coord; list: Factory[]; stage: string }

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
    coord: level === 'region' ? REGION_COORD[key] : list[0].coord,
  }))
}

function series(level: Level, picked: MapPick | null) {
  const ms = marks(level)
  const inPick = (m: Mark) => !picked || m.list.some(f => picked.list.some(x => x.name === f.name))
  const h = level === 'region' ? 44 : 38
  return [
    {
      id: 'pin', type: 'scatter', coordinateSystem: 'geo', cursor: 'pointer', z: 3,
      emphasis: { scale: 1.12 },
      data: ms.map(m => {
        const color = STAGE_STYLE[m.stage].color
        const on = picked?.key === `${m.kind}:${m.key}`, dim = !inPick(m)
        const sub = level === 'region' || m.list.length > 1 ? `(${m.list.length}个工厂)` : `(${m.list[0].name})`
        return {
          name: m.name, value: m.coord, mark: m,
          symbol: PIN, symbolSize: [h * 0.7 * (on ? 1.2 : 1), h * (on ? 1.2 : 1)], symbolOffset: [0, '-50%'], symbolKeepAspect: true,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: hexA(color, 0.78) }, { offset: 1, color }]),
            opacity: dim ? 0.3 : 1, shadowColor: hexA(color, 0.45), shadowBlur: on ? 14 : 8, shadowOffsetY: 3,
          },
          label: {
            show: true, position: 'right', distance: 8, opacity: dim ? 0.35 : 1,
            backgroundColor: on ? 'rgba(255,255,255,.95)' : 'transparent', borderColor: on ? color : 'transparent', borderWidth: on ? 1.5 : 0, borderRadius: 6, padding: on ? [4, 10] : 0,
            formatter: `{n|${m.name}}\n{s|${sub}}`,
            rich: {
              n: { color: NAVY, fontSize: 20, fontWeight: 700, lineHeight: 26, textBorderColor: '#fff', textBorderWidth: 2 },
              s: { color: '#3E4A63', fontSize: 15, lineHeight: 20, textBorderColor: '#fff', textBorderWidth: 2 },
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
        return { name: m.name, value: m.coord, symbol: 'circle', symbolSize: h * 0.3 * k, symbolOffset: [0, -h * 0.65 * k], itemStyle: { color: '#fff', opacity: inPick(m) ? 1 : 0.5 } }
      }),
    },
  ]
}

// 快捷定位：全球 + 图片上的四个大区
const PRESETS = ['全球', '中国', '东南亚', '欧洲', '北美'] as const

export default function BattleMap({ picked, onPick }: { picked: MapPick | null; onPick: (p: MapPick | null) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const [cn, setCn] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [level, setLevel] = useState<Level>('region')
  const [preset, setPreset] = useState<string | null>('全球')
  const view = useRef({ ...HOME })
  const pickRef = useRef({ picked, onPick })
  pickRef.current = { picked, onPick }

  useEffect(() => { let on = true; loadWorld().then(n => on && setCn(n), () => on && setFailed(true)); return () => { on = false } }, [])

  // 视图变了：记下来，并按倍数切换大区/城市
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

  // 把一组点放进画面（留出边距），至少放大到城市级
  const fit = useCallback((pts: Coord[], key: string | null) => {
    const inst = chart.current; if (!inst) return
    const c: Coord = [(Math.min(...pts.map(p => p[0])) + Math.max(...pts.map(p => p[0]))) / 2, (Math.min(...pts.map(p => p[1])) + Math.max(...pts.map(p => p[1]))) / 2]
    let zoom = 7
    if (pts.length > 1) {
      const px = pts.map(p => inst.convertToPixel({ geoIndex: 0 }, p) as number[])
      const dx = Math.max(...px.map(p => p[0])) - Math.min(...px.map(p => p[0])) || 1
      const dy = Math.max(...px.map(p => p[1])) - Math.min(...px.map(p => p[1])) || 1
      zoom = Math.min(10, view.current.zoom * Math.min(inst.getWidth() * 0.5 / dx, inst.getHeight() * 0.5 / dy))
    }
    flyTo(c, Math.max(CITY_ZOOM + 0.5, zoom), key)
  }, [flyTo])

  // 选中一个大区并放大过去（点大区的针、点快捷定位都走这里）；「全球」回到全图并取消选中
  const goRegion = useCallback((k: string) => {
    if (k === '全球') { flyTo(HOME.center, HOME.zoom, k); pickRef.current.onPick(null); return }
    const list = FACTORIES.filter(f => f.region === k)
    fit(list.map(f => f.coord), k)
    pickRef.current.onPick({ key: `region:${k}`, label: k, list })
  }, [flyTo, fit])

  // 初始化底图（只做一次；之后只换标记，不重设 geo，免得视图被重置）
  useEffect(() => {
    if (!cn || !el.current || chart.current) return
    const inst = chart.current = echarts.init(el.current)
    const lit = new Set(FACTORIES.filter(f => f.country !== '中国').map(f => f.country))
    inst.setOption({
      geo: {
        map: 'world', roam: 'move', silent: true, selectedMode: false,
        center: HOME.center, zoom: HOME.zoom, scaleLimit: { min: MIN_ZOOM, max: MAX_ZOOM },
        top: 0, bottom: 0, left: 0, right: 0,
        itemStyle: { areaColor: '#E3EDF9', borderColor: '#FFFFFF', borderWidth: 0.6, shadowColor: 'rgba(120,165,225,.28)', shadowBlur: 10 },
        emphasis: { disabled: true },
        regions: [
          ...cn.map(name => ({ name, itemStyle: { areaColor: '#BCD4F1' } })),
          ...[...lit].map(name => ({ name, itemStyle: { areaColor: '#C9DCF3' } })),
          { name: '_graticule', itemStyle: { borderWidth: 0, opacity: 0 } },
          { name: '_inner', itemStyle: { borderWidth: 0, opacity: 0 } },
          { name: '_border_glow', itemStyle: { borderWidth: 0, opacity: 0 } },
          { name: '_border', itemStyle: { borderColor: '#FFFFFF', borderWidth: 0.7, shadowBlur: 0 } },
          { name: '_china_border', itemStyle: { borderColor: '#8CB1DE', borderWidth: 0.9, shadowBlur: 0 } },
        ],
      },
      series: series('region', null),
    })
    inst.on('click', e => {
      const m = (e.data as { mark?: Mark } | undefined)?.mark
      if (!m) return
      if (m.kind === 'region') return goRegion(m.key)
      // ECharts 会深拷贝 data，这里拿到的是副本，按名称换回原来的工厂对象
      const key = `city:${m.key}`, list = FACTORIES.filter(f => m.list.some(x => x.name === f.name))
      pickRef.current.onPick(pickRef.current.picked?.key === key ? null : { key, label: m.name, list })
    })
    // 点空白处取消选中（拖动不算点击）
    inst.getZr().on('click', e => { if (!e.target) pickRef.current.onPick(null) })
    // 拖动：直接读 geo 组件的状态（getOption 会深拷贝整份配置，拖动时很卡）
    inst.on('georoam', () => {
      const geo = (inst as unknown as { getModel(): { getComponent(t: string): { get(k: string): unknown } } }).getModel().getComponent('geo')
      sync(geo.get('zoom') as number, geo.get('center') as Coord)
      setPreset(null)
    })
  }, [cn, goRegion, sync])

  // 级别变了换标记
  useEffect(() => { chart.current?.setOption({ series: series(level, picked) }, { replaceMerge: ['series'] }) }, [level, cn, picked])

  // 滚轮缩放：鼠标下的地点保持不动，滚两格左右放大一倍
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
      const mid = inst.convertFromPixel({ geoIndex: 0 }, [inst.getWidth() / 2, inst.getHeight() / 2]) as Coord | undefined
      const g = inst.convertFromPixel({ geoIndex: 0 }, at) as Coord | undefined
      if (!mid || !g) return
      const k = from / to
      flyTo([g[0] - (g[0] - mid[0]) * k, g[1] - (g[1] - mid[1]) * k], to, null)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // 整个看板按窗口等比缩放过，鼠标位置要换算回画布自己的坐标
      const r = dom.getBoundingClientRect()
      at = [(e.clientX - r.left) * inst.getWidth() / r.width, (e.clientY - r.top) * inst.getHeight() / r.height]
      const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY
      pending -= Math.max(-WHEEL_PX_PER_DOUBLE, Math.min(WHEEL_PX_PER_DOUBLE, px))
      frame ||= requestAnimationFrame(apply)
    }
    dom.addEventListener('wheel', onWheel, { passive: false })
    return () => { dom.removeEventListener('wheel', onWheel); cancelAnimationFrame(frame) }
  }, [cn, flyTo])

  useEffect(() => {
    if (!el.current) return
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(el.current)
    return () => ro.disconnect()
  }, [cn])
  useEffect(() => () => { chart.current?.dispose(); chart.current = null }, [])

  const zoomBy = (k: number) => flyTo(view.current.center, view.current.zoom * k, null)

  if (failed) return <div className="d2-empty">底图加载失败，刷新页面再试</div>
  return (
    <>
      <div ref={el} className="d2-bmap" aria-label={`工厂分布：${FACTORIES.map(f => `${f.name}（${f.city}，${f.stage}）`).join('，')}`} />
      <div className="d2-presets" role="group" aria-label="快捷定位">
        {PRESETS.map(k => <button key={k} className={preset === k ? 'on' : ''} aria-pressed={preset === k} onClick={() => goRegion(k)}>{k}</button>)}
      </div>
      <div className="d2-zoom">
        <button onClick={() => zoomBy(2)} aria-label="放大">+</button>
        <button onClick={() => zoomBy(0.5)} aria-label="缩小">−</button>
      </div>
      <div className="d2-maphint">{level === 'city' ? '城市级 · 点击城市筛选右侧和下方的表格' : '滚轮放大到城市级 · 点击大区放大并筛选'}</div>
    </>
  )
}
