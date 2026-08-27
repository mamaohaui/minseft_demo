// 云函数 getFollowedSpots：我关注的人公开发布的点位（"关注分享"图层数据源）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 坐标归一化：兼容 GeoJSON {coordinates} / GeoPoint {longitude,latitude} / 已是 {lng,lat}
const toLngLat = (p) => {
  if (!p) return p
  if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) return { lng: p.coordinates[0], lat: p.coordinates[1] }
  if (typeof p.longitude === 'number' && typeof p.latitude === 'number') return { lng: p.longitude, lat: p.latitude }
  return p
}

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()

  // follows 集合可能尚不存在（从未关注过任何人），catch 兜底
  const fl = await db.collection('follows').where({ follower: OPENID }).get().catch(() => null)
  const followees = ((fl && fl.data) || []).map(f => f.followee).filter(Boolean)
  if (followees.length === 0) return { ok: true, data: { followees: [], spots: [] } }

  // 关注的人公开发布的点位（private 不可见；vip 沿用公共可见性口径不返回）
  const res = await db.collection('spots')
    .where({ creatorOpenid: _.in(followees), visibility: 'public' })
    .limit(50)
    .get()
    .catch(() => null)

  const spots = ((res && res.data) || []).map(s => {
    if (s.current && s.current.location) s.current.location = toLngLat(s.current.location)
    return s
  })
  return { ok: true, data: { followees, spots } }
}
