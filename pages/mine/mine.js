const { callCloud } = require('../../utils/cloud')

Page({
  data: { user: null, favorites: [], mySpots: [], offlineCount: 0, profileCompleted: true, displayName: '游客', avatarChar: '摊', roleText: '身份加载中…' },

  onShow() { this.load() },

  async load() {
    // 三个请求并行发出（原来串行要 1-2 秒，现在约等于最慢那一个）
    const [u, f, m] = await Promise.all([
      callCloud('getUser'),
      callCloud('getFavorites'),
      callCloud('getMySpots'),
    ])
    // 已下载离线数据包数量（本地 storage，无需云端请求）
    const pkgs = wx.getStorageSync('offlineRegionPackages') || {}
    const user = u.ok ? u.data : this.data.user
    const profileCompleted = u.ok ? !!user.profileCompleted : this.data.profileCompleted
    // 昵称行显示：未注册 → 游客；已注册 → 昵称（未设置则显示姓名）
    const displayName = profileCompleted ? (user.nickname || user.name || '摊友') : '游客'
    let roleText = '完善个人信息后可发布、收藏、关注'
    if (profileCompleted) {
      roleText = user.isAdmin ? '管理员 · 昵称用于发布展示' : '昵称用于发布展示与被搜索'
    }
    this.setData({
      user,
      favorites: f.ok ? f.data : this.data.favorites,
      mySpots: m.ok ? m.data : this.data.mySpots,
      offlineCount: Object.keys(pkgs).length,
      profileCompleted,
      displayName,
      avatarChar: displayName === '游客' ? '摊' : displayName.charAt(0),
      roleText,
    })
  },

  // 个人信息（姓名/手机号/车辆/品类）：未完成时高亮引导，已完成可查看编辑
  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' })
  },

  // 我的发布：独立管理页（查看/编辑/删除）
  goMySpots() {
    wx.navigateTo({ url: '/pages/mySpots/mySpots' })
  },

  // 我的收藏：独立管理页（查看/取消收藏）
  goFavorites() {
    wx.navigateTo({ url: '/pages/favorites/favorites' })
  },

  // 公共数据下载：按省/市/县下载离线数据包（公共摆摊基础数据库的导入/更新也已并入该页）
  goDataDownload() {
    wx.navigateTo({ url: '/pages/dataDownload/dataDownload' })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  // 数据管理：管理员可视化编辑云端点位
  goDataManage() {
    wx.navigateTo({ url: '/pages/dataManage/dataManage' })
  },
})
