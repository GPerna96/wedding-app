import { useEffect, useRef, useState } from 'react'
import { t } from '../lingua'

type Esito = (token: string) => void

/** Dal contenuto del QR ricava il token, sia da un URL completo sia dal codice nudo. */
function estraiToken(testo: string): string | null {
  try {
    const k = new URL(testo).searchParams.get('k')
    if (k) return k
  } catch { /* non era un URL */ }
  // Il token ha la forma xxxx-xxxx-xxxx: accettalo anche letto da solo.
  return /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(testo.trim()) ? testo.trim() : null
}

export function LettoreQr({ trovato, chiudi }: { trovato: Esito; chiudi: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [cerca, setCerca] = useState(true)

  useEffect(() => {
    let flusso: MediaStream | null = null
    let attivo = true
    let telaio = 0

    ;(async () => {
      try {
        flusso = await navigator.mediaDevices.getUserMedia({
          // La fotocamera posteriore: quella che si punta verso il tavolo.
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (!attivo) return flusso.getTracks().forEach((t) => t.stop())
        const v = video.current!
        v.srcObject = flusso
        await v.play()

        // Chrome ha il rilevatore in casa; Safari no, e li' serve la libreria.
        const Rilevatore = (window as any).BarcodeDetector
        const nativo = Rilevatore ? new Rilevatore({ formats: ['qr_code'] }) : null
        const jsQR = nativo ? null : (await import('jsqr')).default

        const tela = document.createElement('canvas')
        const ctx = tela.getContext('2d', { willReadFrequently: true })!

        const guarda = async () => {
          if (!attivo || v.readyState < 2) {
            telaio = requestAnimationFrame(guarda)
            return
          }
          try {
            let testo: string | null = null
            if (nativo) {
              const codici = await nativo.detect(v)
              testo = codici[0]?.rawValue ?? null
            } else {
              // Mezza risoluzione: basta per un QR e non fa scaldare il telefono.
              tela.width = v.videoWidth / 2
              tela.height = v.videoHeight / 2
              ctx.drawImage(v, 0, 0, tela.width, tela.height)
              const dati = ctx.getImageData(0, 0, tela.width, tela.height)
              testo = jsQR!(dati.data, dati.width, dati.height, {
                inversionAttempts: 'dontInvert',
              })?.data ?? null
            }

            if (testo) {
              const token = estraiToken(testo)
              if (token) {
                attivo = false
                setCerca(false)
                if (navigator.vibrate) navigator.vibrate(40)
                flusso?.getTracks().forEach((t) => t.stop())
                return trovato(token)
              }
              setErrore(t.codiceSbagliato)
            }
          } catch { /* fotogramma saltato, si riprova */ }
          telaio = requestAnimationFrame(guarda)
        }
        guarda()
      } catch (e) {
        const nome = (e as Error).name
        setErrore(
          nome === 'NotAllowedError'
            ? t.permessoNegato
            : nome === 'NotFoundError'
              ? t.nessunaFotocamera
              : t.fotocameraKo,
        )
        setCerca(false)
      }
    })()

    return () => {
      attivo = false
      cancelAnimationFrame(telaio)
      flusso?.getTracks().forEach((t) => t.stop())
    }
  }, [trovato])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="sicura-sopra px-4 pb-3 flex items-center justify-between text-white/90">
        <p className="text-[15px]">{t.inquadraSulTavolo}</p>
        <button onClick={chiudi} aria-label={t.chiudi} className="w-10 h-10 grid place-items-center text-2xl leading-none">
          ×
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video ref={video} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        {/* Mirino: aiuta a capire dove mettere il codice. */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="w-56 h-56 border-2 border-white/80 rounded-3xl shadow-[0_0_0_100vmax_rgba(0,0,0,.45)]" />
        </div>
      </div>

      <div className="sicura-sotto px-6 pt-4 text-center">
        {errore ? (
          <p className="text-white/90 text-[15px] leading-relaxed">{errore}</p>
        ) : (
          <p className="text-white/60 text-[15px]">{cerca ? t.cercoCodice : t.trovato}</p>
        )}
      </div>
    </div>
  )
}
