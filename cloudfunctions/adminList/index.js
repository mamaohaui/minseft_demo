// 云函数 adminList：待审列表（pending 非空）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const admins = (process.env.adminOpenids || '').split(',').map(s => s.trim())
  if (!admins.includes(OPENID)) return { ok: false, code: 'NO_PERMISSION', message: '无权查看' }

  const res = await db.collection('spots')
    .where({ pending: _.neq(null) })
    .orderBy('updatedAt', 'desc')
    .get()

  return { ok: true, data: res.data }
}
