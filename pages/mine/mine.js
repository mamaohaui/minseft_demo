const { callCloud } = require('../../utils/cloud')

Page({
  data: { user: null, favorites: [], mySpots: [] },

  onShow() { this.load() },

  async load() {
    const u = await callCloud('getUser')
    if (u.ok) this.setData({ user: u.data })
    const f = await callCloud('getFavorites')
    if (f.ok) this.setData({ favorites: f.data })
    const m = await callCloud('getMySpots')
    if (m.ok) this.setData({ mySpots: m.data })
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
