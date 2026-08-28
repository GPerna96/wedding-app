import { useEffect, useState } from 'react'
import { api, quando, type MediaRiga } from '../api'
import { coda, type Lavoro } from '../upload/coda'

const INTERVALLO = 8000

export function Muro({ apri }: { apri: (indice: number, elenco: MediaRiga[]) => void }) {
  const [elenco, setElenco] = useState<MediaRiga[]>([])
  const [lavori, setLavori] = useState<Lavoro[]>([])

  useEffect(() => {
    const stacca = coda.ascolta(setLavori)
    return () => { stacca() }
  }, [])

  // Polling invece di WebSocket: nessuna connessione da tenere viva, nessuna
  // riconnessione da gestire quando il wifi della sala fa i capricci.
  useEffect(() => {
    let vivo = true

    async function ricarica() {
      try {
        const r = await api.media()
        if (vivo) setElenco(r.media)
      } catch { /* la prossima passata ci riprova */ }
    }

    ricarica()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') ricarica()
    }, INTERVALLO)
    // Tornando sull'app si aggiorna subito, senza aspettare il giro.
    const alRitorno = () => document.visibilityState === 'visible' && ricarica()
    document.addEventListener('visibilitychange', alRitorno)

    return () => {
      vivo = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', alRitorno)
    }
  }, [lavori.filter((l) => l.stato === 'fatto').length])

  const inCorso = lavori.filter((l) => l.stato !== 'fatto')

  return (
    <div className="min-h-dvh pb-24">
      <header className="sicura-sopra px-5 pb-4 text-center">
        <h1 className="titolo text-2xl">Rita &amp; Francesco</h1>
        <p className="text-fumo text-xs mt-1">
          {elenco.length > 0 ? `${elenco.length} ricordi finora` : 'Il primo ricordo è tuo'}
        </p>
      </header>

      {inCorso.length > 0 && (
        <div className="px-4 mb-3 space-y-2">
          {inCorso.map((l) => (
            <div key={l.id} className="flex items-center gap-3 bg-carta border border-salvia-velo rounded-xl p-2">
              {l.anteprimaLocale && (
                <img src={l.anteprimaLocale} className="w-12 h-12 rounded-lg object-cover" alt="" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-fumo truncate">
                  {l.stato === 'errore'
                    ? 'Non è andata. Tocca per riprovare.'
                    : l.stato === 'anteprima' ? 'Preparo…' : 'Sto caricando…'}
                </p>
                <div className="h-1 bg-salvia-velo rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-salvia transition-[width] duration-300"
                    style={{ width: `${Math.round(l.progresso * 100)}%` }}
                  />
                </div>
              </div>
              {l.stato === 'errore' && (
                <button onClick={() => coda.riprova(l.id)} className="text-xs text-salvia px-2">
                  Riprova
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {elenco.length === 0 && inCorso.length === 0 ? (
        <div className="px-10 py-24 text-center text-fumo">
          <p className="titolo text-xl mb-2">Ancora niente</p>
          <p className="text-sm leading-relaxed">
            Scatta qualcosa e sarai il primo ad apparire su questo muro.
          </p>
        </div>
      ) : (
        <div className="px-3 columns-2 gap-3 [&>*]:mb-3">
          {elenco.map((m, i) => (
            <button
              key={m.id}
              onClick={() => apri(i, elenco)}
              className="block w-full break-inside-avoid relative rounded-2xl overflow-hidden
                         bg-salvia-velo active:scale-[0.98] transition-transform"
              style={{
                aspectRatio: m.larghezza && m.altezza ? `${m.larghezza}/${m.altezza}` : '1',
              }}
            >
              <img
                src={`/media/anteprima/${m.id}`}
                loading="lazy"
                alt={`Caricata da ${m.nome}`}
                className="w-full h-full object-cover"
              />
              {m.tipo === 'video' && (
                <span className="absolute top-2 right-2 bg-black/45 backdrop-blur-sm rounded-full
                                 w-7 h-7 grid place-items-center text-white text-[10px]">
                  ▶
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent
                               px-2.5 py-2 text-left">
                <span className="block text-white text-[11px] font-medium truncate">{m.nome}</span>
                <span className="block text-white/70 text-[10px]">{quando(m.creato_il)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

    </div>
  )
}
