import { creaAnteprima } from './anteprima'
import { scorta, tieniSveglio } from './scorta'

/**
 * Impronta del file, per riconoscerlo se torna una seconda volta.
 *
 * Non passa dal contenuto intero: su un video da mezzo giga ci vorrebbero
 * secondi e il telefono si scalderebbe per nulla. Bastano misura, data di
 * scatto e i primi 256 kB, che due riprese diverse non hanno mai uguali.
 */
async function impronta(file: File): Promise<string | undefined> {
  try {
    const testa = new Uint8Array(await file.slice(0, 262144).arrayBuffer())
    const etichetta = new TextEncoder().encode(`${file.size}:${file.lastModified}:${file.type}`)
    const insieme = new Uint8Array(etichetta.length + testa.length)
    insieme.set(etichetta)
    insieme.set(testa, etichetta.length)
    const somma = await crypto.subtle.digest('SHA-256', insieme)
    return [...new Uint8Array(somma)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return undefined   // senza impronta si carica lo stesso, al massimo si duplica
  }
}

const PARTE = 10 * 1024 * 1024   // 10 MB: sta largo sotto il limite di corpo richiesta
const SOGLIA_MULTIPART = 10 * 1024 * 1024
const TENTATIVI = 4
const PARALLELI = 2

export type StatoUpload = 'attesa' | 'anteprima' | 'invio' | 'fatto' | 'errore' | 'giaPresente'

/** Cosa e' andato storto, in termini che abbiano senso per un invitato. */
export type Motivo = 'rete' | 'troppoGrande' | 'server' | 'ignoto'

export type Lavoro = {
  id: string           // id locale finche' il server non ne assegna uno
  idServer?: string
  file: File
  tipo: 'foto' | 'video'
  stato: StatoUpload
  progresso: number    // 0..1
  anteprimaLocale?: string
  motivo?: Motivo
}

type Ascoltatore = (lavori: Lavoro[]) => void

async function conRitentativi<T>(azione: () => Promise<T>, quante = TENTATIVI): Promise<T> {
  let ultimo: unknown
  for (let i = 0; i < quante; i++) {
    try {
      return await azione()
    } catch (e) {
      ultimo = e
      // Su un rifiuto definitivo insistere e' solo tempo perso.
      if (e instanceof ErroreInvio && e.definitivo) throw e
      // Attesa crescente: 0.5s, 1s, 2s. Una rete da sala ricevimenti si riprende da sola.
      await new Promise((r) => setTimeout(r, 500 * 2 ** i))
    }
  }
  throw ultimo
}

class ErroreInvio extends Error {
  constructor(readonly motivo: Motivo, readonly definitivo = false) {
    super(motivo)
  }
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) {
    // 413 e 507: il file non ci sta o lo spazio e' finito. Ritentare non serve.
    if (r.status === 413) throw new ErroreInvio('troppoGrande', true)
    if (r.status === 507 || r.status === 429) throw new ErroreInvio('server', true)
    if (r.status >= 500) throw new ErroreInvio('server')
    throw new ErroreInvio('ignoto', r.status >= 400 && r.status < 500)
  }
  return r.json() as Promise<T>
}

export class Coda {
  private lavori: Lavoro[] = []
  private ascoltatori = new Set<Ascoltatore>()
  private attivi = 0
  private sveglia: (() => void) | null = null

  ascolta(fn: Ascoltatore) {
    this.ascoltatori.add(fn)
    fn(this.lavori)
    return () => this.ascoltatori.delete(fn)
  }

  private avvisa() {
    const copia = [...this.lavori]
    this.ascoltatori.forEach((fn) => fn(copia))
  }

  private aggiorna(id: string, cambi: Partial<Lavoro>) {
    const l = this.lavori.find((x) => x.id === id)
    if (!l) return
    Object.assign(l, cambi)
    this.avvisa()
  }

  aggiungi(files: File[]) {
    for (const file of files) {
      const l: Lavoro = {
        id: crypto.randomUUID(),
        file,
        tipo: file.type.startsWith('video') ? 'video' : 'foto',
        stato: 'attesa',
        progresso: 0,
      }
      this.lavori.unshift(l)
      // Da qui in poi il file e' al sicuro anche se l'app viene chiusa.
      void scorta.salva({ id: l.id, file: l.file, tipo: l.tipo })
    }
    this.avvisa()
    this.pompa()
  }

  /**
   * Alla riapertura dell'app: cio' che era rimasto in sospeso riparte da solo,
   * senza che l'invitato debba ricordarsene o ritrovare le foto nel rullino.
   */
  async riprendi() {
    const sospesi = await scorta.tutti()
    const nuovi = sospesi.filter((s) => !this.lavori.some((l) => l.id === s.id))
    if (!nuovi.length) return

    for (const s of nuovi) {
      this.lavori.push({ id: s.id, file: s.file, tipo: s.tipo, stato: 'attesa', progresso: 0 })
    }
    this.avvisa()
    this.pompa()
  }

