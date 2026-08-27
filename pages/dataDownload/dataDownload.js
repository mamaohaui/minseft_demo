// 公共数据下载页：像离线地图包一样按省/市/县下载公共摊点数据
// 下载后地图才显示对应区域的公共摊点；未下载区域的公共摊点不显示
// 「更新数据」已整合进下载动作：每次下载自动同步官方最新基础点位，无需单独更新
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

  // 拉取公共点位（下载 = 更新 + 拉取，一步到位）
  // ① 首选 seedSpots({withData})：新版云函数播种补齐缺失点位后直接返回全部基础库点位
  //    —— 每次下载都自动同步官方最新数据，无需单独「更新数据」
  // ② 云端 seedSpots 为旧版（不返回 spots）时，退回 getRegionSpots 拉取：
  //    先整市一次拉取，再降级逐区县拉取，全部下级区域照常落地
  // 返回 { groups: {区县: [点位]}, total, seed }
  async fetchCitySpots(city) {
    let groups = {}
    let total = 0

    // ① 更新 + 拉取一体化：seedSpots 新版直接返回全部基础库点位（含 province/city/district）
    const seed = await callCloud('seedSpots', { withData: true }, { silent: true })
    const seedSpots = seed.ok && seed.data && Array.isArray(seed.data.spots) ? seed.data.spots : null
    if (seedSpots && seedSpots.length) {
      seedSpots.forEach(s => {
        if (s.province !== city.province || s.city !== city.city) return
        const d = s.district || '其他'
        ;(groups[d] = groups[d] || []).push(s)
        total++
      })
      if (total) return { groups, total, seed }
    }

    // ② 退回 getRegionSpots（兼容云端旧版部署组合）
    const r = await callCloud('getRegionSpots', { province: city.province, city: city.city }, { silent: true })
    if (r.ok && (r.data || []).length) {
      total = r.data.length
      r.data.forEach(s => {
        const d = s.district || '其他'
        ;(groups[d] = groups[d] || []).push(s)
      })
    } else {
      // 整市接口不可用（旧版 / 未部署）：逐区县拉取
      for (const d of city.districts) {
        const rd = await callCloud(
          'getRegionSpots',
          { province: city.province, city: city.city, district: d.district },
          { silent: true },
        )
        if (rd.ok && (rd.data || []).length) {
          total += rd.data.length
          groups[d.district] = rd.data
        }
      }
    }
    return { groups, total, seed }
  },

  // 下载失败时的诊断：明确指出云端哪个云函数版本有问题、该部署哪个
  // （seed 为下载时 seedSpots 的调用结果，直接复用，不重复请求云端）
  async diagnose(city, seed) {
    const lines = []
    let onlyDeploy = []
    const list = await callCloud('listRegionPackages', {}, { silent: true })
    const baseTotal = list.ok
      ? (list.data || []).reduce((s, d) => s + (d.count || 0), 0)
      : -1

    if (!seed || !seed.ok) {
      if (seed && seed.code === 'NOT_DEPLOYED') {
        lines.push('云函数 seedSpots 未部署')
        onlyDeploy.push('① seedSpots（基础数据更新+下载，最关键）')
      } else if (seed && seed.code === 'FORBIDDEN') {
        lines.push('云端 seedSpots 是旧版本（仍校验管理员身份，导入被拒绝）')
        onlyDeploy.push('① seedSpots（基础数据更新+下载，最关键）')
      } else {
        lines.push('基础数据同步失败（网络异常）')
      }
    } else if (!(seed.data && Array.isArray(seed.data.spots))) {
      // seedSpots 成功但没有返回点位数据：云端是「无管理员校验」的中间版本
      lines.push(`云端 seedSpots 为旧版本（不能直接返回下载数据；基础库共 ${baseTotal > 0 ? baseTotal : ((seed.data && seed.data.total) || 0)} 个点位）`)
      onlyDeploy.push('① seedSpots（基础数据更新+下载，最关键）')
    }

    if (!onlyDeploy.length && baseTotal > 0) {
      lines.push(`云端基础库已有 ${baseTotal} 个点位，但下载接口均未返回数据（getRegionSpots 版本过旧）`)
      onlyDeploy.push('① getRegionSpots（区域数据拉取）')
    }
    if (!lines.length) lines.push('云端公共数据为空')

    wx.showModal({
      title: '下载失败 · 诊断结果',
      content: lines.join('；') +
        '。\n\n解决办法：在微信开发者工具左侧展开 cloudfunctions 目录，右键以下云函数选择「上传并部署：云端安装依赖」——\n' +
        (onlyDeploy.length ? onlyDeploy.join('\n') : '① seedSpots（基础数据更新+下载）\n② getRegionSpots（区域数据拉取）') +
        '\n部署完成后回到本页重试即可。',
      confirmText: '我知道了',
      showCancel: false,
    })
  },

  // 下载单个区县数据包：拉取该区县全部公共点位存入本地
  download(e) {
    const { key, province, city, district } = e.currentTarget.dataset
    this.confirmDownload(
      '下载数据包',
      `确定下载「${district}」的公共摊点数据吗？将自动同步官方最新数据，下载后地图公共图层显示该区域摊点。`,
      async () => {
        wx.showLoading({ title: '下载中…', mask: true })
        const pseudoCity = { province, city, districts: [{ district }] }
        const { groups, seed } = await this.fetchCitySpots(pseudoCity)
        const spots = groups[district] || []
        wx.hideLoading()
        if (!spots.length) {
          await this.diagnose(pseudoCity, seed)
          return
        }
        const pkgs = wx.getStorageSync(PKG_KEY) || {}
        pkgs[key] = {
          province, city, district,
          count: spots.length,
          downloadedAt: Date.now(),
          spots,
        }
        wx.setStorageSync(PKG_KEY, pkgs)
        this.refreshFlags()
        this.doneHint(spots.length, district)
      },
    )
  },

  // 整市一键下载：全部下级区县的数据包都下载（自动同步官方最新数据）
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
      `确定下载「${city.city}」全部 ${city.districts.length} 个区县（共 ${city.total} 个摊点）的数据包吗？将自动同步官方最新数据。`,
      async () => {
        wx.showLoading({ title: '下载中…', mask: true })
        const { groups, total, seed } = await this.fetchCitySpots(city)
        wx.hideLoading()
        if (!total) {
          await this.diagnose(city, seed)
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
        // 若官方新增了目录之外的点位所属区县，提示重进本页刷新列表
        const newDistricts = Object.keys(groups).filter(d =>
          !city.districts.some(x => x.district === d))
        if (newDistricts.length) {
          wx.showToast({ title: '检测到新区县数据，列表已更新', icon: 'none', duration: 2000 })
          this.load()
        }
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
