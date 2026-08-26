// 云函数 addReview：新增评价 + 更新聚合
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { spotId, rating, tags = [], content = '' } = event

  if (!spotId || !rating || rating < 1 || rating > 5) {
    return { ok: false, code: 'INVALID', message: '评分必须在 1-5 之间' }
  }

  await db.collection('reviews').add({
    data: {
      spotId,
      openid: OPENID,
      rating,
      tags,
      content,
      createdAt: db.serverDate(),
    },
  })

  // 重新聚合
  const all = await db.collection('reviews').where({ spotId }).get()
  const list = all.data
  const ratingAvg = list.length
    ? Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10
    : 0
  const tagCounts = {}
  list.forEach(r => (r.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1 }))

  await db.collection('spots').doc(spotId).update({
    data: { ratingAvg, ratingCount: list.length, tagCounts, updatedAt: db.serverDate() },
  })

  return { ok: true }
}
