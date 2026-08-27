const { callCloud } = require('../../utils/cloud')

Page({
  data: { list: [] },

  onShow() { this.load() },

  async load() {
    const r = await callCloud('adminList')
    if (r.ok) this.setData({ list: r.data })
  },

  // 查看：跳转到地图页，居中并显示该申请（pending 版本）的坐标标志
  viewOnMap(e) {
    const id = e.currentTarget.dataset.id
    const spot = this.data.list.find(s => s._id === id)
    if (!spot) return
    const p = spot.pending || {}
    const loc = p.location || {}
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
      wx.showToast({ title: '该申请暂无坐标', icon: 'none' })
      return
    }
    // switchTab 不能带参数，通过 globalData 传递目标点，地图页 onShow 消费
    getApp().globalData.viewSpot = {
      _id: spot._id,
      title: p.title || '待审地点',
      lat: loc.lat,
      lng: loc.lng,
    }
    wx.switchTab({ url: '/pages/map/map' })
  },

  async review(e) {
    const { id, action } = e.currentTarget.dataset
    let reason = ''
    if (action === 'reject') {
      // 弹出可编辑对话框，让管理员填写具体驳回原因（会展示给发布者）
      const modal = await new Promise(resolve => {
        wx.showModal({
          title: '驳回该地点',
          editable: true,
          placeholderText: '请输入驳回原因（将展示给发布者）',
          confirmText: '驳回',
          confirmColor: '#e64340',
          success: resolve,
        })
      })
      if (!modal.confirm) return
      reason = (modal.content || '').trim() || '不符合要求'
    }
    const r = await callCloud('reviewSpot', { spotId: id, action, reason })
    if (r.ok) {
      wx.showToast({ title: '已处理', icon: 'success' })
      this.load()
    }
  },
})
