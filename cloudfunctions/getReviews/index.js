// 云函数 getReviews：返回某地点评价列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { spotId } = event
  const res = await db.collection('reviews')
    .where({ spotId })
    .orderBy('createdAt', 'desc')
    .get()
  return { ok: true, data: res.data }
}
