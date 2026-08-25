import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('configured metadata endpoints keep Dufs before GitHub', async () => {
  const config = JSON.parse(await read('src-tauri/tauri.conf.json'))
  const endpoints = config.plugins.updater.endpoints

  assert.match(endpoints[0], /^https:\/\/sxy\.sxnn\.de:5443\/sxy\//)
  assert.match(endpoints[1], /^http:\/\/114\.80\.36\.225:5011\/sxy\//)
  assert.match(endpoints[2], /github\.com\/abxian\/shenxianyun/)
  assert.match(endpoints[3], /^https:\/\/github\.com\/abxian\/shenxianyun/)
})

test('Windows update entry points use the in-app fallback command', async () => {
  const [home, viewer, service, updater] = await Promise.all([
    read('src/pages/home.tsx'),
    read('src/components/setting/mods/update-viewer.tsx'),
    read('src/services/update.ts'),
    read('src-tauri/src/core/updater.rs'),
  ])

  assert.match(home, /downloadAndInstallWithFallback\(updateInfo/)
  assert.match(viewer, /downloadAndInstallWithFallback\(updateInfo/)
  assert.doesNotMatch(home, /updateInfo\.downloadAndInstall/)
  assert.doesNotMatch(viewer, /updateInfo\.downloadAndInstall/)
  assert.match(service, /invoke<void>\('install_app_update_with_fallback'/)
  assert.match(updater, /UpdateSource::Dufs/)
  assert.match(updater, /UpdateSource::Github/)
  assert.match(updater, /update\.install\(bytes\)/)
  assert.doesNotMatch(updater, /open::|open_web_url/)
})

test('manual release links stay on the Shenxianyun repository', async () => {
  const [home, viewer, service] = await Promise.all([
    read('src/pages/home.tsx'),
    read('src/components/setting/mods/update-viewer.tsx'),
    read('src/services/update.ts'),
  ])
  const combined = `${home}\n${viewer}\n${service}`

  assert.match(combined, /github\.com\/abxian\/shenxianyun\/releases/)
  assert.doesNotMatch(combined, /clash-verge-rev\/clash-verge-rev\/releases/)
})
