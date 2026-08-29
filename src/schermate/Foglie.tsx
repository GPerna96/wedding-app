/**
 * I rametti d'ulivo della partecipazione, agli angoli.
 *
 * E' l'acquerello originale, estratto dal PDF con la sua trasparenza. Ne basta
 * uno solo: nella partecipazione le due copie sono la stessa immagine, e la
 * seconda e' semplicemente girata di mezzo giro.
 *
 * Puramente decorativi: aria-hidden e pointer-events-none, cosi' non
 * intercettano tocchi ne' vengono letti da chi naviga con lo screen reader.
 */
export function Foglie() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <img
        src="/foglia.png"
        alt=""
        // decorativa: non deve mai far aspettare il resto della pagina
        loading="lazy"
        decoding="async"
        className="absolute -top-14 -right-20 w-40 sm:w-52 rotate-180 opacity-85"
      />
      <img
        src="/foglia.png"
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute -bottom-14 -left-20 w-40 sm:w-52 opacity-85"
      />
    </div>
  )
}
