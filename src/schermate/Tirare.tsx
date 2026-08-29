import { useEffect, useRef, useState } from 'react'

const SOGLIA = 70          // quanto tirare perché scatti
const MASSIMO = 110        // oltre non si allunga più: elastico, non elastico infinito

/**
 * Tirare giù per aggiornare.
 *
 * Il gesto nativo del browser qui non c'è: l'abbiamo tolto insieme al rimbalzo
 * elastico di iOS, che faceva slittare il muro sotto le dita. E con poche foto
 * la pagina non scorre nemmeno, quindi senza questo non ci sarebbe alcun modo
 * di chiedere un aggiornamento a mano.
 */
export function Tirare({ aggiorna, children }: {
  aggiorna: () => Promise<void>
  children: React.ReactNode
}) {
  const [tiro, setTiro] = useState(0)
  const [inCorso, setInCorso] = useState(false)
  const partenza = useRef<number | null>(null)

  useEffect(() => {
    function inizio(e: TouchEvent) {
      // Solo se siamo gia' in cima: altrimenti si sta semplicemente scorrendo.
      partenza.current = window.scrollY <= 0 ? e.touches[0].clientY : null
    }

    function muove(e: TouchEvent) {
      if (partenza.current === null || inCorso) return
      const delta = e.touches[0].clientY - partenza.current
      if (delta <= 0) {
        setTiro(0)
        return
      }
      // Resistenza crescente: gli ultimi millimetri costano piu' dei primi,
      // ed e' quello che fa sembrare il gesto naturale.
      setTiro(Math.min(MASSIMO, delta * 0.5))
      if (e.cancelable) e.preventDefault()
    }

    async function fine() {
      const arrivato = tiro >= SOGLIA
      partenza.current = null
      if (!arrivato || inCorso) return setTiro(0)

      setInCorso(true)
      setTiro(SOGLIA)
      if (navigator.vibrate) navigator.vibrate(15)
      try {
        await aggiorna()
      } finally {
        setInCorso(false)
        setTiro(0)
      }
    }

    // passive: false, altrimenti il browser non lascia bloccare lo scorrimento.
    window.addEventListener('touchstart', inizio, { passive: true })
    window.addEventListener('touchmove', muove, { passive: false })
    window.addEventListener('touchend', fine)
    window.addEventListener('touchcancel', fine)
    return () => {
      window.removeEventListener('touchstart', inizio)
      window.removeEventListener('touchmove', muove)
      window.removeEventListener('touchend', fine)
      window.removeEventListener('touchcancel', fine)
    }
  }, [tiro, inCorso, aggiorna])

  const pronto = tiro >= SOGLIA

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-20 flex justify-center pointer-events-none"
        style={{ height: tiro, opacity: Math.min(1, tiro / 45) }}
      >
        <span
          className="mt-3 w-9 h-9 rounded-full bg-carta border border-salvia-velo
                     grid place-items-center text-salvia shadow-sm"
          style={{ transform: `rotate(${tiro * 3}deg)` }}
        >
          <svg viewBox="0 0 24 24" className={`w-4 h-4 ${inCorso ? 'animate-spin' : ''}`}
               fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
               aria-hidden="true">
            {inCorso || pronto
              ? <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
              : <path d="M12 5v13M6.5 12.5L12 18l5.5-5.5" />}
          </svg>
        </span>
      </div>

      <div
        style={{ transform: tiro ? `translateY(${tiro}px)` : undefined }}
        className={tiro ? '' : 'transition-transform duration-200'}
      >
        {children}
      </div>
    </>
  )
}
