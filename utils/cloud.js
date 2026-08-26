// utils/cloud.js
function callCloud(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({ name, data })
      .then(res => {
        const r = res.result || {}
        if (r.ok === false) {
          if (r.message) wx.showToast({ title: r.message, icon: 'none' })
          resolve(r)
        } else {
          resolve(r)
        }
      })
      .catch(err => {
        console.error(`云函数 ${name} 调用失败`, err)
        wx.showToast({ title: '操作失败，请重试', icon: 'none' })
        reject(err)
      })
  })
}

module.exports = { callCloud }
