import { useEffect, useState } from 'react'
import { api, type MediaRiga } from './api'
import { Benvenuto } from './schermate/Benvenuto'
import { Muro } from './schermate/Muro'
import { Visore } from './schermate/Visore'
import { Messaggi } from './schermate/Messaggi'
import { BarraAzioni } from './schermate/BarraAzioni'
import { Installa } from './Installa'
import { coda } from './upload/coda'

type Vista = 'muro' | 'messaggi'

export function App() {
  const [io, setIo] = useState<{ dentro: boolean; nome?: string; sposi: string; admin: boolean } | null>(null)
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

  useEffect(() => {
    (async () => {
      // L'app installata su iOS parte con un biglietto nel frammento, perche'
      // li' i cookie di Safari non arrivano. Il frammento resta nel browser:
      // non viene inviato al server insieme all'indirizzo.
      const biglietto = new URLSearchParams(location.hash.slice(1)).get('s')
      if (biglietto) {
        history.replaceState(null, '', location.pathname)
        try {
          await fetch('/api/riprendi', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessione: biglietto }),
          })
        } catch { /* si ripiega sul controllo normale */ }
      }
      try {
        setIo(await api.io())
      } catch {
        setIo({ dentro: false, sposi: 'Rita & Francesco', admin: false })
      }
    })()
  }, [])

  // Avviso se si chiude l'app con roba ancora in volo.
  useEffect(() => {
    const guardia = (e: BeforeUnloadEvent) => { if (coda.inCorso) e.preventDefault() }
    window.addEventListener('beforeunload', guardia)
    return () => window.removeEventListener('beforeunload', guardia)
  }, [])

  if (!io) return <div className="min-h-dvh grid place-items-center text-fumo">…</div>

  if (!io.dentro) {
    return (
      <Benvenuto
        sposi={io.sposi}
        token={token}
        admin={io.admin}
        entrato={(nome) => {
          try { sessionStorage.removeItem('token') } catch { /* niente */ }
          setIo({ ...io, dentro: true, nome })
        }}
      />
    )
  }

  return (
    <>
      {vista === 'muro'
        ? (
          <Muro
            apri={(i, elenco) => setVisore({ i, elenco })}
            nome={io.nome}
            sposi={io.sposi}
            // Col visore aperto il muro non ha nessuno che lo guardi: inutile
            // continuare a interrogare il server.
            inPausa={!!visore}
            admin={io.admin}
          />
        )
        : <Messaggi nome={io.nome} />}

      {visore && (
        <Visore elenco={visore.elenco} indice={visore.i} chiudi={() => setVisore(null)} />
      )}

      {!visore && <BarraAzioni vista={vista} cambia={setVista} />}
      <Installa attivo={!visore} />

    </>
  )
}
