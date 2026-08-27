const { callCloud } = require('../../utils/cloud')

Page({
  data: {
    latitude: 30.657,   // 地图渲染中心（仅定位/回到定位时更新）
    longitude: 104.081,
    centerLat: 30.657,  // 地图当前中心（regionchange 记录，供刷新用，不参与渲染）
    centerLng: 104.081,
    markers: [],
    spots: [],
    loaded: false,    // 首次加载完成（控制空态提示闪现）
    loading: false,   // 防重复刷新
  },

  onLoad() {
    this.getLocation()
  },

  // 「我的发布-查看」跳转过来：globalData 传入目标点，居中并强制显示标志
  onShow() {
    const target = getApp().globalData.viewSpot
    if (!target) return
    getApp().globalData.viewSpot = null
    // 记录目标点，供 marker 点击进详情（目标 marker 用固定 id 999999）
    this._focusSpot = target
    // 先同步放置目标标志（不等附近查询——查询失败或被并发拦截时标志也必须显示）
    this.setData({
      latitude: target.lat,
      longitude: target.lng,
      markers: [{
        id: 999999,
        latitude: target.lat,
        longitude: target.lng,
        width: 30,
        height: 30,
        title: target.title || '',
        callout: {
          content: target.title || '目标地点',
          display: 'ALWAYS',
          borderRadius: 8,
          padding: 8,
          fontSize: 12,
          bgColor: '#ffffff',
          color: '#333333',
        },
      }],
    })
    this.loadNearby(target.lng, target.lat, target)
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

  async loadNearby(lng, lat, focusSpot) {
    if (this.data.loading) return
    this.setData({ loading: true })
    const r = await callCloud('getSpotsNearby', { lng, lat })
    if (!r.ok) {
      this.setData({ loading: false, loaded: true })
      return
    }
    const spots = (r.data || []).filter(s => s.current && s.current.location)

    // 查看指定摊点：附近查询查不到（待审/驳回/private）时，强制补一个标志保证可见
    if (focusSpot && !spots.some(s => s._id === focusSpot._id)) {
      spots.push({
        _id: focusSpot._id,
        current: { title: focusSpot.title, location: { lat: focusSpot.lat, lng: focusSpot.lng } },
      })
    }

    const markers = spots.map((s, i) => ({
      id: i,
      latitude: s.current.location.lat,
      longitude: s.current.location.lng,
      width: 25,
      height: 25,
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
    this.loadNearby(this.data.centerLng, this.data.centerLat)
  },

  // 地图移动后记录中心（仅记到 centerLat/Lng，不触碰渲染属性，避免触发地图重定位造成闪烁）
  onRegionChange(e) {
    if (e.type === 'end' && e.detail && e.detail.centerLocation) {
      const c = e.detail.centerLocation
      this.setData({ centerLat: c.latitude, centerLng: c.longitude })
    }
  },

  onMarkerTap(e) {
    // 目标标志（查看跳转）：直接进该点详情
    if (e.markerId === 999999 && this._focusSpot) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${this._focusSpot._id}` })
      return
    }
    const spot = this.data.spots[e.markerId]
    if (spot) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${spot._id}` })
    }
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' })
  },
})
