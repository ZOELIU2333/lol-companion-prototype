import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { readJson } from './shared.mjs'

// 读取 detect 出的当前版本，按该版本跑全部导入器 + 快照构建。
// 单个聚合站点抓取失败不应中断流水线：导入器本身把失败写成 unavailable 状态，
// 这里即使某个导入器进程非 0 退出也继续，但最后的快照构建必须成功。

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')

function run(args, { tolerateFailure = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('node', args, { cwd: repoRoot, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0 || tolerateFailure) {
        resolvePromise(code)
      } else {
        reject(new Error(`${args.join(' ')} exited with code ${code}`))
      }
    })
  })
}

const currentPatch = await readJson(resolve(repoRoot, 'data/mayhem/current-patch.json'))
const patch = currentPatch.patch
if (typeof patch !== 'string' || patch.length === 0) {
  throw new Error('current-patch.json has no usable patch; run data:mayhem:patch:detect first')
}

console.log(`Refreshing Mayhem data for patch ${patch}`)

await run(['scripts/mayhem/import-official.mjs', '--patch', patch])
await run(['scripts/mayhem/import-metasrc.mjs', '--patch', patch], { tolerateFailure: true })
await run(['scripts/mayhem/import-opgg.mjs', '--patch', patch], { tolerateFailure: true })
await run(['scripts/mayhem/import-arammayhem.mjs', '--patch', patch], { tolerateFailure: true })
await run(['scripts/mayhem/import-community-candidates.mjs', '--patch', patch], { tolerateFailure: true })
await run(['scripts/mayhem/build-snapshot.mjs', '--patch', patch])

console.log(`Refresh complete for patch ${patch}`)
