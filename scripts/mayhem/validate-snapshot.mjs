import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { argValue, hasFlag, readJson } from './shared.mjs'

// 快照质量门禁。单站点离线可以告警，但发布快照必须至少有一个在线
// 聚合来源和一条真实强度推荐，避免“CI 全绿、应用只有空数据”。

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')

const current = hasFlag('--current')
const explicitPatch = argValue('--patch', null)
const allowEmptyAggregate = hasFlag('--allow-empty-aggregate')

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
const strength = snapshot.recommendations?.strength ?? []
if (allowEmptyAggregate && !hasOnlineAggregate) {
  warnings.push('no aggregate source is online; strength/off-meta recommendations rely on official metadata only')
} else {
  hard(hasOnlineAggregate, 'at least one aggregate source must be online')
  hard(strength.length > 0, 'snapshot must contain at least one data-backed strength recommendation')
  hard(
    strength.every((entry) => entry.winRate !== null && entry.sourceCount > 0),
    'every strength recommendation must have a real win rate and source count',
  )
}

for (const source of snapshot.sources ?? []) {
  if (source.status !== 'online') {
    warnings.push(`source ${source.sourceId} offline: ${source.reason ?? 'no reason recorded'}`)
  }
}

console.log(`Validated data/mayhem/${patch}/snapshot.json (patch ${snapshot.patch}, queue ${snapshot.queue}).`)
console.log(`  strength: ${strength.length}, off-meta: ${offMeta.length}, completeness: ${snapshot.completeness}`)

for (const warning of warnings) {
  console.warn(`  WARN: ${warning}`)
}

if (hardFailures.length > 0) {
  for (const failure of hardFailures) {
    console.error(`  FAIL: ${failure}`)
  }
  process.exit(1)
}
