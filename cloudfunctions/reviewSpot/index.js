// 云函数 reviewSpot：管理员审核（通过/驳回），区分新建与修改两种
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

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
    const p = spot.pending
    // pending.location 从库里读出是 GeoJSON {type:'Point',coordinates:[lng,lat]}，
    // 必须用 db.Geo.Point 重新构造，直接 _.set(spot.pending) 会把 GeoPoint 写成普通对象导致写入失败
    const loc = p.location || {}
    const current = {
      title: p.title,
      category: p.category,
      timeSlot: p.timeSlot,
      positionReq: p.positionReq,
      mgmtReq: p.mgmtReq,
      feeType: p.feeType,
      feeAmount: p.feeAmount,
      location: loc.coordinates
        ? db.Geo.Point(loc.coordinates[0], loc.coordinates[1])
        : db.Geo.Point(loc.lng || loc.longitude, loc.lat || loc.latitude),
    }
    await db.collection('spots').doc(spotId).update({
      data: {
        current: _.set(current),
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
