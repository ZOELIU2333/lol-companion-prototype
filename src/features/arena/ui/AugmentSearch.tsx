import { useMemo, useState } from 'react'
import type { ArenaCatalogIndex } from '../catalog/types'
import { searchArenaAugments } from '../catalog/search'
import { ArenaIcon } from './ArenaIcon'

export type AugmentSearchProps = {
  catalog: ArenaCatalogIndex
  unavailable: ReadonlyMap<number, string>
  onSelect: (augmentId: number) => void
  onClose?: () => void
}

const rarityLabels = {
  silver: '白银',
  gold: '黄金',
  prismatic: '棱彩',
  unknown: '未知',
} as const

export function AugmentSearch({ catalog, unavailable, onSelect, onClose }: AugmentSearchProps) {
  const [query, setQuery] = useState('')
  const results = useMemo(
    () => searchArenaAugments(catalog, query, unavailable),
    [catalog, query, unavailable],
  )

  return (
    <div className="arena-search" onKeyDown={(event) => {
      if (event.key === 'Escape') onClose?.()
    }}>
      <div className="arena-search-head">
        <label>
          <span>搜索海克斯</span>
          <input
            autoFocus
            aria-label="搜索海克斯"
            role="searchbox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="中文 / English / API / 描述"
          />
        </label>
        {onClose && <button type="button" onClick={onClose} aria-label="关闭海克斯搜索">关闭</button>}
      </div>
      {results.length === 0 ? (
        <p className="arena-search-empty">没有找到匹配的海克斯</p>
      ) : (
        <div className="arena-search-results">
          {results.map(({ augment, disabledReason }) => (
            <button
              aria-label={disabledReason ? `${augment.name}：${disabledReason}` : augment.name}
              className={`arena-search-option arena-search-option--${augment.rarity}`}
              disabled={Boolean(disabledReason)}
              key={augment.id}
              type="button"
              onClick={() => onSelect(augment.id)}
            >
              <ArenaIcon alt={augment.name} src={augment.iconSmallUrl ?? augment.iconLargeUrl} />
              <span>
                <strong>{augment.name}</strong>
                <small>{augment.englishName} · {rarityLabels[augment.rarity]}</small>
                {disabledReason && <em>{disabledReason}</em>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
