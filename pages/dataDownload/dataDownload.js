// 公共数据下载页：像离线地图包一样按省/市/县下载公共摊点数据
// 下载后地图才显示对应区域的公共摊点；未下载区域的公共摊点不显示
const { callCloud } = require('../../utils/cloud')

const PKG_KEY = 'offlineRegionPackages'

Page({
  data: {
    tree: [],       // [{province, expanded, cities: [{city, expanded, total, districts: [{district, count, key, province, city, downloaded}]}]}]
    loading: true,
  },

  onShow() { this.load() },

  async load() {
    this.setData({ loading: true })
    const r = await callCloud('listRegionPackages')
    let tree = []
    if (r.ok) {
      // 首次进入时云端自动初始化公共数据库（播种基础点位），提示一下
      if (r.seeded && (r.data || []).length) {
        wx.showToast({ title: '公共数据库初始化完成', icon: 'none', duration: 2000 })
      }
      const pmap = {}
      ;(r.data || []).forEach(it => {
        const key = `${it.province}|${it.city}|${it.district}`
        const p = pmap[it.province] = pmap[it.province] || { province: it.province, cities: {} }
        const c = p.cities[it.city] = p.cities[it.city] || { city: it.city, districts: [] }
        c.districts.push({
          district: it.district,
          count: it.count,
          key,
          province: it.province,
          city: it.city,
        })
      })
      // 层级树：省 / 市默认展开（层级一目了然），市行汇总区县数与摊点总数
      tree = Object.values(pmap).map(p => ({
        province: p.province,
        expanded: true,
        cities: Object.values(p.cities).map(c => ({
          city: c.city,
          expanded: true,
          districts: c.districts,
          total: c.districts.reduce((s, d) => s + d.count, 0),
        })),
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
      cities: p.cities.map(c => {
        const districts = c.districts.map(d => ({ ...d, downloaded: !!pkgs[d.key] }))
        const dl = districts.filter(d => d.downloaded).length
        return {
          ...c,
          districts,
          downloadedCount: dl,
          allDownloaded: districts.length > 0 && dl === districts.length,
        }
      }),
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

  // 下载前确认弹窗（点「确定」才开始下载）
  confirmDownload(title, content, onConfirm) {
    wx.showModal({
      title,
      content,
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => { if (res.confirm) onConfirm() },
    })
  },

  // 下载完成后提示，可一键跳回地图查看公共图层
  doneHint(count, name) {
    wx.showModal({
      title: '下载完成',
      content: `「${name}」${count} 个公共摊点已下载，地图「公共摊点」图层将显示这些点位。`,
      confirmText: '去地图',
      cancelText: '留在这',
      success: (res) => { if (res.confirm) wx.switchTab({ url: '/pages/map/map' }) },
    })
  },

  // 下载单个区县数据包：拉取该区县全部公共点位存入本地
  download(e) {
    const { key, province, city, district } = e.currentTarget.dataset
    this.confirmDownload(
      '下载数据包',
      `确定下载「${district}」的公共摊点数据吗？下载后地图公共图层将显示该区域摊点。`,
      async () => {
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
        this.refreshFlags()
        this.doneHint(r.count || (r.data || []).length, district)
      },
    )
  },

  // 整市一键下载：一次云端调用拉取该市全部公共点位，前端按区县分组写入数据包
  downloadCity(e) {
    const { pi, ci } = e.currentTarget.dataset
    const city = this.data.tree[pi].cities[ci]
    const missing = city.districts.filter(d => !d.downloaded)
    if (!missing.length) {
      wx.showToast({ title: '该市数据已全部下载', icon: 'none' })
      return
    }
    this.confirmDownload(
      '下载整市数据',
      `确定下载「${city.city}」全部 ${city.districts.length} 个区县（共 ${city.total} 个摊点）的数据包吗？`,
      async () => {
        wx.showLoading({ title: '下载中…', mask: true })
        const r = await callCloud('getRegionSpots', { province: city.province, city: city.city })
        wx.hideLoading()
        if (!r.ok) {
          wx.showToast({ title: r.message || '下载失败，请重试', icon: 'none' })
          return
        }
        // 按区县分组，逐区县写入本地数据包（与单个下载的存储结构一致）
        const groups = {}
        ;(r.data || []).forEach(s => {
          const d = s.district || '其他'
          ;(groups[d] = groups[d] || []).push(s)
        })
        const pkgs = wx.getStorageSync(PKG_KEY) || {}
        Object.keys(groups).forEach(d => {
          pkgs[`${city.province}|${city.city}|${d}`] = {
            province: city.province, city: city.city, district: d,
            count: groups[d].length,
            downloadedAt: Date.now(),
            spots: groups[d],
          }
        })
        wx.setStorageSync(PKG_KEY, pkgs)
        this.refreshFlags()
        this.doneHint((r.data || []).length, city.city)
      },
    )
  },

  // 删除单个区县数据包：删除后地图不再显示该区域公共摊点
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

  // 删除整市数据包
  removeCity(e) {
    const { pi, ci } = e.currentTarget.dataset
    const city = this.data.tree[pi].cities[ci]
    wx.showModal({
      title: '删除整市数据包',
      content: `确定删除「${city.city}」已下载的全部数据包吗？删除后地图不再显示该市公共摊点。`,
      confirmColor: '#ff3b30',
      success: (res) => {
        if (!res.confirm) return
        const pkgs = wx.getStorageSync(PKG_KEY) || {}
        city.districts.forEach(d => { delete pkgs[d.key] })
        wx.setStorageSync(PKG_KEY, pkgs)
        this.refreshFlags()
      },
    })
  },
})
