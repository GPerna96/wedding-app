import { useEffect, useState } from 'react'
import { api, quando, type MessaggioRiga } from '../api'

export function Messaggi() {
  const [elenco, setElenco] = useState<MessaggioRiga[]>([])
  const [testo, setTesto] = useState('')
  const [invio, setInvio] = useState(false)

  async function ricarica() {
    try {
      setElenco((await api.messaggi()).messaggi)
    } catch { /* riprova al prossimo giro */ }
  }

  useEffect(() => {
    ricarica()
    const t = setInterval(() => document.visibilityState === 'visible' && ricarica(), 15000)
    return () => clearInterval(t)
  }, [])

  async function invia(e: React.FormEvent) {
    e.preventDefault()
    if (!testo.trim()) return
    setInvio(true)
    try {
      await api.inviaMessaggio(testo)
      setTesto('')
      await ricarica()
    } finally {
      setInvio(false)
    }
  }

  return (
    <div className="min-h-dvh pb-28">
      <header className="sicura-sopra px-5 pb-5 text-center">
        <h1 className="titolo text-[28px]">Due parole per loro</h1>
        <p className="text-fumo text-sm mt-1.5">Rita e Francesco le leggeranno tutte</p>
      </header>

      <form onSubmit={invia} className="px-4 mb-7">
        <textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          placeholder="Scrivi la tua dedica…"
          rows={3}
          maxLength={1000}
          className="w-full bg-carta border border-salvia-velo rounded-2xl px-4 py-3
                     outline-none focus:border-salvia-chiara resize-none text-[17px]
                     placeholder:text-fumo/50 transition-colors"
        />
        <button
          type="submit"
          disabled={invio || !testo.trim()}
          className="w-full mt-2 bg-salvia text-crema rounded-2xl py-3.5 tracking-wide
                     disabled:opacity-40 active:scale-[0.98] transition-transform"
        >
          {invio ? 'Invio…' : 'Lascia il messaggio'}
        </button>
      </form>

      <div className="px-4 space-y-3">
        {elenco.map((m) => (
          <div key={m.id} className="bg-carta border border-salvia-velo rounded-2xl px-5 py-4 comparsa">
            <p className="text-[17px] leading-relaxed whitespace-pre-wrap">{m.testo}</p>
            <p className="text-[13px] text-fumo mt-3">
              <span className="text-salvia font-medium">{m.nome}</span> · {quando(m.creato_il)}
            </p>
          </div>
        ))}
        {elenco.length === 0 && (
          <p className="text-center text-fumo text-[15px] py-12">
            Nessun messaggio ancora. Comincia tu.
          </p>
        )}
      </div>
    </div>
  )
}
