import { Hono } from 'hono'
import { richiedeOspite, richiedeSessione } from '../sessione'
import type { Env, Variabili } from '../tipi'

export const media = new Hono<{ Bindings: Env; Variables: Variabili }>()

const TIPI = new Set(['foto', 'video'])

/**
 * Tipi che accettiamo di rimandare indietro cosi' come sono. Tutto il resto
 * esce come octet-stream: senza questa lista un invitato potrebbe caricare un
 * .html e farselo servire dal nostro stesso dominio.
 */
const MIME_AMMESSI = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif', 'image/avif',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
])

function mimeSicuro(dichiarato: string | undefined) {
  const pulito = (dichiarato ?? '').split(';')[0].trim().toLowerCase()
  return MIME_AMMESSI.has(pulito) ? pulito : 'application/octet-stream'
}
const MAX_BYTE = 5 * 1024 * 1024 * 1024 // 5 GB: oltre non ci va nemmeno un 4K lunghissimo

/** Ripulisce il nome file: niente percorsi, niente caratteri che rompono le chiavi R2. */
function nomePulito(nome: string) {
  return (nome.split(/[\\/]/).pop() ?? 'file')
    .replace(/[^\w.\- ]+/g, '_')
    .slice(-120)
}

media.use('/api/media/*', richiedeOspite)
media.use('/api/upload/*', richiedeOspite)
media.use('/media/*', richiedeSessione)

/**
 * Apre un caricamento. Per i file piccoli basta un PUT singolo; sopra la soglia
 * si passa al multipart nativo di R2, che e' cio' che permette di riprendere
 * un video interrotto senza ricominciare da capo.
 */
