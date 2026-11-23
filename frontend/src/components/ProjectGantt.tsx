import type { Company, Project } from '../types'
import { isDueSoon, monthsBetween, parseYM } from '../utils'
import { MockTag, StageSteps } from './StageTag'

interface Props {
  projects: Project[]
  factories: Company[]
  stages: string[]
  today: Date
  onOpen?: (p: Project) => void
}

export default function ProjectGantt({ projects, factories, stages, today, onOpen }: Props) {
  // 时间范围：最早立项月 ~ 最晚到期月 + 1
  const starts = projects.map(p => parseYM(p.start).getTime())
  const dues = projects.map(p => parseYM(p.due).getTime())
  const g0 = new Date(Math.min(...starts))
  const gEnd = new Date(Math.max(...dues))
  const total = Math.max(Math.round(monthsBetween(g0, gEnd)) + 1, 6)
  const pos = (d: Date) => (monthsBetween(g0, d) / total) * 100
  const months = Array.from({ length: total }, (_, i) => new Date(g0.getFullYear(), g0.getMonth() + i, 1))
  const fname = (id: string) => factories.find(f => f.id === id)?.name ?? id
  const sorted = [...projects].sort((a, b) => a.due.localeCompare(b.due))
  const todayPos = pos(today)

  return (
    <div className="gantt">
      <div className="g-axis">
        <span>项目</span>
        <div className="g-months" style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}>
          {months.map((d, i) => (
            <span key={i}>{i % 2 ? '' : d.getMonth() === 0 || i === 0 ? `${String(d.getFullYear()).slice(2)}年${d.getMonth() + 1}月` : `${d.getMonth() + 1}月`}</span>
          ))}
        </div>
      </div>
      <div className="g-body">
        {sorted.map(p => {
          const s = pos(parseYM(p.start))
          const e = pos(parseYM(p.due))
          const soon = isDueSoon(p.due, today)
          const Row = onOpen ? 'button' : 'div'
          return (
            <Row key={p.code} className="g-row" onClick={onOpen ? () => onOpen(p) : undefined}>
              <span className="g-name">
                {p.name}<MockTag show={p.mock} />
                <small>{fname(p.factoryId)}，{p.owner}，{p.stage}</small>
                <StageSteps stages={stages} current={p.stage} />
              </span>
              <span className="g-track">
                <span className={`g-bar${soon ? ' soon' : ''}`} style={{ left: `${s}%`, width: `${e - s}%` }}>
                  <em>{p.due.replace('-', '/')}</em>
                </span>
              </span>
            </Row>
          )
        })}
        {todayPos >= 0 && todayPos <= 100 && (
          <div className="g-overlay"><span /><div><div className="g-today" style={{ left: `${todayPos}%` }}><span>今天</span></div></div></div>
        )}
      </div>
    </div>
  )
}
