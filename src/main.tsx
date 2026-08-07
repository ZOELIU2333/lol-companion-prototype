import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { DesktopRoot } from './app/DesktopRoot'

const root = document.getElementById('root')
if (!root) throw new Error('React root element is missing')

createRoot(root).render(
  <StrictMode>
    <DesktopRoot />
  </StrictMode>,
)