  riprova(id: string) {
    this.aggiorna(id, { stato: 'attesa', progresso: 0, motivo: undefined })
    this.pompa()
  }

  get inCorso() {
    return this.lavori.some((l) => l.stato !== 'fatto' && l.stato !== 'errore')
  }

  private pompa() {
    if (!this.sveglia && this.inCorso) this.sveglia = tieniSveglio()

    while (this.attivi < PARALLELI) {
      const prossimo = this.lavori.find((l) => l.stato === 'attesa')
      if (!prossimo) return
      this.attivi++
      prossimo.stato = 'anteprima'
      this.esegui(prossimo)
        .catch((e) => this.aggiorna(prossimo.id, {
          stato: 'errore',
          motivo: e instanceof ErroreInvio ? e.motivo : (navigator.onLine ? 'ignoto' : 'rete'),
        }))
        .finally(() => {
          this.attivi--
          this.pompa()
          if (this.attivi === 0 && !this.inCorso) {
            this.sveglia?.()
            this.sveglia = null
          }
        })
    }
    this.avvisa()
  }

  private async esegui(l: Lavoro) {
    // 1. L'anteprima nasce qui sul telefono: nessuna transcodifica lato server.
    const ant = await creaAnteprima(l.file)
    this.aggiorna(l.id, { anteprimaLocale: URL.createObjectURL(ant.griglia), progresso: 0.05 })

    // 2. Apri la pratica lato server, dicendo di che file si tratta.
    const marchio = await impronta(l.file)
    const risposta = await conRitentativi(() =>
      fetch('/api/upload/inizia', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tipo: l.tipo,
          nomeFile: l.file.name,
          mime: l.file.type,
          byte: l.file.size,
          impronta: marchio,
          larghezza: ant.larghezza,
          altezza: ant.altezza,
          durataMs: ant.durataMs,
        }),
      }).then(json<{ id: string; multipart: boolean; giaPresente?: boolean }>),
    )

    // Questo scatto c'e' gia': meglio dirlo che caricarlo una seconda volta.
    if (risposta.giaPresente) {
      this.aggiorna(l.id, { stato: 'giaPresente', progresso: 1 })
      void scorta.togli(l.id)
      return
    }
    const { id: idServer, multipart } = risposta
    this.aggiorna(l.id, { idServer, stato: 'invio', progresso: 0.1 })

    // 3. Prima la miniatura della griglia: e' minuscola e sblocca la comparsa
    // nel muro degli altri. La grande, che serve solo aprendo la foto, segue.
    await conRitentativi(() =>
      fetch(`/api/upload/anteprima/${idServer}?griglia`, { method: 'PUT', body: ant.griglia })
        .then(json),
    )
    this.aggiorna(l.id, { progresso: 0.12 })

    await conRitentativi(() =>
      fetch(`/api/upload/anteprima/${idServer}`, { method: 'PUT', body: ant.blob }).then(json),
    )
    this.aggiorna(l.id, { progresso: 0.15 })

    // 4. Poi l'originale, intatto.
    if (!multipart || l.file.size <= SOGLIA_MULTIPART) {
      await conRitentativi(() =>
        fetch(`/api/upload/diretto/${idServer}`, {
          method: 'PUT',
          headers: { 'x-tipo-file': l.file.type || 'application/octet-stream' },
          body: l.file,
        }).then(json),
      )
    } else {
      await this.multipart(l, idServer)
    }

    this.aggiorna(l.id, { stato: 'fatto', progresso: 1 })
    void scorta.togli(l.id)
  }

  private async multipart(l: Lavoro, idServer: string) {
    const totale = Math.ceil(l.file.size / PARTE)
    const parti: { n: number; etag: string }[] = []

    for (let n = 1; n <= totale; n++) {
      const pezzo = l.file.slice((n - 1) * PARTE, n * PARTE)
      // Ogni parte ritenta per conto suo: se cade la linea a meta' video,
      // si riprende da qui e non dall'inizio.
      const parte = await conRitentativi(() =>
        fetch(`/api/upload/parte/${idServer}?n=${n}`, { method: 'PUT', body: pezzo })
          .then(json<{ n: number; etag: string }>),
      )
      parti.push(parte)
      this.aggiorna(l.id, { progresso: 0.15 + 0.8 * (n / totale) })
    }

    await conRitentativi(() =>
      fetch(`/api/upload/completa/${idServer}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ parti }),
      }).then(json),
    )
  }
}

export const coda = new Coda()
