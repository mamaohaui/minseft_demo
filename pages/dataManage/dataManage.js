// 数据管理页：管理员可视化编辑云端点位（公共基础库 / 用户发布）
const { callCloud } = require('../../utils/cloud')

const STATUS_TEXT = { approved: '已通过', pending: '待审核', rejected: '已驳回' }
const STATUS_CLASS = { approved: 'st-ok', pending: 'st-wait', rejected: 'st-no' }

Page({
  data: {
    tab: 'base', // base | user
    baseList: [],
    userList: [],
    basePage: 0,
    userPage: 0,
    baseHasMore: true,
    userHasMore: true,
    loadingBase: false,
    loadingUser: false,
    showEdit: false,
    editForm: {},
    editId: '',
  },

  onShow() { this.loadBase(true) },

  // ===== tab 切换 =====
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    if (tab === 'base') this.loadBase(true)
    else this.loadUser(true)
  },

  // ===== 公共基础库 =====
  async loadBase(reset) {
    if (this.data.loadingBase) return
    this.setData({ loadingBase: true })
    const page = reset ? 0 : this.data.basePage + 1
    const r = await callCloud('manageSpots', { action: 'listBase', page }, { silent: true })
    if (r.ok) {
      this.setData({
        baseList: reset ? r.data : this.data.baseList.concat(r.data),
        basePage: page,
        baseHasMore: r.hasMore,
      })
    } else if (r.code === 'NO_PERMISSION') {
      this.setData({ baseList: [], baseHasMore: false })
      wx.showModal({ title: '无权限', content: '仅管理员可管理数据', showCancel: false })
    }
    this.setData({ loadingBase: false })
  },

  loadMoreBase() {
    if (this.data.baseHasMore && !this.data.loadingBase) this.loadBase(false)
  },

  // ===== 用户发布 =====
  async loadUser(reset) {
    if (this.data.loadingUser) return
    this.setData({ loadingUser: true })
    const page = reset ? 0 : this.data.userPage + 1
    const r = await callCloud('manageSpots', { action: 'listUser', page }, { silent: true })
    if (r.ok) {
      const list = r.data.map(s => ({
        ...s,
        _statusText: STATUS_TEXT[s.status] || s.status,
        _statusClass: STATUS_CLASS[s.status] || 'st-wait',
        _time: this.fmtTime(s.createdAt),
      }))
      this.setData({
        userList: reset ? list : this.data.userList.concat(list),
        userPage: page,
        userHasMore: r.hasMore,
      })
    } else if (r.code === 'NO_PERMISSION') {
      this.setData({ userList: [], userHasMore: false })
      wx.showModal({ title: '无权限', content: '仅管理员可管理数据', showCancel: false })
    }
    this.setData({ loadingUser: false })
  },

  loadMoreUser() {
    if (this.data.userHasMore && !this.data.loadingUser) this.loadUser(false)
  },

  // ===== 编辑（基础库） =====
  openEdit(e) {
    const id = e.currentTarget.dataset.id
    const spot = this.data.baseList.find(s => s._id === id)
    if (!spot) return
    this.setData({
      showEdit: true,
      editId: id,
      editForm: {
        title: spot.title || '',
        category: spot.category || '',
        timeSlot: spot.timeSlot || '',
        feeType: spot.feeType || '',
        feeAmount: spot.feeAmount != null ? String(spot.feeAmount) : '',
        lng: spot.lng != null ? String(spot.lng) : '',
        lat: spot.lat != null ? String(spot.lat) : '',
      },
    })
  },

  closeEdit() {
    this.setData({ showEdit: false })
  },

  noop() {},

  onField(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ [`editForm.${k}`]: e.detail.value })
  },

  async saveEdit() {
    const f = this.data.editForm
    if (!f.title || !f.title.trim()) return wx.showToast({ title: '标题必填', icon: 'none' })
    if (!f.lng || !f.lat) return wx.showToast({ title: '经纬度必填', icon: 'none' })
    const fields = {
      title: f.title,
      category: f.category,
      timeSlot: f.timeSlot,
      feeType: f.feeType,
      feeAmount: f.feeAmount,
      lng: Number(f.lng),
      lat: Number(f.lat),
    }
    wx.showLoading({ title: '保存中…' })
    const r = await callCloud('manageSpots', { action: 'updateBase', id: this.data.editId, fields }, { silent: true })
    wx.hideLoading()
    if (r.ok) {
      wx.showToast({ title: '已保存', icon: 'success' })
      this.setData({ showEdit: false })
      this.loadBase(true)
    } else if (r.message) {
      wx.showToast({ title: r.message, icon: 'none' })
    }
  },

  // ===== 删除 =====
  delSpot(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除该点位？',
      content: '删除后立即对所有用户生效（已下载的本地缓存不会自动清除）。',
      confirmText: '删除',
      confirmColor: '#e64340',
      success: async (res) => {
        if (!res.confirm) return
        const r = await callCloud('manageSpots', { action: 'delete', id }, { silent: true })
        if (r.ok) {
          wx.showToast({ title: '已删除', icon: 'success' })
          if (this.data.tab === 'base') this.loadBase(true)
          else this.loadUser(true)
        } else if (r.message) {
          wx.showToast({ title: r.message, icon: 'none' })
        }
      },
    })
  },

  // ===== 状态管理（用户发布） =====
  changeStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const map = { approved: '通过该点位', rejected: '下架该点位', pending: '恢复为待审核' }
    wx.showModal({
      title: map[status] || '更新状态',
      content: '确认执行？',
      success: async (res) => {
        if (!res.confirm) return
        const r = await callCloud('manageSpots', { action: 'setStatus', id, status }, { silent: true })
        if (r.ok) {
          wx.showToast({ title: '已更新', icon: 'success' })
          this.loadUser(true)
        } else if (r.message) {
          wx.showToast({ title: r.message, icon: 'none' })
        }
      },
    })
  },

  fmtTime(t) {
    if (!t) return ''
    const d = new Date(typeof t === 'object' ? t.$date || t : t)
    if (isNaN(d.getTime())) return ''
    const p = n => (n < 10 ? '0' + n : '' + n)
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  },
})
