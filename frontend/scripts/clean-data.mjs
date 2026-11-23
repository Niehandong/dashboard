// 清洗 CRM 导出的「KA集团子公司」Excel，生成前端读取的 public/mock/companies.json。
// 用法：npm run data [-- <xlsx路径>]   默认读 ../data/KA集团子公司_补充模拟数据.xlsx
//
// 规则：
//   - 按表头名称取列（列的顺序变了也不影响）；必须有「名称」「注册地址」两列。
//   - 同名公司只保留第一行（原表有重复导入的记录）。
//   - 从注册地址识别国家/省/市（识别不出时再看公司名）；仍识别不出的行跳过并列出。
//   - 经纬度用表里的值，表里没有时用城市中心坐标。
//   - 阶段不在 4 个选项内的按「未合作」；预计规模取整，空或非数字为 0。
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REGION, locate, locateOverseas } from './geo/locate.mjs'

/** CRM「当前阶段」选项，按推进顺序 */
export const STAGES = ['未合作', '规划中', '商机开发', '已合作']
// 目标产品为空或「不适用」的公司（补充模拟数据时留下的占位），按公司名固定分到这几种产品里：
// 同一家公司每次清洗得到的产品都一样
export const PRODUCTS = ['激光设备', '激光器', '光连接', 'PCD微钻']
// 海外国家所属的大区（看板上的大区按钮和范围按它来）。「亚洲」指中国和东南亚以外的亚洲国家；表里没有的国家归「海外」
export const AREA = {
  美国: '北美', 墨西哥: '北美', 加拿大: '北美',
  巴西: '南美', 智利: '南美', 阿根廷: '南美',
  德国: '欧洲', 俄罗斯: '欧洲', 法国: '欧洲', 英国: '欧洲', 意大利: '欧洲', 西班牙: '欧洲', 波兰: '欧洲',
  印度尼西亚: '东南亚', 马来西亚: '东南亚', 泰国: '东南亚', 越南: '东南亚', 新加坡: '东南亚', 菲律宾: '东南亚',
  印度: '亚洲', 哈萨克斯坦: '亚洲', 土耳其: '亚洲', 沙特阿拉伯: '亚洲', 阿联酋: '亚洲', 日本: '亚洲', 韩国: '亚洲',
  南非: '非洲', 埃及: '非洲',
  澳大利亚: '大洋洲', 新西兰: '大洋洲',
}
const mockProduct = name => PRODUCTS[createHash('md5').update(name).digest().readUInt32BE(0) % PRODUCTS.length]

const COLUMNS = {
  id: '(不要修改) KA集团子公司', name: '名称', group: '所属集团', owner: '负责人', stage: '当前阶段',
  product: '目标产品', next: '下一步行动', scale: '预计规模（万元）', address: '注册地址', website: '网址',
  lng: '经度', lat: '纬度',
}
const REQUIRED = ['name', 'address']

const text = v => String(v ?? '').trim()
const isNum = v => typeof v === 'number' && Number.isFinite(v)

function toCompany(name, get) {
  const address = text(get('address'))
  const abroad = locateOverseas(address)
  const loc = abroad ?? locate(address, name)
  if (!loc) return null
  const [lng, lat] = [get('lng'), get('lat')]
  const stage = text(get('stage'))
  const scale = Math.round(Number(get('scale')))
  return {
    id: text(get('id')) || 'X-' + createHash('md5').update(name).digest('hex').slice(0, 10),
    name,
    group: text(get('group')),
    country: abroad ? abroad.country : '中国',
    province: abroad ? '' : loc.province,
    city: loc.city,
    region: abroad ? AREA[abroad.country] ?? '海外' : REGION[loc.province],
    stage: STAGES.includes(stage) ? stage : '未合作',
    product: ['', '不适用'].includes(text(get('product'))) ? mockProduct(name) : text(get('product')),
    owner: text(get('owner')),
    next: text(get('next')),
    scale: Number.isFinite(scale) ? scale : 0,
    address,
    website: text(get('website')),
    coord: isNum(lng) && isNum(lat) ? [lng, lat] : [loc.lng, loc.lat],
  }
}

/**
 * @param {unknown[]} header 表头行
 * @param {unknown[][]} rows 数据行
 * @returns {{companies: object[], skipped: string[]}} skipped 为识别不出地址而跳过的公司名
 */
export function cleanRows(header, rows) {
  const names = header.map(text)
  const col = Object.fromEntries(Object.entries(COLUMNS).map(([k, v]) => [k, names.indexOf(v)]))
  const missing = REQUIRED.filter(k => col[k] < 0).map(k => COLUMNS[k])
  if (missing.length) throw new Error(`缺少列：${missing.join('、')}`)

  const companies = [], skipped = [], seen = new Set()
  for (const r of rows) {
    const get = k => (col[k] >= 0 ? r[col[k]] : undefined)
    const name = text(get('name'))
    if (!name || seen.has(name)) continue
    seen.add(name)
    const c = toCompany(name, get)
    if (c) companies.push(c)
    else skipped.push(name)
  }
  return { companies, skipped }
}

// 读第一个工作表，返回二维数组（第一行是表头，空单元格为 null）
async function readSheet(file) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(readFileSync(file), { sheets: 0 })
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null })
}

const localDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

async function main() {
  const here = dirname(fileURLToPath(import.meta.url))
  // 不指定文件时，读 data 目录下所有「KA集团子公司_*.xlsx」（每个集团一个文件）
  const dataDir = resolve(here, '../../data')
  const inputs = process.argv.length > 2 ? process.argv.slice(2).map(f => resolve(f))
    : readdirSync(dataDir).filter(f => /^KA集团子公司_.*\.xlsx$/.test(f)).sort().map(f => resolve(dataDir, f))
  if (!inputs.length) throw new Error(`没有找到数据文件：${dataDir}/KA集团子公司_*.xlsx`)
  const output = resolve(here, '../public/mock/companies.json')

  const companies = [], ids = new Set()
  let updated = 0
  for (const input of inputs) {
    const [header, ...rows] = await readSheet(input)
    if (!header) throw new Error(`表格是空的：${input}`)
    const r = cleanRows(header, rows)
    const fresh = r.companies.filter(c => !ids.has(c.id) && ids.add(c.id)) // 不同文件里重复的公司只留第一次出现的
    companies.push(...fresh)
    updated = Math.max(updated, statSync(input).mtimeMs)
    const abroad = fresh.filter(c => c.country !== '中国').length
    console.log(`${basename(input)}：读取 ${rows.length} 行 → ${fresh.length} 家公司（国内 ${fresh.length - abroad}，海外 ${abroad}）`)
    if (r.skipped.length) console.warn(`有 ${r.skipped.length} 家识别不出地址，已跳过：\n  ${r.skipped.join('\n  ')}`)
  }

  const data = { updatedAt: localDate(new Date(updated)), stages: STAGES, companies }
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, JSON.stringify(data) + '\n')
  console.log(`共 ${companies.length} 家，已写入 ${output}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(`清洗失败：${e.message}`); process.exit(1) })
}
