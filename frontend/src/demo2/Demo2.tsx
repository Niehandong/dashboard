import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { ConfigProvider, Modal, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/noto-serif-sc/900.css'
import './demo2.css'
import { fmt } from '../utils'
import BattleMap, { type MapPick } from './BattleMap'
import { FACTORIES, PRODUCTS, PROJECTS, STAGES, STAGE_STYLE, factoryShort, type Factory } from './battleData'

// demo2：照 data/作战地图.jpg 复刻的一屏四块。数据也照抄图片（见 battleData.ts），不读 CRM 数据。
// 设计稿尺寸：窗口和全屏下都按比例缩放这一套界面
const W = 1920, H = 1080

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <>
      <span className="d2-date">{now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</span>
      <span className="d2-clock">{now.toLocaleTimeString('zh-CN', { hour12: false })}</span>
    </>
  )
}

// 阶段标签：图片表格里的彩色底小块
const Stage = ({ s }: { s: string }) => {
  const st = STAGE_STYLE[s] ?? { color: '#4A5568', bg: '#EDF1F6' }
  return <span className="d2-stage" style={{ color: st.color, background: st.bg }}>{s}</span>
}

function Block({ no, title, note, children, area }: { no: number; title: string; note?: ReactNode; children: ReactNode; area: string }) {
  return (
    <section className={`d2-block d2-${area}`} style={{ gridArea: area }}>
      <header><h2><b>{no}.</b>{title}</h2>{note && <span className="d2-note">{note}</span>}</header>
      <div className="d2-body">{children}</div>
    </section>
  )
}

// 表格行可以点：鼠标点击或键盘回车
const rowProps = (label: string, run: () => void) => ({
  tabIndex: 0, role: 'button', 'aria-label': label, onClick: run,
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run() } },
})

