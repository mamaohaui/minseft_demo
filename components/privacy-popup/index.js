// 用户隐私保护授权弹窗（发布合规）
// 平台规范：调用 getLocation / chooseLocation 等隐私接口前，
// 需通过 <button open-type="agreePrivacyAuthorization"> 获得用户同意。
// 用法：页面 json 注册 usingComponents，wxml 放置 <privacy-popup /> 即可。
Component({
  data: { show: false },

  lifetimes: {
    attached() {
      if (!wx.onNeedPrivacyAuthorization) return // 低版本基础库无此 API
      this._handler = resolve => {
        this._resolve = resolve
        this.setData({ show: true })
      }
      wx.onNeedPrivacyAuthorization(this._handler)
    },
    detached() {
      if (wx.offNeedPrivacyAuthorization && this._handler) {
        wx.offNeedPrivacyAuthorization(this._handler)
      }
    },
  },

  methods: {
    // 用户点击「同意并继续」：由 agreePrivacyAuthorization 开放能力按钮触发
    onAgree() {
      this.setData({ show: false })
      if (this._resolve) {
        this._resolve({ event: 'agree' })
        this._resolve = null
      }
    },

    // 用户点击「不同意」：通知平台拒绝，本次隐私接口调用将失败
    onReject() {
      this.setData({ show: false })
      if (this._resolve) {
        this._resolve({ event: 'disagree' })
        this._resolve = null
      }
    },
  },
})
