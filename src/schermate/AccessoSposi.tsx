import { useState } from 'react'
import { t } from '../lingua'
import { useBloccoScorrimento } from '../bloccoScorrimento'

/**
 * Porticina per Rita e Francesco. Sta in fondo e in tono minore: gli invitati
 * la vedono e tirano dritto, loro sanno cosa cercare.
 *
 * Il codice non protegge nulla di irreversibile -- da dentro si nasconde un
 * contenuto, non si cancella -- ed e' lungo abbastanza da rendere inutile
 * provare a indovinarlo. Il confronto lato server e' a tempo costante.
 */
export function AccessoSposi() {
  const [aperto, setAperto] = useState(false)
  const [codice, setCodice] = useState('')
  const [errore, setErrore] = useState(false)
  const [invio, setInvio] = useState(false)

  useBloccoScorrimento(aperto)

  async function invia(e: React.FormEvent) {
    e.preventDefault()
    if (!codice.trim()) return
    setInvio(true)
    setErrore(false)
    try {
      const r = await fetch('/api/sposi/entra', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chiave: codice.trim() }),
      })
      if (!r.ok) {
        setErrore(true)
        setInvio(false)
        return
      }
      // Il cookie e' stato impostato: si ricarica l'app, che da qui in avanti
      // mostra gli stessi contenuti di tutti piu' i comandi degli sposi.
      location.href = '/'
    } catch {
      setErrore(true)
      setInvio(false)
    }
  }

  return (
    <>
      <div className="text-center py-7">
        <button
          onClick={() => setAperto(true)}
          className="text-fumo/50 text-[13px] underline underline-offset-4 decoration-fumo/25 px-4 py-2"
        >
          {t.accessoSposi}
        </button>
      </div>

      {aperto && (
        <div
          className="fixed inset-0 z-50 bg-inchiostro/40 backdrop-blur-[2px] flex items-end sm:items-center sm:justify-center"
          onClick={() => setAperto(false)}
        >
          <form
            onSubmit={invia}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-carta rounded-t-3xl sm:rounded-3xl p-6 sicura-sotto comparsa"
          >
            <div className="w-10 h-1 bg-salvia-velo rounded-full mx-auto mb-6 sm:hidden" />

            <p className="titolo text-2xl text-center mb-2">{t.accessoSposi}</p>
            <p className="text-fumo text-sm text-center leading-relaxed mb-6">
              {t.soloSposi}
            </p>

            <input
              type="password"
              value={codice}
              onChange={(e) => setCodice(e.target.value)}
              placeholder={t.codice}
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-crema border border-salvia-velo rounded-2xl px-5 py-4
                         text-center text-[17px] tracking-wide outline-none
                         focus:border-salvia-chiara transition-colors
                         placeholder:tracking-normal placeholder:text-fumo/50"
            />

            {errore && (
              <p className="text-[14px] text-red-700/80 text-center mt-3">{t.codiceErrato}</p>
            )}

            <button
              type="submit"
              disabled={invio || !codice.trim()}
              className="w-full mt-4 bg-salvia text-crema rounded-2xl py-4 text-[17px]
                         disabled:opacity-40 active:scale-[0.98] transition-transform"
            >
              {invio ? t.unAttimo : t.entra}
            </button>

            <button
              type="button"
              onClick={() => setAperto(false)}
              className="w-full mt-2 text-fumo text-sm py-3"
            >
              {t.annulla}
            </button>
          </form>
        </div>
      )}
    </>
  )
}
