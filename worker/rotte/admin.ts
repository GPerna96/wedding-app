import { Hono } from 'hono'
import { apriSessioneAdmin, richiedeAdmin } from '../sessione'
import { creaZip, type Voce } from '../zip'
import type { Env } from '../tipi'

export const admin = new Hono<{ Bindings: Env }>()

/** Unica rotta aperta: scambia la chiave (nel corpo) con il cookie. */
admin.post('/api/sposi/entra', async (c) => {
  const { chiave } = await c.req.json<{ chiave: string }>()
  if (!(await apriSessioneAdmin(c, chiave))) return c.json({ errore: 'non_autorizzato' }, 401)
  return c.json({ ok: true })
})

admin.use('/api/sposi/tutto', richiedeAdmin)
admin.use('/api/sposi/media/*', richiedeAdmin)
admin.use('/api/sposi/messaggi/*', richiedeAdmin)
admin.use('/api/sposi/elenco', richiedeAdmin)
admin.use('/api/sposi/deposito', richiedeAdmin)
admin.use('/api/sposi/pulisci-orfani', richiedeAdmin)
admin.use('/api/sposi/archivio', richiedeAdmin)

/** Come il muro, ma vede anche il nascosto e gli upload incompleti. */
admin.get('/api/sposi/tutto', async (c) => {
  const media = await c.env.DB.prepare(
    `select m.id, m.tipo, m.stato, m.byte, m.nome_file, m.creato_il, o.nome
       from media m join ospiti o on o.id = m.ospite_id
      order by m.creato_il desc`,
  ).all()
  const messaggi = await c.env.DB.prepare(
    `select m.id, m.testo, m.creato_il, o.nome
       from messaggi m join ospiti o on o.id = m.ospite_id
      order by m.creato_il desc`,
  ).all()
  const conteggi = await c.env.DB.prepare(
    `select
       (select count(*) from ospiti) as ospiti,
       (select count(*) from media where stato = 'completo') as completi,
       (select coalesce(sum(byte), 0) from media where stato = 'completo') as byte`,
  ).first()

  return c.json({ media: media.results, messaggi: messaggi.results, conteggi })
})

/**
 * Elimina un ricordo per davvero: la riga, l'originale e l'anteprima.
 *
 * Nascondere lasciava il file nel deposito a occupare spazio e a ricomparire
 * nell'archivio finale. Se gli sposi decidono che uno scatto non deve restare,
 * deve sparire del tutto.
 */
admin.delete('/api/sposi/media/:id', async (c) => {
  const id = c.req.param('id')
  const riga = await c.env.DB.prepare(
    'select chiave_originale, chiave_anteprima, upload_id from media where id = ?',
  ).bind(id).first<{
    chiave_originale: string; chiave_anteprima: string; upload_id: string | null
  }>()
  if (!riga) return c.json({ errore: 'non_trovato' }, 404)

  // Un caricamento ancora in corso va prima interrotto, altrimenti le parti
  // gia' inviate resterebbero nel deposito senza che nulla le nomini.
  if (riga.upload_id) {
    try {
      await c.env.MEDIA.resumeMultipartUpload(riga.chiave_originale, riga.upload_id).abort()
    } catch { /* gia' concluso o gia' interrotto */ }
  }

  await c.env.MEDIA.delete([riga.chiave_originale, riga.chiave_anteprima])
  await c.env.DB.prepare('delete from media where id = ?').bind(id).run()

  return c.json({ ok: true })
})

