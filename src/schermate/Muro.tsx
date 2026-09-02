import { useEffect, useRef, useState } from 'react'
import { api, type MediaRiga } from '../api'
import { t, quando } from '../lingua'
import { coda, type Lavoro } from '../upload/coda'
import { AccessoSposi } from './AccessoSposi'
import { Tirare } from './Tirare'
import { VoceInstalla } from '../Installa'
import { ConfermaElimina } from './ConfermaElimina'

const INTERVALLO = 8000

export function Muro({ apri, nome, sposi, inPausa, admin }: {
  apri: (indice: number, elenco: MediaRiga[]) => void
  nome?: string
  sposi: string
  inPausa: boolean
  admin: boolean
}) {
  const [elenco, setElenco] = useState<MediaRiga[]>([])
  const [lavori, setLavori] = useState<Lavoro[]>([])
  const [quanti, setQuanti] = useState(0)
  const [daFinire, setDaFinire] = useState(0)
  const [inRete, setInRete] = useState(() => navigator.onLine)
  // Un'anteprima puo' non arrivare comunque: rete ballerina, cache storta.
  // Meglio un riquadro pulito che l'icona di immagine rotta con il testo
  // alternativo sparato in grande.
  const [rotte, setRotte] = useState<Set<string>>(new Set())
  const quanteColonne = useColonne()
  const [daEliminare, setDaEliminare] = useState<MediaRiga | null>(null)
  // Momento del piu' recente gia' in elenco: e' il segnalibro del polling.
  const ultimoVisto = useRef(0)

  useEffect(() => {
    const stacca = coda.ascolta(setLavori)
    return () => { stacca() }
  }, [])

  // La rete che va e viene e' la norma in una sala: meglio dirlo che lasciare
  // le barre ferme senza spiegazioni.
  useEffect(() => {
    const su = () => setInRete(true)
    const giu = () => setInRete(false)
    window.addEventListener('online', su)
    window.addEventListener('offline', giu)
    return () => {
      window.removeEventListener('online', su)
      window.removeEventListener('offline', giu)
    }
  }, [])

  // Polling invece di WebSocket: nessuna connessione da tenere viva, nessuna
  // riconnessione da gestire quando il wifi della sala fa i capricci.
  // Serve anche al gesto di trascinamento, non solo al giro periodico.
  const ricaricaTutto = useRef<() => Promise<void>>(async () => {})

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
        setQuanti(r.ospiti)
        setDaFinire(r.daFinire ?? 0)
        if (r.media.length) {
          ultimoVisto.current = Math.max(ultimoVisto.current, ...r.media.map((m) => m.creato_il))
        }
      } catch { /* la prossima passata ci riprova */ }
    }

    ricaricaTutto.current = () => ricarica(true)
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
  const miei = elenco.filter((m) => m.stato !== 'completo' && m.nome === nome)

  // Le colonne CSS riempiono la prima fino in fondo prima di passare alla
  // seconda: con due sole foto restavano entrambe a sinistra e mezzo schermo
  // vuoto. Qui ogni foto va nella colonna piu' corta, stimandone l'altezza
  // dalle proporzioni, cosi' il muro resta equilibrato da subito.
  const colonne = distribuisci(elenco, quanteColonne)

  async function elimina(m: MediaRiga) {
    await api.elimina('media', m.id)
    // Sparisce subito dal muro: il giro periodico non lo riporterebbe comunque
    // indietro, ma lasciarlo li' fino al prossimo controllo sarebbe strano.
    setElenco((e) => e.filter((x) => x.id !== m.id))
    setDaEliminare(null)
  }

  return (
    <Tirare aggiorna={() => ricaricaTutto.current()}>
    <div className="min-h-full flex flex-col pb-4">
      {admin && (
        <div className="bg-salvia text-crema px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-[13px]">{t.modoSposi}</span>
          <a
            href="/api/sposi/archivio"
            className="bg-crema/15 border border-crema/25 rounded-full px-3.5 py-1.5 text-[13px] whitespace-nowrap"
          >
            {t.scaricaTutto}
          </a>
        </div>
      )}

      <header className="sicura-sopra px-5 pb-4 text-center">
        {nome && (
          <p className="text-salvia text-sm mb-1">{t.ciao(nome.split(' ')[0])}</p>
        )}
        <h1 className="nomi text-salvia text-[34px] leading-tight">{sposi}</h1>
        <p className="text-fumo text-sm mt-1.5">
          {elenco.length > 0 ? t.ricordiFinora(elenco.length) : t.primoRicordo}
          {quanti > 0 && <span className="text-fumo/60"> · {t.siamoIn(quanti)}</span>}
        </p>
      </header>

      {!inRete && (
        <div className="mx-4 mb-3 bg-amber-100/70 border border-amber-300/60 rounded-xl px-4 py-3">
          <p className="text-[13px] text-amber-900/80 leading-relaxed">{t.senzaRete}</p>
        </div>
      )}

      {/*
        I ricordi di chi guarda che sono rimasti senza originale. Ricaricando
        la stessa foto l'app la riconosce e completa quella scheda, senza
        creare un doppione nel muro.
      */}
      {daFinire > 0 && inCorso.length === 0 && (
        <div className="mx-4 mb-3 bg-salvia-velo/70 border border-salvia-chiara/40 rounded-xl px-4 py-3">
          <p className="text-[13px] text-salvia leading-relaxed">{t.daCompletare(daFinire)}</p>
          <p className="text-[12px] text-fumo leading-relaxed mt-1">{t.spiegaDaCompletare}</p>

          {/* Le miniature ci sono: mostrargliele e' l'unico modo perche' sappia
              quali cercare fra le centinaia di scatti del rullino. */}
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto">
            {miei.slice(0, 12).map((m) => (
              <img
                key={m.id}
                src={`/media/griglia/${m.id}`}
                alt=""
                loading="lazy"
                className="w-12 h-12 rounded-lg object-cover shrink-0 opacity-80"
              />
            ))}
          </div>

          <label className="mt-3 inline-block bg-salvia text-crema rounded-xl px-4 py-2 text-[13px] active:scale-[0.98] transition-transform">
            {t.ricaricaQueste}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length) coda.aggiungi(files)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}

      {inCorso.length > 0 && (
        <div className="px-4 mb-3 space-y-2">
          <p className="text-[12px] text-fumo/80 text-center">{t.nonChiudere}</p>
          {inCorso.map((l) => (
            <div key={l.id} className="flex items-center gap-3 bg-carta border border-salvia-velo rounded-xl p-2">
              {l.anteprimaLocale && (
                <img src={l.anteprimaLocale} className="w-12 h-12 rounded-lg object-cover" alt="" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-fumo truncate">
                  {l.stato === 'errore'
                    ? (l.motivo === 'rete' ? t.erroreRete
                      : l.motivo === 'troppoGrande' ? t.erroreTroppoGrande
                      : l.motivo === 'server' ? t.erroreServer
                      : t.erroreIgnoto)
                    : l.stato === 'giaPresente' ? t.giaPresente
                    : l.stato === 'anteprima' ? t.preparo : t.stoCaricando}
                </p>
                {l.stato !== 'giaPresente' && (
                <div className="h-1 bg-salvia-velo rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-salvia transition-[width] duration-300"
                    style={{ width: `${Math.round(l.progresso * 100)}%` }}
                  />
                </div>
                )}
              </div>
              {l.stato === 'errore' && l.motivo !== 'troppoGrande' && (
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
        <div className="px-3 flex gap-3 items-start max-w-6xl mx-auto">
          {colonne.map((colonna, ci) => (
            <div key={ci} className="flex-1 min-w-0 flex flex-col gap-3">
          {colonna.map(({ m, i }) => (
            <button
              key={m.id}
              onClick={() => apri(i, elenco)}
              className={`block w-full relative rounded-2xl overflow-hidden
                         bg-salvia-velo active:scale-[0.98] transition-transform
                         `}
              style={{
                aspectRatio: m.larghezza && m.altezza ? `${m.larghezza}/${m.altezza}` : '1',
              }}
            >
              {rotte.has(m.id) ? (
                /* Una foglia sul fondo salvia: se un'anteprima non arriva, la
                   tessera resta parte del muro invece di sembrare guasta. */
                <span className="absolute inset-0 grid place-items-center bg-salvia-velo text-salvia/35">
                  <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor"
                       strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 21c0-6 0-9 0-12" />
                    <path d="M12 9c0-3.4 2.4-6 6-6.5.4 3.6-1.6 6.9-6 7.5z" />
                    <path d="M12 13.5C12 10 9.6 7.4 5.6 7c-.4 3.4 1.6 6.4 6.4 6.5z" />
                  </svg>
                </span>
              ) : (
                <img
                  src={`/media/griglia/${m.id}`}
                  // Le prime tessere sono quelle che si vedono aprendo l'app:
                  // vanno chieste subito, non quando entrano nello schermo.
                  loading={i < 6 ? 'eager' : 'lazy'}
                  fetchPriority={i < 4 ? 'high' : 'auto'}
                  decoding="async"
                  // Vuoto di proposito: la didascalia sotto dice gia' chi l'ha
                  // caricata, e un testo alternativo qui finirebbe stampato
                  // sulla tessera se l'immagine non arriva.
                  alt=""
                  onError={() => setRotte((r) => new Set(r).add(m.id))}
                  className="w-full h-full object-cover"
                />
              )}
              {m.tipo === 'video' && (
                <span className="absolute top-2 right-2 bg-black/45 backdrop-blur-sm rounded-full
                                 w-7 h-7 grid place-items-center text-white text-[10px]">
                  ▶
                </span>
              )}
              {admin && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setDaEliminare(m) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDaEliminare(m) } }}
                  className="absolute top-2 left-2 bg-black/55 backdrop-blur-sm rounded-full
                             px-2.5 py-1 text-white text-[11px]"
                >
                  {t.elimina}
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
          ))}
        </div>
      )}

      {/* mt-auto: con poche foto l'accesso resta in fondo allo schermo invece
          di galleggiare a meta' pagina con il vuoto sotto. */}
      <div className="mt-auto">
        <VoceInstalla />
        <AccessoSposi />
      </div>

      {daEliminare && (
        <ConfermaElimina
          media={daEliminare}
          chiudi={() => setDaEliminare(null)}
          conferma={() => elimina(daEliminare)}
        />
      )}
    </div>
    </Tirare>
  )
}

/** Colonne in base allo spazio: due sul telefono, di piu' quando ce n'e'. */
function useColonne() {
  const [n, setN] = useState(() => calcolaColonne())
  useEffect(() => {
    const guarda = () => setN(calcolaColonne())
    window.addEventListener('resize', guarda)
    return () => window.removeEventListener('resize', guarda)
  }, [])
  return n
}

function calcolaColonne() {
  const w = window.innerWidth
  if (w >= 1280) return 5
  if (w >= 1024) return 4
  if (w >= 640) return 3
  return 2
}

/**
 * Ogni foto nella colonna piu' bassa, stimando l'ingombro dalle proporzioni.
 * L'ordine resta quello del muro: la piu' recente in alto a sinistra.
 */
function distribuisci(elenco: MediaRiga[], quante: number) {
  const colonne: { m: MediaRiga; i: number }[][] = Array.from({ length: quante }, () => [])
  const altezze = new Array(quante).fill(0)

  elenco.forEach((m, i) => {
    const proporzione = m.larghezza && m.altezza ? m.altezza / m.larghezza : 1
    let piuBassa = 0
    for (let c = 1; c < quante; c++) if (altezze[c] < altezze[piuBassa]) piuBassa = c
    colonne[piuBassa].push({ m, i })
    altezze[piuBassa] += proporzione + 0.06   // il margine fra una e l'altra
  })

  return colonne
}
