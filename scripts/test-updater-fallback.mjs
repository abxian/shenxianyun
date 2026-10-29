import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import ts from 'typescript'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

function actualArrow(source, name, ports) {
  const tree = ts.createSourceFile(
    'source.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  let body
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) {
      body = ts.isCallExpression(node.initializer)
        ? node.initializer.arguments[0].getText(tree)
        : node.initializer.getText(tree)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  assert.ok(body, `actual callback ${name} exists`)
  const js = ts.transpileModule(`const callback = ${body}`, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText
  return new Function('ports', `with(ports){${js}; return callback}`)(ports)
}

test('Mac Home update downloads the NAS DMG for each architecture without installing', async () => {
  const [home, service] = await Promise.all([
    read('src/pages/home.tsx'),
    read('src/services/update.ts'),
  ])
  const downloadUrl = actualArrow(service, 'macosDufsDownloadUrl', {
    DUFS_DOWNLOAD_BASE: 'https://sxy.sxnn.de:5443/sxy',
  })
  for (const [arch, file] of [
    ['aarch64', '神仙云.dmg'],
    ['x86_64', '神仙云-Intel.dmg'],
  ]) {
    const urls = []
    await actualArrow(home, 'doUpdate', {
      updateInfo: { available: true, version: '2.5.47' },
      updating: false,
      isMacOS: true,
      getAppArch: async () => arch,
      macosDufsDownloadUrl: downloadUrl,
      releaseUrlForVersion: () =>
        assert.fail('known architecture must use NAS'),
      openWebUrl: async (url) => urls.push(url),
      setUpdating: () =>
        assert.fail('Mac must not start in-place installation'),
      downloadAndInstallWithFallback: () =>
        assert.fail('Mac uses a manual DMG'),
      relaunch: () => assert.fail('manual download must not restart the app'),
    })()
    assert.deepEqual(urls, [
      `https://sxy.sxnn.de:5443/sxy/${encodeURIComponent(file)}`,
    ])
  }
})

test('unknown or unavailable Mac architecture falls back to the matching release', async () => {
  const [home, service] = await Promise.all([
    read('src/pages/home.tsx'),
    read('src/services/update.ts'),
  ])
  const downloadUrl = actualArrow(service, 'macosDufsDownloadUrl', {
    DUFS_DOWNLOAD_BASE: 'https://sxy.sxnn.de:5443/sxy',
  })
  for (const getAppArch of [
    async () => 'unknown',
    async () => {
      throw Error('native unavailable')
    },
  ]) {
    const versions = [],
      urls = []
    await actualArrow(home, 'doUpdate', {
      updateInfo: { available: true, version: '2.5.47' },
      updating: false,
      isMacOS: true,
      getAppArch,
      macosDufsDownloadUrl: downloadUrl,
      releaseUrlForVersion: (version) => {
        versions.push(version)
        return 'https://github.com/abxian/shenxianyun/releases/tag/v' + version
      },
      openWebUrl: async (url) => urls.push(url),
    })()
    assert.deepEqual(versions, ['2.5.47'])
    assert.deepEqual(urls, [
      'https://github.com/abxian/shenxianyun/releases/tag/v2.5.47',
    ])
  }
})

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
  assert.match(updater, /update\.install\(&?bytes\)/)
  assert.match(updater, /tokio::task::spawn_blocking/)
  assert.match(updater, /NotificationSystem::broadcast\(/)
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
