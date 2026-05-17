import type { ReactNode } from 'react'

type CollapsibleSectionProps = {
  children: ReactNode
  defaultOpen?: boolean
  title: string
}

export function CollapsibleSection({ children, defaultOpen = false, title }: CollapsibleSectionProps) {
  return (
    <details className="collapsible-section" open={defaultOpen}>
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  )
}
