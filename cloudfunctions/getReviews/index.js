// 云函数 getReviews：返回某地点评价列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { spotId } = event
  const res = await db.collection('reviews')
    .where({ spotId })
    .orderBy('createdAt', 'desc')
    .get()
  // 返回当前用户对该地点的评价（一人一评），供前端判断"已评/未评"
  const my = await db.collection('reviews').where({ spotId, openid: OPENID }).get()
  return { ok: true, data: res.data, myReview: my.data[0] || null }
}
