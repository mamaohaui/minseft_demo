const { callCloud } = require('../../utils/cloud')
const { CATEGORIES, TIME_SLOTS, FEE_TYPES, VISIBILITY } = require('../../utils/constants')

Page({
  data: {
    category: CATEGORIES,
    timeSlot: TIME_SLOTS,
    feeType: FEE_TYPES,
    visibilityOptions: VISIBILITY,
    form: {
      title: '', category: '小吃', timeSlot: '夜市',
      positionReq: '', mgmtReq: '', feeType: '免费', feeAmount: 0,
      visibility: 'public',
    },
    location: null, // { lng, lat }
    editing: false,
    visibilityLabel: VISIBILITY[0].label,
  },

  // value → label
  visLabel(v) {
    const opt = VISIBILITY.find(o => o.value === v)
    return opt ? opt.label : v
  },

  onLoad(options) {
    if (options.id) {
      this.spotId = options.id
      this.setData({ editing: true })
      wx.setNavigationBarTitle({ title: '编辑地点' })
      this.loadSpot()
    }
  },

  async loadSpot() {
    const r = await callCloud('getSpotDetail', { spotId: this.spotId })
    if (!r.ok) return
    const spot = r.data
    // 被驳回的新建地点 current 为 null，需回填 pending；visibility 是顶层字段，单独恢复
    const src = spot.current || spot.pending || {}
    this.setData({
      form: { ...this.data.form, ...src, visibility: spot.visibility || 'public' },
      location: src.location,
      visibilityLabel: this.visLabel(spot.visibility || 'public'),
    })
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ [`form.${key}`]: e.detail.value })
  },

  onPicker(e) {
    const key = e.currentTarget.dataset.key
    const idx = e.detail.value
    if (key === 'visibility') {
      const v = this.data.visibilityOptions[idx].value
      this.setData({ 'form.visibility': v, visibilityLabel: this.visLabel(v) })
    } else {
      this.setData({ [`form.${key}`]: this.data[key][idx] })
    }
  },

  onFeeAmount(e) {
    this.setData({ 'form.feeAmount': Number(e.detail.value) || 0 })
  },

  chooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({ location: { lng: res.longitude, lat: res.latitude } })
        this.setData({ 'form.title': this.data.form.title || res.name || res.address })
      },
    })
  },

  async submit() {
    const f = this.data.form
    if (!f.title) return wx.showToast({ title: '请填标题', icon: 'none' })
    if (!this.data.location) return wx.showToast({ title: '请选择坐标', icon: 'none' })

    const payload = { ...f, location: this.data.location }
    const r = this.data.editing
      ? await callCloud('updateSpot', { spotId: this.spotId, ...payload })
      : await callCloud('createSpot', payload)

    if (r.ok) {
      wx.showToast({ title: this.data.editing ? '已提交' : '已提交，待审核', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    }
  },
})
