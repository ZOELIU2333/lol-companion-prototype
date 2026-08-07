import App from '../App'
import { DesktopErrorBoundary, FrontendReadyMarker } from './DesktopErrorBoundary'

export function DesktopRoot() {
  return (
    <DesktopErrorBoundary>
      <App />
      <FrontendReadyMarker />
    </DesktopErrorBoundary>
  )
}
