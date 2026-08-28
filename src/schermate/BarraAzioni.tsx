import { useEffect, useRef, useState } from 'react'
import { coda } from '../upload/coda'
import { useBloccoScorrimento, useTastieraAperta } from '../bloccoScorrimento'
import { IconaRicordi, IconaMessaggi, IconaFotocamera, IconaGalleria } from './Icone'

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

  useBloccoScorrimento(menu)
  // Con la tastiera aperta la barra finirebbe sepolta sotto: meglio toglierla.
  const tastiera = useTastieraAperta()

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
              <span className="w-12 h-12 rounded-full bg-salvia-velo grid place-items-center text-salvia">
                <IconaFotocamera className="w-6 h-6" />
              </span>
              <span className="text-left">
                <span className="block text-[17px]">Scatta adesso</span>
                <span className="block text-sm text-fumo">Apre la fotocamera</span>
              </span>
            </button>
            <button
              onClick={() => galleria.current?.click()}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl active:bg-salvia-velo/60 transition-colors"
            >
              <span className="w-12 h-12 rounded-full bg-salvia-velo grid place-items-center text-salvia">
                <IconaGalleria className="w-6 h-6" />
              </span>
              <span className="text-left">
                <span className="block text-[17px]">Scegli dal telefono</span>
                <span className="block text-sm text-fumo">Anche più foto insieme</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* capture apre direttamente la fotocamera; senza, si sceglie dal rullino. */}
      <input ref={scatta} type="file" accept="image/*,video/*" capture="environment" hidden onChange={ricevi} />
      <input ref={galleria} type="file" accept="image/*,video/*" multiple hidden onChange={ricevi} />

      <nav
        className={`fixed inset-x-0 bottom-0 z-30 bg-carta/95 backdrop-blur border-t
                    border-salvia-velo transition-transform duration-200
                    ${tastiera ? 'translate-y-full' : ''}`}
      >
        <div className="flex items-center justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <Scheda
            attiva={vista === 'muro'}
            onClick={() => cambia('muro')}
            etichetta="Ricordi"
            Icona={IconaRicordi}
          />

          <button
            onClick={() => setMenu(true)}
            aria-label="Aggiungi foto o video"
            className="w-[68px] h-[68px] -mt-7 rounded-full bg-salvia text-crema
                       grid place-items-center shadow-lg shadow-salvia/30
                       active:scale-95 transition-transform border-4 border-crema"
          >
            <IconaFotocamera className="w-8 h-8" />
          </button>

          <Scheda
            attiva={vista === 'messaggi'}
            onClick={() => cambia('messaggi')}
            etichetta="Messaggi"
            Icona={IconaMessaggi}
          />
        </div>
      </nav>
    </>
  )
}

function Scheda({ attiva, onClick, etichetta, Icona }: {
  attiva: boolean
  onClick: () => void
  etichetta: string
  Icona: (p: { className?: string }) => React.ReactElement
}) {
  return (
    <button
      onClick={onClick}
      // Ben oltre i 44px raccomandati: si prende col pollice senza guardare.
      className={`min-w-[76px] py-2 px-4 rounded-xl flex flex-col items-center gap-1 transition-colors
                  ${attiva ? 'text-salvia' : 'text-fumo/60'}`}
    >
      <Icona className="w-6 h-6" />
      <span className="text-[13px]">{etichetta}</span>
    </button>
  )
}
