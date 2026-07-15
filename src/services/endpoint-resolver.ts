import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

/**
 * 端点发现（去掉写死 sub.jc116.com）：
 * 启动时从「发现源」拉取 endpoints.json，得到 api_bases / sub_base / download_base，
 * 之后换域名 / 换内穿 / 切线路只改后台 + endpoints.json，客户端下次启动自动跟随。
 *
 * 发现失败 → 用本地缓存；再没有 → 用内置默认。任何一步都不阻塞启动。
 */

// 写死的两条主线路：神仙云1=国内直连域名, 神仙云2=国外(Cloudflare)域名。
// 始终排在最前，保证任何情况下都有稳定的国内+国外入口；
// endpoints.json 的 api_bases 里的其它地址去重后接在其后（神仙云3/4…）。
export const PINNED_API_BASES = [
  'https://api.sxnn.de:5443', // 神仙云1 国内直连
  'https://sxnn.de', // 神仙云2 国外(CF)
]
// 内置兜底默认值（发现源全挂时用第一条写死线路）
export const DEFAULT_API_BASE = PINNED_API_BASES[0]

// 完整线路列表 = 写死主线路(神仙云1/2) + 发现到的 api_bases(神仙云3/4…, 去重, 排后面)
const allApiBases = (): string[] => {
  const merged = [...PINNED_API_BASES]
  for (const b of readCache()?.api_bases ?? []) {
    if (b && !merged.includes(b)) merged.push(b)
  }
  return merged
}

// 发现锚点：第一个是 web 后台「保存并发布」自动上传的 endpoints.json（唯一真源，dufs），
// 后两个是备份（GitHub 手动同步、app 动态接口）。
const DISCOVERY_URLS = [
  'https://sxy.sxnn.de:5443/endpoints.json',
  'http://114.80.36.225:5011/endpoints.json',
  'https://raw.githubusercontent.com/abxian/shenxianyun-config/main/endpoints.json',
  'https://sxnn.de/api/endpoints',
]

const STORAGE_KEY = 'shenxianyun.endpoints'
const ACTIVE_BASE_KEY = 'shenxianyun.apiBaseActive'

export type Endpoints = {
  version?: number
  api_bases?: string[]
  sub_base?: string
  download_base?: string
  bootstrap_proxy?: string
  updated_at?: string
}

const normalizeBase = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const v = value.trim().replace(/\/+$/, '')
  return /^https?:\/\//.test(v) ? v : ''
}

// 兜底代理：允许 http/socks5 URL；不像 base 那样去尾斜杠。
const normalizeProxy = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const v = value.trim()
  return /^(https?|socks5h?):\/\//.test(v) ? v : ''
}

const sanitize = (data: unknown): Endpoints | null => {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const bases = Array.isArray(raw.api_bases)
    ? raw.api_bases.map(normalizeBase).filter(Boolean)
    : []
  if (!bases.length) return null
  return {
    version: Number(raw.version) || 0,
    api_bases: bases,
    sub_base: normalizeBase(raw.sub_base),
    download_base: normalizeBase(raw.download_base),
    bootstrap_proxy: normalizeProxy(raw.bootstrap_proxy),
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : '',
  }
}

const readCache = (): Endpoints | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? sanitize(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/** 当前应使用的 API 基址：探测出的可用地址 > 缓存列表第一个 > 内置默认。同步、永不抛错。 */
export const getApiBase = (): string => {
  const active = normalizeBase(localStorage.getItem(ACTIVE_BASE_KEY))
  if (active) return active
  return allApiBases()[0] || DEFAULT_API_BASE
}

export const getEndpoints = (): Endpoints | null => readCache()

/** 兜底代理（HTTP/SOCKS5）：直连+系统代理都连不上 web 时的最后一条路。无则空串。 */
export const getBootstrapProxy = (): string =>
  normalizeProxy(readCache()?.bootstrap_proxy)

/** 拉取发现源（依次尝试，8s 超时），成功则缓存。失败静默返回缓存/null。 */
export const refreshEndpoints = async (): Promise<Endpoints | null> => {
  for (const url of DISCOVERY_URLS) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 8000)
      const res = await tauriFetch(url, { method: 'GET', signal: ctrl.signal })
      clearTimeout(t)
      if (!res.ok) continue
      const parsed = sanitize(await res.json())
      if (parsed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
        return parsed
      }
    } catch {
      // 下一个发现源
    }
  }
  return readCache()
}

