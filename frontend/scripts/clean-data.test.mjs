import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanRows, STAGES, PRODUCTS } from './clean-data.mjs'
import { locate, locateOverseas } from './geo/locate.mjs'

const HEADER = ['(不要修改) KA集团子公司', '名称', '所属集团', '负责人', '当前阶段', '目标产品', '下一步行动', '预计规模（万元）', '注册地址', '网址', '经度', '纬度']
const row = (o = {}) => {
  const d = { id: 'id-1', name: '甲公司', group: '三一集团有限公司', owner: '张三', stage: '已合作', product: '激光器', next: '回访', scale: 300, address: '湖南省长沙市岳麓区1号', website: null, lng: 112.9, lat: 28.2, ...o }
  return [d.id, d.name, d.group, d.owner, d.stage, d.product, d.next, d.scale, d.address, d.website, d.lng, d.lat]
}

test('阶段顺序固定为 CRM 的 4 个选项', () => {
  assert.deepEqual(STAGES, ['未合作', '规划中', '商机开发', '已合作'])
})

test('一行数据转成公司记录', () => {
  const { companies, skipped } = cleanRows(HEADER, [row()])
  assert.deepEqual(skipped, [])
  assert.deepEqual(companies, [{
    id: 'id-1', name: '甲公司', group: '三一集团有限公司', country: '中国', province: '湖南', city: '长沙', region: '华中',
    stage: '已合作', products: ['激光器'], owner: '张三', next: '回访', scale: 300, address: '湖南省长沙市岳麓区1号', website: '', coord: [112.9, 28.2],
  }])
})

test('同名公司只留第一行，空名称跳过', () => {
  const { companies } = cleanRows(HEADER, [row({ id: 'a' }), row({ id: 'b' }), row({ name: null }), row({ name: ' 甲公司 ', id: 'c' })])
  assert.deepEqual(companies.map(c => c.id), ['a'])
})

test('列顺序变化不影响结果', () => {
  const order = [...HEADER.keys()].reverse()
  const { companies } = cleanRows(order.map(i => HEADER[i]), [order.map(i => row()[i])])
  assert.equal(companies[0].name, '甲公司')
  assert.equal(companies[0].city, '长沙')
})

test('缺少必需的列时报错并说明缺哪一列', () => {
  assert.throws(() => cleanRows(HEADER.filter(h => h !== '注册地址'), []), /缺少列：注册地址/)
  assert.throws(() => cleanRows(['所属集团'], []), /缺少列：名称、注册地址/)
})

test('阶段为空或不在选项内时按未合作，规模为空或非数字时为 0', () => {
  const { companies } = cleanRows(HEADER, [row({ name: 'A', stage: null, scale: null }), row({ name: 'B', stage: '技术验证', scale: '待定' }), row({ name: 'C', scale: '120.4' })])
  assert.deepEqual(companies.map(c => [c.stage, c.scale]), [['未合作', 0], ['未合作', 0], ['已合作', 120]])
})

test('地址识别不出的行跳过并记下名称', () => {
  const { companies, skipped } = cleanRows(HEADER, [row({ name: '不知道在哪', address: '某某大厦3楼' }), row()])
  assert.deepEqual(skipped, ['不知道在哪'])
  assert.equal(companies.length, 1)
})

test('没有经纬度时用城市坐标；没有主键时按名称生成固定 id', () => {
  const { companies } = cleanRows(HEADER, [row({ lng: null, lat: null, id: null })])
  assert.deepEqual(companies[0].coord, [112.94, 28.23])
  assert.match(companies[0].id, /^X-[0-9a-f]{10}$/)
  assert.equal(cleanRows(HEADER, [row({ id: null })]).companies[0].id, companies[0].id)
})

test('海外地址：国家为国家名，省份为空，大区为所在的洲', () => {
  const { companies } = cleanRows(HEADER, [row({ address: '德国科隆 Sany Allee 1' })])
  const { country, province, city, region } = companies[0]
  assert.deepEqual({ country, province, city, region }, { country: '德国', province: '', city: '科隆', region: '欧洲' })
})

test('地址解析', () => {
  assert.deepEqual(locate('吉林省长春市朝阳区1号'), { province: '吉林', city: '长春', lng: 125.32, lat: 43.82 })
  assert.equal(locate('北京市朝阳区建国路1号').city, '北京') // 朝阳区不是辽宁朝阳市
  assert.equal(locate('江苏省昆山市开发区').city, '苏州') // 县级并入地级市
  assert.equal(locate('湖南省某某开发区').city, '长沙') // 只认出省份时用省会
  assert.equal(locate('园区路8号', '益阳某某有限公司').city, '益阳') // 地址认不出时用公司名
  assert.equal(locate('园区路8号'), null)
  assert.equal(locateOverseas('长沙市岳麓区'), null)
})

test('目标产品为空或「不适用」时换成具体产品，同一家公司每次结果相同', () => {
  const run = () => cleanRows(HEADER, [row({ id: 'a', name: '甲公司', product: '不适用' }), row({ id: 'b', name: '乙公司', product: null }), row({ id: 'c', name: '丙公司', product: '光连接' })]).companies
  const [a, b, c] = run()
  assert.ok(a.products.length === 1 && PRODUCTS.includes(a.products[0]) && PRODUCTS.includes(b.products[0]))
  assert.deepEqual(c.products, ['光连接'])
  assert.deepEqual(run().map(x => x.products), [a.products, b.products, c.products])
})

test('目标产品可以有多个：按顿号、逗号、斜杠等拆开，去重，去掉不适用', () => {
  const { companies } = cleanRows(HEADER, [row({ product: '激光器、光连接，激光器 / PCD微钻；不适用' })])
  assert.deepEqual(companies[0].products, ['激光器', '光连接', 'PCD微钻'])
})

test('mockMulti：一部分只有一个产品的公司多出一两个，不重复，结果可重复；已有多个的不动', () => {
  const rows = [...Array.from({ length: 200 }, (_, i) => row({ id: `i${i}`, name: `公司${i}`, product: ['激光器', '光连接', '激光设备', 'PCD微钻'][i % 4] })), row({ id: 'm', name: '多产品公司', product: '激光器、光连接' })]
  const run = () => cleanRows(HEADER, rows, { mockMulti: true }).companies
  const list = run(), n = k => list.filter(c => c.products.length === k).length
  assert.ok(n(1) > 100 && n(2) > 20 && n(3) > 3 && n(1) + n(2) + n(3) === 201)
  assert.ok(list.every(c => new Set(c.products).size === c.products.length))
  assert.deepEqual(list.at(-1).products, ['激光器', '光连接'])
  assert.deepEqual(run().map(c => c.products), list.map(c => c.products))
  assert.ok(cleanRows(HEADER, rows).companies.slice(0, 200).every(c => c.products.length === 1)) // 默认不开
})
