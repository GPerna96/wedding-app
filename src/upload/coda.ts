import { creaAnteprima } from './anteprima'

const PARTE = 10 * 1024 * 1024   // 10 MB: sta largo sotto il limite di corpo richiesta
const SOGLIA_MULTIPART = 10 * 1024 * 1024
const TENTATIVI = 4
const PARALLELI = 2

export type StatoUpload = 'attesa' | 'anteprima' | 'invio' | 'fatto' | 'errore'

export type Lavoro = {
  id: string           // id locale finche' il server non ne assegna uno
  idServer?: string
  file: File
  tipo: 'foto' | 'video'
  stato: StatoUpload
  progresso: number    // 0..1
  anteprimaLocale?: string
  errore?: string
}

type Ascoltatore = (lavori: Lavoro[]) => void

async function conRitentativi<T>(azione: () => Promise<T>, quante = TENTATIVI): Promise<T> {
  let ultimo: unknown
  for (let i = 0; i < quante; i++) {
    try {
      return await azione()
    } catch (e) {
      ultimo = e
      // Attesa crescente: 0.5s, 1s, 2s. Una rete da sala ricevimenti si riprende da sola.
      await new Promise((r) => setTimeout(r, 500 * 2 ** i))
    }
  }
  throw ultimo
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json() as Promise<T>
}

export class Coda {
  private lavori: Lavoro[] = []
  private ascoltatori = new Set<Ascoltatore>()
  private attivi = 0

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
      this.lavori.unshift({
        id: crypto.randomUUID(),
        file,
        tipo: file.type.startsWith('video') ? 'video' : 'foto',
        stato: 'attesa',
        progresso: 0,
      })
    }
    this.avvisa()
    this.pompa()
  }

  riprova(id: string) {
    this.aggiorna(id, { stato: 'attesa', progresso: 0, errore: undefined })
    this.pompa()
  }

  get inCorso() {
    return this.lavori.some((l) => l.stato !== 'fatto' && l.stato !== 'errore')
  }

  private pompa() {
    while (this.attivi < PARALLELI) {
      const prossimo = this.lavori.find((l) => l.stato === 'attesa')
      if (!prossimo) return
      this.attivi++
      prossimo.stato = 'anteprima'
      this.esegui(prossimo)
        .catch((e) => this.aggiorna(prossimo.id, { stato: 'errore', errore: String(e) }))
        .finally(() => {
          this.attivi--
          this.pompa()
        })
    }
    this.avvisa()
  }

  private async esegui(l: Lavoro) {
    // 1. L'anteprima nasce qui sul telefono: nessuna transcodifica lato server.
    const ant = await creaAnteprima(l.file)
    this.aggiorna(l.id, { anteprimaLocale: URL.createObjectURL(ant.blob), progresso: 0.05 })

    // 2. Apri la pratica lato server.
    const { id: idServer, multipart } = await conRitentativi(() =>
      fetch('/api/upload/inizia', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tipo: l.tipo,
          nomeFile: l.file.name,
          byte: l.file.size,
          larghezza: ant.larghezza,
          altezza: ant.altezza,
          durataMs: ant.durataMs,
        }),
      }).then(json<{ id: string; multipart: boolean }>),
    )
    this.aggiorna(l.id, { idServer, stato: 'invio', progresso: 0.1 })

    // 3. Prima l'anteprima: e' leggera, e fa comparire subito la foto nel muro.
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
