const { callCloud } = require('../../utils/cloud')
const { ensureProfile } = require('../../utils/profile')

Page({
  data: { user: null, favorites: [], mySpots: [], offlineCount: 0, profileCompleted: true, displayName: '游客', avatarChar: '摊', roleText: '身份加载中…' },

  onShow() { this.load() },

  async load() {
    // 三个请求并行发出（原来串行要 1-2 秒，现在约等于最慢那一个）
    const [u, f, m] = await Promise.all([
      callCloud('getUser'),
      callCloud('getFavorites'),
      callCloud('getMySpots'),
    ])
    // 已下载离线数据包数量（本地 storage，无需云端请求）
    const pkgs = wx.getStorageSync('offlineRegionPackages') || {}
    const user = u.ok ? u.data : this.data.user
    const profileCompleted = u.ok ? !!user.profileCompleted : this.data.profileCompleted
    // 昵称行显示：未注册 → 游客；已注册 → 昵称（未设置则显示姓名）
    const displayName = profileCompleted ? (user.nickname || user.name || '摊友') : '游客'
    let roleText = '完善个人信息后可发布、收藏、关注'
    if (profileCompleted) {
      roleText = user.isAdmin ? '管理员 · 昵称用于发布展示' : '昵称用于发布展示与被搜索'
    }
    this.setData({
      user,
      favorites: f.ok ? f.data : this.data.favorites,
      mySpots: m.ok ? m.data : this.data.mySpots,
      offlineCount: Object.keys(pkgs).length,
      profileCompleted,
      displayName,
      avatarChar: displayName === '游客' ? '摊' : displayName.charAt(0),
      roleText,
    })
  },

  // 个人信息（姓名/电话/车辆/品类）：未完成时高亮引导，已完成可查看编辑
  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' })
  },

  // 我的发布：独立管理页（查看/编辑/删除）
  goMySpots() {
    wx.navigateTo({ url: '/pages/mySpots/mySpots' })
  },

  // 我的收藏：独立管理页（查看/取消收藏）
  goFavorites() {
    wx.navigateTo({ url: '/pages/favorites/favorites' })
  },

  // 公共数据下载：按省/市/县下载离线数据包（公共摆摊基础数据库的导入/更新也已并入该页）
  goDataDownload() {
    wx.navigateTo({ url: '/pages/dataDownload/dataDownload' })
  },

  goAdmin() {
    wx.navigateTo({ url: '/pages/admin/admin' })
  },

  // 数据管理：管理员可视化编辑云端点位
  goDataManage() {
    wx.navigateTo({ url: '/pages/dataManage/dataManage' })
  },

  // 设置发布者昵称（保存后同步回填到自己所有历史发布，供"按发布者"搜索）
  async editNickname() {
    // 改名属于注册后权限：游客先引导注册
    if (!(await ensureProfile())) return
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
