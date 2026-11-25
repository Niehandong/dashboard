// demo2 的数据：照抄 data/作战地图.jpg 里的内容。
// 图片地图上标的是 中国 4 个、东南亚 2 个、欧洲 1 个、北美 1 个工厂，表格只列了 5 个（后面是"…"），
// 武汉、成都、泰国三个工厂是为了和地图数量对上补的；图片没写城市的（越南/欧洲/北美）也由这里指定。

export type Coord = [number, number]

// 工厂状态（颜色照图片表格里的阶段标签）
export const STAGES = ['已合作', '技术验证', '商机开发', '初步接洽', '规划中'] as const
export const STAGE_STYLE: Record<string, { color: string; bg: string }> = {
  已合作: { color: '#239A55', bg: '#DFF5E6' },
  技术验证: { color: '#2F6BD8', bg: '#E1ECFC' },
  商机开发: { color: '#E0661F', bg: '#FDE7D8' },
  初步接洽: { color: '#D9861A', bg: '#FCEBD2' },
  规划中: { color: '#4F5FD0', bg: '#E4E7FB' },
}

export interface Factory {
  no: number
  name: string // 工厂/业务单元
  region: '中国' | '东南亚' | '欧洲' | '北美' // 地图上的大区
  country: string
  city: string
  coord: Coord // 城市坐标 [经度, 纬度]
  products: string // 目标产品及应用
  stage: string
  owner: string // 项目负责人
  next: string // 下一步行动
  scale: number // 预计规模（万元）
}

export const FACTORIES: Factory[] = [
  { no: 1, name: '深圳工厂', region: '中国', country: '中国', city: '深圳', coord: [114.06, 22.54], products: '激光器/PCB加工', stage: '已合作', owner: '张三', next: '扩大份额', scale: 3000 },
  { no: 2, name: '苏州工厂', region: '中国', country: '中国', city: '苏州', coord: [120.58, 31.3], products: 'PCD微钻/半导体', stage: '技术验证', owner: '李四', next: '完成测试', scale: 2000 },
  { no: 3, name: '越南工厂', region: '东南亚', country: '越南', city: '胡志明市', coord: [106.66, 10.76], products: '激光设备/焊接', stage: '商机开发', owner: '王五', next: '安排打样', scale: 1500 },
  { no: 4, name: '欧洲工厂', region: '欧洲', country: '德国', city: '斯图加特', coord: [9.18, 48.78], products: '光连接产品', stage: '初步接洽', owner: '赵六', next: '技术交流', scale: 800 },
  { no: 5, name: '北美工厂', region: '北美', country: '美国', city: '底特律', coord: [-83.05, 42.33], products: '激光器/新能源', stage: '规划中', owner: '陈七', next: '需求确认', scale: 1200 },
  { no: 6, name: '武汉工厂', region: '中国', country: '中国', city: '武汉', coord: [114.31, 30.59], products: '光连接/光模块', stage: '商机开发', owner: '周八', next: '方案报价', scale: 1000 },
  { no: 7, name: '成都工厂', region: '中国', country: '中国', city: '成都', coord: [104.07, 30.67], products: '激光设备/切割', stage: '初步接洽', owner: '吴九', next: '拜访交流', scale: 900 },
  { no: 8, name: '泰国工厂', region: '东南亚', country: '泰国', city: '罗勇', coord: [101.28, 12.68], products: 'PCD微钻/HDI微孔', stage: '规划中', owner: '郑十', next: '需求调研', scale: 600 },
]

// 地图第一层：大区标记的位置（图片上的 欧洲 / 中国 / 东南亚 / 北美）
export const REGION_COORD: Record<string, Coord> = { 欧洲: [12, 50], 中国: [104, 34], 东南亚: [104, 12], 北美: [-96, 40] }

export interface ProductLine { line: string; done: string; todo: string; stage: string; focus: string }
export const PRODUCTS: ProductLine[] = [
  { line: '激光器', done: 'PCB钻孔', todo: '精密切割', stage: '技术验证', focus: '深圳/苏州' },
  { line: '激光设备', done: '焊接/切割', todo: '新能源焊接', stage: '商机开发', focus: '越南/欧洲' },
  { line: 'PCD微钻', done: 'HDI微孔', todo: '半导体钻孔', stage: '需求确认', focus: '苏州/北美' },
  { line: '光连接', done: '光模块封装', todo: '精密加工', stage: '初步接洽', focus: '深圳/欧洲' },
]

export interface KeyProject { code: string; name: string; factory: string; stage: string; owner: string; due: string }
export const PROJECTS: KeyProject[] = [
  { code: 'P2027-001', name: 'HDI钻孔项目', factory: '深圳工厂', stage: '打样验证', owner: '张三', due: '2027/4' },
  { code: 'P2027-002', name: '新能源焊接设备', factory: '越南工厂', stage: '方案报价', owner: '李四', due: '2027/6' },
  { code: 'P2027-003', name: '半导体微钻', factory: '苏州工厂', stage: '技术验证', owner: '王五', due: '2027/5' },
  { code: 'P2027-004', name: '光模块精密加工', factory: '欧洲工厂', stage: '需求确认', owner: '赵六', due: '2027/7' },
]

// 产品布局里「重点工厂」写的是简称（深圳/欧洲…），换成工厂名：越南 → 越南工厂
export const factoryShort = (f: Factory) => f.name.replace(/工厂$/, '')
