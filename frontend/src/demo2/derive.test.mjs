import test from 'node:test'
import assert from 'node:assert/strict'
import { keyCompanies, areaOverview, productLayout, mockProjects, shortName, PROJECT_STAGES } from './derive.ts'

const STAGES = ['未合作', '规划中', '商机开发', '已合作']
let i = 0
const c = (o) => ({ name: `公司${++i}有限公司`, country: '中国', region: '华中', stage: '未合作', products: ['激光器'], scale: 0, owner: '张三', coord: [112, 28], ...o })

test('重点子公司：不含未合作，各阶段轮流取规模大的，走得远的排前面', () => {
  const list = [
    ...[900, 800, 700, 600, 500].map(scale => c({ stage: '已合作', scale })),
    ...[400, 300].map(scale => c({ stage: '商机开发', scale })),
    c({ stage: '规划中', scale: 100 }), c({ scale: 9999 }),
  ]
  const ks = keyCompanies(list, STAGES, 6)
  assert.deepEqual(ks.map(k => [k.stage, k.scale]), [['已合作', 900], ['已合作', 800], ['已合作', 700], ['商机开发', 400], ['商机开发', 300], ['规划中', 100]])
  assert.equal(keyCompanies(list, STAGES, 100).length, 8) // 不够就有多少给多少
  assert.deepEqual(keyCompanies([], STAGES), [])
})

test('布局概览：国内算一块，海外按大区；公司多的在前', () => {
  const as = areaOverview([c({ stage: '已合作' }), c({}), c({ country: '德国', region: '欧洲', stage: '规划中', coord: [10, 50] })], STAGES)
  assert.deepEqual(as.map(a => [a.name, a.total, a.done, a.talking, a.top]), [['中国', 2, 1, 0, '已合作'], ['欧洲', 1, 0, 1, '规划中']])
  assert.deepEqual(as[1].coord, [10, 50])
  assert.deepEqual(as[1].countries, ['德国'])
})

test('产品布局：多产品公司各算一次；重点子公司不含未合作', () => {
  const ps = productLayout([
    c({ name: '甲有限公司', products: ['激光器', '光连接'], stage: '已合作', scale: 5 }),
    c({ name: '乙股份有限公司', products: ['激光器'], stage: '规划中' }),
    c({ products: ['激光器'] }), c({ products: ['光连接'] }),
  ], STAGES)
  assert.deepEqual(ps.map(p => [p.name, p.total, p.done, p.talking, p.todo, p.top]), [['激光器', 3, 1, 1, 1, '已合作'], ['光连接', 2, 1, 0, 1, '已合作']])
  assert.deepEqual(ps[0].focus, ['甲', '乙'])
  assert.equal(productLayout([c({ products: ['PCD微钻'] })], STAGES)[0].top, '未合作')
})

test('示例项目：每次结果一样，按完成时间排，编号连续', () => {
  const keys = [c({ stage: '已合作' }), c({ stage: '商机开发' }), c({ stage: '规划中' })]
  const a = mockProjects(keys, '2026-11-23'), b = mockProjects(keys, '2026-11-23')
  assert.deepEqual(a, b)
  assert.equal(a.length, 3)
  assert.deepEqual(a.map(p => p.code.slice(-3)), ['001', '002', '003'])
  for (const p of a) { assert.ok(PROJECT_STAGES.includes(p.stage)); assert.match(p.due, /^2027\/\d+$/) }
  assert.equal(a.find(p => p.company === shortName(keys[2].name)).stage, '需求确认')
})
