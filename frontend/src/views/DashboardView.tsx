import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Select } from 'antd'
import type { CompanyData, DetailTarget } from '../types'
import WorldMap, { type MapHandle } from '../components/WorldMap'
import { KpiBar, ProductPanel, StagePanel } from '../components/Panels'
import { inScope, products, tally, WORLD, type Scope } from '../stats'
import DetailDrawer from '../components/DetailDrawer'
import { STAGE_COLOR } from '../utils'

// 设计稿尺寸：窗口和全屏下都按比例缩放这一套界面
const W = 1920, H = 1080

const dateText = (d: Date) => d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

// 时钟单独成组件：每秒只更新自己，不让整个看板（尤其是地图）重新渲染
function Clock({ date }: { date?: boolean }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return date ? <>{dateText(now)}</> : <span className="h-clock">{now.toLocaleTimeString('zh-CN', { hour12: false })}</span>
}

// 集团名在按钮上用简称：去掉末尾的"有限公司"等
const shortGroup = (g: string) => g.replace(/(股份)?有限(责任)?公司$/, '') || g

interface Props {
  data: CompanyData // 当前集团的公司
  groups: string[] // 全部集团
  group: string
  onGroup: (g: string) => void
  light: boolean // 浅色主题
  onTheme: () => void // 切换深色/浅色
}
export default function DashboardView({ data, groups, group, onGroup, light, onTheme }: Props) {
  const [box, setBox] = useState({ s: 1, x: 0, y: 0 })
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  const [target, setTarget] = useState<DetailTarget | null>(null)
  const [mapHover, setMapHover] = useState(false)
  const mapRef = useRef<MapHandle>(null)
  // 当前范围：地图切换，所有面板只统计范围内的公司（不受图例筛选影响，图例只决定地图上画哪些公司）
  const [scope, setScope] = useState<Scope>(WORLD)
  const paused = !!target || mapHover
  // 图例即筛选：默认显示全部阶段，点击切换某个阶段的显示
  const [stages, setStages] = useState<Set<string>>(() => new Set(data.stages))
  const toggleStage = (s: string) => setStages(prev => {
    const next = new Set(prev)
    if (next.has(s)) { if (next.size > 1) next.delete(s) } else next.add(s) // 至少保留一个阶段
    return next
  })
  const stat = useMemo(() => {
    const list = data.companies.filter(c => inScope(c, scope))
    return { t: tally(list, data.stages), products: products(list, data.stages) }
  }, [data.companies, data.stages, scope])
  const stageCount = stat.t.byStage
  // 数据刷新后范围里已经没有公司（如该省被删光）：回到全球
  useEffect(() => { if (scope.kind !== 'world' && !stat.t.total) setScope(WORLD) }, [scope, stat.t.total])

  useLayoutEffect(() => {
    const fit = () => {
      const s = Math.min(innerWidth / W, innerHeight / H)
      setBox({ s, x: (innerWidth - W * s) / 2, y: (innerHeight - H * s) / 2 })
    }
    fit(); addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  }, [])

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  const openCity = useCallback((key: string) => setTarget({ type: 'city', key }), [])
  const crumbs: { name: string; scope: Scope }[] = [
    { name: '全球', scope: WORLD },
    ...(scope.kind === 'area' ? [{ name: scope.area, scope }] : []),
    ...(scope.kind === 'country' || scope.kind === 'province' ? [{ name: scope.country, scope: { kind: 'country' as const, country: scope.country } }] : []),
    ...(scope.kind === 'province' ? [{ name: scope.province, scope }] : []),
  ]

  return (
    <div className="screen-wrap">
      <div className="screen" style={{ transform: `scale(${box.s})`, left: box.x, top: box.y }}>
        {/* 地图铺满整个画布，其余元素浮在上面 */}
        <section className="stage" onMouseEnter={() => setMapHover(true)} onMouseLeave={() => setMapHover(false)}>
          <WorldMap ref={mapRef} data={data} stages={stages} paused={paused} onPickCity={openCity} scope={scope} onScope={setScope} light={light} />
        </section>

        <header className="cmd-head">
          <div className="h-side h-left">
            <Clock date />
            {groups.length > 1 && (
              <Select
                className="h-group" popupClassName="h-group-pop" aria-label="切换集团"
                value={group} onChange={onGroup} popupMatchSelectWidth={false}
                showSearch={groups.length > 8} optionFilterProp="label"
                options={groups.map(g => ({ value: g, label: shortGroup(g), title: g }))}
              />
            )}
          </div>
          <div className="h-plate">
            <svg viewBox="0 0 720 76" aria-hidden="true">
              <defs>
                <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#3D8BD9" stopOpacity=".28" />
                  <stop offset="1" stopColor="#3D8BD9" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="edge" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#3D8BD9" stopOpacity=".2" />
                  <stop offset=".5" stopColor="#8FD3FF" />
                  <stop offset="1" stopColor="#3D8BD9" stopOpacity=".2" />
                </linearGradient>
              </defs>
              <path d="M0 0 H720 L668 72 H52 Z" fill="url(#plate)" />
              <path d="M0 0 L52 72 H668 L720 0" fill="none" stroke="url(#edge)" strokeWidth="1.5" />
              <path d="M300 72 H420" stroke="#FF7A2E" strokeWidth="3" />
            </svg>
            <h1>集团作战地图</h1>
            <p className="h-sub">明确工厂布局 · 规划产品导入 · 制定项目推进路线</p>
          </div>
          <div className="h-side h-right">
            <Clock />
            <button className="h-btn" onClick={onTheme} title="在深色和浅色两种风格之间切换">{light ? '切换深色版' : '切换浅色版'}</button>
            <button className="h-btn" onClick={toggleFull}>{full ? '退出全屏' : '全屏展示'}</button>
          </div>
        </header>

        <div className="corners" aria-hidden="true"><i /><i /><i /><i /></div>

        <KpiBar t={stat.t} />

        <nav className="scope-bar" aria-label="当前范围">
          <span>当前范围</span>
          {crumbs.map((c, i) => (
            i === crumbs.length - 1
              ? <b key={c.name} aria-current="true">{c.name}</b>
              : <button key={c.name} onClick={() => mapRef.current?.goto(c.scope)} title={`回到${c.name}`}>{c.name}</button>
          ))}
        </nav>

        <aside className="side side-l">
          <StagePanel t={stat.t} stages={data.stages} />
          <ProductPanel rows={stat.products} stages={data.stages} />
        </aside>

        <div className="map-legend" role="group" aria-label="按合作阶段筛选">
          {[...data.stages].reverse().map(s => (
            <button key={s} aria-pressed={stages.has(s)} onClick={() => toggleStage(s)} title={stages.has(s) ? `隐藏${s}` : `显示${s}`}>
              <i style={{ background: STAGE_COLOR[s], boxShadow: `0 0 8px ${STAGE_COLOR[s]}` }} />{s}<b>{stageCount[s] ?? 0}</b>
            </button>
          ))}
        </div>
      </div>
      <DetailDrawer data={data} target={target} onNavigate={setTarget} onClose={() => setTarget(null)} />
    </div>
  )
}
