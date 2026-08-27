// 云函数 listResources：资源拓展列表（可按分类筛选，最新在前，分页）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const PAGE_SIZE = 20

exports.main = async (event) => {
  const category = (event.category || '').trim()
  const page = Math.max(0, parseInt(event.page, 10) || 0)
  const where = {}
  if (category && category !== '全部') where.category = category

  const res = await db.collection('resources')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .get()

  return { ok: true, data: res.data, page, pageSize: PAGE_SIZE, hasMore: (res.data || []).length === PAGE_SIZE }
}
