// 云函数 addResource：发布一条资源拓展信息（货源/摊位转让/设备租赁/合伙招募等）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 允许的资源分类（前端 picker 同步维护）
const CATEGORIES = ['货源供应', '摊位转让', '设备租赁', '合伙招募', '政策资讯', '其他']

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
  })

  return { ok: true, data: { _id: res._id } }
}
