const { callCloud } = require('../../utils/cloud')

const SEARCH_DEBOUNCE = 400 // 输入停 400ms 后自动搜索

Page({
  data: { keyword: '', results: [], searched: false, searching: false },

  onInput(e) {
    const keyword = e.detail.value
    this.setData({ keyword })
    // 防抖：停止输入 400ms 后自动搜索；关键词清空则复位
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
    const kw = keyword.trim()
    if (!kw) {
      this.setData({ results: [], searched: false })
      return
    }
    this._debounceTimer = setTimeout(() => this.doSearch(true), SEARCH_DEBOUNCE)
  },

  async doSearch(silent) {
    const kw = this.data.keyword.trim()
    if (!kw) {
      if (!silent) wx.showToast({ title: '请输入关键词', icon: 'none' })
      return
    }
    // 相同关键词且已有结果，不重复请求
    if (kw === this._lastKeyword && this.data.searched) return
    this._lastKeyword = kw
    this.setData({ searching: true })
    const r = await callCloud('searchSpots', { keyword: kw })
    this.setData({ searching: false, searched: true, results: r.ok ? r.data : [] })
  },

  onUnload() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },
})
