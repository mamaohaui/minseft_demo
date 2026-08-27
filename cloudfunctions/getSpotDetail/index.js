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

  const toLngLat = (p) => p && p.coordinates ? { lng: p.coordinates[0], lat: p.coordinates[1] } : p
  if (spot.current && spot.current.location) spot.current.location = toLngLat(spot.current.location)
  if (spot.pending && spot.pending.location) spot.pending.location = toLngLat(spot.pending.location)

  // 当前用户是否已收藏（详情页按钮初始状态）
  const fav = await db.collection('favorites').where({ openid: OPENID, spotId }).get()
  return { ok: true, data: { ...spot, favorited: fav.data.length > 0 } }
}
