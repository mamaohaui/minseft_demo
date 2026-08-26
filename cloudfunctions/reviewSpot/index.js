// 云函数 reviewSpot：管理员审核（通过/驳回），区分新建与修改两种
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { spotId, action, reason } = event

  const admins = (process.env.adminOpenids || '').split(',').map(s => s.trim())
  if (!admins.includes(OPENID)) {
    return { ok: false, code: 'NO_PERMISSION', message: '无权审核' }
  }
  if (!['approve', 'reject'].includes(action)) {
    return { ok: false, code: 'INVALID', message: 'action 非法' }
  }

  const spotRes = await db.collection('spots').doc(spotId).get().catch(() => null)
  if (!spotRes || !spotRes.data) {
    return { ok: false, code: 'NOT_FOUND', message: '该地点不存在' }
  }
  const spot = spotRes.data

  const isNew = !spot.current // current 为空 = 新建待审；否则是修改待审

  if (action === 'approve') {
    await db.collection('spots').doc(spotId).update({
      data: {
        current: spot.pending,
        pending: null,
        status: 'approved',
        hasPendingUpdate: false,
        rejectReason: null,
        updatedAt: db.serverDate(),
      },
    })
  } else {
    // 驳回：新建则保留 pending 供修改重提；修改则清空 pending、current 不变
    const update = {
      status: isNew ? 'rejected' : 'approved',
      rejectReason: reason || '不符合要求',
      hasPendingUpdate: false,
      updatedAt: db.serverDate(),
    }
    if (!isNew) update.pending = null
    await db.collection('spots').doc(spotId).update({ data: update })
  }

  return { ok: true }
}
