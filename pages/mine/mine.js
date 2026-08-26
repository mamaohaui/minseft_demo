const { callCloud } = require('../../utils/cloud')

Page({
  data: { user: null, favorites: [] },

  onShow() { this.load() },

  async load() {
    const u = await callCloud('getUser')
    if (u.ok) this.setData({ user: u.data })
    const f = await callCloud('getFavorites')
    if (f.ok) this.setData({ favorites: f.data })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },
})
