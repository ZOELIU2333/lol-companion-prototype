import { useMemo, useRef, useState } from 'react'
import type { ArenaCatalogIndex } from '../catalog/types'
import { ArenaIcon } from './ArenaIcon'
import { AugmentSearch } from './AugmentSearch'

type SearchTarget = { kind: 'selected' } | { kind: 'candidate'; slot: 0 | 1 | 2 }

export type ArenaManualControlsProps = {
  catalog: ArenaCatalogIndex
  selectedIds: number[]
  candidateSlots: readonly [number | null, number | null, number | null]
  onAddSelected: (augmentId: number) => void
  onRemoveSelected: (augmentId: number) => void
  onSetCandidateSlot: (slot: 0 | 1 | 2, augmentId: number) => void
  onClearCandidateSlot: (slot: 0 | 1 | 2) => void
  onConfirmCandidate: (augmentId: number) => void
  onResetMatch: () => void
}

export function ArenaManualControls({
  catalog,
  selectedIds,
  candidateSlots,
  onAddSelected,
  onRemoveSelected,
  onSetCandidateSlot,
  onClearCandidateSlot,
  onConfirmCandidate,
  onResetMatch,
}: ArenaManualControlsProps) {
  const [searchTarget, setSearchTarget] = useState<SearchTarget | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null)
  const selected = selectedIds.map((id) => catalog.find(id)).filter((augment) => augment !== null)
  const filledCount = candidateSlots.filter((id) => id !== null).length
  const unavailable = useMemo(() => {
    const reasons = new Map<number, string>()
    selectedIds.forEach((id) => reasons.set(id, '已在已选海克斯中'))
    candidateSlots.forEach((id) => {
      if (id !== null && !reasons.has(id)) reasons.set(id, '已在本轮候选中')
    })
    return reasons
  }, [candidateSlots, selectedIds])

  const openSearch = (target: SearchTarget, trigger: HTMLButtonElement) => {
    restoreFocusRef.current = trigger
    setSearchTarget(target)
  }
  const closeSearch = () => {
    setSearchTarget(null)
    queueMicrotask(() => restoreFocusRef.current?.focus())
  }
  const selectSearchResult = (augmentId: number) => {
    if (!searchTarget) return
    if (searchTarget.kind === 'selected') onAddSelected(augmentId)
    else onSetCandidateSlot(searchTarget.slot, augmentId)
    closeSearch()
  }

  return (
    <section className="arena-manual" aria-label="手动海克斯输入">
      <div className="arena-manual-section">
        <div className="arena-manual-title">
          <div><strong>已选海克斯</strong><span>{selected.length}/4</span></div>
          <button
            className={confirmingReset ? 'arena-reset active' : 'arena-reset'}
            type="button"
            onClick={() => {
              if (!confirmingReset) {
                setConfirmingReset(true)
                return
              }
              onResetMatch()
              setConfirmingReset(false)
            }}
          >
            {confirmingReset ? '确认重置本局' : '重置本局'}
          </button>
        </div>
        <div className="arena-selected-row">
          {selected.map((augment) => (
            <button
              aria-label={`撤销${augment.name}`}
              className={`arena-selected-chip arena-rarity-${augment.rarity}`}
              key={augment.id}
              type="button"
              onClick={() => onRemoveSelected(augment.id)}
            >
              <ArenaIcon alt="" src={augment.iconSmallUrl ?? augment.iconLargeUrl} />
              <span>{augment.name}</span>
              <i>×</i>
            </button>
          ))}
          <button
            aria-label="添加已选海克斯"
            className="arena-add-selected"
            disabled={selected.length >= 4}
            type="button"
            onClick={(event) => openSearch({ kind: 'selected' }, event.currentTarget)}
          >
            + 添加已选海克斯
          </button>
        </div>
      </div>

      <div className="arena-manual-section">
        <div className="arena-manual-title">
          <div><strong>本轮三个候选</strong><span>{filledCount}/3</span></div>
          {filledCount < 3 && <small>还差 {3 - filledCount} 个</small>}
        </div>
        <div className="arena-candidate-slots">
          {candidateSlots.map((id, index) => {
            const slot = index as 0 | 1 | 2
            const augment = id === null ? null : catalog.find(id)
            return (
              <article data-testid="arena-candidate-slot" key={slot}>
                {augment ? (
                  <>
                    <button
                      aria-label={`更换候选 ${slot + 1}：${augment.name}`}
                      className={`arena-slot-main arena-rarity-${augment.rarity}`}
                      type="button"
                      onClick={(event) => openSearch({ kind: 'candidate', slot }, event.currentTarget)}
                    >
                      <ArenaIcon alt={augment.name} src={augment.iconSmallUrl ?? augment.iconLargeUrl} />
                      <strong>{augment.name}</strong>
                    </button>
                    <button
                      aria-label={`清除候选 ${slot + 1}`}
                      className="arena-slot-clear"
                      type="button"
                      onClick={() => onClearCandidateSlot(slot)}
                    >×</button>
                    {filledCount === 3 && (
                      <button
                        aria-label={`选择${augment.name}`}
                        className="arena-slot-confirm"
                        type="button"
                        onClick={() => onConfirmCandidate(augment.id)}
                      >选这个</button>
                    )}
                  </>
                ) : (
                  <button
                    aria-label={`设置候选 ${slot + 1}`}
                    className="arena-slot-empty"
                    type="button"
                    onClick={(event) => openSearch({ kind: 'candidate', slot }, event.currentTarget)}
                  >
                    <span>{slot + 1}</span>
                    设置候选 {slot + 1}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      </div>

      {searchTarget && (
        <AugmentSearch
          catalog={catalog}
          unavailable={unavailable}
          onSelect={selectSearchResult}
          onClose={closeSearch}
        />
      )}
    </section>
  )
}
