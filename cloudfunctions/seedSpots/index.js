// 云函数 seedSpots：导入公开摆摊基础数据库（冷启动基础数据支持）
// 内置成都各区早市/夜市/农贸市场/水果批发市场/便民摊区点位，全部为 public + approved，直接上图
// 数据来源：成都城管发布、人民日报、本地生活媒体等公开报道整理（2025）
// 幂等：按标题查重，已存在的基础库点位自动跳过，可放心重复执行
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 基础库标记：与用户自发发布的点位区分
const BASE_CREATOR = 'base'
const BASE_NAME = '摆摊基础库'

// 成都基础摆摊点位（坐标为 GCJ-02 火星坐标近似值，管理员可在后台修正）
// 覆盖：早市/农贸市场（果蔬）、夜市（小吃）、批发市场（水果/食品/日杂）、政府划定便民摊区
const BASE_SPOTS = [
  // ===== 锦江区 =====
  { title: '青石桥农贸市场', category: '果蔬', timeSlot: '全天', positionReq: '临街摊位', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '摊位费约20-50元/天', lng: 104.0739, lat: 30.6536 },
  { title: '青石桥海鲜市场', category: '日杂', timeSlot: '全天', positionReq: '市场内档口', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '按档口计费', lng: 104.0740, lat: 30.6520 },
  { title: '三色路夜市', category: '小吃', timeSlot: '夜市', positionReq: '国华街沿街规划摊区', mgmtReq: '统一登记摊位，约17:00-22:00', feeType: '免费', feeAmount: '', lng: 104.0980, lat: 30.5900 },
  { title: '三圣街小吃街', category: '小吃', timeSlot: '夜市', positionReq: '沿街商铺门口外摆区', mgmtReq: '街道统一管理', feeType: '免费', feeAmount: '', lng: 104.0860, lat: 30.6460 },
  { title: '天涯石农贸市场', category: '果蔬', timeSlot: '早市', positionReq: '市场周边临街', mgmtReq: '市场方统一管理', feeType: '免费', feeAmount: '', lng: 104.0860, lat: 30.6550 },

  // ===== 青羊区 =====
  { title: '青羊小区综合市场', category: '果蔬', timeSlot: '早市', positionReq: '市场周边临街', mgmtReq: '早市散摊需在收市前撤摊', feeType: '免费', feeAmount: '', lng: 104.0290, lat: 30.6680 },
  { title: '奎星楼街美食街', category: '小吃', timeSlot: '夜市', positionReq: '沿街商铺外摆', mgmtReq: '街道统一管理', feeType: '免费', feeAmount: '', lng: 104.0550, lat: 30.6670 },
  { title: '夜猫子夜市（新城市广场）', category: '小吃', timeSlot: '夜市', positionReq: '广场中庭规划摊区，100+摊位', mgmtReq: '商场统一登记摊位，16:00-22:00', feeType: '收费', feeAmount: '摊位费按摊位计', lng: 104.0560, lat: 30.6630 },
  { title: '光华村夜市（财大旁）', category: '小吃', timeSlot: '夜市', positionReq: '西南财大周边沿街', mgmtReq: '限时晚市经营', feeType: '免费', feeAmount: '', lng: 104.0130, lat: 30.6630 },
  { title: '草市街便民疏导点', category: '果蔬', timeSlot: '全天', positionReq: '青羊区划定临时摊区（全区共10处、510余摊位）', mgmtReq: '两证一承诺：身份证+健康证+经营承诺书', feeType: '免费', feeAmount: '免租金，提供货架', lng: 104.0660, lat: 30.6730 },

  // ===== 金牛区 =====
  { title: '荷花池综合批发市场', category: '日杂', timeSlot: '全天', positionReq: '批发档口为主，散摊较少', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '按档口计费', lng: 104.0517, lat: 30.7015 },
  { title: '沙西线水果批发市场', category: '果蔬', timeSlot: '全天', positionReq: '市区最大水果批发市场，按箱批发', mgmtReq: '市场方统一管理（西华大道595号）', feeType: '收费', feeAmount: '按档口计费', lng: 103.9820, lat: 30.7330 },
  { title: '王贾桥农贸早市', category: '果蔬', timeSlot: '早市', positionReq: '沿街划线摊位', mgmtReq: '城管划线管理，7:30前须撤摊', feeType: '免费', feeAmount: '', lng: 104.0750, lat: 30.7145 },
  { title: '金牛坝菜市早市', category: '果蔬', timeSlot: '早市', positionReq: '菜市场周边人行道', mgmtReq: '限时早市，8:00前撤摊', feeType: '免费', feeAmount: '', lng: 104.0200, lat: 30.6950 },
  { title: '抚琴夜市', category: '小吃', timeSlot: '夜市', positionReq: '老巷子夜市，周边有抚琴综合市场', mgmtReq: '限时晚市经营', feeType: '免费', feeAmount: '', lng: 104.0300, lat: 30.6870 },
  { title: '交桂巷小吃街', category: '小吃', timeSlot: '夜市', positionReq: '居民区沿街餐饮', mgmtReq: '街道统一管理', feeType: '免费', feeAmount: '', lng: 104.0480, lat: 30.7030 },
  { title: '星耀天都夜市（驷马桥）', category: '小吃', timeSlot: '夜市', positionReq: '广场规划摊区，烧烤/大排档为主', mgmtReq: '商场统一登记摊位', feeType: '收费', feeAmount: '摊位费按摊位计', lng: 104.0730, lat: 30.7180 },

  // ===== 武侯区 =====
  { title: '双楠农贸市场', category: '果蔬', timeSlot: '早市', positionReq: '市场门口两侧', mgmtReq: '市场方统一管理', feeType: '免费', feeAmount: '', lng: 104.0260, lat: 30.6410 },
  { title: '肖家河综合市场', category: '日杂', timeSlot: '早市', positionReq: '市场内部及周边', mgmtReq: '市场方统一管理', feeType: '免费', feeAmount: '', lng: 104.0430, lat: 30.6210 },
  { title: '玉林生活广场夜市', category: '小吃', timeSlot: '夜市', positionReq: '广场及周边沿街，多家24小时经营', mgmtReq: '物业统一管理', feeType: '免费', feeAmount: '', lng: 104.0620, lat: 30.6180 },
  { title: '致民路十一街夜市', category: '小吃', timeSlot: '夜市', positionReq: '老成都风格沿街餐饮', mgmtReq: '街道统一管理', feeType: '免费', feeAmount: '', lng: 104.0800, lat: 30.6420 },

  // ===== 成华区 =====
  { title: '建设路夜市', category: '小吃', timeSlot: '夜市', positionReq: '沿街商铺门口外摆区（建设巷12号）', mgmtReq: '街道统一规划外摆线', feeType: '免费', feeAmount: '', lng: 104.1086, lat: 30.6905 },
  { title: '香香巷·望平街夜市', category: '小吃', timeSlot: '夜市', positionReq: '川西民居风格窄巷沿街，17:00-22:00', mgmtReq: '街道统一管理', feeType: '免费', feeAmount: '', lng: 104.0950, lat: 30.6620 },
  { title: '理工大学东苑夜市', category: '小吃', timeSlot: '夜市', positionReq: '校门周边沿街', mgmtReq: '晚市限时经营', feeType: '免费', feeAmount: '', lng: 104.1500, lat: 30.7108 },

  // ===== 高新区 =====
  { title: '大源夜市（大源北二街）', category: '小吃', timeSlot: '夜市', positionReq: '大源北二街农贸市场周边沿街', mgmtReq: '市场方+街道共管', feeType: '免费', feeAmount: '', lng: 104.0610, lat: 30.5460 },
  { title: '时代天街夜市（合作路）', category: '小吃', timeSlot: '夜市', positionReq: '龙湖时代天街商圈外摆区，经营至凌晨', mgmtReq: '商场统一登记摊位', feeType: '收费', feeAmount: '摊位费按摊位计', lng: 104.0100, lat: 30.5800 },

  // ===== 龙泉驿区 =====
  { title: '龙泉驿音乐广场夜市', category: '小吃', timeSlot: '夜市', positionReq: '广场规划摊区', mgmtReq: '统一登记摊位', feeType: '收费', feeAmount: '摊位费约20-50元/晚', lng: 104.2740, lat: 30.5560 },
  { title: '聚和国际果蔬交易中心', category: '果蔬', timeSlot: '全天', positionReq: '本地时令水果批发，支持散采混采（龙都北路773号）', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '按档口计费', lng: 104.2760, lat: 30.5580 },

  // ===== 温江区 =====
  { title: '温江大学城夜市', category: '小吃', timeSlot: '夜市', positionReq: '大学城商业街沿街', mgmtReq: '物业划线管理', feeType: '免费', feeAmount: '', lng: 103.8360, lat: 30.6810 },
  { title: '柳浪湾夜市（杨柳河站）', category: '小吃', timeSlot: '夜市', positionReq: '地铁杨柳河站周边沿街，16:00-23:00', mgmtReq: '街道统一管理', feeType: '免费', feeAmount: '', lng: 103.8430, lat: 30.6910 },

  // ===== 郫都区 =====
  { title: '犀浦夜市', category: '小吃', timeSlot: '夜市', positionReq: '夜市划线摊位（浦兴街，16:00-23:00）', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '摊位费约30-80元/晚', lng: 104.0326, lat: 30.7604 },
  { title: '郫都百伦广场夜市', category: '服饰', timeSlot: '夜市', positionReq: '广场规划摊区', mgmtReq: '商场统一登记摊位', feeType: '收费', feeAmount: '摊位费约50-100元/晚', lng: 103.9020, lat: 30.8080 },
  { title: '团结夜市（四川科技学院旁）', category: '小吃', timeSlot: '夜市', positionReq: '大学周边沿街，价格亲民', mgmtReq: '街道统一管理', feeType: '免费', feeAmount: '', lng: 103.9100, lat: 30.8680 },

  // ===== 双流区 =====
  { title: '双流棠湖公园周边早市', category: '果蔬', timeSlot: '早市', positionReq: '公园周边人行道', mgmtReq: '限时早市，8:00前撤摊', feeType: '免费', feeAmount: '', lng: 103.9230, lat: 30.5740 },
  { title: '白家农产品中心批发市场', category: '果蔬', timeSlot: '全天', positionReq: '成都最大农贸批发市场（成白路98号），果蔬/水产/肉类分区', mgmtReq: '市场方统一管理，凌晨开市批发、日间小额补货', feeType: '收费', feeAmount: '按档口计费', lng: 104.0200, lat: 30.5300 },
  { title: '华丰食品批发市场', category: '日杂', timeSlot: '全天', positionReq: '副食/干果/糖果/干杂/酒水批发（白家川大东延线）', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '按档口计费', lng: 104.0300, lat: 30.5350 },
  { title: '金太阳国际食品城', category: '日杂', timeSlot: '全天', positionReq: '零食糖果批发（草金路西延线）', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '按档口计费', lng: 103.9900, lat: 30.5620 },
  { title: '双流好市·龙桥集（时代奥莱）', category: '小吃', timeSlot: '夜市', positionReq: '龙桥路奥莱商圈蓝线规划摊区，30余家商户', mgmtReq: '统一登记摊位+记分管理，宵夜摊定点经营', feeType: '免费', feeAmount: '', lng: 104.0380, lat: 30.5110 },
  { title: '黄水镇玉和街便民市场', category: '果蔬', timeSlot: '早市', positionReq: '双流好市便民疏导点', mgmtReq: '镇街统一登记摊位', feeType: '免费', feeAmount: '', lng: 103.8940, lat: 30.5060 },
  { title: '彭镇金桥广场便民市集', category: '果蔬', timeSlot: '早市', positionReq: '双流好市便民疏导点', mgmtReq: '镇街统一登记摊位', feeType: '免费', feeAmount: '', lng: 103.8720, lat: 30.5460 },
  { title: '华阳伏龙小区夜市', category: '日杂', timeSlot: '夜市', positionReq: '小区周边沿街', mgmtReq: '社区统一管理', feeType: '免费', feeAmount: '', lng: 104.0650, lat: 30.5110 },

  // ===== 新都区 =====
  { title: '新都宝光寺周边集市', category: '日杂', timeSlot: '全天', positionReq: '景区周边规划摊区', mgmtReq: '街道统一管理', feeType: '免费', feeAmount: '', lng: 104.1550, lat: 30.8230 },
  { title: '三河场夜市', category: '小吃', timeSlot: '夜市', positionReq: '地铁三河场站周边沿街', mgmtReq: '街道统一管理', feeType: '免费', feeAmount: '', lng: 104.1300, lat: 30.8380 },
  { title: '长德新世贸食品城', category: '日杂', timeSlot: '全天', positionReq: '干货/粮油/零食/冻品批发为主', mgmtReq: '市场方统一管理', feeType: '收费', feeAmount: '按档口计费', lng: 104.1350, lat: 30.8870 },
]

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()

  // 仅管理员可导入基础数据
  const admins = (process.env.adminOpenids || '').split(',').map(s => s.trim())
  if (!admins.includes(OPENID)) {
    return { ok: false, code: 'FORBIDDEN', message: '仅管理员可导入基础数据' }
  }

  // 幂等：查出基础库已有的标题，重复的跳过（分页拉全量，突破单次100条限制）
  let existTitles = []
  try {
    const PAGE = 100
    for (let skip = 0; ; skip += PAGE) {
      const res = await db.collection('spots')
        .where({ creatorOpenid: BASE_CREATOR })
        .field({ 'current.title': true })
        .skip(skip)
        .limit(PAGE)
        .get()
      existTitles = existTitles.concat((res.data || []).map(s => s.current && s.current.title))
      if (!res.data || res.data.length < PAGE) break
    }
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
