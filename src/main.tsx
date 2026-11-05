import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { requestPersistentStorage } from './db/persist'
import { captureInstallPrompt } from './features/pwa/install'
import './index.css'

captureInstallPrompt()
void requestPersistentStorage()

// Data contoh hanya untuk dev (screenshot/mencoba tampilan), tidak ikut build produksi.
if (import.meta.env.DEV) void import('./dev/sample').then((m) => Object.assign(window, { __qawwamSample: m.loadSample }))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
