import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './stile/tema.css'

if ('serviceWorker' in navigator) {
  // Dopo il caricamento: registrarlo prima ruberebbe banda proprio mentre
  // l'ospite sta guardando le prime foto.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* pazienza */ })
  })
}

createRoot(document.getElementById('radice')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
