import { useMemo, useState } from 'react'
import { Card, Col, Input, Row, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Company, CompanyData } from '../types'
import { STAGE_COLOR, fmt } from '../utils'
import { areaOf, areaOverview, keyCompanies, mockProjects, productLayout, shortName, PROJECT_STAGES, type Area, type ProductRow, type ProjectRow } from '../demo2/derive'
import OverviewMap from '../demo2/OverviewMap'

export interface PageProps {
  data: CompanyData // 当前集团的数据
  go: (page: string) => void // 跳到目录里的另一页
  onCompany: (id: string) => void // 打开公司详情
}

export const StageTag = ({ s }: { s: string }) => <Tag color={STAGE_COLOR[s] ?? '#6B7C95'} style={{ marginInlineEnd: 0 }}>{s}</Tag>
const rate = (done: number, total: number) => (total ? `${(done / total * 100).toFixed(1)}%` : '—')
const place = (c: Company) => (c.country === '中国' ? `${c.province} ${c.city}` : `${c.country} ${c.city}`)
const uniq = (xs: string[]) => [...new Set(xs)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh'))

function Split({ done, talking, todo }: { done: number; talking: number; todo: number }) {
  return (
    <div className="d3-split" title={`已合作 ${done}，在谈 ${talking}，未合作 ${todo}`}>
      <i style={{ flexGrow: done, background: STAGE_COLOR['已合作'] }} />
      <i style={{ flexGrow: talking, background: STAGE_COLOR['商机开发'] }} />
      <i style={{ flexGrow: todo, background: '#2A3F5C' }} />
    </div>
  )
}

// 公司表：按名称搜索，阶段 / 产品 / 负责人可筛选，规模可排序，点一行看详情
function CompanyTable({ list, stages, onCompany, pageSize = 12 }: { list: Company[]; stages: string[]; onCompany: (id: string) => void; pageSize?: number }) {
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const k = q.trim()
    return [...(k ? list.filter(c => c.name.includes(k) || place(c).includes(k)) : list)]
      .sort((a, b) => stages.indexOf(b.stage) - stages.indexOf(a.stage) || b.scale - a.scale)
  }, [list, q, stages])
  const columns: ColumnsType<Company> = [
    { title: '子公司', dataIndex: 'name', ellipsis: true, render: (n: string) => <b>{shortName(n)}</b> },
    { title: '所在地', key: 'place', width: 150, ellipsis: true, render: (_, c) => place(c) },
    { title: '目标产品', key: 'products', width: 190, ellipsis: true, render: (_, c) => c.products.join('、'),
      filters: uniq(list.flatMap(c => c.products)).map(p => ({ text: p, value: p })), onFilter: (v, c) => c.products.includes(v as string) },
    { title: '当前阶段', dataIndex: 'stage', width: 110, render: (s: string) => <StageTag s={s} />,
      filters: [...stages].reverse().map(s => ({ text: s, value: s })), onFilter: (v, c) => c.stage === v },
    { title: '负责人', dataIndex: 'owner', width: 96,
      filters: uniq(list.map(c => c.owner)).map(o => ({ text: o, value: o })), onFilter: (v, c) => c.owner === v },
    { title: '下一步行动', dataIndex: 'next', ellipsis: true },
    { title: '预计规模（万元）', dataIndex: 'scale', width: 150, align: 'right', render: (n: number) => fmt(n), sorter: (a, b) => a.scale - b.scale },
  ]
  return (
    <>
      <Input.Search className="d3-search" allowClear placeholder="按公司名或所在地搜索" value={q} onChange={e => setQ(e.target.value)} />
      <Table<Company> rowKey="id" size="middle" columns={columns} dataSource={rows}
        pagination={{ pageSize, showSizeChanger: false, showTotal: n => `共 ${n} 家` }}
        onRow={c => ({ onClick: () => onCompany(c.id), tabIndex: 0, onKeyDown: e => { if (e.key === 'Enter') onCompany(c.id) } })}
        rowClassName="d3-click" locale={{ emptyText: q ? `没有找到「${q}」` : '没有公司' }} />
    </>
  )
}

