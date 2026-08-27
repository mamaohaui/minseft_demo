// 云函数 getRegionSpots：下载某区域（省/市/县）的全部公共摊点（离线数据包内容）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 与 listRegionPackages 保持一致的区域划分逻辑
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

const regionOf = (lng, lat) => {
  let best = null
  let bestD = Infinity
  for (const d of DISTRICTS) {
    const dx = (lng - d.lng) * 95.5
    const dy = (lat - d.lat) * 111
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < bestD) { bestD = dist; best = d }
  }
  if (best && bestD <= 25) return { province: '四川省', city: '成都市', district: best.name }
  return { province: '其他地区', city: '其他', district: '其他' }
}

const toLngLat = (p) => {
  if (!p) return null
  if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) return { lng: p.coordinates[0], lat: p.coordinates[1] }
  if (typeof p.longitude === 'number' && typeof p.latitude === 'number') return { lng: p.longitude, lat: p.latitude }
  if (typeof p.lng === 'number' && typeof p.lat === 'number') return p
  return null
}

exports.main = async (event) => {
  const { province, city, district } = event
  if (!province || !city || !district) {
    return { ok: false, code: 'INVALID', message: '缺少区域参数' }
  }

  const res = await db.collection('spots')
    .where({ visibility: 'public' })
    .limit(1000)
    .get()
    .catch(() => null)

  const spots = []
  ;(((res && res.data) || []).forEach(s => {
    if (!s.current) return
    const p = toLngLat(s.current.location)
    if (!p) return
    const r = regionOf(p.lng, p.lat)
    if (r.province === province && r.city === city && r.district === district) {
      s.current.location = p // 归一化，前端直接可用
      spots.push(s)
    }
  }))
  return { ok: true, data: spots, count: spots.length }
}
