/*
 * La scorta dei caricamenti in sospeso.
 *
 * La coda viveva soltanto nella memoria della pagina: bastava che un invitato
 * chiudesse l'app -- e lo faceva appena vedeva la foto comparire nel muro, non
 * sapendo che l'originale era ancora in viaggio -- perche' il caricamento
 * morisse per sempre. La sera del matrimonio e' andata cosi' per 56 ricordi.
 *
 * Qui i file in attesa restano scritti sul telefono, e alla riapertura l'app
 * riprende da sola. I file molto grandi non si salvano: occuperebbero il doppio
 * dello spazio e su iPhone la quota finirebbe subito.
 */

const NOME = 'ricordi-in-sospeso'
const DEPOSITO = 'lavori'
const MAX_DA_SALVARE = 100 * 1024 * 1024

export type Sospeso = { id: string; file: File; tipo: 'foto' | 'video' }

function apri(): Promise<IDBDatabase> {
  return new Promise((risolvi, rifiuta) => {
    const r = indexedDB.open(NOME, 1)
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(DEPOSITO)) r.result.createObjectStore(DEPOSITO, { keyPath: 'id' })
    }
    r.onsuccess = () => risolvi(r.result)
    r.onerror = () => rifiuta(r.error)
  })
}

async function transazione<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await apri()
  try {
    return await new Promise<T>((risolvi, rifiuta) => {
      const richiesta = fn(db.transaction(DEPOSITO, modo).objectStore(DEPOSITO))
      richiesta.onsuccess = () => risolvi(richiesta.result)
      richiesta.onerror = () => rifiuta(richiesta.error)
    })
  } finally {
    db.close()
  }
}

export const scorta = {
  async salva(l: Sospeso) {
    if (l.file.size > MAX_DA_SALVARE) return
    try { await transazione('readwrite', (s) => s.put(l)) } catch { /* niente spazio o navigazione privata */ }
  },

  async togli(id: string) {
    try { await transazione('readwrite', (s) => s.delete(id)) } catch { /* pazienza */ }
  },

  async tutti(): Promise<Sospeso[]> {
    try {
      const righe = await transazione<Sospeso[]>('readonly', (s) => s.getAll() as IDBRequest<Sospeso[]>)
      // Un File salvato puo' tornare vuoto se il sistema ha ripulito il file
      // originale sotto: meglio scartarlo che ricaricare zero byte.
      return righe.filter((r) => r.file instanceof Blob && r.file.size > 0)
    } catch {
      return []
    }
  },
}

/**
 * Lo schermo resta sveglio mentre si carica: un telefono che si blocca
 * sospende le richieste in volo, ed e' un altro modo di perdere un originale.
 */
export function tieniSveglio() {
  let presa: { release: () => Promise<void> } | null = null
  const api = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<any> } }).wakeLock
  if (!api) return () => {}

  let vivo = true
  const chiedi = async () => {
    try { presa = await api.request('screen') } catch { /* negato: si prosegue lo stesso */ }
  }
  // Tornando sull'app la presa va richiesta di nuovo: il sistema la revoca.
  const alRitorno = () => { if (vivo && document.visibilityState === 'visible') chiedi() }
  document.addEventListener('visibilitychange', alRitorno)
  chiedi()

  return () => {
    vivo = false
    document.removeEventListener('visibilitychange', alRitorno)
    presa?.release().catch(() => {})
    document.removeEventListener('visibilitychange', alRitorno)
  }
}
