import { useState } from 'react'
import { t } from '../lingua'
import { useBloccoScorrimento } from '../bloccoScorrimento'
import type { MediaRiga } from '../api'

/**
 * Chiede conferma prima di eliminare.
 *
 * Cancellare un ricordo e' definitivo: sparisce la riga, l'originale e
 * l'anteprima. Mostriamo la foto in questione, perche' su un muro fitto e'
 * facile aver toccato la tessera sbagliata.
 */
export function ConfermaElimina({ media, chiudi, conferma }: {
  media: MediaRiga
  chiudi: () => void
  conferma: () => Promise<void>
}) {
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState(false)

  useBloccoScorrimento(true)

  async function procedi() {
    setInCorso(true)
    setErrore(false)
    try {
      await conferma()
    } catch {
      setErrore(true)
      setInCorso(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-inchiostro/45 backdrop-blur-[2px] flex items-end sm:items-center sm:justify-center"
      onClick={() => !inCorso && chiudi()}
    >
      <div
        className="w-full sm:max-w-sm bg-carta rounded-t-3xl sm:rounded-3xl p-6 sicura-sotto comparsa"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-salvia-velo rounded-full mx-auto mb-6 sm:hidden" />

        <img
          src={`/media/griglia/${media.id}`}
          alt=""
          className="w-24 h-24 object-cover rounded-2xl mx-auto mb-5 bg-salvia-velo"
        />

        <p className="titolo text-2xl text-center mb-2">{t.sicuroEliminare}</p>
        <p className="text-fumo text-sm text-center leading-relaxed mb-1">
          {t.eliminaPerSempre}
        </p>
        <p className="text-fumo/70 text-[13px] text-center mb-6">
          {media.nome}
        </p>

        {errore && (
          <p className="text-[14px] text-red-700/80 text-center mb-3">{t.eliminaFallito}</p>
        )}

        <button
          onClick={procedi}
          disabled={inCorso}
          className="w-full bg-red-800/85 text-crema rounded-2xl py-4 text-[17px]
                     disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {inCorso ? t.eliminando : t.eliminaConferma}
        </button>
        <button
          onClick={chiudi}
          disabled={inCorso}
          className="w-full mt-2 text-fumo text-[15px] py-3.5 disabled:opacity-40"
        >
          {t.annulla}
        </button>
      </div>
    </div>
  )
}
