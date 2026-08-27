// 云函数 updateSpot：PR 式修改。private 直改，public/vip 待审
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { spotId, title, location, category, timeSlot, positionReq, mgmtReq, feeType, feeAmount } = event

  const res = await db.collection('spots').doc(spotId).get().catch(() => null)
  if (!res || !res.data) return { ok: false, code: 'NOT_FOUND', message: '该地点不存在' }
  const spot = res.data

  if (spot.creatorOpenid !== OPENID) {
    return { ok: false, code: 'NO_PERMISSION', message: '无权操作该地点' }
  }

  const content = {
    title, category, timeSlot, positionReq, mgmtReq, feeType, feeAmount,
    location: db.Geo.Point(location.lng, location.lat),
  }

  if (spot.visibility === 'private') {
    const data = { current: _.set(content), updatedAt: db.serverDate() }
    // 被驳回后改为私人：直改 current 并重置状态，清空残留的驳回标记
    if (spot.status === 'rejected') {
      data.status = 'approved'
      data.rejectReason = null
      data.pending = null
      data.hasPendingUpdate = false
    }
    await db.collection('spots').doc(spotId).update({ data })
  } else {
    // PR 式：current 不变，pending 存新版本，标注待公布
    const data = { pending: _.set(content), hasPendingUpdate: true, updatedAt: db.serverDate() }
    // 被驳回后重新提交：重置为待审核并清空驳回原因，重新进入审核队列
    if (spot.status === 'rejected') {
      data.status = 'pending'
      data.rejectReason = null
    }
    await db.collection('spots').doc(spotId).update({ data })
  }

  return { ok: true }
}
