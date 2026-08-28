import { useEffect, useState } from 'react'
import { quando, type MediaRiga } from '../api'

export function Visore({ elenco, indice, chiudi }: {
  elenco: MediaRiga[]
  indice: number
  chiudi: () => void
}) {
  const [i, setI] = useState(indice)
  const m = elenco[i]

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

  // Swipe orizzontale: soglia bassa, ci si scorre col pollice a una mano.
  let partenza = 0
  const inizio = (e: React.TouchEvent) => { partenza = e.touches[0].clientX }
  const fine = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - partenza
    if (delta < -50) setI((x) => Math.min(x + 1, elenco.length - 1))
    if (delta > 50) setI((x) => Math.max(x - 1, 0))
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={inizio}
      onTouchEnd={fine}
    >
      <div className="sicura-sopra px-4 pb-3 flex items-center justify-between text-white/90">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{m.nome}</p>
          <p className="text-[11px] text-white/50">{quando(m.creato_il)}</p>
        </div>
        <button onClick={chiudi} className="w-10 h-10 grid place-items-center text-2xl leading-none">
          ×
        </button>
      </div>

      <div className="flex-1 grid place-items-center overflow-hidden">
        {m.tipo === 'video' ? (
          <video
            key={m.id}
            src={`/media/originale/${m.id}`}
            poster={`/media/anteprima/${m.id}`}
            controls
            autoPlay
            playsInline
            className="max-w-full max-h-full"
          />
        ) : (
          <img
            key={m.id}
            src={`/media/originale/${m.id}`}
            alt={`Caricata da ${m.nome}`}
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      <div className="sicura-sotto px-4 pt-3 flex items-center justify-between text-white/70 text-xs">
        <button
          onClick={() => setI((x) => Math.max(x - 1, 0))}
          disabled={i === 0}
          className="px-4 py-2 disabled:opacity-25"
        >
          ← Prima
        </button>
        <span>{i + 1} / {elenco.length}</span>
        <button
          onClick={() => setI((x) => Math.min(x + 1, elenco.length - 1))}
          disabled={i === elenco.length - 1}
          className="px-4 py-2 disabled:opacity-25"
        >
          Dopo →
        </button>
      </div>
    </div>
  )
}
