import { Hono } from 'hono'
import { richiedeAdmin } from '../sessione'
import type { Env } from '../tipi'

export const admin = new Hono<{ Bindings: Env }>()

admin.use('/api/sposi/*', richiedeAdmin)

/** Come il muro, ma vede anche il nascosto e gli upload incompleti. */
admin.get('/api/sposi/tutto', async (c) => {
  const media = await c.env.DB.prepare(
    `select m.id, m.tipo, m.stato, m.nascosto, m.byte, m.nome_file, m.creato_il, o.nome
       from media m join ospiti o on o.id = m.ospite_id
      order by m.creato_il desc`,
  ).all()
  const messaggi = await c.env.DB.prepare(
    `select m.id, m.testo, m.nascosto, m.creato_il, o.nome
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

admin.post('/api/sposi/nascondi', async (c) => {
  const { tipo, id, nascosto } = await c.req.json<{
    tipo: 'media' | 'messaggi'; id: string; nascosto: boolean
  }>()
  if (tipo !== 'media' && tipo !== 'messaggi') return c.json({ errore: 'tipo' }, 400)

  await c.env.DB.prepare(`update ${tipo} set nascosto = ? where id = ?`)
    .bind(nascosto ? 1 : 0, id).run()
  return c.json({ ok: true })
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
