// 云函数 listResources：资源拓展列表（可按分类筛选，最新在前）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const category = (event.category || '').trim()
  const where = {}
  if (category && category !== '全部') where.category = category

  const res = await db.collection('resources')
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get()

  return { ok: true, data: res.data }
}
