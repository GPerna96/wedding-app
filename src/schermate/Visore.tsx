import { useEffect, useState } from 'react'
import { type MediaRiga } from '../api'
import { t, quando } from '../lingua'
import { useBloccoScorrimento } from '../bloccoScorrimento'

export function Visore({ elenco, indice, chiudi }: {
  elenco: MediaRiga[]
  indice: number
  chiudi: () => void
}) {
  const [i, setI] = useState(indice)
  const m = elenco[i]

  useBloccoScorrimento(true)

  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === 'Escape') chiudi()
      if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, elenco.length - 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(x - 1, 0))
    }
    window.addEventListener('keydown', tasto)
    return () => window.removeEventListener('keydown', tasto)
  }, [elenco.length, chiudi])

  if (!m) return null

  // Di alcuni ricordi e' arrivata solo l'anteprima: l'originale non c'e'.
  // Puntarci sopra darebbe un riquadro rotto -- e il tasto di download
  // salverebbe la pagina d'errore invece della foto.
  const intero = m.stato === 'completo'
  const grande = `/media/anteprima/${m.id}`

  // Swipe orizzontale: soglia bassa, ci si scorre col pollice a una mano.
  let partenza = 0
  const inizio = (e: React.TouchEvent) => { partenza = e.touches[0].clientX }
  const fine = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - partenza
    if (delta < -50) setI((x) => Math.min(x + 1, elenco.length - 1))
    if (delta > 50) setI((x) => Math.max(x - 1, 0))
  }

  /*
   * L'immagine non sta piu' dentro una colonna flessibile.
   *
   * Su iPhone l'altezza utile cambia mentre le barre del browser entrano ed
   * escono, e una foto verticale finiva tagliata sopra e sotto. Qui e' uno
   * strato che copre lo schermo e si contiene da solo -- comandi e didascalie
   * le stanno sopra, senza toglierle spazio.
   */
  const dentro = 'absolute inset-0 w-full h-full object-contain px-2 pt-20 pb-24'

  return (
    <div
      className="fixed inset-0 z-50 bg-black"
      onTouchStart={inizio}
      onTouchEnd={fine}
    >
      {!intero && m.tipo === 'foto' ? (
        <img key={m.id} src={grande} alt={m.nome} decoding="async" className={dentro} />
      ) : m.tipo === 'video' ? (
        <video
          key={m.id}
          src={`/media/originale/${m.id}`}
          poster={grande}
          controls
          autoPlay
          playsInline
          className={dentro}
        />
      ) : (
        /* L'anteprima grande arriva in un attimo e riempie lo schermo mentre
           l'originale -- che puo' pesare qualche mega -- e' ancora in volo.
           Il browser sostituisce da solo quando il secondo e' pronto. */
        <img
          key={m.id}
          src={`/media/originale/${m.id}`}
          srcSet={`${grande} 1600w, /media/originale/${m.id} 4000w`}
          sizes="100vw"
          alt={m.nome}
          decoding="async"
          className={dentro}
        />
      )}

      <div className="absolute inset-x-0 top-0 sicura-sopra px-4 pb-6 flex items-start justify-between
                      text-white/90 bg-gradient-to-b from-black/70 to-transparent">
        <div className="min-w-0">
          <p className="text-[15px] font-medium truncate">{m.nome}</p>
          <p className="text-[12px] text-white/50">{quando(m.creato_il)}</p>
        </div>
        <div className="flex items-center gap-1">
          {/* download: il browser salva invece di aprire, grazie all'intestazione
              che il server aggiunge quando vede il parametro. */}
          {intero ? (
            <a
              href={`/media/originale/${m.id}?scarica`}
              download
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/12 text-[13px]"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"
                   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4v11M8 11.5l4 4 4-4M5 19.5h14" />
              </svg>
              {t.scaricaFoto}
            </a>
          ) : (
            <span className="px-3 py-2 rounded-full bg-white/10 text-white/60 text-[13px]">
              {t.originaleMancante}
            </span>
          )}
          <button onClick={chiudi} aria-label={t.chiudi} className="w-10 h-10 grid place-items-center text-2xl leading-none">
            ×
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 sicura-sotto px-4 pt-6 bg-gradient-to-t from-black/70 to-transparent">
        {!intero && (
          <p className="pb-2 text-white/60 text-[12px] leading-relaxed text-center">
            {t.spiegaOriginaleMancante}
          </p>
        )}

        <div className="flex items-center justify-between text-white/70 text-[14px]">
          <button
            onClick={() => setI((x) => Math.max(x - 1, 0))}
            disabled={i === 0}
            className="px-4 py-2 disabled:opacity-25"
          >
            {t.prima}
          </button>
          <span>{i + 1} / {elenco.length}</span>
          <button
            onClick={() => setI((x) => Math.min(x + 1, elenco.length - 1))}
            disabled={i === elenco.length - 1}
            className="px-4 py-2 disabled:opacity-25"
          >
            {t.dopo}
          </button>
        </div>
      </div>
    </div>
  )
}
