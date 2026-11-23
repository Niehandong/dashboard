// 造一个集团的模拟子公司表（demo 用，数据全部是编的），格式和 data/KA集团子公司_补充模拟数据.xlsx 一样。
// 用法：node scripts/mock-group.mjs            生成 data/KA集团子公司_模拟_徐工集团.xlsx
// 每次生成的内容相同（固定随机种子）。要换集团名、数量、产品，改下面的 GROUP 配置后重新运行，再执行 npm run data。
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { locate, locateOverseas } from './geo/locate.mjs'

const require = createRequire(import.meta.url)
const { cities } = require('./geo/cities.json') // [省, 市, 经度, 纬度]
const overseas = require('./geo/overseas.json') // [地名, 国家, 城市, 经度, 纬度]

const GROUP = {
  name: '徐工集团有限公司', brand: '徐工', file: 'KA集团子公司_模拟_徐工集团.xlsx', seed: 20261123,
  domestic: 300, overseas: 14,
  home: ['江苏', '徐州'], // 总部所在地：子公司最集中，合作也推进得最深
  products: [['激光切割设备', 30], ['激光焊接设备', 24], ['激光器', 20], ['激光熔覆设备', 12], ['光连接', 8], ['PCD微钻', 6]],
}
const BIZ = ['工程机械', '重型机械', '挖掘机械', '起重机械', '道路机械', '矿业机械', '液压件', '传动件', '铸造', '结构件', '环境技术', '消防安全装备',
  '汽车制造', '新能源动力', '智能装备', '机械租赁', '设备服务', '再制造', '精密工业', '电气系统', '特种车辆', '基础工程机械', '港口机械', '农业机械', '施工机械']
const ROADS = ['工业大道', '科技路', '创业路', '振兴路', '机械路', '高新大道', '经开大道', '滨河路', '建设路', '长江路']
const OWNERS = ['张三', '李四', '王五', '赵六', '陈七', '孙八', '周九', '吴十']
const NEXT = {
  未合作: ['暂无接触，纳入下季度拜访名单', '待集团层面合作推进后再跟进', '通过集团总部引荐对接设备部'],
  规划中: ['收集联系人信息，安排首次拜访', '梳理客户产线工艺，确定切入点'],
  商机开发: ['确认采购预算与决策链', '安排样件打样与工艺验证'],
  已合作: ['推进第二条产线导入', '季度回访，跟进复购需求', '安排售后巡检与操作培训', '收集设备使用反馈，准备年度框架协议'],
}
const SCALE = { 未合作: [0, 150], 规划中: [50, 300], 商机开发: [80, 400], 已合作: [200, 800] }

// 固定种子的随机数（mulberry32）
let seed = GROUP.seed
const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = list => list[Math.floor(rnd() * list.length)]
const weighted = pairs => { let r = rnd() * pairs.reduce((s, p) => s + p[1], 0); for (const [v, w] of pairs) if ((r -= w) < 0) return v; return pairs[0][0] }
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d
// 阶段：总部所在城市 > 所在省 > 其它地方，越近合作越深
const stageOf = near => weighted(near === 2 ? [['已合作', 26], ['商机开发', 24], ['规划中', 24], ['未合作', 26]]
  : near === 1 ? [['已合作', 14], ['商机开发', 20], ['规划中', 24], ['未合作', 42]]
    : [['已合作', 7], ['商机开发', 13], ['规划中', 20], ['未合作', 60]])

const HEADER = ['(不要修改) KA集团子公司', '名称', '所属集团', '负责人', '当前阶段', '目标产品', '下一步行动', '预计规模（万元）', '注册地址', '网址', '经度', '纬度']
const rows = [], names = new Set()
const add = (name, stage, address, lng, lat) => {
  if (names.has(name)) return false
  names.add(name)
  const [lo, hi] = SCALE[stage]
  rows.push([null, name, GROUP.name, pick(OWNERS), stage, weighted(GROUP.products), pick(NEXT[stage]), Math.round((lo + rnd() * (hi - lo)) / 10) * 10, address, null, lng, lat])
  return true
}

const [hp, hc] = GROUP.home
const inProvince = cities.filter(c => c[0] === hp), homeCity = cities.find(c => c[0] === hp && c[1] === hc)
while (rows.length < GROUP.domestic) {
  const r = rnd()
  const [province, city, lng, lat] = r < 0.22 ? homeCity : r < 0.38 ? pick(inProvince) : pick(cities)
  const address = `${province === city ? '' : province}${city}市${pick(ROADS)}${1 + Math.floor(rnd() * 300)}号`
  const loc = locate(address)
  if (!loc || loc.province !== province || loc.city !== city) continue // 清洗脚本认不出的地址不要
  const near = city === hc && province === hp ? 2 : province === hp ? 1 : 0
  add(`${GROUP.brand}${city}${pick(BIZ)}有限公司`, stageOf(near), address, round(lng + (rnd() - 0.5) * 0.24, 3), round(lat + (rnd() - 0.5) * 0.2, 3))
}
for (let n = 0, guard = 0; n < GROUP.overseas && guard < 500; guard++) {
  const [place, country, , lng, lat] = pick(overseas)
  const address = `${country}${place}${pick(ROADS)}${1 + Math.floor(rnd() * 99)}号`
  if (locateOverseas(address)?.country !== country) continue
  if (add(`${GROUP.brand}${place}${pick(['制造', '销售服务', '工程机械'])}有限公司`, stageOf(0), address, round(lng + (rnd() - 0.5) * 0.1, 3), round(lat + (rnd() - 0.5) * 0.1, 3))) n++
}

const XLSX = await import('xlsx')
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADER, ...rows]), 'KA集团子公司')
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['说明'], ['本表全部为模拟数据（公司名称、地址、阶段、产品、规模都是编的），由 frontend/scripts/mock-group.mjs 生成，仅用于演示切换集团。']]), '补充说明')
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../data', GROUP.file)
writeFileSync(out, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
console.log(`已生成 ${rows.length} 家（${GROUP.name}）：${out}`)
