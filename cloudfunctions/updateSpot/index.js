// 云函数 updateSpot：PR 式修改。private 直改，public/vip 待审
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { spotId, title, location, category, timeSlot, positionReq, mgmtReq, feeType, feeAmount } = event

  const res = await db.collection('spots').doc(spotId).get().catch(() => null)
  if (!res || !res.data) return { ok: false, code: 'NOT_FOUND', message: '该地点不存在' }
  const spot = res.data

  if (spot.creatorOpenid !== OPENID) {
    return { ok: false, code: 'NO_PERMISSION', message: '无权操作该地点' }
  }

  const content = { title, location, category, timeSlot, positionReq, mgmtReq, feeType, feeAmount }

  if (spot.visibility === 'private') {
    await db.collection('spots').doc(spotId).update({
      data: { current: content, updatedAt: db.serverDate() },
    })
  } else {
    // PR 式：current 不变，pending 存新版本，标注待公布
    await db.collection('spots').doc(spotId).update({
      data: { pending: content, hasPendingUpdate: true, updatedAt: db.serverDate() },
    })
  }

  return { ok: true }
}
