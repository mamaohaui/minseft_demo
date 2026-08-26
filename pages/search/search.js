const { callCloud } = require('../../utils/cloud')

Page({
  data: { keyword: '', results: [] },

  onInput(e) { this.setData({ keyword: e.detail.value }) },

  async doSearch() {
    const kw = this.data.keyword.trim()
    if (!kw) return wx.showToast({ title: '请输入关键词', icon: 'none' })
    const r = await callCloud('searchSpots', { keyword: kw })
    if (r.ok) this.setData({ results: r.data })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },
})
