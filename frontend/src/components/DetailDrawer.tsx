import { useMemo } from 'react'
import { Drawer } from 'antd'
import type { CompanyData, DetailTarget } from '../types'
import { byProgress, cityKey, fmt, groupByCity, isDomestic, STAGE_COLOR } from '../utils'
import { StageTag } from './StageTag'

interface Props {
  data: CompanyData
  target: DetailTarget | null
  onNavigate: (t: DetailTarget) => void
  onClose: () => void
}

export default function DetailDrawer({ data, target, onNavigate, onClose }: Props) {
  // 公司详情直接从已加载的列表里取（数据定时刷新后，这家公司可能已不在列表里）
  const company = useMemo(
    () => (target?.type === 'company' ? data.companies.find(c => c.id === target.id) : undefined),
    [target, data.companies],
  )

  // 城市列表：用全部公司（不受图例筛选影响），按阶段、规模排序
  const cityGroup = useMemo(() => {
    if (target?.type !== 'city') return undefined
    return groupByCity(data.companies.filter(f => cityKey(f) === target.key), data.stages)[0]
  }, [target, data.companies, data.stages])

  let title: React.ReactNode = ''
  let body: React.ReactNode = null

  if (target?.type === 'company') {
    const f = company
    const fromCity = target.fromCity
    const back = fromCity && (
      <button className="d-back" onClick={() => onNavigate({ type: 'city', key: fromCity })}>‹ 返回{fromCity.split('|')[1]}的公司列表</button>
    )
    if (!f) {
      title = '公司详情'
      body = <div className="detail">{back}<p className="d-empty">未找到该公司，数据可能已更新。请关闭后在地图上重新选择。</p></div>
    } else {
      title = f.name
      body = (
        <div className="detail">
          {back}
          <div className="d-head"><StageTag stage={f.stage} /><span className="d-scale">{fmt(f.scale)}<small> 万元预计规模</small></span></div>
          <dl className="d-grid">
            <dt>所在地</dt><dd>{isDomestic(f) ? f.province : f.country}，{f.city}（{f.region}）</dd>
            {f.group && <><dt>所属集团</dt><dd>{f.group}</dd></>}
            <dt>目标产品</dt><dd>{f.products.join('、') || '未填写'}</dd>
            <dt>负责人</dt><dd>{f.owner || '未填写'}</dd>
            <dt>下一步行动</dt><dd className="d-next">{f.next || '未填写'}</dd>
            {f.address && <><dt>注册地址</dt><dd>{f.address}</dd></>}
            {f.website && <><dt>网址</dt><dd><a href={f.website} target="_blank" rel="noreferrer">{f.website}</a></dd></>}
          </dl>
        </div>
      )
    }
  } else if (target?.type === 'city') {
    const g = cityGroup
    title = g ? <>{g.city}<small className="d-sub">{g.province}，子公司 {g.list.length} 家</small></> : '城市'
    body = !g ? <p className="d-empty">这个城市没有公司数据。</p> : (
      <div className="detail">
        <div className="d-stagebar" aria-label="各阶段公司数">
          {[...data.stages].reverse().map(s => g.byStage[s] ? (
            <span key={s} style={{ flex: g.byStage[s], background: STAGE_COLOR[s] }} title={`${s} ${g.byStage[s]} 家`} />
          ) : null)}
        </div>
        <p className="d-legend">
          {[...data.stages].reverse().filter(s => g.byStage[s]).map(s => (
            <span key={s}><i style={{ background: STAGE_COLOR[s] }} />{s} {g.byStage[s]}</span>
          ))}
          <span>预计规模合计 {fmt(g.scale)} 万元</span>
        </p>
        <ul className="d-list">
          {[...g.list].sort(byProgress(data.stages)).map(f => (
            <li key={f.id}>
              <button onClick={() => onNavigate({ type: 'company', id: f.id, fromCity: g.key })}>
                <i style={{ background: STAGE_COLOR[f.stage] }} />
                <b>{f.name}</b>
                <span>{f.stage}</span>
                <small>{f.products.join('、')}，{f.owner}{f.scale ? `，${fmt(f.scale)} 万元` : ''}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <Drawer open={!!target} onClose={onClose} title={title} width={480} destroyOnClose>
      {body}
    </Drawer>
  )
}
