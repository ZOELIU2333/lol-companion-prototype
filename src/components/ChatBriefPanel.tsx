import { Clipboard, Send } from 'lucide-react'

type ChatBriefPanelProps = {
  brief: string
  onCopy: () => void
  onSimulateSend: () => void
}

export function ChatBriefPanel({ brief, onCopy, onSimulateSend }: ChatBriefPanelProps) {
  const briefLines = brief.split('｜')

  return (
    <section className="panel-section">
      <div className="section-title">
        <h3>聊天简报</h3>
        <span className="demo-pill">Demo</span>
      </div>
      <div className="brief-lines">
        {briefLines.map((line) => (
          <p className="brief-text" key={line}>{line}</p>
        ))}
      </div>
      <div className="button-row">
        <button className="primary-action" type="button" onClick={onCopy}>
          <Clipboard size={15} />
          复制简报
        </button>
        <button className="ghost-action" type="button" onClick={onSimulateSend}>
          <Send size={15} />
          模拟发送
        </button>
      </div>
    </section>
  )
}
