import { useEffect, useState } from 'react'
import { api, type MediaRiga } from './api'
import { Benvenuto } from './schermate/Benvenuto'
import { Muro } from './schermate/Muro'
import { Visore } from './schermate/Visore'
import { Messaggi } from './schermate/Messaggi'
import { Sposi } from './schermate/Sposi'
import { coda } from './upload/coda'

type Vista = 'muro' | 'messaggi'

export function App() {
  const [io, setIo] = useState<{ dentro: boolean; nome?: string; sposi: string } | null>(null)
  const [vista, setVista] = useState<Vista>('muro')
  const [visore, setVisore] = useState<{ i: number; elenco: MediaRiga[] } | null>(null)

  // Il token arriva dal QR. Lo tolgo dall'URL perche' nessuno condivida per
  // sbaglio un link che apre le porte a chi non c'era, ma lo parcheggio nella
  // sessione: se l'ospite ricarica prima di aver scritto il nome, altrimenti
  // resterebbe chiuso fuori senza capire il perche'.
  const [token] = useState(() => {
    const daUrl = new URLSearchParams(location.search).get('k')
    if (daUrl) {
      try { sessionStorage.setItem('token', daUrl) } catch { /* navigazione privata */ }
      return daUrl
    }
    try { return sessionStorage.getItem('token') } catch { return null }
  })
  useEffect(() => {
    if (new URLSearchParams(location.search).get('k')) {
      history.replaceState(null, '', location.pathname)
    }
  }, [])

  useEffect(() => { api.io().then(setIo).catch(() => setIo({ dentro: false, sposi: 'Rita & Francesco' })) }, [])

  // Avviso se si chiude l'app con roba ancora in volo.
  useEffect(() => {
    const guardia = (e: BeforeUnloadEvent) => { if (coda.inCorso) e.preventDefault() }
    window.addEventListener('beforeunload', guardia)
    return () => window.removeEventListener('beforeunload', guardia)
  }, [])

  if (location.pathname === '/sposi') return <Sposi />

  if (!io) return <div className="min-h-dvh grid place-items-center text-fumo">…</div>

  if (!io.dentro) {
    return (
      <Benvenuto
        sposi={io.sposi}
        token={token}
        entrato={(nome) => {
          try { sessionStorage.removeItem('token') } catch { /* niente */ }
          setIo({ dentro: true, nome, sposi: io.sposi })
        }}
      />
    )
  }

  return (
    <>
      {vista === 'muro'
        ? <Muro apri={(i, elenco) => setVisore({ i, elenco })} />
        : <Messaggi />}

      {visore && (
        <Visore elenco={visore.elenco} indice={visore.i} chiudi={() => setVisore(null)} />
      )}

      {!visore && (
        <nav className="fixed top-0 inset-x-0 sicura-sopra flex justify-center gap-1 pointer-events-none">
          <div className="pointer-events-auto bg-carta/85 backdrop-blur border border-salvia-velo
                          rounded-full p-1 flex gap-1 mt-1">
            {(['muro', 'messaggi'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-4 py-1.5 rounded-full text-xs transition-colors ${
                  vista === v ? 'bg-salvia text-crema' : 'text-fumo'
                }`}
              >
                {v === 'muro' ? 'Ricordi' : 'Messaggi'}
              </button>
            ))}
          </div>
        </nav>
      )}
    </>
  )
}
