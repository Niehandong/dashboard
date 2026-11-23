import type { Kpis } from '../types'
import { fmt, pct } from '../utils'
import CountUp from './CountUp'

export default function KpiStrip({ k }: { k: Kpis }) {
  const items = [
    { h: '工厂 / 业务单元', v: k.factoryCount, f: String, u: '个', s: `覆盖 ${k.regionCount} 个区域` },
    { h: '合作率', v: Number(pct(k.cooperationRate)), f: String, u: '%', s: `已合作 ${k.cooperatedCount} 个，共 ${k.factoryCount} 个` },
    { h: '预计规模合计', v: k.totalScale, f: fmt, u: '万元', s: `已合作部分占 ${pct(k.cooperatedScaleShare)}%` },
    { h: '产品应用导入', v: k.appsDone, f: String, u: '项已合作', s: `另有 ${k.appsTodo} 项待导入` },
    { h: '关键项目', v: k.projectCount, f: String, u: '个', s: <span className="warn">{k.projectsDueSoon} 个将在 6 个月内到期</span> },
  ]
  return (
    <section className="kpis">
      {items.map(i => (
        <div className="kpi" key={i.h}>
          <h3>{i.h}</h3>
          <div className="v"><CountUp value={i.v} format={i.f} /><small>{i.u}</small></div>
          <div className="s">{i.s}</div>
        </div>
      ))}
    </section>
  )
}
