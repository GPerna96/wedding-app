// Service worker volutamente minimo: serve a rendere l'app installabile, non a
// servire contenuti dalla cache. Durante la festa il muro deve mostrare cio'
// che c'e' adesso, e una cache troppo zelante farebbe vedere foto vecchie.
const GUSCIO = 'guscio-v1'
const DA_TENERE = ['/', '/manifest.webmanifest', '/icona-192.png', '/icona-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(GUSCIO).then((c) => c.addAll(DA_TENERE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== GUSCIO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // Dati e media non passano mai di qui: sempre dalla rete, sempre freschi,
  // e con i cookie che li autorizzano.
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) return

  // Solo il guscio dell'app: prima la rete, la cache come rete di sicurezza
  // se il wifi della sala fa cilecca al momento dell'apertura.
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok && url.origin === location.origin) {
          const copia = r.clone()
          caches.open(GUSCIO).then((c) => c.put(e.request, copia))
        }
        return r
      })
      .catch(() => caches.match(e.request).then((c) => c ?? caches.match('/'))),
  )
})
