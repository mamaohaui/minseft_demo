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
        // 区分「云函数未部署」与普通网络失败，提示更明确
        const msg = (err && err.errMsg) || ''
        const notFound = err && (err.errCode === -404011 || /not ?found|no such function|不存在/i.test(msg))
        wx.showToast({
          title: notFound ? `云函数 ${name} 未部署` : '操作失败，请重试',
          icon: 'none',
          duration: 2500,
        })
        resolve({ ok: false, code: notFound ? 'NOT_DEPLOYED' : 'NETWORK', message: '网络异常' })
      })
  })
}

module.exports = { callCloud }
