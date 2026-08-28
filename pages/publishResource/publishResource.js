// 发布资源信息：标题 / 分类 / 详细说明 / 联系方式
const { callCloud } = require('../../utils/cloud')
const { ensureProfile } = require('../../utils/profile')

const CATEGORIES = ['货源供应', '摊位转让', '设备租赁', '合伙招募', '政策资讯', '其他']

Page({
  data: {
    categories: CATEGORIES,
    categoryIndex: 0,
    title: '',
    content: '',
    contact: '',
    submitting: false,
  },

  onTitle(e) { this.setData({ title: e.detail.value }) },
  onContent(e) { this.setData({ content: e.detail.value }) },
  onContact(e) { this.setData({ contact: e.detail.value }) },
  onPick(e) { this.setData({ categoryIndex: Number(e.detail.value) }) },

  async submit() {
    if (this.data.submitting) return
    // 未完善个人信息先引导填写（发布前必填）
    const ok = await ensureProfile()
    if (!ok) return
    const { title, content, contact, categories, categoryIndex } = this.data
    const t = title.trim(), c = content.trim(), ct = contact.trim()
    if (!t) { wx.showToast({ title: '请填写标题', icon: 'none' }); return }
    if (!c) { wx.showToast({ title: '请填写详细说明', icon: 'none' }); return }
    if (!ct) { wx.showToast({ title: '请填写联系方式', icon: 'none' }); return }

    this.setData({ submitting: true })
    const r = await callCloud('addResource', {
      title: t,
      content: c,
      contact: ct,
      category: categories[categoryIndex],
    })
    this.setData({ submitting: false })
    if (r.ok) {
      wx.showToast({ title: '发布成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    }
  },
})
