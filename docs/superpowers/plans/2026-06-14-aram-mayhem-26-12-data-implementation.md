# 26.12 海克斯大乱斗数据 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立与斗魂竞技场完全隔离的 26.12 海克斯大乱斗数据管线，并让实时三选一支持强度与黑科技两种可解释推荐。

**Architecture:** 使用 Node 导入器分别采集官方元数据、结构化统计源和社区组合候选，统一输出 `aram-mayhem` 原始记录，再由纯函数聚合器生成应用快照。React/Tauri 只读取已校验快照，并将 Live Client Data 的已选强化和当前候选传给推荐器；每日 GitHub Actions 负责刷新、校验和保存诊断产物。

**Tech Stack:** TypeScript 5、React 19、Vite 7、Vitest、Node.js ESM、Tauri 2/Rust、GitHub Actions、Riot/CommunityDragon、OP.GG、METAsrc、aramgg.com、arammayhem.com。

---

## 文件结构

- Create `src/features/mayhem/types.ts`: 海克斯大乱斗专用类型，禁止复用斗魂竞技场类型。
- Create `src/features/mayhem/snapshot.ts`: 快照校验、版本隔离、查询和过期判断。
- Create `src/features/mayhem/scoring.ts`: 强度与黑科技评分纯函数。
- Create `src/features/mayhem/snapshot.test.ts`: 版本、模式、500 场门槛和去重测试。
- Create `src/features/mayhem/scoring.test.ts`: 权重、协同和三选一排序测试。
- Create `src/data/mayhemSnapshot.ts`: 生成后的 TypeScript 快照。
- Create `data/mayhem/26.12/*.json`: 官方、统计源、候选源和聚合快照缓存。
- Create `scripts/mayhem/shared.mjs`: CLI 参数、请求、换行与 JSON 写入工具。
- Create `scripts/mayhem/detect-live-patch.mjs`: 从国服公告与 Riot 版本页确定当前正式版本。
- Create `scripts/mayhem/import-official.mjs`: 26.12 版本与强化身份采集。
- Create `scripts/mayhem/import-metasrc.mjs`: METAsrc 26.12 全分段英雄/强化统计适配器。
- Create `scripts/mayhem/import-opgg.mjs`: OP.GG ARAM: Mayhem 页面适配器。
- Create `scripts/mayhem/import-community-candidates.mjs`: aramgg.com、arammayhem.com 的组合候选采集器。
- Create `scripts/mayhem/build-snapshot.mjs`: 标准化、去重、门槛、冲突和快照生成。
- Create `scripts/mayhem/refresh-current.mjs`: 读取当前版本并串联各导入器与聚合器。
- Create `.github/workflows/mayhem-data-refresh.yml`: 每日更新与诊断 artifact。
- Modify `src/services/liveClientData.ts`: 支持已选强化 ID/名称和可获得的候选强化。
- Modify `src-tauri/src/lib.rs`: 从 Live Client Data 可用字段解析强化信息。
- Modify `src/types.ts`: 为现有视图模型增加数据模式、样本和可信度字段。
- Modify `src/lib/recommendations.ts`: 改为调用 Mayhem 评分器，旧本地规则只作明确标注的兜底。
- Modify `src/components/AugmentRecommendation.tsx`: 增加强度/黑科技切换和可信度摘要。
- Modify `src/app/useCompanionSession.ts`: 管理推荐模式并向视图传递。
- Modify `package.json`: 新增导入、构建和检查命令。
- Modify `README.md`、`docs/data-source-matrix.md`: 更新版本和数据来源说明。

### Task 1: 建立 Mayhem 类型边界与 26.12 快照校验

