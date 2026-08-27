// 云函数 addResource：发布一条资源拓展信息（货源/摊位转让/设备租赁/合伙招募等）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 允许的资源分类（前端 picker 同步维护）
const CATEGORIES = ['货源供应', '摊位转让', '设备租赁', '合伙招募', '政策资讯', '其他']

// UGC 文本安全检测：risky / review 拦截；接口异常时放行（不阻塞主流程，仅记录日志）
async function checkText(openid, text) {
  if (!text) return true
  try {
    const res = await cloud.openapi.security.msgSecCheck({
      version: 2,
      scene: 3, // 3 = 社区发布内容
      openid,
      content: String(text).slice(0, 2500),
    })
    const suggest = res && res.result && res.result.suggest
    if (suggest === 'risky' || suggest === 'review') return false
    return true
  } catch (e) {
    console.warn('msgSecCheck 跳过（接口异常）', e.errCode || e.message)
    return true
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()

  const title = (event.title || '').trim()
  const category = (event.category || '').trim()
  const content = (event.content || '').trim()
  const contact = (event.contact || '').trim()

  if (!title) return { ok: false, message: '请填写标题' }
  if (title.length > 30) return { ok: false, message: '标题不能超过 30 字' }
  if (!CATEGORIES.includes(category)) return { ok: false, message: '请选择分类' }
  if (!content) return { ok: false, message: '请填写详细说明' }
  if (content.length > 500) return { ok: false, message: '详细说明不能超过 500 字' }
  if (!contact) return { ok: false, message: '请填写联系方式' }
  if (contact.length > 50) return { ok: false, message: '联系方式过长' }

  // 内容安全：标题 + 详细说明 + 联系方式合并检测（一次调用）
  const textOk = await checkText(OPENID, [title, content, contact].join('|'))
  if (!textOk) {
    return { ok: false, code: 'CONTENT_RISKY', message: '内容包含违规信息，请修改后重试' }
  }

  const now = Date.now()
  const res = await db.collection('resources').add({
    data: {
      title,
      category,
      content,
      contact,
      creatorOpenid: OPENID,
      createdAt: now,
      updatedAt: now,
    },
  }).catch(err => {
    // 集合未创建（-502005）时给出明确指引，而不是笼统报错
    if (err && /not exist|COLLECTION_NOT_EXIST|-502005/i.test(err.errMsg || err.message || '')) {
      return { __missing: true }
    }
    throw err
  })

  if (res && res.__missing) {
    return { ok: false, code: 'COLLECTION_NOT_EXIST', message: '数据库集合 resources 不存在，请先到云开发控制台-数据库新建集合 resources' }
  }

  return { ok: true, data: { _id: res._id } }
}
