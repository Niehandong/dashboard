import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCompanies } from './api'
import type { CompanyData } from './types'

const REFRESH_MS = 60_000
// 上次看的集团记在浏览器里，刷新页面后还是它（各 demo 共用）
const GROUP_KEY = 'war-map-group'
const savedGroup = () => { try { return localStorage.getItem(GROUP_KEY) } catch { return null } }

// 各 demo 共用的取数：请求公司数据、每 60 秒刷新、按集团切换。view 是当前集团的数据
export function useGroupData() {
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

  return { view, error, load, groups, group, pickGroup }
}
