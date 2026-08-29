import { useEffect, useState } from 'react'
import { IconaInstalla } from './schermate/Icone'
import { t } from './lingua'
import { useBloccoScorrimento } from './bloccoScorrimento'
import { riconosciBrowser, nomeBrowser, type Browser } from './browser'

type EventoInstallazione = Event & { prompt: () => Promise<void> }

const RIMANDATO = 'installa-no'

function giaInstallata() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

/** Su un telefono l'aggiunta si può sempre fare a mano, anche senza evento. */
function suTelefono() {
  const b = riconosciBrowser()
  return b !== 'altro'
}

/** Le due mosse da fare, dette con i nomi che quel browser usa davvero. */
function istruzioniPer(b: Browser): { gesto: string; voce: string } {
  switch (b) {
    case 'safari-ios': return { gesto: t.gestoSafari, voce: t.voceHome }
    case 'chrome-ios': return { gesto: t.gestoChromeIos, voce: t.voceHome }
    case 'edge-ios': return { gesto: t.gestoChromeIos, voce: t.voceHome }
    case 'firefox-ios': return { gesto: t.gestoFirefoxIos, voce: t.voceHome }
    case 'samsung': return { gesto: t.gestoSamsung, voce: t.voceSamsung }
    case 'chrome-android':
    case 'edge-android':
    case 'firefox-android': return { gesto: t.gestoMenuAndroid, voce: t.voceInstalla }
    // Browser che non conosciamo: meglio un'indicazione vaga che un nome
    // sbagliato, che manderebbe a cercare un pulsante inesistente.
    default: return { gesto: t.gestoGenerico, voce: t.voceGenerica }
  }
}

/**
 * Aggiungere l'app alla schermata iniziale.
 *
 * Il solo banner non bastava: compare una volta, e chi lo chiude o lo perde
 * mentre scorre non lo rivede più. Perciò l'invito vive in due posti — un
 * avviso che si può rimandare, e una voce sempre presente in fondo al muro.
 *
 * Su Android il browser offre un evento apposito e basta un tocco. Su iOS non
 * esiste nulla di simile: l'unica strada è spiegare il gesto, quindi lì
 * mostriamo le istruzioni invece di un pulsante che non potrebbe funzionare.
 */
export function usaInstallazione() {
  const [evento, setEvento] = useState<EventoInstallazione | null>(null)
  const [installabile, setInstallabile] = useState(false)

  useEffect(() => {
    if (giaInstallata()) return

    const cattura = (e: Event) => {
      e.preventDefault()
      setEvento(e as EventoInstallazione)
      setInstallabile(true)
    }
    window.addEventListener('beforeinstallprompt', cattura)

    // Su iOS l'evento non arriva mai; su certi Android tarda o non arriva
    // affatto. In entrambi i casi l'aggiunta a mano resta possibile, quindi
    // la voce va offerta lo stesso.
    if (suTelefono()) setInstallabile(true)

    return () => window.removeEventListener('beforeinstallprompt', cattura)
  }, [])

  return { evento, installabile }
}

/** L'avviso che si può rimandare. */
export function Installa({ attivo }: { attivo: boolean }) {
  const { evento, installabile } = usaInstallazione()
  const [rimandato, setRimandato] = useState(() => {
    try { return !!localStorage.getItem(RIMANDATO) } catch { return false }
  })

  function chiudi() {
    try { localStorage.setItem(RIMANDATO, '1') } catch { /* navigazione privata */ }
    setRimandato(true)
  }

  if (!attivo || !installabile || rimandato) return null

  return (
    <div className="fixed inset-x-3 bottom-[calc(var(--barra,5rem)+var(--sotto,0px)+0.75rem)] z-20 bg-carta border border-salvia-velo
                    rounded-2xl shadow-lg px-4 py-3.5 flex items-start gap-3 comparsa">
      <span className="text-salvia mt-0.5"><IconaInstalla className="w-6 h-6" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium">{t.tienilaAMano}</p>
        <p className="text-[13px] text-fumo leading-relaxed mt-0.5">
          {evento ? t.installaAndroid : t.installaIos}
        </p>
        {evento && (
          <button
            onClick={() => { evento.prompt(); chiudi() }}
            className="mt-2.5 bg-salvia text-crema rounded-xl px-4 py-2 text-sm"
          >
            {t.aggiungi}
          </button>
        )}
      </div>
      <button onClick={chiudi} aria-label={t.chiudi} className="text-fumo/50 text-lg leading-none px-1">
        ×
      </button>
    </div>
  )
}

/**
 * La voce in fondo al muro: c'è sempre, anche per chi ha chiuso l'avviso.
 * Su iOS apre le istruzioni illustrate, perché il gesto va mostrato.
 */
export function VoceInstalla() {
  const { evento, installabile } = usaInstallazione()
  const [istruzioni, setIstruzioni] = useState(false)
  const browser = riconosciBrowser()
  const passi = istruzioniPer(browser)
  const nome = nomeBrowser(browser)

  useBloccoScorrimento(istruzioni)

  if (!installabile) return null

  return (
    <>
      <div className="text-center pt-2">
        <button
          onClick={() => (evento ? evento.prompt() : setIstruzioni(true))}
          className="text-salvia/80 text-[13px] inline-flex items-center gap-1.5 px-4 py-2"
        >
          <IconaInstalla className="w-4 h-4" />
          {t.aggiungiAllaHome}
        </button>
      </div>

      {istruzioni && (
        <div
          className="fixed inset-0 z-50 bg-inchiostro/40 backdrop-blur-[2px] flex items-end sm:items-center sm:justify-center"
          onClick={() => setIstruzioni(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-carta rounded-t-3xl sm:rounded-3xl p-6 sicura-sotto comparsa"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-salvia-velo rounded-full mx-auto mb-6 sm:hidden" />
            <p className="titolo text-2xl text-center mb-1">{t.aggiungiAllaHome}</p>
            <p className="text-fumo text-sm text-center leading-relaxed mb-2">{t.perchéInstallare}</p>
            {/* Il nome del browser rassicura chi si chiede se sta guardando
                le istruzioni giuste. */}
            <p className="text-salvia text-[13px] text-center mb-6">
              {nome ? t.conBrowser(nome) : ''}
            </p>

            <ol className="space-y-4">
              <Passo numero={1} testo={passi.gesto}>
                {/* l'icona di condivisione di iOS: un rettangolo con la freccia che esce */}
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor"
                     strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12M8.5 6.5L12 3l3.5 3.5" />
                  <path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18.5 11H17" />
                </svg>
              </Passo>
              <Passo numero={2} testo={passi.voce}>
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor"
                     strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
                  <path d="M12 8.5v7M8.5 12h7" />
                </svg>
              </Passo>
              <Passo numero={3} testo={t.passoFatto}>
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor"
                     strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </Passo>
            </ol>

            <button
              onClick={() => setIstruzioni(false)}
              className="w-full mt-7 bg-salvia text-crema rounded-2xl py-3.5 text-[17px]"
            >
              {t.hoCapito}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Passo({ numero, testo, children }: {
  numero: number
  testo: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-4">
      <span className="w-11 h-11 shrink-0 rounded-full bg-salvia-velo grid place-items-center text-salvia">
        {children}
      </span>
      <span className="text-[15px] leading-snug">
        <span className="text-fumo/60 mr-1.5">{numero}.</span>
        {testo}
      </span>
    </li>
  )
}