function Board() {
  const [box, setBox] = useState({ s: 1, x: 0, y: 0 })
  const [full, setFull] = useState(() => !!document.fullscreenElement)
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

  // 点表格里的一行：弹出工厂信息
  const [picked, setPicked] = useState<Factory[] | null>(null)
  // 点地图上的城市/大区：2、3、4 板块只看这些工厂（不弹窗）
  const [scope, setScope] = useState<MapPick | null>(null)
  const plan = scope ? FACTORIES.filter(f => scope.list.some(x => x.name === f.name)) : FACTORIES
  const shorts = new Set(plan.map(factoryShort))
  const products = scope ? PRODUCTS.filter(p => p.focus.split('/').some(x => shorts.has(x))) : PRODUCTS
  const projects = scope ? PROJECTS.filter(p => plan.some(f => f.name === p.factory)) : PROJECTS
  const scopeNote = scope && <span className="d2-scope">{scope.label}<button onClick={() => setScope(null)} aria-label="取消筛选">×</button></span>
  const byName = (name: string) => FACTORIES.filter(f => f.name === name)

  return (
    <div className="d2">
      <div className="d2-screen" style={{ transform: `scale(${box.s})`, left: box.x, top: box.y }}>
        <header className="d2-head">
          <div className="d2-titles">
            <h1>集团作战地图</h1>
            <p>明确工厂布局 · 规划产品导入 · 制定项目推进路线</p>
          </div>
          <div className="d2-right">
            <Clock />
            <button onClick={toggleFull}>{full ? '退出全屏' : '全屏展示'}</button>
          </div>
        </header>

        <main className="d2-grid">
          <Block no={1} title="集团布局概览" area="map" note={scopeNote ?? '点击城市或大区，右侧和下方的表格只看这里'}>
            <BattleMap picked={scope} onPick={setScope} />
            <div className="d2-legend">
              <h3>工厂状态</h3>
              {STAGES.map(s => <div key={s}><i style={{ background: STAGE_STYLE[s].color }} />{s}</div>)}
            </div>
          </Block>

          <Block no={2} title="各工厂/业务单元作战计划" area="plan" note={scopeNote}>
            <table className="d2-table">
              <thead><tr><th>序号</th><th>工厂/业务单元</th><th>目标产品及应用</th><th>当前阶段</th><th>项目负责人</th><th>下一步行动</th><th>预计规模<br />（万元）</th></tr></thead>
              <tbody>
                {plan.map(f => (
                  <tr key={f.name} {...rowProps(`查看${f.name}的信息`, () => setPicked([f]))}>
                    <td className="c">{f.no}</td>
                    <td className="c">{f.name}</td>
                    <td className="c">{f.products}</td>
                    <td className="c"><Stage s={f.stage} /></td>
                    <td className="c">{f.owner}</td>
                    <td className="c">{f.next}</td>
                    <td className="r num">{fmt(f.scale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>

          <Block no={3} title="产品布局" area="prod" note={scopeNote}>
            <table className="d2-table">
              <thead><tr><th>产品线</th><th>已合作应用</th><th>待导入应用</th><th>机会阶段</th><th>重点工厂</th></tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.line}>
                    <td className="c">{p.line}</td>
                    <td className="c">{p.done}</td>
                    <td className="c">{p.todo}</td>
                    <td className="c">{p.stage}</td>
                    <td className="c">{p.focus}</td>
                  </tr>
                ))}
                {!products.length && <tr><td colSpan={5} className="d2-none">{scope?.label}暂无相关产品线</td></tr>}
              </tbody>
            </table>
          </Block>

          <Block no={4} title="关键项目推进表（节选）" area="proj" note={scopeNote}>
            <table className="d2-table">
              <thead><tr><th>项目编号</th><th>项目名称</th><th>工厂/业务单元</th><th>阶段</th><th>负责人</th><th>计划完成时间</th></tr></thead>
              <tbody>
                {projects.map(p => (
                  <tr key={p.code} {...rowProps(`查看${p.factory}的信息`, () => setPicked(byName(p.factory)))}>
                    <td className="c">{p.code}</td>
                    <td className="c">{p.name}</td>
                    <td className="c">{p.factory}</td>
                    <td className="c">{p.stage}</td>
                    <td className="c">{p.owner}</td>
                    <td className="c">{p.due}</td>
                  </tr>
                ))}
                {!projects.length && <tr><td colSpan={6} className="d2-none">{scope?.label}暂无关键项目</td></tr>}
              </tbody>
            </table>
          </Block>
        </main>

      </div>

      <Modal open={!!picked} onCancel={() => setPicked(null)} footer={null} width={640} centered rootClassName="d2-modal"
        title={picked && (picked.length === 1 ? <>{picked[0].name} <Stage s={picked[0].stage} /></> : `${picked[0].city}（${picked.length}个工厂）`)}>
        {picked?.map(f => {
          const short = factoryShort(f)
          const lines = PRODUCTS.filter(p => p.focus.split('/').includes(short))
          const projects = PROJECTS.filter(p => p.factory === f.name)
          return (
            <dl key={f.name} className="d2-detail">
              {picked.length > 1 && <><dt>工厂</dt><dd><b>{f.name}</b> <Stage s={f.stage} /></dd></>}
              <dt>所在地</dt><dd>{f.country === '中国' ? `中国 ${f.city}` : `${f.region} · ${f.country} ${f.city}`}</dd>
              <dt>目标产品及应用</dt><dd>{f.products}</dd>
              <dt>当前阶段</dt><dd><Stage s={f.stage} /></dd>
              <dt>项目负责人</dt><dd>{f.owner}</dd>
              <dt>下一步行动</dt><dd>{f.next}</dd>
              <dt>预计规模</dt><dd>{fmt(f.scale)} 万元</dd>
              <dt>重点产品线</dt><dd>{lines.length ? lines.map(p => `${p.line}（已合作：${p.done}；待导入：${p.todo}）`).join('；') : '—'}</dd>
              <dt>关键项目</dt><dd>{projects.length ? projects.map(p => `${p.code} ${p.name}，${p.stage}，计划 ${p.due} 完成`).join('；') : '—'}</dd>
            </dl>
          )
        })}
      </Modal>
    </div>
  )
}

export default function Demo2() {
  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#F26B1D', borderRadius: 6 } }}>
      <Board />
    </ConfigProvider>
  )
}
