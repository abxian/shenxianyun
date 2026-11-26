import { invoke } from '@tauri-apps/api/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { cloneHttpRequestInit } from '@/services/http-request-init'

/**
 * 端点发现（去掉写死 sub.jc116.com）：
 * 启动时从「发现源」拉取 endpoints.json，得到 api_bases / sub_base / download_base，
 * 之后换域名 / 换内穿 / 切线路只改后台 + endpoints.json，客户端下次启动自动跟随。
 *
 * 发现失败 → 用本地缓存；再没有 → 用内置默认。任何一步都不阻塞启动。
 */

// 首装和每次启动都先使用国内主域名。其它地址只在国内线路检测失败时兜底，
// 不能因为响应更快就抢占国内主线路。
export const PINNED_API_BASES = [
  'https://api.sxnn.de:5443', // 神仙云1 国内直连
]

export const ALTERNATE_API_BASE = 'https://sxy-api.52nm.de:5443'
export const ALTERNATE_DOWNLOAD_BASE = 'https://sxy.52nm.de:5443'
export const LEGACY_DOWNLOAD_BASE = 'https://sxy.sxnn.de:5443'
const RETIRED_API_HOSTS = new Set(['sub.jc116.com'])
export const DEFAULT_API_BASE = PINNED_API_BASES[0]

const allApiBases = (): string[] => {
  const discovered = (readCache()?.api_bases ?? []).filter(
    (base) => !RETIRED_API_HOSTS.has(new URL(base).hostname),
  )
  return [
    ...new Set([
      ...PINNED_API_BASES,
      ...discovered.filter(
        (base) => base.startsWith('https:') && base !== 'https://sxnn.de',
      ),
      ALTERNATE_API_BASE,
      'https://sxnn.de',
    ]),
  ]
}

const AUTHORITATIVE_DISCOVERY_URLS = [
  `${ALTERNATE_DOWNLOAD_BASE}/endpoints.json`,
  'https://raw.githubusercontent.com/abxian/shenxianyun-config/main/endpoints.json',
]
const LEGACY_DISCOVERY_URLS = [
  `${LEGACY_DOWNLOAD_BASE}/endpoints.json`,
  'https://sxnn.de/api/endpoints',
]

const STORAGE_KEY = 'shenxianyun.endpoints'
const ACTIVE_BASE_KEY = 'shenxianyun.apiBaseActive'
const TRUSTED_BASES_KEY = 'shenxianyun.trustedApiBases'

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
  try {
    const url = new URL(value.trim())
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return ''
    return url.href.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

// 兜底代理：允许 http/socks5 URL；不像 base 那样去尾斜杠。
const normalizeProxy = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const v = value.trim()
  return /^(https?|socks5h?):\/\//.test(v) ? v : ''
}

// 所有官方接口都执行完整 TLS 校验，不在客户端绕过无效证书。
let managementProxy: Promise<string> | undefined
export const getManagementProxy = () =>
  (managementProxy ||= invoke<string>('management_proxy_url').catch((error) => {
    managementProxy = undefined
    throw error
  }))

export const fetchWithVerifiedTls = async (
  url: string,
  init: Parameters<typeof tauriFetch>[1],
): ReturnType<typeof tauriFetch> => tauriFetch(url, cloneHttpRequestInit(init))

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
  const candidates = allApiBases()
  return candidates.includes(active)
    ? active
    : candidates[0] || DEFAULT_API_BASE
}

const trustedManagedOrigins = (): Set<string> => {
  const origins = new Set([
    DEFAULT_API_BASE,
    ALTERNATE_API_BASE,
    'https://sxnn.de',
  ])
  try {
    const bases: unknown = JSON.parse(
      localStorage.getItem(TRUSTED_BASES_KEY) || '[]',
    )
    if (Array.isArray(bases)) {
      for (const value of bases) {
        const base = normalizeBase(value)
        if (base.startsWith('https://')) origins.add(new URL(base).origin)
      }
    }
  } catch {
    // An unreadable cache leaves the built-in service aliases available.
  }
  return origins
}

/** Route existing credentials between authenticated aliases of the same service. */
export const routeManagedRequest = (
  url: string,
  savedApiBase?: string,
  savedSubscriptionUrl?: string,
): string => {
  try {
    const source = new URL(url)
    const target = new URL(getApiBase())
    const trusted = trustedManagedOrigins()
    const sameSavedApi =
      savedApiBase && source.origin === new URL(savedApiBase).origin
    if (
      source.origin === target.origin ||
      !trusted.has(target.origin) ||
      !(
        trusted.has(source.origin) ||
        sameSavedApi ||
        url === savedSubscriptionUrl
      ) ||
      source.username ||
      source.password ||
      !/^\/(?:managed-sub\/[^/]+|api\/v2\/client\/(?:verify|state|subscription|heartbeat|offline|relay|traffic))$/.test(
        source.pathname,
      )
    )
      return url
    return `${target.origin}${source.pathname}${source.search}`
  } catch {
    return url
  }
}

export const getEndpoints = (): Endpoints | null => readCache()

