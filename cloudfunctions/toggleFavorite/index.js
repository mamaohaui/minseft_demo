// 云函数 toggleFavorite：收藏/取消收藏
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { spotId } = event
  if (!spotId) return { ok: false, code: 'INVALID', message: '缺少 spotId' }

  const exist = await db.collection('favorites')
    .where({ openid: OPENID, spotId })
    .get()

  if (exist.data.length > 0) {
    await db.collection('favorites').doc(exist.data[0]._id).remove()
    return { ok: true, data: { favorited: false } }
  }

  await db.collection('favorites').add({
    data: { openid: OPENID, spotId, createdAt: db.serverDate() },
  })
  return { ok: true, data: { favorited: true } }
}