**Files:**
- Create: `src/features/mayhem/types.ts`
- Create: `src/features/mayhem/snapshot.ts`
- Test: `src/features/mayhem/snapshot.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { buildValidatedMayhemSnapshot } from './snapshot'

describe('Mayhem snapshot validation', () => {
  it('rejects Arena and old-patch records', () => {
    const result = buildValidatedMayhemSnapshot({
      patch: '26.12',
      officialAugmentIds: [101],
      records: [
        { sourceId: 'a', patch: '26.11', queue: 'aram-mayhem', candidateAugmentId: 101, games: 900 },
        { sourceId: 'b', patch: '26.12', queue: 'arena', candidateAugmentId: 101, games: 900 },
      ],
    })

    expect(result.records).toHaveLength(0)
    expect(result.rejected).toHaveLength(2)
  })

  it('keeps a 500-game off-meta record and rejects 499 games', () => {
    const result = buildValidatedMayhemSnapshot({
      patch: '26.12',
      officialAugmentIds: [101, 102],
      records: [
        { sourceId: 'a', patch: '26.12', queue: 'aram-mayhem', candidateAugmentId: 101, games: 499 },
        { sourceId: 'b', patch: '26.12', queue: 'aram-mayhem', candidateAugmentId: 102, games: 500 },
      ],
    })

    expect(result.offMetaRecords.map((record) => record.candidateAugmentId)).toEqual([102])
  })
})
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npx vitest run src/features/mayhem/snapshot.test.ts`

Expected: FAIL，提示 `./snapshot` 不存在。

- [ ] **Step 3: 实现专用类型**

```ts
export type MayhemQueue = 'aram-mayhem'
export type MayhemPopulation = 'all-ranks'
export type MayhemEvidenceType = 'official' | 'aggregate' | 'community-candidate'

export type MayhemSourceRecord = {
  sourceId: string
  sourceUrl?: string
  collectedAt?: string
  patch: string
  queue: string
  population?: MayhemPopulation
  locale?: string
  championId?: number | null
  selectedAugmentIds?: number[]
  candidateAugmentId: number
  itemIds?: number[]
  games: number | null
  wins?: number | null
  winRate?: number | null
  pickRate?: number | null
  sourceConfidence?: number
  evidenceType?: MayhemEvidenceType
}

export type MayhemRecommendationMode = 'strength' | 'off-meta'
export type MayhemConfidence = 'low' | 'medium' | 'high'
```

- [ ] **Step 4: 实现最小校验器**

```ts
import type { MayhemSourceRecord } from './types'

type BuildInput = {
  patch: string
  officialAugmentIds: number[]
  records: MayhemSourceRecord[]
}

export function buildValidatedMayhemSnapshot(input: BuildInput) {
  const officialIds = new Set(input.officialAugmentIds)
  const records: MayhemSourceRecord[] = []
  const rejected: MayhemSourceRecord[] = []

  for (const record of input.records) {
    const valid =
      record.patch === input.patch &&
      record.queue === 'aram-mayhem' &&
      officialIds.has(record.candidateAugmentId)
    ;(valid ? records : rejected).push(record)
  }

  return {
    patch: input.patch,
    records,
    rejected,
    offMetaRecords: records.filter((record) => (record.games ?? 0) >= 500),
  }
}
```

- [ ] **Step 5: 运行测试**

Run: `npx vitest run src/features/mayhem/snapshot.test.ts`

Expected: 2 tests PASS。

- [ ] **Step 6: 提交**

```bash
git add src/features/mayhem
git commit -m "Add Mayhem snapshot boundaries"
```

### Task 2: 检测当前版本并导入 26.12 官方元数据

**Files:**
- Create: `scripts/mayhem/shared.mjs`
- Create: `scripts/mayhem/detect-live-patch.mjs`
- Create: `scripts/mayhem/import-official.mjs`
- Create: `data/mayhem/current-patch.json`
- Create: `data/mayhem/26.12/official-augments.json`
- Modify: `package.json`
- Test: `src/features/mayhem/snapshot.test.ts`

- [ ] **Step 1: 添加官方元数据契约测试**