media.post('/api/upload/inizia', async (c) => {
  const b = await c.req.json<{
    tipo: string; nomeFile?: string; mime?: string; byte: number
    larghezza?: number; altezza?: number; durataMs?: number; impronta?: string
  }>()

  if (!TIPI.has(b.tipo)) return c.json({ errore: 'tipo_non_valido' }, 400)
  if (!Number.isFinite(b.byte) || b.byte <= 0 || b.byte > MAX_BYTE)
    return c.json({ errore: 'dimensione_non_valida' }, 400)

  // Gia' visto? Si risponde di si' senza rifare il giro: un doppio tocco o una
  // pagina ricaricata a meta' invio non devono sdoppiare il ricordo.
  if (b.impronta) {
    const gemello = await c.env.DB.prepare(
      "select id from media where impronta = ? and stato = 'completo'",
    ).bind(b.impronta).first<{ id: string }>()
    if (gemello) return c.json({ id: gemello.id, multipart: false, giaPresente: true })
  }

  const id = crypto.randomUUID()
  const nome = nomePulito(b.nomeFile ?? (b.tipo === 'foto' ? 'foto.jpg' : 'video.mp4'))
  const chiaveOriginale = `originali/${id}/${nome}`
  const chiaveAnteprima = `anteprime/${id}.webp`

  const multipart = b.byte > 10 * 1024 * 1024
  let uploadId: string | null = null
  if (multipart) {
    // Il tipo va fissato all'apertura: dopo il complete non si tocca piu',
    // e senza di esso il video uscirebbe come octet-stream e non partirebbe.
    const mp = await c.env.MEDIA.createMultipartUpload(chiaveOriginale, {
      httpMetadata: { contentType: mimeSicuro(b.mime) },
    })
    uploadId = mp.uploadId
  }

  await c.env.DB.prepare(
    `insert into media (id, ospite_id, tipo, chiave_originale, chiave_anteprima,
                        upload_id, larghezza, altezza, durata_ms, byte, nome_file,
                        impronta, creato_il)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, c.var.ospite.id, b.tipo, chiaveOriginale, chiaveAnteprima,
    uploadId, b.larghezza ?? null, b.altezza ?? null, b.durataMs ?? null,
    b.byte, nome, b.impronta ?? null, Date.now(),
  ).run()

  return c.json({ id, multipart })
})

/** Verifica che il media esista e appartenga a chi sta caricando. */
type RigaMedia = {
  id: string; ospite_id: string; chiave_originale: string
  upload_id: string | null; stato: string
}

async function mio(c: any, id: string): Promise<RigaMedia | null> {
  const r = (await c.env.DB.prepare(
    'select id, ospite_id, chiave_originale, upload_id, stato from media where id = ?',
  ).bind(id).first()) as RigaMedia | null
  return r && r.ospite_id === c.var.ospite.id ? r : null
}

/**
 * Le anteprime: un PUT ciascuna, ed e' cio' che fa comparire la foto nel muro.
 *
 * Ne arrivano due misure. Quella della griglia e' l'unica che il muro scarica,
 * e pesa una decina di volte meno: mandare 1600 pixel per riempire una tessera
 * da 200 era il motivo per cui il muro si popolava lentamente.
 */
media.put('/api/upload/anteprima/:id', async (c) => {
  const m = await mio(c, c.req.param('id'))
  if (!m) return c.json({ errore: 'non_trovato' }, 404)

  const griglia = c.req.query('griglia') !== undefined
  const chiave = griglia ? `griglia/${m.id}.webp` : `anteprime/${m.id}.webp`

  await c.env.MEDIA.put(chiave, c.req.raw.body, {
    httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
  })

  // La foto entra nel muro quando c'e' la miniatura della griglia: e' quella
  // che il telefono degli altri andra' a cercare.
  if (griglia) {
    await c.env.DB.prepare('update media set anteprima_pronta = 1 where id = ?').bind(m.id).run()
  }
  return c.json({ ok: true })
})

/** File piccolo: l'originale in un colpo solo. */
media.put('/api/upload/diretto/:id', async (c) => {
  const m = await mio(c, c.req.param('id'))
  if (!m) return c.json({ errore: 'non_trovato' }, 404)

  await c.env.MEDIA.put(m.chiave_originale, c.req.raw.body, {
    httpMetadata: { contentType: mimeSicuro(c.req.header('x-tipo-file')) },
  })
  await segnaCompleto(c, m.id)
  return c.json({ ok: true })
})

/**
 * Chiude il caricamento. Se nel frattempo qualcun altro ha completato lo stesso
 * file, l'indice si oppone: il doppione resta indietro e sparisce dal muro
 * invece di far fallire l'invio a chi ha solo avuto la sfortuna di arrivare
 * secondo.
 */
async function segnaCompleto(c: any, id: string) {
  try {
    await c.env.DB.prepare("update media set stato = 'completo' where id = ?").bind(id).run()
  } catch {
    await c.env.DB.prepare('delete from media where id = ?').bind(id).run()
  }
}

/**
 * Una parte del multipart. Il corpo passa in streaming attraverso il Worker
 * fino a R2: nessun buffering, costo di CPU trascurabile.
 */
media.put('/api/upload/parte/:id', async (c) => {
  const m = await mio(c, c.req.param('id'))
  if (!m?.upload_id) return c.json({ errore: 'non_trovato' }, 404)

  const n = Number(c.req.query('n'))
  if (!Number.isInteger(n) || n < 1) return c.json({ errore: 'parte_non_valida' }, 400)

  const mp = c.env.MEDIA.resumeMultipartUpload(m.chiave_originale, m.upload_id)
  const parte = await mp.uploadPart(n, c.req.raw.body!)
  return c.json({ n: parte.partNumber, etag: parte.etag })
})

media.post('/api/upload/completa/:id', async (c) => {
  const m = await mio(c, c.req.param('id'))
  if (!m?.upload_id) return c.json({ errore: 'non_trovato' }, 404)

  const { parti } = await c.req.json<{ parti: { n: number; etag: string }[] }>()
  const mp = c.env.MEDIA.resumeMultipartUpload(m.chiave_originale, m.upload_id)
  await mp.complete(parti.map((p) => ({ partNumber: p.n, etag: p.etag })))

  await segnaCompleto(c, m.id)
  return c.json({ ok: true })
})

/** Il muro. `dopo` permette al polling di chiedere solo le novita'. */
media.get('/api/media', async (c) => {
  const dopo = Number(c.req.query('dopo') ?? 0)
  const { results } = await c.env.DB.prepare(
    `select m.id, m.tipo, m.larghezza, m.altezza, m.durata_ms, m.stato,
            m.creato_il, o.nome
       from media m join ospiti o on o.id = m.ospite_id
      where m.anteprima_pronta = 1 and m.creato_il > ?
      order by m.creato_il desc
      limit 300`,
  ).bind(dopo).all()

  // Quanti sono entrati finora: si vede sotto il titolo e da' il senso della
  // festa collettiva a chi apre l'app da solo al proprio tavolo.
  const quanti = await c.env.DB.prepare('select count(*) as n from ospiti')
    .first<{ n: number }>()

  return c.json({ media: results, ospiti: quanti?.n ?? 0 })
})

/** Serve anteprime e originali da R2, con supporto Range per il seek dei video. */
media.get('/media/:genere/:id', async (c) => {
  const genere = c.req.param('genere')
  if (genere !== 'anteprima' && genere !== 'originale' && genere !== 'griglia') {
    return c.notFound()
  }

  /**
   * Le miniature restano nella cache del punto di rete piu' vicino.
   *
   * La chiave e' l'indirizzo senza cookie: la cache non decide chi puo'
   * vedere cosa, quel controllo l'ha gia' fatto il middleware qui sopra. Cosi'
   * il primo invitato che apre il muro paga il viaggio fino al deposito, e
   * tutti gli altri al suo tavolo trovano l'immagine gia' pronta.
   */
  const cache = (caches as unknown as { default: Cache }).default
  const chiaveCache = new Request(new URL(c.req.url).toString(), { method: 'GET' })
  if (genere !== 'originale') {
    const daCache = await cache.match(chiaveCache)
    if (daCache) return daCache
  }

  const riga = await c.env.DB.prepare(
    'select chiave_originale, chiave_anteprima from media where id = ?',
  ).bind(c.req.param('id')).first<{
    chiave_originale: string; chiave_anteprima: string
  }>()
  if (!riga) return c.notFound()

  const chiave =
    genere === 'originale' ? riga.chiave_originale
    : genere === 'griglia' ? `griglia/${c.req.param('id')}.webp`
    : riga.chiave_anteprima
  const range = c.req.header('range')

  let oggetto = await c.env.MEDIA.get(chiave, range ? { range: c.req.raw.headers } : undefined)
  // Le foto caricate prima che esistesse la miniatura hanno solo la grande:
  // meglio servire quella che lasciare un buco nel muro.
  if (!oggetto && genere === 'griglia') {
    oggetto = await c.env.MEDIA.get(riga.chiave_anteprima)
  }
  if (!oggetto) return c.notFound()

  const h = new Headers()
  oggetto.writeHttpMetadata(h)
  // Con ?scarica il browser salva invece di aprire: e' cosi' che un invitato
  // si porta via lo scatto di un altro.
  if (c.req.query('scarica') !== undefined && genere === 'originale') {
    const riga2 = await c.env.DB.prepare('select nome_file from media where id = ?')
      .bind(c.req.param('id')).first<{ nome_file: string }>()
    const nome = (riga2?.nome_file || 'ricordo').replace(/["\\]/g, '')
    h.set('content-disposition', `attachment; filename="${nome}"`)
  }
  // Doppia cintura: tipo passato al setaccio anche in uscita, e niente sniffing.
  h.set('content-type', genere === 'originale'
    ? mimeSicuro(h.get('content-type') ?? undefined)
    : 'image/webp')
  h.set('x-content-type-options', 'nosniff')
  h.set('content-security-policy', "default-src 'none'; sandbox")
  h.set('etag', oggetto.httpEtag)
  // private: la copia sta nel browser di chi e' autorizzato, non nelle cache
  // condivise a monte, che la servirebbero senza controllare il cookie.
  h.set('cache-control', 'private, max-age=31536000, immutable')
  h.set('accept-ranges', 'bytes')

  if (genere !== 'originale') {
    const risposta = new Response(oggetto.body, { headers: h })
    // Una copia alla cache, l'altra a chi ha chiesto.
    c.executionCtx.waitUntil(cache.put(chiaveCache, risposta.clone()))
    return risposta
  }

  if (oggetto.range && 'offset' in oggetto.range) {
    const inizio = oggetto.range.offset ?? 0
    const fine = inizio + (oggetto.range.length ?? oggetto.size) - 1
    h.set('content-range', `bytes ${inizio}-${fine}/${oggetto.size}`)
    return new Response(oggetto.body, { status: 206, headers: h })
  }
  return new Response(oggetto.body, { headers: h })
})
