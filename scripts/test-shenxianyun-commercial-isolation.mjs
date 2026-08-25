import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')

test('keeps Shenxianyun UI, API discovery, and updater channels isolated', () => {
  const html = read('src/index.html')
  const windowSource = read('src-tauri/src/utils/resolve/window.rs')
  const endpointSource = read('src/services/endpoint-resolver.ts')
  const tauri = JSON.parse(read('src-tauri/tauri.conf.json'))
  const updaterEndpoints = tauri.plugins?.updater?.endpoints ?? []

  assert.match(html, /<title>神仙云<\/title>/)
  assert.match(windowSource, /\.title\("神仙云"\)/)
  assert.match(endpointSource, /api\.sxnn\.de/)
  assert.match(endpointSource, /sxy\.sxnn\.de/)
  assert.doesNotMatch(endpointSource, /shenxianyun-52nm|52nm\.cn|吾爱云/i)
  assert.ok(updaterEndpoints.length >= 2)
  assert.ok(
    updaterEndpoints.some((endpoint) =>
      endpoint.includes('/abxian/shenxianyun/'),
    ),
  )
  assert.ok(
    updaterEndpoints.every(
      (endpoint) => !/shenxianyun-52nm|Wuaiyun|52nm\.cn/i.test(endpoint),
    ),
  )
})

test('keeps stable device identity local and sends only the derived key', () => {
  const networkSource = read('src-tauri/src/cmd/network.rs')
  const rustEntry = read('src-tauri/src/lib.rs')
  const commandBridge = read('src/services/cmds.ts')
  const homeSource = read('src/pages/home.tsx')

  assert.match(
    networkSource,
    /pub fn get_stable_device_key\(\) -> Option<String>/,
  )
  assert.match(networkSource, /format!\("pc-\{digest:x\}"\)/)
  assert.match(
    networkSource,
    /device_key_is_deterministic_and_does_not_contain_source/,
  )
  assert.match(rustEntry, /cmd::get_stable_device_key/)
  assert.match(
    commandBridge,
    /invoke<string \| null>\('get_stable_device_key'\)/,
  )
  assert.match(homeSource, /device_key:\s*deviceKey\s*\|\|\s*getClientId\(\)/)
  assert.doesNotMatch(homeSource, /MachineGuid|IOPlatformUUID|machine-id/)
})
