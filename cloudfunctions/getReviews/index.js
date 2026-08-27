// 云函数 getReviews：返回某地点评价列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { spotId } = event
  // reviews 集合可能尚不存在（无人写过评价），catch 兜底返回空列表
  const res = await db.collection('reviews')
    .where({ spotId })
    .orderBy('createdAt', 'desc')
    .get()
    .catch(() => null)
  // 返回当前用户对该地点的评价（一人一评），供前端判断"已评/未评"
  const my = await db.collection('reviews').where({ spotId, openid: OPENID }).get().catch(() => null)
  return { ok: true, data: (res && res.data) || [], myReview: (my && my.data && my.data[0]) || null }
}
