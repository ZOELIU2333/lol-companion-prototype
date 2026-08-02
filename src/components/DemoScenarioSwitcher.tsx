import type { Match } from '../types'

type DemoScenarioSwitcherProps = {
  matches: Match[]
  selectedMatchId: string
  onSelect: (matchId: string) => void
}

export function DemoScenarioSwitcher({ matches, selectedMatchId, onSelect }: DemoScenarioSwitcherProps) {
  return (
    <label className="demo-scenario">
      <span>Demo 场景</span>
      <select value={selectedMatchId} onChange={(event) => onSelect(event.target.value)}>
        {matches.map((match) => (
          <option key={match.id} value={match.id}>
            {match.mode === 'arena' ? '竞技场' : '匹配/排位'} · {match.champions.find((champion) => champion.id === match.currentChampionId)?.name}
          </option>
        ))}
      </select>
    </label>
  )
}
