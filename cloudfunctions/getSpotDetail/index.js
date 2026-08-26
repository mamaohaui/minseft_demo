// 云函数 getSpotDetail：地点详情 + 可见性校验
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { spotId } = event

  const res = await db.collection('spots').doc(spotId).get().catch(() => null)
  if (!res || !res.data) return { ok: false, code: 'NOT_FOUND', message: '该地点不存在' }
  const spot = res.data

  // 可见性校验
  if (spot.visibility === 'private' && spot.creatorOpenid !== OPENID) {
    const admins = (process.env.adminOpenids || '').split(',').map(s => s.trim())
    if (!admins.includes(OPENID)) return { ok: false, code: 'FORBIDDEN', message: '无权查看' }
  }

  return { ok: true, data: spot }
}
