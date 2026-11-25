import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { STAGE_COLOR, hexA } from '../utils'
import type { Area } from './derive'

// 底图里国家的名字和数据里不一样的
const GEO_NAME: Record<string, string> = { 阿联酋: '阿拉伯联合酋长国' }
// 标牌相对落点的方向：挨得近的几个大区错开
const LABEL_POS: Record<string, string> = { 中国: 'right', 东南亚: 'bottom', 亚洲: 'left', 北美: 'right', 南美: 'right', 大洋洲: 'left' }

let ready: Promise<string[]> | null = null
// 注册世界底图，返回国内省级区域的名字（用来把中国点亮）
export function loadWorld() {
  ready ??= fetch('/geo/world.json').then(r => { if (!r.ok) throw new Error('world.json'); return r.json() }).then(world => {
    echarts.registerMap('world', world)
    return (world.features as { properties: { name: string; cn?: boolean } }[]).filter(f => f.properties.cn).map(f => f.properties.name)
  })
  ready.catch(() => { ready = null })
  return ready
}

// 布局概览图：固定视角的世界地图，每个大区一个标记，不缩放不拖动
// picked：选中的地区（其它地区变暗）；点标记选中，再点一次或点空白处取消
export default function OverviewMap({ areas, picked, onPick }: { areas: Area[]; picked: string | null; onPick: (name: string | null) => void }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)
  const [cn, setCn] = useState<string[] | null>(null)
  const [failed, setFailed] = useState(false)
  const pick = useRef({ picked, onPick })
  pick.current = { picked, onPick }

  useEffect(() => { let on = true; loadWorld().then(n => on && setCn(n), () => on && setFailed(true)); return () => { on = false } }, [])

  useEffect(() => {
    if (!cn || !el.current) return
    if (!chart.current) {
      const inst = chart.current = echarts.init(el.current)
      inst.on('click', e => { if (e.name) pick.current.onPick(e.name === pick.current.picked ? null : e.name) })
      inst.getZr().on('click', e => { if (!e.target) pick.current.onPick(null) })
    }
    const lit = { areaColor: '#1C5490', borderColor: '#2B5E92', borderWidth: 0.6 }
    chart.current.setOption({
      geo: {
        map: 'world', roam: false, silent: true, selectedMode: false,
        center: [22, 22], zoom: 1.22, top: 0, bottom: 0, left: 0, right: 0,
        itemStyle: { areaColor: '#0F2B4E', borderWidth: 0 },
        emphasis: { disabled: true },
        regions: [
          ...cn.map(name => ({ name, itemStyle: { ...lit, areaColor: '#2468AD' } })),
          ...areas.flatMap(a => a.countries).filter(n => n !== '中国').map(n => ({ name: GEO_NAME[n] ?? n, itemStyle: lit })),
          { name: '_graticule', itemStyle: { borderColor: 'rgba(111,168,230,.08)', borderWidth: 0.6 } },
          { name: '_inner', itemStyle: { borderWidth: 0, opacity: 0 } },
          { name: '_border_glow', itemStyle: { borderWidth: 0, opacity: 0 } },
          { name: '_border', itemStyle: { borderColor: 'rgba(75,155,232,.55)', borderWidth: 0.7 } },
          { name: '_china_border', itemStyle: { borderColor: '#9ADBFF', borderWidth: 1.2 } },
        ],
      },
      series: [{
        type: 'effectScatter', coordinateSystem: 'geo', cursor: 'pointer',
        emphasis: { scale: 1.3, label: { borderWidth: 2, borderColor: '#fff' } },
        rippleEffect: { scale: 3.2, brushType: 'stroke', period: 5 },
        data: areas.map(a => {
          const color = STAGE_COLOR[a.top] ?? '#6B7C95'
          const on = a.name === picked, dim = picked != null && !on
          return {
            name: a.name, value: a.coord, symbolSize: a.name === '中国' ? 16 : 11,
            itemStyle: { color, opacity: dim ? 0.4 : 1 },
            label: {
              show: true, position: LABEL_POS[a.name] ?? 'top', distance: 10,
              formatter: `{n|${a.name}}{c| ${a.total}}{u| 家}\n{s|已合作 ${a.done}}{t|在谈 ${a.talking}}`,
              opacity: dim ? 0.45 : 1,
              backgroundColor: on ? 'rgba(20,52,92,.96)' : 'rgba(9,24,44,.9)', borderColor: on ? '#fff' : color, borderWidth: on ? 2 : 1, borderRadius: 3, padding: [6, 10],
              shadowColor: hexA(color, 0.5), shadowBlur: 10,
              rich: {
                n: { color: '#fff', fontSize: 16, fontWeight: 700, lineHeight: 22 },
                c: { color, fontSize: 20, fontWeight: 600, fontFamily: 'Barlow Condensed' },
                u: { color: '#8FB2D9', fontSize: 12 },
                s: { color: '#A9C2DE', fontSize: 12, lineHeight: 18 },
                t: { color: '#A9C2DE', fontSize: 12, lineHeight: 18, padding: [0, 0, 0, 12] },
              },
            },
          }
        }),
      }],
    }, true)
  }, [cn, areas, picked])

  // 容器大小变了（如 demo3 收起左侧目录）跟着重画
  useEffect(() => {
    if (!el.current) return
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(el.current)
    return () => ro.disconnect()
  }, [cn])
  useEffect(() => () => { chart.current?.dispose(); chart.current = null }, [])

  if (failed) return <div className="d2-empty">底图加载失败，刷新页面再试</div>
  return <div ref={el} className="d2-map" aria-label={`各大区子公司数量：${areas.map(a => `${a.name} ${a.total} 家`).join('，')}`} />
}
