import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import ts from 'typescript'

import { loadManagedContent } from '../src/services/managed-download-recovery.ts'
import { summarizeNotice } from '../src/services/notice-summary.ts'

const auth = () => ({
  accessCode: 'same-code',
  profileUid: 'profile',
  deviceToken: 'old',
  subscriptionUrl: 'old-url',
  apiBase: 'api',
  expiresAt: '',
  limitMode: '',
  contentHash: 'old-hash',
  detached: false,
  updateVersion: 1,
})
const denied = Object.assign(new Error('credential expired'), { status: 403 })

test('explicit update renews a stale URL once and persists before downloading the new target', async () => {
  let current = auth()
  const original = current
  const events = []
  const result = await loadManagedContent(original, true, {
    current: () => current,
    status: (error) => error.status,
    download: async (value) => {
      events.push(value.subscriptionUrl)
      if (value === original) throw denied
      return 'new-file-content'
    },
    renew: async (value) => ({
      ...value,
      deviceToken: 'fresh',
      subscriptionUrl: 'new-target',
    }),
    persist: async (value) => {
      events.push('persist')
      current = value
    },
  })
  assert.deepEqual(events, ['old-url', 'persist', 'new-target'])
  assert.equal(result.content, 'new-file-content')
  assert.equal(result.auth.profileUid, original.profileUid)
  assert.equal(current.deviceToken, 'fresh')
})

test('background failures and ordinary network failures never re-register devices', async () => {
  for (const [userRequested, error] of [
    [false, denied],
    [true, new Error('network')],
  ]) {
    const current = auth()
    await assert.rejects(
      loadManagedContent(current, userRequested, {
        current: () => current,
        status: (value) => value.status,
        download: async () => {
          throw error
        },
        renew: async () => {
          assert.fail('must not renew')
        },
        persist: async () => {
          assert.fail('must not write')
        },
      }),
      error,
    )
  }
})

test('an account switch during renewal cannot overwrite the new account', async () => {
  let current = auth()
  const original = current
  await assert.rejects(
    loadManagedContent(original, true, {
      current: () => current,
      status: (value) => value.status,
      download: async () => {
        throw denied
      },
      renew: async (value) => {
        current = { ...auth(), accessCode: 'other' }
        return { ...value, deviceToken: 'fresh' }
      },
      persist: async () => {
        assert.fail('must not overwrite another account')
      },
    }),
    /提取码已变化/,
  )
  assert.equal(current.accessCode, 'other')
})

test('a fresh credential survives a new-target failure without consuming its revision', async () => {
  let current = auth()
  const original = current
  await assert.rejects(
    loadManagedContent(original, true, {
      current: () => current,
      status: (value) => value.status,
      download: async (value) => {
        if (value === original) throw denied
        throw new Error('invalid new config')
      },
      renew: async (value) => ({ ...value, deviceToken: 'fresh' }),
      persist: async (value) => {
        current = value
      },
    }),
    /invalid new config/,
  )
  assert.equal(current.deviceToken, 'fresh')
  assert.equal(current.updateVersion, 1)
  assert.equal(current.contentHash, 'old-hash')
})

test('long validation logs have a short usable summary and keep the actual parameter problem', () => {
  const message =
    '订阅配置校验失败 ' +
    'time=... '.repeat(100) +
    'proxy 5: invalid REALITY short ID'
  const summary = summarizeNotice(message)
  assert.ok(summary.length < 180)
  assert.match(summary, /REALITY short ID 无效/)
  assert.match(summary, /原配置已保留/)
  assert.equal(summarizeNotice('短错误'), '短错误')
})

function arrow(source, name, ports) {
  const tree = ts.createSourceFile(
    'home.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  let code
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) {
      code = ts.isCallExpression(node.initializer)
        ? node.initializer.arguments[0].getText(tree)
        : node.initializer.getText(tree)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.ok(code, name)
  const js = ts.transpileModule('const callback=' + code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText
  return new Function('ports', `with(ports){${js};return callback}`)(ports)
}

test('actual Windows Home update remains in-app and settles cancellation without relaunch', async () => {
  const source = await readFile(
    new URL('../src/pages/home.tsx', import.meta.url),
    'utf8',
  )
  const states = []
  let rejectDownload
  let relaunched = false
  const ports = {
    updateInfo: { available: true, version: '2.5.51' },
    updating: false,
    isMacOS: false,
    busy: false,
    manualBusy: false,
    refreshApplyInFlightRef: { current: false },
    autoRefreshControllerRef: { current: null },
    backgroundBusyRef: { current: false },
    setBusy: (value) => states.push(['busy', value]),
    setUpdating: (value) => states.push(['updating', value]),
    setUpdateInstalling: () => {},
    setUpdPercent: () => {},
    setStatus: (value) => states.push(['status', value]),
    downloadAndInstallWithFallback: async (_update, onProgress) => {
      onProgress({ phase: 'progress', chunkLength: 1024, contentLength: 2048 })
      return new Promise((_resolve, reject) => {
        rejectDownload = reject
      })
    },
    cancelAppUpdateDownload: async () => {
      rejectDownload(new Error('已取消更新下载'))
      return 'cancelled'
    },
    relaunch: async () => {
      relaunched = true
    },
    refreshAll: async () => {},
    openWebUrl: () => assert.fail('Windows update must not launch a browser'),
  }
  const pending = arrow(source, 'doUpdate', ports)()
  await arrow(source, 'cancelUpdateDownload', ports)()
  await pending
  assert.ok(
    states.some(
      ([name, value]) => name === 'status' && value === '正在取消更新下载...',
    ),
  )
  assert.equal(relaunched, false)
  assert.ok(
    states.some(([name, value]) => name === 'updating' && value === false),
  )
  assert.ok(states.some(([name, value]) => name === 'busy' && value === false))
  assert.ok(
    states.some(([name, value]) => name === 'status' && value.includes('取消')),
  )
})
