const { callCloud } = require('../../utils/cloud')
const { CATEGORIES, SPOT_TYPES } = require('../../utils/constants')

const SEARCH_DEBOUNCE = 400 // 输入停 400ms 后自动搜索

Page({
  data: {
    keyword: '',
    creator: '',
    category: '',   // 已选品类（空 = 不限）
    spotType: '',   // 已选地点类型（空 = 不限）
    categories: CATEGORIES,
    spotTypes: SPOT_TYPES,
    results: [],
    searched: false,
    searching: false,
    hasCond: false, // 是否存在任意筛选条件（WXML 展示"清空筛选"用）
  },

  // 同步 hasCond 标志位
  syncHasCond() {
    this.setData({ hasCond: this.hasCondition() })
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
    this.syncHasCond()
    this.debounceSearch()
  },

  onCreatorInput(e) {
    this.setData({ creator: e.detail.value })
    this.syncHasCond()
    this.debounceSearch()
  },

  // 防抖：停止输入 400ms 后自动搜索
  debounceSearch() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
    this._debounceTimer = setTimeout(() => this.doSearch(true), SEARCH_DEBOUNCE)
  },

  // 品类 chips：再点一次取消选择
  toggleCategory(e) {
    const v = e.currentTarget.dataset.value
    this.setData({ category: this.data.category === v ? '' : v })
    this.syncHasCond()
    this.doSearch(true)
  },

  // 地点类型 chips：再点一次取消选择
  toggleSpotType(e) {
    const v = e.currentTarget.dataset.value
    this.setData({ spotType: this.data.spotType === v ? '' : v })
    this.syncHasCond()
    this.doSearch(true)
  },

  // 是否存在任意筛选条件
  hasCondition() {
    return !!(this.data.keyword.trim() || this.data.creator.trim() || this.data.category || this.data.spotType)
  },

  // 当前条件是否全空（用于清空结果复位）
  allEmpty() {
    return !this.hasCondition()
  },

  async doSearch(silent) {
    if (this.allEmpty()) {
      this.setData({ results: [], searched: false })
      if (!silent) wx.showToast({ title: '请至少输入一个搜索条件', icon: 'none' })
      return
    }
    // 条件组合缓存：完全相同不重复请求
    const cacheKey = JSON.stringify([
      this.data.keyword.trim(), this.data.creator.trim(), this.data.category, this.data.spotType,
    ])
    if (cacheKey === this._lastKey && this.data.searched) return
    this._lastKey = cacheKey

    this.setData({ searching: true })
    const r = await callCloud('searchSpots', {
      keyword: this.data.keyword.trim(),
      creator: this.data.creator.trim(),
      category: this.data.category,
      spotType: this.data.spotType,
    })
    this.setData({ searching: false, searched: true, results: r.ok ? r.data : [] })
  },

  // 清空全部筛选
  resetAll() {
    this.setData({ keyword: '', creator: '', category: '', spotType: '', results: [], searched: false, hasCond: false })
    this._lastKey = null
  },

  onUnload() {
    if (this._debounceTimer) clearTimeout(this._debounceTimer)
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` })
  },
})
