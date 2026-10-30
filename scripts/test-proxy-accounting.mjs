import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import ts from 'typescript'
const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const home = read('src/pages/home.tsx')
const source = ts.createSourceFile(
  'home.tsx',
  home,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)
test('Windows uses a separate persisted counter namespace and refuses stock total fallback', () => {
  assert.match(home, /shenxianyun\.managedTraffic\.proxy\.v2/)
  assert.match(home, /!proxyTrafficReadyRef\.current/)
  assert.match(home, /sample\.proxyUploadTotal!/)
  assert.match(home, /sample\.proxyDownloadTotal!/)
  assert.equal(source.parseDiagnostics.length, 0)
})
test('summary retains classified zero values without replacing with global totals', () => {
  const code = read('src/hooks/use-connection-data.ts')
  const start = code.indexOf('const mergeConnectionSummary =')
  const end = code.indexOf('const flushPendingMessage', start)
  const fn = code
    .slice(start, end)
    .replace('const mergeConnectionSummary =', 'const fn =')
  const js = ts.transpile(fn, { target: ts.ScriptTarget.ES2022 })
  const run = new Function(`${js};return fn`)()
  const summary = run({
    uploadTotal: 900,
    downloadTotal: 1000,
    proxyUploadTotal: 0,
    proxyDownloadTotal: 12,
    connections: [],
  })
  assert.equal(summary.proxyUploadTotal, 0)
  assert.equal(summary.proxyDownloadTotal, 12)
  assert.equal(
    run({ uploadTotal: 999, connections: [] }).proxyUploadTotal,
    undefined,
  )
})
