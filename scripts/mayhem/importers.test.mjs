import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMetasrcChampionPage } from './import-metasrc.mjs'
import { normalizeCommunityCandidate } from './import-community-candidates.mjs'
import { parseAramMayhemAugments } from './import-arammayhem.mjs'

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

test('detects cloudflare challenge markers via isCloudflareChallenge', async () => {
  const { isCloudflareChallenge } = await import('./import-metasrc.mjs')
  assert.equal(isCloudflareChallenge('<title>Just a moment...</title>'), true)
  assert.equal(isCloudflareChallenge('<div id="cf-browser-verification">'), true)
  assert.equal(isCloudflareChallenge('Attention Required! | Cloudflare'), true)
  assert.equal(isCloudflareChallenge('<html>Lillia 47.17% win rate</html>'), false)
})

test('returns soft nulls when the page structure is missing', () => {
  const result = parseMetasrcChampionPage('totally unrelated content', {
    championId: 1,
    sourceUrl: 'fixture',
  })
  assert.equal(result.patch, null)
  assert.equal(result.games, null)
  assert.equal(result.winRate, null)
  assert.deepEqual(result.augmentNames, [])
})

test('parses a multi-augment "include A, B and C" phrase', () => {
  const result = parseMetasrcChampionPage(
    'Patch 26.12. Top augment choices include Spellwake, First Strike and Gather Storm.',
    { championId: 1, sourceUrl: 'fixture' },
  )
  assert.deepEqual(result.augmentNames, ['Spellwake', 'First Strike', 'Gather Storm'])
})

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

test('parses live ARAM Mayhem win and pick rates without inventing sample size', () => {
  const rows = parseAramMayhemAugments(`
    <a href="/augments/transmute-prismatic" class="augment-rank-row"
      data-name="transmute: prismatic transmute: prismatic"
      data-rarity="gold" data-availability="live" data-live-rank="1">
      <img alt="Transmute: Prismatic">
      <div class="text-right text-base font-semibold">67.38%</div>
      <div class="hidden text-right text-sm tabular-nums">69.86%</div>
    </a>
  `)

  assert.deepEqual(rows, [{
    sourcePath: '/augments/transmute-prismatic',
    rarity: 'gold',
    name: 'Transmute: Prismatic',
    winRate: 67.38,
    pickRate: 69.86,
  }])
})
