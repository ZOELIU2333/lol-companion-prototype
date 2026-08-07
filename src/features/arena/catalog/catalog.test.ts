import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createArenaCatalogIndex,
  parseArenaCatalog,
  verifyArenaCatalogManifest,
} from './catalog'

const catalogJson = JSON.parse(readFileSync('public/data/arena/catalog.json', 'utf8'))
const manifestJson = JSON.parse(readFileSync('public/data/arena/manifest.json', 'utf8'))

describe('Arena catalog runtime', () => {
  it('parses the generated live catalog and verifies its manifest', async () => {
    const catalog = parseArenaCatalog(catalogJson)

    expect(catalog.augments.length).toBeGreaterThanOrEqual(200)
    await expect(verifyArenaCatalogManifest(catalog, manifestJson)).resolves.toMatchObject({ count: catalog.augments.length })
  })

  it('resolves id, API name, Chinese name, and English name', () => {
    const index = createArenaCatalogIndex(parseArenaCatalog(catalogJson))

    expect(index.find(27)?.apiName).toBe('Earthwake')
    expect(index.find('大地苏醒')?.id).toBe(27)
    expect(index.find('earthwake')?.id).toBe(27)
    expect(index.find('Earthwake')?.id).toBe(27)
    expect(index.find('not-an-augment')).toBeNull()
  })

  it('uses the CommunityDragon game asset root', () => {
    const index = createArenaCatalogIndex(parseArenaCatalog(catalogJson))

    expect(index.find('Earthwake')?.iconLargeUrl).toContain('/latest/game/assets/ux/cherry/')
  })

  it('rejects unsupported schema, duplicate identities, unsafe icons, and too few rows', () => {
    expect(() => parseArenaCatalog({ ...catalogJson, schemaVersion: 2 })).toThrow('Unsupported Arena catalog schema')
    expect(() => parseArenaCatalog({ ...catalogJson, augments: catalogJson.augments.slice(0, 2) })).toThrow(
      'expected at least 200',
    )
    expect(() => parseArenaCatalog({
      ...catalogJson,
      augments: [...catalogJson.augments.slice(0, -1), { ...catalogJson.augments[0] }],
    })).toThrow('Duplicate Arena augment id')
    expect(() => parseArenaCatalog({
      ...catalogJson,
      augments: catalogJson.augments.map((item: Record<string, unknown>, index: number) =>
        index === 0 ? { ...item, iconLargeUrl: 'javascript:alert(1)' } : item),
    })).toThrow('invalid icon URL')
  })

  it('rejects a manifest with the wrong hash or count', async () => {
    const catalog = parseArenaCatalog(catalogJson)

    await expect(verifyArenaCatalogManifest(catalog, {
      ...manifestJson,
      contentHash: `sha256:${'0'.repeat(64)}`,
    })).rejects.toThrow('content hash does not match')
    await expect(verifyArenaCatalogManifest(catalog, { ...manifestJson, count: 1 })).rejects.toThrow(
      'augment count does not match',
    )
  })
})
