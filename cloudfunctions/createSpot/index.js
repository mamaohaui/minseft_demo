// 云函数 createSpot：新建地点，按可见性分流
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { visibility, title, location, category, timeSlot, positionReq, mgmtReq, feeType, feeAmount } = event

  // 必填校验
  if (!title || !location || !location.lng || !location.lat || !visibility) {
    return { ok: false, code: 'INVALID', message: '标题、坐标、可见性必填' }
  }
  if (!['public', 'vip', 'private'].includes(visibility)) {
    return { ok: false, code: 'INVALID', message: '可见性非法' }
  }

  const content = { title, location, category, timeSlot, positionReq, mgmtReq, feeType, feeAmount }

  const spot = {
    creatorOpenid: OPENID,
    visibility,
    ratingAvg: 0,
    ratingCount: 0,
    tagCounts: {},
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  }

  if (visibility === 'private') {
    // 私人：跳过审核，直接公开给自己
    spot.current = content
    spot.pending = null
    spot.status = 'approved'
    spot.hasPendingUpdate = false
    spot.rejectReason = null
  } else {
    // public / vip：走审核
    spot.current = null
    spot.pending = content
    spot.status = 'pending'
    spot.hasPendingUpdate = false
    spot.rejectReason = null
  }

  const res = await db.collection('spots').add({ data: spot })
  return { ok: true, data: { _id: res._id } }
}