function Kpis({ list }: { list: Company[] }) {
  const done = list.filter(c => c.stage === '已合作').length, todo = list.filter(c => c.stage === '未合作').length
  const items = [['子公司', fmt(list.length)], ['已合作', fmt(done)], ['在谈', fmt(list.length - done - todo)], ['未合作', fmt(todo)], ['合作率', rate(done, list.length)]]
  return <div className="d3-kpis">{items.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
}

const areaColumns: ColumnsType<Area> = [
  { title: '地区', dataIndex: 'name', render: (n: string) => <b>{n}</b> },
  { title: '国家', key: 'n', align: 'right', render: (_, a) => a.countries.length },
  { title: '子公司', dataIndex: 'total', align: 'right', render: fmt },
  { title: '已合作', dataIndex: 'done', align: 'right' },
  { title: '在谈', dataIndex: 'talking', align: 'right' },
  { title: '合作率', key: 'r', align: 'right', render: (_, a) => rate(a.done, a.total) },
  { title: '走得最远', dataIndex: 'top', render: (s: string) => <StageTag s={s} /> },
]
const productColumns: ColumnsType<ProductRow> = [
  { title: '产品', dataIndex: 'name', render: (n: string) => <b>{n}</b> },
  { title: '涉及子公司', dataIndex: 'total', align: 'right', width: 110, render: fmt },
  { title: '已合作', dataIndex: 'done', align: 'right', width: 80 },
  { title: '在谈', dataIndex: 'talking', align: 'right', width: 80 },
  { title: '未合作', dataIndex: 'todo', align: 'right', width: 80 },
  { title: '合作率', key: 'r', align: 'right', width: 90, render: (_, p) => rate(p.done, p.total) },
  { title: '占比', key: 'bar', width: 200, render: (_, p) => <Split {...p} /> },
  { title: '重点子公司', key: 'focus', ellipsis: true, render: (_, p) => p.focus.join('、') || '—' },
]

export function OverviewPage({ data, go }: PageProps) {
  const { companies, stages } = data
  const areas = useMemo(() => areaOverview(companies, stages), [companies, stages])
  const prods = useMemo(() => productLayout(companies, stages), [companies, stages])
  return (
    <>
      <Kpis list={companies} />
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="集团布局" extra={<a onClick={() => go('areas')}>查看布局概览</a>}>
            <div className="d3-map"><OverviewMap areas={areas} picked={null} onPick={() => go('areas')} /></div>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="合作阶段">
            <ul className="d3-stages">
              {[...stages].reverse().map(s => {
                const n = companies.filter(c => c.stage === s).length
                return <li key={s}><span>{s}</span><i><em style={{ width: `${n / Math.max(companies.length, 1) * 100}%`, background: STAGE_COLOR[s] }} /></i><b>{fmt(n)}</b></li>
              })}
            </ul>
          </Card>
          <Card title="产品布局" extra={<a onClick={() => go('products')}>查看全部</a>} style={{ marginTop: 16 }}>
            <Table<ProductRow> rowKey="name" size="small" pagination={false} dataSource={prods} columns={productColumns.filter(c => ['产品', '涉及子公司', '已合作', '合作率'].includes(c.title as string))} />
          </Card>
        </Col>
      </Row>
    </>
  )
}

export function AreasPage({ data, onCompany }: PageProps) {
  const { companies, stages } = data
  const [area, setArea] = useState<string | null>(null)
  const areas = useMemo(() => areaOverview(companies, stages), [companies, stages])
  const list = useMemo(() => companies.filter(c => !area || areaOf(c) === area), [companies, area])
  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card title="地图" extra="点地区标记，下面只列这个地区的公司">
            <div className="d3-map"><OverviewMap areas={areas} picked={area} onPick={setArea} /></div>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="各地区合作情况">
            <Table<Area> rowKey="name" size="small" pagination={false} dataSource={areas} columns={areaColumns}
              rowClassName={a => `d3-click${a.name === area ? ' d3-on' : ''}`}
              onRow={a => ({ onClick: () => setArea(a.name === area ? null : a.name) })} />
          </Card>
        </Col>
      </Row>
      <Card title={area ? `${area}的子公司` : '全部子公司'} extra={area && <a onClick={() => setArea(null)}>看全部地区</a>} style={{ marginTop: 16 }}>
        <CompanyTable key={area ?? ''} list={list} stages={stages} onCompany={onCompany} pageSize={8} />
      </Card>
    </>
  )
}

