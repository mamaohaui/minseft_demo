// 云函数 saveUserProfile：保存用户个人信息（姓名/电话/车辆/品类）
// 字段：姓名、电话、是否有车辆、主要销售品类
// 写入 users 集合（openid 为 _id），profileCompleted 标记个人信息已完善
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CATEGORIES = ['餐饮小吃', '水果生鲜', '服装服饰', '日用百货', '手工艺品', '儿童玩具', '其他']

async function secCheck(content) {
  try {
    const r = await cloud.openapi.security.msgSecCheck({ content })
    if (r && r.result && r.result.suggest !== 'pass') return false
    return true
  } catch (e) {
    return true // 接口异常放行，不阻塞注册
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()

  const name = (event.name || '').trim()
  const phone = (event.phone || '').trim()
  const hasVehicle = (event.hasVehicle || '').trim()
  const category = (event.category || '').trim()

  // 必填与格式校验
  if (!name) return { ok: false, code: 'INVALID', message: '请填写姓名' }
  if (name.length > 20) return { ok: false, code: 'INVALID', message: '姓名不能超过 20 字' }
  if (!/^1\d{10}$/.test(phone)) return { ok: false, code: 'INVALID', message: '请输入 11 位手机号' }
  if (!['yes', 'no'].includes(hasVehicle)) return { ok: false, code: 'INVALID', message: '请选择是否有车辆' }
  if (!CATEGORIES.includes(category)) return { ok: false, code: 'INVALID', message: '请选择主要销售品类' }

  // 内容安全：姓名检测
  const safe = await secCheck(name)
  if (!safe) return { ok: false, code: 'RISKY', message: '内容包含违规信息，请修改后重试' }

  try {
    await db.collection('users').doc(OPENID).update({
      data: {
        name,
        phone,
        hasVehicle,
        category,
        profileCompleted: true,
        updatedAt: db.serverDate(),
      },
    })
  } catch (e) {
    // users 建档通常由 getUser 完成；若为空兜底 set 创建
    await db.collection('users').doc(OPENID).set({
      data: {
        role: 'vip',
        vipExpireAt: null,
        nickname: '',
        avatar: '',
        name,
        phone,
        hasVehicle,
        category,
        profileCompleted: true,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
  }

  return { ok: true, message: '资料已保存' }
}
