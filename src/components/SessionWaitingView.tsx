import { Gamepad2 } from 'lucide-react'

export function SessionWaitingView({ connectionStatusLabel }: { connectionStatusLabel: string }) {
  return (
    <section className="session-waiting" aria-live="polite">
      <Gamepad2 size={28} aria-hidden="true" />
      <p className="eyebrow">实时助手</p>
      <h2>等待进入游戏</h2>
      <strong>{connectionStatusLabel}</strong>
      <p>进入对局后会自动读取英雄、装备与竞技场状态，无需手动刷新。</p>
    </section>
  )
}