```ts
import official from '../../../data/mayhem/26.12/official-augments.json'

it('contains only patch 26.12 Mayhem augments with unique ids', () => {
  expect(official.meta.patch).toBe('26.12')
  expect(official.meta.queue).toBe('aram-mayhem')
  expect(official.augments.length).toBeGreaterThan(0)
  expect(new Set(official.augments.map((augment) => augment.id)).size).toBe(official.augments.length)
  expect(official.augments.every((augment) => augment.name && augment.iconUrl)).toBe(true)
})
```

- [ ] **Step 2: 运行测试并确认缓存缺失**

Run: `npx vitest run src/features/mayhem/snapshot.test.ts`

Expected: FAIL，提示 JSON 文件不存在。

- [ ] **Step 3: 实现共享写入工具**

```js
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'LOL-Companion-Data/0.1 (+https://github.com/ZOELIU2333/lol-companion-prototype)' },
  })
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return response.json()
}

export async function writeJson(path, payload) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`)
}
```

- [ ] **Step 4: 实现当前版本检测器**

检测器交叉读取国服版本公告和 Riot Patch Notes 列表，提取正式服最高共同版本，输出：

```json
{
  "patch": "26.12",
  "detectedAt": "ISO-8601",
  "sources": [
    "https://lol.qq.com/gicp/news/410/37088140.html",
    "https://www.leagueoflegends.com/en-us/news/tags/patch-notes/"
  ]
}
```

两个来源冲突时停止发布新快照并保留上一版本。命令允许 `--patch 26.12` 显式覆盖，便于复现历史快照。

- [ ] **Step 5: 实现官方导入器**

导入器读取 Riot 26.12 版本事实和 CommunityDragon 游戏资源，必须按 Mayhem 专用资源路径或 API 名称过滤，输出：

```json
{
  "meta": {
    "patch": "26.12",
    "queue": "aram-mayhem",
    "sourceIds": ["riot-patch-notes", "communitydragon"],
    "collectedAt": "ISO-8601"
  },
  "augments": [
    {
      "id": 101,
      "apiName": "Example",
      "name": "示例强化",
      "rarity": "gold",
      "description": "效果说明",
      "iconUrl": "https://raw.communitydragon.org/..."
    }
  ]
}
```

无法证明属于海克斯大乱斗的记录不得写入缓存；导入结果为空时命令必须退出 1。

- [ ] **Step 6: 添加 npm 命令并运行导入**

```json
"data:mayhem:patch:detect": "node scripts/mayhem/detect-live-patch.mjs",
"data:mayhem:official:import": "node scripts/mayhem/import-official.mjs --patch 26.12",
"data:mayhem:official:check": "node scripts/mayhem/import-official.mjs --patch 26.12 --from-cache --check"
```

Run: `npm run data:mayhem:patch:detect && npm run data:mayhem:official:import`

Expected: 输出实际强化数量并生成 `data/mayhem/26.12/official-augments.json`。

- [ ] **Step 7: 运行契约测试和检查**

Run: `npm run data:mayhem:official:check && npx vitest run src/features/mayhem/snapshot.test.ts`

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add package.json package-lock.json scripts/mayhem data/mayhem/current-patch.json data/mayhem/26.12/official-augments.json src/features/mayhem/snapshot.test.ts
git commit -m "Import patch 26.12 Mayhem metadata"
```

### Task 3: 接入结构化统计源

**Files:**
- Create: `scripts/mayhem/import-metasrc.mjs`
- Create: `scripts/mayhem/import-opgg.mjs`
- Create: `data/mayhem/26.12/metasrc.json`
- Create: `data/mayhem/26.12/opgg.json`
- Create: `scripts/mayhem/importers.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 为固定 HTML 样本写解析测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMetasrcChampionPage } from './import-metasrc.mjs'

test('parses patch, games, champion win rate and augment names', () => {
  const result = parseMetasrcChampionPage(`
    Patch 26.12
    We've analyzed 18,617 Lillia games
    Lillia is ranked B Tier and has a 47.17% win rate
    Top augment choices include Spellwake
  `, { championId: 876, sourceUrl: 'fixture' })

  assert.equal(result.patch, '26.12')
  assert.equal(result.games, 18617)
  assert.equal(result.winRate, 47.17)
  assert.deepEqual(result.augmentNames, ['Spellwake'])
})
```

