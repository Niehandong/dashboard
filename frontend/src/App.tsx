import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, ConfigProvider, Spin, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { fetchCompanies } from './api'
import type { CompanyData } from './types'
import DashboardView from './views/DashboardView'

const REFRESH_MS = 60_000
// 上次看的集团记在浏览器里，刷新页面后还是它
const GROUP_KEY = 'war-map-group'
const savedGroup = () => { try { return localStorage.getItem(GROUP_KEY) } catch { return null } }

export default function App() {
  const [data, setData] = useState<CompanyData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(savedGroup)
  // 接口里出现的集团（公司多的在前）。一次只看一个集团
  const groups = useMemo(() => {
    const n = new Map<string, number>()
    for (const c of data?.companies ?? []) n.set(c.group, (n.get(c.group) ?? 0) + 1)
    return [...n].sort((a, b) => b[1] - a[1]).map(x => x[0])
  }, [data])
  const group = picked != null && groups.includes(picked) ? picked : groups[0] ?? ''
  const view = useMemo(() => data && { ...data, companies: data.companies.filter(c => c.group === group) }, [data, group])
  const pickGroup = useCallback((g: string) => { setPicked(g); try { localStorage.setItem(GROUP_KEY, g) } catch { /* 存不了就算了 */ } }, [])

  const load = useCallback(() => {
    fetchCompanies()
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(String(e.message ?? e)))
  }, [])

  // 首次加载 + 定时刷新（刷新失败时保留上一次的数据）
  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  let content
  if (!data && error) {
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
    content = <DashboardView key={group} data={view} groups={groups} group={group} onGroup={pickGroup} />
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: { colorPrimary: '#FF7A2E', borderRadius: 4, fontFamily: 'var(--sans)', colorBgElevated: '#0D2038' },
      }}
    >
      {content}
    </ConfigProvider>
  )
}
