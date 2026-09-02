// 校验所有版本号载体是否一致。
//
// 存在的理由：v2.5.41 / v2.5.42 / v2.5.43 三次发版都漏改了 Cargo.lock 的根包
// 版本（一直停在 2.5.40），而发版记录里却写着「版本号已同步」。CI 里 cargo 没
// 用 --locked，所以锁文件不一致不会让流水线变红，只会在下次构建时被静默改写、
// 冒出与本次改动无关的 diff。这个脚本把「漏改」变成一个会失败的显式门禁。
//
// 用法：node scripts/check-version-sync.mjs
// 退出码 0 = 全部一致；1 = 有不一致或读取失败。

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

// 每个载体给出「怎么取出版本号」的最小提取器，取不到就报错而不是静默跳过。
const carriers = [
  {
    file: 'package.json',
    extract: (text) => JSON.parse(text).version,
  },
  {
    file: 'src-tauri/tauri.conf.json',
    extract: (text) => JSON.parse(text).version,
  },
  {
    file: 'src-tauri/Cargo.toml',
    // 只取 [package] 段里的第一个 version，避免命中依赖项的 version。
    extract: (text) =>
      text.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m)?.[1],
  },
  {
    file: 'Cargo.lock',
    // 锁文件里同名字段极多，必须锚定 clash-verge 这个根包。
    extract: (text) =>
      text.match(
        /\[\[package\]\]\nname = "clash-verge"\nversion = "([^"]+)"/,
      )?.[1],
  },
]

const found = []
const problems = []

for (const { file, extract } of carriers) {
  let version
  try {
    version = extract(read(file))
  } catch (err) {
    problems.push(`${file}: 读取或解析失败 —— ${err.message}`)
    continue
  }
  if (!version) {
    problems.push(
      `${file}: 没能提取到版本号（文件结构可能变了，请更新本脚本的提取器）`,
    )
    continue
  }
  found.push({ file, version })
}

if (problems.length === 0) {
  const versions = new Set(found.map((f) => f.version))
  if (versions.size > 1) {
    problems.push(
      `版本号不一致：${found.map((f) => `${f.file}=${f.version}`).join('，')}`,
    )
  }
}

if (problems.length > 0) {
  console.error('✗ 版本号一致性校验未通过：')
  for (const p of problems) console.error(`  - ${p}`)
  console.error(
    '\n发版时这四处必须一起改；Cargo.lock 改根包 clash-verge 的 version 即可。',
  )
  process.exitCode = 1
} else {
  console.log(
    `✓ 版本号一致：${found[0].version}（${found.map((f) => f.file).join('、')}）`,
  )
}
