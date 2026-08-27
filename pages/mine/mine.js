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
    if (m.ok) this.setData({ mySpots: m.data.map(this.decorateSpot) })
  },

  // 派生状态标签与展示标题
  decorateSpot(s) {
    let status, statusText
    if (s.status === 'rejected') { status = 'rejected'; statusText = '已驳回' }
    else if (s.status === 'pending') { status = 'pending'; statusText = '待审核' }
    else if (s.hasPendingUpdate) { status = 'updating'; statusText = '修改待审' }
    else { status = 'approved'; statusText = '已公开' }
    const cur = s.current || s.pending || {}
    return { ...s, _status: status, _statusText: statusText, _title: cur.title || '未命名地点' }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  goSpot(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  goEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/publish/publish?id=${id}` })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },
})
