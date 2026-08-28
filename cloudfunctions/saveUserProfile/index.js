// 云函数 saveUserProfile：保存用户个人信息
// 字段：头像(avatarUrl)、昵称(nickname)、手机号(phone 必填+号段强校验)、是否有车辆、主要销售品类（后两者选填）
// 写入 users 集合（openid 为 _id），profileCompleted 标记个人信息已完善
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CATEGORIES = ['餐饮小吃', '水果生鲜', '服装服饰', '日用百货', '手工艺品', '儿童玩具', '其他']
// 手机号校验：1 开头 + 3-9 第二位（覆盖大陆全部号段），前端/云端双重校验防止绕过
const PHONE_RE = /^1[3-9]\d{9}$/

async function secCheck(content) {
  try {
    const r = await cloud.openapi.security.msgSecCheck({ content })
    if (r && r.result && r.result.suggest !== 'pass') return false
    return true
  } catch (e) {
    return true // 接口异常放行，不阻塞保存
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()

  const avatarUrl = (event.avatarUrl || '').trim()
  const nickname = (event.nickname || '').trim().slice(0, 20)
  const phone = (event.phone || '').trim()
  const hasVehicle = (event.hasVehicle || '').trim()
  const category = (event.category || '').trim()

  // 手机号必填 + 号段强校验
  if (!PHONE_RE.test(phone)) {
    return { ok: false, code: 'INVALID', message: '请输入正确的 11 位手机号' }
  }
  // 选填字段白名单校验
  if (hasVehicle && !['yes', 'no'].includes(hasVehicle)) {
    return { ok: false, code: 'INVALID', message: '车辆信息不正确' }
  }
  if (category && !CATEGORIES.includes(category)) {
    return { ok: false, code: 'INVALID', message: '销售品类不正确' }
  }

  // 昵称有值才检测（选填字段，属用户资料）
  if (nickname) {
    const safe = await secCheck(nickname)
    if (!safe) return { ok: false, code: 'RISKY', message: '内容包含违规信息，请修改后重试' }
  }

  const data = {
    phone,
    hasVehicle,
    category,
    profileCompleted: true,
    updatedAt: db.serverDate(),
  }
  if (avatarUrl) data.avatarUrl = avatarUrl
  if (nickname) data.nickname = nickname

  try {
    await db.collection('users').doc(OPENID).update({ data })
  } catch (e) {
    // users 建档通常由 getUser 完成；若为空兜底 set 创建
    await db.collection('users').doc(OPENID).set({
      data: {
        role: 'vip',
        vipExpireAt: null,
        avatarUrl: avatarUrl || '',
        nickname: nickname || '',
        name: nickname || '', // 兼容老字段：新用户昵称兜底给 name
        phone,
        hasVehicle,
        category,
        profileCompleted: true,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
  }

  // 昵称有值 → 回填该用户名下所有发布点的 creatorName（保持按发布者搜索/展示一致）
  if (nickname) {
    try {
      await db.collection('spots')
        .where({ creatorOpenid: OPENID })
        .update({ data: { creatorName: nickname, updatedAt: db.serverDate() } })
    } catch (e) {
      // 回填失败不影响资料保存本身
    }
  }

  return { ok: true, message: '资料已保存' }
}
