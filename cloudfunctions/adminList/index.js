// 云函数 adminList：待审列表（pending 非空）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const admins = (process.env.adminOpenids || '').split(',').map(s => s.trim())
  if (!admins.includes(OPENID)) return { ok: false, code: 'NO_PERMISSION', message: '无权查看' }

  const res = await db.collection('spots')
    .where({ pending: _.neq(null) })
    .orderBy('updatedAt', 'desc')
    .get()

  // 坐标归一化：兼容 GeoJSON {coordinates} / GeoPoint {longitude,latitude} / 已是 {lng,lat}
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
