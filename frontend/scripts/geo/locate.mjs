// 地址解析：从地址文本中识别省份、城市，并给出城市中心的近似坐标（地图落点用，不是精确定位）。
// 地名表在 cities.json（全部地级市及常见县级市、新区）和 overseas.json（海外地名关键词）。
import { readFileSync } from 'node:fs'

const load = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'))
const { region, parent, noise, cities } = load('./cities.json')

/** 省份 → 大区 */
export const REGION = region

// 名称长的优先匹配（如"长沙县"先于"长沙"）
const BY_LEN = [...cities].sort((a, b) => b[1].length - a[1].length)
const PROVINCES = Object.keys(region).sort((a, b) => b.length - a.length)
// 地址中会出现但不是城市名的词（如"朝阳区""吉林路"），匹配前先去掉
const NOISE = new RegExp(noise, 'g')
const PROV_TOKEN = new RegExp(`(${PROVINCES.join('|')})(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)?`)

// 在文本中找最先出现的城市；给了省份时只在该省范围内找
function find(text, province) {
  let best = null
  for (const c of BY_LEN) {
    if (province && c[0] !== province) continue
    const i = text.indexOf(c[1])
    if (i >= 0 && (!best || i < best.i)) best = { i, c }
  }
  return best?.c ?? null
}

function locateRaw(texts) {
  for (const text of texts) {
    if (!text) continue
    const t = String(text).replaceAll(' ', '').replace(NOISE, '')
    // 省份只看地址开头；先认出省份再在省内找城市，避免"吉林省长春市"被认成吉林市
    let m = PROV_TOKEN.exec(t.slice(0, 20))
    // "海南州"等以省名开头的城市名，不当作省份
    if (m && (m[1] === '海南' || m[1] === '吉林') && !m[2]) m = null
    if (m) {
      const province = m[1]
      // 只认出省份时用省会（表中该省的第一个城市）
      return find(t.slice(0, m.index) + t.slice(m.index + m[0].length), province) ?? cities.find(c => c[0] === province)
    }
    const hit = find(t, null)
    if (hit) return hit
  }
  return null
}

/**
 * 依次在各段文本（如地址、公司名）中找城市。县级地名换成所属地级市的名称，坐标仍用县级的位置。
 * @returns {{province: string, city: string, lng: number, lat: number} | null}
 */
export function locate(...texts) {
  const hit = locateRaw(texts)
  return hit ? { province: hit[0], city: parent[hit[1]] ?? hit[1], lng: hit[2], lat: hit[3] } : null
}

const PLACES = load('./overseas.json') // [关键词, 国家, 城市, 经度, 纬度]

/** @returns {{country: string, city: string, lng: number, lat: number} | null} 不是已知海外地址时返回 null */
export function locateOverseas(text) {
  const p = PLACES.find(([key]) => String(text ?? '').includes(key))
  return p ? { country: p[1], city: p[2], lng: p[3], lat: p[4] } : null
}