- [ ] **Step 2: 运行测试并确认解析器不存在**

Run: `node --test scripts/mayhem/importers.test.mjs`

Expected: FAIL。

- [ ] **Step 3: 实现两个独立适配器**

METAsrc 使用 `https://www.metasrc.com/lol/mayhem` 和英雄详情页，记录 patch、英雄样本、英雄胜率、强化 tier 与装备路径。OP.GG 使用 `https://op.gg/lol/modes/aram-mayhem`，只采集页面明确暴露的 Mayhem 字段。

每个输出记录必须包含：

```js
{
  sourceId: 'metasrc-mayhem',
  sourceUrl,
  collectedAt,
  patch: '26.12',
  queue: 'aram-mayhem',
  population: 'all-ranks',
  championId,
  selectedAugmentIds: [],
  candidateAugmentId,
  itemIds,
  games,
  winRate,
  pickRate,
  sourceConfidence: 0.75,
  evidenceType: 'aggregate'
}
```

站点未提供的数值写 `null`，不得由 tier 名称推算胜率。

- [ ] **Step 4: 添加导入命令**

```json
"data:mayhem:metasrc:import": "node scripts/mayhem/import-metasrc.mjs --patch 26.12",
"data:mayhem:opgg:import": "node scripts/mayhem/import-opgg.mjs --patch 26.12"
```

- [ ] **Step 5: 执行真实导入**

Run: `npm run data:mayhem:metasrc:import`

Expected: 生成非空 `metasrc.json`，所有记录均为 `26.12` 和 `aram-mayhem`。

Run: `npm run data:mayhem:opgg:import`

Expected: 成功则生成 `opgg.json`；若站点限制自动访问，则生成带 `status: "unavailable"` 的诊断文件并正常保留 METAsrc 数据。

- [ ] **Step 6: 运行测试并提交**

```bash
node --test scripts/mayhem/importers.test.mjs
git add scripts/mayhem data/mayhem/26.12 package.json package-lock.json
git commit -m "Import Mayhem aggregate sources"
```

### Task 4: 建立国内外黑科技候选池

**Files:**
- Create: `scripts/mayhem/import-community-candidates.mjs`
- Create: `data/mayhem/26.12/community-candidates.json`
- Test: `scripts/mayhem/importers.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: 写候选规范化测试**

```js
test('community candidates never become aggregate evidence', () => {
  const candidate = normalizeCommunityCandidate({
    sourceId: 'arammayhem',
    championName: 'Brand',
    augmentName: 'Infernal Conduit',
    title: '热门组合',
  })

  assert.equal(candidate.evidenceType, 'community-candidate')
  assert.equal(candidate.games, null)
})
```

- [ ] **Step 2: 实现候选适配器**

首批来源：

- `https://aramgg.com/zh-CN`
- `https://arammayhem.com/`
- `https://arammayhem.com/zh-cn/tier-list/`

采集英雄、强化、装备、组合标题、原始链接和发布时间。不得将点赞、浏览量或站点自定义分数写入 `games`、`wins`、`winRate`。

- [ ] **Step 3: 添加命令并执行**

```json
"data:mayhem:candidates:import": "node scripts/mayhem/import-community-candidates.mjs --patch 26.12"
```

Run: `npm run data:mayhem:candidates:import`

Expected: 生成候选池；来源受限时记录来源健康状态，不阻断命令。

- [ ] **Step 4: 测试并提交**

```bash
node --test scripts/mayhem/importers.test.mjs
git add scripts/mayhem data/mayhem/26.12 package.json package-lock.json
git commit -m "Add Mayhem off-meta candidate sources"
```

### Task 5: 聚合强度与黑科技快照

