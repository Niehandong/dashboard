import { STAGE_COLOR } from '../utils'

export function StageTag({ stage }: { stage: string }) {
  return <span className="tag"><i style={{ background: STAGE_COLOR[stage] ?? '#999' }} />{stage}</span>
}

export function MockTag({ show }: { show: boolean }) {
  return show ? <span className="mock">示例</span> : null
}

export function StageSteps({ stages, current }: { stages: string[]; current: string }) {
  const idx = stages.indexOf(current)
  return (
    <span className="g-steps" title={`项目阶段 ${idx + 1}/${stages.length}：${current}`}>
      {stages.map((s, i) => <i key={s} className={i <= idx ? 'on' : ''} />)}
    </span>
  )
}
