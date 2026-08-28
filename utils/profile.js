// utils/profile.js
// 个人信息校验辅助：发布类操作前调用，未完善则弹窗引导去个人信息页
const { callCloud } = require('./cloud')

// 返回 true 表示已完善、可以继续；false 表示已引导用户去填写（调用方应中止操作）
async function ensureProfile() {
  const r = await callCloud('getUser', {}, { silent: true })
  if (r.ok && r.data && r.data.profileCompleted) return true
  return new Promise(resolve => {
    wx.showModal({
      title: '请先完善个人信息',
      content: '使用发布、收藏、关注等功能前，需填写姓名、手机号、车辆与销售品类（仅需一次，用于摊友间联系）',
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

// 静默检测是否已完善个人信息（不弹窗），供首页/我的页展示引导
async function checkProfile() {
  const r = await callCloud('getUser', {}, { silent: true })
  return !!(r.ok && r.data && r.data.profileCompleted)
}

module.exports = { ensureProfile, checkProfile }
