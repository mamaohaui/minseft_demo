const { callCloud } = require('../../utils/cloud')

Page({
  data: {
    latitude: 30.657,
    longitude: 104.081,
    markers: [],
    spots: [],
    loaded: false,    // 首次加载完成（控制空态提示闪现）
    loading: false,   // 防重复刷新
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
    if (this.data.loading) return
    this.setData({ loading: true })
    const r = await callCloud('getSpotsNearby', { lng, lat, maxDistance: 5000 })
    if (!r.ok) {
      this.setData({ loading: false, loaded: true })
      return
    }
    const spots = (r.data || []).filter(s => s.current && s.current.location)
    const markers = spots.map((s, i) => ({
      id: i,
      latitude: s.current.location.lat,
      longitude: s.current.location.lng,
      title: s.current.title,
      // callout 气泡常显标题，点击气泡也可进详情
      callout: {
        content: s.current.title.length > 14 ? s.current.title.slice(0, 14) + '…' : s.current.title,
        display: 'ALWAYS',
        borderRadius: 8,
        padding: 8,
        fontSize: 12,
        bgColor: '#ffffff',
        color: '#333333',
      },
    }))
    this.setData({ spots, markers, loaded: true, loading: false })
  },

  // 回到当前位置并刷新
  backToLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.mapCtx = this.mapCtx || wx.createMapContext('map', this)
        this.setData({ latitude: res.latitude, longitude: res.longitude })
        this.mapCtx.moveToLocation()
        this.loadNearby(res.longitude, res.latitude)
      },
      fail: () => wx.showToast({ title: '定位失败', icon: 'none' }),
    })
  },

  // 按地图当前中心刷新
  refresh() {
    this.loadNearby(this.data.longitude, this.data.latitude)
  },

  // 地图移动后记录中心，供刷新使用
  onRegionChange(e) {
    if (e.type === 'end' && e.detail && e.detail.centerLocation) {
      this.setData({
        latitude: e.detail.centerLocation.latitude,
        longitude: e.detail.centerLocation.longitude,
      })
    }
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
