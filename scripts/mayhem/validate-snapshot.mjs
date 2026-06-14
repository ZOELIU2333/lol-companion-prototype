import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { argValue, hasFlag, readJson } from './shared.mjs'

// 快照质量门禁。区分两类问题：
// - 硬失败（结构/版本/口径错误）：进程退出非 0，CI 必须红。
// - 软告警（聚合站点离线）：单站点抓取失败属正常，只打印告警、退出 0，
//   快照仍按 source 健康如实记录离线状态（实施计划 Task 9 Step 4 约定）。

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')

const current = hasFlag('--current')
const explicitPatch = argValue('--patch', null)

const currentPatch = await readJson(resolve(repoRoot, 'data/mayhem/current-patch.json'))
const patch = explicitPatch ?? (current ? currentPatch.patch : '26.12')
const snapshot = await readJson(resolve(repoRoot, `data/mayhem/${patch}/snapshot.json`))

const hardFailures = []
const warnings = []

function hard(condition, message) {
  if (!condition) hardFailures.push(message)
}

hard(snapshot.patch === currentPatch.patch, `snapshot.patch (${snapshot.patch}) != current-patch (${currentPatch.patch})`)
hard(snapshot.queue === 'aram-mayhem', `snapshot.queue must be 'aram-mayhem', got ${JSON.stringify(snapshot.queue)}`)
hard(snapshot.officialCoverage === 1, `snapshot.officialCoverage must be 1, got ${snapshot.officialCoverage}`)

const offMeta = snapshot.recommendations?.offMeta ?? []
const underSampled = offMeta.filter((entry) => !(entry.games >= 500))
hard(underSampled.length === 0, `${underSampled.length} off-meta entries below 500-game floor: ${underSampled.map((entry) => entry.augmentId).join(', ')}`)

const hasOnlineAggregate = (snapshot.sources ?? []).some(
  (source) => source.kind === 'aggregate' && source.status === 'online',
)
if (!hasOnlineAggregate) {
  warnings.push('no aggregate source is online; strength/off-meta recommendations rely on official metadata only')
}

for (const source of snapshot.sources ?? []) {
  if (source.status !== 'online') {
    warnings.push(`source ${source.sourceId} offline: ${source.reason ?? 'no reason recorded'}`)
  }
}

console.log(`Validated data/mayhem/${patch}/snapshot.json (patch ${snapshot.patch}, queue ${snapshot.queue}).`)
console.log(`  strength: ${snapshot.recommendations?.strength?.length ?? 0}, off-meta: ${offMeta.length}, completeness: ${snapshot.completeness}`)

for (const warning of warnings) {
  console.warn(`  WARN: ${warning}`)
}

if (hardFailures.length > 0) {
  for (const failure of hardFailures) {
    console.error(`  FAIL: ${failure}`)
  }
  process.exit(1)
}
