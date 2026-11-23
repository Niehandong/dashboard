import type { Company } from '../types'
import { fmt, STAGE_COLOR } from '../utils'

interface Props {
  stages: string[]
  factories: Company[]
  active?: string | null
  onToggle?: (stage: string) => void
}

export default function StageFunnel({ stages, factories, active, onToggle }: Props) {
  const max = Math.max(...stages.map(s => factories.filter(f => f.stage === s).length), 1)
  return (
    <div className={`funnel${active ? ' filtered' : ''}`}>
      {stages.map(s => {
        const list = factories.filter(f => f.stage === s)
        const amt = list.reduce((a, f) => a + f.scale, 0)
        const body = (
          <>
            <span className="lab">{s}</span>
            <span><span className="bar" style={{ width: `${Math.max((list.length / max) * 100, 12)}%`, background: STAGE_COLOR[s] }}>{list.length}</span></span>
            <span className="amt">{fmt(amt)}<small> 万</small></span>
          </>
        )
        return onToggle ? (
          <button key={s} className={`f-row${active === s ? ' on' : ''}`} aria-pressed={active === s} onClick={() => onToggle(s)}>{body}</button>
        ) : (
          <div key={s} className="f-row">{body}</div>
        )
      })}
    </div>
  )
}
