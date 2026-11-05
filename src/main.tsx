import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { requestPersistentStorage } from './db/persist'
import { captureInstallPrompt } from './features/pwa/install'
import './index.css'

captureInstallPrompt()
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