admin.delete('/api/sposi/messaggi/:id', async (c) => {
  await c.env.DB.prepare('delete from messaggi where id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

/**
 * Confronto fra cio' che sta nel deposito e cio' che risulta nel database.
 * A fine festa dice se qualche caricamento si e' fermato a meta': il file c'e'
 * ma nessuno lo elenchera' mai, oppure il contrario.
 */
admin.get('/api/sposi/deposito', async (c) => {
  const attese = new Set<string>()
  const { results } = await c.env.DB.prepare(
    'select chiave_originale, chiave_anteprima, stato from media',
  ).all<{ chiave_originale: string; chiave_anteprima: string; stato: string }>()
  for (const r of results) {
    if (r.stato === 'completo') attese.add(r.chiave_originale)
    attese.add(r.chiave_anteprima)
  }

  const nelDeposito: string[] = []
  let byte = 0
  let cursore: string | undefined
  do {
    const pagina = await c.env.MEDIA.list({ limit: 1000, cursor: cursore })
    for (const o of pagina.objects) {
      nelDeposito.push(o.key)
      byte += o.size
    }
    cursore = pagina.truncated ? pagina.cursor : undefined
  } while (cursore)

  const presenti = new Set(nelDeposito)
  return c.json({
    oggetti: nelDeposito.length,
    byte,
    // file nel deposito che il database non conosce
    orfani: nelDeposito.filter((k) => !attese.has(k)),
    // righe che promettono un file che non c'e'
    mancanti: [...attese].filter((k) => !presenti.has(k)),
  })
})

/**
 * Rimuove dal deposito i file che il database non conosce: restano quando un
 * caricamento si interrompe a meta'.
 *
 * Cancella per sempre, quindi vuole sapere in anticipo quanti file si aspetta
 * di trovare: se il numero non torna -- per esempio perche' il database e'
 * stato svuotato e allora *tutto* risulterebbe orfano -- si ferma senza fare
 * danni.
 */
admin.post('/api/sposi/pulisci-orfani', async (c) => {
  const { attesi } = await c.req.json<{ attesi: number }>()
  if (!Number.isInteger(attesi)) return c.json({ errore: 'serve_conferma' }, 400)

  const conosciute = new Set<string>()
  const { results } = await c.env.DB.prepare(
    'select chiave_originale, chiave_anteprima from media',
  ).all<{ chiave_originale: string; chiave_anteprima: string }>()
  for (const r of results) {
    conosciute.add(r.chiave_originale)
    conosciute.add(r.chiave_anteprima)
  }

  const orfani: string[] = []
  let cursore: string | undefined
  do {
    const pagina = await c.env.MEDIA.list({ limit: 1000, cursor: cursore })
    for (const o of pagina.objects) if (!conosciute.has(o.key)) orfani.push(o.key)
    cursore = pagina.truncated ? pagina.cursor : undefined
  } while (cursore)

  if (orfani.length !== attesi) {
    return c.json({
      errore: 'numero_diverso_dal_previsto',
      trovati: orfani.length,
      attesi,
    }, 409)
  }

  // A blocchi: delete accetta piu' chiavi per volta.
  for (let i = 0; i < orfani.length; i += 100) {
    await c.env.MEDIA.delete(orfani.slice(i, i + 100))
  }
  return c.json({ rimossi: orfani.length })
})

/**
 * Tutti gli originali in un archivio unico, costruito mentre viene scaricato.
 *
 * I nomi dentro l'archivio portano data e autore, cosi' una volta scompattati
 * si capisce chi ha ripreso cosa senza dover riaprire l'app.
 */
admin.get('/api/sposi/archivio', async (c) => {
  const { results } = await c.env.DB.prepare(
    `select m.chiave_originale, m.nome_file, m.creato_il, o.nome
       from media m join ospiti o on o.id = m.ospite_id
      where m.stato = 'completo'
      order by m.creato_il`,
  ).all<{ chiave_originale: string; nome_file: string; creato_il: number; nome: string }>()

  if (!results.length) return c.json({ errore: 'niente_da_scaricare' }, 404)

  const usati = new Set<string>()
  const voci: Voce[] = results.map((r, i) => {
    const d = new Date(r.creato_il)
    const quando = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}` +
      `-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
    const chi = r.nome.replace(/[^\p{L}\p{N} ]/gu, '').trim().replace(/\s+/g, '-') || 'ospite'
    let nome = `${quando}_${chi}_${r.nome_file || 'file'}`
    // Due scatti nello stesso minuto dalla stessa persona: il numero evita
    // che uno sovrascriva l'altro allo scompattamento.
    while (usati.has(nome.toLowerCase())) nome = `${quando}_${chi}_${i}_${r.nome_file || 'file'}`
    usati.add(nome.toLowerCase())
    return { nome, chiave: r.chiave_originale, quando: r.creato_il }
  })

  const oggi = new Date().toISOString().slice(0, 10)
  return new Response(creaZip(c.env.MEDIA, voci), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="matrimonio-${oggi}.zip"`,
      // La misura finale non si conosce in anticipo: si manda a flusso.
      'cache-control': 'no-store',
    },
  })
})

/** Elenco delle chiavi R2 degli originali, per il recupero finale con rclone. */
admin.get('/api/sposi/elenco', async (c) => {
  const { results } = await c.env.DB.prepare(
    `select chiave_originale from media where stato = 'completo' order by creato_il`,
  ).all<{ chiave_originale: string }>()

  return new Response(results.map((r) => r.chiave_originale).join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': 'attachment; filename="originali.txt"',
    },
  })
})
