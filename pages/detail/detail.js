const { callCloud } = require('../../utils/cloud')

const REVIEW_TAGS = [
  { name: '人流大', selected: false },
  { name: '生意好', selected: false },
  { name: '位置佳', selected: false },
  { name: '环境差', selected: false },
]

Page({
  data: {
    spot: null,
    reviews: [],
    favorited: false,
    followed: false,     // 是否已关注发布者
    isOwner: false,
    iReviewed: false,      // 当前用户是否已评
    showForm: false,       // 是否展开评价表单
    submitting: false,
    reviewTags: REVIEW_TAGS,
    form: { rating: 5, tags: [], content: '' },
  },

  onLoad(options) {
    this.spotId = options.id
    this.load()
  },

  async load() {
    // 并行请求详情+评价（服务端已返回 isOwner/favorited，无需再调 getUser）
    const [r, rv] = await Promise.all([
      callCloud('getSpotDetail', { spotId: this.spotId }),
      callCloud('getReviews', { spotId: this.spotId }),
    ])
    if (!r.ok) return
    const spot = r.data
    const cur = spot.current || {}
    this.setData({ spot: { ...spot, cur }, isOwner: !!spot.isOwner, favorited: !!spot.favorited, followed: !!spot.followed })

    if (rv.ok) {
      const my = rv.myReview
      this.setData({
        reviews: rv.data,
        iReviewed: !!my,
        'form.rating': (my && my.rating) || 5,
      })
    }
  },

  async toggleFav() {
    const r = await callCloud('toggleFavorite', { spotId: this.spotId })
    if (r.ok) this.setData({ favorited: r.data.favorited })
  },

  // 关注 / 取消关注发布者（关注后，TA 公开发的地点进入地图"关注分享"图层）
  async toggleFollow() {
    const spot = this.data.spot
    if (!spot || !spot.creatorOpenid) return
    const r = await callCloud('toggleFollow', { targetOpenid: spot.creatorOpenid })
    if (r.ok) {
      this.setData({ followed: !!r.data.followed })
      wx.showToast({ title: r.data.followed ? '已关注，TA 的新地点将出现在关注图层' : '已取消关注', icon: 'none' })
    }
  },

  goEdit() {
    wx.navigateTo({ url: `/pages/publish/publish?id=${this.spotId}` })
  },

  del() {
    // 二次确认，避免误触直接删除
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，该地点的评价与收藏也会一并清除。',
      confirmText: '删除',
      confirmColor: '#e64340',
      success: (m) => { if (m.confirm) this.doDelete() },
    })
  },

  async doDelete() {
    const r = await callCloud('deleteSpot', { spotId: this.spotId })
    if (r.ok) {
      wx.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    }
  },

  // ===== 评价 =====
  openForm() {
    this.setData({ showForm: true })
  },

  setRating(e) {
    this.setData({ 'form.rating': Number(e.currentTarget.dataset.v) })
  },

  toggleTag(e) {
    const name = e.currentTarget.dataset.tag
    const reviewTags = this.data.reviewTags.map(t =>
      t.name === name ? { ...t, selected: !t.selected } : t
    )
    this.setData({
      reviewTags,
      'form.tags': reviewTags.filter(t => t.selected).map(t => t.name),
    })
  },

  onContent(e) {
    this.setData({ 'form.content': e.detail.value })
  },

  async submitReview() {
    const f = this.data.form
    if (f.rating < 1) return wx.showToast({ title: '请选择星级', icon: 'none' })
    if (this.data.submitting) return
    this.setData({ submitting: true })
    const r = await callCloud('addReview', {
      spotId: this.spotId,
      rating: f.rating,
      tags: f.tags,
      content: f.content,
    })
    this.setData({ submitting: false })
    if (r.ok) {
      wx.showToast({ title: '评价成功', icon: 'success' })
      // 重置表单并刷新聚合评分与列表
      this.setData({
        iReviewed: true,
        showForm: false,
        'form.content': '',
        reviewTags: REVIEW_TAGS.map(t => ({ ...t, selected: false })),
      })
      this.load()
    }
  },
})
