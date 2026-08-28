import { createMiddleware } from 'hono/factory'
import { getCookie, setCookie } from 'hono/cookie'
import type { Env, Variabili } from './tipi'

const COOKIE = 'ospite'
const UN_ANNO = 60 * 60 * 24 * 365

const codifica = new TextEncoder()

async function chiave(segreto: string) {
  return crypto.subtle.importKey(
    'raw',
    codifica.encode(segreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function base64url(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Confronto a tempo costante: evita di far trapelare la firma un byte alla volta. */
function ugualiSempre(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function firma(valore: string, segreto: string) {
  const f = await crypto.subtle.sign('HMAC', await chiave(segreto), codifica.encode(valore))
  return `${valore}.${base64url(f)}`
}

export async function verifica(token: string | undefined, segreto: string) {
  if (!token) return null
  const taglio = token.lastIndexOf('.')
  if (taglio <= 0) return null
  const valore = token.slice(0, taglio)
  const atteso = await firma(valore, segreto)
  return ugualiSempre(token, atteso) ? valore : null
}

/** In produzione e' sempre https; in locale il flag Secure impedirebbe al browser di salvare il cookie. */
function suHttps(c: any) {
  return new URL(c.req.url).protocol === 'https:'
}

export async function apriSessione(c: any, idOspite: string) {
  setCookie(c, COOKIE, await firma(idOspite, c.env.SEGRETO_COOKIE), {
    httpOnly: true,
    secure: suHttps(c),
    sameSite: 'Lax',
    path: '/',
    maxAge: UN_ANNO,
  })
}

/** Blocca chi non ha un cookie valido. Popola c.var.ospite per le rotte a valle. */
export const richiedeOspite = createMiddleware<{ Bindings: Env; Variables: Variabili }>(
  async (c, next) => {
    const id = await verifica(getCookie(c, COOKIE), c.env.SEGRETO_COOKIE)
    if (!id) return c.json({ errore: 'non_autenticato' }, 401)

    const riga = await c.env.DB.prepare('select id, nome from ospiti where id = ?')
      .bind(id)
      .first<{ id: string; nome: string }>()
    // Cookie firmato ma ospite sparito dal database (es. dopo un reset): rimandalo al benvenuto.
    if (!riga) return c.json({ errore: 'non_autenticato' }, 401)

    c.set('ospite', riga)
    await next()
  },
)

/** Il pannello sposi: stessa firma, segreto diverso. */
export const richiedeAdmin = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const chiaveUrl = c.req.query('k')
  const daCookie = await verifica(getCookie(c, 'sposi'), c.env.SEGRETO_ADMIN)

  if (daCookie !== 'ok') {
    if (chiaveUrl !== c.env.SEGRETO_ADMIN) return c.json({ errore: 'non_autorizzato' }, 401)
    setCookie(c, 'sposi', await firma('ok', c.env.SEGRETO_ADMIN), {
      httpOnly: true, secure: suHttps(c), sameSite: 'Lax', path: '/', maxAge: UN_ANNO,
    })
  }
  await next()
})
