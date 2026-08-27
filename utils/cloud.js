// utils/cloud.js
// 统一云函数调用封装：失败一律 resolve {ok:false}，不 reject
// （页面可用 Promise.all 并行多个请求，单个失败不影响其他请求的结果处理）
function callCloud(name, data = {}) {
  return new Promise((resolve) => {
    wx.cloud.callFunction({ name, data })
      .then(res => {
        const r = res.result || {}
        if (r.ok === false && r.message) {
          wx.showToast({ title: r.message, icon: 'none' })
        }
        resolve(r)
      })
      .catch(err => {
        console.error(`云函数 ${name} 调用失败`, err)
        wx.showToast({ title: '操作失败，请重试', icon: 'none' })
        resolve({ ok: false, code: 'NETWORK', message: '网络异常' })
      })
  })
}

module.exports = { callCloud }
