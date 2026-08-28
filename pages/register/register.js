// 个人信息页：微信头像昵称填写能力 + 电话（必填，强校验）+ 车辆/品类（选填）
const { callCloud } = require('../../utils/cloud')

const VEHICLE_OPTS = ['暂不填写', '是', '否']
const CATEGORY_OPTS = ['暂不填写', '餐饮小吃', '水果生鲜', '服装服饰', '日用百货', '手工艺品', '儿童玩具', '其他']
// 电话号段校验：1 开头 + 3-9 第二位（覆盖所有大陆号段），前后端双重校验
const PHONE_RE = /^1[3-9]\d{9}$/

Page({
  data: {
    vehicleOpts: VEHICLE_OPTS,
    categoryOpts: CATEGORY_OPTS,
    avatarUrl: '',
    nickname: '',
    phone: '',
    hasVehicle: '',
    hasVehicleIdx: 0,
    category: '',
    categoryIdx: 0,
    uploadingAvatar: false,
    submitting: false,
  },

  onLoad() {
    // 已有资料则回填（编辑场景）
    const u = getApp().globalData.userProfile
    if (u) {
      const vIdx = u.hasVehicle === 'yes' ? 1 : (u.hasVehicle === 'no' ? 2 : 0)
      const cIdx = CATEGORY_OPTS.indexOf(u.category)
      this.setData({
        avatarUrl: u.avatarUrl || '',
        nickname: u.nickname || u.name || '',
        phone: u.phone || '',
        hasVehicle: u.hasVehicle === 'yes' ? '是' : (u.hasVehicle === 'no' ? '否' : ''),
        hasVehicleIdx: vIdx,
        category: u.category || '',
        categoryIdx: cIdx >= 0 ? cIdx : 0,
      })
    }
  },

  // 微信头像选择：临时路径 → 上传云存储 → 存 fileID（image src 可直接渲染 cloud:// 文件）
  onChooseAvatar(e) {
    const tmp = e.detail.avatarUrl
    if (!tmp) return
    const uid = (getApp().globalData.userProfile && getApp().globalData.userProfile._id) || ''
    this.setData({ uploadingAvatar: true })
    wx.showLoading({ title: '上传中…' })
    wx.cloud.uploadFile({
      cloudPath: `avatars/${uid || Date.now()}.png`,
      filePath: tmp,
    })
      .then((res) => {
        wx.hideLoading()
        this.setData({ avatarUrl: res.fileID, uploadingAvatar: false })
        wx.showToast({ title: '头像已选择', icon: 'success' })
      })
      .catch(() => {
        wx.hideLoading()
        this.setData({ uploadingAvatar: false })
        wx.showToast({ title: '头像上传失败，可稍后重试', icon: 'none' })
      })
  },

  onNickname(e) { this.setData({ nickname: e.detail.value }) },
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
    if (this.data.submitting || this.data.uploadingAvatar) return
    const { avatarUrl, nickname, phone, hasVehicle, category } = this.data
    const nicknameT = nickname.trim()
    const phoneT = phone.trim()

    // 电话必填 + 格式/号段强校验
    if (!PHONE_RE.test(phoneT)) {
      return wx.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' })
    }
    if (nicknameT.length > 20) return wx.showToast({ title: '昵称不能超过 20 字', icon: 'none' })

    this.setData({ submitting: true })
    wx.showLoading({ title: '保存中…' })
    const r = await callCloud('saveUserProfile', {
      avatarUrl,
      nickname: nicknameT,
      phone: phoneT,
      hasVehicle: hasVehicle === '是' ? 'yes' : (hasVehicle === '否' ? 'no' : ''),
      category: category === '暂不填写' ? '' : category,
    })
    wx.hideLoading()
    this.setData({ submitting: false })
    if (r.ok) {
      wx.showToast({ title: '已保存', icon: 'success' })
      getApp().globalData.userProfile = {
        ...(getApp().globalData.userProfile || {}),
        avatarUrl,
        nickname: nicknameT,
        phone: phoneT,
        hasVehicle: hasVehicle === '是' ? 'yes' : (hasVehicle === '否' ? 'no' : ''),
        category: category === '暂不填写' ? '' : category,
        profileCompleted: true,
      }
      setTimeout(() => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/mine/mine' }) }), 800)
    }
  },
})
