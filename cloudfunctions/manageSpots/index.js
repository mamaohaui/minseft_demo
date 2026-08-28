// 云函数 manageSpots：管理员可视化数据管理
// 功能：公共基础库点位 列表/编辑/删除；用户发布点位 列表/状态管理/删除
// 权限：仅 adminOpenids 环境变量中的管理员可调用
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const PAGE_SIZE = 20
const STATUS = ['approved', 'pending', 'rejected']

// 基础库可编辑字段白名单（避免任意字段注入）
const BASE_FIELDS = ['title', 'category', 'timeSlot', 'positionReq', 'mgmtReq', 'feeType', 'feeAmount', 'notes']

function isAdmin(openid) {
  return (process.env.adminOpenids || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .includes(openid)
}

// 坐标校验：[-180,180] / [-90,90]
function validLng(v) { return typeof v === 'number' && v >= -180 && v <= 180 }
function validLat(v) { return typeof v === 'number' && v >= -90 && v <= 90 }

// 公共基础库：分页列表（按标题排序，稳定分页）
async function listBase(event) {
  const page = Math.max(0, parseInt(event.page) || 0)
  const res = await db.collection('spots')
    .where({ source: 'base' })
    .orderBy('title', 'asc')
    .skip(page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .get()
  const data = (res.data || []).map(normalizeSpot)
  return { ok: true, data, page, hasMore: data.length === PAGE_SIZE }
}

// 编辑基础库点位：白名单字段 + 坐标 GeoPoint
async function updateBase(event) {
  const id = (event.id || '').trim()
  if (!id) return { ok: false, code: 'INVALID', message: '缺少点位 ID' }
  const fields = event.fields || {}
  const patch = {}
  BASE_FIELDS.forEach(k => {
    if (fields[k] !== undefined && fields[k] !== null) {
      if (k === 'feeAmount') {
        const n = Number(fields[k])
        if (!isNaN(n) && n >= 0) patch[k] = n
      } else {
        patch[k] = String(fields[k]).trim()
      }
    }
  })
  // 坐标独立处理：必须成对传入
  if (fields.lng !== undefined || fields.lat !== undefined) {
    const lng = Number(fields.lng)
    const lat = Number(fields.lat)
    if (!validLng(lng) || !validLat(lat)) {
      return { ok: false, code: 'INVALID', message: '经纬度非法（经度 -180~180，纬度 -90~90）' }
    }
    patch.current = { location: db.Geo.Point(lng, lat) }
  }
  if (!Object.keys(patch).length) return { ok: false, code: 'INVALID', message: '没有可更新的字段' }
  patch.updatedAt = db.serverDate()

  await db.collection('spots').doc(id).update({ data: patch })
  return { ok: true, message: '已保存' }
}

// 删除点位（基础库或用户发布均可）
async function deleteSpotById(event) {
  const id = (event.id || '').trim()
  if (!id) return { ok: false, code: 'INVALID', message: '缺少点位 ID' }
  await db.collection('spots').doc(id).remove()
  return { ok: true, message: '已删除' }
}

// 用户发布点位：分页列表（可筛选状态）
async function listUser(event) {
  const page = Math.max(0, parseInt(event.page) || 0)
  const where = { source: _.neq('base') }
  if (STATUS.includes(event.status)) where.status = event.status
  const res = await db.collection('spots')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .get()
  const data = (res.data || []).map(normalizeSpot)
  return { ok: true, data, page, hasMore: data.length === PAGE_SIZE }
}

// 管理员改状态：通过/驳回/下架/恢复
async function setStatus(event) {
  const id = (event.id || '').trim()
  if (!id) return { ok: false, code: 'INVALID', message: '缺少点位 ID' }
  const status = (event.status || '').trim()
  if (!STATUS.includes(status)) return { ok: false, code: 'INVALID', message: '非法状态' }
  await db.collection('spots').doc(id).update({ data: { status, updatedAt: db.serverDate() } })
  return { ok: true, message: '已更新' }
}

// 输出归一化：把 GeoPoint 转成 lng/lat 数字，方便前端展示与回填
function normalizeSpot(s) {
  const o = { ...s }
  const loc = (s.current && s.current.location) || {}
  o.lng = typeof loc.coordinates === 'object' ? loc.coordinates[0] : null
  o.lat = typeof loc.coordinates === 'object' ? loc.coordinates[1] : null
  delete o.current
  return o
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!isAdmin(OPENID)) return { ok: false, code: 'NO_PERMISSION', message: '无管理员权限' }

  const action = (event.action || '').trim()
  try {
    switch (action) {
      case 'listBase': return await listBase(event)
      case 'updateBase': return await updateBase(event)
      case 'delete': return await deleteSpotById(event)
      case 'listUser': return await listUser(event)
      case 'setStatus': return await setStatus(event)
      default: return { ok: false, code: 'INVALID', message: '未知操作' }
    }
  } catch (e) {
    return { ok: false, code: 'ERROR', message: (e && e.message) || '操作失败' }
  }
}
