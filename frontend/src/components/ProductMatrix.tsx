import type { Product } from '../types'
import { hexA, STAGE_COLOR } from '../utils'

// 产品线 × 合作阶段 热力矩阵
export function ProductHeat({ products, stages }: { products: Product[]; stages: string[] }) {
  const max = Math.max(...products.flatMap(p => Object.values(p.apps)), 1)
  return (
    <div className="heat">
      <span />
      {stages.map(s => <span key={s} className="h">{s}</span>)}
      {products.map(p => (
        <div key={p.line} style={{ display: 'contents' }}>
          <span className="rl">{p.line}</span>
          {stages.map(s => {
            const n = p.apps[s] ?? 0
            return (
              <span key={s} className="c" style={n ? { background: hexA(STAGE_COLOR[s], 0.25 + (0.75 * n) / max), color: '#fff' } : undefined}>
                {n || '–'}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
