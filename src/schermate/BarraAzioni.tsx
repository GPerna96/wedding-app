import { useEffect, useRef, useState } from 'react'
import { coda } from '../upload/coda'

type Vista = 'muro' | 'messaggi'

/**
 * Unica barra dell'app, in basso: e' dove arriva il pollice con una mano sola.
 * Prima la navigazione stava in alto e finiva sotto il notch, sovrapponendosi
 * al titolo.
 */
export function BarraAzioni({ vista, cambia }: { vista: Vista; cambia: (v: Vista) => void }) {
  const [menu, setMenu] = useState(false)
  const scatta = useRef<HTMLInputElement>(null)
  const galleria = useRef<HTMLInputElement>(null)

  // Il menu si chiude col tasto indietro invece di lasciare l'utente bloccato.
  useEffect(() => {
    if (!menu) return
    const chiudi = () => setMenu(false)
    window.addEventListener('popstate', chiudi)
    history.pushState({ menu: true }, '')
    return () => {
      window.removeEventListener('popstate', chiudi)
      if (history.state?.menu) history.back()
    }
  }, [menu])

  function ricevi(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) coda.aggiungi(files)
    e.target.value = ''
    setMenu(false)
  }

  return (
    <>
      {menu && (
        <div
          className="fixed inset-0 z-40 bg-inchiostro/30 backdrop-blur-[2px] flex items-end"
          onClick={() => setMenu(false)}
        >
          <div
            className="w-full bg-carta rounded-t-3xl p-4 sicura-sotto comparsa"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-salvia-velo rounded-full mx-auto mb-5" />
            <button
              onClick={() => scatta.current?.click()}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-salvia-velo/60 transition-colors"
            >
              <span className="w-11 h-11 rounded-full bg-salvia-velo grid place-items-center text-lg">📷</span>
              <span className="text-left">
                <span className="block">Scatta adesso</span>
                <span className="block text-xs text-fumo">Apre la fotocamera</span>
              </span>
            </button>
            <button
              onClick={() => galleria.current?.click()}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-salvia-velo/60 transition-colors"
            >
              <span className="w-11 h-11 rounded-full bg-salvia-velo grid place-items-center text-lg">🖼️</span>
              <span className="text-left">
                <span className="block">Scegli dal telefono</span>
                <span className="block text-xs text-fumo">Anche più foto insieme</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* capture apre direttamente la fotocamera; senza, si sceglie dal rullino. */}
      <input ref={scatta} type="file" accept="image/*,video/*" capture="environment" hidden onChange={ricevi} />
      <input ref={galleria} type="file" accept="image/*,video/*" multiple hidden onChange={ricevi} />

      <nav className="fixed inset-x-0 bottom-0 z-30 bg-carta/95 backdrop-blur border-t border-salvia-velo">
        <div className="flex items-center justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Scheda attiva={vista === 'muro'} onClick={() => cambia('muro')} etichetta="Ricordi" icona="▦" />

          <button
            onClick={() => setMenu(true)}
            aria-label="Aggiungi foto o video"
            className="w-14 h-14 -mt-6 rounded-full bg-salvia text-crema text-2xl leading-none
                       shadow-lg shadow-salvia/30 active:scale-95 transition-transform
                       border-4 border-crema"
          >
            +
          </button>

          <Scheda attiva={vista === 'messaggi'} onClick={() => cambia('messaggi')} etichetta="Messaggi" icona="✎" />
        </div>
      </nav>
    </>
  )
}

function Scheda({ attiva, onClick, etichetta, icona }: {
  attiva: boolean; onClick: () => void; etichetta: string; icona: string
}) {
  return (
    <button
      onClick={onClick}
      // 64px di lato: sopra la soglia dei 44px che rende un bersaglio comodo al dito.
      className={`min-w-16 py-2 px-4 rounded-xl flex flex-col items-center gap-0.5 transition-colors
                  ${attiva ? 'text-salvia' : 'text-fumo/60'}`}
    >
      <span className="text-lg leading-none">{icona}</span>
      <span className="text-[11px]">{etichetta}</span>
    </button>
  )
}
