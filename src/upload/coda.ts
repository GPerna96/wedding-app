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

function daStato(stato: number) {
  // 413 e 507: il file non ci sta o lo spazio e' finito. Ritentare non serve.
  if (stato === 413) return new ErroreInvio('troppoGrande', true)
  if (stato === 507 || stato === 429) return new ErroreInvio('server', true)
  if (stato >= 500) return new ErroreInvio('server')
  return new ErroreInvio('ignoto', stato >= 400 && stato < 500)
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw daStato(r.status)
  return r.json() as Promise<T>
}

/**
 * Un invio che racconta a che punto e'.
 *
 * Con fetch non c'e' modo di sapere quanti byte sono partiti: la barra restava
 * ferma per tutto il tempo -- che su una foto da dodici mega e' quasi tutto il
 * tempo -- e poi saltava alla fine. Chi guardava pensava che si fosse piantata,
 * tanto piu' che la foto era gia' comparsa nel muro grazie alla miniatura.
 * XMLHttpRequest, piu' vecchio, questo lo sa dire.
 */
function invia<T>(metodo: string, url: string, corpo: Blob | null, opzioni: {
  intestazioni?: Record<string, string>
  avanza?: (frazione: number) => void
} = {}): Promise<T> {
  return new Promise<T>((risolvi, rifiuta) => {
    const x = new XMLHttpRequest()
    x.open(metodo, url)
    for (const [k, v] of Object.entries(opzioni.intestazioni ?? {})) x.setRequestHeader(k, v)

    if (opzioni.avanza) {
      x.upload.onprogress = (e) => {
        if (e.lengthComputable) opzioni.avanza!(e.loaded / e.total)
      }
    }
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) {
        try { risolvi(JSON.parse(x.responseText) as T) } catch { risolvi({} as T) }
      } else {
        rifiuta(daStato(x.status))
      }
    }
    x.onerror = () => rifiuta(new ErroreInvio('rete'))
    x.onabort = () => rifiuta(new ErroreInvio('rete'))
    x.send(corpo)
  })
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
      const tipo = file.type.startsWith('video') ? 'video' : 'foto'
      const l: Lavoro = {
        id: crypto.randomUUID(),
        file,
        tipo,
        stato: 'attesa',
        progresso: 0,
        // Una faccia subito, presa dal file stesso: si caricano due foto per
        // volta, e le altre restavano righe anonime in attesa del proprio
        // turno. La miniatura vera la sostituisce appena e' pronta.
        anteprimaLocale: tipo === 'foto' ? URL.createObjectURL(file) : undefined,
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
    const provvisoria = l.anteprimaLocale
    this.aggiorna(l.id, { anteprimaLocale: URL.createObjectURL(ant.griglia), progresso: 0.05 })
    // La provvisoria teneva in memoria il file intero: qui non serve piu'.
    if (provvisoria) URL.revokeObjectURL(provvisoria)

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

    // 3. La miniatura della griglia: e' minuscola e sblocca la comparsa nel
    // muro degli altri.
    await conRitentativi(() =>
      invia(`PUT`, `/api/upload/anteprima/${idServer}?griglia`, ant.griglia),
    )
    this.aggiorna(l.id, { progresso: 0.1 })

    /*
     * 4. Poi subito l'originale: e' cio' che non si puo' perdere, e prima
     * arriva prima e' al sicuro. L'anteprima grande, che serve solo aprendo la
     * foto, viene dopo -- prima stava in mezzo e rimandava di qualche secondo
     * il momento in cui il ricordo era davvero salvo.
     */
    const avanza = (f: number) => this.aggiorna(l.id, { progresso: 0.1 + 0.85 * f })

    if (!multipart || l.file.size <= SOGLIA_MULTIPART) {
      await conRitentativi(() =>
        invia(`PUT`, `/api/upload/diretto/${idServer}`, l.file, {
          intestazioni: { 'x-tipo-file': l.file.type || 'application/octet-stream' },
          avanza,
        }),
      )
    } else {
      await this.multipart(l, idServer)
    }
    this.aggiorna(l.id, { progresso: 0.95 })

    // 5. L'anteprima grande, per chi aprira' la foto a schermo intero.
    await conRitentativi(() => invia(`PUT`, `/api/upload/anteprima/${idServer}`, ant.blob))

    this.aggiorna(l.id, { stato: 'fatto', progresso: 1 })
    void scorta.togli(l.id)
  }

  private async multipart(l: Lavoro, idServer: string) {
    const totale = Math.ceil(l.file.size / PARTE)
    const parti: { n: number; etag: string }[] = []
    // Quanto di ogni parte e' gia' partito: la somma fa la barra, che cosi'
    // avanza di continuo invece che a scatti da dieci mega.
    const fatto = new Array<number>(totale).fill(0)

    const mandaParte = async (n: number) => {
      const pezzo = l.file.slice((n - 1) * PARTE, n * PARTE)
      // Ogni parte ritenta per conto suo: se cade la linea a meta' video,
      // si riprende da qui e non dall'inizio.
      const parte = await conRitentativi(() =>
        invia<{ n: number; etag: string }>(`PUT`, `/api/upload/parte/${idServer}?n=${n}`, pezzo, {
          avanza: (f) => {
            fatto[n - 1] = f * pezzo.size
            const somma = fatto.reduce((a, b) => a + b, 0)
            this.aggiorna(l.id, { progresso: 0.1 + 0.85 * (somma / l.file.size) })
          },
        }),
      )
      fatto[n - 1] = pezzo.size
      parti.push(parte)
    }

    // Due parti per volta: su una rete decente quasi raddoppia la velocita' di
    // un video lungo, e non satura il telefono.
    const numeri = Array.from({ length: totale }, (_, k) => k + 1)
    const corsie = Array.from({ length: Math.min(2, totale) }, async () => {
      for (let n = numeri.shift(); n !== undefined; n = numeri.shift()) await mandaParte(n)
    })
    await Promise.all(corsie)

    parti.sort((a, b) => a.n - b.n)
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
