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

  // 一人一评：已有评价则覆盖（防止刷分），更新 updatedAt
  const existing = await db.collection('reviews').where({ spotId, openid: OPENID }).get()
  if (existing.data.length) {
    await db.collection('reviews').doc(existing.data[0]._id).update({
      data: { rating, tags, content, updatedAt: db.serverDate() },
    })
  } else {
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
  }

  // 重新聚合：用 aggregate 精确统计（不受单次查询 100 条上限影响）
  const $ = db.command.aggregate
  const agg = await db.collection('reviews').aggregate()
    .match({ spotId })
    .group({
      _id: null,
      avg: $.avg('$rating'),
      cnt: $.sum(1),
      tagArr: $.push('$tags'),
    })
    .end()
  const stat = (agg.list && agg.list[0]) || { avg: 0, cnt: 0, tagArr: [] }
  const ratingAvg = stat.cnt ? Math.round(stat.avg * 10) / 10 : 0
  const tagCounts = {}
  ;(stat.tagArr || []).forEach(arr => (arr || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1 }))

  await db.collection('spots').doc(spotId).update({
    data: { ratingAvg, ratingCount: stat.cnt, tagCounts, updatedAt: db.serverDate() },
  })

  return { ok: true }
}
