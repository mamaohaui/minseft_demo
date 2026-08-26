// 云函数 getFavorites：返回我的收藏地点列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const favs = await db.collection('favorites').where({ openid: OPENID }).get()
  const ids = favs.data.map(f => f.spotId)
  if (ids.length === 0) return { ok: true, data: [] }

  const spots = await db.collection('spots').where({ _id: _.in(ids) }).get()
  return { ok: true, data: spots.data }
}
