import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  check,
  type CheckOptions,
  type Update,
} from '@tauri-apps/plugin-updater'

import { version as appVersion } from '@root/package.json'

export type VersionParts = {
  main: number[]
  pre: (number | string)[]
}

const SEMVER_FULL_REGEX =
  /^\d+(?:\.\d+){1,2}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const SEMVER_SEARCH_REGEX =
  /v?\d+(?:\.\d+){1,2}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?/i

export const SHENXIANYUN_RELEASES_URL =
  'https://github.com/abxian/shenxianyun/releases'
export const UPDATE_FALLBACK_PROGRESS_EVENT =
  'shenxianyun://update-fallback-progress'

export type UpdateFallbackProgress = {
  source: 'dufs' | 'github'
  phase:
    | 'checking'
    | 'progress'
    | 'downloaded'
    | 'verified'
    | 'fallback'
    | 'installing'
  chunkLength?: number | null
  contentLength?: number | null
}

export const normalizeVersion = (
  input: string | null | undefined,
): string | null => {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null
  return trimmed.replace(/^v/i, '')
}

export const ensureSemver = (
  input: string | null | undefined,
): string | null => {
  const normalized = normalizeVersion(input)
  if (!normalized) return null
  return SEMVER_FULL_REGEX.test(normalized) ? normalized : null
}

export const extractSemver = (
  input: string | null | undefined,
): string | null => {
  if (typeof input !== 'string') return null
  const match = input.match(SEMVER_SEARCH_REGEX)
  if (!match) return null
  return normalizeVersion(match[0])
}

export const splitVersion = (version: string | null): VersionParts | null => {
  if (!version) return null
  const [mainPart, preRelease] = version.split('-')
  const main = mainPart
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((num) => (Number.isNaN(num) ? 0 : num))

  const pre =
    preRelease?.split('.').map((token) => {
      const numeric = Number.parseInt(token, 10)
      return Number.isNaN(numeric) ? token : numeric
    }) ?? []

  return { main, pre }
}

const compareVersionParts = (a: VersionParts, b: VersionParts): number => {
  const length = Math.max(a.main.length, b.main.length)
  for (let i = 0; i < length; i += 1) {
    const diff = (a.main[i] ?? 0) - (b.main[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }

  if (a.pre.length === 0 && b.pre.length === 0) return 0
  if (a.pre.length === 0) return 1
  if (b.pre.length === 0) return -1

  const preLen = Math.max(a.pre.length, b.pre.length)
  for (let i = 0; i < preLen; i += 1) {
    const aToken = a.pre[i]
    const bToken = b.pre[i]
    if (aToken === undefined) return -1
    if (bToken === undefined) return 1

    if (typeof aToken === 'number' && typeof bToken === 'number') {
      if (aToken > bToken) return 1
      if (aToken < bToken) return -1
      continue
    }

    if (typeof aToken === 'number') return -1
    if (typeof bToken === 'number') return 1

    if (aToken > bToken) return 1
    if (aToken < bToken) return -1
  }

  return 0
}

export const compareVersions = (
  a: string | null,
  b: string | null,
): number | null => {
  const partsA = splitVersion(a)
  const partsB = splitVersion(b)
  if (!partsA || !partsB) return null
  return compareVersionParts(partsA, partsB)
}

export const resolveRemoteVersion = (update: Update): string | null => {
  const primary = ensureSemver(update.version)
  if (primary) return primary

  const fallbackPrimary = extractSemver(update.version)
  if (fallbackPrimary) return fallbackPrimary

  const raw = update.rawJson ?? {}
  const rawVersion = ensureSemver(
    typeof raw.version === 'string' ? raw.version : null,
  )
  if (rawVersion) return rawVersion

  const tagVersion = extractSemver(
    typeof raw.tag_name === 'string' ? raw.tag_name : null,
  )
  if (tagVersion) return tagVersion

  const nameVersion = extractSemver(
    typeof raw.name === 'string' ? raw.name : null,
  )
  if (nameVersion) return nameVersion

  return null
}

const localVersionNormalized = normalizeVersion(appVersion)

export const checkUpdateSafe = async (
  options?: CheckOptions,
): Promise<Update | null> => {
  const result = await check({ ...(options ?? {}), allowDowngrades: false })
  if (!result) return null

  const remoteVersion = resolveRemoteVersion(result)
  const comparison = compareVersions(remoteVersion, localVersionNormalized)

  if (comparison !== null && comparison <= 0) {
    try {
      await result.close()
    } catch (err) {
      console.warn('[updater] failed to close stale update resource', err)
    }
    return null
  }

  return result
}

export const releaseUrlForVersion = (version?: string | null) => {
  const normalized = ensureSemver(version)
  return normalized
    ? `${SHENXIANYUN_RELEASES_URL}/tag/v${normalized}`
    : `${SHENXIANYUN_RELEASES_URL}/latest`
}

// Dufs 上的固定下载入口（始终指向当前正式版，不带版本号）。
// 这些文件名由 NAS 同步脚本 nas-sync-release-to-dufs.py 的固定别名表决定，
// 改名必须两边一起改，否则这里会 404。
const DUFS_DOWNLOAD_BASE = 'https://sxy.sxnn.de:5443/sxy'

/**
 * macOS 的 Dufs 直接下载地址。
 *
 * macOS 不走应用内更新（用户要的是直接下载安装包），所以按 CPU 架构给出
 * 对应的 dmg：Apple 芯片用 aarch64 包，Intel 用 x64 包。
 * 架构取不到时返回 null，调用方回退到 GitHub Release 页面 —— 宁可让用户
 * 自己在页面上挑，也好过猜错架构给一个装不上的包。
 */
export const macosDufsDownloadUrl = (arch?: string | null) => {
  if (arch === 'x86_64') {
    return `${DUFS_DOWNLOAD_BASE}/${encodeURIComponent('神仙云-Intel.dmg')}`
  }
  if (arch === 'aarch64') {
    return `${DUFS_DOWNLOAD_BASE}/${encodeURIComponent('神仙云.dmg')}`
  }
  return null
}

export const downloadAndInstallWithFallback = async (
  update: Update,
  onProgress?: (progress: UpdateFallbackProgress) => void,
) => {
  const expectedVersion = resolveRemoteVersion(update)
  if (!expectedVersion) {
    throw new Error('更新元数据版本无效，已拒绝下载安装')
  }

  const unlisten = await listen<UpdateFallbackProgress>(
    UPDATE_FALLBACK_PROGRESS_EVENT,
    ({ payload }) => onProgress?.(payload),
  )
  try {
    await invoke<void>('install_app_update_with_fallback', {
      expectedVersion,
    })
  } finally {
    unlisten()
  }
}

export type { CheckOptions }
