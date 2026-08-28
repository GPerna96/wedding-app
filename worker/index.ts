import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import { apriSessione, verifica } from './sessione'
import { media } from './rotte/media'
import { messaggi } from './rotte/messaggi'
import { admin } from './rotte/admin'
import type { Env, Variabili } from './tipi'

const app = new Hono<{ Bindings: Env; Variables: Variabili }>()

/**
 * Il manifest lo scrive il Worker, non un file statico, perche' deve portarsi
 * dietro il rientro.
 *
 * Su iOS un'app aggiunta alla schermata Home ha uno spazio dati tutto suo e
 * non eredita i cookie di Safari: aperta, si ritroverebbe fuori, con il QR
 * ormai lontano dal tavolo. Se chi chiede il manifest ha gia' una sessione
 * valida, start_url se la porta dentro e l'app installata riapre direttamente
 * il muro, con lo stesso nome.
 */
app.get('/manifest.webmanifest', async (c) => {
  const id = await verifica(getCookie(c, 'ospite'), c.env.SEGRETO_COOKIE)
  let partenza = '/'

  if (id) {
    // Un biglietto usa e getta, non la firma della sessione: quella vale un
    // anno, e in un indirizzo finirebbe nei log a ogni avvio dell'app.
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const ora = Date.now()
    await c.env.DB.batch([
      c.env.DB.prepare('delete from rientri where scade_il < ?').bind(ora),
      c.env.DB.prepare(
        'insert into rientri (token, ospite_id, creato_il, scade_il) values (?, ?, ?, ?)',
      ).bind(token, id, ora, ora + 90 * 24 * 60 * 60 * 1000),
    ])
    // Nel frammento, non nella query: il frammento non lascia mai il browser,
    // quindi non passa dai log del server ne' dall'intestazione Referer.
    partenza = `/#s=${token}`
  }

  return c.json({
    name: c.env.SPOSI,
    short_name: c.env.SPOSI.split('&')[0].trim(),
    start_url: partenza,
    scope: '/',
    display: 'standalone',
    background_color: '#F7F5F0',
    theme_color: '#F7F5F0',
    lang: 'it',
    icons: [
      { src: '/icona-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, {
    // Mai in cache condivisa: contiene il rientro di questo ospite.
    headers: { 'cache-control': 'private, no-store' },
  })
})

/**
 * Riapre la sessione dell'app installata, che i cookie di Safari non li vede.
 * Il biglietto si brucia qui: se dopo dovesse comparire da qualche parte, non
 * apre piu' niente.
 */
app.post('/api/riprendi', async (c) => {
  const { sessione } = await c.req.json<{ sessione: string }>()
  if (typeof sessione !== 'string' || sessione.length !== 64) {
    return c.json({ errore: 'sessione_non_valida' }, 401)
  }

  const riga = await c.env.DB.prepare(
    `select r.ospite_id, r.scade_il, o.nome
       from rientri r join ospiti o on o.id = r.ospite_id
      where r.token = ?`,
  ).bind(sessione).first<{ ospite_id: string; scade_il: number; nome: string }>()

  // Consumato in ogni caso: anche un biglietto scaduto sparisce al primo tentativo.
  if (riga) {
    await c.env.DB.prepare('delete from rientri where token = ?').bind(sessione).run()
  }
  if (!riga || riga.scade_il < Date.now()) {
    return c.json({ errore: 'sessione_non_valida' }, 401)
  }

  await apriSessione(c, riga.ospite_id)
  return c.json({ dentro: true, nome: riga.nome })
})

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
