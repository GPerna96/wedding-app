// Due misure, perche' servono a due cose diverse: la griglia mostra tessere da
// ~200px di lato e non ha senso mandarle un'immagine da 1600, mentre il visore
// riempie lo schermo e ha bisogno di qualcosa di dignitoso mentre l'originale
// arriva.
const LATO_GRIGLIA = 500
const LATO_GRANDE = 1600
const QUALITA = 0.82
const QUALITA_GRIGLIA = 0.72

export type Anteprima = {
  blob: Blob          // la grande, per il visore
  griglia: Blob       // la piccola, per il muro
  larghezza: number
  altezza: number
  durataMs?: number
}

function ridimensiona(l: number, a: number, lato = LATO_GRANDE) {
  const scala = Math.min(1, lato / Math.max(l, a))
  return { l: Math.round(l * scala), a: Math.round(a * scala) }
}

async function suTela(
  sorgente: CanvasImageSource, l: number, a: number,
  lato = LATO_GRANDE, qualita = QUALITA,
): Promise<Blob> {
  const d = ridimensiona(l, a, lato)
  const tela = document.createElement('canvas')
  tela.width = d.l
  tela.height = d.a
  const ctx = tela.getContext('2d')!
  // Il ridimensionamento di qualita' costa poco su una sola immagine e si vede
  // sulle tessere piccole, dove i dettagli fini altrimenti sfarfallano.
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(sorgente, 0, 0, d.l, d.a)

  const blob = await new Promise<Blob | null>((ok) =>
    tela.toBlob(ok, 'image/webp', qualita),
  )
  // Safari piu' vecchi non scrivono WebP: si ripiega su JPEG senza fare storie.
  if (blob) return blob
  return new Promise<Blob>((ok) =>
    tela.toBlob((b) => ok(b!), 'image/jpeg', qualita),
  )
}

/** Entrambe le misure da una sola decodifica del file. */
async function dueMisure(sorgente: CanvasImageSource, l: number, a: number) {
  return {
    blob: await suTela(sorgente, l, a),
    griglia: await suTela(sorgente, l, a, LATO_GRIGLIA, QUALITA_GRIGLIA),
  }
}

/**
 * createImageBitmap passa dal decoder nativo del browser: su iPhone questo
 * significa che anche un HEIC produce un'anteprima leggibile, mentre
 * l'originale resta intoccato.
 */
async function daFoto(file: File): Promise<Anteprima> {
  const bitmap = await createImageBitmap(file)
  try {
    const d = ridimensiona(bitmap.width, bitmap.height)
    return { ...(await dueMisure(bitmap, bitmap.width, bitmap.height)), larghezza: d.l, altezza: d.a }
  } finally {
    bitmap.close()
  }
}

/** Primo fotogramma utile del video. Se il browser non collabora, si va di ripiego. */
function daVideo(file: File): Promise<Anteprima> {
  return new Promise((risolvi, rifiuta) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    // iOS non decodifica un video fuori dal DOM in modo affidabile.
    video.setAttribute('crossorigin', 'anonymous')

    const pulisci = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute('src')
      video.load()
    }
    const scaduto = setTimeout(() => {
      pulisci()
      rifiuta(new Error('timeout_anteprima_video'))
    }, 12_000)

    video.onloadedmetadata = () => {
      // 0.1s: il fotogramma zero e' spesso nero.
      video.currentTime = Math.min(0.1, (video.duration || 1) / 2)
    }
    video.onseeked = async () => {
      clearTimeout(scaduto)
      try {
        const misure = await dueMisure(video, video.videoWidth, video.videoHeight)
        const d = ridimensiona(video.videoWidth, video.videoHeight)
        risolvi({ ...misure, larghezza: d.l, altezza: d.a, durataMs: Math.round(video.duration * 1000) })
      } catch (e) {
        rifiuta(e)
      } finally {
        pulisci()
      }
    }
    video.onerror = () => {
      clearTimeout(scaduto)
      pulisci()
      rifiuta(new Error('video_illeggibile'))
    }
    video.src = url
  })
}

/** Ripiego: un rettangolo salvia, cosi' il muro non mostra mai un buco. */
async function ripiego(): Promise<Anteprima> {
  const tela = document.createElement('canvas')
  tela.width = 800
  tela.height = 800
  const ctx = tela.getContext('2d')!
  ctx.fillStyle = '#9CAF95'
  ctx.fillRect(0, 0, 800, 800)
  const blob = await new Promise<Blob>((ok) => tela.toBlob((b) => ok(b!), 'image/jpeg', 0.8))
  return { blob, griglia: blob, larghezza: 800, altezza: 800 }
}

export async function creaAnteprima(file: File): Promise<Anteprima> {
  try {
    return file.type.startsWith('video') ? await daVideo(file) : await daFoto(file)
  } catch {
    return ripiego()
  }
}
