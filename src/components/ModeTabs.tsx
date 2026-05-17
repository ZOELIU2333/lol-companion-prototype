import type { GameMode } from '../types'

const labels = {
  ranked: '匹配/排位',
  augment: '海克斯',
} satisfies Partial<Record<GameMode, string>>

const visibleModes = ['ranked', 'augment'] as const

type ModeTabsProps = {
  activeMode: GameMode
  onChange: (mode: GameMode) => void
}

export function ModeTabs({ activeMode, onChange }: ModeTabsProps) {
  return (
    <div className="mode-tabs" role="tablist" aria-label="模式切换">
      {visibleModes.map((mode) => (
        <button
          key={mode}
          className={mode === activeMode ? 'mode-tab active' : 'mode-tab'}
          type="button"
          onClick={() => onChange(mode)}
        >
          {labels[mode]}
        </button>
      ))}
    </div>
  )
}
