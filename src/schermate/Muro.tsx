import { useEffect, useRef, useState } from 'react'
import { api, type MediaRiga } from '../api'
import { t, quando } from '../lingua'
import { coda, type Lavoro } from '../upload/coda'
import { AccessoSposi } from './AccessoSposi'

const INTERVALLO = 8000

export function Muro({ apri, nome, sposi, inPausa }: {
  apri: (indice: number, elenco: MediaRiga[]) => void
  nome?: string
  sposi: string
  inPausa: boolean
}) {
  const [elenco, setElenco] = useState<MediaRiga[]>([])
  const [lavori, setLavori] = useState<Lavoro[]>([])
  // Momento del piu' recente gia' in elenco: e' il segnalibro del polling.
  const ultimoVisto = useRef(0)

  useEffect(() => {
    const stacca = coda.ascolta(setLavori)
    return () => { stacca() }
  }, [])

  // Polling invece di WebSocket: nessuna connessione da tenere viva, nessuna
  // riconnessione da gestire quando il wifi della sala fa i capricci.
  useEffect(() => {
    if (inPausa) return
    let vivo = true

    // Il giro periodico chiede solo cio' che e' arrivato dopo l'ultimo che
    // abbiamo: a fine serata l'elenco intero sono decine di kB, e riscaricarlo
    // ogni otto secondi per ogni ospite non ha senso.
    async function ricarica(completo = false) {
      try {
        const daQuando = completo ? 0 : ultimoVisto.current
        const r = await api.media(daQuando)
        if (!vivo) return

        if (completo || daQuando === 0) {
          setElenco(r.media)
        } else if (r.media.length) {
          setElenco((prima) => {
            const visti = new Set(prima.map((m) => m.id))
            const nuovi = r.media.filter((m) => !visti.has(m.id))
            return nuovi.length ? [...nuovi, ...prima] : prima
          })
        }
        if (r.media.length) {
          ultimoVisto.current = Math.max(ultimoVisto.current, ...r.media.map((m) => m.creato_il))
        }
      } catch { /* la prossima passata ci riprova */ }
    }

    ricarica(true)
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') ricarica()
    }, INTERVALLO)
    // Tornando sull'app si riprende tutto: nel frattempo gli sposi potrebbero
    // aver nascosto qualcosa, e l'incrementale non se ne accorgerebbe.
    const alRitorno = () => document.visibilityState === 'visible' && ricarica(true)
    document.addEventListener('visibilitychange', alRitorno)

    return () => {
      vivo = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', alRitorno)
    }
  }, [inPausa, lavori.filter((l) => l.stato === 'fatto').length])

  const inCorso = lavori.filter((l) => l.stato !== 'fatto')

  return (
    <div className="min-h-dvh pb-24">
      <header className="sicura-sopra px-5 pb-4 text-center">
        {nome && (
          <p className="text-salvia text-sm mb-1">{t.ciao(nome.split(' ')[0])}</p>
        )}
        <h1 className="titolo text-[28px]">{sposi}</h1>
        <p className="text-fumo text-sm mt-1.5">
          {elenco.length > 0 ? t.ricordiFinora(elenco.length) : t.primoRicordo}
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
                <p className="text-[13px] text-fumo truncate">
                  {l.stato === 'errore'
                    ? t.nonEAndata
                    : l.stato === 'anteprima' ? t.preparo : t.stoCaricando}
                </p>
                <div className="h-1 bg-salvia-velo rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-salvia transition-[width] duration-300"
                    style={{ width: `${Math.round(l.progresso * 100)}%` }}
                  />
                </div>
              </div>
              {l.stato === 'errore' && (
                <button onClick={() => coda.riprova(l.id)} className="text-[13px] text-salvia px-3 py-2">
                  {t.riprova}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {elenco.length === 0 && inCorso.length === 0 ? (
        <div className="px-10 py-24 text-center text-fumo">
          <p className="titolo text-2xl mb-2.5">{t.ancoraNiente}</p>
          <p className="text-[15px] leading-relaxed">
            {t.scattaQualcosa}
          </p>
        </div>
      ) : (
        <div className="px-3 columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3 [&>*]:mb-3 max-w-6xl mx-auto">
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
                alt={m.nome}
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
                <span className="block text-white text-[13px] font-medium truncate">{m.nome}</span>
                <span className="block text-white/75 text-[11px]">{quando(m.creato_il)}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <AccessoSposi />
    </div>
  )
}
