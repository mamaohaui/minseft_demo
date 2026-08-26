const { callCloud } = require('../../utils/cloud')

Page({
  data: {
    latitude: 30.657,
    longitude: 104.081,
    markers: [],
    spots: [],
  },

  onLoad() {
    this.getLocation()
  },

  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({ latitude: res.latitude, longitude: res.longitude })
        this.loadNearby(res.longitude, res.latitude)
      },
      fail: () => {
        wx.showToast({ title: '定位失败，显示默认位置', icon: 'none' })
        this.loadNearby(104.081, 30.657)
      },
    })
  },

  async loadNearby(lng, lat) {
    const r = await callCloud('getSpotsNearby', { lng, lat, maxDistance: 5000 })
    if (!r.ok) return
    const spots = r.data
    const markers = spots.map((s, i) => ({
      id: i,
      latitude: s.current.location.lat,
      longitude: s.current.location.lng,
      title: s.current.title,
    }))
    this.setData({ spots, markers })
  },

  onMarkerTap(e) {
    const spot = this.data.spots[e.markerId]
    if (spot) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${spot._id}` })
    }
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' })
  },
})
