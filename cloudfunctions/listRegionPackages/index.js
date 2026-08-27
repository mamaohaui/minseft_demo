// 云函数 listRegionPackages：公共摊点离线数据包目录（按省/市/县统计）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 成都区县中心坐标（与前端 REGIONS 一致，不含"成都市中心"占位）
const DISTRICTS = [
  { name: '锦江区', lat: 30.6561, lng: 104.0831 },
  { name: '青羊区', lat: 30.6723, lng: 104.0622 },
  { name: '金牛区', lat: 30.6958, lng: 104.0521 },
  { name: '武侯区', lat: 30.6301, lng: 104.0433 },
  { name: '成华区', lat: 30.6719, lng: 104.1082 },
  { name: '高新区', lat: 30.5727, lng: 104.0621 },
  { name: '龙泉驿区', lat: 30.5566, lng: 104.2745 },
  { name: '温江区', lat: 30.6821, lng: 103.8565 },
  { name: '郫都区', lat: 30.8121, lng: 103.9011 },
  { name: '双流区', lat: 30.5744, lng: 103.9237 },
  { name: '新都区', lat: 30.8235, lng: 104.1588 },
]

// 坐标 → 区域：就近归入成都区县（25km 内），超出归"其他地区"
const regionOf = (lng, lat) => {
  let best = null
  let bestD = Infinity
  for (const d of DISTRICTS) {
    const dx = (lng - d.lng) * 95.5 // 北纬30.6° 经度每度约 95.5km
    const dy = (lat - d.lat) * 111
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < bestD) { bestD = dist; best = d }
  }
  if (best && bestD <= 25) return { province: '四川省', city: '成都市', district: best.name }
  return { province: '其他地区', city: '其他', district: '其他' }
}

// 坐标归一化：兼容 GeoJSON {coordinates} / GeoPoint {longitude,latitude}
const toLngLat = (p) => {
  if (!p) return null
  if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) return { lng: p.coordinates[0], lat: p.coordinates[1] }
  if (typeof p.longitude === 'number' && typeof p.latitude === 'number') return { lng: p.longitude, lat: p.latitude }
  if (typeof p.lng === 'number' && typeof p.lat === 'number') return p
  return null
}

exports.main = async () => {
  // 全量公共点位（current 为空 = 未过审，天然排除）；spots 集合查询 catch 兜底
  const res = await db.collection('spots')
    .where({ visibility: 'public' })
    .limit(1000)
    .get()
    .catch(() => null)

  const counter = {}
  ;(((res && res.data) || []).forEach(s => {
    const p = s.current && toLngLat(s.current.location)
    if (!p) return
    const r = regionOf(p.lng, p.lat)
    const key = `${r.province}|${r.city}|${r.district}`
    counter[key] = (counter[key] || 0) + 1
  }))

  const data = Object.keys(counter).map(key => {
    const [province, city, district] = key.split('|')
    return { province, city, district, count: counter[key] }
  })
  return { ok: true, data }
}
