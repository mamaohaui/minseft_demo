const { callCloud } = require('../../utils/cloud')

Page({
  data: { list: [] },

  onShow() { this.load() },

  async load() {
    const r = await callCloud('adminList')
    if (r.ok) this.setData({ list: r.data })
  },

  async review(e) {
    const { id, action } = e.currentTarget.dataset
    let reason = ''
    if (action === 'reject') {
      reason = '不符合要求'
    }
    const r = await callCloud('reviewSpot', { spotId: id, action, reason })
    if (r.ok) {
      wx.showToast({ title: '已处理', icon: 'success' })
      this.load()
    }
  },
})
