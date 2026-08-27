// 云函数 getSpotDetail：地点详情 + 可见性校验
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { spotId } = event

  const res = await db.collection('spots').doc(spotId).get().catch(() => null)
  if (!res || !res.data) return { ok: false, code: 'NOT_FOUND', message: '该地点不存在' }
  const spot = res.data

  // 可见性校验
  if (spot.visibility === 'private' && spot.creatorOpenid !== OPENID) {
    const admins = (process.env.adminOpenids || '').split(',').map(s => s.trim())
    if (!admins.includes(OPENID)) return { ok: false, code: 'FORBIDDEN', message: '无权查看' }
  }

  // 坐标归一化：兼容 GeoJSON {coordinates} / GeoPoint {longitude,latitude} / 已是 {lng,lat}
  const toLngLat = (p) => {
    if (!p) return p
    if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) return { lng: p.coordinates[0], lat: p.coordinates[1] }
    if (typeof p.longitude === 'number' && typeof p.latitude === 'number') return { lng: p.longitude, lat: p.latitude }
    return p
  }
  if (spot.current && spot.current.location) spot.current.location = toLngLat(spot.current.location)
  if (spot.pending && spot.pending.location) spot.pending.location = toLngLat(spot.pending.location)

  // 当前用户是否已收藏 + 是否为创建者（前端省一次 getUser 调用）
  // 注意：用户从未收藏过时 favorites 集合可能不存在，查询会抛错，必须 catch 兜底
  const fav = await db.collection('favorites').where({ openid: OPENID, spotId }).get().catch(() => null)
  return {
    ok: true,
    data: {
      ...spot,
      favorited: !!(fav && fav.data && fav.data.length > 0),
      isOwner: spot.creatorOpenid === OPENID,
    },
  }
}
