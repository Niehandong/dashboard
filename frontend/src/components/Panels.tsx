import type { ReactNode } from 'react'
import { STAGE_COLOR } from '../utils'
import type { Tally } from '../stats'
import CountUp from './CountUp'

// 浮在地图上的面板：和地图标牌同一套样式（半透明深色底、细描边、右上角切角）
function Panel({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="pn">
      <header><h2>{title}</h2>{note != null && <span>{note}</span>}</header>
      {children}
    </section>
  )
}

// 一条按阶段分段的横条：宽度 = 家数 ÷ max，推进靠前的阶段在左
function StageBar({ by, stages, max }: { by: Record<string, number>; stages: string[]; max: number }) {
  return (
    <span className="pn-bar">
      {[...stages].reverse().filter(s => by[s]).map(s => (
        <i key={s} style={{ width: `${(by[s] / max) * 100}%`, background: STAGE_COLOR[s] }} title={`${s} ${by[s]} 家`} />
      ))}
    </span>
  )
}

// 指标条：标题下面的一行数字
export function KpiBar({ t }: { t: Tally }) {
  const items: { h: string; v: number; f?: (n: number) => string; u: string; cls?: string }[] = [
    { h: '子公司', v: t.total, u: '家' },
    ...(t.target < t.total ? [{ h: '目标公司', v: t.target, u: '家' }] : []), // 全部都是目标公司时不重复显示
    { h: '已合作', v: t.done, u: '家', cls: 'ok' },
    { h: '合作率', v: Math.round(t.rate * 1000), f: n => (n / 10).toFixed(1), u: '%' },
    { h: '待突破', v: t.todo, u: '家', cls: 'todo' },
  ]
  return (
    <div className="kpi-strip">
      {items.map(i => (
        <div key={i.h} className={i.cls}>
          <span>{i.h}</span>
          <b><CountUp value={i.v} format={i.f} duration={700} /></b>
          <small>{i.u}</small>
        </div>
      ))}
    </div>
  )
}

// 合作阶段：四个阶段各多少家。「未合作」分成目标公司里未合作的，和产品不适用的（更暗）
export function StagePanel({ t, stages }: { t: Tally; stages: string[] }) {
  const max = Math.max(1, ...stages.map(s => t.byStage[s] ?? 0))
  const na = t.total - t.target
  return (
    <Panel title="合作阶段" note={`子公司 ${t.total} 家`}>
      <ul className="pn-rows pn-stage">
        {[...stages].reverse().map(s => {
          const n = t.byStage[s] ?? 0, tn = t.targetByStage[s] ?? 0
          return (
            <li key={s}>
              <span className="lab">{s}</span>
              <span className="pn-bar">
                {tn > 0 && <i style={{ width: `${(tn / max) * 100}%`, background: STAGE_COLOR[s] }} />}
                {n - tn > 0 && <i className="na" style={{ width: `${((n - tn) / max) * 100}%` }} />}
              </span>
              <b>{n}</b>
            </li>
          )
        })}
      </ul>
      {na > 0 && <p className="pn-foot"><i className="na-key" />未合作里有 {na} 家产品不适用，不计入合作率</p>}
    </Panel>
  )
}

// 目标产品：每种产品的 已合作 / 目标公司
export function ProductPanel({ rows, stages }: { rows: { name: string; t: Tally }[]; stages: string[] }) {
  const max = Math.max(1, ...rows.map(r => r.t.target))
  return (
    <Panel title="目标产品" note="已合作 / 子公司">
      {rows.length ? (
        <ul className="pn-rows pn-prod">
          {rows.map(r => (
            <li key={r.name}>
              <span className="lab">{r.name}</span>
              <StageBar by={r.t.targetByStage} stages={stages} max={max} />
              <b>{r.t.done}<small>/{r.t.target}</small></b>
            </li>
          ))}
        </ul>
      ) : <p className="pn-empty">这个范围内没有目标公司</p>}
    </Panel>
  )
}
