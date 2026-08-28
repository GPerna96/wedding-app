import { useState } from 'react'
import { api } from '../api'

export function Benvenuto({ sposi, token, entrato }: {
  sposi: string
  token: string | null
  entrato: (nome: string) => void
}) {
  const [nome, setNome] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)

  const [primo, secondo] = sposi.split('&').map((s) => s.trim())

  async function invia(e: React.FormEvent) {
    e.preventDefault()
    if (nome.trim().length < 2) return setErrore('Scrivi il tuo nome per entrare.')
    setInvio(true)
    setErrore(null)
    try {
      const r = await api.entra(token ?? '', nome)
      entrato(r.nome)
    } catch (err) {
      setErrore(
        String(err).includes('token')
          ? 'Questo link non è valido. Inquadra di nuovo il QR sul tavolo.'
          : 'Qualcosa non ha funzionato. Riprova.',
      )
      setInvio(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-7 text-center comparsa">
      <p className="titolo text-fumo tracking-[0.3em] text-xs uppercase mb-8">
        Il matrimonio di
      </p>

      <h1 className="titolo text-inchiostro leading-[1.05]">
        <span className="block text-6xl">{primo}</span>
        <span className="block text-3xl text-salvia my-2">&amp;</span>
        <span className="block text-6xl">{secondo}</span>
      </h1>

      <div className="w-16 h-px bg-salvia-chiara my-9" />

      <p className="text-fumo text-[15px] leading-relaxed max-w-xs mb-8">
        Le foto e i video che scatti oggi finiscono tutti qui, insieme a quelli
        degli altri invitati. Come ti chiami?
      </p>

      <form onSubmit={invia} className="w-full max-w-xs">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Il tuo nome"
          autoComplete="name"
          autoFocus
          className="w-full bg-carta border border-salvia-velo rounded-2xl px-5 py-4
                     text-center placeholder:text-fumo/50 outline-none
                     focus:border-salvia-chiara transition-colors"
        />

        {errore && <p className="text-[13px] text-red-700/80 mt-3">{errore}</p>}

        <button
          type="submit"
          disabled={invio}
          className="w-full mt-4 bg-salvia text-crema rounded-2xl py-4 tracking-wide
                     disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {invio ? 'Un attimo…' : 'Entra'}
        </button>
      </form>
    </div>
  )
}
