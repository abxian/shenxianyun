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

test('keeps native and translated user-facing branding private and consistent', () => {
  const brandSource = read('src-tauri/src/utils/brand.rs')
  const notificationSource = read('src-tauri/src/utils/notification.rs')
  const updaterSource = read('src-tauri/src/core/updater.rs')
  const traySource = read('src-tauri/src/core/tray/mod.rs')
  const serviceSource = read('src-tauri/src/core/service.rs')
  const initSource = read('src-tauri/src/utils/init.rs')
  const i18nSource = read('src/services/i18n.ts')
  const homeSource = read('src/pages/home.tsx')

  assert.match(brandSource, /VISIBLE_APP_NAME:\s*&str\s*=\s*"神仙云"/)
  assert.match(notificationSource, /brand::native_text/)
  assert.match(updaterSource, /brand::native_text/)
  assert.match(traySource, /build_tray_tooltip/)
  assert.match(traySource, /build_tray_version_label/)
  assert.match(traySource, /load_managed_auth/)
  assert.match(traySource, /mask_all_profile_names/)
  assert.match(serviceSource, /brand::native_text/)
  assert.match(initSource, /brand::VISIBLE_APP_NAME/)
  assert.match(i18nSource, /postProcess:\s*\['visibleBrand'\]/)
  assert.match(homeSource, /managedProfileName\(VISIBLE_APP_NAME\)/)
  assert.doesNotMatch(homeSource, /name:\s*input/)
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

test('keeps the stable release page and updater publication on Shenxianyun', () => {
  const releaseWorkflow = read('.github/workflows/release.yml')
  const updaterSource = read('scripts/updater.mjs')
  const fixedUpdaterSource = read('scripts/updater-fixed-webview2.mjs')

  assert.match(releaseWorkflow, /git merge-base --is-ancestor/)
  assert.match(
    releaseWorkflow,
    /DOWNLOAD_URL=\$\{GITHUB_SERVER_URL\}\/\$\{GITHUB_REPOSITORY\}/,
  )
  assert.match(releaseWorkflow, /神仙云 PC \$TAG_NAME/)
  assert.match(releaseWorkflow, /releaseName: '神仙云 PC/)
  assert.match(releaseWorkflow, /ENABLE_DUFS_PUBLISH: 'false'/)
  assert.doesNotMatch(
    releaseWorkflow,
    /clash-verge-rev\/clash-verge-rev|verge\.dginv\.click|吾爱云|52nm\.cn/i,
  )
  assert.match(updaterSource, /process\.env\.ENABLE_DUFS_PUBLISH === 'true'/)
  assert.match(
    fixedUpdaterSource,
    /fixed WebView2 updater is incomplete for \$\{key\}/,
  )
  assert.match(fixedUpdaterSource, /process\.exitCode = 1/)
})
