// 云函数 getUser：返回当前用户档案，首次自动建档
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const users = db.collection('users')

  let user = null
  try {
    const res = await users.doc(OPENID).get()
    user = res.data
  } catch (e) {
    // 不存在则建档
  }

  if (!user) {
    const newUser = {
      role: 'vip',        // 前期默认 VIP（spec §5.2）
      vipExpireAt: null,
      nickname: '',
      avatar: '',
      avatarUrl: '',
      name: '',
      phone: '',
      hasVehicle: '',
      category: '',
      profileCompleted: false,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    }
    await users.doc(OPENID).set({ data: newUser })
    user = newUser
  }

  // 注册完成判定：已有手机号即视为完成（兼容老用户无此字段）
  const profileCompleted = !!(user.profileCompleted || user.phone)
  const admins = (process.env.adminOpenids || '').split(',').map(s => s.trim())
  return { ok: true, data: { _id: OPENID, ...user, profileCompleted, isAdmin: admins.includes(OPENID) } }
}
