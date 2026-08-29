import { Hono } from 'hono'
import { richiedeOspite } from '../sessione'
import type { Env, Variabili } from '../tipi'

export const messaggi = new Hono<{ Bindings: Env; Variables: Variabili }>()

messaggi.use('/api/messaggi', richiedeOspite)

messaggi.get('/api/messaggi', async (c) => {
  const { results } = await c.env.DB.prepare(
    `select m.id, m.testo, m.creato_il, o.nome
       from messaggi m join ospiti o on o.id = m.ospite_id
      order by m.creato_il desc
      limit 200`,
  ).all()
  return c.json({ messaggi: results })
})

messaggi.post('/api/messaggi', async (c) => {
  const { testo } = await c.req.json<{ testo: string }>()
  const pulito = (testo ?? '').trim().slice(0, 1000)
  if (!pulito) return c.json({ errore: 'testo_vuoto' }, 400)

  await c.env.DB.prepare(
    'insert into messaggi (id, ospite_id, testo, creato_il) values (?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), c.var.ospite.id, pulito, Date.now()).run()

  return c.json({ ok: true })
})
