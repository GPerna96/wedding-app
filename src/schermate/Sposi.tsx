import { useEffect, useState } from 'react'
import { quando } from '../lingua'

type Voce = {
  id: string; tipo?: string; stato?: string; nascosto: number
  byte?: number; nome_file?: string; testo?: string; creato_il: number; nome: string
}

export function Sposi() {
  const [dati, setDati] = useState<{
    media: Voce[]; messaggi: Voce[]
    conteggi: { ospiti: number; completi: number; byte: number }
  } | null>(null)
  const [errore, setErrore] = useState(false)

  async function ricarica() {
    const r = await fetch('/api/sposi/tutto')
    if (!r.ok) return setErrore(true)
    setDati(await r.json())
  }

  useEffect(() => {
    (async () => {
      // La chiave arriva dall'URL una volta sola: la si scambia subito con un
      // cookie e la si cancella dalla barra degli indirizzi, cosi' non resta
      // nella cronologia ne' finisce in un log.
      const chiave = new URLSearchParams(location.search).get('k')
      if (chiave) {
        await fetch('/api/sposi/entra', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chiave }),
        })
        history.replaceState(null, '', location.pathname)
      }
      ricarica()
    })()
  }, [])

  async function nascondi(tipo: 'media' | 'messaggi', id: string, nascosto: boolean) {
    await fetch('/api/sposi/nascondi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo, id, nascosto }),
    })
    ricarica()
  }

  if (errore) return <p className="p-10 text-center text-fumo">Chiave non valida.</p>
  if (!dati) return <p className="p-10 text-center text-fumo">Carico…</p>

  const giga = (dati.conteggi.byte / 1024 ** 3).toFixed(2)

  return (
    <div className="min-h-dvh px-4 py-8 max-w-3xl mx-auto">
      <h1 className="titolo text-3xl mb-1">Pannello sposi</h1>
      <p className="text-fumo text-sm mb-6">
        {dati.conteggi.ospiti} ospiti · {dati.conteggi.completi} media completi · {giga} GB
      </p>

      <a
        href="/api/sposi/elenco"
        className="inline-block bg-salvia text-crema rounded-xl px-5 py-3 text-sm mb-8"
      >
        Scarica l'elenco degli originali
      </a>

      <h2 className="titolo text-xl mb-3">Media</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-10">
        {dati.media.map((m) => (
          <div key={m.id} className="relative">
            <img
              src={`/media/anteprima/${m.id}`}
              alt=""
              className={`w-full aspect-square object-cover rounded-lg bg-salvia-velo
                          ${m.nascosto ? 'opacity-30' : ''}`}
            />
            {m.stato !== 'completo' && (
              <span className="absolute top-1 left-1 bg-amber-500/90 text-white text-[9px]
                               px-1.5 py-0.5 rounded">
                incompleto
              </span>
            )}
            <button
              onClick={() => nascondi('media', m.id, !m.nascosto)}
              className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px]
                         px-2 py-1 rounded"
            >
              {m.nascosto ? 'Mostra' : 'Nascondi'}
            </button>
            <p className="text-[10px] text-fumo mt-1 truncate">{m.nome}</p>
          </div>
        ))}
      </div>

      <h2 className="titolo text-xl mb-3">Messaggi</h2>
      <div className="space-y-2">
        {dati.messaggi.map((m) => (
          <div
            key={m.id}
            className={`bg-carta border border-salvia-velo rounded-xl p-4 ${m.nascosto ? 'opacity-40' : ''}`}
          >
            <p className="text-sm whitespace-pre-wrap">{m.testo}</p>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[11px] text-fumo">{m.nome} · {quando(m.creato_il)}</p>
              <button
                onClick={() => nascondi('messaggi', m.id, !m.nascosto)}
                className="text-[11px] text-salvia"
              >
                {m.nascosto ? 'Mostra' : 'Nascondi'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
