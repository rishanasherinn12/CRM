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
