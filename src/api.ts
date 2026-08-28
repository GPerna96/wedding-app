export type MediaRiga = {
  id: string
  tipo: 'foto' | 'video'
  larghezza: number | null
  altezza: number | null
  durata_ms: number | null
  stato: string
  creato_il: number
  nome: string
}

export type MessaggioRiga = {
  id: string
  testo: string
  creato_il: number
  nome: string
}

async function leggi<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(String(r.status))
  return r.json() as Promise<T>
}

export const api = {
  io: () => leggi<{ dentro: boolean; nome?: string; sposi: string }>('/api/io'),

  entra: async (token: string, nome: string) => {
    const r = await fetch('/api/entra', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, nome }),
    })
    if (!r.ok) {
      const e = (await r.json().catch(() => ({}))) as { errore?: string }
      throw new Error(e.errore ?? 'errore')
    }
    return r.json() as Promise<{ dentro: true; nome: string }>
  },

  media: (dopo = 0) => leggi<{ media: MediaRiga[] }>(`/api/media?dopo=${dopo}`),

  messaggi: () => leggi<{ messaggi: MessaggioRiga[] }>('/api/messaggi'),

  inviaMessaggio: (testo: string) =>
    fetch('/api/messaggi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testo }),
    }).then((r) => {
      if (!r.ok) throw new Error(String(r.status))
    }),
}

export function quando(ms: number) {
  const min = Math.floor((Date.now() - ms) / 60000)
  if (min < 1) return 'adesso'
  if (min < 60) return `${min} min fa`
  const ore = Math.floor(min / 60)
  if (ore < 24) return `${ore} h fa`
  return new Date(ms).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}
