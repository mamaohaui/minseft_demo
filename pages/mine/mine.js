const { callCloud } = require('../../utils/cloud')

Page({
  data: { user: null, favorites: [], mySpots: [], offlineCount: 0, importing: false },

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
    this.setData({
      user: u.ok ? u.data : this.data.user,
      favorites: f.ok ? f.data : this.data.favorites,
      mySpots: m.ok ? m.data : this.data.mySpots,
      offlineCount: Object.keys(pkgs).length,
    })
  },

  // 我的发布：独立管理页（查看/编辑/删除）
  goMySpots() {
    wx.navigateTo({ url: '/pages/mySpots/mySpots' })
  },

  // 我的收藏：独立管理页（查看/取消收藏）
  goFavorites() {
    wx.navigateTo({ url: '/pages/favorites/favorites' })
  },

  // 公共数据下载：按省/市/县下载离线数据包
  goDataDownload() {
    wx.navigateTo({ url: '/pages/dataDownload/dataDownload' })
  },

  // 导入公开摆摊基础数据库（seedSpots 幂等，重复执行只补新增；云端校验管理员身份）
  async importBase() {
    if (this.data.importing) return
    this.setData({ importing: true })
    const r = await callCloud('seedSpots')
    this.setData({ importing: false })
    if (r.ok) {
      const d = r.data || {}
      wx.showToast({
        title: `新增${d.added || 0}条，已存在${d.skipped || 0}条`,
        icon: 'none',
        duration: 2500,
      })
    }
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  // 设置发布者昵称（保存后同步回填到自己所有历史发布，供"按发布者"搜索）
  editNickname() {
    const current = (this.data.user && this.data.user.nickname) || ''
    wx.showModal({
      title: '设置昵称',
      editable: true,
      placeholderText: '用于发布地点时展示、被搜索（20 字内）',
      content: current,
      success: async (res) => {
        if (!res.confirm) return
        const nickname = (res.content || '').trim()
        if (!nickname) return wx.showToast({ title: '昵称不能为空', icon: 'none' })
        const r = await callCloud('setNickname', { nickname })
        if (r.ok) {
          wx.showToast({ title: '已保存', icon: 'success' })
          this.setData({ 'user.nickname': nickname })
        }
      },
    })
  },
})
