import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Breadcrumb, Button, ConfigProvider, Descriptions, Drawer, Layout, Menu, Select, Spin, theme } from 'antd'
import { AimOutlined, AppstoreOutlined, DashboardOutlined, GlobalOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import zhCN from 'antd/locale/zh_CN'
import '@fontsource/barlow-condensed/600.css' // 地图标牌上的数字
import './demo3.css'
import { useGroupData } from '../useGroupData'
import type { Company, CompanyData } from '../types'
import { fmt } from '../utils'
import { shortName } from '../demo2/derive'
import { AreasPage, CompaniesPage, OverviewPage, PlanPage, ProductsPage, ProjectsPage, StageTag, type PageProps } from './pages'

// 左侧目录。有 children 的是可以展开 / 折叠的分组；page 是右边显示的内容
const MENU = [
  { key: 'overview', label: '总览', icon: <DashboardOutlined /> },
  { key: 'g-layout', label: '集团布局', icon: <GlobalOutlined />, children: [
    { key: 'areas', label: '布局概览' },
    { key: 'companies', label: '子公司清单' },
  ] },
  { key: 'g-battle', label: '作战计划', icon: <AimOutlined />, children: [
    { key: 'plan', label: '各工厂作战计划' },
    { key: 'projects', label: '关键项目推进' },
  ] },
  { key: 'products', label: '产品布局', icon: <AppstoreOutlined /> },
]
const PAGES: Record<string, (p: PageProps) => JSX.Element> = {
  overview: OverviewPage, areas: AreasPage, companies: CompaniesPage, plan: PlanPage, projects: ProjectsPage, products: ProductsPage,
}
// 页面 → [分组名, 页面名]，面包屑和展开目录用
const TRAIL: Record<string, { group?: { key: string; label: string }; label: string }> = {}
for (const m of MENU) {
  if (m.children) for (const c of m.children) TRAIL[c.key] = { group: { key: m.key, label: m.label }, label: c.label }
  else TRAIL[m.key] = { label: m.label }
}

// 当前页面记在地址的 # 后面（如 /demo3#/plan），刷新或把链接发给别人都还是这一页
const readPage = () => { const k = location.hash.replace(/^#\/?/, ''); return PAGES[k] ? k : 'overview' }
const FOLD_KEY = 'war-map-demo3-fold'
const savedFold = () => { try { return localStorage.getItem(FOLD_KEY) === '1' } catch { return false } }

function Shell({ data, groups, group, onGroup }: { data: CompanyData; groups: string[]; group: string; onGroup: (g: string) => void }) {
  const [page, setPage] = useState(readPage)
  const [fold, setFold] = useState(savedFold)
  const [open, setOpen] = useState<string[]>(() => MENU.filter(m => m.children).map(m => m.key)) // 分组默认都展开
  const [detail, setDetail] = useState<Company | null>(null)
  useEffect(() => {
    const on = () => setPage(readPage())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((k: string) => { location.hash = `/${k}` }, [])
  const toggleFold = () => setFold(f => { try { localStorage.setItem(FOLD_KEY, f ? '0' : '1') } catch { /* 存不了就算了 */ } return !f })
  const openCompany = useCallback((id: string) => setDetail(data.companies.find(c => c.id === id) ?? null), [data.companies])
  const props = useMemo<PageProps>(() => ({ data, go, onCompany: openCompany }), [data, go, openCompany])
  const Page = PAGES[page], trail = TRAIL[page]

  return (
    <Layout className="d3">
      <Layout.Sider className="d3-side" width={232} collapsedWidth={64} collapsed={fold} trigger={null}>
        <div className="d3-brand" title="集团作战地图">{fold ? '作战' : '集团作战地图'}</div>
        <Menu
          mode="inline" theme="dark" items={MENU} selectedKeys={[page]}
          {...(fold ? {} : { openKeys: open, onOpenChange: setOpen })}
          onClick={e => go(e.key)}
        />
        <button className="d3-fold" onClick={toggleFold} aria-label={fold ? '展开目录' : '收起目录'}>
          {fold ? <MenuUnfoldOutlined /> : <><MenuFoldOutlined /><span>收起目录</span></>}
        </button>
      </Layout.Sider>
      <Layout className="d3-main">
        <header className="d3-head">
          <Breadcrumb items={[...(trail.group ? [{ title: trail.group.label }] : []), { title: trail.label }]} />
          <div className="d3-head-r">
            <span>数据日期 {data.updatedAt}</span>
            {groups.length > 1 && (
              <Select aria-label="切换集团" value={group} onChange={onGroup} popupMatchSelectWidth={false} style={{ minWidth: 150 }}
                showSearch={groups.length > 8} optionFilterProp="label"
                options={groups.map(g => ({ value: g, label: shortName(g), title: g }))} />
            )}
          </div>
        </header>
        <main className="d3-content">
          <h1>{trail.label}</h1>
          <Page {...props} />
        </main>
      </Layout>
      <Drawer open={!!detail} onClose={() => setDetail(null)} width={480} title={detail?.name}>
        {detail && (
          <Descriptions column={1} size="middle" labelStyle={{ width: 96 }} items={[
            { key: 's', label: '当前阶段', children: <StageTag s={detail.stage} /> },
            { key: 'g', label: '所属集团', children: detail.group },
            { key: 'l', label: '所在地', children: [detail.country, detail.province, detail.city].filter(Boolean).join(' ') },
            { key: 'p', label: '目标产品', children: detail.products.join('、') },
            { key: 'o', label: '负责人', children: detail.owner || '—' },
            { key: 'n', label: '下一步行动', children: detail.next || '—' },
            { key: 'c', label: '预计规模', children: `${fmt(detail.scale)} 万元` },
            { key: 'a', label: '注册地址', children: detail.address || '—' },
            ...(detail.website ? [{ key: 'w', label: '网址', children: <a href={detail.website} target="_blank" rel="noreferrer">{detail.website}</a> }] : []),
          ]} />
        )}
      </Drawer>
    </Layout>
  )
}

export default function Demo3() {
  const { view, error, load, groups, group, pickGroup } = useGroupData()
  let content
  if (!view && error) {
    content = (
      <div className="d3-state">
        <Alert type="error" showIcon message="数据加载失败" description={`${error}。请确认数据文件已生成（在 frontend 目录执行 npm run data）或接口地址配置正确。`}
          action={<Button onClick={load}>重新加载</Button>} />
      </div>
    )
  } else if (!view) content = <div className="d3-state"><Spin size="large" /></div>
  else content = <Shell key={group} data={view} groups={groups} group={group} onGroup={pickGroup} />
  return (
    <ConfigProvider locale={zhCN} theme={{
      algorithm: theme.darkAlgorithm,
      token: { colorPrimary: '#3D8BD9', borderRadius: 4, colorBgBase: '#071425', colorBgContainer: '#0C1E36', colorBgElevated: '#0F2743', colorBgLayout: '#071425', colorBorderSecondary: '#1D3554' },
      components: { Layout: { siderBg: '#091A30' }, Menu: { darkItemBg: '#091A30', darkSubMenuItemBg: '#071425', darkItemSelectedBg: '#1C5490' }, Table: { headerBg: '#10294A', rowHoverBg: '#143560' } },
    }}>
      {content}
    </ConfigProvider>
  )
}
