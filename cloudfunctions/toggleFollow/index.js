// 云函数 toggleFollow：关注 / 取消关注某个发布者
// follows 集合结构：{ follower: 我的openid, followee: 被关注者openid, createdAt }
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { targetOpenid } = event

  if (!targetOpenid) return { ok: false, code: 'INVALID', message: '缺少关注对象' }
  // 不能关注自己；不能关注基础数据库（官方点位无真实发布者）
  if (targetOpenid === OPENID || targetOpenid === 'base') {
    return { ok: false, code: 'INVALID', message: '该对象不支持关注' }
  }

  // follows 集合可能尚不存在，catch 兜底
  const existing = await db.collection('follows')
    .where({ follower: OPENID, followee: targetOpenid })
    .get()
    .catch(() => null)

  // 已关注 → 取消
  if (existing && existing.data && existing.data.length > 0) {
    await db.collection('follows').doc(existing.data[0]._id).remove()
    return { ok: true, data: { followed: false } }
  }

  // 未关注 → 关注
  await db.collection('follows').add({
    data: { follower: OPENID, followee: targetOpenid, createdAt: db.serverDate() },
  })
  return { ok: true, data: { followed: true } }
}
