// 云函数 getSpotsNearby：geoNear 附近搜索 + 按角色过滤可见性
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { lng, lat } = event

  if (!lng || !lat) return { ok: false, code: 'INVALID', message: '缺少坐标' }

  // 角色
  let role = 'normal'
  try {
    const u = await db.collection('users').doc(OPENID).get()
    role = u.data.role
  } catch (e) {}

  const visCond = role === 'vip' ? _.in(['public', 'vip']) : 'public'

  // 主查询：全部公开/VIP 地点，按距离由近到远排序（不设距离上限）
  const main = await db.collection('spots')
    .where({
      'current.location': _.geoNear({
        geometry: db.Geo.Point(lng, lat),
      }),
      visibility: visCond,
    })
    .limit(100)
    .get()

  // 附查询：创建者自己的 private 地点
  const priv = await db.collection('spots')
    .where({ creatorOpenid: OPENID, visibility: 'private' })
    .limit(50)
    .get()

  const all = main.data.concat(priv.data).map(s => {
    if (s.current && s.current.location && s.current.location.coordinates) {
      s.current.location = { lng: s.current.location.coordinates[0], lat: s.current.location.coordinates[1] }
    }
    return s
  })
  return { ok: true, data: all }
}
