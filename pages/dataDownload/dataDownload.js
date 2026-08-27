// 公共数据下载页：像离线地图包一样按省/市/县下载公共摊点数据
// 下载后地图才显示对应区域的公共摊点；未下载区域的公共摊点不显示
const { callCloud } = require('../../utils/cloud')

const PKG_KEY = 'offlineRegionPackages'

Page({
  data: {
    tree: [],       // [{province, expanded, cities: [{city, expanded, total, districts: [{district, count, key, province, city, downloaded}]}]}]
    loading: true,
    updating: false, // 基础数据库更新中
  },

  onShow() { this.load() },

  // 更新公共摆摊基础数据库（原管理员导入功能并入此处；seedSpots 幂等，只补缺失点位）
  // 提示用户：已下载的数据包不会自动刷新，新数据需重新下载对应区域
  async updateBase() {
    if (this.data.updating) return
    this.setData({ updating: true })
    const r = await callCloud('seedSpots')
    this.setData({ updating: false })
    if (!r.ok) {
      wx.showToast({ title: r.message || '更新失败，请重试', icon: 'none' })
      return
    }
    const d = r.data || {}
    if (d.added > 0) {
      wx.showModal({
        title: '基础数据库已更新',
        content: `本次新增 ${d.added} 个官方点位（另有 ${d.skipped} 个已存在）。已下载的数据包不会自动刷新，如需查看新点位请重新下载对应区域。`,
        confirmText: '好的',
        showCancel: false,
        success: () => this.load(),
      })
    } else {
      wx.showToast({ title: '已是最新，共 ' + (d.total || 0) + ' 个官方点位', icon: 'none' })
    }
  },

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

  // 整市一键下载：全部下级区县的数据包都下载
  // 优先一次云端调用整市拉取；若云端还是旧版 getRegionSpots（不认省+市、报「缺少区域参数」），
  // 自动降级为逐个区县下载，效果一致（各区县数据包全部落地）
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
        let groups = {}
        let total = 0

        // 1) 尝试整市一次拉取（新版云函数）
        const r = await callCloud('getRegionSpots', { province: city.province, city: city.city })
        if (r.ok) {
          total = (r.data || []).length
          ;(r.data || []).forEach(s => {
            const d = s.district || '其他'
            ;(groups[d] = groups[d] || []).push(s)
          })
        } else if (r.code === 'INVALID') {
          // 2) 云端为旧版：逐区县下载（全部下级区域都下载）
          for (const d of city.districts) {
            const rd = await callCloud('getRegionSpots', { province: city.province, city: city.city, district: d.district })
            if (rd.ok) {
              total += (rd.data || []).length
              groups[d.district] = rd.data || []
            }
          }
        }

        wx.hideLoading()
        if (!Object.keys(groups).length) {
          wx.showToast({ title: '下载失败，请重试', icon: 'none' })
          return
        }
        // 按区县逐包写入本地（与单个下载的存储结构一致）
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
        this.doneHint(total, city.city)
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
