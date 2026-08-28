// utils/profile.js
// 注册/经营资料校验辅助：发布类操作前调用，未注册则弹窗引导去注册页
const { callCloud } = require('./cloud')

// 返回 true 表示已注册、可以继续；false 表示已引导用户去注册（调用方应中止操作）
async function ensureProfile() {
  const r = await callCloud('getUser', {}, { silent: true })
  if (r.ok && r.data && r.data.profileCompleted) return true
  return new Promise(resolve => {
    wx.showModal({
      title: '请先完善注册资料',
      content: '发布前需填写姓名、电话、车辆与经营品类（仅需一次，用于摊友间联系）',
      confirmText: '去填写',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) wx.navigateTo({ url: '/pages/register/register' })
        resolve(false)
      },
      fail: () => resolve(false),
    })
  })
}

// 静默检测是否已注册（不弹窗），供首页/我的页展示引导
async function checkProfile() {
  const r = await callCloud('getUser', {}, { silent: true })
  return !!(r.ok && r.data && r.data.profileCompleted)
}

module.exports = { ensureProfile, checkProfile }
