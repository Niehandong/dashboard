import type { CompanyData } from './types'

// 公司数据的接口地址。现在指向清洗脚本生成的静态文件（npm run data）；
// 对接真实接口时，在 .env 里把 VITE_COMPANIES_URL 改成接口地址即可。
// 如果真实接口返回的格式不同，只在下面的 fetchCompanies 里做转换，其它代码不用动。
const COMPANIES_URL: string = import.meta.env.VITE_COMPANIES_URL || '/mock/companies.json'

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-cache' }) // 每次都向服务器确认，数据文件换了能马上看到
  if (!r.ok) throw new Error(`请求 ${url} 失败（HTTP ${r.status}）`)
  return r.json() as Promise<T>
}

export async function fetchCompanies(): Promise<CompanyData> {
  const data = await get<CompanyData>(COMPANIES_URL)
  if (!Array.isArray(data?.companies) || !Array.isArray(data?.stages)) throw new Error(`${COMPANIES_URL} 返回的数据格式不对`)
  return data
}
