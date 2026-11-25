import { StrictMode, Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { createRoot } from 'react-dom/client'

// 每个 demo 一个地址，各自的代码和样式分开加载，互不影响。
// 新增一个 demo：在这里加一行，指向它自己的入口组件。
const DEMOS: { path: string; title: string; note: string; page: LazyExoticComponent<ComponentType> }[] = [
  { path: '/demo1', title: 'Demo 1', note: '地图为主：可以逐级放大，看子公司分布和合作情况（浅色 / 深色两种风格可切换）', page: lazy(() => import('./App')) },
  { path: '/demo2', title: 'Demo 2', note: '照作战地图复刻的一屏四块：布局概览（可缩放到城市）、作战计划、产品布局、项目推进', page: lazy(() => import('./demo2/Demo2')) },
  { path: '/demo3', title: 'Demo 3', note: '左侧目录 + 右侧内容：每块一页，表格可以搜索、筛选、翻页', page: lazy(() => import('./demo3/Demo3')) },
  { path: '/demo4', title: 'Demo 4', note: '照「客户全景档案.png」一比一复刻的三栏 KA Dashboard：客户全景档案、集团作战地图、年度经营计划', page: lazy(() => import('./demo4/Demo4')) },
]

const path = location.pathname.replace(/\/+$/, '') || '/'
const demo = DEMOS.find(d => d.path === path)

// 首页（以及写错的地址）：列出所有 demo，点进去看
function Home() {
  return (
    <div style={{ minHeight: '100vh', background: '#0b1420', color: '#dbe7f3', fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif', padding: '12vh 24px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, margin: '0 0 8px' }}>集团作战地图</h1>
        <p style={{ margin: '0 0 28px', color: '#8ea3b8' }}>{path === '/' ? '选择一个方案查看' : `没有 ${path} 这个页面，可以看下面这些`}</p>
        {DEMOS.map(d => (
          <a key={d.path} href={d.path} style={{ display: 'block', padding: '18px 20px', marginBottom: 12, border: '1px solid #2a4460', borderRadius: 6, background: '#111e2e', color: 'inherit', textDecoration: 'none' }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{d.title}</div>
            <div style={{ marginTop: 4, color: '#8ea3b8' }}>{d.note} <span style={{ color: '#5fd4e6', marginLeft: 8 }}>{d.path}</span></div>
          </a>
        ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {demo ? <Suspense fallback={null}><demo.page /></Suspense> : <Home />}
  </StrictMode>,
)