**Files:**
- Create: `scripts/mayhem/build-snapshot.mjs`
- Create: `data/mayhem/26.12/snapshot.json`
- Create: `src/data/mayhemSnapshot.ts`
- Modify: `src/features/mayhem/snapshot.ts`
- Test: `src/features/mayhem/snapshot.test.ts`

- [ ] **Step 1: 增加去重、冲突与黑科技验证测试**

```ts
it('deduplicates records and lowers confidence on source conflict', () => {
  const snapshot = aggregateMayhemRecords({
    patch: '26.12',
    officialAugmentIds: [101],
    records: [
      record({ sourceId: 'metasrc', candidateAugmentId: 101, games: 1000, winRate: 60 }),
      record({ sourceId: 'metasrc', candidateAugmentId: 101, games: 1000, winRate: 60 }),
      record({ sourceId: 'opgg', candidateAugmentId: 101, games: 1000, winRate: 45 }),
    ],
  })

  expect(snapshot.recommendations.strength[0].sourceCount).toBe(2)
  expect(snapshot.recommendations.strength[0].confidence).toBe('low')
})
```

- [ ] **Step 2: 实现聚合规则**

权重由 `sourceConfidence * log10(games + 10) * freshnessFactor` 计算。相同来源重复记录先去重；独立来源胜率差超过 10 个百分点时，推荐标记 `observing: true` 且可信度降为 low。

黑科技推荐必须同时满足：

```ts
games >= 500 &&
pickRate !== null &&
pickRate <= 15 &&
winRate !== null &&
winRate > baselineWinRate &&
evidenceType === 'aggregate'
```

- [ ] **Step 3: 生成 JSON 与 TypeScript 快照**

Run: `node scripts/mayhem/build-snapshot.mjs --patch 26.12`

Expected:

- `data/mayhem/26.12/snapshot.json`
- `src/data/mayhemSnapshot.ts`
- 快照 `schemaVersion`、`generatedAt`、`expiresAt`、`sources`、`completeness` 完整。

- [ ] **Step 4: 检查与提交**

```bash
npx vitest run src/features/mayhem/snapshot.test.ts
git add scripts/mayhem/build-snapshot.mjs data/mayhem/26.12/snapshot.json src/data/mayhemSnapshot.ts src/features/mayhem
git commit -m "Aggregate Mayhem recommendation snapshot"
```

### Task 6: 实现强度/黑科技实时三选一评分

**Files:**
- Create: `src/features/mayhem/scoring.ts`
- Test: `src/features/mayhem/scoring.test.ts`
- Modify: `src/types.ts`
- Modify: `src/lib/recommendations.ts`
- Modify: `src/lib/recommendations.test.ts`

- [ ] **Step 1: 写评分失败测试**

```ts
it('ranks only the three current candidates', () => {
  const ranked = rankMayhemCandidates({
    mode: 'strength',
    championId: 103,
    selectedAugmentIds: [11],
    candidateAugmentIds: [21, 22, 23],
    snapshot,
  })

  expect(ranked.map((entry) => entry.augmentId).sort()).toEqual([21, 22, 23])
})

it('uses a different weighting model for off-meta mode', () => {
  const strength = rankMayhemCandidates({ ...input, mode: 'strength' })
  const offMeta = rankMayhemCandidates({ ...input, mode: 'off-meta' })
  expect(strength.map((entry) => entry.augmentId)).not.toEqual(offMeta.map((entry) => entry.augmentId))
})
```

- [ ] **Step 2: 实现评分器**

强度模式：

```ts
score =
  normalizedWinRate * 0.4 +
  sampleStability * 0.25 +
  championFit * 0.2 +
  selectedSynergy * 0.15
```

黑科技模式：

```ts
score =
  comboLift * 0.35 +
  rarityValue * 0.25 +
  championFit * 0.2 +
  crossSourceStability * 0.2
```

返回项必须包含 `scoreBreakdown`、`games`、`sourceCount`、`confidence`、`reason` 和 `itemIds`。

- [ ] **Step 3: 替换旧评分入口**

