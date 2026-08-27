// 公共数据下载页：像离线地图包一样按省/市/县下载公共摊点数据
// 下载后地图才显示对应区域的公共摊点；未下载区域的公共摊点不显示
const { callCloud } = require('../../utils/cloud')

const PKG_KEY = 'offlineRegionPackages'

Page({
  data: {
    tree: [],       // [{province, expanded, cities: [{city, expanded, districts: [{district, count, key, province, city, downloaded}]}]}]
    loading: true,
  },

  onShow() { this.load() },

  async load() {
    this.setData({ loading: true })
    const r = await callCloud('listRegionPackages')
    let tree = []
    if (r.ok) {
      const pmap = {}
      ;(r.data || []).forEach(it => {
        const key = `${it.province}|${it.city}|${it.district}`
        const p = pmap[it.province] = pmap[it.province] || { province: it.province, expanded: false, cities: {} }
        const c = p.cities[it.city] = p.cities[it.city] || { city: it.city, expanded: false, districts: [] }
        c.districts.push({
          district: it.district,
          count: it.count,
          key,
          province: it.province,
          city: it.city,
        })
      })
      tree = Object.values(pmap).map(p => ({
        province: p.province,
        expanded: false,
        cities: Object.values(p.cities),
      }))
    }
    this.setData({ tree, loading: false })
    this.refreshFlags()
  },

  // 按本地 storage 刷新"已下载"标记（不改云端数据）
  refreshFlags() {
    const pkgs = wx.getStorageSync(PKG_KEY) || {}
    const tree = this.data.tree.map(p => ({
      ...p,
      cities: p.cities.map(c => ({
        ...c,
        districts: c.districts.map(d => ({ ...d, downloaded: !!pkgs[d.key] })),
      })),
    }))
    this.setData({ tree })
  },

  toggleProvince(e) {
    const i = Number(e.currentTarget.dataset.i)
    this.setData({ [`tree[${i}].expanded`]: !this.data.tree[i].expanded })
  },

  toggleCity(e) {
    const pi = Number(e.currentTarget.dataset.pi)
    const ci = Number(e.currentTarget.dataset.ci)
    this.setData({ [`tree[${pi}].cities[${ci}].expanded`]: !this.data.tree[pi].cities[ci].expanded })
  },

  // 下载区域数据包：拉取该区县全部公共点位存入本地
  async download(e) {
    const { key, province, city, district } = e.currentTarget.dataset
    wx.showLoading({ title: '下载中…', mask: true })
    const r = await callCloud('getRegionSpots', { province, city, district })
    wx.hideLoading()
    if (!r.ok) {
      wx.showToast({ title: r.message || '下载失败，请重试', icon: 'none' })
      return
    }
    const pkgs = wx.getStorageSync(PKG_KEY) || {}
    pkgs[key] = {
      province, city, district,
      count: (r.data || []).length,
      downloadedAt: Date.now(),
      spots: r.data || [],
    }
    wx.setStorageSync(PKG_KEY, pkgs)
    wx.showToast({ title: `已下载 ${r.count} 个摊点`, icon: 'success' })
    this.refreshFlags()
  },

  // 删除数据包：删除后地图不再显示该区域公共摊点
  remove(e) {
    const key = e.currentTarget.dataset.key
    wx.showModal({
      title: '删除数据包',
      content: '删除后地图上将不再显示该区域的公共摊点',
      confirmColor: '#ff3b30',
      success: (res) => {
        if (!res.confirm) return
        const pkgs = wx.getStorageSync(PKG_KEY) || {}
        delete pkgs[key]
        wx.setStorageSync(PKG_KEY, pkgs)
        this.refreshFlags()
      },
    })
  },
})
