import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import './demo4.css'
import { FACTORIES, PRODUCTS, PROJECTS, STAGES, STAGE_STYLE, factoryShort, type Factory } from '../demo2/battleData'
import { fmt } from '../utils'
import LayoutMap, { type Pick } from './LayoutMap'
import { BuildingPhoto, Icon } from './icons'

// demo4：照「客户全景档案.png」复刻的三栏 KA Dashboard（客户全景档案 / 集团作战地图 / 年度经营计划）
// 画布按原图比例固定 1600 宽，随窗口宽度等比缩放，纵向可滚动。
// 集团作战地图一栏内部联动：地图（大区/城市）、工厂状态图例、作战计划表、项目表都能点，点了以后三张表只看选中的工厂。
// 工厂数据和 demo2 共用（battleData.ts：原图表格 5 个 + 为对上地图「中国4/东南亚2/欧洲1/北美1」补的 3 个）。

const W = 1600

/* ---------------- 03 客户全景档案 ---------------- */
const BASIC: [string, ReactNode][] = [
  ['客户名称', 'XXX集团'],
  ['总部所在地', '中国·深圳'],
  ['所属行业', '消费电子 / 新能源 / 汽车（示例）'],
  ['集团规模', <>员工：10万+<i className="d4-gap" />年营收：XXX亿</>],
  ['主要业务', '手机/汽车/储能/智能设备等'],
  ['全球布局', <>全球工厂：8个<i className="d4-gap" />主要工厂：深圳、苏州、越南...</>],
]
const GRADE: [string, string, string, string][] = [
  ['KA等级', 'S级', '集团Owner', '张三'],
  ['区域负责人', '李四', '产品线负责人', '王五'],
  ['合作年限', '5年', '年度采购额', 'XXX 万元'],
]
const DEPTS = [
  { name: '技术部门', sub: '（工艺/设备）', color: '#3A86E0', items: ['关键人：A', '角色：工艺负责人', '关系状态：良好', '合作机会：新工艺验证'] },
  { name: '使用部门', sub: '（生产/应用）', color: '#43A35C', items: ['关键人：B', '角色：应用负责人', '关系状态：稳定', '合作机会：量产导入'] },
  { name: '采购部门', sub: '（采购/供应链）', color: '#F08A33', items: ['关键人：C', '角色：采购经理', '关系状态：待加强', '合作机会：框架协议'] },
  { name: '其他部门', sub: '（财务/法务）', color: '#5A4BD6', items: ['关键人：D', '角色：财务/法务', '关系状态：一般', '合作机会：合同/付款'] },
]

/* ---------------- 04 集团作战地图 ---------------- */
// 和地图上城市针的 key 一致：city:国家|城市
const cityKey = (f: Factory) => `city:${f.country}|${f.city}`
// 阶段标签：彩色底小块，颜色和地图针、图例一致
const StagePill = ({ s }: { s: string }) => {
  const st = STAGE_STYLE[s] ?? { color: '#4A5568', bg: '#EDF1F6' }
  return <span className="d4-pill" style={{ color: st.color, background: st.bg }}>{s}</span>
}
// 可以点的行/按钮：鼠标点击或键盘回车
const clickable = (label: string, run: () => void, on = false) => ({
  tabIndex: 0, role: 'button', 'aria-label': label, 'aria-pressed': on, onClick: run,
  onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run() } },
})

