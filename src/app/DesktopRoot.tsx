import { useEffect } from 'react'
import App from '../App'

export function DesktopRoot() {
  useEffect(() => {
    const boot = window.__LOL_COMPANION_BOOT__
    if (boot) {
      boot.ready = true
      boot.report('frontend-ready')
    }
    const fallback = document.getElementById('boot-fallback')
    if (fallback) fallback.hidden = true
  }, [])

  return <App />
}
