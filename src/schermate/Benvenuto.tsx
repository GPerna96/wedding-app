import { useState } from 'react'
import { api } from '../api'
import { t } from '../lingua'
import { LettoreQr } from './LettoreQr'
import { Foglie } from './Foglie'
import { AccessoSposi } from './AccessoSposi'

export function Benvenuto({ sposi, token, admin, entrato }: {
  sposi: string
  token: string | null
  admin: boolean
  entrato: (nome: string) => void
}) {
  const [nome, setNome] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [invio, setInvio] = useState(false)
  const [lettore, setLettore] = useState(false)
  // Il token puo' arrivare dal QR aperto con la fotocamera di sistema oppure
  // essere letto qui dentro: da questo punto in poi non fa differenza.
  const [letto, setLetto] = useState<string | null>(null)
  // Chi ha la chiave degli sposi e' gia' autorizzato: il QR non gli serve.
  const codice = token ?? letto ?? (admin ? 'sposi' : null)

  const nomiSposi = sposi.split('&').map((s) => s.trim()).filter(Boolean)
  const [primo, secondo] = nomiSposi
  // Agli sposi i nomi li proponiamo: sono scritti qui sopra, farli digitare
  // sarebbe un passaggio in piu' per niente. Restano due persone distinte
  // pero', perche' nel muro si deve capire chi dei due ha scattato.
  const [scriveNome, setScriveNome] = useState(false)
  const scortaSposi = admin && !scriveNome && nomiSposi.length === 2

  async function entraCome(comeNome: string) {
    setInvio(true)
    setErrore(null)
    try {
      const r = await api.entra(codice ?? '', comeNome)
      entrato(r.nome)
    } catch (err) {
      setErrore(String(err).includes('token') ? t.linkNonValido : t.qualcosaStorto)
      setInvio(false)
    }
  }

  function invia(e: React.FormEvent) {
    e.preventDefault()
    if (nome.trim().length < 2) return setErrore(t.scriviNome)
    entraCome(nome)
  }

  if (lettore) {
    return (
      <LettoreQr
        chiudi={() => setLettore(false)}
        trovato={(codiceLetto) => { setLetto(codiceLetto); setLettore(false) }}
      />
    )
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-7 py-8 text-center comparsa relative">
      <Foglie />

      <div className="relative z-10 flex flex-col items-center w-full">
        <p className="titolo text-fumo tracking-[0.3em] text-[13px] uppercase mb-8">
          {t.matrimonioDi}
        </p>

        {/* Come nella partecipazione: nomi grandi in corsivo, la e commerciale
            piccola in mezzo, tutto nel verde salvia. */}
        <h1 className="nomi text-salvia leading-[0.95]">
          <span className="block text-[62px]">{primo}</span>
          <span className="block text-[30px] my-1">&amp;</span>
          <span className="block text-[62px]">{secondo}</span>
        </h1>

        <div className="w-16 h-px bg-salvia-chiara my-9" />

        {!codice ? (
          <Ingresso apri={() => setLettore(true)} />
        ) : scortaSposi ? (
          <ScortaSposi
            nomi={nomiSposi}
            invio={invio}
            errore={errore}
            scegli={entraCome}
            preferisceScrivere={() => setScriveNome(true)}
          />
        ) : (
          <ChiediNome
            nome={nome}
            cambia={setNome}
            invia={invia}
            invio={invio}
            errore={errore}
          />
        )}
      </div>

      <div className="relative z-10 w-full">
        <AccessoSposi />
      </div>
    </div>
  )
}

/** Senza codice non si entra: meglio spiegarlo che offrire un campo inutile. */
function Ingresso({ apri }: { apri: () => void }) {
  return (
    <div className="max-w-xs">
      <p className="text-fumo text-[17px] leading-relaxed mb-7">{t.invitoSenzaCodice}</p>

      <div className="bg-carta border border-salvia-velo rounded-2xl px-6 py-7">
        <p className="titolo text-2xl mb-2.5">{t.inquadraCodice}</p>
        <p className="text-fumo text-[15px] leading-relaxed mb-6">{t.qrSulTavolo}</p>
        <button
          onClick={apri}
          className="w-full bg-salvia text-crema rounded-2xl py-4 text-[17px] tracking-wide
                     active:scale-[0.98] transition-transform"
        >
          {t.apriFotocamera}
        </button>
      </div>

      <p className="text-fumo/70 text-[13px] mt-5 leading-relaxed">{t.ancheConFotocamera}</p>
    </div>
  )
}

/** Un tocco invece di digitare: i loro nomi li conosciamo gia'. */
function ScortaSposi({ nomi, invio, errore, scegli, preferisceScrivere }: {
  nomi: string[]
  invio: boolean
  errore: string | null
  scegli: (nome: string) => void
  preferisceScrivere: () => void
}) {
  return (
    <div className="w-full max-w-xs">
      <p className="text-fumo text-[17px] leading-relaxed mb-7">{t.chiSei}</p>

      {nomi.map((chi) => (
        <button
          key={chi}
          onClick={() => scegli(chi)}
          disabled={invio}
          className="w-full mb-3 bg-salvia text-crema rounded-2xl py-4 text-[17px] tracking-wide
                     disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {chi}
        </button>
      ))}

      {errore && <p className="text-[14px] text-red-700/80 mb-2">{errore}</p>}

      {/* Un fotografo o un parente potrebbe avere la chiave senza essere loro. */}
      <button
        onClick={preferisceScrivere}
        className="w-full text-fumo text-sm py-3 underline underline-offset-4 decoration-fumo/25"
      >
        {t.altroNome}
      </button>
    </div>
  )
}

function ChiediNome({ nome, cambia, invia, invio, errore }: {
  nome: string
  cambia: (v: string) => void
  invia: (e: React.FormEvent) => void
  invio: boolean
  errore: string | null
}) {
  return (
    <>
      <p className="text-fumo text-[17px] leading-relaxed max-w-xs mb-8">{t.invitoNome}</p>

      <form onSubmit={invia} className="w-full max-w-xs">
        <input
          value={nome}
          onChange={(e) => cambia(e.target.value)}
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
  )
}
