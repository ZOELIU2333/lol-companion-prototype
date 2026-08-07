import { useState } from 'react'

const fallbackIcon = '/assets/arena-placeholder.svg'

export function ArenaIcon({ alt, src, className }: { alt: string; src: string | null; className?: string }) {
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const resolvedSource = src && src !== failedSource ? src : fallbackIcon

  return (
    <img
      alt={alt}
      className={className}
      src={resolvedSource}
      onError={() => setFailedSource(src)}
    />
  )
}
