const { callCloud } = require('../../utils/cloud')

Page({
  data: { favorites: [], loading: true },

  onShow() { this.load() },

  async load() {
    this.setData({ loading: true })
    const r = await callCloud('getFavorites')
    const list = r.ok ? r.data.map(this.decorate) : []
    this.setData({ loading: false, favorites: list })
  },

  // 展示标题 + 坐标本地兜底归一化（GeoJSON / GeoPoint / {lng,lat}）
  decorate(s) {
    const cur = s.current || {}
    if (cur.location) {
      const p = cur.location
      if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
        cur.location = { lng: p.coordinates[0], lat: p.coordinates[1] }
      } else if (typeof p.latitude === 'number' && typeof p.longitude === 'number') {
        cur.location = { lng: p.longitude, lat: p.latitude }
      }
    }
    return { ...s, _title: cur.title || '（待公开）', _sub: cur.category || '—' }
  },

  // 查看：跳转到地图页，居中并显示该摊点标志
  viewOnMap(e) {
    const id = e.currentTarget.dataset.id
    const spot = this.data.favorites.find(s => s._id === id)
    if (!spot) return
    const cur = spot.current || {}
    if (!cur.location || !cur.location.lat) {
      wx.showToast({ title: '该地点暂无坐标', icon: 'none' })
      return
    }
    // switchTab 不能带参数，通过 globalData 传递目标点，地图页 onShow 消费
    getApp().globalData.viewSpot = {
      _id: spot._id,
      title: cur.title || spot._title,
      lat: cur.location.lat,
      lng: cur.location.lng,
    }
    wx.switchTab({ url: '/pages/map/map' })
  },

  // 取消收藏：二次确认后调用 toggleFavorite
  unfav(e) {
    const id = e.currentTarget.dataset.id
    const spot = this.data.favorites.find(s => s._id === id)
    wx.showModal({
      title: '取消收藏',
      content: `确定取消收藏「${spot ? spot._title : ''}」吗？`,
      confirmText: '取消收藏',
      confirmColor: '#ff3b30',
      success: async (res) => {
        if (!res.confirm) return
        const r = await callCloud('toggleFavorite', { spotId: id })
        if (r.ok) {
          wx.showToast({ title: '已取消收藏', icon: 'success' })
          this.load()
        }
      },
    })
  },
})