export function CompaniesPage({ data, onCompany }: PageProps) {
  return <Card><CompanyTable list={data.companies} stages={data.stages} onCompany={onCompany} /></Card>
}

export function PlanPage({ data, onCompany }: PageProps) {
  const list = useMemo(() => data.companies.filter(c => c.stage !== '未合作'), [data.companies])
  return (
    <>
      <p className="d3-lead">在推进的子公司（规划中、商机开发、已合作），走得远的排在前面，同一阶段按预计规模从大到小。</p>
      <Kpis list={list} />
      <Card><CompanyTable list={list} stages={data.stages} onCompany={onCompany} /></Card>
    </>
  )
}

export function ProjectsPage({ data, onCompany }: PageProps) {
  const rows = useMemo(() => mockProjects(keyCompanies(data.companies, data.stages, 24), data.updatedAt, 24), [data])
  const columns: ColumnsType<ProjectRow> = [
    { title: '项目编号', dataIndex: 'code', width: 130 },
    { title: '项目名称', dataIndex: 'name', ellipsis: true, render: (n: string) => <b>{n}</b> },
    { title: '工厂 / 子公司', dataIndex: 'company', ellipsis: true },
    { title: '阶段', dataIndex: 'stage', width: 220, filters: PROJECT_STAGES.map(s => ({ text: s, value: s })), onFilter: (v, p) => p.stage === v,
      render: (s: string) => <><span className="d3-steps">{PROJECT_STAGES.map((x, i) => <i key={x} className={i <= PROJECT_STAGES.indexOf(s) ? 'on' : ''} />)}</span>{s}</> },
    { title: '负责人', dataIndex: 'owner', width: 100 },
    { title: '计划完成', dataIndex: 'due', width: 110, align: 'right' },
  ]
  return (
    <>
      <p className="d3-lead"><Tag color="gold">示例数据</Tag>现有数据里没有项目，这一页的项目是按重点子公司编出来的，用来看版面。</p>
      <Card>
        <Table<ProjectRow> rowKey="code" size="middle" columns={columns} dataSource={rows} rowClassName="d3-click"
          pagination={{ pageSize: 12, showSizeChanger: false, showTotal: n => `共 ${n} 个项目` }}
          onRow={p => ({ onClick: () => onCompany(p.id) })} />
      </Card>
    </>
  )
}

export function ProductsPage({ data, onCompany }: PageProps) {
  const { companies, stages } = data
  const rows = useMemo(() => productLayout(companies, stages), [companies, stages])
  return (
    <>
      <p className="d3-lead">一家公司有多个目标产品时，在每个产品里各算一次。点一行前面的加号，展开这个产品涉及的子公司。</p>
      <Card>
        <Table<ProductRow> rowKey="name" size="middle" pagination={false} columns={productColumns} dataSource={rows}
          expandable={{ expandRowByClick: true, expandedRowRender: p => (
            <CompanyTable list={companies.filter(c => c.products.includes(p.name))} stages={stages} onCompany={onCompany} pageSize={6} />
          ) }} rowClassName="d3-click" />
      </Card>
    </>
  )
}
