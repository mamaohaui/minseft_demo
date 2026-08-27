// 云函数 setNickname：设置当前用户昵称，并回填其所有历史发布的 creatorName
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const nickname = (event.nickname || '').trim().slice(0, 20)
  if (!nickname) return { ok: false, code: 'INVALID', message: '昵称不能为空' }

  const users = db.collection('users')
  // 档案可能尚未建档：update 失败则按 getUser 的默认结构建档
  try {
    await users.doc(OPENID).update({ data: { nickname, updatedAt: db.serverDate() } })
  } catch (e) {
    await users.doc(OPENID).set({
      data: {
        role: 'vip',
        vipExpireAt: null,
        nickname,
        avatar: '',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
  }

  // 回填：该用户名下所有地点（含 pending/current）统一刷新发布者昵称，保证按发布者搜索一致
  try {
    await db.collection('spots')
      .where({ creatorOpenid: OPENID })
      .update({ data: { creatorName: nickname, updatedAt: db.serverDate() } })
  } catch (e) {
    // 回填失败不影响昵称保存本身
  }

  return { ok: true, data: { nickname } }
}
