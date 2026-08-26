const { callCloud } = require('../../utils/cloud')

Page({
  data: { spot: null, reviews: [], favorited: false, isOwner: false },

  onLoad(options) {
    this.spotId = options.id
    this.load()
  },

  async load() {
    const r = await callCloud('getSpotDetail', { spotId: this.spotId })
    if (!r.ok) return
    const spot = r.data
    const cur = spot.current || {}
    const me = await callCloud('getUser')
    const isOwner = spot.creatorOpenid === me.data._id
    this.setData({ spot: { ...spot, cur }, isOwner })

    const rv = await callCloud('getReviews', { spotId: this.spotId })
    if (rv.ok) this.setData({ reviews: rv.data })
  },

  async toggleFav() {
    const r = await callCloud('toggleFavorite', { spotId: this.spotId })
    if (r.ok) this.setData({ favorited: r.data.favorited })
  },

  goEdit() {
    wx.navigateTo({ url: `/pages/publish/publish?id=${this.spotId}` })
  },

  async del() {
    const r = await callCloud('deleteSpot', { spotId: this.spotId })
    if (r.ok) {
      wx.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    }
  },
})