/* ---------------- 05 年度经营计划 ---------------- */
const KPIS: { icon: 'bars' | 'cube' | 'nodes' | 'target'; label: string; value: string; unit: string; note: string }[] = [
  { icon: 'bars', label: '销售目标', value: '2.0', unit: '亿元', note: '同比 +30%' },
  { icon: 'cube', label: '新导入工厂', value: '3', unit: '个', note: '（新增合作）' },
  { icon: 'nodes', label: '跨产品线项目', value: '10', unit: '个', note: '（推进中）' },
  { icon: 'target', label: '订单转化率', value: '≥40%', unit: '', note: '（有效商机→订单）' },
]
const WORKS = [
  ['销售增长', '现有业务维护、新产品导入', '销售额 ≥ 2.0亿元'],
  ['客户拓展', '新增集团工厂、业务部门', '新导入工厂数 ≥ 3个'],
  ['产品协同', '推广激光器、设备、PCD微钻、光连接等', '跨产品线项目数 ≥ 10个'],
  ['重点项目', '打样、验证、报价、订单推进', '项目转化率 ≥ 40%'],
  ['高层关系', '重要客户拜访、技术交流、高层会议', '关键关系覆盖率 100%'],
  ['风险管理', '回款、交付、竞争及项目风险', '重大风险闭环率 ≥ 95%'],
  ['资源投入', '样机、技术支持、客户活动、专项预算', '预算执行率 ≥ 90%'],
]
const QUARTERS: { q: string; months: string; color: string; title: string; items: string[]; result: string; icon: 'doc' | 'hand' | 'order' | 'trophy' }[] = [
  { q: 'Q1', months: '1-3月', color: '#2F7BE0', title: '目标确认与建档', items: ['确认年度目标', '完善客户档案', '梳理项目清单', '制定拜访计划'], result: '年度计划获批', icon: 'doc' },
  { q: 'Q2', months: '4-6月', color: '#3A9FDB', title: '需求挖掘与验证', items: ['重点工厂拓展', '技术交流与订样', '联合方案制定', '商机识别推进'], result: '形成有效机会', icon: 'hand' },
  { q: 'Q3', months: '7-9月', color: '#F0862E', title: '项目推进与转化', items: ['重点项目报价', '商务谈判与订单', '跨产品线协同', '风险识别与闭环'], result: '订单落地', icon: 'order' },
  { q: 'Q4', months: '10-12月', color: '#8A3FD6', title: '业绩复盘与规划', items: ['年度业绩达成', '客户重新评级', '总结关键经验', '制定2028计划'], result: '经营成果沉淀', icon: 'trophy' },
]

/* ---------------- 公共小件 ---------------- */
function Sec({ n, title, children, className = '', extra }: { n: number; title: ReactNode; children: ReactNode; className?: string; extra?: ReactNode }) {
  return (
    <section className={`d4-sec ${className}`}>
      <h3><span><b>{n}.</b> {title}</span>{extra}</h3>
      {children}
    </section>
  )
}
const Dots = ({ items, color }: { items: string[]; color?: string }) => (
  <ul className="d4-dots" style={color ? { ['--dot' as string]: color } : undefined}>{items.map(t => <li key={t}>{t}</li>)}</ul>
)
function Head({ title, sub, art }: { title: string; sub: string; art: ReactNode }) {
  return (
    <header className="d4-head">
      <div className="d4-titles"><h2>{title}</h2><p>{sub}</p></div>
      <div className="d4-art">{art}</div>
    </header>
  )
}
const Empty = ({ n }: { n: number }) => <tr className="d4-more"><td colSpan={n}>所选范围内暂无数据</td></tr>

