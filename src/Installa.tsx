import { useEffect, useState } from 'react'
import { IconaInstalla } from './schermate/Icone'

type EventoInstallazione = Event & { prompt: () => Promise<void> }

const NASCOSTO = 'installa-no'

/**
 * Invito ad aggiungere l'app alla schermata iniziale. Su Android c'e' un evento
 * apposta; su iOS non esiste e va spiegato a parole, percio' i due rami sono
 * diversi. Compare solo dopo che l'ospite ha gia' caricato qualcosa: chiederlo
 * all'ingresso e' solo un ostacolo in piu'.
 */
export function Installa({ attivo }: { attivo: boolean }) {
  const [evento, setEvento] = useState<EventoInstallazione | null>(null)
  const [iosVisibile, setIosVisibile] = useState(false)

  useEffect(() => {
    try { if (localStorage.getItem(NASCOSTO)) return } catch { return }

    const giaInstallata =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (giaInstallata) return

    const cattura = (e: Event) => {
      e.preventDefault()
      setEvento(e as EventoInstallazione)
    }
    window.addEventListener('beforeinstallprompt', cattura)

    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const safari = /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)
    if (iOS && safari) setIosVisibile(true)

    return () => window.removeEventListener('beforeinstallprompt', cattura)
  }, [])

  function chiudi() {
    try { localStorage.setItem(NASCOSTO, '1') } catch { /* navigazione privata */ }
    setEvento(null)
    setIosVisibile(false)
  }

  if (!attivo || (!evento && !iosVisibile)) return null

  return (
    <div className="fixed inset-x-3 bottom-24 z-20 bg-carta border border-salvia-velo
                    rounded-2xl shadow-lg px-4 py-3.5 flex items-start gap-3 comparsa">
      <span className="text-salvia mt-0.5"><IconaInstalla className="w-6 h-6" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium">Tienila a portata di mano</p>
        <p className="text-[13px] text-fumo leading-relaxed mt-0.5">
          {evento
            ? 'Aggiungila alla schermata iniziale: si apre come un’app, senza cercare il link.'
            : 'Tocca Condividi in basso, poi «Aggiungi alla schermata Home».'}
        </p>
        {evento && (
          <button
            onClick={() => { evento.prompt(); chiudi() }}
            className="mt-2.5 bg-salvia text-crema rounded-xl px-4 py-2 text-sm"
          >
            Aggiungi
          </button>
        )}
      </div>
      <button onClick={chiudi} aria-label="Chiudi" className="text-fumo/50 text-lg leading-none px-1">
        ×
      </button>
    </div>
  )
}