/** 兜底代理（HTTP/SOCKS5）：直连+系统代理都连不上 web 时的最后一条路。无则空串。 */
export const getBootstrapProxy = (): string =>
  normalizeProxy(readCache()?.bootstrap_proxy)

const fetchDiscovery = async (url: string): Promise<Endpoints> => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetchWithVerifiedTls(url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { 'Cache-Control': 'no-cache' },
    })
    if (!res.ok) throw new Error(`discovery HTTP ${res.status}`)
    const parsed = sanitize(await res.json())
    if (!parsed) throw new Error('invalid discovery payload')
    return parsed
  } finally {
    clearTimeout(t)
  }
}

const DISCOVERY_INTERVAL_MS = 5 * 60_000
let discoveredAt: number | undefined
let discoveryInFlight: Promise<Endpoints | null> | undefined

/** 后台周期刷新地址，发现失败时继续使用最近有效清单。 */
export const refreshEndpoints = (force = false): Promise<Endpoints | null> => {
  if (discoveryInFlight) return discoveryInFlight
  if (
    !force &&
    discoveredAt !== undefined &&
    Date.now() - discoveredAt < DISCOVERY_INTERVAL_MS
  )
    return Promise.resolve(readCache())
  discoveryInFlight = Promise.any(
    AUTHORITATIVE_DISCOVERY_URLS.map(fetchDiscovery),
  )
    .then((parsed) => {
      localStorage.setItem(
        TRUSTED_BASES_KEY,
        JSON.stringify([...(parsed.api_bases ?? []), parsed.sub_base]),
      )
      return parsed
    })
    .catch(() => Promise.any(LEGACY_DISCOVERY_URLS.map(fetchDiscovery)))
    .then((parsed) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
      discoveredAt = Date.now()
      return parsed
    })
    .catch(() => readCache())
    .finally(() => {
      discoveryInFlight = undefined
    })
  return discoveryInFlight
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
    const res = await fetchWithVerifiedTls(url, {
      method: 'GET',
      signal: ctrl.signal,
      ...(proxyUrl ? { proxy: { all: proxyUrl } } : {}),
    })
    if (!res.ok) return false
    const data = await res.json()
    return data?.ok === true && typeof data.latest_version_name === 'string'
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
  const url = `${base}/api/app-version?_=${Date.now()}`
  if (await probeOnce(url, undefined, 3500)) return true

  // 国内主线路也必须允许代理兜底：浏览器能访问而系统 DNS 被 fake-ip
  // 接管时，直连会失败，但经当前内核仍能正确完成 TLS 与 API 检测。
  // 所有线路在直连失败后并发尝试内核代理和后台兜底，避免串行等待。
  const boot = getBootstrapProxy()
  const fallbacks = [proxyUrl, boot]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index)
  if (!fallbacks.length) return false
  const results = await Promise.all(
    fallbacks.map((proxy) => probeOnce(url, proxy, 4000)),
  )
  return results.some(Boolean)
}

const firstReachable = async (
  bases: string[],
  proxyUrl?: string,
): Promise<string | null> => {
  const checks = bases.map(async (base) =>
    (await reachable(base, proxyUrl)) ? base : null,
  )
  for (const check of checks) {
    const base = await check
    if (base) return base
  }
  return null
}

/** 并发探测 api_bases，按列表优先级选择可用线路。proxyUrl=内核混合端口（可选兜底）。 */
export const pickApiBase = async (
  proxyUrl?: string,
): Promise<string | null> => {
  const base = await firstReachable(allApiBases(), proxyUrl)
  if (base) localStorage.setItem(ACTIVE_BASE_KEY, base)
  return base
}

/** 当前候选线路 = 国内主线路 + 国外/内穿兜底；旧域名已排除。 */
export const listApiBases = (): string[] => allApiBases()

/** 国内主线路条数，UI 仅在国内主线路失败时显示兜底线路。 */
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
  const tried = new Set(allApiBases())
  let base = await firstReachable(
    [...tried].filter((candidate) => candidate !== bad),
    proxyUrl,
  )
  if (!base) {
    await refreshEndpoints(true)
    base = await firstReachable(
      allApiBases().filter((candidate) => !tried.has(candidate)),
      proxyUrl,
    )
  }
  if (base) {
    localStorage.setItem(ACTIVE_BASE_KEY, base)
    return base
  }
  return bad
}

/** 官方域名直连列表：避免客户端把自家 API 和下载入口代理出去。 */
export const officialDirectRules = (): string[] => {
  const cached = readCache()
  const hosts = [
    ALTERNATE_API_BASE,
    ALTERNATE_DOWNLOAD_BASE,
    ...(cached?.api_bases ?? []),
    cached?.sub_base,
    cached?.download_base,
  ].flatMap((url) => {
    if (!url) return []
    const host = new URL(url).hostname
    if (
      host === 'sxnn.de' ||
      host.endsWith('.sxnn.de') ||
      /^\d+(?:\.\d+){3}$/.test(host)
    )
      return []
    return [`DOMAIN,${host},DIRECT`]
  })
  return [
    'DOMAIN-SUFFIX,jc116.com,DIRECT',
    'DOMAIN-SUFFIX,sxnn.de,DIRECT',
    ...new Set(hosts),
  ]
}
