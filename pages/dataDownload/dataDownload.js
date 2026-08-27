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
      // 区分具体失败原因：未部署 / 云端旧版本仍校验管理员 / 其他
      const tip = r.code === 'NOT_DEPLOYED' ? '云函数 seedSpots 未部署，请先上传部署'
        : r.code === 'FORBIDDEN' ? '云端 seedSpots 是旧版本（仍校验管理员），请重新部署该云函数'
        : (r.message || '更新失败，请重试')
      wx.showToast({ title: tip, icon: 'none', duration: 3000 })
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

  // 自动修复 + 诊断：播种基础库后重试拉取；仍失败时逐项探测云端状态
  // 返回 {ok:true, retry} 或 {ok:false, lines:[诊断结论], ...}
  // 典型故障（云端云函数版本不一致）：
  //   seedSpots 旧版仍校验管理员 → FORBIDDEN，播种被拒，基础库一直为空
  //   seedSpots 未部署 → NOT_DEPLOYED
  //   基础库有数据但 getRegionSpots 拉不到 → 下载接口版本问题
  async healAndDiagnose(city) {
    // 1) 触发播种（新版 seedSpots 无管理员校验、幂等，直接当修复动作）
    const seed = await callCloud('seedSpots', { autoseed: true }, { silent: true })
    // 2) 播种后重试拉取
    const retry = await this.fetchCitySpots(city)
    if (retry.total) return { ok: true, retry, seed }

    // 3) 仍拉不到：逐项探测，生成可执行的诊断结论
    const list = await callCloud('listRegionPackages', {}, { silent: true })
    const baseTotal = list.ok
      ? (list.data || []).reduce((s, d) => s + (d.count || 0), 0)
      : -1
    const lines = []
    const seedCode = seed && seed.code
    if (!seed || !seed.ok) {
      if (seedCode === 'NOT_DEPLOYED') {
        lines.push('云函数 seedSpots 未部署')
      } else if (seedCode === 'FORBIDDEN') {
        lines.push('云端 seedSpots 是旧版本（仍校验管理员身份，导入被拒绝）')
      } else {
        lines.push('基础数据导入失败（' + ((seed && seed.message) || '网络异常') + '）')
      }
    } else {
      const d = seed.data || {}
      lines.push(`基础数据导入正常：共 ${d.total || 0} 个点位（本次新增 ${d.added || 0}）`)
    }
    if (baseTotal > 0) {
      lines.push(`云端基础库已有 ${baseTotal} 个点位，但下载接口拉取结果为 0（getRegionSpots 版本过旧）`)
    } else if (baseTotal === 0) {
      lines.push('云端基础库为空（导入未生效）')
    }
    return { ok: false, retry, seed, baseTotal, lines }
  },

  // 诊断报告弹窗：明确告诉用户云端哪个云函数有问题、该怎么做
  showDiagnosis(lines, rep) {
    // 根据实际故障精简提示：基础库已有数据且 seed 正常时，只需部署 getRegionSpots
    const seedOk = rep && rep.seed && rep.seed.ok
    const baseHasData = rep && rep.baseTotal > 0
    let fixLines = []
    if (!seedOk) {
      fixLines.push('① seedSpots（基础数据导入）')
      fixLines.push('② getRegionSpots（区域数据拉取）')
      fixLines.push('③ listRegionPackages（目录统计）')
    } else if (baseHasData) {
      fixLines.push('① getRegionSpots（区域数据拉取）')
    } else {
      fixLines.push('① seedSpots（基础数据导入）')
      fixLines.push('② getRegionSpots（区域数据拉取）')
      fixLines.push('③ listRegionPackages（目录统计）')
    }

    wx.showModal({
      title: '下载失败 · 诊断结果',
      content: lines.join('；') +
        '。\n\n解决办法：在微信开发者工具左侧展开 cloudfunctions 目录，右键以下云函数选择「上传并部署：云端安装依赖」——\n' +
        fixLines.join('\n') + '\n部署完成后回到本页重试即可。',
      confirmText: '我知道了',
      showCancel: false,
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
        // 静默调用：失败提示统一由本页处理（区分未部署 / 网络异常 / 云端数据为空）
        const r = await callCloud('getRegionSpots', { province, city, district }, { silent: true })
        let spots = r.ok ? (r.data || []) : []
        if (!spots.length) {
          // 拉不到数据：自动修复（播种基础库后重试），仍失败则弹出诊断报告
          wx.showLoading({ title: '自动修复中…', mask: true })
          const pseudoCity = { province, city, districts: [{ district }] }
          const rep = await this.healAndDiagnose(pseudoCity)
          wx.hideLoading()
          if (rep.ok) {
            spots = rep.retry.groups[district] || []
          } else {
            if (r.code === 'NOT_DEPLOYED' && rep.seed && rep.seed.code === 'NOT_DEPLOYED') {
              wx.showToast({ title: '云函数 getRegionSpots / seedSpots 未部署', icon: 'none', duration: 3000 })
            } else {
              this.showDiagnosis(rep.lines, rep)
            }
            return
          }
        } else {
          wx.hideLoading()
        }
        if (!spots.length) {
          wx.showToast({ title: '该区域暂无公共数据', icon: 'none' })
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

  // 拉取整市公共点位：优先一次调用整市拉取（新版云函数）；
  // 调用失败（旧版云函数不认省+市 / 网络异常 / 未部署）或拉到 0 条时，
  // 自动降级为逐区县拉取，全部下级区域照常落地
  async fetchCitySpots(city) {
    let groups = {}
    let total = 0
    let lastCode = ''

    const r = await callCloud('getRegionSpots', { province: city.province, city: city.city }, { silent: true })
    if (r.ok) {
      total = (r.data || []).length
      ;(r.data || []).forEach(s => {
        const d = s.district || '其他'
        ;(groups[d] = groups[d] || []).push(s)
      })
    } else {
      lastCode = r.code || '' // INVALID=旧版云函数 / NETWORK / NOT_DEPLOYED
    }

    if (!Object.keys(groups).length) {
      for (const d of city.districts) {
        const rd = await callCloud(
          'getRegionSpots',
          { province: city.province, city: city.city, district: d.district },
          { silent: true },
        )
        if (rd.ok) {
          lastCode = ''
          total += (rd.data || []).length
          groups[d.district] = rd.data || []
        } else {
          lastCode = rd.code || lastCode
        }
      }
    }
    return { groups, total, lastCode }
  },

  // 整市一键下载：全部下级区县的数据包都下载
  // 三重容错：①整市一次拉取 ②失败/拉空降级逐区县 ③仍为空自动初始化基础库后重试
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
        let { groups, total, lastCode } = await this.fetchCitySpots(city)

        // 自愈：一个点位都没拿到（或报未部署）→ 播种基础库后重试；
        // 仍失败则弹出诊断报告（指明云端哪个云函数版本有问题、该部署哪个）
        if (!total) {
          const rep = await this.healAndDiagnose(city)
          if (rep.ok) {
            groups = rep.retry.groups
            total = rep.retry.total
            lastCode = rep.retry.lastCode
          } else {
            wx.hideLoading()
            if (lastCode === 'NOT_DEPLOYED' && rep.seed && rep.seed.code === 'NOT_DEPLOYED') {
              wx.showToast({ title: '云函数 getRegionSpots / seedSpots 未部署', icon: 'none', duration: 3000 })
            } else if (lastCode === 'NETWORK') {
              wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
            } else {
              this.showDiagnosis(rep.lines, rep)
            }
            return
          }
        }

        wx.hideLoading()
        if (!total) {
          wx.showToast({ title: '云端公共数据为空', icon: 'none', duration: 2500 })
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
