import { Hono } from 'hono'
import { richiedeOspite } from '../sessione'
import type { Env, Variabili } from '../tipi'

export const media = new Hono<{ Bindings: Env; Variables: Variabili }>()

const TIPI = new Set(['foto', 'video'])
const MAX_BYTE = 5 * 1024 * 1024 * 1024 // 5 GB: oltre non ci va nemmeno un 4K lunghissimo

/** Ripulisce il nome file: niente percorsi, niente caratteri che rompono le chiavi R2. */
function nomePulito(nome: string) {
  return (nome.split(/[\\/]/).pop() ?? 'file')
    .replace(/[^\w.\- ]+/g, '_')
    .slice(-120)
}

media.use('/api/media/*', richiedeOspite)
media.use('/api/upload/*', richiedeOspite)

/**
 * Apre un caricamento. Per i file piccoli basta un PUT singolo; sopra la soglia
 * si passa al multipart nativo di R2, che e' cio' che permette di riprendere
 * un video interrotto senza ricominciare da capo.
 */
media.post('/api/upload/inizia', async (c) => {
  const b = await c.req.json<{
    tipo: string; nomeFile?: string; byte: number
    larghezza?: number; altezza?: number; durataMs?: number
  }>()

  if (!TIPI.has(b.tipo)) return c.json({ errore: 'tipo_non_valido' }, 400)
  if (!Number.isFinite(b.byte) || b.byte <= 0 || b.byte > MAX_BYTE)
    return c.json({ errore: 'dimensione_non_valida' }, 400)

  const id = crypto.randomUUID()
  const nome = nomePulito(b.nomeFile ?? (b.tipo === 'foto' ? 'foto.jpg' : 'video.mp4'))
  const chiaveOriginale = `originali/${id}/${nome}`
  const chiaveAnteprima = `anteprime/${id}.webp`

  const multipart = b.byte > 10 * 1024 * 1024
  let uploadId: string | null = null
  if (multipart) {
    const mp = await c.env.MEDIA.createMultipartUpload(chiaveOriginale)
    uploadId = mp.uploadId
  }

  await c.env.DB.prepare(
    `insert into media (id, ospite_id, tipo, chiave_originale, chiave_anteprima,
                        upload_id, larghezza, altezza, durata_ms, byte, nome_file, creato_il)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, c.var.ospite.id, b.tipo, chiaveOriginale, chiaveAnteprima,
    uploadId, b.larghezza ?? null, b.altezza ?? null, b.durataMs ?? null,
    b.byte, nome, Date.now(),
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

/** L'anteprima: piccola, un PUT solo, ed e' cio' che fa comparire la foto nel muro. */
media.put('/api/upload/anteprima/:id', async (c) => {
  const m = await mio(c, c.req.param('id'))
  if (!m) return c.json({ errore: 'non_trovato' }, 404)

  await c.env.MEDIA.put(`anteprime/${m.id}.webp`, c.req.raw.body, {
    httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
  })
  return c.json({ ok: true })
})

/** File piccolo: l'originale in un colpo solo. */
media.put('/api/upload/diretto/:id', async (c) => {
  const m = await mio(c, c.req.param('id'))
  if (!m) return c.json({ errore: 'non_trovato' }, 404)

  await c.env.MEDIA.put(m.chiave_originale, c.req.raw.body, {
    httpMetadata: { contentType: c.req.header('x-tipo-file') || 'application/octet-stream' },
  })
  await c.env.DB.prepare("update media set stato = 'completo' where id = ?").bind(m.id).run()
  return c.json({ ok: true })
})

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

  await c.env.DB.prepare("update media set stato = 'completo' where id = ?").bind(m.id).run()
  return c.json({ ok: true })
})

/** Il muro. `dopo` permette al polling di chiedere solo le novita'. */
media.get('/api/media', async (c) => {
  const dopo = Number(c.req.query('dopo') ?? 0)
  const { results } = await c.env.DB.prepare(
    `select m.id, m.tipo, m.larghezza, m.altezza, m.durata_ms, m.stato, m.creato_il, o.nome
       from media m join ospiti o on o.id = m.ospite_id
      where m.nascosto = 0 and m.creato_il > ?
      order by m.creato_il desc
      limit 300`,
  ).bind(dopo).all()
  return c.json({ media: results })
})

/** Serve anteprime e originali da R2, con supporto Range per il seek dei video. */
media.get('/media/:genere/:id', async (c) => {
  const genere = c.req.param('genere')
  if (genere !== 'anteprima' && genere !== 'originale') return c.notFound()

  const riga = await c.env.DB.prepare(
    'select chiave_originale, chiave_anteprima, nascosto from media where id = ?',
  ).bind(c.req.param('id')).first<{
    chiave_originale: string; chiave_anteprima: string; nascosto: number
  }>()
  if (!riga || riga.nascosto) return c.notFound()

  const chiave = genere === 'anteprima' ? riga.chiave_anteprima : riga.chiave_originale
  const range = c.req.header('range')

  const oggetto = await c.env.MEDIA.get(chiave, range ? { range: c.req.raw.headers } : undefined)
  if (!oggetto) return c.notFound()

  const h = new Headers()
  oggetto.writeHttpMetadata(h)
  h.set('etag', oggetto.httpEtag)
  h.set('cache-control', 'public, max-age=31536000, immutable')
  h.set('accept-ranges', 'bytes')

  if (oggetto.range && 'offset' in oggetto.range) {
    const inizio = oggetto.range.offset ?? 0
    const fine = inizio + (oggetto.range.length ?? oggetto.size) - 1
    h.set('content-range', `bytes ${inizio}-${fine}/${oggetto.size}`)
    return new Response(oggetto.body, { status: 206, headers: h })
  }
  return new Response(oggetto.body, { headers: h })
})
