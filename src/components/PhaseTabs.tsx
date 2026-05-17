import type { InfoPhase } from '../types'

type PhaseTabsProps = {
  activePhase: InfoPhase
  onChange: (phase: InfoPhase) => void
}

const phases: { id: InfoPhase; label: string }[] = [
  { id: 'pregame', label: '对局前信息' },
  { id: 'live', label: '实时对局' },
]

export function PhaseTabs({ activePhase, onChange }: PhaseTabsProps) {
  return (
    <div className="phase-tabs" role="tablist" aria-label="信息阶段">
      {phases.map((phase) => (
        <button
          key={phase.id}
          className={phase.id === activePhase ? 'phase-tab active' : 'phase-tab'}
          type="button"
          onClick={() => onChange(phase.id)}
        >
          {phase.label}
        </button>
      ))}
    </div>
  )
}
