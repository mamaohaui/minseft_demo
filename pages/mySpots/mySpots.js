const { callCloud } = require('../../utils/cloud')

Page({
  data: { mySpots: [], loading: true },

  onShow() { this.load() },

  async load() {
    this.setData({ loading: true })
    const r = await callCloud('getMySpots')
    this.setData({
      loading: false,
      mySpots: r.ok ? r.data.map(this.decorateSpot) : [],
    })
  },

  // 派生状态标签与展示标题（坐标本地兜底归一化，双保险）
  decorateSpot(s) {
    let status, statusText
    if (s.status === 'rejected') { status = 'rejected'; statusText = '已驳回' }
    else if (s.status === 'pending') { status = 'pending'; statusText = '待审核' }
    else if (s.hasPendingUpdate) { status = 'updating'; statusText = '修改待审' }
    else { status = 'approved'; statusText = '已公开' }
    const cur = s.current || s.pending || {}
    if (cur.location) {
      const p = cur.location
      if (Array.isArray(p.coordinates) && p.coordinates.length >= 2) {
        cur.location = { lng: p.coordinates[0], lat: p.coordinates[1] }
      } else if (typeof p.latitude === 'number' && typeof p.longitude === 'number') {
        cur.location = { lng: p.longitude, lat: p.latitude }
      }
    }
    return { ...s, _status: status, _statusText: statusText, _title: cur.title || '未命名地点' }
  },

  // 查看：跳转到地图页，居中并显示该摊点标志
  viewOnMap(e) {
    const id = e.currentTarget.dataset.id
    const spot = this.data.mySpots.find(s => s._id === id)
    if (!spot) return
    const cur = spot.current || spot.pending || {}
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

  // 编辑：进发布页编辑（驳回/待审可修改重提）
  goEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/publish/publish?id=${id}` })
  },

  // 删除：二次确认后删除（云函数级联清理评价和收藏）
  del(e) {
    const id = e.currentTarget.dataset.id
    const spot = this.data.mySpots.find(s => s._id === id)
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${spot ? spot._title : ''}」吗？相关评价和收藏会一并删除，不可恢复。`,
      confirmColor: '#e64340',
      success: async (res) => {
        if (!res.confirm) return
        const r = await callCloud('deleteSpot', { spotId: id })
        if (r.ok) {
          wx.showToast({ title: '已删除', icon: 'success' })
          this.load()
        } else {
          wx.showToast({ title: r.message || '删除失败', icon: 'none' })
        }
      },
    })
  },
})
