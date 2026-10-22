import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { isConfigured } from './lib/supabase'
import { AuthProvider } from './context/AuthContext'
import SetupNotice from './pages/SetupNotice'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isConfigured ? (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    ) : (
      <SetupNotice />
    )}
  </React.StrictMode>
)

// Register the PWA service worker in production builds only, so it never interferes with the Vite dev server.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed:', err))
  })
}
