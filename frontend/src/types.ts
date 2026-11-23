export type Coord = [number, number]

// 一家 KA 集团子公司（地图上的一个落点）。字段由 scripts/clean-data.mjs 从 CRM 导出的 Excel 清洗得到
export interface Company {
  id: string
  name: string
  group: string // 所属集团
  country: string // 国内为"中国"，海外为国家名
  province: string // 省份简称（与中国地图区域名一致）；海外为空
  city: string // 地级市（县级已并入）
  region: string // 大区：国内为华南/华东/华中/华北/西南/东北/西北；海外为亚洲/东南亚/欧洲/北美等
  stage: string // 当前阶段，取值见 CompanyData.stages
  product: string // 目标产品
  owner: string // 负责人
  next: string // 下一步行动
  scale: number // 预计规模（万元）
  address: string // 注册地址
  website: string
  coord: Coord // [经度, 纬度]，目前只精确到城市
}

// 接口返回的全部数据
export interface CompanyData {
  updatedAt: string // 数据日期 YYYY-MM-DD
  stages: string[] // 合作阶段，按推进顺序
  companies: Company[]
}

// ---- 以下类型只给暂未上屏的组件（KPI 条、产品矩阵、项目甘特）用 ----

export interface Product {
  line: string
  done: string[]
  todo: string[]
  stage: string
  focus: string[]
  apps: Record<string, number>
}

export interface Project {
  code: string
  name: string
  factoryId: string
  stage: string
  owner: string
  start: string
  due: string
  mock: boolean
}

export interface Kpis {
  factoryCount: number
  regionCount: number
  cooperatedCount: number
  cooperationRate: number
  totalScale: number
  cooperatedScaleShare: number
  appsDone: number
  appsTodo: number
  projectCount: number
  projectsDueSoon: number
}

// 抽屉内容：单个公司 / 某个城市的公司列表
export type DetailTarget =
  | { type: 'company'; id: string; fromCity?: string }
  | { type: 'city'; key: string }
