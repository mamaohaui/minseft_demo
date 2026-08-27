// utils/constants.js
const CATEGORIES = ['果蔬', '日杂', '小吃', '饮品', '服饰', '玩具', '其他']

const TIME_SLOTS = ['早市', '夜市', '全天', '其他']

const FEE_TYPES = ['免费', '收费']

// 搜索页「地点类型」筛选项：出摊时段 + 收费属性合并展示
const SPOT_TYPES = ['早市', '夜市', '全天', '免费', '收费']

const VISIBILITY = [
  { value: 'public', label: '公开（所有人可见，需审核）' },
  { value: 'vip', label: 'VIP 专属（仅 VIP 可见，需审核）' },
  { value: 'private', label: '私人（仅自己可见，免审核）' },
]

module.exports = { CATEGORIES, TIME_SLOTS, FEE_TYPES, SPOT_TYPES, VISIBILITY }
