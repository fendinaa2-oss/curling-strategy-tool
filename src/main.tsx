import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        const appRegistrations = registrations.filter((registration) =>
          [registration.active, registration.waiting, registration.installing]
            .filter((worker) => worker !== null)
            .some((worker) => new URL(worker.scriptURL).pathname === '/sw.js'),
        )

        return Promise.all(appRegistrations.map((registration) => registration.unregister()))
      })
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('curling-strategy-tool-'))
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      return
    }

    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
