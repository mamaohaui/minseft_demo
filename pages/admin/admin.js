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
