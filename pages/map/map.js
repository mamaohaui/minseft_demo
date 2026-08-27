const { callCloud } = require('../../utils/cloud')

const FOCUS_MARKER_ID = 999999 // 「查看」目标标志固定 id

// 坐标归一化兜底：兼容 GeoJSON {coordinates} / GeoPoint {longitude,latitude} / 已是 {lng,lat}
const toLatLng = (loc) => {
  if (!loc) return null
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    return { lng: loc.coordinates[0], lat: loc.coordinates[1] }
  }
  if (typeof loc.longitude === 'number' && typeof loc.latitude === 'number') {
    return { lng: loc.longitude, lat: loc.latitude }
  }
  if (typeof loc.lng === 'number' && typeof loc.lat === 'number') return loc
  return null
}

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
    // 图层开关：我的私有（第一）/ 关注分享（我收藏的）/ 公共摊点（默认全开）
    layers: { private: true, followed: true, public: true },
    layerPanelOpen: false,
  },

  onLoad() {
    this.getLocation()
  },

  // 「我的发布/管理员审核-查看」跳转过来：globalData 传入目标点，居中并强制显示标志
  onShow() {
    // 每次回地图页静默刷新收藏（详情页收藏/取消后图层即时生效）
    this.refreshFavs()
    const target = getApp().globalData.viewSpot
    if (!target) return
    getApp().globalData.viewSpot = null
    // 记录目标点，供 marker 点击进详情（目标 marker 用固定 id）
    this._focusSpot = target
    // 先同步放置目标标志（不等附近查询——查询失败或被并发拦截时标志也必须显示）
    this.setData({
      latitude: target.lat,
      longitude: target.lng,
      markers: [this.buildFocusMarker(target)],
    })
    this.loadNearby(target.lng, target.lat, target)
  },

  // 目标标志：查看跳转专用 marker（固定 id，点击进详情，不受图层开关影响）
  buildFocusMarker(target) {
    return {
      id: FOCUS_MARKER_ID,
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
    }
  },

  getLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        // 查看目标期间定位才返回：保持目标中心不覆盖，仅刷新数据（焦点标志会保留）
        if (this._focusSpot) {
          this.loadNearby(res.longitude, res.latitude, this._focusSpot)
          return
        }
        this.setData({ latitude: res.latitude, longitude: res.longitude })
        this.loadNearby(res.longitude, res.latitude)
      },
      fail: () => {
        if (!this._focusSpot) wx.showToast({ title: '定位失败，显示默认位置', icon: 'none' })
        const lng = this._focusSpot ? this._focusSpot.lng : 104.081
        const lat = this._focusSpot ? this._focusSpot.lat : 30.657
        this.loadNearby(lng, lat, this._focusSpot)
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
    // 全量缓存：图层开关切换时本地过滤即时生效，不重新请求（坐标本地归一化兜底）
    this._allSpots = (r.data || []).map(s => {
      if (s.current) {
        const p = toLatLng(s.current.location)
        if (p) s.current.location = p
      }
      return s
    }).filter(s => s.current && s.current.location)
    // 焦点以「完成时刻」为准：即使本查询早于 onShow 发出（慢查询竞态），
    // 回来重建 markers 时也带上目标标志，不会被冲掉
    this.applyLayers(focusSpot || this._focusSpot)
  },

  // 拉取我的收藏点位 id（"关注分享"图层数据源），静默失败不影响地图
  async refreshFavs() {
    const r = await callCloud('getFavorites')
    if (r.ok) {
      this._favIds = (r.data || []).map(s => s._id)
      this.applyLayers()
    }
  },

  // 按图层开关过滤并重建 markers；目标标志始终显示（不受图层影响），并剔除普通标志中的重复
  applyLayers(focus) {
    const L = this.data.layers
    const favIds = this._favIds || []
    // 按优先级归类去重：我的私有 > 关注分享（收藏）> 公共摊点
    let spots = (this._allSpots || []).filter(s => {
      if (s.visibility === 'private') return L.private
      if (favIds.includes(s._id)) return L.followed
      return L.public
    })
    const f = focus || this._focusSpot
    if (f) spots = spots.filter(s => s._id !== f._id)
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
    if (f) markers.push(this.buildFocusMarker(f))
    this.setData({ spots, markers, loaded: true, loading: false })
  },

  // 右上角图层按钮：开关面板
  toggleLayerPanel() {
    this.setData({ layerPanelOpen: !this.data.layerPanelOpen })
  },

  closeLayerPanel() {
    this.setData({ layerPanelOpen: false })
  },

  // 阻止图层面板内点击冒泡到遮罩
  noop() {},

  // 图层开关切换：本地过滤即时生效
  toggleLayer(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`layers.${key}`]: !this.data.layers[key] })
    this.applyLayers()
  },

  // 回到当前位置并刷新（同时退出"查看目标"模式）
  backToLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this._focusSpot = null
        this.mapCtx = this.mapCtx || wx.createMapContext('map', this)
        this.setData({ latitude: res.latitude, longitude: res.longitude })
        this.mapCtx.moveToLocation()
        this.loadNearby(res.longitude, res.latitude)
      },
      fail: () => wx.showToast({ title: '定位失败', icon: 'none' }),
    })
  },

  // 按地图当前中心刷新（查看目标时刷新会保留目标标志）
  refresh() {
    this.loadNearby(this.data.centerLng, this.data.centerLat, this._focusSpot)
  },

  // 地图移动后记录中心（仅记到 centerLat/Lng，不触碰渲染属性，避免触发地图重定位造成闪烁）
  onRegionChange(e) {
    if (e.type === 'end' && e.detail && e.detail.centerLocation) {
      const c = e.detail.centerLocation
      this.setData({ centerLat: c.latitude, centerLng: c.longitude })
    }
  },

  onMarkerTap(e) {
    // 兼容两种事件形状：部分基础库 markerId 在 e 上，部分在 e.detail 里
    const markerId = (e && e.markerId !== undefined) ? e.markerId : (e && e.detail && e.detail.markerId)
    // 目标标志（查看跳转）：直接进该点详情
    if (markerId === FOCUS_MARKER_ID && this._focusSpot) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${this._focusSpot._id}` })
      return
    }
    const spot = this.data.spots[markerId]
    if (spot) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${spot._id}` })
    }
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publish/publish' })
  },

  // 底部搜索入口：进搜索页
  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },
})
