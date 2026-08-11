import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createArenaCatalogRepository, type ArenaCatalogCandidate } from './repository'

const bundled: ArenaCatalogCandidate = {
  catalog: JSON.parse(readFileSync('public/data/arena/catalog.json', 'utf8')),
  manifest: JSON.parse(readFileSync('public/data/arena/manifest.json', 'utf8')),
}

function withGeneratedAt(candidate: ArenaCatalogCandidate, generatedAt: string): ArenaCatalogCandidate {
  return {
    catalog: { ...candidate.catalog as Record<string, unknown>, generatedAt },
    manifest: { ...candidate.manifest as Record<string, unknown>, generatedAt },
  }
}

describe('Arena catalog repository', () => {
  it('rejects a corrupt runtime cache and returns bundled data', async () => {
    const corruptRuntime = {
      catalog: bundled.catalog,
      manifest: { ...bundled.manifest as Record<string, unknown>, contentHash: `sha256:${'0'.repeat(64)}` },
    }
    const repository = createArenaCatalogRepository({ bundled, runtime: { read: async () => corruptRuntime } })

    await expect(repository.load()).resolves.toMatchObject({ source: 'bundled-cache' })
  })

  it('prefers a valid runtime cache that is not older than bundled data', async () => {
    const runtime = withGeneratedAt(bundled, '2026-08-04T00:00:00.000Z')
    const repository = createArenaCatalogRepository({ bundled, runtime: { read: async () => runtime } })

    await expect(repository.load()).resolves.toMatchObject({ source: 'runtime-cache' })
  })

  it('rejects a valid but older runtime cache', async () => {
    const runtime = withGeneratedAt(bundled, '2020-01-01T00:00:00.000Z')
    const repository = createArenaCatalogRepository({ bundled, runtime: { read: async () => runtime } })

    await expect(repository.load()).resolves.toMatchObject({ source: 'bundled-cache' })
  })

  it('returns the current snapshot when refresh times out', async () => {
    const repository = createArenaCatalogRepository({
      bundled,
      refreshSource: async () => new Promise(() => undefined),
      refreshTimeoutMs: 5,
    })

    await expect(repository.refresh()).resolves.toMatchObject({
      updated: false,
      reason: 'timeout',
      snapshot: { source: 'bundled-cache' },
    })
  })

  it('rejects an invalid download without promoting it', async () => {
    const promote = vi.fn()
    const repository = createArenaCatalogRepository({
      bundled,
      runtime: { read: async () => null, promote },
      refreshSource: async () => ({
        catalog: bundled.catalog,
        manifest: { ...bundled.manifest as Record<string, unknown>, count: 1 },
      }),
    })

    await expect(repository.refresh()).resolves.toMatchObject({ updated: false })
    expect(promote).not.toHaveBeenCalled()
  })

  it('atomically promotes a verified newer download', async () => {
    const promote = vi.fn(async () => undefined)
    const downloaded = withGeneratedAt(bundled, '2026-08-05T00:00:00.000Z')
    const repository = createArenaCatalogRepository({
      bundled,
      runtime: { read: async () => null, promote },
      refreshSource: async () => downloaded,
    })

    await expect(repository.refresh()).resolves.toMatchObject({
      updated: true,
      snapshot: { source: 'runtime-cache' },
    })
    expect(promote).toHaveBeenCalledOnce()
    expect(promote).toHaveBeenCalledWith(downloaded)
  })

  it.each([
    ['fresh', '2026-08-01T00:00:00.000Z'],
    ['aging', '2026-07-25T00:00:00.000Z'],
    ['stale', '2026-07-01T00:00:00.000Z'],
  ])('labels catalog freshness as %s', async (freshness, generatedAt) => {
    const repository = createArenaCatalogRepository({
      bundled: withGeneratedAt(bundled, generatedAt),
      now: () => new Date('2026-08-03T00:00:00.000Z'),
    })

    await expect(repository.load()).resolves.toMatchObject({ freshness })
  })
})
