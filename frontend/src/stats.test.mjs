import test from 'node:test'
import assert from 'node:assert/strict'
import { tally, regions, blankRegions, growRegions, products, inScope, areas, sameScope, WORLD } from './stats.ts'

const STAGES = ['未合作', '规划中', '商机开发', '已合作']
const c = (o) => ({ country: '中国', province: '湖南', city: '长沙', stage: '未合作', products: ['激光器'], scale: 0, ...o })

test('不适用的公司计入子公司总数，不进目标公司和合作率', () => {
  const t = tally([c({ stage: '已合作' }), c({ stage: '规划中' }), c({}), c({ products: ['不适用'] })], STAGES)
  assert.deepEqual([t.total, t.target, t.done, t.talking, t.todo], [4, 3, 1, 1, 2])
  assert.equal(t.rate, 1 / 3)
  assert.equal(t.top, '已合作')
  assert.equal(t.byStage['未合作'], 2)
  assert.equal(t.targetByStage['未合作'], 1)
})

test('没有公司或没有目标公司时不出现 NaN', () => {
  assert.equal(tally([], STAGES).rate, 0)
  assert.equal(tally([], STAGES).top, '未合作')
  assert.equal(tally([c({ products: ['不适用'] })], STAGES).rate, 0)
})

test('走得最远的阶段：没有已合作时取商机开发', () => {
  assert.equal(tally([c({ stage: '规划中' }), c({ stage: '商机开发' })], STAGES).top, '商机开发')
})

test('范围：全球按国内省份 + 海外国家分；省和海外国家按城市分', () => {
  const list = [c({}), c({ province: '广东', city: '深圳' }), c({ country: '德国', province: '', city: '慕尼黑' })]
  assert.deepEqual(regions(list, WORLD, STAGES).map(r => r.key).sort(), ['广东', '德国', '湖南'].sort())
  assert.deepEqual(regions(list, { kind: 'country', country: '中国' }, STAGES).map(r => r.key).sort(), ['广东', '湖南'].sort())
  const hn = regions(list, { kind: 'province', country: '中国', province: '湖南' }, STAGES)
  assert.deepEqual(hn.map(r => [r.key, r.cityKey, r.scope]), [['湖南|长沙', '湖南|长沙', undefined]])
  const de = regions(list, { kind: 'country', country: '德国' }, STAGES)
  assert.deepEqual(de.map(r => r.cityKey), ['德国|慕尼黑'])
  assert.equal(inScope(list[2], { kind: 'country', country: '中国' }), false)
})

test('空白地区：有目标公司且已合作为 0；只有不适用公司的地区不算', () => {
  const list = [
    c({ province: '山西', stage: '规划中' }), c({ province: '山西' }),
    c({ province: '青海', products: ['不适用'] }),
    c({ province: '广东', stage: '已合作' }), c({ province: '广东' }),
    c({ province: '上海', stage: '已合作' }),
  ]
  const rs = regions(list, WORLD, STAGES)
  assert.deepEqual(blankRegions(rs).map(r => r.name), ['山西'])
  assert.deepEqual(growRegions(rs).map(r => r.name), ['广东']) // 上海已全部合作，不在待扩大里
})

test('产品：不显示不适用', () => {
  const ps = products([c({}), c({ stage: '已合作' }), c({ products: ['不适用'] }), c({ products: ['光连接'] })], STAGES)
  assert.deepEqual(ps.map(p => [p.name, p.t.done, p.t.target]), [['激光器', 1, 2], ['光连接', 0, 1]])
})

test('现有数据的验收数字', async () => {
  const { readFileSync } = await import('node:fs')
  const data = JSON.parse(readFileSync(new URL('../public/mock/companies.json', import.meta.url), 'utf8'))
  data.companies = data.companies.filter(x => x.group === '三一集团有限公司') // 看板一次只看一个集团
  const t = tally(data.companies, data.stages)
  assert.deepEqual([t.total, t.target, t.done, t.todo], [805, 805, 61, 744])
  assert.equal((t.rate * 100).toFixed(1), '7.6')
  const rs = regions(data.companies, WORLD, data.stages)
  const hn = rs.find(r => r.key === '湖南').t
  assert.deepEqual([hn.done, hn.target], [10, 207])
})

test('大区：只含海外公司，按 region 字段分；按钮来自数据', () => {
  const list = [c({ region: '华中' }), c({ country: '泰国', province: '', region: '东南亚' }), c({ country: '越南', province: '', region: '东南亚' }), c({ country: '德国', province: '', region: '欧洲' })]
  assert.deepEqual(areas(list), ['东南亚', '欧洲'])
  const sea = { kind: 'area', area: '东南亚' }
  assert.deepEqual(list.map(x => inScope(x, sea)), [false, true, true, false])
  assert.deepEqual(regions(list, sea, STAGES).map(r => r.key).sort(), ['泰国', '越南'].sort())
  assert.equal(sameScope(sea, { kind: 'area', area: '东南亚' }), true)
  assert.equal(sameScope(sea, { kind: 'area', area: '欧洲' }), false)
  assert.equal(sameScope(sea, WORLD), false)
})

test('一家公司有多个产品：在每个产品里各算一次', () => {
  const ps = products([c({ products: ['激光器', '光连接'], stage: '已合作' }), c({ products: ['光连接'] })], STAGES)
  assert.deepEqual(ps.map(p => [p.name, p.t.done, p.t.target]), [['光连接', 1, 2], ['激光器', 1, 1]])
  assert.equal(tally([c({ products: ['激光器', '光连接'] })], STAGES).target, 1) // 公司数不重复算
})
