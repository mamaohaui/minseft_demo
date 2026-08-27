// 云函数 getMySpots：我的发布列表（含 pending/rejected/approved 全部状态）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('spots')
    .where({ creatorOpenid: OPENID })
    .orderBy('updatedAt', 'desc')
    .limit(100)
    .get()

  // location 读出来可能是 GeoJSON {coordinates:[lng,lat]}、GeoPoint {longitude,latitude}
  // 或已是 {lng,lat}，统一归一化成 {lng,lat}，前端直接用
  const toLngLat = (p) => {
    if (!p) return p
    if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) return { lng: p.coordinates[0], lat: p.coordinates[1] }
    if (typeof p.longitude === 'number' && typeof p.latitude === 'number') return { lng: p.longitude, lat: p.latitude }
    return p
  }
  const list = res.data.map(s => {
    if (s.current && s.current.location) s.current.location = toLngLat(s.current.location)
    if (s.pending && s.pending.location) s.pending.location = toLngLat(s.pending.location)
    return s
  })

  return { ok: true, data: list }
}
