import { useEffect, useState } from 'react'
import { Alert, Button, ConfigProvider, Spin, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { useGroupData } from './useGroupData'
import DashboardView from './views/DashboardView'
// 字体和样式跟着 demo1 一起加载，不影响其它 demo
import '@fontsource/barlow-condensed/500.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/noto-serif-sc/900.css'
import './index.css'

export default function App() {
  const { view, error, load, groups, group, pickGroup } = useGroupData()
  // 主题：浅色（照 demo2 的白底风格，默认）/ 深色（原来的作战沙盘）。记在浏览器里，下次打开还是这个
  const [light, setLight] = useState(() => { try { return localStorage.getItem('demo1-theme') !== 'dark' } catch { return true } })
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = light ? 'light' : 'dark'
    try { localStorage.setItem('demo1-theme', light ? 'light' : 'dark') } catch { /* 无痕模式等存不了，忽略 */ }
    return () => { delete root.dataset.theme }
  }, [light])

  let content
  if (!view && error) {
    content = (
      <div className="state">
        <Alert type="error" showIcon message="看板数据加载失败" description={`${error}。请确认数据文件已生成（在 frontend 目录执行 npm run data）或接口地址配置正确。`}
          action={<Button onClick={load}>重新加载</Button>} />
      </div>
    )
  } else if (!view) {
    content = <div className="state"><Spin size="large" /></div>
  } else {
    // key：切换集团时整块重建，地图回到全球、范围和筛选清零
    content = <DashboardView key={group} data={view} groups={groups} group={group} onGroup={pickGroup} light={light} onTheme={() => setLight(v => !v)} />
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: light ? theme.defaultAlgorithm : theme.darkAlgorithm,
        token: light
          ? { colorPrimary: '#F26B1D', borderRadius: 6, fontFamily: 'var(--sans)' }
          : { colorPrimary: '#FF7A2E', borderRadius: 4, fontFamily: 'var(--sans)', colorBgElevated: '#0D2038' },
      }}
    >
      {content}
    </ConfigProvider>
  )
}
