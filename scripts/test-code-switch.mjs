import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import ts from 'typescript'

const source = await readFile(
  new URL('../src/pages/home.tsx', import.meta.url),
  'utf8',
)
const tree = ts.createSourceFile(
  'home.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
function actual(name, ports) {
  let arrow
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name)
      arrow = (
        ts.isCallExpression(node.initializer)
          ? node.initializer.arguments[0]
          : node.initializer
      ).getText(tree)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.ok(arrow)
  const js = ts.transpileModule(`const callback = ${arrow}`, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText
  return new Function('ports', `with(ports){${js};return callback}`)(ports)
}
function setup(overrides = {}) {
  const events = [],
    state = { dialog: false, busy: false, status: '' }
  const p = {
    busy: false,
    manualBusy: false,
    running: true,
    systemProxyConfigOn: false,
    backgroundBusyRef: { current: false },
    refreshApplyInFlightRef: { current: false },
    codeEntryActiveRef: { current: false },
    proxyUrlRef: { current: 'http://127.0.0.1:7897' },
    previousRunningRef: { current: true },
    autoRefreshControllerRef: {
      current: { abort: () => events.push('abort-old-read') },
    },
    setBusy: (value) => {
      state.busy = value
    },
    setStatus: (value) => {
      state.status = value
    },
    patchVergeConfig: async (patch) => {
      events.push(['disable', patch])
    },
    mutateVerge: (update) => {
      assert.deepEqual(
        update({ enable_system_proxy: true, enable_tun_mode: true }),
        { enable_system_proxy: false, enable_tun_mode: false },
      )
    },
    stopCore: async () => {
      events.push('stop')
    },
    setConnectionReady: (value) => assert.equal(value, false),
    invalidateProxyState: async () => {},
    refreshAll: async () => {},
    sendClientPresence: async (value) => assert.equal(value, false),
    setExpiredDialogOpen: (value) => assert.equal(value, false),
    setCode: (value) => assert.equal(value, ''),
    setCodeImportPhase: (value) => events.push(['phase', value]),
    setCodeImportMessage: (value) => assert.equal(value, ''),
    setCodeDialogOpen: (value) => {
      state.dialog = value
      events.push('open')
    },
    ...overrides,
  }
  return { p, events, state, run: actual('openCodeImport', p) }
}
test('opening code input preserves an existing connection and only opens the dialog', () => {
  const t = setup()
  t.run()
  assert.deepEqual(t.events, [['phase', 'input'], 'open'])
  assert.equal(t.p.proxyUrlRef.current, 'http://127.0.0.1:7897')
  assert.equal(t.p.previousRunningRef.current, true)
  assert.equal(t.p.codeEntryActiveRef.current, true)
  assert.equal(t.state.busy, false)
})

test('an in-flight config save retains ownership and cannot be interrupted by code entry', async () => {
  for (const key of [
    'busy',
    'manualBusy',
    'backgroundBusyRef',
    'refreshApplyInFlightRef',
  ]) {
    const t = setup({ [key]: key.endsWith('Ref') ? { current: true } : true })
    await t.run()
    assert.deepEqual(t.events, [])
    assert.equal(t.state.dialog, false)
    assert.match(t.state.status, /配置操作/)
  }
})
test('a submitted managed code waits for proxy and core shutdown before validating', async () => {
  let finish
  const t = setup({
    code: '123456',
    tunOn: true,
    systemProxyOn: true,
    isOtherSubscriptionCommand: () => false,
    isLocalSettingsCommand: () => false,
    setCodeImportMessage: () => {},
    stopCore: () =>
      new Promise((resolve) => {
        finish = resolve
      }),
    activateCode: async () => {
      t.events.push('validate')
      return { activate: () => {}, commit: async () => {}, data: {} }
    },
    startImportedProfile: async () => {},
    startupRefreshCompletedRef: { current: false },
    STARTUP_REFRESH_SESSION_KEY: 'test',
    isSwitchingCode: false,
  })
  const operation = actual('importByCode', t.p)()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(t.state.busy, true)
  assert.ok(!t.events.includes('validate'))
  finish()
  await operation
  assert.ok(t.events.includes('validate'))
})

test('all three user switch controls invoke the same guarded entry', () => {
  const matches = []
  function visit(node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(tree) === 'onClick' &&
      node.initializer?.getText(tree).includes('openCodeImport()')
    )
      matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.equal(matches.length, 3)
})
