import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
const Router = import.meta.env.VITE_MEMORY_ROUTER ? MemoryRouter : BrowserRouter
import App from './App'
import { StoreProvider } from './lib/store'
import { ToastProvider } from './components/ui'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <StoreProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StoreProvider>
    </Router>
  </React.StrictMode>,
)
