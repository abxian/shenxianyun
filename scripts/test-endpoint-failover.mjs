import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import ts from 'typescript'

const source = await readFile(
  new URL('../src/services/endpoint-resolver.ts', import.meta.url),
  'utf8',
)
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText

const original = 'https://api.sxnn.de:5443'
const alternate = 'https://sxy-api.52nm.de:5443'
const download = 'https://sxy.52nm.de:5443'
const manifest = (api = alternate) => ({
  api_bases: [api],
  sub_base: api,
  download_base: download,
})
const healthy = () =>
  Response.json({ ok: true, latest_version_name: '2.11.60' })

const resolver = (fetch, state = new Map(), now = Date.now) => {
  const api = {}
  const require = (name) => {
    if (name.endsWith('plugin-http')) return { fetch }
    if (name.endsWith('http-request-init'))
      return { cloneHttpRequestInit: (options) => options }
    return {}
  }
  new Function('exports', 'require', 'localStorage', 'Date', compiled)(
    api,
    require,
    {
      getItem: (key) => state.get(key),
      setItem: (key, value) => state.set(key, value),
    },
    { now },
  )
  return api
}

test('a cold client reaches the alternate API when the old one fails DNS', async () => {
  const state = new Map()
  const api = resolver(async (url) => {
    if (url.startsWith(alternate)) return healthy()
    if (url.startsWith(original)) throw new Error('DNS lookup failed')
    return new Response('unrelated website', { status: 200 })
  }, state)

  assert.equal(await api.pickApiBase(), alternate)
  assert.equal(api.getApiBase(), alternate)
  assert.ok(api.officialDirectRules().includes('DOMAIN,sxy-api.52nm.de,DIRECT'))
  assert.ok(api.officialDirectRules().includes('DOMAIN,sxy.52nm.de,DIRECT'))
  assert.ok(!api.officialDirectRules().includes('DOMAIN-SUFFIX,52nm.de,DIRECT'))
})

test('a healthy primary returns before the dead fallback times out', async () => {
  let releaseSlow
  const slow = new Promise((resolve) => {
    releaseSlow = resolve
  })
  const api = resolver(async (url) => {
    if (url.startsWith(original)) return healthy()
    return slow
  })
  const raced = await Promise.race([
    api.pickApiBase(),
    new Promise((resolve) => setTimeout(() => resolve('slow'), 50)),
  ])
  releaseSlow(new Response(null, { status: 503 }))
  assert.equal(raced, original)
})

test('refresh learns a changed manifest without restart, and keeps it when offline', async () => {
  let clock = 0
  let online = true
  let published = original
  let calls = 0
  const api = resolver(
    async (url) => {
      assert.ok(url.startsWith('https://'))
      calls++
      if (!online) throw new Error('offline')
      return Response.json(manifest(published))
    },
    new Map(),
    () => clock,
  )

  const first = api.refreshEndpoints()
  assert.equal(api.refreshEndpoints(), first)
  assert.equal((await first).sub_base, original)
  const openingCalls = calls

  published = alternate
  clock += 60_000
  assert.equal((await api.refreshEndpoints()).sub_base, original)
  assert.equal(calls, openingCalls)

  clock += 5 * 60_000
  assert.equal((await api.refreshEndpoints()).sub_base, alternate)

  online = false
  clock += 5 * 60_000
  assert.equal((await api.refreshEndpoints()).sub_base, alternate)
  assert.equal(api.getEndpoints().download_base, download)
})

test('existing managed requests switch only between authenticated service aliases', () => {
  const api = resolver(async () => healthy())
  const subscription = `${original}/managed-sub/synthetic-token?flag=1`
  const heartbeat = `${original}/api/v2/client/heartbeat`
  api.setActiveApiBase(alternate)
  assert.equal(
    api.routeManagedRequest(subscription),
    `${alternate}/managed-sub/synthetic-token?flag=1`,
  )
  assert.equal(
    api.routeManagedRequest(heartbeat),
    `${alternate}/api/v2/client/heartbeat`,
  )
  for (const unchanged of [
    `${original}/pay?action=new`,
    `${original}/api/import/exchange`,
    'https://api.52nm.de:5443/api/v2/client/traffic',
  ])
    assert.equal(api.routeManagedRequest(unchanged), unchanged)

  api.setActiveApiBase('https://unknown.example')
  assert.equal(api.routeManagedRequest(subscription), subscription)
})

test('a later authenticated manifest can move an existing device to a third domain', async () => {
  const future = 'https://standby.example'
  const api = resolver(async (url) => {
    if (url.endsWith('endpoints.json')) return Response.json(manifest(future))
    if (url.startsWith(future)) return healthy()
    throw new Error('old domain unavailable')
  })
  await api.refreshEndpoints()
  assert.equal(await api.pickApiBase(), future)
  const saved = `${alternate}/managed-sub/synthetic-token`
  assert.equal(
    api.routeManagedRequest(saved),
    `${future}/managed-sub/synthetic-token`,
  )
})

test('a running client rediscovers an unknown replacement before the cache expires', async () => {
  const future = 'https://replacement.example'
  let published = manifest()
  const api = resolver(
    async (url) => {
      if (url.startsWith(download)) throw new Error('download domain offline')
      if (url.startsWith('https://raw.githubusercontent.com/'))
        return Response.json(published)
      if (url.startsWith(future)) return healthy()
      throw new Error('API domain offline')
    },
    new Map(),
    () => 1000,
  )
  await api.refreshEndpoints()
  api.setActiveApiBase(alternate)
  published = { ...manifest(future), download_base: future }

  assert.equal(await api.rotateApiBase(), future)
  assert.equal(api.getEndpoints().download_base, future)
  assert.equal(
    api.routeManagedRequest(`${alternate}/managed-sub/test-device`),
    `${future}/managed-sub/test-device`,
  )
})
