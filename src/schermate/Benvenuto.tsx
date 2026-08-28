import { useState } from 'react'
import { api } from '../api'
import { t } from '../lingua'
import { LettoreQr } from './LettoreQr'
import { Foglie } from './Foglie'

export function Benvenuto({ sposi, token, entrato }: {
  sposi: string
  token: string | null
  entrato: (nome: string) => void
}) {
  const [nome, setNome] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)
  const [lettore, setLettore] = useState(false)
  // Il token puo' arrivare dal QR aperto con la fotocamera di sistema oppure
  // essere letto qui dentro: da questo punto in poi non fa differenza.
  const [letto, setLetto] = useState<string | null>(null)
  const codice = token ?? letto

  const [primo, secondo] = sposi.split('&').map((s) => s.trim())

  async function invia(e: React.FormEvent) {
    e.preventDefault()
    if (nome.trim().length < 2) return setErrore(t.scriviNome)
    setInvio(true)
    setErrore(null)
    try {
      const r = await api.entra(codice ?? '', nome)
      entrato(r.nome)
    } catch (err) {
      setErrore(String(err).includes('token') ? t.linkNonValido : t.qualcosaStorto)
      setInvio(false)
    }
  }

  if (lettore) {
    return (
      <LettoreQr
        chiudi={() => setLettore(false)}
        trovato={(t) => { setLetto(t); setLettore(false) }}
      />
    )
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-7 text-center comparsa relative">
      <Foglie />
      <div className="relative z-10 flex flex-col items-center w-full">
      <p className="titolo text-fumo tracking-[0.3em] text-[13px] uppercase mb-8">
        {t.matrimonioDi}
      </p>

      <h1 className="titolo text-inchiostro leading-[1.05]">
        <span className="block text-6xl">{primo}</span>
        <span className="block text-3xl text-salvia my-2">&amp;</span>
        <span className="block text-6xl">{secondo}</span>
      </h1>

      <div className="w-16 h-px bg-salvia-chiara my-9" />

      {!codice ? (
        /* Senza il codice dell'invito non si entra: meglio dirlo subito che
           far scrivere un nome per poi rifiutarlo. */
        <div className="max-w-xs">
          <p className="text-fumo text-[17px] leading-relaxed mb-7">
{t.invitoSenzaCodice}
          </p>
          <div className="bg-carta border border-salvia-velo rounded-2xl px-6 py-7">
            <p className="titolo text-2xl mb-2.5">{t.inquadraCodice}</p>
            <p className="text-fumo text-[15px] leading-relaxed mb-6">
              {t.qrSulTavolo}
            </p>
            <button
              onClick={() => setLettore(true)}
              className="w-full bg-salvia text-crema rounded-2xl py-4 text-[17px] tracking-wide
                         active:scale-[0.98] transition-transform"
            >
              {t.apriFotocamera}
            </button>
          </div>
          <p className="text-fumo/70 text-[13px] mt-5 leading-relaxed">
{t.ancheConFotocamera}
          </p>
        </div>
      ) : (
      <>
      <p className="text-fumo text-[17px] leading-relaxed max-w-xs mb-8">
{t.invitoNome}
      </p>

      <form onSubmit={invia} className="w-full max-w-xs">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={t.tuoNome}
          autoComplete="name"
          autoFocus
          className="w-full bg-carta border border-salvia-velo rounded-2xl px-5 py-4
                     text-center text-[17px] placeholder:text-fumo/50 outline-none
                     focus:border-salvia-chiara transition-colors"
        />

        {errore && <p className="text-[14px] text-red-700/80 mt-3">{errore}</p>}

        <button
          type="submit"
          disabled={invio}
          className="w-full mt-4 bg-salvia text-crema rounded-2xl py-4 text-[17px] tracking-wide
                     disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {invio ? t.unAttimo : t.entra}
        </button>
      </form>
      </>
      )}
      </div>
    </div>
  )
}
