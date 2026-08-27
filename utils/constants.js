// utils/constants.js
const CATEGORIES = ['果蔬', '日杂', '小吃', '饮品', '服饰', '玩具', '其他']

const TIME_SLOTS = ['早市', '夜市', '全天', '其他']

const FEE_TYPES = ['免费', '收费']

// 搜索页「地点类型」筛选项：出摊时段 + 收费属性合并展示
const SPOT_TYPES = ['早市', '夜市', '全天', '免费', '收费']

// 地图页地区选择器：选区后以该地区中心点加载周边摊点（公共摊点基础显示入口）
const REGIONS = [
  { name: '成都市中心', lat: 30.6622, lng: 104.0656 },
  { name: '锦江区', lat: 30.6561, lng: 104.0831 },
  { name: '青羊区', lat: 30.6723, lng: 104.0622 },
  { name: '金牛区', lat: 30.6958, lng: 104.0521 },
  { name: '武侯区', lat: 30.6301, lng: 104.0433 },
  { name: '成华区', lat: 30.6719, lng: 104.1082 },
  { name: '高新区', lat: 30.5727, lng: 104.0621 },
  { name: '龙泉驿区', lat: 30.5566, lng: 104.2745 },
  { name: '温江区', lat: 30.6821, lng: 103.8565 },
  { name: '郫都区', lat: 30.8121, lng: 103.9011 },
  { name: '双流区', lat: 30.5744, lng: 103.9237 },
  { name: '新都区', lat: 30.8235, lng: 104.1588 },
]

const VISIBILITY = [
  { value: 'public', label: '公开（所有人可见，需审核）' },
  { value: 'vip', label: 'VIP 专属（仅 VIP 可见，需审核）' },
  { value: 'private', label: '私人（仅自己可见，免审核）' },
]

module.exports = { CATEGORIES, TIME_SLOTS, FEE_TYPES, SPOT_TYPES, VISIBILITY, REGIONS }
