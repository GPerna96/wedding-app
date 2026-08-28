export type MediaRiga = {
  id: string
  nascosto?: number
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
  io: () => leggi<{ dentro: boolean; nome?: string; sposi: string; admin: boolean }>('/api/io'),

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

  nascondi: (tipo: 'media' | 'messaggi', id: string, nascosto: boolean) =>
    fetch('/api/sposi/nascondi', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo, id, nascosto }),
    }).then((r) => {
      if (!r.ok) throw new Error(String(r.status))
    }),

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
