// 云函数 searchSpots：按标题/品类关键词搜索 + 可见性过滤
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { keyword } = event
  if (!keyword) return { ok: false, code: 'INVALID', message: '关键词不能为空' }

  let role = 'normal'
  try {
    const u = await db.collection('users').doc(OPENID).get()
    role = u.data.role
  } catch (e) {}

  const visCond = role === 'vip' ? _.in(['public', 'vip']) : 'public'
  // 转义正则特殊字符，防止用户输入 ( [ \ 等导致查询报错，按字面量匹配
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const reg = db.RegExp({ regexp: escapeRegExp(keyword), options: 'i' })

  const res = await db.collection('spots')
    .where({
      visibility: visCond,
      'current.title': reg,
    })
    .limit(50)
    .get()

  const res2 = await db.collection('spots')
    .where({
      visibility: visCond,
      'current.category': reg,
    })
    .limit(50)
    .get()

  // 简单去重合并（按 _id）
  const map = new Map()
  res.data.concat(res2.data).forEach(s => map.set(s._id, s))

  // 坐标归一化：兼容 GeoJSON {coordinates} / GeoPoint {longitude,latitude} / 已是 {lng,lat}
  const toLngLat = (p) => {
    if (!p) return p
    if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) return { lng: p.coordinates[0], lat: p.coordinates[1] }
    if (typeof p.longitude === 'number' && typeof p.latitude === 'number') return { lng: p.longitude, lat: p.latitude }
    return p
  }
  const list = Array.from(map.values()).map(s => {
    if (s.current && s.current.location) s.current.location = toLngLat(s.current.location)
    if (s.pending && s.pending.location) s.pending.location = toLngLat(s.pending.location)
    return s
  })

  return { ok: true, data: list }
}
