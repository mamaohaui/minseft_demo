// app.js
App({
  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，无法使用云能力，请升级微信',
        showCancel: false,
      })
      return
    }
    wx.cloud.init({
      env: 'cloudbase-d7gkgs2uke727391c',
      traceUser: true,
    })
  },
  globalData: {},
})
