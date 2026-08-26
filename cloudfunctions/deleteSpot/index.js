// 云函数 deleteSpot：删除地点（创建者或管理员）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { spotId } = event

  const res = await db.collection('spots').doc(spotId).get().catch(() => null)
  if (!res || !res.data) return { ok: false, code: 'NOT_FOUND', message: '该地点不存在' }

  const admins = (process.env.adminOpenids || '').split(',').map(s => s.trim())
  if (res.data.creatorOpenid !== OPENID && !admins.includes(OPENID)) {
    return { ok: false, code: 'NO_PERMISSION', message: '无权删除' }
  }

  await db.collection('spots').doc(spotId).remove()
  return { ok: true }
}