`rankAugments()` 优先按 ID 查询 26.12 快照。仅当快照缺少当前候选时使用旧标签规则，并将 `dataSourceLabel` 明确设置为 `本地规则兜底 · 非版本统计`。

- [ ] **Step 4: 运行测试并提交**

```bash
npx vitest run src/features/mayhem/scoring.test.ts src/lib/recommendations.test.ts
git add src/features/mayhem src/types.ts src/lib/recommendations.ts src/lib/recommendations.test.ts
git commit -m "Score live Mayhem augment choices"
```

### Task 7: 从实时接口传递已选强化与候选

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/services/liveClientData.ts`
- Modify: `src/services/liveClientData.test.ts`

- [ ] **Step 1: 扩展前端桥接测试**

```ts
tauriMocks.invoke.mockResolvedValue({
  gameTime: 914,
  currentItemIds: [3004],
  selectedAugmentIds: [11, 12],
  selectedAugmentNames: ['法术苏醒', '现象级邪恶'],
  candidateAugmentIds: [21, 22, 23],
  source: 'live-client-data',
})

expect((await host?.readSnapshot())?.selectedAugmentIds).toEqual([11, 12])
expect((await host?.readSnapshot())?.candidateAugmentIds).toEqual([21, 22, 23])
```

- [ ] **Step 2: 扩展 Rust payload**

```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LiveClientSnapshotPayload {
    game_time: f64,
    current_item_ids: Vec<u32>,
    selected_augment_ids: Vec<u32>,
    selected_augment_names: Vec<String>,
    candidate_augment_ids: Vec<u32>,
    source: String,
}
```

只解析实际响应中存在且可稳定确认的字段。若 Live Client Data 不暴露候选强化，返回空数组，前端显示“等待候选同步”，不得伪造三选一。

- [ ] **Step 3: 将实时数据投影到 Match**

`applyLiveClientSnapshotToMatch()` 使用实时已选强化覆盖 Demo 值，并保存候选 ID。空数组不覆盖已有 Demo 场景，真实桌面会话中通过单独的 `isLiveDataAuthoritative` 标记避免误展示 Demo 候选。

- [ ] **Step 4: 运行验证**

```bash
npx vitest run src/services/liveClientData.test.ts
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src-tauri/src/lib.rs src/services/liveClientData.ts src/services/liveClientData.test.ts src/types.ts
git commit -m "Read Mayhem augment state from live client"
```

### Task 8: 更新海克斯推荐界面

**Files:**
- Modify: `src/app/useCompanionSession.ts`
- Modify: `src/components/AugmentRecommendation.tsx`
- Modify: `src/components/OverlayPanel.tsx`
- Modify: `src/App.css`
- Modify: `src/types.ts`

- [ ] **Step 1: 增加模式状态**

```ts
const [mayhemRecommendationMode, setMayhemRecommendationMode] =
  useState<MayhemRecommendationMode>('strength')
```

将模式传给 `createRecommendations(match, activeMode, mayhemRecommendationMode)`。

- [ ] **Step 2: 增加紧凑分段控件**

```tsx
<div className="mayhem-mode-switch" role="group" aria-label="海克斯推荐模式">
  <button aria-pressed={mode === 'strength'} onClick={() => onModeChange('strength')}>强度</button>
  <button aria-pressed={mode === 'off-meta'} onClick={() => onModeChange('off-meta')}>黑科技</button>
