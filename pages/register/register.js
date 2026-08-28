// 个人信息页：首次使用收集姓名、电话、是否有车辆、主要销售品类
const { callCloud } = require('../../utils/cloud')

const VEHICLE_OPTS = ['是', '否']
const CATEGORY_OPTS = ['餐饮小吃', '水果生鲜', '服装服饰', '日用百货', '手工艺品', '儿童玩具', '其他']

Page({
  data: {
    vehicleOpts: VEHICLE_OPTS,
    categoryOpts: CATEGORY_OPTS,
    name: '',
    phone: '',
    hasVehicle: '否',
    hasVehicleIdx: 1,
    category: '',
    categoryIdx: -1,
    submitting: false,
  },

  onLoad() {
    // 已有资料则回填（编辑场景）
    const u = getApp().globalData.userProfile
    if (u) {
      const vIdx = u.hasVehicle === 'yes' ? 0 : 1
      const cIdx = CATEGORY_OPTS.indexOf(u.category)
      this.setData({
        name: u.name || '',
        phone: u.phone || '',
        hasVehicle: u.hasVehicle === 'yes' ? '是' : '否',
        hasVehicleIdx: vIdx,
        category: u.category || '',
        categoryIdx: cIdx,
      })
    }
  },

  onName(e) { this.setData({ name: e.detail.value }) },
  onPhone(e) { this.setData({ phone: e.detail.value }) },

  onVehicleChange(e) {
    const idx = Number(e.detail.value)
    this.setData({ hasVehicleIdx: idx, hasVehicle: VEHICLE_OPTS[idx] })
  },

  onCategoryChange(e) {
    const idx = Number(e.detail.value)
    this.setData({ categoryIdx: idx, category: CATEGORY_OPTS[idx] })
  },

  async submit() {
    if (this.data.submitting) return
    const { name, phone, hasVehicle, category } = this.data
    const nameT = name.trim()
    const phoneT = phone.trim()
    if (!nameT) return wx.showToast({ title: '请填写姓名', icon: 'none' })
    if (!/^1\d{10}$/.test(phoneT)) return wx.showToast({ title: '请输入 11 位手机号', icon: 'none' })
    if (!category) return wx.showToast({ title: '请选择主要销售品类', icon: 'none' })

    this.setData({ submitting: true })
    wx.showLoading({ title: '保存中…' })
    const r = await callCloud('saveUserProfile', {
      name: nameT,
      phone: phoneT,
      hasVehicle: hasVehicle === '是' ? 'yes' : 'no',
      category,
    })
    wx.hideLoading()
    this.setData({ submitting: false })
    if (r.ok) {
      wx.showToast({ title: '已保存', icon: 'success' })
      getApp().globalData.userProfile = {
        ...(getApp().globalData.userProfile || {}),
        name: nameT,
        phone: phoneT,
        hasVehicle: hasVehicle === '是' ? 'yes' : 'no',
        category,
        profileCompleted: true,
      }
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/mine/mine' }) }), 800)
    }
  },
})
