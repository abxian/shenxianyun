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

function macDownload(service, ports) {
  return actualArrow(service, 'macosDufsDownloadUrl', {
    refreshEndpoints: async () => null,
    ensureSemver: (value) => (typeof value === 'string' ? value : null),
    ...ports,
    availableInstallerUrl: actualArrow(service, 'availableInstallerUrl', ports),
  })
}

test('Mac Home update downloads the NAS DMG for each architecture without installing', async () => {
  const [home, service] = await Promise.all([
    read('src/pages/home.tsx'),
    read('src/services/update.ts'),
  ])
  const downloadUrl = macDownload(service, {
    getEndpoints: () => ({ download_base: 'https://sxy.52nm.de:5443' }),
    ALTERNATE_DOWNLOAD_BASE: 'https://sxy.52nm.de:5443',
    LEGACY_DOWNLOAD_BASE: 'https://sxy.sxnn.de:5443',
    fetchWithVerifiedTls: async (_url, options) => {
      return options.method === 'HEAD'
        ? new Response(null, { headers: { 'Content-Length': '100' } })
        : Response.json({ version: '2.5.47' })
    },
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
      `https://sxy.52nm.de:5443/sxy/${encodeURIComponent(file)}`,
    ])
  }
})

test('unknown or unavailable Mac architecture falls back to the matching release', async () => {
  const [home, service] = await Promise.all([
    read('src/pages/home.tsx'),
    read('src/services/update.ts'),
  ])
  const downloadUrl = macDownload(service, {
    getEndpoints: () => ({ download_base: 'https://sxy.52nm.de:5443' }),
    ALTERNATE_DOWNLOAD_BASE: 'https://sxy.52nm.de:5443',
    LEGACY_DOWNLOAD_BASE: 'https://sxy.sxnn.de:5443',
    fetchWithVerifiedTls: async (_url, options) => {
      return options.method === 'HEAD'
        ? new Response(null, { headers: { 'Content-Length': '100' } })
        : Response.json({ version: '2.5.47' })
    },
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

test('unreachable Mac mirrors fall back to the matching release', async () => {
  const [home, service] = await Promise.all([
    read('src/pages/home.tsx'),
    read('src/services/update.ts'),
  ])
  const probes = []
  const opened = []
  const fallback = 'https://github.com/abxian/shenxianyun/releases/tag/v2.5.58'
  const downloadUrl = macDownload(service, {
    getEndpoints: () => ({ download_base: 'https://sxy.sxnn.de:5443' }),
    ALTERNATE_DOWNLOAD_BASE: 'https://sxy.52nm.de:5443',
    LEGACY_DOWNLOAD_BASE: 'https://sxy.sxnn.de:5443',
    fetchWithVerifiedTls: async (url) => {
      probes.push(new URL(url).hostname)
      throw Error('unreachable')
    },
  })
  await actualArrow(home, 'doUpdate', {
    updateInfo: { available: true, version: '2.5.58' },
    updating: false,
    isMacOS: true,
    getAppArch: async () => 'aarch64',
    macosDufsDownloadUrl: downloadUrl,
    releaseUrlForVersion: () => fallback,
    openWebUrl: async (url) => opened.push(url),
  })()
  assert.deepEqual(probes, ['sxy.sxnn.de', 'sxy.52nm.de'])
  assert.deepEqual(opened, [fallback])
})

test('a stale download cache checks a replacement after both known mirrors report an older release', async () => {
  const service = await read('src/services/update.ts')
  const future = 'https://downloads.example'
  const downloadUrl = macDownload(service, {
    getEndpoints: () => ({ download_base: 'https://sxy.52nm.de:5443' }),
    ALTERNATE_DOWNLOAD_BASE: 'https://sxy.52nm.de:5443',
    LEGACY_DOWNLOAD_BASE: 'https://sxy.sxnn.de:5443',
    refreshEndpoints: async (force) => {
      assert.equal(force, true)
      return { download_base: future }
    },
    fetchWithVerifiedTls: async (url, options) => {
      if (!url.startsWith(future)) return Response.json({ version: '2.5.46' })
      return options.method === 'HEAD'
        ? new Response(null, { headers: { 'Content-Length': '100' } })
        : Response.json({ version: '2.5.47' })
    },
  })
  assert.equal(
    await downloadUrl('aarch64', '2.5.47'),
    `${future}/sxy/${encodeURIComponent('神仙云.dmg')}`,
  )
})

test('configured metadata endpoints keep both HTTPS Dufs sources', async () => {
  const config = JSON.parse(await read('src-tauri/tauri.conf.json'))
  assert.deepEqual(config.plugins.updater.endpoints.slice(0, 2), [
    'https://sxy.52nm.de:5443/sxy/update.json',
    'https://sxy.sxnn.de:5443/sxy/update.json',
  ])
  assert.equal(
    config.plugins.updater.endpoints.at(-1),
    'https://github.com/abxian/shenxianyun/releases/download/updater/update.json',
  )
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