</div>
```

每张候选卡仅显示图标、名称、分数、一句原因、样本与可信度、装备图标。来源和更新时间只在标题下方显示一次。

- [ ] **Step 3: 增加过期与观察中状态**

```tsx
{snapshotIsStale && <span className="status-warn">数据版本 {patch} · 已过期</span>}
{recommendation.observing && <span className="status-muted">观察中</span>}
```

不显示没有证据支撑的“概率”百分比。

- [ ] **Step 4: 运行前端检查与视觉验证**

```bash
npm run test
npm run lint
npm run build
```

启动 `npm run dev -- --host 127.0.0.1`，用 in-app Browser 检查 460×760 和桌面宽屏：控件不换行错位、三张卡片不溢出、装备只显示图标。

- [ ] **Step 5: 提交**

```bash
git add src/app/useCompanionSession.ts src/components/AugmentRecommendation.tsx src/components/OverlayPanel.tsx src/App.css src/types.ts
git commit -m "Add Mayhem strength and off-meta views"
```

### Task 9: 每日自动更新与诊断

**Files:**
- Create: `.github/workflows/mayhem-data-refresh.yml`
- Create: `scripts/mayhem/validate-snapshot.mjs`
- Create: `scripts/mayhem/refresh-current.mjs`
- Modify: `package.json`

- [ ] **Step 1: 实现快照质量检查**

检查：

```js
import currentPatch from '../../data/mayhem/current-patch.json' with { type: 'json' }

assert.equal(snapshot.patch, currentPatch.patch)
assert.equal(snapshot.queue, 'aram-mayhem')
assert.equal(snapshot.officialCoverage, 1)
assert.ok(snapshot.sources.some((source) => source.kind === 'aggregate' && source.status === 'online'))
assert.ok(snapshot.recommendations.offMeta.every((entry) => entry.games >= 500))
```

- [ ] **Step 2: 添加完整刷新命令**

```json
"data:mayhem:refresh": "npm run data:mayhem:patch:detect && node scripts/mayhem/refresh-current.mjs",
"data:mayhem:check": "node scripts/mayhem/validate-snapshot.mjs --current"
```

- [ ] **Step 3: 创建每日工作流**

```yaml
name: Mayhem Data Refresh

on:
  workflow_dispatch:
  schedule:
    - cron: "20 19 * * *"

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run data:mayhem:refresh
      - run: npm run data:mayhem:check
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: mayhem-data-diagnostics
          path: data/mayhem/
```

`refresh-current.mjs` 读取 `data/mayhem/current-patch.json`，将版本传给所有导入器和聚合器。`19:20 UTC` 对应中国标准时间次日 `03:20`，满足每天自动更新一次。

- [ ] **Step 4: 本地执行完整刷新与检查**

Run: `npm run data:mayhem:refresh && npm run data:mayhem:check`

Expected: 两个命令均为 0；某个非核心站点失败时，快照记录离线状态但仍通过核心检查。

- [ ] **Step 5: 提交**

```bash
git add .github/workflows/mayhem-data-refresh.yml scripts/mayhem package.json package-lock.json data/mayhem src/data/mayhemSnapshot.ts
git commit -m "Automate daily Mayhem data refresh"
```

### Task 10: 文档、全量验证与 Windows 交付

**Files:**
- Modify: `README.md`
- Modify: `docs/data-source-matrix.md`
- Modify: `docs/superpowers/specs/2026-06-14-aram-mayhem-26-12-multi-source-data-design.md`

- [ ] **Step 1: 更新数据来源说明**

明确记录：

- 海克斯大乱斗：全分段，26.12。
- 匹配/排位：韩服钻石以上。
- 官方层：Riot + CommunityDragon。
- 统计层：METAsrc、OP.GG；站点不可用时单独降级。
- 候选层：aramgg.com、arammayhem.com。
- 社区候选必须由不少于 500 场结构化样本验证。

- [ ] **Step 2: 执行全量验证**

```bash
npm run data:mayhem:check
npm run test
npm run lint
npm run build
npm run tauri:build -- --no-bundle
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: 全部 PASS。

- [ ] **Step 3: 验证 Windows workflow**

推送后检查：

- `Windows Installer` 工作流绿色。
- `LOL-Companion-Windows-Portable` artifact 存在。
- `Mayhem Data Refresh` 手动运行成功。
- 应用内显示 26.12 和实际快照更新时间。

- [ ] **Step 4: 提交文档**

```bash
git add README.md docs/data-source-matrix.md docs/superpowers/specs/2026-06-14-aram-mayhem-26-12-multi-source-data-design.md
git commit -m "Document Mayhem data refresh workflow"
```
