import { useMemo, useState } from 'react'
import type { ArenaCatalogIndex } from '../catalog/types'
import { ArenaIcon } from './ArenaIcon'

type AugmentPickerProps = {
  catalog: ArenaCatalogIndex
  onConfirm: (candidateIds: number[]) => void
}

export function AugmentPicker({ catalog, onConfirm }: AugmentPickerProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return catalog.catalog.augments
    return catalog.catalog.augments.filter((augment) =>
      [augment.name, augment.englishName, augment.apiName].some((name) => name.toLowerCase().includes(normalized)))
  }, [catalog, query])

  const toggle = (id: number) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id)
      if (current.length >= 3) return current
      return [...current, id]
    })
  }

  return (
    <div className="arena-picker">
      <label>
        <span>搜索海克斯</span>
        <input
          aria-label="搜索海克斯"
          role="searchbox"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="中文 / English / API"
        />
      </label>
      <p>已选 {selected.length}/3</p>
      <div className="arena-picker-results">
        {results.map((augment) => (
          <button
            aria-pressed={selected.includes(augment.id)}
            className={selected.includes(augment.id) ? 'arena-picker-option active' : 'arena-picker-option'}
            key={augment.id}
            type="button"
            onClick={() => toggle(augment.id)}
          >
            <ArenaIcon alt="" src={augment.iconSmallUrl ?? augment.iconLargeUrl} />
            <span><strong>{augment.name}</strong><small>{augment.englishName}</small></span>
          </button>
        ))}
      </div>
      <button
        className="arena-picker-confirm"
        disabled={selected.length !== 3}
        type="button"
        onClick={() => onConfirm(selected)}
      >
        确认三个候选
      </button>
    </div>
  )
}