// 一次 GET 探测：proxyUrl 传入时经该代理（软件内核混合端口）出网，否则本机直连。
const probeOnce = async (
  url: string,
  proxyUrl: string | undefined,
  timeout: number,
): Promise<boolean> => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await tauriFetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      ...(proxyUrl ? { proxy: { all: proxyUrl } } : {}),
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

// 判断一条线路是否可用：先本机直连；直连不通且传了 proxyUrl（内核在跑）时，
// 再经内核端口重试一次——内核带 sxnn.de/jc116.com 直连规则，能绕开系统级
// OpenClash/fake-ip 把自家服务器误路由到国外节点的问题。任一成功即可用。
const reachable = async (base: string, proxyUrl?: string): Promise<boolean> => {
  const url = `${base}/api/app-version`
  if (await probeOnce(url, undefined, 7000)) return true
  if (proxyUrl && (await probeOnce(url, proxyUrl, 7000))) return true
  // 最后一档：后台下发的兜底代理
  const boot = getBootstrapProxy()
  if (boot && boot !== proxyUrl && (await probeOnce(url, boot, 7000))) return true
  return false
}

/** 逐个探测 api_bases，第一个通的设为 active。proxyUrl=内核混合端口（可选兜底）。 */
export const pickApiBase = async (proxyUrl?: string): Promise<string> => {
  for (const base of allApiBases()) {
    if (await reachable(base, proxyUrl)) {
      localStorage.setItem(ACTIVE_BASE_KEY, base)
      return base
    }
  }
  return getApiBase()
}

/** 当前全部候选线路 = 写死主线路(神仙云1/2) + 发现的 api_bases(神仙云3/4…)。 */
export const listApiBases = (): string[] => allApiBases()

/** 写死的主线路条数（神仙云1/2），UI 用来判断"前两条是否都不通"。 */
export const pinnedCount = (): number => PINNED_API_BASES.length

/** 探测单条线路是否可用。proxyUrl=内核混合端口（可选兜底）。 */
export const probeApiBase = async (
  base: string,
  proxyUrl?: string,
): Promise<boolean> => reachable(base, proxyUrl)

/** 手动指定当前线路（页面上点选线路时用）。 */
export const setActiveApiBase = (base: string): void => {
  const v = normalizeBase(base)
  if (v) localStorage.setItem(ACTIVE_BASE_KEY, v)
}

/** 请求失败时调用：把当前 active 基址作废并顺延到下一个候选，返回新基址。 */
export const rotateApiBase = async (proxyUrl?: string): Promise<string> => {
  const bad = getApiBase()
  for (const base of allApiBases().filter((b) => b !== bad)) {
    if (await reachable(base, proxyUrl)) {
      localStorage.setItem(ACTIVE_BASE_KEY, base)
      return base
    }
  }
  return bad
}

/** 启动时调用一次：刷新发现源 + 探测可用基址（后台执行，不阻塞 UI）。 */
export const initEndpointDiscovery = async (proxyUrl?: string): Promise<void> => {
  await refreshEndpoints()
  await pickApiBase(proxyUrl)
}

/** 官方域名直连列表：生成占位/规则时使用，避免客户端把自家 API/订阅域名也代理了。 */
export const officialDirectRules = (): string[] => {
  const hosts = new Set<string>(['jc116.com', 'sxnn.de'])
  const cached = readCache()
  const collect = (value?: string) => {
    if (!value) return
    try {
      const host = new URL(value).hostname
      if (host && !/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        // 取注册域（简单处理：保留完整主机名后缀即可满足 DOMAIN-SUFFIX）
        hosts.add(host.split('.').slice(-2).join('.'))
      }
    } catch {
      // 忽略坏值
    }
  }
  for (const b of cached?.api_bases ?? []) collect(b)
  collect(cached?.sub_base)
  collect(cached?.download_base)
  return [...hosts].map((h) => `DOMAIN-SUFFIX,${h},DIRECT`)
}
