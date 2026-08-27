const { callCloud } = require('../../utils/cloud')

Page({
  data: { user: null, favorites: [], mySpots: [] },

  onShow() { this.load() },

  async load() {
    // 三个请求并行发出（原来串行要 1-2 秒，现在约等于最慢那一个）
    const [u, f, m] = await Promise.all([
      callCloud('getUser'),
      callCloud('getFavorites'),
      callCloud('getMySpots'),
    ])
    this.setData({
      user: u.ok ? u.data : this.data.user,
      favorites: f.ok ? f.data : this.data.favorites,
      mySpots: m.ok ? m.data : this.data.mySpots,
    })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },

  // 我的发布：独立管理页（查看/编辑/删除）
  goMySpots() {
    wx.navigateTo({ url: '/pages/mySpots/mySpots' })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  // 设置发布者昵称（保存后同步回填到自己所有历史发布，供"按发布者"搜索）
  editNickname() {
    const current = (this.data.user && this.data.user.nickname) || ''
    wx.showModal({
      title: '设置昵称',
      editable: true,
      placeholderText: '用于发布地点时展示、被搜索（20 字内）',
      content: current,
      success: async (res) => {
        if (!res.confirm) return
        const nickname = (res.content || '').trim()
        if (!nickname) return wx.showToast({ title: '昵称不能为空', icon: 'none' })
        const r = await callCloud('setNickname', { nickname })
        if (r.ok) {
          wx.showToast({ title: '已保存', icon: 'success' })
          this.setData({ 'user.nickname': nickname })
        }
      },
    })
  },
})
