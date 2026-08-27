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

  // location 是 GeoPoint，返回前转成 {lng,lat}，前端直接用
  const toLngLat = (p) => p && p.coordinates ? { lng: p.coordinates[0], lat: p.coordinates[1] } : p
  const list = res.data.map(s => {
    if (s.current && s.current.location) s.current.location = toLngLat(s.current.location)
    if (s.pending && s.pending.location) s.pending.location = toLngLat(s.pending.location)
    return s
  })

  return { ok: true, data: list }
}
