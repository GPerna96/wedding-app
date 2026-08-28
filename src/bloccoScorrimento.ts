import { useEffect, useState } from 'react'

/**
 * Congela la pagina finche' qualcosa sta sopra (visore, foglio del menu).
 *
 * Su iOS `overflow: hidden` da solo non basta: Safari continua a trascinare il
 * documento col rubber band. L'unico modo affidabile e' fissare il body e
 * rimetterlo dov'era alla chiusura.
 */
export function useBloccoScorrimento(attivo: boolean) {
  useEffect(() => {
    if (!attivo) return
    const y = window.scrollY
    const b = document.body.style
    const prima = { position: b.position, top: b.top, width: b.width, overflow: b.overflow }

    b.position = 'fixed'
    b.top = `-${y}px`
    b.width = '100%'
    b.overflow = 'hidden'

    return () => {
      Object.assign(b, prima)
      window.scrollTo(0, y)
    }
  }, [attivo])
}

/**
 * Vero quando la tastiera di iOS e' aperta. Safari non ridimensiona il layout
 * ma solo la viewport visiva: senza questo controllo la barra fissa in basso
 * resta sepolta sotto la tastiera.
 */
export function useTastieraAperta() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null
  const [aperta, setAperta] = useState(false)

  useEffect(() => {
    if (!vv) return
    const guarda = () => setAperta(window.innerHeight - vv.height > 150)
    vv.addEventListener('resize', guarda)
    vv.addEventListener('scroll', guarda)
    return () => {
      vv.removeEventListener('resize', guarda)
      vv.removeEventListener('scroll', guarda)
    }
  }, [vv])

  return aperta
}
