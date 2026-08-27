// 云函数 searchSpots：关键词 + 品类 + 地点类型 + 发布者 多条件组合搜索
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 地点类型 → 字段映射：收费属性查 feeType，其余查出摊时段
const FEE_VALUES = ['免费', '收费']

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const kw = (event.keyword || '').trim()
  const creator = (event.creator || '').trim()
  const { category, spotType } = event

  // 至少一个筛选条件
  if (!kw && !creator && !category && !spotType) {
    return { ok: false, code: 'INVALID', message: '请至少输入一个搜索条件' }
  }

  let role = 'normal'
  try {
    const u = await db.collection('users').doc(OPENID).get()
    role = u.data.role
  } catch (e) {}

  const visCond = role === 'vip' ? _.in(['public', 'vip']) : 'public'
  // 转义正则特殊字符，防止用户输入 ( [ \ 等导致查询报错，按字面量匹配
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // 组合 AND 条件（visibility 始终参与）
  const cond = { visibility: visCond }
  if (category) cond['current.category'] = category
  if (spotType) {
    if (FEE_VALUES.includes(spotType)) cond['current.feeType'] = spotType
    else cond['current.timeSlot'] = spotType
  }
  if (creator) cond.creatorName = db.RegExp({ regexp: escapeRegExp(creator), options: 'i' })

  // 有关键词时：标题 OR 品类匹配（与其余条件 AND）
  let where = cond
  if (kw) {
    const reg = db.RegExp({ regexp: escapeRegExp(kw), options: 'i' })
    where = _.or([
      { ...cond, 'current.title': reg },
      { ...cond, 'current.category': reg },
    ])
  }

  const res = await db.collection('spots').where(where).limit(50).get()

  // 坐标归一化：兼容 GeoJSON {coordinates} / GeoPoint {longitude,latitude} / 已是 {lng,lat}
  const toLngLat = (p) => {
    if (!p) return p
    if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) return { lng: p.coordinates[0], lat: p.coordinates[1] }
    if (typeof p.longitude === 'number' && typeof p.latitude === 'number') return { lng: p.longitude, lat: p.latitude }
    return p
  }
  const list = res.data.map(s => {
    if (s.current && s.current.location) s.current.location = toLngLat(s.current.location)
    if (s.pending && s.pending.location) s.pending.location = toLngLat(s.pending.location)
    return s
  })

  return { ok: true, data: list }
}
