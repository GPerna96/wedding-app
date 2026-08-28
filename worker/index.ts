import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { apriSessione, verifica } from './sessione'
import { media } from './rotte/media'
import { messaggi } from './rotte/messaggi'
import { admin } from './rotte/admin'
import type { Env, Variabili } from './tipi'

const app = new Hono<{ Bindings: Env; Variables: Variabili }>()

/** Chi sono? Decide se mostrare il benvenuto o entrare dritti nel muro. */
app.get('/api/io', async (c) => {
  const id = await verifica(getCookie(c, 'ospite'), c.env.SEGRETO_COOKIE)
  if (!id) return c.json({ dentro: false, sposi: c.env.SPOSI })

  const riga = await c.env.DB.prepare('select nome from ospiti where id = ?')
    .bind(id).first<{ nome: string }>()
  if (!riga) return c.json({ dentro: false, sposi: c.env.SPOSI })

  return c.json({ dentro: true, nome: riga.nome, sposi: c.env.SPOSI })
})

/** L'ingresso dal QR: token dell'evento piu' il nome, e il cookie dura un anno. */
app.post('/api/entra', async (c) => {
  const { token, nome } = await c.req.json<{ token: string; nome: string }>()

  if (token !== c.env.TOKEN_EVENTO) return c.json({ errore: 'token_non_valido' }, 401)

  const pulito = (nome ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
  if (pulito.length < 2) return c.json({ errore: 'nome_troppo_corto' }, 400)

  const id = crypto.randomUUID()
  await c.env.DB.prepare('insert into ospiti (id, nome, creato_il) values (?, ?, ?)')
    .bind(id, pulito, Date.now()).run()

  await apriSessione(c, id)
  return c.json({ dentro: true, nome: pulito })
})

app.route('/', media)
app.route('/', messaggi)
app.route('/', admin)

export default app
