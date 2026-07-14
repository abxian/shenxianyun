import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

/**
 * 端点发现（去掉写死 sub.jc116.com）：
 * 启动时从「发现源」拉取 endpoints.json，得到 api_bases / sub_base / download_base，
 * 之后换域名 / 换内穿 / 切线路只改后台 + endpoints.json，客户端下次启动自动跟随。
 *
 * 发现失败 → 用本地缓存；再没有 → 用内置默认。任何一步都不阻塞启动。
 */

// 内置兜底默认值（发现源全挂时最后的锚点）
export const DEFAULT_API_BASE = 'https://sxnn.de'
// 发现失败时的内置候选（按序探测），避免单个默认域名挂掉即全灭。
export const BUILTIN_API_BASES = [
  'https://sxnn.de',
  'http://114.80.36.225:5010',
  'https://sub.jc116.com',
]

// 发现锚点：第一个是 web 后台「保存并发布」自动上传的 endpoints.json（唯一真源，dufs），
// 后两个是备份（GitHub 手动同步、app 动态接口）。
const DISCOVERY_URLS = [
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
  updated_at?: string
}

const normalizeBase = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const v = value.trim().replace(/\/+$/, '')
  return /^https?:\/\//.test(v) ? v : ''
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
  const cached = readCache()
  return cached?.api_bases?.[0] || DEFAULT_API_BASE
}

export const getEndpoints = (): Endpoints | null => readCache()

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

/** 逐个探测 api_bases（GET /api/app-version，5s 超时），第一个通的设为 active。 */
export const pickApiBase = async (): Promise<string> => {
  const bases = readCache()?.api_bases?.length
    ? (readCache()?.api_bases as string[])
    : BUILTIN_API_BASES
  for (const base of bases) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 5000)
      const res = await tauriFetch(`${base}/api/app-version`, {
        method: 'GET',
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (res.ok) {
        localStorage.setItem(ACTIVE_BASE_KEY, base)
        return base
      }
    } catch {
      // 下一个
    }
  }
  return getApiBase()
}

/** 当前全部候选线路（发现缓存优先，否则内置列表）。 */
export const listApiBases = (): string[] => {
  const cached = readCache()?.api_bases
  return cached?.length ? cached : BUILTIN_API_BASES
}

/** 探测单条线路是否可用（GET /api/app-version，5s 超时）。 */
export const probeApiBase = async (base: string): Promise<boolean> => {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const res = await tauriFetch(`${base}/api/app-version`, {
      method: 'GET',
      signal: ctrl.signal,
    })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}

/** 手动指定当前线路（页面上点选线路时用）。 */
export const setActiveApiBase = (base: string): void => {
  const v = normalizeBase(base)
  if (v) localStorage.setItem(ACTIVE_BASE_KEY, v)
}

/** 请求失败时调用：把当前 active 基址作废并顺延到下一个候选，返回新基址。 */
export const rotateApiBase = async (): Promise<string> => {
  const bad = getApiBase()
  const bases = readCache()?.api_bases?.length
    ? (readCache()?.api_bases as string[])
    : BUILTIN_API_BASES
  const rest = bases.filter((b) => b !== bad)
  for (const base of rest) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 5000)
      const res = await tauriFetch(`${base}/api/app-version`, {
        method: 'GET',
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (res.ok) {
        localStorage.setItem(ACTIVE_BASE_KEY, base)
        return base
      }
    } catch {
      // 下一个
    }
  }
  return bad
}

/** 启动时调用一次：刷新发现源 + 探测可用基址（后台执行，不阻塞 UI）。 */
export const initEndpointDiscovery = async (): Promise<void> => {
  await refreshEndpoints()
  await pickApiBase()
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
