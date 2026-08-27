// 资源拓展页：货源供应 / 摊位转让 / 设备租赁 / 合伙招募 / 政策资讯 等
const { callCloud } = require('../../utils/cloud')

const CATEGORIES = ['全部', '货源供应', '摊位转让', '设备租赁', '合伙招募', '政策资讯', '其他']

Page({
  data: { categories: CATEGORIES, active: '全部', list: [], loading: false, page: 0, hasMore: true },

  onShow() { this.load() },

  async load() {
    this.setData({ loading: true, page: 0, hasMore: true })
    const r = await callCloud('listResources', { category: this.data.active, page: 0 })
    const list = (r.ok ? r.data : []).map(it => ({ ...it, _time: this.fmtTime(it.createdAt) }))
    this.setData({ list, loading: false, hasMore: r.ok ? r.hasMore : false })
  },

  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ loading: true })
    const nextPage = this.data.page + 1
    const r = await callCloud('listResources', { category: this.data.active, page: nextPage })
    const more = (r.ok ? r.data : []).map(it => ({ ...it, _time: this.fmtTime(it.createdAt) }))
    this.setData({
      list: this.data.list.concat(more),
      page: nextPage,
      hasMore: r.ok ? r.hasMore : false,
      loading: false,
    })
  },

  fmtTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    const p = n => (n < 10 ? '0' + n : '' + n)
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  },

  // 切换分类筛选
  onTapCategory(e) {
    const c = e.currentTarget.dataset.c
    if (c === this.data.active) return
    this.setData({ active: c })
    this.load()
  },

  // 点击联系方式复制到剪贴板
  copyContact(e) {
    const contact = e.currentTarget.dataset.contact
    if (!contact) return
    wx.setClipboardData({
      data: contact,
      success: () => wx.showToast({ title: '已复制联系方式', icon: 'none' }),
    })
  },

  goPublish() {
    wx.navigateTo({ url: '/pages/publishResource/publishResource' })
  },
})