/* ---------------- 页面 ---------------- */
export default function Demo4() {
  const [scale, setScale] = useState(1)
  const box = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    document.title = 'KA Dashboard'
    const fit = () => setScale(Math.max(0.5, window.innerWidth / W))
    fit()
    window.addEventListener('resize', fit)
    const ro = new ResizeObserver(() => setH(box.current?.offsetHeight ?? 0))
    if (box.current) ro.observe(box.current)
    return () => { window.removeEventListener('resize', fit); ro.disconnect() }
  }, [])

  // 04 栏的联动：pick 为空时看全部工厂
  const [pick, setPick] = useState<Pick | null>(null)
  const plan = pick ? FACTORIES.filter(f => pick.list.some(x => x.name === f.name)) : FACTORIES
  const shorts = new Set(plan.map(factoryShort))
  const products = pick ? PRODUCTS.filter(p => p.focus.split('/').some(x => shorts.has(x))) : PRODUCTS
  const projects = pick ? PROJECTS.filter(p => plan.some(f => f.name === p.factory)) : PROJECTS
  // 点表格里的工厂：选中它（地图飞过去）；再点一次取消
  const pickFactory = (f: Factory) => setPick(p => p?.key === cityKey(f) && p.list.length === 1 ? null : { key: cityKey(f), label: f.name, list: [f], fly: true })
  const pickStage = (s: string) => setPick(p => p?.key === `stage:${s}` ? null : { key: `stage:${s}`, label: `${s} · ${FACTORIES.filter(f => f.stage === s).length}个工厂`, list: FACTORIES.filter(f => f.stage === s) })
  const isOn = (f: Factory) => pick?.list.length === 1 && pick.list[0].name === f.name
  const scope = pick
    ? <span className="d4-scope">{pick.label}<button onClick={() => setPick(null)} aria-label="取消筛选">×</button></span>
    : null

  return (
    <div className="d4" style={{ height: h * scale }}>
      <div ref={box} className="d4-canvas" style={{ width: W, transform: `scale(${scale})` }}>
        <div className="d4-cols">
          {/* ========== 03 ========== */}
          <article className="d4-col c-blue">
            <Head title="客户全景档案" sub="全面了解客户 · 梳理需求与关系 · 识别合作机会" art={<Icon name="folder" />} />
            <div className="d4-body">
              <Sec n={1} title="客户基本信息" className="flat">
                <div className="d4-basic">
                  <table className="d4-kv"><tbody>{BASIC.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
                  <div className="d4-photo"><BuildingPhoto /></div>
                </div>
              </Sec>
              <Sec n={2} title="客户分级与我司信息" className="flat">
                <table className="d4-kv d4-grade"><tbody>{GRADE.map(r => <tr key={r[0]}><th>{r[0]}</th><td>{r[1]}</td><th>{r[2]}</th><td>{r[3]}</td></tr>)}</tbody></table>
              </Sec>
              <Sec n={3} title="关键人物关系图" className="flat">
                <div className="d4-org">
                  <div className="d4-boss"><Icon name="person" /><div><b>集团决策层</b><span>CEO / CTO / 采购VP</span></div></div>
                  <svg className="d4-wires" viewBox="0 0 470 48" preserveAspectRatio="none" aria-hidden>
                    <path d="M235 0 V24 M56 24 H414 M56 24 V44 M177 24 V44 M297 24 V44 M414 24 V44" stroke="#3E73C9" strokeWidth="1.4" fill="none" />
                    {[56, 177, 297, 414].map(x => <path key={x} d={`M${x - 4} 40 L${x} 47 L${x + 4} 40 Z`} fill="#3E73C9" />)}
                  </svg>
                  <div className="d4-depts">
                    {DEPTS.map(d => (
                      <div key={d.name} className="d4-dept">
                        <div className="d4-dept-h" style={{ background: d.color }}><b>{d.name}</b><span>{d.sub}</span></div>
                        <Dots items={d.items} color={d.color} />
                      </div>
                    ))}
                  </div>
                </div>
              </Sec>
              <div className="d4-row45">
                <Sec n={4} title="竞争与合作现状" className="card">
                  <div className="d4-compete">
                    <div><h4>已导入产品</h4><Dots items={['激光器：XXX', '设备：XXX', 'PCD微钻：XXX']} /></div>
                    <div><h4>主要竞争对手</h4><Dots items={['竞品A（优势/劣势）', '竞品B（优势/劣势）', '竞品C（优势/劣势）']} /></div>
                  </div>
                </Sec>
                <Sec n={5} title="未来合作机会" className="card">
                  <Dots items={['潜在产品需求', '重点工厂/项目', '预计项目规模', '时间节点']} />
                </Sec>
              </div>
            </div>
          </article>

          {/* ========== 04 ========== */}
          <article className="d4-col c-orange">
            <Head title="集团作战地图" sub="明确工厂布局 · 规划产品导入 · 制定项目推进路线" art={<Icon name="mapPin" />} />
            <div className="d4-body">
              <Sec n={1} title="集团布局概览" className="flat" extra={scope ?? <span className="d4-hint">点大区/城市/状态，下方表格联动</span>}>
                <div className="d4-overview">
                  <LayoutMap picked={pick} onPick={setPick} />
                  <div className="d4-legend">
                    <h4>工厂状态</h4>
                    {STAGES.map(s => (
                      <div key={s} className={pick?.key === `stage:${s}` ? 'on' : ''} {...clickable(`只看${s}的工厂`, () => pickStage(s), pick?.key === `stage:${s}`)}>
                        <i style={{ background: STAGE_STYLE[s].color }} />{s}
                      </div>
                    ))}
                  </div>
                </div>
              </Sec>
              <Sec n={2} title="各工厂/业务单元作战计划" className="flat" extra={scope}>
                <table className="d4-grid d4-plan">
                  <thead><tr><th>序号</th><th>工厂/业务单元</th><th>目标产品及应用</th><th>当前阶段</th><th>项目负责人</th><th>下一步行动</th><th>预计规模<br />（万元）</th></tr></thead>
                  <tbody>
                    {plan.map(f => (
                      <tr key={f.name} className={isOn(f) ? 'on' : ''} {...clickable(`在地图上定位${f.name}`, () => pickFactory(f), isOn(f))}>
                        <td>{f.no}</td><td>{f.name}</td><td>{f.products}</td><td><StagePill s={f.stage} /></td><td>{f.owner}</td><td>{f.next}</td><td>{fmt(f.scale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Sec>
              <Sec n={3} title="产品布局" className="flat" extra={scope}>
                <table className="d4-grid d4-prod">
                  <thead><tr><th>产品线</th><th>已合作应用</th><th>待导入应用</th><th>机会阶段</th><th>重点工厂</th></tr></thead>
                  <tbody>
                    {products.map(p => <tr key={p.line}><td>{p.line}</td><td>{p.done}</td><td>{p.todo}</td><td>{p.stage}</td><td>{p.focus}</td></tr>)}
                    {!products.length && <Empty n={5} />}
                  </tbody>
                </table>
              </Sec>
              <Sec n={4} title="关键项目推进表（节选）" className="flat" extra={scope}>
                <table className="d4-grid d4-proj">
                  <thead><tr><th>项目编号</th><th>项目名称</th><th>工厂/业务单元</th><th>阶段</th><th>负责人</th><th>计划完成时间</th></tr></thead>
                  <tbody>
                    {projects.map(p => {
                      const f = FACTORIES.find(x => x.name === p.factory)!
                      return (
                        <tr key={p.code} className={isOn(f) ? 'on' : ''} {...clickable(`在地图上定位${p.factory}`, () => pickFactory(f), isOn(f))}>
                          <td>{p.code}</td><td>{p.name}</td><td>{p.factory}</td><td>{p.stage}</td><td>{p.owner}</td><td>{p.due}</td>
                        </tr>
                      )
                    })}
                    {!projects.length && <Empty n={6} />}
                  </tbody>
                </table>
              </Sec>
            </div>
          </article>

          {/* ========== 05 ========== */}
          <article className="d4-col c-purple">
            <Head title="年度经营计划" sub="设定目标 · 分解行动 · 保障资源 · 评估成果" art={<Icon name="growth" />} />
            <div className="d4-body">
              <Sec n={1} title="年度经营目标（2027）" className="flat">
                <div className="d4-kpis">
                  {KPIS.map(k => (
                    <div key={k.label} className="d4-kpi">
                      <Icon name={k.icon} />
                      <span className="d4-kpi-l">{k.label}</span>
                      <span className="d4-kpi-v">{k.value}{k.unit && <small> {k.unit}</small>}</span>
                      <span className="d4-kpi-n">{k.note}</span>
                    </div>
                  ))}
                </div>
              </Sec>
              <Sec n={2} title="年度重点工作与目标" className="flat">
                <table className="d4-grid d4-works">
                  <thead><tr><th>经营模块</th><th>重点工作</th><th>目标 / 衡量指标</th></tr></thead>
                  <tbody>{WORKS.map(r => <tr key={r[0]}><th>{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
                </table>
              </Sec>
              <Sec n={3} title="季度行动计划" className="card d4-qsec">
                <div className="d4-timeline" aria-hidden>
                  {QUARTERS.map(q => <i key={q.q} style={{ borderColor: q.color }} />)}
                </div>
                <div className="d4-quarters">
                  {QUARTERS.map(q => (
                    <div key={q.q} className="d4-q" style={{ ['--qc' as string]: q.color }}>
                      <div className="d4-q-h"><b>{q.q}</b><span>{q.months}</span></div>
                      <h4>{q.title}</h4>
                      <Dots items={q.items} color={q.color} />
                      <div className="d4-q-r"><Icon name={q.icon} color={q.color} />{q.result}</div>
                    </div>
                  ))}
                </div>
              </Sec>
            </div>
          </article>
        </div>
      </div>
    </div>
  )
}
