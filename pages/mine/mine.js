const { callCloud } = require('../../utils/cloud')

Page({
  data: { user: null, favorites: [], mySpots: [] },

  onShow() { this.load() },

  async load() {
    // 三个请求并行发出（原来串行要 1-2 秒，现在约等于最慢那一个）
    const [u, f, m] = await Promise.all([
      callCloud('getUser'),
      callCloud('getFavorites'),
      callCloud('getMySpots'),
    ])
    this.setData({
      user: u.ok ? u.data : this.data.user,
      favorites: f.ok ? f.data : this.data.favorites,
      mySpots: m.ok ? m.data : this.data.mySpots,
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  // 我的发布：独立管理页（查看/编辑/删除）
  goMySpots() {
    wx.navigateTo({ url: '/pages/mySpots/mySpots' })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },
})
