// 云函数 seedSpots：导入公开摆摊基础数据库（冷启动基础数据支持）
// 内置成都主要早市/夜市/农贸市场点位，全部为 public + approved，直接上图
// 幂等：按标题查重，已存在的基础库点位自动跳过，可放心重复执行
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 基础库标记：与用户自发发布的点位区分
const BASE_CREATOR = 'base'
const BASE_NAME = '摆摊基础库'

// 成都基础摆摊点位（坐标为 GCJ-02 火星坐标近似值，管理员可在后台修正）
const BASE_SPOTS = [
  { title: '荷花池综合批发市场', category: '日杂', timeSlot: '全天', positionReq: '批发档口为主，散摊较少', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '按档口计费', lng: 104.0517, lat: 30.7015 },
  { title: '青石桥农贸市场', category: '果蔬', timeSlot: '全天', positionReq: '临街摊位', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '摊位费约20-50元/天', lng: 104.0739, lat: 30.6536 },
  { title: '青羊小区综合市场', category: '果蔬', timeSlot: '早市', positionReq: '市场周边临街', mgmtReq: '早市散摊需在收市前撤摊', feeType: '免费', feeAmount: '', lng: 104.0290, lat: 30.6680 },
  { title: '王贾桥农贸早市', category: '果蔬', timeSlot: '早市', positionReq: '沿街划线摊位', mgmtReq: '城管划线管理，7:30前须撤摊', feeType: '免费', feeAmount: '', lng: 104.0750, lat: 30.7145 },
  { title: '双楠农贸市场', category: '果蔬', timeSlot: '早市', positionReq: '市场门口两侧', mgmtReq: '市场方统一管理', feeType: '免费', feeAmount: '', lng: 104.0260, lat: 30.6410 },
  { title: '肖家河综合市场', category: '日杂', timeSlot: '早市', positionReq: '市场内部及周边', mgmtReq: '市场方统一管理', feeType: '免费', feeAmount: '', lng: 104.0430, lat: 30.6210 },
  { title: '金牛坝菜市早市', category: '果蔬', timeSlot: '早市', positionReq: '菜市场周边人行道', mgmtReq: '限时早市，8:00前撤摊', feeType: '免费', feeAmount: '', lng: 104.0200, lat: 30.6950 },
  { title: '建设路夜市', category: '小吃', timeSlot: '夜市', positionReq: '沿街商铺门口外摆区', mgmtReq: '街道统一规划外摆线', feeType: '免费', feeAmount: '', lng: 104.1086, lat: 30.6905 },
  { title: '理工大学东苑夜市', category: '小吃', timeSlot: '夜市', positionReq: '校门周边沿街', mgmtReq: '晚市限时经营', feeType: '免费', feeAmount: '', lng: 104.1500, lat: 30.7108 },
  { title: '犀浦夜市', category: '小吃', timeSlot: '夜市', positionReq: '夜市划线摊位', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '摊位费约30-80元/晚', lng: 104.0326, lat: 30.7604 },
  { title: '温江大学城夜市', category: '小吃', timeSlot: '夜市', positionReq: '大学城商业街沿街', mgmtReq: '物业划线管理', feeType: '免费', feeAmount: '', lng: 103.8360, lat: 30.6810 },
  { title: '龙泉驿音乐广场夜市', category: '小吃', timeSlot: '夜市', positionReq: '广场规划摊区', mgmtReq: '统一登记摊位', feeType: '收费', feeAmount: '摊位费约20-50元/晚', lng: 104.2740, lat: 30.5560 },
  { title: '华阳伏龙小区夜市', category: '日杂', timeSlot: '夜市', positionReq: '小区周边沿街', mgmtReq: '社区统一管理', feeType: '免费', feeAmount: '', lng: 104.0650, lat: 30.5110 },
  { title: '郫都百伦广场夜市', category: '服饰', timeSlot: '夜市', positionReq: '广场规划摊区', mgmtReq: '商场统一登记摊位', feeType: '收费', feeAmount: '摊位费约50-100元/晚', lng: 103.9020, lat: 30.8080 },
  { title: '双流棠湖公园周边早市', category: '果蔬', timeSlot: '早市', positionReq: '公园周边人行道', mgmtReq: '限时早市，8:00前撤摊', feeType: '免费', feeAmount: '', lng: 103.9230, lat: 30.5740 },
  { title: '新都宝光寺周边集市', category: '日杂', timeSlot: '全天', positionReq: '景区周边规划摊区', mgmtReq: '街道统一管理', feeType: '免费', feeAmount: '', lng: 104.1550, lat: 30.8230 },
]

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()

  // 仅管理员可导入基础数据
  const admins = (process.env.adminOpenids || '').split(',').map(s => s.trim())
  if (!admins.includes(OPENID)) {
    return { ok: false, code: 'FORBIDDEN', message: '仅管理员可导入基础数据' }
  }

  // 幂等：查出基础库已有的标题，重复的跳过
  let existTitles = []
  try {
    const exist = await db.collection('spots')
      .where({ creatorOpenid: BASE_CREATOR })
      .field({ 'current.title': true })
      .limit(100)
      .get()
    existTitles = (exist.data || []).map(s => s.current && s.current.title)
  } catch (e) {
    // spots 集合必然存在（发布流程已建），此处仅防御
  }

  let added = 0
  let skipped = 0
  for (const s of BASE_SPOTS) {
    if (existTitles.includes(s.title)) { skipped++; continue }
    const content = {
      title: s.title,
      category: s.category,
      timeSlot: s.timeSlot,
      positionReq: s.positionReq,
      mgmtReq: s.mgmtReq,
      feeType: s.feeType,
      feeAmount: s.feeAmount,
      location: db.Geo.Point(s.lng, s.lat), // 必须用 GeoPoint，匹配 current.location 地理索引
    }
    await db.collection('spots').add({
      data: {
        creatorOpenid: BASE_CREATOR,
        creatorName: BASE_NAME,
        source: 'base',          // 基础库标记（用户发布无此字段）
        visibility: 'public',
        status: 'approved',      // 基础数据免审，直接生效
        current: content,
        pending: null,
        hasPendingUpdate: false,
        rejectReason: null,
        ratingAvg: 0,
        ratingCount: 0,
        tagCounts: {},
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
    added++
  }

  return { ok: true, data: { total: BASE_SPOTS.length, added, skipped } }
}
