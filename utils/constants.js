// utils/constants.js
const CATEGORIES = ['食品', '小吃', '日用品', '服装', '农产品', '其他']

const TIME_SLOTS = ['早市', '夜市', '全天', '其他']

const FEE_TYPES = ['免费', '收费']

const VISIBILITY = [
  { value: 'public', label: '公开（所有人可见，需审核）' },
  { value: 'vip', label: 'VIP 专属（仅 VIP 可见，需审核）' },
  { value: 'private', label: '私人（仅自己可见，免审核）' },
]

module.exports = { CATEGORIES, TIME_SLOTS, FEE_TYPES, VISIBILITY }
